/* Stap 4 — de vaste benchmarkset, beide beleidsvormen, en de onzekerheid erbij.
   Wat dit script doet:
     1. schrijft de benchmarkset weg als bestand, zodat zij niet alleen in code bestaat;
     2. meet de twee ijkpunten erop: een willekeurig beleid (de vloer) en de reactieve
        agent (de ondergrens waar leren bovenuit moet komen);
     3. draait de standaardconditie over 16 zaden, met de benchmark in beide
        beleidsvormen aan het eind van elke run;
     4. zet er intervallen omheen en toetst de twee beleidsvormen tegen elkaar;
     5. laat zien wat twintig toetswerelden aan onzekerheid overhouden tegenover
        vijfhonderd — de reden dat deze stap er is.
   Draaitijd ongeveer tien minuten.                                             */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

const OUT = path.resolve('experimenten');
const NSEEDS = +(process.env.NSEEDS || 16);
const NEP = +(process.env.NEP || 500);
const SEED0 = +(process.env.SEED0 || 1000);
const BENCHN = +(process.env.BENCHN || 500);
const BENCHREPS = +(process.env.BENCHREPS || 3);
const CONDITIE = process.env.CONDITIE || 'benchmark-standaard';

const mci = xs => {
  const v = xs.filter(x => x !== null && x !== undefined && isFinite(x));
  const n = v.length; if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, m, sd, ci: 1.96 * sd / Math.sqrt(n) };
};
const f3 = o => o ? `${(100 * o.m).toFixed(1)}% ± ${(100 * o.ci).toFixed(1)}` : '–';

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  fs.mkdirSync(path.join(OUT, 'runs'), { recursive: true });

  /* ---------- 1. de benchmarkset als bestand ---------- */
  const set = await p.evaluate(N => {
    const W = window.__brain;
    const ws = W.benchmarkWorlds(N);
    return {
      werelden: ws.map(w => ({
        zaad: w.seed,
        start: { x: +w.start.x.toFixed(4), y: +w.start.y.toFixed(4) },
        doel: { x: +w.goal.x.toFixed(4), y: +w.goal.y.toFixed(4) },
        richting: w.richting,
        obstakels: w.obs.map(o => [+o.x.toFixed(4), +o.y.toFixed(4), +o.w.toFixed(4), +o.h.toFixed(4)])
      })),
      bench: W.BENCH
    };
  }, BENCHN);
  const som = set.werelden.map(w => w.zaad + ':' + w.start.x + ',' + w.start.y + ':' +
    w.doel.x + ',' + w.doel.y + ':' + w.obstakels.map(o => o.join('/')).join(';')).join('|');
  let h = 5381; for (let i = 0; i < som.length; i++) h = ((h * 33) ^ som.charCodeAt(i)) >>> 0;
  const setBestand = {
    beschrijving: 'De vaste benchmarkset van de Basic Brain Test. Vijfhonderd werelden uit een ' +
      'eigen zaadreeks, los van de trainingswerelden en van de twintig toetswerelden die tijdens ' +
      'het leren meelopen. Deze verzameling wordt nooit gebruikt om instellingen te kiezen. ' +
      'De pagina maakt de werelden op commando opnieuw uit dezelfde zaden; dit bestand legt vast ' +
      'wat daar uit hoort te komen, zodat een afwijking opvalt.',
    gemaakt: new Date().toISOString(),
    aantal: set.werelden.length, obstakels: set.bench.OBS,
    zaadreeks: { eerste: set.bench.SEED0, stap: set.bench.STRIDE },
    controlegetal: h,
    werelden: set.werelden
  };
  fs.writeFileSync(path.join(OUT, 'benchmark-werelden.json'), JSON.stringify(setBestand, null, 1));
  console.log(`benchmarkset weggeschreven: ${set.werelden.length} werelden, controlegetal ${h}`);

  /* ---------- 2. de twee ijkpunten ---------- */
  const ijk = await p.evaluate(([N]) => {
    const W = window.__brain, S = W.S;
    S.cfg = W.readCfg();
    const re = W.benchReactief(N);
    const rnd = W.mulberry32(12345);
    const wil = W.playWorlds(W.benchmarkWorlds(N), 1, () => {
      const c = S.cfg, w = S.world, d = W.DIRV[Math.floor(rnd() * 8)];
      const mag = Math.hypot(d[0], d[1]);
      W.moveAgent(d[0] / mag * c.chSpeed, d[1] / mag * c.chSpeed, mag, w);
      const dist = Math.hypot(w.goal.x - S.ag.x, w.goal.y - S.ag.y);
      S.step++;
      if (dist < 3.4 + 1.7) { S.reached = true; return true; }
      return S.step >= c.maxSteps;
    }, 777);
    /* dezelfde reactieve agent op de twintig toetswerelden — het verschil met de
       benchmark laat zien hoeveel een meting op twintig werelden waard is */
    const toets = []; for (let k = 0; k < W.EVAL_WORLDS; k++) toets.push(W.makeWorld(900000 + k * 37, 7));
    const re20 = W.playWorlds(toets, 1, W.reactiefTick, W.BENCH.RNG);
    return { reactief: { pct: re.pct, ci: re.ci, gemStappen: re.gemStappen, werelden: re.werelden },
      willekeurig: { pct: wil.pct, ci: wil.ci, werelden: wil.werelden },
      reactiefOp20: { pct: re20.pct, ci: re20.ci, werelden: re20.werelden } };
  }, [BENCHN]);
  console.log(`ijkpunten: willekeurig ${(100 * ijk.willekeurig.pct).toFixed(1)}%, ` +
    `reactief ${(100 * ijk.reactief.pct).toFixed(1)}% ± ${(100 * ijk.reactief.ci).toFixed(1)} ` +
    `(op 20 toetswerelden: ${(100 * ijk.reactiefOp20.pct).toFixed(1)}% ± ${(100 * ijk.reactiefOp20.ci).toFixed(1)})`);

  /* ---------- 3. runs.csv klaarzetten; de kolommen zijn uitgebreid ---------- */
  const hdr = await p.evaluate(() => window.__brain.CSV_COLS.join(','));
  const csvPad = path.join(OUT, 'runs.csv');
  let lines = fs.existsSync(csvPad) ? fs.readFileSync(csvPad, 'utf8').trim().split(/\r?\n/) : [hdr];
  if (lines[0] !== hdr) {
    const oud = lines[0].split(',');
    const nieuw = hdr.split(',');
    const zelfdeKop = oud.every((k, i) => nieuw[i] === k);
    if (!zelfdeKop) throw new Error('runs.csv heeft kolommen die niet vooraan in de nieuwe kop staan; ' +
      'niet automatisch bij te werken');
    const erbij = nieuw.length - oud.length;
    lines = [hdr].concat(lines.slice(1).map(r => r + ','.repeat(erbij)));
    fs.writeFileSync(csvPad, lines.join('\n') + '\n');
    console.log(`runs.csv bijgewerkt: ${erbij} kolommen erbij, ${lines.length - 1} bestaande regels ` +
      'houden daar een lege waarde — die runs zijn niet op de benchmark gemeten.');
  }

  /* ---------- 4. de reeks ---------- */
  const per = [];
  for (let k = 0; k < NSEEDS; k++) {
    const zaad = SEED0 + k, t0 = Date.now();
    const r = await p.evaluate(([zaad, nep, naam, bn, br]) => {
      const W = window.__brain;
      const cfg = W.readCfg();
      cfg.nEpisodes = nep; cfg.evalOn = true;
      cfg.benchOn = true; cfg.benchN = bn; cfg.benchReps = br;
      const row = W.runOne(cfg, zaad, naam);
      return { csv: W.csvRow(row), json: row };
    }, [zaad, NEP, CONDITIE, BENCHN, BENCHREPS]);
    if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
    lines.push(r.csv);
    fs.writeFileSync(csvPad, lines.join('\n') + '\n');
    fs.writeFileSync(path.join(OUT, 'runs', `${CONDITIE}_z${zaad}.json`), JSON.stringify(r.json, null, 2));
    const res = r.json.resultaat, bm = r.json.benchmark;
    per.push({ zaad, succes20: res.succes20, toets20: res.toetsPct, toets20streng: res.toetsStreng,
      benchBeleid: bm.beleid.pct, benchBeleidCI: bm.beleid.ci, benchStreng: bm.streng.pct,
      benchStrengCI: bm.streng.ci, benchStappen: bm.beleid.gemStappen,
      actief: r.json.structuur.actieveVerbindingen, reflex: r.json.structuur.reflexbogen,
      perWereldBeleid: bm.beleid.perWereld });
    console.log(`zaad ${zaad}: laatste20 ${(100 * res.succes20).toFixed(0)}%  ` +
      `toets20 ${(100 * res.toetsPct).toFixed(0)}%  benchmark ${(100 * bm.beleid.pct).toFixed(1)}% ` +
      `± ${(100 * bm.beleid.ci).toFixed(1)}  argmax ${(100 * bm.streng.pct).toFixed(1)}%  ` +
      `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }

  /* ---------- 5. statistiek ---------- */
  const stat = await p.evaluate(([A, B]) => window.__brain.mannWhitney(A, B),
    [per.map(r => r.benchBeleid), per.map(r => r.benchStreng)]);
  const maten = {};
  for (const [naam, sleutel] of [['succes laatste 20', 'succes20'], ['toets, 20 werelden', 'toets20'],
    ['toets streng, 20 werelden', 'toets20streng'], ['benchmark geloot', 'benchBeleid'],
    ['benchmark argmax', 'benchStreng']]) {
    maten[sleutel] = { naam, overZaden: mci(per.map(r => r[sleutel])) };
  }
  const gepaard = mci(per.map(r => r.benchStreng - r.benchBeleid));
  /* Hoeveel onzekerheid houd je over per meting? Het interval binnen één run over de
     werelden, tegenover het interval van dezelfde run op twintig werelden. */
  const binnenRun = mci(per.map(r => r.benchBeleidCI));
  const toets20CI = mci(per.map(r => 1.96 * Math.sqrt(r.toets20 * (1 - r.toets20) / 20)));

  const samenvatting = {
    uitgevoerd: new Date().toISOString(),
    beschrijving: 'Werkplan stap 4: de vaste benchmarkset van ' + BENCHN + ' werelden, elke wereld ' +
      BENCHREPS + ' keer gespeeld met het geleerde (gelote) beleid en één keer met argmax. ' +
      'Zestien breinzaden op de standaardconditie. De intervallen binnen een run gaan over de ' +
      'werelden, de intervallen over de reeks gaan over de zaden — dat zijn twee verschillende ' +
      'onzekerheden en ze horen apart gerapporteerd te worden.',
    conditie: CONDITIE, zaden: NSEEDS, eersteZaad: SEED0, pogingenPerRun: NEP,
    benchmark: { werelden: BENCHN, herhalingen: BENCHREPS, obstakels: 7, controlegetal: h },
    ijkpunten: ijk,
    maten, verschilArgmaxMinGeloot: gepaard, mannWhitney: stat,
    onzekerheidPerMeting: { benchmarkBinnenRun: binnenRun, toets20Binomiaal: toets20CI },
    perZaad: per.map(r => { const q = Object.assign({}, r); delete q.perWereldBeleid; return q; })
  };
  fs.writeFileSync(path.join(OUT, 'benchmark.json'), JSON.stringify(samenvatting, null, 2));

  console.log('\n--- samenvatting over ' + NSEEDS + ' zaden ---');
  for (const k of Object.keys(maten)) console.log(`  ${maten[k].naam.padEnd(26)} ${f3(maten[k].overZaden)}`);
  console.log(`  ${'ijkpunt reactief'.padEnd(26)} ${(100 * ijk.reactief.pct).toFixed(1)}% ± ${(100 * ijk.reactief.ci).toFixed(1)}`);
  console.log(`  ${'ijkpunt willekeurig'.padEnd(26)} ${(100 * ijk.willekeurig.pct).toFixed(1)}%`);
  console.log(`\nargmax min geloot (gepaard): ${(100 * gepaard.m).toFixed(1)} ± ${(100 * gepaard.ci).toFixed(1)} pp` +
    (stat ? `  ·  Mann-Whitney p = ${stat.p.toFixed(3)} → ${stat.oordeel}` : '  (te weinig zaden om te toetsen)'));
  console.log(`onzekerheid van één meting: benchmark ± ${(100 * binnenRun.m).toFixed(1)} pp, ` +
    `twintig werelden ± ${(100 * toets20CI.m).toFixed(1)} pp`);
  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
