/* Stap 8 — de ablatiereeks.

   Tien condities, zestien zaden, 500 pogingen, benchmark van 500 werelden. Van elk
   onderdeel van het model één conditie waarin dat onderdeel er niet is, en verder
   alles gelijk: dezelfde leerregel, dezelfde leersnelheid (0,008), dezelfde
   wereldzaden, dezelfde benchmark. Twee condities draaien niet opnieuw omdat ze
   letterlijk al in runs.csv staan — het volle model uit stap 4 en ang-vast uit
   stap 5.

   Twee maten, niet één. De eindscore op de benchmark is wat de paper rapporteert,
   maar stap 7 liet zien dat een ingreep de eindscore ongemoeid kan laten en toch een
   factor vijf in ervaring kan schelen. Daarom staat het aantal omgevingsstappen tot
   80 % succes overal naast.

   Negen vergelijkingen tegen dezelfde referentie is een familie, en bij negen
   toetsen op p < 0,05 is er ongeveer 37 % kans dat er eentje toevallig uitkomt.
   Elke maat krijgt daarom een Holm-correctie over de negen, en de tabel rapporteert
   de ruwe en de gecorrigeerde p naast elkaar.

   Hervatbaar: wat al in runs.csv staat wordt overgenomen in plaats van overgedaan.
   ALLEEN=<naam>[,<naam>] draait één of enkele condities.                          */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { CONDITIES, LR, MEET_SEED0, MEET_N } = require('./stap8-condities');

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

const leeg = v => (v === '' || v === undefined) ? null : v;
function ontleed(H, regel) {
  const c = regel.split(','), o = {};
  H.forEach((k, i) => { const v = (c[i] || ''); o[k] = (v !== '' && !isNaN(+v)) ? +v : v; });
  return o;
}
function leesCsv(p) {
  const L = fs.readFileSync(p, 'utf8').trim().split(/\r?\n/);
  const H = L[0].split(',');
  return L.slice(1).map(l => ontleed(H, l));
}

/* Eén plek waar een CSV-regel een meetpunt wordt, zodat een hergebruikte run uit
   stap 4 en een run van vanmiddag gegarandeerd op dezelfde manier gelezen worden. */
const uitCsv = r => ({
  zaad: r.breinZaad, lr: r.lr, succes20: r.succes20, toets20: r.toetsPct,
  benchBeleid: r.benchBeleid, benchStreng: r.benchStreng, benchStappen: r.benchStappen,
  verbindingen: r.verbindingen, actief: r.actieveVerbindingen, neuronen: r.neuronenEind,
  pad: r.kortstePad, reflexbogen: r.reflexbogen, lussen: r.lussen,
  meedoend: r.meedoendeNeuronen, losgeraakt: r.losgeraakt,
  gesnoeid: r.gesnoeid, bijgegroeid: r.bijgegroeid, nieuweNeuronen: r.nieuweNeuronen,
  typeVeranderingen: r.typeVeranderingen,
  sens: r.sens, work: r.work, refl: r.refl, mem: r.mem, neut: r.neut,
  tijdMs: r.rekentijdMs, kbLeerStap: leeg(r.kbLeerStap), kbInfStap: leeg(r.kbInfStap),
  pogingenTot80: leeg(r.pogingenTot80), stappenTot80: leeg(r.stappenTot80), kbTot80: leeg(r.kbTot80)
});

/* Holm-Bonferroni over een familie toetsen: sorteer op p, vermenigvuldig de kleinste
   met m, de volgende met m-1, en houd de rij oplopend. Strenger dan niets corrigeren
   en veel minder bot dan alles met negen vermenigvuldigen. */
function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const uit = new Array(ps.length); let vorige = 0;
  idx.forEach(([p, i], k) => {
    const aangepast = Math.min(1, Math.max(vorige, (ps.length - k) * p));
    uit[i] = aangepast; vorige = aangepast;
  });
  return uit;
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
  const H = hdr.split(',');
  const csvPad = path.join(OUT, 'runs.csv');
  let lines = fs.readFileSync(csvPad, 'utf8').trim().split(/\r?\n/);
  if (lines[0] !== hdr) throw new Error('runs.csv heeft andere kolommen dan de pagina — draai tests/migreer-runs-csv.js');

  const per = {};
  for (const cond of CONDITIES) {
    const bron = cond.hergebruik || cond.naam;
    const gedaan = new Map(leesCsv(csvPad)
      .filter(r => r.conditie === bron && r.lr === LR).map(r => [r.breinZaad, uitCsv(r)]));
    per[cond.naam] = [];
    for (let k = 0; k < NSEEDS; k++) {
      const zaad = SEED0 + k, t0 = Date.now();
      if (gedaan.has(zaad)) { per[cond.naam].push(gedaan.get(zaad)); continue; }
      if (cond.hergebruik) throw new Error(
        `conditie ${cond.naam} hergebruikt ${bron} uit runs.csv, maar zaad ${zaad} staat daar niet op lr ${LR}`);
      if (ALLEEN && !ALLEEN.includes(cond.naam)) continue;
      const r = await p.evaluate(([zaad, nep, naam, ov, bn, br, lr]) => {
        const W = window.__brain;
        let cfg = W.readCfg();
        cfg.nEpisodes = nep; cfg.evalOn = true;
        cfg.benchOn = true; cfg.benchN = bn; cfg.benchReps = br;
        cfg = W.cfgOverride(cfg, Object.assign({}, ov, { lr }));
        const row = W.runOne(cfg, zaad, naam);
        return { csv: W.csvRow(row), json: row };
      }, [zaad, NEP, cond.naam, cond.ov, BENCHN, BENCHREPS, LR]);
      if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
      lines.push(r.csv);
      fs.writeFileSync(csvPad, lines.join('\n') + '\n');
      fs.writeFileSync(path.join(OUT, 'runs', `${cond.naam}_z${zaad}.json`), JSON.stringify(r.json, null, 2));
      const m = uitCsv(ontleed(H, r.csv));
      per[cond.naam].push(m);
      console.log(`${cond.naam.padEnd(22)} zaad ${zaad}: benchmark ${(100 * m.benchBeleid).toFixed(1)}%  ` +
        `argmax ${(100 * m.benchStreng).toFixed(1)}%  laatste20 ${(100 * m.succes20).toFixed(0)}%  ` +
        `S${m.sens}/W${m.work}/R${m.refl}/M${m.mem}  ` +
        `80% na ${m.pogingenTot80 === null ? 'nooit' : m.pogingenTot80 + ' pog.'}  ` +
        `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }

  /* ---------- deed de ablatie wat zij zegt? ---------- */
  /* Een ablatietabel is waardeloos als een conditie het onderdeel niet echt weghaalt.
     Deze eisen staan niet in een testbestand maar in het resultaat zelf, per zaad
     nagerekend uit de kolommen die de run heeft weggeschreven. De strenge-invoerregel
     is de enige die niet uit runs.csv af te lezen is; die wordt op de graaf zelf
     gecontroleerd in tests/test-stap8.js. */
  const EISEN = {
    's8-geen-mem': ['mem', r => r.mem === 0, 'geen enkel geheugen-neuron'],
    's8-geen-refl': ['refl', r => r.refl === 0, 'geen enkel reflex-neuron'],
    's8-geen-sens': ['sens', r => r.sens === 0, 'geen enkel invoer-neuron'],
    's8-geen-snoeien': ['gesnoeid', r => r.gesnoeid === 0, 'geen enkele verbinding gesnoeid'],
    's8-geen-sprout': ['bijgegroeid', r => r.bijgegroeid === 0, 'geen enkele verbinding bijgegroeid'],
    's8-geen-groei': ['nieuweNeuronen', r => r.nieuweNeuronen === 0, 'geen enkel nieuw neuron'],
    's8-geen-hertypering': ['typeVeranderingen', r => r.typeVeranderingen === 0, 'geen enkele hertypering'],
    'ang-vast': ['structuur', r => r.gesnoeid === 0 && r.bijgegroeid === 0 &&
      r.nieuweNeuronen === 0 && r.typeVeranderingen === 0, 'geen enkele structurele verandering']
  };
  const controle = {};
  for (const naam in EISEN) {
    if (!per[naam] || !per[naam].length) continue;
    const [kolom, eis, tekst] = EISEN[naam];
    const ok = per[naam].filter(eis).length;
    controle[naam] = { kolom, eis: tekst, runs: per[naam].length, voldoet: ok };
    if (ok !== per[naam].length) console.error(
      `LET OP: ${naam} voldoet in ${ok} van ${per[naam].length} runs aan "${tekst}"`);
  }

  /* ---------- statistiek ---------- */
  const namen = CONDITIES.map(c => c.naam).filter(n => per[n] && per[n].length);
  const maten = ['succes20', 'toets20', 'benchBeleid', 'benchStreng', 'benchStappen',
    'verbindingen', 'actief', 'neuronen', 'pad', 'reflexbogen', 'lussen', 'meedoend',
    'losgeraakt', 'gesnoeid', 'bijgegroeid', 'nieuweNeuronen', 'typeVeranderingen',
    'sens', 'work', 'refl', 'mem', 'tijdMs',
    'kbLeerStap', 'kbInfStap', 'pogingenTot80', 'stappenTot80', 'kbTot80'];
  const tabel = {};
  for (const naam of namen) {
    tabel[naam] = { runs: per[naam].length, lr: LR, vraag: (CONDITIES.find(c => c.naam === naam) || {}).vraag };
    tabel[naam].haalde80 = per[naam].filter(r => r.pogingenTot80 !== null && r.pogingenTot80 !== undefined).length;
    for (const m of maten) tabel[naam][m] = mci(per[naam].map(r => r[m]));
  }

  const REF = 'ang-vol';
  const schoon = xs => xs.filter(x => x !== null && x !== undefined && isFinite(x));
  const toets = async (bnaam, maat) => {
    if (!per[REF] || !per[bnaam]) return null;
    const A = schoon(per[REF].map(r => r[maat])), B = schoon(per[bnaam].map(r => r[maat]));
    if (!A.length || !B.length) return null;
    const st = await p.evaluate(([A, B]) => window.__brain.mannWhitney(A, B), [A, B]);
    if (!st) return null;
    const dA = mci(A), dB = mci(B);
    const fractie = ['succes20', 'toets20', 'benchBeleid', 'benchStreng'].includes(maat);
    return {
      tegen: REF, conditie: bnaam, maat, eenheid: fractie ? 'procentpunt' : 'absoluut',
      nRef: A.length, nConditie: B.length,
      verschil: dB.m - dA.m, verschilPp: fractie ? 100 * (dB.m - dA.m) : null,
      gemiddeldeA: dA.m, gemiddeldeB: dB.m, U: st.U, p: st.p, oordeel: st.oordeel
    };
  };

  /* Per maat één familie van negen, en de Holm-correctie binnen die familie. De
     drie maten zijn geen familie van elkaar: het zijn drie vragen aan hetzelfde
     experiment, niet negenentwintig kansen op hetzelfde antwoord. */
  const anderen = namen.filter(n => n !== REF);
  const toetsen = [];
  for (const maat of ['benchBeleid', 'benchStreng', 'stappenTot80']) {
    const rij = [];
    for (const naam of anderen) { const t = await toets(naam, maat); if (t) rij.push(t); }
    const hp = holm(rij.map(t => t.p));
    rij.forEach((t, i) => {
      t.familie = maat; t.familiegrootte = rij.length; t.pHolm = hp[i];
      t.oordeelHolm = hp[i] < 0.01 ? 'sterk' : hp[i] < 0.05 ? 'significant' : 'binnen de ruis';
    });
    toetsen.push(...rij);
  }

  const IJKPUNTEN = fs.existsSync(path.join(OUT, 'benchmark.json'))
    ? JSON.parse(fs.readFileSync(path.join(OUT, 'benchmark.json'), 'utf8')).ijkpunten : null;

  fs.writeFileSync(path.join(OUT, 'ablatie.json'), JSON.stringify({
    uitgevoerd: new Date().toISOString(),
    beschrijving: 'Werkplan stap 8: de ablatiereeks. Tien condities die elk één onderdeel van het ' +
      'model weglaten — de drie gespecialiseerde soorten neuronen (geheugen, reflex, invoer), de ' +
      'vier vormen van structurele plasticiteit (snoeien, verbindingen bijgroeien, neuronen ' +
      'bijgroeien, hertyperen), de bedradingsgrammatica (strenge invoer, waarbij élk signaal via ' +
      'een invoer-neuron loopt) en de plasticiteit als geheel. Alles verder gelijk: dezelfde ' +
      'leerregel, dezelfde leersnelheid 0,008, dezelfde zestien breinzaden, dezelfde benchmark van ' +
      '500 werelden. Anders dan in stap 7 krijgt geen enkele conditie een eigen leersnelheidsveeg: ' +
      'een ablatie verandert de graaf en niet de schaal van het leersignaal, en meesturen van eta ' +
      'zou meten hoe goed een conditie opnieuw af te stellen is in plaats van wat het weggelaten ' +
      'onderdeel bijdroeg. Negen condities tegen dezelfde referentie is een familie toetsen; elke ' +
      'maat krijgt daarom een Holm-correctie over die negen.',
    zaden: NSEEDS, eersteZaad: SEED0, pogingenPerRun: NEP, leersnelheid: LR,
    benchmark: { werelden: BENCHN, herhalingen: BENCHREPS },
    condities: Object.fromEntries(CONDITIES.map(c => [c.naam, { ov: c.ov, vraag: c.vraag, hergebruik: c.hergebruik || null }])),
    vasteBeleidsvormen: IJKPUNTEN ? { willekeurig: IJKPUNTEN.willekeurig, reactief: IJKPUNTEN.reactief } : null,
    controle, tabel, toetsen, perZaad: per
  }, null, 2));

  console.log(`\n--- gedrag, ${NSEEDS} zaden per conditie, eta = ${LR} ---`);
  console.log('conditie'.padEnd(22) + 'benchmark'.padEnd(18) + 'argmax'.padEnd(18) +
    'laatste 20'.padEnd(18) + 'actief'.padEnd(9) + 'neuronen'.padEnd(10) + 'pad');
  for (const naam of namen) {
    const t = tabel[naam];
    console.log(naam.padEnd(22) + pct(t.benchBeleid).padEnd(18) + pct(t.benchStreng).padEnd(18) +
      pct(t.succes20).padEnd(18) + getal(t.actief).padEnd(9) + getal(t.neuronen).padEnd(10) +
      getal(t.pad, 2));
  }
  if (IJKPUNTEN) console.log('reactieve agent'.padEnd(22) +
    `${(100 * IJKPUNTEN.reactief.pct).toFixed(1)}% ± ${(100 * IJKPUNTEN.reactief.ci).toFixed(1)}`);

  console.log('\n--- wat het leren kost ---');
  console.log('conditie'.padEnd(22) + 'pogingen tot 80%'.padEnd(18) + 'stappen tot 80%'.padEnd(17) +
    'kanten/leerstap'.padEnd(17) + 'kanten tot 80%'.padEnd(16) + 'tijd');
  for (const naam of namen) {
    const t = tabel[naam];
    const haal = t.haalde80 === t.runs ? '' : ` (${t.haalde80}/${t.runs})`;
    console.log(naam.padEnd(22) +
      (kort(t.pogingenTot80 ? t.pogingenTot80.m : null) + haal).padEnd(18) +
      kort(t.stappenTot80 ? t.stappenTot80.m : null).padEnd(17) +
      kort(t.kbLeerStap ? t.kbLeerStap.m : null).padEnd(17) +
      kort(t.kbTot80 ? t.kbTot80.m : null).padEnd(16) + (t.tijdMs.m / 1000).toFixed(1) + 's');
  }

  console.log('\n--- Mann-Whitney U tegen het volle model, met Holm-correctie per maat ---');
  for (const t of toetsen) console.log(
    `${t.conditie.padEnd(22)} ${t.maat.padEnd(14)} ` +
    `${(t.verschil >= 0 ? '+' : '-') + (t.verschilPp !== null ? Math.abs(t.verschilPp).toFixed(1) + ' pp' : kort(Math.abs(t.verschil)))}`
      .padEnd(13) + `   p = ${t.p.toFixed(4)}   Holm ${t.pHolm.toFixed(4)}   ${t.oordeelHolm}`);

  console.log('\n--- deed de ablatie wat zij zegt? ---');
  for (const naam in controle) {
    const c = controle[naam];
    console.log(`${naam.padEnd(22)} ${c.voldoet}/${c.runs} runs: ${c.eis}` +
      (c.voldoet === c.runs ? '' : '   <-- LET OP'));
  }
  console.log('s8-strenge-invoer      op de graaf gecontroleerd in tests/test-stap8.js');

  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
