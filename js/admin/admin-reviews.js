// Studio Extrait - Admin Reviews & Customer Moderation Module

(function() {
  let adminReviews = [];
  window.adminReviews = adminReviews;

  // ==========================================
  // LOAD REVIEWS FROM FIRESTORE
  // ==========================================
  window.loadAdminReviews = async function() {
    const tableBody = document.getElementById("reviewsTableBody");
    const statusEl = document.getElementById("reviewsStats");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; opacity: 0.5; padding: 30px;">Loading reviews from Firestore...</td></tr>`;
    if (statusEl) statusEl.textContent = "Loading...";

    try {
      if (window.dbPromise) {
        await window.dbPromise;
      }
      if (!window.db) {
        throw new Error("Database not initialized");
      }

      const querySnapshot = await window.dbGetDocs(window.dbCollection(window.db, "reviews"));
      adminReviews = [];
      querySnapshot.forEach(doc => {
        adminReviews.push({ id: doc.id, ...doc.data() });
      });
      window.adminReviews = adminReviews;

      // Sort by timestamp descending
      adminReviews.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });

      if (statusEl) statusEl.textContent = `${adminReviews.length} Reviews Loaded`;

      if (adminReviews.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; opacity: 0.5; padding: 30px;">No reviews found in database.</td></tr>`;
        return;
      }

      tableBody.innerHTML = "";
      adminReviews.forEach((review) => {
        const tr = document.createElement("tr");

        // Product ID
        const tdProd = document.createElement("td");
        tdProd.style.fontFamily = "monospace";
        tdProd.style.fontSize = "11px";
        tdProd.textContent = review.productId || "";
        tr.appendChild(tdProd);

        // Rating
        const tdRating = document.createElement("td");
        tdRating.style.color = "#FFC107";
        const ratingNum = Math.min(5, Math.max(1, Number(review.rating) || 5));
        tdRating.textContent = "★".repeat(ratingNum) + "☆".repeat(5 - ratingNum);
        tr.appendChild(tdRating);

        // Author
        const tdAuthor = document.createElement("td");
        tdAuthor.style.fontWeight = "bold";
        tdAuthor.textContent = review.name || "";
        tr.appendChild(tdAuthor);

        // Content
        const tdContent = document.createElement("td");
        tdContent.style.fontSize = "11px";
        tdContent.style.maxWidth = "300px";
        tdContent.style.whiteSpace = "normal";
        tdContent.style.wordBreak = "break-word";
        tdContent.textContent = review.text || "";
        tr.appendChild(tdContent);

        // Date
        const tdDate = document.createElement("td");
        tdDate.style.fontSize = "11px";
        tdDate.style.color = "var(--text-muted)";
        tdDate.textContent = review.timestamp ? new Date(review.timestamp).toLocaleDateString() : "";
        tr.appendChild(tdDate);

        // Actions (e.g. Edit / Delete review)
        const tdActions = document.createElement("td");
        tdActions.style.whiteSpace = "nowrap";

        const editBtn = document.createElement("button");
        editBtn.textContent = "EDIT";
        editBtn.className = "status-badge pending";
        editBtn.style.cssText = "background: rgba(255, 159, 10, 0.15); color: #ff9f0a; border: 1px solid rgba(255, 159, 10, 0.25); cursor: pointer; padding: 4px 8px; margin-right: 6px;";
        editBtn.onclick = () => window.openEditReviewModal(review.id);
        tdActions.appendChild(editBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "DELETE";
        deleteBtn.className = "status-badge error";
        deleteBtn.style.cssText = "background: rgba(255, 59, 48, 0.15); color: var(--danger); border: 1px solid rgba(255, 59, 48, 0.25); cursor: pointer; padding: 4px 8px;";
        deleteBtn.onclick = async () => {
          if (confirm("Are you sure you want to delete this review from the database? (This will trigger background sync to Git automatically)")) {
            try {
              await window.dbDeleteDoc(window.dbDoc(window.db, "reviews", review.id));
              alert("Review deleted successfully.");
              window.loadAdminReviews();
            } catch (err) {
              console.error("Failed to delete review:", err);
              alert("Delete failed: " + err.message);
            }
          }
        };
        tdActions.appendChild(deleteBtn);
        tr.appendChild(tdActions);

        tableBody.appendChild(tr);
      });

    } catch (err) {
      console.error("Failed to load admin reviews:", err);
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 30px;">Error: ${err.message}</td></tr>`;
      if (statusEl) statusEl.textContent = "Load failed";
    }
  };

  // ==========================================
  // EDIT REVIEW MODAL
  // ==========================================
  window.openEditReviewModal = function(reviewId) {
    const review = (window.adminReviews || adminReviews).find(r => r.id === reviewId);
    if (!review) return;

    if (document.getElementById("editReviewId")) document.getElementById("editReviewId").value = reviewId;
    if (document.getElementById("editReviewProduct")) document.getElementById("editReviewProduct").value = review.productId || "";
    if (document.getElementById("editReviewAuthor")) document.getElementById("editReviewAuthor").value = review.name || "";
    if (document.getElementById("editReviewRating")) document.getElementById("editReviewRating").value = review.rating || 5;
    
    let dateVal = "";
    if (review.timestamp) {
      try {
        const d = new Date(review.timestamp);
        const offset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
        dateVal = localISOTime;
      } catch (e) {
        console.warn("Invalid date format for review", review.timestamp);
      }
    }
    if (document.getElementById("editReviewDate")) document.getElementById("editReviewDate").value = dateVal;
    if (document.getElementById("editReviewContent")) document.getElementById("editReviewContent").value = review.text || "";

    const modal = document.getElementById("editReviewModal");
    if (modal) modal.classList.add("active");
  };

  window.closeEditReviewModal = function() {
    const modal = document.getElementById("editReviewModal");
    if (modal) modal.classList.remove("active");
  };

  window.handleSaveReviewEdit = async function(e) {
    if (e) e.preventDefault();
    
    const reviewId = document.getElementById("editReviewId") ? document.getElementById("editReviewId").value : "";
    const name = document.getElementById("editReviewAuthor") ? document.getElementById("editReviewAuthor").value.trim() : "";
    const rating = document.getElementById("editReviewRating") ? Number(document.getElementById("editReviewRating").value) : 5;
    const dateStr = document.getElementById("editReviewDate") ? document.getElementById("editReviewDate").value : "";
    const text = document.getElementById("editReviewContent") ? document.getElementById("editReviewContent").value.trim() : "";

    if (!reviewId || !name || !text || isNaN(rating)) return;

    const submitBtn = e && e.target ? e.target.querySelector('button[type="submit"]') : document.querySelector('#editReviewModal button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "SAVING...";
    }

    try {
      if (!window.db || !window.dbDoc || !window.dbUpdateDoc) {
        throw new Error("Firestore SDK not loaded.");
      }

      const timestamp = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

      const reviewDocRef = window.dbDoc(window.db, "reviews", reviewId);
      await window.dbUpdateDoc(reviewDocRef, {
        name: name,
        rating: rating,
        timestamp: timestamp,
        text: text
      });

      alert("Review updated successfully!");
      window.closeEditReviewModal();
      window.loadAdminReviews();
    } catch (err) {
      console.error("Error updating review:", err);
      alert("Failed to update review: " + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Save Review";
      }
    }
  };

  // ==========================================
  // SYNC REVIEWS TO GITHUB
  // ==========================================
  window.syncReviewsToGit = async function() {
    const currentReviews = window.adminReviews || adminReviews;
    if (currentReviews.length === 0) {
      alert("No reviews to sync. Please refresh from database first.");
      return;
    }

    const syncBtn = document.getElementById("syncReviewsBtn");
    const originalText = syncBtn ? syncBtn.innerHTML : "";
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = "SYNCING TO GIT...";
    }

    try {
      if (!window.syncToGithubCallable) {
        throw new Error("GitHub sync function not initialized.");
      }

      // Clean reviews list to save to json (only keep necessary fields)
      const cleanedReviews = currentReviews.map(r => ({
        productId: r.productId,
        name: r.name,
        text: r.text,
        rating: Number(r.rating),
        timestamp: r.timestamp
      }));

      const response = await window.syncToGithubCallable({
        action: "syncReviews",
        payload: cleanedReviews
      });

      if (response.data && response.data.success) {
        alert("Success! Reviews synchronized to GitHub.");
      } else {
        throw new Error(response.data ? response.data.message : "Sync failed");
      }
    } catch (err) {
      console.error("Failed to sync reviews to GitHub:", err);
      alert("Error syncing reviews to Git: " + (err.message || err));
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalText;
      }
    }
  };

})();
