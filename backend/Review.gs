/**
 * Review.gs — ขั้นตอนตรวจงาน: ร่าง → (หัวหน้ากลุ่ม) → ครู → อนุมัติ + ออกรหัสพรรณไม้
 */

/** ออกรหัสชนิด (YYY) และรหัสต้น (7-XXXXX-YYY-ZZZ) ถ้ายังไม่มี */
function assignCodes(tree, species) {
  var out = { species_code: species ? species.species_code : '', tree_code: tree.tree_code };
  if (!species) return out;
  var postal = str(getSettings().postal_code);
  if (!/^\d{5}$/.test(postal)) fail('กรุณาตั้งรหัสไปรษณีย์โรงเรียน (5 หลัก) ที่หน้า ตั้งค่าระบบ ก่อนอนุมัติ');

  if (!str(species.species_code)) {
    var maxSp = 0;
    DB.all('Species').forEach(function (s) { var n = parseInt(s.species_code, 10); if (n > maxSp) maxSp = n; });
    out.species_code = pad(maxSp + 1, 3);
  }
  if (!str(tree.tree_code) || tree.tree_code.indexOf('TMP-') === 0) {
    var prefix = '7-' + postal + '-' + out.species_code + '-';
    var maxTree = 0;
    DB.all('Trees').forEach(function (t) {
      if (String(t.tree_code).indexOf(prefix) === 0) {
        var n = parseInt(String(t.tree_code).slice(prefix.length), 10);
        if (n > maxTree) maxTree = n;
      }
    });
    out.tree_code = prefix + pad(maxTree + 1, 3);
  }
  return out;
}

function addReview(ctx, treeId, decision, field, comment, score) {
  DB.insert('Reviews', {
    review_id: DB.nextId('Reviews', 'review_id', 'R', 5), tree_id: treeId, reviewer: ctx.user.user_id,
    role: ctx.role, decision: decision, field: field || '', comment: comment || '',
    score: score === undefined || score === null ? '' : score, created_at: nowIso()
  });
}

function approveTree(t, ctx, score) {
  var sp = t.species_id && t.species_id !== 'UNKNOWN' ? DB.find('Species', 'species_id', t.species_id) : null;
  var codes = assignCodes(t, sp);
  var now = nowIso();
  if (sp && (sp.status !== 'verified' || codes.species_code !== sp.species_code)) {
    DB.update('Species', 'species_id', sp.species_id, {
      species_code: codes.species_code, status: 'verified',
      verified_by: sp.verified_by || ctx.user.user_id, verified_at: sp.verified_at || now, updated_at: now
    });
  }
  var patch = { status: STATUS.VERIFIED, verified_by: ctx.user.user_id, verified_at: now, updated_at: now, tree_code: codes.tree_code };
  if (score !== undefined && score !== null && score !== '') patch.score = score;
  DB.update('Trees', 'tree_id', t.tree_id, patch);

  DB.filter('Photos', function (p) { return p.tree_id === t.tree_id && !bool(p.approved); }).forEach(function (p) {
    DB.update('Photos', 'photo_id', p.photo_id, { approved: true });
  });
  if (t.drive_folder_id && codes.tree_code.indexOf('TMP') !== 0) {
    Platform.renameFolder(t.drive_folder_id, codes.tree_code + '_' + (sp ? sp.thai_name : '') + ' (' + t.tree_id + ')');
  }
  if (!t.verified_at) addPoints(t.created_by, num(getSettings().points_verified) || 0);
  addReview(ctx, t.tree_id, 'approve', '', '', score);
  awardBadges(t.created_by);
  logActivity(ctx, 'approve', t.tree_id, codes);
  return codes;
}

/** เหรียญรางวัลตามแผน H7 */
function awardBadges(userId) {
  var have = {};
  DB.filter('Badges', function (b) { return b.user_id === userId; }).forEach(function (b) { have[b.badge] = true; });
  var mine = DB.filter('Trees', function (t) { return t.created_by === userId && t.status !== STATUS.DELETED; });
  var verified = mine.filter(function (t) { return t.status === STATUS.VERIFIED; });
  var give = function (b) { if (!have[b]) { DB.insert('Badges', { user_id: userId, badge: b, earned_at: nowIso() }); have[b] = true; } };
  if (mine.length >= 5) give('นักสำรวจมือใหม่');
  if (verified.length >= 20) give('นักพฤกษศาสตร์น้อย');
  // ตาเหยี่ยว: เป็นคนแรกที่พบชนิดนี้ในโรงเรียน
  var firstBySpecies = {};
  DB.all('Trees').filter(function (t) { return t.status === STATUS.VERIFIED && t.species_id !== 'UNKNOWN'; })
    .sort(function (a, b) { return String(a.verified_at).localeCompare(String(b.verified_at)); })
    .forEach(function (t) { if (!firstBySpecies[t.species_id]) firstBySpecies[t.species_id] = t.created_by; });
  if (Object.keys(firstBySpecies).some(function (k) { return firstBySpecies[k] === userId; })) give('ตาเหยี่ยว');
}

/** แจ้งนักเรียนทางอีเมล (ถ้าครูเปิดใช้และนักเรียนมีอีเมล) — ส่งไม่ได้ก็ไม่ทำให้การตรวจล้มเหลว */
function notifyStudent(t, decision, d) {
  var s = getSettings();
  if (!bool(s.email_notify)) return;
  var u = DB.find('Users', 'user_id', t.created_by);
  if (!u || !str(u.email)) return;
  var sp = DB.find('Species', 'species_id', t.species_id);
  var name = sp ? sp.thai_name : 'ต้นไม้';
  var comments = (d.comments || []).filter(function (c) { return str(c.comment); }).map(function (c) { return '- ' + c.comment; });
  if (str(d.general)) comments.push('- ' + str(d.general));
  var url = str(s.public_url);
  try {
    Platform.sendMail(u.email,
      '[' + s.system_name + '] ' + (decision === 'approve' ? '✅ ' + name + ' ผ่านการตรวจแล้ว' : '↩️ ' + name + ' ถูกส่งกลับให้แก้ไข'),
      'สวัสดี ' + u.full_name + '\n\n' + (decision === 'approve'
        ? 'ต้นไม้ที่คุณบันทึก (' + name + ') ผ่านการตรวจแล้ว ได้รหัส ' + (DB.find('Trees', 'tree_id', t.tree_id) || {}).tree_code
        : 'ครูส่งงาน ' + name + ' (' + t.tree_code + ') กลับให้แก้ไข') +
      (comments.length ? '\n\nความเห็น:\n' + comments.join('\n') : '') + (url ? '\n\nเปิดระบบ: ' + url : ''));
  } catch (e) { console.warn('ส่งอีเมลไม่สำเร็จ', e); }
}

var Review = {
  reviewQueue: function (d, ctx) {
    var idx = { users: usersIndex(), photos: {} };
    var photoCount = {};
    DB.all('Photos').forEach(function (p) {
      idx.photos[p.photo_id] = p;
      photoCount[p.tree_id] = (photoCount[p.tree_id] || 0) + 1;
    });
    var lastAi = {};
    DB.all('AILog').forEach(function (l) {
      if (l.kind === 'identify' && l.tree_id) lastAi[l.tree_id] = { name: l.top_name, confidence: num(l.top_confidence) };
    });
    var spIdx = {};
    DB.all('Species').forEach(function (s) { spIdx[s.species_id] = s; });
    var wanted = ctx.level >= ROLE_LEVEL.teacher ? [STATUS.SUBMITTED, STATUS.PENDING_TEACHER] : [STATUS.SUBMITTED];
    return DB.filter('Trees', function (t) { return wanted.indexOf(t.status) >= 0; })
      .sort(function (a, b) { return String(a.submitted_at).localeCompare(String(b.submitted_at)); })
      .map(function (t) {
        var o = treeOut(t, ctx, idx);
        var u = idx.users[t.created_by] || {};
        var sp = spIdx[t.species_id];
        o.creator_class = u.class || '';
        o.creator_group = u.group || '';
        o.photo_count = photoCount[t.tree_id] || 0;
        o.ai = lastAi[t.tree_id] || null;
        o.species_name = sp ? sp.thai_name : 'ยังไม่ทราบชนิด';
        o.scientific_name = sp ? sp.scientific_name : '';
        o.species_is_new = sp ? sp.status !== 'verified' : false;
        return o;
      });
  },

  /**
   * d = { tree_id, decision: 'approve'|'return'|'pass'|'comment', comments: [{field, comment}], general, score }
   */
  review: function (d, ctx) {
    var t = DB.find('Trees', 'tree_id', d.tree_id);
    if (!t) fail('ไม่พบต้นไม้');
    var isTeacher = ctx.level >= ROLE_LEVEL.teacher;
    var decision = d.decision;
    var score = num(d.score);

    if (!isTeacher) {
      if (t.status !== STATUS.SUBMITTED) fail('รายการนี้ไม่ได้อยู่ในขั้นหัวหน้ากลุ่มตรวจ');
      if (decision === 'approve') fail('หัวหน้ากลุ่มอนุมัติขั้นสุดท้ายไม่ได้ — กด "ผ่าน ส่งต่อให้ครู"');
      if (t.created_by === ctx.user.user_id) fail('ตรวจงานของตัวเองไม่ได้');
    } else if (decision !== 'comment' && [STATUS.SUBMITTED, STATUS.PENDING_TEACHER].indexOf(t.status) < 0) {
      fail('รายการนี้ไม่ได้อยู่ในคิวตรวจ (สถานะ: ' + t.status + ')');
    }

    (d.comments || []).forEach(function (c) {
      if (str(c.comment)) addReview(ctx, t.tree_id, 'comment', str(c.field), str(c.comment));
    });
    if (str(d.general)) addReview(ctx, t.tree_id, 'comment', '', str(d.general));

    var result = { status: t.status };
    if (decision === 'approve') {
      result = approveTree(t, ctx, score);
      result.status = STATUS.VERIFIED;
    } else if (decision === 'return') {
      if (!(d.comments || []).some(function (c) { return str(c.comment); }) && !str(d.general)) {
        fail('กรุณาเขียนความเห็นบอกนักเรียนว่าต้องแก้อะไร');
      }
      DB.update('Trees', 'tree_id', t.tree_id, { status: STATUS.RETURNED, updated_at: nowIso() });
      addReview(ctx, t.tree_id, 'return', '', '', score);
      result.status = STATUS.RETURNED;
    } else if (decision === 'pass') {
      DB.update('Trees', 'tree_id', t.tree_id, { status: STATUS.PENDING_TEACHER, updated_at: nowIso() });
      addReview(ctx, t.tree_id, 'pass', '', '');
      result.status = STATUS.PENDING_TEACHER;
    } else if (decision !== 'comment') {
      fail('ไม่รู้จักคำสั่ง ' + decision);
    }
    logActivity(ctx, 'review:' + decision, t.tree_id);
    if (decision === 'approve' || decision === 'return') notifyStudent(t, decision, d);
    return result;
  },

  /** อนุมัติหลายรายการพร้อมกัน */
  bulkApprove: function (d, ctx) {
    var done = [], errors = [];
    (d.tree_ids || []).forEach(function (id) {
      var t = DB.find('Trees', 'tree_id', id);
      if (!t || [STATUS.SUBMITTED, STATUS.PENDING_TEACHER].indexOf(t.status) < 0) { errors.push(id + ': ไม่อยู่ในคิว'); return; }
      try { approveTree(t, ctx, null); done.push(id); } catch (e) { errors.push(id + ': ' + e.message); }
    });
    return { approved: done, errors: errors };
  }
};
