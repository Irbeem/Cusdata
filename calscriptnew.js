// ====== calscript.js (ตรวจ Auth ก่อนแสดงตาราง; ไม่มี login/logout หน้านี้) ======
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ----- อ่านค่าจาก config.js -----
const firebaseConfig = window.FIREBASE_CONFIG;
const REQUIRE_ROLE   = window.REQUIRE_ROLE ?? true;
const ALLOWED_ROLES  = Array.isArray(window.ALLOWED_ROLES) ? window.ALLOWED_ROLES : [];

// ชีตจาก config.js
const SHEET_ID = window.SHEET_ID;
const CALENDAR_SHEET = window.CALENDAR_SHEET;
const NAMES_SHEET = window.NAMES_SHEET;
const SpecialHolidays_SHEET = window.SpecialHolidays_SHEET;

// ตั้ง path ของ "หน้า Login ต้นทาง" (ปรับให้ถูกกับของจริง)
const LOGIN_PAGE_URL = "/index.html";

// DOM หลัก
const appRoot = document.getElementById("app");
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

// ตัวแปรทำงาน
let names = [], allData = [], specialHolidays = [];
let activeCell = null;
let currentProfile = { name: null, role: null };   // ✅ ประกาศให้แน่ชัด

// Init Firebase
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// helper: ดึง role จาก RTDB
async function getUserRole(uid) {
  try {
    const snap = await get(ref(db, `users/${uid}/role`));
    return snap.exists() ? snap.val() : null;
  } catch (e) {
    console.error("get role error:", e);
    return null;
  }
}

// เริ่มตรวจ auth ทันทีที่โหลดหน้า
onAuthStateChanged(auth, async (user) => {
  // ซ่อนแอพไว้ก่อน
  if (appRoot) appRoot.style.display = "none";

  if (!user) {
    // ยังไม่ล็อกอิน -> ส่งไปหน้า login พร้อม back=URL ปัจจุบัน
    const back = encodeURIComponent(location.href);
    location.replace(`${LOGIN_PAGE_URL}?back=${back}`);
    return;
  }

  // ===== ดึงโปรไฟล์ผู้ใช้จาก RTDB =====
  let roleFromProfile = null;
  try {
    // << สำคัญ: ใช้ backtick รอบ path >>
    const snap = await get(ref(db, `users/${user.uid}`));
    const val = snap.exists() ? snap.val() : {};
    currentProfile = { name: val.name ?? null, role: val.role ?? null };
    roleFromProfile = currentProfile.role ?? null;
  } catch (err) {
    console.error("get user profile error:", err);
    currentProfile = { name: null, role: null };
  }

  // ===== ใส่ค่า actor ลง hidden fields ไว้ล่วงหน้า =====
  //const uidEl   = document.getElementById("actorUid");
  //const emailEl = document.getElementById("actorEmail");
  const nameEl  = document.getElementById("actorName");

  //if (uidEl)   uidEl.value   = user.uid || "";
  //if (emailEl) emailEl.value = user.email || "";
  if (nameEl)  nameEl.value  = (currentProfile.name || user.email || user.uid || "Not login");

  // ===== ตรวจสิทธิ์ (ถ้าบังคับ) =====
  if (REQUIRE_ROLE) {
    // ใช้ role ในโปรไฟล์ก่อน ถ้าไม่มีค่อยไปดึงด้วยฟังก์ชัน getUserRole()
    const role = roleFromProfile || await getUserRole(user.uid);
    if (!role) {
      alert("บัญชีนี้ยังไม่มีสิทธิ์เข้าใช้งาน (ไม่พบ role)");
      await signOut(auth);
      const back = encodeURIComponent(location.href);
      location.replace(`${LOGIN_PAGE_URL}?back=${back}`);
      return;
    }
    if (ALLOWED_ROLES.length > 0 && !ALLOWED_ROLES.includes(role)) {
      alert(`สิทธิ์ไม่เพียงพอ (role = ${role})`);
      await signOut(auth);
      const back = encodeURIComponent(location.href);
      location.replace(`${LOGIN_PAGE_URL}?back=${back}`);
      return;
    }
    window.CURRENT_ROLE = role;
  }

  // ผ่านทุกอย่าง -> แสดงแอปและเริ่มโหลดตาราง
  if (appRoot) appRoot.style.display = "";
  window.CURRENT_UID = user.uid;
  init(); // โหลด Google Sheet + render ตาราง (ตามโค้ดเดิมของคุณ)
});

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
    monthSel.add(opt);
  }
  yearSel.innerHTML = "";
  for (let y = 2025; y <= now.getFullYear() + 3; y++) {
    const opt = new Option(y, y);
    if (y === defYear) opt.selected = true;
    yearSel.add(opt);
  }

  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
  Promise.all([
    fetch(`${base}&sheet=${NAMES_SHEET}`).then(r => r.text()),
    fetch(`${base}&sheet=${CALENDAR_SHEET}`).then(r => r.text()),
    fetch(`${base}&sheet=${SpecialHolidays_SHEET}`).then(r => r.text())
  ]).then(([namesTxt, dataTxt, holidayTxt]) => {
    const namesJson = JSON.parse(namesTxt.substring(47).slice(0, -2));
    names = namesJson.table.rows
      .map(r => r.c[0]?.v)
      .filter(name => name && name.toLowerCase() !== "summary");

    const dataJson = JSON.parse(dataTxt.substring(47).slice(0, -2));
    const cols = dataJson.table.cols.map(c => c.label);
    allData = dataJson.table.rows.map(r => {
      const o = {};
      r.c.forEach((c, i) => o[cols[i]] = c?.v || "");
      return o;
    });

    const holidayJson = JSON.parse(holidayTxt.substring(47).slice(0, -2));
    specialHolidays = holidayJson.table.rows.map(r => ({
      year:   r.c[0]?.v || '',
      month:  r.c[1]?.v,
      date:   r.c[2]?.v,
      detail: r.c[3]?.v || ''
    })).filter(h => h.month && h.date);

    renderTable();
  }).catch(err => {
    console.error("โหลดข้อมูลไม่สำเร็จ:", err);
    alert("โหลดข้อมูลไม่สำเร็จ ดู Console สำหรับรายละเอียด");
    // กลับไปหน้า login เพื่อให้ผู้ใช้ลองใหม่
    const back = encodeURIComponent(location.href);
    location.replace(`${LOGIN_PAGE_URL}?back=${back}`);
  });
}

function renderTable() {
  const year = +yearSel.value;
  const month = +monthSel.value;
  const days = new Date(year, month, 0).getDate();
  const thead = document.querySelector("#calendar-table thead");
  const tbody = document.querySelector("#calendar-table tbody");

  // รวมรายชื่อจาก Names + จากข้อมูลจริง
  //const extraNames = new Set();
  //allData.forEach(d => {
  //  if (d.name && !names.includes(d.name)) extraNames.add(d.name);
  //});
  //const allNames = [...names, ...[...extraNames].sort()];

  // รวมรายชื่อจาก Names + ชื่อที่มี "งานในเดือน/ปีนี้เท่านั้น"
  const monthActiveNames = new Set(
  allData
    .filter(d => +d.year === year && +d.month === month && d.name)
    .map(d => String(d.name))
  );

  // extra = ชื่อที่ไม่มีใน Names sheet แต่มีงานในเดือนนี้
  const extraNames = [...monthActiveNames].filter(n => !names.includes(n));

  // ชื่อที่จะแสดง: รายชื่อจาก Names + extra (เรียงท้าย)
  const allNames = [...names, ...extraNames.sort()];

  const dataMap = {};
  const summary = { Service: 0, Standby: 0, Meeting: 0, Visit: 0, Telephone: 0, TrainingCustomer: 0, TrainingInternal: 0, TrainingSafety: 0, Inspection: 0, LTC: 0, Warranty: 0, RepairPP: 0, Repair: 0, Sales: 0, Leave: 0, SafetyHealth: 0, Other: 0 };
  allNames.forEach(name => (dataMap[name] = {}));

  allData.forEach(d => {
    if (+d.year === year && +d.month === month) {
      const tooltip = `${d.type}\n${d.customer}\n${d.time}\n${d.datail}\n${d.place}\n${d.jobowner}\n${d.charge}`;
      const html = `<div class='event ${d.type}' title="${tooltip}">${d.type}<br>${d.customer || ''}</div>`;
      (dataMap[d.name][d.date] ||= []).push(html);
      if (summary[d.type] !== undefined) summary[d.type]++;
    }
  });

  const dayClass = ["sun","mon","tue","wed","thu","fri","sat"];
  const daysHeader = Array.from({ length: days }, (_, i) => {
    const d = i + 1;
    const dow = new Date(year, month - 1, d).getDay();
    const dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow];
    const holiday = specialHolidays.find(h =>
      h.date == d && h.month == month && (!h.year || +h.year === year)
    );
    const isHoliday = !!holiday; const holidayName = holiday?.detail || "";
    return `<th class="${dayClass[dow]}${isHoliday ? ' holiday' : ''}" data-day="${d}" style="user-select:none;"
              onclick="openHolidayModal(${year},${month},${d})">
              <div style="font-size:.7em;font-weight:normal;">${dayName}</div>
              <div style="font-size:1.2em;">${d}</div>
              ${isHoliday ? `<div style="font-size:.6em;color:#1156c4;">${holidayName}</div>` : ""}
            </th>`;
  });
  thead.innerHTML = `<tr><th>Name</th>${daysHeader.join('')}</tr>`;

  const bodyHTML = allNames.map(name => {
    const row = [`<td>${name}</td>`];
    for (let d = 1; d <= days; d++) {
      const cell = (dataMap[name] && dataMap[name][d]) ? dataMap[name][d].join('') : "";
      row.push(`<td data-name="${name}" data-day="${d}" onclick="cellClick(this)">${cell}</td>`);
    }
    return `<tr>${row.join('')}</tr>`;
  }).join('');
  tbody.innerHTML = bodyHTML;

  // ไฮไลท์ชื่อแถวเมื่อคลิกคอลัมน์แรก
  document.querySelector('#calendar-table tbody').addEventListener('click', (e) => {
    const td = e.target.closest('td');
    if (!td) return;
    if (td.cellIndex === 0) {
      const tr = td.parentElement;
      document.querySelectorAll('#calendar-table tbody tr.selected-row')
        .forEach(r => r.classList.remove('selected-row'));
      tr.classList.add('selected-row');
    }
  });

  // Summary
const dock = document.getElementById('summaryDock');
if (dock) {
  dock.innerHTML = `
    <div class="summary-box">
      <h4>📊 Summary job ${month}/${year}</h4>
      <ul>
        ${Object.entries(summary)
            .map(([k,v]) => `<li>${k}: ${v} Times</li>`)
            .join("")}
      </ul>
    </div>
  `;
}

  localStorage.removeItem('savedMonth');
  localStorage.removeItem('savedYear');

  // ไฮไลท์วันหยุดพิเศษทั้งคอลัมน์
  specialHolidays.forEach(h => {
    if (h.month === month && (!h.year || +h.year === year)) {
      const idx = h.date;
      const th = thead.querySelector(`th[data-day="${idx}"]`);
      if (th) th.classList.add("holiday", "special-holiday");
      document.querySelectorAll(`#calendar-table tbody td[data-day="${idx}"]`)
        .forEach(td => td.classList.add("holiday-col", "special-holiday"));
    }
  });

  highlightWeekendColumns();
}

// ช่วยตั้งค่าเดือน/ปี แล้ว render
function setMonthYearAndRender(y, m) {
  // ปรับค่าสำหรับข้ามปีอัตโนมัติ
  if (m < 1) { m = 12; y -= 1; }
  if (m > 12) { m = 1;  y += 1; }

  // เซ็ตค่าใน select
  document.getElementById('month').value = m;
  document.getElementById('year').value  = y;

  // จำค่าไว้ใช้ตอนโหลดหน้าใหม่
  localStorage.setItem("savedMonth", m);
  localStorage.setItem("savedYear", y);

  // วาดตารางใหม่
  if (typeof renderTable === 'function') renderTable();
}

// ไปเดือนก่อนหน้า
function gotoPrevMonth() {
  const m = +document.getElementById('month').value;
  const y = +document.getElementById('year').value;
  setMonthYearAndRender(y, m - 1);
}

// ไปเดือนถัดไป
function gotoNextMonth() {
  const m = +document.getElementById('month').value;
  const y = +document.getElementById('year').value;
  setMonthYearAndRender(y, m + 1);
}

function gotoThisMonth() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;

  setMonthYearAndRender(y, m);
}
// ผูกให้เรียกได้จากปุ่ม (ถ้าใช้ inline onclick)
// ให้เรียกใช้ได้จากปุ่มใน HTML
window.gotoThisMonth = gotoThisMonth;
window.gotoPrevMonth = gotoPrevMonth;
window.gotoNextMonth = gotoNextMonth;

// ===== Zoom ใหม่ ด้วยตัวแปร CSS (--cal-scale) =====
let calScale = parseFloat(localStorage.getItem('calScale') || '1');

function applyScale() {
  document.documentElement.style.setProperty('--cal-scale', calScale);
}
function zoomIn()  { calScale = Math.min(2,   +(calScale + 0.1).toFixed(2)); localStorage.setItem('calScale', calScale); applyScale(); }
function zoomOut() { calScale = Math.max(0.6, +(calScale - 0.1).toFixed(2)); localStorage.setItem('calScale', calScale); applyScale(); }
function zoomReset(){ calScale = 1; localStorage.setItem('calScale', calScale); applyScale(); }

// เรียกตอนโหลด
applyScale();

// Expose ให้ปุ่มเรียกได้
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.zoomReset = zoomReset;

// ---- ป๊อปอัป/แก้ไข/บันทึก ----
function openPopup(td) {
  activeCell = td;
  popupName.textContent = td.dataset.name;
  popupDate.textContent = td.dataset.day;
  popupType.value = "Service";
  popupTime.value = "";
  popupDetail.value = "";
  popupCustomer.value = "";
  popupPlace.value = "";
  popupJobowner.value = "";
  popupCharge.value = "Nocharge";
  overlay.classList.add("active");
  popup.classList.add("active");
}
function closePopup() {
  overlay.classList.remove("active");
  popup.classList.remove("active");
}
function saveData() {
  const form = document.getElementById("submitForm");
  form.year.value = yearSel.value;
  form.month.value = monthSel.value;
  form.date.value = activeCell.dataset.day;
  form.name.value = activeCell.dataset.name;
  form.type.value = popupType.value;
  form.time.value = popupTime.value;
  form.datail.value = popupDetail.value; // NOTE: ถ้าจะเปลี่ยนเป็น detail ให้แก้ทั้งฝั่ง GAS/HTML
  form.customer.value = popupCustomer.value;
  form.place.value = popupPlace.value;
  form.jobowner.value = popupJobowner.value;
  form.charge.value = popupCharge.value;
  form.sendEmail.value = document.getElementById("popupSendEmail").checked ? "true" : "false";
  form.action.value = "save";
  form.actorName.value  = (currentProfile?.name || auth.currentUser?.email || "");

  const html = `<div class='event ${form.type.value}'>${form.type.value}<br>${form.time.value}<br>${form.datail.value}<br>${form.customer.value}<br>${form.place.value}<br>${form.jobowner.value}<br>${form.charge.value}</div>`;
  activeCell.innerHTML = html;
  closePopup();
  localStorage.setItem('savedMonth', monthSel.value);
  localStorage.setItem('savedYear', yearSel.value);
  submitAndWait();
}
function deleteData() {
  if (!confirm("Delete?")) return;
  const form = document.getElementById("submitForm");
  form.year.value = yearSel.value;
  form.month.value = monthSel.value;
  form.date.value = activeCell.dataset.day;
  form.name.value = activeCell.dataset.name;
  form.type.value = popupType.value;
  form.time.value = popupTime.value;
  form.datail.value = "";
  form.action.value = "delete";
  form.actorName.value  = (currentProfile?.name || auth.currentUser?.email || "");

  activeCell.innerHTML = "";
  closePopup();
  localStorage.setItem('savedMonth', monthSel.value);
  localStorage.setItem('savedYear', yearSel.value);
  submitAndWait();
}
function submitAndWait() {
  const form = document.getElementById('submitForm');
  const iframe = document.getElementById('hidden_frame');
  if (!iframe) { form.submit(); setTimeout(() => location.reload(), 2000); return; }
  closePopup();
  iframe.onload = () => { iframe.onload = null; closePopup(); location.reload(); };
  setTimeout(() => {
    if (iframe.onload) { iframe.onload = null; closePopup(); location.reload(); }
  }, 6000);
  form.submit();
}

function cellClick(td) {
  activeCell = td;
  const year = +yearSel.value;
  const month = +monthSel.value;
  const day = +td.dataset.day;
  const name = td.dataset.name;
  const items = allData.filter(d =>
    +d.year === year && +d.month === month && +d.date === day && String(d.name) === String(name)
  );
  if (items.length > 0) showDetails(items, { name, day, month, year });
  else openPopup(td);
}
function showDetails(items, meta) {
  const box = document.getElementById('detailContent');
  const html = items.map((d, i) => {
    const lines = [
      `<b>${i+1}. ${d.type || '-'}</b>`,
      d.customer ? `Customer: ${d.customer}` : '',
      d.time ? `Time: ${d.time}` : '',
      d.datail ? `Detail: ${d.datail}` : '',
      d.place ? `Place: ${d.place}` : '',
      d.jobowner ? `Job Owner: ${d.jobowner}` : '',
      d.charge ? `Charge: ${d.charge}` : ''
    ].filter(Boolean);
    return `<div style="padding:8px;border:1px solid #eee;border-radius:6px;margin-bottom:8px">${lines.join('<br>')}</div>`;
  }).join('') || '<i>No detail</i>';
  box.innerHTML = `<div style="margin-bottom:6px;color:#555">👤 <b>${meta.name}</b> — 📅 ${meta.day}/${meta.month}/${meta.year}</div>${html}`;
  overlay.classList.add("active");
  document.getElementById('detailModal').classList.add('active');
}
function closeDetails() {
  document.getElementById('detailModal').classList.remove('active');
  overlay.classList.remove('active');
}
function openEditFromDetail() {
  document.getElementById('detailModal').classList.remove('active');
  if (activeCell) openPopup(activeCell);
  else overlay.classList.remove('active');
}

function highlightWeekendColumnsold() {
  const table = document.getElementById('calendar-table');
  const headCells = table.querySelectorAll('thead th');
  const weekendIdx = [];
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

function highlightWeekendColumns() {
  const table = document.getElementById('calendar-table');
  if (!table) return;

  // หา index ของคอลัมน์เสาร์/อาทิตย์จากหัวตาราง
  const headCells = table.querySelectorAll('thead th');
  const weekendIdx = []; // [{ index: number, cls: 'sat'|'sun' }]
  headCells.forEach((th, idx) => {
    if (th.classList.contains('sat') || th.classList.contains('sun')) {
      weekendIdx.push({ index: idx + 1, cls: th.classList.contains('sat') ? 'sat' : 'sun' });
    }
  });

  // ล้างคลาสเดิมใน tbody
  table.querySelectorAll('tbody td').forEach(td => {
    td.classList.remove('weekend', 'sat', 'sun');
  });

  // เติมคลาส weekend + sat/sun ให้คอลัมน์ที่ตรง
  table.querySelectorAll('tbody tr').forEach(tr => {
    weekendIdx.forEach(({ index, cls }) => {
      const td = tr.querySelector(`td:nth-child(${index})`);
      if (td) td.classList.add('weekend', cls);
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

// สกรอลล์ล้อเมาส์ (เช็ค element ก่อน)
const wrapper = document.querySelector('.calendar-wrapper');
if (wrapper) {
  wrapper.addEventListener('wheel', function(e) {
    e.preventDefault();
    const rowHeight = 80;
    const step = rowHeight * 2;
    this.scrollTop += (e.deltaY > 0 ? step : -step);
  }, { passive: false });
}

// ==== MAGNIFIER (ใช้ html2canvas) ====
let MAG_ON = false;
let magScale = 2.4;        // ระดับขยายในเลนส์
let magSize  = 260;        // ขนาดเลนส์ (px)
let magImgURL = null;      // dataURL ของ snapshot
let magMeta = null;        // {left, top, width, height} ของพื้นที่ตาราง
let magMoveHandler = null; // reference สำหรับถอด event ทีหลัง
let magResizeHandler = null;

function ensureLensElement() {
  let lens = document.getElementById('magnifierLens');
  if (!lens) {
    lens = document.createElement('div');
    lens.id = 'magnifierLens';
    document.body.appendChild(lens);
  }
  // ปรับขนาดตามตัวแปร
  lens.style.width = magSize + 'px';
  lens.style.height = magSize + 'px';
  return lens;
}

async function buildSnapshot() {
  const wrapper = document.querySelector('.calendar-wrapper') || document.getElementById('calendar-table');
  if (!wrapper) throw new Error('ไม่พบ calendar-wrapper หรือ #calendar-table');

  // ตำแหน่งและขนาดของ element บน viewport
  const rect = wrapper.getBoundingClientRect();
  magMeta = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };

  // ถ่ายภาพด้วย html2canvas
  const canvas = await html2canvas(wrapper, {
    backgroundColor: null,
    scale: window.devicePixelRatio || 1,
    useCORS: true,
    logging: false
  });
  magImgURL = canvas.toDataURL('image/png');
}

function onMagMouseMove(e) {
  const lens = ensureLensElement();
  if (!magImgURL || !magMeta) return;

  const { clientX: cx, clientY: cy } = e;

  // ตำแหน่งเมาส์เทียบกับพื้นที่ตารางที่ snapshot ไว้
  const rx = cx - magMeta.left;
  const ry = cy - magMeta.top;

  // ถ้าอยู่นอกกรอบตาราง → ซ่อนเลนส์
  const outside = rx < 0 || ry < 0 || rx > magMeta.width || ry > magMeta.height;
  lens.style.display = outside ? 'none' : 'block';
  if (outside) return;

  // วางเลนส์ “ตรงตำแหน่งเมาส์” (กึ่งกลางเลนส์ทาบตรงเคอร์เซอร์)
  lens.style.left = cx + 'px';
  lens.style.top  = cy + 'px';

  // ตั้งภาพพื้นหลังเป็น snapshot และกำหนดขนาดภาพหลังขยาย
  lens.style.backgroundImage = `url(${magImgURL})`;
  lens.style.backgroundSize  = `${magMeta.width * magScale}px ${magMeta.height * magScale}px`;

  // คำนวณตำแหน่งภาพในเลนส์ให้จุดใต้เคอร์เซอร์อยู่กลางเลนส์
  const bgPosX = -(rx * magScale - magSize / 2);
  const bgPosY = -(ry * magScale - magSize / 2);
  lens.style.backgroundPosition = `${bgPosX}px ${bgPosY}px`;
}

function attachMagnifier() {
  const lens = ensureLensElement();
  lens.style.display = 'none';

  // snapshot ครั้งแรก
  buildSnapshot().catch(err => {
    console.error('Magnifier snapshot failed:', err);
    disableMagnifier();
  });

  // follow mouse
  magMoveHandler = onMagMouseMove;
  document.addEventListener('mousemove', magMoveHandler, { passive: true });

  // เมื่อ resize/scroll ให้ถ่ายภาพใหม่ (debounce)
  let t;
  magResizeHandler = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      try { await buildSnapshot(); } catch (e) { console.warn(e); }
    }, 200);
  };
  window.addEventListener('resize', magResizeHandler);
  window.addEventListener('scroll', magResizeHandler, true);
}

function detachMagnifier() {
  const lens = ensureLensElement();
  lens.style.display = 'none';
  lens.style.backgroundImage = 'none';

  if (magMoveHandler) {
    document.removeEventListener('mousemove', magMoveHandler);
    magMoveHandler = null;
  }
  if (magResizeHandler) {
    window.removeEventListener('resize', magResizeHandler);
    window.removeEventListener('scroll', magResizeHandler, true);
    magResizeHandler = null;
  }
  magImgURL = null;
  magMeta = null;
}

function enableMagnifier() {
  MAG_ON = true;
  attachMagnifier();
  const btn = document.getElementById('magnifyBtn');
  if (btn) { btn.textContent = '❌ Close Magnify'; btn.style.background = '#333'; btn.style.color = '#fff'; }
}
function disableMagnifier() {
  MAG_ON = false;
  detachMagnifier();
  const btn = document.getElementById('magnifyBtn');
  if (btn) { btn.textContent = '🔍 Magnify'; btn.style.background = ''; btn.style.color = ''; }
}

function toggleMagnifier() {
  if (MAG_ON) disableMagnifier();
  else enableMagnifier();
}

// ให้ปรับระดับขยาย/ขนาดเลนส์ได้เร็ว ๆ
function setMagnifierScale(s) {
  magScale = Math.max(1.2, Math.min(4, s)); // จำกัด 1.2x–4x
  const lens = ensureLensElement();
  if (magImgURL && magMeta) {
    lens.style.backgroundSize = `${magMeta.width * magScale}px ${magMeta.height * magScale}px`;
  }
}
function setMagnifierSize(px) {
  magSize = Math.max(140, Math.min(1000, px)); // จำกัดความกว้างเลนส์
  const lens = ensureLensElement();
  lens.style.width = magSize + 'px';
  lens.style.height = magSize + 'px';
}

// ✅ expose ให้เรียกจาก HTML ได้
window.toggleMagnifier = toggleMagnifier;
window.setMagnifierScale = setMagnifierScale;
window.setMagnifierSize = setMagnifierSize;


// ---------- Expose to Global (ให้ HTML เรียกได้ผ่าน onclick) ----------
window.renderTable = renderTable;
window.cellClick = cellClick;
window.openPopup = openPopup;
window.closePopup = closePopup;
window.saveData = saveData;
window.deleteData = deleteData;
window.showDetails = showDetails;
window.closeDetails = closeDetails;
window.openEditFromDetail = openEditFromDetail;
window.openHolidayModal = openHolidayModal;
window.closeHoliday = closeHoliday;
window.saveHoliday = saveHoliday;
window.deleteHoliday = deleteHoliday;
window.exportMonthToCSV = exportMonthToCSV;
