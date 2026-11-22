/**
 * Photos.gs — อัปโหลดรูปลง Google Drive และจัดการรูป
 */

var PHOTO_PARTS = ['whole', 'bark', 'leaf_top', 'leaf_bottom', 'leaf_arrangement', 'flower',
  'inflorescence', 'fruit', 'seed', 'other',
  // รูปประกอบงานภาคสนาม (ไม่แสดงในแกลเลอรีหลัก)
  'phenology', 'fauna', 'issue', 'herbarium'];
var MAX_PHOTO_BASE64 = 4 * 1024 * 1024; // ~3MB หลังถอดรหัส — หน้าเว็บย่อรูปก่อนส่งอยู่แล้ว

var Photos = {
  /** d = { tree_id, part, data (base64 ไม่มี prefix), mime, taken_at, lat, lng, has_scale } */
  uploadPhoto: function (d, ctx) {
    var t = DB.find('Trees', 'tree_id', d.tree_id);
    if (!t || t.status === STATUS.DELETED) fail('ไม่พบต้นไม้');
    if (t.status === STATUS.ARCHIVED) fail('ต้นนี้ถูกเก็บถาวรแล้ว');
    // นักเรียนทุกคนช่วยเพิ่มรูปให้ต้นใดก็ได้ (ทำงานร่วมกัน) — รูปของคนอื่นรอครูอนุมัติ
    if (PHOTO_PARTS.indexOf(d.part) < 0) fail('ไม่รู้จักส่วนของพืช: ' + d.part);
    var data = String(d.data || '').replace(/^data:[^,]+,/, '');
    if (!data) fail('ไม่มีข้อมูลรูป');
    if (data.length > MAX_PHOTO_BASE64) fail('รูปใหญ่เกินไป กรุณาลองใหม่');
    var mime = /^image\/(jpeg|png|webp)$/.test(d.mime) ? d.mime : 'image/jpeg';

    var folderId = t.drive_folder_id;
    if (!folderId) {
      folderId = Platform.createFolder(t.tree_id + (t.tree_code && t.tree_code.indexOf('TMP') !== 0 ? ' ' + t.tree_code : ''));
      DB.update('Trees', 'tree_id', t.tree_id, { drive_folder_id: folderId });
    }
    var stamp = Platform.today().replace(/-/g, '');
    var ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    var saved = Platform.saveFile(folderId, d.part + '_' + stamp + '_' + ctx.user.user_id + '.' + ext, mime, data);

    var isTeacher = ctx.level >= ROLE_LEVEL.teacher;
    var photo = {
      photo_id: DB.nextId('Photos', 'photo_id', 'P', 5),
      tree_id: t.tree_id, part: d.part, drive_file_id: saved.id, shared: saved.shared,
      taken_at: str(d.taken_at) || nowIso(), lat: num(d.lat) === null ? '' : num(d.lat),
      lng: num(d.lng) === null ? '' : num(d.lng), has_scale: bool(d.has_scale), quality: '',
      uploaded_by: ctx.user.user_id, uploaded_at: nowIso(),
      // รูปของต้นที่ยังไม่อนุมัติ จะถูกอนุมัติพร้อมต้น; รูปเพิ่มเติมของต้นที่อนุมัติแล้วรอครูตรวจ
      approved: isTeacher
    };
    DB.insert('Photos', photo);

    var treePatch = {};
    if (!t.cover_photo_id && d.part === 'whole') treePatch.cover_photo_id = photo.photo_id;
    if (Object.keys(treePatch).length) DB.update('Trees', 'tree_id', t.tree_id, treePatch);

    if (t.status === STATUS.VERIFIED && !isTeacher) {
      addPoints(ctx.user.user_id, num(getSettings().points_photo) || 0);
    }
    logActivity(ctx, 'uploadPhoto', photo.photo_id, { tree_id: t.tree_id, part: d.part });
    return photoOut(photo);
  },

  deletePhoto: function (d, ctx) {
    var p = DB.find('Photos', 'photo_id', d.photo_id);
    if (!p) fail('ไม่พบรูป');
    var t = DB.find('Trees', 'tree_id', p.tree_id);
    var allowed = ctx.level >= ROLE_LEVEL.teacher ||
      (p.uploaded_by === ctx.user.user_id && (canEditTree(t, ctx) || !bool(p.approved)));
    if (!allowed) fail('ลบรูปนี้ไม่ได้');
    Platform.trashFile(p.drive_file_id);
    DB.remove('Photos', 'photo_id', p.photo_id);
    if (t && t.cover_photo_id === p.photo_id) {
      var next = DB.filter('Photos', function (x) { return x.tree_id === t.tree_id; });
      var whole = next.filter(function (x) { return x.part === 'whole'; })[0] || next[0];
      DB.update('Trees', 'tree_id', t.tree_id, { cover_photo_id: whole ? whole.photo_id : '' });
    }
    logActivity(ctx, 'deletePhoto', p.photo_id, { tree_id: p.tree_id });
    return true;
  },

  setCover: function (d, ctx) {
    var p = DB.find('Photos', 'photo_id', d.photo_id);
    if (!p) fail('ไม่พบรูป');
    var t = DB.find('Trees', 'tree_id', p.tree_id);
    if (!canEditTree(t, ctx)) fail('คุณไม่มีสิทธิ์แก้ไขต้นนี้');
    DB.update('Trees', 'tree_id', t.tree_id, { cover_photo_id: p.photo_id });
    return true;
  },

  approvePhoto: function (d, ctx) {
    DB.update('Photos', 'photo_id', d.photo_id, { approved: d.approved !== false });
    logActivity(ctx, 'approvePhoto', d.photo_id);
    return true;
  },

  /** สำหรับรูปที่แชร์ลิงก์สาธารณะไม่ได้ — ส่งรูปเป็น base64 ผ่าน API */
  photoData: function (d, ctx) {
    var p = DB.find('Photos', 'photo_id', d.photo_id);
    if (!p) fail('ไม่พบรูป');
    var t = DB.find('Trees', 'tree_id', p.tree_id);
    if (!canSeeTree(t, ctx) || (!ctx.user && !bool(p.approved))) fail('ไม่มีสิทธิ์ดูรูปนี้');
    var f = Platform.fileBase64(p.drive_file_id);
    return { dataUrl: 'data:' + f.mime + ';base64,' + f.data };
  }
};
