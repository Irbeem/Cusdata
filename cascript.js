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


  </script>



