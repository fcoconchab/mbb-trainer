/* Harness Brick K — Primeros 4 casos Mastercard cableados (M1a).
   Auto-contenido: lee ./index.html, inyecta el hook __TEST__ antes del cierre del
   IIFE y escribe /tmp/test-index.html. Cubre: K0 conteos de registros (24/24/24/24/24,
   MC_DENSITY 10, LIVE_TWIST 10) · K1 contrato de 8 piezas por caso nuevo (keys exactas,
   3 diagnose con 1 strong, 3 clarifying con prioridades válidas, 3 hypotheses con
   1 strong en el índice de HYPOTHESIS_BEST y 2 weak con failurePath, framework 3
   buckets, dataReveals con insight, synthesis con número, overlay con confound best,
   twist con trigger numérico + rubric[3]) · K2 generadores (recomputación independiente
   ×100 pasa tolOK; pat/unit/kind estables; variedad entre corridas; instancia congelada
   en liveState.mathQ) · K3 flujo GUIADO end-to-end de card-activation (diagnose →
   grade-subq ×3 → gate del overlay → completedCases) · K4 flujo LIVE end-to-end de
   smart-branch (fase 4 → giro intercepta → self-grade 3/3 → fases 5-7 → fila Giro en
   scorecard → commit con stepStats.giro + liveCaseLog.twist) · K5 SdH con state fresco
   (caso del slot ∈ los 4 nuevos; determinismo por seed) · K6 catálogo 24 cards +
   completedSet consistente. La byte-identidad de los 20 viejos y los grep-counts de
   congelados van en bash (diff de bloques pre/post). */
const fs = require('fs');
const { JSDOM } = require('jsdom');

// ── build de la copia con hook ──
const raw = fs.readFileSync('./index.html', 'utf8');
const ANCHOR = 'renderDashboard();\n\n})();';
if (raw.split(ANCHOR).length !== 2) { console.error('ANCLA DEL HOOK NO ÚNICA'); process.exit(1); }
const HOOK = `renderDashboard();

  window.__TEST__ = {
    CASES: CASES, LIVE_MATH: LIVE_MATH, LIVE_TWIST: LIVE_TWIST, TL_OVERLAY: TL_OVERLAY,
    CLARIFYING_PRIORITY: CLARIFYING_PRIORITY, HYPOTHESIS_BEST: HYPOTHESIS_BEST,
    CASE_MATH_PAT: CASE_MATH_PAT, CASE_MC_DENSITY: CASE_MC_DENSITY, MCMATH: MCMATH,
    liveMathGen: liveMathGen, defaultLiveState: defaultLiveState,
    openLiveCase: openLiveCase, closeLiveCase: closeLiveCase, renderLiveCase: renderLiveCase,
    handleLiveClick: handleLiveClick,
    liveState: function () { return liveState; }, getLive: function () { return liveState; },
    computeSkills: computeSkills, weakestSkills: weakestSkills, composeSdhPlan: composeSdhPlan,
    state: function () { return state; }, caseSession: function () { return caseSessionState; },
    renderCases: renderCases, switchTab: switchTab
  };

})();`;
fs.writeFileSync('/tmp/test-index.html', raw.replace(ANCHOR, HOOK));
const html = fs.readFileSync('/tmp/test-index.html', 'utf8');

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

const NEW_IDS = ['smart-branch', 'card-activation', 'acquirer-mdr', 'credit-launch'];
const RECOMPUTE = {
  'smart-branch':    v => v.cap / (v.dr + v.ds),
  'card-activation': v => (v.tc + v.lift) * v.inc / v.lift,
  'acquirer-mdr':    v => (v.vol * v.mix / 100) * ((v.mdr - 0.8 - 0.12) / 100),
  'credit-launch':   v => (v.cac / (v.act / 100)) / v.k * 360
};
const EXPECT_PAT = { 'smart-branch': 'P4', 'card-activation': 'P2R', 'acquirer-mdr': 'P2R', 'credit-launch': 'P2R' };

(async () => {
  // ───────── K0 · Conteos de registros ─────────
  console.log('\n── K0: conteos de registros ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    t('hook vivo', !!T && Array.isArray(T.CASES));
    t('CASES = 24', T.CASES.length === 24);
    t('los 4 ids nuevos existen en CASES', NEW_IDS.every(id => T.CASES.some(c => c.id === id)));
    t('ids únicos en CASES (sin colisión)', new Set(T.CASES.map(c => c.id)).size === 24);
    t('LIVE_MATH = 24 generadores', Object.keys(T.LIVE_MATH).length === 24);
    t('CLARIFYING_PRIORITY = 24', Object.keys(T.CLARIFYING_PRIORITY).length === 24);
    t('HYPOTHESIS_BEST = 24', Object.keys(T.HYPOTHESIS_BEST).length === 24);
    t('CASE_MATH_PAT = 24', Object.keys(T.CASE_MATH_PAT).length === 24);
    t('CASE_MC_DENSITY = 10 (6 viejos + 4 nuevos)', Object.keys(T.CASE_MC_DENSITY).length === 10);
    t('LIVE_TWIST = 10 (6 viejos + 4 nuevos)', Object.keys(T.LIVE_TWIST).length === 10);
    t('TL_OVERLAY = 24', Object.keys(T.TL_OVERLAY).length === 24);
    t('los 6 twists viejos siguen', ['wallet-entry','marketplace','streaming','pe-grocery','mobile-gaming','saas-pricing-usage'].every(id => !!T.LIVE_TWIST[id]));
  }

  // ───────── K1 · Contrato de 8 piezas por caso nuevo ─────────
  console.log('\n── K1: contrato de 8 piezas × 4 ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    for (const id of NEW_IDS) {
      const c = T.CASES.find(x => x.id === id);
      t(`[${id}] shape base (title/type/typeColor/industry/difficulty/prompt/context)`,
        !!c && [c.title, c.type, c.typeColor, c.industry, c.difficulty, c.prompt, c.context].every(s => typeof s === 'string' && s.length > 0) && /^badge-/.test(c.typeColor));
      t(`[${id}] diagnose: 3 opciones, 1 strong, feedback en todas`,
        c.diagnose.length === 3 && c.diagnose.filter(d => d.strength === 'strong').length === 1 &&
        c.diagnose.every(d => ['strong','partial','weak'].includes(d.strength) && d.text && d.feedback.length > 60));
      t(`[${id}] clarifying: 3 preguntas + prioridades válidas con 1 best`,
        c.clarifying.length === 3 && c.clarifying.every(q => typeof q === 'string' && q.length > 20) &&
        T.CLARIFYING_PRIORITY[id].length === 3 && T.CLARIFYING_PRIORITY[id].every(p => ['best','good','low'].includes(p)) &&
        T.CLARIFYING_PRIORITY[id].filter(p => p === 'best').length === 1);
      const hb = T.HYPOTHESIS_BEST[id];
      t(`[${id}] hypotheses: 3, strong en índice HYPOTHESIS_BEST (${hb}), 2 weak con failurePath denso`,
        c.hypotheses.length === 3 && c.hypotheses[hb].strength === 'strong' && !c.hypotheses[hb].failurePath &&
        c.hypotheses.filter(h => h.strength === 'weak').length === 2 &&
        c.hypotheses.filter(h => h.strength === 'weak').every(h => typeof h.failurePath === 'string' && h.failurePath.length > 300));
      t(`[${id}] framework: 3 buckets con ≥3 items c/u`,
        c.framework.length === 3 && c.framework.every(b => b.name && Array.isArray(b.items) && b.items.length >= 3));
      t(`[${id}] dataReveals: ≥2 con label/text/insight (insight con "so what")`,
        c.dataReveals.length >= 2 && c.dataReveals.every(d => d.label && d.text.length > 80 && d.insight.length > 80));
      t(`[${id}] pushback + synthesis {answer CON número, support, risk, nextstep}`,
        typeof c.pushback === 'string' && c.pushback.length > 40 &&
        ['answer','support','risk','nextstep'].every(k => typeof c.synthesis[k] === 'string' && c.synthesis[k].length > 60) &&
        /\d/.test(c.synthesis.answer));
      const o = T.TL_OVERLAY[id];
      t(`[${id}] overlay propio: control/incremental/confound(3 opts, 1 best)/gateStat/gateEcon/pilot con guardrail`,
        !!o && [o.control, o.incremental, o.gateStat, o.gateEcon, o.pilot].every(s => typeof s === 'string' && s.length > 40) &&
        o.confound.opts.length === 3 && o.confound.opts.filter(x => x.p === 'best').length === 1 &&
        o.confound.opts.every(x => ['best','good','low'].includes(x.p)) && /guardrail/i.test(o.pilot));
      const tw = T.LIVE_TWIST[id];
      t(`[${id}] twist: trigger diegético con número + invalidates + rubric[3]`,
        !!tw && typeof tw.trigger === 'string' && tw.trigger.length > 80 && /\d/.test(tw.trigger) &&
        typeof tw.invalidates === 'string' && tw.invalidates.length > 80 &&
        Array.isArray(tw.rubric) && tw.rubric.length === 3 && tw.rubric.every(r => r.length > 60));
      t(`[${id}] MC_DENSITY=2 y MATH_PAT espejo del generador (${EXPECT_PAT[id]})`,
        T.CASE_MC_DENSITY[id] === 2 && T.CASE_MATH_PAT[id] === EXPECT_PAT[id]);
    }
  }

  // ───────── K2 · Generadores paramétricos ─────────
  console.log('\n── K2: generadores (×100 tolOK + variedad + instancia congelada) ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    for (const id of NEW_IDS) {
      let allOK = true, kinds = new Set(), pats = new Set(), units = new Set(), answers = new Set();
      for (let i = 0; i < 100; i++) {
        const r = T.LIVE_MATH[id]();
        kinds.add(r.kind); pats.add(r.pat); units.add(r.unit); answers.add(r.answer);
        const rec = RECOMPUTE[id](r.vals);
        if (!T.MCMATH.tolOK(rec, r.answer, r.kind)) allOK = false;
        if (!(typeof r.q === 'string' && r.q.length > 40 && typeof r.hint === 'string' && r.hint.length > 20 && isFinite(r.answer) && r.answer > 0)) allOK = false;
      }
      t(`[${id}] recomputación independiente ×100 pasa tolOK + q/hint/answer sanos`, allOK);
      t(`[${id}] pat/unit/kind estables (pat=${[...pats][0]})`, kinds.size === 1 && pats.size === 1 && units.size === 1 && [...pats][0] === EXPECT_PAT[id]);
      t(`[${id}] pools generan variedad (≥3 respuestas distintas en 100)`, answers.size >= 3);
    }
    // instancia congelada por corrida + restart re-sortea (patrón G)
    T.openLiveCase('acquirer-mdr');
    const q1 = T.getLive().mathQ;
    T.renderLiveCase(); T.renderLiveCase();
    t('instancia congelada: re-render no re-sortea (misma referencia)', T.getLive().mathQ === q1);
    const seen = new Set([q1.q]);
    for (let k = 0; k < 7; k++) {
      const btn = w.document.createElement('button');
      btn.dataset.action = 'live-restart';
      w.document.querySelector('#live-overlay').appendChild(btn);
      T.handleLiveClick({ target: btn });
      seen.add(T.getLive().mathQ.q);
    }
    t('dos corridas → números distintos (8 restarts ⇒ ≥2 enunciados)', seen.size >= 2);
  }

  // ───────── K3 · Flujo GUIADO end-to-end (card-activation) ─────────
  console.log('\n── K3: guiado end-to-end card-activation ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.switchTab('cases');
    t('catálogo abierto', !!w.document.querySelector('[data-case-id="card-activation"]'));
    click(w, '[data-case-id="card-activation"]');
    const s = T.caseSession();
    t('detalle abierto (diagnose renderizado)', !!w.document.querySelector('[data-action="select-diagnose"]'));
    click(w, '[data-action="select-diagnose"][data-index="0"]');
    click(w, '[data-action="advance-after-feedback"]');
    t('diagnose revelado (strong=índice 0)', s.diagnoseRevealed === true);
    click(w, '[data-action="toggle-clarifying"][data-index="1"]');   // la best de card-activation
    click(w, '[data-action="reveal-clarifying"]');
    t('clarifying revelado', s.clarifyingRevealed === true);
    click(w, '[data-action="select-hypothesis"][data-index="0"]');
    click(w, '[data-action="advance-after-feedback"]');
    t('hypothesis revelada', s.hypothesisRevealed === true);
    click(w, '[data-action="reveal-framework"]');
    click(w, '[data-action="reveal-data"]');
    click(w, '[data-action="reveal-data"]');
    t('2 dataReveals abiertos', s.revealedDataCount === 2);
    click(w, '[data-action="reveal-pushback"]');
    t('pushback + síntesis reveladas', s.revealedPushback && s.revealedSynthesis);
    for (const f of ['gradeAnswer', 'gradeSupport', 'gradeRiskNext']) click(w, `[data-action="grade-subq"][data-field="${f}"]`);
    t('3 grades registrados', !!s.gradeAnswer && !!s.gradeSupport && !!s.gradeRiskNext);
    t('GATE: sin overlay, el caso NO se completa', !(T.state().completedCases || []).includes('card-activation'));
    t('overlay presente con 3 confounds', w.document.querySelectorAll('[data-action="tl-confound"]').length === 3);
    click(w, '[data-action="tl-confound"][data-index="0"]');        // la best (free riders)
    click(w, '[data-action="tl-reveal"]');
    click(w, '[data-action="tl-selfgrade"][data-value="yes"]');
    t('gate pasado: completedCases incluye card-activation', T.state().completedCases.includes('card-activation'));
    t('casesCompleted consistente', T.state().casesCompleted === T.state().completedCases.length);
  }

  // ───────── K4 · Flujo LIVE end-to-end con GIRO (smart-branch) ─────────
  console.log('\n── K4: live end-to-end smart-branch con giro ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('smart-branch');
    const s = T.liveState();
    t('live abierto con mathQ congelado del generador nuevo', s.active && !!s.mathQ && s.mathQ.pat === 'P4');
    // fases 1→4
    click(w, '[data-action="live-clar"]');
    click(w, '[data-action="live-next"]');
    click(w, '[data-action="live-struct-reveal"]');
    for (const ax of ['mece', 'hyp', 'tailored']) click(w, `[data-action="live-rubric"][data-axis="${ax}"][data-value="3"]`);
    click(w, '[data-action="live-next"]');
    click(w, '[data-action="live-hyp-reveal"]');
    click(w, '[data-action="live-hyp-rubric"][data-value="3"]');
    click(w, '[data-action="live-next"]');
    t('fase 4 alcanzada', s.phase === 4);
    click(w, '[data-action="live-data-reveal"]');
    s.mathVal = s.mathQ.answer.toFixed(1);   // como lo tipearia el usuario (String(ans) con decimal periodico rompe parseAns)
    T.renderLiveCase();
    click(w, '[data-action="live-math-check"]');
    t('math del caso nuevo gradea OK con la instancia congelada', s.mathOK === true);
    click(w, '[data-action="live-next"]');                          // salida de fase 4
    t('GIRO intercepta la salida de fase 4', s.phase === 4 && !!s.twist && s.twist.shown);
    t('trigger del giro en pantalla (terciles)', w.document.body.textContent.includes('perfil demográfico'));
    click(w, '[data-action="live-twist-react"]');
    for (const c of ['c1', 'c2', 'c3']) click(w, `[data-action="live-twist-grade"][data-crit="${c}"][data-value="1"]`);
    click(w, '[data-action="live-twist-continue"]');
    t('self-grade 3/3 y avanza a fase 5', !!s.twist.graded && s.phase === 5);
    click(w, '[data-action="live-push-reveal"]');
    click(w, '[data-action="live-push-rubric"][data-value="3"]');
    click(w, '[data-action="live-next"]');                          // → fase 6
    s.phaseScores.synth = 10; s.synthScore = 10; s.synthDone = true;
    s.phase = 7;
    s.totalSec = Math.max(1, Math.floor((Date.now() - s.startTs) / 1000));
    T.renderLiveCase();
    const sc = w.document.querySelector('.live-sc-table');
    t('scorecard con fila Giro ("bien" 3/3)', !!sc && sc.textContent.includes('Giro') && sc.textContent.includes('bien'));
    const stPre = T.state();
    t('pre-commit: cero señal de giro', !stPre.stepStats.giro || stPre.stepStats.giro.length === 0);
    click(w, '[data-action="tl-confound-live"][data-index="0"]');
    click(w, '[data-action="tl-reveal-live"]');
    click(w, '[data-action="tl-selfgrade-live"][data-value="yes"]');
    click(w, '[data-action="tl-close-live"]');
    const st = T.state();
    const log = st.liveCaseLog[st.liveCaseLog.length - 1];
    t('commit: stepStats.giro = 1 entrada correct=true', st.stepStats.giro.length === 1 && st.stepStats.giro[0].correct === true);
    t('liveCaseLog: caseId nuevo + twist.pass=true', log.caseId === 'smart-branch' && !!log.twist && log.twist.pass === true);
    t('live cerrado', T.liveState().active === false);
  }

  // ───────── K5 · SdH con state fresco ─────────
  console.log('\n── K5: SdH — slot de caso con state fresco ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    const p1 = T.composeSdhPlan(T.state(), 20260706);
    const p2 = T.composeSdhPlan(T.state(), 20260706);
    t('determinista con el mismo seed', !!p1.liveCase && p2.liveCase.id === p1.liveCase.id);
    t('no es repaso con state fresco', p1.caseIsRepaso === false);
    // Con state fresco weakestSkills arranca en P1 (n=0, alfabético) → deb prende
    // para los MC-densos con pat P1 (semántica Brick I, congelada). Top-3 real:
    // pe-grocery(11), saas-pricing-usage(11), acquirer-mdr(9). Verificamos que un
    // caso NUEVO está en el top-3 barriendo seeds (el rng del día elige entre 3).
    const picked = new Set();
    for (let seed = 1; seed <= 40; seed++) {
      const p = T.composeSdhPlan(T.state(), seed);
      if (p.liveCase) picked.add(p.liveCase.id);
    }
    t('≥1 caso nuevo en el top-3 del slot (aparece al barrer seeds)', NEW_IDS.some(id => picked.has(id)));
    t('todo elegido del slot es MC-denso (densidad 2)', [...picked].every(id => T.CASE_MC_DENSITY[id] === 2));
    t('el top-3 fresco es exactamente {pe-grocery, saas-pricing-usage, acquirer-mdr}', [...picked].sort().join(',') === 'acquirer-mdr,pe-grocery,saas-pricing-usage');
  }

  // ───────── K6 · Catálogo + completedSet ─────────
  console.log('\n── K6: catálogo 24 + completedSet ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.state().completedCases.push('acquirer-mdr');
    T.state().casesCompleted = 1;
    T.switchTab('cases');
    const cards = w.document.querySelectorAll('.case-card');
    t('24 cards en el catálogo', cards.length === 24);
    const done = w.document.querySelector('.case-card[data-case-id="acquirer-mdr"]');
    t('completedSet marca el caso nuevo completado', !!done && done.className.includes('completed'));
    t('los otros 3 nuevos no marcados', NEW_IDS.filter(id => id !== 'acquirer-mdr').every(id => !w.document.querySelector(`.case-card[data-case-id="${id}"]`).className.includes('completed')));
  }

  console.log('\n═══ RESULTADO: ' + pass + ' PASS · ' + fail + ' FAIL ═══');
  process.exit(fail ? 1 : 0);
})();
