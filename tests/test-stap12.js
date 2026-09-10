/* Stap 12 — bewijzen dat de taakas en de blinderingsproef doen wat er staat.

   Deze twee dingen dragen vanaf nu de hele onderzoeksvraag, dus ze moeten harder
   vaststaan dan wat dan ook in dit project. Twee fouten uit stap 8 zitten hier als
   controle in verwerkt: een conditie die de code niet bereikt (fout 12) en een maat
   die iets anders meet dan zij belooft (fout 13).

     1  goalHide zet de acht doelkanalen op nul vanaf precies de gevraagde stap, en
        geen stap eerder of later; de acht obstakelkanalen blijven ongemoeid;
     2  goalHide = 0 is bit voor bit taak A — de referentiemeting van stap 4 moet
        exact reproduceren, anders is de hele oude tabel onvergelijkbaar geworden;
     3  goalHide = −1 verbergt vanaf stap nul, want dat is de controle van de proef;
     4  de conditie komt uit cfg en niet uit een globale (de fout van stap 8);
     5  de reactieve ijkagent is op taak B net zo blind als het brein, dus zijn
        score zakt mee — een ijkpunt met een informatievoorsprong is geen ijkpunt;
     6  de blinderingsproef vergelijkt twee runs die alleen in informatie verschillen:
        zelfde werelden, zelfde toevalsreeks, zelfde gewichten na afloop;
     7  en de proef geeft op een agent die niets kan onthouden ongeveer nul horizon,
        gemeten op een vers, ongetraind brein.
*/
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

let ok = 0, fout = 0;
function check(naam, geslaagd, detail) {
  if (geslaagd) { ok++; console.log(`  ok   ${naam}${detail ? '   ' + detail : ''}`); }
  else { fout++; console.log(`  FOUT ${naam}${detail ? '   ' + detail : ''}`); }
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const pagefouten = [];
  p.on('pageerror', e => pagefouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  /* ---------- 1 en 3. wanneer gaan de doelkanalen uit? ---------- */
  console.log('\n1. goalHide zet de doelkanalen op nul vanaf precies de gevraagde stap');
  const kanalen = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    const cfg = W.readCfg();
    S.cfg = cfg; S.B = W.createBrain(cfg, 1000);
    const w = W.makeWorld2(4242, 7);
    S.world = w; S.ag.x = w.start.x; S.ag.y = w.start.y;
    const uit = new Float32Array(W.K.N_IN);
    const meet = (hide, stap, blink) => {
      S.cfg.goalHide = hide; S.cfg.goalBlink = blink || 0;
      W.sense(S.ag, w, uit, stap);
      let doel = 0, obst = 0;
      for (let i = 0; i < 8; i++) { obst += Math.abs(uit[i]); doel += Math.abs(uit[8 + i]); }
      return { doel, obst };
    };
    return {
      a_voor: meet(0, 0), a_laat: meet(0, 99),
      b_voor: meet(20, 19), b_op: meet(20, 20), b_na: meet(20, 21),
      c_start: meet(-1, 0), c_later: meet(-1, 50),
      /* knipperen met 10 aan en 20 uit: cyclus van 30 */
      k_0: meet(0, 0, 20), k_9: meet(0, 9, 20), k_10: meet(0, 10, 20),
      k_29: meet(0, 29, 20), k_30: meet(0, 30, 20), k_39: meet(0, 39, 20), k_40: meet(0, 40, 20)
    };
  });
  check('taak A (0): doel zichtbaar op stap 0 en op stap 99',
    kanalen.a_voor.doel > 0 && kanalen.a_laat.doel > 0,
    `${kanalen.a_voor.doel.toFixed(3)} / ${kanalen.a_laat.doel.toFixed(3)}`);
  check('goalHide 20: op stap 19 nog zichtbaar', kanalen.b_voor.doel > 0, kanalen.b_voor.doel.toFixed(3));
  check('goalHide 20: op stap 20 exact nul', kanalen.b_op.doel === 0);
  check('goalHide 20: op stap 21 exact nul', kanalen.b_na.doel === 0);
  check('de obstakelkanalen blijven ongemoeid als het doel verdwijnt',
    Math.abs(kanalen.b_op.obst - kanalen.b_voor.obst) < 1e-9,
    `${kanalen.b_voor.obst.toFixed(4)} tegen ${kanalen.b_op.obst.toFixed(4)}`);
  console.log('\n3. goalHide = −1 is "nooit zichtbaar", de controle van de proef');
  check('−1: al op stap 0 nul', kanalen.c_start.doel === 0);
  check('−1: ook later nul', kanalen.c_later.doel === 0);
  check('−1 laat de obstakels staan', kanalen.c_start.obst > 0, kanalen.c_start.obst.toFixed(4));
  console.log('\n1b. knipperen: tien stappen aan, twintig uit, en dan weer aan');
  check('stap 0 t/m 9 zichtbaar', kanalen.k_0.doel > 0 && kanalen.k_9.doel > 0);
  check('stap 10 t/m 29 donker', kanalen.k_10.doel === 0 && kanalen.k_29.doel === 0);
  check('stap 30 t/m 39 weer zichtbaar', kanalen.k_30.doel > 0 && kanalen.k_39.doel > 0);
  check('stap 40 weer donker', kanalen.k_40.doel === 0);
  check('knipperen laat de obstakels staan', kanalen.k_10.obst === kanalen.k_0.obst);

  /* ---------- 4. de conditie komt uit cfg, niet uit een globale ---------- */
  console.log('\n4. de conditie komt uit cfg (de fout van stap 8 mag niet terugkomen)');
  const viaLoper = await p.evaluate(() => {
    const W = window.__brain;
    let cfg = W.readCfg();
    cfg.nEpisodes = 30; cfg.evalOn = false; cfg.benchOn = false;
    cfg = W.cfgOverride(cfg, { goalHide: 25, goalBlink: 15 });
    const r = W.runOne(cfg, 1000, 'test-stap12');
    const rij = W.csvRow(r).split(',');
    return { uitJson: r.config.wereld.doelVerbergenNa, blinkJson: r.config.wereld.doelKnipperUit,
      uitCsv: rij[W.CSV_COLS.indexOf('goalHide')], blinkCsv: rij[W.CSV_COLS.indexOf('goalBlink')] };
  });
  check('een override uit de experimentloper komt in het brein terecht',
    viaLoper.uitJson === 25 && viaLoper.blinkJson === 15,
    `resultaat-JSON zegt verbergen ${viaLoper.uitJson}, knipperen ${viaLoper.blinkJson}`);
  check('en staat ook in runs.csv', viaLoper.uitCsv === '25' && viaLoper.blinkCsv === '15',
    `kolommen "${viaLoper.uitCsv}" en "${viaLoper.blinkCsv}"`);

  /* ---------- 5. de ijkagent is even blind als het brein ---------- */
  console.log('\n5. de reactieve ijkagent verliest het doel net zo goed');
  const ijk = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    const meet = ov => {
      S.cfg = W.cfgOverride(W.readCfg(), ov);
      return W.benchReactief(100, 1).pct;
    };
    return { a: meet({}), b: meet({ goalHide: 20 }), k: meet({ goalBlink: 20 }) };
  });
  check('taak A: de ijkagent haalt zijn bekende niveau', ijk.a > 0.25, `${(100 * ijk.a).toFixed(1)}%`);
  check('permanent verbergen: de ijkagent zakt naar de bodem', ijk.b < ijk.a - 0.05,
    `${(100 * ijk.a).toFixed(1)}% naar ${(100 * ijk.b).toFixed(1)}%`);
  check('knipperen: de ijkagent zakt, maar minder ver dan bij permanent verbergen',
    ijk.k < ijk.a - 0.02 && ijk.k > ijk.b,
    `${(100 * ijk.a).toFixed(1)}% -> knipperen ${(100 * ijk.k).toFixed(1)}% -> verbergen ${(100 * ijk.b).toFixed(1)}%`);

  /* ---------- 6 en 7. de blinderingsproef ---------- */
  console.log('\n6. de proef verschilt van haar controle in niets dan informatie');
  const proef = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    const cfg = W.cfgOverride(W.readCfg(), { goalHide: 0 });
    cfg.nEpisodes = 60; cfg.evalOn = false; cfg.benchOn = false;
    const r = W.runOne(cfg, 1000, 'test-stap12');
    const voor = Float32Array.from(S.B.cW);
    const m = W.geheugenProef(40, 20, 40);
    let gelijk = true;
    for (let i = 0; i < voor.length; i++) if (voor[i] !== S.B.cW[i]) { gelijk = false; break; }
    /* twee keer dezelfde proef moet exact hetzelfde getal geven */
    const m2 = W.geheugenProef(40, 20, 40);
    return { m, gelijk, herhaalbaar: m.cosProef === m2.cosProef && m.horizon === m2.horizon,
      lengteP: m.perStapProef.length, lengteC: m.perStapControle.length,
      hide: S.cfg.goalHide };
  });
  check('de proef laat de gewichten ongemoeid', proef.gelijk);
  check('de proef laat de verbergstand staan zoals hij was', proef.hide === 0, `goalHide = ${proef.hide}`);
  check('twee keer dezelfde proef geeft hetzelfde getal', proef.herhaalbaar,
    `horizon ${proef.m.horizon}, cos ${proef.m.cosProef.toFixed(4)}`);
  check('proef en controle beslaan evenveel stappen', proef.lengteP === proef.lengteC && proef.lengteP === 40);
  check('de controle stuurt niet naar een doel dat zij nooit zag',
    proef.m.cosControle < 0.35, `cos controle ${proef.m.cosControle.toFixed(4)}`);

  console.log('\n7. een ongetraind brein heeft geen geheugen om te meten');
  const vers = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    S.cfg = W.cfgOverride(W.readCfg(), { goalHide: 0 });
    S.B = W.createBrain(S.cfg, 777);
    return W.geheugenProef(40, 20, 40);
  });
  check('horizon van een vers brein is klein', vers.horizon <= 5,
    `horizon ${vers.horizon}, cos proef ${vers.cosProef.toFixed(4)} tegen controle ${vers.cosControle.toFixed(4)}`);

  /* ---------- 2. taak A is bit voor bit de oude taak ---------- */
  /* Dit is de belangrijkste controle van het hele bestand. Als goalHide = 0 ook maar
     iets verandert — één trekking uit de toevalsreeks, één andere sensorwaarde — dan
     is elke meting uit stap 1 t/m 8 onvergelijkbaar geworden zonder dat er iets aan
     te zien is. Zie de ontwerpregel in DOCUMENTATIE.md bij stap 7. */
  console.log('\n2. taak A (goalHide = 0) reproduceert de referentiemeting van stap 4');
  const csv = fs.readFileSync(path.resolve('experimenten/runs.csv'), 'utf8').trim().split(/\r?\n/);
  const H = csv[0].split(',');
  const oud = csv.slice(1).map(l => {
    const c = l.split(','), o = {};
    H.forEach((k, i) => { const v = (c[i] || ''); o[k] = (v !== '' && !isNaN(+v)) ? +v : v; });
    return o;
  }).filter(r => r.conditie === 'benchmark-standaard' && r.lr === 0.008);
  for (const zaad of [1000, 1001]) {
    const o = oud.find(r => r.breinZaad === zaad);
    if (!o) { check(`referentie voor zaad ${zaad}`, false); continue; }
    const nu = await p.evaluate(([zaad]) => {
      const W = window.__brain;
      const cfg = W.readCfg();
      cfg.nEpisodes = 500; cfg.evalOn = true;
      cfg.benchOn = true; cfg.benchN = 500; cfg.benchReps = 3;
      const r = W.runOne(cfg, zaad, 'ijk-stap12');
      return { bench: r.benchmark.beleid.pct, succes20: r.resultaat.succes20, verb: r.structuur.verbindingen };
    }, [zaad]);
    const r6 = x => +Number(x).toFixed(6);
    check(`zaad ${zaad} reproduceert stap 4`,
      r6(nu.bench) === r6(o.benchBeleid) && r6(nu.succes20) === r6(o.succes20) && nu.verb === o.verbindingen,
      `benchmark ${(100 * nu.bench).toFixed(4)}% tegen ${(100 * o.benchBeleid).toFixed(4)}%`);
  }

  if (pagefouten.length) { console.error('\npaginafouten:\n' + pagefouten.join('\n')); fout++; }
  console.log(`\n${ok} controles goed, ${fout} fout`);
  await b.close();
  process.exitCode = fout ? 1 : 0;
})();
