# Ozow payin - captured request payloads

Merchant `STUDIOEXTRAITPTYLTD` · site `STU-STU-022` · captured 2026-10-09T11:24:37.317Z (Fri, 09 Oct 2026 11:24:37 GMT) on `https://api.ozow.com`.

The two requests below are the complete exchange: (1) the payment request our server posts, and (2) the payer-session call Ozow's own hosted page makes. `ApiKey` is withheld and the private key is never transmitted, only used to sign `hashCheck`. Customer fields are probe placeholders, not order PII.

### 1. Production payment request - Pay by Bank, R580.00

Request: `POST https://api.ozow.com/postpaymentrequest`

Headers: `Content-Type: application/json`, `Accept: application/json`, `ApiKey: <merchant ApiKey - withheld>`

Body sent:

```json
{
  "siteCode": "STU-STU-022",
  "countryCode": "ZA",
  "currencyCode": "ZAR",
  "amount": "580.00",
  "transactionReference": "EXTRAIT-808780-7317",
  "bankReference": "EXTRAIT-808780-7317",
  "optional1": "probe@studioextrait.co.za",
  "optional2": "0821234567",
  "customer": "Probe Test",
  "cancelUrl": "https://studioextrait.co.za/cancel.html?reference=EXTRAIT-808780-7317&gateway=ozow",
  "errorUrl": "https://studioextrait.co.za/cancel.html?reference=EXTRAIT-808780-7317&gateway=ozow",
  "successUrl": "https://studioextrait.co.za/success.html?reference=EXTRAIT-808780-7317&gateway=ozow",
  "notifyUrl": "https://us-central1-minara5.cloudfunctions.net/ozowWebhook",
  "isTest": false,
  "hashCheck": "f72f4bbef3da7484553e287895384534a2bff4112b92782714ca12872180796b4d8a36f6e8037cab97644cbff64c6f2e9617380af12314cfe587896014db434a"
}
```

Response: **HTTP 200**

```json
{
  "paymentRequestId": "0fe55fe9-529c-40bf-96f0-ad6fea5ae7df",
  "url": "https://pay.ozow.com/0fe55fe9-529c-40bf-96f0-ad6fea5ae7df/Secure",
  "errorMessage": null
}
```

### 1b. Payer session for request 1 (this is the failing call)

Request: `POST https://pay.ozow.com/api/transaction/initiate`

Headers: `Content-Type: application/json`, `Accept: application/json` (this call is made by Ozow's own hosted payment page, not by our server)

Body sent:

```json
{
  "requestId": "0fe55fe9-529c-40bf-96f0-ad6fea5ae7df",
  "viewName": ""
}
```

Response: **HTTP 500**

`content-type: application/json; charset=utf-8` · `date: Fri, 09 Oct 2026 11:25:07 GMT` · `server: nginx`

```json
{"type":"HttpClientException","title":"Internal Server Error","status":500,"detail":"InternalServerError - {\"title\":\"Object reference not set to an instance of an object.\",\"status\":500} - Internal Server Error","instance":"POST /api/transaction/initiate","traceId":"0HNP5N1O2PMLV:00000001"}
```

### 2. Minimal payment request - six required fields only, no URLs, no notifyUrl

Request: `POST https://api.ozow.com/postpaymentrequest`

Headers: `Content-Type: application/json`, `Accept: application/json`, `ApiKey: <merchant ApiKey - withheld>`

Body sent:

```json
{
  "siteCode": "STU-STU-022",
  "countryCode": "ZA",
  "currencyCode": "ZAR",
  "amount": "580.00",
  "transactionReference": "EXTRAIT-356298-0363",
  "bankReference": "EXTRAIT-356298-0363",
  "isTest": false,
  "hashCheck": "f7e4e567b541b2361484aaabf25bf87a0528ce504da3bd52e9db7448b53e427100d9413bf0c830613ce6424168e1845317d43fc91e6cf0e71780667214e6bafd"
}
```

Response: **HTTP 200**

```json
{
  "paymentRequestId": "daba07a3-37f0-443e-9a7b-1f67a1c2f19a",
  "url": "https://pay.ozow.com/daba07a3-37f0-443e-9a7b-1f67a1c2f19a/Secure",
  "errorMessage": null
}
```

### 2b. Payer session for request 2

Request: `POST https://pay.ozow.com/api/transaction/initiate`

Headers: `Content-Type: application/json`, `Accept: application/json` (this call is made by Ozow's own hosted payment page, not by our server)

Body sent:

```json
{
  "requestId": "daba07a3-37f0-443e-9a7b-1f67a1c2f19a",
  "viewName": ""
}
```

Response: **HTTP 500**

`content-type: application/json; charset=utf-8` · `date: Fri, 09 Oct 2026 11:25:07 GMT` · `server: nginx`

```json
{"type":"HttpClientException","title":"Internal Server Error","status":500,"detail":"InternalServerError - {\"title\":\"Object reference not set to an instance of an object.\",\"status\":500} - Internal Server Error","instance":"POST /api/transaction/initiate","traceId":"0HNP5S192JBA1:00000001"}
```

### 3. CONTROL - same payload, only `selectedBankId` changed to Card

Request: `POST https://api.ozow.com/postpaymentrequest`

Headers: `Content-Type: application/json`, `Accept: application/json`, `ApiKey: <merchant ApiKey - withheld>`

Body sent:

```json
{
  "siteCode": "STU-STU-022",
  "countryCode": "ZA",
  "currencyCode": "ZAR",
  "amount": "580.00",
  "transactionReference": "EXTRAIT-495835-0940",
  "bankReference": "EXTRAIT-495835-0940",
  "optional1": "probe@studioextrait.co.za",
  "optional2": "0821234567",
  "customer": "Probe Test",
  "cancelUrl": "https://studioextrait.co.za/cancel.html?reference=EXTRAIT-495835-0940&gateway=ozow",
  "errorUrl": "https://studioextrait.co.za/cancel.html?reference=EXTRAIT-495835-0940&gateway=ozow",
  "successUrl": "https://studioextrait.co.za/success.html?reference=EXTRAIT-495835-0940&gateway=ozow",
  "notifyUrl": "https://us-central1-minara5.cloudfunctions.net/ozowWebhook",
  "isTest": false,
  "selectedBankId": "3B1ED354-46E8-465D-9213-8C7A8E5663CE",
  "hashCheck": "0931b9770bee000a735856eae42f015d36358de0829512317b44d647489ad0b428d9e4f1c575b45206c04eb9243cbca247032559fce53f38103a4b7474f807b2"
}
```

Response: **HTTP 200**

```json
{
  "paymentRequestId": "686dd123-404b-4615-9d87-8498e14e1a8c",
  "url": "https://pay.ozow.com/686dd123-404b-4615-9d87-8498e14e1a8c/Secure",
  "errorMessage": null
}
```

### 3b. Payer session for request 3 (Card - account not enabled for it)

Request: `POST https://pay.ozow.com/api/transaction/initiate`

Headers: `Content-Type: application/json`, `Accept: application/json` (this call is made by Ozow's own hosted payment page, not by our server)

Body sent:

```json
{
  "requestId": "686dd123-404b-4615-9d87-8498e14e1a8c",
  "viewName": ""
}
```

Response: **HTTP 200**

`content-type: application/json; charset=utf-8` · `date: Fri, 09 Oct 2026 11:25:08 GMT` · `server: nginx`

```json
{"errors":["The selected bank is not available for this merchant, you will need to select a different bank and complete the normal payment process."],"inputFields":[],"screenShot":"","cancelUrl":"","clientScreen":null,"viewName":"","requestId":"686dd123-404b-4615-9d87-8498e14e1a8c","transactionId":"00000000-0000-0000-0000-000000000000","cannotContinue":false,"directDepositUniqueReference":null}
```

### 4. CONTROL - production payload with a deliberately wrong `hashCheck`

Request: `POST https://api.ozow.com/postpaymentrequest`

Headers: `Content-Type: application/json`, `Accept: application/json`, `ApiKey: <merchant ApiKey - withheld>`

Body sent:

```json
{
  "siteCode": "STU-STU-022",
  "countryCode": "ZA",
  "currencyCode": "ZAR",
  "amount": "580.00",
  "transactionReference": "EXTRAIT-881921-1538",
  "bankReference": "EXTRAIT-881921-1538",
  "optional1": "probe@studioextrait.co.za",
  "optional2": "0821234567",
  "customer": "Probe Test",
  "cancelUrl": "https://studioextrait.co.za/cancel.html?reference=EXTRAIT-881921-1538&gateway=ozow",
  "errorUrl": "https://studioextrait.co.za/cancel.html?reference=EXTRAIT-881921-1538&gateway=ozow",
  "successUrl": "https://studioextrait.co.za/success.html?reference=EXTRAIT-881921-1538&gateway=ozow",
  "notifyUrl": "https://us-central1-minara5.cloudfunctions.net/ozowWebhook",
  "isTest": false,
  "hashCheck": "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
}
```

Response: **HTTP 200**

```json
{
  "paymentRequestId": null,
  "url": null,
  "errorMessage": "The HashCheck value has failed"
}
```

### 5. `initiate` for a `requestId` that was never created

Request: `POST https://pay.ozow.com/api/transaction/initiate`

Headers: `Content-Type: application/json`, `Accept: application/json` (this call is made by Ozow's own hosted payment page, not by our server)

Body sent:

```json
{
  "requestId": "519f77e0-db29-4c30-ab6c-274aa8b997ad",
  "viewName": ""
}
```

Response: **HTTP 500**

`content-type: application/json; charset=utf-8` · `date: Fri, 09 Oct 2026 11:25:08 GMT` · `server: nginx`

```json
{"type":"HttpClientException","title":"Internal Server Error","status":500,"detail":"InternalServerError - {\"title\":\"Object reference not set to an instance of an object.\",\"status\":500} - Internal Server Error","instance":"POST /api/transaction/initiate","traceId":"0HNP5R5BIA160:00000001"}
```

### 6. `initiate` with an empty body

Request: `POST https://pay.ozow.com/api/transaction/initiate`

Headers: `Content-Type: application/json`, `Accept: application/json` (this call is made by Ozow's own hosted payment page, not by our server)

Body sent:

```json
{}
```

Response: **HTTP 500**

`content-type: application/json; charset=utf-8` · `date: Fri, 09 Oct 2026 11:25:10 GMT` · `server: nginx`

```json
{"type":"HttpClientException","title":"Internal Server Error","status":500,"detail":"InternalServerError - {\"title\":\"Object reference not set to an instance of an object.\",\"status\":500} - Internal Server Error","instance":"POST /api/transaction/initiate","traceId":"0HNP5QCMAAUBI:00000001"}
```

### 7. `initiate` with a malformed `requestId`

Request: `POST https://pay.ozow.com/api/transaction/initiate`

Headers: `Content-Type: application/json`, `Accept: application/json` (this call is made by Ozow's own hosted payment page, not by our server)

Body sent:

```json
{
  "requestId": "not-a-guid",
  "viewName": ""
}
```

Response: **HTTP 400**

`content-type: application/problem+json; charset=utf-8` · `date: Fri, 09 Oct 2026 11:25:11 GMT` · `server: nginx`

```json
{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"errors":{"$.requestId":["The JSON value could not be converted to System.Guid. Path: $.requestId | LineNumber: 0 | BytePositionInLine: 25."]},"traceId":"00-165fc170c4e8b9175a5ea5243dc34bda-0e6a3e2c69ef9680-00"}
```

## Summary

| # | request | HTTP | outcome |
|---|---|---|---|
| 1 | 1. Production payment request - Pay by Bank, R580.00 | 200 | paymentRequestId 0fe55fe9-529c-40bf-96f0-ad6fea5ae7df |
| 2 | 1b. Payer session for request 1 (this is the failing call) | 500 | {"type":"HttpClientException","title":"Internal Server Error","status":500,"detail":"InternalServerError - {\"title\":\"Object reference not set to an |
| 3 | 2. Minimal payment request - six required fields only, no URLs, no notifyUrl | 200 | paymentRequestId daba07a3-37f0-443e-9a7b-1f67a1c2f19a |
| 4 | 2b. Payer session for request 2 | 500 | {"type":"HttpClientException","title":"Internal Server Error","status":500,"detail":"InternalServerError - {\"title\":\"Object reference not set to an |
| 5 | 3. CONTROL - same payload, only `selectedBankId` changed to Card | 200 | paymentRequestId 686dd123-404b-4615-9d87-8498e14e1a8c |
| 6 | 3b. Payer session for request 3 (Card - account not enabled for it) | 200 | {"errors":["The selected bank is not available for this merchant, you will need to select a different bank and complete the normal payment process."], |
| 7 | 4. CONTROL - production payload with a deliberately wrong `hashCheck` | 200 | errorMessage: The HashCheck value has failed |
| 8 | 5. `initiate` for a `requestId` that was never created | 500 | {"type":"HttpClientException","title":"Internal Server Error","status":500,"detail":"InternalServerError - {\"title\":\"Object reference not set to an |
| 9 | 6. `initiate` with an empty body | 500 | {"type":"HttpClientException","title":"Internal Server Error","status":500,"detail":"InternalServerError - {\"title\":\"Object reference not set to an |
| 10 | 7. `initiate` with a malformed `requestId` | 400 | {"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"errors":{"$.requestId":[" |

