/**
 * sw.js — Service Worker สำหรับโหมดออฟไลน์
 *  - ไฟล์หน้าเว็บ: ดึงจากเน็ตก่อน ถ้าไม่มีเน็ตใช้ฉบับที่เก็บไว้ (ไม่ค้างฉบับเก่าเมื่อครูอัปเดต)
 *  - ไลบรารีจาก CDN / ฟอนต์ / ภาพแผนที่: ใช้ฉบับที่เก็บไว้ก่อน (เร็ว และใช้ได้ตอนออฟไลน์ในบริเวณที่เคยเปิดดู)
 *  - คำขอ API (POST ไป Apps Script) ไม่ผ่าน cache — งานบันทึกตอนออฟไลน์เก็บในกล่องรอส่ง (offline.js)
 */
var SHELL = 'bmf-shell-v2', LIBS = 'bmf-libs-v2', TILES = 'bmf-tiles-v2', MAX_TILES = 3000;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(['./', './index.html']).catch(function () { }); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return [SHELL, LIBS, TILES].indexOf(k) < 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function isTile(url) { return /arcgisonline\.com|tile\.openstreetmap\.org|\/\{?\d+\}?\/\d+\/\d+\.(png|jpg|jpeg|webp)/.test(url); }
function isLib(url) { return /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url); }

function trim(cacheName, max) {
  caches.open(cacheName).then(function (c) {
    c.keys().then(function (keys) { if (keys.length > max) keys.slice(0, keys.length - max).forEach(function (k) { c.delete(k); }); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = req.url;
  if (/script\.google(usercontent)?\.com/.test(url)) return;

  if (isTile(url) || isLib(url)) {
    var name = isTile(url) ? TILES : LIBS;
    e.respondWith(caches.open(name).then(function (c) {
      return c.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) { c.put(req, res.clone()); if (name === TILES) trim(TILES, MAX_TILES); }
          return res;
        });
      });
    }));
    return;
  }

  if (new URL(url).origin === self.location.origin) {
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(SHELL).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match('./index.html'); });
    }));
  }
});
