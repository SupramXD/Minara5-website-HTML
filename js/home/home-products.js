/**
 * Studio Extrait - Home Products Controller
 * Handles Best Sellers & Second Products grid rendering, reviews integration,
 * local storage caching, discount pricing, and dynamic products.json synchronization.
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

  async function initHomeProducts() {
    const formatPrice = window.formatPrice || (val => {
      if (val === undefined || val === null || isNaN(val)) return "0";
      return Math.round(Number(val)).toString();
    });

    const formatRetailPrice = val => {
      if (val === undefined || val === null || isNaN(val)) return "0";
      const cleanVal = Math.round(Number(val)).toString();
      return cleanVal.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const grids = document.querySelectorAll('.home-products-list');
    if (!grids || grids.length === 0) return;

    // Default products list starting empty to load purely dynamic products
    let products = [];
    let allReviews = [];

    // Fetch reviews from reviews.json once in a non-blocking background task
    const loadStaticReviews = async () => {
      try {
        const res = await fetch("reviews.json");
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

      // Trigger a re-render once reviews are fetched to apply ratings
      renderGrid();
    };

    // Trigger reviews load asynchronously without blocking local render
    loadStaticReviews();

    // 1. Fetch custom products from local storage
    const loadLocalProducts = () => {
      try {
        const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
        localProds.forEach(p => {
          if (!products.some(item => item.id === p.id)) {
            products.push({
              id: p.id,
              nameShort: p.nameShort || "",
              name: p.name,
              price: p.price,
              retailPrice: p.retailPrice || null,
              stock: p.stock,
              image: p.image,
              image_thumb: p.image_thumb || "",
              status: p.status,
              flair: p.flair || "",
              customisations: (p.customisations && Array.isArray(p.customisations)) ? p.customisations : [],
              isBundle: !!p.isBundle,
              bundleSize: Number(p.bundleSize) || 0,
              sortOrder: p.sortOrder !== undefined && p.sortOrder !== null ? Number(p.sortOrder) : null,
              url: `template product.html?id=${p.id}`
            });
          } else {
            // Keep current local storage stock/values if already there
            const existingIdx = products.findIndex(item => item.id === p.id);
            if (existingIdx > -1) {
              products[existingIdx] = {
                ...products[existingIdx],
                id: p.id,
                nameShort: p.nameShort || "",
                name: p.name,
                price: p.price,
                retailPrice: p.retailPrice || null,
                stock: p.stock,
                image: p.image,
                image_thumb: p.image_thumb || "",
                status: p.status,
                flair: p.flair || "",
                isBundle: !!p.isBundle,
                bundleSize: Number(p.bundleSize) || 0,
                sortOrder: p.sortOrder !== undefined && p.sortOrder !== null ? Number(p.sortOrder) : null,
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

    // Lazy load & unload manager for product sections
    let topGridHtml = "";
    let secondGridHtml = "";
    let topGridLoaded = false;
    let secondGridLoaded = false;
    let topSectionIntersecting = false;
    let secondSectionIntersecting = false;

    const topSection = document.querySelector('.home-products-section');
    const secondSection = document.querySelector('.second-products-outer-wrap');
    const topGrid = document.querySelector('.home-products-list:not(.second-products-list)');
    const secondGrid = document.querySelector('.home-products-list.second-products-list');

    const mountTopGrid = () => {
      if (!topGrid || !topGridHtml) return;
      topGrid.innerHTML = topGridHtml;
      topGrid.style.minHeight = '';
      topGridLoaded = true;
      if (typeof window.updateLogoPosition === 'function') window.updateLogoPosition();
    };

    const unmountTopGrid = () => {
      if (!topGrid || !topGridLoaded) return;
      if (topGrid.offsetHeight > 0) {
        topGrid.style.minHeight = topGrid.offsetHeight + 'px';
      }
      topGrid.innerHTML = '';
      topGridLoaded = false;
      if (typeof window.updateLogoPosition === 'function') window.updateLogoPosition();
    };

    const mountSecondGrid = () => {
      if (!secondGrid || !secondGridHtml) return;
      secondGrid.innerHTML = secondGridHtml;
      secondGrid.style.minHeight = '';
      secondGridLoaded = true;
      if (typeof window.updateLogoPosition === 'function') window.updateLogoPosition();
    };

    const unmountSecondGrid = () => {
      if (!secondGrid || !secondGridLoaded) return;
      if (secondGrid.offsetHeight > 0) {
        secondGrid.style.minHeight = secondGrid.offsetHeight + 'px';
      }
      secondGrid.innerHTML = '';
      secondGridLoaded = false;
      if (typeof window.updateLogoPosition === 'function') window.updateLogoPosition();
    };

    let productObserver = null;
    if ('IntersectionObserver' in window) {
      productObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.target === topSection) {
            topSectionIntersecting = entry.isIntersecting;
            if (topSectionIntersecting) {
              mountTopGrid();
            } else {
              unmountTopGrid();
            }
          } else if (entry.target === secondSection) {
            secondSectionIntersecting = entry.isIntersecting;
            if (secondSectionIntersecting) {
              mountSecondGrid();
            } else {
              unmountSecondGrid();
            }
          }
        });
      }, {
        rootMargin: '250px 0px 250px 0px',
        threshold: 0
      });

      if (topSection) productObserver.observe(topSection);
      if (secondSection) productObserver.observe(secondSection);
    }

    // Render function
    const renderGrid = () => {
      if (!topGrid && !secondGrid) return;

      let activeProducts = products.filter(p => p.status === 'Active');
      activeProducts.sort((a, b) => {
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

      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      const hasDiscount = localStorage.getItem("minara_discount_5") === "active";

      // Pre-compute review summaries into O(1) map for zero-lag rendering
      const reviewStatsMap = {};
      if (allReviews && allReviews.length > 0) {
        allReviews.forEach(r => {
          if (r.productId && r.rating) {
            if (!reviewStatsMap[r.productId]) reviewStatsMap[r.productId] = { total: 0, count: 0 };
            reviewStatsMap[r.productId].total += Number(r.rating);
            reviewStatsMap[r.productId].count++;
          }
        });
      }

      const formatBrandName = (brandName) => {
        if (!brandName) return "";
        return brandName.replace(/\w\S*/g, (txt) => {
          const lower = txt.toLowerCase();
          if (lower === 'jpg') return 'JPG';
          if (lower === 'le') return 'Le';
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
      };

      const buildCardHtml = (p) => {
        const rawName = p.name ? p.name.replace(/<br>/gi, ' ').replace(/\s+/g, ' ').trim() : "";
        const tSrc = getThumbnailImageUrl(p.image, p.image_thumb);
        const inspiredMatch = rawName.match(/^inspired\s+by\s+(.+)/i);

        let inspiredHtml = '';
        let titleText = rawName;
        if (inspiredMatch || p.id.startsWith("inspired-by-")) {
          const fragranceName = inspiredMatch ? inspiredMatch[1] : rawName;
          titleText = p.nameShort || rawName;
          inspiredHtml = `<span style="font-family:'Gotham Narrow Bold', sans-serif; font-size: 7px; font-weight: bold; color: #999999; letter-spacing: 1.2px; text-transform: uppercase; display: block; margin-bottom: 1px;">INSPIRED BY</span><i style="font-family:'Gotham Narrow Bold', sans-serif; font-style: italic; font-weight: 500; font-size: 9.5px; text-transform: uppercase; color: #444444; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">${formatBrandName(fragranceName)}</i>`;
        } else if (p.isBundle) { titleText = 'PICK ANY 2 / 50ML'; }

        let starsHtml = '';
        let reviewsCountText = '(0)';
        let reviewsOpacity = '0.35';
        const rStat = reviewStatsMap[p.id];
        if (rStat && rStat.count > 0) {
          const avg = rStat.total / rStat.count;
          const rounded = Math.round(avg);
          reviewsCountText = `(${rStat.count})`;
          reviewsOpacity = '1';
          for (let i = 1; i <= 5; i++) {
            if (i <= rounded) {
              starsHtml += `<svg width="13" height="13" viewBox="0 0 24 24" fill="#cea44c" stroke="#cea44c" stroke-width="1.5" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            } else {
              starsHtml += `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cea44c" stroke-width="1.5" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            }
          }
        } else {
          starsHtml = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cea44c" stroke-width="1.5" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`.repeat(5);
        }

        let typeText = p.isBundle ? 'The Duet Bundle' : 'Extrait de Parfum';
        const retailVal = (p.retailPrice && !isNaN(p.retailPrice) && Number(p.retailPrice) > 0) ? Number(p.retailPrice) : null;
        const retailHtml = retailVal ? `<span class="hp-retail-price">${p.isBundle ? 'Value' : 'Designer'} R${formatRetailPrice(retailVal)}</span>` : '';
        let priceHtml = '';
        if (hasDiscount) {
          const salePrice = Math.round(p.price * 0.95);
          priceHtml = `<span class="sale-price">R${formatPrice(salePrice)}</span><span class="original-price">R${formatPrice(p.price)}</span>`;
        } else {
          priceHtml = `<span class="sale-price">R${formatPrice(p.price)}</span>`;
        }

        let btnHtml = '';
        if (p.stock > 0) {
          if (p.isBundle) {
            btnHtml = `<button class="add-to-cart" onclick="window.location.href='${p.url}'"><svg class="cart-icon" style="width: 12px; height: 12px;" viewBox="0 0 30 30" fill="none"><rect x="7" y="12" width="16" height="11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 12 V7 H20 V12" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>CREATE BUNDLE</span></button>`;
          } else {
            btnHtml = `<button class="add-to-cart" onclick="addToCart('${p.id}')"><svg class="cart-icon" style="width: 12px; height: 12px;" viewBox="0 0 30 30" fill="none"><rect x="7" y="12" width="16" height="11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 12 V7 H20 V12" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>ADD TO BAG</span></button>`;
          }
        } else {
          btnHtml = `<button class="add-to-cart" disabled style="opacity: 0.5; cursor: not-allowed;"><span>OUT OF STOCK</span></button>`;
        }

        return `
          <div class="home-product-card">
            <a href="${p.url}" class="product-link-anchor" style="text-decoration:none; color:inherit; display:block;">
              <div class="hp-box">
                ${tSrc ? `<img class="product-img" loading="lazy" decoding="async" src="${tSrc}" alt="${rawName}">` : ''}
                ${(p.stock > 0 && p.stock <= 2 && !p.isBundle) ? `<span class="se-card-badge">ONLY ${p.stock} LEFT</span>` : ''}
              </div>
            </a>
            <div class="hp-info">
              <a href="${p.url}" class="product-link-anchor-2" style="text-decoration:none; color:inherit; display:block;">
                <h3 class="hp-title" style="font-size:12px; color:#111; font-family:'Gotham Narrow Bold', sans-serif; font-weight:700; display:block; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:2px;">${titleText}</h3>
                <div class="hp-type" style="font-family: Georgia, serif; font-style: italic; font-size: 9px; opacity: 0.6; color: #555; letter-spacing: 0.5px; margin-top: 1px; margin-bottom: 6px; display: block;">${typeText}</div>
                <div class="hp-inspired">${inspiredHtml}</div>
                ${retailHtml}
                <div class="hp-reviews-row" style="opacity: ${reviewsOpacity}; margin-top: 4px;">
                  <span class="hp-stars">${starsHtml}</span>
                  <span class="hp-reviews-count">${reviewsCountText}</span>
                </div>
              </a>
              <div class="hp-price-action-row">
                <div class="hp-price-block">${priceHtml}</div>
                ${btnHtml}
              </div>
            </div>
          </div>
        `;
      };

      const buildPlaceholderHtml = () => `
        <div class="home-product-card">
          <div class="hp-box"></div>
          <div class="hp-info">
            <h3 class="hp-title placeholder">AWAITING REVEAL</h3>
            <div class="hp-price-action-row">
              <div class="hp-price-block placeholder"><span class="sale-price">R0</span></div>
              <button class="add-to-cart" disabled>COMING SOON</button>
            </div>
          </div>
        </div>
      `;

      const viewMoreCardHtml = `
        <div class="home-product-card mobile-view-more-card">
          <a href="catalog.html" style="text-decoration:none; color:inherit; display:block;">
            <div class="hp-box">
              <span style="font-family: 'Gotham Narrow Bold', sans-serif; font-size: 11px; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase; color: #ffffff; line-height: 1.4;">VIEW FULL CATALOG</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>
          </a>
        </div>
      `;

      // Generate Top Grid HTML string
      let topHtml = activeProducts.map(buildCardHtml).join('');
      const placeholdersNeeded = Math.max(0, 5 - activeProducts.length);
      for (let i = 0; i < placeholdersNeeded; i++) {
        topHtml += buildPlaceholderHtml();
      }
      if (isMobile) topHtml += viewMoreCardHtml;
      topGridHtml = topHtml;

      // Generate Second Grid HTML string
      const secondProducts = activeProducts.length > 3 ? [...activeProducts].reverse() : activeProducts;
      let secondHtml = secondProducts.map(buildCardHtml).join('');
      const placeholdersNeededSec = Math.max(0, 5 - secondProducts.length);
      for (let i = 0; i < placeholdersNeededSec; i++) {
        secondHtml += buildPlaceholderHtml();
      }
      if (isMobile) secondHtml += viewMoreCardHtml;
      secondGridHtml = secondHtml;

      // Apply HTML based on visibility
      if (!productObserver) {
        if (topGrid) topGrid.innerHTML = topGridHtml;
        if (secondGrid) secondGrid.innerHTML = secondGridHtml;
      } else {
        if (topSection) {
          const rect = topSection.getBoundingClientRect();
          const inViewport = rect.top <= window.innerHeight + 300 && rect.bottom >= -300;
          if (inViewport || topSectionIntersecting) {
            mountTopGrid();
          } else {
            unmountTopGrid();
          }
        }

        if (secondSection) {
          const rectSec = secondSection.getBoundingClientRect();
          const inViewportSec = rectSec.top <= window.innerHeight + 300 && rectSec.bottom >= -300;
          if (inViewportSec || secondSectionIntersecting) {
            mountSecondGrid();
          } else {
            unmountSecondGrid();
          }
        }
      }
    };

    window.renderHomeProducts = renderGrid;

    // Load local cache and render instantly!
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
          fetch("products.json"),
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
            retailPrice: data.retailPrice !== undefined && data.retailPrice !== null ? Number(data.retailPrice) : null,
            stock: Number(data.stock),
            image: data.image,
            image_thumb: data.image_thumb || "",
            status: data.status,
            flair: data.flair || "",
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
              current.invisibleFlair !== p.invisibleFlair ||
              JSON.stringify(current.customisations || []) !== JSON.stringify(p.customisations || []) ||
              current.isBundle !== p.isBundle ||
              current.bundleSize !== p.bundleSize ||
              current.sortOrder !== p.sortOrder
            ) {
              products[existingIdx] = {
                ...current,
                nameShort: p.nameShort,
                name: p.name,
                price: p.price,
                retailPrice: p.retailPrice,
                stock: p.stock,
                image: p.image,
                image_thumb: p.image_thumb,
                status: p.status,
                flair: p.flair,
                invisibleFlair: p.invisibleFlair,
                customisations: p.customisations,
                isBundle: p.isBundle,
                bundleSize: p.bundleSize,
                sortOrder: p.sortOrder
              };
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

          // Remove products deleted from repository but lingering in cache
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

              products = [];
              cleanedLocalProds.forEach(p => {
                products.push({
                  id: p.id,
                  nameShort: p.nameShort || "",
                  name: p.name,
                  price: p.price,
                  retailPrice: p.retailPrice || null,
                  stock: p.stock,
                  image: p.image,
                  image_thumb: p.image_thumb || "",
                  status: p.status,
                  flair: p.flair || "",
                  invisibleFlair: p.invisibleFlair || "",
                  isBundle: !!p.isBundle,
                  bundleSize: Number(p.bundleSize) || 0,
                  sortOrder: p.sortOrder !== undefined && p.sortOrder !== null ? Number(p.sortOrder) : null,
                  url: `template product.html?id=${p.id}`
                });
              });
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
    }, 0);

    window.addEventListener("minaraDiscountActivated", () => {
      renderGrid();
    });

    let lastWasMobile = window.matchMedia("(max-width: 900px)").matches;
    window.addEventListener("resize", () => {
      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      if (isMobile !== lastWasMobile) {
        lastWasMobile = isMobile;
        renderGrid();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomeProducts);
  } else {
    initHomeProducts();
  }
})();
