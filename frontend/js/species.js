/**
 * species.js — ค้นหา (Smart Search), หน้าข้อมูลชนิด, หน้าข้อมูลต้น (ปลายทาง QR), แผนที่ภาคสนาม
 */
(function () {
  var USE_LABEL = { food: 'อาหาร', medicine: 'ยารักษาโรค', construction: 'ก่อสร้าง/เครื่องใช้', pesticide: 'ยาฆ่าแมลง', culture: 'ประเพณี/วัฒนธรรม' };

  function verifiedTreeCount(spId) {
    return App.boot.trees.filter(function (t) { return t.species_id === spId && t.status === 'verified'; }).length;
  }
  function splitVals(v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(String); }

  // ================= ค้นหา =================
  var F = null; // ตัวกรองปัจจุบัน (คงไว้ระหว่างเปลี่ยนหน้า)
  function emptyFilters() { return { text: '', habit: [], flower_color: [], flowering_month: [], fruiting_month: [], zone_id: [], use: [], family: '', status: 'verified' }; }

  App.pages.search = function (p, q, el) {
    if (!F) F = emptyFilters();
    if (q.q !== undefined) { F = emptyFilters(); F.text = q.q; }
    var lv = App.level();
    var aiOn = String(App.boot.settings.ai_enabled).toUpperCase() === 'TRUE';
    var families = {};
    App.boot.species.forEach(function (s) { if (s.family) families[s.family] = 1; });
    var view = q.view === 'trees' ? 'trees' : 'species';

    el.innerHTML = '<h1>🔍 ค้นหาพรรณไม้</h1>' +
      '<div class="search-box"><span class="ic">🔍</span><input type="search" id="sq" placeholder="ชื่อไทย ชื่อพื้นเมือง ชื่อวิทยาศาสตร์ วงศ์ หรือรหัสต้น (พิมพ์ผิดก็หาเจอ)" value="' + esc(F.text) + '" autocomplete="off"></div>' +
      (aiOn ? '<form id="aiForm" class="btn-row" style="margin-top:10px"><input type="text" id="aiq" class="grow" style="flex:1;min-width:200px" placeholder="🤖 ค้นด้วยประโยค เช่น ต้นไม้ดอกสีเหลืองที่ออกดอกเดือนเมษายน"><button class="btn">ให้ AI ค้น</button></form><div id="aiExplain"></div>' : '') +
      '<details class="card flat" style="margin-top:12px" ' + (hasFilters() ? 'open' : '') + '><summary style="cursor:pointer;font-weight:700">⚙️ ตัวกรอง <span id="fCount" class="pill"></span></summary><div style="margin-top:12px" id="filters"></div></details>' +
      '<div class="chips" style="margin:10px 0"><a class="chip ' + (view === 'species' ? 'on' : '') + '" href="#/search?view=species">🌿 รายชนิด</a><a class="chip ' + (view === 'trees' ? 'on' : '') + '" href="#/search?view=trees">🌳 รายต้น</a></div>' +
      '<div id="results"></div>';

    var filtersEl = UI.$('#filters', el);
    function chipGroup(key, list, title, valueFn) {
      return '<div class="field"><span class="field-label">' + title + '</span><div class="chips" data-f="' + key + '">' + list.map(function (o, i) {
        var v = valueFn ? valueFn(o, i) : o.value;
        var on = F[key].indexOf(v) >= 0 || F[key].indexOf(String(v)) >= 0;
        return '<button type="button" class="chip ' + (on ? 'on' : '') + '" data-v="' + esc(v) + '">' + (o.icon && o.icon.charAt(0) === '#' ? '<span class="sw" style="background:' + o.icon + '"></span>' : '') + esc(o.value) + '</button>';
      }).join('') + '</div></div>';
    }
    function renderFilters() {
      filtersEl.innerHTML = chipGroup('habit', App.listOpts('habit'), 'ลักษณะวิสัย') +
        chipGroup('flower_color', App.listOpts('color'), 'สีดอก') +
        chipGroup('flowering_month', App.listOpts('month'), 'ออกดอกเดือน', function (o, i) { return i + 1; }) +
        chipGroup('use', Object.keys(USE_LABEL).map(function (k) { return { value: USE_LABEL[k], key: k }; }), 'การใช้ประโยชน์', function (o) { return o.key; }) +
        (App.boot.zones.length ? chipGroup('zone_id', App.boot.zones.map(function (z) { return { value: z.name, key: z.zone_id }; }), 'โซน', function (o) { return o.key; }) : '') +
        '<div class="row2"><label class="field"><span>วงศ์</span><select data-sel="family"><option value="">ทุกวงศ์</option>' +
        Object.keys(families).sort().map(function (f) { return '<option ' + (F.family === f ? 'selected' : '') + '>' + esc(f) + '</option>'; }).join('') + '</select></label>' +
        (lv >= 2 ? '<label class="field"><span>สถานะการตรวจ</span><select data-sel="status"><option value="verified">ครูตรวจแล้ว</option><option value="all" ' + (F.status === 'all' ? 'selected' : '') + '>ทั้งหมด</option>' +
          '<option value="pending" ' + (F.status === 'pending' ? 'selected' : '') + '>ยังไม่ผ่านการตรวจ</option></select></label>' : '') + '</div>' +
        '<button class="btn sm" id="clearF">ล้างตัวกรอง</button>';
      var n = ['habit', 'flower_color', 'flowering_month', 'zone_id', 'use'].reduce(function (a, k) { return a + F[k].length; }, 0) + (F.family ? 1 : 0);
      UI.$('#fCount', el).textContent = n ? n + ' รายการ' : '';
    }
    filtersEl.onclick = function (e) {
      var c = e.target.closest('.chip[data-v]');
      if (c) {
        var key = c.parentNode.dataset.f, v = c.dataset.v;
        if (key === 'flowering_month') v = Number(v);
        var i = F[key].map(String).indexOf(String(v));
        if (i >= 0) F[key].splice(i, 1); else F[key].push(v);
        renderFilters(); renderResults();
      }
      if (e.target.id === 'clearF') { var t = F.text; F = emptyFilters(); F.text = t; renderFilters(); renderResults(); }
    };
    filtersEl.onchange = function (e) { var s = e.target.dataset.sel; if (s) { F[s] = e.target.value; renderFilters(); renderResults(); } };

    var sq = UI.$('#sq', el);
    sq.oninput = function () { F.text = sq.value; renderResults(); };

    var aiForm = UI.$('#aiForm', el);
    if (aiForm) aiForm.onsubmit = function (e) {
      e.preventDefault();
      var text = UI.$('#aiq', el).value.trim();
      if (!text) return;
      UI.busy(api('aiSearch', { q: text }), 'AI กำลังตีความคำค้น').then(function (r) {
        F = emptyFilters();
        ['habit', 'flower_color', 'flowering_month', 'fruiting_month', 'zone_id', 'use'].forEach(function (k) { if (Array.isArray(r[k])) F[k] = r[k].map(function (x) { return k.indexOf('month') > 0 ? Number(x) : x; }); });
        if (r.family) F.family = r.family;
        F.text = r.text || '';
        sq.value = F.text;
        UI.$('#aiExplain', el).innerHTML = '<div class="alert info" style="margin-top:8px"><span class="ic">🤖</span><div>AI ตีความว่า: ' + esc(r.explain || '') +
          '<br><span class="small">ปรับตัวกรองด้านล่างได้ถ้าตีความไม่ตรง</span></div></div>';
        UI.$('details', el).open = true;
        renderFilters(); renderResults();
      }).catch(UI.error);
    };

    function hasFilters() { return F && (F.habit.length || F.flower_color.length || F.flowering_month.length || F.zone_id.length || F.use.length || F.family); }

    function speciesMatch(s) {
      if (F.status === 'verified' && s.status !== 'verified') return false;
      if (F.status === 'pending' && s.status === 'verified') return false;
      if (s.status === 'archived') return false;
      if (F.habit.length && F.habit.indexOf(s.habit) < 0) return false;
      if (F.flower_color.length && !splitVals(s.flower_color).some(function (c) { return F.flower_color.indexOf(c) >= 0; })) return false;
      if (F.flowering_month.length && !F.flowering_month.some(function (m) { return App.hasMonth(s.flowering_season, UI.TH_MONTHS[m - 1]); })) return false;
      if (F.fruiting_month.length && !F.fruiting_month.some(function (m) { return App.hasMonth(s.fruiting_season, UI.TH_MONTHS[m - 1]); })) return false;
      if (F.family && s.family !== F.family) return false;
      if (F.use.length && !F.use.some(function (u) { return String(s['use_' + u] || '').trim(); })) return false;
      if (F.zone_id.length && !App.boot.trees.some(function (t) { return t.species_id === s.species_id && F.zone_id.indexOf(t.zone_id) >= 0; })) return false;
      return true;
    }

    var fuse = window.Fuse ? new Fuse(App.boot.species, { keys: [{ name: 'thai_name', weight: 3 }, { name: 'local_name', weight: 2 }, 'common_name', { name: 'scientific_name', weight: 2 }, 'family'], threshold: .38, ignoreLocation: true }) : null;

    function renderResults() {
      var out = UI.$('#results', el);
      var text = (F.text || '').trim();
      var list;
      if (text) {
        list = fuse ? fuse.search(text).map(function (r) { return r.item; }) : App.boot.species.filter(function (s) { return JSON.stringify(s).indexOf(text) >= 0; });
      } else {
        list = App.boot.species.slice().sort(function (a, b) { return String(a.thai_name).localeCompare(String(b.thai_name), 'th'); });
      }
      list = list.filter(speciesMatch);
      if (view === 'trees') {
        var spIds = {};
        list.forEach(function (s) { spIds[s.species_id] = 1; });
        var codeHits = text ? App.boot.trees.filter(function (t) { return String(t.tree_code).toLowerCase().indexOf(text.toLowerCase()) >= 0 || t.tree_id === text.toUpperCase(); }) : [];
        var trees = App.boot.trees.filter(function (t) {
          if (codeHits.indexOf(t) >= 0) return true;
          if (F.status === 'verified' && t.status !== 'verified') return false;
          if (F.zone_id.length && F.zone_id.indexOf(t.zone_id) < 0) return false;
          if (t.species_id === 'UNKNOWN') return !text && !hasFilters() && F.status !== 'verified';
          return spIds[t.species_id];
        });
        out.innerHTML = '<div class="muted small" style="margin-bottom:6px">พบ ' + trees.length + ' ต้น</div><div class="card">' +
          (trees.map(function (t) { return App.treeItem(t); }).join('') || '<div class="empty">ไม่พบ</div>') + '</div>';
      } else {
        var codeTree = text ? App.boot.trees.filter(function (t) { return String(t.tree_code).toLowerCase() === text.toLowerCase(); })[0] : null;
        out.innerHTML = (codeTree ? '<div class="card">' + App.treeItem(codeTree) + '</div>' : '') +
          '<div class="muted small" style="margin-bottom:6px">พบ ' + list.length + ' ชนิด</div>' +
          (list.length ? '<div class="grid-cards">' + list.map(App.speciesCard).join('') + '</div>' : '<div class="empty"><span class="ic">🍃</span>ไม่พบพรรณไม้ที่ตรงกับเงื่อนไข</div>');
      }
      UI.hydratePhotos(out);
    }
    renderFilters();
    renderResults();
  };

  // ================= หน้าข้อมูลชนิด =================
  App.pages.species = function (p, q, el) {
    return api('getSpecies', { species_id: p.id }).then(function (r) {
      var s = r.species;
      var photos = r.photos;
      var html = gallery(photos, s.habit) +
        '<div class="card"><h1 style="margin-bottom:2px">' + esc(s.thai_name || s.local_name) + (s.local_name && s.thai_name ? ' <span class="muted" style="font-size:1rem">(' + esc(s.local_name) + ')</span>' : '') + '</h1>' +
        '<div class="sci" style="font-size:1.1rem">' + esc(s.scientific_name) + '</div><div class="muted">วงศ์ ' + esc(s.family) + (s.common_name ? ' · ' + esc(s.common_name) : '') + '</div>' +
        '<div class="chips" style="margin-top:8px">' + (s.status === 'verified' ? '<span class="pill verified">✅ ครูตรวจแล้ว</span>' : '<span class="pill pending_teacher">⏳ รอตรวจ</span>') +
        (s.species_code ? '<span class="pill">รหัสชนิด ' + esc(s.species_code) + '</span>' : '') + (s.ai_suggested && s.status !== 'verified' ? '<span class="pill ai">🤖 มีข้อมูลจาก AI</span>' : '') +
        '<span class="pill">🌳 ' + r.trees.length + ' ต้นในโรงเรียน</span></div>' +
        (r.can_edit ? '<div class="btn-row" style="margin-top:10px"><button class="btn sm" id="editSp">✏️ แก้ไขข้อมูลชนิด</button>' +
          (App.level() >= 3 ? '<button class="btn sm" id="mergeSp">🔀 รวมกับชนิดอื่น</button>' : '') + '</div>' : '') + '</div>' +
        speciesInfoCards(s) +
        '<div class="card"><h3>🌳 ต้นในโรงเรียน (' + r.trees.length + ')</h3><div class="map-wrap"><div class="map" id="spMap" style="height:240px"></div></div>' +
        r.trees.map(function (t) { return App.treeItem(t); }).join('') + '</div>';
      el.innerHTML = html;
      UI.hydratePhotos(el);
      bindGallery(el);
      var map = Maps.create(UI.$('#spMap', el));
      Maps.addZones(map, { fill: false });
      r.trees.forEach(function (t) {
        if (t.lat) L.marker([t.lat, t.lng], { icon: Maps.pinIcon(UI.STATUS_COLOR[t.status] || '#2f855a', 20) })
          .bindPopup('<b>' + esc(t.tree_code) + '</b><br><a href="#/tree/' + esc(t.tree_id) + '">ดูรายละเอียด ›</a>').addTo(map);
      });
      Maps.fitTo(map, r.trees.map(function (t) { return [t.lat, t.lng]; }));
      var ed = UI.$('#editSp', el);
      if (ed) ed.onclick = function () { editSpeciesModal(s); };
      var mg = UI.$('#mergeSp', el);
      if (mg) mg.onclick = function () { mergeModal(s); };
      return function () { map.remove(); };
    });
  };

  function speciesInfoCards(s, comments) { return morphCard(s, comments) + usesCard(s, comments); }

  function morphCard(s, comments) {
    var html = '<div class="card"><h3>🔬 ลักษณะทางพฤกษศาสตร์</h3>';
    var any = false;
    Forms.DISPLAY_SECTIONS.forEach(function (sec) {
      var kv = Forms.speciesKv(s, sec.keys.filter(function (k) { return sec.title !== 'ชื่อและอนุกรมวิธาน' || ['thai_name', 'scientific_name', 'family'].indexOf(k) < 0; }), comments);
      if (kv) { any = true; html += '<div class="kv-section">' + sec.title + '</div>' + kv; }
    });
    if (s.description) { any = true; html += '<div class="kv-section">คำบรรยาย</div><p>' + esc(s.description).replace(/\n/g, '<br>') + Forms.fieldComments(comments, 'description') + '</p>'; }
    if (!any) html += '<div class="muted">ยังไม่มีข้อมูลลักษณะ</div>';
    return html + '</div>';
  }

  function usesCard(s, comments) {
    var uses = Forms.speciesKv(s, Forms.USE_KEYS, comments);
    return '<div class="card"><h3>🧺 การใช้ประโยชน์ / ข้อมูลพื้นบ้าน</h3>' + (uses || '<div class="muted">ยังไม่มีข้อมูล</div>') +
      (s.ai_suggested && s.status !== 'verified' ? '<p class="small muted" style="margin-top:8px">🤖 ข้อมูลบางส่วนมาจาก AI — รอครูตรวจสอบกับแหล่งอ้างอิง</p>' : '') + '</div>';
  }

  function gallery(photos, habit) {
    photos = photos.filter(function (ph) { return Forms.PLANT_PARTS.indexOf(ph.part) >= 0; });
    if (!photos.length) return '<div class="gallery"><div class="g" style="flex-basis:100%;aspect-ratio:3/1">' + Icons.habitEmoji(habit) + '</div></div>';
    var order = Forms.PHOTO_PARTS.map(function (x) { return x.key; });
    photos = photos.slice().sort(function (a, b) { return order.indexOf(a.part) - order.indexOf(b.part); });
    return '<div class="gallery">' + photos.map(function (ph) {
      return '<div class="g" data-full="' + esc(ph.full || '') + '" data-id="' + esc(ph.photo_id) + '">' + UI.photoImg(ph, 'full') +
        '<span class="cap">' + esc(Forms.partLabel(ph.part)) + (ph.approved ? '' : ' · รอตรวจ') + '</span></div>';
    }).join('') + '</div>';
  }
  function bindGallery(el) {
    UI.$$('.gallery .g img', el).forEach(function (img) {
      img.onclick = function () { UI.lightbox(img.currentSrc || img.src); };
    });
  }

  function speciesFormHtml(s) {
    var choiceByKey = {};
    Forms.QUESTIONS.forEach(function (q) { if (q.key && q.list) choiceByKey[q.key] = q; (q.fields || []).forEach(function (f) { if (f.list) choiceByKey[f.key] = { list: f.list }; }); });
    var keys = [].concat.apply([], Forms.DISPLAY_SECTIONS.map(function (x) { return x.keys; })).concat(['description'], Forms.USE_KEYS);
    if (App.level() >= 3) keys.unshift('species_code');
    return '<div style="max-height:60vh;overflow:auto">' + keys.map(function (k) {
      var v = s[k] === null || s[k] === undefined ? '' : s[k];
      var q = choiceByKey[k];
      var input;
      if (q && q.type !== 'multi') {
        input = '<select name="' + k + '"><option value=""></option>' + App.listOpts(q.list).map(function (o) { return '<option ' + (o.value === v ? 'selected' : '') + '>' + esc(o.value) + '</option>'; }).join('') +
          (v && !App.listOpts(q.list).some(function (o) { return o.value === v; }) ? '<option selected>' + esc(v) + '</option>' : '') + '</select>';
      } else if (k === 'description' || k.indexOf('use_') === 0 || k === 'references' || k === 'distribution') {
        input = '<textarea name="' + k + '">' + esc(v) + '</textarea>';
      } else {
        input = '<input type="text" name="' + k + '" value="' + esc(v) + '"' + (q && q.type === 'multi' ? ' placeholder="คั่นด้วย , เช่น ' + esc(App.listOpts(q.list).slice(0, 2).map(function (o) { return o.value; }).join(', ')) + '"' : '') + '>';
      }
      return '<label class="field"><span>' + esc(Forms.label(k)) + '</span>' + input + '</label>';
    }).join('') + '</div>';
  }

  function editSpeciesModal(s) {
    UI.modal({
      title: '✏️ แก้ไขข้อมูล ' + esc(s.thai_name), wide: true, body: speciesFormHtml(s),
      buttons: [{ label: 'ยกเลิก', value: null }, {
        label: 'บันทึก', cls: 'primary', onClick: function (m) {
          var v = UI.formValues(m);
          v.species_id = s.species_id;
          return api('saveSpecies', { species: v }).then(function () { UI.toast('บันทึกแล้ว', 'ok'); return App.refresh(); }).then(function () { App.pages.species({ id: s.species_id }, {}, document.getElementById('view')); });
        }
      }]
    });
  }

  function mergeModal(s) {
    var others = App.boot.species.filter(function (x) { return x.species_id !== s.species_id && x.status !== 'archived'; });
    UI.modal({
      title: '🔀 รวมชนิดซ้ำ',
      body: '<p>ย้ายต้นไม้ทั้งหมดของ <b>' + esc(s.thai_name) + '</b> ไปเป็นชนิดที่เลือก แล้วเก็บถาวรชนิดนี้ (ใช้เมื่อบันทึกชนิดเดียวกันซ้ำ 2 ระเบียน)</p>' +
        '<select name="into">' + others.map(function (x) { return '<option value="' + esc(x.species_id) + '">' + esc(x.thai_name) + ' — ' + esc(x.scientific_name) + '</option>'; }).join('') + '</select>',
      buttons: [{ label: 'ยกเลิก', value: null }, {
        label: 'รวมชนิด', cls: 'danger solid', onClick: function (m) {
          var into = UI.formValues(m).into;
          return api('mergeSpecies', { from: s.species_id, into: into }).then(function (r) {
            UI.toast('ย้าย ' + r.moved + ' ต้นแล้ว', 'ok');
            return App.refresh().then(function () { location.hash = '#/sp/' + into; });
          });
        }
      }]
    });
  }

  // ================= หน้าข้อมูลต้น =================
  App.pages.tree = function (p, q, el) {
    return api('getTree', { tree_id: p.id }).then(function (r) {
      var t = r.tree, s = r.species || {};
      var lv = App.level();
      var isOwner = App.me && t.created_by === App.me.user_id;
      var comments = (r.reviews || []).filter(function (x) { return x.decision === 'comment'; });
      var html = gallery(r.photos, s.habit) +
        '<div class="card"><div class="card-title"><span class="code-tag">' + esc(t.tree_code) + '</span>' + UI.statusPill(t.status) + '</div>' +
        '<h1 style="margin-bottom:2px">' + esc(s.thai_name || 'ยังไม่ทราบชนิด') + (s.local_name ? ' <span class="muted" style="font-size:1rem">(' + esc(s.local_name) + ')</span>' : '') + '</h1>' +
        (s.scientific_name ? '<div class="sci" style="font-size:1.1rem">' + esc(s.scientific_name) + '</div>' : '') +
        (s.family ? '<div class="muted">วงศ์ ' + esc(s.family) + (s.common_name ? ' · ' + esc(s.common_name) : '') + '</div>' : '') +
        (s.species_id && r.same_species_count ? '<a class="small" href="#/sp/' + esc(s.species_id) + '">ดูชนิดนี้ทั้งหมด (+' + r.same_species_count + ' ต้น) ›</a>' : (s.species_id ? '<a class="small" href="#/sp/' + esc(s.species_id) + '">ข้อมูลชนิด ›</a>' : '')) +
        '<div class="btn-row" style="margin-top:12px">' +
        (t.can_edit ? '<a class="btn primary" href="#/edit/' + esc(t.tree_id) + '">✏️ ' + (t.status === 'draft' || t.status === 'returned' ? 'แก้ไข/ส่งตรวจ' : 'แก้ไข') + '</a>' : '') +
        (App.me && t.status !== 'archived' ? '<button class="btn" id="addPhoto">📷 เพิ่มรูป</button>' : '') +
        (lv >= 2 && (t.status === 'submitted' || t.status === 'pending_teacher') ? '<a class="btn" href="#/review/' + esc(t.tree_id) + '">✅ ตรวจงานนี้</a>' : '') +
        (lv >= 3 && t.status === 'verified' ? '<a class="btn" href="#/labels?tree=' + esc(t.tree_id) + '">🏷️ ป้ายชื่อ</a>' : '') +
        (lv >= 3 ? '<button class="btn ' + (t.status === 'archived' ? '' : 'danger') + '" id="archive">' + (t.status === 'archived' ? '♻️ กู้คืน' : '📦 เก็บถาวร') + '</button>' : '') +
        '</div></div>';

      html += '<div class="tabs" id="tabs"><button data-t="info" class="on">ลักษณะ</button><button data-t="use">ประโยชน์</button><button data-t="loc">ตำแหน่ง</button>' +
        Object.keys(App.treeTabs || {}).map(function (k) { return '<button data-t="' + k + '">' + esc(App.treeTabs[k].label) + '</button>'; }).join('') +
        '<button data-t="hist">ประวัติ</button></div><div id="tabBody"></div>';
      el.innerHTML = html;
      UI.hydratePhotos(el);
      bindGallery(el);

      var map = null;
      function tab(name) {
        if (map) { map.remove(); map = null; }
        UI.$$('#tabs button', el).forEach(function (b) { b.classList.toggle('on', b.dataset.t === name); });
        var tb = UI.$('#tabBody', el);
        if (name === 'info') {
          tb.innerHTML = '<div class="card"><h3>📏 ข้อมูลต้นนี้</h3><dl class="kv">' +
            [['ความสูง', t.height_m, 'ม.'], ['เส้นรอบวงที่ระดับอก', t.gbh_cm, 'ซม.'], ['เส้นผ่านศูนย์กลาง', t.dbh_cm, 'ซม.'], ['ทรงพุ่มกว้าง', t.canopy_m, 'ม.']]
              .filter(function (x) { return x[1]; }).map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + UI.fmtNum(x[1]) + ' ' + x[2] + '</dd>'; }).join('') +
            [['age_est', 'อายุโดยประมาณ'], ['health', 'สุขภาพ'], ['planting_source', 'ที่มาของต้น'], ['label_status', 'ป้ายชื่อ'], ['notes', 'หมายเหตุ']]
              .filter(function (x) { return t[x[0]]; }).map(function (x) { return '<dt>' + x[1] + '</dt><dd>' + esc(t[x[0]]).replace(/\n/g, '<br>') + '</dd>'; }).join('') +
            '</dl></div>' + (r.species ? morphCard(s, comments) : '<div class="card muted">ยังไม่ได้ระบุชนิด</div>');
        } else if (name === 'use') {
          tb.innerHTML = r.species ? usesCard(s, comments) : '<div class="card muted">ยังไม่ได้ระบุชนิด</div>';
        } else if (name === 'loc') {
          tb.innerHTML = '<div class="card"><div class="map-wrap"><div class="map" id="treeMap"></div></div><dl class="kv" style="margin-top:10px">' +
            '<dt>พิกัด</dt><dd>' + (t.lat ? t.lat + ', ' + t.lng : '-') + '</dd><dt>ความคลาดเคลื่อน</dt><dd>' + (t.gps_accuracy_m ? '±' + UI.fmtNum(t.gps_accuracy_m) + ' ม.' : '-') +
            (t.gps_method ? ' (' + esc({ gps: 'GPS', 'gps+adjusted': 'GPS + ปรับหมุด', manual: 'ปักหมุดเอง' }[t.gps_method] || t.gps_method) + ')' : '') + '</dd>' +
            '<dt>โซน</dt><dd>' + esc(App.zoneName(t.zone_id) || '-') + '</dd></dl>' +
            (t.lat ? '<a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + t.lat + ',' + t.lng + '">🧭 นำทางด้วย Google Maps</a>' : '') + '</div>';
          if (t.lat) {
            map = Maps.create(UI.$('#treeMap', tb), { center: [t.lat, t.lng], zoom: 20 });
            Maps.addZones(map, { fill: false });
            L.marker([t.lat, t.lng], { icon: Maps.pinIcon('#e53e3e', 26, '🌳') }).addTo(map);
            if (t.gps_accuracy_m) L.circle([t.lat, t.lng], { radius: t.gps_accuracy_m, color: '#fff', weight: 1, fillOpacity: .15 }).addTo(map);
          }
        } else if (App.treeTabs && App.treeTabs[name]) {
          tb.onclick = null;
          App.treeTabs[name].render(tb, {
            r: r, t: t, s: s, autoAdd: !!q.add && q.tab === name,
            reload: function (tabName) { return App.refresh().then(function () { return App.pages.tree(p, { tab: tabName }, el); }); }
          });
        } else {
          var revs = (r.reviews || []).slice().reverse();
          var DEC = { approve: '✅ อนุมัติ', return: '↩️ ส่งกลับแก้ไข', pass: '👍 หัวหน้ากลุ่มตรวจผ่าน', comment: '💬 ความเห็น' };
          tb.innerHTML = '<div class="card"><h3>👥 ผู้ร่วมบันทึก</h3><p>' + (r.contributors.map(esc).join(', ') || '-') + '</p>' +
            '<dl class="kv"><dt>บันทึกเมื่อ</dt><dd>' + UI.thDate(t.created_at, true) + '</dd>' + (t.submitted_at ? '<dt>ส่งตรวจ</dt><dd>' + UI.thDate(t.submitted_at, true) + '</dd>' : '') +
            (t.verified_at ? '<dt>อนุมัติเมื่อ</dt><dd>' + UI.thDate(t.verified_at, true) + '</dd>' : '') + (t.score ? '<dt>คะแนนคุณภาพ</dt><dd>⭐ ' + t.score + '</dd>' : '') + '</dl></div>' +
            (App.me && revs.length ? '<div class="card"><h3>📋 ประวัติการตรวจ</h3>' + revs.map(function (x) {
              return '<div class="comment" style="border-left-color:' + (x.decision === 'approve' ? 'var(--green-600)' : x.decision === 'return' ? 'var(--amber)' : 'var(--blue)') + ';background:#f7f9f8">' +
                '<b>' + (DEC[x.decision] || x.decision) + '</b>' + (x.field ? ' · ' + esc(Forms.label(x.field)) : '') + (x.comment ? ': ' + esc(x.comment) : '') +
                (x.score ? ' (คะแนน ' + esc(x.score) + ')' : '') + '<div class="who">' + esc(x.reviewer_name) + ' · ' + UI.thDate(x.created_at, true) + '</div></div>';
            }).join('') + '</div>' : '') +
            (lv >= 3 && r.photos.some(function (x) { return !x.approved; }) ? '<div class="card"><h3>📷 รูปที่รอครูอนุมัติ</h3><div class="grid-cards">' + r.photos.filter(function (x) { return !x.approved; }).map(function (x) {
              return '<div class="sp-card"><div class="img">' + UI.photoImg(x) + '</div><div class="txt">' + esc(Forms.partLabel(x.part)) +
                '<div class="btn-row" style="margin-top:6px"><button class="btn sm primary" data-ap="' + esc(x.photo_id) + '">อนุมัติ</button><button class="btn sm danger" data-del="' + esc(x.photo_id) + '">ลบ</button></div></div></div>';
            }).join('') + '</div></div>' : '') +
            (lv >= 3 && r.photos.length ? '<div class="card"><h3>🖼️ เลือกรูปหน้าปก</h3><div class="chips">' + r.photos.map(function (x) {
              return '<button class="chip ' + (x.photo_id === t.cover_photo_id ? 'on' : '') + '" data-cover="' + esc(x.photo_id) + '">' + esc(Forms.partLabel(x.part)) + ' ' + esc(x.photo_id) + '</button>';
            }).join('') + '</div></div>' : '');
          UI.hydratePhotos(tb);
        }
      }
      UI.$('#tabs', el).onclick = function (e) { var b = e.target.closest('button[data-t]'); if (b) tab(b.dataset.t); };
      tab(q.tab || 'info');

      var reload = function () { return App.refresh().then(function () { return App.pages.tree(p, { tab: 'hist' }, el); }); };
      UI.$('#tabBody', el).addEventListener('click', function (e) {
        var b = e.target.closest('[data-ap],[data-del],[data-cover]');
        if (!b) return;
        var call = b.dataset.ap ? api('approvePhoto', { photo_id: b.dataset.ap }) : b.dataset.del ? api('deletePhoto', { photo_id: b.dataset.del }) : api('setCover', { photo_id: b.dataset.cover });
        UI.busy(call).then(function () { UI.toast('บันทึกแล้ว', 'ok'); return reload(); }).catch(UI.error);
      });

      var ap = UI.$('#addPhoto', el);
      if (ap) ap.onclick = function () { addPhotoModal(t, isOwner).then(function (ok) { if (ok) reload(); }); };
      var ar = UI.$('#archive', el);
      if (ar) ar.onclick = function () {
        var restore = t.status === 'archived';
        UI.modal({
          title: restore ? 'กู้คืนต้นนี้?' : '📦 เก็บถาวร (ต้นตาย/ถูกตัด)',
          body: restore ? '' : '<p>ข้อมูลและประวัติยังอยู่ แต่จะไม่แสดงในหน้าสาธารณะ</p><label class="field"><span>เหตุผล</span><input name="reason" placeholder="เช่น ต้นตาย ถูกตัดเพื่อสร้างอาคาร"></label>',
          buttons: [{ label: 'ยกเลิก', value: null }, {
            label: restore ? 'กู้คืน' : 'เก็บถาวร', cls: restore ? 'primary' : 'danger solid', onClick: function (m) {
              return api('archiveTree', { tree_id: t.tree_id, restore: restore, reason: (UI.formValues(m).reason || '') }).then(function () {
                UI.toast('บันทึกแล้ว', 'ok'); return App.refresh().then(function () { App.pages.tree(p, {}, el); });
              });
            }
          }]
        });
      };
      return function () { if (map) map.remove(); };
    });
  };

  function addPhotoModal(t, isOwner) {
    var s = App.boot.settings;
    return UI.modal({
      title: '📷 เพิ่มรูปให้ ' + esc(t.tree_code),
      body: (isOwner ? '' : '<p class="small muted">ช่วยกันเพิ่มรูป เช่น รูปดอกตอนออกดอก — รูปของคุณจะรอครูอนุมัติก่อนแสดงต่อสาธารณะ</p>') +
        '<div class="alert warn small"><span class="ic">⚠️</span><div>ห้ามมีใบหน้าคนในรูป</div></div>' +
        '<label class="field"><span>รูปนี้เป็นส่วนไหนของพืช?</span><select name="part">' + Forms.PHOTO_PARTS.map(function (x) {
          return '<option value="' + x.key + '">' + x.icon + ' ' + esc(x.label) + '</option>';
        }).join('') + '</select></label><label class="check" style="margin-bottom:12px"><input type="checkbox" name="has_scale"> มีไม้บรรทัด/วัตถุเทียบขนาด</label>' +
        '<label class="field"><span>เลือกรูป</span><input type="file" name="file" accept="image/*"></label>',
      buttons: [{ label: 'ยกเลิก', value: false }, {
        label: 'อัปโหลด', cls: 'primary', onClick: function (m) {
          var file = m.querySelector('input[type=file]').files[0];
          if (!file) { UI.toast('เลือกรูปก่อน', 'error'); return false; }
          var v = UI.formValues(m);
          return UI.resizeImage(file, Number(s.photo_max_px) || 1600, Number(s.photo_quality) || 0.8).then(function (img) {
            return UI.busy(api('uploadPhoto', { tree_id: t.tree_id, part: v.part, data: img.base64, mime: img.mime, has_scale: v.has_scale, taken_at: new Date(file.lastModified || Date.now()).toISOString() }), 'กำลังอัปโหลด');
          }).then(function () { UI.toast('เพิ่มรูปแล้ว ขอบคุณที่ช่วยกัน! 🙏', 'ok'); return true; });
        }
      }]
    });
  }

  // ================= แผนที่ภาคสนาม =================
  App.pages.map = function (p, q, el) {
    var lv = App.level();
    var mode = q.color || 'status';
    var filter = q.f || 'all';
    el.innerHTML = '<div class="map-wrap"><div id="bigMap" class="map full"></div>' +
      '<div class="map-tools"><a class="btn sm primary" href="#/map3d">🧊 แผนที่ 3 มิติ</a><button class="btn sm" id="locBtn">📍 ฉันอยู่ตรงไหน</button>' +
      (App.me ? '<button class="btn sm" id="nearBtn">🔎 ต้นที่ข้อมูลยังไม่ครบใกล้ฉัน</button>' : '') +
      '<select id="filterSel" style="min-height:36px;padding:4px 8px"><option value="all">ทุกต้น</option>' + (App.me ? '<option value="mine">ของฉัน</option>' : '') +
      (lv >= 1 ? '<option value="unknown">ยังไม่ทราบชนิด</option><option value="pending">รอตรวจ</option>' : '') + '<option value="flowering">ออกดอกเดือนนี้</option></select>' +
      '<select id="colorSel" style="min-height:36px;padding:4px 8px"><option value="status">สีตามสถานะ</option><option value="family">สีตามวงศ์</option><option value="health">สีตามสุขภาพ</option></select></div>' +
      '<div class="map-legend" id="legend"></div></div>';
    var map = Maps.create(UI.$('#bigMap', el));
    Maps.addZones(map, { labels: true });
    var layer = L.layerGroup().addTo(map);
    var meMarker = null;
    UI.$('#filterSel', el).value = filter;
    UI.$('#colorSel', el).value = mode;

    var PALETTE = ['#2f855a', '#d69e2e', '#2b6cb0', '#c53030', '#6b46c1', '#dd6b20', '#319795', '#b83280', '#718096', '#38a169'];
    var HEALTH = { 'ดี': '#2f855a', 'ปานกลาง': '#d69e2e', 'มีโรค-แมลง': '#dd6b20', 'ใกล้ตาย': '#c53030', 'ตาย': '#4a5568' };

    function draw() {
      layer.clearLayers();
      var month = UI.TH_MONTHS[new Date().getMonth()];
      var trees = App.boot.trees.filter(function (t) {
        if (!t.lat || t.status === 'archived') return false;
        if (filter === 'mine') return App.me && t.created_by === App.me.user_id;
        if (filter === 'unknown') return t.species_id === 'UNKNOWN';
        if (filter === 'pending') return t.status === 'submitted' || t.status === 'pending_teacher';
        if (filter === 'flowering') { var s = App.spOf(t); return s && App.hasMonth(s.flowering_season, month); }
        return true;
      });
      var famColor = {}, fi = 0, legend = {};
      trees.forEach(function (t) {
        var s = App.spOf(t), color, key;
        if (mode === 'family') {
          key = s && s.family ? s.family : 'ไม่ทราบ';
          if (!famColor[key]) famColor[key] = PALETTE[fi++ % PALETTE.length];
          color = famColor[key];
        } else if (mode === 'health') {
          key = t.health || 'ไม่ระบุ'; color = HEALTH[t.health] || '#a0aec0';
        } else {
          key = UI.STATUS_LABEL[t.status]; color = UI.STATUS_COLOR[t.status] || '#2f855a';
        }
        legend[key] = color;
        var size = Math.max(14, Math.min(30, 10 + (t.canopy_m || 0) * 2));
        L.marker([t.lat, t.lng], { icon: Maps.pinIcon(color, size) }).bindPopup(
          (t.cover ? UI.photoImg(t.cover) : '') + '<b>' + esc(App.treeName(t)) + '</b><br>' + (s && s.scientific_name ? '<i>' + esc(s.scientific_name) + '</i><br>' : '') +
          '<span class="code-tag">' + esc(t.tree_code) + '</span><br><a href="#/tree/' + esc(t.tree_id) + '">ดูรายละเอียด ›</a>'
        ).on('popupopen', function (e) { UI.hydratePhotos(e.popup.getElement()); }).addTo(layer);
      });
      UI.$('#legend', el).innerHTML = Object.keys(legend).slice(0, 10).map(function (k) { return '<div><i style="background:' + legend[k] + '"></i>' + esc(k) + '</div>'; }).join('') +
        '<div class="muted">' + trees.length + ' ต้น</div>';
      return trees;
    }
    var shown = draw();
    if (shown.length) Maps.fitTo(map, shown.map(function (t) { return [t.lat, t.lng]; }));

    UI.$('#filterSel', el).onchange = function (e) { filter = e.target.value; draw(); };
    UI.$('#colorSel', el).onchange = function (e) { mode = e.target.value; draw(); };
    UI.$('#locBtn', el).onclick = function () {
      Maps.locateOnce().then(function (pos) {
        if (meMarker) meMarker.remove();
        meMarker = L.circleMarker([pos.lat, pos.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#3182ce', fillOpacity: 1 }).addTo(map)
          .bindTooltip('คุณอยู่ที่นี่ (±' + Math.round(pos.accuracy) + ' ม.)').openTooltip();
        map.setView([pos.lat, pos.lng], 19);
      }).catch(UI.error);
    };
    var nb = UI.$('#nearBtn', el);
    if (nb) nb.onclick = function () {
      Maps.locateOnce().catch(function () { var c = map.getCenter(); return { lat: c.lat, lng: c.lng }; }).then(function (pos) {
        var list = App.boot.trees.filter(function (t) { return t.lat && t.status !== 'archived' && (t.species_id === 'UNKNOWN' || !t.cover || !t.height_m); })
          .map(function (t) { return { t: t, d: Maps.distanceM([pos.lat, pos.lng], [t.lat, t.lng]) }; })
          .sort(function (a, b) { return a.d - b.d; }).slice(0, 10);
        UI.modal({
          title: '🔎 ต้นที่ข้อมูลยังไม่ครบใกล้คุณ',
          body: list.length ? list.map(function (x) {
            var why = [x.t.species_id === 'UNKNOWN' ? 'ยังไม่ทราบชนิด' : '', !x.t.cover ? 'ยังไม่มีรูป' : '', !x.t.height_m ? 'ยังไม่วัดขนาด' : ''].filter(String).join(', ');
            return '<a class="list-item" href="#/tree/' + esc(x.t.tree_id) + '"><div class="body"><div class="title">' + esc(App.treeName(x.t)) + ' · ' + Math.round(x.d) + ' ม.</div><div class="sub">' + esc(why) + '</div></div><span class="chev">›</span></a>';
          }).join('') : '<p>ไม่มี — ทุกต้นข้อมูลครบแล้ว 🎉</p>',
          onOpen: function (m) { m.addEventListener('click', function (e) { if (e.target.closest('a')) m.closest('.modal-bg').remove(); }); }
        });
      });
    };
    return function () { map.remove(); };
  };
})();
