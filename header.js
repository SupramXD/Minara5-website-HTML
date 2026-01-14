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
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Check if user is logged in before showing dropdown
    if (!auth.currentUser) {
        window.location.href = "account.html"; // Redirect to login if not authenticated
        return;
    }
    
    const dropdown = document.getElementById('accountDropdown');
    const dimmer = document.getElementById('pageDimmer');
    
    if (dropdown) dropdown.style.display = 'block';
    if (dimmer) dimmer.classList.add('active');
};

window.closeAccDropdown = function() {
    const dropdown = document.getElementById('accountDropdown');
    const dimmer = document.getElementById('pageDimmer');
    
    if (dropdown) dropdown.style.display = 'none';
    if (dimmer) dimmer.classList.remove('active');
};

// Ensure clicking the dimmer also closes the account box
document.addEventListener('DOMContentLoaded', () => {
    const dimmer = document.getElementById('pageDimmer');
    if (dimmer) {
        dimmer.addEventListener('click', closeAccDropdown);
    }
});
window.logout = function() {
    signOut(auth)
        .then(() => {
            // This clears the session and sends them back to the home page
            window.location.href = "index.html"; 
        })
        .catch((error) => {
            console.error("Logout Error:", error);
        });
};

// CART WITH ID SYSTEM

// 1. PRODUCT DATA
const products = {
    "leopard-backpack": {
        id: "leopard-backpack",
        name: "Léopard Fur Backpack",
        price: 749, // Updated to match your R749 price in HTML
        image: "cheetahproduct.avif"
    }
};

// 2. INITIALIZE CART
let cart = JSON.parse(localStorage.getItem('minara_cart')) || [];

// 3. THE ADD FUNCTION
window.addToCart = function(productId) {
    const product = products[productId];
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    saveAndSyncCart();
    
    // AUTO-OPEN THE CART (Matches the function name in your HTML)
    if (typeof openCart === "function") {
        openCart();
    }
};

function saveAndSyncCart() {
    localStorage.setItem('minara_cart', JSON.stringify(cart));
    
    // Update Header Numbers (Both Desktop and Mobile)
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const countStr = totalItems.toString().padStart(2, '0');
    
    ["cartCountHeader", "cartCountHeaderMobile", "cartCountPanel"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = countStr;
    });

    renderCartUI();
}

// 4. RENDER UI (Globalized so leopard.html can call it)
window.renderCartUI = function() {
    const cartContainer = document.querySelector('.cart-body');
    const asciiContainer = document.querySelector('.cart-ascii');
    const countPanel = document.getElementById('cartCountPanel');
    if (!cartContainer || !asciiContainer) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (countPanel) countPanel.textContent = totalItems.toString().padStart(2, '0');

    if (cart.length === 0) {
        // Unicode for "EMPTY"
        asciiContainer.textContent = ` _____   __  __   ____    _____  __   __\n| ____| |  \\/  | |  _ \\  |_   _| \\ \\ / /\n|  _|   | |\\/| | | |_) |   | |    \\ V / \n| |___  | |  | | |  __/    | |     | |  \n|_____| |_|  |_| |_|       |_|     |_|  `;
        cartContainer.innerHTML = `
            <p style="text-align:center; padding:40px 0; font-size:11px; letter-spacing:1px;">YOUR BAG IS EMPTY</p>
            <div class="cart-auth-links" style="justify-content:center; margin-top:20px;">
                <a href="account.html">Sign in</a>
                <a href="register.html">Register</a>
            </div>`;
        return;
    }

    // Change Unicode to "BAG" when items exist
    asciiContainer.textContent = ` ____       _       ____ \n| __ )     / \\     / ___|\n|  _ \\    / _ \\   | |  _ \n| |_) |  / ___ \\  | |_| |\n|____/  /_/   \\_\\  \\____|`;

    let html = '<div class="cart-items-list" style="margin-top:20px;">';
    cart.forEach((item, index) => {
        html += `
            <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 40px; border-bottom: 1px solid #eee; padding-bottom: 20px;">
                <img src="${item.image}" style="width: 100%; height: auto; object-fit: cover;">
                <div style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="font-family:'Gotham Narrow Bold', sans-serif; font-size:13px; text-transform:uppercase; letter-spacing:0.2em; line-height:1.4;">
                            ${item.name}<br>
                            <span style="font-size:11px; opacity:0.6; font-weight:400;">SIZE: O/S</span>
                        </div>
                        <span onclick="removeFromCart(${index})" style="cursor:pointer; font-size:16px; color:#00008B;">✕</span>
                    </div>
                    <div style="margin-top: 15px; font-size: 12px; letter-spacing: 0.1em;">
                        QTY: ${item.quantity}<br>
                        PRICE: R${item.price.toLocaleString()}
                    </div>
                </div>
            </div>`;
    });
    html += '</div>';

    cartContainer.innerHTML = html;
    
    // Update Totals in bottom section
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const bottomSections = document.querySelectorAll('.cart-section');
    if (bottomSections.length >= 2) {
        bottomSections[1].innerHTML = `TOTAL <span style="float:right;">R${total.toLocaleString()}</span>`;
    }
};
// Sync on load
document.addEventListener('DOMContentLoaded', saveAndSyncCart);
