/* De pagina zelf bedienen: knoppen, experimentloper, breinlader. */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewportSize: { width: 1600, height: 1100 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  const out = {};

  // zaadveld is bij het opstarten ingevuld
  out.zaadBijStart = await p.inputValue('#bseed');

  // zaad zetten -> nieuw brein -> zelfde structuur als een tweede keer
  await p.fill('#bseed', '20260908');
  await p.click('#genbrain');
  const h1 = await p.evaluate(() => { const B = window.__brain.S.B; return B.nc + ':' + B.n + ':' + Array.from(B.cW.slice(0, 5)).join(','); });
  await p.click('#genbrain');
  const h2 = await p.evaluate(() => { const B = window.__brain.S.B; return B.nc + ':' + B.n + ':' + Array.from(B.cW.slice(0, 5)).join(','); });
  out.zaadKnopHerhaalbaar = (h1 === h2);
  out.zaadNaGen = await p.inputValue('#bseed');

  // experimentloper via de UI: 2 condities x 2 zaden x 60 pogingen
  await p.fill('#expspec', '[{"naam":"vol"},{"naam":"vast","structOn":false}]');
  await p.fill('#expseeds', '2'); await p.dispatchEvent('#expseeds', 'input');
  await p.fill('#expep', '60'); await p.dispatchEvent('#expep', 'input');
  await p.fill('#expseed0', '500');
  await p.uncheck('#expjson');
  await p.click('#expstart');
  await p.waitForFunction(() => !window.__brain.S.expRunning, { timeout: 120000 });
  out.experiment = await p.evaluate(() => ({
    rijen: document.querySelectorAll('#expbody tr').length,
    csvRegels: window.__brain.S.expCsvLines ? window.__brain.S.expCsvLines.length : 0,
    kop: document.getElementById('exphd').textContent,
    samenvatting: document.getElementById('expsummary').textContent.replace(/\s+/g, ' ').slice(0, 200),
    balk: document.getElementById('expbar').style.width
  }));

  // een resultaat naar schijf simuleren en via de bestandskiezer terugladen
  const json = await p.evaluate(() => {
    const W = window.__brain;
    const cfg = W.readCfg(); cfg.nEpisodes = 80; cfg.evalOn = true;
    return JSON.stringify(W.runOne(JSON.parse(JSON.stringify(cfg)), 31337, 'proef'), null, 2);
  });
  const fs = require('fs'); fs.writeFileSync('/tmp/proef.json', json);
  await p.click('#btnloadbrain');
  await p.setInputFiles('#loadfile', '/tmp/proef.json');
  await p.waitForTimeout(400);
  out.breinGeladen = await p.evaluate(() => ({
    status: document.getElementById('loadstatus').textContent.replace(/\s+/g, ' ').slice(0, 150),
    zaad: window.__brain.S.B.seed,
    bseedveld: document.getElementById('bseed').value
  }));

  await p.click('#btnloadcfg');
  await p.setInputFiles('#loadfile', '/tmp/proef.json');
  await p.waitForTimeout(400);
  out.cfgGeladen = await p.evaluate(() => ({
    status: document.getElementById('loadstatus').textContent.replace(/\s+/g, ' ').slice(0, 130),
    zaad: window.__brain.S.B.seed
  }));

  // horizontale overflow op een paar breedtes
  out.overflow = [];
  for (const w of [1600, 1400, 1200, 1000, 820]) {
    await p.setViewportSize({ width: w, height: 1000 });
    await p.waitForTimeout(150);
    const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    out.overflow.push([w, o]);
  }

  out.paginafouten = errs;
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
