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
window.auth = auth; // Keeps it accessible for your account.html
let currentUser = null;

// --- MASTER TRIGGERS (Fixes "Nothing Happening") ---

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
        .then(() => { window.location.href = "index.html"; })
        .catch(err => alert(err.message));
};

// --- MASTER FORGOT PASSWORD FIX ---
window.universalForgotPassword = function(e) {
    if (e) e.preventDefault(); // STOPS the page from refreshing
    
    // This checks for "email" (your Login ID) and "register-email" (your Register ID)
    const emailField = document.getElementById("email") || 
                       document.getElementById("login-email") || 
                       document.getElementById("register-email");
    
    let email = emailField ? emailField.value : "";

    // If no email is typed, we use a prompt so the button ALWAYS works
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
   AUTH STATE & UI LOGIC
================================ */
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const label = document.getElementById("accountLabel");
    const accName = document.getElementById("accName");

    if (user) {
        let email = user.email;
        if (label) label.textContent = email.length > 12 ? email.substring(0, 12) + "..." : email;
        if (accName) accName.textContent = user.email;
    } else {
        if (label) label.textContent = "Account";
        if (accName) accName.textContent = "ACCOUNT";
    }
    setupMobileAccount(user);
});

/* ===============================
   MOBILE ACCOUNT LOGIC (Preserved)
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
    const desktopDrop = document.getElementById("accountDropdown");
    
    if (desktopDrop) {
        // FILTERING LOGIC PRESERVED
        let cleanHTML = desktopDrop.innerHTML;
        drop.innerHTML = cleanHTML;
        drop.querySelectorAll("[onclick*='logout']").forEach(el => el.remove());
    }

    myAcc.onclick = () => {
        const isOpen = drop.style.display === "block";
        drop.style.display = isOpen ? "none" : "block";
        const arrow = myAcc.querySelector(".mobile-arrow");
        // ROTATION LOGIC PRESERVED
        if (arrow) arrow.style.transform = isOpen ? "rotate(0deg)" : "rotate(90deg)";
    };

    logoutBtn.onclick = () => { signOut(auth).then(() => { window.location.href = "index.html"; }); };
}

/* ===============================
   DESKTOP DROPDOWN (Preserved)
================================ */
window.accountClicked = function(event) {
    event.stopPropagation();
    if (!currentUser) { window.location.href = "account.html"; return; }
    const box = document.getElementById("accountDropdown");
    box.style.display = box.style.display === "block" ? "none" : "block";
};

window.logout = function() { signOut(auth).then(() => { window.location.href = "index.html"; }); };
window.closeAccDropdown = function() { document.getElementById("accountDropdown").style.display = "none"; };

document.addEventListener("click", (e) => {
    const box = document.getElementById("accountDropdown");
    if (box && !box.contains(e.target)) box.style.display = "none";
});

function accountClicked(event) {
    const dropdown = document.getElementById('accountDropdown');
    const isOpening = dropdown.style.display !== 'block';
    
    if (isOpening) {
        dropdown.style.display = 'block';
        document.body.classList.add('acc-dimmer-active'); // Triggers the dim
    } else {
        closeAccDropdown();
    }
}

function closeAccDropdown() {
    document.getElementById('accountDropdown').style.display = 'none';
    document.body.classList.remove('acc-dimmer-active'); // Removes the dim
}
