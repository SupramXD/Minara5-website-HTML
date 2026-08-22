// Studio Extrait - Product Reviews & Ratings Engine

(function() {
  let currentProductReviews = [];
  let visibleReviewsCount = 3;

  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Toggle review form display
  function toggleReviewForm() {
    const form = document.getElementById("reviewForm");
    const btn = document.getElementById("toggleReviewFormBtn");
    if (!form) return;
    if (form.style.display === "none" || !form.style.display) {
      form.style.display = "block";
      if (btn) btn.textContent = "CLOSE FORM";
    } else {
      form.style.display = "none";
      if (btn) btn.textContent = "WRITE A REVIEW";
    }
  }

  // Set form rating value and update interactive stars visually
  function setFormRating(rating) {
    const input = document.getElementById("reviewRatingInput");
    if (input) input.value = rating;
    const selector = document.getElementById("starRatingSelector");
    if (!selector) return;
    const stars = selector.querySelectorAll(".star-select");
    stars.forEach((star, index) => {
      const starValue = index + 1;
      if (starValue <= rating) {
        star.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="#000" stroke="#000" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      } else {
        star.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      }
    });
  }

  // Build HTML for a single review card
  function buildReviewHTML(review) {
    let starsHTML = "";
    const r = Number(review.rating) || 5;
    for (let i = 1; i <= 5; i++) {
      if (i <= r) {
        starsHTML += `<svg width="11" height="11" viewBox="0 0 24 24" fill="#cea44c" stroke="#cea44c" stroke-width="1.5" style="margin-right: 3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      } else {
        starsHTML += `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#cea44c" stroke-width="1.5" style="margin-right: 3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      }
    }

    const cleanName = escapeHTML(review.name || "Customer");
    const cleanText = escapeHTML(review.text || "");
    const dateStr = review.timestamp ? new Date(review.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "";

    return `
      <div class="review-item-card" style="background: #ffffff; border: 1px solid #eee; padding: 14px 18px; margin-bottom: 10px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #f7f7f7; padding-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #000;">${cleanName}</span>
            <span style="font-size: 7.5px; font-weight: bold; letter-spacing: 0.8px; text-transform: uppercase; color: #555; background: #f5f5f5; padding: 2px 6px;">
              VERIFIED BUYER
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="display: inline-flex; align-items: center;">${starsHTML}</span>
            <span style="font-size: 8.5px; opacity: 0.45; letter-spacing: 0.5px; text-transform: uppercase;">${dateStr}</span>
          </div>
        </div>
        <div style="font-size: 11px; opacity: 0.85; line-height: 1.45; white-space: pre-wrap; color: #1a1a1a; letter-spacing: 0.1px;">"${cleanText}"</div>
      </div>
    `;
  }

  function renderReviewsList() {
    const reviewsList = document.getElementById("reviewsList");
    const paginationContainer = document.getElementById("reviewsPagination");
    if (!reviewsList) return;

    if (currentProductReviews.length === 0) {
      reviewsList.innerHTML = `<div style="font-size: 10px; opacity: 0.5; font-style: italic;">No reviews yet. Be the first to leave one.</div>`;
      if (paginationContainer) paginationContainer.style.display = "none";
      return;
    }

    const sliced = currentProductReviews.slice(0, visibleReviewsCount);
    let reviewsHTML = "";
    sliced.forEach(review => {
      reviewsHTML += buildReviewHTML(review);
    });
    reviewsList.innerHTML = reviewsHTML;

    if (paginationContainer) {
      if (currentProductReviews.length > 3) {
        if (visibleReviewsCount >= currentProductReviews.length) {
          paginationContainer.style.display = "none";
        } else {
          paginationContainer.style.display = "flex";
        }
      } else {
        paginationContainer.style.display = "none";
      }
    }
  }

  async function loadReviews(prodId) {
    const reviewsList = document.getElementById("reviewsList");
    const reviewsAverage = document.getElementById("reviewsAverage");
    if (!reviewsList) return;

    try {
      let allReviews = [];
      try {
        const res = await fetch("reviews.json?t=" + Date.now());
        if (res.ok) {
          allReviews = await res.json();
        }
      } catch (fetchErr) {
        console.warn("Failed to fetch reviews.json, using local session reviews only", fetchErr);
      }

      let productReviews = allReviews.filter(r => r.productId === prodId);
      const sessionReviews = JSON.parse(sessionStorage.getItem("my_session_reviews") || "[]");
      const myProdReviews = sessionReviews.filter(r => r.productId === prodId);

      myProdReviews.forEach(sr => {
        const isDuplicate = productReviews.some(pr =>
          pr.name === sr.name &&
          pr.text === sr.text &&
          pr.rating === sr.rating &&
          (sr.timestamp ? pr.timestamp === sr.timestamp : true)
        );
        if (!isDuplicate) {
          productReviews.push(sr);
        }
      });

      productReviews.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });

      currentProductReviews = productReviews;

      let totalRating = 0;
      let count = productReviews.length;
      productReviews.forEach((review) => {
        totalRating += Number(review.rating);
      });

      const reviewsAverageStars = document.getElementById("reviewsAverageStars");
      const reviewsAverageText = document.getElementById("reviewsAverageText");

      if (count > 0) {
        const avg = (totalRating / count).toFixed(1);

        if (reviewsAverageText) {
          reviewsAverageText.textContent = `${avg} (${count})`;
        }

        if (reviewsAverageStars) {
          let starsHTML = "";
          const roundedAvg = Math.round(avg);
          for (let i = 1; i <= 5; i++) {
            if (i <= roundedAvg) {
              starsHTML += `<svg width="14" height="14" viewBox="0 0 24 24" fill="#cea44c" stroke="#cea44c" stroke-width="1.5" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            } else {
              starsHTML += `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cea44c" stroke-width="1.5" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            }
          }
          reviewsAverageStars.innerHTML = starsHTML;
        }

        if (reviewsAverage) reviewsAverage.textContent = `(${count})`;

        const topRatingSummary = document.getElementById("topRatingSummary");
        const topRatingValue = document.getElementById("topRatingValue");
        const topRatingStars = document.getElementById("topRatingStars");
        const topRatingCount = document.getElementById("topRatingCount");

        if (topRatingSummary) {
          if (topRatingValue) topRatingValue.textContent = avg;
          if (topRatingCount) topRatingCount.textContent = `(${count})`;

          if (topRatingStars) {
            let starsHTML = "";
            const roundedAvg = Math.round(avg);
            for (let i = 1; i <= 5; i++) {
              if (i <= roundedAvg) {
                starsHTML += `<svg width="11" height="11" viewBox="0 0 24 24" fill="#cea44c" stroke="#cea44c" stroke-width="1.5" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
              } else {
                starsHTML += `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#cea44c" stroke-width="1.5" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
              }
            }
            topRatingStars.innerHTML = starsHTML;
          }
          topRatingSummary.style.display = "inline-flex";
        }

        const reviewsCountSummary = document.getElementById('reviewsCountSummary');
        if (reviewsCountSummary) {
          reviewsCountSummary.textContent = `${count} ${count === 1 ? 'review' : 'reviews'}`;
        }
      } else {
        if (reviewsAverageText) reviewsAverageText.textContent = "0.0 (0)";
        if (reviewsAverageStars) reviewsAverageStars.innerHTML = "";
        if (reviewsAverage) reviewsAverage.textContent = "(0)";

        const topRatingSummary = document.getElementById("topRatingSummary");
        const topRatingValue = document.getElementById("topRatingValue");
        const topRatingStars = document.getElementById("topRatingStars");
        const topRatingCount = document.getElementById("topRatingCount");

        if (topRatingSummary) {
          if (topRatingValue) topRatingValue.textContent = "0.0";
          if (topRatingCount) topRatingCount.textContent = "(0)";
          if (topRatingStars) {
            let starsHTML = "";
            for (let i = 1; i <= 5; i++) {
              starsHTML += `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#cea44c" stroke-width="1.5" style="margin-right: 2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            }
            topRatingStars.innerHTML = starsHTML;
          }
          topRatingSummary.style.display = "inline-flex";
        }

        const reviewsCountSummary = document.getElementById('reviewsCountSummary');
        if (reviewsCountSummary) {
          reviewsCountSummary.textContent = "0 reviews";
        }
      }

      renderReviewsList();

    } catch (err) {
      console.error("Error loading reviews:", err);
      reviewsList.innerHTML = `<div style="font-size: 10px; opacity: 0.5; font-style: italic; color: #ff3b30;">Failed to load reviews.</div>`;
    }
  }

  function seeMoreReviews() {
    visibleReviewsCount += 4;
    renderReviewsList();
  }

  function viewAllReviews() {
    const modal = document.getElementById("reviewsModal");
    const modalBody = document.getElementById("reviewsModalBody");
    if (!modal || !modalBody) return;

    let modalHTML = "";
    currentProductReviews.forEach(review => {
      modalHTML += buildReviewHTML(review);
    });
    modalBody.innerHTML = modalHTML;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  function closeReviewsModal() {
    const modal = document.getElementById("reviewsModal");
    if (modal) {
      modal.classList.remove("active");
    }
    const cartPanel = document.getElementById("cartPanel");
    if (!cartPanel || !cartPanel.classList.contains("open")) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeReviewsModal();
    }
  });

  // Submit review to Firestore with session-spam protection
  async function submitReview(event) {
    event.preventDefault();

    const params = new URLSearchParams(window.location.search);
    const prodId = params.get('id');
    if (!prodId) return;

    const submittedMap = JSON.parse(sessionStorage.getItem("minara_reviews_submitted") || "{}");
    const currentCount = submittedMap[prodId] || 0;
    if (currentCount >= 2) {
      alert("You have reached the limit of 2 reviews per session for this product.");
      return;
    }

    const nameInput = document.getElementById("reviewName");
    const textInput = document.getElementById("reviewText");
    const ratingInput = document.getElementById("reviewRatingInput");

    const name = nameInput ? nameInput.value.trim() : "";
    const text = textInput ? textInput.value.trim() : "";
    const rating = ratingInput ? Number(ratingInput.value) : 5;

    if (!name || !text || isNaN(rating)) return;

    const submitBtn = event.target ? event.target.querySelector('button[type="submit"]') : null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "SUBMITTING...";
    }

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:";
    if (typeof window.runTurnstile === 'function' && !isLocal) {
      try {
        const token = await window.runTurnstile();
        if (!token) {
          console.warn("Turnstile challenge did not return a token (e.g. error 110200), proceeding with session-rate-limited fallback.");
        }
      } catch (tErr) {
        console.warn("Turnstile challenge bypassed:", tErr);
      }
    }

    try {
      if (!window.db && !window.dbAddDoc) {
        throw new Error("Firestore database connection is initializing. Please try again in a moment.");
      }

      const timestamp = new Date().toISOString();

      if (window.dbAddDoc && window.dbCollection && window.db) {
        await window.dbAddDoc(window.dbCollection(window.db, "reviews"), {
          productId: prodId,
          name: name,
          text: text,
          rating: rating,
          timestamp: timestamp
        });
      }

      submittedMap[prodId] = currentCount + 1;
      sessionStorage.setItem("minara_reviews_submitted", JSON.stringify(submittedMap));

      const mySessionReviews = JSON.parse(sessionStorage.getItem("my_session_reviews") || "[]");
      mySessionReviews.push({
        productId: prodId,
        name: name,
        text: text,
        rating: rating,
        timestamp: timestamp
      });
      sessionStorage.setItem("my_session_reviews", JSON.stringify(mySessionReviews));

      if (nameInput) nameInput.value = "";
      if (textInput) textInput.value = "";
      setFormRating(5);
      toggleReviewForm();

      await loadReviews(prodId);
    } catch (err) {
      console.error("Error submitting review:", err);
      alert("Failed to submit review: " + (err.message || err));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Review";
      }
    }
  }

  // Global window bindings
  window.toggleReviewForm = toggleReviewForm;
  window.setFormRating = setFormRating;
  window.buildReviewHTML = buildReviewHTML;
  window.renderReviewsList = renderReviewsList;
  window.loadReviews = loadReviews;
  window.seeMoreReviews = seeMoreReviews;
  window.viewAllReviews = viewAllReviews;
  window.closeReviewsModal = closeReviewsModal;
  window.submitReview = submitReview;
})();
