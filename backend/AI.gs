/**
 * AI.gs — Gemini (และ Pl@ntNet เสริม) ช่วยจำแนกพรรณไม้ ค้นหาด้วยภาษาธรรมชาติ และร่างคำบรรยาย
 *
 * API Key เก็บใน Script Properties เท่านั้น: GEMINI_API_KEY, PLANTNET_API_KEY
 */

var AI_PHOTO_PRIORITY = ['whole', 'leaf_top', 'flower', 'inflorescence', 'fruit', 'leaf_arrangement', 'bark', 'leaf_bottom', 'seed'];
var PLANTNET_ORGAN = { whole: 'habit', leaf_top: 'leaf', leaf_bottom: 'leaf', leaf_arrangement: 'leaf',
  flower: 'flower', inflorescence: 'flower', fruit: 'fruit', seed: 'fruit', bark: 'bark' };

/** ช่องสัณฐานวิทยาที่ให้ AI เติม พร้อมชื่อรายการตัวเลือกใน Lists */
var AI_MORPH_FIELDS = {
  habit: 'habit', bark: 'bark', latex: 'latex', leaf_type: 'leaf_type', leaf_arrangement: 'leaf_arrangement',
  leaf_shape: 'leaf_shape', leaf_apex: 'leaf_apex', leaf_base: 'leaf_base', leaf_margin: 'leaf_margin',
  leaf_venation: 'leaf_venation', leaf_texture: 'leaf_texture', leaf_hair: 'leaf_hair',
  flower_type: 'flower_type', flower_color: 'color', symmetry: 'symmetry', flower_position: 'flower_position',
  fruit_type: 'fruit_type', fruit_color: 'color'
};

function aiCheckQuota(ctx, kind) {
  var s = getSettings();
  if (!bool(s.ai_enabled)) fail('ครูปิดการใช้ AI ไว้ชั่วคราว');
  var key, limit;
  if (!ctx.user) {
    key = 'ai_guest_' + Platform.today();
    limit = num(s.ai_search_daily_limit_guest) || 200;
  } else if (ctx.level >= ROLE_LEVEL.teacher) {
    return;
  } else {
    key = 'ai_' + ctx.user.user_id + '_' + Platform.today();
    limit = num(s.ai_daily_limit_per_user) || 30;
  }
  var used = num(Platform.cacheGet(key)) || 0;
  if (used >= limit) fail('วันนี้ใช้ AI ครบ ' + limit + ' ครั้งแล้ว พรุ่งนี้ใช้ได้ใหม่ (ระบบยังบันทึกข้อมูลได้ตามปกติ)');
  Platform.cachePut(key, String(used + 1), 6 * 60 * 60);
}

function geminiGenerate(parts, temperature) {
  return geminiGenerateContents([{ role: 'user', parts: parts }], temperature);
}

/** contents = [{role:'user'|'model', parts:[...]}] (หลายรอบสำหรับแชต) */
function geminiGenerateContents(contents, temperature) {
  var key = Platform.prop('GEMINI_API_KEY');
  if (!key) fail('ยังไม่ได้ตั้งค่า Gemini API Key (ครูตั้งได้ที่ ตั้งค่าระบบ)');
  var model = str(getSettings().gemini_model) || 'gemini-2.5-flash';
  var res = Platform.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': key },
    payload: JSON.stringify({
      contents: contents,
      generationConfig: { responseMimeType: 'application/json', temperature: temperature === undefined ? 0.2 : temperature }
    })
  });
  if (res.code !== 200) {
    var msg = res.text;
    try { msg = JSON.parse(res.text).error.message; } catch (e) { /* ใช้ข้อความดิบ */ }
    fail('AI ขัดข้อง (' + res.code + '): ' + String(msg).slice(0, 200));
  }
  var body = JSON.parse(res.text);
  var cand = body.candidates && body.candidates[0];
  if (!cand || !cand.content) fail('AI ไม่ตอบกลับ (อาจถูกกรองเนื้อหา) กรุณาลองใหม่');
  var text = cand.content.parts.map(function (p) { return p.text || ''; }).join('');
  return { json: parseJsonLoose(text), model: model };
}

function parseJsonLoose(text) {
  text = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(text); } catch (e) {
    var m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    fail('อ่านคำตอบของ AI ไม่ได้ กรุณาลองใหม่');
  }
}

function normSci(name) {
  return String(name || '').toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).slice(0, 2).join(' ');
}

function listValues(lists, name) {
  return (lists[name] || []).map(function (o) { return o.value; });
}

function aiLog(ctx, treeId, kind, model, input, result, topName, topConf) {
  DB.insert('AILog', {
    log_id: DB.nextId('AILog', 'log_id', 'AI', 5), user_id: ctx.user ? ctx.user.user_id : 'guest',
    tree_id: treeId || '', kind: kind, model: model, input_summary: input,
    result: JSON.stringify(result).slice(0, 45000), top_name: topName || '',
    top_confidence: topConf === undefined || topConf === null ? '' : topConf, created_at: nowIso()
  });
}

/** แกนกลางการจำแนก: images = [{part, mime, data}] → result */
function identifyCore(images) {
    var lists = listsOut();
    var allowed = {};
    Object.keys(AI_MORPH_FIELDS).forEach(function (k) { allowed[k] = listValues(lists, AI_MORPH_FIELDS[k]); });
    var known = DB.filter('Species', function (s) { return s.status !== 'archived'; }).slice(0, 300)
      .map(function (s) { return s.thai_name + ' (' + s.scientific_name + ')'; }).join('; ');

    var prompt = [
      'TASK: identify',
      'คุณเป็นผู้ช่วยนักพฤกษศาสตร์ของสวนพฤกษศาสตร์โรงเรียนในประเทศไทย ช่วยนักเรียนจำแนกพรรณไม้จากรูปถ่ายต่อไปนี้',
      'รูปที่แนบ (ตามลำดับ): ' + images.map(function (i) { return partLabel(i.part); }).join(', '),
      'พรรณไม้ที่มีในทะเบียนของโรงเรียนแล้ว (ถ้าตรงให้ใช้ชื่อเดียวกัน): ' + (known || '-'),
      'ตอบเป็น JSON เท่านั้น ตามโครงสร้าง:',
      '{"candidates":[{"thai_name":"","local_name":"","common_name":"","scientific_name":"","family":"","confidence":0.0,"reason":""}],',
      ' "morphology":{' + Object.keys(allowed).map(function (k) { return '"' + k + '":""'; }).join(',') + '},',
      ' "photo_issues":[], "needs_more_photos":[], "has_human_face":false}',
      'กติกา:',
      '- candidates เรียงจากมั่นใจมากไปน้อย ไม่เกิน 3 ชนิด confidence เป็นตัวเลข 0–1 ที่สะท้อนความมั่นใจจริง',
      '- scientific_name ใส่ชื่อผู้ตั้งด้วยถ้ารู้ เช่น "Cassia fistula L." family ใช้ชื่อวงศ์ปัจจุบัน (APG)',
      '- reason อธิบายลักษณะที่เห็นในรูปเป็นภาษาไทยสั้นๆ ให้นักเรียนตรวจสอบเองได้',
      '- morphology: เลือกค่าจากตัวเลือกที่กำหนดเท่านั้น ถ้าดูจากรูปไม่ได้ให้ใส่ "" ตัวเลือก: ' + JSON.stringify(allowed),
      '- photo_issues: ปัญหาของรูปเป็นภาษาไทย เช่น "รูปใบเบลอ" "ไม่เห็นการเรียงตัวของใบ"',
      '- needs_more_photos: ส่วนที่ควรถ่ายเพิ่มเพื่อให้จำแนกได้แม่นขึ้น เช่น "ดอก" "ผล"',
      '- has_human_face: true ถ้ามีใบหน้าคนในรูปใดรูปหนึ่ง',
      '- ถ้าไม่แน่ใจ ให้ confidence ต่ำ ห้ามแต่งข้อมูล'
    ].join('\n');

    var parts = [{ text: prompt }];
    images.forEach(function (i) { parts.push({ inline_data: { mime_type: i.mime, data: i.data } }); });
    var g = geminiGenerate(parts);
    var r = g.json || {};
    var cands = (r.candidates || []).slice(0, 3);

    // เทียบกับชนิดที่มีในระบบ
    var species = DB.filter('Species', function (s) { return s.status !== 'archived'; });
    var trees = DB.filter('Trees', function (x) { return x.status === STATUS.VERIFIED; });
    cands.forEach(function (c) {
      c.confidence = Math.max(0, Math.min(1, num(c.confidence) || 0));
      var n = normSci(c.scientific_name);
      var match = species.filter(function (s) {
        return (n && normSci(s.scientific_name) === n) || (c.thai_name && s.thai_name === c.thai_name);
      })[0];
      if (match) {
        c.existing_species_id = match.species_id;
        c.existing_status = match.status;
        c.tree_count = trees.filter(function (x) { return x.species_id === match.species_id; }).length;
      }
    });

    // ความเห็นที่ 2 จาก Pl@ntNet
    var plantnet = null;
    if (bool(getSettings().plantnet_enabled) && Platform.prop('PLANTNET_API_KEY')) {
      try {
        plantnet = AI._plantnet(images);
        cands.forEach(function (c) {
          c.plantnet_agree = plantnet.some(function (p) { return normSci(p.scientific_name) === normSci(c.scientific_name); });
        });
      } catch (e) {
        plantnet = { error: String(e.message || e) };
      }
    }

    // กรองค่า morphology ที่ไม่อยู่ในตัวเลือก
    var morph = {};
    Object.keys(r.morphology || {}).forEach(function (k) {
      var v = str(r.morphology[k]);
      if (v && allowed[k] && allowed[k].indexOf(v) >= 0) morph[k] = v;
    });

    var result = {
      candidates: cands, morphology: morph,
      photo_issues: r.photo_issues || [], needs_more_photos: r.needs_more_photos || [],
      has_human_face: !!r.has_human_face, plantnet: plantnet, model: g.model, at: nowIso()
    };
    return { result: result, model: g.model };
}

var AI = {
  /** จำแนกชนิดจากรูปของต้นไม้ */
  aiIdentify: function (d, ctx) {
    aiCheckQuota(ctx, 'identify');
    var t = DB.find('Trees', 'tree_id', d.tree_id);
    if (!t || !canSeeTree(t, ctx)) fail('ไม่พบต้นไม้');
    var photos = DB.filter('Photos', function (p) { return p.tree_id === t.tree_id; });
    if (!photos.length) fail('ถ่ายรูปอย่างน้อย 1 รูปก่อนให้ AI ช่วยดู');
    photos.sort(function (a, b) { return AI_PHOTO_PRIORITY.indexOf(a.part) - AI_PHOTO_PRIORITY.indexOf(b.part); });
    var chosen = [], seen = {};
    photos.forEach(function (p) { if (chosen.length < 4 && !seen[p.part]) { seen[p.part] = 1; chosen.push(p); } });
    var images = chosen.map(function (p) {
      var f = Platform.fileBase64(p.drive_file_id);
      return { part: p.part, mime: f.mime, data: f.data };
    });

    var res = identifyCore(images);
    var result = res.result, cands = result.candidates, g = { model: res.model };
    aiLog(ctx, t.tree_id, 'identify', g.model, images.map(function (i) { return i.part; }).join(','), result,
      cands[0] ? cands[0].thai_name + ' / ' + cands[0].scientific_name : '', cands[0] ? cands[0].confidence : '');
    return result;
  },

  _plantnet: function (images) {
    var key = Platform.prop('PLANTNET_API_KEY');
    var res = Platform.fetchMultipartImages(
      'https://my-api.plantnet.org/v2/identify/all?lang=en&nb-results=5&api-key=' + encodeURIComponent(key),
      images.slice(0, 5).map(function (i) { return { mime: i.mime, data: i.data, organ: PLANTNET_ORGAN[i.part] || 'auto' }; })
    );
    if (res.code !== 200) throw new Error('Pl@ntNet ' + res.code);
    return (JSON.parse(res.text).results || []).slice(0, 3).map(function (x) {
      return {
        scientific_name: x.species.scientificNameWithoutAuthor,
        author: x.species.scientificNameAuthorship,
        family: x.species.family && x.species.family.scientificNameWithoutAuthor,
        common_names: (x.species.commonNames || []).slice(0, 3),
        score: Math.round(x.score * 100) / 100
      };
    });
  },

  /** ค้นหาด้วยภาพ / ถาม AI โดยไม่บันทึก: "ต้นนี้มีในโรงเรียนไหม อยู่ตรงไหน" */
  aiIdentifyImages: function (d, ctx) {
    var imgs = (d.images || []).slice(0, 3).map(function (i) {
      var data = String(i.data || '').replace(/^data:[^,]+,/, '');
      if (!data || data.length > MAX_PHOTO_BASE64) fail('รูปใหญ่เกินไปหรือว่างเปล่า');
      return { part: PHOTO_PARTS.indexOf(i.part) >= 0 ? i.part : 'other', mime: /^image\/(jpeg|png|webp)$/.test(i.mime) ? i.mime : 'image/jpeg', data: data };
    });
    if (!imgs.length) fail('เลือกรูปอย่างน้อย 1 รูป');
    aiCheckQuota(ctx, 'identify');
    var res = identifyCore(imgs);
    var trees = DB.filter('Trees', function (t) { return t.status === STATUS.VERIFIED; });
    res.result.candidates.forEach(function (c) {
      c.trees = !c.existing_species_id ? [] : trees.filter(function (t) { return t.species_id === c.existing_species_id; }).map(function (t) {
        return { tree_id: t.tree_id, tree_code: t.tree_code, lat: num(t.lat), lng: num(t.lng), zone_id: t.zone_id };
      });
    });
    var top = res.result.candidates[0];
    aiLog(ctx, '', 'identify_photo', res.model, imgs.map(function (i) { return i.part; }).join(','), res.result,
      top ? top.thai_name + ' / ' + top.scientific_name : '', top ? top.confidence : '');
    return res.result;
  },

  /** แชตบอต "ถามพฤกษา" — ตอบจากข้อมูลพรรณไม้ที่ครูตรวจแล้วของโรงเรียน */
  aiChat: function (d, ctx) {
    var msgs = (d.messages || []).slice(-8).map(function (m) { return { role: m.role === 'model' ? 'model' : 'user', text: str(m.text).slice(0, 800) }; })
      .filter(function (m) { return m.text; });
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') fail('พิมพ์คำถามก่อน');
    aiCheckQuota(ctx, 'chat');
    var zones = {};
    DB.all('Zones').forEach(function (z) { zones[z.zone_id] = z.name; });
    var bySp = {};
    DB.all('Trees').forEach(function (t) {
      if (t.status !== STATUS.VERIFIED) return;
      var b = bySp[t.species_id] = bySp[t.species_id] || { n: 0, zones: {} };
      b.n++;
      if (t.zone_id) b.zones[zones[t.zone_id] || t.zone_id] = 1;
    });
    var cut = function (v, n) { v = str(v); return v.length > n ? v.slice(0, n) + '…' : v; };
    var data = DB.filter('Species', function (s) { return s.status === 'verified' && bySp[s.species_id]; }).map(function (s) {
      var b = bySp[s.species_id];
      return [s.species_id, s.thai_name, s.local_name, s.scientific_name, s.family, s.habit, s.flower_color, s.flowering_season, s.fruiting_season,
        cut([s.use_food && 'อาหาร: ' + s.use_food, s.use_medicine && 'ยา: ' + s.use_medicine, s.use_construction && 'ใช้สอย: ' + s.use_construction,
          s.use_culture && 'วัฒนธรรม: ' + s.use_culture, s.use_other && 'อื่นๆ: ' + s.use_other].filter(Boolean).join(' / '), 220),
        b.n + ' ต้น', Object.keys(b.zones).join(',')].join(' | ');
    }).join('\n');
    var system = [
      'TASK: chat',
      'คุณคือ "ถามพฤกษา" ผู้ช่วยตอบคำถามเรื่องพรรณไม้ในโรงเรียน ' + str(getSettings().school_name) + ' สำหรับนักเรียนและผู้เยี่ยมชม',
      'ตอบเป็นภาษาไทยที่เข้าใจง่าย สั้น กระชับ ใช้เฉพาะข้อมูลทะเบียนพรรณไม้ด้านล่างเป็นหลัก',
      'ถ้าคำถามเกี่ยวกับพืชที่ไม่มีในข้อมูล ให้บอกว่ายังไม่มีในทะเบียนของโรงเรียน (อธิบายความรู้ทั่วไปได้สั้นๆ และบอกชัดว่าเป็นความรู้ทั่วไป)',
      'เรื่องสมุนไพร/การกิน ให้เตือนว่าควรปรึกษาผู้รู้ก่อนนำไปใช้จริง ห้ามแต่งข้อมูล',
      'ข้อมูล (รหัส | ชื่อ | ชื่อพื้นเมือง | ชื่อวิทยาศาสตร์ | วงศ์ | ลักษณะวิสัย | สีดอก | ออกดอก | ติดผล | ประโยชน์ | จำนวนต้น | โซน):',
      data || '(ยังไม่มีข้อมูลที่ครูตรวจแล้ว)',
      'ตอบเป็น JSON: {"answer":"คำตอบ","species_ids":["รหัสชนิดที่กล่าวถึง"]}'
    ].join('\n');
    var contents = [{ role: 'user', parts: [{ text: system }] }, { role: 'model', parts: [{ text: '{"answer":"พร้อมช่วยตอบคำถามเรื่องพรรณไม้ในโรงเรียนครับ","species_ids":[]}' }] }]
      .concat(msgs.map(function (m) { return { role: m.role, parts: [{ text: m.text }] }; }));
    var g = geminiGenerateContents(contents, 0.4);
    var ids = (g.json.species_ids || []).filter(function (id) { return DB.find('Species', 'species_id', id); });
    aiLog(ctx, '', 'chat', g.model, msgs[msgs.length - 1].text, g.json, '', '');
    return { answer: str(g.json.answer) || 'ขออภัย ตอบไม่ได้ ลองถามใหม่อีกครั้ง', species_ids: ids };
  },

  /** ค้นหาด้วยภาษาธรรมชาติ → แปลงเป็นตัวกรอง */
  aiSearch: function (d, ctx) {
    var q = str(d.q).slice(0, 300);
    if (!q) fail('พิมพ์สิ่งที่ต้องการค้นหา');
    aiCheckQuota(ctx, 'search');
    var lists = listsOut();
    var zones = zonesOut().map(function (z) { return { zone_id: z.zone_id, name: z.name }; });
    var prompt = [
      'TASK: search',
      'แปลงคำค้นหาภาษาไทยของผู้ใช้ระบบทะเบียนพรรณไม้โรงเรียน ให้เป็นตัวกรอง JSON',
      'คำค้น: "' + q.replace(/"/g, "'") + '"',
      'ตัวกรองที่ใช้ได้ (ใส่เฉพาะที่ผู้ใช้กล่าวถึง):',
      '{"text":"คำค้นชื่อพืช ถ้ามี","habit":[],"flower_color":[],"flowering_month":[],"fruiting_month":[],"zone_id":[],"use":[],"family":""}',
      'habit เลือกจาก: ' + JSON.stringify(listValues(lists, 'habit')),
      'flower_color เลือกจาก: ' + JSON.stringify(listValues(lists, 'color')),
      'flowering_month/fruiting_month เป็นเลขเดือน 1–12',
      'zone_id เลือกจาก: ' + JSON.stringify(zones),
      'use เลือกจาก: ["food","medicine","construction","pesticide","culture"]',
      'ตอบ JSON เดียว พร้อมช่อง "explain" อธิบายสั้นๆ เป็นภาษาไทยว่าตีความอย่างไร'
    ].join('\n');
    var g = geminiGenerate([{ text: prompt }], 0);
    aiLog(ctx, '', 'search', g.model, q, g.json, '', '');
    return g.json;
  },

  /** ร่างคำบรรยายลักษณะทางพฤกษศาสตร์จากช่องที่เลือก */
  aiDescribe: function (d, ctx) {
    aiCheckQuota(ctx, 'describe');
    var sp = d.species || {};
    var facts = {};
    speciesEditFields().forEach(function (k) {
      if (k.indexOf('use_') === 0 || k === 'description' || k === 'references' || k === 'info_source') return;
      var v = Array.isArray(sp[k]) ? sp[k].join(', ') : str(sp[k]);
      if (v) facts[k] = v;
    });
    if (Object.keys(facts).length < 3) fail('กรอกลักษณะอย่างน้อย 3 ช่องก่อน แล้วให้ AI ช่วยร่าง');
    var prompt = [
      'TASK: describe',
      'เขียนคำบรรยายลักษณะทางพฤกษศาสตร์ภาษาไทยแบบวิชาการ 1 ย่อหน้า (ลำต้น ใบ ดอก ผล เมล็ด ตามลำดับ)',
      'ใช้เฉพาะข้อมูลต่อไปนี้ ห้ามเพิ่มลักษณะที่ไม่ได้ระบุ:',
      JSON.stringify(facts),
      'ตอบเป็น JSON: {"description":"..."}'
    ].join('\n');
    var g = geminiGenerate([{ text: prompt }], 0.3);
    aiLog(ctx, '', 'describe', g.model, sp.thai_name || '', g.json, '', '');
    return { description: str(g.json.description) };
  }
};
