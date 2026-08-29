// Studio Extrait - Cart & Bag Drawer Core Module

(function() {
  // 1. PRODUCT DATA FALLBACK MAP
  const products = {};

  // 2. INITIALIZE CART
  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem('minara_cart')) || [];
  } catch (e) {
    console.error("Failed to parse cart from localStorage:", e);
    cart = [];
  }
  window.cart = cart;

  // Helper to format price
  function getFormattedPrice(val) {
    if (typeof window.formatPrice === 'function') return window.formatPrice(val);
    if (val === undefined || val === null || isNaN(val)) return "0";
    return Math.round(Number(val)).toString();
  }

  // 3. THE ADD FUNCTION
  window.addToCart = function(productId, selectedSize, selectedScents, bottleCustomisation, priceExtra, customImage, customImageThumb) {
    let product = null;
    let sizes = ["50ml", "100ml"];
    
    // Check custom local storage products first to pick up any admin edits (name, price, image)
    try {
      const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
      const found = localProds.find(p => p.id === productId);
      if (found) {
        product = {
          id: found.id,
          name: found.name,
          nameShort: found.nameShort || found.name || "",
          price: found.price,
          image: found.image ? found.image.split(',')[0].trim() : "",
          image_thumb: found.image_thumb || ""
        };
        if (found.sizes) {
          sizes = found.sizes;
        }
      }
    } catch (e) {
      console.error("Local storage lookup failed in addToCart:", e);
    }
    
    // Check our hardcoded products map if not customized/edited
    if (!product) {
      product = products[productId];
    }
    
    if (!product) {
      console.warn("Product not found for addToCart:", productId);
      return;
    }

    // Determine target size
    let sizeToUse = selectedSize || (sizes && sizes.length > 0 ? sizes[0] : "50ml");
    if (bottleCustomisation && typeof bottleCustomisation === 'string' && bottleCustomisation.toUpperCase().includes("100ML")) {
      sizeToUse = "100ml";
    }

    let priceExtraToUse = priceExtra !== undefined && priceExtra !== null ? Number(priceExtra) : ((bottleCustomisation || '').toUpperCase().includes('PREMIUM') ? 145 : 0);

    // If size is 100ml and base product price is 50ml price (<= 550) with 0 extra, add standard 100ml upgrade (+254 -> R749)
    const baseProdPrice = Number(product.price) || 0;
    if (sizeToUse.toLowerCase().includes("100ml") && baseProdPrice <= 550 && priceExtraToUse === 0) {
      priceExtraToUse = 254;
    }

    const existingItem = cart.find(item => {
      const idMatches = item.id === productId;
      const sizeMatches = item.size === sizeToUse;
      const customisationMatches = (item.bottleCustomisation || "") === (bottleCustomisation || "");
      
      let scentsMatches = false;
      if (!item.selectedScents && !selectedScents) {
        scentsMatches = true;
      } else if (item.selectedScents && selectedScents && item.selectedScents.length === selectedScents.length) {
        scentsMatches = item.selectedScents.every((scent, idx) => scent === selectedScents[idx]);
      }
      
      return idMatches && sizeMatches && customisationMatches && scentsMatches;
    });

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
        priceExtra: priceExtraToUse,
        image: customImage || product.image,
        image_thumb: customImageThumb || product.image_thumb || "",
        size: sizeToUse,
        bottleCustomisation: bottleCustomisation || null,
        quantity: 1,
        selectedScents: selectedScents || null
      });
    }

    saveAndSyncCart();
    
    // Auto-open panel
    if (typeof window.openCart === "function") {
      window.openCart();
    } else if (typeof openCart === "function") {
      openCart();
    }
  };

  // 4. THE SYNC FUNCTION
  function saveAndSyncCart() {
    window.cart = cart;
    try {
      localStorage.setItem('minara_cart', JSON.stringify(cart));
    } catch (e) {
      console.error("Failed to save cart to localStorage:", e);
    }
    
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
  window.saveAndSyncCart = saveAndSyncCart;

  window.removeFromCart = function(index) {
    if (cart[index]) {
      cart[index].removed = true;
      saveAndSyncCart();
    }
  };

  // Helper to accurately count total physical bottles in cart
  window.getCartTotalBottles = function(items) {
    if (!items || !Array.isArray(items)) return 0;
    const activeItems = items.filter(item => !item.removed);
    let totalBottles = 0;
    
    activeItems.forEach(item => {
      let bottlesInItem = 1;
      if (item.selectedScents && Array.isArray(item.selectedScents) && item.selectedScents.length > 0) {
        bottlesInItem = item.selectedScents.length;
      } else if (item.bottleCount && item.bottleCount > 1) {
        bottlesInItem = item.bottleCount;
      } else {
        const name = (item.name || "").toLowerCase();
        const nameShort = (item.nameShort || "").toLowerCase();
        const id = (item.id || "").toLowerCase();
        
        if (item.isBundle || name.includes("bundle") || nameShort.includes("bundle") || id.includes("bundle") ||
            name.includes("set of") || name.includes("trio") || name.includes("duo") ||
            name.includes("3 bottle") || name.includes("2 bottle") || name.includes("5 bottle") ||
            name.includes("box set") || name.includes("collection") || name.includes("pack")) {
          
          if (name.includes("3") || id.includes("3")) bottlesInItem = 3;
          else if (name.includes("5") || id.includes("5")) bottlesInItem = 5;
          else bottlesInItem = 2;
        }
      }
      totalBottles += (bottlesInItem * (item.quantity || 1));
    });
    
    return totalBottles;
  };

  function isCartBundleItem(item) {
    if (!item) return false;
    if (item.isBundle === true || item.isBundle === "true") return true;
    if (item.selectedScents && Array.isArray(item.selectedScents) && item.selectedScents.length > 0) return true;
    if (item.bottleCount && item.bottleCount > 1) return true;
    
    // Premium bottle selections (+R145) do NOT qualify for standard 2-bottle discount
    if (Number(item.priceExtra) > 0) return true;
    const custUpper = (item.bottleCustomisation || "").toUpperCase();
    if (custUpper.includes("PREMIUM")) return true;

    const name = (item.name || "").toLowerCase();
    const nameShort = (item.nameShort || "").toLowerCase();
    const id = (item.id || "").toLowerCase();
    
    return name.includes("bundle") || nameShort.includes("bundle") || id.includes("bundle") ||
           name.includes("set of") || name.includes("trio") || name.includes("duo") ||
           name.includes("3 bottle") || name.includes("2 bottle") || name.includes("5 bottle") ||
           name.includes("box set") || name.includes("collection") || name.includes("pack");
  }

  // Comprehensive Cart Pricing, Free Shipping & Volume Savings Resolver
  window.calculateCartPricing = function(items) {
    if (!items || !Array.isArray(items)) {
      return { totalBottles: 0, rawSubtotal: 0, bundleDiscount: 0, subtotalAfterBundle: 0, newsletterDiscountAmount: 0, shippingFee: 0, finalTotal: 0 };
    }
    const activeItems = items.filter(item => !item.removed);
    const totalBottles = window.getCartTotalBottles ? window.getCartTotalBottles(activeItems) : activeItems.reduce((s, i) => s + (i.quantity || 1), 0);
    const rawSubtotal = activeItems.reduce((sum, item) => sum + ((Number(item.price) + (Number(item.priceExtra) || 0)) * item.quantity), 0);

    const hasBundleInCart = activeItems.some(item => isCartBundleItem(item));

    let bundleDiscount = 0;
    
    // 2+ Bottle Savings applies ONLY if there are NO bundles in the cart and user has 2+ single standard bottles!
    if (!hasBundleInCart) {
      const singleBottleItems = activeItems.filter(item => !isCartBundleItem(item));
      const singleBottleCount = singleBottleItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
      const singleBottleSubtotal = singleBottleItems.reduce((sum, item) => sum + ((Number(item.price) + (Number(item.priceExtra) || 0)) * item.quantity), 0);

      if (singleBottleCount >= 2) {
        bundleDiscount = (singleBottleCount - 1) * 241;
      // old tiered logic (now uniform per-extra-bottle discount)
      // bundleDiscount = 486;
      // } else if (singleBottleCount > 3 && singleBottleSubtotal >= 1400) {
      // const duos = Math.floor(singleBottleCount / 2);
      // bundleDiscount = duos * 241;
      }
    }

    const subtotalAfterBundle = Math.max(0, rawSubtotal - bundleDiscount);

    // Free shipping threshold: Cart subtotal >= R645 -> FREE shipping, otherwise R85 flat fee
    const shippingFee = (subtotalAfterBundle >= 645 || activeItems.length === 0) ? 0 : 85;
    
    const hasNewsletterDiscount = localStorage.getItem("minara_discount_5") === "active";
    const newsletterDiscountAmount = hasNewsletterDiscount ? Math.round(subtotalAfterBundle * 0.05) : 0;
    
    const finalTotal = subtotalAfterBundle - newsletterDiscountAmount + shippingFee;

    return {
      totalBottles,
      rawSubtotal,
      bundleDiscount,
      subtotalAfterBundle,
      newsletterDiscountAmount,
      shippingFee,
      finalTotal
    };
  };

  // 5. CART UI RENDERING
  window.renderCartUI = function() {
    const cartContainer = document.querySelector('.cart-body');
    const asciiWrap = document.querySelector('.cart-ascii-wrap');
    const asciiContainer = document.querySelector('.cart-ascii');
    if (!cartContainer || !asciiContainer) return;

    // Ensure the cart body has zero padding and correct flex column layout
    cartContainer.style.setProperty('padding', '0', 'important');
    cartContainer.style.setProperty('display', 'flex', 'important');
    cartContainer.style.setProperty('flex-direction', 'column', 'important');
    cartContainer.style.setProperty('flex-grow', '1', 'important');
    cartContainer.style.setProperty('overflow', 'hidden', 'important');

    // Hide the static placeholder cart-bottom footer
    const staticBottom = document.querySelector('.cart-bottom');
    if (staticBottom) {
      staticBottom.style.setProperty('display', 'none', 'important');
    }

    const activeCartItems = cart.filter(item => !item.removed);
    const pricing = window.calculateCartPricing(cart);
    const stdBottleCount = activeCartItems.reduce((s, it) => s + (isCartBundleItem(it) ? 0 : (it.quantity || 1)), 0);
    const bundleQualify = stdBottleCount >= 2 && !activeCartItems.some(it => isCartBundleItem(it));
    const totalItems = activeCartItems.reduce((sum, item) => sum + item.quantity, 0);
    const hasItems = totalItems > 0;
    const hasAnyCartItems = cart.length > 0;

    const emptyArt = `
 _____   __  __   ____    _____  __   __
| ____| |  \\/  | |  _ \\  |_   _| \\ \\ / /
|  _|   | |\\/| | | |_) |   | |    \\ V / 
| |___  | |  | | |  __/    | |     | |  
|_____| |_|  |_| |_|       |_|     |_| 
                                         
                                         `;

    if (cart.length === 0) {
      asciiContainer.textContent = emptyArt;
      asciiWrap.style.display = "flex";
    } else {
      asciiWrap.style.display = "none";
    }

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
          let removedScentsHtml = "";
          if (item.selectedScents && item.selectedScents.length > 0) {
            removedScentsHtml = `<div style="margin-top: 6px; padding-left: 10px; border-left: 2px solid #ff3b30; opacity: 0.7; display: flex; flex-direction: column; gap: 6px;">`;
            item.selectedScents.forEach((scent) => {
              let scentName = typeof scent === 'object' && scent ? (scent.nameShort || scent.name) : scent;
              let inspiredText = "";
              const img = typeof scent === 'object' && scent ? scent.image : "";

              if (typeof scent === 'object' && scent) {
                let rawName = scent.name || "";
                let clean = rawName.replace(/<br>/gi, ' ').replace(/\s+/g, ' ').trim();
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
                
                if (match || (scent.id && scent.id.startsWith("inspired-by-"))) {
                  const fragranceName = match ? match[1] : clean;
                  inspiredText = `INSPIRED BY ${formatBrandName(fragranceName)}`;
                }
              }
              
              const imgHtml = img ? `<img src="${img}" style="width: 18px; height: 24px; object-fit: contain; flex-shrink: 0; opacity: 0.7;">` : '';
              const inspiredHtml = inspiredText ? `<div style="font-family:Helvetica, Arial, sans-serif; font-size: 7px; opacity: 0.4; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase;">${inspiredText}</div>` : '';
              
              removedScentsHtml += `
                <div style="display: flex; align-items: center; gap: 6px;">
                  ${imgHtml}
                  <div style="display: flex; flex-direction: column; min-width: 0;">
                    <div style="font-family: Helvetica, Arial, sans-serif; font-size: 8px; font-weight: 600; color: #555; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${scentName}</div>
                    ${inspiredHtml}
                  </div>
                </div>
              `;
            });
            removedScentsHtml += `</div>`;
          }
          html += `
          <div class="cart-item-row removed-item-row" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eaeaea; border-left:3px solid #ff3b30; padding:10px 15px 10px 12px; background:#fafafa; box-sizing:border-box; width:100%;">
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="font-family:Helvetica, Arial, sans-serif; font-size:9px; font-weight:bold; color:#ff3b30; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:2px;">REMOVED</span>
              ${window.formatCartInspiredNameHTML ? window.formatCartInspiredNameHTML(item.name, item.id, item.nameShort) : `<span style="font-family:Helvetica, Arial, sans-serif; font-size:11px; font-weight:500; text-transform:uppercase; letter-spacing:1px; color:#000;">${item.name}</span>`}
              <div style="font-family:Helvetica, Arial, sans-serif; font-size:9px; opacity:0.5; letter-spacing:0.5px;">SIZE: ${(item.size || '100ml').toUpperCase()}</div>
              ${removedScentsHtml}
            </div>
            <span onclick="window.undoRemove(${index})" style="color:#1106e8; font-size:11px; font-family:Helvetica, Arial, sans-serif; text-decoration:underline; cursor:pointer; font-weight:500; text-transform:uppercase; letter-spacing:1px;">UNDO</span>
          </div>`;
        } else {
          const hasDiscount = localStorage.getItem("minara_discount_5") === "active";
          const itemPrice = (Number(item.price) || 0) + (Number(item.priceExtra) || 0);
          const isBundleItem = isCartBundleItem(item);
          let displayPrice = `R${getFormattedPrice(itemPrice)}`;
          if (bundleQualify && !isBundleItem) {
            displayPrice = `<span style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R${getFormattedPrice(itemPrice)}</span><span style="color: #1106e8; font-weight: bold;">R${getFormattedPrice(Math.max(0, itemPrice - 241))}</span>`;
          } else if (hasDiscount) {
            displayPrice = `<span style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">R${getFormattedPrice(itemPrice)}</span><span style="color: #1106e8; font-weight: bold;">R${getFormattedPrice(Math.round(itemPrice * 0.95))}</span>`;
          }
          
          

          let scentsHtml = "";
          if (item.selectedScents && item.selectedScents.length > 0) {
            scentsHtml = `<div style="margin-top: 8px; padding-left: 12px; border-left: 2px solid #1106e8; display: flex; flex-direction: column; gap: 8px;">`;
            item.selectedScents.forEach((scent) => {
              let scentName = typeof scent === 'object' && scent ? (scent.nameShort || scent.name) : scent;
              let inspiredText = "";
              const img = typeof scent === 'object' && scent ? scent.image : "";

              if (typeof scent === 'object' && scent) {
                let rawName = scent.name || "";
                let clean = rawName.replace(/<br>/gi, ' ').replace(/\s+/g, ' ').trim();
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
                
                if (match || (scent.id && scent.id.startsWith("inspired-by-"))) {
                  const fragranceName = match ? match[1] : clean;
                  inspiredText = `INSPIRED BY ${formatBrandName(fragranceName)}`;
                }
              }
              
              const imgHtml = img ? `<img src="${img}" style="width: 24px; height: 32px; object-fit: contain; flex-shrink: 0; background: #fafafa; border: 1px solid #eaeaea; border-radius: 1px;">` : '';
              const inspiredHtml = inspiredText ? `<div style="font-family:Helvetica, Arial, sans-serif; font-size: 7.5px; opacity: 0.5; font-weight: bold; letter-spacing: 0.5px; margin-top: 1px; text-transform: uppercase;">${inspiredText}</div>` : '';
              
              scentsHtml += `
                <div style="display: flex; align-items: center; gap: 8px;">
                  ${imgHtml}
                  <div style="display: flex; flex-direction: column; min-width: 0;">
                    <div style="font-family: Helvetica, Arial, sans-serif; font-size: 9px; font-weight: 600; color: #333; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${scentName}</div>
                    ${inspiredHtml}
                  </div>
                </div>
              `;
            });
            scentsHtml += `</div>`;
          }

          const thumbUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(item.image, item.image_thumb) : (item.image_thumb || item.image);

          html += `
          <div class="cart-item-row" style="display:flex; gap:15px; border-bottom:1px solid #eaeaea; padding:12px 15px;">
            <img src="${thumbUrl}" style="width:64px; height:84px; object-fit:contain;">
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                <div style="font-family:Helvetica, Arial, sans-serif; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:#000; margin-bottom: 2px; line-height: 1.4;">
                  ${window.formatCartInspiredNameHTML ? window.formatCartInspiredNameHTML(item.name, item.id, item.nameShort) : (item.nameShort || item.name)}
                </div>
                <div style="font-family:Helvetica, Arial, sans-serif; font-size:11px; font-weight:600; letter-spacing:0.5px; color:#000; margin-left:10px; flex-shrink:0;">${displayPrice}</div>
              </div>
              <div style="font-family:Helvetica, Arial, sans-serif; font-size:9px; opacity:0.5; margin-top:2px; letter-spacing:0.5px;">SIZE: ${(item.size || '100ml').toUpperCase()} ${item.bottleCustomisation ? '• BOTTLE: ' + item.bottleCustomisation.toUpperCase() : ''}</div>
              ${scentsHtml}
              
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
      
      html += '</div>';
    } else {
      html += '<div style="padding:10px 25px; flex-grow:1; display:flex; flex-direction:column; align-items:flex-start;">';
      html += `<div style="font-size:10px; color:rgba(0,0,0,0.6); letter-spacing:0.5px; text-transform:uppercase;">ADD ITEMS TO BAG</div>`;
      html += '</div>';
    }

    // FREE SHIPPING PROGRESS + SMART 2-BOTTLE NUDGE (computed, minimal)
    if (hasItems) {
      const subtotal = pricing.subtotalAfterBundle;
      const diff = Math.max(0, 645 - subtotal);
      const pct = Math.max(0, Math.min(100, Math.round((subtotal / 645) * 100)));
      const free = subtotal >= 645;
      const statusText = free
        ? 'FREE SHIPPING UNLOCKED'
        : `R${getFormattedPrice(diff)} FROM FREE SHIPPING`;
      let nudge = '';
      const bundleInCart = activeCartItems.some(it => (it.id && it.id.indexOf('any-2-50ml') > -1) || it.isBundle);
      if (!free && !bundleInCart) {
        const singles = activeCartItems.filter(it => !it.isBundle);
        const repPrice = singles.length ? ((Number(singles[0].price) || 0) + (Number(singles[0].priceExtra) || 0)) : 495;
        const projCount = pricing.totalBottles + 1;
        const projSub = subtotal + repPrice;
        let saving = 0;
        if (projCount >= 2) saving = (projCount - 1) * 241;
        const bottlePrice = Math.max(0, repPrice - saving);
        // else if (projCount === 3 && projSub >= 1300) saving = 486;
        // else if (projCount > 3 && projSub >= 1400) saving = Math.floor(projCount / 2) * 241;
        if (saving > 0 && projSub >= 645) {
          nudge = `
          <a href="catalog.html" style="margin-top:12px; display:flex; align-items:center; justify-content:center; gap:7px; padding-top:11px; border-top:1px solid #ececec; font-family:'Gotham Narrow Book', sans-serif; font-size:9px; letter-spacing:0.9px; text-transform:uppercase; color:#000; text-decoration:none;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" style="flex-shrink:0;"><path d="M12 5v14M5 12h14"/></svg>
            <span>Add 1 more bottle for R${bottlePrice} + free shipping</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" style="flex-shrink:0;"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>`;
        }
      }
      html += `
        <div style="padding: 12px 20px 0 20px; width:100%; box-sizing:border-box;">
          <div style="text-align:center; font-family:'Gotham Narrow Bold', sans-serif; font-size:9px; letter-spacing:1.1px; text-transform:uppercase; color:${free ? '#3c763d' : '#000'}; margin-bottom:6px;">
            ${statusText}
            
          </div>
          <div style="height:2px; background:#ececec; width:100%; border-radius:99px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:${free ? '#3c763d' : '#000'}; transition:width .3s ease;"></div>
          </div>
          ${nudge}
        </div>`;
    }

    // FOOTER
    const footBoxHeight = hasItems ? (pricing.bundleDiscount > 0 ? "72px" : "56px") : "80px"; 
    const paymentBoxHeight = hasItems ? "auto" : "50px"; 
    const paymentPadding = hasItems ? "20px 20px" : "8px 20px"; 

    const shippingLabel = (pricing.shippingFee === 0 && hasItems) ? 'FREE' : `R${pricing.shippingFee}`;
    const priceDisplay = 'R' + getFormattedPrice(pricing.finalTotal);

    html += `
      <div class="cart-footer-area" style="margin-top:auto; width:100%;">
        <div style="background:#f9f9f9; border-top:1px solid #eaeaea; padding:12px 20px; height:${footBoxHeight}; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box;">
          <div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold', sans-serif; font-weight:bold; letter-spacing:1.5px; color:#000;">
            <span>SHIPPING</span><span>${shippingLabel}</span>
          </div>
          ${pricing.bundleDiscount > 0 ? `
          <div style="display:flex; justify-content:space-between; font-size:10.5px; font-family:'Gotham Narrow Bold', sans-serif; font-weight:bold; letter-spacing:1.2px; color:#1106e8; text-transform:uppercase;">
            <span>2+ BOTTLE DISCOUNT</span><span>-R${pricing.bundleDiscount}</span>
          </div>
          ` : ''}
          ${!hasItems ? `<div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold', sans-serif; font-weight:bold; letter-spacing:1.5px; color:#000;"><span>TOTAL</span><span>R0</span></div>` : ''}
        </div>
        <div class="payment-section" style="background:#f2f2f2; border-top:1px solid #eaeaea; padding:${paymentPadding}; height:${paymentBoxHeight}; min-height:${paymentBoxHeight}; border-bottom:1px solid #eaeaea; display:flex; flex-direction:column; justify-content:center; box-sizing:border-box; width:100%;">
          <div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Gotham Narrow Bold', sans-serif; font-weight:bold; letter-spacing:1.5px; margin-bottom:${hasItems ? '15px' : '4px'}; color:#000;">
            <span>${hasItems ? 'TOTAL' : 'PAYMENT'}</span>
            <span>${hasItems ? priceDisplay : ''}</span>
          </div>
          ${hasItems ? `<button onclick="location.href='checkout.html'" style="width:100%; background:#ccff00; border:1px solid #000; padding:12px; font-family:'Gotham Narrow Bold', sans-serif; font-size:11px; cursor:pointer; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">CONTINUE TO CHECKOUT</button>` : ''}
          <div style="display:flex; gap:6px; align-items:center; margin-top:${hasItems ? '12px' : '0px'};">
            <!-- Visa Logo -->
            <svg title="Visa" viewBox="0 0 36 24" width="26" height="17" xmlns="http://www.w3.org/2000/svg" style="border-radius:1px; flex-shrink:0; cursor:help;">
              <title>Visa</title>
              <rect width="36" height="24" rx="2" fill="#1A1F71"/>
              <text x="50%" y="60%" font-family="Impact, Arial Black, sans-serif" font-style="italic" font-weight="bold" font-size="10" fill="#F7B600" text-anchor="middle">VISA</text>
            </svg>
            <!-- Mastercard Logo -->
            <svg title="Mastercard" viewBox="0 0 36 24" width="26" height="17" xmlns="http://www.w3.org/2000/svg" style="border-radius:1px; flex-shrink:0; cursor:help;">
              <title>Mastercard</title>
              <rect width="36" height="24" rx="2" fill="#222"/>
              <circle cx="14" cy="12" r="7" fill="#EB001B" opacity="0.95"/>
              <circle cx="22" cy="12" r="7" fill="#F79E1B" opacity="0.95"/>
            </svg>
            <!-- Instant EFT Logo -->
            <svg title="Instant EFT" viewBox="0 0 45 24" width="32" height="17" xmlns="http://www.w3.org/2000/svg" style="border-radius:1px; flex-shrink:0; cursor:help;">
              <title>Instant EFT</title>
              <rect width="45" height="24" rx="2" fill="#000"/>
              <text x="50%" y="62%" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="7" fill="#ccff00" text-anchor="middle">EFT</text>
            </svg>
            <!-- PayFast Secure badge -->
            <span style="font-size: 8px; font-weight: bold; letter-spacing: 0.5px; opacity: 0.4; margin-left: auto; text-transform: uppercase; white-space: nowrap; font-family: Helvetica, Arial, sans-serif;">SECURED BY PAYFAST</span>
          </div>
        </div>
      </div>
    </div>`;

    cartContainer.innerHTML = html;
  };

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

  // 6. INITIALIZATION & LIFECYCLE HOOKS
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
        if (typeof window.closeAccDropdown === 'function') {
          window.closeAccDropdown();
        }
        document.body.style.overflow = ''; 
        
        // If dimmer was clicked, pop state if cart was open
        if (history.state && history.state.cartOpen) {
          history.back();
        }
      });
    }
  });

  // History & Back Button Hooks
  setTimeout(() => {
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
        cart = cart.filter(item => !item.removed);
        saveAndSyncCart();

        originalCloseCart();
        if (history.state && history.state.cartOpen) {
          history.back();
        }
      };
    }
  }, 100);

  window.addEventListener('popstate', (event) => {
    if (!event.state || !event.state.cartOpen) {
      const cartPanel = document.getElementById("cartPanel");
      const dimmer = document.getElementById("pageDimmer");
      if (cartPanel && cartPanel.classList.contains("open")) {
        cart = cart.filter(item => !item.removed);
        saveAndSyncCart();

        cartPanel.classList.remove("open");
        if (dimmer) dimmer.classList.remove("active");
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }
  });

  // 7. STOCK RESERVATION & ROLLBACK SYSTEM
  window.reserveAndDeductStock = function(cartItems, paymentReference) {
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) return;

    try {
      let localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
      let reservationItems = [];

      cartItems.forEach(item => {
        const pIdx = localProds.findIndex(p => p.id === item.id);
        if (pIdx > -1) {
          const prod = localProds[pIdx];
          const qty = Number(item.quantity) || 1;

          // Deduct main product stock
          const oldStock = Number(prod.stock) || 0;
          prod.stock = Math.max(0, oldStock - qty);

          let custLabel = item.bottleCustomisation || null;
          if (custLabel && prod.customisations && Array.isArray(prod.customisations)) {
            const cIdx = prod.customisations.findIndex(c => (c.label || '').toUpperCase().trim() === custLabel.toUpperCase().trim());
            if (cIdx > -1) {
              const cust = prod.customisations[cIdx];
              if (cust.stock !== undefined && cust.stock !== null) {
                const oldCustStock = Number(cust.stock) || 0;
                cust.stock = Math.max(0, oldCustStock - qty);
              }
            }
          }

          reservationItems.push({
            productId: item.id,
            bottleCustomisation: custLabel,
            quantity: qty
          });
        }
      });

      localStorage.setItem("minara_products", JSON.stringify(localProds));

      const reservationRecord = {
        reference: paymentReference || ("PAY_" + Date.now()),
        timestamp: Date.now(),
        status: 'pending',
        items: reservationItems
      };
      localStorage.setItem("minara_pending_stock_reservation", JSON.stringify(reservationRecord));

      console.log("✓ Reserved and deducted stock for items:", reservationItems);
      window.dispatchEvent(new CustomEvent('minara_stock_updated'));
    } catch (err) {
      console.error("Failed to reserve and deduct stock:", err);
    }
  };

  window.checkAndRollbackPendingStock = function(forceRollback = false) {
    try {
      const reservationStr = localStorage.getItem('minara_pending_stock_reservation');
      if (!reservationStr) return;
      const reservation = JSON.parse(reservationStr);
      if (!reservation || reservation.status !== 'pending') return;

      if (window.location.pathname.includes('success.html')) {
        return;
      }

      let localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
      let updated = false;

      if (reservation.items && Array.isArray(reservation.items)) {
        reservation.items.forEach(item => {
          const prod = localProds.find(p => p.id === item.productId);
          if (prod) {
            const qty = Number(item.quantity) || 1;
            prod.stock = (Number(prod.stock) || 0) + qty;
            updated = true;

            if (item.bottleCustomisation && prod.customisations && Array.isArray(prod.customisations)) {
              const cust = prod.customisations.find(c => (c.label || '').toUpperCase().trim() === item.bottleCustomisation.toUpperCase().trim());
              if (cust && cust.stock !== undefined && cust.stock !== null) {
                cust.stock = (Number(cust.stock) || 0) + qty;
              }
            }
          }
        });
      }

      if (updated) {
        localStorage.setItem("minara_products", JSON.stringify(localProds));
        console.log("✓ Rolled back (returned) stock for unconfirmed checkout reference:", reservation.reference);
      }

      reservation.status = 'rolled_back';
      localStorage.setItem('minara_pending_stock_reservation', JSON.stringify(reservation));
      window.dispatchEvent(new CustomEvent('minara_stock_updated'));
    } catch (err) {
      console.error("Stock rollback error:", err);
    }
  };

  window.finalizeStockReservation = function() {
    try {
      const reservationStr = localStorage.getItem('minara_pending_stock_reservation');
      if (!reservationStr) return;
      const reservation = JSON.parse(reservationStr);
      if (reservation && reservation.status === 'pending') {
        reservation.status = 'completed';
        localStorage.setItem('minara_pending_stock_reservation', JSON.stringify(reservation));
        console.log("✓ Stock reservation finalized for reference:", reservation.reference);
      }
    } catch (err) {
      console.error("Stock finalization error:", err);
    }
  };

  if (typeof window !== 'undefined') {
    if (window.location.pathname.includes('cancel.html')) {
      window.checkAndRollbackPendingStock(true);
    } else if (!window.location.pathname.includes('success.html')) {
      window.checkAndRollbackPendingStock(false);
    } else {
      window.finalizeStockReservation();
    }
  }

})();
