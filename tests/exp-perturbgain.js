/* Vooruitblik op stap 7, volgt rechtstreeks uit de meting van stap 3: het
   node-perturbatiedeel van de update mist de normalisatie 1/Var(ξ) die de
   standaardformulering wel heeft. Wat is die versterking waard op het echte brein? */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const NSEEDS = +(process.env.NSEEDS || 8), NEP = 500, SEED0 = 1000;
const GAINS = (process.env.GAINS || '1,10,30,100,272').split(',').map(Number);
/* LRDEEL=1: de leersnelheid meeschalen met 1/g. Dan blijft het wolkdeel van de update
   op zijn oude grootte en wordt het knopdeel g keer zachter — dezelfde verschuiving in
   de onderlinge verhouding, maar zonder dat de totale stap ontploft. */
const LRDEEL = process.env.LRDEEL === '1';

(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  const uit = { uitgevoerd: new Date().toISOString(), pogingenPerRun: NEP, zaden: NSEEDS,
    beschrijving: 'Versterking g van het node-perturbatiedeel van de eligibility-trace ten ' +
      'opzichte van het score-functiedeel bij de uitvoerknopen. g = 1 is de bestaande leerregel; ' +
      '1/Var(ξ) ≈ 272 is de normalisatie uit de literatuur bij exploratie 0,30. Leersnelheid is ' +
      'NIET meegeschaald — dat is precies wat er te zien moet zijn.', perGain: {} };
  for (const g of GAINS) {
    const rs = [];
    for (let k = 0; k < NSEEDS; k++) {
      const r = await p.evaluate(([zaad, nep, g, lrdeel]) => {
        const W = window.__brain;
        const c = W.readCfg(); c.nEpisodes = nep; c.evalOn = true; c.perturbGain = g;
        if (lrdeel) c.lr = c.lr / g;
        const row = W.runOne(c, zaad, 'gain-' + g + (lrdeel ? '-lr' : ''));
        return { s20: row.resultaat.succes20, toets: row.resultaat.toetsPct,
                 succes: row.resultaat.succesPct, actief: row.structuur.actieveVerbindingen,
                 reflex: row.structuur.reflexbogen, maxW: row.structuur.gemAbsW };
      }, [SEED0 + k, NEP, g, LRDEEL]);
      rs.push(r);
      process.stdout.write('.');
    }
    const m = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
    const sd = k => { const mu = m(k); return Math.sqrt(rs.reduce((a, r) => a + (r[k] - mu) ** 2, 0) / (rs.length - 1)); };
    uit.perGain[g] = { runs: rs };
    for (const k of ['s20', 'toets', 'succes', 'actief', 'gemAbsW'])
      if (rs[0][k] !== undefined) uit.perGain[g][k] = { m: m(k), sd: sd(k), ci: 1.96 * sd(k) / Math.sqrt(rs.length) };
    console.log(`\ng=${g}: laatste20 ${(100 * m('s20')).toFixed(1)}% ± ${(196 * sd('s20') / Math.sqrt(NSEEDS)).toFixed(1)}  ` +
      `toets ${(100 * m('toets')).toFixed(1)}% ± ${(196 * sd('toets') / Math.sqrt(NSEEDS)).toFixed(1)}  ` +
      `actief ${m('actief').toFixed(0)}`);
  }
  fs.writeFileSync(path.resolve('experimenten/perturbatie-schaal' + (LRDEEL ? '-lr' : '') + '.json'),
    JSON.stringify(uit, null, 2));
  console.log('\ngeschreven: experimenten/perturbatie-schaal.json');
  await b.close();
})();
