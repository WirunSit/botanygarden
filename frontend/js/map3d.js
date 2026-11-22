/**
 * map3d.js — แผนที่ 3 มิติ (MapLibre GL JS)
 *  - ต้นไม้เป็นโมเดล 3D ตามความสูง ทรงพุ่ม และเส้นผ่านศูนย์กลางจริง รูปทรงตามลักษณะวิสัย
 *  - อาคารเป็นกล่อง 3D (ครูวาดในหน้า จัดการระบบ → โซน/ขอบเขต)
 *  - โหมด: ปฏิทินดอกไม้ · เส้นทางเรียนรู้ · ความหนาแน่น · ทัวร์อัตโนมัติ · เดินชม (Digital Twin)
 */
(function () {
  var ML_VER = '4.7.1';
  var ML_JS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@' + ML_VER + '/dist/maplibre-gl.js';
  var ML_CSS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@' + ML_VER + '/dist/maplibre-gl.css';
  var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  var DEFAULT_H = { 'ไม้ต้น': 8, 'ไม้พุ่ม': 2, 'ไม้ล้มลุก': 0.6, 'ไม้เลื้อย': 3, 'ไม้รอเลื้อย': 3, 'ปาล์ม': 6, 'ไผ่': 7, 'เฟิร์น': 0.8, 'กล้วยไม้': 0.5 };
  var PALETTE = ['#2f855a', '#d69e2e', '#2b6cb0', '#c53030', '#6b46c1', '#dd6b20', '#319795', '#b83280', '#718096', '#38a169'];
  var HEALTH = { 'ดี': '#38a169', 'ปานกลาง': '#d69e2e', 'มีโรค-แมลง': '#dd6b20', 'ใกล้ตาย': '#c53030', 'ตาย': '#4a5568' };
  var CROWN = '#4c9a2a', TRUNK = '#7a5a3a', DIM = '#a9b8ad';

  function loadCss(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }
  function webglOK() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  }

  // ---------- เรขาคณิต ----------
  function circle(lng, lat, r, n) {
    n = n || 18;
    var pts = [], dLat = r / 111320, dLng = r / (111320 * Math.cos(lat * Math.PI / 180));
    for (var i = 0; i <= n; i++) { var a = i / n * 2 * Math.PI; pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]); }
    return pts;
  }
  function offset(lng, lat, dx, dy) { return [lng + dx / (111320 * Math.cos(lat * Math.PI / 180)), lat + dy / 111320]; }
  function poly(ring, props) { return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: props }; }

  function treeShape(t, sp, color) {
    var habit = sp.habit || 'ไม้ต้น';
    var H = Number(t.height_m) || DEFAULT_H[habit] || 5;
    var R = (Number(t.canopy_m) || Math.max(1, H * (habit === 'ปาล์ม' ? 0.8 : 0.6))) / 2;
    var tr = Math.max(0.12, (Number(t.dbh_cm) || 15) / 200);
    var lng = t.lng, lat = t.lat, out = [];
    var add = function (kind, base, top, r, c, cx, cy) {
      var p = cx === undefined ? [lng, lat] : offset(lng, lat, cx, cy);
      out.push(poly(circle(p[0], p[1], Math.max(0.05, r), kind === 'trunk' ? 10 : 18), { tree_id: t.tree_id, kind: kind, base: base, top: top, color: c }));
    };
    switch (habit) {
      case 'ปาล์ม':
        add('trunk', 0, H - 0.8, Math.max(0.15, tr), TRUNK);
        add('crown', H - 1.6, H - 0.9, R, color); add('crown', H - 0.9, H - 0.4, R * 0.7, color); add('crown', H - 0.4, H, R * 0.3, color);
        break;
      case 'ไผ่':
        for (var k = 0; k < 7; k++) {
          var a = k / 7 * 2 * Math.PI;
          add('crown', 0, H * (0.8 + (k % 3) * 0.1), 0.06, '#9acd32', Math.cos(a) * R * 0.35, Math.sin(a) * R * 0.35);
        }
        add('crown', H * 0.55, H * 0.95, R * 0.8, color);
        break;
      case 'ไม้พุ่ม': case 'ไม้ล้มลุก': case 'เฟิร์น': case 'กล้วยไม้':
        add('crown', 0, H * 0.35, R * 0.85, color); add('crown', H * 0.35, H * 0.75, R, color); add('crown', H * 0.75, H, R * 0.6, color);
        break;
      case 'ไม้เลื้อย': case 'ไม้รอเลื้อย':
        add('trunk', 0, H, 0.1, TRUNK); add('crown', H * 0.3, H, R * 0.6, color);
        break;
      default:
        add('trunk', 0, H * 0.55, tr, TRUNK);
        add('crown', H * 0.35, H * 0.5, R * 0.75, color); add('crown', H * 0.5, H * 0.72, R, color);
        add('crown', H * 0.72, H * 0.9, R * 0.85, color); add('crown', H * 0.9, H, R * 0.5, color);
    }
    return out;
  }

  App.pages.map3d = function (p, q, el) {
    if (!webglOK()) {
      el.innerHTML = '<div style="padding:16px"><div class="alert warn"><span class="ic">🧊</span><div>อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับแผนที่ 3 มิติ (WebGL)</div></div><a class="btn primary" href="#/map">ไปที่แผนที่ 2 มิติ</a></div>';
      return;
    }
    if (!q.force && navigator.deviceMemory && navigator.deviceMemory < 3) {
      el.innerHTML = '<div style="padding:16px"><div class="alert info"><span class="ic">📱</span><div>อุปกรณ์นี้หน่วยความจำน้อย แผนที่ 3 มิติอาจช้า แนะนำแผนที่ 2 มิติ</div></div>' +
        '<div class="btn-row"><a class="btn primary" href="#/map">ใช้แผนที่ 2 มิติ</a><a class="btn" href="#/map3d?force=1">ลองแบบ 3 มิติ</a></div></div>';
      return;
    }
    loadCss(ML_CSS);
    el.innerHTML = '<div class="map-wrap"><div id="map3d" class="map full"></div>' +
      '<div class="m3-panel" id="m3panel"><button class="btn sm m3-toggle" id="m3toggle">☰ เครื่องมือ</button><div class="m3-body">' +
      '<label class="small">🎨 สีต้นไม้<select id="m3color"><option value="natural">ธรรมชาติ</option><option value="family">ตามวงศ์</option><option value="status">ตามสถานะการตรวจ</option><option value="health">ตามสุขภาพ</option></select></label>' +
      '<label class="check small"><input type="checkbox" id="m3flower"> 🌸 ปฏิทินดอกไม้</label>' +
      '<div id="m3month" class="hidden"><input type="range" min="0" max="11" id="m3m" style="width:100%"><div class="small center" id="m3mlabel"></div></div>' +
      '<label class="check small"><input type="checkbox" id="m3heat"> 📊 ความหนาแน่น/จำนวนชนิดต่อโซน</label>' +
      '<label class="small">🚶 เส้นทางเรียนรู้<select id="m3route"><option value="">— ไม่แสดง —</option>' +
      (App.boot.routes || []).map(function (r) { return '<option value="' + esc(r.route_id) + '">' + esc(r.name) + '</option>'; }).join('') + '</select></label>' +
      '<div class="btn-row"><button class="btn sm primary" id="m3tour">👣 ทัวร์อัตโนมัติ</button><button class="btn sm" id="m3walk">🚶 เดินชม</button></div>' +
      '<div class="btn-row"><button class="btn sm" id="m3reset">🧭 มุมมองเริ่มต้น</button><a class="btn sm" href="#/map">🗺️ 2 มิติ</a></div>' +
      '</div></div><div id="m3legend" class="map-legend"></div><div id="m3caption" class="m3-caption hidden"></div><div id="m3walkpad" class="m3-walk hidden"></div>' +
      '<div id="m3loading" class="empty" style="position:absolute;inset:0;z-index:600;background:rgba(255,255,255,.7)"><div class="spinner"></div>กำลังโหลดแผนที่ 3 มิติ…</div></div>';

    var map = null, state = { color: 'natural', flower: false, month: new Date().getMonth(), heat: false, route: q.route || '' };
    var tour = null, walkKeys = null, popup = null, labelMarkers = [];
    var trees = App.boot.trees.filter(function (t) { return t.lat && t.lng && t.status !== 'archived'; });
    var colorOpts = {};
    App.listOpts('color').forEach(function (o) { colorOpts[o.value] = o.icon; });

    function floweringIn(sp, m) {
      if (!sp) return false;
      if (App.hasMonth(sp.flowering_season, UI.TH_MONTHS[m])) return true;
      var o = App.boot.phenology && App.boot.phenology[sp.species_id];
      return !!(o && o.f[m] > 0);
    }
    function treeColor(t, sp, famIdx) {
      if (state.flower) {
        if (!floweringIn(sp, state.month)) return DIM;
        var fc = String(sp.flower_color || '').split(',')[0].trim();
        return colorOpts[fc] || '#f6c945';
      }
      if (state.color === 'family') return sp && sp.family ? famIdx(sp.family) : '#a0aec0';
      if (state.color === 'status') return UI.STATUS_COLOR[t.status] || CROWN;
      if (state.color === 'health') return HEALTH[t.health] || '#a0aec0';
      return CROWN;
    }

    function treeData() {
      var fam = {}, fi = 0, legend = {};
      var famIdx = function (f) { if (!fam[f]) fam[f] = PALETTE[fi++ % PALETTE.length]; return fam[f]; };
      var feats = [];
      trees.forEach(function (t) {
        var sp = App.spOf(t) || {};
        var c = treeColor(t, sp, famIdx);
        var key = state.flower ? (c === DIM ? 'ไม่ออกดอก' : (String(sp.flower_color || 'ออกดอก').split(',')[0])) :
          state.color === 'family' ? (sp.family || 'ไม่ทราบ') : state.color === 'status' ? UI.STATUS_LABEL[t.status] : state.color === 'health' ? (t.health || 'ไม่ระบุ') : null;
        if (key) legend[key] = c;
        feats = feats.concat(treeShape(t, sp, c));
      });
      UI.$('#m3legend', el).innerHTML = Object.keys(legend).slice(0, 10).map(function (k) { return '<div><i style="background:' + legend[k] + '"></i>' + esc(k) + '</div>'; }).join('') +
        '<div class="muted">' + trees.length + ' ต้น' + (state.flower ? ' · ' + UI.TH_MONTHS_FULL[state.month] : '') + '</div>';
      return { type: 'FeatureCollection', features: feats };
    }

    function zoneData() {
      var counts = {};
      App.boot.trees.forEach(function (t) { if (t.status === 'verified' && t.zone_id) (counts[t.zone_id] = counts[t.zone_id] || {})[t.species_id] = 1; });
      return {
        type: 'FeatureCollection', features: (App.boot.zones || []).filter(function (z) { return z.polygon; }).map(function (z) {
          var ring = z.polygon.map(function (pt) { return [pt[1], pt[0]]; });
          ring.push(ring[0]);
          return poly(ring, { name: z.name, color: z.color || '#2f855a', n: counts[z.zone_id] ? Object.keys(counts[z.zone_id]).length : 0 });
        })
      };
    }

    function buildingData() {
      return {
        type: 'FeatureCollection', features: (App.boot.buildings || []).map(function (b) {
          var ring = b.polygon.map(function (pt) { return [pt[1], pt[0]]; });
          ring.push(ring[0]);
          return poly(ring, { name: b.name, height: b.height_m, color: b.color || '#e2e8f0' });
        })
      };
    }

    function routeStops(id) {
      var r = (App.boot.routes || []).filter(function (x) { return x.route_id === id; })[0];
      return r ? r.tree_ids.map(function (tid) { return App.treeById[tid]; }).filter(function (t) { return t && t.lat; }) : [];
    }

    function routeData() {
      var stops = state.route ? routeStops(state.route) : [];
      var feats = stops.length > 1 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: stops.map(function (t) { return [t.lng, t.lat]; }) }, properties: {} }] : [];
      return { type: 'FeatureCollection', features: feats };
    }

    function routeMarkers() {
      labelMarkers.forEach(function (m) { m.remove(); });
      labelMarkers = [];
      routeStops(state.route).forEach(function (t, i) {
        var d = document.createElement('div');
        d.className = 'm3-stop';
        d.textContent = i + 1;
        d.title = App.treeName(t);
        d.onclick = function () { showTree(t); };
        labelMarkers.push(new maplibregl.Marker({ element: d }).setLngLat([t.lng, t.lat]).addTo(map));
      });
    }

    function refresh() {
      if (!map || !map.getSource('trees')) return;
      map.getSource('trees').setData(treeData());
      map.getSource('route').setData(routeData());
      routeMarkers();
      map.setLayoutProperty('heat', 'visibility', state.heat ? 'visible' : 'none');
      map.setPaintProperty('zones-fill', 'fill-opacity', state.heat ? 0.45 : 0.08);
      map.setPaintProperty('zones-fill', 'fill-color', state.heat
        ? ['interpolate', ['linear'], ['get', 'n'], 0, '#fff5f5', 2, '#fbd38d', 5, '#68d391', 10, '#2f855a']
        : ['get', 'color']);
    }

    function showTree(t) {
      var sp = App.spOf(t) || {};
      if (popup) popup.remove();
      popup = new maplibregl.Popup({ offset: 12, maxWidth: '260px' }).setLngLat([t.lng, t.lat]).setHTML(
        (t.cover ? UI.photoImg(t.cover) : '') + '<b>' + esc(App.treeName(t)) + '</b><br>' + (sp.scientific_name ? '<i>' + esc(sp.scientific_name) + '</i><br>' : '') +
        '<span class="code-tag">' + esc(t.tree_code) + '</span><br><span class="small">สูง ' + (t.height_m || '?') + ' ม. · ทรงพุ่ม ' + (t.canopy_m || '?') + ' ม.</span><br>' +
        '<a href="#/tree/' + esc(t.tree_id) + '">ดูรายละเอียด ›</a>').addTo(map);
      UI.hydratePhotos(popup.getElement());
    }

    function homeView(animate) {
      var pts = trees.map(function (t) { return [t.lng, t.lat]; });
      if (pts.length > 1) {
        var b = pts.reduce(function (bb, pt) { return bb.extend(pt); }, new maplibregl.LngLatBounds(pts[0], pts[0]));
        map.fitBounds(b, { padding: 60, pitch: 60, bearing: -20, maxZoom: 19.5, duration: animate ? 1500 : 0 });
      }
    }

    // ---------- ทัวร์อัตโนมัติ ----------
    function startTour() {
      stopWalk();
      var stops = state.route ? routeStops(state.route) : App.boot.trees.filter(function (t) { return t.status === 'verified' && t.lat; })
        .sort(function (a, b) { return String(a.zone_id).localeCompare(String(b.zone_id)) || a.lat - b.lat; });
      if (!stops.length) return UI.toast('ยังไม่มีต้นไม้ที่ผ่านการตรวจสำหรับทัวร์', 'warn');
      tour = { stops: stops, i: -1, paused: false, timer: null };
      UI.$('#m3panel', el).classList.add('collapsed');
      nextStop();
    }
    function nextStop() {
      if (!tour) return;
      clearTimeout(tour.timer);
      tour.i = (tour.i + 1) % tour.stops.length;
      var t = tour.stops[tour.i], sp = App.spOf(t) || {};
      map.flyTo({ center: [t.lng, t.lat], zoom: 20.2, pitch: 65, bearing: (map.getBearing() + 55) % 360, duration: 3500, essential: true });
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
      map.once('moveend', function () { if (tour && !tour.paused) tour.timer = setTimeout(nextStop, 6000); });
    }
    function stopTour() {
      if (!tour) return;
      clearTimeout(tour.timer);
      tour = null;
      UI.$('#m3caption', el).classList.add('hidden');
    }

    // ---------- เดินชม (มุมมองระดับสายตา) ----------
    function startWalk() {
      stopTour();
      var c = map.getCenter();
      map.easeTo({ center: c, zoom: 20.8, pitch: 82, duration: 1200 });
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
      UI.toast('🚶 ใช้ปุ่มลูกศรเพื่อเดิน/หมุนมุมมอง (บนคอมพิวเตอร์ใช้คีย์ลูกศร หรือ W A S D)', '', 5000);
    }
    function walk(k) {
      if (k === 'x') return stopWalk();
      if (k === 'l' || k === 'r') return map.easeTo({ bearing: map.getBearing() + (k === 'l' ? -25 : 25), duration: 300 });
      var b = map.getBearing() * Math.PI / 180, d = k === 'f' ? 4 : -4, c = map.getCenter();
      map.easeTo({ center: offset(c.lng, c.lat, Math.sin(b) * d, Math.cos(b) * d), duration: 300 });
    }
    function stopWalk() {
      if (!walkKeys) return;
      document.removeEventListener('keydown', walkKeys);
      walkKeys = null;
      UI.$('#m3walkpad', el).classList.add('hidden');
      map.easeTo({ pitch: 60, zoom: 19, duration: 800 });
    }

    return UI.loadScript(ML_JS).then(function () {
      if (!UI.$('#map3d', el)) return;
      var center = (App.boot.settings.map_center || '13.7563,100.5018').split(',').map(Number);
      var own = Maps.imageryUrl();
      var style = {
        version: 8,
        sources: { esri: { type: 'raster', tiles: [ESRI], tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri' } },
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dfe8e2' } }, { id: 'esri', type: 'raster', source: 'esri' }]
      };
      if (own) {
        style.sources.own = { type: 'raster', tiles: [own], tileSize: 256, maxzoom: 22, attribution: 'ภาพถ่ายทางอากาศของโรงเรียน' };
        style.layers.push({ id: 'own', type: 'raster', source: 'own' });
      }
      map = new maplibregl.Map({
        container: UI.$('#map3d', el), style: style, center: [center[1], center[0]], zoom: Number(App.boot.settings.map_zoom) || 18,
        pitch: 60, bearing: -20, maxPitch: 85, maxZoom: 22, antialias: true, attributionControl: { compact: true }
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
      el._bmfMap3d = map;
      var ro = window.ResizeObserver ? new ResizeObserver(function () { map.resize(); }) : null;
      if (ro) ro.observe(UI.$('#map3d', el));

      map.on('load', function () {
        UI.$('#m3loading', el).remove();
        map.addSource('zones', { type: 'geojson', data: zoneData() });
        map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.08 } });
        map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': ['get', 'color'], 'line-width': 2 } });
        map.addSource('heatpts', { type: 'geojson', data: { type: 'FeatureCollection', features: App.boot.trees.filter(function (t) { return t.lat && t.status === 'verified'; }).map(function (t) {
          return { type: 'Feature', geometry: { type: 'Point', coordinates: [t.lng, t.lat] }, properties: {} };
        }) } });
        map.addLayer({ id: 'heat', type: 'heatmap', source: 'heatpts', layout: { visibility: 'none' },
          paint: { 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 15, 15, 20, 60], 'heatmap-opacity': 0.7 } });
        map.addSource('buildings', { type: 'geojson', data: buildingData() });
        map.addLayer({ id: 'buildings', type: 'fill-extrusion', source: 'buildings',
          paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.92 } });
        map.addSource('route', { type: 'geojson', data: routeData() });
        map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#f6e05e', 'line-width': 5, 'line-dasharray': [1.5, 1] } });
        map.addSource('trees', { type: 'geojson', data: treeData() });
        map.addLayer({ id: 'trees', type: 'fill-extrusion', source: 'trees',
          paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'top'], 'fill-extrusion-opacity': 0.96 } });
        (App.boot.buildings || []).forEach(function (b) {
          var la = 0, ln = 0;
          b.polygon.forEach(function (pt) { la += pt[0]; ln += pt[1]; });
          var d = document.createElement('div');
          d.className = 'm3-blabel';
          d.textContent = '🏫 ' + b.name;
          new maplibregl.Marker({ element: d }).setLngLat([ln / b.polygon.length, la / b.polygon.length]).addTo(map);
        });
        map.on('click', 'trees', function (e) {
          var t = App.treeById[e.features[0].properties.tree_id];
          if (t) showTree(t);
        });
        map.on('mouseenter', 'trees', function () { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'trees', function () { map.getCanvas().style.cursor = ''; });
        refresh();
        if (q.tree && App.treeById[q.tree]) {
          var t = App.treeById[q.tree];
          map.jumpTo({ center: [t.lng, t.lat], zoom: 19.2, pitch: 60, bearing: -20 });
          showTree(t);
        } else homeView(false);
        if (q.month !== undefined) { state.flower = true; state.month = Number(q.month); UI.$('#m3flower', el).checked = true; syncMonth(); refresh(); }
        if (q.tour) setTimeout(startTour, 800);
      });

      // ---------- เครื่องมือ ----------
      function syncMonth() {
        UI.$('#m3month', el).classList.toggle('hidden', !state.flower);
        UI.$('#m3m', el).value = state.month;
        UI.$('#m3mlabel', el).textContent = 'เดือน' + UI.TH_MONTHS_FULL[state.month];
      }
      syncMonth();
      UI.$('#m3route', el).value = state.route;
      UI.$('#m3toggle', el).onclick = function () { UI.$('#m3panel', el).classList.toggle('collapsed'); };
      if (window.innerWidth < 640) UI.$('#m3panel', el).classList.add('collapsed');
      UI.$('#m3color', el).onchange = function (e) { state.color = e.target.value; refresh(); };
      UI.$('#m3flower', el).onchange = function (e) { state.flower = e.target.checked; syncMonth(); refresh(); };
      UI.$('#m3m', el).oninput = function (e) { state.month = Number(e.target.value); syncMonth(); refresh(); };
      UI.$('#m3heat', el).onchange = function (e) { state.heat = e.target.checked; refresh(); };
      UI.$('#m3route', el).onchange = function (e) {
        state.route = e.target.value; refresh();
        var st = routeStops(state.route);
        if (st.length > 1) {
          var b = st.reduce(function (bb, t) { return bb.extend([t.lng, t.lat]); }, new maplibregl.LngLatBounds([st[0].lng, st[0].lat], [st[0].lng, st[0].lat]));
          map.fitBounds(b, { padding: 80, pitch: 60, maxZoom: 19.5 });
        }
      };
      UI.$('#m3tour', el).onclick = startTour;
      UI.$('#m3walk', el).onclick = startWalk;
      UI.$('#m3reset', el).onclick = function () { stopTour(); stopWalk(); homeView(true); };
      UI.$('#m3caption', el).onclick = function (e) {
        var b = e.target.closest('[data-tour]');
        if (!b || !tour) return;
        if (b.dataset.tour === 'stop') stopTour();
        else if (b.dataset.tour === 'next') nextStop();
        else {
          tour.paused = !tour.paused;
          b.textContent = tour.paused ? '▶️ เล่นต่อ' : '⏸️ หยุดชั่วคราว';
          clearTimeout(tour.timer);
          if (!tour.paused) tour.timer = setTimeout(nextStop, 1500);
        }
      };
      UI.$('#m3walkpad', el).onclick = function (e) { var b = e.target.closest('[data-w]'); if (b) walk(b.dataset.w); };

      return function () {
        stopTour();
        if (walkKeys) document.removeEventListener('keydown', walkKeys);
        if (ro) ro.disconnect();
        map.remove();
      };
    });
  };
})();
