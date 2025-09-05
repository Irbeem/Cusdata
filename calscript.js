// ====== calscript.js (หัวไฟล์ โค้ดใหม่) ======
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getDatabase, ref, get
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ----- อ่านค่าจาก config.js -----
const firebaseConfig = window.FIREBASE_CONFIG;
const REQUIRE_ROLE   = window.REQUIRE_ROLE ?? true;
const ALLOWED_ROLES  = Array.isArray(window.ALLOWED_ROLES) ? window.ALLOWED_ROLES : [];

const SHEET_ID = window.SHEET_ID;
const CALENDAR_SHEET = window.CALENDAR_SHEET;
const NAMES_SHEET = window.NAMES_SHEET;
const SpecialHolidays_SHEET = window.SpecialHolidays_SHEET;

// ----- DOM refs (ที่มีอยู่แล้วในหน้า) -----
const loginOverlay = document.getElementById("loginOverlay");
const appRoot      = document.getElementById("app");

const monthSel = document.getElementById("month");
const yearSel  = document.getElementById("year");
const overlay  = document.getElementById("overlay");
const popup    = document.getElementById("popupForm");

const popupName     = document.getElementById("popupName");
const popupDate     = document.getElementById("popupDate");
const popupType     = document.getElementById("popupType");
const popupTime     = document.getElementById("popupTime");
const popupDetail   = document.getElementById("popupDetail");
const popupCustomer = document.getElementById("popupCustomer");
const popupPlace    = document.getElementById("popupPlace");
const popupJobowner = document.getElementById("popupJobowner");
const popupCharge   = document.getElementById("popupCharge");

// ----- ตัวแปรทำงานเดิม -----
let names = [], allData = [], specialHolidays = [];
let activeCell = null;

// ===== Firebase Init =====
if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.error("🔥 ยังไม่ได้ตั้งค่า FIREBASE_CONFIG ใน config.js");
  alert("ยังไม่ได้ตั้งค่า Firebase (config.js)");
}

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// ===== UI Helper เดิม =====
function showLogin() {
  loginOverlay.style.display = "block";
  appRoot.style.display = "none";
}
function showApp() {
  loginOverlay.style.display = "none";
  appRoot.style.display = "block";
}

// ===== Auth Gate =====
async function fetchUserRole(uid) {
  try {
    const snap = await get(ref(db, `users/${uid}/role`));
    return snap.exists() ? snap.val() : null;
  } catch (e) {
    console.error("get role error:", e);
    return null;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // ยังไม่ล็อกอิน
    showLogin();
    return;
  }

  // ล็อกอินแล้ว → ตรวจ role (ถ้าบังคับ)
  if (REQUIRE_ROLE) {
    const role = await fetchUserRole(user.uid);
    if (!role) {
      alert("บัญชีนี้ยังไม่มีสิทธิ์เข้าใช้งาน (ไม่พบ role)");
      await signOut(auth);
      showLogin();
      return;
    }
    if (ALLOWED_ROLES.length > 0 && !ALLOWED_ROLES.includes(role)) {
      alert(`สิทธิ์ไม่เพียงพอ (role = ${role})`);
      await signOut(auth);
      showLogin();
      return;
    }
    // เก็บ role ไว้เผื่อส่วนอื่นใช้
    window.CURRENT_ROLE = role;
  }

  // ผ่าน gate → แสดงแอปและโหลดข้อมูล
  window.CURRENT_UID = user.uid;
  showApp();
  init(); // ← เรียกฟังก์ชันเดิมของคุณ เพื่อโหลดข้อมูล/เรนเดอร์ตาราง
});

// ===== ปุ่ม Login / Logout =====
async function doLogin() {
  const email = document.getElementById('loginUser').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) {
    alert('กรุณากรอกอีเมลและรหัสผ่าน');
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged จะโชว์แอป+init ให้เอง
  } catch (e) {
    console.error(e);
    alert(e?.message || 'เข้าสู่ระบบไม่สำเร็จ');
  }
}

async function logout() {
  try {
    await signOut(auth);
    showLogin();
  } catch (e) {
    console.error(e);
    alert('ออกจากระบบไม่สำเร็จ');
  }
}

function resetLogin() {
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginUser').focus();
}

// ====== (คงไว้) ฟังก์ชัน calendar เดิมของคุณทั้งหมด อยู่ต่อจากนี้เลย ======
// - init()
// - renderTable(), cellClick(), openPopup(), closePopup(), saveData(), deleteData()
// - showDetails(), closeDetails(), openEditFromDetail()
// - openHolidayModal(), closeHoliday(), saveHoliday(), deleteHoliday()
// - exportMonthToCSV()
// - wheel scroll handler ฯลฯ
// ---------- Calendar Core ----------
function init() {
  const now = new Date();
  const savedMonth = parseInt(localStorage.getItem('savedMonth'));
  const savedYear  = parseInt(localStorage.getItem('savedYear'));
  const defMonth = !isNaN(savedMonth) ? savedMonth : now.getMonth() + 1;
  const defYear  = !isNaN(savedYear)  ? savedYear  : now.getFullYear();

  // เติม month/year
  monthSel.innerHTML = "";
  for (let i = 1; i <= 12; i++) {
    const opt = new Option(i, i);
    if (i === defMonth) opt.selected = true;
  headCells.forEach((th, idx) => {
    if (th.classList.contains('sun') || th.classList.contains('sat')) {
      weekendIdx.push({ index: idx + 1, cls: th.classList.contains('sat') ? 'sat' : 'sun' });
    }
  });
  table.querySelectorAll('tbody td.weekend').forEach(td => td.classList.remove('weekend', 'sat'));
  table.querySelectorAll('tbody tr').forEach(tr => {
    weekendIdx.forEach(({ index, cls }) => {
      const td = tr.querySelector(`td:nth-child(${index})`);
      if (td) { td.classList.add('weekend'); if (cls === 'sat') td.classList.add('sat'); }
    });
  });
}

function openHolidayModal(y, m, d) {
  const yy = (y != null ? y : +document.getElementById('year').value);
  const mm = (m != null ? m : +document.getElementById('month').value);
  const dd = (d != null ? d : 1);
  document.getElementById('holYear').value = yy;
  document.getElementById('holMonth').value = mm;
  document.getElementById('holDate').value = dd;
  document.getElementById('holDetail').value = '';
  overlay.classList.add('active');
  document.getElementById('holidayModal').classList.add('active');
}
function closeHoliday() {
  document.getElementById('holidayModal').classList.remove('active');
  overlay.classList.remove('active');
}
function saveHoliday() {
  const year = (document.getElementById('holYear').value || '').trim();
  const month = +document.getElementById('holMonth').value;
  const date  = +document.getElementById('holDate').value;
  const detail= document.getElementById('holDetail').value || '';
  if (!month || !date) { alert('กรุณากรอก Month และ Date'); return; }
  const form = document.getElementById('submitForm');
  form.year.value = year; form.month.value = month; form.date.value = date; form.name.value = '';
  form.type.value = ''; form.time.value = ''; form.datail.value = ''; form.customer.value = '';
  form.place.value = ''; form.jobowner.value = ''; form.charge.value = '';
  form.holidayDetail.value = detail; form.action.value = 'addHoliday';
  const iframe = document.getElementById('hidden_frame');
  closeHoliday();
  localStorage.setItem('savedMonth', monthSel.value);
  localStorage.setItem('savedYear', yearSel.value);
  iframe.onload = () => { iframe.onload = null; location.reload(); };
  setTimeout(() => { if (iframe.onload) { iframe.onload = null; location.reload(); } }, 6000);
  form.submit();
}
function deleteHoliday() {
  const year = (document.getElementById('holYear').value || '').trim();
  const month = +document.getElementById('holMonth').value;
  const date  = +document.getElementById('holDate').value;
  if (!month || !date) { alert('กรุณากรอก Month และ Date'); return; }
  const form = document.getElementById('submitForm');
  form.year.value = year; form.month.value = month; form.date.value = date; form.name.value = '';
  form.type.value = ''; form.time.value = ''; form.datail.value = ''; form.customer.value = '';
  form.place.value = ''; form.jobowner.value = ''; form.charge.value = '';
  form.holidayDetail.value = ''; form.action.value = 'removeHoliday';
  const iframe = document.getElementById('hidden_frame');
  closeHoliday();
  localStorage.setItem('savedMonth', monthSel.value);
  localStorage.setItem('savedYear', yearSel.value);
  iframe.onload = () => { iframe.onload = null; location.reload(); };
  setTimeout(() => { if (iframe.onload) { iframe.onload = null; location.reload(); } }, 6000);
  form.submit();
}

function exportMonthToCSV() {
  const year = +yearSel.value;
  const month = +monthSel.value;
  const filtered = allData.filter(row => +row.year === year && +row.month === month);
  if (filtered.length === 0) { alert("ไม่มีข้อมูลในเดือนนี้"); return; }
  const headers = ["Year","Month","Date","Name","Type","Time","Detail","Customer","Place","JobOwner","Charge"];
  const rows = [headers.join(",")];
  filtered.forEach(row => {
    const csvRow = [
      row.year, row.month, row.date, row.name, row.type, row.time,
      `"${row.datail?.replace(/"/g, '""') || ''}"`,
      `"${row.customer?.replace(/"/g, '""') || ''}"`,
      `"${row.place?.replace(/"/g, '""') || ''}"`,
      `"${row.jobowner?.replace(/"/g, '""') || ''}"`,
      row.charge
    ];
    rows.push(csvRow.join(","));
  });
  const BOM = "\uFEFF";
  const csvContent = BOM + rows.join("\n");
  const now = new Date();
  const tday = now.getDate();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${hh}-${mm}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `calendar-${year}-${month}-save-${tday}-${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// สกรอลล์ล้อเมาส์ (คงเดิม)
document.querySelector('.calendar-wrapper').addEventListener('wheel', function(e) {
  e.preventDefault();
  const rowHeight = 80;
  const step = rowHeight * 2;
  this.scrollTop += (e.deltaY > 0 ? step : -step);
});

// ---------- Boot ----------
// (function boot() {
//   const currentUser = localStorage.getItem(AUTH_KEY);
//   if (currentUser) { showApp(); init(); }
//   else { showLogin(); }
// })();

// (สำคัญ) เอาโค้ดเดิมที่ใช้ localStorage เช็ค login ออก:
//   (function boot() { ... })  // ← ลบทิ้ง
// เพราะตอนนี้เราใช้ onAuthStateChanged แทนเรียบร้อยแล้ว

// ----- Expose to window (ปรับเฉพาะ auth/boot) -----
window.doLogin = doLogin;
window.resetLogin = resetLogin;
window.logout = logout;

// หมายเหตุ: การ expose ฟังก์ชันอื่น ๆ ของ calendar เดิมคุณ (renderTable/saveData/...) ให้คงไว้ตามเดิม
