/**
 * offline.js — โหมดออฟไลน์ (H10)
 *  - งานบันทึก (ต้นใหม่ รูป ชีพลักษณ์ ฯลฯ) ถ้าไม่มีเน็ต จะเก็บไว้ใน "กล่องรอส่ง" (IndexedDB) แล้วส่งอัตโนมัติเมื่อมีเน็ต
 *  - ต้นที่สร้างตอนออฟไลน์ได้รหัสชั่วคราว LOCAL-... แล้วระบบแทนด้วยรหัสจริงตอนส่ง
 *  - เก็บข้อมูลรายการล่าสุดไว้ในเครื่อง เปิดดูได้แม้ไม่มีเน็ต + Service Worker เก็บไฟล์หน้าเว็บ/แผนที่
 */
var Offline = (function () {
  var DBNAME = 'bmf_offline', STORE = 'outbox', MAP_KEY = 'bmf_idmap', BOOT_KEY = 'bmf_boot_cache';
  var QUEUEABLE = ['saveDraft', 'uploadPhoto', 'submit', 'addPhenology', 'addMeasurement', 'reportIssue', 'addCare', 'addFauna', 'saveSpecimen'];
  var LABEL = {
    saveDraft: '🌳 บันทึกข้อมูลต้นไม้', uploadPhoto: '📷 อัปโหลดรูป', submit: '📤 ส่งให้ครูตรวจ', addPhenology: '🌸 บันทึกชีพลักษณ์',
    addMeasurement: '📏 วัดขนาดซ้ำ', reportIssue: '⚠️ แจ้งปัญหา', addCare: '🧑‍🌾 บันทึกการดูแล', addFauna: '🐦 สิ่งมีชีวิตร่วม', saveSpecimen: '🗂️ ตัวอย่างแห้ง'
  };
  var LOCAL_RE = /"(LOCAL-[A-Z][0-9a-z]+)"/g;
  var items = [], flushing = false, dbp = null, memoryOnly = false;

  // ---------- ที่เก็บ ----------
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('no idb'));
      var r = indexedDB.open(DBNAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    }).catch(function (e) { memoryOnly = true; throw e; });
    return dbp;
  }
  function tx(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var res = fn(t.objectStore(STORE));
        t.oncomplete = function () { resolve(res && res.result); };
        t.onerror = function () { reject(t.error); };
      });
    }).catch(function () { return null; });
  }
  function persist(it) { return tx('readwrite', function (s) { return s.put(it); }); }
  function unpersist(id) { return tx('readwrite', function (s) { return s.delete(id); }); }
  function loadAll() { return tx('readonly', function (s) { return s.getAll(); }).then(function (r) { return r || []; }); }

  function getMap() { try { return JSON.parse(localStorage.getItem(MAP_KEY)) || {}; } catch (e) { return {}; } }
  function setMap(local, real) {
    var m = getMap(); m[local] = real;
    try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch (e) { /* ignore */ }
  }
  function resolveId(v) { var m = getMap(); return typeof v === 'string' && m[v] ? m[v] : v; }
  function resolveDeep(data) {
    var m = getMap();
    return JSON.parse(JSON.stringify(data).replace(LOCAL_RE, function (all, id) { return m[id] ? '"' + m[id] + '"' : all; }));
  }
  function hasUnresolved(data) { LOCAL_RE.lastIndex = 0; return LOCAL_RE.test(JSON.stringify(resolveDeep(data))); }
  function isLocal(v) { return typeof v === 'string' && v.indexOf('LOCAL-') === 0; }
  function newId(kind) { return 'LOCAL-' + kind + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- คิว ----------
  function enqueue(action, data) {
    var it = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), action: action, data: JSON.parse(JSON.stringify(data)), created: new Date().toISOString() };
    var result = { queued: true };
    if (action === 'saveDraft') {
      var t = it.data.tree || {};
      var tid = t.tree_id;
      if (!tid) { tid = it.localTree = newId('T'); }
      var known = App.treeById && App.treeById[tid];
      result = {
        queued: true, inside_boundary: null,
        tree: Object.assign({ status: 'draft', can_edit: true, zone_id: '' }, known || {}, t, { tree_id: tid, tree_code: (known && known.tree_code) || '(รอส่ง)' }),
        species: null
      };
      if (it.data.species_mode === 'new') {
        var sid = (it.data.species || {}).species_id;
        if (!sid) { sid = it.localSpecies = newId('S'); }
        result.species = Object.assign({}, it.data.species, { species_id: sid, status: 'draft' });
      }
    } else if (action === 'uploadPhoto') {
      var pid = it.localPhoto = newId('P');
      var src = 'data:' + (it.data.mime || 'image/jpeg') + ';base64,' + it.data.data;
      result = { queued: true, photo_id: pid, tree_id: it.data.tree_id, part: it.data.part, thumb: src, full: src, approved: false, proxy: false, has_scale: !!it.data.has_scale };
    } else if (action === 'submit') {
      result = { queued: true, status: 'queued' };
    }
    items.push(it);
    persist(it);
    render();
    return Promise.resolve(result);
  }

  function remove(it) {
    items = items.filter(function (x) { return x !== it; });
    unpersist(it.id);
  }

  var flushTimer = null;
  function flushSoon() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 800); }

  function flush() {
    if (flushing || !items.length || navigator.onLine === false) { render(); return Promise.resolve(0); }
    flushing = true;
    render();
    var done = 0;
    function next() {
      var it = items.filter(function (x) { return !x.failed; })[0];
      if (!it) return Promise.resolve();
      var data = resolveDeep(it.data);
      if (hasUnresolved(data)) {
        it.failed = 'อ้างถึงรายการก่อนหน้าที่ส่งไม่สำเร็จ';
        persist(it);
        return next();
      }
      return API.call(it.action, data).then(function (res) {
        if (it.localTree && res && res.tree) setMap(it.localTree, res.tree.tree_id);
        if (it.localSpecies && res && res.species) setMap(it.localSpecies, res.species.species_id);
        if (it.localPhoto && res && res.photo_id) setMap(it.localPhoto, res.photo_id);
        remove(it);
        done++;
        render();
        return next();
      }, function (e) {
        if (!e.server) throw e; // ยังออฟไลน์ หยุดไว้ก่อน
        it.failed = e.message;
        persist(it);
        return next();
      });
    }
    return next().then(function () {
      flushing = false;
      render();
      if (done) {
        UI.toast('📤 ส่งข้อมูลที่บันทึกตอนออฟไลน์แล้ว ' + done + ' รายการ', 'ok');
        App.refresh().catch(function () { });
      }
      if (items.some(function (x) { return x.failed; })) UI.toast('มีบางรายการส่งไม่สำเร็จ — แตะ 📤 ที่แถบด้านบนเพื่อดู', 'warn');
      return done;
    }, function () { flushing = false; render(); return done; });
  }

  /** แทน api() — งานบันทึกที่ส่งไม่ได้เพราะไม่มีเน็ต จะเข้าคิวแทน */
  function call(action, data) {
    data = data || {};
    if (action === 'deletePhoto' && isLocal(data.photo_id)) {
      items.filter(function (x) { return x.localPhoto === data.photo_id; }).forEach(remove);
      render();
      return Promise.resolve(true);
    }
    if (QUEUEABLE.indexOf(action) < 0) {
      if (hasUnresolved(data)) return Promise.reject(new Error('รายการนี้ยังรอส่งขึ้นระบบ (ออฟไลน์) — ทำได้หลังส่งข้อมูลแล้ว'));
      return API.call(action, resolveDeep(data));
    }
    var pending = items.some(function (x) { return !x.failed; });
    if (pending || navigator.onLine === false || hasUnresolved(data)) {
      var r = enqueue(action, data);
      flushSoon();
      return r;
    }
    return API.call(action, data).catch(function (e) {
      if (e.server) throw e;
      return enqueue(action, data);
    });
  }

  // ---------- ข้อมูลรายการล่าสุด ----------
  function saveBoot(b) {
    try { localStorage.setItem(BOOT_KEY, JSON.stringify({ at: Date.now(), user: b.me ? b.me.user_id : '', boot: b })); } catch (e) { /* พื้นที่ไม่พอ ข้าม */ }
  }
  function cachedBoot() {
    try {
      var c = JSON.parse(localStorage.getItem(BOOT_KEY));
      return c && c.boot ? c : null;
    } catch (e) { return null; }
  }

  // ---------- UI ----------
  function render() {
    var chip = document.getElementById('outboxChip');
    if (!chip) return;
    var n = items.length, off = navigator.onLine === false;
    chip.classList.toggle('hidden', !n && !off);
    chip.innerHTML = (off ? '📴 ' : '') + (n ? '📤 <span>' + n + (flushing ? '…' : '') + '</span>' : '<span>ออฟไลน์</span>');
    chip.title = n ? 'รอส่ง ' + n + ' รายการ' : 'ไม่มีอินเทอร์เน็ต';
  }

  function showOutbox() {
    var body = items.length ? '<div class="list">' + items.map(function (it) {
      var d = it.data || {};
      var what = d.part ? ' · ' + Forms.partLabel(d.part) : '';
      return '<div class="list-item"><div class="body"><div class="title">' + (LABEL[it.action] || it.action) + what + '</div>' +
        '<div class="sub">' + UI.thDate(it.created, true) + ' · ' + esc(resolveId(d.tree_id || (d.tree && d.tree.tree_id) || it.localTree || '')) + '</div>' +
        (it.failed ? '<div class="small" style="color:var(--red)">ส่งไม่สำเร็จ: ' + esc(it.failed) + '</div>' : '') + '</div>' +
        '<button class="btn sm danger" data-del="' + esc(it.id) + '">ลบ</button></div>';
    }).join('') + '</div>' : '<p>ไม่มีรายการรอส่ง</p>';
    UI.modal({
      title: '📤 กล่องรอส่ง', body: (navigator.onLine === false ? '<div class="alert warn"><span class="ic">📴</span><div>ตอนนี้ไม่มีอินเทอร์เน็ต — ระบบจะส่งให้อัตโนมัติเมื่อกลับมาออนไลน์ (เปิดหน้าเว็บค้างไว้หรือเปิดใหม่ภายหลังก็ได้)</div></div>' : '') + body,
      buttons: [{ label: 'ปิด', value: null }, {
        label: 'ส่งตอนนี้', cls: 'primary', onClick: function () {
          items.forEach(function (x) { delete x.failed; });
          return flush().then(function () { return true; });
        }
      }],
      onOpen: function (m) {
        m.addEventListener('click', function (e) {
          var b = e.target.closest('[data-del]');
          if (!b) return;
          var it = items.filter(function (x) { return x.id === b.dataset.del; })[0];
          if (it && window.confirm('ลบรายการนี้ออกจากกล่องรอส่ง? ข้อมูลนี้จะไม่ถูกส่ง')) { remove(it); b.closest('.list-item').remove(); render(); }
        });
      }
    });
  }

  function init() {
    var ua = document.getElementById('userArea');
    if (ua && !document.getElementById('outboxChip')) {
      var chip = document.createElement('button');
      chip.id = 'outboxChip';
      chip.className = 'user-chip hidden';
      chip.style.marginRight = '6px';
      chip.onclick = showOutbox;
      ua.parentNode.insertBefore(chip, ua);
    }
    window.addEventListener('online', function () { render(); flushSoon(); });
    window.addEventListener('offline', render);
    setInterval(function () { if (items.length) flush(); }, 60000);
    loadAll().then(function (all) {
      items = items.concat(all.filter(function (x) { return !items.some(function (y) { return y.id === x.id; }); }))
        .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
      render();
      flushSoon();
    });
    // Service Worker: เก็บไฟล์หน้าเว็บ/ไลบรารี/ภาพแผนที่ไว้ใช้ตอนออฟไลน์ (ใช้ไม่ได้เมื่อหน้าเว็บรันใน Apps Script)
    if ('serviceWorker' in navigator && API.mode !== 'gas' && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('SW', e); });
    }
  }

  return {
    init: init, call: call, flush: flush, saveBoot: saveBoot, cachedBoot: cachedBoot, resolveId: resolveId, isLocal: isLocal,
    pendingCount: function () { return items.length; }, showOutbox: showOutbox, _items: function () { return items; }
  };
})();

// งานทั้งระบบเรียกผ่าน Offline.call
function api(action, data) { return Offline.call(action, data); }
