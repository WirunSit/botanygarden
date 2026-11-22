/**
 * Setup.gs — ตั้งค่าครั้งแรก, เมนูในชีต, สำรองข้อมูลอัตโนมัติ
 *
 * วิธีใช้ครั้งแรก: เลือกฟังก์ชัน setup แล้วกด "เรียกใช้" (Run) ในหน้า Apps Script
 */

/** รายการตัวเลือก [ค่า(ไทย), อังกฤษ, คำอธิบาย] — icon สร้างอัตโนมัติจากชื่อรายการ/ชื่ออังกฤษ */
var DEFAULT_LISTS = {
  habit: [
    ['ไม้ต้น', 'Tree', 'ลำต้นเดี่ยวชัดเจน สูงเกิน 3–5 เมตร'],
    ['ไม้พุ่ม', 'Shrub', 'แตกกิ่งจากโคนหลายลำ สูงไม่เกิน 3–5 เมตร'],
    ['ไม้ล้มลุก', 'Herb', 'ลำต้นอ่อน ไม่มีเนื้อไม้'],
    ['ไม้เลื้อย', 'Climber', 'ลำต้นพันหรือเกาะสิ่งอื่นขึ้นไป'],
    ['ไม้รอเลื้อย', 'Scandent', 'ลำต้นตั้งตรงได้ระยะหนึ่งแล้วพาดพิงต้นอื่น'],
    ['ปาล์ม', 'Palm', 'ลำต้นเดี่ยว ใบใหญ่ออกที่ยอด'],
    ['ไผ่', 'Bamboo', 'ลำต้นเป็นปล้อง ขึ้นเป็นกอ'],
    ['เฟิร์น', 'Fern', 'ไม่มีดอก สืบพันธุ์ด้วยสปอร์'],
    ['กล้วยไม้', 'Orchid', 'พืชวงศ์กล้วยไม้ ทั้งอิงอาศัยและบนดิน']
  ],
  bark: [
    ['เรียบ', 'Smooth', ''], ['แตกเป็นร่อง', 'Fissured', 'มีร่องตามยาว'], ['ล่อนเป็นแผ่น', 'Flaking', 'เปลือกหลุดลอกเป็นแผ่น'],
    ['ขรุขระ', 'Rough', ''], ['มีหนาม', 'Spiny', ''], ['มีช่องอากาศ', 'Lenticellate', 'มีจุดหรือขีดนูนเล็กๆ']
  ],
  latex: [['ไม่มี', 'None', ''], ['น้ำยางสีขาว', 'White latex', ''], ['น้ำยางสีเหลือง', 'Yellow latex', ''],
    ['น้ำยางใส', 'Clear sap', ''], ['น้ำยางสีแดง', 'Red sap', '']],
  leaf_type: [
    ['ใบเดี่ยว', 'Simple', 'ก้านใบหนึ่งก้านมีแผ่นใบเดียว'],
    ['ใบประกอบแบบขนนกชั้นเดียว', 'Pinnate', 'ใบย่อยเรียงสองข้างของแกนกลาง'],
    ['ใบประกอบแบบขนนกสองชั้น', 'Bipinnate', 'แกนกลางแตกแขนงอีกชั้นก่อนมีใบย่อย'],
    ['ใบประกอบแบบนิ้วมือ', 'Palmate compound', 'ใบย่อยออกจากปลายก้านจุดเดียว'],
    ['ใบประกอบแบบสามใบ', 'Trifoliate', 'มีใบย่อย 3 ใบ']
  ],
  leaf_arrangement: [
    ['เรียงสลับ', 'Alternate', 'ข้อละ 1 ใบ สลับข้าง'],
    ['เรียงตรงข้าม', 'Opposite', 'ข้อละ 2 ใบ อยู่ตรงข้ามกัน'],
    ['เรียงตรงข้ามสลับตั้งฉาก', 'Decussate', 'คู่ใบแต่ละข้อหมุน 90 องศา'],
    ['เรียงรอบข้อ', 'Whorled', 'ข้อละ 3 ใบขึ้นไป'],
    ['เรียงเป็นกระจุก', 'Clustered', 'ใบออกเป็นกลุ่มที่ปลายกิ่ง']
  ],
  leaf_shape: [
    ['รูปไข่', 'Ovate', 'กว้างที่สุดค่อนไปทางโคนใบ'], ['รูปรี', 'Elliptic', 'กว้างที่สุดตรงกลาง'],
    ['รูปใบหอก', 'Lanceolate', 'แคบยาว ปลายเรียว'], ['รูปหัวใจ', 'Cordate', 'โคนเว้าเป็นรูปหัวใจ'],
    ['รูปขอบขนาน', 'Oblong', 'ขอบสองข้างเกือบขนานกัน'], ['รูปไข่กลับ', 'Obovate', 'กว้างที่สุดค่อนไปทางปลายใบ'],
    ['รูปแถบ', 'Linear', 'แคบยาวมาก ขอบขนาน'], ['รูปกลม', 'Orbicular', 'เกือบกลม'],
    ['รูปฝ่ามือ', 'Palmately lobed', 'เว้าเป็นแฉกคล้ายนิ้วมือ']
  ],
  leaf_apex: [
    ['แหลม', 'Acute', ''], ['เรียวแหลม', 'Acuminate', 'ปลายค่อยๆ เรียวยาว'], ['มน', 'Obtuse', ''],
    ['กลม', 'Rounded', ''], ['เว้าบุ๋ม', 'Emarginate', 'ปลายเว้าลงเล็กน้อย'], ['เป็นติ่งหนาม', 'Mucronate', 'มีติ่งแหลมสั้นที่ปลาย']
  ],
  leaf_base: [
    ['รูปลิ่ม', 'Cuneate', 'สอบแคบเป็นรูปตัววี'], ['มน', 'Obtuse', ''], ['กลม', 'Rounded', ''],
    ['รูปหัวใจ', 'Cordate', 'เว้าเข้า'], ['ตัด', 'Truncate', 'ตรงเป็นเส้นตรง'], ['เบี้ยว', 'Oblique', 'สองข้างไม่เท่ากัน']
  ],
  leaf_margin: [
    ['เรียบ', 'Entire', ''], ['จักฟันเลื่อย', 'Serrate', 'ฟันแหลมชี้ไปทางปลายใบ'], ['จักฟันซี่', 'Dentate', 'ฟันแหลมชี้ออกนอก'],
    ['จักมน', 'Crenate', 'ฟันมนกลม'], ['เป็นคลื่น', 'Undulate', ''], ['เว้าเป็นแฉก', 'Lobed', '']
  ],
  leaf_venation: [
    ['แบบร่างแหขนนก', 'Pinnate', 'เส้นกลางใบหนึ่งเส้น มีเส้นแขนงสองข้าง'],
    ['แบบร่างแหนิ้วมือ', 'Palmate', 'เส้นใบหลายเส้นออกจากโคนใบ'],
    ['แบบขนาน', 'Parallel', 'เส้นใบขนานกันตลอดแผ่นใบ (พืชใบเลี้ยงเดี่ยว)']
  ],
  leaf_texture: [['บาง', 'Membranous', ''], ['คล้ายกระดาษ', 'Chartaceous', ''], ['คล้ายแผ่นหนัง', 'Coriaceous', 'หนาและเหนียว'], ['อวบน้ำ', 'Succulent', '']],
  leaf_hair: [['เกลี้ยง', 'Glabrous', 'ไม่มีขน'], ['มีขนด้านบน', 'Hairy above', ''], ['มีขนด้านล่าง', 'Hairy below', ''], ['มีขนทั้งสองด้าน', 'Hairy both sides', '']],
  flower_type: [
    ['ดอกเดี่ยว', 'Solitary', ''], ['ช่อกระจะ', 'Raceme', 'ดอกมีก้าน เรียงบนแกนช่อที่ไม่แตกแขนง'],
    ['ช่อเชิงลด', 'Spike', 'ดอกไม่มีก้าน ติดบนแกนช่อ'], ['ช่อแยกแขนง', 'Panicle', 'แกนช่อแตกแขนงหลายครั้ง'],
    ['ช่อซี่ร่ม', 'Umbel', 'ก้านดอกออกจากจุดเดียวกัน'], ['ช่อกระจุกแน่น', 'Head', 'ดอกเล็กอัดแน่นบนฐานรองดอก'],
    ['ช่อเชิงหลั่น', 'Corymb', 'ก้านดอกยาวไม่เท่ากัน แต่ดอกอยู่ระดับเดียวกัน'], ['ช่อกระจุก', 'Cyme', 'ดอกกลางบานก่อน']
  ],
  color: [
    ['ขาว', 'White', '#ffffff'], ['ครีม', 'Cream', '#f3e9c6'], ['เหลือง', 'Yellow', '#f2c500'], ['ส้ม', 'Orange', '#f08a24'],
    ['แดง', 'Red', '#d62828'], ['ชมพู', 'Pink', '#f27ca8'], ['ม่วง', 'Purple', '#8e44ad'], ['น้ำเงิน/ฟ้า', 'Blue', '#3a7bd5'],
    ['เขียว', 'Green', '#4caf50'], ['น้ำตาล', 'Brown', '#8d5b3a'], ['ดำ', 'Black', '#222222']
  ],
  symmetry: [['สมมาตรตามรัศมี', 'Actinomorphic', 'แบ่งได้หลายแนวเหมือนดาว'], ['สมมาตรด้านข้าง', 'Zygomorphic', 'แบ่งได้แนวเดียว เช่น ดอกถั่ว']],
  flower_position: [['ปลายกิ่ง', 'Terminal', ''], ['ซอกใบ', 'Axillary', ''], ['ตามลำต้นและกิ่ง', 'Cauliflorous', '']],
  scent: [['ไม่มีกลิ่น', 'None', ''], ['หอมอ่อน', 'Mild', ''], ['หอมแรง', 'Strong', ''], ['กลิ่นเหม็น', 'Unpleasant', '']],
  month: [['ม.ค.', 'Jan', ''], ['ก.พ.', 'Feb', ''], ['มี.ค.', 'Mar', ''], ['เม.ย.', 'Apr', ''], ['พ.ค.', 'May', ''], ['มิ.ย.', 'Jun', ''],
    ['ก.ค.', 'Jul', ''], ['ส.ค.', 'Aug', ''], ['ก.ย.', 'Sep', ''], ['ต.ค.', 'Oct', ''], ['พ.ย.', 'Nov', ''], ['ธ.ค.', 'Dec', '']],
  fruit_type: [
    ['ผลมีเนื้อหลายเมล็ด', 'Berry', 'เช่น มะเขือเทศ ฝรั่ง'], ['ผลมีเมล็ดแข็ง', 'Drupe', 'เช่น มะม่วง มะพร้าว'],
    ['ฝักแตกสองตะเข็บ', 'Legume', 'ผลแห้งแบบฝักถั่ว'], ['ผลแห้งแตก', 'Capsule', 'แตกได้หลายพู'],
    ['ผลมีปีก', 'Samara', 'ผลแห้งไม่แตก มีปีก'], ['ผลแห้งเมล็ดล่อน', 'Achene', 'ผลเล็ก มีเมล็ดเดียว'],
    ['ผลกลุ่ม', 'Aggregate', 'จากดอกเดียวที่มีหลายรังไข่'], ['ผลรวม', 'Multiple', 'จากหลายดอกรวมกัน เช่น ขนุน สับปะรด'],
    ['ผลแบบส้ม', 'Hesperidium', ''], ['ผลแบบแตง', 'Pepo', '']
  ],
  health: [['ดี', 'Good', ''], ['ปานกลาง', 'Fair', ''], ['มีโรค-แมลง', 'Pest/disease', ''], ['ใกล้ตาย', 'Dying', ''], ['ตาย', 'Dead', '']],
  planting_source: [['ปลูกเอง', 'Planted', ''], ['ขึ้นเอง', 'Natural', ''], ['ได้รับบริจาค', 'Donated', ''], ['ไม่ทราบ', 'Unknown', '']],
  label_status: [['ยังไม่มีป้าย', 'None', ''], ['ติดป้ายร่าง', 'Draft label', ''], ['ติดป้ายสมบูรณ์', 'Complete label', ''], ['ป้ายชำรุด', 'Damaged', '']],
  origin: [['พืชพื้นเมือง', 'Native', ''], ['พืชต่างถิ่น', 'Introduced', ''], ['ไม่ทราบ', 'Unknown', '']],
  pheno_level: [['ไม่มี', 'None', ''], ['น้อย', 'Few', 'น้อยกว่า 1 ใน 4 ของทรงพุ่ม'], ['ปานกลาง', 'Moderate', 'ประมาณ 1/4–3/4 ของทรงพุ่ม'], ['มาก', 'Many', 'มากกว่า 3/4 ของทรงพุ่ม']],
  issue_type: [['โรคพืช', 'Disease', 'ใบเป็นจุด เหี่ยว เน่า มีเชื้อรา'], ['แมลงศัตรูพืช', 'Pest', 'หนอน เพลี้ย ปลวก'], ['กิ่งหัก/กิ่งแห้ง', 'Broken branch', ''],
    ['ต้นเอียง/เสี่ยงล้ม', 'Leaning', 'อันตราย ควรแจ้งครูทันที'], ['ต้นตาย', 'Dead', ''], ['ป้ายชื่อชำรุด/หาย', 'Label damaged', ''], ['อื่นๆ', 'Other', '']],
  care_type: [['รดน้ำ', 'Watering', ''], ['ใส่ปุ๋ย', 'Fertilizing', ''], ['ตัดแต่งกิ่ง', 'Pruning', ''], ['กำจัดศัตรูพืช', 'Pest control', ''],
    ['พรวนดิน/คลุมโคน', 'Mulching', ''], ['ย้ายปลูก', 'Transplanting', ''], ['ค้ำยัน', 'Staking', ''], ['อื่นๆ', 'Other', '']],
  fauna_type: [['นก', 'Bird', ''], ['ผีเสื้อ/มอธ', 'Butterfly/Moth', ''], ['แมลงอื่นๆ', 'Insect', ''], ['มด/ปลวก', 'Ant/Termite', ''],
    ['แมงมุม', 'Spider', ''], ['สัตว์เลื้อยคลาน', 'Reptile', 'จิ้งจก กิ้งก่า งู'], ['สัตว์สะเทินน้ำสะเทินบก', 'Amphibian', 'กบ เขียด'],
    ['สัตว์เลี้ยงลูกด้วยนม', 'Mammal', 'กระรอก ค้างคาว'], ['เห็ด/รา', 'Fungus', ''], ['ไลเคน', 'Lichen', ''], ['มอส', 'Moss', ''],
    ['พืชอิงอาศัย', 'Epiphyte', 'กล้วยไม้ เฟิร์นที่เกาะบนต้น'], ['พืชกาฝาก', 'Parasitic plant', ''], ['อื่นๆ', 'Other', '']]
};

var ICON_LISTS = ['habit', 'leaf_type', 'leaf_arrangement', 'leaf_shape', 'leaf_apex', 'leaf_base', 'leaf_margin',
  'leaf_venation', 'flower_type', 'bark', 'fruit_type', 'symmetry'];

function defaultListRows() {
  var rows = [];
  Object.keys(DEFAULT_LISTS).forEach(function (list) {
    DEFAULT_LISTS[list].forEach(function (it, i) {
      var icon = '';
      var hint = it[2];
      if (list === 'color') { icon = it[2]; hint = ''; }
      else if (ICON_LISTS.indexOf(list) >= 0) icon = list + '/' + it[1].toLowerCase().replace(/[^a-z]+/g, '_');
      rows.push({ list: list, value: it[0], label_en: it[1], icon: icon, hint: hint, order: i + 1 });
    });
  });
  return rows;
}

/** สร้างชีต หัวคอลัมน์ ค่าตั้งต้น รายการตัวเลือก และบัญชีผู้ดูแลระบบ (รันซ้ำได้ ไม่ลบข้อมูลเดิม) */
function setupCore() {
  Object.keys(SCHEMA).forEach(function (name) { Platform.ensureSheet(name, SCHEMA[name]); });
  DB.reset();

  var have = {};
  DB.all('Settings').forEach(function (r) { have[r.key] = true; });
  var newSettings = DEFAULT_SETTINGS.filter(function (s) { return !have[s[0]]; })
    .map(function (s) { return { key: s[0], value: s[1], note: s[2] }; });
  if (newSettings.length) Platform.appendRows('Settings', DB.headers('Settings'), newSettings);

  // เพิ่มเฉพาะรายการตัวเลือกที่ยังไม่มี (ไม่ทับรายการที่ครูแก้ไว้)
  var haveLists = {};
  DB.all('Lists').forEach(function (r) { haveLists[r.list] = true; });
  var newLists = defaultListRows().filter(function (r) { return !haveLists[r.list]; });
  if (newLists.length) Platform.appendRows('Lists', DB.headers('Lists'), newLists);

  DB.reset();
  if (DB.find('Settings', 'key', 'schema_version')) DB.update('Settings', 'key', 'schema_version', { value: SCHEMA_VERSION });
  else DB.insert('Settings', { key: 'schema_version', value: SCHEMA_VERSION, note: 'เวอร์ชันโครงสร้างชีต (ระบบตั้งเอง ไม่ต้องแก้)' });
  var msg = [];
  if (!DB.filter('Users', function (u) { return u.role === 'admin'; }).length) {
    DB.insert('Users', {
      user_id: DB.nextId('Users', 'user_id', 'U', 4), username: 'admin', full_name: 'ครูผู้ดูแลระบบ',
      role: 'admin', status: 'active', points: 0, created_at: nowIso()
    });
    msg.push('สร้างบัญชี admin แล้ว — เข้าสู่ระบบด้วยชื่อผู้ใช้ admin แล้วตั้งรหัสผ่านทันที');
  }
  bustCache();
  return msg;
}

// ---------------- ฟังก์ชันที่รันได้เฉพาะใน Google Apps Script ----------------

function setup() {
  var msg = setupCore();
  // จัดลำดับชีตและลบชีตว่าง "Sheet1"/"ชีต1" ถ้ามี
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(Platform.prop('SHEET_ID'));
  ['Sheet1', 'ชีต1', 'แผ่นงาน1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  // สร้างโฟลเดอร์รูปหลักตั้งแต่ตอนนี้ (และทดสอบสิทธิ์ Drive)
  DriveApp.getFolderById(Platform.createFolder('_ทดสอบสิทธิ์')).setTrashed(true);
  var root = DriveApp.getFolderById(Platform.prop('PHOTO_FOLDER_ID'));
  msg.push('ตั้งค่าเสร็จแล้ว โฟลเดอร์รูป: ' + root.getUrl());
  Logger.log(msg.join('\n'));
  try { SpreadsheetApp.getUi().alert(msg.join('\n\n')); } catch (e) { /* รันจากหน้าสคริปต์ */ }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🌿 พฤกษาพุทธมงคล')
    .addItem('ตั้งค่าครั้งแรก / ซ่อมชีต', 'setup')
    .addItem('สำรองข้อมูลตอนนี้', 'backupNow')
    .addItem('เปิดสำรองข้อมูลอัตโนมัติทุกคืน', 'installBackupTrigger')
    .addToUi();
}

/** คัดลอกไฟล์ชีตไปโฟลเดอร์ Backup และลบสำเนาที่เก่ากว่า 30 วัน */
function backupNow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(Platform.prop('SHEET_ID'));
  var file = DriveApp.getFileById(ss.getId());
  var props = PropertiesService.getScriptProperties();
  var folder = null;
  var id = props.getProperty('BACKUP_FOLDER_ID');
  if (id) { try { folder = DriveApp.getFolderById(id); } catch (e) { folder = null; } }
  if (!folder) {
    folder = DriveApp.createFolder('BuddhamongkolFlora_Backup');
    props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  }
  file.makeCopy('Backup_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd_HHmm') + '_' + ss.getName(), folder);
  var cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getDateCreated() < cutoff) f.setTrashed(true);
  }
}

function installBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupNow') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(2).create();
  try { SpreadsheetApp.getUi().alert('ตั้งสำรองข้อมูลอัตโนมัติทุกคืนเวลาประมาณ 02:00 น. แล้ว'); } catch (e) { /* ไม่มี UI */ }
}
