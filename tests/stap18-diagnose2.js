/* Stap 18 — diagnose, ronde 3: een klein raster op het snelste net (MLP-32, backprop),
   want als dát R1 niet leert ligt het aan het spel en niet aan de architectuur.
   Veegzaden 3000.. , geen meting. VARIANTEN als JSON in de omgeving:
   [[naam, lr, beloning[5], regels, diensten, extra-ov], ...]                          */
const { chromium } = require('playwright');
const path = require('path');
const VAST = { structOn: false, growOn: false, retypeOn: false };
const ARCH = {
  mlp: { layered: true, layerSizes: [32], prop: 2, gradExact: true, ...VAST },
  elman: { layered: true, layerSizes: [32], prop: 2, gradExact: true, recurrent: true, ...VAST },
  skip: { layered: true, layerSizes: [32], prop: 2, gradExact: true, recurrent: true, skip: true, ...VAST },
  bptt: { layered: true, layerSizes: [32], prop: 2, gradExact: true, recurrent: true, bptt: true, ...VAST },
  ang: {}, angvast: VAST
};
const VARIANTEN = JSON.parse(process.env.VARIANTEN);
const ZADEN = +(process.env.ZADEN || 1);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  for (const [naam, arch, lr, bel, regels, n, extra] of VARIANTEN) for (let z = 0; z < ZADEN; z++) {
    const t0 = Date.now();
    const ov = Object.assign({}, ARCH[arch], extra || {});
    const r = await p.evaluate(([ov, lr, n, bel, regels, zaad]) => {
      const W = window.__brain;
      W.S.seinBench = null;
      let cfg = W.cfgOverride(W.readCfg(), Object.assign({ taak: 'seinhuis', worldEvery: 1, lr, seinBeloning: bel, seinRegels: regels }, ov));
      cfg.nEpisodes = n; cfg.evalOn = false; cfg.benchOn = true; cfg.benchN = 100; cfg.benchReps = 1; cfg.memOn = false;
      /* __fase: een groeiende dienstregeling, één regel erbij per __fase diensten */
      const fasen = ov.__fase ? Array.from({ length: regels }, (_, i) => ({ naam: 'R' + (i + 1), pogingen: ov.__fase, ov: { seinRegels: i + 1 } }))
        : [{ naam: 'x', pogingen: n, ov: {} }];
      if (ov.__fase) cfg.nEpisodes = ov.__fase * regels;
      const row = W.runLeven(cfg, zaad, fasen, 'diag', {});
      const B = row.benchmark.beleid, f = x => x === null ? ' –' : (100 * x).toFixed(0);
      return { pct: B.pct, ci: B.ci, loos: B.loosAlarm, streng: row.benchmark.streng.pct,
        per: Object.entries(B.perRegel).filter(([k, v]) => v.pct !== null).map(([k, v]) => `${k} ${f(v.pct)} (${f(v.kant0.pct)}/${f(v.kant1.pct)})`).join('  ') };
    }, [ov, lr, n, bel, regels, 3000 + z]);
    console.log(`${naam.padEnd(26)} z${3000 + z} ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s  ond ${(100 * r.pct).toFixed(1).padStart(5)}  streng ${(100 * r.streng).toFixed(1).padStart(5)}  loos ${(100 * r.loos).toFixed(1).padStart(5)}  | ${r.per}`);
  }
  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
