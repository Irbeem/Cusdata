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
  // ซ่อนแอปไว้ก่อน
  if (appRoot) appRoot.style.display = "none";

  if (!user) {
    // ยังไม่ล็อกอิน -> เด้งไปหน้า login พร้อมแนบ back=<url ปัจจุบัน>
    const back = encodeURIComponent(location.href);
    location.replace(`${LOGIN_PAGE_URL}?back=${back}`);
    return;
  }

  // ล็อกอินแล้ว: ตรวจ role ถ้าบังคับ
  if (REQUIRE_ROLE) {
    const role = await getUserRole(user.uid);
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

  // ผ่าน Auth + Role → แสดงแอปและเริ่มโหลดตาราง
  if (appRoot) appRoot.style.display = "";
  window.CURRENT_UID = user.uid;
  init(); // โหลด Google Sheet + render ตาราง
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
  for (let y = 2025; y <= now.getFullYear() + 1; y++) {
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
  const extraNames = new Set();
  allData.forEach(d => {
    if (d.name && !names.includes(d.name)) extraNames.add(d.name);
  });
  const allNames = [...names, ...[...extraNames].sort()];

  const dataMap = {};
  const summary = { Service: 0, Standby: 0, Meeting: 0, Telephone: 0, Training: 0, TrainingSafety: 0, Inspection: 0, LTC: 0, Warranty: 0, RepairPP: 0, Sales: 0, Leave: 0, SafetyHealth: 0, Other: 0 };
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
  document.getElementById("summaryBox")?.remove();
  const totalDiv = document.createElement("div");
  totalDiv.id = "summaryBox";
  totalDiv.innerHTML = `<h4>📊 Summary job ${month}/${year}</h4>
    <ul>${Object.entries(summary).map(([k,v]) => `<li>${k}: ${v} Times</li>`).join("")}</ul>`;
  document.querySelector(".calendar-wrapper").appendChild(totalDiv);

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

function highlightWeekendColumns() {
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
