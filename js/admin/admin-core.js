// Studio Extrait - Admin Core Coordinator & Navigation Module

(function() {
  window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');
    
    const targetBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => {
      const onClickAttr = btn.getAttribute('onclick') || '';
      return onClickAttr.includes(tabId);
    });
    if (targetBtn) targetBtn.classList.add('active');

    // Safe dispatching to individual tab loaders if available
    if (tabId === 'orders-tab' && typeof window.loadAdminOrders === 'function') {
      window.loadAdminOrders();
    }
    if (tabId === 'catalog-tab' && typeof window.loadCatalog === 'function') {
      window.loadCatalog();
    }
    if (tabId === 'image-optimizer-tab' && typeof window.loadImageList === 'function') {
      window.loadImageList();
    }
    if (tabId === 'traffic-analytics-tab' && typeof window.loadTrafficAnalytics === 'function') {
      window.loadTrafficAnalytics();
    }
    if (tabId === 'sales-analytics-tab' && typeof window.loadSalesAnalytics === 'function') {
      window.loadSalesAnalytics();
    }
    if (tabId === 'funnel-analytics-tab' && typeof window.loadFunnelAnalytics === 'function') {
      window.loadFunnelAnalytics();
    }
    if (tabId === 'sessions-tab' && typeof window.loadAdminSessions === 'function') {
      window.loadAdminSessions();
    }
    if (tabId === 'reviews-tab' && typeof window.loadAdminReviews === 'function') {
      window.loadAdminReviews();
    }
    if (tabId === 'notifications-tab') {
      if (typeof window.fetchUnsupportedRequests === 'function') {
        window.fetchUnsupportedRequests();
      }
      if (typeof window.fetchStockNotifications === 'function') {
        window.fetchStockNotifications();
      }
    }
    if (tabId === 'hero-tab') {
      if (typeof window.loadHeroSettings === 'function') {
        window.loadHeroSettings();
      }
      if (typeof window.loadSecondHeroSettings === 'function') {
        window.loadSecondHeroSettings();
      }
    }
    if (tabId === 'features-tab' && typeof window.loadCustomTextSettings === 'function') {
      window.loadCustomTextSettings();
    }
    if (tabId === 'users-tab') {
      if (typeof window.fetchUsers === 'function') {
        window.fetchUsers();
      }
      if (typeof window.fetchSubscribers === 'function') {
        window.fetchSubscribers();
      }
    }
  };

  // Safe fallback logout if auth module is loading asynchronously
  window.logout = window.logout || function() {
    if (window.auth && typeof window.auth.signOut === 'function') {
      window.auth.signOut().then(() => {
        window.location.href = "index.html";
      }).catch(err => {
        console.error("Logout Error:", err);
        window.location.href = "index.html";
      });
    } else {
      window.location.href = "index.html";
    }
  };
})();
