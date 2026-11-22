/**
 * Plants.gs — ชนิดพรรณไม้ (Species) และต้นไม้รายต้น (Trees)
 */

var TREE_EDIT_FIELDS = ['zone_id', 'lat', 'lng', 'gps_accuracy_m', 'gps_method', 'altitude', 'height_m',
  'gbh_cm', 'canopy_m', 'age_est', 'planting_source', 'health', 'label_status', 'cover_photo_id', 'notes'];

var SPECIES_SYSTEM_FIELDS = ['species_id', 'species_code', 'status', 'created_by', 'verified_by',
  'verified_at', 'created_at', 'updated_at'];

function speciesEditFields() {
  return SCHEMA.Species.filter(function (k) { return SPECIES_SYSTEM_FIELDS.indexOf(k) < 0; });
}

// ---------- สิทธิ์การมองเห็น ----------

function canSeeTree(t, ctx) {
  if (!t || t.status === STATUS.DELETED) return false;
  if (t.status === STATUS.VERIFIED) return true;
  if (!ctx.user) return false;
  if (ctx.level >= ROLE_LEVEL.teacher || t.created_by === ctx.user.user_id) return true;
  if (t.status === STATUS.ARCHIVED) return true;
  if (ctx.level >= ROLE_LEVEL.leader &&
    [STATUS.SUBMITTED, STATUS.PENDING_TEACHER, STATUS.RETURNED].indexOf(t.status) >= 0) return true;
  return false;
}

function canEditTree(t, ctx) {
  if (!ctx.user || !t) return false;
  if (ctx.level >= ROLE_LEVEL.teacher) return t.status !== STATUS.DELETED;
  return t.created_by === ctx.user.user_id && (t.status === STATUS.DRAFT || t.status === STATUS.RETURNED);
}

function canEditSpecies(sp, ctx) {
  if (!ctx.user || !sp) return false;
  if (ctx.level >= ROLE_LEVEL.teacher) return true;
  return sp.status !== 'verified' && sp.created_by === ctx.user.user_id;
}

// ---------- แปลงข้อมูลส่งออก ----------

function photoOut(p) {
  if (!p) return null;
  var urls = bool(p.shared) ? Platform.fileUrls(p.drive_file_id) : { thumb: '', full: '' };
  return {
    photo_id: p.photo_id, tree_id: p.tree_id, part: p.part, taken_at: p.taken_at,
    has_scale: bool(p.has_scale), quality: p.quality, uploaded_by: p.uploaded_by,
    approved: bool(p.approved), thumb: urls.thumb, full: urls.full, proxy: !bool(p.shared)
  };
}

function treeOut(t, ctx, idx) {
  var o = pick(t, SCHEMA.Trees.filter(function (k) { return k !== 'drive_folder_id'; }));
  ['lat', 'lng', 'gps_accuracy_m', 'height_m', 'gbh_cm', 'dbh_cm', 'canopy_m', 'altitude', 'score'].forEach(function (k) {
    o[k] = num(t[k]);
  });
  var cover = idx && idx.photos ? idx.photos[t.cover_photo_id] : null;
  o.cover = cover ? photoOut(cover) : null;
  o.created_by_name = idx && idx.users ? displayName(t.created_by, ctx, idx.users) : '';
  o.can_edit = canEditTree(t, ctx);
  return o;
}

function speciesOut(sp) {
  var o = pick(sp, SCHEMA.Species);
  o.ai_suggested = bool(sp.ai_suggested);
  o.ai_confidence = num(sp.ai_confidence);
  return o;
}

function listsOut() {
  var cached = Platform.cacheGet('lists');
  if (cached) return JSON.parse(cached);
  var out = {};
  DB.all('Lists').slice().sort(function (a, b) { return (num(a.order) || 0) - (num(b.order) || 0); })
    .forEach(function (r) {
      if (!r.list || !r.value) return;
      (out[r.list] = out[r.list] || []).push({ value: r.value, label_en: r.label_en, icon: r.icon, hint: r.hint });
    });
  Platform.cachePut('lists', JSON.stringify(out), 600);
  return out;
}

function zonesOut() {
  return DB.all('Zones').map(function (z) {
    return { zone_id: z.zone_id, name: z.name, description: z.description, polygon: parsePolygon(z.polygon), color: z.color };
  });
}

function autoZone(lat, lng) {
  if (lat === null || lng === null) return '';
  var zones = zonesOut();
  for (var i = 0; i < zones.length; i++) {
    if (zones[i].polygon && pointInPolygon(lat, lng, zones[i].polygon)) return zones[i].zone_id;
  }
  return '';
}

function insideBoundary(lat, lng) {
  var poly = parsePolygon(getSettings().school_boundary);
  return poly ? pointInPolygon(lat, lng, poly) : null; // null = ยังไม่ได้วาดขอบเขต
}

function publicSettings() {
  var s = getSettings(), out = {};
  PUBLIC_SETTING_KEYS.forEach(function (k) { out[k] = s[k]; });
  return out;
}

// ---------- API ----------

var Plants = {
  /** ข้อมูลตั้งต้นของหน้าเว็บ — โหลดครั้งเดียวแล้วกรองในเครื่อง */
  bootstrap: function (d, ctx) {
    if (!ctx.user) {
      var cached = Platform.cacheGet('boot_public');
      if (cached) return JSON.parse(cached);
    }
    var idx = { users: usersIndex(), photos: {} };
    DB.all('Photos').forEach(function (p) { idx.photos[p.photo_id] = p; });

    var trees = DB.all('Trees').filter(function (t) { return canSeeTree(t, ctx); });
    var visibleSpeciesIds = {};
    trees.forEach(function (t) { visibleSpeciesIds[t.species_id] = true; });
    var species = DB.all('Species').filter(function (sp) {
      if (sp.status === 'archived') return ctx.level >= ROLE_LEVEL.teacher;
      // ผู้ที่ล็อกอินเห็นชนิดที่เพื่อนเสนอไว้ด้วย เพื่อเลือกใช้ร่วมกันแทนการสร้างชนิดซ้ำ
      return sp.status === 'verified' || visibleSpeciesIds[sp.species_id] || !!ctx.user;
    });

    var out = {
      settings: publicSettings(),
      lists: listsOut(),
      zones: zonesOut(),
      species: species.map(speciesOut),
      trees: trees.map(function (t) { return treeOut(t, ctx, idx); }),
      routes: routesOut(ctx),
      buildings: buildingsOut(),
      missions: missionsOut(ctx),
      phenology: phenologySummary(),
      me: Auth.publicUser(ctx.user),
      session_expired: !!ctx.expired
    };
    if (ctx.level >= ROLE_LEVEL.teacher) {
      var groups = {};
      DB.all('Users').forEach(function (u) { if (u.group) groups[u.group] = 1; });
      out.groups = Object.keys(groups).sort();
      out.open_issues = DB.filter('Issues', function (r) { return r.status === 'open'; }).length;
    }
    if (!ctx.user) Platform.cachePut('boot_public', JSON.stringify(out), 300);
    return out;
  },

  getTree: function (d, ctx) {
    var t = DB.find('Trees', 'tree_id', d.tree_id);
    if (!canSeeTree(t, ctx)) fail('ไม่พบต้นไม้นี้ หรือยังไม่ผ่านการตรวจ');
    var idx = { users: usersIndex(), photos: {} };
    var photos = DB.filter('Photos', function (p) { return p.tree_id === t.tree_id; });
    photos.forEach(function (p) { idx.photos[p.photo_id] = p; });
    if (!ctx.user) photos = photos.filter(function (p) { return bool(p.approved); });

    var sp = DB.find('Species', 'species_id', t.species_id);
    var isOwner = ctx.user && t.created_by === ctx.user.user_id;
    var canSeeReview = ctx.user && (isOwner || ctx.level >= ROLE_LEVEL.leader);

    var contributors = {};
    contributors[t.created_by] = true;
    photos.forEach(function (p) { contributors[p.uploaded_by] = true; });

    var reviews = [];
    var ai = null;
    if (canSeeReview) {
      reviews = DB.filter('Reviews', function (r) { return r.tree_id === t.tree_id; }).map(function (r) {
        return Object.assign(pick(r, SCHEMA.Reviews), { reviewer_name: displayName(r.reviewer, ctx, idx.users) });
      });
      var logs = DB.filter('AILog', function (l) { return l.tree_id === t.tree_id && l.kind === 'identify'; });
      if (logs.length) {
        try { ai = JSON.parse(logs[logs.length - 1].result); } catch (e) { ai = null; }
      }
    }

    var others = DB.filter('Trees', function (o) {
      return o.species_id === t.species_id && o.tree_id !== t.tree_id && t.species_id !== 'UNKNOWN' && canSeeTree(o, ctx);
    }).length;

    return {
      tree: treeOut(t, ctx, idx),
      species: sp ? speciesOut(sp) : null,
      species_can_edit: canEditSpecies(sp, ctx),
      photos: photos.map(photoOut),
      reviews: reviews,
      ai: ai,
      same_species_count: others,
      field: treeFieldData(t, ctx, idx.users),
      contributors: Object.keys(contributors).filter(String).map(function (id) { return displayName(id, ctx, idx.users); }).filter(String)
    };
  },

  getSpecies: function (d, ctx) {
    var sp = DB.find('Species', 'species_id', d.species_id);
    if (!sp) fail('ไม่พบชนิดพรรณไม้');
    var idx = { users: usersIndex(), photos: {} };
    DB.all('Photos').forEach(function (p) { idx.photos[p.photo_id] = p; });
    var trees = DB.filter('Trees', function (t) { return t.species_id === sp.species_id && canSeeTree(t, ctx); });
    if (sp.status !== 'verified' && !trees.length && !ctx.user) {
      fail('ไม่พบชนิดพรรณไม้');
    }
    var treeIds = {};
    trees.forEach(function (t) { treeIds[t.tree_id] = true; });
    var photos = DB.filter('Photos', function (p) { return treeIds[p.tree_id] && (ctx.user || bool(p.approved)); });
    return {
      species: speciesOut(sp),
      can_edit: canEditSpecies(sp, ctx),
      trees: trees.map(function (t) { return treeOut(t, ctx, idx); }),
      photos: photos.map(photoOut)
    };
  },

  /** หาต้นที่อยู่ใกล้พิกัด (กันบันทึกซ้ำ) */
  checkNearby: function (d, ctx) {
    var lat = num(d.lat), lng = num(d.lng);
    if (lat === null || lng === null) fail('ไม่มีพิกัด');
    var radius = num(d.radius) || num(getSettings().duplicate_radius_m) || 3;
    var idx = { users: usersIndex(), photos: {} };
    DB.all('Photos').forEach(function (p) { idx.photos[p.photo_id] = p; });
    var spIdx = {};
    DB.all('Species').forEach(function (s) { spIdx[s.species_id] = s; });

    var near = DB.filter('Trees', function (t) {
      if (t.tree_id === d.exclude) return false;
      if ([STATUS.DELETED, STATUS.ARCHIVED].indexOf(t.status) >= 0) return false;
      var tl = num(t.lat), tg = num(t.lng);
      return tl !== null && tg !== null && distanceM(lat, lng, tl, tg) <= radius;
    }).map(function (t) {
      var sp = spIdx[t.species_id];
      return {
        tree_id: t.tree_id, tree_code: t.tree_code, status: t.status,
        name: sp ? sp.thai_name : 'ยังไม่ทราบชนิด',
        distance_m: Math.round(distanceM(lat, lng, num(t.lat), num(t.lng)) * 10) / 10,
        cover: idx.photos[t.cover_photo_id] ? photoOut(idx.photos[t.cover_photo_id]) : null,
        created_by_name: displayName(t.created_by, ctx, idx.users)
      };
    }).sort(function (a, b) { return a.distance_m - b.distance_m; });

    return { nearby: near, zone_id: autoZone(lat, lng), inside_boundary: insideBoundary(lat, lng) };
  },

  /**
   * สร้าง/แก้ร่าง
   * d = { tree: {...}, species_mode: 'existing'|'new'|'unknown', species_id, species: {...} }
   */
  saveDraft: function (d, ctx) {
    var input = d.tree || {};
    var isNew = !input.tree_id;
    var tree;
    if (isNew) {
      var tid = DB.nextId('Trees', 'tree_id', 'T', 4);
      tree = {
        tree_id: tid, tree_code: 'TMP-' + tid.slice(1), species_id: 'UNKNOWN', status: STATUS.DRAFT,
        label_status: 'ยังไม่มีป้าย', created_by: ctx.user.user_id, created_at: nowIso()
      };
    } else {
      tree = DB.find('Trees', 'tree_id', input.tree_id);
      if (!tree) fail('ไม่พบต้นไม้ ' + input.tree_id);
      if (!canEditTree(tree, ctx)) fail('แก้ไขไม่ได้ — ต้นนี้ส่งตรวจแล้วหรือไม่ใช่ของคุณ');
    }

    var patch = pick(input, TREE_EDIT_FIELDS);
    Object.keys(patch).forEach(function (k) { patch[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k]; });
    if (ctx.level >= ROLE_LEVEL.teacher && input.tree_code !== undefined && str(input.tree_code)) {
      var dup = DB.find('Trees', 'tree_code', str(input.tree_code));
      if (dup && dup.tree_id !== tree.tree_id) fail('รหัสต้น ' + input.tree_code + ' ถูกใช้แล้วกับ ' + dup.tree_id);
      patch.tree_code = str(input.tree_code);
    }
    var merged = Object.assign({}, tree, patch);
    var gbh = num(merged.gbh_cm);
    patch.dbh_cm = gbh ? Math.round(gbh / Math.PI * 10) / 10 : '';
    if ((patch.lat !== undefined || patch.lng !== undefined) && !str(input.zone_id)) {
      patch.zone_id = autoZone(num(merged.lat), num(merged.lng));
    }

    // ---- ชนิดพรรณไม้ ----
    var mode = d.species_mode;
    var spOut = null;
    if (mode === 'unknown') {
      patch.species_id = 'UNKNOWN';
    } else if (mode === 'existing') {
      var ex = DB.find('Species', 'species_id', d.species_id);
      if (!ex) fail('ไม่พบชนิดพรรณไม้ที่เลือก');
      patch.species_id = ex.species_id;
      spOut = speciesOut(ex);
    } else if (mode === 'new') {
      var spData = pick(d.species || {}, speciesEditFields());
      if (ctx.level >= ROLE_LEVEL.teacher && d.species && d.species.species_code !== undefined) {
        spData.species_code = str(d.species.species_code);
      }
      if (!str(spData.thai_name) && !str(spData.scientific_name) && !str(spData.local_name)) {
        fail('กรุณากรอกชื่อพรรณไม้อย่างน้อย 1 ชื่อ (ถ้าไม่รู้ชื่อ ให้เลือก "ยังไม่ทราบชนิด")');
      }
      Object.keys(spData).forEach(function (k) {
        if (Array.isArray(spData[k])) spData[k] = spData[k].join(', ');
        else if (typeof spData[k] === 'string') spData[k] = spData[k].trim();
      });
      var current = DB.find('Species', 'species_id', (d.species && d.species.species_id) || merged.species_id);
      if (current && canEditSpecies(current, ctx)) {
        spData.updated_at = nowIso();
        spOut = speciesOut(DB.update('Species', 'species_id', current.species_id, spData));
        patch.species_id = current.species_id;
      } else {
        var sid = DB.nextId('Species', 'species_id', 'SP', 3);
        var sp = Object.assign({
          species_id: sid, status: 'draft', created_by: ctx.user.user_id,
          created_at: nowIso(), updated_at: nowIso()
        }, spData);
        DB.insert('Species', sp);
        spOut = speciesOut(sp);
        patch.species_id = sid;
      }
    }

    patch.updated_at = nowIso();
    var saved;
    if (isNew) {
      saved = Object.assign(tree, patch);
      DB.insert('Trees', saved);
    } else {
      saved = DB.update('Trees', 'tree_id', tree.tree_id, patch);
    }
    logActivity(ctx, isNew ? 'createTree' : 'updateTree', saved.tree_id, { species_mode: mode, fields: Object.keys(patch) });

    var lat = num(saved.lat), lng = num(saved.lng);
    return {
      tree: treeOut(saved, ctx, { users: usersIndex(), photos: {} }),
      species: spOut,
      inside_boundary: lat !== null && lng !== null ? insideBoundary(lat, lng) : null
    };
  },

  submit: function (d, ctx) {
    var t = DB.find('Trees', 'tree_id', d.tree_id);
    if (!t) fail('ไม่พบต้นไม้');
    if (t.created_by !== ctx.user.user_id && ctx.level < ROLE_LEVEL.teacher) fail('ส่งได้เฉพาะงานของตัวเอง');
    if (t.status !== STATUS.DRAFT && t.status !== STATUS.RETURNED) fail('ต้นนี้ส่งตรวจไปแล้ว');

    var problems = [];
    if (num(t.lat) === null || num(t.lng) === null) problems.push('ยังไม่ได้จับพิกัด');
    var s = getSettings();
    var have = {};
    DB.filter('Photos', function (p) { return p.tree_id === t.tree_id; }).forEach(function (p) { have[p.part] = true; });
    var missing = String(s.required_photo_parts || '').split(',').map(str).filter(function (p) { return p && !have[p]; });
    if (missing.length) problems.push('ยังขาดรูป: ' + missing.map(partLabel).join(', '));
    if (problems.length) fail(problems.join(' / '));

    var next = bool(s.leader_review_enabled) ? STATUS.SUBMITTED : STATUS.PENDING_TEACHER;
    var first = !t.submitted_at;
    DB.update('Trees', 'tree_id', t.tree_id, { status: next, submitted_at: nowIso(), updated_at: nowIso() });
    if (first) addPoints(t.created_by, num(s.points_submit) || 0);
    logActivity(ctx, 'submit', t.tree_id);
    return { status: next };
  },

  /** ลบร่างของตัวเอง (ไม่ลบจริง เปลี่ยนสถานะเป็น deleted) */
  deleteDraft: function (d, ctx) {
    var t = DB.find('Trees', 'tree_id', d.tree_id);
    if (!t) fail('ไม่พบต้นไม้');
    if (!(ctx.level >= ROLE_LEVEL.teacher || (t.created_by === ctx.user.user_id && t.status === STATUS.DRAFT))) {
      fail('ลบได้เฉพาะร่างของตัวเอง');
    }
    DB.update('Trees', 'tree_id', t.tree_id, { status: STATUS.DELETED, updated_at: nowIso() });
    logActivity(ctx, 'deleteDraft', t.tree_id);
    return true;
  },

  /** เก็บถาวร (ต้นตาย/ถูกตัด) หรือกู้คืน — ครูเท่านั้น */
  archiveTree: function (d, ctx) {
    var t = DB.find('Trees', 'tree_id', d.tree_id);
    if (!t) fail('ไม่พบต้นไม้');
    var status = d.restore ? (t.verified_at ? STATUS.VERIFIED : STATUS.DRAFT) : STATUS.ARCHIVED;
    var patch = { status: status, updated_at: nowIso() };
    if (!d.restore && d.reason) patch.notes = str(t.notes + '\n[เก็บถาวร ' + Platform.today() + '] ' + d.reason);
    DB.update('Trees', 'tree_id', t.tree_id, patch);
    logActivity(ctx, d.restore ? 'restoreTree' : 'archiveTree', t.tree_id, { reason: d.reason });
    return { status: status };
  },

  /** ครูแก้ข้อมูลชนิดโดยตรง (เช่น ชนิดที่อนุมัติแล้ว) */
  saveSpecies: function (d, ctx) {
    var sp = DB.find('Species', 'species_id', d.species && d.species.species_id);
    if (!sp) fail('ไม่พบชนิดพรรณไม้');
    if (!canEditSpecies(sp, ctx)) fail('คุณไม่มีสิทธิ์แก้ไขชนิดนี้');
    var data = pick(d.species, speciesEditFields());
    if (ctx.level >= ROLE_LEVEL.teacher && d.species.species_code !== undefined) data.species_code = str(d.species.species_code);
    data.updated_at = nowIso();
    var out = DB.update('Species', 'species_id', sp.species_id, data);
    logActivity(ctx, 'saveSpecies', sp.species_id, { fields: Object.keys(data) });
    return speciesOut(out);
  },

  /** รวมชนิดซ้ำ: ย้ายต้นทั้งหมดจาก from → into แล้วเก็บถาวรชนิด from */
  mergeSpecies: function (d, ctx) {
    var from = DB.find('Species', 'species_id', d.from), into = DB.find('Species', 'species_id', d.into);
    if (!from || !into || from.species_id === into.species_id) fail('เลือกชนิดให้ถูกต้อง');
    var moved = 0;
    DB.filter('Trees', function (t) { return t.species_id === from.species_id; }).forEach(function (t) {
      DB.update('Trees', 'tree_id', t.tree_id, { species_id: into.species_id, updated_at: nowIso() });
      moved++;
    });
    DB.update('Species', 'species_id', from.species_id, { status: 'archived', updated_at: nowIso() });
    logActivity(ctx, 'mergeSpecies', from.species_id, { into: into.species_id, moved: moved });
    return { moved: moved };
  }
};

var PART_LABELS = {
  whole: 'ทั้งต้น', bark: 'ลำต้น/เปลือก', leaf_top: 'ใบด้านบน', leaf_bottom: 'ใบด้านล่าง',
  leaf_arrangement: 'การเรียงตัวของใบ', flower: 'ดอก', inflorescence: 'ช่อดอก', fruit: 'ผล',
  seed: 'เมล็ด', other: 'อื่นๆ'
};

function partLabel(p) { return PART_LABELS[p] || p; }
