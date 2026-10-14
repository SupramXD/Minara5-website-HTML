// Studio Extrait - live rail check (deployed function + Ozow's payer session)
// Usage: node tools/ozow-live-rail-check.js [--rail ozow|capitec|all] [--no-initiate]
//
// WHY THIS EXISTS
// ---------------
// `ozow-probe.js` talks to Ozow directly, so it needs the merchant secrets. This script talks to
// OUR deployed `createOzowCheckout` instead, then replays the ONE call Ozow's hosted page makes
// when it opens (`POST https://pay.ozow.com/api/transaction/initiate`) with the `paymentRequestId`
// our own function hands back. No secrets needed, and it answers the two questions a "the wrong
// screen opened" report always comes down to:
//
//   1. Is the DEPLOYED function the code in this repo? The response carries `rail` and
//      `selectedBankId`; a response without them means the function predates the change (hosting
//      auto-deploys from GitHub, Cloud Functions do not - they need `firebase deploy --only
//      functions`).
//   2. What does the customer's browser get? `initiate` is what draws the payer screen: the
//      method that was asked for, or Ozow's "The selected bank is not available for this
//      merchant..." fallback to the generic bank picker.
//
// It creates one real payment request per rail (R1, `isTest` follows the server config) and leaves
// a pending order doc behind, exactly like a real checkout attempt.


const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const REGION = process.env.FUNCTIONS_REGION || 'us-central1';
const PROJECT = (() => {
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8'));
    const projects = rc.projects || {};
    return projects.default || Object.values(projects)[0] || '';
  } catch (e) {
    return '';
  }
})();

const CAPITEC_PAY_BANK_ID = '913999FA-3A32-4E3D-82F0-A1DF7E9E4F7B';
const AMOUNT = Number(process.env.RAIL_CHECK_AMOUNT || 1);
const RAILS = {
  ozow: {label: 'Instant EFT (Pay by Bank)', selectedBankId: null},
  capitec: {label: 'Capitec Pay (Bank API method)', selectedBankId: CAPITEC_PAY_BANK_ID},
};

function truncate(text, max) {
  const limit = max || 600;
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return {status: res.status, text, json};
}

async function createSession(rail, selectedBankId) {
  const url = `https://${REGION}-${PROJECT}.cloudfunctions.net/createOzowCheckout`;
  const payload = {
    customer: {email: 'probe@studioextrait.co.za', firstName: 'Rail', lastName: 'Probe', phone: '0821234567'},
    items: [{name: 'Rail probe', price: AMOUNT, quantity: 1}],
    shipping: {address: 'Rail probe - not a real order'},
    total: AMOUNT,
    callbackUrl: 'https://studioextrait.co.za/success.html',
    cancelUrl: 'https://studioextrait.co.za/cancel.html',
  };
  if (selectedBankId) payload.selectedBankId = selectedBankId;

  const response = await postJson(url, {data: payload});
  const result = response.json && response.json.result;
  const error = response.json && response.json.error;

  console.log(`\n=== ${rail.label} ===`);
  if (error) {
    console.log(`  createOzowCheckout  HTTP ${response.status} ${error.status}: ${error.message}`);
    if (/not supported/i.test(String(error.message || ''))) {
      console.log('  -> the deployed function KNOWS the identifier whitelist, so it is at least as');
      console.log('     new as this repo; only the value or the Ozow enablement can be wrong.');
    }
    return null;
  }
  if (!result) {
    console.log(`  createOzowCheckout  HTTP ${response.status} ${truncate(response.text)}`);
    return null;
  }

  const deployed = result.rail === undefined && result.selectedBankId === undefined;
  console.log(`  createOzowCheckout  HTTP ${response.status}`);
  console.log(`    rail              ${deployed ? '(ABSENT - deployed code is OLDER than this repo)' : result.rail}`);
  console.log(`    selectedBankId    ${deployed ? '(ABSENT - deployed code is OLDER than this repo)' : (result.selectedBankId || 'null')}`);
  console.log(`    paymentRequestId  ${result.paymentRequestId || '(none)'}`);
  console.log(`    redirectUrl       ${result.redirectUrl || '(none)'}`);
  return result.paymentRequestId || null;
}

(async () => {
  const args = process.argv.slice(2);
  const railArg = args.includes('--rail') ? args[args.indexOf('--rail') + 1] : 'all';
  const skipInitiate = args.includes('--no-initiate');
  const names = railArg === 'all' ? Object.keys(RAILS) : [railArg];
  names.forEach((name) => {
    if (!RAILS[name]) {
      console.error(`Unknown rail "${name}" - use one of: ${Object.keys(RAILS).join(', ')}, all`);
      process.exit(1);
    }
  });
  if (!PROJECT) {
    console.error('Could not read the Firebase project from .firebaserc');
    process.exit(1);
  }

  console.log(`Project ${PROJECT} (${REGION}) - one live payment request per rail`);
  for (const name of names) {
    const requestId = await createSession(RAILS[name], RAILS[name].selectedBankId);
    if (requestId && !skipInitiate) await initiate(requestId);
  }
  console.log('\nA payer screen that lists banks instead of opening Capitec Pay means Ozow fell back:');
  console.log('the method is not enabled for this merchant site (see tools/OZOW-SUPPORT-REPORT.md).');
})();


// Exactly what https://pay.ozow.com/<id>/Secure calls on load - this response decides what the
// customer sees: the method's own screen, the generic bank picker, or Ozow's error screen.
async function initiate(requestId) {
  const res = await fetch('https://pay.ozow.com/api/transaction/initiate', {
    method: 'POST',
    headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify({requestId: requestId, viewName: ''}),
  });
  const text = await res.text();
  console.log(`  initiate (payer screen)  HTTP ${res.status} ${truncate(text, 900)}`);
  return text;
}
