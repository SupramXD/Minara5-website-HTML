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
    
    // Update all number labels including the panel's "BAG 00"
    const idsToUpdate = ["cartCountHeader", "cartCountHeaderMobile", "cartCountPanel"];
    idsToUpdate.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = countStr;
    });

    // SPECIFIC FIX: Update the "BAG 00" label in the cart panel
    const bagLabel = document.getElementById('bagCountLabel');
    if (bagLabel) {
        bagLabel.textContent = `BAG ${countStr}`;
    }

    // DYNAMIC ICON: Switch to cart_green.svg if items > 0
    const cartIcons = document.querySelectorAll('.cart-header-btn img, .mobile-cart img');
    cartIcons.forEach(img => {
        img.src = totalItems > 0 ? "cart_green.svg" : "cart.svg";
    });

    renderCartUI();
}

// 5. RENDER UI FUNCTION
let lastRemovedItem = null;

// #8 Fix: Ensure cart is actually synced on every render
window.renderCartUI = function() {
    const cartContainer = document.querySelector('.cart-body');
    const asciiContainer = document.querySelector('.cart-ascii');
    const bagLabel = document.getElementById('bagCountLabel');
    
    // #1 Replace current bottom sections
    const bottomSections = document.querySelectorAll('.cart-section');
    bottomSections.forEach(sec => sec.style.display = 'none'); 

    if (!cartContainer || !asciiContainer) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // #2 Change Label to MINARA⑤
    if (bagLabel) bagLabel.textContent = `MINARA⑤ ${totalItems.toString().padStart(2, '0')}`;

    // #12 Remove "Your cart is empty" text, use only Unicode
    if (cart.length === 0) {
        asciiContainer.textContent = ` _____   __  __   ____    _____  __   __\n| ____| |  \\/  | |  _ \\  |_   _| \\ \\ / /\n|  _|   | |\\/| | | |_) |   | |    \\ V / \n| |___  | |  | | |  __/    | |     | |  \n|_____| |_|  |_| |_|       |_|     |_|  `;
        
        let emptyHtml = '';
        // #10 & #11 Undo Section Logic
        if (lastRemovedItem) {
            emptyHtml = `
                <div style="text-align:center; padding:20px; font-size:10px; letter-spacing:1px;">
                    <span class="removed-status">REMOVED: ${lastRemovedItem.id}</span>
                    <span style="margin: 0 10px;">|</span>
                    <span class="undo-link" onclick="undoRemove()">UNDO</span>
                </div>`;
        }
        cartContainer.innerHTML = emptyHtml;
        return;
    }

    // Header when cart has items
    asciiContainer.textContent = ` ____       _       ____ \n| __ )     / \\     / ___|\n|  _ \\    / _ \\   | |  _ \n| |_) |  / ___ \\  | |_| |\n|____/  /_/   \\_\\  \\____|`;

    let itemHtml = '<div style="padding: 0 15px;">';
    cart.forEach((item, index) => {
        itemHtml += `
            <div class="cart-item-row" style="display: flex; gap: 15px; align-items: flex-start; padding: 20px 0;">
                <img src="${item.image}" class="cart-item-img" style="width: 90px; height: 120px; object-fit: cover;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <div style="font-family:'Gotham Narrow Bold', sans-serif; font-size:11px; text-transform:uppercase; letter-spacing:1px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 8px;">${item.name}</div>
                    <div style="font-size:10px; opacity:0.6; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:10px;">COLOUR: ORIGINAL<br>ONE SIZE</div>
                    <div style="font-size:11px; letter-spacing:1px; margin-bottom:12px;">R${item.price.toLocaleString()}</div>
                    
                    <div class="qty-stepper" style="display: flex; align-items: center; border: 1px solid #000; width: fit-content;">
                        <div class="qty-btn" onclick="changeQty(${index}, -1)" style="width:25px; height:25px; display:flex; align-items:center; justify-content:center; cursor:pointer;">–</div>
                        <div class="qty-val" style="width:30px; text-align:center; font-size:11px; border-left:1px solid #000; border-right:1px solid #000;">${item.quantity}</div>
                        <div class="qty-btn" onclick="changeQty(${index}, 1)" style="width:25px; height:25px; display:flex; align-items:center; justify-content:center; cursor:pointer;">+</div>
                    </div>
                    
                    <span class="cart-remove-link" onclick="removeFromCart(${index})" style="font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:#1106e8 !important; cursor:pointer; margin-top:15px; font-weight:bold;">✕ REMOVE</span>
                </div>
            </div>`;
    });
    itemHtml += '</div>';

    // #4 & #5 Tiered Boxes
    const footerHtml = `
        <div class="shipping-total-box">
            <div class="box-row"><span>SHIPPING</span><span>FREE</span></div>
            <div class="box-row"><span>TOTAL</span><span>R${totalPrice.toLocaleString()}</span></div>
        </div>
        <div class="payment-section">
            PAYMENT
            <div style="margin-top:20px; display:flex; gap:10px; opacity:0.8;">
                <div style="width:30px; height:20px; background:#ddd;"></div>
                <div style="width:30px; height:20px; background:#ddd;"></div>
            </div>
        </div>`;

    cartContainer.innerHTML = itemHtml + footerHtml;
};

// #10 & #11 Modified Remove/Undo Functions
window.removeFromCart = function(index) {
    lastRemovedItem = { ...cart[index] }; 
    cart.splice(index, 1);
    saveAndSyncCart();
};

window.undoRemove = function() {
    if (lastRemovedItem) {
        cart.push(lastRemovedItem);
        lastRemovedItem = null;
        saveAndSyncCart();
    }
};
