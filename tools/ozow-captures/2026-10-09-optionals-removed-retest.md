# Ozow Pay by Bank — optional fields removed, `hashCheck` recalculated

**Asked by:** Nthabiseng Malesela, Ozow Support — message `1a120e5e6eaabf35`, 9 Oct 2026 15:41 SAST
(*"Please remove the optional fields. Recalculate the hash fields and advise if this clears the error."*)

**Run:** 9 Oct 2026 ≈16:04 SAST · `node tools/ozow-probe.js --no-optionals` · site `STU-STU-022` (`STUDIOEXTRAITPTYLTD`)

**Result: it does not clear the error.** Both cuts of the request were accepted by Ozow (200, a `url`,
`"errorMessage": null`) — so the recalculated hash was valid — and Ozow's own hosted page still fails its
`initiate` call with the same 500 null reference, with a fresh `traceId` each run.

## What was changed

`optional1`, `optional2` and `customer` were deleted from the exact request
`createOzowCheckout` sends, and the `hashCheck` was rebuilt over the fields that remain, in Ozow's
documented order, with the private key appended and the whole string lowercased (SHA512). The private
key is never transmitted and is not printed below.

## Row 1 — production shape minus `optional1`, `optional2` and `customer`

Request body:

```json
{
  "siteCode": "STU-STU-022",
  "countryCode": "ZA",
  "currencyCode": "ZAR",
  "amount": "1.00",
  "transactionReference": "OZOWPROBE-54647754",
  "bankReference": "OZOWPROBE-54647754",
  "cancelUrl": "https://studioextrait.co.za/cancel.html",
  "errorUrl": "https://studioextrait.co.za/cancel.html",
  "successUrl": "https://studioextrait.co.za/success.html",
  "notifyUrl": "https://us-central1-minara5.cloudfunctions.net/ozowWebhook",
  "isTest": false,
  "hashCheck": "edca66c0bb67aa14a16b232dbc146ae7bb647686b97436640c0333e2c02307f9e766aae027d19e901f867f146407a54088e4d62ff054a5c034e29c2e9abe98d7"
}
```

The exact string the hash is taken over (private key appended where `<private key>` is shown, then
lowercased before hashing):

```
STU-STU-022ZAZAR1.00OZOWPROBE-54647754OZOWPROBE-54647754https://studioextrait.co.za/cancel.htmlhttps://studioextrait.co.za/cancel.htmlhttps://studioextrait.co.za/success.htmlhttps://us-central1-minara5.cloudfunctions.net/ozowWebhookfalse<private key>
```

Responses:

```
POST https://api.ozow.com/postpaymentrequest
200 {"paymentRequestId":"8fcc622c-6f7a-495e-a662-43c274510185","url":"https://pay.ozow.com/8fcc622c-6f7a-495e-a662-43c274510185/Secure","errorMessage":null}

POST https://pay.ozow.com/api/transaction/initiate   {"requestId":"8fcc622c-6f7a-495e-a662-43c274510185","viewName":""}
500 {"type":"HttpClientException","title":"Internal Server Error","status":500,"detail":"InternalServerError - {\"title\":\"Object reference not set to an instance of an object.\",\"status\":500} - Internal Server Error","instance":"POST /api/transaction/initiate","traceId":"0HNP5VP9QE40B:00000001"}
```

## Row 2 — the six required fields only, nothing optional

Request body:

```json
{
  "siteCode": "STU-STU-022",
  "countryCode": "ZA",
  "currencyCode": "ZAR",
  "amount": "1.00",
  "transactionReference": "OZOWPROBE-54649339",
  "bankReference": "OZOWPROBE-54649339",
  "isTest": false,
  "hashCheck": "7714a2aa78f81ef71ed9819c043c041e84238b74d103ff7610bb82cceb359b251c972240633b226a2cef31af6068d2021d4266c4eaeae9de416d8e66f5ee2efe"
}
```

Hash input string:

```
STU-STU-022ZAZAR1.00OZOWPROBE-54649339OZOWPROBE-54649339false<private key>
```

Responses:

```
POST https://api.ozow.com/postpaymentrequest
200 {"paymentRequestId":"e15d81bb-dc5e-406b-a707-77ce09e0b065","url":"https://pay.ozow.com/e15d81bb-dc5e-406b-a707-77ce09e0b065/Secure","errorMessage":null}

POST https://pay.ozow.com/api/transaction/initiate   {"requestId":"e15d81bb-dc5e-406b-a707-77ce09e0b065","viewName":""}
500 {"type":"HttpClientException","title":"Internal Server Error","status":500,"detail":"InternalServerError - {\"title\":\"Object reference not set to an instance of an object.\",\"status\":500} - Internal Server Error","instance":"POST /api/transaction/initiate","traceId":"0HNP61GVBPARM:00000001"}
```

## What this shows

1. **The `hashCheck` is correct and accepted.** `/postpaymentrequest` answered `200` with a `url` and
   `"errorMessage": null` for both reduced payloads. A deliberately wrong `hashCheck` is refused by name
   at the same endpoint (`200 {"errorMessage":"The HashCheck value has failed"}`, and no `url`), so a
   `200` + `url` is Ozow's own confirmation that it validated the hash we sent. The hash is not the
   obstacle, and the values/order above are the whole of what is hashed.
2. **The optional fields are not the cause.** Removing them (and, one row further, removing everything
   optional at all) changes nothing: the request is accepted and the payer session still cannot start.
   There is no payload change left that clears this, so no production change was made for it.
3. **The failure is in `initiate`, which Ozow's own page calls.** Nothing we send reaches it beyond the
   `paymentRequestId` above; the null reference is thrown on Ozow's side, in the same code path as every
   earlier report.
4. **Still unresolved on the account:** in Merchant Details the **bank account is blank** and the
   **Industry** field is locked, so it cannot be saved. The owner's own description (9 Oct 2026):
   **Save submits the whole Merchant Details list**, the **Industry control is locked and cannot be
   typed into or changed**, and the save is then **rejected with an error saying the Industry field
   must be filled in** - so the form refuses to save while Industry is locked and refuses to save while
   it is empty, and the settlement bank account is never stored. The account was **created manually by
   Ozow KYC support** (the self-service signup never completed), which may be why the field arrived
   locked and empty. A settlement bank account that was never stored is the obvious candidate for a
   null dereference in a session builder, and it would explain why every method the account is *not*
   enabled for answers cleanly (their guard runs first) while Pay by Bank — the only enabled method —
   dies here.

## Reproduce

```
node tools/ozow-probe.js --no-optionals      # this run (the flag was added for Ozow's ask)
node tools/ozow-probe.js --payloads          # the 5 Oct shape matrix + broken-hash control
node tools/ozow-probe.js --lookup OZOWPROBE-54647754
```

Opens for Ozow staff (live payer pages from this run, both will show the failure):

* `https://pay.ozow.com/8fcc622c-6f7a-495e-a662-43c274510185/Secure`
* `https://pay.ozow.com/e15d81bb-dc5e-406b-a707-77ce09e0b065/Secure`

The two probe payment requests (`OZOWPROBE-54647754`, `OZOWPROBE-54649339`) stay unpaid; they never
become orders on our side and can be discarded.

Full background and every earlier trace ID: `tools/OZOW-SUPPORT-REPORT.md` (Evidence 8 is this run).
