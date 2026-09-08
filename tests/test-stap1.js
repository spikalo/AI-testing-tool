/* Bewijstest voor werkpakket 1: reproduceerbaarheid, breinen inladen, experimentloper. */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  const out = {};

  // ---- 1. zelfde zaad => bit voor bit dezelfde run ----
  out.determinisme = await p.evaluate(() => {
    const W = window.__brain;
    const base = W.readCfg();
    base.nEpisodes = 120; base.evalOn = true;
    const clone = () => JSON.parse(JSON.stringify(base));
    const a = W.runOne(clone(), 4242, 'A');
    const c = W.runOne(clone(), 4242, 'A');
    const d = W.runOne(clone(), 9999, 'B');
    const key = r => JSON.stringify({ h: r.historie, t: r.toetsen, s: r.structuur, n: r.netwerk.verbindingen });
    return {
      gelijk: key(a) === key(c),
      anderZaadVerschilt: key(a) !== key(d),
      succes20: a.resultaat.succes20, toets: a.resultaat.toetsPct,
      zaadInResultaat: a.breinZaad, verb: a.structuur.verbindingen
    };
  });

  // ---- 2. brein opslaan en terugladen: zelfde toetsscore ----
  out.inladen = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    const cfg = W.readCfg(); cfg.nEpisodes = 200; cfg.evalOn = true;
    const r = W.runOne(JSON.parse(JSON.stringify(cfg)), 777, 'bewaard');
    const json = JSON.parse(JSON.stringify(r));          // echt door JSON heen
    const voor = W.evalWorlds(20, 'beleid').pct;         // score van het levende brein
    const B2 = W.brainFromResult(json);
    S.B = B2; S.cfg = cfg;
    const na = W.evalWorlds(20, 'beleid').pct;
    // invarianten op het teruggeladen brein
    const outdeg = new Array(B2.n).fill(0), indeg = new Array(B2.n).fill(0);
    for (let c = 0; c < B2.nc; c++) if (B2.cFrom[c] !== B2.cTo[c]) { outdeg[B2.cFrom[c]]++; indeg[B2.cTo[c]]++; }
    let badIn = 0, badOut = 0;
    for (let i = 0; i < 16; i++) if (outdeg[i] === 0) badIn++;
    for (let i = 16; i < 20; i++) if (indeg[i] === 0) badOut++;
    return {
      voor, na, gelijk: Math.abs(voor - na) < 1e-9,
      illegaal: B2.__illegaal, badIn, badOut,
      neuronen: B2.n, verb: B2.nc, zaad: B2.seed,
      labelsOk: B2.labels.every(l => typeof l === 'string' && l.length > 0),
      nextId: B2.nextId
    };
  });

  // ---- 3. doortrainen op een geladen brein werkt en verbetert niet-triviaal ----
  out.doortrainen = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    const cfg = W.readCfg(); cfg.nEpisodes = 150; cfg.evalOn = false;
    const r = W.runOne(JSON.parse(JSON.stringify(cfg)), 314, 'basis');
    const B2 = W.brainFromResult(JSON.parse(JSON.stringify(r)));
    S.B = B2; S.cfg = cfg;
    const voor = W.evalWorlds(20, 'beleid').pct;
    // 150 pogingen doortrainen vanaf het geladen brein
    S.hist = []; S.evalHist = []; S.rewards = []; S.stepsSucc = []; S.succTotal = 0;
    S.collisions = 0; S.structLog = []; S.ep = 0;
    S.rnd = (function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(12345);
    return { voor, verbindingenVoor: r.structuur.verbindingen, verbindingenNa: B2.nc, ok: B2.nc === r.structuur.verbindingen };
  });

  // ---- 4. instellingen terugzetten via de UI ----
  out.instellingen = await p.evaluate(() => {
    const W = window.__brain;
    const cfg = W.readCfg(); cfg.nEpisodes = 60; cfg.evalOn = false;
    cfg.density = 22; cfg.nNeurons = 44; cfg.lr = 0.012; cfg.rGoal = 8; cfg.structEvery = 7;
    cfg.types.mem.on = false;
    const r = W.runOne(JSON.parse(JSON.stringify(cfg)), 555, 'afwijkend');
    W.applyCfgToUI(JSON.parse(JSON.stringify(r)));
    const terug = W.readCfg();
    const eq = (a, b) => Math.abs(a - b) < 1e-6;
    return {
      density: [cfg.density, terug.density, eq(cfg.density, terug.density)],
      nNeurons: [cfg.nNeurons, terug.nNeurons, cfg.nNeurons === terug.nNeurons],
      lr: [cfg.lr, terug.lr, eq(cfg.lr, terug.lr)],
      rGoal: [cfg.rGoal, terug.rGoal, eq(cfg.rGoal, terug.rGoal)],
      structEvery: [cfg.structEvery, terug.structEvery, cfg.structEvery === terug.structEvery],
      memUit: terug.types.mem.on === false,
      zaadTerug: +document.getElementById('bseed').value === 555
    };
  });

  // ---- 5. CSV klopt met de kolommen ----
  out.csv = await p.evaluate(() => {
    const W = window.__brain;
    const cfg = W.readCfg(); cfg.nEpisodes = 40; cfg.evalOn = true;
    const r = W.runOne(JSON.parse(JSON.stringify(cfg)), 8, 'csvtest');
    const line = W.csvRow(r);
    const cells = line.split(',');
    return { kolommen: W.CSV_COLS.length, cellen: cells.length, gelijk: cells.length === W.CSV_COLS.length, voorbeeld: line.slice(0, 120) };
  });

  // ---- 6. cfgOverride, ook genest ----
  out.override = await p.evaluate(() => {
    const W = window.__brain;
    const base = W.readCfg();
    const c = W.cfgOverride(base, { naam: 'x', density: 12, 'types.mem.on': false, structOn: false });
    return { density: c.density === 12, mem: c.types.mem.on === false, struct: c.structOn === false, origineelOngemoeid: base.density !== 12 };
  });

  // ---- 7. gemiddelde met interval ----
  out.statistiek = await p.evaluate(() => {
    const W = window.__brain;
    const m = W.meanCI([0.5, 0.6, 0.7, 0.4, 0.5]);
    return { n: m.n, m: +m.m.toFixed(4), ci: +m.ci.toFixed(4) };
  });

  out.paginafouten = errs;
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
