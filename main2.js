// ปรับปรุง main.js ทั้งหมดสำหรับ input_form.html แบบลด download

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getDatabase, ref, push, get, query, orderByChild, equalTo
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
const auth = getAuth(app);
const db = getDatabase(app);

// Elements
const loginForm = document.getElementById('loginForm');
const robotForm = document.getElementById('robotForm');
const logoutBtn = document.getElementById('logoutBtn');
const robotSection = document.getElementById('robotSection');

// Login handler
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginForm.style.display = 'none';
    logoutBtn.style.display = 'inline';
    robotSection.style.display = 'block';
    await preloadCustomerList();
  } else {
    loginForm.style.display = 'block';
    robotSection.style.display = 'none';
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginForm.email.value;
  const password = loginForm.password.value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert("Login error " + err.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

robotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  let formData = Object.fromEntries(new FormData(robotForm).entries());
  for (let key in formData) {
    if (key.includes('.')) {
      formData[key.replace(/\./g, '_')] = formData[key];
      delete formData[key];
    }
  }
  try {
    await push(ref(db, 'robot_data'), formData);
    alert('Data saved successfully');
    robotForm.reset();
  } catch (err) {
    alert('Error saving data');
  }
});

// Preload customer names on page load
async function preloadCustomerList() {
  const snapshot = await get(ref(db, 'robot_data'));
  const customerNames = new Set();
  if (snapshot.exists()) {
    snapshot.forEach(child => {
      const data = child.val();
      if (data["Customer name"]) customerNames.add(data["Customer name"].trim());
    });
  }
  const datalist = document.getElementById('customerList');
  datalist.innerHTML = '';
  [...customerNames].sort().forEach(name => {
    datalist.appendChild(new Option(name, name));
  });
}

// Debounce function to limit calls
function debounce(func, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  }
}

// When user selects customer name, load related fields
const customerNameInput = document.getElementById('customerNameInput');
customerNameInput.addEventListener('input', debounce(async (e) => {
  const selectedName = e.target.value.trim();
  if (!selectedName) return;

  const q = query(ref(db, 'robot_data'), orderByChild("Customer name"), equalTo(selectedName));
  const snapshot = await get(q);

  const sapNumbers = new Set();
  const abbreviations = new Set();
  const addresses = new Set();
  const areas = new Set();
  const locations = new Set();

  if (snapshot.exists()) {
    snapshot.forEach(child => {
      const data = child.val();
      if (data["Customer SAP Num"]) sapNumbers.add(data["Customer SAP Num"].trim());
      if (data["Abbreviation"]) abbreviations.add(data["Abbreviation"].trim());
      if (data["Address"]) addresses.add(data["Address"].trim());
      if (data["Area"]) areas.add(data["Area"].trim());
      if (data["in or outside"]) locations.add(data["in or outside"].trim());
    });
  }

  fillDatalistOrInput('sapList', 'customerSAPInput', sapNumbers);
  fillDatalistOrInput('abbreviationList', 'abbreviationInput', abbreviations);
  fillDatalistOrInput('addressList', 'addressInput', addresses);
  fillDatalistOrInput('areaList', 'areaInput', areas);
  fillDatalistOrInput('inOrOutsideList', 'inOrOutsideInput', locations);
}, 500));

function fillDatalistOrInput(listId, inputId, dataSet) {
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
}

