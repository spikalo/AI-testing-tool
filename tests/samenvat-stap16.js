/* Leest experimenten/signaalsturing.json en zet de getallen klaar die in het verslag
   en in de paper terechtkomen — met interval, zodat er nergens een kaal gemiddelde in
   een zin belandt.
   Draaien: tests\draai.cmd samenvat-stap16.js s16-samenvatting.txt                   */
const fs = require('fs'), path = require('path');
const J = JSON.parse(fs.readFileSync(path.resolve('experimenten', 'signaalsturing.json'), 'utf8'));
const N = ['ang-klok', 'ang-signaal', 'ang-budget', 'ang-vast'];
const T = n => J.tabel['s16-' + n];
const pm = (o, s = 1) => o ? `${(s * o.m).toFixed(1)} ± ${(s * o.ci).toFixed(1)}` : '–';

console.log('--- kerntabel (12 zaden per conditie) ---');
console.log('conditie'.padEnd(14) + 'A1 eind'.padEnd(16) + 'A2 eind'.padEnd(16) +
  'hersteltijd'.padEnd(16) + 'behoud pp'.padEnd(16) + 'ronden'.padEnd(16) + 'ronden na omslag 2');
for (const n of N) if (T(n)) console.log(n.padEnd(14) +
  pm(T(n).aEind1, 100).padEnd(16) + pm(T(n).aEind3, 100).padEnd(16) +
  pm(T(n).hersteltijd).padEnd(16) + pm(T(n).behoud, 100).padEnd(16) +
  pm(T(n).ronden).padEnd(16) + pm(T(n).rondenNa2));

console.log('\n--- de budgetkoppeling per zaad ---');
const B = J.budgetPerZaad;
const afw = Object.values(B).map(b => b.rondenGehaald - b.rondenSignaal);
console.log('zaad  signaal  klokperiode  gehaald');
for (const z in B) console.log(`${z}  ${String(B[z].rondenSignaal).padStart(7)}  ` +
  `${String(B[z].structEvery).padStart(11)}  ${String(B[z].rondenGehaald).padStart(7)}`);
console.log(`grootste afwijking: ${Math.max(...afw.map(Math.abs))} ronden`);

console.log('\n--- V1, per omslag ---');
for (const t of J.poortToetsen) {
  if (t.soort === 'gezondheid') { console.log('gezondheid: ' + (t.alles ? 'in orde' : 'NIET IN ORDE')); continue; }
  console.log(`poging ${t.omslag} (${t.naarWat}): vuurkans ${(100 * t.vuurBuiten.m).toFixed(1)}% -> ` +
    `${(100 * t.vuurNa.m).toFixed(1)}% (± ${(100 * t.vuurNa.ci).toFixed(1)}), ` +
    `d ${t.dBuiten.m.toFixed(2)} -> ${t.dNa.m.toFixed(2)}, ` +
    `${t.tekentoets.positief}/${t.tekentoets.n} omhoog, p = ${t.tekentoets.p.toFixed(4)}, ` +
    `${t.nietGevuurd} van de ${t.tekentoets.n} levens vuurden binnen het venster niet — ${t.oordeel}`);
}

console.log('\n--- alle toetsen met ruwe p en Holm ---');
for (const t of J.toetsen) console.log(
  `${t.familie.padEnd(9)} ${t.maat.padEnd(12)} ${(t.conditie + ' vs ' + t.tegen).padEnd(30)} ` +
  `verschil ${(t.maat === 'hersteltijd' ? t.verschil.toFixed(1) + ' pogingen' : (100 * t.verschil).toFixed(1) + ' pp').padEnd(14)} ` +
  `p = ${t.p.toFixed(4)}  Holm ${t.pHolm.toFixed(4)}  ${t.oordeelHolm}`);

console.log('\n--- V4 ---');
console.log(JSON.stringify(J.V4, null, 1));

console.log('\n--- hersteltijd per zaad, voor het geval het interval iets verbergt ---');
for (const n of N) console.log(n.padEnd(14) +
  (J.perZaad['s16-' + n] || []).map(r => r.hersteltijd === null ? 'cens' : r.hersteltijd).join(' '));
