// Studio Extrait - Admin Analytics & Visitor Intelligence Module
window.adminSessions = window.adminSessions || [];
var adminSessions = window.adminSessions;
window.chartInstances = window.chartInstances || {};
var chartInstances = window.chartInstances;
window.currentStatsPeriod = '7d';
var currentStatsPeriod = window.currentStatsPeriod;
window.currentStatsDataMode = 'optimised';
var currentStatsDataMode = window.currentStatsDataMode;
window.currentVisitorSubTab = 'unique';
var currentVisitorSubTab = window.currentVisitorSubTab;
window.selectedSessionOrIpId = null;
var selectedSessionOrIpId = window.selectedSessionOrIpId;
window.lastProcessedData = null;
var lastProcessedData = window.lastProcessedData;

// Helper: Formats full date and time (e.g. "18 Aug 2026 • 20:15:32")
function formatSessionDateTime(isoStr) {
  if (!isoStr) return "N/A";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "N/A";
  const datePart = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${datePart} • ${timePart}`;
}

// Helper: Relative time (e.g. "2m ago", "Online Now")
function formatRelativeTime(isoStr) {
  if (!isoStr) return "";
  const diffSec = Math.round((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diffSec < 45) return "Online Now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// Helper: Safely destroy and recreate Chart.js instances
    function createOrUpdateChart(canvasId, config) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
      }
      try {
        chartInstances[canvasId] = new Chart(ctx, config);
        return chartInstances[canvasId];
      } catch (err) {
        console.error("Chart creation error on " + canvasId, err);
        return null;
      }
    }

    // Helper: Filter records by time period
    function filterByPeriod(items, period, timestampField = 'createdAt') {
      if (!Array.isArray(items)) return [];
      if (period === 'all') return [...items];

      const now = Date.now();
      let cutoff = 0;
      if (period === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        cutoff = startOfDay.getTime();
      } else if (period === '7d') {
        cutoff = now - (7 * 24 * 60 * 60 * 1000);
      } else if (period === '30d') {
        cutoff = now - (30 * 24 * 60 * 60 * 1000);
      } else if (period === '90d') {
        cutoff = now - (90 * 24 * 60 * 60 * 1000);
      }

      return items.filter(item => {
        const rawDate = item[timestampField] || item.timestamp || item.lastActive;
        if (!rawDate) return false;
        const time = new Date(rawDate).getTime();
        return !isNaN(time) && time >= cutoff;
      });
    }

    // Mode Controller: Optimised vs Raw
    window.setStatsDataMode = function(mode) {
      currentStatsDataMode = mode;
      
      const optBtn = document.getElementById("modeBtn_optimised");
      const rawBtn = document.getElementById("modeBtn_raw");
      const badge = document.getElementById("activeModeBadge");
      const bannerText = document.getElementById("optimisationSummaryText");
      const bannerIcon = document.getElementById("bannerModeIcon");

      if (optBtn) optBtn.classList.toggle("active", mode === "optimised");
      if (rawBtn) rawBtn.classList.toggle("active", mode === "raw");

      if (mode === "optimised") {
        if (badge) {
          badge.textContent = "⚡ Clean Optimised";
          badge.style.color = "var(--accent)";
          badge.style.borderColor = "rgba(204, 255, 0, 0.3)";
          badge.style.background = "rgba(204, 255, 0, 0.15)";
        }
        if (bannerIcon) bannerIcon.textContent = "⚡";
        if (bannerText) {
          bannerText.innerHTML = `<strong style="color: #fff;">Optimised Mode Active:</strong> Bots/spiders purged, geoblocked hits excluded, and duplicate test sessions grouped into unique visitor journeys.`;
        }
      } else {
        if (badge) {
          badge.textContent = "🌐 Raw Unfiltered";
          badge.style.color = "#09A5DB";
          badge.style.borderColor = "rgba(9, 165, 219, 0.3)";
          badge.style.background = "rgba(9, 165, 219, 0.15)";
        }
        if (bannerIcon) bannerIcon.textContent = "🌐";
        if (bannerText) {
          bannerText.innerHTML = `<strong style="color: #fff;">Raw Mode Active:</strong> Showing all unedited Firestore records, repeat testing pings, crawlers, and geoblocked events.`;
        }
      }

      renderGeneralStatistics();
    };

    // Period Controller
    window.setStatsPeriod = function(period) {
      currentStatsPeriod = period;
      const group = document.getElementById("generalStatsPeriodFilters");
      if (group) {
        group.querySelectorAll(".period-btn").forEach(btn => {
          const onclickAttr = btn.getAttribute("onclick") || "";
          btn.classList.toggle("active", onclickAttr.includes(`'${period}'`));
        });
      }
      renderGeneralStatistics();
    };

    // Visitor Sub-tab Switcher
    window.switchVisitorSubTab = function(subTab) {
      currentVisitorSubTab = subTab;
      document.querySelectorAll(".visitor-subtab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.id === `visitorSubTab_${subTab}`);
      });

      const titleEl = document.getElementById("sessionListHeaderTitle");
      if (titleEl) {
        if (subTab === 'unique') titleEl.textContent = "Unique Visitors (Deduplicated)";
        else if (subTab === 'recurring') titleEl.textContent = "Recurring & Frequent Testing IPs";
        else titleEl.textContent = "All Raw Session Logs (Chronological)";
      }

      if (lastProcessedData) {
        renderCurrentVisitorSubTabList(lastProcessedData);
      }
    };

    /* SMART ANALYTICS PROCESSOR: DETECTS BOTS, GEOBLOCKS & RECURRING IPS */
    function processSessionsData(rawSessions, mode) {
      const botRegex = /bot|spider|crawl|slurp|lighthouse|headless|facebookexternalhit|bytespider|yandex|curl|wget|python|postman|insomnia|preview|archive\.org|petalbot|semrush|ahrefs|bingbot|googlebot/i;

      let botsPurged = 0;
      let geoblockedPurged = 0;
      let ghostsPurged = 0;

      const validSessions = [];

      rawSessions.forEach(s => {
        const ua = s.userAgent || "";
        const loc = s.location || "";
        const ip = s.ip || "";

        const isBot = botRegex.test(ua) || (ua.length < 15 && ua.toLowerCase().includes("bot"));
        const isGeoBlocked = loc.includes("Geo Blocked") || loc.includes("VPN") || loc.includes("Unknown") || ip === "Pending..." || ip.includes("VPN") || ip.includes("Protected") || !!s.isGeoBlocked || !!s.isVpn;
        
        const start = new Date(s.createdAt || s.lastActive).getTime();
        const end = new Date(s.lastActive || s.createdAt).getTime();
        const durationSec = Math.max(0, Math.round((end - start) / 1000));
        const pagesCount = (s.pages && Array.isArray(s.pages)) ? s.pages.length : 1;
        const clicksCount = (s.clicks && Array.isArray(s.clicks)) ? s.clicks.length : 0;
        const isGhost = durationSec < 2 && pagesCount <= 1 && clicksCount === 0 && (Number(s.maxScrollDepth) || 0) === 0;

        if (mode === "optimised") {
          if (isBot) {
            botsPurged++;
            return;
          }
          if (isGeoBlocked) {
            geoblockedPurged++;
            return;
          }
          if (isGhost) {
            ghostsPurged++;
            return;
          }
        }

        validSessions.push({ ...s, isBot, isGeoBlocked, isGhost });
      });

      // Group & Deduplicate by IP / Session Identity
      const ipGroups = {};
      validSessions.forEach(s => {
        const key = s.ip && s.ip !== "Unknown IP" ? s.ip : (s.sessionId || s.id);
        if (!ipGroups[key]) {
          ipGroups[key] = {
            ipKey: key,
            ip: s.ip || key,
            location: s.location || "Unknown Location",
            device: s.device || "Desktop",
            userAgent: s.userAgent || "Unknown",
            firstSeen: s.createdAt || s.lastActive,
            lastActive: s.lastActive || s.createdAt,
            maxScrollDepth: Number(s.maxScrollDepth) || 0,
            allPages: [],
            allClicks: [],
            sessions: []
          };
        }

        const group = ipGroups[key];
        group.sessions.push(s);

        if (new Date(s.createdAt) < new Date(group.firstSeen)) group.firstSeen = s.createdAt;
        if (new Date(s.lastActive) > new Date(group.lastActive)) {
          group.lastActive = s.lastActive;
          group.location = s.location || group.location;
          group.device = s.device || group.device;
        }

        if ((Number(s.maxScrollDepth) || 0) > group.maxScrollDepth) {
          group.maxScrollDepth = Number(s.maxScrollDepth) || 0;
        }

        if (s.pages && Array.isArray(s.pages)) {
          s.pages.forEach(p => {
            if (!group.allPages.some(existing => existing.page === p.page && existing.timestamp === p.timestamp)) {
              group.allPages.push(p);
            }
          });
        }
        if (s.clicks && Array.isArray(s.clicks)) {
          s.clicks.forEach(c => group.allClicks.push(c));
        }
      });

      // Prepare distinct list arrays
      const uniqueVisitorsList = Object.values(ipGroups);
      uniqueVisitorsList.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));

      const recurringIpsList = uniqueVisitorsList.filter(g => g.sessions.length > 1);
      recurringIpsList.sort((a, b) => b.sessions.length - a.sessions.length);

      const duplicatesMerged = validSessions.length - uniqueVisitorsList.length;

      return {
        rawSessions: validSessions,
        uniqueVisitorsList: uniqueVisitorsList,
        recurringIpsList: recurringIpsList,
        telemetry: {
          botsPurged,
          geoblockedPurged,
          ghostsPurged,
          duplicatesMerged
        }
      };
    }

    window.loadAdminSessions = async function(forceRefresh = false) {
      const listContainer = document.getElementById("sessionListContainer");
      const statsEl = document.getElementById("sessionsStats");
      if (listContainer && adminSessions.length === 0) {
        listContainer.innerHTML = `<p style="opacity: 0.5; font-size: 12px; padding: 20px;">Fetching live sessions from Firestore...</p>`;
      }
      if (statsEl) statsEl.textContent = "Loading...";

      try {
        if (!window.db) throw new Error("Firestore DB not initialized");
        
        // Fetch sessions
        if (forceRefresh || adminSessions.length === 0) {
          const querySnapshot = await window.dbGetDocs(window.dbCollection(window.db, "sessions"));
          adminSessions = [];
          querySnapshot.forEach(docSnap => {
            adminSessions.push({ id: docSnap.id, ...docSnap.data() });
          });
          adminSessions.sort((a, b) => new Date(b.lastActive || 0) - new Date(a.lastActive || 0));
        }

        // Fetch orders if not loaded
        if (adminOrders.length === 0) {
          try {
            const ordersSnap = await window.dbGetDocs(window.dbCollection(window.db, "orders"));
            adminOrders = [];
            ordersSnap.forEach(docSnap => {
              adminOrders.push({ id: docSnap.id, ...docSnap.data() });
            });
            adminOrders.sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0));
          } catch (e) {}
        }

        renderGeneralStatistics();
      } catch (err) {
        console.error("Failed to load statistics/sessions:", err);
        if (listContainer) listContainer.innerHTML = `<p style="color: var(--danger); font-size: 12px; padding: 20px;">Failed to load sessions: ${err.message}</p>`;
      }
    };

    function renderGeneralStatistics() {
      const filteredRawSessions = filterByPeriod(adminSessions, currentStatsPeriod, 'createdAt');
      const filteredOrders = filterByPeriod(adminOrders, currentStatsPeriod, 'createdAt');

      // Process sessions based on current data mode (optimised vs raw)
      const processed = processSessionsData(filteredRawSessions, currentStatsDataMode);
      lastProcessedData = processed;

      // Update Telemetry Badges in Header Banner
      const bBots = document.getElementById("telemetryBotsBadge");
      const bGeo = document.getElementById("telemetryGeoBadge");
      const bDupes = document.getElementById("telemetryDupesBadge");

      if (bBots) bBots.textContent = `${processed.telemetry.botsPurged} Bots Purged`;
      if (bGeo) bGeo.textContent = `${processed.telemetry.geoblockedPurged} Geoblocked Filtered`;
      if (bDupes) bDupes.textContent = `${processed.telemetry.duplicatesMerged} Repeat Sessions Merged`;

      // Update Sub-tab Counter Badges
      const badgeUnique = document.getElementById("uniqueVisitorsBadge");
      const badgeRecur = document.getElementById("recurringIpsBadge");
      const badgeRaw = document.getElementById("allRawBadge");

      if (badgeUnique) badgeUnique.textContent = processed.uniqueVisitorsList.length;
      if (badgeRecur) badgeRecur.textContent = processed.recurringIpsList.length;
      if (badgeRaw) badgeRaw.textContent = processed.rawSessions.length;

      // 1. Calculate Traffic & Behavior KPIs
      // In Optimised mode, visits count represents unique visitor reach. In Raw mode, it represents total raw hits.
      const statsSessionsForCharts = currentStatsDataMode === 'optimised' 
        ? processed.uniqueVisitorsList.map(u => ({ ...u, pages: u.allPages, clicks: u.allClicks }))
        : processed.rawSessions;

      const totalVisits = currentStatsDataMode === 'optimised' ? processed.uniqueVisitorsList.length : processed.rawSessions.length;
      const uniqueIps = processed.uniqueVisitorsList.length;
      
      // Calculate Dwell Time & Scroll Depth strictly across genuine unique visitors
      // Caps single session duration at 900s (15m) to prevent background open tabs from inflating numbers
      let validDwellCount = 0;
      let totalDurationSec = 0;
      let totalScroll = 0;
      let bounceCount = 0;

      if (currentStatsDataMode === 'optimised') {
        processed.uniqueVisitorsList.forEach(u => {
          // If this IP has abnormal recurring hits (>15 sessions), it is an internal/admin device; exclude it from visitor dwell averages
          if (u.sessions && u.sessions.length > 15) return;

          let visitorDwellSec = 0;
          if (u.sessions && u.sessions.length > 0) {
            u.sessions.forEach(s => {
              const start = new Date(s.createdAt || s.lastActive).getTime();
              const end = new Date(s.lastActive || s.createdAt).getTime();
              const rawDiff = Math.max(0, Math.round((end - start) / 1000));
              const sessionSec = Math.min(900, rawDiff); // Cap at 15m per active session
              visitorDwellSec += sessionSec;
            });
          } else {
            const start = new Date(u.firstSeen || u.lastActive).getTime();
            const end = new Date(u.lastActive || u.firstSeen).getTime();
            const rawDiff = Math.max(0, Math.round((end - start) / 1000));
            visitorDwellSec = Math.min(900, rawDiff);
          }

          // Individual visitor active dwell capped at 1200s (20 mins)
          const cappedDuration = Math.min(1200, visitorDwellSec);
          totalDurationSec += cappedDuration;
          totalScroll += Number(u.maxScrollDepth) || 0;
          validDwellCount++;

          const pagesCount = u.allPages?.length || 1;
          if (pagesCount <= 1 && cappedDuration < 10 && (Number(u.maxScrollDepth) || 0) < 15) {
            bounceCount++;
          }
        });
      } else {
        processed.rawSessions.forEach(s => {
          const start = new Date(s.createdAt || s.lastActive).getTime();
          const end = new Date(s.lastActive || s.createdAt).getTime();
          const diffSec = Math.max(0, Math.min(1200, Math.round((end - start) / 1000)));
          totalDurationSec += diffSec;
          totalScroll += Number(s.maxScrollDepth) || 0;
          validDwellCount++;

          const pagesCount = (s.pages && Array.isArray(s.pages)) ? s.pages.length : 1;
          if (pagesCount <= 1 && diffSec < 10) {
            bounceCount++;
          }
        });
      }

      const avgDuration = validDwellCount > 0 ? Math.round(totalDurationSec / validDwellCount) : 0;
      const avgDurationStr = avgDuration >= 60 ? `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s` : `${avgDuration}s`;
      const avgScroll = validDwellCount > 0 ? Math.round(totalScroll / validDwellCount) : 0;
      const bounceRate = validDwellCount > 0 ? Math.round((bounceCount / validDwellCount) * 100) : 0;

      // 2. Calculate Orders & Revenue KPIs
      const paidOrders = filteredOrders.filter(o => o.paid || o.status === "paid" || o.status === "Shipped" || o.status === "Delivered");
      const grossRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const aov = paidOrders.length > 0 ? Math.round(grossRevenue / paidOrders.length) : 0;
      const conversionRate = uniqueIps > 0 ? ((paidOrders.length / uniqueIps) * 100).toFixed(1) : '0.0';

      // 3. Update KPI DOM Elements
      const elVisits = document.getElementById("kpiTotalVisits");
      if (elVisits) elVisits.textContent = totalVisits.toLocaleString();
      const elVisitsSub = document.getElementById("kpiVisitsSub");
      if (elVisitsSub) elVisitsSub.textContent = currentStatsDataMode === 'optimised' ? 'Unique Customer Journeys' : 'Total Raw Hits';

      const elUnique = document.getElementById("kpiUniqueVisitors");
      if (elUnique) elUnique.textContent = uniqueIps.toLocaleString();
      const elGross = document.getElementById("kpiGrossRevenue");
      if (elGross) elGross.textContent = `R${formatRetailPrice(grossRevenue)}`;
      const elPaidSub = document.getElementById("kpiPaidOrdersSub");
      if (elPaidSub) elPaidSub.textContent = `${paidOrders.length} Paid Orders`;
      const elAov = document.getElementById("kpiAvgOrderValue");
      if (elAov) elAov.textContent = `R${formatRetailPrice(aov)}`;
      const elDuration = document.getElementById("kpiAvgDuration");
      if (elDuration) elDuration.textContent = avgDurationStr;
      const elScrollSub = document.getElementById("kpiScrollSub");
      if (elScrollSub) elScrollSub.textContent = `${avgScroll}% Avg Scroll Depth`;
      const elConv = document.getElementById("kpiConversionRate");
      if (elConv) elConv.textContent = `${conversionRate}%`;
      const elBounceSub = document.getElementById("kpiBounceSub");
      if (elBounceSub) elBounceSub.textContent = `${bounceRate}% Bounce Rate • Click to inspect drop-off`;

      const statsCounterEl = document.getElementById("sessionsStats");
      if (statsCounterEl) statsCounterEl.textContent = `${processed.uniqueVisitorsList.length} Unique • ${processed.rawSessions.length} Total Logs`;

      const badgeEl = document.getElementById("trafficTrendBadge");
      if (badgeEl) {
        const labelMap = { today: 'Hourly (24h)', '7d': 'Last 7 Days', '30d': 'Last 30 Days', '90d': 'Last 90 Days', all: 'All Time' };
        badgeEl.textContent = `${labelMap[currentStatsPeriod] || 'Daily Visits'} (${currentStatsDataMode.toUpperCase()})`;
      }

      // 4. Render All Visual Charts with Cleaned/Selected Dataset
      renderTrafficTrendChart(statsSessionsForCharts, currentStatsPeriod);
      renderSalesRevenueTimelineChart(filteredOrders, currentStatsPeriod);
      renderDevicePieChart(statsSessionsForCharts);
      renderReferrerBarChart(statsSessionsForCharts);
      renderGeoBarChart(statsSessionsForCharts);
      renderTopPagesChart(statsSessionsForCharts);
      renderOrderStatusChart(filteredOrders);
      renderTopProductsChart(paidOrders);
      renderFunnelChart(statsSessionsForCharts, paidOrders);
      renderCtaClicksChart(statsSessionsForCharts);

      // 5. Render Selected Visitor Sub-tab
      renderCurrentVisitorSubTabList(processed);
    }

    // CONVERSION & FUNNEL INTELLIGENCE MODAL CONTROLLER
    window.openConversionDeepDiveModal = function() {
      const modal = document.getElementById("conversionDeepDiveModal");
      const body = document.getElementById("conversionModalBody");
      const badge = document.getElementById("modalConvOverallBadge");
      if (!modal || !body) return;

      const filteredRawSessions = filterByPeriod(adminSessions, currentStatsPeriod, 'createdAt');
      const filteredOrders = filterByPeriod(adminOrders, currentStatsPeriod, 'createdAt');
      const processed = lastProcessedData || processSessionsData(filteredRawSessions, currentStatsDataMode);
      
      const uniqueVisitors = processed.uniqueVisitorsList.length;
      const paidOrders = filteredOrders.filter(o => o.paid || o.status === "paid" || o.status === "Shipped" || o.status === "Delivered");
      const paidCount = paidOrders.length;
      const overallConv = uniqueVisitors > 0 ? ((paidCount / uniqueVisitors) * 100).toFixed(1) : '0.0';

      if (badge) badge.textContent = `${overallConv}% CONVERSION RATE`;

      // Calculate 5 Stage Funnel Metrics
      // 1. Landing (All Unique Visitors)
      const stage1_Landing = Math.max(uniqueVisitors, paidCount);
      
      // 2. Explored Catalog / Perfumes
      let stage2_Explored = 0;
      let stage3_Cart = 0;
      let stage4_Checkout = 0;

      processed.uniqueVisitorsList.forEach(u => {
        const pages = u.allPages || [];
        const clicks = u.allClicks || [];
        
        const exploredCatalog = pages.some(p => p.page && (p.page.includes("catalog") || p.page.includes("product") || p.page.includes("perfume") || p.page.includes("shop"))) || (Number(u.maxScrollDepth) || 0) > 25;
        if (exploredCatalog) stage2_Explored++;

        const addedCart = clicks.some(c => c.text && (c.text.toLowerCase().includes("cart") || c.text.toLowerCase().includes("bag") || c.text.toLowerCase().includes("order") || c.text.toLowerCase().includes("buy") || c.text.toLowerCase().includes("gift"))) || pages.some(p => p.page && p.page.includes("cart"));
        if (addedCart) stage3_Cart++;

        const reachedCheckout = clicks.some(c => c.text && (c.text.toLowerCase().includes("checkout") || c.text.toLowerCase().includes("pay") || c.text.toLowerCase().includes("dispatch"))) || pages.some(p => p.page && p.page.includes("checkout"));
        if (reachedCheckout) stage4_Checkout++;
      });

      // Ensure logical progressive hierarchy
      stage2_Explored = Math.max(stage2_Explored, stage3_Cart, paidCount);
      stage3_Cart = Math.max(stage3_Cart, stage4_Checkout, paidCount);
      stage4_Checkout = Math.max(stage4_Checkout, paidCount);

      // Drop-off Calculations
      const drop1_Bounce = Math.max(0, stage1_Landing - stage2_Explored);
      const drop1_Rate = stage1_Landing > 0 ? ((drop1_Bounce / stage1_Landing) * 100).toFixed(1) : '0.0';

      const drop2_Catalog = Math.max(0, stage2_Explored - stage3_Cart);
      const drop2_Rate = stage2_Explored > 0 ? ((drop2_Catalog / stage2_Explored) * 100).toFixed(1) : '0.0';

      const drop3_CartAbandon = Math.max(0, stage3_Cart - stage4_Checkout);
      const drop3_Rate = stage3_Cart > 0 ? ((drop3_CartAbandon / stage3_Cart) * 100).toFixed(1) : '0.0';

      const drop4_CheckoutAbandon = Math.max(0, stage4_Checkout - paidCount);
      const drop4_Rate = stage4_Checkout > 0 ? ((drop4_CheckoutAbandon / stage4_Checkout) * 100).toFixed(1) : '0.0';

      // Device Breakdown
      let mobileVisitors = 0, desktopVisitors = 0;
      processed.uniqueVisitorsList.forEach(u => {
        if ((u.device || '').toLowerCase().includes("mobile") || (u.userAgent || '').toLowerCase().includes("mobi")) {
          mobileVisitors++;
        } else {
          desktopVisitors++;
        }
      });
      const mobilePaid = paidOrders.filter(o => (o.device || '').toLowerCase().includes("mobile")).length;
      const desktopPaid = paidCount - mobilePaid;
      const mobileConv = mobileVisitors > 0 ? ((mobilePaid / mobileVisitors) * 100).toFixed(1) : '0.0';
      const desktopConv = desktopVisitors > 0 ? ((desktopPaid / desktopVisitors) * 100).toFixed(1) : '0.0';

      body.innerHTML = `
        <!-- Top Metrics Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 24px;">
          <div class="order-meta-box" style="padding: 12px 14px;">
            <div class="order-meta-box-content">
              <span class="order-meta-box-label">Unique Traffic</span>
              <span class="order-meta-box-val" style="font-size: 16px;">${stage1_Landing} Visitors</span>
            </div>
          </div>

          <div class="order-meta-box" style="padding: 12px 14px;">
            <div class="order-meta-box-content">
              <span class="order-meta-box-label">Cart Add Rate</span>
              <span class="order-meta-box-val" style="font-size: 16px; color: #38bdf8;">${stage1_Landing > 0 ? ((stage3_Cart / stage1_Landing) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>

          <div class="order-meta-box" style="padding: 12px 14px;">
            <div class="order-meta-box-content">
              <span class="order-meta-box-label">Cart to Paid Rate</span>
              <span class="order-meta-box-val" style="font-size: 16px; color: #34d399;">${stage3_Cart > 0 ? ((paidCount / stage3_Cart) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>

          <div class="order-meta-box" style="padding: 12px 14px;">
            <div class="order-meta-box-content">
              <span class="order-meta-box-label">Completed Orders</span>
              <span class="order-meta-box-val" style="font-size: 16px; color: var(--accent);">${paidCount} Orders</span>
            </div>
          </div>
        </div>

        <!-- 5-Stage Visual Retention & Drop-Off Funnel -->
        <div style="margin-bottom: 25px;">
          <h4 class="order-section-title" style="margin-bottom: 12px;">5-Stage Funnel Retention & Drop-Off Breakdown</h4>

          <!-- Step 1 -->
          <div class="funnel-pipeline-step">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                <span style="font-weight: 800; font-size: 12px; color: #ffffff;">1. Landing & Discovery</span>
                <span style="font-size: 11px; color: rgba(255,255,255,0.5); margin-left: 8px;">Initial pageview & hero load</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-family: monospace; font-weight: 800; font-size: 13px; color: #ffffff;">${stage1_Landing} Visitors (100%)</span>
              </div>
            </div>
            <div class="funnel-bar-track">
              <div class="funnel-bar-fill" style="width: 100%;"></div>
            </div>
            ${drop1_Bounce > 0 ? `
              <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
                <span class="funnel-dropoff-tag">🔻 ${drop1_Bounce} Bounced before exploring (${drop1_Rate}%)</span>
              </div>
            ` : ''}
          </div>

          <!-- Step 2 -->
          <div class="funnel-pipeline-step">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                <span style="font-weight: 800; font-size: 12px; color: #ffffff;">2. Fragrance Exploration</span>
                <span style="font-size: 11px; color: rgba(255,255,255,0.5); margin-left: 8px;">Browsed bottle descriptions & notes</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-family: monospace; font-weight: 800; font-size: 13px; color: #ffffff;">${stage2_Explored} (${stage1_Landing > 0 ? ((stage2_Explored/stage1_Landing)*100).toFixed(0) : 0}%)</span>
              </div>
            </div>
            <div class="funnel-bar-track">
              <div class="funnel-bar-fill" style="width: ${stage1_Landing > 0 ? (stage2_Explored/stage1_Landing)*100 : 0}%;"></div>
            </div>
            ${drop2_Catalog > 0 ? `
              <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
                <span class="funnel-dropoff-tag">🔻 ${drop2_Catalog} Explored but didn't add to cart (${drop2_Rate}%)</span>
              </div>
            ` : ''}
          </div>

          <!-- Step 3 -->
          <div class="funnel-pipeline-step">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                <span style="font-weight: 800; font-size: 12px; color: #ffffff;">3. Added to Cart / Bag</span>
                <span style="font-size: 11px; color: rgba(255,255,255,0.5); margin-left: 8px;">Configured bottle & added to bag</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-family: monospace; font-weight: 800; font-size: 13px; color: #ffffff;">${stage3_Cart} (${stage1_Landing > 0 ? ((stage3_Cart/stage1_Landing)*100).toFixed(0) : 0}%)</span>
              </div>
            </div>
            <div class="funnel-bar-track">
              <div class="funnel-bar-fill" style="width: ${stage1_Landing > 0 ? (stage3_Cart/stage1_Landing)*100 : 0}%;"></div>
            </div>
            ${drop3_CartAbandon > 0 ? `
              <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
                <span class="funnel-dropoff-tag">🔻 ${drop3_CartAbandon} Cart Abandonments (${drop3_Rate}%)</span>
              </div>
            ` : ''}
          </div>

          <!-- Step 4 -->
          <div class="funnel-pipeline-step">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                <span style="font-weight: 800; font-size: 12px; color: #ffffff;">4. Initiated Checkout</span>
                <span style="font-size: 11px; color: rgba(255,255,255,0.5); margin-left: 8px;">Entered delivery info & payment step</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-family: monospace; font-weight: 800; font-size: 13px; color: #ffffff;">${stage4_Checkout} (${stage1_Landing > 0 ? ((stage4_Checkout/stage1_Landing)*100).toFixed(0) : 0}%)</span>
              </div>
            </div>
            <div class="funnel-bar-track">
              <div class="funnel-bar-fill" style="width: ${stage1_Landing > 0 ? (stage4_Checkout/stage1_Landing)*100 : 0}%;"></div>
            </div>
            ${drop4_CheckoutAbandon > 0 ? `
              <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
                <span class="funnel-dropoff-tag">🔻 ${drop4_CheckoutAbandon} Abandoned at payment gate (${drop4_Rate}%)</span>
              </div>
            ` : ''}
          </div>

          <!-- Step 5 -->
          <div class="funnel-pipeline-step" style="border-color: rgba(52, 211, 153, 0.3); background: rgba(16, 185, 129, 0.04);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                <span style="font-weight: 800; font-size: 12.5px; color: #34d399;">5. Completed Orders (Paid)</span>
                <span style="font-size: 11px; color: rgba(255,255,255,0.6); margin-left: 8px;">Confirmed checkout & paid in full</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-family: monospace; font-weight: 900; font-size: 14px; color: #34d399;">${paidCount} Orders (${overallConv}%)</span>
              </div>
            </div>
            <div class="funnel-bar-track">
              <div class="funnel-bar-fill" style="width: ${stage1_Landing > 0 ? Math.max(4, (paidCount/stage1_Landing)*100) : 0}%; background: #34d399;"></div>
            </div>
          </div>
        </div>

        <!-- Platform & Device Diagnostics Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 14px;">
            <div class="order-section-title">📱 Mobile Conversion</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
              <span style="font-size: 12px; color: rgba(255,255,255,0.7);">${mobileVisitors} Visitors • ${mobilePaid} Orders</span>
              <span style="font-family: monospace; font-weight: 800; font-size: 14px; color: #38bdf8;">${mobileConv}%</span>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 14px;">
            <div class="order-section-title">💻 Desktop Conversion</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
              <span style="font-size: 12px; color: rgba(255,255,255,0.7);">${desktopVisitors} Visitors • ${desktopPaid} Orders</span>
              <span style="font-family: monospace; font-weight: 800; font-size: 14px; color: #34d399;">${desktopConv}%</span>
            </div>
          </div>
        </div>

        <!-- Actionable CRO Recommendations -->
        <div style="background: rgba(204, 255, 0, 0.03); border: 1px solid rgba(204, 255, 0, 0.2); border-radius: 6px; padding: 14px;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--accent); letter-spacing: 1px; margin-bottom: 6px;">💡 Conversion Optimization Insight</div>
          <div style="font-size: 11.5px; color: rgba(255,255,255,0.8); line-height: 1.5;">
            ${Number(drop3_Rate) > 40 ? `⚠️ High Cart Abandonment (${drop3_Rate}%). Consider highlighting free courier shipping on checkout or offering 1-click WhatsApp assistance.` : `✨ Solid cart-to-paid completion rate (${stage3_Cart > 0 ? ((paidCount / stage3_Cart) * 100).toFixed(1) : 0}%).`}
            ${Number(drop1_Rate) > 50 ? ` Explore simplifying hero section copy to lower landing bounce rates.` : ` Discovery engagement is performing efficiently.`}
          </div>
        </div>
      `;

      modal.classList.add("active");
    };

    window.closeConversionDeepDiveModal = function() {
      const modal = document.getElementById("conversionDeepDiveModal");
      if (modal) modal.classList.remove("active");
    };

    function renderCurrentVisitorSubTabList(processed) {
      const listContainer = document.getElementById("sessionListContainer");
      if (!listContainer) return;

      let itemsToRender = [];
      if (currentVisitorSubTab === 'unique') {
        itemsToRender = processed.uniqueVisitorsList;
      } else if (currentVisitorSubTab === 'recurring') {
        itemsToRender = processed.recurringIpsList;
      } else {
        itemsToRender = processed.rawSessions;
      }

      if (itemsToRender.length === 0) {
        listContainer.innerHTML = `<p style="opacity: 0.5; font-size: 12px; padding: 25px; text-align: center;">No ${currentVisitorSubTab} visitor records found for this period.</p>`;
        return;
      }

      listContainer.innerHTML = "";
      itemsToRender.forEach(item => {
        const isGroup = !!item.sessions; // true if unique or recurring group
        const div = document.createElement("div");
        div.style.cssText = "background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 14px 16px; border-radius: 6px; cursor: pointer; transition: all 0.2s;";
        div.onmouseover = () => div.style.borderColor = "var(--accent)";
        div.onmouseout = () => {
          if (selectedSessionOrIpId !== (item.ipKey || item.id)) div.style.borderColor = "var(--border-color)";
        };
        
        const targetId = item.ipKey || item.id;
        div.onclick = () => {
          if (isGroup) selectVisitorGroup(item);
          else selectSession(item.id);
        };

        if (selectedSessionOrIpId === targetId) {
          div.style.borderColor = "var(--accent)";
          div.style.background = "rgba(204, 255, 0, 0.05)";
        }

        const isOnline = (Date.now() - new Date(item.lastActive).getTime()) < 300000;
        const activeDot = isOnline 
          ? `<span style="display:inline-block; width:7px; height:7px; background:#34c759; border-radius:50%; margin-right:6px; box-shadow: 0 0 6px #34c759;" title="Online Now"></span>` 
          : `<span style="display:inline-block; width:6px; height:6px; background:rgba(255,255,255,0.25); border-radius:50%; margin-right:6px;" title="Offline"></span>`;

        const formattedDate = formatSessionDateTime(item.lastActive || item.createdAt);
        const relTime = formatRelativeTime(item.lastActive);

        const pagesCount = isGroup ? (item.allPages?.length || 1) : (item.pages?.length || 1);
        const clicksCount = isGroup ? (item.allClicks?.length || 0) : (item.clicks?.length || 0);
        const scrollDepth = item.maxScrollDepth || 0;
        const visitCount = isGroup ? item.sessions.length : 1;

        const recurringBadge = visitCount > 1 
          ? `<span style="background: rgba(204,255,0,0.15); color: var(--accent); font-weight: bold; padding: 2px 7px; border-radius: 10px; font-size: 9.5px; border: 1px solid rgba(204,255,0,0.3); margin-left: 6px;">🔁 ${visitCount} VISITS</span>` 
          : '';

        const isGeoBlockedItem = item.isGeoBlocked || item.isVpn || (item.location && (item.location.includes("VPN") || item.location.includes("Geo Blocked"))) || (item.ip && (item.ip.includes("VPN") || item.ip.includes("Protected")));
        const geoBadge = isGeoBlockedItem
          ? `<span style="background: rgba(255, 159, 10, 0.12); color: #ff9f0a; padding: 2px 6px; border-radius: 3px; font-size: 9px; border: 1px solid rgba(255, 159, 10, 0.25); margin-left: 6px;">🛡️ VPN / GEOBLOCKED</span>`
          : '';

        div.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-weight:bold; font-size:12px; color:#fff; display:flex; align-items:center; flex-wrap:wrap;">
              ${activeDot} <span style="font-family:monospace; color:var(--accent);">${item.ip || "Unknown IP"}</span>
              ${recurringBadge}
              ${geoBadge}
            </div>
            <span style="font-size:10px; color:var(--text-muted); font-family:monospace;">📅 ${formattedDate}</span>
          </div>
          
          <div style="font-size:11px; color:var(--text-muted); display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>📍 <strong>${item.location || "Unknown Location"}</strong></span>
            <span>📱 ${item.device || "Desktop"} (${relTime})</span>
          </div>

          <div style="display:flex; gap:8px; font-size:10px; color:rgba(255,255,255,0.7); flex-wrap:wrap;">
            <span style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:3px; border:1px solid rgba(255,255,255,0.08);">📄 ${pagesCount} Pages</span>
            <span style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:3px; border:1px solid rgba(255,255,255,0.08);">🖱️ ${clicksCount} Clicks</span>
            <span style="background:rgba(204,255,0,0.08); color:var(--accent); padding:2px 6px; border-radius:3px; border:1px solid rgba(204,255,0,0.2);">📜 ${scrollDepth}% Max Scroll</span>
          </div>
        `;
        listContainer.appendChild(div);
      });
    }

    // Detail Inspector for Aggregated IP Visitor Groups
    window.selectVisitorGroup = function(group) {
      selectedSessionOrIpId = group.ipKey;
      const detailContainer = document.getElementById("sessionDetailContainer");
      if (!detailContainer) return;

      const firstSeenStr = formatSessionDateTime(group.firstSeen);
      const lastActiveStr = formatSessionDateTime(group.lastActive);
      const totalSessionsCount = group.sessions.length;

      // Build pages visited list
      let pagesHtml = '';
      if (group.allPages && group.allPages.length > 0) {
        group.allPages.forEach(p => {
          const pageTime = formatSessionDateTime(p.timestamp);
          pagesHtml += `<div style="padding: 8px 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; margin-bottom: 6px; font-family: monospace; display:flex; justify-content:space-between; align-items:center;">
            <span>🖥️ /<strong>${p.page}</strong></span>
            <span style="font-size: 10px; color: var(--text-muted);">${pageTime}</span>
          </div>`;
        });
      }

      // Build clicks list
      let clicksHtml = '';
      if (group.allClicks && group.allClicks.length > 0) {
        group.allClicks.forEach(c => {
          const clickTime = formatSessionDateTime(c.timestamp);
          clicksHtml += `
            <div style="display: flex; gap: 10px; font-size: 11px; margin-bottom: 10px; border-left: 2px solid var(--accent); padding-left: 10px; justify-content:space-between; align-items:flex-start;">
              <div>
                <span style="color: var(--accent); font-weight: bold;">[${(c.element || 'CLICK').toUpperCase()}]</span> 
                clicked <strong>"${c.text}"</strong> on page <span style="font-family: monospace; opacity: 0.8;">/${c.page}</span>
              </div>
              <span style="font-size: 9.5px; color: var(--text-muted); white-space: nowrap; margin-left: 10px; font-family:monospace;">${clickTime}</span>
            </div>`;
        });
      } else {
        clicksHtml = `<p style="opacity:0.5; font-size:11px; padding: 10px;">No interaction clicks recorded across this visitor's sessions.</p>`;
      }

      // Build Individual Sessions Breakdown (Timeline Accordion)
      let sessionsTimelineHtml = '';
      group.sessions.forEach((s, idx) => {
        const sTime = formatSessionDateTime(s.createdAt || s.lastActive);
        const sPages = s.pages?.length || 1;
        const sClicks = s.clicks?.length || 0;
        const sScroll = s.maxScrollDepth || 0;
        sessionsTimelineHtml += `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px 14px; margin-bottom: 8px; font-size: 11px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <div>
              <span style="color: var(--accent); font-weight: bold;">Session #${group.sessions.length - idx}</span>
              <span style="margin-left: 10px; color: #fff; font-family: monospace;">📅 ${sTime}</span>
            </div>
            <div style="display: flex; gap: 8px; font-size: 10px; color: var(--text-muted);">
              <span>📄 ${sPages} Pages</span>
              <span>🖱️ ${sClicks} Clicks</span>
              <span>📜 ${sScroll}% Scroll</span>
              <button onclick="deleteSession('${s.id}')" style="background: transparent; color: var(--danger); border: none; cursor: pointer; text-decoration: underline; font-size: 9.5px;">Delete</button>
            </div>
          </div>`;
      });

      detailContainer.innerHTML = `
        <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 20px; border-radius: 8px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-color); padding-bottom:15px; margin-bottom:20px; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 style="font-size:16px; color:#fff; font-family:'Outfit',sans-serif;">Visitor Journey Profile</h3>
                <span style="font-size: 10px; background: rgba(204, 255, 0, 0.15); color: var(--accent); border: 1px solid rgba(204, 255, 0, 0.3); padding: 2px 8px; border-radius: 12px; font-weight: bold;">${totalSessionsCount} Total Sessions</span>
              </div>
              <p style="font-size:11px; color:var(--text-muted); font-family:monospace; margin-top: 4px;">IP / Client: ${group.ip}</p>
            </div>
            <button onclick="clearVisitorGroupSessions('${group.ipKey}')" style="background:rgba(255,59,48,0.15); color:var(--danger); border:1px solid rgba(255,59,48,0.25); font-size:10px; font-weight:bold; padding:6px 12px; border-radius:3px; cursor:pointer; text-transform:uppercase;">Delete All ${totalSessionsCount} Logs</button>
          </div>

          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; margin-bottom:20px; font-size:11.5px; background:rgba(0,0,0,0.2); padding:15px; border-radius:6px; border:1px solid var(--border-color);">
            <div><strong>IP Address:</strong> <span style="font-family:monospace; color:var(--accent);">${group.ip}</span></div>
            <div><strong>Location:</strong> ${group.location}</div>
            <div><strong>Primary Device:</strong> ${group.device}</div>
            <div><strong>Total Visits Logged:</strong> ${totalSessionsCount} Times</div>
            <div><strong>📅 First Seen:</strong> ${firstSeenStr}</div>
            <div><strong>⏱️ Latest Activity:</strong> ${lastActiveStr}</div>
            <div style="grid-column: span 2;"><strong>User Agent:</strong> <span style="font-size: 10px; opacity: 0.6; word-break: break-all;">${group.userAgent}</span></div>
          </div>

          <div style="display:flex; gap:15px; margin-bottom:25px;">
            <div style="flex:1; background:rgba(204,255,0,0.05); border:1px solid var(--accent); border-radius:6px; padding:12px; text-align:center;">
              <span style="display:block; font-size:22px; font-family:'Outfit',sans-serif; font-weight:bold; color:var(--accent);">${group.maxScrollDepth}%</span>
              <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:bold; letter-spacing:0.5px;">Max Scroll Reached</span>
            </div>
            <div style="flex:1; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; padding:12px; text-align:center;">
              <span style="display:block; font-size:22px; font-family:'Outfit',sans-serif; font-weight:bold; color:#fff;">${group.allPages?.length || 1}</span>
              <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:bold; letter-spacing:0.5px;">Total Pages Visited</span>
            </div>
            <div style="flex:1; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; padding:12px; text-align:center;">
              <span style="display:block; font-size:22px; font-family:'Outfit',sans-serif; font-weight:bold; color:#fff;">${group.allClicks?.length || 0}</span>
              <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:bold; letter-spacing:0.5px;">Total Interactions</span>
            </div>
          </div>

          <div style="margin-bottom:25px;">
            <h4 style="font-size:12px; text-transform:uppercase; color:#fff; margin-bottom:10px; letter-spacing:0.5px;">Logged Session Timeline (${totalSessionsCount} Sessions)</h4>
            <div style="max-height: 180px; overflow-y: auto; padding-right: 5px;">
              ${sessionsTimelineHtml}
            </div>
          </div>

          <div style="margin-bottom:25px;">
            <h4 style="font-size:12px; text-transform:uppercase; color:#fff; margin-bottom:10px; letter-spacing:0.5px;">Aggregated Page Pathway Flow</h4>
            ${pagesHtml || '<p style="opacity:0.5; font-size:11px;">No page pathway recorded.</p>'}
          </div>

          <div>
            <h4 style="font-size:12px; text-transform:uppercase; color:#fff; margin-bottom:12px; letter-spacing:0.5px;">Aggregated User Action & Click Log</h4>
            <div style="background:rgba(0,0,0,0.15); border:1px solid var(--border-color); padding:15px; border-radius:6px; max-height:240px; overflow-y:auto;">
              ${clicksHtml}
            </div>
          </div>
        </div>
      `;
    };

    window.clearVisitorGroupSessions = async function(ipKey) {
      if (!confirm(`Are you sure you want to delete all logged sessions for IP: ${ipKey}?`)) return;
      try {
        if (!window.db || !window.dbDoc || !window.dbDeleteDoc) return;
        const toDelete = adminSessions.filter(s => (s.ip || s.sessionId || s.id) === ipKey);
        for (const s of toDelete) {
          await window.dbDeleteDoc(window.dbDoc(window.db, "sessions", s.id));
        }
        alert("Visitor IP sessions deleted.");
        document.getElementById("sessionDetailContainer").innerHTML = `
          <div style="border: 1px dashed var(--border-color); border-radius: 6px; padding: 40px; text-align: center; color: var(--text-muted);">
            <span style="font-size: 32px; display: block; margin-bottom: 15px;">🔍</span>
            Select any visitor session or recurring IP from the left column to view full dates, scroll pathways, page flows, and custom interaction logs.
          </div>`;
        window.loadAdminSessions(true);
      } catch (err) {
        console.error("Delete IP sessions failed:", err);
        alert("Delete failed: " + err.message);
      }
    };

    window.selectSession = function(sessionId) {
      selectedSessionOrIpId = sessionId;
      const detailContainer = document.getElementById("sessionDetailContainer");
      if (!detailContainer) return;

      const session = adminSessions.find(s => s.id === sessionId);
      if (!session) return;

      const createdStr = formatSessionDateTime(session.createdAt);
      const lastActiveStr = formatSessionDateTime(session.lastActive);
      const clicksCount = session.clicks ? session.clicks.length : 0;
      const pagesCount = session.pages ? session.pages.length : 0;

      // Build pages visited list
      let pagesHtml = '';
      if (session.pages && Array.isArray(session.pages)) {
        session.pages.forEach(p => {
          const pageTime = formatSessionDateTime(p.timestamp);
          pagesHtml += `<div style="padding: 8px 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; margin-bottom: 6px; font-family: monospace; display:flex; justify-content:space-between; align-items:center;">
            <span>🖥️ /<strong>${p.page}</strong></span>
            <span style="font-size: 10px; color: var(--text-muted);">${pageTime}</span>
          </div>`;
        });
      }

      // Build click stream / timeline
      let clicksHtml = '';
      if (session.clicks && Array.isArray(session.clicks) && session.clicks.length > 0) {
        session.clicks.forEach(c => {
          const clickTime = formatSessionDateTime(c.timestamp);
          clicksHtml += `
            <div style="display: flex; gap: 10px; font-size: 11px; margin-bottom: 12px; border-left: 2px solid var(--accent); padding-left: 10px; justify-content:space-between; align-items:flex-start;">
              <div>
                <span style="color: var(--accent); font-weight: bold;">[${(c.element || 'CLICK').toUpperCase()}]</span> 
                clicked <strong>"${c.text}"</strong> on page <span style="font-family: monospace; opacity: 0.8;">/${c.page}</span>
              </div>
              <span style="font-size: 9.5px; color: var(--text-muted); white-space: nowrap; margin-left: 10px; font-family:monospace;">${clickTime}</span>
            </div>`;
        });
      } else {
        clicksHtml = `<p style="opacity:0.5; font-size:11px; padding: 10px;">No button clicks or form inputs logged for this session.</p>`;
      }

      detailContainer.innerHTML = `
        <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 20px; border-radius: 8px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-color); padding-bottom:15px; margin-bottom:20px;">
            <div>
              <h3 style="font-size:16px; color:#fff; font-family:'Outfit',sans-serif; margin-bottom:4px;">Single Session Details</h3>
              <p style="font-size:11px; color:var(--text-muted); font-family:monospace;">ID: ${session.sessionId || session.id}</p>
            </div>
            <button onclick="deleteSession('${session.id}')" style="background:rgba(255,59,48,0.15); color:var(--danger); border:1px solid rgba(255,59,48,0.25); font-size:10px; font-weight:bold; padding:6px 12px; border-radius:3px; cursor:pointer; text-transform:uppercase;">Delete Log</button>
          </div>

          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; margin-bottom:20px; font-size:11.5px; background:rgba(0,0,0,0.2); padding:15px; border-radius:6px; border:1px solid var(--border-color);">
            <div><strong>IP Address:</strong> <span style="font-family:monospace; color:var(--accent);">${session.ip || "Unknown"}</span></div>
            <div><strong>Location:</strong> ${session.location || "Unknown"}</div>
            <div><strong>Referrer Channel:</strong> ${session.referrer || "Direct"}</div>
            <div><strong>Device:</strong> ${session.device || "Desktop"}</div>
            <div><strong>📅 Session Started:</strong> ${createdStr}</div>
            <div><strong>⏱️ Last Activity:</strong> ${lastActiveStr}</div>
            <div style="grid-column: span 2;"><strong>User Agent:</strong> <span style="font-size: 10px; opacity: 0.6; word-break: break-all;">${session.userAgent || "Unknown"}</span></div>
          </div>

          <div style="display:flex; gap:15px; margin-bottom:25px;">
            <div style="flex:1; background:rgba(204,255,0,0.05); border:1px solid var(--accent); border-radius:6px; padding:12px; text-align:center;">
              <span style="display:block; font-size:22px; font-family:'Outfit',sans-serif; font-weight:bold; color:var(--accent);">${session.maxScrollDepth || 0}%</span>
              <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:bold; letter-spacing:0.5px;">Max Scroll Depth</span>
            </div>
            <div style="flex:1; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; padding:12px; text-align:center;">
              <span style="display:block; font-size:22px; font-family:'Outfit',sans-serif; font-weight:bold; color:#fff;">${pagesCount}</span>
              <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:bold; letter-spacing:0.5px;">Pages Visited</span>
            </div>
            <div style="flex:1; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; padding:12px; text-align:center;">
              <span style="display:block; font-size:22px; font-family:'Outfit',sans-serif; font-weight:bold; color:#fff;">${clicksCount}</span>
              <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:bold; letter-spacing:0.5px;">Interactions</span>
            </div>
          </div>

          <div style="margin-bottom:25px;">
            <h4 style="font-size:12px; text-transform:uppercase; color:#fff; margin-bottom:10px; letter-spacing:0.5px;">Page Pathway Flow</h4>
            ${pagesHtml || '<p style="opacity:0.5; font-size:11px;">No page pathway recorded.</p>'}
          </div>

          <div>
            <h4 style="font-size:12px; text-transform:uppercase; color:#fff; margin-bottom:12px; letter-spacing:0.5px;">User Action & Click Log</h4>
            <div style="background:rgba(0,0,0,0.15); border:1px solid var(--border-color); padding:15px; border-radius:6px; max-height:280px; overflow-y:auto;">
              ${clicksHtml}
            </div>
          </div>
        </div>
      `;
    };

    window.deleteSession = async function(id) {
      if (!confirm("Are you sure you want to delete this session log?")) return;
      try {
        if (!window.db || !window.dbDoc || !window.dbDeleteDoc) return;
        await window.dbDeleteDoc(window.dbDoc(window.db, "sessions", id));
        alert("Session log deleted.");
        document.getElementById("sessionDetailContainer").innerHTML = `
          <div style="border: 1px dashed var(--border-color); border-radius: 6px; padding: 40px; text-align: center; color: var(--text-muted);">
            <span style="font-size: 32px; display: block; margin-bottom: 15px;">🔍</span>
            Select any visitor session or recurring IP from the left column to view full dates, scroll pathways, page flows, and custom interaction logs.
          </div>`;
        window.loadAdminSessions(true);
      } catch (err) {
        console.error("Delete session failed:", err);
        alert("Delete failed: " + err.message);
      }
    };

    window.clearAllSessions = async function() {
      if (!confirm("Are you sure you want to clear ALL logged sessions? (This cannot be undone)")) return;
      try {
        if (!window.db || !window.dbDoc || !window.dbDeleteDoc) return;
        for (const session of adminSessions) {
          await window.dbDeleteDoc(window.dbDoc(window.db, "sessions", session.id));
        }
        alert("All session logs cleared.");
        window.loadAdminSessions(true);
      } catch (err) {
        console.error("Clear sessions failed:", err);
        alert("Failed to clear sessions: " + err.message);
      }
    };

    /* COURIER GUY DISPATCH & WAYBILL UTILITIES */
    window.dispatchCourierGuyOrder = function(orderId) {
      const order = adminOrders.find(o => o.id === orderId || o.orderId === orderId);
      if (!order) return;

      const name = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Customer";
      const phone = order.phone || "";
      const email = order.email || "";
      const address = order.address || "";
      const orderRef = order.orderId || order.id || "";
      let itemsList = "";
      if (order.items && Array.isArray(order.items)) {
        itemsList = order.items.map(i => `${i.name || i.nameShort} (${i.size || '100ml'}) x${i.quantity}`).join(", ");
      }

      const formattedText = `--- COURIER GUY DISPATCH DETAILS ---
Order Ref: ${orderRef}
Recipient Name: ${name}
Phone Number: ${phone}
Email: ${email}
Delivery Address: ${address}
Items: ${itemsList}
Total: R${order.total || 0}
-------------------------------------`;

      if (navigator.clipboard) {
        navigator.clipboard.writeText(formattedText).catch(() => {});
      }

      window.openCourierDispatchModal(order, formattedText);
      window.open("https://portal.thecourierguy.co.za/shipments/create", "_blank");
    };

    window.openCourierDispatchModal = function(order, fullText) {
      const modal = document.getElementById("courierDispatchModal");
      const container = document.getElementById("courierDispatchFields");
      if (!modal || !container) return;

      const name = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Customer";
      const phone = order.phone || "";
      const address = order.address || "";

      container.innerHTML = `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 12px; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: bold;">Full Dispatch Summary</span>
            <button onclick="window.copyFieldToClipboard(\`${fullText.replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`, 'Summary')" style="font-size: 9px; background: var(--accent); color: #000; font-weight: bold; border: none; padding: 4px 8px; border-radius: 2px; cursor: pointer;">📋 COPY ALL</button>
          </div>
          <pre style="font-size: 11px; white-space: pre-wrap; font-family: monospace; color: var(--accent); max-height: 120px; overflow-y: auto;">${fullText}</pre>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 10px; border-radius: 4px;">
            <span style="font-size: 9px; text-transform: uppercase; color: var(--text-muted); font-weight: bold; display: block; margin-bottom: 4px;">Recipient Name</span>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: bold;">${name}</span>
              <button onclick="window.copyFieldToClipboard('${name.replace(/'/g, "\\'")}', 'Name')" style="font-size: 9px; background: rgba(255,255,255,0.1); color: #fff; border: 1px solid var(--border-color); padding: 2px 6px; border-radius: 2px; cursor: pointer;">Copy</button>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 10px; border-radius: 4px;">
            <span style="font-size: 9px; text-transform: uppercase; color: var(--text-muted); font-weight: bold; display: block; margin-bottom: 4px;">Phone Number</span>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: bold;">${phone}</span>
              <button onclick="window.copyFieldToClipboard('${phone}', 'Phone')" style="font-size: 9px; background: rgba(255,255,255,0.1); color: #fff; border: 1px solid var(--border-color); padding: 2px 6px; border-radius: 2px; cursor: pointer;">Copy</button>
            </div>
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 10px; border-radius: 4px;">
          <span style="font-size: 9px; text-transform: uppercase; color: var(--text-muted); font-weight: bold; display: block; margin-bottom: 4px;">Full Address</span>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px;">${address}</span>
            <button onclick="window.copyFieldToClipboard('${address.replace(/'/g, "\\'").replace(/\n/g, ' ')}', 'Address')" style="font-size: 9px; background: rgba(255,255,255,0.1); color: #fff; border: 1px solid var(--border-color); padding: 2px 6px; border-radius: 2px; cursor: pointer;">Copy</button>
          </div>
        </div>
      `;

      modal.classList.add("active");
    };

    window.closeCourierDispatchModal = function() {
      const modal = document.getElementById("courierDispatchModal");
      if (modal) modal.classList.remove("active");
    };

    window.copyFieldToClipboard = function(text, label) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          alert(`${label} copied to clipboard!`);
        });
      }
    };

    window.saveOrderWaybill = async function(orderId) {
      const inputEl = document.getElementById(`waybill_input_${orderId}`);
      if (!inputEl || !inputEl.value.trim()) {
        alert("Please enter a waybill number.");
        return;
      }
      const waybillNum = inputEl.value.trim();

      try {
        if (!window.db || !window.dbDoc || !window.dbUpdateDoc) return;
        const orderRef = window.dbDoc(window.db, "orders", orderId);
        await window.dbUpdateDoc(orderRef, {
          waybill: waybillNum,
          status: "Shipped",
          paid: true,
          updatedAt: new Date().toISOString()
        });
        alert(`Waybill ${waybillNum} saved! Order status updated to SHIPPED.`);
        window.loadAdminOrders();
      } catch (err) {
        console.error("Error saving waybill:", err);
        alert("Failed to save waybill: " + err.message);
      }
    };

    window.editWaybill = async function(orderId, currentWaybill) {
      const newWaybill = prompt("Enter new Courier Guy waybill number:", currentWaybill);
      if (newWaybill === null) return;
      try {
        if (!window.db || !window.dbDoc || !window.dbUpdateDoc) return;
        const orderRef = window.dbDoc(window.db, "orders", orderId);
        await window.dbUpdateDoc(orderRef, {
          waybill: newWaybill.trim(),
          status: newWaybill.trim() ? "Shipped" : "paid",
          updatedAt: new Date().toISOString()
        });
        alert("Waybill updated.");
        window.loadAdminOrders();
      } catch (err) {
        console.error("Error updating waybill:", err);
        alert("Failed to update waybill: " + err.message);
      }
    };

    /* --- VISUAL CHART RENDERERS --- */
    function renderTrafficTrendChart(sessions, period) {
      const dateMap = {};
      const pageviewMap = {};

      if (period === 'today') {
        for (let h = 0; h < 24; h++) {
          const hourLabel = `${h.toString().padStart(2, '0')}:00`;
          dateMap[hourLabel] = 0;
          pageviewMap[hourLabel] = 0;
        }
        sessions.forEach(s => {
          const d = new Date(s.createdAt || s.lastActive);
          const h = `${d.getHours().toString().padStart(2, '0')}:00`;
          if (dateMap[h] !== undefined) {
            dateMap[h]++;
            const pagesCount = (s.pages && Array.isArray(s.pages)) ? s.pages.length : 1;
            pageviewMap[h] += pagesCount;
          }
        });
      } else {
        sessions.forEach(s => {
          const d = new Date(s.createdAt || s.lastActive);
          const key = isNaN(d.getTime()) ? 'Unknown' : d.toISOString().split('T')[0];
          dateMap[key] = (dateMap[key] || 0) + 1;
          const pagesCount = (s.pages && Array.isArray(s.pages)) ? s.pages.length : 1;
          pageviewMap[key] = (pageviewMap[key] || 0) + pagesCount;
        });
      }

      let labels = Object.keys(dateMap);
      if (period !== 'today') labels.sort();

      const visitData = labels.map(l => dateMap[l]);
      const pageviewData = labels.map(l => pageviewMap[l]);

      createOrUpdateChart('trafficTrendCanvas', {
        type: 'line',
        data: {
          labels: labels.map(l => period === 'today' ? l : l.slice(5)),
          datasets: [
            {
              label: 'Visitor Sessions',
              data: visitData,
              borderColor: '#ccff00',
              backgroundColor: 'rgba(204, 255, 0, 0.12)',
              fill: true,
              tension: 0.35,
              borderWidth: 2.5,
              pointBackgroundColor: '#ccff00',
              pointRadius: labels.length > 30 ? 2 : 4,
              pointHoverRadius: 6
            },
            {
              label: 'Pageviews',
              data: pageviewData,
              borderColor: '#09A5DB',
              backgroundColor: 'rgba(9, 165, 219, 0.05)',
              fill: false,
              tension: 0.35,
              borderWidth: 2,
              pointBackgroundColor: '#09A5DB',
              pointRadius: labels.length > 30 ? 1 : 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#ffffff', font: { family: 'Outfit', size: 11, weight: '700' } } },
            tooltip: {
              backgroundColor: 'rgba(18, 18, 24, 0.95)',
              titleColor: '#ccff00',
              bodyColor: '#ffffff',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              borderWidth: 1,
              padding: 10
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
              ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
              ticks: { color: 'rgba(255, 255, 255, 0.6)', precision: 0, font: { size: 10 } }
            }
          }
        }
      });
    }

    function renderSalesRevenueTimelineChart(orders, period) {
      const revMap = {};
      const orderCountMap = {};

      orders.forEach(o => {
        const isPaid = o.paid || o.status === "paid" || o.status === "Shipped" || o.status === "Delivered";
        const d = new Date(o.createdAt || o.timestamp);
        const key = isNaN(d.getTime()) ? 'Unknown' : d.toISOString().split('T')[0];
        
        if (isPaid) {
          revMap[key] = (revMap[key] || 0) + (Number(o.total) || 0);
        }
        orderCountMap[key] = (orderCountMap[key] || 0) + 1;
      });

      const labels = Object.keys(orderCountMap);
      labels.sort();

      const revData = labels.map(l => revMap[l] || 0);
      const countData = labels.map(l => orderCountMap[l] || 0);

      createOrUpdateChart('salesRevenueCanvas', {
        data: {
          labels: labels.map(l => l.slice(5)),
          datasets: [
            {
              type: 'bar',
              label: 'Gross Revenue (Rands)',
              data: revData,
              backgroundColor: 'rgba(204, 255, 0, 0.75)',
              borderColor: '#ccff00',
              borderWidth: 1,
              borderRadius: 4,
              yAxisID: 'y'
            },
            {
              type: 'line',
              label: 'Orders Count',
              data: countData,
              borderColor: '#09A5DB',
              backgroundColor: 'transparent',
              borderWidth: 2.5,
              tension: 0.3,
              pointBackgroundColor: '#09A5DB',
              pointRadius: 4,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#ffffff', font: { family: 'Outfit', size: 11, weight: '700' } } },
            tooltip: {
              backgroundColor: 'rgba(18, 18, 24, 0.95)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              borderWidth: 1
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
              ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } }
            },
            y: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
              ticks: {
                color: '#ccff00',
                callback: function(val) { return 'R' + val; },
                font: { size: 10 }
              }
            },
            y1: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              grid: { drawOnChartArea: false },
              ticks: { color: '#09A5DB', precision: 0, font: { size: 10 } }
            }
          }
        }
      });
    }

    function renderDevicePieChart(sessions) {
      let mobile = 0;
      let desktop = 0;
      let tablet = 0;

      sessions.forEach(s => {
        const d = (s.device || '').toLowerCase();
        if (d.includes('mobile')) mobile++;
        else if (d.includes('tablet')) tablet++;
        else desktop++;
      });

      createOrUpdateChart('devicePieCanvas', {
        type: 'doughnut',
        data: {
          labels: ['Mobile Phone', 'Desktop / Laptop', 'Tablet'],
          datasets: [{
            data: [mobile, desktop, tablet],
            backgroundColor: ['#ccff00', '#09A5DB', '#af52de'],
            borderColor: '#0a0a0c',
            borderWidth: 3,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#ffffff', font: { family: 'Outfit', size: 11, weight: 'bold' }, padding: 12 }
            },
            tooltip: {
              backgroundColor: 'rgba(18, 18, 24, 0.95)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              borderWidth: 1
            }
          }
        }
      });
    }

    function renderReferrerBarChart(sessions) {
      const refMap = {};
      sessions.forEach(s => {
        let r = s.referrer || 'Direct / Organic';
        if (r.includes('instagram')) r = 'Instagram';
        else if (r.includes('tiktok')) r = 'TikTok';
        else if (r.includes('google')) r = 'Google Search';
        else if (r.includes('facebook') || r.includes('fb')) r = 'Facebook';
        else if (r.includes('whatsapp') || r.includes('wa.me')) r = 'WhatsApp';
        else if (r.includes('twitter') || r.includes('t.co') || r.includes('x.com')) r = 'X / Twitter';
        else if (r === 'Direct' || r === '' || r.includes('localhost') || r.includes('127.0.0.1')) r = 'Direct / Bookmarks';
        else {
          try {
            const u = new URL(r);
            r = u.hostname.replace('www.', '');
          } catch(e) {}
        }
        refMap[r] = (refMap[r] || 0) + 1;
      });

      const sorted = Object.entries(refMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const labels = sorted.map(item => item[0]);
      const counts = sorted.map(item => item[1]);

      createOrUpdateChart('referrerBarCanvas', {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['Direct'],
          datasets: [{
            label: 'Visitors',
            data: counts.length ? counts : [0],
            backgroundColor: 'rgba(9, 165, 219, 0.85)',
            borderColor: '#09A5DB',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: 'rgba(18, 18, 24, 0.95)', borderColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1 }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 10 } } },
            y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: 'rgba(255, 255, 255, 0.6)', precision: 0, font: { size: 10 } } }
          }
        }
      });
    }

    function renderGeoBarChart(sessions) {
      const geoMap = {};
      sessions.forEach(s => {
        let loc = s.location || 'Unknown';
        if (loc.includes(',')) {
          const parts = loc.split(',');
          loc = parts[0].trim() || parts[1]?.trim() || loc;
        }
        if (loc === 'Loading...' || loc === 'Unknown Location') loc = 'Unknown';
        geoMap[loc] = (geoMap[loc] || 0) + 1;
      });

      const sorted = Object.entries(geoMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const labels = sorted.map(i => i[0]);
      const data = sorted.map(i => i[1]);

      createOrUpdateChart('geoBarCanvas', {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['South Africa'],
          datasets: [{
            label: 'Visitors',
            data: data.length ? data : [0],
            backgroundColor: 'rgba(52, 199, 89, 0.85)',
            borderColor: '#34c759',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: 'rgba(18, 18, 24, 0.95)', borderColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1 }
          },
          scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: 'rgba(255, 255, 255, 0.6)', precision: 0, font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { color: 'rgba(255, 255, 255, 0.8)', font: { size: 10 } } }
          }
        }
      });
    }

    function renderTopPagesChart(sessions) {
      const pageMap = {};
      sessions.forEach(s => {
        if (s.pages && Array.isArray(s.pages)) {
          s.pages.forEach(p => {
            const pageName = `/${p.page || 'index.html'}`;
            pageMap[pageName] = (pageMap[pageName] || 0) + 1;
          });
        } else {
          pageMap['/index.html'] = (pageMap['/index.html'] || 0) + 1;
        }
      });

      const sorted = Object.entries(pageMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const labels = sorted.map(i => i[0]);
      const data = sorted.map(i => i[1]);

      createOrUpdateChart('topPagesCanvas', {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['/index.html'],
          datasets: [{
            label: 'Page Views',
            data: data.length ? data : [0],
            backgroundColor: 'rgba(204, 255, 0, 0.85)',
            borderColor: '#ccff00',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: 'rgba(18, 18, 24, 0.95)', borderColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1 }
          },
          scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: 'rgba(255, 255, 255, 0.6)', precision: 0, font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { color: 'rgba(255, 255, 255, 0.8)', font: { size: 10, family: 'monospace' } } }
          }
        }
      });
    }

    function renderOrderStatusChart(orders) {
      let paid = 0;
      let shipped = 0;
      let pending = 0;
      let delivered = 0;
      let cancelled = 0;

      orders.forEach(o => {
        const s = o.status || (o.paid ? 'paid' : 'pending_payment');
        if (s === 'Shipped') shipped++;
        else if (s === 'Delivered') delivered++;
        else if (s === 'Cancelled') cancelled++;
        else if (o.paid || s === 'paid' || s === 'Pending Shipment') paid++;
        else pending++;
      });

      createOrUpdateChart('orderStatusCanvas', {
        type: 'doughnut',
        data: {
          labels: ['Paid (To Ship)', 'Shipped 🚚', 'Pending Payment', 'Delivered ✓', 'Cancelled'],
          datasets: [{
            data: [paid, shipped, pending, delivered, cancelled],
            backgroundColor: ['#34c759', '#09A5DB', '#ff9f0a', '#ccff00', '#ff3b30'],
            borderColor: '#0a0a0c',
            borderWidth: 3,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { position: 'bottom', labels: { color: '#ffffff', font: { family: 'Outfit', size: 11, weight: 'bold' }, padding: 10 } },
            tooltip: { backgroundColor: 'rgba(18, 18, 24, 0.95)', borderColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1 }
          }
        }
      });
    }

    function renderTopProductsChart(paidOrders) {
      const productMap = {};

      paidOrders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            const name = (item.name || item.nameShort || 'Minara 5 Bespoke') + (item.size ? ` (${item.size})` : '');
            const qty = Number(item.quantity) || 1;
            productMap[name] = (productMap[name] || 0) + qty;
          });
        }
      });

      const sorted = Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const labels = sorted.map(i => i[0]);
      const quantities = sorted.map(i => i[1]);

      createOrUpdateChart('topProductsCanvas', {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['Minara 5 (100ml)'],
          datasets: [{
            label: 'Units Sold',
            data: quantities.length ? quantities : [0],
            backgroundColor: 'rgba(175, 82, 222, 0.85)',
            borderColor: '#af52de',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: 'rgba(18, 18, 24, 0.95)', borderColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1 }
          },
          scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: 'rgba(255, 255, 255, 0.6)', precision: 0, font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { color: 'rgba(255, 255, 255, 0.8)', font: { size: 10 } } }
          }
        }
      });
    }

    function renderFunnelChart(sessions, paidOrders) {
      const stage1_Visitors = sessions.length;
      let stage2_Catalog = 0;
      let stage3_Product = 0;
      let stage4_AddToCart = 0;

      sessions.forEach(s => {
        const pages = (s.pages && Array.isArray(s.pages)) ? s.pages.map(p => p.page || '') : [];
        const clicks = (s.clicks && Array.isArray(s.clicks)) ? s.clicks : [];

        if (pages.some(p => p.includes('catalog'))) stage2_Catalog++;
        if (pages.some(p => p.includes('product') || p.includes('template'))) stage3_Product++;

        const hasCartClick = clicks.some(c => {
          const t = (c.text || '').toUpperCase();
          return t.includes('CART') || t.includes('BUY') || t.includes('ORDER') || t.includes('CHECKOUT');
        });
        if (hasCartClick) stage4_AddToCart++;
      });

      const stage5_Checkout = paidOrders.length;

      createOrUpdateChart('funnelCanvas', {
        type: 'bar',
        data: {
          labels: [
            '1. Store Visitors',
            '2. Catalog Browsers',
            '3. Fragrance Customizer',
            '4. Cart CTAs',
            '5. Completed Orders'
          ],
          datasets: [{
            label: 'Visitors at Stage',
            data: [stage1_Visitors, stage2_Catalog, stage3_Product, stage4_AddToCart, stage5_Checkout],
            backgroundColor: [
              'rgba(175, 82, 222, 0.85)',
              'rgba(9, 165, 219, 0.85)',
              'rgba(52, 199, 89, 0.85)',
              'rgba(255, 159, 10, 0.85)',
              'rgba(204, 255, 0, 0.85)'
            ],
            borderColor: ['#af52de', '#09A5DB', '#34c759', '#ff9f0a', '#ccff00'],
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(18, 18, 24, 0.95)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              borderWidth: 1,
              callbacks: {
                afterBody: function(context) {
                  const val = context[0].raw;
                  if (stage1_Visitors > 0) {
                    const pct = ((val / stage1_Visitors) * 100).toFixed(1);
                    return `Retention: ${pct}% of visitors`;
                  }
                  return '';
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: 'rgba(255, 255, 255, 0.8)', font: { size: 10, weight: 'bold' } } },
            y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: 'rgba(255, 255, 255, 0.6)', precision: 0, font: { size: 10 } } }
          }
        }
      });
    }

function renderCtaClicksChart(sessions) {
      const clickMap = {};
      sessions.forEach(s => {
        if (s.clicks && Array.isArray(s.clicks)) {
          s.clicks.forEach(c => {
            let txt = (c.text || '').trim();
            if (!txt || txt.length < 2) return;
            if (txt.length > 30) txt = txt.slice(0, 28) + '...';
            clickMap[txt] = (clickMap[txt] || 0) + 1;
          });
        }
      });

      const sorted = Object.entries(clickMap).sort((a, b) => b[1] - a[1]).slice(0, 7);
      const labels = sorted.map(i => i[0]);
      const data = sorted.map(i => i[1]);

      createOrUpdateChart('ctaClicksCanvas', {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['Add to Cart', 'Experience Minara 5', 'WhatsApp Inquiry'],
          datasets: [{
            label: 'Total Clicks',
            data: data.length ? data : [0, 0, 0],
            backgroundColor: 'rgba(9, 165, 219, 0.85)',
            borderColor: '#09A5DB',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: 'rgba(18, 18, 24, 0.95)', borderColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1 }
          },
          scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: 'rgba(255, 255, 255, 0.6)', precision: 0, font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { color: 'rgba(255, 255, 255, 0.8)', font: { size: 10 } } }
          }
        }
      });
    }

// Global Exports
window.formatSessionDateTime = formatSessionDateTime;
window.formatRelativeTime = formatRelativeTime;
window.createOrUpdateChart = createOrUpdateChart;
window.filterByPeriod = filterByPeriod;
window.renderGeneralStatistics = renderGeneralStatistics;
