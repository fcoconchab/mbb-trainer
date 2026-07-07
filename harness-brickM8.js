/* Harness Brick M8 — Exhibits T&L. Auto-contenido: lee ./index.html, inyecta
   el hook __TEST__ antes del cierre del IIFE y escribe /tmp/test-index-m8.html.
   Cobertura: M8-0 registro con 11 exhibits, ids únicos, shape completo por
   exhibit nuevo (id/title/context/render/table|bars/prompt/observations/
   insight/trap/quant{q,answer,unit,kind,hint}) · M8-1 los 6 originales
   byte-idénticos (sha256 de JSON.stringify capturado pre-edit) · M8-2 cada
   quant nuevo recalculado DESDE los datos del exhibit (DiD, promedios, ancho
   de IC, % pull-forward — no se copia el answer) y tolOK acepta la respuesta ·
   M8-3 render de cada exhibit nuevo no lanza y pinta lo esperado (bars con
   negativos, tabla con outlier); flujo reveal → quant check 'correct' con
   input toFixed (lección K); exh-reveal persiste exhibitsCompleted una sola
   vez · M8-4 selección de SdH con el array extendido: 6 originales hechos →
   propone ex-test-control; los 11 hechos → exhibit null + allExhibits · M8-5
   branches 'table'/'bars' originales intactos (ex-mix-shift, ex-profit-bridge
   renderizan) y la lista muestra 11 cards. Grep-counts de congelados en bash. */
const fs = require('fs');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');

// ── build de la copia con hook ──
const raw = fs.readFileSync('./index.html', 'utf8');
const ANCHOR = 'renderDashboard();\n\n})();';
if (raw.split(ANCHOR).length !== 2) { console.error('ANCLA DEL HOOK NO ÚNICA'); process.exit(1); }
const HOOK = `renderDashboard();

  window.__TEST__ = {
    EXHIBITS: EXHIBITS,
    MCMATH: MCMATH,
    composeSdhPlan: composeSdhPlan, sdhDateSeed: sdhDateSeed,
    state: function () { return state; },
    setExhibit: function (id) { currentExhibitId = id; },
    getExhibit: function () { return currentExhibitId; },
    renderExhibits: renderExhibits,
    switchTab: switchTab
  };

})();`;
fs.writeFileSync('/tmp/test-index-m8.html', raw.replace(ANCHOR, HOOK));
const html = fs.readFileSync('/tmp/test-index-m8.html', 'utf8');

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL: ' + name); }
}

function boot(preState) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/',
    beforeParse(win) {
      if (!win.matchMedia) win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      if (preState) win.localStorage.setItem('mbb_trainer_state_v1', JSON.stringify(preState));
    }
  });
  return { dom, w: dom.window };
}
function click(w, sel) {
  const el = w.document.querySelector(sel);
  if (!el) return false;
  el.dispatchEvent(new w.Event('click', { bubbles: true }));
  return true;
}

const NEW_IDS = ['ex-test-control', 'ex-did', 'ex-lift-ic', 'ex-matched-panel', 'ex-pull-forward'];
const ORIG_IDS = ['ex-mix-shift', 'ex-profit-bridge', 'ex-concentration', 'ex-cohort-decay', 'ex-channel-economics', 'ex-benchmark'];
// sha256 de JSON.stringify(EXHIBITS.slice(0,6)) capturado en el checkpoint PRE-M8.
const ORIG_HASH = 'a2ac58febd0b75e20f3e2b979162ad803814ed520fdde9546eb28ab89fdb6b3e';

// ════════ M8-0 · registro: 11 exhibits, ids únicos, shape completo ════════
console.log('\nM8-0 · registro EXHIBITS');
{
  const { w } = boot(null);
  const EX = w.__TEST__.EXHIBITS;
  t('11 exhibits en el registro', EX.length === 11);
  t('ids únicos', new Set(EX.map(x => x.id)).size === 11);
  t('los 6 primeros son los originales, en orden', ORIG_IDS.every((id, i) => EX[i].id === id));
  t('los 5 nuevos van al final, en orden', NEW_IDS.every((id, i) => EX[6 + i].id === id));
  let shapeOK = true, dataOK = true, quantOK = true;
  NEW_IDS.forEach(id => {
    const ex = EX.find(x => x.id === id);
    if (!ex) { shapeOK = false; return; }
    if (typeof ex.title !== 'string' || typeof ex.context !== 'string'
      || typeof ex.prompt !== 'string' || typeof ex.insight !== 'string'
      || typeof ex.trap !== 'string' || !Array.isArray(ex.observations)
      || ex.observations.length < 3) shapeOK = false;
    if (ex.render !== 'table' && ex.render !== 'bars') shapeOK = false;
    if (ex.render === 'table') {
      if (!ex.table || !Array.isArray(ex.table.headers) || !Array.isArray(ex.table.rows)
        || !ex.table.rows.every(r => r.length === ex.table.headers.length)) dataOK = false;
    } else {
      if (!ex.bars || typeof ex.bars.unit !== 'string' || !Array.isArray(ex.bars.items)
        || !ex.bars.items.every(it => typeof it.label === 'string' && typeof it.value === 'number')) dataOK = false;
    }
    const q = ex.quant;
    if (!q || typeof q.q !== 'string' || typeof q.answer !== 'number' || !isFinite(q.answer)
      || typeof q.unit !== 'string' || typeof q.kind !== 'string' || typeof q.hint !== 'string') quantOK = false;
  });
  t('shape completo (title/context/render/prompt/observations≥3/insight/trap)', shapeOK);
  t('data coherente con el render (table: filas = headers; bars: {label,value:number})', dataOK);
  t('quant completo con answer numérico finito', quantOK);
  t('render solo usa valores existentes table|bars (cero render nuevo)', EX.every(x => x.render === 'table' || x.render === 'bars'));
}

// ════════ M8-1 · los 6 originales byte-idénticos ════════
console.log('\nM8-1 · originales byte-idénticos');
{
  const { w } = boot(null);
  const six = JSON.stringify(w.__TEST__.EXHIBITS.slice(0, 6));
  const h = crypto.createHash('sha256').update(six, 'utf8').digest('hex');
  t('sha256(JSON.stringify de los 6 originales) = hash del checkpoint pre-M8', h === ORIG_HASH);
}

// ════════ M8-2 · quants recalculados desde los datos (no copiados) ════════
console.log('\nM8-2 · quants derivados de los datos + tolOK');
{
  const { w } = boot(null);
  const EX = w.__TEST__.EXHIBITS;
  const tolOK = w.__TEST__.MCMATH.tolOK;
  const byId = id => EX.find(x => x.id === id);

  // ex-test-control: lift = promedio(diferencia post) − promedio(diferencia pre)
  {
    const ex = byId('ex-test-control');
    const v = ex.bars.items.map(it => it.value);
    const pre = v.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
    const post = v.slice(4).reduce((a, b) => a + b, 0) / 4;
    const calc = post - pre;
    t('ex-test-control: lift recalculado desde bars = answer (' + calc + ')', Math.abs(calc - ex.quant.answer) < 1e-9);
    t('ex-test-control: tolOK acepta el recalculado', tolOK(calc, ex.quant.answer, ex.quant.kind));
    t('ex-test-control: pre-periodo promedia ~0 (matching sano)', Math.abs(pre) < 1e-9);
  }
  // ex-did: DiD aritmético desde las celdas de la tabla
  {
    const ex = byId('ex-did');
    const num = s => parseFloat(s);
    const testRow = ex.table.rows[0], ctrlRow = ex.table.rows[1];
    const calc = (num(testRow[2]) - num(testRow[1])) - (num(ctrlRow[2]) - num(ctrlRow[1]));
    t('ex-did: DiD recalculado desde la tabla = answer (' + calc + ')', Math.abs(calc - ex.quant.answer) < 1e-9);
    t('ex-did: tolOK acepta el recalculado', tolOK(calc, ex.quant.answer, ex.quant.kind));
    t('ex-did: bases pre iguales entre test y control (mismo punto de partida)', num(testRow[1]) === num(ctrlRow[1]));
  }
  // ex-lift-ic: ancho del IC del cashback = superior − inferior
  {
    const ex = byId('ex-lift-ic');
    const cb = ex.table.rows.find(r => /Cashback/.test(r[0]));
    const num = s => parseFloat(String(s).replace('%', '').replace(',', '.'));
    const lo = num(cb[2]), hi = num(cb[3]);
    const calc = hi - lo;
    t('ex-lift-ic: ancho de IC recalculado = answer (' + calc + ')', Math.abs(calc - ex.quant.answer) < 1e-9);
    t('ex-lift-ic: tolOK acepta el recalculado', tolOK(calc, ex.quant.answer, ex.quant.kind));
    t('ex-lift-ic: el IC del cashback efectivamente cruza cero', lo < 0 && hi > 0);
    const rd = ex.table.rows.find(r => /Rediseno/.test(r[0]));
    t('ex-lift-ic: el IC del rediseno NO cruza cero (significativo pero chico)', num(rd[2]) > 0 && num(rd[3]) > 0);
  }
  // ex-matched-panel: promedio sin el par con nota de confound
  {
    const ex = byId('ex-matched-panel');
    const clean = ex.table.rows.filter(r => r[2] === '—');
    const vals = clean.map(r => parseFloat(String(r[1]).replace('+', '')));
    const calc = vals.reduce((a, b) => a + b, 0) / vals.length;
    t('ex-matched-panel: 4 pares limpios + 1 con nota de confound', clean.length === 4 && ex.table.rows.length === 5);
    t('ex-matched-panel: promedio limpio recalculado = answer (' + calc + ')', Math.abs(calc - ex.quant.answer) < 1e-9);
    t('ex-matched-panel: tolOK acepta el recalculado', tolOK(calc, ex.quant.answer, ex.quant.kind));
    const outlier = ex.table.rows.find(r => r[2] !== '—');
    t('ex-matched-panel: el outlier domina el promedio bruto (bruto > 2x limpio)',
      (vals.reduce((a, b) => a + b, 0) + parseFloat(String(outlier[1]).replace('+', ''))) / 5 > 2 * calc);
  }
  // ex-pull-forward: % devuelto = |suma post| / suma promo
  {
    const ex = byId('ex-pull-forward');
    const v = ex.bars.items.map(it => it.value);
    const promo = v.slice(0, 4).reduce((a, b) => a + b, 0);
    const post = v.slice(4).reduce((a, b) => a + b, 0);
    const calc = Math.abs(post) / promo * 100;   // 50/120 = 41,666…%
    t('ex-pull-forward: promo +120 / post −50 recalculados desde bars', promo === 120 && post === -50);
    t('ex-pull-forward: answer con decimal finito ≈ recalculado (|Δ| < 0,05)', Math.abs(calc - ex.quant.answer) < 0.05);
    t('ex-pull-forward: tolOK acepta el valor exacto recalculado', tolOK(calc, ex.quant.answer, ex.quant.kind));
    t('ex-pull-forward: el neto sigue positivo (no todo era pull-forward)', promo + post > 0);
  }
}

// ════════ M8-3 · render + flujo reveal/quant de cada exhibit nuevo ════════
console.log('\nM8-3 · render y flujo de los 5 nuevos');
{
  NEW_IDS.forEach(id => {
    const { w } = boot(null);
    const T = w.__TEST__;
    const ex = T.EXHIBITS.find(x => x.id === id);
    T.switchTab('exhibits');
    T.setExhibit(id);
    let threw = false;
    try { T.renderExhibits(); } catch (e) { threw = true; }
    const root = w.document.getElementById('exhibits-root');
    t(id + ': render del detalle no lanza y pinta el contexto', !threw && root.innerHTML.indexOf('exh-context') !== -1);
    if (ex.render === 'bars') {
      const negs = root.querySelectorAll('.exh-bar-fill.neg').length;
      const expNegs = ex.bars.items.filter(it => it.value < 0).length;
      t(id + ': bars pinta ' + expNegs + ' barras negativas', negs === expNegs);
    } else {
      t(id + ': tabla pinta ' + ex.table.rows.length + ' filas', root.querySelectorAll('.exh-table tbody tr').length === ex.table.rows.length);
    }
    // reveal → persiste una sola vez → quant correcto con toFixed (lección K)
    click(w, '[data-action="exh-reveal"]');
    t(id + ': reveal persiste exhibitsCompleted', T.state().exhibitsCompleted.indexOf(id) !== -1);
    const input = w.document.querySelector('.exh-quant-input');
    input.value = ex.quant.answer.toFixed(2).replace('.', ',');
    click(w, '[data-action="exh-check"]');
    const res = w.document.querySelector('.exh-quant-result');
    t(id + ': quant check acepta la respuesta (formato chileno, toFixed)', res && res.className.indexOf('correct') !== -1 && res.className.indexOf('incorrect') === -1);
    // segundo reveal-click no duplica el id
    T.renderExhibits();
    click(w, '[data-action="exh-reveal"]');
    const n = T.state().exhibitsCompleted.filter(x => x === id).length;
    t(id + ': completado no se duplica', n <= 1);
  });
}

// ════════ M8-4 · selección de SdH con el array extendido ════════
console.log('\nM8-4 · SdH con 11 exhibits');
{
  const { w } = boot({ exhibitsCompleted: ORIG_IDS.slice() });
  const T = w.__TEST__;
  const plan = T.composeSdhPlan(T.state(), T.sdhDateSeed());
  t('con los 6 originales hechos, SdH propone el primer nuevo (ex-test-control)',
    plan.exhibit && plan.exhibit.id === 'ex-test-control');
  t('allExhibits = false con nuevos pendientes', plan.allExhibits === false);

  const { w: w2 } = boot({ exhibitsCompleted: ORIG_IDS.concat(NEW_IDS) });
  const T2 = w2.__TEST__;
  const plan2 = T2.composeSdhPlan(T2.state(), T2.sdhDateSeed());
  t('con los 11 hechos, exhibit = null y allExhibits = true', plan2.exhibit === null && plan2.allExhibits === true);

  const { w: w3 } = boot(null);
  const plan3 = w3.__TEST__.composeSdhPlan(w3.__TEST__.state(), w3.__TEST__.sdhDateSeed());
  t('estado fresco: SdH sigue proponiendo el primer original (ex-mix-shift)',
    plan3.exhibit && plan3.exhibit.id === 'ex-mix-shift');
}

// ════════ M8-5 · originales renderizan intactos + lista con 11 cards ════════
console.log('\nM8-5 · branches table/bars originales intactos');
{
  const { w } = boot(null);
  const T = w.__TEST__;
  T.switchTab('exhibits');
  const root = w.document.getElementById('exhibits-root');
  t('la lista muestra 11 cards', root.querySelectorAll('.exh-card').length === 11);
  t('el subtitulo dice Once', root.innerHTML.indexOf('Once lecturas') !== -1);

  T.setExhibit('ex-mix-shift');
  let threw = false;
  try { T.renderExhibits(); } catch (e) { threw = true; }
  t('ex-mix-shift (table original) renderiza sin lanzar', !threw && root.querySelectorAll('.exh-table tbody tr').length === 3);

  T.setExhibit('ex-profit-bridge');
  threw = false;
  try { T.renderExhibits(); } catch (e) { threw = true; }
  t('ex-profit-bridge (bars original) renderiza sin lanzar, con negativos', !threw && root.querySelectorAll('.exh-bar-fill.neg').length === 3);

  // quant original sigue graduando igual
  click(w, '[data-action="exh-reveal"]');
  const input = w.document.querySelector('.exh-quant-input');
  input.value = '73,3';
  click(w, '[data-action="exh-check"]');
  const res = w.document.querySelector('.exh-quant-result');
  t('quant de ex-profit-bridge sigue aceptando 73,3', res && res.className.indexOf('correct') !== -1 && res.className.indexOf('incorrect') === -1);
}

console.log('\n══════════════════════════════');
console.log('PASS ' + pass + ' / ' + (pass + fail) + (fail ? '  ✗ FALLARON ' + fail : '  — todo verde'));
process.exit(fail ? 1 : 0);
