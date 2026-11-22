/**
 * Reports.gs — ส่งออกข้อมูล (CSV) ทะเบียน ก.7-005, ข้อมูลรายต้น, ข้อมูลรายชนิด, คะแนนนักเรียน
 */

function csvEscape(v) {
  v = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function toCsv(header, rows) {
  return [header].concat(rows).map(function (r) { return r.map(csvEscape).join(','); }).join('\r\n');
}

var Reports = {
  exportCsv: function (d, ctx) {
    var type = d.type;
    var spIdx = {}, zoneIdx = {};
    DB.all('Species').forEach(function (s) { spIdx[s.species_id] = s; });
    DB.all('Zones').forEach(function (z) { zoneIdx[z.zone_id] = z.name; });
    var verified = DB.filter('Trees', function (t) { return t.status === STATUS.VERIFIED; });
    var stamp = Platform.today();

    if (type === 'register') {
      // ทะเบียนพรรณไม้ (ก.7-005): หนึ่งแถวต่อชนิด
      var bySp = {};
      verified.forEach(function (t) {
        (bySp[t.species_id] = bySp[t.species_id] || []).push(t);
      });
      var rows = Object.keys(bySp).filter(function (id) { return spIdx[id]; }).map(function (id) { return spIdx[id]; })
        .sort(function (a, b) { return String(a.species_code).localeCompare(String(b.species_code)); })
        .map(function (s, i) {
          var ts = bySp[s.species_id];
          var zones = {};
          ts.forEach(function (t) { if (t.zone_id) zones[zoneIdx[t.zone_id] || t.zone_id] = true; });
          return [i + 1, s.species_code, s.thai_name, s.local_name, s.common_name, s.scientific_name, s.family,
            s.habit, ts.length, ts.map(function (t) { return t.tree_code; }).join(' '), Object.keys(zones).join(', ')];
        });
      return {
        filename: 'ทะเบียนพรรณไม้_ก7-005_' + stamp + '.csv',
        csv: toCsv(['ลำดับ', 'รหัสพรรณไม้', 'ชื่อ', 'ชื่อพื้นเมือง', 'ชื่อสามัญ', 'ชื่อวิทยาศาสตร์', 'วงศ์',
          'ลักษณะวิสัย', 'จำนวนต้น', 'รหัสประจำต้น', 'บริเวณที่พบ'], rows)
      };
    }

    if (type === 'trees') {
      var all = DB.filter('Trees', function (t) { return t.status !== STATUS.DELETED; });
      var users = usersIndex();
      return {
        filename: 'ต้นไม้รายต้น_' + stamp + '.csv',
        csv: toCsv(['รหัสต้น', 'tree_id', 'ชื่อ', 'ชื่อวิทยาศาสตร์', 'วงศ์', 'โซน', 'ละติจูด', 'ลองจิจูด', 'ความแม่นยำ GPS (ม.)',
          'ความสูง (ม.)', 'เส้นรอบวงที่ระดับอก (ซม.)', 'เส้นผ่านศูนย์กลาง (ซม.)', 'ทรงพุ่ม (ม.)', 'สุขภาพ', 'ที่มา',
          'สถานะป้าย', 'สถานะ', 'ผู้บันทึก', 'ห้อง', 'วันที่บันทึก', 'วันที่อนุมัติ'],
          all.map(function (t) {
            var s = spIdx[t.species_id] || {}, u = users[t.created_by] || {};
            return [t.tree_code, t.tree_id, s.thai_name || 'ยังไม่ทราบชนิด', s.scientific_name, s.family,
              zoneIdx[t.zone_id] || t.zone_id, t.lat, t.lng, t.gps_accuracy_m, t.height_m, t.gbh_cm, t.dbh_cm, t.canopy_m,
              t.health, t.planting_source, t.label_status, t.status, u.full_name, u.class,
              String(t.created_at).slice(0, 10), String(t.verified_at).slice(0, 10)];
          }))
      };
    }

    if (type === 'species') {
      var cols = SCHEMA.Species;
      return {
        filename: 'ข้อมูลพรรณไม้รายชนิด_' + stamp + '.csv',
        csv: toCsv(cols, DB.filter('Species', function (s) { return s.status !== 'archived'; })
          .map(function (s) { return cols.map(function (c) { return s[c]; }); }))
      };
    }

    if (type === 'scores') {
      var counts = {};
      DB.all('Trees').forEach(function (t) {
        if (t.status === STATUS.DELETED) return;
        var c = counts[t.created_by] = counts[t.created_by] || { total: 0, verified: 0, score: 0, scored: 0 };
        c.total++;
        if (t.status === STATUS.VERIFIED) c.verified++;
        if (num(t.score) !== null) { c.score += num(t.score); c.scored++; }
      });
      var students = DB.filter('Users', function (u) { return u.role === 'student' || u.role === 'leader'; });
      return {
        filename: 'ผลงานนักเรียน_' + stamp + '.csv',
        csv: toCsv(['เลขประจำตัว', 'ชื่อ-สกุล', 'ห้อง', 'เลขที่', 'กลุ่ม', 'จำนวนต้นที่บันทึก', 'ผ่านการตรวจ', 'คะแนนคุณภาพเฉลี่ย', 'คะแนนสะสม'],
          students.sort(function (a, b) {
            return String(a.class).localeCompare(String(b.class)) || (num(a.number) || 0) - (num(b.number) || 0);
          }).map(function (u) {
            var c = counts[u.user_id] || { total: 0, verified: 0, score: 0, scored: 0 };
            return [u.username, u.full_name, u.class, u.number, u.group, c.total, c.verified,
              c.scored ? Math.round(c.score / c.scored * 10) / 10 : '', num(u.points) || 0];
          }))
      };
    }
    fail('ไม่รู้จักรายงาน ' + type);
  }
};
