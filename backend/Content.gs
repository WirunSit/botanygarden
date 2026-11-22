/**
 * Content.gs — เส้นทางเรียนรู้ (Learning routes), อาคารสำหรับแผนที่ 3 มิติ, ภารกิจที่ครูมอบหมาย (Missions)
 */

function routesOut(ctx) {
  var teacher = ctx.level >= ROLE_LEVEL.teacher;
  return DB.all('Routes').filter(function (r) { return teacher || bool(r.published); }).map(function (r) {
    return {
      route_id: r.route_id, name: r.name, description: r.description, color: r.color || '#d69e2e',
      published: bool(r.published), tree_ids: String(r.tree_ids || '').split(',').map(str).filter(String)
    };
  });
}

function buildingsOut() {
  return DB.all('Buildings').map(function (b) {
    return { building_id: b.building_id, name: b.name, polygon: parsePolygon(b.polygon), height_m: num(b.height_m) || 6, color: b.color || '#cbd5e0' };
  }).filter(function (b) { return b.polygon; });
}

/** ภารกิจพร้อมความคืบหน้า: นับต้นที่สมาชิกกลุ่มส่งตรวจ (ในโซนที่กำหนด) ตั้งแต่วันที่สร้างภารกิจ */
function missionsOut(ctx) {
  if (!ctx.user) return [];
  var teacher = ctx.level >= ROLE_LEVEL.teacher;
  var users = DB.all('Users');
  var trees = DB.all('Trees');
  return DB.all('Missions').filter(function (m) {
    if (teacher) return true;
    return m.status !== 'closed' && (!m.group || m.group === ctx.user.group);
  }).map(function (m) {
    var members = {};
    users.forEach(function (u) { if ((u.role === 'student' || u.role === 'leader') && (!m.group || u.group === m.group)) members[u.user_id] = true; });
    var done = 0, verified = 0;
    trees.forEach(function (t) {
      if (!members[t.created_by] || [STATUS.DELETED, STATUS.DRAFT].indexOf(t.status) >= 0) return;
      if (m.zone_id && t.zone_id !== m.zone_id) return;
      if (String(t.created_at) < String(m.created_at)) return;
      done++;
      if (t.status === STATUS.VERIFIED) verified++;
    });
    return {
      mission_id: m.mission_id, title: m.title, description: m.description, zone_id: m.zone_id, group: m.group,
      due_date: m.due_date, target_count: num(m.target_count) || 0, status: m.status || 'active',
      created_at: m.created_at, progress: done, verified: verified
    };
  });
}

var Content = {
  adminRoutes: function (d, ctx) {
    if (d.op === 'delete') {
      DB.remove('Routes', 'route_id', d.route_id);
      logActivity(ctx, 'deleteRoute', d.route_id);
      return true;
    }
    var r = d.route || {};
    if (!str(r.name)) fail('ตั้งชื่อเส้นทาง');
    var ids = (Array.isArray(r.tree_ids) ? r.tree_ids : String(r.tree_ids || '').split(',')).map(str).filter(String);
    if (ids.length < 2) fail('เลือกต้นไม้อย่างน้อย 2 จุด');
    ids.forEach(function (id) { if (!DB.find('Trees', 'tree_id', id)) fail('ไม่พบต้นไม้ ' + id); });
    var data = { name: str(r.name), description: str(r.description).slice(0, 2000), tree_ids: ids.join(','), color: str(r.color) || '#d69e2e',
      published: r.published !== false && String(r.published) !== 'false', updated_at: nowIso() };
    if (r.route_id && DB.find('Routes', 'route_id', r.route_id)) {
      DB.update('Routes', 'route_id', r.route_id, data);
    } else {
      r.route_id = DB.nextId('Routes', 'route_id', 'RT', 2);
      DB.insert('Routes', Object.assign({ route_id: r.route_id, created_by: ctx.user.user_id }, data));
    }
    logActivity(ctx, 'saveRoute', r.route_id, { stops: ids.length });
    return { route_id: r.route_id };
  },

  adminBuildings: function (d, ctx) {
    if (d.op === 'delete') {
      DB.remove('Buildings', 'building_id', d.building_id);
      return true;
    }
    var b = d.building || {};
    if (!str(b.name)) fail('ตั้งชื่ออาคาร');
    var poly = Array.isArray(b.polygon) ? b.polygon : parsePolygon(b.polygon);
    var h = num(b.height_m);
    if (h === null || h <= 0 || h > 200) fail('ความสูงอาคารต้องเป็นตัวเลข 1–200 เมตร');
    var data = { name: str(b.name), height_m: h, color: str(b.color) || '#cbd5e0' };
    if (poly) data.polygon = JSON.stringify(poly);
    if (b.building_id && DB.find('Buildings', 'building_id', b.building_id)) {
      DB.update('Buildings', 'building_id', b.building_id, data);
    } else {
      if (!poly) fail('วาดโครงอาคารบนแผนที่ก่อน');
      b.building_id = DB.nextId('Buildings', 'building_id', 'B', 2);
      DB.insert('Buildings', Object.assign({ building_id: b.building_id }, data));
    }
    logActivity(ctx, 'saveBuilding', b.building_id);
    return { building_id: b.building_id };
  },

  adminMissions: function (d, ctx) {
    if (d.op === 'delete') {
      DB.remove('Missions', 'mission_id', d.mission_id);
      logActivity(ctx, 'deleteMission', d.mission_id);
      return true;
    }
    var m = d.mission || {};
    if (!str(m.title)) fail('ตั้งชื่อภารกิจ');
    var data = {
      title: str(m.title), description: str(m.description).slice(0, 2000), zone_id: str(m.zone_id), group: str(m.group),
      due_date: str(m.due_date), target_count: num(m.target_count) || 0, status: m.status === 'closed' ? 'closed' : 'active'
    };
    if (data.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.due_date)) fail('รูปแบบวันที่ไม่ถูกต้อง');
    if (m.mission_id && DB.find('Missions', 'mission_id', m.mission_id)) {
      DB.update('Missions', 'mission_id', m.mission_id, data);
    } else {
      m.mission_id = DB.nextId('Missions', 'mission_id', 'MS', 3);
      DB.insert('Missions', Object.assign({ mission_id: m.mission_id, created_by: ctx.user.user_id, created_at: nowIso() }, data));
    }
    logActivity(ctx, 'saveMission', m.mission_id);
    return { mission_id: m.mission_id };
  }
};
