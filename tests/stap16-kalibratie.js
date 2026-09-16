/* Stap 16 — kalibratie van de detector, vóór de prereregistratie.

   WAT HIER WEL EN NIET MAG. De vensters en de k van de detector moeten ergens vandaan
   komen. Ze mogen niet uit de uitkomstdata komen — dat zou de meting zijn eigen keuze
   laten bepalen. Ze komen daarom uit de KLOKCONDITIE, waarin de detector wel meeloopt
   maar niets stuurt: daar is hij een passieve waarnemer en is er geen uitkomst om op
   te optimaliseren. Wat hier gemeten wordt is uitsluitend: hoe vaak zou deze poort
   vuren in een stilstaande fase, en komt de omslag daar bovenuit. Niet: welke
   instelling levert het beste herstel op. Die vraag is de meting zelf en wordt pas ná
   de prereregistratie gesteld.

   Draaien: tests\draai.cmd stap16-kalibratie.js s16-kal-log.txt                      */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { FASEN, MEET_SEED0 } = require('./stap13-condities');

const OUT = path.resolve('experimenten');
const TOTAAL = FASEN.reduce((a, f) => a + f.pogingen, 0);
const GRENZEN = FASEN.map((f, i) => FASEN.slice(0, i + 1).reduce((a, g) => a + g.pogingen, 0));
const OMSLAG = GRENZEN.slice(0, -1);
const ZADEN = +(process.env.NSEEDS || 3);
const VENSTER = 50;

const VARIANTEN = [
  { sigFast: 5, sigSlow: 60, sigK: 3, sigWarmup: 60, sigBuffer: 200 },
  { sigFast: 10, sigSlow: 100, sigK: 3, sigWarmup: 100, sigBuffer: 200 },
  { sigFast: 20, sigSlow: 150, sigK: 3, sigWarmup: 150, sigBuffer: 200 },
  { sigFast: 20, sigSlow: 150, sigK: 5, sigWarmup: 150, sigBuffer: 200 },
  { sigFast: 30, sigSlow: 200, sigK: 3, sigWarmup: 200, sigBuffer: 200 }
];

const gem = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

function statistiek(log) {
  const stilD = [], naD = [], stilV = [], naV = [];
  let nVuur = 0; const eerste = [null, null];
  for (const r of log) {
    if (!r.rijp || r.d === null || !isFinite(r.d)) continue;
    const bij = OMSLAG.findIndex(g => r.poging > g && r.poging <= g + VENSTER);
    if (r.signaalVuur) {
      nVuur++;
      if (bij >= 0 && eerste[bij] === null) eerste[bij] = r.poging - OMSLAG[bij];
    }
    if (bij >= 0) { naD.push(r.d); naV.push(r.signaalVuur ? 1 : 0); }
    else { stilD.push(r.d); stilV.push(r.signaalVuur ? 1 : 0); }
  }
  return { nVuur, dStil: gem(stilD), dNa: gem(naD),
    vuurStil: gem(stilV), vuurNa: gem(naV),
    eersteNaOmslag1: eerste[0], eersteNaOmslag2: eerste[1] };
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  console.log('kalibratie op de klokconditie (de detector loopt mee maar stuurt niet),');
  console.log(`${ZADEN} zaden, ${TOTAAL} pogingen, omslag op ${OMSLAG.join(' en ')}, venster ${VENSTER}\n`);
  console.log('variant'.padEnd(26) + 'd stil'.padEnd(10) + 'd na omslag'.padEnd(14) +
    'vuur/leven'.padEnd(12) + '% stil'.padEnd(9) + '% na'.padEnd(9) +
    'verhouding'.padEnd(12) + 'eerste vuur na omslag');

  const alles = [];
  for (const v of VARIANTEN) {
    const uit = [];
    for (let k = 0; k < ZADEN; k++) {
      const zaad = MEET_SEED0 + k;
      const poort = await p.evaluate(([zaad, ov, fasen, totaal]) => {
        const W = window.__brain;
        let cfg = W.readCfg();
        cfg.nEpisodes = totaal; cfg.evalOn = false; cfg.benchOn = false; cfg.memOn = false;
        cfg = W.cfgOverride(cfg, Object.assign({}, ov, { lr: 0.008 }));
        return W.runLeven(cfg, zaad, fasen, 's16-kal', {}).poort;
      }, [zaad, v, FASEN, TOTAAL]);
      if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
      uit.push(Object.assign({ zaad }, statistiek(poort)));
    }
    const G = f => gem(uit.map(o => o[f]).filter(x => x !== null && isFinite(x)));
    const stil = G('vuurStil'), na = G('vuurNa');
    const rij = { variant: v, perZaad: uit, dStil: G('dStil'), dNa: G('dNa'),
      vuurPerLeven: G('nVuur'), vuurStil: stil, vuurNa: na,
      verhouding: stil > 0 ? na / stil : null,
      eersteNaOmslag1: G('eersteNaOmslag1'), eersteNaOmslag2: G('eersteNaOmslag2') };
    alles.push(rij);
    const f1 = x => x === null ? '–' : x.toFixed(1);
    console.log(
      `fast ${v.sigFast} slow ${v.sigSlow} k ${v.sigK}`.padEnd(26) +
      rij.dStil.toFixed(3).padEnd(10) + rij.dNa.toFixed(3).padEnd(14) +
      rij.vuurPerLeven.toFixed(1).padEnd(12) +
      (100 * stil).toFixed(1).padEnd(9) + (100 * na).toFixed(1).padEnd(9) +
      (rij.verhouding === null ? '–' : rij.verhouding.toFixed(1) + '×').padEnd(12) +
      `${f1(rij.eersteNaOmslag1)} / ${f1(rij.eersteNaOmslag2)} pogingen`);
  }

  fs.writeFileSync(path.join(OUT, 's16-kalibratie.json'), JSON.stringify({
    uitgevoerd: new Date().toISOString(),
    beschrijving: 'Kalibratie van de detector uit stap 16 op de klokconditie, waarin hij ' +
      'meeloopt maar niets stuurt. Gemeten is hoe vaak de poort zou vuren in een stilstaande ' +
      'fase en of de omslag daar bovenuit komt; er is geen uitkomstmaat bij betrokken. De ' +
      'eerste ronde hiervan (ongeschaalde L1-afstand, drempelring die tijdens het vuren ' +
      'doorliep) haalde een verhouding van 1,4 x en is de reden dat elk kanaal nu op zijn ' +
      'eigen spreiding geschaald wordt en dat de ring tijdens het vuren bevriest.',
    zaden: ZADEN, fasen: FASEN, omslagpogingen: OMSLAG, venster: VENSTER,
    varianten: alles
  }, null, 2));

  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
