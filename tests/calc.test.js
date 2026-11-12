// Pruebas del motor de cálculo contra las fórmulas del Excel original.
// Ejecutar: node tests/calc.test.js
const assert = require('assert');
const C = require('../js/calc.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok  -', name); }
  catch (e) { console.error('FAIL-', name, '\n     ', e.message); process.exitCode = 1; }
}
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('Filtro General: reglas del Excel', () => {
  const r = C.evaluateFilter('general', { perHist: 20, pfcfHist: 31, per: 18, pfcf: 25, evEbitda: 18,
    revCagr: 12, epsCagr: 10, ndE: 1, roic: 16, buyback: 0, dividend: 1, fcfMargin: 20 });
  const pass = Object.fromEntries(r.rows.map(x => [x.key, x.pass]));
  assert.deepStrictEqual(pass, { perHist: true, pfcfHist: false, per: true, pfcf: true, evEbitda: false,
    revCagr: true, epsCagr: false, ndE: true, roic: true, buyback: false, dividend: true, fcfMargin: true });
  assert.strictEqual(r.good, 8);
});

test('Filtro: reglas editables', () => {
  const r = C.evaluateFilter('services', { bookToBill: 1.2 }, { 1: { op: '>=', th: 1 } });
  assert.strictEqual(r.rows[1].pass, true);
});

test('Múltiplo máximo por EPS CAGR', () => {
  assert.deepStrictEqual(C.maxMultiples(25), { per: 40, evEbitda: 25 });
  assert.deepStrictEqual(C.maxMultiples(12), { per: 35, evEbitda: 18 });
  assert.deepStrictEqual(C.maxMultiples(0), { per: null, evEbitda: null });
});

test('EGM lineal = B10 + C10 + 0,1*((E10-F10)/F10)', () => {
  const e = C.egm({ epsGrowth: 12, buyback: 2, dividend: 1, perHist: 25, per: 20, years: 10, mode: 'linear' });
  close(e.total, 0.12 + 0.03 + 0.1 * (5 / 20));
});

test('EGM con margen de seguridad 30 %', () => {
  const e = C.egm({ epsGrowth: 10, safety: 30, buyback: 0, dividend: 0, perHist: 20, per: 20 });
  close(e.total, 0.07);
});

test('EPS analistas: precio = PER hist × EPS', () => {
  const r = C.epsAnalyst({ eps: [5, 6, 7, 8, 10], per: 20, price: 100, baseYear: 2026 });
  close(r.rows[4].target, 200);
  close(r.totalReturn, 1);
  close(r.simpleAvg, 0.2);              // lo que mostraba el Excel (F8/5)
  close(r.cagr, Math.pow(2, 1 / 5) - 1); // CAGR real
});

test('EPS crecimiento: K5 = K4*J4 + K4', () => {
  const r = C.epsGrowth({ baseEps: 4, cagr: 10, per: 20, price: 80, baseYear: 2026, years: 5 });
  close(r.rows[1].eps, 4.4);
  close(r.rows[4].eps, 4 * Math.pow(1.1, 4));
});

test('P/S: ventas crecen por año, precio = ventas × P/S / acciones', () => {
  const r = C.metricMultiple({ base: 1000, growth: [10, 10, 10, 10, 10], multiple: 3, shares: 100, price: 25, baseYear: 2026 });
  close(r.rows[0].value, 1100);
  close(r.rows[0].target, 33);
});

test('Graham: g = (PER-8,5)/2 y precio justo = EPS × (8,5 + 2g)', () => {
  const g = C.graham({ price: 100, epsNtm: 5, eps: 4, gExpected: 10, aaa: 4.4 });
  close(g.perNtm, 20);
  close(g.gImplied, 5.75);
  close(g.perFair, 28.5);
  close(g.fair, 114);
  close(g.fairRevised, 114);
});

test('Método del curso: proyección y precios', () => {
  const hist = v => Array(7).fill(v);
  const c = { revenue: hist(1000), da: hist(50), ebit: hist(200), interest: hist(10), taxes: hist(38),
    minority: hist(0), shares: hist(100), capex: hist(40), leases: hist(5), cash: hist(300),
    debt: hist(200), leaseDebt: hist(20), goodwill: hist(100), equity: hist(800), netDebtProj: [-100] };
  const k = C.course(c, { price: 20, growth: 10, ebitMargin: 20, taxRate: 20, buyback: 1,
    multiples: { per: 15, pfcf: 15, evEbitda: 10, evEbit: 12 }, dividendYield: 2 });
  close(k.rev[7], 1100);
  close(k.ebit[7], 220);
  close(k.interest[7], 11);
  close(k.taxes[7], (220 - 11) * 0.2);
  close(k.shares[7], 99);
  // FCF = EBITDA - capex - intereses - impuestos - minoritarios - leases
  close(k.fcf[6], 250 - 40 - 10 - 38 - 0 - 5);
  // ROIC = EBIT / (equity + deuda - caja + leases - goodwill)
  close(k.roic[6], 200 / (800 + 200 - 300 + 20 - 100));
  // Deuda neta histórica = deuda - caja + leases
  close(k.netDebt[6], -80);
  // Caja neta (-100) en 2027: PER suma la caja
  close(k.methods.per.prices[7], (k.ni[7] * 15 + 100) / 99);
  // EV/EBITDA resta la deuda neta
  close(k.methods.evEbitda.prices[7], (k.ebitda[7] * 10 + 100) / 99);
  // Años sin estimar mantienen la última deuda neta
  close(k.netDebt[8], -100);
  // CAGR 3 años + dividend yield
  close(k.methods.per.cagr3, Math.pow(k.methods.per.prices[9] / 20, 1 / 3) - 1 + 0.02);
});

test('GOOGL precargado reproduce los precios de su Excel (4. Valoración)', () => {
  const vm = require('vm');
  const sandbox = { window: {} };
  vm.runInNewContext(require('fs').readFileSync(__dirname + '/../js/seeds.js', 'utf8'), sandbox);
  const co = sandbox.window.SEED_COMPANIES.find(c => c.ticker === 'GOOGL');
  const a = co.course.assumptions;
  const k = C.course(co.course, { price: co.price, growth: a.growth, ebitMargin: a.ebitMargin, taxRate: a.taxRate,
    buyback: co.ratios.buyback, multiples: co.course.multiples, dividendYield: co.course.dividendYield });
  // Valores guardados en 2025-06-23_GOOGL_PDV.xlsx, filas 21–24 (2025–2030) y CAGR a 3 y 5 años
  const excel = {
    per: [183.8, 216.5, 250.4, 289.8, 335.5, 391.7], pfcf: [111.5, 133, 153.6, 177.5, 205.3, 239.5],
    evEbitda: [135.5, 155.8, 180.1, 208.2, 240.9, 281.1], evEbit: [167.8, 192.9, 223.1, 258.1, 298.7, 348.7]
  };
  Object.keys(excel).forEach(m => excel[m].forEach((v, i) => close(k.methods[m].prices[6 + i], v, 0.06)));
  close(k.methods.per.cagr3, 0.2116, 1e-4);
  close(k.methods.per.cagr5, 0.1938, 1e-4);
  close(k.methods.evEbit.cagr5, 0.1664, 1e-4);
  const ps = C.metricMultiple({ base: co.ps.revenue, growth: co.ps.growth, multiple: co.ps.multiple, shares: co.shares, price: co.price, baseYear: co.baseYear });
  [182.45, 209.82, 241.29, 277.49].forEach((v, i) => close(ps.rows[i].target, v, 0.01));
  const ea = C.epsAnalyst({ eps: co.eps.analyst, per: co.eps.per, price: co.price, baseYear: co.baseYear });
  [220.8, 234.6, 265.88, 311.42].forEach((v, i) => close(ea.rows[i].target, v, 0.01));
  assert.strictEqual(ea.rows[4].target, null);
  close(ea.totalReturn, 311.42 / 165 - 1, 1e-3); // último año con estimación
});

test('TIKR: lee tablas copiadas y las convierte al método del curso', () => {
  const T = require('../js/tikr.js');
  close(T.parseNum('(32,639.00)'), -32639);
  close(T.parseNum('USD 142.62'), 142.62);
  assert.strictEqual(T.parseNum('NM'), null);
  const tsv = [
    'Income Statement | TIKR.com\t1/26/25\t1/25/26\tLTM',
    'Total Revenues\t130,497.00\t215,938.00\t302,970.00',
    '   % Change YoY\t1.142\t0.655\t',
    'Operating Income\t81,453.00\t130,387.00\t197,579.00',
    'Interest Expense\t-247\t-259\t-464',
    'Interest And Investment Income\t1,786.00\t2,300.00\t2,229.00',
    'Other Non Operating Income (Expenses)\t4\t104\t-153',
    'Income Tax Expense\t(11,146.00)\t(21,383.00)\t(36,863.00)',
    'Net Income to Company\t72,880.00\t120,067.00\t192,880.00',
    'Net Income\t72,880.00\t120,067.00\t192,880.00',
    'Weighted Average Diluted Shares Outstanding\t24,804.00\t24,514.00\t24,397.50',
    'EBITDA\t83,317.00\t133,230.00\t201,266.00',
    'Balance Sheet | TIKR.com\t1/26/25\t1/25/26\tLTM',
    'Total Cash And Short Term Investments\t43,210.00\t62,556.00\t62,469.00',
    'Goodwill\t5,188.00\t20,832.00\t21,125.00',
    'Current Portion of Long-Term Debt\t\t999\t1,000.00',
    'Current Portion of Capital Lease Obligations\t\t372\t509',
    'Long-Term Debt\t8,463.00\t7,469.00\t32,366.00',
    'Capital Leases\t1,519.00\t2,572.00\t4,985.00',
    'Total Common Equity\t79,327.00\t157,293.00\t228,984.00',
    'Cash Flow | TIKR.com\t1/26/25\t1/25/26\tLTM',
    'Depreciation & Amort., Total\t1,900.00\t2,900.00\t3,700.00',
    'Capital Expenditure\t(3,236.00)\t(6,042.00)\t(7,000.00)'
  ].join('\n');
  const tables = T.parseText(tsv, { currentYear: 2026 });
  assert.deepStrictEqual(tables.map(t => t.type), ['income', 'balance', 'cashflow']);
  const r = T.toCourse(tables);
  assert.strictEqual(r.baseYear, 2026);                 // LTM = año en curso
  assert.deepStrictEqual(Object.keys(r.years), ['2024', '2025', '2026']); // cierres de enero = año anterior
  const y = r.years[2026];
  close(y.interest, -1765);                             // gasto 464 − ingresos 2.229
  close(y.taxes, 36863);
  close(y.minority, 0);
  close(y.debt, 33366);
  close(y.leaseDebt, 5494);
  close(y.debt - y.cash + y.leaseDebt, -23609);         // deuda neta igual que TIKR
  close(y.da, 3700);                                    // el Cash Flow reemplaza EBITDA − EBIT
  close(y.capex, 7000);
  assert.deepStrictEqual(r.missing, []);
});

console.log(`\n${passed} pruebas correctas`);
