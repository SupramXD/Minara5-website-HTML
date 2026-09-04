// Studio Extrait - Homepage "Customers are saying" Testimonials
// Reads the admin-curated `featured_reviews` from custom_text_settings.json (favoured,
// synced to GitHub via the admin panel + deployed), with a localStorage fallback.

(function() {
  let featuredReviews = [];
  let productNameMap = {};
  let currentIndex = 0;
  let rotateTimer = null;

  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function starSVG(filled, size) {
    const w = size || 16;
    if (filled) {
      return `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="#cea44c" stroke="#cea44c" stroke-width="1.5" style="margin-right:3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }
    return `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="#cea44c" stroke-width="1.5" style="margin-right:3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }

  function buildStars(rating, size) {
    const r = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
    let html = "";
    for (let i = 1; i <= 5; i++) html += starSVG(i <= r, size);
    return html;
  }

  function resolveProductLabel(productId) {
    if (!productId) return "";
    if (productNameMap[productId]) return productNameMap[productId];
    // Fall back to a tidy slug-ified id if we cannot resolve a friendly name.
    const slug = String(productId).replace(/-/g, " ").replace(/inspired by /i, "").trim();
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  function getReviews() {
    // localStorage mirror is populated by header.js' applyCustomText loader.
    try {
      const cached = localStorage.getItem("minara_custom_text");
      if (cached) {
        const data = JSON.parse(cached);
        if (Array.isArray(data.featured_reviews) && data.featured_reviews.length) {
          featuredReviews = data.featured_reviews;
        }
      }
    } catch (e) {
      console.warn("home-reviews: cached custom text parse failed", e);
    }
  }

  function renderAggregate() {
    const starsEl = document.getElementById("homeTestimonialsStars");
    const scoreEl = document.getElementById("homeTestimonialsScore");
    if (!starsEl || !scoreEl) return;

    let total = 0;
    featuredReviews.forEach(r => { total += Number(r.rating) || 0; });
    const avg = featuredReviews.length ? (total / featuredReviews.length).toFixed(1) : "0.0";

    starsEl.innerHTML = buildStars(avg, 14);
    scoreEl.textContent = `${avg} (${featuredReviews.length})`;
  }

  function renderSlide(resetTimer) {
    const card = document.getElementById("homeTestimonialsCard");
    const textEl = document.getElementById("homeTestimonialsText");
    const starsEl = document.getElementById("homeTestimonialsCardStars");
    const nameEl = document.getElementById("homeTestimonialsName");
    const productEl = document.getElementById("homeTestimonialsProduct");
    if (!card || !textEl || !starsEl || !nameEl || !productEl) return;
    if (!featuredReviews.length) return;

    const review = featuredReviews[currentIndex % featuredReviews.length];
    const label = resolveProductLabel(review.productId);

    card.classList.add("fading");
    setTimeout(() => {
      textEl.textContent = review.text || "";
      starsEl.innerHTML = buildStars(review.rating, 16);
      nameEl.textContent = review.name || "Verified Customer";
      productEl.textContent = label;
      productEl.style.display = label ? "" : "none";
      card.classList.remove("fading");

      // Dots
      const dots = document.getElementById("homeTestimonialsDots");
      if (dots) {
        dots.innerHTML = "";
        featuredReviews.forEach((_, i) => {
          const btn = document.createElement("button");
          btn.className = "dot-btn" + (i === currentIndex % featuredReviews.length ? " active" : "");
          btn.setAttribute("aria-label", "Show review " + (i + 1));
          btn.onclick = () => { goTo(i); };
          dots.appendChild(btn);
        });
      }
    }, 240);

    if (resetTimer !== false) scheduleRotate();
  }

  function goTo(i) {
    currentIndex = i;
    renderSlide();
  }

  function scheduleRotate() {
    if (rotateTimer) clearTimeout(rotateTimer);
    if (featuredReviews.length <= 1) return;
    rotateTimer = setTimeout(() => {
      currentIndex = (currentIndex + 1) % featuredReviews.length;
      renderSlide();
    }, 5200);
  }

  function render() {
    const section = document.getElementById("homeTestimonials");
    if (!section) return;

    if (!featuredReviews.length) {
      section.parentNode && section.parentNode.removeChild(section);
      return;
    }

    renderAggregate();
    currentIndex = 0;
    renderSlide(true);
  }

  // Prefer the freshly-fetched custom_text_settings.json (authoritative), fall back
  // to the localStorage mirror that header.js' applyCustomText loader populates.
  async function loadFeatured() {
    let fromFetch = false;
    try {
      const res = await fetch("custom_text_settings.json?t=" + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.featured_reviews)) {
          featuredReviews = data.featured_reviews;
          fromFetch = true;
        }
      }
    } catch (e) {
      console.warn("home-reviews: fetch custom text failed", e);
    }
    if (!fromFetch) getReviews();
  }

  async function init() {
    await loadFeatured();

    // Resolve friendly product names for the review cards.
    try {
      const res = await fetch("products.json?t=" + Date.now());
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          list.forEach(p => {
            if (!p || !p.id) return;
            productNameMap[p.id] = p.nameShort || p.name || p.id;
          });
        }
      }
    } catch (e) {
      console.warn("home-reviews: could not load products.json", e);
    }

    render();
  }

  // Confirm the DOM is ready before rendering.
  function boot() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  boot();
})();
