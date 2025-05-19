const firebaseConfig = {
  apiKey: "AIzaSyCSYG70O7gB17kwrXwL_S5e9dDwec7zhS0",
  authDomain: "custdata-92ebe.firebaseapp.com",
  databaseURL: "https://custdata-92ebe-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "custdata-92ebe",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let map;
let markers = [];
let allData = [];

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 6,
    center: { lat: 13.736717, lng: 100.523186 }
  });
}

function clearMarkers() {
  markers.forEach(m => m.setMap(null));
  markers = [];
}

auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "CUSTOMERINPUT3login_rule.html";
    return;
  }
  document.getElementById("mainPanel").classList.remove("hidden");
  loadData();
});

function signOut() {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  }).catch((error) => {
    alert("เกิดข้อผิดพลาดในการออกจากระบบ: " + error.message);
  });
}

function loadData() {
  db.ref("robot_data").once("value", snapshot => {
    const data = snapshot.val();
    if (!data) return;
    allData = Object.values(data);
    document.getElementById("totalRobotCount").textContent = allData.length;
    populateFilters();
  });
}

function populateFilters() {
  const controllerSet = new Set();
  const robotSet = new Set();
  const customerSet = new Set();
  allData.forEach(d => {
    if (d["Controller"]) controllerSet.add(d["Controller"]);
    if (d["Robot type"]) robotSet.add(d["Robot type"]);
    if (d["Customer name "]) customerSet.add(d["Customer name "]);
  });

  const controllerFilter = document.getElementById("controllerFilter");
  const robotFilter = document.getElementById("robotFilter");
  const customerFilter = document.getElementById("customerFilter");

  // Clear existing options except first
  for (let i = controllerFilter.options.length - 1; i > 0; i--) controllerFilter.remove(i);
  for (let i = robotFilter.options.length - 1; i > 0; i--) robotFilter.remove(i);
  for (let i = customerFilter.options.length - 1; i > 0; i--) customerFilter.remove(i);

  [...controllerSet].sort().forEach(c => {
    const option = document.createElement("option");
    option.value = c;
    option.textContent = c;
    controllerFilter.appendChild(option);
  });
  [...robotSet].sort().forEach(r => {
    const option = document.createElement("option");
    option.value = r;
    option.textContent = r;
    robotFilter.appendChild(option);
  });
  [...customerSet].sort().forEach(c => {
    const option = document.createElement("option");
    option.value = c;
    option.textContent = c;
    customerFilter.appendChild(option);
  });
}

function updateFilteredMarkers() {
  clearMarkers();

  const customerVal = document.getElementById("customerFilter").value;
  const controllerVal = document.getElementById("controllerFilter").value;
  const robotVal = document.getElementById("robotFilter").value;
  const minAge = parseInt(document.getElementById("minAge").value) || 0;
  const maxAge = parseInt(document.getElementById("maxAge").value) || 100;
  const countCond = document.getElementById("countCondition").value;
  const robotCountVal = parseInt(document.getElementById("robotCount").value) || 0;
  const showMap = document.getElementById("option1").checked;

  // Filter data
  let filtered = allData.filter(d => {
    if (customerVal && d["Customer name "] !== customerVal) return false;
    if (controllerVal && d["Controller"] !== controllerVal) return false;
    if (robotVal && d["Robot type"] !== robotVal) return false;
    const age = parseInt(d["Robot age (year)"] || 0);
    if (age < minAge || age > maxAge) return false;
    return true;
  });

  // Filter by robot count condition per customer
  if (countCond !== "none") {
    const counts = {};
    filtered.forEach(d => {
      counts[d["Customer name "]] = (counts[d["Customer name "]] || 0) + 1;
    });
    filtered = filtered.filter(d => {
      const cnt = counts[d["Customer name "]];
      if (countCond === "gt") return cnt > robotCountVal;
      if (countCond === "lt") return cnt < robotCountVal;
      return true;
    });
  }

  document.getElementById("filteredRobotCount").textContent = filtered.length;
  document.getElementById("customerCount").textContent = new Set(filtered.map(d => d["Customer name "])).size;

  if (allData.length > 0) {
    const percent = (filtered.length / allData.length) * 100;
    document.getElementById("filteredPercent").textContent = percent.toFixed(2);
  } else {
    document.getElementById("filteredPercent").textContent = "0";
  }

  // Update table
  const tbody = document.getElementById("dataTable").querySelector("tbody");
  tbody.innerHTML = "";
  filtered.forEach(d => {
    const tr = document.createElement("tr");
    ["Customer name ", "Controller", "Robot type", "Order number", "Application", "Robot age (year)"].forEach(key => {
      const td = document.createElement("td");
      td.textContent = d[key] || "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  if (showMap) {
    filtered.forEach(d => {
      if (d.lat && d.lng) {
        const marker = new google.maps.Marker({
          position: { lat: d.lat, lng: d.lng },
          map: map,
          title: d["Customer name "] + " - " + d["Robot type"]
        });
        markers.push(marker);
      }
    });
  }
}

function searchByKeyword() {
  const keyword = document.getElementById("searchText").value.trim().toLowerCase();
  if (!keyword) return;

  const rows = document.querySelectorAll("#dataTable tbody tr");
  rows.forEach(row => {
    row.style.backgroundColor = "";
  });

  let found = false;
  for (const row of rows) {
    if (row.textContent.toLowerCase().includes(keyword)) {
      row.style.backgroundColor = "yellow";
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      found = true;
      break;
    }
  }

  if (!found) alert("ไม่พบข้อมูลที่ค้นหา");
}

window.initMap = initMap;
