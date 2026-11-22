/**
 * app.js — สถานะหลัก ตัวนำทาง (router) แถบเมนู และหน้าพื้นฐาน
 */
var App = (function () {
  var view, cleanup = null, bootPromise = null, routeSeq = 0;
  var pages = {};

  /** [รูปแบบ, ชื่อหน้า, สิทธิ์ขั้นต่ำ, คลาสของ main] */
  var ROUTES = [
    ['', 'home', 0], ['login', 'login', 0], ['add', 'wizard', 1], ['edit/:id', 'wizard', 1],
    ['tree/:id', 'tree', 0], ['sp/:id', 'species', 0], ['search', 'search', 0, 'wide'], ['map', 'map', 0, 'full'],
    ['calendar', 'calendar', 0], ['my', 'my', 1], ['profile', 'profile', 1],
    ['review', 'reviewQueue', 2, 'wide'], ['review/:id', 'reviewTree', 2, 'wide'],
    ['dash', 'dashboard', 3, 'wide'], ['admin', 'admin', 3, 'wide'], ['admin/:tab', 'admin', 3, 'wide'], ['labels', 'labels', 3, 'wide'],
    ['map3d', 'map3d', 0, 'full'], ['learn', 'learn', 0], ['learn/:tab', 'learn', 0], ['key', 'key', 0, 'wide'], ['identify', 'identify', 0],
    ['ask', 'ask', 0], ['routes', 'routes', 0], ['route/:id', 'route', 0, 'wide'], ['herbarium', 'herbarium', 0, 'wide'], ['pheno', 'pheno', 1]
  ];
  var LEVEL = { guest: 0, student: 1, leader: 2, teacher: 3, admin: 4 };

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var query = {};
    if (qi >= 0) h.slice(qi + 1).split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p[0]) query[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
    });
    var parts = path.split('/').filter(String);
    for (var i = 0; i < ROUTES.length; i++) {
      var pat = ROUTES[i][0].split('/').filter(String);
      if (pat.length !== parts.length) continue;
      var params = {}, ok = true;
      for (var j = 0; j < pat.length; j++) {
        if (pat[j].charAt(0) === ':') params[pat[j].slice(1)] = decodeURIComponent(parts[j]);
        else if (pat[j] !== parts[j]) { ok = false; break; }
      }
      if (ok) return { route: ROUTES[i], params: params, query: query };
    }
    return { route: ROUTES[0], params: {}, query: query };
  }

  function level() { return App.me ? (LEVEL[App.me.role] || 1) : 0; }

  function loadBoot(force) {
    if (bootPromise && !force) return bootPromise; // รอการโหลดใหม่ที่กำลังทำอยู่ (เช่น หลังบันทึก)
    if (App.boot && !force) return Promise.resolve(App.boot);
    bootPromise = api('bootstrap').then(function (b) {
      App.offlineData = null;
      Offline.saveBoot(b);
      return b;
    }, function (e) {
      // ไม่มีเน็ต → ใช้ข้อมูลล่าสุดที่เก็บไว้ในเครื่อง
      var c = !e.server && Offline.cachedBoot();
      if (!c) throw e;
      App.offlineData = c.at;
      UI.toast('📴 ออฟไลน์ — แสดงข้อมูลล่าสุดเมื่อ ' + UI.thDate(new Date(c.at).toISOString(), true), 'warn', 5000);
      return c.boot;
    }).then(function (b) {
      App.boot = b;
      App.me = b.me;
      if (b.session_expired) API.setToken('');
      App.index();
      renderChrome();
      bootPromise = null;
      return b;
    }, function (e) { bootPromise = null; throw e; });
    return bootPromise;
  }

  function index() {
    var b = App.boot;
    App.speciesById = {};
    (b.species || []).forEach(function (s) { App.speciesById[s.species_id] = s; });
    App.zoneById = {};
    (b.zones || []).forEach(function (z) { App.zoneById[z.zone_id] = z; });
    App.treeById = {};
    (b.trees || []).forEach(function (t) { App.treeById[t.tree_id] = t; });
    var name = b.settings && b.settings.system_name;
    if (name) { document.getElementById('brandName').textContent = name; document.title = name + ' — ' + (b.settings.school_name || ''); }
  }

  function renderChrome() {
    var ua = document.getElementById('userArea');
    if (App.me) {
      ua.innerHTML = '<a class="user-chip" href="#/profile">👤 <span>' + esc(App.me.nickname || App.me.full_name) + '</span></a>';
    } else {
      ua.innerHTML = '<a class="user-chip" href="#/login">🔑 <span>เข้าสู่ระบบ</span></a>';
    }
    var nav = document.getElementById('bottomnav');
    document.body.classList.toggle('no-nav', !App.me);
    if (!App.me) { nav.classList.add('hidden'); return; }
    nav.classList.remove('hidden');
    var trees = (App.boot && App.boot.trees) || [];
    var lv = level();
    var items = [['', '🏠', 'หน้าหลัก'], ['search', '🔍', 'ค้นหา'], ['add', '＋', 'เพิ่มต้นไม้', 'plus'], ['map', '🗺️', 'แผนที่']];
    if (lv >= 2) {
      var pending = trees.filter(function (t) { return lv >= 3 ? (t.status === 'submitted' || t.status === 'pending_teacher') : t.status === 'submitted'; }).length;
      items.push(['review', '✅', 'ตรวจงาน', '', pending]);
    } else {
      var returned = trees.filter(function (t) { return t.created_by === App.me.user_id && t.status === 'returned'; }).length;
      items.push(['my', '📋', 'ผลงานของฉัน', '', returned]);
    }
    var cur = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
    nav.innerHTML = items.map(function (it) {
      return '<a href="#/' + it[0] + '" class="' + (it[3] || '') + (cur === it[0] ? ' active' : '') + '"><span class="ic">' + it[1] + '</span>' +
        esc(it[2]) + (it[4] ? '<span class="badge-dot">' + it[4] + '</span>' : '') + '</a>';
    }).join('');
  }

  function route() {
    var seq = ++routeSeq;
    var r = parseHash();
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    document.body.classList.remove('wizard-mode');
    view.className = r.route[3] || '';
    window.scrollTo(0, 0);
    loadBoot().then(function () {
      if (seq !== routeSeq) return;
      renderChrome();
      if (level() < r.route[2]) {
        if (!App.me) { location.hash = '#/login?next=' + encodeURIComponent(location.hash.slice(1)); return; }
        view.innerHTML = '<div class="empty"><span class="ic">🔒</span>หน้านี้สำหรับ' + esc(['', 'นักเรียน', 'หัวหน้ากลุ่ม', 'ครู', 'ผู้ดูแลระบบ'][r.route[2]]) + 'ขึ้นไป</div>';
        return;
      }
      var page = pages[r.route[1]];
      view.innerHTML = '<div class="empty"><div class="spinner"></div></div>';
      var res = page(r.params, r.query, view);
      Promise.resolve(res).then(function (c) { if (seq === routeSeq && typeof c === 'function') cleanup = c; else if (typeof c === 'function') c(); })
        .catch(function (e) {
          if (seq !== routeSeq) return;
          view.innerHTML = '<div class="alert error"><span class="ic">⚠️</span><div>' + esc(e.message) + '</div></div><a class="btn" href="#/">กลับหน้าหลัก</a>';
        });
    }).catch(function (e) {
      view.innerHTML = '<div class="alert error"><span class="ic">⚠️</span><div><b>โหลดข้อมูลไม่สำเร็จ</b><br>' + esc(e.message) +
        '</div></div><button class="btn primary" onclick="location.reload()">ลองใหม่</button>';
    });
  }

  function start() {
    view = document.getElementById('view');
    Offline.init();
    if (API.mode === 'mock') {
      var rb = document.getElementById('demoRibbon');
      rb.classList.remove('hidden');
      rb.innerHTML = '🧪 โหมดทดลอง — ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น <button id="resetDemo">ล้างข้อมูลทดลอง</button>';
      document.getElementById('resetDemo').onclick = function () {
        UI.confirm('ล้างข้อมูลทดลอง?', 'ข้อมูลทดลองทั้งหมดในเบราว์เซอร์นี้จะกลับเป็นค่าเริ่มต้น', 'ล้างข้อมูล', 'danger solid').then(function (ok) {
          if (!ok) return;
          Platform.resetAll(); API.setToken(''); location.hash = '#/'; location.reload();
        });
      };
    }
    window.addEventListener('hashchange', route);
    // หน้าเว็บที่รันใน Apps Script อยู่ใน iframe — อ่าน #/tree/... จาก URL ด้านนอก (ลิงก์จาก QR Code)
    if (API.mode === 'gas' && google.script.url) {
      google.script.url.getLocation(function (loc) {
        var h = loc && loc.hash ? String(loc.hash).replace(/^#?/, '#') : '';
        if (h && h !== location.hash) location.hash = h; else route();
      });
      return;
    }
    route();
  }

  function onSessionExpired() {
    App.me = null;
    App.boot = null;
    UI.toast('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง', 'warn');
    location.hash = '#/login';
  }

  /** เรียกหลังมีการบันทึก เพื่อโหลดข้อมูลรายการใหม่ */
  function refresh() { return loadBoot(true); }

  // ---------- ตัวช่วยแสดงผลที่ใช้หลายหน้า ----------
  function spOf(t) { return t && App.speciesById ? App.speciesById[t.species_id] : null; }
  function treeName(t) { var s = spOf(t); return s ? (s.thai_name || s.local_name || s.scientific_name) : 'ยังไม่ทราบชนิด'; }
  function zoneName(id) { return id && App.zoneById[id] ? App.zoneById[id].name : ''; }
  function listOpts(name) { return (App.boot.lists && App.boot.lists[name]) || []; }

  function thumbHtml(t) {
    if (t.cover) return UI.photoImg(t.cover, 'thumb');
    var s = spOf(t);
    return Icons.habitEmoji(s && s.habit);
  }

  function treeItem(t, href) {
    var s = spOf(t);
    return '<a class="list-item" href="' + (href || '#/tree/' + esc(t.tree_id)) + '">' +
      '<div class="thumb">' + thumbHtml(t) + '</div>' +
      '<div class="body"><div class="title">' + esc(treeName(t)) + ' ' + (s && s.status !== 'verified' ? '<span class="pill">ชนิดใหม่</span>' : '') + '</div>' +
      '<div class="sub">' + (s && s.scientific_name ? '<span class="sci">' + esc(s.scientific_name) + '</span> · ' : '') + '<span class="code-tag">' + esc(t.tree_code) + '</span></div>' +
      '<div class="sub">' + UI.statusPill(t.status) + ' ' + esc(zoneName(t.zone_id)) + '</div></div>' +
      '<span class="chev">›</span></a>';
  }

  function currentMonthValue() {
    var m = new Date().getMonth();
    return UI.TH_MONTHS[m];
  }

  function hasMonth(field, monthLabel) {
    return String(field || '').split(',').map(function (x) { return x.trim(); }).indexOf(monthLabel) >= 0;
  }

  function speciesCover(spId) {
    var trees = (App.boot.trees || []).filter(function (t) { return t.species_id === spId && t.cover; });
    return trees.length ? trees[0].cover : null;
  }

  function speciesCard(s) {
    var cover = speciesCover(s.species_id);
    var n = (App.boot.trees || []).filter(function (t) { return t.species_id === s.species_id && t.status === 'verified'; }).length;
    return '<a class="sp-card" href="#/sp/' + esc(s.species_id) + '"><div class="img">' + (cover ? UI.photoImg(cover, 'thumb') : Icons.habitEmoji(s.habit)) + '</div>' +
      '<div class="txt"><b>' + esc(s.thai_name || s.local_name) + '</b><div class="sci">' + esc(s.scientific_name) + '</div>' +
      '<div class="small muted">' + esc(s.family) + (n ? ' · ' + n + ' ต้น' : '') + '</div></div></a>';
  }

  // ---------- หน้า: หน้าแรก ----------
  pages.home = function (p, q, el) {
    var b = App.boot;
    var verifiedTrees = b.trees.filter(function (t) { return t.status === 'verified'; });
    var spSet = {}, famSet = {};
    verifiedTrees.forEach(function (t) { var s = spOf(t); if (s) { spSet[s.species_id] = 1; if (s.family) famSet[s.family] = 1; } });
    var month = currentMonthValue();
    var flowering = b.species.filter(function (s) { return s.status === 'verified' && hasMonth(s.flowering_season, month); });

    var html = '';
    if (!App.me) {
      html += '<section class="hero"><h1>🌿 ' + esc(b.settings.system_name) + '</h1><p>ทะเบียนพรรณไม้ดิจิทัล งานสวนพฤกษศาสตร์โรงเรียน<br>' + esc(b.settings.school_name) + '</p>' +
        '<div class="stats"><div class="stat"><b>' + Object.keys(spSet).length + '</b><span>ชนิด</span></div><div class="stat"><b>' + verifiedTrees.length +
        '</b><span>ต้น</span></div><div class="stat"><b>' + Object.keys(famSet).length + '</b><span>วงศ์</span></div></div>' + carbonLine() + '</section>';
      html += searchBox();
      html += '<div class="tiles"><a class="tile" href="#/search"><span class="ic">🔍</span>ค้นหาพรรณไม้</a><a class="tile" href="#/map3d"><span class="ic">🧊</span>แผนที่ 3 มิติ</a>' +
        '<a class="tile" href="#/routes"><span class="ic">🚶</span>เส้นทางเรียนรู้</a><a class="tile" href="#/calendar"><span class="ic">🌸</span>ปฏิทินดอกไม้</a>' +
        '<a class="tile" href="#/ask"><span class="ic">💬</span>ถามพฤกษา</a><a class="tile" href="#/identify"><span class="ic">📷</span>ค้นด้วยรูป</a>' +
        '<a class="tile" href="#/key"><span class="ic">🔑</span>รูปวิธาน</a><a class="tile primary" href="#/login"><span class="ic">👤</span>เข้าสู่ระบบ</a></div>' + extraHome();
    } else {
      var lv = level();
      html += '<div class="card"><div class="card-title"><div><h2>สวัสดี ' + esc(App.me.nickname || App.me.full_name) + '</h2>' +
        '<div class="muted small">' + esc(UI.ROLE_LABEL[App.me.role] || '') + (App.me.class ? ' · ' + esc(App.me.class) : '') + (App.me.group ? ' · ' + esc(App.me.group) : '') + '</div></div>' +
        '<div class="right"><b style="font-size:1.3rem;color:var(--green-700)">⭐ ' + (App.me.points || 0) + '</b><div class="small muted">คะแนน</div></div></div><div id="meBox"></div></div>';
      var mine = b.trees.filter(function (t) { return t.created_by === App.me.user_id; });
      var returned = mine.filter(function (t) { return t.status === 'returned'; });
      var drafts = mine.filter(function (t) { return t.status === 'draft'; });
      if (returned.length) html += '<a class="alert warn" href="#/my?f=returned"><span class="ic">↩️</span><div><b>งานถูกส่งกลับให้แก้ไข ' + returned.length + ' รายการ</b><br><span class="small">กดเพื่อดูความเห็นของครู</span></div></a>';
      if (drafts.length) html += '<a class="alert info" href="#/my?f=draft"><span class="ic">📝</span><div>มีร่างที่ยังไม่ส่ง ' + drafts.length + ' รายการ</div></a>';
      if (lv >= 2) {
        var pend = b.trees.filter(function (t) { return lv >= 3 ? (t.status === 'submitted' || t.status === 'pending_teacher') : t.status === 'submitted'; }).length;
        if (pend) html += '<a class="alert ok" href="#/review"><span class="ic">✅</span><div><b>มีงานรอตรวจ ' + pend + ' รายการ</b></div></a>';
      }
      html += missionsHtml();
      html += '<div class="tiles"><a class="tile primary" href="#/add"><span class="ic">➕</span>เพิ่มต้นไม้</a><a class="tile" href="#/identify"><span class="ic">📷</span>ถาม AI ด้วยรูป</a>' +
        '<a class="tile" href="#/map"><span class="ic">🗺️</span>แผนที่</a><a class="tile" href="#/pheno"><span class="ic">🌸</span>บันทึกดอก/ผล</a>' +
        '<a class="tile" href="#/my"><span class="ic">📋</span>ผลงานของฉัน</a><a class="tile" href="#/map3d"><span class="ic">🧊</span>แผนที่ 3 มิติ</a>' +
        '<a class="tile" href="#/learn"><span class="ic">📚</span>คลังความรู้</a><a class="tile" href="#/key"><span class="ic">🔑</span>รูปวิธาน</a></div>';
      if (lv >= 3) {
        html += '<div class="section-title">👩‍🏫 สำหรับครู</div><div class="tiles"><a class="tile" href="#/review"><span class="ic">✅</span>คิวตรวจงาน</a>' +
          '<a class="tile" href="#/dash"><span class="ic">📊</span>Dashboard</a><a class="tile" href="#/labels"><span class="ic">🏷️</span>ป้ายชื่อ + QR</a>' +
          '<a class="tile" href="#/admin/' + (lv >= 4 ? 'users' : 'missions') + '"><span class="ic">⚙️</span>จัดการระบบ</a>' +
          '<a class="tile" href="#/admin/issues"><span class="ic">⚠️</span>ปัญหาต้นไม้' + (b.open_issues ? ' (' + b.open_issues + ')' : '') + '</a>' +
          '<a class="tile" href="#/admin/routes"><span class="ic">🚶</span>เส้นทางเรียนรู้</a><a class="tile" href="#/admin/missions"><span class="ic">🎯</span>ภารกิจ</a>' +
          '<a class="tile" href="#/herbarium"><span class="ic">🗂️</span>ตัวอย่างแห้ง</a><a class="tile" href="#/calendar"><span class="ic">🌸</span>ปฏิทินพรรณไม้</a></div>';
      } else if (lv === 2) {
        html += '<div class="tiles"><a class="tile" href="#/review"><span class="ic">👀</span>ตรวจงานกลุ่ม</a><a class="tile" href="#/calendar"><span class="ic">🌸</span>ปฏิทินดอกไม้</a></div>';
      }
      html += extraHome();
    }

    html += '<div class="card"><div class="card-title"><h3>🌸 เดือนนี้ (' + esc(UI.TH_MONTHS_FULL[new Date().getMonth()]) + ') กำลังออกดอก</h3><a href="#/calendar" class="small">ดูทั้งปี ›</a></div>' +
      (flowering.length ? '<div class="grid-cards">' + flowering.slice(0, 8).map(speciesCard).join('') + '</div>' : '<div class="muted">ยังไม่มีข้อมูลช่วงออกดอกของเดือนนี้</div>') + '</div>';
    el.innerHTML = html;
    UI.hydratePhotos(el);
    bindSearchBox(el);

    if (App.me) {
      api('me').then(function (m) {
        var box = document.getElementById('meBox');
        if (!box) return;
        App.me.points = m.user.points;
        var c = m.counts || {};
        box.innerHTML = '<div class="stats" style="margin-top:8px"><div class="stat"><b>' + (m.total || 0) + '</b><span>ต้นที่บันทึก</span></div>' +
          '<div class="stat"><b>' + (c.verified || 0) + '</b><span>ผ่านการตรวจ</span></div><div class="stat"><b>' + ((c.submitted || 0) + (c.pending_teacher || 0)) + '</b><span>รอตรวจ</span></div></div>' +
          (m.badges.length ? '<div class="chips" style="margin-top:10px">' + m.badges.map(function (x) { return '<span class="pill verified">🏅 ' + esc(x) + '</span>'; }).join('') + '</div>' : '');
      }).catch(function () { /* ไม่สำคัญ */ });
    }
  };

  function carbonLine() {
    var c = window.Carbon ? Carbon.total(App.boot.trees.filter(function (t) { return t.status === 'verified'; })) : null;
    return c && c.n ? '<p style="margin:12px 0 0;font-size:.92rem">🌍 ต้นไม้ในโรงเรียนกักเก็บคาร์บอนรวม ≈ <b>' + UI.fmtNum(c.co2 / 1000, 1) +
      ' ตัน CO₂</b> <span style="opacity:.8">(ค่าประมาณจาก ' + c.n + ' ต้น)</span></p>' : '';
  }

  function missionsHtml() {
    var ms = (App.boot.missions || []).filter(function (m) { return m.status !== 'closed'; });
    if (!ms.length) return '';
    return ms.slice(0, 3).map(function (m) {
      var pct = m.target_count ? Math.min(100, Math.round(m.progress / m.target_count * 100)) : 0;
      return '<div class="card flat" style="margin-bottom:10px"><div class="card-title"><b>🎯 ' + esc(m.title) + '</b><span class="small muted">' +
        (m.due_date ? 'ภายใน ' + UI.thDate(m.due_date) : '') + '</span></div>' + (m.description ? '<div class="small">' + esc(m.description) + '</div>' : '') +
        '<div class="conf"><div class="progress"><div style="width:' + pct + '%"></div></div><b>' + m.progress + (m.target_count ? '/' + m.target_count : '') + '</b></div>' +
        '<div class="small muted">' + (m.zone_id ? 'โซน ' + esc(zoneName(m.zone_id)) + ' · ' : '') + (m.group ? esc(m.group) : 'ทุกกลุ่ม') + ' · ผ่านการตรวจแล้ว ' + m.verified + ' ต้น</div></div>';
    }).join('');
  }

  function extraHome() {
    var routes = App.boot.routes || [];
    return routes.length ? '<div class="card"><div class="card-title"><h3>🚶 เส้นทางเรียนรู้</h3><a class="small" href="#/routes">ทั้งหมด ›</a></div>' +
      routes.slice(0, 3).map(function (r) {
        return '<a class="list-item" href="#/route/' + esc(r.route_id) + '"><div class="thumb" style="background:' + esc(r.color) + '22">🚶</div><div class="body"><div class="title">' +
          esc(r.name) + '</div><div class="sub">' + r.tree_ids.length + ' จุด · ' + esc(r.description) + '</div></div><span class="chev">›</span></a>';
      }).join('') + '</div>' : '';
  }

  function searchBox(value) {
    return '<form class="search-box" id="homeSearch" style="margin-bottom:14px"><span class="ic">🔍</span>' +
      '<input type="search" name="q" placeholder="ค้นหาชื่อต้นไม้ ชื่อวิทยาศาสตร์ วงศ์ หรือรหัสต้น" value="' + esc(value || '') + '" autocomplete="off"></form>';
  }
  function bindSearchBox(el) {
    var f = UI.$('#homeSearch', el);
    if (f) f.onsubmit = function (e) { e.preventDefault(); location.hash = '#/search?q=' + encodeURIComponent(f.q.value.trim()); };
  }

  // ---------- หน้า: เข้าสู่ระบบ ----------
  pages.login = function (p, q, el) {
    if (App.me) { location.hash = '#/'; return; }
    var next = q.next || '/';
    var demo = API.mode === 'mock' ? '<div class="card flat"><h3>🧪 บัญชีทดลอง</h3><table class="tbl"><tr><th>ชื่อผู้ใช้</th><th>รหัสผ่าน</th><th>บทบาท</th></tr>' +
      '<tr><td>admin</td><td>admin1234</td><td>ผู้ดูแลระบบ</td></tr><tr><td>teacher</td><td>123456</td><td>ครู</td></tr>' +
      '<tr><td>10001</td><td>123456</td><td>หัวหน้ากลุ่ม</td></tr><tr><td>10002</td><td>123456</td><td>นักเรียน (มีงานถูกส่งกลับ)</td></tr>' +
      '<tr><td>10004</td><td>(ว่าง)</td><td>นักเรียนเข้าครั้งแรก</td></tr></table></div>' : '';
    el.innerHTML = '<div style="max-width:440px;margin:0 auto"><div class="card"><h2>🔑 เข้าสู่ระบบ</h2>' +
      '<form id="loginForm"><label class="field"><span>ชื่อผู้ใช้ (เลขประจำตัวนักเรียน)</span><input name="username" inputmode="numeric" autocomplete="username" required></label>' +
      '<label class="field"><span>รหัสผ่าน</span><input name="password" type="password" autocomplete="current-password"><div class="field-hint">เข้าครั้งแรก: เว้นว่างไว้ แล้วระบบจะให้ตั้งรหัสผ่านใหม่</div></label>' +
      '<button class="btn primary big block">เข้าสู่ระบบ</button></form>' +
      '<p class="small muted" style="margin-top:12px">ลืมรหัสผ่าน? <a href="#" id="forgot">รับรหัสทางอีเมล</a> (ถ้าครูบันทึกอีเมลไว้) หรือแจ้งครูให้กดรีเซ็ตรหัสผ่าน แล้วเข้าระบบแบบ "เข้าครั้งแรก"</p></div>' + demo + '</div>';
    var form = UI.$('#loginForm', el);
    UI.$('#forgot', el).onclick = function (e) { e.preventDefault(); forgotFlow(form.username.value.trim(), next); };
    form.onsubmit = function (e) {
      e.preventDefault();
      var username = form.username.value.trim();
      UI.busy(api('login', { username: username, password: form.password.value }), 'กำลังเข้าสู่ระบบ').then(function (r) {
        if (r.needSetPassword) return setPasswordFlow(username, r.full_name, next);
        afterLogin(r, next);
      }).catch(UI.error);
    };
  };

  function setPasswordFlow(username, fullName, next) {
    return UI.modal({
      title: '🔐 ตั้งรหัสผ่านใหม่',
      body: '<p>สวัสดี <b>' + esc(fullName) + '</b> — ตั้งรหัสผ่านของตัวเอง (อย่างน้อย 6 ตัว) และจำไว้ให้ดี</p>' +
        '<label class="field"><span>รหัสผ่านใหม่</span><input type="password" name="p1" autocomplete="new-password"></label>' +
        '<label class="field"><span>พิมพ์รหัสผ่านอีกครั้ง</span><input type="password" name="p2" autocomplete="new-password"></label>',
      buttons: [{ label: 'ยกเลิก', value: null }, {
        label: 'บันทึกรหัสผ่าน', cls: 'primary', onClick: function (m) {
          var v = UI.formValues(m);
          if (v.p1.length < 6) { UI.toast('รหัสผ่านต้องมีอย่างน้อย 6 ตัว', 'error'); return false; }
          if (v.p1 !== v.p2) { UI.toast('รหัสผ่านสองช่องไม่ตรงกัน', 'error'); return false; }
          return api('setPassword', { username: username, password: v.p1 }).then(function (r) { afterLogin(r, next); return true; });
        }
      }]
    });
  }

  function forgotFlow(username, next) {
    UI.modal({
      title: '📧 ลืมรหัสผ่าน',
      body: '<label class="field"><span>ชื่อผู้ใช้ (เลขประจำตัว)</span><input name="u" value="' + esc(username) + '"></label>',
      buttons: [{ label: 'ยกเลิก', value: null }, {
        label: 'ส่งรหัสไปที่อีเมล', cls: 'primary', onClick: function (m) {
          var u = UI.formValues(m).u.trim();
          return api('requestReset', { username: u }).then(function (r) { return { u: u, r: r }; });
        }
      }]
    }).then(function (x) {
      if (!x) return;
      return UI.modal({
        title: '🔐 ตั้งรหัสผ่านใหม่',
        body: '<p>ส่งรหัส 6 หลักไปที่ <b>' + esc(x.r.email_hint) + '</b> แล้ว (ใช้ได้ 30 นาที)</p>' + (x.r.demo_code ? '<div class="alert info">🧪 โหมดทดลอง: รหัสคือ <b>' + esc(x.r.demo_code) + '</b></div>' : '') +
          '<label class="field"><span>รหัสจากอีเมล</span><input name="code" inputmode="numeric" maxlength="6"></label>' +
          '<label class="field"><span>รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</span><input type="password" name="p1" autocomplete="new-password"></label>',
        buttons: [{ label: 'ยกเลิก', value: null }, {
          label: 'บันทึก', cls: 'primary', onClick: function (m) {
            var v = UI.formValues(m);
            return api('resetWithCode', { username: x.u, code: v.code.trim(), password: v.p1 }).then(function (r) { afterLogin(r, next); return true; });
          }
        }]
      });
    }).catch(UI.error);
  }

  function afterLogin(r, next) {
    API.setToken(r.token);
    App.me = r.user;
    UI.toast('ยินดีต้อนรับ ' + (r.user.nickname || r.user.full_name), 'ok');
    loadBoot(true).then(function () { location.hash = '#' + (next.charAt(0) === '/' ? next : '/' + next); });
  }

  // ---------- หน้า: ผลงานของฉัน ----------
  pages.my = function (p, q, el) {
    var mine = App.boot.trees.filter(function (t) { return t.created_by === App.me.user_id; });
    var filter = q.f || 'all';
    var order = ['returned', 'draft', 'submitted', 'pending_teacher', 'verified', 'archived'];
    mine.sort(function (a, b) { return order.indexOf(a.status) - order.indexOf(b.status) || String(b.updated_at).localeCompare(String(a.updated_at)); });
    var counts = {};
    mine.forEach(function (t) { counts[t.status] = (counts[t.status] || 0) + 1; });
    var shown = filter === 'all' ? mine : mine.filter(function (t) { return t.status === filter; });
    var pend = Offline.pendingCount();
    el.innerHTML = '<h1>📋 ผลงานของฉัน</h1>' + (pend ? '<button class="alert warn" style="width:100%;border:0;font:inherit;text-align:left;cursor:pointer" id="obx"><span class="ic">📤</span><div><b>มี ' + pend +
      ' รายการรอส่งขึ้นระบบ</b> (บันทึกตอนออฟไลน์) — แตะเพื่อดู/ส่ง</div></button>' : '') + '<div class="chips scroll" style="margin-bottom:12px">' +
      [['all', 'ทั้งหมด', mine.length]].concat(order.map(function (s) { return [s, UI.STATUS_LABEL[s], counts[s] || 0]; }))
        .filter(function (x) { return x[0] === 'all' || x[2]; })
        .map(function (x) { return '<a class="chip ' + (filter === x[0] ? 'on' : '') + '" href="#/my?f=' + x[0] + '">' + esc(x[1]) + ' (' + x[2] + ')</a>'; }).join('') +
      '</div><div class="card">' + (shown.length ? shown.map(function (t) {
        return treeItem(t, t.can_edit ? '#/edit/' + t.tree_id : '#/tree/' + t.tree_id);
      }).join('') : '<div class="empty"><span class="ic">🌱</span>ยังไม่มีรายการ<br><a class="btn primary" style="margin-top:12px" href="#/add">➕ เพิ่มต้นไม้ต้นแรก</a></div>') + '</div>';
    UI.hydratePhotos(el);
    if (pend) UI.$('#obx', el).onclick = Offline.showOutbox;
  };

  // ---------- หน้า: โปรไฟล์ ----------
  pages.profile = function (p, q, el) {
    var u = App.me;
    el.innerHTML = '<div class="card"><h2>👤 ' + esc(u.full_name) + '</h2><dl class="kv"><dt>ชื่อผู้ใช้</dt><dd>' + esc(u.username) + '</dd>' +
      '<dt>บทบาท</dt><dd>' + esc(UI.ROLE_LABEL[u.role] || u.role) + '</dd>' + (u.class ? '<dt>ห้อง/เลขที่</dt><dd>' + esc(u.class) + (u.number ? ' เลขที่ ' + esc(u.number) : '') + '</dd>' : '') +
      (u.group ? '<dt>กลุ่ม</dt><dd>' + esc(u.group) + '</dd>' : '') + '<dt>คะแนนสะสม</dt><dd>⭐ ' + (u.points || 0) + '</dd></dl></div>' +
      '<div class="card"><h3>เปลี่ยนรหัสผ่าน</h3><form id="pwForm"><label class="field"><span>รหัสผ่านเดิม</span><input type="password" name="old" autocomplete="current-password"></label>' +
      '<label class="field"><span>รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</span><input type="password" name="p1" autocomplete="new-password"></label>' +
      '<label class="field"><span>พิมพ์รหัสผ่านใหม่อีกครั้ง</span><input type="password" name="p2" autocomplete="new-password"></label>' +
      '<button class="btn primary">บันทึก</button></form></div>' +
      '<button class="btn danger block" id="logoutBtn">ออกจากระบบ</button>';
    var f = UI.$('#pwForm', el);
    f.onsubmit = function (e) {
      e.preventDefault();
      if (f.p1.value !== f.p2.value) return UI.toast('รหัสผ่านใหม่สองช่องไม่ตรงกัน', 'error');
      UI.busy(api('setPassword', { password: f.p1.value, oldPassword: f.old.value })).then(function (r) {
        API.setToken(r.token); f.reset(); UI.toast('เปลี่ยนรหัสผ่านแล้ว', 'ok');
      }).catch(UI.error);
    };
    UI.$('#logoutBtn', el).onclick = function () {
      api('logout').catch(function () { }).then(function () {
        API.setToken(''); App.me = null; App.boot = null; location.hash = '#/';
      });
    };
  };

  // ---------- หน้า: ปฏิทินดอกไม้ ----------
  pages.calendar = function (p, q, el) {
    var month = q.m !== undefined ? Number(q.m) : new Date().getMonth();
    var kind = q.k === 'fruit' ? 'fruit' : 'flower';
    var field = kind === 'fruit' ? 'fruiting_season' : 'flowering_season';
    var sp = App.boot.species.filter(function (s) { return s.status === 'verified'; });
    var obs = App.boot.phenology || {};
    var key = kind === 'fruit' ? 'r' : 'f';
    // รวมข้อมูล 2 แหล่ง: ช่วงที่บันทึกในข้อมูลชนิด + การสังเกตจริงรายเดือน (ชีพลักษณ์)
    var inMonth = function (s, i) { return hasMonth(s[field], UI.TH_MONTHS[i]) || (obs[s.species_id] && obs[s.species_id][key][i] > 0); };
    var counts = UI.TH_MONTHS.map(function (m, i) { return sp.filter(function (s) { return inMonth(s, i); }).length; });
    var list = sp.filter(function (s) { return inMonth(s, month); });
    el.innerHTML = '<h1>🌸 ปฏิทินพรรณไม้</h1><div class="chips" style="margin-bottom:12px">' +
      '<a class="chip ' + (kind === 'flower' ? 'on' : '') + '" href="#/calendar?m=' + month + '">🌼 ออกดอก</a>' +
      '<a class="chip ' + (kind === 'fruit' ? 'on' : '') + '" href="#/calendar?k=fruit&m=' + month + '">🍈 ติดผล</a></div>' +
      '<div class="months">' + UI.TH_MONTHS.map(function (m, i) {
        return '<button data-m="' + i + '" class="' + (i === month ? 'on' : '') + '">' + m + '<span class="n">' + counts[i] + ' ชนิด</span></button>';
      }).join('') + '</div><h3>' + (kind === 'fruit' ? 'ติดผล' : 'ออกดอก') + 'ในเดือน' + UI.TH_MONTHS_FULL[month] + ' (' + list.length + ' ชนิด)</h3>' +
      (list.length ? '<div class="grid-cards">' + list.map(speciesCard).join('') + '</div>' : '<div class="empty"><span class="ic">🗓️</span>ยังไม่มีข้อมูล</div>') +
      '<p class="small muted" style="margin-top:14px">รวมจากช่อง "ช่วงออกดอก/ติดผล" ของแต่ละชนิด และการบันทึกชีพลักษณ์จริงของนักเรียน (' +
      Object.keys(obs).reduce(function (a, k) { return a + obs[k].n; }, 0) + ' ครั้ง) ' + (App.me ? '— <a href="#/pheno">บันทึกเพิ่ม ›</a>' : '') + '</p>';
    UI.$$('.months button', el).forEach(function (b) {
      b.onclick = function () { location.hash = '#/calendar?' + (kind === 'fruit' ? 'k=fruit&' : '') + 'm=' + b.dataset.m; };
    });
    UI.hydratePhotos(el);
  };

  return {
    boot: null, me: null, speciesById: {}, zoneById: {}, treeById: {},
    pages: pages, start: start, loadBoot: loadBoot, refresh: refresh, index: index, level: level,
    onSessionExpired: onSessionExpired, renderChrome: renderChrome,
    spOf: spOf, treeName: treeName, zoneName: zoneName, listOpts: listOpts, treeItem: treeItem, thumbHtml: thumbHtml,
    speciesCard: speciesCard, hasMonth: hasMonth, searchBox: searchBox, bindSearchBox: bindSearchBox, LEVEL: LEVEL
  };
})();
