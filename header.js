import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    sendPasswordResetEmail, 
    sendEmailVerification 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

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

// --- UNIVERSAL FORGOT PASSWORD ---
window.universalForgotPassword = function() {
    const emailField = document.getElementById("login-email");
    const msgField = document.getElementById("resetMsg");
    const email = emailField ? emailField.value : "";

    if (!email) {
        if (msgField) {
            msgField.innerText = "Please enter your email above first.";
            msgField.style.color = "red";
        } else {
            alert("Please enter your email address first.");
        }
        return;
    }

    sendPasswordResetEmail(auth, email)
        .then(() => {
            if (msgField) {
                msgField.innerText = "Reset link sent! Check your inbox.";
                msgField.style.color = "green";
            } else {
                alert("Password reset email sent!");
            }
        })
        .catch((error) => {
            if (msgField) {
                msgField.innerText = error.message;
                msgField.style.color = "red";
            } else {
                alert(error.message);
            }
        });
};

// --- UNIVERSAL VERIFICATION SENDER ---
window.sendVerification = function(user) {
    if (!user) return;
    sendEmailVerification(user)
        .then(() => console.log("Verification email sent."))
        .catch((error) => console.error("Verification error:", error.message));
};

/* ===============================
   AUTH STATE
================================ */
onAuthStateChanged(auth, (user) => {
    currentUser = user;

    const label = document.getElementById("accountLabel");
    const accName = document.getElementById("accName");

    if (user) {
        let email = user.email;
        // Logic: Show unverified status in the dropdown but keep the label clean
        const displayEmail = user.emailVerified ? email : email + " (Unverified)";
        
        // Truncate email for the small header label
        let shortEmail = email.length > 12 ? email.substring(0, 12) + "..." : email;
        
        if (label) label.textContent = shortEmail;
        if (accName) accName.textContent = displayEmail;
    } else {
        if (label) label.textContent = "Account";
        if (accName) accName.textContent = "ACCOUNT";
    }

    setupMobileAccount(user);
});

/* ===============================
   MOBILE ACCOUNT
================================ */
function setupMobileAccount(user) {
    const myAcc = document.getElementById("mobileMyAccount");
    const drop = document.getElementById("mobileAccountDropdown");
    const logoutBtn = document.getElementById("mobileLogout");

    if (!myAcc || !drop || !logoutBtn) return;

    if (!user) {
        myAcc.innerHTML = "LOGIN";
        myAcc.onclick = () => { window.location.href = "account.html"; };
        drop.style.display = "none";
        logoutBtn.style.display = "none";
        return;
    }

    myAcc.innerHTML = `<span>MY ACCOUNT</span> <span class="mobile-arrow">▸</span>`;
    logoutBtn.style.display = "block";

    // Clone the desktop dropdown content into the mobile dropdown
    const desktopDrop = document.getElementById("accountDropdown");
    if (desktopDrop) {
        // Filter out existing logouts to avoid doubles
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
        signOut(auth).then(() => { window.location.href = "index.html"; });
    };
}

/* ===============================
   DESKTOP DROPDOWN
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

document.addEventListener("click", (e) => {
    const box = document.getElementById("accountDropdown");
    if (box && !box.contains(e.target) && !e.target.closest(".account-trigger")) {
        box.style.display = "none";
    }
});

// Export auth globally
window.auth = auth;
