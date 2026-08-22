// Studio Extrait - Bundle Fragrance Selector & Scent Drawer Module

(function() {
  if (!window.selectScentCallbacks) {
    window.selectScentCallbacks = {};
  }
  let activeSlotIndex = null;

  function defaultFormatBrandName(brandName) {
    if (!brandName) return "";
    return brandName.replace(/\w\S*/g, (txt) => {
      const lower = txt.toLowerCase();
      if (lower === 'jpg') return 'JPG';
      if (lower === 'le') return 'Le';
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  function getThumbnailUrl(item) {
    let img = '';
    if (item.image_thumb) {
      img = item.image_thumb;
    } else if (item.image) {
      img = item.image.split(',')[0].trim();
    }
    return img ? img : 'Studio Extrait Icon Svg only logo.svg';
  }

  function setupBundleSelectors(p, catalogList, reviewsMapData) {
    const container = document.getElementById("bundlePickerContainer");
    const wrap = document.getElementById("bundleChoicesWrap");
    const addToBagBtn = document.getElementById("addToBagBtn") || document.getElementById("addToBagButton") || document.querySelector(".add-to-cart") || document.querySelector(".add-to-bag-btn");
    if (!container || !wrap) return;

    let activeCatalogFragrances = catalogList || window.activeCatalogFragrances || [];
    if (activeCatalogFragrances.length === 0) {
      try {
        const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
        activeCatalogFragrances = localProds.filter(prod => prod.status === "Active" && prod.isBundle !== true && prod.isBundle !== "true");
      } catch (e) { }
    }
    const reviewsMap = reviewsMapData || window.reviewsMap || {};
    const formatBrandName = window.formatBrandName || defaultFormatBrandName;

    container.style.display = "block";
    wrap.innerHTML = "";

    const bundleSize = Number(p.bundleSize) || 1;
    const selectedScents = Array(bundleSize).fill(null);

    // Load pending selections from sessionStorage (e.g. from bundleView redirects)
    try {
      const pending = JSON.parse(sessionStorage.getItem("bundle_selections_pending") || "{}");
      Object.keys(pending).forEach(slotIdx => {
        const idx = Number(slotIdx);
        if (idx >= 0 && idx < bundleSize) {
          const item = pending[idx];
          if (item) {
            if (!item.inspiredBy && item.id) {
              const fullP = activeCatalogFragrances.find(fp => fp.id === item.id);
              if (fullP) {
                const m = fullP.name ? fullP.name.match(/Inspired\s+by\s+(.+)/i) : null;
                if (m) {
                  item.inspiredBy = m[1];
                } else if (fullP.id && fullP.id.startsWith("inspired-by-")) {
                  item.inspiredBy = fullP.name;
                }
              }
            }
            selectedScents[idx] = item;
          }
        }
      });
    } catch (err) {
      console.error("Error reading pending bundle selections:", err);
    }

    const renderDropdownList = (dropdownEl, queryText, index, inputEl, displayBox, inputBox, selectedImgEl, selectedNameEl, selectedInspiredEl) => {
      dropdownEl.innerHTML = "";
      let matches = [];

      if (!queryText.trim()) {
        matches = activeCatalogFragrances.map(prod => ({
          type: 'direct',
          product: prod
        }));
      } else {
        const query = queryText.toLowerCase().trim();

        const matchedStoreProds = activeCatalogFragrances.filter(prod => {
          const nameMatches = (prod.name || "").toLowerCase().includes(query) || (prod.nameShort || "").toLowerCase().includes(query);
          const idMatches = (prod.id || "").toLowerCase().includes(query);
          const flairMatches = (prod.flair || "").toLowerCase().includes(query) || (prod.invisibleFlair || "").toLowerCase().includes(query);
          return nameMatches || idMatches || flairMatches;
        });

        let matchedFromPopular = [];
        if (window.findSearchMatchedProductIds) {
          try {
            const matchedIds = window.findSearchMatchedProductIds(queryText);
            if (matchedIds && matchedIds.length > 0) {
              matchedIds.forEach(id => {
                const foundProd = activeCatalogFragrances.find(prod => prod.id === id);
                if (foundProd && !matchedStoreProds.some(sp => sp.id === foundProd.id)) {
                  matchedFromPopular.push(foundProd);
                }
              });
            }
          } catch (err) {
            console.error("Search algorithm execution error:", err);
          }
        }

        matchedStoreProds.forEach(prod => {
          matches.push({ type: 'direct', product: prod });
        });
        matchedFromPopular.forEach(prod => {
          matches.push({ type: 'recommendation', product: prod });
        });
      }

      if (matches.length === 0) {
        dropdownEl.innerHTML = `<div style="font-size: 10px; opacity: 0.5; padding: 12px; font-style: italic; text-transform: uppercase; letter-spacing: 0.5px;">No matches found</div>`;
        return;
      }

      if (!queryText.trim()) {
        const headerEl = document.createElement("div");
        headerEl.style.cssText = "font-size: 8px; font-weight: bold; opacity: 0.4; padding: 10px 14px 4px 14px; text-transform: uppercase; letter-spacing: 1px; color: #000; border-bottom: 1px solid #f2f2f2;";
        headerEl.textContent = "POPULAR PICKS";
        dropdownEl.appendChild(headerEl);
      }

      matches.forEach(match => {
        const prod = match.product;
        const itemEl = document.createElement("div");
        itemEl.className = "bundle-dropdown-item";
        itemEl.style.cssText = "display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f9f9f9; cursor: pointer; justify-content: space-between; width: 100%; box-sizing: border-box;";

        const thumb = getThumbnailUrl(prod);
        const displayName = prod.nameShort || prod.name;

        let inspiredByText = "";
        const inspiredMatch = prod.name ? prod.name.match(/Inspired\s+by\s+(.+)/i) : null;
        if (inspiredMatch) {
          inspiredByText = inspiredMatch[1];
        } else if (prod.id && prod.id.startsWith("inspired-by-")) {
          inspiredByText = prod.name;
        }

        let descHtml = inspiredByText
          ? `<span style="font-size: 8.5px; color: #777; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">INSPIRED BY ${inspiredByText.toUpperCase()}</span>`
          : `<span style="font-size: 9px; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.5px;">${prod.flair || "Extrait de Parfum"}</span>`;

        if (match.type === 'recommendation') {
          descHtml = `<span style="font-size: 8px; color: #1106e8; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">RECOMMENDED MATCH</span>`;
        }

        const leftContainer = document.createElement("div");
        leftContainer.style.cssText = "display: flex; align-items: center; gap: 10px; min-width: 0; flex-grow: 1;";
        leftContainer.innerHTML = `
          <img src="${thumb}" style="width: 28px; height: 38px; object-fit: contain; flex-shrink: 0; border: 1px solid #eaeaea; background: #fff;">
          <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
            <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayName}</span>
            ${descHtml}
          </div>
        `;

        const viewLink = document.createElement("a");
        viewLink.href = "#";
        viewLink.textContent = "ADD";
        viewLink.style.cssText = "font-size: 9px; color: #fff; background: #000; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; text-decoration: none; padding: 5px 12px; flex-shrink: 0; user-select: none; z-index: 10; border: none; text-align: center; display: inline-flex; align-items: center; justify-content: center; min-width: 45px; height: 24px; box-sizing: border-box; border-radius: 0;";

        const handleSelectProduct = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          selectedScents[index] = {
            id: prod.id,
            name: prod.name,
            nameShort: prod.nameShort || prod.name,
            image: thumb,
            inspiredBy: inspiredByText
          };

          try {
            const pending = JSON.parse(sessionStorage.getItem("bundle_selections_pending") || "{}");
            pending[index] = selectedScents[index];
            sessionStorage.setItem("bundle_selections_pending", JSON.stringify(pending));
          } catch (err) { }

          selectedNameEl.textContent = (prod.nameShort || prod.name).toUpperCase();
          selectedInspiredEl.innerHTML = inspiredByText ? `<span style="opacity: 0.6; font-size: 8px;">INSPIRED BY</span> ${inspiredByText.toUpperCase()}` : "";
          selectedImgEl.src = thumb;

          inputBox.style.display = "none";
          displayBox.style.display = "flex";
          dropdownEl.style.display = "none";

          updateAddToBagBtnState();
        };

        itemEl.appendChild(leftContainer);
        itemEl.appendChild(viewLink);

        viewLink.onclick = handleSelectProduct;
        leftContainer.onclick = handleSelectProduct;
        itemEl.onclick = handleSelectProduct;

        dropdownEl.appendChild(itemEl);
      });
    };

    const originalDisplay = addToBagBtn ? (addToBagBtn.style.display && addToBagBtn.style.display !== "none" ? addToBagBtn.style.display : "block") : "block";

    const syncScentProfile = () => {
      if (typeof window.renderProductScentProfile === 'function') {
        window.renderProductScentProfile(p, selectedScents, activeCatalogFragrances);
      }
    };

    const updateAddToBagBtnState = () => {
      syncScentProfile();
      if (!addToBagBtn) return;

      if (p.stock <= 0) {
        addToBagBtn.style.display = originalDisplay;
        addToBagBtn.innerHTML = "OUT OF STOCK";
        addToBagBtn.disabled = true;
        addToBagBtn.style.opacity = "0.5";
        addToBagBtn.style.cursor = "not-allowed";
        return;
      }

      const allSelected = selectedScents.every(s => s !== null);
      if (allSelected) {
        addToBagBtn.style.display = originalDisplay;
        const selectionsLabel = selectedScents.map(s => (s.nameShort || s.name || "").toUpperCase()).join(" + ");
        addToBagBtn.innerHTML = `ADD TO BAG (${selectionsLabel})`;
        addToBagBtn.disabled = false;
        addToBagBtn.style.opacity = "";
        addToBagBtn.style.cursor = "pointer";
      } else {
        addToBagBtn.style.display = originalDisplay;
        addToBagBtn.innerHTML = "ADD TO BAG";
        addToBagBtn.disabled = false;
        addToBagBtn.style.opacity = "1";
        addToBagBtn.style.cursor = "pointer";
      }
    };

    for (let i = 0; i < bundleSize; i++) {
      const slot = document.createElement("div");
      slot.className = "bundle-choice-slot";

      const hasPreselected = selectedScents[i] !== null;
      let preInspiredText = "";
      if (hasPreselected) {
        let isp = selectedScents[i].inspiredBy || "";
        if (!isp && selectedScents[i].id) {
          const fullP = activeCatalogFragrances.find(fp => fp.id === selectedScents[i].id);
          if (fullP) {
            const m = fullP.name ? fullP.name.match(/Inspired\s+by\s+(.+)/i) : null;
            if (m) {
              isp = m[1];
            } else if (fullP.id && fullP.id.startsWith("inspired-by-")) {
              isp = fullP.name;
            }
          }
        }
        if (isp) {
          preInspiredText = `<span style="opacity: 0.6; font-size: 8px;">INSPIRED BY</span> ` + isp.toUpperCase();
        }
      }

      slot.innerHTML = `
        <div class="bundle-scent-display-box" style="display: ${hasPreselected ? 'flex' : 'none'}; align-items: center; gap: 12px; border: 0.5px solid #000; padding: 12px 15px; margin-bottom: 6px; min-height: 48px; box-sizing: border-box; width: 100%;">
          <img class="selected-scent-img" src="${hasPreselected ? selectedScents[i].image : ''}" style="width: 24px; height: 32px; object-fit: contain; flex-shrink: 0; border: none; background: transparent;">
          <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0;">
            <span class="selected-scent-name" style="font-size: 11px; font-weight: normal; text-transform: uppercase; letter-spacing: 0.5px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${hasPreselected ? (selectedScents[i].nameShort || selectedScents[i].name).toUpperCase() : ''}</span>
            <span class="selected-scent-inspired" style="font-size: 8.5px; color: #777; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${preInspiredText}</span>
          </div>
          <span class="bundle-scent-switch" style="cursor: pointer; font-size: 9px; color: #000; font-weight: normal; letter-spacing: 0.5px; text-transform: uppercase; text-decoration: underline; flex-shrink: 0; user-select: none;">SWITCH</span>
        </div>

        <div class="bundle-scent-input-box" style="position: relative; display: ${hasPreselected ? 'none' : 'flex'}; align-items: center; border: 0.5px solid #000; padding: 12px 15px; margin-bottom: 6px; min-height: 48px; box-sizing: border-box; width: 100%;">
          <input type="text" class="bundle-scent-input" placeholder="SELECT FRAGRANCE ${i + 1} →" autocomplete="off" style="border: none; width: 100%; font-size: 10.5px; outline: none; font-family: inherit; letter-spacing: 0.5px; text-transform: uppercase; background: transparent; color: #000;">
        </div>
        
        <div class="bundle-dropdown" style="display: none; position: absolute; left: 0; right: 0; top: 100%; background: #fff; border: 1px solid #000; border-top: none; z-index: 1000; max-height: 220px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></div>
      `;

      const displayBox = slot.querySelector(".bundle-scent-display-box");
      const selectedImgEl = slot.querySelector(".selected-scent-img");
      const selectedNameEl = slot.querySelector(".selected-scent-name");
      const selectedInspiredEl = slot.querySelector(".selected-scent-inspired");
      const switchBtn = slot.querySelector(".bundle-scent-switch");

      const inputBox = slot.querySelector(".bundle-scent-input-box");
      const inputEl = slot.querySelector(".bundle-scent-input");
      const dropdownEl = slot.querySelector(".bundle-dropdown");

      window.selectScentCallbacks[i] = (productSelected) => {
        selectedScents[i] = {
          id: productSelected.id,
          name: productSelected.name,
          nameShort: productSelected.nameShort || productSelected.name,
          image: productSelected.image_thumb || productSelected.image,
          inspiredBy: productSelected.name ? (productSelected.name.match(/Inspired\s+by\s+(.+)/i) ? productSelected.name.match(/Inspired\s+by\s+(.+)/i)[1] : "") : ""
        };

        try {
          const pending = JSON.parse(sessionStorage.getItem("bundle_selections_pending") || "{}");
          pending[i] = selectedScents[i];
          sessionStorage.setItem("bundle_selections_pending", JSON.stringify(pending));
        } catch (err) { }

        selectedImgEl.src = productSelected.image_thumb || productSelected.image;
        selectedNameEl.textContent = (productSelected.nameShort || productSelected.name).toUpperCase() + " - 50ML";

        let inspiredText = "";
        const match = productSelected.name ? productSelected.name.match(/Inspired\s+by\s+(.+)/i) : null;
        if (match || (productSelected.id && productSelected.id.startsWith("inspired-by-"))) {
          const fragranceName = match ? match[1] : productSelected.name;
          inspiredText = formatBrandName(fragranceName);
        } else {
          inspiredText = productSelected.name;
        }
        selectedInspiredEl.innerHTML = inspiredText ? `<span style="opacity: 0.6; font-size: 8px;">INSPIRED BY</span> ${inspiredText.toUpperCase()}` : "";

        inputBox.style.display = "none";
        displayBox.style.display = "flex";
        dropdownEl.style.display = "none";

        updateAddToBagBtnState();
      };

      if (window.innerWidth <= 900) {
        inputEl.readOnly = true;
        inputEl.style.cursor = "pointer";
        inputEl.style.pointerEvents = "none";
        inputBox.style.cursor = "pointer";
      }

      const openSelectorAction = (e) => {
        e.stopPropagation();
        if (window.innerWidth <= 900) {
          window.openScentDrawer(i, p, activeCatalogFragrances, reviewsMap, formatBrandName);
        } else {
          document.querySelectorAll(".bundle-dropdown").forEach(d => {
            if (d !== dropdownEl) d.style.display = "none";
          });
          renderDropdownList(dropdownEl, inputEl.value, i, inputEl, displayBox, inputBox, selectedImgEl, selectedNameEl, selectedInspiredEl);
          dropdownEl.style.display = "block";
        }
      };

      inputEl.onclick = openSelectorAction;
      inputBox.onclick = (e) => {
        if (window.innerWidth <= 900) {
          openSelectorAction(e);
        }
      };

      inputEl.oninput = () => {
        if (window.innerWidth > 900) {
          renderDropdownList(dropdownEl, inputEl.value, i, inputEl, displayBox, inputBox, selectedImgEl, selectedNameEl, selectedInspiredEl);
          dropdownEl.style.display = "block";
          if (!inputEl.value.trim()) {
            selectedScents[i] = null;
            updateAddToBagBtnState();
          }
        }
      };

      switchBtn.onclick = (e) => {
        e.stopPropagation();
        selectedScents[i] = null;

        try {
          const pending = JSON.parse(sessionStorage.getItem("bundle_selections_pending") || "{}");
          delete pending[i];
          sessionStorage.setItem("bundle_selections_pending", JSON.stringify(pending));
        } catch (err) { }

        inputEl.value = "";
        displayBox.style.display = "none";
        inputBox.style.display = "flex";
        updateAddToBagBtnState();

        if (window.innerWidth <= 900) {
          setTimeout(() => {
            window.openScentDrawer(i, p, activeCatalogFragrances, reviewsMap, formatBrandName);
          }, 50);
        } else {
          setTimeout(() => {
            inputEl.click();
          }, 50);
        }
      };

      wrap.appendChild(slot);
    }

    const handleDocClick = () => {
      document.querySelectorAll(".bundle-dropdown").forEach(d => d.style.display = "none");
    };
    document.removeEventListener("click", handleDocClick);
    document.addEventListener("click", handleDocClick);

    addToBagBtn.onclick = (e) => {
      if (e) e.stopPropagation();
      if (p.stock <= 0) return;
      const emptyIndex = selectedScents.findIndex(s => s === null);
      if (emptyIndex !== -1) {
        if (window.innerWidth <= 900) {
          window.openScentDrawer(emptyIndex, p, activeCatalogFragrances, reviewsMap, formatBrandName);
        } else {
          const slots = wrap.querySelectorAll(".bundle-choice-slot");
          if (slots[emptyIndex]) {
            const inputEl = slots[emptyIndex].querySelector(".bundle-scent-input");
            if (inputEl) {
              inputEl.click();
              inputEl.focus();
            }
          }
        }
        return;
      }
      const bundleSizeText = bundleSize + "x 50ml";
      window.addToCart(p.id, bundleSizeText, selectedScents);
      sessionStorage.removeItem("bundle_selections_pending");
    };

    updateAddToBagBtnState();
  }

  function renderDrawerList(catalogList, reviewsMapData, formatBrandNameFn, parentProduct) {
    const listEl = document.getElementById("drawerScentList");
    if (!listEl) return;
    listEl.innerHTML = "";

    const activeCatalogFragrances = catalogList || window.activeCatalogFragrances || [];
    const reviewsMap = reviewsMapData || window.reviewsMap || {};
    const formatBrandName = formatBrandNameFn || window.formatBrandName || defaultFormatBrandName;
    const p = parentProduct || window.product || {};

    if (activeCatalogFragrances.length === 0) {
      listEl.innerHTML = `<div style="font-size:10px; opacity:0.5; padding: 20px 0; text-align:center; letter-spacing:1px;">NO FRAGRANCES FOUND</div>`;
      return;
    }

    activeCatalogFragrances.forEach(fp => {
      const row = document.createElement("div");
      row.className = "drawer-item";

      let inspiredText = "";
      const match = fp.name ? fp.name.match(/Inspired\s+by\s+(.+)/i) : null;
      if (match || (fp.id && fp.id.startsWith("inspired-by-"))) {
        const fragranceName = match ? match[1] : fp.name;
        inspiredText = `Inspired by ${formatBrandName(fragranceName)}`;
      } else {
        inspiredText = fp.name;
      }

      const imgSrc = fp.image_thumb || fp.image;
      const ratingData = reviewsMap[fp.id];
      let reviewsHTML = "";
      if (ratingData && ratingData.count > 0) {
        const avg = (ratingData.total / ratingData.count).toFixed(1);
        reviewsHTML = `
          <div class="drawer-item-reviews" style="display: flex; align-items: center; gap: 2px; margin-top: 2px;">
            <span style="color: #000; font-size: 9px; letter-spacing: 0.5px; line-height: 1;">★</span>
            <span style="font-size: 8px; font-weight: bold; color: #000; line-height: 1;">${avg}</span>
            <span style="font-size: 8px; color: #888; line-height: 1;">(${ratingData.count})</span>
          </div>
        `;
      } else {
        reviewsHTML = `
          <div class="drawer-item-reviews" style="display: flex; align-items: center; gap: 2px; margin-top: 2px;">
            <span style="color: #ccc; font-size: 9px; letter-spacing: 0.5px; line-height: 1;">★</span>
            <span style="font-size: 8px; color: #888; line-height: 1;">(0)</span>
          </div>
        `;
      }

      row.style.cssText = "display: flex; flex-direction: column; padding: 12px 0; border-bottom: 1px solid #eee; transition: all 0.3s ease;";
      row.innerHTML = `
        <div class="drawer-item-main" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; width: 100%;">
          <div class="drawer-item-left" style="display: flex; align-items: center; gap: 12px; min-width: 0; flex-grow: 1;">
            <div class="drawer-item-img-box" style="width: 50px; height: 50px; background: #fbfbfb; display: flex; align-items: center; justify-content: center; border: 1px solid #eaeaea; border-radius: 4px; overflow: hidden; flex-shrink: 0;">
              <img class="drawer-item-img loaded" src="${imgSrc}" alt="${fp.nameShort || fp.name}" style="width: 100%; height: 100%; object-fit: contain;">
            </div>
            <div class="drawer-item-info" style="flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0;">
              <span class="drawer-item-name" style="font-family: 'Gotham Narrow Bold', sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${(fp.nameShort || fp.name).toUpperCase()}</span>
              <span class="drawer-item-inspired" style="font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${inspiredText.toUpperCase()} - 50ML</span>
              ${reviewsHTML}
            </div>
          </div>
          <button class="drawer-item-add-btn" style="background: #000; color: #fff; border: none; padding: 8px 16px; font-family: 'Gotham Narrow Bold', sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; font-weight: bold; border-radius: 2px; transition: background 0.2s; white-space: nowrap; flex-shrink: 0;">ADD</button>
        </div>
        <div class="drawer-item-expanded" style="max-height: 0; overflow: hidden; transition: max-height 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); padding-left: 62px;">
          <a href="template product.html?id=${fp.id}&bundleView=true&bundleParent=${p.id || ''}&bundleSlot=${activeSlotIndex}" style="display: inline-block; font-size: 10px; color: #1106e8; font-weight: bold; letter-spacing: 1px; text-decoration: underline; text-transform: uppercase; padding: 6px 0 2px 0;">VIEW PRODUCT PAGE</a>
        </div>
      `;

      const leftSec = row.querySelector('.drawer-item-left');
      const expandedArea = row.querySelector('.drawer-item-expanded');

      leftSec.onclick = (e) => {
        e.stopPropagation();
        const isCurrentlyExpanded = expandedArea.style.maxHeight === "30px";
        document.querySelectorAll('.drawer-item-expanded').forEach(el => {
          el.style.maxHeight = "0px";
          if (el.parentNode) el.parentNode.style.paddingBottom = "12px";
        });

        if (!isCurrentlyExpanded) {
          expandedArea.style.maxHeight = "30px";
          row.style.paddingBottom = "18px";
        } else {
          expandedArea.style.maxHeight = "0px";
          row.style.paddingBottom = "12px";
        }
      };

      const addBtn = row.querySelector('.drawer-item-add-btn');
      addBtn.onclick = (e) => {
        e.stopPropagation();
        if (window.selectScentCallbacks && window.selectScentCallbacks[activeSlotIndex]) {
          window.selectScentCallbacks[activeSlotIndex](fp);
        }
        closeScentDrawer();
      };

      listEl.appendChild(row);
    });
  }

  function openScentDrawer(index, parentProduct, catalogList, reviewsMapData, formatBrandNameFn) {
    activeSlotIndex = index;
    const drawer = document.getElementById("mobileScentDrawer");
    renderDrawerList(catalogList, reviewsMapData, formatBrandNameFn, parentProduct);
    if (drawer) drawer.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeScentDrawer() {
    const drawer = document.getElementById("mobileScentDrawer");
    if (drawer) drawer.classList.remove("active");
    document.body.style.overflow = "";
    activeSlotIndex = null;
  }

  // Global window bindings
  window.setupBundleSelectors = setupBundleSelectors;
  window.openScentDrawer = openScentDrawer;
  window.closeScentDrawer = closeScentDrawer;
})();
