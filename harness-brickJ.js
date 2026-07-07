/* Harness Brick J — El Giro (M2). Corre sobre /tmp/test-index.html (copia con hook __TEST__).
   Cubre: J1 caso CON twist (aparece exactamente una vez al salir de fase 4; no avanza
   sin self-grade; pass=2/3; commit registra stepStats.giro + liveCaseLog.twist; fila
   en scorecard) · J2 caso SIN twist (secuencia fase-a-fase idéntica, twist nunca nace)
   · J3 descarte con giro mostrado (cero señal) · J4 restart tras giro gradeado (twist
   resetea, reaparece, commit viejo UNA vez) · J5 ESC en pantalla de giro (flujo de
   descarte actual) · J6 computeSkills recoge 'giro' + SKILL_LABELS · J7 registro
   LIVE_TWIST (shape 6 casos MC-densos). Los grep-counts de congelados van en bash. */
const fs = require('fs');
const { JSDOM } = require('jsdom');

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
function esc(w) {
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

/* Conduce el live desde fase 1 hasta el click de salida de fase 4 (live-next
   post-math). Devuelve el log de fases visitadas ANTES de ese último click. */
function driveToPhase4Exit(w, T) {
  const s = () => T.liveState();
  const seq = [];
  seq.push(s().phase);                                   // 1
  click(w, '[data-action="live-clar"]');
  click(w, '[data-action="live-next"]');
  seq.push(s().phase);                                   // 2
  click(w, '[data-action="live-struct-reveal"]');
  for (const ax of ['mece', 'hyp', 'tailored']) click(w, `[data-action="live-rubric"][data-axis="${ax}"][data-value="3"]`);
  click(w, '[data-action="live-next"]');
  seq.push(s().phase);                                   // 3
  click(w, '[data-action="live-hyp-reveal"]');
  click(w, '[data-action="live-hyp-rubric"][data-value="3"]');
  click(w, '[data-action="live-next"]');
  seq.push(s().phase);                                   // 4
  click(w, '[data-action="live-data-reveal"]');
  // math: instancia congelada — respondemos con su answer exacto
  s().mathVal = String(s().mathQ.answer);
  T.renderLiveCase();
  click(w, '[data-action="live-math-check"]');
  click(w, '[data-action="live-next"]');                 // salida de fase 4 — acá intercepta (o no)
  return seq;
}

/* Fase 5 → 6 → 7 con el bypass del recorder (el synth no es objeto de este
   harness): simulamos exactamente lo que hace el callback de live-synth-launch. */
function drivePhase5ToScorecard(w, T) {
  const s = T.liveState();
  click(w, '[data-action="live-push-reveal"]');
  click(w, '[data-action="live-push-rubric"][data-value="3"]');
  click(w, '[data-action="live-next"]');                 // → fase 6
  s.phaseScores.synth = 10; s.synthScore = 10; s.synthDone = true;
  s.phase = 7;
  s.totalSec = Math.max(1, Math.floor((Date.now() - s.startTs) / 1000));
  T.renderLiveCase();
}
function doTLOverlayAndClose(w, T) {
  click(w, '[data-action="tl-confound-live"][data-index="0"]');
  click(w, '[data-action="tl-reveal-live"]');
  click(w, '[data-action="tl-selfgrade-live"][data-value="yes"]');
  click(w, '[data-action="tl-close-live"]');             // → closeLiveCase → commit (único site)
}

(async () => {
  // ───────── J7 · Registro LIVE_TWIST ─────────
  console.log('\n── J7: registro LIVE_TWIST ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    t('hook vivo + LIVE_TWIST presente', !!T && !!T.LIVE_TWIST);
    const ids = ['wallet-entry', 'marketplace', 'streaming', 'pe-grocery', 'mobile-gaming', 'saas-pricing-usage'];
    t('exactamente los 6 casos MC-densos', Object.keys(T.LIVE_TWIST).sort().join(',') === ids.slice().sort().join(','));
    t('shape: trigger/invalidates/rubric[3] en los 6', ids.every(id => {
      const e = T.LIVE_TWIST[id];
      return e && typeof e.trigger === 'string' && e.trigger.length > 40 &&
             typeof e.invalidates === 'string' && Array.isArray(e.rubric) && e.rubric.length === 3;
    }));
    t('los 6 twist-cases existen en CASES', ids.every(id => T.CASES.some(c => c.id === id)));
    t('twist:null en defaultLiveState', T.defaultLiveState('hotel').twist === null);
  }

  // ───────── J1 · Caso CON twist (streaming) ─────────
  console.log('\n── J1: caso CON twist ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('streaming');
    const seq = driveToPhase4Exit(w, T);
    const s = T.liveState();
    t('fases previas 1→2→3→4 en orden', seq.join(',') === '1,2,3,4');
    t('giro intercepta: fase sigue en 4', s.phase === 4);
    t('sub-estado nace: shown, no revealed, graded null', !!s.twist && s.twist.shown && !s.twist.revealed && s.twist.graded === null);
    t('pantalla del giro renderizada (countdown + trigger)', !!w.document.querySelector('.live-twist-count') && !!w.document.querySelector('[data-action="live-twist-react"]'));
    t('continue NO existe antes del reveal', !w.document.querySelector('[data-action="live-twist-continue"]'));

    // segundo live-next durante el giro no existe como botón — y aunque el
    // handler corriera, twist ya truthy: no re-intercepta ni avanza solo.
    click(w, '[data-action="live-twist-react"]');
    t('react → revealed, fase sigue en 4', s.twist.revealed && s.phase === 4);
    click(w, '[data-action="live-twist-continue"]');   // sin picks: no avanza
    t('no avanza sin self-grade completo', s.phase === 4 && s.twist.graded === null);

    click(w, '[data-action="live-twist-grade"][data-crit="c1"][data-value="1"]');
    click(w, '[data-action="live-twist-grade"][data-crit="c2"][data-value="1"]');
    click(w, '[data-action="live-twist-grade"][data-crit="c3"][data-value="0"]');
    t('picks registrados', s.twist.picks.c1 === true && s.twist.picks.c2 === true && s.twist.picks.c3 === false);
    click(w, '[data-action="live-twist-continue"]');
    t('graded={c1:t,c2:t,c3:f} y AVANZA a fase 5', !!s.twist.graded && s.twist.graded.c1 && s.twist.graded.c2 && !s.twist.graded.c3 && s.phase === 5);

    drivePhase5ToScorecard(w, T);
    t('scorecard: fila Giro "a medias" (2/3)', w.document.querySelector('.live-sc-table').textContent.includes('Giro') && w.document.querySelector('.live-sc-table').textContent.includes('a medias'));
    t('giro apareció exactamente UNA vez (5→6→7 sin re-intercepción)', s.phase === 7);

    const st = T.state();
    t('pre-commit: cero stepStats.giro', !st.stepStats.giro || st.stepStats.giro.length === 0);
    doTLOverlayAndClose(w, T);
    t('commit: stepStats.giro = 1 entrada, correct=true (pass 2/3)', st.stepStats.giro.length === 1 && st.stepStats.giro[0].correct === true);
    const log = st.liveCaseLog[st.liveCaseLog.length - 1];
    t('liveCaseLog.twist = {pass:true, grades}', !!log.twist && log.twist.pass === true && log.twist.grades.c1 === true && log.twist.grades.c3 === false);
    t('live cerrado', T.liveState().active === false);
  }

  // ───────── J1b · pass=2/3 umbral: 1/3 = fail ─────────
  console.log('\n── J1b: umbral pass ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('marketplace');
    driveToPhase4Exit(w, T);
    const s = T.liveState();
    click(w, '[data-action="live-twist-react"]');
    click(w, '[data-action="live-twist-grade"][data-crit="c1"][data-value="1"]');
    click(w, '[data-action="live-twist-grade"][data-crit="c2"][data-value="0"]');
    click(w, '[data-action="live-twist-grade"][data-crit="c3"][data-value="0"]');
    click(w, '[data-action="live-twist-continue"]');
    drivePhase5ToScorecard(w, T);
    t('scorecard 1/3 = "mal"', w.document.querySelector('.live-sc-table').textContent.includes('mal'));
    doTLOverlayAndClose(w, T);
    const st = T.state();
    t('commit 1/3: correct=false', st.stepStats.giro.length === 1 && st.stepStats.giro[0].correct === false);
    t('liveCaseLog.twist.pass=false', st.liveCaseLog[st.liveCaseLog.length - 1].twist.pass === false);
  }

  // ───────── J2 · Caso SIN twist (hotel) ─────────
  console.log('\n── J2: caso SIN twist ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('hotel');
    const seq = driveToPhase4Exit(w, T);
    const s = T.liveState();
    t('fases 1→2→3→4 idénticas', seq.join(',') === '1,2,3,4');
    t('salida de fase 4 → fase 5 DIRECTO (sin intercepción)', s.phase === 5);
    t('twist jamás nace', s.twist === null);
    t('cero rastro de UI del giro', !w.document.querySelector('.live-twist-count') && !w.document.querySelector('[data-action="live-twist-react"]'));
    drivePhase5ToScorecard(w, T);
    t('scorecard sin fila Giro', !w.document.querySelector('.live-sc-table').textContent.includes('Giro'));
    doTLOverlayAndClose(w, T);
    const st = T.state();
    t('commit sin giro: stepStats.giro vacío', st.stepStats.giro.length === 0);
    t('liveCaseLog sin campo twist', st.liveCaseLog.length === 1 && !('twist' in st.liveCaseLog[0]));
  }

  // ───────── J3 · Descarte con giro mostrado ─────────
  console.log('\n── J3: descarte con giro mostrado ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('pe-grocery');
    driveToPhase4Exit(w, T);
    t('giro mostrado', !!T.liveState().twist);
    const logsBefore = (T.state().liveCaseLog || []).length;
    click(w, '[data-action="live-close"]');   // X / backdrop: fase 4 → cierre directo = descarte
    t('cierre descarta (active=false, sin discardAsk pre-7)', T.liveState().active === false);
    const st = T.state();
    t('cero stepStats.giro', st.stepStats.giro.length === 0);
    t('cero liveCaseLog nuevo', (st.liveCaseLog || []).length === logsBefore);
  }

  // ───────── J5 · ESC en pantalla de giro ─────────
  console.log('\n── J5: ESC en pantalla de giro ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('mobile-gaming');
    driveToPhase4Exit(w, T);
    t('giro en pantalla', !!w.document.querySelector('.live-twist-count'));
    esc(w);
    t('ESC = flujo de descarte actual (cierra, no commitea)', T.liveState().active === false);
    const st = T.state();
    t('cero señal tras ESC', st.stepStats.giro.length === 0 && (st.liveCaseLog || []).length === 0);
  }

  // ───────── J4 · Restart tras giro gradeado ─────────
  console.log('\n── J4: restart tras giro gradeado ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('saas-pricing-usage');
    driveToPhase4Exit(w, T);
    click(w, '[data-action="live-twist-react"]');
    for (const c of ['c1', 'c2', 'c3']) click(w, `[data-action="live-twist-grade"][data-crit="${c}"][data-value="1"]`);
    click(w, '[data-action="live-twist-continue"]');
    drivePhase5ToScorecard(w, T);
    click(w, '[data-action="tl-confound-live"][data-index="0"]');
    click(w, '[data-action="tl-reveal-live"]');
    click(w, '[data-action="tl-selfgrade-live"][data-value="yes"]');
    // restart con tlDone: cierra (commitea UNA vez) y reabre limpio
    click(w, '[data-action="live-restart"]');
    const s2 = T.liveState();
    t('restart: corrida nueva activa en fase 1', s2.active === true && s2.phase === 1);
    t('s.twist reseteado a null', s2.twist === null);
    const st = T.state();
    t('commit de la corrida vieja UNA sola vez', st.stepStats.giro.length === 1 && st.liveCaseLog.length === 1);
    t('twist de la corrida vieja registrado (3/3 pass)', st.liveCaseLog[0].twist.pass === true);
    driveToPhase4Exit(w, T);
    t('giro REAPARECE en la corrida nueva', !!s2.twist && s2.twist.shown && s2.phase === 4);
    t('sigue una sola señal (la nueva corrida no committeó aún)', st.stepStats.giro.length === 1);
  }

  // ───────── J6 · computeSkills + SKILL_LABELS ─────────
  console.log('\n── J6: skill graph recoge giro ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    t('SKILL_LABELS.giro presente', typeof T.SKILL_LABELS.giro === 'string' && T.SKILL_LABELS.giro.length > 0);
    const st = {
      stepStats: { giro: [{ correct: false, ts: 1 }, { correct: false, ts: 2 }, { correct: true, ts: 3 }] },
      mathPats: {}, mathTimes: {}
    };
    const sk = T.computeSkills(st);
    t('computeSkills expone giro con gate n≥3 (rate=1/3)', sk.giro && sk.giro.n === 3 && Math.abs(sk.giro.rate - 1 / 3) < 1e-9);
    t('13 skills ahora (8 stepStats + 5 P*)', Object.keys(sk).length === 13);
    const weak = T.weakestSkills(st, 20).filter(x => x.rate !== null);
    t('giro rankeable como debilidad medida', weak.length > 0 && weak[0].key === 'giro');
    const sk2 = T.computeSkills({ stepStats: { giro: [{ correct: true, ts: 1 }] }, mathPats: {}, mathTimes: {} });
    t('n<3 → rate null (explorando, no debilidad vendida)', sk2.giro.rate === null && sk2.giro.n === 1);
  }

  console.log(`\n════ RESULTADO: ${pass} PASS · ${fail} FAIL ════`);
  process.exit(fail ? 1 : 0);
})();
