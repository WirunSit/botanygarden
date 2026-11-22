/**
 * Auth.gs — ล็อกอิน รหัสผ่าน session และสิทธิ์
 */

var ROLE_LEVEL = { guest: 0, student: 1, leader: 2, teacher: 3, admin: 4 };
var SESSION_SECONDS = 6 * 60 * 60;
var MAX_FAILS = 5;
var LOCK_SECONDS = 10 * 60;

var Auth = {
  /** สร้าง context ของผู้เรียกจาก token */
  context: function (token) {
    var guest = { user: null, role: 'guest', level: 0, token: null };
    if (!token) return guest;
    var uid = Platform.cacheGet('tok_' + token);
    if (!uid) return Object.assign(guest, { expired: true });
    var user = DB.find('Users', 'user_id', uid);
    if (!user || user.status === 'disabled') return guest;
    Platform.cachePut('tok_' + token, uid, SESSION_SECONDS); // ต่ออายุ session เมื่อมีการใช้งาน
    var role = ROLE_LEVEL[user.role] !== undefined ? user.role : 'student';
    return { user: user, role: role, level: ROLE_LEVEL[role], token: token };
  },

  hash: function (salt, password) {
    return Platform.sha256Hex(salt + ':' + password);
  },

  publicUser: function (u) {
    if (!u) return null;
    return {
      user_id: u.user_id, username: u.username, full_name: u.full_name, nickname: u.nickname,
      class: u.class, number: u.number, role: u.role, group: u.group, points: num(u.points) || 0
    };
  },

  issueToken: function (user) {
    var token = Platform.uuid();
    Platform.cachePut('tok_' + token, user.user_id, SESSION_SECONDS);
    DB.update('Users', 'user_id', user.user_id, { last_login: nowIso() });
    return token;
  },

  login: function (d) {
    var username = str(d.username);
    if (!username) fail('กรุณากรอกชื่อผู้ใช้');
    var failKey = 'fail_' + username;
    var fails = num(Platform.cacheGet(failKey)) || 0;
    if (fails >= MAX_FAILS) fail('ใส่รหัสผ่านผิดหลายครั้ง กรุณารอ 10 นาทีแล้วลองใหม่');

    var user = DB.find('Users', 'username', username);
    var bad = function () {
      Platform.cachePut(failKey, String(fails + 1), LOCK_SECONDS);
      fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    };
    if (!user) bad();
    if (user.status === 'disabled') fail('บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อครู');

    if (!user.password_hash) {
      // เข้าครั้งแรก หรือครูรีเซ็ตรหัสผ่าน → ให้ตั้งรหัสผ่านใหม่
      return { needSetPassword: true, username: user.username, full_name: user.full_name };
    }
    if (Auth.hash(user.salt, String(d.password || '')) !== user.password_hash) bad();

    Platform.cacheRemove(failKey);
    return { token: Auth.issueToken(user), user: Auth.publicUser(user) };
  },

  setPassword: function (d, ctx) {
    var username = str(d.username) || (ctx.user && ctx.user.username);
    var password = String(d.password || '');
    if (password.length < 6) fail('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    var user = DB.find('Users', 'username', username);
    if (!user) fail('ไม่พบผู้ใช้');
    if (user.status === 'disabled') fail('บัญชีนี้ถูกปิดใช้งาน');

    if (user.password_hash) {
      // เปลี่ยนรหัสผ่าน ต้องล็อกอินอยู่และรู้รหัสเดิม
      if (!ctx.user || ctx.user.user_id !== user.user_id) fail('กรุณาเข้าสู่ระบบก่อนเปลี่ยนรหัสผ่าน');
      if (Auth.hash(user.salt, String(d.oldPassword || '')) !== user.password_hash) fail('รหัสผ่านเดิมไม่ถูกต้อง');
    }
    var salt = Platform.uuid();
    DB.update('Users', 'user_id', user.user_id, { salt: salt, password_hash: Auth.hash(salt, password) });
    logActivity({ user: user }, 'setPassword', user.user_id);
    var fresh = DB.find('Users', 'user_id', user.user_id);
    return { token: Auth.issueToken(fresh), user: Auth.publicUser(fresh) };
  },

  /** ลืมรหัสผ่าน: ส่งรหัส 6 หลักไปที่อีเมลที่ครูบันทึกไว้ */
  requestReset: function (d) {
    var username = str(d.username);
    var user = DB.find('Users', 'username', username);
    if (!user || user.status === 'disabled' || !str(user.email)) {
      fail('บัญชีนี้ไม่มีอีเมลในระบบ — กรุณาแจ้งครูให้รีเซ็ตรหัสผ่านให้');
    }
    if (Platform.cacheGet('resetwait_' + username)) fail('เพิ่งส่งรหัสไปแล้ว กรุณารอ 1 นาทีแล้วลองใหม่');
    var code = String(100000 + Math.floor(Math.random() * 900000));
    Platform.cachePut('reset_' + username, code, 30 * 60);
    Platform.cachePut('resetwait_' + username, '1', 60);
    var s = getSettings();
    Platform.sendMail(user.email, '[' + s.system_name + '] รหัสสำหรับตั้งรหัสผ่านใหม่',
      'รหัสสำหรับตั้งรหัสผ่านใหม่ของ ' + user.full_name + ' คือ ' + code + '\nรหัสนี้ใช้ได้ 30 นาที\nถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร');
    logActivity({ user: user }, 'requestReset', user.user_id);
    var e = String(user.email), at = e.indexOf('@');
    var out = { sent: true, email_hint: e.slice(0, Math.min(2, at)) + '***' + e.slice(at) };
    if (Platform.isMock) out.demo_code = code; // โหมดทดลองไม่มีอีเมลจริง
    return out;
  },

  resetWithCode: function (d) {
    var username = str(d.username);
    var failKey = 'fail_' + username;
    var fails = num(Platform.cacheGet(failKey)) || 0;
    if (fails >= MAX_FAILS) fail('ใส่รหัสผิดหลายครั้ง กรุณารอ 10 นาทีแล้วลองใหม่');
    var code = Platform.cacheGet('reset_' + username);
    if (!code || code !== str(d.code)) {
      Platform.cachePut(failKey, String(fails + 1), LOCK_SECONDS);
      fail('รหัสไม่ถูกต้องหรือหมดอายุ');
    }
    if (String(d.password || '').length < 6) fail('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    var user = DB.find('Users', 'username', username);
    var salt = Platform.uuid();
    DB.update('Users', 'user_id', user.user_id, { salt: salt, password_hash: Auth.hash(salt, String(d.password)) });
    Platform.cacheRemove('reset_' + username);
    Platform.cacheRemove(failKey);
    logActivity({ user: user }, 'resetWithCode', user.user_id);
    var fresh = DB.find('Users', 'user_id', user.user_id);
    return { token: Auth.issueToken(fresh), user: Auth.publicUser(fresh) };
  },

  logout: function (d, ctx) {
    if (ctx.token) Platform.cacheRemove('tok_' + ctx.token);
    return true;
  },

  me: function (d, ctx) {
    var uid = ctx.user.user_id;
    var mine = DB.filter('Trees', function (t) { return t.created_by === uid && t.status !== STATUS.DELETED; });
    var counts = {};
    mine.forEach(function (t) { counts[t.status] = (counts[t.status] || 0) + 1; });
    var badges = DB.filter('Badges', function (b) { return b.user_id === uid; }).map(function (b) { return b.badge; });
    return {
      user: Auth.publicUser(ctx.user),
      counts: counts,
      total: mine.length,
      badges: badges,
      returned: mine.filter(function (t) { return t.status === STATUS.RETURNED; }).map(function (t) { return t.tree_id; })
    };
  }
};

function requireLevel(ctx, min) {
  if (ctx.level < min) {
    if (!ctx.user) fail(ctx.expired ? 'SESSION_EXPIRED' : 'กรุณาเข้าสู่ระบบ');
    fail('คุณไม่มีสิทธิ์ทำรายการนี้');
  }
}

/** ชื่อผู้ใช้ที่จะแสดง — หน้าสาธารณะไม่แสดงชื่อ-นามสกุลเต็ม */
function displayName(userId, ctx, usersById) {
  var u = usersById ? usersById[userId] : DB.find('Users', 'user_id', userId);
  if (!u) return '';
  if (ctx && ctx.user) return u.nickname ? u.full_name + ' (' + u.nickname + ')' : u.full_name;
  var mode = getSettings().public_show_student_name;
  if (u.role === 'teacher' || u.role === 'admin') return u.full_name;
  if (mode === 'none') return '';
  if (mode === 'class_only') return u.class ? 'นักเรียน ' + u.class : 'นักเรียน';
  return (u.nickname || 'นักเรียน') + (u.class ? ' ' + u.class : '');
}

function usersIndex() {
  var idx = {};
  DB.all('Users').forEach(function (u) { idx[u.user_id] = u; });
  return idx;
}
