/**
 * review.js — คิวตรวจงาน และหน้าตรวจรายต้น (อนุมัติ / ส่งกลับพร้อมความเห็นรายช่อง / อนุมัติหลายรายการ)
 */
(function () {
  var lastQueue = [];

  App.pages.reviewQueue = function (p, q, el) {
    var lv = App.level();
    return api('reviewQueue').then(function (items) {
      lastQueue = items.map(function (t) { return t.tree_id; });
      var classes = {}, groups = {};
      items.forEach(function (t) { if (t.creator_class) classes[t.creator_class] = 1; if (t.creator_group) groups[t.creator_group] = 1; });
      var fc = q.c || '', fg = q.g || '', fs = q.s || '';
      var shown = items.filter(function (t) {
        return (!fc || t.creator_class === fc) && (!fg || t.creator_group === fg) && (!fs || t.status === fs);
      });
      function sel(name, label, opts, cur) {
        return '<select data-q="' + name + '" style="min-height:40px;width:auto"><option value="">' + label + '</option>' + opts.map(function (o) {
          return '<option value="' + esc(o[0]) + '" ' + (cur === o[0] ? 'selected' : '') + '>' + esc(o[1]) + '</option>';
        }).join('') + '</select>';
      }
      el.innerHTML = '<h1>✅ คิวตรวจงาน</h1>' +
        '<div class="btn-row" style="margin-bottom:12px">' +
        sel('c', 'ทุกห้อง', Object.keys(classes).sort().map(function (k) { return [k, k]; }), fc) +
        sel('g', 'ทุกกลุ่ม', Object.keys(groups).sort().map(function (k) { return [k, k]; }), fg) +
        (lv >= 3 ? sel('s', 'ทุกขั้น', [['submitted', 'รอหัวหน้ากลุ่ม'], ['pending_teacher', 'รอครู']], fs) : '') + '</div>' +
        (lv >= 3 && shown.length ? '<div class="card flat btn-row" style="align-items:center"><label class="check"><input type="checkbox" id="selAll"> เลือกทั้งหมด</label>' +
          '<button class="btn sm" id="selAi">เลือกที่ AI มั่นใจ ≥ 80% และรูปครบ</button><div class="grow"></div>' +
          '<button class="btn primary" id="bulkBtn" disabled>✅ อนุมัติที่เลือก (<span id="selN">0</span>)</button></div>' : '') +
        '<div class="card">' + (shown.length ? shown.map(function (t) {
          var conf = t.ai && t.ai.confidence !== null ? Math.round(t.ai.confidence * 100) : null;
          return '<div class="list-item">' + (lv >= 3 ? '<input type="checkbox" class="pick" value="' + esc(t.tree_id) + '" data-ai="' + (conf || 0) + '" data-ph="' + t.photo_count + '" style="width:22px;height:22px;flex:none">' : '') +
            '<a href="#/review/' + esc(t.tree_id) + '" style="display:flex;gap:12px;align-items:center;flex:1;min-width:0;text-decoration:none;color:inherit">' +
            '<div class="thumb">' + App.thumbHtml(t) + '</div><div class="body"><div class="title">' + esc(t.species_name) +
            (t.species_is_new ? ' <span class="pill">🆕 ชนิดใหม่</span>' : '') + '</div>' +
            '<div class="sub">' + (t.scientific_name ? '<span class="sci">' + esc(t.scientific_name) + '</span> · ' : '') + esc(t.created_by_name) + (t.creator_class ? ' (' + esc(t.creator_class) + ')' : '') + '</div>' +
            '<div class="sub">' + UI.statusPill(t.status) + ' 📷 ' + t.photo_count + (conf !== null ? ' · 🤖 ' + esc(t.ai.name.split(' / ')[0]) + ' ' + conf + '%' : '') + ' · ' + UI.thDate(t.submitted_at) + '</div></div><span class="chev">›</span></a></div>';
        }).join('') : '<div class="empty"><span class="ic">🎉</span>ไม่มีงานรอตรวจ</div>') + '</div>';
      UI.hydratePhotos(el);
      UI.$$('select[data-q]', el).forEach(function (s) {
        s.onchange = function () {
          var qs = UI.$$('select[data-q]', el).filter(function (x) { return x.value; }).map(function (x) { return x.dataset.q + '=' + encodeURIComponent(x.value); }).join('&');
          location.hash = '#/review' + (qs ? '?' + qs : '');
        };
      });
      if (lv < 3 || !shown.length) return;
      var picks = UI.$$('.pick', el), bulk = UI.$('#bulkBtn', el);
      function upd() {
        var n = picks.filter(function (x) { return x.checked; }).length;
        UI.$('#selN', el).textContent = n; bulk.disabled = !n;
      }
      picks.forEach(function (x) { x.onchange = upd; });
      UI.$('#selAll', el).onchange = function (e) { picks.forEach(function (x) { x.checked = e.target.checked; }); upd(); };
      var req = String(App.boot.settings.required_photo_parts || '').split(',').filter(String).length;
      UI.$('#selAi', el).onclick = function () { picks.forEach(function (x) { x.checked = +x.dataset.ai >= 80 && +x.dataset.ph >= req; }); upd(); };
      bulk.onclick = function () {
        var ids = picks.filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
        UI.confirm('อนุมัติ ' + ids.length + ' รายการ?', 'ระบบจะออกรหัสพรรณไม้ให้อัตโนมัติ — ควรเปิดดูอย่างน้อยรูปและชื่อของแต่ละรายการก่อน', 'อนุมัติทั้งหมด').then(function (ok) {
          if (!ok) return;
          UI.busy(api('bulkApprove', { tree_ids: ids }), 'กำลังอนุมัติ').then(function (r) {
            UI.toast('อนุมัติแล้ว ' + r.approved.length + ' รายการ' + (r.errors.length ? ' — ไม่สำเร็จ ' + r.errors.length : ''), r.errors.length ? 'warn' : 'ok', 7000);
            if (r.errors.length) UI.modal({ title: 'รายการที่อนุมัติไม่สำเร็จ', body: '<ul>' + r.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' });
            return App.refresh();
          }).then(function () { App.pages.reviewQueue(p, q, el); }).catch(UI.error);
        });
      };
    });
  };

  App.pages.reviewTree = function (p, q, el) {
    var lv = App.level();
    return api('getTree', { tree_id: p.id }).then(function (r) {
      var t = r.tree, s = r.species;
      var comments = {};
      var inQueue = t.status === 'submitted' || t.status === 'pending_teacher';
      var leaderStage = t.status === 'submitted';
      var canAct = inQueue && (lv >= 3 || leaderStage);

      function row(key, label, value, html) {
        if (value === '' || value === null || value === undefined) return '';
        return '<div class="list-item" style="align-items:flex-start"><div class="body"><div class="sub" style="white-space:normal">' + esc(label) + '</div>' +
          '<div style="font-weight:600">' + (html || esc(value)) + '</div><div data-cbox="' + key + '"></div></div>' +
          (canAct || lv >= 3 ? '<button class="btn sm ghost" data-c="' + key + '" title="เขียนความเห็นช่องนี้">💬</button>' : '') + '</div>';
      }

      var photoHtml = '<div class="grid-cards" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">' + r.photos.map(function (ph) {
        return '<div class="sp-card"><div class="img" data-zoom="' + esc(ph.full || ph.thumb) + '" style="cursor:zoom-in">' + UI.photoImg(ph) + '</div><div class="txt small">' + esc(Forms.partLabel(ph.part)) + (ph.has_scale ? ' 📏' : '') + '</div></div>';
      }).join('') + '</div>';
      var req = String(App.boot.settings.required_photo_parts || '').split(',').filter(String);
      var missing = req.filter(function (k) { return !r.photos.some(function (x) { return x.part === k; }); });

      var aiHtml = '';
      if (r.ai && r.ai.candidates && r.ai.candidates.length) {
        aiHtml = '<div class="card"><h3>🤖 ผล AI (ล่าสุด)</h3>' + r.ai.candidates.map(function (c, i) {
          return '<div class="small">' + (i + 1) + '. <b>' + esc(c.thai_name) + '</b> <span class="sci">' + esc(c.scientific_name) + '</span> — ' + Math.round(c.confidence * 100) + '%' + (c.plantnet_agree ? ' 🟢' : '') + '</div>';
        }).join('') + (r.ai.has_human_face ? '<div class="alert error small" style="margin-top:8px">🙈 AI พบใบหน้าคนในรูป</div>' : '') +
          (r.ai.photo_issues && r.ai.photo_issues.length ? '<div class="small muted" style="margin-top:6px">📷 ' + r.ai.photo_issues.map(esc).join(' · ') + '</div>' : '') + '</div>';
      }

      var spRows = '';
      if (s) {
        spRows += row('thai_name', 'ชื่อ', s.thai_name) + row('scientific_name', 'ชื่อวิทยาศาสตร์', s.scientific_name, '<span class="sci">' + esc(s.scientific_name) + '</span>') +
          row('local_name', 'ชื่อพื้นเมือง', s.local_name) + row('family', 'วงศ์', s.family);
        if (s.status !== 'verified') {
          Forms.QUESTIONS.forEach(function (qq) {
            if (qq.key && qq.key !== 'description') spRows += row(qq.key, Forms.label(qq.key), s[qq.key]);
            (qq.fields || []).forEach(function (f) { if (['thai_name', 'scientific_name', 'local_name', 'family'].indexOf(f.key) < 0) spRows += row(f.key, Forms.label(f.key), s[f.key]); });
          });
          spRows += row('description', 'คำบรรยาย', s.description);
        }
      }

      el.innerHTML = '<div id="rvRoot"><div class="btn-row" style="margin-bottom:10px"><a class="btn sm" href="#/review">‹ คิวตรวจงาน</a><a class="btn sm" href="#/tree/' + esc(t.tree_id) + '">ดูหน้าต้นไม้</a>' +
        (lv >= 3 ? '<a class="btn sm" href="#/edit/' + esc(t.tree_id) + '">✏️ แก้เอง</a>' : '') + '</div>' +
        '<div class="card"><div class="card-title"><h2>' + esc(s ? s.thai_name : 'ยังไม่ทราบชนิด') + '</h2>' + UI.statusPill(t.status) + '</div>' +
        '<div class="small muted">' + esc(t.tree_code) + ' · บันทึกโดย ' + esc(t.created_by_name) + ' · ส่งเมื่อ ' + UI.thDate(t.submitted_at, true) + '</div>' +
        (s && s.status !== 'verified' ? '<div class="alert info" style="margin-top:10px"><span class="ic">🆕</span><div><b>ชนิดใหม่ของโรงเรียน</b> — เมื่ออนุมัติ ระบบจะออกรหัสชนิดใหม่ ตรวจชื่อวิทยาศาสตร์และแหล่งอ้างอิงให้ถูกต้อง' +
          (s.ai_suggested ? '<br>🤖 มีข้อมูลที่ AI เติมให้ — ตรวจทุกช่อง' : '') + '</div></div>' : '') +
        (!s ? '<div class="alert warn" style="margin-top:10px"><span class="ic">❓</span><div>นักเรียนยังไม่ทราบชนิด — ' + (lv >= 3 ? 'ครูระบุชนิดได้ด้านล่างก่อนอนุมัติ' : 'ช่วยแนะนำชนิดในความเห็นได้') + '</div></div>' : '') +
        '</div>' +
        '<div class="split"><div>' +
        '<div class="card"><h3>📷 รูปถ่าย (' + r.photos.length + ')</h3>' + (missing.length ? '<div class="alert warn small"><span class="ic">⚠️</span><div>ขาดรูป: ' + missing.map(Forms.partLabel).join(', ') + '</div></div>' : '') + photoHtml + '<div data-cbox="photos"></div>' +
        (canAct || lv >= 3 ? '<button class="btn sm ghost" data-c="photos">💬 ความเห็นเรื่องรูป</button>' : '') + '</div>' +
        aiHtml +
        '<div class="card"><h3>📍 ตำแหน่ง</h3><div class="map" id="rvMap" style="height:260px"></div>' +
        '<div class="small" style="margin-top:6px">' + (t.gps_accuracy_m ? '±' + UI.fmtNum(t.gps_accuracy_m) + ' ม. ' : '') + esc({ gps: 'GPS', 'gps+adjusted': 'GPS + ปรับหมุด', manual: 'ปักหมุดเอง' }[t.gps_method] || '') + ' · ' + esc(App.zoneName(t.zone_id) || 'ไม่อยู่ในโซน') + '</div>' +
        '<div data-cbox="gps"></div>' + (canAct || lv >= 3 ? '<button class="btn sm ghost" data-c="gps">💬 ความเห็นเรื่องตำแหน่ง</button>' : '') + '</div>' +
        '</div><div>' +
        (lv >= 3 && (!s || s.status === 'verified') ? '<div class="card"><h3>🌿 ระบุ/เปลี่ยนชนิด (ครู)</h3><select id="setSp"><option value="">— เลือกชนิด —</option>' +
          App.boot.species.filter(function (x) { return x.status !== 'archived'; }).map(function (x) {
            return '<option value="' + esc(x.species_id) + '" ' + (s && s.species_id === x.species_id ? 'selected' : '') + '>' + esc(x.thai_name) + ' — ' + esc(x.scientific_name) + '</option>';
          }).join('') + '</select><button class="btn sm" id="setSpBtn" style="margin-top:8px">บันทึกชนิด</button></div>' : '') +
        '<div class="card"><h3>📋 ข้อมูล</h3>' + (spRows || '<div class="muted">ยังไม่ได้ระบุชนิด</div>') +
        row('height_m', 'ความสูง (ม.)', t.height_m) + row('gbh_cm', 'เส้นรอบวงที่ระดับอก (ซม.)', t.gbh_cm, esc(t.gbh_cm) + (t.dbh_cm ? ' <span class="muted small">(DBH ' + t.dbh_cm + ' ซม.)</span>' : '')) +
        row('canopy_m', 'ทรงพุ่ม (ม.)', t.canopy_m) + row('health', 'สุขภาพ', t.health) + row('planting_source', 'ที่มา', t.planting_source) + row('notes', 'หมายเหตุ', t.notes) + '</div>' +
        ((r.reviews || []).length ? '<div class="card"><h3>ประวัติความเห็น</h3>' + r.reviews.slice().reverse().map(function (x) {
          return '<div class="comment"><b>' + esc(x.decision) + '</b>' + (x.field ? ' · ' + esc(Forms.label(x.field)) : '') + (x.comment ? ': ' + esc(x.comment) : '') + '<div class="who">' + esc(x.reviewer_name) + ' · ' + UI.thDate(x.created_at, true) + '</div></div>';
        }).join('') + '</div>' : '') +
        (canAct || lv >= 3 ? '<div class="card"><h3>📝 ผลการตรวจ</h3><label class="field"><span>ความเห็นทั่วไป</span><textarea id="general" placeholder="เช่น ทำได้ดีมาก รูปชัด / ถ่ายรูปดอกเพิ่มเมื่อออกดอก"></textarea></label>' +
          (lv >= 3 ? '<div class="field"><span class="field-label">⭐ คะแนนคุณภาพงาน (ไม่บังคับ)</span><div class="chips" id="score">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" class="chip" data-v="' + n + '">' + n + '</button>'; }).join('') + '</div></div>' : '') +
          '<div class="btn-row">' +
          (canAct && lv >= 3 ? '<button class="btn primary big grow" data-d="approve">✅ อนุมัติ</button>' : '') +
          (canAct && lv < 3 ? '<button class="btn primary big grow" data-d="pass">👍 ผ่าน ส่งต่อให้ครู</button>' : '') +
          (canAct ? '<button class="btn warn big grow" data-d="return">↩️ ส่งกลับแก้ไข</button>' : '') +
          '<button class="btn grow" data-d="comment">💬 บันทึกความเห็นอย่างเดียว</button></div></div>' : '') +
        '</div></div></div>';
      UI.hydratePhotos(el);
      var root = UI.$('#rvRoot', el);

      var map = Maps.create(UI.$('#rvMap', el), t.lat ? { center: [t.lat, t.lng], zoom: 20 } : {});
      Maps.addZones(map, { fill: false });
      App.boot.trees.forEach(function (o) {
        if (o.lat && o.tree_id !== t.tree_id && o.status !== 'archived') L.marker([o.lat, o.lng], { icon: Maps.pinIcon('rgba(255,255,255,.8)', 10), interactive: false }).addTo(map);
      });
      if (t.lat) {
        L.marker([t.lat, t.lng], { icon: Maps.pinIcon('#e53e3e', 24, '🌳') }).addTo(map);
        if (t.gps_accuracy_m) L.circle([t.lat, t.lng], { radius: t.gps_accuracy_m, color: '#fff', weight: 1, fillOpacity: .15 }).addTo(map);
      }

      var score = null;
      root.addEventListener('click', function (e) {
        var c = e.target.closest('[data-c]');
        if (c) {
          var key = c.dataset.c, box = UI.$('[data-cbox="' + key + '"]', el);
          if (!box.firstChild) {
            box.innerHTML = '<textarea data-key="' + key + '" style="min-height:60px;margin-top:6px" placeholder="ความเห็นเรื่อง ' + esc(Forms.label(key)) + '"></textarea>';
            box.firstChild.oninput = function () { comments[key] = this.value; };
          }
          box.firstChild.focus();
        }
        var sc = e.target.closest('#score .chip');
        if (sc) {
          score = score === +sc.dataset.v ? null : +sc.dataset.v;
          UI.$$('#score .chip', el).forEach(function (x) { x.classList.toggle('on', +x.dataset.v === score); });
        }
        var d = e.target.closest('[data-d]');
        if (d) decide(d.dataset.d);
      });

      var setSpBtn = UI.$('#setSpBtn', el);
      if (setSpBtn) setSpBtn.onclick = function () {
        var v = UI.$('#setSp', el).value;
        UI.busy(api('saveDraft', { tree: { tree_id: t.tree_id }, species_mode: v ? 'existing' : 'unknown', species_id: v })).then(function () {
          UI.toast('บันทึกชนิดแล้ว', 'ok');
          return App.refresh();
        }).then(function () { App.pages.reviewTree(p, q, el); }).catch(UI.error);
      };

      function decide(decision) {
        var list = Object.keys(comments).filter(function (k) { return comments[k].trim(); }).map(function (k) { return { field: k, comment: comments[k].trim() }; });
        var general = (UI.$('#general', el) || {}).value || '';
        if (decision === 'return' && !list.length && !general.trim()) return UI.toast('เขียนความเห็นอย่างน้อย 1 ข้อ ให้นักเรียนรู้ว่าต้องแก้อะไร', 'error');
        if (decision === 'comment' && !list.length && !general.trim()) return UI.toast('ยังไม่ได้เขียนความเห็น', 'error');
        var go = decision === 'approve' && !s ? UI.confirm('อนุมัติโดยยังไม่ทราบชนิด?', 'ต้นนี้จะใช้รหัสชั่วคราว (TMP) จนกว่าจะระบุชนิด', 'อนุมัติต่อ') : Promise.resolve(true);
        go.then(function (ok) {
          if (!ok) return;
          return UI.busy(api('review', { tree_id: t.tree_id, decision: decision, comments: list, general: general, score: score }), 'กำลังบันทึก').then(function (res) {
            var msg = { approve: '✅ อนุมัติแล้ว' + (res.tree_code ? ' รหัส ' + res.tree_code : ''), return: '↩️ ส่งกลับให้นักเรียนแก้ไขแล้ว', pass: '👍 ส่งต่อให้ครูแล้ว', comment: '💬 บันทึกความเห็นแล้ว' }[decision];
            UI.toast(msg, 'ok', 5000);
            return App.refresh().then(function () {
              if (decision === 'comment') return App.pages.reviewTree(p, q, el);
              var idx = lastQueue.indexOf(t.tree_id);
              var next = lastQueue.slice(idx + 1).filter(function (id) {
                var x = App.treeById[id];
                return x && (x.status === 'submitted' || (lv >= 3 && x.status === 'pending_teacher'));
              })[0];
              location.hash = next ? '#/review/' + next : '#/review';
            });
          });
        }).catch(UI.error);
      }
      return function () { map.remove(); };
    });
  };
})();
