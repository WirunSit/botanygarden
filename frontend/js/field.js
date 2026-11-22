/**
 * field.js — งานติดตามภาคสนาม
 *  H3 ชีพลักษณ์ · H4 การเติบโต/สุขภาพ/การดูแล/แจ้งปัญหา · H5 คาร์บอน · H6 สิ่งมีชีวิตร่วม · H12 พิพิธภัณฑ์พืชดิจิทัล
 */

/** H5 — ประมาณการกักเก็บคาร์บอนด้วยสมการแอลโลเมตรี */
var Carbon = (function () {
  var REF = 'มวลชีวภาพเหนือดิน AGB (กก.) = 0.0673 × (ρ·D²·H)^0.976 — Chave et al. (2014) Global Change Biology 20:3177–3190 · ' +
    'มวลใต้ดิน = AGB × อัตราส่วนราก/ลำต้น · คาร์บอน = มวลรวม × สัดส่วนคาร์บอน (IPCC 2006) · CO₂ = C × 44/12';
  var EXCLUDE = ['ปาล์ม', 'ไผ่', 'ไม้เลื้อย', 'ไม้ล้มลุก', 'เฟิร์น', 'กล้วยไม้'];

  function params() {
    var s = (App.boot && App.boot.settings) || {};
    return { rho: Number(s.wood_density_default) || 0.6, cf: Number(s.carbon_fraction) || 0.47, rs: Number(s.root_shoot_ratio) || 0.24 };
  }
  /** คืน { agb, total, c, co2, rho } (กิโลกรัม) หรือ null ถ้าคำนวณไม่ได้ */
  function tree(t, sp) {
    sp = sp || App.spOf(t) || {};
    var D = Number(t.dbh_cm), H = Number(t.height_m);
    if (!D || !H || D < 5 || EXCLUDE.indexOf(sp.habit) >= 0) return null;
    var p = params();
    var rho = Number(sp.wood_density) || p.rho;
    var agb = 0.0673 * Math.pow(rho * D * D * H, 0.976);
    var total = agb * (1 + p.rs);
    var c = total * p.cf;
    return { agb: agb, total: total, c: c, co2: c * 44 / 12, rho: rho };
  }
  function total(trees) {
    var out = { n: 0, agb: 0, c: 0, co2: 0 };
    trees.forEach(function (t) {
      var r = tree(t);
      if (!r) return;
      out.n++; out.agb += r.agb; out.c += r.c; out.co2 += r.co2;
    });
    return out;
  }
  return { tree: tree, total: total, REF: REF, EXCLUDE: EXCLUDE };
})();

(function () {
  var PHENO = [['new_leaf', 'แตกใบอ่อน', '🌱'], ['leaf_fall', 'ผลัดใบ', '🍂'], ['flower_bud', 'ตาดอก', '🌰'], ['flowering', 'ออกดอก', '🌼'], ['fruiting', 'ติดผล', '🍈'], ['ripe_fruit', 'ผลสุก', '🍎']];
  var LEVEL_COLOR = { 'ไม่มี': '#eef1ef', 'น้อย': '#c6e8cf', 'ปานกลาง': '#68c08a', 'มาก': '#2f855a' };

  function today() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function chipsHtml(name, list, cur) {
    return '<div class="chips" data-chips="' + name + '">' + App.listOpts(list).map(function (o) {
      return '<button type="button" class="chip ' + (cur === o.value ? 'on' : '') + '" data-v="' + esc(o.value) + '" title="' + esc(o.hint || '') + '">' + esc(o.value) + '</button>';
    }).join('') + '</div>';
  }
  function bindChips(root, state) {
    root.addEventListener('click', function (e) {
      var c = e.target.closest('[data-chips] .chip');
      if (!c) return;
      var name = c.parentNode.dataset.chips;
      state[name] = state[name] === c.dataset.v ? '' : c.dataset.v;
      UI.$$('.chip', c.parentNode).forEach(function (x) { x.classList.toggle('on', x.dataset.v === state[name]); });
    });
  }
  function photoField(label) {
    return '<label class="field"><span>📷 ' + (label || 'รูปประกอบ (ไม่บังคับ)') + '</span><input type="file" accept="image/*" capture="environment" name="photo"></label>';
  }
  /** อัปโหลดรูปจาก input (ถ้ามี) คืน photo_id */
  function uploadOptional(root, treeId, part) {
    var inp = root.querySelector('input[type=file][name=photo]');
    var file = inp && inp.files[0];
    if (!file) return Promise.resolve('');
    var s = App.boot.settings;
    return UI.resizeImage(file, Number(s.photo_max_px) || 1600, Number(s.photo_quality) || 0.8).then(function (img) {
      return api('uploadPhoto', { tree_id: treeId, part: part, data: img.base64, mime: img.mime, taken_at: new Date(file.lastModified || Date.now()).toISOString() });
    }).then(function (p) { return p.photo_id; });
  }
  function photoById(r, id) { return id ? r.photos.filter(function (p) { return p.photo_id === id; })[0] : null; }
  function smallPhoto(r, id) {
    var p = photoById(r, id);
    return p ? '<span style="display:inline-block;width:64px;height:64px;border-radius:8px;overflow:hidden;cursor:zoom-in;flex:none" data-zoom="' + esc(p.full || p.thumb) + '">' + UI.photoImg(p) + '</span>' : '';
  }
  function canAdd(t) { return App.me && t.status !== 'archived'; }
  function done(c, msg, tab) {
    UI.toast(msg, 'ok');
    return c.reload(tab);
  }

  /** กราฟเส้นอย่างง่าย (SVG) points = [{d: 'YYYY-MM-DD', v}] */
  function lineChart(points, unit, color) {
    points = points.filter(function (p) { return p.v !== null && p.v !== undefined && p.v !== ''; })
      .sort(function (a, b) { return String(a.d).localeCompare(String(b.d)); });
    if (points.length < 2) return '<div class="small muted">ต้องวัดอย่างน้อย 2 ครั้งจึงจะแสดงกราฟ</div>';
    var W = 320, H = 130, L = 40, R = 10, T = 12, B = 26;
    var xs = points.map(function (p) { return new Date(p.d).getTime(); }), ys = points.map(function (p) { return Number(p.v); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    var pad = (y1 - y0) * .15; y0 = Math.max(0, y0 - pad); y1 += pad;
    var X = function (v) { return L + (v - x0) / Math.max(1, x1 - x0) * (W - L - R); };
    var Y = function (v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); };
    var path = points.map(function (p, i) { return (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(ys[i]).toFixed(1); }).join('');
    var grow = ys[ys.length - 1] - ys[0];
    var years = (x1 - x0) / (365.25 * 864e5);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:520px;height:auto" role="img">' +
      [y0, (y0 + y1) / 2, y1].map(function (v) { return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e2e8e4"/><text x="' + (L - 4) + '" y="' + (Y(v) + 4) + '" font-size="10" text-anchor="end" fill="#7a8a80">' + UI.fmtNum(v, 1) + '</text>'; }).join('') +
      '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      points.map(function (p, i) { return '<circle cx="' + X(xs[i]) + '" cy="' + Y(ys[i]) + '" r="3.5" fill="' + color + '"><title>' + UI.thDate(p.d) + ': ' + p.v + ' ' + unit + '</title></circle>'; }).join('') +
      '<text x="' + L + '" y="' + (H - 6) + '" font-size="10" fill="#7a8a80">' + UI.thDate(points[0].d) + '</text>' +
      '<text x="' + (W - R) + '" y="' + (H - 6) + '" font-size="10" text-anchor="end" fill="#7a8a80">' + UI.thDate(points[points.length - 1].d) + '</text></svg>' +
      '<div class="small">เพิ่มขึ้น ' + UI.fmtNum(grow, 1) + ' ' + unit + (years >= .4 ? ' (≈ ' + UI.fmtNum(grow / years, 1) + ' ' + unit + '/ปี)' : '') + '</div>';
  }

  // ================= แท็บ ชีพลักษณ์ =================
  function renderPheno(tb, c) {
    var r = c.r, t = c.t, recs = r.field.phenology;
    // ตาราง 12 เดือนล่าสุด: ใช้บันทึกล่าสุดของแต่ละเดือน
    var months = [];
    var d = new Date(); d.setDate(1);
    for (var i = 11; i >= 0; i--) { var x = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push(x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2)); }
    var byMonth = {};
    recs.slice().reverse().forEach(function (rec) { byMonth[String(rec.date).slice(0, 7)] = rec; });
    var grid = '<div class="table-wrap"><table class="tbl" style="font-size:.78rem;text-align:center"><tr><th></th>' + months.map(function (m) {
      return '<th style="padding:4px 2px">' + UI.TH_MONTHS[Number(m.slice(5)) - 1] + '</th>';
    }).join('') + '</tr>' + PHENO.map(function (ph) {
      return '<tr><td style="text-align:left;white-space:nowrap">' + ph[2] + ' ' + ph[1] + '</td>' + months.map(function (m) {
        var v = byMonth[m] ? byMonth[m][ph[0]] : '';
        return '<td style="padding:2px"><div title="' + esc(v || 'ไม่มีข้อมูล') + '" style="height:18px;border-radius:4px;background:' + (v ? LEVEL_COLOR[v] || '#eee' : 'repeating-linear-gradient(45deg,#fff,#fff 3px,#f1f1f1 3px,#f1f1f1 6px)') + '"></div></td>';
      }).join('') + '</tr>';
    }).join('') + '</table></div><div class="small muted" style="margin-top:4px">' +
      Object.keys(LEVEL_COLOR).map(function (k) { return '<span style="display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:middle;background:' + LEVEL_COLOR[k] + '"></span> ' + k; }).join(' &nbsp; ') +
      ' &nbsp; ▨ ไม่มีข้อมูล</div>';

    tb.innerHTML = '<div class="card"><div class="card-title"><h3>📅 ชีพลักษณ์ 12 เดือนล่าสุด</h3>' +
      (canAdd(t) ? '<button class="btn sm primary" id="phAdd">➕ บันทึกวันนี้</button>' : '') + '</div>' +
      '<p class="small muted">บันทึกทุกเดือน: การแตกใบ ผลัดใบ ออกดอก ติดผล — ข้อมูลหลายปีใช้ทำปฏิทินพรรณไม้และโครงงานเรื่องสภาพอากาศได้</p>' + grid + '<div id="phForm"></div></div>' +
      '<div class="card"><h3>บันทึกทั้งหมด (' + recs.length + ')</h3>' + (recs.length ? recs.map(function (rec) {
        var on = PHENO.filter(function (ph) { return rec[ph[0]] && rec[ph[0]] !== 'ไม่มี'; });
        return '<div class="list-item" style="align-items:flex-start">' + smallPhoto(r, rec.photo_id) + '<div class="body"><div class="title">' + UI.thDate(rec.date) + '</div>' +
          '<div class="sub" style="white-space:normal">' + (on.length ? on.map(function (ph) { return ph[2] + ' ' + ph[1] + ' (' + esc(rec[ph[0]]) + ')'; }).join(' · ') : 'ไม่พบการเปลี่ยนแปลง') + '</div>' +
          (rec.note ? '<div class="small">' + esc(rec.note) + '</div>' : '') + '<div class="small muted">' + esc(rec.recorded_by_name) + '</div></div>' +
          (rec.can_delete ? '<button class="btn sm ghost" data-delph="' + esc(rec.record_id) + '" title="ลบ">🗑️</button>' : '') + '</div>';
      }).join('') : '<div class="muted">ยังไม่มีบันทึก</div>') + '</div>';
    UI.hydratePhotos(tb);

    var add = UI.$('#phAdd', tb);
    function openForm() {
      var st = {};
      PHENO.forEach(function (ph) { st[ph[0]] = 'ไม่มี'; });
      var f = UI.$('#phForm', tb);
      f.innerHTML = '<hr><label class="field"><span>วันที่สังเกต</span><input type="date" name="date" value="' + today() + '" max="' + today() + '"></label>' +
        PHENO.map(function (ph) { return '<div class="field"><span class="field-label">' + ph[2] + ' ' + ph[1] + '</span>' + chipsHtml(ph[0], 'pheno_level', 'ไม่มี') + '</div>'; }).join('') +
        '<label class="field"><span>หมายเหตุ</span><input name="note" placeholder="เช่น ดอกบานประมาณครึ่งต้น มีผึ้งมาตอม"></label>' + photoField('รูปประกอบ เช่น ดอก/ผลตอนนี้ (ไม่บังคับ)') +
        '<div class="btn-row"><button class="btn primary big grow" id="phSave">💾 บันทึก</button><button class="btn" id="phCancel">ยกเลิก</button></div>';
      bindChips(f, st);
      UI.$('#phCancel', f).onclick = function () { f.innerHTML = ''; };
      UI.$('#phSave', f).onclick = function () {
        var v = UI.formValues(f);
        UI.busy(uploadOptional(f, t.tree_id, 'phenology').then(function (pid) {
          return api('addPhenology', Object.assign({ tree_id: t.tree_id, date: v.date, note: v.note, photo_id: pid }, st));
        }), 'กำลังบันทึก').then(function (res) {
          return done(c, res && res.queued ? '📴 บันทึกไว้ในเครื่อง จะส่งเมื่อมีเน็ต' : '🌸 บันทึกชีพลักษณ์แล้ว +' + (App.boot.settings.points_phenology || 3) + ' คะแนน', 'pheno');
        }).catch(UI.error);
      };
      f.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (add) add.onclick = openForm;
    if (c.autoAdd && add) openForm();
    tb.onclick = function (e) {
      var b = e.target.closest('[data-delph]');
      if (!b) return;
      UI.confirm('ลบบันทึกนี้?', '', 'ลบ', 'danger solid').then(function (ok) {
        if (ok) UI.busy(api('deletePhenology', { record_id: b.dataset.delph })).then(function () { return done(c, 'ลบแล้ว', 'pheno'); }).catch(UI.error);
      });
    };
  }

  // ================= แท็บ เติบโต/สุขภาพ =================
  function renderGrow(tb, c) {
    var r = c.r, t = c.t, f = r.field, sp = r.species || {};
    var ms = f.measurements.slice();
    if (!ms.length && (t.gbh_cm || t.height_m)) ms.push({ date: String(t.created_at).slice(0, 10), gbh_cm: t.gbh_cm, height_m: t.height_m, canopy_m: t.canopy_m });
    var cb = Carbon.tree(t, sp);
    var open = f.issues.filter(function (x) { return x.status === 'open'; });
    tb.innerHTML =
      '<div class="card"><h3>🌍 การกักเก็บคาร์บอน (ค่าประมาณ)</h3>' + (cb
        ? '<div class="stats"><div class="stat"><b>' + UI.fmtNum(cb.total, 0) + '</b><span>มวลชีวภาพ (กก.)</span></div><div class="stat"><b>' + UI.fmtNum(cb.c, 0) +
          '</b><span>คาร์บอน (กก.C)</span></div><div class="stat"><b>' + UI.fmtNum(cb.co2, 0) + '</b><span>เทียบเท่า CO₂ (กก.)</span></div></div>' +
          '<p class="small muted" style="margin-top:8px">D = ' + t.dbh_cm + ' ซม., H = ' + t.height_m + ' ม., ρ = ' + cb.rho + ' ก./ลบ.ซม.' + (sp.wood_density ? '' : ' (ค่าเริ่มต้น)') + '<br>' + esc(Carbon.REF) + '</p>'
        : '<p class="muted small">คำนวณได้เมื่อมีเส้นรอบวงที่ระดับอก (≥ 16 ซม.) และความสูง และเป็นไม้ต้น/ไม้พุ่ม (ไม่รวม ' + Carbon.EXCLUDE.join(' ') + ')</p>') + '</div>' +
      '<div class="card"><div class="card-title"><h3>📈 การเจริญเติบโต</h3>' + (canAdd(t) ? '<button class="btn sm primary" id="msAdd">➕ วัดซ้ำ</button>' : '') + '</div>' +
      '<p class="small muted">วัดเส้นรอบวงซ้ำทุกภาคเรียนที่ตำแหน่งเดิม (130 ซม. จากพื้น)</p><div id="msForm"></div>' +
      '<div class="split even"><div><b class="small">เส้นรอบวงที่ระดับอก (ซม.)</b>' + lineChart(ms.map(function (m) { return { d: m.date, v: m.gbh_cm }; }), 'ซม.', '#2f855a') + '</div>' +
      '<div><b class="small">ความสูง (ม.)</b>' + lineChart(ms.map(function (m) { return { d: m.date, v: m.height_m }; }), 'ม.', '#2b6cb0') + '</div></div>' +
      (f.measurements.length ? '<div class="table-wrap" style="margin-top:10px"><table class="tbl"><tr><th>วันที่</th><th>สูง (ม.)</th><th>รอบวง (ซม.)</th><th>DBH</th><th>ทรงพุ่ม</th><th>สุขภาพ</th><th>ผู้วัด</th></tr>' +
        f.measurements.map(function (m) {
          return '<tr><td>' + UI.thDate(m.date) + '</td><td>' + UI.fmtNum(m.height_m) + '</td><td>' + UI.fmtNum(m.gbh_cm) + '</td><td>' + UI.fmtNum(m.dbh_cm) + '</td><td>' + UI.fmtNum(m.canopy_m) +
            '</td><td>' + esc(m.health) + '</td><td>' + esc(m.recorded_by_name) + '</td></tr>';
        }).join('') + '</table></div>' : '') + '</div>' +
      (App.me ? '<div class="card"><div class="card-title"><h3>⚠️ แจ้งปัญหา (' + open.length + ' ยังไม่แก้)</h3>' + (canAdd(t) || t.status === 'archived' ? '<button class="btn sm warn" id="isAdd">⚠️ แจ้งปัญหา</button>' : '') + '</div><div id="isForm"></div>' +
        (f.issues.length ? f.issues.map(function (x) {
          return '<div class="list-item" style="align-items:flex-start">' + smallPhoto(r, x.photo_id) + '<div class="body"><div class="title">' + esc(x.type) + ' ' +
            (x.status === 'open' ? '<span class="pill returned">ยังไม่แก้</span>' : '<span class="pill verified">แก้แล้ว</span>') + '</div>' +
            '<div class="sub" style="white-space:normal">' + esc(x.description) + '</div><div class="small muted">' + esc(x.reported_by_name) + ' · ' + UI.thDate(x.reported_at, true) + '</div>' +
            (x.resolution ? '<div class="small">✅ ' + esc(x.resolution) + ' — ' + esc(x.resolved_by_name) + '</div>' : '') + '</div>' +
            (App.level() >= 3 && x.status === 'open' ? '<button class="btn sm" data-resolve="' + esc(x.issue_id) + '">แก้แล้ว</button>' : '') + '</div>';
        }).join('') : '<div class="muted small">ไม่มีปัญหาที่แจ้งไว้</div>') + '</div>' : '') +
      '<div class="card"><div class="card-title"><h3>🧑‍🌾 ประวัติการดูแล</h3>' + (canAdd(t) ? '<button class="btn sm" id="crAdd">➕ บันทึกการดูแล</button>' : '') + '</div><div id="crForm"></div>' +
      (f.care.length ? f.care.map(function (x) {
        return '<div class="list-item"><div class="body"><div class="title">' + esc(x.type) + ' <span class="small muted">' + UI.thDate(x.date) + '</span></div><div class="sub" style="white-space:normal">' + esc(x.note) +
          '</div><div class="small muted">' + esc(x.recorded_by_name) + '</div></div></div>';
      }).join('') : '<div class="muted small">ยังไม่มีบันทึก</div>') + '</div>';
    UI.hydratePhotos(tb);

    var ma = UI.$('#msAdd', tb);
    if (ma) ma.onclick = function () {
      var st = { health: t.health || '' };
      var fm = UI.$('#msForm', tb);
      fm.innerHTML = '<div class="row2"><label class="field"><span>วันที่วัด</span><input type="date" name="date" value="' + today() + '" max="' + today() + '"></label>' +
        '<label class="field"><span>ความสูง (ม.)</span><input type="number" step="any" min="0" inputmode="decimal" name="height_m" placeholder="' + esc(t.height_m || '') + '"></label></div>' +
        '<div class="row2"><label class="field"><span>เส้นรอบวงที่ระดับอก (ซม.)</span><input type="number" step="any" min="0" inputmode="decimal" name="gbh_cm" placeholder="' + esc(t.gbh_cm || '') + '"></label>' +
        '<label class="field"><span>ทรงพุ่ม (ม.)</span><input type="number" step="any" min="0" inputmode="decimal" name="canopy_m" placeholder="' + esc(t.canopy_m || '') + '"></label></div>' +
        '<div class="field"><span class="field-label">สุขภาพ</span>' + chipsHtml('health', 'health', st.health) + '</div>' +
        '<label class="field"><span>หมายเหตุ</span><input name="note"></label><div class="btn-row"><button class="btn primary grow" id="msSave">💾 บันทึก</button><button class="btn" id="msCancel">ยกเลิก</button></div><hr>';
      bindChips(fm, st);
      UI.$('#msCancel', fm).onclick = function () { fm.innerHTML = ''; };
      UI.$('#msSave', fm).onclick = function () {
        var v = UI.formValues(fm);
        UI.busy(api('addMeasurement', { tree_id: t.tree_id, date: v.date, height_m: v.height_m, gbh_cm: v.gbh_cm, canopy_m: v.canopy_m, health: st.health, note: v.note }))
          .then(function (res) { return done(c, res && res.queued ? '📴 บันทึกไว้ในเครื่องแล้ว' : '📏 บันทึกการวัดแล้ว', 'grow'); }).catch(UI.error);
      };
    };
    var ia = UI.$('#isAdd', tb);
    if (ia) ia.onclick = function () {
      var st = {};
      var fm = UI.$('#isForm', tb);
      fm.innerHTML = '<div class="field"><span class="field-label">ประเภทปัญหา</span>' + chipsHtml('type', 'issue_type', '') + '</div>' +
        '<label class="field"><span>รายละเอียด</span><textarea name="description" placeholder="เช่น กิ่งหักห้อยเหนือทางเดิน อันตราย"></textarea></label>' + photoField() +
        '<div class="btn-row"><button class="btn warn grow" id="isSave">⚠️ แจ้งครู</button><button class="btn" id="isCancel">ยกเลิก</button></div><hr>';
      bindChips(fm, st);
      UI.$('#isCancel', fm).onclick = function () { fm.innerHTML = ''; };
      UI.$('#isSave', fm).onclick = function () {
        if (!st.type) return UI.toast('เลือกประเภทปัญหา', 'error');
        UI.busy(uploadOptional(fm, t.tree_id, 'issue').then(function (pid) {
          return api('reportIssue', { tree_id: t.tree_id, type: st.type, description: UI.formValues(fm).description, photo_id: pid });
        })).then(function () { return done(c, 'แจ้งครูแล้ว ขอบคุณที่ช่วยดูแลต้นไม้ 🙏', 'grow'); }).catch(UI.error);
      };
    };
    var ca = UI.$('#crAdd', tb);
    if (ca) ca.onclick = function () {
      var st = {};
      var fm = UI.$('#crForm', tb);
      fm.innerHTML = '<div class="field"><span class="field-label">การดูแล</span>' + chipsHtml('type', 'care_type', '') + '</div>' +
        '<div class="row2"><label class="field"><span>วันที่</span><input type="date" name="date" value="' + today() + '" max="' + today() + '"></label>' +
        '<label class="field"><span>รายละเอียด</span><input name="note" placeholder="เช่น ปุ๋ยคอก 2 กก."></label></div>' +
        '<div class="btn-row"><button class="btn primary grow" id="crSave">💾 บันทึก</button><button class="btn" id="crCancel">ยกเลิก</button></div><hr>';
      bindChips(fm, st);
      UI.$('#crCancel', fm).onclick = function () { fm.innerHTML = ''; };
      UI.$('#crSave', fm).onclick = function () {
        if (!st.type) return UI.toast('เลือกประเภทการดูแล', 'error');
        var v = UI.formValues(fm);
        UI.busy(api('addCare', { tree_id: t.tree_id, type: st.type, date: v.date, note: v.note })).then(function () { return done(c, 'บันทึกแล้ว', 'grow'); }).catch(UI.error);
      };
    };
    tb.onclick = function (e) {
      var b = e.target.closest('[data-resolve]');
      if (b) resolveIssueModal(b.dataset.resolve).then(function (ok) { if (ok) c.reload('grow'); });
    };
  }

  function resolveIssueModal(id) {
    return UI.modal({
      title: '✅ ปิดเรื่องแจ้งปัญหา',
      body: '<label class="field"><span>แก้ไขอย่างไร</span><textarea name="resolution" placeholder="เช่น ภารโรงตัดกิ่งที่หักออกแล้ว"></textarea></label>' +
        '<label class="field"><span>บันทึกเป็นการดูแลด้วย (ไม่บังคับ)</span><select name="care_type"><option value="">— ไม่บันทึก —</option>' +
        App.listOpts('care_type').map(function (o) { return '<option>' + esc(o.value) + '</option>'; }).join('') + '</select></label>',
      buttons: [{ label: 'ยกเลิก', value: false }, {
        label: 'บันทึก', cls: 'primary', onClick: function (m) {
          var v = UI.formValues(m);
          return api('resolveIssue', { issue_id: id, resolution: v.resolution, care_type: v.care_type }).then(function () { UI.toast('ปิดเรื่องแล้ว', 'ok'); return true; });
        }
      }]
    });
  }

  // ================= แท็บ นิเวศ & ตัวอย่างแห้ง =================
  function renderEco(tb, c) {
    var r = c.r, t = c.t, f = r.field;
    tb.innerHTML = '<div class="card"><div class="card-title"><h3>🐦 สิ่งมีชีวิตที่พบร่วม (' + f.fauna.length + ')</h3>' + (canAdd(t) ? '<button class="btn sm primary" id="faAdd">➕ เพิ่ม</button>' : '') + '</div>' +
      '<p class="small muted">สัตว์ แมลง เห็ด ไลเคน พืชอิงอาศัยที่พบบนต้นนี้ — ใช้ศึกษาความสัมพันธ์ในระบบนิเวศ</p><div id="faForm"></div>' +
      (f.fauna.length ? '<div class="grid-cards">' + f.fauna.map(function (x) {
        var p = photoById(r, x.photo_id);
        return '<div class="sp-card"><div class="img"' + (p ? ' data-zoom="' + esc(p.full || p.thumb) + '" style="cursor:zoom-in"' : '') + '>' + (p ? UI.photoImg(p) : faunaEmoji(x.type)) + '</div><div class="txt"><b>' + esc(x.name) + '</b>' +
          (x.scientific_name ? '<div class="sci small">' + esc(x.scientific_name) + '</div>' : '') + '<div class="small muted">' + esc(x.type) + ' · ' + esc(x.recorded_by_name) + '</div>' +
          (x.notes ? '<div class="small">' + esc(x.notes) + '</div>' : '') + (x.can_delete ? '<button class="btn sm ghost" data-delfa="' + esc(x.fauna_id) + '">🗑️ ลบ</button>' : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="muted small">ยังไม่มีบันทึก</div>') + '</div>' +
      '<div class="card"><div class="card-title"><h3>🗂️ ตัวอย่างพรรณไม้แห้ง (' + f.specimens.length + ')</h3>' + (App.me ? '<button class="btn sm" id="hbAdd">➕ เพิ่มตัวอย่าง</button>' : '') + '</div><div id="hbForm"></div>' +
      (f.specimens.length ? f.specimens.map(function (x) {
        return '<div class="list-item">' + smallPhoto(r, x.photo_id) + '<div class="body"><div class="title"><span class="code-tag">' + esc(x.specimen_no) + '</span></div>' +
          '<div class="sub">เก็บเมื่อ ' + UI.thDate(x.collected_at) + ' · ' + esc(x.collector) + '</div>' + (x.notes ? '<div class="small">' + esc(x.notes) + '</div>' : '') + '</div></div>';
      }).join('') : '<div class="muted small">ยังไม่มีตัวอย่าง</div>') + '<a class="small" href="#/herbarium">ดูพิพิธภัณฑ์พืชดิจิทัลทั้งหมด ›</a></div>';
    UI.hydratePhotos(tb);

    var fa = UI.$('#faAdd', tb);
    if (fa) fa.onclick = function () {
      var st = {};
      var fm = UI.$('#faForm', tb);
      fm.innerHTML = '<div class="field"><span class="field-label">ประเภท</span>' + chipsHtml('type', 'fauna_type', '') + '</div>' +
        '<label class="field"><span>ชื่อ (ถ้าไม่รู้ชื่อ ให้บรรยายสั้นๆ)</span><input name="name" placeholder="เช่น นกกินปลี / ผีเสื้อสีเหลืองตัวเล็ก"></label>' +
        '<label class="field"><span>ชื่อวิทยาศาสตร์ (ถ้ารู้)</span><input name="scientific_name" class="sci"></label>' +
        '<label class="field"><span>สังเกตอะไรบ้าง</span><textarea name="notes" placeholder="เช่น มาดูดน้ำหวานจากดอก / ทำรังบนกิ่ง"></textarea></label>' + photoField() +
        '<div class="btn-row"><button class="btn primary grow" id="faSave">💾 บันทึก</button><button class="btn" id="faCancel">ยกเลิก</button></div><hr>';
      bindChips(fm, st);
      UI.$('#faCancel', fm).onclick = function () { fm.innerHTML = ''; };
      UI.$('#faSave', fm).onclick = function () {
        var v = UI.formValues(fm);
        if (!st.type) return UI.toast('เลือกประเภท', 'error');
        UI.busy(uploadOptional(fm, t.tree_id, 'fauna').then(function (pid) {
          return api('addFauna', { tree_id: t.tree_id, type: st.type, name: v.name, scientific_name: v.scientific_name, notes: v.notes, photo_id: pid });
        })).then(function () { return done(c, 'บันทึกแล้ว', 'eco'); }).catch(UI.error);
      };
    };
    var hb = UI.$('#hbAdd', tb);
    if (hb) hb.onclick = function () {
      var fm = UI.$('#hbForm', tb);
      fm.innerHTML = '<div class="row2"><label class="field"><span>เลขตัวอย่าง</span><input name="specimen_no" placeholder="เว้นว่าง = ออกเลขอัตโนมัติ"></label>' +
        '<label class="field"><span>วันที่เก็บ</span><input type="date" name="collected_at" value="' + today() + '" max="' + today() + '"></label></div>' +
        '<label class="field"><span>ผู้เก็บ</span><input name="collector" value="' + esc(App.me.full_name) + '"></label>' +
        '<label class="field"><span>ตำแหน่งที่เก็บบนต้น</span><input name="location_note" placeholder="เช่น กิ่งด้านล่างทิศตะวันออก"></label>' +
        '<label class="field"><span>หมายเหตุ</span><textarea name="notes" placeholder="เช่น มีดอก อัดแห้ง 2 สัปดาห์"></textarea></label>' + photoField('รูปสแกน/ถ่ายตัวอย่างแห้ง') +
        '<div class="btn-row"><button class="btn primary grow" id="hbSave">💾 บันทึก</button><button class="btn" id="hbCancel">ยกเลิก</button></div><hr>';
      UI.$('#hbCancel', fm).onclick = function () { fm.innerHTML = ''; };
      UI.$('#hbSave', fm).onclick = function () {
        var v = UI.formValues(fm);
        UI.busy(uploadOptional(fm, t.tree_id, 'herbarium').then(function (pid) {
          return api('saveSpecimen', { specimen: Object.assign({ tree_id: t.tree_id, photo_id: pid }, v) });
        })).then(function (res) { return done(c, 'บันทึกตัวอย่าง ' + (res.specimen_no || '') + ' แล้ว', 'eco'); }).catch(UI.error);
      };
    };
    tb.onclick = function (e) {
      var b = e.target.closest('[data-delfa]');
      if (b) UI.busy(api('deleteFauna', { fauna_id: b.dataset.delfa })).then(function () { return done(c, 'ลบแล้ว', 'eco'); }).catch(UI.error);
    };
  }

  function faunaEmoji(type) {
    return { 'นก': '🐦', 'ผีเสื้อ/มอธ': '🦋', 'แมลงอื่นๆ': '🐞', 'มด/ปลวก': '🐜', 'แมงมุม': '🕷️', 'สัตว์เลื้อยคลาน': '🦎', 'สัตว์สะเทินน้ำสะเทินบก': '🐸',
      'สัตว์เลี้ยงลูกด้วยนม': '🐿️', 'เห็ด/รา': '🍄', 'ไลเคน': '🪨', 'มอส': '🌿', 'พืชอิงอาศัย': '🌺', 'พืชกาฝาก': '🌿' }[type] || '🔎';
  }

  App.treeTabs = {
    pheno: { label: 'ชีพลักษณ์', render: renderPheno },
    grow: { label: 'เติบโต/สุขภาพ', render: renderGrow },
    eco: { label: 'นิเวศ & ตัวอย่าง', render: renderEco }
  };
  App.resolveIssueModal = resolveIssueModal;

  // ================= หน้า บันทึกดอก/ผล (เลือกต้นใกล้ตัว) =================
  App.pages.pheno = function (p, q, el) {
    var trees = App.boot.trees.filter(function (t) { return t.status === 'verified' || (App.me && t.created_by === App.me.user_id && t.status !== 'archived'); });
    var pos = null, term = '';
    function render() {
      var list = trees.filter(function (t) {
        return !term || (App.treeName(t) + ' ' + t.tree_code + ' ' + App.zoneName(t.zone_id)).indexOf(term) >= 0;
      }).map(function (t) { return { t: t, d: pos && t.lat ? Maps.distanceM([pos.lat, pos.lng], [t.lat, t.lng]) : null }; });
      if (pos) list.sort(function (a, b) { return (a.d === null ? 1e9 : a.d) - (b.d === null ? 1e9 : b.d); });
      var month = new Date().toISOString().slice(0, 7);
      UI.$('#phList', el).innerHTML = list.slice(0, 60).map(function (x) {
        return '<a class="list-item" href="#/tree/' + esc(x.t.tree_id) + '?tab=pheno&add=1"><div class="thumb">' + App.thumbHtml(x.t) + '</div><div class="body"><div class="title">' + esc(App.treeName(x.t)) +
          '</div><div class="sub"><span class="code-tag">' + esc(x.t.tree_code) + '</span> ' + esc(App.zoneName(x.t.zone_id)) + (x.d !== null ? ' · ' + Math.round(x.d) + ' ม.' : '') + '</div></div><span class="chev">บันทึก ›</span></a>';
      }).join('') || '<div class="empty">ไม่พบต้นไม้</div>';
      UI.hydratePhotos(el);
    }
    el.innerHTML = '<h1>🌸 บันทึกการแตกใบ ออกดอก ติดผล</h1><p class="muted">เลือกต้นที่จะบันทึก — ควรบันทึกต้นเดิมทุกเดือน (เดือนนี้: ' + UI.TH_MONTHS_FULL[new Date().getMonth()] + ')</p>' +
      '<div class="btn-row" style="margin-bottom:10px"><input type="search" id="phq" placeholder="ค้นหาชื่อ/รหัส/โซน" style="flex:1;min-width:160px"><button class="btn" id="near">📍 เรียงตามต้นที่ใกล้ฉัน</button></div>' +
      '<div class="card" id="phList"></div>';
    UI.$('#phq', el).oninput = function (e) { term = e.target.value.trim(); render(); };
    UI.$('#near', el).onclick = function () { UI.busy(Maps.locateOnce()).then(function (p2) { pos = p2; render(); }).catch(UI.error); };
    render();
  };

  // ================= หน้า พิพิธภัณฑ์พืชดิจิทัล =================
  App.pages.herbarium = function (p, q, el) {
    return api('listSpecimens').then(function (list) {
      var term = '';
      el.innerHTML = '<div class="no-print"><h1>🗂️ พิพิธภัณฑ์พืชดิจิทัล (Digital Herbarium)</h1><p class="muted">ตัวอย่างพรรณไม้แห้งที่นักเรียนเก็บ ผูกกับต้นที่เก็บตัวอย่างมา — เพิ่มตัวอย่างได้ที่หน้าต้นไม้ แท็บ "นิเวศ & ตัวอย่าง"</p>' +
        '<div class="btn-row" style="margin-bottom:12px"><input type="search" id="hq" placeholder="ค้นหาเลขตัวอย่าง ชื่อ วงศ์ ผู้เก็บ" style="flex:1;min-width:180px">' +
        '<button class="btn" onclick="window.print()">🖨️ พิมพ์ป้ายตัวอย่าง</button></div></div><div id="hbList"></div>';
      function render() {
        var shown = list.filter(function (x) { return !term || JSON.stringify([x.specimen_no, x.thai_name, x.scientific_name, x.family, x.collector]).indexOf(term) >= 0; });
        UI.$('#hbList', el).innerHTML = shown.length ? '<div class="labels-sheet">' + shown.map(function (x) {
          return '<div class="plant-label" style="grid-template-columns:1fr 30mm;min-height:auto"><div><div class="code">' + esc(App.boot.settings.school_name) + ' — Herbarium</div>' +
            '<div style="font-weight:800">เลขที่ ' + esc(x.specimen_no) + '</div><div class="fam">วงศ์ ' + esc(x.family) + '</div><div class="sci"><i>' + esc(x.scientific_name) + '</i></div>' +
            '<div>' + esc(x.thai_name) + '</div><div class="use">ต้น <a href="#/tree/' + esc(x.tree_id) + '">' + esc(x.tree_code) + '</a> · ' + esc(x.location_note) + '<br>เก็บโดย ' + esc(x.collector) +
            ' · ' + UI.thDate(x.collected_at) + (x.notes ? '<br>' + esc(x.notes) : '') + '</div></div><div>' + (x.photo ? '<div data-zoom="' + esc(x.photo.full || x.photo.thumb) + '" style="cursor:zoom-in;border-radius:3mm;overflow:hidden">' + UI.photoImg(x.photo) + '</div>' : '<div class="empty" style="padding:6px">🗂️</div>') + '</div></div>';
        }).join('') + '</div>' : '<div class="empty"><span class="ic">🗂️</span>ยังไม่มีตัวอย่างพรรณไม้แห้ง</div>';
        UI.hydratePhotos(el);
      }
      UI.$('#hq', el).oninput = function (e) { term = e.target.value.trim(); render(); };
      render();
    });
  };
})();
