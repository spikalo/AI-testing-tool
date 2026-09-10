/* Stap 7a — de leersnelheidsveeg voor de varianten van de leerregel.

   Dezelfde regel als in stap 6, en om dezelfde reden: een variant die op een
   geleende leersnelheid draait, verliest van de conditie waar die leersnelheid voor
   afgesteld is, en dan meet je het afstellen in plaats van de variant. De criticus
   verandert de schaal van het leersignaal (een TD-fout is iets anders dan
   r − r̄), schaarse perturbatie verandert hoeveel gewichten er per tik een duw
   krijgen, het categorische beleid verandert de vorm van de score-functie, en
   perturbGain verandert de schaal van het wolkdeel met een factor tien. Alle vier
   raken ze dus precies het getal waar η op afgesteld is.

   Twee dingen die deze veeg eerlijk houden:
     · de benchmark van 500 werelden staat uit — die is de meetlat van het paper en
       mag geen instellingen kiezen;
     · de veegzaden (3000-3003) liggen buiten de meetzaden (1000-1011).

   Hervatbaar: wat al in het uitvoerbestand staat wordt niet opnieuw gedraaid.
   ALLEEN=<naam>[,<naam>] doet één of enkele condities.                            */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { CONDITIES, rasterVoor, VEEG_SEED0, VEEG_N } = require('./stap7-condities');

const UIT = path.resolve('experimenten/lr-veeg-stap7.json');
const NEP = +(process.env.NEP || 500);
const ALLEEN = process.env.ALLEEN ? process.env.ALLEEN.split(',') : null;

const gem = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = xs => xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - gem(xs)) ** 2, 0) / (xs.length - 1)) : 0;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  const opgeslagen = fs.existsSync(UIT) ? JSON.parse(fs.readFileSync(UIT, 'utf8')) : { runs: [] };
  const gedaan = new Map(opgeslagen.runs.map(r => [`${r.conditie}|${r.lr}|${r.zaad}`, r]));
  const runs = opgeslagen.runs.slice();

  function keuzes() {
    const uit = {};
    for (const cond of CONDITIES) {
      const mijn = runs.filter(r => r.conditie === cond.naam);
      if (!mijn.length) continue;
      const per = rasterVoor(cond.naam).map(lr => {
        const v = mijn.filter(r => r.lr === lr).map(r => r.toets).filter(x => x !== null && x !== undefined);
        return v.length ? { lr, n: v.length, toets: gem(v), sd: sd(v) } : null;
      }).filter(Boolean);
      if (!per.length) continue;
      const best = per.slice().sort((a, b) => b.toets - a.toets)[0];
      uit[cond.naam] = { lr: best.lr, toets: best.toets, perLeersnelheid: per };
    }
    return uit;
  }
  const bewaar = () => fs.writeFileSync(UIT, JSON.stringify(
    { uitgevoerd: new Date().toISOString(), pogingenPerRun: NEP,
      rasters: Object.fromEntries(CONDITIES.map(c => [c.naam, rasterVoor(c.naam)])),
      veegZaden: Array.from({ length: VEEG_N }, (_, k) => VEEG_SEED0 + k),
      gekozenOp: 'toets op 20 onbekende werelden; de benchmark van 500 werelden is hier uit',
      keuze: keuzes(), runs }, null, 2));

  for (const cond of CONDITIES) {
    if (ALLEEN && !ALLEEN.includes(cond.naam)) continue;
    for (const lr of rasterVoor(cond.naam)) {
      for (let k = 0; k < VEEG_N; k++) {
        const zaad = VEEG_SEED0 + k;
        const sleutel = `${cond.naam}|${lr}|${zaad}`;
        if (gedaan.has(sleutel)) continue;
        const t0 = Date.now();
        const r = await p.evaluate(([zaad, nep, ov, lr]) => {
          const W = window.__brain;
          let cfg = W.readCfg();
          cfg.nEpisodes = nep; cfg.evalOn = true; cfg.benchOn = false;
          cfg = W.cfgOverride(cfg, Object.assign({}, ov, { lr }));
          const row = W.runOne(cfg, zaad, 'veeg7');
          return { toets: row.resultaat.toetsPct, streng: row.resultaat.toetsStreng,
            s20: row.resultaat.succes20, ms: row.resultaat.rekentijdMs,
            actief: row.structuur.actieveVerbindingen };
        }, [zaad, NEP, cond.ov, lr]);
        if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
        const rij = { conditie: cond.naam, lr, zaad, ...r };
        runs.push(rij); gedaan.set(sleutel, rij); bewaar();
        console.log(`${cond.naam.padEnd(22)} lr ${String(lr).padEnd(8)} zaad ${zaad}: ` +
          `toets ${(100 * r.toets).toFixed(0)}%  laatste20 ${(100 * r.s20).toFixed(0)}%  ` +
          `actief ${r.actief}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      }
    }
  }
  bewaar();

  const K = keuzes();
  console.log('\n--- gekozen leersnelheid per conditie (op de goedkope toets van 20 werelden) ---');
  for (const cond of CONDITIES) {
    const k = K[cond.naam]; if (!k) continue;
    const rij = k.perLeersnelheid.map(c => `${c.lr}:${(100 * c.toets).toFixed(0)}%`).join('  ');
    console.log(cond.naam.padEnd(22) + rij + '   → ' + k.lr);
  }
  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
