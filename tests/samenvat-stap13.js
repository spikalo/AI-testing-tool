/* Leest experimenten/omslag.json en drukt de getallen af die in de documentatie en in
   de paper terechtkomen. Geen analyse, alleen aflezen — zodat een getal in een tekst
   nooit met de hand is overgetypt. */
const fs = require('fs'), path = require('path');
const O = JSON.parse(fs.readFileSync(path.resolve('experimenten/omslag.json'), 'utf8'));
const T = O.tabel;
const g = (n, m, d = 1) => { const x = T['s13-' + n] && T['s13-' + n][m]; return x ? x.m.toFixed(d) : '-'; };
const namen = Object.keys(O.condities);
console.log('conditie        plateau  dipNaB  dipNaTerug  hor1  hor2  hor3  benchEind  tijd(s)');
for (const n of namen) console.log(n.padEnd(16) +
  g(n, 'plateau', 3).padEnd(9) + g(n, 'dipNaB', 3).padEnd(8) + g(n, 'dipNaTerug', 3).padEnd(12) +
  g(n, 'horizon1').padEnd(6) + g(n, 'horizon2').padEnd(6) + g(n, 'horizon3').padEnd(6) +
  (100 * (T['s13-' + n].benchEind.m)).toFixed(1).padEnd(11) +
  (T['s13-' + n].tijdMs.m / 1000).toFixed(0));
console.log('\nhersteltijd per zaad');
for (const n of namen) console.log(n.padEnd(16) + O.perZaad['s13-' + n].map(r => r.hersteltijd).join(' '));
console.log('\nchurn (gebeurtenissen per poging)');
for (const c of O.churnToetsen) console.log(`${c.conditie.padEnd(16)} omslag ${c.omslag}  ` +
  `${c.voor.m.toFixed(2)} -> ${c.na.m.toFixed(2)}  (${c.tekentoets.positief}/${c.tekentoets.n} omhoog, ` +
  `p = ${c.tekentoets.p.toFixed(4)})`);
console.log('\nvoorspellingen');
for (const v of O.voorspellingen) console.log(`${v.id}: ${v.wat}`);
