# Enabling Capitec Pay on the Ozow account — how, and the message that asks for it

**Drafted:** 14 October 2026 (SAST) · **Account:** `STUDIOEXTRAITPTYLTD` · **Site:** `STU-STU-022`
**Status:** drafted, **NOT sent** — nothing is sent from this repo, and no password is ever needed for it.

> **14 October update, read this first.** Ozow Support replied on this thread on **12 October, 16:11**
> (Nthabiseng Malesela): *"The bank account has now been set. Kindly re-test and advise if this clears
> the errors."* So the merchant-record item in §3 is already actioned on their side, and the message
> that is actually staged is the **short version** (a Gmail reply draft in that same thread, posted as
> a `reply-draft` on message `1a13074221cf4b94`). Keep §3 as the fallback if the short ask comes back
> as "not possible", because it carries the payload evidence with it.

**Exact text staged in that Gmail reply draft** (draft id `r8513271970729214655`, thread
`1a10b65ea8d12c1c`, in reply to `1a13074221cf4b94`; verified as built MIME: addressed to
`Ozow Support <support@ozow.com>`, `In-Reply-To`/`References` chained onto their 12 Oct mail,
emoji `U+1F605` encoded once as `=F0=9F=98=85`, no em/en dash, no ellipsis):

```
Good day Nthabiseng,

Could you please activate Capitec Pay for my account? Site code STU-STU-022.

I have it set up on my side, it just needs to be activated for my site's
integration of it to work.

Sorry to bother you with this.

Thank You
-Jadon From Studio Extrait 😅
```

Deliberately shorter than §3: it drops the bank-account thank-you (that item is already closed by
their 12 Oct mail) and the "your page says the bank is not available for this merchant" line, and
asks only for activation. It is **still not sent** — it waits on merchant approval.

## 1. The short answer: there is nothing to switch on yourself

There is **no toggle for this in `dash.ozow.com`** — not a checkbox, not a menu. Ozow's own docs say it
plainly:

> "Payment methods are enabled on your Ozow account, not in your code. **Pay by Bank is enabled by
> default.** Anything else you opt into is **enabled by Ozow on your account**, and then appears on the
> Ozow payment page automatically: no new integration, no new endpoint, nothing to ship."
> — `hub.ozow.com/payment-methods`

and, on the payment-requests side:

> "Any additional payment methods **enabled by Ozow on your account** will automatically appear on the
> payment page, no further action required on your side… contact `support@ozow.com` or your account
> manager."
> — `hub.ozow.com/integration-methods`

So **enabling Capitec Pay is a request to Ozow, not a setting you change.** Nothing in this repo has to
be written, deployed or flipped for it: `createOzowCheckout` already sends the method's identifier
(`913999FA-3A32-4E3D-82F0-A1DF7E9E4F7B`) and the server-side gate already refuses the rail honestly
while the account is not enabled for it. The row un-mutes itself on the first checkout attempt after
Ozow enables it (the "unavailable" cache is 10 minutes).

**Useful confirmation that it is a real, sellable Ozow product** (so this is not a "we don't do that"
answer): Capitec Pay is featured on Ozow's own site — `ozow.com/capitec-pay` ("Capitec Pay with Ozow …
an intuitive payments API", plus the separate Capitec Pay VRP page) — and that page's call to action is
literally **"Contact Sales"**.

## 2. Where to send the request (best route first)

| # | Route | Why |
|---|---|---|
| 1 | **Reply on the existing Ozow Support thread** `1a10b65ea8d12c1c` (from `supunolt@gmail.com`, to `Ozow Support <support@ozow.com>`, subject carried over) | The same thread already carries the payload captures (`1a120776bfcdff91`, `1a12104bf44799ce`) and Ozow's own Nthabiseng Malesela is on it. Account changes get done when the history is in one place. |
| 2 | `support@ozow.com` (docs) / `clientsupport@ozow.com` (Client Support on `ozow.com/contact`) — **cc `sales@ozow.com`** | Sales is who Ozow's Capitec Pay page points at; support is who can action the account. Covering both avoids a bounce between them. |
| 3 | Contact form at `ozow.com/contact`, subject **"Technical Query"** or **"Onboarding Query"** | Same people, tracked ticket. |
| 4 | WhatsApp **+27 67 328 6121** / phone **+27 11 054 4744** (`ozow.com/contact`) | Only as a nudge if there is no reply in one business day — quote merchant + site code and the ticket/thread. |

**Attach nothing by default**: the ask is an account change, and everything Ozow needs to verify it is
in the body below. If they ask for proof of the refusal, re-run
`node tools/ozow-live-rail-check.js --rail capitec` and paste the two outputs (it creates one R1 pending
order doc, `EXTRAIT-…`, exactly like a real checkout attempt — delete it in the admin panel afterwards).

## 3. The body — copy from here

To: `support@ozow.com` (reply on thread `1a10b65ea8d12c1c`) · Cc: `sales@ozow.com`
Subject: **Capitec Pay enablement for site STU-STU-022 (merchant STUDIOEXTRAITPTYLTD)**

Hi Ozow team,

Following on from the Pay by Bank investigation in this thread — merchant `STUDIOEXTRAITPTYLTD`,
site `STU-STU-022` — please **enable Capitec Pay on my account** so it can be used on that site's
checkout.

My understanding, from `hub.ozow.com/payment-methods`, is that only Pay by Bank is on by default and
that any other method has to be enabled by Ozow on the account, with nothing to change on my side. I
have already integrated it: my checkout sends `selectedBankId = 913999FA-3A32-4E3D-82F0-A1DF7E9E4F7B`
on `POST https://api.ozow.com/postpaymentrequest`, and I would like it live on `STU-STU-022`.

Right now the method is refused, with your own wording, which is how I can tell it is not enabled yet:

    POST https://pay.ozow.com/api/transaction/initiate   {"requestId":"<fresh id>","viewName":""}
    200 {"errors":["The selected bank is not available for this merchant, you will need to select a
         different bank and complete the normal payment process."],
         "transactionId":"00000000-0000-0000-0000-000000000000"}

That response is the reason this became urgent for us: `postpaymentrequest` answers **200 with a
session URL** for Capitec Pay either way, so the failure only exists inside the hosted payer session
and my storefront cannot see it. I have therefore put a server-side check in front of the rail so my
customers are told "not available from Ozow yet" instead of being silently dropped onto the generic
bank picker. That check is the only reason a customer is not misled today — it does not make Capitec
Pay work.

Please could you:

1. **Enable Capitec Pay for `STU-STU-022`** (or confirm whether it is enabled at merchant level
   `STUDIOEXTRAITPTYLTD` instead — I have one site, so either works).
2. **Confirm in writing which payment methods are enabled on the account today**, and whether Capitec
   Pay is available on the Payments API as well as One API. I cannot see a per-method list or toggle in
   `dash.ozow.com`, so I would rather quote you than guess.
3. Tell me **whether Capitec Pay carries any fee or contract requirement** I need to accept, and the
   correct `selectedBankId` if the value I am sending is no longer the current one.

While you are in the account, the items from my earlier message in this thread are still open and are
the same account record — the **Industry field in Merchant Details** still accepts no input, which is
what stops the **settlement bank account** from saving, and Pay by Bank still 500s on
`/api/transaction/initiate` with `Object reference not set to an instance of an object.` Fixing the
merchant record may well resolve that too, and I will re-run the full matrix the same minute you tell
me it is done.

I am happy to run any test you need and send fresh trace IDs immediately.

Thanks very much,
[YOUR NAME]
Studio Extrait (Studio Extrait Pty Ltd) · studioextrait.co.za
[YOUR PHONE / WHATSAPP]

## (copy to here)

## 4. What happens after they say "done"

1. **Nothing to deploy.** The identifier, its hash position and the UI row are already in place
   (`functions/index.js`, `checkout.html`, `js/core/cart.js`).
2. **Wait up to 10 minutes, or don't** — the "unavailable" verdict is cached for 10 minutes only, and a
   successful session clears it immediately, so the first attempt after enablement may still be refused
   once. Try again after the cache window.
3. **Prove it, do not assume it:** `node tools/ozow-live-rail-check.js --rail capitec`. `FAILED_PRECONDITION`
   means still not enabled; an `initiate` response that opens Capitec Pay's own approval screen means it
   is live. Then check the row in `checkout.html` is no longer muted.
4. **Delete the probe's pending order** (`EXTRAIT-…`, R1) in the admin panel, as with every live probe.

## 5. Pitfalls (all learned the hard way on this account)

* **Do not "fix" it in code.** Adding Capitec to Ozow's Pay-by-Bank bank list, or removing the
  server-side gate, does not enable anything — it just sends customers to the generic bank picker and
  lies to them about it. Capitec Pay is a **Bank API method**, which is exactly why Capitec is not in the
  Pay-by-Bank bank list.
* **Do not read a `200` from `postpaymentrequest` as success.** Ozow returns a session URL for a method
  the account is not enabled for; the refusal only exists in `pay.ozow.com/api/transaction/initiate`.
* **One account change, one thread.** Opening a new ticket about the same merchant record loses the
  payload captures and the trace IDs.
* If Ozow answers *"not available on your account at all"*, the alternatives they sell and can enable the
  same way are **Card**, **PayShap Request**, **Nedbank Direct EFT** and **Absa Pay** (`ozow.com/contact`
  product menu) — and the longer-term path is **One API**, where `institutionId` replaces
  `selectedBankId`; that migration is blocked on a **Client ID + Client Secret** only Ozow can create
  (see `tools/OZOW-SUPPORT-REPORT.md`).
