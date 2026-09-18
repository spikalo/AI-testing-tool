/* Stap 18, slot — de afsluitende meting op het seinhuis.
   Voorspellingen en condities: tests/stap18-condities.js (gecommit vóór de eerste run).
   Hervatbaar: een leven waarvan de JSON al bestaat wordt ingelezen, niet overgedaan.
   ALLEEN=veeg of ALLEEN=meting draait één ronde; CONDS=naam,naam beperkt de condities.
   Draaien: tests\draai.cmd exp-stap18.js s18-log.txt                                   */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const K = require('./stap18-condities');
const OUT = path.resolve('experimenten');
const ALLEEN = process.env.ALLEEN || null;
const CONDS = process.env.CONDS ? process.env.CONDS.split(',') : null;
const BENCHN = 200;

const mci = xs => {
  const v = xs.filter(x => x !== null && x !== undefined && isFinite(x));
  const n = v.length; if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, m, sd, ci: 1.96 * sd / Math.sqrt(n) };
};
/* Tekentoets met exacte permutatie: onder H0 (J symmetrisch rond 0) is elk teken even
   waarschijnlijk. p = aandeel van de 2^n tekenpatronen met een gemiddelde ≥ het gemetene. */
function tekenToets(xs) {
  const v = xs.filter(x => x !== null && isFinite(x)), n = v.length;
  if (!n) return null;
  const obs = v.reduce((a, b) => a + b, 0);
  let ge = 0; const N = 1 << n;
  for (let m = 0; m < N; m++) { let s = 0; for (let i = 0; i < n; i++) s += (m >> i & 1) ? -Math.abs(v[i]) : Math.abs(v[i]);
    if (s >= obs - 1e-12) ge++; }
  return ge / N;
}
function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).filter(x => x[0] !== null).sort((a, b) => a[0] - b[0]);
  const out = ps.map(() => null); let mx = 0;
  idx.forEach(([p, i], r) => { mx = Math.max(mx, Math.min(1, p * (idx.length - r))); out[i] = mx; });
  return out;
}
const pct = o => o ? `${(100 * o.m).toFixed(0).padStart(4)}±${(100 * o.ci).toFixed(0).padEnd(3)}` : '   –    ';

function maten(row) {
  const B = row.benchmark && row.benchmark.beleid;
  const per = {};
  for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']) {
    const x = B && B.perRegel && B.perRegel[r];
    per[r] = x ? { J: x.pct, k0: x.kant0.pct, k1: x.kant1.pct } : null;
  }
  return { zaad: row.breinZaad, totaal: B ? B.pct : null, per,
    fasen: (row.leven && row.leven.fasen || []).map(f => ({ fase: f.fase, J: f.opEigenTaak ? f.opEigenTaak.pct : null })),
    tijdMs: row.resultaat ? row.resultaat.rekentijdMs : null };
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

  async function leef(naam, zaad, ov, lr) {
    const jsonPad = path.join(OUT, 'runs', `${naam}_z${zaad}.json`);
    if (fs.existsSync(jsonPad)) return JSON.parse(fs.readFileSync(jsonPad, 'utf8'));
    const r = await p.evaluate(([zaad, naam, ov, lr, fasen, meet, bn, gemeen]) => {
      const W = window.__brain;
      W.S.seinBench = null;
      let cfg = W.cfgOverride(W.readCfg(), Object.assign({}, gemeen, ov, { lr, seed: zaad, seinRegels: 1 }));
      cfg.nEpisodes = fasen.reduce((a, f) => a + f.pogingen, 0);
      cfg.evalOn = false; cfg.benchOn = true; cfg.benchN = bn; cfg.benchReps = 1; cfg.memOn = false;
      const row = W.runLeven(cfg, zaad, fasen, naam, meet);
      return { csv: W.csvRow(row), json: row };
    }, [zaad, naam, ov, lr, K.FASEN, K.MEETPUNT, BENCHN, K.GEMEEN]);
    if (fouten.length) throw new Error('paginafout: ' + fouten.join(' | '));
    lines.push(r.csv);
    fs.writeFileSync(csvPad, lines.join('\n') + '\n');
    fs.writeFileSync(jsonPad, JSON.stringify(r.json, null, 1));
    return r.json;
  }
  const conds = K.CONDITIES.filter(c => !CONDS || CONDS.includes(c.naam));

  /* ---------- ronde 1: de veeg ---------- */
  const veegPad = path.join(OUT, 'lr-veeg-stap18.json');
  const veeg = fs.existsSync(veegPad) ? JSON.parse(fs.readFileSync(veegPad, 'utf8')) : { perConditie: {} };
  if (ALLEEN !== 'meting') {
    console.log('--- leersnelheidsveeg (veegzaden ' + K.VEEG_SEED0 + '..), keuze op totaal-J aan het eind ---');
    for (const c of conds) {
      if (veeg.perConditie[c.naam]) continue;
      const kand = [];
      for (const lr of c.veeg) {
        const s = [];
        for (let k = 0; k < K.VEEG_N; k++) s.push(maten(await leef(`${c.naam}-veeg-lr${lr}`, K.VEEG_SEED0 + k, c.ov, lr)).totaal);
        kand.push({ lr, totaal: mci(s) });
      }
      const beste = kand.reduce((a, x) => x.totaal.m > a.totaal.m ? x : a, kand[0]);
      veeg.perConditie[c.naam] = { kandidaten: kand, gekozen: beste.lr };
      console.log(c.naam.padEnd(20) + kand.map(x => `${x.lr}: ${pct(x.totaal)}`).join('   ') + '   -> ' + beste.lr);
      veeg.uitgevoerd = new Date().toISOString();
      veeg.beschrijving = 'Leersnelheidsveeg voor stap 18 (slot), drie kandidaten per conditie, ' + K.VEEG_N +
        ' veegzaden, keuze op het gemiddelde totaal-onderscheid (J) aan het eind van het leven. Alle kandidaten staan erin.';
      fs.writeFileSync(veegPad, JSON.stringify(veeg, null, 2));
    }
  }
  if (ALLEEN === 'veeg') { await b.close(); return; }

  /* ---------- ronde 2: de meting ---------- */
  console.log('\n--- meting, zaden ' + K.MEET_SEED0 + '..' + (K.MEET_SEED0 + K.MEET_N - 1) + ' ---');
  const res = {};
  for (const c of conds) {
    const lr = veeg.perConditie[c.naam] ? veeg.perConditie[c.naam].gekozen : null;
    if (lr === null) throw new Error('geen leersnelheid voor ' + c.naam);
    const rij = [];
    for (let k = 0; k < K.MEET_N; k++) rij.push(maten(await leef(c.naam, K.MEET_SEED0 + k, c.ov, lr)));
    const perRegel = {};
    for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']) {
      const J = rij.map(x => x.per[r] ? x.per[r].J : null);
      perRegel[r] = { J: mci(J), k0: mci(rij.map(x => x.per[r] ? x.per[r].k0 : null)),
        k1: mci(rij.map(x => x.per[r] ? x.per[r].k1 : null)), pTeken: tekenToets(J), perZaad: J };
    }
    const tik = rij.map(x => (x.per.R1 && x.per.R2) ? (x.per.R1.J + x.per.R2.J) / 2 : null);
    res[c.naam] = { rol: c.rol, lr, totaal: mci(rij.map(x => x.totaal)), perRegel, tikregels: tik,
      tikregelsMci: mci(tik), fasen: K.FASEN.map((f, i) => ({ fase: f.naam, J: mci(rij.map(x => x.fasen[i] ? x.fasen[i].J : null)) })),
      tijdS: mci(rij.map(x => x.tijdMs / 1000)), perZaad: rij };
    console.log(c.naam.padEnd(20) + `lr ${String(lr).padEnd(6)} totaal ${pct(res[c.naam].totaal)} | ` +
      ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map(r => `${r} ${pct(perRegel[r].J)}`).join(' '));
  }

  /* ---------- toetsen ---------- */
  const v1 = [];
  for (const c of conds) for (const r of K.GEHEUGENREGELS) v1.push({ c: c.naam, r, p: res[c.naam].perRegel[r].pTeken, m: res[c.naam].perRegel[r].J });
  const v1h = holm(v1.map(x => x.p)); v1.forEach((x, i) => x.pHolm = v1h[i]);
  const mw = async (a, b2) => await p.evaluate(([A, B]) => window.__brain.mannWhitney(A, B), [a, b2]);
  const v3 = res['s18-ang'] && res['s18-mlp-32-bp'] ? await mw(res['s18-ang'].tikregels, res['s18-mlp-32-bp'].tikregels) : null;
  const v4 = res['s18-ang'] && res['s18-ang-vast'] ? await mw(res['s18-ang'].tikregels, res['s18-ang-vast'].tikregels) : null;
  const v34h = holm([v3 ? v3.p : null, v4 ? v4.p : null]);
  const vorm = (k0, k1, J) => (J !== null && J > 0.5) ? 'geleerd' : (k0 < 0.2 && k1 > 0.8) ? 'stil' :
    (k0 > 0.8 && k1 < 0.2) ? 'reflex' : (k0 >= 0.3 && k0 <= 0.7 && k1 >= 0.3 && k1 <= 0.7) ? 'munt' : 'gemengd';
  const v5 = {};
  for (const c of conds) { v5[c.naam] = {};
    for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']) { const x = res[c.naam].perRegel[r];
      v5[c.naam][r] = x.k0 && x.k1 ? vorm(x.k0.m, x.k1.m, x.J ? x.J.m : null) : null; } }

  console.log('\nV1 (geheugenregels boven nul?), Holm over ' + v1.length + ':');
  for (const x of v1) console.log(`  ${x.c.padEnd(20)} ${x.r}  J ${pct(x.m)}  p ${x.p.toFixed(4)}  Holm ${x.pHolm.toFixed(4)}`);
  console.log('V2 (tikregels geleerd, ondergrens > 0,5):');
  for (const c of conds) { const t = res[c.naam].tikregelsMci; console.log(`  ${c.naam.padEnd(20)} ${pct(t)}  ${t && t.m - t.ci > 0.5 ? 'ja' : 'nee'}`); }
  if (v3) console.log(`V3 ang tegen mlp op de tikregels: p ${v3.p.toFixed(4)}, Holm ${v34h[0].toFixed(4)}`);
  if (v4) console.log(`V4 ang tegen ang-vast op de tikregels: p ${v4.p.toFixed(4)}, Holm ${v34h[1].toFixed(4)}`);
  console.log('V5 faalvormen:');
  for (const c of conds) console.log('  ' + c.naam.padEnd(20) + ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map(r => `${r} ${v5[c.naam][r]}`).join('  '));

  fs.writeFileSync(path.join(OUT, 'seinhuis-slot.json'), JSON.stringify({
    uitgevoerd: new Date().toISOString(),
    beschrijving: 'Stap 18, slot: de afsluitende meting op het seinhuis. Groeiende dienstregeling (' + K.PER_REGEL +
      ' diensten per regel), een keuze per tik, beloning ' + JSON.stringify(K.GEMEEN.seinBeloning) +
      ', score Youdens J per regel. Elk leven heeft een eigen breinzaad en wereldzaad.',
    fasen: K.FASEN, zaden: K.MEET_N, eersteZaad: K.MEET_SEED0, benchmark: { diensten: BENCHN },
    leersnelheidsveeg: veeg, voorspellingen: K.VOORSPELLINGEN,
    uitslag: { V1: v1, V3: v3 && { ...v3, pHolm: v34h[0] }, V4: v4 && { ...v4, pHolm: v34h[1] }, V5: v5 },
    condities: res
  }, null, 1));
  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
