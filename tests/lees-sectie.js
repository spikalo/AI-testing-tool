/* Leest de platte tekst van het gegenereerde paper en drukt het stuk af tussen twee
   zoektermen. Bedoeld om na het genereren met eigen ogen te controleren of een
   datagestuurde sectie ook echt Nederlands oplevert.
   node tests/lees-sectie.js "10.6" "10.7" */
const fs = require('fs'), zlib = require('zlib');
const [van, tot] = process.argv.slice(2);
const buf = fs.readFileSync('ANG-paper.docx');
/* minimale zip-lezer: zoek de entry document.xml op via de central directory */
let xml = null;
for (let i = 0; i < buf.length - 4; i++) {
  if (buf.readUInt32LE(i) !== 0x04034b50) continue;
  const nlen = buf.readUInt16LE(i + 26), elen = buf.readUInt16LE(i + 28);
  const naam = buf.slice(i + 30, i + 30 + nlen).toString();
  if (naam !== 'word/document.xml') continue;
  const start = i + 30 + nlen + elen;
  const comp = buf.readUInt16LE(i + 8), csize = buf.readUInt32LE(i + 18);
  const brok = csize ? buf.slice(start, start + csize) : buf.slice(start);
  xml = comp === 0 ? brok.toString('utf8') : zlib.inflateRawSync(brok).toString('utf8');
  break;
}
if (!xml) throw new Error('word/document.xml niet gevonden');
const tekst = xml
  .replace(/<w:p[ >]/g, '\n<w:p ')
  .replace(/<[^>]+>/g, '')
  .replace(/&#8217;/g, '’').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .split('\n');
let aan = false;
for (const r of tekst) {
  if (!aan && van && r.includes(van)) aan = true;
  if (aan && tot && r.includes(tot) && !r.includes(van)) break;
  if (aan && r.trim()) console.log(r.trim());
}
