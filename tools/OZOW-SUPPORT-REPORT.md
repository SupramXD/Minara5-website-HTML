# Ozow payin incident for Studio Extrait — evidence pack for Ozow support

**Merchant code:** `STUDIOEXTRAITPTYLTD` · **Site code:** `STU-STU-022`
**Reported:** 5 October 2026 (SAST) · **Impact:** every Instant EFT checkout fails; card (Yoco) unaffected.

## Summary

`POST https://api.ozow.com/postpaymentrequest` **succeeds** (we get a `paymentRequestId` and a
`https://pay.ozow.com/<id>/Secure` URL every time), but the hosted payment page can never start a
payer session: its startup call `POST https://pay.ozow.com/api/transaction/initiate` fails for this
merchant/site. Two shapes of failure are observed:

1. **HTTP 500** — `"InternalServerError - {\"title\":\"Object reference not set to an instance of an
   object.\",\"status\":500}"` on `POST /api/transaction/initiate`, with a fresh `traceId` each time.
2. **HTTP 200** with `{"errors":["Failed to create transaction, please retry to complete your
   payment."],"transactionId":"00000000-0000-0000-0000-000000000000"}`.

Both leave the customer on Ozow's own error screen for that URL:

> "Oops, this page cannot be found. We apologise, but it appears that the page cannot be found.
> Head back to the merchant or please try again later." — with a **Retry** button.

The failure is specific to the **Pay by Bank** method (the one enabled by default on the account).
Every method the account is *not* enabled for answers with a clean, correct error instead, which
shows the `initiate` endpoint itself works — only Pay-by-Bank transaction creation crashes.

The strongest single proof is inside the successful responses: when a payment request for this same
site names a bank the account is not enabled for, `initiate` answers **200** and *echoes back our own
`requestId`* (`{"errors":["The selected bank is not available for this merchant, you will need to
select a different bank and complete the normal payment process."],…,"requestId":"ea2e27f4-…"}`) — so
Ozow's service **is** loading our payment request successfully and can complete the call. The only
variable that changes the outcome is which bank/method is being started. Ozow's own reference
classifies this error as theirs: *"500 Internal Server Error. Something failed on the Ozow side."*

## One-command reproduction

```
node tools/ozow-probe.js            # creates 1 payment request, then calls initiate
node tools/ozow-probe.js --methods  # method-availability matrix (Evidence 1)
node tools/ozow-probe.js --payloads # payload-shape matrix (Evidence 2)
node tools/ozow-probe.js --lookup EXTRAIT-769328-8451
```

(the script reads `OZOW_API_KEY`, `OZOW_API_KEY_NORMAL` and `OZOW_SITE_CODE` from the environment)

Equivalent raw calls, for anyone without the repo:

```
curl -s -X POST https://api.ozow.com/postpaymentrequest \
  -H "ApiKey: <APIKey>" -H "Content-Type: application/json" -d @payment-request.json

curl -s -X POST https://pay.ozow.com/api/transaction/initiate \
  -H "Content-Type: application/json" -d '{"requestId":"<paymentRequestId>","viewName":""}'
```

## Evidence 1 — the method matrix (identical payload, only `selectedBankId` varies)

| `selectedBankId` sent | `initiate` response |
|---|---|
| *(none — Pay by Bank, customer picks their bank)* | **500 NullReferenceException** |
| `4816019C-3314-4C80-8B6B-B2CD16DCC4EC` (FNB) | **500 NullReferenceException** |
| `AD7D8DA4-1723-4066-94BB-6662D845E483` (Standard Bank) | **500 NullReferenceException** |
| `D3889DF6-CDAC-4861-9D64-2B100FB7ED07` (Nedbank) | **500 NullReferenceException** |
| `3B1ED354-46E8-465D-9213-8C7A8E5663CE` (Card) | 200 — *"The selected bank is not available for this merchant…"* |
| `913999FA-3A32-4E3D-82F0-A1DF7E9E4F7B` (Capitec Pay) | 200 — *"… not available for this merchant …"* |
| `EEC08676-46EB-4F80-AF56-CAA5A6623880` (PayShap Request) | 200 — *"… not available for this merchant …"* |
| `43FDB792-3B88-4D36-A13D-42B7661E9F76` (Crypto) | 200 — *"… not available for this merchant …"* |
| `3284A0AD-BA78-4838-8C2B-102981286A2B` (Absa, deprecated) | 200 — *"… not available for this merchant …"* |

So the account is enabled for **Pay by Bank only**, and every enabled route is the one that crashes.

In the four clean 200s the response body quotes the `requestId` of the payment request that was just
created (Card: `ea2e27f4-a992-49ad-ab86-6e02986eb0a8`), which is how we know the payment request was
read successfully and that only the Pay-by-Bank branch fails. Those four rows also show the endpoint
returning a *complete* session payload (`inputFields`, `viewName`, `cancelUrl`, `cannotContinue`, …).

## Evidence 2 — the failure does not depend on what we send (`--payloads`)

`node tools/ozow-probe.js --payloads` creates a fresh payment request per row — every one accepted by
`/postpaymentrequest`, each with its own `paymentRequestId` — and then replays the hosted page's
`initiate` call. Only the request *shape* changes:

| # | payment request | `initiate` response |
|---|---|---|
| 1 | exactly what `createOzowCheckout` sends (R580.00) | **500 NullReferenceException** |
| 2 | minimal (site/country/currency/amount/refs/`isTest` only — no customer, no URLs, no notify) | **500 NullReferenceException** |
| 3 | full (adds `optional3/4/5`, `customerIdentifier`, `customerCellphoneNumber`, `expiryDateUtc`) | **500 NullReferenceException** |
| 4 | production shape **minus `notifyUrl`** | **500 NullReferenceException** |
| 5 | control — same payload with a deliberately wrong `hashCheck` | 200 `"The HashCheck value has failed"`, no `url` |
| 6 | `initiate` with a `requestId` that was never created | **500 NullReferenceException** |
| 7 | `initiate` with a malformed `requestId` (`"not-a-guid"`) | 400 *"The JSON value could not be converted to System.Guid"* |
| 8 | `initiate` with an empty body `{}` | **500 NullReferenceException** |

Rows 1 and 2 share only `siteCode`, `countryCode`, `currencyCode`, `amount`,
`transactionReference`, `bankReference` and `isTest`, so none of the optional fields, the customer
block, the redirect URLs or the notify URL can be the object being dereferenced.

Row 5 is the control that matters most: when our request *is* wrong, Ozow says so precisely and by
name — we have never once received such a message. Rows 6 and 8 show that this endpoint answers a
request it cannot match with an unhandled null reference instead of a clean "not found", i.e.
`NullReferenceException` is that endpoint's generic failure mode, not a verdict on our data.

## Evidence 3 — what has been ruled out (please don't re-check these)

Every one of these produced an accepted payment request and then the *same* `initiate` failure:

* `isTest: false` **and** `isTest: true` (test mode fails identically)
* adding `customerIdentifier` (Customer Identity Verification), `customerCellphoneNumber`,
  `expiryDateUtc`
* any `viewName` (`""`, `Secure`, `secure`, `Default`)
* brand-new, never-touched payment requests (so it is not request state or expiry)
* two requests created 16 seconds apart (13:59:31 and 13:59:47 SAST) — both failed
* the integration itself: `ApiKey`/private key are accepted (a wrong key returns 401/403 and a
  rejected request carries `errorMessage` with no `url` — neither happens), the `HashCheck` verifies
  in both directions, and Ozow's own signed notifications POST successfully to our notify URL
  (`https://us-central1-minara5.cloudfunctions.net/ozowWebhook`).

## Evidence 4 — real customer attempts (from Ozow's own `GetTransactionByReference`)

| SAST created | order ref | paymentRequestId | transactionId | Status | statusMessage |
|---|---|---|---|---|---|
| 14:15:08 | EXTRAIT-942257-8996 | `df02ef23-45ef-4617-9bc2-95fcfbe26a1a` | `b1973d0f-1046-48e1-9976-83523bb002e6` | Cancelled | User cancelled transaction before selecting bank. |
| 14:41:37 | EXTRAIT-494281-2496 | `8aff1261-c792-4ed2-afe2-11e00674d9d0` | `37f77f01-917e-4edb-ab9e-6decd81a3bbf` | Cancelled | User cancelled transaction before selecting bank. |
| 15:59:38 | EXTRAIT-769328-8451 | `5e28b351-6e98-4bfc-9a86-65fc1d80923b` | `05a499f8-7854-482d-9803-e9c0ef6a1165` | Cancelled | User cancelled transaction before selecting bank. |
| 15:59:47 (retry) | EXTRAIT-907994-6399 | `cf1a83a0-3377-4f14-977d-6c2ee948f8df` | — | — | — |

`BankName`, `maskedAccountNumber` and `paymentDate` are empty on all of them: the session never got
as far as a bank. The "user cancelled" message is what the platform records when a payer session
dies before bank selection (the customer pressed *Retry* or *Head back to the merchant* on the error
screen, or simply closed the tab) — it is not a customer decision to abandon a working page.

Amounts were R580.00 (customer attempts) and R10.00 / R1.00 (our probes) — the value is irrelevant.

## Evidence 5 — trace IDs for Ozow engineering

All on `POST https://pay.ozow.com/api/transaction/initiate`, 5 October 2026 (≈14:20–16:10 SAST),
all 500 `NullReferenceException`:

| probe | paymentRequestId | traceId |
|---|---|---|
| Pay by Bank (live) | `391df7a9-6836-4e9d-8bcf-fab2ac3a3bb9` | `0HNP2PI5OFOSE:00000001` |
| Pay by Bank (isTest=true) | `dd642fcb-ad86-4c54-9b17-2952c348fb6f` | `0HNP2QE204IHB:00000001` |
| +`customerIdentifier` | `3082a5fe-7560-4ac9-94e1-9064662d3e1d` | `0HNP2QQS77HST:00000001` |
| +`customerCellphoneNumber` | `e80b6d1d-2646-4a04-9c55-9aab347332ff` | `0HNP2PIBS0SB5:00000001` |
| FNB selected | `41fd5116-febc-4b1d-bec8-6d940f066df4` | `0HNP2PIBS0RLV:00000001` |
| Standard Bank selected | `787950d7-d9a2-46a2-8ebd-098edd037239` | `0HNP2ST2CTPLJ:00000001` |
| Nedbank selected | `477553f4-8984-4144-87f4-0bb64b78c5e1` | `0HNP2LG647SIP:00000001` |
| FNB + cellphone | `4e205e87-0c57-409d-aba7-d76a1b6b05e2` | `0HNP2HKCIP81O:00000001` |
| empty body `{}` (baseline) | — | `0HNP2QS18EB0F:00000001` |

Second run, same day (≈16:25–16:31 SAST) — the payload-shape matrix of Evidence 2 plus a fresh method sweep:

| probe | paymentRequestId | traceId |
|---|---|---|
| production shape, R580.00 | `c72e1507-3fc7-4e08-82c2-d54ea0b024d9` | `0HNP2PIBS12BM:00000001` |
| minimal payload | `ba1e5f18-652d-4395-b7a8-55d7c3add352` | `0HNP2SSPESNAP:00000001` |
| full payload | `b4f79cb8-be48-4c77-9cb5-8b6e8dcde8bd` | `0HNP2JPM94R38:00000001` |
| production shape minus `notifyUrl` | `62e22f9f-f18f-4295-88a2-71250cb2affe` | `0HNP2QCUKRFI2:00000001` |
| `requestId` that was never created | — | `0HNP2SSPESNB3:00000001` |
| empty body `{}` | — | `0HNP2JQR0AVVF:00000001` |
| Pay by Bank, no `selectedBankId` | `6c79c631-cecf-41fb-acd6-286466144a80` | `0HNP2QR2BMHRI:00000001` |
| FNB selected | `9c8fcc26-f701-4e5a-8bef-196e121a7982` | `0HNP2P4CSOSRS:00000001` |
| Standard Bank selected | `f766f82f-6b6c-4c9b-bcc7-96d170fc8325` | `0HNP2QCUKRFI8:00000001` |
| Nedbank selected | `fb42a4eb-d2a9-4a79-b8f2-54f7a253bda0` | `0HNP2QQ1615L3:00000001` |
| Card selected (control — 200, not available) | `ea2e27f4-a992-49ad-ab86-6e02986eb0a8` | — |
| Capitec Pay selected (control — 200) | `07255e8d-6bde-4d6c-b432-385292e5e003` | — |
| PayShap Request selected (control — 200) | `ff5dc783-fdac-489e-a08b-aca5c7036dc6` | — |
| Crypto selected (control — 200) | `1547b863-a868-4455-8905-00ba44bfcd08` | — |

## What we need from Ozow

1. Look up the trace IDs above and fix the null reference in **Pay-by-Bank transaction creation** for
   site `STU-STU-022` (`STUDIOEXTRAITPTYLTD`).
2. Confirm the site is **activated for live payments** and that Pay by Bank is configured correctly
   for it — `POST /postpaymentrequest` being accepted means the site and keys resolve, so whatever is
   null is in the payer-session configuration.
3. If that cannot be fixed today, enable `Card` (`3B1ED354-…`), `Capitec Pay` (`913999FA-…`) or
   `PayShap Request` (`EEC08676-…`) on the account and tell us which identifier works: we can send
   `selectedBankId` on the payment request and take customers straight to a working method.
4. Confirm whether `"Failed to create transaction, please retry to complete your payment."` is a site
   setting we can correct ourselves in `dash.ozow.com`.
5. For triage: `initiate` returns **200 with a complete session payload** — quoting the `requestId` we
   created — when a payment request names a Bank API method the account is not enabled for
   (Card/Capitec Pay/PayShap/Crypto), and **only** the Pay-by-Bank bank ids (or no `selectedBankId`)
   produce the NRE. The payment request is therefore read fine; the null is inside Pay-by-Bank session
   creation for this merchant/site. Please tell us which configuration object that code path reads for
   `STU-STU-022` (enabled-bank list, merchant bank account / settlement details, site activation for
   bank payments) — that is what looks null.
6. If you can create a **second site code under the same merchant**, we will re-run this whole matrix
   against it within minutes: that isolates a site-level configuration fault from a merchant-level one.

## Appendix — how this was collected

* `firebase functions:log --only createOzowCheckout` — every payment request we created (all accepted).
* `firebase functions:log --only ozowWebhook` — every notification Ozow sent us (all hash-verified).
* `GET https://api.ozow.com/GetTransactionByReference?siteCode=STU-STU-022&transactionReference=…`
  and `GET https://api.ozow.com/GetTransaction?siteCode=STU-STU-022&transactionId=…` with the
  `ApiKey` header — Ozow's own record of each transaction (Evidence 4).
* `https://pay.ozow.com/static/js/main.c4ac1b72.js` (Ozow's hosted-page bundle) — it shows the page's
  startup call is `POST /api/transaction/initiate` on the `/api/transaction` base, which is exactly
  what the customer's browser console reported: `API ERROR: { endpoint: "initiate", error: {…} }` and
  `AxiosError: Request failed with status code 500`.

