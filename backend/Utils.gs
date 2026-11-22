/**
 * Utils.gs — โครงสร้างชีต ตัวอ่าน/เขียนตาราง และฟังก์ชันช่วยทั่วไป
 */

var SCHEMA = {
  Users: ['user_id', 'username', 'full_name', 'nickname', 'class', 'number', 'role', 'group',
    'password_hash', 'salt', 'email', 'status', 'points', 'created_at', 'last_login'],

  Species: ['species_id', 'species_code', 'thai_name', 'local_name', 'common_name', 'scientific_name',
    'genus', 'species_epithet', 'author', 'family', 'order', 'class', 'division', 'synonyms',
    'origin', 'distribution', 'conservation_status',
    // สัณฐานวิทยา
    'habit', 'bark', 'bark_color', 'latex', 'branching',
    'leaf_type', 'leaf_arrangement', 'leaf_shape', 'leaf_apex', 'leaf_base', 'leaf_margin',
    'leaf_venation', 'leaf_texture', 'leaf_hair', 'leaf_width_cm', 'leaf_length_cm',
    'flower_type', 'flower_color', 'petal_count', 'symmetry', 'flower_position', 'scent', 'flowering_season',
    'fruit_type', 'fruit_color', 'fruit_size', 'fruiting_season',
    'seed_count', 'seed_shape', 'seed_color', 'description', 'wood_density',
    // การใช้ประโยชน์ (ก.7-003)
    'use_food', 'use_medicine', 'use_construction', 'use_pesticide', 'use_culture', 'use_other',
    'info_source', 'references',
    // ระบบ
    'status', 'ai_suggested', 'ai_confidence', 'created_by', 'verified_by', 'verified_at', 'created_at', 'updated_at'],

  Trees: ['tree_id', 'tree_code', 'species_id', 'zone_id', 'lat', 'lng', 'gps_accuracy_m', 'gps_method',
    'altitude', 'height_m', 'gbh_cm', 'dbh_cm', 'canopy_m', 'age_est', 'planting_source', 'health',
    'label_status', 'cover_photo_id', 'drive_folder_id', 'notes', 'status', 'score',
    'created_by', 'verified_by', 'verified_at', 'submitted_at', 'created_at', 'updated_at'],

  Photos: ['photo_id', 'tree_id', 'part', 'drive_file_id', 'shared', 'taken_at', 'lat', 'lng',
    'has_scale', 'quality', 'uploaded_by', 'uploaded_at', 'approved'],

  Phenology: ['record_id', 'tree_id', 'date', 'new_leaf', 'leaf_fall', 'flower_bud', 'flowering',
    'fruiting', 'ripe_fruit', 'photo_id', 'note', 'recorded_by', 'created_at'],

  Measurements: ['measure_id', 'tree_id', 'date', 'height_m', 'gbh_cm', 'dbh_cm', 'canopy_m', 'health',
    'note', 'recorded_by', 'created_at'],

  Issues: ['issue_id', 'tree_id', 'type', 'description', 'photo_id', 'status', 'reported_by', 'reported_at',
    'resolved_by', 'resolved_at', 'resolution'],

  CareLog: ['care_id', 'tree_id', 'date', 'type', 'note', 'recorded_by', 'created_at'],

  Herbarium: ['specimen_id', 'specimen_no', 'tree_id', 'species_id', 'collected_at', 'collector',
    'location_note', 'notes', 'photo_id', 'created_by', 'created_at'],

  Routes: ['route_id', 'name', 'description', 'tree_ids', 'color', 'published', 'created_by', 'updated_at'],

  Buildings: ['building_id', 'name', 'polygon', 'height_m', 'color'],

  Reviews: ['review_id', 'tree_id', 'reviewer', 'role', 'decision', 'field', 'comment', 'score', 'created_at'],

  Zones: ['zone_id', 'name', 'description', 'polygon', 'color'],

  Fauna: ['fauna_id', 'tree_id', 'type', 'name', 'scientific_name', 'photo_id', 'notes', 'recorded_by', 'recorded_at'],

  Missions: ['mission_id', 'title', 'description', 'zone_id', 'group', 'due_date', 'target_count',
    'created_by', 'created_at', 'status'],

  Badges: ['user_id', 'badge', 'earned_at'],

  AILog: ['log_id', 'user_id', 'tree_id', 'kind', 'model', 'input_summary', 'result',
    'top_name', 'top_confidence', 'created_at'],

  ActivityLog: ['time', 'user_id', 'action', 'target', 'detail'],

  Settings: ['key', 'value', 'note'],

  Lists: ['list', 'value', 'label_en', 'icon', 'hint', 'order']
};

/** เพิ่มเลขนี้เมื่อเพิ่มชีต/คอลัมน์ — ระบบจะสร้างส่วนที่ขาดให้อัตโนมัติในคำขอแรก */
var SCHEMA_VERSION = '3';

/** สถานะระเบียนต้นไม้ */
var STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',            // รอหัวหน้ากลุ่มตรวจ
  PENDING_TEACHER: 'pending_teacher',// รอครูตรวจ
  RETURNED: 'returned',
  VERIFIED: 'verified',
  ARCHIVED: 'archived',
  DELETED: 'deleted'
};

/** ตัวอ่าน/เขียนตาราง — อ่านทั้งชีตครั้งเดียวต่อคำขอ แล้วกรองใน JS */
var DB = {
  _memo: {},

  reset: function () { this._memo = {}; },

  _table: function (name) {
    if (!this._memo[name]) this._memo[name] = Platform.readTable(name);
    return this._memo[name];
  },

  all: function (name) { return this._table(name).rows; },

  headers: function (name) {
    var h = this._table(name).headers;
    return h.some(String) ? h : SCHEMA[name];
  },

  find: function (name, key, value) {
    value = String(value);
    var rows = this.all(name);
    for (var i = 0; i < rows.length; i++) if (String(rows[i][key]) === value) return rows[i];
    return null;
  },

  filter: function (name, fn) { return this.all(name).filter(fn); },

  insert: function (name, obj) {
    Platform.appendRow(name, this.headers(name), obj);
    delete this._memo[name];
    return obj;
  },

  update: function (name, key, value, patch) {
    var row = this.find(name, key, value);
    if (!row) throw new Error('ไม่พบข้อมูล ' + value);
    var merged = Object.assign({}, row, patch);
    Platform.writeRow(name, this.headers(name), row._row, merged);
    delete this._memo[name];
    return merged;
  },

  remove: function (name, key, value) {
    var row = this.find(name, key, value);
    if (!row) return false;
    Platform.deleteRow(name, row._row);
    delete this._memo[name];
    return true;
  },

  replaceAll: function (name, objs) {
    Platform.replaceTable(name, this.headers(name), objs);
    delete this._memo[name];
  },

  /** รหัสถัดไป เช่น nextId('Trees','tree_id','T',4) → T0007 */
  nextId: function (name, key, prefix, width) {
    var max = 0;
    this.all(name).forEach(function (r) {
      var s = String(r[key] || '');
      if (s.indexOf(prefix) === 0) {
        var n = parseInt(s.slice(prefix.length), 10);
        if (n > max) max = n;
      }
    });
    return prefix + pad(max + 1, width);
  }
};

// ---------- ค่าตั้งระบบ ----------

var DEFAULT_SETTINGS = [
  ['school_name', 'โรงเรียนพุทธมงคลวิทยา', 'ชื่อโรงเรียน'],
  ['system_name', 'พฤกษาพุทธมงคล', 'ชื่อระบบที่แสดงบนหน้าเว็บ'],
  ['postal_code', '', 'รหัสไปรษณีย์โรงเรียน 5 หลัก (ใช้สร้างรหัสพรรณไม้ 7-XXXXX-YYY-ZZZ)'],
  ['academic_year', '2569', 'ปีการศึกษา'],
  ['map_center', '13.7563,100.5018', 'จุดกลางแผนที่ (lat,lng) — ตั้งเป็นกลางโรงเรียน'],
  ['map_zoom', '18', 'ระดับการซูมเริ่มต้น'],
  ['school_boundary', '', 'ขอบเขตโรงเรียน (วาดในหน้า จัดการโซน)'],
  ['duplicate_radius_m', '3', 'รัศมีตรวจต้นซ้ำ (เมตร)'],
  ['gps_good_m', '5', 'ค่าคลาดเคลื่อน GPS ที่ถือว่าดีมาก (เมตร)'],
  ['gps_ok_m', '10', 'ค่าคลาดเคลื่อน GPS ที่ถือว่าพอใช้ (เมตร)'],
  ['gps_seconds', '15', 'เวลาเก็บค่า GPS (วินาที)'],
  ['required_photo_parts', 'whole,bark,leaf_top,leaf_bottom,leaf_arrangement', 'รูปที่บังคับก่อนส่งตรวจ'],
  ['ai_enabled', 'TRUE', 'เปิดใช้ AI ช่วยจำแนก'],
  ['ai_daily_limit_per_user', '30', 'จำนวนครั้งที่นักเรียนเรียก AI ได้ต่อวัน'],
  ['ai_search_daily_limit_guest', '200', 'จำนวนครั้งค้นหาด้วย AI ของผู้เยี่ยมชมรวมต่อวัน'],
  ['gemini_model', 'gemini-2.5-flash', 'ชื่อโมเดล Gemini (ตรวจชื่อรุ่นล่าสุดที่ ai.google.dev)'],
  ['plantnet_enabled', 'FALSE', 'ใช้ Pl@ntNet เป็นความเห็นที่ 2'],
  ['leader_review_enabled', 'TRUE', 'ให้หัวหน้ากลุ่มตรวจขั้นต้นก่อนส่งครู'],
  ['public_show_student_name', 'nickname_only', 'การแสดงชื่อนักเรียนในหน้าสาธารณะ: nickname_only / class_only / none'],
  ['public_url', '', 'ลิงก์หน้าเว็บสำหรับ QR Code (เช่น https://xxx.github.io/flora/)'],
  ['photo_max_px', '1600', 'ด้านยาวสูงสุดของรูปก่อนอัปโหลด'],
  ['photo_quality', '0.8', 'คุณภาพ JPEG (0–1)'],
  ['points_submit', '10', 'คะแนนเมื่อส่งต้นใหม่'],
  ['points_verified', '20', 'คะแนนเมื่อได้รับอนุมัติ'],
  ['points_photo', '5', 'คะแนนเมื่อเพิ่มรูปให้ต้นที่อนุมัติแล้ว'],
  ['points_phenology', '3', 'คะแนนเมื่อบันทึกชีพลักษณ์ (แตกใบ/ออกดอก/ติดผล)'],
  ['google_maps_api_key', '', 'Google Maps API Key สำหรับแผนที่ 3 มิติแบบสมจริง (เปิด Maps JavaScript API + บัญชีเรียกเก็บเงิน และจำกัด HTTP referrer เป็นโดเมนของหน้าเว็บ) — เว้นว่าง = ใช้แผนที่ 3 มิติแบบจำลอง'],
  ['imagery_url', '', 'ภาพถ่ายทางอากาศของโรงเรียนเอง เช่น จากโดรน (รูปแบบ https://.../{z}/{x}/{y}.png) — เว้นว่าง = ภาพดาวเทียม Esri'],
  ['wood_density_default', '0.6', 'ความหนาแน่นเนื้อไม้เริ่มต้น (ก./ลบ.ซม.) ใช้คำนวณคาร์บอนเมื่อชนิดนั้นไม่ได้ระบุ'],
  ['carbon_fraction', '0.47', 'สัดส่วนคาร์บอนในมวลชีวภาพแห้ง (IPCC 2006)'],
  ['root_shoot_ratio', '0.24', 'อัตราส่วนมวลชีวภาพใต้ดินต่อเหนือดิน'],
  ['email_notify', 'FALSE', 'ส่งอีเมลแจ้งนักเรียนเมื่องานถูกส่งกลับ/อนุมัติ (เฉพาะคนที่มีอีเมล)'],
  ['schema_version', '', 'เวอร์ชันโครงสร้างชีต (ระบบตั้งเอง ไม่ต้องแก้)']
];

var PUBLIC_SETTING_KEYS = ['school_name', 'system_name', 'academic_year', 'map_center', 'map_zoom',
  'school_boundary', 'duplicate_radius_m', 'gps_good_m', 'gps_ok_m', 'gps_seconds', 'required_photo_parts',
  'ai_enabled', 'leader_review_enabled', 'public_show_student_name', 'public_url', 'photo_max_px',
  'photo_quality', 'postal_code', 'plantnet_enabled', 'imagery_url', 'google_maps_api_key', 'wood_density_default',
  'carbon_fraction', 'root_shoot_ratio'];

function getSettings() {
  var cached = Platform.cacheGet('settings');
  if (cached) return JSON.parse(cached);
  var s = {};
  DEFAULT_SETTINGS.forEach(function (d) { s[d[0]] = d[1]; });
  DB.all('Settings').forEach(function (r) { if (r.key) s[r.key] = r.value; });
  Platform.cachePut('settings', JSON.stringify(s), 600);
  return s;
}

function bustCache() {
  Platform.cacheRemove('settings');
  Platform.cacheRemove('lists');
}

// ---------- ฟังก์ชันช่วย ----------

function pad(n, width) {
  var s = String(n);
  while (s.length < width) s = '0' + s;
  return s;
}

function nowIso() { return Platform.now().toISOString(); }

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

function bool(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }

function str(v) { return v === null || v === undefined ? '' : String(v).trim(); }

function pick(obj, keys) {
  var out = {};
  keys.forEach(function (k) { if (obj && obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

/** ระยะทางเป็นเมตรระหว่างสองพิกัด */
function distanceM(lat1, lng1, lat2, lng2) {
  var R = 6371000, toRad = Math.PI / 180;
  var dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** polygon = [[lat,lng],...] */
function pointInPolygon(lat, lng, polygon) {
  var inside = false;
  for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    var yi = polygon[i][0], xi = polygon[i][1], yj = polygon[j][0], xj = polygon[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function parsePolygon(text) {
  if (!text) return null;
  try {
    var p = typeof text === 'string' ? JSON.parse(text) : text;
    return Array.isArray(p) && p.length >= 3 ? p : null;
  } catch (e) { return null; }
}

function logActivity(ctx, action, target, detail) {
  DB.insert('ActivityLog', {
    time: nowIso(),
    user_id: ctx && ctx.user ? ctx.user.user_id : 'guest',
    action: action,
    target: target || '',
    detail: detail ? JSON.stringify(detail).slice(0, 2000) : ''
  });
}

function addPoints(userId, points) {
  if (!userId || !points) return;
  var u = DB.find('Users', 'user_id', userId);
  if (!u) return;
  DB.update('Users', 'user_id', userId, { points: (num(u.points) || 0) + points });
}

function fail(msg) { throw new Error(msg); }
