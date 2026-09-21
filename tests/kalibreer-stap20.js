/* Stap 20 — de kalibratie van spel 3. Leert er überhaupt iemand iets, en onder welke opzet?

   Vaste regel uit stap 18: kalibreer eerst of er geleerd wordt, anders meet de reeks
   niets. Alles hier draait op VEEGZADEN (2000+), nooit op de meetzaden 1000–1015 van
   stap 22, en elke kandidaat wordt bewaard — niet alleen de winnaar.

   Rondes (RONDE=1..n, zonder RONDE: alle):
     1  fase A alleen, ANG: leersnelheid x propagatiediepte x spoor x perturbatiefractie,
        plus het gelaagde net met de exacte gradiënt als bewijs dat de taak leerbaar is
     2  het budget: bindt het, kan er nog geleerd worden, en wordt vrijgemaakte ruimte
        werkelijk opnieuw bedraad (de voorwaarde om capaciteit te kunnen VERPLAATSEN)
     3  een heel leven over de vijf fasen: hoeveel pogingen per fase

   Hervatbaar: een kandidaat die al in experimenten/s20-kalibratie.json staat, wordt niet
   overgedaan.  Draaien: tests\draai.cmd kalibreer-stap20.js s20-log.txt              */
const path = require('path'), fs = require('fs');
const L = require('./kalib-lib');
const OUT = path.resolve('experimenten', 's20-kalibratie.json');
const RONDE = process.env.RONDE || null;
const data = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { rondes: {} };
const bewaar = () => fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
const VAST = { structOn: false, growOn: false, retypeOn: false };
const MLP = (n) => ({ layered: true, layerSizes: [n], gradExact: true, ...VAST });
const FASE = f => ({ naam: ['A', 'B', 'C', 'D', "A'"][f], pogingen: 0, ov: { tuinFase: f } });
const ZADEN = [2000, 2001];

const RONDES = {
  1: () => {
    const lijst = [];
    for (const lr of [0.001, 0.002, 0.004, 0.008, 0.016])
      for (const prop of [2, 3]) for (const lam of [0, 0.6]) for (const pf of [1, 0.25])
        lijst.push({ naam: `ang-lr${lr}-p${prop}-lam${lam}-pf${pf}`, ov: { lr, prop, lam, perturbFrac: pf, connBudget: 1200 } });
    for (const lr of [0.004, 0.016]) lijst.push({ naam: `mlp32bp-lr${lr}`, ov: { lr, ...MLP(32) } });
    return lijst.map(k => Object.assign(k, { fasen: [Object.assign(FASE(0), { pogingen: 400 })], benchN: 20 }));
  },
  /* 1b: de winnaars van ronde 1 lagen op de rand van het raster (diepte 3, fractie 0,25),
     en een optimum op de rand is geen optimum. Hier schuift het raster op, en loopt de
     training langer om te zien of de wolk nog klimt of al vlak ligt. */
  '1b': () => {
    const lijst = [];
    for (const lr of [0.004, 0.008, 0.016]) for (const prop of [3, 4, 5]) for (const pf of [0.25, 0.1])
      lijst.push({ naam: `ang-lr${lr}-p${prop}-lam0-pf${pf}-lang`, ov: { lr, prop, lam: 0, perturbFrac: pf, connBudget: 1200 } });
    return lijst.map(k => Object.assign(k, { fasen: [Object.assign(FASE(0), { pogingen: 1000 })], benchN: 20 }));
  },
  /* 1c: fractie 0,1 won in 1b en lag wéér op de rand; hier de stap eronder. */
  '1c': () => {
    const lijst = [];
    for (const lr of [0.004, 0.008]) for (const prop of [3, 4])
      lijst.push({ naam: `ang-lr${lr}-p${prop}-lam0-pf0.05-lang`, ov: { lr, prop, lam: 0, perturbFrac: 0.05, connBudget: 1200 } });
    return lijst.map(k => Object.assign(k, { fasen: [Object.assign(FASE(0), { pogingen: 1000 })], benchN: 20 }));
  },
  /* 2: het budget. Bindt het plafond, kan er onder het plafond nog geleerd worden, en
     waar gaat de vrijgemaakte ruimte heen? De bevroren varianten staan ernaast om te zien
     of het plafond van de wolk op fase A aan de capaciteit ligt of aan het verbouwen. */
  2: () => {
    const B = { lr: 0.008, prop: 3, lam: 0, perturbFrac: 0.1 };
    const lijst = [];
    for (const bud of [0, 2400, 1200, 800]) {
      lijst.push({ naam: `ang-b${bud}`, ov: { ...B, connBudget: bud } });
      lijst.push({ naam: `ang-vast-b${bud}`, ov: { ...B, connBudget: bud, ...VAST } });
    }
    lijst.push({ naam: 'ang-b1200-geengroei', ov: { ...B, connBudget: 1200, growOn: false } });
    lijst.push({ naam: 'ang-b1200-snoei0.06', ov: { ...B, connBudget: 1200, pruneT: 0.06 } });
    lijst.push({ naam: 'ang-b1200-snoei0.015', ov: { ...B, connBudget: 1200, pruneT: 0.015 } });
    return lijst.map(k => Object.assign(k, { fasen: [Object.assign(FASE(0), { pogingen: 600 })], benchN: 20 }));
  },
  /* 2b: ronde 2 liet zien dat het plafond van ronde 1 en 1b (±55 %) aan het budget lag en
     niet aan de wolk: zonder budget haalt zij 96 %, met 1200 verbindingen 50 %. Rondes 1 en
     1b zijn dus onder een kreupel makend budget afgesteld. Twee dingen:
     - het criterium voor het budget, VASTGELEGD VOORDAT 1600 EN 2000 GEMETEN ZIJN: het
       krapste budget waarop ANG én ANG-bevroren fase A gemiddeld op ten minste 90 % halen;
     - de instellingen van ronde 1 opnieuw, nu onder budget 2400. */
  '2b': () => {
    const B = { lr: 0.008, prop: 3, lam: 0, perturbFrac: 0.1 };
    const lijst = [];
    for (const bud of [1600, 2000]) {
      lijst.push({ naam: `ang-b${bud}`, ov: { ...B, connBudget: bud } });
      lijst.push({ naam: `ang-vast-b${bud}`, ov: { ...B, connBudget: bud, ...VAST } });
    }
    for (const lr of [0.004, 0.016]) lijst.push({ naam: `ang-b2400-lr${lr}`, ov: { ...B, lr, connBudget: 2400 } });
    lijst.push({ naam: 'ang-b2400-pf1', ov: { ...B, perturbFrac: 1, connBudget: 2400 } });
    lijst.push({ naam: 'ang-b2400-lam0.6', ov: { ...B, lam: 0.6, connBudget: 2400 } });
    lijst.push({ naam: 'ang-b2400-p2', ov: { ...B, prop: 2, connBudget: 2400 } });
    return lijst.map(k => Object.assign(k, { fasen: [Object.assign(FASE(0), { pogingen: 600 })], benchN: 20 }));
  },
  /* 3: een heel leven over de vijf fasen. Vraag: hoeveel pogingen per fase zijn nodig
     zodat elke conditie binnen een fase op haar eigen niveau terugkomt — anders meet een
     hersteltijd de lengte van de fase in plaats van het herstel.
     Budget 2400 (ronde 2b). Tegenstanders op hetzelfde parameterbudget: een gelaagd net
     van 120 knopen heeft 16*120 + 120*4 = 2400 gewichten, met de exacte gradiënt én met
     dezelfde leerregel als de wolk.
     Exploratie: VAST, op principe besloten voordat deze ronde draaide (zie noiseNow). De
     afbouwende variant loopt mee voor twee condities, alleen om het effect te melden. */
  3: () => {
    const B = { lr: 0.008, prop: 3, lam: 0, perturbFrac: 0.1, connBudget: 2400 };
    const MLP120 = { layered: true, layerSizes: [120], prop: 2, ...VAST };
    const conds = [
      { naam: 'ang', ov: { ...B } },
      { naam: 'ang-vast', ov: { ...B, ...VAST } },
      { naam: 'mlp120-bp', ov: { ...MLP120, gradExact: true, lr: 0.008, lam: 0 } },
      { naam: 'mlp120-pert', ov: { ...MLP120, lr: 0.008, lam: 0, perturbFrac: 0.1 } }
    ];
    const lijst = [];
    for (const P of [400, 800]) for (const c of conds)
      lijst.push({ naam: `leven-P${P}-${c.naam}`, ov: { ...c.ov, ruisVast: true },
        fasen: [0, 1, 2, 3, 4].map(f => Object.assign(FASE(f), { pogingen: P })), benchN: 20 });
    for (const c of conds.filter(c => c.naam === 'ang' || c.naam === 'mlp120-bp'))
      lijst.push({ naam: `leven-P400-${c.naam}-ruisaf`, ov: { ...c.ov, ruisVast: false },
        fasen: [0, 1, 2, 3, 4].map(f => Object.assign(FASE(f), { pogingen: 400 })), benchN: 20 });
    return lijst;
  },
  /* 3b: waarom verliest de wolk haar leervermogen na fase A, terwijl dezelfde leerregel
     in een gelaagd net met hetzelfde budget gewoon herleert? Het is geen verzadiging (de
     entropie van het beleid blijft 0,43, tegen 0,002 bij het gelaagde net). Kort leven
     A -> D, want D is de schone herstart: de oude oplossing zegt er niets over. Per
     kandidaat-oorzaak één ingreep, vrij en bevroren, twee veegzaden. De neuronsoorten
     mogen er sinds 20 september uit (besluit Frank). */
  '3b': () => {
    const B = { lr: 0.008, prop: 3, lam: 0, perturbFrac: 0.1, connBudget: 2400, ruisVast: true };
    const WERK = { 'types.sens.on': false, 'types.refl.on': false, 'types.mem.on': false };
    const varianten = {
      basis: {}, alleenWorkers: WERK, diepte2: { prop: 2 }, vervaging10x: { decay: 0.001 },
      meerRuis: { noise0: 0.5 }, lr016: { lr: 0.016 }, alleenWorkersDiepte2: { ...WERK, prop: 2 }
    };
    const lijst = [];
    for (const [v, ov] of Object.entries(varianten)) for (const vast of [false, true])
      lijst.push({ naam: `AD-${v}${vast ? '-vast' : ''}`, ov: { ...B, ...ov, ...(vast ? VAST : {}) },
        fasen: [Object.assign(FASE(0), { pogingen: 400 }), Object.assign(FASE(3), { pogingen: 400 })], benchN: 20 });
    return lijst;
  }
};

(async () => {
  const { b, leef, fouten } = await L.open();
  for (const r of Object.keys(RONDES)) {
    if (RONDE && r !== String(RONDE)) continue;
    const R = data.rondes[r] = data.rondes[r] || {};
    for (const k of RONDES[r]()) for (const z of ZADEN) {
      const sleutel = `${k.naam}_z${z}`;
      if (R[sleutel]) continue;
      const res = await leef(k.ov, z, k.fasen, k.benchN);
      if (fouten.length) throw new Error(fouten.join(' | '));
      R[sleutel] = Object.assign({ naam: k.naam, zaad: z, ov: k.ov }, res);
      bewaar();
      console.log(`r${r} ${sleutel.padEnd(44)} J ${res.fasen.map(f => (100 * f.J).toFixed(1)).join(' / ')}  ${(res.tijdMs / 1000).toFixed(1)}s`);
    }
  }
  await b.close();
})();
