/* De test die bij stap 16 hoort.

   Wat een test hier moet bewijzen, in volgorde van belangrijkheid:

   1. DE NIEUWE KNOP DOET NIETS IN HAAR UITSTAND. Niet "waarschijnlijk niets" maar
      aantoonbaar niets: de klokconditie moet met hetzelfde zaad exact hetzelfde leven
      geven als s13-ang uit stap 13, historie voor historie en gewicht voor gewicht.
      Dat is tegelijk de controle uit stap 7 (een knop mag in haar uitstand geen
      trekking uit de toevalsgenerator halen) en die uit stap 8, fout 12 (de waarde
      moet uit cfg komen).
   2. DE DETECTOR TREKT NIETS UIT DE TOEVALSGENERATOR. Twee klokruns met verschillende
      detectorinstellingen moeten identiek zijn.
   3. ER IS ÉCHT GEMETEN. Elke poging heeft een d, elke d is eindig en niet negatief,
      elke drempel is eindig zodra de detector rijp is. Eerst eindigheid en bereik, dan
      pas verschil — stap 13, fout 14.
   4. ELKE CONDITIE STOND ÉCHT AAN. De signaalconditie herstructureert werkelijk en op
      signaalmomenten; de vaste conditie herstructureert niet; de budgetconditie loopt
      op de klokperiode die haar is opgegeven.
   5. DE GEKOPIEERDE MAATFUNCTIE IS DE MAATFUNCTIE VAN STAP 13. Niet beweerd maar
      nagerekend: de tabel van stap 13 wordt opnieuw uitgerekend uit de opgeslagen runs
      en naast experimenten/omslag.json gelegd.

   Draaien: tests\draai.cmd test-stap16.js s16-test-log.txt                           */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { DETECTOR, STAGVENSTER, FASEN, MEET_SEED0,
  MEETPUNT, PLATEAU_VENSTER, HERSTEL_DREMPEL, OMSLAG_VENSTER } = require('./stap16-condities');
const { maakMaten } = require('./omslag-maten');

const OUT = path.resolve('experimenten');
const TOTAAL = FASEN.reduce((a, f) => a + f.pogingen, 0);
const GRENZEN = FASEN.map((f, i) => FASEN.slice(0, i + 1).reduce((a, g) => a + g.pogingen, 0));
const OMSLAG = GRENZEN.slice(0, -1);
const maten = maakMaten({ TOTAAL, OMSLAG, PLATEAU_VENSTER, HERSTEL_DREMPEL, OMSLAG_VENSTER });

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

  const draai = (zaad, ov, opties) => p.evaluate(([zaad, ov, fasen, meet, totaal, o]) => {
    const W = window.__brain;
    let cfg = W.readCfg();
    cfg.nEpisodes = totaal; cfg.evalOn = false;
    cfg.benchOn = !!o.bench; cfg.benchN = o.benchN || 500; cfg.benchReps = 1;
    cfg.memOn = !!o.mem; cfg.memN = o.memN || 100;
    cfg = W.cfgOverride(cfg, Object.assign({}, ov, { lr: 0.008 }));
    return W.runLeven(cfg, zaad, fasen, 's16-test', o.bench ? meet : {});
  }, [zaad, ov, FASEN, MEETPUNT, TOTAAL, opties || {}]);

  /* ---------- 5. de gekopieerde maatfunctie is die van stap 13 ---------- */
  {
    const omslag = JSON.parse(fs.readFileSync(path.join(OUT, 'omslag.json'), 'utf8'));
    let vergeleken = 0, gelijkAan = 0;
    for (const naam in omslag.tabel) {
      const rijen = [];
      for (let k = 0; k < omslag.zaden; k++) {
        const pad = path.join(OUT, 'runs', `${naam}_z${omslag.eersteZaad + k}.json`);
        if (fs.existsSync(pad)) rijen.push(maten(JSON.parse(fs.readFileSync(pad, 'utf8'))));
      }
      if (!rijen.length) continue;
      for (const maat of ['hersteltijd', 'behoud', 'terugwinst', 'aEind1', 'bScore']) {
        const v = rijen.map(r => r[maat]).filter(x => x !== null && isFinite(x));
        if (!v.length || !omslag.tabel[naam][maat]) continue;
        const m = v.reduce((a, c) => a + c, 0) / v.length;
        vergeleken++;
        if (Math.abs(m - omslag.tabel[naam][maat].m) < 1e-9) gelijkAan++;
      }
    }
    ok('de maatfunctie reproduceert de tabel van stap 13',
      vergeleken > 0 && vergeleken === gelijkAan, `${gelijkAan}/${vergeleken} waarden gelijk`);
  }

  /* ---------- 1. de klokconditie is bit voor bit s13-ang ---------- */
  {
    let vergeleken = 0, gelijkAan = 0, ontbrekend = 0;
    for (const zaad of [MEET_SEED0, MEET_SEED0 + 1]) {
      const pad = path.join(OUT, 'runs', `s13-ang_z${zaad}.json`);
      if (!fs.existsSync(pad)) { ontbrekend++; continue; }
      const oud = JSON.parse(fs.readFileSync(pad, 'utf8'));
      const nieuw = await draai(zaad, { stagVenster: STAGVENSTER },
        { bench: true, benchN: 500, mem: true, memN: 100 });
      vergeleken++;
      const zelfdeHist = gelijk(oud.historie, nieuw.historie);
      const zelfdeNet = gelijk(oud.netwerk, nieuw.netwerk);
      const zelfdeStruct = gelijk(
        (oud.herstructureringen || []).map(e => [e.ep, e.pruned, e.sprouted, e.retyped, e.grown]),
        (nieuw.herstructureringen || []).map(e => [e.ep, e.pruned, e.sprouted, e.retyped, e.grown]));
      if (zelfdeHist && zelfdeNet && zelfdeStruct) gelijkAan++;
      else console.log(`     zaad ${zaad}: historie ${zelfdeHist}, netwerk ${zelfdeNet}, herstructureringen ${zelfdeStruct}`);
    }
    ok('de klokconditie geeft exact het leven van stap 13 terug',
      vergeleken > 0 && vergeleken === gelijkAan,
      `${gelijkAan}/${vergeleken} levens identiek${ontbrekend ? `, ${ontbrekend} zonder opgeslagen run` : ''}`);
  }

  /* ---------- 2. de detector trekt niets uit de toevalsgenerator ---------- */
  {
    const a = await draai(MEET_SEED0, { stagVenster: STAGVENSTER, sigFast: 5, sigSlow: 60, sigK: 3 }, {});
    const c = await draai(MEET_SEED0, { stagVenster: STAGVENSTER, sigFast: 20, sigSlow: 150, sigK: 9 }, {});
    ok('een andere detectorinstelling verandert het leven niet zolang de poort uit staat',
      gelijk(a.historie, c.historie) && gelijk(a.netwerk, c.netwerk));
    ok('maar de d-reeks verandert wél mee (anders meet de detector niets)',
      !gelijk(a.poort.map(r => r.d), c.poort.map(r => r.d)));
  }

  /* ---------- 3. er is écht gemeten ---------- */
  const sig = await draai(MEET_SEED0, Object.assign({ structSignal: true, stagVenster: STAGVENSTER }, DETECTOR), {});
  {
    const P = sig.poort;
    ok('elke poging heeft een regel in de poortlog', P.length === TOTAAL, `${P.length} van ${TOTAAL}`);
    ok('elke d is eindig', P.every(r => r.d === null || isFinite(r.d)));
    ok('geen enkele d is negatief', P.every(r => r.d === null || r.d >= 0));
    const rijp = P.filter(r => r.rijp);
    ok('er zijn rijpe pogingen', rijp.length > TOTAAL / 2, `${rijp.length} rijp`);
    ok('elke drempel is eindig zodra de detector rijp is',
      rijp.every(r => r.drempel === null || isFinite(r.drempel)));
    ok('de d-reeks staat niet stil', new Set(P.map(r => r.d)).size > TOTAAL / 2);
    ok('elke poging heeft zestien kanaalgemiddelden',
      P.every(r => r.m === null || (Array.isArray(r.m) && r.m.length === 16 && r.m.every(x => isFinite(x)))));
  }

  /* ---------- 4. elke conditie stond écht aan ---------- */
  {
    const L = sig.herstructureringen || [];
    ok('de signaalconditie herstructureert werkelijk', L.length > 0, `${L.length} ronden`);
    ok('en doet dat op signaalmomenten', L.every(e => e.bron === 'signaal'));
    const vuurPogingen = new Set(sig.poort.filter(r => r.signaalVuur).map(r => r.poging));
    ok('elke ronde valt op een poging waarop de poort vuurde',
      L.every(e => vuurPogingen.has(e.ep)));
    ok('de poort volgt niet stiekem de klok',
      L.some(e => e.ep % 10 !== 0), 'minstens één ronde valt buiten het klokrooster');

    const vast = await draai(MEET_SEED0, { structOn: false, growOn: false, retypeOn: false, stagVenster: STAGVENSTER }, {});
    ok('de vaste conditie herstructureert niet', (vast.herstructureringen || []).length === 0);
    ok('en de detector loopt daar nog steeds mee', vast.poort.some(r => r.d !== null));

    const elke = 32;
    const bud = await draai(MEET_SEED0, { stagVenster: STAGVENSTER, structEvery: elke }, {});
    const B = bud.herstructureringen || [];
    ok('de budgetconditie loopt op de opgegeven klokperiode',
      B.length > 0 && B.every(e => e.ep % elke === 0), `${B.length} ronden, elke ${elke} pogingen`);
    ok('en dat is een ander aantal dan de gewone klok',
      B.length !== (await draai(MEET_SEED0, { stagVenster: STAGVENSTER }, {})).herstructureringen.length);

    ok('de signaalconditie verbouwt echt op andere momenten dan de klok',
      !gelijk(L.map(e => e.ep), B.map(e => e.ep)));
  }

  /* ---------- en het stagnatievenster hangt niet meer aan de klokperiode ---------- */
  {
    const a = await draai(MEET_SEED0, { stagVenster: STAGVENSTER, structEvery: 32 }, {});
    const st = a.config.structureel;
    ok('het stagnatievenster staat los van structEvery',
      st.stagnatieVenster === STAGVENSTER,
      `venster ${st.stagnatieVenster}, klok ${st.herstructureerElke}`);
    ok('de aansturing staat in de opgeslagen configuratie', st.aansturing === 'klok', st.aansturing);
    ok('en bij de signaalconditie staat daar "omgevingssignaal"',
      sig.config.structureel.aansturing === 'omgevingssignaal');
  }

  if (fouten.length) { console.error('paginafouten:\n' + fouten.join('\n')); fout++; }
  console.log(fout ? `\n${fout} controle(s) MISLUKT` : '\nalle controles groen');
  process.exitCode = fout ? 1 : 0;
  await b.close();
})();
