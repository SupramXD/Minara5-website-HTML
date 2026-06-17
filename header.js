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
    collection, 
    addDoc,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- DYNAMICALLY INJECT FADE-IN CSS ---
const style = document.createElement('style');
style.textContent = `
  img:not(.loaded) {
    opacity: 0 !important;
  }
  img.loading-fade {
    transition: opacity 0.45s ease-in-out !important;
  }
`;
document.head.appendChild(style);

const markImageLoaded = (img) => {
    if (img.classList.contains('loaded')) return;
    img.classList.add('loading-fade');
    // Force reflow
    img.offsetWidth;
    img.classList.add('loaded');
    setTimeout(() => {
        img.classList.remove('loading-fade');
    }, 500);
};

// --- GLOBAL IMAGE FADE-IN HANDLER (CAPTURED LOAD EVENT) ---
document.addEventListener('load', (event) => {
    if (event.target && event.target.tagName === 'IMG') {
        markImageLoaded(event.target);
    }
}, true);

// Handle cached/already complete images
const markAllComplete = () => {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        if (img.complete) {
            markImageLoaded(img);
        }
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markAllComplete);
} else {
    markAllComplete();
}
window.addEventListener('load', markAllComplete);

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
// Firestore verbose logging removed for production performance
window.auth = auth; // Keeps it accessible for your account.html
window.db = db;     // Expose globally for newsletter submissions

// --- DYNAMICALLY LOAD CLOUDFLARE TURNSTILE DEFERRED ---
window.addEventListener('load', () => {
    if (!document.getElementById("cloudflare-turnstile-script")) {
        const script = document.createElement("script");
        script.id = "cloudflare-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }
});

// --- PROGRAMMATIC INVISIBLE TURNSTILE CHALLENGE ---
window.runTurnstile = function() {
    return new Promise((resolve) => {
        if (typeof turnstile === 'undefined') {
            console.error("Turnstile not loaded yet.");
            resolve(null);
            return;
        }

        // Create temporary container for Turnstile
        let container = document.getElementById("minara-turnstile-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "minara-turnstile-container";
            container.style.display = "none";
            document.body.appendChild(container);
        }

        container.innerHTML = ""; // Clear previous elements
        const widgetDiv = document.createElement("div");
        container.appendChild(widgetDiv);

        try {
            const widgetId = turnstile.render(widgetDiv, {
                sitekey: "0x4AAAAAADg4x-vWHIwzY7Xu",
                size: "invisible",
                callback: function(token) {
                    resolve(token);
                },
                "error-callback": function(err) {
                    console.error("Turnstile error:", err);
                    resolve(null);
                },
                "expired-callback": function() {
                    console.warn("Turnstile token expired.");
                    resolve(null);
                }
            });
            turnstile.execute(widgetId);
        } catch (e) {
            console.error("Failed to render/execute Turnstile:", e);
            resolve(null);
        }
    });
};
window.getThumbnailImageUrl = function(src, thumbSrc) {
    if (thumbSrc) return thumbSrc;
    if (!src) return "";
    const cleanSrc = src.split(',')[0].trim();
    if (cleanSrc.endsWith("-main.avif")) {
        return cleanSrc.replace("-main.avif", "-thumb.avif");
    }
    return cleanSrc;
};
window.formatPrice = function(value) {
    if (value === undefined || value === null || isNaN(value)) return "0";
    return Math.round(Number(value)).toString();
};
const formatPrice = window.formatPrice;

// Global helper to safely render user input from Firestore and prevent XSS
window.escapeHTML = function(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};
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
let currentUserRole = "Customer";

async function getUserRole(user) {
    if (!user) return "Customer";
    if (window.db) {
        try {
            const userDocRef = doc(window.db, "users", user.uid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                return userSnap.data().role || "Customer";
            } else {
                const defaultRole = user.email === "sub2meboyi@gmail.com" ? "Admin" : "Customer";
                await setDoc(userDocRef, {
                    email: user.email,
                    role: defaultRole,
                    status: "Active",
                    timestamp: new Date().toISOString()
                });
                console.log("Automatically synchronized user registration metadata with Firestore.");
                return defaultRole;
            }
        } catch (e) {
            console.warn("Failed to get/sync user registration profile:", e);
            return user.email === "sub2meboyi@gmail.com" ? "Admin" : "Customer";
        }
    }
    return user.email === "sub2meboyi@gmail.com" ? "Admin" : "Customer";
}

async function protectRoutes(user, role) {
    const path = window.location.pathname;
    
    if (path.includes("admin.html")) {
        if (!user || role !== "Admin") {
            window.location.href = "index.html";
            return true;
        }
    }
    return false;
}

function updateAdminHeaderButton(user, role) {
    const isAdmin = user && role === "Admin";
    
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

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    const role = await getUserRole(user);
    currentUserRole = role;
    
    if (await protectRoutes(user, role)) return;
    
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
    } else {
        if (label) label.textContent = "Account";
        if (accName) accName.textContent = "ACCOUNT";
    }
    setupMobileAccount(user);
    updateAdminHeaderButton(user, role);
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
        window.location.href = "index.html"; // Redirect to home if not authenticated
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
        image: "https://via.placeholder.com/900x1100?text=Leopard+Backpack"
    }
};

// 2. INITIALIZE CART
let cart = JSON.parse(localStorage.getItem('minara_cart')) || [];

// 3. THE ADD FUNCTION
window.addToCart = function(productId, selectedSize) {
    let product = null;
    let sizes = ["50ml", "100ml"];
    
    // 1. Check custom local storage products first to pick up any admin edits (name, price, image)
    try {
        const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
        const found = localProds.find(p => p.id === productId);
        if (found) {
            product = {
                id: found.id,
                name: found.name,
                nameShort: found.nameShort || found.name || "",
                price: found.price,
                image: found.image.split(',')[0].trim(),
                image_thumb: found.image_thumb || ""
            };
            if (found.sizes) {
                sizes = found.sizes;
            }
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

    // Determine target size
    const sizeToUse = selectedSize || (sizes && sizes.length > 0 ? sizes[0] : "100ml");

    const existingItem = cart.find(item => item.id === productId && item.size === sizeToUse);
    if (existingItem) {
        if (existingItem.removed) {
            delete existingItem.removed;
            existingItem.quantity = 1;
        } else {
            existingItem.quantity += 1;
        }
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            nameShort: product.nameShort || product.name || "",
            price: product.price,
            image: product.image,
            image_thumb: product.image_thumb || "",
            size: sizeToUse,
            quantity: 1
        });
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
    
    const activeCartItems = cart.filter(item => !item.removed);
    const totalItems = activeCartItems.reduce((sum, item) => sum + item.quantity, 0);
    const countStr = totalItems.toString().padStart(2, '0');
    
    // Update every possible counter in the site
    const ids = ["cartCountHeader", "cartCountHeaderMobile", "bagCountLabel", "cartCountPanel"];
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

window.removeFromCart = function(index) {
    if (cart[index]) {
        cart[index].removed = true;
        saveAndSyncCart();
    }
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

    const activeCartItems = cart.filter(item => !item.removed);
    const totalItems = activeCartItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = activeCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const hasItems = totalItems > 0;
    const hasAnyCartItems = cart.length > 0;
    const isLoggedIn = !!currentUser;

    // YOUR EXACT ASCII ART
    const minaraArt = `
 __  __   ___   _   _     _      ____      _     
| \\/  | |_ _| | \\ | |   / \\    |  _ \\    / \\    
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

    const isMobile = window.innerWidth <= 900;
    if (hasItems) {
        if (isMobile) {
            asciiWrap.style.display = "none";
        } else {
            asciiContainer.textContent = minaraArt;
            asciiWrap.style.display = "flex";
        }
    } else {
        asciiContainer.textContent = emptyArt;
        asciiWrap.style.display = "flex";
    }

    // #2: REMOVE LEFT BORDER
    asciiWrap.style.borderLeft = "none";         
    asciiWrap.style.alignItems = "center";       
    asciiWrap.style.justifyContent = "flex-start"; 
    asciiWrap.style.padding = "0 25px";
    asciiWrap.style.minHeight = "90px";          
    asciiContainer.style.fontSize = "9px";
    asciiContainer.style.lineHeight = "1.1";
    asciiContainer.style.whiteSpace = "pre";

    let html = '<div style="display:flex; flex-direction:column; height:100%; flex-grow:1; overflow:hidden;">';

    if (hasAnyCartItems) {
        html += '<div class="items-area" style="flex-grow:1; overflow-y:auto;">';
        cart.forEach((item, index) => {
            if (item.removed) {
                html += `
                <div class="cart-item-row removed-item-row" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eaeaea; padding:10px 15px; background:#fafafa; box-sizing:border-box; width:100%;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span style="font-family:Helvetica, Arial, sans-serif; font-size:11px; font-weight:500; text-transform:uppercase; letter-spacing:1px; color:#000;">${item.name} ${(item.size ? ' (' + item.size + ')' : '')}</span>
                        <span style="color:#ff3b30; font-size:9px; font-weight:500; letter-spacing:1px; text-transform:uppercase; opacity:0.8;">REMOVED FROM BAG</span>
                    </div>
                    <span onclick="window.undoRemove(${index})" style="color:#1106e8; font-size:11px; font-family:Helvetica, Arial, sans-serif; text-decoration:underline; cursor:pointer; font-weight:500; text-transform:uppercase; letter-spacing:1px;">UNDO</span>
                </div>`;
            } else {
                const hasDiscount = localStorage.getItem("minara_discount_5") === "active";
                const itemPrice = item.price;
                const displayPrice = hasDiscount 
                    ? `<span style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R${formatPrice(itemPrice)}</span><span style="color: #1106e8; font-weight: bold;">R${formatPrice(Math.round(itemPrice * 0.95))}</span>` 
                    : `R${formatPrice(itemPrice)}`;

                html += `
                <div class="cart-item-row" style="display:flex; gap:15px; border-bottom:1px solid #eaeaea; padding:12px 15px;">
                    <img src="${window.getThumbnailImageUrl(item.image, item.image_thumb)}" style="width:64px; height:84px; object-fit:contain;">
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                            <div style="font-family:Helvetica, Arial, sans-serif; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:#000;">${item.nameShort || item.name}</div>
                            <div style="font-family:Helvetica, Arial, sans-serif; font-size:11px; font-weight:600; letter-spacing:0.5px; color:#000; margin-left:10px; flex-shrink:0;">${displayPrice}</div>
                        </div>
                        ${item.nameShort && item.nameShort !== item.name ? `<div style="font-family:Helvetica, Arial, sans-serif; font-size:10px; opacity:0.6; margin-top:2px; letter-spacing:0.5px;">${item.name}</div>` : ''}
                        <div style="font-family:Helvetica, Arial, sans-serif; font-size:9px; opacity:0.5; margin-top:2px; letter-spacing:0.5px;">SIZE: ${(item.size || '100ml').toUpperCase()}</div>
                        
                        <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
                            <div class="qty-stepper" style="display:flex; border:1px solid #eaeaea; width:fit-content; height:24px;">
                                <div class="qty-btn" ${item.quantity <= 1 ? 'style="width:24px; height:100%; display:flex; justify-content:center; align-items:center; opacity:0.3; cursor:not-allowed;"' : `onclick="window.changeQty(${index}, -1)" style="width:24px; height:100%; cursor:pointer; display:flex; justify-content:center; align-items:center;"`}>–</div>
                                <div class="qty-val" style="width:24px; height:100%; text-align:center; border-left:1px solid #eaeaea; border-right:1px solid #eaeaea; font-size:11px; display:flex; align-items:center; justify-content:center;">${item.quantity}</div>
                                <div class="qty-btn" onclick="window.changeQty(${index}, 1)" style="width:24px; height:100%; cursor:pointer; display:flex; justify-content:center; align-items:center;">+</div>
                            </div>
                            <div onclick="window.removeFromCart(${index})" style="font-family:Helvetica, Arial, sans-serif; font-size:9px; color:#1106e8; cursor:pointer; text-decoration:underline; font-weight:600; letter-spacing:1px; text-transform:uppercase;">✕ REMOVE</div>
                        </div>
                    </div>
                </div>`;
            }
        });
        
        // Continue shopping button under the list of items
        html += `
        <div class="continue-shopping-row" style="width:100%; box-sizing:border-box; padding:15px 20px; display:flex; justify-content:center; border-bottom:1px solid #eaeaea;">
            <span onclick="closeCart()" onmouseover="this.style.background='#000'; this.style.color='#fff';" onmouseout="this.style.background='transparent'; this.style.color='#000';" style="font-family:Helvetica, Arial, sans-serif; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; font-weight:600; transition:all 0.25s ease; border:1px solid #000; padding:10px 20px; display:inline-block; text-align:center; width:100%; max-width:250px;">← Continue Shopping</span>
        </div>`;

        html += '</div>';
    } else {
        html += '<div style="padding:10px 25px; flex-grow:1; display:flex; flex-direction:column; align-items:flex-start;">';
        html += `<div style="font-size:10px; color:rgba(0,0,0,0.6); letter-spacing:0.5px; text-transform:uppercase;">ADD ITEMS TO BAG</div>`;
        html += '</div>';
    }

    // FOOTER (Restored to original Gotham Narrow Bold)
    const footBoxHeight = hasItems ? "45px" : "80px"; 
    const paymentBoxHeight = hasItems ? "auto" : "50px"; 
    const paymentPadding = hasItems ? "20px 20px" : "8px 20px"; 

    const hasDiscount = localStorage.getItem("minara_discount_5") === "active";
    let priceDisplay = 'R' + formatPrice(totalPrice);
    if (hasDiscount) {
        priceDisplay = `<span style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R${formatPrice(totalPrice)}</span><span style="color: #1106e8; font-weight: bold;">R${formatPrice(Math.round(totalPrice * 0.95))}</span>`;
    }

    html += `
        <div class="cart-footer-area" style="margin-top:auto; width:100%;">
            <div style="background:#f9f9f9; border-top:1px solid #eaeaea; padding:12px 20px; height:${footBoxHeight}; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box;">
                <div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold', sans-serif; font-weight:bold; letter-spacing:1.5px; color:#000;">
                    <span>SHIPPING</span><span>FREE</span>
                </div>
                ${!hasItems ? `<div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold', sans-serif; font-weight:bold; letter-spacing:1.5px; color:#000;"><span>TOTAL</span><span>R0</span></div>` : ''}
            </div>
            <div class="payment-section" style="background:#f2f2f2; border-top:1px solid #eaeaea; padding:${paymentPadding}; height:${paymentBoxHeight}; min-height:${paymentBoxHeight}; border-bottom:1px solid #eaeaea; display:flex; flex-direction:column; justify-content:center; box-sizing:border-box; width:100%;">
                <div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold', sans-serif; font-weight:bold; letter-spacing:1.5px; margin-bottom:${hasItems ? '15px' : '4px'}; color:#000;">
                    <span>${hasItems ? 'TOTAL' : 'PAYMENT'}</span>
                    <span>${hasItems ? priceDisplay : ''}</span>
                </div>
                ${hasItems ? `<button onclick="location.href='checkout.html'" style="width:100%; background:#ccff00; border:1px solid #000; padding:12px; font-family:'Gotham Narrow Bold', sans-serif; font-size:11px; cursor:pointer; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">CONTINUE TO CHECKOUT</button>` : ''}
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
        if (delta === -1 && cart[index].quantity <= 1) {
            return;
        }
        cart[index].quantity += delta;
        saveAndSyncCart();
    }
};

window.undoRemove = function(index) {
    if (cart[index]) {
        delete cart[index].removed;
        saveAndSyncCart();
    }
};

// --- AUTH STATE SYNC ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    const role = await getUserRole(user);
    currentUserRole = role;
    
    if (await protectRoutes(user, role)) return;
    
    setupMobileAccount(user);
    updateAdminHeaderButton(user, role);
    renderCartUI(); 
});

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    cart = cart.filter(item => !item.removed);
    saveAndSyncCart();

    const panel = document.getElementById('cartPanel');
    const dimmer = document.getElementById('pageDimmer');
    
    if (dimmer) {
        dimmer.addEventListener('click', () => {
            // Clean up removed items when cart closes
            cart = cart.filter(item => !item.removed);
            saveAndSyncCart();

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
            // Clean up removed items
            cart = cart.filter(item => !item.removed);
            saveAndSyncCart();

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
            // Clean up removed items
            cart = cart.filter(item => !item.removed);
            saveAndSyncCart();

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

    // Run Cloudflare Turnstile challenge
    const token = await window.runTurnstile();
    if (!token) {
        alert("Security verification failed. Please try again.");
        if (emailInput) emailInput.disabled = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            submitBtn.style.opacity = "";
            submitBtn.style.cursor = "";
        }
        return;
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
    localStorage.setItem("minara_discount_email", email);

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
                    <div style="color: #000; font-size: 10px; margin-top: 6px; letter-spacing: 0.5px; opacity: 0.8; text-transform: uppercase; font-family: inherit; line-height: 1.4;">5% discount has been successfully applied to your bag for <span style="text-transform:none; font-weight:bold;">${email}</span>.</div>
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
                    <div style="color: #000; font-size: 11px; margin-top: 6px; opacity: 0.8; letter-spacing: 0.5px; text-transform: uppercase; font-family: inherit; line-height: 1.5;">5% discount has been successfully applied to your bag for <span style="text-transform:none; font-weight:bold;">${email}</span>. Use the button below to explore our exclusive collection.</div>
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
        if ((el.textContent.includes("R749") || el.textContent.includes("R749.00")) && !el.querySelector(".old-price")) {
            el.innerHTML = `<span class="old-price" style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R749</span><span style="color: #1106e8; font-weight: bold;">R712</span>`;
        }
    });
    
    // 2. Catalog page product cards
    const catPrices = document.querySelectorAll(".price");
    catPrices.forEach(el => {
        if ((el.textContent.includes("R749") || el.textContent.includes("R749.00")) && !el.querySelector(".old-price")) {
            el.innerHTML = `<span class="old-price" style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R749</span><span style="color: #1106e8; font-weight: bold;">R712</span>`;
        }
    });
    
    // 3. Product detail pages
    const productPrices = document.querySelectorAll(".product-price");
    productPrices.forEach(el => {
        if ((el.textContent.includes("R749") || el.textContent.includes("R749.00")) && !el.querySelector(".old-price")) {
            el.innerHTML = `<span class="old-price" style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R749</span><span style="color: #1106e8; font-weight: bold;">R712</span>`;
        }
    });

    // 4. Dispatch re-render event for dynamic products
    window.dispatchEvent(new Event("minaraDiscountActivated"));
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
        
        // Mobile newsletter is now ALWAYS open and has NO arrow
        mobileNews.innerHTML = `
            <div id="mobileNewsletterPromo" style="font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;">
                <span>SIGN UP FOR 5% OFF</span>
            </div>
            <div id="mobileNewsletterFormWrap" style="display: block; margin-top: 15px;">
                <p style="font-size: 10px; opacity: 0.6; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">Get 5% off your first order by subscribing.</p>
                <form id="mobileNewsletterForm" style="display: flex; border-bottom: 1px solid #000; padding-bottom: 5px;">
                    <input type="email" id="mobileNewsletterEmail" placeholder="Enter your email" required style="border: none; background: transparent; font-size: 11px; width: 100%; outline: none; text-transform: none; font-family: inherit;">
                    <button type="submit" style="background: transparent; border: none; font-size: 11px; font-weight: bold; color: #1106e8; cursor: pointer; padding: 0 5px; width: auto; margin: 0; font-family: inherit;">SUBMIT</button>
                </form>
            </div>
            <div id="mobileNewsletterSuccess" style="display: none;"></div>
        `;
        
        menuPanel.appendChild(mobileNews);
        
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
        if (successEl) {
            const savedEmail = localStorage.getItem("minara_discount_email") || "your email";
            successEl.innerHTML = `
                <div style="margin-top: 14px; padding: 16px; background: rgba(52, 199, 89, 0.06); border: 1px solid #34c759; border-radius: 2px; animation: fadeIn 0.4s ease;">
                    <div style="color: #34c759; font-size: 11px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase;">✓ DISCOUNT ACTIVATED</div>
                    <div style="color: #000; font-size: 10px; margin-top: 6px; letter-spacing: 0.5px; opacity: 0.8; text-transform: uppercase; font-family: inherit; line-height: 1.4;">5% discount has been successfully applied to your bag for <span style="text-transform:none; font-weight:bold;">${savedEmail}</span>.</div>
                    <a href="catalog.html" style="display: inline-block; margin-top: 12px; background: #000; color: #ccff00; font-size: 9px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; padding: 9px 18px; text-decoration: none; border: 1px solid #000;">SHOP THE CATALOG →</a>
                </div>
            `;
            successEl.style.display = "block";
        }
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
        if (successEl) {
            const savedEmail = localStorage.getItem("minara_discount_email") || "your email";
            successEl.innerHTML = `
                <div style="margin-top: 18px; padding: 22px; background: rgba(52, 199, 89, 0.06); border: 1px solid #34c759; border-radius: 2px; animation: fadeIn 0.4s ease;">
                    <div style="color: #34c759; font-family: 'Gotham Narrow Bold', sans-serif; font-size: 13px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">✓ DISCOUNT ACTIVATED: 5% OFF FIRST ORDER</div>
                    <div style="color: #000; font-size: 11px; margin-top: 6px; opacity: 0.8; letter-spacing: 0.5px; text-transform: uppercase; font-family: inherit; line-height: 1.5;">5% discount has been successfully applied to your bag for <span style="text-transform:none; font-weight:bold;">${savedEmail}</span>. Use the button below to explore our exclusive collection.</div>
                    <a href="catalog.html" style="display: inline-block; margin-top: 16px; background: #000; color: #ccff00; font-family: 'Gotham Narrow Bold', sans-serif; font-size: 10px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; padding: 12px 24px; text-decoration: none; border: 1px solid #000; transition: all 0.2s ease; cursor: pointer;">EXPLORE THE CATALOG →</a>
                </div>
            `;
            successEl.style.display = "block";
        }
    }
}

// --- DYNAMIC CUSTOM TEXT LOADER ---
function applyCustomText(data) {
    if (!data) return;
    
    // 1. Update features if on index page
    if (data.features) {
        const titleElms = document.querySelectorAll('.brand-feature-title');
        const descElms = document.querySelectorAll('.brand-feature-description');
        data.features.forEach((feature, idx) => {
            if (titleElms[idx] && feature.title) titleElms[idx].textContent = feature.title;
            if (descElms[idx] && feature.description) descElms[idx].textContent = feature.description;
        });
    }
    
    // 2. Update trust banner if exists
    if (data.trust_banner) {
        const trustItems = document.querySelectorAll('.trust-item');
        data.trust_banner.forEach((item, idx) => {
            if (trustItems[idx]) {
                const spans = trustItems[idx].querySelectorAll('span');
                if (spans.length >= 2) {
                    if (item.title) spans[0].textContent = item.title;
                    if (item.description) spans[1].textContent = item.description;
                }
            }
        });
    }
}

// Immediately load cache and fetch update
(function() {
    try {
        const cached = localStorage.getItem("minara_custom_text");
        if (cached) {
            const data = JSON.parse(cached);
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => applyCustomText(data));
            } else {
                applyCustomText(data);
            }
        }
    } catch (e) {
        console.error("Failed to load cached custom text:", e);
    }
    
    const fetchLatest = () => {
        fetch('custom_text_settings.json?t=' + Date.now())
            .then(res => {
                if (!res.ok) throw new Error("Status " + res.status);
                return res.json();
            })
            .then(data => {
                localStorage.setItem("minara_custom_text", JSON.stringify(data));
                applyCustomText(data);
            })
            .catch(err => {
                console.warn("Could not fetch latest custom text settings:", err);
            });
    };
    
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", fetchLatest);
    } else {
        fetchLatest();
    }
})();

// ==========================================
// DYNAMIC FRAGRANCE SEARCH DRAWER & LOGIC
// ==========================================
(function() {
    let siteProducts = [];
    let popularFragrancesList = [];

    // Load site products from cache first
    try {
        const cached = localStorage.getItem("minara_products");
        if (cached) {
            siteProducts = JSON.parse(cached);
        }
    } catch (e) {
        console.error("Error reading cache in search:", e);
    }

    // Load active products in background
    fetch("products.json?t=" + Date.now())
        .then(res => res.json())
        .then(data => {
            siteProducts = data;
        })
        .catch(err => {
            console.warn("Could not fetch products.json for search:", err);
        });

    function fetchPopularFragrances() {
        fetch("popular_fragrances.json?t=" + Date.now())
            .then(res => {
                if (!res.ok) throw new Error("Status " + res.status);
                return res.json();
            })
            .then(data => {
                popularFragrancesList = data;
            })
            .catch(err => {
                console.warn("Could not load popular_fragrances.json:", err);
            });
    }

    function injectSearchUI() {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
            #searchOverlay {
                position: fixed;
                inset: 0;
                background: #ffffff;
                z-index: 15000;
                display: none;
                flex-direction: column;
                padding: 20px 40px;
                color: #000000;
                opacity: 0;
                transition: opacity 0.3s ease;
                overflow-y: auto;
                font-family: Helvetica, Arial, sans-serif;
            }
            #searchOverlay.active {
                display: flex;
                opacity: 1;
            }
            .search-top-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                width: 100%;
                border-bottom: none;
                padding-bottom: 10px;
            }
            .search-title-text {
                font-family: 'Gotham Narrow Bold', sans-serif;
                font-size: 13px;
                font-weight: bold;
                letter-spacing: 2px;
                text-transform: uppercase;
                color: #000000;
            }
            .search-close-btn {
                background: transparent;
                border: none;
                color: #1106e8;
                font-family: 'Gotham Narrow Bold', sans-serif;
                font-size: 13px;
                font-weight: bold;
                letter-spacing: 2px;
                cursor: pointer;
                text-transform: uppercase;
                padding: 8px 0;
                display: flex;
                align-items: center;
                transition: opacity 0.2s;
            }
            .search-close-btn:hover {
                opacity: 0.6;
            }
            .search-input-wrap {
                width: 100%;
                margin: 0 auto 30px;
                position: relative;
                display: flex;
                align-items: center;
                background: #eef3f7;
                border: 1px solid #000000;
                padding: 12px 16px;
            }
            .search-input-icon {
                color: #000000;
                margin-right: 12px;
                display: flex;
                align-items: center;
            }
            .search-input-field {
                width: 100%;
                background: transparent;
                border: none;
                color: #000000;
                font-size: 13px;
                font-weight: bold;
                letter-spacing: 1px;
                outline: none;
                font-family: inherit;
                text-transform: uppercase;
            }
            .search-input-field::placeholder {
                color: #7d8e9a;
                text-transform: uppercase;
            }
            .search-header-bar {
                background: #f8f9fa;
                border-top: 1px solid #000000;
                border-bottom: 1px solid #000000;
                padding: 8px 12px;
                font-family: 'Gotham Narrow Bold', sans-serif;
                font-size: 11px;
                font-weight: bold;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                color: #000000;
                margin-bottom: 0px;
            }
            .suggestions-list {
                display: flex;
                flex-direction: column;
                margin-bottom: 30px;
            }
            .suggestion-item {
                padding: 10px 12px;
                border-bottom: 1px solid #e5e7eb;
                font-family: Helvetica, Arial, sans-serif;
                font-size: 12px;
                color: #1106e8;
                text-decoration: none;
                cursor: pointer;
                font-weight: bold;
                text-align: left;
                transition: background 0.2s, color 0.2s;
            }
            .suggestion-item:hover {
                background: #f9fafb;
                color: #000000;
            }
            .search-results-container {
                width: 100%;
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            .search-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 24px;
                margin-top: 20px;
                margin-bottom: 30px;
            }
            @media (max-width: 900px) {
                .search-grid {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                }
                #searchOverlay {
                    padding: 20px;
                }
            }
            .search-grid-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                background: transparent;
                text-decoration: none;
                color: #000000;
                transition: opacity 0.25s ease;
                padding: 10px 0;
            }
            .search-grid-card:hover {
                opacity: 0.75;
            }
            .search-grid-card-img {
                width: 100%;
                height: 180px;
                object-fit: contain;
                background: transparent;
                margin-bottom: 10px;
            }
            .search-grid-card-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
                align-items: center;
            }
            .search-grid-card-title {
                font-family: 'Gotham Narrow Bold', sans-serif;
                font-size: 11px;
                font-weight: bold;
                letter-spacing: 1.2px;
                text-transform: uppercase;
                color: #000000;
            }
            .search-grid-card-price {
                font-size: 11px;
                font-weight: normal;
                color: #1106e8;
                letter-spacing: 0.5px;
            }
            .search-section-title {
                font-family: 'Gotham Narrow Bold', sans-serif;
                font-size: 12px;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                color: #000000;
                margin-top: 15px;
                margin-bottom: 15px;
                font-weight: bold;
            }
            .search-card {
                background: #ffffff;
                border: 1px solid #000000;
                padding: 20px;
                display: flex;
                gap: 20px;
                align-items: center;
                transition: border-color 0.2s;
                color: #000000;
            }
            .search-card-img {
                width: 90px;
                height: 90px;
                object-fit: contain;
                background: #ffffff;
            }
            .search-card-info {
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .search-card-title {
                font-family: 'Gotham Narrow Bold', sans-serif;
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 1.2px;
                color: #000000;
                text-decoration: none;
                text-transform: uppercase;
            }
            .search-card-title:hover {
                text-decoration: underline;
            }
            .search-card-desc {
                font-size: 11px;
                color: #6d6d6d;
                line-height: 1.45;
            }
            .search-card-price {
                font-size: 13px;
                font-weight: bold;
                color: #1106e8;
            }
            .search-notify-box {
                background: #fafafa;
                border: 1px dashed #000000;
                padding: 20px;
                margin-top: 15px;
                color: #000000;
            }
            .search-notify-title {
                font-family: 'Gotham Narrow Bold', sans-serif;
                font-size: 11px;
                font-weight: bold;
                letter-spacing: 1.5px;
                color: #000000;
                text-transform: uppercase;
                margin-bottom: 6px;
            }
            .search-notify-text {
                font-size: 10.5px;
                color: #6d6d6d;
                margin-bottom: 15px;
                line-height: 1.5;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .search-notify-form {
                display: flex;
                border-bottom: 1px solid #000000;
                padding-bottom: 4px;
                max-width: 400px;
            }
            .search-notify-input {
                border: none;
                background: transparent;
                font-size: 11px;
                color: #000000;
                width: 100%;
                outline: none;
                font-family: inherit;
                letter-spacing: 0.5px;
            }
            .search-notify-input::placeholder {
                color: #a0aec0;
                text-transform: uppercase;
            }
            .search-notify-submit {
                background: transparent;
                border: none;
                font-size: 11px;
                font-weight: bold;
                color: #1106e8;
                cursor: pointer;
                padding: 0 10px;
                letter-spacing: 1px;
                text-transform: uppercase;
                font-family: inherit;
            }
            .search-notify-submit:hover {
                opacity: 0.8;
            }
            .search-link-btn {
                display: inline-block;
                margin-top: 10px;
                background: #000000;
                color: #ffffff;
                font-family: 'Gotham Narrow Bold', sans-serif;
                font-size: 9.5px;
                font-weight: bold;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                padding: 10px 20px;
                text-decoration: none;
                border: 1px solid #000000;
                transition: all 0.25s ease;
                cursor: pointer;
                align-self: flex-start;
                text-align: center;
            }
            .search-link-btn:hover {
                background: transparent;
                color: #000000;
            }
        `;
        document.head.appendChild(styleEl);

        const overlay = document.createElement("div");
        overlay.id = "searchOverlay";
        overlay.innerHTML = `
            <div class="search-top-row">
                <span class="search-title-text">SEARCH</span>
                <button class="search-close-btn" id="searchCloseBtn">
                    ✕ CLOSE
                </button>
            </div>
            
            <div class="search-input-wrap">
                <span class="search-input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </span>
                <input type="text" class="search-input-field" id="searchInput" placeholder="SEARCH HERE" autocomplete="off">
            </div>
            
            <div id="searchSuggestionsPanel">
                <div class="search-header-bar">SUGGESTIONS</div>
                <div class="suggestions-list">
                    <div class="suggestion-item" id="suggestMens">Men's</div>
                    <div class="suggestion-item" id="suggestWomens">Women's</div>
                </div>
            </div>
            
            <div class="search-header-bar" id="searchGridTitle">SUGGESTED PRODUCTS</div>
            <div class="search-results-container" id="searchResults"></div>
        `;
        document.body.appendChild(overlay);

        document.getElementById("searchCloseBtn").onclick = closeSearch;
        
        const input = document.getElementById("searchInput");
        input.oninput = (e) => {
            runSearch(e.target.value);
        };

        document.getElementById("suggestMens").onclick = () => window.filterSearchByGender("men");
        document.getElementById("suggestWomens").onclick = () => window.filterSearchByGender("women");
    }

    window.filterSearchByGender = function(gender) {
        const resultsContainer = document.getElementById("searchResults");
        const suggestionsPanel = document.getElementById("searchSuggestionsPanel");
        const gridTitle = document.getElementById("searchGridTitle");
        const input = document.getElementById("searchInput");
        if (!resultsContainer) return;
        
        if (input) {
            input.value = gender === 'men' ? "Men's" : "Women's";
        }
        
        if (suggestionsPanel) suggestionsPanel.style.display = "block";
        if (gridTitle) {
            gridTitle.style.display = "block";
            gridTitle.textContent = gender === 'men' ? "Men's Fragrances" : "Women's Fragrances";
        }
        
        resultsContainer.innerHTML = "";
        const grid = document.createElement("div");
        grid.className = "search-grid";
        
        siteProducts.forEach(p => {
            if (p.status !== 'Active') return;
            const isMen = p.invisibleFlair.toLowerCase() === 'men' || p.name.toLowerCase().includes('male') || p.name.toLowerCase().includes('homme');
            const isWomen = p.invisibleFlair.toLowerCase() === 'women' || p.name.toLowerCase().includes('women') || p.name.toLowerCase().includes('femme') || p.name.toLowerCase().includes('elle');
            
            if (gender === 'men' && !isMen && p.id !== 'inspired-by-creed-aventus') return;
            if (gender === 'women' && !isWomen) return;
            
            const card = document.createElement("a");
            card.className = "search-grid-card";
            card.href = p.id === 'leopard-backpack' ? 'leopard.html' : `template product.html?id=${p.id}`;
            
            const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(p.image, p.image_thumb) : p.image;
            const formattedPrice = window.formatPrice ? window.formatPrice(p.price) : p.price;
            
            card.innerHTML = `
                <img src="${imgUrl}" class="search-grid-card-img" alt="${p.name}">
                <div class="search-grid-card-info">
                    <span class="search-grid-card-title">${p.nameShort || p.name}</span>
                    <span class="search-grid-card-price">R${formattedPrice}</span>
                </div>
            `;
            grid.appendChild(card);
        });
        
        resultsContainer.appendChild(grid);
    };

    function renderDefaultGrid() {
        const resultsContainer = document.getElementById("searchResults");
        const suggestionsPanel = document.getElementById("searchSuggestionsPanel");
        const gridTitle = document.getElementById("searchGridTitle");
        if (!resultsContainer) return;
        
        if (suggestionsPanel) suggestionsPanel.style.display = "block";
        if (gridTitle) {
            gridTitle.style.display = "block";
            gridTitle.textContent = "SUGGESTED PRODUCTS";
        }
        
        resultsContainer.innerHTML = "";
        const grid = document.createElement("div");
        grid.className = "search-grid";
        
        siteProducts.forEach(p => {
            if (p.status !== 'Active') return;
            const card = document.createElement("a");
            card.className = "search-grid-card";
            card.href = p.id === 'leopard-backpack' ? 'leopard.html' : `template product.html?id=${p.id}`;
            
            const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(p.image, p.image_thumb) : p.image;
            const formattedPrice = window.formatPrice ? window.formatPrice(p.price) : p.price;
            
            card.innerHTML = `
                <img src="${imgUrl}" class="search-grid-card-img" alt="${p.name}">
                <div class="search-grid-card-info">
                    <span class="search-grid-card-title">${p.nameShort || p.name}</span>
                    <span class="search-grid-card-price">R${formattedPrice}</span>
                </div>
            `;
            grid.appendChild(card);
        });
        
        resultsContainer.appendChild(grid);
    }

    window.openSearch = function() {
        const overlay = document.getElementById("searchOverlay");
        if (overlay) {
            overlay.classList.add("active");
            overlay.style.display = "flex";
            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
            const input = document.getElementById("searchInput");
            if (input) {
                input.value = "";
                input.focus();
            }
            renderDefaultGrid();
        }
    };

    window.closeSearch = function() {
        const overlay = document.getElementById("searchOverlay");
        if (overlay) {
            overlay.classList.remove("active");
            setTimeout(() => {
                overlay.style.display = "none";
            }, 300);
            document.body.style.overflow = "";
            document.documentElement.style.overflow = "";
        }
    };
    const closeSearch = window.closeSearch;
    const openSearch = window.openSearch;

    function injectSearchButtons() {
        const headerUl = document.querySelector("header nav ul, header .header-right ul, header ul");
        let searchLi = document.getElementById("searchHeaderLi");
        
        if (headerUl && !searchLi) {
            searchLi = document.createElement("li");
            searchLi.id = "searchHeaderLi";
            searchLi.innerHTML = `
                <a href="#" id="searchHeaderBtn" style="display: flex; align-items: center; gap: 6px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <span>Search</span>
                </a>
            `;
            
            const accountLi = headerUl.querySelector(".header-account");
            if (accountLi) {
                headerUl.insertBefore(searchLi, accountLi);
            } else {
                headerUl.appendChild(searchLi);
            }
            
            const btn = document.getElementById("searchHeaderBtn");
            if (btn) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    openSearch();
                };
            }
        }

        const mobileCart = document.querySelector(".mobile-cart, .cart-btn.mobile-cart, .cart-header-btn.mobile-cart");
        let mobileSearch = document.getElementById("mobileSearchBtn");
        
        if (mobileCart && !mobileSearch) {
            mobileSearch = document.createElement("span");
            mobileSearch.id = "mobileSearchBtn";
            mobileSearch.className = mobileCart.className;
            mobileSearch.classList.remove("mobile-cart");
            mobileSearch.style.cssText = `
                display: flex;
                align-items: center;
                gap: 4px;
                position: absolute;
                right: 56px;
                top: 10px;
                cursor: pointer;
                transition: opacity 0.3s ease;
            `;
            mobileSearch.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            `;
            
            mobileCart.parentNode.insertBefore(mobileSearch, mobileCart);
            
            mobileSearch.onclick = (e) => {
                e.preventDefault();
                openSearch();
            };
            
            mobileSearch.onmouseenter = () => { mobileSearch.style.opacity = "0.5"; };
            mobileSearch.onmouseleave = () => { mobileSearch.style.opacity = "1"; };
        }
    }

    function normalizeString(str) {
        if (!str) return "";
        return str.toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9\s]/g, "")
                  .replace(/\s+/g, " ")
                  .trim();
    }

    function getLevenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    window.submitSearchStockNotification = async function(e, productId, productName, matchedFragranceName) {
        e.preventDefault();
        const form = e.target;
        const emailInput = form.querySelector('input[type="email"]');
        const submitBtn = form.querySelector('button[type="submit"]');
        const successEl = form.parentNode.querySelector('.search-notify-success');
        
        if (!emailInput || !window.db) return;
        const email = emailInput.value.trim();
        if (!email) return;
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "SAVING...";
        }
        
        try {
            await addDoc(collection(window.db, "stock_notifications"), {
                email: email,
                productId: productId,
                productName: productName,
                matchedFragrance: matchedFragranceName,
                size: "50ml",
                timestamp: new Date().toISOString()
            });
            form.style.display = "none";
            if (successEl) successEl.style.display = "block";
        } catch (error) {
            console.error("Error saving search stock notification:", error);
            alert("Failed to submit request: " + error.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "NOTIFY ME";
            }
        }
    };

    window.submitUnsupportedRequest = async function(e, queryVal, closestId) {
        e.preventDefault();
        const form = e.target;
        const emailInput = form.querySelector('input[type="email"]');
        const submitBtn = form.querySelector('button[type="submit"]');
        const successEl = form.parentNode.querySelector('.search-notify-success');
        
        if (!emailInput || !window.db) return;
        
        const email = emailInput.value.trim();
        if (!email) return;
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "SAVING...";
        }
        
        try {
            await addDoc(collection(window.db, "unsupported_requests"), {
                email: email,
                query: queryVal,
                closest: closestId,
                timestamp: new Date().toISOString()
            });
            
            form.style.display = "none";
            if (successEl) {
                successEl.style.display = "block";
            }
        } catch (error) {
            console.error("Error saving unsupported request to Firestore:", error);
            alert("Failed to submit request: " + error.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "NOTIFY ME";
            }
        }
    };

    const STOCKED_FRAGRANCE_KEYWORDS = {
        "inspired-by-jpg-le-male": [
            "jpg le male", "le male", "jean paul gaultier le male", 
            "jean paul gaultier le male edt", "jpg le male edt", 
            "gaultier le male", "le male gaultier", "jpg male", "jp le male"
        ],
        "inspired-by-creed-aventus": [
            "creed aventus", "aventus", "creed aventus edp", 
            "creed aventus edt", "aventish", "aventus creed", "creed aventus cologne", "creed"
        ]
    };

    function findDirectStockedProductByQuery(queryText) {
        const clean = normalizeString(queryText);
        for (const productId in STOCKED_FRAGRANCE_KEYWORDS) {
            const keywords = STOCKED_FRAGRANCE_KEYWORDS[productId];
            if (keywords.some(kw => {
                const normalizedKw = normalizeString(kw);
                return clean === normalizedKw || clean.includes(normalizedKw) || normalizedKw.includes(clean);
            })) {
                return siteProducts.find(p => p.id === productId);
            }
        }
        return null;
    }

    function displayDirectProductCard(product, popFrag) {
        const resultsContainer = document.getElementById("searchResults");
        if (!resultsContainer) return;
        
        const formattedPrice = window.formatPrice ? window.formatPrice(product.price) : product.price;
        const detailUrl = product.id === 'leopard-backpack' ? 'leopard.html' : `template product.html?id=${product.id}`;
        const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(product.image, product.image_thumb) : product.image;
        
        const popName = popFrag && popFrag.name ? `${popFrag.brand} ${popFrag.name}` : product.name;
        
        resultsContainer.innerHTML = `
            <div class="search-section-title">Direct Match in Store</div>
            <div class="search-card">
                <img src="${imgUrl}" class="search-card-img" alt="${product.name}">
                <div class="search-card-info">
                    <a href="${detailUrl}" class="search-card-title">${product.nameShort || product.name}</a>
                    <span class="search-card-desc">${product.name}</span>
                    <span class="search-card-price">R${formattedPrice}</span>
                    <a href="${detailUrl}" class="search-link-btn" style="margin-top: 10px; width: fit-content;">VIEW FRAGRANCE</a>
                </div>
            </div>
        `;
        
        // Show out-of-stock notify if stock <= 0
        if (product.stock <= 0) {
            const notifyBox = document.createElement("div");
            notifyBox.className = "search-notify-box";
            notifyBox.innerHTML = `
                <div class="search-notify-title">Out of Stock — Get Notified</div>
                <div class="search-notify-text">
                    This fragrance is currently out of stock. Enter your email below to be notified as soon as it is back in stock.
                </div>
                <form class="search-notify-form" id="stockNotifyForm">
                    <input type="email" class="search-notify-input" id="stockNotifyEmail" placeholder="Enter your email address" required>
                    <button type="submit" class="search-notify-submit">NOTIFY ME</button>
                </form>
                <div class="search-notify-success" style="display: none; margin-top: 10px; color: #34c759; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                    ✓ You're on the list! We'll notify you.
                </div>
            `;
            resultsContainer.appendChild(notifyBox);
            
            const form = notifyBox.querySelector("#stockNotifyForm");
            if (form) {
                form.onsubmit = (e) => {
                    window.submitSearchStockNotification(e, product.id, product.name, popName);
                };
            }
        }
    }

    function displayClosestMatch(popFrag, originalQuery, isFuzzy = false) {
        const resultsContainer = document.getElementById("searchResults");
        if (!resultsContainer) return;
        
        const closestProduct = siteProducts.find(p => p.id === popFrag.closestOurSite);
        if (!closestProduct) return;
        
        const formattedPrice = window.formatPrice ? window.formatPrice(closestProduct.price) : closestProduct.price;
        const detailUrl = closestProduct.id === 'leopard-backpack' ? 'leopard.html' : `template product.html?id=${closestProduct.id}`;
        const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(closestProduct.image, closestProduct.image_thumb) : closestProduct.image;
        
        const matchLabel = isFuzzy ? `Did you mean <strong>${popFrag.brand} ${popFrag.name}</strong>?` : `We found <strong>${popFrag.brand} ${popFrag.name}</strong> in our database.`;
        
        resultsContainer.innerHTML = `
            <div class="search-section-title">Closest Scents We Carry</div>
            <div style="font-size: 13px; color: #4a5568; margin-bottom: 20px; line-height: 1.5;">
                ${matchLabel} We don't carry this exact fragrance in our collection yet, but we recommend checking out our closest matching scent:
            </div>
            
            <div class="search-card">
                <img src="${imgUrl}" class="search-card-img" alt="${closestProduct.name}">
                <div class="search-card-info">
                    <a href="${detailUrl}" class="search-card-title">${closestProduct.nameShort || closestProduct.name}</a>
                    <span class="search-card-desc">${closestProduct.name}</span>
                    <span class="search-card-price">R${formattedPrice}</span>
                    <a href="${detailUrl}" class="search-link-btn" style="margin-top: 10px; width: fit-content;">EXPLORE RECOMMENDATION</a>
                </div>
            </div>
            
            <div class="search-notify-box">
                <div class="search-notify-title">Notify Me when available</div>
                <div class="search-notify-text">
                    Would you like to be notified as soon as we launch our own version of <strong>${popFrag.brand} ${popFrag.name}</strong>? Enter your email address below.
                </div>
                <form class="search-notify-form" id="unsupportedNotifyForm">
                    <input type="email" class="search-notify-input" id="unsupportedNotifyEmail" placeholder="Enter your email address" required>
                    <button type="submit" class="search-notify-submit">NOTIFY ME</button>
                </form>
                <div class="search-notify-success" style="display: none; margin-top: 10px; color: #34c759; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                    ✓ Request saved successfully! We'll notify you.
                </div>
            </div>
        `;

        const form = document.getElementById("unsupportedNotifyForm");
        if (form) {
            form.onsubmit = (e) => {
                window.submitUnsupportedRequest(e, `${popFrag.brand} ${popFrag.name}`, closestProduct.id);
            };
        }
    }

    function displayFallback(originalQuery) {
        const resultsContainer = document.getElementById("searchResults");
        if (!resultsContainer) return;
        
        const bestSeller = siteProducts.find(p => p.id === 'inspired-by-creed-aventus') || siteProducts[0];
        if (!bestSeller) return;
        
        const formattedPrice = window.formatPrice ? window.formatPrice(bestSeller.price) : bestSeller.price;
        const detailUrl = bestSeller.id === 'leopard-backpack' ? 'leopard.html' : `template product.html?id=${bestSeller.id}`;
        const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(bestSeller.image, bestSeller.image_thumb) : bestSeller.image;
        const escapedQuery = window.escapeHTML ? window.escapeHTML(originalQuery) : originalQuery;

        resultsContainer.innerHTML = `
            <div class="search-section-title">No direct match found</div>
            <div style="font-size: 13px; color: #4a5568; margin-bottom: 20px; line-height: 1.5;">
                We couldn't find a direct match for "<strong>${escapedQuery}</strong>". You might be interested in our best-selling signature scent:
            </div>
            
            <div class="search-card">
                <img src="${imgUrl}" class="search-card-img" alt="${bestSeller.name}">
                <div class="search-card-info">
                    <a href="${detailUrl}" class="search-card-title">${bestSeller.nameShort || bestSeller.name}</a>
                    <span class="search-card-desc">${bestSeller.name}</span>
                    <span class="search-card-price">R${formattedPrice}</span>
                    <a href="${detailUrl}" class="search-link-btn" style="margin-top: 10px; width: fit-content;">EXPLORE BEST SELLER</a>
                </div>
            </div>
            
            <div class="search-notify-box">
                <div class="search-notify-title">Request this fragrance</div>
                <div class="search-notify-text">
                    Enter your email address below, and we will look into stocking our own clone formulation of "<strong>${escapedQuery}</strong>" in the future!
                </div>
                <form class="search-notify-form" id="unsupportedNotifyForm">
                    <input type="email" class="search-notify-input" id="unsupportedNotifyEmail" placeholder="Enter your email address" required>
                    <button type="submit" class="search-notify-submit">SUBMIT REQUEST</button>
                </form>
                <div class="search-notify-success" style="display: none; margin-top: 10px; color: #34c759; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                    ✓ Scent request saved! We will notify you when we launch it.
                </div>
            </div>
        `;

        const form = document.getElementById("unsupportedNotifyForm");
        if (form) {
            form.onsubmit = (e) => {
                window.submitUnsupportedRequest(e, originalQuery, bestSeller.id);
            };
        }
    }

    function runSearch(queryText) {
        const resultsContainer = document.getElementById("searchResults");
        const suggestionsPanel = document.getElementById("searchSuggestionsPanel");
        const gridTitle = document.getElementById("searchGridTitle");
        if (!resultsContainer) return;
        
        const cleanQuery = normalizeString(queryText);
        if (!cleanQuery) {
            renderDefaultGrid();
            return;
        }
        
        if (suggestionsPanel) suggestionsPanel.style.display = "none";
        if (gridTitle) gridTitle.style.display = "none";
        resultsContainer.innerHTML = "";
        
        // Check if query normalized matches direct stocked targets
        let directProduct = findDirectStockedProductByQuery(queryText);
        let bestPopMatch = null;
        let isFuzzy = false;
        
        // Exact match in popular_fragrances.json database
        const exactPopMatches = popularFragrancesList.filter(f => {
            return f.aliases.some(alias => {
                const nAlias = normalizeString(alias);
                return nAlias === cleanQuery || nAlias.includes(cleanQuery) || cleanQuery.includes(nAlias);
            }) || normalizeString(f.name).includes(cleanQuery) || normalizeString(f.brand).includes(cleanQuery);
        });
        
        if (exactPopMatches.length > 0) {
            bestPopMatch = exactPopMatches[0];
        } else {
            // Fuzzy search match in popular_fragrances.json database
            let bestDistance = Infinity;
            
            popularFragrancesList.forEach(f => {
                f.aliases.forEach(alias => {
                    const nAlias = normalizeString(alias);
                    const dist = getLevenshteinDistance(cleanQuery, nAlias);
                    if (dist < bestDistance) {
                        bestDistance = dist;
                        bestPopMatch = f;
                    }
                });
                const nameDist = getLevenshteinDistance(cleanQuery, normalizeString(f.name));
                if (nameDist < bestDistance) {
                    bestDistance = nameDist;
                    bestPopMatch = f;
                }
            });
            
            const maxAllowedDistance = Math.max(3, Math.floor(cleanQuery.length / 2));
            if (bestDistance <= maxAllowedDistance) {
                isFuzzy = true;
            } else {
                bestPopMatch = null;
            }
        }
        
        // If matched popular fragrance is flagged as direct target, resolve to that direct product
        if (bestPopMatch && bestPopMatch.isDirectInspiration === true) {
            const found = siteProducts.find(p => p.id === bestPopMatch.closestOurSite);
            if (found) {
                directProduct = found;
            }
        }
        
        if (directProduct) {
            displayDirectProductCard(directProduct, bestPopMatch);
        } else if (bestPopMatch) {
            displayClosestMatch(bestPopMatch, queryText, isFuzzy);
        } else {
            displayFallback(queryText);
        }
    }

    const initSearchSystem = () => {
        injectSearchUI();
        injectSearchButtons();
        fetchPopularFragrances();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSearchSystem);
    } else {
        initSearchSystem();
    }
    window.addEventListener("load", injectSearchSystem);
})();

