// Studio Extrait - Admin Orders Management Module
window.adminOrders = window.adminOrders || [];
var adminOrders = window.adminOrders;
window.activeOrderFilter = "all";
var activeOrderFilter = window.activeOrderFilter;
window.orderSearchQuery = "";
var orderSearchQuery = window.orderSearchQuery;
window.ordersViewMode = "cards"; // 'cards' | 'table'
var ordersViewMode = window.ordersViewMode;
window.selectedOrderForModal = null;
var selectedOrderForModal = window.selectedOrderForModal;
window.minaraCatalogProducts = window.minaraCatalogProducts || [];
var minaraCatalogProducts = window.minaraCatalogProducts;

function formatSessionDateTime(isoStr) {
  if (!isoStr) return "N/A";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "N/A";
  const datePart = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${datePart} • ${timePart}`;
}
window.formatSessionDateTime = formatSessionDateTime;

function formatPrice(val) {
  return (val !== undefined && val !== null && !isNaN(val)) ? Math.round(Number(val)).toString() : "0";
}
window.formatPrice = formatPrice;

function formatRetailPrice(val) {
  if (val === undefined || val === null || isNaN(val)) return "0";
  return Math.round(Number(val)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
window.formatRetailPrice = formatRetailPrice;

// Preload products.json for instant perfume thumbnail matching
async function loadProductsCatalogForOrders() {
  try {
    const res = await fetch("products.json");
    if (res.ok) {
      minaraCatalogProducts = await res.json();
      window.minaraCatalogProducts = minaraCatalogProducts;
    }
  } catch (e) {
    console.warn("Could not preload products.json for order icons", e);
  }
}
loadProductsCatalogForOrders();

// Helper: Find product thumbnail from order item or catalog with customisation / bottle support
function getProductImageForItem(item) {
  if (!item) return 'Studio Extrait Icon Svg only logo.svg';

  // 1. Direct customisation / bottle / thumbnail image on the item itself
  if (item.customImage && typeof item.customImage === 'string' && item.customImage.trim()) {
    return item.customImage.trim();
  }
  if (item.customImageThumb && typeof item.customImageThumb === 'string' && item.customImageThumb.trim()) {
    return item.customImageThumb.trim();
  }
  if (item.bottleImg && typeof item.bottleImg === 'string' && item.bottleImg.trim()) {
    return item.bottleImg.trim();
  }

  // 2. Look up product in catalog
  const nameToMatch = (item.name || item.nameShort || item.id || '').toLowerCase().trim();
  const found = (window.minaraCatalogProducts || minaraCatalogProducts || []).find(p => 
    (p.name && p.name.toLowerCase().trim() === nameToMatch) ||
    (p.nameShort && p.nameShort.toLowerCase().trim() === nameToMatch) ||
    (p.id && p.id.toLowerCase().trim() === nameToMatch)
  );

  const customName = (item.selectedBottleCustomisation || item.bottleCustomisation || item.customisation || '').toLowerCase().trim();
  const sizeName = (item.size || '').toLowerCase().trim();

  if (found) {
    // If Masculine Premium bottle customisation
    if ((customName.includes('masculine') || customName.includes('men')) && found.masculinePremiumBottleImg) {
      return found.masculinePremiumBottleImg;
    }
    // If Feminine Premium bottle customisation
    if ((customName.includes('feminine') || customName.includes('women')) && found.femininePremiumBottleImg) {
      return found.femininePremiumBottleImg;
    }
    // If Standard bottle customisation
    if (customName.includes('standard') && found.standardBottleImg) {
      return found.standardBottleImg;
    }
    // Check found.customisations array
    if (found.customisations && Array.isArray(found.customisations)) {
      const matchedCust = found.customisations.find(c => {
        const cName = (c.name || '').toLowerCase().trim();
        return (customName && (customName.includes(cName) || cName.includes(customName))) ||
               (sizeName && (sizeName.includes(cName) || cName.includes(sizeName)));
      });
      if (matchedCust && (matchedCust.image || matchedCust.image_thumb)) {
        return matchedCust.image_thumb || matchedCust.image;
      }
    }
    // If size is 100ml and product has standardBottleImg
    if (sizeName.includes('100ml') && found.standardBottleImg) {
      if (!customName || customName.includes('standard')) {
        return found.standardBottleImg;
      }
    }
    if (item.image_thumb && typeof item.image_thumb === 'string' && item.image_thumb.trim()) {
      return item.image_thumb.trim();
    }
    if (item.image && typeof item.image === 'string' && item.image.trim()) {
      const splitted = item.image.split(',')[0].trim();
      if (splitted) return splitted;
    }
    return found.image_thumb || (found.image ? found.image.split(',')[0].trim() : '') || 'Studio Extrait Icon Svg only logo.svg';
  }

  if (item.image_thumb && typeof item.image_thumb === 'string' && item.image_thumb.trim()) {
    return item.image_thumb.trim();
  }
  if (item.image && typeof item.image === 'string' && item.image.trim()) {
    const splitted = item.image.split(',')[0].trim();
    if (splitted) return splitted;
  }
  return 'Studio Extrait Icon Svg only logo.svg';
}

    // Helper: Packing checklist state
    function isItemPacked(orderId, itemIdx) {
      return localStorage.getItem(`packed_${orderId}_${itemIdx}`) === 'true';
    }
    window.toggleItemPacked = function(orderId, itemIdx, event) {
      if (event) event.stopPropagation();
      const current = isItemPacked(orderId, itemIdx);
      localStorage.setItem(`packed_${orderId}_${itemIdx}`, (!current).toString());
      renderOrdersView();
      if (selectedOrderForModal && (selectedOrderForModal.id === orderId || selectedOrderForModal.orderId === orderId)) {
        renderOrderDetailModalContent(selectedOrderForModal);
      }
    };

    // Helper: 1-Click Copy with toast notification
    window.copyOrderField = function(text, label, event) {
      if (event) event.stopPropagation();
      if (!text) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          showCopyToast(`📋 ${label} copied!`);
        }).catch(() => {
          prompt(`Copy ${label}:`, text);
        });
      } else {
        prompt(`Copy ${label}:`, text);
      }
    };

    function showCopyToast(msg) {
      const existing = document.getElementById("orderCopyToast");
      if (existing) existing.remove();

      const toast = document.createElement("div");
      toast.id = "orderCopyToast";
      toast.style.cssText = "position: fixed; bottom: 30px; right: 30px; background: var(--accent); color: #000; font-weight: 900; font-family: 'Outfit', sans-serif; font-size: 12px; padding: 10px 20px; border-radius: 6px; z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.5); animation: fadeIn 0.2s ease;";
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => {
        if (toast) toast.remove();
      }, 2200);
    }

    // View Mode Switcher: Cards vs Table
    window.setOrdersViewMode = function(mode) {
      ordersViewMode = mode;
      const btnCards = document.getElementById("viewBtn_cards");
      const btnTable = document.getElementById("viewBtn_table");
      const cardsContainer = document.getElementById("ordersCardsContainer");
      const tableWrapper = document.getElementById("ordersTableWrapper");

      if (btnCards) btnCards.classList.toggle("active", mode === "cards");
      if (btnTable) btnTable.classList.toggle("active", mode === "table");

      if (mode === "cards") {
        if (cardsContainer) cardsContainer.style.display = "grid";
        if (tableWrapper) tableWrapper.style.display = "none";
      } else {
        if (cardsContainer) cardsContainer.style.display = "none";
        if (tableWrapper) tableWrapper.style.display = "block";
      }
      renderOrdersView();
    };

    // Live Search
    window.handleOrderSearch = function(query) {
      orderSearchQuery = (query || "").toLowerCase().trim();
      const clearBtn = document.getElementById("orderSearchClearBtn");
      if (clearBtn) clearBtn.style.display = orderSearchQuery ? "block" : "none";
      renderOrdersView();
    };

    window.clearOrderSearch = function() {
      const input = document.getElementById("orderSearchInput");
      if (input) input.value = "";
      orderSearchQuery = "";
      const clearBtn = document.getElementById("orderSearchClearBtn");
      if (clearBtn) clearBtn.style.display = "none";
      renderOrdersView();
    };

    // Filter Controller
    window.filterOrders = function(statusFilter) {
      activeOrderFilter = statusFilter;
      document.querySelectorAll(".order-filter-chip").forEach(chip => {
        chip.classList.toggle("active", chip.id === `filterChip_${statusFilter}`);
      });
      renderOrdersView();
    };

    // Load Orders from Firestore
    window.loadAdminOrders = async function() {
      const cardsContainer = document.getElementById("ordersCardsContainer");
      const tableBody = document.getElementById("ordersTableBody");

      if (cardsContainer) {
        cardsContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; opacity: 0.5; padding: 60px;"><span style="font-size: 32px; display: block; margin-bottom: 10px;">📦</span>Fetching encrypted orders from Cloud Firestore...</div>`;
      }
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; opacity: 0.5; padding: 40px;">Fetching encrypted orders...</td></tr>`;
      }

      try {
        if (!window.db) {
          throw new Error("Firestore DB not initialized");
        }

        const querySnapshot = await window.dbGetDocs(window.dbCollection(window.db, "orders"));
        adminOrders = [];
        querySnapshot.forEach(docSnap => {
          adminOrders.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Sort by createdAt / timestamp descending
        adminOrders.sort((a, b) => {
          const timeA = a.createdAt || a.timestamp ? new Date(a.createdAt || a.timestamp).getTime() : 0;
          const timeB = b.createdAt || b.timestamp ? new Date(b.createdAt || b.timestamp).getTime() : 0;
          return timeB - timeA;
        });

        // Update active orders count in hero stat card
        const ordersCountEl = document.getElementById("dashboardOrdersCount");
        if (ordersCountEl) {
          const paidCount = adminOrders.filter(o => o.paid || o.status === "paid" || o.status === "Pending Shipment").length;
          ordersCountEl.textContent = paidCount.toString();
        }

        renderOrdersView();

      } catch (err) {
        console.error("Failed to load orders from Firestore:", err);
        if (cardsContainer) {
          cardsContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--danger); padding: 40px;">Error loading orders: ${err.message}</div>`;
        }
      }
    };

    // Unified Render Dispatcher
    function renderOrdersView() {
      // 1. Calculate Filter Chip Counts
      const totalAll = adminOrders.length;
      const totalPaid = adminOrders.filter(o => o.paid || o.status === "paid" || o.status === "Pending Shipment").length;
      const totalPending = adminOrders.filter(o => !o.paid && o.status !== "paid" && o.status !== "Shipped" && o.status !== "Delivered").length;
      const totalShipped = adminOrders.filter(o => o.status === "Shipped").length;
      const totalDelivered = adminOrders.filter(o => o.status === "Delivered").length;

      const cAll = document.getElementById("countOrders_all");
      const cPaid = document.getElementById("countOrders_paid");
      const cPend = document.getElementById("countOrders_pending");
      const cShip = document.getElementById("countOrders_shipped");
      const cDelv = document.getElementById("countOrders_delivered");

      if (cAll) cAll.textContent = totalAll;
      if (cPaid) cPaid.textContent = totalPaid;
      if (cPend) cPend.textContent = totalPending;
      if (cShip) cShip.textContent = totalShipped;
      if (cDelv) cDelv.textContent = totalDelivered;

      // 2. Filter Orders
      let filtered = adminOrders;
      if (activeOrderFilter === "paid") {
        filtered = adminOrders.filter(o => o.paid || o.status === "paid" || o.status === "Pending Shipment");
      } else if (activeOrderFilter === "pending_payment") {
        filtered = adminOrders.filter(o => !o.paid && o.status !== "paid" && o.status !== "Shipped" && o.status !== "Delivered");
      } else if (activeOrderFilter === "shipped") {
        filtered = adminOrders.filter(o => o.status === "Shipped");
      } else if (activeOrderFilter === "delivered") {
        filtered = adminOrders.filter(o => o.status === "Delivered");
      }

      // 3. Search Query Filter
      if (orderSearchQuery) {
        filtered = filtered.filter(o => {
          const ref = (o.orderId || o.id || "").toLowerCase();
          const name = (o.customerName || `${o.firstName || ''} ${o.lastName || ''}`).toLowerCase();
          const email = (o.email || "").toLowerCase();
          const phone = (o.phone || "").toLowerCase();
          const waybill = (o.waybill || "").toLowerCase();
          const addr = (o.address || "").toLowerCase();
          const itemsStr = o.items && Array.isArray(o.items) ? o.items.map(i => `${i.name} ${i.nameShort}`).join(" ").toLowerCase() : "";

          return ref.includes(orderSearchQuery) ||
                 name.includes(orderSearchQuery) ||
                 email.includes(orderSearchQuery) ||
                 phone.includes(orderSearchQuery) ||
                 waybill.includes(orderSearchQuery) ||
                 addr.includes(orderSearchQuery) ||
                 itemsStr.includes(orderSearchQuery);
        });
      }

      // 4. Render Active View
      renderOrderCards(filtered);
      renderOrdersTable(filtered);
    }

    // Render 1: Interactive Order Cards Grid (Haute Parfumerie Atelier Aesthetic)
    function renderOrderCards(orders) {
      const container = document.getElementById("ordersCardsContainer");
      if (!container) return;

      if (orders.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; opacity: 0.4; padding: 70px 20px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; background: rgba(255,255,255,0.01);">
            <span style="font-size: 32px; display: block; margin-bottom: 12px; opacity: 0.6;">📦</span>
            <div style="font-size: 13px; font-weight: 700; color: #fff; letter-spacing: 0.5px; text-transform: uppercase;">No Matching Orders</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px;">No customer orders found matching your selected search query or status filter.</div>
          </div>`;
        return;
      }

      container.innerHTML = "";
      orders.forEach(order => {
        const orderRef = order.orderId || order.id;
        const rawDate = order.createdAt || order.timestamp;
        const dateStr = formatSessionDateTime(rawDate);
        const relTime = rawDate ? formatRelativeTime(rawDate) : '';
        const name = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Customer";
        const email = order.email || "No email provided";
        const phone = order.phone || "";
        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}` : '#';
        const address = order.address || "Standard Delivery (Address not specified)";
        const total = order.total || 0;

        // Status Determination
        const isPaid = order.paid || order.status === "paid" || order.status === "Pending Shipment";
        let statusKey = "pending";
        let statusLabel = "Awaiting Payment";

        if (order.status === "Delivered") {
          statusKey = "delivered";
          statusLabel = "Delivered";
        } else if (order.status === "Shipped") {
          statusKey = "shipped";
          statusLabel = "In Transit / Shipped";
        } else if (isPaid) {
          statusKey = "paid";
          statusLabel = "Paid (Ready to Pack)";
        } else if (order.status === "Cancelled") {
          statusKey = "cancelled";
          statusLabel = "Cancelled";
        }

        // Build Items Gallery & Checklist
        let itemsHtml = '';
        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
          order.items.forEach((item, idx) => {
            const thumbUrl = getProductImageForItem(item);
            const packed = isItemPacked(order.id, idx);
            let scentsHtml = '';
            if (item.selectedScents && item.selectedScents.length > 0) {
              const names = item.selectedScents.map(s => typeof s === 'object' && s ? (s.nameShort || s.name) : s);
              scentsHtml = `<div style="color: rgba(255, 255, 255, 0.7); font-size: 10px; margin-top: 3px; font-family: monospace;">✨ Fragrances: <strong>${names.join(', ')}</strong></div>`;
            }
            const customisationTag = item.selectedBottleCustomisation 
              ? `<span style="font-size: 9px; font-weight: 700; background: rgba(255, 255, 255, 0.08); color: #ffffff; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; margin-left: 6px;">🏷️ ${item.selectedBottleCustomisation}</span>` 
              : '';

            itemsHtml += `
              <div class="order-item-card">
                <img src="${thumbUrl}" alt="Perfume" class="order-item-thumbnail" onerror="this.src='Studio Extrait Icon Svg only logo.svg'" />
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 700; color: #ffffff; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;">
                    <span style="overflow: hidden; text-overflow: ellipsis;">${item.name || item.nameShort || 'Perfume'}</span>
                    ${customisationTag}
                  </div>
                  <div style="font-size: 11px; color: rgba(255, 255, 255, 0.5); display: flex; gap: 10px; margin-top: 3px; font-family: monospace;">
                    <span>Size: <strong style="color: #ffffff;">${item.size || '100ml'}</strong></span>
                    <span>Qty: <strong style="color: #ffffff;">x${item.quantity}</strong></span>
                    <span>R${(Number(item.price) || 0) * (Number(item.quantity) || 1)}</span>
                  </div>
                  ${scentsHtml}
                </div>
                <div class="order-pack-checkbox ${packed ? 'packed' : 'unpacked'}" onclick="toggleItemPacked('${order.id}', ${idx}, event)" title="Toggle packed status for this item">
                  <span>${packed ? '✓ Packed' : '○ To Pack'}</span>
                </div>
              </div>`;
          });
        } else {
          itemsHtml = `<p style="opacity: 0.4; font-size: 11px; padding: 6px;">No line items found.</p>`;
        }

        // Waybill info
        const waybillHtml = order.waybill 
          ? `<div style="display: flex; align-items: center; justify-content: space-between; background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 6px; padding: 8px 12px; font-size: 11px; margin-top: 6px;">
               <div style="display: flex; align-items: center; gap: 6px;">
                 <span style="color: #38bdf8; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">🚚 Courier Guy Waybill:</span>
                 <span style="font-family: monospace; color: #ffffff; font-weight: 700;">${order.waybill}</span>
               </div>
               <button onclick="copyOrderField('${order.waybill}', 'Waybill', event)" class="copy-btn">Copy</button>
             </div>`
          : '';

        const card = document.createElement("div");
        card.className = "order-card";
        card.onclick = () => openOrderDetailModal(order.id);

        card.innerHTML = `
          <div class="order-card-accent-line"></div>

          <!-- Card Top Bar: Reference & Status Pill -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-family: monospace; font-weight: 900; color: #ffffff; font-size: 14px; letter-spacing: 0.5px;">#${orderRef}</span>
                <button onclick="copyOrderField('${orderRef}', 'Order Reference', event)" class="copy-btn">Copy</button>
              </div>
              <div style="font-size: 10.5px; color: rgba(255, 255, 255, 0.45); margin-top: 4px; font-family: monospace;">
                ${dateStr} ${relTime ? `• ${relTime}` : ''}
              </div>
            </div>
            <div class="order-status-pill ${statusKey}">
              <span class="status-dot"></span>
              ${statusLabel}
            </div>
          </div>

          <!-- Customer Contact & Delivery Info -->
          <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; color: #ffffff; font-size: 12.5px;">${name}</span>
              <button onclick="copyOrderField('${name.replace(/'/g, "\\'")}', 'Customer Name', event)" class="copy-btn">Copy Name</button>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: rgba(255, 255, 255, 0.6); font-size: 11px; font-family: monospace;">${email}</span>
              <button onclick="copyOrderField('${email}', 'Email', event)" class="copy-btn">Copy Email</button>
            </div>

            ${phone ? `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <a href="${whatsappUrl}" target="_blank" onclick="event.stopPropagation()" style="color: #34d399; text-decoration: none; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 5px; font-family: monospace;">
                  <span>💬 WhatsApp (${phone})</span>
                </a>
                <button onclick="copyOrderField('${phone}', 'Phone', event)" class="copy-btn">Copy Phone</button>
              </div>
            ` : ''}

            <div style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 8px; margin-top: 2px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                <span class="order-section-title" style="margin-bottom: 0;">📍 Delivery Destination</span>
                <button onclick="copyOrderField(\`${address.replace(/`/g, '\\`')}\`, 'Delivery Address', event)" class="copy-btn">Copy Address</button>
              </div>
              <div style="color: rgba(255, 255, 255, 0.8); line-height: 1.45; font-size: 11px; white-space: pre-wrap;">${address}</div>
              ${order.deliveryDate ? `<div style="color: #38bdf8; font-size: 10.5px; margin-top: 4px; font-family: monospace;">📅 Requested Delivery: <strong>${order.deliveryDate}</strong></div>` : ''}
              ${order.instructions ? `<div style="color: #fbbf24; font-size: 10.5px; margin-top: 3px; font-family: monospace;">📝 Notes: <strong>${order.instructions}</strong></div>` : ''}
              ${waybillHtml}
            </div>
          </div>

          <!-- Line Items Gallery -->
          <div>
            <div class="order-section-title">
              Fragrance Packages (${order.items?.length || 0})
            </div>
            ${itemsHtml}
          </div>

          <!-- Bottom Action Dock & Order Total -->
          <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 14px; margin-top: 2px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <span style="font-size: 9.5px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: rgba(255, 255, 255, 0.4); display: block;">Total Paid (ZAR)</span>
              <span style="font-size: 20px; font-family: 'Outfit', sans-serif; font-weight: 900; color: #ffffff;">R${formatRetailPrice(total)}</span>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;" onclick="event.stopPropagation()">
              ${!isPaid ? `<button onclick="quickUpdateOrderStatus('${order.id}', 'paid', event)" class="order-quick-action-btn accent">Mark Paid ✓</button>` : ''}
              ${isPaid && order.status !== 'Shipped' && order.status !== 'Delivered' ? `
                <button onclick="dispatchCourierGuyOrder('${order.id}')" class="order-quick-action-btn dispatch">🚚 Dispatch</button>
              ` : ''}
              ${order.status === 'Shipped' ? `
                <button onclick="quickUpdateOrderStatus('${order.id}', 'Delivered', event)" class="order-quick-action-btn" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border-color: rgba(168, 85, 247, 0.3);">✓ Mark Delivered</button>
              ` : ''}
              <button onclick="openOrderDetailModal('${order.id}')" class="order-quick-action-btn">Inspect</button>
            </div>
          </div>
        `;

        container.appendChild(card);
      });
    }

    // Render 2: Compact Data Table (Spreadsheet Mode)
    function renderOrdersTable(orders) {
      const tableBody = document.getElementById("ordersTableBody");
      if (!tableBody) return;

      if (orders.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; opacity: 0.4; padding: 50px;">No orders found for this filter.</td></tr>`;
        return;
      }

      tableBody.innerHTML = "";
      orders.forEach(order => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid rgba(255, 255, 255, 0.06)";
        tr.style.cursor = "pointer";
        tr.onclick = () => openOrderDetailModal(order.id);

        const orderRef = order.orderId || order.id;
        const dateStr = formatSessionDateTime(order.createdAt || order.timestamp);
        const name = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Customer";
        const email = order.email || "No email";
        const phone = order.phone || "";
        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}` : '#';

        // Ref & Date
        const tdRef = document.createElement("td");
        tdRef.style.padding = "14px 12px";
        tdRef.innerHTML = `
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-family: monospace; font-weight: bold; color: #ffffff; font-size: 12px;">#${orderRef}</span>
            <button onclick="copyOrderField('${orderRef}', 'Order Reference', event)" class="copy-btn">📋</button>
          </div>
          <div style="font-size: 10px; color: rgba(255,255,255,0.45); margin-top: 3px; font-family: monospace;">${dateStr}</div>
        `;
        tr.appendChild(tdRef);

        // Customer Details
        const tdCustomer = document.createElement("td");
        tdCustomer.style.padding = "14px 12px";
        tdCustomer.innerHTML = `
          <div style="font-weight: bold; color: #ffffff; display: flex; align-items: center; gap: 6px;">
            ${name} <button onclick="copyOrderField('${name.replace(/'/g, "\\'")}', 'Customer Name', event)" class="copy-btn">📋</button>
          </div>
          <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; font-family: monospace;">${email}</div>
          ${phone ? `
            <div style="margin-top: 4px; display: flex; align-items: center; gap: 6px;">
              <a href="${whatsappUrl}" target="_blank" onclick="event.stopPropagation()" style="color: #34d399; text-decoration: none; font-weight: bold; font-size: 10.5px; font-family: monospace;">
                💬 ${phone}
              </a>
              <button onclick="copyOrderField('${phone}', 'Phone', event)" class="copy-btn">📋</button>
            </div>
          ` : ''}
        `;
        tr.appendChild(tdCustomer);

        // Address
        const tdAddress = document.createElement("td");
        tdAddress.style.padding = "14px 12px";
        tdAddress.style.fontSize = "11px";
        tdAddress.style.maxWidth = "220px";
        tdAddress.innerHTML = `
          <div style="white-space: pre-wrap; line-height: 1.4; color: rgba(255,255,255,0.8);">${order.address || 'Standard Delivery'}</div>
          <button onclick="copyOrderField(\`${(order.address || '').replace(/`/g, '\\`')}\`, 'Address', event)" class="copy-btn" style="margin-top: 4px;">Copy Address</button>
        `;
        tr.appendChild(tdAddress);

        // Purchased Items
        const tdItems = document.createElement("td");
        tdItems.style.padding = "14px 12px";
        tdItems.style.fontSize = "11px";
        let itemsHtml = '';
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            const thumbUrl = getProductImageForItem(item);
            const customTag = (item.selectedBottleCustomisation || item.bottleCustomisation || item.customisation) 
              ? `<span style="font-size: 8.5px; background: rgba(255,255,255,0.1); color: #fff; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">🏷️ ${item.selectedBottleCustomisation || item.bottleCustomisation || item.customisation}</span>`
              : '';
            itemsHtml += `
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <img src="${thumbUrl}" style="width: 26px; height: 26px; border-radius: 4px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1); background: #000;" onerror="this.src='Studio Extrait Icon Svg only logo.svg'" />
                <span><strong style="color:#fff;">${item.name || item.nameShort}</strong> (${item.size || '100ml'}) ${customTag} x${item.quantity}</span>
              </div>`;
          });
        }
        tdItems.innerHTML = itemsHtml || '<span style="opacity: 0.4;">Details unavailable</span>';
        tr.appendChild(tdItems);

        // Total
        const tdTotal = document.createElement("td");
        tdTotal.style.padding = "14px 12px";
        tdTotal.style.fontWeight = "bold";
        tdTotal.style.fontSize = "13px";
        tdTotal.style.color = "#ffffff";
        tdTotal.textContent = `R${formatRetailPrice(order.total || 0)}`;
        tr.appendChild(tdTotal);

        // Status Badge
        const tdStatus = document.createElement("td");
        tdStatus.style.padding = "14px 12px";
        const isPaid = order.paid || order.status === "paid" || order.status === "Pending Shipment";
        let statusKey = "pending";
        let statusText = "Awaiting Payment";
        if (order.status === "Delivered") {
          statusKey = "delivered";
          statusText = "Delivered";
        } else if (order.status === "Shipped") {
          statusKey = "shipped";
          statusText = "In Transit";
        } else if (isPaid) {
          statusKey = "paid";
          statusText = "Paid";
        }
        tdStatus.innerHTML = `<div class="order-status-pill ${statusKey}"><span class="status-dot"></span>${statusText}</div>`;
        tr.appendChild(tdStatus);

        // Action Buttons
        const tdActions = document.createElement("td");
        tdActions.style.padding = "14px 12px";
        tdActions.onclick = (e) => e.stopPropagation();

        tdActions.innerHTML = `
          <div style="display: flex; gap: 6px; align-items: center;">
            <button onclick="openOrderDetailModal('${order.id}')" class="order-quick-action-btn" style="font-size: 10px; padding: 5px 10px;">Inspect</button>
            ${isPaid && order.status !== 'Shipped' && order.status !== 'Delivered' ? `<button onclick="dispatchCourierGuyOrder('${order.id}')" class="order-quick-action-btn dispatch" style="font-size: 10px; padding: 5px 10px;">Dispatch</button>` : ''}
          </div>
        `;
        tr.appendChild(tdActions);

        tableBody.appendChild(tr);
      });
    }

    // Quick Update Order Status
    window.quickUpdateOrderStatus = async function(orderId, newStatus, event) {
      if (event) event.stopPropagation();
      await window.updateOrderStatus(orderId, newStatus);
    };

    window.updateOrderStatus = async function(orderId, newStatus) {
      try {
        if (!window.db || !window.dbDoc || !window.dbUpdateDoc) return;
        const isPaid = newStatus === "paid" || newStatus === "Shipped" || newStatus === "Delivered";
        const orderRef = window.dbDoc(window.db, "orders", orderId);
        await window.dbUpdateDoc(orderRef, {
          status: newStatus,
          paid: isPaid,
          updatedAt: new Date().toISOString()
        });
        showCopyToast(`Order #${orderId} updated to ${newStatus}`);
        window.loadAdminOrders();
      } catch(err) {
        console.error("Failed to update order status:", err);
        alert("Status update failed: " + err.message);
      }
    };

    // ORDER DEEP-DIVE INSPECTOR & PRINTABLE PACKING SLIP MODAL
    window.openOrderDetailModal = function(orderId) {
      const order = adminOrders.find(o => o.id === orderId || o.orderId === orderId);
      if (!order) return;
      selectedOrderForModal = order;

      const modal = document.getElementById("orderDetailModal");
      const titleEl = document.getElementById("modalOrderRefTitle");
      const badgeEl = document.getElementById("modalOrderStatusBadge");

      const orderRef = order.orderId || order.id;
      if (titleEl) titleEl.textContent = `Order Details #${orderRef}`;

      const isPaid = order.paid || order.status === "paid" || order.status === "Pending Shipment";
      let statusKey = isPaid ? 'paid' : 'pending';
      let statusLabel = isPaid ? 'PAID' : 'PENDING';
      if (order.status === "Shipped") { statusKey = 'shipped'; statusLabel = 'IN TRANSIT'; }
      if (order.status === "Delivered") { statusKey = 'delivered'; statusLabel = 'DELIVERED'; }
      if (order.status === "Cancelled") { statusKey = 'cancelled'; statusLabel = 'CANCELLED'; }

      if (badgeEl) {
        badgeEl.textContent = statusLabel;
        badgeEl.className = `order-status-pill ${statusKey}`;
      }

      renderOrderDetailModalContent(order);

      if (modal) modal.classList.add("active");
    };

    function renderOrderDetailModalContent(order) {
      const body = document.getElementById("orderDetailModalBody");
      const actionsDock = document.getElementById("modalOrderQuickActions");
      if (!body) return;

      const orderRef = order.orderId || order.id;
      const dateStr = formatSessionDateTime(order.createdAt || order.timestamp);
      const name = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Customer";
      const email = order.email || "No email";
      const phone = order.phone || "";
      const address = order.address || "Standard Delivery";
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

      // Line items with packaging checklist
      let itemsListHtml = '';
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item, idx) => {
          const thumbUrl = getProductImageForItem(item);
          const packed = isItemPacked(order.id, idx);
          let scentsHtml = '';
          if (item.selectedScents && item.selectedScents.length > 0) {
            const names = item.selectedScents.map(s => typeof s === 'object' && s ? (s.nameShort || s.name) : s);
            scentsHtml = `<div style="color: rgba(255, 255, 255, 0.7); font-size: 11px; margin-top: 3px; font-family: monospace;">✨ Selected Scent Choices: <strong>${names.join(', ')}</strong></div>`;
          }

          itemsListHtml += `
            <div style="display: flex; gap: 16px; align-items: center; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 14px; margin-bottom: 8px;">
              <img src="${thumbUrl}" alt="Thumbnail" style="width: 56px; height: 56px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(255, 255, 255, 0.1); background: #000;" onerror="this.src='Studio Extrait Icon Svg only logo.svg'" />
              <div style="flex: 1;">
                <div style="font-size: 13.5px; font-weight: 700; color: #ffffff;">${item.name || item.nameShort || 'Perfume'}</div>
                <div style="font-size: 11px; color: rgba(255, 255, 255, 0.5); margin-top: 3px; font-family: monospace;">
                  Size: <strong style="color: #fff;">${item.size || '100ml'}</strong> • 
                  Qty: <strong style="color: #ffffff;">x${item.quantity}</strong> • 
                  Unit Price: R${item.price} • 
                  Subtotal: <strong style="color: #ffffff;">R${(Number(item.price) || 0) * (Number(item.quantity) || 1)}</strong>
                </div>
                ${item.selectedBottleCustomisation ? `<div style="font-size: 10.5px; color: #38bdf8; margin-top: 3px;">🏷️ Bottle Style: ${item.selectedBottleCustomisation}</div>` : ''}
                ${scentsHtml}
              </div>
              <div class="order-pack-checkbox ${packed ? 'packed' : 'unpacked'}" onclick="toggleItemPacked('${order.id}', ${idx})" style="padding: 8px 14px; font-size: 11px;">
                <span>${packed ? '✓ PACKED' : '○ TO PACK'}</span>
              </div>
            </div>`;
        });
      }

      body.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <!-- Customer Profile -->
          <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 16px;">
            <div class="order-section-title">Customer Profile</div>
            <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">👤 ${name}</div>
            <div style="font-size: 11.5px; color: rgba(255, 255, 255, 0.6); margin-bottom: 4px; font-family: monospace;">✉️ ${email}</div>
            <div style="font-size: 11.5px; color: rgba(255, 255, 255, 0.6); margin-bottom: 12px; font-family: monospace;">📱 ${phone || 'No phone'}</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button onclick="copyOrderField('${name.replace(/'/g, "\\'")}', 'Customer Name')" class="copy-btn">Copy Name</button>
              <button onclick="copyOrderField('${email}', 'Email')" class="copy-btn">Copy Email</button>
              <button onclick="copyOrderField('${phone}', 'Phone')" class="copy-btn">Copy Phone</button>
            </div>
          </div>

          <!-- Delivery Destination -->
          <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 16px;">
            <div class="order-section-title">Delivery Destination</div>
            <div style="font-size: 12px; color: #ffffff; line-height: 1.45; margin-bottom: 8px; white-space: pre-wrap;">${address}</div>
            ${order.instructions ? `<div style="font-size: 11px; color: #fbbf24; margin-bottom: 8px;">📝 Notes: ${order.instructions}</div>` : ''}
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button onclick="copyOrderField(\`${address.replace(/`/g, '\\`')}\`, 'Address')" class="copy-btn">Copy Address</button>
              <a href="${mapsUrl}" target="_blank" class="copy-btn" style="text-decoration: none; color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);">Google Maps</a>
            </div>
          </div>
        </div>

        <!-- Waybill & Shipping Management -->
        <div style="background: rgba(14, 165, 233, 0.05); border: 1px solid rgba(14, 165, 233, 0.2); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
            <span style="font-size: 11px; text-transform: uppercase; color: #38bdf8; font-weight: 800; letter-spacing: 0.5px;">🚚 Courier Guy Waybill & Dispatch</span>
            <button onclick="dispatchCourierGuyOrder('${order.id}')" class="order-quick-action-btn dispatch" style="font-size: 10.5px; padding: 6px 12px;">Open Courier Guy Dispatch Helper</button>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <input type="text" id="modalWaybillInput" value="${order.waybill || ''}" placeholder="Enter Courier Guy Waybill Number..." style="flex: 1; padding: 9px 12px; background: #08080c; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 6px; color: #ffffff; font-size: 11.5px; font-family: monospace;" />
            <button onclick="saveModalWaybill('${order.id}')" class="order-quick-action-btn accent" style="padding: 9px 16px; font-size: 11px;">Save Waybill</button>
          </div>
        </div>

        <!-- Line Items Gallery -->
        <div style="margin-bottom: 20px;">
          <div class="order-section-title">
            Purchased Fragrance Packages (${order.items?.length || 0} Items)
          </div>
          ${itemsListHtml}
        </div>

        <!-- Total Breakdown -->
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 18px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 10px; text-transform: uppercase; color: rgba(255, 255, 255, 0.4); font-weight: 800; letter-spacing: 1px;">Grand Total (ZAR)</div>
            <div style="font-size: 11px; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">Placed on: ${dateStr}</div>
          </div>
          <div style="font-size: 24px; font-family: 'Outfit', sans-serif; font-weight: 900; color: #ffffff;">
            R${formatRetailPrice(order.total || 0)}
          </div>
        </div>
      `;

      // Modal bottom quick status buttons
      if (actionsDock) {
        actionsDock.innerHTML = `
          <button onclick="updateOrderStatus('${order.id}', 'paid')" class="order-quick-action-btn accent">Mark Paid ✓</button>
          <button onclick="updateOrderStatus('${order.id}', 'Shipped')" class="order-quick-action-btn dispatch">Mark Shipped 🚚</button>
          <button onclick="updateOrderStatus('${order.id}', 'Delivered')" class="order-quick-action-btn" style="background: rgba(168, 85, 247, 0.15); color: #c084fc;">Mark Delivered ✓</button>
          <button onclick="updateOrderStatus('${order.id}', 'pending_payment')" class="order-quick-action-btn">Pending Payment</button>
          <button onclick="updateOrderStatus('${order.id}', 'Cancelled')" class="order-quick-action-btn" style="color: #fb7185; border-color: rgba(244, 63, 94, 0.3);">Cancel Order ✕</button>
        `;
      }
    }

    window.saveModalWaybill = async function(orderId) {
      const input = document.getElementById("modalWaybillInput");
      if (!input || !input.value.trim()) {
        alert("Please enter a waybill number.");
        return;
      }
      const val = input.value.trim();
      try {
        if (!window.db || !window.dbDoc || !window.dbUpdateDoc) return;
        const orderRef = window.dbDoc(window.db, "orders", orderId);
        await window.dbUpdateDoc(orderRef, {
          waybill: val,
          status: "Shipped",
          paid: true,
          updatedAt: new Date().toISOString()
        });
        showCopyToast(`Waybill ${val} saved! Status changed to Shipped.`);
        window.loadAdminOrders();
      } catch (err) {
        alert("Failed to save waybill: " + err.message);
      }
    };

    window.closeOrderDetailModal = function() {
      const modal = document.getElementById("orderDetailModal");
      if (modal) modal.classList.remove("active");
      selectedOrderForModal = null;
    };

    // Printable Packing Slip Generator
    window.printOrderPackingSlip = function() {
      if (!selectedOrderForModal) return;
      const order = selectedOrderForModal;
      const orderRef = order.orderId || order.id;
      const dateStr = formatSessionDateTime(order.createdAt || order.timestamp);
      const name = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Customer";
      const address = order.address || "Standard Delivery";
      const phone = order.phone || "";
      const email = order.email || "";

      let itemsRows = '';
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item, idx) => {
          let scents = '';
          if (item.selectedScents && item.selectedScents.length > 0) {
            const names = item.selectedScents.map(s => typeof s === 'object' && s ? (s.nameShort || s.name) : s);
            scents = `<br><small style="color: #666;">Fragrance options: ${names.join(', ')}</small>`;
          }
          itemsRows += `
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 10px; font-weight: bold;">${item.name || item.nameShort || 'Perfume'} ${scents}</td>
              <td style="padding: 10px; text-align: center;">${item.size || '100ml'}</td>
              <td style="padding: 10px; text-align: center; font-weight: bold;">${item.quantity}</td>
              <td style="padding: 10px; text-align: right;">R${item.price}</td>
              <td style="padding: 10px; text-align: right; font-weight: bold;">R${(Number(item.price) || 0) * (Number(item.quantity) || 1)}</td>
            </tr>`;
        });
      }

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Packing Slip - #${orderRef}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
            h1 { margin: 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase; }
            .header-table { width: 100%; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 20px; }
            .details-box { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
            .items-table th { background: #f4f4f4; padding: 10px; text-align: left; text-transform: uppercase; font-size: 11px; }
            .total-box { text-align: right; font-size: 16px; margin-bottom: 40px; }
            .footer { border-top: 1px solid #ddd; padding-top: 20px; text-align: center; font-size: 11px; color: #777; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <h1>STUDIO EXTRAIT</h1>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #555;">Handcrafted Luxury Fragrances</p>
              </td>
              <td style="text-align: right;">
                <h2 style="margin: 0; color: #111;">PACKING SLIP</h2>
                <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: bold;">Order: #${orderRef}</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #777;">Date: ${dateStr}</p>
              </td>
            </tr>
          </table>

          <div class="details-box">
            <div style="flex: 1;">
              <h4 style="margin: 0 0 6px 0; text-transform: uppercase; font-size: 11px; color: #777;">SHIP TO:</h4>
              <p style="margin: 0; font-weight: bold; font-size: 14px;">${name}</p>
              <p style="margin: 4px 0; font-size: 12px; white-space: pre-wrap;">${address}</p>
              <p style="margin: 2px 0; font-size: 12px;">Phone: ${phone}</p>
              <p style="margin: 2px 0; font-size: 12px;">Email: ${email}</p>
            </div>
            ${order.waybill ? `
              <div style="text-align: right;">
                <h4 style="margin: 0 0 6px 0; text-transform: uppercase; font-size: 11px; color: #777;">SHIPPING COURIER:</h4>
                <p style="margin: 0; font-weight: bold; font-size: 13px;">The Courier Guy</p>
                <p style="margin: 2px 0; font-size: 12px; font-family: monospace;">Waybill: <strong>${order.waybill}</strong></p>
              </div>
            ` : ''}
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item & Description</th>
                <th style="text-align: center;">Size</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="total-box">
            <p style="margin: 0;">Grand Total: <strong style="font-size: 20px;">R${formatRetailPrice(order.total || 0)}</strong></p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #28a745; font-weight: bold;">Status: ${order.paid || order.status === 'paid' ? 'PAID IN FULL' : order.status.toUpperCase()}</p>
          </div>

          <div class="footer">
            <p>Thank you for choosing Studio Extrait. For support or queries, contact us at info@studioextrait.co.za</p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        try { printWindow.print(); } catch (e) {}
      }, 400);
    };

// Global Exports for Admin Console
window.getProductImageForItem = getProductImageForItem;
window.renderOrdersView = renderOrdersView;
window.renderOrdersTable = renderOrdersTable;
