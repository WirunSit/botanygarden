/**
 * Code.gs — จุดรับคำขอ (doGet / doPost) และตัวกระจายคำสั่ง (router)
 *
 * ทุกคำขอ: { action, token, data } → ตอบ { ok, data, error }
 */

/** min = ระดับสิทธิ์ขั้นต่ำ (0 guest, 1 student, 2 leader, 3 teacher, 4 admin), write = ต้องล็อกขณะเขียน */
function getRoutes() {
  return {
    bootstrap: { min: 0, fn: Plants.bootstrap },
    login: { min: 0, fn: Auth.login, write: true },
    setPassword: { min: 0, fn: Auth.setPassword, write: true },
    logout: { min: 0, fn: Auth.logout },
    requestReset: { min: 0, fn: Auth.requestReset, write: true },
    resetWithCode: { min: 0, fn: Auth.resetWithCode, write: true },
    me: { min: 1, fn: Auth.me },

    getTree: { min: 0, fn: Plants.getTree },
    getSpecies: { min: 0, fn: Plants.getSpecies },
    checkNearby: { min: 1, fn: Plants.checkNearby },
    saveDraft: { min: 1, fn: Plants.saveDraft, write: true },
    submit: { min: 1, fn: Plants.submit, write: true },
    deleteDraft: { min: 1, fn: Plants.deleteDraft, write: true },
    archiveTree: { min: 3, fn: Plants.archiveTree, write: true },
    saveSpecies: { min: 1, fn: Plants.saveSpecies, write: true },
    mergeSpecies: { min: 3, fn: Plants.mergeSpecies, write: true },

    uploadPhoto: { min: 1, fn: Photos.uploadPhoto, write: true },
    deletePhoto: { min: 1, fn: Photos.deletePhoto, write: true },
    setCover: { min: 1, fn: Photos.setCover, write: true },
    approvePhoto: { min: 3, fn: Photos.approvePhoto, write: true },
    photoData: { min: 0, fn: Photos.photoData },

    aiIdentify: { min: 1, fn: AI.aiIdentify, write: true },
    aiSearch: { min: 0, fn: AI.aiSearch, write: true },
    aiDescribe: { min: 1, fn: AI.aiDescribe, write: true },
    aiIdentifyImages: { min: 0, fn: AI.aiIdentifyImages, write: true },
    aiChat: { min: 0, fn: AI.aiChat, write: true },

    addPhenology: { min: 1, fn: Field.addPhenology, write: true },
    deletePhenology: { min: 1, fn: Field.deletePhenology, write: true },
    addMeasurement: { min: 1, fn: Field.addMeasurement, write: true },
    reportIssue: { min: 1, fn: Field.reportIssue, write: true },
    resolveIssue: { min: 3, fn: Field.resolveIssue, write: true },
    listIssues: { min: 3, fn: Field.listIssues },
    addCare: { min: 1, fn: Field.addCare, write: true },
    addFauna: { min: 1, fn: Field.addFauna, write: true },
    deleteFauna: { min: 1, fn: Field.deleteFauna, write: true },
    saveSpecimen: { min: 1, fn: Field.saveSpecimen, write: true },
    deleteSpecimen: { min: 1, fn: Field.deleteSpecimen, write: true },
    listSpecimens: { min: 0, fn: Field.listSpecimens },

    adminRoutes: { min: 3, fn: Content.adminRoutes, write: true },
    adminMissions: { min: 3, fn: Content.adminMissions, write: true },
    adminBuildings: { min: 4, fn: Content.adminBuildings, write: true },

    reviewQueue: { min: 2, fn: Review.reviewQueue },
    review: { min: 2, fn: Review.review, write: true },
    bulkApprove: { min: 3, fn: Review.bulkApprove, write: true },

    adminUsers: { min: 4, fn: Admin.adminUsers, write: true },
    adminImport: { min: 4, fn: Admin.adminImport, write: true },
    adminSettings: { min: 4, fn: Admin.adminSettings, write: true },
    adminZones: { min: 4, fn: Admin.adminZones, write: true },
    adminLists: { min: 4, fn: Admin.adminLists, write: true },
    stats: { min: 0, fn: Admin.stats },
    aiLogList: { min: 3, fn: Admin.aiLogList },
    exportCsv: { min: 3, fn: Reports.exportCsv }
  };
}

/** สร้างชีต/คอลัมน์/ตัวเลือกที่เพิ่มในเวอร์ชันใหม่ให้อัตโนมัติ (ครูไม่ต้องรัน setup ซ้ำหลังอัปเดตโค้ด) */
function ensureSchema() {
  var current = '';
  try { current = getSettings().schema_version; } catch (e) { current = ''; }
  if (current === SCHEMA_VERSION) return;
  Platform.withLock(function () {
    DB.reset();
    bustCache();
    var again = '';
    try { again = getSettings().schema_version; } catch (e) { again = ''; }
    if (again !== SCHEMA_VERSION) setupCore();
  });
  DB.reset();
}

function handleRequest(req) {
  try {
    DB.reset();
    ensureSchema();
    req = req || {};
    var route = getRoutes()[req.action];
    if (!route) fail('ไม่รู้จักคำสั่ง: ' + req.action);
    var run = function () {
      var ctx = Auth.context(req.token);
      requireLevel(ctx, route.min);
      return route.fn(req.data || {}, ctx);
    };
    var data = route.write ? Platform.withLock(run) : run();
    if (route.write) Platform.cacheRemove('boot_public');
    return { ok: true, data: data };
  } catch (err) {
    var msg = String(err && err.message ? err.message : err);
    if (!Platform.isMock) console.error(req && req.action, msg, err && err.stack);
    return { ok: false, error: msg };
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** หน้าเว็บแยก (GitHub Pages ฯลฯ) ส่ง POST แบบ text/plain มาที่นี่ */
function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return jsonOut({ ok: false, error: 'คำขอไม่ถูกต้อง' }); }
  return jsonOut(handleRequest(req));
}

/** เปิด URL ของ Web App ตรงๆ → แสดงหน้าเว็บ (ทางเลือก A) หรือ ?action=... → API แบบ GET */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action) {
    var data = {};
    try { data = p.data ? JSON.parse(p.data) : {}; } catch (err) { data = {}; }
    return jsonOut(handleRequest({ action: p.action, token: p.token, data: data }));
  }
  ensureSchema(); // ติดตั้งครั้งแรก: สร้างชีตให้อัตโนมัติแม้ยังไม่ได้รัน setup()
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(getSettings().system_name || 'พฤกษาพุทธมงคล')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** เรียกจากหน้าเว็บที่รันใน Apps Script ผ่าน google.script.run */
function apiRun(reqJson) {
  return JSON.stringify(handleRequest(JSON.parse(reqJson)));
}
