// Studio Extrait - Admin Finance Module
// Revenue + COGS + margins from paid orders, expenses, gateway holds and a
// Nedbank statement ledger (CSV import / manual). Cost prices stay private:
// they live on Firestore product docs and finance_settings/main only.
(function () {
  'use strict';

  var FIN = window.__minaraFinance = window.__minaraFinance || {
    orders: [],
    products: [],
    expenses: [],
    bank: [],
    loaded: false,
    loading: false,
    loadPromise: null,
    period: 'this_month',
    entryType: 'expense',
    seeding: false,
    defaulted: false,
    productById: {},
    productByName: {}
  };

  var EXPENSE_CATEGORIES = [
    'Oils & fragrance', 'Ethanol', 'Bottles', 'Boxes & packaging', 'Labels',
    'Bubble wrap & gift wrap', 'Courier & shipping', 'Marketing & ads',
    'Website & software', 'Bank charges & fees', 'Equipment', 'Other'
  ];

  // Known start-up / historical costs. These are seeded into the
  // `finance_expenses` collection automatically the first time the tab loads
  // with an empty ledger, so the finance tab is never a wall of zeros. Each
  // entry has a stable `seedKey` so re-running the seed can never duplicate a
  // row. Exact purchase days were never recorded, so every row carries
  // dateEstimated:true - edit or delete any row afterwards.
  var STARTER_EXPENSES = [
    { seedKey: 'pna-label-paper', date: '2026-10-02', description: 'Label paper (PNA)', amount: 106, category: 'Labels', notes: 'Printed at PNA' },
    { seedKey: 'pna-bostik-glue', date: '2026-10-02', description: 'Bostik glue stick (PNA)', amount: 29, category: 'Boxes & packaging', notes: 'For gift boxes' },
    { seedKey: 'livelife-fragrance-oils', date: '2026-10-03', description: 'Live Life Fragrances — fragrance oils', amount: 80, category: 'Oils & fragrance', notes: 'First Live Life Fragrances order' },
    // Ethanol is R80 a litre at Live Life Fragrances - never book a 1L line at
    // more than R80 unless the row really is several litres.
    { seedKey: 'livelife-ethanol-1l', date: '2026-10-03', description: 'Live Life Fragrances — 1L ethanol base', amount: 80, category: 'Ethanol', notes: 'First Live Life Fragrances order (1L at R80/L)' },
    { seedKey: 'valueco-jars', date: '2026-10-05', description: 'Value Co — 3 × 1L jars', amount: 190, category: 'Bottles', notes: 'Bulk oil storage' },
    { seedKey: 'perfumeoils-test-bottles', date: '2026-10-07', description: 'Perfume oils (test bottles)', amount: 593.18, category: 'Oils & fragrance', notes: 'Includes test bottles' },
    { seedKey: 'courierguy-delivery-1', date: '2026-10-09', description: 'The Courier Guy', amount: 200, category: 'Courier & shipping', notes: '' },
    { seedKey: 'domain-registration', date: '2026-10-10', description: 'Domain registration', amount: 100, category: 'Website & software', notes: '' },
    { seedKey: 'deepseek-api', date: '2026-10-12', description: 'DeepSeek API', amount: 300, category: 'Website & software', notes: '' },
    { seedKey: 'syringes-25', date: '2026-10-14', description: '25 × 50ml syringes', amount: 164, category: 'Equipment', notes: 'For filling bottles' },
    { seedKey: 'dyes-water-soluble', date: '2026-10-15', description: 'Water-soluble dyes (magenta, yellow, blue)', amount: 105, category: 'Equipment', notes: '' },
    { seedKey: 'courierguy-delivery-2', date: '2026-10-22', description: 'The Courier Guy — second delivery', amount: 200, category: 'Courier & shipping', notes: 'Second courier payment' },
    { seedKey: 'syringes-second-order', date: '2026-10-23', description: 'Syringes (second order)', amount: 300, category: 'Equipment', notes: 'Second syringe order' },
    { seedKey: 'perfumeoils-new-test-oils', date: '2026-10-24', description: 'Perfume Oils — new test oils', amount: 750, category: 'Oils & fragrance', notes: 'New test oils from Perfume Oils' },
    { seedKey: 'livelife-ethanol-topup', date: '2026-10-26', description: 'Live Life Fragrances — 1L ethanol base (top-up)', amount: 80, category: 'Ethanol', notes: 'One more litre of ethanol base' }
  ];

  // Used to guess a category from a plain-English name, so the form only needs
  // a name + an amount. Order matters: the first match wins.
  var CATEGORY_HINTS = [
    ['Ethanol', ['ethanol', 'alcohol', 'base']],
    ['Oils & fragrance', ['oil', 'fragrance', 'perfume', 'scent', 'accord']],
    ['Labels', ['label', 'sticker']],
    ['Bottles', ['bottle', 'atomiser', 'atomizer', 'sprayer', 'jar', 'vial']],
    ['Bubble wrap & gift wrap', ['bubble', 'wrap']],
    ['Boxes & packaging', ['box', 'packaging', 'glue', 'bostik', 'ribbon', 'insert']],
    ['Courier & shipping', ['courier', 'shipping', 'postnet', 'delivery', 'waybill', 'postage']],
    ['Website & software', ['domain', 'hosting', 'api', 'software', 'deepseek', 'openai', 'firebase', 'subscription', 'website', 'plugin']],
    ['Marketing & ads', ['ads', 'advert', 'marketing', 'instagram', 'facebook', 'tiktok', 'influencer']],
    ['Bank charges & fees', ['bank', 'charge', 'service fee']],
    ['Equipment', ['syringe', 'dye', 'scale', 'beaker', 'funnel', 'pipette', 'equipment', 'tool']]
  ];

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
  }

  function esc(v) {
    return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtR(v, d) {
    if (typeof window.minaraFormatRand === 'function') return window.minaraFormatRand(v, d);
    return 'R' + num(v, 0).toFixed(d === undefined ? 2 : d);
  }
  function fmtPct(v) { return num(v, 0).toFixed(1) + '%'; }
  function fmtInt(v) {
    try { return num(v, 0).toLocaleString('en-ZA'); } catch (e) { return String(num(v, 0)); }
  }
  function fmtDate(v) {
    var d = parseDate(v);
    if (!d) return '—';
    return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  /** +R1 234,56 / −R1 234,56 / R0,00 (never "R-12"). */
  function signedR(v) {
    var n = num(v, 0);
    if (Math.abs(n) < 0.005) return fmtR(0);
    return (n > 0 ? '+' : '−') + fmtR(Math.abs(n));
  }
  /** 'fin-in' / 'fin-out' / 'fin-zero' for a money value. */
  function moneyClass(v) {
    var n = num(v, 0);
    if (Math.abs(n) < 0.005) return 'fin-zero';
    return n > 0 ? 'fin-in' : 'fin-out';
  }
  /** Round a chart maximum up to a clean 1 / 2 / 2.5 / 5 × 10^n step. */
  function niceCeil(v) {
    var n = num(v, 0);
    if (!(n > 0)) return 1;
    var exp = Math.floor(Math.log(n) / Math.LN10);
    var base = Math.pow(10, exp);
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) {
      if (n <= steps[i] * base) return steps[i] * base;
    }
    return 10 * base;
  }
  function shortRand(v) {
    var n = Math.abs(num(v, 0));
    if (n >= 1000) {
      var k = Math.round(n / 10) / 100;
      return 'R' + k.toFixed(2).replace(/\.?0+$/, '') + 'k';
    }
    return 'R' + Math.round(n);
  }
  function monthShort(d) {
    return d.toLocaleDateString('en-ZA', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
  }
  function toIsoDate(d) {
    var x = d instanceof Date ? d : parseDate(d);
    if (!x) return '';
    var m = String(x.getMonth() + 1).padStart(2, '0');
    var day = String(x.getDate()).padStart(2, '0');
    return x.getFullYear() + '-' + m + '-' + day;
  }
  function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'object' && typeof v.toDate === 'function') {
      try { return v.toDate(); } catch (e) { return null; }
    }
    if (typeof v === 'number') {
      var nd = new Date(v);
      return isNaN(nd.getTime()) ? null : nd;
    }
    var s = String(v).trim();
    if (!s) return null;
    var m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (m) {
      var y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
      return new Date(y, Number(m[2]) - 1, Number(m[1])); // SA statements are DD/MM/YYYY
    }
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function monthKey(d) {
    var x = d instanceof Date ? d : parseDate(d);
    if (!x) return '';
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
  }
  function monthLabel(key) {
    var parts = String(key).split('-');
    if (parts.length !== 2) return key;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return d.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
  }
  function settings() {
    return window.minaraGetFinanceSettings ? window.minaraGetFinanceSettings() : {
      costing: {}, oilLibrary: [], gateways: {}, vat: {}, bank: {}
    };
  }

  function isPaidOrder(o) {
    if (!o) return false;
    if (o.paid === true) return true;
    var s = String(o.status || '');
    return s === 'paid' || s === 'Pending Shipment' || s === 'Shipped' || s === 'Delivered';
  }
  function orderDate(o) {
    return parseDate(o.paidAt || o.createdAt || o.timestamp || o.updatedAt);
  }
  function gatewayKey(o) {
    var g = String(o && (o.paymentGateway || o.gateway) || '').toLowerCase();
    if (g === 'capitec' || g.indexOf('ozow') === 0) return 'ozow';
    if (g.indexOf('yoco') === 0) return 'yoco';
    return g || 'other';
  }
  function gatewayLabel(g) {
    if (g === 'ozow') return 'Ozow';
    if (g === 'yoco') return 'Yoco';
    return g === 'other' ? 'Other / manual' : g;
  }
  function gatewayFeePercent(g) {
    var gs = settings().gateways || {};
    if (gs[g] && gs[g].feePercent !== undefined) return num(gs[g].feePercent, 0);
    return 0;
  }
  function gatewayDelay(g) {
    var gs = settings().gateways || {};
    return gs[g] && gs[g].payoutDelayDays !== undefined ? num(gs[g].payoutDelayDays, 2) : 2;
  }

  function getPeriodRange(period) {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    var start = null;
    var end = null;
    if (period === 'this_month') {
      start = new Date(y, m, 1); end = new Date(y, m + 1, 1);
    } else if (period === 'last_month') {
      start = new Date(y, m - 1, 1); end = new Date(y, m, 1);
    } else if (period === 'this_quarter') {
      var q = Math.floor(m / 3) * 3;
      start = new Date(y, q, 1); end = new Date(y, q + 3, 1);
    } else if (period === 'this_year') {
      start = new Date(y, 0, 1); end = new Date(y + 1, 0, 1);
    }
    return { start: start, end: end, label: period === 'all_time' ? 'All time' : period.replace(/_/g, ' ') };
  }
  function inPeriod(v, range) {
    if (!range || !range.start) return true;
    var d = parseDate(v);
    if (!d) return false;
    return d.getTime() >= range.start.getTime() && d.getTime() < range.end.getTime();
  }

  function buildProductIndex() {
    FIN.productById = {};
    FIN.productByName = {};
    (FIN.products || []).forEach(function (p) {
      if (!p || !p.id) return;
      FIN.productById[String(p.id)] = p;
      if (p.name) FIN.productByName[String(p.name).toLowerCase().trim()] = p;
      if (p.nameShort) FIN.productByName[String(p.nameShort).toLowerCase().trim()] = p;
    });
  }
  function matchProduct(item) {
    if (!item) return null;
    var id = item.id || item.productId;
    if (id && FIN.productById[String(id)]) return FIN.productById[String(id)];
    var name = String(item.name || item.nameShort || '').toLowerCase().trim();
    if (name && FIN.productByName[name]) return FIN.productByName[name];
    if (id) {
      var byPrefix = (FIN.products || []).filter(function (p) {
        return p.id && String(id).indexOf(String(p.id)) === 0;
      });
      if (byPrefix.length === 1) return byPrefix[0];
    }
    return null;
  }
  function computeItemCost(item) {
    var product = matchProduct(item);
    var qty = Math.max(1, num(item && item.quantity, 1));
    var size = (item && item.size) || (product && product.sizes && product.sizes[0]) || '50ml';
    var pseudo = product;
    if (!pseudo) {
      var scents = item && item.selectedScents;
      var bundle = !!(scents && Array.isArray(scents) && scents.length > 1);
      pseudo = {
        id: item && item.id,
        name: item && (item.name || item.nameShort),
        price: num(item && item.price, 0),
        sizes: [size],
        isBundle: bundle,
        bundleSize: bundle ? scents.length : 0,
        costing: null
      };
    }
    var unit = window.minaraComputeLineCost ? window.minaraComputeLineCost(pseudo, size) : {
      total: 0, breakdown: {}, estimatedOil: true, estimatedBottle: true, packagingType: 'unknown'
    };
    var hasExactOil = !!(product && product.costing &&
      product.costing.oilCostPer100g !== undefined && product.costing.oilCostPer100g !== null &&
      product.costing.oilCostPer100g !== '');
    return {
      product: product,
      qty: qty,
      size: size,
      unitCost: unit.total,
      totalCost: unit.total * qty,
      unit: unit,
      source: hasExactOil ? 'exact' : (product ? 'default' : 'fallback')
    };
  }


  function computeOrder(order) {
    var items = Array.isArray(order.items) ? order.items : [];
    var computedItems = items.map(function (item) {
      var c = computeItemCost(item);
      c.item = item;
      c.lineRevenue = num(item.price, 0) * c.qty;
      return c;
    });
    var lineSum = computedItems.reduce(function (s, i) { return s + i.lineRevenue; }, 0);
    var revenue = num(order.total, lineSum);
    var cogs = computedItems.reduce(function (s, i) { return s + i.totalCost; }, 0);
    var gateway = gatewayKey(order);
    var fee = revenue * gatewayFeePercent(gateway) / 100;
    computedItems.forEach(function (i) {
      var share = lineSum > 0 ? (i.lineRevenue / lineSum) : (computedItems.length ? 1 / computedItems.length : 0);
      i.allocatedRevenue = revenue * share;
      i.allocatedFee = fee * share;
      i.profit = i.allocatedRevenue - i.totalCost - i.allocatedFee;
    });
    var profit = revenue - cogs - fee;
    return {
      order: order,
      items: computedItems,
      revenue: revenue,
      cogs: cogs,
      fee: fee,
      profit: profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      gateway: gateway
    };
  }

  function payoutInfo(comp) {
    var base = orderDate(comp.order) || new Date();
    var release = new Date(base.getTime() + gatewayDelay(comp.gateway) * 86400000);
    return {
      releaseDate: release,
      held: release.getTime() > Date.now(),
      amount: comp.revenue - comp.fee
    };
  }

  function paidComps(range) {
    return FIN.orders
      .filter(function (o) { return isPaidOrder(o) && inPeriod(orderDate(o), range); })
      .map(computeOrder)
      .sort(function (a, b) {
        var da = orderDate(a.order); var db = orderDate(b.order);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });
  }
  function periodExpenses(range) {
    return FIN.expenses
      .filter(function (e) { return inPeriod(e.date || e.createdAt, range); })
      .sort(function (a, b) {
        var da = parseDate(a.date || a.createdAt); var db = parseDate(b.date || b.createdAt);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });
  }
  function sum(list, fn) {
    return list.reduce(function (s, x) { return s + num(fn ? fn(x) : x, 0); }, 0);
  }

  function entryType(e) {
    return String((e && e.type) || 'expense').toLowerCase() === 'income' ? 'income' : 'expense';
  }
  /** Every money-OUT row in the period. */
  function expenseEntries(range) {
    return periodExpenses(range).filter(function (e) { return entryType(e) === 'expense'; });
  }
  /** Every money-IN row in the period (manual income, not store orders). */
  function incomeEntries(range) {
    return periodExpenses(range).filter(function (e) { return entryType(e) === 'income'; });
  }
  function guessCategory(text) {
    var t = String(text || '').toLowerCase();
    if (!t) return 'Other';
    for (var i = 0; i < CATEGORY_HINTS.length; i++) {
      var words = CATEGORY_HINTS[i][1];
      for (var j = 0; j < words.length; j++) {
        if (t.indexOf(words[j]) !== -1) return CATEGORY_HINTS[i][0];
      }
    }
    return 'Other';
  }
  function orderLabel(o) {
    return (o && (o.orderId || o.reference || o.id)) || '—';
  }
  function orderCustomer(o) {
    return (o && (o.customerName || [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email)) || '—';
  }

  window.minaraFinancePeriodRange = getPeriodRange;
  window.minaraFinanceInPeriod = inPeriod;
  window.minaraFinanceFmtR = fmtR;
  window.minaraFinanceSignedR = signedR;
  window.minaraFinanceRender = renderAll;
  window.minaraFinanceComputeOrder = computeOrder;
  window.minaraFinancePayoutInfo = payoutInfo;
  window.minaraFinanceIsPaid = isPaidOrder;

  function fetchCollection(name) {
    return new Promise(function (resolve, reject) {
      if (!(window.db && window.dbCollection && window.dbGetDocs)) {
        reject(new Error('Firestore not ready'));
        return;
      }
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('Timed out reading ' + name));
      }, 15000);
      window.dbGetDocs(window.dbCollection(window.db, name)).then(function (snap) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(snap.docs.map(function (d) {
          var data = d.data() || {};
          data.id = d.id;
          return data;
        }));
      }).catch(function (err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  window.loadFinance = function (force) {
    if (FIN.loading) return FIN.loadPromise;
    if (FIN.loaded && !force) {
      renderAll();
      return Promise.resolve(FIN);
    }
    FIN.loading = true;
    FIN.errors = [];
    var expensesFailed = false;
    FIN.loadPromise = Promise.resolve()
      .then(function () {
        return window.minaraLoadCostingSettings(true);
      })
      .catch(function (e) { console.warn('Finance settings load failed', e); })
      .then(function () {
        return Promise.all([
          fetchCollection('orders').catch(function (e) {
            FIN.errors.push('Orders: ' + e.message + ' (showing admin cache)');
            return (window.adminOrders || []).slice();
          }),
          fetchCollection('products').catch(function (e) {
            FIN.errors.push('Products: ' + e.message + ' (showing admin cache)');
            return (window.minaraProducts || []).slice();
          }),
          fetchCollection('finance_expenses').catch(function (e) {
            expensesFailed = true;
            FIN.errors.push('Expenses: ' + e.message);
            return [];
          }),
          fetchCollection('finance_bank_transactions').catch(function (e) {
            FIN.errors.push('Bank ledger: ' + e.message);
            return [];
          })
        ]);
      })
      .then(function (results) {
        FIN.orders = results[0] || [];
        FIN.products = results[1] || [];
        FIN.expenses = results[2] || [];
        FIN.bank = results[3] || [];
        buildProductIndex();
        FIN.loaded = true;
        FIN.loading = false;
        // If there is nothing at all in the current month but the ledger has
        // history, open on All time so the tab never looks empty by accident.
        if (!FIN.defaulted) {
          FIN.defaulted = true;
          var thisMonth = getPeriodRange('this_month');
          var hasThisMonth = FIN.expenses.some(function (e) { return inPeriod(e.date || e.createdAt, thisMonth); }) ||
            FIN.orders.some(function (o) { return isPaidOrder(o) && inPeriod(orderDate(o), thisMonth); });
          if (!hasThisMonth && (FIN.expenses.length || FIN.orders.length)) FIN.period = 'all_time';
        }
        renderAll();
        // A brand-new / wiped ledger must never leave the tab sitting at zero:
        // write the known costs once (seedKey keeps it idempotent).
        if (!FIN.expenses.length && !expensesFailed) autoSeedLedger();
        return FIN;
      })
      .catch(function (e) {
        FIN.loading = false;
        FIN.errors = FIN.errors.concat(['Finance load failed: ' + (e.message || e)]);
        renderAll();
        return FIN;
      });
    return FIN.loadPromise;
  };

  window.refreshFinance = function () {
    return window.loadFinance(true);
  };

  window.setFinancePeriod = function (value) {
    FIN.period = value || 'this_month';
    renderAll();
  };

  window.switchFinanceSubTab = function (name) {
    ['dashboard', 'sales', 'expenses', 'bank', 'costs'].forEach(function (key) {
      var pane = document.getElementById('financeSubTab_' + key);
      var btn = document.getElementById('financeSubTabBtn_' + key);
      if (pane) pane.classList.toggle('active', key === name);
      if (btn) btn.classList.toggle('active', key === name);
    });
  };

  function getBankBalance() {
    var s = settings();
    var bank = s.bank || {};
    var opening = num(bank.openingBalance, 0);
    var openingDate = bank.openingBalanceDate ? parseDate(bank.openingBalanceDate) : null;
    var rows = (FIN.bank || []).slice().sort(function (a, b) {
      var da = parseDate(a.date); var db = parseDate(b.date);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });
    var latest = rows.find(function (r) {
      return r.balance !== undefined && r.balance !== null && r.balance !== '' && !isNaN(Number(r.balance));
    });
    if (latest) return num(latest.balance, 0);
    var relevant = rows.filter(function (r) {
      if (!openingDate) return true;
      var d = parseDate(r.date);
      return d && d.getTime() >= openingDate.getTime();
    });
    return opening + sum(relevant, function (r) { return num(r.amount, 0); });
  }

  function aggregateProducts(comps) {
    var map = {};
    comps.forEach(function (comp) {
      comp.items.forEach(function (line) {
        var key = line.product ? line.product.id : String(line.item.id || line.item.name || 'unknown');
        if (!map[key]) {
          map[key] = {
            key: key,
            name: line.product ? (line.product.name || line.product.nameShort) : (line.item.name || line.item.nameShort || 'Unmatched item'),
            units: 0,
            bottles: 0,
            revenue: 0,
            cogs: 0,
            fees: 0,
            profit: 0,
            sources: {}
          };
        }
        var row = map[key];
        row.units += line.qty;
        row.bottles += line.qty * num(line.unit.bottles, 1);
        row.revenue += num(line.allocatedRevenue, 0);
        row.cogs += num(line.totalCost, 0);
        row.fees += num(line.allocatedFee, 0);
        row.profit += num(line.profit, 0);
        row.sources[line.source] = true;
      });
    });
    return Object.keys(map).map(function (k) {
      var r = map[k];
      r.unitCost = r.units > 0 ? r.cogs / r.units : 0;
      r.margin = r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0;
      r.sourceLabel = r.sources.fallback ? 'Fallback estimate'
        : (r.sources.default ? 'Default oil price' : 'Exact oil price');
      return r;
    }).sort(function (a, b) { return b.profit - a.profit; });
  }

  function renderAll() {
    if (!document.getElementById('financeKpiGrid')) return;
    var select = document.getElementById('financePeriod');
    if (select && select.value !== FIN.period) select.value = FIN.period;
    var range = getPeriodRange(FIN.period);
    renderKpis(range);
    renderAlerts(range);
    renderMonthly();
    renderCharts();
    renderGateway();
    renderTopProducts(range);
    renderOrders(range);
    renderUnpaidOrders(range);
    renderProductMargins(range);
    renderExpenses(range);
    renderBank(range);
    renderSettings();
    renderProductCosts();
  }

  function renderKpis(range) {
    var el = document.getElementById('financeKpiGrid');
    if (!el) return;
    var comps = paidComps(range);
    var revenue = sum(comps, function (c) { return c.revenue; });
    var cogs = sum(comps, function (c) { return c.cogs; });
    var fees = sum(comps, function (c) { return c.fee; });
    var gross = revenue - cogs - fees;

    var expenseList = expenseEntries(range);
    var incomeList = incomeEntries(range);
    var expenses = sum(expenseList, function (e) { return e.amount; });
    var otherIncome = sum(incomeList, function (e) { return e.amount; });
    var net = gross + otherIncome - expenses;

    var unpaid = (FIN.orders || []).filter(function (o) {
      return !isPaidOrder(o) && inPeriod(orderDate(o), range);
    });
    var unpaidValue = sum(unpaid, function (o) { return num(o.total, 0); });

    var allComps = FIN.orders.filter(isPaidOrder).map(computeOrder);
    var held = 0;
    var released = 0;
    allComps.forEach(function (c) {
      var p = payoutInfo(c);
      if (p.held) held += p.amount; else released += p.amount;
    });
    var bankBalance = getBankBalance();
    var netMargin = revenue > 0 ? (net / revenue) * 100 : 0;

    var categoryTotals = {};
    expenseList.forEach(function (e) {
      var c = e.category || 'Other';
      categoryTotals[c] = num(categoryTotals[c], 0) + num(e.amount, 0);
    });
    var topCategory = Object.keys(categoryTotals).sort(function (a, b) {
      return categoryTotals[b] - categoryTotals[a];
    })[0];

    var allExpenseList = (FIN.expenses || []).filter(function (e) { return entryType(e) === 'expense'; });
    var allTimeSpent = sum(allExpenseList, function (e) { return e.amount; });
    var allTimeIncome = sum((FIN.expenses || []).filter(function (e) { return entryType(e) === 'income'; }), function (e) { return e.amount; });

    el.innerHTML = [
      '<div class="finance-kpi kpi-good"><div class="kpi-label">Money in · revenue</div><div class="kpi-value">' +
        signedR(revenue) + '</div><div class="kpi-hint">' + comps.length + ' paid order' + (comps.length === 1 ? '' : 's') +
        ' · ' + esc(range.label) + ' · COGS ' + fmtR(cogs) + '</div></div>',

      '<div class="finance-kpi kpi-bad"><div class="kpi-label">Money out · spent</div><div class="kpi-value">' +
        signedR(-expenses) + '</div><div class="kpi-hint">' + expenseList.length + ' expense' + (expenseList.length === 1 ? '' : 's') +
        (topCategory ? ' · biggest: ' + esc(topCategory) + ' ' + fmtR(categoryTotals[topCategory]) : '') +
        '<br>All time: ' + expenseList.length + ' of ' + allExpenseList.length + ' rows · ' + signedR(-allTimeSpent) + '</div></div>',

      '<div class="finance-kpi kpi-good"><div class="kpi-label">Other income</div><div class="kpi-value">' +
        signedR(otherIncome) + '</div><div class="kpi-hint">' + incomeList.length + ' manual income entr' +
        (incomeList.length === 1 ? 'y' : 'ies') + ' · not store orders · all time ' + signedR(allTimeIncome) + '</div></div>',

      '<div class="finance-kpi ' + (net >= 0 ? 'kpi-good' : 'kpi-bad') + '"><div class="kpi-label">Net profit</div><div class="kpi-value">' +
        signedR(net) + '</div><div class="kpi-hint">Gross ' + fmtR(gross) + ' after ' + fmtR(fees) + ' fees + income − expenses · ' +
        fmtPct(netMargin) + '</div></div>',

      '<div class="finance-kpi"><div class="kpi-label">Unpaid orders</div><div class="kpi-value">' + fmtR(unpaidValue) +
        '</div><div class="kpi-hint">' + unpaid.length + ' order' + (unpaid.length === 1 ? '' : 's') +
        ' excluded from revenue · delete under Sales</div></div>',

      '<div class="finance-kpi"><div class="kpi-label">Cash position</div><div class="kpi-value">' + fmtR(bankBalance) +
        '</div><div class="kpi-hint">' + fmtR(held) + ' still in gateway hold · ' + fmtR(released) + ' released</div></div>'
    ].join('');
  }


  function renderAlerts(range) {
    var el = document.getElementById('financeAlerts');
    if (!el) return;
    var alerts = [];
    (FIN.errors || []).forEach(function (err) {
      alerts.push('<div class="finance-alert error">' + esc(err) + '</div>');
    });
    var missingOil = (FIN.products || []).filter(function (p) {
      return !(p.costing && p.costing.oilCostPer100g !== undefined &&
        p.costing.oilCostPer100g !== null && p.costing.oilCostPer100g !== '');
    });
    if (missingOil.length) {
      alerts.push('<div class="finance-alert">' + missingOil.length + ' product' + (missingOil.length === 1 ? '' : 's') +
        ' still use the default oil price. Open Catalog &amp; Inventory → Edit and set the exact oil on each product for precise margins.</div>');
    }
    if (!FIN.bank.length) {
      alerts.push('<div class="finance-alert">No bank transactions imported yet. Import a Nedbank CSV under <strong>Nedbank &amp; Payouts</strong> to reconcile payouts and see the real cash balance.</div>');
    }
    if (!FIN.expenses.length) {
      alerts.push('<div class="finance-alert">No expenses recorded yet. Press <strong>Load start-up costs</strong> on the Expenses tab to add the known costs, then add new ones as they happen.</div>');
    }
    var held = 0;
    FIN.orders.filter(isPaidOrder).map(computeOrder).forEach(function (c) {
      var p = payoutInfo(c); if (p.held) held += p.amount;
    });
    if (held > 0) {
      alerts.push('<div class="finance-alert ok">' + fmtR(held) + ' is still inside a gateway payout window. It is collected revenue but not yet banked cash.</div>');
    }
    el.innerHTML = alerts.slice(0, 5).join('');
  }

  function renderMonthly() {
    var body = document.getElementById('financeMonthlyTableBody');
    if (!body) return;
    var months = monthlySeries(12);
    body.innerHTML = months.map(function (m) {
      var margin = m.revenue > 0 ? (m.net / m.revenue) * 100 : 0;
      return '<tr><td>' + esc(m.label) + '</td><td>' + m.orders + '</td>' +
        moneyTd(m.revenue) +
        moneyTd(m.cogs, true) +
        moneyTd(m.fees, true) +
        moneyTd(m.expenses, true) +
        moneyTd(m.income) +
        moneyTd(m.net, false, 'fin-strong') +
        '<td>' + fmtPct(margin) + '</td></tr>';
    }).join('');
  }

  function moneyTd(v, invert, extraClass) {
    var n = num(v, 0) * (invert ? -1 : 1);
    return '<td class="' + moneyClass(n) + (extraClass ? ' ' + extraClass : '') + '">' + signedR(n) + '</td>';
  }

  /** Shared month buckets: last `count` months incl. the current one. */
  function monthlySeries(count) {
    var now = new Date();
    var months = [];
    for (var i = count - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: monthKey(d), label: monthLabel(monthKey(d)), short: monthShort(d),
        orders: 0, revenue: 0, cogs: 0, fees: 0, expenses: 0, income: 0, in: 0, out: 0, net: 0
      });
    }
    var index = {};
    months.forEach(function (m) { index[m.key] = m; });
    FIN.orders.filter(isPaidOrder).forEach(function (o) {
      var key = monthKey(orderDate(o));
      if (!index[key]) return;
      var c = computeOrder(o);
      index[key].orders += 1;
      index[key].revenue += c.revenue;
      index[key].cogs += c.cogs;
      index[key].fees += c.fee;
    });
    FIN.expenses.forEach(function (e) {
      var key = monthKey(e.date || e.createdAt);
      if (!index[key]) return;
      if (entryType(e) === 'income') index[key].income += num(e.amount, 0);
      else index[key].expenses += num(e.amount, 0);
    });
    months.forEach(function (m) {
      m.net = m.revenue - m.cogs - m.fees - m.expenses + m.income;
      m.in = m.revenue + m.income;
      m.out = m.expenses;
    });
    return months;
  }
  function chartEmpty(message) {
    return '<div class="finance-chart-empty">' + esc(message) + '</div>';
  }
  function shortSigned(v) {
    var n = num(v, 0);
    if (Math.abs(n) < 0.005) return shortRand(0);
    return (n > 0 ? '+' : '−') + shortRand(Math.abs(n));
  }

  function renderCharts() {
    var months = monthlySeries(6);
    renderTrendChart(months);
    renderNetChart(months);
  }

  /** Grouped bars: money in (green) vs money out (red) per month. */
  function renderTrendChart(months) {
    var host = document.getElementById('financeTrendChart');
    if (!host) return;
    var legend = document.getElementById('financeTrendLegend');
    var hasData = months.some(function (m) { return m.in > 0 || m.out > 0; });
    if (!hasData) {
      host.innerHTML = chartEmpty('No money in or out in the last 6 months yet.');
      if (legend) legend.innerHTML = '';
      return;
    }
    var W = 720, H = 300, L = 60, R = 18, T = 24, B = 62;
    var plotW = W - L - R, plotH = H - T - B;
    var maxV = 0;
    months.forEach(function (m) { maxV = Math.max(maxV, m.in, m.out); });
    var top = niceCeil(maxV);
    function yFor(v) { return T + plotH * (1 - num(v, 0) / top); }
    var svg = ['<svg class="finance-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Money in versus money out per month">'];
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      var yy = yFor(top * f);
      svg.push('<line x1="' + L + '" y1="' + yy.toFixed(1) + '" x2="' + (W - R) + '" y2="' + yy.toFixed(1) + '" class="fin-grid"/>');
      svg.push('<text x="' + (L - 10) + '" y="' + (yy + 3.5).toFixed(1) + '" class="fin-axis" text-anchor="end">' + shortRand(top * f) + '</text>');
    });
    var groupW = plotW / months.length;
    var barW = Math.min(30, groupW * 0.3);
    months.forEach(function (m, i) {
      var cx = L + groupW * i + groupW / 2;
      var hIn = plotH * (m.in / top);
      var hOut = plotH * (m.out / top);
      if (m.in > 0) {
        svg.push('<rect x="' + (cx - barW - 2).toFixed(1) + '" y="' + (T + plotH - hIn).toFixed(1) +
          '" width="' + barW.toFixed(1) + '" height="' + hIn.toFixed(1) + '" rx="2" class="fin-bar-in">' +
          '<title>' + esc(m.label) + ' — in ' + fmtR(m.in) + '</title></rect>');
      }
      if (m.out > 0) {
        svg.push('<rect x="' + (cx + 2).toFixed(1) + '" y="' + (T + plotH - hOut).toFixed(1) +
          '" width="' + barW.toFixed(1) + '" height="' + hOut.toFixed(1) + '" rx="2" class="fin-bar-out">' +
          '<title>' + esc(m.label) + ' — out ' + fmtR(m.out) + '</title></rect>');
      }
      svg.push('<text x="' + cx.toFixed(1) + '" y="' + (T + plotH + 20) + '" class="fin-axis fin-axis-strong" text-anchor="middle">' + esc(m.short) + '</text>');
      svg.push('<text x="' + cx.toFixed(1) + '" y="' + (T + plotH + 40) + '" class="fin-net-label ' +
        (Math.abs(m.net) < 0.005 ? 'fin-svg-zero' : (m.net > 0 ? 'fin-svg-in' : 'fin-svg-out')) +
        '" text-anchor="middle">' + signedR(m.net) + '</text>');
    });
    svg.push('</svg>');
    host.innerHTML = svg.join('');
    if (legend) legend.innerHTML = '<span class="in">Money in</span><span class="out">Money out</span><span class="net">Net under each month</span>';
  }

  /** Diverging bars around zero: net profit per month. */
  function renderNetChart(months) {
    var host = document.getElementById('financeNetChart');
    if (!host) return;
    var maxAbs = 0;
    months.forEach(function (m) { maxAbs = Math.max(maxAbs, Math.abs(m.net)); });
    if (!(maxAbs > 0)) {
      host.innerHTML = chartEmpty('Net profit appears once there are paid orders or expenses.');
      return;
    }
    var W = 460, H = 300, L = 58, R = 18, T = 28, B = 54;
    var plotW = W - L - R, plotH = H - T - B;
    var top = niceCeil(maxAbs);
    var baseY = T + plotH / 2;
    var scale = (plotH / 2) / top;
    var svg = ['<svg class="finance-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Net profit per month">'];
    [1, 0, -1].forEach(function (f) {
      var yy = baseY - top * f * scale;
      svg.push('<line x1="' + L + '" y1="' + yy.toFixed(1) + '" x2="' + (W - R) + '" y2="' + yy.toFixed(1) + '" class="' + (f === 0 ? 'fin-zero-line' : 'fin-grid') + '"/>');
      svg.push('<text x="' + (L - 10) + '" y="' + (yy + 3.5).toFixed(1) + '" class="fin-axis" text-anchor="end">' + shortSigned(top * f) + '</text>');
    });
    var groupW = plotW / months.length;
    var barW = Math.min(34, groupW * 0.46);
    months.forEach(function (m, i) {
      var cx = L + groupW * i + groupW / 2;
      var h = Math.abs(m.net) * scale;
      var yy = m.net >= 0 ? baseY - h : baseY;
      if (h > 0.5) {
        svg.push('<rect x="' + (cx - barW / 2).toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + barW.toFixed(1) +
          '" height="' + h.toFixed(1) + '" rx="2" class="' + (m.net >= 0 ? 'fin-bar-in' : 'fin-bar-out') + '">' +
          '<title>' + esc(m.label) + ' — net ' + signedR(m.net) + '</title></rect>');
        svg.push('<text x="' + cx.toFixed(1) + '" y="' + ((m.net >= 0 ? yy - 7 : yy + h + 13)).toFixed(1) +
          '" class="fin-net-label ' + (m.net >= 0 ? 'fin-svg-in' : 'fin-svg-out') + '" text-anchor="middle">' +
          shortSigned(m.net) + '</text>');
      }
      svg.push('<text x="' + cx.toFixed(1) + '" y="' + (H - 16) + '" class="fin-axis fin-axis-strong" text-anchor="middle">' + esc(m.short) + '</text>');
    });
    svg.push('</svg>');
    host.innerHTML = svg.join('');
  }



  function renderGateway() {
    var body = document.getElementById('financeGatewayTableBody');
    if (!body) return;
    var groups = { ozow: null, yoco: null, other: null };
    FIN.orders.filter(isPaidOrder).map(computeOrder).forEach(function (c) {
      var g = c.gateway;
      if (!groups[g]) groups[g] = { orders: 0, collected: 0, fees: 0, released: 0, held: 0 };
      var p = payoutInfo(c);
      groups[g].orders += 1;
      groups[g].collected += c.revenue;
      groups[g].fees += c.fee;
      if (p.held) groups[g].held += p.amount; else groups[g].released += p.amount;
    });
    var rows = [];
    ['ozow', 'yoco', 'other'].forEach(function (g) {
      var v = groups[g];
      if (!v) return;
      rows.push('<tr><td>' + gatewayLabel(g) + '</td><td>' + v.orders + '</td><td>' + fmtR(v.collected) +
        '</td><td class="fin-out">' + signedR(-v.fees) + '</td><td class="fin-in">' + signedR(v.released) +
        '</td><td class="fin-warn">' + signedR(v.held) + '</td></tr>');
    });
    body.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="6" class="finance-empty">No paid orders yet.</td></tr>';
  }
  /** Horizontal bars: where this period's money went. */
  function renderCategoryChart(range) {
    var host = document.getElementById('financeCategoryChart');
    if (!host) return;
    var list = expenseEntries(range);
    if (!list.length) {
      host.innerHTML = chartEmpty('No expenses in this period — change the period or add one below.');
      return;
    }
    var map = {};
    list.forEach(function (e) {
      var c = e.category || 'Other';
      if (!map[c]) map[c] = { count: 0, total: 0 };
      map[c].count += 1;
      map[c].total += num(e.amount, 0);
    });
    var keys = Object.keys(map).sort(function (a, b) { return map[b].total - map[a].total; });
    var total = sum(keys, function (k) { return map[k].total; });
    var max = map[keys[0]].total || 1;
    var html = keys.slice(0, 8).map(function (k) {
      var w = Math.max(2, (map[k].total / max) * 100);
      return '<div class="fin-cat-row"><span class="fin-cat-name" title="' + esc(k) + '">' + esc(k) +
        '<em>' + map[k].count + '</em></span><span class="fin-cat-track"><span class="fin-cat-fill" style="width:' +
        w.toFixed(1) + '%"></span></span><span class="fin-cat-amount">' + signedR(-map[k].total) + '</span></div>';
    }).join('');
    html += '<div class="fin-cat-total"><span>Total out · ' + esc(range.label) + '</span><strong class="fin-out">' +
      signedR(-total) + '</strong></div>';
    host.innerHTML = html;
  }



  function renderTopProducts(range) {
    var body = document.getElementById('financeTopProductsBody');
    if (!body) return;
    var rows = aggregateProducts(paidComps(range)).slice(0, 8);
    body.innerHTML = rows.length ? rows.map(function (r) {
      return '<tr><td>' + esc(r.name) + '</td><td>' + fmtInt(r.units) + '</td><td class="' +
        moneyClass(r.profit) + '">' + signedR(r.profit) + '</td><td>' + fmtPct(r.margin) + '</td></tr>';
    }).join('') : '<tr><td colspan="4" class="finance-empty">No paid orders in this period.</td></tr>';
  }

  function renderOrders(range) {
    var body = document.getElementById('financeOrdersTableBody');
    if (!body) return;
    var comps = paidComps(range);
    if (!comps.length) {
      body.innerHTML = '<tr><td colspan="11" class="finance-empty">No paid orders in this period.</td></tr>';
      return;
    }
    body.innerHTML = comps.slice(0, 200).map(function (c) {
      var p = payoutInfo(c);
      var o = c.order;
      var ref = o.orderId || o.reference || o.id || '—';
      return '<tr><td>' + fmtDate(orderDate(o)) + '</td><td title="' + esc(ref) + '">' +
        esc(String(ref).length > 18 ? String(ref).slice(0, 18) + '…' : ref) + '</td><td>' +
        esc(o.customerName || o.firstName || o.email || '—') + '</td><td>' + gatewayLabel(c.gateway) + '</td><td>' +
        fmtR(c.revenue) + '</td><td class="fin-out">' + signedR(-c.cogs) + '</td><td class="fin-out">' +
        signedR(-c.fee) + '</td><td class="' + moneyClass(c.profit) + ' fin-strong">' + signedR(c.profit) +
        '</td><td>' + fmtPct(c.margin) + '</td><td><span class="finance-pill ' + (p.held ? 'held' : 'released') + '">' +
        (p.held ? 'In hold' : 'Released') + '</span><div class="fin-small">' +
        (p.held ? 'from ' + fmtDate(p.releaseDate) : fmtDate(p.releaseDate)) + '</div></td><td><button type="button" class="finance-del-btn" title="Delete this paid order" onclick="deleteFinanceOrder(\'' +
        esc(o.id) + '\')">×</button></td></tr>';
    }).join('');
  }

  function renderUnpaidOrders(range) {
    var body = document.getElementById('financeUnpaidOrdersBody');
    if (!body) return;
    var list = (FIN.orders || []).filter(function (o) {
      return !isPaidOrder(o) && inPeriod(orderDate(o), range);
    }).sort(function (a, b) {
      var da = orderDate(a); var db = orderDate(b);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="6" class="finance-empty">No unpaid orders in this period.</td></tr>';
      return;
    }
    body.innerHTML = list.slice(0, 200).map(function (o) {
      var ref = orderLabel(o);
      return '<tr><td>' + fmtDate(orderDate(o)) + '</td><td title="' + esc(ref) + '">' +
        esc(String(ref).length > 18 ? String(ref).slice(0, 18) + '…' : ref) + '</td><td>' +
        esc(orderCustomer(o)) + '</td><td>' + fmtR(num(o.total, 0)) + '</td><td><span class="finance-pill held">' +
        esc(o.status || o.paymentStatus || 'unpaid') + '</span></td><td><button type="button" class="finance-del-btn" title="Delete this unpaid order" onclick="deleteFinanceOrder(\'' +
        esc(o.id) + '\')">×</button></td></tr>';
    }).join('');
  }

  function renderProductMargins(range) {
    var body = document.getElementById('financeProductMarginsBody');
    if (!body) return;
    var rows = aggregateProducts(paidComps(range));
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8" class="finance-empty">No product sales in this period.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (r) {
      return '<tr><td>' + esc(r.name) + '</td><td>' + fmtInt(r.units) +
        (r.bottles !== r.units ? ' <span class="fin-small">(' + fmtInt(r.bottles) + ' bottles)</span>' : '') +
        '</td><td>' + fmtR(r.revenue) + '</td><td>' + fmtR(r.unitCost) + '</td><td class="fin-out">' + signedR(-r.cogs) +
        '</td><td class="' + moneyClass(r.profit) + ' fin-strong">' +
        signedR(r.profit) + '</td><td>' + fmtPct(r.margin) + '</td><td><span class="finance-pill ' +
        (r.sourceLabel === 'Exact oil price' ? 'released' : 'estimate') + '">' + esc(r.sourceLabel) + '</span></td></tr>';
    }).join('');
  }


  function populateExpenseCategories() {
    var sel = document.getElementById('finExpenseCategory');
    if (!sel || sel.getAttribute('data-ready') === '1') return;
    sel.innerHTML = '<option value="">Auto — pick from the name</option>' + EXPENSE_CATEGORIES.map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');
    sel.setAttribute('data-ready', '1');
  }

  function financeToday() {
    return toIsoDate(new Date());
  }

  function fieldValue(id) {
    var f = document.getElementById(id);
    return f && f.value !== undefined && f.value !== null ? String(f.value) : '';
  }

  function renderExpenses(range) {
    populateExpenseCategories();
    var dateInput = document.getElementById('finExpenseDate');
    if (dateInput && !dateInput.value) dateInput.value = financeToday();
    var list = periodExpenses(range);
    var body = document.getElementById('financeExpensesTableBody');
    if (body) {
      body.innerHTML = list.length ? list.map(function (e) {
        var isIncome = entryType(e) === 'income';
        return '<tr><td>' + fmtDate(e.date || e.createdAt) + '</td><td><span class="finance-pill ' +
          (isIncome ? 'released' : 'held') + '">' + (isIncome ? 'Income' : 'Expense') + '</span></td><td>' +
          esc(e.description || e.category || '') +
          (e.dateEstimated ? ' <span class="finance-pill estimate" title="Exact date not recorded">date est.</span>' : '') +
          '</td><td class="' + (isIncome ? 'fin-in' : 'fin-out') + ' fin-strong">' +
          signedR(isIncome ? num(e.amount, 0) : -num(e.amount, 0)) +
          '</td><td><button type="button" class="finance-del-btn" title="Delete this row" onclick="deleteFinanceExpense(\'' +
          esc(e.id) + '\')">×</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="finance-empty">No money in or out in this period.</td></tr>';
    }

    var note = document.getElementById('financeExpensePeriodNote');
    if (note) {
      var all = FIN.expenses || [];
      var allOut = sum(all.filter(function (e) { return entryType(e) === 'expense'; }), function (e) { return e.amount; });
      var hidden = all.length - list.length;
      note.innerHTML = '<span>Showing <strong>' + list.length + '</strong> of <strong>' + all.length +
        '</strong> ledger rows · all time out <strong class="fin-out">' + signedR(-allOut) + '</strong></span>' +
        (hidden > 0 ? '<button type="button" class="btn-action" onclick="setFinancePeriod(\'all_time\')">Show all time (' + all.length + ')</button>' : '');
    }

    renderCategoryChart(range);

    var catBody = document.getElementById('financeExpenseCategoryBody');
    if (catBody) {
      var spend = list.filter(function (e) { return entryType(e) === 'expense'; });
      var map = {};
      spend.forEach(function (e) {
        var c = e.category || 'Other';
        if (!map[c]) map[c] = { count: 0, total: 0 };
        map[c].count += 1;
        map[c].total += num(e.amount, 0);
      });
      var keys = Object.keys(map).sort(function (a, b) { return map[b].total - map[a].total; });
      var total = sum(keys, function (k) { return map[k].total; });
      catBody.innerHTML = keys.length ? keys.map(function (k) {
        var pct = total > 0 ? (map[k].total / total) * 100 : 0;
        return '<tr><td>' + esc(k) + '</td><td>' + map[k].count + '</td><td class="fin-out">' +
          signedR(-map[k].total) + '</td><td>' + fmtPct(pct) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="finance-empty">No expenses in this period.</td></tr>';
    }
  }

  function csvCell(v) {
    var s = String(v === undefined || v === null ? '' : v);
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function downloadCsv(filename, rows) {
    var csv = rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  window.exportFinanceExpenses = function () {
    var list = periodExpenses(getPeriodRange(FIN.period));
    var rows = [['Date', 'Type', 'Category', 'Name', 'Amount', 'Date estimated', 'Notes']];
    list.forEach(function (e) {
      rows.push([e.date || e.createdAt, entryType(e), e.category, e.description, e.amount,
        e.dateEstimated ? 'yes' : '', e.notes]);
    });
    downloadCsv('studio-extrait-money-in-out-' + financeToday() + '.csv', rows);
  };

  window.setFinanceEntryType = function (type) {
    FIN.entryType = type === 'income' ? 'income' : 'expense';
    var exp = document.getElementById('finEntryTypeExpense');
    var inc = document.getElementById('finEntryTypeIncome');
    if (exp) exp.classList.toggle('active', FIN.entryType === 'expense');
    if (inc) inc.classList.toggle('active', FIN.entryType === 'income');
    var desc = document.getElementById('finExpenseDesc');
    if (desc) desc.placeholder = FIN.entryType === 'income' ? 'e.g. Cash sale' : 'e.g. Courier Guy';
  };

  window.addFinanceExpense = function (event) {
    if (event) event.preventDefault();
    if (!(window.db && window.dbAddDoc && window.dbCollection)) {
      alert('Firestore is not ready yet. Refresh the admin page and try again.');
      return;
    }
    var type = FIN.entryType === 'income' ? 'income' : 'expense';
    var date = fieldValue('finExpenseDate') || financeToday();
    var description = fieldValue('finExpenseDesc').trim();
    var amount = Math.abs(num(fieldValue('finExpenseAmount'), 0));
    var category = fieldValue('finExpenseCategory') || guessCategory(description);
    if (!description || amount <= 0) {
      alert('Enter a name and an amount greater than zero.');
      return;
    }
    var doc = {
      date: date,
      type: type,
      category: category,
      description: description,
      amount: amount,
      vatAmount: 0,
      paymentMethod: '',
      reference: '',
      notes: '',
      createdAt: new Date().toISOString(),
      createdBy: (window.auth && window.auth.currentUser && window.auth.currentUser.email) || ''
    };
    var form = document.getElementById('financeExpenseForm');
    var btn = form ? form.querySelector('button[type="submit"]') : null;
    var oldText = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'SAVING…'; }
    window.dbAddDoc(window.dbCollection(window.db, 'finance_expenses'), doc)
      .then(function (ref) {
        doc.id = ref.id;
        FIN.expenses.push(doc);
        ['finExpenseDesc', 'finExpenseAmount'].forEach(function (id) {
          var f = document.getElementById(id); if (f) f.value = '';
        });
        renderAll();
      })
      .catch(function (err) {
        console.error(err);
        alert('Could not save the entry: ' + (err.message || err) +
          '\n\nIf this says "Missing or insufficient permissions", deploy the updated firestore.rules.');
      })
      .then(function () {
        if (btn) { btn.disabled = false; btn.innerHTML = oldText; }
        var desc = document.getElementById('finExpenseDesc');
        if (desc) desc.focus();
      });
  };

  window.deleteFinanceExpense = function (id) {
    if (!id) return;
    if (!confirm('Delete this row? This cannot be undone.')) return;
    if (!(window.db && window.dbDeleteDoc && window.dbDoc)) return;
    window.dbDeleteDoc(window.dbDoc(window.db, 'finance_expenses', id))
      .then(function () {
        FIN.expenses = FIN.expenses.filter(function (e) { return e.id !== id; });
        renderAll();
      })
      .catch(function (err) {
        alert('Could not delete the expense: ' + (err.message || err));
      });
  };

  // Deletes an order from Firestore. Unpaid orders only need a confirm; a paid
  // order is counted as revenue, so it needs the word DELETE typed out.
  window.deleteFinanceOrder = function (id) {
    if (!id) return;
    var order = (FIN.orders || []).filter(function (o) { return String(o.id) === String(id); })[0];
    if (!order) return;
    if (!(window.db && window.dbDeleteDoc && window.dbDoc)) {
      alert('Firestore is not ready yet. Refresh the admin page and try again.');
      return;
    }
    var label = orderLabel(order);
    var amount = num(order.total, 0);
    if (isPaidOrder(order)) {
      var typed = window.prompt('This order counts as revenue (' + fmtR(amount) + ').\n' +
        'Deleting it removes the order and its revenue.\n\nType DELETE to confirm.');
      if (typed === null) return;
      if (String(typed).trim().toUpperCase() !== 'DELETE') {
        alert('Cancelled — nothing was deleted.');
        return;
      }
    } else if (!window.confirm('Delete unpaid order ' + label + ' (' + fmtR(amount) + ')?\n\n' +
      'This permanently removes it from Firestore.')) {
      return;
    }
    window.dbDeleteDoc(window.dbDoc(window.db, 'orders', String(id))).then(function () {
      FIN.orders = FIN.orders.filter(function (o) { return String(o.id) !== String(id); });
      if (Array.isArray(window.adminOrders)) {
        window.adminOrders = window.adminOrders.filter(function (o) { return String(o.id) !== String(id); });
      }
      renderAll();
      if (typeof window.loadAdminOrders === 'function') {
        try { window.loadAdminOrders(); } catch (e) { /* orders tab not mounted */ }
      }
      if (typeof window.showCopyToast === 'function') window.showCopyToast('Order ' + label + ' deleted');
    }).catch(function (err) {
      alert('Could not delete the order: ' + (err.message || err));
    });
  };

  // Known costs are written to Firestore keyed by seedKey, so a re-run can
  // never duplicate a row. The finance tab seeds automatically when the ledger
  // is empty; the button stays for a manual top-up after a rules fix.
  function ledgerKey(e) {
    return String((e && (e.seedKey || e.description)) || '').trim().toLowerCase();
  }
  function missingStarterExpenses() {
    var existing = {};
    (FIN.expenses || []).forEach(function (e) { existing[ledgerKey(e)] = true; });
    return STARTER_EXPENSES.filter(function (s) { return !existing[ledgerKey(s)]; });
  }
  function writeLedgerEntries(list) {
    if (!(window.db && window.dbAddDoc && window.dbCollection)) {
      return Promise.reject(new Error('Firestore is not ready yet. Refresh the admin page and try again.'));
    }
    var createdBy = (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '';
    var today = financeToday();
    return Promise.all(list.map(function (s) {
      var doc = {
        seedKey: s.seedKey || '',
        date: s.date || today,
        dateEstimated: true,
        type: 'expense',
        category: s.category,
        description: s.description,
        amount: num(s.amount, 0),
        vatAmount: 0,
        paymentMethod: '',
        reference: '',
        notes: s.notes || 'Historical cost — exact date not recorded',
        source: 'starter-v2',
        createdAt: new Date().toISOString(),
        createdBy: createdBy
      };
      return window.dbAddDoc(window.dbCollection(window.db, 'finance_expenses'), doc).then(function (ref) {
        doc.id = ref.id;
        FIN.expenses.push(doc);
      });
    })).then(function () { return list.length; });
  }

  function autoSeedLedger() {
    if (FIN.seeding || (FIN.expenses || []).length) return Promise.resolve(0);
    if (!(window.db && window.dbAddDoc && window.dbCollection)) return Promise.resolve(0);
    var fresh = missingStarterExpenses();
    if (!fresh.length) return Promise.resolve(0);
    FIN.seeding = true;
    return writeLedgerEntries(fresh).then(function (n) {
      FIN.seeding = false;
      renderAll();
      return n;
    }).catch(function (err) {
      FIN.seeding = false;
      FIN.errors = (FIN.errors || []).concat(['Known costs could not be saved: ' + (err.message || err) +
        ' — check firestore.rules, then press "Load known costs".']);
      renderAll();
      return 0;
    });
  }

  // Manual top-up from the Expenses tab.
  window.seedStarterExpenses = function () {
    var fresh = missingStarterExpenses();
    if (!fresh.length) {
      alert('All the known costs are already in the ledger.');
      return;
    }
    var total = sum(fresh, function (s) { return s.amount; });
    if (!window.confirm('Add ' + fresh.length + ' known cost' + (fresh.length === 1 ? '' : 's') +
      ' totalling ' + fmtR(total) + '?\n\nThese are the historical purchases you listed. The exact day was never ' +
      'recorded, so each row is tagged "date est." — edit or delete any row afterwards.')) {
      return;
    }
    writeLedgerEntries(fresh).then(function (n) {
      renderAll();
      alert(n + ' cost' + (n === 1 ? '' : 's') + ' added (' + fmtR(total) + ').');
    }).catch(function (err) {
      renderAll();
      alert('Could not save the costs: ' + (err.message || err) +
        '\n\nIf this says "Missing or insufficient permissions", deploy firestore.rules.');
    });
  };


  function detectDelimiter(line) {
    var counts = { ',': (line.match(/,/g) || []).length, ';': (line.match(/;/g) || []).length, '\t': (line.match(/\t/g) || []).length };
    var best = ',';
    Object.keys(counts).forEach(function (d) { if (counts[d] > counts[best]) best = d; });
    return best;
  }

  function parseCsvRows(text) {
    var clean = String(text || '').replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var firstLine = clean.split('\n')[0] || '';
    var delim = detectDelimiter(firstLine);
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    for (var i = 0; i < clean.length; i++) {
      var ch = clean[i];
      if (inQuotes) {
        if (ch === '"') {
          if (clean[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        row.push(field); field = '';
      } else if (ch === '\n') {
        row.push(field); field = '';
        if (row.some(function (c) { return String(c).trim() !== ''; })) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
    row.push(field);
    if (row.some(function (c) { return String(c).trim() !== ''; })) rows.push(row);
    return rows;
  }

  function normHeader(v) {
    return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function findHeader(headers, names) {
    for (var i = 0; i < names.length; i++) {
      var idx = headers.indexOf(names[i]);
      if (idx !== -1) return idx;
    }
    return -1;
  }
  function parseAmountCell(v) {
    var s = String(v === undefined || v === null ? '' : v).trim();
    if (!s) return null;
    var neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /\bdr$/i.test(s);
    s = s.replace(/R/gi, '').replace(/[()\s]/g, '').replace(/(cr|dr)$/i, '').replace(/,/g, '');
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return neg ? -Math.abs(n) : n;
  }
  function mapBankRows(rows) {
    var headerIdx = -1;
    var headers = [];
    for (var i = 0; i < Math.min(rows.length, 20); i++) {
      var candidate = rows[i].map(normHeader);
      var hasDate = candidate.some(function (h) { return h.indexOf('date') !== -1; });
      var hasMoney = candidate.some(function (h) {
        return h.indexOf('amount') !== -1 || h.indexOf('debit') !== -1 || h.indexOf('credit') !== -1;
      });
      if (hasDate && hasMoney) {
        headerIdx = i;
        headers = candidate;
        break;
      }
    }
    if (headerIdx === -1) {
      return { error: 'Could not find a header row with date + amount/debit/credit columns.' };
    }
    var dateIdx = findHeader(headers, ['transactiondate', 'valuedate', 'postingdate', 'date']);
    if (dateIdx === -1) dateIdx = headers.findIndex(function (h) { return h.indexOf('date') !== -1; });
    var descIdx = findHeader(headers, ['description', 'narrative', 'transactiondescription', 'details', 'memo', 'payee']);
    if (descIdx === -1) descIdx = headers.findIndex(function (h) { return h.indexOf('description') !== -1 || h.indexOf('narrative') !== -1; });
    var amountIdx = findHeader(headers, ['amount', 'transactionamount', 'value']);
    var debitIdx = findHeader(headers, ['debit', 'debits', 'withdrawal', 'moneyout']);
    var creditIdx = findHeader(headers, ['credit', 'credits', 'deposit', 'moneyin']);
    var balanceIdx = findHeader(headers, ['balance', 'closingbalance', 'runningbalance']);
    var refIdx = findHeader(headers, ['reference', 'statementreference', 'transreference', 'chequenumber']);
    if (dateIdx === -1 || (amountIdx === -1 && debitIdx === -1 && creditIdx === -1)) {
      return { error: 'The CSV needs a date and an amount column (or debit/credit columns).' };
    }
    var out = [];
    var skipped = 0;
    for (var r = headerIdx + 1; r < rows.length; r++) {
      var row = rows[r];
      var date = parseDate(row[dateIdx]);
      if (!date) { skipped++; continue; }
      var amount = amountIdx !== -1 ? parseAmountCell(row[amountIdx]) : null;
      if (amount === null) {
        var debit = debitIdx !== -1 ? parseAmountCell(row[debitIdx]) : null;
        var credit = creditIdx !== -1 ? parseAmountCell(row[creditIdx]) : null;
        if (debit === null && credit === null) { skipped++; continue; }
        amount = num(credit, 0) - Math.abs(num(debit, 0));
      }
      out.push({
        date: toIsoDate(date),
        description: (row[descIdx] || '').trim() || 'Bank transaction',
        reference: refIdx !== -1 ? String(row[refIdx] || '').trim() : '',
        amount: Math.round(amount * 100) / 100,
        balance: balanceIdx !== -1 ? parseAmountCell(row[balanceIdx]) : null,
        type: amount >= 0 ? 'credit' : 'debit',
        source: 'csv',
        importedAt: new Date().toISOString()
      });
    }
    return { transactions: out, skipped: skipped };
  }
  function bankFingerprint(t) {
    return [t.date, String(t.description || '').toLowerCase(), num(t.amount, 0).toFixed(2),
      (t.balance === null || t.balance === undefined || t.balance === '') ? '' : num(t.balance, 0).toFixed(2)].join('|');
  }

  window.importNedbankCsv = function (event) {
    var input = event && event.target;
    var file = input && input.files && input.files[0];
    if (!file) return;
    var status = document.getElementById('financeBankImportStatus');
    function say(msg, colour) {
      if (!status) return;
      status.innerHTML = msg;
      status.style.color = colour || 'var(--fin-muted)';
    }
    if (!(window.db && window.dbAddDoc && window.dbCollection)) {
      say('Firestore is not ready. Refresh the admin page and try again.', 'var(--fin-red)');
      return;
    }
    say('Reading ' + esc(file.name) + '…', 'var(--fin-muted)');
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = mapBankRows(parseCsvRows(reader.result));
      } catch (e) {
        say('Could not parse the CSV: ' + esc(e.message || e), 'var(--fin-red)');
        return;
      }
      if (parsed.error) {
        say(esc(parsed.error), 'var(--fin-red)');
        return;
      }
      var existing = {};
      FIN.bank.forEach(function (t) { existing[bankFingerprint(t)] = true; });
      var fresh = [];
      parsed.transactions.forEach(function (t) {
        var f = bankFingerprint(t);
        if (existing[f]) return;
        existing[f] = true;
        t.sourceFile = file.name;
        fresh.push(t);
      });
      if (!fresh.length) {
        say('No new transactions — all ' + parsed.transactions.length +
          ' rows are already in the ledger.' + (parsed.skipped ? ' (' + parsed.skipped + ' rows skipped)' : ''), 'var(--fin-amber)');
        if (input) input.value = '';
        return;
      }
      say('Importing ' + fresh.length + ' of ' + parsed.transactions.length + ' rows…', 'var(--fin-muted)');
      var done = 0;
      function batch(start) {
        if (start >= fresh.length) {
          say('✓ Imported ' + fresh.length + ' transactions from ' + esc(file.name) +
            (parsed.skipped ? ' · ' + parsed.skipped + ' rows skipped' : '') + '.', 'var(--fin-green)');
          if (input) input.value = '';
          renderAll();
          return;
        }
        var slice = fresh.slice(start, start + 20);
        Promise.all(slice.map(function (t) {
          return window.dbAddDoc(window.dbCollection(window.db, 'finance_bank_transactions'), t)
            .then(function (ref) { t.id = ref.id; FIN.bank.push(t); done++; });
        })).then(function () {
          say('Imported ' + done + ' / ' + fresh.length + '…', 'var(--fin-muted)');
          batch(start + 20);
        }).catch(function (err) {
          console.error(err);
          say('Import stopped after ' + done + ' rows: ' + esc(err.message || err) +
            '<br>Check that firestore.rules has been deployed.', 'var(--fin-red)');
          renderAll();
        });
      }
      batch(0);
    };
    reader.onerror = function () {
      say('Could not read the file.', 'var(--fin-red)');
    };
    reader.readAsText(file);
  };

  window.addBankTransaction = function (event) {
    if (event) event.preventDefault();
    if (!(window.db && window.dbAddDoc && window.dbCollection)) {
      alert('Firestore is not ready yet. Refresh the admin page and try again.');
      return;
    }
    var date = document.getElementById('finBankDate').value;
    var amount = num(document.getElementById('finBankAmount').value, 0);
    var description = document.getElementById('finBankDesc').value.trim();
    var balanceRaw = document.getElementById('finBankBalance').value;
    var reference = document.getElementById('finBankRef').value.trim();
    if (!date || !description || amount === 0) {
      alert('Enter a date, description and a non-zero amount.');
      return;
    }
    var doc = {
      date: date,
      description: description,
      reference: reference,
      amount: amount,
      balance: balanceRaw !== '' ? num(balanceRaw, 0) : null,
      type: amount >= 0 ? 'credit' : 'debit',
      source: 'manual',
      importedAt: new Date().toISOString()
    };
    window.dbAddDoc(window.dbCollection(window.db, 'finance_bank_transactions'), doc)
      .then(function (ref) {
        doc.id = ref.id;
        FIN.bank.push(doc);
        ['finBankAmount', 'finBankDesc', 'finBankBalance', 'finBankRef'].forEach(function (id) {
          var f = document.getElementById(id); if (f) f.value = '';
        });
        renderAll();
      })
      .catch(function (err) {
        alert('Could not add the transaction: ' + (err.message || err));
      });
  };

  function expectedPayoutList() {
    var out = [];
    FIN.orders.filter(isPaidOrder).forEach(function (o) {
      var c = computeOrder(o);
      var p = payoutInfo(c);
      out.push({
        amount: p.amount,
        date: p.releaseDate,
        ref: o.orderId || o.reference || o.id,
        gateway: c.gateway,
        held: p.held,
        used: false
      });
    });
    return out;
  }

  function matchBankCredits(expected) {
    var map = {};
    var credits = FIN.bank.filter(function (t) { return num(t.amount, 0) > 0; })
      .slice()
      .sort(function (a, b) {
        var da = parseDate(a.date); var db = parseDate(b.date);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
      });
    credits.forEach(function (t) {
      var d = parseDate(t.date);
      if (!d) return;
      var best = null;
      expected.forEach(function (e) {
        if (e.used || e.held) return;
        var amountDiff = Math.abs(num(e.amount, 0) - num(t.amount, 0));
        var dayDiff = Math.abs((d.getTime() - e.date.getTime()) / 86400000);
        if (amountDiff <= 1 && dayDiff <= 5) {
          if (!best || amountDiff < best.amountDiff) best = { e: e, amountDiff: amountDiff, dayDiff: dayDiff };
        }
      });
      if (best) {
        best.e.used = true;
        map[t.id] = { ref: best.e.ref, gateway: best.e.gateway, amount: best.e.amount };
      }
    });
    return map;
  }

  function renderBank(range) {
    var body = document.getElementById('financeBankTableBody');
    if (!body) return;
    var expected = expectedPayoutList();
    var matches = matchBankCredits(expected);
    var rows = FIN.bank.slice().sort(function (a, b) {
      var da = parseDate(a.date); var db = parseDate(b.date);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });
    body.innerHTML = rows.length ? rows.map(function (t) {
      var m = matches[t.id];
      var amount = num(t.amount, 0);
      return '<tr><td>' + fmtDate(t.date) + '</td><td>' + esc(t.description || '') +
        '</td><td>' + esc(t.reference || '—') + '</td><td><span class="finance-pill ' +
        (t.source === 'csv' ? 'released' : 'estimate') + '">' + esc(t.source || 'manual') + '</span></td><td>' +
        (m ? '<span class="finance-pill matched">' + gatewayLabel(m.gateway) + ' ' + esc(String(m.ref).slice(0, 12)) + '</span>'
          : (amount > 0 ? '<span class="fin-small">Unmatched</span>' : '—')) +
        '</td><td class="' + moneyClass(amount) + ' fin-strong">' +
        signedR(amount) + '</td><td>' +
        (t.balance !== undefined && t.balance !== null && t.balance !== '' ? fmtR(t.balance) : '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="finance-empty">No bank transactions yet — import a CSV above.</td></tr>';

    var summary = document.getElementById('financeBankSummaryBody');
    if (summary) {
      var credits = rows.filter(function (t) { return num(t.amount, 0) > 0; });
      var debits = rows.filter(function (t) { return num(t.amount, 0) < 0; });
      var held = 0;
      var releasedUnmatched = 0;
      expected.forEach(function (e) {
        if (e.held) held += e.amount;
        else if (!e.used) releasedUnmatched += e.amount;
      });
      var s = settings();
      summary.innerHTML = [
        '<tr><td>Account</td><td class="fin-right">' + esc((s.bank && s.bank.name) || 'Nedbank') +
          (s.bank && s.bank.accountNumberMasked ? ' · ' + esc(s.bank.accountNumberMasked) : '') + '</td></tr>',
        '<tr><td>Opening balance</td><td class="fin-right">' + fmtR((s.bank && s.bank.openingBalance) || 0) + '</td></tr>',
        '<tr><td>Credits</td><td class="fin-right fin-in">' + signedR(sum(credits, function (t) { return t.amount; })) +
          ' <span class="fin-small">(' + credits.length + ')</span></td></tr>',
        '<tr><td>Debits</td><td class="fin-right fin-out">' + signedR(sum(debits, function (t) { return t.amount; })) +
          ' <span class="fin-small">(' + debits.length + ')</span></td></tr>',
        '<tr><td><strong>Current balance</strong></td><td class="fin-right fin-strong">' + fmtR(getBankBalance()) + '</td></tr>',
        '<tr><td>Gateway in hold</td><td class="fin-right fin-warn">' + fmtR(held) + '</td></tr>',
        '<tr><td>Released, not matched</td><td class="fin-right">' + fmtR(releasedUnmatched) + '</td></tr>',
        '<tr><td>Transactions</td><td class="fin-right">' + rows.length + '</td></tr>'
      ].join('');
    }
  }

  window.exportFinanceBank = function () {
    var rows = [['Date', 'Description', 'Reference', 'Source', 'Amount', 'Balance']];
    FIN.bank.slice().sort(function (a, b) {
      var da = parseDate(a.date); var db = parseDate(b.date);
      return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    }).forEach(function (t) {
      rows.push([t.date, t.description, t.reference, t.source, t.amount, t.balance]);
    });
    downloadCsv('studio-extrait-nedbank-' + financeToday() + '.csv', rows);
  };

  function setInput(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = (value === undefined || value === null) ? '' : value;
  }

  function renderOilLibrary() {
    var body = document.getElementById('financeOilLibraryRows');
    if (!body) return;
    var lib = settings().oilLibrary || [];
    body.innerHTML = lib.map(function (oil) {
      return '<tr class="finance-oil-row">' +
        '<td><input type="text" class="finance-inline-input fin-oil-name" value="' + esc(oil.name || '') + '" placeholder="Oil name"></td>' +
        '<td><input type="number" step="0.01" min="0" class="finance-inline-input fin-oil-cost" value="' +
        (oil.costPer100g === undefined || oil.costPer100g === null ? '' : esc(oil.costPer100g)) + '" placeholder="0.00"></td>' +
        '<td><button type="button" class="btn-action danger-btn" style="padding:4px 8px;" onclick="removeOilLibraryRow(this)">×</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="3" class="finance-empty">No oils yet — add Creed Aventus, Bleu de Chanel, Black Opium, etc.</td></tr>';
  }

  window.addOilLibraryRow = function () {
    var body = document.getElementById('financeOilLibraryRows');
    if (!body) return;
    if (body.querySelector('.finance-empty')) body.innerHTML = '';
    var tr = document.createElement('tr');
    tr.className = 'finance-oil-row';
    tr.innerHTML = '<td><input type="text" class="finance-inline-input fin-oil-name" placeholder="Oil name"></td>' +
      '<td><input type="number" step="0.01" min="0" class="finance-inline-input fin-oil-cost" placeholder="0.00"></td>' +
      '<td><button type="button" class="btn-action danger-btn" style="padding:4px 8px;" onclick="removeOilLibraryRow(this)">×</button></td>';
    body.appendChild(tr);
    var first = tr.querySelector('.fin-oil-name');
    if (first) first.focus();
  };

  window.removeOilLibraryRow = function (btn) {
    var tr = btn && btn.closest ? btn.closest('tr') : null;
    if (tr && tr.parentNode) tr.parentNode.removeChild(tr);
  };

  function readOilLibraryRows() {
    var body = document.getElementById('financeOilLibraryRows');
    if (!body) return settings().oilLibrary || [];
    var rows = Array.prototype.slice.call(body.querySelectorAll('tr.finance-oil-row'));
    return rows.map(function (tr, idx) {
      var name = tr.querySelector('.fin-oil-name') ? tr.querySelector('.fin-oil-name').value.trim() : '';
      var cost = tr.querySelector('.fin-oil-cost') ? num(tr.querySelector('.fin-oil-cost').value, 0) : 0;
      return {
        id: (name || 'oil-' + idx).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name: name,
        costPer100g: cost
      };
    }).filter(function (o) { return o.name; });
  }

  function renderSettings() {
    var form = document.getElementById('financeSettingsForm');
    if (!form) return;
    var s = settings();
    var c = s.costing || {};
    setInput('finEthanolPrice', c.ethanolPricePer5L);
    setInput('finEthanolVolume', c.ethanolVolumeMl);
    setInput('finDefaultOil', c.defaultOilCostPer100g);
    setInput('finBottle50', c.defaultBottleCost50);
    setInput('finBottle100', c.defaultBottleCost100);
    setInput('finBoxSingle', c.singleBoxCost);
    setInput('finDuoBox', c.duoGiftBoxCost);
    setInput('finDuoPaper', c.duoGiftPaperCost);
    setInput('finBubbleSingle', c.bubbleWrapSingleCost);
    setInput('finBubbleDuo', c.bubbleWrapDuoCost);
    setInput('finLabelBottle', c.bottleLabelCost);
    setInput('finLabelBox', c.boxLabelCost);

    var g = s.gateways || {};
    setInput('finOzowFee', g.ozow ? g.ozow.feePercent : '');
    setInput('finOzowDelay', g.ozow ? g.ozow.payoutDelayDays : '');
    setInput('finYocoFee', g.yoco ? g.yoco.feePercent : '');
    setInput('finYocoDelay', g.yoco ? g.yoco.payoutDelayDays : '');

    var vat = s.vat || {};
    setInput('finVatRate', vat.rate);
    setInput('finVatRegistered', vat.registered);

    var bank = s.bank || {};
    setInput('finBankName', bank.name);
    setInput('finBankAccountName', bank.accountName);
    setInput('finBankAccMasked', bank.accountNumberMasked);
    setInput('finBankOpening', bank.openingBalance);
    setInput('finBankOpeningDate', bank.openingBalanceDate);

    renderOilLibrary();
  }

  window.saveFinanceSettings = function (event) {
    if (event) event.preventDefault();
    var volume = num(document.getElementById('finEthanolVolume').value, 5000);
    if (volume <= 0) {
      alert('Ethanol volume must be greater than zero.');
      return;
    }
    var s = settings();
    s.costing = {
      ethanolPricePer5L: num(document.getElementById('finEthanolPrice').value, 354),
      ethanolVolumeMl: volume,
      defaultOilCostPer100g: num(document.getElementById('finDefaultOil').value, 179),
      defaultBottleCost50: num(document.getElementById('finBottle50').value, 0),
      defaultBottleCost100: num(document.getElementById('finBottle100').value, 0),
      singleBoxCost: num(document.getElementById('finBoxSingle').value, 0),
      duoGiftBoxCost: num(document.getElementById('finDuoBox').value, 0),
      duoGiftPaperCost: num(document.getElementById('finDuoPaper').value, 0),
      bubbleWrapSingleCost: num(document.getElementById('finBubbleSingle').value, 0),
      bubbleWrapDuoCost: num(document.getElementById('finBubbleDuo').value, 0),
      bottleLabelCost: num(document.getElementById('finLabelBottle').value, 0),
      boxLabelCost: num(document.getElementById('finLabelBox').value, 0)
    };
    s.gateways = {
      ozow: {
        feePercent: num(document.getElementById('finOzowFee').value, 0),
        payoutDelayDays: num(document.getElementById('finOzowDelay').value, 2)
      },
      yoco: {
        feePercent: num(document.getElementById('finYocoFee').value, 0),
        payoutDelayDays: num(document.getElementById('finYocoDelay').value, 2)
      }
    };
    s.vat = {
      registered: !!document.getElementById('finVatRegistered').checked,
      rate: num(document.getElementById('finVatRate').value, 15)
    };
    s.bank = {
      name: document.getElementById('finBankName').value.trim(),
      accountName: document.getElementById('finBankAccountName').value.trim(),
      accountNumberMasked: document.getElementById('finBankAccMasked').value.trim(),
      openingBalance: num(document.getElementById('finBankOpening').value, 0),
      openingBalanceDate: document.getElementById('finBankOpeningDate').value
    };
    s.oilLibrary = readOilLibraryRows();

    var btn = event && event.target ? event.target.querySelector('button[type="submit"]') : null;
    var oldText = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'SAVING…'; }
    window.minaraSaveCostingSettings(s)
      .then(function (saved) {
        window.minaraCostingSettings = saved;
        if (window.minaraPopulateOilSelects) window.minaraPopulateOilSelects();
        renderAll();
        alert('Finance settings saved. Every product cost and margin has been recalculated.');
      })
      .catch(function (err) {
        alert('Could not save finance settings: ' + (err.message || err) +
          '\n\nIf this says "Missing or insufficient permissions", deploy the updated firestore.rules.');
      })
      .then(function () {
        if (btn) { btn.disabled = false; btn.innerHTML = oldText; }
      });
  };


  function productPriceForSize(product, size) {
    var base = num(product.price, 0);
    var customisations = Array.isArray(product.customisations) ? product.customisations : [];
    for (var i = 0; i < customisations.length; i++) {
      var c = customisations[i] || {};
      if (String(c.size || '').toLowerCase() === String(size || '').toLowerCase()) {
        if (c.price !== undefined && c.price !== null && c.price !== '') return num(c.price, base);
        return base + num(c.priceExtra, 0);
      }
    }
    return base;
  }

  function renderProductCosts() {
    var body = document.getElementById('financeProductCostTableBody');
    if (!body) return;
    if (!FIN.products.length) {
      body.innerHTML = '<tr><td colspan="9" class="finance-empty">No products found.</td></tr>';
      return;
    }
    var lib = settings().oilLibrary || [];
    var rows = [];
    FIN.products.forEach(function (p) {
      var summary = window.minaraProductCostSummary ? window.minaraProductCostSummary(p) : {};
      var sizes = Object.keys(summary);
      if (!sizes.length) sizes = ['50ml'];
      var oilName = (p.costing && p.costing.oilName) || '';
      if (!oilName && p.costing && p.costing.oilId) {
        var found = lib.find(function (o) { return String(o.id) === String(p.costing.oilId); });
        if (found) oilName = found.name;
      }
      if (!oilName) oilName = 'Default oil';
      sizes.forEach(function (size) {
        var cost = summary[size] || window.minaraComputeLineCost(p, size);
        var price = productPriceForSize(p, size);
        var profit = price - cost.total;
        var margin = price > 0 ? (profit / price) * 100 : 0;
        var b = cost.breakdown || {};
        rows.push('<tr><td>' + esc(p.name || p.id) + '</td><td>' + esc(oilName) +
          (cost.estimatedOil ? ' <span class="finance-pill estimate">est.</span>' : '') +
          '</td><td>' + esc(size) + '</td><td>' + fmtR(price) + '</td><td class="fin-out">' + signedR(-cost.total) +
          '</td><td class="' + moneyClass(profit) + ' fin-strong">' + signedR(profit) +
          '</td><td>' + fmtPct(margin) + '</td><td class="fin-small">oil ' + fmtR(b.oil) +
          ' · ethanol ' + fmtR(b.ethanol) + ' · bottle ' + fmtR(b.bottle) + ' · box ' + fmtR(b.box) +
          ' · wrap ' + fmtR(b.bubble) + ' · labels ' + fmtR(b.labels) + '</td><td><button class="btn-action accent-btn" style="padding:4px 8px;" onclick="openFinanceEditProduct(\'' +
          esc(p.id) + '\')">Edit</button></td></tr>');
      });
    });
    body.innerHTML = rows.join('');
  }

  window.openFinanceEditProduct = function (id) {
    if (typeof window.switchTab === 'function') window.switchTab('catalog-tab');
    var tries = 0;
    var timer = setInterval(function () {
      var match = (window.minaraProducts || []).find(function (p) { return p.id === id; });
      // Wait for the Firestore-backed catalog row (it always carries a `costing` key);
      // opening the modal from a stale products.json row could erase saved cost prices.
      var ready = match && Object.prototype.hasOwnProperty.call(match, 'costing');
      if (ready && typeof window.openEditModal === 'function') {
        clearInterval(timer);
        window.openEditModal(id);
      } else if (++tries > 24) {
        clearInterval(timer);
        alert('The catalog is still loading. Open Catalog & Inventory and click Edit on the product.');
      }
    }, 250);
  };

  function initFinanceDates() {
    var today = financeToday();
    ['finExpenseDate', 'finBankDate'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.value) el.value = today;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFinanceDates);
  else initFinanceDates();
})();







