// Headless smoke test for the finance tab renderers.
// Loads js/admin/admin-finance.js with a tiny DOM stub, feeds it the real
// expense ledger (15 known costs + one paid order) and asserts that the KPI,
// ledger and chart markup actually contain money instead of zeros.
// Run: node tools/test-finance-ui.js
const fs = require('fs');
const path = require('path');

const elements = {};
function el(id) {
  if (!elements[id]) {
    elements[id] = {
      id: id,
      innerHTML: '',
      textContent: '',
      value: '',
      type: '',
      checked: false,
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
      style: {},
      getAttribute() { return null; },
      setAttribute() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      focus() {}
    };
  }
  return elements[id];
}

global.document = {
  readyState: 'complete',
  getElementById: (id) => el(id),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => el('created-' + Math.random()),
  body: { appendChild() {}, removeChild() {} },
  addEventListener() {}
};
global.window = global;
global.alert = () => {};
global.confirm = () => true;
window.auth = { currentUser: { email: 'jadon@studioextrait.co.za' } };
window.minaraGetFinanceSettings = () => ({
  costing: {}, oilLibrary: [], gateways: { ozow: { feePercent: 2.5, payoutDelayDays: 1 }, yoco: { feePercent: 2.95, payoutDelayDays: 2 } },
  vat: { registered: false, rate: 15 }, bank: { openingBalance: 0 }
});
window.minaraComputeLineCost = () => ({
  total: 50, breakdown: { oil: 30, ethanol: 10, bottle: 8, box: 2, bubble: 0, labels: 0 },
  estimatedOil: false, estimatedBottle: false, packagingType: 'single50', bottles: 1
});

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin', 'admin-finance.js'), 'utf8');
eval(code);

// ---- fixture: the 15 known costs, mirroring STARTER_EXPENSES ----
const EXPENSES = [
  ['2026-10-02', 'Labels', 'Label paper (PNA)', 106],
  ['2026-10-02', 'Boxes & packaging', 'Bostik glue stick (PNA)', 29],
  ['2026-10-03', 'Oils & fragrance', 'Live Life Fragrances — fragrance oils', 535],
  ['2026-10-03', 'Ethanol', 'Live Life Fragrances — 1L ethanol base', 80],
  ['2026-10-05', 'Bottles', 'Value Co — 3 × 1L jars', 190],
  ['2026-10-07', 'Oils & fragrance', 'Perfume oils (test bottles)', 593.18],
  ['2026-10-09', 'Courier & shipping', 'The Courier Guy', 200],
  ['2026-10-10', 'Website & software', 'Domain registration', 100],
  ['2026-10-12', 'Website & software', 'DeepSeek API', 300],
  ['2026-10-14', 'Equipment', '25 × 50ml syringes', 164],
  ['2026-10-15', 'Equipment', 'Water-soluble dyes (magenta, yellow, blue)', 105],
  ['2026-10-22', 'Courier & shipping', 'The Courier Guy — second delivery', 200],
  ['2026-10-24', 'Oils & fragrance', 'Perfume Oils — new test oils', 750],
  ['2026-10-26', 'Ethanol', 'Live Life Fragrances — 1L ethanol base (top-up)', 80],
  ['2026-10-26', 'Ethanol', 'Live Life Fragrances — 1L ethanol base (third bottle)', 80]
].map(([date, category, description, amount], i) => ({
  id: 'seed' + i, date, category, description, amount, type: 'expense', dateEstimated: true
}));

const FIN = window.__minaraFinance;
FIN.expenses = EXPENSES.slice();
FIN.orders = [{
  id: 'o1', paid: true, status: 'paid', createdAt: new Date().toISOString(), total: 250,
  paymentGateway: 'yoco', customerName: 'Test Buyer',
  items: [{ id: 'p1', name: 'Test 50ml', price: 250, quantity: 1, size: '50ml' }]
}];
FIN.products = [];
FIN.bank = [];
FIN.period = 'this_month';
FIN.loaded = true;

window.minaraFinanceRender();

const TOTAL = 3512.18;
const kpi = el('financeKpiGrid').innerHTML;
const ledger = el('financeExpensesTableBody').innerHTML;
const trend = el('financeTrendChart').innerHTML;
const net = el('financeNetChart').innerHTML;
const cats = el('financeCategoryChart').innerHTML;
const monthly = el('financeMonthlyTableBody').innerHTML;

const fails = [];
function check(name, cond, extra) {
  if (!cond) fails.push(name + (extra ? ' :: ' + extra : ''));
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
}

const rows = (ledger.match(/<tr>/g) || []).length;
check('ledger shows 15 expense rows', rows === 15, rows + ' rows');
check('ledger shows a minus sign', /−R/.test(ledger), 'contains −R');
check('ledger has red class', ledger.indexOf('fin-out') !== -1);
check('ledger has a 7th-Oct row', ledger.indexOf('Perfume oils (test bottles)') !== -1);
check('ledger has the new R750 oils', ledger.indexOf('new test oils') !== -1);
check('KPI shows net money out total', /3[\s,.]?512/.test(kpi), 'expected total 3512.18');
check('KPI money out is negative', kpi.indexOf('−R') !== -1);
check('KPI mentions all time', kpi.indexOf('All time') !== -1);
check('trend chart is an SVG', trend.indexOf('<svg') !== -1);
check('trend chart has bars', (trend.match(/<rect/g) || []).length >= 2, (trend.match(/<rect/g) || []).length + ' rects');
check('net chart is an SVG', net.indexOf('<svg') !== -1);
check('category chart has bars', (cats.match(/fin-cat-row/g) || []).length >= 3, (cats.match(/fin-cat-row/g) || []).length + ' rows');
check('category chart total is negative', cats.indexOf('−R') !== -1);
check('monthly P&L signed', /fin-strong/.test(monthly) && /fin-out/.test(monthly));

const combined = kpi + ledger + trend + net + cats + monthly +
  el('financeProductMarginsBody').innerHTML + el('financeBankTableBody').innerHTML +
  el('financeBankSummaryBody').innerHTML + el('financeGatewayTableBody').innerHTML;
check('no NaN in any rendered money', combined.indexOf('NaN') === -1);
check('no undefined in any rendered money', combined.indexOf('undefined') === -1);
check('loss month renders a red net bar', net.indexOf('fin-bar-out') !== -1);
check('profit/loss label present', net.indexOf('fin-svg-out') !== -1);

if (process.env.DUMP_CHARTS) {
  fs.writeFileSync(
    path.join(__dirname, 'chart-dump.html'),
    '<!doctype html><meta charset="utf-8"><body style="background:#fff;font-family:sans-serif">' +
    '<h2>Trend</h2>' + trend + '<h2>Net</h2>' + net + '<h2>Categories</h2>' + cats + '</body>',
    'utf8'
  );
}

// Empty-ledger path must show the auto-seed path notice, not a broken chart.
FIN.expenses = [];
FIN.orders = [];
window.minaraFinanceRender();
check('empty ledger renders an empty state', el('financeExpensesTableBody').innerHTML.indexOf('No money in or out') !== -1);
check('empty trend chart shows a message', el('financeTrendChart').innerHTML.indexOf('No money in or out') !== -1);

console.log('\n' + (fails.length ? 'FAILED: ' + fails.length : 'ALL CHECKS PASSED'));
if (fails.length) {
  console.log(fails.join('\n'));
  process.exit(1);
}
