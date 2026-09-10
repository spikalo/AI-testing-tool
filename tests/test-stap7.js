/* Stap 7 — bewijzen dat de drie ingrepen in de leerregel doen wat er staat.

   De verleiding bij een pakket als dit is om de meetreeks te draaien, een tabel te
   krijgen en die te geloven. Maar een criticus die een programmeerfout bevat levert
   ook een tabel op, en die tabel ziet er precies zo uit. Dus eerst dit:

     1  de criticus rekent V(s) = w·s + b, en zijn TD-update is de update die
        erbij hoort — nagemeten tegen een tweede, met de hand geschreven berekening;
     2  het leersignaal dat bij de gewichten aankomt is werkelijk r + γV(s′) − V(s),
        en niet stiekem nog een keer door de lopende basislijn gehaald;
     3  bij een terminale toestand wordt er niet gebootstrapt;
     4  schaarse perturbatie verstoort precies de gekozen fractie van de wolk, en de
        niet-verstoorde knopen krijgen exact nul afwijking (geen bijna-nul);
     5  het categorische beleid is een echte kansverdeling: negen kansen die op 1
        sommeren, precies één actie tegelijk, en de randkansen kloppen;
     6  zijn score-functie is (1[ingedrukt] − randkans), nagemeten tegen eindige
        differenties op log π — dezelfde controle als stap 6, nu op de softmax;
     7  en het belangrijkste: met alles uit is de leerregel bit voor bit dezelfde
        als vóór stap 7. De conditie 's7-huidig' moet met zaad 1000 exact de
        benchmarkscore van 'ang-vol' uit stap 6 reproduceren.
*/
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

let ok = 0, fout = 0;
function check(naam, geslaagd, detail) {
  if (geslaagd) { ok++; console.log(`  ok   ${naam}${detail ? '   ' + detail : ''}`); }
  else { fout++; console.log(`  FOUT ${naam}${detail ? '   ' + detail : ''}`); }
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const pagefouten = [];
  p.on('pageerror', e => pagefouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  /* ---------- 1. de criticus rekent wat er staat ---------- */
  console.log('\n1. V(s) = w·s + b en de TD(0)-update');
  {
    const r = await p.evaluate(() => {
      const W = window.__brain, N = W.K.N_IN;
      const cfg = W.readCfg();
      const B = W.createBrain(cfg, 4242);
      const rnd = W.mulberry32(7);
      for (let i = 0; i < N; i++) { B.vW[i] = rnd() * 2 - 1; }
      B.vB = 0.37;
      const s = new Float32Array(N), s2 = new Float32Array(N);
      for (let i = 0; i < N; i++) { s[i] = rnd(); s2[i] = rnd(); }
      /* met de hand */
      let hv = B.vB; for (let i = 0; i < N; i++) hv += B.vW[i] * s[i];
      let hv2 = B.vB; for (let i = 0; i < N; i++) hv2 += B.vW[i] * s2[i];
      const v = W.criticValue(B, s), v2 = W.criticValue(B, s2);
      /* de update */
      const rew = 0.42, gamma = 0.9, lr = 0.05;
      const d = rew + gamma * hv2 - hv;
      const voor = Array.from(B.vW), voorB = B.vB;
      W.criticUpdate(B, s, d, lr);
      let maxAf = 0;
      for (let i = 0; i < N; i++) maxAf = Math.max(maxAf, Math.abs(B.vW[i] - (voor[i] + lr * d * s[i])));
      return { v, hv, v2, hv2, d, biasAf: Math.abs(B.vB - (voorB + lr * d)), maxAf };
    });
    check('V(s) klopt met de handberekening', Math.abs(r.v - r.hv) < 1e-6, `${r.v.toFixed(6)} vs ${r.hv.toFixed(6)}`);
    check('V(s′) klopt met de handberekening', Math.abs(r.v2 - r.hv2) < 1e-6);
    check('de gewichtsupdate is lr·δ·s', r.maxAf < 1e-7, `grootste afwijking ${r.maxAf.toExponential(1)}`);
    check('de bias-update is lr·δ', r.biasAf < 1e-7);
  }

  /* ---------- 2 + 3: wat er bij de gewichten aankomt ----------
     applyReward krijgt het voordeel als vijfde argument. De meetstand S.gradAccum
     legt het rúwe leersignaal Â·e vast zonder het toe te passen, dus daarmee is
     precies te zien wélke Â er gebruikt is: het quotiënt van twee accumulaties met
     hetzelfde spoor is de verhouding van de twee Â's. */
  console.log('\n2+3. het leersignaal dat de gewichten bereikt');
  {
    const r = await p.evaluate(() => {
      const W = window.__brain, S = W.S;
      const cfg = W.readCfg();
      const B = W.createBrain(cfg, 99);
      S.cfg = cfg; S.B = B;
      W.resetBrainState(B);
      for (let c = 0; c < B.nc; c++) B.cE[c] = 0.01 * (c % 7 - 3);
      B.rbar = 0.25;
      const som = () => { let s = 0; for (let c = 0; c < B.nc; c++) s += S.gradAccum[c]; return s; };
      const espom = () => { let s = 0; for (let c = 0; c < B.nc; c++) s += B.cE[c]; return s; };
      const rew = 0.8, adv = -1.75;
      S.gradAccum = new Float64Array(B.nc); S.gradAccumBias = null;
      W.applyReward(B, rew, cfg, 1);                 // zonder voordeel: r − rbar
      const zonder = som(), rbarNa = B.rbar;
      S.gradAccum = new Float64Array(B.nc);
      B.rbar = 0.25;
      W.applyReward(B, rew, cfg, 1, adv);            // mét voordeel
      const met = som();
      S.gradAccum = null;
      /* applyReward werkt de lopende basislijn bíj vóórdat hij ervan aftrekt, dus de
         r̄ die telt is 0,25 + 0,02·(r − 0,25) en niet 0,25. Dat is bestaand gedrag
         van vóór stap 7; het staat hier zo opgeschreven omdat de eerste versie van
         deze test het misrekende en de test dat netjes liet zien. */
      const rbarGebruikt = 0.25 + 0.02 * (rew - 0.25);
      return { zonder, met, e: espom(), verwachtZonder: (rew - rbarGebruikt) * espom(),
        verwachtMet: adv * espom(), rbarNa };
    });
    check('zonder criticus is Â = r − r̄',
      Math.abs(r.zonder - r.verwachtZonder) < 1e-9 * Math.max(1, Math.abs(r.verwachtZonder)),
      `${r.zonder.toFixed(6)} vs ${r.verwachtZonder.toFixed(6)}`);
    check('met criticus is Â exact het voordeel, niet nog eens −r̄',
      Math.abs(r.met - r.verwachtMet) < 1e-9 * Math.max(1, Math.abs(r.verwachtMet)),
      `${r.met.toFixed(6)} vs ${r.verwachtMet.toFixed(6)}`);
    check('de lopende basislijn wordt nog steeds bijgehouden', Math.abs(r.rbarNa - 0.25) > 1e-9);
  }
  {
    /* bootstrappen: een hele poging spelen met de criticus aan, en per spelstap
       narekenen dat δ = r + γV(s′) − V(s) is, met V(s′) = 0 zodra het doel is
       bereikt of de poging op een botsing eindigt. */
    const r = await p.evaluate(() => {
      const W = window.__brain, S = W.S;
      let cfg = W.cfgOverride(W.readCfg(), { criticOn: true, nEpisodes: 1, evalOn: false, benchOn: false });
      S.cfg = cfg; S.B = W.createBrain(cfg, 555);
      S.rnd = W.mulberry32(31337);
      S.hist = []; S.rewards = []; S.ep = 0; S.structLog = [];
      S.world = W.makeWorld2(12345, cfg.nObs);
      S.ag.x = S.world.start.x; S.ag.y = S.world.start.y; S.trail = [];
      S.step = 0; S.epReward = 0; S.epCollisions = 0; S.epIdle = 0; S.reached = false;
      S.prevDist = Math.hypot(S.world.goal.x - S.ag.x, S.world.goal.y - S.ag.y);
      W.resetBrainState(S.B);
      let stappen = 0, terminaalGezien = false, maxAf = 0;
      let done = false;
      while (!done && stappen < cfg.maxSteps) {
        const vVoor = W.criticValue(S.B, S.inp);       // nog de toestand van de vórige tik
        done = W.gameTick(true, 0.3);
        stappen++;
        if (S.reached) terminaalGezien = true;
      }
      /* de meting die telt: één losse tik, volledig nagerekend */
      S.ag.x = S.world.start.x; S.ag.y = S.world.start.y;
      S.step = 0; S.reached = false;
      S.prevDist = Math.hypot(S.world.goal.x - S.ag.x, S.world.goal.y - S.ag.y);
      W.resetBrainState(S.B);
      const vW0 = Array.from(S.B.vW), vB0 = S.B.vB;
      W.sense(S.ag, S.world, S.inp);
      const sVoor = Array.from(S.inp);
      let v0 = vB0; for (let i = 0; i < sVoor.length; i++) v0 += vW0[i] * sVoor[i];
      W.gameTick(true, 0.3);
      /* uit de gewijzigde criticusgewichten valt δ terug te rekenen */
      let dUit = null;
      for (let i = 0; i < sVoor.length; i++) {
        if (Math.abs(sVoor[i]) > 0.2) { dUit = (S.B.vW[i] - vW0[i]) / (cfg.criticLr * sVoor[i]); break; }
      }
      const dBias = (S.B.vB - vB0) / cfg.criticLr;
      return { stappen, terminaalGezien, dUit, dBias, v0 };
    });
    check('δ uit de gewichten en δ uit de bias zijn hetzelfde getal',
      r.dUit !== null && Math.abs(r.dUit - r.dBias) < 1e-3,
      `${r.dUit === null ? '–' : r.dUit.toFixed(5)} vs ${r.dBias.toFixed(5)}`);
    check('een poging met criticus loopt zonder vast te lopen', r.stappen > 1, `${r.stappen} stappen`);
  }

  /* ---------- 4. schaarse perturbatie ---------- */
  console.log('\n4. schaarse perturbatie verstoort precies wat zij belooft');
  for (const frac of [1, 0.5, 0.25]) {
    const r = await p.evaluate(([frac]) => {
      const W = window.__brain, K = W.K;
      const cfg = W.cfgOverride(W.readCfg(), { perturbFrac: frac });
      const B = W.createBrain(cfg, 777);
      W.resetBrainState(B);
      const inp = new Float32Array(K.N_IN);
      const rnd0 = W.mulberry32(5);
      for (let i = 0; i < inp.length; i++) inp[i] = rnd0();
      const rnd = W.mulberry32(4242);
      let verstoord = 0, totaal = 0, tikken = 0, nietNul = 0;
      for (let t = 0; t < 200; t++) {
        W.brainStep(B, inp, cfg, 0.3, rnd);
        tikken++;
        for (let j = K.HID0; j < B.n; j++) {
          totaal++;
          const afw = Math.abs(B.dev[j]);
          if (B.pmask === null || B.pmask[j]) verstoord++;
          else if (afw !== 0) nietNul++;
        }
      }
      return { deel: verstoord / totaal, nietNul, maskerAan: B.pmask !== null, knopen: B.n - K.HID0, tikken };
    }, [frac]);
    check(`fractie ${frac}: het verstoorde deel is ${r.deel.toFixed(3)}`,
      Math.abs(r.deel - frac) < 0.03, `over ${r.tikken} tikken × ${r.knopen} knopen`);
    check(`fractie ${frac}: onverstoorde knopen krijgen exact nul afwijking`, r.nietNul === 0,
      r.nietNul ? `${r.nietNul} uitzonderingen` : '');
    if (frac === 1) check('fractie 1 zet helemaal geen masker', r.maskerAan === false);
  }

  /* ---------- 5 + 6: het categorische beleid ---------- */
  console.log('\n5+6. het categorische beleid');
  {
    const r = await p.evaluate(() => {
      const W = window.__brain, K = W.K;
      const cfg = W.cfgOverride(W.readCfg(), { catPolicy: true });
      const B = W.createBrain(cfg, 31);
      W.resetBrainState(B);
      const inp = new Float32Array(K.N_IN);
      const rnd0 = W.mulberry32(11);
      for (let i = 0; i < inp.length; i++) inp[i] = rnd0();
      const rnd = W.mulberry32(9001);
      const telActies = new Array(9).fill(0);
      let ongeldig = 0, devSom = 0, n = 0;
      const tp = W.tempOf(0.3);
      for (let t = 0; t < 3000; t++) {
        W.brainStep(B, inp, cfg, 0.3, rnd);
        const P = Array.from(B.press);
        const aan = P.reduce((a, x) => a + x, 0);
        /* geldig = een van de negen: één knop, twee knoppen die loodrecht op
           elkaar staan, of geen enkele */
        const geldig = aan === 0 || aan === 1 ||
          (aan === 2 && !((P[0] && P[1]) || (P[2] && P[3])));
        if (!geldig) ongeldig++;
        const idx = W.CAT_ACTIES.findIndex(A => A.length === aan && A.every(j => P[j]));
        if (idx >= 0) telActies[idx]++;
        n++;
      }
      /* de randkansen: B.act van een knop is onder dit beleid de randkans */
      const marg = [0, 1, 2, 3].map(j => B.act[K.OUT0 + j]);
      /* en de kansen zelf, opnieuw uitgerekend uit de netto ingangen */
      const sc = W.CAT_ACTIES.map(A => A.reduce((s, j) => s + B.onet[j], 0) / tp);
      const mx = Math.max(...sc);
      const ex = sc.map(v => Math.exp(v - mx));
      const Z = ex.reduce((a, x) => a + x, 0);
      const pi = ex.map(v => v / Z);
      const margUit = [0, 1, 2, 3].map(j => W.CAT_ACTIES.reduce((s, A, a) => s + (A.indexOf(j) >= 0 ? pi[a] : 0), 0));
      return { ongeldig, n, telActies, som: pi.reduce((a, x) => a + x, 0), marg, margUit, pi };
    });
    check('elke actie is een van de negen, en nooit op+neer of links+rechts',
      r.ongeldig === 0, `${r.n} tikken, ${r.ongeldig} ongeldig`);
    check('de negen kansen sommeren op 1', Math.abs(r.som - 1) < 1e-9, r.som.toFixed(12));
    check('de gerapporteerde randkans is de randkans van de softmax',
      r.marg.every((m, j) => Math.abs(m - r.margUit[j]) < 1e-6),
      r.marg.map(x => x.toFixed(3)).join(' / '));
    check('alle negen acties komen voor bij exploratie 0,3',
      r.telActies.every(t => t > 0), r.telActies.join(' '));
  }
  {
    /* de score-functie tegen eindige differenties op log π, met een vaste actie */
    const r = await p.evaluate(() => {
      const W = window.__brain;
      const tp = 1.3, eps = 1e-4;
      const net = [0.4, -0.9, 0.15, 0.6];
      const logpi = (nt, a) => {
        const sc = W.CAT_ACTIES.map(A => A.reduce((s, j) => s + nt[j], 0) / tp);
        const mx = Math.max(...sc);
        const ex = sc.map(v => Math.exp(v - mx));
        const Z = ex.reduce((x, y) => x + y, 0);
        return Math.log(ex[a] / Z);
      };
      const uit = [];
      for (let a = 0; a < 9; a++) {
        const A = W.CAT_ACTIES[a];
        /* analytisch: (1[j ∈ a] − randkans_j) / τ */
        const sc = W.CAT_ACTIES.map(S2 => S2.reduce((s, j) => s + net[j], 0) / tp);
        const mx = Math.max(...sc);
        const ex = sc.map(v => Math.exp(v - mx));
        const Z = ex.reduce((x, y) => x + y, 0);
        const pi = ex.map(v => v / Z);
        for (let j = 0; j < 4; j++) {
          const marg = W.CAT_ACTIES.reduce((s, S2, k) => s + (S2.indexOf(j) >= 0 ? pi[k] : 0), 0);
          const analytisch = ((A.indexOf(j) >= 0 ? 1 : 0) - marg) / tp;
          const plus = net.slice(); plus[j] += eps;
          const min = net.slice(); min[j] -= eps;
          const numeriek = (logpi(plus, a) - logpi(min, a)) / (2 * eps);
          uit.push(Math.abs(analytisch - numeriek));
        }
      }
      return { maxAf: Math.max(...uit), n: uit.length };
    });
    check('∂log π/∂net = (1[ingedrukt] − randkans)/τ, op alle 36 combinaties',
      r.maxAf < 1e-6, `grootste afwijking ${r.maxAf.toExponential(1)} over ${r.n} punten`);
  }

  /* ---------- 7. ANG zelf is niet veranderd ---------- */
  console.log('\n7. de huidige leerregel is bit voor bit dezelfde als vóór stap 7');
  {
    const csvPad = path.resolve('experimenten/runs.csv');
    const L = fs.readFileSync(csvPad, 'utf8').trim().split(/\r?\n/);
    const H = L[0].split(',');
    const rijen = L.slice(1).map(l => {
      const c = l.split(','), o = {};
      H.forEach((k, i) => { const v = (c[i] || ''); o[k] = (v !== '' && !isNaN(+v)) ? +v : v; });
      return o;
    });
    const ijk = rijen.filter(x => x.conditie === 'ang-vol' && x.breinZaad === 1000).pop()
      || rijen.filter(x => x.conditie === 'benchmark-standaard' && x.breinZaad === 1000).pop();
    if (!ijk) {
      check('ijkrun uit stap 6 gevonden in runs.csv', false, 'geen rij ang-vol/benchmark-standaard met zaad 1000');
    } else {
      const nu = await p.evaluate(([nep, lr]) => {
        const W = window.__brain;
        let cfg = W.readCfg();
        cfg.nEpisodes = nep; cfg.evalOn = true; cfg.benchOn = true; cfg.benchN = 500; cfg.benchReps = 3;
        cfg = W.cfgOverride(cfg, { lr });
        const row = W.runOne(cfg, 1000, 's7-ijk');
        return { bench: row.benchmark.beleid.pct, streng: row.benchmark.streng.pct,
          s20: row.resultaat.succes20, toets: row.resultaat.toetsPct,
          verb: row.structuur.verbindingen };
      }, [ijk.pogingen, ijk.lr]);
      check('benchmarkscore identiek aan stap 6', Math.abs(nu.bench - ijk.benchBeleid) < 1e-9,
        `${(100 * nu.bench).toFixed(2)}% vs ${(100 * ijk.benchBeleid).toFixed(2)}%`);
      check('argmax-score identiek', Math.abs(nu.streng - ijk.benchStreng) < 1e-9);
      check('laatste 20 identiek', Math.abs(nu.s20 - ijk.succes20) < 1e-9);
      check('aantal verbindingen identiek', nu.verb === ijk.verbindingen, `${nu.verb} vs ${ijk.verbindingen}`);
    }
  }

  if (pagefouten.length) { console.error('\npaginafouten:\n' + pagefouten.join('\n')); fout++; }
  console.log(`\n${ok} geslaagd, ${fout} mislukt`);
  if (fout) process.exitCode = 1;
  await b.close();
})();
