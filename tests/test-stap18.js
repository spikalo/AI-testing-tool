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
    const baksteen = speel(() => [1, 1, 1, 1]);
    const lui = speel(() => [0, 0, 0, 0]);
    /* de speler waar stap 17 in trapte: geheugenloos, lamp aan -> de handel van die lamp.
       Lamp 3 en 5 krijgen altijd hetzelfde antwoord, want zonder geheugen weet hij de vlag niet. */
    const LAMP_HANDEL = [0, 1, -1, 0, -1, 2, 2, 3];
    const reflex = speel((d, t) => { const P = [0, 0, 0, 0]; const l = d.lamp[t];
      if (l >= 0 && LAMP_HANDEL[l] >= 0) P[LAMP_HANDEL[l]] = 1; return P; });
    return { perfect, geloot, baksteen, lui, reflex, kort: W.SEIN_KORT };
  });
  const f = x => x === null ? '–' : (100 * x).toFixed(1);
  ok('perfecte speler: 100 % onderscheid op elke regel',
    ijk.perfect.per.every(x => x === 1), ijk.perfect.per.map(f).join(' '));
  ok('elke regel heeft beide kanten in de dienstenset',
    ijk.perfect.per.every(x => x !== null) && ijk.perfect.n.every(x => x > 0),
    'gevallen per kant ' + ijk.perfect.n.join(' '));
  ok('geloot beleid: in de buurt van de toevalsbodem 6,25 %',
    Math.abs(ijk.geloot.totaal - 0.0625) < 0.02, `${f(ijk.geloot.totaal)} %, per regel ${ijk.geloot.per.map(f).join(' ')}`);
  ok('alles vasthouden: 0', ijk.baksteen.totaal === 0);
  ok('niets doen: 0', ijk.lui.totaal === 0);
  ok('de reflexspeler van stap 17 haalt op de oude maat een hoge trefkans op de eisen',
    ijk.reflex.trefkansEisen > 0.6, `${f(ijk.reflex.trefkansEisen)} % van de eisen goed`);
  ok('maar op het onderscheid haalt hij nul op R1, R2, R5 en R6',
    [0, 1, 4, 5].every(r => ijk.reflex.per[r] === 0), ijk.reflex.per.map(f).join(' '));
  ok('en ook nul op R3 en R4, waar hij altijd hetzelfde antwoord geeft',
    ijk.reflex.per[2] === 0 && ijk.reflex.per[3] === 0);

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
