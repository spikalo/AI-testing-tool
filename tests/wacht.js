/* Hulpje om op een lopende reeks te wachten zonder er elke tien seconden naar te
   hoeven kijken. Blokkeert tot het bestand het gevraagde aantal regels/runs heeft of
   tot de tijd op is, en drukt dan één regel af.
   node tests/wacht.js <pad.json|pad.csv> <aantal> [maxSeconden] */
const fs = require('fs');
const [pad, doelS, maxS] = process.argv.slice(2);
const doel = +doelS, max = +(maxS || 170);
const tel = () => {
  try {
    const tx = fs.readFileSync(pad, 'utf8');
    if (pad.endsWith('.json')) { const j = JSON.parse(tx); return (j.runs || []).length; }
    return tx.trim().split(/\r?\n/).length - 1;
  } catch (e) { return -1; }
};
const t0 = Date.now();
(function poll() {
  const n = tel();
  if (n >= doel || (Date.now() - t0) / 1000 > max) {
    console.log(`${n} / ${doel} na ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    return;
  }
  setTimeout(poll, 5000);
})();
