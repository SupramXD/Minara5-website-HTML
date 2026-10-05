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

## One-command reproduction

```
node tools/ozow-probe.js            # creates 1 payment request, then calls initiate
node tools/ozow-probe.js --methods  # method-availability matrix (see table below)
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

## Evidence 2 — what has been ruled out (please don't re-check these)

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

## Evidence 3 — real customer attempts (from Ozow's own `GetTransactionByReference`)

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

## Evidence 4 — trace IDs for Ozow engineering

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

## Appendix — how this was collected

* `firebase functions:log --only createOzowCheckout` — every payment request we created (all accepted).
* `firebase functions:log --only ozowWebhook` — every notification Ozow sent us (all hash-verified).
* `GET https://api.ozow.com/GetTransactionByReference?siteCode=STU-STU-022&transactionReference=…`
  and `GET https://api.ozow.com/GetTransaction?siteCode=STU-STU-022&transactionId=…` with the
  `ApiKey` header — Ozow's own record of each transaction (Evidence 3).
* `https://pay.ozow.com/static/js/main.c4ac1b72.js` (Ozow's hosted-page bundle) — it shows the page's
  startup call is `POST /api/transaction/initiate` on the `/api/transaction` base, which is exactly
  what the customer's browser console reported: `API ERROR: { endpoint: "initiate", error: {…} }` and
  `AxiosError: Request failed with status code 500`.

