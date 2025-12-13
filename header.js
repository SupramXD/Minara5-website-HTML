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

    /* DESKTOP LABEL (UNCHANGED) */
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

    /* MOBILE ACCOUNT BLOCK */
    const mobileBlock = document.getElementById("mobileAccountBlock");
    if (!mobileBlock) return;

    if (!user) {
        // not logged in → redirect to login
        mobileBlock.onclick = () => {
            window.location.href = "account.html";
        };
        return;
    }

    setupMobileAccount();
});

/* ===============================
   MOBILE ACCOUNT LOGIC
================================ */
function setupMobileAccount(){

    const myAcc = document.getElementById("mobileMyAccount");
    const logoutBtn = document.getElementById("mobileLogout");
    const mobileDrop = document.getElementById("mobileAccountDropdown");

    if (!myAcc || !logoutBtn || !mobileDrop) return;

    // Inject existing dropdown content
    const desktopDrop = document.getElementById("accountDropdown");
    mobileDrop.innerHTML = desktopDrop.innerHTML;

    myAcc.onclick = () => {
        mobileDrop.style.display =
            mobileDrop.style.display === "block" ? "none" : "block";
    };

    logoutBtn.onclick = () => {
        signOut(auth).then(()=>{
            location.href = "index.html";
        });
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
