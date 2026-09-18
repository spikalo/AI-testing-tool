/* Stap 18 — verkenning vóór de voorregistratie. Geen meting: één zaad per conditie op
   veegzaden (niet de meetzaden), alleen om te weten hoe lang een leven duurt en of het
   aantal diensten in de buurt van een plateau komt. Wat hier uitkomt bepaalt het
   aantal diensten en niets anders; de uitkomsten gaan niet in de paper.
   Draaien: tests\draai.cmd stap18-proef.js s18-proef-log.txt                          */
const { chromium } = require('playwright');
const path = require('path');
const DIENSTEN = +(process.env.DIENSTEN || 600);
const VAST = { structOn: false, growOn: false, retypeOn: false };
const CONDS = [
  ['ang', 0.008, {}],
  ['mlp-32-bp', 0.016, { layered: true, layerSizes: [32], prop: 2, gradExact: true, ...VAST }],
  ['elman-32-bp', 0.008, { layered: true, layerSizes: [32], prop: 2, recurrent: true, gradExact: true, ...VAST }],
  ['elman-32-skip-bp', 0.008, { layered: true, layerSizes: [32], prop: 2, recurrent: true, skip: true, gradExact: true, ...VAST }]
].filter(c => !process.env.ALLEEN || process.env.ALLEEN.split(',').includes(c[0]));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  for (const [naam, lr, ov] of CONDS) {
    const t0 = Date.now();
    const r = await p.evaluate(([ov, lr, n]) => {
      const W = window.__brain;
      let cfg = W.cfgOverride(W.readCfg(), Object.assign({ taak: 'seinhuis', worldEvery: 1, lr }, ov));
      cfg.nEpisodes = n; cfg.evalOn = false; cfg.benchOn = true; cfg.benchN = 100; cfg.benchReps = 1; cfg.memOn = false;
      const row = W.runLeven(cfg, 3000, [{ naam: 'x', pogingen: n, ov: {} }], 'proef', {});
      const h = row.historie, blok = k => {
        const s = h.slice(k, k + Math.floor(n / 6)); return s.reduce((a, x) => a + x.beloning, 0) / Math.max(1, s.length); };
      const curve = []; for (let k = 0; k < n; k += Math.floor(n / 6)) curve.push(blok(k).toFixed(1));
      return { pct: row.benchmark.beleid.pct, streng: row.benchmark.streng.pct, loos: row.benchmark.beleid.loosAlarm,
        per: Object.entries(row.benchmark.beleid.perRegel).map(([k, v]) => k + ' ' + (100 * v.pct).toFixed(0)).join('  '),
        curve: curve.join(' '), verb: row.structuur.verbindingen };
    }, [ov, lr, DIENSTEN]);
    console.log(`${naam.padEnd(18)} ${((Date.now() - t0) / 1000).toFixed(0)}s  bench ${(100 * r.pct).toFixed(1)}%  streng ${(100 * r.streng).toFixed(1)}%  loos ${r.loos === null ? '-' : (100 * r.loos).toFixed(1)}%  | ${r.per}  | beloning per zesde: ${r.curve}  | verb ${r.verb}`);
  }
  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
