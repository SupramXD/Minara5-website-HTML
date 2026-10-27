// Dev-only sanity checks after the finance-tab edit:
//  - div balance in admin.html
//  - brace balance in admin.css
//  - the new finance element ids exist
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'admin.css'), 'utf8');

let depth = 0;
let maxDepth = 0;
const re = /<div\b|<\/div>/gi;
let m;
while ((m = re.exec(html))) {
  if (m[0].toLowerCase() === '<div') depth++;
  else depth--;
  maxDepth = Math.max(maxDepth, depth);
  if (depth < 0) {
    console.log('DIV closes below zero at char ' + m.index);
    break;
  }
}
console.log('admin.html div depth at EOF: ' + depth + ' (max ' + maxDepth + ')');

function countBalanced(text, open, close) {
  let d = 0;
  for (const ch of text) {
    if (ch === open) d++;
    else if (ch === close) d--;
    if (d < 0) return 'negative';
  }
  return d;
}
console.log('admin.css brace balance: ' + countBalanced(css, '{', '}'));

['financeTrendChart', 'financeTrendLegend', 'financeNetChart', 'financeCategoryChart', 'financeExpensePeriodNote', 'financeKpiGrid', 'financeExpensesTableBody']
  .forEach((id) => {
    const ok = html.indexOf('id="' + id + '"') !== -1;
    console.log((ok ? 'OK   ' : 'MISS ') + id);
  });
