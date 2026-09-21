/* Maakt een schermafdruk van de proeftuin zoals de pagina hem tekent. Geen meting — een
   controle met eigen ogen dat de visualisatie werkelijk iets laat zien, en meteen het
   plaatje voor het verslag en de paper.

   Wat er op staat is met opzet het lastigste moment van het spel: een net dat fase A
   volledig beheerst, op het ogenblik dat fase C is ingegaan. De zintuigen zijn niet
   veranderd, de regel wel. Onderin is te zien dat het antwoord nog volledig van de kleur
   afhangt en nog niet van de beweging — precies het gat dat spel 3 moet meten.

   Er staat een gelaagd net met de exacte gradiënt op, en niet de wolk: dit plaatje laat
   het spel en de meters zien, niet een uitkomst, en dan hoort er een speler op te staan
   die de taak aantoonbaar kan.
   Draaien: tests\draai.cmd schermafdruk-proeftuin.js s19-afdruk-log.txt               */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  const info = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    document.getElementById('taak').value = 'proeftuin';
    if (document.getElementById('prop')) document.getElementById('prop').value = 2;
    S.cfg = W.cfgOverride(W.readCfg(), { taak: 'proeftuin', worldEvery: 1, catPolicy: true,
      tuinTikken: 120, tuinFase: 0, lr: 0.016, prop: 2, layered: true, layerSizes: [32],
      gradExact: true, structOn: false, growOn: false, retypeOn: false, connBudget: 0 });
    S.cfg.nEpisodes = 200;
    S.B = W.createLayered(S.cfg, 1000);
    S.rnd = W.mulberry32(S.cfg.seed * 7717 + 991);
    S.watching = true;
    /* eerst fase A helemaal leren */
    for (let e = 0; e < 200; e++) {
      S.world = W.tuinRonde(S.cfg.seed * 1000 + e, S.cfg);
      W.tuinStart();
      let done = false;
      while (!done) done = W.gameTick(true, 0.25);
    }
    const opA = W.benchBrain('beleid', 10, 1);
    /* en dan, zonder waarschuwing, de omslag naar fase C */
    S.cfg.tuinFase = 2;
    S.world = W.tuinRonde(424242, S.cfg);
    W.tuinStart();
    let done = false, n = 0;
    while (!done && n < 70) { done = W.gameTick(true, 0.25); n++; }
    return { naFaseA: opA.perFase.A.pct, opC: opA.perFase.C.pct,
      kanaal: opA.kanaalafhankelijkheid, bodem: opA.afleiderbodem,
      tik: S.step, strook: (S.tuinStrook || []).length };
  });
  await p.evaluate(() => window.__brain.drawProeftuin());
  await new Promise(r => setTimeout(r, 300));
  const cvs = await p.$('#worldcvs');
  await cvs.screenshot({ path: path.resolve('docs', 'proeftuin.png') });
  console.log('na 200 rondes fase A:', (100 * info.naFaseA).toFixed(1) + '%',
    ' diezelfde oplossing op fase C:', (100 * info.opC).toFixed(1) + '%');
  console.log('waar het antwoord van afhangt:', JSON.stringify(info.kanaal),
    ' ruisbodem afleiders', info.bodem.toFixed(3));
  console.log('afdruk geschreven naar docs/proeftuin.png, tik', info.tik, 'strook', info.strook);
  if (fouten.length) console.log('PAGINAFOUTEN:', fouten.join(' | '));
  await b.close();
  process.exit(fouten.length ? 1 : 0);
})();
