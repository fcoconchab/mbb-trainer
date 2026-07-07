/* Harness Brick G — corre sobre /tmp/test-index.html (copia con hook __TEST__).
   Cubre: G1 rangos correctos (recomputación independiente × 100 × 20 casos)
   · G2 variabilidad (20 sorteos) · G3 instancia congelada intra-corrida
   · G4 flujo live verde (check ok/fail + commit + radar gateado por scored)
   · G5 live-restart re-sortea. */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/test-index.html', 'utf8');
let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL: ' + name); }
}

function boot(preState) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/' });
  const w = dom.window;
  if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  if (preState) w.localStorage.setItem('mbb_trainer_state_v1', JSON.stringify(preState));
  return { dom, w };
}

/* Recomputación INDEPENDIENTE desde los valores crudos del enunciado (vals).
   Fórmulas re-derivadas de la semántica de cada q — a propósito duplicadas
   respecto del generador: cazan mismatch template↔answer. */
const RECOMPUTE = {
  'hotel':              v => v.a - v.b,
  'saas-nrr':           v => (v.b - v.a) / v.a * 100,
  'pe-grocery':         v => v.bps / 10000 * v.rev,
  'streaming':          v => (v.b - v.a) / v.a * 100,
  'airline-co2':        v => v.a * v.b / 100,
  'hospital':           v => v.x * v.d / 100,
  'city-congestion':    v => (v.b - v.a) / v.a * 100,
  'saas-pricing':       v => (v.b - v.a) / v.a * 100,
  'cloud-migration':    v => v.a - v.b,
  'marketplace':        v => ((v.base + v.u / 100) - v.base) * 100,
  'wallet-entry':       v => v.m * (v.s / 100) * (v.p / 100) * (v.ad / 100),
  'sizing-delivery':    v => v.u * v.f * v.t * 12,
  'saas-pricing-usage': v => v.arr * (v.h / 100) * (v.up / 100),
  'marketplace-gmv':    v => (v.a - v.b) / v.a * 100,
  'dtc-margin':         v => (v.b - v.a) / v.a * 100,
  'saas-acquisition':   v => v.pr / v.r,
  'mobile-gaming':      v => v.pr * v.sp / 100,
  'enterprise-disrupt': v => v.c / (1 - v.d / 100),   // la computación inversa que hace el usuario
  'streaming-entry':    v => v.h * (v.bb / 100) * (v.pen / 100),
  'b2b-saas-sizing':    v => v.n * (v.t / 100) * (v.ad / 100) * v.acv / 1000
};
const SHAPE_KEYS = ['q', 'unit', 'answer', 'kind', 'pat', 'hint'];

(async () => {
  // ───────── G1 · rangos correctos: 100 gens × 20 casos, recompute vs tolOK ─────────
  console.log('\n── G1: recomputación independiente (100 × 20) ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    t('hook __TEST__ vivo', !!T && typeof T.liveMathGen === 'function');
    const ids = Object.keys(T.LIVE_MATH);
    t('20 casos en el registro', ids.length === 20);
    t('todas las entradas son funciones', ids.every(id => typeof T.LIVE_MATH[id] === 'function'));
    t('RECOMPUTE cubre los 20', ids.every(id => typeof RECOMPUTE[id] === 'function'));

    let allOk = true, badMsg = '';
    for (const id of ids) {
      const pats = new Set(), units = new Set();
      for (let k = 0; k < 100; k++) {
        const inst = T.liveMathGen(id);
        if (!inst || !SHAPE_KEYS.every(kk => kk in inst)) { allOk = false; badMsg = id + ': shape roto'; break; }
        if (typeof inst.q !== 'string' || !inst.q.length || typeof inst.hint !== 'string' || !inst.hint.length) { allOk = false; badMsg = id + ': q/hint vacío'; break; }
        if (!isFinite(inst.answer) || inst.answer <= 0) { allOk = false; badMsg = id + ': answer no finito/positivo → ' + inst.answer; break; }
        if (!inst.vals) { allOk = false; badMsg = id + ': sin vals'; break; }
        pats.add(inst.pat); units.add(inst.unit);
        const rec = RECOMPUTE[id](inst.vals);
        if (!T.MCMATH.tolOK(rec, inst.answer, inst.kind)) { allOk = false; badMsg = id + ': recompute ' + rec + ' vs answer ' + inst.answer + ' (' + inst.kind + ')'; break; }
      }
      if (!allOk) break;
      if (pats.size !== 1 || units.size !== 1) { allOk = false; badMsg = id + ': pat/unit no fijos'; break; }
    }
    t('100 gens × 20 casos: answer = recomputación desde el enunciado (tolOK)' + (badMsg ? ' [' + badMsg + ']' : ''), allOk);
  }

  // ───────── G2 · variabilidad: 20 sorteos → ≥5 enunciados distintos ─────────
  console.log('\n── G2: dos corridas no reciclan números (20 sorteos) ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    let allVar = true, worst = '';
    for (const id of Object.keys(T.LIVE_MATH)) {
      const qs = new Set();
      for (let k = 0; k < 20; k++) qs.add(T.liveMathGen(id).q);
      if (qs.size < 5) { allVar = false; worst = id + ' → ' + qs.size + ' distintos'; }
    }
    t('cada caso: ≥5 enunciados distintos en 20 sorteos' + (worst ? ' [' + worst + ']' : ''), allVar);
  }

  // ───────── G3 · instancia congelada intra-corrida ─────────
  console.log('\n── G3: instancia estable dentro de una corrida ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('hotel');
    const s = T.getLive();
    t('mathQ existe al abrir', !!s.mathQ && typeof s.mathQ.q === 'string');
    const inst0 = s.mathQ, q0 = s.mathQ.q, ans0 = s.mathQ.answer;
    // fase 4 + reveal de datos → la pregunta entra al DOM
    T.setLive({ phase: 4, dataRevealed: true });
    T.renderLiveCase();
    const dom1 = w.document.querySelector('#live-overlay').innerHTML;
    t('la q de la instancia está renderizada', dom1.indexOf(q0) !== -1);
    // re-render N veces → misma instancia, mismo enunciado
    T.renderLiveCase(); T.renderLiveCase(); T.renderLiveCase();
    const dom2 = w.document.querySelector('#live-overlay').innerHTML;
    t('re-render ×3 no re-sortea (mismo q en DOM)', dom2.indexOf(q0) !== -1);
    t('misma referencia de instancia', T.getLive().mathQ === inst0 && T.getLive().mathQ.answer === ans0);
  }

  // ───────── G4 · flujo live verde: check ok/fail + commit + radar gateado ─────────
  console.log('\n── G4: flujo del live sigue verde ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('hotel');
    T.setLive({ phase: 4, dataRevealed: true });
    T.renderLiveCase();
    const s = T.getLive();
    const inp = w.document.querySelector('#live-overlay [data-field="math"]');
    t('input de math en el DOM', !!inp);

    // check INCORRECTO
    inp.value = String(s.mathQ.answer + 999);
    const btn = w.document.createElement('button');
    btn.dataset.action = 'live-math-check';
    w.document.querySelector('#live-overlay').appendChild(btn);
    T.handleLiveClick({ target: btn });
    t('respuesta mala → mathOK false, phaseScores.math 0', s.mathOK === false && s.phaseScores.math === 0);
    t('el check NO cambió la instancia', T.getLive().mathQ.answer === s.mathQ.answer);

    // check CORRECTO (mismo enunciado, misma answer)
    const inp2 = w.document.querySelector('#live-overlay [data-field="math"]');
    inp2.value = String(s.mathQ.answer);
    const btn2 = w.document.createElement('button');
    btn2.dataset.action = 'live-math-check';
    w.document.querySelector('#live-overlay').appendChild(btn2);
    T.handleLiveClick({ target: btn2 });
    t('respuesta correcta → mathOK true, phaseScores.math 1', s.mathOK === true && s.phaseScores.math === 1);

    // commit: fase 7 + tlDone → único call site vía closeLiveCase
    const st = T.getState();
    const patBefore = JSON.stringify(st.mathPats && st.mathPats[s.mathQ.pat] || null);
    const logBefore = (st.liveCaseLog || []).length;
    T.setLive({ phase: 7, tlDone: true });
    T.getLive().phaseScores.structure = 7; T.getLive().phaseScores.hypo = 2;
    T.getLive().phaseScores.pushback = 2; T.getLive().phaseScores.synth = 9;
    T.closeLiveCase();
    t('commit corrió: scored=true', T.getLive().scored === true);
    t('liveCaseLog +1', (st.liveCaseLog || []).length === logBefore + 1);
    const patAfter = JSON.stringify(st.mathPats[s.mathQ.pat]);
    t('radar bumpeado en el pat de la instancia (' + s.mathQ.pat + ')', patAfter !== patBefore && st.mathPats[s.mathQ.pat].ok >= 1);
    // gate s.scored: un segundo close NO duplica
    T.getLive().active = true;
    T.closeLiveCase();
    t('segundo close no duplica el commit (gate s.scored)', (st.liveCaseLog || []).length === logBefore + 1);

    // caso sin registro de math → degradé (null, fase 4 sin número clave)
    t('liveMathGen de caso fantasma → null', T.liveMathGen('caso-fantasma') === null);
  }

  // ───────── G5 · live-restart re-sortea ─────────
  console.log('\n── G5: restart re-sortea ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('wallet-entry');   // pool grande (162 combos)
    const qs = new Set([T.getLive().mathQ.q]);
    const first = T.getLive().mathQ;
    for (let k = 0; k < 7; k++) {
      // restart en fase < 7 va directo a openLiveCase (path real del handler)
      const btn = w.document.createElement('button');
      btn.dataset.action = 'live-restart';
      w.document.querySelector('#live-overlay').appendChild(btn);
      T.handleLiveClick({ target: btn });
      qs.add(T.getLive().mathQ.q);
    }
    t('nueva instancia (referencia distinta)', T.getLive().mathQ !== first);
    t('8 corridas → ≥3 enunciados distintos', qs.size >= 3);
  }

  console.log('\n═══ RESULTADO: ' + pass + ' PASS · ' + fail + ' FAIL ═══');
  process.exit(fail ? 1 : 0);
})();
