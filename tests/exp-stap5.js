/* Stap 5 — basislijnen binnen dezelfde leerregel.
   De vraag: draagt de graafstructuur iets bij, of doet de leerregel al het werk?
   Om dat te scheiden draaien hier vier condities met exact dezelfde leerregel,
   dezelfde spelregels, dezelfde wereldzaden en dezelfde benchmark:

     ang-vol      de wolk zoals zij is (overgenomen uit de reeks van stap 4)
     ang-vast     dezelfde wolk, maar met de structurele plasticiteit uit
     gelaagd-*    een vaste stapel lagen, ook zonder plasticiteit

   ang-vast tegen gelaagd isoleert de topologie: beide staan vast, alleen de
   bedrading verschilt. ang-vol tegen ang-vast isoleert de plasticiteit. De twee
   vaste beleidsvormen uit stap 4 (willekeurig en reactief) komen er als vloer
   onder te staan.
   Draaitijd ongeveer twaalf minuten.                                            */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

const OUT = path.resolve('experimenten');
const NSEEDS = +(process.env.NSEEDS || 16);
const NEP = +(process.env.NEP || 500);
const SEED0 = +(process.env.SEED0 || 1000);
const BENCHN = +(process.env.BENCHN || 500);
const BENCHREPS = +(process.env.BENCHREPS || 3);

/* Het parameterbudget van de wolk, afgelezen uit de reeks van stap 4 en niet
   met de hand ingevuld: een basislijn met een ander budget meet iets anders. */
const CONDITIES = [
  { naam: 'ang-vast', ov: { structOn: false, growOn: false, retypeOn: false } },
  { naam: 'gelaagd-1x150', ov: { layered: true, layerSizes: [150], structOn: false, growOn: false, retypeOn: false } },
  { naam: 'gelaagd-2x46', ov: { layered: true, layerSizes: [46, 46], structOn: false, growOn: false, retypeOn: false } },
  { naam: 'gelaagd-1x60', ov: { layered: true, layerSizes: [60], structOn: false, growOn: false, retypeOn: false } }
];

const mci = xs => {
  const v = xs.filter(x => x !== null && x !== undefined && isFinite(x));
  const n = v.length; if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, m, sd, ci: 1.96 * sd / Math.sqrt(n) };
};
const f3 = o => o ? `${(100 * o.m).toFixed(1)}% ± ${(100 * o.ci).toFixed(1)}` : '–';

function leesCsv(p) {
  const L = fs.readFileSync(p, 'utf8').trim().split(/\r?\n/);
  const H = L[0].split(',');
  return L.slice(1).map(l => {
    const c = l.split(','), o = {};
    H.forEach((k, i) => { const v = (c[i] || ''); o[k] = (v !== '' && !isNaN(+v)) ? +v : v; });
    return o;
  });
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  fs.mkdirSync(path.join(OUT, 'runs'), { recursive: true });

  const hdr = await p.evaluate(() => window.__brain.CSV_COLS.join(','));
  const csvPad = path.join(OUT, 'runs.csv');
  let lines = fs.readFileSync(csvPad, 'utf8').trim().split(/\r?\n/);
  if (lines[0] !== hdr) throw new Error('runs.csv heeft andere kolommen dan de pagina');

  /* de wolkconditie komt uit stap 4; die draaien we niet opnieuw */
  const ANG = leesCsv(csvPad).filter(r => r.conditie === 'benchmark-standaard');
  if (!ANG.length) throw new Error('geen runs van de conditie benchmark-standaard gevonden');
  console.log(`referentie ang-vol: ${ANG.length} runs uit stap 4, ` +
    `${(100 * mci(ANG.map(r => r.benchBeleid)).m).toFixed(1)}% op de benchmark, ` +
    `${Math.round(mci(ANG.map(r => r.verbindingen)).m)} verbindingen`);

  const per = { 'ang-vol': ANG.map(r => ({
    zaad: r.breinZaad, succes20: r.succes20, toets20: r.toetsPct,
    benchBeleid: r.benchBeleid, benchStreng: r.benchStreng, benchStappen: r.benchStappen,
    verbindingen: r.verbindingen, actief: r.actieveVerbindingen, neuronen: r.neuronenEind,
    pad: r.kortstePad, lussen: r.lussen, reflex: r.reflexbogen, tijdMs: r.rekentijdMs
  })) };

  /* Hervatbaar: een reeks van vier condities duurt langer dan een sessie soms toestaat,
     dus wat al in runs.csv staat wordt overgenomen in plaats van overgedaan. Met
     ALLEEN=<naam> draait één conditie. */
  const ALLEEN = process.env.ALLEEN ? process.env.ALLEEN.split(',') : null;
  const AL = leesCsv(csvPad);
  const uitCsv = r => ({ zaad: r.breinZaad, succes20: r.succes20, toets20: r.toetsPct,
    benchBeleid: r.benchBeleid, benchStreng: r.benchStreng, benchStappen: r.benchStappen,
    verbindingen: r.verbindingen, actief: r.actieveVerbindingen, neuronen: r.neuronenEind,
    pad: r.kortstePad, lussen: r.lussen, reflex: r.reflexbogen, tijdMs: r.rekentijdMs });

  for (const cond of CONDITIES) {
    const gedaan = new Map(AL.filter(r => r.conditie === cond.naam).map(r => [r.breinZaad, uitCsv(r)]));
    per[cond.naam] = [];
    for (let k = 0; k < NSEEDS; k++) {
      const zaad = SEED0 + k, t0 = Date.now();
      if (gedaan.has(zaad)) { per[cond.naam].push(gedaan.get(zaad)); continue; }
      if (ALLEEN && !ALLEEN.includes(cond.naam)) continue;
      const r = await p.evaluate(([zaad, nep, naam, ov, bn, br]) => {
        const W = window.__brain;
        let cfg = W.readCfg();
        cfg.nEpisodes = nep; cfg.evalOn = true;
        cfg.benchOn = true; cfg.benchN = bn; cfg.benchReps = br;
        cfg = W.cfgOverride(cfg, ov);
        const row = W.runOne(cfg, zaad, naam);
        return { csv: W.csvRow(row), json: row };
      }, [zaad, NEP, cond.naam, cond.ov, BENCHN, BENCHREPS]);
      if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
      lines.push(r.csv);
      fs.writeFileSync(csvPad, lines.join('\n') + '\n');
      fs.writeFileSync(path.join(OUT, 'runs', `${cond.naam}_z${zaad}.json`), JSON.stringify(r.json, null, 2));
      const res = r.json.resultaat, st = r.json.structuur, bm = r.json.benchmark;
      per[cond.naam].push({ zaad, succes20: res.succes20, toets20: res.toetsPct,
        benchBeleid: bm.beleid.pct, benchStreng: bm.streng.pct, benchStappen: bm.beleid.gemStappen,
        verbindingen: st.verbindingen, actief: st.actieveVerbindingen,
        neuronen: r.json.config.neuronenNu, pad: st.kortstePad, lussen: st.lussen,
        reflex: st.reflexbogen, tijdMs: res.rekentijdMs });
      console.log(`${cond.naam.padEnd(14)} zaad ${zaad}: laatste20 ${(100 * res.succes20).toFixed(0)}%  ` +
        `benchmark ${(100 * bm.beleid.pct).toFixed(1)}%  argmax ${(100 * bm.streng.pct).toFixed(1)}%  ` +
        `verb ${st.verbindingen}  pad ${st.kortstePad}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }

  /* ---------- statistiek ---------- */
  /* Een conditie die deze keer niet aan de beurt was (ALLEEN=...) telt niet mee. */
  const namen = Object.keys(per).filter(n => per[n].length);
  const maten = ['succes20', 'toets20', 'benchBeleid', 'benchStreng', 'benchStappen',
    'verbindingen', 'actief', 'neuronen', 'pad', 'lussen', 'reflex', 'tijdMs'];
  const tabel = {};
  for (const naam of namen) {
    tabel[naam] = { runs: per[naam].length };
    for (const m of maten) tabel[naam][m] = mci(per[naam].map(r => r[m]));
  }
  /* elke conditie tegen de wolk, en gelaagd tegen de bevroren wolk: dat tweede
     paar is de eigenlijke vraag, want daar staat alleen de topologie nog open */
  const toets = async (a, bnaam, maat) => {
    const st = await p.evaluate(([A, B]) => window.__brain.mannWhitney(A, B),
      [per[a].map(r => r[maat]), per[bnaam].map(r => r[maat])]);
    const dA = mci(per[a].map(r => r[maat])), dB = mci(per[bnaam].map(r => r[maat]));
    return st ? { tegen: a, conditie: bnaam, maat, verschilPp: 100 * (dB.m - dA.m),
      U: st.U, p: st.p, oordeel: st.oordeel } : null;
  };
  const toetsen = [];
  for (const naam of namen) if (naam !== 'ang-vol') toetsen.push(await toets('ang-vol', naam, 'benchBeleid'));
  for (const naam of namen) if (naam.startsWith('gelaagd')) toetsen.push(await toets('ang-vast', naam, 'benchBeleid'));

  const IJK = fs.existsSync(path.join(OUT, 'benchmark.json'))
    ? JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark.json'), 'utf8')).ijkpunten : null;

  const samenvatting = {
    uitgevoerd: new Date().toISOString(),
    beschrijving: 'Werkplan stap 5: basislijnen binnen dezelfde leerregel. Alle condities gebruiken exact ' +
      'dezelfde knoop-update, node-perturbatie, sporen, basislijn, begrensde stap en vervaging, dezelfde ' +
      'wereldzaden en dezelfde benchmarkset; alleen de structuur verschilt. ang-vol is de wolk zoals zij is ' +
      '(overgenomen uit de reeks van stap 4), ang-vast dezelfde wolk met de structurele plasticiteit uit, en ' +
      'de gelaagde condities zijn vaste stapels lagen met een vergelijkbaar parameterbudget. ' +
      'ang-vast tegen gelaagd isoleert de topologie, ang-vol tegen ang-vast de plasticiteit.',
    zaden: NSEEDS, eersteZaad: SEED0, pogingenPerRun: NEP,
    benchmark: { werelden: BENCHN, herhalingen: BENCHREPS },
    vasteBeleidsvormen: IJK ? { willekeurig: IJK.willekeurig, reactief: IJK.reactief } : null,
    tabel, toetsen, perZaad: per
  };
  fs.writeFileSync(path.join(OUT, 'basislijnen.json'), JSON.stringify(samenvatting, null, 2));

  console.log('\n--- basislijnen, ' + NSEEDS + ' zaden per conditie ---');
  console.log('conditie'.padEnd(15) + 'benchmark'.padEnd(18) + 'argmax'.padEnd(18) +
    'laatste 20'.padEnd(18) + 'verb.'.padEnd(8) + 'pad');
  for (const naam of namen) {
    const t = tabel[naam];
    console.log(naam.padEnd(15) + f3(t.benchBeleid).padEnd(18) + f3(t.benchStreng).padEnd(18) +
      f3(t.succes20).padEnd(18) + String(Math.round(t.verbindingen.m)).padEnd(8) + t.pad.m.toFixed(2));
  }
  if (IJK) console.log('reactief'.padEnd(15) + `${(100 * IJK.reactief.pct).toFixed(1)}% ± ${(100 * IJK.reactief.ci).toFixed(1)}`.padEnd(18) +
    '(vast beleid)'.padEnd(18) + '-'.padEnd(18) + '-'.padEnd(8) + '-');
  console.log('\n--- Mann-Whitney U op de benchmarkscore ---');
  for (const t of toetsen) if (t) console.log(`${t.conditie.padEnd(15)} tegen ${t.tegen.padEnd(10)} ` +
    `${(t.verschilPp >= 0 ? '+' : '') + t.verschilPp.toFixed(1)} pp   p = ${t.p.toFixed(4)}   ${t.oordeel}`);
  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
