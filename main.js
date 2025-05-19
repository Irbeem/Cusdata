
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
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
const auth = getAuth(app);
const db = getDatabase(app);

// Elements
const loginForm = document.getElementById('loginForm');
const robotForm = document.getElementById('robotForm');
const logoutBtn = document.getElementById('logoutBtn');
const robotSection = document.getElementById('robotSection');

// ดึง role
async function getUserRole(uid) {
  const roleRef = ref(db, `users/${uid}/role`);
  const snapshot = await get(roleRef);
  return snapshot.exists() ? snapshot.val() : null;
}

// Login state handler
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginForm.style.display = 'none';
    logoutBtn.style.display = 'inline';

    const role = await getUserRole(user.uid);
    if (role === 'admin') {
      robotSection.style.display = 'block';
      robotForm.style.display = 'grid';
      await populateCustomerList();
      await populateUniqueOptions();
    } else if (role === 'viewer') {
      robotSection.style.display = 'block';
      robotForm.style.display = 'none';
      alert("Viewer permission can not fill data");
    } else {
      alert("no permission");
      await signOut(auth);
    }
  } else {
    loginForm.style.display = 'block';
    robotSection.style.display = 'none';
    robotForm.style.display = 'none';
    logoutBtn.style.display = 'none';
  }
});

// Form submission
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
    alert('data send complete');
    robotForm.reset();
  } catch (err) {
    console.error(err);
    alert('data send error');
  }
});

// ---  Customer SAP list ---    
async function populateCustomerList() {
  const snapshot = await get(ref(db, 'robot_data'));
const customerNames = new Set();

if (snapshot.exists()) {
  snapshot.forEach(child => {
    const data = child.val();
    const name = data["Customer name "]?.trim();
    if (name) customerNames.add(name);
  });
}

const datalist = document.getElementById('customerList');
datalist.innerHTML = '';

[...customerNames].sort().forEach(name => {
  const option = document.createElement('option');
  option.value = name;
  datalist.appendChild(option);
});

}


// ---  Customer name ---   
  document.getElementById('customerNameInput').addEventListener('input', async (e) => {
  const selectedName = e.target.value.trim();
  if (!selectedName) return;

  const snapshot = await get(ref(db, 'robot_data'));

  // Sets forแต่ละช่อง
  const sapNumbers = new Set();
  const abbreviations = new Set();
  const addresses = new Set();
  const areas = new Set();
  const locations = new Set(); // in or outside

  if (snapshot.exists()) {
    snapshot.forEach(child => {
      const data = child.val();
      const name = data["Customer name "]?.trim();

      if (name === selectedName) {
        const sap = data["Customer SAP Num"]?.trim();
        const abb = data["Abbreviation"]?.trim();
        const addr = data["Address"]?.trim();
        const area = data["Area"]?.trim();
        const loc = data["in or outside"]?.trim();

        if (sap) sapNumbers.add(sap);
        if (abb) abbreviations.add(abb);
        if (addr) addresses.add(addr);
        if (area) areas.add(area);
        if (loc) locations.add(loc);
      }
    });
  }

  // ===== Customer SAP Number =====
  const sapInput = document.getElementById('customerSAPInput');
  const sapDatalist = document.getElementById('sapList');
  sapDatalist.innerHTML = '';
  if (sapNumbers.size === 1) {
    sapInput.value = [...sapNumbers][0];
  } else {
    sapInput.value = '';
    sapNumbers.sort().forEach(val => {
      sapDatalist.appendChild(new Option(val, val));
    });
  }

  // ===== Abbreviation =====
  const abbInput = document.getElementById('abbreviationInput');
  const abbDatalist = document.getElementById('abbreviationList');
  abbDatalist.innerHTML = '';
  if (abbreviations.size === 1) {
    abbInput.value = [...abbreviations][0];
  } else {
    abbInput.value = '';
    abbreviations.sort().forEach(val => {
      abbDatalist.appendChild(new Option(val, val));
    });
  }

  // ===== Address =====
  const addrInput = document.getElementById('addressInput');
  const addrDatalist = document.getElementById('addressList');
  addrDatalist.innerHTML = '';
  if (addresses.size === 1) {
    addrInput.value = [...addresses][0];
  } else {
    addrInput.value = '';
    addresses.sort().forEach(val => {
      addrDatalist.appendChild(new Option(val, val));
    });
  }

  // ===== Area =====
  const areaInput = document.getElementById('areaInput');
  const areaDatalist = document.getElementById('areaList');
  areaDatalist.innerHTML = '';
  if (areas.size === 1) {
    areaInput.value = [...areas][0];
  } else {
    areaInput.value = '';
    areas.sort().forEach(val => {
      areaDatalist.appendChild(new Option(val, val));
    });
  }

  // ===== In or outside =====
const locationInput = document.getElementById('inOrOutsideInput');
const locationList = document.getElementById('inOrOutsideList');
locationList.innerHTML = '';

if (locations.size === 1) {
  locationInput.value = [...locations][0];
} else if (locations.size > 1) {
  locationInput.value = '';
  locations.forEach(loc => {
    locationList.appendChild(new Option(loc, loc));
  });
} else {
  locationInput.value = '';
  ['Thailand', 'Abroad'].sort().forEach(loc => {
    locationList.appendChild(new Option(loc, loc));
  });
}

});
// ===== In or outside =====


    robotForm.addEventListener('keydown', (e) => {
       if (e.key === 'Enter') {
          e.preventDefault();
          }
    });

    async function getUserRole(uid) {
      const roleRef = ref(db, `users/${uid}/role`);
      const snapshot = await get(roleRef);
      return snapshot.exists() ? snapshot.val() : null;
    }

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        loginForm.style.display = 'none';
        logoutBtn.style.display = 'inline';

        const role = await getUserRole(user.uid);
        if (role === 'admin') {
          //robotviewer.style.display = 'block';
          robotSection.style.display = 'block';
          robotForm.style.display = 'grid';
          await populateCustomerList();
          await populateUniqueOptions();
        } else if (role === 'viewer') {
          //robotviewer.style.display = 'block';
          robotSection.style.display = 'block';
          robotForm.style.display = 'none'; 
          alert("Viewer permission can not fill data");
        } else {
          alert("no permission");
          await signOut(auth);
        }
      } else {
        loginForm.style.display = 'block';
        //robotviewer.style.display = 'none';
        robotSection.style.display = 'none';
        robotForm.style.display = 'none';
        logoutBtn.style.display = 'none';
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
        alert('data send complete');
        robotForm.reset();
      } catch (err) {
        console.error(err);
        alert('data send error');
      }
    });



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

  // Helper function
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


// คืนค่าในรูปแบบ YYYY-MM-DD
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();

  // Year
  const yearInput = document.getElementById('yearInput');
  if (yearInput && !yearInput.value) {
    yearInput.value = today.getFullYear();
  }
  // Month
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const monthInput = document.getElementById('monthInput');
  if (monthInput && !monthInput.value) {
    const currentMonthName = monthNames[today.getMonth()];
    monthInput.value = currentMonthName;
  }

  // Date of Entry
  const dateInput = document.getElementById('dateOfEntry');

  if (dateInput && !dateInput.value) {
    const day = String(today.getDate()).padStart(2, '0'); // แค่วันที่ (เช่น 16)
    dateInput.value = day;
  }
});
