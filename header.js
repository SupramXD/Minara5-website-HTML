let lastRemovedItem = null;
import "./js/core/cart.js?v=20260821_1050";
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


// --- DYNAMICALLY INJECT FADE-IN & CUSTOM LOGO SIZE CSS ---
function applyDynamicLogoStyles(settings) {
    const headerDHeight = settings.logoHeaderDesktopHeight !== undefined ? settings.logoHeaderDesktopHeight : 50;
    const headerMHeight = settings.logoHeaderMobileHeight !== undefined ? settings.logoHeaderMobileHeight : 36;
    
    let styleEl = document.getElementById("minara-custom-logo-style");
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = "minara-custom-logo-style";
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      img:not(.loaded) {
        opacity: 0 !important;
      }
      img.loading-fade {
        transition: opacity 0.45s ease-in-out !important;
      }
      .center-logo {
        height: ${headerDHeight}px !important;
      }
      @media (max-width: 900px) {
        .center-logo {
          height: ${headerMHeight}px !important;
        }
      }
      .header-logo {
        height: ${Math.round(headerDHeight * 0.7)}px !important;
      }
      .product-box, .hp-box, .slider {
        background-color: #fcfaf8 !important;
      }
      .under-construction-badge {
        display: none !important;
      }
    `;
}

// Initial application from cache
let cachedSettings = {};
try {
    const cachedHero = localStorage.getItem("minara_hero_settings");
    if (cachedHero) {
        cachedSettings = JSON.parse(cachedHero);
    }
} catch (e) {
    console.warn("Failed to load hero logo settings in header.js:", e);
}
applyDynamicLogoStyles(cachedSettings);

// Background fetch of latest settings
setTimeout(async () => {
    try {
        const response = await fetch("hero_settings.json?t=" + Date.now());
        if (response.ok) {
            const data = await response.json();
            let currentLocal = {};
            try {
                const cached = localStorage.getItem("minara_hero_settings");
                if (cached) currentLocal = JSON.parse(cached);
            } catch (e) {}
            
            const updated = Object.assign({}, currentLocal, data);
            localStorage.setItem("minara_hero_settings", JSON.stringify(updated));
            applyDynamicLogoStyles(updated);
        }
    } catch (err) {
        console.warn("Background fetch of logo settings failed in header.js:", err);
    }
}, 100);

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

window.auth = auth;
// Dynamic Session Interaction Tracker
async function startSessionTracker(db, doc, setDoc) {
    if (window.location.pathname.includes("admin.html")) return;
    
    let sessionId = sessionStorage.getItem("extrait_session_id");
    let isNewSession = false;
    if (!sessionId) {
        sessionId = "SESS-" + Math.random().toString(36).substring(2, 12).toUpperCase() + "-" + Date.now().toString().slice(-4);
        sessionStorage.setItem("extrait_session_id", sessionId);
        isNewSession = true;
    }

    const device = window.innerWidth <= 900 ? "Mobile" : "Desktop";
    const referrer = document.referrer || "Direct";
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    let sessionData = {
        sessionId: sessionId,
        device: device,
        referrer: referrer,
        ip: "Pending...",
        location: "Loading...",
        pages: [],
        clicks: [],
        maxScrollDepth: 0,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
    };

    const cached = sessionStorage.getItem("extrait_session_data");
    if (cached) {
        try {
            sessionData = JSON.parse(cached);
        } catch(e) {}
    }

    const pageExists = sessionData.pages.some(p => p.page === currentPage);
    if (!pageExists) {
        sessionData.pages.push({
            page: currentPage,
            timestamp: new Date().toISOString()
        });
    }

    function saveCache() {
        sessionData.lastActive = new Date().toISOString();
        sessionStorage.setItem("extrait_session_data", JSON.stringify(sessionData));
    }

    async function syncFirestore() {
        try {
            // Skip tracking if authenticated as primary owner
            const user = auth.currentUser;
            if (user && user.email === 'sub2meboyi@gmail.com') return;

            const sessionRef = doc(db, "sessions", sessionId);
            await setDoc(sessionRef, sessionData);
        } catch (err) {
            console.warn("Tracker sync failed:", err);
        }
    }

    // Load Geo IP / location (includes VPNs, Proxies & Geoblocked hits)
    if (isNewSession || sessionData.ip === "Pending...") {
        let detectedIp = null;
        let detectedLocation = null;
        let isGeoBlockedOrVpn = false;

        try {
            const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
            if (res.ok) {
                const geo = await res.json();
                if (geo && geo.ip) {
                    detectedIp = geo.ip;
                    const parts = [geo.city, geo.region, geo.country_name].filter(Boolean);
                    detectedLocation = parts.join(", ") || "Unknown Location";
                }
            }
        } catch (e) {
            // ipapi failed or blocked by VPN/adblock/georestriction
        }

        if (!detectedIp) {
            // Fallback 1: ipify IPv4
            try {
                const res = await fetch("https://api.ipify.org?format=json");
                if (res.ok) {
                    const ipify = await res.json();
                    if (ipify && ipify.ip) {
                        detectedIp = ipify.ip;
                        detectedLocation = "Unknown (VPN / Geoblocked)";
                        isGeoBlockedOrVpn = true;
                    }
                }
            } catch (err) {}
        }

        if (!detectedIp) {
            // Fallback 2: ipify universal IPv4/IPv6
            try {
                const res = await fetch("https://api64.ipify.org?format=json");
                if (res.ok) {
                    const ipify64 = await res.json();
                    if (ipify64 && ipify64.ip) {
                        detectedIp = ipify64.ip;
                        detectedLocation = "Unknown (VPN / Geoblocked)";
                        isGeoBlockedOrVpn = true;
                    }
                }
            } catch (err) {}
        }

        sessionData.ip = detectedIp || "Protected / VPN";
        sessionData.location = detectedLocation || "Unknown Location";
        sessionData.isGeoBlocked = isGeoBlockedOrVpn || (sessionData.location && (sessionData.location.includes("Geo Blocked") || sessionData.location.includes("VPN")));
        sessionData.isVpn = isGeoBlockedOrVpn || (sessionData.ip && sessionData.ip.includes("VPN"));

        saveCache();
        await syncFirestore();
    } else {
        saveCache();
    }

    // Track clicks on actionable elements
    window.addEventListener("click", (e) => {
        const target = e.target;
        const clickable = target.closest("button, a, .cart-btn, .account-trigger, .close-btn, .track-submit-btn, .submit-order-btn, .product-card");
        if (clickable) {
            let desc = clickable.textContent.trim() || clickable.value || clickable.alt || clickable.className || "clickable element";
            if (desc.length > 50) desc = desc.substring(0, 47) + "...";
            sessionData.clicks.push({
                element: clickable.tagName.toLowerCase(),
                text: desc,
                page: currentPage,
                timestamp: new Date().toISOString()
            });
            saveCache();

            // High-intent actions trigger immediate Firestore sync (checkout, checkout buttons, etc.)
            const isHighIntent = clickable.matches("[href*='checkout'], [href*='payfast'], [href*='paystack'], .submit-order-btn, .track-submit-btn, [class*='checkout'], [class*='pay']");
            if (isHighIntent) {
                syncFirestore();
            }
        }
    });

    // Track scroll depth
    let lastLoggedDepth = 0;
    window.addEventListener("scroll", () => {
        const scrollH = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollH <= 0) return;
        const pct = Math.round((window.scrollY / scrollH) * 100);
        if (pct > sessionData.maxScrollDepth && pct > lastLoggedDepth + 10) {
            lastLoggedDepth = pct;
            sessionData.maxScrollDepth = pct;
            saveCache();
        }
    });

    // Modern browser lifecycle hooks for reliable page exit logging
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            syncFirestore();
        }
    });

    window.addEventListener("pagehide", () => {
        syncFirestore();
    });

    // Initial page load entry sync
    await syncFirestore();
}

window.db = null;

// Dynamic Firestore Loader Promise
window.dbPromise = import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js")
    .then(m => {
        const dbInstance = m.initializeFirestore(app, isLocalFile ? {
            experimentalForceLongPolling: true
        } : {});
        window.db = dbInstance;
        window.dbDoc = m.doc;
        window.dbGetDoc = m.getDoc;
        window.dbSetDoc = m.setDoc;
        window.dbCollection = m.collection;
        window.dbAddDoc = m.addDoc;
        window.dbQuery = m.query;
        window.dbWhere = m.where;
        window.dbGetDocs = m.getDocs;
        window.dbOrderBy = m.orderBy;

        // Initialize user interaction tracker
        startSessionTracker(dbInstance, m.doc, m.setDoc);

        return dbInstance;
    })
    .catch(err => {
        console.error("Failed to dynamically load Firestore:", err);
    });

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
    if (window.dbPromise) {
        await window.dbPromise;
    }
    if (window.db && window.dbDoc && window.dbGetDoc && window.dbSetDoc) {
        try {
            const userDocRef = window.dbDoc(window.db, "users", user.uid);
            const userSnap = await window.dbGetDoc(userDocRef);
            if (userSnap.exists()) {
                return userSnap.data().role || "Customer";
            } else {
                const defaultRole = user.email === "sub2meboyi@gmail.com" ? "Admin" : "Customer";
                await window.dbSetDoc(userDocRef, {
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
    window.currentUserRole = role;
    
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
   CART & BAG DRAWER LOGIC
   Moved to js/core/cart.js
================================ */

/* ===============================
   QUALITY OF LIFE (QoL) IMPROVEMENTS
================================ */

// 1. "ADDED TO BAG" Feedback
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-to-cart-btn, .add-to-cart, button[onclick*="addToCart"]');
    if (btn && !btn.disabled && !btn.classList.contains('placeholder-btn') && !btn.textContent.includes('CREATE BUNDLE')) {
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
        
        /* Underline effect for active desktop nav (left nav and right header links) */
        .left-nav a.active-nav, nav ul li a.active-nav {
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

    // Active Navigation Highlighting (Includes query parameter checks for Men's and Women's)
    const rawPage = window.location.pathname.split("/").pop() || "index.html";
    const currentPage = decodeURIComponent(rawPage);
    const currentQuery = window.location.search;
    const currentFull = currentPage + currentQuery;
    
    document.querySelectorAll('.left-nav a, nav ul li a').forEach(link => {
        const linkHref = link.getAttribute('href');
        if (!linkHref) return;
        const decodedHref = decodeURIComponent(linkHref);
        
        // Match the full relative href including query, or fallback to exact page matching if no query is active
        if (decodedHref === currentFull || (currentQuery === "" && decodedHref === currentPage)) {
            link.classList.add('active-nav');
        } else {
            link.classList.remove('active-nav');
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

    // Run Cloudflare Turnstile challenge (proceed even if verification fails/warns due to domain changes)
    let token = null;
    try {
        token = await window.runTurnstile();
    } catch (e) {
        console.warn("Turnstile error:", e);
    }
    if (!token) {
        console.warn("Security verification (Turnstile) returned null or failed. Proceeding with registration anyway.");
    }
    
    try {
        if (window.dbPromise) {
            await window.dbPromise;
        }
        if (window.db && window.dbAddDoc && window.dbCollection) {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout waiting for Firestore")), 10000)
            );
            await Promise.race([
                window.dbAddDoc(window.dbCollection(window.db, "subscribers"), {
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

    // Mark as subscribed for early access
    localStorage.setItem("minara_subscribed_early_access", "active");
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
    
    // Show premium styled success alert state
    if (type === 'mobile') {
        const formWrap = document.getElementById("mobileNewsletterFormWrap");
        const successEl = document.getElementById("mobileNewsletterSuccess");
        const promoText = document.querySelector("#mobileNewsletterPromo span");
        if (formWrap) formWrap.style.display = "none";
        if (successEl) {
            successEl.innerHTML = `
                <div style="margin-top: 14px; padding: 8px 16px; border: 1px solid rgba(0, 0, 0, 0.45); border-radius: 0px; animation: fadeIn 0.4s ease; text-align: left; display: inline-block; opacity: 0.75;">
                    <span style="color: #000; font-family: 'Gotham Narrow Bold', sans-serif; font-size: 8px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">✓ SUBSCRIBED</span>
                </div>
            `;
            successEl.style.display = "block";
        }
        if (promoText) promoText.textContent = "SUBSCRIBED";
    } else {
        const form = document.getElementById("desktopSignupForm");
        const successEl = document.getElementById("desktopSignupSuccess");
        if (form) form.style.display = "none";
        if (successEl) {
            successEl.innerHTML = `
                <div style="margin-top: 14px; padding: 8px 16px; border: 1px solid rgba(0, 0, 0, 0.45); border-radius: 0px; animation: fadeIn 0.4s ease; text-align: left; display: inline-block; opacity: 0.75;">
                    <span style="color: #000; font-family: 'Gotham Narrow Bold', sans-serif; font-size: 8px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">✓ SUCCESSFULLY SUBSCRIBED</span>
                </div>
            `;
            successEl.style.display = "block";
        }
    }
    
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
            margin-top: auto;
            border-top: 1px solid #eaeaea;
            padding-top: 28px;
            padding-bottom: 10px;
        `;
        
        mobileNews.innerHTML = `
            <div id="mobileNewsletterPromo" style="font-family: 'Gotham Narrow Bold', sans-serif; font-size: 8.5px; font-weight: 900; letter-spacing: 3.5px; text-transform: uppercase; color: #999999; margin-bottom: 14px;">
                <span>SUBSCRIBE FOR EARLY ACCESS</span>
            </div>
            <div id="mobileNewsletterFormWrap" style="display: block;">
                <form id="mobileNewsletterForm" style="display: flex; border-bottom: 1px solid #000000; padding-bottom: 6px;">
                    <input type="email" id="mobileNewsletterEmail" placeholder="Enter your email" required style="border: none; background: transparent; font-family: inherit; font-size: 11px; letter-spacing: 0.8px; color: #000000; width: 100%; outline: none; text-transform: none;">
                    <button type="submit" style="background: transparent; border: none; font-family: 'Gotham Narrow Bold', sans-serif; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #000000; cursor: pointer; padding: 0 4px; width: auto; margin: 0; transition: opacity 0.25s ease;">SUBMIT</button>
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
    
    const isSubscribed = localStorage.getItem("minara_subscribed_early_access") === "active";
    if (isSubscribed) {
        const formWrap = document.getElementById("mobileNewsletterFormWrap");
        const successEl = document.getElementById("mobileNewsletterSuccess");
        if (formWrap) formWrap.style.display = "none";
        if (successEl) {
            successEl.innerHTML = `
                <div style="margin-top: 14px; padding: 8px 16px; border: 1px solid rgba(0, 0, 0, 0.45); border-radius: 0px; animation: fadeIn 0.4s ease; text-align: left; display: inline-block; opacity: 0.75;">
                    <span style="color: #000; font-family: 'Gotham Narrow Bold', sans-serif; font-size: 8px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">✓ SUBSCRIBED</span>
                </div>
            `;
            successEl.style.display = "block";
        }
        const promoText = document.querySelector("#mobileNewsletterPromo span");
        if (promoText) promoText.textContent = "SUBSCRIBED";
    }
}

function setupDesktopNewsletter() {
    const isSubscribed = localStorage.getItem("minara_subscribed_early_access") === "active";
    if (isSubscribed) {
        const form = document.getElementById("desktopSignupForm");
        const successEl = document.getElementById("desktopSignupSuccess");
        if (form) form.style.display = "none";
        if (successEl) {
            successEl.innerHTML = `
                <div style="margin-top: 14px; padding: 8px 16px; border: 1px solid rgba(0, 0, 0, 0.45); border-radius: 0px; animation: fadeIn 0.4s ease; text-align: left; display: inline-block; opacity: 0.75;">
                    <span style="color: #000; font-family: 'Gotham Narrow Bold', sans-serif; font-size: 8px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">✓ SUCCESSFULLY SUBSCRIBED</span>
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
    window.formatInspiredNameHTML = function(name, id, nameShort) {
        if (!name) return "";
        let clean = name.replace(/<br>/gi, ' ').replace(/\s+/g, ' ').trim();
        const match = clean.match(/^inspired\s+by\s+(.+)/i);
        
        const formatBrandName = (brandName) => {
            if (!brandName) return "";
            return brandName.replace(/\w\S*/g, (txt) => {
                const lower = txt.toLowerCase();
                if (lower === 'jpg') return 'JPG';
                if (lower === 'le') return 'Le';
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        };

        if (match || (id && id.startsWith("inspired-by-"))) {
            const fragranceName = match ? match[1] : clean;
            return `<span style="font-family:'Gotham Narrow Bold', sans-serif; font-weight: 700; font-size: 11.5px; text-transform: uppercase; color: #111111; display: block; margin-bottom: 2px;">${nameShort || clean}</span><span style="font-family:'Gotham Narrow Bold', sans-serif; font-size: 8px; font-weight: bold; color: #777777; letter-spacing: 1.2px; text-transform: uppercase; display: block;">INSPIRED BY <i style="font-family:'Gotham Narrow Bold', sans-serif; font-style: italic; font-weight: 500; font-size: 11.5px; text-transform: uppercase; color: #111111; letter-spacing: 0.5px; display: inline-block;">${formatBrandName(fragranceName)}</i></span>`;
        }
        return `<span style="font-family:'Gotham Narrow Bold', sans-serif; font-weight: 700; font-size: 11.5px; text-transform: uppercase; color: #111111; display: block;">${nameShort || clean}</span>`;
    };

    window.formatCartInspiredNameHTML = function(name, id, nameShort) {
        if (!name) return "";
        let clean = name.replace(/<br>/gi, ' ').replace(/\s+/g, ' ').trim();
        const match = clean.match(/^inspired\s+by\s+(.+)/i);
        
        const formatBrandName = (brandName) => {
            if (!brandName) return "";
            return brandName.replace(/\w\S*/g, (txt) => {
                const lower = txt.toLowerCase();
                if (lower === 'jpg') return 'JPG';
                if (lower === 'le') return 'Le';
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        };

        if (match || (id && id.startsWith("inspired-by-"))) {
            const fragranceName = match ? match[1] : clean;
            return `<span style="font-family:'Gotham Narrow Bold', sans-serif; font-weight: 700; font-size: 11px; display: block; text-transform: uppercase; color: #111111; margin-bottom: 2px;">${nameShort || clean}</span><span style="font-size: 8px; font-weight: bold; color: #777777; letter-spacing: 1px; display: block;">INSPIRED BY <i style="font-family:'Gotham Narrow Bold', sans-serif; font-style: italic; font-weight: 500; font-size: 11px; text-transform: uppercase; color: #111111; letter-spacing: 0.5px; display: inline-block;">${formatBrandName(fragranceName)}</i></span>`;
        }
        return `<span style="font-family:'Gotham Narrow Bold', sans-serif; font-weight: 700; font-size: 11px; display: block; text-transform: uppercase; color: #111111;">${nameShort || clean}</span>`;
    };

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

    // Load active products in background (Disabled)
    /*
    fetch("products.json?t=" + Date.now())
        .then(res => res.json())
        .then(data => {
            siteProducts = data;
        })
        .catch(err => {
            console.warn("Could not fetch products.json for search:", err);
        });
    */

    let isFetchingPopularFragrances = false;
    let fetchCallbacks = [];

    function fetchPopularFragrances(callback) {
        if (popularFragrancesList.length > 0) {
            if (callback) callback(popularFragrancesList);
            return;
        }
        if (callback) {
            fetchCallbacks.push(callback);
        }
        if (isFetchingPopularFragrances) return;
        isFetchingPopularFragrances = true;

        fetch("popular_fragrances.json?t=" + Date.now())
            .then(res => {
                if (!res.ok) throw new Error("Status " + res.status);
                return res.json();
            })
            .then(data => {
                popularFragrancesList = data;
                isFetchingPopularFragrances = false;
                const callbacks = fetchCallbacks;
                fetchCallbacks = [];
                callbacks.forEach(cb => cb(data));
            })
            .catch(err => {
                console.warn("Could not load popular_fragrances.json:", err);
                isFetchingPopularFragrances = false;
            });
    }

    function injectSearchUI() {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
            #searchOverlay {
                position: fixed;
                top: 0;
                right: 0;
                bottom: 0;
                width: 85vw;
                background: #ffffff;
                z-index: 15000;
                display: none;
                flex-direction: column;
                padding: 20px 40px;
                color: #000000;
                border-left: 1px solid #000000;
                transform: translate3d(100%, 0, 0);
                transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
                overflow-y: auto;
                font-family: Helvetica, Arial, sans-serif;
            }
            #searchOverlay.active {
                display: flex;
                transform: translate3d(0, 0, 0);
            }
            @media (min-width: 901px) {
                #searchOverlay {
                    width: 55vw;
                }
                #mobileSearchBtn {
                    display: none !important;
                }
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
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                gap: 24px;
                margin-top: 20px;
                margin-bottom: 30px;
            }
            @media (max-width: 900px) {
                .search-grid {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    margin-top: 15px;
                    margin-bottom: 15px;
                }
                #searchOverlay {
                    padding: 20px;
                }
                .search-grid-card-img {
                    height: 100px;
                    margin-bottom: 5px;
                }
                .search-grid-card {
                    padding: 5px 0;
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
            @media (max-width: 480px) {
                .search-notify-form {
                    flex-direction: column;
                    border-bottom: none !important;
                    gap: 10px;
                }
                .search-notify-input {
                    border-bottom: 1px solid #000000;
                    padding-bottom: 8px;
                }
                .search-notify-submit {
                    align-self: flex-start;
                    padding: 8px 0 !important;
                }
            }
            @media (max-width: 900px) {
                #searchOverlay.keyboard-open {
                    padding: 10px 15px;
                }
                #searchOverlay.keyboard-open .search-top-row {
                    margin-bottom: 8px;
                    padding-bottom: 4px;
                }
                #searchOverlay.keyboard-open .search-input-wrap {
                    margin-bottom: 12px;
                    padding: 8px 12px;
                }
                #searchOverlay.keyboard-open .search-header-bar {
                    padding: 4px 8px;
                    margin-bottom: 4px;
                    font-size: 9px;
                }
                #searchOverlay.keyboard-open .suggestions-list {
                    margin-bottom: 12px;
                }
                #searchOverlay.keyboard-open .suggestion-item {
                    padding: 6px 8px;
                    font-size: 11px;
                }
                #searchOverlay.keyboard-open .search-grid {
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-top: 8px;
                    margin-bottom: 8px;
                }
                #searchOverlay.keyboard-open .search-grid-card {
                    padding: 4px;
                    border: 1px solid #eee;
                    background: #fafafa;
                }
                #searchOverlay.keyboard-open .search-grid-card-img {
                    height: 50px !important;
                    margin-bottom: 3px;
                }
                #searchOverlay.keyboard-open .search-grid-card-title {
                    font-size: 8px !important;
                    line-height: 1.1;
                }
                #searchOverlay.keyboard-open .search-grid-card-price {
                    font-size: 8px !important;
                    margin-top: 2px !important;
                }
                #searchOverlay.keyboard-open .search-card {
                    padding: 8px;
                    gap: 10px;
                }
                #searchOverlay.keyboard-open .search-card-img {
                    width: 45px;
                    height: 45px;
                }
                #searchOverlay.keyboard-open .search-card-title {
                    font-size: 10px;
                }
                #searchOverlay.keyboard-open .search-card-price {
                    font-size: 10px;
                }
                #searchOverlay.keyboard-open .search-link-btn {
                    padding: 6px 12px;
                    font-size: 8px;
                    margin-top: 6px;
                }
                #searchOverlay.keyboard-open .search-notify-box {
                    padding: 10px;
                    margin-top: 8px;
                }
                #searchOverlay.keyboard-open .search-notify-title {
                    font-size: 9px;
                    margin-bottom: 4px;
                }
                #searchOverlay.keyboard-open .search-notify-text {
                    font-size: 9px;
                    margin-bottom: 8px;
                }
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
            card.href = `template product.html?id=${p.id}`;
            
            const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(p.image, p.image_thumb) : p.image;
            const formattedPrice = window.formatPrice ? window.formatPrice(p.price) : p.price;
            card.innerHTML = `
                <img src="${imgUrl}" class="search-grid-card-img" alt="${p.name}">
                <div class="search-grid-card-info" style="width: 100%;">
                    ${window.formatInspiredNameHTML(p.name, p.id, p.nameShort)}
                    <span class="search-grid-card-price" style="display: block; margin-top: 4px;">R${formattedPrice}</span>
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
            card.href = `template product.html?id=${p.id}`;
            
            const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(p.image, p.image_thumb) : p.image;
            const formattedPrice = window.formatPrice ? window.formatPrice(p.price) : p.price;
            
            card.innerHTML = `
                <img src="${imgUrl}" class="search-grid-card-img" alt="${p.name}">
                <div class="search-grid-card-info" style="width: 100%;">
                    ${window.formatInspiredNameHTML(p.name, p.id, p.nameShort)}
                    <span class="search-grid-card-price" style="display: block; margin-top: 4px;">R${formattedPrice}</span>
                </div>
            `;
            grid.appendChild(card);
        });
        
        resultsContainer.appendChild(grid);
    }

    window.openSearch = function() {
        const overlay = document.getElementById("searchOverlay");
        if (overlay) {
            if (typeof window.closeCart === "function") {
                window.closeCart();
            } else {
                const cartPanel = document.getElementById("cartPanel");
                if (cartPanel) cartPanel.classList.remove("open");
            }

            overlay.style.display = "flex";
            overlay.offsetHeight; // Force reflow
            overlay.classList.add("active");

            const dimmer = document.getElementById("pageDimmer");
            if (dimmer) {
                dimmer.classList.add("active");
            }

            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
            const input = document.getElementById("searchInput");
            if (input) {
                input.value = "";
                input.focus();
            }
            renderDefaultGrid();
            
            // Push history state so back button closes overlay
            if (!history.state || !history.state.searchOpen) {
                history.pushState({ searchOpen: true }, "");
            }
            
            // Defer loading until overlay is opened
            fetchPopularFragrances();
        }
    };

    window.closeSearch = function(isFromPopState = false) {
        const overlay = document.getElementById("searchOverlay");
        if (overlay) {
            overlay.classList.remove("active");
            overlay.classList.remove("keyboard-open");
            overlay.style.top = "";
            overlay.style.height = "";
            
            const header = document.querySelector("header");
            if (header) {
                header.style.display = "";
            }
            
            const dimmer = document.getElementById("pageDimmer");
            if (dimmer) {
                const cartPanel = document.getElementById("cartPanel");
                if (!cartPanel || !cartPanel.classList.contains("open")) {
                    dimmer.classList.remove("active");
                }
            }

            setTimeout(() => {
                overlay.style.display = "none";
            }, 400);
            document.body.style.overflow = "";
            document.documentElement.style.overflow = "";
            
            // If closed manually via click/dimmer, sync browser history state
            if (!isFromPopState && history.state && history.state.searchOpen) {
                history.back();
            }
        }
    };

    window.addEventListener("popstate", (e) => {
        const overlay = document.getElementById("searchOverlay");
        if (overlay && overlay.classList.contains("active")) {
            window.closeSearch(true);
        }
    });

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

        const mobileCart = document.querySelector(".mobile-cart, .cart-btn.mobile-cart, .cart-header-btn.mobile-cart, .cart-btn");
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
                right: 86px;
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
        
        if (window.dbPromise) {
            await window.dbPromise;
        }
        if (!emailInput || !window.db || !window.dbAddDoc || !window.dbCollection) return;
        const email = emailInput.value.trim();
        if (!email) return;
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "SAVING...";
        }
        
        try {
            await window.dbAddDoc(window.dbCollection(window.db, "stock_notifications"), {
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
        
        if (window.dbPromise) {
            await window.dbPromise;
        }
        if (!emailInput || !window.db || !window.dbAddDoc || !window.dbCollection) return;
        
        const email = emailInput.value.trim();
        if (!email) return;
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "SAVING...";
        }
        
        try {
            await window.dbAddDoc(window.dbCollection(window.db, "unsupported_requests"), {
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

    window.fetchPopularFragrances = fetchPopularFragrances;

    window.findSearchMatchedProductIds = function(queryText) {
        if (!queryText) return [];
        const cleanQuery = normalizeString(queryText);
        if (!cleanQuery) return [];

        let matches = [];

        // Helper to push match safely without duplicates
        const addMatch = (productId, isDirect, popularMatch) => {
            const existingIdx = matches.findIndex(m => m.id === productId);
            if (existingIdx === -1) {
                matches.push({ id: productId, isDirect: isDirect, popularMatch: popularMatch });
            } else {
                if (isDirect) {
                    matches[existingIdx].isDirect = true;
                    matches[existingIdx].popularMatch = null;
                }
            }
        };

        // 0. Search site products directly by name, nameShort, or ID (exact/substring or fuzzy Levenshtein)
        if (siteProducts && siteProducts.length > 0) {
            siteProducts.forEach(p => {
                const normName = normalizeString(p.name);
                const normShort = normalizeString(p.nameShort);
                const normId = normalizeString(p.id);
                
                // Exact/substring match
                if (normName.includes(cleanQuery) || cleanQuery.includes(normName) ||
                    normShort.includes(cleanQuery) || cleanQuery.includes(normShort) ||
                    normId.includes(cleanQuery)) {
                    addMatch(p.id, true, null);
                } else {
                    // Fuzzy match check (allowing small typos on our stocked items)
                    const nameDist = getLevenshteinDistance(cleanQuery, normName);
                    const shortDist = getLevenshteinDistance(cleanQuery, normShort);
                    const idDist = getLevenshteinDistance(cleanQuery, normId.replace("inspiredby", "").replace("inspired", ""));
                    
                    const maxAllowed = Math.max(2, Math.floor(cleanQuery.length / 2.5));
                    if (nameDist <= maxAllowed || shortDist <= maxAllowed || idDist <= maxAllowed) {
                        addMatch(p.id, true, null);
                    }
                }
            });
        }

        // 1. Direct stocked match keywords
        const directProduct = findDirectStockedProductByQuery(queryText);
        if (directProduct) {
            addMatch(directProduct.id, true, null);
        }

        // 2. Exact/Combined match in popular_fragrances.json database
        if (popularFragrancesList.length > 0) {
            const exactPopMatches = popularFragrancesList.filter(f => {
                const normBrand = normalizeString(f.brand);
                const normName = normalizeString(f.name);
                const combined = `${normBrand} ${normName}`;
                
                const aliasMatch = f.aliases && f.aliases.some(alias => {
                    const nAlias = normalizeString(alias);
                    return nAlias === cleanQuery || nAlias.includes(cleanQuery) || cleanQuery.includes(nAlias);
                });
                if (aliasMatch) return true;
                if (combined.includes(cleanQuery) || cleanQuery.includes(combined)) return true;
                if (cleanQuery.includes(normBrand) && cleanQuery.includes(normName)) return true;
                return false;
            });

            if (exactPopMatches.length > 0) {
                exactPopMatches.forEach(f => {
                    if (f.closestOurSite) {
                        const isDirect = f.isDirectInspiration === true || (directProduct && directProduct.id === f.closestOurSite);
                        addMatch(f.closestOurSite, !!isDirect, f);
                    }
                });
            } else {
                // Fuzzy search match in popular_fragrances.json database
                let bestDistance = Infinity;
                let bestPopMatch = null;
                
                popularFragrancesList.forEach(f => {
                    f.aliases && f.aliases.forEach(alias => {
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
                    const combinedDist = getLevenshteinDistance(cleanQuery, `${normalizeString(f.brand)} ${normalizeString(f.name)}`);
                    if (combinedDist < bestDistance) {
                        bestDistance = combinedDist;
                        bestPopMatch = f;
                    }
                });
                
                const maxAllowedDistance = Math.max(3, Math.floor(cleanQuery.length / 2));
                if (bestDistance <= maxAllowedDistance && bestPopMatch && bestPopMatch.closestOurSite) {
                    const isDirect = bestPopMatch.isDirectInspiration === true || (directProduct && directProduct.id === bestPopMatch.closestOurSite);
                    addMatch(bestPopMatch.closestOurSite, !!isDirect, bestPopMatch);
                }
            }
        }

        if (matches.some(m => m.isDirect)) {
            matches = matches.filter(m => m.isDirect);
        }

        return matches;
    };

      function displayDirectProductCard(product, popFrag) {
        const resultsContainer = document.getElementById("searchResults");
        if (!resultsContainer) return;
        
        const formattedPrice = window.formatPrice ? window.formatPrice(product.price) : product.price;
        const detailUrl = `template product.html?id=${product.id}`;
        const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(product.image, product.image_thumb) : product.image;
        
        const popName = popFrag && popFrag.name ? `${popFrag.brand} ${popFrag.name}` : product.name;
        
        resultsContainer.innerHTML = `
            <div class="search-section-title">Direct Match in Store</div>
            <div class="search-card" style="cursor: pointer;" onclick="window.location.href='${detailUrl}'">
                <img src="${imgUrl}" class="search-card-img" alt="${product.name}">
                <div class="search-card-info">
                    <span class="search-card-title" style="display: block;">${window.formatInspiredNameHTML(product.name, product.id, product.nameShort)}</span>
                    <span class="search-card-price" style="display: block; margin-top: 5px;">R${formattedPrice}</span>
                    <span class="search-link-btn" style="margin-top: 10px; width: fit-content; display: inline-block;">VIEW FRAGRANCE</span>
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
        const detailUrl = `template product.html?id=${closestProduct.id}`;
        const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(closestProduct.image, closestProduct.image_thumb) : closestProduct.image;
        
        const matchLabel = isFuzzy 
            ? `DID YOU MEAN <strong>${popFrag.brand.toUpperCase()} ${popFrag.name.toUpperCase()}</strong>?` 
            : `<strong>${popFrag.brand.toUpperCase()} ${popFrag.name.toUpperCase()}</strong> IS IN OUR DATABASE.`;
        
        resultsContainer.innerHTML = `
            <div class="search-section-title">RECOMMENDED MATCH</div>
            <div style="font-size: 11px; color: #000000; margin-bottom: 20px; line-height: 1.5; text-transform: uppercase; letter-spacing: 0.5px;">
                ${matchLabel} WE DO NOT STOCK THIS SCENT YET. OUR CLOSEST MATCH:
            </div>
            
            <div class="search-card" style="cursor: pointer;" onclick="window.location.href='${detailUrl}'">
                <img src="${imgUrl}" class="search-card-img" alt="${closestProduct.name}">
                <div class="search-card-info">
                    <span class="search-card-title" style="display: block;">${window.formatInspiredNameHTML(closestProduct.name, closestProduct.id, closestProduct.nameShort)}</span>
                    <span class="search-card-price" style="display: block; margin-top: 5px;">R${formattedPrice}</span>
                    <span class="search-link-btn" style="margin-top: 10px; width: fit-content; display: inline-block;">EXPLORE MATCH</span>
                </div>
            </div>
            
            <div class="search-notify-box">
                <div class="search-notify-title">GET NOTIFIED</div>
                <div class="search-notify-text">
                    ENTER YOUR EMAIL TO BE NOTIFIED WHEN OUR VERSION OF <strong>${popFrag.brand.toUpperCase()} ${popFrag.name.toUpperCase()}</strong> IS AVAILABLE.
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
        const detailUrl = `template product.html?id=${bestSeller.id}`;
        const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(bestSeller.image, bestSeller.image_thumb) : bestSeller.image;
        const escapedQuery = window.escapeHTML ? window.escapeHTML(originalQuery) : originalQuery;
 
        resultsContainer.innerHTML = `
            <div class="search-section-title">NO MATCH FOUND</div>
            <div style="font-size: 11px; color: #000000; margin-bottom: 20px; line-height: 1.5; text-transform: uppercase; letter-spacing: 0.5px;">
                WE COULD NOT FIND A MATCH FOR "<strong>${escapedQuery.toUpperCase()}</strong>". OUR BEST SELLER:
            </div>
            
            <div class="search-card" style="cursor: pointer;" onclick="window.location.href='${detailUrl}'">
                <img src="${imgUrl}" class="search-card-img" alt="${bestSeller.name}">
                <div class="search-card-info">
                    <span class="search-card-title" style="display: block;">${window.formatInspiredNameHTML(bestSeller.name, bestSeller.id, bestSeller.nameShort)}</span>
                    <span class="search-card-price" style="display: block; margin-top: 5px;">R${formattedPrice}</span>
                    <span class="search-link-btn" style="margin-top: 10px; width: fit-content; display: inline-block;">EXPLORE BEST SELLER</span>
                </div>
            </div>
            
            <div class="search-notify-box">
                <div class="search-notify-title">REQUEST FORMULATION</div>
                <div class="search-notify-text">
                    ENTER YOUR EMAIL TO REQUEST A CLONE FORMULATION OF "<strong>${escapedQuery.toUpperCase()}</strong>".
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

        if (popularFragrancesList.length === 0) {
            resultsContainer.innerHTML = `<div style="font-size: 11px; color: #777777; text-transform: uppercase; letter-spacing: 1px; padding: 20px 0;">SEARCHING...</div>`;
            fetchPopularFragrances(() => {
                const currentInput = document.getElementById("searchInput");
                if (currentInput && normalizeString(currentInput.value) === cleanQuery) {
                    runSearch(currentInput.value);
                }
            });
            return;
        }
        
        // Check if query normalized matches direct stocked targets
        let directProduct = findDirectStockedProductByQuery(queryText);
        let bestPopMatch = null;
        let isFuzzy = false;
        
        // Exact/Combined match in popular_fragrances.json database
        const exactPopMatches = popularFragrancesList.filter(f => {
            const normBrand = normalizeString(f.brand);
            const normName = normalizeString(f.name);
            const combined = `${normBrand} ${normName}`;
            
            // 1. Check abbreviation aliases
            const aliasMatch = f.aliases && f.aliases.some(alias => {
                const nAlias = normalizeString(alias);
                return nAlias === cleanQuery || nAlias.includes(cleanQuery) || cleanQuery.includes(nAlias);
            });
            if (aliasMatch) return true;
            
            // 2. Check exact combined or substring matches
            if (combined.includes(cleanQuery) || cleanQuery.includes(combined)) return true;
            
            // 3. Check out-of-order words (e.g. "sauvage dior")
            if (cleanQuery.includes(normBrand) && cleanQuery.includes(normName)) return true;
            
            return false;
        });
        
        if (exactPopMatches.length > 0) {
            bestPopMatch = exactPopMatches[0];
        } else {
            // Fuzzy search match in popular_fragrances.json database
            let bestDistance = Infinity;
            
            popularFragrancesList.forEach(f => {
                f.aliases && f.aliases.forEach(alias => {
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
                const combinedDist = getLevenshteinDistance(cleanQuery, `${normalizeString(f.brand)} ${normalizeString(f.name)}`);
                if (combinedDist < bestDistance) {
                    bestDistance = combinedDist;
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
        const isCatalogPage = window.location.pathname.includes("catalog") || !!document.getElementById("catalogPageSearchBtn");
        if (!isCatalogPage) return;

        // Fetch products in background for search
        fetch("products.json?t=" + Date.now())
            .then(res => res.json())
            .then(data => {
                siteProducts = data;
            })
            .catch(err => {
                console.warn("Could not fetch products.json for search:", err);
            });

        // Pre-fetch popular fragrances list for search matching
        fetchPopularFragrances();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            initSearchSystem();
        });
    } else {
        initSearchSystem();
    }
})();

// Centralized Stock Management, Reservation & Rollback moved to js/core/cart.js


