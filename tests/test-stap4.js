/* Stap 4 — bewijst dat de meetopstelling deugt vóórdat er iets mee gemeten wordt.
   Vier controles:
     1. de benchmarkset is deterministisch en overlapt niet met de trainings- of
        toetswerelden;
     2. de reactieve ijkagent haalt de score die we van hem kennen (rond 57 %);
     3. twee keer dezelfde benchmark op hetzelfde brein geeft hetzelfde getal, en
        de benchmark verandert het brein niet;
     4. het 95 %-interval gaat over de werelden en krimpt zoals het hoort.
   Faalt (2), dan is niet de agent stuk maar de meetlat.                        */
const { chromium } = require('playwright');
const path = require('path');

const N = +(process.env.BENCHN || 500);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push('paginafout: ' + e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  if (fouten.length) { console.error(fouten.join('\n')); process.exit(1); }

  const ok = (naam, geslaagd, tekst) => {
    console.log(`${geslaagd ? 'OK  ' : 'FOUT'}  ${naam}${tekst ? ' — ' + tekst : ''}`);
    if (!geslaagd) process.exitCode = 1;
  };

  /* --- 1. de werelden zelf --- */
  const w = await p.evaluate(N => {
    const W = window.__brain;
    const a = W.benchmarkWorlds(N).map(x => x.seed + ':' + x.obs.length + ':' +
      x.start.x.toFixed(4) + ',' + x.goal.y.toFixed(4));
    W.S.benchWorlds = null;                       // uit het geheugen, opnieuw maken
    const b = W.benchmarkWorlds(N).map(x => x.seed + ':' + x.obs.length + ':' +
      x.start.x.toFixed(4) + ',' + x.goal.y.toFixed(4));
    const benchZaden = new Set(W.benchmarkWorlds(N).map(x => x.seed));
    const toetsZaden = [];
    for (let k = 0; k < W.EVAL_WORLDS; k++) toetsZaden.push(900000 + k * 37);
    const trainZaden = [];
    const s = W.S.cfg.seed;
    for (let e = 0; e <= 3000; e++) trainZaden.push(s * 1000 + e);
    return {
      gelijk: a.join('|') === b.join('|'),
      aantal: a.length,
      uniek: new Set(a).size,
      obsGoed: W.benchmarkWorlds(N).every(x => x.obs.length === W.BENCH.OBS),
      botsToets: toetsZaden.filter(z => benchZaden.has(z)).length,
      botsTrain: trainZaden.filter(z => benchZaden.has(z)).length
    };
  }, N);
  ok('benchmarkset is deterministisch', w.gelijk, `${w.aantal} werelden, twee keer identiek`);
  ok('alle werelden verschillend', w.uniek === w.aantal, `${w.uniek} van ${w.aantal} uniek`);
  ok('vast aantal obstakels', w.obsGoed, 'elke wereld 7 obstakels');
  ok('geen overlap met de toetswerelden', w.botsToets === 0);
  ok('geen overlap met de trainingswerelden', w.botsTrain === 0, 'tot 3000 pogingen vooruit gekeken');

  /* --- 2. de twee ijkpunten: een willekeurig beleid als vloer, de reactieve agent
         als ondergrens waar leren bovenuit moet komen --- */
  const r = await p.evaluate(N => {
    const W = window.__brain, S = W.S;
    S.cfg = W.readCfg();
    const a = W.benchReactief(N), b = W.benchReactief(N);
    /* willekeurig beleid: elke tik een willekeurige van de acht richtingen */
    const rnd = W.mulberry32(12345);
    const wil = W.playWorlds(W.benchmarkWorlds(N), 1, () => {
      const c = S.cfg, w = S.world, d = W.DIRV[Math.floor(rnd() * 8)];
      const mag = Math.hypot(d[0], d[1]);
      W.moveAgent(d[0] / mag * c.chSpeed, d[1] / mag * c.chSpeed, mag, w);
      const dist = Math.hypot(w.goal.x - S.ag.x, w.goal.y - S.ag.y);
      S.step++;
      if (dist < 3.4 + 1.7) { S.reached = true; return true; }
      return S.step >= c.maxSteps;
    }, 777);
    return { pct: a.pct, ci: a.ci, stappen: a.gemStappen, herhaalbaar: a.pct === b.pct,
      werelden: a.werelden, wil: wil.pct };
  }, N);
  ok('reactieve agent is herhaalbaar', r.herhaalbaar);
  ok('willekeurig beleid haalt bijna niets', r.wil < 0.15, `${(100 * r.wil).toFixed(1)}%`);
  ok('reactieve agent staat ruim boven de vloer', r.pct > r.wil + 0.15 && r.pct < 0.60,
    `${(100 * r.pct).toFixed(1)}% ± ${(100 * r.ci).toFixed(1)} op ${r.werelden} werelden, ` +
    `${r.stappen ? r.stappen.toFixed(0) : '–'} stappen bij succes`);

  /* --- 3. de benchmark met een brein: herhaalbaar en zonder bijwerking --- */
  const brn = await p.evaluate(N => {
    const W = window.__brain, S = W.S;
    S.cfg = W.readCfg(); S.cfg.nEpisodes = 60; S.cfg.evalOn = false;
    S.cfg.benchOn = false;
    W.runOne(JSON.parse(JSON.stringify(S.cfg)), 4242, 'zelftest');
    const voor = Array.from(S.B.cW), voorB = Array.from(S.B.bias);
    const a = W.benchBrain('beleid', N, 2);
    const na = Array.from(S.B.cW), naB = Array.from(S.B.bias);
    const b = W.benchBrain('beleid', N, 2);
    const s1 = W.benchBrain('streng', N, 1), s2 = W.benchBrain('streng', N, 1);
    let maxDW = 0;
    for (let i = 0; i < voor.length; i++) maxDW = Math.max(maxDW, Math.abs(voor[i] - na[i]));
    for (let i = 0; i < voorB.length; i++) maxDW = Math.max(maxDW, Math.abs(voorB[i] - naB[i]));
    /* het interval hoort over de werelden te gaan, niet over de speelbeurten */
    const halve = W.benchBrain('beleid', Math.round(N / 4), 2);
    return { gelijk: a.pct === b.pct, strengGelijk: s1.pct === s2.pct, maxDW,
      pct: a.pct, ci: a.ci, ciHalf: halve.ci, strengPct: s1.pct, strengCi: s1.ci,
      perW: a.perWereld.length, pogingen: a.pogingen };
  }, N);
  ok('benchmark is herhaalbaar (geloot)', brn.gelijk, `${(100 * brn.pct).toFixed(2)}%`);
  ok('benchmark is herhaalbaar (argmax)', brn.strengGelijk, `${(100 * brn.strengPct).toFixed(2)}%`);
  ok('benchmark laat het brein ongemoeid', brn.maxDW === 0, `grootste gewichtsverschil ${brn.maxDW}`);
  ok('interval gaat over de werelden', brn.perW === N && brn.pogingen === N * 2,
    `${brn.perW} werelden, ${brn.pogingen} pogingen`);
  ok('interval krimpt met meer werelden', brn.ciHalf > brn.ci,
    `${(100 * brn.ciHalf).toFixed(1)} bij ${Math.round(N / 4)} werelden tegen ` +
    `${(100 * brn.ci).toFixed(1)} bij ${N}`);

  /* --- 4. Mann-Whitney doet wat hij belooft --- */
  const mw = await p.evaluate(() => {
    const W = window.__brain;
    const zelfde = W.mannWhitney([1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8]);
    const anders = W.mannWhitney([1, 2, 3, 4, 5, 6, 7, 8], [21, 22, 23, 24, 25, 26, 27, 28]);
    return { zelfde: zelfde.p, anders: anders.p, oordeelA: zelfde.oordeel, oordeelB: anders.oordeel };
  });
  ok('Mann-Whitney ziet geen verschil waar er geen is', mw.zelfde > 0.5, `p = ${mw.zelfde.toFixed(3)}`);
  ok('Mann-Whitney ziet een verschil waar het er wel is', mw.anders < 0.01, `p = ${mw.anders.toFixed(4)}`);

  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
