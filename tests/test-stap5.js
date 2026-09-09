/* Stap 5 — controle op de basislijn vóórdat er iets mee vergeleken wordt.
   De hele waarde van deze conditie hangt aan één claim: alleen de structuur
   verschilt. Dus wordt hier nagerekend dat het netwerk werkelijk gelaagd is, dat
   het parameterbudget klopt, dat de structuur tijdens het leren niet verschuift,
   en dat de leerregel bit voor bit dezelfde code doorloopt.                     */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push('paginafout: ' + e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  const ok = (naam, geslaagd, tekst) => {
    console.log(`${geslaagd ? 'OK  ' : 'FOUT'}  ${naam}${tekst ? ' — ' + tekst : ''}`);
    if (!geslaagd) process.exitCode = 1;
  };

  /* --- 1. de bedrading is een stapel lagen en niets anders --- */
  const w = await p.evaluate(() => {
    const W = window.__brain, K = W.K;
    const cfg = W.readCfg(); cfg.layered = true; cfg.layerSizes = [150];
    const B = W.createLayered(cfg, 1000);
    const H = K.HID0, n = B.n;
    let inNaarLaag = 0, laagNaarUit = 0, fout = 0, zelf = 0;
    for (let c = 0; c < B.nc; c++) {
      const a = B.cFrom[c], z = B.cTo[c];
      if (a === z) zelf++;
      if (a < W.EVAL_WORLDS - 4 || a < 16) { if (z >= H) inNaarLaag++; else fout++; }
      else if (a >= H) { if (z >= K.OUT0 && z < H) laagNaarUit++; else if (z >= H) { /* laag→laag */ } else fout++; }
      else fout++;                                   // vertrekt uit een uitvoerknoop
    }
    let soortFout = 0;
    for (let i = H; i < n; i++) if (B.kinds[i] !== K.K_WORK) soortFout++;
    const A = (() => { W.S.cfg = cfg; W.S.B = B; W.resetBrainState(B); return W.analyze(B, cfg); })();
    return { nc: B.nc, verborgen: n - H, inNaarLaag, laagNaarUit, fout, zelf, soortFout,
      pad: A.shortest, lussen: A.loops, lagen: B.lagen };
  });
  ok('alle verborgen knopen zijn workers', w.soortFout === 0, `${w.verborgen} knopen`);
  ok('geen zelfverbindingen, geen terugkoppeling', w.zelf === 0 && w.lussen === 0,
    `${w.zelf} zelfverbindingen, ${w.lussen} lussen`);
  ok('geen enkele verbinding buiten het lagenpatroon', w.fout === 0);
  ok('parameterbudget klopt', w.nc === 20 * 150, `${w.nc} verbindingen bij één laag van 150`);
  ok('kortste pad zintuig → knop is twee bogen', w.pad === 2, `pad = ${w.pad}`);

  /* --- 2. twee lagen kosten één boog extra, en dus één tijdstap --- */
  const d = await p.evaluate(() => {
    const W = window.__brain;
    const cfg = W.readCfg(); cfg.layered = true; cfg.layerSizes = [46, 46];
    const B = W.createLayered(cfg, 1000);
    W.S.cfg = cfg; W.S.B = B; W.resetBrainState(B);
    const A = W.analyze(B, cfg);
    return { nc: B.nc, pad: A.shortest };
  });
  ok('twee lagen: kortste pad is drie bogen', d.pad === 3,
    `${d.nc} verbindingen, pad = ${d.pad}`);

  /* --- 3. de structuur staat vast tijdens het leren --- */
  const vast = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    const cfg = W.readCfg();
    cfg.layered = true; cfg.layerSizes = [150]; cfg.structOn = false; cfg.growOn = false;
    cfg.retypeOn = false; cfg.nEpisodes = 120; cfg.evalOn = false; cfg.benchOn = false;
    const voor = W.createLayered(cfg, 2000);
    const bedradingVoor = Array.from(voor.cFrom).map((a, i) => a + '>' + voor.cTo[i]).join('|');
    const r = W.runOne(JSON.parse(JSON.stringify(cfg)), 2000, 'zelftest-gelaagd');
    const na = S.B;
    const bedradingNa = Array.from(na.cFrom).map((a, i) => a + '>' + na.cTo[i]).join('|');
    let veranderd = 0;
    for (let c = 0; c < na.nc; c++) if (na.cW[c] !== voor.cW[c]) veranderd++;
    return { zelfde: bedradingVoor === bedradingNa, ncVoor: voor.nc, ncNa: na.nc,
      gewichtenVeranderd: veranderd, gesnoeid: na.pruned, bijgegroeid: na.sprouted,
      geboren: na.born, omgetypt: na.retyped,
      succes20: r.resultaat.succes20, lagen: r.config.gelaagd };
  });
  ok('bedrading is na het leren nog exact dezelfde', vast.zelfde && vast.ncVoor === vast.ncNa,
    `${vast.ncVoor} → ${vast.ncNa} verbindingen`);
  ok('niets gesnoeid, bijgegroeid, geboren of omgetypt',
    vast.gesnoeid === 0 && vast.bijgegroeid === 0 && vast.geboren === 0 && vast.omgetypt === 0);
  ok('de gewichten leren wél', vast.gewichtenVeranderd > 0.5 * vast.ncNa,
    `${vast.gewichtenVeranderd} van ${vast.ncNa} gewichten veranderd, laatste 20: ` +
    `${(100 * vast.succes20).toFixed(0)}%`);
  ok('het resultaatbestand legt de lagen vast', !!vast.lagen && vast.lagen.lagen[0] === 150,
    JSON.stringify(vast.lagen));

  /* --- 4. dezelfde leerregel: dezelfde code, dezelfde instellingen --- */
  const zelfde = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    const maak = laag => {
      const cfg = W.readCfg();
      cfg.nEpisodes = 80; cfg.evalOn = false; cfg.benchOn = false;
      cfg.structOn = false; cfg.growOn = false; cfg.retypeOn = false;
      if (laag) { cfg.layered = true; cfg.layerSizes = [150]; }
      return cfg;
    };
    const a = maak(false), c = maak(true);
    /* elk veld van de leerregel moet identiek zijn; alleen de topologie mag schelen */
    const sleutels = ['lr', 'lam', 'decay', 'wmax', 'stepMax', 'memLeak', 'prop', 'noise0',
      'lrAnneal', 'traceOud', 'perturbGain', 'rGoal', 'rProg', 'rCol', 'rStep', 'rIdle',
      'nObs', 'maxSteps', 'worldEvery', 'seed', 'chSpeed'];
    const verschil = sleutels.filter(k => JSON.stringify(a[k]) !== JSON.stringify(c[k]));
    /* en twee runs met hetzelfde zaad moeten bit voor bit gelijk zijn */
    const r1 = W.runOne(JSON.parse(JSON.stringify(c)), 3000, 'x');
    const w1 = Array.from(S.B.cW);
    const r2 = W.runOne(JSON.parse(JSON.stringify(c)), 3000, 'x');
    const w2 = Array.from(S.B.cW);
    return { verschil, herhaalbaar: w1.every((v, i) => v === w2[i]) &&
      r1.resultaat.succes20 === r2.resultaat.succes20 };
  });
  ok('leerregel en spelregels zijn identiek aan de wolkconditie', zelfde.verschil.length === 0,
    zelfde.verschil.length ? 'verschilt in: ' + zelfde.verschil.join(', ') : '21 velden nagelopen');
  ok('gelaagde run is bit voor bit herhaalbaar', zelfde.herhaalbaar);

  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
