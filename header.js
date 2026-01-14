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

window.renderCartUI = function() {
    const cartContainer = document.querySelector('.cart-body');
    const asciiContainer = document.querySelector('.cart-ascii');
    // Targets the "BAG 00" text in the top-left corner
    const bagLabel = document.getElementById('bagCountLabel');
    
    if (!cartContainer || !asciiContainer) return;

    // 1. Calculate totals for the label and the price
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const countStr = totalItems.toString().padStart(2, '0');
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 2. Update the "BAG 00" text dynamically
    if (bagLabel) {
        bagLabel.textContent = `BAG ${countStr}`;
    }

    // 3. Handle Empty State
    if (cart.length === 0) {
        asciiContainer.textContent = ` _____   __  __   ____    _____  __   __\n| ____| |  \\/  | |  _ \\  |_   _| \\ \\ / /\n|  _|   | |\\/| | | |_) |   | |    \\ V / \n| |___  | |  | | |  __/    | |     | |  \n|_____| |_|  |_| |_|       |_|     |_|  `;
        cartContainer.innerHTML = `<p style="text-align:center; padding:60px 0; font-size:10px; letter-spacing:2px; opacity:0.5; text-transform:uppercase;">Your bag is empty</p>`;
        
        // Update total to 0
        const bottomSections = document.querySelectorAll('.cart-section');
        if (bottomSections.length >= 2) {
            bottomSections[1].innerHTML = `TOTAL <span style="float:right;">R0</span>`;
        }
        return;
    }

    // 4. Update Unicode to "BAG"
    asciiContainer.textContent = ` ____       _       ____ \n| __ )     / \\     / ___|\n|  _ \\    / _ \\   | |  _ \n| |_) |  / ___ \\  | |_| |\n|____/  /_/   \\_\\  \\____|`;

    // 5. Build High-Fashion Item List
    let html = '';
    cart.forEach((item, index) => {
        html += `
            <div class="cart-item-row" style="display: flex; gap: 15px; margin-bottom: 30px; align-items: flex-start;">
                <img src="${item.image}" style="width: 90px; height: 120px; object-fit: cover; background: #f9f9f9;">
                
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <div style="font-family:'Gotham Narrow Bold', sans-serif; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">${item.name}</div>
                    <div style="font-size:10px; opacity:0.6; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:10px;">COLOUR: ORIGINAL<br>ONE SIZE</div>
                    <div style="font-size:11px; letter-spacing:1px; margin-bottom:12px;">R${item.price.toLocaleString()}</div>
                    
                    <div class="qty-stepper" style="display: flex; align-items: center; border: 1px solid #000; width: fit-content;">
                        <div class="qty-btn" onclick="changeQty(${index}, -1)" style="width:25px; height:25px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px;">–</div>
                        <div class="qty-val" style="width:30px; text-align:center; font-size:11px; border-left:1px solid #000; border-right:1px solid #000;">${item.quantity}</div>
                        <div class="qty-btn" onclick="changeQty(${index}, 1)" style="width:25px; height:25px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px;">+</div>
                    </div>
                    
                    <span class="cart-remove-link" onclick="removeFromCart(${index})" style="font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#0000FF !important; cursor:pointer; margin-top:15px; text-decoration:underline;">X REMOVE</span>
                </div>
            </div>`;
    });

    cartContainer.innerHTML = html;
    
    // 6. Update Totals Footer
    const bottomSections = document.querySelectorAll('.cart-section');
    if (bottomSections.length >= 2) {
        bottomSections[1].innerHTML = `TOTAL <span style="float:right;">R${totalPrice.toLocaleString()}</span>`;
    }
};

// HELPER FUNCTIONS
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
// Sync on load
document.addEventListener('DOMContentLoaded', saveAndSyncCart);
