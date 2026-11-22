/**
 * admin.js — Dashboard ครู, จัดการระบบ (ผู้ใช้ นำเข้า ตั้งค่า โซน รายการตัวเลือก ส่งออก ประวัติ AI) และพิมพ์ป้ายชื่อ/แบบ ก.7-003
 */
(function () {
  // ================= Dashboard =================
  function bars(obj, labelFn) {
    var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
    var max = Math.max.apply(null, keys.map(function (k) { return obj[k]; }).concat([1]));
    return '<div class="bars">' + (keys.map(function (k) {
      return '<div class="bar-row"><span>' + esc(labelFn ? labelFn(k) : k) + '</span><div class="track"><i style="width:' + (obj[k] / max * 100) + '%"></i></div><b class="right">' + obj[k] + '</b></div>';
    }).join('') || '<div class="muted">ยังไม่มีข้อมูล</div>') + '</div>';
  }

  App.pages.dashboard = function (p, q, el) {
    return api('stats').then(function (s) {
      var ai = s.ai || { checked: 0, correct: 0, calls: 0 };
      el.innerHTML = '<h1>📊 Dashboard</h1>' +
        '<div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin-bottom:14px">' +
        [[s.species_verified, 'ชนิด (ตรวจแล้ว)'], [s.trees_verified, 'ต้น (ตรวจแล้ว)'], [s.trees_total, 'ต้นทั้งหมด'], [s.families, 'วงศ์'], [s.pending_review, 'รอตรวจ']]
          .map(function (x) { return '<div class="stat"><b>' + (x[0] || 0) + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div>' +
        '<div class="split even"><div class="card"><h3>🌳 แยกตามลักษณะวิสัย</h3>' + bars(s.by_habit) + '</div>' +
        '<div class="card"><h3>🗺️ แยกตามโซน</h3>' + bars(s.by_zone, function (k) { return App.zoneName(k) || (k === '-' ? 'ไม่อยู่ในโซน' : k); }) + '</div></div>' +
        '<div class="card"><h3>📌 สถานะระเบียนทั้งหมด</h3>' + bars(s.by_status, function (k) { return UI.STATUS_LABEL[k] || k; }) + '</div>' +
        '<div class="card"><h3>🏫 ความคืบหน้ารายห้อง</h3><div class="table-wrap"><table class="tbl"><tr><th>ห้อง</th><th>นักเรียน</th><th>เริ่มบันทึกแล้ว</th><th>ต้นที่บันทึก</th><th>ผ่านการตรวจ</th></tr>' +
        Object.keys(s.by_class || {}).sort().map(function (k) {
          var c = s.by_class[k];
          return '<tr><td>' + esc(k) + '</td><td>' + c.students + '</td><td>' + c.active + ' (' + Math.round(c.active / Math.max(c.students, 1) * 100) + '%)</td><td>' + c.trees + '</td><td>' + c.verified + '</td></tr>';
        }).join('') + '</table></div></div>' +
        '<div class="card"><h3>👥 กระดานกลุ่ม</h3><div class="table-wrap"><table class="tbl"><tr><th>#</th><th>กลุ่ม</th><th>สมาชิก</th><th>ต้นที่บันทึก</th><th>ผ่านการตรวจ</th><th>คะแนนรวม</th></tr>' +
        Object.keys(s.by_group || {}).sort(function (a, b) { return s.by_group[b].points - s.by_group[a].points; }).map(function (k, i) {
          var g = s.by_group[k];
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(k) + '</td><td>' + g.students + '</td><td>' + g.trees + '</td><td>' + g.verified + '</td><td>⭐ ' + g.points + '</td></tr>';
        }).join('') + '</table></div><p class="small muted">แสดงเป็นกลุ่มเพื่อลดการแข่งขันรายคน</p></div>' +
        '<div class="card"><h3>🤖 ความแม่นยำของ AI</h3><p>เรียกใช้ AI ทั้งหมด <b>' + ai.calls + '</b> ครั้ง · ต้นที่อนุมัติแล้วและมีผล AI <b>' + ai.checked + '</b> ต้น · AI อันดับ 1 ตรงกับที่ครูอนุมัติ <b>' + ai.correct + '</b> ต้น' +
        (ai.checked ? ' (<b>' + Math.round(ai.correct / ai.checked * 100) + '%</b>)' : '') + '</p><p class="small muted">ใช้สอนเรื่องการประเมินความน่าเชื่อถือของ AI ได้</p><a class="btn sm" href="#/admin/ailog">ดูประวัติการใช้ AI</a></div>' +
        dashExtras(s) +
        '<div class="card"><h3>🕘 กิจกรรมล่าสุด</h3><div class="table-wrap"><table class="tbl"><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>รายการ</th></tr>' +
        (s.recent || []).map(function (a) { return '<tr><td class="nowrap">' + UI.thDate(a.time, true) + '</td><td>' + esc(a.user) + '</td><td>' + esc(a.action) + '</td><td>' + esc(a.target) + '</td></tr>'; }).join('') +
        '</table></div></div>' + exportButtons();
      bindExport(el);
      // แผนที่โซน: ระบายสีตามจำนวนชนิดที่สำรวจแล้ว (โซนสีอ่อน = ยังสำรวจน้อย)
      var zm = UI.$('#dashZoneMap', el);
      if (zm) {
        var m = Maps.create(zm);
        var zs = s.zone_species || {};
        var max = Math.max.apply(null, Object.keys(zs).map(function (k) { return zs[k]; }).concat([1]));
        App.boot.zones.forEach(function (z) {
          if (!z.polygon) return;
          var n = zs[z.zone_id] || 0;
          L.polygon(z.polygon, { color: '#fff', weight: 2, fillColor: n ? '#2f855a' : '#c53030', fillOpacity: n ? 0.15 + 0.6 * n / max : 0.35 })
            .bindTooltip(esc(z.name) + ': ' + n + ' ชนิด', { permanent: true, direction: 'center', className: 'zone-tip' }).addTo(m);
        });
        Maps.fitTo(m, [].concat.apply([], App.boot.zones.filter(function (z) { return z.polygon; }).map(function (z) { return z.polygon; })));
        return function () { m.remove(); };
      }
    });
  };

  function dashExtras(s) {
    var f = s.field || {};
    var c = Carbon.total(App.boot.trees.filter(function (t) { return t.status === 'verified'; }));
    var inactive = s.inactive || [];
    var byClass = {};
    inactive.forEach(function (u) { (byClass[u.class] = byClass[u.class] || []).push(u); });
    return '<div class="card"><h3>🌍 คาร์บอนและงานติดตาม</h3><div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))">' +
      [[UI.fmtNum(c.co2 / 1000, 2), 'ตัน CO₂ ที่กักเก็บ (' + c.n + ' ต้น)'], [f.phenology, 'บันทึกชีพลักษณ์'], [f.measurements, 'การวัดซ้ำ'],
        [f.open_issues, 'ปัญหาที่ยังไม่แก้'], [f.fauna, 'สิ่งมีชีวิตร่วม'], [f.specimens, 'ตัวอย่างแห้ง']]
        .map(function (x) { return '<div class="stat"><b>' + (x[0] || 0) + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div>' +
      '<p class="small muted" style="margin-top:8px">คาร์บอนเป็นค่าประมาณ — ' + esc(Carbon.REF) + '</p>' +
      (f.open_issues ? '<a class="btn sm warn" href="#/admin/issues">⚠️ ดูปัญหาที่แจ้ง</a>' : '') + '</div>' +
      '<div class="split even"><div class="card"><h3>🗺️ โซนที่ยังสำรวจไม่ครบ</h3><div class="map" id="dashZoneMap" style="height:300px"></div>' +
      '<p class="small muted">สีเข้ม = พบหลายชนิด · สีแดง = ยังไม่มีต้นที่ผ่านการตรวจ</p></div>' +
      '<div class="card"><h3>🙋 นักเรียนที่ยังไม่ส่งงาน (' + inactive.length + ')</h3>' + (inactive.length ? '<div style="max-height:320px;overflow:auto">' +
        Object.keys(byClass).sort().map(function (k) {
          return '<div class="kv-section">' + esc(k) + ' (' + byClass[k].length + ')</div><div class="small">' + byClass[k].map(function (u) {
            return (u.number ? u.number + '. ' : '') + esc(u.name) + (u.group ? ' <span class="muted">(' + esc(u.group) + ')</span>' : '');
          }).join('<br>') + '</div>';
        }).join('') + '</div>' : '<p>ทุกคนเริ่มบันทึกแล้ว 🎉</p>') + '</div></div>';
  }

  function exportButtons() {
    return '<div class="card"><h3>📤 ส่งออกรายงาน</h3><div class="btn-row">' +
      '<button class="btn" data-exp="register">📘 ทะเบียนพรรณไม้ (ก.7-005) CSV</button><button class="btn" data-exp="trees">🌳 ข้อมูลรายต้น CSV</button>' +
      '<button class="btn" data-exp="species">🌿 ข้อมูลรายชนิด CSV</button><button class="btn" data-exp="scores">🧑‍🎓 ผลงานนักเรียน CSV</button>' +
      '<a class="btn" href="#/labels">🏷️ พิมพ์ป้ายชื่อ + QR</a><a class="btn" href="#/labels?form=k7003">📄 พิมพ์แบบ ก.7-003</a></div>' +
      '<p class="small muted" style="margin-top:8px">ไฟล์ CSV เปิดด้วย Excel / Google Sheets ได้ (ภาษาไทยไม่เพี้ยน) · หน้าพิมพ์ใช้คำสั่ง พิมพ์ → บันทึกเป็น PDF</p></div>';
  }
  function bindExport(el) {
    UI.$$('[data-exp]', el).forEach(function (b) {
      b.onclick = function () {
        UI.busy(api('exportCsv', { type: b.dataset.exp }), 'กำลังสร้างไฟล์').then(function (r) { UI.download(r.filename, r.csv); }).catch(UI.error);
      };
    });
  }

  // ================= จัดการระบบ =================
  // [แท็บ, ชื่อ, สิทธิ์ขั้นต่ำ]
  var TABS = [['users', '👥 ผู้ใช้', 4], ['import', '📥 นำเข้ารายชื่อ', 4], ['settings', '⚙️ ตั้งค่า', 4], ['zones', '🗺️ โซน/อาคาร', 4], ['lists', '📝 ตัวเลือก', 4],
    ['missions', '🎯 ภารกิจ', 3], ['routes', '🚶 เส้นทางเรียนรู้', 3], ['issues', '⚠️ แจ้งปัญหา', 3], ['export', '📤 ส่งออก', 3], ['ailog', '🤖 ประวัติ AI', 3]];

  App.pages.admin = function (p, q, el) {
    var lv = App.level();
    var tabs = TABS.filter(function (t) { return lv >= t[2]; });
    var tab = tabs.some(function (t) { return t[0] === p.tab; }) ? p.tab : tabs[0][0];
    el.innerHTML = '<h1>⚙️ จัดการระบบ</h1><div class="tabs">' + tabs.map(function (t) {
      return '<a href="#/admin/' + t[0] + '" style="text-decoration:none"><button class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button></a>';
    }).join('') + '</div><div id="adminBody"><div class="empty"><div class="spinner"></div></div></div>';
    var body = UI.$('#adminBody', el);
    return ({ users: users, import: importTab, settings: settingsTab, zones: zonesTab, lists: listsTab, export: exportTab, ailog: aiLogTab,
      missions: missionsTab, routes: routesTab, issues: issuesTab }[tab])(body, q);
  };

  // ----- ผู้ใช้ -----
  function users(body, q) {
    return api('adminUsers', { op: 'list' }).then(function (list) {
      var term = q.u || '';
      function render() {
        var shown = list.filter(function (u) { return !term || JSON.stringify([u.username, u.full_name, u.nickname, u.class, u.group]).indexOf(term) >= 0; });
        UI.$('#userTable', body).innerHTML = '<tr><th>ชื่อผู้ใช้</th><th>ชื่อ-สกุล</th><th>ห้อง/เลขที่</th><th>กลุ่ม</th><th>บทบาท</th><th>รหัสผ่าน</th><th>ต้น (ผ่าน)</th><th>เข้าล่าสุด</th><th></th></tr>' +
          shown.map(function (u) {
            return '<tr style="' + (u.status === 'disabled' ? 'opacity:.5' : '') + '"><td>' + esc(u.username) + '</td><td>' + esc(u.full_name) + (u.nickname ? ' (' + esc(u.nickname) + ')' : '') + '</td>' +
              '<td>' + esc(u.class) + (u.number ? '/' + esc(u.number) : '') + '</td><td>' + esc(u.group) + '</td><td>' + esc(UI.ROLE_LABEL[u.role] || u.role) + '</td>' +
              '<td>' + (u.has_password ? '✅' : '<span class="muted">ยังไม่ตั้ง</span>') + '</td><td>' + u.trees.total + ' (' + u.trees.verified + ')</td>' +
              '<td class="nowrap small">' + (u.last_login ? UI.thDate(u.last_login, true) : '-') + '</td>' +
              '<td class="nowrap"><button class="btn sm" data-edit="' + esc(u.user_id) + '">แก้ไข</button> <button class="btn sm" data-reset="' + esc(u.user_id) + '">รีเซ็ตรหัส</button></td></tr>';
          }).join('');
      }
      body.innerHTML = '<div class="btn-row" style="margin-bottom:10px"><input type="search" id="uSearch" placeholder="ค้นหาชื่อ ห้อง กลุ่ม" value="' + esc(term) + '" style="flex:1;min-width:180px">' +
        '<button class="btn primary" id="addUser">➕ เพิ่มผู้ใช้</button></div><div class="card"><div class="small muted" style="margin-bottom:6px">ทั้งหมด ' + list.length + ' คน</div>' +
        '<div class="table-wrap"><table class="tbl" id="userTable"></table></div></div>';
      render();
      UI.$('#uSearch', body).oninput = function (e) { term = e.target.value.trim(); render(); };
      UI.$('#addUser', body).onclick = function () { userModal({}).then(function (ok) { if (ok) users(body, q); }); };
      UI.$('#userTable', body).onclick = function (e) {
        var ed = e.target.closest('[data-edit]'), rs = e.target.closest('[data-reset]');
        if (ed) userModal(list.filter(function (u) { return u.user_id === ed.dataset.edit; })[0]).then(function (ok) { if (ok) users(body, q); });
        if (rs) {
          var u = list.filter(function (x) { return x.user_id === rs.dataset.reset; })[0];
          UI.confirm('รีเซ็ตรหัสผ่านของ ' + esc(u.full_name) + '?', 'นักเรียนจะเข้าระบบด้วยชื่อผู้ใช้ ' + esc(u.username) + ' โดยเว้นรหัสผ่านว่าง แล้วตั้งรหัสผ่านใหม่เอง', 'รีเซ็ต', 'warn').then(function (ok) {
            if (ok) UI.busy(api('adminUsers', { op: 'reset', user_id: u.user_id })).then(function () { UI.toast('รีเซ็ตแล้ว', 'ok'); users(body, q); }).catch(UI.error);
          });
        }
      };
    });
  }

  function userModal(u) {
    var roles = ['student', 'leader', 'teacher', 'admin'];
    return UI.modal({
      title: u.user_id ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้',
      body: '<div class="row2"><label class="field"><span>ชื่อผู้ใช้ (เลขประจำตัว)</span><input name="username" value="' + esc(u.username || '') + '"></label>' +
        '<label class="field"><span>ชื่อเล่น</span><input name="nickname" value="' + esc(u.nickname || '') + '"></label></div>' +
        '<label class="field"><span>ชื่อ-สกุล</span><input name="full_name" value="' + esc(u.full_name || '') + '"></label>' +
        '<div class="row2"><label class="field"><span>ห้อง</span><input name="class" value="' + esc(u.class || '') + '" placeholder="ม.2/3"></label>' +
        '<label class="field"><span>เลขที่</span><input name="number" value="' + esc(u.number || '') + '"></label></div>' +
        '<div class="row2"><label class="field"><span>กลุ่มสำรวจ</span><input name="group" value="' + esc(u.group || '') + '"></label>' +
        '<label class="field"><span>บทบาท</span><select name="role">' + roles.map(function (r) { return '<option value="' + r + '" ' + ((u.role || 'student') === r ? 'selected' : '') + '>' + UI.ROLE_LABEL[r] + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="row2"><label class="field"><span>อีเมล (ถ้ามี)</span><input name="email" type="email" value="' + esc(u.email || '') + '"></label>' +
        '<label class="field"><span>สถานะ</span><select name="status"><option value="active">ใช้งาน</option><option value="disabled" ' + (u.status === 'disabled' ? 'selected' : '') + '>ปิดใช้งาน</option></select></label></div>',
      buttons: [{ label: 'ยกเลิก', value: false }, {
        label: 'บันทึก', cls: 'primary', onClick: function (m) {
          var v = UI.formValues(m);
          if (u.user_id) v.user_id = u.user_id;
          return api('adminUsers', { op: 'save', user: v }).then(function () { UI.toast('บันทึกแล้ว', 'ok'); return true; });
        }
      }]
    });
  }

  // ----- นำเข้ารายชื่อ -----
  var IMPORT_COLS = ['username', 'full_name', 'class', 'number', 'group', 'nickname', 'email', 'role'];
  var IMPORT_LABELS = ['เลขประจำตัว', 'ชื่อ-สกุล', 'ห้อง', 'เลขที่', 'กลุ่ม', 'ชื่อเล่น', 'อีเมล', 'บทบาท'];

  function parseTable(text) {
    text = text.replace(/^﻿/, '').trim();
    if (!text) return [];
    var delim = text.split('\n')[0].indexOf('\t') >= 0 ? '\t' : ',';
    var rows = [], row = [], cell = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') inQ = false; else cell += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    row.push(cell); rows.push(row);
    return rows.filter(function (r) { return r.some(function (c) { return c.trim(); }); });
  }

  function importTab(body) {
    body.innerHTML = '<div class="card"><h3>📥 นำเข้ารายชื่อนักเรียน</h3><p>คัดลอกจาก Excel/Google Sheets แล้ววางในช่องด้านล่าง หรือเลือกไฟล์ CSV — เรียงคอลัมน์ตามนี้ (คอลัมน์หลังๆ เว้นได้):</p>' +
      '<p class="small">' + IMPORT_LABELS.map(function (l, i) { return '<span class="kbd">' + (i + 1) + '. ' + l + '</span>'; }).join(' ') + '</p>' +
      '<p class="small muted">บทบาท: student (ค่าเริ่มต้น), leader (หัวหน้ากลุ่ม), teacher · ถ้าแถวแรกเป็นหัวตาราง ระบบจะข้ามให้อัตโนมัติ · นักเรียนเข้าครั้งแรกโดยเว้นรหัสผ่านว่าง แล้วตั้งรหัสผ่านเอง</p>' +
      '<textarea id="impText" style="min-height:160px;font-family:monospace" placeholder="12345&#9;ด.ช.สมชาย ใจดี&#9;ม.2/3&#9;15&#9;กลุ่มราชพฤกษ์"></textarea>' +
      '<div class="btn-row" style="margin-top:8px"><input type="file" id="impFile" accept=".csv,.tsv,.txt"><button class="btn" id="impPreview">👀 ดูตัวอย่าง</button></div></div><div id="impOut"></div>';
    UI.$('#impFile', body).onchange = function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { UI.$('#impText', body).value = r.result; preview(); };
      r.readAsText(f, 'utf-8');
    };
    UI.$('#impPreview', body).onclick = preview;
    function preview() {
      var rows = parseTable(UI.$('#impText', body).value);
      if (rows.length && /username|เลขประจำตัว|รหัส|ชื่อผู้ใช้/i.test(rows[0][0])) rows.shift();
      var data = rows.map(function (r) { var o = {}; IMPORT_COLS.forEach(function (k, i) { o[k] = (r[i] || '').trim(); }); return o; });
      var out = UI.$('#impOut', body);
      if (!data.length) { out.innerHTML = '<div class="alert warn">ไม่พบข้อมูล</div>'; return; }
      out.innerHTML = '<div class="card"><h3>ตัวอย่าง ' + data.length + ' แถว</h3><div class="table-wrap" style="max-height:340px"><table class="tbl"><tr>' + IMPORT_LABELS.map(function (l) { return '<th>' + l + '</th>'; }).join('') + '</tr>' +
        data.slice(0, 200).map(function (d) { return '<tr>' + IMPORT_COLS.map(function (k) { return '<td>' + esc(d[k]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>' +
        '<label class="check" style="margin:10px 0"><input type="checkbox" id="impUpd"> อัปเดตข้อมูลของคนที่มีอยู่แล้ว (ห้อง/กลุ่ม/ชื่อ)</label>' +
        '<button class="btn primary big" id="impGo">📥 นำเข้า ' + data.length + ' คน</button></div>';
      UI.$('#impGo', body).onclick = function () {
        UI.busy(api('adminImport', { rows: data, update_existing: UI.$('#impUpd', body).checked }), 'กำลังนำเข้า').then(function (r) {
          out.innerHTML = '<div class="alert ok"><span class="ic">✅</span><div>เพิ่มใหม่ ' + r.created + ' คน · อัปเดต ' + r.updated + ' คน · ข้าม ' + r.skipped.length + ' คน' +
            (r.skipped.length ? '<br><span class="small">' + r.skipped.slice(0, 30).map(esc).join('<br>') + '</span>' : '') + '</div></div>';
        }).catch(UI.error);
      };
    }
  }

  // ----- ตั้งค่า -----
  var BOOL_KEYS = ['ai_enabled', 'plantnet_enabled', 'leader_review_enabled', 'email_notify'];
  var HIDDEN_KEYS = ['school_boundary', 'schema_version'];

  function settingsTab(body) {
    return api('adminSettings', { op: 'get' }).then(function (r) {
      var v = r.values;
      body.innerHTML = '<div class="card"><h3>🔐 คีย์ AI (เก็บฝั่งเซิร์ฟเวอร์เท่านั้น ไม่ส่งกลับหน้าเว็บ)</h3>' +
        [['GEMINI_API_KEY', 'Gemini API Key', 'สมัครที่ aistudio.google.com → Get API key'], ['PLANTNET_API_KEY', 'Pl@ntNet API Key (ไม่บังคับ)', 'สมัครที่ my.plantnet.org']].map(function (k) {
          return '<div class="field"><span class="field-label">' + k[1] + ' ' + (r.secrets[k[0]] ? '<span class="pill verified">ตั้งค่าแล้ว</span>' : '<span class="pill returned">ยังไม่ได้ตั้ง</span>') + '</span>' +
            '<div class="btn-row"><input type="password" data-secret="' + k[0] + '" placeholder="วางคีย์ใหม่ที่นี่" autocomplete="off" style="flex:1;min-width:200px"><button class="btn" data-save-secret="' + k[0] + '">บันทึกคีย์</button>' +
            (r.secrets[k[0]] ? '<button class="btn danger" data-clear-secret="' + k[0] + '">ลบคีย์</button>' : '') + '</div><div class="field-hint">' + k[2] + '</div></div>';
        }).join('') + '</div>' +
        '<form class="card" id="setForm"><h3>⚙️ ค่าตั้งระบบ</h3>' + r.order.filter(function (k) { return HIDDEN_KEYS.indexOf(k) < 0; }).map(function (k) {
          var input = BOOL_KEYS.indexOf(k) >= 0
            ? '<select name="' + k + '"><option value="TRUE" ' + (String(v[k]).toUpperCase() === 'TRUE' ? 'selected' : '') + '>เปิด</option><option value="FALSE" ' + (String(v[k]).toUpperCase() !== 'TRUE' ? 'selected' : '') + '>ปิด</option></select>'
            : k === 'public_show_student_name'
              ? '<select name="' + k + '">' + [['nickname_only', 'แสดงชื่อเล่น + ห้อง'], ['class_only', 'แสดงเฉพาะห้อง'], ['none', 'ไม่แสดง']].map(function (o) { return '<option value="' + o[0] + '" ' + (v[k] === o[0] ? 'selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'
              : '<input name="' + k + '" value="' + esc(v[k]) + '">';
          return '<label class="field"><span>' + esc(r.notes[k] || k) + ' <span class="kbd small">' + k + '</span></span>' + input + '</label>';
        }).join('') + '<button class="btn primary big">💾 บันทึกค่าตั้ง</button></form>';
      UI.$('#setForm', body).onsubmit = function (e) {
        e.preventDefault();
        UI.busy(api('adminSettings', { op: 'set', values: UI.formValues(e.target) })).then(function () { UI.toast('บันทึกแล้ว', 'ok'); return App.refresh(); }).catch(UI.error);
      };
      body.onclick = function (e) {
        var s = e.target.closest('[data-save-secret]'), c = e.target.closest('[data-clear-secret]');
        if (!s && !c) return;
        var name = (s || c).dataset.saveSecret || (s || c).dataset.clearSecret;
        var value = s ? UI.$('[data-secret="' + name + '"]', body).value.trim() : '';
        if (s && !value) return UI.toast('วางคีย์ก่อน', 'error');
        UI.busy(api('adminSettings', { op: 'secret', name: name, value: value })).then(function () { UI.toast(s ? 'บันทึกคีย์แล้ว' : 'ลบคีย์แล้ว', 'ok'); settingsTab(body); }).catch(UI.error);
      };
    });
  }

  // ----- โซนและขอบเขต -----
  function zonesTab(body) {
    body.innerHTML = '<div class="split"><div><div class="map-wrap"><div class="map tall" id="zMap"></div></div>' +
      '<p class="small muted" style="margin-top:6px" id="drawHint">เลือกคำสั่งด้านขวาเพื่อวาดโซนหรือขอบเขตโรงเรียน</p></div><div>' +
      '<div class="card"><h3>🧭 จุดกลางแผนที่</h3><p class="small">เลื่อนแผนที่ให้โรงเรียนอยู่กลางจอ แล้วกดปุ่ม</p><button class="btn" id="setCenter">📌 ใช้ตำแหน่งนี้เป็นจุดเริ่มต้นแผนที่</button></div>' +
      '<div class="card"><h3>🏫 ขอบเขตโรงเรียน</h3><p class="small">ใช้เตือนเมื่อพิกัดอยู่นอกโรงเรียน</p><button class="btn" id="drawBoundary">✏️ วาดขอบเขตใหม่</button></div>' +
      '<div class="card"><div class="card-title"><h3>🗺️ โซน</h3><button class="btn sm primary" id="addZone">➕ วาดโซนใหม่</button></div><div id="zoneList"></div>' +
      '<button class="btn sm" id="reassign" style="margin-top:10px">🔄 คำนวณโซนของทุกต้นใหม่</button></div>' +
      '<div class="card"><div class="card-title"><h3>🏢 อาคาร (แผนที่ 3 มิติ)</h3><button class="btn sm primary" id="addBld">➕ วาดอาคาร</button></div><div id="bldList"></div></div>' +
      '<div class="card hidden" id="drawPanel"><h3 id="drawTitle"></h3><p class="small">แตะบนแผนที่ทีละจุดรอบพื้นที่ (อย่างน้อย 3 จุด)</p><div class="btn-row"><button class="btn" id="undoPt">↶ ลบจุดล่าสุด</button><button class="btn" id="cancelDraw">ยกเลิก</button><button class="btn primary" id="finishDraw">✓ เสร็จ</button></div></div>' +
      '</div></div>';
    var map = Maps.create(UI.$('#zMap', body));
    var zoneLayer = Maps.addZones(map, { labels: true });
    App.boot.trees.forEach(function (t) { if (t.lat) L.circleMarker([t.lat, t.lng], { radius: 3, color: '#fff', weight: 1, fillOpacity: .9 }).addTo(map); });
    (App.boot.buildings || []).forEach(function (b) { L.polygon(b.polygon, { color: '#4a5568', weight: 2, fillColor: '#a0aec0', fillOpacity: .5 }).bindTooltip(esc(b.name) + ' (' + b.height_m + ' ม.)').addTo(map); });
    function listBuildings() {
      var bs = App.boot.buildings || [];
      UI.$('#bldList', body).innerHTML = bs.length ? bs.map(function (b) {
        return '<div class="list-item"><span style="width:16px;height:16px;border-radius:4px;background:' + esc(b.color) + ';border:1px solid #999;flex:none"></span><div class="body"><div class="title">' + esc(b.name) +
          '</div><div class="sub">สูง ' + b.height_m + ' ม.</div></div><button class="btn sm" data-eb="' + esc(b.building_id) + '">แก้ไข</button><button class="btn sm" data-rb="' + esc(b.building_id) + '">วาดใหม่</button></div>';
      }).join('') : '<div class="muted small">ยังไม่มีอาคาร — วาดโครงอาคารเพื่อให้แสดงเป็นกล่อง 3 มิติ</div>';
    }
    listBuildings();
    var drawing = null, pts = [], drawLayer = L.layerGroup().addTo(map);

    function listZones() {
      UI.$('#zoneList', body).innerHTML = App.boot.zones.length ? App.boot.zones.map(function (z) {
        var n = App.boot.trees.filter(function (t) { return t.zone_id === z.zone_id; }).length;
        return '<div class="list-item"><span style="width:16px;height:16px;border-radius:4px;background:' + esc(z.color) + ';flex:none"></span><div class="body"><div class="title">' + esc(z.name) + '</div><div class="sub">' + esc(z.zone_id) + ' · ' + n + ' ต้น' + (z.polygon ? '' : ' · ยังไม่ได้วาด') + '</div></div>' +
          '<button class="btn sm" data-ez="' + esc(z.zone_id) + '">แก้ไข</button><button class="btn sm" data-rz="' + esc(z.zone_id) + '">วาดใหม่</button></div>';
      }).join('') : '<div class="muted small">ยังไม่มีโซน</div>';
    }
    listZones();
    function redrawTemp() {
      drawLayer.clearLayers();
      if (pts.length) L.polyline(pts.concat(pts.length > 2 ? [pts[0]] : []), { color: '#ffeb3b', weight: 3, dashArray: '5 5' }).addTo(drawLayer);
      pts.forEach(function (p) { L.circleMarker(p, { radius: 5, color: '#ffeb3b', fillOpacity: 1 }).addTo(drawLayer); });
    }
    function startDraw(kind, zone) {
      drawing = { kind: kind, zone: zone };
      pts = [];
      redrawTemp();
      UI.$('#drawPanel', body).classList.remove('hidden');
      UI.$('#drawTitle', body).textContent = kind === 'boundary' ? 'วาดขอบเขตโรงเรียน' : kind === 'building' ? 'วาดอาคาร ' + (zone && zone.name ? zone.name : 'ใหม่') + ' (แตะตามมุมอาคาร)' : 'วาดโซน ' + (zone && zone.name ? zone.name : 'ใหม่');
      UI.$('#drawHint', body).textContent = 'โหมดวาด: แตะบนแผนที่เพื่อเพิ่มจุด';
    }
    function stopDraw() { drawing = null; pts = []; redrawTemp(); UI.$('#drawPanel', body).classList.add('hidden'); UI.$('#drawHint', body).textContent = ''; }
    function reload() { return App.refresh().then(function () { map.remove(); zonesTab(body); }); }

    map.on('click', function (e) { if (!drawing) return; pts.push([Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6]); redrawTemp(); });
    UI.$('#undoPt', body).onclick = function () { pts.pop(); redrawTemp(); };
    UI.$('#cancelDraw', body).onclick = stopDraw;
    UI.$('#finishDraw', body).onclick = function () {
      if (pts.length < 3) return UI.toast('ต้องมีอย่างน้อย 3 จุด', 'error');
      var poly = pts.slice();
      if (drawing.kind === 'building') {
        var bd = drawing.zone || {};
        (bd.building_id ? Promise.resolve(bd) : buildingModal({})).then(function (bb) {
          if (!bb || bb === 'delete') return;
          return UI.busy(api('adminBuildings', { op: 'save', building: Object.assign({}, bb, { polygon: poly }) })).then(function () { UI.toast('บันทึกอาคารแล้ว', 'ok'); stopDraw(); return reload(); });
        }).catch(UI.error);
        return;
      }
      if (drawing.kind === 'boundary') {
        UI.busy(api('adminSettings', { op: 'set', values: { school_boundary: JSON.stringify(poly) } })).then(function () { UI.toast('บันทึกขอบเขตแล้ว', 'ok'); stopDraw(); return reload(); }).catch(UI.error);
        return;
      }
      var z = drawing.zone || {};
      (z.zone_id ? Promise.resolve(z) : zoneModal({})).then(function (zz) {
        if (!zz) return;
        return UI.busy(api('adminZones', { op: 'save', zone: Object.assign({}, zz, { polygon: poly }), reassign: true })).then(function () {
          UI.toast('บันทึกโซนแล้ว', 'ok'); stopDraw(); return reload();
        });
      }).catch(UI.error);
    };
    UI.$('#drawBoundary', body).onclick = function () { startDraw('boundary'); };
    UI.$('#addZone', body).onclick = function () { startDraw('zone', null); };
    UI.$('#addBld', body).onclick = function () { startDraw('building', null); };
    UI.$('#bldList', body).onclick = function (e) {
      var eb = e.target.closest('[data-eb]'), rb = e.target.closest('[data-rb]');
      var id = eb ? eb.dataset.eb : rb ? rb.dataset.rb : '';
      var b = (App.boot.buildings || []).filter(function (x) { return x.building_id === id; })[0];
      if (!b) return;
      if (rb) return startDraw('building', b);
      buildingModal(b, true).then(function (res) {
        if (!res) return;
        var call = res === 'delete' ? api('adminBuildings', { op: 'delete', building_id: b.building_id }) : api('adminBuildings', { op: 'save', building: Object.assign({ building_id: b.building_id }, res) });
        return UI.busy(call).then(function () { UI.toast('บันทึกแล้ว', 'ok'); return reload(); });
      }).catch(UI.error);
    };
    UI.$('#setCenter', body).onclick = function () {
      var c = map.getCenter();
      UI.busy(api('adminSettings', { op: 'set', values: { map_center: c.lat.toFixed(6) + ',' + c.lng.toFixed(6), map_zoom: String(map.getZoom()) } }))
        .then(function () { UI.toast('ตั้งจุดกลางแผนที่แล้ว', 'ok'); return App.refresh(); }).catch(UI.error);
    };
    UI.$('#reassign', body).onclick = function () {
      UI.busy(api('adminZones', { op: 'reassign' })).then(function (r) { UI.toast('อัปเดตโซน ' + r.updated + ' ต้น', 'ok'); return App.refresh(); }).catch(UI.error);
    };
    UI.$('#zoneList', body).onclick = function (e) {
      var ez = e.target.closest('[data-ez]'), rz = e.target.closest('[data-rz]');
      var z = App.zoneById[(ez || rz || {}).dataset ? (ez || rz).dataset.ez || (ez || rz).dataset.rz : ''];
      if (!z) return;
      if (rz) return startDraw('zone', z);
      zoneModal(z, true).then(function (res) {
        if (!res) return;
        var call = res === 'delete' ? api('adminZones', { op: 'delete', zone_id: z.zone_id }) : api('adminZones', { op: 'save', zone: Object.assign({}, z, res) });
        return UI.busy(call).then(function () { UI.toast('บันทึกแล้ว', 'ok'); return reload(); });
      }).catch(UI.error);
    };
    return function () { map.remove(); };
  }

  function buildingModal(b, canDelete) {
    var buttons = [{ label: 'ยกเลิก', value: null }];
    if (canDelete) buttons.push({ label: 'ลบอาคาร', cls: 'danger', value: 'delete' });
    buttons.push({
      label: 'บันทึก', cls: 'primary', onClick: function (m) {
        var v = UI.formValues(m);
        if (!v.name.trim()) { UI.toast('ตั้งชื่ออาคาร', 'error'); return false; }
        if (!(Number(v.height_m) > 0)) { UI.toast('ใส่ความสูงอาคาร', 'error'); return false; }
        return v;
      }
    });
    return UI.modal({
      title: b.building_id ? 'แก้ไขอาคาร' : 'ข้อมูลอาคาร',
      body: '<label class="field"><span>ชื่ออาคาร</span><input name="name" value="' + esc(b.name || '') + '" placeholder="เช่น อาคาร 1, โรงอาหาร"></label>' +
        '<label class="field"><span>ความสูง (เมตร)</span><input type="number" step="any" min="1" name="height_m" value="' + esc(b.height_m || '') + '" placeholder="ชั้นละประมาณ 3.5 ม."></label>' +
        '<label class="field"><span>สี</span><input type="color" name="color" value="' + esc(b.color || '#e2e8f0') + '" style="height:46px;padding:4px"></label>',
      buttons: buttons
    });
  }

  // ----- ภารกิจ (H7) -----
  function missionsTab(body) {
    var ms = App.boot.missions || [];
    body.innerHTML = '<div class="btn-row" style="margin-bottom:10px"><button class="btn primary" id="addMs">➕ สร้างภารกิจ</button></div>' +
      '<div class="card">' + (ms.length ? ms.map(function (m) {
        var pct = m.target_count ? Math.min(100, Math.round(m.progress / m.target_count * 100)) : 0;
        return '<div class="list-item" style="align-items:flex-start"><div class="body"><div class="title">🎯 ' + esc(m.title) + ' ' + (m.status === 'closed' ? '<span class="pill">ปิดแล้ว</span>' : '<span class="pill verified">กำลังทำ</span>') + '</div>' +
          '<div class="sub" style="white-space:normal">' + esc(m.description) + '</div><div class="small muted">' + (m.group ? esc(m.group) : 'ทุกกลุ่ม') + (m.zone_id ? ' · โซน ' + esc(App.zoneName(m.zone_id)) : '') +
          (m.due_date ? ' · ภายใน ' + UI.thDate(m.due_date) : '') + '</div><div class="conf"><div class="progress"><div style="width:' + pct + '%"></div></div><b>' + m.progress + (m.target_count ? '/' + m.target_count : '') + '</b></div>' +
          '<div class="small">ผ่านการตรวจ ' + m.verified + ' ต้น</div></div><button class="btn sm" data-em="' + esc(m.mission_id) + '">แก้ไข</button></div>';
      }).join('') : '<div class="empty"><span class="ic">🎯</span>ยังไม่มีภารกิจ</div>') + '</div>' +
      '<p class="small muted">ความคืบหน้านับจากต้นไม้ที่สมาชิกกลุ่มส่งตรวจ (ในโซนที่กำหนด) ตั้งแต่วันที่สร้างภารกิจ — นักเรียนเห็นภารกิจของกลุ่มตัวเองที่หน้าหลัก</p>';
    function edit(m) {
      var groups = App.boot.groups || [];
      UI.modal({
        title: m.mission_id ? 'แก้ไขภารกิจ' : 'สร้างภารกิจ',
        body: '<label class="field"><span>ชื่อภารกิจ</span><input name="title" value="' + esc(m.title || '') + '" placeholder="เช่น สำรวจโซนริมสระให้ครบ"></label>' +
          '<label class="field"><span>รายละเอียด</span><textarea name="description">' + esc(m.description || '') + '</textarea></label>' +
          '<div class="row2"><label class="field"><span>กลุ่ม</span><select name="group"><option value="">ทุกกลุ่ม</option>' + groups.map(function (g) { return '<option ' + (m.group === g ? 'selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select></label>' +
          '<label class="field"><span>โซน</span><select name="zone_id"><option value="">ทุกโซน</option>' + App.boot.zones.map(function (z) { return '<option value="' + esc(z.zone_id) + '" ' + (m.zone_id === z.zone_id ? 'selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') + '</select></label></div>' +
          '<div class="row2"><label class="field"><span>เป้าหมาย (จำนวนต้น)</span><input type="number" min="0" name="target_count" value="' + esc(m.target_count || '') + '"></label>' +
          '<label class="field"><span>กำหนดส่ง</span><input type="date" name="due_date" value="' + esc(m.due_date || '') + '"></label></div>' +
          '<label class="field"><span>สถานะ</span><select name="status"><option value="active">กำลังทำ</option><option value="closed" ' + (m.status === 'closed' ? 'selected' : '') + '>ปิดแล้ว</option></select></label>',
        buttons: [{ label: 'ยกเลิก', value: null }].concat(m.mission_id ? [{
          label: 'ลบ', cls: 'danger', onClick: function () { return api('adminMissions', { op: 'delete', mission_id: m.mission_id }).then(function () { return true; }); }
        }] : []).concat([{
          label: 'บันทึก', cls: 'primary', onClick: function (md) {
            return api('adminMissions', { op: 'save', mission: Object.assign({ mission_id: m.mission_id }, UI.formValues(md)) }).then(function () { return true; });
          }
        }])
      }).then(function (ok) { if (ok) App.refresh().then(function () { missionsTab(body); }); });
    }
    UI.$('#addMs', body).onclick = function () { edit({}); };
    body.onclick = function (e) { var b = e.target.closest('[data-em]'); if (b) edit(ms.filter(function (x) { return x.mission_id === b.dataset.em; })[0]); };
  }

  // ----- เส้นทางเรียนรู้ -----
  function routesTab(body, q) {
    var rs = App.boot.routes || [];
    function list() {
      body.innerHTML = '<div class="btn-row" style="margin-bottom:10px"><button class="btn primary" id="addRt">➕ สร้างเส้นทาง</button></div><div class="card">' +
        (rs.length ? rs.map(function (r) {
          return '<div class="list-item"><span style="width:16px;height:16px;border-radius:50%;background:' + esc(r.color) + ';flex:none"></span><div class="body"><div class="title">' + esc(r.name) +
            (r.published ? '' : ' <span class="pill">ไม่เผยแพร่</span>') + '</div><div class="sub">' + r.tree_ids.length + ' จุด · ' + esc(r.description) + '</div></div>' +
            '<a class="btn sm" href="#/route/' + esc(r.route_id) + '">ดู</a><button class="btn sm" data-er="' + esc(r.route_id) + '">แก้ไข</button></div>';
        }).join('') : '<div class="empty">ยังไม่มีเส้นทาง</div>') + '</div>';
      UI.$('#addRt', body).onclick = function () { edit({ tree_ids: [], color: '#d69e2e', published: true }); };
      body.onclick = function (e) { var b = e.target.closest('[data-er]'); if (b) edit(rs.filter(function (r) { return r.route_id === b.dataset.er; })[0]); };
    }
    function edit(r) {
      var ids = r.tree_ids.slice();
      var cands = App.boot.trees.filter(function (t) { return t.status === 'verified'; });
      body.onclick = null;
      body.innerHTML = '<div class="split"><div class="card"><h3>' + (r.route_id ? 'แก้ไขเส้นทาง' : 'เส้นทางใหม่') + '</h3>' +
        '<label class="field"><span>ชื่อเส้นทาง</span><input name="name" value="' + esc(r.name || '') + '" placeholder="เช่น เส้นทางสมุนไพร 10 จุด"></label>' +
        '<label class="field"><span>คำอธิบาย</span><textarea name="description">' + esc(r.description || '') + '</textarea></label>' +
        '<div class="row2"><label class="field"><span>สีเส้นทาง</span><input type="color" name="color" value="' + esc(r.color) + '" style="height:46px;padding:4px"></label>' +
        '<label class="check" style="margin-top:28px"><input type="checkbox" name="published" ' + (r.published ? 'checked' : '') + '> เผยแพร่ในหน้าสาธารณะ</label></div>' +
        '<h4>จุดแวะตามลำดับ (<span id="nStops"></span>)</h4><div id="stops"></div><div class="map" id="rtMap" style="height:260px;margin-top:10px"></div>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn primary" id="saveRt">💾 บันทึก</button>' + (r.route_id ? '<button class="btn danger" id="delRt">ลบเส้นทาง</button>' : '') +
        '<button class="btn" id="backRt">‹ กลับ</button></div></div>' +
        '<div class="card"><h3>เลือกต้นไม้ (แตะเพื่อเพิ่ม)</h3><input type="search" id="rtq" placeholder="ค้นหาชื่อ/รหัส/โซน" style="margin-bottom:8px"><div id="cands" style="max-height:540px;overflow:auto"></div></div></div>';
      var map = Maps.create(UI.$('#rtMap', body));
      Maps.addZones(map, { fill: false });
      var layer = L.layerGroup().addTo(map);
      var term = '';
      function draw() {
        UI.$('#nStops', body).textContent = ids.length + ' จุด';
        UI.$('#stops', body).innerHTML = ids.map(function (id, i) {
          var t = App.treeById[id];
          return '<div class="list-item"><b style="width:24px">' + (i + 1) + '.</b><div class="body"><div class="title">' + esc(t ? App.treeName(t) : id) + '</div><div class="sub">' + esc(t ? t.tree_code : '') + '</div></div>' +
            '<button class="btn sm" data-up="' + i + '">↑</button><button class="btn sm danger" data-rm="' + i + '">✕</button></div>';
        }).join('') || '<div class="muted small">ยังไม่มีจุด</div>';
        UI.$('#cands', body).innerHTML = cands.filter(function (t) { return ids.indexOf(t.tree_id) < 0 && (!term || (App.treeName(t) + t.tree_code + App.zoneName(t.zone_id)).indexOf(term) >= 0); })
          .map(function (t) { return '<button class="list-item" data-add="' + esc(t.tree_id) + '" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);font:inherit;text-align:left;cursor:pointer"><div class="body"><div class="title">' + esc(App.treeName(t)) +
            '</div><div class="sub">' + esc(t.tree_code) + ' · ' + esc(App.zoneName(t.zone_id)) + '</div></div><span class="chev">＋</span></button>'; }).join('');
        layer.clearLayers();
        var pts = ids.map(function (id) { return App.treeById[id]; }).filter(function (t) { return t && t.lat; }).map(function (t) { return [t.lat, t.lng]; });
        if (pts.length > 1) L.polyline(pts, { color: UI.formValues(body).color || r.color, weight: 4 }).addTo(layer);
        pts.forEach(function (pt, i) { L.marker(pt, { icon: Maps.pinIcon('#d69e2e', 22, '<b style="color:#fff">' + (i + 1) + '</b>') }).addTo(layer); });
        cands.forEach(function (t) {
          if (t.lat && ids.indexOf(t.tree_id) < 0) L.circleMarker([t.lat, t.lng], { radius: 5, color: '#fff', weight: 1, fillColor: '#2f855a', fillOpacity: .9 })
            .bindTooltip(esc(App.treeName(t))).on('click', function () { ids.push(t.tree_id); draw(); }).addTo(layer);
        });
      }
      draw();
      if (ids.length) Maps.fitTo(map, ids.map(function (id) { var t = App.treeById[id]; return t ? [t.lat, t.lng] : null; }));
      UI.$('#rtq', body).oninput = function (e) { term = e.target.value.trim(); draw(); };
      body.onclick = function (e) {
        var a = e.target.closest('[data-add]'), up = e.target.closest('[data-up]'), rm = e.target.closest('[data-rm]');
        if (a) { ids.push(a.dataset.add); draw(); }
        if (up && +up.dataset.up > 0) { var i = +up.dataset.up; ids.splice(i - 1, 0, ids.splice(i, 1)[0]); draw(); }
        if (rm) { ids.splice(+rm.dataset.rm, 1); draw(); }
      };
      var done = function () { map.remove(); return App.refresh().then(function () { rs = App.boot.routes || []; list(); }); };
      UI.$('#backRt', body).onclick = done;
      UI.$('#saveRt', body).onclick = function () {
        var v = UI.formValues(body);
        UI.busy(api('adminRoutes', { op: 'save', route: { route_id: r.route_id, name: v.name, description: v.description, color: v.color, published: v.published, tree_ids: ids } }))
          .then(function () { UI.toast('บันทึกเส้นทางแล้ว', 'ok'); return done(); }).catch(UI.error);
      };
      var del = UI.$('#delRt', body);
      if (del) del.onclick = function () {
        UI.confirm('ลบเส้นทางนี้?', '', 'ลบ', 'danger solid').then(function (ok) {
          if (ok) UI.busy(api('adminRoutes', { op: 'delete', route_id: r.route_id })).then(done).catch(UI.error);
        });
      };
    }
    var target = q && q.edit ? rs.filter(function (r) { return r.route_id === q.edit; })[0] : null;
    if (target) edit(target); else list();
  }

  // ----- แจ้งปัญหา (H4) -----
  function issuesTab(body, q) {
    var all = q && q.all === '1';
    return api('listIssues', { all: all }).then(function (list) {
      body.innerHTML = '<div class="chips" style="margin-bottom:10px"><a class="chip ' + (all ? '' : 'on') + '" href="#/admin/issues">ยังไม่แก้</a><a class="chip ' + (all ? 'on' : '') + '" href="#/admin/issues?all=1">ทั้งหมด</a></div>' +
        '<div class="card">' + (list.length ? list.map(function (x) {
          return '<div class="list-item" style="align-items:flex-start">' + (x.photo ? '<span style="width:72px;height:72px;border-radius:8px;overflow:hidden;flex:none;cursor:zoom-in" data-zoom="' + esc(x.photo.full || x.photo.thumb) + '">' + UI.photoImg(x.photo) + '</span>' : '') +
            '<div class="body"><div class="title">' + esc(x.type) + ' — <a href="#/tree/' + esc(x.tree_id) + '?tab=grow">' + esc(x.tree_name) + ' ' + esc(x.tree_code) + '</a> ' +
            (x.status === 'open' ? '<span class="pill returned">ยังไม่แก้</span>' : '<span class="pill verified">แก้แล้ว</span>') + '</div>' +
            '<div class="sub" style="white-space:normal">' + esc(x.description) + '</div><div class="small muted">' + esc(App.zoneName(x.zone_id)) + ' · แจ้งโดย ' + esc(x.reported_by_name) + ' · ' + UI.thDate(x.reported_at, true) + '</div>' +
            (x.resolution ? '<div class="small">✅ ' + esc(x.resolution) + '</div>' : '') + '</div>' +
            (x.status === 'open' ? '<button class="btn sm primary" data-res="' + esc(x.issue_id) + '">แก้แล้ว</button>' : '<button class="btn sm" data-reopen="' + esc(x.issue_id) + '">เปิดใหม่</button>') + '</div>';
        }).join('') : '<div class="empty"><span class="ic">🌳</span>ไม่มีปัญหาที่ยังไม่แก้</div>') + '</div>';
      UI.hydratePhotos(body);
      body.onclick = function (e) {
        var r = e.target.closest('[data-res]'), o = e.target.closest('[data-reopen]');
        if (r) App.resolveIssueModal(r.dataset.res).then(function (ok) { if (ok) App.refresh().then(function () { issuesTab(body, q); }); });
        if (o) UI.busy(api('resolveIssue', { issue_id: o.dataset.reopen, reopen: true })).then(function () { issuesTab(body, q); }).catch(UI.error);
      };
    });
  }

  function zoneModal(z, canDelete) {
    var buttons = [{ label: 'ยกเลิก', value: null }];
    if (canDelete) buttons.push({ label: 'ลบโซน', cls: 'danger', value: 'delete' });
    buttons.push({
      label: 'บันทึก', cls: 'primary', onClick: function (m) {
        var v = UI.formValues(m);
        if (!v.name.trim()) { UI.toast('ตั้งชื่อโซน', 'error'); return false; }
        return v;
      }
    });
    return UI.modal({
      title: z.zone_id ? 'แก้ไขโซน' : 'ตั้งชื่อโซนใหม่',
      body: '<label class="field"><span>ชื่อโซน</span><input name="name" value="' + esc(z.name || '') + '" placeholder="เช่น หน้าอาคาร 1, สวนสมุนไพร"></label>' +
        '<label class="field"><span>คำอธิบาย</span><input name="description" value="' + esc(z.description || '') + '"></label>' +
        '<label class="field"><span>สี</span><input type="color" name="color" value="' + esc(z.color || '#2f855a') + '" style="height:46px;padding:4px"></label>',
      buttons: buttons
    });
  }

  // ----- รายการตัวเลือก -----
  var LIST_TITLES = {
    habit: 'ลักษณะวิสัย', bark: 'เปลือก', latex: 'น้ำยาง', leaf_type: 'ชนิดใบ', leaf_arrangement: 'การเรียงตัวของใบ', leaf_shape: 'รูปร่างใบ',
    leaf_apex: 'ปลายใบ', leaf_base: 'โคนใบ', leaf_margin: 'ขอบใบ', leaf_venation: 'เส้นใบ', leaf_texture: 'เนื้อใบ', leaf_hair: 'ขนบนใบ',
    flower_type: 'ช่อดอก', color: 'สี', symmetry: 'สมมาตรดอก', flower_position: 'ตำแหน่งดอก', scent: 'กลิ่น', month: 'เดือน',
    fruit_type: 'ชนิดผล', health: 'สุขภาพต้น', planting_source: 'ที่มาของต้น', label_status: 'สถานะป้าย', origin: 'ถิ่นกำเนิด'
  };
  function listsTab(body, q) {
    var names = Object.keys(LIST_TITLES).concat(Object.keys(App.boot.lists).filter(function (k) { return !LIST_TITLES[k]; }));
    var cur = q.l || names[0];
    var items = (App.boot.lists[cur] || []).map(function (o) { return Object.assign({}, o); });
    function render() {
      body.innerHTML = '<div class="card"><p class="small">ครูเพิ่ม/แก้ตัวเลือกได้เองโดยไม่ต้องแก้โค้ด · คอลัมน์ "ไอคอน" ใส่ลิงก์รูป (https://...) เพื่อใช้รูปของตัวเอง หรือรหัสสี #RRGGBB สำหรับรายการสี</p>' +
        '<select id="listSel">' + names.map(function (n) { return '<option value="' + n + '" ' + (n === cur ? 'selected' : '') + '>' + esc(LIST_TITLES[n] || n) + ' (' + n + ')</option>'; }).join('') + '</select></div>' +
        '<div class="card"><div class="table-wrap"><table class="tbl"><tr><th></th><th>ค่า (ไทย)</th><th>อังกฤษ</th><th>ไอคอน</th><th>คำอธิบาย</th><th></th></tr>' +
        items.map(function (it, i) {
          return '<tr data-i="' + i + '"><td style="width:60px">' + (Icons.render(it.icon) || '').replace('<svg', '<svg style="width:44px;height:44px"') + '</td>' +
            ['value', 'label_en', 'icon', 'hint'].map(function (k) { return '<td><input data-k="' + k + '" value="' + esc(it[k] || '') + '" style="min-height:36px;padding:4px 8px"></td>'; }).join('') +
            '<td class="nowrap"><button class="btn sm" data-up="' + i + '">↑</button><button class="btn sm danger" data-rm="' + i + '">✕</button></td></tr>';
        }).join('') + '</table></div><div class="btn-row" style="margin-top:10px"><button class="btn" id="addItem">➕ เพิ่มตัวเลือก</button><div class="grow"></div><button class="btn primary" id="saveList">💾 บันทึกรายการนี้</button></div></div>';
      UI.$('#listSel', body).onchange = function (e) { location.hash = '#/admin/lists?l=' + e.target.value; };
      UI.$('#addItem', body).onclick = function () { items.push({ value: '', label_en: '', icon: '', hint: '' }); render(); };
      UI.$('#saveList', body).onclick = function () {
        UI.busy(api('adminLists', { list: cur, items: items })).then(function () { UI.toast('บันทึกแล้ว', 'ok'); return App.refresh(); }).catch(UI.error);
      };
      body.oninput = function (e) { var tr = e.target.closest('tr[data-i]'); if (tr && e.target.dataset.k) items[+tr.dataset.i][e.target.dataset.k] = e.target.value; };
      body.onclick = function (e) {
        var up = e.target.closest('[data-up]'), rm = e.target.closest('[data-rm]');
        if (up && +up.dataset.up > 0) { var i = +up.dataset.up; items.splice(i - 1, 0, items.splice(i, 1)[0]); render(); }
        if (rm) { items.splice(+rm.dataset.rm, 1); render(); }
      };
    }
    render();
  }

  function exportTab(body) { body.innerHTML = exportButtons(); bindExport(body); }

  function aiLogTab(body) {
    return api('aiLogList').then(function (rows) {
      body.innerHTML = '<div class="card"><h3>🤖 ประวัติการเรียก AI (200 ครั้งล่าสุด)</h3><div class="table-wrap"><table class="tbl"><tr><th>เวลา</th><th>ผู้ใช้</th><th>ประเภท</th><th>ต้น</th><th>ข้อมูลที่ส่ง</th><th>ผลอันดับ 1</th><th>มั่นใจ</th></tr>' +
        rows.map(function (r) {
          return '<tr><td class="nowrap">' + UI.thDate(r.created_at, true) + '</td><td>' + esc(r.user) + '</td><td>' + esc(r.kind) + '</td><td>' + (r.tree_id ? '<a href="#/tree/' + esc(r.tree_id) + '">' + esc(r.tree_id) + '</a>' : '') + '</td>' +
            '<td>' + esc(r.input) + '</td><td>' + esc(r.top_name) + '</td><td>' + (r.top_confidence !== null ? Math.round(r.top_confidence * 100) + '%' : '') + '</td></tr>';
        }).join('') + '</table></div></div>';
    });
  }

  // ================= ป้ายชื่อ + QR / แบบ ก.7-003 =================
  var QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';

  function publicBase() {
    var u = App.boot.settings.public_url;
    if (u) return u.replace(/#.*$/, '').replace(/\/?$/, '/');
    return location.href.split('#')[0];
  }

  App.pages.labels = function (p, q, el) {
    if (q.form === 'k7003') return k7003(q, el);
    var zone = q.zone || '', only = q.only || '';
    var trees = App.boot.trees.filter(function (t) {
      if (t.status !== 'verified') return false;
      if (q.tree) return t.tree_id === q.tree;
      if (zone && t.zone_id !== zone) return false;
      if (only === 'nolabel' && t.label_status && t.label_status !== 'ยังไม่มีป้าย' && t.label_status !== 'ป้ายชำรุด') return false;
      return true;
    });
    var s = App.boot.settings;
    el.innerHTML = '<div class="no-print card"><h2>🏷️ ป้ายชื่อพรรณไม้ + QR Code</h2><div class="btn-row">' +
      '<select id="lzone" style="width:auto"><option value="">ทุกโซน</option>' + App.boot.zones.map(function (z) { return '<option value="' + esc(z.zone_id) + '" ' + (zone === z.zone_id ? 'selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') + '</select>' +
      '<select id="lonly" style="width:auto"><option value="">ทุกต้น</option><option value="nolabel" ' + (only === 'nolabel' ? 'selected' : '') + '>เฉพาะที่ยังไม่มีป้าย/ป้ายชำรุด</option></select>' +
      '<button class="btn primary" onclick="window.print()">🖨️ พิมพ์ (' + trees.length + ' ป้าย)</button></div>' +
      '<p class="small muted" style="margin-top:8px">สแกน QR → เปิดหน้าข้อมูลต้นไม้ ' + esc(publicBase()) + '#/tree/… ' + (s.public_url ? '' : '— <b>ครูควรตั้ง "ลิงก์หน้าเว็บสำหรับ QR Code" ในหน้าตั้งค่า</b>') + '</p></div>' +
      '<div class="labels-sheet" id="sheet"><div class="empty"><div class="spinner"></div></div></div>';
    function nav() {
      var qs = ['zone=' + encodeURIComponent(UI.$('#lzone', el).value), 'only=' + UI.$('#lonly', el).value].join('&');
      location.hash = '#/labels?' + qs;
    }
    UI.$('#lzone', el).onchange = nav;
    UI.$('#lonly', el).onchange = nav;
    return UI.loadScript(QR_LIB).then(function () {
      var base = publicBase();
      UI.$('#sheet', el).innerHTML = trees.map(function (t) {
        var sp = App.spOf(t) || {};
        var qr = qrcode(0, 'M');
        qr.addData(base + '#/tree/' + t.tree_id);
        qr.make();
        var use = ['use_medicine', 'use_food', 'use_construction', 'use_culture', 'use_other'].map(function (k) { return sp[k]; }).filter(Boolean)[0] || '';
        return '<div class="plant-label"><div><div class="code">' + esc(t.tree_code) + '</div><div class="tname">' + esc(sp.thai_name || '') + '</div>' +
          (sp.local_name ? '<div class="fam">ชื่อพื้นเมือง: ' + esc(sp.local_name) + '</div>' : '') +
          '<div class="sci"><i>' + esc(sp.scientific_name || '') + '</i></div><div class="fam">วงศ์ ' + esc(sp.family || '') + (sp.common_name ? ' · ' + esc(sp.common_name) : '') + '</div>' +
          (use ? '<div class="use">ประโยชน์: ' + esc(use.length > 90 ? use.slice(0, 88) + '…' : use) + '</div>' : '') + '</div>' +
          '<div><div class="qr">' + qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true }) + '</div><div class="school">' + esc(s.school_name) + '</div></div></div>';
      }).join('') || '<div class="empty">ไม่มีต้นที่ผ่านการตรวจตามเงื่อนไข</div>';
    });
  };

  /** แบบบันทึกข้อมูลพรรณไม้ (อิง ก.7-003) — พิมพ์ทีละชนิด */
  function k7003(q, el) {
    var verified = App.boot.species.filter(function (s) { return s.status === 'verified'; })
      .sort(function (a, b) { return String(a.species_code).localeCompare(String(b.species_code)); });
    var list = q.sp ? verified.filter(function (s) { return s.species_id === q.sp; }) : verified;
    var st = App.boot.settings;
    function v(x) { return x ? esc(x).replace(/\n/g, '<br>') : '<span style="color:#aaa">........................................</span>'; }
    el.innerHTML = '<div class="no-print card"><h2>📄 แบบบันทึกข้อมูลพรรณไม้ (ก.7-003)</h2><div class="btn-row"><select id="ksp" style="width:auto"><option value="">ทุกชนิด (' + verified.length + ')</option>' +
      verified.map(function (s) { return '<option value="' + esc(s.species_id) + '" ' + (q.sp === s.species_id ? 'selected' : '') + '>' + esc(s.species_code + ' ' + s.thai_name) + '</option>'; }).join('') +
      '</select><button class="btn primary" onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button></div>' +
      '<p class="small muted" style="margin-top:6px">รูปแบบหัวข้ออิงแบบ ก.7-003 — ตรวจให้ตรงกับคู่มือ อพ.สธ. ฉบับที่โรงเรียนใช้อีกครั้ง</p></div>' +
      list.map(function (s) {
        var trees = App.boot.trees.filter(function (t) { return t.species_id === s.species_id && t.status === 'verified'; });
        var cover = trees.filter(function (t) { return t.cover; })[0];
        return '<div class="card" style="page-break-after:always;color:#000"><div style="display:flex;justify-content:space-between;gap:12px"><div><b>แบบบันทึกข้อมูลพรรณไม้ (ก.7-003)</b><br>' + esc(st.school_name) + '</div>' +
          '<div class="right">รหัสพรรณไม้ <b>7-' + esc(st.postal_code) + '-' + esc(s.species_code) + '</b><br>จำนวน ' + trees.length + ' ต้น</div></div><hr>' +
          (cover ? '<div style="float:right;width:38%;margin-left:12px">' + UI.photoImg(cover.cover, 'full', 'style="border-radius:6px"') + '</div>' : '') +
          '<p><b>ชื่อพื้นเมือง:</b> ' + v(s.local_name) + '<br><b>ชื่อ:</b> ' + v(s.thai_name) + '<br><b>ชื่อสามัญ:</b> ' + v(s.common_name) +
          '<br><b>ชื่อวิทยาศาสตร์:</b> <i>' + v(s.scientific_name) + '</i><br><b>ชื่อวงศ์:</b> ' + v(s.family) + '<br><b>ลักษณะวิสัย:</b> ' + v(s.habit) +
          '<br><b>บริเวณที่พบ:</b> ' + v(trees.map(function (t) { return App.zoneName(t.zone_id); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(', ')) + '</p>' +
          '<p><b>ลักษณะทางพฤกษศาสตร์:</b><br>' + v(s.description || [s.habit, s.bark ? 'เปลือก' + s.bark : '', s.leaf_type, s.leaf_arrangement, s.leaf_shape ? 'แผ่นใบ' + s.leaf_shape : '', s.flower_type ? 'ดอก' + s.flower_type : '', s.flower_color ? 'สี' + s.flower_color : '', s.fruit_type ? 'ผลแบบ' + s.fruit_type : ''].filter(Boolean).join(' ')) + '</p>' +
          '<p><b>ช่วงออกดอก:</b> ' + v(s.flowering_season) + ' &nbsp; <b>ช่วงติดผล:</b> ' + v(s.fruiting_season) + '</p>' +
          '<p><b>การใช้ประโยชน์ในท้องถิ่น</b><br>1. อาหาร: ' + v(s.use_food) + '<br>2. ยารักษาโรค: ' + v(s.use_medicine) + '<br>3. ก่อสร้าง เครื่องเรือน เครื่องใช้: ' + v(s.use_construction) +
          '<br>4. ยาฆ่าแมลง ยาปราบศัตรูพืช: ' + v(s.use_pesticide) + '<br>5. ความเกี่ยวข้องกับประเพณี วัฒนธรรม ความเชื่อ: ' + v(s.use_culture) + '<br>6. อื่นๆ: ' + v(s.use_other) + '</p>' +
          '<p><b>ผู้ให้ข้อมูล/แหล่งข้อมูล:</b> ' + v(s.info_source) + '<br><b>เอกสารอ้างอิง:</b> ' + v(s.references) + '</p></div>';
      }).join('');
    UI.$('#ksp', el).onchange = function (e) { location.hash = '#/labels?form=k7003' + (e.target.value ? '&sp=' + e.target.value : ''); };
    UI.hydratePhotos(el);
  }
})();
