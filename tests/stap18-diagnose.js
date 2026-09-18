/* Stap 18 — diagnose: waarom zakt élke architectuur naar "niets doen", en wat is er
   nodig om het spel speelbaar te maken? Geen meting: veegzaad 3000, één leven per
   variant, benchmark op 100 diensten. De uitkomst bepaalt alleen de standaardbeloning
   en het aantal diensten per leven; zij gaat niet in de paper als resultaat, wel als
   verantwoording van die twee keuzes.
   Draaien: tests\draai.cmd stap18-diagnose.js s18-diagnose-log.txt                    */
const { chromium } = require('playwright');
const path = require('path');
const N = +(process.env.DIENSTEN || 1500);
const VAST = { structOn: false, growOn: false, retypeOn: false };
const MLP = { layered: true, layerSizes: [32], prop: 2, gradExact: true, ...VAST };
const ELM = { ...MLP, recurrent: true };
const OUD = [1.5, -1.5, 0.5, 0.5, 0.5], NIEUW = [1.5, -1.5, 0.5, 0.5, 0.05];
const VARIANTEN = [
  ['mlp-32 oude beloning', 0.016, MLP, OUD],
  ['mlp-32 nieuw', 0.016, MLP, NIEUW],
  ['elman-32 nieuw', 0.008, ELM, NIEUW],
  ['elman-32-skip nieuw', 0.008, { ...ELM, skip: true }, NIEUW],
  ['ang nieuw', 0.008, {}, NIEUW],
  ['ang-vast nieuw', 0.008, VAST, NIEUW],
  ['mlp-32 achtergrond 0', 0.016, MLP, [1.5, -1.5, 0.5, 0.5, 0]],
  ['mlp-32 afleider 1.0', 0.016, MLP, [1.5, -1.5, 0.5, 1.0, 0.05]],
  /* ronde 2: symmetrisch — reageren op een afleider kost evenveel als een eis missen */
  ['S mlp-32', 0.016, MLP, [1.5, -1.5, 0.5, 1.5, 0.05]],
  ['S mlp-32 achtergrond .15', 0.016, MLP, [1.5, -1.5, 0.5, 1.5, 0.15]],
  ['S elman-32', 0.008, ELM, [1.5, -1.5, 0.5, 1.5, 0.05]],
  ['S elman-32 lr .016', 0.016, ELM, [1.5, -1.5, 0.5, 1.5, 0.05]],
  ['S elman-32-skip', 0.008, { ...ELM, skip: true }, [1.5, -1.5, 0.5, 1.5, 0.05]],
  ['S ang', 0.008, {}, [1.5, -1.5, 0.5, 1.5, 0.05]]
].filter(v => !process.env.ALLEEN || new RegExp(process.env.ALLEEN).test(v[0]));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  for (const [naam, lr, ov, bel] of VARIANTEN) {
    const t0 = Date.now();
    const r = await p.evaluate(([ov, lr, n, bel]) => {
      const W = window.__brain;
      let cfg = W.cfgOverride(W.readCfg(), Object.assign({ taak: 'seinhuis', worldEvery: 1, lr, seinBeloning: bel }, ov));
      cfg.nEpisodes = n; cfg.evalOn = false; cfg.benchOn = true; cfg.benchN = 100; cfg.benchReps = 1; cfg.memOn = false;
      const row = W.runLeven(cfg, 3000, [{ naam: 'x', pogingen: n, ov: {} }], 'diag', {});
      const B = row.benchmark.beleid, f = x => x === null ? ' –' : (100 * x).toFixed(0);
      return { pct: B.pct, ci: B.ci, tref: B.trefkansEisen, loos: B.loosAlarm, streng: row.benchmark.streng.pct,
        per: Object.entries(B.perRegel).map(([k, v]) => `${k} ${f(v.pct)} (${f(v.kant0.pct)}/${f(v.kant1.pct)})`).join('  ') };
    }, [ov, lr, N, bel]);
    console.log(`${naam.padEnd(22)} ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s  onderscheid ${(100 * r.pct).toFixed(1)}±${(100 * r.ci).toFixed(1)}  streng ${(100 * r.streng).toFixed(1)}  eisen ${(100 * r.tref).toFixed(0)}  loos ${(100 * r.loos).toFixed(1)}  | ${r.per}`);
  }
  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
