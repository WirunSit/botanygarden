/**
 * forms.js — นิยามคำถาม/ช่องข้อมูล (อิงแบบ ก.7-003) ใช้ร่วมกันทั้ง Wizard หน้าแสดงผล และหน้าตรวจงาน
 */
var Forms = (function () {
  var SPECIES_LABELS = {
    thai_name: 'ชื่อไทย (ชื่อทางการ)', local_name: 'ชื่อพื้นเมือง', common_name: 'ชื่อสามัญ', scientific_name: 'ชื่อวิทยาศาสตร์',
    genus: 'สกุล', species_epithet: 'คำระบุชนิด', author: 'ชื่อผู้ตั้ง', family: 'วงศ์', order: 'อันดับ', class: 'ชั้น', division: 'หมวด/ส่วน',
    synonyms: 'ชื่อพ้อง', origin: 'ถิ่นกำเนิด', distribution: 'การกระจายพันธุ์', conservation_status: 'สถานภาพการอนุรักษ์',
    habit: 'ลักษณะวิสัย', bark: 'ลักษณะเปลือก', bark_color: 'สีเปลือก', latex: 'น้ำยาง', branching: 'การแตกกิ่ง',
    leaf_type: 'ชนิดของใบ', leaf_arrangement: 'การเรียงตัวของใบ', leaf_shape: 'รูปร่างแผ่นใบ', leaf_apex: 'ปลายใบ', leaf_base: 'โคนใบ',
    leaf_margin: 'ขอบใบ', leaf_venation: 'เส้นใบ', leaf_texture: 'เนื้อใบ', leaf_hair: 'ขนบนใบ', leaf_width_cm: 'ความกว้างใบ (ซม.)',
    leaf_length_cm: 'ความยาวใบ (ซม.)', flower_type: 'ลักษณะการออกดอก', flower_color: 'สีดอก', petal_count: 'จำนวนกลีบดอก',
    symmetry: 'สมมาตรของดอก', flower_position: 'ตำแหน่งที่ออกดอก', scent: 'กลิ่น', flowering_season: 'ช่วงออกดอก',
    fruit_type: 'ชนิดผล', fruit_color: 'สีผล', fruit_size: 'ขนาดผล', fruiting_season: 'ช่วงติดผล',
    seed_count: 'จำนวนเมล็ดต่อผล', seed_shape: 'รูปร่างเมล็ด', seed_color: 'สีเมล็ด', description: 'คำบรรยายลักษณะทางพฤกษศาสตร์',
    use_food: 'อาหาร', use_medicine: 'ยารักษาโรค', use_construction: 'ก่อสร้าง เครื่องเรือน เครื่องใช้', use_pesticide: 'ยาฆ่าแมลง ยาปราบศัตรูพืช',
    use_culture: 'ประเพณี วัฒนธรรม ความเชื่อ', use_other: 'อื่นๆ (เช่น ความเป็นพิษ อันตราย)', info_source: 'ผู้ให้ข้อมูล / แหล่งข้อมูล',
    references: 'เอกสารอ้างอิง', species_code: 'รหัสชนิด (YYY)',
    wood_density: 'ความหนาแน่นเนื้อไม้ (ก./ลบ.ซม.) ใช้คำนวณคาร์บอน'
  };

  var TREE_LABELS = {
    gps: 'ตำแหน่ง (พิกัด)', lat: 'ละติจูด', lng: 'ลองจิจูด', gps_accuracy_m: 'ความคลาดเคลื่อน GPS', zone_id: 'โซน',
    height_m: 'ความสูง (ม.)', gbh_cm: 'เส้นรอบวงที่ระดับอก (ซม.)', dbh_cm: 'เส้นผ่านศูนย์กลางที่ระดับอก (ซม.)', canopy_m: 'ความกว้างทรงพุ่ม (ม.)',
    age_est: 'อายุโดยประมาณ', planting_source: 'ที่มาของต้น', health: 'สุขภาพ', label_status: 'สถานะป้ายชื่อ', notes: 'หมายเหตุ',
    photos: 'รูปถ่าย', species: 'การระบุชนิด', tree_code: 'รหัสประจำต้น'
  };

  var PHOTO_PARTS = [
    { key: 'whole', label: 'ทั้งต้น', tip: 'ถอยออกไปให้เห็นทั้งต้นตั้งแต่โคนถึงยอด', icon: '🌳' },
    { key: 'bark', label: 'ลำต้น/เปลือก', tip: 'ถ่ายใกล้ๆ ระดับอก วางไม้บรรทัดเทียบขนาด', icon: '🪵', scale: true },
    { key: 'leaf_top', label: 'ใบ ด้านบน', tip: 'วางใบบนพื้นสีเรียบ เช่น กระดาษขาว', icon: '🍃' },
    { key: 'leaf_bottom', label: 'ใบ ด้านล่าง', tip: 'พลิกใบเดียวกันถ่ายอีกด้าน', icon: '🍂' },
    { key: 'leaf_arrangement', label: 'การเรียงตัวของใบบนกิ่ง', tip: 'ถ่ายกิ่งที่มีใบหลายใบ', icon: '🌿' },
    { key: 'flower', label: 'ดอก', tip: 'ถ้ามี — ถ่ายด้านหน้าและด้านข้าง', icon: '🌼' },
    { key: 'inflorescence', label: 'ช่อดอก', tip: 'ถ้ามี — ถ่ายให้เห็นทั้งช่อ', icon: '💐' },
    { key: 'fruit', label: 'ผล', tip: 'ถ้ามี — ผ่าครึ่งถ่ายด้านในด้วยถ้าทำได้', icon: '🍎' },
    { key: 'seed', label: 'เมล็ด', tip: 'ถ้ามี — วางเทียบกับไม้บรรทัด', icon: '🌰', scale: true },
    { key: 'other', label: 'อื่นๆ', tip: 'หนาม น้ำยาง รากค้ำจุน ฯลฯ (ไม่บังคับ)', icon: '📎' }
  ];

  /**
   * คำถามขั้นที่ 5 — ทีละหน้า
   * type: 'choice' (เลือกจากรูป), 'multi' (เลือกได้หลายข้อ), 'group' (ช่องกรอกหลายช่อง), 'describe'
   */
  var QUESTIONS = [
    { section: 'ชื่อพรรณไม้', type: 'group', q: 'พรรณไม้นี้ชื่ออะไร?', note: 'กรอกเท่าที่รู้ ถ้าไม่รู้ชื่อวิทยาศาสตร์ ครูจะช่วยเติมให้', fields: [
      { key: 'thai_name', ph: 'เช่น ราชพฤกษ์' }, { key: 'local_name', ph: 'เช่น คูน, ลมแล้ง (คั่นด้วยจุลภาค)' },
      { key: 'common_name', ph: 'เช่น Golden shower' }, { key: 'scientific_name', ph: 'เช่น Cassia fistula L.', cls: 'sci' },
      { key: 'family', ph: 'เช่น Fabaceae' }, { key: 'origin', list: 'origin' }] },
    { section: 'ลักษณะวิสัย', key: 'habit', type: 'choice', list: 'habit', q: 'ต้นนี้เติบโตแบบไหน?' },
    { section: 'ลำต้น', key: 'bark', type: 'choice', list: 'bark', q: 'เปลือกลำต้นเป็นแบบไหน?', hint: 'ดูรูปเปลือกที่ถ่ายไว้ประกอบ' },
    { section: 'ลำต้น', key: 'latex', type: 'choice', list: 'latex', q: 'มีน้ำยางไหม?', hint: 'ดูจากรอยแผลเดิมหรือก้านใบที่ร่วง ไม่ต้องทำให้ต้นไม้เป็นแผล' },
    { section: 'ลำต้น', type: 'group', q: 'สีเปลือกและการแตกกิ่ง', fields: [
      { key: 'bark_color', ph: 'เช่น เทาอมน้ำตาล' }, { key: 'branching', ph: 'เช่น แตกกิ่งต่ำ เรือนยอดกลม' }] },
    { section: 'ใบ', key: 'leaf_type', type: 'choice', list: 'leaf_type', q: 'ใบเป็นใบเดี่ยวหรือใบประกอบ?', hint: 'ใบประกอบ: มีตาข้าง (ตาที่ซอกใบ) แค่ที่โคนก้านใหญ่ ไม่มีที่โคนใบย่อย' },
    { section: 'ใบ', key: 'leaf_arrangement', type: 'choice', list: 'leaf_arrangement', q: 'ใบเรียงตัวบนกิ่งแบบไหน?' },
    { section: 'ใบ', key: 'leaf_shape', type: 'choice', list: 'leaf_shape', q: 'แผ่นใบ (หรือใบย่อย) มีรูปร่างแบบไหน?' },
    { section: 'ใบ', key: 'leaf_apex', type: 'choice', list: 'leaf_apex', q: 'ปลายใบเป็นแบบไหน?' },
    { section: 'ใบ', key: 'leaf_base', type: 'choice', list: 'leaf_base', q: 'โคนใบเป็นแบบไหน?' },
    { section: 'ใบ', key: 'leaf_margin', type: 'choice', list: 'leaf_margin', q: 'ขอบใบเป็นแบบไหน?' },
    { section: 'ใบ', key: 'leaf_venation', type: 'choice', list: 'leaf_venation', q: 'เส้นใบเป็นแบบไหน?' },
    { section: 'ใบ', key: 'leaf_texture', type: 'choice', list: 'leaf_texture', q: 'จับใบดู เนื้อใบเป็นอย่างไร?' },
    { section: 'ใบ', key: 'leaf_hair', type: 'choice', list: 'leaf_hair', q: 'ใบมีขนไหม?' },
    { section: 'ใบ', type: 'group', q: 'ขนาดใบ (วัดใบที่โตเต็มที่ 1 ใบ)', fields: [
      { key: 'leaf_width_cm', type: 'number', ph: 'ซม.' }, { key: 'leaf_length_cm', type: 'number', ph: 'ซม.' }] },
    { section: 'ดอก', key: 'flower_type', type: 'choice', list: 'flower_type', q: 'ดอกออกแบบไหน?', skip: 'ตอนนี้ต้นนี้ไม่มีดอก ข้ามหมวดดอก' },
    { section: 'ดอก', key: 'flower_color', type: 'multi', list: 'color', q: 'ดอกสีอะไร? (เลือกได้หลายสี)' },
    { section: 'ดอก', key: 'symmetry', type: 'choice', list: 'symmetry', q: 'ดอกสมมาตรแบบไหน?' },
    { section: 'ดอก', key: 'flower_position', type: 'choice', list: 'flower_position', q: 'ดอกออกที่ตำแหน่งไหน?' },
    { section: 'ดอก', key: 'scent', type: 'choice', list: 'scent', q: 'ดอกมีกลิ่นไหม?' },
    { section: 'ดอก', type: 'group', q: 'จำนวนกลีบดอก', fields: [{ key: 'petal_count', ph: 'เช่น 5' }] },
    { section: 'ดอก', key: 'flowering_season', type: 'multi', list: 'month', q: 'ออกดอกช่วงเดือนไหน? (ถ้ารู้)' },
    { section: 'ผล', key: 'fruit_type', type: 'choice', list: 'fruit_type', q: 'ผลเป็นแบบไหน?', skip: 'ตอนนี้ต้นนี้ไม่มีผล ข้ามหมวดผล' },
    { section: 'ผล', key: 'fruit_color', type: 'multi', list: 'color', q: 'ผลสีอะไร? (เลือกได้หลายสี)' },
    { section: 'ผล', type: 'group', q: 'ขนาดผล', fields: [{ key: 'fruit_size', ph: 'เช่น ยาว 30–60 ซม. กว้าง 2 ซม.' }] },
    { section: 'ผล', key: 'fruiting_season', type: 'multi', list: 'month', q: 'ติดผลช่วงเดือนไหน? (ถ้ารู้)' },
    { section: 'เมล็ด', type: 'group', q: 'เมล็ด (ถ้ามี)', skip: 'ไม่มีเมล็ดให้ดู ข้าม', fields: [
      { key: 'seed_count', ph: 'เช่น 40–100' }, { key: 'seed_shape', ph: 'เช่น รูปไข่ แบน' }, { key: 'seed_color', ph: 'เช่น น้ำตาลเข้ม' }] },
    { section: 'การใช้ประโยชน์', type: 'group', q: 'พรรณไม้นี้นำไปใช้ประโยชน์อะไรได้บ้าง?',
      note: 'สัมภาษณ์ผู้ปกครอง/ปราชญ์ชุมชน หรือค้นจากหนังสือ — ต้องระบุแหล่งข้อมูลทุกครั้ง', fields: [
        { key: 'use_food', type: 'textarea', ph: 'ส่วนที่ใช้ + วิธีใช้' }, { key: 'use_medicine', type: 'textarea' },
        { key: 'use_construction', type: 'textarea' }, { key: 'use_pesticide', type: 'textarea' },
        { key: 'use_culture', type: 'textarea' }, { key: 'use_other', type: 'textarea' },
        { key: 'info_source', ph: 'เช่น คุณยายสมใจ (ผู้ปกครอง), หนังสือ...' }, { key: 'references', type: 'textarea', ph: 'ชื่อหนังสือ/เว็บไซต์' }] },
    { section: 'อนุกรมวิธาน', type: 'group', q: 'ข้อมูลอนุกรมวิธาน (ไม่บังคับ)', note: 'ครูหรือหัวหน้ากลุ่มช่วยเติมได้ภายหลัง', fields: [
      { key: 'genus', cls: 'sci' }, { key: 'species_epithet', cls: 'sci' }, { key: 'author' }, { key: 'order' }, { key: 'class' },
      { key: 'division' }, { key: 'synonyms', cls: 'sci' }, { key: 'distribution', type: 'textarea' }, { key: 'conservation_status' },
      { key: 'wood_density', type: 'number', ph: 'เช่น 0.65 (ถ้าไม่ทราบ เว้นว่าง)' }] },
    { section: 'คำบรรยาย', type: 'describe', key: 'description', q: 'คำบรรยายลักษณะทางพฤกษศาสตร์' }
  ];

  /** หมวดสำหรับแสดงผลในหน้าข้อมูล */
  var DISPLAY_SECTIONS = [
    { title: 'ชื่อและอนุกรมวิธาน', keys: ['thai_name', 'local_name', 'common_name', 'scientific_name', 'family', 'genus', 'species_epithet', 'author', 'order', 'class', 'division', 'synonyms', 'origin', 'distribution', 'conservation_status'] },
    { title: 'ลำต้น', keys: ['habit', 'bark', 'bark_color', 'latex', 'branching', 'wood_density'] },
    { title: 'ใบ', keys: ['leaf_type', 'leaf_arrangement', 'leaf_shape', 'leaf_apex', 'leaf_base', 'leaf_margin', 'leaf_venation', 'leaf_texture', 'leaf_hair', 'leaf_width_cm', 'leaf_length_cm'] },
    { title: 'ดอก', keys: ['flower_type', 'flower_color', 'petal_count', 'symmetry', 'flower_position', 'scent', 'flowering_season'] },
    { title: 'ผลและเมล็ด', keys: ['fruit_type', 'fruit_color', 'fruit_size', 'fruiting_season', 'seed_count', 'seed_shape', 'seed_color'] }
  ];
  var USE_KEYS = ['use_food', 'use_medicine', 'use_construction', 'use_pesticide', 'use_culture', 'use_other', 'info_source', 'references'];

  function label(key) { return SPECIES_LABELS[key] || TREE_LABELS[key] || key; }

  /** dl.kv ของข้อมูลชนิด เฉพาะช่องที่มีค่า */
  function speciesKv(sp, keys, comments) {
    var rows = keys.filter(function (k) { return sp[k] !== '' && sp[k] !== null && sp[k] !== undefined; });
    if (!rows.length) return '';
    return '<dl class="kv">' + rows.map(function (k) {
      var v = esc(sp[k]);
      if (k === 'scientific_name' || k === 'genus' || k === 'species_epithet' || k === 'synonyms') v = '<span class="sci">' + v + '</span>';
      return '<dt>' + esc(label(k)) + '</dt><dd>' + v.replace(/\n/g, '<br>') + fieldComments(comments, k) + '</dd>';
    }).join('') + '</dl>';
  }

  function fieldComments(comments, key) {
    if (!comments) return '';
    return comments.filter(function (c) { return c.field === key && c.comment; })
      .map(function (c) { return '<span class="field-comment">💬 ' + esc(c.comment) + '</span>'; }).join('');
  }

  return {
    SPECIES_LABELS: SPECIES_LABELS, TREE_LABELS: TREE_LABELS, PHOTO_PARTS: PHOTO_PARTS, QUESTIONS: QUESTIONS,
    DISPLAY_SECTIONS: DISPLAY_SECTIONS, USE_KEYS: USE_KEYS, label: label, speciesKv: speciesKv, fieldComments: fieldComments,
    PLANT_PARTS: PHOTO_PARTS.map(function (p) { return p.key; }),
    partLabel: function (k) {
      var p = PHOTO_PARTS.filter(function (x) { return x.key === k; })[0];
      return p ? p.label : ({ phenology: 'ชีพลักษณ์', fauna: 'สิ่งมีชีวิตร่วม', issue: 'แจ้งปัญหา', herbarium: 'ตัวอย่างแห้ง' }[k] || k);
    }
  };
})();
