/* De geheugenhorizon opnieuw afleiden uit de bewaarde krommen.

   De eerste versie zette de proef af tegen het gemiddelde van de héle controle. Dat
   is niet eerlijk: een traject heeft fases — vlak na de blindering staat het doel
   gemiddeld anders ten opzichte van de agent dan zeventig stappen later — en dat
   verschil zat in de maat. De herziene versie vergelijkt per vertraging: proef en
   controle staan op datzelfde moment in dezelfde wereld met dezelfde toevalsreeks, en
   verschillen alleen in of de agent het doel ooit gezien heeft.

   Omdat de kromme per vertraging in elk run-JSON bewaard is, hoeft er niets opnieuw
   getraind te worden — precies waarom die kromme wordt bewaard en niet alleen het
   afgeleide getal. Zie de les van stap 8, fout 13.                                  */
const fs = require('fs'), path = require('path');

const MARGE = 0.05;
const OUT = path.resolve('experimenten');
const CSV = path.join(OUT, 'runs.csv');
const DROOG = process.argv.includes('--droog');

function horizonUit(proef, controle) {
  let horizon = 0, som = 0, n = 0;
  for (let i = 0; i < proef.length; i++) {
    if (proef[i] === null || controle[i] === null || controle[i] === undefined) break;
    som += proef[i] - controle[i]; n++;
    if (som / n > MARGE) horizon = i + 1; else break;
  }
  return horizon;
}

const L = fs.readFileSync(CSV, 'utf8').trim().split(/\r?\n/);
const H = L[0].split(',');
const iC = H.indexOf('conditie'), iZ = H.indexOf('breinZaad'), iH = H.indexOf('memHorizon');
if (iH < 0) throw new Error('kolom memHorizon ontbreekt');

let gewijzigd = 0, gelijk = 0, geen = 0;
const nieuw = [L[0]];
for (let r = 1; r < L.length; r++) {
  const c = L[r].split(',');
  if (c[iH] === '') { nieuw.push(L[r]); continue; }
  const jp = path.join(OUT, 'runs', `${c[iC]}_z${c[iZ]}.json`);
  if (!fs.existsSync(jp)) { geen++; nieuw.push(L[r]); continue; }
  const j = JSON.parse(fs.readFileSync(jp, 'utf8'));
  const g = j.geheugen;
  if (!g || !g.perStapProef) { geen++; nieuw.push(L[r]); continue; }
  const nh = horizonUit(g.perStapProef, g.perStapControle);
  if (String(nh) === c[iH]) gelijk++; else gewijzigd++;
  c[iH] = String(nh);
  nieuw.push(c.join(','));
  if (!DROOG) {
    g.horizon = nh;
    g.voorsprong = (g.cosProef !== null && g.cosControle !== null) ? g.cosProef - g.cosControle : null;
    fs.writeFileSync(jp, JSON.stringify(j, null, 2));
  }
}
if (!DROOG) fs.writeFileSync(CSV, nieuw.join('\n') + '\n');
console.log(`${DROOG ? '[droogloop] ' : ''}${gewijzigd} horizonwaarden herzien, ${gelijk} ongewijzigd, ${geen} zonder bewaarde kromme.`);
