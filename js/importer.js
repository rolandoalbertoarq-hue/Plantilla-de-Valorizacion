/*
 * Importador de la planilla de valoración en Excel (.xlsx).
 * Busca los datos por las etiquetas de cada pestaña (no por celdas fijas), así que
 * sirve para la plantilla actual y para versiones anteriores.
 * Usa SheetJS (global XLSX en el navegador, o require('xlsx') en Node).
 */
(function (root) {
  'use strict';

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\(\+\)/g, '').replace(/[:]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  /** Envoltorio de una hoja de SheetJS con acceso por fila/columna (0-based). */
  function Sheet(ws, XLSX) {
    var range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    function cell(r, c) { return ws[XLSX.utils.encode_cell({ r: r, c: c })]; }
    return {
      maxR: range.e.r, maxC: range.e.c,
      v: function (r, c) { var x = cell(r, c); return x ? x.v : null; },
      n: function (r, c) { var x = cell(r, c); return x && isNum(x.v) ? x.v : null; },
      isFormula: function (r, c) { var x = cell(r, c); return !!(x && x.f); },
      /** valor numérico solo si es un dato escrito (no una fórmula) */
      input: function (r, c) { var x = cell(r, c); return x && !x.f && isNum(x.v) ? x.v : null; },
      find: function (test, opts) {
        opts = opts || {};
        for (var r = opts.r0 || 0; r <= (opts.r1 === undefined ? range.e.r : opts.r1); r++) {
          for (var c = opts.c0 || 0; c <= (opts.c1 === undefined ? range.e.c : opts.c1); c++) {
            var x = cell(r, c);
            if (x && typeof x.v === 'string' && test(norm(x.v))) return { r: r, c: c };
          }
        }
        return null;
      }
    };
  }

  function findSheet(wb, tests) {
    for (var i = 0; i < wb.SheetNames.length; i++) {
      var n = norm(wb.SheetNames[i]);
      // las pestañas de proyección se buscan por el inicio del nombre ("ps proy" no debe tomar "eps proyectado")
      if (tests.some(function (t) { return t.charAt(0) === '^' ? n.indexOf(t.slice(1)) === 0 : n.indexOf(t) >= 0; })) return wb.Sheets[wb.SheetNames[i]];
    }
    return null;
  }

  // ---------------------------------------------------------------- Filtro 1
  var RATIO_LABELS = [
    [/^per historico/, 'perHist'], [/^p\/fcf historico/, 'pfcfHist'], [/^per$/, 'per'], [/^p\/fcf$/, 'pfcf'],
    [/^p\/affo/, 'pAffo'], [/^book to bill/, 'bookToBill'], [/^roe/, 'roe'], [/^p\/b/, 'pb'],
    [/^ev\/e/, 'evEbitda'], [/^rev cagr/, 'revCagr'], [/^eps cagr/, 'epsCagr'], [/^nd\/e/, 'ndE'],
    [/^roic/, 'roic'], [/^recompra/, 'buyback'], [/^dividendo/, 'dividend'], [/^fcf margin/, 'fcfMargin']
  ];
  function sectorOf(title) {
    if (title.indexOf('reit') >= 0) return 'reit';
    if (title.indexOf('tecnolog') >= 0) return 'tech';
    if (title.indexOf('servicio') >= 0) return 'services';
    if (title.indexOf('financier') >= 0) return 'financial';
    return 'general';
  }

  function readFiltro(S, out, log) {
    var sections = [], cur = null;
    for (var r = 0; r <= S.maxR; r++) {
      var a = norm(S.v(r, 0));
      if (!a) continue;
      if (a.indexOf('plantilla de valoracion') === 0) {
        cur = { sector: sectorOf(a), ratios: {}, filled: 0 };
        sections.push(cur);
        continue;
      }
      if (a.indexOf('stock') === 0) {
        var t = a.replace(/^stock/, '').trim() || norm(S.v(r, 1));
        if (t && !out.ticker) out.ticker = t.toUpperCase();
        continue;
      }
      if (a.indexOf('precio actual') === 0 && S.n(r, 1) !== null) { out.price = S.n(r, 1); continue; }
      if (a.indexOf('acciones') >= 0 && S.n(r, 1) !== null) { out.shares = S.n(r, 1); continue; }
      if (!cur) continue;
      for (var i = 0; i < RATIO_LABELS.length; i++) {
        if (RATIO_LABELS[i][0].test(a)) {
          var v = S.n(r, 1);
          if (v !== null) { cur.ratios[RATIO_LABELS[i][1]] = v; cur.filled++; }
          break;
        }
      }
    }
    if (!sections.length) return;
    // La tabla con más datos es la que se usó; las demás completan lo que falte.
    var best = sections.slice().sort(function (x, y) { return y.filled - x.filled; })[0];
    if (!best.filled) return;
    out.sector = best.sector;
    sections.forEach(function (s) {
      Object.keys(s.ratios).forEach(function (k) { if (out.ratios[k] === undefined || s === best) out.ratios[k] = s.ratios[k]; });
    });
    log.push('Filtro: plantilla ' + ({ general: 'General', reit: 'REITs', tech: 'Tecnológicas', services: 'Servicios', financial: 'Financieras' })[best.sector] + ' con ' + best.filled + ' ratios');
  }

  // ------------------------------- Pestañas 1–4 del Excel (Modelo financiero)
  function yearRow(S) {
    for (var r = 0; r <= Math.min(S.maxR, 20); r++) {
      var cols = [];
      for (var c = 0; c <= S.maxC; c++) {
        var v = S.n(r, c);
        if (v !== null && v >= 1990 && v <= 2100 && Math.round(v) === v) cols.push({ c: c, y: v });
      }
      if (cols.length >= 6) return { r: r, cols: cols };
    }
    return null;
  }
  function rowByLabel(S, test, col) {
    for (var r = 0; r <= S.maxR; r++) if (test(norm(S.v(r, col === undefined ? 1 : col)))) return r;
    return -1;
  }
  function sideValue(S, test) {
    // etiquetas de supuestos a la derecha (columna O) con su valor en P o Q
    var hit = S.find(test, { c0: 10 });
    if (!hit) return { value: null, formula: false };
    for (var c = hit.c + 1; c <= Math.min(S.maxC, hit.c + 4); c++) {
      if (S.n(hit.r, c) !== null) return { value: S.n(hit.r, c), formula: S.isFormula(hit.r, c) };
    }
    return { value: null, formula: false };
  }

  var COURSE_ROWS = {
    is: [[/^sales/, 'revenue'], [/^depreciation/, 'da'], [/^ebit o operating/, 'ebit'], [/^interest expense/, 'interest'],
         [/^income taxes/, 'taxes'], [/^minority/, 'minority'], [/^fully diluted shares/, 'shares']],
    cf: [[/^capex/, 'capex'], [/^ajuste leases/, 'leases']],
    rc: [[/^cash and cash/, 'cash'], [/^deuda financiera/, 'debt'], [/^deuda leases/, 'leaseDebt'], [/^goodwill/, 'goodwill'], [/^equity/, 'equity']]
  };

  function readCourse(wb, XLSX, out, log) {
    var isWs = findSheet(wb, ['income statement']);
    if (!isWs) return;
    var IS = Sheet(isWs, XLSX);
    var yr = yearRow(IS);
    if (!yr) return;
    // Año base = último año con ventas escritas a mano (no fórmula)
    var revRow = rowByLabel(IS, function (l) { return /^sales/.test(l); });
    var base = null;
    yr.cols.forEach(function (yc) { if (revRow >= 0 && IS.input(revRow, yc.c) !== null) base = yc.y; });
    if (base === null) return;
    out.baseYear = base;
    function colOf(S, year) {
      var y = yearRow(S); if (!y) return -1;
      for (var i = 0; i < y.cols.length; i++) if (y.cols[i].y === year) return y.cols[i].c;
      return -1;
    }
    var filled = 0;
    function readRows(S, defs) {
      defs.forEach(function (d) {
        var r = rowByLabel(S, function (l) { return d[0].test(l); });
        if (r < 0) return;
        for (var i = 0; i < 7; i++) {
          var c = colOf(S, base - 6 + i);
          if (c < 0) continue;
          var v = S.n(r, c); // histórico: dato o fórmula (p. ej. =13113+3122)
          if (v !== null) { out.course[d[1]][i] = v; filled++; }
        }
      });
    }
    readRows(IS, COURSE_ROWS.is);
    var cfWs = findSheet(wb, ['flujos de caja']);
    if (cfWs) readRows(Sheet(cfWs, XLSX), COURSE_ROWS.cf);
    var rcWs = findSheet(wb, ['retornos capital']);
    if (rcWs) readRows(Sheet(rcWs, XLSX), COURSE_ROWS.rc);

    // Supuestos (columna derecha del Income statement). Solo si son datos propios.
    function frac(x) { return x === null ? null : Math.abs(x) <= 1.5 ? Math.round(x * 10000) / 100 : x; }
    var a = out.course.assumptions;
    var g = sideValue(IS, function (l) { return l === 'crecimiento'; });
    if (g.value !== null && !g.formula) a.growth = frac(g.value);
    var m = sideValue(IS, function (l) { return l === 'margen ebit'; });
    if (m.value !== null && !m.formula) a.ebitMargin = frac(m.value);
    var t = sideValue(IS, function (l) { return l === 'tax rate'; });
    if (t.value !== null && !t.formula) a.taxRate = frac(t.value);
    var b = sideValue(IS, function (l) { return l === 'recompras'; });
    if (b.value !== null && !b.formula) a.buyback = frac(b.value);

    // Acciones proyectadas escritas a mano
    var sr = rowByLabel(IS, function (l) { return /^fully diluted shares/.test(l); });
    for (var p = 0; p < 5 && sr >= 0; p++) {
      var cc = colOf(IS, base + 1 + p);
      if (cc >= 0 && IS.input(sr, cc) !== null) out.course.sharesProj[p] = IS.input(sr, cc);
    }

    var vWs = findSheet(wb, ['valoracion']);
    if (vWs) {
      var V = Sheet(vWs, XLSX);
      var nd = rowByLabel(V, function (l) { return /^net debt/.test(l); });
      for (var q = 0; q < 5 && nd >= 0; q++) {
        var c2 = colOf(V, base + 1 + q);
        if (c2 >= 0 && V.input(nd, c2) !== null) out.course.netDebtProj[q] = V.input(nd, c2);
      }
      var price = sideValue(V, function (l) { return l === 'cotizacion actual'; });
      if (price.value && out.price == null) out.price = price.value;
      var mult = [['multiple per', 'per'], ['multiple p/fcf', 'pfcf'], ['multiple ev/ebitda', 'evEbitda'], ['multiple ev/ebit', 'evEbit']];
      mult.forEach(function (mm) {
        var x = sideValue(V, function (l) { return l === mm[0]; });
        if (x.value !== null && !x.formula) out.course.multiples[mm[1]] = x.value;
      });
      var dy = sideValue(V, function (l) { return l === 'dividend yield'; });
      if (dy.value !== null && !dy.formula) out.course.dividendYield = frac(dy.value);
    }
    log.push('Modelo financiero: año base ' + base + ', ' + filled + ' datos históricos');
  }

  // ------------------------------------------------------- EPS Proyectado
  function readEps(S, out, log) {
    var by = out.baseYear;
    var h = S.find(function (l) { return l === 'eps futuro'; });
    if (!h) return;
    // Bloque de analistas: primera columna "EPS Futuro" y su "Año"
    var yearC = -1, perC = -1;
    for (var c = h.c + 1; c <= h.c + 3; c++) if (norm(S.v(h.r, c)) === 'ano') { yearC = c; break; }
    for (c = h.c - 1; c >= Math.max(0, h.c - 2); c--) if (norm(S.v(h.r, c)) === 'per historico') { perC = c; break; }
    var n = 0, firstYear = null;
    for (var r = h.r + 1; r <= h.r + 6; r++) {
      var year = yearC >= 0 ? S.n(r, yearC) : null, eps = S.n(r, h.c);
      if (year === null) continue;
      if (firstYear === null) firstYear = year;
      if (by === undefined || by === null) { by = year; out.baseYear = year; }
      var i = year - by;
      if (eps !== null && eps !== 0 && i >= 0 && i < 5) { out.eps.analyst[i] = eps; n++; }
    }
    if (perC >= 0 && S.input(h.r + 1, perC) !== null) out.eps.per = S.input(h.r + 1, perC);
    if (n) log.push('EPS de analistas: ' + n + ' años');

    // Bloque de crecimiento propio
    var g = S.find(function (l) { return l === '% cagr'; });
    if (g) {
      var cg = S.n(g.r + 1, g.c);
      if (cg !== null && cg !== 0) out.eps.cagr = Math.abs(cg) <= 1.5 ? cg * 100 : cg;
      var e2 = S.find(function (l) { return l === 'eps futuro'; }, { r0: g.r, r1: g.r, c0: g.c + 1 });
      if (e2 && S.input(g.r + 1, e2.c) !== null && S.input(g.r + 1, e2.c) !== 0) out.eps.baseEps = S.input(g.r + 1, e2.c);
    }

    // Fórmula de Graham
    function below(label, key, target) {
      var hit = S.find(function (l) { return l === label; });
      if (!hit) return;
      var v = S.input(hit.r + 1, hit.c);
      if (v !== null && v !== 0) target[key] = v;
    }
    below('per actual', 'perNtmOverride', out.graham);
    below('g', 'gExpected', out.graham);
    below('eps', 'eps', out.graham);
  }

  // ------------------------------------------- PS / FCF Proyectado
  function readMetric(S, kind, out, log) {
    var hYears = S.find(function (l) { return l === 'anos'; });
    if (!hYears) return null;
    var hr = hYears.r;
    var mulC = -1, shC = -1, grC = -1, priceC = -1;
    for (var c = 0; c <= S.maxC; c++) {
      var l = norm(S.v(hr, c));
      if (/^p\/s promedio|^multiplo fcf/.test(l)) mulC = c;
      else if (/^n.? de acciones/.test(l)) shC = c;
      else if (/growth/.test(l)) grC = c;
      else if (/^precio objetivo/.test(l)) priceC = c + 1;
    }
    var baseVal = S.n(hr + 1, 0);
    var shares = shC >= 0 ? S.input(hr + 1, shC) : null;
    var res = { base: baseVal, shares: shares,
      multiple: mulC >= 0 ? S.input(hr + 1, mulC) : null, growth: [null, null, null, null, null],
      price: priceC >= 0 ? S.n(hr, priceC) : null };
    // crecimientos en orden, desde el primer año listado
    var firstYear = null, gi = 0;
    for (var r = hr + 1; r <= hr + 7; r++) {
      var y = S.n(r, hYears.c);
      if (y !== null && firstYear === null) firstYear = y;
    }
    var offset = firstYear !== null && out.baseYear ? firstYear - out.baseYear : 0;
    for (r = hr + 1; r <= hr + 6 && grC >= 0; r++) {
      var gv = S.input(r, grC);
      if (gv === null) continue;
      var idx = gi + offset; gi++;
      if (idx >= 0 && idx < 5) res.growth[idx] = Math.abs(gv) <= 1.5 ? Math.round(gv * 10000) / 100 : gv;
    }
    if (res.base !== null) log.push((kind === 'ps' ? 'Price to Sales' : 'FCF proyectado') + ': datos importados');
    return res;
  }

  // ------------------------------------------------------------- principal
  function importWorkbook(wb, XLSX, blank, fileName) {
    var out = blank;
    var log = [];
    var f = findSheet(wb, ['filtro']);
    if (f) readFiltro(Sheet(f, XLSX), out, log);
    readCourse(wb, XLSX, out, log);
    var e = findSheet(wb, ['^eps proy']);
    if (e) readEps(Sheet(e, XLSX), out, log);
    var ps = findSheet(wb, ['^ps proy', '^p/s proy', '^price to sales']);
    if (ps) {
      var p = readMetric(Sheet(ps, XLSX), 'ps', out, log);
      if (p) {
        if (p.base !== null) out.ps.revenue = p.base;
        if (p.multiple !== null) out.ps.multiple = p.multiple;
        out.ps.growth = p.growth;
        if (p.shares !== null && out.shares == null) out.shares = p.shares;
        if (p.price && out.price == null) out.price = p.price;
      }
    }
    var fc = findSheet(wb, ['^fcf proy']);
    if (fc) {
      var q = readMetric(Sheet(fc, XLSX), 'fcf', out, log);
      if (q) {
        if (q.base !== null) out.fcf.base = q.base;
        if (q.multiple !== null) { out.fcf.multiple = q.multiple; }
        out.fcf.growth = q.growth;
        if (q.shares !== null && out.shares == null) out.shares = q.shares;
      }
    }
    // La app trabaja en millones: si un dato viene en unidades (p. ej. 350.018.000.000), se convierte.
    function toMillions(v) { return v != null && Math.abs(v) > 1e7 ? v / 1e6 : v; }
    out.shares = toMillions(out.shares);
    out.ps.revenue = toMillions(out.ps.revenue);
    out.fcf.base = toMillions(out.fcf.base);
    // n° de acciones: si no hay otro dato, las diluidas del año base
    if (out.shares == null && out.course.shares[6]) out.shares = out.course.shares[6];
    if (!out.ticker && fileName) {
      var m = /_([A-Z][A-Z0-9.]{0,6})_/.exec(fileName);
      if (m) out.ticker = m[1];
    }
    // Métodos que el Excel no usaba: quedan desmarcados en el Resumen (si no, saldrían solo de vínculos automáticos)
    var off = [];
    if (out.eps.baseEps == null && out.eps.cagr == null) off.push('epsG');
    if (out.ps.revenue == null) off.push('ps');
    if (out.fcf.base == null) off.push('fcf');
    if (out.graham.gExpected == null && out.graham.eps == null && out.graham.perNtmOverride == null) off.push('graham', 'grahamRev');
    out.excluded = off;
    if (off.length) log.push('Métodos sin datos en el Excel desmarcados en el Resumen');
    if (out.price == null) log.push('No se encontró el precio actual: escríbelo arriba.');
    return { company: out, log: log };
  }

  var api = { importWorkbook: importWorkbook };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Importer = api;
})(this);
