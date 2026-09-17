/* Maakt een schermafdruk van het seinhuis zoals de pagina het tekent. Geen meting — een
   controle met eigen ogen dat de visualisatie werkelijk iets laat zien, en meteen het
   plaatje dat in de paper en in het verslag kan.
   Draaien: tests\draai.cmd schermafdruk-seinhuis.js s17-afdruk-log.txt                */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);

  const info = await p.evaluate(() => {
    const W = window.__brain, S = W.S;
    document.getElementById('taak').value = 'seinhuis';
    S.cfg = W.readCfg();
    W.genBrain(1000);
    S.cfg = W.readCfg();
    S.rnd = W.mulberry32(S.cfg.seed * 7717 + 991);
    S.running = true;                       /* zodat de strook wordt bijgehouden */
    /* een half getraind gevoel: honderd diensten leren, dan één dienst laten zien */
    S.cfg.nEpisodes = 100;
    for (let e = 0; e < 100; e++) {
      S.world = W.seinDienst(S.cfg.seed * 1000 + e, S.cfg);
      let done = false;
      while (!done) done = W.gameTick(true, 0.3);
    }
    S.world = W.seinDienst(999, S.cfg);
    let done = false, n = 0;
    while (!done && n < 120) { done = W.gameTick(true, 0.3); n++; }
    return { tik: S.step, tikken: S.world.T, eisen: S.seinTel.eisTot, goed: S.seinTel.goedTot,
      strook: (S.seinStrook || []).length };
  });
  /* De tekenlus draait vanzelf zolang S.running aanstaat; even wachten is genoeg. */
  await new Promise(r => setTimeout(r, 600));
  const cvs = await p.$('#worldcvs');
  await cvs.screenshot({ path: path.resolve('docs', 'seinhuis.png') });
  console.log('tik ' + info.tik + '/' + info.tikken + ', ' + info.goed + ' van ' + info.eisen +
    ' eisen goed, strook ' + info.strook + ' tikken');
  console.log('geschreven: docs/seinhuis.png');
  if (fouten.length) { console.error(fouten.join('\n')); process.exitCode = 1; }
  await b.close();
})();
