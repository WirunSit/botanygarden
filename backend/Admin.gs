/**
 * Admin.gs — จัดการผู้ใช้ นำเข้ารายชื่อ ตั้งค่า โซน รายการตัวเลือก และสถิติ
 */

var USER_EDIT_FIELDS = ['username', 'full_name', 'nickname', 'class', 'number', 'role', 'group', 'email', 'status'];
var SECRET_KEYS = ['GEMINI_API_KEY', 'PLANTNET_API_KEY'];

var Admin = {
  adminUsers: function (d, ctx) {
    var op = d.op || 'list';
    if (op === 'list') {
      var counts = {};
      DB.all('Trees').forEach(function (t) {
        if (t.status === STATUS.DELETED) return;
        var c = counts[t.created_by] = counts[t.created_by] || { total: 0, verified: 0, pending: 0, returned: 0 };
        c.total++;
        if (t.status === STATUS.VERIFIED) c.verified++;
        if (t.status === STATUS.SUBMITTED || t.status === STATUS.PENDING_TEACHER) c.pending++;
        if (t.status === STATUS.RETURNED) c.returned++;
      });
      return DB.all('Users').map(function (u) {
        return Object.assign(Auth.publicUser(u), {
          email: u.email, status: u.status || 'active', has_password: !!u.password_hash,
          last_login: u.last_login, created_at: u.created_at,
          trees: counts[u.user_id] || { total: 0, verified: 0, pending: 0, returned: 0 }
        });
      });
    }
    if (op === 'save') {
      var data = pick(d.user || {}, USER_EDIT_FIELDS);
      Object.keys(data).forEach(function (k) { data[k] = str(data[k]); });
      if (data.role && ROLE_LEVEL[data.role] === undefined) fail('บทบาทไม่ถูกต้อง');
      if (data.username !== undefined && !data.username) fail('กรุณากรอกชื่อผู้ใช้');
      var dup = data.username ? DB.find('Users', 'username', data.username) : null;
      if (d.user.user_id) {
        if (dup && dup.user_id !== d.user.user_id) fail('ชื่อผู้ใช้ ' + data.username + ' มีอยู่แล้ว');
        if (d.user.user_id === ctx.user.user_id && data.role && data.role !== 'admin') fail('เปลี่ยนบทบาทของตัวเองไม่ได้');
        DB.update('Users', 'user_id', d.user.user_id, data);
        logActivity(ctx, 'updateUser', d.user.user_id, data);
        return true;
      }
      if (dup) fail('ชื่อผู้ใช้ ' + data.username + ' มีอยู่แล้ว');
      var u = Object.assign({ role: 'student', status: 'active', points: 0 }, data, {
        user_id: DB.nextId('Users', 'user_id', 'U', 4), created_at: nowIso()
      });
      DB.insert('Users', u);
      logActivity(ctx, 'createUser', u.user_id);
      return { user_id: u.user_id };
    }
    if (op === 'reset') {
      DB.update('Users', 'user_id', d.user_id, { password_hash: '', salt: '' });
      logActivity(ctx, 'resetPassword', d.user_id);
      return true;
    }
    fail('ไม่รู้จักคำสั่ง');
  },

  /** นำเข้ารายชื่อ rows = [{username, full_name, class, number, group, nickname, email, role}] */
  adminImport: function (d, ctx) {
    var created = 0, updated = 0, skipped = [];
    var nextNum = parseInt(DB.nextId('Users', 'user_id', 'U', 4).slice(1), 10);
    var existing = {};
    DB.all('Users').forEach(function (u) { existing[u.username] = u; });
    var toInsert = [];
    (d.rows || []).forEach(function (r, i) {
      var data = pick(r, USER_EDIT_FIELDS);
      Object.keys(data).forEach(function (k) { data[k] = str(data[k]); });
      if (!data.username || !data.full_name) { skipped.push('แถว ' + (i + 1) + ': ไม่มีเลขประจำตัวหรือชื่อ'); return; }
      if (data.role && ROLE_LEVEL[data.role] === undefined) data.role = 'student';
      if (data.role === 'admin') data.role = 'teacher'; // ไม่ให้นำเข้าเป็นผู้ดูแลระบบ
      var ex = existing[data.username];
      if (ex) {
        if (d.update_existing) {
          delete data.role;
          DB.update('Users', 'user_id', ex.user_id, data);
          updated++;
        } else skipped.push(data.username + ': มีอยู่แล้ว');
        return;
      }
      var u = Object.assign({ role: 'student', status: 'active', points: 0 }, data, {
        user_id: 'U' + pad(nextNum++, 4), created_at: nowIso()
      });
      existing[u.username] = u;
      toInsert.push(u);
      created++;
    });
    if (toInsert.length) Platform.appendRows('Users', DB.headers('Users'), toInsert);
    DB.reset();
    logActivity(ctx, 'importUsers', '', { created: created, updated: updated, skipped: skipped.length });
    return { created: created, updated: updated, skipped: skipped };
  },

  adminSettings: function (d, ctx) {
    var op = d.op || 'get';
    if (op === 'get') {
      var s = getSettings();
      var notes = {};
      DEFAULT_SETTINGS.forEach(function (x) { notes[x[0]] = x[2]; });
      var secrets = {};
      SECRET_KEYS.forEach(function (k) { secrets[k] = !!Platform.prop(k); });
      return { values: s, notes: notes, secrets: secrets, order: DEFAULT_SETTINGS.map(function (x) { return x[0]; }) };
    }
    if (op === 'set') {
      var values = d.values || {};
      if (values.postal_code !== undefined && str(values.postal_code) && !/^\d{5}$/.test(str(values.postal_code))) {
        fail('รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
      }
      var rows = DB.all('Settings');
      Object.keys(values).forEach(function (k) {
        var v = typeof values[k] === 'object' ? JSON.stringify(values[k]) : str(values[k]);
        var ex = rows.filter(function (r) { return r.key === k; })[0];
        if (ex) DB.update('Settings', 'key', k, { value: v });
        else DB.insert('Settings', { key: k, value: v, note: '' });
        rows = DB.all('Settings');
      });
      bustCache();
      logActivity(ctx, 'settings', '', { keys: Object.keys(values) });
      return true;
    }
    if (op === 'secret') {
      if (SECRET_KEYS.indexOf(d.name) < 0) fail('ไม่รู้จักคีย์');
      Platform.setProp(d.name, str(d.value));
      logActivity(ctx, 'secret', d.name, { set: !!str(d.value) });
      return true;
    }
    fail('ไม่รู้จักคำสั่ง');
  },

  adminZones: function (d, ctx) {
    if (d.op === 'save') {
      var z = d.zone || {};
      if (!str(z.name)) fail('กรุณาตั้งชื่อโซน');
      var poly = Array.isArray(z.polygon) ? z.polygon : parsePolygon(z.polygon);
      var data = { name: str(z.name), description: str(z.description), color: str(z.color) || '#2f855a', polygon: poly ? JSON.stringify(poly) : '' };
      var id = z.zone_id;
      if (id && DB.find('Zones', 'zone_id', id)) DB.update('Zones', 'zone_id', id, data);
      else { id = DB.nextId('Zones', 'zone_id', 'Z', 2); DB.insert('Zones', Object.assign({ zone_id: id }, data)); }
      if (d.reassign && poly) Admin._reassignZones();
      logActivity(ctx, 'saveZone', id);
      return { zone_id: id };
    }
    if (d.op === 'delete') {
      DB.remove('Zones', 'zone_id', d.zone_id);
      logActivity(ctx, 'deleteZone', d.zone_id);
      return true;
    }
    if (d.op === 'reassign') return { updated: Admin._reassignZones() };
    fail('ไม่รู้จักคำสั่ง');
  },

  /** คำนวณโซนของทุกต้นใหม่จากพิกัด */
  _reassignZones: function () {
    var n = 0;
    DB.all('Trees').slice().forEach(function (t) {
      var z = autoZone(num(t.lat), num(t.lng));
      if (z && z !== t.zone_id) { DB.update('Trees', 'tree_id', t.tree_id, { zone_id: z }); n++; }
    });
    return n;
  },

  /** แทนที่รายการตัวเลือกของ list หนึ่ง: d = { list, items: [{value,label_en,icon,hint}] } */
  adminLists: function (d, ctx) {
    var name = str(d.list);
    if (!name) fail('ไม่ระบุรายการ');
    var others = DB.all('Lists').filter(function (r) { return r.list !== name; });
    var items = (d.items || []).filter(function (it) { return str(it.value); }).map(function (it, i) {
      return { list: name, value: str(it.value), label_en: str(it.label_en), icon: str(it.icon), hint: str(it.hint), order: i + 1 };
    });
    DB.replaceAll('Lists', others.concat(items));
    bustCache();
    logActivity(ctx, 'saveList', name, { count: items.length });
    return true;
  },

  stats: function (d, ctx) {
    var trees = DB.filter('Trees', function (t) { return t.status !== STATUS.DELETED; });
    var spIdx = {};
    DB.all('Species').forEach(function (s) { spIdx[s.species_id] = s; });
    var verified = trees.filter(function (t) { return t.status === STATUS.VERIFIED; });
    var byStatus = {}, byHabit = {}, byZone = {}, families = {}, speciesSet = {};
    trees.forEach(function (t) { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
    verified.forEach(function (t) {
      var sp = spIdx[t.species_id];
      var habit = sp && sp.habit ? sp.habit : 'ไม่ระบุ';
      byHabit[habit] = (byHabit[habit] || 0) + 1;
      byZone[t.zone_id || '-'] = (byZone[t.zone_id || '-'] || 0) + 1;
      if (sp) { speciesSet[sp.species_id] = true; if (sp.family) families[sp.family] = true; }
    });
    var out = {
      trees_total: trees.filter(function (t) { return t.status !== STATUS.ARCHIVED; }).length,
      trees_verified: verified.length,
      species_verified: Object.keys(speciesSet).length,
      families: Object.keys(families).length,
      by_status: byStatus, by_habit: byHabit, by_zone: byZone
    };
    if (ctx.level < ROLE_LEVEL.teacher) return out;

    // ความคืบหน้ารายห้อง/กลุ่ม
    var users = usersIndex();
    var byClass = {}, byGroup = {};
    Object.keys(users).forEach(function (id) {
      var u = users[id];
      if (u.role !== 'student' && u.role !== 'leader') return;
      var k = u.class || '-';
      byClass[k] = byClass[k] || { students: 0, active: 0, trees: 0, verified: 0 };
      byClass[k].students++;
      var g = u.group || '-';
      byGroup[g] = byGroup[g] || { students: 0, trees: 0, verified: 0, points: 0 };
      byGroup[g].students++;
      byGroup[g].points += num(u.points) || 0;
    });
    var activeUsers = {};
    trees.forEach(function (t) {
      var u = users[t.created_by];
      if (!u) return;
      var c = byClass[u.class || '-'], g = byGroup[u.group || '-'];
      if (c) { c.trees++; if (t.status === STATUS.VERIFIED) c.verified++; activeUsers[u.user_id] = u.class || '-'; }
      if (g) { g.trees++; if (t.status === STATUS.VERIFIED) g.verified++; }
    });
    Object.keys(activeUsers).forEach(function (id) { if (byClass[activeUsers[id]]) byClass[activeUsers[id]].active++; });

    // ความแม่นยำของ AI: อันดับ 1 ของ AI ตรงกับชนิดที่ครูอนุมัติหรือไม่
    var lastAi = {};
    DB.all('AILog').forEach(function (l) { if (l.kind === 'identify' && l.tree_id) lastAi[l.tree_id] = l; });
    var aiChecked = 0, aiCorrect = 0;
    verified.forEach(function (t) {
      var l = lastAi[t.tree_id], sp = spIdx[t.species_id];
      if (!l || !sp) return;
      aiChecked++;
      var top = String(l.top_name).split(' / ');
      if ((top[1] && normSci(top[1]) === normSci(sp.scientific_name)) || top[0] === sp.thai_name) aiCorrect++;
    });

    out.by_class = byClass;
    out.by_group = byGroup;
    // ใครยังไม่ส่งงาน
    out.inactive = Object.keys(users).map(function (id) { return users[id]; }).filter(function (u) {
      return (u.role === 'student' || u.role === 'leader') && u.status !== 'disabled' && !activeUsers[u.user_id];
    }).map(function (u) { return { class: u.class || '-', number: u.number, name: u.full_name, group: u.group }; })
      .sort(function (a, b) { return String(a.class).localeCompare(String(b.class)) || (num(a.number) || 0) - (num(b.number) || 0); });
    // จำนวนชนิดต่อโซน (ใช้ระบายสีแผนที่ "โซนที่ยังสำรวจไม่ครบ")
    var zoneSp = {};
    verified.forEach(function (t) { var z = t.zone_id || '-'; (zoneSp[z] = zoneSp[z] || {})[t.species_id] = 1; });
    out.zone_species = {};
    Object.keys(zoneSp).forEach(function (z) { out.zone_species[z] = Object.keys(zoneSp[z]).length; });
    out.field = {
      phenology: DB.all('Phenology').length, measurements: DB.all('Measurements').length,
      open_issues: DB.filter('Issues', function (r) { return r.status === 'open'; }).length,
      fauna: DB.all('Fauna').length, specimens: DB.all('Herbarium').length, care: DB.all('CareLog').length
    };
    out.ai = { checked: aiChecked, correct: aiCorrect, calls: DB.all('AILog').length };
    out.pending_review = (byStatus[STATUS.SUBMITTED] || 0) + (byStatus[STATUS.PENDING_TEACHER] || 0);
    out.recent = DB.all('ActivityLog').slice(-30).reverse().map(function (a) {
      return { time: a.time, user: displayName(a.user_id, ctx, users) || a.user_id, action: a.action, target: a.target };
    });
    return out;
  },

  /** ประวัติการเรียก AI */
  aiLogList: function (d, ctx) {
    var users = usersIndex();
    return DB.all('AILog').slice(-200).reverse().map(function (l) {
      return {
        log_id: l.log_id, user: displayName(l.user_id, ctx, users) || l.user_id, tree_id: l.tree_id, kind: l.kind,
        model: l.model, input: l.input_summary, top_name: l.top_name, top_confidence: num(l.top_confidence), created_at: l.created_at
      };
    });
  }
};
