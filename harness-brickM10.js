/* Harness Brick M10 — Protocolo P2R. Auto-contenido: lee ./index.html,
   inyecta __TEST__ antes del cierre del IIFE y ejecuta en vm con un DOM mínimo
   en memoria. Cobertura: markers M10 con falso positivo SVG documentado,
   registro standalone, state/skill graph/SDH, P2R_LABELS por tipo, gate duro,
   señal única, abandono cero señal, mathTimes/mathPats intactos y math runner
   original intacto. */
const fs = require('fs');
const vm = require('vm');
const cp = require('child_process');

const raw = fs.readFileSync('./index.html', 'utf8');
const ANCHOR_RE = /renderDashboard\(\);\r?\n\r?\n\}\)\(\);/;
if ((raw.match(ANCHOR_RE) || []).length !== 1) { console.error('ANCLA DEL HOOK NO UNICA'); process.exit(1); }
const HOOK = `renderDashboard();

  window.__TEST__ = {
    MCMATH: MCMATH,
    P2R_LABELS: P2R_LABELS,
    DRILL_TYPES: DRILL_TYPES,
    DEFAULT_STATE: DEFAULT_STATE,
    SKILL_LABELS: SKILL_LABELS,
    SDH_SKILL_DRILL: SDH_SKILL_DRILL,
    composeSdhPlan: composeSdhPlan,
    sdhDateSeed: sdhDateSeed,
    state: function () { return state; },
    drillsState: function () { return drillsState; },
    resetDrillDetailState: resetDrillDetailState,
    ensureProtocolRep: ensureProtocolRep,
    renderDrills: renderDrills,
    renderDrillsHub: renderDrillsHub,
    handleDrillsClick: handleDrillsClick,
    handleDrillsInput: handleDrillsInput,
    handleDashboardClick: handleDashboardClick,
    setDrill: function (type, idx) {
      drillsState.type = type;
      drillsState.drillIdx = idx || 0;
      drillsState.view = 'detail';
      if (type === 'math') { drillsState.mathDone = 0; ensureMathSession(true); }
      resetDrillDetailState();
      renderDrills();
    }
  };

})();`;
const hooked = raw.replace(ANCHOR_RE, HOOK);
const script = Array.from(hooked.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)).map(m => m[1]).join('\n');

const EXPECTED_M10_COUNT = 14; // 13 markers reales + 1 falso positivo SVG: path "M10 3v6"

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  OK ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
function countToken(s, token) {
  const m = s.match(new RegExp(token, 'g'));
  return m ? m.length : 0;
}

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
    clear() { Object.keys(store).forEach(k => delete store[k]); }
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
  return { w: window, document };
}
function actionTarget(action, data) {
  return {
    disabled: false,
    dataset: Object.assign({ action }, data || {}),
    closest(sel) { return sel === '[data-action]' ? this : null; }
  };
}
function dashboardActionTarget(action, data) {
  return {
    disabled: false,
    dataset: Object.assign({ action }, data || {}),
    closest(sel) { return sel === '[data-action]' ? this : null; }
  };
}
function clickDrills(T, action, data) {
  T.handleDrillsClick({ target: actionTarget(action, data) });
}
function inputDrills(T, role, value, extra) {
  T.handleDrillsInput({ target: { dataset: Object.assign({ role }, extra || {}), value: String(value) } });
}
function openProtocol(w, idx) {
  const T = w.__TEST__;
  T.setDrill('protocolo', idx || 0);
  return T.drillsState();
}
function fillLabels(T, wrongFirst) {
  const s = T.drillsState();
  const slots = s.protSlots || [];
  slots.forEach((slot, i) => {
    let val = slot.legendIndex;
    if (wrongFirst && i === 0) val = (slot.legendIndex + 1) % s.protDrill.legend.length;
    inputDrills(T, 'prot-label', val, { slot: slot.id });
  });
  clickDrills(T, 'prot-label-check');
}
function answerAndSubmit(T) {
  const s = T.drillsState();
  inputDrills(T, 'prot-input', s.protDrill.answer);
  clickDrills(T, 'prot-submit');
}
function fullSignal(st) {
  return {
    len: ((st.stepStats || {}).protocolo || []).length,
    hist: ((st.drillHistory || {}).protocolo || 0),
    last: (((st.stepStats || {}).protocolo || []).slice(-1)[0] || {}).correct
  };
}

console.log('M10-0 · markers');
{
  t('M10 marker count esperado: 14', countToken(raw, 'M10') === EXPECTED_M10_COUNT);
  t('falso positivo SVG documentado: path "M10 3v6"', raw.includes('M10 3v6'));
  t('M9 marker count se mantiene en 13', countToken(raw, 'M9') === 13);
  t('FIT_MC marker count se mantiene en 6', countToken(raw, 'FIT_MC') === 6);
}

console.log('M10-1 · registro/state/skill graph');
{
  const { w } = boot(null);
  const T = w.__TEST__;
  t('tile protocolo existe en el hub', /data-type="protocolo"/.test(T.renderDrillsHub()) && /Protocolo P2R/.test(T.renderDrillsHub()));
  t('DRILL_TYPES.protocolo existe', !!T.DRILL_TYPES.protocolo && T.DRILL_TYPES.protocolo.stateKey === 'protocolo');
  t('DEFAULT_STATE.stepStats.protocolo existe', Array.isArray(T.DEFAULT_STATE.stepStats.protocolo));
  t('DEFAULT_STATE.drillHistory.protocolo existe', T.DEFAULT_STATE.drillHistory.protocolo === 0);
  t('SKILL_LABELS.protocolo existe', T.SKILL_LABELS.protocolo === 'Protocolo P2R');
  t('SDH_SKILL_DRILL.protocolo existe', T.SDH_SKILL_DRILL.protocolo === 'protocolo');
}

console.log('M10-2 · SDH abre Protocolo P2R');
{
  const { w } = boot(null);
  const T = w.__TEST__;
  const st = T.state();
  Object.keys(T.DEFAULT_STATE.stepStats).forEach(k => {
    st.stepStats[k] = [{ correct: true, ts: 1 }, { correct: true, ts: 2 }, { correct: true, ts: 3 }];
  });
  st.stepStats.protocolo = [{ correct: false, ts: 1 }, { correct: false, ts: 2 }, { correct: false, ts: 3 }];
  ['P1', 'P2D', 'P2R', 'P3', 'P4'].forEach(p => { st.mathPats[p] = { ok: 3, tot: 3 }; st.mathTimes[p] = [10, 10, 10]; });
  const plan = T.composeSdhPlan(st, T.sdhDateSeed(new Date(2026, 6, 7)));
  t('composeSdhPlan propone protocolo como skillDrill', plan.skillDrill && plan.skillDrill.drillType === 'protocolo');
  T.handleDashboardClick({ target: dashboardActionTarget('sdh-skill', { skillType: 'protocolo', drillIdx: String(plan.skillDrill.drillIdx) }) });
  t('sdh-skill abre detail de protocolo', T.drillsState().type === 'protocolo' && T.drillsState().view === 'detail');
}

console.log('M10-3 · P2R_LABELS enfocado por tipo');
{
  const { w } = boot(null);
  const T = w.__TEST__;
  ['tasas', 'loyalty', 'mix', 'percliente'].forEach(type => {
    const d = T.MCMATH.gen(type, type === 'tasas' ? 1 : 2);
    const slots = T.P2R_LABELS.forDrill(d);
    t(type + ': retorna 2-4 slots', slots.length >= 2 && slots.length <= 4);
    t(type + ': slots apuntan a legend[] valida y unica',
      slots.every(s => Number.isInteger(s.legendIndex) && s.legendIndex >= 0 && s.legendIndex < d.legend.length)
      && new Set(slots.map(s => s.legendIndex)).size === slots.length);
    if (type === 'percliente') {
      const rev = slots.find(s => s.id === 'revolver');
      t('percliente: paga-a-tiempo se ensena como dato para derivar revolvente',
        !!rev && /Clientes que pagan a tiempo/i.test(d.legend[rev.legendIndex].l) && /1 menos|No es la base/i.test(rev.why));
    }
  });
}

console.log('M10-4 · gate duro y pass first-try');
{
  const { w, document } = boot(null);
  const T = w.__TEST__;
  openProtocol(w, 0);
  t('input calculo ausente antes de labels OK', !/data-role="prot-input"/.test(document.getElementById('drills-root').innerHTML));
  const before = fullSignal(T.state());
  const mp0 = JSON.stringify(T.state().mathPats);
  const mt0 = JSON.stringify(T.state().mathTimes);
  fillLabels(T, false);
  t('labels correctas habilitan calculo', /data-role="prot-input"/.test(document.getElementById('drills-root').innerHTML));
  answerAndSubmit(T);
  const after = fullSignal(T.state());
  t('submit final escribe stepStats.protocolo correct true una vez', after.len === before.len + 1 && after.last === true);
  t('submit final incrementa drillHistory.protocolo una vez', after.hist === before.hist + 1);
  clickDrills(T, 'prot-submit');
  const dbl = fullSignal(T.state());
  t('doble submit no duplica senal', dbl.len === after.len && dbl.hist === after.hist);
  t('mathPats intacto', JSON.stringify(T.state().mathPats) === mp0);
  t('mathTimes intacto', JSON.stringify(T.state().mathTimes) === mt0);
}

console.log('M10-5 · labels wrong-first => correct false');
{
  const { w, document } = boot(null);
  const T = w.__TEST__;
  openProtocol(w, 1);
  fillLabels(T, true);
  t('etiquetas incorrectas NO habilitan calculo', !/data-role="prot-input"/.test(document.getElementById('drills-root').innerHTML));
  fillLabels(T, false);
  t('correccion posterior habilita calculo', /data-role="prot-input"/.test(document.getElementById('drills-root').innerHTML));
  answerAndSubmit(T);
  const sig = fullSignal(T.state());
  t('calculo correcto tras error de labels registra correct false', sig.len === 1 && sig.hist === 1 && sig.last === false);
}

console.log('M10-6 · abandono pre-submit = cero senal');
{
  const { w } = boot(null);
  const T = w.__TEST__;
  openProtocol(w, 2);
  fillLabels(T, false);
  inputDrills(T, 'prot-input', T.drillsState().protDrill.answer);
  clickDrills(T, 'drill-back-to-list');
  const sig = fullSignal(T.state());
  t('salir antes de prot-submit deja cero senal', sig.len === 0 && sig.hist === 0);
}

console.log('M10-7 · math runner original intacto');
{
  const { w, document } = boot(null);
  const T = w.__TEST__;
  const mp0 = JSON.stringify(T.state().mathPats);
  const mt0 = JSON.stringify(T.state().mathTimes);
  clickDrills(T, 'drill-open-type', { type: 'math' });
  const html = document.getElementById('drills-root').innerHTML;
  t('math sigue siendo generated', T.DRILL_TYPES.math.generated === true);
  t('math runner pinta drill-math-submit', /data-action="drill-math-submit"/.test(html));
  t('math runner no pinta prot-submit', !/data-action="prot-submit"/.test(html));
  t('abrir math no toca mathPats/mathTimes', JSON.stringify(T.state().mathPats) === mp0 && JSON.stringify(T.state().mathTimes) === mt0);
}

console.log('M10-8 · regresion harnesses previos (syntax)');
{
  ['harness-brickM3.js', 'harness-brickM5.js', 'harness-brickM8.js', 'harness-brickM9.js'].forEach(file => {
    if (!fs.existsSync(file)) return;
    let ok = false;
    try { cp.execFileSync(process.execPath, ['--check', file], { stdio: 'ignore' }); ok = true; }
    catch (_) { ok = false; }
    t(file + ' node --check verde', ok);
  });
}

console.log('');
console.log(`RESULTADO: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
