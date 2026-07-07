/* Harness Brick H — corre sobre /tmp/test-index.html (copia con hook __TEST__).
   Cubre: H1 tl- en la rotación de Recall + render de branches
   · H2 gradeBranch crea mastery y SM-2 crea entrada srs con due futuro (flujo end-to-end vía DOM)
   · H3 srsDueCount los cuenta como due sin entrada previa
   · H4 registros: 6 viejas intactas estructuralmente + 4 tl- con shape completo
   · H5 mastery rows del Home incluyen los nuevos
   · H6 state de usuario viejo (sin tl-) carga sin error. */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/tmp/test-index.html', 'utf8');
let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL: ' + name); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boot(preState) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/',
    beforeParse(w) {
      // Los scripts inline corren DURANTE el parse: el state viejo debe estar en
      // localStorage ANTES, o loadState arranca con DEFAULT_STATE.
      if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      if (preState) w.localStorage.setItem('mbb_trainer_state_v1', JSON.stringify(preState));
    }
  });
  return { dom, w: dom.window };
}

const TL_IDS = ['tl-ecosistema', 'tl-metodologia', 'tl-arboles', 'tl-formulas'];
const OLD_IDS = ['profitability', 'business', 'entry', 'ma', 'pricing', 'sizing'];
const TL_BRANCHES = {
  'tl-ecosistema':  ['flujo', 'tarifas', 'actores', 'glosario'],
  'tl-metodologia': ['metodologias', 'pasos', 'sintetico', 'spendingpulse', 'focalizacion'],
  'tl-arboles':     ['incrementalidad', 'percliente', 'rollout', 'diseno', 'freerider'],
  'tl-formulas':    ['medicion', 'rentabilidad', 'kpis', 'guardrails']
};

(async () => {
  // ───────── H4 · registros: shape y las 6 viejas intactas ─────────
  console.log('\n── H4: registros FRAMEWORKS / FRAMEWORK_DATA ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    t('hook __TEST__ vivo', !!T && Array.isArray(T.FRAMEWORKS));
    t('FRAMEWORKS tiene 10 entradas', T.FRAMEWORKS.length === 10);
    t('las 6 viejas primero, en orden', OLD_IDS.every((id, i) => T.FRAMEWORKS[i].id === id));
    t('las 4 tl- al final, en orden', TL_IDS.every((id, i) => T.FRAMEWORKS[6 + i].id === id));
    t('FRAMEWORK_DATA tiene 10 llaves', Object.keys(T.FRAMEWORK_DATA).length === 10);
    t('FRAMEWORK_DATA cubre las 4 tl-', TL_IDS.every(id => !!T.FRAMEWORK_DATA[id]));
    // Coherencia FRAMEWORKS.branches ↔ FRAMEWORK_DATA.branches[].id
    const coherent = TL_IDS.every(id => {
      const lite = T.FRAMEWORKS.find(f => f.id === id).branches;
      const rich = T.FRAMEWORK_DATA[id].branches.map(b => b.id);
      return JSON.stringify(lite) === JSON.stringify(rich) && JSON.stringify(lite) === JSON.stringify(TL_BRANCHES[id]);
    });
    t('branches coherentes lite↔rich↔spec en las 4 tl-', coherent);
    // Shape completo requerido por Recall timer + deep-link Home→Learn
    const fullShape = TL_IDS.every(id => {
      const d = T.FRAMEWORK_DATA[id];
      return ['name', 'type', 'color', 'badgeClass', 'abbr', 'useWhen', 'firstQ'].every(k => typeof d[k] === 'string' && d[k].length > 0)
        && d.branches.every(b => typeof b.name === 'string' && typeof b.dot === 'string' && typeof b.coach === 'string'
          && Array.isArray(b.items) && b.items.length > 0
          && b.items.every(it => typeof it.lead === 'string' && Array.isArray(it.subs) && it.subs.length > 0));
    });
    t('shape completo (name/type/badgeClass/abbr/useWhen/firstQ + branches ricos)', fullShape);
    // Cartas de producción: cada coach es una tarea en voz alta
    t('las 18 branches son cartas de PRODUCCIÓN', TL_IDS.every(id => T.FRAMEWORK_DATA[id].branches.every(b => b.coach.startsWith('PRODUCCIÓN'))));
    // Las 6 viejas: shape intacto (spot-check estructural; byte-diff se hizo fuera del harness)
    t('profitability intacto (4 branches, primera external)', T.FRAMEWORK_DATA.profitability.branches.length === 4 && T.FRAMEWORK_DATA.profitability.branches[0].id === 'external');
    t('sizing intacto (4 branches, última price)', T.FRAMEWORK_DATA.sizing.branches.length === 4 && T.FRAMEWORK_DATA.sizing.branches[3].id === 'price');
  }

  // ───────── H3 · srsDueCount: tl- due sin entrada previa ─────────
  console.log('\n── H3: SRS due desde el día 1 ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    t('srsDueCount = 10 con state fresco', T.srsDueCount() === 10);
    t('srsIsDue(tl-*) = true sin entrada', TL_IDS.every(id => T.srsIsDue(id)));
    t('state.srs sin llaves tl- (no hay contrato nuevo)', TL_IDS.every(id => !(id in T.state.srs)));
  }

  // ───────── H1 · rotación de Recall + render de branches ─────────
  console.log('\n── H1: Recall pick + grade renderizan los tl- ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    const pick = T.renderRecallPick();
    t('pick lista los 4 tl- (data-fw)', TL_IDS.every(id => pick.includes(`data-fw="${id}"`)));
    t('pick muestra los nombres nuevos', pick.includes('Ecosistema de Pagos') && pick.includes('Metodología Test &amp; Learn'));
    // Render de la fase grade de una branch tl- (sin flujo, render puro)
    T.recallState.frameworkId = 'tl-arboles';
    T.recallState.phase = 'grade';
    T.recallState.currentBranchIdx = 0;
    T.recallState.branchGrades = {};
    const g = T.renderRecallGrade();
    t('grade renderiza la branch incrementalidad', g.includes('Incrementalidad (Caja A/B)'));
    t('grade muestra la respuesta canónica de la fuente', g.includes('(A + B) × periodos − fijo'));
    t('grade muestra la tarea de producción (coach)', g.includes('PRODUCCIÓN'));
  }

  // ───────── H2 · flujo end-to-end: grade → mastery + SM-2 ─────────
  console.log('\n── H2: sesión completa de Recall sobre tl-metodologia (vía DOM) ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    const doc = w.document;
    const dueBefore = T.srsDueCount();
    T.switchTab('recall');
    const startBtn = doc.querySelector('button.recall-fw-btn[data-fw="tl-metodologia"]');
    t('botón de start para tl-metodologia existe', !!startBtn);
    startBtn.click();
    t('fase timer con firstQ del mazo', doc.getElementById('recall-root').innerHTML.includes('¿La unidad es un local o un cliente?'));
    doc.querySelector('[data-action="end-timer"]').click();
    // 5 branches → 5 grades 'got' (transición 360ms entre cada una)
    for (let i = 0; i < 5; i++) {
      const btn = doc.querySelector('[data-action="grade-branch"][data-grade="got"]');
      if (!btn) { t('botón got visible en branch ' + (i + 1), false); break; }
      btn.click();
      await sleep(420);
    }
    t('llegó a summary', T.recallState.phase === 'summary');
    const m = T.state.mastery['tl-metodologia'];
    t('mastery creado para las 5 branches', !!m && TL_BRANCHES['tl-metodologia'].every(b => m[b] && m[b].attempts === 1 && m[b].score === 16));
    const e = T.state.srs['tl-metodologia'];
    t('entrada SRS creada con due futuro', !!e && typeof e.due === 'number' && e.due > Date.now());
    t('srsDueCount bajó en 1', T.srsDueCount() === dueBefore - 1);
    t('mastery de frameworks viejos NO tocado', OLD_IDS.every(id => !(id in T.state.mastery)));
  }

  // ───────── H5 · mastery rows del Home ─────────
  console.log('\n── H5: Home incluye los tl- en mastery rows ──');
  {
    const { w } = boot(null);
    const doc = w.document;
    const rows = [...doc.querySelectorAll('#dashboard-root .mastery-row')].map(r => r.dataset.fw);
    t('10 mastery rows', rows.length === 10);
    t('las 4 tl- presentes', TL_IDS.every(id => rows.includes(id)));
    t('las 6 viejas presentes', OLD_IDS.every(id => rows.includes(id)));
  }

  // ───────── H6 · state de usuario viejo carga sin error ─────────
  console.log('\n── H6: usuario viejo (sin tl- en mastery/srs) ──');
  {
    const old = {
      streak: 4, lastSessionDate: '2026-07-01', sessionCount: 9, casesCompleted: 3,
      completedCases: ['hotel'], drillsCompleted: 12, tipIndex: 2,
      mastery: { profitability: { external: { score: 48, attempts: 3 } } },
      srs: { business: { interval: 3, ease: 2.5, due: Date.now() + 86400000 } },
      drillHistory: { hypothesis: 1, math: 5, mece: 0, synthesis: 1, builder: 0, sizing: 0, ambiguedad: 2 },
      stepStats: { diagnose: [], hypothesis: [], math: [], mece: [], synthesis: [], clarifying: [], ambiguedad: [] },
      mathPats: { P1: { ok: 1, tot: 2 }, P2D: { ok: 0, tot: 0 }, P2R: { ok: 1, tot: 4 }, P3: { ok: 0, tot: 0 }, P4: { ok: 0, tot: 0 } },
      synthLog: [], liveCaseLog: []
    };
    let booted = null, err = null;
    try { booted = boot(old); } catch (ex) { err = ex; }
    t('boot sin excepción', !err && !!booted);
    const T = booted.w.__TEST__;
    t('mastery viejo preservado', T.state.mastery.profitability.external.score === 48);
    t('srs viejo preservado (business no due)', !T.srsIsDue('business'));
    t('tl- leen como due (9 de 10: business al día)', T.srsDueCount() === 9);
    t('frameworkMastery(tl-*) = 0 sin error', TL_IDS.every(id => T.frameworkMastery(id) === 0));
    const rows = [...booted.w.document.querySelectorAll('#dashboard-root .mastery-row')].map(r => r.dataset.fw);
    t('dashboard del usuario viejo con 10 rows', rows.length === 10 && TL_IDS.every(id => rows.includes(id)));
  }

  console.log(`\n══ RESULTADO: ${pass} PASS · ${fail} FAIL ══`);
  process.exit(fail ? 1 : 0);
})();
