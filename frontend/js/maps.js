/**
 * maps.js — แผนที่ 2D (Leaflet + ภาพดาวเทียม) และการจับพิกัด GPS แบบเฉลี่ยค่า
 */
var Maps = (function () {
  function settingsCenter() {
    var s = (App.boot && App.boot.settings) || {};
    var c = String(s.map_center || '13.7563,100.5018').split(',').map(Number);
    return { center: [c[0] || 13.7563, c[1] || 100.5018], zoom: Number(s.map_zoom) || 18 };
  }

  /** ภาพถ่ายทางอากาศของโรงเรียนเอง (เช่น ภาพออร์โธจากโดรน) ถ้าครูตั้งไว้ */
  function imageryUrl() {
    var u = (App.boot && App.boot.settings && App.boot.settings.imagery_url) || '';
    return /^https:\/\/.+\{z\}.+\{x\}.+\{y\}/.test(u) || /^https:\/\/.+\{z\}.+\{y\}.+\{x\}/.test(u) ? u : '';
  }

  function create(el, opts) {
    opts = opts || {};
    var sc = settingsCenter();
    var map = L.map(el, { zoomControl: true, maxZoom: 21, attributionControl: true, tap: true })
      .setView(opts.center || sc.center, opts.zoom || sc.zoom);
    var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 21, maxNativeZoom: 19, attribution: 'Imagery © Esri'
    });
    var own = imageryUrl();
    var labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 21, maxNativeZoom: 19
    });
    var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 21, maxNativeZoom: 19, attribution: '© OpenStreetMap'
    });
    var satGroup = L.layerGroup([sat, labels]);
    var bases = { 'ภาพดาวเทียม': satGroup, 'แผนที่ถนน': osm };
    var ownLayer = own ? L.tileLayer(own, { maxZoom: 23, maxNativeZoom: 22, attribution: 'ภาพถ่ายทางอากาศของโรงเรียน' }) : null;
    if (ownLayer) bases = Object.assign({ 'ภาพโดรนของโรงเรียน': L.layerGroup([sat, ownLayer]) }, bases);
    (opts.base === 'osm' ? osm : ownLayer ? bases['ภาพโดรนของโรงเรียน'] : satGroup).addTo(map);
    L.control.layers(bases, null, { position: 'topleft' }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    el._bmfMap = map;
    map.invalidateSize();
    // ขนาดกล่องแผนที่อาจเปลี่ยนหลังจัดหน้าเสร็จ (ฟอนต์โหลด, แถบเมนู) → วัดใหม่เมื่อขนาดเปลี่ยน
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { if (map._container) map.invalidateSize(); });
      ro.observe(el);
      map.on('unload', function () { ro.disconnect(); });
    } else {
      setTimeout(function () { map.invalidateSize(); }, 120);
    }
    return map;
  }

  function pinIcon(color, size, html) {
    size = size || 18;
    return L.divIcon({
      className: '',
      html: '<div class="tree-pin" style="width:' + size + 'px;height:' + size + 'px;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:' + Math.round(size * .6) + 'px">' + (html || '') + '</div>',
      iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2]
    });
  }

  function addZones(map, opts) {
    opts = opts || {};
    var group = L.layerGroup().addTo(map);
    var boot = App.boot || {};
    var boundary = null;
    try { boundary = boot.settings && boot.settings.school_boundary ? JSON.parse(boot.settings.school_boundary) : null; } catch (e) { boundary = null; }
    if (boundary && boundary.length >= 3) {
      L.polygon(boundary, { color: '#ffffff', weight: 2, dashArray: '6 6', fill: false, interactive: false }).addTo(group);
    }
    (boot.zones || []).forEach(function (z) {
      if (!z.polygon) return;
      var poly = L.polygon(z.polygon, { color: z.color || '#2f855a', weight: 2, fillOpacity: opts.fill === false ? 0 : .12, interactive: !!opts.labels });
      if (opts.labels) poly.bindTooltip(esc(z.name), { sticky: true });
      poly.addTo(group);
    });
    return group;
  }

  function fitTo(map, latlngs, maxZoom) {
    var pts = latlngs.filter(function (p) { return p && p[0] && p[1]; });
    if (!pts.length) return;
    var fit = function () {
      if (!map._container) return;
      map.invalidateSize();
      // ถ้ากล่องแผนที่ยังไม่มีขนาด (เช่น แท็บถูกซ่อน) รอจนมีขนาดแล้วค่อยจัดมุมมอง
      if (!map.getSize().x) { map.once('resize', fit); return; }
      if (pts.length === 1) map.setView(pts[0], maxZoom || 19);
      else map.fitBounds(L.latLngBounds(pts).pad(.15), { maxZoom: maxZoom || 20 });
    };
    fit();
  }

  function accClass(acc) {
    var s = (App.boot && App.boot.settings) || {};
    var good = Number(s.gps_good_m) || 5, ok = Number(s.gps_ok_m) || 10;
    if (acc === null || acc === undefined) return '';
    return acc <= good ? 'good' : acc <= ok ? 'ok' : 'bad';
  }
  function accText(acc) {
    var c = accClass(acc);
    return c === 'good' ? '🟢 ดีมาก' : c === 'ok' ? '🟡 พอใช้ — แนะนำให้ลากหมุดให้ตรงต้น' : c === 'bad' ? '🔴 ไม่แม่น — ย้ายไปที่โล่งแล้วลองใหม่ หรือลากหมุดเอง' : '';
  }

  /**
   * จับพิกัดหลายวินาทีแล้วเฉลี่ย (ตัดค่าที่คลาดเคลื่อนมากทิ้ง)
   * คืน { promise, stop } — onUpdate(estimate, samples, elapsedRatio)
   */
  function captureGps(opts) {
    var seconds = opts.seconds || 15;
    var samples = [];
    var watchId = null, timer = null, ticker = null, started = Date.now(), done = false;
    var resolveFn, rejectFn;
    var promise = new Promise(function (res, rej) { resolveFn = res; rejectFn = rej; });

    function estimate() {
      if (!samples.length) return null;
      var best = Math.min.apply(null, samples.map(function (s) { return s.acc; }));
      var keep = samples.filter(function (s) { return s.acc <= Math.max(best * 1.5, best + 3); });
      var sw = 0, la = 0, ln = 0;
      keep.forEach(function (s) { var w = 1 / Math.max(s.acc, 1) / Math.max(s.acc, 1); sw += w; la += s.lat * w; ln += s.lng * w; });
      var accs = keep.map(function (s) { return s.acc; }).sort(function (a, b) { return a - b; });
      var alt = keep.filter(function (s) { return s.alt !== null; }).map(function (s) { return s.alt; });
      return {
        lat: Math.round(la / sw * 1e6) / 1e6, lng: Math.round(ln / sw * 1e6) / 1e6,
        accuracy: Math.round(accs[Math.floor(accs.length / 2)] * 10) / 10,
        altitude: alt.length ? Math.round(alt.reduce(function (a, b) { return a + b; }, 0) / alt.length) : null,
        used: keep.length, total: samples.length
      };
    }
    function finish() {
      if (done) return;
      done = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer); clearInterval(ticker);
      var est = estimate();
      if (est) resolveFn(est); else rejectFn(new Error('ยังจับสัญญาณ GPS ไม่ได้ ลองออกไปที่โล่งแล้วกดใหม่ หรือแตะบนแผนที่เพื่อปักหมุดเอง'));
    }

    if (!('geolocation' in navigator)) {
      setTimeout(function () { rejectFn(new Error('อุปกรณ์นี้ไม่รองรับ GPS — แตะบนแผนที่เพื่อปักหมุดเอง')); });
      return { promise: promise, stop: function () { } };
    }
    if (!window.isSecureContext) {
      setTimeout(function () { rejectFn(new Error('GPS ใช้ได้เฉพาะหน้าเว็บ https — แตะบนแผนที่เพื่อปักหมุดเอง')); });
      return { promise: promise, stop: function () { } };
    }
    watchId = navigator.geolocation.watchPosition(function (pos) {
      samples.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, alt: pos.coords.altitude });
      if (opts.onUpdate) opts.onUpdate(estimate(), samples, Math.min(1, (Date.now() - started) / seconds / 1000));
    }, function (err) {
      if (done) return;
      if (err.code === 1) { done = true; clearTimeout(timer); clearInterval(ticker); rejectFn(new Error('ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง — เปิดสิทธิ์ตำแหน่ง (Location) ให้เบราว์เซอร์ แล้วลองใหม่')); }
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    ticker = setInterval(function () {
      if (opts.onUpdate) opts.onUpdate(estimate(), samples, Math.min(1, (Date.now() - started) / seconds / 1000));
    }, 500);
    timer = setTimeout(finish, seconds * 1000);
    return { promise: promise, stop: finish, cancel: function () { done = true; if (watchId !== null) navigator.geolocation.clearWatch(watchId); clearTimeout(timer); clearInterval(ticker); } };
  }

  /** ตำแหน่งปัจจุบันแบบเร็ว (ครั้งเดียว) */
  function locateOnce() {
    return new Promise(function (resolve, reject) {
      if (!('geolocation' in navigator)) return reject(new Error('อุปกรณ์นี้ไม่รองรับ GPS'));
      navigator.geolocation.getCurrentPosition(function (p) {
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
      }, function (e) { reject(new Error(e.code === 1 ? 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง' : 'หาตำแหน่งไม่ได้')); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
    });
  }

  function distanceM(a, b) {
    var R = 6371000, r = Math.PI / 180;
    var dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  return {
    create: create, imageryUrl: imageryUrl, pinIcon: pinIcon, addZones: addZones, fitTo: fitTo, accClass: accClass, accText: accText,
    captureGps: captureGps, locateOnce: locateOnce, distanceM: distanceM
  };
})();
