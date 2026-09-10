/* Herstel van de maat "pogingen tot 80 %" in alle bestaande metingen.

   De fout. `rekenkosten()` liep de historie af en nam de eerste poging waarvan het
   succes over de laatste twintig pogingen boven 0,8 lag. Maar aan het begin van een
   run zijn er nog geen twintig pogingen, en dan is dat gemiddelde er een over één of
   twee. Een run waarvan de állereerste poging toevallig slaagde, kreeg daardoor
   "80 % gehaald na 1 poging" — wat geen leren meet maar geluk.

   Het is geen zeldzaam geval: 35 van de 256 runs met deze kolom staan op minder dan
   twintig pogingen, en ze zijn niet gelijk verdeeld over de condities. Bij
   `s7-schaars` gebeurde het in negen van de twaalf runs. Dat is precies de conditie
   waar de hoofdbevinding van stap 7 op rust — "een factor 4,9 zuiniger met ervaring"
   — dus die bevinding moet opnieuw uit de data komen in plaats van blijven staan.

   Het herstel. De drempel telt pas als er werkelijk twintig pogingen achter het
   gemiddelde zitten. Deze migratie rekent dat voor elke bestaande run opnieuw uit de
   bewaarde historie — per poging staan het aantal stappen en het lopende succes er
   allebei in — en schrijft de drie kolommen in `runs.csv` en het veld `rekenkosten`
   in het run-JSON bij. Er wordt niets opnieuw getraind: de historie is de meting.

   Runs waarvan geen JSON meer bestaat blijven staan zoals ze zijn; die worden
   geteld en gemeld, want een half gemigreerde tabel is erger dan een hele oude.   */
const fs = require('fs'), path = require('path');

const VENSTER = 20;                    // hetzelfde venster als succes20 zelf
const OUT = path.resolve('experimenten');
const CSV = path.join(OUT, 'runs.csv');
const DROOG = process.argv.includes('--droog');

const L = fs.readFileSync(CSV, 'utf8').trim().split(/\r?\n/);
const H = L[0].split(',');
const idx = k => { const i = H.indexOf(k); if (i < 0) throw new Error('kolom ontbreekt: ' + k); return i; };
const iCond = idx('conditie'), iZaad = idx('breinZaad'), iLr = idx('lr'), iPog = idx('pogingen');
const iKb = idx('kbLeerStap'), iP80 = idx('pogingenTot80'), iS80 = idx('stappenTot80'), iK80 = idx('kbTot80');

/* Dezelfde regel als in brein-test.html, hier één keer opgeschreven zodat de
   migratie en de pagina niet uit elkaar kunnen lopen. */
function tot80(historie) {
  let cum = 0;
  for (let i = 0; i < historie.length; i++) {
    cum += historie[i].stappen;
    if (i + 1 >= VENSTER && historie[i].succes20 >= 0.8) return { pogingen: i + 1, stappen: cum };
  }
  return { pogingen: null, stappen: null };
}

const getal = s => (s === '' || s === undefined) ? null : (isNaN(+s) ? s : +s);
const cel = v => v === null || v === undefined ? ''
  : Number.isInteger(v) ? String(v) : (+v).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');

let gewijzigd = 0, gelijk = 0, geenJson = 0, mismatch = 0, nuLeeg = 0;
const perConditie = {};
const nieuw = [L[0]];

for (let r = 1; r < L.length; r++) {
  const c = L[r].split(',');
  const cond = c[iCond], zaad = getal(c[iZaad]);
  /* Ook regels waarvan deze kolommen leeg zijn worden meegenomen: de runs van stap 4
     en 5 zijn van vóór de rekenkostenkolommen, maar hun historie is wél bewaard. Zij
     zijn de referentie van de ablatiereeks, en zonder deze maat heeft die tabel geen
     vergelijkingspunt op monsterefficiëntie. */
  const jp = path.join(OUT, 'runs', `${cond}_z${zaad}.json`);
  if (!fs.existsSync(jp)) { geenJson++; nieuw.push(L[r]); continue; }
  let j;
  try { j = JSON.parse(fs.readFileSync(jp, 'utf8')); }
  catch (e) { geenJson++; nieuw.push(L[r]); continue; }

  /* Het JSON-bestand heet naar conditie en zaad, dus een latere run met dezelfde
     naam heeft het overschreven. Alleen migreren als het bestand aantoonbaar bij
     déze regel hoort: zelfde leersnelheid en zelfde aantal pogingen. */
  const jlr = j.config && j.config.leren ? j.config.leren.leersnelheid : null;
  const jpog = j.resultaat ? j.resultaat.pogingen : null;
  if (jlr === null || Math.abs(jlr - getal(c[iLr])) > 1e-12 || jpog !== getal(c[iPog])) {
    mismatch++; nieuw.push(L[r]); continue;
  }
  if (!Array.isArray(j.historie) || !j.historie.length) { geenJson++; nieuw.push(L[r]); continue; }

  const n = tot80(j.historie);
  const kbLeer = getal(c[iKb]);
  const kb = (n.stappen !== null && kbLeer !== null) ? Math.round(n.stappen * kbLeer) : null;
  const oud = getal(c[iP80]);
  if (oud === n.pogingen) gelijk++;
  else {
    gewijzigd++;
    if (n.pogingen === null) nuLeeg++;
    perConditie[cond] = perConditie[cond] || { runs: 0, van: [], naar: [] };
    perConditie[cond].runs++;
    perConditie[cond].van.push(oud);
    perConditie[cond].naar.push(n.pogingen);
  }
  c[iP80] = cel(n.pogingen); c[iS80] = cel(n.stappen); c[iK80] = cel(kb);
  nieuw.push(c.join(','));

  if (!DROOG && j.resultaat && j.resultaat.rekenkosten) {
    j.resultaat.rekenkosten.pogingenTot80 = n.pogingen;
    j.resultaat.rekenkosten.omgevingsstappenTot80 = n.stappen;
    j.resultaat.rekenkosten.kantenBezoekenTot80 = kb;
    fs.writeFileSync(jp, JSON.stringify(j, null, 2));
  }
}

if (!DROOG) {
  fs.copyFileSync(CSV, CSV + '.voor-tot80');
  fs.writeFileSync(CSV, nieuw.join('\n') + '\n');
}
console.log(`${DROOG ? '[droogloop] ' : ''}${gewijzigd} regels gewijzigd, ${gelijk} ongewijzigd, ` +
  `${nuLeeg} daarvan halen de drempel nu nooit; ${geenJson} zonder bruikbaar JSON, ${mismatch} niet-passend JSON.`);
for (const k in perConditie) {
  const p = perConditie[k];
  console.log(`  ${k.padEnd(22)} ${p.runs} runs: ` +
    p.van.map((v, i) => `${v === null ? 'nooit' : v} -> ${p.naar[i] === null ? 'nooit' : p.naar[i]}`).join(', '));
}
if (!DROOG) console.log('\nde oude tabel staat in experimenten/runs.csv.voor-tot80');
