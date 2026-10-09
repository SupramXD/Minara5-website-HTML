// Studio Extrait - Ozow payin probe
// Usage: node tools/ozow-probe.js [--methods] [--payloads] [--no-optionals] [--lookup <reference|transactionId>]
//
// WHY THIS EXISTS
// ---------------
// When "Instant EFT" (Ozow) fails, the customer only sees Ozow's own error screen, so the
// only way to tell "our request was rubbish" apart from "Ozow broke" is to replay the two
// calls that matter:
//
//   1. POST https://api.ozow.com/postpaymentrequest   - creates the payment request.
//      Ozow answers 200 even for a rejection, with the reason in `errorMessage` and no
//      `url`, so a missing `url`/`errorMessage` is the real signal, never the status code.
//   2. POST https://pay.ozow.com/api/transaction/initiate - what Ozow's hosted page calls
//      the moment it opens, to create the payer session. This is the call that fails when
//      customers land on "Oops, this page cannot be found".
//
// `--methods` varies `selectedBankId` (which payment methods the account may use); `--payloads`
// varies the request shape itself (minimal, full, no notifyUrl, deliberately broken hash as a
// control) to show the failure does not depend on what the merchant sends. Both replay exactly
// the payload `createOzowCheckout` sends in production.
//
// `--lookup` asks Ozow for its own record of a transaction (status, statusMessage, bank),
// which is the fastest way to see whether money moved / why a payment did not complete.
//
// Credentials come from the environment and are never printed:
//   OZOW_API_KEY        - private key (hash signing only)
//   OZOW_API_KEY_NORMAL - API key sent in the ApiKey header
//   OZOW_SITE_CODE      - site code, e.g. AAA-AAA-000

const crypto = require('crypto');

const API_BASE = process.env.OZOW_API_BASE_URL || 'https://api.ozow.com';
const PAY_PAGE = 'https://pay.ozow.com';
const WEBSITE = 'https://studioextrait.co.za';
const NOTIFY_URL = 'https://us-central1-minara5.cloudfunctions.net/ozowWebhook';
const AMOUNT = '1.00';

// Payment method identifiers (hub.ozow.com/integration-methods/apis/money-in/payment-method-ids).
// Pay by Bank is enabled by default; every other method must be enabled by Ozow first, and an
// identifier the account is not enabled for is rejected with a clean "not available" message.
const METHODS = {
  'Pay by Bank (no selection)': null,
  'Card': '3B1ED354-46E8-465D-9213-8C7A8E5663CE',
  'Capitec Pay': '913999FA-3A32-4E3D-82F0-A1DF7E9E4F7B',
  'PayShap Request': 'EEC08676-46EB-4F80-AF56-CAA5A6623880',
  'FNB': '4816019C-3314-4C80-8B6B-B2CD16DCC4EC',
  'Standard Bank': 'AD7D8DA4-1723-4066-94BB-6662D845E483',
  'Nedbank': 'D3889DF6-CDAC-4861-9D64-2B100FB7ED07',
  'Crypto': '43FDB792-3B88-4D36-A13D-42B7661E9F76',
};

const PRIVATE_KEY = (process.env.OZOW_API_KEY || '').trim();
const API_KEY = (process.env.OZOW_API_KEY_NORMAL || '').trim();
const SITE_CODE = (process.env.OZOW_SITE_CODE || '').trim();

function sha512Hex(value) {
  return crypto.createHash('sha512').update(String(value), 'utf8').digest('hex');
}

// Values in Ozow's documented order, private key appended, whole string lowercased.
function buildHash(values) {
  return sha512Hex((values.join('') + PRIVATE_KEY).toLowerCase());
}

async function call(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  return {status: res.status, text};
}

function describe(response) {
  const text = response.text.length > 700 ? `${response.text.slice(0, 700)}...` : response.text;
  return `${response.status} ${text}`;
}

// Ozow hashes a payment request's fields in the order its documentation lists them,
// skipping anything we do not send, so this list is the single source of truth for both
// the payload and its `hashCheck` (isTest is field 17, selectedBankId field 18).
const HASH_FIELD_ORDER = [
  'siteCode', 'countryCode', 'currencyCode', 'amount', 'transactionReference', 'bankReference',
  'optional1', 'optional2', 'optional3', 'optional4', 'optional5', 'customer',
  'cancelUrl', 'errorUrl', 'successUrl', 'notifyUrl', 'isTest', 'selectedBankId',
  // Fields Ozow documents after selectedBankId (bankAccount* / branchCode / payeeDisplayName
  // occupy 19-22 and are never sent here).
  'expiryDateUtc', 'allowVariableAmount', 'variableAmountMin', 'variableAmountMax',
  'customerIdentifier',
  // customerCellphoneNumber is deliberately absent: Ozow's docs say "DO NOT include in the
  // hash check string, just ignore instead".
];

function newReference() {
  return `OZOWPROBE-${Date.now().toString().slice(-8)}`.toUpperCase();
}

function hashInputValues(body) {
  return HASH_FIELD_ORDER
      .filter((name) => body[name] !== undefined && body[name] !== null && String(body[name]) !== '')
      .map((name) => String(body[name]));
}

function buildHashFromBody(body) {
  return buildHash(hashInputValues(body));
}

// The exact concatenation the hash is taken over, with the private key shown in place but
// never printed - the order of these values is what a hashCheck rejection is usually about.
function describeHashInput(body) {
  return `${hashInputValues(body).join('')}<private key>`;
}

// The exact shape functions/index.js createOzowCheckout sends to Ozow, so a plain probe
// run exercises the production payload and not an idealised one.
function productionBody(amount, selectedBankId, isTest) {
  const reference = newReference();
  const body = {
    siteCode: SITE_CODE,
    countryCode: 'ZA',
    currencyCode: 'ZAR',
    amount,
    transactionReference: reference,
    bankReference: reference.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 20),
    optional1: 'probe@studioextrait.co.za',
    optional2: '0821234567',
    customer: 'Probe Test',
    cancelUrl: `${WEBSITE}/cancel.html`,
    errorUrl: `${WEBSITE}/cancel.html`,
    successUrl: `${WEBSITE}/success.html`,
    notifyUrl: NOTIFY_URL,
    isTest: Boolean(isTest),
  };
  if (selectedBankId) {
    body.selectedBankId = selectedBankId;
  }
  body.hashCheck = buildHashFromBody(body);
  return body;
}

async function createPaymentRequest(body) {
  const response = await call(`${API_BASE}/postpaymentrequest`, {
    method: 'POST',
    headers: {ApiKey: API_KEY, Accept: 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  console.log(`  postpaymentrequest  ${describe(response)}`);
  let parsed = null;
  try {
    parsed = JSON.parse(response.text);
  } catch (e) {
    parsed = null;
  }
  return {reference: body.transactionReference, paymentRequestId: parsed && parsed.paymentRequestId};
}

async function createThenInitiate(label, body) {
  console.log(`\n${label}`);
  const created = await createPaymentRequest(body);
  if (!created.paymentRequestId) {
    console.log('  -> no paymentRequestId, nothing to initiate');
    return created;
  }
  await initiateSession(created.paymentRequestId);
  return created;
}

async function initiateRaw(label, payload) {
  console.log(`\n${label}`);
  const response = await call(`${PAY_PAGE}/api/transaction/initiate`, {
    method: 'POST',
    headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  console.log(`  initiate            ${describe(response)}`);
}

// `--payloads` proves the failure does not depend on what WE send: each row creates a
// fresh payment request and calls the same `initiate` the hosted page calls, changing one
// aspect of the payload at a time (and including a deliberately broken request as a control).
async function payloadMatrix() {
  console.log(`Site ${SITE_CODE}: payload-shape matrix - is it our payload or their session builder?`);

  await createThenInitiate('1. Production shape - exactly what createOzowCheckout sends (R580.00)',
      productionBody('580.00'));

  const minimalReference = newReference();
  const minimal = {
    siteCode: SITE_CODE,
    countryCode: 'ZA',
    currencyCode: 'ZAR',
    amount: AMOUNT,
    transactionReference: minimalReference,
    bankReference: minimalReference,
    isTest: false,
  };
  minimal.hashCheck = buildHashFromBody(minimal);
  await createThenInitiate('2. Minimal payload - no customer, no URLs, no notifyUrl', minimal);

  const full = productionBody(AMOUNT);
  full.optional3 = 'three';
  full.optional4 = 'four';
  full.optional5 = 'five';
  full.expiryDateUtc = new Date(Date.now() + 86400000).toISOString().slice(0, 16).replace('T', ' ');
  full.customerIdentifier = '9501015800086';
  full.customerCellphoneNumber = '0821234567';
  full.hashCheck = buildHashFromBody(full);
  await createThenInitiate('3. Full payload - every documented optional field we may send', full);

  const noNotify = productionBody(AMOUNT);
  delete noNotify.notifyUrl;
  noNotify.hashCheck = buildHashFromBody(noNotify);
  await createThenInitiate('4. Production shape minus notifyUrl', noNotify);

  const badHash = productionBody(AMOUNT);
  badHash.hashCheck = '0'.repeat(128);
  await createThenInitiate('5. CONTROL - production shape with a deliberately wrong hashCheck', badHash);

  await initiateRaw('6. initiate with a paymentRequestId that was never created',
      {requestId: crypto.randomUUID(), viewName: ''});
  await initiateRaw('7. initiate with a malformed requestId', {requestId: 'not-a-guid', viewName: ''});
  await initiateRaw('8. initiate with an empty body', {});
}

// Ozow Support asked (9 Oct 2026) for the production request with the optional fields removed
// and the `hashCheck` recalculated, to see whether that clears the `initiate` 500. The second
// row is the same request cut back to the six required fields, so one run shows both cuts.
async function noOptionalsTest() {
  console.log(`Site ${SITE_CODE}: optional fields dropped, hashCheck recalculated`);

  const stripped = productionBody(AMOUNT);
  delete stripped.optional1;
  delete stripped.optional2;
  delete stripped.customer;
  stripped.hashCheck = buildHashFromBody(stripped);
  console.log(`  hash input: ${describeHashInput(stripped)}`);
  console.log(`  hashCheck:  ${stripped.hashCheck}`);
  await createThenInitiate('1. Production shape minus optional1, optional2 and customer', stripped);

  const reference = newReference();
  const required = {
    siteCode: SITE_CODE,
    countryCode: 'ZA',
    currencyCode: 'ZAR',
    amount: AMOUNT,
    transactionReference: reference,
    bankReference: reference.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 20),
    isTest: false,
  };
  required.hashCheck = buildHashFromBody(required);
  console.log(`  hash input: ${describeHashInput(required)}`);
  console.log(`  hashCheck:  ${required.hashCheck}`);
  await createThenInitiate('2. Control - the six required fields only, nothing optional', required);
}

async function initiateSession(paymentRequestId) {
  const response = await call(`${PAY_PAGE}/api/transaction/initiate`, {
    method: 'POST',
    headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify({requestId: paymentRequestId, viewName: ''}),
  });
  console.log(`  initiate            ${describe(response)}`);
  return response;
}

async function probe(label, selectedBankId) {
  const suffix = selectedBankId ? ` [selectedBankId ${selectedBankId}]` : '';
  return createThenInitiate(`${label}${suffix}`, productionBody(AMOUNT, selectedBankId, false));
}

async function lookup(target) {
  const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(target);
  const query = isGuid ?
    `transactionId=${encodeURIComponent(target)}` :
    `transactionReference=${encodeURIComponent(target)}`;
  const url = `${API_BASE}/${isGuid ? 'GetTransaction' : 'GetTransactionByReference'}` +
    `?siteCode=${encodeURIComponent(SITE_CODE)}&${query}`;
  const response = await call(url, {headers: {ApiKey: API_KEY, Accept: 'application/json'}});
  console.log(`\n${isGuid ? 'GetTransaction' : 'GetTransactionByReference'}`);
  console.log(`  ${describe(response)}`);
}

(async () => {
  const args = process.argv.slice(2);
  if (!PRIVATE_KEY || !API_KEY || !SITE_CODE) {
    console.error('Set OZOW_API_KEY, OZOW_API_KEY_NORMAL and OZOW_SITE_CODE first, e.g.');
    console.error('  $env:OZOW_API_KEY=(firebase functions:secrets:access OZOW_API_KEY).Trim()');
    process.exit(1);
  }
  if (args[0] === '--payloads') {
    await payloadMatrix();
    return;
  }
  if (args[0] === '--no-optionals') {
    await noOptionalsTest();
    return;
  }
  if (args[0] === '--methods') {
    for (const [label, id] of Object.entries(METHODS)) await probe(label, id);
    return;
  }
  if (args[0] === '--lookup') {
    if (!args[1]) {
      console.error('--lookup needs a transaction reference (EXTRAIT-...) or a transaction id');
      process.exit(1);
    }
    await lookup(args[1]);
    return;
  }
  console.log(`Site ${SITE_CODE}: one live Pay by Bank payment request, then the payer session`);
  await probe('Pay by Bank (live)', null);
})();
