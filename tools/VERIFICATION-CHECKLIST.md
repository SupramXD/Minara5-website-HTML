# Verification / compliance copy - what changed and what must still be done

This folder is a compliance variant of the Studio Extrait website, prepared so that the site
reads as a complete, independent South African fragrance retailer for the Yoco **Verified
Domains** review (and for any other payment gateway or card-network review).

## 1. Copy: no third-party brand references, no "clone" positioning

* Product ids, names and descriptions are brand-free: `profile-a-warm-day` (A Warm Day /
  Caribbean), `profile-wild-bergamot` (A Bright Green Day / Wild Bergamot), `profile-the-bouquet`
  (A Rose Garden Evening / The Bouquet) and the `any-2-50ml-fragrances` bundle.
* The card / product / cart / review label that used to read "INSPIRED BY <brand>" now reads
  "SCENT PROFILE <descriptor>".
* All designer-RRP comparison pricing is gone: `retailPrice` is null for every product, and the
  product page label is "Comparable Retail" with "Save X% off comparable retail pricing".
* The old designer-brand reference dataset `popular_fragrances.json` is now an empty array, so the
  search drawer can never surface another brand's name. The search "request a formulation" flow is
  now "REQUEST THIS SCENT" and stores the customer's own query.
* Wording was rewritten across `custom_text_settings.json`, `js/admin/admin-settings.js`,
  `header.js`, `index.html`, `contact.html`, `returns-shipping.html`, `product.html` and the
  `honestComparison*` / trust-banner / footer copy.
* `studio-extrait-clone-fragrances.avif` hero assets were copied to
  `studio-extrait-extrait-fragrances*` and every reference updated (the old files are kept so any
  stale Firestore hero path still resolves).

## 2. Policy pages (new) and legal disclosure

* `about.html` - who we are, how the extraits are made, business details (trading name, email,
  WhatsApp, trading address line, service hours), payments via Yoco, delivery via The Courier Guy.
* `terms.html` - 13 clauses: agreement, products, pricing/payment/security, orders, delivery,
  returns, defective goods (CPA s56), liability, brand independence and IP, POPIA reference,
  ECTA electronic records, governing law (National Consumer Commission / CGSO), changes.
* `privacy.html` - POPIA policy: information collected, purpose, payment handling (card data never
  stored, Yoco), sharing (Yoco, Courier Guy, Firebase/Google Cloud, Cloudflare), cookies/local
  storage, retention, data-subject rights, security, children, marketing, complaints (Information
  Regulator contact details).
* `returns-shipping.html` disclaimer rewritten to describe scent families only, with no claim of
  association with any brand owner.
* All pages link ABOUT / TERMS / PRIVACY in the footer and in the slideout menu.

## 3. Structure / crawler fixes

* The "WEBSITE IN CONSTRUCTION" header badge was removed from every page.
* Product pages are now served from `product.html`; `template product.html` is a no-index redirect
  stub so old links keep working.
* `sitemap.xml` lists the home page, catalogue, the four product URLs and every policy page.
* `robots.txt` allows public pages and excludes `admin.html`, `js/admin/`, `functions/`, `tools/`,
  `input/`, `output/`, `MEMORY.md` and `AGENTS.md`.
* The `accountorder.html` account-dropdown link (a page that never existed) now points to
  `track-order.html`.
* Business email `jadon@studioextrait.co.za` is used on the contact page, footer and every policy.
* `MEMORY.md` was rewritten to remove internal commentary and any product/verification detail that
  should not be public.

## 4. Durability: update Firestore too, or the live site will revert

The storefront text and products can be served from Firestore (admin panel). To keep this copy
authoritative:

1. The 30-minute `sync-firestore-products.yml` schedule is disabled in this variant (manual run
   only), so `products.json` will not be overwritten automatically.
2. In the admin panel, either update or clear these Firestore values so they match this copy:
   * **Products**: names, ids and descriptions (and remove the `retailPrice` values).
   * **Site Texts**: the four homepage features, the trust banner and the footer description.
   * **Accordions**: `honestComparisonInspired` and `honestComparisonNonInspired`.
   * **Returns & Shipping policy text**: the three sections plus the support prompt.
   * **Homepage Reviews**: the featured review's product id (`profile-wild-bergamot`).
3. Do not use the admin Products / Site Texts editors until those values have been updated, because
   saving there pushes the Firestore values back into the repo through `syncToGithub`.

## 5. Before re-submitting the domain to Yoco

1. Push this copy to the site repo (or copy the changed files into it) and confirm the live pages
   render: home page, catalogue, all four product pages, about, terms, privacy, returns, contact,
   checkout -> Yoco test payment -> success page.
2. Replace the placeholders that are specific to the business: the trading address line in
   `about.html` / `terms.html` and (if registered) the company registration number and VAT status.
3. Re-run `node tools/check-functions-health.js` if the checkout ever fails, and keep the Yoco
   webhook (`/yocoWebhook`) registered and reachable.
4. In the Yoco App, re-submit `https://studioextrait.co.za` under Checkout API -> Verified Domains.
5. Record a test payment with the Yoco test card so the reviewer can see a working Yoco checkout.
