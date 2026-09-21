/* Stap 20, diagnose. Twee dingen uit ronde 3 die niet klopten met de verwachting:
   1. de gelaagde netten eindigen fase B in alle vier de levens op PRECIES 33,3 %;
   2. de wolk (vrij én bevroren) herleert na fase A niets meer — ook fase D niet, de
      schone herstart — terwijl een gelaagd net met dezelfde leerregel dat wel doet.
   Voor beide: de ruwe toestand op de fasegrens en aan het eind van de volgende fase.
   Wat er per keer wordt afgedrukt: de verwarringsmatrix (kleur -> gekozen bak), de
   entropie van het beleid, de lopende basislijn r̄, de gewichten tegen het plafond, en
   hoeveel verborgen knopen verzadigd zijn.
   Draaien: tests\draai.cmd diagnose-stap20.js s20-diagnose-log.txt                    */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  const VAST = { structOn: false, growOn: false, retypeOn: false };
  const CONDS = {
    'ang-vast': { lr: 0.008, prop: 3, lam: 0, perturbFrac: 0.1, connBudget: 2400, ...VAST },
    'mlp120-pert': { layered: true, layerSizes: [120], prop: 2, lr: 0.008, lam: 0, perturbFrac: 0.1, ...VAST },
    'mlp120-bp': { layered: true, layerSizes: [120], prop: 2, gradExact: true, lr: 0.008, lam: 0, ...VAST }
  };
  const uit = {};
  for (const [naam, ov] of Object.entries(CONDS)) for (const tweede of [1, 3]) {
    const r = await p.evaluate(([ov, tweede]) => {
      const W = window.__brain, S = W.S;
      S.cfg = W.cfgOverride(W.readCfg(), Object.assign({ taak: 'proeftuin', worldEvery: 1, catPolicy: true,
        tuinTikken: 120, ruisVast: true, seed: 2000, tuinFase: 0 }, ov));
      S.cfg.nEpisodes = 800;
      S.B = S.cfg.layered ? W.createLayered(S.cfg, 2000) : W.createBrain(S.cfg, 2000);
      S.rnd = W.mulberry32(S.cfg.seed * 7717 + 991);
      const kijk = (label) => {
        /* beleid op een vaste set voorwerpen, zonder leren, in de trainingstemperatuur */
        const B = S.B, d = W.tuinRonde(777, { tuinTikken: 400 });
        const verw = Array.from({ length: 4 }, () => [0, 0, 0, 0]); let H = 0, n = 0;
        const oudS = S.evalSample, oudT = S.evalTemp, oudR = S.evalRnd;
        S.evalSample = true; S.evalTemp = W.tempOf(S.cfg.noise0); S.evalRnd = W.mulberry32(5);
        const inp = new Float32Array(16);
        for (let t = 0; t < d.T; t++) {
          B.act.fill(0); B.next.fill(0); B.clean.fill(0); B.prev.fill(0); if (B.pre) B.pre.fill(0);
          W.tuinWaarnemen(d, t, inp);
          W.brainStep(B, inp, S.cfg, 0, S.rnd);
          const net = Array.from(B.onet), tp = S.evalTemp, mx = Math.max(...net.map(x => x / tp));
          const e = net.map(x => Math.exp(x / tp - mx)), Z = e.reduce((a, b) => a + b, 0);
          H += -e.reduce((a, x) => a + (x / Z) * Math.log(x / Z + 1e-12), 0) / Math.log(4); n++;
          const k = [0, 1, 2, 3].find(i => B.press[i]); if (k !== undefined) verw[d.kleur[t]][k]++;
        }
        S.evalSample = oudS; S.evalTemp = oudT; S.evalRnd = oudR;
        let tegen = 0, verzad = 0, nh = 0;
        for (let c = 0; c < B.nc; c++) if (Math.abs(B.cW[c]) > 0.95 * S.cfg.wmax) tegen++;
        /* verzadiging: één schone doorrekening per voorwerp, tel |tanh| > 0,99 */
        for (let t = 0; t < 60; t++) {
          B.act.fill(0); B.next.fill(0); B.prev.fill(0); if (B.pre) B.pre.fill(0);
          W.tuinWaarnemen(d, t, inp); W.propagate(B, inp, S.cfg, 0, 1, B.act, S.rnd);
          for (let j = W.K.HID0; j < B.n; j++) { nh++; if (Math.abs(B.act[j]) > 0.99) verzad++; }
        }
        const bench = W.benchBrain('beleid', 10, 1);
        return { label, verwarring: verw.map(r => r.map(x => Math.round(100 * x / r.reduce((a, b) => a + b, 0)))),
          entropie: +(H / n).toFixed(3), rbar: +B.rbar.toFixed(3), tegenPlafond: tegen, verbindingen: B.nc,
          verzadigd: +(verzad / nh).toFixed(3), maxAbsOnet: +Math.max(...Array.from(B.onet).map(Math.abs)).toFixed(2),
          J: Object.fromEntries(Object.entries(bench.perFase).map(([k, v]) => [k, +(100 * v.pct).toFixed(1)])) };
      };
      const log = [];
      const speel = (f, n) => { S.cfg.tuinFase = f;
        for (let e = 0; e < n; e++) { S.world = W.tuinRonde(S.cfg.seed * 1000 + S.ep, S.cfg); W.tuinStart();
          let d = false; while (!d) d = W.gameTick(true, W.S.cfg.noise0); S.ep++; W.fadeWeights(S.B, S.cfg); } };
      S.ep = 0;
      speel(0, 400); log.push(kijk('na A (400)'));
      speel(tweede, 100); log.push(kijk(`na ${'ABCD'[tweede]} (100)`));
      speel(tweede, 300); log.push(kijk(`na ${'ABCD'[tweede]} (400)`));
      return log;
    }, [ov, tweede]);
    uit[`${naam}-A-dan-${'ABCD'[tweede]}`] = r;
    console.log(`\n=== ${naam}: A, dan ${'ABCD'[tweede]} ===`);
    for (const x of r) console.log(`${x.label.padEnd(12)} J ${JSON.stringify(x.J)}  H ${x.entropie}  rbar ${x.rbar}  plafond ${x.tegenPlafond}/${x.verbindingen}  verzadigd ${x.verzadigd}  |onet| ${x.maxAbsOnet}\n             kleur->bak ${JSON.stringify(x.verwarring)}`);
  }
  fs.writeFileSync(path.resolve('experimenten', 's20-diagnose.json'), JSON.stringify(uit, null, 1));
  await b.close();
})();
