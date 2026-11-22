/**
 * google3d.js — แผนที่ 3 มิติแบบสมจริงของ Google (Photorealistic 3D Maps, Map3DElement)
 *  - อาคารและต้นไม้จริงจากภาพ 3 มิติของ Google + หมุดต้นไม้ที่ความสูงจริง (มีเสาลงพื้น) + วงทรงพุ่ม
 *  - โซน · เส้นทางเรียนรู้ · ปฏิทินดอกไม้ · ความหนาแน่น · ทัวร์ (บินไปแต่ละต้นแล้ววนรอบ) · เดินชม
 * ต้องตั้ง google_maps_api_key ในหน้า ตั้งค่า — ถ้าไม่มีคีย์หรือคีย์ใช้ไม่ได้ ระบบใช้แผนที่ 3 มิติแบบจำลอง (map3d.js)
 */
(function () {
  var PALETTE = ['#2f855a', '#d69e2e', '#2b6cb0', '#c53030', '#6b46c1', '#dd6b20', '#319795', '#b83280', '#718096', '#38a169'];
  var HEALTH = { 'ดี': '#38a169', 'ปานกลาง': '#d69e2e', 'มีโรค-แมลง': '#dd6b20', 'ใกล้ตาย': '#c53030', 'ตาย': '#4a5568' };
  var DEFAULT_H = { 'ไม้ต้น': 8, 'ไม้พุ่ม': 2, 'ไม้ล้มลุก': 0.6, 'ไม้เลื้อย': 3, 'ไม้รอเลื้อย': 3, 'ปาล์ม': 6, 'ไผ่': 7, 'เฟิร์น': 0.8, 'กล้วยไม้': 0.5 };
  var CROWN = '#2f855a', DIM = '#a0aec0';
  var loading = null;

  /** โหลด Maps JavaScript API (ช่อง beta มีไลบรารี maps3d) ครั้งเดียว */
  function loadGoogle(key) {
    if (window.google && google.maps && google.maps.importLibrary) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      window.__bmfGmReady = function () { resolve(); };
      window.gm_authFailure = function () {
        App.gmAuthFailed = true;
        UI.toast('Google Maps API Key ใช้ไม่ได้ (ตรวจว่าเปิด Maps JavaScript API, ผูกบัญชีเรียกเก็บเงิน และอนุญาตโดเมนนี้แล้ว) — สลับไปใช้แผนที่แบบจำลอง', 'error', 9000);
        if (/^#\/map3d/.test(location.hash)) location.hash = '#/map3d?engine=model';
      };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) +
        '&v=beta&libraries=maps3d,marker&language=th&region=TH&callback=__bmfGmReady&loading=async';
      s.async = true;
      s.onerror = function () { loading = null; reject(new Error('โหลด Google Maps ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function circlePath(lat, lng, r, n) {
    n = n || 20;
    var out = [], dLat = r / 111320, dLng = r / (111320 * Math.cos(lat * Math.PI / 180));
    for (var i = 0; i < n; i++) { var a = i / n * 2 * Math.PI; out.push({ lat: lat + dLat * Math.sin(a), lng: lng + dLng * Math.cos(a) }); }
    return out;
  }
  function offset(lat, lng, dx, dy) { return { lat: lat + dy / 111320, lng: lng + dx / (111320 * Math.cos(lat * Math.PI / 180)) }; }
  function treeHeight(t, sp) { return Number(t.height_m) || DEFAULT_H[sp.habit] || 5; }

  App.google3d = function (p, q, el) {
    var key = App.boot.settings.google_maps_api_key;
    el.innerHTML = '<div class="map-wrap"><div id="g3d" class="map full"></div>' +
      '<div class="m3-panel" id="m3panel"><button class="btn sm m3-toggle" id="m3toggle">☰ เครื่องมือ</button><div class="m3-body">' +
      '<label class="small">🎨 สีหมุดต้นไม้<select id="m3color"><option value="natural">ธรรมชาติ</option><option value="family">ตามวงศ์</option><option value="status">ตามสถานะการตรวจ</option><option value="health">ตามสุขภาพ</option></select></label>' +
      '<label class="check small"><input type="checkbox" id="m3canopy" checked> ⭕ แสดงวงทรงพุ่ม</label>' +
      '<label class="check small"><input type="checkbox" id="m3flower"> 🌸 ปฏิทินดอกไม้</label>' +
      '<div id="m3month" class="hidden"><input type="range" min="0" max="11" id="m3m" style="width:100%"><div class="small center" id="m3mlabel"></div></div>' +
      '<label class="check small"><input type="checkbox" id="m3heat"> 📊 จำนวนชนิดต่อโซน</label>' +
      '<label class="small">🚶 เส้นทางเรียนรู้<select id="m3route"><option value="">— ไม่แสดง —</option>' +
      (App.boot.routes || []).map(function (r) { return '<option value="' + esc(r.route_id) + '">' + esc(r.name) + '</option>'; }).join('') + '</select></label>' +
      '<div class="btn-row"><button class="btn sm primary" id="m3tour">👣 ทัวร์อัตโนมัติ</button><button class="btn sm" id="m3walk">🚶 เดินชม</button></div>' +
      '<div class="btn-row"><button class="btn sm" id="m3reset">🧭 มุมมองเริ่มต้น</button><a class="btn sm" href="#/map">🗺️ 2 มิติ</a></div>' +
      '<a class="small" href="#/map3d?engine=model">🧊 ใช้แผนที่ 3 มิติแบบจำลอง</a>' +
      '</div></div><div id="m3legend" class="map-legend"></div><div id="m3caption" class="m3-caption hidden"></div><div id="m3walkpad" class="m3-walk hidden"></div>' +
      '<div id="m3loading" class="empty" style="position:absolute;inset:0;z-index:600;background:rgba(255,255,255,.7)"><div class="spinner"></div>กำลังโหลดแผนที่ 3 มิติของ Google…</div></div>';

    var state = { color: 'natural', canopy: true, flower: false, month: new Date().getMonth(), heat: false, route: q.route || '' };
    var map = null, lib = null, Pin = null, overlays = [], tour = null, walkKeys = null, alive = true;
    var trees = App.boot.trees.filter(function (t) { return t.lat && t.lng && t.status !== 'archived'; });
    var colorOpts = {};
    App.listOpts('color').forEach(function (o) { colorOpts[o.value] = o.icon; });

    function floweringIn(sp, m) {
      if (!sp) return false;
      if (App.hasMonth(sp.flowering_season, UI.TH_MONTHS[m])) return true;
      var o = App.boot.phenology && App.boot.phenology[sp.species_id];
      return !!(o && o.f[m] > 0);
    }
    function routeStops(id) {
      var r = (App.boot.routes || []).filter(function (x) { return x.route_id === id; })[0];
      return r ? r.tree_ids.map(function (tid) { return App.treeById[tid]; }).filter(function (t) { return t && t.lat; }) : [];
    }

    function clear() { overlays.forEach(function (o) { o.remove(); }); overlays = []; }
    function add(o) { map.append(o); overlays.push(o); return o; }

    function pin(color, glyph, scale) {
      var pe = new Pin({ background: color, borderColor: '#ffffff', glyphColor: '#ffffff', scale: scale || 1 });
      if (glyph) { if ('glyphText' in pe) pe.glyphText = String(glyph); else pe.glyph = String(glyph); } // glyph เปลี่ยนชื่อเป็น glyphText ในรุ่นใหม่
      return pe;
    }

    /** วาดหมุด วงทรงพุ่ม โซน และเส้นทางใหม่ทั้งหมดตามสถานะปัจจุบัน */
    function draw() {
      clear();
      var AM = lib.AltitudeMode;
      var fam = {}, fi = 0, legend = {};
      var famIdx = function (f) { if (!fam[f]) fam[f] = PALETTE[fi++ % PALETTE.length]; return fam[f]; };

      // โซน
      var counts = {};
      App.boot.trees.forEach(function (t) { if (t.status === 'verified' && t.zone_id) (counts[t.zone_id] = counts[t.zone_id] || {})[t.species_id] = 1; });
      (App.boot.zones || []).forEach(function (z) {
        if (!z.polygon) return;
        var n = counts[z.zone_id] ? Object.keys(counts[z.zone_id]).length : 0;
        var fill = state.heat ? (n === 0 ? '#c5303066' : n < 3 ? '#d69e2e66' : n < 6 ? '#68d39166' : '#2f855a88') : (z.color || '#2f855a') + '22';
        add(new lib.Polygon3DElement({
          path: z.polygon.map(function (pt) { return { lat: pt[0], lng: pt[1] }; }),
          altitudeMode: AM.CLAMP_TO_GROUND, fillColor: fill, strokeColor: z.color || '#2f855a', strokeWidth: 3, drawsOccludedSegments: true
        }));
        if (state.heat) legend[esc(z.name) + ': ' + n + ' ชนิด'] = fill.slice(0, 7);
      });

      // เส้นทาง
      var stops = state.route ? routeStops(state.route) : [];
      if (stops.length > 1) {
        add(new lib.Polyline3DElement({
          path: stops.map(function (t) { return { lat: t.lat, lng: t.lng }; }), altitudeMode: AM.CLAMP_TO_GROUND,
          strokeColor: '#f6e05e', strokeWidth: 10, outerColor: '#744210', outerWidth: 0.25, drawsOccludedSegments: true
        }));
      }

      // ต้นไม้
      trees.forEach(function (t) {
        var sp = App.spOf(t) || {};
        var color, key;
        if (state.flower) {
          var fc = String(sp.flower_color || '').split(',')[0].trim();
          color = floweringIn(sp, state.month) ? (colorOpts[fc] || '#f6c945') : DIM;
          key = color === DIM ? 'ไม่ออกดอก' : (fc || 'ออกดอก');
        } else if (state.color === 'family') { key = sp.family || 'ไม่ทราบ'; color = sp.family ? famIdx(sp.family) : DIM; }
        else if (state.color === 'status') { key = UI.STATUS_LABEL[t.status]; color = UI.STATUS_COLOR[t.status] || CROWN; }
        else if (state.color === 'health') { key = t.health || 'ไม่ระบุ'; color = HEALTH[t.health] || DIM; }
        else { color = CROWN; }
        if (key && !state.heat) legend[esc(key)] = color;
        var H = treeHeight(t, sp);
        var stopNo = stops.indexOf(t);
        var mo = { position: { lat: t.lat, lng: t.lng, altitude: H + 1 }, altitudeMode: AM.RELATIVE_TO_GROUND, extruded: true, drawsWhenOccluded: true, zIndex: stopNo >= 0 ? 10 : 1 };
        if (trees.length <= 40 || stopNo >= 0) mo.label = App.treeName(t); // ป้ายชื่อเฉพาะเมื่อต้นไม่มากเกินไป
        var m = new lib.Marker3DInteractiveElement(mo);
        m.append(pin(stopNo >= 0 ? '#d69e2e' : color, stopNo >= 0 ? stopNo + 1 : '', stopNo >= 0 ? 1.2 : 0.9));
        m.addEventListener('gmp-click', function () { showTree(t); });
        add(m);
        if (state.canopy) {
          var R = (Number(t.canopy_m) || H * 0.6) / 2;
          add(new lib.Polygon3DElement({
            path: circlePath(t.lat, t.lng, Math.max(0.5, R)), altitudeMode: AM.CLAMP_TO_GROUND,
            fillColor: color + '40', strokeColor: color, strokeWidth: 2, drawsOccludedSegments: true
          }));
        }
      });

      UI.$('#m3legend', el).innerHTML = Object.keys(legend).slice(0, 10).map(function (k) { return '<div><i style="background:' + legend[k] + '"></i>' + k + '</div>'; }).join('') +
        '<div class="muted">' + trees.length + ' ต้น' + (state.flower ? ' · ' + UI.TH_MONTHS_FULL[state.month] : '') + ' · ภาพ 3 มิติ © Google</div>';
    }

    function camFor(t, heading) {
      var sp = App.spOf(t) || {};
      var H = treeHeight(t, sp);
      return { center: { lat: t.lat, lng: t.lng, altitude: H / 2 }, range: Math.max(45, H * 5), tilt: 65, heading: heading === undefined ? (map.heading || 0) + 50 : heading };
    }

    function homeView(animate) {
      var pts = trees.length ? trees : [];
      var c = String(App.boot.settings.map_center || '13.7563,100.5018').split(',').map(Number);
      var lat = c[0], lng = c[1], range = 400;
      if (pts.length) {
        var la = pts.map(function (t) { return t.lat; }), ln = pts.map(function (t) { return t.lng; });
        var minLa = Math.min.apply(null, la), maxLa = Math.max.apply(null, la), minLn = Math.min.apply(null, ln), maxLn = Math.max.apply(null, ln);
        lat = (minLa + maxLa) / 2; lng = (minLn + maxLn) / 2;
        var ext = Math.max(Maps.distanceM([minLa, minLn], [maxLa, minLn]), Maps.distanceM([minLa, minLn], [minLa, maxLn]));
        range = Math.max(180, ext * 2.2);
      }
      var cam = { center: { lat: lat, lng: lng, altitude: 0 }, range: range, tilt: 60, heading: -20 };
      if (animate) map.flyCameraTo({ endCamera: cam, durationMillis: 1800 });
      else Object.assign(map, cam);
    }

    function showTree(t) {
      var sp = App.spOf(t) || {};
      var cap = UI.$('#m3caption', el);
      if (tour) return;
      cap.classList.remove('hidden');
      cap.innerHTML = '<div style="display:flex;gap:10px">' + (t.cover ? '<div style="width:84px;height:84px;flex:none;border-radius:10px;overflow:hidden">' + UI.photoImg(t.cover) + '</div>' : '') +
        '<div style="min-width:0;flex:1"><b style="font-size:1.1rem">' + esc(App.treeName(t)) + '</b><div class="sci small">' + esc(sp.scientific_name || '') + '</div>' +
        '<div class="small"><span class="code-tag">' + esc(t.tree_code) + '</span> สูง ' + (t.height_m || '?') + ' ม. · ทรงพุ่ม ' + (t.canopy_m || '?') + ' ม.</div></div>' +
        '<button class="btn sm ghost" data-close="1">✕</button></div><div class="btn-row" style="margin-top:8px"><a class="btn sm primary" href="#/tree/' + esc(t.tree_id) + '">ดูรายละเอียด</a>' +
        '<button class="btn sm" data-orbit="' + esc(t.tree_id) + '">🔄 วนรอบต้นนี้</button></div>';
      UI.hydratePhotos(cap);
    }

    // ---------- ทัวร์: บินไปแต่ละต้น แล้ววนรอบ ----------
    function startTour() {
      stopWalk();
      var stops = state.route ? routeStops(state.route) : App.boot.trees.filter(function (t) { return t.status === 'verified' && t.lat; })
        .sort(function (a, b) { return String(a.zone_id).localeCompare(String(b.zone_id)) || a.lat - b.lat; });
      if (!stops.length) return UI.toast('ยังไม่มีต้นไม้ที่ผ่านการตรวจสำหรับทัวร์', 'warn');
      tour = { stops: stops, i: -1, paused: false, phase: '' };
      UI.$('#m3panel', el).classList.add('collapsed');
      nextStop();
    }
    function nextStop() {
      if (!tour) return;
      tour.i = (tour.i + 1) % tour.stops.length;
      var t = tour.stops[tour.i], sp = App.spOf(t) || {};
      tour.phase = 'fly';
      map.flyCameraTo({ endCamera: camFor(t), durationMillis: 4000 });
      var use = [sp.use_medicine, sp.use_food, sp.use_construction, sp.use_culture, sp.use_other].filter(Boolean)[0] || '';
      var cap = UI.$('#m3caption', el);
      cap.classList.remove('hidden');
      cap.innerHTML = '<div style="display:flex;gap:10px">' + (t.cover ? '<div style="width:84px;height:84px;flex:none;border-radius:10px;overflow:hidden">' + UI.photoImg(t.cover) + '</div>' : '') +
        '<div style="min-width:0"><div class="small muted">จุดที่ ' + (tour.i + 1) + '/' + tour.stops.length + ' · ' + esc(App.zoneName(t.zone_id)) + '</div><b style="font-size:1.1rem">' + esc(App.treeName(t)) + '</b>' +
        '<div class="sci small">' + esc(sp.scientific_name || '') + '</div><div class="small">' + esc(sp.family ? 'วงศ์ ' + sp.family : '') + (sp.habit ? ' · ' + esc(sp.habit) : '') + (t.height_m ? ' · สูง ' + t.height_m + ' ม.' : '') + '</div>' +
        (use ? '<div class="small" style="margin-top:4px">🧺 ' + esc(use.length > 110 ? use.slice(0, 108) + '…' : use) + '</div>' : '') + '</div></div>' +
        '<div class="btn-row" style="margin-top:8px"><button class="btn sm" data-tour="pause">' + (tour.paused ? '▶️ เล่นต่อ' : '⏸️ หยุดชั่วคราว') + '</button><button class="btn sm" data-tour="next">⏭️ ถัดไป</button>' +
        '<a class="btn sm" href="#/tree/' + esc(t.tree_id) + '">ดูรายละเอียด</a><button class="btn sm danger" data-tour="stop">✕ จบทัวร์</button></div>';
      UI.hydratePhotos(cap);
    }
    function onAnimationEnd() {
      if (!tour || tour.paused) return;
      if (tour.phase === 'fly') {
        tour.phase = 'orbit';
        map.flyCameraAround({ camera: camFor(tour.stops[tour.i], map.heading), durationMillis: 9000, repeatCount: 1 });
      } else if (tour.phase === 'orbit') {
        nextStop();
      }
    }
    function stopTour() {
      if (!tour) return;
      tour = null;
      try { map.stopCameraAnimation(); } catch (e) { /* ignore */ }
      UI.$('#m3caption', el).classList.add('hidden');
    }

    // ---------- เดินชม ----------
    function startWalk() {
      stopTour();
      var c = map.center;
      map.flyCameraTo({ endCamera: { center: { lat: c.lat, lng: c.lng, altitude: 1.6 }, range: 25, tilt: 82, heading: map.heading || 0 }, durationMillis: 1500 });
      var pad = UI.$('#m3walkpad', el);
      pad.classList.remove('hidden');
      pad.innerHTML = '<div></div><button class="btn" data-w="f">⬆️</button><div></div><button class="btn" data-w="l">↺</button><button class="btn" data-w="b">⬇️</button><button class="btn" data-w="r">↻</button>' +
        '<button class="btn sm danger" data-w="x" style="grid-column:1/4">ออกจากโหมดเดินชม</button>';
      UI.$('#m3panel', el).classList.add('collapsed');
      walkKeys = function (e) {
        var k = { ArrowUp: 'f', w: 'f', ArrowDown: 'b', s: 'b', ArrowLeft: 'l', a: 'l', ArrowRight: 'r', d: 'r', Escape: 'x' }[e.key];
        if (k) { e.preventDefault(); walk(k); }
      };
      document.addEventListener('keydown', walkKeys);
      UI.toast('🚶 ใช้ปุ่มลูกศรเพื่อเดิน/หมุนมุมมอง (คอมพิวเตอร์ใช้คีย์ลูกศร หรือ W A S D)', '', 5000);
    }
    function walk(k) {
      if (k === 'x') return stopWalk();
      var h = map.heading || 0;
      if (k === 'l' || k === 'r') { map.heading = (h + (k === 'l' ? -25 : 25) + 360) % 360; return; }
      var b = h * Math.PI / 180, d = k === 'f' ? 4 : -4, c = map.center;
      var n = offset(c.lat, c.lng, Math.sin(b) * d, Math.cos(b) * d);
      map.center = { lat: n.lat, lng: n.lng, altitude: c.altitude || 1.6 };
    }
    function stopWalk() {
      if (!walkKeys) return;
      document.removeEventListener('keydown', walkKeys);
      walkKeys = null;
      UI.$('#m3walkpad', el).classList.add('hidden');
      var c = map.center;
      map.flyCameraTo({ endCamera: { center: { lat: c.lat, lng: c.lng, altitude: 0 }, range: 200, tilt: 60, heading: map.heading || 0 }, durationMillis: 1200 });
    }

    return loadGoogle(key).then(function () {
      return Promise.all([google.maps.importLibrary('maps3d'), google.maps.importLibrary('marker')]);
    }).then(function (libs) {
      if (!alive || !UI.$('#g3d', el)) return;
      lib = libs[0];
      Pin = libs[1].PinElement;
      map = new lib.Map3DElement({ mode: lib.MapMode ? lib.MapMode.HYBRID : 'HYBRID', center: { lat: 0, lng: 0, altitude: 0 }, range: 400, tilt: 60, heading: -20 });
      map.style.cssText = 'display:block;width:100%;height:100%';
      UI.$('#g3d', el).append(map);
      homeView(false);
      draw();
      UI.$('#m3loading', el).remove();
      map.addEventListener('gmp-animationend', onAnimationEnd);
      // คีย์ผิด/ยังไม่เปิดบริการ แผนที่ 3 มิติจะหมุนค้างโดยไม่แจ้ง error → ตรวจว่าโหลดเสร็จภายใน 20 วินาที
      var ready = false;
      map.addEventListener('gmp-steadychange', function (e) { if (e.isSteady) ready = true; });
      setTimeout(function () {
        if (ready || !alive || !UI.$('#g3d', el)) return;
        var box = document.createElement('div');
        box.className = 'alert warn';
        box.style.cssText = 'position:absolute;z-index:700;left:50%;top:40%;transform:translateX(-50%);width:min(92%,460px);box-shadow:var(--shadow)';
        box.innerHTML = '<span class="ic">⏳</span><div><b>แผนที่ 3 มิติของ Google ยังไม่ขึ้น</b><br><span class="small">อินเทอร์เน็ตช้า หรือ API Key ใช้ไม่ได้ ' +
          '(ต้องเปิด Maps JavaScript API + Map Tiles API, ผูกบัญชีเรียกเก็บเงิน และอนุญาตโดเมนนี้)</span>' +
          '<div class="btn-row" style="margin-top:8px"><a class="btn sm primary" href="#/map3d?engine=model">🧊 ใช้แผนที่แบบจำลอง</a><button class="btn sm" data-wait="1">รอต่อ</button></div></div>';
        box.querySelector('[data-wait]').onclick = function () { box.remove(); };
        UI.$('#g3d', el).parentNode.appendChild(box);
      }, 20000);

      if (q.tree && App.treeById[q.tree]) { var t0 = App.treeById[q.tree]; Object.assign(map, camFor(t0, -20)); showTree(t0); }
      if (q.month !== undefined) { state.flower = true; state.month = Number(q.month); UI.$('#m3flower', el).checked = true; syncMonth(); draw(); }
      if (q.tour) setTimeout(startTour, 1500);

      function syncMonth() {
        UI.$('#m3month', el).classList.toggle('hidden', !state.flower);
        UI.$('#m3m', el).value = state.month;
        UI.$('#m3mlabel', el).textContent = 'เดือน' + UI.TH_MONTHS_FULL[state.month];
      }
      syncMonth();
      UI.$('#m3route', el).value = state.route;
      UI.$('#m3toggle', el).onclick = function () { UI.$('#m3panel', el).classList.toggle('collapsed'); };
      if (window.innerWidth < 640) UI.$('#m3panel', el).classList.add('collapsed');
      UI.$('#m3color', el).onchange = function (e) { state.color = e.target.value; draw(); };
      UI.$('#m3canopy', el).onchange = function (e) { state.canopy = e.target.checked; draw(); };
      UI.$('#m3flower', el).onchange = function (e) { state.flower = e.target.checked; syncMonth(); draw(); };
      UI.$('#m3m', el).onchange = function (e) { state.month = Number(e.target.value); syncMonth(); draw(); };
      UI.$('#m3m', el).oninput = function (e) { state.month = Number(e.target.value); syncMonth(); };
      UI.$('#m3heat', el).onchange = function (e) { state.heat = e.target.checked; draw(); };
      UI.$('#m3route', el).onchange = function (e) {
        state.route = e.target.value; draw();
        var st = routeStops(state.route);
        if (st.length) map.flyCameraTo({ endCamera: camFor(st[0], -20), durationMillis: 2000 });
      };
      UI.$('#m3tour', el).onclick = startTour;
      UI.$('#m3walk', el).onclick = startWalk;
      UI.$('#m3reset', el).onclick = function () { stopTour(); stopWalk(); homeView(true); };
      UI.$('#m3caption', el).onclick = function (e) {
        if (e.target.closest('[data-close]')) return UI.$('#m3caption', el).classList.add('hidden');
        var o = e.target.closest('[data-orbit]');
        if (o) return map.flyCameraAround({ camera: camFor(App.treeById[o.dataset.orbit]), durationMillis: 12000, repeatCount: 1 });
        var b = e.target.closest('[data-tour]');
        if (!b || !tour) return;
        if (b.dataset.tour === 'stop') stopTour();
        else if (b.dataset.tour === 'next') { try { map.stopCameraAnimation(); } catch (err) { /* ignore */ } nextStop(); }
        else {
          tour.paused = !tour.paused;
          b.textContent = tour.paused ? '▶️ เล่นต่อ' : '⏸️ หยุดชั่วคราว';
          if (tour.paused) { try { map.stopCameraAnimation(); } catch (err) { /* ignore */ } } else { tour.phase = 'orbit'; onAnimationEnd(); }
        }
      };
      UI.$('#m3walkpad', el).onclick = function (e) { var b = e.target.closest('[data-w]'); if (b) walk(b.dataset.w); };
    }).catch(function (e) {
      if (!alive) return;
      UI.toast(e.message + ' — ใช้แผนที่ 3 มิติแบบจำลองแทน', 'error', 7000);
      location.hash = '#/map3d?engine=model';
    }).then(function () {
      return function () {
        alive = false;
        stopTour();
        if (walkKeys) document.removeEventListener('keydown', walkKeys);
        if (map) map.remove();
      };
    });
  };
})();
