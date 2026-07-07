/* Harness Brick M19 — Tendencias en Progress. Auto-contenido: lee
   ./index.html, inyecta __TEST__ antes del cierre del IIFE y ejecuta en vm con
   DOM mínimo en memoria. Cobertura: sanity post-M10, helpers puros de tendencia,
   Progress vacío/poblado, cero mutación en render, sw v6 y harnesses previos en
   node --check. */
const fs = require('fs');
const vm = require('vm');
const cp = require('child_process');

const raw = fs.readFileSync('./index.html', 'utf8');
const sw = fs.readFileSync('./sw.js', 'utf8');
const ANCHOR_RE = /renderDashboard\(\);\r?\n\r?\n\}\)\(\);/;
if ((raw.match(ANCHOR_RE) || []).length !== 1) { console.error('ANCLA DEL HOOK NO UNICA'); process.exit(1); }
const HOOK = `renderDashboard();

  window.__TEST__ = {
    DEFAULT_STATE: DEFAULT_STATE,
    P2R_LABELS: P2R_LABELS,
    computeAccuracyTrend: computeAccuracyTrend,
    computeTimeTrend: computeTimeTrend,
    trendSparklineSVG: trendSparklineSVG,
    renderProgress: renderProgress,
    renderProgressBody: renderProgressBody,
    state: function () { return state; }
  };

})();`;
const hooked = raw.replace(ANCHOR_RE, HOOK);
const script = Array.from(hooked.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)).map(m => m[1]).join('\n');

const EXPECTED_M19_COUNT = 1;

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  OK ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
function countToken(s, token) {
  const m = s.match(new RegExp(token, 'g'));
  return m ? m.length : 0;
}
function clone(x) { return JSON.parse(JSON.stringify(x)); }

class FakeClassList {
  constructor() { this.set = new Set(); }
  add(...xs) { xs.forEach(x => this.set.add(x)); }
  remove(...xs) { xs.forEach(x => this.set.delete(x)); }
  contains(x) { return this.set.has(x); }
  toggle(x, force) {
    const on = force === undefined ? !this.set.has(x) : !!force;
    if (on) this.set.add(x); else this.set.delete(x);
    return on;
  }
}
class FakeElement {
  constructor(doc, id) {
    this.ownerDocument = doc;
    this.id = id || '';
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.classList = new FakeClassList();
    this.innerHTML = '';
    this.textContent = '';
    this.disabled = false;
  }
  addEventListener() {}
  appendChild(el) { this.children.push(el); el.parentNode = this; return el; }
  removeChild(el) { this.children = this.children.filter(x => x !== el); el.parentNode = null; return el; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  click() {}
  setAttribute(k, v) { this[k] = v; }
  getAttribute(k) { return this[k]; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
}
class FakeDocument {
  constructor() {
    this.elements = {};
    this.body = this.getElementById('body');
  }
  getElementById(id) {
    if (!this.elements[id]) this.elements[id] = new FakeElement(this, id);
    return this.elements[id];
  }
  createElement(tag) { return new FakeElement(this, tag); }
  addEventListener() {}
  querySelector(sel) {
    if (sel === '.nav-item.active') return this.getElementById('nav-active');
    const tab = String(sel).match(/^\[data-tab="([^"]+)"\]$/);
    if (tab) return this.getElementById('nav-' + tab[1]);
    return null;
  }
  querySelectorAll() { return []; }
}
function makeStorage(seed) {
  const store = {};
  if (seed) store.mbb_trainer_state_v1 = JSON.stringify(seed);
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
    dump() { return clone(store); }
  };
}
function boot(preState) {
  const document = new FakeDocument();
  ['dashboard-root', 'drills-root', 'progress-root', 'fit-root', 'cases-root', 'recall-root', 'learn-root', 'exhibits-root', 'bottom-nav', 'top-bar-meta', 'scroll-host',
   'home-section', 'learn-section', 'cases-section', 'recall-section', 'drills-section', 'exhibits-section', 'fit-section', 'progress-section']
    .forEach(id => document.getElementById(id));
  const localStorage = makeStorage(preState);
  const navigator = { mediaDevices: null };
  const window = {
    document, navigator, localStorage,
    MBB: {}, location: { href: 'https://localhost/' },
    addEventListener() {}, removeEventListener() {},
    matchMedia() { return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }; }
  };
  window.window = window;
  window.self = window;
  const ctx = {
    window, document, navigator, localStorage,
    console: { log() {}, warn() {}, error() {} },
    setInterval, clearInterval, setTimeout, clearTimeout,
    Blob: function () {}, URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} }
  };
  vm.createContext(ctx);
  vm.runInContext(script, ctx, { filename: 'index.html' });
  return { w: window, document, storage: localStorage };
}
function reps(pattern) {
  return pattern.map((v, i) => ({ correct: !!v, ts: i + 1 }));
}

console.log('M19-0 · sanity post-M10');
{
  t('M9 marker count = 13', countToken(raw, 'M9') === 13);
  t('FIT_MC marker count = 6', countToken(raw, 'FIT_MC') === 6);
  t('M10 marker count = 14', countToken(raw, 'M10') === 14);
  t('M19 marker count exacto = 1', countToken(raw, 'M19') === EXPECTED_M19_COUNT);
  t('P2R_LABELS existe', /const P2R_LABELS/.test(raw));
  t('sw.js sigue v6', /CACHE_VERSION\s*=\s*'mbb-trainer-v6'/.test(sw));
}

console.log('M19-1 · computeAccuracyTrend');
{
  const { w } = boot(null);
  const A = w.__TEST__.computeAccuracyTrend;
  let tr = A(reps([0, 0, 0, 1, 1, 1]));
  t('accuracy mejora', tr.n === 6 && tr.direction === 'up' && tr.delta > 0);
  tr = A(reps([1, 1, 1, 0, 0, 0]));
  t('accuracy empeora', tr.n === 6 && tr.direction === 'down' && tr.delta < 0);
  tr = A(reps([1, 0, 1, 1, 0, 1]));
  t('accuracy plana', tr.n === 6 && tr.direction === 'flat' && tr.delta === 0);
  tr = A(reps([1, 0]));
  t('accuracy n insuficiente', tr.kind === 'insufficient' && tr.n === 2 && tr.rate === null);
  tr = A([]);
  t('accuracy array vacio', tr.kind === 'insufficient' && tr.n === 0 && tr.points.length === 0);
}

console.log('M19-2 · computeTimeTrend');
{
  const { w } = boot(null);
  const T = w.__TEST__.computeTimeTrend;
  let tr = T([30, 30, 30, 20, 20, 20]);
  t('time mejora cuando baja tiempo', tr.n === 6 && tr.direction === 'up' && tr.delta < 0);
  tr = T([20, 20, 20, 30, 30, 30]);
  t('time empeora cuando sube tiempo', tr.n === 6 && tr.direction === 'down' && tr.delta > 0);
  tr = T([12, 13]);
  t('time n insuficiente', tr.kind === 'insufficient' && tr.n === 2 && tr.median === null);
  tr = T([30, 28, 26, 24, 22, 20]);
  t('mathTimes sin ts se trata como orden de reps', tr.orderedBy === 'rep');
}

console.log('M19-3 · sparkline SVG');
{
  const { w } = boot(null);
  const svg = w.__TEST__.trendSparklineSVG([0, 0.5, 1], {});
  t('sparkline devuelve SVG inline', /^<svg/.test(svg) && /polyline/.test(svg) && /circle/.test(svg));
}

console.log('M19-4 · Progress render');
{
  const empty = boot(null);
  let threw = false;
  try { empty.w.__TEST__.renderProgress(); } catch (_) { threw = true; }
  t('render Progress no lanza con state vacio', !threw);
  t('state vacio muestra Tendencias y datos insuficientes',
    /Tendencias/.test(empty.document.getElementById('progress-root').innerHTML) &&
    /datos insuficientes/.test(empty.document.getElementById('progress-root').innerHTML));

  const pre = {
    stepStats: {
      hypothesis: reps([0, 0, 0, 1, 1, 1]),
      synthesis: reps([1, 1, 1, 0, 0, 0])
    },
    mathPats: { P1: { ok: 1, tot: 3 }, P2D: { ok: 2, tot: 3 }, P2R: { ok: 1, tot: 3 }, P3: { ok: 3, tot: 3 }, P4: { ok: 2, tot: 3 } },
    mathTimes: { P1: [30, 30, 30, 20, 20, 20], P2D: [20, 20, 20, 30, 30, 30], P2R: [25, 24, 23], P3: [], P4: [] },
    drillHistory: {}
  };
  const full = boot(pre);
  const stateBefore = JSON.stringify(full.w.__TEST__.state());
  const storageBefore = JSON.stringify(full.storage.dump());
  full.w.__TEST__.renderProgress();
  const html = full.document.getElementById('progress-root').innerHTML;
  t('render Progress muestra seccion Tendencias con state poblado', /Tendencias/.test(html) && /Accuracy por skill/.test(html) && /Tiempo por patrón math/.test(html));
  t('render muestra sparkline SVG cuando hay n>=6', /trend-sparkline/.test(html) && /polyline/.test(html));
  t('render menciona orden de reps, no calendario', /orden de reps/.test(html) && !/calendario/i.test(html));
  t('render no muta state', JSON.stringify(full.w.__TEST__.state()) === stateBefore);
  t('render no muta localStorage', JSON.stringify(full.storage.dump()) === storageBefore);
}

console.log('M19-5 · harnesses previos syntax');
{
  ['harness-brickM5.js', 'harness-brickM8.js', 'harness-brickM9.js', 'harness-brickM10.js'].forEach(file => {
    let ok = false;
    try { cp.execFileSync(process.execPath, ['--check', file], { stdio: 'ignore' }); ok = true; }
    catch (_) { ok = false; }
    t(file + ' node --check verde', ok);
  });
}

console.log('');
console.log(`RESULTADO: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
