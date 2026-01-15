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

/* ===============================
   CART WITH ID SYSTEM (REPAIRED)
================================ */

// 1. PRODUCT DATA
const products = {
    "leopard-backpack": {
        id: "leopard-backpack",
        name: "Léopard Fur Backpack",
        price: 749, 
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
    
    // Auto-open panel (Function exists in leopard.html)
    if (typeof openCart === "function") {
        openCart();
    }
};

/* ===============================
   REPAIRED CART LOGIC
================================ */

// Fix #2 & #3: Ensure these are at the top level so they are found by the HTML
window.changeQty = function(index, delta) {
    if (cart[index]) {
        cart[index].quantity += delta;
        if (cart[index].quantity < 1) cart.splice(index, 1);
        saveAndSyncCart();
    }
};

window.removeFromCart = function(index) {
    lastRemovedItem = { ...cart[index] };
    cart.splice(index, 1);
    saveAndSyncCart();
};

function saveAndSyncCart() {
    localStorage.setItem('minara_cart', JSON.stringify(cart));
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const countStr = totalItems.toString().padStart(2, '0');
    
    // Fix: Sync all labels across the site
    const labels = ["cartCountHeader", "cartCountHeaderMobile", "bagCountLabel"];
    labels.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = (id === "bagCountLabel") ? `BAG ${countStr}` : countStr;
    });

    renderCartUI();
}

window.renderCartUI = function() {
    const cartContainer = document.querySelector('.cart-body');
    const asciiContainer = document.querySelector('.cart-ascii');
    if (!cartContainer || !asciiContainer) return;

    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // #5 & #6 New ASCII Art
    const minaraArt = `
                         __  __ ___ _   _    _    ____      _    ____  
|  \\/  |_ _| \\ | |  / \\  |  _ \\    / \\  | ___| 
| |\\/| || ||  \\| | / _ \\ | |_) |  / _ \\ |___ \\ 
| |  | || || |\\  |/ ___ \\|  _ <  / ___ \\ ___) |
|_|  |_|___|_| \\_/_/   \\_\\_| \\_\\/_/   \\_\\____/ `;

    const emptyArt = `
 _____ __  __ ____ _______   __
| ____|  \\/  |  _ \\_   _\\ \\ / /
|  _| | |\\/| | |_) || |  \\ V / 
| |___| |  | |  __/ | |   | |  
|_____|_|  |_|_|    |_|   |_|  `;

    asciiContainer.textContent = cart.length > 0 ? minaraArt : emptyArt;

    // Item List
    let itemHtml = '<div style="flex-grow: 1; padding: 0 15px;">';
    cart.forEach((item, index) => {
        itemHtml += `
            <div class="cart-item-row" style="display:flex; gap:15px; border-bottom:1px solid #000; padding:20px 0;">
                <img src="${item.image}" style="width:90px; height:120px; object-fit:cover;">
                <div style="flex:1;">
                    <div style="font-family:'Gotham Narrow Bold', sans-serif; font-size:11px; text-transform:uppercase;">${item.name}</div>
                    <div style="font-size:10px; opacity:0.6; margin-bottom:10px;">COLOUR: ORIGINAL<br>ONE SIZE</div> <div style="font-size:11px;">R${item.price.toLocaleString()}</div>
                    <div class="qty-stepper" style="display:flex; border:1px solid #000; width:fit-content; margin-top:10px;">
                        <div class="qty-btn" onclick="changeQty(${index}, -1)" style="width:25px; height:25px; cursor:pointer; display:flex; justify-content:center; align-items:center;">–</div>
                        <div class="qty-val" style="width:30px; text-align:center; border-left:1px solid #000; border-right:1px solid #000;">${item.quantity}</div>
                        <div class="qty-btn" onclick="changeQty(${index}, 1)" style="width:25px; height:25px; cursor:pointer; display:flex; justify-content:center; align-items:center;">+</div>
                    </div>
                    <span onclick="removeFromCart(${index})" style="font-size:9px; color:#1106e8; cursor:pointer; margin-top:15px; font-weight:bold; text-transform:uppercase; text-decoration:underline; display:block;">✕ REMOVE</span>
                </div>
            </div>`;
    });
    itemHtml += '</div>';

    // #1 Restore old shipping/total boxes to the bottom
    const footerHtml = `
        <div style="margin-top: auto;">
            <div class="cart-section" style="background:#f9f9f9; padding:20px; display:flex; flex-direction:column; gap:10px; border-top:1px solid #000;">
                <div style="display:flex; justify-content:space-between; font-size:11px;"><span>SHIPPING</span><span>FREE</span></div>
                <div style="display:flex; justify-content:space-between; font-size:11px;"><span>TOTAL</span><span>R${totalPrice.toLocaleString()}</span></div>
            </div>
            <div class="cart-section" style="background:#f2f2f2; border-top:1px solid #000; padding:20px 20px 40px 20px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:bold; margin-bottom:15px;">
                    <span>PAYMENT</span>
                    <span>R${totalPrice.toLocaleString()}</span>
                </div>
                <div style="display:flex; gap:10px; opacity:0.5;">[PAYMENT IMAGES]</div>
            </div>
        </div>`;

    cartContainer.innerHTML = `<div style="display:flex; flex-direction:column; min-height:100%;">${itemHtml}${footerHtml}</div>`;
};
