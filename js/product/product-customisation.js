// Studio Extrait - Product Bottle Customisation & Cap Picker Module

(function() {
  window.selectedBottleCustomisation = null;
  window.selectedBottlePriceExtra = 0;
  window.selectedBottleCustomisationPrice = null;
  window.currentBottleCustomisationOptions = [];

  // Helper to render bottle customisation boxes (Stussy style picker)
  function renderBottleCustomisation(p) {
    if (!p) return;
    const container = document.getElementById("bottleCustomisationContainer");
    const boxesWrap = document.getElementById("bottleCustomisationBoxes");
    const labelSpan = document.getElementById("selectedBottleLabel");
    if (!container || !boxesWrap) return;

    if (p.isBundle) {
      container.style.display = "none";
      window.selectedBottleCustomisation = null;
      window.selectedBottlePriceExtra = 0;
      window.selectedBottleCustomisationPrice = null;
      return;
    }

    container.style.display = "block";
    boxesWrap.innerHTML = "";

    const flairLower = (p.flair || "").toLowerCase();
    const invFlairLower = (p.invisibleFlair || "").toLowerCase();

    const isFeminine = flairLower.includes("feminine") || invFlairLower === "women";
    const isMasculine = flairLower.includes("masculine") || invFlairLower === "men";
    const isUnisex = flairLower.includes("unisex") || invFlairLower === "unisex";

    let options = [];

    // Standard Option (Box #1) is ALWAYS present by default (R0 extra)
    const stdImg = p.standardBottleImg || (p.image ? p.image.split(',')[0].trim() : "");
    const stdThumb = p.standardBottleImgThumb || p.image_thumb || (p.image ? p.image.split(',')[0].trim() : "");

    const standardOption = {
      id: "standard",
      label: "STANDARD",
      size: "50ml",
      img: stdImg,
      thumbImg: stdThumb,
      fallbackImg: stdImg,
      title: "Standard Bottle",
      priceExtra: 0,
      stock: (p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0
    };

    if (p.customisations && Array.isArray(p.customisations) && p.customisations.length > 0) {
      // Check if admin explicitly included a STANDARD block
      const hasExplicitStandard = p.customisations.some(c => (c.label || "").toUpperCase().trim() === "STANDARD");

      if (!hasExplicitStandard) {
        options.push(standardOption);
      }

      p.customisations.forEach((c, idx) => {
        const lbl = (c.label || `OPTION ${idx + 1}`).toUpperCase().trim();
        const optSize = c.size || c.ml || (lbl.includes("100ML") ? "100ml" : "50ml");
        const is100ml = optSize.toLowerCase().includes("100ml") || lbl.includes("100ML");
        const basePrice = Number(p.price) || 0;
        
        let extra = 0;
        if (c.priceExtra !== undefined && c.priceExtra !== null) {
          extra = Number(c.priceExtra);
        } else if (lbl.includes("PREMIUM")) {
          extra = 145;
        } else if (is100ml && basePrice <= 550) {
          extra = 254; // 100ml upgrade from R495 base to R749
        }

        // Admin can set one official (absolute) price per customisation block.
        const hasFlatPrice = c.price !== undefined && c.price !== null && c.price !== "";
        const flatPrice = hasFlatPrice ? Number(c.price) : null;

        let defaultFallback = "";
        if (lbl.includes("STANDARD")) {
          defaultFallback = p.standardBottleImg || (p.image ? p.image.split(',')[0].trim() : "");
        } else if (lbl.includes("HER") || (isFeminine && !lbl.includes("HIM"))) {
          defaultFallback = p.femininePremiumBottleImg || p.masculinePremiumBottleImg || "";
        } else {
          defaultFallback = p.masculinePremiumBottleImg || p.femininePremiumBottleImg || "";
        }

        const mainImg = c.image_data || (c.image && c.image.trim() ? c.image.trim() : defaultFallback);
        const thumbImg = c.image_data || (c.image_thumb && c.image_thumb.trim() ? c.image_thumb.trim() : (c.image || defaultFallback));

        options.push({
          id: (c.label || "option").toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          label: lbl,
          size: optSize,
          img: mainImg,
          thumbImg: thumbImg,
          dataImg: c.image_data || (c.image && c.image.startsWith("data:") ? c.image : ""),
          fallbackImg: defaultFallback,
          title: c.label || "Custom Option",
          price: flatPrice,
          priceExtra: extra,
          stock: c.stock !== undefined && c.stock !== null ? Number(c.stock) : null
        });
      });
    } else {
      options.push(standardOption);
    }

    if (options.length <= 1) {
      container.style.display = "none";
      window.selectedBottleCustomisation = options[0] ? options[0].label : null;
      window.selectedBottlePriceExtra = 0;
      window.selectedBottleCustomisationPrice = null;
      return;
    }

    container.style.display = "block";

    // URL parameter pre-selection for gifts and custom presentation boxes
    const urlParams = new URLSearchParams(window.location.search);
    const custParam = urlParams.get('customisation');
    if (custParam !== null) {
      const paramNum = parseInt(custParam, 10);
      if (!isNaN(paramNum) && p.customisations && p.customisations[paramNum]) {
        const targetLbl = (p.customisations[paramNum].label || '').toUpperCase().trim();
        const matchOpt = options.find(o => o.label.toUpperCase().trim() === targetLbl);
        if (matchOpt) {
          window.selectedBottleCustomisation = matchOpt.label;
        }
      } else {
        const matchOpt = options.find(o => o.label.toLowerCase() === custParam.toLowerCase() || o.id.toLowerCase() === custParam.toLowerCase());
        if (matchOpt) {
          window.selectedBottleCustomisation = matchOpt.label;
        }
      }
    }

    // Default selection: Standard if unset or invalid
    if (!window.selectedBottleCustomisation || !options.some(o => o.label === window.selectedBottleCustomisation)) {
      window.selectedBottleCustomisation = options[0].label;
    }

    const updateMainSliderImage = (opt) => {
      const targetImg = (opt.img && opt.img.trim()) ? opt.img.trim() : (opt.fallbackImg || (p.image ? p.image.split(',')[0].trim() : ""));
      const rawImages = p.galleryImages && Array.isArray(p.galleryImages) && p.galleryImages.length > 0 
        ? p.galleryImages 
        : (p.image ? (p.image.startsWith('data:') ? [p.image] : p.image.split(',').map(s => s.trim()).filter(Boolean)) : []);
      
      const remainingGallery = rawImages.slice(1);
      const fullImagesList = targetImg ? [targetImg, ...remainingGallery] : rawImages;
      if (typeof window.renderProductGallery === 'function') {
        window.renderProductGallery(fullImagesList, p);
      }
    };

    const updateProductPriceDisplay = (opt) => {
      const basePrice = Number(p.price) || 0;
      const hasFlat = opt && opt.price !== undefined && opt.price !== null && opt.price !== "";
      let totalPrice;
      if (hasFlat) {
        // Official absolute price set by admin for this customisation block.
        window.selectedBottleCustomisationPrice = Number(opt.price);
        window.selectedBottlePriceExtra = 0;
        totalPrice = Number(opt.price);
      } else {
        // Legacy: base bottle price + extra add-on.
        window.selectedBottleCustomisationPrice = null;
        const extra = (opt && opt.priceExtra !== undefined && opt.priceExtra !== null) ? Number(opt.priceExtra) : 0;
        window.selectedBottlePriceExtra = extra;
        totalPrice = basePrice + extra;
      }

      let finalPrice = totalPrice;
      if (window.activeDiscount) {
        const discVal = Number(window.activeDiscount.discount_value) || 0;
        const discType = window.activeDiscount.discount_type;
        if (discType === 'fixed') {
          finalPrice = Math.max(0, totalPrice - discVal);
        } else if (discType === 'percentage') {
          finalPrice = Math.max(0, totalPrice * (1 - discVal / 100));
        }
      } else {
        const hasDiscount5 = localStorage.getItem("minara_discount_5") === "active";
        if (hasDiscount5) {
          finalPrice = Math.round(totalPrice * 0.95);
        }
      }

      const priceEl = document.getElementById("productPrice") || document.querySelector(".product-price");
      if (priceEl) {
        const isTopup = !!(document.body && document.body.classList.contains('topup'));
        if (isTopup) {
          // Upsell second-bottle offer: crossed-out official price + blue discounted price.
          const topupPrice = Math.max(0, totalPrice - 241);
          priceEl.innerHTML = `<span style="text-decoration:line-through; opacity:0.5; font-size:0.85em; margin-right:6px;">R ${Math.round(totalPrice).toLocaleString()}</span><span style="color:#1106e8; font-weight:bold;">R ${Math.round(topupPrice).toLocaleString()}</span>`;
        } else if (window.activeDiscount) {
          priceEl.innerHTML = `<span style="text-decoration:line-through; opacity:0.5; font-size:0.85em; margin-right:6px;">R ${totalPrice.toLocaleString()}</span> R ${Math.round(finalPrice).toLocaleString()}`;
        } else {
          priceEl.textContent = `R ${finalPrice.toLocaleString()}`;
        }
      }

      const shippingEl = document.getElementById("complimentaryShippingText");
      if (shippingEl) {
        if (finalPrice > 645) {
          shippingEl.style.display = "flex";
        } else {
          shippingEl.style.display = "none";
        }
      }
    };

    const updateCustomisationButtonState = (selectedOpt) => {
      const addToBagBtn = document.getElementById("addToBagButton") || document.querySelector(".add-to-bag-btn");
      if (!addToBagBtn) return;

      const isOptOOS = (selectedOpt && selectedOpt.stock !== undefined && selectedOpt.stock !== null && Number(selectedOpt.stock) <= 0) || (Number(p.stock) <= 0);
      const notifyContainer = document.getElementById("outOfStockNotifyContainer");
      const notifyForm = document.getElementById("outOfStockNotifyForm");
      const notifySuccess = document.getElementById("outOfStockNotifySuccess");

      if (isOptOOS) {
        addToBagBtn.innerHTML = "OUT OF STOCK";
        addToBagBtn.disabled = true;
        addToBagBtn.style.opacity = "0.5";
        addToBagBtn.style.cursor = "not-allowed";

        if (notifyContainer) {
          notifyContainer.style.display = "block";
          if (notifyForm) notifyForm.style.display = "flex";
          if (notifySuccess) notifySuccess.style.display = "none";
        }
      } else {
        addToBagBtn.innerHTML = "ADD TO BAG";
        addToBagBtn.disabled = false;
        addToBagBtn.style.opacity = "";
        addToBagBtn.style.cursor = "pointer";

        if (notifyContainer) {
          notifyContainer.style.display = "none";
        }
      }
    };

    options.forEach(opt => {
      const isOptOutOfStock = opt.stock !== undefined && opt.stock !== null && Number(opt.stock) <= 0;
      const box = document.createElement("div");
      box.className = "bottle-custom-box" + (window.selectedBottleCustomisation === opt.label ? " active" : "") + (isOptOutOfStock ? " out-of-stock" : "");
      box.title = isOptOutOfStock ? `${opt.title} (Out of Stock)` : opt.title;
      if (isOptOutOfStock) {
        box.style.opacity = "0.35";
        box.style.cursor = "not-allowed";
        box.style.position = "relative";
      }

      const displayThumb = (opt.thumbImg && opt.thumbImg.trim()) ? opt.thumbImg.trim() : (opt.fallbackImg || "");

      if (displayThumb) {
        const imgEl = document.createElement("img");
        imgEl.src = displayThumb;
        imgEl.alt = opt.title;
        imgEl.onerror = () => {
          if (opt.dataImg && imgEl.src !== opt.dataImg) {
            imgEl.src = opt.dataImg;
          } else if (opt.fallbackImg && imgEl.src !== opt.fallbackImg) {
            imgEl.src = opt.fallbackImg;
          } else if (p.image) {
            imgEl.src = p.image.split(',')[0].trim();
          }
        };
        box.appendChild(imgEl);
      } else {
        const blankEl = document.createElement("div");
        blankEl.className = "bottle-custom-box-empty";
        box.appendChild(blankEl);
      }

      if (isOptOutOfStock) {
        const oosBadge = document.createElement("div");
        oosBadge.style.cssText = "position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.85); color: #fff; font-size: 7px; font-weight: bold; text-align: center; padding: 2px 0; text-transform: uppercase; letter-spacing: 0.5px; z-index: 2;";
        oosBadge.textContent = "OUT OF STOCK";
        box.appendChild(oosBadge);
      } else if (opt.stock !== undefined && opt.stock !== null && Number(opt.stock) > 0 && Number(opt.stock) <= 3) {
        const lowStockBadge = document.createElement("div");
        lowStockBadge.style.cssText = "position: absolute; bottom: 0; left: 0; right: 0; background: rgba(180, 83, 9, 0.95); color: #fff; font-size: 7px; font-weight: bold; text-align: center; padding: 2px 0; text-transform: uppercase; letter-spacing: 0.5px; z-index: 2;";
        lowStockBadge.textContent = `ONLY ${opt.stock} LEFT`;
        box.appendChild(lowStockBadge);
      }

      box.onclick = () => {
        window.selectedBottleCustomisation = opt.label;
        const labelText = opt.label;
        if (labelSpan) labelSpan.textContent = labelText;
        const siblingBoxes = boxesWrap.querySelectorAll(".bottle-custom-box");
        siblingBoxes.forEach(b => b.classList.remove("active"));
        box.classList.add("active");

        // If customisation has a specified size (e.g. 50ml or 100ml), select that size automatically
        const targetSize = opt.size || (opt.label.toUpperCase().includes("100ML") ? "100ml" : "50ml");
        if (targetSize) {
          const sizeBtns = document.querySelectorAll(".size-picker-btn");
          let clickedSize = false;
          sizeBtns.forEach(btn => {
            if (btn.textContent.trim().toUpperCase() === targetSize.toUpperCase()) {
              btn.click();
              clickedSize = true;
            }
          });
          if (!clickedSize) {
            window.selectedProductSize = targetSize;
            const sizeTextEl = document.getElementById('selectedSizeText');
            if (sizeTextEl) sizeTextEl.textContent = targetSize.toUpperCase();
          }
        }

        // Swap main product image on left slider view
        updateMainSliderImage(opt);
        // Update product price display with priceExtra
        updateProductPriceDisplay(opt);
        // Update Add to Bag / Out of Stock state
        updateCustomisationButtonState(opt);
      };

      boxesWrap.appendChild(box);
    });

    const activeOpt = options.find(o => o.label === window.selectedBottleCustomisation) || options[0];
    const activeLabelText = activeOpt.label;
    if (labelSpan) labelSpan.textContent = activeLabelText;

    if (activeOpt) {
      updateMainSliderImage(activeOpt);
      updateProductPriceDisplay(activeOpt);
      updateCustomisationButtonState(activeOpt);
    }
    window.currentBottleCustomisationOptions = options;
  }

  window.renderBottleCustomisation = renderBottleCustomisation;
})();
