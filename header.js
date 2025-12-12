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

/* UPDATE HEADER LABEL */
onAuthStateChanged(auth, (user) => {
    currentUser = user;

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
});

/* CLICK HANDLER */
window.accountClicked = function(event){
    event.stopPropagation();

    if (!currentUser) {
        location.href = "account.html";
        return;
    }

    const box = document.getElementById("accountDropdown");
    box.style.display = (box.style.display === "block") ? "none" : "block";
};

/* CLOSE DROPDOWN */
window.closeAccDropdown = function(){
    document.getElementById("accountDropdown").style.display = "none";
};

/* LOG OUT */
window.logout = function(){
    signOut(auth).then(()=>{
        location.href = "index.html";
    });
};

/* CLICK OUTSIDE TO CLOSE */
document.addEventListener("click", function(e){
    const box = document.getElementById("accountDropdown");
    if (!box) return;

    if (!box.contains(e.target) && !e.target.classList.contains("account-label")) {
        box.style.display = "none";
    }
});
