/* Stap 12 – de taakas: wat gebeurt er als het doel verdwijnt?

   Vier architecturen – vier standen van de taakas – twaalf breinzaden = 192 runs.
   De voorspellingen staan in tests/stap12-condities.js en zijn gecommit voordat deze
   loper voor het eerst gedraaid heeft.

   Drie soorten vergelijking, en ze meten alle drie iets anders:
     binnen een taakstand   ang tegen ang-vast – de onderzoeksvraag zelf;
                            elman tegen mlp    – wat terugkoppeling waard is;
     over de taakas heen    groeit het verschil ang − ang-vast naarmate het doel
                            eerder verdwijnt? Dat is een interactie, en die wordt
                            gepaard per zaad getoetst: dezelfde breinzaden in beide
                            standen, dus het verschil per zaad is een waarneming.

   Hervatbaar: wat al in runs.csv staat wordt overgenomen.
   ALLEEN=<naam>[,<naam>] draait één of enkele condities.                          */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { ARCHITECTUREN, TAAKAS, VOORSPELLINGEN, MEET_SEED0, MEET_N } = require('./stap12-condities');

const OUT = path.resolve('experimenten');
const NSEEDS = +(process.env.NSEEDS || MEET_N);
const NEP = +(process.env.NEP || 500);
const SEED0 = +(process.env.SEED0 || MEET_SEED0);
const BENCHN = +(process.env.BENCHN || 500);
const BENCHREPS = +(process.env.BENCHREPS || 3);
const MEMN = +(process.env.MEMN || 100);
const ALLEEN = process.env.ALLEEN ? process.env.ALLEEN.split(',') : null;

const naamVan = (arch, blink) => `s12-${arch}-b${blink}`;

const mci = xs => {
  const v = xs.filter(x => x !== null && x !== undefined && isFinite(x));
  const n = v.length; if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, m, sd, ci: 1.96 * sd / Math.sqrt(n) };
};
const pct = o => o ? `${(100 * o.m).toFixed(1)}% ± ${(100 * o.ci).toFixed(1)}` : '–';
const g2 = o => o ? o.m.toFixed(2) : '–';
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
const uitCsv = r => ({
  zaad: r.breinZaad, lr: r.lr, goalHide: r.goalHide, goalBlink: r.goalBlink, succes20: r.succes20,
  benchBeleid: r.benchBeleid, benchStreng: r.benchStreng, benchStappen: r.benchStappen,
  memHorizon: leeg(r.memHorizon), memCos: leeg(r.memCos), memCosBlind: leeg(r.memCosBlind),
  verbindingen: r.verbindingen, actief: r.actieveVerbindingen, neuronen: r.neuronenEind,
  pad: r.kortstePad, lussen: r.lussen, reflexbogen: r.reflexbogen, mem: r.mem,
  /* de herstructureringsactiviteit zelf: als plasticiteit onder knipperen schaadt,
     hoort dat hier zichtbaar te zijn */
  gesnoeid: r.gesnoeid, bijgegroeid: r.bijgegroeid, hertypeerd: r.typeVeranderingen,
  tijdMs: r.rekentijdMs, stappenTot80: leeg(r.stappenTot80)
});
function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const uit = new Array(ps.length); let vorige = 0;
  idx.forEach(([p, i], k) => {
    const a = Math.min(1, Math.max(vorige, (ps.length - k) * p));
    uit[i] = a; vorige = a;
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
  if (lines[0] !== hdr) throw new Error('runs.csv heeft andere kolommen dan de pagina – draai tests/migreer-runs-csv.js');

  /* Leersnelheden. Op taak A (blink 0) draait elke architectuur op de waarde die de
     veeg van stap 6 of 7 voor haar koos – dat is per definitie de goede waarde voor
     die taak, en het houdt de kolom vergelijkbaar met alles wat er al gemeten is. Op
     de knipperstanden gebruikt ANG de waarde uit de veeg van stap 12a, want een
     uitspraak ten nadele van ANG mag niet op andermans afstelling rusten. De vaste
     basislijnen blijven op hun waarde van stap 6; dat werkt in het voordeel van ANG
     en maakt een negatieve conclusie over ANG dus conservatief. */
  const veegPad = path.join(OUT, 'lr-veeg-stap12-b20.json');
  const veeg = fs.existsSync(veegPad) ? JSON.parse(fs.readFileSync(veegPad, 'utf8')) : null;
  const lrVoor = (arch, blink) => (blink > 0 && veeg && veeg.keuze[arch.naam])
    ? veeg.keuze[arch.naam].lr : arch.lr;

  const per = {};
  for (const taak of TAAKAS) for (const arch of ARCHITECTUREN) {
    const naam = naamVan(arch.naam, taak.blink);
    const gedaan = new Map(leesCsv(csvPad).filter(r => r.conditie === naam).map(r => [r.breinZaad, uitCsv(r)]));
    per[naam] = [];
    for (let k = 0; k < NSEEDS; k++) {
      const zaad = SEED0 + k, t0 = Date.now();
      if (gedaan.has(zaad)) { per[naam].push(gedaan.get(zaad)); continue; }
      if (ALLEEN && !ALLEEN.includes(naam) && !ALLEEN.includes(arch.naam)) continue;
      const r = await p.evaluate(([zaad, nep, naam, ov, bn, br, lr, blink, memn]) => {
        const W = window.__brain;
        let cfg = W.readCfg();
        cfg.nEpisodes = nep; cfg.evalOn = true;
        cfg.benchOn = true; cfg.benchN = bn; cfg.benchReps = br;
        cfg.memOn = true; cfg.memN = memn;
        cfg = W.cfgOverride(cfg, Object.assign({}, ov, { lr, goalBlink: blink }));
        const row = W.runOne(cfg, zaad, naam);
        return { csv: W.csvRow(row), json: row };
      }, [zaad, NEP, naam, arch.ov, BENCHN, BENCHREPS, lrVoor(arch, taak.blink), taak.blink, MEMN]);
      if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
      lines.push(r.csv);
      fs.writeFileSync(csvPad, lines.join('\n') + '\n');
      fs.writeFileSync(path.join(OUT, 'runs', `${naam}_z${zaad}.json`), JSON.stringify(r.json, null, 2));
      const m = uitCsv(ontleed(H, r.csv));
      per[naam].push(m);
      console.log(`${naam.padEnd(20)} zaad ${zaad}: benchmark ${(100 * m.benchBeleid).toFixed(1)}%  ` +
        `horizon ${String(m.memHorizon).padStart(2)}  cos ${m.memCos.toFixed(3)} (blind ${m.memCosBlind.toFixed(3)})  ` +
        `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }

  /* ---------- tabel ---------- */
  const maten = ['succes20', 'benchBeleid', 'benchStreng', 'benchStappen', 'memHorizon', 'memCos',
    'memCosBlind', 'verbindingen', 'actief', 'neuronen', 'pad', 'lussen', 'reflexbogen', 'mem',
    'gesnoeid', 'bijgegroeid', 'hertypeerd', 'tijdMs', 'stappenTot80'];
  const tabel = {};
  for (const naam in per) if (per[naam].length) {
    tabel[naam] = { runs: per[naam].length };
    for (const m of maten) tabel[naam][m] = mci(per[naam].map(r => r[m]));
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

  /* Binnen elke taakstand: de drie vergelijkingen die iets betekenen, per maat een
     familie met Holm-correctie. */
  const PAREN = [
    ['ang-vast', 'ang', 'wat structurele plasticiteit oplevert'],
    ['mlp-16-bp', 'elman-16-bp', 'wat terugkoppeling oplevert'],
    ['elman-16-bp', 'ang', 'ANG tegen een vast recurrent net met BPTT'],
    ['mlp-16-bp', 'ang', 'ANG tegen een geheugenloos net met BPTT']
  ];
  const toetsen = [];
  for (const taak of TAAKAS) {
    for (const maat of ['benchBeleid', 'memHorizon']) {
      const rij = [];
      for (const [a, c, waarom] of PAREN) {
        const na = naamVan(a, taak.blink), nc = naamVan(c, taak.blink);
        if (!per[na] || !per[nc] || !per[na].length || !per[nc].length) continue;
        const t = await mw(per[na].map(r => r[maat]), per[nc].map(r => r[maat]));
        if (t) rij.push(Object.assign(t, { taak: taak.naam, goalBlink: taak.blink, maat, tegen: a, conditie: c, waarom }));
      }
      const hp = holm(rij.map(t => t.p));
      rij.forEach((t, i) => {
        t.familie = `${taak.naam}/${maat}`; t.familiegrootte = rij.length; t.pHolm = hp[i];
        t.oordeelHolm = hp[i] < 0.01 ? 'sterk' : hp[i] < 0.05 ? 'significant' : 'binnen de ruis';
      });
      toetsen.push(...rij);
    }
  }

  /* De interactie: groeit het voordeel van plasticiteit naarmate het doel eerder
     verdwijnt? Per zaad gepaard, want dezelfde breinzaden draaien in elke stand. */
  const verschilPerZaad = (a, c, blink) => {
    const A = per[naamVan(a, blink)] || [], C = per[naamVan(c, blink)] || [];
    const kaart = new Map(A.map(r => [r.zaad, r]));
    return C.map(r => kaart.has(r.zaad) ? r.benchBeleid - kaart.get(r.zaad).benchBeleid : null)
      .filter(x => x !== null);
  };
  const interacties = [];
  for (const [a, c, waarom] of PAREN) {
    const basis = verschilPerZaad(a, c, 0);
    if (!basis.length) continue;
    for (const taak of TAAKAS) {
      if (taak.blink === 0) continue;
      const hier = verschilPerZaad(a, c, taak.blink);
      if (!hier.length) continue;
      const t = await mw(basis, hier);
      if (t) interacties.push(Object.assign(t, {
        paar: `${c} − ${a}`, waarom, taak: taak.naam, tegenTaak: 'A',
        verschilBijA: mci(basis).m, verschilHier: mci(hier).m
      }));
    }
  }

  /* V5: zegt de functionele maat meer dan de structurele telling? Rangcorrelatie
     van elke kandidaat met de benchmarkscore, over alle runs op de verborgen
     standen samen. Spearman, want de verbanden hoeven niet lineair te zijn. */
  const spearman = (x, y) => {
    const n = x.length; if (n < 4) return null;
    const rang = v => { const s = v.map((w, i) => [w, i]).sort((a, b) => a[0] - b[0]); const r = new Array(n);
      let i = 0; while (i < n) { let j = i; while (j + 1 < n && s[j + 1][0] === s[i][0]) j++;
        const gem = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[s[k][1]] = gem; i = j + 1; } return r; };
    const rx = rang(x), ry = rang(y);
    const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const a = rx[i] - mx, c = ry[i] - my; sxy += a * c; sxx += a * a; syy += c * c; }
    return (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : null;
  };
  const verborgen = [];
  for (const taak of TAAKAS) if (taak.blink !== 0)
    for (const arch of ARCHITECTUREN) (per[naamVan(arch.naam, taak.blink)] || []).forEach(r => verborgen.push(r));
  const kandidaten = ['memHorizon', 'memCos', 'lussen', 'mem', 'reflexbogen', 'actief', 'pad'];
  const correlaties = {};
  for (const k of kandidaten) {
    const paren = verborgen.filter(r => r[k] !== null && r[k] !== undefined && isFinite(r[k]));
    correlaties[k] = { n: paren.length, rho: spearman(paren.map(r => r[k]), paren.map(r => r.benchBeleid)) };
  }

  fs.writeFileSync(path.join(OUT, 'taakas.json'), JSON.stringify({
    uitgevoerd: new Date().toISOString(),
    beschrijving: 'Werkplan stap 12: de taakas. Eén taak met een knop – het doel is nog maar de eerste ' +
      'tien spelstappen zichtbaar en dan goalBlink stappen niet, en zo door – over vier standen ' +
      '(0 = de taak van stap 1 t/m 8, dan 10, 20 en 40 stappen donker) en vier architecturen. De beloning verandert niet ' +
      'mee, dus wat er verandert is uitsluitend de waarneembaarheid. Naast de benchmarkscore staat de ' +
      'geheugenhorizon uit de blinderingsproef: dezelfde getrainde agent speelt dezelfde wereld twee keer, ' +
      'één keer met het doel de eerste stappen zichtbaar en één keer nooit zichtbaar, en de horizon is het ' +
      'aantal stappen dat de eerste de tweede blijft verslaan op koers naar het doel. Die maat hangt niet ' +
      'aan de neuronsoorten van dit model en is dus op een vast recurrent net even goed te meten.',
    zaden: NSEEDS, eersteZaad: SEED0, pogingenPerRun: NEP,
    benchmark: { werelden: BENCHN, herhalingen: BENCHREPS }, geheugenProef: { werelden: MEMN },
    architecturen: Object.fromEntries(ARCHITECTUREN.map(a => [a.naam,
      { lrTaakA: a.lr, lrKnipper: lrVoor(a, 1), ov: a.ov, rol: a.rol }])),
    leersnelheidVeeg: veeg ? veeg.keuze : null,
    taakas: TAAKAS, voorspellingen: VOORSPELLINGEN,
    tabel, toetsen, interacties, correlaties, perZaad: per
  }, null, 2));

  /* ---------- uitvoer ---------- */
  const archNamen = ARCHITECTUREN.map(a => a.naam);
  console.log('\n--- benchmark (geloot) over de taakas ---');
  console.log('architectuur'.padEnd(15) + TAAKAS.map(t => (t.naam + ' (uit ' + t.blink + ')').padEnd(19)).join(''));
  for (const a of archNamen) console.log(a.padEnd(15) +
    TAAKAS.map(t => pct(tabel[naamVan(a, t.blink)] && tabel[naamVan(a, t.blink)].benchBeleid).padEnd(19)).join(''));

  console.log('\n--- geheugenhorizon (stappen dat de agent koers houdt zonder doelinformatie) ---');
  console.log('architectuur'.padEnd(15) + TAAKAS.map(t => t.naam.padEnd(19)).join(''));
  for (const a of archNamen) console.log(a.padEnd(15) +
    TAAKAS.map(t => { const T = tabel[naamVan(a, t.blink)];
      return (T ? g2(T.memHorizon) + '  (cos ' + g2(T.memCos) + ')' : '–').padEnd(19); }).join(''));

  console.log('\n--- structuur: actieve verbindingen / lussen / geheugen-neuronen ---');
  console.log('architectuur'.padEnd(15) + TAAKAS.map(t => t.naam.padEnd(19)).join(''));
  for (const a of archNamen) console.log(a.padEnd(15) +
    TAAKAS.map(t => { const T = tabel[naamVan(a, t.blink)];
      return (T ? `${Math.round(T.actief.m)} / ${g2(T.lussen)} / ${g2(T.mem)}` : '–').padEnd(19); }).join(''));

  console.log('\n--- herstructurering per run: gesnoeid / bijgegroeid / hertypeerd ---');
  console.log('architectuur'.padEnd(15) + TAAKAS.map(t => t.naam.padEnd(19)).join(''));
  for (const a of archNamen) console.log(a.padEnd(15) +
    TAAKAS.map(t => { const T = tabel[naamVan(a, t.blink)];
      return (T ? `${Math.round(T.gesnoeid.m)} / ${Math.round(T.bijgegroeid.m)} / ${Math.round(T.hertypeerd.m)}`
        : 'geen').padEnd(19); }).join(''));

  console.log('\n--- Mann-Whitney binnen elke taakstand, Holm per maat ---');
  for (const t of toetsen) console.log(
    `${t.taak.padEnd(6)} ${t.maat.padEnd(12)} ${(t.conditie + ' vs ' + t.tegen).padEnd(28)} ` +
    `${(t.verschil >= 0 ? '+' : '−') + Math.abs(t.maat === 'benchBeleid' ? 100 * t.verschil : t.verschil).toFixed(1)}`.padEnd(8) +
    `   p = ${t.p.toFixed(4)}   Holm ${t.pHolm.toFixed(4)}   ${t.oordeelHolm}`);

  console.log('\n--- interactie: groeit het verschil naarmate het doel eerder verdwijnt? ---');
  for (const t of interacties) console.log(
    `${t.paar.padEnd(22)} ${t.taak.padEnd(6)} ${(100 * t.verschilBijA).toFixed(1)} pp bij A -> ` +
    `${(100 * t.verschilHier).toFixed(1)} pp   p = ${t.p.toFixed(4)}   ${t.oordeel}`);

  console.log('\n--- Spearman met de benchmarkscore op de verborgen standen ---');
  for (const k of kandidaten) console.log(`${k.padEnd(14)} rho = ` +
    (correlaties[k].rho === null ? '–' : correlaties[k].rho.toFixed(3)) + `   (n = ${correlaties[k].n})`);

  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
