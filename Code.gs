/**
 * ════════════════════════════════════════════════════════════════
 *  2325 App — หลังบ้าน (Google Apps Script)
 * ════════════════════════════════════════════════════════════════
 *
 *  ไฟล์นี้ทำ 2 หน้าที่
 *   1) สร้างและดูแลแท็บต่างๆ ใน Google Sheet
 *   2) เป็น "API" ให้หน้าแอป (LIFF) มาขอข้อมูล / บันทึกข้อมูล
 *
 *  แท็บที่ระบบสร้างให้ (เมนู ☕ 2325 App > สร้างชีตเริ่มต้น)
 *   ✏️ ตั้งค่าร้าน   ชื่อร้าน เวลาเปิด ที่อยู่ ลิงก์ Grab / LINE MAN
 *   ✏️ เมนู         เมนู ราคา รูป ติ๊ก แนะนำ / หมด / แสดง
 *   ✏️ บริการ       กติกาให้แต้มของแต่ละบริการ (คาเฟ่, Ice Bath, ...)
 *   ✏️ ของรางวัล    รางวัลและจำนวนแต้มที่ใช้แลก
 *   ✏️ พนักงาน      ใครมีสิทธิ์เพิ่มแต้ม / แลกรางวัล
 *   🔒 สมาชิก       ระบบบันทึกเอง (ล็อกไว้ แก้ด้วยมือไม่ได้)
 *   🔒 ประวัติแต้ม   ระบบบันทึกเอง (ล็อกไว้ แก้ด้วยมือไม่ได้)
 *
 *  สัญลักษณ์ในโค้ด
 *   ✏️ = แก้ได้      ⛔ = ไม่ต้องแก้
 *
 *  ⚠️ แก้โค้ดแล้วต้อง Deploy > Manage deployments > ✏️ > New version ทุกครั้ง
 */


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 1: ตั้งค่าการเชื่อมต่อ LINE   ✏️ แก้ได้ (กรอกในขั้นที่ 3)
// ════════════════════════════════════════════════════════════════

const CONFIG = {

  // Channel ID ของ LINE MINI App (ใส่ทั้งของ Developing และ Published)
  // ตัวอย่าง: ['2001234567', '2001234568']
  CHANNEL_IDS: ['2011732824', '2011732825', '2011732827'],   // Developing, Review, Published

  // การแจ้งเตือนทาง LINE: เลือกโหมดในแท็บ "ตั้งค่าร้าน" หัวข้อ "แจ้งเตือนทาง LINE"
  // (ต้องใส่ LINE_CHANNEL_ACCESS_TOKEN ใน Script Properties ก่อน)

  // ยอดบิลสูงสุดที่รับได้ต่อครั้ง (กันพนักงานพิมพ์ 0 เกิน)
  MAX_BILL_AMOUNT: 20000,

};


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 2: โครงสร้างแท็บและคอลัมน์   ⛔ ไม่ต้องแก้
//  (ระบบอ่านข้อมูลจาก "ชื่อหัวคอลัมน์" — ย้ายคอลัมน์ได้ แต่อย่าเปลี่ยนชื่อหัว)
// ════════════════════════════════════════════════════════════════

const TAB = {
  SETTINGS: 'ตั้งค่าร้าน',
  MENU: 'เมนู',
  SERVICES: 'บริการ',
  REWARDS: 'ของรางวัล',
  STAFF: 'พนักงาน',
  MEMBERS: 'สมาชิก',
  TX: 'ประวัติแต้ม',
};

const EARN_BY_AMOUNT = 'ตามยอดเงิน';
const EARN_BY_VISIT = 'ตามครั้ง';
const PUSH_MODES = ['ปิด', 'ครบแต้ม', 'ทุกบิล'];

const FIELDS = {
  [TAB.MENU]: [
    { key: 'category', label: 'หมวด', width: 110 },
    { key: 'name', label: 'ชื่อเมนู', width: 170 },
    { key: 'nameEn', label: 'ชื่ออังกฤษ', width: 150 },
    { key: 'price', label: 'ราคา', width: 70 },
    { key: 'description', label: 'คำอธิบาย', width: 220 },
    { key: 'image', label: 'รูป (ลิงก์)', width: 180 },
    { key: 'recommended', label: 'แนะนำ', checkbox: true, width: 60 },
    { key: 'soldOut', label: 'หมด', checkbox: true, width: 60 },
    { key: 'visible', label: 'แสดง', checkbox: true, width: 60 },
  ],
  [TAB.SERVICES]: [
    { key: 'id', label: 'รหัส', text: true, width: 90 },
    { key: 'name', label: 'ชื่อบริการ', width: 200 },
    { key: 'earnType', label: 'วิธีให้แต้ม', width: 110 },
    { key: 'earnValue', label: 'อัตรา', width: 70 },
    { key: 'active', label: 'เปิดใช้', checkbox: true, width: 70 },
    { key: 'note', label: 'หมายเหตุ', width: 320 },
  ],
  [TAB.REWARDS]: [
    { key: 'id', label: 'รหัส', text: true, width: 70 },
    { key: 'name', label: 'ชื่อรางวัล', width: 200 },
    { key: 'points', label: 'ใช้แต้ม', width: 70 },
    { key: 'description', label: 'คำอธิบาย', width: 260 },
    { key: 'image', label: 'รูป (ลิงก์)', width: 180 },
    { key: 'active', label: 'เปิดใช้', checkbox: true, width: 70 },
  ],
  [TAB.STAFF]: [
    { key: 'userId', label: 'LINE userId', text: true, width: 300 },
    { key: 'name', label: 'ชื่อ', width: 140 },
    { key: 'active', label: 'เปิดสิทธิ์', checkbox: true, width: 80 },
  ],
  [TAB.MEMBERS]: [
    { key: 'memberId', label: 'รหัสสมาชิก', text: true, width: 95 },
    { key: 'userId', label: 'LINE userId', text: true, width: 150 },
    { key: 'displayName', label: 'ชื่อเล่น', width: 120 },
    { key: 'pictureUrl', label: 'รูปโปรไฟล์', width: 100 },
    { key: 'phone', label: 'เบอร์โทร', text: true, width: 105 },
    { key: 'birthday', label: 'วันเกิด', text: true, width: 95 },
    { key: 'points', label: 'แต้มคงเหลือ', width: 90 },
    { key: 'partial', label: 'เศษแต้ม', width: 70 },
    { key: 'lifetimePoints', label: 'แต้มสะสมทั้งหมด', width: 110 },
    { key: 'redeemCount', label: 'แลกรางวัล (ครั้ง)', width: 110 },
    { key: 'visits', label: 'มาใช้บริการ (ครั้ง)', width: 120 },
    { key: 'totalSpend', label: 'ยอดใช้จ่ายรวม', width: 105 },
    { key: 'createdAt', label: 'วันสมัคร', width: 140 },
    { key: 'lastVisit', label: 'มาล่าสุด', width: 140 },
  ],
  [TAB.TX]: [
    { key: 'timestamp', label: 'วันเวลา', width: 140 },
    { key: 'txId', label: 'รหัสรายการ', text: true, width: 110 },
    { key: 'memberId', label: 'รหัสสมาชิก', text: true, width: 95 },
    { key: 'displayName', label: 'ชื่อสมาชิก', width: 120 },
    { key: 'type', label: 'ประเภท', width: 90 },
    { key: 'service', label: 'บริการ', width: 90 },
    { key: 'amount', label: 'ยอดบิล', width: 80 },
    { key: 'receiptNo', label: 'เลขใบเสร็จ', text: true, width: 110 },
    { key: 'points', label: 'แต้ม', width: 60 },
    { key: 'balanceAfter', label: 'แต้มคงเหลือ', width: 90 },
    { key: 'reward', label: 'รางวัล', width: 160 },
    { key: 'staffName', label: 'พนักงาน', width: 110 },
    { key: 'staffUserId', label: 'userId พนักงาน', text: true, width: 150 },
  ],
};

// แท็บตั้งค่าร้าน: 1 แถว = 1 หัวข้อ (คอลัมน์ A หัวข้อ, B ค่า, C คำอธิบาย)
const SETTINGS = [
  { key: 'shopName', label: 'ชื่อร้าน', value: '2325 CAFE', help: 'แสดงบนหัวแอปและบัตรสมาชิก' },
  { key: 'tagline', label: 'สโลแกน', value: 'Indulge Yourself', help: 'ข้อความใต้ชื่อร้านหน้าแรก' },
  { key: 'announcement', label: 'ประกาศหน้าแรก', value: 'เตรียมพบกับ 2325 CAFE เร็วๆ นี้', help: 'แถบประกาศบนหน้าแรก · เว้นว่าง = ไม่แสดง' },
  { key: 'coverImage', label: 'รูปหน้าปก (ลิงก์)', value: '', help: 'ลิงก์รูปจาก Google Drive (แชร์แบบทุกคนที่มีลิงก์)' },
  { key: 'logoImage', label: 'โลโก้ (ลิงก์)', value: '', help: 'ลิงก์รูปโลโก้จาก Google Drive' },
  { key: 'openHours', label: 'เวลาเปิด-ปิด', value: 'ทุกวัน 07:00 – 17:00', help: 'พิมพ์ได้หลายบรรทัด (Ctrl+Enter / ⌘+Enter ขึ้นบรรทัดใหม่)' },
  { key: 'closedNote', label: 'วันหยุด', value: '', help: 'เช่น ปิดทุกวันพุธ · เว้นว่าง = ไม่แสดง' },
  { key: 'address', label: 'ที่อยู่', value: '', help: 'ที่อยู่ร้าน' },
  { key: 'mapUrl', label: 'ลิงก์ Google Maps', value: '', help: 'เปิด Google Maps > แชร์ > คัดลอกลิงก์' },
  { key: 'phone', label: 'เบอร์โทรร้าน', value: '', help: 'ลูกค้ากดโทรได้จากหน้าแรก' },
  { key: 'facebookUrl', label: 'ลิงก์ Facebook', value: '', help: 'เว้นว่าง = ไม่แสดง' },
  { key: 'instagramUrl', label: 'ลิงก์ Instagram', value: '', help: 'เว้นว่าง = ไม่แสดง' },
  { key: 'grabUrl', label: 'ลิงก์ร้านใน GrabFood', value: '', help: 'ปุ่มเดลิเวอรี่ · เว้นว่าง = ขึ้นว่า "เร็วๆ นี้"' },
  { key: 'linemanUrl', label: 'ลิงก์ร้านใน LINE MAN', value: '', help: 'ปุ่มเดลิเวอรี่ · เว้นว่าง = ขึ้นว่า "เร็วๆ นี้"' },
  { key: 'pushMode', label: 'แจ้งเตือนทาง LINE', value: 'ครบแต้ม', help: 'ปิด = ไม่ส่ง · ครบแต้ม = ส่งเมื่อแต้มพอแลกรางวัล (แนะนำ) · ทุกบิล = ส่งทุกครั้งที่ได้แต้ม (ใช้โควตาข้อความ OA)' },
  { key: 'memberNote', label: 'เงื่อนไขสมาชิก', value: 'สะสมแต้มเมื่อซื้อที่หน้าร้าน · แสดง QR ให้พนักงานทุกครั้งที่ชำระเงิน', help: 'แสดงในหน้าบัตรสมาชิก' },
];


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 3: ข้อมูลตัวอย่าง (ใส่ครั้งแรกตอนสร้างชีตเท่านั้น)   ✏️ แก้ได้
//  ลำดับ: หมวด, ชื่อเมนู, ชื่ออังกฤษ, ราคา, คำอธิบาย, รูป, แนะนำ, หมด, แสดง
// ════════════════════════════════════════════════════════════════

const SAMPLE_MENU = [
  ['กาแฟ', 'อเมริกาโน่', 'Americano', 55, 'ร้อน / เย็น', '', false, false, true],
  ['กาแฟ', 'ลาเต้', 'Latte', 65, 'เอสเพรสโซ่กับนมสด นุ่มละมุน', '', true, false, true],
  ['กาแฟ', 'คาปูชิโน่', 'Cappuccino', 65, 'ฟองนมแน่น หอมกาแฟ', '', false, false, true],
  ['กาแฟ', 'มอคค่า', 'Mocha', 70, 'กาแฟ ช็อกโกแลต และนมสด', '', false, false, true],
  ['กาแฟ', 'เอสเย็น', 'Thai Es Yen', 65, 'สูตรเข้มแบบไทย หวานมัน', '', true, false, true],
  ['ไม่ใช่กาแฟ', 'มัทฉะลาเต้', 'Matcha Latte', 75, 'มัทฉะแท้กับนมสด', '', true, false, true],
  ['ไม่ใช่กาแฟ', 'ชาไทย', 'Thai Tea', 55, '', '', false, false, true],
  ['ไม่ใช่กาแฟ', 'โกโก้', 'Cocoa', 65, '', '', false, false, true],
  ['อาหารเช้า', 'ไข่กระทะ', 'Thai Pan Eggs', 79, 'ไข่ดาว หมูยอ กุนเชียง ขนมปัง', '', true, false, true],
  ['อาหารเช้า', 'โจ๊กหมู', 'Rice Porridge', 59, 'ใส่ไข่ลวก +10', '', false, false, true],
  ['อาหารเช้า', 'ปาท่องโก๋ + สังขยา', 'Pa Tong Go & Custard', 49, '', '', false, false, true],
  ['อาหารเช้า', 'ขนมปังปิ้งสังขยา', 'Toast & Custard', 45, '', '', false, true, true],
];

// ลำดับ: รหัส, ชื่อบริการ, วิธีให้แต้ม, อัตรา, เปิดใช้, หมายเหตุ
const SAMPLE_SERVICES = [
  ['cafe', 'คาเฟ่ (อาหาร/เครื่องดื่ม)', EARN_BY_AMOUNT, 100, true, 'ทุก 100 บาท = 1 แต้ม (เศษสะสมไปบิลถัดไป)'],
  ['icebath', 'Ice Bath', EARN_BY_VISIT, 1, false, 'อนาคต: มาใช้ 1 ครั้ง = 1 แต้ม · ติ๊ก "เปิดใช้" เมื่อพร้อม'],
  ['sauna', 'ตู้สปาร้อน', EARN_BY_VISIT, 1, false, 'อนาคต: มาใช้ 1 ครั้ง = 1 แต้ม · ติ๊ก "เปิดใช้" เมื่อพร้อม'],
];

// ลำดับ: รหัส, ชื่อรางวัล, ใช้แต้ม, คำอธิบาย, รูป, เปิดใช้
const SAMPLE_REWARDS = [
  ['R01', 'เครื่องดื่มฟรี 1 แก้ว', 10, 'เลือกเครื่องดื่มในร้านได้ 1 แก้ว', '', true],
];


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 4: เมนูใน Google Sheet + สร้างชีตเริ่มต้น   ⛔ ไม่ต้องแก้
// ════════════════════════════════════════════════════════════════

/** สร้างแท็บทั้งหมด (รันซ้ำได้ ไม่ลบ/ไม่ทับข้อมูลเดิม) */
function setup() {
  const ss = SpreadsheetApp.getActive();
  if (!ss) {
    throw new Error('ไม่พบ Google Sheet — ต้องเปิด Apps Script จากเมนู "ส่วนขยาย > Apps Script" ภายใน Google Sheet เท่านั้น');
  }
  console.log('กำลังสร้างแท็บใน: ' + ss.getName());

  // --- ตั้งค่าร้าน ---
  let sh = ss.getSheetByName(TAB.SETTINGS);
  if (!sh) {
    sh = ss.insertSheet(TAB.SETTINGS);
    const rows = [['หัวข้อ', 'ค่า', 'คำอธิบาย']].concat(SETTINGS.map((s) => [s.label, s.value, s.help]));
    sh.getRange(1, 1, rows.length, 3).setValues(rows);
    styleHeader_(sh, 3);
    sh.getRange(2, 1, rows.length - 1, 1).setFontWeight('bold').setBackground('#F6F1E7');
    sh.getRange(2, 3, rows.length - 1, 1).setFontColor('#8A8178');
    sh.getRange(2, 2, rows.length - 1, 1).setWrap(true).setBackground('#FFFDF8');
    sh.setColumnWidth(1, 170);
    sh.setColumnWidth(2, 320);
    sh.setColumnWidth(3, 360);
  } else {
    // แท็บมีอยู่แล้ว → เพิ่มเฉพาะหัวข้อใหม่ที่ยังไม่มี (ไม่ทับค่าเดิม)
    const have = sh.getDataRange().getValues().map((r) => String(r[0]).trim());
    SETTINGS.filter((x) => have.indexOf(x.label) < 0).forEach((x) => {
      sh.appendRow([x.label, x.value, x.help]);
      const r = sh.getLastRow();
      sh.getRange(r, 1).setFontWeight('bold').setBackground('#F6F1E7');
      sh.getRange(r, 3).setFontColor('#8A8178');
    });
  }
  // dropdown โหมดแจ้งเตือน
  const pushRow = sh.getDataRange().getValues().map((r) => String(r[0]).trim()).indexOf('แจ้งเตือนทาง LINE');
  if (pushRow >= 0) {
    sh.getRange(pushRow + 1, 2).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(PUSH_MODES, true).build());
  }

  // --- แท็บตาราง ---
  createTable_(ss, TAB.MENU, SAMPLE_MENU);
  createTable_(ss, TAB.SERVICES, SAMPLE_SERVICES);
  createTable_(ss, TAB.REWARDS, SAMPLE_REWARDS);
  createTable_(ss, TAB.STAFF, []);
  createTable_(ss, TAB.MEMBERS, []);
  createTable_(ss, TAB.TX, []);

  // dropdown วิธีให้แต้ม
  const svc = ss.getSheetByName(TAB.SERVICES);
  const typeCol = colOf_(svc, 'วิธีให้แต้ม');
  if (typeCol) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList([EARN_BY_AMOUNT, EARN_BY_VISIT], true).build();
    svc.getRange(2, typeCol, 199, 1).setDataValidation(rule);
  }

  // ล็อกแท็บที่ระบบบันทึกเอง
  protect_(ss.getSheetByName(TAB.MEMBERS));
  protect_(ss.getSheetByName(TAB.TX));

  // ลบแท็บว่างที่ Google สร้างมาให้
  ['Sheet1', 'ชีต1', 'แผ่นงาน1'].forEach((n) => {
    const s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  ss.getSheetByName(TAB.SETTINGS).activate();
  ss.toast('สร้างชีตเรียบร้อย ✅ (เมนูเป็นข้อมูลตัวอย่าง แก้ได้เลย)', '2325 App', 8);
  console.log('✅ สร้างเสร็จ: ' + ss.getSheets().map((s) => s.getName()).join(' · '));
}

/** เมนู ☕ 2325 App บนแถบด้านบนของ Sheet (ทำงานเองตอนเปิด Sheet) */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('☕ 2325 App')
    .addItem('สร้างชีตเริ่มต้น', 'setup')
    .addItem('ตรวจระบบ', 'checkSetup')
    .addToUi();
}

function createTable_(ss, tabName, sampleRows) {
  if (ss.getSheetByName(tabName)) return; // มีแล้ว ไม่ทับ
  const fields = FIELDS[tabName];
  const sh = ss.insertSheet(tabName);
  sh.getRange(1, 1, 1, fields.length).setValues([fields.map((f) => f.label)]);
  styleHeader_(sh, fields.length);

  const ROWS = 199; // เตรียมรูปแบบไว้ล่วงหน้า 199 แถว
  fields.forEach((f, i) => {
    const col = i + 1;
    if (f.width) sh.setColumnWidth(col, f.width);
    if (f.text) sh.getRange(2, col, ROWS, 1).setNumberFormat('@');
  });

  if (sampleRows.length) {
    sh.getRange(2, 1, sampleRows.length, fields.length).setValues(sampleRows);
  }
  // checkbox หลังใส่ข้อมูล (ค่า true/false เดิมยังอยู่)
  fields.forEach((f, i) => {
    if (f.checkbox) sh.getRange(2, i + 1, ROWS, 1).insertCheckboxes();
  });
}

function styleHeader_(sh, n) {
  sh.getRange(1, 1, 1, n)
    .setFontWeight('bold')
    .setBackground('#2B2A28')
    .setFontColor('#F6F1E7');
  sh.setFrozenRows(1);
}

function protect_(sh) {
  if (!sh) return;
  if (sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) return;
  const p = sh.protect().setDescription('ระบบบันทึกอัตโนมัติ — ห้ามแก้ด้วยมือ');
  const me = Session.getEffectiveUser();
  p.addEditor(me);
  p.removeEditors(p.getEditors().filter((u) => u.getEmail() !== me.getEmail()));
  if (p.canDomainEdit()) p.setDomainEdit(false);
}


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 5: ตรวจระบบ / ทดสอบ   ⛔ ไม่ต้องแก้
//  เลือกฟังก์ชันด้านบน แล้วกด ▶ Run ดูผลใน Execution log
// ════════════════════════════════════════════════════════════════

/**
 * ขอสิทธิ์ให้ครบ (รันครั้งเดียว)
 * ระบบต้องใช้สิทธิ์ "เชื่อมต่อบริการภายนอก" เพื่อตรวจตัวตนลูกค้ากับ LINE
 * ตอนหน้าขอสิทธิ์ขึ้นมา ให้ติ๊ก "เลือกทั้งหมด (Select all)" แล้วกด Continue
 */
function authorize() {
  SpreadsheetApp.getActive().getName();
  PropertiesService.getScriptProperties().getProperties();
  LockService.getScriptLock();
  const res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post', payload: { id_token: 'test', client_id: 'test' }, muteHttpExceptions: true,
  });
  console.log('✅ สิทธิ์ครบแล้ว · เชื่อมต่อ LINE ได้ (HTTP ' + res.getResponseCode() + ' เป็นปกติของการทดสอบ)');
}

function checkSetup() {
  const out = [];
  const ok = (m) => out.push('✅ ' + m);
  const bad = (m) => out.push('❌ ' + m);
  const warn = (m) => out.push('⚠️ ' + m);

  try {
    const s = getSettings_();
    ok('แท็บ "' + TAB.SETTINGS + '" · ชื่อร้าน: ' + s.shopName);
  } catch (e) { bad('แท็บ "' + TAB.SETTINGS + '": ' + e.message); }

  [TAB.MENU, TAB.SERVICES, TAB.REWARDS, TAB.STAFF, TAB.MEMBERS, TAB.TX].forEach((t) => {
    try {
      const n = readTable_(t).rows.length;
      ok('แท็บ "' + t + '" · ' + n + ' แถว');
    } catch (e) { bad('แท็บ "' + t + '": ' + e.message); }
  });

  try {
    const svc = getServices_().filter((x) => x.active);
    if (!svc.length) bad('ยังไม่มีบริการที่ "เปิดใช้" ในแท็บบริการ');
    svc.forEach((x) => {
      if (x.earnType === EARN_BY_AMOUNT) ok('บริการ ' + x.name + ': ทุก ' + x.earnValue + ' บาท = 1 แต้ม');
      else ok('บริการ ' + x.name + ': 1 ครั้ง = ' + x.earnValue + ' แต้ม');
    });
  } catch (e) { bad('บริการ: ' + e.message); }

  if (CONFIG.CHANNEL_IDS.length) ok('ใส่ Channel ID แล้ว ' + CONFIG.CHANNEL_IDS.length + ' ตัว');
  else warn('ยังไม่ได้ใส่ Channel ID (ทำในขั้นที่ 3 — ตอนนี้ยังไม่ต้อง)');

  try {
    const mode = pushMode_();
    const t = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    if (mode === 'ปิด') ok('แจ้งเตือนทาง LINE: ปิด');
    else if (t) ok('แจ้งเตือนทาง LINE: ' + mode + ' · มี token แล้ว');
    else warn('แจ้งเตือนทาง LINE: ' + mode + ' แต่ยังไม่ได้ใส่ LINE_CHANNEL_ACCESS_TOKEN (ยังไม่ส่งข้อความ)');
  } catch (e) { bad('แจ้งเตือน: ' + e.message); }

  const msg = out.join('\n');
  console.log(msg);
  try { SpreadsheetApp.getUi().alert('ผลตรวจระบบ', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* รันจาก editor */ }
  return msg;
}

/** ทดสอบว่าหน้าแอปจะได้ข้อมูลอะไร */
function testPublic() {
  const d = getPublicData_();
  console.log('ร้าน: ' + d.shop.shopName);
  d.menu.forEach((c) => console.log('หมวด ' + c.category + ': ' + c.items.map((i) => i.name).join(', ')));
  console.log('รางวัล: ' + d.rewards.map((r) => r.name + ' (' + r.points + ' แต้ม)').join(', '));
}


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 6: API — ประตูรับคำขอจากหน้าแอป   ⛔ ไม่ต้องแก้
// ════════════════════════════════════════════════════════════════

/** GET: ข้อมูลสาธารณะ (ร้าน/เมนู/รางวัล) — ไม่ต้องล็อกอิน */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';
  try {
    if (action === 'public') {
      // ใช้ข้อมูลที่จำไว้ (ถ้ามี) เพื่อให้ตอบเร็ว · แก้ Sheet เมื่อไหร่ ข้อมูลที่จำไว้จะถูกล้างเอง (onEdit)
      const cache = CacheService.getScriptCache();
      const hit = cache.get(PUBLIC_CACHE_KEY);
      if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
      const body = JSON.stringify(Object.assign({ ok: true }, getPublicData_()));
      if (body.length < 90000) cache.put(PUBLIC_CACHE_KEY, body, 600); // จำไว้ 10 นาที
      return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
    }
    return json_({ ok: true, message: '2325 App API พร้อมใช้งาน', time: new Date() });
  } catch (err) {
    return json_(errorBody_(err));
  }
}

const PUBLIC_CACHE_KEY = 'public-v1';

/** แก้ข้อมูลใน Sheet → ล้างข้อมูลที่จำไว้ หน้าแอปจะเห็นข้อมูลใหม่ทันที (ทำงานเองอัตโนมัติ) */
function onEdit() {
  CacheService.getScriptCache().remove(PUBLIC_CACHE_KEY);
}

/** POST: ข้อมูลส่วนตัว — ต้องมี idToken จาก LINE ทุกครั้ง */
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'BAD_REQUEST' });
  }
  try {
    const handler = ACTIONS[body.action];
    if (!handler) throw new Error('UNKNOWN_ACTION');
    const user = verifyIdToken_(body.idToken);
    return json_(Object.assign({ ok: true }, handler(user, body)));
  } catch (err) {
    return json_(errorBody_(err));
  }
}

function errorBody_(err) {
  const code = /^[A-Z_]+$/.test(err.message) ? err.message : 'SERVER_ERROR';
  if (code === 'SERVER_ERROR') console.error(err);
  return { ok: false, error: code, detail: code === 'SERVER_ERROR' ? String(err) : undefined };
}

const ACTIONS = {

  /** เปิดแอป: ข้อมูลของฉัน */
  me(user) {
    const found = findMember_('userId', user.userId);
    const staff = getStaff_(user.userId);
    return {
      profile: { userId: user.userId, name: user.name, picture: user.picture },
      member: found ? publicMember_(found) : null,
      isStaff: !!staff,
      staffName: staff ? staff.name : null,
    };
  },

  /** สมัครสมาชิก */
  register(user, body) {
    if (body.consent !== true) throw new Error('NO_CONSENT');
    return withLock_(() => {
      const existing = findMember_('userId', user.userId);
      if (existing) return { member: publicMember_(existing) };

      const phone = normalizePhone_(body.phone);
      if (!/^0\d{8,9}$/.test(phone)) throw new Error('INVALID_PHONE');
      if (findMember_('phone', phone)) throw new Error('PHONE_TAKEN');

      const nickname = String(body.nickname || user.name || '').trim().slice(0, 40);
      if (!nickname) throw new Error('INVALID_NAME');
      const birthday = /^\d{4}-\d{2}-\d{2}$/.test(body.birthday || '') ? body.birthday : '';

      const m = {
        memberId: newMemberId_(),
        userId: user.userId,
        displayName: nickname,
        pictureUrl: user.picture || '',
        phone: phone,
        birthday: birthday,
        points: 0,
        partial: 0,
        lifetimePoints: 0,
        redeemCount: 0,
        visits: 0,
        totalSpend: 0,
        createdAt: new Date(),
        lastVisit: '',
      };
      appendRecord_(TAB.MEMBERS, m);
      addTx_(m, { type: 'สมัคร', points: 0 });
      return { member: publicMember_(m) };
    });
  },

  /** พนักงาน: ค้นหาสมาชิกด้วยรหัส (QR) หรือเบอร์โทร */
  staffLookup(user, body) {
    requireStaff_(user);
    const m = lookupMember_(body.query);
    return { member: publicMember_(m, true), recent: recentTx_(m.memberId, 5) };
  },

  /** พนักงาน: ให้แต้ม */
  earn(user, body) {
    const staff = requireStaff_(user);
    const svc = getServices_().find((s) => s.id === String(body.serviceId || '') && s.active);
    if (!svc) throw new Error('INVALID_SERVICE');

    const amount = Math.round(Number(body.amount || 0) * 100) / 100;
    const receiptNo = String(body.receiptNo || '').trim().slice(0, 40);

    if (svc.earnType === EARN_BY_AMOUNT) {
      if (!(amount > 0) || amount > CONFIG.MAX_BILL_AMOUNT) throw new Error('INVALID_AMOUNT');
      if (!receiptNo) throw new Error('RECEIPT_REQUIRED');
    } else if (amount < 0 || amount > CONFIG.MAX_BILL_AMOUNT) {
      throw new Error('INVALID_AMOUNT');
    }

    const result = withLock_(() => {
      const m = findMember_('memberId', body.memberId);
      if (!m) throw new Error('MEMBER_NOT_FOUND');
      if (receiptNo && receiptUsed_(svc.id, receiptNo)) throw new Error('RECEIPT_USED');

      const calc = calcPoints_(svc, amount, Number(m.partial || 0));
      m.points = num_(m.points) + calc.points;
      m.partial = calc.partial;
      m.lifetimePoints = num_(m.lifetimePoints) + calc.points;
      m.visits = num_(m.visits) + 1;
      m.totalSpend = num_(m.totalSpend) + amount;
      m.lastVisit = new Date();
      updateRecord_(TAB.MEMBERS, m);
      addTx_(m, {
        type: 'ได้แต้ม', service: svc.id, amount: amount, receiptNo: receiptNo,
        points: calc.points, staff: staff,
      });
      return { m: m, earned: calc.points };
    });

    const pm = publicMember_(result.m, true);
    notifyEarn_(result.m, svc, amount, result.earned, pm);
    return { member: pm, earned: result.earned, recent: recentTx_(result.m.memberId, 5) };
  },

  /** พนักงาน: แลกรางวัล */
  redeem(user, body) {
    const staff = requireStaff_(user);
    const reward = getRewards_().find((r) => r.id === String(body.rewardId || '') && r.active);
    if (!reward) throw new Error('INVALID_REWARD');

    const m = withLock_(() => {
      const m = findMember_('memberId', body.memberId);
      if (!m) throw new Error('MEMBER_NOT_FOUND');
      if (num_(m.points) < reward.points) throw new Error('NOT_ENOUGH_POINTS');
      m.points = num_(m.points) - reward.points;
      m.redeemCount = num_(m.redeemCount) + 1;
      m.lastVisit = new Date();
      updateRecord_(TAB.MEMBERS, m);
      addTx_(m, { type: 'แลกรางวัล', points: -reward.points, reward: reward.name, staff: staff });
      return m;
    });
    if (pushMode_() === 'ทุกบิล') {
      push_(m.userId, '🎁 แลก ' + reward.name + ' เรียบร้อย! แต้มคงเหลือ ' + num_(m.points) + ' แต้ม');
    }
    return { member: publicMember_(m, true), recent: recentTx_(m.memberId, 5) };
  },

  /** ลูกค้า: ประวัติแต้มของตัวเอง */
  myHistory(user) {
    const m = findMember_('userId', user.userId);
    if (!m) return { recent: [] };
    return { recent: recentTx_(m.memberId, 20) };
  },
};


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 7: คำนวณแต้ม   ⛔ ไม่ต้องแก้
// ════════════════════════════════════════════════════════════════

/**
 * ตามยอดเงิน: แต้ม = ปัดลง(เศษเดิม + ยอด ÷ อัตรา) · เศษที่เหลือเก็บไว้บิลถัดไป
 *   เช่น อัตรา 100 · เศษเดิม 0.5 (= 50 บาท) · บิล 80 → 0.5 + 0.8 = 1.3 → ได้ 1 แต้ม เศษ 0.3
 * ตามครั้ง: ได้แต้มตามอัตราทุกครั้ง (เศษเดิมไม่เปลี่ยน)
 */
function calcPoints_(svc, amount, partial) {
  if (svc.earnType === EARN_BY_AMOUNT) {
    const rate = Math.max(1, num_(svc.earnValue));
    const raw = round4_(partial + amount / rate);
    const pts = Math.floor(raw + 1e-9);
    return { points: pts, partial: round4_(raw - pts) };
  }
  return { points: Math.max(0, Math.floor(num_(svc.earnValue))), partial: partial };
}

/** อีกกี่บาทได้แต้มถัดไป (ใช้บริการแบบตามยอดเงินตัวแรก) */
function nextPointBaht_(partial) {
  const svc = getServices_().find((s) => s.active && s.earnType === EARN_BY_AMOUNT);
  if (!svc) return null;
  const rate = Math.max(1, num_(svc.earnValue));
  return Math.max(1, Math.ceil(round4_((1 - num_(partial)) * rate)));
}


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 8: ข้อมูลสาธารณะ (ร้าน / เมนู / รางวัล)   ⛔ ไม่ต้องแก้
// ════════════════════════════════════════════════════════════════

function getPublicData_() {
  const shop = getSettings_();
  shop.coverImage = imageUrl_(shop.coverImage);
  shop.logoImage = imageUrl_(shop.logoImage);

  // เมนู: จัดกลุ่มตามหมวด เรียงตามลำดับที่ปรากฏในชีต
  const groups = [];
  const byCat = {};
  readTable_(TAB.MENU).rows.forEach((r) => {
    if (!r.name || r.visible !== true) return;
    const cat = String(r.category || 'อื่นๆ').trim();
    if (!byCat[cat]) { byCat[cat] = { category: cat, items: [] }; groups.push(byCat[cat]); }
    byCat[cat].items.push({
      name: String(r.name),
      nameEn: String(r.nameEn || ''),
      price: r.price === '' ? '' : r.price,
      description: String(r.description || ''),
      image: imageUrl_(r.image),
      recommended: r.recommended === true,
      soldOut: r.soldOut === true,
    });
  });

  const services = getServices_().filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, earnType: s.earnType, earnValue: num_(s.earnValue) }));

  return {
    shop: shop,
    menu: groups,
    rewards: getRewards_().filter((r) => r.active),
    services: services,
    updatedAt: new Date(),
  };
}

function getSettings_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(TAB.SETTINGS);
  if (!sh) throw new Error('SHEET_NOT_READY');
  const map = {};
  sh.getDataRange().getValues().slice(1).forEach((r) => (map[String(r[0]).trim()] = r[1]));
  const out = {};
  SETTINGS.forEach((s) => {
    const v = map[s.label];
    out[s.key] = v === undefined || v === null ? '' : String(v).trim();
  });
  return out;
}

function getServices_() {
  return readTable_(TAB.SERVICES).rows
    .filter((r) => r.id)
    .map((r) => ({
      id: String(r.id).trim(), name: String(r.name || r.id),
      earnType: String(r.earnType).trim() === EARN_BY_VISIT ? EARN_BY_VISIT : EARN_BY_AMOUNT,
      earnValue: num_(r.earnValue), active: r.active === true,
    }));
}

function getRewards_() {
  return readTable_(TAB.REWARDS).rows
    .filter((r) => r.id && r.name && num_(r.points) > 0)
    .map((r) => ({
      id: String(r.id).trim(), name: String(r.name), points: num_(r.points),
      description: String(r.description || ''), image: imageUrl_(r.image), active: r.active === true,
    }))
    .sort((a, b) => a.points - b.points);
}

/** แปลงลิงก์แชร์ Google Drive เป็นลิงก์รูปที่แสดงในแอปได้ */
function imageUrl_(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/\/file\/d\/([\w-]{20,})/) || s.match(/[?&]id=([\w-]{20,})/);
  if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1000';
  return /^https?:\/\//.test(s) ? s : '';
}


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 9: สมาชิก / พนักงาน / ประวัติ   ⛔ ไม่ต้องแก้
// ════════════════════════════════════════════════════════════════

function findMember_(field, value) {
  const target = field === 'phone' ? normalizePhone_(value) : String(value || '').trim();
  if (!target) return null;
  return readTable_(TAB.MEMBERS).rows.find((r) => {
    const cell = field === 'phone' ? normalizePhone_(r.phone) : String(r[field]).trim();
    return cell === target;
  }) || null;
}

function lookupMember_(query) {
  const digits = String(query || '').replace(/\D/g, '');
  let m = null;
  if (/^\d{6}$/.test(digits)) m = findMember_('memberId', digits);
  if (!m && /^0\d{8,9}$|^66\d{9}$/.test(digits)) m = findMember_('phone', digits);
  if (!m) throw new Error('MEMBER_NOT_FOUND');
  return m;
}

function newMemberId_() {
  const used = new Set(readTable_(TAB.MEMBERS).rows.map((r) => String(r.memberId)));
  let id;
  do { id = String(Math.floor(100000 + Math.random() * 900000)); } while (used.has(id));
  return id;
}

/** ข้อมูลที่ส่งกลับหน้าแอป (ไม่ส่ง userId / เบอร์เต็ม) */
function publicMember_(m, forStaff) {
  const phone = String(m.phone || '');
  const partial = num_(m.partial);
  return {
    memberId: String(m.memberId),
    displayName: String(m.displayName || ''),
    pictureUrl: String(m.pictureUrl || ''),
    phoneMasked: phone.length >= 9 ? phone.slice(0, 3) + '-xxx-' + phone.slice(-4) : '',
    birthdayMonth: m.birthday ? Number(String(m.birthday).slice(5, 7)) || null : null,
    points: num_(m.points),
    partial: partial,
    nextPointBaht: nextPointBaht_(partial),
    lifetimePoints: num_(m.lifetimePoints),
    redeemCount: num_(m.redeemCount),
    visits: num_(m.visits),
    totalSpend: forStaff ? num_(m.totalSpend) : undefined,
    createdAt: m.createdAt || '',
    lastVisit: m.lastVisit || '',
  };
}

function getStaff_(userId) {
  const r = readTable_(TAB.STAFF).rows.find((x) => String(x.userId).trim() === userId && x.active === true);
  return r ? { userId: userId, name: String(r.name || 'พนักงาน') } : null;
}

function requireStaff_(user) {
  const s = getStaff_(user.userId);
  if (!s) throw new Error('NOT_STAFF');
  return s;
}

function receiptUsed_(serviceId, receiptNo) {
  const key = receiptNo.toUpperCase();
  return readTable_(TAB.TX).rows.some((r) =>
    r.type === 'ได้แต้ม' && String(r.service) === serviceId && String(r.receiptNo).trim().toUpperCase() === key);
}

function addTx_(m, t) {
  appendRecord_(TAB.TX, {
    timestamp: new Date(),
    txId: 'T' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10),
    memberId: m.memberId,
    displayName: m.displayName,
    type: t.type,
    service: t.service || '',
    amount: t.amount || '',
    receiptNo: t.receiptNo || '',
    points: t.points,
    balanceAfter: num_(m.points),
    reward: t.reward || '',
    staffName: t.staff ? t.staff.name : '',
    staffUserId: t.staff ? t.staff.userId : '',
  });
}

function recentTx_(memberId, n) {
  const svcNames = {};
  getServices_().forEach((s) => (svcNames[s.id] = s.name));
  return readTable_(TAB.TX).rows
    .filter((r) => String(r.memberId) === String(memberId) && r.type !== 'สมัคร')
    .slice(-n).reverse()
    .map((r) => ({
      time: r.timestamp, type: r.type, service: svcNames[r.service] || r.service,
      amount: r.amount === '' ? null : num_(r.amount), points: num_(r.points), reward: r.reward || '',
    }));
}


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 10: ตรวจตัวตน LINE + แจ้งเตือน   ⛔ ไม่ต้องแก้
// ════════════════════════════════════════════════════════════════

/** ตรวจ ID token กับเซิร์ฟเวอร์ LINE — ห้ามเชื่อ userId ที่หน้าเว็บส่งมาตรงๆ */
function verifyIdToken_(idToken) {
  if (!CONFIG.CHANNEL_IDS.length) throw new Error('LINE_NOT_CONFIGURED');
  if (!idToken) throw new Error('NO_TOKEN');
  for (const channelId of CONFIG.CHANNEL_IDS) {
    const res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'post',
      payload: { id_token: idToken, client_id: String(channelId) },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 200) {
      const p = JSON.parse(res.getContentText());
      return { userId: p.sub, name: p.name || '', picture: p.picture || '' };
    }
  }
  throw new Error('INVALID_TOKEN');
}

/** โหมดแจ้งเตือนจากแท็บตั้งค่าร้าน (ค่าเริ่มต้น: ครบแต้ม) */
function pushMode_() {
  const v = String(getSettings_().pushMode || '').trim();
  return PUSH_MODES.indexOf(v) >= 0 ? v : 'ครบแต้ม';
}

/**
 * แจ้งลูกค้าหลังได้แต้ม
 *   ครบแต้ม: ส่งเฉพาะตอนแต้มเพิ่งถึงเกณฑ์แลกรางวัล
 *   ทุกบิล:  ส่งทุกครั้ง (+ บอกด้วยถ้าแลกได้แล้ว)
 */
function notifyEarn_(m, svc, amount, earned, pm) {
  const mode = pushMode_();
  if (mode === 'ปิด') return;
  const shop = getSettings_().shopName || 'ร้าน';
  const after = num_(m.points);
  const before = after - earned;
  const unlocked = getRewards_().filter((r) => r.active && before < r.points && r.points <= after);

  const lines = [];
  if (mode === 'ทุกบิล') {
    const from = svc.earnType === EARN_BY_AMOUNT ? 'จากยอด ' + fmtBaht_(amount) : 'จาก ' + svc.name;
    lines.push(earned > 0
      ? '☕ ได้รับ +' + earned + ' แต้ม ' + from + '\nแต้มคงเหลือ ' + after + ' แต้ม ขอบคุณที่แวะมานะคะ'
      : '☕ บันทึกยอด ' + fmtBaht_(amount) + ' แล้ว อีก ' + pm.nextPointBaht + ' บาท รับแต้มถัดไป');
  }
  if (unlocked.length) {
    const r = unlocked[unlocked.length - 1];
    lines.push('🎉 แต้มครบ ' + after + ' แต้มแล้ว!\nแลก "' + r.name + '" ได้ที่ ' + shop + ' แจ้งพนักงานได้เลยค่ะ');
  }
  if (lines.length) push_(m.userId, lines.join('\n\n'));
}

function push_(userId, text) {
  const token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) return;
  try {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ to: userId, messages: [{ type: 'text', text: text }] }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) console.warn('push failed', res.getContentText());
  } catch (err) {
    console.warn('push error', err); // ส่งไม่สำเร็จ ไม่ทำให้การให้แต้มล้ม
  }
}


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 11: เครื่องมืออ่าน/เขียนชีต   ⛔ ไม่ต้องแก้
// ════════════════════════════════════════════════════════════════

/** อ่านทั้งแท็บ → [{ key: value, _row, _raw }] โดยจับคู่จากชื่อหัวคอลัมน์ */
function readTable_(tabName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(tabName);
  if (!sh) throw new Error('SHEET_NOT_READY');
  const values = sh.getDataRange().getValues();
  const headers = values[0].map((h) => String(h).trim());
  const idx = {};
  FIELDS[tabName].forEach((f) => {
    const i = headers.indexOf(f.label);
    if (i < 0) throw new Error('MISSING_COLUMN'); // มีคนเปลี่ยนชื่อหัวคอลัมน์
    idx[f.key] = i;
  });
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const raw = values[r];
    if (raw.every((v) => v === '' || v === false)) continue; // แถวว่าง (มีแค่ checkbox)
    const o = { _row: r + 1, _raw: raw, _headers: headers };
    Object.keys(idx).forEach((k) => (o[k] = raw[idx[k]]));
    rows.push(o);
  }
  return { sheet: sh, headers: headers, idx: idx, rows: rows };
}

function recordToRow_(tabName, headers, rec, base) {
  const row = base ? base.slice() : headers.map(() => '');
  FIELDS[tabName].forEach((f) => {
    const i = headers.indexOf(f.label);
    if (i >= 0 && rec[f.key] !== undefined) row[i] = rec[f.key] === null ? '' : rec[f.key];
  });
  return row;
}

function appendRecord_(tabName, rec) {
  const sh = SpreadsheetApp.getActive().getSheetByName(tabName);
  if (!sh) throw new Error('SHEET_NOT_READY');
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map((h) => String(h).trim());
  const row = recordToRow_(tabName, headers, rec);
  const r = sh.getLastRow() + 1;
  FIELDS[tabName].forEach((f) => {
    const i = headers.indexOf(f.label);
    if (f.text && i >= 0) sh.getRange(r, i + 1).setNumberFormat('@');
  });
  sh.getRange(r, 1, 1, row.length).setValues([row]);
}

function updateRecord_(tabName, rec) {
  const sh = SpreadsheetApp.getActive().getSheetByName(tabName);
  const row = recordToRow_(tabName, rec._headers, rec, rec._raw);
  sh.getRange(rec._row, 1, 1, row.length).setValues([row]);
}

function colOf_(sh, label) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map((h) => String(h).trim());
  const i = headers.indexOf(label);
  return i < 0 ? 0 : i + 1;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('BUSY');
  try {
    const result = fn();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

function normalizePhone_(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('66') && d.length === 11) d = '0' + d.slice(2);
  if (d.length === 9 && !d.startsWith('0')) d = '0' + d;
  return d;
}

function num_(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function round4_(n) { return Math.round(n * 10000) / 10000; }
function fmtBaht_(n) { return Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' บาท'; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
