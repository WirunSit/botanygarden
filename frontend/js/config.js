/**
 * ตั้งค่าหน้าเว็บ
 *
 * API_URL = URL ของ Apps Script Web App (ลงท้ายด้วย /exec)
 *   - เว้นว่าง  → ถ้าเปิดผ่าน Apps Script จะเรียก google.script.run อัตโนมัติ
 *                 ถ้าเปิดจากเครื่อง (dev server) จะเข้า "โหมดทดลอง" ข้อมูลเก็บในเบราว์เซอร์
 *   - ใส่ URL   → ใช้กับหน้าเว็บที่ฝากไว้บน GitHub Pages / Firebase Hosting (ทางเลือก B)
 */
window.BMF_CONFIG = {
  API_URL: ''
};
