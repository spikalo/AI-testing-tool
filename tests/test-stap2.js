/* Stap 2 — bewijst dat de eligibility-trace nu de presynaptische activatie
   gebruikt, en dat de oude regel aantoonbaar iets anders deed.

   Drie controles:
   A. B.pre is precies de toestand die B.act voortbracht (één propagatiestap terug).
   B. Oud en nieuw verschillen alleen voor verbindingen die uit de wolk komen;
      verbindingen die uit een invoer-node komen zijn identiek. Dat is exact de
      voorspelling uit het werkplan.
   C. De correctie breekt de reproduceerbaarheid niet.                            */
const { chromium } = require('playwright');
const path = require('path');

const F = (x, n = 6) => Number(x).toFixed(n);
let fouten = 0;
function eis(naam, ok, extra = '') {
  console.log(`${ok ? 'GOED' : 'FOUT'}  ${naam}${extra ? '  ' + extra : ''}`);
  if (!ok) fouten++;
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  /* ---------- A. B.pre reproduceert B.act ---------- */
  for (const prop of [1, 2, 3]) {
    const r = await p.evaluate((prop) => {
      const W = window.__brain, K = W.K;
      const cfg = W.readCfg(); cfg.prop = prop;
      const B = W.createBrain(cfg, 4242); W.resetBrainState(B);
      const rnd = W.mulberry32(7);
      const inp = new Float32Array(16);
      for (let i = 0; i < 16; i++) inp[i] = rnd() * 2 - 1;
      // geef de wolk een niet-triviale begintoestand, anders is stap 1 al het antwoord
      for (let i = K.HID0; i < B.n; i++) B.act[i] = rnd() * 2 - 1;
      for (let j = K.OUT0; j < K.HID0; j++) B.act[j] = rnd();
      W.propagate(B, inp, cfg, 0, 1.0, B.act, rnd);

      // handmatig één stap vanaf B.pre; dat moet B.act opleveren
      const sum = new Float64Array(B.n);
      for (let c = 0; c < B.nc; c++) sum[B.cTo[c]] += B.cW[c] * B.pre[B.cFrom[c]];
      let maxd = 0;
      const tanh = Math.tanh, sigm = v => 1 / (1 + Math.exp(-v));
      for (let j = 0; j < B.n; j++) {
        const k = B.kinds[j];
        let v;
        if (k === K.K_IN) v = B.pre[j];
        else if (k === K.K_OUT) v = sigm((sum[j] + B.bias[j]) / 1.0);
        else if (k === K.K_MEM) v = (1 - cfg.memLeak) * B.pre[j] + cfg.memLeak * tanh(sum[j] + B.bias[j]);
        else v = tanh(sum[j] + B.bias[j]);
        maxd = Math.max(maxd, Math.abs(v - B.act[j]));
      }
      // en het tegenbewijs: dezelfde stap vanaf B.act (de oude keuze) klopt niet
      const sum2 = new Float64Array(B.n);
      for (let c = 0; c < B.nc; c++) sum2[B.cTo[c]] += B.cW[c] * B.act[B.cFrom[c]];
      let maxd2 = 0;
      for (let j = K.HID0; j < B.n; j++) maxd2 = Math.max(maxd2, Math.abs(tanh(sum2[j] + B.bias[j]) - B.act[j]));
      return { maxd, maxd2, nc: B.nc };
    }, prop);
    eis(`A prop=${prop}: B.pre brengt B.act voort`, r.maxd < 1e-5, `maxafwijking ${F(r.maxd, 9)}`);
    eis(`A prop=${prop}: B.act zelf doet dat niet`, r.maxd2 > 1e-3, `maxafwijking ${F(r.maxd2, 6)}`);
  }

  /* ---------- B. oud vs nieuw, uitgesplitst naar herkomst ---------- */
  for (const prop of [1, 2]) {
    const r = await p.evaluate((prop) => {
      const W = window.__brain, K = W.K;
      const cfg = W.readCfg(); cfg.prop = prop;
      const B = W.createBrain(cfg, 4242); W.resetBrainState(B);
      const rnd = W.mulberry32(7);
      const inp = new Float32Array(16);
      for (let i = 0; i < 16; i++) inp[i] = rnd() * 2 - 1;
      for (let i = K.HID0; i < B.n; i++) B.act[i] = rnd() * 2 - 1;
      W.brainStep(B, inp, cfg, 0.30, rnd);
      const dev = Float32Array.from(B.dev), pre = Float32Array.from(B.pre), act = Float32Array.from(B.act);
      let uitInvoerZelfde = 0, uitInvoerAnders = 0, uitWolkZelfde = 0, uitWolkAnders = 0;
      let somAbsVerschil = 0, somAbsNieuw = 0;
      for (let c = 0; c < B.nc; c++) {
        const f = B.cFrom[c], t = B.cTo[c];
        const nieuw = 0.4 * pre[f] * dev[t], oud = 0.4 * act[f] * dev[t];
        const zelfde = Math.abs(nieuw - oud) < 1e-9;
        if (B.kinds[f] === K.K_IN) { zelfde ? uitInvoerZelfde++ : uitInvoerAnders++; }
        else { zelfde ? uitWolkZelfde++ : uitWolkAnders++; }
        somAbsVerschil += Math.abs(nieuw - oud); somAbsNieuw += Math.abs(nieuw);
      }
      return { uitInvoerZelfde, uitInvoerAnders, uitWolkZelfde, uitWolkAnders,
               relVerschil: somAbsNieuw ? somAbsVerschil / somAbsNieuw : 0 };
    }, prop);
    eis(`B prop=${prop}: verbindingen uit een invoer-node zijn identiek`,
      r.uitInvoerAnders === 0, `${r.uitInvoerZelfde} identiek, ${r.uitInvoerAnders} afwijkend`);
    eis(`B prop=${prop}: verbindingen uit de wolk verschillen wél`,
      r.uitWolkAnders > 0, `${r.uitWolkAnders} van ${r.uitWolkAnders + r.uitWolkZelfde} afwijkend, ` +
      `relatief verschil ${(100 * r.relVerschil).toFixed(1)}%`);
  }

  /* ---------- C. reproduceerbaarheid blijft ---------- */
  const rep = await p.evaluate(() => {
    const W = window.__brain;
    const mk = (oud) => { const c = W.readCfg(); c.nEpisodes = 60; c.evalOn = true; c.traceOud = oud; return c; };
    const key = r => JSON.stringify({ h: r.historie, t: r.toetsen, s: r.structuur, n: r.netwerk });
    const a1 = W.runOne(mk(false), 1000, 'nieuw'), a2 = W.runOne(mk(false), 1000, 'nieuw');
    const b1 = W.runOne(mk(true), 1000, 'oud');
    return { identiek: key(a1) === key(a2), verschiltVanOud: key(a1) !== key(b1),
             csvNieuw: W.csvRow(a1).split(',')[W.CSV_COLS.indexOf('traceOud')],
             csvOud: W.csvRow(b1).split(',')[W.CSV_COLS.indexOf('traceOud')] };
  });
  eis('C twee keer hetzelfde zaad geeft bit voor bit hetzelfde', rep.identiek);
  eis('C de oude traceregel geeft een ander verloop', rep.verschiltVanOud);
  eis('C de kolom traceOud staat goed in de CSV', rep.csvNieuw === '0' && rep.csvOud === '1',
    `nieuw=${rep.csvNieuw} oud=${rep.csvOud}`);

  await b.close();
  console.log(fouten ? `\n${fouten} controle(s) mislukt` : '\nalle controles goed');
  process.exit(fouten ? 1 : 0);
})();
