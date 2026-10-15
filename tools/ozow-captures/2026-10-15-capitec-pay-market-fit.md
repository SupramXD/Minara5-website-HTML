# Capitec Pay - is it real, and does it fit this brand?

**Written:** 15 October 2026 - desk research, no code, no copy and no customer-facing file touched.
**Companion to:** `2026-10-14-capitec-pay-enablement-request.md` (the rail is **already built and gated in our
UI**; it is waiting on Ozow to switch Capitec Pay on for site `STU-STU-022`, and the signed Capitec Pay
Addendum went back to Ozow Support on 15 October 2026).

## Verdict in one paragraph

Yes, people use Capitec Pay, and a real slice of the customers this brand sells to can use it. But it is a
**conversion rail, not an audience rail**: it earns its keep by turning the Capitec clients who are *already*
at our checkout (replacing a clunky Instant EFT session with a one-tap approval in their own banking app),
not by handing us a new customer type. It is cheap, low-risk and consistent with a R495-R749
accessible-premium ladder - and it should never be expected to carry the store the way card does (card is
still roughly half of SA e-commerce spend, by Ozow's own wording). Add it, measure it, do not build a plan
on it.

## 1. Who this brand actually targets (read off our own ladder, not a persona deck)

`products.json` today: Caribbean R495, Wild Bergamot R495, The Bouquet R495 (all 50ml) and **The Discovery
Duet R749** (bundle; the storefront promo renders R749 struck through as R712). Free courier over R650, flat
R85 below that; 7-day returns, R120 per courier leg. The copy promises a 20%+ extrait concentration,
in-house maceration, "affordable luxury", an independent South African label, men and women, sold direct
(Instagram `@studioextraitsa`) with support answered directly.

The income band that price sits in, in South Africa:

* Median **adult** income is about **R48,275 a year before tax (about R4,000 a month)**; the top 10% of
  earners start near **R437,000 a year (about R36,000 a month)** - researchtesseract.
* "Middle class" is most often defined as **households on R22,000-R75,000 a month** (UCT Liberty Institute,
  used in 2024-2026 reporting); Eighty20's "middle-class workers" are **4.1m adults on R8,000-R30,000 a month**.
* The average South African take-home is about **R21,228 a month** (IOL, June 2026) - just *below* that R22k
  middle-class floor.
* Only **51.2% of SA adults shop online at all**, and they cluster in **R50,000+ households (67.8%)** and
  **25-34-year-olds (39.5%)** - Peach Payments / World Wide Worx *2026 Online Retail Report* (Ask Afrika TGI,
  23,910 interviews, dated 14 August 2026).

So the buyer is:

* **Primary:** 25-40, metro (Gauteng, Western Cape, KZN), household roughly **R22k-R75k a month**,
  mobile-first, buys fragrance 1-3 times a year and for occasions/gifting, wants the projection and longevity
  a R1,500 department-store bottle gives but at a third of the price.
* **Secondary, and the order we actually want:** the fragrance-literate repeat buyer who takes the **R749
  Duet** or two bottles - that basket clears the free-shipping line by itself, where a single R495 bottle
  still drags R85 of courier behind it.
* **The trap to write down:** R495 is a *mass middle* purchase, not a wealthy one. So a mass-market rail is
  **not** mismatched to this ladder. It would only become mismatched if the ladder moves up - a R1,500+ bottle
  buyer is disproportionately banked at FNB, Standard Bank, Absa or Nedbank, not Capitec.

Capitec's own book, for calibration: average personal income of a Capitec client was about **R6,326 a month**
(Competition Commission study, 2024 - the paper cited inside the DeepSeek thread the owner shared), and its
historic share of the above-R30,000/month market was only about **2%** (2017). Its client base is **73%
Black** (Standard Bank 51%, FNB 49%), 15% Coloured, 3% Indian/Asian - i.e. the largest single pool of
middle-income, majority-Black, mobile-first shoppers in the country, which is exactly the cohort SA fragrance
growth is coming from (Euromonitor: SA fragrance retail value **R14.06bn in 2025, up 15% year on year**).
"26m Capitec clients" is still **not** "26m prospects" - the count that matters is app users, below.

## 2. Is Capitec Pay real? (dated and sourced)

* **Scale:** Capitec serves **26m active clients** and has **15m adults active on its app** (one in three SA
  adults, up 19%) - Capitec FY2026 results (year to 28 Feb 2026), carried by TimesLIVE, 22 April 2026.
* **E-commerce volumes *including* Capitec Pay:** **+32% to 643m transactions** in FY2026 (Business Day,
  ITWeb, Fullview, News24, 22 April 2026), after **+47% to 488m** in FY2025 (Capitec's own release, April
  2025).
* **Capitec Pay on its own:** **267.3m transactions worth R56bn** in its first roughly two years (launched
  **6 February 2023**), and Capitec **capped provider commission at R7 per transaction** from December 2024 -
  Capitec's Jerome Passmore, reported January 2025.
* **Current volume:** **over US$3bn a year in e-commerce volume, growing more than 54% year on year, at about
  an 85% conversion rate**, reaching 24m users - EBANX, September 2025.
* **Share at checkout:** **"around 40% of payment value at some processors"** - Peach Payments / World Wide
  Worx *2026 Online Retail Report*; 40.8% of SA retailers already offer instant EFT or PayShap.
* **Consumer intent:** **42%** of ~2,000 surveyed South Africans used Capitec Pay **for the first time in the
  last year** (second only to pay-by-bank/instant EFT at 45%); in one goods category card still led at 34%,
  pay-by-bank 18%, **Capitec Pay 13%**, digital wallets 6% - Stitch *2025 Consumer Payments Report*.
* **Still the minority rail:** card is "roughly half of e-commerce spend" (Ozow's own docs); debit 33% plus
  credit 17% of online transactions (Statista, cited by Peach).

## 3. What that means for this store

For it:

* **It is the cheapest good rail at our basket size.** Card through Yoco is about 2.95% + R1.50 (about R16 on
  R495); Ozow's published EFT rate is 1.5% (about R7.42); and Capitec has capped its *own* commission to
  providers at R7 a transaction. **Confirm the merchant-side Capitec Pay rate in writing with Ozow** - item 3
  of the long ask already asks exactly that, so do not guess it in the books.
* **It removes the worst friction we have.** Capitec Pay is approved in the client's own app with a Capitec
  ID: no card details, no internet-banking session, no password handed to a small shop. That is precisely the
  step where an Instant EFT checkout dies.
* **No card chargebacks** on a rail that is irrevocable once confirmed (Ozow's Pay-by-Bank wording), with
  funds confirmed in real time. For a one-person operation a lower dispute surface is worth more than half a
  percent of fee.
* **Trust optics cost nothing.** A third rail a customer recognises from their own bank answers "can I even
  pay here?" for the half of online shoppers who do not pay by card.

Against it, honestly:

* **Reach is narrower than the headline.** Only a fraction of Capitec clients actually use the method - about
  **3.5m clients actively using Capitec Pay** as of April 2026 (a Stitch blog quote - see the caveats) out of
  26m clients and 15m app users. Most of the upside is therefore *within* people who already bank at Capitec
  and already shop online.
* **Expect cannibalisation, not creation.** Capitec already appears in Ozow's Pay-by-Bank bank list, so a
  share of today's Ozow traffic is Capitec clients using Instant EFT. Capitec Pay mostly converts *those*
  sessions better - it does not invent demand.
* **It is a dead option for everyone who is not a Capitec client** (roughly half of SA adults), and it is one
  more row on a three-row payment step.
* **Refunds have to come back over the rail.** Our published policy says refunds are paid to the original
  payment method, so run one small test refund through Ozow **before** a real customer needs one.
* **The rail can be unavailable for reasons our code cannot see** (account enablement, the addendum, Ozow-side
  incidents). We already gate it honestly server-side; after go-live, watch the per-rail failure rate rather
  than assuming a muted row means "not enabled".

## 4. Falsifiable expectations, and how to check them

* **Expect a meaningful but minority share of Ozow checkouts** - think roughly **10-25% of the Ozow mix** once
  the novelty settles, with Peach's ~40%-of-value as the optimistic processor-level outlier and Stitch's 13%
  preference as the conservative read. Anything above 25% of *all* orders would be a surprise worth writing
  down.
* **The real test is not volume, it is the EFT row.** Compare Instant EFT's share before and after: the gain
  should show up mostly as Instant EFT sessions moving to Capitec Pay, not as new orders.
* **Measure, do not assume:** once Ozow confirms enablement, `node tools/ozow-live-rail-check.js --rail
  capitec` proves the rail is live, and the `ozowRail` / `ozowSelectedBankId` fields on the order docs already
  let the admin tell the two Ozow rails apart. Read those after 2-4 weeks of traffic.
* **Bigger lever, for context:** the *2026 Online Retail Report* puts BNPL's sweet spot at **R800-R8,000**
  orders - our R749 Duet sits just under it. Pay-over-two-paycheques is arguably a larger basket lever than a
  third bank rail, and it is a different decision (cost, risk, and who carries the credit).

## 5. Caveats on this research (what could not be verified)

* `capitecbank.co.za` sits behind Cloudflare and its integrated annual report PDF exceeds the 5MB fetch cap,
  so Capitec's own figures above come from its results release **as carried by** TimesLIVE, Business Day,
  ITWeb, Fullview and News24 - several independent carriers agreeing on the same numbers.
* The News24 page headlined "Capitec Pay commission fees capped at R7" now returns 404; the **R7 cap** is
  corroborated by a second report (Billionaires.Africa, 8 January 2025, "$0.37"). Treat the exact rand figure
  as "capped in single-digit rands", not as a contracted rate for our account.
* The **3.5m active Capitec Pay users** figure came from a Stitch blog quote surfaced by search and that page
  has since 404'd, so treat it as indicative rather than audited.
* The Competition Commission demographics (73% Black, about R6,326/month average personal income, 2% share of
  the above-R30k/month market in 2017) come from the paper cited inside the **DeepSeek thread the owner
  shared**; the PDF itself was not fetched, and the 2017 income-share numbers are the oldest thing here.
* Nothing in this document is a reason to change code. The rail's server-side gate, its UI row and its
  identifier are already correct; the only open item is **Ozow switching the method on for `STU-STU-022`**.
