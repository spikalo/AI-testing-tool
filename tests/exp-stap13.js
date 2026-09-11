/* Stap 13 — de omslagproef: één leven, twee omslagen.

   Vijf condities × twaalf breinzaden = zestig levens van 900 pogingen. De fasen,
   de condities en de voorspellingen staan in tests/stap13-condities.js en zijn
   gecommit voordat deze loper voor het eerst gedraaid heeft (commit e2bbf09).

   Wat hier gemeten wordt en waarom het niet uit stap 12 kon komen: stap 12 traint
   elke architectuur apart op elke taakstand en vergelijkt eindprestaties. Daarmee
   is niets te zeggen over aanpassen, want een vast net dat je apart op A en op B
   traint krijgt óók twee verschillende gewichtssets. Aanpassing is alleen zichtbaar
   binnen één leven waarin de omgeving verandert terwijl het leren doorloopt.

   Hervatbaar op het niveau van het losse leven: wat al als JSON in
   experimenten/runs/ staat wordt overgenomen.
   ALLEEN=<naam>[,<naam>] draait één of enkele condities.                            */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { FASEN, CONDITIES, MEET_SEED0, MEET_N, MEETPUNT, MIDDEN,
  PLATEAU_VENSTER, HERSTEL_DREMPEL, OMSLAG_VENSTER, VOORSPELLINGEN } = require('./stap13-condities');

const OUT = path.resolve('experimenten');
const NSEEDS = +(process.env.NSEEDS || MEET_N);
const SEED0 = +(process.env.SEED0 || MEET_SEED0);
const BENCHN = +(process.env.BENCHN || 500);
const MEMN = +(process.env.MEMN || 100);
const ALLEEN = process.env.ALLEEN ? process.env.ALLEEN.split(',') : null;

const TOTAAL = FASEN.reduce((a, f) => a + f.pogingen, 0);
const GRENZEN = FASEN.map((f, i) => FASEN.slice(0, i + 1).reduce((a, g) => a + g.pogingen, 0));
const OMSLAG = GRENZEN.slice(0, -1);           /* de pogingen waarop de omgeving verandert */
const naamVan = n => `s13-${n}`;

/* Gecensureerd herstel krijgt een rang boven alles wat wél hersteld is. Dat is de
   eerlijke behandeling voor een rangtoets: we weten niet hóéveel langer, alleen dat
   het langer is dan het venster. Het getal zelf komt nooit in een gemiddelde terecht;
   het aantal gecensureerde levens wordt apart gerapporteerd. */
const CENSUUR = TOTAAL;

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
/* Tekentoets: gepaard, verdelingsvrij, en precies genoeg voor "gebeurt het vaker na
   de omslag dan ervoor?". Tweezijdig, exact binomiaal, gelijkspel telt niet mee. */
function tekentoets(verschillen) {
  const v = verschillen.filter(x => x !== null && isFinite(x) && x !== 0);
  const n = v.length; if (!n) return null;
  const k = v.filter(x => x > 0).length;
  const bin = (n, k) => { let c = 1; for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1); return c; };
  let p = 0;
  for (let i = 0; i <= n; i++) { const q = bin(n, i) * Math.pow(0.5, n); if (bin(n, i) <= bin(n, k) + 1e-9) p += q; }
  return { n, positief: k, p: Math.min(1, p) };
}

/* ---------- maten uit één leven ---------- */
function maten(row) {
  const H = row.historie || [];
  const succ = new Array(TOTAAL).fill(null);
  for (const h of H) if (h.poging >= 0 && h.poging < TOTAAL) succ[h.poging] = h.succes20;
  const gem = (van, tot) => {
    const v = succ.slice(van, tot).filter(x => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const om1 = OMSLAG[0], g2 = OMSLAG[1];
  const plateau = gem(om1 - PLATEAU_VENSTER, om1);
  const drempel = plateau === null ? null : HERSTEL_DREMPEL * plateau;

  /* hersteltijd: eerste poging na de terugslag naar A waarop succes20 het oude
     plateau weer haalt. Niet gehaald binnen de fase = gecensureerd, niet 300. */
  let hersteltijd = null;
  if (drempel !== null) for (let i = g2; i < TOTAAL; i++)
    if (succ[i] !== null && succ[i] >= drempel) { hersteltijd = i - g2; break; }

  /* de klap zelf: hoe diep zakt succes20 in de vijftig pogingen na elke omslag */
  const dip = OMSLAG.map(g => {
    const v = succ.slice(g, g + OMSLAG_VENSTER).filter(x => x !== null);
    return v.length ? Math.min(...v) : null;
  });

  /* herstructurering rond elke omslag: gebeurtenissen per poging, vóór en na */
  const L = row.herstructureringen || [];
  const som = (van, tot) => L.filter(e => e.ep > van && e.ep <= tot)
    .reduce((a, e) => a + (e.pruned || 0) + (e.sprouted || 0) + (e.retyped || 0) + (e.grown || 0), 0);
  const churn = OMSLAG.map(g => ({
    omslag: g,
    voor: som(g - OMSLAG_VENSTER, g) / OMSLAG_VENSTER,
    na: som(g, g + OMSLAG_VENSTER) / OMSLAG_VENSTER
  }));

  const F = (row.leven && row.leven.fasen) || [];
  const opA = i => (F[i] && F[i].opTaakA) ? F[i].opTaakA.pct : null;
  const opEigen = i => (F[i] && F[i].opEigenTaak) ? F[i].opEigenTaak.pct : null;

  return {
    zaad: row.breinZaad,
    plateau, hersteltijd, gecensureerd: hersteltijd === null,
    dipNaB: dip[0], dipNaTerug: dip[1],
    aEind1: opA(0), aEind2: opA(1), aEind3: opA(2),
    bScore: opEigen(1),
    /* behoud: wat er van taak A over is na de knipperfase. Negatief is vergeten. */
    behoud: (opA(1) !== null && opA(0) !== null) ? opA(1) - opA(0) : null,
    /* terugwinst: staat het leven aan het eind weer waar het stond vóór de omslag? */
    terugwinst: (opA(2) !== null && opA(0) !== null) ? opA(2) - opA(0) : null,
    churnVoor1: churn[0].voor, churnNa1: churn[0].na,
    churnVoor2: churn[1].voor, churnNa2: churn[1].na,
    horizon1: F[0] ? F[0].geheugenhorizon : null,
    horizon2: F[1] ? F[1].geheugenhorizon : null,
    horizon3: F[2] ? F[2].geheugenhorizon : null,
    benchEind: row.benchmark ? row.benchmark.beleid.pct : null,
    tijdMs: row.resultaat ? row.resultaat.rekentijdMs : null
  };
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

  const per = {};
  for (const cond of CONDITIES) {
    const naam = naamVan(cond.naam);
    per[naam] = [];
    for (let k = 0; k < NSEEDS; k++) {
      const zaad = SEED0 + k, t0 = Date.now();
      const jsonPad = path.join(OUT, 'runs', `${naam}_z${zaad}.json`);
      if (fs.existsSync(jsonPad)) {
        per[naam].push(maten(JSON.parse(fs.readFileSync(jsonPad, 'utf8'))));
        continue;
      }
      if (ALLEEN && !ALLEEN.includes(naam) && !ALLEEN.includes(cond.naam)) continue;
      const r = await p.evaluate(([zaad, naam, ov, lr, fasen, meet, totaal, bn, memn]) => {
        const W = window.__brain;
        let cfg = W.readCfg();
        cfg.nEpisodes = totaal; cfg.evalOn = false;
        cfg.benchOn = true; cfg.benchN = bn; cfg.benchReps = 1;
        cfg.memOn = true; cfg.memN = memn;
        cfg = W.cfgOverride(cfg, Object.assign({}, ov, { lr }));
        const row = W.runLeven(cfg, zaad, fasen, naam, meet);
        return { csv: W.csvRow(row), json: row };
      }, [zaad, naam, cond.ov, cond.lr, FASEN, MEETPUNT, TOTAAL, BENCHN, MEMN]);
      if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
      lines.push(r.csv);
      fs.writeFileSync(csvPad, lines.join('\n') + '\n');
      fs.writeFileSync(jsonPad, JSON.stringify(r.json, null, 2));
      const m = maten(r.json);
      per[naam].push(m);
      console.log(`${naam.padEnd(18)} zaad ${zaad}: ` +
        `A1 ${(100 * m.aEind1).toFixed(0)}%  B ${(100 * m.bScore).toFixed(0)}%  ` +
        `A-na-B ${(100 * m.aEind2).toFixed(0)}%  A2 ${(100 * m.aEind3).toFixed(0)}%  ` +
        `herstel ${m.hersteltijd === null ? 'niet' : m.hersteltijd + 'p'}  ` +
        `churn ${m.churnVoor2.toFixed(2)}->${m.churnNa2.toFixed(2)}  ` +
        `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }

  /* ---------- tabel ---------- */
  const MATEN = ['plateau', 'aEind1', 'bScore', 'aEind2', 'aEind3', 'behoud', 'terugwinst',
    'dipNaB', 'dipNaTerug', 'hersteltijd', 'churnVoor1', 'churnNa1', 'churnVoor2', 'churnNa2',
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

  const PAREN = [
    ['ang-vast', 'ang', 'V1 – wat structurele plasticiteit oplevert bij een omslag'],
    ['ang', 'ang-geensnoei', 'V4 – of het snoeien het herstel in de weg zit'],
    ['elman-16-bp', 'ang', 'V5 – tegen het vaste recurrente net met BPTT'],
    ['mlp-16-bp', 'ang', 'tegen het geheugenloze net met BPTT']
  ];
  /* Twee families: herstelsnelheid en behoud. Ze beantwoorden verschillende vragen
     en worden dus apart gecorrigeerd. */
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

  /* V2: piekt de herstructurering na een omslag? Gepaard per zaad, per omslag,
     voor elke conditie die überhaupt herstructureert. */
  const churnToetsen = [];
  for (const cond of CONDITIES) {
    const naam = naamVan(cond.naam), R = per[naam] || [];
    if (!R.length || !R.some(r => r.churnVoor1 > 0 || r.churnNa1 > 0)) continue;
    for (const [i, van, naar] of [[0, 'churnVoor1', 'churnNa1'], [1, 'churnVoor2', 'churnNa2']]) {
      const d = R.map(r => r[naar] - r[van]);
      const tt = tekentoets(d);
      churnToetsen.push({ conditie: cond.naam, omslag: OMSLAG[i],
        naarWat: i === 0 ? 'naar knipperen' : 'terug naar zichtbaar',
        voor: mci(R.map(r => r[van])), na: mci(R.map(r => r[naar])),
        verschil: mci(d), tekentoets: tt,
        oordeel: tt && tt.p < 0.05 ? (mci(d).m > 0 ? 'piek na de omslag' : 'juist minder na de omslag')
          : 'binnen de ruis' });
    }
  }

  fs.writeFileSync(path.join(OUT, 'omslag.json'), JSON.stringify({
    uitgevoerd: new Date().toISOString(),
    beschrijving: 'Werkplan stap 13: de omslagproef. Eén doorlopend leven van ' + TOTAAL + ' pogingen ' +
      'waarin de omgeving twee keer verandert zonder waarschuwing en zonder reset: eerst is het doel ' +
      'altijd zichtbaar, dan knippert het (tien stappen aan, ' + MIDDEN + ' uit), dan is het weer altijd ' +
      'zichtbaar. Het brein, de gewichten, de sporen en de exploratieafbouw lopen door over alle drie de ' +
      'fasen heen; alleen de omgeving schakelt. Dit is de enige opzet in dit werk waarin aanpassing ' +
      'binnen één leven meetbaar is: twee taken apart trainen en de uitkomsten vergelijken zegt er niets ' +
      'over, want dan krijgt een vast net ook twee verschillende gewichtssets.',
    fasen: FASEN, grenzen: GRENZEN, omslagpogingen: OMSLAG,
    zaden: NSEEDS, eersteZaad: SEED0,
    meetpunt: MEETPUNT, benchmarkEind: { werelden: BENCHN, herhalingen: 1 },
    herstelregel: { plateauVenster: PLATEAU_VENSTER, drempel: HERSTEL_DREMPEL,
      omslagVenster: OMSLAG_VENSTER, censuurwaarde: CENSUUR,
      uitleg: 'Het plateau is het gemiddelde van succes20 over de laatste ' + PLATEAU_VENSTER +
        ' pogingen van fase A1. Hersteld heet het leven op de eerste poging na de terugslag waarop ' +
        'succes20 weer boven ' + HERSTEL_DREMPEL + ' × plateau ligt. Wordt dat binnen de derde fase niet ' +
        'gehaald, dan is de waarneming gecensureerd en krijgt hij in de rangtoets een waarde boven alles ' +
        'wat wél hersteld is; in gemiddelden telt hij niet mee.' },
    condities: Object.fromEntries(CONDITIES.map(c => [c.naam, { lr: c.lr, ov: c.ov, rol: c.rol }])),
    voorspellingen: VOORSPELLINGEN,
    tabel, toetsen, churnToetsen, perZaad: per
  }, null, 2));

  /* ---------- uitvoer ---------- */
  const namen = CONDITIES.map(c => c.naam);
  const T = n => tabel[naamVan(n)];
  console.log('\n--- het leven in vier meetpunten (benchmark, geloot) ---');
  console.log('conditie'.padEnd(16) + 'A1 eind'.padEnd(18) + 'B op B'.padEnd(18) +
    'A na B'.padEnd(18) + 'A2 eind'.padEnd(18));
  for (const n of namen) if (T(n)) console.log(n.padEnd(16) +
    pct(T(n).aEind1).padEnd(18) + pct(T(n).bScore).padEnd(18) +
    pct(T(n).aEind2).padEnd(18) + pct(T(n).aEind3).padEnd(18));

  console.log('\n--- herstel en behoud ---');
  console.log('conditie'.padEnd(16) + 'hersteltijd'.padEnd(16) + 'niet hersteld'.padEnd(15) +
    'behoud (pp)'.padEnd(16) + 'terugwinst (pp)'.padEnd(16));
  for (const n of namen) if (T(n)) console.log(n.padEnd(16) +
    (g1(T(n).hersteltijd) + ' pogingen').padEnd(16) +
    `${T(n).gecensureerd}/${T(n).runs}`.padEnd(15) +
    ((100 * T(n).behoud.m).toFixed(1)).padEnd(16) +
    ((100 * T(n).terugwinst.m).toFixed(1)).padEnd(16));

  console.log('\n--- herstructurering per poging, rond elke omslag ---');
  for (const t of churnToetsen) console.log(
    `${t.conditie.padEnd(16)} poging ${String(t.omslag).padStart(3)} (${t.naarWat.padEnd(22)}) ` +
    `${t.voor.m.toFixed(2)} -> ${t.na.m.toFixed(2)}   ` +
    (t.tekentoets ? `${t.tekentoets.positief}/${t.tekentoets.n} omhoog, p = ${t.tekentoets.p.toFixed(4)}   ` : '') +
    t.oordeel);

  console.log('\n--- Mann-Whitney, Holm per familie ---');
  for (const t of toetsen) console.log(
    `${t.familie.padEnd(9)} ${t.maat.padEnd(12)} ${(t.conditie + ' vs ' + t.tegen).padEnd(28)} ` +
    `${(t.verschil >= 0 ? '+' : '−') + Math.abs(t.maat === 'hersteltijd' ? t.verschil : 100 * t.verschil).toFixed(1)}`.padEnd(9) +
    `   p = ${t.p.toFixed(4)}   Holm ${t.pHolm.toFixed(4)}   ${t.oordeelHolm}`);

  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
