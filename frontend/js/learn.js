/**
 * learn.js — การเรียนรู้
 *  H11 คลังความรู้ (อภิธานศัพท์ คู่มือ แบบทดสอบ) · 8.4 ระดับ 5 รูปวิธานโต้ตอบ + สร้างรูปวิธานแบบพิมพ์
 *  8.4 ระดับ 4 ค้นหาด้วยภาพ · 8.3 แชตบอต "ถามพฤกษา" · H9/10.2 เส้นทางเรียนรู้
 */
(function () {
  var GLOSSARY_LISTS = [['habit', 'ลักษณะวิสัย'], ['leaf_type', 'ชนิดของใบ'], ['leaf_arrangement', 'การเรียงตัวของใบ'], ['leaf_shape', 'รูปร่างแผ่นใบ'],
    ['leaf_apex', 'ปลายใบ'], ['leaf_base', 'โคนใบ'], ['leaf_margin', 'ขอบใบ'], ['leaf_venation', 'เส้นใบ'], ['bark', 'เปลือกลำต้น'],
    ['flower_type', 'ช่อดอก'], ['symmetry', 'สมมาตรของดอก'], ['fruit_type', 'ชนิดของผล']];
  var TERMS = [
    ['ชื่อวิทยาศาสตร์', 'ชื่อสากลของสิ่งมีชีวิต ใช้ภาษาละติน 2 คำ (ระบบทวินาม) คือ ชื่อสกุล + คำระบุชนิด เขียนตัวเอียง เช่น Cassia fistula L. (L. คือชื่อย่อผู้ตั้ง)'],
    ['วงศ์ (Family)', 'กลุ่มของสกุลที่มีลักษณะใกล้เคียงกัน ชื่อวงศ์พืชมักลงท้ายด้วย -aceae เช่น Fabaceae (วงศ์ถั่ว)'],
    ['ก้านใบ / แผ่นใบ', 'ก้านใบคือส่วนที่ต่อแผ่นใบกับกิ่ง แผ่นใบคือส่วนแบนที่สังเคราะห์ด้วยแสง'],
    ['ตาข้าง (ตาซอกใบ)', 'ตาที่อยู่ระหว่างก้านใบกับกิ่ง ใช้แยกใบเดี่ยวกับใบประกอบ: ใบประกอบมีตาข้างเฉพาะที่โคนก้านใบหลัก ไม่มีที่โคนใบย่อย'],
    ['หูใบ', 'ระยางค์เล็กๆ ที่โคนก้านใบ บางชนิดมี บางชนิดไม่มี ใช้ช่วยจำแนกพืชได้'],
    ['กลีบเลี้ยง / กลีบดอก', 'กลีบเลี้ยงเป็นวงนอกสุดของดอก (มักสีเขียว) กลีบดอกอยู่ถัดเข้าไป มักมีสีสด'],
    ['เกสรเพศผู้ / เกสรเพศเมีย', 'เกสรเพศผู้ประกอบด้วยก้านชูอับเรณูและอับเรณู เกสรเพศเมียประกอบด้วยยอดเกสร ก้านเกสร และรังไข่ (จะเจริญเป็นผล)'],
    ['ช่อดอก', 'กลุ่มของดอกหลายดอกที่ติดอยู่บนแกนเดียวกัน แบ่งเป็นหลายแบบตามการเรียงของดอก'],
    ['ชีพลักษณ์ (Phenology)', 'การเปลี่ยนแปลงของพืชตามฤดูกาล เช่น แตกใบอ่อน ผลัดใบ ออกดอก ติดผล บันทึกต่อเนื่องหลายปีใช้ศึกษาผลของสภาพอากาศ'],
    ['GBH / DBH', 'GBH = เส้นรอบวงลำต้นที่ระดับอก (130 ซม. จากพื้น) DBH = เส้นผ่านศูนย์กลางที่ระดับอก = GBH ÷ π'],
    ['ทรงพุ่ม (Canopy)', 'ส่วนของกิ่งและใบทั้งหมด วัดความกว้างจากขอบพุ่มด้านหนึ่งไปอีกด้าน'],
    ['พืชพื้นเมือง / พืชต่างถิ่น', 'พืชพื้นเมืองมีถิ่นกำเนิดตามธรรมชาติในประเทศไทย พืชต่างถิ่นถูกนำเข้ามาจากที่อื่น'],
    ['รูปวิธาน (Dichotomous key)', 'เครื่องมือจำแนกสิ่งมีชีวิตโดยตอบคำถามที่มี 2 ทางเลือกไปทีละข้อ จนได้ชื่อสิ่งมีชีวิต'],
    ['ตัวอย่างพรรณไม้แห้ง (Herbarium specimen)', 'กิ่งพืชที่มีใบ ดอก หรือผล นำมาอัดแห้งติดบนกระดาษพร้อมป้ายข้อมูล ใช้อ้างอิงทางพฤกษศาสตร์ระยะยาว'],
    ['มวลชีวภาพ / การกักเก็บคาร์บอน', 'น้ำหนักแห้งของต้นไม้ ประมาณครึ่งหนึ่งเป็นคาร์บอนที่ต้นไม้ดึงมาจาก CO₂ ในอากาศ']
  ];
  var GUIDES = [
    ['📷 การถ่ายภาพพรรณไม้', '<ol><li>ถ่ายทั้งต้นก่อน ถอยออกไปให้เห็นตั้งแต่โคนถึงยอด</li><li>ถ่ายเปลือกที่ระดับอก วางไม้บรรทัดหรือเหรียญเทียบขนาด</li><li>ใบ: วางบนกระดาษขาว ถ่ายทั้งด้านบนและด้านล่าง ให้แสงสม่ำเสมอ ไม่ย้อนแสง</li><li>ถ่ายกิ่งให้เห็นการเรียงตัวของใบ</li><li>ดอก/ผล: ถ่ายด้านหน้า ด้านข้าง และผ่าครึ่ง (ถ้าทำได้)</li><li>ห้ามมีใบหน้าคนในรูป และห้ามเด็ดกิ่งต้นไม้หายาก</li></ol>'],
    ['📏 การวัดขนาดต้นไม้', '<ol><li><b>เส้นรอบวง (GBH)</b>: วัดด้วยสายวัดที่ความสูง 130 ซม. จากพื้น ถ้าพื้นลาดให้วัดด้านที่สูงกว่า ถ้าลำต้นแตกเป็นหลายลำต่ำกว่าระดับอก ให้วัดทุกลำ</li>' +
      '<li><b>ความสูง (วิธีไม้บรรทัด/ไม้ยาว)</b>: ถือไม้ตรงๆ ยาวเท่าระยะแขน เดินถอยจนปลายไม้ทับยอดต้นและโคนไม้ทับโคนต้นพอดี ระยะที่ยืนถึงโคนต้น ≈ ความสูงต้นไม้</li>' +
      '<li><b>ความสูง (เทียบอาคาร)</b>: อาคารหนึ่งชั้นสูงประมาณ 3–3.5 เมตร</li><li><b>ทรงพุ่ม</b>: เดินนับก้าวจากขอบพุ่มด้านหนึ่งไปอีกด้าน (วัดความยาวก้าวตัวเองก่อน) วัด 2 แนวตั้งฉากแล้วหาค่าเฉลี่ย</li></ol>'],
    ['🗂️ การทำตัวอย่างพรรณไม้แห้ง', '<ol><li>ตัดกิ่งยาว 25–30 ซม. ที่มีใบ และมีดอกหรือผลถ้าเป็นไปได้ (เฉพาะต้นที่ไม่หายาก และได้รับอนุญาตจากครู)</li><li>จดเลขตัวอย่าง วันที่ ผู้เก็บ ตำแหน่งบนต้น</li><li>จัดวางในกระดาษหนังสือพิมพ์ ให้เห็นทั้งใบด้านบนและด้านล่าง</li><li>อัดด้วยแผงอัด เปลี่ยนกระดาษทุก 1–2 วันจนแห้ง (ประมาณ 1–2 สัปดาห์)</li><li>ติดบนกระดาษแข็งขนาด A3 พร้อมป้ายตัวอย่าง (พิมพ์ได้จากหน้า "พิพิธภัณฑ์พืชดิจิทัล") แล้วถ่ายรูปเก็บในระบบ</li></ol>'],
    ['🌸 การบันทึกชีพลักษณ์', '<ol><li>เลือกต้นประจำของตัวเอง 1–3 ต้น บันทึกทุกเดือน ช่วงวันที่ใกล้เคียงกัน</li><li>ประเมินระดับ: ไม่มี / น้อย (น้อยกว่า ¼ ของทรงพุ่ม) / ปานกลาง (¼–¾) / มาก (มากกว่า ¾)</li><li>บันทึก 6 อย่าง: แตกใบอ่อน ผลัดใบ ตาดอก ออกดอก ติดผล ผลสุก</li><li>ถ่ายรูปประกอบทุกครั้ง ข้อมูลจะสร้างปฏิทินพรรณไม้ของโรงเรียนอัตโนมัติ</li></ol>'],
    ['📍 การจับพิกัด GPS ให้แม่น', '<ol><li>เปิดตำแหน่ง (Location) ความแม่นยำสูงในมือถือ</li><li>ยืนชิดโคนต้นไม้ กด "จับพิกัด" แล้วถือนิ่งๆ 15 วินาที</li><li>ใต้ร่มไม้หนาหรือติดอาคาร GPS จะคลาดเคลื่อนมาก ให้ดูภาพดาวเทียมแล้วลากหมุดให้ตรงทรงพุ่ม</li><li>สีเขียว ≤ 5 ม. ดีมาก · สีเหลือง 5–10 ม. ควรปรับหมุด · สีแดง > 10 ม. ควรลองใหม่</li></ol>']
  ];

  // ================= คลังความรู้ =================
  App.pages.learn = function (p, q, el) {
    var tab = p.tab || 'glossary';
    var tabs = [['glossary', '📖 อภิธานศัพท์'], ['guides', '🧭 คู่มือ'], ['quiz', '📝 แบบทดสอบ']];
    el.innerHTML = '<h1>📚 คลังความรู้พฤกษศาสตร์</h1><div class="tabs">' + tabs.map(function (t) {
      return '<a href="#/learn/' + t[0] + '" style="text-decoration:none"><button class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button></a>';
    }).join('') + '</div><div id="lb"></div>';
    var lb = UI.$('#lb', el);
    if (tab === 'guides') {
      lb.innerHTML = GUIDES.map(function (g, i) { return '<details class="card" ' + (i === 0 ? 'open' : '') + '><summary style="cursor:pointer;font-weight:700;font-size:1.05rem">' + g[0] + '</summary><div style="margin-top:8px">' + g[1] + '</div></details>'; }).join('');
    } else if (tab === 'quiz') {
      quiz(lb);
    } else {
      lb.innerHTML = '<input type="search" id="gq" placeholder="ค้นหาคำศัพท์" style="margin-bottom:12px"><div id="gl"></div>';
      var render = function (term) {
        UI.$('#gl', lb).innerHTML = GLOSSARY_LISTS.map(function (g) {
          var items = App.listOpts(g[0]).filter(function (o) { return !term || (o.value + o.label_en + o.hint).toLowerCase().indexOf(term) >= 0; });
          if (!items.length) return '';
          return '<div class="card"><h3>' + g[1] + '</h3><div class="opt-grid">' + items.map(function (o) {
            return '<div class="opt" style="cursor:default">' + Icons.render(o.icon) + '<span class="th">' + esc(o.value) + '</span><span class="en">' + esc(o.label_en) + '</span>' +
              (o.hint ? '<span class="small muted" style="font-size:.75rem">' + esc(o.hint) + '</span>' : '') + '</div>';
          }).join('') + '</div></div>';
        }).join('') + (function () {
          var t = TERMS.filter(function (x) { return !term || (x[0] + x[1]).toLowerCase().indexOf(term) >= 0; });
          return t.length ? '<div class="card"><h3>คำศัพท์ทั่วไป</h3><dl class="kv">' + t.map(function (x) { return '<dt><b>' + esc(x[0]) + '</b></dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl></div>' : '';
        })();
      };
      UI.$('#gq', lb).oninput = function (e) { render(e.target.value.trim().toLowerCase()); };
      render('');
    }
  };

  function quiz(box) {
    var pool = [];
    GLOSSARY_LISTS.forEach(function (g) {
      var opts = App.listOpts(g[0]).filter(function (o) { return Icons.render(o.icon); });
      opts.forEach(function (o) { pool.push({ list: g[0], title: g[1], o: o, siblings: opts }); });
    });
    var shuffle = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    var qs = shuffle(pool.slice()).slice(0, 10).map(function (x, i) {
      var wrong = shuffle(x.siblings.filter(function (s) { return s.value !== x.o.value; })).slice(0, 3);
      return { x: x, type: i % 2 ? 'pick-icon' : 'pick-name', choices: shuffle(wrong.concat([x.o])) };
    });
    var idx = 0, score = 0, best = Number(localStorage.getItem('bmf_quiz_best') || 0);
    function show() {
      if (idx >= qs.length) {
        if (score > best) { best = score; try { localStorage.setItem('bmf_quiz_best', score); } catch (e) { /* ignore */ } }
        box.innerHTML = '<div class="card center"><div style="font-size:3rem">' + (score >= 8 ? '🏆' : score >= 5 ? '👍' : '📚') + '</div><h2>ได้ ' + score + '/' + qs.length + ' คะแนน</h2>' +
          '<p class="muted">คะแนนสูงสุดของเครื่องนี้: ' + best + '</p>' + (score < 8 ? '<p>ลองทบทวนที่ <a href="#/learn/glossary">อภิธานศัพท์</a> แล้วทำใหม่</p>' : '<p>พร้อมออกภาคสนามแล้ว!</p>') +
          '<button class="btn primary big" id="again">ทำอีกครั้ง</button></div>';
        UI.$('#again', box).onclick = function () { quiz(box); };
        return;
      }
      var Q = qs[idx];
      box.innerHTML = '<div class="card"><div class="q-progress">ข้อ ' + (idx + 1) + '/' + qs.length + ' · ได้ ' + score + ' คะแนน</div><span class="q-section">' + esc(Q.x.title) + '</span>' +
        (Q.type === 'pick-name'
          ? '<div class="center" style="margin:10px 0">' + Icons.render(Q.x.o.icon).replace('<svg', '<svg style="width:120px;height:120px"') + '</div><div class="question">รูปนี้คืออะไร?</div>' +
            '<div class="opt-grid">' + Q.choices.map(function (c) { return '<button class="opt text-only" data-v="' + esc(c.value) + '"><span class="th">' + esc(c.value) + '</span><span class="en">' + esc(c.label_en) + '</span></button>'; }).join('') + '</div>'
          : '<div class="question">ข้อใดคือ "' + esc(Q.x.o.value) + '" (' + esc(Q.x.o.label_en) + ')?</div><div class="opt-grid">' +
            Q.choices.map(function (c) { return '<button class="opt" data-v="' + esc(c.value) + '">' + Icons.render(c.icon) + '</button>'; }).join('') + '</div>') +
        '<div id="fb" style="margin-top:10px"></div></div>';
      box.onclick = function (e) {
        var b = e.target.closest('.opt[data-v]');
        if (!b || box.dataset.lock) return;
        box.dataset.lock = '1';
        var ok = b.dataset.v === Q.x.o.value;
        if (ok) score++;
        UI.$$('.opt', box).forEach(function (o) { if (o.dataset.v === Q.x.o.value) o.classList.add('on'); });
        if (!ok) b.style.borderColor = 'var(--red)';
        UI.$('#fb', box).innerHTML = '<div class="alert ' + (ok ? 'ok' : 'warn') + '"><span class="ic">' + (ok ? '✅' : '❌') + '</span><div>' + (ok ? 'ถูกต้อง!' : 'คำตอบคือ ' + esc(Q.x.o.value)) +
          (Q.x.o.hint ? ' — ' + esc(Q.x.o.hint) : '') + '</div></div><button class="btn primary" id="nx">ข้อต่อไป ›</button>';
        UI.$('#nx', box).onclick = function () { delete box.dataset.lock; idx++; show(); };
      };
    }
    show();
  }

  // ================= รูปวิธานแบบโต้ตอบ =================
  var KEY_CHARS = ['habit', 'leaf_type', 'leaf_arrangement', 'latex', 'leaf_venation', 'leaf_margin', 'leaf_shape', 'flower_color', 'flower_type', 'fruit_type', 'bark', 'symmetry', 'leaf_apex', 'leaf_base'];
  var CHAR_LIST = { flower_color: 'color' };
  function vals(sp, ch) { return String(sp[ch] || '').split(',').map(function (x) { return x.trim(); }).filter(String); }

  App.pages.key = function (p, q, el) {
    var all = App.boot.species.filter(function (s) { return s.status === 'verified' && KEY_CHARS.some(function (c) { return s[c]; }); });
    var answers = []; // [{ch, v}] v === null = ข้าม
    el.innerHTML = '<div id="keyRoot"></div>';
    var root = UI.$('#keyRoot', el);
    function remaining() {
      return all.filter(function (s) {
        return answers.every(function (a) { if (a.v === null) return true; var v = vals(s, a.ch); return !v.length || v.indexOf(a.v) >= 0; });
      }).map(function (s) {
        var miss = answers.filter(function (a) { return a.v !== null && !vals(s, a.ch).length; }).length;
        return { s: s, miss: miss };
      }).sort(function (a, b) { return a.miss - b.miss; });
    }
    function bestChar(rem) {
      var asked = answers.map(function (a) { return a.ch; });
      var best = null;
      KEY_CHARS.forEach(function (ch) {
        if (asked.indexOf(ch) >= 0) return;
        var groups = {}, known = 0;
        rem.forEach(function (r) { var v = vals(r.s, ch); if (v.length) known++; v.forEach(function (x) { groups[x] = (groups[x] || 0) + 1; }); });
        var keys = Object.keys(groups);
        if (keys.length < 2) return;
        var maxG = Math.max.apply(null, keys.map(function (k) { return groups[k]; }));
        var score = (known - maxG) + known / rem.length;
        if (!best || score > best.score) best = { ch: ch, score: score, groups: groups };
      });
      return best;
    }
    function render() {
      var rem = remaining();
      var exact = rem.filter(function (r) { return !r.miss; });
      var next = exact.length > 1 ? bestChar(rem) : null;
      var html = '<h1>🔑 รูปวิธานแบบโต้ตอบ</h1><p class="muted">ตอบคำถามจากลักษณะที่เห็นบนต้นจริงทีละข้อ ระบบจะตัดชนิดที่ไม่ตรงออก — สร้างจากข้อมูลพรรณไม้ที่ครูตรวจแล้ว ' + all.length + ' ชนิด</p>';
      if (answers.length) {
        html += '<div class="card flat"><b>เส้นทางที่ตอบ:</b><ol style="margin:6px 0 0;padding-left:22px">' + answers.map(function (a, i) {
          return '<li>' + esc(Forms.label(a.ch)) + ': <b>' + (a.v === null ? 'ไม่แน่ใจ (ข้าม)' : esc(a.v)) + '</b> <a href="#" data-back="' + i + '" class="small">แก้ข้อนี้</a></li>';
        }).join('') + '</ol></div>';
      }
      if (next) {
        var opts = App.listOpts(CHAR_LIST[next.ch] || next.ch).filter(function (o) { return next.groups[o.value]; });
        Object.keys(next.groups).forEach(function (v) { if (!opts.some(function (o) { return o.value === v; })) opts.push({ value: v, icon: '' }); });
        html += '<div class="card"><span class="q-section">ข้อ ' + (answers.length + 1) + '</span><div class="question">' + esc(Forms.label(next.ch)) + ' เป็นแบบไหน?</div>' +
          '<div class="opt-grid">' + opts.map(function (o) {
            return '<button class="opt ' + (Icons.render(o.icon) ? '' : 'text-only') + '" data-v="' + esc(o.value) + '">' + Icons.render(o.icon) + '<span class="th">' + esc(o.value) + '</span><span class="en">' + next.groups[o.value] + ' ชนิด</span></button>';
          }).join('') + '</div><div class="btn-row" style="margin-top:10px"><button class="btn" id="skip">🤷 ไม่แน่ใจ ข้ามข้อนี้</button>' +
          (answers.length ? '<button class="btn" id="restart">↺ เริ่มใหม่</button>' : '') + '</div></div>';
      } else {
        html += '<div class="alert ' + (exact.length === 1 ? 'ok' : 'info') + '"><span class="ic">' + (exact.length === 1 ? '🎉' : '🔎') + '</span><div>' +
          (exact.length === 1 ? 'พบชนิดที่ตรงกับทุกคำตอบ' : exact.length ? 'แยกต่อไม่ได้ด้วยข้อมูลที่มี — เหลือ ' + exact.length + ' ชนิด' : 'ไม่พบชนิดที่ตรงทุกข้อ ลองแก้คำตอบ หรืออาจเป็นชนิดที่ยังไม่มีในทะเบียน') +
          '</div></div><button class="btn" id="restart">↺ เริ่มใหม่</button>';
      }
      html += '<h3 style="margin-top:16px">ชนิดที่ยังเป็นไปได้ (' + exact.length + (rem.length > exact.length ? ' + ' + (rem.length - exact.length) + ' ที่ข้อมูลไม่ครบ' : '') + ')</h3>' +
        '<div class="grid-cards">' + rem.slice(0, 24).map(function (r) { return App.speciesCard(r.s).replace('class="sp-card"', 'class="sp-card"' + (r.miss ? ' style="opacity:.55"' : '')); }).join('') + '</div>' +
        (App.level() >= 1 ? '<div class="card" style="margin-top:16px"><h3>🖨️ สร้างรูปวิธานแบบเขียน (Dichotomous key)</h3><p class="small muted">ใช้เป็นใบงานเรื่องรูปวิธาน — ระบบเลือกลักษณะที่แบ่งกลุ่มได้ดีที่สุดในแต่ละขั้นให้อัตโนมัติ</p>' +
          '<button class="btn" id="genKey">สร้างรูปวิธานจากชนิดทั้งหมด</button><div id="keyOut"></div></div>' : '');
      root.innerHTML = html;
      UI.hydratePhotos(root);
      root.onclick = function (e) {
        var o = e.target.closest('.opt[data-v]');
        if (o && next) { answers.push({ ch: next.ch, v: o.dataset.v }); render(); window.scrollTo(0, 0); }
        if (e.target.id === 'skip' && next) { answers.push({ ch: next.ch, v: null }); render(); }
        if (e.target.id === 'restart') { answers = []; render(); }
        var bk = e.target.closest('[data-back]');
        if (bk) { e.preventDefault(); answers = answers.slice(0, +bk.dataset.back); render(); }
        if (e.target.id === 'genKey') UI.$('#keyOut', root).innerHTML = dichotomous(all);
      };
    }
    render();
  };

  /** สร้างรูปวิธานแบบ 2 ทางเลือก (1a/1b ...) ด้วยการแบ่งที่สมดุลที่สุดในแต่ละขั้น */
  function dichotomous(species) {
    var lines = [], n = 0;
    function split(list) {
      var best = null;
      KEY_CHARS.forEach(function (ch) {
        if (list.some(function (s) { return !vals(s, ch).length; })) return;
        var counts = {};
        list.forEach(function (s) { vals(s, ch).forEach(function (v) { counts[v] = (counts[v] || 0) + 1; }); });
        Object.keys(counts).forEach(function (v) {
          var a = list.filter(function (s) { return vals(s, ch).indexOf(v) >= 0; });
          if (!a.length || a.length === list.length) return;
          var bal = Math.min(a.length, list.length - a.length);
          if (!best || bal > best.bal) best = { ch: ch, v: v, a: a, b: list.filter(function (s) { return a.indexOf(s) < 0; }), bal: bal };
        });
      });
      return best;
    }
    function name(s) { return '<b>' + esc(s.thai_name) + '</b> <i>' + esc(s.scientific_name) + '</i>'; }
    function build(list) {
      var my = ++n;
      var sp = split(list);
      if (!sp) { lines.push({ n: my, a: list.map(name).join(', ') + (list.length > 1 ? ' <span class="muted">(แยกไม่ได้ด้วยข้อมูลที่มี)</span>' : ''), leaf: true }); return my; }
      var entry = { n: my, ch: sp.ch, v: sp.v };
      lines.push(entry);
      entry.ta = sp.a.length === 1 ? name(sp.a[0]) : build(sp.a);
      entry.tb = sp.b.length === 1 ? name(sp.b[0]) : build(sp.b);
      return my;
    }
    if (species.length < 2) return '<p class="muted">ต้องมีอย่างน้อย 2 ชนิด</p>';
    build(species);
    return '<ol style="list-style:none;padding:0;margin-top:10px;font-size:.95rem">' + lines.filter(function (l) { return !l.leaf; }).map(function (l) {
      var go = function (t) { return typeof t === 'number' ? '……… ไปข้อ ' + t : '……… ' + t; };
      return '<li style="margin-bottom:8px"><b>' + l.n + 'ก.</b> ' + esc(Forms.label(l.ch)) + ' เป็น "' + esc(l.v) + '" ' + go(l.ta) +
        '<br><b>' + l.n + 'ข.</b> ' + esc(Forms.label(l.ch)) + ' ไม่เป็น "' + esc(l.v) + '" ' + go(l.tb) + '</li>';
    }).join('') + '</ol>' + lines.filter(function (l) { return l.leaf; }).map(function (l) { return '<div class="small">' + l.n + '. ' + l.a + '</div>'; }).join('');
  }

  // ================= ค้นหาด้วยภาพ / ถาม AI =================
  App.pages.identify = function (p, q, el) {
    var aiOn = String(App.boot.settings.ai_enabled).toUpperCase() === 'TRUE';
    if (!aiOn) { el.innerHTML = '<div class="empty"><span class="ic">🤖</span>ระบบ AI ปิดอยู่ในขณะนี้</div>'; return; }
    var imgs = [];
    el.innerHTML = '<h1>📷 ต้นนี้คือต้นอะไร? มีในโรงเรียนไหม?</h1><p class="muted">ถ่ายรูปใบ ดอก หรือผล (สูงสุด 3 รูป) ให้ AI ช่วยดู — ไม่บันทึกลงทะเบียน · ถ้าเป็นชนิดที่มีในโรงเรียนจะแสดงตำแหน่งบนแผนที่</p>' +
      '<div class="card"><div class="btn-row"><select id="ipart" style="width:auto"><option value="leaf_top">🍃 ใบ</option><option value="flower">🌼 ดอก</option><option value="fruit">🍎 ผล</option><option value="whole">🌳 ทั้งต้น</option><option value="bark">🪵 เปลือก</option></select>' +
      '<label class="btn primary">📷 ถ่าย/เลือกรูป<input type="file" accept="image/*" capture="environment" id="ifile" class="hidden"></label></div>' +
      '<div id="ithumbs" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"></div><button class="btn primary big block" id="igo" style="margin-top:12px" disabled>🤖 ให้ AI ช่วยดู</button></div><div id="iout"></div>';
    function thumbs() {
      UI.$('#ithumbs', el).innerHTML = imgs.map(function (im, i) {
        return '<div style="position:relative;width:84px;height:84px;border-radius:10px;overflow:hidden"><img src="' + im.preview + '" style="width:100%;height:100%;object-fit:cover">' +
          '<span class="pill" style="position:absolute;left:4px;bottom:4px;font-size:.7rem">' + esc(Forms.partLabel(im.part)) + '</span>' +
          '<button class="btn sm" data-rm="' + i + '" style="position:absolute;top:2px;right:2px;min-height:24px;padding:0 6px">✕</button></div>';
      }).join('');
      UI.$('#igo', el).disabled = !imgs.length;
    }
    UI.$('#ifile', el).onchange = function (e) {
      var f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (imgs.length >= 3) return UI.toast('ใช้ได้สูงสุด 3 รูป', 'warn');
      UI.resizeImage(f, 1024, 0.8).then(function (im) { imgs.push({ part: UI.$('#ipart', el).value, data: im.base64, mime: im.mime, preview: im.dataUrl }); thumbs(); }).catch(UI.error);
    };
    UI.$('#ithumbs', el).onclick = function (e) { var b = e.target.closest('[data-rm]'); if (b) { imgs.splice(+b.dataset.rm, 1); thumbs(); } };
    UI.$('#igo', el).onclick = function () {
      UI.busy(api('aiIdentifyImages', { images: imgs.map(function (i) { return { part: i.part, data: i.data, mime: i.mime }; }) }), 'AI กำลังดูรูป…').then(function (r) {
        var out = UI.$('#iout', el);
        var cands = r.candidates || [];
        out.innerHTML = (r.has_human_face ? '<div class="alert error"><span class="ic">🙈</span><div>พบใบหน้าคนในรูป — ควรถ่ายเฉพาะต้นไม้</div></div>' : '') +
          (cands.length && cands[0].confidence < 0.5 ? '<div class="alert warn"><span class="ic">🤔</span><div>AI ไม่ค่อยมั่นใจ ลองถ่ายดอกหรือผลเพิ่ม</div></div>' : '') +
          (cands.map(function (c, i) {
            var pct = Math.round(c.confidence * 100);
            return '<div class="cand ' + (i === 0 ? 'top' : '') + '"><div class="name">' + esc(c.thai_name || c.common_name) + '</div><div class="sci">' + esc(c.scientific_name) + '</div><div class="small muted">วงศ์ ' + esc(c.family) + '</div>' +
              '<div class="conf ' + (pct < 50 ? 'low' : '') + '"><span>ความมั่นใจ</span><div class="progress"><div style="width:' + pct + '%"></div></div><b>' + pct + '%</b></div>' +
              (c.reason ? '<div class="small">💬 ' + esc(c.reason) + '</div>' : '') +
              (c.trees && c.trees.length ? '<div class="alert ok" style="margin-top:8px"><span class="ic">🏫</span><div>มีในโรงเรียน <b>' + c.trees.length + ' ต้น</b> — <a href="#/sp/' + esc(c.existing_species_id) + '">ดูข้อมูลชนิด ›</a></div></div><div class="map" id="imap' + i + '" style="height:200px"></div>'
                : '<div class="small muted" style="margin-top:6px">ยังไม่มีชนิดนี้ในทะเบียนของโรงเรียน' + (App.me ? ' — ถ้าเจอในโรงเรียน <a href="#/add">เพิ่มต้นไม้</a> ได้เลย' : '') + '</div>') + '</div>';
          }).join('') || '<div class="card empty">AI จำแนกไม่ได้ ลองถ่ายให้ชัดขึ้น</div>') +
          '<p class="small muted">AI เป็นผู้ช่วย อาจผิดได้ ตรวจสอบกับลักษณะจริงหรือถามครูทุกครั้ง</p>';
        cands.forEach(function (c, i) {
          if (!c.trees || !c.trees.length) return;
          var m = Maps.create(UI.$('#imap' + i, el));
          Maps.addZones(m, { fill: false });
          c.trees.forEach(function (t) {
            if (t.lat) L.marker([t.lat, t.lng], { icon: Maps.pinIcon('#e53e3e', 22, '🌳') }).bindPopup('<b>' + esc(t.tree_code) + '</b><br><a href="#/tree/' + esc(t.tree_id) + '">ดูต้นนี้ ›</a>').addTo(m);
          });
          Maps.fitTo(m, c.trees.map(function (t) { return [t.lat, t.lng]; }), 19);
        });
      }).catch(UI.error);
    };
  };

  // ================= แชตบอต ถามพฤกษา =================
  var chat = [];
  App.pages.ask = function (p, q, el) {
    var aiOn = String(App.boot.settings.ai_enabled).toUpperCase() === 'TRUE';
    if (!aiOn) { el.innerHTML = '<div class="empty"><span class="ic">🤖</span>ระบบ AI ปิดอยู่ในขณะนี้</div>'; return; }
    var SUGGEST = ['ต้นไม้ไหนในโรงเรียนใช้เป็นยาสมุนไพรได้บ้าง', 'เดือนนี้ต้นอะไรออกดอก', 'ต้นไม้ดอกสีเหลืองมีอะไรบ้าง', 'ราชพฤกษ์ใช้ทำอะไรได้บ้าง'];
    el.innerHTML = '<h1>💬 ถามพฤกษา</h1><p class="muted">ถามเรื่องต้นไม้ในโรงเรียน AI จะตอบจากทะเบียนพรรณไม้ที่ครูตรวจแล้ว</p>' +
      '<div class="card" id="chatBox" style="min-height:200px"></div><div class="chips" id="sugg" style="margin-bottom:10px">' +
      SUGGEST.map(function (s) { return '<button class="chip" data-s="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
      '<form id="chatForm" class="btn-row"><input id="chatIn" placeholder="พิมพ์คำถาม…" style="flex:1;min-width:180px" autocomplete="off"><button class="btn primary">ส่ง</button>' +
      (chat.length ? '<button type="button" class="btn" id="clr">ล้าง</button>' : '') + '</form>';
    var box = UI.$('#chatBox', el);
    function render() {
      box.innerHTML = chat.length ? chat.map(function (m) {
        var mine = m.role === 'user';
        return '<div style="display:flex;justify-content:' + (mine ? 'flex-end' : 'flex-start') + ';margin-bottom:10px"><div style="max-width:85%;padding:10px 14px;border-radius:14px;' +
          (mine ? 'background:var(--green-600);color:#fff' : 'background:var(--green-50)') + '">' + esc(m.text).replace(/\n/g, '<br>') +
          (m.species && m.species.length ? '<div class="chips" style="margin-top:6px">' + m.species.map(function (id) {
            var s = App.speciesById[id];
            return s ? '<a class="chip" href="#/sp/' + esc(id) + '">🌿 ' + esc(s.thai_name) + '</a>' : '';
          }).join('') + '</div>' : '') + '</div></div>';
      }).join('') : '<div class="empty"><span class="ic">🌳</span>สวัสดี! อยากรู้อะไรเกี่ยวกับต้นไม้ในโรงเรียน ถามได้เลย</div>';
      box.scrollTop = box.scrollHeight;
    }
    function send(text) {
      text = text.trim();
      if (!text) return;
      chat.push({ role: 'user', text: text });
      render();
      var pending = { role: 'model', text: '…' };
      chat.push(pending);
      render();
      api('aiChat', { messages: chat.slice(0, -1).map(function (m) { return { role: m.role, text: m.text }; }) }).then(function (r) {
        pending.text = r.answer; pending.species = r.species_ids; render();
      }).catch(function (e) { pending.text = '⚠️ ' + e.message; render(); });
    }
    render();
    UI.$('#chatForm', el).onsubmit = function (e) { e.preventDefault(); var i = UI.$('#chatIn', el); send(i.value); i.value = ''; };
    UI.$('#sugg', el).onclick = function (e) { var b = e.target.closest('[data-s]'); if (b) send(b.dataset.s); };
    var clr = UI.$('#clr', el);
    if (clr) clr.onclick = function () { chat = []; App.pages.ask(p, q, el); };
  };

  // ================= เส้นทางเรียนรู้ =================
  App.pages.routes = function (p, q, el) {
    var rs = App.boot.routes || [];
    el.innerHTML = '<h1>🚶 เส้นทางเรียนรู้</h1><p class="muted">เส้นทางเดินชมพรรณไม้ที่ครูจัดไว้ — ใช้ต้อนรับผู้มาเยี่ยมชมหรือเรียนนอกห้อง</p>' +
      (rs.length ? rs.map(function (r) {
        return '<a class="card" href="#/route/' + esc(r.route_id) + '" style="display:block;text-decoration:none;color:inherit;border-left:6px solid ' + esc(r.color) + '"><h3>' + esc(r.name) + (r.published ? '' : ' <span class="pill">ยังไม่เผยแพร่</span>') + '</h3>' +
          '<p class="small">' + esc(r.description) + '</p><span class="pill verified">' + r.tree_ids.length + ' จุด</span></a>';
      }).join('') : '<div class="empty"><span class="ic">🚶</span>ยังไม่มีเส้นทาง' + (App.level() >= 3 ? ' — <a href="#/admin/routes">สร้างเส้นทาง</a>' : '') + '</div>');
  };

  App.pages.route = function (p, q, el) {
    var r = (App.boot.routes || []).filter(function (x) { return x.route_id === p.id; })[0];
    if (!r) throw new Error('ไม่พบเส้นทางนี้');
    var stops = r.tree_ids.map(function (id) { return App.treeById[id]; }).filter(Boolean);
    var dist = 0;
    for (var i = 1; i < stops.length; i++) if (stops[i].lat && stops[i - 1].lat) dist += Maps.distanceM([stops[i - 1].lat, stops[i - 1].lng], [stops[i].lat, stops[i].lng]);
    el.innerHTML = '<h1>🚶 ' + esc(r.name) + '</h1><p>' + esc(r.description) + '</p><p class="small muted">' + stops.length + ' จุด · ระยะเดินประมาณ ' + Math.round(dist) + ' เมตร (≈ ' + Math.max(1, Math.round(dist / 50 + stops.length * 2)) + ' นาที รวมเวลาชม)</p>' +
      '<div class="btn-row" style="margin-bottom:12px"><a class="btn primary" href="#/map3d?route=' + esc(r.route_id) + '&tour=1">🧊 ทัวร์ 3 มิติ</a>' + (App.level() >= 3 ? '<a class="btn" href="#/admin/routes?edit=' + esc(r.route_id) + '">✏️ แก้ไขเส้นทาง</a>' : '') + '</div>' +
      '<div class="split"><div class="card"><div class="map" id="rmap" style="height:420px"></div></div><div class="card">' + stops.map(function (t, i) {
        var sp = App.spOf(t) || {};
        var use = [sp.use_medicine, sp.use_food, sp.use_construction, sp.use_culture, sp.use_other].filter(Boolean)[0] || '';
        return '<a class="list-item" href="#/tree/' + esc(t.tree_id) + '"><div class="thumb" style="position:relative">' + App.thumbHtml(t) +
          '<span style="position:absolute;top:2px;left:2px;background:' + esc(r.color) + ';color:#fff;border-radius:50%;width:22px;height:22px;font-size:.8rem;display:flex;align-items:center;justify-content:center;font-weight:800">' + (i + 1) + '</span></div>' +
          '<div class="body"><div class="title">' + esc(App.treeName(t)) + '</div><div class="sub"><span class="sci">' + esc(sp.scientific_name || '') + '</span></div>' +
          (use ? '<div class="sub">🧺 ' + esc(use) + '</div>' : '') + '</div><span class="chev">›</span></a>';
      }).join('') + '</div></div>';
    UI.hydratePhotos(el);
    var m = Maps.create(UI.$('#rmap', el));
    Maps.addZones(m, { fill: false });
    var pts = stops.filter(function (t) { return t.lat; }).map(function (t) { return [t.lat, t.lng]; });
    L.polyline(pts, { color: r.color, weight: 5, dashArray: '8 8' }).addTo(m);
    stops.forEach(function (t, i) {
      if (t.lat) L.marker([t.lat, t.lng], { icon: Maps.pinIcon(r.color, 26, '<b style="color:#fff">' + (i + 1) + '</b>') })
        .bindPopup('<b>' + (i + 1) + '. ' + esc(App.treeName(t)) + '</b><br><a href="#/tree/' + esc(t.tree_id) + '">ดูรายละเอียด ›</a>').addTo(m);
    });
    Maps.fitTo(m, pts);
    return function () { m.remove(); };
  };
})();
