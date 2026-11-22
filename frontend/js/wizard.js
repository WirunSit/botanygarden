/**
 * wizard.js — เพิ่ม/แก้ไขต้นไม้ทีละขั้น (7 ขั้น)
 * 1 ปักหมุด → 2 ถ่ายรูป → 3 AI ช่วยดู → 4 ระบุชนิด → 5 ลักษณะพฤกษศาสตร์ → 6 วัดขนาด → 7 ตรวจทานและส่ง
 */
(function () {
  var STEPS = ['', 'ปักหมุดตำแหน่ง', 'ถ่ายรูปตามรายการ', 'ให้ AI ช่วยดู', 'เลือก/ยืนยันชนิด', 'ลักษณะพฤกษศาสตร์', 'วัดขนาดและสภาพต้น', 'ตรวจทานและส่ง'];
  var STEP_ICON = ['', '📍', '📷', '🤖', '✅', '🌿', '📏', '📤'];
  var TREE_FIELDS = ['lat', 'lng', 'gps_accuracy_m', 'gps_method', 'altitude', 'zone_id', 'height_m', 'gbh_cm', 'canopy_m',
    'age_est', 'planting_source', 'health', 'label_status', 'notes', 'tree_code'];

  var W, el, map, marker, accCircle, gpsJob, uploads, dirty, saveTimer, onlineHandler;

  function localKey() { return 'bmf_wizard_' + App.me.user_id; }
  function saveLocal() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(localKey(), JSON.stringify(Object.assign({}, W, { photos: [], reviews: [] }))); } catch (e) { /* ignore */ }
    }, 300);
  }
  function clearLocal() { try { localStorage.removeItem(localKey()); } catch (e) { /* ignore */ } }
  function loadLocal() { try { return JSON.parse(localStorage.getItem(localKey())); } catch (e) { return null; } }

  function blank() {
    return { tree_id: null, tree_code: '', status: 'draft', tree: { label_status: 'ยังไม่มีป้าย' }, species_mode: null, species_id: null,
      species: {}, photos: [], ai: null, step: 1, q: 0, reviews: [], aiPrefilled: false };
  }

  function settings() { return App.boot.settings || {}; }
  function aiOn() { return String(settings().ai_enabled).toUpperCase() === 'TRUE'; }
  function requiredParts() { return String(settings().required_photo_parts || '').split(',').map(function (s) { return s.trim(); }).filter(String); }
  function photosOf(part) { return W.photos.filter(function (p) { return p.part === part; }); }
  function missingParts() { return requiredParts().filter(function (p) { return !photosOf(p).length; }); }
  function editable() { return W.status === 'draft' || W.status === 'returned'; }
  function isTeacher() { return App.level() >= 3; }

  // ---------- เข้าหน้า ----------
  App.pages.wizard = function (params, q, view) {
    el = view;
    uploads = [];
    dirty = false;
    document.body.classList.add('wizard-mode');
    onlineHandler = function () { uploads.filter(function (u) { return u.error; }).forEach(retryUpload); };
    window.addEventListener('online', onlineHandler);

    var ready;
    if (params.id) {
      ready = api('getTree', { tree_id: params.id }).then(function (r) {
        if (!r.tree.can_edit) throw new Error('แก้ไขต้นนี้ไม่ได้ (ส่งตรวจแล้ว หรือไม่ใช่งานของคุณ)');
        W = fromServer(r);
        W.step = 7;
      });
    } else {
      var saved = loadLocal();
      if (saved && saved.tree_id) {
        saved.tree_id = Offline.resolveId(saved.tree_id);
        if (saved.species && saved.species.species_id) saved.species.species_id = Offline.resolveId(saved.species.species_id);
      }
      var localOnly = saved && Offline.isLocal(saved.tree_id);
      if (saved && (!saved.tree_id || localOnly || (App.treeById[saved.tree_id] && App.treeById[saved.tree_id].can_edit))) {
        W = Object.assign(blank(), saved);
        ready = W.tree_id && !localOnly ? api('getTree', { tree_id: W.tree_id }).then(function (r) {
          W.photos = r.photos; W.reviews = r.reviews || []; W.status = r.tree.status;
          UI.toast('ทำต่อจากร่างที่ค้างไว้ (' + (W.tree_code || W.tree_id) + ')');
        }).catch(function () { W = blank(); }) : Promise.resolve();
      } else {
        W = blank();
        ready = Promise.resolve();
      }
    }
    return ready.then(function () { render(); return teardown; });
  };

  function fromServer(r) {
    var w = blank();
    w.tree_id = r.tree.tree_id;
    w.tree_code = r.tree.tree_code;
    w.status = r.tree.status;
    TREE_FIELDS.forEach(function (k) { if (r.tree[k] !== null && r.tree[k] !== undefined && r.tree[k] !== '') w.tree[k] = r.tree[k]; });
    w.photos = r.photos || [];
    w.reviews = r.reviews || [];
    w.ai = r.ai || null;
    if (!r.species || r.tree.species_id === 'UNKNOWN') {
      w.species_mode = 'unknown';
    } else if (r.species_can_edit && r.species.status !== 'verified') {
      w.species_mode = 'new';
      w.species = Object.assign({}, r.species);
    } else {
      w.species_mode = 'existing';
      w.species_id = r.species.species_id;
    }
    w.aiPrefilled = true;
    return w;
  }

  function teardown() {
    stopGps();
    if (map) { map.remove(); map = null; }
    window.removeEventListener('online', onlineHandler);
    document.body.classList.remove('wizard-mode');
    var f = document.querySelector('.wz-foot');
    if (f) f.remove();
    if (dirty) App.refresh().catch(function () { });
  }

  function stopGps() { if (gpsJob) { gpsJob.cancel(); gpsJob = null; } }

  // ---------- โครงหน้า ----------
  function render() {
    stopGps();
    if (map) { map.remove(); map = null; }
    var s = W.step;
    if (s === 5 && W.species_mode !== 'new') s = W.step = 6;
    var dots = '';
    for (var i = 1; i <= 7; i++) dots += '<div class="dot ' + (i < s ? 'done' : i === s ? 'now' : '') + '"></div>';
    var comments = W.reviews.filter(function (r) { return r.decision === 'comment' && r.comment; });
    el.innerHTML = '<div class="wz-head"><div class="wz-steps">' + dots + '</div><div class="wz-title"><h2>' + STEP_ICON[s] + ' ขั้น ' + s + '/7 · ' + STEPS[s] + '</h2>' +
      '<span class="small muted nowrap">' + (W.tree_code ? '<span class="code-tag">' + esc(W.tree_code) + '</span>' : 'ต้นใหม่') + '</span></div></div>' +
      (W.status === 'returned' && s !== 7 && comments.length ? '<div class="alert warn"><span class="ic">↩️</span><div>ครูส่งกลับให้แก้ไข — ดูความเห็นทั้งหมดได้ที่ขั้น 7</div></div>' : '') +
      '<div id="wzBody"></div>';
    var foot = document.querySelector('.wz-foot');
    if (!foot) { foot = document.createElement('div'); foot.className = 'wz-foot'; document.body.appendChild(foot); }
    foot.innerHTML = '<div class="inner"></div>';
    var body = UI.$('#wzBody', el);
    ({ 1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6, 7: step7 })[s](body, foot.firstChild);
    saveLocal();
  }

  function footer(foot, opts) {
    var back = opts.back === false ? '' : '<button class="btn back" data-act="back">‹ ย้อนกลับ</button>';
    var exit = opts.back === false ? '<button class="btn back" data-act="exit">✕ ออก</button>' : '';
    foot.innerHTML = exit + back + '<button class="btn primary" data-act="next" ' + (opts.disabled ? 'disabled' : '') + '>' + (opts.nextLabel || 'ถัดไป ›') + '</button>';
    foot.onclick = function (e) {
      var b = e.target.closest('button[data-act]');
      if (!b || b.disabled) return;
      if (b.dataset.act === 'back') (opts.onBack || function () { go(W.step === 6 && W.species_mode !== 'new' ? 4 : W.step - 1); })();
      if (b.dataset.act === 'exit') location.hash = W.tree_id ? '#/my' : '#/';
      if (b.dataset.act === 'next') opts.onNext();
    };
  }

  function go(step) { W.step = Math.max(1, Math.min(7, step)); render(); window.scrollTo(0, 0); }

  function save(includeSpecies) {
    var d = { tree: Object.assign({ tree_id: W.tree_id }, W.tree) };
    if (!isTeacher()) delete d.tree.tree_code;
    if (includeSpecies !== false && W.species_mode) {
      d.species_mode = W.species_mode;
      d.species_id = W.species_id;
      d.species = W.species;
    }
    return UI.busy(api('saveDraft', d), 'กำลังบันทึก').then(function (r) {
      dirty = true;
      if (r.queued && !W.offlineNoted) { W.offlineNoted = true; UI.toast('📴 ไม่มีอินเทอร์เน็ต — บันทึกไว้ในเครื่อง จะส่งให้อัตโนมัติเมื่อมีเน็ต', 'warn', 6000); }
      W.tree_id = r.tree.tree_id;
      W.tree_code = r.tree.tree_code;
      W.tree.zone_id = r.tree.zone_id;
      if (r.species && W.species_mode === 'new') W.species.species_id = r.species.species_id;
      saveLocal();
      return r;
    });
  }

  // ---------- ขั้น 1: ปักหมุด ----------
  function step1(body, foot) {
    var t = W.tree;
    body.innerHTML = '<div class="card"><p>🧍 <b>ยืนชิดโคนต้นไม้</b> แล้วกด "จับพิกัด" ระบบจะเก็บสัญญาณ ' + (Number(settings().gps_seconds) || 15) +
      ' วินาทีแล้วหาค่าเฉลี่ยที่แม่นที่สุด</p><div class="gps-panel"><button class="btn primary big" id="gpsBtn">📍 จับพิกัด</button><div id="gpsInfo"></div></div>' +
      '<div class="progress hidden" id="gpsProg" style="margin-top:10px"><div style="width:0"></div></div></div>' +
      '<div class="map-wrap"><div id="wzMap" class="map"></div></div>' +
      '<p class="small muted" style="margin-top:8px">👆 ถ้าหมุดไม่ตรงทรงพุ่มในภาพดาวเทียม <b>ลากหมุด</b>หรือ<b>แตะบนแผนที่</b>เพื่อปรับตำแหน่งได้</p><div id="zoneInfo"></div>';
    map = Maps.create(UI.$('#wzMap', body));
    Maps.addZones(map, { fill: false });
    var others = App.boot.trees.filter(function (x) { return x.tree_id !== W.tree_id && x.lat && x.status !== 'archived'; });
    others.forEach(function (x) {
      L.marker([x.lat, x.lng], { icon: Maps.pinIcon('rgba(255,255,255,.85)', 12), interactive: false }).addTo(map);
    });
    if (t.lat && t.lng) { placeMarker(t.lat, t.lng, t.gps_accuracy_m); map.setView([t.lat, t.lng], 20); }
    showGpsInfo();
    map.on('click', function (e) {
      setPos(e.latlng.lat, e.latlng.lng, W.tree.gps_method && W.tree.gps_method.indexOf('gps') === 0 ? 'gps+adjusted' : 'manual');
    });
    UI.$('#gpsBtn', body).onclick = startGps;
    footer(foot, { back: false, onNext: next1 });
  }

  function placeMarker(lat, lng, acc) {
    if (!map) return;
    if (!marker || !map.hasLayer(marker)) {
      marker = L.marker([lat, lng], { draggable: true, icon: Maps.pinIcon('#e53e3e', 26, '🌳') }).addTo(map);
      marker.on('dragend', function () {
        var p = marker.getLatLng();
        setPos(p.lat, p.lng, W.tree.gps_method && W.tree.gps_method.indexOf('gps') === 0 ? 'gps+adjusted' : 'manual');
      });
    } else marker.setLatLng([lat, lng]);
    if (accCircle) accCircle.remove();
    if (acc) accCircle = L.circle([lat, lng], { radius: acc, color: '#fff', weight: 1, fillOpacity: .15, interactive: false }).addTo(map);
  }

  function setPos(lat, lng, method) {
    W.tree.lat = Math.round(lat * 1e6) / 1e6;
    W.tree.lng = Math.round(lng * 1e6) / 1e6;
    W.tree.gps_method = method;
    if (method === 'manual') W.tree.gps_accuracy_m = '';
    placeMarker(W.tree.lat, W.tree.lng, method === 'manual' ? null : W.tree.gps_accuracy_m);
    showGpsInfo();
    saveLocal();
  }

  function showGpsInfo() {
    var box = UI.$('#gpsInfo', el);
    if (!box) return;
    var t = W.tree;
    if (!t.lat) { box.innerHTML = '<span class="muted">ยังไม่มีพิกัด</span>'; return; }
    var acc = t.gps_accuracy_m;
    var method = { gps: 'GPS', 'gps+adjusted': 'GPS + ปรับหมุด', manual: 'ปักหมุดเอง' }[t.gps_method] || '';
    box.innerHTML = (acc ? '<div class="gps-acc ' + Maps.accClass(acc) + '">±' + UI.fmtNum(acc) + ' ม.</div><div class="small">' + Maps.accText(acc) + '</div>' : '') +
      '<div class="small muted">' + t.lat + ', ' + t.lng + ' · ' + method + '</div>';
    var z = App.zoneName(t.zone_id);
    var zi = UI.$('#zoneInfo', el);
    if (zi) zi.innerHTML = z ? '<div class="small">โซน: <b>' + esc(z) + '</b></div>' : '';
  }

  function startGps() {
    var btn = UI.$('#gpsBtn', el), prog = UI.$('#gpsProg', el);
    stopGps();
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner sm"></span> กำลังจับสัญญาณ…';
    prog.classList.remove('hidden');
    gpsJob = Maps.captureGps({
      seconds: Number(settings().gps_seconds) || 15,
      onUpdate: function (est, samples, ratio) {
        prog.firstChild.style.width = Math.round(ratio * 100) + '%';
        if (!est) return;
        W.tree.gps_accuracy_m = est.accuracy;
        placeMarker(est.lat, est.lng, est.accuracy);
        if (map) map.setView([est.lat, est.lng], Math.max(map.getZoom(), 19));
        var box = UI.$('#gpsInfo', el);
        if (box) box.innerHTML = '<div class="gps-acc ' + Maps.accClass(est.accuracy) + '">±' + UI.fmtNum(est.accuracy) + ' ม.</div><div class="small muted">ได้ ' + samples.length + ' ค่า</div>';
      }
    });
    gpsJob.promise.then(function (est) {
      W.tree.gps_accuracy_m = est.accuracy;
      W.tree.altitude = est.altitude === null ? '' : est.altitude;
      setPos(est.lat, est.lng, 'gps');
      if (map) map.setView([est.lat, est.lng], 20);
      UI.toast('จับพิกัดได้ ±' + UI.fmtNum(est.accuracy) + ' ม. (ใช้ ' + est.used + '/' + est.total + ' ค่า)', Maps.accClass(est.accuracy) === 'bad' ? 'warn' : 'ok');
    }).catch(function (e) { UI.toast(e.message, 'error', 8000); }).then(function () {
      gpsJob = null;
      if (!btn.isConnected) return;
      btn.disabled = false;
      btn.innerHTML = '📍 จับพิกัดใหม่';
      prog.classList.add('hidden');
    });
  }

  function next1() {
    var t = W.tree;
    if (!t.lat || !t.lng) return UI.toast('กด "จับพิกัด" หรือแตะบนแผนที่เพื่อปักหมุดก่อน', 'error');
    if (gpsJob) return UI.toast('รอให้จับพิกัดเสร็จก่อน', 'warn');
    UI.busy(api('checkNearby', { lat: t.lat, lng: t.lng, exclude: W.tree_id }).catch(function (e) {
      if (e.server) throw e;
      UI.toast('📴 ออฟไลน์ — ข้ามการตรวจต้นซ้ำ (ครูจะตรวจอีกครั้ง)', 'warn');
      return { nearby: [], inside_boundary: null };
    }), 'ตรวจต้นซ้ำ').then(function (r) {
      if (r.inside_boundary === false) {
        return UI.confirm('⚠️ พิกัดอยู่นอกขอบเขตโรงเรียน', 'ตรวจสอบว่าหมุดอยู่ถูกที่ หรือ GPS คลาดเคลื่อน ต้องการบันทึกตำแหน่งนี้ต่อไหม?', 'บันทึกต่อ', 'warn')
          .then(function (ok) { if (ok) return checkDup(r); });
      }
      return checkDup(r);
    }).catch(UI.error);
  }

  function checkDup(r) {
    if (!r.nearby.length) return proceed1();
    var radius = settings().duplicate_radius_m || 3;
    return UI.modal({
      title: '🤔 ใช่ต้นนี้หรือเปล่า?',
      body: '<p>พบต้นไม้ที่บันทึกไว้แล้วในรัศมี ' + esc(radius) + ' เมตร — ถ้าเป็นต้นเดียวกัน ให้ช่วยเพิ่มรูป/ข้อมูลให้ต้นเดิมแทน</p>' +
        r.nearby.map(function (n) {
          return '<label class="list-item" style="cursor:pointer"><input type="radio" name="dup" value="' + esc(n.tree_id) + '" style="width:22px;height:22px">' +
            '<div class="thumb">' + (n.cover ? UI.photoImg(n.cover) : '🌳') + '</div><div class="body"><div class="title">' + esc(n.name) + '</div>' +
            '<div class="sub">ห่าง ' + n.distance_m + ' ม. · ' + esc(n.tree_code) + ' · ' + UI.statusPill(n.status) + '</div>' +
            '<div class="sub">บันทึกโดย ' + esc(n.created_by_name) + '</div></div></label>';
        }).join(''),
      buttons: [{ label: 'ไม่ใช่ — เป็นต้นใหม่', value: 'new' }, {
        label: 'ใช่ ต้นที่เลือก', cls: 'primary', onClick: function (m) {
          var v = UI.formValues(m).dup;
          if (!v) { UI.toast('เลือกต้นที่ใช่ก่อน', 'error'); return false; }
          return v;
        }
      }],
      onOpen: UI.hydratePhotos
    }).then(function (v) {
      if (!v) return;
      if (v === 'new') return proceed1();
      if (!W.tree_id) clearLocal();
      UI.toast('ไปที่ต้นเดิม — กด "เพิ่มรูป" เพื่อช่วยเพิ่มข้อมูล', 'ok');
      location.hash = '#/tree/' + v;
    });
  }

  function proceed1() { return save(false).then(function () { go(2); }); }

  // ---------- ขั้น 2: ถ่ายรูป ----------
  function step2(body, foot) {
    var req = requiredParts();
    body.innerHTML = '<div class="alert warn"><span class="ic">⚠️</span><div><b>ห้ามมีใบหน้าคนในรูป</b> และห้ามเด็ด/หักกิ่งต้นไม้หายากเพื่อถ่ายรูป ให้ถ่ายบนต้น</div></div>' +
      '<div class="card" id="photoList">' + Forms.PHOTO_PARTS.map(function (p) {
        return '<div class="photo-row" data-part="' + p.key + '"></div>';
      }).join('') + '</div>' +
      '<input type="file" accept="image/*" capture="environment" id="camInput" class="hidden">' +
      '<input type="file" accept="image/*" multiple id="galInput" class="hidden">';
    Forms.PHOTO_PARTS.forEach(function (p) { renderPhotoRow(p, req.indexOf(p.key) >= 0); });
    var currentPart = null;
    body.onclick = function (e) {
      var b = e.target.closest('[data-shoot],[data-gallery],[data-del],[data-retry],[data-view]');
      if (!b) return;
      if (b.dataset.shoot) { currentPart = b.dataset.shoot; UI.$('#camInput', body).click(); }
      if (b.dataset.gallery) { currentPart = b.dataset.gallery; UI.$('#galInput', body).click(); }
      if (b.dataset.del) deletePhoto(b.dataset.del);
      if (b.dataset.retry) retryUpload(uploads.filter(function (u) { return u.id === b.dataset.retry; })[0]);
      if (b.dataset.view) UI.lightbox(b.dataset.view);
    };
    ['camInput', 'galInput'].forEach(function (id) {
      var inp = UI.$('#' + id, body);
      inp.onchange = function () {
        var files = Array.prototype.slice.call(inp.files || []);
        inp.value = '';
        var scaleBox = UI.$('.photo-row[data-part="' + currentPart + '"] input[name=scale]', body);
        files.forEach(function (f) { queueUpload(currentPart, f, scaleBox && scaleBox.checked); });
      };
    });
    footer(foot, { onNext: next2 });
  }

  function renderPhotoRow(p, required) {
    var row = UI.$('.photo-row[data-part="' + p.key + '"]', el);
    if (!row) return;
    var have = photosOf(p.key);
    var pend = uploads.filter(function (u) { return u.part === p.key; });
    var ok = have.length > 0;
    row.innerHTML = '<div class="st">' + (ok ? '✅' : pend.length ? '⏳' : required ? '⬜' : '▫️') + '</div>' +
      '<div class="info"><b>' + p.icon + ' ' + esc(p.label) + ' ' + (required ? '<span class="req">* บังคับ</span>' : '') + '</b>' +
      '<div class="tip">' + esc(p.tip) + '</div>' +
      (p.scale ? '<label class="check small" style="margin-top:4px"><input type="checkbox" name="scale"> มีไม้บรรทัด/วัตถุเทียบขนาด</label>' : '') +
      '<div class="thumbs">' + have.map(function (ph) {
        return '<div class="ph"><span data-view="' + esc(ph.full || ph.thumb) + '">' + UI.photoImg(ph) + '</span>' +
          (editable() || isTeacher() ? '<button class="x" data-del="' + esc(ph.photo_id) + '" title="ลบรูป">✕</button>' : '') + '</div>';
      }).join('') + pend.map(function (u) {
        return '<div class="ph up ' + (u.error ? 'err' : '') + '"><img src="' + u.preview + '" alt="">' +
          (u.error ? '<button class="x" data-retry="' + u.id + '" title="ส่งใหม่">↻</button>' : '<div class="bar"><i style="width:' + u.progress + '%"></i></div>') + '</div>';
      }).join('') + '</div></div>' +
      '<div class="acts"><button class="btn sm primary" data-shoot="' + p.key + '">📷 ถ่าย</button><button class="btn sm" data-gallery="' + p.key + '">🖼️ คลัง</button></div>';
    UI.hydratePhotos(row);
  }

  function refreshPhotoRow(part) {
    var p = Forms.PHOTO_PARTS.filter(function (x) { return x.key === part; })[0];
    if (p && W.step === 2) renderPhotoRow(p, requiredParts().indexOf(part) >= 0);
    updateNext2();
  }

  function updateNext2() {
    var btn = document.querySelector('.wz-foot [data-act=next]');
    if (!btn || W.step !== 2) return;
    var busy = uploads.filter(function (u) { return !u.error; }).length;
    btn.disabled = busy > 0;
    btn.textContent = busy ? 'กำลังอัปโหลด ' + busy + ' รูป…' : 'ถัดไป ›';
  }

  function queueUpload(part, file, hasScale) {
    var s = settings();
    var u = { id: 'u' + Date.now() + Math.random().toString(16).slice(2, 6), part: part, preview: '', progress: 10, error: null, tries: 0, hasScale: hasScale };
    uploads.push(u);
    refreshPhotoRow(part);
    UI.resizeImage(file, Number(s.photo_max_px) || 1600, Number(s.photo_quality) || 0.8).then(function (img) {
      u.preview = img.dataUrl;
      u.data = img.base64;
      u.mime = img.mime;
      u.taken_at = file.lastModified ? new Date(file.lastModified).toISOString() : '';
      u.progress = 40;
      refreshPhotoRow(part);
      sendUpload(u);
    }).catch(function (e) {
      uploads = uploads.filter(function (x) { return x !== u; });
      refreshPhotoRow(part);
      UI.error(e);
    });
  }

  function sendUpload(u) {
    u.error = null;
    u.tries++;
    u.progress = 60;
    refreshPhotoRow(u.part);
    api('uploadPhoto', {
      tree_id: W.tree_id, part: u.part, data: u.data, mime: u.mime, taken_at: u.taken_at,
      lat: W.tree.lat, lng: W.tree.lng, has_scale: !!u.hasScale
    }).then(function (photo) {
      dirty = true;
      uploads = uploads.filter(function (x) { return x !== u; });
      W.photos.push(photo);
      refreshPhotoRow(u.part);
    }).catch(function (e) {
      u.error = e.message;
      if (!e.server && u.tries < 3) {
        setTimeout(function () { if (uploads.indexOf(u) >= 0) sendUpload(u); }, 2000 * u.tries);
      } else {
        UI.toast('อัปโหลดรูป' + Forms.partLabel(u.part) + 'ไม่สำเร็จ: ' + e.message + ' — กด ↻ เพื่อส่งใหม่', 'error');
      }
      refreshPhotoRow(u.part);
    });
  }

  function retryUpload(u) { if (u) sendUpload(u); }

  function deletePhoto(id) {
    UI.confirm('ลบรูปนี้?', 'รูปจะถูกย้ายไปถังขยะของ Google Drive', 'ลบรูป', 'danger solid').then(function (ok) {
      if (!ok) return;
      var p = W.photos.filter(function (x) { return x.photo_id === id; })[0];
      UI.busy(api('deletePhoto', { photo_id: id })).then(function () {
        dirty = true;
        W.photos = W.photos.filter(function (x) { return x.photo_id !== id; });
        if (p) refreshPhotoRow(p.part);
      }).catch(UI.error);
    });
  }

  function next2() {
    var miss = missingParts();
    if (!miss.length) return go(3);
    UI.confirm('ยังขาดรูปที่บังคับ', 'ยังไม่มีรูป: <b>' + miss.map(Forms.partLabel).join(', ') + '</b><br>ไปขั้นต่อไปก่อนได้ แต่ต้องถ่ายให้ครบก่อนส่งให้ครูตรวจ', 'ไปต่อก่อน')
      .then(function (ok) { if (ok) go(3); });
  }

  // ---------- ขั้น 3: AI ----------
  function step3(body, foot) {
    if (!aiOn()) {
      body.innerHTML = '<div class="card empty"><span class="ic">🤖</span>ระบบ AI ปิดอยู่ในขณะนี้<br>กด "ถัดไป" เพื่อเลือกชนิดพรรณไม้เอง</div>';
      return footer(foot, { onNext: function () { go(4); } });
    }
    var ai = W.ai;
    var html = '<div class="card"><p>🤖 AI จะดูรูปที่ถ่ายไว้แล้ว<b>เสนอชื่อ 3 อันดับ</b> — AI เป็นแค่ผู้ช่วย อาจผิดได้ ให้ตรวจกับต้นจริงทุกครั้ง</p>' +
      '<button class="btn primary big block" id="aiBtn" ' + (W.photos.length ? '' : 'disabled') + '>' + (ai ? '🔄 ให้ AI ดูใหม่' : '🤖 ให้ AI ช่วยดู') + '</button>' +
      (W.photos.length ? '' : '<p class="small muted center" style="margin-top:8px">ถ่ายรูปอย่างน้อย 1 รูปก่อน</p>') + '</div>';
    if (ai) html += aiResultHtml(ai);
    html += '<div class="btn-row"><button class="btn grow" id="noneBtn">🔎 ไม่ใช่ทั้งหมด / เลือกเอง</button><button class="btn grow" id="unsureBtn">❓ ไม่แน่ใจ</button></div>';
    body.innerHTML = html;
    UI.$('#aiBtn', body).onclick = runAi;
    UI.$('#noneBtn', body).onclick = function () { go(4); };
    UI.$('#unsureBtn', body).onclick = function () { chooseUnknown(); };
    body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pick]');
      if (b) pickCandidate(W.ai.candidates[+b.dataset.pick]);
    });
    footer(foot, { onNext: function () { go(4); } });
  }

  function aiResultHtml(ai) {
    var h = '';
    if (ai.has_human_face) h += '<div class="alert error"><span class="ic">🙈</span><div><b>พบใบหน้าคนในรูป</b> — กรุณาลบรูปนั้นแล้วถ่ายใหม่ (ย้อนกลับไปขั้น 2)</div></div>';
    if (ai.photo_issues && ai.photo_issues.length) h += '<div class="alert warn"><span class="ic">📷</span><div>' + ai.photo_issues.map(esc).join('<br>') + '</div></div>';
    if (ai.needs_more_photos && ai.needs_more_photos.length) h += '<div class="alert info"><span class="ic">💡</span><div>ถ้าถ่ายรูป <b>' + ai.needs_more_photos.map(esc).join(', ') + '</b> เพิ่ม AI จะจำแนกได้แม่นขึ้น</div></div>';
    var cands = ai.candidates || [];
    if (!cands.length) return h + '<div class="card empty">AI ยังจำแนกไม่ได้ ลองถ่ายรูปใบและดอกให้ชัดขึ้น หรือเลือกเอง</div>';
    if (cands[0].confidence < 0.5) h += '<div class="alert warn"><span class="ic">🤔</span><div><b>AI ไม่แน่ใจ</b> ควรให้ครูช่วยดู หรือเลือก "ไม่แน่ใจ"</div></div>';
    h += cands.map(function (c, i) {
      var pct = Math.round((c.confidence || 0) * 100);
      var sp = c.existing_species_id ? App.speciesById[c.existing_species_id] : null;
      var cover = sp ? App.boot.trees.filter(function (t) { return t.species_id === sp.species_id && t.cover; })[0] : null;
      return '<div class="cand ' + (i === 0 ? 'top' : '') + '"><div style="display:flex;gap:12px">' +
        (cover ? '<div class="thumb" style="width:72px;height:72px;border-radius:10px;overflow:hidden;flex:none">' + UI.photoImg(cover.cover) + '</div>' : '') +
        '<div style="flex:1;min-width:0"><div class="small muted">อันดับ ' + (i + 1) + '</div><div class="name">' + esc(c.thai_name || c.common_name) + '</div>' +
        '<div class="sci">' + esc(c.scientific_name) + '</div><div class="small muted">วงศ์ ' + esc(c.family) + '</div></div></div>' +
        '<div class="conf ' + (pct < 50 ? 'low' : '') + '"><span>ความมั่นใจ</span><div class="progress"><div style="width:' + pct + '%"></div></div><b>' + pct + '%</b></div>' +
        (c.reason ? '<div class="small">💬 ' + esc(c.reason) + '</div>' : '') +
        '<div class="chips" style="margin:8px 0">' +
        (!c.existing_species_id ? '<span class="pill">🆕 ยังไม่มีในทะเบียนโรงเรียน</span>'
          : c.existing_status === 'verified' ? '<span class="pill verified">🏫 มีในโรงเรียนแล้ว ' + (c.tree_count || 0) + ' ต้น</span>'
            : '<span class="pill pending_teacher">🕒 มีเพื่อนเสนอชนิดนี้แล้ว (รอครูตรวจ)</span>') +
        (c.plantnet_agree ? '<span class="pill verified">🟢 AI 2 ระบบเห็นตรงกัน</span>' : '') + '</div>' +
        '<button class="btn primary block" data-pick="' + i + '">✅ ใช่ ชนิดนี้</button></div>';
    }).join('');
    if (ai.plantnet && ai.plantnet.length) {
      h += '<div class="card flat small"><b>ความเห็นที่ 2 (Pl@ntNet):</b> ' + ai.plantnet.map(function (p) {
        return '<span class="sci">' + esc(p.scientific_name) + '</span> (' + Math.round(p.score * 100) + '%)';
      }).join(', ') + '</div>';
    }
    return h;
  }

  function runAi() {
    if (uploads.length) return UI.toast('รอให้อัปโหลดรูปเสร็จก่อน', 'warn');
    UI.busy(api('aiIdentify', { tree_id: W.tree_id }), 'AI กำลังดูรูป… (ประมาณ 10–20 วินาที)').then(function (r) {
      W.ai = r;
      W.aiPrefilled = false;
      saveLocal();
      render();
    }).catch(UI.error);
  }

  function pickCandidate(c) {
    if (c.existing_species_id && App.speciesById[c.existing_species_id]) {
      W.species_mode = 'existing';
      W.species_id = c.existing_species_id;
      save().then(function () { UI.toast('เลือก ' + (c.thai_name || '') + ' แล้ว', 'ok'); go(6); }).catch(UI.error);
      return;
    }
    W.species_mode = 'new';
    W.species_id = null;
    W.species = Object.assign({ species_id: W.species.species_id }, W.species, {
      thai_name: c.thai_name || '', local_name: c.local_name || '', common_name: c.common_name || '',
      scientific_name: c.scientific_name || '', family: c.family || '', ai_suggested: true, ai_confidence: c.confidence
    });
    W.q = 0;
    go(5);
  }

  function chooseUnknown() {
    W.species_mode = 'unknown';
    W.species_id = null;
    save().then(function () { UI.toast('บันทึกเป็น "ยังไม่ทราบชนิด" — ครูหรือหัวหน้ากลุ่มจะช่วยระบุภายหลัง'); go(6); }).catch(UI.error);
  }

  // ---------- ขั้น 4: เลือกชนิด ----------
  function step4(body, foot) {
    var cur = '';
    if (W.species_mode === 'existing' && App.speciesById[W.species_id]) {
      var s = App.speciesById[W.species_id];
      cur = '<div class="alert ok"><span class="ic">✅</span><div>เลือกแล้ว: <b>' + esc(s.thai_name) + '</b> <span class="sci">' + esc(s.scientific_name) + '</span></div></div>';
    } else if (W.species_mode === 'new') {
      cur = '<div class="alert ok"><span class="ic">🆕</span><div>ชนิดใหม่: <b>' + esc(W.species.thai_name || W.species.scientific_name || '(ยังไม่ตั้งชื่อ)') + '</b></div></div>';
    } else if (W.species_mode === 'unknown') {
      cur = '<div class="alert info"><span class="ic">❓</span><div>ตอนนี้บันทึกเป็น "ยังไม่ทราบชนิด"</div></div>';
    }
    body.innerHTML = cur + '<div class="card"><h3>ค้นหาชนิดที่มีในระบบแล้ว</h3><div class="search-box"><span class="ic">🔍</span>' +
      '<input type="search" id="spSearch" placeholder="พิมพ์ชื่อไทย ชื่อพื้นเมือง หรือชื่อวิทยาศาสตร์" autocomplete="off"></div>' +
      '<div id="spResults" style="margin-top:8px"></div></div>' +
      '<div class="tiles"><button class="tile" id="newSp"><span class="ic">🆕</span>เป็นชนิดใหม่<br><span class="small muted">ยังไม่มีในระบบ</span></button>' +
      '<button class="tile" id="unkSp"><span class="ic">❓</span>ยังไม่ทราบชนิด<br><span class="small muted">ให้ครูช่วยระบุ</span></button></div>';
    var list = App.boot.species.filter(function (s) { return s.status !== 'archived'; });
    var fuse = window.Fuse ? new Fuse(list, { keys: ['thai_name', 'local_name', 'common_name', 'scientific_name', 'family'], threshold: .4, ignoreLocation: true }) : null;
    var input = UI.$('#spSearch', body), out = UI.$('#spResults', body);
    function show() {
      var q = input.value.trim();
      var res = q ? (fuse ? fuse.search(q).map(function (r) { return r.item; }) : list.filter(function (s) { return JSON.stringify(s).indexOf(q) >= 0; })) : list;
      out.innerHTML = res.slice(0, 30).map(function (s) {
        var n = App.boot.trees.filter(function (t) { return t.species_id === s.species_id && t.status === 'verified'; }).length;
        var cover = App.boot.trees.filter(function (t) { return t.species_id === s.species_id && t.cover; })[0];
        return '<button class="list-item" data-sp="' + esc(s.species_id) + '" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);font:inherit;text-align:left;cursor:pointer">' +
          '<div class="thumb">' + (cover ? UI.photoImg(cover.cover) : Icons.habitEmoji(s.habit)) + '</div><div class="body"><div class="title">' + esc(s.thai_name) +
          (s.status !== 'verified' ? ' <span class="pill">รอตรวจ</span>' : '') + '</div><div class="sub"><span class="sci">' + esc(s.scientific_name) + '</span> · ' + esc(s.family) + '</div>' +
          '<div class="sub">' + (n ? 'มีในโรงเรียน ' + n + ' ต้น' : '') + (s.local_name ? ' · ' + esc(s.local_name) : '') + '</div></div>' +
          (W.species_id === s.species_id ? '<span class="pill verified">✓ เลือกอยู่</span>' : '<span class="chev">เลือก ›</span>') + '</button>';
      }).join('') || '<div class="muted small">ไม่พบ — ถ้ามั่นใจว่าเป็นชนิดใหม่ กด "เป็นชนิดใหม่"</div>';
      UI.hydratePhotos(out);
    }
    input.oninput = show;
    show();
    out.onclick = function (e) {
      var b = e.target.closest('[data-sp]');
      if (!b) return;
      W.species_mode = 'existing';
      W.species_id = b.dataset.sp;
      save().then(function () { go(6); }).catch(UI.error);
    };
    UI.$('#newSp', body).onclick = function () {
      if (W.species_mode !== 'new') { W.species = W.species && W.species.species_id ? W.species : {}; }
      W.species_mode = 'new'; W.species_id = null; W.q = 0; go(5);
    };
    UI.$('#unkSp', body).onclick = chooseUnknown;
    footer(foot, {
      onNext: function () {
        if (!W.species_mode) return UI.toast('เลือกชนิด หรือกด "ยังไม่ทราบชนิด"', 'error');
        if (W.species_mode === 'new') return go(5);
        save().then(function () { go(6); }).catch(UI.error);
      }
    });
  }

  // ---------- ขั้น 5: ลักษณะพฤกษศาสตร์ ----------
  function prefillFromAi() {
    if (W.aiPrefilled || !W.ai || !W.ai.morphology) return;
    Object.keys(W.ai.morphology).forEach(function (k) {
      if (!W.species[k]) W.species[k] = W.ai.morphology[k];
    });
    W.species.ai_suggested = true;
    W.aiPrefilled = true;
  }

  function step5(body, foot) {
    prefillFromAi();
    var Q = Forms.QUESTIONS;
    W.q = Math.max(0, Math.min(Q.length - 1, W.q || 0));
    var q = Q[W.q];
    var aiVal = W.ai && W.ai.morphology && q.key ? W.ai.morphology[q.key] : '';
    var html = '<div class="card"><span class="q-section">' + esc(q.section) + '</span> <span class="q-progress">คำถาม ' + (W.q + 1) + '/' + Q.length + '</span>' +
      '<div class="question">' + esc(q.q) + '</div>' + (q.hint ? '<div class="small muted">' + esc(q.hint) + '</div>' : '') +
      (q.note ? '<div class="small muted">' + esc(q.note) + '</div>' : '') +
      (aiVal ? '<div class="small" style="margin-top:4px;color:#5a3eb0">🤖 AI แนะนำ: <b>' + esc(aiVal) + '</b> (ตรวจกับต้นจริงก่อน)</div>' : '') +
      (q.key ? Forms.fieldComments(W.reviews, q.key) : (q.fields || []).map(function (f) { return Forms.fieldComments(W.reviews, f.key); }).join('')) +
      '<div style="margin-top:12px" id="qBody"></div></div>';
    html += '<div class="btn-row">' + (q.type === 'choice' || q.type === 'multi' ? '<button class="btn grow" id="unsureQ">🤷 ไม่แน่ใจ ข้ามไปก่อน</button>' : '') +
      (q.skip ? '<button class="btn grow" id="skipSec">⏭️ ' + esc(q.skip) + '</button>' : '') + '</div>' +
      '<p class="small muted center" style="margin-top:10px">' + photoHelper(q.section) + '</p>';
    body.innerHTML = html;
    var qb = UI.$('#qBody', body);

    if (q.type === 'choice' || q.type === 'multi') {
      var opts = App.listOpts(q.list);
      var cur = String(W.species[q.key] || '').split(',').map(function (x) { return x.trim(); }).filter(String);
      qb.innerHTML = '<div class="opt-grid">' + opts.map(function (o) {
        var ic = Icons.render(o.icon);
        return '<button class="opt ' + (cur.indexOf(o.value) >= 0 ? 'on ' : '') + (aiVal === o.value ? 'ai-pick ' : '') + (ic ? '' : 'text-only') + '" data-v="' + esc(o.value) + '" title="' + esc(o.hint || '') + '">' +
          (aiVal === o.value ? '<span class="ai-tag">🤖</span>' : '') + ic + '<span class="th">' + esc(o.value) + '</span>' + (o.label_en ? '<span class="en">' + esc(o.label_en) + '</span>' : '') + '</button>';
      }).join('') + '</div>';
      var pressTimer;
      qb.onclick = function (e) {
        var b = e.target.closest('.opt');
        if (!b) return;
        var v = b.dataset.v;
        if (q.type === 'multi') {
          var i = cur.indexOf(v);
          if (i >= 0) cur.splice(i, 1); else cur.push(v);
          W.species[q.key] = cur.join(', ');
          b.classList.toggle('on');
          saveLocal();
        } else {
          var same = W.species[q.key] === v;
          W.species[q.key] = same ? '' : v;
          UI.$$('.opt', qb).forEach(function (x) { x.classList.toggle('on', x.dataset.v === W.species[q.key]); });
          saveLocal();
          if (!same) setTimeout(function () { if (W.step === 5) nextQ(); }, 350);
        }
      };
      // กดค้างเพื่อดูคำอธิบาย
      qb.addEventListener('pointerdown', function (e) {
        var b = e.target.closest('.opt');
        if (!b || !b.title) return;
        pressTimer = setTimeout(function () { UI.toast(b.dataset.v + ': ' + b.title); }, 550);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { qb.addEventListener(ev, function () { clearTimeout(pressTimer); }); });
    } else if (q.type === 'group') {
      qb.innerHTML = q.fields.map(function (f) {
        var v = W.species[f.key] === undefined || W.species[f.key] === null ? '' : W.species[f.key];
        var input;
        if (f.list) {
          input = '<select name="' + f.key + '"><option value="">— เลือก —</option>' + App.listOpts(f.list).map(function (o) {
            return '<option ' + (o.value === v ? 'selected' : '') + '>' + esc(o.value) + '</option>';
          }).join('') + '</select>';
        } else if (f.type === 'textarea') {
          input = '<textarea name="' + f.key + '" placeholder="' + esc(f.ph || '') + '">' + esc(v) + '</textarea>';
        } else {
          input = '<input type="' + (f.type === 'number' ? 'number' : 'text') + '" ' + (f.type === 'number' ? 'inputmode="decimal" step="any" min="0"' : '') +
            ' name="' + f.key + '" class="' + (f.cls || '') + '" value="' + esc(v) + '" placeholder="' + esc(f.ph || '') + '">';
        }
        return '<label class="field"><span>' + esc(Forms.label(f.key)) + '</span>' + input + Forms.fieldComments(W.reviews, f.key) + '</label>';
      }).join('');
      qb.oninput = qb.onchange = function (e) { if (e.target.name) { W.species[e.target.name] = e.target.value; saveLocal(); } };
    } else if (q.type === 'describe') {
      qb.innerHTML = '<textarea name="description" style="min-height:160px" placeholder="บรรยายลักษณะ ลำต้น ใบ ดอก ผล เมล็ด">' + esc(W.species.description || '') + '</textarea>' +
        (aiOn() ? '<button class="btn" id="aiDesc" style="margin-top:8px">🤖 ให้ AI ช่วยร่างจากข้อมูลที่เลือกไว้</button><div class="small muted">AI ร่างให้ — นักเรียนต้องอ่านตรวจและแก้ให้ตรงกับต้นจริง</div>' : '');
      var ta = UI.$('textarea', qb);
      ta.oninput = function () { W.species.description = ta.value; saveLocal(); };
      var ad = UI.$('#aiDesc', qb);
      if (ad) ad.onclick = function () {
        UI.busy(api('aiDescribe', { species: W.species }), 'AI กำลังร่างคำบรรยาย').then(function (r) {
          ta.value = r.description; W.species.description = r.description; W.species.ai_suggested = true; saveLocal();
        }).catch(UI.error);
      };
    }

    var uq = UI.$('#unsureQ', body);
    if (uq) uq.onclick = function () { W.species[q.key] = ''; nextQ(); };
    var sk = UI.$('#skipSec', body);
    if (sk) sk.onclick = function () {
      var i = W.q;
      while (i < Q.length && Q[i].section === q.section) i++;
      if (i >= Q.length) return finish5();
      W.q = i; render();
    };
    footer(foot, {
      nextLabel: W.q === Q.length - 1 ? 'บันทึก ›' : 'ถัดไป ›',
      onNext: nextQ,
      onBack: function () { if (W.q > 0) { W.q--; render(); } else go(4); }
    });
  }

  function photoHelper(section) {
    var map = { 'ลำต้น': 'bark', 'ใบ': 'leaf_top', 'ดอก': 'flower', 'ผล': 'fruit', 'เมล็ด': 'seed', 'ลักษณะวิสัย': 'whole' };
    var p = map[section] && photosOf(map[section])[0];
    return p ? '<span style="display:inline-block;width:120px;height:90px;border-radius:10px;overflow:hidden;cursor:zoom-in" data-zoom="' + esc(p.full || p.thumb) + '">' + UI.photoImg(p) + '</span><br>รูปที่ถ่ายไว้ (แตะเพื่อขยาย)' : '';
  }

  function nextQ() {
    if (W.q < Forms.QUESTIONS.length - 1) { W.q++; render(); window.scrollTo(0, 0); } else finish5();
  }

  function finish5() {
    var s = W.species;
    if (!String(s.thai_name || '').trim() && !String(s.scientific_name || '').trim() && !String(s.local_name || '').trim()) {
      W.q = 0;
      render();
      return UI.toast('กรอกชื่อพรรณไม้อย่างน้อย 1 ชื่อ (ถ้าไม่รู้ชื่อ ย้อนไปเลือก "ยังไม่ทราบชนิด")', 'error');
    }
    save().then(function () { go(6); }).catch(UI.error);
  }

  // ---------- ขั้น 6: วัดขนาด ----------
  function step6(body, foot) {
    var t = W.tree;
    function chips(name, list) {
      return '<div class="chips" data-chips="' + name + '">' + App.listOpts(list).map(function (o) {
        return '<button type="button" class="chip ' + (t[name] === o.value ? 'on' : '') + '" data-v="' + esc(o.value) + '">' + esc(o.value) + '</button>';
      }).join('') + '</div>';
    }
    body.innerHTML = '<div class="card"><div class="row2 stack-sm">' +
      '<label class="field"><span>📏 ความสูงโดยประมาณ (เมตร)</span><input type="number" inputmode="decimal" step="any" min="0" name="height_m" value="' + esc(t.height_m || '') + '">' +
      '<div class="field-hint">เทียบกับความสูงอาคาร (ชั้นละประมาณ 3–3.5 ม.)</div></label>' +
      '<label class="field"><span>⭕ เส้นรอบวงที่ระดับอก (ซม.)</span><input type="number" inputmode="decimal" step="any" min="0" name="gbh_cm" value="' + esc(t.gbh_cm || '') + '">' +
      '<div class="field-hint">ใช้สายวัดพันรอบลำต้นที่ความสูง 130 ซม. จากพื้น (ไม้พุ่ม/ไม้เลื้อย เว้นว่างได้)</div><div class="small" id="dbh"></div></label></div>' +
      '<div class="row2 stack-sm"><label class="field"><span>🌳 ความกว้างทรงพุ่ม (เมตร)</span><input type="number" inputmode="decimal" step="any" min="0" name="canopy_m" value="' + esc(t.canopy_m || '') + '">' +
      '<div class="field-hint">เดินนับก้าวจากขอบพุ่มด้านหนึ่งไปอีกด้าน</div></label>' +
      '<label class="field"><span>🕰️ อายุโดยประมาณ (ถ้าทราบ)</span><input type="text" name="age_est" value="' + esc(t.age_est || '') + '" placeholder="เช่น ประมาณ 20 ปี"></label></div>' +
      '<div class="field"><span class="field-label">❤️ สุขภาพของต้น</span>' + chips('health', 'health') + Forms.fieldComments(W.reviews, 'health') + '</div>' +
      '<div class="field"><span class="field-label">🌱 ที่มาของต้น</span>' + chips('planting_source', 'planting_source') + '</div>' +
      '<div class="field"><span class="field-label">🏷️ ป้ายชื่อ</span>' + chips('label_status', 'label_status') + '</div>' +
      '<label class="field"><span>📝 หมายเหตุ</span><textarea name="notes" placeholder="เช่น มีรังนก ต้นเอียง มีกิ่งหัก">' + esc(t.notes || '') + '</textarea></label>' +
      (isTeacher() ? '<label class="field"><span>🔢 รหัสประจำต้น (ครูแก้ได้ — ใช้เมื่อนำเข้ารหัสเดิม)</span><input type="text" name="tree_code" value="' + esc(W.tree_code || '') + '"></label>' : '') +
      '</div>';
    function dbh() {
      var g = Number(t.gbh_cm);
      UI.$('#dbh', body).innerHTML = g ? 'เส้นผ่านศูนย์กลาง ≈ <b>' + (Math.round(g / Math.PI * 10) / 10) + ' ซม.</b> (คำนวณอัตโนมัติ = เส้นรอบวง ÷ π)' : '';
    }
    dbh();
    body.oninput = function (e) {
      if (!e.target.name) return;
      if (e.target.name === 'tree_code') W.tree.tree_code = e.target.value.trim();
      else t[e.target.name] = e.target.value;
      if (e.target.name === 'gbh_cm') dbh();
      saveLocal();
    };
    body.onclick = function (e) {
      var c = e.target.closest('.chip[data-v]');
      if (!c) return;
      var name = c.parentNode.dataset.chips;
      t[name] = t[name] === c.dataset.v ? '' : c.dataset.v;
      UI.$$('.chip', c.parentNode).forEach(function (x) { x.classList.toggle('on', x.dataset.v === t[name]); });
      saveLocal();
    };
    footer(foot, {
      onNext: function () {
        if (Number(t.height_m) > 80) return UI.toast('ความสูงเกิน 80 ม. ตรวจสอบตัวเลขอีกครั้ง', 'error');
        if (Number(t.gbh_cm) > 2000) return UI.toast('เส้นรอบวงมากผิดปกติ ตรวจสอบหน่วย (ซม.)', 'error');
        save().then(function () { go(7); }).catch(UI.error);
      }
    });
  }

  // ---------- ขั้น 7: ตรวจทานและส่ง ----------
  function step7(body, foot) {
    var t = W.tree;
    var miss = missingParts();
    var sp = W.species_mode === 'existing' ? App.speciesById[W.species_id] : W.species_mode === 'new' ? W.species : null;
    var checks = [
      [!!(t.lat && t.lng), 'พิกัด', t.lat ? (t.gps_accuracy_m ? '±' + UI.fmtNum(t.gps_accuracy_m) + ' ม.' : 'ปักหมุดเอง') + (App.zoneName(t.zone_id) ? ' · ' + App.zoneName(t.zone_id) : '') : 'ยังไม่มี', 1],
      [!miss.length, 'รูปถ่าย', W.photos.length + ' รูป' + (miss.length ? ' — ขาด: ' + miss.map(Forms.partLabel).join(', ') : ' ครบรูปบังคับ'), 2],
      [!!W.species_mode, 'ชนิด', W.species_mode === 'unknown' ? 'ยังไม่ทราบชนิด (ครูช่วยระบุ)' : sp ? (sp.thai_name || sp.scientific_name) + (W.species_mode === 'new' ? ' (ชนิดใหม่)' : '') : 'ยังไม่ได้เลือก', 4],
      [true, 'ขนาด', [t.height_m ? 'สูง ' + t.height_m + ' ม.' : '', t.gbh_cm ? 'รอบวง ' + t.gbh_cm + ' ซม.' : '', t.health ? 'สุขภาพ' + t.health : ''].filter(String).join(' · ') || 'ยังไม่กรอก (ไม่บังคับ)', 6]
    ];
    var comments = W.reviews.filter(function (r) { return r.decision === 'comment' && r.comment; });
    var html = '';
    if (comments.length) {
      html += '<div class="card"><h3>💬 ความเห็นจากผู้ตรวจ</h3>' + comments.map(function (c) {
        return '<div class="comment">' + (c.field ? '<b>' + esc(Forms.label(c.field)) + ':</b> ' : '') + esc(c.comment) +
          '<div class="who">' + esc(c.reviewer_name) + ' · ' + UI.thDate(c.created_at, true) + '</div></div>';
      }).join('') + '</div>';
    }
    html += '<div class="card"><h3>สรุปข้อมูล</h3>' + checks.map(function (c) {
      return '<div class="list-item"><div class="st" style="font-size:1.3rem">' + (c[0] ? '✅' : '⚠️') + '</div><div class="body"><div class="title">' + c[1] + '</div><div class="sub" style="white-space:normal">' + esc(c[2]) + '</div></div>' +
        '<button class="btn sm" data-goto="' + c[3] + '">แก้ไข</button></div>';
    }).join('') + (W.species_mode === 'new' ? '<div class="list-item"><div class="st" style="font-size:1.3rem">🌿</div><div class="body"><div class="title">ลักษณะพฤกษศาสตร์</div><div class="sub">' +
      Forms.QUESTIONS.filter(function (q) { return q.key && W.species[q.key]; }).length + ' ข้อที่ตอบแล้ว</div></div><button class="btn sm" data-goto="5">แก้ไข</button></div>' : '') + '</div>';
    if (W.photos.length) html += '<div class="card"><div class="thumbs" style="display:flex;gap:6px;flex-wrap:wrap">' + W.photos.map(function (p) {
      return '<div style="width:70px;height:70px;border-radius:8px;overflow:hidden" title="' + esc(Forms.partLabel(p.part)) + '">' + UI.photoImg(p) + '</div>';
    }).join('') + '</div></div>';

    var canSubmit = editable();
    if (canSubmit) {
      html += '<div class="btn-row"><button class="btn grow" id="saveDraftBtn">💾 บันทึกร่างไว้ก่อน</button>' +
        (W.status === 'draft' && W.tree_id ? '<button class="btn danger" id="delDraft">🗑️ ลบร่าง</button>' : '') + '</div>';
    } else {
      html += '<div class="alert info"><span class="ic">ℹ️</span><div>สถานะปัจจุบัน: ' + UI.statusPill(W.status) + ' — ครูแก้ไขข้อมูลได้โดยไม่ต้องส่งตรวจใหม่</div></div>';
    }
    body.innerHTML = html;
    UI.hydratePhotos(body);
    body.onclick = function (e) {
      var b = e.target.closest('[data-goto]');
      if (b) { W.q = 0; go(+b.dataset.goto); }
    };
    var sd = UI.$('#saveDraftBtn', body);
    if (sd) sd.onclick = function () {
      save().then(function () { UI.toast('บันทึกร่างแล้ว ทำต่อได้ภายหลังที่ "ผลงานของฉัน"', 'ok'); clearLocal(); location.hash = '#/my'; }).catch(UI.error);
    };
    var dd = UI.$('#delDraft', body);
    if (dd) dd.onclick = function () {
      UI.confirm('ลบร่างนี้?', 'ข้อมูลร่างจะถูกลบออกจากรายการของคุณ', 'ลบร่าง', 'danger solid').then(function (ok) {
        if (!ok) return;
        UI.busy(api('deleteDraft', { tree_id: W.tree_id })).then(function () { dirty = true; clearLocal(); UI.toast('ลบร่างแล้ว'); location.hash = '#/my'; }).catch(UI.error);
      });
    };
    footer(foot, {
      nextLabel: canSubmit ? '📤 ส่งให้ครูตรวจ' : '💾 บันทึก',
      onBack: function () { go(6); },
      onNext: function () {
        if (!canSubmit) {
          return save().then(function () { UI.toast('บันทึกแล้ว', 'ok'); clearLocal(); location.hash = '#/tree/' + W.tree_id; }).catch(UI.error);
        }
        if (uploads.length) return UI.toast('รอให้อัปโหลดรูปเสร็จก่อน', 'warn');
        if (miss.length) return UI.toast('ยังขาดรูป: ' + miss.map(Forms.partLabel).join(', '), 'error');
        if (!W.species_mode) return UI.toast('ยังไม่ได้ระบุชนิด (เลือก "ยังไม่ทราบชนิด" ได้)', 'error');
        save().then(function () {
          return UI.busy(api('submit', { tree_id: W.tree_id }), 'กำลังส่ง');
        }).then(function (r) {
          dirty = true;
          clearLocal();
          UI.toast(r.queued ? '📴 เก็บไว้ในเครื่องแล้ว จะส่งให้ครูอัตโนมัติเมื่อมีอินเทอร์เน็ต' : r.status === 'submitted' ? 'ส่งแล้ว! รอหัวหน้ากลุ่มตรวจขั้นต้น 👍' : 'ส่งให้ครูตรวจแล้ว! 👍', r.queued ? 'warn' : 'ok', 6000);
          location.hash = '#/my';
        }).catch(UI.error);
      }
    });
  }

  document.addEventListener('click', function (e) {
    var z = e.target.closest('[data-zoom]');
    if (z) UI.lightbox(z.dataset.zoom);
  });
})();
