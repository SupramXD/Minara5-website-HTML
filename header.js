import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    sendPasswordResetEmail, 
    sendEmailVerification,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

/* ===============================
   FIREBASE INIT
================================ */
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
window.auth = auth;

let currentUser = null;

/* ===============================
   AUTH ACTIONS
================================ */
window.processRegister = function(email, password) {
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            sendEmailVerification(userCredential.user);
            window.location.href = "index.html"; 
        })
        .catch(err => alert(err.message));
};

window.processLogin = function(email, password) {
    signInWithEmailAndPassword(auth, email, password)
        .then(() => window.location.href = "index.html")
        .catch(err => alert(err.message));
};

/* ===============================
   FORGOT PASSWORD (NO POPUP)
================================ */
window.universalForgotPassword = function(e) {
    if (e) e.preventDefault();

    const emailField =
        document.getElementById("email") ||
        document.getElementById("login-email") ||
        document.getElementById("register-email");

    const email = emailField?.value?.trim();

    if (!email) {
        alert("Please enter your email first.");
        return;
    }

    sendPasswordResetEmail(auth, email)
        .then(() => alert("Password reset email sent."))
        .catch(err => alert(err.message));
};

/* ===============================
   AUTH STATE
================================ */
onAuthStateChanged(auth, (user) => {
    currentUser = user;

    const label = document.getElementById("accountLabel");
    const accName = document.getElementById("accName");

    if (user) {
        const shortEmail =
            user.email.length > 12
                ? user.email.substring(0, 12) + "..."
                : user.email;

        if (label) label.textContent = shortEmail;
        if (accName) accName.textContent = user.email;
    } else {
        if (label) label.textContent = "ACCOUNT";
        if (accName) accName.textContent = "ACCOUNT";
    }

    setupMobileAccount(user);
});

/* ===============================
   MOBILE ACCOUNT LOGIC
================================ */
function setupMobileAccount(user) {
    const myAcc = document.getElementById("mobileMyAccount");
    const drop = document.getElementById("mobileAccountDropdown");
    const logoutBtn = document.getElementById("mobileLogout");

    if (!myAcc || !drop || !logoutBtn) return;

    if (!user) {
        myAcc.textContent = "LOGIN";
        myAcc.onclick = () => window.location.href = "account.html";
        drop.style.display = "none";
        logoutBtn.style.display = "none";
        return;
    }

    myAcc.innerHTML = `<span>MY ACCOUNT</span> <span class="mobile-arrow">▸</span>`;
    logoutBtn.style.display = "block";

    const desktopDrop = document.getElementById("accountDropdown");
    if (desktopDrop) {
        drop.innerHTML = desktopDrop.innerHTML;
        drop.querySelectorAll("[onclick*='logout']").forEach(el => el.remove());
    }

    myAcc.onclick = () => {
        const isOpen = drop.style.display === "block";
        drop.style.display = isOpen ? "none" : "block";
        const arrow = myAcc.querySelector(".mobile-arrow");
        if (arrow) arrow.style.transform = isOpen ? "rotate(0deg)" : "rotate(90deg)";
    };

    logoutBtn.onclick = () =>
        signOut(auth).then(() => window.location.href = "index.html");
}

/* ===============================
   DESKTOP ACCOUNT DROPDOWN
   (NO DIMMER — THIS IS THE FIX)
================================ */
window.accountClicked = function(event) {
    event?.preventDefault();
    event?.stopPropagation();

    const dropdown = document.getElementById("accountDropdown");

    // Close cart if open
    document.getElementById("cartPanel")?.classList.remove("open");
    document.getElementById("pageDimmer")?.classList.remove("active");

    if (!dropdown) return;

    dropdown.style.display =
        dropdown.style.display === "block" ? "none" : "block";

    document.body.style.overflow = "hidden";
};

window.closeAccDropdown = function() {
    const dropdown = document.getElementById("accountDropdown");
    if (dropdown) dropdown.style.display = "none";
    document.body.style.overflow = "";
};

/* ===============================
   CLICK OUTSIDE TO CLOSE ACCOUNT
================================ */
document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("accountDropdown");
    const trigger = document.querySelector(".account-trigger");

    if (!dropdown || !trigger) return;

    if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
        dropdown.style.display = "none";
        document.body.style.overflow = "";
    }
});
