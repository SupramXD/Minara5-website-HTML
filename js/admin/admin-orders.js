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

// Order markup is built with innerHTML, so customer-supplied text (names,
// emails, scents) must be escaped before it is interpolated.
function ordEsc(value) {
  return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
window.ordEsc = ordEsc;

// Same idea, but for a value that ends up inside a single-quoted JS string in
// an inline onclick (copyOrderField('...')): quotes must survive as escapes.
function ordJsAttr(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, ' ');
}
window.ordJsAttr = ordJsAttr;

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

  const customName = (item.selectedBottleCustomisation || item.bottleCustomisation || item.customisation || '').toLowerCase().trim();
  const isCustomised = customName && !customName.includes('standard');

  // 1. Direct customisation / bottle / thumbnail image on the item itself
  if (isCustomised) {
    if (item.customImage && typeof item.customImage === 'string' && item.customImage.trim()) {
      return item.customImage.trim();
    }
    if (item.customImageThumb && typeof item.customImageThumb === 'string' && item.customImageThumb.trim()) {
      return item.customImageThumb.trim();
    }
    if (item.bottleImg && typeof item.bottleImg === 'string' && item.bottleImg.trim()) {
      return item.bottleImg.trim();
    }
  }

  // 2. Look up product in catalog
  const nameToMatch = (item.name || item.nameShort || item.id || '').toLowerCase().trim();
  const found = (window.minaraCatalogProducts || minaraCatalogProducts || []).find(p => 
    (p.name && p.name.toLowerCase().trim() === nameToMatch) ||
    (p.nameShort && p.nameShort.toLowerCase().trim() === nameToMatch) ||
    (p.id && p.id.toLowerCase().trim() === nameToMatch)
  );

  const sizeName = (item.size || '').toLowerCase().trim();

  if (found) {
    // If specific customisation was selected (and not standard)
    if (isCustomised) {
      if ((customName.includes('masculine') || customName.includes('men')) && found.masculinePremiumBottleImg) {
        return found.masculinePremiumBottleImg;
      }
      if ((customName.includes('feminine') || customName.includes('women')) && found.femininePremiumBottleImg) {
        return found.femininePremiumBottleImg;
      }
      if (found.customisations && Array.isArray(found.customisations)) {
        const matchedCust = found.customisations.find(c => {
          const cName = (c.label || c.name || '').toLowerCase().trim();
          return cName && (customName === cName || customName.includes(cName) || cName.includes(customName));
        });
        if (matchedCust && (matchedCust.image_data || matchedCust.image_thumb || matchedCust.image)) {
          return matchedCust.image_data || matchedCust.image_thumb || matchedCust.image;
        }
      }
    }

    // If standard product or size without customisation
    if (item.image_thumb && typeof item.image_thumb === 'string' && item.image_thumb.trim()) {
      return item.image_thumb.trim();
    }
    if (item.image && typeof item.image === 'string' && item.image.trim()) {
      const splitted = item.image.split(',')[0].trim();
      if (splitted) return splitted;
    }
    return found.image_thumb || (found.image ? found.image.split(',')[0].trim() : '') || found.standardBottleImg || 'Studio Extrait Icon Svg only logo.svg';
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
        if (cardsContainer) cardsContainer.style.display = "flex";
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
        cardsContainer.innerHTML = `<div class="ord-empty">Fetching orders from Firestore…</div>`;
      }
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7" class="ord-empty">Fetching orders…</td></tr>`;
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
          cardsContainer.innerHTML = `<div class="ord-empty" style="color: var(--ord-red); border-color: rgba(179,38,30,0.35);">Could not load orders: ${ordEsc(err.message)}</div>`;
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

    // Render 1: horizontal order rows (light desk theme).
    // One line per order: reference + date, customer, the products chipped
    // sideways, then status / total / actions. The old stacked dark cards are
    // gone; nothing here should reintroduce a card per order.
    function renderOrderCards(orders) {
      const container = document.getElementById("ordersCardsContainer");
      if (!container) return;

      if (orders.length === 0) {
        container.innerHTML = `<div class="ord-empty">No orders match this search or filter.</div>`;
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
        const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}` : '';
        const total = order.total || 0;

        const isPaid = order.paid || order.status === "paid" || order.status === "Pending Shipment";
        let statusKey = "pending";
        let statusLabel = "Awaiting payment";
        if (order.status === "Delivered") { statusKey = "delivered"; statusLabel = "Delivered"; }
        else if (order.status === "Shipped") { statusKey = "shipped"; statusLabel = "Shipped"; }
        else if (order.status === "Cancelled") { statusKey = "cancelled"; statusLabel = "Cancelled"; }
        else if (isPaid) { statusKey = "paid"; statusLabel = "Paid · to pack"; }

        // Products sit side by side as chips instead of stacking as blocks.
        const items = Array.isArray(order.items) ? order.items : [];
        const shown = items.slice(0, 4);
        let itemsHtml = shown.map((item, idx) => {
          const thumbUrl = getProductImageForItem(item);
          const packed = isItemPacked(order.id, idx);
          const label = `${item.name || item.nameShort || 'Perfume'} · ${item.size || '100ml'}`;
          const scents = (item.selectedScents || [])
            .map(s => (s && typeof s === 'object') ? (s.nameShort || s.name) : s)
            .filter(Boolean);
          const title = label + (scents.length ? ' — ' + scents.join(', ') : '');
          return `<span class="ord-item${packed ? ' ord-item-packed' : ''}" title="${ordEsc(title)}">
              <img src="${ordEsc(thumbUrl)}" alt="" onerror="this.src='Studio Extrait Icon Svg only logo.svg'" />
              <span class="ord-item-text">${ordEsc(label)}</span>
              <span class="ord-item-qty">×${Number(item.quantity) || 1}</span>
            </span>`;
        }).join('');
        if (items.length > shown.length) {
          itemsHtml += `<span class="ord-item-more">+${items.length - shown.length} more</span>`;
        }
        if (!itemsHtml) itemsHtml = `<span class="ord-item-more">No line items</span>`;

        const row = document.createElement("div");
        row.className = "ord-row";
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.setAttribute("aria-label", `Open order ${orderRef}`);
        row.onclick = () => window.openOrderDetailModal(order.id);
        row.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.openOrderDetailModal(order.id); }
        };

        row.innerHTML = `
          <div class="ord-cell">
            <div class="ord-ref">#${ordEsc(orderRef)}
              <button type="button" class="ord-copy" title="Copy order reference"
                onclick="copyOrderField('${ordEsc(orderRef)}', 'Order Reference', event)">⧉</button>
            </div>
            <div class="ord-date">${ordEsc(dateStr)}${relTime ? ' · ' + ordEsc(relTime) : ''}</div>
          </div>

          <div class="ord-cell">
            <div class="ord-cust-name">${ordEsc(name)}</div>
            <div class="ord-cust-meta">${ordEsc(email)}</div>
            ${phone ? `<div class="ord-cust-meta"><a class="ord-cust-phone" href="${ordEsc(whatsappUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${ordEsc(phone)}</a></div>` : ''}
          </div>

          <div class="ord-cell ord-items-row">${itemsHtml}</div>

          <div class="ord-right">
            <span class="ord-pill ${statusKey}">${statusLabel}</span>
            <span class="ord-total">R${formatRetailPrice(total)}</span>
            <div class="ord-actions" onclick="event.stopPropagation()">
              ${isPaid && order.status !== 'Shipped' && order.status !== 'Delivered' ? `<button type="button" class="ord-btn" onclick="dispatchCourierGuyOrder('${order.id}')">Dispatch</button>` : ''}
              <button type="button" class="ord-btn ord-btn-primary" onclick="openOrderDetailModal('${order.id}')">Open</button>
              <button type="button" class="ord-btn ord-btn-danger" title="Delete this order"
                aria-label="Delete order ${ordEsc(orderRef)}" onclick="askDeleteOrder('${order.id}', event)">Delete</button>
            </div>
          </div>`;

        container.appendChild(row);
      });
    }

    // Render 2: compact spreadsheet mode (light desk theme)
    function renderOrdersTable(orders) {
      const tableBody = document.getElementById("ordersTableBody");
      if (!tableBody) return;

      if (orders.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="ord-empty">No orders found for this filter.</td></tr>`;
        return;
      }

      tableBody.innerHTML = "";
      orders.forEach(order => {
        const tr = document.createElement("tr");
        tr.onclick = () => window.openOrderDetailModal(order.id);

        const orderRef = order.orderId || order.id;
        const dateStr = formatSessionDateTime(order.createdAt || order.timestamp);
        const name = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Customer";
        const email = order.email || "No email";
        const phone = order.phone || "";
        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}` : '';

        const isPaid = order.paid || order.status === "paid" || order.status === "Pending Shipment";
        let statusKey = "pending";
        let statusText = "Awaiting payment";
        if (order.status === "Delivered") { statusKey = "delivered"; statusText = "Delivered"; }
        else if (order.status === "Shipped") { statusKey = "shipped"; statusText = "Shipped"; }
        else if (order.status === "Cancelled") { statusKey = "cancelled"; statusText = "Cancelled"; }
        else if (isPaid) { statusKey = "paid"; statusText = "Paid"; }

        let itemsHtml = '';
        if (Array.isArray(order.items)) {
          order.items.forEach(item => {
            const thumbUrl = getProductImageForItem(item);
            const customTag = (item.selectedBottleCustomisation || item.bottleCustomisation || item.customisation)
              ? `<span class="ord-muted" style="font-size:9.5px;">· ${ordEsc(item.selectedBottleCustomisation || item.bottleCustomisation || item.customisation)}</span>`
              : '';
            itemsHtml += `<div class="ord-mini-item">
                <img src="${ordEsc(thumbUrl)}" alt="" onerror="this.src='Studio Extrait Icon Svg only logo.svg'" />
                <span><strong>${ordEsc(item.name || item.nameShort || 'Perfume')}</strong> (${ordEsc(item.size || '100ml')}) ${customTag} ×${Number(item.quantity) || 1}</span>
              </div>`;
          });
        }

        tr.innerHTML = `
          <td>
            <div class="ord-mono">#${ordEsc(orderRef)}</div>
            <div class="ord-muted" style="font-size:10.5px;margin-top:3px;">${ordEsc(dateStr)}</div>
          </td>
          <td>
            <div style="font-weight:700;">${ordEsc(name)}</div>
            <div class="ord-muted" style="font-size:11px;">${ordEsc(email)}</div>
            ${phone ? `<div style="margin-top:3px;"><a class="ord-cust-phone" style="font-size:11px;" href="${ordEsc(whatsappUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${ordEsc(phone)}</a></div>` : ''}
          </td>
          <td style="max-width:220px;">
            <div class="ord-muted" style="white-space:pre-wrap;line-height:1.4;font-size:11px;">${ordEsc(order.address || 'Standard delivery')}</div>
          </td>
          <td>
            <div class="ord-cell-items">${itemsHtml || '<span class="ord-muted">No items</span>'}</div>
          </td>
          <td class="ord-cell-total">R${formatRetailPrice(order.total || 0)}</td>
          <td><span class="ord-pill ${statusKey}">${statusText}</span></td>
          <td onclick="event.stopPropagation()">
            <div class="ord-actions">
              <button type="button" class="ord-btn" onclick="openOrderDetailModal('${order.id}')">Open</button>
              ${isPaid && order.status !== 'Shipped' && order.status !== 'Delivered' ? `<button type="button" class="ord-btn" onclick="dispatchCourierGuyOrder('${order.id}')">Dispatch</button>` : ''}
              <button type="button" class="ord-btn ord-btn-danger" title="Delete this order" onclick="askDeleteOrder('${order.id}', event)">Delete</button>
            </div>
          </td>`;

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
      if (titleEl) titleEl.textContent = `Order #${orderRef}`;

      const isPaid = order.paid || order.status === "paid" || order.status === "Pending Shipment";
      let statusKey = isPaid ? 'paid' : 'pending';
      let statusLabel = isPaid ? 'Paid' : 'Pending';
      if (order.status === "Shipped") { statusKey = 'shipped'; statusLabel = 'Shipped'; }
      if (order.status === "Delivered") { statusKey = 'delivered'; statusLabel = 'Delivered'; }
      if (order.status === "Cancelled") { statusKey = 'cancelled'; statusLabel = 'Cancelled'; }

      if (badgeEl) {
        badgeEl.textContent = statusLabel;
        badgeEl.className = `ord-pill ${statusKey}`;
      }

      // Paint the body BEFORE showing the overlay so the click feels instant.
      renderOrderDetailModalContent(order);

      if (modal) {
        // #orders-tab keeps a `transform` (tabFadeIn ... forwards) and its panel
        // a backdrop-filter; either one makes `position: fixed` resolve against
        // the panel instead of the viewport - which is exactly why the popup
        // used to open far above the click and force a long scroll. At <body>
        // level it is always pinned to the screen.
        if (modal.parentElement !== document.body) document.body.appendChild(modal);
        modal.classList.add("active");
        modal.scrollTop = 0;
      }
      const bodyEl = document.getElementById("orderDetailModalBody");
      if (bodyEl) bodyEl.scrollTop = 0;
      document.body.classList.add("ord-modal-open");
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
      const address = order.address || "Standard delivery";
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
      // Address is passed through an inline handler, so quotes and backticks
      // would break the markup - flatten them to spaces.
      const addressJs = String(address).replace(/[`"'\\]/g, ' ').replace(/\s+/g, ' ').trim();

      let itemsListHtml = '';
      if (Array.isArray(order.items)) {
        order.items.forEach((item, idx) => {
          const thumbUrl = getProductImageForItem(item);
          const packed = isItemPacked(order.id, idx);
          const scents = (item.selectedScents || [])
            .map(s => (s && typeof s === 'object') ? (s.nameShort || s.name) : s)
            .filter(Boolean);
          itemsListHtml += `
            <div class="ord-line-item">
              <img src="${ordEsc(thumbUrl)}" alt="" onerror="this.src='Studio Extrait Icon Svg only logo.svg'" />
              <div style="flex: 1; min-width: 0;">
                <div class="ord-line-name">${ordEsc(item.name || item.nameShort || 'Perfume')}</div>
                <div class="ord-line-meta">
                  ${ordEsc(item.size || '100ml')} · qty ${Number(item.quantity) || 1} · R${formatRetailPrice(item.price || 0)} each · line R${formatRetailPrice((Number(item.price) || 0) * (Number(item.quantity) || 1))}
                </div>
                ${item.selectedBottleCustomisation ? `<div class="ord-line-custom">Bottle: ${ordEsc(item.selectedBottleCustomisation)}</div>` : ''}
                ${scents.length ? `<div class="ord-line-scents">Scents: ${ordEsc(scents.join(', '))}</div>` : ''}
              </div>
              <button type="button" class="ord-pack-btn${packed ? ' packed' : ''}" onclick="toggleItemPacked('${order.id}', ${idx}, event)">
                ${packed ? '✓ Packed' : 'Mark packed'}
              </button>
            </div>`;
        });
      }
      if (!itemsListHtml) itemsListHtml = `<div class="ord-empty" style="padding: 24px;">No line items on this order.</div>`;

      body.innerHTML = `
        <div class="ord-modal-grid">
          <div class="ord-panel">
            <div class="ord-panel-title">Customer</div>
            <div class="ord-detail-name">${ordEsc(name)}</div>
            <div class="ord-detail-line">${ordEsc(email)}</div>
            <div class="ord-detail-line">${ordEsc(phone || 'No phone')}</div>
            <div class="ord-panel-actions">
              <button type="button" class="ord-btn" onclick="copyOrderField('${ordJsAttr(name)}', 'Customer name', event)">Copy name</button>
              <button type="button" class="ord-btn" onclick="copyOrderField('${ordJsAttr(email)}', 'Email', event)">Copy email</button>
              ${phone ? `<button type="button" class="ord-btn" onclick="copyOrderField('${ordJsAttr(phone)}', 'Phone', event)">Copy phone</button>` : ''}
            </div>
          </div>

          <div class="ord-panel">
            <div class="ord-panel-title">Delivery</div>
            <div class="ord-detail-addr">${ordEsc(address)}</div>
            ${order.deliveryDate ? `<div class="ord-detail-line">Requested day: ${ordEsc(order.deliveryDate)}</div>` : ''}
            ${order.instructions ? `<div class="ord-detail-note">Notes: ${ordEsc(order.instructions)}</div>` : ''}
            <div class="ord-panel-actions">
              <button type="button" class="ord-btn" onclick="copyOrderField(\`${addressJs}\`, 'Address', event)">Copy address</button>
              <a class="ord-btn" href="${ordEsc(mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>
            </div>
          </div>
        </div>

        <div class="ord-panel ord-panel-waybill">
          <div class="ord-panel-title">Courier Guy waybill</div>
          <div class="ord-waybill-row">
            <input type="text" id="modalWaybillInput" class="ord-waybill-input" value="${ordEsc(order.waybill || '')}" placeholder="Waybill number…" />
            <button type="button" class="ord-btn ord-btn-primary" onclick="saveModalWaybill('${order.id}')">Save waybill</button>
            <button type="button" class="ord-btn" onclick="dispatchCourierGuyOrder('${order.id}')">Dispatch helper</button>
          </div>
          ${order.waybill ? `<div class="ord-detail-line" style="margin-top: 8px;">Saved: ${ordEsc(order.waybill)}</div>` : ''}
        </div>

        <div class="ord-panel-title">Items (${Array.isArray(order.items) ? order.items.length : 0})</div>
        ${itemsListHtml}

        <div class="ord-total-bar">
          <div>
            <div class="ord-total-label">Order total</div>
            <div class="ord-total-sub">#${ordEsc(orderRef)} · placed ${ordEsc(dateStr)}${order.paymentGateway ? ' · via ' + ordEsc(order.paymentGateway) : ''}</div>
          </div>
          <div class="ord-total-value">R${formatRetailPrice(order.total || 0)}</div>
        </div>`;

      if (actionsDock) {
        actionsDock.innerHTML = `
          <button type="button" class="ord-btn" onclick="updateOrderStatus('${order.id}', 'paid')">Mark paid</button>
          <button type="button" class="ord-btn" onclick="updateOrderStatus('${order.id}', 'Shipped')">Mark shipped</button>
          <button type="button" class="ord-btn" onclick="updateOrderStatus('${order.id}', 'Delivered')">Mark delivered</button>
          <button type="button" class="ord-btn" onclick="updateOrderStatus('${order.id}', 'pending_payment')">Pending payment</button>
          <button type="button" class="ord-btn ord-btn-danger" onclick="updateOrderStatus('${order.id}', 'Cancelled')">Cancel order</button>`;
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
      const dialog = document.getElementById("orderDeleteDialog");
      if (!dialog || !dialog.classList.contains("active")) document.body.classList.remove("ord-modal-open");
    };

    // ------------------------------------------------------------------
    // DELETE AN ORDER — one button, one yes/no confirmation.
    // ------------------------------------------------------------------
    var pendingDeleteOrderId = null;

    window.askDeleteOrder = function(orderId, event) {
      if (event) event.stopPropagation();
      const order = adminOrders.find(o => o.id === orderId || o.orderId === orderId);
      if (!order) return;
      pendingDeleteOrderId = order.id;

      const ref = order.orderId || order.id;
      const name = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim();
      const textEl = document.getElementById("orderDeleteDialogText");
      if (textEl) {
        textEl.textContent = `Order #${ref}` + (name ? ` for ${name}` : '') +
          ` — R${formatRetailPrice(order.total || 0)}.`;
      }

      const dialog = document.getElementById("orderDeleteDialog");
      if (!dialog) return;
      if (dialog.parentElement !== document.body) document.body.appendChild(dialog);
      dialog.classList.add("active");
      document.body.classList.add("ord-modal-open");

      const confirmBtn = document.getElementById("orderDeleteConfirmBtn");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Yes, delete";
        confirmBtn.focus();
      }
    };

    // The 🗑 inside the order overlay deletes the order currently on screen.
    window.askDeleteOrderFromModal = function() {
      if (selectedOrderForModal) window.askDeleteOrder(selectedOrderForModal.id);
    };

    window.closeOrderDeleteDialog = function() {
      pendingDeleteOrderId = null;
      const dialog = document.getElementById("orderDeleteDialog");
      if (dialog) dialog.classList.remove("active");
      const modal = document.getElementById("orderDetailModal");
      if (!modal || !modal.classList.contains("active")) document.body.classList.remove("ord-modal-open");
    };

    window.confirmDeleteOrder = async function() {
      const id = pendingDeleteOrderId;
      if (!id) return;

      const confirmBtn = document.getElementById("orderDeleteConfirmBtn");
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Deleting…";
      }

      try {
        if (!(window.db && window.dbDoc && window.dbDeleteDoc)) {
          throw new Error("Firestore is not ready — refresh the admin page and try again.");
        }
        await window.dbDeleteDoc(window.dbDoc(window.db, "orders", id));
        adminOrders = adminOrders.filter(o => o.id !== id);
        window.adminOrders = adminOrders;
        window.closeOrderDeleteDialog();
        window.closeOrderDetailModal();
        renderOrdersView();
        showCopyToast("Order deleted");
      } catch (err) {
        console.error("Failed to delete order:", err);
        alert("Could not delete the order: " + err.message);
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = "Yes, delete";
        }
      }
    };

    // Escape closes the confirmation first, then the order overlay.
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      const dialog = document.getElementById("orderDeleteDialog");
      if (dialog && dialog.classList.contains("active")) { window.closeOrderDeleteDialog(); return; }
      const modal = document.getElementById("orderDetailModal");
      if (modal && modal.classList.contains("active")) window.closeOrderDetailModal();
    });

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

window.fulfillOrder = function(rowId) {
  const row = document.getElementById("order-row-" + rowId);
  if (!row) return;

  const statusTd = row.cells[4];
  if (statusTd) statusTd.innerHTML = `<span class="status-badge shipped">Shipped</span>`;

  const actionTd = row.cells[5];
  if (actionTd) actionTd.innerHTML = `<button class="btn-action" disabled style="opacity: 0.5; cursor: not-allowed;">Completed</button>`;

  const revEl = document.getElementById("dashboardRevenue");
  const ordEl = document.getElementById("dashboardOrdersCount");
  const statEl = document.getElementById("orderFulfillmentStats");
  if (statEl) statEl.textContent = "Fulfillment updated ✓";
  
  alert("Order #" + (1025 - rowId) + " fulfilled successfully! Revenue updated.");
};

