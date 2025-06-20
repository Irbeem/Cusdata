import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, push, get
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCSYG70O7gB17kwrXwL_S5e9dDwec7zhS0",
  authDomain: "custdata-92ebe.firebaseapp.com",
  databaseURL: "https://custdata-92ebe-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "custdata-92ebe",
  storageBucket: "custdata-92ebe.appspot.com",
  messagingSenderId: "187239785555",
  appId: "1:187239785555:web:d31eeab8dcd73990a812a6",
  measurementId: "G-LFG056C8SL"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM Elements
const robotForm = document.getElementById('robotForm');

// ========== Form Submit ==========
robotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  let formData = Object.fromEntries(new FormData(robotForm).entries());

  // แก้ key ที่มี dot
  for (let key in formData) {
    if (key.includes('.')) {
      formData[key.replace(/\./g, '_')] = formData[key];
      delete formData[key];
    }
  }

  try {
    await push(ref(db, 'robot_data'), formData);
    alert('✅ Data saved successfully');
    robotForm.reset();
  } catch (err) {
    console.error(err);
    alert('❌ Error saving data');
  }
});

// ========== Auto-fill Customer Lists ==========
async function populateCustomerList() {
  const snapshot = await get(ref(db, 'robot_data'));
  const customerNames = new Set();

  if (snapshot.exists()) {
    snapshot.forEach(child => {
      const name = child.val()["Customer name"]?.trim();
      if (name) customerNames.add(name);
    });
  }

  const datalist = document.getElementById('customerList');
  datalist.innerHTML = '';
  [...customerNames].sort().forEach(name => {
    datalist.appendChild(new Option(name, name));
  });
}

await populateCustomerList();

// ========== Fill SAP/Address/... เมื่อเลือกชื่อ ==========
document.getElementById('customerNameInput').addEventListener('input', async (e) => {
  const selectedName = e.target.value.trim();
  if (!selectedName) return;

  const snapshot = await get(ref(db, 'robot_data'));
  const sapNumbers = new Set();
  const abbreviations = new Set();
  const addresses = new Set();
  const areas = new Set();
  const locations = new Set();

  if (snapshot.exists()) {
    snapshot.forEach(child => {
      const data = child.val();
      if (data["Customer name"]?.trim() === selectedName) {
        if (data["Customer SAP Num"]) sapNumbers.add(data["Customer SAP Num"].trim());
        if (data["Abbreviation"]) abbreviations.add(data["Abbreviation"].trim());
        if (data["Address"]) addresses.add(data["Address"].trim());
        if (data["Area"]) areas.add(data["Area"].trim());
        if (data["in or outside"]) locations.add(data["in or outside"].trim());
      }
    });
  }

  const fill = (inputId, listId, dataSet) => {
    const input = document.getElementById(inputId);
    const datalist = document.getElementById(listId);
    datalist.innerHTML = '';

    if (dataSet.size === 1) {
      input.value = [...dataSet][0];
    } else {
      input.value = '';
      [...dataSet].sort().forEach(val => {
        datalist.appendChild(new Option(val, val));
      });
    }
  };

  fill('customerSAPInput', 'sapList', sapNumbers);
  fill('abbreviationInput', 'abbreviationList', abbreviations);
  fill('addressInput', 'addressList', addresses);
  fill('areaInput', 'areaList', areas);
  fill('inOrOutsideInput', 'inOrOutsideList', locations.size ? locations : new Set(["Thailand", "Abroad"]));
});

// ========== Auto-fill Datalist Options ==========
async function populateUniqueOptions() {
  const snapshot = await get(ref(db, 'robot_data'));
  const robotTypes = new Set();
  const types = new Set();
  const controllers = new Set();
  const useApps = new Set();
  const sysApps = new Set();

  if (snapshot.exists()) {
    snapshot.forEach(child => {
      const data = child.val();
      if (data["Robot type"]) robotTypes.add(data["Robot type"].trim());
      if (data["Type"]) types.add(data["Type"].trim());
      if (data["Controller"]) controllers.add(data["Controller"].trim());
      if (data["USE application"]) useApps.add(data["USE application"].trim());
      if (data["System application"]) sysApps.add(data["System application"].trim());
    });
  }

  const fillDatalist = (listId, items) => {
    const datalist = document.getElementById(listId);
    datalist.innerHTML = '';
    [...items].sort().forEach(val => {
      datalist.appendChild(new Option(val, val));
    });
  };

  fillDatalist('robotTypeList', robotTypes);
  fillDatalist('typeList', types);
  fillDatalist('controllerList', controllers);
  fillDatalist('useAppList', useApps);
  fillDatalist('sysAppList', sysApps);
}

await populateUniqueOptions();

// ========== ป้องกัน Enter ส่งฟอร์ม ==========
robotForm.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
  }
});

// ========== เติมวัน เดือน ปี ปัจจุบัน ==========
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();

  const yearInput = document.getElementById('yearInput');
  if (yearInput && !yearInput.value) yearInput.value = today.getFullYear();

  const monthInput = document.getElementById('monthInput');
  if (monthInput && !monthInput.value) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    monthInput.value = monthNames[today.getMonth()];
  }

  const dateInput = document.getElementById('dateOfEntry');
  if (dateInput && !dateInput.value) {
    dateInput.value = String(today.getDate()).padStart(2, '0');
  }
});
