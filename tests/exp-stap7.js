/* Stap 7b — wat de vier ingrepen in de leerregel waard zijn.

   Stap 5 en 6 hebben het model op twee assen gemeten en op allebei verloren: de
   graafstructuur voegt niets toe, en de lokale schatter kost twintig procentpunt en
   een factor 43 aan rekenwerk. Dit pakket kijkt naar de derde as, de leerregel zelf,
   met de topologie en de schatter juist ongemoeid. Vier ingrepen, elk klein, elk los
   te meten:

     a  een toestandsafhankelijke criticus (TD(0)) in plaats van één lopend gemiddelde;
     b  schaarse perturbatie — per tik een kwart van de wolk verstoren;
     a+b samen;
     c  een categorisch beleid over negen elkaar uitsluitende acties;
     d  perturbGain — de ontbrekende 1/Var(ξ)-normalisatie uit stap 3, nu mét een
        eigen leersnelheidsveeg, wat er in stap 3 niet was.

   Elke conditie draait op de leersnelheid die de veeg van stap 7a op de goedkope
   toets voor háár koos, nooit op de benchmark. Wat er dan overblijft is de ingreep.

   En als er niets uitkomt is dat ook een resultaat: een leerregel die niet beter
   wordt van een criticus is een bevinding over die leerregel, geen mislukte sessie.

   Hervatbaar: wat al in runs.csv staat wordt overgenomen in plaats van overgedaan.
   ALLEEN=<naam>[,<naam>] draait één of enkele condities.                          */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { CONDITIES, MEET_SEED0, MEET_N } = require('./stap7-condities');

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
const leeg = v => (v === '' || v === undefined) ? null : v;
const uitCsv = r => ({
  zaad: r.breinZaad, lr: r.lr, succes20: r.succes20, toets20: r.toetsPct,
  benchBeleid: r.benchBeleid, benchStreng: r.benchStreng, benchStappen: r.benchStappen,
  verbindingen: r.verbindingen, actief: r.actieveVerbindingen, neuronen: r.neuronenEind,
  pad: r.kortstePad, reflexbogen: r.reflexbogen, tijdMs: r.rekentijdMs,
  kbLeerStap: leeg(r.kbLeerStap), kbInfStap: leeg(r.kbInfStap),
  pogingenTot80: leeg(r.pogingenTot80), stappenTot80: leeg(r.stappenTot80), kbTot80: leeg(r.kbTot80)
});

(async () => {
  const veegPad = path.join(OUT, 'lr-veeg-stap7.json');
  if (!fs.existsSync(veegPad)) throw new Error('draai eerst tests/exp-stap7-lr.js — zonder de veeg is de vergelijking niet eerlijk');
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
        neuronen: r.json.config.neuronenNu, pad: st.kortstePad, reflexbogen: st.reflexbogen,
        tijdMs: res.rekentijdMs,
        kbLeerStap: rk.kantenBezoekenLeerStap, kbInfStap: rk.kantenBezoekenInfStap,
        pogingenTot80: rk.pogingenTot80, stappenTot80: rk.omgevingsstappenTot80, kbTot80: rk.kantenBezoekenTot80
      });
      console.log(`${cond.naam.padEnd(22)} lr ${String(lr).padEnd(8)} zaad ${zaad}: ` +
        `benchmark ${(100 * bm.beleid.pct).toFixed(1)}%  argmax ${(100 * bm.streng.pct).toFixed(1)}%  ` +
        `laatste20 ${(100 * res.succes20).toFixed(0)}%  ` +
        `80% na ${rk.pogingenTot80 === null ? 'nooit' : rk.pogingenTot80 + ' pog.'}  ` +
        `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }

  /* ---------- statistiek ---------- */
  const namen = CONDITIES.map(c => c.naam).filter(n => per[n] && per[n].length);
  const maten = ['succes20', 'toets20', 'benchBeleid', 'benchStreng', 'benchStappen',
    'verbindingen', 'actief', 'neuronen', 'pad', 'reflexbogen', 'tijdMs',
    'kbLeerStap', 'kbInfStap', 'pogingenTot80', 'stappenTot80', 'kbTot80'];
  const tabel = {};
  for (const naam of namen) {
    tabel[naam] = { runs: per[naam].length, lr: per[naam][0].lr };
    tabel[naam].haalde80 = per[naam].filter(r => r.pogingenTot80 !== null && r.pogingenTot80 !== undefined).length;
    for (const m of maten) tabel[naam][m] = mci(per[naam].map(r => r[m]));
  }

  const toets = async (a, bnaam, maat) => {
    if (!per[a] || !per[bnaam] || !per[a].length || !per[bnaam].length) return null;
    const st = await p.evaluate(([A, B]) => window.__brain.mannWhitney(A, B),
      [per[a].map(r => r[maat]), per[bnaam].map(r => r[maat])]);
    const dA = mci(per[a].map(r => r[maat])), dB = mci(per[bnaam].map(r => r[maat]));
    const fractie = ['succes20', 'toets20', 'benchBeleid', 'benchStreng'].includes(maat);
    return st ? {
      tegen: a, conditie: bnaam, maat, eenheid: fractie ? 'procentpunt' : 'absoluut',
      verschil: dB.m - dA.m, verschilPp: fractie ? 100 * (dB.m - dA.m) : null,
      gemiddeldeA: dA.m, gemiddeldeB: dB.m, U: st.U, p: st.p, oordeel: st.oordeel
    } : null;
  };
  const toetsen = [];
  /* elke variant tegen de huidige regel: op de benchmark met geloot beleid (de maat
     van het paper), op de benchmark met argmax (want een variant kan de vorm van het
     beleid veranderen zonder de gelote score te raken), en op het aantal
     omgevingsstappen tot 80 % — de maat waarop een variantiereductie hoort te zitten. */
  for (const naam of namen) if (naam !== 's7-huidig') {
    toetsen.push(await toets('s7-huidig', naam, 'benchBeleid'));
    toetsen.push(await toets('s7-huidig', naam, 'benchStreng'));
    toetsen.push(await toets('s7-huidig', naam, 'stappenTot80'));
  }
  /* en de toewijzing binnen het pakket: doet (a)+(b) meer dan (a) of (b) los? */
  toetsen.push(await toets('s7-criticus', 's7-criticus-schaars', 'benchBeleid'));
  toetsen.push(await toets('s7-schaars', 's7-criticus-schaars', 'benchBeleid'));

  /* Spreiding tussen zaden is hier een uitkomst en geen bijvangst: het werkplan
     verwacht van de criticus juist mínder spreiding. Daarom staat de
     standaardafwijking over de zaden apart in de tabel, met een F-verhouding tegen
     de huidige regel erbij zodat "minder spreiding" een getal is. */
  const spreiding = {};
  for (const naam of namen) {
    const s = tabel[naam].benchBeleid;
    const s0 = tabel['s7-huidig'] ? tabel['s7-huidig'].benchBeleid : null;
    spreiding[naam] = { sd: s ? s.sd : null, n: s ? s.n : 0,
      fTegenHuidig: (s && s0 && s0.sd > 0) ? (s.sd * s.sd) / (s0.sd * s0.sd) : null };
  }

  /* Draaide s7-huidig op 0,008, dan moet hij de reeks van stap 6 exact reproduceren. */
  let ijk = null;
  if (per['s7-huidig'] && per['s7-huidig'].length) {
    const oud = leesCsv(csvPad).filter(r => r.conditie === 'ang-vol' || r.conditie === 'benchmark-standaard');
    if (oud.length && per['s7-huidig'][0].lr === 0.008) {
      const oudM = new Map(oud.filter(r => r.lr === 0.008).map(r => [r.breinZaad, r]));
      /* runs.csv bewaart zes decimalen; een vergelijking op de volle float meldt dan
         verschil waar alleen afronding zit. Beide kanten op zes decimalen zetten is
         precies de nauwkeurigheid die het bestand heeft. */
      const r6 = x => +Number(x).toFixed(6);
      let n = 0, gelijk = 0;
      for (const r of per['s7-huidig']) {
        const o = oudM.get(r.zaad); if (!o) continue;
        n++; if (r6(o.benchBeleid) === r6(r.benchBeleid) && r6(o.succes20) === r6(r.succes20)) gelijk++;
      }
      ijk = { vergeleken: n, identiek: gelijk, nauwkeurigheid: '6 decimalen, de precisie van runs.csv',
        tegen: 'benchmark-standaard / ang-vol op η = 0,008 (stap 4 en 6)' };
    }
  }

  const IJKPUNTEN = fs.existsSync(path.join(OUT, 'benchmark.json'))
    ? JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark.json'), 'utf8')).ijkpunten : null;

  fs.writeFileSync(path.join(OUT, 'leerregel.json'), JSON.stringify({
    uitgevoerd: new Date().toISOString(),
    beschrijving: 'Werkplan stap 7: vier ingrepen in de leerregel, met de topologie en de schatter ' +
      'ongemoeid. (a) een lineaire criticus V(s)=w·s+b op de zestien sensoren, getraind met TD(0), ' +
      'zodat het leersignaal r+γV(s′)−V(s) wordt in plaats van r−r̄; (b) schaarse perturbatie, per tik ' +
      'een kwart van de wolk; (c) een gefactoriseerde softmax over negen elkaar uitsluitende acties ' +
      'in plaats van vier onafhankelijke Bernoulli-knoppen; (d) perturbGain, de ontbrekende ' +
      '1/Var(ξ)-normalisatie uit stap 3, nu mét eigen leersnelheidsveeg. Elke conditie draait op de ' +
      'leersnelheid die de veeg van stap 7a op de goedkope toets van twintig werelden voor haar koos, ' +
      'nooit op de benchmark van 500 werelden.',
    zaden: NSEEDS, eersteZaad: SEED0, pogingenPerRun: NEP,
    benchmark: { werelden: BENCHN, herhalingen: BENCHREPS },
    condities: Object.fromEntries(CONDITIES.map(c => [c.naam, c.ov])),
    leersnelheidVeeg: veeg.keuze,
    vasteBeleidsvormen: IJKPUNTEN ? { willekeurig: IJKPUNTEN.willekeurig, reactief: IJKPUNTEN.reactief } : null,
    ijkTegenStap6: ijk, tabel, spreiding, toetsen: toetsen.filter(Boolean), perZaad: per
  }, null, 2));

  console.log(`\n--- gedrag, ${NSEEDS} zaden per conditie ---`);
  console.log('conditie'.padEnd(24) + 'lr'.padEnd(9) + 'benchmark'.padEnd(18) +
    'argmax'.padEnd(18) + 'laatste 20'.padEnd(18) + 'sd tussen zaden'.padEnd(17) + 'actief');
  for (const naam of namen) {
    const t = tabel[naam];
    console.log(naam.padEnd(24) + String(t.lr).padEnd(9) + pct(t.benchBeleid).padEnd(18) +
      pct(t.benchStreng).padEnd(18) + pct(t.succes20).padEnd(18) +
      ((100 * spreiding[naam].sd).toFixed(1) + ' pp').padEnd(17) + getal(t.actief));
  }
  if (IJKPUNTEN) console.log('reactieve agent'.padEnd(24) + '–'.padEnd(9) +
    `${(100 * IJKPUNTEN.reactief.pct).toFixed(1)}% ± ${(100 * IJKPUNTEN.reactief.ci).toFixed(1)}`);

  console.log('\n--- leersnelheid van het leren, en wat het kost ---');
  console.log('conditie'.padEnd(24) + 'pogingen tot 80%'.padEnd(18) + 'stappen tot 80%'.padEnd(17) +
    'kanten/leerstap'.padEnd(17) + 'kanten tot 80%'.padEnd(16) + 'tijd');
  for (const naam of namen) {
    const t = tabel[naam];
    const haal = t.haalde80 === t.runs ? '' : ` (${t.haalde80}/${t.runs})`;
    console.log(naam.padEnd(24) +
      (kort(t.pogingenTot80 ? t.pogingenTot80.m : null) + haal).padEnd(18) +
      kort(t.stappenTot80 ? t.stappenTot80.m : null).padEnd(17) +
      kort(t.kbLeerStap ? t.kbLeerStap.m : null).padEnd(17) +
      kort(t.kbTot80 ? t.kbTot80.m : null).padEnd(16) + (t.tijdMs.m / 1000).toFixed(1) + 's');
  }

  console.log('\n--- Mann-Whitney U ---');
  for (const t of toetsen) if (t) console.log(
    `${t.conditie.padEnd(24)} tegen ${t.tegen.padEnd(22)} op ${t.maat.padEnd(14)} ` +
    `${(t.verschil >= 0 ? '+' : '-') + (t.verschilPp !== null ? Math.abs(t.verschilPp).toFixed(1) + ' pp' : kort(Math.abs(t.verschil)))}`
      .padEnd(14) + `   p = ${t.p.toFixed(4)}   ${t.oordeel}`);
  if (ijk) console.log(`\nijk tegen stap 6: ${ijk.identiek} van ${ijk.vergeleken} runs bit voor bit gelijk aan ${ijk.tegen}`);

  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
