/* Stap 6b — backprop-basislijnen en de rekenkostentabel.

   Twee dingen die de kritiek terecht mist, in één reeks omdat ze dezelfde
   meetopstelling delen.

   (a) Wat geef je op door géén backpropagation te gebruiken? Elk gelaagd net draait
       twee keer: één keer met node-perturbatie (zoals ANG) en één keer met de
       exacte gradiënt. Alles daaromheen is identiek, tot en met het startbrein, en
       elke conditie draait op de leersnelheid die de veeg van stap 6a voor háár
       gekozen heeft. Wat overblijft is de schatter.

   (b) De paper praatte over efficiëntie zonder te tellen. Vier grootheden die
       allemaal zo heten en zelden hetzelfde zijn: wat een spelstap kost tijdens het
       leren, wat hij kost bij inferentie, hoeveel omgevingsstappen er nodig waren
       om 80 % te halen, en hoeveel rekenwerk dat bij elkaar was. Een net dat drie
       keer zo veel werk nodig heeft om te leren maar daarna vier keer goedkoper
       draait is een interessant resultaat — maar alleen als die kolommen apart in
       de tabel staan.

   Hervatbaar: wat al in runs.csv staat wordt overgenomen in plaats van overgedaan.
   ALLEEN=<naam>[,<naam>] draait één of enkele condities.                          */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { CONDITIES, MEET_SEED0, MEET_N } = require('./stap6-condities');

const OUT = path.resolve('experimenten');
const NSEEDS = +(process.env.NSEEDS || MEET_N);
const NEP = +(process.env.NEP || 500);
const SEED0 = +(process.env.SEED0 || MEET_SEED0);
const BENCHN = +(process.env.BENCHN || 500);
const BENCHREPS = +(process.env.BENCHREPS || 3);
const ALLEEN = process.env.ALLEEN ? process.env.ALLEEN.split(',') : null;

const mci = xs => {
  const v = xs.filter(x => x !== null && x !== undefined && isFinite(x));
  const n = v.length; if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, m, sd, ci: 1.96 * sd / Math.sqrt(n) };
};
const pct = o => o ? `${(100 * o.m).toFixed(1)}% ± ${(100 * o.ci).toFixed(1)}` : '–';
const getal = (o, d = 0) => o ? o.m.toFixed(d) : '–';
/* Kanten-bezoeken lopen in de miljoenen; die lezen niemand als rauw getal. */
const kort = v => v === null || v === undefined || !isFinite(v) ? '–'
  : v >= 1e9 ? (v / 1e9).toFixed(1) + ' G' : v >= 1e6 ? (v / 1e6).toFixed(1) + ' M'
    : v >= 1e3 ? (v / 1e3).toFixed(1) + ' k' : String(Math.round(v));

function leesCsv(p) {
  const L = fs.readFileSync(p, 'utf8').trim().split(/\r?\n/);
  const H = L[0].split(',');
  return L.slice(1).map(l => {
    const c = l.split(','), o = {};
    H.forEach((k, i) => { const v = (c[i] || ''); o[k] = (v !== '' && !isNaN(+v)) ? +v : v; });
    return o;
  });
}
const uitCsv = r => ({
  zaad: r.breinZaad, lr: r.lr, succes20: r.succes20, toets20: r.toetsPct,
  benchBeleid: r.benchBeleid, benchStreng: r.benchStreng, benchStappen: r.benchStappen,
  verbindingen: r.verbindingen, actief: r.actieveVerbindingen, neuronen: r.neuronenEind,
  pad: r.kortstePad, tijdMs: r.rekentijdMs,
  kbLeerStap: r.kbLeerStap === '' ? null : r.kbLeerStap,
  kbInfStap: r.kbInfStap === '' ? null : r.kbInfStap,
  pogingenTot80: r.pogingenTot80 === '' ? null : r.pogingenTot80,
  stappenTot80: r.stappenTot80 === '' ? null : r.stappenTot80,
  kbTot80: r.kbTot80 === '' ? null : r.kbTot80
});

(async () => {
  const veegPad = path.join(OUT, 'lr-veeg-stap6.json');
  if (!fs.existsSync(veegPad)) throw new Error('draai eerst tests/exp-stap6-lr.js — zonder de veeg is de vergelijking niet eerlijk');
  const veeg = JSON.parse(fs.readFileSync(veegPad, 'utf8'));

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
  if (lines[0] !== hdr) throw new Error('runs.csv heeft andere kolommen dan de pagina — draai tests/migreer-runs-csv.js');

  const per = {};
  for (const cond of CONDITIES) {
    const keuze = veeg.keuze && veeg.keuze[cond.naam];
    if (!keuze) throw new Error(`geen leersnelheid gekozen voor ${cond.naam}; de veeg is nog niet af`);
    const lr = keuze.lr;
    const AL = leesCsv(csvPad);
    const gedaan = new Map(AL.filter(r => r.conditie === cond.naam && r.lr === lr).map(r => [r.breinZaad, uitCsv(r)]));
    per[cond.naam] = [];
    for (let k = 0; k < NSEEDS; k++) {
      const zaad = SEED0 + k, t0 = Date.now();
      if (gedaan.has(zaad)) { per[cond.naam].push(gedaan.get(zaad)); continue; }
      if (ALLEEN && !ALLEEN.includes(cond.naam)) continue;
      const r = await p.evaluate(([zaad, nep, naam, ov, bn, br, lr]) => {
        const W = window.__brain;
        let cfg = W.readCfg();
        cfg.nEpisodes = nep; cfg.evalOn = true;
        cfg.benchOn = true; cfg.benchN = bn; cfg.benchReps = br;
        cfg = W.cfgOverride(cfg, Object.assign({}, ov, { lr }));
        const row = W.runOne(cfg, zaad, naam);
        return { csv: W.csvRow(row), json: row };
      }, [zaad, NEP, cond.naam, cond.ov, BENCHN, BENCHREPS, lr]);
      if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
      lines.push(r.csv);
      fs.writeFileSync(csvPad, lines.join('\n') + '\n');
      fs.writeFileSync(path.join(OUT, 'runs', `${cond.naam}_z${zaad}.json`), JSON.stringify(r.json, null, 2));
      const res = r.json.resultaat, st = r.json.structuur, bm = r.json.benchmark, rk = res.rekenkosten;
      per[cond.naam].push({
        zaad, lr, succes20: res.succes20, toets20: res.toetsPct,
        benchBeleid: bm.beleid.pct, benchStreng: bm.streng.pct, benchStappen: bm.beleid.gemStappen,
        verbindingen: st.verbindingen, actief: st.actieveVerbindingen,
        neuronen: r.json.config.neuronenNu, pad: st.kortstePad, tijdMs: res.rekentijdMs,
        kbLeerStap: rk.kantenBezoekenLeerStap, kbInfStap: rk.kantenBezoekenInfStap,
        pogingenTot80: rk.pogingenTot80, stappenTot80: rk.omgevingsstappenTot80, kbTot80: rk.kantenBezoekenTot80
      });
      console.log(`${cond.naam.padEnd(18)} lr ${String(lr).padEnd(6)} zaad ${zaad}: ` +
        `benchmark ${(100 * bm.beleid.pct).toFixed(1)}%  argmax ${(100 * bm.streng.pct).toFixed(1)}%  ` +
        `laatste20 ${(100 * res.succes20).toFixed(0)}%  ` +
        `80% na ${rk.pogingenTot80 === null ? 'nooit' : rk.pogingenTot80 + ' pog.'}  ` +
        `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }

  /* ---------- statistiek ---------- */
  const namen = CONDITIES.map(c => c.naam).filter(n => per[n] && per[n].length);
  const maten = ['succes20', 'toets20', 'benchBeleid', 'benchStreng', 'benchStappen',
    'verbindingen', 'actief', 'neuronen', 'pad', 'tijdMs',
    'kbLeerStap', 'kbInfStap', 'pogingenTot80', 'stappenTot80', 'kbTot80'];
  const tabel = {};
  for (const naam of namen) {
    tabel[naam] = { runs: per[naam].length, lr: per[naam][0].lr };
    /* "80 % gehaald" is geen getal maar een gebeurtenis: bij een run die de drempel
       nooit haalt is het veld leeg, en dat mag niet stilletjes als nul meetellen.
       Daarom staat er apart bij hoeveel runs hem wél haalden. */
    tabel[naam].haalde80 = per[naam].filter(r => r.pogingenTot80 !== null && r.pogingenTot80 !== undefined).length;
    for (const m of maten) tabel[naam][m] = mci(per[naam].map(r => r[m]));
  }

  const toets = async (a, bnaam, maat) => {
    if (!per[a] || !per[bnaam] || !per[a].length || !per[bnaam].length) return null;
    const st = await p.evaluate(([A, B]) => window.__brain.mannWhitney(A, B),
      [per[a].map(r => r[maat]), per[bnaam].map(r => r[maat])]);
    const dA = mci(per[a].map(r => r[maat])), dB = mci(per[bnaam].map(r => r[maat]));
    /* Alleen de maten die een fractie zijn krijgen een verschil in procentpunten;
       omgevingsstappen en kanten-bezoeken zijn tellingen, en die maal honderd zetten
       levert een getal op dat nergens naar verwijst. */
    const fractie = ['succes20', 'toets20', 'benchBeleid', 'benchStreng'].includes(maat);
    return st ? {
      tegen: a, conditie: bnaam, maat, eenheid: fractie ? 'procentpunt' : 'absoluut',
      verschil: dB.m - dA.m, verschilPp: fractie ? 100 * (dB.m - dA.m) : null,
      gemiddeldeA: dA.m, gemiddeldeB: dB.m, U: st.U, p: st.p, oordeel: st.oordeel
    } : null;
  };
  /* De vraag van dit pakket zit in de drie paren: zelfde net, zelfde diepte,
     zelfde alles, alleen een andere schatter. De rest is context. */
  const paren = [['mlp-16-perturb', 'mlp-16-bp'], ['mlp-32-32-perturb', 'mlp-32-32-bp'],
    ['elman-16-perturb', 'elman-16-bp']];
  const toetsen = [];
  for (const [a, c] of paren) { toetsen.push(await toets(a, c, 'benchBeleid')); toetsen.push(await toets(a, c, 'stappenTot80')); }
  for (const naam of namen) if (naam !== 'ang-vol') toetsen.push(await toets('ang-vol', naam, 'benchBeleid'));
  toetsen.push(await toets('mlp-16-perturb-p1', 'mlp-16-perturb', 'benchBeleid'));

  /* Draaide ang-vol op 0,008, dan moet hij de reeks van stap 4 exact reproduceren.
     Dat is gratis bewijs dat het sleutelwerk van deze sessie ANG niet heeft geraakt. */
  let ijk = null;
  if (per['ang-vol'] && per['ang-vol'].length) {
    const oud = leesCsv(csvPad).filter(r => r.conditie === 'benchmark-standaard');
    if (oud.length && per['ang-vol'][0].lr === 0.008) {
      const oudM = new Map(oud.map(r => [r.breinZaad, r]));
      let n = 0, gelijk = 0;
      for (const r of per['ang-vol']) {
        const o = oudM.get(r.zaad); if (!o) continue;
        n++; if (Math.abs(o.benchBeleid - r.benchBeleid) < 1e-9 && Math.abs(o.succes20 - r.succes20) < 1e-9) gelijk++;
      }
      ijk = { vergeleken: n, identiek: gelijk, tegen: 'benchmark-standaard (stap 4)' };
    }
  }

  const IJKPUNTEN = fs.existsSync(path.join(OUT, 'benchmark.json'))
    ? JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark.json'), 'utf8')).ijkpunten : null;

  fs.writeFileSync(path.join(OUT, 'rekenkosten.json'), JSON.stringify({
    uitgevoerd: new Date().toISOString(),
    beschrijving: 'Werkplan stap 6: basislijnen mét backpropagation, en de rekenkostentabel. ' +
      'Elk gelaagd net draait twee keer — met node-perturbatie en met de exacte gradiënt — ' +
      'met verder exact hetzelfde skelet: hetzelfde spoor met dezelfde lambda, dezelfde lopende ' +
      'basislijn, dezelfde begrensde stap, dezelfde vervaging per poging, dezelfde Bernoulli-knoppen, ' +
      'dezelfde beloningen, dezelfde wereldzaden en dezelfde benchmarkset. Elke conditie draait op de ' +
      'leersnelheid die de veeg van stap 6a op de goedkope toets voor haar koos, nooit op de benchmark. ' +
      'De rekenkosten worden geteld in kanten-bezoeken: één keer een gewicht aanraken.',
    zaden: NSEEDS, eersteZaad: SEED0, pogingenPerRun: NEP,
    benchmark: { werelden: BENCHN, herhalingen: BENCHREPS },
    leersnelheidVeeg: veeg.keuze,
    vasteBeleidsvormen: IJKPUNTEN ? { willekeurig: IJKPUNTEN.willekeurig, reactief: IJKPUNTEN.reactief } : null,
    ijkTegenStap4: ijk, tabel, toetsen: toetsen.filter(Boolean), perZaad: per
  }, null, 2));

  console.log(`\n--- gedrag, ${NSEEDS} zaden per conditie ---`);
  console.log('conditie'.padEnd(20) + 'lr'.padEnd(8) + 'benchmark'.padEnd(18) +
    'argmax'.padEnd(18) + 'laatste 20'.padEnd(18) + 'gewichten'.padEnd(11) + 'pad');
  for (const naam of namen) {
    const t = tabel[naam];
    console.log(naam.padEnd(20) + String(t.lr).padEnd(8) + pct(t.benchBeleid).padEnd(18) +
      pct(t.benchStreng).padEnd(18) + pct(t.succes20).padEnd(18) +
      getal(t.verbindingen).padEnd(11) + getal(t.pad, 2));
  }
  if (IJKPUNTEN) console.log('reactieve agent'.padEnd(20) + '–'.padEnd(8) +
    `${(100 * IJKPUNTEN.reactief.pct).toFixed(1)}% ± ${(100 * IJKPUNTEN.reactief.ci).toFixed(1)}`);

  console.log('\n--- rekenkosten: vier dingen die allemaal "efficiëntie" heten ---');
  console.log('conditie'.padEnd(20) + 'kanten/leerstap'.padEnd(17) + 'kanten/infstap'.padEnd(16) +
    'stappen tot 80%'.padEnd(17) + 'kanten tot 80%'.padEnd(16) + 'actief'.padEnd(9) + 'tijd');
  for (const naam of namen) {
    const t = tabel[naam];
    const haal = t.haalde80 === t.runs ? '' : ` (${t.haalde80}/${t.runs})`;
    console.log(naam.padEnd(20) +
      kort(t.kbLeerStap ? t.kbLeerStap.m : null).padEnd(17) +
      kort(t.kbInfStap ? t.kbInfStap.m : null).padEnd(16) +
      (kort(t.stappenTot80 ? t.stappenTot80.m : null) + haal).padEnd(17) +
      kort(t.kbTot80 ? t.kbTot80.m : null).padEnd(16) +
      getal(t.actief).padEnd(9) + (t.tijdMs.m / 1000).toFixed(1) + 's');
  }

  console.log('\n--- Mann-Whitney U ---');
  for (const t of toetsen) if (t) console.log(
    `${t.conditie.padEnd(20)} tegen ${t.tegen.padEnd(20)} op ${t.maat.padEnd(14)} ` +
    `${(t.verschil >= 0 ? '+' : '-') + (t.verschilPp !== null ? Math.abs(t.verschilPp).toFixed(1) + ' pp' : kort(Math.abs(t.verschil)))}`
      .padEnd(14) + `   p = ${t.p.toFixed(4)}   ${t.oordeel}`);
  if (ijk) console.log(`\nijk tegen stap 4: ${ijk.identiek} van ${ijk.vergeleken} runs bit voor bit gelijk aan ${ijk.tegen}`);

  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
