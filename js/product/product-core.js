// Studio Extrait - Product Details Core Coordinator & Data Loader Module

(function() {
  let doc, getDoc, collection, addDoc, getDocs, query, where, orderBy;

  const setupFirestoreHelpers = async () => {
    if (window.dbPromise) {
      await window.dbPromise;
    }
    doc = window.dbDoc;
    getDoc = window.dbGetDoc;
    collection = window.dbCollection;
    addDoc = window.dbAddDoc;
    getDocs = window.dbGetDocs;
    query = window.dbQuery;
    where = window.dbWhere;
    orderBy = window.dbOrderBy;
  };

  let activeCatalogFragrances = [];
  let reviewsMap = {};

  // Scroll to reviews section
  window.scrollToReviews = function () {
    const reviewsSec = document.querySelector(".reviews-section-wrapper");
    if (reviewsSec) {
      reviewsSec.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Convert raw textarea text (with line breaks/paragraphs) to clean HTML paragraphs
  function formatParagraphs(text) {
    if (!text) return "";
    const trimmed = text.trim();
    if (!trimmed) return "";
    if (/^<p[\s>]/i.test(trimmed)) {
      return trimmed.replace(/\n\s*\n+/g, '</p><p>').replace(/(?<!>)\n/g, '<br>');
    }
    const paras = trimmed.split(/\n\s*\n+/);
    return paras.map(p => `<p style="margin-bottom: 10px;">${p.replace(/\n/g, '<br>')}</p>`).join('');
  }

  // Convert HTML back to clean editable text in textareas (preserving user gaps/linebreaks)
  function htmlToText(html) {
    if (!html) return "";
    let str = html;
    str = str.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
    str = str.replace(/<p[^>]*>/gi, '');
    str = str.replace(/<\/p>/gi, '');
    str = str.replace(/<br\s*\/?>/gi, '\n');
    return str.trim();
  }

  // Admin Accordion Texts Editor logic
  window.toggleAdminEditPanel = function () {
    const editPanel = document.getElementById("adminAccordionEditPanel");
    const toggleBtn = document.getElementById("adminToggleEditBtn");
    if (!editPanel) return;
    if (editPanel.style.display === "none" || !editPanel.style.display) {
      editPanel.style.display = "block";
      if (toggleBtn) toggleBtn.textContent = "✕ CLOSE EDITING";
      populateProductEditInputs();
    } else {
      editPanel.style.display = "none";
      if (toggleBtn) toggleBtn.textContent = "⚙ EDIT PRODUCT TEXT";
    }
  };

  function populateProductEditInputs() {
    let customText = {};
    try {
      const cached = localStorage.getItem("minara_custom_text");
      if (cached) customText = JSON.parse(cached);
    } catch (e) { }
    const accs = customText.accordions || {};
    if (document.getElementById("editWearingOccasion")) document.getElementById("editWearingOccasion").value = htmlToText(accs.wearingOccasion || "Crafted with high oil concentration for excellent 8-12 hour longevity and powerful projection. Ideal for daily signatures, special nights out, or seasonal versatility.");
    if (document.getElementById("editHonestInspired")) document.getElementById("editHonestInspired").value = htmlToText(accs.honestComparisonInspired || "Our expert formulation matches <strong>{brand}</strong>'s olfactory profile with a 99% similarity index. Enjoy the identical premium scent projection and longevity (8-12 hours) without paying the designer markup brand tax.");
    if (document.getElementById("editHonestNonInspired")) document.getElementById("editHonestNonInspired").value = htmlToText(accs.honestComparisonNonInspired || "Our expert formulation matches the designer scent's profile at a 99% olfactory match. Experience identical quality and longevity (8-12 hours) without paying the designer brand premium.");
    if (document.getElementById("editIngredients")) document.getElementById("editIngredients").value = htmlToText(accs.ingredients || "Alcohol Denat., Fragrance/Parfum, Water/Aqua/Eau, Limonene, Linalool, Coumarin, Citral, Benzyl Benzoate, Geraniol, Benzyl Salicylate.");
    if (document.getElementById("editShippingReturns")) document.getElementById("editShippingReturns").value = htmlToText(accs.shippingReturns || "Free nationwide shipping across South Africa. All orders are processed and dispatched within 24 business hours. Not completely in love? Enjoy a 30-day money-back guarantee with easy, straightforward returns.");
  }

  window.saveAdminAccordionTexts = async function () {
    const btn = document.getElementById("saveAccordionTextsBtn");
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

    const rawWearing = document.getElementById("editWearingOccasion") ? document.getElementById("editWearingOccasion").value : "";
    const rawInspired = document.getElementById("editHonestInspired") ? document.getElementById("editHonestInspired").value : "";
    const rawNonInspired = document.getElementById("editHonestNonInspired") ? document.getElementById("editHonestNonInspired").value : "";
    const rawIngredients = document.getElementById("editIngredients") ? document.getElementById("editIngredients").value : "";
    const rawShipping = document.getElementById("editShippingReturns") ? document.getElementById("editShippingReturns").value : "";

    customText.accordions = {
      wearingOccasion: rawWearing.trim(),
      honestComparisonInspired: rawInspired.trim(),
      honestComparisonNonInspired: rawNonInspired.trim(),
      ingredients: rawIngredients.trim(),
      shippingReturns: rawShipping.trim()
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

      alert("Accordion texts successfully published and synced to GitHub!");
      if (window.product && typeof window.swapContentGlobal === 'function') {
        window.swapContentGlobal(window.product);
      }
      if (window.toggleAdminEditPanel) {
        window.toggleAdminEditPanel();
      }
    } catch (err) {
      console.error("Save accordion texts failed:", err);
      alert("Error saving accordion texts: " + (err.message || err));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  };

  function checkAndRevealProductAdmin() {
    const isCachedAdmin = localStorage.getItem("minara_auth_role") === "Admin";
    const isGlobalAdmin = window.currentUserRole === "Admin";

    if (isCachedAdmin || isGlobalAdmin) {
      const btnContainer = document.getElementById("adminEditBtnContainer");
      if (btnContainer) btnContainer.style.display = "block";
      populateProductEditInputs();
      return true;
    }
    return false;
  }

  // Listen to multiple events for guaranteed admin detection
  window.addEventListener("authRoleReady", (e) => {
    if (e && e.detail && e.detail.role === "Admin") {
      checkAndRevealProductAdmin();
    }
  });

  window.addEventListener("load", checkAndRevealProductAdmin);

  // Polling interval fallback
  let prodCheckCount = 0;
  const prodPollInterval = setInterval(() => {
    prodCheckCount++;
    if (checkAndRevealProductAdmin() || prodCheckCount > 25) {
      clearInterval(prodPollInterval);
    }
  }, 250);

  // Accordions Collapse / Expand
  window.toggleAccordion = function (element) {
    const content = element.nextElementSibling;
    const icon = element.querySelector('.accordion-icon');
    const allItems = document.querySelectorAll('.accordion-content');
    const allIcons = document.querySelectorAll('.accordion-icon');

    allItems.forEach((item, index) => {
      if (item !== content && item.classList.contains('active')) {
        item.classList.remove('active');
        allIcons[index].classList.remove('active');
      }
    });

    content.classList.toggle('active');
    icon.classList.toggle('active');
  };

  // Capitalize Brand Name helper
  function formatBrandName(brandName) {
    if (!brandName) return "";
    return brandName.replace(/\w\S*/g, (txt) => {
      const lower = txt.toLowerCase();
      if (lower === 'jpg') return 'JPG';
      if (lower === 'le') return 'Le';
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }
  window.formatBrandName = formatBrandName;

  // Render Scent Profile & Fragrance Pyramid (Notes Breakdown)
  function renderProductScentProfile(p, selectedBundleScents, catalogList) {
    const container = document.getElementById('productScentProfileContainer');
    if (!container || !p) return;
    container.innerHTML = "";

    const topBottleSvg = `
      <svg viewBox="0 0 26 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="9.5" y="1" width="7" height="4.5" rx="0.8" stroke="#000" stroke-width="1.3" fill="none"/>
        <rect x="11.5" y="5.5" width="3" height="2" fill="#000"/>
        <rect x="2.5" y="7.5" width="21" height="26.5" rx="1.5" stroke="#000" stroke-width="1.3" fill="none"/>
        <path d="M 3.8 8.2 L 22.2 8.2 A 1 1 0 0 1 23 9 L 23 16.5 L 3 16.5 L 3 9 A 1 1 0 0 1 3.8 8.2 Z" fill="#000"/>
        <line x1="2.5" y1="16.5" x2="23.5" y2="16.5" stroke="#000" stroke-width="1.1"/>
        <line x1="2.5" y1="25" x2="23.5" y2="25" stroke="#000" stroke-width="1.1"/>
      </svg>
    `;

    const middleBottleSvg = `
      <svg viewBox="0 0 26 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="9.5" y="1" width="7" height="4.5" rx="0.8" stroke="#000" stroke-width="1.3" fill="none"/>
        <rect x="11.5" y="5.5" width="3" height="2" fill="#000"/>
        <rect x="2.5" y="7.5" width="21" height="26.5" rx="1.5" stroke="#000" stroke-width="1.3" fill="none"/>
        <rect x="3.2" y="16.5" width="19.6" height="8.5" fill="#000"/>
        <line x1="2.5" y1="16.5" x2="23.5" y2="16.5" stroke="#000" stroke-width="1.1"/>
        <line x1="2.5" y1="25" x2="23.5" y2="25" stroke="#000" stroke-width="1.1"/>
      </svg>
    `;

    const baseBottleSvg = `
      <svg viewBox="0 0 26 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="9.5" y="1" width="7" height="4.5" rx="0.8" stroke="#000" stroke-width="1.3" fill="none"/>
        <rect x="11.5" y="5.5" width="3" height="2" fill="#000"/>
        <rect x="2.5" y="7.5" width="21" height="26.5" rx="1.5" stroke="#000" stroke-width="1.3" fill="none"/>
        <path d="M 3 25 L 23 25 L 23 32.2 A 1 1 0 0 1 22.2 33.2 L 3.8 33.2 A 1 1 0 0 1 3 32.2 Z" fill="#000"/>
        <line x1="2.5" y1="16.5" x2="23.5" y2="16.5" stroke="#000" stroke-width="1.1"/>
        <line x1="2.5" y1="25" x2="23.5" y2="25" stroke="#000" stroke-width="1.1"/>
      </svg>
    `;

    window.bundleScentActiveIndex = typeof window.bundleScentActiveIndex === 'number' ? window.bundleScentActiveIndex : 0;

    window.switchBundleScentView = function (idx) {
      window.bundleScentActiveIndex = idx;
      if (window.product) {
        renderProductScentProfile(
          window.product,
          window.selectedBundleScents || window.cachedBundleScents,
          window.activeCatalogFragrances || window.cachedCatalogList
        );
      }
    };

    // If product is a Bundle product, render the interactive tab switcher + standard single item view
    if (p.isBundle) {
      container.style.display = "block";
      if (selectedBundleScents) window.cachedBundleScents = selectedBundleScents;
      if (catalogList) window.cachedCatalogList = catalogList;

      let bundleScents = selectedBundleScents || window.cachedBundleScents || window.selectedBundleScents;
      if (!bundleScents) {
        try {
          const pending = JSON.parse(sessionStorage.getItem("bundle_selections_pending") || "{}");
          const bundleSize = Number(p.bundleSize) || 2;
          bundleScents = Array(bundleSize).fill(null);
          Object.keys(pending).forEach(k => {
            const idx = Number(k);
            if (idx >= 0 && idx < bundleSize) {
              bundleScents[idx] = pending[idx];
            }
          });
        } catch (e) {
          bundleScents = [];
        }
      }

      let activeList = catalogList || window.activeCatalogFragrances || window.cachedCatalogList || [];
      if (!activeList || activeList.length === 0) {
        try {
          const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
          activeList = localProds.filter(prod => prod.status === "Active" && prod.isBundle !== true && prod.isBundle !== "true");
        } catch (e) { }
      }

      const bundleSize = Number(p.bundleSize) || (bundleScents ? bundleScents.length : 2) || 2;
      const validItems = [];

      if (Array.isArray(bundleScents)) {
        bundleScents.forEach((item, slotIdx) => {
          if (item) {
            let fullData = activeList.find(c => c.id === item.id);
            if (!fullData && item.scentProfile) fullData = item;
            if (!fullData) {
              try {
                const minaraProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
                fullData = minaraProds.find(c => c.id === item.id);
              } catch (e) {}
            }
            if (!fullData) fullData = item;

            validItems.push({
              slotIndex: slotIdx,
              slotNumber: slotIdx + 1,
              item: fullData,
              inspiredBy: item.inspiredBy || (fullData.name ? (fullData.name.match(/Inspired\s+by\s+(.+)/i) ? fullData.name.match(/Inspired\s+by\s+(.+)/i)[1] : "") : "")
            });
          }
        });
      }

      if (validItems.length === 0) {
        container.innerHTML = `
          <div class="bundle-scent-empty-notice">
            Select your fragrances above to view their scent profile & olfactory notes
          </div>
        `;
        return;
      }

      if (window.bundleScentActiveIndex >= validItems.length) {
        window.bundleScentActiveIndex = 0;
      }

      let tabsHtml = "";
      if (validItems.length > 1) {
        tabsHtml = `<div class="bundle-scent-switcher-tabs">`;
        validItems.forEach((entry, idx) => {
          const prod = entry.item;
          const nameTitle = (prod.nameShort || prod.name || `Fragrance #${entry.slotNumber}`).toUpperCase();
          let inspiredSubtitle = "";
          if (entry.inspiredBy) {
            const formatted = typeof window.formatBrandName === 'function' ? window.formatBrandName(entry.inspiredBy) : entry.inspiredBy;
            inspiredSubtitle = `INSPIRED BY ${formatted.toUpperCase()}`;
          } else if (prod.flair) {
            inspiredSubtitle = prod.flair.toUpperCase();
          }
          const isActive = idx === window.bundleScentActiveIndex;
          tabsHtml += `
            <button type="button" class="bundle-scent-tab ${isActive ? 'active' : ''}" onclick="window.switchBundleScentView(${idx})">
              <span class="bundle-tab-tag">BOTTLE ${entry.slotNumber} OF ${bundleSize}</span>
              <span class="bundle-tab-title">${nameTitle}</span>
              ${inspiredSubtitle ? `<span class="bundle-tab-sub">${inspiredSubtitle}</span>` : ''}
            </button>
          `;
        });
        tabsHtml += `</div>`;
      }

      const activeEntry = validItems[window.bundleScentActiveIndex] || validItems[0];
      const prod = activeEntry.item;
      const profile = prod.scentProfile || {};
      const keyNotes = profile.keyNotes || [];
      const topNotes = profile.topNotes || "";
      const topNotesDesc = profile.topNotesDesc || "The first notes you smell";
      const middleNotes = profile.middleNotes || "";
      const middleNotesDesc = profile.middleNotesDesc || "The heart of the perfume";
      const baseNotes = profile.baseNotes || "";
      const baseNotesDesc = profile.baseNotesDesc || "The notes that linger all day";

      let keyNotesHtml = "";
      if (keyNotes.length > 0) {
        keyNotesHtml = `<div class="scent-key-notes-row">`;
        keyNotes.forEach(note => {
          const noteName = typeof note === "string" ? note : (note.name || "");
          let noteIcon = typeof note === "string" ? `Perfume Note Icons/${note.replace(/\s+/g, '_')}.webp` : (note.icon || "");
          if (!noteIcon && noteName) {
            noteIcon = `Perfume Note Icons/${noteName.replace(/\s+/g, '_')}.webp`;
          }
          keyNotesHtml += `
            <div class="scent-note-item">
              <div class="scent-note-icon-wrap">
                <img src="${noteIcon}" alt="${noteName}" loading="lazy" onerror="this.style.display='none'">
              </div>
              <span class="scent-note-label">${noteName}</span>
            </div>
          `;
        });
        keyNotesHtml += `</div>`;
      }

      let pyramidHtml = "";
      if (topNotes || middleNotes || baseNotes) {
        pyramidHtml = `<div class="scent-pyramid-container">`;
        if (topNotes) {
          pyramidHtml += `
            <div class="scent-pyramid-card">
              <div class="scent-pyramid-icon">${topBottleSvg}</div>
              <div class="scent-pyramid-content">
                <div class="scent-pyramid-header">
                  <span class="scent-tier-badge">TOP</span>
                  <span class="scent-tier-desc">— ${topNotesDesc}</span>
                </div>
                <div class="scent-tier-notes">${topNotes}</div>
              </div>
            </div>
          `;
        }
        if (middleNotes) {
          pyramidHtml += `
            <div class="scent-pyramid-card">
              <div class="scent-pyramid-icon">${middleBottleSvg}</div>
              <div class="scent-pyramid-content">
                <div class="scent-pyramid-header">
                  <span class="scent-tier-badge">MIDDLE</span>
                  <span class="scent-tier-desc">— ${middleNotesDesc}</span>
                </div>
                <div class="scent-tier-notes">${middleNotes}</div>
              </div>
            </div>
          `;
        }
        if (baseNotes) {
          pyramidHtml += `
            <div class="scent-pyramid-card">
              <div class="scent-pyramid-icon">${baseBottleSvg}</div>
              <div class="scent-pyramid-content">
                <div class="scent-pyramid-header">
                  <span class="scent-tier-badge">BASE</span>
                  <span class="scent-tier-desc">— ${baseNotesDesc}</span>
                </div>
                <div class="scent-tier-notes">${baseNotes}</div>
              </div>
            </div>
          `;
        }
        pyramidHtml += `</div>`;
      }

      container.innerHTML = tabsHtml + keyNotesHtml + pyramidHtml;
      return;
    }

    const profile = p.scentProfile || {};
    const keyNotes = profile.keyNotes || [];
    const topNotes = profile.topNotes || "";
    const topNotesDesc = profile.topNotesDesc || "The first notes you smell";
    const middleNotes = profile.middleNotes || "";
    const middleNotesDesc = profile.middleNotesDesc || "The heart of the perfume";
    const baseNotes = profile.baseNotes || "";
    const baseNotesDesc = profile.baseNotesDesc || "The notes that linger all day";

    if (keyNotes.length === 0 && !topNotes && !middleNotes && !baseNotes) {
      container.style.display = "none";
      return;
    }
    container.style.display = "block";

    let html = "";

    if (keyNotes.length > 0) {
      html += `<div class="scent-key-notes-row">`;
      keyNotes.forEach(note => {
        const noteName = typeof note === "string" ? note : (note.name || "");
        let noteIcon = typeof note === "string" ? `Perfume Note Icons/${note.replace(/\s+/g, '_')}.webp` : (note.icon || "");
        if (!noteIcon && noteName) {
          noteIcon = `Perfume Note Icons/${noteName.replace(/\s+/g, '_')}.webp`;
        }
        html += `
          <div class="scent-note-item">
            <div class="scent-note-icon-wrap">
              <img src="${noteIcon}" alt="${noteName}" loading="lazy" onerror="this.style.display='none'">
            </div>
            <span class="scent-note-label">${noteName}</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    if (topNotes || middleNotes || baseNotes) {
      html += `<div class="scent-pyramid-container">`;

      if (topNotes) {
        html += `
          <div class="scent-pyramid-card">
            <div class="scent-pyramid-icon">${topBottleSvg}</div>
            <div class="scent-pyramid-content">
              <div class="scent-pyramid-header">
                <span class="scent-tier-badge">TOP</span>
                <span class="scent-tier-desc">— ${topNotesDesc}</span>
              </div>
              <div class="scent-tier-notes">${topNotes}</div>
            </div>
          </div>
        `;
      }

      if (middleNotes) {
        html += `
          <div class="scent-pyramid-card">
            <div class="scent-pyramid-icon">${middleBottleSvg}</div>
            <div class="scent-pyramid-content">
              <div class="scent-pyramid-header">
                <span class="scent-tier-badge">MIDDLE</span>
                <span class="scent-tier-desc">— ${middleNotesDesc}</span>
              </div>
              <div class="scent-tier-notes">${middleNotes}</div>
            </div>
          </div>
        `;
      }

      if (baseNotes) {
        html += `
          <div class="scent-pyramid-card">
            <div class="scent-pyramid-icon">${baseBottleSvg}</div>
            <div class="scent-pyramid-content">
              <div class="scent-pyramid-header">
                <span class="scent-tier-badge">BASE</span>
                <span class="scent-tier-desc">— ${baseNotesDesc}</span>
              </div>
              <div class="scent-tier-notes">${baseNotes}</div>
            </div>
          </div>
        `;
      }

      html += `</div>`;
    }

    container.innerHTML = html;
  }
  window.renderProductScentProfile = renderProductScentProfile;

  async function initProductDetails() {
    const addToBagBtn = document.querySelector('.add-to-cart') || document.getElementById('addToBagButton') || document.querySelector('.add-to-bag-btn');

    // Fetch reviews.json to build ratings database
    try {
      const res = await fetch("reviews.json?t=" + Date.now());
      if (res.ok) {
        const allReviews = await res.json();
        try {
          const sessionReviews = JSON.parse(sessionStorage.getItem("my_session_reviews") || "[]");
          sessionReviews.forEach(sr => {
            const isDuplicate = allReviews.some(pr =>
              pr.productId === sr.productId &&
              pr.name === sr.name &&
              pr.text === sr.text &&
              pr.rating === sr.rating
            );
            if (!isDuplicate) {
              allReviews.push(sr);
            }
          });
        } catch (e) { }

        allReviews.forEach(r => {
          if (!reviewsMap[r.productId]) {
            reviewsMap[r.productId] = { total: 0, count: 0 };
          }
          reviewsMap[r.productId].total += Number(r.rating || 5);
          reviewsMap[r.productId].count += 1;
        });
      }
    } catch (err) {
      console.warn("Failed to build reviewsMap:", err);
    }

    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    const bundleView = params.get('bundleView') === 'true';
    const bundleParent = params.get('bundleParent');
    const bundleSlot = params.get('bundleSlot');

    if (!productId) {
      console.log("No product ID specified in query parameter.");
      document.title = "Studio Extrait – Product Detail";
      const titleEl = document.querySelector('.product-title');
      if (titleEl) titleEl.innerHTML = "Product Detail";
      const priceEl = document.querySelector('.product-price');
      if (priceEl) priceEl.innerHTML = "";
      const descEl = document.querySelector('.desc');
      if (descEl) descEl.innerHTML = "Please select a product from the catalog.";
      const track = document.querySelector('.slider-track');
      if (track) track.innerHTML = `<img src="Studio Extrait Icon Svg only logo.svg" alt="No product selected">`;
      if (addToBagBtn) {
        addToBagBtn.disabled = true;
        addToBagBtn.style.opacity = "0.5";
      }
      return;
    }

    console.log("Loading custom dynamic product details for: " + productId);

    let product = null;

    // 1. Try loading from localStorage first (for instant load)
    try {
      const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
      product = localProds.find(p => p.id === productId);
      if (product && !product.hasOwnProperty('isBundle')) {
        product.isBundle = false;
        product.bundleSize = 0;
      }
      activeCatalogFragrances = localProds.filter(p => p.status === "Active" && p.isBundle !== true && p.isBundle !== "true");
    } catch (e) {
      console.error("Local storage product read failed:", e);
    }

    const setupBundleSelectors = (p) => {
      if (typeof window.setupBundleSelectors === 'function') {
        window.setupBundleSelectors(p, activeCatalogFragrances, reviewsMap, formatBrandName);
      }
    };

    const renderBottleCustomisation = (p) => {
      if (typeof window.renderBottleCustomisation === 'function') {
        window.renderBottleCustomisation(p);
      }
    };

    const swapContent = (p) => {
      if (!p) return;
      window.product = p;
      const formatPrice = window.formatPrice || (val => {
        if (val === undefined || val === null || isNaN(val)) return "0";
        return Math.round(Number(val)).toString();
      });
      const formatRetailPrice = val => {
        if (val === undefined || val === null || isNaN(val)) return "0";
        const cleanVal = Math.round(Number(val)).toString();
        return cleanVal.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      };

      const flairEl = document.querySelector('.product-flair');
      if (flairEl) flairEl.style.display = 'none';

      let rawName = p.name ? p.name.replace(/<br>/gi, ' ').replace(/\s+/g, ' ').trim() : "";
      const match = rawName.match(/Inspired\s+by\s+(.+)/i);
      let isInspired = match || (p.id && p.id.startsWith("inspired-by-"));
      let inspiredFragranceName = "";
      if (isInspired) {
        inspiredFragranceName = match ? match[1] : rawName;
      }

      const nameShortEl = document.querySelector('.product-name-short');
      if (nameShortEl) {
        let nameText = (p.nameShort || p.name).toUpperCase();
        if (p.isBundle) {
          nameText += " BUNDLE";
        }
        nameShortEl.textContent = nameText;
        nameShortEl.style.display = 'block';
      }

      const badgeInspired = document.getElementById('badgeInspired');
      if (badgeInspired) {
        if (isInspired) {
          badgeInspired.textContent = `Inspired by ${formatBrandName(inspiredFragranceName)}`;
          badgeInspired.style.display = 'inline-flex';
        } else {
          badgeInspired.style.display = 'none';
        }
      }

      const badgeGender = document.getElementById('badgeGender');
      if (badgeGender) {
        if (p.isBundle) {
          badgeGender.style.display = 'none';
        } else if (p.flair) {
          badgeGender.textContent = p.flair;
          badgeGender.style.display = 'inline-flex';
        } else {
          const idLower = (p.id || "").toLowerCase();
          const nameLower = (p.name || "").toLowerCase();
          const flairLower = (p.flair || "").toLowerCase();
          if (idLower.includes("women") || nameLower.includes("women") || flairLower.includes("women") || flairLower.includes("her")) {
            badgeGender.textContent = "Women's";
          } else if (idLower.includes("men") || nameLower.includes("men") || flairLower.includes("men") || flairLower.includes("him")) {
            badgeGender.textContent = "Men's";
          } else {
            badgeGender.textContent = "Unisex";
          }
          badgeGender.style.display = 'inline-flex';
        }
      }

      document.title = (p.name || "Product") + " – Studio Extrait";

      const titleEl = document.querySelector('.product-title');
      if (titleEl) {
        if (isInspired) {
          titleEl.textContent = `INSPIRED BY ${formatBrandName(inspiredFragranceName).toUpperCase()}`;
          titleEl.style.cssText = "font-family: inherit; font-size: 9.5px; font-weight: 500; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 0px; margin-bottom: 2px; color: #000; text-align: left; display: block;";
        } else if (p.name && p.name !== p.nameShort) {
          titleEl.textContent = p.name.toUpperCase();
          titleEl.style.display = 'block';
        } else {
          titleEl.style.display = 'none';
        }
      }

      const priceEl = document.querySelector('.product-price');
      const discountBadge = document.getElementById('discountBadge');
      const retailPriceRow = document.getElementById('retailPriceRow');
      const comparisonNote = document.getElementById('comparisonNote');

      if (priceEl && p.price !== undefined) {
        const hasDiscount = localStorage.getItem("minara_discount_5") === "active";
        if (hasDiscount) {
          priceEl.textContent = `R${formatPrice(Math.round(p.price * 0.95))}`;
          if (discountBadge) {
            discountBadge.textContent = "SAVE 5%";
            discountBadge.style.display = 'inline-flex';
          }
        } else {
          priceEl.textContent = `R${formatPrice(p.price)}`;
          if (discountBadge) discountBadge.style.display = 'none';
        }

        if (retailPriceRow && p.retailPrice) {
          const retailPriceValEl = retailPriceRow.querySelector('.product-retail-price');
          if (retailPriceValEl) {
            retailPriceValEl.textContent = `${p.isBundle ? 'Bundle Value' : 'Designer Equivalent'}: ${window.formatRetailLabel ? window.formatRetailLabel(p.retailPrice) : ('R' + formatRetailPrice(p.retailPrice))}`;
          }
          retailPriceRow.style.display = 'flex';

          if (comparisonNote) {
            const rNum = window.getRetailNumber ? window.getRetailNumber(p.retailPrice) : (Number(p.retailPrice) || 0);
            const savingsPercent = rNum > 0 ? Math.round((1 - p.price / rNum) * 100) : 0;
            if (savingsPercent > 0) {
              comparisonNote.textContent = `Save ${savingsPercent}% compared to designer retail`;
              comparisonNote.style.display = 'inline';
            } else {
              comparisonNote.style.display = 'none';
            }
          }
        } else {
          if (retailPriceRow) retailPriceRow.style.display = 'none';
        }
      }

      let customText = {};
      try {
        const cached = localStorage.getItem("minara_custom_text");
        if (cached) customText = JSON.parse(cached);
      } catch (e) { }
      const accs = customText.accordions || {};

      const wearingOccasion = document.getElementById('wearingOccasion');
      if (wearingOccasion) {
        wearingOccasion.innerHTML = formatParagraphs(accs.wearingOccasion || "Crafted with high oil concentration for excellent 8-12 hour longevity and powerful projection. Ideal for daily signatures, special nights out, or seasonal versatility.");
      }

      const honestComparisonText = document.getElementById('honestComparisonText');
      if (honestComparisonText) {
        const match = p.name ? p.name.match(/Inspired\s+by\s+(.+)/i) : null;
        if (match || (p.id && p.id.startsWith("inspired-by-"))) {
          const fragranceName = match ? match[1] : p.name;
          const inspiredTemplate = accs.honestComparisonInspired || "Our expert formulation matches <strong>{brand}</strong>'s olfactory profile with a 99% similarity index. Enjoy the identical premium scent projection and longevity (8-12 hours) without paying the designer markup brand tax.";
          honestComparisonText.innerHTML = formatParagraphs(inspiredTemplate.replace("{brand}", formatBrandName(fragranceName)));
        } else {
          honestComparisonText.innerHTML = formatParagraphs(accs.honestComparisonNonInspired || "Our expert formulation matches the designer scent's profile at a 99% olfactory match. Experience identical quality and longevity (8-12 hours) without paying the designer brand premium.");
        }
      }

      const ingredientsText = document.getElementById('ingredientsText');
      if (ingredientsText) {
        const ingContent = accs.ingredients || "Alcohol Denat., Fragrance/Parfum, Water/Aqua/Eau, Limonene, Linalool, Coumarin, Citral, Benzyl Benzoate, Geraniol, Benzyl Salicylate.";
        ingredientsText.innerHTML = `<strong>INGREDIENTS:</strong> ` + formatParagraphs(ingContent).replace(/^<p[^>]*>/, '').replace(/<\/p>$/, '');
      }

      renderProductScentProfile(p);

      const shippingReturnsText = document.getElementById('shippingReturnsText');
      if (shippingReturnsText) {
        shippingReturnsText.innerHTML = formatParagraphs(accs.shippingReturns || "Free nationwide shipping across South Africa. All orders are processed and dispatched within 24 business hours. Not completely in love? Enjoy a 30-day money-back guarantee with easy, straightforward returns.");
      }

      checkAndRevealProductAdmin();

      // Stock shown as an overlay badge on the product image block (skipped for bundles)
      const stockBlock = document.getElementById('slider') || document.querySelector('.slider');
      if (false) { // stock badge removed from big image — shown only on the selector thumbnails (product-customisation.js)
        if (!stockBlock.style.position || stockBlock.style.position === 'static') {
          stockBlock.style.position = 'relative';
        }
        const prevBadge = stockBlock.querySelector('.se-stock-badge');
        if (prevBadge) prevBadge.remove();

        let badgeText = '';
        let badgeBg = '';
        if (p.stock <= 0) {
          badgeText = 'OUT OF STOCK';
          badgeBg = 'rgba(0,0,0,0.85)';
        } else if (p.stock <= 3) {
          badgeText = `ONLY ${p.stock} LEFT`;
          badgeBg = 'rgba(180,83,9,0.95)';
        }
        if (badgeText) {
          const badge = document.createElement('div');
          badge.className = 'se-stock-badge';
          badge.style.cssText = 'position:absolute; bottom:0; left:0; right:0; background:' + badgeBg + '; color:#fff; font-size:7px; font-weight:bold; text-align:center; padding:2px 0; text-transform:uppercase; letter-spacing:0.5px; z-index:2;';
          badge.textContent = badgeText;
          stockBlock.appendChild(badge);
        }
      }

      const deliveryTimer = document.getElementById('deliveryTimer');
      const deliveryDates = document.getElementById('deliveryDates');
      if (deliveryTimer && deliveryDates) {
        const updateCountdown = () => {
          const now = new Date();
          const target = new Date();
          target.setHours(17, 0, 0, 0);
          if (now > target) {
            target.setDate(target.getDate() + 1);
          }
          const diffMs = target - now;
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          deliveryTimer.textContent = `${hours}h ${minutes}m`;
        };
        updateCountdown();

        const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const formatDate = (d) => `${monthsShort[d.getMonth()]} ${d.getDate()}`;
        const formatDateRange = (ds, de) => {
          if (ds.getMonth() === de.getMonth()) {
            return `${monthsShort[ds.getMonth()]} ${ds.getDate()}-${de.getDate()}`;
          } else {
            return `${monthsShort[ds.getMonth()]} ${ds.getDate()} - ${monthsShort[de.getMonth()]} ${de.getDate()}`;
          }
        };

        const d1 = new Date();
        const d2 = new Date();
        if (d1.getHours() >= 17) {
          d2.setDate(d2.getDate() + 1);
        }

        const d3_start = new Date();
        d3_start.setDate(d2.getDate() + 2);
        const d3_end = new Date();
        d3_end.setDate(d2.getDate() + 4);

        const t1 = document.getElementById('timelineDate1');
        const t2 = document.getElementById('timelineDate2');
        const t3 = document.getElementById('timelineDate3');
        if (t1) t1.textContent = formatDate(d1);
        if (t2) t2.textContent = formatDate(d2);
        if (t3) t3.textContent = formatDateRange(d3_start, d3_end);

        deliveryDates.textContent = `${formatDate(d3_start)} to ${formatDate(d3_end)}`;
      }

      const initialGalleryImages = p.galleryImages && Array.isArray(p.galleryImages) && p.galleryImages.length > 0
        ? p.galleryImages
        : (p.image ? (p.image.startsWith('data:') ? [p.image] : p.image.split(',').map(s => s.trim()).filter(Boolean)) : []);
      if (typeof window.renderProductGallery === 'function') {
        window.renderProductGallery(initialGalleryImages, p);
      }

      const descEl = document.querySelector('.desc');
      if (descEl) {
        descEl.innerHTML = "";
        const lines = (p.description || "").split('\n');
        lines.forEach((line, index) => {
          descEl.appendChild(document.createTextNode(line));
          if (index < lines.length - 1) {
            descEl.appendChild(document.createElement('br'));
          }
        });
      }

      const sizeContainer = document.getElementById('sizePickerContainer');
      const sizeOptionsDiv = document.getElementById('sizePickerOptions');
      const bundleContainer = document.getElementById('bundlePickerContainer');

      if (sizeContainer) sizeContainer.style.display = "none";
      if (bundleContainer) bundleContainer.style.display = "none";

      if (addToBagBtn) {
        addToBagBtn.removeAttribute('onclick');
        addToBagBtn.disabled = false;
        addToBagBtn.style.opacity = "";
        addToBagBtn.style.cursor = "";

        if (bundleView) {
          addToBagBtn.innerHTML = "ADD TO BUNDLE";

          const oldBackLink = document.getElementById("returnToBundleLink");
          if (oldBackLink) oldBackLink.remove();

          const returnLink = document.createElement("a");
          returnLink.id = "returnToBundleLink";
          returnLink.href = `template product.html?id=${bundleParent}`;
          returnLink.textContent = "← RETURN TO BUNDLE SELECTION";
          returnLink.style.cssText = "display: block; text-align: center; margin-top: 15px; font-size: 10px; font-weight: bold; letter-spacing: 1px; color: #1106e8; text-decoration: underline; text-transform: uppercase;";

          addToBagBtn.parentNode.insertBefore(returnLink, addToBagBtn.nextSibling);

          addToBagBtn.onclick = () => {
            let inspiredByText = "";
            const inspiredMatch = p.name ? p.name.match(/Inspired\s+by\s+(.+)/i) : null;
            if (inspiredMatch) {
              inspiredByText = inspiredMatch[1];
            } else if (p.id.startsWith("inspired-by-")) {
              inspiredByText = p.name;
            }

            const pending = JSON.parse(sessionStorage.getItem("bundle_selections_pending") || "{}");
            pending[bundleSlot] = {
              id: p.id,
              name: p.nameShort || p.name,
              image: p.image_thumb || p.image,
              inspiredBy: inspiredByText
            };
            sessionStorage.setItem("bundle_selections_pending", JSON.stringify(pending));

            window.location.href = `template product.html?id=${bundleParent}`;
          };
        } else if (p.isBundle) {
          const oldBackLink = document.getElementById("returnToBundleLink");
          if (oldBackLink) oldBackLink.remove();
          setupBundleSelectors(p);
        } else {
          const oldBackLink = document.getElementById("returnToBundleLink");
          if (oldBackLink) oldBackLink.remove();
          const availableSizes = p.sizes && p.sizes.length > 0 ? p.sizes : ["50ml"];
          let selectedSize = availableSizes[0];
          window.selectedProductSize = selectedSize;

          const sizeIndicator = document.getElementById('selectedSizeIndicator');
          const sizeTextEl = document.getElementById('selectedSizeText');

          if (sizeIndicator && sizeTextEl) {
            sizeIndicator.style.display = "flex";
            if (p.isBundle) {
              const bSize = Number(p.bundleSize) || 2;
              sizeTextEl.textContent = `${bSize} X 50ML`;
            } else {
              sizeTextEl.textContent = selectedSize.toUpperCase();
            }
          }

          if (sizeContainer && sizeOptionsDiv) {
            sizeOptionsDiv.innerHTML = "";

            if (availableSizes.length > 1) {
              sizeContainer.style.display = "block";
              availableSizes.forEach((sz) => {
                const btn = document.createElement('button');
                btn.textContent = sz.toUpperCase();
                btn.className = "size-picker-btn";

                const updateBtnStyles = () => {
                  if (selectedSize === sz) {
                    btn.classList.add('active');
                  } else {
                    btn.classList.remove('active');
                  }
                };
                updateBtnStyles();

                btn.onclick = () => {
                  selectedSize = sz;
                  window.selectedProductSize = sz;
                  if (sizeTextEl) sizeTextEl.textContent = sz.toUpperCase();
                  const siblings = sizeOptionsDiv.querySelectorAll('button');
                  siblings.forEach(sib => {
                    if (sib.textContent === sz.toUpperCase()) {
                      sib.classList.add('active');
                    } else {
                      sib.classList.remove('active');
                    }
                  });
                };
                sizeOptionsDiv.appendChild(btn);
              });
            } else {
              sizeContainer.style.display = "none";
            }
          }

          renderBottleCustomisation(p);

          addToBagBtn.onclick = () => {
            const opts = window.currentBottleCustomisationOptions || [];
            const activeOpt = opts.find(o => o.label === window.selectedBottleCustomisation);
            const customImage = activeOpt ? (activeOpt.img || activeOpt.dataImg) : null;
            const customImageThumb = activeOpt ? (activeOpt.thumbImg || activeOpt.dataImg) : null;
            const finalSize = (activeOpt && activeOpt.size) ? activeOpt.size : (window.selectedProductSize || selectedSize || "50ml");

            window.addToCart(p.id, finalSize, null, window.selectedBottleCustomisation, window.selectedBottlePriceExtra, customImage, customImageThumb, window.selectedBottleCustomisationPrice);
          };
        }
        addToBagBtn.style.display = "";

        if (p.stock <= 0) {
          addToBagBtn.innerHTML = "OUT OF STOCK";
          addToBagBtn.disabled = true;
          addToBagBtn.style.opacity = "0.5";
          addToBagBtn.style.cursor = "not-allowed";

          const notifyContainer = document.getElementById("outOfStockNotifyContainer");
          const notifyForm = document.getElementById("outOfStockNotifyForm");
          const notifySuccess = document.getElementById("outOfStockNotifySuccess");

          if (notifyContainer) {
            notifyContainer.style.display = "block";
            if (notifyForm) notifyForm.style.display = "flex";
            if (notifySuccess) notifySuccess.style.display = "none";

            notifyForm.onsubmit = async (e) => {
              e.preventDefault();
              const emailInput = document.getElementById("outOfStockNotifyEmail");
              if (!emailInput || !emailInput.value.trim() || !window.db) return;

              const email = emailInput.value.trim();
              const submitBtn = notifyForm.querySelector('button[type="submit"]');
              if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "SAVING...";
              }

              try {
                if (window.dbAddDoc && window.dbCollection && window.db) {
                  await window.dbAddDoc(window.dbCollection(window.db, "stock_notifications"), {
                    email: email,
                    productId: p.id,
                    productName: p.name,
                    size: window.selectedProductSize || selectedSize || "50ml",
                    timestamp: new Date().toISOString()
                  });
                }
                notifyForm.style.display = "none";
                if (notifySuccess) notifySuccess.style.display = "block";
              } catch (err) {
                console.error("Error saving stock notification request:", err);
                alert("Failed to submit request: " + err.message);
                if (submitBtn) {
                  submitBtn.disabled = false;
                  submitBtn.textContent = "SUBMIT";
                }
              }
            };
          }
        } else {
          if (bundleView) {
            addToBagBtn.disabled = false;
            addToBagBtn.style.opacity = "";
            addToBagBtn.style.cursor = "";
            addToBagBtn.innerHTML = "ADD TO BUNDLE";
          } else if (p.isBundle) {
            // Managed by updateAddToBagBtnState
          } else {
            addToBagBtn.disabled = false;
            addToBagBtn.style.opacity = "";
            addToBagBtn.style.cursor = "";
            addToBagBtn.innerHTML = "ADD TO BAG";
          }

          const notifyContainer = document.getElementById("outOfStockNotifyContainer");
          if (notifyContainer) notifyContainer.style.display = "none";
        }
      }
    };
    window.swapContentGlobal = swapContent;

    if (product) {
      swapContent(product);
    }

    // 2. Fetch static product catalog directly from products.json
    setTimeout(async () => {
      try {
        let fetchedProds = [];
        try {
          const response = await fetch("products.json?t=" + Date.now());
          if (response.ok) {
            fetchedProds = await response.json();
          }
        } catch (jsonErr) {
          console.warn("Failed to fetch products.json:", jsonErr);
        }

        if ((!fetchedProds || fetchedProds.length === 0) && window.db) {
          try {
            if (window.dbQuery && window.dbCollection && window.dbWhere && window.dbGetDocs) {
              const q = window.dbQuery(window.dbCollection(window.db, "products"), window.dbWhere("status", "==", "Active"));
              const querySnapshot = await window.dbGetDocs(q);
              fetchedProds = [];
              querySnapshot.forEach((docSnap) => {
                const d = docSnap.data();
                fetchedProds.push({
                  id: docSnap.id,
                  name: d.name,
                  nameShort: d.nameShort || "",
                  price: Number(d.price),
                  retailPrice: (d.retailPrice !== undefined && d.retailPrice !== null && String(d.retailPrice).trim() !== "") ? d.retailPrice : null,
                  stock: Number(d.stock),
                  image: d.image,
                  image_thumb: d.image_thumb || "",
                  status: d.status,
                  flair: d.flair || "",
                  invisibleFlair: d.invisibleFlair || "",
                  standardBottleImg: d.standardBottleImg || "",
                  masculinePremiumBottleImg: d.masculinePremiumBottleImg || "",
                  femininePremiumBottleImg: d.femininePremiumBottleImg || "",
                  customisations: d.customisations || [],
                  sizes: d.sizes || ["50ml"],
                  isBundle: !!d.isBundle,
                  bundleSize: Number(d.bundleSize) || 0,
                  scentProfile: d.scentProfile || null
                });
              });
            }
          } catch (fsListErr) {
            console.error("Failed to query catalog fallback from Firestore:", fsListErr);
          }
        }

        if (fetchedProds && fetchedProds.length > 0) {
          activeCatalogFragrances = fetchedProds.filter(p => p.status === "Active" && p.isBundle !== true && p.isBundle !== "true");
          try {
            localStorage.setItem("minara_products", JSON.stringify(fetchedProds));
          } catch (cacheErr) { }
        }

        const dataInJson = fetchedProds.find(p => p.id === productId);
        let data = null;
        if (dataInJson) {
          data = {
            id: productId,
            nameShort: dataInJson.nameShort || "",
            name: dataInJson.name,
            price: Number(dataInJson.price),
            retailPrice: (dataInJson.retailPrice !== undefined && dataInJson.retailPrice !== null && String(dataInJson.retailPrice).trim() !== "") ? dataInJson.retailPrice : null,
            stock: Number(dataInJson.stock),
            image: dataInJson.image,
            image_thumb: dataInJson.image_thumb || "",
            description: dataInJson.description || "",
            status: dataInJson.status,
            flair: dataInJson.flair || "",
            invisibleFlair: dataInJson.invisibleFlair || "",
            standardBottleImg: dataInJson.standardBottleImg || "",
            masculinePremiumBottleImg: dataInJson.masculinePremiumBottleImg || "",
            femininePremiumBottleImg: dataInJson.femininePremiumBottleImg || "",
            customisations: dataInJson.customisations || [],
            sizes: dataInJson.sizes || ["50ml"],
            isBundle: !!dataInJson.isBundle,
            bundleSize: Number(dataInJson.bundleSize) || 0,
            scentProfile: dataInJson.scentProfile || null
          };
        }

        if (data) {
          // Firestore is the source of truth for stock — override main + customisation block stocks
          try {
            const liveList = await window.loadLiveProducts();
            const l = liveList && liveList.find ? liveList.find(x => x.id === data.id) : null;
            if (l) {
              if (l.stock !== undefined && l.stock !== null && l.stock !== '') data.stock = Number(l.stock);
              if (Array.isArray(l.customisations) && Array.isArray(data.customisations)) {
                for (let i = 0; i < data.customisations.length; i++) {
                  const lc = l.customisations[i] || l.customisations.find(x => String(x.label || '') === String(data.customisations[i].label || ''));
                  if (lc && lc.stock !== undefined && lc.stock !== null && lc.stock !== '') data.customisations[i].stock = Number(lc.stock);
                }
              }
            }
          } catch (e) {}

          const liveProduct = data;
          const custsChanged = JSON.stringify(product ? product.customisations : null) !== JSON.stringify(liveProduct.customisations);
          const scentChanged = JSON.stringify(product ? product.scentProfile : null) !== JSON.stringify(liveProduct.scentProfile);
          if (!product || liveProduct.isBundle || product.nameShort !== liveProduct.nameShort || product.name !== liveProduct.name || product.price !== liveProduct.price || product.retailPrice !== liveProduct.retailPrice || product.stock !== liveProduct.stock || product.image !== liveProduct.image || product.image_thumb !== liveProduct.image_thumb || product.description !== liveProduct.description || product.status !== liveProduct.status || product.flair !== liveProduct.flair || product.invisibleFlair !== liveProduct.invisibleFlair || product.standardBottleImg !== liveProduct.standardBottleImg || product.masculinePremiumBottleImg !== liveProduct.masculinePremiumBottleImg || product.femininePremiumBottleImg !== liveProduct.femininePremiumBottleImg || JSON.stringify(product.sizes) !== JSON.stringify(liveProduct.sizes) || product.isBundle !== liveProduct.isBundle || product.bundleSize !== liveProduct.bundleSize || custsChanged || scentChanged) {
            product = liveProduct;
            swapContent(product);
          }
        }
      } catch (dbErr) {
        console.error("products.json details background load failed:", dbErr);
      }
    }, 0);

    window.addEventListener("minaraDiscountActivated", () => {
      if (product) {
        swapContent(product);
      }
    });

    if (typeof window.loadReviews === 'function') {
      window.loadReviews(productId);
    }
  }

  const runProductInitSafe = async () => {
    try {
      await setupFirestoreHelpers();
      await initProductDetails();
    } catch (globalErr) {
      console.error("Fatal error in initProductDetails:", globalErr);
      const descEl = document.querySelector('.desc');
      if (descEl) {
        descEl.innerHTML = `<div style="color:red; font-family:monospace; padding:15px; border:1px solid red; background:#fff1f1; font-size:12px; text-transform:none; letter-spacing:0; margin-top:20px; line-height:1.5;">Fatal initialization error: ${globalErr.message}<br><pre style="margin-top:10px; white-space:pre-wrap;">${globalErr.stack}</pre></div>`;
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runProductInitSafe);
  } else {
    runProductInitSafe();
  }

  window.initProductDetails = initProductDetails;
})();
