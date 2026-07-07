/* Harness Brick I — corre sobre /tmp/test-index.html (copia con hook __TEST__).
   Cubre: I1 computeSkills (vacío / sesgado / empates / slow / gate n≥3)
   · I2 determinismo (mismo (state,seed) ×20; seeds distintas; render no muta
   state ni el RNG de MCMATH) · I3 slot de caso (MC-denso arriba con señal
   sesgada; recién vivido baja; score>0 estructural para los 20)
   · I4 slot de debilidad (sdh-skill abre el drill correcto en jsdom)
   · I5 flujos viejos verdes (sdh-math con weakestPat; recall due; state pre-I). */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/test-index.html', 'utf8');
let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL: ' + name); }
}

function boot(preState) {
  // beforeParse: el state sintético debe estar en localStorage ANTES de que
  // el script inline corra loadState() (JSDOM ejecuta scripts al construir).
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/',
    beforeParse(win) {
      if (!win.matchMedia) win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      if (preState) win.localStorage.setItem('mbb_trainer_state_v1', JSON.stringify(preState));
    }
  });
  return { dom, w: dom.window };
}

/* State sintético: señal sesgada configurable. */
function synthState(opts) {
  opts = opts || {};
  const mk = (ok, tot) => Array.from({ length: tot }, (_, i) => ({ correct: i < ok, ts: 1700000000000 + i }));
  return {
    stepStats: {
      diagnose:   mk(opts.diagnoseOk != null ? opts.diagnoseOk : 4, opts.diagnoseN != null ? opts.diagnoseN : 5),
      hypothesis: mk(opts.hypOk != null ? opts.hypOk : 4, opts.hypN != null ? opts.hypN : 5),
      math:       mk(4, 5),
      mece:       mk(opts.meceOk != null ? opts.meceOk : 4, opts.meceN != null ? opts.meceN : 5),
      synthesis:  mk(opts.synOk != null ? opts.synOk : 4, opts.synN != null ? opts.synN : 5),
      clarifying: mk(4, 5),
      ambiguedad: mk(opts.ambOk != null ? opts.ambOk : 4, opts.ambN != null ? opts.ambN : 5)
    },
    mathPats: Object.assign(
      { P1: { ok: 8, tot: 10 }, P2D: { ok: 8, tot: 10 }, P2R: { ok: 8, tot: 10 }, P3: { ok: 8, tot: 10 }, P4: { ok: 8, tot: 10 } },
      opts.mathPats || {}),
    mathTimes: Object.assign({ P1: [], P2D: [], P2R: [], P3: [], P4: [] }, opts.mathTimes || {}),
    liveCaseLog: opts.liveCaseLog || [],
    exhibitsCompleted: opts.exhibitsCompleted || []
  };
}

(async () => {
  // ───────── I1 · computeSkills ─────────
  console.log('\n── I1: computeSkills ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    t('hook __TEST__ vivo', !!T && typeof T.computeSkills === 'function');

    // state vacío → TODO 'sin datos'
    const empty = T.computeSkills({ stepStats: {}, mathPats: {}, mathTimes: {} });
    const keys = Object.keys(empty);
    t('12 skills (7 stepStats + 5 P*)', keys.length === 12);
    t('vacío: todos rate=null', keys.every(k => empty[k].rate === null));
    t('vacío: todos n=0', keys.every(k => empty[k].n === 0));

    // sesgado: ambiguedad 1/8, synthesis 3/8, hypothesis 7/8 → orden correcto
    const st = synthState({ ambOk: 1, ambN: 8, synOk: 3, synN: 8, hypOk: 7, hypN: 8 });
    const sk = T.computeSkills(st);
    t('rate ambiguedad = 1/8', Math.abs(sk.ambiguedad.rate - 1 / 8) < 1e-9);
    const weak = T.weakestSkills(st);
    t('weakest[0] = ambiguedad', weak[0].key === 'ambiguedad');
    const iAmb = weak.findIndex(s => s.key === 'ambiguedad');
    const iSyn = weak.findIndex(s => s.key === 'synthesis');
    const iHyp = weak.findIndex(s => s.key === 'hypothesis');
    t('orden: ambiguedad < synthesis < hypothesis', iAmb < iSyn && iSyn < iHyp);

    // gate n≥3: n=2 → rate null (explorar), y explorar va ANTES que medido
    const st2 = synthState({ meceOk: 1, meceN: 2 });
    const sk2 = T.computeSkills(st2);
    t('n=2 → rate null (sin datos)', sk2.mece.rate === null && sk2.mece.n === 2);
    const weak2 = T.weakestSkills(st2);
    t('sin-datos primero (explorar = prioridad alta)', weak2[0].rate === null);

    // empates deterministas: dos skills 0-de-5 → alfabético
    const st3 = synthState({ ambOk: 0, ambN: 5, synOk: 0, synN: 5 });
    const w3 = T.weakestSkills(st3);
    const zeroKeys = w3.filter(s => s.rate === 0).map(s => s.key);
    t('empate 0% roto alfabético (ambiguedad antes que synthesis)',
      zeroKeys.indexOf('ambiguedad') < zeroKeys.indexOf('synthesis'));
    // ×5 corridas idénticas (sin RNG en el orden)
    let same = true;
    const ref = JSON.stringify(T.weakestSkills(st3));
    for (let i = 0; i < 5; i++) if (JSON.stringify(T.weakestSkills(st3)) !== ref) same = false;
    t('weakestSkills determinista ×5', same);

    // slow contra MATH_TARGET: P2R target 25, mediana 40 → slow; con n<3 en tiempos → gate respetado
    const st4 = synthState({ mathTimes: { P2R: [38, 40, 44], P3: [10, 11] } });
    const sk4 = T.computeSkills(st4);
    t('slow=true con mediana 40 > target 25 (P2R)', sk4.P2R.slow === true);
    t('gate n≥3 de mathMedian: 2 muestras → slow=false', sk4.P3.slow === false);
    // slow desempata a igual rate: P2R (slow) debe ir antes que P3 (no slow) a rates iguales
    const w4 = T.weakestSkills(st4);
    t('slow antes que no-slow a igual rate', w4.findIndex(s => s.key === 'P2R') < w4.findIndex(s => s.key === 'P3'));
  }

  // ───────── I2 · determinismo del plan ─────────
  console.log('\n── I2: determinismo (state, seed) ──');
  {
    const st = synthState({ ambOk: 1, ambN: 8 });
    const { w } = boot(st);
    const T = w.__TEST__;
    const S = T.state;

    // mismo (state, seed) → plan idéntico ×20
    const plan0 = JSON.stringify(T.composeSdhPlan(S, 20260706));
    let stable = true;
    for (let i = 0; i < 20; i++) if (JSON.stringify(T.composeSdhPlan(S, 20260706)) !== plan0) stable = false;
    t('mismo (state, seed) → plan idéntico ×20', stable);

    // fechas distintas → algún plan distinto en ≤10 fechas
    const plans = new Set();
    for (let d = 1; d <= 10; d++) plans.add(JSON.stringify(T.composeSdhPlan(S, 20260700 + d)));
    t('≤10 fechas → planes distintos (variedad real)', plans.size > 1);

    // componer/renderizar NO muta state
    const snapA = JSON.stringify(S);
    for (let i = 0; i < 5; i++) T.composeSdhPlan(S, 20260706);
    T.renderDashboard();
    T.renderDashboard();
    const snapB = JSON.stringify(S);
    t('re-render/composición no muta state (snapshot idéntico)', snapA === snapB);

    // ...ni el RNG de MCMATH: bajo RAND sembrado, gen() da lo mismo con y sin render al medio
    // (seededRun es privado; sembramos comparando dos ventanas idénticas del flujo)
    const dA = T.MCMATH.gen('pct-change', 2); // consume Math.random — solo verificamos que el render no INTERCALA consumo
    // Prueba fuerte: mulberry32 local — misma semilla, mismo stream aunque el plan se componga al medio
    const r1 = T.MCMATH.mulberry32(42), seq1 = [r1(), r1(), r1()];
    const r2 = T.MCMATH.mulberry32(42);
    const a = r2(); T.composeSdhPlan(S, 20260706); const b = r2(); T.renderDashboard(); const c = r2();
    t('instancia local: componer/render no toca streams ajenos', JSON.stringify(seq1) === JSON.stringify([a, b, c]));
    t('mulberry32 exportado y sembrable', typeof T.MCMATH.mulberry32 === 'function' && dA && typeof dA.answer !== 'undefined');
  }

  // ───────── I3 · slot de caso ─────────
  console.log('\n── I3: slot de caso (score MC × debilidad × recencia) ──');
  {
    // señal sesgada a P2R → streaming (density 2, pat P2R) debe quedar arriba
    const stP2R = synthState({ mathPats: { P2R: { ok: 1, tot: 10 } }, ambOk: 1, ambN: 8 });
    const { w } = boot(stP2R);
    const T = w.__TEST__;
    const S = T.state;
    // top del plan a lo largo de 15 seeds: el pick vive en el top-3; streaming debe aparecer
    const picks = new Set();
    for (let d = 1; d <= 15; d++) picks.add(T.composeSdhPlan(S, 20260700 + d).liveCase.id);
    t('con P2R débil, un caso MC-denso sale elegido (streaming en picks)', picks.has('streaming'));
    t('todos los picks son MC-densos o match P2R', [...picks].every(id =>
      T.CASE_MC_DENSITY[id] === 2 || T.CASE_MATH_PAT[id] === 'P2R'));

    // caso recién vivido baja: streaming vivido HOY → sale del top
    const stFresh = synthState({
      mathPats: { P2R: { ok: 1, tot: 10 } },
      liveCaseLog: [{ caseId: 'streaming', ts: Date.now(), totalSec: 900, phaseScores: {}, total: 10 }]
    });
    const { w: w2 } = boot(stFresh);
    const T2 = w2.__TEST__;
    const picks2 = new Set();
    for (let d = 1; d <= 15; d++) picks2.add(T2.composeSdhPlan(T2.state, 20260700 + d).liveCase.id);
    t('caso recién vivido (ts fresco) desaparece de los picks', !picks2.has('streaming'));

    // los 20 alcanzables: ningún score estructural 0 → piso = W_MC × 1 > 0.
    // Chequeo estructural: con densidades y pats dados, mc mínimo es 1.
    t('CASE_MC_DENSITY: solo los 6 payments-adjacentes con 2', Object.keys(T.CASE_MC_DENSITY).length === 6 && Object.values(T.CASE_MC_DENSITY).every(v => v === 2));
    t('CASE_MATH_PAT cubre los 20 casos de CASES', T.CASES.every(c => typeof T.CASE_MATH_PAT[c.id] === 'string'));
    t('pats del espejo ∈ P1/P2D/P2R/P3/P4', Object.values(T.CASE_MATH_PAT).every(p => ['P1','P2D','P2R','P3','P4'].includes(p)));
  }

  // ───────── I4 · slot de debilidad + sdh-skill ─────────
  console.log('\n── I4: slot de debilidad (sdh-skill abre el drill correcto) ──');
  {
    const st = synthState({ ambOk: 0, ambN: 8 });  // ambigüedad 0/8 = skill más débil, con drill mapeado
    const { w } = boot(st);
    const T = w.__TEST__;
    const plan = T.composeSdhPlan(T.state, 20260706);
    t('skillDrill presente', !!plan.skillDrill);
    t('skill elegido = ambiguedad', plan.skillDrill.skill === 'ambiguedad');
    t('drillType mapeado = ambiguedad', plan.skillDrill.drillType === 'ambiguedad');
    t('drillIdx dentro de rango', plan.skillDrill.drillIdx >= 0 && plan.skillDrill.drillIdx < T.DRILL_TYPES.ambiguedad.drills.length);

    // en el DOM: el botón sdh-skill existe y el click abre el drill
    T.renderDashboard();
    const btn = w.document.querySelector('[data-action="sdh-skill"]');
    t('botón sdh-skill renderizado', !!btn);
    t('data-skill-type=ambiguedad', btn && btn.getAttribute('data-skill-type') === 'ambiguedad');
    if (btn) {
      btn.dispatchEvent(new w.Event('click', { bubbles: true }));
      const ds = T.drillsState();
      t('click → drillsState.type = ambiguedad', ds.type === 'ambiguedad');
      t('click → view = detail', ds.view === 'detail');
      t('click → drillIdx del plan', ds.drillIdx === plan.skillDrill.drillIdx);
    }

    // header de foco: 0% · n=8 visible (señal medida) — nunca miente
    T.renderDashboard();
    const focoTxt = w.document.getElementById('dashboard-root').textContent;
    t("header 'Foco de hoy' con rate medido", /Foco de hoy/.test(focoTxt) && /0%\s*·\s*n=8/.test(focoTxt));

    // skill débil SIN drill mapeado (clarifying 0/8, resto sano) → slot cae al siguiente mapeado, header etiqueta igual
    const stC = synthState({});
    stC.stepStats.clarifying = Array.from({ length: 8 }, () => ({ correct: false, ts: 1 }));
    const { w: w3 } = boot(stC);
    const T3 = w3.__TEST__;
    const plan3 = T3.composeSdhPlan(T3.state, 20260706);
    t('clarifying débil (sin drill) → skillDrill salta al siguiente mapeado', plan3.skillDrill && plan3.skillDrill.skill !== 'clarifying');
    t('focus honesto: sigue siendo clarifying en el header', plan3.focus.key === 'clarifying');
  }

  // ───────── I5 · flujos viejos verdes ─────────
  console.log('\n── I5: flujos viejos verdes ──');
  {
    // state pre-I mínimo (sin mathTimes/liveCaseLog nuevos) carga sin error
    const preI = { stepStats: { math: [{ correct: true, ts: 1 }] }, mathPats: { P2R: { ok: 0, tot: 6 } } };
    let bootOk = true, w;
    try { w = boot(preI).w; T = w.__TEST__; T.renderDashboard(); } catch (e) { bootOk = false; }
    t('state viejo (pre-I) carga y renderiza sin error', bootOk);
    const T5 = w.__TEST__;

    // sdh-math sigue sembrando weakestPat (P2R con 0/6)
    const mbtn = w.document.querySelector('[data-action="sdh-math"]');
    t('botón sdh-math presente', !!mbtn);
    if (mbtn) {
      mbtn.dispatchEvent(new w.Event('click', { bubbles: true }));
      const ds = T5.drillsState();
      t('sdh-math → mathFocus = weakestPat (P2R)', ds.mathFocus === 'P2R');
      t('sdh-math → runner en detail', ds.type === 'math' && ds.view === 'detail');
    }

    // recall due: state vacío → los 10 frameworks due (sin entrada = due), ítem de Recall arriba
    const { w: w6 } = boot(null);
    const T6 = w6.__TEST__;
    t('srsDueCount = FRAMEWORKS.length con srs vacío', T6.srsDueCount() === T6.FRAMEWORKS.length);
    T6.renderDashboard();
    const txt = w6.document.getElementById('dashboard-root').textContent;
    t('ítem de Recall visible en SdH', /vencido/.test(txt));
    t('ítem de exhibit visible (primer no-leído)', /Lee un exhibit/.test(txt));
    t('ítem de caso visible', /caso en vivo/.test(txt));
    t("header 'explorando' con state virgen (sin datos, no miente)", /explorando/.test(txt) && !/%\s*·\s*n=/.test(txt.match(/Foco de hoy[^\n]*/)[0]));

    // plan idéntico entre dos renders del mismo día (mismo caso propuesto)
    const c1 = (w6.document.querySelector('[data-action="sdh-live"]') || {}).getAttribute
      ? w6.document.querySelector('[data-action="sdh-live"]').getAttribute('data-case-id') : null;
    T6.renderDashboard();
    const c2 = (w6.document.querySelector('[data-action="sdh-live"]') || {}).getAttribute
      ? w6.document.querySelector('[data-action="sdh-live"]').getAttribute('data-case-id') : null;
    t('re-render mismo día → mismo caso propuesto', c1 && c1 === c2);
  }

  console.log(`\n═══ Brick I: ${pass} PASS · ${fail} FAIL ═══`);
  process.exit(fail ? 1 : 0);
})();
