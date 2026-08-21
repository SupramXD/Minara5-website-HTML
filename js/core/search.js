// Studio Extrait - Dynamic Fragrance Search Drawer Core Module

(function() {
  window.formatInspiredNameHTML = function(name, id, nameShort) {
    if (!name) return "";
    let clean = name.replace(/<br>/gi, ' ').replace(/\s+/g, ' ').trim();
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

    if (match || (id && id.startsWith("inspired-by-"))) {
      const fragranceName = match ? match[1] : clean;
      return `<span style="font-family:'Gotham Narrow Bold', sans-serif; font-weight: 700; font-size: 11.5px; text-transform: uppercase; color: #111111; display: block; margin-bottom: 2px;">${nameShort || clean}</span><span style="font-family:'Gotham Narrow Bold', sans-serif; font-size: 8px; font-weight: bold; color: #777777; letter-spacing: 1.2px; text-transform: uppercase; display: block;">INSPIRED BY <i style="font-family:'Gotham Narrow Bold', sans-serif; font-style: italic; font-weight: 500; font-size: 11.5px; text-transform: uppercase; color: #111111; letter-spacing: 0.5px; display: inline-block;">${formatBrandName(fragranceName)}</i></span>`;
    }
    return `<span style="font-family:'Gotham Narrow Bold', sans-serif; font-weight: 700; font-size: 11.5px; text-transform: uppercase; color: #111111; display: block;">${nameShort || clean}</span>`;
  };

  window.formatCartInspiredNameHTML = function(name, id, nameShort) {
    if (!name) return "";
    let clean = name.replace(/<br>/gi, ' ').replace(/\s+/g, ' ').trim();
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

    if (match || (id && id.startsWith("inspired-by-"))) {
      const fragranceName = match ? match[1] : clean;
      return `<span style="font-family:'Gotham Narrow Bold', sans-serif; font-weight: 700; font-size: 11px; display: block; text-transform: uppercase; color: #111111; margin-bottom: 2px;">${nameShort || clean}</span><span style="font-size: 8px; font-weight: bold; color: #777777; letter-spacing: 1px; display: block;">INSPIRED BY <i style="font-family:'Gotham Narrow Bold', sans-serif; font-style: italic; font-weight: 500; font-size: 11px; text-transform: uppercase; color: #111111; letter-spacing: 0.5px; display: inline-block;">${formatBrandName(fragranceName)}</i></span>`;
    }
    return `<span style="font-family:'Gotham Narrow Bold', sans-serif; font-weight: 700; font-size: 11px; display: block; text-transform: uppercase; color: #111111;">${nameShort || clean}</span>`;
  };

  let siteProducts = [];
  let popularFragrancesList = [];

  // Load site products from cache first
  try {
    const cached = localStorage.getItem("minara_products");
    if (cached) {
      siteProducts = JSON.parse(cached);
    }
  } catch (e) {
    console.error("Error reading cache in search:", e);
  }

  let isFetchingPopularFragrances = false;
  let fetchCallbacks = [];

  function fetchPopularFragrances(callback) {
    if (popularFragrancesList.length > 0) {
      if (callback) callback(popularFragrancesList);
      return;
    }
    if (callback) {
      fetchCallbacks.push(callback);
    }
    if (isFetchingPopularFragrances) return;
    isFetchingPopularFragrances = true;

    fetch("popular_fragrances.json?t=" + Date.now())
      .then(res => {
        if (!res.ok) throw new Error("Status " + res.status);
        return res.json();
      })
      .then(data => {
        popularFragrancesList = data;
        isFetchingPopularFragrances = false;
        const callbacks = fetchCallbacks;
        fetchCallbacks = [];
        callbacks.forEach(cb => cb(data));
      })
      .catch(err => {
        console.warn("Could not load popular_fragrances.json:", err);
        isFetchingPopularFragrances = false;
      });
  }

  function injectSearchUI() {
    if (document.getElementById("searchOverlay")) return;

    const styleEl = document.createElement("style");
    styleEl.textContent = `
      #searchOverlay {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 85vw;
        background: #ffffff;
        z-index: 15000;
        display: none;
        flex-direction: column;
        padding: 20px 40px;
        color: #000000;
        border-left: 1px solid #000000;
        transform: translate3d(100%, 0, 0);
        transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        overflow-y: auto;
        font-family: Helvetica, Arial, sans-serif;
      }
      #searchOverlay.active {
        display: flex;
        transform: translate3d(0, 0, 0);
      }
      @media (min-width: 901px) {
        #searchOverlay {
          width: 55vw;
        }
        #mobileSearchBtn {
          display: none !important;
        }
      }
      .search-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        width: 100%;
        border-bottom: none;
        padding-bottom: 10px;
      }
      .search-title-text {
        font-family: 'Gotham Narrow Bold', sans-serif;
        font-size: 13px;
        font-weight: bold;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #000000;
      }
      .search-close-btn {
        background: transparent;
        border: none;
        color: #1106e8;
        font-family: 'Gotham Narrow Bold', sans-serif;
        font-size: 13px;
        font-weight: bold;
        letter-spacing: 2px;
        cursor: pointer;
        text-transform: uppercase;
        padding: 8px 0;
        display: flex;
        align-items: center;
        transition: opacity 0.2s;
      }
      .search-close-btn:hover {
        opacity: 0.6;
      }
      .search-input-wrap {
        width: 100%;
        margin: 0 auto 30px;
        position: relative;
        display: flex;
        align-items: center;
        background: #eef3f7;
        border: 1px solid #000000;
        padding: 12px 16px;
      }
      .search-input-icon {
        color: #000000;
        margin-right: 12px;
        display: flex;
        align-items: center;
      }
      .search-input-field {
        width: 100%;
        background: transparent;
        border: none;
        color: #000000;
        font-size: 13px;
        font-weight: bold;
        letter-spacing: 1px;
        outline: none;
        font-family: inherit;
        text-transform: uppercase;
      }
      .search-input-field::placeholder {
        color: #7d8e9a;
        text-transform: uppercase;
      }
      .search-header-bar {
        background: #f8f9fa;
        border-top: 1px solid #000000;
        border-bottom: 1px solid #000000;
        padding: 8px 12px;
        font-family: 'Gotham Narrow Bold', sans-serif;
        font-size: 11px;
        font-weight: bold;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: #000000;
        margin-bottom: 0px;
      }
      .suggestions-list {
        display: flex;
        flex-direction: column;
        margin-bottom: 30px;
      }
      .suggestion-item {
        padding: 10px 12px;
        border-bottom: 1px solid #e5e7eb;
        font-family: Helvetica, Arial, sans-serif;
        font-size: 12px;
        color: #1106e8;
        text-decoration: none;
        cursor: pointer;
        font-weight: bold;
        text-align: left;
        transition: background 0.2s, color 0.2s;
      }
      .suggestion-item:hover {
        background: #f9fafb;
        color: #000000;
      }
      .search-results-container {
        width: 100%;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .search-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 24px;
        margin-top: 20px;
        margin-bottom: 30px;
      }
      @media (max-width: 900px) {
        .search-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 15px;
          margin-bottom: 15px;
        }
        #searchOverlay {
          padding: 20px;
        }
        .search-grid-card-img {
          height: 100px;
          margin-bottom: 5px;
        }
        .search-grid-card {
          padding: 5px 0;
        }
      }
      .search-grid-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        background: transparent;
        text-decoration: none;
        color: #000000;
        transition: opacity 0.25s ease;
        padding: 10px 0;
      }
      .search-grid-card:hover {
        opacity: 0.75;
      }
      .search-grid-card-img {
        width: 100%;
        height: 180px;
        object-fit: contain;
        background: transparent;
        margin-bottom: 10px;
      }
      .search-grid-card-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: center;
      }
      .search-grid-card-title {
        font-family: 'Gotham Narrow Bold', sans-serif;
        font-size: 11px;
        font-weight: bold;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        color: #000000;
      }
      .search-grid-card-price {
        font-size: 11px;
        font-weight: normal;
        color: #1106e8;
        letter-spacing: 0.5px;
      }
      .search-section-title {
        font-family: 'Gotham Narrow Bold', sans-serif;
        font-size: 12px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: #000000;
        margin-top: 15px;
        margin-bottom: 15px;
        font-weight: bold;
      }
      .search-card {
        background: #ffffff;
        border: 1px solid #000000;
        padding: 20px;
        display: flex;
        gap: 20px;
        align-items: center;
        transition: border-color 0.2s;
        color: #000000;
      }
      .search-card-img {
        width: 90px;
        height: 90px;
        object-fit: contain;
        background: #ffffff;
      }
      .search-card-info {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .search-card-title {
        font-family: 'Gotham Narrow Bold', sans-serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 1.2px;
        color: #000000;
        text-decoration: none;
        text-transform: uppercase;
      }
      .search-card-title:hover {
        text-decoration: underline;
      }
      .search-card-desc {
        font-size: 11px;
        color: #6d6d6d;
        line-height: 1.45;
      }
      .search-card-price {
        font-size: 13px;
        font-weight: bold;
        color: #1106e8;
      }
      .search-notify-box {
        background: #fafafa;
        border: 1px dashed #000000;
        padding: 20px;
        margin-top: 15px;
        color: #000000;
      }
      .search-notify-title {
        font-family: 'Gotham Narrow Bold', sans-serif;
        font-size: 11px;
        font-weight: bold;
        letter-spacing: 1.5px;
        color: #000000;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .search-notify-text {
        font-size: 10.5px;
        color: #6d6d6d;
        margin-bottom: 15px;
        line-height: 1.5;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .search-notify-form {
        display: flex;
        border-bottom: 1px solid #000000;
        padding-bottom: 4px;
        max-width: 400px;
      }
      .search-notify-input {
        border: none;
        background: transparent;
        font-size: 11px;
        color: #000000;
        width: 100%;
        outline: none;
        font-family: inherit;
        letter-spacing: 0.5px;
      }
      .search-notify-input::placeholder {
        color: #a0aec0;
        text-transform: uppercase;
      }
      .search-notify-submit {
        background: transparent;
        border: none;
        font-size: 11px;
        font-weight: bold;
        color: #1106e8;
        cursor: pointer;
        padding: 0 10px;
        letter-spacing: 1px;
        text-transform: uppercase;
        font-family: inherit;
      }
      .search-notify-submit:hover {
        opacity: 0.8;
      }
      .search-link-btn {
        display: inline-block;
        margin-top: 10px;
        background: #000000;
        color: #ffffff;
        font-family: 'Gotham Narrow Bold', sans-serif;
        font-size: 9.5px;
        font-weight: bold;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        padding: 10px 20px;
        text-decoration: none;
        border: 1px solid #000000;
        transition: all 0.25s ease;
        cursor: pointer;
        align-self: flex-start;
        text-align: center;
      }
      .search-link-btn:hover {
        background: transparent;
        color: #000000;
      }
      @media (max-width: 480px) {
        .search-notify-form {
          flex-direction: column;
          border-bottom: none !important;
          gap: 10px;
        }
        .search-notify-input {
          border-bottom: 1px solid #000000;
          padding-bottom: 8px;
        }
        .search-notify-submit {
          align-self: flex-start;
          padding: 8px 0 !important;
        }
      }
      @media (max-width: 900px) {
        #searchOverlay.keyboard-open {
          padding: 10px 15px;
        }
        #searchOverlay.keyboard-open .search-top-row {
          margin-bottom: 8px;
          padding-bottom: 4px;
        }
        #searchOverlay.keyboard-open .search-input-wrap {
          margin-bottom: 12px;
          padding: 8px 12px;
        }
        #searchOverlay.keyboard-open .search-header-bar {
          padding: 4px 8px;
          margin-bottom: 4px;
          font-size: 9px;
        }
        #searchOverlay.keyboard-open .suggestions-list {
          margin-bottom: 12px;
        }
        #searchOverlay.keyboard-open .suggestion-item {
          padding: 6px 8px;
          font-size: 11px;
        }
        #searchOverlay.keyboard-open .search-grid {
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 8px;
          margin-bottom: 8px;
        }
        #searchOverlay.keyboard-open .search-grid-card {
          padding: 4px;
          border: 1px solid #eee;
          background: #fafafa;
        }
        #searchOverlay.keyboard-open .search-grid-card-img {
          height: 50px !important;
          margin-bottom: 3px;
        }
        #searchOverlay.keyboard-open .search-grid-card-title {
          font-size: 8px !important;
          line-height: 1.1;
        }
        #searchOverlay.keyboard-open .search-grid-card-price {
          font-size: 8px !important;
          margin-top: 2px !important;
        }
        #searchOverlay.keyboard-open .search-card {
          padding: 8px;
          gap: 10px;
        }
        #searchOverlay.keyboard-open .search-card-img {
          width: 45px;
          height: 45px;
        }
        #searchOverlay.keyboard-open .search-card-title {
          font-size: 10px;
        }
        #searchOverlay.keyboard-open .search-card-price {
          font-size: 10px;
        }
        #searchOverlay.keyboard-open .search-link-btn {
          padding: 6px 12px;
          font-size: 8px;
          margin-top: 6px;
        }
        #searchOverlay.keyboard-open .search-notify-box {
          padding: 10px;
          margin-top: 8px;
        }
        #searchOverlay.keyboard-open .search-notify-title {
          font-size: 9px;
          margin-bottom: 4px;
        }
        #searchOverlay.keyboard-open .search-notify-text {
          font-size: 9px;
          margin-bottom: 8px;
        }
      }
    `;
    document.head.appendChild(styleEl);

    const overlay = document.createElement("div");
    overlay.id = "searchOverlay";
    overlay.innerHTML = `
      <div class="search-top-row">
        <span class="search-title-text">SEARCH</span>
        <button class="search-close-btn" id="searchCloseBtn">
          ✕ CLOSE
        </button>
      </div>
      
      <div class="search-input-wrap">
        <span class="search-input-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </span>
        <input type="text" class="search-input-field" id="searchInput" placeholder="SEARCH HERE" autocomplete="off">
      </div>
      
      <div id="searchSuggestionsPanel">
        <div class="search-header-bar">SUGGESTIONS</div>
        <div class="suggestions-list">
          <div class="suggestion-item" id="suggestMens">Men's</div>
          <div class="suggestion-item" id="suggestWomens">Women's</div>
        </div>
      </div>
      
      <div class="search-header-bar" id="searchGridTitle">SUGGESTED PRODUCTS</div>
      <div class="search-results-container" id="searchResults"></div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("searchCloseBtn").onclick = closeSearch;
    
    const input = document.getElementById("searchInput");
    input.oninput = (e) => {
      runSearch(e.target.value);
    };

    document.getElementById("suggestMens").onclick = () => window.filterSearchByGender("men");
    document.getElementById("suggestWomens").onclick = () => window.filterSearchByGender("women");
  }

  window.filterSearchByGender = function(gender) {
    const resultsContainer = document.getElementById("searchResults");
    const suggestionsPanel = document.getElementById("searchSuggestionsPanel");
    const gridTitle = document.getElementById("searchGridTitle");
    const input = document.getElementById("searchInput");
    if (!resultsContainer) return;
    
    if (input) {
      input.value = gender === 'men' ? "Men's" : "Women's";
    }
    
    if (suggestionsPanel) suggestionsPanel.style.display = "block";
    if (gridTitle) {
      gridTitle.style.display = "block";
      gridTitle.textContent = gender === 'men' ? "Men's Fragrances" : "Women's Fragrances";
    }
    
    resultsContainer.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "search-grid";
    
    siteProducts.forEach(p => {
      if (p.status !== 'Active') return;
      const invFlair = (p.invisibleFlair || '').toLowerCase();
      const pName = (p.name || '').toLowerCase();
      const isMen = invFlair === 'men' || pName.includes('male') || pName.includes('homme');
      const isWomen = invFlair === 'women' || pName.includes('women') || pName.includes('femme') || pName.includes('elle');
      
      if (gender === 'men' && !isMen && p.id !== 'inspired-by-creed-aventus') return;
      if (gender === 'women' && !isWomen) return;
      
      const card = document.createElement("a");
      card.className = "search-grid-card";
      card.href = `template product.html?id=${p.id}`;
      
      const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(p.image, p.image_thumb) : p.image;
      const formattedPrice = window.formatPrice ? window.formatPrice(p.price) : p.price;
      card.innerHTML = `
        <img src="${imgUrl}" class="search-grid-card-img" alt="${p.name}">
        <div class="search-grid-card-info" style="width: 100%;">
          ${window.formatInspiredNameHTML(p.name, p.id, p.nameShort)}
          <span class="search-grid-card-price" style="display: block; margin-top: 4px;">R${formattedPrice}</span>
        </div>
      `;
      grid.appendChild(card);
    });
    
    resultsContainer.appendChild(grid);
  };

  function renderDefaultGrid() {
    const resultsContainer = document.getElementById("searchResults");
    const suggestionsPanel = document.getElementById("searchSuggestionsPanel");
    const gridTitle = document.getElementById("searchGridTitle");
    if (!resultsContainer) return;
    
    if (suggestionsPanel) suggestionsPanel.style.display = "block";
    if (gridTitle) {
      gridTitle.style.display = "block";
      gridTitle.textContent = "SUGGESTED PRODUCTS";
    }
    
    resultsContainer.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "search-grid";
    
    siteProducts.forEach(p => {
      if (p.status !== 'Active') return;
      const card = document.createElement("a");
      card.className = "search-grid-card";
      card.href = `template product.html?id=${p.id}`;
      
      const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(p.image, p.image_thumb) : p.image;
      const formattedPrice = window.formatPrice ? window.formatPrice(p.price) : p.price;
      
      card.innerHTML = `
        <img src="${imgUrl}" class="search-grid-card-img" alt="${p.name}">
        <div class="search-grid-card-info" style="width: 100%;">
          ${window.formatInspiredNameHTML(p.name, p.id, p.nameShort)}
          <span class="search-grid-card-price" style="display: block; margin-top: 4px;">R${formattedPrice}</span>
        </div>
      `;
      grid.appendChild(card);
    });
    
    resultsContainer.appendChild(grid);
  }

  window.openSearch = function() {
    injectSearchUI();
    const overlay = document.getElementById("searchOverlay");
    if (overlay) {
      if (typeof window.closeCart === "function") {
        window.closeCart();
      } else {
        const cartPanel = document.getElementById("cartPanel");
        if (cartPanel) cartPanel.classList.remove("open");
      }

      overlay.style.display = "flex";
      overlay.offsetHeight; // Force reflow
      overlay.classList.add("active");

      const dimmer = document.getElementById("pageDimmer");
      if (dimmer) {
        dimmer.classList.add("active");
      }

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      const input = document.getElementById("searchInput");
      if (input) {
        input.value = "";
        input.focus();
      }
      renderDefaultGrid();
      
      // Push history state so back button closes overlay
      if (!history.state || !history.state.searchOpen) {
        history.pushState({ searchOpen: true }, "");
      }
      
      fetchPopularFragrances();
    }
  };

  window.closeSearch = function(isFromPopState = false) {
    const overlay = document.getElementById("searchOverlay");
    if (overlay) {
      overlay.classList.remove("active");
      overlay.classList.remove("keyboard-open");
      overlay.style.top = "";
      overlay.style.height = "";
      
      const header = document.querySelector("header");
      if (header) {
        header.style.display = "";
      }
      
      const dimmer = document.getElementById("pageDimmer");
      if (dimmer) {
        const cartPanel = document.getElementById("cartPanel");
        if (!cartPanel || !cartPanel.classList.contains("open")) {
          dimmer.classList.remove("active");
        }
      }

      setTimeout(() => {
        overlay.style.display = "none";
      }, 400);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      
      if (!isFromPopState && history.state && history.state.searchOpen) {
        history.back();
      }
    }
  };

  window.addEventListener("popstate", (e) => {
    const overlay = document.getElementById("searchOverlay");
    if (overlay && overlay.classList.contains("active")) {
      window.closeSearch(true);
    }
  });

  const closeSearch = window.closeSearch;
  const openSearch = window.openSearch;

  function normalizeString(str) {
    if (!str) return "";
    return str.toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9\s]/g, "")
              .replace(/\s+/g, " ")
              .trim();
  }

  function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  window.submitSearchStockNotification = async function(e, productId, productName, matchedFragranceName) {
    e.preventDefault();
    const form = e.target;
    const emailInput = form.querySelector('input[type="email"]');
    const submitBtn = form.querySelector('button[type="submit"]');
    const successEl = form.parentNode.querySelector('.search-notify-success');
    
    if (window.dbPromise) {
      await window.dbPromise;
    }
    if (!emailInput || !window.db || !window.dbAddDoc || !window.dbCollection) return;
    const email = emailInput.value.trim();
    if (!email) return;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "SAVING...";
    }
    
    try {
      await window.dbAddDoc(window.dbCollection(window.db, "stock_notifications"), {
        email: email,
        productId: productId,
        productName: productName,
        matchedFragrance: matchedFragranceName,
        size: "50ml",
        timestamp: new Date().toISOString()
      });
      form.style.display = "none";
      if (successEl) successEl.style.display = "block";
    } catch (error) {
      console.error("Error saving search stock notification:", error);
      alert("Failed to submit request: " + error.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "NOTIFY ME";
      }
    }
  };

  window.submitUnsupportedRequest = async function(e, queryVal, closestId) {
    e.preventDefault();
    const form = e.target;
    const emailInput = form.querySelector('input[type="email"]');
    const submitBtn = form.querySelector('button[type="submit"]');
    const successEl = form.parentNode.querySelector('.search-notify-success');
    
    if (window.dbPromise) {
      await window.dbPromise;
    }
    if (!emailInput || !window.db || !window.dbAddDoc || !window.dbCollection) return;
    
    const email = emailInput.value.trim();
    if (!email) return;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "SAVING...";
    }
    
    try {
      await window.dbAddDoc(window.dbCollection(window.db, "unsupported_requests"), {
        email: email,
        query: queryVal,
        closest: closestId,
        timestamp: new Date().toISOString()
      });
      
      form.style.display = "none";
      if (successEl) {
        successEl.style.display = "block";
      }
    } catch (error) {
      console.error("Error saving unsupported request to Firestore:", error);
      alert("Failed to submit request: " + error.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "NOTIFY ME";
      }
    }
  };

  const STOCKED_FRAGRANCE_KEYWORDS = {
    "inspired-by-jpg-le-male": [
      "jpg le male", "le male", "jean paul gaultier le male", 
      "jean paul gaultier le male edt", "jpg le male edt", 
      "gaultier le male", "le male gaultier", "jpg male", "jp le male"
    ],
    "inspired-by-creed-aventus": [
      "creed aventus", "aventus", "creed aventus edp", 
      "creed aventus edt", "aventish", "aventus creed", "creed aventus cologne", "creed"
    ]
  };

  function findDirectStockedProductByQuery(queryText) {
    const clean = normalizeString(queryText);
    for (const productId in STOCKED_FRAGRANCE_KEYWORDS) {
      const keywords = STOCKED_FRAGRANCE_KEYWORDS[productId];
      if (keywords.some(kw => {
        const normalizedKw = normalizeString(kw);
        return clean === normalizedKw || clean.includes(normalizedKw) || normalizedKw.includes(clean);
      })) {
        return siteProducts.find(p => p.id === productId);
      }
    }
    return null;
  }

  window.fetchPopularFragrances = fetchPopularFragrances;

  window.findSearchMatchedProductIds = function(queryText) {
    if (!queryText) return [];
    const cleanQuery = normalizeString(queryText);
    if (!cleanQuery) return [];

    let matches = [];

    const addMatch = (productId, isDirect, popularMatch) => {
      const existingIdx = matches.findIndex(m => m.id === productId);
      if (existingIdx === -1) {
        matches.push({ id: productId, isDirect: isDirect, popularMatch: popularMatch });
      } else {
        if (isDirect) {
          matches[existingIdx].isDirect = true;
          matches[existingIdx].popularMatch = null;
        }
      }
    };

    if (siteProducts && siteProducts.length > 0) {
      siteProducts.forEach(p => {
        const normName = normalizeString(p.name);
        const normShort = normalizeString(p.nameShort);
        const normId = normalizeString(p.id);
        
        if (normName.includes(cleanQuery) || cleanQuery.includes(normName) ||
            normShort.includes(cleanQuery) || cleanQuery.includes(normShort) ||
            normId.includes(cleanQuery)) {
          addMatch(p.id, true, null);
        } else {
          const nameDist = getLevenshteinDistance(cleanQuery, normName);
          const shortDist = getLevenshteinDistance(cleanQuery, normShort);
          const idDist = getLevenshteinDistance(cleanQuery, normId.replace("inspiredby", "").replace("inspired", ""));
          
          const maxAllowed = Math.max(2, Math.floor(cleanQuery.length / 2.5));
          if (nameDist <= maxAllowed || shortDist <= maxAllowed || idDist <= maxAllowed) {
            addMatch(p.id, true, null);
          }
        }
      });
    }

    const directProduct = findDirectStockedProductByQuery(queryText);
    if (directProduct) {
      addMatch(directProduct.id, true, null);
    }

    if (popularFragrancesList.length > 0) {
      const exactPopMatches = popularFragrancesList.filter(f => {
        const normBrand = normalizeString(f.brand);
        const normName = normalizeString(f.name);
        const combined = `${normBrand} ${normName}`;
        
        const aliasMatch = f.aliases && f.aliases.some(alias => {
          const nAlias = normalizeString(alias);
          return nAlias === cleanQuery || nAlias.includes(cleanQuery) || cleanQuery.includes(nAlias);
        });
        if (aliasMatch) return true;
        if (combined.includes(cleanQuery) || cleanQuery.includes(combined)) return true;
        if (cleanQuery.includes(normBrand) && cleanQuery.includes(normName)) return true;
        return false;
      });

      if (exactPopMatches.length > 0) {
        exactPopMatches.forEach(f => {
          if (f.closestOurSite) {
            const isDirect = f.isDirectInspiration === true || (directProduct && directProduct.id === f.closestOurSite);
            addMatch(f.closestOurSite, !!isDirect, f);
          }
        });
      } else {
        let bestDistance = Infinity;
        let bestPopMatch = null;
        
        popularFragrancesList.forEach(f => {
          f.aliases && f.aliases.forEach(alias => {
            const nAlias = normalizeString(alias);
            const dist = getLevenshteinDistance(cleanQuery, nAlias);
            if (dist < bestDistance) {
              bestDistance = dist;
              bestPopMatch = f;
            }
          });
          const nameDist = getLevenshteinDistance(cleanQuery, normalizeString(f.name));
          if (nameDist < bestDistance) {
            bestDistance = nameDist;
            bestPopMatch = f;
          }
          const combinedDist = getLevenshteinDistance(cleanQuery, `${normalizeString(f.brand)} ${normalizeString(f.name)}`);
          if (combinedDist < bestDistance) {
            bestDistance = combinedDist;
            bestPopMatch = f;
          }
        });
        
        const maxAllowedDistance = Math.max(3, Math.floor(cleanQuery.length / 2));
        if (bestDistance <= maxAllowedDistance && bestPopMatch && bestPopMatch.closestOurSite) {
          const isDirect = bestPopMatch.isDirectInspiration === true || (directProduct && directProduct.id === bestPopMatch.closestOurSite);
          addMatch(bestPopMatch.closestOurSite, !!isDirect, bestPopMatch);
        }
      }
    }

    if (matches.some(m => m.isDirect)) {
      matches = matches.filter(m => m.isDirect);
    }

    return matches;
  };

  function displayDirectProductCard(product, popFrag) {
    const resultsContainer = document.getElementById("searchResults");
    if (!resultsContainer) return;
    
    const formattedPrice = window.formatPrice ? window.formatPrice(product.price) : product.price;
    const detailUrl = `template product.html?id=${product.id}`;
    const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(product.image, product.image_thumb) : product.image;
    
    const popName = popFrag && popFrag.name ? `${popFrag.brand} ${popFrag.name}` : product.name;
    
    resultsContainer.innerHTML = `
      <div class="search-section-title">Direct Match in Store</div>
      <div class="search-card" style="cursor: pointer;" onclick="window.location.href='${detailUrl}'">
        <img src="${imgUrl}" class="search-card-img" alt="${product.name}">
        <div class="search-card-info">
          <span class="search-card-title" style="display: block;">${window.formatInspiredNameHTML(product.name, product.id, product.nameShort)}</span>
          <span class="search-card-price" style="display: block; margin-top: 5px;">R${formattedPrice}</span>
          <span class="search-link-btn" style="margin-top: 10px; width: fit-content; display: inline-block;">VIEW FRAGRANCE</span>
        </div>
      </div>
    `;
    
    if (product.stock <= 0) {
      const notifyBox = document.createElement("div");
      notifyBox.className = "search-notify-box";
      notifyBox.innerHTML = `
        <div class="search-notify-title">Out of Stock — Get Notified</div>
        <div class="search-notify-text">
          This fragrance is currently out of stock. Enter your email below to be notified as soon as it is back in stock.
        </div>
        <form class="search-notify-form" id="stockNotifyForm">
          <input type="email" class="search-notify-input" id="stockNotifyEmail" placeholder="Enter your email address" required>
          <button type="submit" class="search-notify-submit">NOTIFY ME</button>
        </form>
        <div class="search-notify-success" style="display: none; margin-top: 10px; color: #34c759; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
          ✓ You're on the list! We'll notify you.
        </div>
      `;
      resultsContainer.appendChild(notifyBox);
      
      const form = notifyBox.querySelector("#stockNotifyForm");
      if (form) {
        form.onsubmit = (e) => {
          window.submitSearchStockNotification(e, product.id, product.name, popName);
        };
      }
    }
  }

  function displayClosestMatch(popFrag, originalQuery, isFuzzy = false) {
    const resultsContainer = document.getElementById("searchResults");
    if (!resultsContainer) return;
    
    const closestProduct = siteProducts.find(p => p.id === popFrag.closestOurSite);
    if (!closestProduct) return;
    
    const formattedPrice = window.formatPrice ? window.formatPrice(closestProduct.price) : closestProduct.price;
    const detailUrl = `template product.html?id=${closestProduct.id}`;
    const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(closestProduct.image, closestProduct.image_thumb) : closestProduct.image;
    
    const matchLabel = isFuzzy 
      ? `DID YOU MEAN <strong>${popFrag.brand.toUpperCase()} ${popFrag.name.toUpperCase()}</strong>?` 
      : `<strong>${popFrag.brand.toUpperCase()} ${popFrag.name.toUpperCase()}</strong> IS IN OUR DATABASE.`;
    
    resultsContainer.innerHTML = `
      <div class="search-section-title">RECOMMENDED MATCH</div>
      <div style="font-size: 11px; color: #000000; margin-bottom: 20px; line-height: 1.5; text-transform: uppercase; letter-spacing: 0.5px;">
        ${matchLabel} WE DO NOT STOCK THIS SCENT YET. OUR CLOSEST MATCH:
      </div>
      
      <div class="search-card" style="cursor: pointer;" onclick="window.location.href='${detailUrl}'">
        <img src="${imgUrl}" class="search-card-img" alt="${closestProduct.name}">
        <div class="search-card-info">
          <span class="search-card-title" style="display: block;">${window.formatInspiredNameHTML(closestProduct.name, closestProduct.id, closestProduct.nameShort)}</span>
          <span class="search-card-price" style="display: block; margin-top: 5px;">R${formattedPrice}</span>
          <span class="search-link-btn" style="margin-top: 10px; width: fit-content; display: inline-block;">EXPLORE MATCH</span>
        </div>
      </div>
      
      <div class="search-notify-box">
        <div class="search-notify-title">GET NOTIFIED</div>
        <div class="search-notify-text">
          ENTER YOUR EMAIL TO BE NOTIFIED WHEN OUR VERSION OF <strong>${popFrag.brand.toUpperCase()} ${popFrag.name.toUpperCase()}</strong> IS AVAILABLE.
        </div>
        <form class="search-notify-form" id="unsupportedNotifyForm">
          <input type="email" class="search-notify-input" id="unsupportedNotifyEmail" placeholder="Enter your email address" required>
          <button type="submit" class="search-notify-submit">NOTIFY ME</button>
        </form>
        <div class="search-notify-success" style="display: none; margin-top: 10px; color: #34c759; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
          ✓ Request saved successfully! We'll notify you.
        </div>
      </div>
    `;

    const form = document.getElementById("unsupportedNotifyForm");
    if (form) {
      form.onsubmit = (e) => {
        window.submitUnsupportedRequest(e, `${popFrag.brand} ${popFrag.name}`, closestProduct.id);
      };
    }
  }

  function displayFallback(originalQuery) {
    const resultsContainer = document.getElementById("searchResults");
    if (!resultsContainer) return;
    
    const bestSeller = siteProducts.find(p => p.id === 'inspired-by-creed-aventus') || siteProducts[0];
    if (!bestSeller) return;
    
    const formattedPrice = window.formatPrice ? window.formatPrice(bestSeller.price) : bestSeller.price;
    const detailUrl = `template product.html?id=${bestSeller.id}`;
    const imgUrl = window.getThumbnailImageUrl ? window.getThumbnailImageUrl(bestSeller.image, bestSeller.image_thumb) : bestSeller.image;
    const escapedQuery = window.escapeHTML ? window.escapeHTML(originalQuery) : originalQuery;

    resultsContainer.innerHTML = `
      <div class="search-section-title">NO MATCH FOUND</div>
      <div style="font-size: 11px; color: #000000; margin-bottom: 20px; line-height: 1.5; text-transform: uppercase; letter-spacing: 0.5px;">
        WE COULD NOT FIND A MATCH FOR "<strong>${escapedQuery.toUpperCase()}</strong>". OUR BEST SELLER:
      </div>
      
      <div class="search-card" style="cursor: pointer;" onclick="window.location.href='${detailUrl}'">
        <img src="${imgUrl}" class="search-card-img" alt="${bestSeller.name}">
        <div class="search-card-info">
          <span class="search-card-title" style="display: block;">${window.formatInspiredNameHTML(bestSeller.name, bestSeller.id, bestSeller.nameShort)}</span>
          <span class="search-card-price" style="display: block; margin-top: 5px;">R${formattedPrice}</span>
          <span class="search-link-btn" style="margin-top: 10px; width: fit-content; display: inline-block;">EXPLORE BEST SELLER</span>
        </div>
      </div>
      
      <div class="search-notify-box">
        <div class="search-notify-title">REQUEST FORMULATION</div>
        <div class="search-notify-text">
          ENTER YOUR EMAIL TO REQUEST A CLONE FORMULATION OF "<strong>${escapedQuery.toUpperCase()}</strong>".
        </div>
        <form class="search-notify-form" id="unsupportedNotifyForm">
          <input type="email" class="search-notify-input" id="unsupportedNotifyEmail" placeholder="Enter your email address" required>
          <button type="submit" class="search-notify-submit">SUBMIT REQUEST</button>
        </form>
        <div class="search-notify-success" style="display: none; margin-top: 10px; color: #34c759; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
          ✓ Scent request saved! We will notify you when we launch it.
        </div>
      </div>
    `;

    const form = document.getElementById("unsupportedNotifyForm");
    if (form) {
      form.onsubmit = (e) => {
        window.submitUnsupportedRequest(e, originalQuery, bestSeller.id);
      };
    }
  }

  function runSearch(queryText) {
    const resultsContainer = document.getElementById("searchResults");
    const suggestionsPanel = document.getElementById("searchSuggestionsPanel");
    const gridTitle = document.getElementById("searchGridTitle");
    if (!resultsContainer) return;
    
    const cleanQuery = normalizeString(queryText);
    if (!cleanQuery) {
      renderDefaultGrid();
      return;
    }
    
    if (suggestionsPanel) suggestionsPanel.style.display = "none";
    if (gridTitle) gridTitle.style.display = "none";
    resultsContainer.innerHTML = "";

    if (popularFragrancesList.length === 0) {
      resultsContainer.innerHTML = `<div style="font-size: 11px; color: #777777; text-transform: uppercase; letter-spacing: 1px; padding: 20px 0;">SEARCHING...</div>`;
      fetchPopularFragrances(() => {
        const currentInput = document.getElementById("searchInput");
        if (currentInput && normalizeString(currentInput.value) === cleanQuery) {
          runSearch(currentInput.value);
        }
      });
      return;
    }
    
    let directProduct = findDirectStockedProductByQuery(queryText);
    let bestPopMatch = null;
    let isFuzzy = false;
    
    const exactPopMatches = popularFragrancesList.filter(f => {
      const normBrand = normalizeString(f.brand);
      const normName = normalizeString(f.name);
      const combined = `${normBrand} ${normName}`;
      
      const aliasMatch = f.aliases && f.aliases.some(alias => {
        const nAlias = normalizeString(alias);
        return nAlias === cleanQuery || nAlias.includes(cleanQuery) || cleanQuery.includes(nAlias);
      });
      if (aliasMatch) return true;
      
      if (combined.includes(cleanQuery) || cleanQuery.includes(combined)) return true;
      if (cleanQuery.includes(normBrand) && cleanQuery.includes(normName)) return true;
      
      return false;
    });
    
    if (exactPopMatches.length > 0) {
      bestPopMatch = exactPopMatches[0];
    } else {
      let bestDistance = Infinity;
      
      popularFragrancesList.forEach(f => {
        f.aliases && f.aliases.forEach(alias => {
          const nAlias = normalizeString(alias);
          const dist = getLevenshteinDistance(cleanQuery, nAlias);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestPopMatch = f;
          }
        });
        const nameDist = getLevenshteinDistance(cleanQuery, normalizeString(f.name));
        if (nameDist < bestDistance) {
          bestDistance = nameDist;
          bestPopMatch = f;
        }
        const combinedDist = getLevenshteinDistance(cleanQuery, `${normalizeString(f.brand)} ${normalizeString(f.name)}`);
        if (combinedDist < bestDistance) {
          bestDistance = combinedDist;
          bestPopMatch = f;
        }
      });
      
      const maxAllowedDistance = Math.max(3, Math.floor(cleanQuery.length / 2));
      if (bestDistance <= maxAllowedDistance) {
        isFuzzy = true;
      } else {
        bestPopMatch = null;
      }
    }
    
    if (bestPopMatch && bestPopMatch.isDirectInspiration === true) {
      const found = siteProducts.find(p => p.id === bestPopMatch.closestOurSite);
      if (found) {
        directProduct = found;
      }
    }
    
    if (directProduct) {
      displayDirectProductCard(directProduct, bestPopMatch);
    } else if (bestPopMatch) {
      displayClosestMatch(bestPopMatch, queryText, isFuzzy);
    } else {
      displayFallback(queryText);
    }
  }

  const initSearchSystem = () => {
    // Fetch products in background for search
    fetch("products.json?t=" + Date.now())
      .then(res => res.json())
      .then(data => {
        siteProducts = data;
      })
      .catch(err => {
        console.warn("Could not fetch products.json for search:", err);
      });

    fetchPopularFragrances();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initSearchSystem();
    });
  } else {
    initSearchSystem();
  }
})();
