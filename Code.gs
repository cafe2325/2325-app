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
 *   ✏️ โปรโมชั่น     แบนเนอร์โปรบนหน้าแรก
 *   ✏️ Wellness     ข้อมูล + ตั้งค่าการจอง (เวลา มัดจำ พร้อมเพย์ ฯลฯ)
 *   ✏️ Wellness ราคา  เรทราคาตามจำนวนคน (1 ท่าน / 2 ท่าน / 3–5 ท่าน)
 *   🔒 การจอง Wellness  ระบบบันทึกเอง (เจ้าของร้านแก้ได้คนเดียว)
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
  PROMOS: 'โปรโมชั่น',
  WELLNESS: 'Wellness',
  WTIERS: 'Wellness ราคา',
  BOOKINGS: 'การจอง Wellness',
};

// การจอง Wellness
const BOOK_MODES = ['เปิด', 'เฉพาะพนักงาน', 'ปิด'];
const ON_OFF = ['เปิด', 'ปิด'];
const BS = {
  HOLD: 'รอชำระมัดจำ',
  SLIP: 'รอตรวจสลิป',
  OK: 'ยืนยันแล้ว',
  IN: 'เช็กอินแล้ว',
  CANCEL: 'ยกเลิก',
  EXPIRED: 'หมดเวลาชำระ',
  REJECT: 'สลิปไม่ผ่าน',
  SHOP_CANCEL: 'ร้านยกเลิก',
  NOSHOW: 'ไม่มาตามนัด',
};
const HOLD_GRACE_MIN = 5;          // เผื่อเวลาให้ลูกค้าที่โอนแล้วกำลังส่งสลิป
const SLOTS_CACHE_KEY = 'slots-v1';
const MAX_SLIP_BYTES = 4 * 1024 * 1024;

const EARN_BY_AMOUNT = 'ตามยอดเงิน';
const EARN_BY_VISIT = 'ตามครั้ง';
const PUSH_MODES = ['ปิด', 'ครบแต้ม', 'ทุกบิล'];
const PROMO_TARGETS = ['เมนู', 'สะสมแต้ม', 'Wellness', 'หน้าแรก', 'ลิงก์ภายนอก'];

const FIELDS = {
  [TAB.PROMOS]: [
    { key: 'image', label: 'รูป (ลิงก์)', width: 180 },
    { key: 'badge', label: 'ป้าย', width: 110 },
    { key: 'title', label: 'หัวข้อ', width: 200 },
    { key: 'detail', label: 'รายละเอียด', width: 220 },
    { key: 'target', label: 'กดแล้วไปที่', width: 110 },
    { key: 'link', label: 'ลิงก์ภายนอก', width: 180 },
    { key: 'start', label: 'วันเริ่ม', width: 95 },
    { key: 'end', label: 'วันสิ้นสุด', width: 95 },
    { key: 'active', label: 'เปิดใช้', checkbox: true, width: 70 },
  ],
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
  [TAB.WTIERS]: [
    { key: 'label', label: 'หัวข้อ', width: 120 },
    { key: 'min', label: 'ตั้งแต่ (ท่าน)', width: 100 },
    { key: 'max', label: 'ถึง (ท่าน)', width: 90 },
    { key: 'price', label: 'ราคา/ท่าน', width: 90 },
    { key: 'active', label: 'เปิดใช้', checkbox: true, width: 70 },
  ],
  [TAB.BOOKINGS]: [
    { key: 'bookingId', label: 'รหัสจอง', text: true, width: 115 },
    { key: 'date', label: 'วันที่ใช้บริการ', text: true, width: 105 },
    { key: 'time', label: 'เวลา', text: true, width: 60 },
    { key: 'status', label: 'สถานะ', width: 110 },
    { key: 'name', label: 'ชื่อ', width: 110 },
    { key: 'phone', label: 'เบอร์โทร', text: true, width: 105 },
    { key: 'people', label: 'จำนวน (ท่าน)', width: 85 },
    { key: 'pricePer', label: 'ราคา/ท่าน', width: 75 },
    { key: 'total', label: 'ยอดรวม', width: 75 },
    { key: 'deposit', label: 'มัดจำ', width: 70 },
    { key: 'credit', label: 'ใช้เครดิต', width: 75 },
    { key: 'payDue', label: 'ยอดโอน', width: 70 },
    { key: 'payAtShop', label: 'ชำระที่ร้าน', width: 80 },
    { key: 'slip', label: 'สลิป', width: 160 },
    { key: 'createdAt', label: 'จองเมื่อ', width: 135 },
    { key: 'holdUntil', label: 'ต้องชำระภายใน', width: 135 },
    { key: 'slipAt', label: 'ส่งสลิปเมื่อ', width: 135 },
    { key: 'staffName', label: 'พนักงาน', width: 100 },
    { key: 'doneAt', label: 'อัปเดตล่าสุด', width: 135 },
    { key: 'reschedules', label: 'เลื่อนแล้ว (ครั้ง)', width: 100 },
    { key: 'creditLeft', label: 'เครดิตคงเหลือ', width: 95 },
    { key: 'creditExpiry', label: 'เครดิตหมดอายุ', text: true, width: 100 },
    { key: 'memberId', label: 'รหัสสมาชิก', text: true, width: 90 },
    { key: 'userId', label: 'LINE userId', text: true, width: 150 },
    { key: 'note', label: 'หมายเหตุ', width: 240 },
  ],
};

// แท็บตั้งค่าร้าน: 1 แถว = 1 หัวข้อ (คอลัมน์ A หัวข้อ, B ค่า, C คำอธิบาย)
const SETTINGS = [
  { key: 'shopName', label: 'ชื่อร้าน', value: '2325 CAFE', help: 'แสดงบนหัวแอปและบัตรสมาชิก' },
  { key: 'tagline', label: 'สโลแกน', value: 'Indulge Yourself', help: 'ข้อความเล็กบนภาพปก' },
  { key: 'heroTitle', label: 'หัวข้อภาพปก', value: 'กาแฟแก้วโปรด\nของทุกเช้า', help: 'ข้อความใหญ่บนภาพปก · ขึ้นบรรทัดใหม่ในช่อง: Ctrl+Enter / ⌘+Enter' },
  { key: 'heroSubtitle', label: 'บรรทัดรองภาพปก', value: 'อาหารเช้า · กาแฟ · Wellness', help: 'ข้อความใต้หัวข้อ · เว้นว่าง = ไม่แสดง' },
  { key: 'announcement', label: 'ประกาศหน้าแรก', value: 'เตรียมพบกับ 2325 CAFE เร็วๆ นี้', help: 'แถบประกาศบนหน้าแรก · เว้นว่าง = ไม่แสดง' },
  { key: 'coverImage', label: 'รูปหน้าปก (ลิงก์)', value: '', help: 'ลิงก์รูปจาก Google Drive (แชร์แบบทุกคนที่มีลิงก์)' },
  { key: 'logoImage', label: 'โลโก้ (ลิงก์)', value: '', help: 'ลิงก์รูปโลโก้จาก Google Drive' },
  { key: 'openHours', label: 'เวลาเปิด-ปิด', value: 'ทุกวัน 07:00 – 17:00', help: 'พิมพ์ได้หลายบรรทัด (Ctrl+Enter / ⌘+Enter ขึ้นบรรทัดใหม่)' },
  { key: 'closedNote', label: 'วันหยุด', value: '', help: 'เช่น ปิดทุกวันพุธ · เว้นว่าง = ไม่แสดง' },
  { key: 'hours_mon', label: 'เปิด วันจันทร์', value: '07:00-17:00', help: 'ใช้คำนวณป้าย เปิดอยู่/ปิดแล้ว · รูปแบบ 07:00-17:00 · พิมพ์ ปิด ถ้าวันนี้หยุด', text: true },
  { key: 'hours_tue', label: 'เปิด วันอังคาร', value: '07:00-17:00', help: 'ใช้คำนวณป้าย เปิดอยู่/ปิดแล้ว · รูปแบบ 07:00-17:00 · พิมพ์ ปิด ถ้าวันนี้หยุด', text: true },
  { key: 'hours_wed', label: 'เปิด วันพุธ', value: '07:00-17:00', help: 'ใช้คำนวณป้าย เปิดอยู่/ปิดแล้ว · รูปแบบ 07:00-17:00 · พิมพ์ ปิด ถ้าวันนี้หยุด', text: true },
  { key: 'hours_thu', label: 'เปิด วันพฤหัสบดี', value: '07:00-17:00', help: 'ใช้คำนวณป้าย เปิดอยู่/ปิดแล้ว · รูปแบบ 07:00-17:00 · พิมพ์ ปิด ถ้าวันนี้หยุด', text: true },
  { key: 'hours_fri', label: 'เปิด วันศุกร์', value: '07:00-17:00', help: 'ใช้คำนวณป้าย เปิดอยู่/ปิดแล้ว · รูปแบบ 07:00-17:00 · พิมพ์ ปิด ถ้าวันนี้หยุด', text: true },
  { key: 'hours_sat', label: 'เปิด วันเสาร์', value: '07:00-17:00', help: 'ใช้คำนวณป้าย เปิดอยู่/ปิดแล้ว · รูปแบบ 07:00-17:00 · พิมพ์ ปิด ถ้าวันนี้หยุด', text: true },
  { key: 'hours_sun', label: 'เปิด วันอาทิตย์', value: '07:00-17:00', help: 'ใช้คำนวณป้าย เปิดอยู่/ปิดแล้ว · รูปแบบ 07:00-17:00 · พิมพ์ ปิด ถ้าวันนี้หยุด', text: true },
  { key: 'holidays', label: 'วันหยุดพิเศษ', value: '', help: 'ปิดเฉพาะวัน เช่น 13/4, 14/4, 31/12/2026 · คั่นด้วยจุลภาค', text: true },
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
// ลำดับ: รูป, ป้าย, หัวข้อ, รายละเอียด, กดแล้วไปที่, ลิงก์ภายนอก, วันเริ่ม, วันสิ้นสุด, เปิดใช้
const SAMPLE_PROMOS = [
  ['', 'ทุกวันจันทร์', 'ลาเต้ 2 แก้ว 120.-', 'ตัวอย่างโปร · แก้ได้ในแท็บโปรโมชั่น', 'เมนู', '', '', '', true],
  ['', 'สมาชิก', 'ครบ 10 แต้ม ฟรี 1 แก้ว', 'สมัครสมาชิกฟรีในแอป', 'สะสมแต้ม', '', '', '', true],
];

// แท็บ Wellness: 1 แถว = 1 หัวข้อ (เหมือนแท็บตั้งค่าร้าน)
const WELLNESS = [
  { key: 'title', label: 'หัวข้อ', value: 'Ice Bath & Sauna', help: 'ชื่อบริการบนการ์ดหน้าแรกและหน้า Wellness' },
  { key: 'subtitle', label: 'คำโปรย', value: 'ฟื้นฟูร่างกาย หลังวิ่ง หลังออกกำลัง', help: 'ข้อความสั้นใต้หัวข้อ' },
  { key: 'status', label: 'สถานะ', value: 'เปิดจองเร็วๆ นี้', help: 'ป้ายบนการ์ด' },
  { key: 'image', label: 'รูป (ลิงก์)', value: '', help: 'รูปการ์ด Wellness (แนวนอน) · เว้นว่าง = ใช้พื้นสีฟ้าเทา' },
  { key: 'about', label: 'รายละเอียด', value: 'พื้นที่ฟื้นฟูร่างกายด้วยความเย็นและความร้อน อ่างแช่น้ำเย็นแบบส่วนตัวและแบบกลุ่ม พร้อมซาวน่า เหมาะหลังวิ่ง หลังออกกำลังกาย หรือวันที่อยากรีเซ็ตร่างกาย', help: 'แสดงในหน้า Wellness' },
  { key: 'services', label: 'บริการ (บรรทัดละ 1 รายการ)', value: 'Private Ice Bath | อ่างส่วนตัว 1 ท่าน · รวมซาวน่า\nGroup Ice Bath | อ่างใหญ่ 2–3 ท่าน · รวมซาวน่า', help: 'รูปแบบ: ชื่อ | รายละเอียด · ขึ้นบรรทัดใหม่: Ctrl+Enter / ⌘+Enter' },
  { key: 'note', label: 'ข้อควรระวัง', value: 'ผู้มีโรคหัวใจ ความดันโลหิต หรือตั้งครรภ์ ควรปรึกษาแพทย์ก่อนใช้บริการ', help: 'แสดงท้ายหน้า Wellness' },

  // ----- การจอง -----
  { key: 'bookingMode', label: 'เปิดรับจอง', value: 'เฉพาะพนักงาน', help: 'เปิด = ลูกค้าจองได้ · เฉพาะพนักงาน = ช่วงทดสอบ (ลูกค้าเห็นแต่ยังจองไม่ได้) · ปิด = ปิดรับจอง' },
  { key: 'sessionMin', label: 'เวลาใช้บริการ (นาที)', value: 60, help: 'ความยาว 1 รอบ' },
  { key: 'bufferMin', label: 'เวลาเตรียมห้อง (นาที)', value: 15, help: 'พักระหว่างรอบ · รอบถัดไป = เวลาใช้บริการ + เวลาเตรียมห้อง' },
  { key: 'firstSlot', label: 'รอบแรก', value: '', help: 'เว้นว่าง = ตามเวลาเปิดร้าน · หรือพิมพ์เวลา เช่น 08:00', text: true },
  { key: 'lastEnd', label: 'รอบสุดท้ายต้องจบภายใน', value: '', help: 'เว้นว่าง = ตามเวลาปิดร้าน · หรือพิมพ์เวลา เช่น 17:30', text: true },
  { key: 'depositPct', label: 'มัดจำ (%)', value: 50, help: 'เปอร์เซ็นต์ของยอดรวม' },
  { key: 'maxPeople', label: 'จำนวนคนสูงสุดต่อรอบ', value: 5, help: '' },
  { key: 'advanceDays', label: 'จองล่วงหน้าได้ (วัน)', value: 14, help: 'นับรวมวันนี้' },
  { key: 'leadMin', label: 'ต้องจองก่อนถึงรอบ (นาที)', value: 60, help: 'กันลูกค้าจองรอบที่ใกล้จะเริ่ม' },
  { key: 'holdMin', label: 'เวลาชำระมัดจำ (นาที)', value: 15, help: 'ไม่ส่งสลิปภายในเวลานี้ รอบจะถูกปล่อยให้คนอื่นจอง' },
  { key: 'cancelHours', label: 'ยกเลิก/เลื่อนได้ก่อน (ชั่วโมง)', value: 24, help: 'ยกเลิกทันเวลา = มัดจำเป็นเครดิต · เลื่อนนัดฟรี 1 ครั้ง' },
  { key: 'creditDays', label: 'เครดิตมัดจำใช้ได้ (วัน)', value: 60, help: 'เครดิตหักจากการจองครั้งถัดไปให้อัตโนมัติ' },
  { key: 'promptpay', label: 'พร้อมเพย์ (เบอร์ หรือ เลขบัตร)', value: '', help: 'ใส่แล้ว ระบบสร้าง QR ที่มียอดเงินให้เอง (แนะนำ) · เว้นว่าง = ใช้รูป QR ด้านล่าง', text: true },
  { key: 'payName', label: 'ชื่อบัญชีรับเงิน', value: '', help: 'แสดงใต้ QR ให้ลูกค้าตรวจชื่อก่อนโอน' },
  { key: 'qrImage', label: 'รูป QR รับเงิน (ลิงก์)', value: '', help: 'ใช้เมื่อไม่ได้ใส่พร้อมเพย์ · ลิงก์รูปจาก Google Drive (แชร์แบบทุกคนที่มีลิงก์)' },
  { key: 'closedDates', label: 'วันงดให้บริการ Wellness', value: '', help: 'เช่น 5/10, 12/10 · คั่นด้วยจุลภาค (วันหยุดร้านปิดจองให้อัตโนมัติ)', text: true },
  { key: 'policyExtra', label: 'เงื่อนไขเพิ่มเติม', value: 'มาสายใช้บริการได้ตามเวลาที่เหลือของรอบ\nกรณีร้านยกเลิก คืนมัดจำเต็มจำนวน', help: 'บรรทัดละ 1 ข้อ (เงื่อนไขมัดจำ/ยกเลิก ระบบเขียนให้เองตามตัวเลขด้านบน)' },
  { key: 'healthText', label: 'ข้อความรับรองสุขภาพ', value: 'ผู้ใช้บริการทุกท่านไม่มีโรคหัวใจ ความดันโลหิตสูง หรือตั้งครรภ์ และรับทราบความเสี่ยงของการแช่น้ำเย็นและซาวน่า', help: 'ลูกค้าต้องติ๊กยอมรับก่อนจอง' },
  { key: 'notifyStaff', label: 'แจ้งพนักงานทาง LINE', value: 'เปิด', help: 'มีสลิปใหม่ / ลูกค้ายกเลิก / เลื่อนนัด → ส่งหาพนักงานทุกคน (ใช้โควตาข้อความ OA)' },
  { key: 'notifyCustomer', label: 'แจ้งลูกค้าทาง LINE', value: 'เปิด', help: 'ร้านยืนยัน / สลิปไม่ผ่าน / ร้านยกเลิก → ส่งหาลูกค้า (ใช้โควตาข้อความ OA)' },
];

// แท็บ Wellness ราคา · ลำดับ: หัวข้อ, ตั้งแต่, ถึง, ราคา/ท่าน, เปิดใช้
const SAMPLE_TIERS = [
  ['1 ท่าน', 1, 1, 450, true],
  ['2 ท่าน', 2, 2, 390, true],
  ['3–5 ท่าน', 3, 5, 350, true],
];

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

  // --- ตั้งค่าร้าน + Wellness (แบบ หัวข้อ/ค่า) ---
  const sh = createKV_(ss, TAB.SETTINGS, SETTINGS);
  const wsh = createKV_(ss, TAB.WELLNESS, WELLNESS);

  // dropdown ในแท็บ Wellness
  const wLabels = wsh.getDataRange().getValues().map((r) => String(r[0]).trim());
  const dd = (label, list) => {
    const i = wLabels.indexOf(label);
    if (i >= 0) wsh.getRange(i + 1, 2).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(list, true).build());
  };
  dd('เปิดรับจอง', BOOK_MODES);
  dd('แจ้งพนักงานทาง LINE', ON_OFF);
  dd('แจ้งลูกค้าทาง LINE', ON_OFF);

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
  createTable_(ss, TAB.PROMOS, SAMPLE_PROMOS);
  createTable_(ss, TAB.WTIERS, SAMPLE_TIERS);
  createTable_(ss, TAB.BOOKINGS, []);

  // dropdown ปลายทางโปรโมชั่น
  const pr = ss.getSheetByName(TAB.PROMOS);
  const tCol = colOf_(pr, 'กดแล้วไปที่');
  if (tCol) {
    pr.getRange(2, tCol, 199, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(PROMO_TARGETS, true).build());
  }

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
  protect_(ss.getSheetByName(TAB.BOOKINGS));

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

/** แท็บแบบ หัวข้อ | ค่า | คำอธิบาย · มีอยู่แล้ว = เพิ่มเฉพาะหัวข้อใหม่ (ไม่ทับค่าเดิม) */
function createKV_(ss, tabName, defs) {
  let sh = ss.getSheetByName(tabName);
  const styleRow = (r) => {
    sh.getRange(r, 1).setFontWeight('bold').setBackground('#F6F1E7');
    sh.getRange(r, 2).setWrap(true).setBackground('#FFFDF8');
    sh.getRange(r, 3).setFontColor('#8A8178');
  };
  if (!sh) {
    sh = ss.insertSheet(tabName);
    sh.getRange(1, 1, 1, 3).setValues([['หัวข้อ', 'ค่า', 'คำอธิบาย']]);
    styleHeader_(sh, 3);
    sh.setColumnWidth(1, 190);
    sh.setColumnWidth(2, 340);
    sh.setColumnWidth(3, 380);
  }
  const have = sh.getDataRange().getValues().slice(1).map((r) => String(r[0]).trim()); // ข้ามแถวหัวตาราง
  defs.filter((d) => have.indexOf(d.label) < 0).forEach((d) => {
    const r = sh.getLastRow() + 1;
    if (d.text) sh.getRange(r, 2).setNumberFormat('@'); // กัน Sheet แปลงเป็นวันที่/เวลา
    sh.getRange(r, 1, 1, 3).setValues([[d.label, d.value, d.help]]);
    styleRow(r);
  });
  return sh;
}

function getKV_(tabName, defs) {
  const sh = SpreadsheetApp.getActive().getSheetByName(tabName);
  if (!sh) throw new Error('SHEET_NOT_READY');
  const map = {};
  sh.getDataRange().getValues().slice(1).forEach((r) => (map[String(r[0]).trim()] = r[1]));
  const out = {};
  defs.forEach((d) => {
    let v = map[d.label];
    if (v instanceof Date) v = Utilities.formatDate(v, 'Asia/Bangkok', d.text ? 'yyyy-MM-dd' : 'd/M/yyyy');
    out[d.key] = v === undefined || v === null ? '' : String(v).trim();
  });
  return out;
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
  const folder = slipFolder_(); // โฟลเดอร์เก็บสลิปมัดจำใน Google Drive ของเจ้าของ
  console.log('📁 โฟลเดอร์สลิป: ' + folder.getName());
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

  [TAB.MENU, TAB.PROMOS, TAB.SERVICES, TAB.REWARDS, TAB.STAFF, TAB.MEMBERS, TAB.TX].forEach((t) => {
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

  try {
    const cfg = bookingCfg_();
    const tiers = getTiers_();
    readTable_(TAB.BOOKINGS);
    ok('Wellness เปิดรับจอง: ' + cfg.mode + ' · รอบละ ' + cfg.sessionMin + ' นาที + เตรียมห้อง ' + cfg.bufferMin + ' นาที');
    if (tiers.length) ok('เรทราคา: ' + tiers.map((t) => t.label + ' ' + t.price + '/ท่าน').join(' · '));
    else bad('ยังไม่มีเรทราคาที่เปิดใช้ในแท็บ "' + TAB.WTIERS + '"');
    for (let n = 1; n <= cfg.maxPeople; n++) if (!priceFor_(tiers, n)) warn('ไม่มีเรทราคาสำหรับ ' + n + ' ท่าน (ลูกค้าจะเลือกจำนวนนี้ไม่ได้)');
    if (cfg.promptpay) ok('รับมัดจำผ่านพร้อมเพย์ ' + cfg.promptpay.replace(/\d(?=\d{4})/g, 'x') + ' (QR มียอดเงินในตัว)');
    else if (cfg.qrImage) ok('รับมัดจำผ่านรูป QR ที่อัปโหลด');
    else warn('ยังไม่ได้ใส่พร้อมเพย์ หรือรูป QR รับเงิน ในแท็บ Wellness');
    if (cfg.promptpay && !promptpayOk_(cfg.promptpay)) bad('เลขพร้อมเพย์ไม่ถูกต้อง (เบอร์ 10 หลัก หรือเลขบัตร 13 หลัก)');
    const d = availability_(cfg).find((x) => x.slots.length);
    if (d) ok('ตัวอย่างรอบวันที่ ' + d.date + ': ' + d.slots.map((x) => x.t).join(', '));
    else warn('ไม่มีรอบให้จองเลย ตรวจเวลาเปิดร้าน / รอบแรก / รอบสุดท้าย');
  } catch (e) { bad('Wellness: ' + e.message + ' (กดเมนู สร้างชีตเริ่มต้น อีกครั้ง)'); }

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
  resetMemo_();
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
    if (action === 'slots') {
      // รอบว่าง Wellness (ไม่มีข้อมูลส่วนตัว) · จำไว้ 1 นาที · มีการจองเมื่อไหร่ล้างทันที
      const cache = CacheService.getScriptCache();
      const hit = cache.get(SLOTS_CACHE_KEY);
      if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
      const body = JSON.stringify({ ok: true, days: availability_(bookingCfg_()) });
      cache.put(SLOTS_CACHE_KEY, body, 60);
      return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
    }
    return json_({ ok: true, message: '2325 App API พร้อมใช้งาน', time: new Date() });
  } catch (err) {
    return json_(errorBody_(err));
  }
}

const PUBLIC_CACHE_KEY = 'public-v4';

/** เตรียมข้อมูลร้าน/เมนูไว้ในหน่วยความจำ (ตัวตั้งเวลาเรียกทุก 5 นาที = หลังบ้านไม่หลับ) */
function warmUp() {
  const body = JSON.stringify(Object.assign({ ok: true }, getPublicData_()));
  if (body.length < 90000) CacheService.getScriptCache().put(PUBLIC_CACHE_KEY, body, 600);
}

/** รันครั้งเดียว: ตั้งให้ warmUp ทำงานเองทุก 5 นาที */
function installWarmUp() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'warmUp')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('warmUp').timeBased().everyMinutes(5).create();
  warmUp();
  console.log('✅ ตั้งเวลาปลุกหลังบ้านทุก 5 นาทีแล้ว');
}

/** แก้ข้อมูลใน Sheet → ล้างข้อมูลที่จำไว้ หน้าแอปจะเห็นข้อมูลใหม่ทันที (ทำงานเองอัตโนมัติ) */
function onEdit() {
  CacheService.getScriptCache().removeAll([PUBLIC_CACHE_KEY, SLOTS_CACHE_KEY]);
}

/** POST: ข้อมูลส่วนตัว — ต้องมี idToken จาก LINE ทุกครั้ง */
function doPost(e) {
  resetMemo_();
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

    const r = earnCore_(staff, svc, body.memberId, amount, receiptNo);
    return { member: r.pm, earned: r.earned, recent: recentTx_(r.m.memberId, 5) };
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

  // ---------- Wellness: ลูกค้า ----------

  /** การจองของฉัน + เครดิต + ชื่อ/เบอร์สำหรับกรอกอัตโนมัติ */
  wbMine(user) {
    const cfg = bookingCfg_();
    sweepIfNeeded_((b) => b.userId === user.userId);
    const mine = myBookings_(user.userId);
    const now = Date.now();
    const active = mine.filter((b) => [BS.HOLD, BS.SLIP, BS.OK].indexOf(b.status) >= 0 && bookingEnd_(b, cfg) > now)
      .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
    const past = mine.filter((b) => active.indexOf(b) < 0).slice(-5).reverse();
    const m = findMember_('userId', user.userId);
    const last = mine[mine.length - 1];
    return {
      bookings: active.map((b) => publicBooking_(b, cfg)),
      past: past.map((b) => publicBooking_(b, cfg)),
      credit: creditRows_(user.userId).reduce((s, c) => s + num_(c.creditLeft), 0),
      contact: {
        name: m ? String(m.displayName) : last ? String(last.name) : user.name,
        phone: m ? String(m.phone) : last ? String(last.phone) : '',
      },
      isStaff: !!getStaff_(user.userId),
    };
  },

  /** จองรอบ */
  wbCreate(user, body) {
    const cfg = bookingCfg_();
    if (cfg.mode === 'ปิด' || (cfg.mode === 'เฉพาะพนักงาน' && !getStaff_(user.userId))) throw new Error('BOOKING_CLOSED');
    if (body.agree !== true) throw new Error('NO_CONSENT');
    const people = Math.floor(num_(body.people));
    if (people < 1 || people > cfg.maxPeople) throw new Error('INVALID_PEOPLE');
    const tier = priceFor_(getTiers_(), people);
    if (!tier) throw new Error('NO_TIER');
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name) throw new Error('INVALID_NAME');
    const phone = normalizePhone_(body.phone);
    if (!/^0\d{8,9}$/.test(phone)) throw new Error('INVALID_PHONE');
    const date = String(body.date || '');
    const time = String(body.time || '');

    const b = withLock_(() => {
      sweep_();
      checkSlotFree_(cfg, date, time);

      // ยกเลิกรายการที่ยังไม่จ่ายของลูกค้าคนนี้ (จองใหม่แทน)
      myBookings_(user.userId).filter((x) => x.status === BS.HOLD)
        .forEach((x) => endHold_(x, BS.CANCEL, 'ลูกค้าจองรอบใหม่แทน'));

      const id = newBookingId_();
      const total = tier.price * people;
      const deposit = Math.ceil((total * cfg.depositPct) / 100);

      // ใช้เครดิตมัดจำเดิม (ยกเลิกทันเวลา) หักให้อัตโนมัติ
      let need = total, used = 0, exp = '';
      creditRows_(user.userId).forEach((c) => {
        if (need <= 0) return;
        const u = Math.min(num_(c.creditLeft), need);
        c.creditLeft = num_(c.creditLeft) - u;
        c.note = addNote_(c.note, 'ใช้เครดิต ' + u + ' กับ ' + id);
        updateRecord_(TAB.BOOKINGS, c);
        need -= u; used += u;
        if (!exp || c.creditExpiry < exp) exp = String(c.creditExpiry);
      });

      const payDue = Math.max(0, deposit - used);
      const now = new Date();
      const m = findMember_('userId', user.userId);
      const rec = {
        bookingId: id, date: date, time: time,
        status: payDue > 0 ? BS.HOLD : BS.OK,
        name: name, phone: phone, people: people, pricePer: tier.price,
        total: total, deposit: deposit, credit: used, payDue: payDue,
        payAtShop: total - deposit - Math.max(0, used - deposit),
        slip: '', createdAt: now,
        holdUntil: payDue > 0 ? new Date(now.getTime() + cfg.holdMin * 60000) : '',
        slipAt: '', staffName: '', doneAt: '', reschedules: 0,
        creditLeft: 0, creditExpiry: used ? exp : '',
        memberId: m ? String(m.memberId) : '', userId: user.userId,
        note: used ? 'ใช้เครดิตมัดจำ ' + used + ' บาท' : '',
      };
      appendRecord_(TAB.BOOKINGS, rec);
      return rec;
    });
    clearSlotsCache_();
    if (b.status === BS.OK) {
      notifyStaff_(cfg, '🧊 จองใหม่ (ใช้เครดิตมัดจำ)\n' + bookingLine_(b));
    }
    return { booking: publicBooking_(b, cfg) };
  },

  /** ส่งสลิปมัดจำ (รูปจากหน้าแอป ย่อขนาดแล้ว) */
  wbSlip(user, body) {
    const cfg = bookingCfg_();
    const m = String(body.image || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw new Error('BAD_IMAGE');
    const bytes = Utilities.base64Decode(m[2]);
    if (bytes.length > MAX_SLIP_BYTES) throw new Error('IMAGE_TOO_BIG');

    const pre = ownBooking_(user, body.bookingId);
    checkCanSlip_(pre);
    // บันทึกไฟล์ก่อน (ช้า) แล้วค่อยล็อกเพื่ออัปเดตสถานะ
    const ext = m[1] === 'image/png' ? '.png' : m[1] === 'image/webp' ? '.webp' : '.jpg';
    const file = slipFolder_().createFile(Utilities.newBlob(bytes, m[1], pre.bookingId + '_' + pre.date + '_' + pre.name + ext));

    const b = withLock_(() => {
      const x = ownBooking_(user, body.bookingId);
      checkCanSlip_(x);
      x.slip = file.getUrl();
      x.slipAt = new Date();
      x.status = BS.SLIP;
      x.doneAt = new Date();
      updateRecord_(TAB.BOOKINGS, x);
      return x;
    });
    clearSlotsCache_();
    notifyStaff_(cfg, '🧾 มีสลิปมัดจำใหม่ รอตรวจ\n' + bookingLine_(b) + '\nยอดโอน ' + fmtBaht_(b.payDue) + '\n\nเปิดแอป > โหมดพนักงาน > การจอง Wellness');
    return { booking: publicBooking_(b, cfg) };
  },

  /** ลูกค้ายกเลิก */
  wbCancel(user, body) {
    const cfg = bookingCfg_();
    const out = withLock_(() => {
      const b = ownBooking_(user, body.bookingId);
      if (b.status === BS.HOLD) {
        endHold_(b, BS.CANCEL, 'ลูกค้ายกเลิกก่อนชำระ');
        return { b: b, credit: 0 };
      }
      if (b.status === BS.SLIP) throw new Error('WAIT_CONFIRM');
      if (b.status !== BS.OK) throw new Error('BAD_STATUS');
      const left = bookingStart_(b) - Date.now();
      if (left <= 0) throw new Error('TOO_LATE');
      const prepaid = num_(b.credit) + num_(b.payDue);
      let credit = 0;
      if (left >= cfg.cancelHours * 3600e3) {
        credit = prepaid;
        b.creditLeft = credit;
        b.creditExpiry = addDays_(todayIso_(), cfg.creditDays);
        b.note = addNote_(b.note, 'ลูกค้ายกเลิกทันเวลา · มัดจำ ' + credit + ' บาท เป็นเครดิต');
      } else {
        b.creditLeft = 0;
        b.note = addNote_(b.note, 'ลูกค้ายกเลิกน้อยกว่า ' + cfg.cancelHours + ' ชม. · ไม่คืนมัดจำ');
      }
      b.status = BS.CANCEL;
      b.doneAt = new Date();
      updateRecord_(TAB.BOOKINGS, b);
      return { b: b, credit: credit };
    });
    clearSlotsCache_();
    if (out.b.payDue > 0 || out.b.credit > 0) {
      notifyStaff_(cfg, '❌ ลูกค้ายกเลิกการจอง\n' + bookingLine_(out.b) + (out.credit ? '\nมัดจำเป็นเครดิต ' + fmtBaht_(out.credit) : ''));
    }
    return { booking: publicBooking_(out.b, cfg), credit: out.credit };
  },

  /** ลูกค้าเลื่อนนัด (ฟรี 1 ครั้ง) */
  wbReschedule(user, body) {
    const cfg = bookingCfg_();
    const date = String(body.date || '');
    const time = String(body.time || '');
    const out = withLock_(() => {
      sweep_();
      const b = ownBooking_(user, body.bookingId);
      if ([BS.SLIP, BS.OK].indexOf(b.status) < 0) throw new Error('BAD_STATUS');
      if (num_(b.reschedules) >= 1) throw new Error('RESCHEDULE_USED');
      if (bookingStart_(b) - Date.now() < cfg.cancelHours * 3600e3) throw new Error('TOO_LATE');
      checkSlotFree_(cfg, date, time);
      const from = b.date + ' ' + b.time;
      b.date = date;
      b.time = time;
      b.reschedules = num_(b.reschedules) + 1;
      b.doneAt = new Date();
      b.note = addNote_(b.note, 'เลื่อนจาก ' + from);
      updateRecord_(TAB.BOOKINGS, b);
      return { b: b, from: from };
    });
    clearSlotsCache_();
    notifyStaff_(cfg, '🔁 ลูกค้าเลื่อนนัด\nจาก ' + thaiDateTime_(out.from.slice(0, 10), out.from.slice(11)) + '\nเป็น ' + bookingLine_(out.b));
    return { booking: publicBooking_(out.b, cfg) };
  },

  // ---------- Wellness: พนักงาน ----------

  /** รายการจอง: รอตรวจสลิป + วันนี้และวันถัดไป */
  wbStaffList(user) {
    requireStaff_(user);
    const cfg = bookingCfg_();
    sweepIfNeeded_(() => true);
    const today = todayIso_();
    const rows = readTable_(TAB.BOOKINGS).rows.map(normBooking_);
    const sort = (a, b) => (a.date + a.time < b.date + b.time ? -1 : 1);
    const pending = rows.filter((b) => b.status === BS.SLIP).sort(sort);
    const upcoming = rows.filter((b) => [BS.HOLD, BS.OK, BS.IN].indexOf(b.status) >= 0 && b.date >= today).sort(sort).slice(0, 80);
    return {
      pending: pending.map((b) => staffBooking_(b, cfg)),
      upcoming: upcoming.map((b) => staffBooking_(b, cfg)),
    };
  },

  /** ดูการจอง 1 รายการ (+ รูปสลิป) */
  wbStaffGet(user, body) {
    requireStaff_(user);
    const cfg = bookingCfg_();
    const b = findBooking_(body.bookingId);
    if (!b) throw new Error('BOOKING_NOT_FOUND');
    return { booking: staffBooking_(b, cfg), slipImage: body.withSlip ? slipData_(b.slip) : '' };
  },

  /** พนักงาน: ยืนยันสลิป / สลิปไม่ผ่าน / เช็กอิน / ไม่มา / ร้านยกเลิก */
  wbStaffAction(user, body) {
    const staff = requireStaff_(user);
    const cfg = bookingCfg_();
    const op = String(body.op || '');
    const b = withLock_(() => {
      const x = findBooking_(body.bookingId);
      if (!x) throw new Error('BOOKING_NOT_FOUND');
      const need = { confirm: [BS.SLIP], reject: [BS.SLIP], checkin: [BS.OK, BS.SLIP], noshow: [BS.OK], shopcancel: [BS.HOLD, BS.SLIP, BS.OK] }[op];
      if (!need) throw new Error('UNKNOWN_ACTION');
      if (need.indexOf(x.status) < 0) throw new Error('BAD_STATUS');
      if (op === 'confirm') x.status = BS.OK;
      if (op === 'checkin') x.status = BS.IN;
      if (op === 'noshow') { x.status = BS.NOSHOW; x.note = addNote_(x.note, 'ไม่มาตามนัด · ไม่คืนมัดจำ'); }
      if (op === 'reject' || op === 'shopcancel') {
        x.status = op === 'reject' ? BS.REJECT : BS.SHOP_CANCEL;
        if (num_(x.credit) > 0) {  // คืนเครดิตที่ลูกค้าใช้ไป
          x.creditLeft = num_(x.credit);
          if (!x.creditExpiry || x.creditExpiry < addDays_(todayIso_(), 7)) x.creditExpiry = addDays_(todayIso_(), cfg.creditDays);
        }
        if (op === 'shopcancel' && num_(x.payDue) > 0 && x.slip) x.note = addNote_(x.note, 'ร้านยกเลิก · ต้องโอนคืน ' + num_(x.payDue) + ' บาท');
        if (body.note) x.note = addNote_(x.note, String(body.note).slice(0, 200));
      }
      x.staffName = staff.name;
      x.doneAt = new Date();
      updateRecord_(TAB.BOOKINGS, x);
      return x;
    });
    clearSlotsCache_();

    // แจ้งลูกค้า
    const when = thaiDateTime_(b.date, b.time);
    if (op === 'confirm') {
      notifyCustomer_(cfg, b.userId, '✅ ยืนยันการจองแล้วค่ะ\n' + (cfg.title || 'Wellness') +
        '\n' + when + ' · ' + b.people + ' ท่าน\nชำระที่ร้าน ' + fmtBaht_(b.payAtShop) + '\n\nแสดง QR การจองในแอปเมื่อมาถึงร้านนะคะ');
    }
    if (op === 'reject') {
      notifyCustomer_(cfg, b.userId, '⚠️ ตรวจสลิปมัดจำไม่ผ่านค่ะ\nการจอง ' + when + ' ถูกยกเลิก\nหากโอนเงินแล้ว กรุณาติดต่อร้านทางแชทนี้ได้เลยค่ะ');
    }
    if (op === 'shopcancel') {
      notifyCustomer_(cfg, b.userId, '🙏 ขออภัยค่ะ ร้านจำเป็นต้องยกเลิกการจอง ' + when +
        (num_(b.payDue) > 0 && b.slip ? '\nร้านจะคืนมัดจำเต็มจำนวน กรุณาแจ้งเลขบัญชีทางแชทนี้ค่ะ' : '') +
        (num_(b.credit) > 0 ? '\nเครดิตมัดจำ ' + fmtBaht_(b.credit) + ' คืนเข้าบัญชีแล้ว' : ''));
    }

    // เช็กอิน → ให้แต้ม (ถ้าเปิดบริการ icebath ในแท็บบริการ และลูกค้าเป็นสมาชิก)
    let earned = null;
    if (op === 'checkin') {
      const svc = getServices_().find((s) => s.id === 'icebath' && s.active);
      const m = findMember_('userId', b.userId);
      if (svc && m && !receiptUsed_(svc.id, b.bookingId)) {
        try {
          earned = earnCore_(staff, svc, m.memberId, num_(b.total), b.bookingId).earned;
        } catch (e) { console.warn('checkin earn', e); }
      }
    }
    return { booking: staffBooking_(b, cfg), earned: earned };
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

/** บันทึกแต้ม 1 บิล (ใช้ทั้งหน้าให้แต้ม และตอนเช็กอิน Wellness) */
function earnCore_(staff, svc, memberId, amount, receiptNo) {
  const result = withLock_(() => {
    const m = findMember_('memberId', memberId);
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
  return { m: result.m, pm: pm, earned: result.earned };
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

  // เวลาเปิดรายวัน [อา, จ, อ, พ, พฤ, ศ, ส] → [นาทีเปิด, นาทีปิด] หรือ null = ปิด
  const order = ['hours_sun', 'hours_mon', 'hours_tue', 'hours_wed', 'hours_thu', 'hours_fri', 'hours_sat'];
  shop.hours = order.map((k) => parseHours_(shop[k]));
  shop.holidays = parseHolidays_(shop.holidays);
  order.forEach((k) => delete shop[k]);

  let wellness = null;
  try {
    const w = getKV_(TAB.WELLNESS, WELLNESS);
    wellness = {
      title: w.title, subtitle: w.subtitle, status: w.status, about: w.about, note: w.note,
      image: imageUrl_(w.image),
      services: String(w.services || '').split(/\n+/).map((l) => {
        const p = l.split('|');
        return { name: String(p[0] || '').trim(), detail: String(p.slice(1).join('|') || '').trim() };
      }).filter((x) => x.name),
    };
    const cfg = bookingCfg_();
    wellness.booking = {
      mode: cfg.mode, sessionMin: cfg.sessionMin, bufferMin: cfg.bufferMin,
      depositPct: cfg.depositPct, maxPeople: cfg.maxPeople, advanceDays: cfg.advanceDays,
      holdMin: cfg.holdMin, cancelHours: cfg.cancelHours, creditDays: cfg.creditDays,
      tiers: getTiers_(),
      promptpay: promptpayOk_(cfg.promptpay) ? cfg.promptpay : '',
      payName: cfg.payName, qrImage: imageUrl_(cfg.qrImage),
      policyExtra: String(w.policyExtra || '').split(/\n+/).map((x) => x.trim()).filter(Boolean),
      healthText: w.healthText,
    };
  } catch (e) { /* ยังไม่มีแท็บ Wellness / ยังไม่ได้กดสร้างชีตรอบใหม่ */ }

  return {
    shop: shop,
    promos: getPromos_(),
    wellness: wellness,
    menu: groups,
    rewards: getRewards_().filter((r) => r.active),
    services: services,
    updatedAt: new Date(),
  };
}

let SETTINGS_MEMO_ = null;
function resetMemo_() { MEMO_ = {}; SETTINGS_MEMO_ = null; WCFG_MEMO_ = null; }
function getSettings_() {
  if (SETTINGS_MEMO_) return Object.assign({}, SETTINGS_MEMO_);
  SETTINGS_MEMO_ = getSettingsRaw_();
  return Object.assign({}, SETTINGS_MEMO_);
}

function getSettingsRaw_() {
  return getKV_(TAB.SETTINGS, SETTINGS);
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

/** "07:00-17:00" → [420, 1020] · "ปิด" / ว่าง → null */
function parseHours_(v) {
  const m = String(v || '').match(/(\d{1,2})[:.](\d{2})\s*[-–—ถึง]+\s*(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const a = Number(m[1]) * 60 + Number(m[2]);
  const b = Number(m[3]) * 60 + Number(m[4]);
  return b > a ? [a, b] : null;
}

/** "13/4, 14/4/2027" → ['2026-04-13', '2027-04-14'] (ปีว่าง = ปีนี้ · รองรับปี พ.ศ.) */
function parseHolidays_(v) {
  const year = Number(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy'));
  return String(v || '').split(/[,\n]+/).map((x) => x.trim()).filter(Boolean).map((x) => {
    let m = x.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = x.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
    if (!m) return '';
    let y = m[3] ? Number(m[3]) : year;
    if (y < 100) y += 2000;
    if (y > 2400) y -= 543;
    return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }).filter(Boolean);
}

/** โปรโมชั่นที่เปิดใช้และอยู่ในช่วงวันที่ (ตามเวลาไทย) */
function getPromos_() {
  let t;
  try { t = readTable_(TAB.PROMOS); } catch (e) { return []; }
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const day = (v) => {
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
    const h = parseHolidays_(v);
    return h.length ? h[0] : '';
  };
  return t.rows.filter((r) => {
    if (r.active !== true || !(r.title || r.image)) return false;
    const a = day(r.start), b = day(r.end);
    return (!a || a <= today) && (!b || today <= b);
  }).map((r) => ({
    image: imageUrl_(r.image),
    badge: String(r.badge || ''),
    title: String(r.title || ''),
    detail: String(r.detail || ''),
    target: PROMO_TARGETS.indexOf(String(r.target).trim()) >= 0 ? String(r.target).trim() : 'เมนู',
    link: /^https?:\/\//.test(String(r.link || '').trim()) ? String(r.link).trim() : '',
  }));
}

/** แปลงลิงก์แชร์ Google Drive เป็นลิงก์รูปที่แสดงในแอปได้ */
function imageUrl_(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/\/file\/d\/([\w-]{20,})/) || s.match(/[?&]id=([\w-]{20,})/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1] + '=w800';
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

  // 1) เคยตรวจ token นี้แล้ว → ใช้ผลที่จำไว้ (ไม่ต้องถาม LINE ซ้ำ)
  const cache = CacheService.getScriptCache();
  const key = 'tok:' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  // 2) อ่านว่า token มาจากช่องไหน แล้วถาม LINE ช่องนั้นช่องเดียว
  let order = CONFIG.CHANNEL_IDS.map(String);
  const aud = tokenAudience_(idToken);
  if (aud && order.indexOf(aud) >= 0) order = [aud];

  for (const channelId of order) {
    const res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'post',
      payload: { id_token: idToken, client_id: channelId },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 200) {
      const p = JSON.parse(res.getContentText());
      const user = { userId: p.sub, name: p.name || '', picture: p.picture || '' };
      const ttl = Math.min(3000, Math.floor(num_(p.exp) - Date.now() / 1000) - 60);
      if (ttl > 30) cache.put(key, JSON.stringify(user), ttl);
      return user;
    }
  }
  throw new Error('INVALID_TOKEN');
}

/** อ่านเลขช่อง (aud) จาก token โดยไม่ต้องถาม LINE — ใช้เลือกช่องเท่านั้น การยืนยันจริงยังทำกับ LINE */
function tokenAudience_(idToken) {
  try {
    let part = String(idToken).split('.')[1] || '';
    part += '==='.slice((part.length + 3) % 4);
    const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(part)).getDataAsString();
    return String(JSON.parse(json).aud || '');
  } catch (e) {
    return '';
  }
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
//  ส่วนที่ 10.5: จอง Wellness   ⛔ ไม่ต้องแก้
//  (ตั้งค่าทั้งหมดอยู่ในแท็บ Wellness และ Wellness ราคา)
// ════════════════════════════════════════════════════════════════

let WCFG_MEMO_ = null;

/** ตั้งค่าการจองจากแท็บ Wellness (แปลงเป็นตัวเลขพร้อมค่าเริ่มต้น) */
function bookingCfg_() {
  if (WCFG_MEMO_) return WCFG_MEMO_;
  const w = getKV_(TAB.WELLNESS, WELLNESS);
  const n = (v, def, min, max) => {
    const x = Math.floor(Number(String(v).replace(/[^\d.]/g, '')));
    return isFinite(x) && String(v).trim() !== '' ? Math.min(max, Math.max(min, x)) : def;
  };
  WCFG_MEMO_ = {
    title: w.title,
    mode: BOOK_MODES.indexOf(w.bookingMode) >= 0 ? w.bookingMode : 'ปิด',
    sessionMin: n(w.sessionMin, 60, 10, 600),
    bufferMin: n(w.bufferMin, 15, 0, 240),
    firstSlot: toMin_(w.firstSlot),
    lastEnd: toMin_(w.lastEnd),
    depositPct: n(w.depositPct, 50, 0, 100),
    maxPeople: n(w.maxPeople, 5, 1, 50),
    advanceDays: n(w.advanceDays, 14, 1, 90),
    leadMin: n(w.leadMin, 60, 0, 10080),
    holdMin: n(w.holdMin, 15, 5, 1440),
    cancelHours: n(w.cancelHours, 24, 0, 720),
    creditDays: n(w.creditDays, 60, 1, 3650),
    promptpay: String(w.promptpay || '').replace(/\D/g, ''),
    payName: w.payName,
    qrImage: w.qrImage,
    closedDates: parseHolidays_(w.closedDates),
    notifyStaff: w.notifyStaff !== 'ปิด',
    notifyCustomer: w.notifyCustomer !== 'ปิด',
  };
  return WCFG_MEMO_;
}

/** เรทราคาจากแท็บ Wellness ราคา */
function getTiers_() {
  let t;
  try { t = readTable_(TAB.WTIERS); } catch (e) { return []; }
  return t.rows.filter((r) => r.active === true && num_(r.price) > 0 && num_(r.min) >= 1).map((r) => {
    const min = Math.floor(num_(r.min));
    const max = Math.max(min, Math.floor(num_(r.max)) || min);
    const label = String(r.label || '').trim() || (min === max ? min + ' ท่าน' : min + '–' + max + ' ท่าน');
    return { label: label, min: min, max: max, price: num_(r.price) };
  }).sort((a, b) => a.min - b.min);
}

function priceFor_(tiers, people) {
  return tiers.find((t) => people >= t.min && people <= t.max) || null;
}

/** รอบของวันหนึ่ง → ['07:00', '08:15', ...] (วันปิด = []) */
function daySlots_(cfg, cal, iso) {
  if (cal.holidays.indexOf(iso) >= 0 || cfg.closedDates.indexOf(iso) >= 0) return [];
  const h = cal.hours[dow_(iso)];
  if (!h) return [];
  const start = cfg.firstSlot != null ? cfg.firstSlot : h[0];
  const end = cfg.lastEnd != null ? cfg.lastEnd : h[1];
  const out = [];
  for (let t = start; t + cfg.sessionMin <= end; t += cfg.sessionMin + cfg.bufferMin) out.push(hm_(t));
  return out;
}

/** เวลาเปิดร้านรายวัน + วันหยุด (จากแท็บตั้งค่าร้าน) */
function shopCalendar_() {
  const s = getSettings_();
  return {
    hours: ['hours_sun', 'hours_mon', 'hours_tue', 'hours_wed', 'hours_thu', 'hours_fri', 'hours_sat'].map((k) => parseHours_(s[k])),
    holidays: parseHolidays_(s.holidays),
  };
}

/** รอบว่างทั้งหมด [{ date, slots: [{ t, s: free | full | past }] }] */
function availability_(cfg) {
  const cal = shopCalendar_();
  const now = Date.now();
  const today = todayIso_();
  const taken = {};
  readTable_(TAB.BOOKINGS).rows.map(normBooking_).forEach((b) => {
    if (isOccupying_(b, now)) taken[b.date + ' ' + b.time] = true;
  });
  const days = [];
  for (let i = 0; i < cfg.advanceDays; i++) {
    const iso = addDays_(today, i);
    days.push({
      date: iso,
      slots: daySlots_(cfg, cal, iso).map((t) => ({
        t: t,
        s: taken[iso + ' ' + t] ? 'full' : slotEpoch_(iso, t) < now + cfg.leadMin * 60000 ? 'past' : 'free',
      })),
    });
  }
  return days;
}

function checkSlotFree_(cfg, date, time) {
  const day = availability_(cfg).find((d) => d.date === date);
  const slot = day && day.slots.find((x) => x.t === time);
  if (!slot || slot.s === 'past') throw new Error('INVALID_SLOT');
  if (slot.s === 'full') throw new Error('SLOT_TAKEN');
}

/** รายการนี้กันรอบไว้อยู่ไหม */
function isOccupying_(b, now) {
  if ([BS.SLIP, BS.OK, BS.IN].indexOf(b.status) >= 0) return true;
  return b.status === BS.HOLD && holdEnd_(b) > now;
}

function holdEnd_(b) {
  const t = b.holdUntil instanceof Date ? b.holdUntil.getTime() : new Date(b.holdUntil).getTime();
  return (isFinite(t) ? t : 0) + HOLD_GRACE_MIN * 60000;
}

/** ปิดรายการที่ยังไม่จ่าย (หมดเวลา / ยกเลิก / จองใหม่แทน) + คืนเครดิตที่ใช้ไป */
function endHold_(b, status, note) {
  b.status = status;
  if (num_(b.credit) > 0) b.creditLeft = num_(b.credit);
  b.doneAt = new Date();
  if (note) b.note = addNote_(b.note, note);
  updateRecord_(TAB.BOOKINGS, b);
}

/** รายการรอชำระที่หมดเวลา → เปลี่ยนสถานะ (ต้องอยู่ในล็อก) */
function sweep_() {
  const now = Date.now();
  readTable_(TAB.BOOKINGS).rows.map(normBooking_)
    .filter((b) => b.status === BS.HOLD && holdEnd_(b) <= now)
    .forEach((b) => endHold_(b, BS.EXPIRED, ''));
}

/** เช็กก่อนแบบไม่ล็อก มีรายการหมดเวลาค่อยล็อกแล้วเก็บกวาด */
function sweepIfNeeded_(filter) {
  const now = Date.now();
  const any = readTable_(TAB.BOOKINGS).rows.map(normBooking_)
    .some((b) => b.status === BS.HOLD && holdEnd_(b) <= now && filter(b));
  if (any) { withLock_(sweep_); clearSlotsCache_(); }
}

/** แปลงค่าจากชีตให้อยู่ในรูปแบบเดียวกัน (กันชีตแปลงวันที่/เวลาเอง) */
function normBooking_(b) {
  if (b.date instanceof Date) b.date = Utilities.formatDate(b.date, 'Asia/Bangkok', 'yyyy-MM-dd');
  if (b.time instanceof Date) b.time = Utilities.formatDate(b.time, 'Asia/Bangkok', 'HH:mm');
  if (b.creditExpiry instanceof Date) b.creditExpiry = Utilities.formatDate(b.creditExpiry, 'Asia/Bangkok', 'yyyy-MM-dd');
  b.date = String(b.date).trim();
  b.time = String(b.time).trim();
  b.status = String(b.status).trim();
  b.userId = String(b.userId).trim();
  b.bookingId = String(b.bookingId).trim();
  b.creditExpiry = String(b.creditExpiry || '').trim();
  return b;
}

function myBookings_(userId) {
  return readTable_(TAB.BOOKINGS).rows.map(normBooking_).filter((b) => b.userId === userId);
}

function findBooking_(id) {
  const key = String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!key) return null;
  return readTable_(TAB.BOOKINGS).rows.map(normBooking_)
    .find((b) => b.bookingId.toUpperCase().replace(/[^A-Z0-9]/g, '') === key) || null;
}

function ownBooking_(user, id) {
  const b = findBooking_(id);
  if (!b || b.userId !== user.userId) throw new Error('BOOKING_NOT_FOUND');
  return b;
}

function checkCanSlip_(b) {
  if (b.status === BS.SLIP) return;                // ส่งสลิปใหม่แทนรูปเดิมได้
  if (b.status !== BS.HOLD) throw new Error(b.status === BS.EXPIRED ? 'HOLD_EXPIRED' : 'BAD_STATUS');
  if (holdEnd_(b) <= Date.now()) throw new Error('HOLD_EXPIRED');
}

/** เครดิตมัดจำที่ยังใช้ได้ (หมดอายุก่อน ใช้ก่อน) */
function creditRows_(userId) {
  const today = todayIso_();
  return myBookings_(userId)
    .filter((b) => num_(b.creditLeft) > 0 && (!b.creditExpiry || b.creditExpiry >= today))
    .sort((a, b) => (a.creditExpiry < b.creditExpiry ? -1 : 1));
}

function newBookingId_() {
  const used = new Set(readTable_(TAB.BOOKINGS).rows.map((r) => String(r.bookingId)));
  const day = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyMMdd');
  let id;
  do { id = 'W' + day + '-' + Math.floor(100 + Math.random() * 900); } while (used.has(id));
  return id;
}

function bookingStart_(b) { return slotEpoch_(b.date, b.time); }
function bookingEnd_(b, cfg) { return bookingStart_(b) + cfg.sessionMin * 60000; }

/** ข้อมูลการจองที่ส่งให้ลูกค้า */
function publicBooking_(b, cfg) {
  normBooking_(b);
  const now = Date.now();
  const start = bookingStart_(b);
  const early = start - now >= cfg.cancelHours * 3600e3;
  const t = toMin_(b.time);
  return {
    id: b.bookingId, date: b.date, time: b.time, end: t == null ? '' : hm_(t + cfg.sessionMin),
    status: b.status, people: num_(b.people), pricePer: num_(b.pricePer), total: num_(b.total),
    deposit: num_(b.deposit), credit: num_(b.credit), payDue: num_(b.payDue), payAtShop: num_(b.payAtShop),
    holdUntil: b.status === BS.HOLD ? holdEnd_(b) - HOLD_GRACE_MIN * 60000 : null,
    hasSlip: !!b.slip, reschedules: num_(b.reschedules),
    canReschedule: [BS.SLIP, BS.OK].indexOf(b.status) >= 0 && num_(b.reschedules) < 1 && early,
    canCancel: b.status === BS.HOLD || (b.status === BS.OK && start > now),
    cancelGetsCredit: b.status === BS.OK && early,
    creditLeft: num_(b.creditLeft), creditExpiry: b.creditExpiry,
  };
}

/** ข้อมูลการจองที่ส่งให้พนักงาน (+ ชื่อ เบอร์ หมายเหตุ) */
function staffBooking_(b, cfg) {
  const p = publicBooking_(b, cfg);
  p.name = String(b.name || '');
  p.phone = String(b.phone || '');
  p.note = String(b.note || '');
  p.memberId = String(b.memberId || '');
  p.staffName = String(b.staffName || '');
  return p;
}

/** รูปสลิปจาก Drive → data URL (ให้พนักงานดูในแอป) */
function slipData_(url) {
  const m = String(url || '').match(/\/d\/([\w-]{20,})/) || String(url || '').match(/[?&]id=([\w-]{20,})/);
  if (!m) return '';
  try {
    const blob = DriveApp.getFileById(m[1]).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    console.warn('slip read', e);
    return '';
  }
}

function slipFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SLIP_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* โฟลเดอร์ถูกลบ → สร้างใหม่ */ }
  }
  const f = DriveApp.createFolder('2325 App · สลิปมัดจำ Wellness');
  props.setProperty('SLIP_FOLDER_ID', f.getId());
  return f;
}

function clearSlotsCache_() {
  try { CacheService.getScriptCache().remove(SLOTS_CACHE_KEY); } catch (e) { /* ignore */ }
}

function notifyStaff_(cfg, text) {
  if (!cfg.notifyStaff) return;
  readTable_(TAB.STAFF).rows.filter((r) => r.active === true && String(r.userId).trim())
    .forEach((r) => push_(String(r.userId).trim(), text));
}

function notifyCustomer_(cfg, userId, text) {
  if (cfg.notifyCustomer && userId) push_(userId, text);
}

/** ข้อความ 1 บรรทัดสำหรับแจ้งพนักงาน */
function bookingLine_(b) {
  return thaiDateTime_(b.date, b.time) + ' · ' + b.people + ' ท่าน\nคุณ' + b.name + ' ' + b.phone + ' (' + b.bookingId + ')';
}

/** พร้อมเพย์: เบอร์มือถือ 10 หลัก / เลขบัตร 13 หลัก / e-Wallet 15 หลัก */
function promptpayOk_(v) {
  const d = String(v || '').replace(/\D/g, '');
  return /^0\d{9}$/.test(d) || /^\d{13}$/.test(d) || /^\d{15}$/.test(d);
}

// ---------- เวลา (ใช้เวลาไทยเสมอ) ----------

const TH_DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function todayIso_() { return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'); }
function slotEpoch_(iso, time) { return new Date(iso + 'T' + time + ':00+07:00').getTime(); }
function dow_(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); }
function addDays_(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function hm_(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
function toMin_(v) {
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  const m = String(v || '').match(/^\s*(\d{1,2})[:.](\d{2})\s*$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function thaiDateTime_(iso, time) {
  const d = new Date(iso + 'T12:00:00Z');
  if (isNaN(d)) return iso + ' ' + time;
  return TH_DAY_SHORT[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + TH_MONTH_SHORT[d.getUTCMonth()] + ' · ' + time + ' น.';
}
function addNote_(old, text) {
  const stamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'd/M HH:mm');
  return (old ? String(old) + '\n' : '') + stamp + ' ' + text;
}


// ════════════════════════════════════════════════════════════════
//  ส่วนที่ 11: เครื่องมืออ่าน/เขียนชีต   ⛔ ไม่ต้องแก้
// ════════════════════════════════════════════════════════════════

/** อ่านทั้งแท็บ → [{ key: value, _row, _raw }] โดยจับคู่จากชื่อหัวคอลัมน์ */
/** จำตารางที่อ่านแล้วไว้ในคำขอเดียวกัน (อ่าน Sheet ครั้งเดียวต่อแท็บ) */
let MEMO_ = {};
function clearMemo_(tabName) {
  if (tabName) delete MEMO_[tabName]; else MEMO_ = {};
}

function readTable_(tabName) {
  if (MEMO_[tabName]) return MEMO_[tabName];
  const t = readTableRaw_(tabName);
  MEMO_[tabName] = t;
  return t;
}

function readTableRaw_(tabName) {
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
  clearMemo_(tabName);
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
  clearMemo_(tabName);
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
  clearMemo_(); // อ่านข้อมูลล่าสุดหลังได้ล็อก
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
