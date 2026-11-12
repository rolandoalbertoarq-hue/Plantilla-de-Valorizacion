/*
 * Motor de cálculo de la Plantilla de Valoración.
 * Funciones puras (sin DOM) para que se puedan probar con Node.
 * Convención: todos los porcentajes se introducen como número "humano"
 * (12 = 12 %) y se convierten a fracción aquí dentro.
 */
(function (root) {
  'use strict';

  // ---------- utilidades ----------
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var x = Number(v);
    return isFinite(x) ? x : null;
  }
  function pct(v) { var x = num(v); return x === null ? null : x / 100; }
  function z(v) { var x = num(v); return x === null ? 0 : x; }
  function div(a, b) {
    if (a === null || b === null || a === undefined || b === undefined || b === 0) return null;
    var r = a / b;
    return isFinite(r) ? r : null;
  }
  function upside(target, price) {
    var r = div(target, price);
    return r === null ? null : r - 1;
  }
  /** CAGR real: (final/inicial)^(1/años) - 1 */
  function cagr(end, start, years) {
    if (end === null || start === null || !(start > 0) || !(end > 0) || !(years > 0)) return null;
    return Math.pow(end / start, 1 / years) - 1;
  }
  /** Primer valor no nulo: valor propio o el vinculado desde otra pestaña */
  function pick() {
    for (var i = 0; i < arguments.length; i++) {
      var x = num(arguments[i]);
      if (x !== null) return x;
    }
    return null;
  }

  // ---------- FILTRO 1 ----------
  var RATIOS = {
    perHist:    { label: 'PER histórico',          unit: 'x' },
    pfcfHist:   { label: 'P/FCF histórico',        unit: 'x' },
    per:        { label: 'PER actual',             unit: 'x' },
    pfcf:       { label: 'P/FCF actual',           unit: 'x' },
    pAffo:      { label: 'P/AFFO',                 unit: 'x' },
    bookToBill: { label: 'Book to Bill',           unit: 'x' },
    roe:        { label: 'ROE',                    unit: '%' },
    pb:         { label: 'P/B (precio / valor libro)', unit: 'x' },
    evEbitda:   { label: 'EV/EBITDA',              unit: 'x' },
    revCagr:    { label: 'Revenue CAGR',           unit: '%' },
    epsCagr:    { label: 'EPS CAGR',               unit: '%' },
    ndE:        { label: 'Deuda neta / EBITDA',    unit: 'x' },
    roic:       { label: 'ROIC',                   unit: '%' },
    buyback:    { label: 'Recompras (− = recompra)', unit: '%' },
    dividend:   { label: 'Dividendo (yield)',      unit: '%' },
    fcfMargin:  { label: 'Margen FCF',             unit: '%' }
  };

  // Reglas copiadas de la pestaña "Filtro 1" del Excel.
  // th: número o 'ref:<clave>' para comparar con otro ratio.
  var SECTORS = {
    general: { label: 'General', rules: [
      ['perHist', '<=', 20], ['pfcfHist', '<=', 30], ['per', '<=', 'ref:perHist'],
      ['pfcf', '<', 'ref:pfcfHist'], ['evEbitda', '<', 18], ['revCagr', '>', 10],
      ['epsCagr', '>', 10], ['ndE', '<', 4], ['roic', '>', 15], ['buyback', '<', 0],
      ['dividend', '>', 0], ['fcfMargin', '>=', 20]
    ]},
    reit: { label: 'REITs', rules: [
      ['perHist', '<=', 20], ['pAffo', '<=', 24], ['per', '<', 'ref:perHist'],
      ['evEbitda', '<', 18], ['revCagr', '>', 10], ['epsCagr', '>', 10], ['ndE', '<', 4],
      ['roic', '>', 15], ['buyback', '<', 0], ['dividend', '>', 0], ['fcfMargin', '>=', 20]
    ]},
    tech: { label: 'Tecnológicas', rules: [
      ['perHist', '<=', 30], ['pfcfHist', '<=', 30], ['per', '<=', 'ref:perHist'],
      ['pfcf', '<', 'ref:pfcfHist'], ['evEbitda', '<', 25], ['revCagr', '>', 10],
      ['epsCagr', '>', 10], ['ndE', '<', 4], ['roic', '>', 15], ['buyback', '<', 0],
      ['dividend', '>', 0], ['fcfMargin', '>=', 20]
    ]},
    services: { label: 'Servicios', rules: [
      ['perHist', '<=', 30], ['bookToBill', '<', 1], ['per', '<', 'ref:perHist'],
      ['evEbitda', '<', 16], ['revCagr', '>', 10], ['epsCagr', '>', 10], ['ndE', '<', 4],
      ['roic', '>', 15], ['buyback', '<', 0], ['dividend', '>', 0], ['fcfMargin', '>=', 20]
    ]},
    financial: { label: 'Financieras', rules: [
      ['perHist', '<=', 20], ['roe', '>', 15], ['pb', '<', 1.2], ['per', '<', 'ref:perHist'],
      ['evEbitda', '<', 18], ['revCagr', '>', 10], ['epsCagr', '>', 10], ['ndE', '<', 4],
      ['buyback', '<', 0], ['dividend', '>', 0], ['fcfMargin', '>=', 20]
    ]}
  };

  function compare(a, op, b) {
    switch (op) {
      case '<': return a < b;
      case '<=': return a <= b;
      case '>': return a > b;
      case '>=': return a >= b;
    }
    return null;
  }

  /** Evalúa las reglas del sector. overrides[i] = {op, th} opcional. */
  function evaluateFilter(sector, ratios, overrides) {
    var def = SECTORS[sector] || SECTORS.general;
    overrides = overrides || {};
    var rows = def.rules.map(function (r, i) {
      var key = r[0], op = r[1], th = r[2];
      var o = overrides[i];
      if (o) { if (o.op) op = o.op; if (o.th !== undefined && o.th !== null && o.th !== '') th = o.th; }
      var value = num(ratios[key]);
      var thValue = null, thLabel = null;
      if (typeof th === 'string' && th.indexOf('ref:') === 0) {
        var refKey = th.slice(4);
        thValue = num(ratios[refKey]);
        thLabel = RATIOS[refKey].label;
      } else {
        thValue = num(th);
      }
      var pass = (value === null || thValue === null) ? null : compare(value, op, thValue);
      return { key: key, label: RATIOS[key].label, unit: RATIOS[key].unit, op: op, th: th,
               thValue: thValue, thLabel: thLabel, value: value, pass: pass, index: i };
    });
    var evaluated = rows.filter(function (r) { return r.pass !== null; });
    var good = evaluated.filter(function (r) { return r.pass; }).length;
    return { rows: rows, good: good, evaluated: evaluated.length, total: rows.length,
             score: evaluated.length ? good / evaluated.length : null };
  }

  /**
   * Múltiplo máximo que justifica el crecimiento (columnas D y E de Filtro 1).
   * En el Excel el PER máx. se calcula sobre el EPS CAGR. El EV/EBITDA máx.
   * apuntaba a su propia fila; aquí usamos también el EPS CAGR.
   */
  function maxMultiples(epsCagr) {
    var g = num(epsCagr);
    if (g === null || g <= 0) return { per: null, evEbitda: null };
    if (g > 20) return { per: 40, evEbitda: 25 };
    if (g > 10) return { per: 35, evEbitda: 18 };
    if (g > 5) return { per: 25, evEbitda: 14 };
    return { per: 20, evEbitda: 12 };
  }

  // ---------- EARNINGS GROWTH MODEL (Compound Quality) ----------
  /**
   * Expected Return = EPS Growth + Shareholder Yield +/- Change in Valuation
   * mode 'linear' replica el Excel: (1/años) * (PER hist - PER actual) / PER actual
   * mode 'compound': (PER hist / PER actual)^(1/años) - 1
   */
  function egm(p) {
    var g = pct(p.epsGrowth);
    var safety = num(p.safety) || 0; // % de margen de seguridad (p.ej. 30)
    if (g !== null) g = g * (1 - safety / 100);
    // Recompras en negativo (salen acciones): suman al retorno. Dilución en positivo: resta.
    var sy = -(pct(p.buyback) || 0) + (pct(p.dividend) || 0);
    var years = num(p.years) || 10;
    var perHist = num(p.perHist), per = num(p.per);
    var change = null;
    if (perHist !== null && per) {
      change = p.mode === 'compound'
        ? (perHist > 0 && per > 0 ? Math.pow(perHist / per, 1 / years) - 1 : null)
        : (1 / years) * ((perHist - per) / per);
    }
    var total = g === null ? null : g + sy + (change || 0);
    var doubling = total !== null && total > 0 ? 72 / (total * 100) : null;
    return { epsGrowth: g, shareholderYield: sy, valuationChange: change, total: total,
             doublingYears: doubling, years: years };
  }

  // ---------- PROYECCIONES POR MÚLTIPLOS ----------
  function finishProjection(rows, price) {
    // último año con precio objetivo (puede haber años sin estimación al final)
    var n = rows.length;
    while (n > 0 && rows[n - 1].target === null) n--;
    var last = n ? rows[n - 1] : null;
    var total = last ? upside(last.target, price) : null;
    return {
      rows: rows,
      totalReturn: total,
      cagr: last ? cagr(last.target, price, n) : null,
      simpleAvg: total === null ? null : total / n // lo que calculaba el Excel (retorno/5)
    };
  }

  /** EPS de analistas (TIKR) x PER histórico */
  function epsAnalyst(p) {
    var per = num(p.per), price = num(p.price);
    var rows = (p.eps || []).map(function (e, i) {
      var eps = num(e);
      var target = eps === null || per === null ? null : eps * per;
      return { year: p.baseYear + i, eps: eps, target: target, upside: upside(target, price) };
    });
    return finishProjection(rows, price);
  }

  /** EPS propio con crecimiento anual constante x PER histórico */
  function epsGrowth(p) {
    var per = num(p.per), price = num(p.price), g = pct(p.cagr) || 0;
    var eps = num(p.baseEps);
    var rows = [];
    for (var i = 0; i < (p.years || 5); i++) {
      if (i > 0 && eps !== null) eps = eps * (1 + g);
      var target = eps === null || per === null ? null : eps * per;
      rows.push({ year: p.baseYear + i, eps: eps, target: target, upside: upside(target, price) });
    }
    return finishProjection(rows, price);
  }

  /**
   * Métrica (ventas o FCF, en millones) que crece a una tasa por año,
   * x múltiplo (P/S o P/FCF) / n° de acciones (millones).
   * Igual que las pestañas "PS Proyectado" y "FCF Proyectado".
   */
  function metricMultiple(p) {
    var m = num(p.multiple), shares = num(p.shares), price = num(p.price);
    var value = num(p.base);
    var rows = (p.growth || []).map(function (gr, i) {
      var g = pct(gr) || 0;
      value = value === null ? null : value * (1 + g);
      var mcap = value === null || m === null ? null : value * m;
      var target = div(mcap, shares);
      return { year: p.baseYear + i, value: value, growth: g, mcap: mcap, target: target,
               upside: upside(target, price) };
    });
    return finishProjection(rows, price);
  }

  // ---------- FÓRMULA DE GRAHAM ----------
  /**
   * g implícito = (PER NTM - 8.5) / 2
   * PER justo   = 8.5 + 2g
   * Precio justo = EPS x (8.5 + 2g)               (fórmula original 1962)
   * Precio justo revisado = EPS x (8.5 + 2g) x 4.4 / Y   (Y = bono AAA)
   */
  function graham(p) {
    var price = num(p.price);
    var epsNtm = num(p.epsNtm);
    var perNtm = pick(p.perNtmOverride, div(price, epsNtm));
    var gImplied = perNtm === null ? null : (perNtm - 8.5) / 2;
    var g = num(p.gExpected);
    var perFair = g === null ? null : 8.5 + 2 * g;
    var eps = num(p.eps);
    var fair = eps === null || perFair === null ? null : eps * perFair;
    var y = num(p.aaa);
    var fairRevised = fair === null || !y ? null : fair * 4.4 / y;
    return { perNtm: perNtm, gImplied: gImplied, gExpected: g, perFair: perFair, fair: fair,
             fairRevised: fairRevised, upside: upside(fair, price),
             upsideRevised: upside(fairRevised, price),
             gGap: gImplied === null || g === null ? null : g - gImplied };
  }

  /** Curva precio justo vs crecimiento, para el gráfico de sensibilidad */
  function grahamCurve(eps, aaa, maxG) {
    var out = [];
    eps = num(eps); aaa = num(aaa);
    for (var g = 0; g <= (maxG || 30); g += 1) {
      var fair = eps === null ? null : eps * (8.5 + 2 * g);
      out.push({ g: g, fair: fair, fairRevised: fair !== null && aaa ? fair * 4.4 / aaa : null });
    }
    return out;
  }

  // ---------- MÉTODO DEL CURSO (pestañas 1–4) ----------
  var HIST = 7, PROJ = 5, COLS = HIST + PROJ;

  function series(arr) {
    var out = [];
    for (var i = 0; i < HIST; i++) out.push(z(arr && arr[i]));
    return out;
  }

  /**
   * c: datos del curso. ctx: { price, growth, ebitMargin, taxRate, buyback,
   *   multiples:{per,pfcf,evEbitda,evEbit}, dividendYield } ya resueltos (en %).
   * Columnas 0..6 = históricos (baseYear-6 .. baseYear), 7..11 = proyección.
   */
  function course(c, ctx) {
    var g = pct(ctx.growth) || 0;
    var margin = pct(ctx.ebitMargin) || 0;
    var tax = pct(ctx.taxRate) || 0;
    var bb = pct(ctx.buyback) || 0;
    var price = num(ctx.price);
    var mult = ctx.multiples || {};

    var rev = series(c.revenue), da = series(c.da), ebit = series(c.ebit),
        interest = series(c.interest), taxes = series(c.taxes), minority = series(c.minority),
        shares = series(c.shares), capex = series(c.capex), leases = series(c.leases),
        cash = series(c.cash), debt = series(c.debt), leaseDebt = series(c.leaseDebt),
        goodwill = series(c.goodwill), equity = series(c.equity);

    // Años históricos sin datos (columnas vacías del Excel): se muestran en blanco
    var empty = [];
    for (var h = 0; h < HIST; h++) empty[h] = rev[h] === 0 && ebit[h] === 0 && shares[h] === 0;

    var growAll = [da, interest, minority, capex, leases, cash, debt, leaseDebt, goodwill, equity];
    var sharesAuto = shares.slice();
    for (var i = HIST; i < COLS; i++) {
      rev[i] = rev[i - 1] * (1 + g);
      growAll.forEach(function (s) { s[i] = s[i - 1] * (1 + g); });
      ebit[i] = rev[i] * margin;
      // acciones: escritas a mano o según el cambio anual (negativo = recompra, positivo = dilución)
      sharesAuto[i] = shares[i - 1] * (1 + bb);
      var manual = num(c.sharesProj && c.sharesProj[i - HIST]);
      shares[i] = manual === null ? sharesAuto[i] : manual;
    }

    var ebitda = [], pretax = [], niCons = [], ni = [], eps = [], fcf = [], fcfps = [],
        revGrowth = [], ebitdaMargin = [], ebitMargin = [], taxRate = [], netMargin = [],
        ceGw = [], ceNoGw = [], roe = [], roic = [], roce = [],
        netDebt = [], mcap = [], ev = [], ndEbitda = [], ndEquity = [],
        pPer = [], pPfcf = [], pEvEbitda = [], pEvEbit = [];

    for (i = 0; i < COLS; i++) {
      ebitda[i] = ebit[i] + da[i];
      pretax[i] = ebit[i] - interest[i];
      if (i >= HIST) taxes[i] = pretax[i] * tax;
      niCons[i] = pretax[i] - taxes[i];
      ni[i] = niCons[i] - minority[i];
      eps[i] = div(ni[i], shares[i]);
      revGrowth[i] = i === 0 ? null : div(rev[i] - rev[i - 1], rev[i - 1]);
      ebitdaMargin[i] = div(ebitda[i], rev[i]);
      ebitMargin[i] = div(ebit[i], rev[i]);
      taxRate[i] = div(taxes[i], pretax[i]);
      netMargin[i] = div(ni[i], rev[i]);

      fcf[i] = ebitda[i] - capex[i] - interest[i] - taxes[i] - minority[i] - leases[i];
      fcfps[i] = div(fcf[i], shares[i]);

      ceGw[i] = equity[i] + debt[i] - cash[i] + leaseDebt[i];
      ceNoGw[i] = ceGw[i] - goodwill[i];
      roe[i] = div(ni[i], equity[i]);
      roic[i] = div(ebit[i], ceNoGw[i]);
      roce[i] = div(ebit[i], ceGw[i]);

      if (i < HIST) {
        netDebt[i] = debt[i] - cash[i] + leaseDebt[i];
      } else {
        var est = num(c.netDebtProj && c.netDebtProj[i - HIST]);
        netDebt[i] = est === null ? netDebt[i - 1] : est; // si no se estima, se mantiene la última
      }
      mcap[i] = price === null ? null : price * shares[i];
      ev[i] = mcap[i] === null ? null : mcap[i] + netDebt[i];
      ndEbitda[i] = div(netDebt[i], ebitda[i]);
      ndEquity[i] = div(netDebt[i], equity[i]);

      // Precios objetivo (fila 21–24 de "4. Valoración"):
      // PER y P/FCF: si hay caja neta (deuda < 0) se suma la caja; si hay deuda no se resta.
      var nd = netDebt[i];
      var m;
      m = num(mult.per);
      pPer[i] = m === null ? null : div(nd < 0 ? ni[i] * m - nd : ni[i] * m, shares[i]);
      m = num(mult.pfcf);
      pPfcf[i] = m === null ? null : div(nd < 0 ? fcf[i] * m - nd : fcf[i] * m, shares[i]);
      m = num(mult.evEbitda);
      pEvEbitda[i] = m === null ? null : div(ebitda[i] * m - nd, shares[i]);
      m = num(mult.evEbit);
      pEvEbit[i] = m === null ? null : div(ebit[i] * m - nd, shares[i]);
    }

    var dy = pct(ctx.dividendYield) || 0;
    function cagrAt(arr, years) {
      var t = arr[HIST - 1 + years];
      var r = cagr(t, price, years);
      return r === null ? null : r + dy;
    }
    var methods = {
      per: { label: 'PER', prices: pPer },
      pfcf: { label: 'P/FCF', prices: pPfcf },
      evEbitda: { label: 'EV/EBITDA', prices: pEvEbitda },
      evEbit: { label: 'EV/EBIT', prices: pEvEbit }
    };
    Object.keys(methods).forEach(function (k) {
      var mm = methods[k];
      mm.cagr3 = cagrAt(mm.prices, 3);
      mm.cagr5 = cagrAt(mm.prices, 5);
      mm.upside = mm.prices.map(function (p) { return upside(p, price); });
    });

    var out = {
      rev: rev, revGrowth: revGrowth, ebitda: ebitda, ebitdaMargin: ebitdaMargin, da: da,
      ebit: ebit, ebitMargin: ebitMargin, interest: interest, pretax: pretax, taxes: taxes,
      taxRate: taxRate, niCons: niCons, minority: minority, ni: ni, netMargin: netMargin,
      eps: eps, shares: shares,
      capex: capex, leases: leases, fcf: fcf, fcfps: fcfps,
      cash: cash, debt: debt, leaseDebt: leaseDebt, goodwill: goodwill, equity: equity,
      ceGw: ceGw, ceNoGw: ceNoGw, roe: roe, roic: roic, roce: roce,
      netDebt: netDebt, mcap: mcap, ev: ev, ndEbitda: ndEbitda, ndEquity: ndEquity,
      methods: methods, dividendYield: dy
    };
    Object.keys(out).forEach(function (k) {
      if (Array.isArray(out[k])) for (var e = 0; e < HIST; e++) if (empty[e]) out[k][e] = null;
    });
    // el crecimiento del primer año con datos no tiene base de comparación
    for (var e2 = 0; e2 < HIST; e2++) if (empty[e2] && !empty[e2 + 1]) out.revGrowth[e2 + 1] = null;
    // Múltiplos actuales del año base (precio de hoy sobre los datos del año base)
    var b = HIST - 1;
    out.current = {
      per: ni[b] > 0 ? div(mcap[b], ni[b]) : null,
      pfcf: fcf[b] > 0 ? div(mcap[b], fcf[b]) : null,
      evEbitda: ebitda[b] > 0 ? div(ev[b], ebitda[b]) : null,
      evEbit: ebit[b] > 0 ? div(ev[b], ebit[b]) : null
    };
    out.sharesAuto = sharesAuto;
    out.empty = empty;
    return out;
  }

  var api = {
    num: num, pct: pct, div: div, upside: upside, cagr: cagr, pick: pick,
    RATIOS: RATIOS, SECTORS: SECTORS, evaluateFilter: evaluateFilter, maxMultiples: maxMultiples,
    egm: egm, epsAnalyst: epsAnalyst, epsGrowth: epsGrowth, metricMultiple: metricMultiple,
    graham: graham, grahamCurve: grahamCurve, course: course,
    HIST: HIST, PROJ: PROJ, COLS: COLS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
