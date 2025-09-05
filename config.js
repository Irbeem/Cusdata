// ====== config.js (ใหม่) ======
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCSYG70O7gB17kwrXwL_S5e9dDwec7zhS0",
  authDomain: "custdata-92ebe.firebaseapp.com",
  databaseURL: "https://custdata-92ebe-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "custdata-92ebe",
  storageBucket: "custdata-92ebe.appspot.com",
  messagingSenderId: "187239785555",
  appId: "1:187239785555:web:d31eeab8dcd73990a812a6",
  measurementId: "G-LFG056C8SL"
};

// ตั้งค่าว่าจะ “บังคับมี role” ไหม (อ่านจาก RTDB path: users/{uid}/role)
// - ถ้า true: ต้องมีค่า role ถึงจะเข้าได้ (เช่น "admin" หรือ "viewer")
// - ถ้า false: แค่ล็อกอินสำเร็จก็เข้าได้
window.REQUIRE_ROLE = true;

// ถ้าจะจำกัดเฉพาะบาง role (ปล่อยว่าง = อนุญาตทุก role ที่ไม่ว่าง)
window.ALLOWED_ROLES = ["admin", "viewer"];

// ====== config.js ======
window.CREDENTIALS = [
  { user: "bee",   pass: "1234" },
  { user: "csbkk", pass: "cs2025" },
];

window.AUTH_KEY = "cs_calendar_auth_user";

// ชีต
window.SHEET_ID = "1ySiuPMVyrNOpNxx5fR0olf2Dbaq84zKVlVaVo6mFBi8";
window.CALENDAR_SHEET = "Carlendar";
window.NAMES_SHEET = "Names";
window.SpecialHolidays_SHEET = "SpecialHolidays";




