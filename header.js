import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC8srbzH_DcCYQJXe9MNOyy2OHZSaLidIo",
    authDomain: "minara5.firebaseapp.com",
    projectId: "minara5",
    storageBucket: "minara5.firebasestorage.app",
    messagingSenderId: "860405871052",
    appId: "1:860405871052:web:2aead90773c24721f72d69"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;

/* ===============================
   DESKTOP + GLOBAL AUTH STATE
================================= */
onAuthStateChanged(auth, (user) => {
    currentUser = user;

    // DESKTOP LABEL
    const label = document.getElementById("accountLabel");
    const accName = document.getElementById("accName");

    if (user) {
        let email = user.email;
        if (email.length > 12) email = email.substring(0, 12) + "...";
        if (label) label.textContent = email;
        if (accName) accName.textContent = email;
    } else {
        if (label) label.textContent = "Account";
    }

    // UPDATE MOBILE TEXT ONLY (no handlers here)
    const mobileLink = document.getElementById("mobileAccountLink");
    if (mobileLink) {
        mobileLink.textContent = user ? "MY ACCOUNT" : "LOGIN";
    }
});

/* ===============================
   DESKTOP CLICK
================================= */
window.accountClicked = function (event) {
    event.stopPropagation();

    if (!currentUser) {
        location.href = "account.html";
        return;
    }

    const box = document.getElementById("accountDropdown");
    if (!box) return;

    box.style.display = box.style.display === "block" ? "none" : "block";
};

window.closeAccDropdown = function () {
    const box = document.getElementById("accountDropdown");
    if (box) box.style.display = "none";
};

/* ===============================
   LOG OUT (GLOBAL)
================================= */
window.logout = function () {
    signOut(auth).then(() => {
        location.href = "index.html";
    });
};

/* ===============================
   MOBILE CLICK (THIS WAS MISSING)
================================= */
document.addEventListener("DOMContentLoaded", () => {
    const mobileLink = document.getElementById("mobileAccountLink");
    if (!mobileLink) return;

    mobileLink.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!currentUser) {
            // NOT LOGGED IN
            window.location.href = "account.html";
            return;
        }

        // LOGGED IN → toggle dropdown
        const box = document.getElementById("accountDropdown");
        if (!box) return;

        box.style.display = "block";
    });
});

/* ===============================
   CLICK OUTSIDE CLOSE (DESKTOP)
================================= */
document.addEventListener("click", (e) => {
    const box = document.getElementById("accountDropdown");
    if (!box) return;

    if (!box.contains(e.target) && !e.target.closest(".account-trigger")) {
        box.style.display = "none";
    }
});
