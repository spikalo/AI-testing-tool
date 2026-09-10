/* Eenmalige migratie: runs.csv krijgt de zeven kolommen van stap 6 erbij.
   De 118 bestaande regels blijven staan en krijgen lege cellen — dat is geen nul
   maar "niet gemeten", en dat verschil hoort zichtbaar te blijven. De kolomnamen
   worden uit de pagina zelf gelezen, zodat het bestand en de code niet uit de pas
   kunnen lopen. Draaien mag vaker: is het bestand al gemigreerd, dan gebeurt er
   niets. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.resolve('brein-test.html'));
  await p.waitForFunction(() => window.__brain && window.__brain.S.B);
  const cols = await p.evaluate(() => window.__brain.CSV_COLS);
  await b.close();

  const pad = path.resolve('experimenten/runs.csv');
  const regels = fs.readFileSync(pad, 'utf8').trim().split(/\r?\n/);
  const nieuw = cols.join(',');
  if (regels[0] === nieuw) { console.log('runs.csv is al gemigreerd; niets gedaan.'); return; }
  const oud = regels[0].split(',');
  if (cols.slice(0, oud.length).join(',') !== regels[0])
    throw new Error('de bestaande kolommen zijn geen voorvoegsel van de nieuwe — niet automatisch te migreren');
  const bij = ','.repeat(cols.length - oud.length);
  const uit = [nieuw].concat(regels.slice(1).map(r => r + bij));
  fs.copyFileSync(pad, pad + '.voor-stap6');
  fs.writeFileSync(pad, uit.join('\n') + '\n');
  console.log(`runs.csv gemigreerd: ${oud.length} -> ${cols.length} kolommen, ${uit.length - 1} regels behouden.`);
  console.log(`nieuw: ${cols.slice(oud.length).join(', ')}`);
  console.log(`kopie van het oude bestand: ${path.basename(pad)}.voor-stap6`);
})();
