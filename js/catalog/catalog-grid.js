/**
 * Studio Extrait - Catalog Grid Controller
 * Manages dynamic product catalog rendering, category/gender filtering,
 * instant local storage caching, reviews rating integration, search query parsing,
 * and background products.json synchronization.
 */

(function () {
  // Global helper fallbacks
  if (!window.escapeHTML) {
    window.escapeHTML = function (str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };
  }

  async function initCatalog() {
    const qp = new URLSearchParams(window.location.search);
    const isTopup = qp.get('topup') === '1';
    if (isTopup && document.body) document.body.classList.add('topup');
    // Carry the upsell/topup state through to the product page (crossed-out price).
    try {
      if (isTopup) sessionStorage.setItem('minara_topup', '1');
      else sessionStorage.removeItem('minara_topup');
    } catch (e) {}
    const formatPrice = window.formatPrice || (val => {
      if (val === undefined || val === null || isNaN(val)) return "0";
      return Math.round(Number(val)).toString();
    });

    const formatRetailPrice = val => {
      if (val === undefined || val === null || isNaN(val)) return "0";
      const cleanVal = Math.round(Number(val)).toString();
      return cleanVal.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const grid = document.querySelector('.catalog-grid');
    if (!grid) return;

    // Default products list starting empty to load purely dynamic products
    let products = [];
    let allReviews = [];

    // Fetch reviews from reviews.json once to avoid per-card queries
    const loadStaticReviews = async () => {
      try {
        const res = await fetch("reviews.json?t=" + Date.now());
        if (res.ok) {
          allReviews = await res.json();
        }
      } catch (err) {
        console.warn("Failed to fetch reviews.json for catalog:", err);
      }

      // Merge local session reviews so user's own submissions show up instantly
      try {
        const sessionReviews = JSON.parse(sessionStorage.getItem("my_session_reviews") || "[]");
        sessionReviews.forEach(sr => {
          const isDuplicate = allReviews.some(pr =>
            pr.productId === sr.productId &&
            pr.name === sr.name &&
            pr.text === sr.text &&
            pr.rating === sr.rating &&
            (sr.timestamp ? pr.timestamp === sr.timestamp : true)
          );
          if (!isDuplicate) {
            allReviews.push(sr);
          }
        });
      } catch (e) {
        console.error("Failed to merge session reviews:", e);
      }
    };
    await loadStaticReviews();

    // 1. Fetch custom products from local storage
    const loadLocalProducts = () => {
      try {
        const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
        localProds.forEach(p => {
          const itemCustomisations = (p.customisations && Array.isArray(p.customisations)) ? p.customisations : [];
          if (!products.some(item => item.id === p.id)) {
            products.push({
              ...p,
              customisations: itemCustomisations,
              isBundle: !!p.isBundle,
              bundleSize: Number(p.bundleSize) || 0,
              url: `template product.html?id=${p.id}`
            });
          } else {
            const existingIdx = products.findIndex(item => item.id === p.id);
            if (existingIdx > -1) {
              products[existingIdx] = {
                ...products[existingIdx],
                ...p,
                customisations: itemCustomisations.length > 0 ? itemCustomisations : (products[existingIdx].customisations || []),
                isBundle: !!p.isBundle,
                bundleSize: Number(p.bundleSize) || 0,
                url: `template product.html?id=${p.id}`
              };
            }
          }
        });
      } catch (e) {
        console.error("Local storage products read failed:", e);
      }
    };

    // Dynamic image thumbnail switcher (main/thumbnail quality swap)
    const getThumbnailImageUrl = (src, thumbSrc) => {
      if (thumbSrc) return thumbSrc;
      if (!src) return "";
      const cleanSrc = src.split(',')[0].trim();
      if (cleanSrc.endsWith("-main.avif")) {
        return cleanSrc.replace("-main.avif", "-thumb.avif");
      }
      return cleanSrc;
    };

    // Render function
    const renderGrid = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const genderFilter = urlParams.get('gender');
      const heading = document.querySelector('.catalog-title-header h1');
      if (heading) {
        if (genderFilter === 'men') {
          heading.textContent = "MEN'S FRAGRANCES";
          document.title = "Studio Extrait - Shop Men's Fragrances";
        } else if (genderFilter === 'women') {
          heading.textContent = "WOMEN'S FRAGRANCES";
          document.title = "Studio Extrait - Shop Women's Fragrances";
        } else if (genderFilter === 'gifts') {
          heading.textContent = "GIFTS & SETS";
          document.title = "Studio Extrait - Shop Gifts";
        } else {
          heading.textContent = "CATALOG";
          document.title = "Studio Extrait | Extrait De Parfum | South Africa";
        }
      }

      let activeProducts = products.filter(p => p.status === 'Active');

      // 1. Filter by Gender / Category Classification
      if (genderFilter === 'men') {
        activeProducts = activeProducts.filter(p => {
          const f = (p.flair || '').toLowerCase();
          const invF = (p.invisibleFlair || '').toLowerCase();
          return f === 'masculine' || f === 'unisex' || invF === 'men' || invF === 'unisex' || p.isBundle;
        });
      } else if (genderFilter === 'women') {
        activeProducts = activeProducts.filter(p => {
          const f = (p.flair || '').toLowerCase();
          const invF = (p.invisibleFlair || '').toLowerCase();
          return f === 'feminine' || f === 'unisex' || invF === 'women' || invF === 'unisex' || p.isBundle;
        });
      } else if (genderFilter === 'gifts') {
        const giftItems = [];
        activeProducts.forEach(p => {
          if (p.customisations && Array.isArray(p.customisations) && p.customisations.length > 0) {
            p.customisations.forEach((c, idx) => {
              const lbl = (c.label || '').toUpperCase().trim();
              if (lbl === 'STANDARD') return;

              const basePrice = Number(p.price) || 0;
              let finalPrice;
              if (c.price !== undefined && c.price !== null && c.price !== "") {
                // Official absolute price set by admin.
                finalPrice = Number(c.price);
              } else {
                let extra = 0;
                if (c.priceExtra !== undefined && c.priceExtra !== null) {
                  extra = Number(c.priceExtra);
                } else if (lbl.includes("PREMIUM")) {
                  extra = 145;
                } else if (lbl.includes("100ML") && basePrice <= 550) {
                  extra = 254;
                }
                finalPrice = basePrice + extra;
              }
              let rawName = p.name ? p.name.replace(/<br>/gi, ' ').replace(/\s+/g, ' ').trim() : "";
              let optSize = c.size || (lbl.includes("100ML") ? "100ml" : "50ml");

              giftItems.push({
                ...p,
                id: p.id,
                name: `${rawName} – ${lbl}`,
                nameShort: `${p.nameShort || rawName}`,
                price: finalPrice,
                basePrice: basePrice,
                priceExtra: (finalPrice - basePrice),
                giftSize: optSize,
                retailPrice: p.retailPrice ? (p.retailPrice + (finalPrice - basePrice)) : null,
                stock: (c.stock !== undefined && c.stock !== null && c.stock !== '') ? Number(c.stock) : p.stock,
                image: c.image || c.image_data || c.image_thumb || p.image,
                image_thumb: c.image_thumb || c.image || c.image_data || p.image_thumb || p.image,
                url: `template product.html?id=${p.id}&customisation=${idx}`,
                isGiftItem: true,
                giftIndex: idx,
                giftLabel: lbl,
                isBundle: false
              });
            });
          }
          if (p.isBundle || (p.flair && p.flair.toLowerCase().includes('gift')) || (p.invisibleFlair && p.invisibleFlair.toLowerCase().includes('gift'))) {
            giftItems.push(p);
          }
        });
        activeProducts = giftItems;
      }

      // 2. Filter by search query if active
      const searchInput = document.getElementById("catalogSearchInput");
      const query = searchInput ? searchInput.value.trim() : "";

      // Reset any old searchMatchMessage fields
      products.forEach(p => delete p.searchMatchMessage);

      if (query) {
        let matchedIds = [];
        let matches = [];

        if (typeof window.findSearchMatchedProductIds === 'function') {
          matches = window.findSearchMatchedProductIds(query);
          matchedIds = matches.map(m => m.id);
        }

        // Locally scan current products list for name, ID, flair, or short name matches
        const cleanQuery = query.toLowerCase();
        products.forEach(p => {
          const normName = (p.name || "").toLowerCase();
          const normShort = (p.nameShort || "").toLowerCase();
          const normId = (p.id || "").toLowerCase();
          const normFlair = (p.flair || "").toLowerCase();

          if (normName.includes(cleanQuery) || normShort.includes(cleanQuery) || normId.includes(cleanQuery) || normFlair.includes(cleanQuery)) {
            const existingIdx = matches.findIndex(m => m.id === p.id);
            if (existingIdx === -1) {
              matchedIds.push(p.id);
              matches.push({ id: p.id, isDirect: true, popularMatch: null });
            } else {
              matches[existingIdx].isDirect = true;
              matches[existingIdx].popularMatch = null;
            }
          }
        });

        activeProducts = activeProducts.filter(p => matchedIds.includes(p.id) || p.isBundle);

        // Attach the closest match warning message to products we don't stock directly
        matches.forEach(m => {
          if (!m.isDirect && m.popularMatch) {
            const p = products.find(prod => prod.id === m.id);
            if (p) {
              p.searchMatchMessage = `<b>${m.popularMatch.brand.toUpperCase()} ${m.popularMatch.name.toUpperCase()}</b> IS IN OUR DATABASE BUT WE DO NOT STOCK IT.<br>HERE IS OUR CLOSEST SCENT MATCH:`;
            }
          }
        });
      }

      // 3. Extract the bundle product (hidden in the topup flow to reduce friction)
      const isTopupFlow = !!(document.body && document.body.classList.contains('topup'));
      const bundleProduct = isTopupFlow ? null : activeProducts.find(p => p.isBundle);
      let nonBundleProducts = activeProducts.filter(p => !p.isBundle);

      // Sort non-bundle products
      nonBundleProducts.sort((a, b) => {
        const hasA = a.sortOrder !== undefined && a.sortOrder !== null && a.sortOrder !== "";
        const hasB = b.sortOrder !== undefined && b.sortOrder !== null && b.sortOrder !== "";

        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (hasA && hasB) {
          const diff = Number(a.sortOrder) - Number(b.sortOrder);
          if (diff !== 0) return diff;
        }

        const nameA = (a.nameShort || a.name || "").toLowerCase();
        const nameB = (b.nameShort || b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });

      // Reconstruct active products list with the bundle product in the second slot
      if (bundleProduct) {
        activeProducts = [
          ...nonBundleProducts.slice(0, 1),
          bundleProduct,
          ...nonBundleProducts.slice(1)
        ];
      } else {
        activeProducts = nonBundleProducts;
      }

      grid.innerHTML = "";

      if (activeProducts.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; font-family: 'Gotham Narrow Bold', sans-serif; font-size: 11px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; color: #777777;">NO FRAGRANCES FOUND</div>`;
        return;
      }

      activeProducts.forEach(p => {
        const item = document.createElement('div');

        if (p.searchMatchMessage) {
          const messageItem = document.createElement('div');
          messageItem.className = "search-match-message-card";
          messageItem.innerHTML = `
            <div class="search-match-message-text">
              ${p.searchMatchMessage}
            </div>
          `;
          grid.appendChild(messageItem);
        }

        item.className = "catalog-item";

        item.innerHTML = `
          <a class="product-link" style="text-decoration:none; color:inherit; display:flex; flex-direction:column; flex-grow:1;">
            <div class="product-box">
              <img class="product-img" loading="lazy" src="" alt="">
            </div>
            <div class="product-info" style="display: flex; flex-direction: column; flex-grow: 1;">
              <div class="product-flair-row" style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                <h3 class="product-title"></h3>
                <div class="product-flair" style="font-family: 'Gotham Narrow Bold', sans-serif; font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.2px; display: none; padding: 3px 9px; border-radius: 999px; line-height: 1; flex-shrink: 0;"></div>
              </div>
              <div class="product-type" style="font-family: Georgia, serif; font-style: italic; font-size: 9px; opacity: 0.6; color: #555; text-transform: none; letter-spacing: 0.5px; margin-top: 1px; margin-bottom: 3px; display: none;"></div>
              <div class="product-inspired"></div>
              <div class="product-retail-price" style="display:none;"></div>
              <div class="product-reviews-row">
                <span class="product-stars">★★★★★</span>
                <span class="product-reviews-count"></span>
              </div>
              <div class="catalog-stock-status"></div>
            </div>
          </a>
          <div class="product-price-action-row">
            <div class="product-price-block"></div>
            <button class="add-to-cart-btn"></button>
          </div>
        `;

        const flairEl = item.querySelector('.product-flair');
        if (flairEl) {
          if (p.flairText && p.flairColor) {
            flairEl.textContent = p.flairText;
            flairEl.style.display = 'inline-flex';
            flairEl.style.background = 'color-mix(in srgb, ' + p.flairColor + ' 18%, transparent)';
            flairEl.style.color = p.flairColor;
            flairEl.style.opacity = '1';
            flairEl.style.width = 'fit-content';
          } else {
            flairEl.style.display = 'none';
          }
        }

        const titleEl = item.querySelector('.product-title');
        const inspiredEl = item.querySelector('.product-inspired');

        let rawName = p.name ? p.name.replace(/<br>/gi, ' ').replace(/\s+/g, ' ').trim() : "";
        const inspiredMatch = rawName.match(/^inspired\s+by\s+(.+)/i);
        const isInspired = inspiredMatch || p.id.startsWith("inspired-by-");
        const retailVal = window.getRetailNumber ? window.getRetailNumber(p.retailPrice) : null;
        const retailRText = window.formatRetailLabel ? window.formatRetailLabel(p.retailPrice) : '';

        const formatBrandName = (brandName) => {
          if (!brandName) return "";
          return brandName.replace(/\w\S*/g, (txt) => {
            const lower = txt.toLowerCase();
            if (lower === 'jpg') return 'JPG';
            if (lower === 'le') return 'Le';
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
          });
        };

        const typeEl = item.querySelector('.product-type');
        if (typeEl) {
          typeEl.textContent = p.isBundle ? "50ml extraits · you choose the scents" : "";
          typeEl.style.display = p.isBundle ? 'block' : 'none';
        }

        if (p.isGiftItem && p.giftLabel) {
          titleEl.textContent = p.nameShort || rawName;
          titleEl.style.fontSize = "12px";
          titleEl.style.color = "#111111";
          titleEl.style.fontFamily = "'Gotham Narrow Bold', sans-serif";
          titleEl.style.fontWeight = "700";
          titleEl.style.display = 'block';
          titleEl.style.textTransform = "uppercase";
          titleEl.style.letterSpacing = "0.04em";
          titleEl.style.marginBottom = "2px";

          inspiredEl.innerHTML = `<span style="font-family:'Gotham Narrow Bold', sans-serif; font-size: 8px; font-weight: bold; color: #1106e8; letter-spacing: 0.8px; text-transform: uppercase; display: block; margin-bottom: 6px;">${p.giftLabel}</span>`;
          inspiredEl.style.display = 'block';
        } else if (inspiredMatch || p.id.startsWith("inspired-by-")) {
          const fragranceName = inspiredMatch ? inspiredMatch[1] : rawName;

          titleEl.textContent = p.nameShort || rawName;
          titleEl.style.fontSize = "12px";
          titleEl.style.color = "#111111";
          titleEl.style.fontFamily = "'Gotham Narrow Bold', sans-serif";
          titleEl.style.fontWeight = "700";
          titleEl.style.display = 'block';
          titleEl.style.textTransform = "uppercase";
          titleEl.style.letterSpacing = "0.04em";
          titleEl.style.marginBottom = "2px";

          inspiredEl.innerHTML = `<span style="font-family:'Gotham Narrow Bold', sans-serif; font-size: 7px; font-weight: bold; color: #999999; letter-spacing: 1.2px; text-transform: uppercase; display: block; margin-bottom: 1px;">INSPIRED BY</span><i style="font-family:'Gotham Narrow Bold', sans-serif; font-style: italic; font-weight: 500; font-size: 9.5px; text-transform: uppercase; color: #444444; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">${formatBrandName(fragranceName)}${retailVal ? ` <span class="hp-retail-price">${retailRText}</span>` : ''}</i>`;
          inspiredEl.style.display = 'block';
        } else {
          titleEl.textContent = p.isBundle ? "PICK ANY 2" : rawName;
          titleEl.style.fontSize = "12px";
          titleEl.style.color = "#111111";
          titleEl.style.fontFamily = "'Gotham Narrow Bold', sans-serif";
          titleEl.style.fontWeight = "700";
          titleEl.style.display = 'block';
          titleEl.style.textTransform = "uppercase";
          titleEl.style.letterSpacing = "0.04em";

          inspiredEl.innerHTML = "";
          inspiredEl.style.display = 'none';
        }

        const retailPriceEl = item.querySelector('.product-retail-price');
        if (retailPriceEl && !isInspired && p.retailPrice && window.getRetailNumber && window.getRetailNumber(p.retailPrice)) {
          retailPriceEl.textContent = `${p.isBundle ? 'Value ' : ''}${retailRText}`;
          retailPriceEl.style.display = 'block';
        }

        // Bind static URL
        item.querySelector('.product-link').href = p.url;

        // Image properties
        const img = item.querySelector('.product-img');
        const tSrc = getThumbnailImageUrl(p.image, p.image_thumb);
        if (tSrc) {
          img.src = tSrc;
          img.style.display = 'block';
        } else {
          img.style.display = 'none';
        }
        img.setAttribute('alt', rawName);
        const pBox = item.querySelector('.product-box');
        if (pBox && Number(p.stock) <= 2 && !p.isBundle) {
          const cardBadge = document.createElement('span');
          cardBadge.className = 'se-card-badge';
          cardBadge.textContent = Number(p.stock) <= 0 ? 'OUT OF STOCK' : `ONLY ${p.stock} LEFT`;
          pBox.appendChild(cardBadge);
        }

        // Reviews & stars
        const reviewsCountEl = item.querySelector('.product-reviews-count');
        const starsEl = item.querySelector('.product-stars');
        const reviewsRowEl = item.querySelector('.product-reviews-row');

        const emptyStarsHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cea44c" stroke-width="1.5" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        `.repeat(5);

        if (starsEl) {
          starsEl.innerHTML = emptyStarsHTML;
        }
        if (reviewsCountEl) {
          reviewsCountEl.textContent = '(0)';
        }
        if (reviewsRowEl) {
          reviewsRowEl.style.opacity = '0.35';
        }

        const cardReviews = allReviews.filter(r => r.productId === p.id);
        let totalRating = 0;
        let count = 0;
        cardReviews.forEach(r => {
          if (r.rating) {
            totalRating += Number(r.rating);
            count++;
          }
        });
        if (count > 0) {
          const avg = totalRating / count;
          const rounded = Math.round(avg);
          let starsHTML = "";
          for (let i = 1; i <= 5; i++) {
            if (i <= rounded) {
              starsHTML += `<svg width="13" height="13" viewBox="0 0 24 24" fill="#cea44c" stroke="#cea44c" stroke-width="1.5" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            } else {
              starsHTML += `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cea44c" stroke-width="1.5" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            }
          }
          if (starsEl) {
            starsEl.innerHTML = starsHTML;
          }
          if (reviewsCountEl) {
            reviewsCountEl.textContent = `(${count})`;
          }
          if (reviewsRowEl) {
            reviewsRowEl.style.opacity = '1';
          }
        }

        // Price block
        const priceBlockEl = item.querySelector('.product-price-block');
        const hasDiscount = localStorage.getItem("minara_discount_5") === "active";
        if (!p.isBundle) {
          const salePrice = Math.max(0, p.price - 241);
          priceBlockEl.innerHTML = `
            <span class="sale-price js-price-empty">R${formatPrice(p.price)}</span>
            <span class="sale-price js-bundle-price">R${formatPrice(salePrice)}</span>
            <span class="original-price js-bundle-was">R${formatPrice(p.price)}</span>
          `;
        } else {
          priceBlockEl.innerHTML = `
            <span class="sale-price">R${formatPrice(p.price)}</span>
          `;
        }

        // Add to bag button
        const btn = item.querySelector('.add-to-cart-btn');
        if (p.stock > 0) {
          if (p.isBundle) {
            btn.innerHTML = `
              <svg class="cart-icon" style="width: 12px; height: 12px;" viewBox="0 0 30 30" fill="none">
                <rect x="7" y="12" width="16" height="11" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M10 12 V7 H20 V12" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span>CREATE BUNDLE</span>
            `;
            btn.disabled = false;
            btn.style.opacity = "";
            btn.style.cursor = "pointer";
            btn.setAttribute('onclick', `window.location.href='${p.url}'`);
          } else if (p.isGiftItem) {
            btn.innerHTML = `
              <svg class="cart-icon" style="width: 12px; height: 12px;" viewBox="0 0 30 30" fill="none">
                <rect x="7" y="12" width="16" height="11" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M10 12 V7 H20 V12" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span>ADD TO BAG</span>
            `;
            btn.disabled = false;
            btn.style.opacity = "";
            btn.style.cursor = "pointer";
            const safeLabel = (p.giftLabel || '').replace(/'/g, "\\'");
            const safeImg = (p.image || '').replace(/'/g, "\\'");
            const safeThumb = (p.image_thumb || '').replace(/'/g, "\\'");
            btn.setAttribute('onclick', `addToCart('${p.id}', '${p.giftSize || "50ml"}', null, '${safeLabel}', ${p.priceExtra || 0}, '${safeImg}', '${safeThumb}')`);
          } else {
            btn.innerHTML = `
              <svg class="cart-icon" style="width: 12px; height: 12px;" viewBox="0 0 30 30" fill="none">
                <rect x="7" y="12" width="16" height="11" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M10 12 V7 H20 V12" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span>ADD TO BAG</span>
            `;
            btn.disabled = false;
            btn.style.opacity = "";
            btn.style.cursor = "";
            btn.setAttribute('onclick', `addToCart('${p.id}')`);
          }
        } else {
          btn.innerHTML = `<span>OUT OF STOCK</span>`;
          btn.disabled = true;
          btn.style.opacity = "0.5";
          btn.style.cursor = "not-allowed";
        }

        const stockStatusEl = item.querySelector('.catalog-stock-status');
        if (stockStatusEl) {
          stockStatusEl.style.display = 'none';
        }

        grid.appendChild(item);
      });
    };

    // Firestore is the source of truth for stock (main + each customisation block).
    // Override the static/local stock with live values so admin changes appear for
    // every visitor immediately, without a redeploy.
    const applyLiveStock = async () => {
      if (!window.loadLiveProducts) return;
      const live = await window.loadLiveProducts();
      if (!live || !Array.isArray(live) || live.length === 0) return;
      const liveMap = {};
      live.forEach(l => { liveMap[l.id] = l; });
      let changed = false;
      products.forEach(p => {
        const l = liveMap[p.id];
        if (!l) return;
        if (l.stock !== undefined && l.stock !== null && l.stock !== '' && Number(l.stock) !== Number(p.stock)) {
          p.stock = Number(l.stock);
          changed = true;
        }
        if (Array.isArray(l.customisations) && Array.isArray(p.customisations)) {
          for (let i = 0; i < p.customisations.length; i++) {
            const lc = l.customisations[i] || l.customisations.find(x => String(x.label || '') === String(p.customisations[i].label || ''));
            if (lc && lc.stock !== undefined && lc.stock !== null && lc.stock !== '' && Number(lc.stock) !== Number(p.customisations[i].stock)) {
              p.customisations[i].stock = Number(lc.stock);
              changed = true;
            }
          }
        }
      });
      if (changed) {
        try {
          const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
          products.forEach(p => {
            const idx = localProds.findIndex(x => x.id === p.id);
            const stored = { ...p, syncStatus: "synced" };
            if (idx > -1) localProds[idx] = stored; else localProds.push(stored);
          });
          localStorage.setItem("minara_products", JSON.stringify(localProds));
        } catch (e) {}
        renderGrid();
      }
    };

    window.renderCatalogGrid = renderGrid;

    // Load local cache and render instantly
    loadLocalProducts();
    renderGrid();

    window.addEventListener('minara_stock_updated', () => {
      loadLocalProducts();
      renderGrid();
    });

    // 2. Fetch custom products from products.json in background
    setTimeout(async () => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Static products query timed out")), 10000)
        );
        const response = await Promise.race([
          fetch("products.json?t=" + Date.now()),
          timeoutPromise
        ]);

        if (!response.ok) {
          throw new Error(`Failed to load products.json: Status ${response.status}`);
        }

        const fetchedProds = await response.json();
        let updated = false;
        let firestoreProds = [];

        fetchedProds.forEach((data) => {
          const p = {
            id: data.id,
            nameShort: data.nameShort || "",
            name: window.escapeHTML(data.name),
            price: Number(data.price),
            retailPrice: (data.retailPrice !== undefined && data.retailPrice !== null && String(data.retailPrice).trim() !== "") ? data.retailPrice : null,
            stock: Number(data.stock),
            image: data.image,
            image_thumb: data.image_thumb || "",
            status: data.status,
            flair: data.flair || "",
            flairText: data.flairText || "",
            flairColor: data.flairColor || "",
            invisibleFlair: data.invisibleFlair || "",
            customisations: (data.customisations && Array.isArray(data.customisations)) ? data.customisations : [],
            isBundle: !!data.isBundle,
            bundleSize: Number(data.bundleSize) || 0,
            sortOrder: data.sortOrder !== undefined && data.sortOrder !== null ? Number(data.sortOrder) : null,
            url: `template product.html?id=${data.id}`
          };
          firestoreProds.push(p);

          const existingIdx = products.findIndex(item => item.id === p.id);
          if (existingIdx > -1) {
            const current = products[existingIdx];
            if (
              current.nameShort !== p.nameShort ||
              current.name !== p.name ||
              current.price !== p.price ||
              current.retailPrice !== p.retailPrice ||
              current.stock !== p.stock ||
              current.image !== p.image ||
              current.image_thumb !== p.image_thumb ||
              current.status !== p.status ||
              current.flair !== p.flair ||
              current.flairText !== p.flairText ||
              current.flairColor !== p.flairColor ||
              current.invisibleFlair !== p.invisibleFlair ||
              JSON.stringify(current.customisations || []) !== JSON.stringify(p.customisations || []) ||
              current.isBundle !== p.isBundle ||
              current.bundleSize !== p.bundleSize ||
              current.sortOrder !== p.sortOrder
            ) {
              products[existingIdx] = p;
              updated = true;
            }
          } else {
            products.push(p);
            updated = true;
          }
        });

        // Update localStorage with the latest state
        try {
          const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
          let localUpdated = false;
          firestoreProds.forEach(fp => {
            const idx = localProds.findIndex(lp => lp.id === fp.id);
            if (idx > -1) {
              localProds[idx] = { ...fp, syncStatus: "synced" };
              localUpdated = true;
            } else {
              localProds.push({ ...fp, syncStatus: "synced" });
              localUpdated = true;
            }
          });

          // Check if any product was deleted from repository but is still in local cache
          if (firestoreProds.length > 0) {
            const cleanedLocalProds = localProds.filter(lp => {
              if (lp.syncStatus === 'pending') return true;
              const existsInFirestore = firestoreProds.some(fp => fp.id === lp.id);
              if (!existsInFirestore) {
                localUpdated = true;
                return false;
              }
              return true;
            });

            if (localUpdated) {
              localStorage.setItem("minara_products", JSON.stringify(cleanedLocalProds));

              products = cleanedLocalProds.map(lp => ({
                ...lp,
                url: `template product.html?id=${lp.id}`
              }));
              updated = true;
            }
          } else if (localUpdated) {
            localStorage.setItem("minara_products", JSON.stringify(localProds));
          }
        } catch (err) {
          console.error("Failed to sync products back to local storage cache:", err);
        }

        if (updated) {
          renderGrid();
        }
      } catch (dbErr) {
        console.error("products.json background load failed:", dbErr);
      }

      // Firestore is the authoritative source for stock — override the static value
      await applyLiveStock();
    }, 0);

    window.addEventListener("minaraDiscountActivated", () => {
      renderGrid();
    });

    // Inline Search event bindings & Keyboard adjustments
    const searchBtn = document.getElementById("catalogPageSearchBtn");
    const searchInputWrap = document.getElementById("catalogSearchInputWrap");
    const searchInput = document.getElementById("catalogSearchInput");

    if (searchBtn && searchInputWrap && searchInput) {
      searchBtn.onclick = (e) => {
        e.preventDefault();
        searchBtn.style.display = "none";
        searchInputWrap.style.display = "flex";
        searchInput.focus();
      };

      const clearSearch = document.getElementById("clearCatalogSearch");
      if (clearSearch) {
        clearSearch.onclick = () => {
          searchInput.value = "";
          searchInputWrap.style.display = "none";
          searchBtn.style.display = "inline-flex";
          renderGrid();
        };
      }

      searchInput.oninput = () => {
        renderGrid();
      };

      const updateKeyboardState = () => {
        if (window.visualViewport) {
          const vv = window.visualViewport;
          const keyboardHeight = window.innerHeight - vv.height;
          const isKeyboard = keyboardHeight > 150 && document.activeElement === searchInput;

          if (isKeyboard) {
            document.body.classList.add("keyboard-open");
            const header = document.querySelector("header");
            if (header) {
              header.style.display = "none";
            }
          } else {
            document.body.classList.remove("keyboard-open");
            const header = document.querySelector("header");
            if (header) {
              header.style.display = "";
            }
          }
        }
      };

      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", updateKeyboardState);
        window.visualViewport.addEventListener("scroll", updateKeyboardState);
      }

      searchInput.addEventListener("focus", () => setTimeout(updateKeyboardState, 100));
      searchInput.addEventListener("blur", () => setTimeout(updateKeyboardState, 100));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCatalog);
  } else {
    initCatalog();
  }
})();
