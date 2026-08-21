// Studio Extrait - Authentication & Account Management Core Module

import { 
  getAuth, 
  onAuthStateChanged, 
  signOut, 
  sendPasswordResetEmail, 
  sendEmailVerification,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

let currentUser = null;
let currentUserRole = "Customer";

function getAuthInstance() {
  if (window.auth) return window.auth;
  return getAuth();
}

window.login = function() {
  const auth = getAuthInstance();
  const email = prompt("Enter your email address:");
  if (email === null) {
    console.log("Login cancelled.");
    return;
  }
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    alert("Email cannot be empty.");
    return;
  }
  const password = prompt("Enter your password:");
  if (password === null) {
    console.log("Login cancelled.");
    return;
  }
  
  console.log("Attempting sign in for " + cleanEmail + "...");
  signInWithEmailAndPassword(auth, cleanEmail, password)
    .then((userCredential) => {
      console.log("Login successful! Welcome " + userCredential.user.email);
      alert("Login successful!");
      window.location.reload();
    })
    .catch(err => {
      console.error("Login failed:", err.message);
      alert("Login failed: " + err.message);
    });
};

window.register = function() {
  const auth = getAuthInstance();
  const email = prompt("Enter email address to register:");
  if (email === null) {
    console.log("Registration cancelled.");
    return;
  }
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    alert("Email cannot be empty.");
    return;
  }
  const password = prompt("Enter password to register:");
  if (password === null) {
    console.log("Registration cancelled.");
    return;
  }
  
  console.log("Attempting registration for " + cleanEmail + "...");
  createUserWithEmailAndPassword(auth, cleanEmail, password)
    .then((userCredential) => {
      console.log("Registration successful! Welcome " + userCredential.user.email);
      sendEmailVerification(userCredential.user);
      alert("Registration successful! A verification email has been sent.");
      window.location.reload();
    })
    .catch(err => {
      console.error("Registration failed:", err.message);
      alert("Registration failed: " + err.message);
    });
};

window.processLogin = function(email, password) {
  const auth = getAuthInstance();
  const cleanEmail = (email || '').trim();
  if (!cleanEmail) {
    alert("Email cannot be empty.");
    return;
  }
  console.log("Attempting sign in for " + cleanEmail + "...");
  signInWithEmailAndPassword(auth, cleanEmail, password)
    .then((userCredential) => {
      console.log("Login successful! Welcome " + userCredential.user.email);
      alert("Login successful!");
      window.location.reload();
    })
    .catch(err => {
      console.error("Login failed:", err.message);
      alert("Login failed: " + err.message);
    });
};

window.processRegister = function(email, password) {
  const auth = getAuthInstance();
  const cleanEmail = (email || '').trim();
  if (!cleanEmail) {
    alert("Email cannot be empty.");
    return;
  }
  console.log("Attempting registration for " + cleanEmail + "...");
  createUserWithEmailAndPassword(auth, cleanEmail, password)
    .then((userCredential) => {
      console.log("Registration successful! Welcome " + userCredential.user.email);
      sendEmailVerification(userCredential.user);
      alert("Registration successful! A verification email has been sent.");
      window.location.reload();
    })
    .catch(err => {
      console.error("Registration failed:", err.message);
      alert("Registration failed: " + err.message);
    });
};

// --- MASTER FORGOT PASSWORD ---
window.universalForgotPassword = function(e) {
  if (e) e.preventDefault();
  const auth = getAuthInstance();
  
  const emailField = document.getElementById("email") || 
                     document.getElementById("login-email") || 
                     document.getElementById("register-email");
  
  let email = emailField ? emailField.value : "";

  if (!email || email.trim() === "") {
    email = prompt("Please enter your email address for the reset link:");
  }

  if (email) {
    sendPasswordResetEmail(auth, email)
      .then(() => alert("Success! A reset link has been sent to: " + email))
      .catch(err => alert("Error: " + err.message));
  }
};

/* ===============================
   AUTH STATE & ROLE LOGIC
================================ */
async function getUserRole(user) {
  if (!user) return "Customer";
  if (window.dbPromise) {
    await window.dbPromise;
  }
  if (window.db && window.dbDoc && window.dbGetDoc && window.dbSetDoc) {
    try {
      const userDocRef = window.dbDoc(window.db, "users", user.uid);
      const userSnap = await window.dbGetDoc(userDocRef);
      if (userSnap.exists()) {
        return userSnap.data().role || "Customer";
      } else {
        const defaultRole = user.email === "sub2meboyi@gmail.com" ? "Admin" : "Customer";
        await window.dbSetDoc(userDocRef, {
          email: user.email,
          role: defaultRole,
          status: "Active",
          timestamp: new Date().toISOString()
        });
        console.log("Automatically synchronized user registration metadata with Firestore.");
        return defaultRole;
      }
    } catch (e) {
      console.warn("Failed to get/sync user registration profile:", e);
      return user.email === "sub2meboyi@gmail.com" ? "Admin" : "Customer";
    }
  }
  return user.email === "sub2meboyi@gmail.com" ? "Admin" : "Customer";
}

async function protectRoutes(user, role) {
  const path = window.location.pathname;
  
  if (path.includes("admin.html")) {
    if (!user || role !== "Admin") {
      window.location.href = "index.html";
      return true;
    }
  }
  return false;
}

function updateAdminHeaderButton(user, role) {
  const isAdmin = user && role === "Admin";
  
  // 1. Desktop header button injection
  const headerUl = document.querySelector("header nav ul, header .header-right ul, header ul");
  let adminLi = document.getElementById("adminHeaderLi");
  
  if (isAdmin) {
    if (headerUl && !adminLi) {
      adminLi = document.createElement("li");
      adminLi.id = "adminHeaderLi";
      adminLi.style.display = "flex";
      adminLi.style.alignItems = "center";
      adminLi.style.marginLeft = "20px";
      
      adminLi.innerHTML = `
        <a href="admin.html" id="adminHeaderBtn" style="
          background: #ccff00 !important;
          color: #000 !important;
          border: 1px solid #000 !important;
          padding: 8px 16px !important;
          font-family: 'Gotham Narrow Bold', sans-serif !important;
          font-size: 11px !important;
          letter-spacing: 1.5px !important;
          text-transform: uppercase !important;
          text-decoration: none !important;
          font-weight: bold !important;
          display: inline-block !important;
          transition: all 0.2s ease !important;
          cursor: pointer !important;
        ">ADMIN PANEL</a>
      `;
      
      const accountLi = headerUl.querySelector(".header-account");
      if (accountLi) {
        headerUl.insertBefore(adminLi, accountLi);
      } else {
        headerUl.appendChild(adminLi);
      }
      
      const btn = adminLi.querySelector("#adminHeaderBtn");
      if (btn) {
        btn.addEventListener("mouseenter", () => { btn.style.opacity = "0.8"; });
        btn.addEventListener("mouseleave", () => { btn.style.opacity = "1"; });
      }
    }
  } else {
    if (adminLi) {
      adminLi.remove();
    }
  }

  // 2. Mobile menu button injection
  const menuPanel = document.getElementById("menuPanel");
  let mobileAdminBtn = document.getElementById("mobileAdminPanelBtn");
  
  if (isAdmin) {
    if (menuPanel && !mobileAdminBtn) {
      mobileAdminBtn = document.createElement("a");
      mobileAdminBtn.id = "mobileAdminPanelBtn";
      mobileAdminBtn.href = "admin.html";
      mobileAdminBtn.textContent = "ADMIN PANEL";
      mobileAdminBtn.style.cssText = `
        display: block;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.28em;
        margin: 26px 0;
        color: #000;
        font-weight: bold;
        background: #ccff00;
        border: 1px solid #000;
        padding: 12px;
        text-align: center;
        text-decoration: none;
      `;
      
      const mobileAccBlock = document.getElementById("mobileAccountBlock");
      if (mobileAccBlock) {
        menuPanel.insertBefore(mobileAdminBtn, mobileAccBlock);
      } else {
        menuPanel.appendChild(mobileAdminBtn);
      }
    }
  } else {
    if (mobileAdminBtn) {
      mobileAdminBtn.remove();
    }
  }
}

/* ===============================
   MOBILE ACCOUNT LOGIC
================================ */
function setupMobileAccount(user) {
  const myAcc = document.getElementById("mobileMyAccount");
  const drop = document.getElementById("mobileAccountDropdown");
  const logoutBtn = document.getElementById("mobileLogout");
  const mobileAccBlock = document.getElementById("mobileAccountBlock");
  if (!myAcc || !drop || !logoutBtn) return;

  if (!user) {
    if (mobileAccBlock) mobileAccBlock.style.display = "none";
    myAcc.style.display = "none";
    drop.style.display = "none";
    logoutBtn.style.display = "none";
    return;
  }

  if (mobileAccBlock) mobileAccBlock.style.display = "block";
  myAcc.style.display = "block";

  myAcc.innerHTML = `<span>MY ACCOUNT</span> <span class="mobile-arrow">▸</span>`;
  logoutBtn.style.display = "block";
  const desktopDrop = document.getElementById("accountDropdown");
  
  if (desktopDrop) {
    let cleanHTML = desktopDrop.innerHTML;
    drop.innerHTML = cleanHTML;
    drop.querySelectorAll("[onclick*='logout']").forEach(el => el.remove());
  }

  myAcc.onclick = () => {
    const isOpen = drop.style.display === "block";
    drop.style.display = isOpen ? "none" : "block";
    const arrow = myAcc.querySelector(".mobile-arrow");
    if (arrow) arrow.style.transform = isOpen ? "rotate(0deg)" : "rotate(90deg)";
  };

  logoutBtn.onclick = () => { 
    signOut(getAuthInstance()).then(() => { window.location.href = "index.html"; }); 
  };
}

/* ===============================
   DESKTOP DROPDOWN & LOGOUT
================================ */
window.accountClicked = function(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  const auth = getAuthInstance();
  if (!auth.currentUser) {
    window.location.href = "index.html";
    return;
  }
  
  const dropdown = document.getElementById('accountDropdown');
  const dimmer = document.getElementById('pageDimmer');
  
  if (dropdown) dropdown.style.display = 'block';
  if (dimmer) dimmer.classList.add('active');
};

window.closeAccDropdown = function() {
  const dropdown = document.getElementById('accountDropdown');
  const dimmer = document.getElementById('pageDimmer');
  
  if (dropdown) dropdown.style.display = 'none';
  if (dimmer) dimmer.classList.remove('active');
};

window.logout = function() {
  const auth = getAuthInstance();
  signOut(auth)
    .then(() => {
      window.location.href = "index.html"; 
    })
    .catch((error) => {
      console.error("Logout Error:", error);
    });
};

// Initialize auth state listeners
function initAuthModule() {
  const auth = getAuthInstance();
  
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    window.currentUser = user;
    
    const role = await getUserRole(user);
    currentUserRole = role;
    window.currentUserRole = role;
    
    if (await protectRoutes(user, role)) return;
    
    const headerAccs = document.querySelectorAll(".header-account");
    headerAccs.forEach(el => {
      el.style.display = user ? "block" : "none";
    });

    const label = document.getElementById("accountLabel");
    const accName = document.getElementById("accName");

    if (user) {
      let email = user.email || "";
      if (label) label.textContent = email.length > 12 ? email.substring(0, 12) + "..." : email;
      if (accName) accName.textContent = user.email;
    } else {
      if (label) label.textContent = "Account";
      if (accName) accName.textContent = "ACCOUNT";
    }
    setupMobileAccount(user);
    updateAdminHeaderButton(user, role);
    if (typeof window.renderCartUI === "function") {
      window.renderCartUI();
    }
  });

  const dimmer = document.getElementById('pageDimmer');
  if (dimmer) {
    dimmer.addEventListener('click', window.closeAccDropdown);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthModule);
} else {
  initAuthModule();
}
