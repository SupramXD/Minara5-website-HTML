// Studio Extrait - Admin Products & Catalog Management Module
window.minaraProducts = window.minaraProducts || [];
var minaraProducts = window.minaraProducts;

function compressImage(file, maxWidth = 1200, quality = 0.80) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/webp', quality);
        resolve(dataUrl);
      };
      img.onerror = function(err) { reject(err); };
      img.src = event.target.result;
    };
    reader.onerror = function(err) { reject(err); };
    reader.readAsDataURL(file);
  });
}
window.compressImage = compressImage;

function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("file:") || trimmed.includes(":\\") || trimmed.includes("antigravity-ide")) {
    const idx = trimmed.indexOf("images/");
    if (idx !== -1) {
      return trimmed.substring(idx);
    }
    return "";
  }
  return trimmed;
}
window.sanitizeImageUrl = sanitizeImageUrl;

function logAdminSave(msg, isError = false) {
  console.log("[AdminSaveLog]", msg);
  const box = document.getElementById("adminSaveLogBox");
  if (box) {
    box.style.display = "block";
    const timestamp = new Date().toLocaleTimeString();
    const color = isError ? "#ff4444" : "#00ff66";
    box.innerHTML += `<div style="color: ${color}; margin-bottom: 3px;">[${timestamp}] ${msg}</div>`;
    box.scrollTop = box.scrollHeight;
  }
}
window.logAdminSave = logAdminSave;

function formatPrice(val) {
  return (val !== undefined && val !== null && !isNaN(val)) ? Math.round(Number(val)).toString() : "0";
}
window.formatPrice = formatPrice;

function formatRetailPrice(val) {
  if (val === undefined || val === null || isNaN(val)) return "0";
  return Math.round(Number(val)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
window.formatRetailPrice = formatRetailPrice;

// --- 1. CATALOG LOADING & PRODUCT TABLE ---
async function loadCatalog() {
      const tableBody = document.querySelector("#catalogTable tbody");
      const statsEl = document.getElementById("inventoryFulfillmentStats");
      const dashCountEl = document.getElementById("dashboardCatalogCount");
      if (!tableBody) return;
      
      let products = [];
      
      try {
          const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
          localProds.forEach(p => {
              if (p.customisations && Array.isArray(p.customisations)) {
                  p.customisations = p.customisations.map(c => ({
                      ...c,
                      stock: (c.stock !== undefined && c.stock !== null && c.stock !== "" && !isNaN(c.stock)) ? Number(c.stock) : 0
                  }));
              }
              const existingIdx = products.findIndex(item => item.id === p.id);
              if (existingIdx > -1) {
                  products[existingIdx] = {
                      ...products[existingIdx],
                      ...p
                  };
              } else {
                  products.push(p);
              }
          });
      } catch (e) {
          console.error("Local storage products load failed:", e);
      }
      
      const renderTable = () => {
          tableBody.innerHTML = "";
          
          // Sort products first using display order
          const sortedProducts = [...products].sort((a, b) => {
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

          sortedProducts.forEach((p) => {
              const statusBadgeClass = p.status === 'Active' ? 'admin' : 'user';
              
              const tr = document.createElement('tr');
              tr.id = `catalog-row-${p.id}`;
              
              const idTd = document.createElement('td');
              idTd.style.fontFamily = 'monospace';
              idTd.style.fontSize = '11px';
              idTd.textContent = p.id;
              tr.appendChild(idTd);
              
              const nameTd = document.createElement('td');
              nameTd.style.fontWeight = 'bold';
              nameTd.style.color = 'var(--accent)';
              nameTd.textContent = p.nameShort ? p.nameShort + ' - ' + p.name : p.name;
              tr.appendChild(nameTd);
              
              const priceTd = document.createElement('td');
              priceTd.textContent = `R${formatPrice(p.price)}`;
              tr.appendChild(priceTd);
              
              const retailTd = document.createElement('td');
              retailTd.textContent = p.retailPrice ? (window.formatRetailLabel ? window.formatRetailLabel(p.retailPrice) : ('R' + formatRetailPrice(p.retailPrice))) : '—';
              tr.appendChild(retailTd);
              
              const stockTd = document.createElement('td');
              stockTd.id = `stock-level-${p.id}`;
              let stockText = `${p.stock} units`;
              if (p.customisations && Array.isArray(p.customisations) && p.customisations.length > 0) {
                  const custBreakdown = p.customisations.map(c => `${c.label || 'OPT'}: ${(c.stock !== undefined && c.stock !== null && c.stock !== '' && !isNaN(c.stock)) ? Number(c.stock) : 0}`).join(', ');
                  stockText += `<br><span style="font-size: 9px; opacity: 0.7; font-weight: normal; color: var(--text-muted);">${custBreakdown}</span>`;
              }
              stockTd.innerHTML = stockText;
              tr.appendChild(stockTd);
              
              // Sort Order cell
              const orderTd = document.createElement('td');
              orderTd.textContent = p.sortOrder !== undefined && p.sortOrder !== null ? p.sortOrder : '—';
              tr.appendChild(orderTd);
              
              const statusTd = document.createElement('td');
              const statusSpan = document.createElement('span');
              statusSpan.className = `status-badge ${statusBadgeClass}`;
              statusSpan.textContent = p.status;
              statusTd.appendChild(statusSpan);
              tr.appendChild(statusTd);
              
              const actionsTd = document.createElement('td');
              actionsTd.style.whiteSpace = 'nowrap';
              
              const add1 = document.createElement('button');
              add1.className = 'btn-action';
              add1.style.marginRight = '2px';
              add1.style.padding = '4px 8px';
              add1.textContent = '+1';
              add1.onclick = () => window.adjustStock(p.id, 1);
              actionsTd.appendChild(add1);
              
              const sub1 = document.createElement('button');
              sub1.className = 'btn-action';
              sub1.style.marginRight = '6px';
              sub1.style.padding = '4px 8px';
              sub1.textContent = '-1';
              sub1.onclick = () => window.adjustStock(p.id, -1);
              actionsTd.appendChild(sub1);
              
              const add10 = document.createElement('button');
              add10.className = 'btn-action';
              add10.style.marginRight = '2px';
              add10.style.padding = '4px 8px';
              add10.textContent = '+10';
              add10.onclick = () => window.adjustStock(p.id, 10);
              actionsTd.appendChild(add10);
              
              const sub10 = document.createElement('button');
              sub10.className = 'btn-action';
              sub10.style.marginRight = '6px';
              sub10.style.padding = '4px 8px';
              sub10.textContent = '-10';
              sub10.onclick = () => window.adjustStock(p.id, -10);
              actionsTd.appendChild(sub10);
              
              const add50 = document.createElement('button');
              add50.className = 'btn-action';
              add50.style.marginRight = '2px';
              add50.style.padding = '4px 8px';
              add50.textContent = '+50';
              add50.onclick = () => window.adjustStock(p.id, 50);
              actionsTd.appendChild(add50);
              
              const sub50 = document.createElement('button');
              sub50.className = 'btn-action';
              sub50.style.padding = '4px 8px';
              sub50.textContent = '-50';
              sub50.onclick = () => window.adjustStock(p.id, -50);
              actionsTd.appendChild(sub50);
              
              const editBtn = document.createElement('button');
              editBtn.className = 'btn-action accent-btn';
              editBtn.style.marginLeft = '10px';
              editBtn.style.padding = '4px 8px';
              editBtn.textContent = '✎ Edit';
              editBtn.onclick = () => window.openEditModal(p.id);
              actionsTd.appendChild(editBtn);
              
              const deleteBtn = document.createElement('button');
              deleteBtn.className = 'btn-action danger-btn';
              deleteBtn.style.marginLeft = '10px';
              deleteBtn.style.padding = '4px 8px';
              deleteBtn.textContent = '✕ Delete';
              deleteBtn.onclick = () => window.deleteProduct(p.id);
              actionsTd.appendChild(deleteBtn);
              
              tr.appendChild(actionsTd);
              tableBody.appendChild(tr);
          });
          
          if (statsEl) statsEl.textContent = products.length + " Items in System";
          if (dashCountEl) dashCountEl.textContent = products.length;
          
          document.querySelectorAll('.total-products-count-badge, .total-products-count-badge-edit').forEach(badge => {
              badge.textContent = products.length;
          });
          
          // Helper to render interactive slots
          const renderOrderSlots = (inputEl, helpEl, containerEl, currentProductId = null) => {
              if (!containerEl) return;
              containerEl.innerHTML = "";
              
              const totalSlots = products.length + 1;
              const usedOrders = products
                  .map(p => p.sortOrder)
                  .filter(o => o !== undefined && o !== null && o !== "" && !isNaN(o));
              const uniqueUsed = [...new Set(usedOrders)].sort((a, b) => Number(a) - Number(b));
              const defaultHelpText = uniqueUsed.length > 0 ? "Numbers in use: " + uniqueUsed.join(", ") : "None in use";

              const validateSortOrder = () => {
                  const val = parseInt(inputEl.value);
                  if (isNaN(val) || val <= 0) {
                      helpEl.textContent = defaultHelpText;
                      helpEl.style.color = "var(--text-muted)";
                      return;
                  }
                  const conflict = products.find(p => p.sortOrder === val && p.id !== currentProductId);
                  if (conflict) {
                      helpEl.innerHTML = `⚠️ Slot ${val} is currently taken by <strong>"${conflict.nameShort || conflict.name}"</strong>.`;
                      helpEl.style.color = "var(--danger)";
                  } else {
                      helpEl.innerHTML = `✓ Slot ${val} is free.`;
                      helpEl.style.color = "var(--success)";
                  }
              };

              inputEl.oninput = validateSortOrder;

              // Generate badges
              for (let i = 1; i <= totalSlots; i++) {
                  const badge = document.createElement("span");
                  badge.style.cssText = "display: inline-block; font-size: 10px; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer; transition: all 0.2s; font-family: inherit; font-weight: bold; text-transform: uppercase;";
                  
                  const conflict = products.find(p => p.sortOrder === i && p.id !== currentProductId);
                  if (conflict) {
                      badge.style.backgroundColor = "#eaeaea";
                      badge.style.borderColor = "#eaeaea";
                      badge.style.color = "#888";
                      badge.title = `Taken by "${conflict.nameShort || conflict.name}"`;
                      badge.innerHTML = `${i} <span style="font-size: 8px; opacity: 0.8; font-weight: normal;">(${conflict.nameShort || (conflict.id ? conflict.id.substring(0, 8) : "")})</span>`;
                  } else {
                      badge.style.backgroundColor = "#fff";
                      badge.style.borderColor = "#000";
                      badge.style.color = "#000";
                      badge.innerHTML = `${i} <span style="font-size: 8px; color: var(--success); font-weight: normal;">• Free</span>`;
                  }
                  
                  badge.onclick = () => {
                      inputEl.value = i;
                      validateSortOrder();
                  };
                  
                  containerEl.appendChild(badge);
              }
              
              validateSortOrder();
          };

          window.renderOrderSlots = renderOrderSlots;

          const addSortOrderInput = document.getElementById("prodSortOrder");
          const addHelpEl = document.getElementById("prodSortOrderHelp");
          const addContainerEl = document.getElementById("addOrderSlotsContainer");
          
          if (addSortOrderInput && !addSortOrderInput.value) {
              addSortOrderInput.value = products.length + 1;
          }
          if (addSortOrderInput) {
              addSortOrderInput.max = products.length + 1;
          }
          
          renderOrderSlots(addSortOrderInput, addHelpEl, addContainerEl, null);
          
          const editSortOrderInput = document.getElementById("editProdSortOrder");
          if (editSortOrderInput) {
              editSortOrderInput.max = products.length;
          }
          
          window.minaraProducts = products;
      };

      renderTable();
      
      setTimeout(async () => {
          if (window.db && window.dbCollection && window.dbGetDocs) {
              try {
                  const timeoutPromise = new Promise((_, reject) => 
                      setTimeout(() => reject(new Error("Timeout")), 10000)
                  );
                  const querySnapshot = await Promise.race([
                      window.dbGetDocs(window.dbCollection(window.db, "products")),
                      timeoutPromise
                  ]);
                  
                  let updated = false;
                  let firestoreProds = [];
                  
                  querySnapshot.forEach((doc) => {
                      const data = doc.data();
                      const p = {
                          id: doc.id,
                          nameShort: data.nameShort || "",
                          name: data.name,
                          price: Number(data.price),
                          retailPrice: (data.retailPrice !== undefined && data.retailPrice !== null && String(data.retailPrice).trim() !== "") ? data.retailPrice : null,
                          stock: Number(data.stock),
                          status: data.status,
                          image: data.image,
                          image_thumb: data.image_thumb || "",
                          description: data.description,
                          flair: data.flair || "",
                          flairText: data.flairText || "",
                          flairColor: data.flairColor || "",
                          invisibleFlair: data.invisibleFlair || "",
                          standardBottleImg: data.standardBottleImg || "",
                          femininePremiumBottleImg: data.femininePremiumBottleImg || "",
                          galleryImages: data.galleryImages || (data.image ? data.image.split(",").map(s => s.trim()).filter(Boolean) : []),
                          customisations: (data.customisations && Array.isArray(data.customisations))
                            ? data.customisations.map(c => ({
                                label: c.label || "",
                                size: c.size || (c.label && c.label.toUpperCase().includes("50ML") ? "50ml" : "100ml"),
                                image: c.image || "",
                                image_thumb: c.image_thumb || "",
                                image_data: c.image_data || "",
                                priceExtra: c.priceExtra !== undefined && c.priceExtra !== null ? Number(c.priceExtra) : ((c.label || "").toUpperCase().includes("PREMIUM") ? 145 : 0),
                                price: (c.price !== undefined && c.price !== null && c.price !== "") ? Number(c.price) : undefined,
                                stock: (c.stock !== undefined && c.stock !== null && c.stock !== "" && !isNaN(c.stock)) ? Number(c.stock) : 0
                              }))
                            : [],
                          sizes: Array.isArray(data.sizes) ? data.sizes : ["50ml", "100ml"],
                          isBundle: !!data.isBundle,
                          bundleSize: Number(data.bundleSize) || 0,
                          sortOrder: data.sortOrder !== undefined && data.sortOrder !== null ? Number(data.sortOrder) : null,
                          scentProfile: data.scentProfile || null
                      };
                      firestoreProds.push(p);
                      
                      const existingIdx = products.findIndex(item => item.id === p.id);
                      if (existingIdx > -1) {
                          const current = products[existingIdx];
                          if (current.nameShort !== p.nameShort || current.name !== p.name || current.price !== p.price || current.retailPrice !== p.retailPrice || current.stock !== p.stock || current.status !== p.status || current.image !== p.image || current.image_thumb !== p.image_thumb || current.description !== p.description || current.flair !== p.flair || current.invisibleFlair !== p.invisibleFlair || current.standardBottleImg !== p.standardBottleImg || current.masculinePremiumBottleImg !== p.masculinePremiumBottleImg || current.femininePremiumBottleImg !== p.femininePremiumBottleImg || JSON.stringify(current.customisations) !== JSON.stringify(p.customisations) || JSON.stringify(current.sizes) !== JSON.stringify(p.sizes) || current.isBundle !== p.isBundle || current.bundleSize !== p.bundleSize || current.sortOrder !== p.sortOrder || JSON.stringify(current.scentProfile) !== JSON.stringify(p.scentProfile)) {
                              products[existingIdx] = p;
                              updated = true;
                          }
                      } else {
                          products.push(p);
                          updated = true;
                      }
                  });
                  
                  try {
                      const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
                      let localUpdated = false;
                      
                      firestoreProds.forEach(fp => {
                          const idx = localProds.findIndex(lp => lp.id === fp.id);
                          if (idx > -1) {
                              const cur = localProds[idx];
                              if (cur.nameShort !== fp.nameShort || cur.name !== fp.name || cur.price !== fp.price || cur.retailPrice !== fp.retailPrice || cur.stock !== fp.stock || cur.status !== fp.status || cur.image !== fp.image || cur.image_thumb !== fp.image_thumb || cur.description !== fp.description || cur.flair !== fp.flair || cur.invisibleFlair !== fp.invisibleFlair || cur.standardBottleImg !== fp.standardBottleImg || cur.masculinePremiumBottleImg !== fp.masculinePremiumBottleImg || cur.femininePremiumBottleImg !== fp.femininePremiumBottleImg || JSON.stringify(cur.customisations) !== JSON.stringify(fp.customisations) || JSON.stringify(cur.sizes) !== JSON.stringify(fp.sizes) || cur.isBundle !== fp.isBundle || cur.bundleSize !== fp.bundleSize || cur.sortOrder !== fp.sortOrder || JSON.stringify(cur.scentProfile) !== JSON.stringify(fp.scentProfile)) {
                                  localProds[idx] = { ...fp, syncStatus: "synced" };
                                  localUpdated = true;
                              }
                          } else {
                              localProds.push({ ...fp, syncStatus: "synced" });
                              localUpdated = true;
                          }
                      });
                      
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
                              products = [...cleanedLocalProds];
                              updated = true;
                          }
                      } else if (localUpdated) {
                          localStorage.setItem("minara_products", JSON.stringify(localProds));
                      }
                  } catch (cacheErr) {
                      console.error("Failed to sync products cache:", cacheErr);
                  }
                  
                  if (updated) {
                      renderTable();
                  }
              } catch (firestoreErr) {
                  console.error("Firestore products background load failed:", firestoreErr);
              }
          }
      }, 0);
    }
    window.loadCatalog = loadCatalog;

// --- 2. STOCK ADJUSTMENT & PRODUCT DELETION ---
window.adjustStock = async function(productId, amount) {
      const stockTd = document.getElementById("stock-level-" + productId);
      if (!stockTd) return;

      let currentStock = parseInt(stockTd.textContent);
      if (isNaN(currentStock)) currentStock = 0;

      const newStock = Math.max(0, currentStock + amount);
      stockTd.textContent = newStock + " units";

      if (window.minaraProducts) {
          const product = window.minaraProducts.find(p => p.id === productId);
          if (product) {
              product.stock = newStock;
              
              try {
                  const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
                  const idx = localProds.findIndex(p => p.id === productId);
                  if (idx > -1) {
                      localProds[idx].stock = newStock;
                  } else {
                      localProds.push({ ...product, stock: newStock });
                  }
                  localStorage.setItem("minara_products", JSON.stringify(localProds));
              } catch (err) {}
              
              if (window.db && window.dbDoc && window.dbUpdateDoc) {
                  try {
                      await window.dbUpdateDoc(window.dbDoc(window.db, "products", productId), {
                          stock: newStock
                      });

                      // Sync stock level changes to GitHub
                      if (window.syncToGithubCallable) {
                          await window.syncToGithubCallable({
                              action: "adjustStock",
                              payload: { id: productId, newStock: newStock }
                          });
                          console.log(`GitHub stock sync successful for ${productId}`);
                      }
                  } catch (dbErr) {
                      console.error("Stock sync to database or GitHub failed:", dbErr);
                  }
              }
          }
      }

      const statsEl = document.getElementById("inventoryFulfillmentStats");
      if (statsEl) {
          statsEl.textContent = "Stock Level Adjusted ✓";
      }
    };

    window.deleteProduct = async function(productId) {

      if (!confirm("Are you sure you want to permanently delete this product?")) {
          return;
      }

      try {
          const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
          const filteredProds = localProds.filter(p => p.id !== productId);
          localStorage.setItem("minara_products", JSON.stringify(filteredProds));
      } catch (err) {}

      let firestoreDelSuccess = false;
      let firestoreDelErrorMsg = "";

      if (window.db && window.dbDoc && window.dbDeleteDoc) {
          try {
              const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error("Timeout")), 10000)
              );
              await Promise.race([
                  window.dbDeleteDoc(window.dbDoc(window.db, "products", productId)),
                  timeoutPromise
              ]);
              firestoreDelSuccess = true;
          } catch (dbErr) {
              firestoreDelErrorMsg = dbErr.message || dbErr;
          }
      }

      if (firestoreDelSuccess) {
          if (window.syncToGithubCallable) {
              try {
                  await window.syncToGithubCallable({
                      action: "deleteProduct",
                      payload: { id: productId }
                  });
                  console.log(`GitHub delete sync successful for ${productId}`);
              } catch (gitHubErr) {
                  console.error("GitHub delete sync failed:", gitHubErr);
                  alert("Warning: Product was deleted from database, but GitHub sync failed: " + (gitHubErr.message || gitHubErr));
              }
          }
          alert("Success! The product has been permanently removed.");
      } else {
          alert("Warning: The product was removed locally, but failed to sync deletion.\nError: " + firestoreDelErrorMsg);
      }
      
      if (typeof window.loadCatalog === 'function') {
          window.loadCatalog();
      }
    };

    

// --- 3. SCENT PROFILE, CUSTOMISATIONS, GALLERY & EDIT MODAL ---
window.PERFUME_NOTE_LIBRARY = [
      { name: "Amber", file: "Amber.webp" },
      { name: "Ambergris", file: "Ambergris.webp" },
      { name: "Amberwood", file: "Amberwood.webp" },
      { name: "Ambrox", file: "Ambrox.webp" },
      { name: "Ambroxan", file: "Ambroxan.webp" },
      { name: "Apple", file: "Apple.webp" },
      { name: "Basil", file: "Basil.webp" },
      { name: "Bergamot", file: "Bergamot.webp" },
      { name: "Bitter Almond", file: "Bitter_Almond.webp" },
      { name: "Black Cherry", file: "Black_Cherry.avif" },
      { name: "Black Coffee", file: "Black_Coffee.webp" },
      { name: "Black Tea", file: "Black_Tea.webp" },
      { name: "Blackcurrant", file: "Blackcurrant.webp" },
      { name: "Calabrian Bergamot", file: "Calabrian_Bergamot.webp" },
      { name: "Cardamom", file: "Cardamom.webp" },
      { name: "Cedar", file: "Cedar.webp" },
      { name: "Cedarwood", file: "Cedarwood.webp" },
      { name: "Ceylon Cinnamon", file: "Ceylon_Cinnamon.webp" },
      { name: "Citron", file: "Citron.webp" },
      { name: "Clary Sage", file: "Clary_Sage.webp" },
      { name: "Fig", file: "Fig.webp" },
      { name: "Ginger", file: "Ginger.webp" },
      { name: "Grapefruit", file: "Grapefruit.webp" },
      { name: "Guaiac Wood", file: "Guaiac_Wood.webp" },
      { name: "Jasmine", file: "Jasmine.webp" },
      { name: "Jasmine Sambac", file: "Jasmine_Sambac.webp" },
      { name: "Lavender", file: "Lavender.webp" },
      { name: "Leather", file: "Leather.webp" },
      { name: "Lemon", file: "Lemon.webp" },
      { name: "Lily of the Valley", file: "Lily_of_the_Valley.webp" },
      { name: "Lychee", file: "Lychee.webp" },
      { name: "Marshmallow", file: "Marshmallow.webp" },
      { name: "May Rose", file: "May_Rose.webp" },
      { name: "Neroli", file: "Neroli.webp" },
      { name: "Oakmoss", file: "Oakmoss.webp" },
      { name: "Orange Blossom", file: "Orange_Blossom.webp" },
      { name: "Orris", file: "Orris.webp" },
      { name: "Oud", file: "Oud.webp" },
      { name: "Patchouli", file: "Patchouli.webp" },
      { name: "Peony", file: "Peony.webp" },
      { name: "Pineapple", file: "Pineapple.webp" },
      { name: "Pink Pepper", file: "Pink_Pepper.webp" },
      { name: "Roasted Tonka Bean", file: "Roasted_Tonka_Bean.webp" },
      { name: "Rose", file: "Rose.webp" },
      { name: "Saffron", file: "Saffron.webp" },
      { name: "Sandalwood", file: "Sandalwood.webp" },
      { name: "Sicilian Orange", file: "Sicilian_Orange.webp" },
      { name: "Tonka Bean", file: "Tonka_Bean.webp" },
      { name: "Tunisian", file: "Tunisian.webp" },
      { name: "Turkish Rose", file: "Turkish_Rose.webp" },
      { name: "Vanilla", file: "Vanilla.webp" },
      { name: "Vetiver", file: "Vetiver.webp" },
      { name: "Violet", file: "Violet.webp" },
      { name: "Violet Leaf", file: "Violet_Leaf.webp" },
      { name: "White Peach", file: "White_Peach.webp" }
    ];

    window.currentEditKeyNotes = [];

    window.switchEditModalTab = function(tabName) {
      const tabGen = document.getElementById("tabBtnGeneral");
      const tabCust = document.getElementById("tabBtnCustomisation");
      const tabScent = document.getElementById("tabBtnScentNotes");
      const contentGen = document.getElementById("editTabContentGeneral");
      const contentCust = document.getElementById("editTabContentCustomisation");
      const contentScent = document.getElementById("editTabContentScentNotes");

      if (!tabGen || !tabCust || !tabScent || !contentGen || !contentCust || !contentScent) return;

      // Reset tabs
      [tabGen, tabCust, tabScent].forEach(btn => {
        btn.style.borderBottomColor = "transparent";
        btn.style.color = "var(--text-muted)";
      });
      [contentGen, contentCust, contentScent].forEach(c => {
        c.style.display = "none";
      });

      if (tabName === "customisation") {
        tabCust.style.borderBottomColor = "var(--accent)";
        tabCust.style.color = "#fff";
        contentCust.style.display = "block";
      } else if (tabName === "scent-notes") {
        tabScent.style.borderBottomColor = "var(--accent)";
        tabScent.style.color = "#fff";
        contentScent.style.display = "block";
        window.renderEditKeyNotesSelection();
        window.renderNoteLibraryGrid(document.getElementById("editNoteSearchInput") ? document.getElementById("editNoteSearchInput").value : '');
        window.updateScentProfileLivePreview();
      } else {
        tabGen.style.borderBottomColor = "var(--accent)";
        tabGen.style.color = "#fff";
        contentGen.style.display = "block";
      }
    };

    window.renderEditKeyNotesSelection = function() {
      const container = document.getElementById("editSelectedKeyNotesContainer");
      const countEl = document.getElementById("editSelectedKeyNotesCount");
      if (!container) return;

      if (countEl) countEl.textContent = (window.currentEditKeyNotes || []).length;

      if (!window.currentEditKeyNotes || window.currentEditKeyNotes.length === 0) {
        container.innerHTML = `<span style="font-size: 10px; color: var(--text-muted); font-style: italic;">No key notes selected yet. Click any note icon below to select.</span>`;
        return;
      }

      container.innerHTML = "";
      window.currentEditKeyNotes.forEach((item, idx) => {
        const chip = document.createElement("div");
        chip.style.cssText = "display: inline-flex; align-items: center; gap: 6px; background: rgba(204, 255, 0, 0.08); border: 1px solid var(--accent); padding: 4px 8px; border-radius: 4px; color: #fff;";
        
        const noteName = typeof item === "string" ? item : (item.name || "");
        const noteIcon = typeof item === "string" ? `Perfume Note Icons/${item.replace(/\s+/g, '_')}.webp` : (item.icon || "");

        chip.innerHTML = `
          <img src="${noteIcon}" style="width: 20px; height: 20px; object-fit: contain;" onerror="this.style.display='none'">
          <span style="font-size: 10.5px; font-weight: bold;">${noteName}</span>
          <span onclick="removeKeyNote(${idx})" style="cursor: pointer; color: #ff5555; font-size: 12px; margin-left: 4px; font-weight: bold;" title="Remove note">✕</span>
        `;
        container.appendChild(chip);
      });
    };

    window.removeKeyNote = function(idx) {
      if (window.currentEditKeyNotes && idx >= 0 && idx < window.currentEditKeyNotes.length) {
        window.currentEditKeyNotes.splice(idx, 1);
        window.renderEditKeyNotesSelection();
        window.renderNoteLibraryGrid(document.getElementById("editNoteSearchInput") ? document.getElementById("editNoteSearchInput").value : '');
        window.updateScentProfileLivePreview();
      }
    };

    window.toggleKeyNoteSelection = function(noteName, noteFile) {
      if (!window.currentEditKeyNotes) window.currentEditKeyNotes = [];
      const iconPath = `Perfume Note Icons/${noteFile}`;
      const existingIdx = window.currentEditKeyNotes.findIndex(k => (typeof k === "string" ? k : k.name).toLowerCase() === noteName.toLowerCase());
      
      if (existingIdx > -1) {
        window.currentEditKeyNotes.splice(existingIdx, 1);
      } else {
        window.currentEditKeyNotes.push({
          name: noteName,
          icon: iconPath
        });
      }
      window.renderEditKeyNotesSelection();
      window.renderNoteLibraryGrid(document.getElementById("editNoteSearchInput") ? document.getElementById("editNoteSearchInput").value : '');
      window.updateScentProfileLivePreview();
    };

    window.handleNoteSearch = function(val) {
      window.renderNoteLibraryGrid(val);
    };

    window.renderNoteLibraryGrid = function(filterText) {
      const grid = document.getElementById("editNoteLibraryGrid");
      if (!grid) return;
      grid.innerHTML = "";

      const query = (filterText || "").trim().toLowerCase();
      const filtered = window.PERFUME_NOTE_LIBRARY.filter(n => n.name.toLowerCase().includes(query));

      if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 10px; padding: 15px;">No fragrance notes found matching "${filterText}".</div>`;
        return;
      }

      filtered.forEach(note => {
        const isSelected = (window.currentEditKeyNotes || []).some(k => (typeof k === "string" ? k : k.name).toLowerCase() === note.name.toLowerCase());
        const card = document.createElement("div");
        card.style.cssText = `display: flex; flex-direction: column; align-items: center; padding: 6px 4px; background: ${isSelected ? 'rgba(204, 255, 0, 0.15)' : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid ${isSelected ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 4px; cursor: pointer; text-align: center; transition: all 0.15s ease; user-select: none; position: relative;`;
        card.onclick = () => window.toggleKeyNoteSelection(note.name, note.file);

        card.innerHTML = `
          <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
            <img src="Perfume Note Icons/${note.file}" style="max-width: 30px; max-height: 30px; object-fit: contain;">
          </div>
          <span style="font-size: 9.5px; line-height: 1.1; color: ${isSelected ? 'var(--accent)' : '#fff'}; font-weight: ${isSelected ? 'bold' : 'normal'}; word-break: break-word;">${note.name}</span>
          ${isSelected ? `<span style="position: absolute; top: 2px; right: 4px; font-size: 8px; color: var(--accent);">✓</span>` : ''}
        `;
        grid.appendChild(card);
      });
    };

    window.updateScentProfileLivePreview = function() {
      const previewEl = document.getElementById("adminScentProfileLivePreview");
      if (!previewEl) return;

      const keyNotes = window.currentEditKeyNotes || [];
      const topNotes = document.getElementById("editProdTopNotes") ? document.getElementById("editProdTopNotes").value.trim() : "";
      const topNotesDesc = document.getElementById("editProdTopNotesDesc") ? document.getElementById("editProdTopNotesDesc").value.trim() || "The first notes you smell" : "The first notes you smell";
      const middleNotes = document.getElementById("editProdMiddleNotes") ? document.getElementById("editProdMiddleNotes").value.trim() : "";
      const middleNotesDesc = document.getElementById("editProdMiddleNotesDesc") ? document.getElementById("editProdMiddleNotesDesc").value.trim() || "The heart of the perfume" : "The heart of the perfume";
      const baseNotes = document.getElementById("editProdBaseNotes") ? document.getElementById("editProdBaseNotes").value.trim() : "";
      const baseNotesDesc = document.getElementById("editProdBaseNotesDesc") ? document.getElementById("editProdBaseNotesDesc").value.trim() || "The notes that linger all day" : "The notes that linger all day";

      if (keyNotes.length === 0 && !topNotes && !middleNotes && !baseNotes) {
        previewEl.innerHTML = `<div style="text-align: center; color: #888; font-size: 11px; font-style: italic; padding: 10px;">Select key note icons or enter Top, Middle, Base notes above to generate live preview.</div>`;
        return;
      }

      let html = "";

      // Key notes row
      if (keyNotes.length > 0) {
        html += `<div style="display: flex; align-items: flex-start; justify-content: flex-start; gap: 6px; padding: 4px 0 10px 0; margin-bottom: 12px; border-bottom: 1px solid #ebebeb; flex-wrap: wrap;">`;
        keyNotes.forEach(item => {
          const noteName = typeof item === "string" ? item : (item.name || "");
          const noteIcon = typeof item === "string" ? `Perfume Note Icons/${item.replace(/\s+/g, '_')}.webp` : (item.icon || "");
          html += `
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center; flex: 0 0 calc(20% - 5px); max-width: calc(20% - 5px); box-sizing: border-box;">
              <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;">
                <img src="${noteIcon}" style="max-width: 32px; max-height: 32px; object-fit: contain;" onerror="this.style.display='none'">
              </div>
              <span style="font-size: 10px; font-weight: bold; color: #000; line-height: 1.15; word-break: break-word;">${noteName}</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Bottle SVGs (Taller vertical bottle flacons)
      const topSvg = `<svg viewBox="0 0 26 36" style="width: 22px; height: 30px;"><rect x="9.5" y="1" width="7" height="4.5" rx="0.8" stroke="#000" stroke-width="1.3" fill="none"/><rect x="11.5" y="5.5" width="3" height="2" fill="#000"/><rect x="2.5" y="7.5" width="21" height="26.5" rx="1.5" stroke="#000" stroke-width="1.3" fill="none"/><path d="M 3.8 8.2 L 22.2 8.2 A 1 1 0 0 1 23 9 L 23 16.5 L 3 16.5 L 3 9 A 1 1 0 0 1 3.8 8.2 Z" fill="#000"/><line x1="2.5" y1="16.5" x2="23.5" y2="16.5" stroke="#000" stroke-width="1.1"/><line x1="2.5" y1="25" x2="23.5" y2="25" stroke="#000" stroke-width="1.1"/></svg>`;
      const midSvg = `<svg viewBox="0 0 26 36" style="width: 22px; height: 30px;"><rect x="9.5" y="1" width="7" height="4.5" rx="0.8" stroke="#000" stroke-width="1.3" fill="none"/><rect x="11.5" y="5.5" width="3" height="2" fill="#000"/><rect x="2.5" y="7.5" width="21" height="26.5" rx="1.5" stroke="#000" stroke-width="1.3" fill="none"/><rect x="3.2" y="16.5" width="19.6" height="8.5" fill="#000"/><line x1="2.5" y1="16.5" x2="23.5" y2="16.5" stroke="#000" stroke-width="1.1"/><line x1="2.5" y1="25" x2="23.5" y2="25" stroke="#000" stroke-width="1.1"/></svg>`;
      const baseSvg = `<svg viewBox="0 0 26 36" style="width: 22px; height: 30px;"><rect x="9.5" y="1" width="7" height="4.5" rx="0.8" stroke="#000" stroke-width="1.3" fill="none"/><rect x="11.5" y="5.5" width="3" height="2" fill="#000"/><rect x="2.5" y="7.5" width="21" height="26.5" rx="1.5" stroke="#000" stroke-width="1.3" fill="none"/><path d="M 3 25 L 23 25 L 23 32.2 A 1 1 0 0 1 22.2 33.2 L 3.8 33.2 A 1 1 0 0 1 3 32.2 Z" fill="#000"/><line x1="2.5" y1="16.5" x2="23.5" y2="16.5" stroke="#000" stroke-width="1.1"/><line x1="2.5" y1="25" x2="23.5" y2="25" stroke="#000" stroke-width="1.1"/></svg>`;

      if (topNotes || middleNotes || baseNotes) {
        html += `<div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px;">`;
        if (topNotes) {
          html += `
            <div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #e6e6e6; border-radius: 6px; padding: 6px 12px;">
              <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${topSvg}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                  <span style="background: #000; color: #fff; font-size: 8px; font-weight: bold; padding: 1.5px 5px; border-radius: 2px;">TOP</span>
                  <span style="font-size: 10.5px; color: #333;">— ${topNotesDesc}</span>
                </div>
                <div style="font-size: 11px; color: #444; line-height: 1.35;">${topNotes}</div>
              </div>
            </div>
          `;
        }
        if (middleNotes) {
          html += `
            <div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #e6e6e6; border-radius: 6px; padding: 6px 12px;">
              <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${midSvg}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                  <span style="background: #000; color: #fff; font-size: 8px; font-weight: bold; padding: 1.5px 5px; border-radius: 2px;">MIDDLE</span>
                  <span style="font-size: 10.5px; color: #333;">— ${middleNotesDesc}</span>
                </div>
                <div style="font-size: 11px; color: #444; line-height: 1.35;">${middleNotes}</div>
              </div>
            </div>
          `;
        }
        if (baseNotes) {
          html += `
            <div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #e6e6e6; border-radius: 6px; padding: 6px 12px;">
              <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${baseSvg}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                  <span style="background: #000; color: #fff; font-size: 8px; font-weight: bold; padding: 1.5px 5px; border-radius: 2px;">BASE</span>
                  <span style="font-size: 10.5px; color: #333;">— ${baseNotesDesc}</span>
                </div>
                <div style="font-size: 11px; color: #444; line-height: 1.35;">${baseNotes}</div>
              </div>
            </div>
          `;
        }
        html += `</div>`;
      }

      previewEl.innerHTML = html;
    };

    window.currentEditCustomisations = [];

    window.renderEditCustomisationBlocks = function() {
      const container = document.getElementById("editCustomisationBlocksContainer");
      if (!container) return;
      container.innerHTML = "";

      if (!window.currentEditCustomisations || window.currentEditCustomisations.length === 0) {
        container.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); font-style: italic; padding: 10px; border: 1px dashed var(--border-color); text-align: center;">No customisation blocks added yet. Click "+ ADD CUSTOMISATION BLOCK" below to add one.</div>`;
        return;
      }

      window.currentEditCustomisations.forEach((block, idx) => {
        const itemDiv = document.createElement("div");
        itemDiv.style.cssText = "background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 4px; padding: 12px; display: flex; flex-direction: column; gap: 10px;";

        const imgPreview = block.image_thumb || block.image || block.image_data;
        const extraVal = block.priceExtra !== undefined && block.priceExtra !== null ? block.priceExtra : ((block.label || '').toUpperCase().includes('PREMIUM') ? 145 : 0);
        // "Price" is the official absolute price. For legacy blocks (only priceExtra),
        // pre-fill with the base bottle price + extra so the admin sees the real total.
        const basePrice = parseFloat((document.getElementById("editProdPrice") ? document.getElementById("editProdPrice").value : "0") || "0") || 0;
        const priceVal = (block.price !== undefined && block.price !== null && block.price !== "") ? Number(block.price) : (basePrice + Number(extraVal || 0));
        const stockVal = (block.stock !== undefined && block.stock !== null && block.stock !== '' && !isNaN(block.stock)) ? Number(block.stock) : 0;
        const sizeVal = block.size || block.ml || ((block.label || '').toUpperCase().includes('50ML') ? '50ml' : '100ml');

        itemDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; font-weight: bold; color: var(--accent); letter-spacing: 1px;">BLOCK #${idx + 1}</span>
            <button type="button" onclick="removeEditCustomisationBlock(${idx})" style="background: transparent; border: none; color: #ff4444; font-size: 11px; font-weight: bold; cursor: pointer;">✕ REMOVE</button>
          </div>
          <div style="display: flex; gap: 10px;">
            <div class="form-group" style="margin-bottom: 0; flex: 1;">
              <label style="font-size: 10px; opacity: 0.8;">Option Label (e.g. STANDARD, PREMIUM)</label>
              <input type="text" value="${block.label || ''}" class="form-input edit-cust-label-input" oninput="window.updateCustomisationBlockLabel(${idx}, this.value)" onchange="window.updateCustomisationBlockLabel(${idx}, this.value)" style="background:#1a1a24; color:#fff;" placeholder="Option Label">
            </div>
            <div class="form-group" style="margin-bottom: 0; width: 85px;">
              <label style="font-size: 10px; opacity: 0.8;">Size / ml</label>
              <input type="text" value="${sizeVal}" class="form-input edit-cust-size-input" oninput="window.updateCustomisationBlockSize(${idx}, this.value)" onchange="window.updateCustomisationBlockSize(${idx}, this.value)" style="background:#1a1a24; color:#fff;" placeholder="e.g. 100ml">
            </div>
            <div class="form-group" style="margin-bottom: 0; width: 100px;">
              <label style="font-size: 10px; opacity: 0.8;">Price (R)</label>
              <input type="number" value="${priceVal}" class="form-input edit-cust-price-input" oninput="window.updateCustomisationBlockPrice(${idx}, this.value)" onchange="window.updateCustomisationBlockPrice(${idx}, this.value)" style="background:#1a1a24; color:#fff;" min="0">
            </div>
            <div class="form-group" style="margin-bottom: 0; width: 85px;">
              <label style="font-size: 10px; opacity: 0.8;">Option Stock</label>
              <input type="number" value="${stockVal}" class="form-input edit-cust-stock-input" oninput="window.updateCustomisationBlockStock(${idx}, this.value)" onchange="window.updateCustomisationBlockStock(${idx}, this.value)" style="background:#1a1a24; color:#fff;" min="0">
            </div>
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <div style="width: 50px; height: 50px; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; background: #000; flex-shrink: 0; overflow: hidden;">
              ${imgPreview ? `<img src="${imgPreview}" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="if ('${block.image_data || ''}' && this.src !== '${block.image_data || ''}') this.src = '${block.image_data || ''}';">` : `<span style="font-size: 9px; opacity: 0.3;">NO IMG</span>`}
            </div>
            <div style="flex: 1;">
              <label style="font-size: 10px; display: block; opacity: 0.8; margin-bottom: 4px;">Attach Image File (Auto-Compresses)</label>
              <input type="file" accept="image/*,.avif" onchange="handleBlockImageUpload(${idx}, event)" style="font-size: 10px; color: var(--text-muted); cursor: pointer;">
            </div>
          </div>
        `;
        container.appendChild(itemDiv);
      });
    };

    window.updateCustomisationBlockLabel = function(idx, val) {
      if (window.currentEditCustomisations && window.currentEditCustomisations[idx]) {
        window.currentEditCustomisations[idx].label = (val || '').trim().toUpperCase();
      }
    };

    window.updateCustomisationBlockSize = function(idx, val) {
      if (window.currentEditCustomisations && window.currentEditCustomisations[idx]) {
        window.currentEditCustomisations[idx].size = (val || '').trim();
      }
    };

    window.updateCustomisationBlockPriceExtra = function(idx, val) {
      if (window.currentEditCustomisations && window.currentEditCustomisations[idx]) {
        window.currentEditCustomisations[idx].priceExtra = parseFloat(val) || 0;
      }
    };

    // Set the official absolute price of a customisation block.
    window.updateCustomisationBlockPrice = function(idx, val) {
      if (window.currentEditCustomisations && window.currentEditCustomisations[idx]) {
        window.currentEditCustomisations[idx].price = parseFloat(val) || 0;
      }
    };

    window.updateCustomisationBlockStock = function(idx, val) {
      if (window.currentEditCustomisations && window.currentEditCustomisations[idx]) {
        window.currentEditCustomisations[idx].stock = val === "" ? "" : (parseInt(val, 10) || 0);
      }
    };

    window.addEditCustomisationBlock = function() {
      if (!window.currentEditCustomisations) window.currentEditCustomisations = [];
      window.currentEditCustomisations.push({
        label: "OPTION " + (window.currentEditCustomisations.length + 1),
        size: "100ml",
        image: "",
        image_thumb: "",
        priceExtra: 0,
        price: undefined,
        stock: 10
      });
      window.renderEditCustomisationBlocks();
    };

    window.removeEditCustomisationBlock = function(idx) {
      if (window.currentEditCustomisations && idx >= 0 && idx < window.currentEditCustomisations.length) {
        window.currentEditCustomisations.splice(idx, 1);
        window.renderEditCustomisationBlocks();
      }
    };

    window.handleBlockImageUpload = async function(idx, event) {
      const file = event.target.files[0];
      if (!file || !window.currentEditCustomisations || !window.currentEditCustomisations[idx]) return;

      try {
        const mainBase64 = await compressImage(file, 1200, 0.90);
        const thumbBase64 = await compressImage(file, 800, 0.85);

        window.currentEditCustomisations[idx].image = mainBase64;
        window.currentEditCustomisations[idx].image_thumb = thumbBase64;
        window.currentEditCustomisations[idx].image_data = mainBase64;
        window.renderEditCustomisationBlocks();
      } catch (err) {
        console.error("Block image upload compression failed:", err);
        alert("Failed to compress uploaded image: " + err.message);
      }
    };

    // Gallery Images Manager functions
    window.currentEditGalleryImages = [];

    window.renderEditGallerySlots = function() {
      const container = document.getElementById("editGallerySlotsContainer");
      if (!container) return;
      container.innerHTML = "";

      if (!window.currentEditGalleryImages || window.currentEditGalleryImages.length === 0) {
        container.innerHTML = `<div style="font-size: 11px; opacity: 0.4; font-style: italic; padding: 4px 0;">No additional gallery photos added yet. Click "+ Add More Images" above to add scrollable photos.</div>`;
        return;
      }

      window.currentEditGalleryImages.forEach((imgUrl, idx) => {
        const slot = document.createElement("div");
        slot.style.display = "flex";
        slot.style.alignItems = "center";
        slot.style.gap = "8px";
        slot.style.background = "rgba(255, 255, 255, 0.03)";
        slot.style.border = "1px solid rgba(255, 255, 255, 0.08)";
        slot.style.borderRadius = "4px";
        slot.style.padding = "6px 8px";

        slot.innerHTML = `
          <img src="${imgUrl || 'Studio Extrait Icon Svg only logo.svg'}" style="width: 36px; height: 36px; border-radius: 4px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1); background: #000; flex-shrink: 0;" onerror="this.src='Studio Extrait Icon Svg only logo.svg'" />
          <input type="text" class="form-input edit-gallery-slot-input" value="${imgUrl}" placeholder="Image Path/URL (e.g. images/products/gallery-1.avif)" style="font-size: 11px; padding: 6px 8px; flex: 1;" oninput="this.previousElementSibling.src = this.value.trim() || 'Studio Extrait Icon Svg only logo.svg'; window.currentEditGalleryImages[${idx}] = this.value.trim();">
          <label style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 10.5px; font-weight: bold; margin-bottom: 0;">
            📁 Upload
            <input type="file" accept="image/*,.avif" style="display:none;" onchange="window.handleGallerySlotUpload(${idx}, event)">
          </label>
          <button type="button" onclick="window.removeEditGallerySlot(${idx})" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 11px; font-weight: bold;" title="Remove this gallery image">✕</button>
        `;
        container.appendChild(slot);
      });
    };

    window.addEditGallerySlot = function(initialUrl = '') {
      if (!window.currentEditGalleryImages) window.currentEditGalleryImages = [];
      window.currentEditGalleryImages.push(initialUrl);
      window.renderEditGallerySlots();
    };

    window.removeEditGallerySlot = function(idx) {
      if (!window.currentEditGalleryImages) return;
      window.currentEditGalleryImages.splice(idx, 1);
      window.renderEditGallerySlots();
    };

    window.handleGallerySlotUpload = async function(idx, event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const compressedBase64 = await compressImage(file, 1200, 0.90);
        window.currentEditGalleryImages[idx] = compressedBase64;
        window.renderEditGallerySlots();
      } catch (err) {
        console.error("Gallery image upload failed:", err);
        alert("Failed to compress gallery image: " + err.message);
      }
    };

    window.openEditModal = function(productId) {
      if (!window.minaraProducts) return;
      const product = window.minaraProducts.find(p => p.id === productId);
      if (!product) return;

      const logBox = document.getElementById("adminSaveLogBox");
      if (logBox) {
        logBox.innerHTML = "";
        logBox.style.display = "none";
      }

      document.getElementById("editProdId").value = product.id;
      document.getElementById("editProdNameShort").value = product.nameShort || "";
      document.getElementById("editProdName").value = product.name;
      document.getElementById("editProdPrice").value = product.price;
      document.getElementById("editProdRetailPrice").value = product.retailPrice || "";
      document.getElementById("editProdStock").value = product.stock;
      const editSortOrderInput = document.getElementById("editProdSortOrder");
      editSortOrderInput.value = product.sortOrder !== undefined && product.sortOrder !== null ? product.sortOrder : "";
      const editHelpEl = document.getElementById("editProdSortOrderHelp");
      const editContainerEl = document.getElementById("editOrderSlotsContainer");
      if (typeof window.renderOrderSlots === "function") {
          window.renderOrderSlots(editSortOrderInput, editHelpEl, editContainerEl, product.id);
      }

      // Populate Images & Additional Gallery Images
      const rawImages = (product.image || "").split(",").map(s => s.trim()).filter(Boolean);
      const mainImg = rawImages[0] || "";
      const galleryImgs = (product.galleryImages && Array.isArray(product.galleryImages))
        ? product.galleryImages
        : rawImages.slice(1);

      document.getElementById("editProdImage").value = sanitizeImageUrl(mainImg);
      window.currentEditGalleryImages = galleryImgs.map(img => sanitizeImageUrl(img));
      if (typeof window.renderEditGallerySlots === "function") {
        window.renderEditGallerySlots();
      }
      document.getElementById("editProdDesc").value = product.description;
      document.getElementById("editProdStatus").value = product.status;
      document.getElementById("editProdFlair").value = product.flair || "";
      document.getElementById("editProdInvisibleFlair").value = product.invisibleFlair || "";
      if (document.getElementById("editProdFlairText")) document.getElementById("editProdFlairText").value = product.flairText || "";
      if (document.getElementById("editProdFlairColor")) document.getElementById("editProdFlairColor").value = (product.flairColor && /^#[0-9a-fA-F]{6}$/.test(product.flairColor)) ? product.flairColor : "#b45309";
      if (document.getElementById("editProdFlairColorText")) document.getElementById("editProdFlairColorText").value = product.flairColor || "#b45309";
      document.getElementById("editProdStandardBottleImg").value = sanitizeImageUrl(product.standardBottleImg);
      document.getElementById("editProdMasculinePremiumBottleImg").value = sanitizeImageUrl(product.masculinePremiumBottleImg);
      document.getElementById("editProdFemininePremiumBottleImg").value = sanitizeImageUrl(product.femininePremiumBottleImg);

      const isBundle = !!product.isBundle;
      document.getElementById("editProdIsBundle").checked = isBundle;
      document.getElementById("editProdBundleSize").value = product.bundleSize || "1";
      document.getElementById("editProdBundleSizeGroup").style.display = isBundle ? "block" : "none";

      const pSizes = Array.isArray(product.sizes) ? product.sizes : ["50ml", "100ml"];
      document.getElementById("editProdSize50").checked = pSizes.includes("50ml");
      document.getElementById("editProdSize100").checked = pSizes.includes("100ml");

      // Populate Scent Profile
      const sp = product.scentProfile || {};
      window.currentEditKeyNotes = sp.keyNotes ? JSON.parse(JSON.stringify(sp.keyNotes)) : [];
      if (document.getElementById("editProdTopNotes")) {
        document.getElementById("editProdTopNotes").value = sp.topNotes || "";
      }
      if (document.getElementById("editProdTopNotesDesc")) {
        document.getElementById("editProdTopNotesDesc").value = sp.topNotesDesc || "The first notes you smell";
      }
      if (document.getElementById("editProdMiddleNotes")) {
        document.getElementById("editProdMiddleNotes").value = sp.middleNotes || "";
      }
      if (document.getElementById("editProdMiddleNotesDesc")) {
        document.getElementById("editProdMiddleNotesDesc").value = sp.middleNotesDesc || "The heart of the perfume";
      }
      if (document.getElementById("editProdBaseNotes")) {
        document.getElementById("editProdBaseNotes").value = sp.baseNotes || "";
      }
      if (document.getElementById("editProdBaseNotesDesc")) {
        document.getElementById("editProdBaseNotesDesc").value = sp.baseNotesDesc || "The notes that linger all day";
      }
      if (document.getElementById("editNoteSearchInput")) {
        document.getElementById("editNoteSearchInput").value = "";
      }
      if (typeof window.renderEditKeyNotesSelection === "function") {
        window.renderEditKeyNotesSelection();
      }
      if (typeof window.renderNoteLibraryGrid === "function") {
        window.renderNoteLibraryGrid('');
      }
      if (typeof window.updateScentProfileLivePreview === "function") {
        window.updateScentProfileLivePreview();
      }

      window.currentEditCustomisations = (product.customisations && Array.isArray(product.customisations))
        ? product.customisations.map(c => ({
            label: c.label || "",
            size: c.size || (c.label && c.label.toUpperCase().includes("50ML") ? "50ml" : "100ml"),
            image: c.image || "",
            image_thumb: c.image_thumb || "",
            image_data: c.image_data || "",
            priceExtra: c.priceExtra !== undefined && c.priceExtra !== null ? Number(c.priceExtra) : ((c.label || "").toUpperCase().includes("PREMIUM") ? 145 : 0),
            price: (c.price !== undefined && c.price !== null && c.price !== "") ? Number(c.price) : undefined,
            stock: (c.stock !== undefined && c.stock !== null && c.stock !== "" && !isNaN(c.stock)) ? Number(c.stock) : 0
          }))
        : [];
      if (typeof window.switchEditModalTab === "function") {
        window.switchEditModalTab("general");
      }
      if (typeof window.renderEditCustomisationBlocks === "function") {
        window.renderEditCustomisationBlocks();
      }

      const modal = document.getElementById("editProductModal");
      modal.style.display = "flex";
      setTimeout(() => modal.classList.add("active"), 10);
    };

    window.closeEditModal = function() {
      const modal = document.getElementById("editProductModal");
      modal.classList.remove("active");
      setTimeout(() => modal.style.display = "none", 300);
    };

    window.handleSaveEdit = async function(e) {
      e.preventDefault();
      
      const id = document.getElementById("editProdId").value;
      const nameShort = document.getElementById("editProdNameShort").value.trim();
      const name = document.getElementById("editProdName").value.trim();
      const price = parseFloat(document.getElementById("editProdPrice").value);
      const retailPriceVal = document.getElementById("editProdRetailPrice").value.trim();
      const retailPrice = retailPriceVal !== "" ? retailPriceVal : null;
      const stock = parseInt(document.getElementById("editProdStock").value);
      const imageInput = sanitizeImageUrl(document.getElementById("editProdImage").value);
      const fileInput = document.getElementById("editProdFile").files[0];
      const description = document.getElementById("editProdDesc").value.trim();
      const status = document.getElementById("editProdStatus").value;
      const flair = document.getElementById("editProdFlair").value;
      const invisibleFlair = document.getElementById("editProdInvisibleFlair").value;
      const flairText = document.getElementById("editProdFlairText") ? document.getElementById("editProdFlairText").value.trim() : "";
      const flairColor = document.getElementById("editProdFlairColorText") ? document.getElementById("editProdFlairColorText").value.trim() : "";
      const standardBottleImg = sanitizeImageUrl(document.getElementById("editProdStandardBottleImg").value);
      const masculinePremiumBottleImg = sanitizeImageUrl(document.getElementById("editProdMasculinePremiumBottleImg").value);
      const femininePremiumBottleImg = sanitizeImageUrl(document.getElementById("editProdFemininePremiumBottleImg").value);
      const isBundle = document.getElementById("editProdIsBundle").checked;
      const bundleSize = isBundle ? parseInt(document.getElementById("editProdBundleSize").value) : 0;
      const sortOrderVal = document.getElementById("editProdSortOrder").value.trim();
      const sortOrder = sortOrderVal !== "" ? parseInt(sortOrderVal) : null;

      const sizes = [];
      if (document.getElementById("editProdSize50") && document.getElementById("editProdSize50").checked) sizes.push("50ml");
      if (document.getElementById("editProdSize100") && document.getElementById("editProdSize100").checked) sizes.push("100ml");

      // Extract Scent Profile
      const topNotes = document.getElementById("editProdTopNotes") ? document.getElementById("editProdTopNotes").value.trim() : "";
      const topNotesDesc = (document.getElementById("editProdTopNotesDesc") ? document.getElementById("editProdTopNotesDesc").value.trim() : "") || "The first notes you smell";
      const middleNotes = document.getElementById("editProdMiddleNotes") ? document.getElementById("editProdMiddleNotes").value.trim() : "";
      const middleNotesDesc = (document.getElementById("editProdMiddleNotesDesc") ? document.getElementById("editProdMiddleNotesDesc").value.trim() : "") || "The heart of the perfume";
      const baseNotes = document.getElementById("editProdBaseNotes") ? document.getElementById("editProdBaseNotes").value.trim() : "";
      const baseNotesDesc = (document.getElementById("editProdBaseNotesDesc") ? document.getElementById("editProdBaseNotesDesc").value.trim() : "") || "The notes that linger all day";

      const scentProfile = {
        keyNotes: window.currentEditKeyNotes || [],
        topNotes: topNotes,
        topNotesDesc: topNotesDesc,
        middleNotes: middleNotes,
        middleNotesDesc: middleNotesDesc,
        baseNotes: baseNotes,
        baseNotesDesc: baseNotesDesc
      };

      if (!id || !name || isNaN(price) || isNaN(stock)) return;
      if (!imageInput && !fileInput) {
        alert("Please either provide an Image Path/URL or select a file to upload.");
        return;
      }

      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : "";
      if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = "SAVING...";
      }

      window.logAdminSave(`Starting edit save process for: "${name}" (${id})`);

      let mainImageBase64 = imageInput;
      let thumbImageBase64 = "";

      if (window.minaraProducts) {
          const existingProd = window.minaraProducts.find(p => p.id === id);
          if (existingProd) {
              thumbImageBase64 = existingProd.image_thumb || "";
              if (imageInput !== existingProd.image) {
                  thumbImageBase64 = "";
              }
          }
      }

      if (fileInput) {
        window.logAdminSave("Compressing main image file upload...");
        try {
          mainImageBase64 = await compressImage(fileInput, 1200, 0.90);
          thumbImageBase64 = await compressImage(fileInput, 800, 0.85);
          window.logAdminSave("File compressed successfully.");
        } catch (compressErr) {
          window.logAdminSave("Image compression error: " + compressErr.message, true);
          mainImageBase64 = imageInput;
        }
      }

      // Direct DOM sync for customisation blocks before saving
      // Direct DOM sync for customisation blocks before saving
      const blockContainers = document.querySelectorAll("#editCustomisationBlocksContainer > div");
      if (blockContainers && blockContainers.length > 0 && Array.isArray(window.currentEditCustomisations)) {
        blockContainers.forEach((containerEl, idx) => {
          if (!window.currentEditCustomisations[idx]) return;
          const labelInput = containerEl.querySelector(".edit-cust-label-input") || containerEl.querySelectorAll("input")[0];
          const sizeInput = containerEl.querySelector(".edit-cust-size-input") || containerEl.querySelectorAll("input")[1];
          const priceInput = containerEl.querySelector(".edit-cust-price-input") || containerEl.querySelectorAll("input")[2];
          const stockInput = containerEl.querySelector(".edit-cust-stock-input") || containerEl.querySelectorAll("input")[3];

          if (labelInput) window.currentEditCustomisations[idx].label = labelInput.value.trim().toUpperCase();
          if (sizeInput) window.currentEditCustomisations[idx].size = sizeInput.value.trim();
          if (priceInput) window.currentEditCustomisations[idx].priceExtra = parseFloat(priceInput.value) || 0;
          if (stockInput) {
            const rawVal = stockInput.value.trim();
            window.currentEditCustomisations[idx].stock = isNaN(parseInt(rawVal, 10)) ? 0 : parseInt(rawVal, 10);
          }
        });
      }

      // Collect additional gallery images
      const galleryInputs = document.querySelectorAll('.edit-gallery-slot-input');
      const additionalGallery = [];
      galleryInputs.forEach(input => {
        const v = sanitizeImageUrl(input.value.trim());
        if (v) additionalGallery.push(v);
      });

      const fullImageArray = [mainImageBase64, ...additionalGallery].filter(Boolean);
      const combinedImageStr = fullImageArray.join(', ');

      const updatedProduct = {
          id: id,
          nameShort: nameShort,
          name: name,
          price: price,
          retailPrice: retailPrice,
          stock: stock,
          image: combinedImageStr,
          galleryImages: fullImageArray,
          image_thumb: thumbImageBase64,
          description: description,
          status: status,
          flair: flair,
          flairText: flairText,
          flairColor: flairColor,
          invisibleFlair: invisibleFlair,
          standardBottleImg: standardBottleImg,
          masculinePremiumBottleImg: masculinePremiumBottleImg,
          femininePremiumBottleImg: femininePremiumBottleImg,
          customisations: window.currentEditCustomisations || [],
          sizes: sizes,
          isBundle: isBundle,
          bundleSize: bundleSize,
          sortOrder: sortOrder,
          scentProfile: scentProfile
      };

      if (window.minaraProducts) {
          const mIdx = window.minaraProducts.findIndex(p => p.id === id);
          if (mIdx > -1) {
              window.minaraProducts[mIdx] = updatedProduct;
          } else {
              window.minaraProducts.push(updatedProduct);
          }
          if (typeof renderProductsTable === "function") {
              renderProductsTable();
          }
      }

      try {
          const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
          const idx = localProds.findIndex(p => p.id === id);
          updatedProduct.syncStatus = "pending";
          if (idx > -1) {
              localProds[idx] = updatedProduct;
          } else {
              localProds.push(updatedProduct);
          }
          localStorage.setItem("minara_products", JSON.stringify(localProds));
          window.logAdminSave("Saved product snapshot to localStorage cache.");
      } catch (err) {
          window.logAdminSave("LocalStorage error: " + err.message, true);
      }

      let firestoreSuccess = false;
      let firestoreErrorMsg = "";

      if (window.db && window.dbDoc && window.dbSetDoc) {
          window.logAdminSave("Writing product data to Firestore database...");
          try {
              const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error("Timeout")), 20000)
              );
              await Promise.race([
                  window.dbSetDoc(window.dbDoc(window.db, "products", id), {
                      nameShort: nameShort,
                      name: name,
                      price: price,
                      retailPrice: retailPrice,
                      stock: stock,
                      image: mainImageBase64,
                      image_thumb: thumbImageBase64,
                      description: description,
                      status: status,
                      flair: flair,
                      flairText: flairText,
                      flairColor: flairColor,
                      invisibleFlair: invisibleFlair,
                      standardBottleImg: standardBottleImg,
                      masculinePremiumBottleImg: masculinePremiumBottleImg,
                      femininePremiumBottleImg: femininePremiumBottleImg,
                      customisations: window.currentEditCustomisations || [],
                      sizes: sizes,
                      isBundle: isBundle,
                      bundleSize: bundleSize,
                      sortOrder: sortOrder,
                      scentProfile: scentProfile,
                      timestamp: new Date().toISOString()
                  }),
                  timeoutPromise
              ]);
              firestoreSuccess = true;
              window.logAdminSave("✓ Firestore write successful.");
              
              try {
                  const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
                  const idx = localProds.findIndex(p => p.id === id);
                  if (idx > -1) {
                      localProds[idx].syncStatus = "synced";
                      localStorage.setItem("minara_products", JSON.stringify(localProds));
                  }
              } catch (cacheErr) {}
          } catch (dbErr) {
              firestoreErrorMsg = dbErr.message || dbErr;
              window.logAdminSave("⚠ Firestore write failed: " + firestoreErrorMsg, true);
          }
      }

      // Sync edited product to GitHub static repo
      if (firestoreSuccess && window.syncToGithubCallable) {
          window.logAdminSave("Calling syncToGithubCallable ('saveProduct')...");
          try {
              const res = await window.syncToGithubCallable({
                  action: "saveProduct",
                  payload: {
                      id: id,
                      nameShort: nameShort,
                      name: name,
                      price: price,
                      retailPrice: retailPrice,
                      stock: stock,
                      image: mainImageBase64,
                      image_thumb: thumbImageBase64,
                      description: description,
                      status: status,
                      flair: flair,
                      flairText: flairText,
                      flairColor: flairColor,
                      invisibleFlair: invisibleFlair,
                      standardBottleImg: standardBottleImg,
                      masculinePremiumBottleImg: masculinePremiumBottleImg,
                      femininePremiumBottleImg: femininePremiumBottleImg,
                      customisations: window.currentEditCustomisations || [],
                      sizes: sizes,
                      isBundle: isBundle,
                      bundleSize: bundleSize,
                      sortOrder: sortOrder,
                      scentProfile: scentProfile
                  }
              });
              window.logAdminSave("✓ GitHub sync successful: " + (res.data ? res.data.message : "OK"));
          } catch (gitHubErr) {
              window.logAdminSave("⚠ GitHub sync warning: " + (gitHubErr.message || gitHubErr), true);
              alert("Warning: Product was updated in database, but GitHub sync failed: " + (gitHubErr.message || gitHubErr));
          }
      }

      const editFileEl = document.getElementById("editProdFile");
      if (editFileEl) {
        editFileEl.value = "";
        editFileEl.dispatchEvent(new Event("change", { bubbles: true }));
      }

      closeEditModal();
      if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
      }

      if (firestoreSuccess) {
          alert("Success! " + name + " has been successfully updated and synced.");
      } else {
          alert("Warning: " + name + " was updated locally, but failed to sync online.\nError: " + firestoreErrorMsg);
      }
      
      if (typeof window.loadCatalog === 'function') {
          window.loadCatalog();
      }
    };

    window.toggleBundleSizeInput = function(action) {
      if (action === 'add') {
        const isBundle = document.getElementById("prodIsBundle") ? document.getElementById("prodIsBundle").checked : false;
        const group = document.getElementById("prodBundleSizeGroup");
        if (group) group.style.display = isBundle ? "block" : "none";
      } else {
        const isBundle = document.getElementById("editProdIsBundle") ? document.getElementById("editProdIsBundle").checked : false;
        const group = document.getElementById("editProdBundleSizeGroup");
        if (group) group.style.display = isBundle ? "block" : "none";
      }
    };

    window.handleAddProduct = async function(e) {
      e.preventDefault();
      
      const nameShort = document.getElementById("prodNameShort") ? document.getElementById("prodNameShort").value.trim() : "";
      const name = document.getElementById("prodName") ? document.getElementById("prodName").value.trim() : "";
      const price = parseFloat(document.getElementById("prodPrice") ? document.getElementById("prodPrice").value : "0");
      const retailPriceVal = document.getElementById("prodRetailPrice") ? document.getElementById("prodRetailPrice").value.trim() : "";
      const retailPrice = retailPriceVal !== "" ? retailPriceVal : null;
      const stock = parseInt(document.getElementById("prodStock") ? document.getElementById("prodStock").value : "0");
      const imageInput = document.getElementById("prodImage") ? document.getElementById("prodImage").value.trim() : "";
      const fileInput = document.getElementById("prodFile") && document.getElementById("prodFile").files ? document.getElementById("prodFile").files[0] : null;
      const description = document.getElementById("prodDesc") ? document.getElementById("prodDesc").value.trim() : "";
      const status = document.getElementById("prodStatus") ? document.getElementById("prodStatus").value : "active";
      const flair = document.getElementById("prodFlair") ? document.getElementById("prodFlair").value : "";
      const invisibleFlair = document.getElementById("prodInvisibleFlair") ? document.getElementById("prodInvisibleFlair").value : "";
      const flairText = document.getElementById("prodFlairText") ? document.getElementById("prodFlairText").value.trim() : "";
      const flairColor = document.getElementById("prodFlairColorText") ? document.getElementById("prodFlairColorText").value.trim() : "";
      const standardBottleImg = document.getElementById("prodStandardBottleImg") ? document.getElementById("prodStandardBottleImg").value.trim() : "";
      const masculinePremiumBottleImg = document.getElementById("prodMasculinePremiumBottleImg") ? document.getElementById("prodMasculinePremiumBottleImg").value.trim() : "";
      const femininePremiumBottleImg = document.getElementById("prodFemininePremiumBottleImg") ? document.getElementById("prodFemininePremiumBottleImg").value.trim() : "";
      const isBundle = document.getElementById("prodIsBundle") ? document.getElementById("prodIsBundle").checked : false;
      const bundleSize = isBundle && document.getElementById("prodBundleSize") ? parseInt(document.getElementById("prodBundleSize").value) || 0 : 0;
      const sortOrderVal = document.getElementById("prodSortOrder") ? document.getElementById("prodSortOrder").value.trim() : "";
      const sortOrder = sortOrderVal !== "" ? parseInt(sortOrderVal) : null;

      // Extract Scent Profile
      const addTopNotes = document.getElementById("addProdTopNotes") ? document.getElementById("addProdTopNotes").value.trim() : "";
      const addMiddleNotes = document.getElementById("addProdMiddleNotes") ? document.getElementById("addProdMiddleNotes").value.trim() : "";
      const addBaseNotes = document.getElementById("addProdBaseNotes") ? document.getElementById("addProdBaseNotes").value.trim() : "";
      
      let scentProfile = null;
      if (addTopNotes || addMiddleNotes || addBaseNotes) {
        scentProfile = {
          keyNotes: [],
          topNotes: addTopNotes,
          topNotesDesc: "The first notes you smell",
          middleNotes: addMiddleNotes,
          middleNotesDesc: "The heart of the perfume",
          baseNotes: addBaseNotes,
          baseNotesDesc: "The notes that linger all day"
        };
      }

      if (!name || isNaN(price) || isNaN(stock) || !description) {
        alert("Please fill in all required fields (Name, Price, Stock, Description).");
        return;
      }
      if (!imageInput && !fileInput) {
        alert("Please either provide an Image Path/URL or select a file to upload.");
        return;
      }

      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : "";
      if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = "INJECTING...";
      }

      let mainImageBase64 = imageInput;
      let thumbImageBase64 = "";

      if (fileInput) {
        try {
          if (typeof window.compressImage === 'function') {
            mainImageBase64 = await window.compressImage(fileInput, 1200, 0.90);
            thumbImageBase64 = await window.compressImage(fileInput, 800, 0.85);
          }
        } catch (compressErr) {
          console.error(compressErr);
          mainImageBase64 = imageInput;
        }
      }

      const sizes = [];
      if (document.getElementById("prodSize50") && document.getElementById("prodSize50").checked) sizes.push("50ml");
      if (document.getElementById("prodSize100") && document.getElementById("prodSize100").checked) sizes.push("100ml");

      const idStr = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const newProduct = {
          id: idStr,
          nameShort: nameShort,
          name: name,
          price: price,
          retailPrice: retailPrice,
          stock: stock,
          image: mainImageBase64,
          image_thumb: thumbImageBase64,
          description: description,
          status: status,
          flair: flair,
          flairText: flairText,
          flairColor: flairColor,
          invisibleFlair: invisibleFlair,
          standardBottleImg: standardBottleImg,
          masculinePremiumBottleImg: masculinePremiumBottleImg,
          femininePremiumBottleImg: femininePremiumBottleImg,
          customisations: [],
          sizes: sizes,
          isBundle: isBundle,
          bundleSize: bundleSize,
          sortOrder: sortOrder,
          scentProfile: scentProfile
      };

      try {
          const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
          const idx = localProds.findIndex(p => p.id === idStr);
          newProduct.syncStatus = "pending";
          if (idx > -1) {
              localProds[idx] = newProduct;
          } else {
              localProds.push(newProduct);
          }
          localStorage.setItem("minara_products", JSON.stringify(localProds));
      } catch (err) {
          console.error(err);
      }

      let firestoreSuccess = false;
      let firestoreErrorMsg = "";

      if (window.db && window.dbDoc && window.dbSetDoc) {
          try {
              const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error("Timeout")), 20000)
              );
              await Promise.race([
                  window.dbSetDoc(window.dbDoc(window.db, "products", idStr), {
                      nameShort: nameShort,
                      name: name,
                      price: price,
                      retailPrice: retailPrice,
                      stock: stock,
                      image: mainImageBase64,
                      image_thumb: thumbImageBase64,
                      description: description,
                      status: status,
                      flair: flair,
                      flairText: flairText,
                      flairColor: flairColor,
                      invisibleFlair: invisibleFlair,
                      standardBottleImg: standardBottleImg,
                      masculinePremiumBottleImg: masculinePremiumBottleImg,
                      femininePremiumBottleImg: femininePremiumBottleImg,
                      customisations: [],
                      sizes: sizes,
                      isBundle: isBundle,
                      bundleSize: bundleSize,
                      sortOrder: sortOrder,
                      scentProfile: scentProfile,
                      timestamp: new Date().toISOString()
                  }),
                  timeoutPromise
              ]);
              firestoreSuccess = true;
              
              try {
                  const localProds = JSON.parse(localStorage.getItem("minara_products") || "[]");
                  const idx = localProds.findIndex(p => p.id === idStr);
                  if (idx > -1) {
                      localProds[idx].syncStatus = "synced";
                      localStorage.setItem("minara_products", JSON.stringify(localProds));
                  }
              } catch (cacheErr) {}
          } catch (dbErr) {
              firestoreErrorMsg = dbErr.message || dbErr;
          }
      }

      // Sync to GitHub static repo
      if (firestoreSuccess && window.syncToGithubCallable) {
          try {
              await window.syncToGithubCallable({
                  action: "saveProduct",
                  payload: {
                      id: idStr,
                      nameShort: nameShort,
                      name: name,
                      price: price,
                      retailPrice: retailPrice,
                      stock: stock,
                      image: mainImageBase64,
                      image_thumb: thumbImageBase64,
                      description: description,
                      status: status,
                      flair: flair,
                      flairText: flairText,
                      flairColor: flairColor,
                      invisibleFlair: invisibleFlair,
                      standardBottleImg: standardBottleImg,
                      masculinePremiumBottleImg: masculinePremiumBottleImg,
                      femininePremiumBottleImg: femininePremiumBottleImg,
                      sizes: sizes,
                      isBundle: isBundle,
                      bundleSize: bundleSize,
                      sortOrder: sortOrder,
                      scentProfile: scentProfile
                  }
              });
              console.log("GitHub sync successful for: " + name);
          } catch (gitHubErr) {
              console.error("Failed to sync to GitHub:", gitHubErr);
              alert("Warning: Product was saved to database, but GitHub sync failed: " + (gitHubErr.message || gitHubErr));
          }
      }

      const form = document.getElementById("productForm");
      if (form) form.reset();
      if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
      }

      if (firestoreSuccess) {
          alert("Success! " + name + " has been successfully injected and synced.");
      } else {
          alert("Warning: " + name + " was saved locally, but failed to sync online.\nError: " + firestoreErrorMsg);
      }
      
      if (typeof window.loadCatalog === 'function') {
          window.loadCatalog();
      }
    };

    
