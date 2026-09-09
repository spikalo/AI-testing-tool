/* Stap 3 — de leerregel numeriek controleren.

   De sterkste aanspraak in de paper is dat node-perturbatie een schatter van de
   echte gradiënt oplevert. Dat stond opgeschreven en was niet gemeten. Hier wordt
   het gemeten op een miniatuur-ANG met bevroren topologie:

     ∂J/∂w_ij  ≈  ( J(w+ε) − J(w−ε) ) / 2ε        centrale differentie
     Δw_ANG    =  gemiddelde van Â·e over veel pogingen

   J wordt geschat met *gemeenschappelijke toevalsgetallen*: elke poging heeft een
   vaste eigen generator en een vaste wereld, identiek voor elke waarde van w. Zonder
   die truc verdrinkt het verschil tussen J(w+ε) en J(w−ε) in de ruis van het beleid.

   Gerapporteerd wordt cos(Δw_ANG, ∇J), de schaalfactor c uit de kleinste-kwadraten-
   passing c·Δw ≈ ∇J (te vergelijken met de theoretische 1/Var(ξ)), de rest-bias na
   die passing, en hoeveel pogingen er nodig zijn voor een gegeven cosinus.        */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

const OUT = path.resolve('experimenten');
const NWORLDS   = 20;     // vaste toetswerelden waarover J gemiddeld wordt
const MAXSTEPS  = +(process.env.STEPS || 160);
const NOBS      = +(process.env.NOBS || 3);
const EXPL      = 0.30;   // exploratie tijdens het meten (σ_h = 0,35·ε, τ = 0,40+2ε)
const M_J       = +(process.env.MJ || 400);    // pogingen per J-schatting
const N_EST     = +(process.env.NEST || 4000); // pogingen voor de ANG-schatter
const EPS       = +(process.env.EPS || 0.05);
const BURN      = 60;     // pogingen om de basislijn r̄ warm te laten lopen

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('console', m => { if (m.type() === 'error') console.log('PAGINA-FOUT:', m.text()); });
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  /* De hele meetmachinerie leeft in de pagina; hier wordt hij één keer geïnstalleerd. */
  await p.evaluate(([NWORLDS, MAXSTEPS, NOBS, EXPL, BURN]) => {
    const W = window.__brain, S = W.S, K = W.K;
    const G = window.__grad = {};

    G.cfg = () => {
      const c = W.readCfg();
      c.nNeurons = 4;                                     // vier verborgen knopen
      c.types = { sens: { on: false, min: 0, max: 0 }, work: { on: true, min: 4, max: 4 },
                  refl: { on: false, min: 0, max: 0 }, mem: { on: false, min: 0, max: 0 } };
      c.density = 3.5;
      c.nObs = NOBS; c.maxSteps = MAXSTEPS; c.worldEvery = 1;
      c.structOn = false; c.growOn = false; c.retypeOn = false;   // bevroren topologie
      c.decay = 0; c.lrAnneal = false; c.evalOn = false;
      c.stopOnCollide = false;
      c.traceOud = false;
      return c;
    };

    /* Eén poging, met een generator en een wereld die alleen van het pogingnummer
       afhangen. Dat maakt J een deterministische functie van de gewichten. */
    G.episode = (e, noise, leren) => {
      const c = S.cfg;
      S.rnd = W.mulberry32(990001 + e * 7919);
      S.world = W.makeWorld(c.seed * 1000 + (e % NWORLDS), c.nObs);
      S.ag.x = S.world.start.x; S.ag.y = S.world.start.y;
      S.trail = []; S.step = 0; S.epReward = 0; S.epCollisions = 0; S.epIdle = 0; S.reached = false;
      S.prevDist = Math.hypot(S.world.goal.x - S.ag.x, S.world.goal.y - S.ag.y);
      W.resetBrainState(S.B);
      S.lrScale = 1;
      while (!W.gameTickRaw(leren, noise)) { }
      return S.epReward;
    };

    /* J(θ): gemiddelde totale beloning over M pogingen, zonder leren. */
    G.J = (M, noise, off) => {
      const o = off || 0;
      let s = 0;
      for (let e = 0; e < M; e++) s += G.episode(o + e, noise, false);
      return s / M;
    };

    /* De ANG-schatter, per poging apart bewaard zodat de variantie meetbaar is. */
    G.estimator = (N, noise, traceOud) => {
      const B = S.B, nc = B.nc;
      S.cfg.traceOud = !!traceOud;
      B.rbar = 0;
      for (let e = 0; e < BURN; e++) { S.gradAccum = new Float64Array(nc); G.episode(e, noise, true); }
      const per = [];
      for (let e = 0; e < N; e++) {
        const g = new Float64Array(nc);
        S.gradAccum = g;
        G.episode(100000 + e, noise, true);
        per.push(Array.from(g));
      }
      S.gradAccum = null;
      S.cfg.traceOud = false;
      return per;
    };

    /* Numerieke gradiënt per gewicht, centrale differentie. */
    G.numgrad = (eps, M, noise, off) => {
      const B = S.B, nc = B.nc, out = new Float64Array(nc);
      for (let c = 0; c < nc; c++) {
        const w0 = B.cW[c];
        B.cW[c] = w0 + eps; const Jp = G.J(M, noise, off);
        B.cW[c] = w0 - eps; const Jm = G.J(M, noise, off);
        B.cW[c] = w0;
        out[c] = (Jp - Jm) / (2 * eps);
      }
      return Array.from(out);
    };

    /* Trainen zonder de meetstand, om ook op een half getraind brein te kunnen kijken. */
    G.train = (nEp, noise) => {
      S.gradAccum = null;
      for (let e = 0; e < nEp; e++) G.episode(500000 + e, noise, true);
    };

    G.build = (brainSeed) => {
      S.cfg = G.cfg();
      S.B = W.createBrain(S.cfg, brainSeed);
      W.resetBrainState(S.B);
      S.B.rbar = 0;
      return { nc: S.B.nc, n: S.B.n, verborgen: S.B.n - K.HID0 };
    };
    G.weights = () => Array.from(S.B.cW);
    G.uitWolk = () => Array.from(S.B.cFrom).map(i => S.B.kinds[i] !== K.K_IN);
    G.soorten = () => {
      const N = ['in', 'sens', 'work', 'refl', 'mem', 'neut', 'out'], B = S.B;
      return { bron: Array.from(B.cFrom).map(i => N[B.kinds[i]]),
               doel: Array.from(B.cTo).map(i => N[B.kinds[i]]) };
    };
    G.setProp = (v) => { S.cfg.prop = v; };
    G.meanJ = (M, noise, off) => G.J(M, noise, off);
    G.succes = (M, noise) => {
      let k = 0;
      for (let e = 0; e < M; e++) { G.episode(300000 + e, noise, false); if (S.reached) k++; }
      return k / M;
    };
    G.sigma = (noise) => 0.35 * noise;     // hiddenNoiseOf
  }, [NWORLDS, MAXSTEPS, NOBS, EXPL, BURN]);

  /* gameTick roept finishEpisode niet aan; we hebben een variant nodig die alleen
     de tik doet. gameTick zelf is precies dat — het geeft "klaar" terug. */
  await p.evaluate(() => { window.__brain.gameTickRaw = window.__brain.gameTick; });

  const rapport = {
    uitgevoerd: new Date().toISOString(),
    opzet: { verborgenKnopen: 4, werelden: NWORLDS, stappenPerPoging: MAXSTEPS, obstakels: NOBS,
             exploratie: EXPL, pogingenPerJhelft: M_J, pogingenSchatter: N_EST, epsilon: EPS,
             toelichting: 'J wordt met gemeenschappelijke toevalsgetallen geschat: elke poging heeft ' +
               'een vaste eigen generator en een vaste wereld, identiek voor elke waarde van w. De ' +
               'numerieke gradient wordt twee keer berekend op onafhankelijke pogingenblokken; de ' +
               'cosinus tussen die twee helften is de bovengrens van wat er te meten valt.' },
    epsilonReeks: [], punten: [] };

  const csv = ['punt,prop,verbinding,uitWolk,bron,doel,gewicht,numGradA,numGradB,angNieuw,angOud'];

  const PUNTEN = [
    { naam: 'begin',          train: 0,   prop: 1 },
    { naam: 'half getraind',  train: +(process.env.TRAIN || 400), prop: 1 },
    { naam: 'begin prop=2',   train: 0,   prop: 2 }
  ];

  for (const punt of PUNTEN) {
    const info = await p.evaluate(([seed, prop]) => {
      const r = window.__grad.build(seed); window.__grad.setProp(prop); return r;
    }, [4242, punt.prop]);
    const Jvoor = await p.evaluate(([noise]) => window.__grad.meanJ(200, noise, 800000), [EXPL]);
    if (punt.train) await p.evaluate(([n, noise]) => window.__grad.train(n, noise), [punt.train, EXPL]);
    const Jna = await p.evaluate(([noise]) => window.__grad.meanJ(200, noise, 800000), [EXPL]);
    const w = await p.evaluate(() => window.__grad.weights());
    const uitWolk = await p.evaluate(() => window.__grad.uitWolk());
    const soorten = await p.evaluate(() => window.__grad.soorten());
    const succes = await p.evaluate(([noise]) => window.__grad.succes(200, noise), [EXPL]);
    console.log(`\n=== ${punt.naam} — ${info.nc} verbindingen (${uitWolk.filter(Boolean).length} uit de wolk), ` +
      `prop=${punt.prop}, succes ${(100 * succes).toFixed(0)} %, ` +
      `J ${Jvoor.toFixed(3)} → ${Jna.toFixed(3)} na ${punt.train} pogingen leren ===`);

    let t = Date.now();
    const ngA = await p.evaluate(([eps, M, noise]) => window.__grad.numgrad(eps, M, noise, 0), [EPS, M_J, EXPL]);
    const ngB = await p.evaluate(([eps, M, noise, off]) => window.__grad.numgrad(eps, M, noise, off),
      [EPS, M_J, EXPL, 600000]);
    console.log(`  numerieke gradient klaar (${((Date.now() - t) / 1000).toFixed(0)} s, ` +
      `${info.nc * 4 * M_J} pogingen)`);

    const perNieuw = await p.evaluate(([N, noise]) => window.__grad.estimator(N, noise, false), [N_EST, EXPL]);
    const perOud = await p.evaluate(([N, noise]) => window.__grad.estimator(N, noise, true), [N_EST, EXPL]);
    const sigma = await p.evaluate(([noise]) => window.__grad.sigma(noise), [EXPL]);

    const rij = analyse(punt, succes, w, uitWolk, ngA, ngB, perNieuw, perOud, sigma);
    rij.JvoorLeren = Jvoor; rij.JnaLeren = Jna; rij.pogingenGeleerd = punt.train;
    rapport.punten.push(rij);
    ngA.forEach((g, c) => csv.push([punt.naam, punt.prop, c, uitWolk[c] ? 1 : 0,
      soorten.bron[c], soorten.doel[c], w[c], g, ngB[c],
      mean(perNieuw.map(v => v[c])), mean(perOud.map(v => v[c]))].map(fmt).join(',')));
  }

  /* Hoe gevoelig is de centrale differentie voor de stapgrootte? Te klein en de ruis
     wint, te groot en de kromming vertekent. Dit is de controle op die keuze. */
  console.log('\n=== stapgrootte van de centrale differentie ===');
  await p.evaluate(([seed]) => { window.__grad.build(seed); window.__grad.setProp(1); }, [4242]);
  const perRef = await p.evaluate(([N, noise]) => window.__grad.estimator(N, noise, false),
    [Math.min(2000, N_EST), EXPL]);
  const gemRef = [];
  for (let c = 0; c < perRef[0].length; c++) gemRef.push(mean(perRef.map(v => v[c])));
  for (const eps of [0.01, 0.02, 0.03, 0.06, 0.12]) {
    const M = Math.round(M_J / 3);
    const a = await p.evaluate(([e, M, noise]) => window.__grad.numgrad(e, M, noise, 0), [eps, M, EXPL]);
    const b = await p.evaluate(([e, M, noise]) => window.__grad.numgrad(e, M, noise, 600000), [eps, M, EXPL]);
    const rij = { epsilon: eps, pogingenPerHelft: M, splitHalf: cos(a, b),
      cosMetSchatter: cos(a.map((x, i) => (x + b[i]) / 2), gemRef) };
    rapport.epsilonReeks.push(rij);
    console.log(`  eps=${eps}: helft-tegen-helft ${rij.splitHalf.toFixed(3)}, ` +
      `cos met de schatter ${rij.cosMetSchatter.toFixed(3)}`);
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'gradcheck.csv'), csv.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'gradcheck.json'), JSON.stringify(rapport, null, 2));
  console.log('\ngeschreven: experimenten/gradcheck.csv en gradcheck.json');
  await b.close();

  /* ---------- rekenwerk buiten de pagina ---------- */
  function fmt(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toPrecision(8);
    const t = String(v);
    return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }
  function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
  function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function nrm(a) { return Math.sqrt(dot(a, a)); }
  function cos(a, b) { const d = nrm(a) * nrm(b); return d ? dot(a, b) / d : 0; }
  function sub(a, keep) { return a.filter((_, i) => keep[i]); }

  function analyse(punt, succes, w, uitWolk, ngA, ngB, perNieuw, perOud, sigma) {
    const nc = ngA.length;
    const ng = ngA.map((x, i) => (x + ngB[i]) / 2);
    /* De twee helften zijn onafhankelijke schattingen van dezelfde grootheid. Hun
       cosinus zegt hoeveel van de gemeten richting signaal is; via de standaard
       verzwakkingscorrectie is dat ook de bovengrens voor elke vergelijking ermee. */
    const splitHalf = cos(ngA, ngB);
    const plafond = Math.sqrt(Math.max(0, 2 * splitHalf / (1 + splitHalf)));
    const uit = { punt: punt.naam, prop: punt.prop, succes, verbindingen: nc,
      verbindingenUitWolk: uitWolk.filter(Boolean).length,
      sigmaRuis: sigma, varianteRuis: sigma * sigma / 3,
      splitHalfNumGrad: splitHalf, cosinusPlafond: plafond, normGrad: nrm(ng), varianten: {} };
    {
      const gN = [], gO = [];
      for (let c = 0; c < nc; c++) { gN.push(mean(perNieuw.map(v => v[c]))); gO.push(mean(perOud.map(v => v[c]))); }
      const d = gN.map((x, i) => x - gO[i]);
      uit.schattersOnderling = { cosinus: cos(gN, gO), relatiefVerschil: nrm(d) / nrm(gN),
        relatiefVerschilUitWolk: nrm(sub(d, uitWolk)) / nrm(sub(gN, uitWolk)) };
      console.log(`  schatters oud vs nieuw: cos ${uit.schattersOnderling.cosinus.toFixed(4)}, ` +
        `relatief verschil ${(100 * uit.schattersOnderling.relatiefVerschil).toFixed(1)} % ` +
        `(alleen uit de wolk: ${(100 * uit.schattersOnderling.relatiefVerschilUitWolk).toFixed(1)} %)`);
    }
    console.log(`  numerieke gradient: helft-tegen-helft ${splitHalf.toFixed(3)} ` +
      `→ meetbaar plafond voor de cosinus ${plafond.toFixed(3)}`);

    for (const [k, per] of [['nieuw', perNieuw], ['oud', perOud]]) {
      const gem = [];
      for (let c = 0; c < nc; c++) gem.push(mean(per.map(v => v[c])));
      const cosine = cos(gem, ng);
      const schaal = dot(gem, ng) / dot(gem, gem);
      const rest = ng.map((g, c) => g - schaal * gem[c]);
      const sd = [];
      for (let c = 0; c < nc; c++) {
        const xs = per.map(v => v[c]), m = mean(xs);
        sd.push(Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1)));
      }
      const kromme = [];
      for (const N of [1, 3, 10, 30, 100, 300, 1000, 3000]) {
        if (N > per.length) break;
        const cs = [];
        for (let r = 0; r < 60; r++) {
          const acc = new Float64Array(nc);
          for (let i = 0; i < N; i++) {
            const v = per[Math.floor(Math.random() * per.length)];
            for (let c = 0; c < nc; c++) acc[c] += v[c];
          }
          cs.push(cos(Array.from(acc), ng));
        }
        cs.sort((a, b) => a - b);
        kromme.push({ pogingen: N, cosMediaan: cs[30], cos10: cs[6], cos90: cs[53] });
      }
      const invoer = uitWolk.map(x => !x);
      uit.varianten[k] = {
        cosinus: cosine,
        cosinusGecorrigeerd: plafond > 0 ? cosine / plafond : null,
        cosinusUitWolk: cos(sub(gem, uitWolk), sub(ng, uitWolk)),
        cosinusUitInvoer: cos(sub(gem, invoer), sub(ng, invoer)),
        tekenOvereenkomst: gem.filter((g, c) => Math.sign(g) === Math.sign(ng[c])).length / nc,
        schaalfactor: schaal, theoretischeSchaal: 3 / (sigma * sigma),
        restBiasRelatief: nrm(rest) / nrm(ng),
        gemiddeldeSignaalRuis: mean(gem.map((g, c) => Math.abs(g) / (sd[c] || 1e-12))),
        cosinusKromme: kromme
      };
      const v = uit.varianten[k];
      console.log(`  trace-${k}: cos ${cosine.toFixed(3)} (gecorrigeerd ${(v.cosinusGecorrigeerd||0).toFixed(3)}), ` +
        `uit de wolk ${v.cosinusUitWolk.toFixed(3)}, uit invoer ${v.cosinusUitInvoer.toFixed(3)}, ` +
        `teken gelijk ${(100 * v.tekenOvereenkomst).toFixed(0)} %`);
      console.log(`    schaal ${schaal.toExponential(2)} (theorie 3/Var(ξ) = ${(3 / sigma / sigma).toExponential(2)}), ` +
        `rest-bias ${(100 * v.restBiasRelatief).toFixed(0)} %`);
      console.log('    cosinus per aantal pogingen: ' +
        kromme.map(x => `${x.pogingen}:${x.cosMediaan.toFixed(2)}`).join('  '));
    }
    return uit;
  }
})();
