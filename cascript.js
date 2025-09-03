// อ่านค่าจาก config.js (ผ่าน window.*)
const CREDENTIALS = window.CREDENTIALS || [];
const AUTH_KEY = window.AUTH_KEY || "cs_calendar_auth_user";
const SHEET_ID = window.SHEET_ID;
const CALENDAR_SHEET = window.CALENDAR_SHEET;
const NAMES_SHEET = window.NAMES_SHEET;
const SpecialHolidays_SHEET = window.SpecialHolidays_SHEET;

// ---------- ตัวแปร/อิลิเมนต์เดิม ----------
let names = [], allData = [], specialHolidays = [];
let activeCell = null;

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


function showLogin() {
      document.getElementById('loginOverlay').style.display = 'block';
      document.getElementById('app').style.display = 'none';
      setTimeout(() => document.getElementById('loginUser').focus(), 50);
    }

    function showApp() {
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('app').style.display = 'block';
    }

    function resetLogin() {
      document.getElementById('loginUser').value = '';
      document.getElementById('loginPass').value = '';
      document.getElementById('loginUser').focus();
    }

    function doLogin() {
      const u = document.getElementById('loginUser').value.trim();
      const p = document.getElementById('loginPass').value;
      const ok = CREDENTIALS.some(c => c.user === u && c.pass === p);
      if (ok) {
        localStorage.setItem(AUTH_KEY, u);
        showApp();
        // ✅ เรียก init() หลัง Login สำเร็จเท่านั้น
        init();
      } else {
        alert('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    }

    function logout() {
      localStorage.removeItem(AUTH_KEY);
      location.reload();
    }

    // Enter key shortcuts
    document.addEventListener('keydown', (e) => {
      const overlayVisible = document.getElementById('loginOverlay').style.display !== 'none';
      if (overlayVisible && e.key === 'Enter') {
        e.preventDefault();
        doLogin();
      }
    });

    // ===== Existing calendar script (mostly unchanged) =====
    let names = [], allData = [], specialHolidays = [];
    let activeCell = null;

    const SHEET_ID = '1ySiuPMVyrNOpNxx5fR0olf2Dbaq84zKVlVaVo6mFBi8';
    const CALENDAR_SHEET = 'Carlendar';
    const NAMES_SHEET = 'Names';
    const SpecialHolidays_SHEET = 'SpecialHolidays';

    const monthSel = document.getElementById("month");
    const yearSel = document.getElementById("year");
    const overlay = document.getElementById("overlay");
    const popup = document.getElementById("popupForm");
    const popupName = document.getElementById("popupName");
    const popupDate = document.getElementById("popupDate");
    const popupType = document.getElementById("popupType");
    const popupTime = document.getElementById("popupTime");
    const popupDetail = document.getElementById("popupDetail");
    const popupCustomer = document.getElementById("popupCustomer");
    const popupPlace = document.getElementById("popupPlace");
    const popupJobowner = document.getElementById("popupJobowner");
    const popupCharge = document.getElementById("popupCharge");

    const LONG_PRESS_MS = 600;
    let longPressTimer = null;
    let touchMoved = false;

    function handleTouchStart(e) {
      const td = e.currentTarget;
      touchMoved = false;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => { openPopup(td); }, LONG_PRESS_MS);
    }
    function handleTouchMove() { touchMoved = true; clearTimeout(longPressTimer); }
    function handleTouchEnd() { clearTimeout(longPressTimer); }
    function handleContextMenu(e) { e.preventDefault(); const td = e.currentTarget; openPopup(td); }

    function attachHandlersToCells() {
      document.querySelectorAll('#calendar-table tbody td').forEach(td => {
        td.addEventListener('touchstart', handleTouchStart, { passive: true });
        td.addEventListener('touchmove', handleTouchMove, { passive: true });
        td.addEventListener('touchend', handleTouchEnd);
        td.addEventListener('contextmenu', handleContextMenu);
      });
    }

    function init() {
      const now = new Date();
      const savedMonth = parseInt(localStorage.getItem('savedMonth'));
      const savedYear = parseInt(localStorage.getItem('savedYear'));
      const defaultMonth = !isNaN(savedMonth) ? savedMonth : now.getMonth() + 1;
      const defaultYear = !isNaN(savedYear) ? savedYear : now.getFullYear();

      // populate month/year
      monthSel.innerHTML = '';
      for (let i = 1; i <= 12; i++) {
        const opt = new Option(i, i);
        if (i === defaultMonth) opt.selected = true; monthSel.add(opt);
      }
      yearSel.innerHTML = '';
      for (let y = 2025; y <= now.getFullYear() + 1; y++) {
        const opt = new Option(y, y);
        if (y === defaultYear) opt.selected = true; yearSel.add(opt);
      }

      const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

      Promise.all([
        fetch(`${base}&sheet=${NAMES_SHEET}`).then(r => r.text()),
        fetch(`${base}&sheet=${CALENDAR_SHEET}`).then(r => r.text()),
        fetch(`${base}&sheet=${SpecialHolidays_SHEET}`).then(r => r.text())
      ]).then(([namesTxt, dataTxt, holidayTxt]) => {
        const namesJson = JSON.parse(namesTxt.substring(47).slice(0, -2));
        names = namesJson.table.rows.map(r => r.c[0]?.v).filter(name => name && name.toLowerCase() !== "summary");

        const dataJson = JSON.parse(dataTxt.substring(47).slice(0, -2));
        const cols = dataJson.table.cols.map(c => c.label);
        allData = dataJson.table.rows.map(r => {
          const o = {}; r.c.forEach((c, i) => o[cols[i]] = c?.v || ""); return o;
        });

        const holidayJson = JSON.parse(holidayTxt.substring(47).slice(0, -2));
        specialHolidays = holidayJson.table.rows.map(r => ({
          year:   r.c[0]?.v || '',
          month:  r.c[1]?.v,
          date:   r.c[2]?.v,
          detail: r.c[3]?.v || ''
        })).filter(h => h.month && h.date);

        renderTable();
      });
    }

    function renderTable() {
      const year = +yearSel.value;
      const month = +monthSel.value;
      const days = new Date(year, month, 0).getDate();
      const thead = document.querySelector("#calendar-table thead");
      const tbody = document.querySelector("#calendar-table tbody");

      const extraNames = new Set();
      allData.forEach(d => { if (d.name && !names.includes(d.name)) extraNames.add(d.name); });
      const allNames = [...names, ...[...extraNames].sort()];

      const dataMap = {}; const summary = { Service: 0, Standby: 0, Meeting: 0, Telephone: 0, Training: 0, TrainingSafety: 0, Inspection: 0, LTC: 0, Warranty: 0, RepairPP: 0, Sales: 0, Leave: 0, SafetyHealth: 0, Other: 0 };
      allNames.forEach(name => dataMap[name] = {});

      allData.forEach(d => {
        if (+d.year === year && +d.month === month) {
          const tooltip = `${d.type}\n${d.customer}\n${d.time}\n${d.datail}\n${d.place}\n${d.jobowner}\n${d.charge}`;
          const html = `<div class='event ${d.type}' title="${tooltip}">${d.type}<br>${d.customer || ''}</div>`;
          (dataMap[d.name][d.date] ||= []).push(html);
          if (summary[d.type] !== undefined) summary[d.type]++;
        }
      });

      const dayClass = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const daysHeader = Array.from({ length: days }, (_, i) => {
        const d = i + 1; const date = new Date(year, month - 1, d); const dow = date.getDay();
        const dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow];
        const holiday = specialHolidays.find(h => h.date == d && h.month == month && (!h.year || +h.year === year));
        const isHoliday = !!holiday; const holidayName = holiday?.detail || "";
        return `<th class="${dayClass[dow]}${isHoliday ? ' holiday' : ''}" data-day="${d}" style="user-select:none;" onclick="openHolidayModal(${year},${month},${d})">
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

      const oldSummary = document.getElementById("summaryBox"); if (oldSummary) oldSummary.remove();
      const totalDiv = document.createElement("div"); totalDiv.id = "summaryBox";
      totalDiv.innerHTML = `<h4>📊 Summary job ${month}/${year}</h4><ul>${Object.entries(summary).map(([k, v]) => `<li>${k}: ${v} Times</li>`).join("")}</ul>`;
      document.querySelector(".calendar-wrapper").appendChild(totalDiv);

      localStorage.removeItem('savedMonth'); localStorage.removeItem('savedYear');

      specialHolidays.forEach(h => {
        if (h.month === month && (!h.year || +h.year === year)) {
          const idx = h.date;
          const th = thead.querySelector(`th[data-day="${idx}"]`); if (th) th.classList.add("holiday", "special-holiday");
          document.querySelectorAll(`#calendar-table tbody td[data-day="${idx}"]`).forEach(td => td.classList.add("holiday-col", "special-holiday"));
        }
      });
      highlightWeekendColumns();
      attachHandlersToCells();
    }

    function openPopup(td) {
      activeCell = td;
      popupName.textContent = td.dataset.name;
      popupDate.textContent = td.dataset.day;
      popupType.value = "Service";
      popupTime.value = ""; popupDetail.value = ""; popupCustomer.value = ""; popupPlace.value = ""; popupJobowner.value = ""; popupCharge.value = "Nocharge";
      overlay.classList.add("active"); popup.classList.add("active");
    }
    function closePopup() { overlay.classList.remove("active"); popup.classList.remove("active"); }

    function saveData() {
      const form = document.getElementById("submitForm");
      form.year.value = yearSel.value; form.month.value = monthSel.value; form.date.value = activeCell.dataset.day; form.name.value = activeCell.dataset.name;
      form.type.value = popupType.value; form.time.value = popupTime.value; form.datail.value = popupDetail.value; form.customer.value = popupCustomer.value;
      form.place.value = popupPlace.value; form.jobowner.value = popupJobowner.value; form.charge.value = popupCharge.value;
      form.sendEmail.value = document.getElementById("popupSendEmail").checked ? "true" : "false"; form.action.value = "save";

      const html = `<div class='event ${form.type.value}'>${form.type.value}<br>${form.time.value}<br>${form.datail.value}<br>${form.customer.value}<br>${form.place.value}<br>${form.jobowner.value}<br>${form.charge.value}</div>`;
      activeCell.innerHTML = html; closePopup();
      localStorage.setItem('savedMonth', monthSel.value); localStorage.setItem('savedYear', yearSel.value);
      submitAndWait();
    }

    function deleteData() {
      if (!confirm("Delete?")) return;
      const form = document.getElementById("submitForm");
      form.year.value = yearSel.value; form.month.value = monthSel.value; form.date.value = activeCell.dataset.day; form.name.value = activeCell.dataset.name;
      form.type.value = popupType.value; form.time.value = popupTime.value; form.datail.value = ""; form.action.value = "delete";
      activeCell.innerHTML = ""; closePopup();
      localStorage.setItem('savedMonth', monthSel.value); localStorage.setItem('savedYear', yearSel.value);
      submitAndWait();
    }

    document.querySelector('#calendar-table tbody')?.addEventListener('click', (e) => {
      const td = e.target.closest('td'); if (!td) return;
      if (td.cellIndex === 0) {
        const tr = td.parentElement;
        document.querySelectorAll('#calendar-table tbody tr.selected-row').forEach(r => r.classList.remove('selected-row'));
        tr.classList.add('selected-row');
      }
    });

    function submitAndWait() {
      const form = document.getElementById('submitForm');
      const iframe = document.getElementById('hidden_frame');
      if (!iframe) { form.submit(); setTimeout(() => location.reload(), 2000); return; }
      closePopup();
      iframe.onload = () => { iframe.onload = null; closePopup(); location.reload(); };
      setTimeout(() => { if (iframe.onload) { iframe.onload = null; closePopup(); location.reload(); } }, 6000);
      form.submit();
    }

    function cellClick(td) {
      activeCell = td;
      const year = +yearSel.value; const month = +monthSel.value; const day = +td.dataset.day; const name = td.dataset.name;
      const items = allData.filter(d => +d.year === year && +d.month === month && +d.date === day && String(d.name) === String(name));
      if (items.length > 0) { showDetails(items, { name, day, month, year }); } else { openPopup(td); }
    }

    function showDetails(items, meta) {
      const box = document.getElementById('detailContent');
      const html = items.map((d, i) => {
        const lines = [ `<b>${i+1}. ${d.type || '-'}</b>`, d.customer ? `Customer: ${d.customer}` : '', d.time ? `Time: ${d.time}` : '', d.datail ? `Detail: ${d.datail}` : '', d.place ? `Place: ${d.place}` : '', d.jobowner ? `Job Owner: ${d.jobowner}` : '', d.charge ? `Charge: ${d.charge}` : '' ].filter(Boolean);
        return `<div style="padding:8px;border:1px solid #eee;border-radius:6px;margin-bottom:8px">${lines.join('<br>')}</div>`;
      }).join('') || '<i>No detail</i>';
      box.innerHTML = `<div style="margin-bottom:6px;color:#555">👤 <b>${meta.name}</b> — 📅 ${meta.day}/${meta.month}/${meta.year}</div>${html}`;
      overlay.classList.add("active"); document.getElementById('detailModal').classList.add('active');
    }
    function closeDetails() { document.getElementById('detailModal').classList.remove('active'); overlay.classList.remove('active'); }
    function openEditFromDetail() { document.getElementById('detailModal').classList.remove('active'); if (activeCell) { openPopup(activeCell); } else { overlay.classList.remove('active'); } }

    document.querySelector('.calendar-wrapper').addEventListener('wheel', function(e) {
      e.preventDefault(); const rowHeight = 80; const step = rowHeight * 2; this.scrollTop += (e.deltaY > 0 ? step : -step);
    });

    function highlightWeekendColumns() {
      const table = document.getElementById('calendar-table');
      const headCells = table.querySelectorAll('thead th');
      const weekendIdx = [];
      headCells.forEach((th, idx) => { if (th.classList.contains('sun') || th.classList.contains('sat')) weekendIdx.push({ index: idx + 1, cls: th.classList.contains('sat') ? 'sat' : 'sun' }); });
      table.querySelectorAll('tbody td.weekend').forEach(td => { td.classList.remove('weekend', 'sat'); });
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(tr => { weekendIdx.forEach(({ index, cls }) => { const td = tr.querySelector(`td:nth-child(${index})`); if (td) { td.classList.add('weekend'); if (cls === 'sat') td.classList.add('sat'); } }); });
    }

    function openHolidayModal(y, m, d) {
      const yy = (y != null ? y : +document.getElementById('year').value);
      const mm = (m != null ? m : +document.getElementById('month').value);
      const dd = (d != null ? d : 1);
      document.getElementById('holYear').value = yy;
      document.getElementById('holMonth').value = mm;
      document.getElementById('holDate').value = dd;
      document.getElementById('holDetail').value = '';
      overlay.classList.add('active'); document.getElementById('holidayModal').classList.add('active');
    }
    function closeHoliday() { document.getElementById('holidayModal').classList.remove('active'); overlay.classList.remove('active'); }

    function saveHoliday() {
      const year = (document.getElementById('holYear').value || '').trim();
      const month = +document.getElementById('holMonth').value;
      const date = +document.getElementById('holDate').value;
      const detail = document.getElementById('holDetail').value || '';
      if (!month || !date) { alert('กรุณากรอก Month และ Date'); return; }
      const form = document.getElementById('submitForm');
      form.year.value = year; form.month.value = month; form.date.value = date; form.name.value = '';
      form.type.value = ''; form.time.value = ''; form.datail.value = ''; form.customer.value = '';
      form.place.value = ''; form.jobowner.value = ''; form.charge.value = '';
      form.holidayDetail.value = detail; form.action.value = 'addHoliday';
      const iframe = document.getElementById('hidden_frame');
      closeHoliday(); localStorage.setItem('savedMonth', monthSel.value); localStorage.setItem('savedYear', yearSel.value);
      iframe.onload = () => { iframe.onload = null; location.reload(); };
      setTimeout(() => { if (iframe.onload) { iframe.onload = null; location.reload(); } }, 6000);
      form.submit();
    }

    function deleteHoliday() {
      const year = (document.getElementById('holYear').value || '').trim();
      const month = +document.getElementById('holMonth').value; const date = +document.getElementById('holDate').value;
      if (!month || !date) { alert('กรุณากรอก Month และ Date'); return; }
      const form = document.getElementById('submitForm');
      form.year.value = year; form.month.value = month; form.date.value = date; form.name.value = '';
      form.type.value = ''; form.time.value = ''; form.datail.value = ''; form.customer.value = '';
      form.place.value = ''; form.jobowner.value = ''; form.charge.value = '';
      form.holidayDetail.value = ''; form.action.value = 'removeHoliday';
      const iframe = document.getElementById('hidden_frame');
      closeHoliday(); localStorage.setItem('savedMonth', monthSel.value); localStorage.setItem('savedYear', yearSel.value);
      iframe.onload = () => { iframe.onload = null; location.reload(); };
      setTimeout(() => { if (iframe.onload) { iframe.onload = null; location.reload(); } }, 6000);
      form.submit();
    }

    function downloadFullCalendarImage() {
      const container = document.createElement('div');
      container.style.padding = '20px'; container.style.background = '#fff'; container.style.position = 'absolute'; container.style.left = '-9999px'; container.style.top = '0';
      const calendar = document.querySelector('.calendar-wrapper').cloneNode(true);
      calendar.classList.remove('reverse', 'rtl', 'direction-reverse');
      calendar.querySelectorAll('tr').forEach(tr => {
        const cells = Array.from(tr.children);
        if (cells.length > 1 && cells[0].tagName === "TH") {
          tr.innerHTML = `<th>${cells.pop().innerHTML}</th>` + cells.map(td => `<th>${td.innerHTML}</th>`).join('');
        } else if (cells.length > 1 && cells[0].tagName === "TD") {
          tr.innerHTML = `<td>${cells.pop().innerHTML}</td>` + cells.map(td => `<td>${td.innerHTML}</td>`).join('');
        }
      });
      container.appendChild(calendar); document.body.appendChild(container);
      calendar.style.maxHeight = 'unset'; calendar.style.overflow = 'visible';
      html2canvas(container, { scrollY: -window.scrollY, windowWidth: document.body.scrollWidth }).then(canvas => {
        const link = document.createElement('a'); link.download = `calendar-${yearSel.value}-${monthSel.value}.png`;
        link.href = canvas.toDataURL('image/png'); link.click(); document.body.removeChild(container);
      });
    }

    function exportMonthToCSV() {
      const year = +yearSel.value; const month = +monthSel.value;
      const filtered = allData.filter(row => +row.year === year && +row.month === month);
      if (filtered.length === 0) { alert("ไม่มีข้อมูลในเดือนนี้"); return; }
      const headers = ["Year","Month","Date","Name","Type","Time","Detail","Customer","Place","JobOwner","Charge"];
      const rows = [headers.join(",")];
      filtered.forEach(row => {
        const csvRow = [ row.year, row.month, row.date, row.name, row.type, row.time, `"${row.datail?.replace(/"/g, '""') || ''}"`, `"${row.customer?.replace(/"/g, '""') || ''}"`, `"${row.place?.replace(/"/g, '""') || ''}"`, `"${row.jobowner?.replace(/"/g, '""') || ''}"`, row.charge ];
        rows.push(csvRow.join(","));
      });
      const BOM = "\uFEFF"; const csvContent = BOM + rows.join("\n");
      const now = new Date(); const tday = now.getDate(); const hh = String(now.getHours()).padStart(2,'0'); const mm = String(now.getMinutes()).padStart(2,'0');
      const timestamp = `${hh}-${mm}`; const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.setAttribute("href", url); link.setAttribute("download", `calendar-${year}-${month}-save-${tday}-${timestamp}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    // ===== Boot =====
    (function boot() {
      const currentUser = localStorage.getItem(AUTH_KEY);
      if (currentUser) { showApp(); init(); } else { showLogin(); }
    })();


// ---------- ทำให้ฟังก์ชันที่ HTML เรียกได้ (Global) ----------
window.doLogin = doLogin;
window.resetLogin = resetLogin;
window.logout = logout;

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
window.downloadFullCalendarImage = downloadFullCalendarImage;




