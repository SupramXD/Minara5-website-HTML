// Studio Extrait - Ozow payin probe
// Usage: node tools/ozow-probe.js [--methods] [--lookup <reference|transactionId>]
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

async function createPaymentRequest(selectedBankId) {
  const reference = `OZOWPROBE-${Date.now().toString().slice(-8)}`.toUpperCase();
  const body = {
    siteCode: SITE_CODE,
    countryCode: 'ZA',
    currencyCode: 'ZAR',
    amount: AMOUNT,
    transactionReference: reference,
    bankReference: reference,
    optional1: 'probe@studioextrait.co.za',
    optional2: '0821234567',
    customer: 'Probe Test',
    cancelUrl: `${WEBSITE}/cancel.html`,
    errorUrl: `${WEBSITE}/cancel.html`,
    successUrl: `${WEBSITE}/success.html`,
    notifyUrl: NOTIFY_URL,
    isTest: false,
  };
  // isTest is field 17 and selectedBankId field 18 of Ozow's concatenation order; only
  // fields we actually send are hashed, so the list must track `body` exactly.
  const values = [SITE_CODE, 'ZA', 'ZAR', AMOUNT, reference, reference,
    body.optional1, body.optional2, body.customer, body.cancelUrl, body.errorUrl,
    body.successUrl, body.notifyUrl, 'false'];
  if (selectedBankId) {
    body.selectedBankId = selectedBankId;
    values.push(selectedBankId);
  }
  body.hashCheck = buildHash(values);

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
  return {reference, paymentRequestId: parsed && parsed.paymentRequestId};
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
  console.log(`\n${label}${selectedBankId ? ` [selectedBankId ${selectedBankId}]` : ''}`);
  const created = await createPaymentRequest(selectedBankId);
  if (!created.paymentRequestId) {
    console.log('  -> no paymentRequestId, nothing to initiate');
    return;
  }
  await initiateSession(created.paymentRequestId);
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
