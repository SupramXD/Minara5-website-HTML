import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    sendPasswordResetEmail, // Added
    sendEmailVerification   // Added
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

// --- NEW UNIVERSAL FORGOT PASSWORD ---
// This function will look for an email input and a message area in your HTML
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

// --- NEW UNIVERSAL VERIFICATION SENDER ---
// This helps send the email immediately after registration
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
        // Check if verified for display purposes
        const displayEmail = user.emailVerified ? email : email + " (Unverified)";
        
        if (email.length > 12) email = email.substring(0, 12) + "...";
        if (label) label.textContent = email;
        if (accName) accName.textContent = displayEmail;
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

    drop.innerHTML = "";

    if (!user) {
        myAcc.innerHTML = "LOGIN";
        myAcc.onclick = () => {
            window.location.href = "account.html";
        };
        drop.style.display = "none";
        logoutBtn.style.display = "none";
        return;
    }

    myAcc.innerHTML = `
        <span>MY ACCOUNT</span>
        <span class="mobile-arrow open">▸</span>
    `;
    logoutBtn.style.display = "block";

    const arrow = myAcc.querySelector(".mobile-arrow");
    const desktopDrop = document.getElementById("accountDropdown");
    drop.innerHTML = desktopDrop.innerHTML;

    drop.querySelectorAll("[onclick*='logout']").forEach(el => el.remove());

    drop.style.display = "block";
    arrow.classList.add("open");

    function toggle() {
        const isOpen = drop.style.display === "block";
        drop.style.display = isOpen ? "none" : "block";
        arrow.classList.toggle("open", !isOpen);
    }

    myAcc.onclick = toggle;

    const closeBtn = drop.querySelector(".acc-close");
    if (closeBtn) {
        closeBtn.onclick = toggle;
    }

    logoutBtn.onclick = () => {
        signOut(auth).then(() => {
            window.location.href = "index.html";
        });
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

document.addEventListener("click", function(e) {
    const box = document.getElementById("accountDropdown");
    if (!box) return;
    if (!box.contains(e.target) && !e.target.classList.contains("account-label")) {
        box.style.display = "none";
    }
});

// Export auth to be used by other scripts if needed
window.auth = auth;
