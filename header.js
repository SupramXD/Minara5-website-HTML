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

    /* DESKTOP LABEL */
    const label = document.getElementById("accountLabel");
    const accName = document.getElementById("accName");

    if (user) {
        if (label) label.textContent = "MY ACCOUNT";
        if (accName) accName.textContent = "MY ACCOUNT";
    } else {
        if (label) label.textContent = "ACCOUNT";
    }

    setupMobileAccount(user);
});

/* ===============================
   MOBILE ACCOUNT
================================ */
function setupMobileAccount(user){

    const block = document.getElementById("mobileAccountBlock");
    const myAcc = document.getElementById("mobileMyAccount");
    const drop = document.getElementById("mobileAccountDropdown");
    const logoutBtn = document.getElementById("mobileLogout");
    const arrow = document.getElementById("mobileArrow");

    if (!block) return;

    // RESET
    block.style.display = "block";
    drop.style.display = "none";
    if (arrow) arrow.classList.remove("open");

    if (!user) {
        // LOGGED OUT → LOGIN ONLY
        myAcc.textContent = "LOGIN";
        myAcc.onclick = () => location.href = "account.html";
        logoutBtn.style.display = "none";
        drop.innerHTML = "";
        return;
    }

    // LOGGED IN
    myAcc.childNodes[0].nodeValue = "MY ACCOUNT ";
    logoutBtn.style.display = "block";

    // Inject dropdown content (WITHOUT logout)
    const desktopDrop = document.getElementById("accountDropdown");
    drop.innerHTML = desktopDrop.innerHTML;
    drop.querySelectorAll("[onclick*='logout']").forEach(el => el.remove());

    myAcc.onclick = () => {
        const open = drop.style.display === "block";
        drop.style.display = open ? "none" : "block";
        if (arrow) arrow.classList.toggle("open", !open);
    };

    logoutBtn.onclick = () => {
        signOut(auth).then(() => location.href = "index.html");
    };
}

/* ===============================
   DESKTOP DROPDOWN (UNCHANGED)
================================ */
window.accountClicked = function(event){
    event.stopPropagation();
    if (!currentUser) {
        location.href = "account.html";
        return;
    }
    const box = document.getElementById("accountDropdown");
    box.style.display = box.style.display === "block" ? "none" : "block";
};

window.closeAccDropdown = function(){
    document.getElementById("accountDropdown").style.display = "none";
};

document.addEventListener("click", function(e){
    const box = document.getElementById("accountDropdown");
    if (!box) return;
    if (!box.contains(e.target) && !e.target.classList.contains("account-label")) {
        box.style.display = "none";
    }
});
