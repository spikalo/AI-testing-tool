/* Stap 6a — de leersnelheidsveeg.

   Een vergelijking tussen twee leerregels is waardeloos als de ene op zijn eigen
   uitgemeten leersnelheid draait en de andere op een geleende. ANG's 0,008 is met
   de hand afgesteld op ANG; er is geen enkele reden waarom terugpropagatie op
   precies datzelfde getal zijn beste werk zou doen — de exacte gradiënt heeft een
   andere grootte dan een perturbatieschatting. Daarom krijgt elke conditie dezelfde
   behandeling: zes leersnelheden, vier zaden per leersnelheid, gekozen op de
   goedkope toets van twintig onbekende werelden.

   Twee dingen die deze veeg eerlijk houden:
     · de benchmark van 500 werelden staat uit. Die is de meetlat van het paper en
       mag geen instellingen kiezen, anders meet zij straks haar eigen keuze terug.
     · de veegzaden (2000-2003) liggen buiten de meetzaden (1000-1015). Kies je op
       dezelfde zaden waarop je meet, dan kies je de zaden waarop het toevallig goed
       ging en rapporteer je ruis als resultaat.

   Hervatbaar: wat al in het uitvoerbestand staat wordt niet opnieuw gedraaid.
   ALLEEN=<naam>[,<naam>] doet één of enkele condities.                            */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { CONDITIES, LR_GRID, VEEG_SEED0, VEEG_N } = require('./stap6-condities');

const UIT = path.resolve('experimenten/lr-veeg-stap6.json');
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
  const bewaar = () => fs.writeFileSync(UIT, JSON.stringify(
    { uitgevoerd: new Date().toISOString(), pogingenPerRun: NEP, leersnelheden: LR_GRID,
      veegZaden: Array.from({ length: VEEG_N }, (_, k) => VEEG_SEED0 + k),
      gekozenOp: 'toets op 20 onbekende werelden; de benchmark van 500 werelden is hier uit',
      keuze: keuzes(), runs }, null, 2));

  function keuzes() {
    const uit = {};
    for (const cond of CONDITIES) {
      const mijn = runs.filter(r => r.conditie === cond.naam);
      if (!mijn.length) continue;
      const per = LR_GRID.map(lr => {
        const v = mijn.filter(r => r.lr === lr).map(r => r.toets).filter(x => x !== null && x !== undefined);
        return v.length ? { lr, n: v.length, toets: gem(v), sd: sd(v) } : null;
      }).filter(Boolean);
      if (!per.length) continue;
      const best = per.slice().sort((a, b) => b.toets - a.toets)[0];
      uit[cond.naam] = { lr: best.lr, toets: best.toets, perLeersnelheid: per };
    }
    return uit;
  }

  for (const cond of CONDITIES) {
    if (ALLEEN && !ALLEEN.includes(cond.naam)) continue;
    for (const lr of LR_GRID) {
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
          const row = W.runOne(cfg, zaad, 'veeg');
          return { toets: row.resultaat.toetsPct, streng: row.resultaat.toetsStreng,
            s20: row.resultaat.succes20, ms: row.resultaat.rekentijdMs,
            kb: row.resultaat.rekenkosten.kantenBezoekenLeerStap };
        }, [zaad, NEP, cond.ov, lr]);
        if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
        const rij = { conditie: cond.naam, lr, zaad, ...r };
        runs.push(rij); gedaan.set(sleutel, rij); bewaar();
        console.log(`${cond.naam.padEnd(18)} lr ${String(lr).padEnd(6)} zaad ${zaad}: ` +
          `toets ${(100 * r.toets).toFixed(0)}%  laatste20 ${(100 * r.s20).toFixed(0)}%  ` +
          `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      }
    }
  }
  bewaar();

  const K = keuzes();
  console.log('\n--- gekozen leersnelheid per conditie (op de goedkope toets) ---');
  console.log('conditie'.padEnd(20) + LR_GRID.map(l => String(l).padStart(8)).join('') + '   keuze');
  for (const cond of CONDITIES) {
    const k = K[cond.naam]; if (!k) continue;
    const rij = LR_GRID.map(l => {
      const c = k.perLeersnelheid.find(x => x.lr === l);
      return (c ? (100 * c.toets).toFixed(0) + '%' : '-').padStart(8);
    }).join('');
    console.log(cond.naam.padEnd(20) + rij + '   ' + k.lr);
  }
  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
