/* Stap 8 — bewijzen dat elke ablatie werkelijk weglaat wat zij belooft.

   Bij een ablatiereeks is dit de enige controle die telt. Een conditie die het
   onderdeel niet echt uitzet levert een keurige tabelregel op die zegt "dit
   onderdeel doet er niet toe", en dat is precies de conclusie die je dan ten
   onrechte trekt. Er is in dit project al één zo'n geval gevonden: de strenge
   invoerregel stond in een globale die alleen readCfg uit het vinkje zette, dus
   `"inputOnlySens": true` uit de experimentloper kwam nooit bij canConnect aan.
   Controle 2 en 3 hieronder zijn er om dat vast te pinnen.

     1  soorten uitzetten werkt: nul geheugen-, reflex- of invoer-neuronen, en in
        het volle model zijn ze er alle drie (anders meet de ablatie niets);
     2  strenge invoer doet wat zij zegt: élke kant vanaf een invoer-node landt op
        een invoer-neuron — en zonder de vlag is dat aantoonbaar níét zo;
     3  diezelfde vlag komt ook echt uit cfg, niet uit het vinkje in de pagina;
     4  hertypering kan een uitgezette soort niet terugbrengen: na een run met
        geheugen uit is het aantal geheugen-neuronen nog steeds nul, terwijl er
        wél hertyperingen zijn geweest;
     5  de vier vormen van plasticiteit gaan los uit, en het volle model doet ze
        alle vier wél (opnieuw: anders meet de ablatie niets);
     6  vaste structuur zet ze alle vier tegelijk uit;
     7  en het belangrijkste: het volle model reproduceert na de wijziging in
        createBrain nog steeds bit voor bit de meting van stap 4.
*/
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

let ok = 0, fout = 0;
function check(naam, geslaagd, detail) {
  if (geslaagd) { ok++; console.log(`  ok   ${naam}${detail ? '   ' + detail : ''}`); }
  else { fout++; console.log(`  FOUT ${naam}${detail ? '   ' + detail : ''}`); }
}

/* Wordt in de pagina uitgevoerd: bouw een brein met deze overrides en vertel wat
   erin zit. Eén hulpfunctie, zodat elke controle hieronder dezelfde weg loopt. */
const BOUW = ([ov, zaad]) => {
  const W = window.__brain, K = W.K;
  const cfg = W.cfgOverride(W.readCfg(), ov);
  const B = W.createBrain(cfg, zaad);
  const c = W.countKinds(B);
  const nc = B.nc || B.from.length, F = B.cFrom || B.from, T = B.cTo || B.to;
  let vanInvoer = 0, vanInvoerNaarSens = 0;
  for (let i = 0; i < nc; i++) {
    if (B.kinds[F[i]] === K.K_IN) { vanInvoer++; if (B.kinds[T[i]] === K.K_SENS) vanInvoerNaarSens++; }
  }
  return { comp: c, verbindingen: nc, vanInvoer, vanInvoerNaarSens };
};

/* Een korte run met de structurele plasticiteit aan: genoeg rondes om te snoeien,
   bij te groeien, te laten groeien en te hertyperen, en te kort om tijd te kosten. */
const KORT = ([ov, zaad, nep]) => {
  const W = window.__brain;
  let cfg = W.readCfg();
  cfg.nEpisodes = nep; cfg.evalOn = false; cfg.benchOn = false;
  cfg = W.cfgOverride(cfg, ov);
  const r = W.runOne(cfg, zaad, 'test-stap8');
  return {
    comp: W.countKinds(W.S.B),
    gesnoeid: r.structuur.gesnoeid, bijgegroeid: r.structuur.bijgegroeid,
    nieuweNeuronen: r.structuur.nieuweNeuronen, typeVeranderingen: r.structuur.typeVeranderingen,
    neuronenStart: r.config.startNeuronen, neuronenEind: r.config.neuronenNu
  };
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const pagefouten = [];
  p.on('pageerror', e => pagefouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  /* ---------- 1. soorten uitzetten ---------- */
  console.log('\n1. een soort uitzetten laat er nul van over');
  const vol = await p.evaluate(BOUW, [{}, 1000]);
  check('het volle model heeft alle drie de soorten', vol.comp.sens > 0 && vol.comp.refl > 0 && vol.comp.mem > 0,
    `S${vol.comp.sens}/W${vol.comp.work}/R${vol.comp.refl}/M${vol.comp.mem}`);
  for (const [soort, sleutel] of [['mem', 'types.mem.on'], ['refl', 'types.refl.on'], ['sens', 'types.sens.on']]) {
    const r = await p.evaluate(BOUW, [{ [sleutel]: false }, 1000]);
    check(`${sleutel}=false geeft nul ${soort}-neuronen`, r.comp[soort] === 0,
      `S${r.comp.sens}/W${r.comp.work}/R${r.comp.refl}/M${r.comp.mem}, ${r.verbindingen} verbindingen`);
    check(`${sleutel}=false houdt het brein heel`, r.verbindingen > 0 && r.comp.work > 0);
  }

  /* ---------- 2 en 3. de strenge invoerregel ---------- */
  console.log('\n2. strenge invoer: élke kant vanaf een invoer-node landt op een invoer-neuron');
  const los = await p.evaluate(BOUW, [{}, 1000]);
  const streng = await p.evaluate(BOUW, [{ inputOnlySens: true }, 1000]);
  check('zonder de vlag gaat een deel van de invoer rechtstreeks de wolk in',
    los.vanInvoerNaarSens < los.vanInvoer,
    `${los.vanInvoerNaarSens} van ${los.vanInvoer} kanten naar een invoer-neuron`);
  check('met de vlag gaat álle invoer via een invoer-neuron',
    streng.vanInvoer > 0 && streng.vanInvoerNaarSens === streng.vanInvoer,
    `${streng.vanInvoerNaarSens} van ${streng.vanInvoer}`);
  console.log('\n3. en die vlag komt uit cfg, niet uit het vinkje in de pagina');
  const naStreng = await p.evaluate(BOUW, [{}, 1000]);
  check('een run zonder de vlag ná een run mét de vlag is weer los',
    naStreng.vanInvoerNaarSens === los.vanInvoerNaarSens,
    `${naStreng.vanInvoerNaarSens} van ${naStreng.vanInvoer}`);
  check('de strenge conditie verschilt van de losse in de graaf',
    streng.vanInvoerNaarSens !== los.vanInvoerNaarSens);

  /* ---------- 4. hertypering brengt een uitgezette soort niet terug ---------- */
  console.log('\n4. hertypering kan een uitgezette soort niet terugbrengen');
  const memUit = await p.evaluate(KORT, [{ 'types.mem.on': false }, 1000, 120]);
  check('na 120 pogingen nog steeds nul geheugen-neuronen', memUit.comp.mem === 0,
    `S${memUit.comp.sens}/W${memUit.comp.work}/R${memUit.comp.refl}/M${memUit.comp.mem}/N${memUit.comp.neut}`);
  check('en er is in die run wél hertypering geweest', memUit.typeVeranderingen > 0,
    `${memUit.typeVeranderingen} hertyperingen`);

  /* ---------- 5. de vier vormen van plasticiteit, los ---------- */
  console.log('\n5. elke vorm van plasticiteit gaat los uit');
  const ref = await p.evaluate(KORT, [{}, 1000, 120]);
  check('het volle model snoeit, groeit bij, groeit en hertypeert',
    ref.gesnoeid > 0 && ref.bijgegroeid > 0 && ref.nieuweNeuronen > 0 && ref.typeVeranderingen > 0,
    `gesnoeid ${ref.gesnoeid}, bijgegroeid ${ref.bijgegroeid}, nieuw ${ref.nieuweNeuronen}, hertypeerd ${ref.typeVeranderingen}`);
  const gevallen = [
    ['pruneT', { pruneT: 0 }, 'gesnoeid'],
    ['sprout', { sprout: 0 }, 'bijgegroeid'],
    ['growOn', { growOn: false }, 'nieuweNeuronen'],
    ['retypeOn', { retypeOn: false }, 'typeVeranderingen']
  ];
  for (const [naam, ov, veld] of gevallen) {
    const r = await p.evaluate(KORT, [ov, 1000, 120]);
    check(`${naam} uit geeft ${veld} = 0`, r[veld] === 0,
      `gesnoeid ${r.gesnoeid}, bijgegroeid ${r.bijgegroeid}, nieuw ${r.nieuweNeuronen}, hertypeerd ${r.typeVeranderingen}`);
  }
  const geenGroei = await p.evaluate(KORT, [{ growOn: false }, 1000, 120]);
  check('growOn uit laat het aantal neuronen staan', geenGroei.neuronenEind === geenGroei.neuronenStart,
    `${geenGroei.neuronenStart} -> ${geenGroei.neuronenEind}`);

  /* ---------- 6. vaste structuur ---------- */
  console.log('\n6. vaste structuur zet alle vier tegelijk uit');
  const vast = await p.evaluate(KORT, [{ structOn: false, growOn: false, retypeOn: false }, 1000, 120]);
  check('geen enkele structurele verandering',
    vast.gesnoeid === 0 && vast.bijgegroeid === 0 && vast.nieuweNeuronen === 0 && vast.typeVeranderingen === 0,
    `gesnoeid ${vast.gesnoeid}, bijgegroeid ${vast.bijgegroeid}, nieuw ${vast.nieuweNeuronen}, hertypeerd ${vast.typeVeranderingen}`);

  /* ---------- 7. het volle model reproduceert stap 4 nog steeds ---------- */
  /* De wijziging in createBrain raakt een globale die tot nu toe alleen readCfg
     zette. Als daar iets verschoven is in de toevalsreeks of in de bedrading, dan
     wijkt deze run af van de rij die op 9 september is weggeschreven. Zes decimalen
     is de precisie die runs.csv bewaart; meer vergelijken meet afronding. */
  console.log('\n7. het volle model is bit voor bit de meting van stap 4');
  const csv = fs.readFileSync(path.resolve('experimenten/runs.csv'), 'utf8').trim().split(/\r?\n/);
  const H = csv[0].split(',');
  const oud = csv.slice(1).map(l => {
    const c = l.split(','), o = {};
    H.forEach((k, i) => { const v = (c[i] || ''); o[k] = (v !== '' && !isNaN(+v)) ? +v : v; });
    return o;
  }).filter(r => r.conditie === 'benchmark-standaard' && r.lr === 0.008);
  if (!oud.length) {
    check('referentierijen gevonden in runs.csv', false, 'geen benchmark-standaard op lr 0,008');
  } else {
    const zaden = [1000, 1001];
    for (const zaad of zaden) {
      const o = oud.find(r => r.breinZaad === zaad);
      if (!o) { check(`referentie voor zaad ${zaad}`, false); continue; }
      const nu = await p.evaluate(([zaad]) => {
        const W = window.__brain;
        const cfg = W.readCfg();
        cfg.nEpisodes = 500; cfg.evalOn = true;
        cfg.benchOn = true; cfg.benchN = 500; cfg.benchReps = 3;
        const r = W.runOne(cfg, zaad, 'ijk-stap8');
        return { bench: r.benchmark.beleid.pct, succes20: r.resultaat.succes20, verb: r.structuur.verbindingen };
      }, [zaad]);
      const r6 = x => +Number(x).toFixed(6);
      check(`zaad ${zaad} reproduceert stap 4`,
        r6(nu.bench) === r6(o.benchBeleid) && r6(nu.succes20) === r6(o.succes20) && nu.verb === o.verbindingen,
        `benchmark ${(100 * nu.bench).toFixed(4)}% tegen ${(100 * o.benchBeleid).toFixed(4)}%, ` +
        `${nu.verb} tegen ${o.verbindingen} verbindingen`);
    }
  }

  if (pagefouten.length) { console.error('\npaginafouten:\n' + pagefouten.join('\n')); fout++; }
  console.log(`\n${ok} controles goed, ${fout} fout`);
  await b.close();
  process.exitCode = fout ? 1 : 0;
})();
