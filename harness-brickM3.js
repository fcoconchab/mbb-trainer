/* Harness Brick M3 — Drill "Diseña el experimento". Auto-contenido: lee
   ./index.html, inyecta el hook __TEST__ antes del cierre del IIFE y escribe
   /tmp/test-index-m3.html. Cobertura: M3-0 registro EXPERIMENT_DRILLS (5 drills,
   shape completo id/prompt/key×6 piezas {r,why}, ids únicos) · M3-1 las 3 anclas
   de 'experimento' (DEFAULT_STATE.stepStats + SKILL_LABELS + reset runtime vía
   progress-reset-confirm) + drillHistory · M3-2 flujo pass: hub → detail → timer
   corre → reveal congela tiempo y mata countdown → grade 6 piezas (5 sí) →
   commit ÚNICO escribe stepStats.experimento{correct:true} + drillHistory+1 +
   drillCompletions · M3-3 flujo fail (4/6): stepStats correct:false, history NO
   sube, retry limpia rubric y rearma el reloj · M3-4 computeSkills incluye
   'experimento'; con 3 fails weakestSkills lo rankea débil · M3-5 sdh-skill
   end-to-end: plan del día elige experimento y el click abre el detail correcto ·
   M3-6 timer cleanup en las 3 salidas (reveal / volver a lista / switchTab) y
   convivencia con el timer amb · M3-7 abandono pre-grade y pre-reveal = cero
   señal · M3-8 los otros 7 tipos intactos (keys, shapes, flujo amb arranca su
   timer). Los grep-counts de congelados van en bash. */
const fs = require('fs');
const { JSDOM } = require('jsdom');

// ── build de la copia con hook ──
const raw = fs.readFileSync('./index.html', 'utf8');
const ANCHOR = 'renderDashboard();\n\n})();';
if (raw.split(ANCHOR).length !== 2) { console.error('ANCLA DEL HOOK NO ÚNICA'); process.exit(1); }
const HOOK = `renderDashboard();

  window.__TEST__ = {
    EXPERIMENT_DRILLS: EXPERIMENT_DRILLS, EXPERIMENT_PIECES: EXPERIMENT_PIECES,
    DRILL_TYPES: DRILL_TYPES, DEFAULT_STATE: DEFAULT_STATE, SKILL_LABELS: SKILL_LABELS,
    SDH_SKILL_DRILL: SDH_SKILL_DRILL,
    computeSkills: computeSkills, weakestSkills: weakestSkills, composeSdhPlan: composeSdhPlan,
    sdhDateSeed: sdhDateSeed,
    drillsState: function () { return drillsState; },
    state: function () { return state; },
    ambInterval: function () { return ambTimerInterval; },
    expInterval: function () { return expTimerInterval; }
  };

})();`;
fs.writeFileSync('/tmp/test-index-m3.html', raw.replace(ANCHOR, HOOK));
const html = fs.readFileSync('/tmp/test-index-m3.html', 'utf8');

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
// Navega hub → detail del drill de experimento idx 0
function openExpDetail(w) {
  w.MBB.switchTab('drills');
  click(w, '[data-action="drill-open-type"][data-type="experimento"]');
  click(w, '[data-action="drill-open"][data-index="0"]');
}
function gradeAll(w, yesKeys) {
  const T = w.__TEST__;
  for (const p of T.EXPERIMENT_PIECES) {
    const v = yesKeys.indexOf(p.key) >= 0 ? '1' : '0';
    click(w, `[data-action="exp-grade"][data-piece="${p.key}"][data-val="${v}"]`);
  }
}
const PIECE_KEYS = ['unidad', 'control', 'duracion', 'metrica', 'guardrail', 'lectura'];

// ════ M3-0 · registro ════
console.log('M3-0 · registro EXPERIMENT_DRILLS');
{
  const { dom, w } = boot(null);
  const T = w.__TEST__;
  t('5 drills en el registro', T.EXPERIMENT_DRILLS.length === 5);
  t('EXPERIMENT_PIECES = 6 keys canónicas', T.EXPERIMENT_PIECES.length === 6 && T.EXPERIMENT_PIECES.every((p, i) => p.key === PIECE_KEYS[i] && typeof p.label === 'string' && p.label.length > 0));
  const ids = T.EXPERIMENT_DRILLS.map(d => d.id);
  t('ids únicos', new Set(ids).size === 5);
  t('shape completo por drill: id + prompt + key×6 con {r, why} no vacíos',
    T.EXPERIMENT_DRILLS.every(d =>
      typeof d.id === 'string' && typeof d.prompt === 'string' && d.prompt.length > 40 &&
      d.key && Object.keys(d.key).length === 6 &&
      PIECE_KEYS.every(k => d.key[k] && typeof d.key[k].r === 'string' && d.key[k].r.length > 10 &&
                            typeof d.key[k].why === 'string' && d.key[k].why.length > 10)));
  t('DRILL_TYPES.experimento apunta al registro, no-generated, stateKey experimento',
    T.DRILL_TYPES.experimento && T.DRILL_TYPES.experimento.drills === T.EXPERIMENT_DRILLS &&
    !T.DRILL_TYPES.experimento.generated && T.DRILL_TYPES.experimento.stateKey === 'experimento');
  dom.window.close();
}

// ════ M3-1 · las 3 anclas ════
console.log('M3-1 · anclas de la key experimento');
{
  const dirty = { stepStats: { experimento: [{ correct: true, ts: 1 }] }, drillHistory: { experimento: 4 } };
  const { dom, w } = boot(dirty);
  const T = w.__TEST__;
  t('ancla 1: DEFAULT_STATE.stepStats.experimento es []', Array.isArray(T.DEFAULT_STATE.stepStats.experimento));
  t('ancla 1b: DEFAULT_STATE.drillHistory.experimento = 0', T.DEFAULT_STATE.drillHistory.experimento === 0);
  t('ancla 2: SKILL_LABELS.experimento presente', typeof T.SKILL_LABELS.experimento === 'string' && T.SKILL_LABELS.experimento.length > 0);
  // ancla 3: reset runtime
  w.MBB.switchTab('progress');
  click(w, '[data-action="progress-reset-ask"]');
  click(w, '[data-action="progress-reset-confirm"]');
  const st = T.state();
  t('ancla 3: reset deja stepStats.experimento = [] y drillHistory.experimento = 0',
    Array.isArray(st.stepStats.experimento) && st.stepStats.experimento.length === 0 && st.drillHistory.experimento === 0);
  dom.window.close();
}

// ════ M3-2 · flujo pass ════
console.log('M3-2 · flujo prompt → reveal → grade (pass 5/6)');
{
  const { dom, w } = boot(null);
  const T = w.__TEST__;
  openExpDetail(w);
  const ds = T.drillsState();
  t('detail abierto en experimento idx 0', ds.view === 'detail' && ds.type === 'experimento' && ds.drillIdx === 0);
  t('timer visible y corriendo', !!w.document.getElementById('exp-timer') && T.expInterval() != null);
  t('reveal habilitado sin inputs (producción en voz alta)', !!w.document.querySelector('[data-action="exp-reveal"]:not([disabled])'));
  click(w, '[data-action="exp-reveal"]');
  t('reveal: revealed + tiempo capturado + countdown muerto',
    ds.revealed === true && typeof ds.expTimeUsed === 'number' && T.expInterval() == null);
  t('key visible: 6 piezas con botones Sí/No', w.document.querySelectorAll('.exp-piece').length === 6 &&
    w.document.querySelectorAll('[data-action="exp-grade"]').length === 12);
  // 5 sí, 1 no (metrica en no) → pass
  gradeAll(w, ['unidad', 'control', 'duracion', 'guardrail', 'lectura']);
  const st = T.state();
  t('expGraded tras la 6ª pieza', ds.expGraded === true);
  t('stepStats.experimento registra 1 entrada correct:true',
    st.stepStats.experimento.length === 1 && st.stepStats.experimento[0].correct === true);
  t('drillHistory.experimento = 1 (pass sube el contador)', st.drillHistory.experimento === 1);
  t('drillCompletions.experimento[0] marcado', !!(st.drillCompletions && st.drillCompletions.experimento && st.drillCompletions.experimento[0]));
  t('verdict correcto 5/6 en el DOM', /Diseño sólido · 5\/6/.test(w.document.body.innerHTML));
  // idempotencia: re-click no duplica señal
  click(w, '[data-action="exp-grade"][data-piece="unidad"][data-val="0"]');
  t('grade post-commit no muta señal (registro UNA vez)',
    T.state().stepStats.experimento.length === 1 && ds.expRubric.unidad === 1);
  dom.window.close();
}

// ════ M3-3 · flujo fail + retry ════
console.log('M3-3 · flujo fail (4/6) y retry');
{
  const { dom, w } = boot(null);
  const T = w.__TEST__;
  openExpDetail(w);
  click(w, '[data-action="exp-reveal"]');
  gradeAll(w, ['unidad', 'control', 'duracion', 'metrica']);   // 4 sí → fail
  const st = T.state();
  t('stepStats registra correct:false', st.stepStats.experimento.length === 1 && st.stepStats.experimento[0].correct === false);
  t('drillHistory NO sube en fail', (st.drillHistory.experimento || 0) === 0);
  t('drillCompletions NO se marca en fail', !(st.drillCompletions && st.drillCompletions.experimento && st.drillCompletions.experimento[0]));
  t('verdict incompleto 4/6 + botón retry', /Diseño incompleto · 4\/6/.test(w.document.body.innerHTML) && !!w.document.querySelector('[data-action="drill-retry"]'));
  click(w, '[data-action="drill-retry"]');
  const ds = T.drillsState();
  t('retry limpia rubric/graded/revealed y rearma el reloj',
    ds.revealed === false && ds.expGraded === false &&
    PIECE_KEYS.every(k => ds.expRubric[k] === null) && T.expInterval() != null);
  dom.window.close();
}

// ════ M3-4 · skill graph ════
console.log('M3-4 · computeSkills incluye experimento');
{
  const pre = { stepStats: { experimento: [{ correct: false, ts: 1 }, { correct: false, ts: 2 }, { correct: false, ts: 3 }] } };
  const { dom, w } = boot(pre);
  const T = w.__TEST__;
  const sk = T.computeSkills(T.state());
  t('computeSkills emite la key experimento', !!sk.experimento);
  t('rate 0 con n=3 (gate n≥3 pasado)', sk.experimento.rate === 0 && sk.experimento.n === 3);
  const weak = T.weakestSkills(T.state());
  const rated = weak.filter(s => s.rate != null);
  t('weakestSkills lo rankea como el peor skill MEDIDO', rated.length > 0 && rated[0].key === 'experimento');
  dom.window.close();
}

// ════ M3-5 · sdh-skill end-to-end ════
console.log('M3-5 · SdH deep-linkea al drill de experimento');
{
  const good = () => [1, 2, 3].map(i => ({ correct: true, ts: i }));
  const pre = {
    stepStats: {
      ambiguedad: good(), synthesis: good(), hypothesis: good(), mece: good(),
      experimento: [{ correct: false, ts: 1 }, { correct: false, ts: 2 }, { correct: false, ts: 3 }]
    }
  };
  const { dom, w } = boot(pre);
  const T = w.__TEST__;
  const plan = T.composeSdhPlan(T.state(), T.sdhDateSeed());
  t('composeSdhPlan elige experimento como drill de debilidad',
    !!plan.skillDrill && plan.skillDrill.drillType === 'experimento' && plan.skillDrill.skill === 'experimento');
  t('drillIdx del plan dentro del banco (0–4)', plan.skillDrill.drillIdx >= 0 && plan.skillDrill.drillIdx < 5);
  t('mapeo SDH_SKILL_DRILL.experimento → experimento', T.SDH_SKILL_DRILL.experimento === 'experimento');
  const btn = w.document.querySelector('[data-action="sdh-skill"]');
  t('botón sdh-skill del home apunta a experimento', !!btn && btn.dataset.skillType === 'experimento');
  if (btn) btn.dispatchEvent(new w.Event('click', { bubbles: true }));
  const ds = T.drillsState();
  t('click abre el detail del drill correcto', ds.view === 'detail' && ds.type === 'experimento' && ds.drillIdx === plan.skillDrill.drillIdx);
  t('el timer arranca en el deep-link', T.expInterval() != null);
  dom.window.close();
}

// ════ M3-6 · timer cleanup en las 3 salidas + convivencia con amb ════
console.log('M3-6 · cleanup del timer');
{
  // salida 1: reveal (cubierta también en M3-2)
  const a = boot(null);
  openExpDetail(a.w);
  click(a.w, '[data-action="exp-reveal"]');
  t('salida 1 (reveal): interval muerto', a.w.__TEST__.expInterval() == null);
  a.dom.window.close();
  // salida 2: volver a la lista dentro de drills
  const b = boot(null);
  openExpDetail(b.w);
  t('pre-salida 2: interval vivo', b.w.__TEST__.expInterval() != null);
  click(b.w, '[data-action="drill-back-to-list"]');
  t('salida 2 (volver a lista): interval muerto', b.w.__TEST__.expInterval() == null);
  b.dom.window.close();
  // salida 3: switchTab fuera de drills
  const c = boot(null);
  openExpDetail(c.w);
  c.w.MBB.switchTab('home');
  t('salida 3 (switchTab): interval muerto', c.w.__TEST__.expInterval() == null);
  c.dom.window.close();
  // convivencia: abrir amb no enciende exp y viceversa
  const d = boot(null);
  d.w.MBB.switchTab('drills');
  click(d.w, '[data-action="drill-open-type"][data-type="ambiguedad"]');
  click(d.w, '[data-action="drill-open"][data-index="0"]');
  t('detail amb: amb corre, exp muerto', d.w.__TEST__.ambInterval() != null && d.w.__TEST__.expInterval() == null);
  click(d.w, '[data-action="drill-back-to-list"]');
  click(d.w, '[data-action="drill-back-to-hub"]');
  click(d.w, '[data-action="drill-open-type"][data-type="experimento"]');
  click(d.w, '[data-action="drill-open"][data-index="1"]');
  t('detail exp: exp corre, amb muerto', d.w.__TEST__.expInterval() != null && d.w.__TEST__.ambInterval() == null);
  d.dom.window.close();
}

// ════ M3-7 · abandono = cero señal ════
console.log('M3-7 · abandono pre-grade');
{
  // pre-reveal
  const a = boot(null);
  openExpDetail(a.w);
  a.w.MBB.switchTab('home');
  let st = a.w.__TEST__.state();
  t('abandono pre-reveal: cero señal', st.stepStats.experimento.length === 0 && (st.drillHistory.experimento || 0) === 0);
  a.dom.window.close();
  // post-reveal, grade parcial (3 de 6)
  const b = boot(null);
  openExpDetail(b.w);
  click(b.w, '[data-action="exp-reveal"]');
  ['unidad', 'control', 'duracion'].forEach(k => click(b.w, `[data-action="exp-grade"][data-piece="${k}"][data-val="1"]`));
  click(b.w, '[data-action="drill-back-to-list"]');
  st = b.w.__TEST__.state();
  t('grade parcial descartado: cero señal', st.stepStats.experimento.length === 0 && (st.drillHistory.experimento || 0) === 0);
  const ds = b.w.__TEST__.drillsState();
  click(b.w, '[data-action="drill-open"][data-index="0"]');
  t('re-entrada arranca limpia', ds.revealed === false && PIECE_KEYS.every(k => ds.expRubric[k] === null) && ds.expGraded === false);
  b.dom.window.close();
}

// ════ M3-8 · los otros 7 tipos intactos ════
console.log('M3-8 · tipos existentes intactos');
{
  const { dom, w } = boot(null);
  const T = w.__TEST__;
  const keys = Object.keys(T.DRILL_TYPES);
  t('8 tipos: los 7 originales + experimento',
    keys.length === 8 && ['hypothesis', 'math', 'mece', 'synthesis', 'builder', 'sizing', 'ambiguedad', 'experimento'].every(k => keys.indexOf(k) >= 0));
  t('shapes originales intactos (label/stateKey; math sigue generated)',
    T.DRILL_TYPES.ambiguedad.stateKey === 'ambiguedad' && T.DRILL_TYPES.math.generated === true &&
    T.DRILL_TYPES.hypothesis.stateKey === 'hypothesis' && T.DRILL_TYPES.sizing.stateKey === 'sizing');
  w.MBB.switchTab('drills');
  t('hub pinta 8 tiles', w.document.querySelectorAll('[data-action="drill-open-type"]').length === 8);
  // flujo amb sigue vivo end-to-end mínimo: abre y su timer corre
  click(w, '[data-action="drill-open-type"][data-type="ambiguedad"]');
  click(w, '[data-action="drill-open"][data-index="0"]');
  t('drill amb abre y su timer corre (Brick C intacto)', !!w.document.getElementById('amb-timer') && T.ambInterval() != null);
  dom.window.close();
}

console.log('\nRESULTADO: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
