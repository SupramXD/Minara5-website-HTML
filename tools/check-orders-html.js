// Dev-only sanity checks after the orders-tab redesign (2026-10-27):
//  - div balance in admin.html + brace balance in admin.css
//  - every getElementById("...") used by admin-orders.js exists in admin.html
//  - the order overlays sit OUTSIDE #orders-tab (a transformed tab makes
//    position:fixed resolve against the panel, which was the scroll bug)
//  - the light-theme classes are actually styled
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'admin.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'admin', 'admin-orders.js'), 'utf8');

const fails = [];
function check(name, cond, extra) {
  if (!cond) fails.push(name + (extra ? ' :: ' + extra : ''));
  console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
}

let depth = 0;
let minDepth = 0;
const re = /<div\b|<\/div>/gi;
let m;
while ((m = re.exec(html))) {
  if (m[0].toLowerCase() === '<div') depth++;
  else depth--;
  minDepth = Math.min(minDepth, depth);
}
check('admin.html divs balance', depth === 0 && minDepth >= 0, 'depth ' + depth + ', min ' + minDepth);

let braces = 0;
for (const ch of css) {
  if (ch === '{') braces++;
  else if (ch === '}') braces--;
  if (braces < 0) break;
}
check('admin.css braces balance', braces === 0, 'balance ' + braces);

// ids referenced from the orders module must exist in the markup
// (two of them are created at runtime, so they are allowed to be absent)
const DYNAMIC_IDS = ['orderCopyToast', 'modalWaybillInput'];
const ids = new Set();
const idRe = /getElementById\(\s*["']([^"']+)["']\s*\)/g;
let hit;
while ((hit = idRe.exec(js))) ids.add(hit[1]);
const missing = [...ids].filter((id) => DYNAMIC_IDS.indexOf(id) === -1 && html.indexOf('id="' + id + '"') === -1);
check('every getElementById id exists in admin.html', missing.length === 0, missing.join(', ') || ids.size + ' ids');

// overlays must not live inside #orders-tab
const tabStart = html.indexOf('<div id="orders-tab"');
const tabEnd = html.indexOf('<!-- TAB 1:', tabStart);
const insideTab = html.slice(tabStart, tabEnd);
['orderDetailModal', 'orderDeleteDialog', 'courierDispatchModal'].forEach((id) => {
  check('#' + id + ' is outside #orders-tab', insideTab.indexOf('id="' + id + '"') === -1);
  check('#' + id + ' exists once', (html.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1);
});

// rows container must be the vertical list, not the old grid
check('orders list is a flex column', /\.ord-list\s*\{[^}]*display:\s*flex/.test(css));
check('order row is one horizontal line', /\.ord-row\s*\{[^}]*grid-template-columns/.test(css));
check('light modal styling exists', css.indexOf('.ord-modal .ord-modal-content') !== -1);
check('delete confirm styling exists', css.indexOf('.ord-confirm-title') !== -1);
check('delete flow wired to Firestore', js.indexOf('dbDeleteDoc(window.dbDoc(window.db, "orders", id))') !== -1);
check('rows render a delete button', js.indexOf('askDeleteOrder(') !== -1);
check('renderer no longer emits .order-card blocks', js.indexOf('"order-card"') === -1 && js.indexOf('order-card-accent-line') === -1);

console.log('\n' + (fails.length ? 'FAILED: ' + fails.length : 'ALL ORDER HTML CHECKS PASSED'));
if (fails.length) process.exit(1);
