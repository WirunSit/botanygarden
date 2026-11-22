/**
 * ui.js — ฟังก์ชันช่วยแสดงผล: escape, toast, modal, loading, รูปภาพ, วันที่ไทย
 */
var UI = (function () {
  function esc(v) {
    return v === null || v === undefined ? '' : String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function toast(msg, type, ms) {
    var box = document.getElementById('toasts');
    var t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || (type === 'error' ? 6000 : 3200));
  }

  function error(e) {
    console.error(e);
    toast(e && e.message ? e.message : String(e), 'error');
  }

  var loadingEl = null, loadingCount = 0;
  function loading(on, text) {
    loadingCount = Math.max(0, loadingCount + (on ? 1 : -1));
    if (loadingCount && !loadingEl) {
      loadingEl = document.createElement('div');
      loadingEl.className = 'loading';
      loadingEl.innerHTML = '<div class="spinner"></div><div class="lt"></div>';
      document.body.appendChild(loadingEl);
    }
    if (loadingEl) loadingEl.querySelector('.lt').textContent = text || '';
    if (!loadingCount && loadingEl) { loadingEl.remove(); loadingEl = null; }
  }

  /** ห่อ promise ด้วยหน้าจอโหลด + แจ้งข้อผิดพลาด */
  function busy(promise, text) {
    loading(true, text);
    return promise.then(function (r) { loading(false); return r; }, function (e) { loading(false); throw e; });
  }

  /**
   * modal({ title, body (html), buttons: [{label, cls, value, onClick}], wide, dismiss })
   * คืน Promise ของ value ปุ่มที่กด (ปิดเฉยๆ = null)
   */
  function modal(opts) {
    return new Promise(function (resolve) {
      var bg = document.createElement('div');
      bg.className = 'modal-bg';
      var buttons = opts.buttons || [{ label: 'ปิด', value: null }];
      bg.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '">' +
        (opts.title ? '<h3>' + opts.title + '</h3>' : '') +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        '<div class="btn-row end">' + buttons.map(function (b, i) {
          return '<button class="btn ' + (b.cls || '') + '" data-i="' + i + '">' + b.label + '</button>';
        }).join('') + '</div></div>';
      var close = function (v) { bg.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      var onKey = function (e) { if (e.key === 'Escape' && opts.dismiss !== false) close(null); };
      document.addEventListener('keydown', onKey);
      bg.addEventListener('click', function (e) {
        if (e.target === bg && opts.dismiss !== false) return close(null);
        var btn = e.target.closest('button[data-i]');
        if (!btn || !bg.contains(btn) || btn.closest('.modal-body')) return;
        var b = buttons[+btn.dataset.i];
        if (b.onClick) {
          var r = b.onClick(bg.querySelector('.modal'));
          if (r === false) return;
          if (r && r.then) {
            btn.disabled = true;
            r.then(function (v) { if (v !== false) close(v === undefined ? b.value : v); else btn.disabled = false; },
              function (err) { btn.disabled = false; error(err); });
            return;
          }
          if (r !== undefined) return close(r); // คืนค่าธรรมดา (เช่น ข้อมูลในฟอร์ม) ให้ผู้เรียก
        }
        close(b.value);
      });
      document.body.appendChild(bg);
      if (opts.onOpen) opts.onOpen(bg.querySelector('.modal'));
      var first = bg.querySelector('.modal-body input, .modal-body textarea, .modal-body select');
      if (first && opts.focus !== false) setTimeout(function () { first.focus(); }, 50);
    });
  }

  function confirm(title, body, okLabel, cls) {
    return modal({
      title: title, body: body ? '<p>' + body + '</p>' : '',
      buttons: [{ label: 'ยกเลิก', value: false }, { label: okLabel || 'ตกลง', cls: cls || 'primary', value: true }]
    });
  }

  function lightbox(src) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<img alt=""><button class="btn sm">✕ ปิด</button>';
    lb.querySelector('img').src = src;
    lb.addEventListener('click', function () { lb.remove(); });
    document.body.appendChild(lb);
  }

  // ---------- รูปภาพ ----------
  var proxyCache = {};
  /** สร้าง <img> ของรูป (ถ้ารูปแชร์ลิงก์ไม่ได้ จะโหลดผ่าน API ทีหลัง) */
  function photoImg(p, size, attrs) {
    if (!p) return '';
    var src = size === 'full' ? p.full : p.thumb;
    if (src) return '<img src="' + esc(src) + '" alt="' + esc(p.part) + '" loading="lazy" ' + (attrs || '') + '>';
    return '<img data-proxy="' + esc(p.photo_id) + '" alt="' + esc(p.part) + '" ' + (attrs || '') + '>';
  }
  /** เรียกหลัง render เพื่อโหลดรูปแบบ proxy */
  function hydratePhotos(root) {
    $$('img[data-proxy]', root).forEach(function (img) {
      var id = img.getAttribute('data-proxy');
      img.removeAttribute('data-proxy');
      if (proxyCache[id]) { img.src = proxyCache[id]; return; }
      api('photoData', { photo_id: id }).then(function (r) { proxyCache[id] = r.dataUrl; img.src = r.dataUrl; }).catch(function () { /* ข้าม */ });
    });
  }

  /** ย่อรูปให้ด้านยาวไม่เกิน maxPx แล้วแปลงเป็น JPEG base64 */
  function resizeImage(file, maxPx, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        var dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl: dataUrl, base64: dataUrl.split(',')[1], width: w, height: h, mime: 'image/jpeg' });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('เปิดไฟล์รูปไม่ได้ (รองรับ JPG/PNG)')); };
      img.src = url;
    });
  }

  // ---------- วันที่ ----------
  var TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  function thDate(iso, withTime) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    var s = d.getDate() + ' ' + TH_MONTHS[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2);
    if (withTime) s += ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' น.';
    return s;
  }

  // ---------- สถานะ ----------
  var STATUS_LABEL = {
    draft: 'ร่าง', submitted: 'รอหัวหน้ากลุ่มตรวจ', pending_teacher: 'รอครูตรวจ', returned: 'ส่งกลับแก้ไข',
    verified: 'ครูตรวจแล้ว', archived: 'เก็บถาวร', deleted: 'ลบแล้ว'
  };
  var STATUS_COLOR = {
    draft: '#7a8a80', submitted: '#6b46c1', pending_teacher: '#2b6cb0', returned: '#c27c0e', verified: '#2f855a', archived: '#999'
  };
  var STATUS_ICON = { draft: '📝', submitted: '👀', pending_teacher: '⏳', returned: '↩️', verified: '✅', archived: '📦' };
  function statusPill(s) {
    return '<span class="pill ' + esc(s) + '">' + (STATUS_ICON[s] || '') + ' ' + esc(STATUS_LABEL[s] || s) + '</span>';
  }

  var ROLE_LABEL = { student: 'นักเรียน', leader: 'หัวหน้ากลุ่ม', teacher: 'ครู', admin: 'ผู้ดูแลระบบ' };

  function download(filename, text, mime) {
    var blob = new Blob(['﻿' + text], { type: (mime || 'text/csv') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  var scriptPromises = {};
  function loadScript(src) {
    if (!scriptPromises[src]) {
      scriptPromises[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.onload = resolve;
        s.onerror = function () { delete scriptPromises[src]; reject(new Error('โหลดไลบรารีไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต')); };
        document.head.appendChild(s);
      });
    }
    return scriptPromises[src];
  }

  function fmtNum(n, digits) {
    if (n === null || n === undefined || n === '') return '-';
    return Number(n).toLocaleString('th-TH', { maximumFractionDigits: digits === undefined ? 1 : digits });
  }

  /** อ่านค่าฟอร์มทั้งหมดใน root เป็น object (ใช้ name) */
  function formValues(root) {
    var out = {};
    $$('[name]', root).forEach(function (el) {
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value;
    });
    return out;
  }

  return {
    esc: esc, $: $, $$: $$, toast: toast, error: error, loading: loading, busy: busy, modal: modal, confirm: confirm,
    lightbox: lightbox, photoImg: photoImg, hydratePhotos: hydratePhotos, resizeImage: resizeImage, thDate: thDate,
    TH_MONTHS: TH_MONTHS, TH_MONTHS_FULL: TH_MONTHS_FULL, STATUS_LABEL: STATUS_LABEL, STATUS_COLOR: STATUS_COLOR,
    statusPill: statusPill, ROLE_LABEL: ROLE_LABEL, download: download, loadScript: loadScript, fmtNum: fmtNum,
    formValues: formValues
  };
})();

var esc = UI.esc;
