# Studio Extrait — Project Memory

> Token-efficient project context. Read this FIRST before editing. Update it after any structural/logic change.

## Stack
- Static HTML/CSS/JS site hosted on Firebase Hosting. Cloud Functions (Node) in `functions/`.
- Firestore used for orders, reviews, users, custom text. `functions/index.js` has a GitHub-sync callable.
- No build step — files served directly. Fonts: Gotham Narrow (Book/Bold). Currency: ZAR (`R`).

## Payments — Yoco Checkout API (replaced PayFast 2026-09-19)
- Checkout is **server-side only** (Yoco requires it; the old browser-side PayFast sandbox fallback with hardcoded merchant credentials is gone). `createYocoCheckout` (callable) POSTs `https://payments.yoco.com/api/checkouts` with `Authorization: Bearer <secret>` + `Idempotency-Key: <reference>`, saves a pending `orders/<EXTRAIT-…>` doc (`paymentGateway: "yoco"`, `stockDeducted:false`) and returns `redirectUrl`; the storefront does `window.location.href = redirectUrl` so the browser keeps `studioextrait.co.za` as the referrer (that is what Yoco matches against a verified domain).
- **Only the webhook may mark an order paid.** `yocoWebhook` (`POST /yocoWebhook`) verifies `webhook-signature` (HMAC-SHA256 of `webhook-id.webhook-timestamp.<rawBody>` with the base64-decoded `whsec_` secret, constant-time compare) → 403 on mismatch; it matches the order via `payload.metadata.orderId` (or `checkoutId`), sets `paid/status/yocoPaymentId/yocoAmountGross/yocoPaymentMethod/yocoCardScheme/yocoCardMask`, then deducts stock once. `success.html` therefore polls `verifyYocoPayment` (15 × 2 s) instead of trusting the browser callback.
- Secrets: `YOCO_TEST_SECRET_KEY` (`sk_test_…`, also the natural home for the live key later) and `YOCO_WEBHOOK_SECRET` (`whsec_…`). Public test key `pk_test_2dff1e63rrv6qKe6af44` lives in `functions/index.js` (`YOCO_PUBLIC_KEY_DEFAULT`, overridable via `YOCO_PUBLIC_KEY`). Changing a secret's *value* = `firebase functions:secrets:set NAME --data-file <file>` → redeploy functions.
- Webhook registered in the Yoco account (test mode): `sub_ngop46lJzpvsXnnuPeVuDnxB` → `https://us-central1-minara5.cloudfunctions.net/yocoWebhook`. A **live** webhook must be registered with the live secret key once live keys unlock (limit 5 webhooks/account, test+live share it).
- Deprecated aliases kept for cached pages: `createPayFastTransaction`, `createPaystackTransaction`, `payfastWebhook`, `paystackWebhook`, `verifyPayFastPayment`, `verifyPaystackPayment` all forward to the Yoco functions — delete them once no cached storefront page calls them.
- Verified end-to-end on deploy (2026-09-19): checkout creation returned `redirectUrl https://c.yoco.com/checkout/…`; a signed probe event returned `200 {"received":true,"matched":true}`; an unsigned one returned `403`; `verifyYocoPayment` returned `verified:true` for the webhook-paid doc and `pending:true` for an unpaid one (probe orders deleted afterwards).

## Yoco domain verification (pending - blockers found 2026-09-19)
- Yoco's "Verified Domains" review is manual, so the site must look like a complete, crawlable shop. Fixed in the repo: every storefront page now has `<meta name="description">` + canonical + OG tags (previously none), plus new `robots.txt` and `sitemap.xml` (previously 404 — Cloudflare injected a content-signals robots.txt instead).
- Still open (owner decisions): the header `WEBSITE IN CONSTRUCTION` badge (`.header-construction-sign`, `header.js`) is shown on every page and reads badly to a reviewer → hide/remove; there is **no Terms/Privacy page** (only Returns & Shipping + Contact); the catalog/HP grids are JS-rendered so a non-JS crawler sees no product names or prices; business registration/VAT/trading address are absent from the site; and "inspired by"/"up to 90% less than designer" positioning carries card-network replica risk despite the disclaimer on `returns-shipping.html`.
- Sites are served by Cloudflare → GitHub Pages, so a push is required for these fixes to appear on `studioextrait.co.za` (all user agents tested got HTTP 200, so no bot-blocking is in play).

## Build / Deploy
- Deploy: `firebase deploy` (hosting + functions). Rules: `firestore.rules`; config: `firebase.json`.
- **`.github/workflows/deploy.yml`**: on push to `main`, runs `firebase deploy --only hosting --project minara5 --token "${{ secrets.FIREBASE_TOKEN }}"`. This is what auto-publishes admin edits (product / Site Texts) that sync to GitHub via `syncToGithub`. Missing/invalid token → the "Deploy hosting" step fails on auth. **Setup:** run `firebase login:ci`, copy the token, add it as a repo Actions secret named `FIREBASE_TOKEN`, then re-run the failed workflow. Until then (or as a fallback) run `firebase deploy --only hosting` manually.
- Local: open HTML direct or `firebase serve`. Node is available (functions has package-lock).

## Troubleshooting (when the admin shows a sync error)
- **"GitHub sync failed: internal" popup** = the sync Cloud Function did not answer at all. The Firebase JS SDK collapses infrastructure failures (function unreachable / no CORS headers / Cloud Run 5xx) into `FunctionsError("internal", "internal")`, so a bare "internal" is NEVER about the edit itself. Diagnose with `node tools/check-functions-health.js` (probes every HTTP function; healthy = JSON callable body **or** an HTTP 401/403/405/2xx from the endpoint — a callable that validates input answers 400 + `{"error":…}` and is healthy, and `yocoWebhook`/`payfastWebhook` *should* answer 403 to a credential-free probe; `DOWN` = 404/5xx or Google's HTML error page).
- **2026-09-14 outage (verified)**: every function in project `minara5` (`syncToGithub`, `trackCourierGuyOrder`, payment callables…) returned Google Frontend's generic HTML `500 Server Error` with no CORS headers, so admins could still write to Firestore but nothing could sync to GitHub. Firebase Hosting (`studioextrait.co.za`, 200) and Firestore were fine. Cause: the project has **no active billing** — proof: `firebase deploy --only functions --project minara5` fails with `Error: Request to https://secretmanager.googleapis.com/.../secrets/GITHUB_TOKEN had HTTP Error: 403, This API method requires billing to be enabled…`, and Cloud Functions v2 runs on Cloud Run which requires the Blaze plan (hosting-only deploys still succeed). Fix: re-enable billing (Firebase console → Usage and billing → Blaze, or the URL in that error) and `firebase deploy --only functions --project minara5`, then re-run the health check.
- **Which pipeline serves the live site (verified 2026-09-15)**: `studioextrait.co.za` is **Cloudflare → GitHub Pages**, NOT Firebase Hosting (proof: `/firebase.json` and `/functions/index.js` return 200 on the custom domain but 404 on `minara5.web.app`; Pages' default `cache-control: max-age=600`; `x-github-request-id` / Fastly headers; Cloudflare rewrites asset TTLs to `max-age=14400`). Therefore **every push to `main` publishes the live site** - including the commits made by the `syncToGithub` Cloud Function and by `.github/workflows/sync-firestore-products.yml` (both produce `pages build and deployment … success` runs). `firebase deploy --only hosting` only updates `minara5.web.app`. The `.github/workflows/deploy.yml` "Deploy hosting" step fails on every push (missing/invalid `FIREBASE_TOKEN`) but that is cosmetic for customers - fix it only if `minara5.web.app` should track the repo. Because Pages/Cloudflare ignore custom cache headers, cache-busting on the live domain can only be done with versioned URLs (`?v=`, Cloudflare misses on new query strings - verified).
- **Firestore → products.json FALLBACK (works without Cloud Functions)**: `node tools/pull-firestore-to-repo.js` rebuilds `products.json` (and writes any base64 images out to `images/products/*`) straight from the world-readable Firestore `products` collection; `--check` only reports the diff. It mirrors the `saveProduct` mapping/ordering of `functions/index.js`, so both writers produce identical files (run twice → "Already in sync"). `.github/workflows/sync-firestore-products.yml` runs it every 30 min + on demand, commits the result, and additionally deploys hosting when the `FIREBASE_TOKEN` secret exists (a push made with the default `GITHUB_TOKEN` never triggers `deploy.yml`, hence the extra step). So product edits publish even while the sync function is down; Site Texts / hero / reviews still require the function (their Firestore docs are admin-read-only, so no public fallback is possible).
- **Pending data mismatch** (from the outage): Firestore `products/inspired-by-jpg-le-male`.name = `A warm day` (test rename saved 2026-09-14). It is now mirrored into `products.json` by the fallback sync — rename it in the admin (or change it in `products.json` + push) if that was only a test.
- Error reporting hardening (2026-09-14): `syncToGithub` now throws `failed-precondition` with the real reason (never the masked `internal` code), reads the `GITHUB_TOKEN` secret defensively, sets `firestore.settings({ignoreUndefinedProperties: true})` (the Admin SDK otherwise rejects the whole batch with `Cannot use "undefined" as a Firestore value` when a customisation block has no `price`), and uses `batch.set(..., {merge: true})` instead of `batch.update` for sort-order shuffling (an `update` on a product missing from Firestore aborted the save). Admin popups now go through `window.describeSyncError()` (`js/admin/admin-utils.js`), which turns `internal` into an actionable "sync service unreachable — your change IS saved in the database" message.
- **"Unsupported field value: undefined" on a product save (fixed 2026-09-15)**: `openEditModal` used to build customisation blocks with `price: undefined` whenever the Firestore block had no official price, and the Web SDK rejects `undefined` — killing the ENTIRE save (only products WITH customisation blocks were affected; empty-`customisations` products saved fine). The key is now omitted instead, and `window.stripUndefinedDeep()` (`admin-utils.js`) sanitises the product `setDoc` payloads in `handleSaveEdit`/`addProduct`. `tools/pull-firestore-to-repo.js` additionally keeps a customisation `price`/`priceExtra` that exists in `products.json` when Firestore has lost it (prints a WARNING), so an auto-sync can never silently drop a block price.
- **Image caching (fixed 2026-09-15)**: `firebase.json` gave *every* image `max-age=604800`, so a photo swapped in the admin (same file name, e.g. `images/products/<id>.webp`) stayed stale for days for all visitors and the CDN. Now `images/products/**`, `images/hero/**` and `images/second-hero/**` are served `public, max-age=0, must-revalidate` (cheap 304 revalidation), while static art keeps the long cache. On top of that, admin-editable images get a `?v=<version>` tag from the row's own Firestore `timestamp`: `window.minaraVersionedImage()` + `minaraRegisterImageVersions()` + `minaraDecorateProductImages()` in `header.js` (registered inside `loadLiveProducts()`, applied in the `applyLiveStock` hooks of `home-products.js`/`catalog-grid.js` and in `product-core.js`), and `minaraDecorateHeroImages()` for `home-hero.js` (hero/second-hero settings `timestamp`). Versioning is idempotent and covers cards, gallery, customisation thumbs, bundle picker, cart and search because the decorators rewrite the product objects. NOTE: images reach the live site through GitHub Pages (see the pipeline note above) - a push is enough, `firebase deploy` is not required for customers. The hosting-side headers only apply to `minara5.web.app`; on the custom domain Cloudflare controls TTLs, so the `?v=` versioning is what makes new photos appear immediately (Cloudflare misses on a new query string - verified).

## Data files (repo root)
- `products.json` — catalog. Fields: id, name, nameShort, price (ZAR), retailPrice (designer RRP), stock, image/image_thumb/galleryImages, customisations[], isBundle, bundleSize, sizes, status.
- `custom_text_settings.json` — admin-editable text (accordions, returns, features[6], trust_banner, footer_description).
- `hero_settings.json`, `second_hero_settings.json` — hero/logo positions.
- `popular_fragrances.json` — search reference data.

## Key modules (what lives where)
- `js/core/cart.js` — cart state; `calculateCartPricing()` is the SINGLE source for the multi-bottle discount + free-shipping; `renderCartUI()` renders the cart incl. free-delivery widget. Checkout reuses this function.
- `js/core/auth.js`, `js/core/search.js`, `js/core/cart.js` — core client modules.
- `js/home/home-products.js` — homepage best-seller cards (`buildCardHtml`); renders the `Designer R<retail>` anchor inline next to the name.
- `js/catalog/catalog-grid.js` — catalog grid cards; same retail anchor (`.product-retail-price` / `.product-inspired`).
- `js/product/product-core.js` — product page `swapContent` (title/price/retail), gallery init.
- `js/product/product-gallery.js` — `renderProductGallery` (slider, BIG image).
- `js/product/product-customisation.js` — bottle customisation picker (`renderBottleCustomisation`) — stock badges on the small selector icons (`ONLY X LEFT` / `OUT OF STOCK`).
- `js/header.js` — shared header + `applyCustomText`.
- `js/admin/` — admin console. `admin-core.js` = `switchTab`; `admin-settings.js` = hero + custom text (the "Site Texts & Policies" features tab).

## Conventions
- Price formatting: `formatPrice` (no commas), `formatRetailPrice` (commas, e.g. R2,200).
- localStorage keys: `minara_products`, `minara_custom_text`, `minara_discount_5` ("active" = 5% off), `bundle_selections_pending`.
- Card pattern: title -> type (ONLY on the bundle: `50ml extraits · you choose the scents`; singles render NO type line — `typeText` is `''`/hidden) -> inspired (`INSPIRED BY` + name) -> price block -> button. For inspired products the retail anchor renders INLINE to the right of the name (`.hp-retail-price`). This class is styled in BOTH `home.css` and `catalog.css`. Standard (non-bundle) bottles show a bundle sale in the price block: `R<p-241>` (`.sale-price`) crossed-out `R<p>` (`.original-price`).
- Cards show `ONLY {X} LEFT` / `OUT OF STOCK` badge (`.se-card-badge`) when stock <= 2 (non-bundle); the badge is a FULL-WIDTH bar across the bottom of the image (`left:0; right:0; width:100%`) with centered text.
- **No "AWAITING REVEAL" placeholder boxes** anywhere: catalog + home grids are cleared and populated only with real (Active) products; the dynamic placeholder loops and the static placeholder cards in `catalog.html`/`index.html` are removed.

## Gotchas
- `custom_text_settings.json` default titles differ from `admin-settings.js` defaults (e.g. "OLFACTORY ACCURACY" vs "97% DESIGNER ACCURACY"); `loadCustomTextSettings()` has rescue logic that may normalise/wipe stored edits.
- Multi-bottle discount = `(count-1) * 241` (equates to each extra bottle being `price - 241`, e.g. R495 → R254). Applies ONLY when NO bundle in cart and all items are standard bottles. In `addToCart`, standard (non-bundle, no `priceExtra`) bottles ALWAYS push a separate line (never merge qty) via `splitStandard`, so the R254 version shows as its own row. In the cart, ONLY the discounted (additional) bottles render the sale crossout (R495 → R254); the first full-price bottle stays plain. Product boxes (home + catalog) render the R254 crossout ONLY in the topup flow — toggled by the `topup` body class, which `catalog-grid.js` adds ONLY when the URL has `?topup=1` AND the bag holds ≥1 active item (`window.minaraCartHasItems()`), re-synced live on `minara:cart-updated` (set by the cart nudge link `catalog.html?topup=1`; CSS in `home.css`/`catalog.css` using `.js-price-empty`/`.js-bundle-price`/`.js-bundle-was`; `.js-bundle-price` is blue `#1106e8`). Nudge text = "tap to add a 2nd bottle for R{bottlePrice} + free shipping" (larger, blue price) and links to `catalog.html?topup=1`. In topup mode the bundle product is hidden (`catalog-grid.js` sets `bundleProduct=null` when `body.topup`) to reduce friction. Product box flairs use new `flairText` + `flairColor` fields (admin sets text + colour; rendered as a translucent pill at the RIGHT edge of the title row on home + catalog cards — light tinted bg via `color-mix` + opaque coloured text). `.se-card-badge` (ONLY X LEFT) is now a full-width bar across the bottom of the image with centered text.
- **Free-shipping threshold is R650 site-wide** (cart logic, checkout, homepage feature + footer text). `custom_text_settings.json`, `header.js`, `admin-settings.js` all use R650. In the cart, a standard bottle with qty > 1 (via the +1 stepper) shows a stacked price: the full-price line (R495) and a struck-through R495 → R254 discounted line (`js/core/cart.js` `displayPrice`). The product-box flair is right-aligned (`.hp-title-row`/`.product-flair-row` use `justify-content: space-between`) so it aligns with the add-to-bag / bundle button.
- Retail price is free-text (admin can type "3500+"). `header.js` exposes `normalizeRetailPrice` (string-preserving), `formatRetailLabel` (numeric → "R2,200"; free-text with `+` → "R3,500+"), and `getRetailNumber` (strips non-digits). Load paths preserve retailPrice as a string (never `Number()`-coerced, which would turn "3500+" → NaN); `product-core.js` now also shows retail on bundles as "Bundle Value". Admin inputs are `type="text"`; `functions/index.js` stores retailPrice as-is.
- Product-page stock badge is shown ONLY on the selector thumbnails (`product-customisation.js`); the big gallery image badge is disabled in `product-core.js`.
- Mobile home carousel card width is `63%` (`home.css` `.home-product-card`); a flair pill renders ONLY when **both** `flairText` AND `flairColor` are set — the `flair` field alone is a hidden gender/gift filter, not a visible pill.
- Admin "Site Texts" tab now has SEPARATE per-block publish buttons (Features, Trust Banner, Footer, Accordions, Returns). Each saves only its block via `persistCustomTextData()` (merges with existing `minara_custom_text` so it never clobbers the others) and syncs to Firestore + GitHub.
- Desktop top-header height is now **54px** (was 45px) via a `@media (min-width: 901px)` override appended to each stylesheet/page; base header stays **45px on mobile**. Homepage `.hero` (home.css) and checkout fixed offsets (`checkout.html` `.checkout-container`/`.summary-column`) were synced to 54px on desktop. Mobile home-carousel card image uses `aspect-ratio: 4/5` (portrait-ish; was 3/4 then 1/1) so the scaled-down card keeps the ADD TO BAG button in view on mobile. `.hp-inspired`/`.product-inspired` got 6px `margin-top` so the `INSPIRED BY` line sits lower. The static `second-products-logo-wrap` logo above `MAKE THEM REMEMBER` was removed (it duplicated the big floating `#logo` watermark, which was reverted back to its original scroll-lock behaviour — locks at bottom of the FIRST hero image). Desktop header text is top-aligned (`align-items: flex-start`) toward its border (not vertically centered); the slideout (mobile) menu links use `font-size: 14px` (home was 10.5px, others 12.5px).
- Storefront product cards tightened: mobile carousel card `flex: 0 0 63%` (from 45%) so ~1.5 cards show (matches competitor layout; long card titles now `white-space:nowrap`+`overflow:hidden`+`text-overflow:ellipsis` so names truncate on ONE line instead of wrapping around the flair pill); homepage section heading = single line `HOT SELLING PRODUCTS` (was `THE SCENTS THEY'LL ASK YOU ABOUT`); home mobile product image `aspect-ratio: 1/1` (boxy) so ADD TO BAG/price sit within first load; bundle gallery `.slider.bundle-slider` = `width:100%`, `aspect-ratio:10/3`, `object-fit:cover` (skinny full-width strip); card images use `object-fit: contain` (no crop — images "get smaller to fit" the box, incl. the bundle); bundle card whitespace trimmed (no empty `.hp-inspired` gap; `.hp-type`/`.product-type` `margin-bottom:3px`) so CREATE BUNDLE aligns with ADD TO BAG; bundle card copy = title `PICK ANY 2` + subtext `50ml extraits · you choose the scents` (replaces `PICK ANY 2 / 50ML` + `Extrait De Parfum`). `.hp-inspired`/`.product-inspired` margin-top now `9px`; the price + ADD TO BAG/CREATE BUNDLE row is pulled up (`.hp-price-action-row`/`.product-price-action-row` `margin-top` `auto` → `4px`; mobile `.add-to-cart` → `8px`) to remove whitespace; reviews row `margin-bottom` → `6px`. `products.json` is fetched with a `?t=Date.now()` cache-buster in `catalog-grid.js` + `home-products.js` so admin stock/edits appear without a manual cache reset. NOTE: admin->GitHub sync works (creates commits), but Firebase Hosting only updates when deployed — `FIREBASE_TOKEN` Actions secret is required for auto-deploy on push; otherwise run `firebase deploy --only hosting --project minara5` manually.
- Card-button alignment & first-load + logo fixes: all product boxes (home + catalog) pin the price/button row to the bottom of the card (`margin-top: auto` on `.hp-price-action-row` / `.product-price-action-row`), so every ADD TO BAG / CREATE BUNDLE button sits at the same height regardless of how much title/inspired text each box has. The `.se-card-badge` (ONLY X LEFT) is `position:absolute` over the thumbnail (`bottom:0`), so it never adds vertical height. Fixed the first-load layout jump: `home-products.js` injects 5 `.home-product-card.skel-card` skeleton placeholders into each homepage grid when `products` is empty (before products.json/Firestore resolves); the real cards replace them on mount, so content below no longer slides up. Second sticky logo removed: in `home-main.js` the mobile `shouldLockHero2` is forced to `false` (watermark no longer reappears after the second hero — it only locks at the bottom of the FIRST hero); the same `minara 5 transparent 2.svg` now sits statically above the "MAKE THEM REMEMBER" heading (`.second-products-logo-wrap`, black on white). Skeleton + logo CSS lives at the end of `home.css`.
- **Stock now reads live from Firestore** (source of truth): the admin writes every stock change to the Firestore `products` collection (`adjustStock`/`saveProduct`). Previously the storefront only read the deployed static `products.json`, which went stale until a redeploy — so admin edits appeared on the admin's own browser (via their `localStorage`) but not for customers, which is why stock looked "inconsistent." Added `window.loadLiveProducts()` in `header.js` (reads the `products` collection; `firestore.rules` already allow public read). `home-products.js`, `catalog-grid.js`, and `product-core.js` now override each product's `stock` (and every customisation block's `stock`) with the live Firestore value after the products.json/local load, then re-render — so stock is correct for every visitor immediately, independent of redeploys. `loadLiveProducts` uses the Firestore REST API (CORS-verified for this origin) as its primary path with a Web SDK fallback. All HTML pages now load `header.js` / `home-products.js` / `catalog-grid.js` / `product-core.js` with a `?v=20260902_1209` cache-buster so returning visitors fetch the updated JS (Firebase Hosting caches unversioned static assets, which is why earlier edits appeared stale). Price/image/name still come from `products.json` (updates on deploy); ask if you want those live too.
- Admin tabs are role-gated; `admin-auth.js` invokes the per-tab loaders.
- Homepage "Customers are saying" testimonials: section lives at the bottom of `index.html` (below the 2nd catalog / "MAKE THEM REMEMBER" scroll), rendered by `js/home/home-reviews.js` (auto-rotating single card + dots; hides entirely if no reviews). It reads `featured_reviews` from `custom_text_settings.json` (fetched fresh, falls back to `minara_custom_text` localStorage), resolves product names from `products.json`. Admin curates it via a new **⭐ Homepage Reviews** tab (`admin.html` `#featured-reviews-tab`; `js/admin/admin-featured-reviews.js` exposes `loadFeaturedReviewsAdmin`/`saveFeaturedReviews`). Save writes `featured_reviews` into `settings/custom_text` (Firestore) AND calls the existing `saveCustomText` GitHub sync so it publishes on redeploy. Reviews match by `productId|name|rating|text` composite key (no Firestore id stored).
- Shipping-day messaging unified to "1–3 days" (product page `template product.html` complimentary shipping text, homepage + `custom_text_settings.json` + `admin-settings.js` feature copy, `returns-shipping.html` + `js/pages/returns-shipping.js` + `admin-settings.js` policy). Also fixed the free-delivery message inconsistencies (`R600`→`R650`, `R645`→`R650`) in `custom_text_settings.json`. Homepage delivery box gained a small grey `(via the courier guy)` note (`.delivery-courier-note`, sibling of the description so `applyCustomText` doesn't overwrite it).
- Checkout UX: address finder relabelled "Find your address" with an "Auto-fill" pill + "just type your address" hint and placeholder "Start typing your address…"; delivery-instructions placeholder now `e.g. "leave at gate"` with a hint line. Global `.form-input::placeholder { font-style: italic; color:#9ca3af; }` added in `checkout.html` so placeholders read as examples, never as pre-filled input.
- Admin "Homepage Reviews" save bug fix: the featured-reviews table no longer embeds escaped JSON in a `data-review` attribute (which caused `JSON.parse` to throw on save). It now stores `data-index` per row and rebuilds the featured array from the loaded `allReviews` at save time; empty composite-key matching is unchanged.
- Checkout: removed `(Optional)` from the Email + Mobile number labels (both are `required`) and added a subtle hint under each: "We'll use this to keep you updated about your order."
- Product page: the hidden `.product-type-subtitle` (was `display:none`) now shows a small spaced-caps "EXTRAIT DE PARFUM" caption under the title/rating for conversion, styled minimally.
- Customisation pricing is now an **official absolute price** (admin sets the block's `price` directly, replacing "Price Extra"). If a block has `price`, product page (`product-customisation.js` `updateProductPriceDisplay`), cart `addToCart` (new `customisationPrice` arg → stores `price=flat, priceExtra=0`), gift cards (`catalog-grid.js`), and checkout all use it directly. Legacy blocks (no `price`) keep the base+`priceExtra` fallback, and the admin editor pre-fills the field with `basePrice + priceExtra` so nothing silently changes. `functions/index.js` `processedCustomisations` now persists `price`/`priceExtra` to `products.json`; Firestore `products` docs already carry `currentEditCustomisations` incl. `price`. Cart `splitStandard` is `false` for any customised option.
- Contact page: WhatsApp label is now "MESSAGE ON WHATSAPP:" (removed "MESSAGES ONLY - NO CALLS"); the intro copy now says "crafting niche designer-inspired Extraits de Parfum".
- Upsell/topup pricing is confined to the upsell catalog ONLY (never the product page). `catalog-grid.js` `initCatalog` sets `body.topup` only when the URL has `?topup=1` AND the bag holds ≥1 active item (`window.minaraCartHasItems()`, defined in `js/core/cart.js`); it re-syncs live on the `minara:cart-updated` event (dispatched from `saveAndSyncCart`), so emptying the bag immediately drops the R254 price. With an empty bag the −R241 price can NEVER render anywhere. The product page deliberately no longer shows it: the old `sessionStorage` `minara_topup` carry-over was removed from `catalog-grid.js`/`product-core.js`, and `product-customisation.js` `updateProductPriceDisplay` has no topup branch. Catalog gift/customisation cards still get the −R241 crossout via the shared `catalog-grid.js` price block (standards R495→R254, a R799 block→R558), topup-only. `body.topup` CSS rules in `home.css`/`catalog.css` remain (catalog-only in practice).
- Homepage review card: added `#homeTestimonialsInspired` line ("INSPIRED BY <brand>") resolved from the product's `name` in `home-reviews.js` (`inspiredMap`), and redesign the card slimmer/more subtle (`.home-testimonials-inner` 520px, card 500px/#fafafa/1px #ececec border, smaller quote & type, `.home-testimonials-inspired` 8.5px grey). Cache-busters bumped to `20260905` for `home.css`, `home-reviews.js`, `catalog-grid.js`, `product-core.js`, `product-customisation.js`.
- Upsell-price leak fix (2026-09-11): the −R241 "2nd bottle" price can no longer appear outside the upsell catalog or with an empty bag. Cache-busters bumped to `?v=20260911` for `header.js` (all HTML refs), `js/core/cart.js` (import inside `header.js`), `js/catalog/catalog-grid.js`, `js/product/product-core.js`, `js/product/product-customisation.js`.



- Homepage second-catalog mobile spacing: `.second-products-outer-wrap` top/bottom padding reduced to 22/24px on mobile, logo margin-bottom 6px, and the "MAKE THEM REMEMBER" header margin-bottom 16px, to close the gap under the second hero.
- Footer description rewritten (SEO / AI-entity friendly) across `custom_text_settings.json`, `header.js` `DEFAULT_FOOTER_DESCRIPTION`, and `admin-settings.js` default: leads with "STUDIO EXTRAIT — South Africa's home of premium extrait de parfum", mentions "niche-inspired clone fragrances", "20%+ concentration", "affordable luxury", and free delivery over R650.
- **Header construction sign & Hero tagline (2026-09-16)**: Added a discreet high-fashion `WEBSITE IN CONSTRUCTION` capsule badge with an animated champagne-gold dot (`.header-construction-sign`) in the header next to navigation on desktop and next to the menu icon on mobile across all storefront pages. Updated homepage hero tagline from `Extrait-grade. Up to 90% less than the designer original.` to `Extrait Grade`.




<!-- FILE_INVENTORY_START -->
```
- .firebase
- .firebaserc
- .git
- .github
- .gitignore
- AGENTS.md
- Gotham Narrow Black.otf
- Gotham Narrow Black.txt
- Gotham Narrow Black.woff
- Gotham Narrow Bold.otf
- Gotham Narrow Bold.woff
- Gotham Narrow Book.otf
- MEMORY.md
- Studio Extrait Icon Svg only logo.svg
- Studio Extrait Icon Svg.svg
- Zurich Ultra Black Extended Regular.otf
- admin.css
- admin.html
- cancel.html
- cart.svg
- cart_green.svg
- catalog.css
- catalog.html
- checkout.html
- contact.html
- css/product/product-bundle.css
- css/product/product-layout.css
- css/product/product-reviews.css
- custom_text_settings.json
- firebase.json
- firestore.rules
- head shoulder.svg
- header.js
- hero_settings.json
- home.css
- images.json
- index.html
- js/admin/admin-analytics.js
- js/admin/admin-auth.js
- js/admin/admin-core.js
- js/admin/admin-featured-reviews.js
- js/admin/admin-notifications.js
- js/admin/admin-orders.js
- js/admin/admin-products.js
- js/admin/admin-reviews.js
- js/admin/admin-settings.js
- js/admin/admin-users.js
- js/admin/admin-utils.js
- js/catalog/catalog-grid.js
- js/core/auth.js
- js/core/cart.js
- js/core/search.js
- js/home/home-hero.js
- js/home/home-main.js
- js/home/home-products.js
- js/home/home-reviews.js
- js/pages/returns-shipping.js
- js/product/product-bundle.js
- js/product/product-core.js
- js/product/product-customisation.js
- js/product/product-gallery.js
- js/product/product-reviews.js
- menu.svg
- minara 5 transparent 2.svg
- minara 5 transparent.svg
- popular_fragrances.json
- product.css
- products.json
- question mark.svg
- returns-shipping.html
- reviews.json
- robots.txt
- second_hero_settings.json
- sitemap.xml
- skills-lock.json
- social media.html
- socials.svg
- success.html
- template product.html
- track-order.html
- track.svg
- validate-site.js
```
<!-- FILE_INVENTORY_END -->

## How to keep this fresh
- Read this file at the start of every session; reuse it instead of re-opening everything.
- Update the relevant section above when you change structure or logic.
- Run `node tools/update-memory.js` to refresh the auto-generated inventory block.
