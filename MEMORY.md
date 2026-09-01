# Studio Extrait — Project Memory

> Token-efficient project context. Read this FIRST before editing. Update it after any structural/logic change.

## Stack
- Static HTML/CSS/JS site hosted on Firebase Hosting. Cloud Functions (Node) in `functions/`.
- Firestore used for orders, reviews, users, custom text. `functions/index.js` has a GitHub-sync callable.
- No build step — files served directly. Fonts: Gotham Narrow (Book/Bold). Currency: ZAR (`R`).

## Build / Deploy
- Deploy: `firebase deploy` (hosting + functions). Rules: `firestore.rules`; config: `firebase.json`.
- **`.github/workflows/deploy.yml`**: on push to `main`, runs `firebase deploy --only hosting --project minara5 --token "${{ secrets.FIREBASE_TOKEN }}"`. This is what auto-publishes admin edits (product / Site Texts) that sync to GitHub via `syncToGithub`. Missing/invalid token → the "Deploy hosting" step fails on auth. **Setup:** run `firebase login:ci`, copy the token, add it as a repo Actions secret named `FIREBASE_TOKEN`, then re-run the failed workflow. Until then (or as a fallback) run `firebase deploy --only hosting` manually.
- Local: open HTML direct or `firebase serve`. Node is available (functions has package-lock).

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
- Multi-bottle discount = `(count-1) * 245` (equates to each extra bottle being `price - 245`, e.g. R495 → R250). Applies ONLY when NO bundle in cart and all items are standard bottles. In `addToCart`, standard (non-bundle, no `priceExtra`) bottles ALWAYS push a separate line (never merge qty) via `splitStandard`, so the R250 version shows as its own row. In the cart, ONLY the discounted (additional) bottles render the sale crossout (R495 → R250); the first full-price bottle stays plain. Product boxes (home + catalog) render the R254 crossout ONLY in the topup flow — toggled by the `topup` body class, which `catalog-grid.js` adds when the URL has `?topup=1` (set by the cart nudge link `catalog.html?topup=1`; CSS in `home.css`/`catalog.css` using `.js-price-empty`/`.js-bundle-price`/`.js-bundle-was`; `.js-bundle-price` is blue `#1106e8`). Nudge text = "tap to add one more bottle for R{bottlePrice} + free shipping" (larger, blue price) and links to `catalog.html?topup=1`. In topup mode the bundle product is hidden (`catalog-grid.js` sets `bundleProduct=null` when `body.topup`) to reduce friction. Product box flairs use new `flairText` + `flairColor` fields (admin sets text + colour; rendered as a translucent pill at the RIGHT edge of the title row on home + catalog cards — light tinted bg via `color-mix` + opaque coloured text). `.se-card-badge` (ONLY X LEFT) is now a full-width bar across the bottom of the image with centered text.
- **Free-shipping threshold is R650 site-wide** (cart logic, checkout, homepage feature + footer text). `custom_text_settings.json`, `header.js`, `admin-settings.js` all use R650. In the cart, a standard bottle with qty > 1 (via the +1 stepper) shows a stacked price: the full-price line (R495) and a struck-through R495 → R254 discounted line (`js/core/cart.js` `displayPrice`). The product-box flair is right-aligned (`.hp-title-row`/`.product-flair-row` use `justify-content: space-between`) so it aligns with the add-to-bag / bundle button.
- Retail price is free-text (admin can type "3500+"). `header.js` exposes `normalizeRetailPrice` (string-preserving), `formatRetailLabel` (numeric → "R2,200"; free-text with `+` → "R3,500+"), and `getRetailNumber` (strips non-digits). Load paths preserve retailPrice as a string (never `Number()`-coerced, which would turn "3500+" → NaN); `product-core.js` now also shows retail on bundles as "Bundle Value". Admin inputs are `type="text"`; `functions/index.js` stores retailPrice as-is.
- Product-page stock badge is shown ONLY on the selector thumbnails (`product-customisation.js`); the big gallery image badge is disabled in `product-core.js`.
- Mobile home carousel card width is `63%` (`home.css` `.home-product-card`); a flair pill renders ONLY when **both** `flairText` AND `flairColor` are set — the `flair` field alone is a hidden gender/gift filter, not a visible pill.
- Admin "Site Texts" tab now has SEPARATE per-block publish buttons (Features, Trust Banner, Footer, Accordions, Returns). Each saves only its block via `persistCustomTextData()` (merges with existing `minara_custom_text` so it never clobbers the others) and syncs to Firestore + GitHub.
- Desktop top-header height is now **54px** (was 45px) via a `@media (min-width: 901px)` override appended to each stylesheet/page; base header stays **45px on mobile**. Homepage `.hero` (home.css) and checkout fixed offsets (`checkout.html` `.checkout-container`/`.summary-column`) were synced to 54px on desktop. Mobile home-carousel card image uses `aspect-ratio: 4/5` (portrait-ish; was 3/4 then 1/1) so the scaled-down card keeps the ADD TO BAG button in view on mobile. `.hp-inspired`/`.product-inspired` got 6px `margin-top` so the `INSPIRED BY` line sits lower. The static `second-products-logo-wrap` logo above `MAKE THEM REMEMBER` was removed (it duplicated the big floating `#logo` watermark, now forced always-visible in home.css; colour stays adaptive — white over the hero via default `invert(100%)`, black over white sections via JS `.locked-white-zone`). Desktop header text is top-aligned (`align-items: flex-start`) toward its border (not vertically centered); the slideout (mobile) menu links use `font-size: 14px` (home was 10.5px, others 12.5px).
- Storefront product cards tightened: mobile carousel card `flex: 0 0 63%` (from 45%) so ~1.5 cards show (matches competitor layout; long card titles now `white-space:nowrap`+`overflow:hidden`+`text-overflow:ellipsis` so names truncate on ONE line instead of wrapping around the flair pill); homepage section heading = single line `HOT SELLING PRODUCTS` (was `THE SCENTS THEY'LL ASK YOU ABOUT`); home mobile product image `aspect-ratio: 1/1` (boxy) so ADD TO BAG/price sit within first load; bundle gallery `.slider.bundle-slider` = `width:100%`, `aspect-ratio:10/3`, `object-fit:cover` (skinny full-width strip); card images use `object-fit: contain` (no crop — images "get smaller to fit" the box, incl. the bundle); bundle card whitespace trimmed (no empty `.hp-inspired` gap; `.hp-type`/`.product-type` `margin-bottom:3px`) so CREATE BUNDLE aligns with ADD TO BAG; bundle card copy = title `PICK ANY 2` + subtext `50ml extraits · you choose the scents` (replaces `PICK ANY 2 / 50ML` + `Extrait De Parfum`). `.hp-inspired`/`.product-inspired` margin-top now `9px`; the price + ADD TO BAG/CREATE BUNDLE row is pulled up (`.hp-price-action-row`/`.product-price-action-row` `margin-top` `auto` → `4px`; mobile `.add-to-cart` → `8px`) to remove whitespace; reviews row `margin-bottom` → `6px`. `products.json` is fetched with a `?t=Date.now()` cache-buster in `catalog-grid.js` + `home-products.js` so admin stock/edits appear without a manual cache reset. NOTE: admin->GitHub sync works (creates commits), but Firebase Hosting only updates when deployed — `FIREBASE_TOKEN` Actions secret is required for auto-deploy on push; otherwise run `firebase deploy --only hosting --project minara5` manually.
- Admin tabs are role-gated; `admin-auth.js` invokes the per-tab loaders.

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
- second_hero_settings.json
- skills-lock.json
- social media.html
- socials.svg
- success.html
- template product.html
- track-order.html
- track.svg
```
<!-- FILE_INVENTORY_END -->

## How to keep this fresh
- Read this file at the start of every session; reuse it instead of re-opening everything.
- Update the relevant section above when you change structure or logic.
- Run `node tools/update-memory.js` to refresh the auto-generated inventory block.
