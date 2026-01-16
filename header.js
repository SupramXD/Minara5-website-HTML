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
// Fix #2: Forces all labels and icons to sync with the actual data
function saveAndSyncCart() {
    localStorage.setItem('minara_cart', JSON.stringify(cart));
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const countStr = totalItems.toString().padStart(2, '0');
    
    // Update every possible counter in the site
    const ids = ["cartCountHeader", "cartCountHeaderMobile", "bagCountLabel"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = (id === "bagCountLabel") ? `BAG ${countStr}` : countStr;
        }
    });

    // Update cart icon color
    const icons = document.querySelectorAll('.cart-header-btn img, .mobile-cart img');
    icons.forEach(img => { img.src = totalItems > 0 ? "cart_green.svg" : "cart.svg"; });

    renderCartUI();
}

// Fix #3: Explicitly bind to window so HTML 'onclick' can find it
window.removeFromCart = function(index) {
    lastRemovedItem = { ...cart[index] };
    cart.splice(index, 1);
    saveAndSyncCart();
};

/* ===============================
   CART UI & BUTTON FIXES
================================ */

window.renderCartUI = function() {
    const cartContainer = document.querySelector('.cart-body');
    const asciiWrap = document.querySelector('.cart-ascii-wrap');
    const asciiContainer = document.querySelector('.cart-ascii');
    if (!cartContainer || !asciiContainer) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const hasItems = totalItems > 0;
    const isLoggedIn = !!currentUser;

    // Fixed MINARA 5 Art (Double backslashes preserved for JS)
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
|_____|_|  |_|_|    |_|   |_| `;

    asciiContainer.textContent = hasItems ? minaraArt : emptyArt;

    // #2 VERTICAL CENTERING FIX
    asciiWrap.style.display = "flex";          // Fixed from "row" to "flex"
    asciiWrap.style.flexDirection = "row";    // Row direction allows for vertical centering
    asciiWrap.style.alignItems = "center";    // This centers the ASCII vertically in the 100px box
    asciiWrap.style.justifyContent = "flex-start"; 
    asciiWrap.style.padding = "0 25px";       // Zero top/bottom padding so centering is mathematical
    asciiWrap.style.minHeight = "100px"; 

    asciiContainer.style.fontSize = "12px";
    asciiContainer.style.lineHeight = "1";    // Trims the font's internal spacing
    asciiContainer.style.margin = "0";

    let html = '<div style="display:flex; flex-direction:column; min-height:100%;">';

    if (hasItems) {
        html += '<div class="items-area" style="flex-grow:1; overflow-y:auto;">';
        cart.forEach((item, index) => {
            html += `
            <div class="cart-item-row" style="display:flex; gap:15px; border-bottom:1px solid #000; padding:20px 15px;">
                <img src="${item.image}" style="width:80px; height:105px; object-fit:cover;">
                <div style="flex:1;">
                    <div style="font-family:'Gotham Narrow Bold', sans-serif; font-size:11px; text-transform:uppercase;">${item.name}</div>
                    <div style="font-size:10px; opacity:0.6; margin-bottom:10px;">COLOUR: ORIGINAL</div>
                    <div style="font-size:11px;">R${item.price.toLocaleString()}</div>
                    <div class="qty-stepper" style="display:flex; border:1px solid #000; width:fit-content; margin-top:10px;">
                        <div class="qty-btn" onclick="window.changeQty(${index}, -1)" style="width:25px; height:25px; cursor:pointer; display:flex; justify-content:center; align-items:center;">–</div>
                        <div class="qty-val" style="width:30px; text-align:center; border-left:1px solid #000; border-right:1px solid #000; font-size:11px; display:flex; align-items:center; justify-content:center;">${item.quantity}</div>
                        <div class="qty-btn" onclick="window.changeQty(${index}, 1)" style="width:25px; height:25px; cursor:pointer; display:flex; justify-content:center; align-items:center;">+</div>
                    </div>
                    <div onclick="window.removeFromCart(${index})" style="font-size:9px; color:#1106e8; cursor:pointer; margin-top:15px; text-decoration:underline; font-weight:bold; text-transform:uppercase;">✕ REMOVE</div>
                </div>
            </div>`;
        });
        html += '</div>';
    } else {
        html += '<div style="padding:40px 25px; flex-grow:1;">';
        if (!isLoggedIn) {
            html += `
            <div style="font-size:10px; color:rgba(0,0,0,0.4); letter-spacing:0.5px; margin-bottom:4px;">Missing items in your cart?</div>
            <div style="font-size:10px; color:rgba(0,0,0,0.4); letter-spacing:0.5px; margin-bottom:18px;">Sign in to see items you added before.</div>
            <div style="display:flex; gap:20px;">
                <a href="account.html" style="font-family:'Gotham Narrow Bold', sans-serif; font-size:11px; color:#1106e8; text-decoration:none;">SIGN IN</a>
                <a href="account.html" style="font-family:'Gotham Narrow Bold', sans-serif; font-size:11px; color:#1106e8; text-decoration:none;">REGISTER</a>
            </div>`;
        }
        html += '</div>';
    }

    // #1 DYNAMIC SHIPPING BOX SIZE
    const footBoxHeight = hasItems ? "45px" : "90px";

    html += `
        <div class="cart-footer-area" style="margin-top:auto;">
            <div style="background:#f9f9f9; border-top:1px solid #000; padding:15px 20px; height:${footBoxHeight}; display:flex; flex-direction:column; justify-content:space-between;">
                <div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold',sans-serif;">
                    <span>SHIPPING</span><span>FREE</span>
                </div>
                ${!hasItems ? `
                <div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold',sans-serif;">
                    <span>TOTAL</span><span>R0</span>
                </div>` : ''}
            </div>

            <div class="payment-section" style="background:#f2f2f2; border-top:1px solid #000; padding:15px 20px 20px 20px; border-bottom:1px solid #000;">
                <div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold',sans-serif; margin-bottom:15px;">
                    <span>${hasItems ? 'TOTAL' : 'PAYMENT'}</span>
                    <span>${hasItems ? 'R' + totalPrice.toLocaleString() : ''}</span>
                </div>
                ${hasItems ? `<button onclick="location.href='checkout.html'" style="width:100%; background:#ccff00; border:1px solid #000; padding:12px; font-family:'Gotham Narrow Bold',sans-serif; font-size:11px; cursor:pointer; letter-spacing:1px; margin-bottom:15px; font-weight:bold;">CONTINUE TO CHECKOUT</button>` : ''}
                
                <div style="display:flex; gap:8px; opacity:0.4;">
                    <div style="width:30px; height:18px; background:#000;"></div>
                    <div style="width:30px; height:18px; background:#000;"></div>
                </div>
            </div>
        </div>
    </div>`;

    cartContainer.innerHTML = html;
};
// #2 & #3 HELPER FUNCTIONS (Attached to window so HTML buttons can see them)
window.changeQty = function(index, delta) {
    if (cart[index]) {
        cart[index].quantity += delta;
        if (cart[index].quantity < 1) {
            cart.splice(index, 1);
        }
        saveAndSyncCart();
    }
};

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    saveAndSyncCart();
};

// --- THIS IS THE BUG FIX LOGIC (UNCHANGED) ---
document.addEventListener('DOMContentLoaded', () => {
    saveAndSyncCart();
    const dimmer = document.getElementById('pageDimmer');
    if (dimmer) {
        dimmer.addEventListener('click', () => {
            const panel = document.getElementById('cartPanel');
            if (panel) panel.classList.remove('open');
            dimmer.classList.remove('active');
            window.closeAccDropdown();
        });
    }
});
