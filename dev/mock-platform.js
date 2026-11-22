/**
 * mock-platform.js — ใช้แทน backend/Platform.gs เมื่อเปิดหน้าเว็บในโหมดทดลอง (ไม่มี Apps Script)
 * เก็บข้อมูลทั้งหมดใน localStorage ของเบราว์เซอร์ และจำลองคำตอบของ AI
 * โค้ดหลังบ้านไฟล์อื่น (Utils/Auth/Plants/...) เป็นตัวเดียวกับที่ใช้บน Apps Script จริง
 */
var Platform = (function () {
  var DB_KEY = 'bmf_mock_db_v1', CACHE_KEY = 'bmf_mock_cache_v1', PROP_KEY = 'bmf_mock_props_v1', FILE_PREFIX = 'bmf_mock_file_';
  var files = {};

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('โหมดทดลอง: บันทึกไม่ได้', e); }
  }

  var db = load(DB_KEY, {});
  var cache = load(CACHE_KEY, {});
  var props = load(PROP_KEY, {});
  var save = function () { store(DB_KEY, db); };

  function table(name) {
    if (!db[name]) throw new Error('ไม่พบชีต "' + name + '" — กรุณารันฟังก์ชัน setup() ก่อน');
    return db[name];
  }
  function norm(headers, obj) {
    var o = {};
    headers.forEach(function (h) {
      var v = obj[h];
      if (v === null || v === undefined) v = '';
      else if (typeof v === 'boolean') v = v ? 'TRUE' : 'FALSE';
      else if (typeof v === 'object') v = JSON.stringify(v);
      o[h] = String(v);
    });
    return o;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function fileData(id) {
    if (files[id]) return files[id];
    try { return localStorage.getItem(FILE_PREFIX + id) || ''; } catch (e) { return ''; }
  }

  var UI_MONTHS = [['ม.ค.', 'มกรา'], ['ก.พ.', 'กุมภา'], ['มี.ค.', 'มีนา'], ['เม.ย.', 'เมษา'], ['พ.ค.', 'พฤษภา'], ['มิ.ย.', 'มิถุนา'],
    ['ก.ค.', 'กรกฎา'], ['ส.ค.', 'สิงหา'], ['ก.ย.', 'กันยา'], ['ต.ค.', 'ตุลา'], ['พ.ย.', 'พฤศจิกา'], ['ธ.ค.', 'ธันวา']];

  // ---------- AI จำลอง ----------
  function geminiReply(obj) {
    return { code: 200, text: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) };
  }

  function mockGemini(payload) {
    var parts = payload.contents[0].parts;
    var prompt = parts[0].text;
    var task = (prompt.match(/^TASK: (\w+)/) || [])[1];
    var species = (db.Species ? db.Species.rows : []).filter(function (s) { return s.status !== 'archived'; });

    if (task === 'identify') {
      var shuffled = species.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 2);
      var conf = [0.55 + Math.random() * 0.35, 0.15 + Math.random() * 0.2];
      var cands = shuffled.map(function (s, i) {
        return {
          thai_name: s.thai_name, local_name: s.local_name, common_name: s.common_name,
          scientific_name: s.scientific_name, family: s.family, confidence: Math.round(conf[i] * 100) / 100,
          reason: '(โหมดทดลอง — คำตอบสุ่ม ไม่ได้วิเคราะห์รูปจริง) ลักษณะ: ' + [s.habit, s.leaf_type, s.leaf_arrangement].filter(String).join(', ')
        };
      });
      cands.push({ thai_name: 'แก้ว', local_name: 'แก้วขาว', common_name: 'Orange jessamine', scientific_name: 'Murraya paniculata (L.) Jack',
        family: 'Rutaceae', confidence: 0.12, reason: '(โหมดทดลอง) ใบประกอบแบบขนนก ดอกสีขาว' });
      var top = shuffled[0] || {};
      var morph = {};
      ['habit', 'bark', 'leaf_type', 'leaf_arrangement', 'leaf_shape', 'leaf_apex', 'leaf_base', 'leaf_margin', 'leaf_venation',
        'flower_type', 'flower_color', 'fruit_type'].forEach(function (k) { if (top[k]) morph[k] = String(top[k]).split(',')[0].trim(); });
      return geminiReply({
        candidates: cands, morphology: morph,
        photo_issues: Math.random() < 0.5 ? ['(ตัวอย่าง) รูปใบค่อนข้างเบลอ ลองถ่ายใหม่ให้ชัดขึ้น'] : [],
        needs_more_photos: ['ดอก'], has_human_face: false
      });
    }
    if (task === 'search') {
      var q = (prompt.match(/คำค้น: "([^"]*)"/) || [])[1] || '';
      var out = { explain: '(โหมดทดลอง) ตีความจากคำสำคัญในประโยค' };
      var colors = ['ขาว', 'ครีม', 'เหลือง', 'ส้ม', 'แดง', 'ชมพู', 'ม่วง', 'เขียว'].filter(function (c) { return q.indexOf(c) >= 0; });
      if (colors.length) out.flower_color = colors;
      var habits = ['ไม้ต้น', 'ไม้พุ่ม', 'ไม้เลื้อย', 'ปาล์ม', 'ไผ่', 'เฟิร์น', 'กล้วยไม้'].filter(function (c) { return q.indexOf(c) >= 0; });
      if (habits.length) out.habit = habits;
      var months = ['มกรา', 'กุมภา', 'มีนา', 'เมษา', 'พฤษภา', 'มิถุนา', 'กรกฎา', 'สิงหา', 'กันยา', 'ตุลา', 'พฤศจิกา', 'ธันวา'];
      var m = [];
      months.forEach(function (name, i) { if (q.indexOf(name) >= 0) m.push(i + 1); });
      if (m.length) out.flowering_month = m;
      if (/ยา|สมุนไพร/.test(q)) out.use = ['medicine'];
      if (/กินได้|อาหาร/.test(q)) out.use = (out.use || []).concat('food');
      if (!colors.length && !habits.length && !m.length && !out.use) out.text = q;
      return geminiReply(out);
    }
    if (task === 'chat') {
      var last = payload.contents[payload.contents.length - 1].parts[0].text;
      var verified = species.filter(function (s) { return s.status === 'verified'; });
      var hit = verified.filter(function (s) {
        return (s.thai_name && last.indexOf(s.thai_name) >= 0) || (s.local_name && s.local_name.split(',').some(function (n) { return n.trim() && last.indexOf(n.trim()) >= 0; }));
      });
      var ans;
      if (hit.length) {
        var s = hit[0];
        ans = s.thai_name + ' (' + s.scientific_name + ') วงศ์ ' + s.family + ' เป็น' + (s.habit || 'พรรณไม้') +
          (s.flowering_season ? ' ออกดอกช่วง ' + s.flowering_season : '') + (s.flower_color ? ' ดอกสี' + s.flower_color : '') +
          ([s.use_medicine, s.use_food, s.use_construction, s.use_culture].filter(Boolean).length ? ' ประโยชน์: ' + [s.use_medicine, s.use_food, s.use_construction, s.use_culture].filter(Boolean).join(' / ') : '');
      } else if (/ยา|สมุนไพร/.test(last)) {
        hit = verified.filter(function (s) { return s.use_medicine; });
        ans = hit.length ? 'ต้นไม้ในโรงเรียนที่มีข้อมูลการใช้เป็นยา: ' + hit.map(function (s) { return s.thai_name; }).join(', ') + ' — ควรปรึกษาผู้รู้ก่อนนำไปใช้จริง' : 'ยังไม่มีข้อมูลสมุนไพรในทะเบียน';
      } else if (/ดอก/.test(last)) {
        var m = UI_MONTHS.filter(function (x) { return last.indexOf(x[1]) >= 0; })[0] || UI_MONTHS[new Date().getMonth()];
        hit = verified.filter(function (s) { return String(s.flowering_season).indexOf(m[0]) >= 0; });
        ans = hit.length ? 'ช่วงเดือน' + m[1] + 'ต้นที่ออกดอก: ' + hit.map(function (s) { return s.thai_name; }).join(', ') : 'ยังไม่มีข้อมูลต้นที่ออกดอกช่วงนั้น';
      } else {
        ans = '(โหมดทดลอง) ลองถามชื่อต้นไม้ เช่น "ราชพฤกษ์ใช้ทำอะไร" หรือ "ต้นไหนเป็นสมุนไพร" หรือ "เดือนเมษายนต้นอะไรออกดอก"';
      }
      return geminiReply({ answer: ans, species_ids: hit.slice(0, 5).map(function (s) { return s.species_id; }) });
    }
    if (task === 'describe') {
      var facts = {};
      try { facts = JSON.parse(prompt.split('\n')[3]); } catch (e) { /* ignore */ }
      var bits = [];
      if (facts.habit) bits.push(facts.habit);
      if (facts.bark) bits.push('เปลือก' + facts.bark);
      if (facts.leaf_type) bits.push(facts.leaf_type + (facts.leaf_arrangement ? ' ' + facts.leaf_arrangement : ''));
      if (facts.leaf_shape) bits.push('แผ่นใบ' + facts.leaf_shape + (facts.leaf_apex ? ' ปลาย' + facts.leaf_apex : '') + (facts.leaf_base ? ' โคน' + facts.leaf_base : '') + (facts.leaf_margin ? ' ขอบ' + facts.leaf_margin : ''));
      if (facts.flower_type) bits.push('ดอกออกเป็น' + facts.flower_type + (facts.flower_color ? ' สี' + facts.flower_color : ''));
      if (facts.fruit_type) bits.push('ผลแบบ' + facts.fruit_type);
      return geminiReply({ description: bits.join(' ') + ' (ร่างจากโหมดทดลอง)' });
    }
    return { code: 400, text: '{"error":{"message":"mock: unknown task"}}' };
  }

  return {
    isMock: true,

    readTable: function (name) {
      var t = table(name);
      return { headers: t.headers.slice(), rows: t.rows.map(function (r, i) { return Object.assign({ _row: i + 2 }, r); }) };
    },
    appendRow: function (name, headers, obj) { table(name).rows.push(norm(headers, obj)); save(); },
    appendRows: function (name, headers, objs) {
      var t = table(name);
      objs.forEach(function (o) { t.rows.push(norm(headers, o)); });
      save();
    },
    writeRow: function (name, headers, row, obj) { table(name).rows[row - 2] = norm(headers, obj); save(); },
    deleteRow: function (name, row) { table(name).rows.splice(row - 2, 1); save(); },
    replaceTable: function (name, headers, objs) { table(name).rows = objs.map(function (o) { return norm(headers, o); }); save(); },
    ensureSheet: function (name, headers) {
      if (!db[name]) db[name] = { headers: headers.slice(), rows: [] };
      else headers.forEach(function (h) { if (db[name].headers.indexOf(h) < 0) db[name].headers.push(h); });
      save();
      return db[name].headers;
    },

    cacheGet: function (key) {
      var c = cache[key];
      if (!c) return null;
      if (c.exp < Date.now()) { delete cache[key]; store(CACHE_KEY, cache); return null; }
      return c.v;
    },
    cachePut: function (key, value, seconds) {
      if (/^boot_|^lists$|^settings$/.test(key)) return; // โหมดทดลองไม่ต้อง cache ข้อมูล
      cache[key] = { v: String(value), exp: Date.now() + seconds * 1000 };
      store(CACHE_KEY, cache);
    },
    cacheRemove: function (key) { delete cache[key]; store(CACHE_KEY, cache); },

    prop: function (key) { return props[key] || null; },
    setProp: function (key, value) { if (value) props[key] = value; else delete props[key]; store(PROP_KEY, props); },

    sha256Hex: sha256HexSync,
    uuid: uuid,
    withLock: function (fn) { return fn(); },

    createFolder: function () { return 'folder_' + uuid(); },
    renameFolder: function () { },
    saveFile: function (folderId, fileName, mime, base64) {
      var id = 'file_' + uuid();
      files[id] = 'data:' + mime + ';base64,' + base64;
      try { localStorage.setItem(FILE_PREFIX + id, files[id]); } catch (e) {
        console.warn('โหมดทดลอง: พื้นที่เก็บรูปในเบราว์เซอร์เต็ม รูปนี้จะหายเมื่อรีเฟรช');
      }
      return { id: id, shared: true };
    },
    trashFile: function (id) { delete files[id]; try { localStorage.removeItem(FILE_PREFIX + id); } catch (e) { /* ignore */ } },
    fileUrls: function (id) { var d = fileData(id); return { thumb: d, full: d }; },
    fileBase64: function (id) {
      var d = fileData(id) || 'data:image/jpeg;base64,';
      var m = d.match(/^data:([^;]+);base64,(.*)$/);
      return { mime: m ? m[1] : 'image/jpeg', data: m ? m[2] : '' };
    },

    fetch: function (url, options) {
      if (url.indexOf('generativelanguage.googleapis.com') >= 0) return mockGemini(JSON.parse(options.payload));
      return { code: 404, text: 'mock: no network' };
    },
    fetchMultipartImages: function () {
      return { code: 200, text: JSON.stringify({ results: [] }) };
    },

    sendMail: function (to, subject, body) { console.info('[โหมดทดลอง] อีเมลถึง', to, subject, body); },

    now: function () { return new Date(); },
    today: function () {
      var d = new Date(Date.now() + 7 * 3600 * 1000);
      return d.toISOString().slice(0, 10);
    },

    /** ล้างข้อมูลโหมดทดลองทั้งหมด */
    resetAll: function () {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('bmf_mock_') === 0) localStorage.removeItem(k); });
      db = {}; cache = {}; props = {}; files = {};
    }
  };
})();

/** ข้อมูลตัวอย่างสำหรับโหมดทดลอง */
function seedDemo() {
  if (Platform.prop('DEMO_SEEDED')) return;
  setupCore();
  DB.reset();
  var now = nowIso();
  var setPw = function (u, pw) { var salt = Platform.uuid(); u.salt = salt; u.password_hash = Auth.hash(salt, pw); return u; };

  var admin = DB.filter('Users', function (u) { return u.role === 'admin'; })[0];
  DB.update('Users', 'user_id', admin.user_id, setPw({}, 'admin1234'));
  var users = [
    { username: 'teacher', full_name: 'ครูสมศรี รักต้นไม้', nickname: 'ครูศรี', role: 'teacher', class: '', number: '', group: '' },
    { username: '10001', full_name: 'ด.ญ.มานี มีใจ', nickname: 'มานี', role: 'leader', class: 'ม.2/3', number: '5', group: 'กลุ่มราชพฤกษ์' },
    { username: '10002', full_name: 'ด.ช.สมชาย ใจดี', nickname: 'ชาย', role: 'student', class: 'ม.2/3', number: '15', group: 'กลุ่มราชพฤกษ์' },
    { username: '10003', full_name: 'ด.ญ.ปิติ ยินดี', nickname: 'ปิติ', role: 'student', class: 'ม.2/4', number: '8', group: 'กลุ่มประดู่' },
    { username: '10004', full_name: 'ด.ช.วีระ กล้าหาญ', nickname: 'วีระ', role: 'student', class: 'ม.2/4', number: '20', group: 'กลุ่มประดู่' }
  ];
  users.forEach(function (u, i) {
    var row = Object.assign({ user_id: DB.nextId('Users', 'user_id', 'U', 4), status: 'active', points: 0, created_at: now }, u);
    if (u.username !== '10004') setPw(row, u.username === 'teacher' ? '123456' : '123456');
    DB.insert('Users', row);
  });
  var uid = function (username) { return DB.find('Users', 'username', username).user_id; };

  // ศูนย์กลางแผนที่
  var c = getSettings().map_center.split(',').map(Number);
  // หน่วยของ dy/dx ≈ 0.11 เมตร (พื้นที่ตัวอย่างกว้างราว 200 ม.)
  var at = function (dy, dx) { return [Math.round((c[0] + dy * 0.000001) * 1e6) / 1e6, Math.round((c[1] + dx * 0.000001) * 1e6) / 1e6]; };
  var rect = function (y1, x1, y2, x2) { return [at(y1, x1), at(y1, x2), at(y2, x2), at(y2, x1)]; };

  DB.update('Settings', 'key', 'postal_code', { value: '99999', note: 'ค่าทดลอง — เปลี่ยนเป็นรหัสไปรษณีย์จริงของโรงเรียน' });
  DB.update('Settings', 'key', 'school_boundary', { value: JSON.stringify(rect(-900, -1100, 900, 1100)) });
  [['หน้าอาคาร 1', '#2f855a', rect(200, -900, 800, 0)], ['สวนสมุนไพร', '#b7791f', rect(200, 100, 800, 1000)],
    ['ริมสระน้ำ', '#2b6cb0', rect(-800, -900, 100, 1000)]].forEach(function (z, i) {
    DB.insert('Zones', { zone_id: 'Z0' + (i + 1), name: z[0], description: '', color: z[1], polygon: JSON.stringify(z[2]) });
  });

  var species = [
    { thai_name: 'ราชพฤกษ์', local_name: 'คูน, ลมแล้ง', common_name: 'Golden shower', scientific_name: 'Cassia fistula L.', genus: 'Cassia', species_epithet: 'fistula', author: 'L.',
      family: 'Fabaceae', order: 'Fabales', origin: 'พืชพื้นเมือง', habit: 'ไม้ต้น', bark: 'เรียบ', leaf_type: 'ใบประกอบแบบขนนกชั้นเดียว', leaf_arrangement: 'เรียงสลับ',
      leaf_shape: 'รูปไข่', leaf_apex: 'แหลม', leaf_base: 'รูปลิ่ม', leaf_margin: 'เรียบ', leaf_venation: 'แบบร่างแหขนนก', flower_type: 'ช่อกระจะ', flower_color: 'เหลือง',
      symmetry: 'สมมาตรด้านข้าง', flowering_season: 'ก.พ., มี.ค., เม.ย., พ.ค.', fruit_type: 'ฝักแตกสองตะเข็บ', fruit_color: 'น้ำตาล, ดำ', fruiting_season: 'ก.ค., ส.ค., ก.ย.',
      use_medicine: 'เนื้อในฝักใช้เป็นยาระบาย (ข้อมูลตัวอย่าง)', use_culture: 'ต้นไม้ประจำชาติไทย', info_source: 'ข้อมูลตัวอย่างในโหมดทดลอง' },
    { thai_name: 'มะม่วง', local_name: 'มะม่วงบ้าน', common_name: 'Mango', scientific_name: 'Mangifera indica L.', genus: 'Mangifera', species_epithet: 'indica', author: 'L.',
      family: 'Anacardiaceae', order: 'Sapindales', origin: 'พืชต่างถิ่น', habit: 'ไม้ต้น', bark: 'แตกเป็นร่อง', latex: 'น้ำยางใส', leaf_type: 'ใบเดี่ยว', leaf_arrangement: 'เรียงเป็นกระจุก',
      leaf_shape: 'รูปใบหอก', leaf_apex: 'เรียวแหลม', leaf_base: 'รูปลิ่ม', leaf_margin: 'เป็นคลื่น', leaf_venation: 'แบบร่างแหขนนก', leaf_texture: 'คล้ายแผ่นหนัง',
      flower_type: 'ช่อแยกแขนง', flower_color: 'ครีม', flowering_season: 'ธ.ค., ม.ค., ก.พ.', fruit_type: 'ผลมีเมล็ดแข็ง', fruit_color: 'เขียว, เหลือง', fruiting_season: 'มี.ค., เม.ย., พ.ค.',
      use_food: 'ผลดิบและผลสุกรับประทานได้', info_source: 'ข้อมูลตัวอย่างในโหมดทดลอง' },
    { thai_name: 'ประดู่บ้าน', local_name: 'ประดู่อังสนา', common_name: 'Burmese rosewood', scientific_name: 'Pterocarpus indicus Willd.', genus: 'Pterocarpus', species_epithet: 'indicus', author: 'Willd.',
      family: 'Fabaceae', origin: 'พืชพื้นเมือง', habit: 'ไม้ต้น', bark: 'แตกเป็นร่อง', latex: 'น้ำยางสีแดง', leaf_type: 'ใบประกอบแบบขนนกชั้นเดียว', leaf_arrangement: 'เรียงสลับ',
      leaf_shape: 'รูปไข่', leaf_apex: 'เรียวแหลม', leaf_base: 'มน', leaf_margin: 'เรียบ', flower_type: 'ช่อแยกแขนง', flower_color: 'เหลือง', scent: 'หอมอ่อน',
      flowering_season: 'มี.ค., เม.ย.', fruit_type: 'ผลมีปีก', fruiting_season: 'ก.ค., ส.ค.', use_construction: 'เนื้อไม้ใช้ทำเครื่องเรือน', info_source: 'ข้อมูลตัวอย่างในโหมดทดลอง' },
    { thai_name: 'ชบา', local_name: 'ใหม่, ชุมเบา', common_name: 'Chinese hibiscus', scientific_name: 'Hibiscus rosa-sinensis L.', genus: 'Hibiscus', species_epithet: 'rosa-sinensis', author: 'L.',
      family: 'Malvaceae', origin: 'พืชต่างถิ่น', habit: 'ไม้พุ่ม', leaf_type: 'ใบเดี่ยว', leaf_arrangement: 'เรียงสลับ', leaf_shape: 'รูปไข่', leaf_apex: 'แหลม', leaf_base: 'มน',
      leaf_margin: 'จักฟันเลื่อย', leaf_venation: 'แบบร่างแหนิ้วมือ', flower_type: 'ดอกเดี่ยว', flower_color: 'แดง', symmetry: 'สมมาตรตามรัศมี',
      flowering_season: 'ม.ค., ก.พ., มี.ค., เม.ย., พ.ค., มิ.ย., ก.ค., ส.ค., ก.ย., ต.ค., พ.ย., ธ.ค.', use_culture: 'นิยมปลูกเป็นไม้ประดับ', info_source: 'ข้อมูลตัวอย่างในโหมดทดลอง' },
    { thai_name: 'หมากเหลือง', local_name: '', common_name: 'Golden cane palm', scientific_name: 'Dypsis lutescens (H.Wendl.) Beentje & J.Dransf.', genus: 'Dypsis', species_epithet: 'lutescens',
      family: 'Arecaceae', origin: 'พืชต่างถิ่น', habit: 'ปาล์ม', leaf_type: 'ใบประกอบแบบขนนกชั้นเดียว', leaf_venation: 'แบบขนาน', flower_type: 'ช่อแยกแขนง', flower_color: 'ครีม',
      use_culture: 'ไม้ประดับ', info_source: 'ข้อมูลตัวอย่างในโหมดทดลอง' }
  ];
  species.forEach(function (s, i) {
    DB.insert('Species', Object.assign({
      species_id: 'SP' + pad(i + 1, 3), species_code: pad(i + 1, 3), status: 'verified', created_by: uid('10001'),
      verified_by: uid('teacher'), verified_at: now, created_at: now, updated_at: now
    }, s));
  });

  var trees = [
    ['SP001', 500, -600, 9, 140, 7, 'Z01'], ['SP001', 650, -300, 7.5, 98, 6, 'Z01'], ['SP001', -200, 400, 8, 120, 6.5, 'Z03'],
    ['SP002', 400, 300, 10, 160, 9, 'Z02'], ['SP002', 700, 700, 6, 75, 5, 'Z02'],
    ['SP003', -500, -500, 14, 210, 10, 'Z03'], ['SP004', 300, -100, 2, 0, 1.5, 'Z01'], ['SP005', -300, -800, 4, 0, 2.5, 'Z03']
  ];
  var seq = {};
  trees.forEach(function (t, i) {
    seq[t[0]] = (seq[t[0]] || 0) + 1;
    var p = at(t[1], t[2]);
    DB.insert('Trees', {
      tree_id: 'T' + pad(i + 1, 4), tree_code: '7-99999-' + t[0].slice(2) + '-' + pad(seq[t[0]], 3), species_id: t[0], zone_id: t[6],
      lat: p[0], lng: p[1], gps_accuracy_m: 4, gps_method: 'gps', height_m: t[3], gbh_cm: t[4] || '', dbh_cm: t[4] ? Math.round(t[4] / Math.PI * 10) / 10 : '',
      canopy_m: t[5], planting_source: 'ปลูกเอง', health: 'ดี', label_status: i % 3 ? 'ติดป้ายสมบูรณ์' : 'ยังไม่มีป้าย', status: 'verified',
      created_by: i % 2 ? uid('10002') : uid('10003'), verified_by: uid('teacher'), verified_at: now, submitted_at: now, created_at: now, updated_at: now
    });
  });

  // ชนิดใหม่ที่นักเรียนเสนอ + งานที่รอตรวจ / ถูกส่งกลับ
  DB.insert('Species', { species_id: 'SP006', thai_name: 'แก้ว', local_name: 'แก้วขาว', scientific_name: 'Murraya paniculata (L.) Jack', family: 'Rutaceae',
    habit: 'ไม้พุ่ม', leaf_type: 'ใบประกอบแบบขนนกชั้นเดียว', leaf_arrangement: 'เรียงสลับ', flower_color: 'ขาว', scent: 'หอมแรง',
    status: 'draft', ai_suggested: 'TRUE', ai_confidence: '0.71', created_by: uid('10002'), created_at: now, updated_at: now });
  var p1 = at(350, 450), p2 = at(-400, 200), p3 = at(600, 200);
  DB.insert('Trees', { tree_id: 'T0009', tree_code: 'TMP-0009', species_id: 'SP006', zone_id: 'Z02', lat: p1[0], lng: p1[1], gps_accuracy_m: 6.2, gps_method: 'gps+adjusted',
    height_m: 2.5, canopy_m: 2, health: 'ดี', planting_source: 'ปลูกเอง', label_status: 'ยังไม่มีป้าย', status: 'submitted', created_by: uid('10002'), submitted_at: now, created_at: now, updated_at: now });
  DB.insert('Trees', { tree_id: 'T0010', tree_code: 'TMP-0010', species_id: 'SP002', zone_id: 'Z03', lat: p2[0], lng: p2[1], gps_accuracy_m: 12, gps_method: 'gps',
    height_m: 8, gbh_cm: 90, dbh_cm: 28.6, canopy_m: 6, health: 'ปานกลาง', label_status: 'ยังไม่มีป้าย', status: 'returned', created_by: uid('10002'), submitted_at: now, created_at: now, updated_at: now });
  DB.insert('Trees', { tree_id: 'T0011', tree_code: 'TMP-0011', species_id: 'UNKNOWN', zone_id: 'Z01', lat: p3[0], lng: p3[1], gps_accuracy_m: 5, gps_method: 'gps',
    height_m: 5, health: 'ดี', label_status: 'ยังไม่มีป้าย', status: 'pending_teacher', created_by: uid('10003'), submitted_at: now, created_at: now, updated_at: now });
  DB.insert('Reviews', { review_id: 'R00001', tree_id: 'T0010', reviewer: uid('teacher'), role: 'teacher', decision: 'comment', field: 'gps',
    comment: 'พิกัดคลาดเคลื่อน 12 ม. ลองลากหมุดให้ตรงทรงพุ่มในภาพดาวเทียม', created_at: now });
  DB.insert('Reviews', { review_id: 'R00002', tree_id: 'T0010', reviewer: uid('teacher'), role: 'teacher', decision: 'return', field: '', comment: '', created_at: now });
  // งานภาคสนามตัวอย่าง: ชีพลักษณ์ การวัดซ้ำ การดูแล ปัญหา สิ่งมีชีวิตร่วม ตัวอย่างแห้ง เส้นทาง อาคาร ภารกิจ
  var monthsAgo = function (n, day) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 8) + pad(day || 10, 2); };
  var lv = ['ไม่มี', 'น้อย', 'ปานกลาง', 'มาก'];
  for (var k = 0; k < 8; k++) {
    var dt = monthsAgo(k), m = Number(dt.slice(5, 7));
    var flowering = m >= 2 && m <= 5;
    DB.insert('Phenology', { record_id: 'PH' + pad(k + 1, 5), tree_id: 'T0001', date: dt, new_leaf: lv[m >= 4 && m <= 6 ? 2 : 0], leaf_fall: lv[m <= 3 ? 2 : 0],
      flower_bud: lv[m === 2 ? 2 : 0], flowering: lv[flowering ? 3 : 0], fruiting: lv[m >= 6 && m <= 9 ? 2 : 0], ripe_fruit: lv[m >= 8 && m <= 10 ? 1 : 0],
      note: '', recorded_by: uid('10002'), created_at: now });
  }
  [[24, 120, 7.5, 5], [12, 131, 8.2, 6], [0, 140, 9, 7]].forEach(function (x, i) {
    DB.insert('Measurements', { measure_id: 'M' + pad(i + 1, 5), tree_id: 'T0001', date: monthsAgo(x[0], 5), height_m: x[2], gbh_cm: x[1],
      dbh_cm: Math.round(x[1] / Math.PI * 10) / 10, canopy_m: x[3], health: 'ดี', note: '', recorded_by: uid('10003'), created_at: now });
  });
  DB.insert('CareLog', { care_id: 'C00001', tree_id: 'T0001', date: monthsAgo(1, 15), type: 'ใส่ปุ๋ย', note: 'ปุ๋ยคอก 2 กก.', recorded_by: uid('teacher'), created_at: now });
  DB.insert('Issues', { issue_id: 'IS0001', tree_id: 'T0006', type: 'กิ่งหัก/กิ่งแห้ง', description: 'กิ่งด้านทิศเหนือหักห้อยลงมา อยู่เหนือทางเดิน', status: 'open', reported_by: uid('10003'), reported_at: now });
  DB.insert('Fauna', { fauna_id: 'F0001', tree_id: 'T0001', type: 'นก', name: 'นกกินปลีอกเหลือง', scientific_name: 'Cinnyris jugularis', notes: 'มาดูดน้ำหวานช่วงออกดอก', recorded_by: uid('10002'), recorded_at: now });
  DB.insert('Fauna', { fauna_id: 'F0002', tree_id: 'T0006', type: 'ไลเคน', name: 'ไลเคนแบบครัสโตส', notes: 'บนเปลือกด้านทิศใต้', recorded_by: uid('10003'), recorded_at: now });
  DB.insert('Herbarium', { specimen_id: 'H0001', specimen_no: 'BMF-2569-001', tree_id: 'T0004', species_id: 'SP002', collected_at: monthsAgo(2, 20),
    collector: 'ด.ญ.ปิติ ยินดี', location_note: 'กิ่งด้านล่างทิศตะวันออก', notes: 'อัดแห้ง 2 สัปดาห์', created_by: uid('10003'), created_at: now });
  DB.insert('Routes', { route_id: 'RT01', name: 'เส้นทางไม้ดอกสีเหลือง', description: 'เดินชมไม้ดอกสีเหลืองรอบโรงเรียน เริ่มที่หน้าอาคาร 1',
    tree_ids: 'T0001,T0002,T0007,T0004,T0003,T0006', color: '#d69e2e', published: 'TRUE', created_by: uid('teacher'), updated_at: now });
  DB.insert('Buildings', { building_id: 'B01', name: 'อาคาร 1', polygon: JSON.stringify(rect(250, -250, 550, 150)), height_m: 12, color: '#e2e8f0' });
  DB.insert('Buildings', { building_id: 'B02', name: 'อาคาร 2 (โรงอาหาร)', polygon: JSON.stringify(rect(-700, 300, -450, 800)), height_m: 6, color: '#edf2f7' });
  DB.insert('Missions', { mission_id: 'MS001', title: 'สำรวจโซนริมสระให้ครบ', description: 'บันทึกต้นไม้ในโซนริมสระน้ำให้ครบทุกต้น', zone_id: 'Z03',
    group: 'กลุ่มราชพฤกษ์', due_date: monthsAgo(-1, 15), target_count: 10, created_by: uid('teacher'), created_at: monthsAgo(3, 1), status: 'active' });
  DB.update('Users', 'user_id', uid('10002'), { email: 'chai@example.com' });

  DB.update('Users', 'user_id', uid('10002'), { points: 90 });
  DB.update('Users', 'user_id', uid('10003'), { points: 60 });
  DB.insert('Badges', { user_id: uid('10002'), badge: 'นักสำรวจมือใหม่', earned_at: now });
  Platform.setProp('GEMINI_API_KEY', 'mock-key');
  Platform.setProp('DEMO_SEEDED', '1');
  bustCache();
  DB.reset();
}
