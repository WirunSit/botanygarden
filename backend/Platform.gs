/**
 * Platform.gs — ชั้นเดียวที่เรียกบริการของ Google โดยตรง
 * (Sheet / Drive / Cache / Lock / Properties / UrlFetch)
 *
 * ไฟล์อื่นทั้งหมดเรียกผ่าน Platform เท่านั้น ทำให้นำโค้ดหลังบ้านไปทดสอบ
 * ในเบราว์เซอร์ได้ (dev/mock-platform.js ใช้แทนไฟล์นี้)
 */
var Platform = (function () {
  var ss_ = null;

  function ss() {
    if (ss_) return ss_;
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    ss_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!ss_) throw new Error('ไม่พบ Google Sheet — ตั้งค่า SHEET_ID ใน Script Properties หรือสร้างสคริปต์จากเมนู ส่วนขยาย > Apps Script ของชีต');
    return ss_;
  }

  function sheet(name) {
    var sh = ss().getSheetByName(name);
    if (!sh) throw new Error('ไม่พบชีต "' + name + '" — กรุณารันฟังก์ชัน setup() ก่อน');
    return sh;
  }

  function toCell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'object') v = JSON.stringify(v);
    v = String(v);
    if (v.charAt(0) === '=') v = "'" + v; // กันสูตรถูกแทรก
    return v;
  }

  function fromCell(v) {
    if (v instanceof Date) return v.toISOString();
    if (v === null || v === undefined) return '';
    return String(v);
  }

  function rowValues(headers, obj) {
    return headers.map(function (h) { return toCell(obj[h]); });
  }

  function rootFolder() {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('PHOTO_FOLDER_ID');
    if (id) {
      try { return DriveApp.getFolderById(id); } catch (e) { /* โฟลเดอร์ถูกลบ สร้างใหม่ */ }
    }
    var f = DriveApp.createFolder('BuddhamongkolFlora_Photos');
    props.setProperty('PHOTO_FOLDER_ID', f.getId());
    return f;
  }

  return {
    isMock: false,

    readTable: function (name) {
      var values = sheet(name).getDataRange().getValues();
      var headers = (values.shift() || []).map(String);
      var rows = [];
      values.forEach(function (r, i) {
        if (r.every(function (c) { return c === '' || c === null; })) return;
        var o = { _row: i + 2 };
        headers.forEach(function (h, j) { if (h) o[h] = fromCell(r[j]); });
        rows.push(o);
      });
      return { headers: headers, rows: rows };
    },

    appendRow: function (name, headers, obj) {
      this.appendRows(name, headers, [obj]);
    },

    /** เพิ่มแถวท้ายชีต — ตั้งรูปแบบเป็นข้อความก่อนเขียน เพื่อไม่ให้ 001 กลายเป็น 1 หรือวันที่ถูกแปลง */
    appendRows: function (name, headers, objs) {
      var sh = sheet(name);
      var start = sh.getLastRow() + 1;
      var need = start + objs.length - 1 - sh.getMaxRows();
      if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need + 100);
      sh.getRange(start, 1, objs.length, headers.length)
        .setNumberFormat('@')
        .setValues(objs.map(function (o) { return rowValues(headers, o); }));
    },

    writeRow: function (name, headers, row, obj) {
      sheet(name).getRange(row, 1, 1, headers.length).setValues([rowValues(headers, obj)]);
    },

    deleteRow: function (name, row) {
      sheet(name).deleteRow(row);
    },

    replaceTable: function (name, headers, objs) {
      var sh = sheet(name);
      var last = sh.getLastRow();
      if (last > 1) sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), 1)).clearContent();
      if (objs.length) {
        var need = objs.length + 1 - sh.getMaxRows();
        if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need + 100);
        sh.getRange(2, 1, objs.length, headers.length).setNumberFormat('@')
          .setValues(objs.map(function (o) { return rowValues(headers, o); }));
      }
    },

    /** สร้างชีต (ถ้ายังไม่มี) ใส่หัวคอลัมน์ และตั้งรูปแบบเป็นข้อความ เพื่อไม่ให้ 001 กลายเป็น 1 */
    ensureSheet: function (name, headers) {
      var book = ss();
      var sh = book.getSheetByName(name);
      if (!sh) sh = book.insertSheet(name);
      var lastCol = sh.getLastColumn();
      var existing = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
      var missing = headers.filter(function (h) { return existing.indexOf(h) < 0; });
      var all = existing.filter(String).concat(missing);
      if (missing.length || !existing.length) {
        sh.getRange(1, 1, 1, all.length).setValues([all]).setFontWeight('bold').setBackground('#e8f3ec');
      }
      sh.setFrozenRows(1);
      sh.getRange(1, 1, sh.getMaxRows(), Math.max(all.length, 1)).setNumberFormat('@');
      return all;
    },

    cacheGet: function (key) { return CacheService.getScriptCache().get(key); },
    cachePut: function (key, value, seconds) {
      try { CacheService.getScriptCache().put(key, value, seconds); } catch (e) { /* ค่าใหญ่เกิน 100KB ข้ามได้ */ }
    },
    cacheRemove: function (key) { CacheService.getScriptCache().remove(key); },

    prop: function (key) { return PropertiesService.getScriptProperties().getProperty(key); },
    setProp: function (key, value) {
      var p = PropertiesService.getScriptProperties();
      if (value) p.setProperty(key, value); else p.deleteProperty(key);
    },

    sha256Hex: function (str) {
      var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
      return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
    },

    uuid: function () { return Utilities.getUuid(); },

    withLock: function (fn) {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(30000)) throw new Error('ระบบกำลังบันทึกข้อมูลของผู้อื่น กรุณาลองใหม่อีกครั้ง');
      try { return fn(); } finally { lock.releaseLock(); }
    },

    /** สร้างโฟลเดอร์ย่อยในโฟลเดอร์รูปหลัก คืน id */
    createFolder: function (name) {
      return rootFolder().createFolder(name).getId();
    },

    renameFolder: function (folderId, name) {
      try { DriveApp.getFolderById(folderId).setName(name); } catch (e) { /* ไม่สำคัญ */ }
    },

    /** บันทึกไฟล์จาก base64 คืน { id, shared } */
    saveFile: function (folderId, fileName, mime, base64) {
      var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, fileName);
      var folder = folderId ? DriveApp.getFolderById(folderId) : rootFolder();
      var file = folder.createFile(blob);
      var shared = false;
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        shared = true;
      } catch (e) {
        // บางโดเมนโรงเรียนห้ามแชร์ลิงก์สาธารณะ → หน้าเว็บจะโหลดรูปผ่าน API แทน
      }
      return { id: file.getId(), shared: shared };
    },

    trashFile: function (id) {
      try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* ไฟล์หายไปแล้ว */ }
    },

    fileUrls: function (id) {
      return {
        thumb: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w480',
        full: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600'
      };
    },

    fileBase64: function (id) {
      var blob = DriveApp.getFileById(id).getBlob();
      return { mime: blob.getContentType() || 'image/jpeg', data: Utilities.base64Encode(blob.getBytes()) };
    },

    /** เรียก HTTP คืน { code, text } */
    fetch: function (url, options) {
      var opts = Object.assign({ muteHttpExceptions: true }, options || {});
      var res = UrlFetchApp.fetch(url, opts);
      return { code: res.getResponseCode(), text: res.getContentText() };
    },

    /** ส่ง multipart (ใช้กับ Pl@ntNet) — images: [{mime, data(base64), organ}] */
    fetchMultipartImages: function (url, images) {
      // UrlFetchApp สร้าง multipart ให้เองได้ แต่ส่งคีย์ซ้ำ (หลายรูป) ไม่ได้ จึงประกอบเอง
      var boundary = '----bmf' + Utilities.getUuid().replace(/-/g, '');
      var parts = [];
      images.forEach(function (img, i) {
        parts.push(Utilities.newBlob('--' + boundary + '\r\nContent-Disposition: form-data; name="organs"\r\n\r\n' + (img.organ || 'auto') + '\r\n').getBytes());
        parts.push(Utilities.newBlob('--' + boundary + '\r\nContent-Disposition: form-data; name="images"; filename="img' + i + '.jpg"\r\nContent-Type: ' + img.mime + '\r\n\r\n').getBytes());
        parts.push(Utilities.base64Decode(img.data));
        parts.push(Utilities.newBlob('\r\n').getBytes());
      });
      parts.push(Utilities.newBlob('--' + boundary + '--\r\n').getBytes());
      var bytes = [].concat.apply([], parts);
      var res = UrlFetchApp.fetch(url, {
        method: 'post', muteHttpExceptions: true,
        contentType: 'multipart/form-data; boundary=' + boundary,
        payload: bytes
      });
      return { code: res.getResponseCode(), text: res.getContentText() };
    },

    /** ส่งอีเมล (ใช้โควต้า MailApp ของบัญชีครู ~100 ฉบับ/วัน สำหรับบัญชีทั่วไป) */
    sendMail: function (to, subject, body) {
      if (MailApp.getRemainingDailyQuota() < 1) throw new Error('โควต้าส่งอีเมลวันนี้หมดแล้ว');
      MailApp.sendEmail({ to: to, subject: subject, body: body, name: 'พฤกษาพุทธมงคล' });
    },

    now: function () { return new Date(); },

    /** วันที่ตามเวลาไทย yyyy-MM-dd */
    today: function () { return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'); }
  };
})();
