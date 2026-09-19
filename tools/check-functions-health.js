// Studio Extrait - Cloud Functions health check
// Usage: node tools/check-functions-health.js [functionName ...]
//
// WHY THIS EXISTS
// ---------------
// When the admin panel shows "GitHub sync failed: internal", the message comes from
// the Firebase JS SDK collapsing an *infrastructure* failure (the Cloud Function not
// answering at all / no CORS headers / Cloud Run 5xx) into FunctionsError("internal").
// The two most common causes are:
//   1. The Firebase project has no active billing (Cloud Functions v2 = Cloud Run,
//      which requires the Blaze plan) -> every *.cloudfunctions.net URL answers with
//      Google's generic HTML "500 Server Error" page.
//   2. The functions were never deployed / were deleted.
// A healthy callable answers with JSON (e.g. {"error":{"status":"UNAUTHENTICATED"}}),
// which is all this script checks - it never sends credentials and changes nothing.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const REGION = process.env.FUNCTIONS_REGION || 'us-central1';

function projectId() {
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8'));
    const projects = rc.projects || {};
    return projects.default || Object.values(projects)[0] || '';
  } catch (e) {
    return '';
  }
}

function httpFunctionNames() {
  const src = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
  const names = [];
  const re = /exports\.([A-Za-z0-9_]+)\s*=\s*(onCall|onRequest)\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) names.push(m[1]);
  return [...new Set(names)];
}

async function probe(url) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}

    const httpsError = json && json.error && typeof json.error === 'object';
    const callableResult = json && Object.prototype.hasOwnProperty.call(json, 'result');
    // A callable that *validates its input* answers a credential-free probe with
    // HTTP 400 + {"error":{...}} - that is a healthy, reachable function.
    if (httpsError || callableResult) {
      return { ok: true, status: res.status, detail: 'callable answered: ' + (json.error ? json.error.status || json.error.message : 'result') };
    }
    // onRequest endpoints (webhooks) reject a credential-free probe with 401/403/405.
    if (res.status === 401 || res.status === 403 || res.status === 405) {
      return { ok: true, status: res.status, detail: 'endpoint reachable - rejected the credential-free probe (HTTP ' + res.status + ')' };
    }
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: res.status, detail: 'HTTP ' + res.status + ' - endpoint reachable (not a callable response)' };
    }
    return {
      ok: false,
      status: res.status,
      detail: 'HTTP ' + res.status + ' ' + (res.statusText || '') + ' - ' + (json ? 'JSON error body' : 'no callable JSON body (infrastructure/proxy error)'),
    };
  } catch (err) {
    return { ok: false, status: 0, detail: 'request failed: ' + (err.message || err) };
  }
}

(async () => {
  const project = projectId();
  if (!project) {
    console.error('Could not read the project id from .firebaserc');
    process.exit(1);
  }
  const requested = process.argv.slice(2);
  const names = requested.length ? requested : httpFunctionNames();
  if (!names.length) {
    console.error('No HTTP/callable functions found in functions/index.js');
    process.exit(1);
  }

  console.log(`Checking ${names.length} function(s) on project "${project}" (${REGION})...\n`);
  const results = [];
  for (const name of names) {
    const url = `https://${REGION}-${project}.cloudfunctions.net/${name}`;
    const r = await probe(url);
    results.push({ name, url, ...r });
    console.log(`${r.ok ? 'OK  ' : 'DOWN'}  ${name.padEnd(26)} ${r.detail}`);
  }

  const down = results.filter((r) => !r.ok);
  console.log('\n' + '-'.repeat(70));
  if (!down.length) {
    console.log(`All ${results.length} function(s) are reachable.`);
    process.exit(0);
  }
  console.log(`${down.length} of ${results.length} function(s) are NOT reachable.`);
  console.log('\nThe admin panel can only report this as "GitHub sync failed: internal"');
  console.log('(the SDK hides infrastructure errors), so treat this as the real cause.');
  console.log('\nMost likely fixes, in order:');
  console.log('  1. Enable/restore billing for the project (Firebase console -> Usage and billing');
  console.log('     -> Blaze plan). Cloud Functions v2 runs on Cloud Run and needs it.');
  console.log('  2. Re-deploy the functions:  firebase deploy --only functions --project ' + project);
  console.log('  3. Re-run this check.');
  process.exit(1);
})();
