let lastRemovedItem = null;
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    sendPasswordResetEmail, 
    sendEmailVerification,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
    initializeFirestore, 
    setLogLevel,
    collection, 
    addDoc,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC8srbzH_DcCYQJXe9MNOyy2OHZSaLidIo",
    authDomain: "minara5.firebaseapp.com",
    projectId: "minara5",
    storageBucket: "minara5.firebasestorage.app",
    messagingSenderId: "860405871052",
    appId: "1:860405871052:web:2aead90773c24721f72d69"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const isLocalFile = window.location.protocol === "file:";
const db = initializeFirestore(app, isLocalFile ? {
    experimentalForceLongPolling: true
} : {});
try {
    setLogLevel('debug');
    console.log("Firestore verbose debug logging enabled.");
} catch (e) {
    console.warn("Failed to set Firestore debug log level:", e);
}
window.auth = auth; // Keeps it accessible for your account.html
window.db = db;     // Expose globally for newsletter submissions
let currentUser = null;

// --- MASTER TRIGGERS (Fixes "Nothing Happening") ---

window.login = function() {
    const email = prompt("Enter your email address:");
    if (email === null) {
        console.log("Login cancelled.");
        return;
    }
    const cleanEmail = email.trim();
    if (!cleanEmail) {
        alert("Email cannot be empty.");
        return;
    }
    const password = prompt("Enter your password:");
    if (password === null) {
        console.log("Login cancelled.");
        return;
    }
    
    console.log("Attempting sign in for " + cleanEmail + "...");
    signInWithEmailAndPassword(auth, cleanEmail, password)
        .then((userCredential) => {
            console.log("Login successful! Welcome " + userCredential.user.email);
            alert("Login successful!");
            window.location.reload();
        })
        .catch(err => {
            console.error("Login failed:", err.message);
            alert("Login failed: " + err.message);
        });
};

window.register = function() {
    const email = prompt("Enter email address to register:");
    if (email === null) {
        console.log("Registration cancelled.");
        return;
    }
    const cleanEmail = email.trim();
    if (!cleanEmail) {
        alert("Email cannot be empty.");
        return;
    }
    const password = prompt("Enter password to register:");
    if (password === null) {
        console.log("Registration cancelled.");
        return;
    }
    
    console.log("Attempting registration for " + cleanEmail + "...");
    createUserWithEmailAndPassword(auth, cleanEmail, password)
        .then((userCredential) => {
            console.log("Registration successful! Welcome " + userCredential.user.email);
            sendEmailVerification(userCredential.user);
            alert("Registration successful! A verification email has been sent.");
            window.location.reload();
        })
        .catch(err => {
            console.error("Registration failed:", err.message);
            alert("Registration failed: " + err.message);
        });
};

window.processLogin = function(email, password) {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
        alert("Email cannot be empty.");
        return;
    }
    console.log("Attempting sign in for " + cleanEmail + "...");
    signInWithEmailAndPassword(auth, cleanEmail, password)
        .then((userCredential) => {
            console.log("Login successful! Welcome " + userCredential.user.email);
            alert("Login successful!");
            window.location.reload();
        })
        .catch(err => {
            console.error("Login failed:", err.message);
            alert("Login failed: " + err.message);
        });
};

window.processRegister = function(email, password) {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
        alert("Email cannot be empty.");
        return;
    }
    console.log("Attempting registration for " + cleanEmail + "...");
    createUserWithEmailAndPassword(auth, cleanEmail, password)
        .then((userCredential) => {
            console.log("Registration successful! Welcome " + userCredential.user.email);
            sendEmailVerification(userCredential.user);
            alert("Registration successful! A verification email has been sent.");
            window.location.reload();
        })
        .catch(err => {
            console.error("Registration failed:", err.message);
            alert("Registration failed: " + err.message);
        });
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
function protectRoutes(user) {
    const path = window.location.pathname;
    const adminEmail = "sub2meboyi@gmail.com";
    
    if (path.includes("admin.html")) {
        if (!user || user.email !== adminEmail) {
            window.location.href = "index.html";
            return true;
        }
    }
    
    if (!user) {
        if (path.includes("account.html") || path.includes("register.html")) {
            window.location.href = "index.html";
            return true;
        }
    }
    return false;
}

function updateAdminHeaderButton(user) {
    const adminEmails = ["sub2meboyi@gmail.com"];
    const isAdmin = user && adminEmails.includes(user.email);
    
    // 1. Desktop header button injection
    const headerUl = document.querySelector("header nav ul, header .header-right ul, header ul");
    let adminLi = document.getElementById("adminHeaderLi");
    
    if (isAdmin) {
        if (headerUl && !adminLi) {
            adminLi = document.createElement("li");
            adminLi.id = "adminHeaderLi";
            adminLi.style.display = "flex";
            adminLi.style.alignItems = "center";
            adminLi.style.marginLeft = "20px";
            
            adminLi.innerHTML = `
                <a href="admin.html" id="adminHeaderBtn" style="
                    background: #ccff00 !important;
                    color: #000 !important;
                    border: 1px solid #000 !important;
                    padding: 8px 16px !important;
                    font-family: 'Gotham Narrow Bold', sans-serif !important;
                    font-size: 11px !important;
                    letter-spacing: 1.5px !important;
                    text-transform: uppercase !important;
                    text-decoration: none !important;
                    font-weight: bold !important;
                    display: inline-block !important;
                    transition: all 0.2s ease !important;
                    cursor: pointer !important;
                ">ADMIN PANEL</a>
            `;
            
            const accountLi = headerUl.querySelector(".header-account");
            if (accountLi) {
                headerUl.insertBefore(adminLi, accountLi);
            } else {
                headerUl.appendChild(adminLi);
            }
            
            const btn = adminLi.querySelector("#adminHeaderBtn");
            if (btn) {
                btn.addEventListener("mouseenter", () => { btn.style.opacity = "0.8"; });
                btn.addEventListener("mouseleave", () => { btn.style.opacity = "1"; });
            }
        }
    } else {
        if (adminLi) {
            adminLi.remove();
        }
    }

    // 2. Mobile menu button injection
    const menuPanel = document.getElementById("menuPanel");
    let mobileAdminBtn = document.getElementById("mobileAdminPanelBtn");
    
    if (isAdmin) {
        if (menuPanel && !mobileAdminBtn) {
            mobileAdminBtn = document.createElement("a");
            mobileAdminBtn.id = "mobileAdminPanelBtn";
            mobileAdminBtn.href = "admin.html";
            mobileAdminBtn.textContent = "ADMIN PANEL";
            mobileAdminBtn.style.cssText = `
                display: block;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.28em;
                margin: 26px 0;
                color: #000;
                font-weight: bold;
                background: #ccff00;
                border: 1px solid #000;
                padding: 12px;
                text-align: center;
                text-decoration: none;
            `;
            
            const mobileAccBlock = document.getElementById("mobileAccountBlock");
            if (mobileAccBlock) {
                menuPanel.insertBefore(mobileAdminBtn, mobileAccBlock);
            } else {
                menuPanel.appendChild(mobileAdminBtn);
            }
        }
    } else {
        if (mobileAdminBtn) {
            mobileAdminBtn.remove();
        }
    }
}

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    
    if (protectRoutes(user)) return;
    
    const headerAccs = document.querySelectorAll(".header-account");
    headerAccs.forEach(el => {
        el.style.display = user ? "block" : "none";
    });

    const label = document.getElementById("accountLabel");
    const accName = document.getElementById("accName");

    if (user) {
        let email = user.email;
        if (label) label.textContent = email.length > 12 ? email.substring(0, 12) + "..." : email;
        if (accName) accName.textContent = user.email;
        
        // Auto-sync user metadata to Firestore users collection
        setTimeout(async () => {
            if (window.db) {
                try {
                    const userDocRef = doc(window.db, "users", user.uid);
                    const userSnap = await getDoc(userDocRef);
                    if (!userSnap.exists()) {
                        await setDoc(userDocRef, {
                            email: user.email,
                            role: user.email === "sub2meboyi@gmail.com" ? "Admin" : "Customer",
                            status: "Active",
                            timestamp: new Date().toISOString()
                        });
                        console.log("Automatically synchronized user registration metadata with Firestore.");
                    }
                } catch (e) {
                    console.warn("Failed to auto-sync user registration profile to Firestore:", e);
                }
            }
        }, 0);
    } else {
        if (label) label.textContent = "Account";
        if (accName) accName.textContent = "ACCOUNT";
    }
    setupMobileAccount(user);
    updateAdminHeaderButton(user);
});

/* ===============================
   MOBILE ACCOUNT LOGIC (Preserved)
================================ */
function setupMobileAccount(user) {
    const myAcc = document.getElementById("mobileMyAccount");
    const drop = document.getElementById("mobileAccountDropdown");
    const logoutBtn = document.getElementById("mobileLogout");
    const mobileAccBlock = document.getElementById("mobileAccountBlock");
    if (!myAcc || !drop || !logoutBtn) return;

    if (!user) {
        if (mobileAccBlock) mobileAccBlock.style.display = "none";
        myAcc.style.display = "none";
        drop.style.display = "none";
        logoutBtn.style.display = "none";
        return;
    }

    if (mobileAccBlock) mobileAccBlock.style.display = "block";
    myAcc.style.display = "block";

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
    let product = null;
    
    // 1. Check custom local storage products first to pick up any admin edits (name, price, image)
    try {
        const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
        const found = localProds.find(p => p.id === productId);
        if (found) {
            product = {
                id: found.id,
                name: found.name,
                price: found.price,
                image: found.image.split(',')[0].trim()
            };
        }
    } catch (e) {
        console.error("Local storage lookup failed in addToCart:", e);
    }
    
    // 2. Check our hardcoded products map if not customized/edited
    if (!product) {
        product = products[productId];
    }
    

    
    if (!product) {
        console.warn("Product not found for addToCart:", productId);
        return;
    }

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

    // Update cart icon color across all layouts (Desktop + Mobile)
    const icons = document.querySelectorAll('.cart-header-btn img, .cart-btn img, .mobile-cart img, .cart-btn.mobile-cart img');
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
================================ */window.renderCartUI = function() {
    const cartContainer = document.querySelector('.cart-body');
    const asciiWrap = document.querySelector('.cart-ascii-wrap');
    const asciiContainer = document.querySelector('.cart-ascii');
    if (!cartContainer || !asciiContainer) return;

    // Ensure the cart body has zero padding and correct flex column layout so footer touches the edges perfectly
    cartContainer.style.setProperty('padding', '0', 'important');
    cartContainer.style.setProperty('display', 'flex', 'important');
    cartContainer.style.setProperty('flex-direction', 'column', 'important');
    cartContainer.style.setProperty('flex-grow', '1', 'important');
    cartContainer.style.setProperty('overflow', 'hidden', 'important');

    // Hide the static placeholder cart-bottom footer to prevent double footer and let dynamic footer take its place
    const staticBottom = document.querySelector('.cart-bottom');
    if (staticBottom) {
        staticBottom.style.setProperty('display', 'none', 'important');
    }

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const hasItems = totalItems > 0;
    const isLoggedIn = !!currentUser;

    // YOUR EXACT ASCII ART
const minaraArt = `
 __  __   ___   _   _     _      ____      _     
|  \\/  | |_ _| | \\ | |   / \\    |  _ \\    / \\    
| |\\/| |  | |  |  \\| |  / _ \\   | |_) |  / _ \\   
| |  | |  | |  | |\\  | / ___ \\  |  _ <  / ___ \\  
|_|  |_| |___| |_| \\_|/_/   \\_\\ |_| \\_\\/_/   \\_\\ 
                                                 
                                                 `;

    // #2: EMPTY ASCII Art with 2 spaces under it and fixed 'Y'
    const emptyArt = `
 _____   __  __   ____    _____  __   __
| ____| |  \\/  | |  _ \\  |_   _| \\ \\ / /
|  _|   | |\\/| | | |_) |   | |    \\ V / 
| |___  | |  | | |  __/    | |     | |  
|_____| |_|  |_| |_|       |_|     |_| 
                                         
                                         `;

    asciiContainer.textContent = hasItems ? minaraArt : emptyArt;

    // #2: REMOVE LEFT BORDER
    asciiWrap.style.borderLeft = "none";         
    asciiWrap.style.display = "flex";
    asciiWrap.style.alignItems = "center";       
    asciiWrap.style.justifyContent = "flex-start"; 
    asciiWrap.style.padding = "0 25px";
    asciiWrap.style.minHeight = "90px";          
    asciiContainer.style.fontSize = "9px";
    asciiContainer.style.lineHeight = "1.1";
    asciiContainer.style.whiteSpace = "pre";

    let html = '<div style="display:flex; flex-direction:column; height:100%; flex-grow:1; overflow:hidden;">';

    if (hasItems) {
        html += '<div class="items-area" style="flex-grow:1; overflow-y:auto;">';
        cart.forEach((item, index) => {
            const hasDiscount = localStorage.getItem("minara_discount_5") === "active";
            const itemPrice = item.price;
            const displayPrice = hasDiscount 
                ? `<span style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R${itemPrice.toLocaleString()}</span><span style="color: #1106e8; font-weight: bold;">R${Math.round(itemPrice * 0.95).toLocaleString()}</span>` 
                : `R${itemPrice.toLocaleString()}`;

            html += `
            <div class="cart-item-row" style="display:flex; gap:15px; border-bottom:1px solid #000; padding:20px 15px;">
                <img src="${item.image}" style="width:80px; height:105px; object-fit:cover;">
                <div style="flex:1;">
                    <div style="font-family:'Gotham Narrow Bold', sans-serif; font-size:11px; text-transform:uppercase;">${item.name}</div>
                    <div style="font-size:10px; opacity:0.6; margin-bottom:10px;">COLOUR: ORIGINAL</div>
                    <div style="font-size:11px;">${displayPrice}</div>
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
        html += '<div style="padding:10px 25px; flex-grow:1; display:flex; flex-direction:column; align-items:flex-start;">';
        
        // #1: LOGGED IN TEXT
        if (isLoggedIn) {
            html += `<div style="font-size:10px; color:rgba(0,0,0,0.6); letter-spacing:0.5px; text-transform:uppercase;">ADD ITEMS TO BAG</div>`;
        } else {
            html += `<div style="font-size:10px; color:rgba(0,0,0,0.6); letter-spacing:0.5px; text-transform:uppercase;">ADD ITEMS TO BAG</div>`;
        }

        // #3: UNDO BUTTON UI (Based on reference image)
        if (lastRemovedItem) {
            html += `
            <div style="width:100%; margin-top:30px; border-top:1px solid #eee; padding-top:10px;">
                <div style="font-family:'Gotham Narrow Bold', sans-serif; font-size:11px; text-transform:uppercase; margin-bottom:12px;">${lastRemovedItem.name}</div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid #eee; padding-top:10px;">
                    <span style="color:red; font-size:11px; font-weight:normal; text-transform:uppercase;">REMOVED</span>
                    <span onclick="window.undoRemove()" style="color:#1106e8; font-size:11px; text-decoration:underline; cursor:pointer; font-weight:normal; text-transform:uppercase;">UNDO</span>
                </div>
            </div>`;
        }
        
        html += '</div>';
    }

    // FOOTER (Restored to your previous working version)
    const footBoxHeight = hasItems ? "45px" : "80px"; 
    const paymentBoxHeight = hasItems ? "auto" : "50px"; 
    const paymentPadding = hasItems ? "20px 20px" : "8px 20px"; 

    const hasDiscount = localStorage.getItem("minara_discount_5") === "active";
    let priceDisplay = 'R' + totalPrice.toLocaleString();
    if (hasDiscount) {
        priceDisplay = `<span style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R${totalPrice.toLocaleString()}</span><span style="color: #1106e8; font-weight: bold;">R${Math.round(totalPrice * 0.95).toLocaleString()}</span>`;
    }

    html += `
        <div class="cart-footer-area" style="margin-top:auto; width:100%;">
            <div style="background:#f9f9f9; border-top:1px solid #000; padding:12px 20px; height:${footBoxHeight}; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box;">
                <div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold',sans-serif;">
                    <span>SHIPPING</span><span>FREE</span>
                </div>
                ${!hasItems ? `<div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold',sans-serif;"><span>TOTAL</span><span>R0</span></div>` : ''}
            </div>
            <div class="payment-section" style="background:#f2f2f2; border-top:1px solid #000; padding:${paymentPadding}; height:${paymentBoxHeight}; min-height:${paymentBoxHeight}; border-bottom:1px solid #000; display:flex; flex-direction:column; justify-content:center; box-sizing:border-box; width:100%;">
                <div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold',sans-serif; margin-bottom:${hasItems ? '15px' : '4px'};">
                    <span>${hasItems ? 'TOTAL' : 'PAYMENT'}</span>
                    <span>${hasItems ? priceDisplay : ''}</span>
                </div>
                ${hasItems ? `<button onclick="location.href='checkout.html'" style="width:100%; background:#ccff00; border:1px solid #000; padding:12px; font-family:'Gotham Narrow Bold',sans-serif; font-size:11px; cursor:pointer; font-weight:bold; letter-spacing:1px;">CONTINUE TO CHECKOUT</button>` : ''}
                <div style="display:flex; gap:8px; opacity:0.3; margin-top:${hasItems ? '12px' : '0px'};">
                    <div style="width:25px; height:${hasItems ? '15px' : '10px'}; background:#000;"></div>
                    <div style="width:25px; height:${hasItems ? '15px' : '10px'}; background:#000;"></div>
                </div>
            </div>
        </div>
    </div>`;

    cartContainer.innerHTML = html;
};
// --- UPDATED HELPER FUNCTIONS (REPLACING THE OLD ONES AT THE BOTTOM) ---

window.changeQty = function(index, delta) {
    if (cart[index]) {
        cart[index].quantity += delta;
        if (cart[index].quantity < 1) {
            window.removeFromCart(index); // Calls our new remove function to trigger Undo
        } else {
            saveAndSyncCart();
        }
    }
};

window.removeFromCart = function(index) {
    if (cart[index]) {
        // This line is required for the Undo button to see the item
        lastRemovedItem = { ...cart[index] }; 
        cart.splice(index, 1);
        saveAndSyncCart();
    }
};

window.undoRemove = function() {
    if (lastRemovedItem) {
        cart.push(lastRemovedItem);
        lastRemovedItem = null; // Hide the undo button after use
        saveAndSyncCart();
    }
};

// --- AUTH STATE SYNC ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (protectRoutes(user)) return;
    
    setupMobileAccount(user);
    updateAdminHeaderButton(user);
    renderCartUI(); 
});

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    saveAndSyncCart();

    const panel = document.getElementById('cartPanel');
    const dimmer = document.getElementById('pageDimmer');
    
    if (dimmer) {
        dimmer.addEventListener('click', () => {
            if (panel) panel.classList.remove('open');
            dimmer.classList.remove('active');
            window.closeAccDropdown();
            document.body.style.overflow = ''; 
            
            // If dimmer was clicked, pop state if cart was open
            if (history.state && history.state.cartOpen) {
                history.back();
            }
        });
    }
});

/* ===============================
   BACK BUTTON & BFCache FIXES
================================ */

// 1. Fix back/forward cache (when user clicks a link inside menu and then hits back)
window.addEventListener('pageshow', (event) => {
    document.getElementById("menuPanel")?.classList.remove("open");
    document.getElementById("cartPanel")?.classList.remove("open");
    document.getElementById("pageDimmer")?.classList.remove("active");
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
});

// 2. Intercept open/close functions to tie them to browser history
setTimeout(() => {
    const originalOpenMenu = window.openMenu;
    if (typeof originalOpenMenu === 'function') {
        window.openMenu = function() {
            originalOpenMenu();
            history.pushState({ menuOpen: true }, "");
        };
    }

    const originalCloseMenu = window.closeMenu;
    if (typeof originalCloseMenu === 'function') {
        window.closeMenu = function() {
            originalCloseMenu();
            if (history.state && history.state.menuOpen) {
                history.back(); 
            }
        };
    }

    const originalOpenCart = window.openCart;
    if (typeof originalOpenCart === 'function') {
        window.openCart = function() {
            originalOpenCart();
            history.pushState({ cartOpen: true }, "");
        };
    }

    const originalCloseCart = window.closeCart;
    if (typeof originalCloseCart === 'function') {
        window.closeCart = function() {
            originalCloseCart();
            if (history.state && history.state.cartOpen) {
                history.back();
            }
        };
    }
}, 100);

// 3. Handle hardware back button correctly
window.addEventListener('popstate', (event) => {
    if (!event.state || !event.state.menuOpen) {
        const menuPanel = document.getElementById("menuPanel");
        if (menuPanel && menuPanel.classList.contains("open")) {
            menuPanel.classList.remove("open");
        }
    }
    
    if (!event.state || !event.state.cartOpen) {
        const cartPanel = document.getElementById("cartPanel");
        const dimmer = document.getElementById("pageDimmer");
        if (cartPanel && cartPanel.classList.contains("open")) {
            cartPanel.classList.remove("open");
            if (dimmer) dimmer.classList.remove("active");
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }
    }
});

/* ===============================
   QUALITY OF LIFE (QoL) IMPROVEMENTS
================================ */

// 1. "ADDED TO BAG" Feedback
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-to-cart-btn, .add-to-cart, button[onclick*="addToCart"]');
    if (btn && !btn.disabled && !btn.classList.contains('placeholder-btn')) {
        const originalText = btn.textContent;
        btn.textContent = "ADDED ✓";
        btn.style.backgroundColor = "#4caf50"; 
        btn.style.color = "#fff";
        btn.style.borderColor = "#4caf50";
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = ""; 
            btn.style.color = "";
            btn.style.borderColor = "";
        }, 1500);
    }
});

// 2. Global "Click Outside to Close" & CSS Injections
document.addEventListener('DOMContentLoaded', () => {
    // Inject QoL Global Styles safely
    const style = document.createElement('style');
    style.innerHTML = `
        /* Smooth Scrolling */
        html { scroll-behavior: smooth; }
        
        /* Active Nav Link Styling */
        .active-nav {
            font-weight: bold;
            opacity: 1 !important;
        }
        
        /* Underline effect for active desktop nav */
        .left-nav a.active-nav {
            text-decoration: underline;
            text-underline-offset: 4px;
        }

        /* Hover fix for mobile */
        @media (hover: none) {
            .cart-btn:hover, .account-trigger:hover, .view-more-btn:hover, a:hover, button:hover {
                opacity: inherit;
                background-color: inherit;
                color: inherit;
            }
        }
    `;
    document.head.appendChild(style);

    // Active Navigation Highlighting
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll('.left-nav a, nav ul li a').forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref && linkHref === currentPage) {
            link.classList.add('active-nav');
        }
    });

    // Dimmer enhancement: Make sure mobile account dropdown closes when clicking outside
    document.addEventListener('click', (e) => {
        const mobileAccBlock = document.getElementById("mobileAccountBlock");
        const mobileDrop = document.getElementById("mobileAccountDropdown");
        const myAcc = document.getElementById("mobileMyAccount");
        
        // If the mobile account dropdown exists and is open
        if (mobileDrop && mobileDrop.style.display === "block") {
            // Check if click was outside the account block
            if (!mobileAccBlock.contains(e.target)) {
                mobileDrop.style.display = "none";
                const arrow = myAcc?.querySelector(".mobile-arrow");
                if (arrow) arrow.style.transform = "rotate(0deg)";
            }
        }
    });

    // Setup newsletter and discounts
    setupMobileNewsletter();
    setupDesktopNewsletter();
    window.applyGlobalDiscount();
});

/* ===============================
   NEWSLETTER SUBSCRIPTIONS & 5% DISCOUNT
================================ */

window.submitNewsletter = async function(event, type) {
    if (event) event.preventDefault();
    
    const emailInput = document.getElementById(type === 'mobile' ? 'mobileNewsletterEmail' : 'desktopSignupEmail');
    const email = emailInput ? emailInput.value.trim() : "";
    
    if (!email) return;
    
    console.log("Submitting email to newsletter: " + email);

    // Get form elements for immediate premium visual feedback
    const form = document.getElementById(type === 'mobile' ? 'mobileNewsletterForm' : 'desktopSignupForm');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const originalBtnText = submitBtn ? submitBtn.innerHTML : "SUBMIT";

    // Immediate loading visual state changes
    if (emailInput) emailInput.disabled = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "SAVING...";
        submitBtn.style.opacity = "0.5";
        submitBtn.style.cursor = "not-allowed";
    }
    
    try {
        if (window.db) {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout waiting for Firestore")), 10000)
            );
            await Promise.race([
                addDoc(collection(window.db, "subscribers"), {
                    email: email,
                    timestamp: new Date().toISOString()
                }),
                timeoutPromise
            ]);
            console.log("Newsletter subscription saved to Firebase!");
        } else {
            console.warn("Firestore database reference not available.");
            throw new Error("Firestore not initialized");
        }
    } catch (error) {
        console.error("Firestore write failed, triggering local offline cache fallback. Raw error object:", error);
        console.error("Firestore error code:", error.code);
        
        // Save to offline cache in localStorage so the admin panel can still read it
        try {
            const offlineSubs = JSON.parse(localStorage.getItem("minara_offline_subscribers") || "[]");
            if (!offlineSubs.some(sub => sub.email.toLowerCase() === email.toLowerCase())) {
                offlineSubs.push({
                    email: email,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem("minara_offline_subscribers", JSON.stringify(offlineSubs));
            }
        } catch (storageError) {
            console.error("Failed to save to local storage:", storageError);
        }
    }

    // Activate the discount
    localStorage.setItem("minara_discount_5", "active");

    // Clean inputs and reset button state
    if (emailInput) {
        emailInput.disabled = false;
        emailInput.value = "";
    }
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        submitBtn.style.opacity = "";
        submitBtn.style.cursor = "";
    }

    // Inject fade-in keyframe animations if missing
    if (!document.getElementById('minara-fadein-style')) {
        const style = document.createElement('style');
        style.id = 'minara-fadein-style';
        style.innerHTML = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Show premium styled success alert state with catalog redirection link
    if (type === 'mobile') {
        const formWrap = document.getElementById("mobileNewsletterFormWrap");
        const successEl = document.getElementById("mobileNewsletterSuccess");
        const promoText = document.querySelector("#mobileNewsletterPromo span");
        if (formWrap) formWrap.style.display = "none";
        if (successEl) {
            successEl.innerHTML = `
                <div style="margin-top: 14px; padding: 16px; background: rgba(52, 199, 89, 0.06); border: 1px solid #34c759; border-radius: 2px; animation: fadeIn 0.4s ease;">
                    <div style="color: #34c759; font-size: 11px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase;">✓ DISCOUNT ACTIVATED</div>
                    <div style="color: #000; font-size: 10px; margin-top: 6px; letter-spacing: 0.5px; opacity: 0.8; text-transform: uppercase; font-family: inherit; line-height: 1.4;">You've unlocked 5% off your first order! Your discount has been applied to your bag.</div>
                    <a href="catalog.html" style="display: inline-block; margin-top: 12px; background: #000; color: #ccff00; font-size: 9px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; padding: 9px 18px; text-decoration: none; border: 1px solid #000;">SHOP THE CATALOG →</a>
                </div>
            `;
            successEl.style.display = "block";
        }
        if (promoText) promoText.textContent = "5% DISCOUNT ACTIVE";
    } else {
        const form = document.getElementById("desktopSignupForm");
        const successEl = document.getElementById("desktopSignupSuccess");
        if (form) form.style.display = "none";
        if (successEl) {
            successEl.innerHTML = `
                <div style="margin-top: 18px; padding: 22px; background: rgba(52, 199, 89, 0.06); border: 1px solid #34c759; border-radius: 2px; animation: fadeIn 0.4s ease;">
                    <div style="color: #34c759; font-family: 'Gotham Narrow Bold', sans-serif; font-size: 13px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">✓ DISCOUNT ACTIVATED: 5% OFF FIRST ORDER</div>
                    <div style="color: #000; font-size: 11px; margin-top: 6px; opacity: 0.8; letter-spacing: 0.5px; text-transform: uppercase; font-family: inherit; line-height: 1.5;">You've unlocked 5% off your first order! Your discount has been successfully applied to your bag. Use the button below to explore our exclusive collection.</div>
                    <a href="catalog.html" style="display: inline-block; margin-top: 16px; background: #000; color: #ccff00; font-family: 'Gotham Narrow Bold', sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; padding: 12px 24px; text-decoration: none; border: 1px solid #000; transition: all 0.2s ease; cursor: pointer;">EXPLORE THE CATALOG →</a>
                </div>
            `;
            successEl.style.display = "block";
        }
    }
    
    window.applyGlobalDiscount();
    
    if (typeof renderCartUI === 'function') {
        renderCartUI();
    }
};

window.applyGlobalDiscount = function() {
    const hasDiscount = localStorage.getItem("minara_discount_5") === "active";
    if (!hasDiscount) return;
    
    // 1. Homepage product cards
    const hpPrices = document.querySelectorAll(".hp-price");
    hpPrices.forEach(el => {
        if (el.textContent.includes("R749") && !el.querySelector(".old-price")) {
            el.innerHTML = `<span class="old-price" style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R749</span><span style="color: #1106e8; font-weight: bold;">R712</span>`;
        }
    });
    
    // 2. Catalog page product cards
    const catPrices = document.querySelectorAll(".price");
    catPrices.forEach(el => {
        if (el.textContent.includes("R749") && !el.querySelector(".old-price")) {
            el.innerHTML = `<span class="old-price" style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R749</span><span style="color: #1106e8; font-weight: bold;">R712</span>`;
        }
    });
    
    // 3. Product detail pages
    const productPrices = document.querySelectorAll(".product-price");
    productPrices.forEach(el => {
        if (el.textContent.includes("R749") && !el.querySelector(".old-price")) {
            el.innerHTML = `<span class="old-price" style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R749</span><span style="color: #1106e8; font-weight: bold;">R712</span>`;
        }
    });
};

function setupMobileNewsletter() {
    const menuPanel = document.getElementById("menuPanel");
    if (!menuPanel) return;
    
    let mobileNews = document.getElementById("mobileNewsletterBlock");
    if (!mobileNews) {
        mobileNews = document.createElement("div");
        mobileNews.id = "mobileNewsletterBlock";
        mobileNews.style.cssText = `
            margin-top: 30px;
            border-top: 1px solid #eee;
            padding-top: 20px;
        `;
        
        mobileNews.innerHTML = `
            <div id="mobileNewsletterPromo" style="font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                <span>SIGN UP FOR 5% OFF</span>
                <span id="mobileNewsletterArrow" style="transition: transform 0.25s ease;">▸</span>
            </div>
            <div id="mobileNewsletterFormWrap" style="display: none; margin-top: 15px;">
                <p style="font-size: 10px; opacity: 0.6; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">Get 5% off your first order by subscribing.</p>
                <form id="mobileNewsletterForm" style="display: flex; border-bottom: 1px solid #000; padding-bottom: 5px;">
                    <input type="email" id="mobileNewsletterEmail" placeholder="Enter your email" required style="border: none; background: transparent; font-size: 11px; width: 100%; outline: none; text-transform: none; font-family: inherit;">
                    <button type="submit" style="background: transparent; border: none; font-size: 11px; font-weight: bold; color: #1106e8; cursor: pointer; padding: 0 5px; width: auto; margin: 0; font-family: inherit;">SUBMIT</button>
                </form>
            </div>
            <div id="mobileNewsletterSuccess" style="display: none;"></div>
        `;
        
        menuPanel.appendChild(mobileNews);
        
        const promo = mobileNews.querySelector("#mobileNewsletterPromo");
        const formWrap = mobileNews.querySelector("#mobileNewsletterFormWrap");
        const arrow = mobileNews.querySelector("#mobileNewsletterArrow");
        
        promo.onclick = () => {
            const isHidden = formWrap.style.display === "none";
            formWrap.style.display = isHidden ? "block" : "none";
            arrow.style.transform = isHidden ? "rotate(90deg)" : "rotate(0deg)";
        };
        
        const form = mobileNews.querySelector("#mobileNewsletterForm");
        form.onsubmit = (e) => {
            window.submitNewsletter(e, 'mobile');
        };
    }
    
    const hasDiscount = localStorage.getItem("minara_discount_5") === "active";
    if (hasDiscount) {
        const formWrap = document.getElementById("mobileNewsletterFormWrap");
        const successEl = document.getElementById("mobileNewsletterSuccess");
        if (formWrap) formWrap.style.display = "none";
        if (successEl) successEl.style.display = "block";
        const promoText = document.querySelector("#mobileNewsletterPromo span");
        if (promoText) promoText.textContent = "5% DISCOUNT ACTIVE";
    }
}

function setupDesktopNewsletter() {
    const hasDiscount = localStorage.getItem("minara_discount_5") === "active";
    if (hasDiscount) {
        const form = document.getElementById("desktopSignupForm");
        const successEl = document.getElementById("desktopSignupSuccess");
        if (form) form.style.display = "none";
        if (successEl) successEl.style.display = "block";
    }
}