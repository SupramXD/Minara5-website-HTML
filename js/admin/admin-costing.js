// Studio Extrait - Shared Costing Engine
// PRIVATE DATA: cost prices live in Firestore (products.costing + finance_settings/main)
// and must never be written to products.json / GitHub Pages.
// Every number below is only a DEFAULT - change it in Finance > Costs & Settings.
(function () {
  'use strict';

  var STORAGE_KEY = 'minara_finance_settings_v1';

  // ═══════════════════════════════════════════════════════════════════════
  //  EDITABLE PRICING RULES  —  this is the ONLY block to edit when prices
  //  or the markup you want change. Nothing else in the code hard-codes a
  //  selling price.
  //
  //  Suggested price = unit cost ÷ (1 − targetMargin), rounded UP to roundTo.
  //  Example: cost R46.28 at 0.70 → R154.27 → rounded up to R155.
  //
  //  targetMargin keys match the packaging type used by the costing engine:
  //    single50 = 50ml bottle in its own box
  //    gift100  = 100ml bottle + R95 presentation box
  //    duo      = duo gift box (2 × 50ml bottles)
  //    custom   = anything with a manual box/packaging override
  //    none     = no packaging at all
  // ═══════════════════════════════════════════════════════════════════════
  var PRICING_RULES = {
    targetMargin: {
      single50: 0.70,   // 70% of the selling price stays as gross profit
      gift100: 0.62,    // 100ml gift costs much more to package
      duo: 0.60,        // duo box + two bottles
      custom: 0.65,
      none: 0.70
    },
    roundTo: 5,         // round suggested prices UP to the next R5 (0 = no rounding)
    goodMargin: 30,     // preview is green at or above this % margin
    warnMargin: 15      // preview is amber at or above this %, red below it
  };
  window.minaraPricingRules = PRICING_RULES;

  var DEFAULTS = {
    costing: {
      ethanolPricePer5L: 354,          // 5 litre UV ethanol base
      ethanolVolumeMl: 5000,
      defaultOilCostPer100g: 179,      // fallback when a product has no oil price yet
      defaultBottleCost50: 18,         // ESTIMATE - no 50ml bottle price supplied yet
      defaultBottleCost100: 95,        // 100ml presentation box + bottle
      singleBoxCost: 5.35,             // single-perfume box
      duoGiftBoxCost: 15,              // duo bundle gift box
      duoGiftPaperCost: 2.00,          // rigid gift paper inside the duo box (estimate)
      bubbleWrapSingleCost: 1.20,      // bubble wrap around one single box (estimate)
      bubbleWrapDuoCost: 2.20,         // bubble wrap around the bigger duo box (estimate)
      bottleLabelCost: 0.40,           // 1 label per bottle
      boxLabelCost: 0.60               // 1 label per box (duo uses only one)
    },
    oilLibrary: [
      { id: 'creed-aventus', name: 'Creed Aventus', costPer100g: 179 },
      { id: 'bleu-de-chanel', name: 'Bleu de Chanel', costPer100g: 179 },
      { id: 'ysl-black-opium', name: 'Yves Saint Laurent Black Opium', costPer100g: 162 }
    ],
    gateways: {
      ozow: { feePercent: 2.5, payoutDelayDays: 1 },
      yoco: { feePercent: 2.95, payoutDelayDays: 2 }
    },
    vat: { registered: false, rate: 15 },
    bank: {
      name: 'Nedbank',
      accountName: 'Studio Extrait',
      accountNumberMasked: '',
      openingBalance: 0,
      openingBalanceDate: ''
    }
  };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
  }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  function deepMerge(base, override) {
    var out = clone(base);
    if (!isObj(override)) return out;
    Object.keys(override).forEach(function (k) {
      var v = override[k];
      if (v === undefined) return;
      if (isObj(v) && isObj(out[k])) out[k] = deepMerge(out[k], v);
      else out[k] = clone(v);
    });
    return out;
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeCache(settings) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  window.minaraFinanceDefaults = clone(DEFAULTS);
  window.minaraCostingSettings = deepMerge(DEFAULTS, readCache() || {});

  window.minaraGetFinanceSettings = function () {
    return window.minaraCostingSettings || deepMerge(DEFAULTS, {});
  };

  window.minaraLoadCostingSettings = function (force) {
    if (window.__minaraSettingsPromise && !force) return window.__minaraSettingsPromise;
    var promise = Promise.resolve().then(function () {
      if (!(window.db && window.dbDoc && window.dbGetDoc)) {
        return window.minaraCostingSettings;
      }
      return window.dbGetDoc(window.dbDoc(window.db, 'finance_settings', 'main'))
        .then(function (snap) {
          if (snap && snap.exists && snap.exists()) {
            window.minaraCostingSettings = deepMerge(DEFAULTS, snap.data() || {});
            writeCache(window.minaraCostingSettings);
          }
          populateOilSelects();
          return window.minaraCostingSettings;
        })
        .catch(function (err) {
          console.warn('Finance settings could not be read; using cached defaults.', err);
          return window.minaraCostingSettings;
        });
    });
    window.__minaraSettingsPromise = promise;
    return promise;
  };

  window.minaraSaveCostingSettings = function (settings) {
    var merged = deepMerge(DEFAULTS, settings || {});
    merged.updatedAt = new Date().toISOString();
    window.minaraCostingSettings = merged;
    window.__minaraSettingsPromise = Promise.resolve(merged);
    writeCache(merged);
    if (!(window.db && window.dbDoc && window.dbSetDoc)) return Promise.resolve(merged);
    return window.dbSetDoc(window.dbDoc(window.db, 'finance_settings', 'main'), merged)
      .then(function () { return merged; });
  };

  window.minaraFormatRand = function (value, decimals) {
    var n = num(value, 0);
    var d = decimals === undefined ? 2 : decimals;
    try {
      return 'R' + n.toLocaleString('en-ZA', {
        minimumFractionDigits: d, maximumFractionDigits: d
      });
    } catch (e) {
      return 'R' + n.toFixed(d);
    }
  };

  function parseVolume(size) {
    var m = String(size || '').match(/(\d+)\s*ml/i);
    return m ? Number(m[1]) : 50;
  }
  window.minaraParseVolumeMl = parseVolume;

  /**
   * Suggested selling price for a unit cost, using PRICING_RULES above.
   * Returns 0 when there is no cost yet (so the field is never auto-filled blind).
   */
  window.minaraSuggestedPrice = function (unitCost, packagingType) {
    var cost = num(unitCost, 0);
    if (cost <= 0) return 0;
    var margins = PRICING_RULES.targetMargin;
    var type = margins[packagingType] === undefined ? 'custom' : packagingType;
    var margin = Math.min(num(margins[type], 0.65), 0.95);
    var raw = cost / (1 - margin);
    var step = num(PRICING_RULES.roundTo, 0);
    if (step > 0) return Math.ceil(raw / step) * step;
    return Math.round(raw * 100) / 100;
  };

  /** Suggested price for one size of a product (uses the real costing engine). */
  window.minaraSuggestedPriceFor = function (product, size) {
    var cost = window.minaraComputeLineCost(product, size);
    return window.minaraSuggestedPrice(cost.total, cost.packagingType);
  };

  /** Copies a suggested price into the base selling-price field, then refreshes the preview. */
  window.minaraApplySuggestedPrice = function (prefix, price) {
    var input = el(prefix, 'Price');
    var p = num(price, 0);
    if (!input || p <= 0) return;
    input.value = p.toFixed(2);
    window.minaraUpdateCostPreview(prefix);
  };

  function resolvePackaging(costing, volume, bundle) {
    var c = costing || {};
    var type = c.packaging && c.packaging !== 'auto'
      ? c.packaging
      : (bundle ? 'duo' : (volume >= 100 ? 'gift100' : 'single50'));
    if (['single50', 'gift100', 'duo', 'custom', 'none'].indexOf(type) === -1) type = 'custom';
    return type;
  }

  /**
   * Cost of ONE line item (a single bottle, a 100ml gift, or a whole duo bundle).
   * @param {Object} product  product document (may contain .costing)
   * @param {String} size     '50ml' | '100ml' | ...
   * @returns {Object}        { total, breakdown..., estimated }
   */
  window.minaraComputeLineCost = function (product, size) {
    var s = window.minaraGetFinanceSettings();
    var gc = s.costing;
    var p = product || {};
    var c = p.costing || {};
    var bundle = !!p.isBundle;
    var bottles = bundle ? Math.max(1, num(p.bundleSize, 2)) : 1;
    var volume = parseVolume(size || (Array.isArray(p.sizes) && p.sizes[0]) || '50ml');

    // Oil: 20% concentration by default = 10ml oil per 50ml bottle.
    var oilMlPer50 = c.oilMlPer50ml !== undefined && c.oilMlPer50ml !== null && c.oilMlPer50ml !== ''
      ? num(c.oilMlPer50ml, 10)
      : 10;
    var oilMlPerBottle = (volume / 50) * oilMlPer50;
    var ethanolMlPerBottle = Math.max(0, volume - oilMlPerBottle);

    var oilCostPer100g = (c.oilCostPer100g !== undefined && c.oilCostPer100g !== null && c.oilCostPer100g !== '')
      ? num(c.oilCostPer100g, 0)
      : num(gc.defaultOilCostPer100g, 0);
    var oil = (oilCostPer100g / 100) * oilMlPerBottle * bottles;
    var ethanol = (num(gc.ethanolPricePer5L, 354) / Math.max(1, num(gc.ethanolVolumeMl, 5000))) *
      ethanolMlPerBottle * bottles;

    var type = resolvePackaging(c, volume, bundle);
    var bottleDefault = type === 'gift100' ? gc.defaultBottleCost100 : gc.defaultBottleCost50;
    var bottlePer = (c.bottleCost !== undefined && c.bottleCost !== null && c.bottleCost !== '')
      ? num(c.bottleCost, 0)
      : num(bottleDefault, 0);
    var bottle = bottlePer * bottles;

    var box = 0;
    var bubble = 0;
    var labels = num(gc.bottleLabelCost, 0.4) * bottles;
    if (type === 'single50') {
      box = ((c.boxCost !== undefined && c.boxCost !== null && c.boxCost !== '')
        ? num(c.boxCost, 0) : num(gc.singleBoxCost, 0)) * bottles;
      bubble = num(gc.bubbleWrapSingleCost, 0) * bottles;
      labels += num(gc.boxLabelCost, 0.6) * bottles;
    } else if (type === 'gift100') {
      // The R95 100ml bottle + presentation box is the bottle component.
      bubble = num(gc.bubbleWrapSingleCost, 0) * bottles;
      labels += num(gc.boxLabelCost, 0.6) * bottles;
    } else if (type === 'duo') {
      box = (c.boxCost !== undefined && c.boxCost !== null && c.boxCost !== '')
        ? num(c.boxCost, 0)
        : num(gc.duoGiftBoxCost, 0) + num(gc.duoGiftPaperCost, 0);
      bubble = num(gc.bubbleWrapDuoCost, 0);
      labels += num(gc.boxLabelCost, 0.6); // ONE box label for the duo box
    } else if (type === 'custom') {
      box = (c.boxCost !== undefined && c.boxCost !== null && c.boxCost !== '')
        ? num(c.boxCost, 0) : 0;
      bubble = num(c.bubbleWrapCost, 0);
      labels += num(gc.boxLabelCost, 0);
    }

    var extra = num(c.extraCostPerUnit, 0);
    var total = oil + ethanol + bottle + box + bubble + labels + extra;
    total = Math.round(total * 100) / 100;

    return {
      total: total,
      packagingType: type,
      bottles: bottles,
      volume: volume,
      oilMlPerBottle: oilMlPerBottle,
      ethanolMlPerBottle: ethanolMlPerBottle,
      oilCostPer100g: oilCostPer100g,
      breakdown: {
        oil: Math.round(oil * 100) / 100,
        ethanol: Math.round(ethanol * 100) / 100,
        bottle: Math.round(bottle * 100) / 100,
        box: Math.round(box * 100) / 100,
        bubble: Math.round(bubble * 100) / 100,
        labels: Math.round(labels * 100) / 100,
        extra: Math.round(extra * 100) / 100
      },
      estimatedOil: !(c.oilCostPer100g !== undefined && c.oilCostPer100g !== null && c.oilCostPer100g !== ''),
      estimatedBottle: type !== 'gift100' &&
        !(c.bottleCost !== undefined && c.bottleCost !== null && c.bottleCost !== '')
    };
  };


  function el(prefix, suffix) {
    return document.getElementById((prefix === 'edit' ? 'editProd' : 'prod') + suffix);
  }
  window.minaraCostingField = el;

  function findOil(id) {
    var lib = window.minaraGetFinanceSettings().oilLibrary || [];
    for (var i = 0; i < lib.length; i++) {
      if (String(lib[i].id) === String(id)) return lib[i];
    }
    return null;
  }

  function populateOilSelect(prefix, selected) {
    var sel = el(prefix, 'OilSelect');
    if (!sel) return;
    var current = selected !== undefined ? selected : sel.value;
    var lib = window.minaraGetFinanceSettings().oilLibrary || [];
    var html = '<option value="">— Select oil (or leave for default) —</option>';
    lib.forEach(function (oil) {
      html += '<option value="' + String(oil.id || '') + '">' +
        String(oil.name || 'Oil').replace(/</g, '&lt;') +
        ' — ' + window.minaraFormatRand(oil.costPer100g) + '/100g</option>';
    });
    html += '<option value="custom">Custom / not listed</option>';
    sel.innerHTML = html;
    if (current) sel.value = current;
    if (!sel.value) sel.value = '';
  }

  function populateOilSelects() {
    populateOilSelect('', undefined);
    populateOilSelect('edit', undefined);
  }
  window.minaraPopulateOilSelects = populateOilSelects;

  window.minaraOnOilSelect = function (prefix) {
    var sel = el(prefix, 'OilSelect');
    var costInput = el(prefix, 'OilCost');
    var nameInput = el(prefix, 'OilName');
    if (!sel) return;
    var oil = findOil(sel.value);
    if (oil) {
      if (costInput) costInput.value = num(oil.costPer100g, 0);
      if (nameInput) nameInput.value = oil.name || '';
    } else if (sel.value === 'custom') {
      if (costInput) costInput.value = '';
      if (nameInput) { nameInput.value = ''; nameInput.focus(); }
    } else {
      if (costInput) costInput.value = '';
      if (nameInput) nameInput.value = '';
    }
    window.minaraUpdateCostPreview(prefix);
  };

  window.minaraReadCostingForm = function (prefix) {
    var sel = el(prefix, 'OilSelect');
    var oil = sel ? findOil(sel.value) : null;
    var costRaw = el(prefix, 'OilCost') ? el(prefix, 'OilCost').value.trim() : '';
    var mlRaw = el(prefix, 'OilMl') ? el(prefix, 'OilMl').value.trim() : '';
    var bottleRaw = el(prefix, 'BottleCost') ? el(prefix, 'BottleCost').value.trim() : '';
    var boxRaw = el(prefix, 'BoxCost') ? el(prefix, 'BoxCost').value.trim() : '';
    var extraRaw = el(prefix, 'ExtraCost') ? el(prefix, 'ExtraCost').value.trim() : '';
    var nameInput = el(prefix, 'OilName');
    return {
      oilId: sel && sel.value && sel.value !== 'custom' ? sel.value : '',
      oilName: oil ? oil.name : (nameInput ? nameInput.value.trim() : ''),
      oilCostPer100g: costRaw !== '' ? num(costRaw, 0) : (oil ? num(oil.costPer100g, 0) : null),
      oilMlPer50ml: mlRaw !== '' ? num(mlRaw, 10) : 10,
      packaging: el(prefix, 'Packaging') ? el(prefix, 'Packaging').value : 'auto',
      bottleCost: bottleRaw !== '' ? num(bottleRaw, 0) : null,
      boxCost: boxRaw !== '' ? num(boxRaw, 0) : null,
      extraCostPerUnit: extraRaw !== '' ? num(extraRaw, 0) : 0,
      updatedAt: new Date().toISOString()
    };
  };


  function priceForSize(product, size) {
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

  window.minaraUpdateCostPreview = function (prefix) {
    var box = el(prefix, 'CostPreview');
    if (!box) return;
    var priceInput = el(prefix, 'Price');
    var bundleInput = el(prefix, 'IsBundle');
    var bundleSizeInput = el(prefix, 'BundleSize');
    var isBundle = bundleInput ? !!bundleInput.checked : false;
    var bundleSize = bundleSizeInput ? (parseInt(bundleSizeInput.value, 10) || 2) : 2;
    var sizes = [];
    if (el(prefix, 'Size50') && el(prefix, 'Size50').checked) sizes.push('50ml');
    if (el(prefix, 'Size100') && el(prefix, 'Size100').checked) sizes.push('100ml');
    if (!sizes.length) sizes.push('50ml');

    var pseudo = {
      price: priceInput ? num(priceInput.value, 0) : 0,
      sizes: sizes,
      isBundle: isBundle,
      bundleSize: bundleSize,
      customisations: prefix === 'edit' ? (window.currentEditCustomisations || []) : [],
      costing: window.minaraReadCostingForm(prefix)
    };

    // Auto-price: when the selling price is still blank and an oil cost has been
    // entered, fill in the price calculated from PRICING_RULES. The price field
    // stays fully editable, and clearing the oil cost stops the auto-fill.
    var oilCostRaw = el(prefix, 'OilCost') ? String(el(prefix, 'OilCost').value || '').trim() : '';
    if (priceInput && oilCostRaw !== '' && !String(priceInput.value || '').trim()) {
      var seedCost = window.minaraComputeLineCost(pseudo, isBundle ? '50ml' : sizes[0]);
      var seedPrice = window.minaraSuggestedPrice(seedCost.total, seedCost.packagingType);
      if (seedPrice > 0) {
        priceInput.value = seedPrice.toFixed(2);
        pseudo.price = seedPrice;
      }
    }

    var lines = [];
    if (isBundle) {
      lines.push({ label: 'Duo bundle · ' + bundleSize + ' × ' + sizes[0], size: sizes[0], price: pseudo.price });
    } else {
      sizes.forEach(function (size) {
        lines.push({ label: size, size: size, price: priceForSize(pseudo, size) });
      });
    }

    var html = '';
    var anyEstimate = false;
    lines.forEach(function (line, index) {
      var cost = window.minaraComputeLineCost(pseudo, line.size);
      var profit = line.price - cost.total;
      var margin = line.price > 0 ? (profit / line.price) * 100 : 0;
      var colour = margin >= PRICING_RULES.goodMargin ? 'var(--success)'
        : (margin >= PRICING_RULES.warnMargin ? '#ff9f0a' : 'var(--danger)');
      if (cost.estimatedOil || cost.estimatedBottle) anyEstimate = true;
      var b = cost.breakdown;
      var suggested = window.minaraSuggestedPrice(cost.total, cost.packagingType);
      html += '<div class="cost-preview-line">' +
        '<div><strong>' + line.label + '</strong> · cost <strong>' + window.minaraFormatRand(cost.total) + '</strong>' +
        (cost.estimatedOil ? ' <span class="cost-est-tag">oil est.</span>' : '') +
        (cost.estimatedBottle ? ' <span class="cost-est-tag">bottle est.</span>' : '') + '</div>' +
        '<div style="color:' + colour + ';font-weight:700;">' + (line.price > 0
          ? window.minaraFormatRand(profit) + ' profit · ' + margin.toFixed(1) + '%'
          : 'Set a selling price to see margin') + '</div>' +
        '<div class="cost-preview-breakdown">oil ' + window.minaraFormatRand(b.oil) +
        ' + ethanol ' + window.minaraFormatRand(b.ethanol) +
        ' + bottle ' + window.minaraFormatRand(b.bottle) +
        ' + box ' + window.minaraFormatRand(b.box) +
        ' + wrap ' + window.minaraFormatRand(b.bubble) +
        ' + labels ' + window.minaraFormatRand(b.labels) +
        (b.extra ? ' + extra ' + window.minaraFormatRand(b.extra) : '') + '</div>' +
        '<div class="cost-preview-suggest">Suggested price <strong>' + window.minaraFormatRand(suggested) + '</strong>' +
        (index === 0 && suggested > 0 && Math.abs(line.price - suggested) >= 0.5
          ? ' <button type="button" class="btn-action accent-btn cost-apply-btn" onclick="minaraApplySuggestedPrice(\'' +
            prefix + '\', ' + suggested + ')">Use this price</button>'
          : '') + '</div>' +
        '</div>';
    });
    html += '<div class="cost-preview-note">Oil ' + window.minaraFormatRand(pseudo.costing.oilCostPer100g || 0) +
      '/100g · ' + (pseudo.costing.oilMlPer50ml || 10) + 'ml oil per 50ml · ethanol ' +
      window.minaraFormatRand(window.minaraGetFinanceSettings().costing.ethanolPricePer5L) + ' per 5L.' +
      ' Suggested prices come from the EDITABLE PRICING RULES block in admin-costing.js.' +
      (anyEstimate ? ' <strong>Estimates are marked — set real prices in Finance → Costs &amp; Settings.</strong>' : '') +
      '</div>';
    box.innerHTML = html;
  };

  window.minaraProductCostSummary = function (product) {
    var sizes = [];
    (Array.isArray(product.sizes) ? product.sizes : ['50ml']).forEach(function (s) {
      if (sizes.indexOf(s) === -1) sizes.push(s);
    });
    (Array.isArray(product.customisations) ? product.customisations : []).forEach(function (c) {
      if (c && c.size && sizes.indexOf(c.size) === -1) sizes.push(c.size);
    });
    var out = {};
    sizes.forEach(function (size) {
      out[size] = window.minaraComputeLineCost(product, size);
    });
    return out;
  };

  function init() {
    populateOilSelects();
    window.minaraLoadCostingSettings();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
