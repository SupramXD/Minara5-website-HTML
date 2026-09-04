// Studio Extrait - Admin "Homepage Reviews" (featured testimonials) module
// Lets the admin tick which reviews appear in the homepage "Customers are saying"
// section, then saves them into custom_text_settings.json (synced to GitHub) so the
// storefront can read them after redeploy.

(function() {
  let allReviews = [];
  let featuredSet = {};     // composite key -> true
  let currentCustomText = {}; // full custom text object (preserved on save)

  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function compositeKey(r) {
    return [r.productId || "", r.name || "", r.rating || "", r.text || ""].join("|");
  }

  function starText(rating) {
    const r = Math.min(5, Math.max(1, Number(rating) || 5));
    return "★".repeat(r) + "☆".repeat(5 - r);
  }

  // Fetch the current full custom_text_settings.json (keeps other fields intact)
  async function loadCustomText() {
    try {
      const cached = localStorage.getItem("minara_custom_text");
      if (cached) currentCustomText = { ...currentCustomText, ...JSON.parse(cached) };
    } catch (e) {}
    try {
      const res = await fetch("custom_text_settings.json?t=" + Date.now());
      if (res.ok) {
        const data = await res.json();
        currentCustomText = { ...currentCustomText, ...data };
      }
    } catch (e) {
      console.warn("featured-reviews-admin: failed to fetch custom text", e);
    }
    const list = Array.isArray(currentCustomText.featured_reviews) ? currentCustomText.featured_reviews : [];
    featuredSet = {};
    list.forEach(r => { featuredSet[compositeKey(r)] = true; });
  }

  async function loadReviewsFromFirestore() {
    try {
      if (window.dbPromise) await window.dbPromise;
      if (!window.db || !window.dbCollection || !window.dbGetDocs) {
        throw new Error("Database not initialized");
      }
      const snap = await window.dbGetDocs(window.dbCollection(window.db, "reviews"));
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      });
      return list;
    } catch (err) {
      console.error("featured-reviews-admin: load reviews failed", err);
      return [];
    }
  }

  function renderBody() {
    const tbody = document.getElementById("featuredReviewsTableBody");
    const statsEl = document.getElementById("featuredReviewsStats");
    if (!tbody) return;

    if (!allReviews.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; opacity: 0.5; padding: 30px;">No reviews found in database.</td></tr>`;
      if (statsEl) statsEl.textContent = "0 Reviews Loaded";
      return;
    }

    tbody.innerHTML = "";
    allReviews.forEach((review) => {
      const key = compositeKey(review);
      const isChecked = !!featuredSet[key];
      const tr = document.createElement("tr");
      tr.setAttribute("data-key", key);
      tr.setAttribute("data-review", escapeHTML(JSON.stringify({
        productId: review.productId || "",
        name: review.name || "",
        text: review.text || "",
        rating: Number(review.rating) || 5
      })));

      const tdCheck = document.createElement("td");
      tdCheck.style.textAlign = "center";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isChecked;
      cb.style.width = "16px";
      cb.style.height = "16px";
      cb.style.cursor = "pointer";
      cb.style.accentColor = "var(--accent, #0a7d5a)";
      tdCheck.appendChild(cb);
      tr.appendChild(tdCheck);

      const tdProd = document.createElement("td");
      tdProd.style.fontFamily = "monospace";
      tdProd.style.fontSize = "11px";
      tdProd.textContent = review.productId || "";
      tr.appendChild(tdProd);

      const tdRating = document.createElement("td");
      tdRating.style.color = "#FFC107";
      tdRating.textContent = starText(review.rating);
      tr.appendChild(tdRating);

      const tdAuthor = document.createElement("td");
      tdAuthor.style.fontWeight = "bold";
      tdAuthor.textContent = review.name || "";
      tr.appendChild(tdAuthor);

      const tdContent = document.createElement("td");
      tdContent.style.fontSize = "11px";
      tdContent.style.maxWidth = "300px";
      tdContent.style.whiteSpace = "normal";
      tdContent.style.wordBreak = "break-word";
      tdContent.textContent = review.text || "";
      tr.appendChild(tdContent);

      const tdDate = document.createElement("td");
      tdDate.style.fontSize = "11px";
      tdDate.style.color = "var(--text-muted)";
      tdDate.textContent = review.timestamp ? new Date(review.timestamp).toLocaleDateString() : "";
      tr.appendChild(tdDate);

      tbody.appendChild(tr);
    });

    const selected = tbody.querySelectorAll("input[type=checkbox]:checked").length;
    if (statsEl) statsEl.textContent = `${allReviews.length} Reviews · ${selected} Featured`;
  }

  window.loadFeaturedReviewsAdmin = async function() {
    const tbody = document.getElementById("featuredReviewsTableBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; opacity: 0.5; padding: 30px;">Loading reviews from Firestore...</td></tr>`;

    await loadCustomText();
    allReviews = await loadReviewsFromFirestore();

    const statsEl = document.getElementById("featuredReviewsStats");
    if (statsEl && allReviews.length) statsEl.textContent = `${allReviews.length} Reviews Loaded`;
    renderBody();
  };

  window.saveFeaturedReviews = async function() {
    const tbody = document.getElementById("featuredReviewsTableBody");
    const btn = document.getElementById("saveFeaturedReviewsBtn");
    if (!tbody) return;

    const featured = [];
    tbody.querySelectorAll("tr[data-key]").forEach(tr => {
      const checked = tr.querySelector("input[type=checkbox]");
      if (checked && checked.checked) {
        featured.push(JSON.parse(tr.getAttribute("data-review")));
      }
    });

    if (btn) { btn.disabled = true; btn.innerHTML = "PUBLISHING..."; }

    try {
      const payload = { ...currentCustomText };
      payload.featured_reviews = featured;
      localStorage.setItem("minara_custom_text", JSON.stringify(payload));

      let savedLocally = false;
      if (window.db && window.dbDoc && window.dbSetDoc) {
        try {
          await window.dbSetDoc(window.dbDoc(window.db, "settings", "custom_text"), payload);
          savedLocally = true;
        } catch (e) {
          console.warn("Firestore save failed", e);
        }
      }

      let gitSynced = false;
      if (window.syncToGithubCallable) {
        try {
          const res = await window.syncToGithubCallable({ action: "saveCustomText", payload });
          if (res.data && res.data.success) gitSynced = true;
          else throw new Error(res.data && res.data.message ? res.data.message : "GitHub sync failed");
        } catch (e) {
          console.error("GitHub sync failed", e);
        }
      }

      currentCustomText = payload;
      renderBody();

      const msg = gitSynced
        ? `Success! ${featured.length} review${featured.length === 1 ? "" : "s"} featured & synced to GitHub. They'll appear on the homepage after the next deploy.`
        : `Saved locally${savedLocally ? " to Firestore" : ""}. GitHub auto-sync failed — run the deploy workflow to publish.`;
      alert(msg);
    } catch (err) {
      console.error("Failed to save featured reviews:", err);
      alert("Failed to save featured reviews: " + (err.message || err));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = "Save & Sync"; }
    }
  };
})();
