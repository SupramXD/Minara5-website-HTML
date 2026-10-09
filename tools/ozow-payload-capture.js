// Studio Extrait - Ozow payload capture
// Usage: node tools/ozow-payload-capture.js [--amount 580.00] [--out tools/ozow-captures]
//
// WHY THIS EXISTS
// ---------------
// Ozow support asked us for "the payload of the request" so they can see how the
// data is being passed. `tools/ozow-probe.js` reports *outcomes*; it never prints
// what was sent. This tool records the exact body of both requests in the flow,
// plus each response, so the whole exchange can be pasted into a support ticket:
//
//   1. POST https://api.ozow.com/postpaymentrequest        - what our server sends.
//   2. POST https://pay.ozow.com/api/transaction/initiate  - what Ozow's own hosted
//      page sends to start the payer session. This is the call that fails.
//
// SAFE TO SHARE: the request bodies and the `hashCheck` are printed verbatim, the
// `ApiKey` header is redacted, and the private key is only ever used to sign the
// hash - it is never sent to Ozow and never printed here. Customer-identifying
// values use the same probe placeholders as ozow-probe.js, so no order PII is in
// the capture.
//
// Credentials come from the environment and are never printed:
//   OZOW_API_KEY        - private key (hash signing only)
//   OZOW_API_KEY_NORMAL - API key sent in the ApiKey header
//   OZOW_SITE_CODE      - site code, e.g. AAA-AAA-000

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.OZOW_API_BASE_URL || 'https://api.ozow.com';
const PAY_PAGE = process.env.OZOW_PAY_PAGE_URL || 'https://pay.ozow.com';
const WEBSITE = 'https://studioextrait.co.za';
const NOTIFY_URL = 'https://us-central1-minara5.cloudfunctions.net/ozowWebhook';

// Card is the control: the account is not enabled for it, so its `initiate`
// answers cleanly, which is what proves the endpoint itself works.
const CARD_ID = '3B1ED354-46E8-465D-9213-8C7A8E5663CE';

const PRIVATE_KEY = (process.env.OZOW_API_KEY || '').trim();
const API_KEY = (process.env.OZOW_API_KEY_NORMAL || '').trim();
const SITE_CODE = (process.env.OZOW_SITE_CODE || '').trim();

// Ozow hashes a request's fields in the order its documentation lists them,
// skipping anything we do not send - identical to ozow-probe.js and to
// buildOzowRequestHash() in functions/index.js.
const HASH_FIELD_ORDER = [
  'siteCode', 'countryCode', 'currencyCode', 'amount', 'transactionReference', 'bankReference',
  'optional1', 'optional2', 'optional3', 'optional4', 'optional5', 'customer',
  'cancelUrl', 'errorUrl', 'successUrl', 'notifyUrl', 'isTest', 'selectedBankId',
  'expiryDateUtc', 'allowVariableAmount', 'variableAmountMin', 'variableAmountMax',
  'customerIdentifier',
];

const md = [];

function say(line) {
  md.push(line === undefined ? '' : line);
  console.log(line === undefined ? '' : line);
}

function sha512Hex(value) {
  return crypto.createHash('sha512').update(String(value), 'utf8').digest('hex');
}

function buildHashFromBody(body) {
  const values = HASH_FIELD_ORDER
      .filter((name) => body[name] !== undefined && body[name] !== null && String(body[name]) !== '')
      .map((name) => body[name]);
  return sha512Hex((values.join('') + PRIVATE_KEY).toLowerCase());
}

// The exact shape functions/index.js createOzowCheckout sends to Ozow, with the
// same reference format and the same redirect/notify URLs, so this exercises the
// production payload and not an idealised one.
function productionBody(amount, selectedBankId) {
  const reference = `EXTRAIT-${Math.floor(Math.random() * 900000 + 100000)}-` +
    `${Date.now().toString().slice(-4)}`;
  const withRedirectParams = (target) =>
    `${target}?reference=${encodeURIComponent(reference)}&gateway=ozow`;
  const body = {
    siteCode: SITE_CODE,
    countryCode: 'ZA',
    currencyCode: 'ZAR',
    amount: amount,
    transactionReference: reference,
    bankReference: reference.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 20),
    optional1: 'probe@studioextrait.co.za',
    optional2: '0821234567',
    customer: 'Probe Test',
    cancelUrl: withRedirectParams(`${WEBSITE}/cancel.html`),
    errorUrl: withRedirectParams(`${WEBSITE}/cancel.html`),
    successUrl: withRedirectParams(`${WEBSITE}/success.html`),
    notifyUrl: NOTIFY_URL,
    isTest: false,
  };
  if (selectedBankId) {
    body.selectedBankId = selectedBankId;
  }
  body.hashCheck = buildHashFromBody(body);
  return body;
}

function minimalBody(amount) {
  const reference = `EXTRAIT-${Math.floor(Math.random() * 900000 + 100000)}-` +
    `${Date.now().toString().slice(-4)}`;
  const body = {
    siteCode: SITE_CODE,
    countryCode: 'ZA',
    currencyCode: 'ZAR',
    amount: amount,
    transactionReference: reference,
    bankReference: reference,
    isTest: false,
  };
  body.hashCheck = buildHashFromBody(body);
  return body;
}

async function post(url, headers, bodyText) {
  const res = await fetch(url, {method: 'POST', headers, body: bodyText});
  const text = await res.text();
  const headersOut = {};
  res.headers.forEach((value, key) => {
    headersOut[key] = value;
  });
  return {status: res.status, text, headers: headersOut};
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function headerBlock(headers) {
  const keys = Object.keys(headers).filter((k) =>
    /trace|request|activity|server|date|content-type/i.test(k));
  if (!keys.length) {
    return '_no diagnostic response headers_';
  }
  return keys.map((k) => `\`${k}: ${headers[k]}\``).join(' · ');
}

const outcomes = [];

async function createPaymentRequest(label, body) {
  say(`### ${label}`);
  say();
  say(`Request: \`POST ${API_BASE}/postpaymentrequest\``);
  say();
  say('Headers: `Content-Type: application/json`, `Accept: application/json`, ' +
    '`ApiKey: <merchant ApiKey - withheld>`');
  say();
  say('Body sent:');
  say();
  say('```json');
  say(JSON.stringify(body, null, 2));
  say('```');
  say();
  const res = await post(`${API_BASE}/postpaymentrequest`,
      {ApiKey: API_KEY, Accept: 'application/json', 'Content-Type': 'application/json'},
      JSON.stringify(body));
  const parsed = parseJson(res.text);
  say(`Response: **HTTP ${res.status}**`);
  say();
  say('```json');
  say(parsed ? JSON.stringify(parsed, null, 2) : res.text);
  say('```');
  say();
  const paymentRequestId = parsed && parsed.paymentRequestId;
  outcomes.push({case: label, status: res.status,
    result: parsed && parsed.errorMessage ? `errorMessage: ${parsed.errorMessage}` :
      (paymentRequestId ? `paymentRequestId ${paymentRequestId}` : res.text.slice(0, 120))});
  return {reference: body.transactionReference, paymentRequestId, body, parsed};
}

async function initiateCall(label, payload) {
  say(`### ${label}`);
  say();
  say(`Request: \`POST ${PAY_PAGE}/api/transaction/initiate\``);
  say();
  say('Headers: `Content-Type: application/json`, `Accept: application/json` ' +
    '(this call is made by Ozow\'s own hosted payment page, not by our server)');
  say();
  say('Body sent:');
  say();
  say('```json');
  say(JSON.stringify(payload, null, 2));
  say('```');
  say();
  const res = await post(`${PAY_PAGE}/api/transaction/initiate`,
      {Accept: 'application/json', 'Content-Type': 'application/json'},
      JSON.stringify(payload));
  say(`Response: **HTTP ${res.status}**`);
  say();
  say(headerBlock(res.headers));
  say();
  say('```json');
  say(res.text);
  say('```');
  say();
  outcomes.push({case: label, status: res.status, result: res.text.slice(0, 160)});
  return res;
}


function flag(name, fallback) {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

(async () => {
  const amount = flag('--amount', '580.00');
  const outDir = flag('--out', path.join('tools', 'ozow-captures'));
  if (!PRIVATE_KEY || !API_KEY || !SITE_CODE) {
    console.error('Set OZOW_API_KEY, OZOW_API_KEY_NORMAL and OZOW_SITE_CODE first, e.g.');
    console.error('  $env:OZOW_API_KEY=(firebase functions:secrets:access OZOW_API_KEY).Trim()');
    process.exit(1);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  say('# Ozow payin - captured request payloads');
  say();
  say(`Merchant \`STUDIOEXTRAITPTYLTD\` · site \`${SITE_CODE}\` · captured ` +
    `${new Date().toISOString()} (${new Date().toUTCString()}) on \`${API_BASE}\`.`);
  say();
  say('The two requests below are the complete exchange: (1) the payment request our ' +
    'server posts, and (2) the payer-session call Ozow\'s own hosted page makes. ' +
    '`ApiKey` is withheld and the private key is never transmitted, only used to ' +
    'sign `hashCheck`. Customer fields are probe placeholders, not order PII.');
  say();

  const first = await createPaymentRequest(
      `1. Production payment request - Pay by Bank, R${amount}`, productionBody(amount));
  const firstInitiate = first.paymentRequestId ?
    {requestId: first.paymentRequestId, viewName: ''} : null;
  if (firstInitiate) {
    await initiateCall('1b. Payer session for request 1 (this is the failing call)',
        firstInitiate);
  }

  const minimal = await createPaymentRequest(
      '2. Minimal payment request - six required fields only, no URLs, no notifyUrl',
      minimalBody(amount));
  if (minimal.paymentRequestId) {
    await initiateCall('2b. Payer session for request 2',
        {requestId: minimal.paymentRequestId, viewName: ''});
  }

  const card = await createPaymentRequest(
      '3. CONTROL - same payload, only `selectedBankId` changed to Card',
      productionBody(amount, CARD_ID));
  if (card.paymentRequestId) {
    await initiateCall('3b. Payer session for request 3 (Card - account not enabled for it)',
        {requestId: card.paymentRequestId, viewName: ''});
  }


  const badHash = productionBody(amount);
  badHash.hashCheck = '0'.repeat(128);
  await createPaymentRequest(
      '4. CONTROL - production payload with a deliberately wrong `hashCheck`', badHash);

  await initiateCall('5. `initiate` for a `requestId` that was never created',
      {requestId: crypto.randomUUID(), viewName: ''});
  await initiateCall('6. `initiate` with an empty body', {});
  await initiateCall('7. `initiate` with a malformed `requestId`',
      {requestId: 'not-a-guid', viewName: ''});

  say('## Summary');
  say();
  say('| # | request | HTTP | outcome |');
  say('|---|---|---|---|');
  outcomes.forEach((row, index) => {
    const result = row.result.replace(/\|/g, '\\|').replace(/\s+/g, ' ').slice(0, 150);
    say(`| ${index + 1} | ${row.case.replace(/\|/g, '\\|')} | ${row.status} | ${result} |`);
  });
  say();

  fs.mkdirSync(outDir, {recursive: true});
  const mdPath = path.join(outDir, `${stamp}-ozow-payload-capture.md`);
  fs.writeFileSync(mdPath, md.join('\n') + '\n', 'utf8');
  const paymentRequestPath = path.join(outDir, `${stamp}-payment-request-payload.json`);
  fs.writeFileSync(paymentRequestPath, JSON.stringify(first.body, null, 2) + '\n', 'utf8');
  const initiatePath = path.join(outDir, `${stamp}-initiate-payload.json`);
  fs.writeFileSync(initiatePath,
      JSON.stringify(firstInitiate || {requestId: '<no paymentRequestId>', viewName: ''},
          null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${mdPath}\n      ${paymentRequestPath}\n      ${initiatePath}`);
})().catch((err) => {
  console.error(`[ERROR] ${err && err.message ? err.message : err}`);
  process.exit(2);
});

