/* Stap 16 — diagnose: hoe groot is de omslag eigenlijk in de invoer?

   De eerste twee kalibratierondes gaven een detector die de omslag nauwelijks zag.
   Voordat er aan de statistiek gesleuteld wordt, eerst kijken wat er te zien valt:
   per invoerkanaal het gemiddelde over de vijftig pogingen vóór en na elke omslag,
   met de spreiding van poging tot poging erbij. Zonder dat getal is elke keuze voor
   een drempel giswerk.

   Draaien: tests\draai.cmd stap16-diagnose.js s16-diag-log.txt                       */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { FASEN, MEET_SEED0 } = require('./stap13-condities');

const TOTAAL = FASEN.reduce((a, f) => a + f.pogingen, 0);
const GRENZEN = FASEN.map((f, i) => FASEN.slice(0, i + 1).reduce((a, g) => a + g.pogingen, 0));
const OMSLAG = GRENZEN.slice(0, -1);
const V = 50;
const KANAAL = i => i < 8 ? `straal ${i}` : `doel ${i - 8}`;

const gem = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const sd = a => { const m = gem(a); return a.length > 1 ? Math.sqrt(gem(a.map(x => (x - m) ** 2))) : 0; };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  const zaad = MEET_SEED0;
  const log = await p.evaluate(([zaad, fasen, totaal]) => {
    const W = window.__brain;
    let cfg = W.readCfg();
    cfg.nEpisodes = totaal; cfg.evalOn = false; cfg.benchOn = false; cfg.memOn = false;
    cfg = W.cfgOverride(cfg, { lr: 0.008 });
    return W.runLeven(cfg, zaad, fasen, 's16-diag', {}).poort;
  }, [zaad, FASEN, TOTAAL]);
  if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));

  const kolom = (van, tot, i) => log.filter(r => r.poging > van && r.poging <= tot && r.m)
    .map(r => r.m[i]);

  const uit = { zaad, omslagpogingen: OMSLAG, venster: V, kanalen: [] };
  for (const g of OMSLAG) {
    console.log(`\n=== omslag op poging ${g}: ${V} pogingen ervoor tegen ${V} erna ===`);
    console.log('kanaal'.padEnd(12) + 'voor'.padEnd(12) + 'na'.padEnd(12) +
      'sd voor'.padEnd(12) + 'verschil in sd');
    for (let i = 0; i < 16; i++) {
      const a = kolom(g - V, g, i), c = kolom(g, g + V, i);
      const s = sd(a) || 1e-9;
      const rij = { omslag: g, kanaal: KANAAL(i), voor: gem(a), na: gem(c), sdVoor: sd(a),
        verschilInSd: (gem(c) - gem(a)) / s };
      uit.kanalen.push(rij);
      console.log(KANAAL(i).padEnd(12) + rij.voor.toFixed(4).padEnd(12) +
        rij.na.toFixed(4).padEnd(12) + rij.sdVoor.toFixed(4).padEnd(12) +
        rij.verschilInSd.toFixed(2));
    }
  }
  /* En de d-reeks zelf, ruw, rond elke omslag — zodat zichtbaar is of er een piek is
     die de vijftig-pogingen-gemiddelden wegmiddelen. */
  for (const g of OMSLAG) {
    const r = log.filter(x => x.poging > g - 10 && x.poging <= g + 30 && x.d !== null);
    console.log(`\nd rond poging ${g}: ` + r.map(x =>
      `${x.poging}:${x.d.toFixed(2)}${x.signaalVuur ? '*' : ''}`).join(' '));
  }
  fs.writeFileSync(path.resolve('experimenten', 's16-diagnose.json'), JSON.stringify(uit, null, 2));
  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
