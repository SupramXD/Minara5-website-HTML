# Verification / compliance copy - what changed and what must still be done

This folder is a compliance variant of the Studio Extrait website, prepared so that the site
reads as a complete, independent South African fragrance retailer for the Yoco **Verified
Domains** review (and for any other payment gateway or card-network review).

## 1. Copy: no third-party brand references, no "clone" positioning

* Product ids, names and descriptions are brand-free: `profile-a-warm-day` (A Warm Day /
  Caribbean), `profile-wild-bergamot` (A Bright Green Day / Wild Bergamot), `profile-the-bouquet`
  (A Rose Garden Evening / The Bouquet) and the `any-2-50ml-fragrances` bundle.
* The card / product / cart / review line still reads **"INSPIRED BY …"** exactly as before, but what follows it is our own brand-free descriptor taken from the product's `name` field ("Inspired by A Warm Day" → shows "INSPIRED BY A WARM DAY"). The product title is unchanged: it stays the fragrance's own theme/short name (`Caribbean`, `Wild Bergamot`, `The Bouquet`), so nothing was moved onto the title.
* The product page **"Honest Comparison" accordion can never claim a match with another house**, and it does not claim that we author every scent signature either. `product-core.js` ignores any stored value containing a brand placeholder, "designer", "similarity index" or "olfactory profile", and falls back to: *"Blended in South Africa in small batches from premium imported oils at a dense 20%+ extrait concentration, then macerated for even, long wear. Expect 8-12 hours of longevity and strong projection, without the luxury brand premium."* The admin labels in `product.html` / `admin.html` were retargeted accordingly.
* The **Product & Brand Disclaimer** on the Returns & Shipping page (and the same default in `custom_text_settings.json`, `js/pages/returns-shipping.js` and `js/admin/admin-settings.js`) no longer mentions "inspired" fragrances or scent-reference framing at all - it states that Studio Extrait is an independent label, that we are not affiliated with any other house, and that our names/designs/photography are ours.
* **One return-fee story everywhere (corrected 22 Sep 2026):** returns and exchanges quote the **standard courier rate of R120 per leg** - exchange R120 x 2 = R240, refund R120 deducted - because the R85 is only the owner's discounted delivery rate. `about.html`, `terms.html`, the returns page and all three data sources (`custom_text_settings.json`, `js/pages/returns-shipping.js`, `js/admin/admin-settings.js`) state the same figures, and the returns page adds a one-line note distinguishing the R120 return rate from the R85 delivery rate.
* The privacy policy ends at section 7 ("Your Rights & Contact"): the former "Contact & Complaints" block and the Information Regulator contact details were **removed on purpose** - do not reintroduce them.
* **Policy pages trimmed to the essentials**: `about.html` 5 blocks, `terms.html` 8 clauses, `privacy.html` 7 clauses - plainer wording, no fixed response deadlines, no replicated "children" block.
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

## 6. Firestore/admin protection (added 22 Sep 2026)

The admin panel (Site Texts / Returns policy editors) writes straight back into `custom_text_settings.json`
through `syncToGithub`, and it did exactly that on 22 Sep 2026 at 10:09 - the stored Firestore text
reverted the compliance copy in that file (old "Trusted Clone Brand" banner, `{brand}` comparison text,
"inspired by" disclaimer). Two layers now stop that from reaching the page:

1. **Client-side filter** - `window.minaraComplianceOk()` in `header.js` and `compliant()` in
   `js/pages/returns-shipping.js` reject any stored text containing brand or comparison wording (the brand
   placeholder, "designer", "clone", "dupe", "replica", "counterfeit", "knock-off", "match", "similarity
   index", "olfactory profile", "inspir", "payfast"), so the reviewed static copy stays on screen no matter
   what Firestore holds. The homepage features, footer description and all three returns-policy sections are
   covered.
2. **Repo safety net** - if an admin save rewrites `custom_text_settings.json` or `products.json` again,
   restore the reviewed versions with:

   ```
   git checkout HEAD -- custom_text_settings.json products.json
   ```

   (or `git checkout <compliance-commit> -- <file>`), then push. The 30-minute Firestore sync workflow is
   disabled in this variant, so only a manual admin save can do it.

## 7. Before re-submitting the domain to Yoco

1. Push this copy to the site repo (or copy the changed files into it) and confirm the live pages
   render: home page, catalogue, all four product pages, about, terms, privacy, returns, contact,
   checkout -> Yoco test payment -> success page.
2. Replace the placeholders that are specific to the business: the trading address line in
   `about.html` / `terms.html` and (if registered) the company registration number and VAT status.
3. Re-run `node tools/check-functions-health.js` if the checkout ever fails, and keep the Yoco
   webhook (`/yocoWebhook`) registered and reachable.
4. In the Yoco App, re-submit `https://studioextrait.co.za` under Checkout API -> Verified Domains.
5. Record a test payment with the Yoco test card so the reviewer can see a working Yoco checkout.
6. **Two gateways are live on `checkout.html`:** choosing "Pay by card" and continuing pays through
   Yoco, choosing "EFT" and continuing pays through Ozow. Both are created server-side
   (`createYocoCheckout` / `createOzowCheckout`) and both webhooks (`/yocoWebhook`, `/ozowWebhook`)
   must stay registered. The step is **select, then continue**: the two rows only choose (radio
   semantics - nothing is charged, submitted or redirected by the tap itself) and the one lime
   **"Continue to Yoco" / "Continue to Ozow"** button is the action, so the browser's own
   required-field validation runs before any redirect. Each row carries the mark of the gateway that
   will process it (`.payment-tile-brands`: the Yoco chip on "Pay by card", the Ozow chip on
   "EFT" AND on "Capitec Pay" - Ozow processes that rail too) **and shows what it accepts as
   badges rather than as a sentence** - the "Pay by card" row's
   `Visa · Mastercard · Google Pay · Apple Pay` text line became `.payment-tile-badges`, the same
   20px `.pay-badge` chips used everywhere else, the "Capitec Pay" row carries the official Capitec
   symbol plus the type-drawn "Capitec Pay" chip there, and the "EFT" row carries the
   type-drawn bank chip to the LEFT of its own label (2026-10-13 pass 3). The accepted-marks strip
   that used to sit inside the ONE **"Secure payment"** trust card was **removed on 2026-10-15**
   together with its `.pay-brands*` CSS - that card is now the lock icon + title + one short sentence
   ("Payments go through Yoco and Ozow - your card and banking details never reach us."), because the
   marks already ride on the very rows the customer is choosing between. Never redraw or
   re-crop those assets by hand (`capitec.svg` is the single deliberate exception: its `viewBox` was
   cropped around the symbol because the full lockup's wordmark is a smudge at badge size - see MEMORY),
   keep the brand-blue
   `yoco-blue.svg` on the white chips, and do **not** re-add a floating legend strip above the rows
   (that was `.pay-brands-legend`), gateway badges inside a trust-card head (that was
   `.pay-badge-head`) or a marks strip inside a trust card (that was `.pay-brands`, deleted with the
   strip on 2026-10-15) - each was removed because it duplicated the row marks and made
   the summary column read as clutter. The "Free Express Shipping" card is only rendered when the order
   really does ship free.
   **Free shipping is shown as a saving (2026-10-14):** the R85 stays on the SHIPPING row - checkout
   summary AND bag drawer - struck through in grey `#9ca3af` next to `FREE` in the site's money-blue
   `#1106e8`, and that card now reads "The Courier Guy door-to-door delivery with tracking - the R85
   fee is on us". Never reduce a free-shipping line back to a bare "FREE".
   **The bag drawer's strip is a sized-down exception to the 20px badge rule**: the drawer is `85vw`
   wide, so a 320px viewport leaves 231px of marks. There the card chips are 18px and the two Ozow
   rails 17px (see MEMORY), which is what fits "EFT" and "Capitec Pay" next to their processor
   marks in three lines. Verify a strip change with the harness recipe - render the drawer's real
   markup in a 231px box and read widths/`offsetTop` back with `--dump-dom` - not by eye.
   **Capitec Pay is refused honestly until Ozow enables it**: `createOzowCheckout` probes the rail
   server-side (`probeOzowBankMethod`) because Ozow answers `200` + a session URL for a method the
   account is not enabled for and only refuses it inside the payer session, which the storefront
   cannot read. Never remove that gate: without it a Capitec Pay tap lands on Ozow's generic bank
   picker. Check the rail live with `node tools/ozow-live-rail-check.js` (no secrets needed).
6b. (2026-10-13 pass 3) **The hosted session is created before the customer clicks Continue**, so the
   hand-off to Yoco/Ozow does not have to wait for a cold Cloud Function plus the gateway's own API
   call: `showAddressFilledNote()` (no input event from autofill), a typed `input`/`change`, choosing a
   row, hovering/focusing `#payBtn` and the post-draft-restore all schedule `warmPaymentSession()`, which
   only fires once `checkoutFormIsReady()` (native `checkValidity()` AND a value in `c_street`/`c_city`/
   `c_postal`/`c_province`, because a hidden lookup-first form has no `required` address inputs). The
   click reuses that session only when `gatewayWarmKey(gateway, payload)` still matches, so never assume
   the warm-up is a caching layer that can be "improved" by loosening the key - a stale key means the
   customer is charged the wrong amount. Because every warm-up leaves a pending/abandoned entry in the
   Yoco/Ozow dashboard, keep the gate on a COMPLETE form; if the dashboard noise ever becomes a problem,
   the warm-up is the thing to remove, not the fingerprint check. `firebase-functions.js` is
   `modulepreload`ed and imported at page speed (never again inside the submit handler), and
   `us-central1-minara5.cloudfunctions.net`, `https://pay.ozow.com` and `https://c.yoco.com` are
   preconnected. **Pass 4 (see 6c) moved that reuse into a per-gateway map and debounces the typed
   `input`/`change` at 400ms.**
6c. (2026-10-13 pass 4) **A phone back button from the gateway must land on a working checkout, and
   the pre-warm must cover the gateway the customer actually taps.** The browser keeps checkout.html in
   the back/forward cache while the gateway owns the screen, so `history.back()` RESTORES the DOM as it
   was left - both rows and `#payBtn` still `disabled`, "Securing your ... payment..." still spinning -
   and no script re-runs, so a `pageshow`/`popstate`/`visibilitychange` path is the only way back to a
   usable page: `window.resetPaymentHandoff()` unlocks it, drops every warm session
   (`forgetWarmSessions()` - a session the customer was already handed may be open on the gateway's
   side, so it is never reused) and re-warms immediately. It prints a NEUTRAL note ("Payment page
   closed. Your details are still here.") and must stay neutral: the same path also runs after a back
   from `success.html`. It is idempotent and only the FIRST call may touch the status line (a BFCache
   restore fires `visibilitychange` and `pageshow` for one return), and the 8s watchdog unlocks the same
   way only while the document is still `visible`, because a merely-slow navigation hides it. Warm
   sessions are a map (`window.__payWarm`, at most one record per gateway, keyed by
   `gatewayWarmKey`), and `PAY_WARM_EVERY_GATEWAY` warms the chosen rail and then every other rail in
   `GATEWAY_ORDER` 400ms apart (it was `PAY_WARM_BOTH_GATEWAYS` until the third rail made "both" wrong),
   so "tap EFT, then Continue" is instant too. `#payStatus` now goes up on EVERY click
   (the old 400ms delay is gone: the gateway's own page takes 0.2-0.9s to answer while this page is
   still on screen). Also keep `saveCheckoutDraft()`'s `checkoutDraftRestored` gate - a save before
   `restoreCheckoutDraft()` has run snapshots an EMPTY form and destroys the very draft the customer is
   coming back for. Measured on the live project in test mode (2026-10-13): `createYocoCheckout`
   **3.6s cold / 1.2s warm**, `createOzowCheckout` **5.6s cold / 0.9-1.4s warm**, while a click with a
   standing session hands the browser the URL in **~0.03s** (the same click waits the full 1.2s with the
   warm-up switched off); `c.yoco.com` TTFB 0.83-0.89s (`no-store`), `pay.ozow.com` 0.19-0.57s.
   `checkout.html?paytimer=1` prints those stops (warm/ready/click/session-ok/redirect-set/back) on the
   customer's own device - that, not a laptop on fibre, is the only honest place to read them. Never
   claim "8s -> 1s"; the claim is "the wait that was ours is gone".
7. If Ozow's own page shows its red **"System error"** screen, that is Ozow's front end failing on
   Ozow's own API - not our integration (full evidence in MEMORY.md). Confirm it with
   `firebase functions:log --only ozowWebhook`: Ozow still posts a *signed* notification for that
   transaction, and its `Status` / `TransactionId` say exactly what happened. Quote those to Ozow
   support if it repeats.
8. A cancelled or failed payment must never cost the customer their details: `checkout.html` writes
   them to `minara_checkout_draft` and restores them when they come back from `cancel.html`. The draft
   also carries `c_address_search` and `manualAddressVisible`, so the lookup text and an open manual
   address form come back exactly as they were left. (The alt-email and delivery-day keys were removed
   together with those fields in the 2026-10-13 declutter pass - do not re-add them on their own.)
9. (2026-10-13) Checkout is **lookup-first at every width** - phone AND desktop: the address step shows
   only "Delivery address" / `#c_address_search`. The nine-field form lives in `#manualAddressBlock`
   and is opened by the full-width `#manualAddressToggle` row under the field ("or type address
   manually", pencil icon + chevron, `min-height:44px` on phones, styled as the quiet grey fallback
   since pass 3 - no border, no uppercase - so it never competes with the Auto-fill pill above it), by
   `window.revealAddressFormIfIncomplete()` (called from `submitPayment()` BEFORE
   `form.requestSubmit()`, so required-field validation can never point at a hidden field), or by a
   restored draft. Two rules that must not be broken: while the form is hidden its inputs are not
   `required` (a hidden required input makes the browser refuse to submit with no visible reason, and
   the resolved address is read back on one `#addressAutofillNote` line instead), and **the manual
   toggle must never focus a field** - `showManualAddress()` calls
   `setManualAddressVisible(true, false)`, so a tap reveals the form WITHOUT throwing the on-screen
   keyboard over the page or scrolling a field under the customer's thumb; only the submit guard moves
   focus. There is no requested-delivery-day picker any more (a day or time goes in "Delivery
   instructions"); an empty `deliveryDate` on the order is expected and handled by
   `functions/index.js`.
10. (2026-10-15) The checkout form opens on the **email field**, and every email typed there is SAVED
    before the order is finished. The form's "Secure Checkout / STEP 1: DELIVERY & CONTACT" heading block
    and its black rule are gone (do not re-add a page title inside the form - `.checkout-title` and
    `.checkout-header-row` were deleted with it), and `#c_email` moved to the TOP of
    `#checkoutDetailsForm` (the field order is `c_email`, `c_address_search`, then the manual address
    block). The capture is `window.captureCheckoutEmail()`: it upserts `{email, emailLower, lastSeenAt}`
    with `merge:true` into the `checkout_emails` collection - doc id = the lowercased address - 1.2s after
    the customer types it, on blur/change, and on pagehide/beforeunload; `handleCheckoutSubmit` (which
    only runs on a form that already passed the browser's own validation) then adds `paymentStarted` /
    `paymentStartedAt` / `paymentGateway` to the SAME row. Three rules that must not be broken: a
    half-typed address is never written (the regex gate is what keeps "name@" out of the customer list),
    the per-browser `minara_checkout_email_captured` / `minara_checkout_email_payment_started` keys are
    set ONLY after Firestore accepted the write (so an offline visit retries instead of losing the
    address silently), and `firestore.rules` allows a public `create, update` ONLY when
    `emailLower == <doc id>` (a visitor can never overwrite another customer's row), with `read, list,
    delete` left to `isAdmin()`. The admin reads the collection in the **"Checkout Emails"** tab
    (`admin.html` + `js/admin/admin-checkout-emails.js`, opened by `switchTab('checkout-emails-tab')`) as
    "Email only" vs "Payment started" plus the chosen rail, with a Copy All Emails button. Rules are
    deployed by hand - `firebase deploy --only firestore:rules --project minara5` - because the GitHub
    Action only deploys hosting. `privacy.html` section 2 states that an unfinished checkout email is
    kept for that purpose only; keep that sentence if the policy is ever rewritten.

