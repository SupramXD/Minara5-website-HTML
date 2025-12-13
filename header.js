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

    /* DESKTOP — EMAIL */
    const label = document.getElementById("accountLabel");
    const accName = document.getElementById("accName");

    if (user) {
        let email = user.email;
        if (email.length > 12) email = email.substring(0,12) + "...";
        if (label) label.textContent = email;
        if (accName) accName.textContent = email;
    } else {
        if (label) label.textContent = "Account";
    }

    setupMobileAccount(user);
});

/* ===============================
   MOBILE ACCOUNT (ACCORDION)
================================ */
function setupMobileAccount(user){

    const myAcc = document.getElementById("mobileMyAccount");
    const drop = document.getElementById("mobileAccountDropdown");
    const logoutBtn = document.getElementById("mobileLogout");

    if (!myAcc || !drop || !logoutBtn) return;

    drop.style.display = "none";
    drop.innerHTML = "";

    if (!user) {
        /* LOGGED OUT */
        myAcc.innerHTML = "LOGIN";
        myAcc.onclick = () => location.href = "account.html";
        logoutBtn.style.display = "none";
        return;
    }

    /* LOGGED IN */
    myAcc.innerHTML = `
        <span>MY ACCOUNT</span>
        <span class="mobile-arrow">▸</span>
    `;
    logoutBtn.style.display = "block";

    const arrow = myAcc.querySelector(".mobile-arrow");

    /* Inject dropdown content */
    const desktopDrop = document.getElementById("accountDropdown");
    drop.innerHTML = desktopDrop.innerHTML;

    /* Remove duplicate logout */
    drop.querySelectorAll("[onclick*='logout']").forEach(el => el.remove());

    /* TOGGLE OPEN/CLOSE */
    function toggle(){
        const open = drop.style.display === "block";
        drop.style.display = open ? "none" : "block";
        arrow.classList.toggle("open", !open);
    }

    myAcc.onclick = toggle;

    /* X CLOSE */
    const closeBtn = drop.querySelector(".acc-close");
    if (closeBtn) {
        closeBtn.onclick = toggle;
    }

    /* LOGOUT */
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
