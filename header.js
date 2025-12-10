import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

/* FIREBASE CONFIG */
const firebaseConfig = {
    apiKey: "AIzaSyC8srbzH_DcCYQJXe9MNOyy2OHZSaLidIo",
    authDomain: "minara5.firebaseapp.com",
    projectId: "minara5",
    storageBucket: "minara5.firebasestorage.app",
    messagingSenderId: "860405871052",
    appId: "1:860405871052:web:2aead90773c24721f72d69",
    measurementId: "G-2M9B3NS032"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/* UPDATE ACCOUNT LABEL IN HEADER */
onAuthStateChanged(auth, (user) => {
    const label = document.getElementById("accountLabel");
    if (!label) return;  // if page has no label, skip

    if (user) {
        let email = user.email;
        if (email.length > 12) {
            email = email.substring(0, 12) + "...";
        }
        label.textContent = email;
    } else {
        label.textContent = "Account";
    }
});
