/* Stap 14 — structuur tegen gedrag, over alle runs.

   Geen nieuwe metingen: dit leest wat stap 8, 12, 12b en 13 al hebben opgeleverd
   (runs.csv en de losse levens-JSON's van stap 13) en stelt er vier vragen aan die
   met de losse stappen zelf niet te beantwoorden waren.

   1. Correlatie binnen één architectuur. De Spearman-correlaties van stap 12 liepen
      over vier architecturen tegelijk op de verborgen standen en maten daardoor vooral
      wélke architectuur een run is. Hier alleen de vier ang-standen van de taakas
      (s12-ang-b0/10/20/40, 48 runs, dezelfde architectuur, alleen de taak verschilt),
      gepoold én per stand — want een gepoolde correlatie die per stand verdwijnt is
      zelf weer een architectuur-achtig confound, nu op het niveau van de taakstand.

   2. Het ontwikkelingstraject. Uit de 900-pogingen-levens van stap 13 (ang, ang-vast,
      ang-geensnoei): stabiliseert de netwerkgrootte per blok van 25 pogingen vóór of
      ná het gedrag? Vastgelegd als het laatste blok waarna de blok-op-blok-verandering
      nooit meer boven 10% van de grootste sprong in dat leven komt ("settling index"),
      per zaad vergeleken met een tekentoets.

   3. Convergentie en degeneratie. De twaalf eindnetwerken van s13-ang: eindigen ze op
      vergelijkbare functionele organisaties (type- en verbindingssamenstelling) of op
      verschillende oplossingen met dezelfde score? Spearman tussen paarsgewijze
      organisatie-afstand en paarsgewijs scoreverschil over de 66 paren.

   4. De klokbevinding hard maken. structEvery = 10 en alleenBijStagnatie = true: de
      herstructurering wordt dus niet blind om de tien pogingen aangestuurd, maar
      (volgens de configuratie) alleen als er stagnatie is. Hier getoetst of de
      churn op elke klokslag samenhangt met een onafhankelijk gemeten stagnatiesignaal
      (de trend van succes20 over de voorgaande tien pogingen) of alleen met de
      pogingsteller zelf.

   Aanroep: node tests/exp-stap14.js                                                 */
const fs = require('fs'), path = require('path');
const OUT = path.resolve('experimenten');
const RUNS = path.join(OUT, 'runs');

/* ---------- csv, in dezelfde vorm als de andere stap-lopers ---------- */
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

/* ---------- statistiek, hergebruikt uit de eerdere stap-lopers ---------- */
const mci = xs => {
  const v = xs.filter(x => x !== null && x !== undefined && isFinite(x));
  const n = v.length; if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, m, sd, ci: 1.96 * sd / Math.sqrt(n) };
};
function tekentoets(verschillen) {
  const v = verschillen.filter(x => x !== null && isFinite(x) && x !== 0);
  const n = v.length; if (!n) return { n: 0, positief: 0, p: null };
  const k = v.filter(x => x > 0).length;
  const bin = (n, k) => { let c = 1; for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1); return c; };
  let p = 0;
  for (let i = 0; i <= n; i++) { const q = bin(n, i) * Math.pow(0.5, n); if (bin(n, i) <= bin(n, k) + 1e-9) p += q; }
  return { n, positief: k, p: Math.min(1, p) };
}
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

/* =========================================================================
   DEEL 1 — correlatie tussen structuur en gedrag, binnen alleen ang
   ========================================================================= */
const rows = leesCsv(path.join(OUT, 'runs.csv'));
const STANDEN = ['s12-ang-b0', 's12-ang-b10', 's12-ang-b20', 's12-ang-b40'];
const angRijen = rows.filter(r => STANDEN.includes(r.conditie));
const STRUCTMATEN = ['verbindingen', 'actieveVerbindingen', 'neuronenEind', 'kortstePad',
  'lussen', 'reflexbogen', 'mem', 'gesnoeid', 'bijgegroeid', 'typeVeranderingen'];
const GEDRAGMATEN = ['benchBeleid', 'memHorizon'];

function correlatieblok(verzameling) {
  const uit = {};
  for (const sm of STRUCTMATEN) for (const gm of GEDRAGMATEN) {
    const paren = verzameling.filter(r => isFinite(r[sm]) && isFinite(r[gm]));
    uit[`${sm}~${gm}`] = { n: paren.length, rho: spearman(paren.map(r => r[sm]), paren.map(r => r[gm])) };
  }
  return uit;
}

const deel1 = {
  vraag: 'Correleert structuur met gedrag binnen de ang-architectuur zelf (taakas, ' +
    '48 runs op vier standen), of alleen wanneer je architecturen samen pooit?',
  n: angRijen.length,
  gepoold: correlatieblok(angRijen),
  perStand: Object.fromEntries(STANDEN.map(s => [s, correlatieblok(rows.filter(r => r.conditie === s))]))
};

/* =========================================================================
   Levens van stap 13 laden — bron voor deel 2, 3 en 4
   ========================================================================= */
const S13_SEED0 = 1000, S13_N = 12;
const S13_CONDITIES = ['ang', 'ang-vast', 'ang-geensnoei'];
const TOTAAL = 900, BLOK = 25, NBLOK = TOTAAL / BLOK;

function leesLeven(cond, zaad) {
  const p = path.join(RUNS, `s13-${cond}_z${zaad}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const levens = {};
for (const cond of S13_CONDITIES) {
  levens[cond] = [];
  for (let k = 0; k < S13_N; k++) {
    const zaad = S13_SEED0 + k;
    const row = leesLeven(cond, zaad);
    if (row) levens[cond].push({ zaad, row });
  }
}

/* =========================================================================
   DEEL 2 — het ontwikkelingstraject: stabiliseert structuur vóór of ná gedrag?
   ========================================================================= */
function blokgemiddelden(historie, veld) {
  const uit = new Array(NBLOK).fill(null);
  for (let b = 0; b < NBLOK; b++) {
    const v = historie.slice(b * BLOK, (b + 1) * BLOK).map(h => h[veld]).filter(x => x !== null && isFinite(x));
    uit[b] = v.length ? v.reduce((a, x) => a + x, 0) / v.length : null;
  }
  return uit;
}
/* Het laatste blok waarna de blok-op-blok-sprong nooit meer boven 10% van de
   grootste sprong in dit leven komt. Een leven zonder enige sprong (bevroren
   structuur) settelt per definitie op blok 0 — dat is de controle dat de maat
   doet wat hij zegt. */
function settelBlok(serie) {
  const sprongen = [];
  for (let i = 1; i < serie.length; i++)
    sprongen.push((serie[i] === null || serie[i - 1] === null) ? 0 : Math.abs(serie[i] - serie[i - 1]));
  const maxSprong = Math.max(0, ...sprongen);
  if (maxSprong === 0) return 0;
  const drempel = 0.1 * maxSprong;
  let laatste = 0;
  sprongen.forEach((s, i) => { if (s > drempel) laatste = i + 1; });
  return laatste;
}

const deel2 = { vraag: 'Stabiliseert de netwerkgrootte per blok van 25 pogingen vóór of ná succes20, ' +
  'over de drie levensfasen van stap 13 heen?', blok: BLOK, perConditie: {} };
for (const cond of S13_CONDITIES) {
  const perZaad = levens[cond].map(({ zaad, row }) => {
    const structSerie = blokgemiddelden(row.historie || [], 'verbindingen');
    const gedragSerie = blokgemiddelden(row.historie || [], 'succes20');
    const settleStruct = settelBlok(structSerie), settleGedrag = settelBlok(gedragSerie);
    return { zaad, settleStruct, settleGedrag, verschil: settleStruct - settleGedrag };
  });
  const verschillen = perZaad.map(r => r.verschil);
  deel2.perConditie[cond] = {
    n: perZaad.length,
    settleStruct: mci(perZaad.map(r => r.settleStruct)),
    settleGedrag: mci(perZaad.map(r => r.settleGedrag)),
    verschil: mci(verschillen),
    tekentoets: tekentoets(verschillen),
    perZaad
  };
}

/* =========================================================================
   DEEL 3 — convergentie en degeneratie: de twaalf eindnetwerken van s13-ang
   ========================================================================= */
const SOORTEN = ['sens', 'work', 'refl', 'mem', 'neut'];
function organisatievector(row, alleSleutels) {
  const hidden = row.netwerk.neuronen.filter(n => SOORTEN.includes(n.type));
  const totaalN = hidden.length || 1;
  const compositie = SOORTEN.map(s => hidden.filter(n => n.type === s).length / totaalN);
  const vp = row.structuur.verbindingenPerTypepaar || {};
  const totaalE = Object.values(vp).reduce((a, b) => a + b, 0) || 1;
  const edges = alleSleutels.map(k => (vp[k] || 0) / totaalE);
  return compositie.concat(edges);
}
function euclid(a, b) { return Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0)); }

const angLevens = levens['ang'];
const alleSleutels = Array.from(new Set(angLevens.flatMap(({ row }) => Object.keys(row.structuur.verbindingenPerTypepaar || {})))).sort();
const eindNetwerken = angLevens.map(({ zaad, row }) => ({
  zaad, vec: organisatievector(row, alleSleutels),
  score: row.benchmark ? row.benchmark.beleid.pct : null,
  compositie: Object.fromEntries(SOORTEN.map((s, i) => [s, organisatievector(row, alleSleutels)[i]]))
}));
const paren3 = [];
for (let i = 0; i < eindNetwerken.length; i++) for (let j = i + 1; j < eindNetwerken.length; j++) {
  const a = eindNetwerken[i], b = eindNetwerken[j];
  if (a.score === null || b.score === null) continue;
  paren3.push({ a: a.zaad, b: b.zaad, organisatieAfstand: euclid(a.vec, b.vec), scoreVerschil: Math.abs(a.score - b.score) });
}
const deel3 = {
  vraag: 'Eindigen de twaalf s13-ang levens op vergelijkbare functionele organisaties, of op ' +
    'verschillende oplossingen met dezelfde score?',
  n: eindNetwerken.length, paren: paren3.length,
  compositiePerType: Object.fromEntries(SOORTEN.map(s => [s, mci(eindNetwerken.map(e => e.compositie[s]))])),
  gemiddeldeOrganisatieAfstand: mci(paren3.map(p => p.organisatieAfstand)),
  gemiddeldScoreverschil: mci(paren3.map(p => p.scoreVerschil)),
  correlatieAfstandTegenScoreverschil: {
    n: paren3.length,
    rho: spearman(paren3.map(p => p.organisatieAfstand), paren3.map(p => p.scoreVerschil))
  },
  eindNetwerken: eindNetwerken.map(e => ({ zaad: e.zaad, score: e.score, compositie: e.compositie }))
};

/* =========================================================================
   DEEL 4 — de klokbevinding hard maken: churn tegen een stagnatiesignaal
   ========================================================================= */
function trendserie(historie) {
  const succ = new Array(TOTAAL).fill(null);
  for (const h of historie) if (h.poging >= 0 && h.poging < TOTAAL) succ[h.poging] = h.succes20;
  const trend = new Array(TOTAAL).fill(null);
  for (let t = 10; t < TOTAAL; t++)
    if (succ[t] !== null && succ[t - 10] !== null) trend[t] = succ[t] - succ[t - 10];
  return trend;
}
const KLOK_CONDITIES = ['ang', 'ang-geensnoei'];
const perLevenKlok = [];
for (const cond of KLOK_CONDITIES) for (const { zaad, row } of levens[cond]) {
  const trend = trendserie(row.historie || []);
  const L = row.herstructureringen || [];
  const ticks = L.map(e => {
    const churn = (e.pruned || 0) + (e.sprouted || 0) + (e.retyped || 0) + (e.grown || 0);
    const idx = e.ep - 1;
    return { ep: e.ep, churn, actief: churn > 0, trend: (idx >= 0 && idx < TOTAAL) ? trend[idx] : null };
  }).filter(t => t.trend !== null);
  const dalend = ticks.filter(t => t.trend <= 0).map(t => t.churn);
  const stijgend = ticks.filter(t => t.trend > 0).map(t => t.churn);
  perLevenKlok.push({
    conditie: cond, zaad, ticks: ticks.length,
    fractieActief: ticks.length ? ticks.filter(t => t.actief).length / ticks.length : null,
    churnDalend: mci(dalend), churnStijgend: mci(stijgend),
    verschilDalendMinStijgend: (dalend.length && stijgend.length) ? mci(dalend).m - mci(stijgend).m : null,
    rhoChurnTrend: spearman(ticks.map(t => t.trend), ticks.map(t => t.churn)),
    rhoChurnEp: spearman(ticks.map(t => t.ep), ticks.map(t => t.churn)),
    /* ep en trend kunnen allebei geleidelijk verschuiven over het leven; de
       correlatie per fase apart (ep-bereik van 300 pogingen, dus veel smaller)
       laat zien of churn~trend blijft staan los van die gedeelde tijdsdrift. */
    rhoPerFase: [[1, 300], [301, 600], [601, 900]].map(([lo, hi]) => {
      const sub = ticks.filter(t => t.ep >= lo && t.ep <= hi);
      return { fase: `${lo}-${hi}`, n: sub.length, rho: spearman(sub.map(t => t.trend), sub.map(t => t.churn)) };
    })
  });
}

const verschillenKlok = perLevenKlok.map(r => r.verschilDalendMinStijgend).filter(x => x !== null);
const deel4 = {
  vraag: 'Correleert de herstructureringsactiviteit met íéts in de omgeving (hier: de trend van ' +
    'succes20, als stagnatiesignaal — structOn vereist alleenBijStagnatie), of alleen met de ' +
    'pogingsteller?',
  perLeven: perLevenKlok,
  fractieActief: mci(perLevenKlok.map(r => r.fractieActief)),
  verschilDalendMinStijgend: mci(verschillenKlok),
  tekentoetsDalendBovenStijgend: tekentoets(verschillenKlok),
  rhoChurnTrendGemiddeld: mci(perLevenKlok.map(r => r.rhoChurnTrend)),
  rhoChurnEpGemiddeld: mci(perLevenKlok.map(r => r.rhoChurnEp)),
  rhoPerFaseGemiddeld: [0, 1, 2].map(i => ({
    fase: perLevenKlok[0].rhoPerFase[i].fase,
    rho: mci(perLevenKlok.map(r => r.rhoPerFase[i].rho))
  }))
};

/* =========================================================================
   Wegschrijven en samenvatten
   ========================================================================= */
fs.writeFileSync(path.join(OUT, 'structuurgedrag.json'), JSON.stringify({
  uitgevoerd: new Date().toISOString(),
  beschrijving: 'Werkplan stap 14: structuur tegen gedrag, over alle bestaande runs van stap 8, ' +
    '12, 12b en 13. Geen nieuwe metingen — vier analyses op wat er al ligt: (1) correlatie tussen ' +
    'structuurmaten en gedrag binnen alleen de ang-architectuur, (2) of netwerkgrootte per blok ' +
    'van 25 pogingen vóór of ná het gedrag stabiliseert in de levens van stap 13, (3) of de ' +
    'twaalf eindnetwerken van s13-ang op vergelijkbare organisaties uitkomen, en (4) of de ' +
    'herstructureringsactiviteit samenhangt met een stagnatiesignaal of alleen met de klok.',
  deel1, deel2, deel3, deel4
}, null, 2));

const g3 = x => x === null || x === undefined ? '–' : x.toFixed(3);
const g1 = x => x === null || x === undefined ? '–' : x.toFixed(1);

console.log('\n=== DEEL 1 — correlatie structuur/gedrag, alleen ang (taakas) ===');
console.log(`n = ${deel1.n} runs over ${STANDEN.length} standen`);
console.log('\n-- gepoold over alle standen --');
for (const k in deel1.gepoold) console.log(`  ${k.padEnd(28)} rho = ${g3(deel1.gepoold[k].rho)}  (n=${deel1.gepoold[k].n})`);
for (const stand of STANDEN) {
  console.log(`\n-- alleen ${stand} --`);
  for (const k in deel1.perStand[stand]) console.log(`  ${k.padEnd(28)} rho = ${g3(deel1.perStand[stand][k].rho)}  (n=${deel1.perStand[stand][k].n})`);
}

console.log('\n=== DEEL 2 — ontwikkelingstraject (settling-blok van 25 pogingen) ===');
for (const cond of S13_CONDITIES) {
  const d = deel2.perConditie[cond];
  if (!d.n) { console.log(`${cond.padEnd(16)} (geen levens gevonden)`); continue; }
  console.log(`${cond.padEnd(16)} settelStruct ${g1(d.settleStruct.m)}  settelGedrag ${g1(d.settleGedrag.m)}  ` +
    `verschil ${g1(d.verschil.m)} (${d.tekentoets.positief}/${d.tekentoets.n} positief, p=${d.tekentoets.p === null ? '–' : d.tekentoets.p.toFixed(4)})`);
}

console.log('\n=== DEEL 3 — convergentie/degeneratie, s13-ang eindnetwerken ===');
console.log(`n = ${deel3.n} levens, ${deel3.paren} paren`);
for (const s of SOORTEN) console.log(`  ${s.padEnd(6)} aandeel: ${g3(deel3.compositiePerType[s].m)} ± ${g3(deel3.compositiePerType[s].ci)}`);
if (deel3.paren) {
  console.log(`  gem. organisatie-afstand ${g3(deel3.gemiddeldeOrganisatieAfstand.m)}   gem. scoreverschil ${g3(deel3.gemiddeldScoreverschil.m)}`);
  console.log(`  rho(afstand, scoreverschil) = ${g3(deel3.correlatieAfstandTegenScoreverschil.rho)}  (n=${deel3.correlatieAfstandTegenScoreverschil.n})`);
} else console.log('  (te weinig levens voor paren)');

console.log('\n=== DEEL 4 — klok tegen stagnatiesignaal ===');
console.log(`fractie ticks met enige herstructurering: ${g3(deel4.fractieActief.m)} ± ${g3(deel4.fractieActief.ci)}`);
console.log(`churn bij dalende trend min churn bij stijgende trend: ${g3(deel4.verschilDalendMinStijgend.m)} ` +
  `(${deel4.tekentoetsDalendBovenStijgend.positief}/${deel4.tekentoetsDalendBovenStijgend.n} positief, p=${deel4.tekentoetsDalendBovenStijgend.p === null ? '–' : deel4.tekentoetsDalendBovenStijgend.p.toFixed(4)})`);
console.log(`gemiddelde rho(churn, trend) per leven:  ${g3(deel4.rhoChurnTrendGemiddeld.m)} ± ${g3(deel4.rhoChurnTrendGemiddeld.ci)}`);
console.log(`gemiddelde rho(churn, poging) per leven: ${g3(deel4.rhoChurnEpGemiddeld.m)} ± ${g3(deel4.rhoChurnEpGemiddeld.ci)}`);
console.log('per fase (smaller ep-bereik, dezelfde controle los van tijdsdrift):');
for (const f of deel4.rhoPerFaseGemiddeld) console.log(`  ${f.fase.padEnd(10)} rho(churn, trend) = ${g3(f.rho.m)} ± ${g3(f.rho.ci)}`);
