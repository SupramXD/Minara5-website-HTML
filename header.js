let lastRemovedItem = null;
import "./js/core/cart.js?v=20260826_1615";
import "./js/core/search.js?v=20260826_1615";
import "./js/core/auth.js?v=20260826_1615";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Global helpers (Available immediately to all inline page scripts)
window.escapeHTML = function(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};
window.formatPrice = function(value) {
    if (value === undefined || value === null || isNaN(value)) return "0";
    return Math.round(Number(value)).toString();
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

// --- LIVE PRODUCTS HELPER ---
// Firestore is the source of truth for stock. This fetches the live products
// collection (publicly readable per firestore.rules) so storefront stock badges
// reflect admin changes immediately, without waiting for a redeploy.
window.loadLiveProducts = async () => {
  try {
    await window.dbPromise;
    if (!window.db || !window.dbCollection || !window.dbGetDocs) return null;
    const snap = await window.dbGetDocs(window.dbCollection(window.db, "products"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Failed to load live products from Firestore:", err);
    return null;
  }
};

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

// Retail price can be a number (2200) or free text ("3500+", "R2200+", "+"). Helpers handle both.
window.normalizeRetailPrice = function(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    if (s === "") return null;
    return s;
};
window.formatRetailLabel = function(value) {
    if (value === undefined || value === null || value === "") return "";
    const raw = String(value).trim();
    const hasPlus = raw.indexOf("+") > -1;
    const num = Number(raw);
    if (!isNaN(num) && num > 0) {
        return "R" + Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (hasPlus ? "+" : "");
    }
    // Free-text that contains digits, e.g. "3500+", "R3500+"
    const digits = String(raw).replace(/[^0-9]/g, "");
    if (digits) {
        const n = Number(digits);
        if (!isNaN(n) && n > 0) {
            const formatted = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            return "R" + formatted + (hasPlus ? "+" : "");
        }
    }
    return raw;
};
window.getRetailNumber = function(value) {
    if (value === undefined || value === null || value === "") return null;
    const num = Number(String(value).replace(/[^0-9.]/g, ""));
    return (!isNaN(num) && num > 0) ? num : null;
};


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
/* ===============================
   AUTH & ACCOUNT LOGIC
   Moved to js/core/auth.js
================================ */

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
const DEFAULT_FOOTER_DESCRIPTION = "Designer-inspired extraits, crafted at 20%+ concentration to match 95% of the iconic scents you love — for a fraction of the price. Macerated to perfection, with free delivery across South Africa on orders over R650. Find your signature scent.";

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

    // 3. Update footer description (single master injected on every page)
    const footerDescription = data.footer_description || DEFAULT_FOOTER_DESCRIPTION;
    document.querySelectorAll('.footer-description').forEach(footerEl => {
        footerEl.textContent = footerDescription;
    });
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
    
    const fetchLatest = async () => {
        try {
            if (window.dbPromise) await window.dbPromise;
            if (window.db && window.dbDoc && window.dbGetDoc) {
                const docSnap = await window.dbGetDoc(window.dbDoc(window.db, "settings", "custom_text"));
                if (docSnap && docSnap.exists()) {
                    const data = docSnap.data();
                    localStorage.setItem("minara_custom_text", JSON.stringify(data));
                    applyCustomText(data);
                    return;
                }
            }
        } catch (fsErr) { }

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
// Moved to js/core/search.js
// ==========================================

// Centralized Stock Management, Reservation & Rollback moved to js/core/cart.js


