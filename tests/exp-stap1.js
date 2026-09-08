/* Eerste echte reeks: de referentieconditie op de huidige standaardinstellingen,
   plus de herhaalbaarheidscontrole. Schrijft runs.csv en een JSON per run. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  const NSEEDS = 12, NEP = 500, SEED0 = 1000;
  fs.mkdirSync('/home/claude/experimenten/runs', { recursive: true });
  const hdr = await p.evaluate(() => window.__brain.CSV_COLS.join(','));
  const lines = [hdr];

  for (let k = 0; k < NSEEDS; k++) {
    const t = Date.now();
    const r = await p.evaluate(([seed, nep]) => {
      const W = window.__brain;
      const cfg = W.readCfg(); cfg.nEpisodes = nep; cfg.evalOn = true;
      const row = W.runOne(cfg, seed, 'standaard');
      return { csv: W.csvRow(row), json: row };
    }, [SEED0 + k, NEP]);
    lines.push(r.csv);
    fs.writeFileSync(`/home/claude/experimenten/runs/standaard_z${SEED0 + k}.json`, JSON.stringify(r.json, null, 2));
    const res = r.json.resultaat, st = r.json.structuur;
    console.log(`zaad ${SEED0 + k}: laatste20 ${(res.succes20 * 100).toFixed(0)}%  toets ${(res.toetsPct * 100).toFixed(0)}%  ` +
      `verb ${st.verbindingen} actief ${st.actieveVerbindingen} reflex ${st.reflexbogen} lussen ${st.lussen} pad ${st.kortstePad} ` +
      `neuronen ${r.json.config.neuronenNu}  ${(res.rekentijdMs / 1000).toFixed(1)}s  (wall ${((Date.now() - t) / 1000).toFixed(0)}s)`);
  }
  fs.writeFileSync('/home/claude/experimenten/runs.csv', lines.join('\n') + '\n');

  // herhaalbaarheid: drie zaden, elk twee keer, bit voor bit vergelijken
  const herh = await p.evaluate(([nep]) => {
    const W = window.__brain;
    const key = r => JSON.stringify({ h: r.historie, t: r.toetsen, s: r.structuur, n: r.netwerk });
    const uit = [];
    for (const z of [1000, 1005, 1011]) {
      const cfg = () => { const c = W.readCfg(); c.nEpisodes = nep; c.evalOn = true; return c; };
      const a = W.runOne(cfg(), z, 'herhaal'), b = W.runOne(cfg(), z, 'herhaal');
      uit.push({ zaad: z, identiek: key(a) === key(b), succes20: a.resultaat.succes20, toets: a.resultaat.toetsPct });
    }
    return uit;
  }, [200]);
  fs.writeFileSync('/home/claude/experimenten/reproduceerbaarheid.json', JSON.stringify({
    beschrijving: 'Elke conditie twee keer gedraaid met hetzelfde breinzaad en hetzelfde wereldzaad; ' +
      'vergeleken zijn de volledige leercurve, alle toetsen, alle structuurmaten en het eindnetwerk.',
    pogingenPerRun: 200, uitgevoerd: new Date().toISOString(), runs: herh
  }, null, 2));
  console.log('\nherhaalbaarheid:', JSON.stringify(herh));

  const s20 = lines.slice(1).map(l => +l.split(',')[CSVI(hdr, 'succes20')]);
  const ev = lines.slice(1).map(l => +l.split(',')[CSVI(hdr, 'toetsPct')]);
  const mci = xs => { const n = xs.length, m = xs.reduce((a, c) => a + c, 0) / n; const sd = Math.sqrt(xs.reduce((a, c) => a + (c - m) ** 2, 0) / (n - 1)); return `${(100 * m).toFixed(1)}% ± ${(100 * 1.96 * sd / Math.sqrt(n)).toFixed(1)} (sd ${(100 * sd).toFixed(1)})`; };
  console.log('\nlaatste 20 :', mci(s20));
  console.log('toets      :', mci(ev));
  function CSVI(h, k) { return h.split(',').indexOf(k); }
  await b.close();
})();
