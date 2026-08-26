// Studio Extrait - Admin Auth & Security Gateway Bootstrapper Module

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { initializeFirestore, setLogLevel, collection, getDocs, query, orderBy, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyC8srbzH_DcCYQJXe9MNOyy2OHZSaLidIo",
  authDomain: "minara5.firebaseapp.com",
  projectId: "minara5",
  storageBucket: "minara5.firebasestorage.app",
  messagingSenderId: "860405871052",
  appId: "1:860405871052:web:2aead90773c24721f72d69"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const isLocalFile = window.location.protocol === "file:";
const db = initializeFirestore(app, isLocalFile ? {
  experimentalForceLongPolling: true
} : {});
const functions = getFunctions(app);

try {
  setLogLevel('debug');
} catch (e) {}

// Global Firebase bindings for admin modules
window.db = db;
window.auth = auth;
window.functions = functions;
window.syncToGithubCallable = httpsCallable(functions, "syncToGithub");
window.dbDoc = doc;
window.dbGetDoc = getDoc;
window.dbSetDoc = setDoc;
window.dbUpdateDoc = updateDoc;
window.dbDeleteDoc = deleteDoc;
window.dbCollection = collection;
window.dbGetDocs = getDocs;
window.dbAddDoc = addDoc;
window.dbQuery = query;
window.dbOrderBy = orderBy;

// Secure router / rendering engine
onAuthStateChanged(auth, async (user) => {
  if (user && user.email === 'sub2meboyi@gmail.com') {
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists() && userSnap.data().role === "Admin") {
        try {
          localStorage.setItem("minara_auth_role", "Admin");
        } catch(e) {}
        window.currentUserRole = "Admin";
        
        // Unlock admin interface
        const guardEl = document.getElementById("admin-security-guard");
        if (guardEl) guardEl.style.display = "none";
        
        const appEl = document.getElementById("admin-app");
        if (appEl) appEl.style.display = "block";
        
        document.body.style.display = "block";

        // Initial Data Loads
        if (typeof window.fetchSubscribers === "function") window.fetchSubscribers();
        if (typeof window.loadCatalog === "function") window.loadCatalog();
        if (typeof window.fetchUsers === "function") window.fetchUsers();
        if (typeof window.loadHeroSettings === "function") window.loadHeroSettings();
        if (typeof window.loadCustomTextSettings === "function") window.loadCustomTextSettings();
        if (typeof window.loadAdminOrders === "function") window.loadAdminOrders();
        return;
      }
    } catch (e) {
      console.error("Authorization check failed:", e);
    }
  }
  
  // Clean up DOM completely and bounce unauthorized attempts
  document.body.innerHTML = "";
  window.location.href = "index.html";
});
