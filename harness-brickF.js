/* Harness Brick F — corre sobre /tmp/test-index.html (copia con hook __TEST__).
   Cubre: F1 mediana gated n≥3 · F2 trap-retrieval señal-pura · F3 export/import. */
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
  // MediaRecorder / matchMedia shims mínimos
  if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  if (preState) w.localStorage.setItem('mbb_trainer_state_v1', JSON.stringify(preState));
  // disparar los listeners de carga sin SW real
  return { dom, w };
}

(async () => {
  // ───────────────────────── F1 · mathMedian gate n≥3 ─────────────────────────
  console.log('\n── F1: mediana gated ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    t('hook __TEST__ vivo', !!T && typeof T.mathMedian === 'function');
    t('n=0 → null', T.mathMedian([]) === null);
    t('n=1 → null', T.mathMedian([28]) === null);
    t('n=2 → null', T.mathMedian([10, 20]) === null);
    t('n=3 impar → mediana central', T.mathMedian([30, 10, 20]) === 20);
    t('n=4 par → promedio de centrales', T.mathMedian([10, 20, 30, 40]) === 25);
    t('no-array → null', T.mathMedian(null) === null && T.mathMedian(undefined) === null);
  }

  // ───────────────────── F2 · trap-retrieval no muta señal ─────────────────────
  console.log('\n── F2: trap-retrieval señal-pura ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    // sembrar un drill de math generado y simular submit correcto
    T.ensureMathSession(true);
    const drill = T.DRILL_TYPES.math.drills[0];
    t('drill generado con __mc.pats', Array.isArray(drill.__mc.pats) && drill.__mc.pats.length > 0);
    T.drillsState.type = 'math';
    T.drillsState.drillIdx = 0;
    T.drillsState.mathValue = String(drill.answer);

    const snapPats  = JSON.stringify(T.state.mathPats);
    const snapSteps = JSON.stringify(T.state.stepStats);
    const snapHist  = JSON.stringify(T.state.drillHistory);

    // submit via handler real (click sintético con data-action)
    const btn = w.document.createElement('button');
    btn.dataset.action = 'drill-math-submit';
    w.document.body.appendChild(btn);
    T.handleDrills({ target: btn });

    t('submit reveló', T.drillsState.revealed === true);
    t('trapOpts armadas (3 opciones)', Array.isArray(T.drillsState.trapOpts) && T.drillsState.trapOpts.length === 3);
    t('trapReal = pats[0]', T.drillsState.trapReal === drill.__mc.pats[0]);
    t('trapReal está entre las opciones', T.drillsState.trapOpts.indexOf(T.drillsState.trapReal) !== -1);
    t('distractores NO entrenados por el drill', T.drillsState.trapOpts.filter(p => p !== T.drillsState.trapReal).every(p => drill.__mc.pats.indexOf(p) === -1));

    // el submit SÍ escribe señal (comportamiento congelado pre-existente) — snapshot POST-submit
    const postPats  = JSON.stringify(T.state.mathPats);
    const postSteps = JSON.stringify(T.state.stepStats);
    const postHist  = JSON.stringify(T.state.drillHistory);
    t('sanidad: el submit mismo sí bumpeó mathPats (congelado intacto)', postPats !== snapPats);

    // pick correcto → cero mutación adicional
    const pick = w.document.createElement('button');
    pick.dataset.action = 'trap-pick';
    pick.dataset.pat = T.drillsState.trapReal;
    w.document.body.appendChild(pick);
    T.handleDrills({ target: pick });
    t('trapPick registrado', T.drillsState.trapPick === T.drillsState.trapReal);
    t('trap-pick NO muta mathPats',     JSON.stringify(T.state.mathPats)     === postPats);
    t('trap-pick NO muta stepStats',    JSON.stringify(T.state.stepStats)    === postSteps);
    t('trap-pick NO muta drillHistory', JSON.stringify(T.state.drillHistory) === postHist);

    // segundo tap = no-op (bloqueado)
    const pick2 = w.document.createElement('button');
    pick2.dataset.action = 'trap-pick';
    pick2.dataset.pat = T.drillsState.trapOpts.find(p => p !== T.drillsState.trapReal);
    w.document.body.appendChild(pick2);
    T.handleDrills({ target: pick2 });
    t('segundo tap no cambia el pick', T.drillsState.trapPick === T.drillsState.trapReal);

    // localStorage: trap* jamás persiste
    const persisted = JSON.parse(w.localStorage.getItem('mbb_trainer_state_v1') || '{}');
    t('cero trap* en localStorage', !('trapOpts' in persisted) && !('trapPick' in persisted) && !('trapReal' in persisted));

    // reset por drill limpia el trap
    T.resetDrillDetailState();
    t('resetDrillDetailState limpia trap', T.drillsState.trapOpts === null && T.drillsState.trapReal === null && T.drillsState.trapPick === null);
  }

  // ─────────────────────────── F3 · export/import ───────────────────────────
  console.log('\n── F3: export/import ──');
  {
    const { w } = boot(null);
    const T = w.__TEST__;
    // Export: simular el branch (URL.createObjectURL no existe en jsdom → shim que captura el blob)
    let captured = null;
    w.URL.createObjectURL = (b) => { captured = b; return 'blob:fake'; };
    w.URL.revokeObjectURL = () => {};
    w.__TEST__.renderProgress && T.switchTab && T.switchTab('progress');
    const exp = w.document.querySelector('[data-action="export-state"]');
    t('botón Exportar renderizado', !!exp);
    exp.click();
    t('export capturó un Blob', !!captured);
    const text = await captured.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) {}
    t('export es JSON parseable', !!parsed);
    t('export trae _backupV:1', parsed._backupV === 1);
    t('export trae sentinelas', parsed.mathPats && parsed.stepStats && parsed.drillHistory && true);
    t('el state vivo NO quedó con _backupV', !('_backupV' in T.state));

    // Import inválido: JSON roto
    const fi = w.document.querySelector('[data-role="import-file"]');
    t('file input presente', !!fi);
    // simular vía el estado interno: usamos el change handler con un File real de jsdom
    const badFile = new w.File(['{esto no es json'], 'bad.json', { type: 'application/json' });
    Object.defineProperty(fi, 'files', { value: [badFile], configurable: true });
    fi.dispatchEvent(new w.Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    t('JSON roto → error visible, sin confirmación', !!w.document.querySelector('.backup-error') && !w.document.querySelector('[data-action="import-confirm"]'));

    // Import sin sentinelas
    const fi2 = w.document.querySelector('[data-role="import-file"]');
    const noSent = new w.File([JSON.stringify({ hola: 1 })], 'x.json', { type: 'application/json' });
    Object.defineProperty(fi2, 'files', { value: [noSent], configurable: true });
    fi2.dispatchEvent(new w.Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    t('sin sentinelas → error, sin confirmación', !!w.document.querySelector('.backup-error') && !w.document.querySelector('[data-action="import-confirm"]'));

    // Import válido → confirmación → confirm escribe a localStorage
    const good = JSON.parse(JSON.stringify(T.state));
    good.streakDays = 77;                 // marcador para verificar la escritura
    good._backupV = 1;
    const fi3 = w.document.querySelector('[data-role="import-file"]');
    const goodFile = new w.File([JSON.stringify(good)], 'ok.json', { type: 'application/json' });
    Object.defineProperty(fi3, 'files', { value: [goodFile], configurable: true });
    fi3.dispatchEvent(new w.Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    const confirmBtn = w.document.querySelector('[data-action="import-confirm"]');
    t('válido → aparece confirmación', !!confirmBtn);
    t('la confirmación advierte reemplazo total', /reemplaza TODO/i.test(w.document.querySelector('.reset-confirm').textContent));

    // cancelar primero
    w.document.querySelector('[data-action="import-cancel"]').click();
    t('cancelar vuelve a los botones', !!w.document.querySelector('[data-action="export-state"]'));

    // re-importar y confirmar (location.reload de jsdom no navega — atrapamos el error si tira)
    const fi4 = w.document.querySelector('[data-role="import-file"]');
    Object.defineProperty(fi4, 'files', { value: [new w.File([JSON.stringify(good)], 'ok.json')], configurable: true });
    fi4.dispatchEvent(new w.Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    try { w.document.querySelector('[data-action="import-confirm"]').click(); } catch (e) {}
    const stored = JSON.parse(w.localStorage.getItem(T.STORAGE_KEY));
    t('confirm escribió el respaldo (marcador 77)', stored.streakDays === 77);
    t('_backupV NO entró al state escrito', !('_backupV' in stored));
    t('llaves congeladas sobreviven (mathPats/stepStats/drillHistory/completedCases)',
      stored.mathPats && stored.stepStats && stored.drillHistory && Array.isArray(stored.completedCases));
  }

  console.log('\n══ RESULTADO: ' + pass + ' PASS · ' + fail + ' FAIL ══');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS CRASH:', e); process.exit(2); });
