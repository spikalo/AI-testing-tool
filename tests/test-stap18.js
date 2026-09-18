/* De test die bij stap 18 hoort — de correcties op het seinhuis en de skip-knop.

   1. SPEL 1 IS ONVERANDERD: s13-ang én s13-elman-16-bp reproduceren bit voor bit. De
      tweede is nieuw, want de skip-knop zit in createLayered en die raakt élk gelaagd net.
   2. DE SKIP-KNOP DOET WAT HIJ ZEGT: uit is het net identiek aan een net zonder de sleutel,
      aan legt hij precies 16 x 4 bogen invoer -> handel aan, voorwaarts gemarkeerd.
   3. DE SCORE HEEFT NOG STEEDS EEN SCHAAL, nu met de nieuwe maat (onderscheid): perfect
      100 %, geloot ~6,25 %, alles vasthouden 0, niets doen 0.
   4. DE VAL VAN STAP 17 IS DICHT: een geheugenloze "lamp aan, handel erbij"-speler scoorde
      op R1, R2, R5 en R6 bijna perfect op de eisen; op het onderscheid hoort hij daar nul
      te halen. En "altijd hetzelfde antwoord" haalt op R3 en R4 nul.
   5. DE BELONING: standaard die van stap 17, en cfg.seinBeloning wordt werkelijk gebruikt.

   Draaien: tests\draai.cmd test-stap18.js s18-test-log.txt                             */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.resolve('experimenten');
let fout = 0;
const ok = (naam, goed, uitleg) => {
  console.log(`${goed ? 'OK  ' : 'FOUT'}  ${naam}${uitleg ? '   ' + uitleg : ''}`);
  if (!goed) fout++;
};
const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  /* ---------- 1. spel 1 onveranderd ---------- */
  {
    const { FASEN, CONDITIES, MEET_SEED0 } = require('./stap13-condities');
    const { STAGVENSTER } = require('./stap16-condities');
    const TOTAAL = FASEN.reduce((a, f) => a + f.pogingen, 0);
    const MEETPUNT = { benchN: 200, benchReps: 1, memN: 50, memBlind: 20, memH: 40 };
    for (const naam of ['ang', 'elman-16-bp']) {
      const c = CONDITIES.find(x => x.naam === naam);
      const pad = path.join(OUT, 'runs', `s13-${naam}_z${MEET_SEED0}.json`);
      if (!fs.existsSync(pad)) { ok(`s13-${naam} reproduceert`, false, 'referentiebestand ontbreekt'); continue; }
      const oud = JSON.parse(fs.readFileSync(pad, 'utf8'));
      const nieuw = await p.evaluate(([zaad, fasen, meet, totaal, stag, lr, ov]) => {
        const W = window.__brain;
        let cfg = W.readCfg();
        cfg.nEpisodes = totaal; cfg.evalOn = false;
        cfg.benchOn = true; cfg.benchN = 500; cfg.benchReps = 1;
        cfg.memOn = true; cfg.memN = 100;
        cfg = W.cfgOverride(cfg, Object.assign({ lr, stagVenster: stag }, ov));
        return W.runLeven(cfg, zaad, fasen, 's18-controle', meet);
      }, [MEET_SEED0, FASEN, MEETPUNT, TOTAAL, STAGVENSTER, c.lr, c.ov]);
      const h = gelijk(oud.historie, nieuw.historie), n = gelijk(oud.netwerk, nieuw.netwerk);
      ok(`spel 1: s13-${naam} geeft bit voor bit hetzelfde leven`, h && n, `historie ${h}, netwerk ${n}`);
    }
  }

  /* 1b (stap 18b): actCategorical kreeg een actielijst als argument. Op spel 1 hoort het
     categorische beleid van stap 7 daardoor niets te merken. */
  {
    const { CONDITIES: C7 } = require('./stap7-condities');
    const veeg = JSON.parse(fs.readFileSync(path.join(OUT, 'lr-veeg-stap7.json'), 'utf8'));
    const c = C7.find(x => x.ov && x.ov.catPolicy);
    const pad = c && path.join(OUT, 'runs', `${c.naam}_z1000.json`);
    if (!c || !fs.existsSync(pad)) ok('stap 7, categorisch beleid, reproduceert', false, 'referentie ontbreekt');
    else {
      const oud = JSON.parse(fs.readFileSync(pad, 'utf8'));
      const nieuw = await p.evaluate(([naam, ov, lr]) => {
        const W = window.__brain;
        let cfg = W.readCfg();
        cfg.nEpisodes = 500; cfg.evalOn = true; cfg.benchOn = true; cfg.benchN = 500; cfg.benchReps = 3;
        cfg = W.cfgOverride(cfg, Object.assign({}, ov, { lr }));
        return W.runOne(cfg, 1000, naam);
      }, [c.naam, c.ov, veeg.keuze[c.naam].lr]);
      const h = gelijk(oud.historie, nieuw.historie), n = gelijk(oud.netwerk, nieuw.netwerk);
      ok(`spel 1: ${c.naam} (categorisch beleid) geeft bit voor bit hetzelfde leven`, h && n, `historie ${h}, netwerk ${n}`);
    }
  }

  /* ---------- 2. de skip-knop ---------- */
  const skip = await p.evaluate(() => {
    const W = window.__brain;
    const basis = W.cfgOverride(W.readCfg(), { layered: true, layerSizes: [16], recurrent: true, prop: 2 });
    const zonder = W.createLayered(basis, 1234);
    const uit = W.createLayered(W.cfgOverride(basis, { skip: false }), 1234);
    const aan = W.createLayered(W.cfgOverride(basis, { skip: true }), 1234);
    const sig = B => [Array.from(B.cFrom), Array.from(B.cTo), Array.from(B.cW), Array.from(B.bias)];
    let direct = 0, voorwaarts = 0;
    for (let c = 0; c < aan.nc; c++) {
      const a = aan.cFrom[c], t = aan.cTo[c];
      if (a < 16 && t >= 16 && t < 20) { direct++; if (!aan.cRec[c]) voorwaarts++; }
    }
    /* het gedeelde deel van het net moet identiek zijn: de skip-bogen komen achteraan */
    const gedeeld = JSON.stringify(Array.from(aan.cW).slice(0, zonder.nc)) === JSON.stringify(Array.from(zonder.cW));
    return { uitGelijk: JSON.stringify(sig(zonder)) === JSON.stringify(sig(uit)),
      extra: aan.nc - zonder.nc, direct, voorwaarts, gedeeld };
  });
  ok('skip uit geeft bit voor bit hetzelfde net als zonder de sleutel', skip.uitGelijk);
  ok('skip aan legt precies 16 x 4 = 64 bogen aan', skip.extra === 64, `${skip.extra} extra`);
  ok('en dat zijn allemaal directe bogen invoer -> handel, voorwaarts gemarkeerd',
    skip.direct === 64 && skip.voorwaarts === 64, `${skip.direct} direct, ${skip.voorwaarts} voorwaarts`);
  ok('de rest van het net blijft hetzelfde (de bogen komen achteraan)', skip.gedeeld);

  /* ---------- 3 en 4. de schaal van de nieuwe score, en de val van stap 17 ---------- */
  const ijk = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    const cfg = W.cfgOverride(W.readCfg(), { taak: 'seinhuis' });
    S.cfg = cfg; S.seinBench = null;
    const diensten = W.seinBenchDiensten(100, cfg);
    const R = W.SEIN_REGELS;
    const speel = kies => {
      const N = new Float64Array(2 * R), G = new Float64Array(2 * R);
      let eis = 0, goedEis = 0;
      for (const d of diensten) {
        const geheugen = {};
        for (let t = 0; t < d.T; t++) {
          const P = kies(d, t, geheugen);
          const s = W.seinScoreTik(d, t, P);
          const rg = s.regel > 0 ? s.regel : s.afleider;
          if (s.regel > 0) { eis++; if (s.goed) goedEis++; }
          if (rg > 0 && s.kant >= 0) { const k = 2 * (rg - 1) + s.kant; N[k]++;
            if (s.regel > 0 ? s.goed : s.aflGoed) G[k]++; }
        }
      }
      const per = []; for (let r = 0; r < R; r++) per.push(W.seinOnderscheid(N[2 * r], G[2 * r], N[2 * r + 1], G[2 * r + 1]));
      const v = per.filter(x => x !== null);
      return { per, totaal: v.reduce((a, x) => a + x, 0) / v.length, trefkansEisen: goedEis / eis,
        n: Array.from(N) };
    };
    const perfect = speel((d, t) => { const P = [0, 0, 0, 0]; if (d.eisRegel[t] > 0) P[d.eisHandel[t]] = 1; return P; });
    let z = 987654321;
    const munt = () => { z = (z * 1103515245 + 12345) & 0x7fffffff; return (z / 0x7fffffff) < 0.5 ? 1 : 0; };
    const geloot = speel(() => [munt(), munt(), munt(), munt()]);
    /* stap 18b: één keuze uit vijf, uniform — de toevalsbodem van het categorische beleid */
    const uitVijf = () => { z = (z * 1103515245 + 12345) & 0x7fffffff; return Math.floor(5 * z / 0x80000000); };
    const vijf = speel(() => { const P = [0, 0, 0, 0]; const k = uitVijf(); if (k < 4) P[k] = 1; return P; });
    const baksteen = speel(() => [1, 1, 1, 1]);
    const lui = speel(() => [0, 0, 0, 0]);
    /* de speler waar stap 17 in trapte: geheugenloos, lamp aan -> de handel van die lamp.
       Lamp 3 en 5 krijgen altijd hetzelfde antwoord, want zonder geheugen weet hij de vlag niet. */
    const LAMP_HANDEL = [0, 1, -1, 0, -1, 2, 2, 3];
    const reflex = speel((d, t) => { const P = [0, 0, 0, 0]; const l = d.lamp[t];
      if (l >= 0 && LAMP_HANDEL[l] >= 0) P[LAMP_HANDEL[l]] = 1; return P; });
    /* stap 18c: de speler die het meetkundig gemiddelde doorliet. Geheugenloos, en bij elke
       lamp een munt: bij R1/R2/R5/R6 wel of niet de handel, bij lamp 3 handel 0 of 1, bij
       lamp 5 handel 2 of 3. Hij weet niets van enige voorwaarde. */
    const MUNT_KEUZE = { 0: [0, -1], 1: [1, -1], 3: [0, 1], 5: [2, 3], 6: [2, -1], 7: [3, -1] };
    const muntSpeler = speel((d, t) => { const P = [0, 0, 0, 0]; const k = MUNT_KEUZE[d.lamp[t]];
      if (k) { const h = k[munt()]; if (h >= 0) P[h] = 1; } return P; });
    return { perfect, geloot, vijf, baksteen, lui, reflex, muntSpeler, kort: W.SEIN_KORT,
      toeval: [W.seinToeval({}), W.seinToeval({ catPolicy: true })] };
  });
  const f = x => x === null ? '–' : (100 * x).toFixed(1);
  ok('perfecte speler: onderscheid 1 op elke regel',
    ijk.perfect.per.every(x => Math.abs(x - 1) < 1e-12), ijk.perfect.per.map(f).join(' '));
  ok('elke regel heeft beide kanten in de dienstenset',
    ijk.perfect.per.every(x => x !== null) && ijk.perfect.n.every(x => x > 0),
    'gevallen per kant ' + ijk.perfect.n.join(' '));
  ok('vier losse handels, geloot: in de buurt van de bodem -87,5 %',
    Math.abs(ijk.geloot.totaal + 0.875) < 0.03, `${f(ijk.geloot.totaal)} %, per regel ${ijk.geloot.per.map(f).join(' ')}`);
  ok('een uit vijf, uniform geloot: in de buurt van de bodem -60 %',
    Math.abs(ijk.vijf.totaal + 0.6) < 0.04, `${f(ijk.vijf.totaal)} %, per regel ${ijk.vijf.per.map(f).join(' ')}`);
  ok('en seinToeval geeft voor beide beleidsvormen de juiste bodem',
    ijk.toeval[0] === -0.875 && ijk.toeval[1] === -0.6, JSON.stringify(ijk.toeval));
  ok('alles vasthouden: nooit boven nul', ijk.baksteen.per.every(x => x <= 0), ijk.baksteen.per.map(f).join(' '));
  ok('niets doen: nooit boven nul', ijk.lui.per.every(x => x <= 0), ijk.lui.per.map(f).join(' '));
  ok('de muntspeler (geheugenloos, gokt bij elke lamp) zit op elke regel rond nul — het meetkundig gemiddelde gaf hem 50 %',
    ijk.muntSpeler.per.every(x => Math.abs(x) < 0.1), ijk.muntSpeler.per.map(f).join(' '));
  ok('de reflexspeler van stap 17 haalt op de oude maat een hoge trefkans op de eisen',
    ijk.reflex.trefkansEisen > 0.6, `${f(ijk.reflex.trefkansEisen)} % van de eisen goed`);
  ok('maar op het onderscheid haalt hij nul op R1, R2, R5 en R6',
    [0, 1, 4, 5].every(r => ijk.reflex.per[r] === 0), ijk.reflex.per.map(f).join(' '));
  ok('en ook nul op R3 en R4, waar hij altijd hetzelfde antwoord geeft',
    ijk.reflex.per[2] === 0 && ijk.reflex.per[3] === 0);

  /* ---------- 6 (stap 18c). terugpropagatie door de tijd is de echte gradiënt ----------
     L(w) = Σ_t Ã_t · log π_t(a_t; w), met de acties en Ã uit een gespeelde dienst vast.
     bpttLeer hoort precies ∂L/∂w te geven, óók over de terugkoppeling en over de hele
     dienst. Nagemeten met centrale differenties op élk gewicht, voor beide beleidsvormen. */
  for (const cat of [true, false]) {
    const gc = await p.evaluate(([cat]) => {
      const W = window.__brain, S = W.S;
      const cfg = W.cfgOverride(W.readCfg(), { taak: 'seinhuis', layered: true, layerSizes: [8], recurrent: true,
        prop: 2, gradExact: true, bptt: true, catPolicy: cat, lr: 0, seinTikken: 60,
        structOn: false, growOn: false, retypeOn: false });
      S.cfg = cfg;
      const B = W.createLayered(cfg, 77); S.B = B;
      S.rnd = W.mulberry32(4242);
      S.world = W.seinDienst(31337, cfg);
      W.seinStart();
      let klaar = false;
      while (!klaar) klaar = W.seinTick(true, 0.3);
      const L0 = S.bpttLaatsteG;
      const { At, acties, tp } = L0;
      const G = Array.from(L0.G);
      /* de doelfunctie, opnieuw afgespeeld met vaste acties */
      const d = S.world, inp = new Float32Array(16);
      const L = () => {
        W.resetBrainState(B);
        let som = 0;
        for (let t = 0; t < d.T; t++) {
          W.seinWaarnemen(d, t, inp);
          B.prev.set(B.act);
          W.propagate(B, inp, cfg, 0, tp, B.act, null);
          const net = B.onet, a = acties[t];
          let lp;
          if (cat) {
            const sc = W.SEIN_ACTIES.map(A => A.reduce((s, j) => s + net[j], 0) / tp);
            const mx = Math.max(...sc), Z = sc.reduce((s, v) => s + Math.exp(v - mx), 0);
            let k = W.SEIN_ACTIES.findIndex(A => A.length === a.reduce((s, x) => s + x, 0) && A.every(j => a[j]));
            lp = sc[k] - mx - Math.log(Z);
          } else {
            lp = 0;
            for (let j = 0; j < 4; j++) { const q = 1 / (1 + Math.exp(-net[j] / tp));
              lp += a[j] ? Math.log(q) : Math.log(1 - q); }
          }
          som += At[t] * lp;
        }
        return som;
      };
      const w0 = Float32Array.from(B.cW);
      const eps = 1e-2, num = new Array(B.nc);
      for (let q = 0; q < B.nc; q++) {
        B.cW.set(w0); B.cW[q] = w0[q] + eps; const lp = L();
        B.cW.set(w0); B.cW[q] = w0[q] - eps; const lm = L();
        num[q] = (lp - lm) / (2 * eps);
      }
      B.cW.set(w0);
      const dot = (x, y) => x.reduce((s, v, i) => s + v * y[i], 0);
      const cos = dot(G, num) / Math.sqrt(dot(G, G) * dot(num, num));
      let rec = 0, tot = 0;
      for (let q = 0; q < B.nc; q++) { tot += G[q] * G[q]; if (B.cRec[q]) rec += G[q] * G[q]; }
      const zwaarst = G.map((v, q) => [Math.abs(v), q]).sort((a, b) => b[0] - a[0]).slice(0, 20).map(x => x[1]);
      const relMax = Math.max(...zwaarst.map(q => Math.abs(G[q] - num[q]) / Math.max(1e-9, Math.abs(num[q]))));
      return { cos, recAandeel: rec / tot, relMax, nc: B.nc, T: d.T, lr0gelijk: B.cW.every((v, q) => v === L0.gewichtenVoor[q]) };
    }, [cat]);
    const vorm = cat ? 'één uit vijf' : 'vier losse handels';
    ok(`BPTT (${vorm}): cosinus met eindige differenties over alle ${gc.nc} gewichten > 0,999`,
      gc.cos > 0.999, `cos ${gc.cos.toFixed(6)}, grootste relatieve fout op de 20 zwaarste ${(100 * gc.relMax).toFixed(2)} %, ${gc.T} tikken`);
    ok(`BPTT (${vorm}): de terugkoppeling draagt werkelijk gradiënt`,
      gc.recAandeel > 0.01, `${(100 * gc.recAandeel).toFixed(1)} % van de gradiëntmassa zit in terugkoppelende gewichten`);
    ok(`BPTT (${vorm}): met leersnelheid 0 verandert er niets`, gc.lr0gelijk);
  }

  /* ---------- 5. de beloning ---------- */
  const bel = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    S.cfg = W.cfgOverride(W.readCfg(), { taak: 'seinhuis' });
    const d = W.seinBenchDiensten(5, S.cfg)[0];
    let tAfl = -1, tStil = -1;
    for (let t = 0; t < d.T; t++) { if (d.aflRegel[t] > 0 && tAfl < 0) tAfl = t;
      if (d.eisRegel[t] === 0 && d.aflRegel[t] === 0 && tStil < 0) tStil = t; }
    const std = [W.seinScoreTik(d, tAfl, [1, 0, 0, 0]).r, W.seinScoreTik(d, tStil, [1, 0, 0, 0]).r];
    S.cfg = W.cfgOverride(S.cfg, { seinBeloning: [1.5, -1.5, 0.5, 1.25, 0.05] });
    const eigen = [W.seinScoreTik(d, tAfl, [1, 0, 0, 0]).r, W.seinScoreTik(d, tStil, [1, 0, 0, 0]).r];
    return { std, eigen, oud: W.SEIN_BELONING_OUD, standaard: W.SEIN_BELONING };
  });
  ok('de standaardbeloning is nog die van stap 17', gelijk(bel.standaard, bel.oud), JSON.stringify(bel.standaard));
  ok('en geeft op afleider en achtergrond dezelfde straf als in stap 17', bel.std[0] === -0.5 && bel.std[1] === -0.5);
  ok('cfg.seinBeloning wordt werkelijk gebruikt', bel.eigen[0] === -1.25 && Math.abs(bel.eigen[1] + 0.05) < 1e-12,
    JSON.stringify(bel.eigen));

  if (fouten.length) { console.error('paginafouten:\n' + fouten.join('\n')); fout++; }
  console.log(fout ? `\n${fout} controle(s) MISLUKT` : '\nalle controles groen');
  process.exitCode = fout ? 1 : 0;
  await b.close();
})();
