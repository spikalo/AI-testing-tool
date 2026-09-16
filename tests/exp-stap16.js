/* Stap 16 — de omslagproef opnieuw, met de herstructurering op een omgevingssignaal.

   Vier condities × twaalf breinzaden = achtenveertig levens van 900 pogingen. De
   fasen, de condities, de detectorinstelling en de voorspellingen staan in
   tests/stap16-condities.js en zijn gecommit voordat deze loper voor het eerst
   gedraaid heeft.

   TWEE RONDEN, EN DAT MOET. `ang-budget` is een klok met per zaad dezelfde hoeveelheid
   herstructurering als het signaalleven van dát zaad. Die hoeveelheid is pas bekend
   nadat het signaalleven gedraaid heeft, dus draait de loper eerst alle condities die
   op zichzelf staan en daarna pas de budgetconditie. Het gekozen getal gaat mee de
   uitvoer in; zonder dat getal is de controle niet na te rekenen.

   Hervatbaar op het niveau van het losse leven: wat al als JSON in experimenten/runs/
   staat wordt overgenomen. ALLEEN=<naam>[,<naam>] draait één of enkele condities.    */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { CONDITIES, DETECTOR, STAGVENSTER, VOORSPELLINGEN, FASEN, MEET_SEED0, MEET_N,
  MEETPUNT, MIDDEN, PLATEAU_VENSTER, HERSTEL_DREMPEL, OMSLAG_VENSTER } = require('./stap16-condities');
const { maakMaten, poortMaten } = require('./omslag-maten');

const OUT = path.resolve('experimenten');
const NSEEDS = +(process.env.NSEEDS || MEET_N);
const SEED0 = +(process.env.SEED0 || MEET_SEED0);
const BENCHN = +(process.env.BENCHN || 500);
const MEMN = +(process.env.MEMN || 100);
const ALLEEN = process.env.ALLEEN ? process.env.ALLEEN.split(',') : null;

const TOTAAL = FASEN.reduce((a, f) => a + f.pogingen, 0);
const GRENZEN = FASEN.map((f, i) => FASEN.slice(0, i + 1).reduce((a, g) => a + g.pogingen, 0));
const OMSLAG = GRENZEN.slice(0, -1);
const CENSUUR = TOTAAL;
const naamVan = n => `s16-${n}`;
const maten = maakMaten({ TOTAAL, OMSLAG, PLATEAU_VENSTER, HERSTEL_DREMPEL, OMSLAG_VENSTER });

const mci = xs => {
  const v = xs.filter(x => x !== null && x !== undefined && isFinite(x));
  const n = v.length; if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, m, sd, ci: 1.96 * sd / Math.sqrt(n) };
};
const pct = o => o ? `${(100 * o.m).toFixed(1)}% ± ${(100 * o.ci).toFixed(1)}` : '–';
const g1 = o => o ? o.m.toFixed(1) : '–';
function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const uit = new Array(ps.length); let vorige = 0;
  idx.forEach(([p, i], k) => { const a = Math.min(1, Math.max(vorige, (ps.length - k) * p)); uit[i] = a; vorige = a; });
  return uit;
}
function tekentoets(verschillen) {
  const v = verschillen.filter(x => x !== null && isFinite(x) && x !== 0);
  const n = v.length; if (!n) return null;
  const k = v.filter(x => x > 0).length;
  const bin = (n, k) => { let c = 1; for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1); return c; };
  let p = 0;
  for (let i = 0; i <= n; i++) { const q = bin(n, i) * Math.pow(0.5, n); if (bin(n, i) <= bin(n, k) + 1e-9) p += q; }
  return { n, positief: k, p: Math.min(1, p) };
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
  if (lines[0] !== hdr) throw new Error('runs.csv heeft andere kolommen dan de pagina – draai tests/migreer-runs-csv.js');

  const per = {}, poort = {}, budget = {};

  async function leef(cond, zaad, ov) {
    const naam = naamVan(cond.naam);
    const jsonPad = path.join(OUT, 'runs', `${naam}_z${zaad}.json`);
    if (fs.existsSync(jsonPad)) return JSON.parse(fs.readFileSync(jsonPad, 'utf8'));
    const t0 = Date.now();
    const r = await p.evaluate(([zaad, naam, ov, lr, fasen, meet, totaal, bn, memn]) => {
      const W = window.__brain;
      let cfg = W.readCfg();
      cfg.nEpisodes = totaal; cfg.evalOn = false;
      cfg.benchOn = true; cfg.benchN = bn; cfg.benchReps = 1;
      cfg.memOn = true; cfg.memN = memn;
      cfg = W.cfgOverride(cfg, Object.assign({}, ov, { lr }));
      const row = W.runLeven(cfg, zaad, fasen, naam, meet);
      return { csv: W.csvRow(row), json: row };
    }, [zaad, naam, ov, cond.lr, FASEN, MEETPUNT, TOTAAL, BENCHN, MEMN]);
    if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
    lines.push(r.csv);
    fs.writeFileSync(csvPad, lines.join('\n') + '\n');
    fs.writeFileSync(jsonPad, JSON.stringify(r.json, null, 2));
    r.json.__seconden = (Date.now() - t0) / 1000;
    return r.json;
  }

  function meld(naam, zaad, m, extra) {
    console.log(`${naam.padEnd(14)} zaad ${zaad}: ` +
      `A1 ${(100 * m.aEind1).toFixed(0)}%  B ${(100 * m.bScore).toFixed(0)}%  ` +
      `A-na-B ${(100 * m.aEind2).toFixed(0)}%  A2 ${(100 * m.aEind3).toFixed(0)}%  ` +
      `herstel ${m.hersteltijd === null ? 'niet' : m.hersteltijd + 'p'}  ` +
      `ronden ${m.ronden} (na de tweede omslag ${m.rondenNa2})` + (extra || ''));
  }

  /* ---------- ronde 1: de condities die op zichzelf staan ---------- */
  for (const cond of CONDITIES) {
    if (cond.perZaadUitSignaal) continue;
    const naam = naamVan(cond.naam);
    per[naam] = []; poort[naam] = [];
    for (let k = 0; k < NSEEDS; k++) {
      const zaad = SEED0 + k;
      if (ALLEEN && !ALLEEN.includes(naam) && !ALLEEN.includes(cond.naam)
        && !fs.existsSync(path.join(OUT, 'runs', `${naam}_z${zaad}.json`))) continue;
      const json = await leef(cond, zaad, cond.ov);
      const m = maten(json);
      per[naam].push(m);
      poort[naam].push(Object.assign({ zaad }, poortMaten(json, OMSLAG, OMSLAG_VENSTER)));
      if (json.__seconden !== undefined) meld(cond.naam, zaad, m, `  (${json.__seconden.toFixed(0)}s)`);
    }
  }

  /* ---------- ronde 2: de budgetcontrole, per zaad gekoppeld ---------- */
  const signaalNaam = naamVan('ang-signaal');
  for (const cond of CONDITIES) {
    if (!cond.perZaadUitSignaal) continue;
    const naam = naamVan(cond.naam);
    per[naam] = []; poort[naam] = [];
    for (let k = 0; k < NSEEDS; k++) {
      const zaad = SEED0 + k;
      const bron = (per[signaalNaam] || []).find(r => r.zaad === zaad);
      if (!bron) { console.log(`${cond.naam} zaad ${zaad}: overgeslagen, geen signaalleven om aan te koppelen`); continue; }
      /* Evenveel ronden, gelijkmatig over het leven verdeeld: dezelfde hoeveelheid,
         maar zonder enige band met de omslag. Minimaal 2, want een klokperiode van 1
         zou iets anders zijn dan een klok. */
      const elke = Math.max(2, Math.round(TOTAAL / Math.max(1, bron.ronden)));
      budget[zaad] = { rondenSignaal: bron.ronden, structEvery: elke,
        rondenVerwacht: Math.floor(TOTAAL / elke) };
      if (ALLEEN && !ALLEEN.includes(naam) && !ALLEEN.includes(cond.naam)
        && !fs.existsSync(path.join(OUT, 'runs', `${naam}_z${zaad}.json`))) continue;
      const json = await leef(cond, zaad, Object.assign({}, cond.ov, { structEvery: elke }));
      const m = maten(json);
      budget[zaad].rondenGehaald = m.ronden;
      per[naam].push(m);
      poort[naam].push(Object.assign({ zaad }, poortMaten(json, OMSLAG, OMSLAG_VENSTER)));
      if (json.__seconden !== undefined)
        meld(cond.naam, zaad, m, `  [klok elke ${elke}, signaal had er ${bron.ronden}]  (${json.__seconden.toFixed(0)}s)`);
    }
  }

  /* ---------- tabel ---------- */
  const MATEN = ['plateau', 'aEind1', 'bScore', 'aEind2', 'aEind3', 'behoud', 'terugwinst',
    'dipNaB', 'dipNaTerug', 'hersteltijd', 'ronden', 'rondenNa1', 'rondenNa2',
    'churnVoor1', 'churnNa1', 'churnVoor2', 'churnNa2',
    'horizon1', 'horizon2', 'horizon3', 'benchEind', 'tijdMs'];
  const tabel = {};
  for (const naam in per) if (per[naam].length) {
    tabel[naam] = { runs: per[naam].length, gecensureerd: per[naam].filter(r => r.gecensureerd).length };
    for (const m of MATEN) tabel[naam][m] = mci(per[naam].map(r => r[m]));
  }

  const mw = async (A, B) => {
    const s = x => x.filter(v => v !== null && v !== undefined && isFinite(v));
    const a = s(A), c = s(B);
    if (!a.length || !c.length) return null;
    const st = await p.evaluate(([a, c]) => window.__brain.mannWhitney(a, c), [a, c]);
    if (!st) return null;
    const dA = mci(a), dB = mci(c);
    return { nA: a.length, nB: c.length, gemiddeldeA: dA.m, gemiddeldeB: dB.m,
      verschil: dB.m - dA.m, U: st.U, p: st.p, oordeel: st.oordeel };
  };

  /* V1 is de controle op de ingreep en hoort in geen van beide families: hij toetst
     niet of het model iets kan, maar of de knop aanstaat. */
  const poortToetsen = [];
  {
    const R = poort[signaalNaam] || [];
    if (R.length) {
      /* Eerst bewijzen dát er gemeten is: eindig, niet-negatief, en genoeg rijpe
         pogingen. Pas daarna op verschil toetsen (stap 13, fout 14). */
      const gezond = {
        allePogingenEenD: R.every(r => r.pogingenMetD >= TOTAAL - 1),
        alleDEindig: R.every(r => r.alleDEindig),
        alleDNietNegatief: R.every(r => r.alleDNietNegatief),
        alleDrempelEindig: R.every(r => r.alleDrempelEindig),
        minstensEenVuur: R.every(r => r.vuurTotaal > 0)
      };
      poortToetsen.push({ soort: 'gezondheid', gezond,
        alles: Object.values(gezond).every(Boolean) });
      for (const [i, veld, eerste] of [[0, 'vuurNa1', 'eersteNa1'], [1, 'vuurNa2', 'eersteNa2']]) {
        const d = R.map(r => (r[veld] === null || r.vuurBuiten === null) ? null : r[veld] - r.vuurBuiten);
        const tt = tekentoets(d);
        poortToetsen.push({ soort: 'V1', omslag: OMSLAG[i],
          naarWat: i === 0 ? 'naar knipperen' : 'terug naar zichtbaar',
          vuurBuiten: mci(R.map(r => r.vuurBuiten)), vuurNa: mci(R.map(r => r[veld])),
          dBuiten: mci(R.map(r => r.dBuiten)), dNa: mci(R.map(r => r[i === 0 ? 'dNa1' : 'dNa2'])),
          eersteVuur: mci(R.map(r => r[eerste])),
          nietGevuurd: R.filter(r => r[eerste] === null).length,
          verschil: mci(d), tekentoets: tt,
          oordeel: tt && tt.p < 0.05 ? (mci(d).m > 0 ? 'vuurt vaker na de omslag' : 'vuurt juist minder na de omslag')
            : 'binnen de ruis' });
      }
    }
  }

  const PAREN = [
    ['ang-klok', 'ang-signaal', 'V2 – de aansturing: signaal tegen klok'],
    ['ang-vast', 'ang-signaal', 'V3 – levert plasticiteit iets op als zij op tijd komt'],
    ['ang-budget', 'ang-signaal', 'V4a – zelfde hoeveelheid, ander moment'],
    ['ang-klok', 'ang-budget', 'V4b – zelfde soort aansturing, andere hoeveelheid'],
    ['ang-vast', 'ang-klok', 'ijkpunt: de vergelijking van stap 13, opnieuw']
  ];
  const toetsen = [];
  for (const [maat, familie] of [['hersteltijd', 'herstel'], ['behoud', 'behoud'], ['terugwinst', 'behoud']]) {
    const rij = [];
    for (const [a, c, waarom] of PAREN) {
      const na = naamVan(a), nc = naamVan(c);
      if (!per[na] || !per[nc] || !per[na].length || !per[nc].length) continue;
      const waarde = r => (maat === 'hersteltijd' && r.hersteltijd === null) ? CENSUUR : r[maat];
      const t = await mw(per[na].map(waarde), per[nc].map(waarde));
      if (t) rij.push(Object.assign(t, { maat, tegen: a, conditie: c, waarom, familie,
        gecensureerdA: per[na].filter(r => r.gecensureerd).length,
        gecensureerdB: per[nc].filter(r => r.gecensureerd).length }));
    }
    const hp = holm(rij.map(t => t.p));
    rij.forEach((t, i) => {
      t.familiegrootte = rij.length; t.pHolm = hp[i];
      t.oordeelHolm = hp[i] < 0.01 ? 'sterk' : hp[i] < 0.05 ? 'significant' : 'binnen de ruis';
    });
    toetsen.push(...rij);
  }

  /* V4 beschrijvend: is het verschil signaal↔budget groter dan budget↔klok? */
  const her = n => (per[naamVan(n)] || []).map(r => r.hersteltijd === null ? CENSUUR : r.hersteltijd);
  const V4 = (() => {
    const s = mci(her('ang-signaal')), bu = mci(her('ang-budget')), kl = mci(her('ang-klok'));
    if (!s || !bu || !kl) return null;
    return { signaalTegenBudget: bu.m - s.m, budgetTegenKlok: kl.m - bu.m,
      signaal: s, budget: bu, klok: kl,
      oordeel: Math.abs(bu.m - s.m) > Math.abs(kl.m - bu.m)
        ? 'het moment weegt zwaarder dan de hoeveelheid'
        : 'de hoeveelheid weegt minstens zo zwaar als het moment' };
  })();

  fs.writeFileSync(path.join(OUT, 'signaalsturing.json'), JSON.stringify({
    uitgevoerd: new Date().toISOString(),
    beschrijving: 'Werkplan stap 16: dezelfde omslagproef als stap 13, met één verschil — ' +
      'de herstructurering wordt in de conditie ang-signaal aangestuurd door een detector op ' +
      'de invoerstatistiek in plaats van door een klok. ang-budget is een klok met per zaad ' +
      'dezelfde hoeveelheid herstructurering als het signaalleven van dat zaad, zodat een ' +
      'verschil in herstel niet aan de hoeveelheid toegeschreven hoeft te worden. ang-klok en ' +
      'ang-vast zijn de condities van stap 13, ongewijzigd; ang-klok hoort bit voor bit ' +
      'hetzelfde leven te geven als s13-ang, en dat is de controle dat de nieuwe knop in haar ' +
      'uitstand niets doet (nagemeten in tests/test-stap16.js).',
    fasen: FASEN, grenzen: GRENZEN, omslagpogingen: OMSLAG,
    zaden: NSEEDS, eersteZaad: SEED0,
    detector: DETECTOR, stagnatieVenster: STAGVENSTER,
    meetpunt: MEETPUNT, benchmarkEind: { werelden: BENCHN, herhalingen: 1 },
    herstelregel: { plateauVenster: PLATEAU_VENSTER, drempel: HERSTEL_DREMPEL,
      omslagVenster: OMSLAG_VENSTER, censuurwaarde: CENSUUR },
    condities: Object.fromEntries(CONDITIES.map(c => [c.naam, { lr: c.lr, ov: c.ov, rol: c.rol }])),
    budgetPerZaad: budget,
    voorspellingen: VOORSPELLINGEN,
    tabel, poortToetsen, toetsen, V4, perZaad: per, poortPerZaad: poort
  }, null, 2));

  /* ---------- uitvoer ---------- */
  const namen = CONDITIES.map(c => c.naam);
  const T = n => tabel[naamVan(n)];
  console.log('\n--- het leven in vier meetpunten (benchmark, geloot) ---');
  console.log('conditie'.padEnd(14) + 'A1 eind'.padEnd(18) + 'B op B'.padEnd(18) +
    'A na B'.padEnd(18) + 'A2 eind'.padEnd(18));
  for (const n of namen) if (T(n)) console.log(n.padEnd(14) +
    pct(T(n).aEind1).padEnd(18) + pct(T(n).bScore).padEnd(18) +
    pct(T(n).aEind2).padEnd(18) + pct(T(n).aEind3).padEnd(18));

  console.log('\n--- herstel, behoud en hoeveel er verbouwd is ---');
  console.log('conditie'.padEnd(14) + 'hersteltijd'.padEnd(16) + 'niet hersteld'.padEnd(15) +
    'behoud (pp)'.padEnd(14) + 'ronden'.padEnd(10) + 'ronden na omslag 2');
  for (const n of namen) if (T(n)) console.log(n.padEnd(14) +
    (g1(T(n).hersteltijd) + ' pogingen').padEnd(16) +
    `${T(n).gecensureerd}/${T(n).runs}`.padEnd(15) +
    ((100 * T(n).behoud.m).toFixed(1)).padEnd(14) +
    g1(T(n).ronden).padEnd(10) + g1(T(n).rondenNa2));

  console.log('\n--- V1, de controle op de ingreep: vuurt de poort bij een omslag? ---');
  for (const t of poortToetsen) {
    if (t.soort === 'gezondheid') {
      console.log('gezondheid van de meting: ' + (t.alles ? 'in orde' : 'NIET IN ORDE') +
        '  ' + JSON.stringify(t.gezond));
      continue;
    }
    console.log(`poging ${String(t.omslag).padStart(3)} (${t.naarWat.padEnd(22)}) ` +
      `vuurkans ${(100 * t.vuurBuiten.m).toFixed(1)}% -> ${(100 * t.vuurNa.m).toFixed(1)}%   ` +
      `d ${t.dBuiten.m.toFixed(2)} -> ${t.dNa.m.toFixed(2)}   ` +
      (t.tekentoets ? `${t.tekentoets.positief}/${t.tekentoets.n} omhoog, p = ${t.tekentoets.p.toFixed(4)}   ` : '') +
      `eerste vuur na ${t.eersteVuur ? t.eersteVuur.m.toFixed(1) : '–'} pogingen ` +
      `(${t.nietGevuurd} levens niet)   ${t.oordeel}`);
  }

  console.log('\n--- Mann-Whitney, Holm per familie (nieuwe families, los van stap 13) ---');
  for (const t of toetsen) console.log(
    `${t.familie.padEnd(9)} ${t.maat.padEnd(12)} ${(t.conditie + ' vs ' + t.tegen).padEnd(30)} ` +
    `${(t.verschil >= 0 ? '+' : '−') + Math.abs(t.maat === 'hersteltijd' ? t.verschil : 100 * t.verschil).toFixed(1)}`.padEnd(9) +
    `   p = ${t.p.toFixed(4)}   Holm ${t.pHolm.toFixed(4)}   ${t.oordeelHolm}`);

  if (V4) console.log(`\n--- V4 beschrijvend --- signaal ${V4.signaal.m.toFixed(1)}, ` +
    `budget ${V4.budget.m.toFixed(1)}, klok ${V4.klok.m.toFixed(1)} pogingen; ` +
    `moment ${V4.signaalTegenBudget.toFixed(1)} tegen hoeveelheid ${V4.budgetTegenKlok.toFixed(1)} — ${V4.oordeel}`);

  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
