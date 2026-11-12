/*
 * Lector de tablas de TIKR (Income Statement, Balance Sheet, Cash Flow).
 * Acepta texto copiado de TIKR (columnas separadas por tabulador) o una hoja de Excel
 * donde se pegaron esas tablas. Convierte los datos a los campos del método del curso.
 * Funciones puras: se pueden probar con Node.
 */
(function (root) {
  'use strict';

  function clean(s) { return String(s == null ? '' : s).replace(/ /g, ' ').trim(); }
  function norm(s) { return clean(s).toLowerCase().replace(/\s+/g, ' '); }

  /** '130,497.00' → 130497 · '(32,639.00)' → -32639 · 'USD 142.62' → 142.62 · '-' / 'NM' → null */
  function parseNum(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v instanceof Date) return null;
    var s = clean(v);
    if (!s || s === '-' || s === '—' || /^n\/?m$/i.test(s) || /^n\/?a$/i.test(s)) return null;
    var neg = /^\(.*\)$/.test(s) || /^-/.test(s);
    var pct = /%$/.test(s);
    s = s.replace(/[A-Za-z$€£\s()%,]/g, '').replace(/^-/, '');
    if (!s || isNaN(Number(s))) return null;
    var x = Number(s) * (neg ? -1 : 1);
    return pct ? x / 100 : x;
  }

  /** Año calendario de un cierre fiscal: los cierres de enero a mayo cuentan para el año anterior. */
  function fiscalToCalendar(d) { return d.getMonth() < 5 ? d.getFullYear() - 1 : d.getFullYear(); }

  function parseHeaderCell(v) {
    if (v instanceof Date) return { date: v };
    if (typeof v === 'number') { // número de serie de Excel (fechas 1954–2119); otros números no son encabezados
      return v > 20000 && v < 80000 ? { date: new Date(Math.round((v - 25569) * 864e5)) } : null;
    }
    var s = clean(v);
    if (!s) return null;
    if (/^ltm$|^ttm$/i.test(s)) return { ltm: true };
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s); // 1/26/25
    if (m) { var y = Number(m[3]); if (y < 100) y += 2000; return { date: new Date(y, Number(m[1]) - 1, Number(m[2])) }; }
    m = /^(?:fy|cy)?\s?(\d{4})$/i.exec(s);
    if (m) return { year: Number(m[1]) };
    // fechas escritas con el mes en letras: 'Jan 26, 2025', '26-Jan-2025'
    if (/[a-z]{3}/i.test(s) && /\d{4}|\d{2}$/.test(s)) {
      var t = Date.parse(s);
      if (!isNaN(t)) return { date: new Date(t) };
    }
    return null;
  }

  function detectType(title, labels) {
    var t = norm(title);
    if (t.indexOf('income') >= 0) return 'income';
    if (t.indexOf('balance') >= 0) return 'balance';
    if (t.indexOf('cash flow') >= 0) return 'cashflow';
    var all = labels.join('|');
    if (all.indexOf('total revenues') >= 0 || all.indexOf('operating income') >= 0) return 'income';
    if (all.indexOf('total assets') >= 0 || all.indexOf('total equity') >= 0) return 'balance';
    if (all.indexOf('capital expenditure') >= 0 || all.indexOf('cash from operations') >= 0) return 'cashflow';
    return null;
  }

  /**
   * Convierte una grilla (filas × columnas) en tablas. Una grilla puede traer varias tablas
   * seguidas (p. ej. Income Statement y debajo Balance Sheet): cada fila de encabezado abre una nueva.
   */
  function parseGrid(grid, opts) {
    opts = opts || {};
    var currentYear = opts.currentYear || new Date().getFullYear();
    var tables = [], cur = null;
    grid.forEach(function (row) {
      if (!row || !row.length) return;
      var label = clean(row[0]);
      var heads = row.slice(1).map(parseHeaderCell);
      var isHeader = heads.filter(Boolean).length >= 2 && heads.every(function (h, i) { return h || clean(row[i + 1]) === ''; });
      if (isHeader) {
        var cols = heads.map(function (h) {
          if (!h) return null;
          if (h.ltm) return { label: 'LTM', year: currentYear, ltm: true };
          var y = h.year || fiscalToCalendar(h.date);
          return { label: h.date ? h.date.toISOString().slice(0, 10) : String(h.year), year: y };
        });
        cur = { title: label, cols: cols, rows: {}, labels: [] };
        tables.push(cur);
        return;
      }
      if (!cur || !label || /^%/.test(label)) return;
      var key = norm(label);
      if (cur.rows[key]) return; // filas repetidas ('% Change YoY'), se queda la primera
      cur.rows[key] = row.slice(1).map(parseNum);
      cur.labels.push(key);
    });
    tables.forEach(function (t) { t.type = detectType(t.title, t.labels); });
    return tables.filter(function (t) { return t.type; });
  }

  function parseText(text, opts) {
    var grid = String(text || '').split(/\r?\n/).map(function (line) { return line.split('\t'); });
    return parseGrid(grid, opts);
  }

  // ------------------------------------------------------------------ mapeo
  function pickRow(t, names) {
    for (var i = 0; i < names.length; i++) if (t.rows[names[i]]) return t.rows[names[i]];
    return null;
  }
  function sumRows(t, names) {
    var found = names.map(function (n) { return t.rows[n]; }).filter(Boolean);
    if (!found.length) return null;
    return t.cols.map(function (_, i) {
      var any = false, s = 0;
      found.forEach(function (r) { if (r[i] !== null && r[i] !== undefined) { s += r[i]; any = true; } });
      return any ? s : null;
    });
  }

  /**
   * tables → { baseYear, years: {año: {campo: valor}}, log, missing }
   * Campos del curso: revenue, da, ebit, interest, taxes, minority, shares, capex, leases,
   * cash, debt, leaseDebt, goodwill, equity.
   */
  function toCourse(tables) {
    var years = {}, log = [], missing = [];
    var seen = {};
    function put(t, field, arr, transform) {
      if (!arr) return false;
      t.cols.forEach(function (c, i) {
        if (!c) return;
        var v = arr[i];
        if (v === null || v === undefined) return;
        years[c.year] = years[c.year] || {};
        years[c.year][field] = transform ? transform(v) : v;
      });
      seen[field] = true;
      return true;
    }
    var types = {};
    tables.forEach(function (t) {
      if (types[t.type]) return; // tablas duplicadas: se usa la primera
      types[t.type] = t;
    });

    var is = types.income;
    if (is) {
      put(is, 'revenue', pickRow(is, ['total revenues', 'revenues', 'total revenue']));
      var ebit = pickRow(is, ['operating income', 'ebit']);
      put(is, 'ebit', ebit);
      // Intereses netos: gasto (negativo en TIKR) + ingresos financieros. El curso usa gasto positivo / ingreso negativo.
      var ie = pickRow(is, ['interest expense', 'net interest expense']);
      var ii = pickRow(is, ['interest and investment income', 'interest income']);
      if (ie || ii) {
        put(is, 'interest', is.cols.map(function (_, i) {
          var a = ie ? ie[i] : null, b = ii ? ii[i] : null;
          if (a === null && b === null) return null;
          return -((a || 0) + (b || 0));
        }));
      }
      put(is, 'taxes', pickRow(is, ['income tax expense', 'income taxes']), function (v) { return -v; });
      var toCo = pickRow(is, ['net income to company']), ni = pickRow(is, ['net income']);
      var mi = pickRow(is, ['minority interest in earnings', 'minority interest']);
      if (mi) put(is, 'minority', mi, function (v) { return -v; });
      else if (toCo && ni) put(is, 'minority', is.cols.map(function (_, i) { return toCo[i] === null || ni[i] === null ? null : toCo[i] - ni[i]; }));
      put(is, 'shares', pickRow(is, ['weighted average diluted shares outstanding', 'diluted shares outstanding']));
      // D&A provisional (EBITDA − EBIT); el Cash Flow la reemplaza si viene
      var ebitda = pickRow(is, ['ebitda']);
      if (ebitda && ebit) put(is, 'da', is.cols.map(function (_, i) { return ebitda[i] === null || ebit[i] === null ? null : ebitda[i] - ebit[i]; }));
      log.push('Income Statement');
    }
    var bs = types.balance;
    if (bs) {
      put(bs, 'cash', pickRow(bs, ['total cash and short term investments', 'cash and equivalents']));
      put(bs, 'debt', sumRows(bs, ['short-term borrowings', 'current portion of long-term debt', 'long-term debt']));
      put(bs, 'leaseDebt', sumRows(bs, ['current portion of capital lease obligations', 'capital leases',
        'current portion of operating lease liabilities', 'long-term operating lease liabilities', 'operating lease liabilities']));
      put(bs, 'goodwill', pickRow(bs, ['goodwill']));
      put(bs, 'equity', pickRow(bs, ['total common equity', 'total equity']));
      log.push('Balance Sheet');
    }
    var cf = types.cashflow;
    if (cf) {
      put(cf, 'da', pickRow(cf, ['depreciation & amort., total', 'depreciation & amortization, total', 'depreciation & amort.', 'total depreciation & amortization']));
      // Capex = compra de activos fijos + compra de intangibles (en positivo)
      var capex = sumRows(cf, ['capital expenditure', 'sale (purchase) of intangible assets']);
      put(cf, 'capex', capex, function (v) { return -v; });
      var lease = pickRow(cf, ['repayment of lease liabilities', 'principal payments on finance leases']);
      if (lease) put(cf, 'leases', lease, function (v) { return Math.abs(v); });
      log.push('Cash Flow');
    }
    ['revenue', 'ebit', 'taxes', 'shares', 'cash', 'debt', 'equity', 'capex'].forEach(function (f) { if (!seen[f]) missing.push(f); });
    var ys = Object.keys(years).map(Number).sort();
    return { baseYear: ys.length ? ys[ys.length - 1] : null, years: years, log: log, missing: missing,
      daFromEbitda: !cf && seen.da };
  }

  /** Aplica el resultado a una empresa: rellena los 7 años históricos del curso terminando en el año base. */
  function applyToCompany(company, res) {
    var by = res.baseYear;
    company.baseYear = by;
    var fields = ['revenue', 'da', 'ebit', 'interest', 'taxes', 'minority', 'shares', 'capex', 'leases',
      'cash', 'debt', 'leaseDebt', 'goodwill', 'equity'];
    var filled = 0;
    for (var i = 0; i < 7; i++) {
      var y = res.years[by - 6 + i];
      if (!y) continue;
      fields.forEach(function (f) {
        if (y[f] !== undefined) { company.course[f][i] = Math.round(y[f] * 100) / 100; filled++; }
      });
    }
    return filled;
  }

  var FIELD_LABELS = { revenue: 'ventas', ebit: 'EBIT', taxes: 'impuestos', shares: 'acciones diluidas',
    cash: 'caja', debt: 'deuda', equity: 'patrimonio', capex: 'capex (falta el Cash Flow)' };

  var api = { parseNum: parseNum, parseGrid: parseGrid, parseText: parseText, toCourse: toCourse,
    applyToCompany: applyToCompany, fiscalToCalendar: fiscalToCalendar, FIELD_LABELS: FIELD_LABELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tikr = api;
})(this);
