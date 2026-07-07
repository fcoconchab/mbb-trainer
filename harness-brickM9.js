/* Harness Brick M9 — Gimnasio FIT + banco Mastercard. Auto-contenido: lee
   ./index.html, inyecta el hook __TEST__ antes del cierre del IIFE y escribe
   /tmp/test-index-m9.html. Cobertura: M9-0 registro FIT_MC (8 preguntas, ids
   únicos, shape completo id/q/cat/angleMatias/angleRebeca/trap/key[], las 6
   obligatorias presentes) · M9-1 FIT_QUESTIONS byte-idéntico (sha256 capturado
   pre-edit) y biblioteca/navegación fit-* intactas (open/next/prev/back) ·
   M9-2 flujo del gym prompt→rep→reveal→grade escribe stepStats.fit una sola
   vez (commit único: doble grade = no-op; pass ≥4/5; fail con 3/5) · M9-3
   abandono pre-grade = cero señal (fitgym-back en rep; fitgym-exit en reveal
   sin grade) · M9-4 timer cleanup en 3 salidas (switchTab fuera de fit;
   fitgym-back; tick con nodo ausente) + reloj monotónico (re-entrar no
   reinicia startMs) · M9-5 recorder degrada a 'nomic' en jsdom (sin
   MediaRecorder) sin lanzar · M9-6 skill graph: computeSkills incluye 'fit'
   (3 anclas, hallazgo J) y SDH_SKILL_DRILL NO lo mapea (SdH jamás propone el
   gym); composeSdhPlan corre sin lanzar con señal fit presente · M9-7 señal
   correcta en state: shape [{correct,ts}], persiste en localStorage.
   Congelados (grep-counts syn-struct-, drill D, fit-* legacy) van en bash. */
const fs = require('fs');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');

// ── build de la copia con hook ──
const raw = fs.readFileSync('./index.html', 'utf8');
const ANCHOR = 'renderDashboard();\n\n})();';
if (raw.split(ANCHOR).length !== 2) { console.error('ANCLA DEL HOOK NO ÚNICA'); process.exit(1); }
const HOOK = `renderDashboard();

  window.__TEST__ = {
    FIT_MC: FIT_MC,
    FIT_QUESTIONS: FIT_QUESTIONS,
    computeSkills: computeSkills,
    SDH_SKILL_DRILL: SDH_SKILL_DRILL,
    composeSdhPlan: composeSdhPlan, sdhDateSeed: sdhDateSeed,
    DEFAULT_STATE: DEFAULT_STATE,
    state: function () { return state; },
    fitState: function () { return fitState; },
    fitgymState: function () { return fitgymState; },
    fitgymTimerAlive: function () { return !!fitgymTimerInterval; },
    tickFitgymTimer: tickFitgymTimer,
    switchTab: switchTab
  };

})();`;
fs.writeFileSync('/tmp/test-index-m9.html', raw.replace(ANCHOR, HOOK));
const html = fs.readFileSync('/tmp/test-index-m9.html', 'utf8');

// sha256 de FIT_QUESTIONS en el checkpoint PRE-M9 (capturado antes de editar)
const FQ_BASELINE = 'f62ec3d069a02b541f26ca1357931252ad797f018bf93d92a4b9703b1a36a091';

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
// Flujo estándar: entrar al gym y correr una rep del banco mc hasta el reveal.
function driveToReveal(w, bank, idx) {
  w.__TEST__.switchTab('fit');
  // fitgym-open solo existe en la biblioteca y en el reveal; si ya estamos en
  // el picker (p. ej. tras fitgym-back) se va directo al start.
  const inPick = w.__TEST__.fitState().view === 'gym' && w.__TEST__.fitgymState().view === 'pick';
  if (!inPick && !click(w, '[data-action="fitgym-open"]')) return false;
  if (!click(w, `[data-action="fitgym-start"][data-bank="${bank}"][data-index="${idx}"]`)) return false;
  if (!click(w, '[data-action="fitgym-stop"]')) return false;
  return w.__TEST__.fitgymState().view === 'reveal';
}
function checkN(w, keys) {
  for (const k of keys) click(w, `[data-action="fitgym-check"][data-k="${k}"]`);
}

console.log('M9-0 · registro FIT_MC');
{
  const { w } = boot(null);
  const mc = w.__TEST__.FIT_MC;
  t('FIT_MC tiene 8 preguntas', Array.isArray(mc) && mc.length === 8);
  const ids = mc.map(q => q.id);
  t('ids únicos', new Set(ids).size === mc.length);
  const OBLIG = ['why-mc-advisors', 'why-tl', 'sell-tl-cmo', 'series-b-experimento', 'inclusion-financiera', 'analisis-equivocado'];
  t('las 6 obligatorias presentes', OBLIG.every(id => ids.includes(id)));
  t('shape completo en las 8', mc.every(q =>
    typeof q.id === 'string' && q.id &&
    typeof q.q === 'string' && q.q &&
    typeof q.cat === 'string' && q.cat &&
    typeof q.angleMatias === 'string' && q.angleMatias.length > 40 &&
    typeof q.angleRebeca === 'string' && q.angleRebeca.length > 40 &&
    typeof q.trap === 'string' && q.trap.length > 40 &&
    Array.isArray(q.key) && q.key.length >= 4 && q.key.every(k => typeof k === 'string' && k)
  ));
  t('cats reusan las categorías existentes de la biblioteca', mc.every(q => ['leadership','teamwork','conflict','achievement','why'].includes(q.cat)));
  t('los dos puentes personales presentes (Series B → Matias, inclusión → Rebeca)',
    mc.some(q => q.id === 'series-b-experimento' && /Rate Rule|LTV\/CAC/.test(q.angleMatias)) &&
    mc.some(q => q.id === 'inclusion-financiera' && /Georgetown|Rwanda|IDB/.test(q.angleRebeca)));
}

console.log('M9-1 · biblioteca base intacta');
{
  const { w } = boot(null);
  const fq = w.__TEST__.FIT_QUESTIONS;
  const hash = crypto.createHash('sha256').update(JSON.stringify(fq)).digest('hex');
  t('FIT_QUESTIONS byte-idéntico al checkpoint (sha256)', hash === FQ_BASELINE);
  t('FIT_QUESTIONS sigue con 15 preguntas', fq.length === 15);
  // navegación de biblioteca intacta
  w.__TEST__.switchTab('fit');
  t('lista pinta el launcher del gym + las 15 cards', !!w.document.querySelector('.fitgym-launcher') && w.document.querySelectorAll('[data-action="fit-open"]').length === 15);
  t('fit-open abre el detalle', click(w, '[data-action="fit-open"][data-index="0"]') && w.__TEST__.fitState().view === 'detail');
  t('fit-next avanza', click(w, '[data-action="fit-next"]') && w.__TEST__.fitState().questionIdx === 1);
  t('fit-prev retrocede', click(w, '[data-action="fit-prev"]') && w.__TEST__.fitState().questionIdx === 0);
  t('fit-back vuelve a la lista', click(w, '[data-action="fit-back"]') && w.__TEST__.fitState().view === 'list');
}

console.log('M9-2 · flujo del gym → señal (commit único)');
{
  const { w } = boot(null);
  t('rep alcanza el reveal (mc idx 0)', driveToReveal(w, 'mc', 0));
  t('angles por entrevistador pintados', /Qué busca Matias/.test(w.document.body.innerHTML) && /Qué busca Rebeca/.test(w.document.body.innerHTML));
  t('sin señal antes del grade', w.__TEST__.state().stepStats.fit.length === 0);
  checkN(w, ['s', 't', 'a', 'r', 'trapOk']);   // 5/5
  t('grade escribe la señal', click(w, '[data-action="fitgym-grade"]') && w.__TEST__.state().stepStats.fit.length === 1);
  t('pass con 5/5 y shape {correct,ts}', w.__TEST__.state().stepStats.fit[0].correct === true && typeof w.__TEST__.state().stepStats.fit[0].ts === 'number');
  t('verdict PASS pintado', /PASS — 5\/5/.test(w.document.body.innerHTML));
  // commit único: no queda botón de grade y el estado guarda
  t('doble grade = no-op (commit único)', !w.document.querySelector('[data-action="fitgym-grade"]') && w.__TEST__.state().stepStats.fit.length === 1);
  t('señal persistida en localStorage', JSON.parse(w.localStorage.getItem('mbb_trainer_state_v1')).stepStats.fit.length === 1);
  // segunda rep: pass = ≥4/5 → 3/5 debe fallar
  t('segunda rep alcanza reveal (base idx 2)', driveToReveal(w, 'base', 2));
  t('reveal del banco base muestra el contenido de biblioteca read-only', /Ángulo del entrevistador/.test(w.document.body.innerHTML));
  checkN(w, ['s', 'a', 'r']);   // 3/5
  click(w, '[data-action="fitgym-grade"]');
  const st = w.__TEST__.state().stepStats.fit;
  t('fail con 3/5 registrado', st.length === 2 && st[1].correct === false);
  // borde: 4/5 = pass
  t('tercera rep alcanza reveal (mc idx 3)', driveToReveal(w, 'mc', 3));
  checkN(w, ['s', 't', 'a', 'trapOk']);   // 4/5
  click(w, '[data-action="fitgym-grade"]');
  t('pass con 4/5 (borde)', w.__TEST__.state().stepStats.fit[2].correct === true);
}

console.log('M9-3 · abandono = cero señal');
{
  const { w } = boot(null);
  w.__TEST__.switchTab('fit');
  click(w, '[data-action="fitgym-open"]');
  click(w, '[data-action="fitgym-start"][data-bank="mc"][data-index="1"]');
  t('rep corriendo', w.__TEST__.fitgymState().view === 'rep');
  click(w, '[data-action="fitgym-back"]');   // cancelar en plena rep
  t('cancelar la rep = cero señal + vuelve al picker', w.__TEST__.state().stepStats.fit.length === 0 && w.__TEST__.fitgymState().view === 'pick');
  // abandonar el reveal SIN gradear (la salida del reveal pre-grade es "← Otra pregunta" = fitgym-open)
  t('rep 2 alcanza reveal', driveToReveal(w, 'mc', 2));
  checkN(w, ['s', 't', 'a', 'r', 'trapOk']);   // marcar todo y aun así NO gradear
  click(w, '[data-action="fitgym-open"]');
  t('abandonar el reveal sin gradear = cero señal + picker fresco', w.__TEST__.state().stepStats.fit.length === 0 && w.__TEST__.fitgymState().view === 'pick' && w.__TEST__.fitgymState().graded === false);
  click(w, '[data-action="fitgym-exit"]');
  t('exit del picker vuelve a la biblioteca, aún cero señal', w.__TEST__.state().stepStats.fit.length === 0 && w.__TEST__.fitState().view === 'list');
}

console.log('M9-4 · timer: cleanup en 3 salidas + reloj monotónico');
{
  // salida 1: switchTab fuera de fit
  const a = boot(null);
  a.w.__TEST__.switchTab('fit');
  click(a.w, '[data-action="fitgym-open"]');
  click(a.w, '[data-action="fitgym-start"][data-bank="mc"][data-index="0"]');
  t('timer vivo en la rep', a.w.__TEST__.fitgymTimerAlive());
  const ms0 = a.w.__TEST__.fitgymState().startMs;
  a.w.__TEST__.switchTab('home');
  t('salida 1 (switchTab) mata el interval', !a.w.__TEST__.fitgymTimerAlive());
  a.w.__TEST__.switchTab('fit');
  t('re-entrar re-arma el tick SIN reiniciar el reloj (monotónico)', a.w.__TEST__.fitgymTimerAlive() && a.w.__TEST__.fitgymState().startMs === ms0);
  // salida 2: fitgym-back
  click(a.w, '[data-action="fitgym-back"]');
  t('salida 2 (cancelar rep) mata el interval', !a.w.__TEST__.fitgymTimerAlive());
  // salida 3: tick con nodo ausente (higiene)
  click(a.w, '[data-action="fitgym-start"][data-bank="mc"][data-index="0"]');
  t('timer vivo de nuevo', a.w.__TEST__.fitgymTimerAlive());
  const timerEl = a.w.document.getElementById('fitgym-timer');
  timerEl.parentNode.removeChild(timerEl);
  a.w.__TEST__.tickFitgymTimer();
  t('salida 3 (nodo ausente) mata el interval', !a.w.__TEST__.fitgymTimerAlive());
  // el stop también lo mata (camino feliz)
  const b = boot(null);
  t('rep hasta reveal', driveToReveal(b.w, 'mc', 0));
  t('reveal deja el timer muerto', !b.w.__TEST__.fitgymTimerAlive());
}

console.log('M9-5 · recorder degrada limpio en jsdom');
{
  const { w } = boot(null);
  t('jsdom no trae MediaRecorder (precondición del degrade)', typeof w.MediaRecorder !== 'function');
  w.__TEST__.switchTab('fit');
  click(w, '[data-action="fitgym-open"]');
  click(w, '[data-action="fitgym-start"][data-bank="mc"][data-index="0"]');
  t('sin API → recStatus nomic, la rep sigue', w.__TEST__.fitgymState().recStatus === 'nomic' && w.__TEST__.fitgymState().view === 'rep');
  t('badge informa el degrade', /Sin micrófono/.test(w.document.body.innerHTML));
  click(w, '[data-action="fitgym-stop"]');
  t('reveal sin audio no pinta playback', w.__TEST__.fitgymState().hasAudio === false && !w.document.querySelector('.fitgym-audio'));
}

console.log('M9-6 · skill graph: 3 anclas SIN contaminar SdH');
{
  const preState = { stepStats: { fit: [ { correct: true, ts: 1 }, { correct: false, ts: 2 }, { correct: true, ts: 3 } ] } };
  const { w } = boot(preState);
  const skills = w.__TEST__.computeSkills(w.__TEST__.state());
  t("computeSkills incluye 'fit' (ancla DEFAULT_STATE.stepStats)", 'fit' in skills);
  t('rate correcto con n=3 (2/3)', skills.fit && skills.fit.n === 3 && Math.abs(skills.fit.rate - 2/3) < 1e-9);
  t("DEFAULT_STATE.stepStats trae fit:[]", Array.isArray(w.__TEST__.DEFAULT_STATE.stepStats.fit));
  t("SDH_SKILL_DRILL NO mapea 'fit' (SdH jamás propone el gym)", !('fit' in w.__TEST__.SDH_SKILL_DRILL));
  const plan = w.__TEST__.composeSdhPlan(w.__TEST__.state(), w.__TEST__.sdhDateSeed(new Date(2026, 6, 7)));
  t('composeSdhPlan corre con señal fit presente y nunca propone drillType fit', !!plan && (!plan.skillDrill || plan.skillDrill.drillType !== 'fit'));
}

console.log('M9-7 · merge de state viejo (pre-M9) no rompe');
{
  // state guardado ANTES de M9: sin key fit → el merge debe crearla como []
  const old = { stepStats: { diagnose: [], hypothesis: [], math: [], mece: [], synthesis: [], clarifying: [], ambiguedad: [], giro: [], experimento: [] } };
  const { w } = boot(old);
  t('merge agrega stepStats.fit como []', Array.isArray(w.__TEST__.state().stepStats.fit) && w.__TEST__.state().stepStats.fit.length === 0);
  t('el gym gradea sobre state migrado', driveToReveal(w, 'mc', 0) && (checkN(w, ['s','t','a','r']), click(w, '[data-action="fitgym-grade"]'), w.__TEST__.state().stepStats.fit.length === 1));
}

console.log('');
console.log(`RESULTADO: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
