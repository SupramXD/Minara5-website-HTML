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

// 4. THE SYNC FUNCTION (Fixed for BAG 00 and Green Icon)
function saveAndSyncCart() {
    localStorage.setItem('minara_cart', JSON.stringify(cart));
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const countStr = totalItems.toString().padStart(2, '0');
    
    // Force update all header and panel counters
    const labelIds = ["cartCountHeader", "cartCountHeaderMobile", "bagCountLabel"];
    labelIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = (id === "bagCountLabel") ? `BAG ${countStr}` : countStr;
    });

    // Update cart icon color
    document.querySelectorAll('.cart-header-btn img, .mobile-cart img').forEach(img => {
        img.src = totalItems > 0 ? "cart_green.svg" : "cart.svg";
    });

    renderCartUI();
}

// Fix #2 & #3: Global scope functions for buttons
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

window.renderCartUI = function() {
    const cartContainer = document.querySelector('.cart-body');
    const asciiContainer = document.querySelector('.cart-ascii');
    if (!cartContainer || !asciiContainer) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Fix #4: High-Fashion Block Unicode
    const minaraArt = `
 M  M  I  N  N  A  RR  A
 MM MM  I  NN N A A R R A A
 M M M  I  N NN AAA RR  AAA
 M   M  I  N  N A A R R A A 5`;

    const emptyArt = `
 EEEE M  M PPPP TTT Y  Y
 E    MM MM P  P  T   Y Y 
 EEE  M M M PPPP  T    Y  
 E    M   M P     T    Y  
 EEEE M   M P     T    Y  `;

    asciiContainer.textContent = totalItems > 0 ? minaraArt : emptyArt;

    let html = '<div style="flex-grow: 1; padding: 0 15px;">';
    
    if (totalItems === 0) {
        html += `<div style="text-align:center; padding:40px 0;">
            ${lastRemovedItem ? `<span style="opacity:0.5; font-size:10px;">REMOVED: ${lastRemovedItem.id}</span>
            <span class="undo-link" onclick="undoRemove()" style="color:#1106e8; margin-left:10px; cursor:pointer; text-decoration:underline; font-weight:bold; font-size:10px;">UNDO</span>` : ''}
        </div>`;
    } else {
        cart.forEach((item, index) => {
            html += `
            <div class="cart-item-row" style="display:flex; gap:15px; border-bottom:1px solid #000; padding:20px 0;">
                <img src="${item.image}" style="width:80px; height:100px; object-fit:cover;">
                <div style="flex:1;">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-meta">COLOUR: ORIGINAL / O/S</div>
                    <div style="font-size:11px;">R${item.price.toLocaleString()}</div>
                    <div class="qty-stepper">
                        <div class="qty-btn" onclick="changeQty(${index}, -1)">–</div>
                        <div class="qty-val">${item.quantity}</div>
                        <div class="qty-btn" onclick="changeQty(${index}, 1)">+</div>
                    </div>
                    <div onclick="removeFromCart(${index})" class="cart-remove-link">✕ REMOVE</div>
                </div>
            </div>`;
        });
    }
    html += '</div>';

    // Fix #5, #6, #7: Dynamic Footer Logic
    const hasItems = totalItems > 0;
    const footerHtml = `
        <div class="cart-footer-wrap" style="margin-top:auto;">
            ${hasItems ? `<button class="checkout-btn">CHECKOUT</button>` : ''}
            <div class="shipping-total-box" style="height: ${hasItems ? '80px' : '60px'};">
                <div class="box-row"><span>SHIPPING</span><span>FREE</span></div>
                ${!hasItems ? `<div class="box-row"><span>TOTAL</span><span>R0</span></div>` : ''}
            </div>
            <div class="payment-section">
                <div class="box-row">
                    <span>${hasItems ? 'TOTAL' : 'PAYMENT'}</span>
                    ${hasItems ? `<span>R${totalPrice.toLocaleString()}</span>` : ''}
                </div>
                <div class="payment-icons" style="margin-top:15px; display:flex; gap:8px; opacity:0.6;">
                    <div style="width:30px; height:18px; background:#ccc;"></div>
                    <div style="width:30px; height:18px; background:#ccc;"></div>
                </div>
            </div>
        </div>`;

    cartContainer.innerHTML = `<div style="display:flex; flex-direction:column; min-height:100%;">${html}${footerHtml}</div>`;
};
