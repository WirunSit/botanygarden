/**
 * Field.gs — งานติดตามภาคสนาม: ชีพลักษณ์ (H3), การเติบโต/สุขภาพ/การดูแล/แจ้งปัญหา (H4),
 * สิ่งมีชีวิตที่พบร่วม (H6), พิพิธภัณฑ์พืชดิจิทัล (H12)
 */

var PHENO_FIELDS = ['new_leaf', 'leaf_fall', 'flower_bud', 'flowering', 'fruiting', 'ripe_fruit'];
var PHENO_LEVELS = ['ไม่มี', 'น้อย', 'ปานกลาง', 'มาก'];

function fieldTree(treeId, ctx, allowArchived) {
  var t = DB.find('Trees', 'tree_id', treeId);
  if (!t || t.status === STATUS.DELETED) fail('ไม่พบต้นไม้');
  if (!allowArchived && t.status === STATUS.ARCHIVED) fail('ต้นนี้ถูกเก็บถาวรแล้ว');
  if (!canSeeTree(t, ctx)) fail('ไม่พบต้นไม้');
  return t;
}

function checkPhoto(photoId, treeId) {
  if (!photoId) return '';
  var p = DB.find('Photos', 'photo_id', photoId);
  if (!p || p.tree_id !== treeId) fail('รูปไม่ตรงกับต้นไม้นี้');
  return p.photo_id;
}

function validDate(d) {
  d = str(d) || Platform.today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) fail('รูปแบบวันที่ไม่ถูกต้อง');
  if (d > Platform.today()) fail('วันที่ต้องไม่เป็นวันในอนาคต');
  return d;
}

function ownerOrTeacher(row, field, ctx) {
  return ctx.level >= ROLE_LEVEL.teacher || (ctx.user && row[field] === ctx.user.user_id);
}

/** ข้อมูลภาคสนามของต้นหนึ่ง (ใช้ใน getTree) */
function treeFieldData(t, ctx, users) {
  var name = function (id) { return displayName(id, ctx, users); };
  var byTree = function (sheet) { return DB.filter(sheet, function (r) { return r.tree_id === t.tree_id; }); };
  var sortDate = function (a, b) { return String(b.date || b.reported_at || b.collected_at).localeCompare(String(a.date || a.reported_at || a.collected_at)); };
  var out = {
    phenology: byTree('Phenology').sort(sortDate).map(function (r) {
      return Object.assign(pick(r, SCHEMA.Phenology), { recorded_by_name: name(r.recorded_by), can_delete: ownerOrTeacher(r, 'recorded_by', ctx) });
    }),
    measurements: byTree('Measurements').sort(sortDate).map(function (r) {
      var o = pick(r, SCHEMA.Measurements);
      ['height_m', 'gbh_cm', 'dbh_cm', 'canopy_m'].forEach(function (k) { o[k] = num(r[k]); });
      o.recorded_by_name = name(r.recorded_by);
      return o;
    }),
    care: byTree('CareLog').sort(sortDate).map(function (r) { return Object.assign(pick(r, SCHEMA.CareLog), { recorded_by_name: name(r.recorded_by) }); }),
    fauna: byTree('Fauna').sort(function (a, b) { return String(b.recorded_at).localeCompare(String(a.recorded_at)); }).map(function (r) {
      return Object.assign(pick(r, SCHEMA.Fauna), { recorded_by_name: name(r.recorded_by), can_delete: ownerOrTeacher(r, 'recorded_by', ctx) });
    }),
    specimens: byTree('Herbarium').sort(sortDate).map(function (r) { return Object.assign(pick(r, SCHEMA.Herbarium), { created_by_name: name(r.created_by) }); }),
    issues: []
  };
  if (ctx.user) {
    out.issues = byTree('Issues').sort(sortDate).map(function (r) {
      return Object.assign(pick(r, SCHEMA.Issues), { reported_by_name: name(r.reported_by), resolved_by_name: name(r.resolved_by) });
    });
  }
  return out;
}

/** สรุปชีพลักษณ์รายชนิด: จำนวนครั้งที่พบดอก/ผลในแต่ละเดือน (ใช้ทำปฏิทินพรรณไม้อัตโนมัติ) */
function phenologySummary() {
  var treeSp = {};
  DB.all('Trees').forEach(function (t) { if (t.status === STATUS.VERIFIED) treeSp[t.tree_id] = t.species_id; });
  var out = {};
  DB.all('Phenology').forEach(function (r) {
    var sp = treeSp[r.tree_id];
    if (!sp || sp === 'UNKNOWN') return;
    var m = parseInt(String(r.date).slice(5, 7), 10) - 1;
    if (!(m >= 0 && m < 12)) return;
    var s = out[sp] = out[sp] || { f: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], r: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], l: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], n: 0 };
    s.n++;
    var has = function (k) { return r[k] && r[k] !== 'ไม่มี'; };
    if (has('flowering') || has('flower_bud')) s.f[m]++;
    if (has('fruiting') || has('ripe_fruit')) s.r[m]++;
    if (has('new_leaf')) s.l[m]++;
  });
  return out;
}

var Field = {
  addPhenology: function (d, ctx) {
    var t = fieldTree(d.tree_id, ctx);
    var rec = {
      record_id: DB.nextId('Phenology', 'record_id', 'PH', 5), tree_id: t.tree_id, date: validDate(d.date),
      photo_id: checkPhoto(d.photo_id, t.tree_id), note: str(d.note).slice(0, 500), recorded_by: ctx.user.user_id, created_at: nowIso()
    };
    var any = false;
    PHENO_FIELDS.forEach(function (k) {
      var v = str(d[k]) || 'ไม่มี';
      if (PHENO_LEVELS.indexOf(v) < 0) fail('ค่าระดับไม่ถูกต้อง: ' + v);
      rec[k] = v;
      if (v !== 'ไม่มี') any = true;
    });
    var dup = DB.filter('Phenology', function (r) { return r.tree_id === t.tree_id && r.date === rec.date && r.recorded_by === ctx.user.user_id; });
    if (dup.length) fail('คุณบันทึกต้นนี้ในวันนี้แล้ว');
    DB.insert('Phenology', rec);
    addPoints(ctx.user.user_id, num(getSettings().points_phenology) || 0);
    // เหรียญ "นักบันทึกฤดูกาล": บันทึกครบ 6 เดือนที่ต่างกัน
    var months = {};
    DB.filter('Phenology', function (r) { return r.recorded_by === ctx.user.user_id; }).forEach(function (r) { months[String(r.date).slice(0, 7)] = 1; });
    if (Object.keys(months).length >= 6 && !DB.filter('Badges', function (b) { return b.user_id === ctx.user.user_id && b.badge === 'นักบันทึกฤดูกาล'; }).length) {
      DB.insert('Badges', { user_id: ctx.user.user_id, badge: 'นักบันทึกฤดูกาล', earned_at: nowIso() });
    }
    logActivity(ctx, 'addPhenology', t.tree_id, { any: any });
    return rec;
  },

  deletePhenology: function (d, ctx) {
    var r = DB.find('Phenology', 'record_id', d.record_id);
    if (!r) fail('ไม่พบรายการ');
    if (!ownerOrTeacher(r, 'recorded_by', ctx)) fail('ลบได้เฉพาะรายการของตัวเอง');
    DB.remove('Phenology', 'record_id', r.record_id);
    logActivity(ctx, 'deletePhenology', r.tree_id);
    return true;
  },

  /** วัดซ้ำ (ทุกภาคเรียน) — ค่าล่าสุดจะอัปเดตข้อมูลปัจจุบันของต้น */
  addMeasurement: function (d, ctx) {
    var t = fieldTree(d.tree_id, ctx);
    var h = num(d.height_m), g = num(d.gbh_cm), c = num(d.canopy_m);
    if (h === null && g === null && c === null && !str(d.health)) fail('กรอกค่าที่วัดได้อย่างน้อย 1 ค่า');
    if ((h !== null && (h < 0 || h > 80)) || (g !== null && (g < 0 || g > 2000)) || (c !== null && (c < 0 || c > 80))) fail('ค่าที่วัดผิดปกติ ตรวจสอบหน่วยอีกครั้ง');
    var date = validDate(d.date);
    var rec = {
      measure_id: DB.nextId('Measurements', 'measure_id', 'M', 5), tree_id: t.tree_id, date: date,
      height_m: h === null ? '' : h, gbh_cm: g === null ? '' : g, dbh_cm: g === null ? '' : Math.round(g / Math.PI * 10) / 10,
      canopy_m: c === null ? '' : c, health: str(d.health), note: str(d.note).slice(0, 500), recorded_by: ctx.user.user_id, created_at: nowIso()
    };
    DB.insert('Measurements', rec);
    var latest = DB.filter('Measurements', function (r) { return r.tree_id === t.tree_id; })
      .every(function (r) { return String(r.date) <= date; });
    if (latest) {
      var patch = { updated_at: nowIso() };
      if (h !== null) patch.height_m = h;
      if (g !== null) { patch.gbh_cm = g; patch.dbh_cm = rec.dbh_cm; }
      if (c !== null) patch.canopy_m = c;
      if (rec.health) patch.health = rec.health;
      DB.update('Trees', 'tree_id', t.tree_id, patch);
    }
    logActivity(ctx, 'addMeasurement', t.tree_id, rec);
    return rec;
  },

  reportIssue: function (d, ctx) {
    var t = fieldTree(d.tree_id, ctx, true);
    if (!str(d.type)) fail('เลือกประเภทปัญหา');
    var rec = {
      issue_id: DB.nextId('Issues', 'issue_id', 'IS', 4), tree_id: t.tree_id, type: str(d.type), description: str(d.description).slice(0, 1000),
      photo_id: checkPhoto(d.photo_id, t.tree_id), status: 'open', reported_by: ctx.user.user_id, reported_at: nowIso()
    };
    DB.insert('Issues', rec);
    logActivity(ctx, 'reportIssue', t.tree_id, { type: rec.type });
    return rec;
  },

  resolveIssue: function (d, ctx) {
    var r = DB.find('Issues', 'issue_id', d.issue_id);
    if (!r) fail('ไม่พบรายการ');
    var reopen = !!d.reopen;
    DB.update('Issues', 'issue_id', r.issue_id, reopen
      ? { status: 'open', resolved_by: '', resolved_at: '', resolution: '' }
      : { status: 'resolved', resolved_by: ctx.user.user_id, resolved_at: nowIso(), resolution: str(d.resolution).slice(0, 1000) });
    if (!reopen && str(d.care_type)) {
      DB.insert('CareLog', { care_id: DB.nextId('CareLog', 'care_id', 'C', 5), tree_id: r.tree_id, date: Platform.today(), type: str(d.care_type),
        note: 'แก้ปัญหา ' + r.issue_id + ': ' + str(d.resolution), recorded_by: ctx.user.user_id, created_at: nowIso() });
    }
    logActivity(ctx, reopen ? 'reopenIssue' : 'resolveIssue', r.tree_id, { issue: r.issue_id });
    return true;
  },

  listIssues: function (d, ctx) {
    var spIdx = {}, treeIdx = {}, users = usersIndex(), photos = {};
    DB.all('Species').forEach(function (s) { spIdx[s.species_id] = s; });
    DB.all('Trees').forEach(function (t) { treeIdx[t.tree_id] = t; });
    DB.all('Photos').forEach(function (p) { photos[p.photo_id] = p; });
    return DB.filter('Issues', function (r) { return d.all || r.status === 'open'; })
      .sort(function (a, b) { return String(b.reported_at).localeCompare(String(a.reported_at)); })
      .map(function (r) {
        var t = treeIdx[r.tree_id] || {}, sp = spIdx[t.species_id] || {};
        return Object.assign(pick(r, SCHEMA.Issues), {
          tree_code: t.tree_code, tree_name: sp.thai_name || 'ยังไม่ทราบชนิด', zone_id: t.zone_id,
          reported_by_name: displayName(r.reported_by, ctx, users), photo: photos[r.photo_id] ? photoOut(photos[r.photo_id]) : null
        });
      });
  },

  addCare: function (d, ctx) {
    var t = fieldTree(d.tree_id, ctx);
    if (!str(d.type)) fail('เลือกประเภทการดูแล');
    var rec = { care_id: DB.nextId('CareLog', 'care_id', 'C', 5), tree_id: t.tree_id, date: validDate(d.date), type: str(d.type),
      note: str(d.note).slice(0, 500), recorded_by: ctx.user.user_id, created_at: nowIso() };
    DB.insert('CareLog', rec);
    logActivity(ctx, 'addCare', t.tree_id, { type: rec.type });
    return rec;
  },

  addFauna: function (d, ctx) {
    var t = fieldTree(d.tree_id, ctx);
    if (!str(d.type)) fail('เลือกประเภทสิ่งมีชีวิต');
    if (!str(d.name)) fail('กรอกชื่อ (ถ้าไม่รู้ชื่อ ให้บรรยายสั้นๆ เช่น "ผีเสื้อสีเหลืองตัวเล็ก")');
    var rec = { fauna_id: DB.nextId('Fauna', 'fauna_id', 'F', 4), tree_id: t.tree_id, type: str(d.type), name: str(d.name).slice(0, 200),
      scientific_name: str(d.scientific_name).slice(0, 200), photo_id: checkPhoto(d.photo_id, t.tree_id), notes: str(d.notes).slice(0, 1000),
      recorded_by: ctx.user.user_id, recorded_at: nowIso() };
    DB.insert('Fauna', rec);
    logActivity(ctx, 'addFauna', t.tree_id, { type: rec.type, name: rec.name });
    return rec;
  },

  deleteFauna: function (d, ctx) {
    var r = DB.find('Fauna', 'fauna_id', d.fauna_id);
    if (!r) fail('ไม่พบรายการ');
    if (!ownerOrTeacher(r, 'recorded_by', ctx)) fail('ลบได้เฉพาะรายการของตัวเอง');
    DB.remove('Fauna', 'fauna_id', r.fauna_id);
    return true;
  },

  /** ตัวอย่างพรรณไม้แห้ง — สร้าง/แก้ไข */
  saveSpecimen: function (d, ctx) {
    var s = d.specimen || {};
    var existing = s.specimen_id ? DB.find('Herbarium', 'specimen_id', s.specimen_id) : null;
    if (existing && !ownerOrTeacher(existing, 'created_by', ctx)) fail('แก้ไขได้เฉพาะตัวอย่างของตัวเอง');
    var t = fieldTree(s.tree_id || (existing && existing.tree_id), ctx, true);
    var data = {
      tree_id: t.tree_id, species_id: t.species_id, collected_at: validDate(s.collected_at),
      collector: str(s.collector) || (ctx.user.full_name || ''), location_note: str(s.location_note).slice(0, 300),
      notes: str(s.notes).slice(0, 1000), photo_id: checkPhoto(s.photo_id, t.tree_id) || (existing ? existing.photo_id : '')
    };
    var no = str(s.specimen_no);
    if (no) {
      var dup = DB.find('Herbarium', 'specimen_no', no);
      if (dup && (!existing || dup.specimen_id !== existing.specimen_id)) fail('เลขตัวอย่าง ' + no + ' ถูกใช้แล้ว');
      data.specimen_no = no;
    }
    if (existing) {
      var out = DB.update('Herbarium', 'specimen_id', existing.specimen_id, data);
      logActivity(ctx, 'updateSpecimen', existing.specimen_id);
      return out;
    }
    var year = String(Number(Platform.today().slice(0, 4)) + 543);
    if (!data.specimen_no) {
      var prefix = 'BMF-' + year + '-', max = 0;
      DB.all('Herbarium').forEach(function (r) {
        if (String(r.specimen_no).indexOf(prefix) === 0) max = Math.max(max, parseInt(String(r.specimen_no).slice(prefix.length), 10) || 0);
      });
      data.specimen_no = prefix + pad(max + 1, 3);
    }
    var rec = Object.assign({ specimen_id: DB.nextId('Herbarium', 'specimen_id', 'H', 4), created_by: ctx.user.user_id, created_at: nowIso() }, data);
    DB.insert('Herbarium', rec);
    logActivity(ctx, 'addSpecimen', rec.specimen_id, { tree_id: t.tree_id });
    return rec;
  },

  deleteSpecimen: function (d, ctx) {
    var r = DB.find('Herbarium', 'specimen_id', d.specimen_id);
    if (!r) fail('ไม่พบตัวอย่าง');
    if (!ownerOrTeacher(r, 'created_by', ctx)) fail('ลบได้เฉพาะตัวอย่างของตัวเอง');
    DB.remove('Herbarium', 'specimen_id', r.specimen_id);
    logActivity(ctx, 'deleteSpecimen', r.specimen_id);
    return true;
  },

  /** รายการตัวอย่างพรรณไม้แห้งทั้งหมด (หน้า Digital Herbarium) */
  listSpecimens: function (d, ctx) {
    var trees = {}, sp = {}, photos = {}, users = usersIndex();
    DB.all('Trees').forEach(function (t) { trees[t.tree_id] = t; });
    DB.all('Species').forEach(function (s) { sp[s.species_id] = s; });
    DB.all('Photos').forEach(function (p) { photos[p.photo_id] = p; });
    return DB.all('Herbarium').filter(function (r) { return canSeeTree(trees[r.tree_id], ctx); })
      .sort(function (a, b) { return String(a.specimen_no).localeCompare(String(b.specimen_no)); })
      .map(function (r) {
        var t = trees[r.tree_id] || {}, s = sp[t.species_id] || {};
        var ph = photos[r.photo_id];
        return Object.assign(pick(r, SCHEMA.Herbarium), {
          tree_code: t.tree_code, thai_name: s.thai_name || 'ยังไม่ทราบชนิด', scientific_name: s.scientific_name || '', family: s.family || '',
          created_by_name: displayName(r.created_by, ctx, users),
          photo: ph && (ctx.user || bool(ph.approved)) ? photoOut(ph) : null,
          can_edit: ownerOrTeacher(r, 'created_by', ctx)
        });
      });
  }
};
