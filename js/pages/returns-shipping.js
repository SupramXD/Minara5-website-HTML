// Studio Extrait - Returns & Shipping Policy Dynamic Text & Admin Editor Module

(function () {
  const defaultPolicy = {
    shippingHeading: "1. Express Shipping Policy",
    shippingText: "<p>STUDIO EXTRAIT provides reliable, door-to-door courier dispatch to any address within South Africa powered by The Courier Guy.</p>\n<p><strong>Dispatch & Processing:</strong> Orders are packaged and dispatched within 24 to 48 hours of payment confirmation (excluding weekends and public holidays).</p>\n<p><strong>Delivery Timeframe:</strong> Express courier delivery nationwide typically takes 2 to 4 business days to major centers, and up to 5 business days for regional areas.</p>\n<p><strong>Live Order Tracking:</strong> Upon dispatch, you will automatically receive an SMS and Email containing your Courier Guy waybill tracking link to monitor your delivery in real-time.</p>\n<p><strong>Courier Rates:</strong> Standard door-to-door nationwide delivery is R85 per order, or FREE on qualifying orders and promotional offers.</p>",
    returnsHeading: "2. Returns & Exchanges Policy",
    returnsText: "<p>STUDIO EXTRAIT is committed to ensuring your satisfaction with every Extrait de Parfum purchase. Recognizing the subjective and personal nature of fine fragrances, we offer our customers the option to exchange or refund their goods within 7 days from the date of delivery.</p>\n<p><strong>Exchanges Policy:</strong> For exchanges, the customer will be responsible for the two-way courier fee (R85 x 2 = R170 total).</p>\n<p><strong>Refunds Policy:</strong> For refunds, the customer will be responsible for the one-way return courier fee (R85 x 1). If your refund is approved upon inspection, courier fees will be deducted from the final refund amount, and a net refund will be processed back to your original payment method. For refunds, we also reserve the right to apply a 15% administrative fee on the total order value.</p>\n<p><strong>Exchange & Refund Restrictions:</strong> In order to maintain fairness and prevent system abuse, STUDIO EXTRAIT reserves the right to impose limitations on the number of exchanges allowed per customer. Frequent and repetitive exchanges, viewed as an attempt to exploit the system for obtaining free samples, may be considered an abuse of our policy. Determination of such behavior remains at the sole discretion of STUDIO EXTRAIT management.</p>\n<p><strong>Damaged Merchandise:</strong> We place meticulous care in packaging our extraits to ensure pristine condition upon delivery. Should you encounter a damaged or leaking bottle upon arrival, please notify our team within 7 days of receipt via email at <strong>jadon@studioextrait.co.za</strong> or WhatsApp with a description and photographic evidence. Upon verification, an exchange will be facilitated and a replacement item dispatched, subject to stock availability.</p>",
    disclaimerHeading: "3. Product & Brand Disclaimer",
    disclaimerText: "<p>STUDIO EXTRAIT offers original Extraits de Parfum formulated independently and sold under its own brand label. While certain products are described as \"inspired by\" famous designer fragrances, this is done solely to provide an olfactory frame of reference for the scent profile.</p>\n<p>Our products are not associated with, endorsed by, sponsored by, or manufactured by the owners of any designer brands mentioned. Any reference to third-party trademarks or brand names is made strictly for descriptive purposes. All trademark rights remain the property of their respective owners.</p>\n<p>Our custom packaging and bottle designs are intentionally unique to STUDIO EXTRAIT and do not imitate or copy third-party designer logos or trade dress.</p>",
    supportPrompt: "TO INITIATE A RETURN OR EXCHANGE, CONTACT OUR SUPPORT TEAM:",
    supportEmail: "jadon@studioextrait.co.za"
  };

  // Convert raw textarea text (with line breaks/paragraphs) to clean HTML paragraphs
  function textToParagraphs(text) {
    if (!text) return "";
    const trimmed = text.trim();
    if (!trimmed) return "";
    // If user already wrote complete HTML tags (<p>...</p>)
    if (/^<p[\s>]/i.test(trimmed)) {
      return trimmed.replace(/\n\s*\n+/g, '</p><p>').replace(/(?<!>)\n/g, '<br>');
    }
    // Split by double newlines into paragraphs, and single newlines into <br>
    const paras = trimmed.split(/\n\s*\n+/);
    return paras.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }

  // Convert HTML back to clean editable text in textareas (preserving user gaps/linebreaks)
  function htmlToText(html) {
    if (!html) return "";
    let str = html;
    // Replace closing paragraph tags with double newlines
    str = str.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
    str = str.replace(/<p[^>]*>/gi, '');
    str = str.replace(/<\/p>/gi, '');
    // Replace <br> tags with single newlines
    str = str.replace(/<br\s*\/?>/gi, '\n');
    return str.trim();
  }

  function getPolicyData() {
    try {
      const cached = localStorage.getItem("minara_custom_text");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.returns_shipping) {
          return Object.assign({}, defaultPolicy, parsed.returns_shipping);
        }
      }
    } catch (e) {
      console.warn("Error reading cached returns_shipping text:", e);
    }
    return defaultPolicy;
  }

  function renderPolicy(data) {
    const p = data || getPolicyData();

    const shipHeadingEl = document.getElementById("policyShippingHeading");
    if (shipHeadingEl) shipHeadingEl.textContent = p.shippingHeading || defaultPolicy.shippingHeading;

    const shipTextEl = document.getElementById("policyShippingText");
    if (shipTextEl) shipTextEl.innerHTML = textToParagraphs(p.shippingText || defaultPolicy.shippingText);

    const retHeadingEl = document.getElementById("policyReturnsHeading");
    if (retHeadingEl) retHeadingEl.textContent = p.returnsHeading || defaultPolicy.returnsHeading;

    const retTextEl = document.getElementById("policyReturnsText");
    if (retTextEl) retTextEl.innerHTML = textToParagraphs(p.returnsText || defaultPolicy.returnsText);

    const discHeadingEl = document.getElementById("policyDisclaimerHeading");
    if (discHeadingEl) discHeadingEl.textContent = p.disclaimerHeading || defaultPolicy.disclaimerHeading;

    const discTextEl = document.getElementById("policyDisclaimerText");
    if (discTextEl) discTextEl.innerHTML = textToParagraphs(p.disclaimerText || defaultPolicy.disclaimerText);

    const supPromptEl = document.getElementById("policySupportPrompt");
    if (supPromptEl) supPromptEl.textContent = p.supportPrompt || defaultPolicy.supportPrompt;

    const supEmailEl = document.getElementById("policySupportEmail");
    if (supEmailEl) {
      const email = p.supportEmail || defaultPolicy.supportEmail;
      supEmailEl.href = "mailto:" + email;
      supEmailEl.textContent = email;
    }

    populateEditInputs(p);
  }

  function populateEditInputs(p) {
    if (document.getElementById("editShippingHeading")) document.getElementById("editShippingHeading").value = p.shippingHeading || defaultPolicy.shippingHeading;
    if (document.getElementById("editShippingText")) document.getElementById("editShippingText").value = htmlToText(p.shippingText || defaultPolicy.shippingText);
    if (document.getElementById("editReturnsHeading")) document.getElementById("editReturnsHeading").value = p.returnsHeading || defaultPolicy.returnsHeading;
    if (document.getElementById("editReturnsText")) document.getElementById("editReturnsText").value = htmlToText(p.returnsText || defaultPolicy.returnsText);
    if (document.getElementById("editDisclaimerHeading")) document.getElementById("editDisclaimerHeading").value = p.disclaimerHeading || defaultPolicy.disclaimerHeading;
    if (document.getElementById("editDisclaimerText")) document.getElementById("editDisclaimerText").value = htmlToText(p.disclaimerText || defaultPolicy.disclaimerText);
    if (document.getElementById("editSupportPrompt")) document.getElementById("editSupportPrompt").value = p.supportPrompt || defaultPolicy.supportPrompt;
    if (document.getElementById("editSupportEmail")) document.getElementById("editSupportEmail").value = p.supportEmail || defaultPolicy.supportEmail;
  }

  // Toggle Admin Edit Panel
  window.toggleAdminReturnsEditPanel = function () {
    const editPanel = document.getElementById("adminReturnsEditPanel");
    const toggleBtn = document.getElementById("adminToggleEditBtn");
    if (!editPanel) return;
    if (editPanel.style.display === "none" || !editPanel.style.display) {
      editPanel.style.display = "block";
      if (toggleBtn) toggleBtn.textContent = "✕ CLOSE EDITING";
      populateEditInputs(getPolicyData());
    } else {
      editPanel.style.display = "none";
      if (toggleBtn) toggleBtn.textContent = "⚙ EDIT POLICY TEXT";
    }
  };

  // Save Admin Returns Texts
  window.saveAdminReturnsTexts = async function () {
    const btn = document.getElementById("saveReturnsTextsBtn");
    const originalText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "PUBLISHING...";
    }

    let customText = {};
    try {
      const cached = localStorage.getItem("minara_custom_text");
      if (cached) customText = JSON.parse(cached);
    } catch (e) { }

    const rawShipText = document.getElementById("editShippingText") ? document.getElementById("editShippingText").value : "";
    const rawRetText = document.getElementById("editReturnsText") ? document.getElementById("editReturnsText").value : "";
    const rawDiscText = document.getElementById("editDisclaimerText") ? document.getElementById("editDisclaimerText").value : "";

    customText.returns_shipping = {
      shippingHeading: document.getElementById("editShippingHeading") ? document.getElementById("editShippingHeading").value : defaultPolicy.shippingHeading,
      shippingText: textToParagraphs(rawShipText || defaultPolicy.shippingText),
      returnsHeading: document.getElementById("editReturnsHeading") ? document.getElementById("editReturnsHeading").value : defaultPolicy.returnsHeading,
      returnsText: textToParagraphs(rawRetText || defaultPolicy.returnsText),
      disclaimerHeading: document.getElementById("editDisclaimerHeading") ? document.getElementById("editDisclaimerHeading").value : defaultPolicy.disclaimerHeading,
      disclaimerText: textToParagraphs(rawDiscText || defaultPolicy.disclaimerText),
      supportPrompt: document.getElementById("editSupportPrompt") ? document.getElementById("editSupportPrompt").value : defaultPolicy.supportPrompt,
      supportEmail: document.getElementById("editSupportEmail") ? document.getElementById("editSupportEmail").value : defaultPolicy.supportEmail
    };

    try {
      localStorage.setItem("minara_custom_text", JSON.stringify(customText));

      if (window.db && window.dbDoc && window.dbSetDoc) {
        await window.dbSetDoc(window.dbDoc(window.db, "settings", "custom_text"), customText);
      }

      if (!window.syncToGithubCallable) {
        try {
          const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js");
          const { getApp } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js");
          const app = getApp();
          const functions = getFunctions(app);
          window.syncToGithubCallable = httpsCallable(functions, "syncToGithub");
        } catch (fnErr) {
          console.warn("Failed to initialize syncToGithubCallable:", fnErr);
        }
      }

      if (window.syncToGithubCallable) {
        const res = await window.syncToGithubCallable({
          action: "saveCustomText",
          payload: customText
        });
        if (!res.data || !res.data.success) {
          throw new Error(res.data ? res.data.message : "GitHub sync failed");
        }
      }

      renderPolicy(customText.returns_shipping);
      alert("Returns & Shipping policy texts successfully published and synced to GitHub!");
      if (window.toggleAdminReturnsEditPanel) {
        window.toggleAdminReturnsEditPanel();
      }
    } catch (err) {
      console.error("Save returns policy texts failed:", err);
      alert("Error saving returns policy texts: " + (err.message || err));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  };

  // Robust check to display admin edit button
  function checkAndRevealAdmin(user) {
    const isCachedAdmin = localStorage.getItem("minara_auth_role") === "Admin";
    const isGlobalAdmin = window.currentUserRole === "Admin";
    const isUserEmailAdmin = (user && user.email === "sub2meboyi@gmail.com") || (window.currentUser && window.currentUser.email === "sub2meboyi@gmail.com");

    if (isCachedAdmin || isGlobalAdmin || isUserEmailAdmin) {
      const btnContainer = document.getElementById("adminEditBtnContainer");
      if (btnContainer) {
        btnContainer.style.display = "block";
      }
      populateEditInputs(getPolicyData());
      return true;
    }
    return false;
  }

  // Initial render from local cache / defaults
  function init() {
    renderPolicy();
    checkAndRevealAdmin();

    // Fetch latest JSON in background if available
    fetch('custom_text_settings.json?t=' + Date.now())
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.returns_shipping) {
          let customText = {};
          try {
            const cached = localStorage.getItem("minara_custom_text");
            if (cached) customText = JSON.parse(cached);
          } catch (e) { }
          customText.returns_shipping = data.returns_shipping;
          localStorage.setItem("minara_custom_text", JSON.stringify(customText));
          renderPolicy(data.returns_shipping);
        }
      })
      .catch(err => console.warn("Background fetch custom_text_settings failed:", err));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Listen to multiple events for guaranteed admin detection
  window.addEventListener("authRoleReady", (e) => {
    if (e && e.detail && (e.detail.role === "Admin" || (e.detail.user && e.detail.user.email === "sub2meboyi@gmail.com"))) {
      checkAndRevealAdmin(e.detail.user);
    }
  });

  window.addEventListener("load", () => checkAndRevealAdmin());

  // Polling interval fallback
  let checkCount = 0;
  const pollInterval = setInterval(() => {
    checkCount++;
    if (checkAndRevealAdmin() || checkCount > 25) {
      clearInterval(pollInterval);
    }
  }, 250);

  // Firebase auth state observer fallback
  (async function () {
    try {
      if (window.dbPromise) await window.dbPromise;
      const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js");
      const { getApp } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js");
      const app = getApp();
      const auth = getAuth(app);
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          if (user.email === "sub2meboyi@gmail.com") {
            try { localStorage.setItem("minara_auth_role", "Admin"); } catch(e){}
            window.currentUserRole = "Admin";
            checkAndRevealAdmin(user);
          } else {
            try {
              const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
              const db = getFirestore(app);
              const snap = await getDoc(doc(db, "users", user.uid));
              if (snap.exists() && snap.data().role === "Admin") {
                try { localStorage.setItem("minara_auth_role", "Admin"); } catch(e){}
                window.currentUserRole = "Admin";
                checkAndRevealAdmin(user);
              }
            } catch(err) {}
          }
        }
      });
    } catch (e) {
      // Ignore if already initialized
    }
  })();
})();
