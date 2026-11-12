/* Interfaz de la Plantilla de Valoración. Depende de Chart.js (global Chart) y js/calc.js (global Calc). */
(function () {
  'use strict';
  var C = window.Calc;
  var num = C.num, pick = C.pick;

  // ======================================================================
  // Almacenamiento (solo en este navegador)
  // ======================================================================
  var KEYS = { companies: 'pv.companies.v1', current: 'pv.current.v1', rules: 'pv.rules.v1', seeds: 'pv.seeds.v1' };
  function lsGet(key, fallback) {
    try { var v = window.localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nulls(n) { var a = []; for (var i = 0; i < n; i++) a.push(null); return a; }

  var SERIES_KEYS = ['revenue', 'da', 'ebit', 'interest', 'taxes', 'minority', 'shares', 'capex',
    'leases', 'cash', 'debt', 'leaseDebt', 'goodwill', 'equity'];

  function blankCompany() {
    var course = { assumptions: { growth: null, ebitMargin: null, taxRate: null, buyback: null },
      netDebtProj: nulls(5), sharesProj: nulls(5), multiples: { per: null, pfcf: null, evEbitda: null, evEbit: null },
      dividendYield: null };
    SERIES_KEYS.forEach(function (k) { course[k] = nulls(7); });
    return {
      id: uid(), ticker: '', name: '', notes: '', excluded: [], price: null, shares: null, sector: 'general',
      baseYear: new Date().getFullYear(),
      ratios: {},
      egm: { epsGrowth: null, safety: 0, mode: 'linear', years: 10, hurdle: 15 },
      eps: { analyst: nulls(5), per: null, baseEps: null, cagr: null },
      ps: { revenue: null, baseDataYear: null, growth: nulls(5), multiple: null },
      fcf: { base: null, baseDataYear: null, growth: nulls(5), multipleMode: 'hist', multiple: null },
      graham: { epsNtm: null, perNtmOverride: null, eps: null, gExpected: null, aaa: null },
      course: course
    };
  }

  function demoCompany() {
    var c = blankCompany();
    c.ticker = 'DEMO';
    c.name = 'Empresa de ejemplo (datos ficticios)';
    c.price = 100; c.shares = 350; c.baseYear = 2026;
    c.ratios = { perHist: 24, pfcfHist: 25, per: 22, pfcf: 22.6, evEbitda: 14.6, revCagr: 11,
      epsCagr: 13, ndE: 0.4, roic: 34, buyback: 1.1, dividend: 1.2, fcfMargin: 15.5, roe: 25 };
    c.eps.analyst = [4.6, 5.2, 5.9, 6.6, 7.4];
    c.ps.multiple = 3.8;
    c.graham.aaa = 5.3;
    var k = c.course;
    k.revenue = [6000, 6600, 7100, 7800, 8600, 9300, 10000];
    k.ebit = [1150, 1290, 1400, 1580, 1760, 1900, 2050];
    k.da = [300, 320, 340, 360, 380, 400, 420];
    k.interest = [60, 58, 55, 55, 52, 50, 48];
    k.taxes = [229, 259, 282, 320, 359, 389, 420];
    k.minority = [0, 0, 0, 0, 0, 0, 0];
    k.shares = [372, 369, 366, 362, 358, 354, 350];
    k.capex = [280, 300, 320, 350, 380, 400, 430];
    k.leases = [40, 42, 44, 46, 48, 50, 52];
    k.cash = [1500, 1600, 1700, 1800, 1900, 2000, 2100];
    k.debt = [3000, 3000, 2900, 2800, 2800, 2700, 2700];
    k.leaseDebt = [300, 310, 320, 330, 340, 350, 360];
    k.goodwill = [1200, 1200, 1200, 1200, 1200, 1200, 1200];
    k.equity = [4000, 4300, 4600, 5000, 5400, 5800, 6300];
    k.assumptions.ebitMargin = 20.5;
    k.assumptions.taxRate = 21;
    k.netDebtProj = [800, 600, 400, 200, 0];
    k.multiples.evEbit = 18;
    return c;
  }

  /** Completa campos que falten (respaldos antiguos o importados a mano). */
  function normalize(c) {
    var base = blankCompany();
    function fill(target, src) {
      Object.keys(src).forEach(function (key) {
        if (target[key] === undefined) target[key] = src[key];
        else if (src[key] && typeof src[key] === 'object' && !Array.isArray(src[key]) &&
                 target[key] && typeof target[key] === 'object') fill(target[key], src[key]);
      });
    }
    fill(c, base);
    if (!c.id) c.id = uid();
    return c;
  }

  var state = {
    companies: lsGet(KEYS.companies, null),
    currentId: lsGet(KEYS.current, null),
    rules: lsGet(KEYS.rules, {}),
    tab: 'resumen',
    courseSub: 'is',
    horizon: null
  };
  if (!state.companies || !Object.keys(state.companies).length) {
    var d = demoCompany();
    state.companies = {}; state.companies[d.id] = d; state.currentId = d.id;
  }
  // Empresas precargadas (js/seeds.js): se agregan una sola vez; si se eliminan no vuelven.
  var seedsSeen = lsGet(KEYS.seeds, []);
  (window.SEED_COMPANIES || []).forEach(function (seed) {
    var stored = state.companies && state.companies[seed.id];
    if (stored && (stored.seedVersion || 1) < (seed.seedVersion || 1)) {
      (seed.seedUpdates || []).forEach(function (u) {
        if (u.version <= (stored.seedVersion || 1)) return;
        function copy(p) { setPath(stored, p, JSON.parse(JSON.stringify(getPath(seed, p) === undefined ? null : getPath(seed, p)))); }
        (u.paths || []).forEach(copy);
        (u.pathsIfEmpty || []).forEach(function (p) { if (getPath(stored, p) == null) copy(p); });
        if (u.removeExcluded) stored.excluded = (stored.excluded || []).filter(function (k) { return u.removeExcluded.indexOf(k) < 0; });
        if (u.notesPrefix && (stored.notes || '').indexOf(u.notesPrefix) === 0) stored.notes = seed.notes;
      });
      stored.seedVersion = seed.seedVersion;
    }
    if (seedsSeen.indexOf(seed.id) >= 0) return;
    seedsSeen.push(seed.id);
    if (!state.companies[seed.id]) {
      state.companies[seed.id] = JSON.parse(JSON.stringify(seed));
      state.currentId = seed.id;
    }
  });
  lsSet(KEYS.seeds, seedsSeen);
  Object.keys(state.companies).forEach(function (id) { normalize(state.companies[id]); });
  if (!state.companies[state.currentId]) state.currentId = Object.keys(state.companies)[0];

  function co() { return state.companies[state.currentId]; }

  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 350);
  }
  function persist() {
    var ok = lsSet(KEYS.companies, state.companies) && lsSet(KEYS.current, state.currentId) &&
             lsSet(KEYS.rules, state.rules);
    var el = document.getElementById('saveStatus');
    if (!el) return;
    if (ok) {
      var t = new Date();
      el.textContent = 'Guardado en este navegador · ' + t.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    } else {
      el.textContent = 'Este navegador no permite guardar. Usa Exportar para no perder datos.';
    }
  }

  // ======================================================================
  // Rutas (a.b.0) y valores vinculados entre pestañas
  // ======================================================================
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setPath(obj, path, value) {
    var parts = path.split('.');
    var last = parts.pop();
    var target = parts.reduce(function (o, k) {
      if (o[k] === undefined || o[k] === null) o[k] = /^\d+$/.test(k) ? [] : {};
      return o[k];
    }, obj);
    target[last] = value;
  }

  // Cada vínculo devuelve [valor, origen]. Si el campo propio está vacío se usa el vínculo.
  var LINKS = {
    'egm.epsGrowth': function (c) { return [c.ratios.epsCagr, 'Filtro · EPS CAGR']; },
    'eps.per': function (c) { return [c.ratios.perHist, 'Filtro · PER histórico']; },
    'eps.baseEps': function (c) { return [c.eps.analyst[0], 'EPS analistas ' + c.baseYear]; },
    'eps.cagr': function (c) { return [c.ratios.epsCagr, 'Filtro · EPS CAGR']; },
    'ps.revenue': function (c) {
      var v = num(c.course.revenue[6]);
      return [v || null, 'Modelo financiero · ventas ' + c.baseYear];
    },
    'ps.baseDataYear': function (c) { return [c.baseYear, 'Año base']; },
    'fcf.baseDataYear': function (c) { return [c.baseYear, 'Año base']; },
    'ps.growth.*': function (c) { return [c.ratios.revCagr, 'Filtro · Rev CAGR']; },
    'fcf.base': function (c, R) {
      var v = R && R.course ? R.course.fcf[6] : null;
      return [v ? Math.round(v * 100) / 100 : null, 'Modelo financiero · FCF ' + c.baseYear];
    },
    'fcf.growth.*': function (c) { return [c.ratios.revCagr, 'Filtro · Rev CAGR']; },
    'fcf.multiple': function (c) {
      return c.fcf.multipleMode === 'actual'
        ? [c.ratios.pfcf, 'Filtro · P/FCF actual']
        : [c.ratios.pfcfHist, 'Filtro · P/FCF histórico'];
    },
    'graham.epsNtm': function (c) { return [c.eps.analyst[1], 'EPS analistas ' + (c.baseYear + 1)]; },
    'graham.eps': function (c) {
      var v = C.div(num(c.price), num(c.ratios.per));
      return [v === null ? null : Math.round(v * 100) / 100, 'Precio ÷ PER actual (EPS TTM)'];
    },
    'graham.gExpected': function (c) { return [c.ratios.epsCagr, 'Filtro · EPS CAGR']; },
    'course.assumptions.growth': function (c) { return [c.ratios.revCagr, 'Filtro · Rev CAGR']; },
    'course.assumptions.buyback': function (c) { return [c.ratios.buyback, 'Filtro · Recompras']; },
    'course.assumptions.ebitMargin': function (c) {
      var r = C.div(num(c.course.ebit[6]), num(c.course.revenue[6]));
      return [r === null ? null : round(r * 100, 2), 'Margen EBIT ' + c.baseYear];
    },
    'course.assumptions.taxRate': function (c) {
      var pre = num(c.course.ebit[6]) - (num(c.course.interest[6]) || 0);
      var r = C.div(num(c.course.taxes[6]), pre);
      return [r === null ? null : round(r * 100, 2), 'Tasa impositiva ' + c.baseYear];
    },
    // Múltiplos: el del Filtro; si está vacío, el múltiplo actual calculado con los datos del año base
    'course.multiples.per': function (c, R) { return multLink(c, R, 'perHist', 'per', 'Filtro · PER histórico'); },
    'course.multiples.pfcf': function (c, R) { return multLink(c, R, 'pfcfHist', 'pfcf', 'Filtro · P/FCF histórico'); },
    'course.multiples.evEbitda': function (c, R) { return multLink(c, R, 'evEbitda', 'evEbitda', 'Filtro · EV/EBITDA'); },
    'course.multiples.evEbit': function (c, R) { return multLink(c, R, null, 'evEbit', ''); },
    'course.dividendYield': function (c) { return [c.ratios.dividend, 'Filtro · Dividendo']; },
    'course.sharesProj.*': function (c, R, path) {
      var i = Number(path.split('.').pop());
      var v = R && R.course ? R.course.sharesAuto[7 + i] : null;
      return [v === null || v === undefined ? null : round(v, 1), 'Año anterior − recompras'];
    },
    'course.netDebtProj.*': function (c, R, path) {
      var i = Number(path.split('.').pop());
      var v = R && R.course ? R.course.netDebt[6 + i] : null;
      return [v === null || v === undefined ? null : Math.round(v), 'Año anterior'];
    }
  };
  function multLink(c, R, ratioKey, curKey, label) {
    if (ratioKey && num(c.ratios[ratioKey]) !== null) return [c.ratios[ratioKey], label];
    var v = R && R.currentMult ? R.currentMult[curKey] : null;
    return [ok(v) ? round(v, 1) : null, 'Múltiplo actual ' + c.baseYear];
  }
  function linkFor(path) {
    if (LINKS[path]) return LINKS[path];
    var wild = path.replace(/\.\d+$/, '.*');
    return LINKS[wild] || null;
  }
  function round(v, d) { var f = Math.pow(10, d); return Math.round(v * f) / f; }

  /** Valor efectivo: el propio o, si está vacío, el vinculado. */
  function val(c, path, R) {
    var own = num(getPath(c, path));
    if (own !== null) return own;
    var l = linkFor(path);
    return l ? num(l(c, R, path)[0]) : null;
  }

  // ======================================================================
  // Cálculo de todo
  // ======================================================================
  function computeAll(c) {
    var price = num(c.price), shares = num(c.shares), by = Number(c.baseYear) || new Date().getFullYear();
    var R = { price: price, baseYear: by };
    R.filter = C.evaluateFilter(c.sector, c.ratios, state.rules[c.sector]);
    R.maxMult = C.maxMultiples(c.ratios.epsCagr);

    // Modelo financiero primero: otras pestañas toman datos de aquí.
    var ctx = {
      price: price,
      growth: val(c, 'course.assumptions.growth'),
      ebitMargin: val(c, 'course.assumptions.ebitMargin'),
      taxRate: val(c, 'course.assumptions.taxRate'),
      buyback: val(c, 'course.assumptions.buyback'),
      dividendYield: val(c, 'course.dividendYield')
    };
    // múltiplos actuales (no dependen de los múltiplos elegidos) para los vínculos por defecto
    R.currentMult = C.course(c.course, Object.assign({}, ctx, { multiples: {} })).current;
    ctx.multiples = {
      per: val(c, 'course.multiples.per', R), pfcf: val(c, 'course.multiples.pfcf', R),
      evEbitda: val(c, 'course.multiples.evEbitda', R), evEbit: val(c, 'course.multiples.evEbit', R)
    };
    R.courseCtx = ctx;
    R.course = C.course(c.course, ctx);

    R.egm = C.egm({
      epsGrowth: val(c, 'egm.epsGrowth'), safety: c.egm.safety, buyback: c.ratios.buyback,
      dividend: c.ratios.dividend, perHist: c.ratios.perHist, per: c.ratios.per,
      mode: c.egm.mode, years: c.egm.years
    });

    R.epsA = C.epsAnalyst({ eps: c.eps.analyst, per: val(c, 'eps.per'), price: price, baseYear: by });
    R.epsG = C.epsGrowth({ baseEps: val(c, 'eps.baseEps'), cagr: val(c, 'eps.cagr'),
      per: val(c, 'eps.per'), price: price, baseYear: by, years: 5 });
    // P/S y FCF: el dato base es del año base (LTM si viene de TIKR) y la proyección empieza el año siguiente
    R.psDataYear = val(c, 'ps.baseDataYear') || by;
    R.fcfDataYear = val(c, 'fcf.baseDataYear') || by;
    R.ps = C.metricMultiple({ base: val(c, 'ps.revenue'), growth: [0, 1, 2, 3, 4].map(function (i) { return val(c, 'ps.growth.' + i); }),
      multiple: num(c.ps.multiple), shares: shares, price: price, baseYear: R.psDataYear + 1 });
    R.fcf = C.metricMultiple({ base: val(c, 'fcf.base', R), growth: [0, 1, 2, 3, 4].map(function (i) { return val(c, 'fcf.growth.' + i); }),
      multiple: val(c, 'fcf.multiple'), shares: shares, price: price, baseYear: R.fcfDataYear + 1 });
    R.graham = C.graham({ price: price, epsNtm: val(c, 'graham.epsNtm'),
      perNtmOverride: c.graham.perNtmOverride, eps: val(c, 'graham.eps'),
      gExpected: val(c, 'graham.gExpected'), aaa: c.graham.aaa });
    return R;
  }

  /** Precio objetivo por método y año, para el Resumen. */
  function methodList(R) {
    var by = R.baseYear;
    function fromRows(res) {
      var m = {};
      res.rows.forEach(function (r) { m[r.year] = r.target; });
      return m;
    }
    function fromCourse(prices) {
      var m = {};
      for (var i = 6; i < 12; i++) m[by + (i - 6)] = prices[i];
      return m;
    }
    var list = [
      { key: 'epsA', name: 'EPS analistas × PER hist.', tab: 'multiplos', byYear: fromRows(R.epsA), offset: 1 },
      { key: 'epsG', name: 'EPS propio × PER hist.', tab: 'multiplos', byYear: fromRows(R.epsG), offset: 1 },
      { key: 'ps', name: 'Price to Sales', tab: 'multiplos', byYear: fromRows(R.ps), offset: by - R.psDataYear },
      { key: 'fcf', name: 'FCF × múltiplo', tab: 'multiplos', byYear: fromRows(R.fcf), offset: by - R.fcfDataYear },
      { key: 'cPer', name: 'Modelo · PER', tab: 'modelo', byYear: fromCourse(R.course.methods.per.prices), offset: 0 },
      { key: 'cPfcf', name: 'Modelo · P/FCF', tab: 'modelo', byYear: fromCourse(R.course.methods.pfcf.prices), offset: 0 },
      { key: 'cEvEbitda', name: 'Modelo · EV/EBITDA', tab: 'modelo', byYear: fromCourse(R.course.methods.evEbitda.prices), offset: 0 },
      { key: 'cEvEbit', name: 'Modelo · EV/EBIT', tab: 'modelo', byYear: fromCourse(R.course.methods.evEbit.prices), offset: 0 }
    ];
    return list;
  }

  // ======================================================================
  // Formato
  // ======================================================================
  var NF2 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var NF1 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var NF0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
  function ok(v) { return v !== null && v !== undefined && isFinite(v); }
  function money(v) { return ok(v) ? '$' + NF2.format(v) : '—'; }
  function pctf(v, signed) {
    if (!ok(v)) return '—';
    var s = NF1.format(v * 100) + '%';
    return signed && v > 0 ? '+' + s : s;
  }
  function xf(v) { return ok(v) ? NF1.format(v) + 'x' : '—'; }
  function mill(v) { return ok(v) ? (Math.abs(v) < 100 ? NF2.format(v) : NF0.format(v)) : '—'; }
  function n2(v) { return ok(v) ? NF2.format(v) : '—'; }
  function signCls(v) { return !ok(v) ? '' : v >= 0 ? 'pos' : 'neg'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function median(arr) {
    var a = arr.filter(ok).sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  // ======================================================================
  // Piezas de interfaz
  // ======================================================================
  function idFor(path) { return 'i-' + path.replace(/\./g, '-'); }

  /** Campo numérico ligado a una ruta del estado. */
  function inp(path, opts) {
    opts = opts || {};
    var raw = getPath(co(), path);
    var value = raw === null || raw === undefined ? '' : raw;
    var cls = opts.cls ? ' ' + opts.cls : '';
    return '<input id="' + idFor(path) + '" data-path="' + path + '" type="number" step="any" inputmode="decimal"' +
      ' value="' + esc(value) + '" class="' + cls.trim() + '"' +
      (opts.label ? ' aria-label="' + esc(opts.label) + '"' : '') + '>';
  }
  function field(label, path, opts) {
    opts = opts || {};
    var unit = opts.unit ? ' <span class="unit">(' + opts.unit + ')</span>' : '';
    return '<label class="field"><span>' + label + unit + '</span>' + inp(path, opts) +
      '<span class="hint" data-hint-for="' + path + '">' + (opts.hint || '') + '</span></label>';
  }
  function seg(path, options, current) {
    return '<div class="seg" role="group">' + options.map(function (o) {
      return '<button type="button" data-set="' + path + '" data-value="' + o[0] + '" aria-pressed="' +
        (String(current) === String(o[0])) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function pill(pass) {
    if (pass === null || pass === undefined) return '<span class="pill na">Sin dato</span>';
    return pass ? '<span class="pill good">Good</span>' : '<span class="pill bad">Not</span>';
  }
  function setText(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  /** Refresca marcadores de campos vinculados (placeholder con el valor que se está usando). */
  function refreshLinks(R) {
    var c = co();
    document.querySelectorAll('#view input[data-path]').forEach(function (el) {
      var path = el.getAttribute('data-path');
      var l = linkFor(path);
      if (!l) return;
      var res = l(c, R, path);
      var own = num(getPath(c, path));
      var linked = own === null && num(res[0]) !== null;
      el.placeholder = num(res[0]) === null ? '' : String(res[0]);
      el.classList.toggle('linked', linked);
      el.title = 'Vacío = usa ' + res[1];
      var hint = document.querySelector('[data-hint-for="' + path + '"]');
      if (hint) {
        hint.textContent = own === null ? (num(res[0]) === null ? 'Sin dato en ' + res[1] : '↳ ' + res[1]) : 'Valor propio · vacío = ' + res[1];
        hint.classList.toggle('link', linked);
      }
    });
  }

  // ======================================================================
  // Gráficos
  // ======================================================================
  var charts = {};
  function tok(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function palette() {
    return ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'].map(tok);
  }
  function alpha(color, a) {
    // color #rrggbb -> rgba
    var m = /^#([0-9a-f]{6})$/i.exec(color);
    if (!m) return color;
    var n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  var refLine = {
    id: 'refLine',
    afterDatasetsDraw: function (chart, args, opts) {
      var lines = (opts && opts.lines) || [];
      var ctx = chart.ctx, a = chart.chartArea;
      lines.forEach(function (l) {
        if (!ok(l.value)) return;
        var scale = chart.scales[l.axis || 'y'];
        if (!scale) return;
        var px = scale.getPixelForValue(l.value);
        if (l.axis === 'x' ? (px < a.left - 1 || px > a.right + 1) : (px < a.top - 1 || px > a.bottom + 1)) return;
        ctx.save();
        ctx.strokeStyle = l.color; ctx.lineWidth = 1.5; ctx.setLineDash(l.dash || [5, 4]);
        ctx.beginPath();
        if (l.axis === 'x') { ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); }
        else { ctx.moveTo(a.left, px); ctx.lineTo(a.right, px); }
        ctx.stroke();
        ctx.setLineDash([]);
        if (l.label) {
          ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
          var w = ctx.measureText(l.label).width, tx, ty;
          if (l.axis === 'x') {
            var right = px + w + 10 > a.right;
            tx = right ? px - 5 - w : px + 5;
            ty = l.labelAt === 'bottom' ? a.bottom - 6 : a.top + 11;
          } else { tx = a.left + 6; ty = px - 5; }
          // fondo para que la etiqueta se lea sobre las barras
          ctx.fillStyle = alpha(tok('--surface'), 0.85);
          ctx.fillRect(tx - 3, ty - 10, w + 6, 14);
          ctx.fillStyle = l.color;
          ctx.textAlign = 'left';
          ctx.fillText(l.label, tx, ty);
        }
        ctx.restore();
      });
    }
  };
  if (window.Chart) Chart.register(refLine);

  function merge(a, b) {
    Object.keys(b || {}).forEach(function (k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]);
      else a[k] = b[k];
    });
    return a;
  }
  function baseOptions(extra) {
    var muted = tok('--muted'), grid = alpha(tok('--line'), 0.8) || tok('--line');
    var font = { family: '"IBM Plex Sans", system-ui, sans-serif', size: 11 };
    var o = {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: muted, boxWidth: 10, boxHeight: 10, font: font, usePointStyle: true } },
        tooltip: { backgroundColor: tok('--surface'), titleColor: tok('--ink'), bodyColor: tok('--ink'),
          borderColor: tok('--line'), borderWidth: 1, padding: 10,
          titleFont: { family: font.family, weight: '600' }, bodyFont: { family: '"IBM Plex Mono", monospace', size: 11 } },
        refLine: { lines: [] }
      },
      scales: {
        x: { ticks: { color: muted, font: font }, grid: { color: grid, drawTicks: false }, border: { color: tok('--line') } },
        y: { ticks: { color: muted, font: font }, grid: { color: grid, drawTicks: false }, border: { display: false } }
      }
    };
    return merge(o, extra || {});
  }
  function drawChart(id, cfg) {
    var canvas = document.getElementById(id);
    if (!canvas || !window.Chart) return;
    var ch = charts[id];
    if (ch && ch.canvas === canvas && ch.config.type === cfg.type) {
      ch.data = cfg.data; ch.options = cfg.options; ch.update('none');
      return;
    }
    if (ch) ch.destroy();
    charts[id] = new Chart(canvas, cfg);
  }
  function destroyCharts() {
    Object.keys(charts).forEach(function (k) { charts[k].destroy(); delete charts[k]; });
  }
  function moneyTick(v) { return '$' + NF0.format(v); }
  /** Eje Y en dinero que siempre deja ver la línea del precio actual */
  function priceAxis(price) {
    return ok(price) ? { suggestedMin: price * 0.9, ticks: { callback: moneyTick } } : { ticks: { callback: moneyTick } };
  }

  // ======================================================================
  // VISTA: RESUMEN
  // ======================================================================
  var views = {};

  views.resumen = {
    render: function () {
      var c = co(), by = Number(c.baseYear);
      if (!state.horizon || state.horizon < by || state.horizon > by + 5) {
        // año por defecto: el último con más métodos con precio objetivo
        var list = methodList(computeAll(c)), excl = c.excluded || [], best = -1;
        for (var y = by; y <= by + 5; y++) {
          var n = list.filter(function (m) { return excl.indexOf(m.key) < 0 && ok(m.byYear[y]) && m.byYear[y] > 0; }).length;
          if (n >= best) { best = n; state.horizon = y; }
        }
      }
      var years = [0, 1, 2, 3, 4, 5].map(function (i) { return [by + i, String(by + i)]; });
      return '<div class="view">' +
        '<div class="view-head"><h2>Resumen de valoración</h2>' +
        '<p>Todos los métodos en un mismo lugar. Cada barra es el precio objetivo que da un método para el año elegido. La línea naranja es el precio actual y la azul, el promedio de los precios objetivo.</p></div>' +
        '<div class="kpis" id="sumKpis"></div>' +
        '<div class="panel"><div class="panel-head"><h3>Precio objetivo por método</h3>' +
        '<div class="btn-row"><span class="label">Año</span>' + seg('_horizon', years, state.horizon) + '</div></div>' +
        '<div class="chart-box tall"><canvas id="chFootball" aria-label="Precio objetivo por método"></canvas></div></div>' +
        '<div class="grid-2">' +
        '<div class="panel"><h3>Detalle por método</h3><div class="table-wrap"><table id="sumTable"></table></div>' +
        '<p class="hint">Desmarca un método para sacarlo del gráfico y de la mediana (por ejemplo, si no aplica a esta empresa). CAGR: en las pestañas EPS, P/S y FCF el año base cuenta como el año 1 (igual que tu Excel). En el Modelo financiero el año base es el punto de partida. Graham no tiene año: es un valor justo de hoy.</p></div>' +
        '<div class="panel"><h3>Trayectoria del precio objetivo</h3><div class="chart-box"><canvas id="chPaths"></canvas></div></div>' +
        '</div>' +
        '<div class="panel"><div class="panel-head"><h3>Notas de la tesis</h3><p>Se guardan con la empresa</p></div>' +
        '<textarea id="i-notes" data-path="notes" rows="4" class="notes-box" placeholder="Por qué entra (o no) al portafolio, riesgos, catalizadores, fecha de los datos…">' + esc(c.notes || '') + '</textarea></div>' +
        '</div>';
    },
    update: function (R) {
      var c = co(), Y = state.horizon, price = R.price;
      var list = methodList(R);
      var rows = list.map(function (m) {
        var t = m.byYear[Y];
        var years = Y - R.baseYear + m.offset;
        return { key: m.key, name: m.name, tab: m.tab, target: ok(t) && t > 0 ? t : null,
          upside: C.upside(t, price), cagr: years > 0 ? C.cagr(t, price, years) : null };
      });
      var g = R.graham;
      rows.push({ key: 'graham', name: 'Graham (valor justo)', tab: 'graham', target: ok(g.fair) && g.fair > 0 ? g.fair : null, upside: g.upside, cagr: null });
      if (ok(g.fairRevised)) rows.push({ key: 'grahamRev', name: 'Graham revisado (bono AAA)', tab: 'graham', target: g.fairRevised, upside: g.upsideRevised, cagr: null });

      var excluded = c.excluded || [];
      rows.forEach(function (r) { r.off = excluded.indexOf(r.key) >= 0; });
      var valid = rows.filter(function (r) { return r.target !== null && !r.off; });
      var med = median(valid.map(function (r) { return r.target; }));
      var avg = valid.length ? valid.reduce(function (sum, r) { return sum + r.target; }, 0) / valid.length : null;
      var medUp = C.upside(med, price);
      var above = valid.filter(function (r) { return r.target > price; }).length;

      var verdict = '';
      if (ok(medUp)) {
        verdict = medUp > 0.15 ? '<span class="pill good">Por debajo de su valor</span>'
          : medUp < -0.05 ? '<span class="pill bad">Por encima de su valor</span>'
          : '<span class="pill na">Cerca de su valor</span>';
      }
      var f = R.filter, e = R.egm;
      setText('sumKpis',
        kpi('Precio actual', money(price), esc((c.ticker || '').toUpperCase() || 'Sin ticker')) +
        kpi('Objetivo mediano ' + Y, money(med), '<span class="' + signCls(medUp) + '">' + pctf(medUp, true) + '</span> · ' + valid.length + ' métodos ' + verdict, true) +
        kpi('Métodos sobre el precio', valid.length ? above + ' de ' + valid.length : '—', 'Cuántos métodos dan un objetivo mayor al precio actual') +
        kpi('Retorno esperado (EGM)', pctf(e.total), ok(e.doublingYears) ? 'Duplica en ' + NF1.format(e.doublingYears) + ' años (regla del 72)' : 'Completa el Earnings Growth Model') +
        kpi('Filtro · ' + C.SECTORS[c.sector].label, f.evaluated ? f.good + ' / ' + f.evaluated : '—', f.evaluated < f.total ? (f.total - f.evaluated) + ' ratios sin dato' : 'Ratios en "Good"'));

      setText('sumTable', '<thead><tr><th>Método</th><th>Objetivo</th><th>Potencial</th><th>CAGR</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr class="' + (r.off ? 'off' : '') + '"><td><span class="method-cell"><input type="checkbox" data-method="' + r.key + '"' + (r.off ? '' : ' checked') +
            ' aria-label="Incluir ' + esc(r.name) + ' en el resumen"><a href="#' + r.tab + '">' + esc(r.name) + '</a></span></td><td>' + money(r.target) + '</td><td class="' + signCls(r.upside) + '">' +
            pctf(r.upside, true) + '</td><td class="' + signCls(r.cagr) + '">' + pctf(r.cagr, true) + '</td></tr>';
        }).join('') + '</tbody>');

      var good = tok('--good'), bad = tok('--bad'), priceC = tok('--price');
      var maxV = Math.max.apply(null, valid.map(function (r) { return r.target; }).concat([price || 0]));
      drawChart('chFootball', {
        type: 'bar',
        data: { labels: valid.map(function (r) { return r.name; }),
          datasets: [{ label: 'Precio objetivo', data: valid.map(function (r) { return r.target; }),
            backgroundColor: valid.map(function (r) { return alpha(r.target >= price ? good : bad, 0.75); }),
            borderColor: valid.map(function (r) { return r.target >= price ? good : bad; }),
            borderWidth: 1, borderRadius: 4, barPercentage: 0.7 }] },
        options: baseOptions({ indexAxis: 'y', interaction: { mode: 'nearest', axis: 'y', intersect: false },
          plugins: { legend: { display: false },
            tooltip: { callbacks: { label: function (ctx) { return money(ctx.raw) + '  (' + pctf(C.upside(ctx.raw, price), true) + ')'; } } },
            refLine: { lines: [{ axis: 'x', value: price, color: priceC, label: 'Precio ' + money(price) },
              { axis: 'x', value: avg, color: tok('--accent'), label: 'Promedio ' + money(avg) + ' (' + pctf(C.upside(avg, price), true) + ')', dash: [2, 3], labelAt: 'bottom' }] } },
          scales: { x: { beginAtZero: true, suggestedMax: maxV * 1.08, ticks: { callback: moneyTick } }, y: { grid: { display: false } } } })
      });

      var pal = palette();
      var years = [0, 1, 2, 3, 4, 5].map(function (i) { return R.baseYear + i; });
      var ds = list.filter(function (m) { return excluded.indexOf(m.key) < 0; }).map(function (m, i) {
        return { label: m.name, data: years.map(function (y) { var v = m.byYear[y]; return ok(v) && v > 0 ? v : null; }),
          borderColor: pal[i % pal.length], backgroundColor: pal[i % pal.length], borderWidth: 2,
          borderDash: m.tab === 'modelo' ? [6, 3] : [], pointRadius: 2.5, spanGaps: true, tension: 0.25 };
      }).filter(function (d) { return d.data.some(ok); });
      drawChart('chPaths', {
        type: 'line', data: { labels: years.map(String), datasets: ds },
        options: baseOptions({ plugins: { legend: { position: 'bottom' },
          tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + money(ctx.raw); } } },
          refLine: { lines: [{ axis: 'y', value: price, color: priceC, label: 'Precio actual' }] } },
          scales: { y: priceAxis(R.price) } })
      });
    }
  };
  function kpi(label, value, sub, hero) {
    return '<div class="kpi' + (hero ? ' hero' : '') + '"><span class="label">' + label + '</span><span class="v">' + value + '</span><span class="s">' + (sub || '') + '</span></div>';
  }

  // ======================================================================
  // VISTA: FILTRO
  // ======================================================================
  views.filtro = {
    render: function () {
      var c = co();
      var sectors = Object.keys(C.SECTORS).map(function (k) { return [k, C.SECTORS[k].label]; });
      var res = C.evaluateFilter(c.sector, c.ratios, state.rules[c.sector]);
      var ops = ['<', '<=', '>', '>='];
      var body = res.rows.map(function (r) {
        var thIsRef = typeof r.th === 'string' && r.th.indexOf('ref:') === 0;
        var opSel = '<select data-rule="' + r.index + '" data-field="op" aria-label="Operador">' +
          ops.map(function (o) { return '<option' + (o === r.op ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
        var thInp = thIsRef ? '<span class="rule-ref">' + esc(r.thLabel) + '</span>'
          : '<input type="number" step="any" data-rule="' + r.index + '" data-field="th" value="' + esc(r.th) + '" aria-label="Umbral">';
        return '<tr><td>' + esc(r.label) + ' <span class="hint">' + (r.unit === '%' ? '%' : 'x') + '</span></td>' +
          '<td>' + inp('ratios.' + r.key, { label: r.label }) + '</td>' +
          '<td><span class="rule-cell">' + opSel + thInp + '</span></td>' +
          '<td id="pill-' + r.index + '">' + pill(r.pass) + '</td></tr>';
      }).join('');
      return '<div class="view">' +
        '<div class="view-head"><h2>Filtro 1 · Plantilla de valoración</h2>' +
        '<p>Elige el tipo de empresa. Cada tipo tiene sus ratios y su tolerancia con los múltiplos. Los datos se comparten entre tipos y alimentan las demás pestañas. Los porcentajes se escriben como número: 12 = 12 %.</p></div>' +
        '<div>' + seg('sector', sectors, c.sector) + '</div>' +
        '<div class="split wide-left">' +
        '<div class="panel"><div class="panel-head"><h3>Plantilla ' + esc(C.SECTORS[c.sector].label) + '</h3>' +
        '<button type="button" class="btn" id="btnResetRules">Restaurar reglas</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Ratio</th><th>Dato</th><th>Regla</th><th>Calificación</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
        '<p class="hint">Puedes cambiar el operador y el umbral de cada regla. Los cambios aplican a todas las empresas de este tipo.</p></div>' +
        '<div class="view">' +
        '<div class="panel"><div class="panel-head"><h3>Puntuación</h3><span class="mono" id="fScore"></span></div>' +
        '<div class="score-bar"><div id="fBar" style="width:0"></div></div>' +
        '<div class="chart-box short"><canvas id="chFilter"></canvas></div></div>' +
        '<div class="panel"><h3>Múltiplo máximo según crecimiento</h3>' +
        '<p class="muted">Según el EPS CAGR: más de 20 % → PER 40 / EV/EBITDA 25; más de 10 % → 35 / 18; más de 5 % → 25 / 14; más de 0 % → 20 / 12.</p>' +
        '<div class="kpis" id="fMax"></div></div>' +
        '</div></div></div>';
    },
    update: function (R) {
      var c = co(), res = R.filter;
      res.rows.forEach(function (r) { setText('pill-' + r.index, pill(r.pass)); });
      setText('fScore', res.evaluated ? res.good + ' de ' + res.evaluated + ' en Good' : 'Sin datos');
      var bar = document.getElementById('fBar');
      if (bar) bar.style.width = ((res.score || 0) * 100) + '%';

      var mm = R.maxMult;
      var per = num(c.ratios.per), ev = num(c.ratios.evEbitda);
      function comp(cur, max) {
        if (!ok(cur) || !ok(max)) return '';
        return cur <= max ? '<span class="pill good">Actual ' + xf(cur) + ' dentro</span>' : '<span class="pill bad">Actual ' + xf(cur) + ' por encima</span>';
      }
      setText('fMax', kpi('PER máximo', mm.per ? mm.per + 'x' : '—', comp(per, mm.per) || 'Falta EPS CAGR') +
        kpi('EV/EBITDA máximo', mm.evEbitda ? mm.evEbitda + 'x' : '—', comp(ev, mm.evEbitda) || 'Falta EPS CAGR'));

      // Gráfico: cuánto margen tiene cada ratio respecto a su umbral (normalizado)
      var rows = res.rows.filter(function (r) { return r.pass !== null; });
      var good = tok('--good'), bad = tok('--bad');
      drawChart('chFilter', {
        type: 'bar',
        data: { labels: rows.map(function (r) { return r.label; }),
          datasets: [{ label: 'Distancia al umbral', data: rows.map(function (r) {
            var base = Math.abs(r.thValue) || 1;
            var d = (r.value - r.thValue) / base;
            if (r.op === '<' || r.op === '<=') d = -d;
            return Math.max(-1, Math.min(1, d)) * 100;
          }), backgroundColor: rows.map(function (r) { return alpha(r.pass ? good : bad, 0.75); }), borderRadius: 3 }] },
        options: baseOptions({ indexAxis: 'y', plugins: { legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { var r = rows[ctx.dataIndex]; return r.label + ': ' + n2(r.value) + ' ' + r.op + ' ' + n2(r.thValue); } } } },
          scales: { x: { min: -100, max: 100, ticks: { callback: function (v) { return v === 0 ? 'umbral' : (v > 0 ? '+' : '') + v + '%'; } } }, y: { grid: { display: false } } } })
      });
    }
  };

  // ======================================================================
  // VISTA: EARNINGS GROWTH MODEL
  // ======================================================================
  views.egm = {
    render: function () {
      var c = co();
      return '<div class="view">' +
        '<div class="view-head"><h2>Earnings Growth Model</h2><p>Modelo de Compound Quality. Retorno esperado = crecimiento del EPS + shareholder yield ± cambio de valoración.</p></div>' +
        '<div class="formula">Retorno esperado = EPS Growth + (Dividendo + Recompras) ± Cambio en valoración (PER hist. vs PER actual)</div>' +
        '<div class="split">' +
        '<div class="panel"><h3>Componentes</h3><div class="form-grid">' +
        field('EPS Growth', 'egm.epsGrowth', { unit: '%' }) +
        '<label class="field"><span>Margen de seguridad (%)</span>' + inp('egm.safety') + '<span class="hint">Recorta el crecimiento. Tu nota sugiere 30.</span></label>' +
        field('Recompras', 'ratios.buyback', { unit: '%', hint: 'Mismo dato que en Filtro' }) +
        field('Dividendo', 'ratios.dividend', { unit: '%', hint: 'Mismo dato que en Filtro' }) +
        field('PER histórico', 'ratios.perHist', { unit: 'x', hint: 'Mismo dato que en Filtro' }) +
        field('PER actual', 'ratios.per', { unit: 'x', hint: 'Mismo dato que en Filtro' }) +
        '<label class="field"><span>Años para normalizar</span>' + inp('egm.years') + '<span class="hint">Tu Excel usa 10 (factor 0,1)</span></label>' +
        '<label class="field"><span>Retorno mínimo exigido (%)</span>' + inp('egm.hurdle') + '<span class="hint">Para comparar el resultado</span></label>' +
        '</div>' +
        '<div class="field"><span class="label">Cálculo del cambio de valoración</span>' +
        seg('egm.mode', [['linear', 'Lineal (como tu Excel)'], ['compound', 'Compuesto']], c.egm.mode) +
        '<span class="hint">Lineal: 0,1 × (PER hist − PER actual) / PER actual. Compuesto: (PER hist / PER actual)^(1/años) − 1.</span></div>' +
        '</div>' +
        '<div class="view"><div class="kpis" id="egmKpis"></div>' +
        '<div class="panel"><h3>Cómo se forma el retorno</h3><div class="chart-box"><canvas id="chEgm"></canvas></div></div>' +
        '<div id="egmCallout"></div></div>' +
        '</div></div>';
    },
    update: function (R) {
      var c = co(), e = R.egm, hurdle = (num(c.egm.hurdle) || 0) / 100;
      setText('egmKpis',
        kpi('Retorno anual esperado', pctf(e.total), 'Próximos ' + e.years + ' años', true) +
        kpi('Regla del 72', ok(e.doublingYears) ? NF1.format(e.doublingYears) + ' años' : '—', 'Tiempo para duplicar el dinero') +
        kpi('Valor de $10.000', ok(e.total) ? money(10000 * Math.pow(1 + e.total, e.years)) : '—', 'En ' + e.years + ' años a esa tasa'));
      var parts = [['EPS Growth', e.epsGrowth], ['Shareholder yield', e.shareholderYield], ['Cambio valoración', e.valuationChange]];
      var acc = 0, data = [], colors = [];
      var good = tok('--good'), bad = tok('--bad'), acc1 = tok('--accent');
      parts.forEach(function (p) {
        var v = (p[1] || 0) * 100;
        data.push([acc, acc + v]); colors.push(alpha(v >= 0 ? good : bad, 0.8)); acc += v;
      });
      data.push([0, ok(e.total) ? e.total * 100 : 0]); colors.push(alpha(acc1, 0.85));
      drawChart('chEgm', {
        type: 'bar',
        data: { labels: parts.map(function (p) { return p[0]; }).concat(['Retorno esperado']),
          datasets: [{ data: data, backgroundColor: colors, borderRadius: 4, barPercentage: 0.6 }] },
        options: baseOptions({ plugins: { legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { var d = ctx.raw; return NF2.format(d[1] - d[0]) + ' pp'; } } },
          refLine: { lines: [{ axis: 'y', value: hurdle * 100, color: tok('--price'), label: 'Mínimo exigido ' + NF1.format(hurdle * 100) + '%' }] } },
          scales: { y: { ticks: { callback: function (v) { return v + '%'; } } }, x: { grid: { display: false } } } })
      });
      var msg = '';
      if (ok(e.total)) {
        msg = e.total >= hurdle
          ? '<div class="callout good"><b>Supera tu retorno mínimo.</b><span>' + pctf(e.total) + ' anual frente a ' + pctf(hurdle) + ' exigido.</span></div>'
          : '<div class="callout bad"><b>No llega a tu retorno mínimo.</b><span>' + pctf(e.total) + ' anual frente a ' + pctf(hurdle) + ' exigido.</span></div>';
      } else msg = '<div class="callout"><span>Introduce el EPS CAGR (aquí o en Filtro) para calcular el retorno.</span></div>';
      setText('egmCallout', msg);
    }
  };

  // ======================================================================
  // VISTA: EPS · P/S · FCF
  // ======================================================================
  views.multiplos = {
    render: function () {
      var c = co(), by = Number(c.baseYear);
      var yrs = [0, 1, 2, 3, 4];
      var psY = num(c.ps.baseDataYear) || by, fcY = num(c.fcf.baseDataYear) || by;
      var epsA = '<table><thead><tr><th>Año</th><th>EPS estimado</th><th>Precio proyectado</th><th>Potencial</th></tr></thead><tbody>' +
        yrs.map(function (i) {
          return '<tr><td>' + (by + i) + '</td><td>' + inp('eps.analyst.' + i, { label: 'EPS ' + (by + i) }) + '</td><td id="ea-t-' + i + '"></td><td id="ea-u-' + i + '"></td></tr>';
        }).join('') + '</tbody></table>';
      var epsG = '<table><thead><tr><th>Año</th><th>EPS</th><th>Precio proyectado</th><th>Potencial</th></tr></thead><tbody>' +
        yrs.map(function (i) { return '<tr><td>' + (by + i) + '</td><td id="eg-e-' + i + '"></td><td id="eg-t-' + i + '"></td><td id="eg-u-' + i + '"></td></tr>'; }).join('') + '</tbody></table>';
      function growthTable(prefix, path, valueLabel, dataYear) {
        return '<table><thead><tr><th>Año</th><th>Crecimiento %</th><th>' + valueLabel + '</th><th>Precio objetivo</th><th>Potencial</th></tr></thead><tbody>' +
          yrs.map(function (i) {
            var y = dataYear + 1 + i;
            return '<tr><td>' + y + '</td><td>' + inp(path + '.' + i, { label: 'Crecimiento ' + y }) + '</td><td id="' + prefix + '-v-' + i + '"></td><td id="' + prefix + '-t-' + i + '"></td><td id="' + prefix + '-u-' + i + '"></td></tr>';
          }).join('') + '</tbody></table>';
      }
      function foot(prefix) { return '<div class="kpis" id="' + prefix + '-foot"></div>'; }
      return '<div class="view">' +
        '<div class="view-head"><h2>Proyección por múltiplos</h2><p>Las tres pestañas siguen la misma lógica: métrica futura × múltiplo promedio histórico = precio objetivo. Se comparan juntas abajo. En P/S y FCF el dato base es el del año base (LTM si cargaste TIKR) y la proyección empieza el año siguiente. Las celdas en azul toman su valor de otra pestaña; escribe encima para usar tu propio dato.</p></div>' +
        '<div class="panel"><div class="panel-head"><h3>Precio objetivo por año</h3><p>Línea punteada = precio actual</p></div><div class="chart-box"><canvas id="chMult"></canvas></div></div>' +
        '<div class="grid-2">' +
        '<div class="panel"><div class="panel-head"><h3>EPS con estimaciones de analistas</h3><p>EPS de TIKR</p></div>' +
        '<div class="form-grid">' + field('PER histórico', 'eps.per', { unit: 'x' }) + '</div><div class="table-wrap">' + epsA + '</div>' + foot('ea') + '</div>' +
        '<div class="panel"><div class="panel-head"><h3>EPS con crecimiento anual propio</h3><p>Tu supuesto</p></div>' +
        '<div class="form-grid">' + field('EPS ' + by, 'eps.baseEps') + field('Crecimiento anual', 'eps.cagr', { unit: '%' }) + field('PER histórico', 'eps.per', { unit: 'x' }) + '</div>' +
        '<div class="table-wrap">' + epsG + '</div>' + foot('eg') + '</div>' +
        '<div class="panel"><div class="panel-head"><h3>Price to Sales proyectado</h3><p>Ventas en millones</p></div>' +
        '<div class="form-grid">' + field('Revenue base (M)', 'ps.revenue') + field('Año del revenue base', 'ps.baseDataYear') +
        field('P/S promedio histórico', 'ps.multiple', { unit: 'x' }) +
        '<label class="field"><span>N° acciones (M)</span><input type="text" disabled id="ps-shares"><span class="hint">De los datos básicos</span></label></div>' +
        '<div class="table-wrap">' + growthTable('ps', 'ps.growth', 'Ventas (M)', psY) + '</div>' + foot('ps') + '</div>' +
        '<div class="panel"><div class="panel-head"><h3>FCF proyectado</h3><p>FCF en millones</p></div>' +
        '<div class="form-grid">' + field('FCF base (M)', 'fcf.base') + field('Año del FCF base', 'fcf.baseDataYear') + field('Múltiplo P/FCF', 'fcf.multiple', { unit: 'x' }) +
        '<div class="field"><span>Múltiplo a usar</span>' + seg('fcf.multipleMode', [['hist', 'Histórico'], ['actual', 'Actual']], c.fcf.multipleMode) + '</div></div>' +
        '<div class="table-wrap">' + growthTable('fc', 'fcf.growth', 'FCF (M)', fcY) + '</div>' + foot('fc') + '</div>' +
        '</div></div>';
    },
    update: function (R) {
      var c = co();
      function fill(prefix, res, hasEps) {
        res.rows.forEach(function (r, i) {
          if (hasEps) setText(prefix + '-e-' + i, n2(r.eps));
          if (r.value !== undefined) setText(prefix + '-v-' + i, mill(r.value));
          setText(prefix + '-t-' + i, money(r.target));
          setText(prefix + '-u-' + i, '<span class="' + signCls(r.upside) + '">' + pctf(r.upside, true) + '</span>');
        });
        var lastY = null;
        res.rows.forEach(function (r) { if (ok(r.target)) lastY = r.year; });
        setText(prefix + '-foot', kpi('Retorno total', '<span class="' + signCls(res.totalReturn) + '">' + pctf(res.totalReturn, true) + '</span>', lastY ? 'Al ' + lastY : '—') +
          kpi('CAGR anual', '<span class="' + signCls(res.cagr) + '">' + pctf(res.cagr, true) + '</span>', 'Tu Excel (retorno ÷ 5): ' + pctf(res.simpleAvg)));
      }
      fill('ea', R.epsA, false);
      fill('eg', R.epsG, true);
      fill('ps', R.ps, false);
      fill('fc', R.fcf, false);
      var sh = document.getElementById('ps-shares');
      if (sh) sh.value = ok(num(c.shares)) ? mill(num(c.shares)) : 'Falta en datos básicos';

      var pal = palette();
      var sets = [['EPS analistas', R.epsA], ['EPS propio', R.epsG], ['Price to Sales', R.ps], ['FCF', R.fcf]];
      var chartYears = [];
      sets.forEach(function (s) { s[1].rows.forEach(function (r) { if (chartYears.indexOf(r.year) < 0) chartYears.push(r.year); }); });
      chartYears.sort();
      drawChart('chMult', {
        type: 'line',
        data: { labels: chartYears.map(String),
          datasets: sets.map(function (s, i) {
            var m = {};
            s[1].rows.forEach(function (r) { m[r.year] = r.target; });
            return { label: s[0], data: chartYears.map(function (y) { var v = m[y]; return ok(v) && v > 0 ? v : null; }),
              borderColor: pal[i], backgroundColor: alpha(pal[i], 0.12), borderWidth: 2.2, pointRadius: 3, tension: 0.25, spanGaps: true };
          }) },
        options: baseOptions({ plugins: { legend: { position: 'bottom' },
          tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + money(ctx.raw) + ' (' + pctf(C.upside(ctx.raw, R.price), true) + ')'; } } },
          refLine: { lines: [{ axis: 'y', value: R.price, color: tok('--price'), label: 'Precio ' + money(R.price) }] } },
          scales: { y: priceAxis(R.price) } })
      });
    }
  };

  // ======================================================================
  // VISTA: GRAHAM
  // ======================================================================
  views.graham = {
    render: function () {
      return '<div class="view">' +
        '<div class="view-head"><h2>Fórmula de Benjamin Graham</h2><p>Úsala al revés para saber qué crecimiento descuenta el mercado con el PER de hoy, y al derecho para estimar un valor justo con el crecimiento que tú esperas.</p></div>' +
        '<div class="grid-3">' +
        '<div class="formula">g implícito = (PER NTM − 8,5) / 2</div>' +
        '<div class="formula">PER justo = 8,5 + 2g</div>' +
        '<div class="formula">Valor = EPS × (8,5 + 2g) × 4,4 / Y</div></div>' +
        '<div class="split">' +
        '<div class="panel"><h3>Variables</h3><div class="form-grid">' +
        field('EPS NTM (próx. 12 meses)', 'graham.epsNtm') +
        field('PER NTM', 'graham.perNtmOverride', { unit: 'x', hint: 'Vacío = precio ÷ EPS NTM' }) +
        field('EPS actual (TTM)', 'graham.eps') +
        field('g esperado', 'graham.gExpected', { unit: '%' }) +
        field('Bono corporativo AAA (Y)', 'graham.aaa', { unit: '%', hint: 'Opcional, para la versión revisada' }) +
        '</div><div id="grCallout"></div></div>' +
        '<div class="view"><div class="kpis" id="grKpis"></div><div class="kpis" id="grKpis2"></div>' +
        '<div class="panel"><div class="panel-head"><h3>Valor justo según el crecimiento</h3><p>Marcas: g implícito y g esperado</p></div><div class="chart-box"><canvas id="chGraham"></canvas></div></div></div>' +
        '</div>' +
        '<div class="panel"><h3>De dónde sacar cada variable</h3><div class="guide">' +
        guide('EPS NTM', 'Beneficio por acción estimado de los próximos 12 meses. En TIKR, pestaña Estimates: suma el EPS estimado de los próximos 4 trimestres, o usa el dato NTM que aparece en Valuation. La app lo toma por defecto del EPS de analistas del año siguiente.') +
        guide('PER NTM', 'Precio actual ÷ EPS NTM. TIKR lo muestra directo como "NTM P/E" en la sección de múltiplos de valoración. Si lo dejas vacío, la app lo calcula con tu precio y el EPS NTM.') +
        guide('8,5', 'PER que Graham asignaba a una empresa sin crecimiento. Es una constante, no hay que buscarla.') +
        guide('g', 'Crecimiento anual esperado del beneficio para los próximos 7 a 10 años, en número (10 = 10 %). Fuentes: el consenso de crecimiento de EPS a largo plazo de TIKR, el EPS CAGR que pusiste en Filtro o tu propio supuesto. Graham recomendaba ser conservador y no pasar de 15–20.') +
        guide('EPS actual', 'EPS diluido de los últimos 12 meses (TTM). En TIKR: Financials → Income Statement → Diluted EPS (columna LTM). Por defecto la app usa precio ÷ PER actual.') +
        guide('Y y 4,4', 'Y es el rendimiento actual del bono corporativo AAA de Moody\'s; 4,4 era su nivel en 1962. Búscalo en FRED con el código "AAA" (fred.stlouisfed.org/series/AAA). Ajusta el valor cuando las tasas están altas o bajas.') +
        '</div></div></div>';
    },
    update: function (R) {
      var g = R.graham, price = R.price;
      setText('grKpis',
        kpi('PER NTM', xf(g.perNtm), 'Precio ' + money(price)) +
        kpi('g implícito', ok(g.gImplied) ? NF1.format(g.gImplied) + '%' : '—', 'Lo que descuenta el precio') +
        kpi('PER justo', xf(g.perFair), ok(g.gExpected) ? 'Con g = ' + NF1.format(g.gExpected) + '%' : 'Falta g esperado'));
      setText('grKpis2',
        kpi('Valor justo', money(g.fair), '<span class="' + signCls(g.upside) + '">' + pctf(g.upside, true) + '</span> vs precio', true) +
        kpi('Valor revisado (AAA)', money(g.fairRevised), ok(g.fairRevised) ? '<span class="' + signCls(g.upsideRevised) + '">' + pctf(g.upsideRevised, true) + '</span> vs precio' : 'Introduce Y'));
      var msg;
      if (ok(g.gImplied) && ok(g.gExpected)) {
        msg = g.gExpected >= g.gImplied
          ? '<div class="callout good"><b>El mercado descuenta menos crecimiento del que esperas.</b><span>El precio implica ' + NF1.format(g.gImplied) + '% anual y tú esperas ' + NF1.format(g.gExpected) + '%. Margen de ' + NF1.format(g.gGap) + ' puntos.</span></div>'
          : '<div class="callout bad"><b>El mercado ya descuenta más crecimiento del que esperas.</b><span>El precio implica ' + NF1.format(g.gImplied) + '% anual y tú esperas ' + NF1.format(g.gExpected) + '%.</span></div>';
      } else msg = '<div class="callout"><span>Completa el EPS NTM (o el PER NTM) y el g esperado para comparar.</span></div>';
      if (ok(g.gExpected) && g.gExpected > 20) msg += '<div class="callout bad"><b>g esperado muy alto para Graham.</b><span>Con ' + NF1.format(g.gExpected) + '% la fórmula da valores muy optimistas. Graham recomendaba no pasar de 15–20; prueba con un g más conservador.</span></div>';
      setText('grCallout', msg);

      var curve = C.grahamCurve(val(co(), 'graham.eps'), co().graham.aaa, 30);
      var pal = palette();
      var marks = [g.gImplied, g.gExpected].map(function (x) { return ok(x) ? Math.max(0, Math.min(30, x)) : null; });
      drawChart('chGraham', {
        type: 'line',
        data: { datasets: [
            { label: 'Valor justo', data: curve.map(function (p) { return { x: p.g, y: p.fair }; }), borderColor: pal[0], backgroundColor: alpha(pal[0], 0.1), fill: true, borderWidth: 2, pointRadius: 0, tension: 0 },
            { label: 'Valor revisado (AAA)', data: curve.map(function (p) { return { x: p.g, y: p.fairRevised }; }), borderColor: pal[1], borderWidth: 2, borderDash: [6, 3], pointRadius: 0, tension: 0 }
          ].filter(function (d) { return d.data.some(function (pt) { return ok(pt.y); }); }) },
        options: baseOptions({ plugins: { legend: { position: 'bottom' },
          tooltip: { callbacks: { title: function (items) { return 'g = ' + items[0].parsed.x + '%'; }, label: function (ctx) { return ctx.dataset.label + ': ' + money(ctx.parsed.y); } } },
          refLine: { lines: [
            { axis: 'y', value: price, color: tok('--price'), label: 'Precio ' + money(price) },
            { axis: 'x', value: marks[0], color: tok('--bad'), label: 'g implícito', dash: [2, 3] },
            { axis: 'x', value: marks[1], color: tok('--good'), label: 'g esperado', dash: [2, 3] }
          ] } },
          scales: { x: { type: 'linear', min: 0, max: 30, ticks: { stepSize: 5, callback: function (v) { return v + '%'; } } }, y: { beginAtZero: true, suggestedMax: (price || 0) * 1.1, ticks: { callback: moneyTick } } } })
      });
    }
  };
  function guide(sym, text) {
    return '<div class="guide-item"><span class="sym">' + sym + '</span><p>' + text + '</p></div>';
  }

  // ======================================================================
  // VISTA: MODELO FINANCIERO (pestañas 1–4 del Excel, método del curso)
  // ======================================================================
  var COURSE_TABLES = {
    is: [
      { label: 'Ventas (revenue)', input: 'revenue', calc: 'rev', fmt: mill },
      { label: 'Crecimiento a/a', calc: 'revGrowth', fmt: pctf, sub: true },
      { label: 'EBITDA', calc: 'ebitda', fmt: mill },
      { label: 'Margen EBITDA', calc: 'ebitdaMargin', fmt: pctf, sub: true },
      { label: 'Depreciación y amortización', input: 'da', calc: 'da', fmt: mill },
      { label: 'EBIT (operating income)', input: 'ebit', calc: 'ebit', fmt: mill },
      { label: 'Margen EBIT', calc: 'ebitMargin', fmt: pctf, sub: true },
      { label: 'Intereses (negativo si es ingreso)', input: 'interest', calc: 'interest', fmt: mill },
      { label: 'Beneficio antes de impuestos', calc: 'pretax', fmt: mill },
      { label: 'Impuestos', input: 'taxes', calc: 'taxes', fmt: mill },
      { label: 'Tasa impositiva', calc: 'taxRate', fmt: pctf, sub: true },
      { label: 'Beneficio neto consolidado', calc: 'niCons', fmt: mill },
      { label: 'Intereses minoritarios', input: 'minority', calc: 'minority', fmt: mill },
      { label: 'Beneficio neto', calc: 'ni', fmt: mill, total: true },
      { label: 'Margen neto', calc: 'netMargin', fmt: pctf, sub: true },
      { label: 'EPS', calc: 'eps', fmt: n2, total: true },
      { label: 'Acciones diluidas (M)', input: 'shares', projInput: 'sharesProj', calc: 'shares', fmt: mill }
    ],
    cf: [
      { label: 'EBITDA', calc: 'ebitda', fmt: mill },
      { label: 'Capex (tangibles + intangibles)', input: 'capex', calc: 'capex', fmt: mill },
      { label: 'Ajuste leases', input: 'leases', calc: 'leases', fmt: mill },
      { label: 'Intereses', calc: 'interest', fmt: mill },
      { label: 'Impuestos', calc: 'taxes', fmt: mill },
      { label: 'Minoritarios', calc: 'minority', fmt: mill },
      { label: 'Flujo de caja libre', calc: 'fcf', fmt: mill, total: true },
      { label: 'FCF por acción', calc: 'fcfps', fmt: n2 }
    ],
    rc: [
      { label: 'EBIT', calc: 'ebit', fmt: mill },
      { label: 'Intereses', calc: 'interest', fmt: mill },
      { label: 'Impuestos', calc: 'taxes', fmt: mill },
      { label: 'Beneficio neto', calc: 'ni', fmt: mill },
      { label: 'Caja e inversiones', input: 'cash', calc: 'cash', fmt: mill },
      { label: 'Deuda financiera total', input: 'debt', calc: 'debt', fmt: mill },
      { label: 'Deuda por leases', input: 'leaseDebt', calc: 'leaseDebt', fmt: mill },
      { label: 'Goodwill', input: 'goodwill', calc: 'goodwill', fmt: mill },
      { label: 'Patrimonio (equity)', input: 'equity', calc: 'equity', fmt: mill },
      { label: 'Capital empleado con goodwill', calc: 'ceGw', fmt: mill },
      { label: 'Capital empleado sin goodwill', calc: 'ceNoGw', fmt: mill },
      { label: 'ROE (beneficio neto / equity)', calc: 'roe', fmt: pctf, total: true },
      { label: 'ROIC (EBIT / capital sin goodwill)', calc: 'roic', fmt: pctf, total: true },
      { label: 'ROCE (EBIT / capital con goodwill)', calc: 'roce', fmt: pctf }
    ],
    val: [
      { label: 'Capitalización bursátil', calc: 'mcap', fmt: mill },
      { label: 'Deuda neta (negativa = caja neta)', projInput: 'netDebtProj', calc: 'netDebt', fmt: mill },
      { label: 'Deuda neta / EBITDA', calc: 'ndEbitda', fmt: xf, sub: true },
      { label: 'Deuda neta / equity', calc: 'ndEquity', fmt: xf, sub: true },
      { label: 'Enterprise value (EV)', calc: 'ev', fmt: mill },
      { label: 'EBITDA', calc: 'ebitda', fmt: mill },
      { label: 'EBIT', calc: 'ebit', fmt: mill },
      { label: 'Beneficio neto', calc: 'ni', fmt: mill },
      { label: 'FCF', calc: 'fcf', fmt: mill },
      { section: 'Precio por acción según múltiplo' },
      { label: 'Por PER', method: 'per', fmt: money, total: true },
      { label: 'Por P/FCF', method: 'pfcf', fmt: money, total: true },
      { label: 'Por EV/EBITDA', method: 'evEbitda', fmt: money, total: true },
      { label: 'Por EV/EBIT', method: 'evEbit', fmt: money, total: true }
    ]
  };
  var COURSE_NOTES = {
    is: ['Toma las cuentas consolidadas y verifica si el estado está en miles o millones.', 'Usa el número de acciones diluidas.', 'D&A: corrobóralo en el Cash Flow. Suma también la D&A de los leases para luego ajustarlos en Flujos de caja.', 'La tasa impositiva se puede buscar por país o en las proyecciones de la empresa.', 'Los minoritarios suelen estar debajo del Net Income. Si son poco relevantes se pueden dejar en cero.'],
    cf: ['Capex = compra de activos fijos e inversiones. Las adquisiciones NO son capex.', 'En TIKR: Capital Expenditure + Sale (Purchase) of Intangible Assets. Si vienen separados, súmalos.', 'Si en el cash flow operativo y financiero no aparecen leases, se puede asumir que no tiene.', 'Si una small cap sube su crecimiento al 20 %, probablemente tome deuda (más intereses) y se diluya un poco.'],
    rc: ['Los receivables no son caja. Caja y equivalentes se suma con inversiones.', 'Equity: total shareholders equity atribuible a la matriz.', 'Deuda financiera en TIKR: Short term borrowing + Current portion of LT debt + Long term debt (+ Notes payable).', 'Respeta el signo de los informes: un número entre paréntesis es negativo.'],
    val: ['La deuda neta futura es una estimación tuya. Si tiene caja neta, escríbela en negativo; si la caja se acumula, irá creciendo en negativo.', 'Con PER y P/FCF la caja neta se suma al valor; la deuda no se resta porque el beneficio ya descuenta intereses. Con EV/EBITDA y EV/EBIT siempre se resta la deuda neta.', 'CAGR incluye el dividend yield, igual que tu Excel.']
  };

  views.modelo = {
    render: function () {
      var c = co(), by = Number(c.baseYear), sub = state.courseSub;
      var years = []; for (var i = 0; i < 12; i++) years.push(by - 6 + i);
      var head = '<thead><tr><th>Millones (excepto por acción)</th>' + years.map(function (y, i) {
        return '<th class="' + (i >= 7 ? 'proj' : '') + '">' + y + (i >= 7 ? 'e' : '') + '</th>';
      }).join('') + '</tr></thead>';
      var body = COURSE_TABLES[sub].map(function (row, r) {
        if (row.section) return '<tr class="section"><td colspan="13">' + row.section + '</td></tr>';
        var cls = row.sub ? 'sub' : row.total ? 'total' : '';
        var cells = years.map(function (y, i) {
          var pc = i >= 7 ? ' class="proj"' : '';
          if (row.input && i < 7) return '<td>' + inp('course.' + row.input + '.' + i, { label: row.label + ' ' + y }) + '</td>';
          if (row.projInput && i >= 7) return '<td' + pc + '>' + inp('course.' + row.projInput + '.' + (i - 7), { label: row.label + ' ' + y }) + '</td>';
          return '<td' + pc + ' id="cc-' + sub + '-' + r + '-' + i + '"></td>';
        }).join('');
        return '<tr class="' + cls + '"><td>' + row.label + '</td>' + cells + '</tr>';
      }).join('');

      var assumptions = '';
      if (sub === 'is') assumptions = '<div class="form-grid">' +
        field('Crecimiento ventas', 'course.assumptions.growth', { unit: '%' }) +
        field('Margen EBIT', 'course.assumptions.ebitMargin', { unit: '%' }) +
        field('Tasa impositiva', 'course.assumptions.taxRate', { unit: '%' }) +
        field('Recompras (reduce acciones)', 'course.assumptions.buyback', { unit: '%' }) + '</div>';
      if (sub === 'val') assumptions = '<div class="form-grid">' +
        field('Múltiplo PER', 'course.multiples.per', { unit: 'x' }) +
        field('Múltiplo P/FCF', 'course.multiples.pfcf', { unit: 'x' }) +
        field('Múltiplo EV/EBITDA', 'course.multiples.evEbitda', { unit: 'x' }) +
        field('Múltiplo EV/EBIT', 'course.multiples.evEbit', { unit: 'x' }) +
        field('Dividend yield', 'course.dividendYield', { unit: '%' }) + '</div>' +
        '<p class="hint" id="curMult"></p>';
      if (sub === 'cf' || sub === 'rc') assumptions = '<p class="muted">Las columnas proyectadas crecen al mismo ritmo que las ventas (' +
        '<a href="#modelo" data-sub="is">supuesto en Estado de resultados</a>).</p>';

      var titles = { is: '1 · Estado de resultados', cf: '2 · Flujos de caja', rc: '3 · Retornos sobre el capital', val: '4 · Valoración' };
      var chartTitles = { is: 'Ventas, EBIT y beneficio neto', cf: 'Flujo de caja libre', rc: 'Rentabilidad sobre el capital', val: 'Precio objetivo por múltiplo' };
      return '<div class="view">' +
        '<div class="view-head"><h2>Modelo financiero</h2><p>Las cuatro pestañas numeradas de tu Excel (el método del curso) forman un solo modelo: proyectas los estados financieros 5 años y los valoras con 4 múltiplos. Rellena los años históricos; las columnas en azul se calculan solas.</p></div>' +
        '<div>' + seg('_courseSub', [['is', '1 · Estado de resultados'], ['cf', '2 · Flujos de caja'], ['rc', '3 · Retornos capital'], ['val', '4 · Valoración']], sub) + '</div>' +
        (sub === 'val' ? '<div class="kpis" id="valKpis"></div>' : '') +
        '<div class="panel"><div class="panel-head"><h3>' + titles[sub] + '</h3></div>' + assumptions +
        '<div class="table-wrap"><table>' + head + '<tbody>' + body + '</tbody></table></div></div>' +
        '<div class="split">' +
        '<div class="panel"><h3>' + chartTitles[sub] + '</h3><div class="chart-box"><canvas id="chCourse"></canvas></div></div>' +
        '<div class="panel"><h3>Notas</h3><ul class="notes">' + COURSE_NOTES[sub].map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul></div>' +
        '</div></div>';
    },
    update: function (R) {
      var sub = state.courseSub, K = R.course, by = R.baseYear;
      COURSE_TABLES[sub].forEach(function (row, r) {
        if (row.section) return;
        var arr = row.method ? K.methods[row.method].prices : K[row.calc];
        for (var i = 0; i < 12; i++) {
          if (row.input && i < 7) continue;
          if (row.projInput && i >= 7) continue;
          if (row.method && i < 6) { setText('cc-' + sub + '-' + r + '-' + i, ''); continue; }
          var v = arr ? arr[i] : null;
          var txt = row.fmt(v);
          if (row.method && i >= 6) txt += '<br><span class="hint ' + signCls(K.methods[row.method].upside[i]) + '">' + pctf(K.methods[row.method].upside[i], true) + '</span>';
          setText('cc-' + sub + '-' + r + '-' + i, txt);
        }
      });

      var labels = []; for (var i = 0; i < 12; i++) labels.push(String(by - 6 + i) + (i >= 7 ? 'e' : ''));
      var pal = palette();
      function barSet(label, data, color) {
        return { type: 'bar', label: label, data: data, borderRadius: 3,
          backgroundColor: data.map(function (_, i) { return alpha(color, i >= 7 ? 0.4 : 0.85); }), borderColor: color, borderWidth: 0 };
      }
      if (sub === 'is') {
        drawChart('chCourse', { type: 'bar', data: { labels: labels, datasets: [barSet('Ventas', K.rev, pal[0]), barSet('EBIT', K.ebit, pal[1]), barSet('Beneficio neto', K.ni, pal[2])] },
          options: baseOptions({ plugins: { legend: { position: 'bottom' } }, scales: { x: { grid: { display: false } } } }) });
      } else if (sub === 'cf') {
        drawChart('chCourse', { type: 'bar', data: { labels: labels, datasets: [barSet('FCF (M)', K.fcf, pal[1]),
          { type: 'line', label: 'FCF por acción', data: K.fcfps, borderColor: pal[3], backgroundColor: pal[3], yAxisID: 'y1', tension: 0.25, pointRadius: 2.5 }] },
          options: baseOptions({ plugins: { legend: { position: 'bottom' } }, scales: { x: { grid: { display: false } },
            y1: { position: 'right', grid: { display: false }, ticks: { color: tok('--muted'), callback: function (v) { return '$' + NF2.format(v); } } } } }) });
      } else if (sub === 'rc') {
        var pc = function (arr) { return arr.map(function (v) { return ok(v) ? v * 100 : null; }); };
        drawChart('chCourse', { type: 'line', data: { labels: labels, datasets: [
          { label: 'ROE', data: pc(K.roe), borderColor: pal[0], backgroundColor: pal[0], tension: 0.25, pointRadius: 2.5 },
          { label: 'ROIC', data: pc(K.roic), borderColor: pal[1], backgroundColor: pal[1], tension: 0.25, pointRadius: 2.5 },
          { label: 'ROCE', data: pc(K.roce), borderColor: pal[2], backgroundColor: pal[2], borderDash: [5, 3], tension: 0.25, pointRadius: 2.5 }] },
          options: baseOptions({ plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + NF1.format(ctx.raw) + '%'; } } },
            refLine: { lines: [{ axis: 'y', value: 15, color: tok('--muted'), label: 'Umbral ROIC 15%' }] } },
            scales: { y: { ticks: { callback: function (v) { return v + '%'; } } } } }) });
      } else {
        var ms = ['per', 'pfcf', 'evEbitda', 'evEbit'];
        var yl = labels.slice(6);
        drawChart('chCourse', { type: 'line', data: { labels: yl, datasets: ms.map(function (k, i) {
          return { label: K.methods[k].label, data: K.methods[k].prices.slice(6).map(function (v) { return ok(v) && v > 0 ? v : null; }),
            borderColor: pal[i], backgroundColor: pal[i], tension: 0.25, pointRadius: 3, borderWidth: 2.2 };
        }) }, options: baseOptions({ plugins: { legend: { position: 'bottom' },
          tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + money(ctx.raw); } } },
          refLine: { lines: [{ axis: 'y', value: R.price, color: tok('--price'), label: 'Precio ' + money(R.price) }] } },
          scales: { y: priceAxis(R.price) } }) });
        var cm = R.currentMult || {};
        setText('curMult', 'Múltiplos actuales ' + by + ' (precio de hoy sobre los datos del año base): PER ' + xf(cm.per) +
          ' · P/FCF ' + xf(cm.pfcf) + ' · EV/EBITDA ' + xf(cm.evEbitda) + ' · EV/EBIT ' + xf(cm.evEbit) +
          '. Si un múltiplo queda vacío y no está en el Filtro, se usa el actual.');
        setText('valKpis', ms.map(function (k) {
          var m = K.methods[k];
          return kpi('CAGR 3 años · ' + m.label, '<span class="' + signCls(m.cagr3) + '">' + pctf(m.cagr3, true) + '</span>',
            'Objetivo ' + (by + 3) + ': ' + money(m.prices[9]) + ' · 5 años: ' + pctf(m.cagr5, true));
        }).join(''));
      }
    }
  };

  // ======================================================================
  // Control general
  // ======================================================================
  var TABS = ['resumen', 'filtro', 'egm', 'multiplos', 'graham', 'modelo'];

  function renderView() {
    destroyCharts();
    var v = views[state.tab];
    document.getElementById('view').innerHTML = v.render();
    document.querySelectorAll('.tabs a').forEach(function (a) {
      a.setAttribute('aria-selected', String(a.getAttribute('data-tab') === state.tab));
    });
    update();
  }
  function update() {
    var R = computeAll(co());
    refreshLinks(R);
    views[state.tab].update(R);
  }

  function fillBasics() {
    var c = co();
    ['ticker', 'name', 'price', 'shares', 'baseYear'].forEach(function (k) {
      var el = document.getElementById('f-' + k);
      if (el) el.value = c[k] === null || c[k] === undefined ? '' : c[k];
    });
  }
  function companyLabel(c) {
    return (c.ticker ? c.ticker.toUpperCase() : 'Sin ticker') + (c.name ? ' · ' + c.name : '');
  }
  function fillSelect() {
    var sel = document.getElementById('companySelect');
    var ids = Object.keys(state.companies).sort(function (a, b) {
      return companyLabel(state.companies[a]).localeCompare(companyLabel(state.companies[b]));
    });
    sel.innerHTML = ids.map(function (id) {
      return '<option value="' + id + '"' + (id === state.currentId ? ' selected' : '') + '>' + esc(companyLabel(state.companies[id])) + '</option>';
    }).join('');
  }
  function switchTo(id) {
    state.currentId = id;
    state.horizon = null;
    fillBasics(); fillSelect(); renderView(); scheduleSave();
  }

  function readInput(el) {
    if (el.type === 'number') {
      if (el.value === '') return null;
      var v = Number(el.value);
      return isFinite(v) ? v : null;
    }
    return el.value;
  }

  // Entradas con data-path (vista y datos básicos)
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.matches('input[data-path], textarea[data-path]')) {
      var path = el.getAttribute('data-path');
      var v = readInput(el);
      if (path === 'baseYear') { if (v === null) return; v = Math.round(v); }
      setPath(co(), path, v);
      // mismo dato mostrado en otro campo de la vista (p. ej. PER histórico dos veces)
      document.querySelectorAll('input[data-path="' + path + '"]').forEach(function (o) { if (o !== el) o.value = el.value; });
      if (path === 'ticker' || path === 'name') fillSelect();
      update(); scheduleSave();
    } else if (el.matches('[data-rule]')) {
      var c = co(), i = Number(el.getAttribute('data-rule')), f = el.getAttribute('data-field');
      state.rules[c.sector] = state.rules[c.sector] || {};
      state.rules[c.sector][i] = state.rules[c.sector][i] || {};
      state.rules[c.sector][i][f] = f === 'th' ? (el.value === '' ? null : Number(el.value)) : el.value;
      update(); scheduleSave();
    }
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.matches('input[data-method]')) {
      var c = co(), key = el.getAttribute('data-method');
      c.excluded = (c.excluded || []).filter(function (k) { return k !== key; });
      if (!el.checked) c.excluded.push(key);
      update(); scheduleSave();
      return;
    }
    if (el.matches('#f-baseYear') || /baseDataYear$/.test(el.getAttribute('data-path') || '')) renderView();
    if (el.matches('select[data-rule]')) { update(); scheduleSave(); }
  });

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-set]');
    if (b) {
      var path = b.getAttribute('data-set'), value = b.getAttribute('data-value');
      if (path === '_horizon') state.horizon = Number(value);
      else if (path === '_courseSub') state.courseSub = value;
      else {
        setPath(co(), path, value);
        if (path === 'fcf.multipleMode') co().fcf.multiple = null;
        scheduleSave();
      }
      renderView();
      return;
    }
    var s = ev.target.closest('[data-sub]');
    if (s) { ev.preventDefault(); state.courseSub = s.getAttribute('data-sub'); renderView(); return; }
    if (ev.target.id === 'btnResetRules') {
      delete state.rules[co().sector]; scheduleSave(); renderView();
    }
  });

  function onHash() {
    var h = (location.hash || '').replace('#', '');
    if (h === 'curso') h = 'modelo'; // enlaces guardados con el nombre anterior
    state.tab = TABS.indexOf(h) >= 0 ? h : 'resumen';
    renderView();
  }
  window.addEventListener('hashchange', onHash);

  // Barra de empresa
  document.getElementById('companySelect').addEventListener('change', function (e) { switchTo(e.target.value); });
  document.getElementById('btnNew').addEventListener('click', function () {
    var c = blankCompany(); state.companies[c.id] = c; switchTo(c.id);
    document.getElementById('f-ticker').focus();
  });
  document.getElementById('btnDuplicate').addEventListener('click', function () {
    var c = JSON.parse(JSON.stringify(co())); c.id = uid(); c.name = (c.name || '') + ' (copia)';
    state.companies[c.id] = c; switchTo(c.id);
  });
  var confirmBar = document.getElementById('confirmBar');
  document.getElementById('btnDelete').addEventListener('click', function () {
    document.getElementById('confirmText').textContent = '¿Eliminar ' + companyLabel(co()) + '? No se puede deshacer.';
    confirmBar.hidden = false;
  });
  document.getElementById('confirmNo').addEventListener('click', function () { confirmBar.hidden = true; });
  document.getElementById('confirmYes').addEventListener('click', function () {
    delete state.companies[state.currentId];
    if (!Object.keys(state.companies).length) { var c = blankCompany(); state.companies[c.id] = c; }
    confirmBar.hidden = true;
    switchTo(Object.keys(state.companies)[0]);
  });

  // Exportar / importar
  var dlg = document.getElementById('dataDialog');
  var dataText = document.getElementById('dataText');
  var dataMsg = document.getElementById('dataMsg');
  function exportJson() {
    return JSON.stringify({ app: 'plantilla-valoracion', version: 1, exportedAt: new Date().toISOString(),
      rules: state.rules, companies: Object.keys(state.companies).map(function (k) { return state.companies[k]; }) }, null, 2);
  }
  document.getElementById('btnData').addEventListener('click', function () {
    dataText.value = exportJson(); dataMsg.textContent = '';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  });
  document.getElementById('btnCopy').addEventListener('click', function () {
    var txt = dataText.value;
    function fallback() { dataText.focus(); dataText.select(); dataMsg.textContent = 'Texto seleccionado. Cópialo con Ctrl+C / Cmd+C.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { dataMsg.textContent = 'Copiado.'; }, fallback);
    } else fallback();
  });
  document.getElementById('btnDownload').addEventListener('click', function () {
    try {
      var blob = new Blob([dataText.value], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'plantilla-valoracion-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      dataMsg.textContent = 'Si no se descargó el archivo, usa Copiar y pégalo en un archivo de texto.';
    } catch (e) { dataMsg.textContent = 'Este navegador no permite descargar. Usa Copiar.'; }
  });
  function importText(txt) {
    var data;
    try { data = JSON.parse(txt); } catch (e) { dataMsg.textContent = 'El texto no es un JSON válido. Revisa que esté completo.'; return; }
    var list = Array.isArray(data) ? data : data.companies ? data.companies : [data];
    var n = 0;
    list.forEach(function (c) { if (c && typeof c === 'object') { normalize(c); state.companies[c.id] = c; n++; } });
    if (data.rules && typeof data.rules === 'object') state.rules = data.rules;
    if (!n) { dataMsg.textContent = 'No se encontraron empresas en el texto.'; return; }
    dataMsg.textContent = 'Importadas ' + n + ' empresa(s).';
    switchTo(list[list.length - 1].id);
    persist();
  }
  document.getElementById('btnImport').addEventListener('click', function () { importText(dataText.value); });
  document.getElementById('fileInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { dataText.value = r.result; importText(r.result); };
    r.readAsText(f);
    e.target.value = '';
  });

  // Importar desde Excel (.xlsx) — SheetJS se carga solo cuando hace falta
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  function loadXlsx() {
    return new Promise(function (resolve, reject) {
      if (window.XLSX) return resolve(window.XLSX);
      var s = document.createElement('script');
      s.src = XLSX_URL;
      s.onload = function () { window.XLSX ? resolve(window.XLSX) : reject(new Error('sin XLSX')); };
      s.onerror = function () { reject(new Error('No se pudo cargar el lector de Excel. Revisa tu conexión.')); };
      document.head.appendChild(s);
    });
  }
  var noticeBar = document.getElementById('noticeBar');
  function notice(html, kind) {
    document.getElementById('noticeText').innerHTML = html;
    noticeBar.className = 'notice-bar' + (kind ? ' ' + kind : '');
    noticeBar.hidden = false;
  }
  document.getElementById('noticeClose').addEventListener('click', function () { noticeBar.hidden = true; });
  document.getElementById('xlsxInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    notice('Leyendo ' + esc(f.name) + '…');
    loadXlsx().then(function (XLSX) {
      return f.arrayBuffer().then(function (buf) {
        var wb = XLSX.read(buf, { type: 'array', cellFormula: true, cellDates: true });
        // ¿Tablas copiadas de TIKR? → se abren en "Pegar de TIKR" para elegir dónde cargarlas
        var tikrText = tikrFromWorkbook(wb, XLSX);
        if (tikrText) {
          noticeBar.hidden = true;
          openTikr(tikrText, f.name);
          return;
        }
        var res = window.Importer.importWorkbook(wb, XLSX, blankCompany(), f.name);
        var c = normalize(res.company);
        if (!c.name) c.name = f.name.replace(/\.xlsx?$/i, '');
        c.notes = 'Importado de ' + f.name + '.';
        state.companies[c.id] = c;
        switchTo(c.id);
        persist();
        notice('<b>Importado ' + esc(f.name) + '.</b> ' + res.log.map(esc).join(' · ') + '. Revisa los datos en cada pestaña.', 'good');
      });
    }).catch(function (err) {
      notice('No se pudo importar ' + esc(f.name) + ': ' + esc(err.message || err) + '. Comprueba que sea la planilla de valoración en formato .xlsx.', 'bad');
    });
  });

  // ---------------- Pegar de TIKR ----------------
  var TIKR_FIELDS = ['revenue', 'da', 'ebit', 'interest', 'taxes', 'minority', 'shares', 'capex', 'leases',
    'cash', 'debt', 'leaseDebt', 'goodwill', 'equity'];
  function tikrFromWorkbook(wb, XLSX) {
    var parts = [];
    wb.SheetNames.forEach(function (n) {
      var grid = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
      if (window.Tikr.parseGrid(grid).length) {
        parts.push(grid.map(function (row) {
          return row.map(function (v) {
            if (v instanceof Date) return (v.getMonth() + 1) + '/' + v.getDate() + '/' + v.getFullYear();
            return v == null ? '' : String(v);
          }).join('\t');
        }).join('\n'));
      }
    });
    return parts.join('\n');
  }
  var tikrDlg = document.getElementById('tikrDialog');
  var tikrText = document.getElementById('tikrText');
  var tikrPreview = document.getElementById('tikrPreview');
  function tikrParse() {
    var tables = window.Tikr.parseText(tikrText.value);
    return { tables: tables, res: window.Tikr.toCourse(tables) };
  }
  function tikrRefresh() {
    if (!tikrText.value.trim()) { tikrPreview.textContent = ''; return; }
    var p = tikrParse();
    if (!p.tables.length) { tikrPreview.textContent = 'No se reconoció ninguna tabla. Copia también la fila del título (la de las fechas y LTM).'; return; }
    var ys = Object.keys(p.res.years);
    var miss = p.res.missing.map(function (m) { return window.Tikr.FIELD_LABELS[m] || m; });
    tikrPreview.innerHTML = 'Reconocido: <b>' + esc(p.res.log.join(', ')) + '</b> · años ' + esc(ys.join(', ')) +
      (ys.length ? ' (LTM = ' + p.res.baseYear + ')' : '') +
      (miss.length ? '<br>Falta: ' + esc(miss.join(', ')) + '.' : '') +
      (p.res.daFromEbitda ? '<br>D&amp;A calculada como EBITDA − EBIT; el Cash Flow la reemplaza.' : '');
  }
  function openTikr(text, fileName) {
    tikrText.value = text || '';
    document.getElementById('tikrCurrentName').textContent = 'Empresa actual (' + companyLabel(co()) + ')';
    var m = fileName && /_([A-Z][A-Z0-9.]{0,6})_/.exec(fileName);
    document.getElementById('tikrTicker').value = m ? m[1] : '';
    tikrRefresh();
    if (tikrDlg.showModal) tikrDlg.showModal(); else tikrDlg.setAttribute('open', '');
  }
  document.getElementById('btnTikr').addEventListener('click', function () { openTikr(''); });
  tikrText.addEventListener('input', tikrRefresh);
  document.getElementById('btnTikrApply').addEventListener('click', function () {
    var p = tikrParse();
    if (!p.tables.length || !p.res.baseYear) { tikrRefresh(); return; }
    var target = document.querySelector('input[name="tikrTarget"]:checked').value;
    var c;
    if (target === 'new') {
      c = blankCompany();
      var t = document.getElementById('tikrTicker').value.trim().toUpperCase();
      c.ticker = t; c.name = t ? t + ' (datos de TIKR)' : 'Datos de TIKR';
      state.companies[c.id] = c;
    } else {
      c = co();
      // se reemplazan los históricos del Modelo financiero por los de TIKR
      TIKR_FIELDS.forEach(function (f) { c.course[f] = [null, null, null, null, null, null, null]; });
    }
    var n = window.Tikr.applyToCompany(c, p.res);
    // P/S y FCF parten del LTM: ventas (vínculo al Modelo financiero) y FCF de TIKR (misma definición que su P/FCF)
    var ltm = p.res.years[p.res.baseYear] || {};
    c.ps.revenue = null; c.ps.baseDataYear = null; c.fcf.baseDataYear = null;
    if (ltm.fcfTikr !== undefined) c.fcf.base = ltm.fcfTikr;
    if (!num(c.shares) && c.course.shares[6]) c.shares = c.course.shares[6];
    if (p.res.missing.indexOf('capex') >= 0) {
      c.excluded = (c.excluded || []).filter(function (k) { return k !== 'cPfcf'; }).concat(['cPfcf']);
    }
    tikrDlg.close ? tikrDlg.close() : tikrDlg.removeAttribute('open');
    state.courseSub = 'is';
    switchTo(c.id);
    if (location.hash !== '#modelo') location.hash = '#modelo';
    var miss = p.res.missing.map(function (m) { return window.Tikr.FIELD_LABELS[m] || m; });
    notice('<b>Datos de TIKR cargados</b> en el Modelo financiero: ' + n + ' valores, año base ' + p.res.baseYear + ' (LTM). ' +
      (miss.length ? 'Falta: ' + esc(miss.join(', ')) + '. ' : '') +
      'Revisa los supuestos de proyección y los múltiplos.' + (c.price ? '' : ' Escribe el precio actual arriba.'), miss.length ? '' : 'good');
    persist();
  });

  // Tema: redibujar gráficos al cambiar claro/oscuro
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderView);
    new MutationObserver(renderView).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (e) { /* navegadores antiguos */ }

  fillBasics();
  fillSelect();
  onHash();
  persist();
})();
