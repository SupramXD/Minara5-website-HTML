# Studio Extrait — Project Memory

> Token-efficient project context. Read this FIRST before editing. Update it after any structural/logic change.

## Stack
- Static HTML/CSS/JS site hosted on Firebase Hosting. Cloud Functions (Node) in `functions/`.
- Firestore used for orders, reviews, users, custom text. `functions/index.js` has a GitHub-sync callable.
- No build step — files served directly. Fonts: Gotham Narrow (Book/Bold). Currency: ZAR (`R`).

## Build / Deploy
- Deploy: `firebase deploy` (hosting + functions). Rules: `firestore.rules`; config: `firebase.json`.
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
- Card pattern: title -> type -> inspired (`INSPIRED BY` + name) -> price block -> button. For inspired products the retail `R<retail>` anchor is rendered INLINE after the name (styled via `.hp-retail-price`); for bundles/other products it stays as a standalone `Value`/`R` anchor.
- Cards show `ONLY {X} LEFT` / `OUT OF STOCK` badge (`.se-card-badge`) when stock <= 2 (non-bundle).

## Gotchas
- `custom_text_settings.json` default titles differ from `admin-settings.js` defaults (e.g. "OLFACTORY ACCURACY" vs "97% DESIGNER ACCURACY"); `loadCustomTextSettings()` has rescue logic that may normalise/wipe stored edits.
- Multi-bottle discount = `(count-1) * 241` only when NO bundle in cart and all items are standard bottles (premium/`priceExtra` items are excluded as bundles). Cart free-delivery widget is in `cart.js renderCartUI`; its "add 1 more bottle" nudge links to `catalog.html`.
- **Free-shipping threshold is R700 site-wide** (cart logic, checkout, product complimentary-shipping line, homepage feature + footer text). `custom_text_settings.json`, `header.js`, `admin-settings.js` all use R700.
- Product-page stock badge is shown ONLY on the selector thumbnails (`product-customisation.js`); the big gallery image badge is disabled in `product-core.js`.
- Admin tabs are role-gated; `admin-auth.js` invokes the per-tab loaders.

<!-- FILE_INVENTORY_START -->
```
- .firebase
- .firebaserc
- .git
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
