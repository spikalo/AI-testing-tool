/* Stap 9 — het raster dichtheid x neuronen.

   Twee ronden. Eerst de leersnelheidsveeg per (grootte x stand) op eigen zaden, dan
   het raster op de meetzaden met de gekozen leersnelheid. De veeg schrijft zijn
   uitkomst weg in experimenten/lr-veeg-stap9.json, zodat achteraf na te gaan is welke
   waarde is gekozen en hoe dicht de nummer twee erbij lag — een veeg waarvan alleen
   de winnaar bewaard wordt, is geen veeg maar een bewering.

   Hervatbaar op het niveau van het losse leven. ALLEEN=veeg of ALLEEN=raster draait
   één van beide ronden.

   Draaien: tests\draai.cmd exp-stap9.js s9-log.txt                                   */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { NEURONEN, DICHTHEDEN, STANDEN, soortgrenzen, VOORSPELLINGEN,
  VEEG_LR, VEEG_SEED0, VEEG_N, MEET_SEED0, MEET_N, POGINGEN } = require('./stap9-condities');

const OUT = path.resolve('experimenten');
const NSEEDS = +(process.env.NSEEDS || MEET_N);
const BENCHN = +(process.env.BENCHN || 500);
const MEMN = +(process.env.MEMN || 100);
const ALLEEN = process.env.ALLEEN || null;
/* Het meetpunt op de fasegrens: de score op de stand van dat moment, de score op taak A
   als ijkpunt, en de blinderingsproef. Dezelfde vorm als stap 13, maar met de volle
   benchmarkset, want hier is er één fasegrens per leven en geen zes. */
const MEETPUNT = { benchN: BENCHN, benchReps: 1, memN: MEMN, memBlind: 20, memH: 40 };
/* De veeg draait op de middelste dichtheid, niet op een met de hand ingetypt getal:
   anders veegt hij een cel die in het raster niet voorkomt. */
const STANDAARD_D = DICHTHEDEN[Math.floor(DICHTHEDEN.length / 2)];

const mci = xs => {
  const v = xs.filter(x => x !== null && x !== undefined && isFinite(x));
  const n = v.length; if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, m, sd, ci: 1.96 * sd / Math.sqrt(n) };
};
const pct = o => o ? `${(100 * o.m).toFixed(1)}±${(100 * o.ci).toFixed(1)}` : '  –  ';
/* Spearman, want de vraag bij V4 is of een maat meeloopt met de grootte en niet of
   hij dat lineair doet. */
function spearman(xs, ys) {
  const paren = xs.map((x, i) => [x, ys[i]]).filter(p =>
    p[0] !== null && p[1] !== null && isFinite(p[0]) && isFinite(p[1]));
  const n = paren.length; if (n < 4) return null;
  const rang = kol => {
    const idx = kol.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(kol.length);
    let i = 0;
    while (i < idx.length) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const gem = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = gem;
      i = j + 1;
    }
    return r;
  };
  const a = rang(paren.map(p => p[0])), b = rang(paren.map(p => p[1]));
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
  return (sa && sb) ? { n, rho: sab / Math.sqrt(sa * sb) } : null;
}

/* De maten die uit één run komen. Naast de score de vier diagnostische maten van V4.
   `randdruk` is de gemiddelde gewichtsgrootte gedeeld door het gewichtsplafond: hoe
   dichter tegen één, hoe harder het netwerk zijn parameters tegen de rand duwt. Die
   deling hoort hier en niet in de tabel, want wmax is een instelling en een verhouding
   is pas vergelijkbaar als de noemer erin zit. */
function maten(row) {
  const s = row.structuur || {}, cfg = row.config || {};
  const wmax = (cfg.leren && cfg.leren.maxGewicht) || null;
  /* De uitkomstmaat is de score op de stand waarop getraind is, en die staat in de
     fasemeting — niet in row.benchmark. Dat laatste veld meet altijd taak A, ook na
     training op een knipperende stand, omdat het bedoeld is als de enige kolom in
     runs.csv die over alle metingen heen vergelijkbaar is. Wie hem hier zou gebruiken,
     meet op B-20 hoe goed het netwerk taak A nog kan — een andere vraag, en een die
     bij toeval bijna hetzelfde eruitziet. */
  const F = (row.leven && row.leven.fasen && row.leven.fasen[0]) || {};
  return {
    zaad: row.breinZaad,
    bench: F.opEigenTaak ? F.opEigenTaak.pct : null,
    benchOpA: F.opTaakA ? F.opTaakA.pct : (row.benchmark ? row.benchmark.beleid.pct : null),
    horizon: F.geheugenhorizon !== undefined ? F.geheugenhorizon : null,
    succes20: row.resultaat ? row.resultaat.succes20 : null,
    verbindingen: s.verbindingen !== undefined ? s.verbindingen : null,
    actief: s.actieveVerbindingen !== undefined ? s.actieveVerbindingen : null,
    randdruk: (wmax && s.gemAbsW !== undefined) ? s.gemAbsW / wmax : null,
    losgeraakt: s.losgeraakt !== undefined ? s.losgeraakt : null,
    meedoend: s.meedoendeNeuronen !== undefined ? s.meedoendeNeuronen : null,
    neuronenEind: (cfg.neuronenNu !== undefined) ? cfg.neuronenNu : null,
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

  /* Eén leven. De overrides worden hier samengesteld zodat veeg en raster gegarandeerd
     dezelfde conditie draaien op alles behalve de leersnelheid. */
  function overrides(N, D, stand) {
    return Object.assign({ nNeurons: N, density: D, goalBlink: stand.blink }, soortgrenzen(N));
  }
  async function leef(naam, zaad, ov, lr) {
    const jsonPad = path.join(OUT, 'runs', `${naam}_z${zaad}.json`);
    if (fs.existsSync(jsonPad)) return JSON.parse(fs.readFileSync(jsonPad, 'utf8'));
    const t0 = Date.now();
    const r = await p.evaluate(([zaad, naam, ov, lr, pogingen, bn, memn, meet]) => {
      const W = window.__brain;
      let cfg = W.readCfg();
      cfg.nEpisodes = pogingen; cfg.evalOn = false;
      cfg.benchOn = true; cfg.benchN = bn; cfg.benchReps = 1;
      cfg.memOn = true; cfg.memN = memn;
      cfg = W.cfgOverride(cfg, Object.assign({}, ov, { lr }));
      /* Eén fase, maar mét meetpunt: de fasemeting levert de score op de stand waarop
         getraind is, en die is hier de uitkomstmaat. */
      const row = W.runLeven(cfg, zaad, [{ naam: 'enig', pogingen, ov: {} }], naam, meet);
      return { csv: W.csvRow(row), json: row };
    }, [zaad, naam, ov, lr, POGINGEN, BENCHN, MEMN, MEETPUNT]);
    if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
    lines.push(r.csv);
    fs.writeFileSync(csvPad, lines.join('\n') + '\n');
    fs.writeFileSync(jsonPad, JSON.stringify(r.json, null, 2));
    r.json.__seconden = (Date.now() - t0) / 1000;
    return r.json;
  }

  /* ---------- ronde 1: de leersnelheidsveeg, per grootte x stand ---------- */
  const veegPad = path.join(OUT, 'lr-veeg-stap9.json');
  let veeg = fs.existsSync(veegPad) ? JSON.parse(fs.readFileSync(veegPad, 'utf8')) : null;
  if (!veeg && ALLEEN !== 'raster') {
    console.log('--- leersnelheidsveeg, eigen zaden, dichtheid op de standaard ---');
    console.log('grootte'.padEnd(10) + 'stand'.padEnd(8) + VEEG_LR.map(l => String(l).padEnd(14)).join('') + 'gekozen');
    const uit = {};
    for (const N of NEURONEN) for (const stand of STANDEN) {
      const sleutel = `n${N}-${stand.naam}`;
      const rij = [];
      for (const lr of VEEG_LR) {
        const scores = [];
        for (let k = 0; k < VEEG_N; k++) {
          const zaad = VEEG_SEED0 + k;
          const json = await leef(`s9veeg-n${N}-${stand.naam}-lr${lr}`, zaad, overrides(N, STANDAARD_D, stand), lr);
          scores.push(maten(json).bench);
        }
        rij.push({ lr, score: mci(scores) });
      }
      const beste = rij.reduce((a, c) => (c.score && (!a.score || c.score.m > a.score.m)) ? c : a, rij[0]);
      /* de nummer twee erbij, zodat zichtbaar is of de keuze iets voorstelde */
      const rest = rij.filter(r => r !== beste).sort((a, c) => (c.score ? c.score.m : 0) - (a.score ? a.score.m : 0));
      uit[sleutel] = { neuronen: N, stand: stand.naam, kandidaten: rij, gekozen: beste.lr,
        marge: (beste.score && rest[0] && rest[0].score) ? beste.score.m - rest[0].score.m : null };
      console.log(`${N}`.padEnd(10) + stand.naam.padEnd(8) +
        rij.map(r => pct(r.score).padEnd(14)).join('') + beste.lr);
    }
    veeg = { uitgevoerd: new Date().toISOString(),
      beschrijving: 'Leersnelheidsveeg voor stap 9, per grootte x taakstand, op eigen zaden ' +
        '(' + VEEG_SEED0 + '..) en op de standaarddichtheid. De dichtheid wordt niet meegeveegd: ' +
        'snoeien en aangroeien brengen elke cel binnen enkele ronden naar haar eigen evenwicht, ' +
        'zodat de startdichtheid de leersnelheid nauwelijks raakt. Alle kandidaten staan erin, ' +
        'niet alleen de winnaar.',
      kandidaten: VEEG_LR, zaden: VEEG_N, eersteZaad: VEEG_SEED0, pogingen: POGINGEN, perCel: uit };
    fs.writeFileSync(veegPad, JSON.stringify(veeg, null, 2));
  }
  const lrVan = (N, stand) => {
    const c = veeg && veeg.perCel[`n${N}-${stand.naam}`];
    return c ? c.gekozen : 0.008;
  };

  /* ---------- ronde 2: het raster ---------- */
  const cel = {};
  if (ALLEEN !== 'veeg') {
    console.log('\n--- het raster ---');
    for (const stand of STANDEN) for (const N of NEURONEN) for (const D of DICHTHEDEN) {
      const naam = `s9-n${N}-d${D}-${stand.naam}`;
      const lr = lrVan(N, stand);
      const rijen = [];
      for (let k = 0; k < NSEEDS; k++) {
        const json = await leef(naam, MEET_SEED0 + k, overrides(N, D, stand), lr);
        rijen.push(maten(json));
      }
      const MT = ['bench', 'horizon', 'succes20', 'verbindingen', 'actief', 'randdruk',
        'losgeraakt', 'meedoend', 'neuronenEind', 'tijdMs'];
      cel[naam] = { neuronen: N, dichtheid: D, stand: stand.naam, lr, runs: rijen.length, perZaad: rijen };
      for (const m of MT) cel[naam][m] = mci(rijen.map(r => r[m]));
      console.log(`${stand.naam.padEnd(5)} n=${String(N).padStart(3)} d=${String(D).padEnd(4)} lr=${String(lr).padEnd(6)} ` +
        `bench ${pct(cel[naam].bench)}  horizon ${cel[naam].horizon ? cel[naam].horizon.m.toFixed(1).padStart(5) : '  –  '}  ` +
        `randdruk ${cel[naam].randdruk ? cel[naam].randdruk.m.toFixed(3) : '  –  '}  ` +
        `los ${cel[naam].losgeraakt ? cel[naam].losgeraakt.m.toFixed(1).padStart(5) : '  –  '}`);
    }
  }

  /* ---------- analyse ---------- */
  /* VERZADIGING VAN DE DICHTHEIDSAS. Tijdens het draaien bleek iets wat vooraf niet
     was voorzien: bij kleine netwerken leveren twee verschillende dichtheden exact
     hetzelfde netwerk op. De reden staat in createBrain — het aantal verbindingen is
     `min(aantal legale paren, dichtheid x (neuronen + invoer))`, en bij weinig neuronen
     loopt die eerste term als eerste vol. Boven het plafond doet de knop niets meer.
     Dat is geen meetfout maar een eigenschap van het model, en het is zelf een antwoord
     op de vraag van deze stap. Het wordt hier gedetecteerd in plaats van weggepoetst, en
     V5 wordt daarna alleen op de cellen beoordeeld waar de as werkelijk beweegt. */
  for (const naam in cel) {
    const c = cel[naam];
    const lager = Object.values(cel).filter(x => x.stand === c.stand && x.neuronen === c.neuronen
      && x.dichtheid < c.dichtheid && x.verbindingen && c.verbindingen);
    c.verzadigd = lager.some(x => Math.abs(x.verbindingen.m - c.verbindingen.m) < 1e-9);
  }

  const perStand = {};
  for (const stand of STANDEN) {
    const cellen = Object.values(cel).filter(c => c.stand === stand.naam);
    if (!cellen.length) continue;
    /* DE GROOTTE-AS WORDT OP DE BESTE DICHTHEID GELEZEN, niet op het gemiddelde over de
       drie. Twee redenen, en ze wijzen dezelfde kant op.

       De eerste is dat middelen hier ongelijke dingen optelt: bij acht neuronen zijn twee
       van de drie dichtheden verzadigd en dus dezelfde cel, bij zestig geen enkele. Een
       gemiddelde weegt de maten dan ongelijk zonder dat iemand daarom gevraagd heeft.

       De tweede weegt zwaarder. De laagste dichtheid blijkt bij de grote netwerken
       rampzalig — honderdtwintig neuronen halen op dichtheid 15 minder dan acht neuronen
       op hun beste dichtheid. Middel je die cel mee, dan meet de grootte-as voor een derde
       "hoe erg is te dun bedraad zijn", en dat is de vraag van de ándere as. De vraag
       "hoe groot moet mijn netwerk zijn" veronderstelt dat je het daarna fatsoenlijk
       bedraadt, en zo wordt hij hier ook beantwoord: per grootte de beste van de drie
       dichtheden, met de cel op de standaarddichtheid ernaast zodat beide zichtbaar zijn. */
    const perN = NEURONEN.map(N => {
      const c = cellen.filter(x => x.neuronen === N && x.bench);
      if (!c.length) return null;
      const beste = c.reduce((a, x) => x.bench.m > a.bench.m ? x : a, c[0]);
      const standaard = c.find(x => x.dichtheid === STANDAARD_D) || beste;
      return { neuronen: N,
        besteDichtheid: beste.dichtheid, bench: beste.bench,
        horizon: beste.horizon, randdruk: beste.randdruk, losgeraakt: beste.losgeraakt,
        meedoend: beste.meedoend, neuronenEind: beste.neuronenEind,
        spreidingTussenZaden: { n: beste.runs, m: beste.bench.sd, sd: 0, ci: 0 },
        bijStandaardDichtheid: standaard.bench,
        verzadigdeCellen: c.filter(x => x.verzadigd).length };
    }).filter(Boolean);
    const top = perN.reduce((a, c) => c.bench.m > a.bench.m ? c : a, perN[0]);
    const kleinste = perN[0], grootste = perN[perN.length - 1];
    /* V5: spreiding over dichtheden binnen een maat tegen die over maten binnen een dichtheid */
    const overDichtheid = mci(NEURONEN.map(N => {
      const v = cellen.filter(x => x.neuronen === N && x.bench).map(x => x.bench.m);
      return v.length > 1 ? Math.max(...v) - Math.min(...v) : null;
    }));
    const overGrootte = mci(DICHTHEDEN.map(D => {
      const v = cellen.filter(x => x.dichtheid === D && x.bench).map(x => x.bench.m);
      return v.length > 1 ? Math.max(...v) - Math.min(...v) : null;
    }));
    /* V4: loopt elke diagnostische maat mee met de grootte? Over alle losse runs. */
    const alleRuns = [].concat(...cellen.map(c => c.perZaad.map(r => Object.assign({ neuronen: c.neuronen }, r))));
    const rho = m => spearman(alleRuns.map(r => r.neuronen), alleRuns.map(r => r[m]));
    /* En de vraag die er praktisch toe doet, en die V4 eigenlijk stelt: voorspelt de maat
       de SCORE? Meelopen met de grootte is niet genoeg — het aantal neuronen kun je zelf
       aflezen, daar heb je geen maat voor nodig. Een diagnostische maat is pas iets waard
       als hij zegt hoe goed het netwerk het doet zonder dat je een tweede netwerk hoeft te
       trainen om mee te vergelijken. Op celniveau, want de ruis per run is groot. */
    const cellenMetScore = cellen.filter(c => c.bench);
    const rhoScore = m => spearman(cellenMetScore.map(c => c[m] ? c[m].m : null),
      cellenMetScore.map(c => c.bench.m));
    perStand[stand.naam] = {
      perN,
      optimum: top.neuronen,
      optimumOpRand: top.neuronen === NEURONEN[0] || top.neuronen === NEURONEN[NEURONEN.length - 1],
      valNaarGroot: top.bench.m - grootste.bench.m,
      valNaarKlein: top.bench.m - kleinste.bench.m,
      spreidingOverDichtheid: overDichtheid, spreidingOverGrootte: overGrootte,
      diagnostisch: { randdruk: rho('randdruk'), horizon: rho('horizon'),
        losgeraakt: rho('losgeraakt'), meedoend: rho('meedoend') },
      diagnostischTegenScore: { randdruk: rhoScore('randdruk'), horizon: rhoScore('horizon'),
        losgeraakt: rhoScore('losgeraakt'), meedoend: rhoScore('meedoend'),
        verbindingen: rhoScore('verbindingen'), actief: rhoScore('actief') },
      /* waar de dichtheidsknop ophoudt iets te doen, per grootte */
      verzadiging: NEURONEN.map(N => {
        const rij = DICHTHEDEN.map(D => cellen.find(x => x.neuronen === N && x.dichtheid === D)).filter(Boolean);
        const eerste = rij.find(x => x.verzadigd);
        return { neuronen: N, verbindingen: rij.map(x => x.verbindingen ? Math.round(x.verbindingen.m) : null),
          plafondVanaf: eerste ? eerste.dichtheid : null };
      })
    };
  }

  fs.writeFileSync(path.join(OUT, 'capaciteitsraster.json'), JSON.stringify({
    uitgevoerd: new Date().toISOString(),
    beschrijving: 'Werkplan stap 9: een raster van netwerkgrootte x startdichtheid op twee ' +
      'taakstanden. De vraag is niet alleen welke grootte het beste scoort, maar waaraan je aan ' +
      'een getraind netwerk kunt zien dat het te klein of te groot is — daarom staan naast de ' +
      'benchmarkscore vier structurele maten die tot nu toe geen taak hadden waarop zij iets ' +
      'konden betekenen. De soortenverdeling schaalt mee met de grootte, zodat er niet twee ' +
      'dingen tegelijk variëren.',
    neuronen: NEURONEN, dichtheden: DICHTHEDEN, standen: STANDEN,
    pogingen: POGINGEN, zaden: NSEEDS, eersteZaad: MEET_SEED0,
    benchmark: { werelden: BENCHN, herhalingen: 1 }, geheugenproef: { werelden: MEMN },
    leersnelheidsveeg: veeg ? { kandidaten: veeg.kandidaten, zaden: veeg.zaden,
      eersteZaad: veeg.eersteZaad, perCel: veeg.perCel } : null,
    voorspellingen: VOORSPELLINGEN,
    cellen: cel, perStand
  }, null, 2));

  /* ---------- uitvoer ---------- */
  for (const stand of STANDEN) {
    const P = perStand[stand.naam]; if (!P) continue;
    console.log(`\n=== ${stand.naam} (${stand.omschrijving}) ===`);
    console.log('neuronen'.padEnd(10) + 'beste d'.padEnd(9) + 'benchmark'.padEnd(14) +
      'bij d=' + STANDAARD_D + '    ' + 'horizon'.padEnd(12) +
      'randdruk'.padEnd(12) + 'losgeraakt'.padEnd(12) + 'sd tussen zaden');
    for (const r of P.perN) console.log(String(r.neuronen).padEnd(10) +
      String(r.besteDichtheid).padEnd(9) + pct(r.bench).padEnd(14) +
      pct(r.bijStandaardDichtheid).padEnd(12) +
      (r.horizon ? r.horizon.m.toFixed(1) : '–').padEnd(12) +
      (r.randdruk ? r.randdruk.m.toFixed(3) : '–').padEnd(12) +
      (r.losgeraakt ? r.losgeraakt.m.toFixed(1) : '–').padEnd(12) +
      (r.spreidingTussenZaden ? (100 * r.spreidingTussenZaden.m).toFixed(1) + ' pp' : '–'));
    console.log(`optimum bij ${P.optimum} neuronen${P.optimumOpRand ? '  — LET OP: op de rand van het raster' : ''}; ` +
      `val naar de grootste maat ${(100 * P.valNaarGroot).toFixed(1)} pp, naar de kleinste ${(100 * P.valNaarKlein).toFixed(1)} pp`);
    console.log(`spreiding over de dichtheden ${(100 * P.spreidingOverDichtheid.m).toFixed(1)} pp, ` +
      `over de maten ${(100 * P.spreidingOverGrootte.m).toFixed(1)} pp`);
    console.log('verbindingen per grootte over de drie dichtheden (plafond waar de knop ophoudt):');
    for (const v of P.verzadiging) console.log(`  n=${String(v.neuronen).padStart(3)}  ` +
      v.verbindingen.map(x => String(x).padStart(5)).join(' ') +
      (v.plafondVanaf ? `   plafond bereikt vanaf dichtheid ${v.plafondVanaf}` : '   geen plafond binnen dit raster'));
    console.log('rangcorrelatie met het aantal neuronen: ' +
      Object.entries(P.diagnostisch).map(([k, v]) => `${k} ${v ? v.rho.toFixed(2) : '–'}`).join(', '));
    console.log('rangcorrelatie met de SCORE (per cel) — dit is wat een diagnose waard maakt: ' +
      Object.entries(P.diagnostischTegenScore).map(([k, v]) => `${k} ${v ? v.rho.toFixed(2) : '–'}`).join(', '));
  }

  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
