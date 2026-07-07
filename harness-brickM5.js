/* Harness Brick M5 — Multi-bloque quant en el live (M5). Auto-contenido: lee
   ./index.html, inyecta el hook __TEST__ antes del cierre del IIFE y escribe
   /tmp/test-index.html. Cubre: M5-0 registro LIVE_MATH_EXTRA (4 casos K × 2
   gens, shape estándar) · M5-1 recomputación ×100 por generador pasa tolOK ·
   M5-2 secuencia completa smart-branch: extra A (salida 3) → principal (4) →
   giro (salida 4) → extra B (salida 5), instancias congeladas, un disparo por
   extra, commit registra bumpMathPat + liveCaseLog.extras, filas en scorecard
   · M5-3 caso SIN entrada = flujo byte-idéntico (streaming con giro, hotel sin)
   · M5-4 restart re-sortea + dos corridas con números distintos + commit viejo
   una sola vez · M5-5 descarte con extra resuelto a medias = cero señal ·
   M5-6 ESC durante un check extra = cierre directo actual de esa fase.
   Los grep-counts de congelados van en bash. */
const fs = require('fs');
const { JSDOM } = require('jsdom');

// ── build de la copia con hook ──
const raw = fs.readFileSync('./index.html', 'utf8');
const ANCHOR = 'renderDashboard();\n\n})();';
if (raw.split(ANCHOR).length !== 2) { console.error('ANCLA DEL HOOK NO ÚNICA'); process.exit(1); }
const HOOK = `renderDashboard();

  window.__TEST__ = {
    CASES: CASES, LIVE_MATH: LIVE_MATH, LIVE_TWIST: LIVE_TWIST, LIVE_MATH_EXTRA: LIVE_MATH_EXTRA,
    MCMATH: MCMATH, liveMathGen: liveMathGen, defaultLiveState: defaultLiveState,
    openLiveCase: openLiveCase, closeLiveCase: closeLiveCase, renderLiveCase: renderLiveCase,
    liveState: function () { return liveState; },
    state: function () { return state; }
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
function esc(w) {
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

// Recomputación independiente por generador (fuente de verdad del harness).
const RECOMPUTE = {
  'acquirer-mdr': [
    v => ((v.cr * v.mA / 100 + v.dr * (100 - v.mA) / 100) - (v.cr * v.mB / 100 + v.dr * (100 - v.mB) / 100)) * 100,
    v => v.volR * v.d / 100
  ],
  'credit-launch': [
    v => v.g * v.c / 100 * v.icd / 100,
    v => ((v.S * v.m / 100) + v.K - v.C / 2) / v.S * 100
  ],
  'smart-branch': [
    v => v.mm * 12 * 2.577 - v.cap,
    v => v.cap / (v.mr * 12)
  ],
  'card-activation': [
    v => v.n * 1000 * v.c / 100 * v.inc,
    v => v.n * 10 * v.p * v.cltv
  ]
};
const K_IDS = ['acquirer-mdr', 'credit-launch', 'smart-branch', 'card-activation'];

/* Fases 1→3 (deja el live parado EN fase 3 con la rúbrica lista). */
function driveToPhase3Done(w, T) {
  click(w, '[data-action="live-clar"]');                                 // gate de fase 1
  click(w, '[data-action="live-next"]');                                 // 1 → 2
  click(w, '[data-action="live-struct-reveal"]');
  for (const ax of ['mece', 'hyp', 'tailored']) click(w, `[data-action="live-rubric"][data-axis="${ax}"][data-value="3"]`);
  click(w, '[data-action="live-next"]');                                 // 2 → 3
  click(w, '[data-action="live-hyp-reveal"]');
  click(w, '[data-action="live-hyp-rubric"][data-value="3"]');
}
/* Resuelve el check extra en pantalla: alimenta ansStr, comprueba, continúa. */
function resolveExtra(w, T, ansStr) {
  const inp = w.document.querySelector('[data-field="extramath"]');
  if (inp) inp.value = ansStr;
  click(w, '[data-action="live-extra-check"]');
  click(w, '[data-action="live-extra-continue"]');
}
/* Fase 4 completa: reveal + principal correcto. */
function doPhase4Math(w, T) {
  const s = T.liveState();
  click(w, '[data-action="live-data-reveal"]');
  const inp = w.document.querySelector('[data-field="math"]');
  if (inp) inp.value = s.mathQ.answer.toFixed(2);                        // como un usuario real (lección K)
  click(w, '[data-action="live-math-check"]');
}
/* Giro completo 2/3. */
function doTwist(w, T) {
  click(w, '[data-action="live-twist-react"]');
  click(w, '[data-action="live-twist-grade"][data-crit="c1"][data-value="1"]');
  click(w, '[data-action="live-twist-grade"][data-crit="c2"][data-value="1"]');
  click(w, '[data-action="live-twist-grade"][data-crit="c3"][data-value="0"]');
  click(w, '[data-action="live-twist-continue"]');
}
/* Fase 5 (rúbrica) — deja el live listo para el live-next de salida. */
function doPhase5Rubric(w, T) {
  click(w, '[data-action="live-push-reveal"]');
  click(w, '[data-action="live-push-rubric"][data-value="3"]');
}
/* Bypass del recorder (patrón harness J: simula el callback de live-synth-launch). */
function bypassSynthToScorecard(T) {
  const s = T.liveState();
  s.phaseScores.synth = 10; s.synthScore = 10; s.synthDone = true;
  s.phase = 7;
  s.totalSec = Math.max(1, Math.floor((Date.now() - s.startTs) / 1000));
  T.renderLiveCase();
}
function doTLOverlayAndClose(w, T) {
  click(w, '[data-action="tl-confound-live"][data-index="0"]');
  click(w, '[data-action="tl-reveal-live"]');
  click(w, '[data-action="tl-selfgrade-live"][data-value="yes"]');
  click(w, '[data-action="tl-close-live"]');
}
function patTot(st) {
  const out = {};
  for (const k of Object.keys(st.mathPats || {})) out[k] = { ok: st.mathPats[k].ok, tot: st.mathPats[k].tot };
  return out;
}

(async () => {
  // ───────── M5-0 · Registro LIVE_MATH_EXTRA ─────────
  console.log('\n── M5-0: registro LIVE_MATH_EXTRA ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    t('hook vivo + LIVE_MATH_EXTRA presente', !!T && !!T.LIVE_MATH_EXTRA);
    t('exactamente los 4 casos K', Object.keys(T.LIVE_MATH_EXTRA).sort().join(',') === K_IDS.slice().sort().join(','));
    t('2 generadores (funciones) por caso', K_IDS.every(id => Array.isArray(T.LIVE_MATH_EXTRA[id]) && T.LIVE_MATH_EXTRA[id].length === 2 && T.LIVE_MATH_EXTRA[id].every(g => typeof g === 'function')));
    t('contrato estándar {q,unit,answer,kind,pat,hint} en las 8 instancias', K_IDS.every(id => T.LIVE_MATH_EXTRA[id].every(g => {
      const e = g();
      return typeof e.q === 'string' && e.q.length > 60 && typeof e.unit === 'string' &&
             isFinite(e.answer) && e.answer > 0 && typeof e.kind === 'string' &&
             ['P1', 'P2D', 'P2R', 'P3', 'P4'].includes(e.pat) && typeof e.hint === 'string' && e.hint.length > 40;
    })));
    t('los 4 ids existen en CASES + LIVE_MATH + LIVE_TWIST', K_IDS.every(id => T.CASES.some(c => c.id === id) && typeof T.LIVE_MATH[id] === 'function' && !!T.LIVE_TWIST[id]));
    t('acquirer-mdr trae Rate Rule (extra A) con pat P2R', T.LIVE_MATH_EXTRA['acquirer-mdr'][0]().hint.includes('Rate Rule') && T.LIVE_MATH_EXTRA['acquirer-mdr'][0]().pat === 'P2R');
    t('smart-branch etiqueta P3 (VAN) y P4 (payback tercil) — no P2R de relleno', T.LIVE_MATH_EXTRA['smart-branch'][0]().pat === 'P3' && T.LIVE_MATH_EXTRA['smart-branch'][1]().pat === 'P4');
    t('defaultLiveState: caso K → 2 instancias congeladas; caso viejo → []', T.defaultLiveState('smart-branch').mathExtras.length === 2 && T.defaultLiveState('streaming').mathExtras.length === 0);
    t('defaultLiveState: extraResults [] + extraSub null', (function () { const d = T.defaultLiveState('smart-branch'); return Array.isArray(d.extraResults) && d.extraResults.length === 0 && d.extraSub === null; })());
  }

  // ───────── M5-1 · Recomputación ×100 por generador ─────────
  console.log('\n── M5-1: recomputación ×100 vs tolOK ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    for (const id of K_IDS) {
      for (let slot = 0; slot < 2; slot++) {
        let ok = 0, distinct = new Set();
        for (let i = 0; i < 100; i++) {
          const e = T.LIVE_MATH_EXTRA[id][slot]();
          const rec = RECOMPUTE[id][slot](e.vals);
          if (T.MCMATH.tolOK(rec, e.answer, e.kind)) ok++;
          distinct.add(e.q);
        }
        t(`${id}[${slot}]: 100/100 recomputaciones pasan tolOK`, ok === 100);
        t(`${id}[${slot}]: el pool sortea de verdad (≥2 enunciados distintos en 100)`, distinct.size >= 2);
      }
    }
  }

  // ───────── M5-2 · Secuencia completa: extra A → principal → giro → extra B ─────────
  console.log('\n── M5-2: smart-branch con extras + giro ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('smart-branch');
    const s = T.liveState();
    driveToPhase3Done(w, T);
    t('parado en fase 3, extraSub aún null', s.phase === 3 && s.extraSub === null);

    // salida de fase 3 → extra A intercepta
    click(w, '[data-action="live-next"]');
    t('extra A intercepta: fase SIGUE en 3, extraSub slot 0', s.phase === 3 && !!s.extraSub && s.extraSub.slot === 0);
    t('pantalla del extra: input + Comprobar, sin continue', !!w.document.querySelector('[data-field="extramath"]') && !!w.document.querySelector('[data-action="live-extra-check"]') && !w.document.querySelector('[data-action="live-extra-continue"]'));
    const exA = s.mathExtras[0];
    const ansPre = exA.answer;
    T.renderLiveCase(); T.renderLiveCase();
    t('instancia congelada: re-render no re-sortea', s.mathExtras[0].answer === ansPre && s.mathExtras[0] === exA);
    t('otro live-next durante el check no avanza ni re-intercepta', (function () { click(w, '[data-action="live-next"]'); return s.phase === 3 && s.extraSub.slot === 0; })());

    // resolver correcto (toFixed como usuario real)
    const inpA = w.document.querySelector('[data-field="extramath"]');
    inpA.value = exA.answer.toFixed(2);
    click(w, '[data-action="live-extra-check"]');
    t('check: ok=true, un intento (input disabled, botón Comprobar fuera)', s.extraSub.checked && s.extraSub.ok === true && w.document.querySelector('[data-field="extramath"]').disabled && !w.document.querySelector('[data-action="live-extra-check"]'));
    click(w, '[data-action="live-extra-check"]');   // segundo disparo: no existe botón y el handler guarda
    t('segundo check imposible: sigue checked una vez, ok intacto', s.extraSub.checked && s.extraSub.ok === true);
    click(w, '[data-action="live-extra-continue"]');
    t('continue → fase 4, extraResults[0]={slot:0,ok:true,pat}, extraA=1', s.phase === 4 && s.extraSub === null && s.extraResults.length === 1 && s.extraResults[0].slot === 0 && s.extraResults[0].ok === true && s.extraResults[0].pat === exA.pat && s.phaseScores.extraA === 1);

    // principal (fase 4) y giro (salida de 4)
    doPhase4Math(w, T);
    t('principal correcto (mathOK)', s.mathOK === true);
    click(w, '[data-action="live-next"]');
    t('salida de 4 pertenece al GIRO: twist nace, fase sigue en 4, sin extraSub', !!s.twist && s.twist.shown && s.phase === 4 && s.extraSub === null);
    doTwist(w, T);
    t('giro gradeado → fase 5', !!s.twist.graded && s.phase === 5);

    // salida de fase 5 → extra B intercepta; responder MAL
    doPhase5Rubric(w, T);
    click(w, '[data-action="live-next"]');
    t('extra B intercepta: fase SIGUE en 5, extraSub slot 1', s.phase === 5 && !!s.extraSub && s.extraSub.slot === 1);
    const exB = s.mathExtras[1];
    const inpB = w.document.querySelector('[data-field="extramath"]');
    inpB.value = (exB.answer * 3 + 100).toFixed(2);   // fuera de tolerancia con margen
    click(w, '[data-action="live-extra-check"]');
    t('check incorrecto: ok=false con reveal (hint visible)', s.extraSub.checked && s.extraSub.ok === false && w.document.querySelector('.live-math-result.off') !== null);
    click(w, '[data-action="live-extra-continue"]');
    t('continue → fase 6, extraResults=2, extraB=0', s.phase === 6 && s.extraResults.length === 2 && s.extraResults[1].slot === 1 && s.extraResults[1].ok === false && s.phaseScores.extraB === 0);

    // scorecard + commit
    bypassSynthToScorecard(T);
    const scT = w.document.querySelector('.live-sc-table') || w.document.querySelector('#live-overlay .live-panel');
    t('scorecard: filas Quant extra A (✓) y B (✗)', !!scT && scT.textContent.includes('Quant extra A') && scT.textContent.includes('Quant extra B'));
    const st = T.state();
    const pre = patTot(st);
    doTLOverlayAndClose(w, T);
    const post = patTot(st);
    const patP = s.mathQ.pat;   // principal (P4 en smart-branch)
    const expTot = {};
    for (const p of [patP, exA.pat, exB.pat]) { expTot[p] = (expTot[p] || 0) + 1; }
    const totOK = Object.keys(expTot).every(p => (post[p] ? post[p].tot : 0) - (pre[p] ? pre[p].tot : 0) === expTot[p]);
    t('commit: bumpMathPat del principal + UN bump por extra (tot por pat exacto)', totOK);
    const okDeltaA = (post[exA.pat] ? post[exA.pat].ok : 0) - (pre[exA.pat] ? pre[exA.pat].ok : 0);
    const expOkA = (exA.pat === patP ? 1 : 0) + (exB.pat === exA.pat ? 0 : 0) + 1;   // principal ok + extra A ok comparten pat si coincide
    t('commit: ok del pat de extra A refleja aciertos (A✓, B✗, principal✓)', okDeltaA === expOkA);
    const log = st.liveCaseLog[st.liveCaseLog.length - 1];
    t('liveCaseLog.extras = [{ok:true,pat},{ok:false,pat}]', Array.isArray(log.extras) && log.extras.length === 2 && log.extras[0].ok === true && log.extras[1].ok === false && log.extras[0].pat === exA.pat && log.extras[1].pat === exB.pat);
    t('liveCaseLog.twist intacto junto a extras', !!log.twist && log.twist.pass === true);
  }

  // ───────── M5-3 · Caso SIN entrada = flujo byte-idéntico ─────────
  console.log('\n── M5-3: casos sin extras ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    // streaming: giro sí, extras no
    T.openLiveCase('streaming');
    const s = T.liveState();
    driveToPhase3Done(w, T);
    click(w, '[data-action="live-next"]');
    t('streaming: salida de 3 va DIRECTO a fase 4 (sin extraSub)', s.phase === 4 && s.extraSub === null && s.extraResults.length === 0);
    doPhase4Math(w, T);
    click(w, '[data-action="live-next"]');
    t('streaming: el giro sigue interceptando la salida de 4', !!s.twist && s.phase === 4);
    doTwist(w, T);
    doPhase5Rubric(w, T);
    click(w, '[data-action="live-next"]');
    t('streaming: salida de 5 va DIRECTO a fase 6', s.phase === 6 && s.extraSub === null);
    bypassSynthToScorecard(T);
    const scEl = w.document.querySelector('.live-sc-table') || w.document.querySelector('#live-overlay .live-panel');
    t('streaming: scorecard SIN filas Quant extra', !!scEl && !scEl.textContent.includes('Quant extra'));
    doTLOverlayAndClose(w, T);
    const log = T.state().liveCaseLog[T.state().liveCaseLog.length - 1];
    t('streaming: liveCaseLog sin campo extras', !('extras' in log));
    // hotel: ni giro ni extras
    T.openLiveCase('hotel');
    const s2 = T.liveState();
    driveToPhase3Done(w, T);
    click(w, '[data-action="live-next"]');
    doPhase4Math(w, T);
    click(w, '[data-action="live-next"]');
    t('hotel: 3→4→5 limpio, sin twist ni extraSub', s2.phase === 5 && s2.twist === null && s2.extraSub === null);
  }

  // ───────── M5-4 · Restart re-sortea + dos corridas distintas + commit único ─────────
  console.log('\n── M5-4: restart y frescura ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    // dos corridas → números distintos (defaultLiveState directo; retry por pools chicos)
    let differ = false;
    const base = T.defaultLiveState('smart-branch').mathExtras.map(e => e.q).join('|');
    for (let i = 0; i < 15 && !differ; i++) {
      if (T.defaultLiveState('smart-branch').mathExtras.map(e => e.q).join('|') !== base) differ = true;
    }
    t('dos corridas sortean extras distintos (≤15 intentos)', differ);
    // corrida completa + commit, luego restart limpio
    T.openLiveCase('acquirer-mdr');
    let s = T.liveState();
    driveToPhase3Done(w, T);
    click(w, '[data-action="live-next"]');
    resolveExtra(w, T, s.mathExtras[0].answer.toFixed(2));
    doPhase4Math(w, T);
    click(w, '[data-action="live-next"]');
    doTwist(w, T);
    doPhase5Rubric(w, T);
    click(w, '[data-action="live-next"]');
    resolveExtra(w, T, s.mathExtras[1].answer.toFixed(2));
    bypassSynthToScorecard(T);
    const st = T.state();
    const logLenPre = st.liveCaseLog.length;
    doTLOverlayAndClose(w, T);
    t('commit de la corrida: liveCaseLog +1', st.liveCaseLog.length === logLenPre + 1);
    T.openLiveCase('acquirer-mdr');
    s = T.liveState();
    t('restart: extraResults [], extraSub null, 2 instancias frescas', s.extraResults.length === 0 && s.extraSub === null && s.mathExtras.length === 2 && !s.scored);
    t('commit viejo quedó UNA sola vez (log no volvió a crecer)', st.liveCaseLog.length === logLenPre + 1);
  }

  // ───────── M5-5 · Descarte con extras a medias = cero señal ─────────
  console.log('\n── M5-5: descarte a medias ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('card-activation');
    const s = T.liveState();
    driveToPhase3Done(w, T);
    click(w, '[data-action="live-next"]');
    resolveExtra(w, T, s.mathExtras[0].answer.toFixed(2));   // extra A resuelto OK
    t('extra A resuelto, parado en fase 4', s.phase === 4 && s.extraResults.length === 1);
    const st = T.state();
    const pre = JSON.stringify([patTot(st), st.liveCaseLog.length]);
    esc(w);                                                   // ESC pre-fase-7 = cierre directo
    t('ESC en fase 4 cierra directo', !T.liveState().active);
    t('cero señal: mathPats y liveCaseLog intactos', JSON.stringify([patTot(st), st.liveCaseLog.length]) === pre);
  }

  // ───────── M5-6 · ESC durante un check extra ─────────
  console.log('\n── M5-6: ESC en pantalla de extra ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    T.openLiveCase('credit-launch');
    const s = T.liveState();
    driveToPhase3Done(w, T);
    click(w, '[data-action="live-next"]');
    t('extra A en pantalla (fase 3 congelada)', s.phase === 3 && !!s.extraSub);
    const st = T.state();
    const pre = JSON.stringify([patTot(st), st.liveCaseLog.length]);
    esc(w);
    t('ESC = comportamiento actual de la fase: cierre directo, overlay muerto', !T.liveState().active && w.document.getElementById('live-overlay').innerHTML === '');
    t('cero señal tras ESC en el check', JSON.stringify([patTot(st), st.liveCaseLog.length]) === pre);
  }

  console.log(`\n══ RESULTADO: ${pass} PASS · ${fail} FAIL ══`);
  process.exit(fail ? 1 : 0);
})();
