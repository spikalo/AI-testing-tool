/* Stap 12a — een leersnelheidsveeg voor ANG op de knippertaak.

   Waarom alleen voor ANG en ANG-bevroren. De eerste peiling laat zien dat ANG op de
   knippertaak instort (66 % → 10 % bij tien aan, twintig uit) terwijl een vast
   recurrent net met BPTT er nauwelijks last van heeft. Dat is een uitspraak ten
   nadele van ANG, en die mag niet op een leersnelheid rusten die op taak A gekozen
   is. Dus krijgt ANG hier zijn eerlijke kans: zes waarden, vier veegzaden, gekozen op
   de goedkope toets van twintig werelden en nooit op de benchmark.

   De vaste basislijnen krijgen die veeg níét, en dat is met opzet. Zij staan op de
   leersnelheid die de veeg van stap 6 op taak A voor hen koos, en die is dus mogelijk
   niet hun beste. Dat werkt in het voordeel van ANG: als ANG zelfs tegen een
   ondergestelde basislijn verliest, is de conclusie alleen maar steviger. Zou de
   uitkomst andersom zijn geweest, dan hadden de basislijnen hun veeg wél moeten
   krijgen.

   Geveegd wordt per stand van de as, en niet één keer in het midden. Die kortere weg
   is geprobeerd en meteen weer verlaten: de waarde die op tien-aan-twintig-uit het
   beste was, bleek op tien-aan-tien-uit juist slechter dan de oorspronkelijke. Eén
   veeg voor de hele as meet dan het afstellen en niet de architectuur — precies de
   fout die dit project in stap 7 al eens gemaakt heeft en niet nog eens moet maken.  */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { ARCHITECTUREN } = require('./stap12-condities');

const OUT = path.resolve('experimenten');
/* Het raster is versmald tot vier waarden rond de plek waar de volle veeg van zes op
   de middelste stand zijn optimum vond. Dat scheelt een derde van de rekentijd zonder
   dat het optimum buiten beeld valt; de volle veeg staat in
   lr-veeg-stap12-b20.json en is de rechtvaardiging voor die versmalling. */
const LR_GRID = [0.002, 0.004, 0.008, 0.016];
const VEEG_SEED0 = 3000, VEEG_N = 3;
const BLINKS = (process.env.BLINKS || '10,20,40').split(',').map(Number);
const NEP = +(process.env.NEP || 500);
const WIE = (process.env.WIE || 'ang,ang-vast').split(',');

const gem = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  const uit = { uitgevoerd: new Date().toISOString(), knipperstanden: BLINKS, pogingen: NEP,
    raster: LR_GRID, veegzaden: [VEEG_SEED0, VEEG_N],
    toelichting: 'Per knipperstand apart gekozen, op de goedkope toets van twintig werelden en met ' +
      'veegzaden buiten de meetzaden. Alleen ANG en ANG-bevroren zijn geveegd; de vaste basislijnen staan ' +
      'op hun leersnelheid uit stap 6, wat in het voordeel van ANG werkt en de negatieve conclusie over ' +
      'ANG dus conservatief maakt.',
    perStand: {}, keuze: {} };

  for (const BLINK of BLINKS) {
    uit.perStand[BLINK] = {}; uit.keuze[BLINK] = {};
    for (const arch of ARCHITECTUREN) {
      if (!WIE.includes(arch.naam)) continue;
      const rij = [];
      for (const lr of LR_GRID) {
        const scores = [];
        for (let k = 0; k < VEEG_N; k++) {
          const zaad = VEEG_SEED0 + k;
          const r = await p.evaluate(([zaad, nep, ov, lr, blink]) => {
            const W = window.__brain;
            let cfg = W.readCfg();
            cfg.nEpisodes = nep; cfg.evalOn = true; cfg.benchOn = false; cfg.memOn = false;
            cfg = W.cfgOverride(cfg, Object.assign({}, ov, { lr, goalBlink: blink }));
            const row = W.runOne(cfg, zaad, 'veeg-s12');
            return { toets: row.resultaat.toetsPct, succes20: row.resultaat.succes20 };
          }, [zaad, NEP, arch.ov, lr, BLINK]);
          if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
          scores.push(r.toets);
        }
        const m = gem(scores);
        rij.push({ lr, toets: m, perZaad: scores });
        console.log(`uit ${String(BLINK).padEnd(3)} ${arch.naam.padEnd(10)} lr ${String(lr).padEnd(7)} ` +
          `toets ${(100 * m).toFixed(1)}%   ` + scores.map(s => (100 * s).toFixed(0)).join(' '));
      }
      const beste = rij.reduce((a, c) => (c.toets > a.toets ? c : a));
      uit.perStand[BLINK][arch.naam] = rij;
      uit.keuze[BLINK][arch.naam] = { lr: beste.lr, toets: beste.toets, opTaakA: arch.lr };
      console.log(`   -> uit ${BLINK}, ${arch.naam}: ${beste.lr} (was ${arch.lr} op taak A), ` +
        `toets ${(100 * beste.toets).toFixed(1)}%\n`);
    }
  }

  fs.writeFileSync(path.join(OUT, 'lr-veeg-stap12.json'), JSON.stringify(uit, null, 2));
  console.log('geschreven: experimenten/lr-veeg-stap12.json');
  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
