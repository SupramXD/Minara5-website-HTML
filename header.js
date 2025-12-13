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
   AUTH STATE
================================ */
onAuthStateChanged(auth, (user) => {
    currentUser = user;

    /* ===== DESKTOP HEADER (EMAIL) ===== */
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

    setupMobileAccount(user);
});

/* ===============================
   MOBILE ACCOUNT (FINAL)
================================ */
function setupMobileAccount(user) {

    const myAcc = document.getElementById("mobileMyAccount");
    const drop = document.getElementById("mobileAccountDropdown");
    const logoutBtn = document.getElementById("mobileLogout");

    if (!myAcc || !drop || !logoutBtn) return;

    // Reset
    drop.innerHTML = "";

    /* ===============================
       LOGGED OUT → LOGIN ONLY
    ================================= */
    if (!user) {
        myAcc.innerHTML = "LOGIN";
        myAcc.onclick = () => {
            window.location.href = "account.html";
        };
        drop.style.display = "none";
        logoutBtn.style.display = "none";
        return;
    }

    /* ===============================
       LOGGED IN
    ================================= */
    myAcc.innerHTML = `
        <span>MY ACCOUNT</span>
        <span class="mobile-arrow open">▸</span>
    `;
    logoutBtn.style.display = "block";

    const arrow = myAcc.querySelector(".mobile-arrow");

    // Inject desktop dropdown content
    const desktopDrop = document.getElementById("accountDropdown");
    drop.innerHTML = desktopDrop.innerHTML;

    // Remove logout from injected dropdown (mobile has its own)
    drop.querySelectorAll("[onclick*='logout']").forEach(el => el.remove());

    // OPEN BY DEFAULT
    drop.style.display = "block";
    arrow.classList.add("open");

    /* TOGGLE OPEN / CLOSE */
    function toggle() {
        const isOpen = drop.style.display === "block";
        drop.style.display = isOpen ? "none" : "block";
        arrow.classList.toggle("open", !isOpen);
    }

    // Clicking MY ACCOUNT area OR arrow
    myAcc.onclick = toggle;

    // X CLOSE inside dropdown
    const closeBtn = drop.querySelector(".acc-close");
    if (closeBtn) {
        closeBtn.onclick = toggle;
    }

    // LOGOUT
    logoutBtn.onclick = () => {
        signOut(auth).then(() => {
            window.location.href = "index.html";
        });
    };
}

/* ===============================
   DESKTOP DROPDOWN (UNCHANGED)
================================ */
window.accountClicked = function(event) {
    event.stopPropagation();
    if (!currentUser) {
        window.location.href = "account.html";
        return;
    }
    const box = document.getElementById("accountDropdown");
    box.style.display = box.style.display === "block" ? "none" : "block";
};

window.closeAccDropdown = function() {
    document.getElementById("accountDropdown").style.display = "none";
};

document.addEventListener("click", function(e) {
    const box = document.getElementById("accountDropdown");
    if (!box) return;
    if (!box.contains(e.target) && !e.target.classList.contains("account-label")) {
        box.style.display = "none";
    }
});
