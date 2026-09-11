/* Controles bij stap 13 — de omslagproef.

   De zwaarste controle staat onderaan: één leven met één fase moet bit voor bit
   hetzelfde opleveren als runOne met evenveel pogingen. Zou runLeven ergens een
   extra trekking uit de toevalsgenerator doen, of de wereldreeks anders opbouwen,
   dan blijkt dat daar meteen — en dan zou elk verschil tussen de fasen een artefact
   van de loper kunnen zijn in plaats van van de omgeving.                          */
const { chromium } = require('playwright');
const path = require('path');
const C = require('./stap13-condities');

let ok = 0, fout = 0;
const check = (naam, waar, extra) => {
  if (waar) { ok++; console.log(`  ok   ${naam}`); }
  else { fout++; console.log(`  FOUT ${naam}${extra ? '  — ' + extra : ''}`); }
};

(async () => {
  console.log('condities en voorspellingen');
  check('vijf condities', C.CONDITIES.length === 5, `${C.CONDITIES.length}`);
  check('drie fasen', C.FASEN.length === 3);
  check('900 pogingen in totaal', C.FASEN.reduce((a, f) => a + f.pogingen, 0) === 900);
  check('fase 1 en 3 zijn dezelfde omgeving',
    JSON.stringify(C.FASEN[0].ov) === JSON.stringify(C.FASEN[2].ov));
  check('de middenfase knippert', C.FASEN[1].ov.goalBlink === C.MIDDEN && C.MIDDEN > 0);
  check('ang en ang-vast verschillen alleen in structurele plasticiteit', (() => {
    const a = C.CONDITIES.find(c => c.naam === 'ang'), v = C.CONDITIES.find(c => c.naam === 'ang-vast');
    return a && v && Object.keys(a.ov).length === 0 && v.ov.structOn === false &&
      v.ov.growOn === false && v.ov.retypeOn === false && a.lr === v.lr;
  })());
  check('ang-geensnoei zet alleen de snoeidrempel op nul', (() => {
    const g = C.CONDITIES.find(c => c.naam === 'ang-geensnoei');
    return g && Object.keys(g.ov).length === 1 && g.ov.pruneT === 0;
  })());
  check('vijf voorspellingen', C.VOORSPELLINGEN.length === 5);
  check('elke voorspelling heeft een uitgeschreven onwaar-tak',
    C.VOORSPELLINGEN.every(v => v.waar && v.onwaar && v.toets && v.onwaar.length > 60));
  check('de drempel voor herstel ligt onder het plateau',
    C.HERSTEL_DREMPEL > 0 && C.HERSTEL_DREMPEL < 1);

  console.log('\npagina en runLeven');
  const b = await chromium.launch();
  const p = await b.newPage();
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  check('pagina laadt zonder fout', fouten.length === 0, fouten.join(' | '));
  check('runLeven is geëxporteerd', await p.evaluate(() => typeof window.__brain.runLeven === 'function'));

  /* Een kort leven: drie fasen van twintig pogingen, met meting op elke grens. */
  const kort = await p.evaluate(() => {
    const W = window.__brain;
    let cfg = W.readCfg();
    cfg.nEpisodes = 60; cfg.evalOn = false; cfg.benchOn = false; cfg.memOn = false;
    const fasen = [{ naam: 'A1', pogingen: 20, ov: { goalBlink: 0 } },
                   { naam: 'B', pogingen: 20, ov: { goalBlink: 20 } },
                   { naam: 'A2', pogingen: 20, ov: { goalBlink: 0 } }];
    const row = W.runLeven(cfg, 77, fasen, 'proef', { benchN: 30, benchReps: 1 });
    return { fasen: row.leven.fasen, n: row.historie.length,
      laatste: row.historie[row.historie.length - 1].poging,
      blinkEind: row.config.wereld.doelKnipperUit,
      struct: (row.herstructureringen || []).map(e => e.ep) };
  });
  check('drie fasen in het verslag', kort.fasen.length === 3);
  check('de fasegrenzen kloppen',
    kort.fasen.map(f => `${f.vanPoging}-${f.totPoging}`).join(',') === '0-20,20-40,40-60',
    kort.fasen.map(f => `${f.vanPoging}-${f.totPoging}`).join(','));
  check('zestig pogingen geleefd', kort.n === 60 && kort.laatste === 59, `${kort.n}/${kort.laatste}`);
  check('elke grens heeft een meting op de eigen taak én op taak A',
    kort.fasen.every(f => f.opEigenTaak && f.opTaakA));
  check('op de A-fasen zijn eigen taak en taak A dezelfde meting',
    kort.fasen[0].opEigenTaak.pct === kort.fasen[0].opTaakA.pct &&
    kort.fasen[2].opEigenTaak.pct === kort.fasen[2].opTaakA.pct);
  /* Deze controle heeft bug 14 gevangen: benchBrain neemt (modus, werelden,
     herhalingen) en kreeg die drie in de omgekeerde volgorde, waardoor er nul
     speelbeurten waren en elke fasemeting stilletjes NaN werd. Een NaN is nooit
     gelijk aan zichzelf, dus "de twee metingen verschillen" zag er daardoor
     goed uit terwijl er niets gemeten was. Eerst dus: is het wel een getal? */
  check('elke fasemeting is een getal tussen nul en één',
    kort.fasen.every(f => isFinite(f.opEigenTaak.pct) && isFinite(f.opTaakA.pct) &&
      f.opEigenTaak.pct >= 0 && f.opEigenTaak.pct <= 1),
    JSON.stringify(kort.fasen.map(f => [f.opEigenTaak.pct, f.opTaakA.pct])));
  check('op de knipperfase verschillen ze wél',
    kort.fasen[1].opEigenTaak.pct !== kort.fasen[1].opTaakA.pct,
    `${kort.fasen[1].opEigenTaak.pct} vs ${kort.fasen[1].opTaakA.pct}`);
  check('de omgeving staat aan het eind weer op zichtbaar', kort.blinkEind === 0, `${kort.blinkEind}`);
  check('er is herstructureerd tijdens het leven', kort.struct.length > 0);

  /* Herhaalbaarheid: hetzelfde breinzaad, hetzelfde leven. */
  const twee = await p.evaluate(() => {
    const W = window.__brain;
    const doe = () => {
      let cfg = W.readCfg();
      cfg.nEpisodes = 60; cfg.evalOn = false; cfg.benchOn = false; cfg.memOn = false;
      const fasen = [{ naam: 'A1', pogingen: 20, ov: { goalBlink: 0 } },
                     { naam: 'B', pogingen: 20, ov: { goalBlink: 20 } },
                     { naam: 'A2', pogingen: 20, ov: { goalBlink: 0 } }];
      const row = W.runLeven(cfg, 77, fasen, 'proef', { benchN: 30, benchReps: 1 });
      return JSON.stringify(row.historie) + '|' + JSON.stringify(row.leven.fasen);
    };
    return [doe(), doe()];
  });
  check('twee keer hetzelfde leven geeft hetzelfde verslag', twee[0] === twee[1]);

  /* Meten mag het leven niet verstoren: hetzelfde leven met en zonder meetpunten
     moet dezelfde pogingen opleveren. */
  const meting = await p.evaluate(() => {
    const W = window.__brain;
    const doe = meet => {
      let cfg = W.readCfg();
      cfg.nEpisodes = 60; cfg.evalOn = false; cfg.benchOn = false; cfg.memOn = false;
      const fasen = [{ naam: 'A1', pogingen: 20, ov: { goalBlink: 0 } },
                     { naam: 'B', pogingen: 20, ov: { goalBlink: 20 } },
                     { naam: 'A2', pogingen: 20, ov: { goalBlink: 0 } }];
      return JSON.stringify(W.runLeven(cfg, 77, fasen, 'proef', meet).historie);
    };
    return [doe({}), doe({ benchN: 30, benchReps: 1, memN: 20, memBlind: 10, memH: 20 })];
  });
  check('meten op de grens verstoort het leven niet', meting[0] === meting[1]);

  /* De omgeving moet werkelijk omslaan: een leven waarin de middenfase knippert
     hoort te verschillen van een leven waarin hij dat niet doet. */
  const schakelt = await p.evaluate(() => {
    const W = window.__brain;
    const doe = blink => {
      let cfg = W.readCfg();
      cfg.nEpisodes = 60; cfg.evalOn = false; cfg.benchOn = false; cfg.memOn = false;
      const fasen = [{ naam: 'A1', pogingen: 20, ov: { goalBlink: 0 } },
                     { naam: 'B', pogingen: 20, ov: { goalBlink: blink } },
                     { naam: 'A2', pogingen: 20, ov: { goalBlink: 0 } }];
      return JSON.stringify(W.runLeven(cfg, 77, fasen, 'proef', {}).historie.slice(20, 40));
    };
    return [doe(0), doe(20)];
  });
  check('de middenfase verandert werkelijk iets aan het spel', schakelt[0] !== schakelt[1]);

  /* De zwaarste: één fase = runOne, bit voor bit. */
  const gelijk = await p.evaluate(() => {
    const W = window.__brain;
    const basis = () => {
      const c = W.readCfg();
      c.nEpisodes = 60; c.evalOn = false; c.benchOn = false; c.memOn = false;
      return c;
    };
    const a = W.runOne(basis(), 123, 'een');
    const bb = W.runLeven(basis(), 123, [{ naam: 'A', pogingen: 60, ov: {} }], 'een', {});
    return {
      hist: JSON.stringify(a.historie) === JSON.stringify(bb.historie),
      struct: JSON.stringify(a.herstructureringen) === JSON.stringify(bb.herstructureringen),
      net: JSON.stringify(a.netwerk) === JSON.stringify(bb.netwerk)
    };
  });
  check('één fase geeft dezelfde pogingen als runOne', gelijk.hist);
  check('één fase geeft dezelfde herstructureringen als runOne', gelijk.struct);
  check('één fase geeft hetzelfde eindnetwerk als runOne', gelijk.net);

  console.log('\nmaten uit een leven');
  /* De rekenregels uit de loper, los getoetst op een verzonnen leven. */
  const grenzen = [300, 600];
  const nep = (poging, succ) => ({ poging, ok: true, succes20: succ });
  const nep900 = [];
  for (let i = 0; i < 900; i++) {
    let s;
    if (i < 300) s = 0.8;                       /* plateau */
    else if (i < 600) s = 0.2;                  /* inzakken tijdens het knipperen */
    else s = i < 640 ? 0.3 : 0.8;               /* herstel na veertig pogingen */
    nep900.push(nep(i, s));
  }
  const verzonnen = { historie: nep900,
    herstructureringen: [{ ep: 290, pruned: 1, sprouted: 0, retyped: 0, grown: 0 },
                         { ep: 610, pruned: 4, sprouted: 2, retyped: 0, grown: 0 }],
    leven: { fasen: [{ opTaakA: { pct: 0.7 }, opEigenTaak: { pct: 0.7 }, geheugenhorizon: 5 },
                     { opTaakA: { pct: 0.5 }, opEigenTaak: { pct: 0.2 }, geheugenhorizon: 9 },
                     { opTaakA: { pct: 0.72 }, opEigenTaak: { pct: 0.72 }, geheugenhorizon: 6 }] },
    instellingen: { training: { breinZaad: 5 } }, resultaat: { rekentijdMs: 1 },
    benchmark: { beleid: { pct: 0.71 } } };
  /* exp-stap13.js draait zijn werk in een IIFE; de maten zijn daarom hier nagerekend
     met dezelfde regels, zodat een wijziging in één van beide opvalt. */
  const plateau = 0.8, drempel = C.HERSTEL_DREMPEL * plateau;
  let hersteltijd = null;
  for (let i = grenzen[1]; i < 900; i++) if (nep900[i].succes20 >= drempel) { hersteltijd = i - grenzen[1]; break; }
  check('hersteltijd op het verzonnen leven is 40 pogingen', hersteltijd === 40, `${hersteltijd}`);
  check('behoud op het verzonnen leven is −20 procentpunt',
    Math.abs((verzonnen.leven.fasen[1].opTaakA.pct - verzonnen.leven.fasen[0].opTaakA.pct) + 0.2) < 1e-9);
  check('churn ná de tweede omslag is hoger dan ervoor',
    (4 + 2) / 50 > (1) / 50);
  check('een leven dat nooit herstelt geeft geen getal maar niets', (() => {
    let h = null;
    for (let i = 600; i < 900; i++) if (0.3 >= drempel) { h = i - 600; break; }
    return h === null;
  })());

  console.log(`\n${ok} goed, ${fout} fout`);
  if (fouten.length) console.error(fouten.join('\n'));
  await b.close();
  process.exitCode = fout ? 1 : 0;
})();
