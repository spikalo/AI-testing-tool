/* Gedeelde loper voor de kalibratie van stap 20. Draait één leven in de pagina en geeft
   een compacte samenvatting terug: per fasegrens de score op alle vijf de regels, de
   kanaalafhankelijkheid, de structuurmomentopname, en de leercurve (trefkans per ronde,
   exact af te leiden uit de beloning omdat er bij het categorische beleid altijd precies
   één bak gekozen wordt: r = +1 of -1 per voorwerp). */
const { chromium } = require('playwright');
const path = require('path');
async function open() {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  const leef = (ov, zaad, fasen, benchN) => p.evaluate(([ov, zaad, fasen, benchN]) => {
    const W = window.__brain;
    let cfg = W.cfgOverride(W.readCfg(), Object.assign({ taak: 'proeftuin', worldEvery: 1,
      catPolicy: true, tuinTikken: 120, prop: 2 }, ov, { seed: zaad }));
    cfg.nEpisodes = fasen.reduce((a, f) => a + f.pogingen, 0);
    cfg.evalOn = false; cfg.benchOn = false; cfg.memOn = false;
    const t0 = performance.now();
    const row = W.runLeven(cfg, zaad, fasen, 'kalibratie', { benchN, benchReps: 1 });
    const T = cfg.tuinTikken;
    const acc = row.historie.map(h => (h.beloning / T + 1) / 2);
    const blok = 10, curve = [];
    for (let i = 0; i < acc.length; i += blok) {
      const s = acc.slice(i, i + blok); curve.push(+(s.reduce((a, b) => a + b, 0) / s.length).toFixed(3));
    }
    return {
      fasen: row.leven.fasen.map(f => ({ fase: f.fase, tot: f.totPoging,
        J: f.opEigenTaak && f.opEigenTaak.pct,
        perFase: f.opEigenTaak && f.opEigenTaak.perFase ? Object.fromEntries(Object.entries(f.opEigenTaak.perFase).map(([k, v]) => [k, v.pct])) : null,
        kanaal: f.opEigenTaak && f.opEigenTaak.kanaalafhankelijkheid, bodem: f.opEigenTaak && f.opEigenTaak.afleiderbodem,
        structuur: Object.assign({}, f.structuur, { sensorGebruik: undefined }) })),
      curve, metabool: row.metabool, kbLeer: W.S.kbLeer, tijdMs: Math.round(performance.now() - t0)
    };
  }, [ov, zaad, fasen, benchN]);
  return { b, p, fouten, leef };
}
module.exports = { open };
