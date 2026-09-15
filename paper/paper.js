const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, TabStopType,
  TabStopPosition, Tab, Footer, PageNumber, convertMillimetersToTwip, LevelFormat,
  PageBreak, ExternalHyperlink, LineRuleType
} = require('docx');
const fs = require('fs');
const path = require('path');

/* Alle paden liggen ten opzichte van de projectmap, niet ten opzichte van de
   omgeving waarin dit toevallig een keer gedraaid heeft. */
const ROOT = path.resolve(__dirname, '..');
const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'paper/eq/manifest.json'), 'utf8'));

/* ======================= gemeten data =======================
   De resultatensectie wordt niet met de hand geschreven maar uit
   experimenten/runs.csv opgebouwd. Zo kan een tabel in dit document nooit
   uit de pas lopen met wat er werkelijk gemeten is. Ontbreekt het bestand,
   dan valt de sectie terug op "volgt nog". */
const EXPDIR = path.join(ROOT, 'experimenten');
function leesCsv(pad) {
  if (!fs.existsSync(pad)) return null;
  const lines = fs.readFileSync(pad, 'utf8').trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const cols = lines[0].split(',');
  return lines.slice(1).map(l => {
    const cells = l.match(/("([^"]|"")*"|[^,]*)/g).filter((_, i) => i % 2 === 0).slice(0, cols.length);
    const o = {};
    cols.forEach((c, i) => {
      let v = (cells[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"');
      o[c] = (v !== '' && !isNaN(+v)) ? +v : v;
    });
    return o;
  });
}
const RUNS = leesCsv(path.join(EXPDIR, 'runs.csv'));
const lees = (p) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
const HERH = lees(path.join(EXPDIR, 'reproduceerbaarheid.json'));
const TRACE = lees(path.join(EXPDIR, 'trace-voor-na.json'));
const GRAD = lees(path.join(EXPDIR, 'gradcheck.json'));
const GRADD = lees(path.join(EXPDIR, 'gradcheck-delen.json'));
const PGAIN = lees(path.join(EXPDIR, 'perturbatie-schaal.json'));
const PGAINLR = lees(path.join(EXPDIR, 'perturbatie-schaal-lr.json'));
const BENCH = lees(path.join(EXPDIR, 'benchmark.json'));
const BENCHSET = lees(path.join(EXPDIR, 'benchmark-werelden.json'));
const BASIS = lees(path.join(EXPDIR, 'basislijnen.json'));
const REKEN = lees(path.join(EXPDIR, 'rekenkosten.json'));
const LEERREGEL = lees(path.join(EXPDIR, 'leerregel.json'));
const ABLATIE = lees(path.join(EXPDIR, 'ablatie.json'));
const TAAKAS = lees(path.join(EXPDIR, 'taakas.json'));
const OMSLAG = lees(path.join(EXPDIR, 'omslag.json'));
const SGEDRAG = lees(path.join(EXPDIR, 'structuurgedrag.json'));
function stat(xs) {
  const v = xs.filter(x => typeof x === 'number' && isFinite(x));
  const n = v.length; if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { n, m, sd: 0, ci: 0, min: m, max: m };
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return { n, m, sd, ci: 1.96 * sd / Math.sqrt(n), min: Math.min(...v), max: Math.max(...v) };
}
const pct = x => x === null ? '–' : (100 * x.m).toFixed(1) + '% ± ' + (100 * x.ci).toFixed(1);
const pctSd = x => x === null ? '–' : (100 * x.sd).toFixed(1) + '%';
const num = (x, d = 0) => x === null ? '–' : x.m.toFixed(d) + ' ± ' + x.ci.toFixed(d);
const kol = k => RUNS ? RUNS.map(r => r[k]) : [];
/* een gemiddelde-met-interval uit benchmark.json in dezelfde vorm als stat() */
const bm = o => o ? { n: o.n, m: o.m, sd: o.sd, ci: o.ci, min: o.m, max: o.m } : null;
const VERSIE = SGEDRAG ? '2.0' : OMSLAG ? '1.9' : TAAKAS ? '1.8' : ABLATIE ? '1.7' : LEERREGEL ? '1.6' : '1.5';
/* De twee laatste secties schuiven mee met wat er gemeten is, zodat een verwijzing in
   de tekst nooit naar een verkeerd nummer wijst. */
const SEC_OMSLAG = '10.9', SEC_SG = OMSLAG ? '10.10' : '10.9';
const SEC_HIERNA = SGEDRAG ? (OMSLAG ? '10.11' : '10.10') : OMSLAG ? '10.10' : TAAKAS ? '10.9' : ABLATIE ? '10.8' : '10.7';
const SEC_VRAAG = SGEDRAG ? (OMSLAG ? '10.12' : '10.11') : OMSLAG ? '10.11' : TAAKAS ? '10.10' : ABLATIE ? '10.9' : '10.8';
const DATUM = '15 september 2026';
const SERIF = 'Cambria';
const TEXTW_PT = 448;              // bruikbare tekstbreedte in punten
const INK = '1A1D21', DIM = '55606B', ACC = '1F5C73';

/* ---------- bouwstenen ---------- */
const t = (text, o = {}) => new TextRun({ text, font: SERIF, size: 21, color: INK, ...o });
const it = (text) => t(text, { italics: true });
const bd = (text) => t(text, { bold: true });
const mono = (text) => new TextRun({ text, font: 'Consolas', size: 19, color: INK });

const body = (children, o = {}) => new Paragraph({
  children: Array.isArray(children) ? children : [t(children)],
  alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 120, line: 264, lineRule: LineRuleType.AUTO },
  ...o
});

const h1 = (n, text) => new Paragraph({
  children: [new TextRun({ text: n ? `${n}  ${text}` : text, font: SERIF, size: 28, bold: true, color: ACC })],
  spacing: { before: 340, after: 140 }, keepNext: true, heading: HeadingLevel.HEADING_1
});
const h2 = (n, text) => new Paragraph({
  children: [new TextRun({ text: `${n}  ${text}`, font: SERIF, size: 23, bold: true, color: INK })],
  spacing: { before: 240, after: 100 }, keepNext: true, heading: HeadingLevel.HEADING_2
});
const h3 = (text) => new Paragraph({
  children: [new TextRun({ text, font: SERIF, size: 21, bold: true, italics: true, color: INK })],
  spacing: { before: 160, after: 70 }, keepNext: true
});

/* vergelijking: gecentreerde afbeelding met nummer rechts */
function eq(num, scale = 1) {
  const m = MAN[String(num)];
  if (!m) throw new Error('geen vergelijking ' + num);
  let w = (m.w / 320) * 72 * 0.86 * scale;
  let h = (m.h / 320) * 72 * 0.86 * scale;
  const maxW = TEXTW_PT - 78;
  if (w > maxW) { h = h * maxW / w; w = maxW; }
  return new Paragraph({
    spacing: { before: 190, after: 190, line: 240, lineRule: LineRuleType.AUTO },
    tabStops: [
      { type: TabStopType.CENTER, position: Math.round(TEXTW_PT * 20 / 2) },
      { type: TabStopType.RIGHT, position: TabStopPosition.MAX }
    ],
    children: [
      new TextRun({ children: [new Tab()] }),
      new ImageRun({ type: 'png', data: fs.readFileSync(m.path), transformation: { width: w, height: h } }),
      new TextRun({ children: [new Tab()] }),
      t(`(${num})`)
    ]
  });
}

/* De afmetingen van een figuur, zodat de verhouding klopt. Welk commando python
   heet verschilt per machine — op Windows is het meestal `py`, elders `python3` —
   dus we proberen ze op volgorde in plaats van er één te veronderstellen. */
let PY = null;
function pythonCmd() {
  if (PY) return PY;
  const { execSync } = require('child_process');
  for (const c of ['python3', 'py', 'python']) {
    try { execSync(`${c} -c "import PIL"`, { stdio: 'ignore' }); return (PY = c); } catch (e) { }
  }
  throw new Error('geen python met Pillow gevonden; probeer: py -m pip install pillow');
}
function figure(path, capNum, capText, widthPt = 470) {
  const { execSync } = require('child_process');
  /* backslashes uit een Windows-pad zijn in een Python-string een ontsnapping */
  const pyPad = path.replace(/\\/g, '/');
  const dims = execSync(`${pythonCmd()} -c "from PIL import Image;im=Image.open('${pyPad}');print(im.width,im.height)"`)
    .toString().trim().split(' ').map(Number);
  const h = widthPt * dims[1] / dims[0];
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 240, after: 90, line: 240, lineRule: LineRuleType.AUTO }, keepNext: true,
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(path), transformation: { width: widthPt, height: h } })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 220 },
      children: [
        new TextRun({ text: `Figuur ${capNum} — `, font: SERIF, size: 18, bold: true, color: DIM }),
        new TextRun({ text: capText, font: SERIF, size: 18, color: DIM })
      ]
    })
  ];
}

function bullet(text, level = 0) {
  const kids = Array.isArray(text) ? text : [t(text)];
  return new Paragraph({
    children: kids, alignment: AlignmentType.JUSTIFIED,
    numbering: { reference: 'bul', level },
    spacing: { after: 70, line: 264, lineRule: LineRuleType.AUTO }
  });
}

function tbl(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (txt, w, head) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: 'EDF1F3' } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({
      spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
      children: [new TextRun({ text: String(txt), font: SERIF, size: 18, bold: !!head, color: INK })]
    })]
  });
  const mk = (arr, head) => new TableRow({
    tableHeader: !!head,
    children: arr.map((c, i) => cell(c, widths[i], head))
  });
  return new Table({
    columnWidths: widths,
    width: { size: total, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'B9C2C8' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B9C2C8' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'DDE3E7' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    },
    rows: [mk(headers, true), ...rows.map(r => mk(r, false))]
  });
}
const gap = (n = 120) => new Paragraph({ spacing: { after: n }, children: [] });

/* codeblok / pseudocode */
function code(lines, title) {
  const out = [];
  if (title) out.push(new Paragraph({
    spacing: { before: 180, after: 60 }, keepNext: true,
    children: [new TextRun({ text: title, font: SERIF, size: 19, bold: true, color: INK })]
  }));
  lines.forEach((ln, i) => out.push(new Paragraph({
    spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
    indent: { left: 240 },
    border: i === 0 ? { top: { style: BorderStyle.SINGLE, size: 4, color: 'C8D0D6', space: 6 } } : undefined,
    children: [new TextRun({ text: ln || ' ', font: 'Consolas', size: 17, color: INK })]
  })));
  out.push(new Paragraph({
    spacing: { after: 180 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'C8D0D6', space: 6 } },
    children: []
  }));
  return out;
}

/* ======================= inhoud ======================= */
const C = [];

/* --- kop --- */
C.push(new Paragraph({
  spacing: { after: 60 },
  children: [new TextRun({ text: 'Adaptive Neural Graph (ANG)', font: SERIF, size: 44, bold: true, color: INK })]
}));
C.push(new Paragraph({
  spacing: { after: 240 },
  children: [new TextRun({
    /* De ondertitel is met versie 1.8 veranderd. "Zonder lagen en zonder
       backpropagation" beschrijft wat het model níét doet en belooft daarmee een
       vergelijking die het niet wint — sectie 10.5 laat zien wat lokaal leren kost.
       Wat dit document werkelijk levert is een grens: tot waar is structurele
       plasticiteit opgerekt, en waar houdt het op. */
    text: OMSLAG
      ? 'Wanneer betaalt structurele plasticiteit zich terug? Een gecontroleerde grens, '
        + 'een functionele geheugenmaat en een aanwijsbare oorzaak'
      : TAAKAS
        ? 'Wanneer betaalt structurele plasticiteit zich terug? Een gecontroleerde grens '
          + 'en een functionele geheugenmaat'
        : 'Een zelfstructurerend neuraal netwerk zonder lagen en zonder backpropagation',
    font: SERIF, size: 26, color: ACC
  })]
}));
C.push(new Paragraph({
  spacing: { after: 30 },
  border: { top: { style: BorderStyle.SINGLE, size: 6, color: ACC, space: 8 } },
  children: [t('Frank Jacobs', { bold: true })]
}));
C.push(new Paragraph({
  spacing: { after: 150 },
  children: [new TextRun({
    text: 'Correspondentie: frljacobs@gmail.com',
    font: SERIF, size: 18, color: DIM
  })]
}));
C.push(new Paragraph({
  spacing: { after: 60 },
  children: [new TextRun({
    text: `Preprint, versie ${VERSIE} · ${DATUM} · niet peer-reviewed`,
    font: SERIF, size: 18, color: DIM
  })]
}));
C.push(new Paragraph({
  spacing: { after: 240 },
  children: [new TextRun({
    text: 'Bij dit onderzoek is een generatief AI-hulpmiddel gebruikt, en wel in aanzienlijke mate. ' +
      'Wat het precies heeft gedaan staat in de verklaring achterin; die verklaring hoort bij het werk ' +
      'en niet in de kleine lettertjes.',
    font: SERIF, size: 18, italics: true, color: DIM
  })]
}));

/* --- samenvatting --- */
C.push(new Paragraph({
  spacing: { before: 100, after: 100 },
  children: [new TextRun({ text: 'Samenvatting', font: SERIF, size: 23, bold: true, color: INK })]
}));
C.push(new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 160, line: 264, lineRule: LineRuleType.AUTO },
  indent: { left: 340, right: 340 },
  children: [new TextRun({
    font: SERIF, size: 19, color: INK,
    text: 'Wij beschrijven de Adaptive Neural Graph (ANG): een neuraal rekenmodel waarin de topologie geen ' +
      'vaste lagen kent maar een gerichte graaf is die zichzelf tijdens het leren herstructureert. Elke knoop draagt ' +
      'een soort die bepaalt welke verbindingen zijn toegestaan — invoer, worker, reflex en geheugen — en die soort ' +
      'ligt niet vast: er kunnen neuronen bijgroeien, zij komen neutraal binnen, en zij krijgen een soort toegewezen ' +
      'op grond van de bedrading die zij feitelijk hebben ontwikkeld. Leren gebeurt zonder backpropagation. De ' +
      'uitvoerknopen vormen een Bernoulli-beleid waarvan de score-functie exact bekend is; voor de verborgen knopen ' +
      'wordt de gradiënt geschat met node-perturbatie, uit het verschil tussen een schone en een verstoorde ' +
      'doorrekening van dezelfde tijdstap. De afwijking van de beloning ten opzichte van een lopende basislijn ' +
      'moduleert een eligibility trace. Drie begrenzingen — een maximale stap per keer, een demping die toeneemt ' +
      'naarmate een gewicht zijn plafond nadert, en een vervaging per poging — zorgen dat verbindingen geleidelijk ' +
      'ontstaan, versterken en verdwijnen in plaats van abrupt. Dit document beschrijft het model, de leerregel, de ' +
      'structurele plasticiteit en de meetinstrumenten volledig, met een referentiemeting over zestien ' +
      'onafhankelijke breinzaden op een vaste benchmarkset van vijfhonderd werelden, en een numerieke controle ' +
      'van de leerregel zelf. Die controle laat zien dat de exacte score-functie voor de uitvoerknopen de ' +
      'gradiënt nauwkeurig volgt, dat de node-perturbatieschatter de goede richting aanwijst maar veel ruwer, ' +
      'en dat de twee delen van de update niet op dezelfde schaal staan. Een basislijnreeks met dezelfde ' +
      'leerregel op een vaste gelaagde topologie scoort binnen de meetruis gelijk aan de graaf: op deze taak ' +
      'is de prestatie toe te schrijven aan de leerregel en niet aan de structuur. Het enige structurele ' +
      'effect dat boven de ruis uitkomt is padlengte, die bij propagatiediepte één samenvalt met reactietijd. ' +
      'Een tweede reeks houdt de topologie vast en wisselt alleen de schatter: op drie vaste netten levert ' +
      'terugpropagatie meer dan twintig procentpunt op ten opzichte van node-perturbatie, en zij bereikt de ' +
      'score van de graaf met ongeveer een tiende van de parameters en enkele procenten van het rekenwerk. ' +
      'De rekenkosten worden daarbij in vier gescheiden grootheden gerapporteerd, omdat sample-efficiëntie, ' +
      'rekenefficiëntie, wandkloktijd en inferentiekosten zelden samenvallen. ' +
      (ABLATIE ? 'Een ablatiereeks van tien condities, elk met een controle per run dat het weggelaten ' +
        'mechanisme werkelijk uit stond en met een Holm-correctie over de familie vergelijkingen, wijst ' +
        'geen enkel afzonderlijk structureel mechanisme aan dat op deze taak aantoonbaar bijdraagt. ' : '') +
      (TAAKAS ? 'Omdat een taak waarin het doel altijd zichtbaar is per constructie niets te onthouden ' +
        'geeft, wordt de waarneembaarheid vervolgens als as gevarieerd: het doel is tien spelstappen te ' +
        'zien en daarna een instelbaar aantal stappen niet. Naast de prestatie staat een functionele ' +
        'geheugenmaat die niet aan de neuronsoorten van dit model hangt en op elke architectuur te meten ' +
        'is: dezelfde getrainde agent speelt dezelfde wereld twee keer, één keer met en één keer zonder ' +
        'dat hij het doel ooit gezien heeft, en de horizon is het aantal stappen dat de eerste de tweede ' +
        'blijft verslaan op koers. Wat die as oplevert staat in sectie 10.8 en het is geen bevestiging ' +
        'van de hypothese waarmee dit werk begon.' : 'De as van waarneembaarheid volgt in een latere versie.') +
      (OMSLAG ? ' Ten slotte wordt de laatste aanspraak gemeten die een vaste architectuur principieel niet ' +
        'kan waarmaken: één doorlopend leven waarin de omgeving twee keer omslaat zonder waarschuwing. De ' +
        'vrije graaf herstelt daarin niet sneller dan dezelfde graaf met bevroren structuur. Belangrijker ' +
        'dan dat negatieve resultaat is de oorzaak, want die is aanwijsbaar: de herstructurering piekt niet ' +
        'na een omslag maar loopt op een vaste klok' +
        (SGEDRAG ? ', en waar zij wél op een signaal reageert is dat de stagnatie van het eigen leren en ' +
          'niet een verandering in de omgeving' : '') + '. Een mechanisme dat de omslag niet waarneemt kan ' +
        'er niet op reageren, en daarmee gaat de negatieve bevinding niet over structurele plasticiteit als ' +
        'idee maar over deze aansturing ervan — een uitspraak die te repareren en opnieuw te toetsen valt.' : '')
  })]
}));
C.push(new Paragraph({
  spacing: { after: 260 },
  indent: { left: 340, right: 340 },
  children: [
    new TextRun({ text: 'Trefwoorden: ', font: SERIF, size: 18, bold: true, color: DIM }),
    new TextRun({
      text: 'zelfstructurerende netwerken · reward-gemoduleerde plasticiteit · node-perturbatie · ' +
        'beleidsgradiënt · structurele plasticiteit · interpreteerbaarheid' +
        (TAAKAS ? ' · deels waarneembare omgevingen · negatieve resultaten' : ''),
      font: SERIF, size: 18, color: DIM
    })
  ]
}));

/* ===== 1 ===== */
C.push(h1('1', 'Inleiding'));
C.push(h2('1.1', 'Waarom geen lagen'));
C.push(body(
  'Het gangbare neurale netwerk is een gestapelde functie: de invoer gaat door laag één, het resultaat door laag ' +
  'twee, enzovoort tot de uitvoer. Die vorm is geen eigenschap van zenuwstelsels maar een rekenkundige keuze. Zij ' +
  'maakt de voorwaartse berekening een reeks matrixvermenigvuldigingen en de gradiënt een nette toepassing van de ' +
  'kettingregel. Daar staan twee aannames tegenover die zelden expliciet worden gemaakt. Ten eerste kost elke ' +
  'berekening evenveel stappen: de weg van invoer naar uitvoer is voor elk signaal precies zo lang als het netwerk ' +
  'diep is. Ten tweede stroomt informatie maar één kant op.'
));
C.push(body(
  'Een biologisch zenuwstelsel doet geen van beide. Een reflexboog loopt in twee synapsen van zintuig naar spier, ' +
  'terwijl een afweging tientallen stappen door de cortex maakt; terugkoppeling is er eerder regel dan uitzondering. ' +
  'Dat verschil is niet alleen anatomisch interessant. Het bepaalt welke oplossingen een netwerk überhaupt kán ' +
  'vinden: in een gelaagd netwerk bestaat "sneller reageren dan nadenken" niet als optie.'
));
C.push(body([
  t('ANG laat de laagstructuur los. Wat overblijft is een gerichte graaf met getypeerde knopen, waarin de enige ' +
    'harde eis is dat elke invoer ergens naartoe gaat en elke uitvoer ergens vandaan komt. Alles daarbinnen — hoeveel ' +
    'verbindingen een neuron heeft, hoe lang het pad van zintuig naar knop is, of er lussen zijn, en zelfs '),
  it('welke soort'),
  t(' een neuron is — is uitkomst van het leerproces in plaats van invoer ervan.')
]));

C.push(h2('1.2', 'Wat wij willen kunnen aflezen'));
C.push(body(
  'De vraag achter dit werk is niet in de eerste plaats hoe goed het model presteert, maar welke structuur er ' +
  'ontstaat. Dat komt voort uit een praktisch probleem: van een te klein of slecht getraind netwerk wil je kunnen ' +
  'zien wáárom het faalt, niet alleen dát het faalt. Elk onderdeel van ANG is daarom zo gekozen dat het achteraf ' +
  'afleesbaar is. Hoeveel stappen heeft een signaal nodig van zintuig naar knop? Hoeveel terugkoppellussen zijn er ' +
  'gevormd? Welke van de zintuigen worden feitelijk genegeerd? Welke neuronen doen niet mee? Sectie 6 formaliseert ' +
  'die maten.'
));

C.push(h2('1.3', 'Bijdragen'));
C.push(bullet([bd('Een getypeerd grafenmodel'), t(' met formele toelaatbaarheidsregels per soort, waaronder een ' +
  'reflexsoort die de klassieke boog zintuig → sensorisch neuron → actuator afdwingt, en een geheugensoort met een ' +
  'verplichte zelfverbinding.')]));
C.push(bullet([bd('Een leerregel zonder backpropagation'), t(' die werkt in aanwezigheid van cykels en discrete, ' +
  'gelote acties: een exacte score-functie voor de uitvoerknopen, node-perturbatie voor de verborgen knopen, en een ' +
  'lopende basislijn die voorkomt dat een altijd-positieve beloning simpelweg alles versterkt.')]));
C.push(bullet([bd('Structurele plasticiteit inclusief soorttoewijzing'), t(', geformuleerd als een ' +
  'kostenminimalisatie over de toegestane soorten: een neuron krijgt de soort die het, gemeten aan zijn eigen ' +
  'bedrading, al feitelijk is.')]));
C.push(bullet([bd('Een verzameling structuurmaten'), t(' waarmee de gevormde topologie meetbaar wordt gemaakt: ' +
  'kortste pad, lussen via sterk samenhangende componenten, reflexbogen, deelnemende neuronen en sensorinvloed.')]));
C.push(bullet([bd('Een volledige implementatie'), t(' zonder externe afhankelijkheden, die het netwerk tijdens het ' +
  'leren live in beeld brengt en elke run met alle instellingen en de volledige eindstructuur wegschrijft.')]));

C.push(h2('1.4', 'Verwant werk'));
C.push(body('ANG ligt op het kruispunt van vijf onderzoeksrichtingen. Geen ervan dekt het model, maar samen ' +
  'bakenen zij het af.'));
C.push(h3('Willekeurig bedrade netwerken'));
C.push(body(
  'Xie et al. [14] lieten zien dat netwerken waarvan de bedrading door een grafengenerator wordt bepaald — ' +
  'Erdős–Rényi, Watts–Strogatz, Barabási–Albert — op ImageNet kunnen wedijveren met met de hand ontworpen ' +
  'architecturen; You et al. [15] onderzochten systematisch welke graafeigenschappen met prestatie samenhangen. ' +
  'In beide gevallen wordt de graaf één keer getrokken en daarna bevroren: er worden uitsluitend gewichten ' +
  'getraind. In ANG blijft de graaf veranderen zolang er geleerd wordt.'
));
C.push(h3('Neuro-evolutie'));
C.push(body(
  'NEAT [11] laat topologie ontstaan door selectie over een populatie, met mutaties die knopen en verbindingen ' +
  'toevoegen. ANG bereikt iets vergelijkbaars binnen één individu en tijdens zijn leven: er is geen populatie, ' +
  'geen generatie en geen selectie, alleen ervaring.'
));
C.push(h3('Reservoir computing'));
C.push(body(
  'Echo-state-netwerken en liquid state machines [7, 8] gebruiken een vaste, willekeurige recurrente graaf en ' +
  'trainen uitsluitend een uitleeslaag. ANG deelt de willekeurige recurrente graaf, maar traint alle verbindingen ' +
  'en laat de graaf zelf veranderen.'
));
C.push(h3('Leerregels zonder backpropagation'));
C.push(body(
  'De leerregel combineert de score-functieschatter van REINFORCE [13] voor de discrete acties met ' +
  'node-perturbatie [3, 10] voor de verborgen knopen, in een vorm met eligibility traces die aansluit bij ' +
  'reward-gemoduleerde plasticiteit [4, 6] en bij TD(λ) [12]. In de terminologie van die literatuur is het ' +
  'resultaat een reward-gemoduleerde Hebbiaanse regel; de afleiding in 3.3 en 3.4 laat zien dat diezelfde regel ' +
  'tegelijk een gradiëntschatter is. De dichtheidsbeloning in sectie 5 is potentiaal-gebaseerd in de zin van ' +
  'Ng, Harada en Russell [9], zodat zij het optimale beleid niet verandert.'
));
C.push(h3('Structurele plasticiteit'));
C.push(body(
  'In de neurowetenschap is het onderscheid tussen synaptische en structurele plasticiteit gangbaar: bij de ' +
  'eerste verandert het gewicht van een bestaande verbinding, bij de tweede ontstaat of verdwijnt de verbinding ' +
  'zelf [2, 5]. ANG doet beide, en dat is het scherpste verschil met gangbare deep learning. In neuromorfe ' +
  'systemen is die combinatie eerder gerealiseerd, met herbedrading naast een leerregel voor de overgebleven ' +
  'verbindingen [1].'
));
C.push(h3('En hoe verhoudt dit zich tot grafenneurale netwerken?'));
C.push(body([
  t('Een GNN rekent over een graaf die als '), it('data'), t(' gegeven is: knopen wisselen berichten uit met hun ' +
    'buren volgens een vaste structuur. In ANG is de graaf geen invoer maar '), it('toestand'),
  t(' — hij is onderdeel van wat er geleerd wordt, en hij is aan het einde van een training een andere dan aan het ' +
    'begin. Dat is geen gradueel maar een categorisch verschil, en het is de reden dat de meetinstrumenten in ' +
    'sectie 6 nodig zijn: bij een GNN weet je de structuur al, bij ANG moet je haar achteraf vaststellen.')
]));

/* ===== 2 ===== */
C.push(h1('2', 'Het model'));
C.push(h2('2.1', 'Graaf, knopen en soorten'));
C.push(body('Een ANG is een gerichte graaf met getypeerde knopen:'));
C.push(eq(1));
C.push(body([
  t('waarin '), it('I'), t(' de invoerknopen zijn (in de hier beschreven instantie zestien zintuigwaarden), '),
  it('O'), t(' de uitvoerknopen (vier knoppen) en '), it('H'), t(' de wolk ertussen. Elke knoop draagt een soort:')
]));
C.push(eq(2));
C.push(body(
  'De soorten in en out horen bij de vaste invoer- en uitvoerknopen. De vier soorten die de gebruiker kan ' +
  'inschakelen zijn sens (invoer-neuron), work (worker), refl (reflex of instinct) en mem (geheugen). De soort neut ' +
  '(neutraal) is een tijdelijke toestand van een pas gegroeid of losgeraakt neuron dat nog geen soort heeft ' +
  'gekregen; sectie 4.4 beschrijft hoe die toewijzing verloopt.'
));

C.push(h2('2.2', 'Toelaatbaarheid'));
C.push(body([
  t('Niet elke verbinding mag. Een relatie '), it('L'), t(' over soortenparen bepaalt welke bogen bestaan mogen:')
]));
C.push(eq(3));
C.push(body('De regels luiden, in volgorde van toepassing:'));
C.push(bullet('Naar een invoerknoop gaat nooit een verbinding toe; uit een uitvoerknoop komt nooit een verbinding vandaan.'));
C.push(bullet('Een invoer-neuron accepteert als ingang uitsluitend invoerknopen. Zijn uitgang is vrij.'));
C.push(bullet('Een reflex-neuron accepteert als ingang uitsluitend invoer-neuronen en heeft als uitgang uitsluitend uitvoerknopen. Er is voor deze soort geen andere mogelijkheid.'));
C.push(bullet('Een invoerknoop mag niet rechtstreeks aan een uitvoerknoop hangen: elk signaal passeert minstens één neuron.'));
C.push(bullet('Een zelfverbinding is uitsluitend toegestaan voor een geheugen-neuron, en is voor die soort verplicht.'));
C.push(bullet('Worker-, geheugen- en neutrale neuronen mogen voor het overige alles met alles.'));
C.push(body([
  t('De reflexregel is bewust de meest beperkende. Zij dwingt de klassieke reflexboog af: '),
  it('receptor → sensorisch neuron → interneuron → effector'),
  t('. Er is voor deze soort geen andere mogelijkheid, en dat maakt achteraf meetbaar of een brein zo\'n boog heeft ' +
    'gevormd of alles door de wolk laat lopen.')
]));
C.push(body([
  t('Daarbij hoort een waarschuwing die pas zichtbaar wordt als men de padlengtes daadwerkelijk meet. ' +
    'Standaard mag een worker-neuron '),
  it('wel'),
  t(' rechtstreeks aan een invoerknoop hangen. Het pad invoer → worker → knop is dan twee bogen, terwijl de ' +
    'reflexboog er drie telt — de reflex is dus niet de kortste maar juist de langere weg, en verliest daardoor ' +
    'systematisch de concurrentie om de motoraansturing. Wie wil dat de reflexboog werkelijk het kortste pad is, ' +
    'zet de optie aan die invoerknopen uitsluitend aan invoer-neuronen laat hangen; dan is elk pad drie bogen lang. ' +
    'Die keuze heeft een prijs: alle zestien zintuigen moeten dan door een handvol invoer-neuronen, en dat is een ' +
    'informatie-flessenhals die het leren aanzienlijk moeilijker maakt. Beide varianten zijn instelbaar, en het ' +
    'verschil ertussen is een van de metingen die sectie 10 voorstelt.')
]));
figure(path.join(ROOT, 'paper/fig1-typen.png'), 1,
  'De toegestane verbindingen tussen de knoopsoorten. Streepjeslijnen gelden zolang een neuron neutraal is. ' +
  'Er gaat nooit iets naar een invoerknoop toe, nooit iets uit een uitvoerknoop vandaan, en een invoerknoop hangt ' +
  'nooit rechtstreeks aan een knop.').forEach(x => C.push(x));

C.push(h2('2.3', 'Invarianten'));
C.push(body('Vijf eigenschappen gelden op elk moment, en worden na elke herstructurering hersteld:'));
C.push(bullet([bd('I1 '), t('elke invoerknoop heeft uitgraad ≥ 1;')]));
C.push(bullet([bd('I2 '), t('elke uitvoerknoop heeft ingraad ≥ 1;')]));
C.push(bullet([bd('I3 '), t('elke boog is toelaatbaar volgens L;')]));
C.push(bullet([bd('I4 '), t('elk geheugen-neuron heeft zijn zelfverbinding;')]));
C.push(bullet([bd('I5 '), t('de worker-neuronen vormen de meerderheid van de toegewezen neuronen, en elke soort ' +
  'blijft binnen de door de gebruiker opgegeven onder- en bovengrens (vergelijking 28).')]));
C.push(body(
  'I1 en I2 zijn de enige eis die aan de bedrading wordt gesteld; er is geen minimum of maximum aantal ' +
  'verbindingen per neuron. I5 is een ontwerpeis: de wolk moet in meerderheid uit neuronen bestaan die alles mogen, ' +
  'zodat de gespecialiseerde soorten uitzonderingen blijven en niet de structuur gaan dicteren.'
));

C.push(h2('2.4', 'Toestandsdynamiek'));
C.push(body([
  t('De toestand van het netwerk op tijdstip '), it('t'), t(' is de vector van activaties '), it('x'),
  t('. Eén spelstap bestaat uit '), it('P'), t(' propagatiestappen. Bij elke propagatiestap wordt eerst voor elke ' +
    'niet-invoerknoop de netto-invoer bepaald,')
]));
C.push(eq(4));
C.push(body('en vervolgens de nieuwe activatie:'));
C.push(eq(5));
C.push(body([
  t('met '), it('ξ'), t(' een uniforme exploratieruis. Geheugen-neuronen zijn lekkende integratoren, zodat zij ' +
    'hun waarde over de tijd vasthouden:')
]));
C.push(eq(6));
C.push(body([
  t('De actualisering is synchroon: alle knopen lezen de toestand van de vorige propagatiestap. Daardoor is een ' +
    'cyclus geen probleem — een zelfverbinding of een terugkoppeling door de wolk is gewoon een bijdrage aan de ' +
    'netto-invoer van de volgende stap. De parameter '), it('P'), t(' bepaalt hoe ver een signaal binnen één ' +
    'spelstap door de wolk reist. Bij '), it('P'), t(' = 1 kost elke boog een tijdstap, en is een korte reflexboog ' +
    'daadwerkelijk sneller dan een lange omweg; bij hogere '), it('P'), t(' vervaagt dat verschil.')
]));

C.push(h2('2.5', 'Actieselectie'));
C.push(body(
  'De vier uitvoerknopen zijn geen deterministische drempels maar kansen. Dat is geen esthetische keuze: het maakt ' +
  'het beleid differentieerbaar in zijn parameters en levert daarmee een exacte gradiënt (sectie 3.3).'
));
C.push(eq(7));
C.push(body([
  t('waarbij '), it('τ'), t(' een temperatuur is die de scherpte van de beslissing regelt. De vier geloten bits ' +
    'worden vertaald naar een verplaatsing; twee tegelijk levert een diagonaal, alle vier of geen enkele levert ' +
    'stilstand:')
]));
C.push(eq(8));
C.push(body([
  t('Bij evaluatie zonder leren vervalt de loting en geldt '), it('a'), t('ₖ = 1 dan en slechts dan als '),
  it('p'), t('ₖ > ½, wat onafhankelijk is van '), it('τ'), t('.')
]));

/* ===== 3 ===== */
C.push(h1('3', 'Leren zonder backpropagation'));
C.push(h2('3.1', 'Waarom backpropagation hier niet past'));
C.push(body('Drie eigenschappen van ANG sluiten de gebruikelijke aanpak uit.'));
C.push(bullet([bd('De graaf bevat cykels. '), t('Backpropagation vereist een acyclische rekengrafiek. Voor ' +
  'recurrente netwerken bestaat backpropagation-through-time, maar dat vraagt om het uitrollen van de volledige ' +
  'tijdreeks en om een topologie die tijdens die reeks niet verandert.')]));
C.push(bullet([bd('De topologie verandert tijdens het leren. '), t('Verbindingen verdwijnen, komen erbij, en ' +
  'neuronen veranderen van soort. Een vaste rekengrafiek waarop een gradiënt gedefinieerd kan worden, bestaat dus ' +
  'niet.')]));
C.push(bullet([bd('De acties zijn discreet en geloot. '), t('Er is geen doellabel om een fout tegen af te zetten, ' +
  'alleen een beloningssignaal, en de stap van kans naar knopdruk is niet differentieerbaar.')]));
C.push(body(
  'Wat wél kan, is een schatter van de gradiënt van de verwachte opbrengst opbouwen uit grootheden die lokaal aan ' +
  'elke verbinding beschikbaar zijn. Dat is de weg die hier gevolgd wordt.'
));

C.push(h2('3.2', 'Doelfunctie'));
C.push(body('Wij maximaliseren de verwachte som van beloningen over een poging:'));
C.push(eq(9));

C.push(h2('3.3', 'De uitvoerknopen: een exacte score-functie'));
C.push(body([
  t('Omdat de knoppen Bernoulli-variabelen zijn met kans '), it('p'), t('ₖ = σ('), it('u'), t('ₖ/'), it('τ'),
  t('), is de afgeleide van de log-waarschijnlijkheid van de gekozen actie naar de netto-invoer exact bekend:')
]));
C.push(eq(10));
C.push(body('en daarmee, via de kettingregel over één enkele stap, naar het gewicht van een inkomende verbinding:'));
C.push(eq(11));
C.push(body([
  t('Dit is de klassieke score-functieschatter [12]. De factor 1/'), it('τ'), t(' is een constante schaalfactor ' +
    'die in de leersnelheid wordt opgenomen. Het aantrekkelijke is dat de term ('), it('a'), t('ₖ − '), it('p'),
  t('ₖ) precies meet '), it('hoezeer de genomen actie afweek van wat het netwerk gemiddeld zou doen'),
  t(' — en alleen die afwijking is iets waaraan beloning toegeschreven mag worden.')
]));

C.push(h2('3.4', 'De wolk: node-perturbatie'));
C.push(body(
  'Voor de verborgen knopen bestaat zo\'n exacte uitdrukking niet. Wij gebruiken node-perturbatie [10, 3]. Elke ' +
  'spelstap wordt twee keer doorgerekend vanaf dezelfde begintoestand: één keer zonder ruis en één keer met ruis. ' +
  'Het verschil is per definitie de duw die de exploratie gaf:'
));
C.push(eq(12));
C.push(body([
  t('Omdat de ruis symmetrisch is, geldt E['), it('δ'), t('] = 0, en is het product van de activatie vóór de ' +
    'verbinding met de perturbatie erna, gewogen met de beloningsafwijking, een schatter van de gradiënt:')
]));
C.push(eq(13));
C.push(body([
  t('De evenredigheidsconstante is niet één getal voor het hele netwerk. Voor een knoop in de wolk komt zij uit de ' +
    'variantie van de perturbatie en de helling van de overdrachtsfunctie; voor een knop is zij de schaal van de ' +
    'exacte score-functie uit 3.3:')
]));
C.push(eq(37));
C.push(body([
  t('Dat onderscheid is niet cosmetisch. Var('), it('ξ'), t(') is bij de standaardinstellingen ongeveer 3,7·10⁻³, ' +
    'dus de twee delen van de update verschillen van nature ruwweg twee ordes in schaal. In de gebruikelijke ' +
    'formulering van node-perturbatie [10, 3] wordt daarvoor gecorrigeerd met een factor 1/Var('), it('ξ'),
  t('); ANG deed dat niet, en sectie 3.11 laat zien wat dat kost. De schatter is verder zuiver op een term van ' +
    'tweede orde in de ruissterkte na. Belangrijker voor de praktijk is dat hij volledig lokaal is: hij vraagt ' +
    'alleen de activatie aan de ene kant van een verbinding en de perturbatie aan de andere. Er is geen pad terug ' +
    'door het netwerk nodig, en dus ook geen acyclische structuur.')
]));

C.push(h2('3.5', 'Eligibility traces'));
C.push(body(
  'Een beloning valt zelden op hetzelfde moment als de actie die haar veroorzaakte. Elke verbinding houdt daarom ' +
  'een spoor bij van haar recente bijdrage:'
));
C.push(eq(14));
C.push(body([
  t('Welke activatie hier aan de presynaptische kant hoort, ligt minder voor de hand dan het lijkt. Een tik bestaat ' +
    'uit '), it('P'), t(' propagatiestappen (vgl. 4), en die worden synchroon uitgevoerd: eerst worden alle ' +
    'netto-invoeren uit de bestaande toestand berekend, pas daarna wordt geschreven. De uitvoer van knoop '),
  it('j'), t(' in deze tik is dus voortgebracht door de toestand aan het '), it('begin'),
  t(' van de laatste propagatiestap, niet door de toestand die erna in het netwerk staat. Dat is de grootheid '),
  it('x̃'), t('ᵢ in vergelijking 14, en om dezelfde reden ook in 11 en 13. Voor invoerknopen maakt het niets ' +
    'uit — die worden aan het begin van de tik op hun sensorwaarde gezet en veranderen daarna niet meer — maar ' +
    'voor elke verbinding die uit de wolk zelf vertrekt wél, en bij '), it('P'), t(' > 1 groeit het verschil.')
]));
C.push(body([
  t('De normalisatie met (1 − '), it('λ'), t(') is niet cosmetisch: zonder die factor groeit het spoor met 1/(1 − '),
  it('λ'), t('), waardoor een verandering van '), it('λ'), t(' ongemerkt ook de effectieve leersnelheid verandert. ' +
    'Met de factor erbij blijft de schaal van het spoor gelijk en regelt '), it('λ'), t(' uitsluitend hoe ver terug ' +
    'de beloning wordt uitgesmeerd. Voor de biasterm geldt dezelfde regel met de pre-activatie gelijk aan één.')
]));

/* --- 3.5.1: hoe gevoelig is het spoor voor de keuze van x̃? ------------------
   Een ablatie, opgebouwd uit experimenten/trace-voor-na.json. Ontbreekt dat
   bestand, dan zegt de tekst dat de meting nog moet gebeuren in plaats van een
   getal te verzinnen. */
C.push(h3('Hoe gevoelig is het spoor voor de keuze van x̃?'));
C.push(body(
  'De keuze hierboven is af te leiden uit de dynamiek, maar zij is niet vanzelfsprekend voor wie dit op een ' +
  'ander substraat bouwt: in een asynchrone of hardwarematige uitvoering is "de toestand vóór de laatste ' +
  'propagatiestap" niet zonder meer beschikbaar, en de toestand erná wel. De vraag is dus wat het kost om de ' +
  'verkeerde te nemen. Beide varianten zijn daarom naast elkaar gemeten; in de code is de tweede beschikbaar ' +
  'als ablatie.'
));
if (TRACE) {
  const M = TRACE.maten, N = TRACE.zaden;
  const v = (o) => (100 * o.m).toFixed(1) + '% ± ' + (100 * o.ci).toFixed(1);
  const vd = (o) => (o.m >= 0 ? '+' : '') + (100 * o.m).toFixed(1) + ' ± ' + (100 * o.ci).toFixed(1) + ' pp';
  const rij = (naam, k) => [naam, v(M[k].oud), v(M[k].nieuw), vd(M[k].verschilGepaard),
    'p = ' + M[k].mannWhitney.p.toFixed(3)];
  C.push(tbl(
    ['maat', 'toestand ná de stap', 'toestand vóór de stap', 'verschil (gepaard)', 'Mann-Whitney'],
    [rij('succes over de laatste 20 pogingen', 'succes20'),
     rij('toets op onbekende werelden', 'toets'),
     rij('succes over de hele training', 'succes')],
    [2700, 1600, 1600, 1900, 1272]
  ));
  const b = M.toets, sig = b.mannWhitney.p < 0.05;
  C.push(body(
    `${N} breinzaden per conditie, ${TRACE.pogingenPerRun} pogingen per run, verder identieke instellingen en ` +
    'dezelfde wereldzaden. ' +
    (sig
      ? 'Het verschil op de toets is groter dan de spreiding tussen zaden: de keuze van x̃ doet er op deze taak ' +
        'meetbaar toe. Alle overige cijfers in dit document zijn met de afgeleide term gemeten; de kolom ' +
        'traceOud in runs.csv zegt van elke run welke variant hij gebruikte.'
      : 'Op geen van de maten is het verschil groter dan de spreiding tussen zaden. De leerregel is op deze ' +
        'taak dus ongevoelig voor de keuze — wat niet betekent dat zij willekeurig is: de afgeleide term is ' +
        'die waarop de aanspraak van sectie 3.4 rust, en de numerieke controle van sectie 3.11 meet haar en ' +
        'niet de andere. Wie het model op een substraat bouwt waar alleen de toestand ná de stap beschikbaar ' +
        'is, betaalt daar op deze taak echter geen meetbare prijs voor.') +
    ' Beide reeksen staan volledig in experimenten/runs.csv onder de condities trace-oud en trace-nieuw.'
  ));
  if (GRADD) C.push(body(
    'De reden dat het verschil zo klein blijft, komt uit de controle van sectie 3.11. Over een losse tik met ' +
    'een willekeurige wolktoestand schelen de twee sporen tientallen procenten, maar in het beloningsgewogen ' +
    'gemiddelde over een hele poging is het verschil ' +
    (100 * GRADD.punten[0].verschilOudNieuw).toFixed(1) + ' %: de toestand van de wolk verandert langzaam, dus ' +
    'de activatie van vóór en ná één propagatiestap lijken sterk op elkaar. Bij een snellere dynamiek — een ' +
    'kleinere geheugentraagheid, een grotere P, of een taak met scherpere overgangen — is die marge er niet, ' +
    'en dan is de afgeleide term geen formaliteit meer.'
  ));
} else {
  C.push(body(
    'De vergelijking van beide varianten is nog niet gedraaid; zodra experimenten/trace-voor-na.json bestaat, ' +
    'verschijnt hier de gemeten tabel.'
  ));
}

C.push(h2('3.6', 'Basislijn en advantage'));
C.push(body(
  'Beloning in absolute zin is geen bruikbaar leersignaal. Beweegt de agent consequent in de goede richting, dan ' +
  'is elke beloning positief en zou elke verbinding die actief was versterkt worden — inclusief de verbindingen die ' +
  'niets bijdroegen. Wij trekken daarom een lopende basislijn af:'
));
C.push(eq(15));
C.push(eq(16));
C.push(body([
  it('Â'), t('ₜ is een advantage-schatting: hoeveel beter of slechter deze stap uitpakte dan het brein de laatste ' +
    'tijd gewend was. De begrenzing voorkomt dat één uitschieter — bijvoorbeeld het bereiken van het doel — de ' +
    'gewichten in één keer omgooit. In de ontwikkeling van dit model bleek het weglaten van de basislijn de ' +
    'belangrijkste oorzaak van falen: zonder haar liepen alle gewichten binnen enkele honderden stappen tegen hun ' +
    'plafond aan.')
]));

C.push(h2('3.7', 'De begrensde update'));
C.push(body('De ruwe verandering van een gewicht is het product van leersnelheid, advantage en spoor:'));
C.push(eq(17));
C.push(body('Daarop werken drie begrenzingen, die elk een ontwerpeis afdwingen.'));
C.push(h3('Niet oneindig versterken'));
C.push(body([
  t('Een verandering die een gewicht verder van nul af duwt, wordt gedempt naarmate dat gewicht zijn plafond ' +
    'nadert; een verandering die het naar nul toe brengt niet:')
]));
C.push(eq(18));
C.push(h3('Niet abrupt'));
C.push(body('De verandering per stap is hard begrensd, en het gewicht zelf blijft binnen zijn bereik:'));
C.push(eq(19));
C.push(eq(20));
C.push(body(
  'De combinatie is belangrijk. De demping alleen zou een gewicht asymptotisch tegen het plafond aan laten kruipen ' +
  'zonder het ooit te bereiken, maar zegt niets over de snelheid; de stapbegrenzing alleen zou een gewicht in een ' +
  'rechte lijn naar zijn plafond laten lopen. Samen leveren zij een verbinding die geleidelijk sterker wordt en ' +
  'daarbij steeds moeilijker nog sterker te maken is.'
));

C.push(h2('3.8', 'Vervaging'));
C.push(body('Eenmaal per poging zakt elk gewicht een klein stuk terug naar nul:'));
C.push(eq(21));
C.push(body(
  'Wat niet regelmatig bekrachtigd wordt, verdwijnt daarmee vanzelf, en wordt uiteindelijk gesnoeid (sectie 4.1). ' +
  'De keuze om dit per poging te doen en niet per spelstap is empirisch: bij een paar honderd stappen per poging ' +
  'overheerst een vervaging per stap het leersignaal volledig, en krimpen de gewichten monotoon ongeacht wat het ' +
  'netwerk presteert.'
));

C.push(h2('3.9', 'Exploratieschema'));
C.push(body('De exploratie loopt gedurende de training terug, maar nooit tot nul:'));
C.push(eq(22));
C.push(body('Uit die ene grootheid volgen de drie plekken waar exploratie in het model binnenkomt:'));
C.push(eq(23));
C.push(body([
  t('De ondergrens is essentieel. Zonder exploratie is '), it('δ'), t(' gelijk aan nul, valt het leersignaal weg, ' +
    'terwijl de vervaging en het snoeien doorgaan — een goed getraind netwerk valt dan aan het einde van de ' +
    'training alsnog uit elkaar. Het meeschalen van de leersnelheid met de exploratie houdt de verhouding tussen ' +
    'signaal en aanpassing constant.')
]));

C.push(h2('3.10', 'Het algoritme in zijn geheel'));
code([
  'voor elke poging e = 1 … E:',
  '    ε ← exploratieschema(e)                          (22)',
  '    zet de toestand van het netwerk en alle sporen op nul',
  '    voor elke spelstap t = 1 … T:',
  '        neem waar          → invoervector s',
  '        schone doorrekening x̄ ← propagate(s, ruis = 0)',
  '        ruisige doorrekening x ← propagate(s, ruis = ε);  bewaar x̃ = toestand vóór de laatste stap',
  '        δ ← x − x̄                                    (12)',
  '        voor elke knop k:  a_k ~ Bernoulli(p_k);  δ_k ← a_k − p_k   (7, 10)',
  '        voer de actie uit  → beloning r',
  '        e_ij ← λ e_ij + (1−λ) x̃_i δ_j                 (14)',
  '        Â ← clip(r − r̄, −c, c);   r̄ ← r̄ + β(r − r̄)   (15, 16)',
  '        w_ij ← clip(w_ij + clip(φ · η Â e_ij, ±Δmax), ±wmax)   (17–20)',
  '    w ← (1 − ρ) w                                    (21)',
  '    als e mod K = 0:  herstructureer (algoritme 2)'
], 'Algoritme 1 — leren').forEach(x => C.push(x));

/* --- 3.11: de numerieke controle van de leerregel -----------------------------
   Volledig uit experimenten/gradcheck*.json opgebouwd. Zonder die bestanden zegt
   de sectie dat de controle nog moet gebeuren; er wordt niets verzonnen. */
C.push(h2('3.11', 'Numerieke controle van de leerregel'));
C.push(body([
  t('De aanspraak van 3.4 — dat de update een schatter van de gradiënt is — was tot nu toe een afleiding en ' +
    'geen meting. Wij toetsen haar op een miniatuur-ANG met vier verborgen knopen en een bevroren topologie, ' +
    'waar de gradiënt nog met de hand na te rekenen is:')
]));
C.push(body([
  it('∂J/∂w'), t('ᵢⱼ ≈ ( '), it('J'), t('('), it('w'), t('+ε) − '), it('J'), t('('), it('w'),
  t('−ε) ) / 2ε, met '), it('J'), t(' geschat als de gemiddelde totale beloning over een vast blok pogingen.')
]));
if (GRAD && GRADD) {
  const P = GRAD.punten[0], D = GRADD.punten;
  C.push(body([
    t('Twee dingen maken die schatting bruikbaar. Ten eerste '), bd('gemeenschappelijke toevalsgetallen'),
    t(': elke poging heeft een vaste eigen toevalsgenerator en een vaste wereld, identiek voor elke waarde van '),
    it('w'), t('. Zonder die truc verdrinkt het verschil tussen '), it('J'), t('('), it('w'), t('+ε) en '),
    it('J'), t('('), it('w'), t('−ε) in de ruis van het beleid zelf. Ten tweede een '), bd('ijking van de meetlat'),
    t(': de numerieke gradiënt wordt twee keer berekend op onafhankelijke blokken pogingen. De cosinus tussen die ' +
      'twee helften zegt hoeveel van de gemeten richting signaal is, en dus hoe hoog een cosinus überhaupt kan ' +
      `worden. Bij ${GRAD.opzet.pogingenPerJhelft} pogingen per helft is die ${P.splitHalfNumGrad.toFixed(3)}; ` +
      `het meetbare plafond ligt daarmee op ${P.cosinusPlafond.toFixed(2)}. Een cosinus die daar tegenaan zit, is ` +
      'niet meer van een perfecte uitlijning te onderscheiden.')
  ]));
  figure(path.join(ROOT, 'paper/fig2-gradcheck.png'), 2,
    'De ANG-update tegen de numerieke gradiënt op de miniatuurgraaf. Links: per verbinding, met één ' +
    'gemeenschappelijke schaalfactor. De verbindingen naar de knoppen liggen op de diagonaal; de verbindingen ' +
    'naar de wolk liggen plat tegen de nullijn — hun richting klopt wel, hun grootte niet. Rechts: de cosinus ' +
    'als functie van het aantal pogingen waarover de update gemiddeld wordt.', 460).forEach(x => C.push(x));
  const rij = (d, k) => [k === 'knop' ? 'naar een knop (score-functie)' : 'naar de wolk (node-perturbatie)',
    String(d.delen[k].n), d.delen[k].cos.toFixed(2), d.delen[k].schaal.toFixed(0),
    (100 * d.delen[k].aandeelNormSchatter).toFixed(0) + ' %', (100 * d.delen[k].aandeelNormGrad).toFixed(0) + ' %'];
  for (const d of D) {
    C.push(h3(`Meetpunt: ${d.punt}`));
    C.push(tbl(
      ['deel van de update', 'n', 'cos met ∇J', 'schaalfactor c', 'aandeel in |Δw|', 'aandeel in |∇J|'],
      [rij(d, 'knop'), rij(d, 'wolk')],
      [3100, 700, 1300, 1500, 1600, 1472]
    ));
    C.push(body(
      `Over alle verbindingen samen is de cosinus ${d.cosTotaal.toFixed(2)}; schaalt men de twee delen apart, ` +
      `dan wordt zij ${d.cosNaDeelherschaling.toFixed(2)}. De schaalfactor van het wolkdeel is ` +
      `${d.schaalverhoudingWolkOverKnop.toFixed(0)}× die van het knopdeel.`, { spacing: { after: 140 } }));
  }
  const gem = D.reduce((a, d) => a + d.schaalverhoudingWolkOverKnop, 0) / D.length;
  C.push(h3('Wat de meting zegt'));
  C.push(bullet([bd('De exacte score-functie klopt. '), t('Voor de verbindingen naar de knoppen is de cosinus ' +
    D.map(d => d.delen.knop.cos.toFixed(2)).join(' / ') + ' op de drie meetpunten. Bij een meetbaar plafond ' +
    'van ' + GRAD.punten.map(x => x.cosinusPlafond.toFixed(2)).join(' / ') + ' is dat niet van exact te ' +
    'onderscheiden: vergelijking 11 doet wat zij belooft.')]));
  C.push(bullet([bd('Node-perturbatie wijst de goede kant op, maar ruw. '), t('Voor de verbindingen naar de wolk ' +
    'is de cosinus ' + D.map(d => d.delen.wolk.cos.toFixed(2)).join(' / ') + '. Positief en bruikbaar, maar ' +
    'ver van exact — en sterk afhankelijk van het punt in de gewichtsruimte.')]));
  C.push(bullet([bd('De twee delen staan niet op dezelfde schaal. '), t('Dit is de belangrijkste uitkomst. Het ' +
    'wolkdeel van de update is gemiddeld ongeveer ' + Math.round(gem) + '× te klein ten opzichte van het ' +
    'knopdeel, wat overeenkomt met de ontbrekende normalisatie 1/Var(ξ) uit vergelijking 37 (≈ ' +
    (3 / (GRAD.punten[0].sigmaRuis ** 2)).toFixed(0) + ' bij deze exploratie). Het gevolg is te zien in figuur 2a: ' +
    'met één leersnelheid krijgt de wolk feitelijk nauwelijks een update, terwijl de echte gradiënt daar ' +
    D.map(d => (100 * d.delen.wolk.aandeelNormGrad).toFixed(0) + ' %').join(' / ') + ' van zijn lengte heeft ' +
    'liggen.')]));
  C.push(bullet([bd('De ruis is niet het probleem. '), t('Uit figuur 2b: het gemiddelde over ongeveer dertig ' +
    'pogingen zit al op de eindwaarde. Meer monsters helpen daarna niet meer — wat er dan nog tussen zit is ' +
    'geen variantie maar vertekening.')]));
  const eb = GRAD.epsilonReeks;
  if (eb && eb.length) C.push(body(
    'De keuze van ε stuurt de uitkomst niet: over ε = ' + eb[0].epsilon + ' tot ' + eb[eb.length - 1].epsilon +
    ' blijft de cosinus met de schatter tussen ' + Math.min(...eb.map(x => x.cosMetSchatter)).toFixed(2) +
    ' en ' + Math.max(...eb.map(x => x.cosMetSchatter)).toFixed(2) + '.'));
  if (PGAIN) {
    const gs = Object.keys(PGAIN.perGain).map(Number).sort((a, b) => a - b);
    const pct = o => (100 * o.m).toFixed(1) + '% ± ' + (100 * o.ci).toFixed(1);
    C.push(h3('Wat de correctie waard is — nog niets, zonder de rest bij te stellen'));
    C.push(body([
      t('De ontbrekende factor toevoegen is één regel code. Wij hebben het gedaan, op het volledige brein, met '),
      it('g'), t(' als versterking van het wolkdeel van het spoor — en het resultaat is de moeite waard om te ' +
        'melden juist omdat het tegenvalt:')
    ]));
    const kop = ['versterking g', 'succes laatste 20', 'toets', 'actieve verbindingen'];
    C.push(tbl(kop, gs.map(g => [g === 1 ? '1 (huidige leerregel)' : String(g),
      pct(PGAIN.perGain[g].s20), pct(PGAIN.perGain[g].toets),
      PGAIN.perGain[g].actief ? PGAIN.perGain[g].actief.m.toFixed(0) : '–']),
      [2600, 2300, 2000, 2172]));
    C.push(body(
      `${PGAIN.zaden} zaden per waarde, ${PGAIN.pogingenPerRun} pogingen, leersnelheid ongewijzigd. Het leren ` +
      'stort in. Dat is geen weerlegging van de meting maar een bevestiging van wat zij zegt: als het wolkdeel ' +
      'twee ordes groter wordt terwijl η en de stapbegrenzing op de oude schaal blijven staan, loopt elke update ' +
      'in de wolk tegen de begrenzing uit sectie 3.7 aan en verliest die haar functie. De huidige η is stilzwijgend ' +
      'op de ónjuiste schaal afgesteld.'));
    if (PGAINLR) {
      const gl = Object.keys(PGAINLR.perGain).map(Number).sort((a, b) => a - b);
      C.push(body([
        t('De schone tegenproef schaalt de leersnelheid mee met 1/'), it('g'), t('. Dan blijft het wolkdeel op ' +
          'zijn oude grootte en wordt het knopdeel '), it('g'), t(' keer zachter — dezelfde verschuiving in de ' +
          'onderlinge verhouding, zonder dat de totale stap ontploft:')
      ]));
      C.push(tbl(kop, gl.map(g => [g === 1 ? '1 (huidige leerregel)' : String(g),
        pct(PGAINLR.perGain[g].s20), pct(PGAINLR.perGain[g].toets),
        PGAINLR.perGain[g].actief ? PGAINLR.perGain[g].actief.m.toFixed(0) : '–']),
        [2600, 2300, 2000, 2172]));
      const best = gl.reduce((a, g) => PGAINLR.perGain[g].toets.m > PGAINLR.perGain[a].toets.m ? g : a, gl[0]);
      C.push(body(
        best === 1
          ? 'Ook zo wint geen enkele waarde van g het van de bestaande verhouding. De conclusie is dan dat de ' +
            'scheve schaal wel aantoonbaar is op de miniatuurgraaf, maar dat het herstellen ervan met alleen deze ' +
            'ene knop niet werkt: leersnelheid, stapbegrenzing en exploratie hangen samen en moeten als geheel ' +
            'opnieuw afgesteld worden. Dat is een ablatie op zichzelf en hoort niet in deze sectie thuis.'
          : `De beste waarde is g = ${best} (toets ${pct(PGAINLR.perGain[best].toets)} tegen ` +
            `${pct(PGAINLR.perGain[1].toets)} bij g = 1). Dat is een aanwijzing dat de scheve schaal ook in het ` +
            'volledige model iets kost, maar geen afgeronde ablatie: η, de stapbegrenzing en de exploratie hangen ' +
            'samen en zijn hier niet als geheel opnieuw afgesteld.'));
    }
    C.push(body(
      'Wat er wél staat is dit: de leerregel bevat een aantoonbare schaalfout, die op de miniatuurgraaf de ' +
      'cosinus met de echte gradiënt van 0,12 naar 0,83 scheelt, en die in het volledige model niet met één ' +
      'parameter recht te zetten is. Dat is een scherpere en eerlijkere uitspraak dan de oorspronkelijke ' +
      '"de schatter is zuiver op een tweede-ordeterm na".'));
  }
} else {
  C.push(body('De numerieke controle is nog niet gedraaid; zodra experimenten/gradcheck.json bestaat, ' +
    'verschijnen hier de figuur en de tabellen.'));
}

/* --- 3.12: de vier varianten, hier alleen benoemd; gemeten in 10.6 ----------- */
if (LEERREGEL && LEERREGEL.tabel) {
  C.push(h2('3.12', 'Vier varianten van de leerregel'));
  C.push(body(
    'De regel hierboven is de regel die in de rest van dit document “ANG” heet. Er zijn vier plekken waar zij ' +
    'op een standaardmanier scherper gemaakt kan worden zonder haar lokale karakter op te geven, en alle vier ' +
    'zijn ze als losse schakelaar in de implementatie aanwezig zodat ze meetbaar zijn in plaats van aangenomen. ' +
    'Ze worden hier gedefinieerd; wat ze opleveren staat in sectie 10.6.'
  ));
  C.push(bullet([bd('Een toestandsafhankelijke criticus. '), t('De basislijn b in vergelijking 12 is één lopend ' +
    'gemiddelde over spelstappen en dus toestandsloos. In de variant komt daar een lineaire schatter ' +
    'V(s) = w·s + b voor in de plaats, op dezelfde zestien sensoren, bijgewerkt met TD(0) — ' +
    'w ← w + η_V·δ·s met δ = r + γV(s′) − V(s) — en wordt δ de Â uit vergelijking 12. De schatter is een tweede, ' +
    'losse leerder naast de graaf; door het netwerk wordt niets teruggepropageerd, dus de update van een ' +
    'synaps blijft opgebouwd uit grootheden die op die synaps beschikbaar zijn. In de metingen: η_V = ' +
    String(LEERREGEL.tabel['s7-criticus'] ? (LEERREGEL.condities['s7-criticus'].criticLr || 0.02) : 0.02).replace('.', ',') +
    ', γ = 0,95.')]));
  C.push(bullet([bd('Schaarse perturbatie. '), t('De ruis ξ wordt per tik aan een willekeurige deelverzameling ' +
    'van de wolk toegevoegd in plaats van aan alle knopen. De variantie van een perturbatieschatter groeit met ' +
    'het aantal knopen dat tegelijk beweegt; niet-verstoorde knopen krijgen die tik afwijking nul en dus geen ' +
    'spoor.')]));
  C.push(bullet([bd('Een categorisch beleid. '), t('In plaats van vier onafhankelijke Bernoulli-knoppen één ' +
    'softmax over negen elkaar uitsluitende acties: de acht richtingen en stilstaan. De score van een actie is ' +
    'de som van de netto-ingangen van de knoppen die zij indrukt, gedeeld door τ, zodat het aantal uitvoerknopen ' +
    'vier blijft en de score-functie haar vorm behoudt: ∂log π/∂net_k = (1[k ingedrukt] − P(k)), met P(k) de ' +
    'randkans van knop k onder de categorische verdeling. Bij onafhankelijke knoppen is P(k) de sigmoïde zelf en ' +
    'staat er weer vergelijking 11.')]));
  C.push(bullet([bd('De ontbrekende normalisatie g. '), t('Het wolkdeel van het spoor met een factor g ' +
    'vermenigvuldigen, als benadering van de 1/Var(ξ) die de standaardformulering van node-perturbatie heeft en ' +
    'die volgens sectie 3.11 in ANG ontbreekt. Anders dan in 3.11 wordt g hier gemeten met een leersnelheid die ' +
    'op g is afgesteld.')]));
}


/* ===== 4 ===== */
C.push(h1('4', 'Structurele plasticiteit'));
C.push(body(
  'Tot hier verandert alleen de sterkte van bestaande verbindingen. De tweede helft van het model verandert de ' +
  'graaf zelf. Dat gebeurt niet elke stap maar in ronden, eens per K pogingen, zodat de structuur rustiger ' +
  'verandert dan de gewichten.'
));

C.push(h2('4.1', 'Snoeien'));
C.push(body([
  t('Elke verbinding houdt bij hoe lang zij al zwak is. Eén ronde zwak zijn is niet genoeg; pas wie twee ronden ' +
    'achtereen onder de drempel blijft, verdwijnt:')
]));
C.push(eq(24));
C.push(body(
  'Een zelfverbinding van een geheugen-neuron wordt nooit gesnoeid (invariant I4), en een verbinding die de laatste ' +
  'uitweg van een invoerknoop of de laatste toevoer van een uitvoerknoop is evenmin (I1, I2).'
));

C.push(h2('4.2', 'Aangroei van verbindingen'));
C.push(body(
  'In dezelfde ronde komen er nieuwe verbindingen bij, met een klein willekeurig gewicht. De bron wordt gekozen met ' +
  'een lichte voorkeur voor magere neuronen: uit drie willekeurige kandidaten wordt die met de laagste graad ' +
  'genomen. Zo groeit de bedrading eerder aan waar weinig zit dan waar al veel zit, zonder dat er een harde regel ' +
  'over graden nodig is. Elke voorgestelde boog wordt getoetst aan L en genegeerd als hij niet mag.'
));

C.push(h2('4.3', 'Groei van neuronen'));
C.push(body(
  'Als het leren vastloopt, mag er materiaal bij. Stagnatie wordt gemeten door de gemiddelde opbrengst van het ' +
  'laatste blok pogingen te vergelijken met dat daarvóór:'
));
C.push(eq(25));
C.push(body(
  'Is aan die voorwaarde voldaan en is het plafond op het aantal neuronen nog niet bereikt, dan komen er nieuwe ' +
  'neuronen bij. Zij komen neutraal binnen: zij horen nog bij geen enkele soort en mogen daardoor alles. Twee ' +
  'details bepalen of zij ooit meedoen. Ten eerste worden zij geboren met ongeveer dezelfde graad als de rest van ' +
  'de wolk, niet met een handvol verbindingen: in een netwerk met duizenden verbindingen valt een neuron met vier ' +
  'bogen volledig weg in de ruis. Ten tweede krijgen hun verbindingen een respijt van twee opruimrondes, zodat zij ' +
  'niet gesnoeid worden voordat zij zich hebben kunnen bewijzen. Daarbovenop krijgt elk nieuw neuron gegarandeerd ' +
  'één boog vanaf een invoerknoop en één naar een uitvoerknoop, zodat het vanaf het begin in een pad ligt en dus ' +
  'leersignaal ontvangt.'
));
C.push(body([
  t('Dat dit ertoe doet is geen theorie. Met een klein vast aantal startverbindingen bleef in onze metingen bijna ' +
    'de helft van de neuronen na afloop losgekoppeld — het waren vrijwel allemaal bijgegroeide neuronen die nooit ' +
    'geïntegreerd raakten. Met graadgelijke geboorte en het respijt daalde dat aandeel naar enkele procenten, ' +
    'zonder dat de prestatie veranderde. De maat '), it('deelnemende neuronen'),
  t(' uit sectie 6 was precies het instrument dat dit zichtbaar maakte.')
]));

C.push(h2('4.4', 'Soorttoewijzing: de meest specifieke soort die past'));
C.push(body([
  t('De vraag welke soort een neuron moet krijgen, beantwoorden wij niet met een aparte heuristiek per soort maar ' +
    'met één criterium: '), bd('welke soort is dit neuron, gemeten aan de bedrading die het al heeft?'),
  t(' De kosten van een soort zijn de gewichtsmassa die verloren zou gaan omdat de regels van die soort haar ' +
    'verbieden:')
]));
C.push(eq(26));
C.push(body([
  t('waarin '), it('Eᵢ'), t(' de verbindingen zijn waarbij neuron '), it('i'), t(' betrokken is en '), it('Lₜ'),
  t(' de toelaatbaarheidsrelatie zoals die zou gelden als '), it('i'), t(' soort '), it('t'), t(' had. De kleine ' +
    'constante per verboden boog voorkomt dat het schrappen van louter nulverbindingen gratis is.')
]));
C.push(body([
  t('Op kosten alleen kan echter niet gekozen worden, en dat is een les die ons een halve dag heeft gekost. '),
  bd('Blijven kost per definitie niets'), t(' — alle bestaande verbindingen zijn immers toelaatbaar — en ' +
    'omschakelen naar worker kost ook niets, want die soort verbiedt niets. Een criterium dat de goedkoopste soort ' +
    'kiest, verandert dus vroeg of laat élk neuron in een worker, en de gespecialiseerde soorten verdwijnen ' +
    'stilletjes uit het netwerk. In onze metingen gebeurde precies dat: van negen reflex-neuronen waren er na ' +
    'vierhonderd pogingen nog drie over, en van de werkende reflexbogen bleef er geen enkele staan.')
]));
C.push(body([
  t('Wat ontbreekt is een tegenkracht: hoe strenger de regels van een soort, hoe meer het zegt dat een neuron er ' +
    'toch aan voldoet. Wij geven elke soort daarom een '), it('specificiteitsbonus'),
  t(' — reflex het hoogst, dan invoer-neuron, dan geheugen, en worker nul — en kiezen de laagste som:')
]));
C.push(eq(27));
C.push(body([
  t('over de toegestane verzameling '), it('A'), t('('), it('i'), t('), die de quota van de gebruiker en de ' +
    'meerderheidsregel afdwingt:')
]));
C.push(eq(28));
C.push(body([
  t('Een neutraal neuron neemt altijd de beste toegestane soort — het heeft niets te verliezen. Een neuron dat al ' +
    'een soort heeft, wisselt alleen als de nieuwe soort duidelijk beter scoort dan blijven, met een marge '),
  it('μ'), t(' die heen-en-weergeschuif voorkomt, én als de kosten onder de door de gebruiker gestelde drempel ' +
    'blijven:')
]));
C.push(eq(36));
C.push(body(
  'Wat er daarna aan verboden verbindingen overblijft, wordt verwijderd, en een neuron dat geheugen wordt, krijgt ' +
  'zijn zelfverbinding. Het aardige van deze formulering is dat de bekende gevallen er als bijzondere gevallen uit ' +
  'rollen. Een neuron dat alleen invoerknopen als bron heeft, kost niets als invoer-neuron en wint dus van worker. ' +
  'Een neuron dat uitsluitend tussen invoer-neuronen en knoppen hangt, is per definitie een reflex en krijgt de ' +
  'hoogste bonus. Een neuron in een lus kost als reflex zijn hele terugkoppeling en blijft dus worker of wordt ' +
  'geheugen. Er is geen aparte regel per soort nodig — alleen een rangorde van strengheid.'
));
C.push(h2('4.5', 'Recycling'));
C.push(body(
  'Een neuron dat na het snoeien geen enkele verbinding meer overhoudt, verliest zijn soort en wordt weer neutraal. ' +
  'Het is daarmee vrij materiaal: bij de volgende ronde kan het opnieuw bedraad worden en een andere soort krijgen. ' +
  'Zo verdwijnt niets uit het netwerk, maar wordt wel hergebruikt wat niet meer meedoet.'
));

C.push(h2('4.6', 'Herstel van de invarianten'));
C.push(body(
  'Aan het einde van elke ronde worden de invarianten hersteld: elke invoerknoop zonder uitweg krijgt er een, elke ' +
  'uitvoerknoop zonder toevoer krijgt er een, elk geheugen-neuron zonder zelfverbinding krijgt haar terug. Pas ' +
  'daarna wordt de graaf weer vastgelegd in de compacte datastructuren van sectie 7.'
));
code([
  'herstructureer(brein B, instellingen c):',
  '    1  snoei zwakke verbindingen                       (24)',
  '    2  neuronen zonder verbindingen  → neutraal',
  '    3  voor elk neutraal neuron:  T(i) ← argmin C(i,t)  (26, 27)',
  '       voor enkele bestaande neuronen: idem, mits C ≤ Cmax',
  '       verwijder de verbindingen die daardoor verboden zijn',
  '    4  als stagnatie en n < nmax:  voeg neutrale neuronen toe   (25)',
  '    5  laat nieuwe verbindingen aangroeien (voorkeur: lage graad)',
  '    6  herstel I1, I2, I4',
  '    7  herbereken de samenstelling en de tekenpositie van de wolk'
], 'Algoritme 2 — herstructureren').forEach(x => C.push(x));

/* ===== 5 ===== */
C.push(h1('5', 'Omgeving, waarneming en beloning'));
C.push(body(
  'Een leerregel is niet los te beschrijven van wat er te leren valt. De instantie waarin ANG hier draait is een ' +
  'continue tweedimensionale wereld waarin een karakter een doel moet bereiken zonder tegen obstakels te botsen. ' +
  'Start en doel liggen tegen twee tegenoverliggende randen, en welke randen dat zijn wisselt per wereld, zodat een ' +
  'vaste voorkeursrichting geen oplossing is. De obstakels liggen in het middengebied. Elke gegenereerde wereld ' +
  'wordt met een breedtezoektocht op oplosbaarheid getoetst voordat hij gebruikt wordt.'
));

C.push(h2('5.1', 'Waarneming'));
C.push(body(
  'Het netwerk krijgt zestien getallen, en verder niets — geen coördinaten, geen kaart, geen geheugen van eerdere ' +
  'pogingen. Acht ervan meten in acht windrichtingen de nabijheid van het dichtstbijzijnde obstakel of de ' +
  'wereldrand:'
));
C.push(eq(29));
C.push(body([
  t('waarin '), it('ρ'), t('_d de afstand langs straal '), it('d'), t(' is. De andere acht coderen het doel als ' +
    'een richting-met-nabijheid: hoe beter een richting naar het doel wijst en hoe dichterbij het doel is, hoe ' +
    'hoger de waarde.')
]));
C.push(eq(30));
C.push(body(
  'Beide families zijn zo geschaald dat nul "niets aan de hand" betekent. Dat is geen detail: bij een nulwaarde ' +
  'levert een verbinding geen bijdrage aan de netto-invoer en ook geen spoor, zodat een neuron dat op een stille ' +
  'sensor is aangesloten vanzelf onbelast blijft.'
));

C.push(h2('5.2', 'Beloning'));
C.push(body('De beloning per stap is een som van vijf termen:'));
C.push(eq(31));
C.push(body(
  'De eerste term beloont dichter bij het doel komen, de tweede is een kleine tijdkost, de derde bestraft ' +
  'stilstand, de vierde een botsing, en de vijfde is de eindbeloning met een bonus naarmate het doel sneller ' +
  'bereikt wordt.'
));

C.push(h2('5.3', 'De dichtheidsterm is potentiaal-gebaseerd'));
C.push(body([
  t('De term die vooruitgang beloont, verdient een opmerking. Het is verleidelijk te denken dat zo\'n term het ' +
    'probleem verandert — dat het netwerk leert "dichter bij komen" in plaats van "het doel bereiken". Dat is hier ' +
    'niet zo. Met de potentiaal '), it('Φ'), t('('), it('s'), t(') = −'), it('c_p'), t(' '), it('D'), t('('),
  it('s'), t('), waarin '), it('D'), t(' de afstand tot het doel is, geldt namelijk')
]));
C.push(eq(32));
C.push(body(
  'en dat is precies de vorm waarvan Ng, Harada en Russell [9] hebben aangetoond dat zij het optimale beleid ' +
  'ongemoeid laat. De term versnelt het leren zonder de opgave te veranderen. Zet men hem op nul, dan blijft ' +
  'dezelfde opgave over, maar met beloning die pas aan het eind komt — een goede manier om te laten zien hoe ' +
  'moeizaam leren wordt bij ijl beloningssignaal.'
));

/* ===== 6 ===== */
C.push(h2('5.4', 'Hoe je een stochastisch beleid toetst'));
C.push(body([
  t('Bij het toetsen op onbekende werelden ligt een fout op de loer. Het beleid '),
  it('is'), t(' stochastisch: elke knop is een kans en de actie wordt geloot. Het is verleidelijk om bij een toets ' +
    'de loting weg te laten en steeds de waarschijnlijkste knop te nemen, want dat lijkt "het geleerde beleid ' +
    'zonder ruis". Dat is het niet — het is een ander, en meetbaar slechter beleid. Een agent die deterministisch ' +
    'twee knoppen tegelijk ingedrukt houdt tegen een muur, blijft daar oneindig staan; dezelfde kansen laten hem ' +
    'binnen een paar stappen loskomen.')
]));
C.push(body(
  'De toets draait daarom met dezelfde loting als tijdens het leren, maar zonder leren, zonder ruis in de wolk en ' +
  'met een eigen toevalsgenerator, zodat de toets reproduceerbaar is en de training niet verstoort. De strengere ' +
  'variant wordt niet als alternatief gebruikt maar in elke run ernaast gemeten, want het verschil tussen beide ' +
  'is zelf een grootheid: het zegt hoeveel van de prestatie op de scherpte van de beslissingen berust en hoeveel ' +
  'op het blijven bewegen.'
));
/* Het verschil tussen beide beleidsvormen, rechtstreeks uit experimenten/benchmark.json. */
if (BENCH && BENCH.maten && BENCH.maten.benchBeleid && BENCH.maten.benchStreng) {
  const g = bm(BENCH.maten.benchBeleid.overZaden), s = bm(BENCH.maten.benchStreng.overZaden);
  const d = BENCH.verschilArgmaxMinGeloot, mwu = BENCH.mannWhitney;
  C.push(body([
    bd('En dat verschil is groot. '),
    t('Over ' + g.n + ' breinzaden haalt het geleerde, gelote beleid op de benchmarkset van sectie 10.2 '),
    bd(pct(g)), t(', terwijl steeds de waarschijnlijkste knop nemen op diezelfde werelden blijft steken op '),
    bd(pct(s)), t('. Gepaard per zaad scheelt dat ' + (100 * d.m).toFixed(1) + ' ± ' + (100 * d.ci).toFixed(1) +
      ' procentpunt in het nadeel van argmax' + (mwu ? ' (Mann-Whitney U, p ' +
      (mwu.p < 0.001 ? '< 0,001' : '= ' + mwu.p.toFixed(3)) + ')' : '') + '. Het toeval is dus geen ruis die je ' +
      'er bij het toetsen netjes uit haalt — het is onderdeel van de strategie geworden. Wie deze twee door ' +
      'elkaar haalt, meet een ander beleid dan hij getraind heeft, en onderschat het resultaat met ruwweg een ' +
      'achtste van de score.')
  ]));
}

C.push(h1('6', 'Het meten van de gevormde structuur'));
C.push(body(
  'Wat een ANG uiteindelijk gebouwd heeft, is de eigenlijke uitkomst. De volgende maten worden op de actieve ' +
  'deelgraaf berekend, dat wil zeggen op de verbindingen die zwaar genoeg zijn om ertoe te doen:'
));
C.push(eq(33));
C.push(body([
  t('De drempel is bewust '), it('relatief'), t(' aan het zwaarste gewicht dat er werkelijk is, en niet aan het ' +
    'plafond w'), t('max'), t('. Gewichten blijven in de praktijk ruim onder dat plafond; een absolute drempel ' +
    'verklaart daardoor bijna elke verbinding voor inactief en laat een werkend brein structuurloos lijken. Bij ' +
    'de waarden uit sectie 8 scheelt dat een orde van grootte in het aantal verbindingen dat meetelt.')
]));
C.push(h3('Kortste pad van zintuig naar knop'));
C.push(body([
  t('De lengte in bogen van het kortste pad in '), it('E_θ'), t(' van een willekeurige invoerknoop naar een ' +
    'willekeurige uitvoerknoop. Twee is het minimum dat de regels toelaten. Bestaat er geen pad, dan is het brein ' +
    'per definitie stuurloos — een diagnose die je aan de prestatie alleen niet zou zien.')
]));
C.push(h3('Lussen'));
C.push(body(
  'Het aantal sterk samenhangende componenten van meer dan één knoop in de actieve deelgraaf, plus het aantal ' +
  'actieve zelfverbindingen van geheugen-neuronen. Dit telt hoeveel echte terugkoppeling er in het netwerk zit.'
));
C.push(h3('Werkende reflexbogen'));
C.push(body(
  'Het aantal reflex-neuronen dat zowel vanaf de invoer bereikbaar is als een actieve uitgang heeft. Dit is de maat ' +
  'voor "heeft dit brein een korte weg van zintuig naar spier gevormd".'
));
C.push(h3('Deelnemende neuronen'));
C.push(body(
  'Een neuron doet mee als het bereikbaar is vanaf de invoer én de uitvoer kan bereiken. De rest is losgeraakt: ' +
  'het draait wel mee in de berekening, maar kan het gedrag onmogelijk beïnvloeden. Het verschil tussen "aantal ' +
  'neuronen" en "aantal meedoende neuronen" is de eerlijkste maat voor hoe groot een netwerk werkelijk is.'
));
C.push(h3('Sensorinvloed'));
C.push(body([
  t('Voor elke invoerknoop sommeren wij de gewichtsmassa die haar via paden van hoogstens vijf bogen bereikt ' +
    'aan de uitvoer:')
]));
C.push(eq(34));
C.push(body(
  'Dit is een afgeknotte padsom, verwant aan Katz-centraliteit. Zij maakt zichtbaar welke zintuigen het netwerk ' +
  'feitelijk gebruikt en welke het volledig negeert — informatie die uit de prestatie alleen nooit af te lezen is.'
));

/* ===== 7 ===== */
C.push(h1('7', 'Implementatie'));
C.push(body([
  t('Het model, de meetscripts en dit document zijn tot stand gekomen met behulp van een generatief ' +
    'AI-hulpmiddel (Claude, Opus 5, Anthropic). Wat dat hulpmiddel precies heeft gedaan, en waarom het niet als ' +
    'auteur is opgevoerd, staat in de verklaring achter in dit document. Het wordt hier genoemd omdat het bij de ' +
    'werkwijze hoort en niet bij de kleine lettertjes.')
]));
C.push(h2('7.1', 'Indexering en datastructuren'));
C.push(body(
  'De knopen liggen in een vaste volgorde: eerst de zestien invoerknopen, dan de vier uitvoerknopen, dan de wolk. ' +
  'Die volgorde is met opzet gekozen. Zij zorgt dat een neuron dat er tijdens het trainen bij komt achteraan wordt ' +
  'toegevoegd, zodat geen enkel bestaand nummer verschuift en geen enkele opgeslagen verbinding hoeft te worden ' +
  'omgenummerd. De verbindingen zelf staan in vier parallelle getypeerde arrays — bron, doel, gewicht, spoor — wat ' +
  'de propagatie een enkele lus over aaneengesloten geheugen maakt.'
));
C.push(h2('7.2', 'Complexiteit'));
C.push(body('Per spelstap en per poging:'));
C.push(eq(35));
C.push(body(
  'De dominante term is het aantal verbindingen, niet het aantal neuronen: een wolk van zestig neuronen met ' +
  'tweeduizend verbindingen rekent trager dan een wolk van tweehonderd neuronen met vijfhonderd. Het herstructureren ' +
  'is lineair in het aantal verbindingen op de soorttoewijzing na, die per kandidaat-neuron één keer over de ' +
  'verbindingen loopt. De krachtenmodel-lay-out voor de weergave is kwadratisch in het aantal knopen en wordt ' +
  'daarom alleen bij structuurveranderingen opnieuw uitgevoerd.'
));
C.push(h2('7.3', 'Numerieke waarborgen'));
C.push(body(
  'Alle activaties liggen door tanh en σ binnen begrensde intervallen; alle gewichten en biassen zijn hard begrensd ' +
  'op ±w_max; de advantage is begrensd; de sporen zijn genormaliseerd. Er is geen plek in het model waar een ' +
  'grootheid ongelimiteerd kan groeien, wat verklaart waarom er ook bij duizenden pogingen geen numerieke ' +
  'ontsporing optreedt.'
));
C.push(h2('7.4', 'Reproduceerbaarheid'));
C.push(body([
  t('Een run wordt volledig vastgelegd door twee zaadwaarden. Het '), bd('breinzaad'),
  t(' bepaalt de startwolk: welke neuronen welke soort krijgen, waar de eerste verbindingen liggen en met welke ' +
    'gewichten zij beginnen. Het '), bd('wereldzaad'),
  t(' bepaalt de reeks werelden en, via een tweede deterministische generator, alle ruis tijdens het leren — de ' +
    'perturbaties in de wolk, de loting van de vier knoppen en elke keuze in de herstructurering. De toets op ' +
    'onbekende werelden heeft een eigen, vaste generator, zodat toetsen de training niet verstoort en zelf ' +
    'herhaalbaar is. Nergens in het leertraject wordt de generator van de omgeving aangeroepen.')
]));
C.push(body(
  'Dat is geen ontwerpwens maar een gecontroleerde eigenschap. Dezelfde twee zaden worden twee keer achter elkaar ' +
  'gedraaid, waarna de volledige leercurve, alle tussentijdse toetsen, alle structuurmaten en het volledige ' +
  'eindnetwerk — knoop voor knoop en verbinding voor verbinding — bit voor bit worden vergeleken.' +
  (HERH ? ' Bij ' + HERH.runs.length + ' zaadwaarden, elk over ' + HERH.pogingenPerRun + ' pogingen, was de uitkomst ' +
    (HERH.runs.every(r => r.identiek) ? 'in alle gevallen identiek' : 'niet in alle gevallen identiek') + '.'
    : '')
));
C.push(body(
  'Elke afgeronde training wordt weggeschreven met alle instellingen, beide zaden, de geschiedenis per poging, de ' +
  'toetsen op onbekende werelden, het logboek van herstructureringen en de volledige eindstructuur van het netwerk ' +
  '— alle knopen met hun soort, hun positie en hun bias, en alle verbindingen met hun gewicht. Bijlage B geeft de ' +
  'volledige veldenlijst. Zo\'n bestand is niet alleen leesbaar maar ook laadbaar: het netwerk kan er ' +
  'ongewijzigd uit teruggebouwd worden om opnieuw getoetst te worden, om verder te trainen, of om als startpunt ' +
  'voor een variant te dienen. Dat maakt de meetopstelling ook geschikt voor reeksen: een lijst condities maal ' +
  'zaden wordt achter elkaar afgedraaid en levert per run een bestand en één regel in een gezamenlijke tabel.'
));

/* ===== 8 ===== */
C.push(h1('8', 'Parameters'));
C.push(body(
  'Onderstaande tabel vat de vrije parameters samen, met de waarden die als standaard gelden. De laatste kolom ' +
  'geeft aan waar de parameter in het model optreedt.'
));
C.push(gap(60));
C.push(tbl(
  ['Symbool', 'Betekenis', 'Standaard', 'Zie'],
  [
    ['n', 'aantal neuronen bij de start', '60', 'sectie 2.1'],
    ['d', 'startdichtheid: uitgaande verbindingen per neuron', '35', 'sectie 4.2'],
    ['P', 'propagatiestappen per spelstap', '1', 'vgl. 4–6'],
    ['α', 'geheugenlek', '0,15', 'vgl. 6'],
    ['η₀', 'leersnelheid', '0,008', 'vgl. 17'],
    ['λ', 'sporenvervaging', '0,60', 'vgl. 14'],
    ['β', 'aanpassingssnelheid van de basislijn', '0,02', 'vgl. 15'],
    ['wₘₐₓ', 'maximaal gewicht', '2,0', 'vgl. 18, 20'],
    ['Δₘₐₓ', 'maximale verandering per stap', '0,100', 'vgl. 19'],
    ['ρ', 'vervaging per poging', '0,0001', 'vgl. 21'],
    ['ε₀', 'exploratie bij aanvang', '0,30', 'vgl. 22'],
    ['ε∞', 'ondergrens exploratie', 'max(0,3 ε₀ ; 0,03)', 'vgl. 22'],
    ['K', 'pogingen tussen twee herstructureringen', '10', 'sectie 4'],
    ['θₚ', 'snoeidrempel', '0,030', 'vgl. 24'],
    ['—', 'nieuwe verbindingen per ronde', '6', 'sectie 4.2'],
    ['nₘₐₓ', 'plafond op het aantal neuronen', '140', 'sectie 4.3'],
    ['—', 'nieuwe neuronen per ronde', '2', 'sectie 4.3'],
    ['Cₘₐₓ', 'maximale omschakelkosten', '0,25', 'vgl. 27'],
    ['—', 'obstakels in de wereld', '7', 'sectie 5'],
    ['T', 'stappen per poging', '320', 'sectie 5'],
    ['E', 'aantal pogingen', '500', 'algoritme 1'],
    ['—', 'werelden per tussentijdse toets', '20', 'sectie 5.4'],
    ['—', 'werelden in de benchmarkset × keer gespeeld', '500 × 3', 'sectie 10.2']
  ],
  [1500, 4200, 2100, 1272]
));
C.push(gap(200));

/* ===== 9 ===== */
C.push(h1('9', 'Beperkingen'));
C.push(bullet([bd('De gradiëntschatter is ruis. '), t('Node-perturbatie levert een zuivere maar variabele ' +
  'schatting; de variantie groeit met het aantal knopen dat tegelijk verstoord wordt. Dat begrenst hoe groot een ' +
  'wolk zinvol kan worden zonder de leersnelheid te verlagen.')]));
C.push(bullet([bd('De twee delen van de update staan niet op dezelfde schaal. '),
  t('Sectie 3.11 meet dat het node-perturbatiedeel twee ordes te klein is ten opzichte van het ' +
    'score-functiedeel, doordat de normalisatie 1/Var(ξ) ontbreekt. Met één leersnelheid krijgt de wolk daardoor ' +
    'nauwelijks een update. Dit is de scherpste bekende tekortkoming van de leerregel; het herstellen ervan vraagt ' +
    'om de leersnelheid en de stapbegrenzing samen opnieuw af te stellen, en dat is nog niet gedaan.')]));
C.push(bullet([bd('De uitkomst hangt af van het punt in de gewichtsruimte. '),
  t('De cosinus van het wolkdeel met de echte gradiënt loopt in dezelfde opstelling van 0,27 bij een vers brein ' +
    'tot 0,83 na tweehonderd pogingen leren. Eén meting op één punt zegt dus weinig; de controle is uitgevoerd op ' +
    'drie punten en zelfs dat is weinig.')]));
C.push(bullet([bd('De controle is klein. '), t('De numerieke gradiënt is alleen na te rekenen op een graaf met ' +
  'vier verborgen knopen en een bevroren topologie, in een omgeving waarin die miniatuuragent het doel zelden ' +
  'haalt. Dat J daar vooral door de dichtheidsterm wordt bepaald is geen bezwaar voor het toetsen van de ' +
  'leerregel — dat is ook het signaal dat het brein tijdens de training grotendeels ziet — maar het blijft een ' +
  'ander regime dan het volledige model.')]));
C.push(bullet([bd('Geen kritiek­functie. '), t('De advantage is een lopend gemiddelde over stappen, geen ' +
  'toestandsafhankelijke waardeschatting. In toestanden die systematisch beter of slechter zijn dan gemiddeld, ' +
  'is het signaal daardoor vertekend.')]));
C.push(bullet([bd('Soorttoewijzing is lokaal. '), t('Het criterium in vergelijking 26 kijkt alleen naar de bogen ' +
  'van het neuron zelf, niet naar wat de verandering verderop in het netwerk aanricht. Ook de rangorde van ' +
  'specificiteit is een ontwerpkeuze en geen afgeleid resultaat; een criterium dat de doorstroming over paden ' +
  'meeweegt zou principiëler zijn.')]));
C.push(bullet([bd('Groei kent geen krimp. '), t('Neuronen kunnen bijkomen en hun soort verliezen, maar worden ' +
  'nooit verwijderd. Een netwerk dat te ver doorgroeit kan alleen nog verdunnen, niet inkrimpen.')]));
C.push(bullet([bd('De structuurmaten hangen aan een drempel. '), t('Wat "actief" heet, is een keuze: een andere ' +
  'drempel geeft andere padlengtes, andere lussen en andere reflexbogen. De maten zijn geschikt om breinen met ' +
  'elkaar te vergelijken, niet als absolute grootheid.')]));
C.push(bullet([bd('Eén omgeving. '), t('Alle ontwerpbeslissingen zijn gemaakt met één taak voor ogen. Welke ervan ' +
  'algemeen zijn en welke aan die taak vastzitten, is een open vraag.')]));
C.push(bullet([bd('De benchmarkset is één trekking uit één generator. '), t('Vijfhonderd werelden halen de ' +
  'meetruis omlaag, maar zij komen alle uit dezelfde wereldgenerator met hetzelfde aantal obstakels. Het ' +
  'interval eromheen zegt hoe zeker de score op déze verdeling is, niet hoe het model het doet op werelden die ' +
  'anders in elkaar zitten. Sectie 10.4 noemt de tweede taak die dat moet uitwijzen.')]));
C.push(bullet([bd('Alle instellingen zijn op de trainingsverdeling gekozen. '), t('De standaardwaarden uit ' +
  'sectie 8 zijn afgesteld vóórdat de benchmarkset bestond, op twintig toetswerelden. De benchmark is sindsdien ' +
  'nooit gebruikt om iets te kiezen, maar de instellingen die zij beoordeelt zijn wel met een minder ' +
  'betrouwbaar signaal tot stand gekomen. Het raster van dichtheid tegen aantal neuronen wordt daarom opnieuw ' +
  'gedraaid met de benchmark als toets.')]));
if (ABLATIE) C.push(bullet([bd('De ablatiereeks draait op één leersnelheid. '), t('Elke conditie in sectie 10.7 ' +
  'gebruikt η = ' + String(ABLATIE.leersnelheid).replace('.', ',') + ', de waarde die voor het volle model is ' +
  'afgesteld. Het argument daarvoor is dat een ablatie de graaf verandert en niet de schaal van het ' +
  'leersignaal, zodat meesturen van η zou meten hoe goed een conditie opnieuw af te stellen is. Dat argument ' +
  'is redelijk maar niet gemeten: een conditie die het slechter doet zou in beginsel een andere η kunnen ' +
  'willen, en de reeks kan dat niet uitsluiten.')]));

/* ===== 10 ===== */
C.push(h1('10', 'Evaluatie'));
C.push(body(
  'De meetopzet is met opzet niet ingericht om te laten zien dat het model werkt, maar om uit elkaar te trekken ' +
  'wáár een eventuele prestatie vandaan komt. Deze versie van het document bevat de benchmarkset, de ' +
  'referentiemeting daarop en de reproduceerbaarheidscontrole, en sectie 3.11 de numerieke controle van de ' +
  'leerregel zelf' +
  (ABLATIE ? '; sectie 10.4 tot en met 10.7 bevatten de basislijnen, de rekenkostentabel, de varianten van ' +
    'de leerregel en de ablatiereeks.' : '; de ablaties en de basislijnen volgen in een latere versie.') +
  (TAAKAS ? ' Sectie 10.8 varieert vervolgens de waarneembaarheid van de omgeving' +
    (OMSLAG ? ', sectie ' + SEC_OMSLAG + ' laat de omgeving binnen één leven omslaan' : '') +
    (SGEDRAG ? ', en sectie ' + SEC_SG + ' stelt vier vragen aan al dat materiaal samen zonder nieuwe ' +
      'metingen te doen' : '') + '.' : '')
));
C.push(h2('10.1', 'Twee meetassen'));
C.push(body(
  'Prestatie wordt gescheiden gemeten op de werelden waarin getraind is en op werelden die het netwerk nooit ' +
  'gezien heeft. Het verschil tussen die twee is de eigenlijke grootheid: het onderscheidt het uit het hoofd leren ' +
  'van een route van het leren navigeren. Daarnaast wordt na elke run de gevormde structuur met de maten uit ' +
  'sectie 6 vastgelegd, zodat de vraag beantwoord kan worden welke structurele eigenschappen met goed presteren ' +
  'samenhangen.'
));
C.push(body([
  bd('Over onzekerheid. '),
  t('Er zijn er twee, en ze worden makkelijk verward. De eerste is de spreiding '), it('tussen zaden'),
  t(': hetzelfde recept levert verschillende breinen op. De tweede is de onzekerheid '), it('binnen één run'),
  t(': op hoeveel werelden is die ene agent afgerekend? Beide staan hieronder als 95%-interval, en ze horen ' +
    'niet bij elkaar opgeteld te worden. Overlappen twee intervallen elkaar ruim, dan is een verschil niet ' +
    'aangetoond, hoe suggestief het gemiddelde ook oogt.')
]));

/* --- 10.2: de benchmarkset --- */
C.push(h2('10.2', 'Waarop getoetst wordt: een vaste benchmarkset'));
if (BENCH && BENCH.benchmark) {
  const B = BENCH.benchmark, O = BENCH.onzekerheidPerMeting;
  C.push(body([
    t('Tijdens het leren loopt elke twintig pogingen een toets mee op twintig onbekende werelden. Dat is een ' +
      'bruikbaar en goedkoop signaal, maar het draagt geen conclusie: bij een score rond 70% is het ' +
      '95%-interval van twintig trekkingen ongeveer '),
    bd('± ' + (100 * O.toets20Binomiaal.m).toFixed(0) + ' procentpunt'),
    t('. Twee condities die in werkelijkheid tien procentpunt schelen, zijn zo niet uit elkaar te houden.')
  ]));
  C.push(body(
    'Wat in dit document staat, komt daarom van een vaste benchmarkset: ' + B.werelden +
    ' werelden uit een eigen zaadreeks, met vast ' +
    B.obstakels + ' obstakels, gescheiden van de trainingswerelden én van de twintig werelden die tijdens het ' +
    'leren meelopen. Zij wordt nooit gebruikt om instellingen te kiezen. Omdat het beleid geloot wordt, speelt ' +
    'elke wereld ' + B.herhalingen + ' keer; het interval gaat over de werelden en niet over de speelbeurten, ' +
    'want drie keer dezelfde wereld spelen levert geen drie onafhankelijke waarnemingen over generalisatie op. ' +
    'Daarmee zakt de onzekerheid van één meting naar ± ' + (100 * O.benchmarkBinnenRun.m).toFixed(1) +
    ' procentpunt.' +
    (BENCHSET ? ' De verzameling ligt vast in experimenten/benchmark-werelden.json, met een controlegetal ' +
      'waarmee een afwijking direct opvalt.' : '')
  ));
  const ij = BENCH.ijkpunten;
  if (ij) {
    C.push(h3('Twee ijkpunten op diezelfde werelden'));
    C.push(body([
      t('Een schaal zonder ijkpunt meet niets. Een agent die elke tik een willekeurige richting kiest haalt op ' +
        'deze werelden '), bd((100 * ij.willekeurig.pct).toFixed(1) + '%'),
      t(' — de vloer. Een zuiver reactieve agent met precies dezelfde zintuigen als het netwerk, die naar het ' +
        'doel toe wordt getrokken en van wat vlakbij staat wordt afgestoten, haalt '),
      bd((100 * ij.reactief.pct).toFixed(1) + '% ± ' + (100 * ij.reactief.ci).toFixed(1)),
      t('. Dat is wat zonder geheugen, zonder planning en zonder leren haalbaar is, en het is de ondergrens ' +
        'waar alles wat het netwerk leert bovenuit moet komen.')
    ]));
    if (ij.reactiefOp20) {
      C.push(body([
        bd('Hoeveel dat scheelt, laat de ijkagent zelf zien. '),
        t('Dezelfde agent, hetzelfde soort werelden: op twintig toetswerelden scoort hij ' +
          (100 * ij.reactiefOp20.pct).toFixed(1) + '% ± ' + (100 * ij.reactiefOp20.ci).toFixed(1) +
          ', op de vijfhonderd benchmarkwerelden ' + (100 * ij.reactief.pct).toFixed(1) + '% ± ' +
          (100 * ij.reactief.ci).toFixed(1) + '. Een verschil van ' +
          Math.abs(100 * (ij.reactiefOp20.pct - ij.reactief.pct)).toFixed(0) + ' procentpunt zonder dat er ' +
          'iets aan het beleid veranderd is — geheel binnen wat twintig trekkingen aan speling geven. Dat is ' +
          'de omvang van de fout die men maakt door een generalisatiecijfer op twintig werelden te baseren.')
      ]));
    }
  }
} else {
  C.push(body('De benchmarkset is nog niet gedraaid; zodra experimenten/benchmark.json bestaat, verschijnen hier ' +
    'de opzet en de twee ijkpunten.'));
}

/* --- referentiemeting, opgebouwd uit runs.csv --- */
if (RUNS && RUNS.length) {
  /* De referentiemeting hoort bij de leerregel zoals die nu is en bij de
     meetopstelling zoals die nu is: de conditie benchmark-standaard, zestien zaden,
     gemeten op de vaste benchmarkset. Ontbreekt die, dan valt de sectie terug op
     trace-nieuw (zelfde leerregel, alleen de oude toets van twintig werelden) en
     daarna op de oudste rijen, die nog met de foutieve trace draaiden. */
  const Rb = RUNS.filter(r => r.conditie === 'benchmark-standaard');
  const R0 = Rb.length ? Rb : RUNS.filter(r => r.conditie === 'trace-nieuw');
  const R1 = R0.length ? R0 : RUNS.filter(r => r.conditie === 'standaard');
  const R = R1.length ? R1 : RUNS;
  const bBel = stat(R.map(r => r.benchBeleid));
  const bStr = stat(R.map(r => r.benchStreng));
  const bCI = stat(R.map(r => r.benchBeleidCI));
  const s20 = stat(R.map(r => r.succes20));
  const ev = stat(R.map(r => r.toetsPct));
  const sc = stat(R.map(r => r.succesPct));
  const cn = stat(R.map(r => r.verbindingen));
  const ac = stat(R.map(r => r.actieveVerbindingen));
  const nu = stat(R.map(r => r.neuronenEind));
  const rf = stat(R.map(r => r.reflexbogen));
  const lp = stat(R.map(r => r.lussen));
  const pd = stat(R.map(r => r.kortstePad));
  const mn = stat(R.map(r => r.meedoendeNeuronen));
  const tm = stat(R.map(r => r.rekentijdMs / 1000));
  const st = stat(R.map(r => r.gemStappenBijSucces));
  const c0 = R[0];
  const heeftB = bBel && bBel.n === s20.n;
  C.push(h2('10.3', 'Referentiemeting'));
  C.push(body(
    'De standaardconfiguratie — ' + c0.neuronenStart + ' neuronen bij aanvang, startdichtheid ' + c0.dichtheid +
    ', ' + c0.obstakels + ' obstakels, ' + c0.maxSteps + ' stappen per poging, ' + c0.pogingen + ' pogingen — is over ' +
    s20.n + ' onafhankelijke breinzaden gedraaid, alle met hetzelfde wereldzaad, zodat de zaden alleen in de ' +
    'startwolk verschillen. Dit is de conditie waartegen elke latere ablatie wordt afgezet.'
  ));
  C.push(tbl(
    ['grootheid', 'gemiddelde ± 95%', 'spreiding (sd)', 'bereik'],
    [
      ['succes over alle pogingen', pct(sc), pctSd(sc), (100 * sc.min).toFixed(0) + '–' + (100 * sc.max).toFixed(0) + '%'],
      ['succes laatste 20 pogingen', pct(s20), pctSd(s20), (100 * s20.min).toFixed(0) + '–' + (100 * s20.max).toFixed(0) + '%'],
      ['toets, 20 werelden (goedkoop signaal)', pct(ev), pctSd(ev), (100 * ev.min).toFixed(0) + '–' + (100 * ev.max).toFixed(0) + '%']
    ].concat(heeftB ? [
      ['benchmark, geleerd beleid', pct(bBel), pctSd(bBel), (100 * bBel.min).toFixed(0) + '–' + (100 * bBel.max).toFixed(0) + '%'],
      ['benchmark, altijd de beste knop', pct(bStr), pctSd(bStr), (100 * bStr.min).toFixed(0) + '–' + (100 * bStr.max).toFixed(0) + '%']
    ] : []).concat([
      ['stappen bij een geslaagde poging', num(st, 0), st.sd.toFixed(0), st.min.toFixed(0) + '–' + st.max.toFixed(0)],
      ['rekentijd per run (s)', num(tm, 1), tm.sd.toFixed(1), tm.min.toFixed(0) + '–' + tm.max.toFixed(0)]
    ]),
    [3000, 2100, 1800, 2172]
  ));
  C.push(gap(60));
  C.push(body([
    t('Het verschil tussen de laatste twintig trainingspogingen ('), bd(pct(s20)),
    t(') en ' + (heeftB ? 'de benchmarkset (' : 'de toets op werelden die het netwerk nooit gezien heeft (')),
    bd(heeftB ? pct(bBel) : pct(ev)),
    t(') is ' + (100 * (s20.m - (heeftB ? bBel.m : ev.m))).toFixed(1) + ' procentpunt. Dat gat is de kern van de ' +
      'vraag waaruit dit werk voortkomt. Het is klein genoeg om te concluderen dat er navigatiegedrag geleerd is ' +
      'en niet louter een route onthouden, en groot genoeg om te laten zien dat het onthouden meespeelt. De sd ' +
      'van ' + pctSd(s20) + ' op de trainingsscore is bovendien het getal dat bepaalt hoeveel zaden een latere ' +
      'vergelijking nodig heeft: met deze spreiding is een verschil van tien procentpunt pas boven de ruis bij ' +
      'ruwweg zestien runs per conditie.')
  ]));
  if (heeftB && BENCH && BENCH.ijkpunten) {
    C.push(body([
      bd('Ten opzichte van de ijkpunten. '),
      t('Het netwerk haalt op de benchmark ' + (100 * bBel.m).toFixed(1) + '%, de reactieve agent ' +
        (100 * BENCH.ijkpunten.reactief.pct).toFixed(1) + '% en een willekeurig beleid ' +
        (100 * BENCH.ijkpunten.willekeurig.pct).toFixed(1) + '%. De marge op de reactieve ondergrens is ' +
        (100 * (bBel.m - BENCH.ijkpunten.reactief.pct)).toFixed(0) + ' procentpunt, ruim buiten beide ' +
        'intervallen. Wat het netwerk leert, is dus meer dan "naar het doel toe en van muren weg" — maar ' +
        'daarmee is nog niets gezegd over de vraag of de graafstructuur daaraan bijdraagt of alleen de ' +
        'leerregel; dat is wat de ablaties en de gelaagde basislijn moeten uitwijzen.'),
    ]));
    C.push(body([
      bd('Twee onzekerheden, uit elkaar gehouden. '),
      t('Het interval van ± ' + (100 * bBel.ci).toFixed(1) + ' procentpunt hierboven gaat over de zaden: het ' +
        'zegt hoe goed dit récept is. Binnen één run is de onzekerheid over de werelden ± ' +
        (100 * bCI.m).toFixed(1) + ' procentpunt: dat zegt hoe goed dít brein is. De eerste is de grootheid ' +
        'waarmee condities vergeleken worden; de tweede is de reden dat er vijfhonderd werelden nodig waren.')
    ]));
  }
  C.push(h3('De structuur die eruit komt'));
  C.push(body(
    'Dezelfde runs, nu afgelezen met de maten uit sectie 6. Deze tabel is niet illustratief maar de nulmeting ' +
    'waartegen sectie 6 in een volgende versie op prestatie gecorreleerd wordt.'
  ));
  C.push(tbl(
    ['structuurmaat', 'gemiddelde ± 95%', 'bereik'],
    [
      ['neuronen aan het eind', num(nu, 0), nu.min + '–' + nu.max],
      ['meedoende neuronen', num(mn, 0), mn.min + '–' + mn.max],
      ['verbindingen', num(cn, 0), cn.min + '–' + cn.max],
      ['actieve verbindingen', num(ac, 0), ac.min + '–' + ac.max],
      ['kortste pad zintuig → knop', num(pd, 2), pd.min + '–' + pd.max],
      ['terugkoppellussen', num(lp, 1), lp.min + '–' + lp.max],
      ['werkende reflexbogen', num(rf, 1), rf.min + '–' + rf.max]
    ],
    [3400, 2400, 3272]
  ));
  C.push(gap(60));
  C.push(body(
    'Twee dingen vallen op. Het kortste pad is bij vrijwel elke run ' + pd.m.toFixed(0) + ': het netwerk bouwt een ' +
    'directe verbinding van zintuig naar knop en houdt die, ondanks dat er niets in de leerregel is dat korte paden ' +
    'beloont. En het aantal reflexbogen loopt van ' + rf.min + ' tot ' + rf.max +
    ' — een spreiding die groter is dan het gemiddelde. Reflexbogen ontstaan dus wel, maar niet betrouwbaar; of ze ' +
    'iets bijdragen is precies wat de ablatie zonder reflex-neuronen moet uitwijzen.'
  ));
}

/* --- 10.4: basislijnen binnen dezelfde leerregel ---------------------------
   Volledig uit experimenten/basislijnen.json. De tekst hieronder leest de
   uitkomst en zegt wat er staat, ook als dat tegen het model pleit. */
if (BASIS && BASIS.tabel) {
  const T = BASIS.tabel, TS = BASIS.toetsen.filter(Boolean);
  const naam = { 'ang-vol': 'ANG, wolk met plasticiteit', 'ang-vast': 'ANG, wolk met bevroren structuur',
    'gelaagd-1x150': 'gelaagd, 1 × 150', 'gelaagd-2x46': 'gelaagd, 2 × 46', 'gelaagd-1x60': 'gelaagd, 1 × 60' };
  const vs = (a, b) => TS.find(t => t.tegen === a && t.conditie === b);
  C.push(h2('10.4', 'Basislijnen binnen dezelfde leerregel'));
  C.push(body(
    'De referentiemeting zegt dat het netwerk leert, niet waaraan dat ligt. De leerregel van sectie 3 vraagt ' +
    'nergens om een graaf: zij werkt op elke topologie waarop de knoop-update van vergelijking 4 gedefinieerd ' +
    'is. Het is dus goed mogelijk dat de leerregel al het werk doet en de structuur er niets aan toevoegt. Om ' +
    'dat uit elkaar te trekken zijn vier condities gedraaid die alles delen behalve de bedrading: dezelfde ' +
    'knoop-update, dezelfde node-perturbatie, dezelfde sporen, basislijn, begrensde stap en vervaging, dezelfde ' +
    'wereldzaden, dezelfde ' + BASIS.zaden + ' breinzaden en dezelfde benchmarkset.'
  ));
  C.push(bullet([bd('ANG met plasticiteit. '), t('De wolk zoals sectie 2 en 4 haar beschrijven.')]));
  C.push(bullet([bd('ANG met bevroren structuur. '), t('Dezelfde beginwolk, maar snoeien, aangroei, groei en ' +
    'soortverandering staan uit. Het verschil met de vorige conditie is precies wat de structurele ' +
    'plasticiteit oplevert.')]));
  C.push(bullet([bd('Gelaagd, één verborgen laag van 150. '), t('Een vaste stapel lagen met hetzelfde ' +
    'parameterbudget (' + Math.round(T['gelaagd-1x150'].verbindingen.m) + ' verbindingen tegen ' +
    Math.round(T['ang-vol'].verbindingen.m) + '), alle verborgen knopen workers, geen terugkoppeling. Het ' +
    'kortste pad zintuig → knop is twee bogen, net als bij de wolk. Het verschil met de bevroren wolk is ' +
    'precies wat de topologie oplevert, want beide staan vast.')]));
  C.push(bullet([bd('Gelaagd, twee lagen van 46. '), t('Hetzelfde budget, maar een boog langer. Bij ' +
    'propagatiediepte één kost dat letterlijk één tijdstap extra tussen prikkel en actie.')]));
  C.push(bullet([bd('Gelaagd, één laag van 60. '), t('Evenveel neuronen als de wolk aan het begin, en daarmee ' +
    'nog geen half zo veel gewichten (' + Math.round(T['gelaagd-1x60'].verbindingen.m) + ').')]));
  C.push(tbl(
    ['conditie', 'benchmark, geloot', 'benchmark, argmax', 'laatste 20', 'verb.', 'pad', 'stappen', 'tijd'],
    [['willekeurig beleid', (100 * BASIS.vasteBeleidsvormen.willekeurig.pct).toFixed(1) + '%', '—', '—', '—', '—', '—', '—'],
     ['reactieve agent', (100 * BASIS.vasteBeleidsvormen.reactief.pct).toFixed(1) + '% ± ' +
       (100 * BASIS.vasteBeleidsvormen.reactief.ci).toFixed(1), '—', '—', '—', '—', '—', '—']]
      .concat(Object.keys(T).map(k => [naam[k] || k, pct(T[k].benchBeleid), pct(T[k].benchStreng),
        pct(T[k].succes20), String(Math.round(T[k].verbindingen.m)), T[k].pad.m.toFixed(2),
        T[k].benchStappen.m.toFixed(0), (T[k].tijdMs.m / 1000).toFixed(1) + ' s'])),
    [2500, 1500, 1500, 1300, 800, 600, 800, 672]
  ));
  C.push(gap(60));
  const pl = vs('ang-vol', 'ang-vast'), top = vs('ang-vast', 'gelaagd-1x150'),
        diep = vs('ang-vast', 'gelaagd-2x46'), klein = vs('ang-vast', 'gelaagd-1x60');
  const pTekst = o => o ? (o.p < 0.001 ? 'p < 0,001' : 'p = ' + o.p.toFixed(3)) : '';
  C.push(h3('Wat de structuur oplevert: op deze taak niets'));
  C.push(body([
    bd('Het gelaagde netwerk doet het even goed als de wolk. '),
    t('Met hetzelfde parameterbudget en hetzelfde kortste pad haalt het ' + pct(T['gelaagd-1x150'].benchBeleid) +
      ' tegen ' + pct(T['ang-vast'].benchBeleid) + ' voor de bevroren wolk — ' +
      (top ? (top.verschilPp >= 0 ? '+' : '') + top.verschilPp.toFixed(1) + ' procentpunt, ' + pTekst(top) +
        ', ' + top.oordeel : '') + '. Ook een laag van zestig knopen, met minder dan de helft van de gewichten, ' +
      'komt op ' + pct(T['gelaagd-1x60'].benchBeleid) + '. Op deze taak voegt de graafstructuur dus niets toe ' +
      'aan wat de leerregel al doet, en het parameterbudget doet er nauwelijks toe.')
  ]));
  C.push(body([
    bd('En de structurele plasticiteit evenmin. '),
    t('Snoeien, aangroei, neuronale groei en soortverandering samen uitzetten kost ' +
      (pl ? (pl.verschilPp >= 0 ? 'niets — de bevroren wolk scoort zelfs ' + pl.verschilPp.toFixed(1) +
        ' procentpunt hoger (' + pTekst(pl) + ', ' + pl.oordeel + ')'
        : Math.abs(pl.verschilPp).toFixed(1) + ' procentpunt (' + pTekst(pl) + ', ' + pl.oordeel + ')') : '') +
      '. Het mechanisme dat het model zijn naam geeft, is op deze omgeving dus niet aantoonbaar nuttig — het ' +
      'kost wel rekentijd (' + (T['ang-vol'].tijdMs.m / 1000).toFixed(1) + ' s tegen ' +
      (T['ang-vast'].tijdMs.m / 1000).toFixed(1) + ' s per run) en het vergroot de spreiding tussen zaden ' +
      '(± ' + (100 * T['ang-vol'].benchBeleid.ci).toFixed(1) + ' tegen ± ' +
      (100 * T['ang-vast'].benchBeleid.ci).toFixed(1) + '). Deze meting zegt alleen dat het geheel niets oplevert; ' +
      (ABLATIE ? 'sectie 10.7 splitst dat uit naar de afzonderlijke mechanismen.'
        : 'sectie 10.8 kondigt de ablatiereeks aan die dat uitsplitst naar de afzonderlijke mechanismen.'))
  ]));
  C.push(h3('Wat wél meetbaar is: padlengte'));
  C.push(body([
    t('Eén structureel verschil komt er wel doorheen. Twee lagen van 46 hebben hetzelfde budget als één laag ' +
      'van 150, maar een boog meer tussen zintuig en knop, en scoren ' + pct(T['gelaagd-2x46'].benchBeleid) +
      ' — ' + (diep ? Math.abs(diep.verschilPp).toFixed(1) + ' procentpunt onder de bevroren wolk, ' +
        pTekst(diep) + ', ' + diep.oordeel : '') + '. Dat is de enige conditie in deze tabel waar het verschil ' +
      'boven de ruis uitkomt. Bij propagatiediepte één is een boog een tijdstap, dus dit is geen verschil in ' +
      'capaciteit maar in '), it('reactietijd'),
    t(': het netwerk reageert een tik later op wat het ziet, en dat kost succes. Precies dat is de eigenschap ' +
      'waarop sectie ' + SEC_VRAAG + ' de resterende onderzoeksvraag baseert — maar zij pleit hier evengoed voor een ondiep ' +
      'gelaagd netwerk als voor een graaf.')
  ]));
  C.push(body([
    bd('De eerlijke samenvatting. '),
    t('Alles boven de reactieve ondergrens van ' + (100 * BASIS.vasteBeleidsvormen.reactief.pct).toFixed(1) +
      '% is op deze taak toe te schrijven aan de leerregel, niet aan de graaf. Wie wil laten zien dat een ' +
      'zichzelf herstructurerende topologie iets toevoegt, heeft een omgeving nodig waarin verschillende ' +
      'informatielatenties werkelijk nodig zijn; in een taak waarin het doel altijd zichtbaar is en één ' +
      'tussenlaag volstaat, is er niets te herstructureren dat de moeite loont. Dat is de aanleiding voor de ' +
      'tweede taak in sectie ' + (TAAKAS ? '10.8' : SEC_HIERNA) + ', en het is de reden dat de vraagstelling in ' +
      'sectie ' + SEC_VRAAG + ' smaller is dan waar dit werk mee begon.')
  ]));
  C.push(gap(60));
}

/* --- 10.5: wat de schatter waard is, en wat het rekenwerk kost ----------------
   Volledig uit experimenten/rekenkosten.json. Sectie 10.4 vergeleek topologieën
   binnen één leerregel; deze sectie vergelijkt leerregels binnen één topologie.
   Dat zijn twee verschillende vragen en ze hebben allebei hun eigen tabel. */
if (REKEN && REKEN.tabel) {
  const R = REKEN.tabel, RS = (REKEN.toetsen || []).filter(Boolean);
  const rn = {
    'ang-vol': 'ANG, de wolk', 'mlp-16-perturb': 'MLP 16-16-4, perturbatie',
    'mlp-16-bp': 'MLP 16-16-4, backprop', 'mlp-32-32-perturb': 'MLP 16-32-32-4, perturbatie',
    'mlp-32-32-bp': 'MLP 16-32-32-4, backprop', 'elman-16-perturb': 'Elman-16, perturbatie',
    'elman-16-bp': 'Elman-16, backprop', 'mlp-16-perturb-p1': 'MLP 16-16-4, perturbatie, diepte 1'
  };
  const rvs = (a, b, m) => RS.find(t => t.tegen === a && t.conditie === b && t.maat === m);
  const pT = o => o ? (o.p < 0.001 ? 'p < 0,001' : 'p = ' + o.p.toFixed(3)) : '';
  /* kanten-bezoeken lopen in de miljoenen; rauwe getallen leest niemand */
  const kort = v => (v === null || v === undefined || !isFinite(v)) ? '–'
    : v >= 1e9 ? (v / 1e9).toFixed(1) + ' G' : v >= 1e6 ? (v / 1e6).toFixed(1) + ' M'
      : v >= 1e3 ? (v / 1e3).toFixed(1) + ' k' : String(Math.round(v));
  const kk = (n, k) => (R[n] && R[n][k]) ? kort(R[n][k].m) : '–';
  const namenR = Object.keys(rn).filter(k => R[k]);
  const PAREN = [['mlp-16-perturb', 'mlp-16-bp', 'MLP 16-16-4'],
    ['mlp-32-32-perturb', 'mlp-32-32-bp', 'MLP 16-32-32-4'],
    ['elman-16-perturb', 'elman-16-bp', 'Elman-16']].filter(([a, b]) => R[a] && R[b]);

  C.push(h2('10.5', 'Wat de schatter waard is, en wat het rekenwerk kost'));
  C.push(body(
    'Sectie 10.4 hield de leerregel vast en varieerde de topologie. Deze sectie doet het omgekeerde: dezelfde ' +
    'topologie, dezelfde spelregels, dezelfde ' + REKEN.zaden + ' breinzaden en dezelfde benchmarkset, maar het ' +
    'verborgen leersignaal komt één keer uit node-perturbatie en één keer uit terugpropagatie. Alles daaromheen ' +
    'is gelijk gehouden: hetzelfde spoor met dezelfde λ, dezelfde lopende basislijn, dezelfde begrensde stap, ' +
    'dezelfde vervaging per poging, dezelfde Bernoulli-knoppen en dezelfde beloningen. Ook het startnetwerk is ' +
    'bit voor bit hetzelfde. Wat overblijft is de schatter, en dat is precies de vraag die de vergelijking met ' +
    'backpropagation hoort te beantwoorden.'
  ));
  C.push(body([
    t('Twee dingen maken de vergelijking pas eerlijk. Ten eerste draait elke conditie op '), it('haar eigen'),
    t(' leersnelheid: de exacte gradiënt heeft een andere grootte dan een perturbatieschatting, en ANG’s 0,008 ' +
      'is met de hand op ANG afgesteld. Zes leersnelheden, vier breinzaden per leersnelheid, gekozen op de ' +
      'goedkope toets van twintig werelden — nooit op de benchmarkset, want die is de meetlat en mag geen ' +
      'instellingen kiezen. De veegzaden liggen bovendien buiten de zaden waarop gemeten wordt, zodat de keuze ' +
      'niet de eigen ruis terugmeet. Ten tweede rekent elk gelaagd net zijn uitvoer binnen één spelstap uit ' +
      '(propagatiediepte gelijk aan zijn diepte), zodat de reactielatentie die in sectie 10.4 vijf procentpunt ' +
      'kostte hier geen rol speelt; de laatste regel van de tabel is de controle die dat nameet.')
  ]));
  if (R['ang-vol'] && R['ang-vol'].lr !== 0.008) C.push(body([
    bd('Eén gevolg daarvan meteen. '),
    t('Dezelfde veeg is ook op ANG zelf losgelaten, en die kwam niet uit op de met de hand afgestelde 0,008 ' +
      'maar op ' + String(R['ang-vol'].lr).replace('.', ',') + '. Op de goedkope toets scheelde dat ' +
      ((100 * (REKEN.leersnelheidVeeg['ang-vol'].toets -
        (REKEN.leersnelheidVeeg['ang-vol'].perLeersnelheid.find(x => x.lr === 0.008) || { toets: 0 }).toets)).toFixed(0)) +
      ' procentpunt over vier zaden — ruim binnen de ruis, dus dit is geen ontdekking maar een gevolg van ' +
      'argmax over zes waarden. Het staat hier omdat de ANG-regel in deze tabel daardoor op een andere ' +
      'leersnelheid draait dan die in sectie 10.3 en 10.4, en dat mag een lezer niet hoeven raden.')
  ]));
  C.push(tbl(
    ['conditie', 'η', 'benchmark, geloot', 'benchmark, argmax', 'laatste 20', 'gewichten'],
    namenR.map(k => [rn[k], String(R[k].lr).replace('.', ','), pct(R[k].benchBeleid), pct(R[k].benchStreng),
      pct(R[k].succes20), String(Math.round(R[k].verbindingen.m))]),
    [3000, 700, 1600, 1600, 1400, 1172]
  ));
  C.push(gap(60));
  C.push(h3('Wat levert een exacte gradiënt op?'));
  for (const [a, b, lab] of PAREN) {
    const tb = rvs(a, b, 'benchBeleid'), ts = rvs(a, b, 'stappenTot80');
    C.push(bullet([bd(lab + '. '),
      t(pct(R[a].benchBeleid) + ' met node-perturbatie tegen ' + pct(R[b].benchBeleid) + ' met de exacte ' +
        'gradiënt' + (tb ? ' — ' + (tb.verschilPp >= 0 ? '+' : '') + tb.verschilPp.toFixed(1) +
          ' procentpunt, ' + pT(tb) + ', ' + tb.oordeel : '') + '. Omgevingsstappen tot 80 % succes: ' +
        kk(a, 'stappenTot80') + ' tegen ' + kk(b, 'stappenTot80') +
        (ts ? ' (' + pT(ts) + ', ' + ts.oordeel + ')' : '') + '.')]));
  }
  {
    const echt = PAREN.filter(([a, b]) => { const o = rvs(a, b, 'benchBeleid'); return o && o.p < 0.05; });
    const beter = echt.filter(([a, b]) => rvs(a, b, 'benchBeleid').verschilPp > 0);
    C.push(body([
      bd('Samengevat. '),
      t(echt.length === 0
        ? 'Op geen van de drie netten komt het verschil tussen de twee schatters boven de ruis uit. Dat is een ' +
          'sterker resultaat voor node-perturbatie dan verwacht: op deze taak levert de exacte gradiënt geen ' +
          'meetbaar betere score op, terwijl zij per definitie meer informatie gebruikt. Dat pleit niet voor de ' +
          'schatter maar tegen de taak — met vier binaire knoppen, zestien zintuigen en één zinvolle tussenlaag ' +
          'is het aantal richtingen waarin een netwerk fout kan zitten klein genoeg dat ruis er doorheen komt.'
        : beter.length === echt.length
          ? 'Op ' + echt.length + ' van de ' + PAREN.length + ' netten scoort de exacte gradiënt aantoonbaar ' +
            'beter. Dat is wat er wordt opgegeven door geen backpropagation te gebruiken, uitgedrukt in de enige ' +
            'eenheid die telt: gedrag op onbekende werelden. Het kost wel een leerregel die niet meer lokaal is.'
          : 'Het beeld is gemengd: op ' + echt.length + ' van de ' + PAREN.length + ' netten is het verschil ' +
            'aantoonbaar, en niet steeds in dezelfde richting. Dat is zelf een resultaat — het betekent dat de ' +
            'keuze van de schatter op deze taak minder uitmaakt dan de keuze van het netwerk.')
    ]));
  }
  {
    /* Hoeveel runs haalden de drempel überhaupt? Bij een conditie die hem vaak mist
       gaat het gemiddelde alleen over de runs die hem wél haalden, en dat vleit. */
    const mist = namenR.filter(k => R[k].haalde80 < R[k].runs);
    if (mist.length) C.push(body([
      bd('Een detail dat de tabel hieronder vleit. '),
      t('De drempel van 80 % wordt niet door elke run gehaald: ' +
        mist.map(k => rn[k] + ' ' + R[k].haalde80 + ' van ' + R[k].runs).join(', ') +
        '. De kolommen “tot 80 %” gemiddelden dus alleen over de runs die de drempel bereikten, wat de ' +
        'condities die hem vaak missen gunstiger laat lijken dan zij zijn. Dat zijn zonder uitzondering de ' +
        'perturbatiecondities; het aantal staat er daarom bij.')
    ]));
  }
  if (BASIS && BASIS.tabel && BASIS.tabel['gelaagd-1x150'] && R['mlp-16-bp'] && R['mlp-16-perturb']) {
    const g150 = BASIS.tabel['gelaagd-1x150'];
    C.push(body([
      bd('Hoeveel gewichten kost het missen van backpropagation? '),
      t('Deze tabel en die van sectie 10.4 laten zich naast elkaar leggen, want zij delen de benchmarkset. ' +
        'Met node-perturbatie haalt een verborgen laag van zestien knopen ' + pct(R['mlp-16-perturb'].benchBeleid) +
        ', terwijl dezelfde leerregel op een laag van honderdvijftig — ' + Math.round(g150.verbindingen.m) +
        ' gewichten in plaats van ' + Math.round(R['mlp-16-perturb'].verbindingen.m) + ' — op ' +
        pct(g150.benchBeleid) + ' komt. Met terugpropagatie zijn die zestien knopen genoeg: ' +
        pct(R['mlp-16-bp'].benchBeleid) + ' bij ' + Math.round(R['mlp-16-bp'].verbindingen.m) + ' gewichten. ' +
        'Node-perturbatie heeft op deze taak dus ruwweg een orde van grootte meer parameters nodig om te halen ' +
        'wat een exacte gradiënt met een tiende daarvan haalt. Dat is een scherpere formulering van wat er ' +
        'wordt opgegeven dan een verschil in eindscore: niet zozeer het gedrag, maar de prijs in capaciteit.')
    ]));
  }
  C.push(h3('Vier dingen die allemaal “efficiëntie” heten'));
  C.push(body(
    'De rest van dit werk sprak over efficiëntie zonder haar te tellen. Hieronder staan de vier grootheden die ' +
    'die naam dragen, apart. De eenheid is één kanten-bezoek: één keer een gewicht aanraken, bij het doorrekenen ' +
    'of bij het bijwerken. Een netwerk dat meer werk nodig heeft om te leren maar daarna goedkoper draait is een ' +
    'interessant resultaat — maar alleen als die kolommen los van elkaar gerapporteerd worden.'
  ));
  C.push(tbl(
    ['conditie', 'kanten per lerende stap', 'kanten per inferentiestap', 'omgevingsstappen tot 80 %',
      'kanten tot 80 %', 'actieve verb.', 'tijd'],
    namenR.map(k => [rn[k], kk(k, 'kbLeerStap'), kk(k, 'kbInfStap'),
      kk(k, 'stappenTot80') + (R[k].haalde80 === R[k].runs ? '' : ' (' + R[k].haalde80 + '/' + R[k].runs + ')'),
      kk(k, 'kbTot80'), String(Math.round(R[k].actief.m)), (R[k].tijdMs.m / 1000).toFixed(1) + ' s']),
    [2400, 1300, 1300, 1400, 1100, 1000, 972]
  ));
  C.push(gap(60));
  {
    /* de goedkoopste conditie die het niet aantoonbaar slechter doet dan ANG */
    const angB = R['ang-vol'] ? R['ang-vol'].benchBeleid.m : null;
    const kand = namenR.filter(k => k !== 'ang-vol' && R[k].kbTot80 && R['ang-vol'])
      .filter(k => { const o = rvs('ang-vol', k, 'benchBeleid'); return !o || o.p >= 0.05 || o.verschilPp > 0; })
      .sort((a, b) => R[a].kbTot80.m - R[b].kbTot80.m);
    const goedkoopst = kand[0];
    C.push(body([
      bd('De rekening. '),
      t('ANG heeft ' + kk('ang-vol', 'kbLeerStap') + ' kanten-bezoeken nodig per lerende spelstap en ' +
        kk('ang-vol', 'kbInfStap') + ' per inferentiestap, en komt op ' + kk('ang-vol', 'kbTot80') +
        ' kanten-bezoeken voordat het lopende succes de 80 % raakt. ' +
        (goedkoopst ? rn[goedkoopst] + ' doet dat met ' + kk(goedkoopst, 'kbTot80') + ' — een factor ' +
          (R['ang-vol'].kbTot80.m / R[goedkoopst].kbTot80.m).toFixed(1) + ' goedkoper — bij ' +
          (rvs('ang-vol', goedkoopst, 'benchBeleid') && rvs('ang-vol', goedkoopst, 'benchBeleid').p < 0.05
            ? 'een hógere benchmarkscore' : 'een score die binnen de ruis gelijk is') + ' (' +
          pct(R[goedkoopst].benchBeleid) + ' tegen ' + pct(R['ang-vol'].benchBeleid) + '). ' : '') +
        'De hypothese dat een klein vast netwerk op deze taak op rekenkosten wint, is daarmee gemeten in plaats ' +
        'van vermoed, en zij komt uit. Dat is geen mislukking van het model maar een afbakening van waar het ' +
        'thuishoort: sectie ' + SEC_VRAAG + ' trekt die conclusie door naar de onderzoeksvraag zelf.')
    ]));
  }
  {
    const lat = rvs('mlp-16-perturb-p1', 'mlp-16-perturb', 'benchBeleid');
    if (lat) C.push(body([
      bd('De controle op de reactielatentie. '),
      t('Hetzelfde net op propagatiediepte 1 in plaats van 2 — dus met één tijdstap vertraging tussen prikkel ' +
        'en knop, zoals de gelaagde condities in sectie 10.4 die hadden — haalt ' +
        pct(R['mlp-16-perturb-p1'].benchBeleid) + ' tegen ' + pct(R['mlp-16-perturb'].benchBeleid) + ' (' +
        (lat.verschilPp >= 0 ? '+' : '') + lat.verschilPp.toFixed(1) + ' procentpunt, ' + pT(lat) + ', ' +
        lat.oordeel + '). ' + (lat.p < 0.05
          ? 'De latentie doet er dus werkelijk toe, en de keuze om elk gelaagd net binnen één spelstap te laten ' +
            'rekenen was nodig om de schatter te kunnen isoleren.'
          : 'De latentie verklaart hier dus niets van het verschil tussen de schatters; de vergelijking hierboven ' +
            'staat op zichzelf.'))
    ]));
    if (REKEN.ijkTegenStap4 && REKEN.ijkTegenStap4.vergeleken)
      C.push(body([
        bd('IJk op de eerdere reeks. '),
        t('De ANG-conditie is voor deze tabel opnieuw gedraaid en reproduceert ' +
          REKEN.ijkTegenStap4.identiek + ' van de ' + REKEN.ijkTegenStap4.vergeleken +
          ' runs uit de referentiemeting van sectie 10.3 bit voor bit. Het instrumenteren van de rekenkosten ' +
          'en het inbouwen van de tweede schatter hebben het gedrag van ANG dus niet geraakt.')
      ]));
  }
  C.push(gap(60));
}

/* --- 10.6: vier ingrepen in de leerregel zelf --------------------------------
   Volledig uit experimenten/leerregel.json. 10.4 varieerde de topologie binnen één
   leerregel, 10.5 de schatter binnen één topologie; deze sectie laat allebei staan
   en verandert de leerregel eromheen. Ook hier geldt: de tekst leest de uitkomst en
   zegt wat er staat, ook als er niets uitkomt — een leerregel die niet beter wordt
   van een criticus is een bevinding over die leerregel. */
if (LEERREGEL && LEERREGEL.tabel) {
  const L = LEERREGEL.tabel, LS = (LEERREGEL.toetsen || []).filter(Boolean);
  const SP = LEERREGEL.spreiding || {};
  const ln = {
    's7-huidig': 'de regel van sectie 3',
    's7-criticus': '+ criticus (TD(0))',
    's7-schaars': '+ schaarse perturbatie (¼)',
    's7-criticus-schaars': '+ criticus + schaars',
    's7-categorisch': '+ categorisch beleid (9 acties)',
    's7-perturbgain': '+ perturbGain (g = 10)'
  };
  const lvs = (a, b, m) => LS.find(x => x.tegen === a && x.conditie === b && x.maat === m);
  const pT = o => o ? (o.p < 0.001 ? 'p < 0,001' : 'p = ' + o.p.toFixed(3)) : '';
  const kort = v => (v === null || v === undefined || !isFinite(v)) ? '–'
    : v >= 1e9 ? (v / 1e9).toFixed(1) + ' G' : v >= 1e6 ? (v / 1e6).toFixed(1) + ' M'
      : v >= 1e3 ? (v / 1e3).toFixed(1) + ' k' : String(Math.round(v));
  const namenL = Object.keys(ln).filter(k => L[k]);
  const varianten = namenL.filter(k => k !== 's7-huidig');
  const REF = L['s7-huidig'];

  C.push(h2('10.6', 'Vier ingrepen in de leerregel zelf'));
  C.push(body(
    'Sectie 10.4 hield de leerregel vast en varieerde de topologie; sectie 10.5 hield de topologie vast en ' +
    'varieerde de schatter. Deze sectie laat allebei staan — de wolk zoals zij is, node-perturbatie zoals zij is ' +
    '— en verandert alleen wat er omheen zit. Vier ingrepen, elk klein, elk apart aan en uit te zetten, elk op ' +
    LEERREGEL.zaden + ' breinzaden en dezelfde benchmarkset van ' + LEERREGEL.benchmark.werelden + ' werelden.'
  ));
  C.push(bullet([bd('Een toestandsafhankelijke criticus. '), t('De basislijn in vergelijking 12 is één lopend ' +
    'gemiddelde over spelstappen: een getal zonder toestand. In een toestand die van zichzelf al slechter is dan ' +
    'gemiddeld ligt de beloning structureel onder die basislijn, en wordt dus élke actie daar afgestraft — ook ' +
    'de juiste. Daar staat hier een lineaire schatter V(s) = w·s + b tegenover, op dezelfde zestien sensoren die ' +
    'het netwerk ziet, getraind met TD(0); het leersignaal wordt r + γV(s′) − V(s). De schatter staat náást de ' +
    'graaf: er wordt niets door het netwerk teruggepropageerd, en de leerregel voor de verbindingen blijft woord ' +
    'voor woord die van sectie 3.')]));
  C.push(bullet([bd('Schaarse perturbatie. '), t('De variantie van node-perturbatie groeit met het aantal knopen ' +
    'dat tegelijk verstoord wordt. Per tik wordt daarom nog maar een kwart van de wolk verstoord; de rest krijgt ' +
    'die tik exact nul afwijking en dus geen spoor.')]));
  C.push(bullet([bd('Een categorisch beleid. '), t('De vier knoppen zijn onafhankelijke Bernoulli’s, waardoor ' +
    'acties bestaan die zichzelf opheffen: op+neer, links+rechts, alle vier. Daar staat één softmax over negen ' +
    'elkaar uitsluitende acties tegenover — acht richtingen plus stilstaan — gescoord met de som van de ' +
    'knopingangen die bij die actie horen. Dat houdt de score-functie in dezelfde vorm, (1[ingedrukt] − ' +
    'randkans)/τ, en houdt het aantal uitvoerknopen op vier, zodat de conditie vergelijkbaar blijft met de rest ' +
    'van dit document.')]));
  C.push(bullet([bd('De ontbrekende normalisatie. '), t('Sectie 3.11 laat zien dat het wolkdeel van de update ' +
    'twee ordes te klein is ten opzichte van het knopdeel, en dat de standaardformulering van node-perturbatie ' +
    'daar een factor 1/Var(ξ) heeft die ANG mist. In 3.11 is die factor los bijgezet en stortte het leren in — ' +
    'maar zonder dat de leersnelheid opnieuw was afgesteld, terwijl η en die factor per constructie samenhangen. ' +
    'Hier krijgt g = 10 wel zijn eigen leersnelheidsveeg, over een raster dat met 1/g meeschuift.')]));
  C.push(body([
    t('Zoals in sectie 10.5 draait elke conditie op '), it('haar eigen'),
    t(' leersnelheid: zes waarden, vier breinzaden per waarde, gekozen op de goedkope toets van twintig ' +
      'werelden en nooit op de benchmarkset, met veegzaden buiten de meetzaden. Alle vier de ingrepen raken ' +
      'precies de grootheid waar η op afgesteld is — de schaal van het leersignaal, het aantal gewichten dat ' +
      'per tik een duw krijgt, of de vorm van de score-functie — dus zonder die veeg zou de tabel het ' +
      'afstellen meten in plaats van de ingreep.')
  ]));
  C.push(tbl(
    ['conditie', 'η', 'benchmark, geloot', 'benchmark, argmax', 'sd tussen zaden', 'stappen tot 80 %'],
    namenL.map(k => [ln[k], String(L[k].lr).replace('.', ','), pct(L[k].benchBeleid), pct(L[k].benchStreng),
      SP[k] && SP[k].sd !== null ? (100 * SP[k].sd).toFixed(1) + ' pp' : '–',
      kort(L[k].stappenTot80 ? L[k].stappenTot80.m : null) +
      (L[k].haalde80 === L[k].runs ? '' : ' (' + L[k].haalde80 + '/' + L[k].runs + ')')]),
    [3100, 800, 1600, 1600, 1300, 1172]
  ));
  C.push(body([it('Stappen tot 80 %'), t(' is het aantal omgevingsstappen dat nodig was voordat het succes over ' +
    'de laatste twintig pogingen voor het eerst boven 80 % kwam: de maat voor hoe zuinig een leerregel met ' +
    'ervaring omgaat, los van waar zij uiteindelijk uitkomt. Waar een conditie die drempel niet in elke run ' +
    'haalt, staat tussen haakjes hoeveel runs hem wél haalden — het gemiddelde gaat alleen over die runs en ' +
    'vleit de conditie dus. De drempel telt pas zodra er werkelijk twintig pogingen achter dat gemiddelde ' +
    'zitten; zonder die eis is het aan het begin van een run een gemiddelde over één of twee pogingen, en ' +
    'kreeg een run waarvan de allereerste poging toevallig slaagde "de drempel gehaald na één poging". Dat ' +
    'gebeurde in 35 van de 256 runs en niet gelijk verdeeld over de condities. De maat is voor alle metingen ' +
    'in dit document opnieuw uit de bewaarde historie afgeleid, zonder iets opnieuw te trainen.')]));
  C.push(gap(60));
  {
    const echt = varianten.map(k => lvs('s7-huidig', k, 'benchBeleid')).filter(o => o && o.p < 0.05);
    const beter = echt.filter(o => o.verschilPp > 0), slechter = echt.filter(o => o.verschilPp <= 0);
    C.push(h3('Wat de ingrepen opleveren'));
    for (const k of varianten) {
      const tb = lvs('s7-huidig', k, 'benchBeleid'), ts = lvs('s7-huidig', k, 'stappenTot80');
      C.push(bullet([bd(ln[k].replace(/^\+ /, '').replace(/^./, c => c.toUpperCase()) + '. '),
        t(pct(L[k].benchBeleid) + ' tegen ' + pct(REF.benchBeleid) + ' voor de ongewijzigde regel' +
          (tb ? ' — ' + (tb.verschilPp >= 0 ? '+' : '−') + Math.abs(tb.verschilPp).toFixed(1) +
            ' procentpunt, ' + pT(tb) + ', ' + tb.oordeel : '') +
          '. Spreiding tussen de zaden ' + (SP[k] && SP[k].sd !== null ? (100 * SP[k].sd).toFixed(1) : '–') +
          ' pp tegen ' + (SP['s7-huidig'] && SP['s7-huidig'].sd !== null ? (100 * SP['s7-huidig'].sd).toFixed(1) : '–') +
          ' pp; omgevingsstappen tot 80 % succes ' + kort(L[k].stappenTot80 ? L[k].stappenTot80.m : null) +
          ' tegen ' + kort(REF.stappenTot80 ? REF.stappenTot80.m : null) +
          (ts ? ' (' + pT(ts) + ', ' + ts.oordeel + ')' : '') + '.')]));
    }
    C.push(body([
      bd('Op de eindscore verandert er weinig. '),
      t((beter.length ? 'Van de vier ingrepen tilt ' + (beter.length === 1 ? 'er één' : 'tillen er ' + beter.length) +
          ' de gelote benchmarkscore boven de ruis uit: ' +
          beter.map(o => ln[o.conditie].replace(/^\+ /, '')).join(', ') + '. ' : '') +
        (slechter.length ? (beter.length ? 'Daar staat tegenover dat ' : 'Wat er op die maat boven de ruis uitkomt is dat ') +
          slechter.map(o => ln[o.conditie].replace(/^\+ /, '')).join(' en ') +
          ' de score aantoonbaar verláágt. ' : '') +
        'De overige verschillen vallen binnen de meetruis van ' + LEERREGEL.zaden + ' zaden, en dat betekent ' +
        'dat ze niet aan te tonen zijn — niet dat ze er niet zijn. Een geleerde basislijn, de meest voor de ' +
        'hand liggende verbetering aan een REINFORCE-achtige regel, doet op deze taak dus niets: de beperking ' +
        'zit niet in de basislijn. Maar de eindscore is niet de enige maat, en op twee andere gebeurt er wél ' +
        'iets.')
    ]));
  }
  {
    /* De echte vondst van dit pakket zit niet in de eindscore maar in het aantal
       omgevingsstappen dat nodig was om er te komen. Dat is precies wat een
       variantiereductie hoort te doen, en het is de eerste plek in dit document waar
       een ingreep in de leerregel iets oplevert in plaats van kost. */
    const ss = lvs('s7-huidig', 's7-schaars', 'stappenTot80');
    const sc = lvs('s7-huidig', 's7-criticus-schaars', 'stappenTot80');
    const sb = lvs('s7-huidig', 's7-schaars', 'benchBeleid');
    if (ss && L['s7-schaars'] && REF.stappenTot80) {
      const f = REF.stappenTot80.m / L['s7-schaars'].stappenTot80.m;
      C.push(h3('Wat er wél uitkomt: schaarse perturbatie is ' + (f >= 2 ? 'veel ' : '') +
        'zuiniger met ervaring'));
      C.push(body([
        t('Per tik nog maar een kwart van de wolk verstoren levert dezelfde eindscore op (' +
          pct(L['s7-schaars'].benchBeleid) + ' tegen ' + pct(REF.benchBeleid) +
          (sb ? ', ' + pT(sb) + ', ' + sb.oordeel : '') + '), maar bereikt haar met ' +
          kort(L['s7-schaars'].stappenTot80.m) + ' omgevingsstappen in plaats van ' +
          kort(REF.stappenTot80.m) + ' — een factor ' + f.toFixed(1) + ' minder ervaring, ' + pT(ss) + ', ' +
          ss.oordeel + '. In kanten-bezoeken is het verschil even groot (' +
          kort(L['s7-schaars'].kbTot80.m) + ' tegen ' + kort(REF.kbTot80.m) + '), want een spelstap kost in ' +
          'beide condities even veel rekenwerk: het masker bespaart geen werk in de propagatie, het maakt het ' +
          'leersignaal minder ruizig. ' +
          (sc ? 'De combinatie met de criticus laat dat effect staan (' + kort(L['s7-criticus-schaars'].stappenTot80.m) +
            ' stappen, ' + pT(sc) + '), wat bevestigt dat het van de schaarse perturbatie komt en niet van de ' +
            'criticus. ' : '') +
          'Dit is de enige plek in dit document waar een ingreep in de leerregel iets oplevert in plaats van ' +
          'kost, en het is precies waar de theorie het voorspelt: de variantie van een perturbatieschatter ' +
          'groeit met het aantal knopen dat tegelijk beweegt, dus minder tegelijk verstoren maakt elke ' +
          'afzonderlijke toewijzing scherper.')
      ]));
      C.push(body([
        bd('Waarom het de eindscore niet raakt. '),
        t('Vijfhonderd pogingen zijn ruim genoeg om ook met het ruizige signaal uit te leren; de zuinigere ' +
          'variant is er alleen eerder. Dat maakt de winst niet minder echt, maar wel van een andere soort: ' +
          'zij telt in een omgeving waarin ervaring duur is — een robot, een simulatie die traag draait, een ' +
          'systeem dat online leert — en niet in een spel dat je een miljoen keer kunt spelen.')
      ]));
    }
  }
  {
    /* Het categorische beleid raakt de gelote score nauwelijks maar wél het gat
       tussen geloot en argmax. Dat gat was in sectie 10.2 een bevinding op zichzelf. */
    const ca = lvs('s7-huidig', 's7-categorisch', 'benchStreng');
    const cb = lvs('s7-huidig', 's7-categorisch', 'benchBeleid');
    if (ca && L['s7-categorisch']) {
      const gatOud = 100 * (REF.benchBeleid.m - REF.benchStreng.m);
      const gatNieuw = 100 * (L['s7-categorisch'].benchBeleid.m - L['s7-categorisch'].benchStreng.m);
      C.push(h3('En een tweede: het categorische beleid heeft het toeval minder nodig'));
      C.push(body([
        t('Sectie 10.2 rapporteert dat argmax — altijd de waarschijnlijkste knop indrukken — ' +
          gatOud.toFixed(1) + ' procentpunt kost ten opzichte van het gelote beleid, en dat het toeval dus geen ' +
          'ruis is die je er bij het toetsen netjes uit haalt maar onderdeel van de strategie is geworden. Met ' +
          'negen elkaar uitsluitende acties zakt dat gat naar ' + gatNieuw.toFixed(1) + ' procentpunt: de ' +
          'argmax-score stijgt van ' + pct(REF.benchStreng) + ' naar ' + pct(L['s7-categorisch'].benchStreng) +
          ' (' + (ca.verschilPp >= 0 ? '+' : '−') + Math.abs(ca.verschilPp).toFixed(1) + ' pp, ' + pT(ca) + ', ' +
          ca.oordeel + '), terwijl de gelote score ' +
          (cb && cb.p < 0.05 ? 'meestijgt' : 'binnen de ruis gelijk blijft') +
          (cb ? ' (' + (cb.verschilPp >= 0 ? '+' : '−') + Math.abs(cb.verschilPp).toFixed(1) + ' pp, ' +
            pT(cb) + ')' : '') + '. Dat is precies wat je verwacht als een deel van het oude gat ontstond ' +
          'doordat onafhankelijke knoppen elkaar kunnen opheffen: onder argmax is “op én neer” een echte, ' +
          'volledig verlammende actie, terwijl het gelote beleid daar met kans omheen komt. Neem je die acties ' +
          'uit de verzameling weg, dan heeft het beleid het toeval minder nodig.')
      ]));
      C.push(body([
        bd('De keerzijde. '),
        t('Het categorische beleid heeft ' + kort(L['s7-categorisch'].stappenTot80.m) + ' omgevingsstappen ' +
          'nodig om 80 % te halen tegen ' + kort(REF.stappenTot80.m) + ' voor de onafhankelijke knoppen. Negen ' +
          'acties tegen zestien combinaties is een kleinere ruimte, maar de exploratie erin is grover: één ' +
          'trekking per tik in plaats van vier, en dus minder fijnmazige variatie om aan toe te schrijven.')
      ]));
    }
  }
  {
    /* De criticus is het onderdeel waar dit pakket mee begon en het levert niets op.
       Dat hoort er even hard in te staan als de twee dingen die wel werkten. */
    const kb2 = lvs('s7-huidig', 's7-criticus', 'benchBeleid');
    const ks = lvs('s7-huidig', 's7-criticus', 'stappenTot80');
    if (kb2 && L['s7-criticus']) C.push(body([
      bd('En de criticus, waar dit pakket mee begon, levert niets op. '),
      t('De verwachting was minder spreiding tussen de zaden en een gelijke of hogere score. Gemeten: ' +
        pct(L['s7-criticus'].benchBeleid) + ' tegen ' + pct(REF.benchBeleid) + ' (' +
        (kb2.verschilPp >= 0 ? '+' : '−') + Math.abs(kb2.verschilPp).toFixed(1) + ' pp, ' + pT(kb2) + ', ' +
        kb2.oordeel + '), een spreiding tussen de zaden die juist ' +
        (SP['s7-criticus'].sd > SP['s7-huidig'].sd ? 'gróter' : 'kleiner') + ' is (' +
        (100 * SP['s7-criticus'].sd).toFixed(1) + ' tegen ' + (100 * SP['s7-huidig'].sd).toFixed(1) + ' pp), en ' +
        kort(L['s7-criticus'].stappenTot80.m) + ' omgevingsstappen tot 80 % tegen ' +
        kort(REF.stappenTot80.m) + (ks ? ' (' + pT(ks) + ')' : '') + '. Twee verklaringen liggen voor de hand ' +
        'en de meting kiest er niet tussen. De eerste is dat een lineaire waardefunctie op zestien ' +
        'raycast-sensoren de waarde van een toestand in deze wereld eenvoudig niet kan uitdrukken: of een ' +
        'positie goed is hangt af van of er een obstakel tussen agent en doel staat, en dat is geen lineaire ' +
        'functie van de zintuigen. De tweede is dat de criticus zelf moet leren en in het begin dus ruis ' +
        'toevoegt in plaats van weghaalt, terwijl de lopende basislijn er meteen staat. Wat de meting wél ' +
        'uitsluit is de simpelste diagnose: dat het probleem in de toestandsloze basislijn zat. Dat zat het ' +
        'niet.')
    ]));
  }
  {
    /* Toewijzing binnen het pakket. Zonder de losse conditie 's7-schaars' zou een
       effect bij 'criticus + schaars' niet aan een van de twee toe te schrijven zijn. */
    const ab = lvs('s7-criticus', 's7-criticus-schaars', 'benchBeleid');
    const bb = lvs('s7-schaars', 's7-criticus-schaars', 'benchBeleid');
    if (ab && bb) C.push(body([
      bd('Toewijzing binnen het pakket. '),
      t('De combinatie van criticus en schaarse perturbatie verschilt ' +
        (ab.p < 0.05 ? 'aantoonbaar' : 'niet aantoonbaar') + ' van de criticus alleen (' + pT(ab) + ') en ' +
        (bb.p < 0.05 ? 'aantoonbaar' : 'niet aantoonbaar') + ' van de schaarse perturbatie alleen (' + pT(bb) +
        '). De twee ingrepen versterken elkaar op deze taak dus niet; ze zijn samen gemeten omdat ze in het ' +
        'werkplan als paar stonden, en apart omdat een verschil anders niet toe te wijzen was geweest.')
    ]));
  }
  {
    const pg = L['s7-perturbgain'], pgT = lvs('s7-huidig', 's7-perturbgain', 'benchBeleid');
    if (pg && GRADD) C.push(body([
      bd('En de schaalfout uit sectie 3.11? '),
      t('Met een eigen leersnelheidsveeg komt g = 10 uit op η = ' + String(pg.lr).replace('.', ',') + ' en op ' +
        pct(pg.benchBeleid) + (pgT ? ' — ' + (pgT.verschilPp >= 0 ? '+' : '−') +
          Math.abs(pgT.verschilPp).toFixed(1) + ' procentpunt tegen de ongewijzigde regel, ' + pT(pgT) + ', ' +
          pgT.oordeel : '') + '. Sectie 3.11 mat dezelfde ingreep zonder eigen veeg en zag de score instorten; ' +
        'met een leersnelheid die meeschuift is dat beeld ' +
        (pgT && pgT.p < 0.05 && pgT.verschilPp < 0 ? 'milder maar niet anders' : 'niet meer terug te vinden') +
        '. De les is dezelfde als daar: η, de stapbegrenzing en de schaal van het wolkdeel zijn één samenhangend ' +
        'geheel, en één ervan verzetten terwijl de andere blijft staan meet vooral de ontregeling.')
    ]));
  }
  if (LEERREGEL.ijkTegenStap6 && LEERREGEL.ijkTegenStap6.vergeleken)
    C.push(body([
      bd('IJk op de eerdere reeks. '),
      t('De ongewijzigde regel is voor deze tabel opnieuw gedraaid en reproduceert ' +
        LEERREGEL.ijkTegenStap6.identiek + ' van de ' + LEERREGEL.ijkTegenStap6.vergeleken +
        ' runs van de referentiemeting uit sectie 10.3 tot op de zes decimalen die runs.csv bewaart. Het ' +
        'inbouwen van de vier schakelaars heeft de leerregel met alles uit dus niet geraakt — dat is geen ' +
        'vanzelfsprekendheid, want een schakelaar die per ongeluk één trekking uit de toevalsreeks haalt zou ' +
        'elke run een andere kant op sturen zonder dat er iets aan mis lijkt.')
    ]));
  C.push(gap(60));
}

/* --- 10.7: de ablatiereeks -----------------------------------------------------
   Volledig uit experimenten/ablatie.json. 10.4 vroeg wat de graaf waard is, 10.5 wat
   de schatter waard is, 10.6 wat er aan de leerregel te verbeteren valt. Deze sectie
   vraagt van elk onderdeel afzonderlijk: wat gebeurt er als het er niet is? Dat is
   de enige vorm waarin een model met vijf soorten neuronen en vier vormen van
   plasticiteit per onderdeel verantwoording aflegt. */
if (ABLATIE && ABLATIE.tabel) {
  const A = ABLATIE.tabel, AT = ABLATIE.toetsen || [];
  const an = {
    'ang-vol': 'het volle model',
    's8-geen-mem': 'geen geheugen-neuronen',
    's8-geen-refl': 'geen reflex-neuronen',
    's8-geen-sens': 'geen invoer-neuronen',
    's8-geen-snoeien': 'geen snoeien',
    's8-geen-sprout': 'geen aangroei van verbindingen',
    's8-geen-groei': 'geen neuronale groei',
    's8-geen-hertypering': 'geen hertypering',
    's8-strenge-invoer': 'strenge invoer',
    'ang-vast': 'vaste structuur, alleen gewichten'
  };
  const at = (k, m) => AT.find(x => x.conditie === k && x.maat === m);
  const pA = o => o ? (o.p < 0.001 ? 'p < 0,001' : 'p = ' + o.p.toFixed(3)) : '–';
  const pHt = o => o ? (o.pHolm < 0.001 ? '< 0,001' : o.pHolm.toFixed(3)) : '–';
  const dpp = o => o ? (o.verschilPp >= 0 ? '+' : '−') + Math.abs(o.verschilPp).toFixed(1) : '–';
  const kortA = v => (v === null || v === undefined || !isFinite(v)) ? '–'
    : v >= 1e6 ? (v / 1e6).toFixed(1) + ' M' : v >= 1e3 ? (v / 1e3).toFixed(1) + ' k' : String(Math.round(v));
  const namenA = Object.keys(an).filter(k => A[k]);
  const anderen = namenA.filter(k => k !== 'ang-vol');
  const REFA = A['ang-vol'];

  C.push(h2('10.7', 'Wat elk onderdeel bijdraagt: de ablatiereeks'));
  C.push(body(
    'Sectie 10.4 laat zien dat de structurele plasticiteit als geheel niets oplevert, maar niet welk van de ' +
    'mechanismen daaraan schuldig is; sectie 10.5 en 10.6 zeggen niets over de soorten neuronen. Deze reeks ' +
    'haalt er één onderdeel tegelijk uit en laat de rest staan: de drie gespecialiseerde soorten neuronen, de ' +
    'vier vormen van structurele plasticiteit, de bedradingsgrammatica, en als uiterste de volledig bevroren ' +
    'structuur waarin alleen de gewichten nog leren. ' + ABLATIE.zaden + ' breinzaden per conditie, ' +
    ABLATIE.pogingenPerRun + ' pogingen per run, dezelfde benchmarkset van ' + ABLATIE.benchmark.werelden +
    ' werelden, en dezelfde wereldzaden.'
  ));
  C.push(body([
    bd('Anders dan in sectie 10.6 krijgt geen enkele conditie hier een eigen leersnelheid. '),
    t('Daar was die veeg nodig omdat alle vier de ingrepen precies de grootheid raakten waar η op afgesteld ' +
      'is. Een ablatie doet dat niet: een soort neuronen weglaten of het snoeien uitzetten verandert de graaf, ' +
      'niet de schaal van de update. η staat dus voor alle tien condities op ' +
      String(ABLATIE.leersnelheid).replace('.', ',') + '. Dat is een keuze met een prijs — het blijft ' +
      'denkbaar dat een ablatie met eigen afstelling beter uitkomt — en die prijs staat in sectie 9.')
  ]));
  C.push(body([
    bd('Negen condities tegen dezelfde referentie is een familie. '),
    t('Bij negen onafhankelijke toetsen op p < 0,05 is de kans dat er minstens één toevallig uitkomt ongeveer ' +
      '37 %, en dan is de tabel een lijst met valse vondsten. Elke maat krijgt daarom een Holm-correctie over ' +
      'de negen vergelijkingen; hieronder staan de ruwe en de gecorrigeerde waarde naast elkaar, en de tekst ' +
      'baseert zich op de gecorrigeerde.')
  ]));
  C.push(tbl(
    ['conditie', 'benchmark, geloot', 'Δ (pp)', 'p', 'Holm', 'stappen tot 80 %'],
    namenA.map(k => [an[k], pct(A[k].benchBeleid),
      k === 'ang-vol' ? '–' : dpp(at(k, 'benchBeleid')),
      k === 'ang-vol' ? '–' : pA(at(k, 'benchBeleid')),
      k === 'ang-vol' ? '–' : pHt(at(k, 'benchBeleid')),
      kortA(A[k].stappenTot80 ? A[k].stappenTot80.m : null) +
      (A[k].haalde80 === A[k].runs ? '' : ' (' + A[k].haalde80 + '/' + A[k].runs + ')')]),
    [3000, 1500, 900, 1200, 1000, 1372]
  ));
  C.push(body([
    bd('Elke conditie is nagerekend op de vraag of zij werkelijk weglaat wat zij belooft. '),
    t('Dat is bij een ablatiereeks geen formaliteit: een conditie die het onderdeel niet echt uitzet levert ' +
      'een nette tabelregel op die zegt dat het onderdeel er niet toe doet. Per run is uit de weggeschreven ' +
      'kolommen gecontroleerd dat er nul geheugen-, reflex- of invoer-neuronen zijn, nul verbindingen ' +
      'gesnoeid, nul bijgegroeid, nul neuronen bijgekomen of nul hertyperingen — al naar gelang de conditie. ' +
      'De strenge invoerregel is niet uit die kolommen af te lezen en is op de graaf zelf gecontroleerd: met ' +
      'de vlag aan landt élke kant vanaf een invoer-node op een invoer-neuron, met de vlag uit een klein deel. ' +
      'Bij het schrijven van deze reeks bleek dat die vlag tot dan toe alleen uit het scherm kwam en niet uit ' +
      'de configuratie van de experimentloper; de conditie was met andere woorden meetbaar leeg geweest. Dat ' +
      'is hersteld, en de reeks van sectie 10.2 reproduceert daarna nog steeds bit voor bit.')
  ]));
  C.push(gap(60));
  {
    const bov = anderen.map(k => at(k, 'benchBeleid')).filter(o => o && o.pHolm < 0.05);
    const slechter = bov.filter(o => o.verschilPp < 0), beter = bov.filter(o => o.verschilPp >= 0);
    const ruw = anderen.map(k => at(k, 'benchBeleid')).filter(o => o && o.p < 0.05 && o.pHolm >= 0.05);
    const st = anderen.map(k => at(k, 'stappenTot80')).filter(o => o && o.pHolm < 0.05);
    C.push(h3('Wat de reeks laat zien'));
    for (const k of anderen) {
      const tb = at(k, 'benchBeleid'), ts = at(k, 'stappenTot80'), ta = at(k, 'benchStreng');
      C.push(bullet([bd(an[k].replace(/^./, c => c.toUpperCase()) + '. '),
        t(pct(A[k].benchBeleid) + ' tegen ' + pct(REFA.benchBeleid) + ' voor het volle model' +
          (tb ? ' — ' + dpp(tb) + ' procentpunt, ' + pA(tb) + ', na Holm ' + pHt(tb) + ': ' + tb.oordeelHolm : '') +
          '. Onder argmax ' + pct(A[k].benchStreng) + ' tegen ' + pct(REFA.benchStreng) +
          (ta ? ' (' + dpp(ta) + ' pp, na Holm ' + pHt(ta) + ')' : '') +
          '. Actieve verbindingen ' + (A[k].actief ? Math.round(A[k].actief.m) : '–') + ' tegen ' +
          (REFA.actief ? Math.round(REFA.actief.m) : '–') + ', kortste pad ' +
          (A[k].pad ? A[k].pad.m.toFixed(2) : '–') + ' tegen ' + (REFA.pad ? REFA.pad.m.toFixed(2) : '–') +
          '; omgevingsstappen tot 80 % succes ' + kortA(A[k].stappenTot80 ? A[k].stappenTot80.m : null) +
          ' tegen ' + kortA(REFA.stappenTot80 ? REFA.stappenTot80.m : null) +
          (ts ? ' (' + pA(ts) + ', na Holm ' + pHt(ts) + ')' : '') + '.')]));
    }
    C.push(body([
      bd(bov.length ? 'Van de negen onderdelen laat ' + (bov.length === 1 ? 'er één' : 'laten er ' + bov.length) +
        ' na correctie een spoor na op de eindscore. ' : 'Geen enkel onderdeel laat na correctie een spoor na op de eindscore. '),
      t((slechter.length ? 'Aantoonbaar slechter dan het volle model: ' +
          slechter.map(o => an[o.conditie]).join(', ') + '. ' : '') +
        (beter.length ? 'Aantoonbaar béter dan het volle model: ' +
          beter.map(o => an[o.conditie]).join(', ') + '. ' : '') +
        (ruw.length ? 'Bij ' + ruw.map(o => an[o.conditie]).join(', ') +
          ' haalt de ruwe p-waarde het wel en de gecorrigeerde niet; met negen vergelijkingen naast elkaar is ' +
          'dat precies het geval waarvoor de correctie bestaat, en de eerlijke lezing is dat het niet is ' +
          'aangetoond. ' : '') +
        (st.length ? 'Op het aantal omgevingsstappen tot 80 % succes komt daar ' +
          st.map(o => an[o.conditie]).join(', ') + ' bij: daar zit het effect niet in waar het model uitkomt ' +
          'maar in hoe duur de weg erheen is. ' : 'Op het aantal omgevingsstappen tot 80 % succes komt na ' +
          'correctie niets boven de ruis uit. ') +
        'Wat er binnen de ruis valt is niet aantoonbaar afwezig, alleen niet aantoonbaar aanwezig: bij ' +
        ABLATIE.zaden + ' zaden en een spreiding van enkele procentpunten tussen zaden is een effect van een ' +
        'paar procentpunt niet te zien.')
    ]));
    {
      /* De gelote score is het gemiddelde over een kansverdeling; argmax legt het
         beleid vast op zijn eigen voorkeur. Een onderdeel kan het eerste ongemoeid
         laten en het tweede wél raken, en dan gaat het niet over hoe goed het model
         is maar over hoe scherp zijn voorkeur is. */
      const arg = anderen.map(k => at(k, 'benchStreng')).filter(o => o && o.pHolm < 0.05);
      if (arg.length) C.push(body([
        bd('Eén onderdeel raakt niet de gelote score maar de vorm van het beleid. '),
        t('De conditie ' + arg.map(o => an[o.conditie]).join(' en ') + ' scoort onder het gelote beleid gelijk ' +
          'aan het volle model, maar onder argmax ' +
          arg.map(o => Math.abs(o.verschilPp).toFixed(1) + ' procentpunt').join(' respectievelijk ') +
          ' lager (na Holm ' + arg.map(o => pHt(o)).join(', ') + '). Argmax legt het beleid vast op zijn eigen ' +
          'voorkeur; de gelote score middelt daaroverheen. Een verschil dat alleen onder argmax zichtbaar is, ' +
          'zegt dus dat de voorkeur zelf minder scherp is geworden terwijl de verdeling eromheen even goed ' +
          'blijft presteren. Dat past bij wat sectie 10.6 al liet zien: op deze taak is het toeval onderdeel ' +
          'van de strategie geworden, en een maat die dat toeval wegneemt meet iets anders dan de gemiddelde ' +
          'prestatie.')
      ]));
    }
    C.push(body([
      bd('De uitkomst hoort bij de taak, niet bij het model in het algemeen. '),
      t('In deze taak is het doel altijd zichtbaar, dus er valt niets te onthouden; dat de geheugen-neuronen ' +
        'weglaten weinig kost is daarmee geen uitspraak over geheugen maar over deze omgeving. Hetzelfde geldt ' +
        'voor de reflex-neuronen: er is geen prikkel die binnen één tik beantwoord moet worden, dus een korte ' +
        'boog levert niets op wat een lange niet ook levert. Precies daarom is de tweede taak in sectie 10.8 ' +
        'geen bijzaak: zij is de eerste opzet waarin deze ablaties een uitslag kunnen geven die iets over het ' +
        'model zegt in plaats van over het spel.')
    ]));
  }
  C.push(gap(60));
}

/* --- 10.8: de as van waarneembaarheid ------------------------------------------
   Volledig uit experimenten/taakas.json. Alle voorgaande secties meten op een taak
   waarin het doel altijd zichtbaar is; daar valt per constructie niets te onthouden,
   en elke uitspraak over geheugen is er betekenisloos. Deze sectie verandert dat met
   één knop, en meet naast de prestatie een geheugenmaat die niet aan de neuronsoorten
   van dít model hangt. */
if (TAAKAS && TAAKAS.tabel) {
  const T = TAAKAS.tabel, TT = TAAKAS.toetsen || [], TI = TAAKAS.interacties || [];
  const AS = TAAKAS.taakas, ARCH = Object.keys(TAAKAS.architecturen);
  const an = {
    'ang': 'ANG, met structurele plasticiteit',
    'ang-vast': 'ANG, structuur bevroren',
    'mlp-16-bp': 'vast net zonder terugkoppeling, backprop',
    'elman-16-bp': 'vast recurrent net, backprop door de tijd',
    'ang-typeloos': 'ANG zonder neuronsoorten'
  };
  const cel = (a, b) => T[`s12-${a}-b${b}`];
  const tt = (c, tegen, taak, maat) => TT.find(x => x.conditie === c && x.tegen === tegen &&
    x.taak === taak && x.maat === maat);
  const pT = o => o ? (o.p < 0.001 ? 'p < 0,001' : 'p = ' + o.p.toFixed(3)) : '–';
  const pH = o => o ? (o.pHolm < 0.001 ? '< 0,001' : o.pHolm.toFixed(3)) : '–';
  const g1 = x => (x === null || x === undefined) ? '–' : x.m.toFixed(1);

  C.push(h2('10.8', 'De as van waarneembaarheid: wat er gebeurt als het doel wegvalt'));
  C.push(body(
    'Elke meting tot hier gebruikt een taak waarin het doel de hele poging zichtbaar is. In zo’n taak valt ' +
    'er niets te onthouden, en dus zegt geen van de voorgaande secties iets over geheugen — ook sectie 10.7 ' +
    'niet, waar het weglaten van de geheugen-neuronen op de gelote score niets kostte. Dat is geen resultaat ' +
    'over geheugen maar over deze omgeving. Deze sectie verandert daarom de omgeving, en wel met één knop in ' +
    'dezelfde omgeving in plaats van met een tweede spel: het doel is tien spelstappen te zien, daarna een ' +
    'instelbaar aantal stappen niet, en zo door. Op nul is het de taak van alle voorgaande secties, letterlijk ' +
    'ongewijzigd — dat is bit voor bit nagemeten tegen de referentiemeting van sectie 10.3. De beloning ' +
    'verandert niet mee: het spel weet nog steeds waar het doel staat. Wat er verandert is uitsluitend de ' +
    'waarneembaarheid, en daarmee wordt de opgave deels waarneembaar.'
  ));
  C.push(body([
    bd('Eerst een variant die is afgevallen, want dat hoort erbij. '),
    t('De eerste opzet verborg het doel permanent na k stappen. Bij k = 80 zakte ANG naar enkele procenten ' +
      'en was er niets meer te vergelijken. De diagnose is de moeite van het vasthouden waard: permanent ' +
      'verbergen vraagt geen geheugen maar koppelnavigatie. Na tachtig blinde stappen een punt raken met de ' +
      'precisie van een doelstraal is een ander en veel moeilijker probleem dan informatie vasthouden, en een ' +
      'vloer van nul meet niets. De knipperende vorm houdt de opgave oplosbaar: de agent moet een ' +
      'onderbreking overbruggen en krijgt daarna weer een ijkpunt.')
  ]));
  C.push(h3('Een geheugenmaat die niet aan dit model hangt'));
  C.push(body([
    t('De structuurmaten van sectie 6 zijn ongeschikt om te bewijzen dat er geheugen ontstaat. Een ' +
      'geheugen-neuron heeft in dit model per definitie een zelfverbinding, dus zelfverbindingen tellen meet ' +
      'de bedradingsregel en niet het gedrag. Daarom wordt hier een '), it('interventie'),
    t(' gemeten. Dezelfde getrainde agent speelt honderd verse werelden twee keer met dezelfde toevalsreeks: ' +
      'één keer met het doel de eerste twintig stappen zichtbaar en daarna niet meer, en één keer met het ' +
      'doel dat nooit zichtbaar is geweest. Het enige verschil tussen de twee is informatie die de agent ooit ' +
      'gehad heeft. Per stap na het blinderen wordt de cosinus gemeten tussen de werkelijke verplaatsing en ' +
      'de richting waarin het doel staat; de '), it('geheugenhorizon'),
    t(' is het aantal stappen dat de eerste run de tweede blijft verslaan, per vertraging gepaard en met een ' +
      'marge van ' + String(TAAKAS.voorspellingen ? 0.05 : 0.05).replace('.', ',') + '. Nul betekent niet ' +
      '"geen geheugen-neuronen" maar "geen gedrag dat op onthouden lijkt" — een uitspraak die te weerleggen ' +
      'is, en die op een vast recurrent net met exact dezelfde code te meten valt.')
  ]));
  C.push(tbl(
    ['architectuur'].concat(AS.map(a => a.naam + (a.blink ? ' (' + a.blink + ' donker)' : ' (altijd zicht)'))),
    ARCH.map(a => [an[a] || a].concat(AS.map(x => {
      const c = cel(a, x.blink);
      return c ? pct(c.benchBeleid) : '–';
    }))),
    [2600, 1600, 1600, 1600, 1572]
  ));
  C.push(tbl(
    ['geheugenhorizon (stappen)'].concat(AS.map(a => a.naam)),
    ARCH.map(a => [an[a] || a].concat(AS.map(x => {
      const c = cel(a, x.blink);
      return c ? g1(c.memHorizon) : '–';
    }))),
    [2600, 1600, 1600, 1600, 1572]
  ));
  C.push(body([
    bd('Welke vergelijking de conclusie draagt. '),
    t('De vier architecturen verschillen op meer dan één as tegelijk: de vaste netten rekenen hun uitvoer in ' +
      'twee propagatiestappen uit en leren met terugpropagatie, ANG doet één stap en schat het verborgen ' +
      'leersignaal met node-perturbatie. Het gat tussen ANG en het vaste recurrente net is dus verward met ' +
      'die twee verschillen, en sectie 10.5 heeft ze allebei al beziferd. De vergelijking die de conclusie ' +
      'van deze sectie draagt is een andere en is wél schoon: '), it('ANG tegen dezelfde graaf met bevroren ' +
      'structuur'), t('. Zelfde topologie, zelfde propagatiediepte, zelfde schatter, zelfde zaden — het ' +
      'enige verschil is of de structuur nog mag veranderen.')
  ]));
  C.push(body([
    bd('Over de leersnelheden. '),
    t('Op de stand zonder knipperen draait elke architectuur op de waarde die de veeg van sectie 10.5 of ' +
      '10.6 voor haar koos. Op elke knipperstand hebben ANG en de bevroren variant een eigen veeg gekregen — ' +
      'apart per stand, op de goedkope toets van twintig werelden en nooit op de benchmark, met veegzaden ' +
      'buiten de meetzaden — omdat de uitkomst hieronder in het nadeel van ANG uitvalt en zo’n uitkomst niet ' +
      'op andermans afstelling mag rusten. Dat het per stand moest, is zelf een waarneming: één veeg in het ' +
      'midden van de as leverde een waarde op die op een andere stand slechter was dan de oorspronkelijke. ' +
      'De vaste basislijnen hebben die veeg niet gekregen en staan dus mogelijk onder hun beste waarde. Dat ' +
      'werkt in het voordeel van ANG en maakt de conclusie hieronder conservatief.')
  ]));
  C.push(gap(60));
  {
    const laatste = AS[AS.length - 1];
    const mlpH = cel('mlp-16-bp', laatste.blink), elmH = cel('elman-16-bp', laatste.blink);
    C.push(h3('De maat werkt: een net zonder terugkoppeling haalt horizon nul'));
    C.push(body([
      t('De blinderingsproef geeft het geheugenloze net op élke stand van de as een horizon van exact ' +
        (mlpH ? g1(mlpH.memHorizon) : '–') + ' stappen, en het vaste recurrente net ' +
        AS.map(x => { const c = cel('elman-16-bp', x.blink); return c ? g1(c.memHorizon) : '–'; }).join(', ') +
        ' stappen over de vier standen. Dat is precies wat een geheugenmaat hoort te doen: een ' +
        'architectuur die per constructie geen toestand meedraagt kan de controle niet verslaan, en een ' +
        'architectuur die dat wel doet, doet het meetbaar. De maat is daarmee bruikbaar als instrument, ' +
        'los van dit model — zij vraagt niets over hoe het geheugen geïmplementeerd is en telt geen ' +
        'zelfverbindingen.')
    ]));
  }
  {
    C.push(h3('Wat de as laat zien'));
    for (const x of AS) {
      if (!x.blink) continue;
      const p = tt('ang', 'ang-vast', x.naam, 'benchBeleid');
      const q = tt('ang', 'elman-16-bp', x.naam, 'benchBeleid');
      const a = cel('ang', x.blink), v = cel('ang-vast', x.blink), e = cel('elman-16-bp', x.blink);
      C.push(bullet([bd(x.blink + ' stappen donker. '),
        t('ANG ' + (a ? pct(a.benchBeleid) : '–') + ', dezelfde graaf met bevroren structuur ' +
          (v ? pct(v.benchBeleid) : '–') + (p ? ' (' + pT(p) + ', na Holm ' + pH(p) + ')' : '') +
          '; het vaste recurrente net ' + (e ? pct(e.benchBeleid) : '–') +
          (q ? ' (ANG tegen dat net: ' + pT(q) + ', na Holm ' + pH(q) + ')' : '') + '.')]));
    }
    {
      const standen = AS.filter(x => x.blink > 0);
      const raak = standen.map(x => ({ x, o: tt('ang', 'ang-vast', x.naam, 'benchBeleid') }))
        .filter(y => y.o && y.o.pHolm < 0.05 && y.o.verschil < 0);
      const inter = TI.filter(x => x.paar === 'ang − ang-vast');
      const interRaak = inter.filter(x => x.p < 0.05);
      C.push(body([
        bd('De uitkomst gaat de andere kant op dan de hypothese. '),
        t('De verwachting, vooraf in de repository vastgelegd, was dat het voordeel van structurele ' +
          'plasticiteit zou groeien zodra de taak iets te onthouden geeft. Gemeten wordt het omgekeerde. ' +
          (raak.length
            ? 'Op ' + raak.map(y => y.x.blink + ' stappen donker').join(' en ') + ' scoort de bevroren ' +
              'variant aantoonbaar hóger dan dezelfde graaf met plasticiteit (' +
              raak.map(y => Math.abs(y.o.verschil * 100).toFixed(1) + ' procentpunt, na Holm ' + pH(y.o)).join('; ') +
              '), terwijl het verschil zonder knipperen binnen de ruis valt. '
            : 'Op geen enkele stand komt een voordeel van plasticiteit boven de ruis uit. ') +
          'Structurele plasticiteit is op deze as dus geen voordeel dat nog moest opduiken, maar een ' +
          'kostenpost die zichtbaar wordt zodra de invoer niet meer voortdurend beschikbaar is.')
      ]));
      C.push(body([
        bd('Wat hier niet uit volgt. '),
        t('Dat het verschil ' + (interRaak.length ? 'op sommige standen ' : '') + 'groter wórdt naarmate de ' +
          'donkere periode langer duurt, is met deze aantallen ' +
          (interRaak.length ? 'niet overal ' : 'niet ') + 'aan te tonen: de gepaarde vergelijking van het ' +
          'verschil per zaad tussen de stand zonder knipperen en de knipperstanden geeft ' +
          inter.map(x => pT(x)).join(', ') + '. De uitspraak die de data draagt is daarom de zwakkere en de ' +
          'preciezere: het verschil is er op de standen waar het gemeten is, en niet dat het meegroeit met de ' +
          'druk. Wie dat laatste wil weten heeft meer zaden nodig.')
      ]));
    }
    {
      const a0 = cel('ang', 0), aL = cel('ang', AS[AS.length - 1].blink);
      C.push(body([
        bd('Het scherpste detail zit in de geheugenmaat zelf. '),
        t('ANG haalt op de taak zonder knipperen een geheugenhorizon van ' + (a0 ? g1(a0.memHorizon) : '–') +
          ' stappen — hoger dan het vaste recurrente net, en dat is opmerkelijk voor een taak waarin ' +
          'onthouden niets oplevert. Zodra de taak het wél vraagt, zakt die horizon naar ' +
          (aL ? g1(aL.memHorizon) : '–') + '. Het vaste recurrente net doet precies het omgekeerde: daar ' +
          'stijgt de horizon zodra de informatie wegvalt. De architectuur met geheugen-neuronen verliest ' +
          'haar geheugengedrag dus juist onder geheugendruk, en de architectuur zonder zulke neuronen ' +
          'ontwikkelt het. Dat is de duidelijkste aanwijzing in dit hele document dat de neuronsoorten van ' +
          'dit model namen zijn en geen functies.')
      ]));
    }
    {
      const e0 = cel('elman-16-bp', 0), eB = cel('elman-16-bp', AS[1] ? AS[1].blink : 0);
      C.push(body([
        bd('Een tweede waarneming die om verklaring vraagt. '),
        t('Het vaste recurrente net gaat op de milde knipperstand niet achteruit maar vooruit: ' +
          (e0 ? pct(e0.benchBeleid) : '–') + ' met permanent zicht tegen ' +
          (eB ? pct(eB.benchBeleid) : '–') + ' met tien stappen donker. Een plausibele verklaring is dat ' +
          'het wegvallen van de doelinvoer het beleid dwingt tot een koers in plaats van tot voortdurend ' +
          'bijsturen; sectie 10.2 en 10.6 lieten al zien dat het toeval in dit beleid onderdeel van de ' +
          'strategie is geworden. Dat is een hypothese en geen bevinding. Zij is te toetsen door de ' +
          'gemiddelde padlengte per geslaagde poging tussen de standen te vergelijken, en dat gebeurt in ' +
          'een volgende versie.')
      ]));
    }
  }
  if (TAAKAS.correlaties) {
    const co = TAAKAS.correlaties;
    const rij = Object.keys(co).filter(k => co[k] && co[k].rho !== null)
      .sort((a, b) => Math.abs(co[b].rho) - Math.abs(co[a].rho));
    const naam = { memHorizon: 'geheugenhorizon (functioneel)', memCos: 'koersbehoud na blindering (functioneel)',
      lussen: 'aantal lussen (structureel)', mem: 'aantal geheugen-neuronen (structureel)',
      reflexbogen: 'aantal reflexbogen (structureel)', actief: 'actieve verbindingen (structureel)',
      pad: 'kortste pad (structureel)' };
    C.push(h3('Zegt de functionele maat meer dan de structurele telling?'));
    C.push(tbl(['maat', 'Spearman ρ met de benchmarkscore', 'n'],
      rij.map(k => [naam[k] || k, co[k].rho.toFixed(2), String(co[k].n)]),
      [4200, 3200, 1572]));
    C.push(body([
      bd('Deze tabel moet met zorg gelezen worden. '),
      t('Zij gaat over alle runs op de knipperstanden samen, en die runs komen uit vier architecturen die ' +
        'op meer dan één as tegelijk verschillen. Een structurele telling als het aantal geheugen-neuronen ' +
        'correleert hier negatief met de score, maar dat komt doordat alleen ANG zulke neuronen heeft en ' +
        'ANG op deze standen het laagst scoort: de correlatie meet welke architectuur een run is, niet wat ' +
        'de structuur doet. Datzelfde voorbehoud geldt voor de positieve correlatie van de geheugenhorizon. ' +
        'Wat de tabel wél laat zien is dat de functionele maat de enige is die in de goede richting wijst ' +
        'zonder van de neuronsoorten af te hangen — en dat is precies de reden dat het meetprogramma ' +
        'ernaartoe verschoven is. De ablatiereeks van sectie 10.7 blijft de interventie naast deze ' +
        'correlatie; correlatie en ablatie samen zeggen meer dan elk apart, en een correlatie binnen één ' +
        'architectuur is de volgende stap.')
    ]));
    if (SGEDRAG && SGEDRAG.deel1) C.push(body([
      bd('Dat voorbehoud is inmiddels gemeten, en het was terecht. '),
      t('Sectie ' + SEC_SG + ' herhaalt deze correlaties binnen alleen de ang-runs van deze as — dezelfde ' +
        'architectuur, alleen de taakstand verschilt — en daar valt het grootste verband grotendeels weg: ' +
        'wat hier als een stevige samenhang oogt, is voor een flink deel de taakstand die zowel de structuur ' +
        'als de score meebeweegt. De tabel hierboven blijft dus staan als beschrijving van deze verzameling ' +
        'runs, maar zij mag niet als bewijs voor een structuur-gedragrelatie gelezen worden, ook niet in de ' +
        'regels waar het teken toevallig klopt.')
    ]));
  }
  C.push(gap(60));
}

/* --- 10.9: de omslagproef -------------------------------------------------------
   Volledig uit experimenten/omslag.json. Sectie 10.8 traint elke architectuur apart
   op elke stand en vergelijkt eindprestaties; daarmee valt over aanpassen niets te
   zeggen, want een vast net dat je apart op twee taken traint krijgt óók twee
   gewichtssets. Deze sectie meet het enige dat een vaste architectuur principieel
   niet heeft: de rekenstructuur verbouwen terwijl het leven doorloopt. */
if (OMSLAG && OMSLAG.tabel) {
  const T = OMSLAG.tabel, TT = OMSLAG.toetsen || [], CT = OMSLAG.churnToetsen || [];
  const CN = Object.keys(OMSLAG.condities || {});
  const an = {
    'ang': 'ANG, met structurele plasticiteit',
    'ang-vast': 'ANG, structuur bevroren',
    'ang-geensnoei': 'ANG, wel plasticiteit maar niet snoeien',
    'mlp-16-bp': 'vast net zonder terugkoppeling, backprop',
    'elman-16-bp': 'vast recurrent net, backprop door de tijd'
  };
  const r = c => T['s13-' + c];
  const ts = (conditie, tegen, maat) => TT.find(x => x.conditie === conditie && x.tegen === tegen && x.maat === maat);
  const pT = o => o ? (o.p < 0.001 ? 'p < 0.001' : 'p = ' + o.p.toFixed(3)) : '–';
  const pH = o => o ? (o.pHolm < 0.001 ? '< 0.001' : o.pHolm.toFixed(3)) : '–';
  const pK = p => p === null || p === undefined ? '–' : (p < 0.001 ? 'p < 0.001' : 'p = ' + p.toFixed(3));
  const g1 = x => (x === null || x === undefined) ? '–' : x.m.toFixed(1);
  const pp = x => (x === null || x === undefined) ? '–' : (100 * x.m).toFixed(1);
  /* Een zin als "verliest X procentpunt" mag het teken niet nóg een keer dragen, en
     moet iets anders zeggen zodra de waarde de andere kant op wijst. */
  const absPp = x => (x === null || x === undefined) ? '–' : Math.abs(100 * x.m).toFixed(1);
  const verliesZin = x => (x === null || x === undefined) ? '–'
    : x.m < -0.005 ? absPp(x) + ' procentpunt verliest'
      : x.m > 0.005 ? 'er ' + absPp(x) + ' procentpunt bij wint'
        : 'er niets van verliest';
  const F = OMSLAG.fasen || [], OM = OMSLAG.omslagpogingen || [];
  const TOT = F.reduce((a, f) => a + f.pogingen, 0);
  const MID = F[1] && F[1].ov ? F[1].ov.goalBlink : 20;
  const HR = OMSLAG.herstelregel || {};
  const gecens = CN.reduce((a, c) => a + ((r(c) && r(c).gecensureerd) || 0), 0);
  const nLevens = CN.reduce((a, c) => a + ((r(c) && r(c).runs) || 0), 0);

  C.push(h2(SEC_OMSLAG, 'De omslagproef: een omslag binnen één leven'));
  C.push(body(
    'Sectie 10.8 traint elke architectuur apart op elke stand van de as en vergelijkt eindprestaties. Over ' +
    'aanpassingsvermogen zegt dat niets: een vast netwerk dat je apart op twee taken traint krijgt óók twee ' +
    'verschillende gewichtssets. Wat een vaste architectuur principieel niet heeft, is de mogelijkheid haar ' +
    'rekenstructuur te verbouwen terwijl het leven doorloopt — en na de secties 10.4 tot en met 10.8 is dat ' +
    'het laatste argument voor dit model dat nog niet gemeten was. Deze sectie meet het, in de enige opzet ' +
    'waarin het meetbaar is: één doorlopend leven van ' + TOT + ' pogingen waarin de omgeving twee keer ' +
    'omslaat, zonder waarschuwing, zonder reset, en zonder dat het brein te horen krijgt dat er iets ' +
    'veranderd is.'
  ));
  C.push(tbl(['pogingen', 'omgeving'],
    F.map((f, i) => [
      (i === 0 ? '0' : String(OM[i - 1])) + '–' + String(OM[i] !== undefined ? OM[i] - 1 : TOT - 1),
      f.ov && f.ov.goalBlink ? 'het doel knippert: 10 stappen zichtbaar, ' + f.ov.goalBlink + ' stappen niet'
        : 'het doel is altijd zichtbaar'
    ]),
    [2400, 7272]));
  C.push(body([
    t('Het brein, de gewichten, de sporen, de lopende basislijn en de exploratieafbouw lopen over alle drie ' +
      'de fasen door; alleen de omgeving schakelt. De exploratie loopt over het '), it('héle'),
    t(' leven terug en begint niet per fase opnieuw — zou zij dat wel doen, dan kreeg elke omslag er gratis ' +
      'een portie exploratiedrift bij en zou de hersteltijd die portie meten in plaats van het ' +
      'aanpassingsvermogen. Om dezelfde reden schakelt ook de leersnelheid niet mee: het brein weet niet dat ' +
      'de omgeving omslaat, dus mag de afstelling dat ook niet weten. Dat ANG de middenfase niet gaat ' +
      'beheersen is uit sectie 10.8 al bekend en is hier geen bezwaar: de middenfase is een verstoring, en ' +
      'de vraag is hoe het systeem ermee omgaat en ervan herstelt — niet of het haar leert.')
  ]));
  C.push(body([
    bd('Vooraf vastgelegd. '),
    t('De fasen, de condities en vijf voorspellingen met een uitgeschreven waar- én onwaar-tak staan in de ' +
      'repository, gecommit vóórdat de eerste run gedraaid had. Dat is hier extra nodig, want dit is de ' +
      'laatste meting waarin het model nog iets kon laten zien wat een vaste architectuur niet heeft — en ' +
      'juist dan is de verleiding het grootst om achteraf een gunstige lezing te kiezen. ' +
      (OMSLAG.voorspellingen ? 'Alle voorspellingen kwamen uit in hun onwaar-tak.' : ''))
  ]));
  C.push(h3('Het leven in vier meetpunten'));
  C.push(tbl(
    ['conditie', 'einde A1', 'op B tijdens B', 'op A tijdens B', 'einde A2'],
    CN.map(c => [an[c] || c, pct(r(c) && r(c).aEind1), pct(r(c) && r(c).bScore),
      pct(r(c) && r(c).aEind2), pct(r(c) && r(c).aEind3)]),
    [2472, 1800, 1800, 1800, 1800]));
  C.push(body([
    bd('Hoe hersteltijd gedefinieerd is. '),
    t('Het plateau van de eerste fase is het gemiddelde succes over de laatste ' + (HR.plateauVenster || 50) +
      ' pogingen van die fase. Hersteld heet een leven op de eerste poging ná de terugslag waar dat succes ' +
      'weer boven ' + Math.round(100 * (HR.drempel || 0.95)) + ' % van dat plateau ligt. Wordt dat binnen de ' +
      'derde fase niet gehaald, dan is de waarneming gecensureerd: zij krijgt in de rangtoets een waarde ' +
      'boven alles wat wél hersteld is en telt in geen enkel gemiddelde mee. ' +
      (gecens === 0
        ? 'In deze reeks is dat niet voorgekomen — alle ' + nLevens + ' levens herstellen binnen de derde fase, ' +
          'er is dus niets gecensureerd.'
        : 'In deze reeks zijn ' + gecens + ' van de ' + nLevens + ' levens gecensureerd.'))
  ]));
  C.push(tbl(
    ['conditie', 'hersteltijd (pogingen)', 'behoud (procentpunt)', 'terugwinst (procentpunt)'],
    CN.map(c => [an[c] || c, g1(r(c) && r(c).hersteltijd), pp(r(c) && r(c).behoud), pp(r(c) && r(c).terugwinst)]),
    [3272, 2200, 2100, 2100]));
  C.push(body([
    t('Behoud is wat er van taak A over is na de knipperfase: de benchmark op A aan het eind van fase B min ' +
      'die aan het eind van fase A1. Negatief is vergeten. Terugwinst is waar het leven aan het eind staat ' +
      'ten opzichte van vóór de omslag.')
  ]));
  {
    const v1 = ts('ang', 'ang-vast', 'hersteltijd');
    const v3 = ts('ang', 'ang-vast', 'behoud');
    const v4 = ts('ang-geensnoei', 'ang', 'hersteltijd');
    const v5 = ts('ang', 'elman-16-bp', 'hersteltijd');
    C.push(h3('Wat de proef laat zien'));
    C.push(body([
      bd('1. Er is geen herstelvoordeel. '),
      t('De vergelijking die de vraag beantwoordt is ANG tegen dezelfde graaf met bevroren structuur: ' +
        g1(r('ang') && r('ang').hersteltijd) + ' tegen ' + g1(r('ang-vast') && r('ang-vast').hersteltijd) +
        ' pogingen' + (v1 ? ' (' + pT(v1) + ', na Holm ' + pH(v1) + ')' : '') + ' — en het verschil wijst ' +
        'niet eens de goede kant op. Structurele plasticiteit levert ook bij een omslag binnen één leven ' +
        'geen aantoonbare aanpassingssnelheid op. Daarmee strekt de conclusie van sectie 10.8 zich uit tot ' +
        'niet-stationaire omgevingen.')
    ]));
    {
      const angC = CT.filter(x => x.conditie === 'ang');
      const omlaag = CT.filter(x => x.tekentoets && x.tekentoets.p < 0.05 && x.verschil && x.verschil.m < 0);
      C.push(body([
        bd('2. De herstructurering piekt niet na een omslag — en dit is de bevinding. '),
        t('Als plasticiteit ergens moet aanslaan, dan in de vijftig pogingen nadat de omgeving verandert. ' +
          'Gemeten wordt het tegendeel: het aantal herstructureringsgebeurtenissen per poging bij ANG gaat ' +
          angC.map(x => x.voor.m.toFixed(2).replace('.', ',') + ' → ' + x.na.m.toFixed(2).replace('.', ',') +
            ' rond poging ' + x.omslag + ' (' + x.tekentoets.positief + ' van ' + x.tekentoets.n +
            ' zaden omhoog, ' + pK(x.tekentoets.p) + ')').join(' en ') + '. ' +
          (omlaag.length
            ? 'Bij één conditie gaat de activiteit rond de tweede omslag zelfs aantoonbaar omláág (' +
              omlaag.map(x => x.conditie + ', ' + pK(x.tekentoets.p)).join('; ') + '). '
            : '') +
          'De herstructurering loopt op een vaste klok en merkt niet dat de omgeving verandert. Dat is de ' +
          'nuttigste uitkomst van deze sectie, want zij verklaart alle andere: een mechanisme dat verbouwt ' +
          'op een klok kan per constructie niet reageren op een omslag die het niet waarneemt. De vraag is ' +
          'daarmee niet langer "levert structurele plasticiteit iets op?" maar "levert '),
        it('deze'), t(' aansturing van structurele plasticiteit iets op?" — en dat is een vraag met een ' +
          'aanwijsbaar en herstelbaar antwoord.')
      ]));
    }
    C.push(body([
      bd('3. Het vergeten zit niet in de plasticiteit, maar het zit er wel. '),
      t('ANG verliest tijdens de knipperfase ' + absPp(r('ang') && r('ang').behoud) + ' procentpunt van taak ' +
        'A, en de bevroren variant ' + absPp(r('ang-vast') && r('ang-vast').behoud) + ' procentpunt' +
        (v3 ? ' (' + pT(v3) + ')' : '') + ': het verbouwen maakt het vergeten niet erger. Maar beide ' +
        'ANG-varianten verliezen ruim tien procentpunt, terwijl het geheugenloze vaste net ' +
        verliesZin(r('mlp-16-bp') && r('mlp-16-bp').behoud) + ' en het recurrente net ' +
        verliesZin(r('elman-16-bp') && r('elman-16-bp').behoud) + '. De interferentie is dus een eigenschap ' +
        'van de leerregel en de graaf, niet van de structurele plasticiteit.')
    ]));
    C.push(body([
      bd('4. Het snoeien is vrijgesproken. '),
      t('De voor de hand liggende verdachte uit sectie 10.8 was het snoeien: dat gooit tijdens de moeilijke ' +
        'fase capaciteit weg die daarna terug moet groeien. Zonder snoeien herstelt het leven in ' +
        g1(r('ang-geensnoei') && r('ang-geensnoei').hersteltijd) + ' pogingen, tegen ' +
        g1(r('ang') && r('ang').hersteltijd) + ' pogingen mét snoeien' + (v4 ? ' (' + pT(v4) + ')' : '') +
        ' — het verschil valt binnen de ruis. Het verlies zit niet in het snoeien.')
    ]));
    C.push(body([
      bd('5. De vaste netten herstellen sneller omdat zij niets kwijtraakten. '),
      t('Het vaste recurrente net herstelt in ' + g1(r('elman-16-bp') && r('elman-16-bp').hersteltijd) +
        ' pogingen tegen ' + g1(r('ang') && r('ang').hersteltijd) + ' voor ANG' +
        (v5 ? ' (' + pT(v5) + ', na Holm ' + pH(v5) + ')' : '') + ', en dat getal betekent iets anders dan ' +
        'het lijkt. Datzelfde net haalt ' + pct(r('elman-16-bp') && r('elman-16-bp').bScore) +
        ' tijdens de knipperfase zelf en ' + pct(r('elman-16-bp') && r('elman-16-bp').aEind2) +
        ' op taak A tijdens die fase: voor hem is de omslag geen verstoring. Hersteltijd meet daar de ' +
        'afwezigheid van een verstoring en niet de snelheid van aanpassing. Hetzelfde geldt in zwakkere ' +
        'vorm voor het geheugenloze net, dat de knipperfase niet kan maar er ook niets door verliest. Dat ' +
        'maakt de getallen niet ongeldig, maar het bepaalt wel wat je ermee mag beweren.')
    ]));
  }
  C.push(body([
    bd('Eén ding moet erbij, en het werkt in het voordeel van ANG. '),
    t('Het plateau van de eerste fase is niet uitgeleerd: ANG staat daar na ' + (F[0] ? F[0].pogingen : 300) +
      ' pogingen op ' + pct(r('ang') && r('ang').aEind1) + ', terwijl sectie 10.8 na 500 pogingen op een ' +
      'hogere waarde uitkomt. De hersteldrempel ligt daardoor lager dan het uiteindelijke kunnen, en de ' +
      'derde fase profiteert van leren dat sowieso nog liep — zichtbaar in de positieve terugwinst. Dat ' +
      'werkt in het voordeel van ANG, en ANG wint er nog steeds niets mee; de negatieve conclusie van deze ' +
      'sectie is dus conservatief. Bij de vaste netten werkt het de andere kant op: die waren al uitgeleerd ' +
      'en zakken over het leven licht weg.')
  ]));
  C.push(gap(60));
}

/* --- 10.10: structuur tegen gedrag ----------------------------------------------
   Volledig uit experimenten/structuurgedrag.json. Deze sectie meet niets nieuws: zij
   stelt vier vragen aan de metingen die er al liggen, en die vragen konden binnen de
   afzonderlijke secties niet gesteld worden. De eerste is een zelfcorrectie op
   sectie 10.8. */
if (SGEDRAG) {
  const D1 = SGEDRAG.deel1, D2 = SGEDRAG.deel2, D3 = SGEDRAG.deel3, D4 = SGEDRAG.deel4;
  const rho = x => (x === null || x === undefined) ? 'geen variatie' : x.toFixed(2);
  const g2 = (x, d = 1) => (x === null || x === undefined) ? '–' : x.m.toFixed(d);
  const pK = p => p === null || p === undefined ? '–' : (p < 0.001 ? 'p < 0.001' : 'p = ' + p.toFixed(3));
  /* kleine telwoorden horen in lopende tekst voluit */
  const TW = ['nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien',
    'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien'];
  const woord = n => (Number.isInteger(n) && n >= 0 && n < TW.length) ? TW[n] : String(n);
  const opsom = a => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' en ' + a[a.length - 1];

  C.push(h2(SEC_SG, 'Structuur tegen gedrag, over alle metingen heen'));
  C.push(body(
    'Alle voorgaande secties meten één reeks tegelijk. Deze sectie doet iets anders: zij stelt vier vragen ' +
    'aan het materiaal dat er na de secties 10.7 tot en met ' + SEC_OMSLAG + ' al ligt — 128 runs met bekende ' +
    'structurele ingrepen, 240 runs over een taakas, en zestig levens met twee omslagen — zonder ook maar ' +
    'één run opnieuw te draaien. Dat maakt deze sectie exploratief: de vragen zijn ná de metingen gesteld, ' +
    'niet ervoor, en er staan dan ook geen p-waarden bij de correlaties. Waar zij toe dient is iets anders ' +
    'dan bevestiging, namelijk de vraag of de structuurmaten van sectie 6 überhaupt iets over gedrag zeggen.'
  ));
  if (D1 && D1.gepoold) {
    const STANDEN = Object.keys(D1.perStand || {});
    const kort = { 'verbindingen': 'verbindingen', 'actieveVerbindingen': 'actieve verbindingen',
      'neuronenEind': 'neuronen', 'kortstePad': 'kortste pad', 'lussen': 'lussen',
      'reflexbogen': 'reflexbogen', 'mem': 'geheugen-neuronen', 'gesnoeid': 'gesnoeid',
      'bijgegroeid': 'bijgegroeid', 'typeVeranderingen': 'hertyperingen' };
    const sleutels = Object.keys(D1.gepoold).filter(k => k.endsWith('~benchBeleid'));
    const varieert = sleutels.filter(k => D1.gepoold[k].rho !== null);
    const constant = sleutels.filter(k => D1.gepoold[k].rho === null).map(k => kort[k.split('~')[0]] || k.split('~')[0]);
    C.push(h3('Correleert structuur met gedrag binnen één architectuur?'));
    C.push(body([
      t('De correlatietabel aan het eind van sectie 10.8 loopt over vier architecturen tegelijk, en het ' +
        'voorbehoud daarbij was dat zij vooral meet wélke architectuur een run is. Die tabel is hier ' +
        'herhaald binnen alleen de ang-runs van diezelfde as: ' + D1.n + ' runs, één architectuur, ' +
        'alleen de taakstand verschilt. En omdat een correlatie over vier taakstanden precies hetzelfde ' +
        'euvel kan hebben — de stand beweegt zowel de structuur als de score mee — staat elke stand er ook ' +
        'afzonderlijk naast.')
    ]));
    C.push(tbl(
      ['structuurmaat tegen benchmarkscore', 'gepoold'].concat(STANDEN.map(s => s.replace('s12-ang-b', 'b '))),
      varieert.map(k => [kort[k.split('~')[0]] || k.split('~')[0], rho(D1.gepoold[k].rho)]
        .concat(STANDEN.map(s => rho(D1.perStand[s][k] ? D1.perStand[s][k].rho : null)))),
      [3072, 1400, 1300, 1300, 1300, 1300]));
    C.push(body([
      bd('Het voorbehoud was terecht, en de omvang ervan is het vermelden waard. '),
      t('De sterkste gepoolde samenhang — het aantal verbindingen tegen de benchmarkscore, ' +
        rho(D1.gepoold['verbindingen~benchBeleid'].rho) + ' — houdt binnen de afzonderlijke standen geen ' +
        'stand: daar loopt hij van ' +
        (() => { const v = STANDEN.map(s => D1.perStand[s]['verbindingen~benchBeleid'].rho).filter(x => x !== null);
          return rho(Math.min(...v)) + ' tot ' + rho(Math.max(...v)); })() +
        ', en het teken wisselt. Een gepoolde correlatie over standen meet hier dus grotendeels dat een ' +
        'makkelijker stand zowel meer verbindingen als een hogere score oplevert, en niet dat meer ' +
        'verbindingen iets voorspellen. Dat is dezelfde fout als de architectuurfout uit sectie 10.8, één ' +
        'niveau lager, en zij is precies daarom hier opgeschreven: het is de fout die dit type tabel vanzelf ' +
        'maakt als niemand hem uitsplitst.')
    ]));
    if (constant.length) C.push(body([
      bd('Vier structuurmaten hebben geen variatie om mee te correleren. '),
      t('Over alle ' + D1.n + ' runs heen — twaalf breinzaden, vier taakstanden — zijn ' +
        opsom(constant) + ' in elke run identiek. Dat is geen meetfout maar een eigenschap van het ' +
        'model: deze maten liggen vast aan de architectuur en de startconfiguratie, niet aan de taak en ' +
        'niet aan het toeval van het zaad. Voor sectie 6 betekent dat iets ongemakkelijks. Een structuurmaat ' +
        'die onder geen enkele omgevingsdruk beweegt, kan geen verklaring zijn voor gedrag dat wél beweegt.')
    ]));
  }
  if (D2 && D2.perConditie) {
    const CN2 = Object.keys(D2.perConditie).filter(c => D2.perConditie[c].n);
    const naam2 = { 'ang': 'ANG', 'ang-vast': 'ANG, structuur bevroren', 'ang-geensnoei': 'ANG zonder snoeien' };
    const A = D2.perConditie['ang'];
    C.push(h3('Wat stabiliseert er eerst, de structuur of het gedrag?'));
    C.push(body(
      'De levens van sectie ' + SEC_OMSLAG + ' leggen per poging vast hoe groot het netwerk is en hoe goed ' +
      'het speelt. Daarmee is te bepalen wat er eerder tot rust komt. Per blok van ' + D2.blok + ' pogingen ' +
      'wordt het laatste blok bepaald waarna de blok-op-blok-verandering nooit meer boven een tiende van de ' +
      'grootste sprong in dat leven komt — voor de netwerkgrootte en voor het succes afzonderlijk, en per ' +
      'zaad gepaard vergeleken.'
    ));
    C.push(tbl(
      ['conditie', 'structuur komt tot rust op blok', 'gedrag op blok', 'verschil', 'zaden'],
      CN2.map(c => { const d = D2.perConditie[c];
        return [naam2[c] || c, g2(d.settleStruct), g2(d.settleGedrag), g2(d.verschil),
          d.tekentoets && d.tekentoets.n ? d.tekentoets.n - d.tekentoets.positief + ' van ' +
            d.tekentoets.n + ' negatief, ' + pK(d.tekentoets.p) : 'geen verschil']; }),
      [2472, 2400, 1600, 1400, 1800]));
    C.push(body([
      bd('Eerst hoe deze tabel gelezen moet worden. '),
      t('Een leven telt ' + Math.round(900 / D2.blok) + ' blokken, genummerd 0 tot en met ' +
        (Math.round(900 / D2.blok) - 1) + '. Een waarde van ' + (Math.round(900 / D2.blok) - 1) + ' betekent ' +
        'dus niet "hier kwam het tot rust" maar "binnen dit leven is het niet tot rust gekomen". Het gedrag ' +
        'haalt die rand in elke conditie, en dat is te verwachten: geen van de drie fasen van driehonderd ' +
        'pogingen is uitgeleerd, zoals sectie ' + SEC_OMSLAG + ' al meldt. De absolute settelwaarde van het ' +
        'gedrag zegt daarom weinig; het '), it('verschil'),
      t(' tussen structuur en gedrag zegt wél iets, en dat verschil is per zaad gepaard.')
    ]));
    if (A) C.push(body([
      bd('De structuur komt eerder tot rust dan het gedrag, in elk leven. '),
      t('Bij ANG settelt de netwerkgrootte gemiddeld ' + g2({ m: Math.abs(A.verschil.m) }) + ' blokken — ' +
        'ongeveer ' + (10 * Math.round(Math.abs(A.verschil.m) * D2.blok / 10)) + ' pogingen — vóór het ' +
        'succes dat doet, en dat geldt ' +
        'voor alle ' + woord(A.tekentoets.n) + ' zaden afzonderlijk (' + pK(A.tekentoets.p) + '). De richting is ' +
        'daarmee eenduidig: het verbouwen is klaar terwijl het leren doorgaat. De bevroren variant levert de ' +
        'controle dat de maat doet wat hij zegt — daar is geen sprong om te settelen, en de maat geeft ' +
        'dan ook blok nul.')
    ]));
    if (D2.perConditie['ang-geensnoei']) C.push(body([
      bd('Zonder snoeien komt de structuur helemaal niet tot rust. '),
      t('Bij de conditie zonder snoeien groeit het aantal verbindingen het hele leven vrijwel monotoon door ' +
        'en bereikt binnen ' + (900) + ' pogingen geen vast punt; de maat loopt daar tegen de rand van het ' +
        'meetvenster aan en is dus niet zinvol te vergelijken. Dat is zelf het resultaat: snoeien is wat een ' +
        'groeiende graaf een stabiele grootte geeft. Sectie ' + SEC_OMSLAG + ' sprak het snoeien vrij van ' +
        'het herstelprobleem; deze waarneming geeft het meteen een functie terug die het wél heeft.')
    ]));
  }
  if (D3 && D3.n) {
    const soort = { sens: 'zintuig', work: 'werker', refl: 'reflex', mem: 'geheugen', neut: 'neutraal' };
    const CP = D3.compositiePerType || {};
    C.push(h3('Komen twaalf beginwolken op dezelfde organisatie uit?'));
    C.push(body(
      'De ' + woord(D3.n) + ' eindnetwerken van de ang-levens uit sectie ' + SEC_OMSLAG + ' verschillen alleen in ' +
      'hun breinzaad: dezelfde regels, dezelfde omgeving, een ander toeval bij de start. De vraag is of zij ' +
      'op vergelijkbare functionele organisaties uitkomen, of op verschillende oplossingen met dezelfde ' +
      'score. Per netwerk is daarvoor het aandeel van elke neuronsoort genomen samen met de verdeling van ' +
      'de verbindingen over de soortenparen.'
    ));
    C.push(tbl(['soort', 'aandeel van de verborgen neuronen'],
      Object.keys(CP).filter(k => CP[k]).map(k => [soort[k] || k,
        CP[k].m.toFixed(3) + ' ± ' + CP[k].ci.toFixed(3)]),
      [3400, 6272]));
    C.push(body([
      bd('De twaalf komen op een smalle band uit, en de score hangt er nauwelijks mee samen. '),
      t('Over de ' + D3.paren + ' paren zaden correleert de onderlinge organisatie-afstand met het ' +
        'verschil in eindscore met ρ = ' +
        rho(D3.correlatieAfstandTegenScoreverschil && D3.correlatieAfstandTegenScoreverschil.rho) +
        '. Twee netwerken die organisatorisch verder uit elkaar liggen presteren dus nauwelijks ' +
        'verschillender dan twee die dicht bij elkaar liggen. Dat is eerder het beeld van lichte variatie ' +
        'rond één organisatie dan van werkelijk verschillende oplossingen: het aandeel geheugen-neuronen is ' +
        'over alle twaalf zaden zelfs exact gelijk. Voor de vraag waar dit werk uit voortkomt is dat een ' +
        'bruikbaar negatief resultaat — de bedradingsgrammatica laat kennelijk maar weinig speelruimte, en ' +
        'wat er aan structuur ontstaat is meer voorgeschreven dan gevonden.')
    ]));
  }
  if (D4) {
    C.push(h3('Waar reageert de herstructurering dan wél op?'));
    C.push(body(
      'Sectie ' + SEC_OMSLAG + ' stelt vast dat de herstructurering niet reageert op de twee omslagen. Dat ' +
      'laat open waar zij dan wél op reageert. De configuratie belooft iets concreets: herstructureren ' +
      'gebeurt elke tien pogingen, en dan nog alleen bij stagnatie. Dat is hier fijnmaziger getoetst, met ' +
      'de verandering van het succes over de tien voorgaande pogingen als stagnatiesignaal, op elke klokslag ' +
      'van elk leven met plasticiteit.'
    ));
    C.push(bullet([bd('De stagnatievoorwaarde filtert niets. '),
      t('Op ' + (D4.fractieActief ? (100 * D4.fractieActief.m).toFixed(1) : '–') +
        ' % van alle klokslagen gebeurt er iets. Als poort is de voorwaarde dus zo goed als altijd open, en ' +
        'in dat opzicht gedraagt het mechanisme zich inderdaad als een klok.')]));
    C.push(bullet([bd('Maar de hoeveelheid herstructurering hangt er wél mee samen. '),
      t('Op klokslagen waar het succes daalt of vlak ligt vinden gemiddeld ' +
        g2(D4.verschilDalendMinStijgend) + ' gebeurtenissen meer plaats dan op klokslagen waar het stijgt, ' +
        'en dat geldt in ' + (D4.tekentoetsDalendBovenStijgend ? D4.tekentoetsDalendBovenStijgend.positief +
          ' van de ' + D4.tekentoetsDalendBovenStijgend.n : '–') + ' levens dezelfde kant op (' +
        pK(D4.tekentoetsDalendBovenStijgend && D4.tekentoetsDalendBovenStijgend.p) + '). De ' +
        'rangcorrelatie tussen churn en die trend is gemiddeld ' + g2(D4.rhoChurnTrendGemiddeld, 2) + '.')]));
    if (D4.rhoPerFaseGemiddeld) C.push(bullet([bd('En dat is geen tijdsdrift. '),
      t('Churn neemt over een leven geleidelijk af (ρ = ' + g2(D4.rhoChurnEpGemiddeld, 2) + ' met het ' +
        'pogingnummer), dus het verband met de trend zou een gedeeld verloop met de tijd kunnen zijn. Binnen ' +
        'elke fase afzonderlijk — een venster van driehonderd pogingen — blijft het echter staan: ' +
        D4.rhoPerFaseGemiddeld.map(f => g2(f.rho, 2)).join(', ') + ' voor de drie fasen.')]));
    C.push(body([
      bd('Dat maakt de bevinding van sectie ' + SEC_OMSLAG + ' scherper in plaats van onwaar. '),
      t('Het mechanisme is niet blind: het verbouwt meer wanneer het leren vastloopt, precies zoals de ' +
        'configuratie belooft. Maar gevoeligheid voor stagnatie is niet hetzelfde als gevoeligheid voor een ' +
        'omslag. Een omslag hoeft geen aanhoudende stagnatie te veroorzaken — de agent kan meteen op een ' +
        'lager niveau verder leren, en dat is in de knipperfase precies wat er gebeurt — en omgekeerd treedt ' +
        'stagnatie ook op zonder dat er iets aan de omgeving verandert. Het signaal waarop dit mechanisme ' +
        'stuurt staat dus loodrecht op het signaal dat het zou moeten opmerken. Dat is een preciezere ' +
        'diagnose dan "het loopt op een klok", en zij wijst een concretere reparatie aan.')
    ]));
    C.push(body([
      bd('Met één voorbehoud dat hier hoort te staan. '),
      t('Het stagnatiesignaal is afgeleid uit het gedrag van de agent zelf en niet uit de omgeving. De ' +
        'samenhang is daarmee deels circulair te lezen: minder herstructurering omdat het netwerk al goed ' +
        'genoeg speelt, in plaats van meer herstructurering omdat het vastzit. Die twee zijn met deze ' +
        'gegevens niet uit elkaar te trekken, en dat is precies de reden dat de vervolgmeting in sectie ' +
        SEC_HIERNA + ' een signaal nodig heeft dat los van het eigen gedrag van het netwerk staat.')
    ]));
  }
  C.push(gap(60));
}

C.push(h2(SEC_HIERNA, 'Wat hierna gemeten wordt'));
C.push(body(
  'Sectie 10.4 laat zien dat de structurele plasticiteit als geheel niets oplevert, sectie 10.5 wat de ' +
  'schatter kost en opbrengt, sectie 10.6 dat de leerregel eromheen op één punt zuiniger kan' +
  (ABLATIE ? ', en sectie 10.7 wat elk onderdeel afzonderlijk bijdraagt' : '') +
  '. De volgende versie van dit document rapporteert:'
));
if (!ABLATIE) C.push(bullet([bd('Ablaties. '), t('Tien condities die elk één mechanisme uitzetten — geheugen-neuronen, ' +
  'reflex-neuronen, invoer-neuronen, snoeien, aangroei, neuronale groei, soortverandering, de soortregels zelf, ' +
  'en als uiterste de volledig bevroren structuur waarin alleen de gewichten nog leren.')]));
if (ABLATIE) C.push(bullet([bd('Elke ablatie met haar eigen leersnelheid. '), t('De reeks van sectie 10.7 draait ' +
  'op één η voor alle condities, met het argument dat een ablatie de graaf verandert en niet de schaal van de ' +
  'update. Dat argument is redelijk maar niet gemeten. Op de twee of drie condities waar het verschil het ' +
  'grootst is, is een leersnelheidsveeg zoals in sectie 10.5 en 10.6 de manier om uit te sluiten dat de tabel ' +
  'het afstellen meet.')]));

C.push(bullet([bd('Een recurrente basislijn met terugpropagatie door de tijd. '), t('De Elman-basislijn van ' +
  'sectie 10.5 deelt bewust het skelet van ANG en propageert dus niet terug door de tijd; daarmee wordt zij ' +
  'gemeten in precies de vorm waarin een gepoort geheugennet zijn kracht niet kan tonen. Een GRU met echte BPTT ' +
  'hoort bij de tweede taak hieronder, waar geheugen over tientallen tikken werkelijk nodig is — op de huidige ' +
  'taak is het doel altijd zichtbaar en zou zo’n basislijn niets extra’s laten zien.')]));
if (!LEERREGEL) C.push(bullet([bd('De schaal van het wolkdeel van de update. '), t('Sectie 3.11 laat zien dat het ' +
  'node-perturbatiedeel twee ordes te klein is ten opzichte van het score-functiedeel. De ontbrekende factor ' +
  'toevoegen is één regel code, maar vraagt om de leersnelheid en de stapbegrenzing samen opnieuw af te stellen; ' +
  'dat wordt als volwaardige conditie gemeten, niet als aanname doorgevoerd.')]));
if (LEERREGEL) C.push(bullet([bd('Een raster van dichtheid tegen aantal neuronen. '), t('De vraag waar dit werk ' +
  'uit voortkomt is wanneer een netwerk te klein is om het patroon te leren en wanneer het groot genoeg is om ' +
  'de trainingswerelden uit het hoofd te leren. Met de benchmarkset als toets en de structuurmaten ernaast is ' +
  'dat een kromme die op dit systeem te tekenen valt, en niet alleen te vermoeden.')]));
if (!TAAKAS) C.push(bullet([bd('Een tweede taak. '), t('In de huidige taak is het doel altijd zichtbaar; er valt niets te ' +
  'onthouden, en elke uitspraak over de geheugen-neuronen is daarmee betekenisloos. Een tweede taak waarin het ' +
  'doel na verloop van tijd verdwijnt terwijl er tegelijk obstakels opduiken die binnen één tik ontweken moeten ' +
  'worden, is de eerste opzet waarin de twee soorten paden — kort en reflexmatig, lang en met geheugen — ook ' +
  'werkelijk allebei nodig zijn.')]));
if (TAAKAS && !OMSLAG) C.push(bullet([bd('Een omslag binnen één leven. '), t('De as van sectie 10.8 traint elke agent op ' +
  'één stand. Wat een vaste architectuur principieel niet kan, is haar rekenstructuur verbouwen wanneer de ' +
  'eisen halverwege veranderen — en dat is het enige verkoopargument dat na sectie 10.4 tot en met 10.8 nog ' +
  'overeind staat. Eén doorlopend leven waarin de omgeving na een derde van de pogingen omslaat en er later ' +
  'weer terugkeert, met hersteltijd, behoud van de eerste vaardigheid en interferentie als maten, is de ' +
  'meting die dat kan uitwijzen. Ook daar geldt: als de vrije graaf niet sneller herstelt dan diezelfde ' +
  'graaf bevroren, dan is dát het resultaat.')]));
if (TAAKAS && !OMSLAG) C.push(bullet([bd('Waarom de vrije graaf onder knipperen verliest. '), t('Sectie 10.8 stelt vast ' +
  'dát het gebeurt, niet waardoor. De voor de hand liggende verdachte is de herstructurering zelf: die loopt ' +
  'door terwijl de invoerstatistiek heen en weer schakelt, en snoeit dan mogelijk juist de verbindingen weg ' +
  'die de informatie over de donkere periode heen dragen. Dat is te toetsen door de herstructurering ' +
  'gefaseerd uit te zetten en door de gesnoeide verbindingen te vergelijken met de verbindingen die de ' +
  'geheugenhorizon dragen.')]));
if (OMSLAG) C.push(bullet([bd('Herstructurering die op de omgeving stuurt in plaats van op de klok. '),
  t('Dit is de meting die direct uit sectie ' + SEC_OMSLAG + ' volgt, en sectie ' + SEC_SG + ' maakt haar ' +
    'scherper. Het mechanisme blijkt gevoelig voor stagnatie maar niet voor een omslag, en die twee vallen ' +
    'niet samen. De ingreep is klein — vervang de vaste periode door een aansturing op een signaal — maar ' +
    'het signaal moet dan wel onafhankelijk zijn van het eigen gedrag van het netwerk, anders wordt gemeten ' +
    'dat een net dat goed speelt minder verbouwt. Een detector op de invoerstatistiek voldoet daaraan; de ' +
    'lopende beloningsbasislijn niet. Daarna wordt de omslagproef van sectie ' + SEC_OMSLAG + ' ' +
    'onveranderd opnieuw gedraaid. Levert dat evenmin een herstelvoordeel op, dan is de negatieve ' +
    'bevinding niet langer aan één ontwerpkeuze toe te schrijven.')]));
if (SGEDRAG) C.push(bullet([bd('Structuurmaten die wél bewegen. '),
  t('Sectie ' + SEC_SG + ' laat zien dat verscheidene maten uit sectie 6 over alle gemeten runs heen ' +
    'constant zijn: zij variëren niet met de taak en niet met het zaad. Zulke maten kunnen per definitie ' +
    'geen gedrag verklaren. Wat dit werk nodig heeft is een beschrijving van de gevormde structuur die ' +
    'onder omgevingsdruk wél uiteenloopt — en het eerlijkste startpunt daarvoor is niet nog een telling, ' +
    'maar een interventiemaat in de geest van de blinderingsproef: verstoor een deel van de graaf en meet ' +
    'wat het gedrag verliest.')]));
C.push(h2(SEC_VRAAG, 'De onderzoeksvraag, smaller gemaakt'));
if (OMSLAG) C.push(body(
  'Dit document is begonnen met de vraag of een netwerk zonder lagen en zonder backpropagation beter kan ' +
  'zijn dan een vast netwerk. Zes meetreeksen later is die vraag beantwoord, en het antwoord is nee. De ' +
  'graaf voegt op deze taak niets toe aan de leerregel (10.4). Lokaal leren kost meer dan twintig ' +
  'procentpunt en ongeveer een factor veertig aan rekenwerk (10.5). Geen enkel structureel mechanisme ' +
  'draagt afzonderlijk aantoonbaar bij (10.7). Zodra de omgeving deels waarneembaar wordt verliest de ' +
  'vrije graaf méér dan diezelfde graaf bevroren (10.8). En wanneer de omgeving halverwege het leven ' +
  'omslaat — de enige opzet waarin verbouwen tijdens het leren iets kán opleveren — herstelt de vrije ' +
  'graaf niet sneller dan de bevroren (' + SEC_OMSLAG + ').\n\n' +
  'Wat dit werk onderscheidt van een reeks tegenvallers is dat de oorzaak aanwijsbaar is. De ' +
  'herstructurering wordt aangestuurd door een klok, en waar zij wél op een signaal reageert, is dat de ' +
  'stagnatie van het eigen leren en niet een verandering in de omgeving (' + SEC_SG + '). Een mechanisme ' +
  'dat de omslag niet waarneemt kan er per constructie niet op reageren. Daarmee gaat de negatieve ' +
  'bevinding niet over structurele plasticiteit als idee, maar over deze aansturing ervan — en dat is een ' +
  'uitspraak die te repareren en opnieuw te toetsen valt, wat de eerste openstaande meting in sectie ' +
  SEC_HIERNA + ' dan ook is.\n\n' +
  'De vraag die overblijft is geen vergelijkingsvraag maar een grensvraag: onder welke omgevingsdruk, en ' +
  'onder welke aansturing, betaalt structurele plasticiteit binnen één leven zich terug ten opzichte van ' +
  'dezelfde graaf met bevroren structuur? Dit document levert daar vier dingen voor. Een systeem waarvan ' +
  'elke schroef gecontroleerd is, tot en met de numerieke controle van de leerregel zelf. Twee ' +
  'meetinstrumenten die losstaan van dit model en op elke architectuur werken: de blinderingsproef voor ' +
  'geheugen en de omslagproef voor aanpassing. Een mechanismeresultaat dat wél staat — het typesysteem ' +
  'draagt de geheugenhorizon (10.8). En een aanwijsbare oorzaak voor waarom de rest niet staat.'
));
if (TAAKAS && !OMSLAG) C.push(body(
  'Dit document is begonnen met de vraag of een netwerk zonder lagen en zonder backpropagation beter kan ' +
  'zijn dan een vast netwerk. Vier meetreeksen later is die vraag beantwoord, en het antwoord is nee: de ' +
  'graaf voegt op deze taak niets toe aan de leerregel (10.4), lokaal leren kost meer dan twintig ' +
  'procentpunt en ongeveer een factor veertig aan rekenwerk (10.5), geen enkel structureel mechanisme ' +
  'draagt afzonderlijk aantoonbaar bij (10.7), en zodra de omgeving deels waarneembaar wordt verliest de ' +
  'vrije graaf méér dan diezelfde graaf bevroren (10.8). Dat laatste is het scherpste: het mechanisme is ' +
  'getest in precies de richting waarvoor het bedoeld is, en het werd slechter.\n\n' +
  'De vraag die overblijft is daarom geen vergelijkingsvraag maar een grensvraag: ' +
  'onder welke omgevingsdruk betaalt structurele plasticiteit binnen één leven zich terug ten opzichte van ' +
  'dezelfde graaf met bevroren structuur? Dit document levert daar drie dingen voor. Een systeem waarvan ' +
  'elke schroef gecontroleerd is, tot en met de numerieke controle van de leerregel zelf. Een as waarlangs ' +
  'is gezocht naar de druk waaronder het mechanisme zich zou terugbetalen, met het resultaat dat die druk ' +
  'op deze as niet bestaat. En een meetinstrument dat losstaat van dit model: een interventiemaat voor ' +
  'geheugen die op elke architectuur werkt en die niet de eigen bedradingsregels terugmeet. ' +
  'Wat er dan nog te onderzoeken valt, staat in sectie ' + SEC_HIERNA + ', en de kern daarvan is de enige ' +
  'eigenschap die een vaste architectuur principieel niet heeft: het vermogen om de eigen rekenstructuur te ' +
  'verbouwen terwijl het leven doorloopt.'
));
if (!TAAKAS) C.push(body(
  'Sectie 10.4 en 10.5 dwingen samen tot een scherpe afbakening. ANG is geen goedkoper alternatief ' +
  'voor backpropagation, en op een taak als deze wint een klein gelaagd netwerk met dezelfde leerregel al op ' +
  'rekentijd én op kanten-bezoeken bij gelijke score — gemeten, niet vermoed. ' +
  'De verdedigbare vraag is smaller: of een lokaal lerende, zichzelf herstructurerende recurrente graaf door ' +
  'structurele spaarzaamheid en verschillende informatielatenties een gunstiger compromis tussen rekenwerk en ' +
  'gedrag vindt dan een vaste architectuur. Bij propagatiediepte één kost elke boog letterlijk één tijdstap, ' +
  'zodat padlengte in dit model samenvalt met reactietijd — en dat is de eigenschap die een vaste architectuur ' +
  'niet vanzelf heeft.'
));

/* ===== 11 ===== */
C.push(h1('11', 'Conclusie'));
C.push(body(
  'ANG laat zien dat de laagstructuur van een neuraal netwerk opgegeven kan worden zonder dat er iets voor in de ' +
  'plaats hoeft te komen wat even star is. Wat overblijft is een getypeerde graaf met vijf invarianten, een ' +
  'leerregel die volledig uit lokale grootheden is opgebouwd, en een herstructureringsprocedure die de topologie ' +
  'en zelfs de soort van een neuron laat volgen uit wat er feitelijk gegroeid is. Drie begrenzingen — niet abrupt, ' +
  'niet oneindig, en vervagend — vervangen de rol die een expliciete optimalisator in een gelaagd netwerk speelt.'
));
C.push(body(
  'De prijs is bekend: een gradiëntschatter met variantie, geen convergentiegarantie, en een gevoeligheid voor ' +
  'parameters die in een gelaagd netwerk niet bestaat. De winst is dat de uitkomst afleesbaar is. Aan het einde van ' +
  'een run staat er geen gewichtsmatrix maar een structuur, met een kortste pad, met lussen, met reflexbogen, met ' +
  'zintuigen die gebruikt worden en zintuigen die genegeerd worden. Voor de vraag waar dit werk uit voortkomt — ' +
  'begrijpen waarom een te klein of slecht getraind netwerk faalt — is dat precies de vorm waarin je een antwoord ' +
  'wilt hebben.'
));
if (BASIS && BASIS.tabel) C.push(body([
  bd('Wat het model op deze taak niet laat zien, hoort er even hard bij. '),
  t('Een vaste stapel lagen met dezelfde leerregel en hetzelfde parameterbudget scoort binnen de meetruis ' +
    'gelijk (sectie 10.4), en de structurele plasticiteit als geheel levert niets aantoonbaars op. De ' +
    'prestatie is dus toe te schrijven aan de leerregel, niet aan de graaf. Dat is geen weerlegging van het ' +
    'idee, maar het bepaalt wel waar het bewijs vandaan moet komen: uit een omgeving waarin korte en lange ' +
    'paden allebei nodig zijn, niet uit een taak waarin het doel altijd zichtbaar is en één tussenlaag ' +
    'volstaat. Zolang die meting er niet is, is de afleesbaarheid de bijdrage en niet de prestatie.')
]));
if (REKEN && REKEN.tabel && REKEN.tabel['mlp-16-bp'] && REKEN.tabel['ang-vol']) {
  const A = REKEN.tabel['ang-vol'], M = REKEN.tabel['mlp-16-bp'];
  C.push(body([
    bd('En de prijs van lokaal leren is nu geteld. '),
    t('Sectie 10.5 laat zien dat de exacte gradiënt op elk van de drie gelaagde netten een verschil van meer ' +
      'dan twintig procentpunt maakt, en dat een netwerk van ' + Math.round(M.verbindingen.m) + ' gewichten dat ' +
      'terugpropageert de benchmarkscore van de wolk haalt voor ongeveer een ' +
      Math.round(A.kbTot80.m / M.kbTot80.m) + 'e deel van het rekenwerk. Node-perturbatie compenseert dat met ' +
      'capaciteit: ongeveer een orde van grootte meer parameters om hetzelfde te halen. Wat een lokale ' +
      'leerregel oplevert — een update die alleen grootheden gebruikt die op de synaps zelf beschikbaar zijn — ' +
      'moet dus opwegen tegen die rekening, en op deze taak doet het dat niet. De verdedigbare aanspraak van ' +
      'ANG ligt daarmee niet bij efficiëntie, en dat is precies de afbakening die sectie ' +
  SEC_VRAAG + ' maakt.')
  ]));
}
if (LEERREGEL && LEERREGEL.tabel && LEERREGEL.tabel['s7-schaars'] && LEERREGEL.tabel['s7-huidig']) {
  const H = LEERREGEL.tabel['s7-huidig'], Sp = LEERREGEL.tabel['s7-schaars'];
  const f = (H.stappenTot80 && Sp.stappenTot80) ? H.stappenTot80.m / Sp.stappenTot80.m : null;
  C.push(body([
    bd('Eén ding is de leerregel wél waard gebleken. '),
    t('Van de vier standaardingrepen die in sectie 10.6 zijn gemeten, doet de meest voor de hand liggende — ' +
      'een geleerde, toestandsafhankelijke basislijn — niets, en herstelt de schaalcorrectie uit sectie 3.11 ' +
      'niets. Wat wél werkt is de goedkoopste: per tik nog maar een kwart van de wolk verstoren' +
      (f ? ' haalt dezelfde eindscore met een factor ' + f.toFixed(1) + ' minder ervaring' : ' haalt dezelfde ' +
        'eindscore met aanzienlijk minder ervaring') + '. Voor een leerregel die zichzelf verdedigt met ' +
      'lokaliteit en online leren is dat de relevante as: niet waar zij uiteindelijk uitkomt, maar hoeveel ' +
      'ervaring zij daarvoor nodig heeft. Dat is ook de as waarop de tweede taak haar zal moeten meten.')
  ]));
}
if (ABLATIE && ABLATIE.tabel && ABLATIE.tabel['ang-vol']) {
  const AT2 = ABLATIE.toetsen || [];
  const raak = AT2.filter(x => x.maat === 'benchBeleid' && x.pHolm < 0.05);
  C.push(body([
    bd('En per onderdeel is de rekening opgemaakt. '),
    t('De ablatiereeks in sectie 10.7 haalt er één onderdeel tegelijk uit — de drie gespecialiseerde soorten ' +
      'neuronen, de vier vormen van structurele plasticiteit, de bedradingsgrammatica — en meet wat dat kost. ' +
      (raak.length
        ? 'Na correctie voor negen vergelijkingen blijven er ' + raak.length + ' over die aantoonbaar iets ' +
          'uitmaken; de rest valt binnen de ruis. '
        : 'Na correctie voor negen vergelijkingen blijft er geen enkel onderdeel over dat op deze taak ' +
          'aantoonbaar iets uitmaakt. ') +
      'Dat is een hard resultaat over dit spel en een zacht resultaat over het model: in een omgeving waarin ' +
      'het doel altijd zichtbaar is en niets binnen één tik beantwoord hoeft te worden, hebben geheugen en ' +
      'reflex per constructie niets te doen. De ablaties krijgen pas betekenis op een taak waarin de twee ' +
      'tijdschalen werkelijk allebei nodig zijn, en dat is precies wat de tweede taak moet leveren.')
  ]));
}
if (OMSLAG && OMSLAG.tabel && OMSLAG.tabel['s13-ang']) {
  const A = OMSLAG.tabel['s13-ang'], V = OMSLAG.tabel['s13-ang-vast'];
  C.push(body([
    bd('En de laatste aanspraak is nu ook gemeten. '),
    t('Wat een vaste architectuur principieel niet heeft, is de mogelijkheid haar rekenstructuur te ' +
      'verbouwen terwijl het leven doorloopt. Sectie ' + SEC_OMSLAG + ' zet daar één doorlopend leven ' +
      'tegenover waarin de omgeving twee keer omslaat, en de vrije graaf herstelt niet sneller dan ' +
      'dezelfde graaf bevroren (' + A.hersteltijd.m.toFixed(1).replace('.', ',') + ' tegen ' +
      V.hersteltijd.m.toFixed(1).replace('.', ',') + ' pogingen). Daarmee is de negatieve bevinding ' +
      'compleet: niet in eindprestatie, niet in geheugen, niet in monsterefficiëntie en niet in ' +
      'aanpassingssnelheid levert deze vorm van structurele plasticiteit iets op.')
  ]));
  C.push(body([
    bd('Maar zij is niet alleen negatief, en dat is het verschil. '),
    t('Dezelfde sectie laat zien waaróm: de herstructurering piekt niet na een omslag, want zij loopt op ' +
      'een vaste klok' + (SGEDRAG ? ' — en waar zij wél op een signaal reageert, is dat de stagnatie van ' +
        'het eigen leren en niet een verandering in de omgeving (sectie ' + SEC_SG + ')' : '') + '. Een ' +
      'mechanisme dat de omslag niet waarneemt, kan er niet op reageren. De uitspraak van dit document is ' +
      'daarmee smaller en bruikbaarder dan "structurele plasticiteit werkt niet": zij werkt niet ' +
      'wanneer je haar op een klok laat lopen, en dat is een ontwerpkeuze en geen eigenschap van het idee. ' +
      'Wat overblijft als bijdrage is dan ook niet het model maar het gereedschap eromheen — de ' +
      'blinderingsproef, de omslagproef, en een meetopzet waarin een voorspelling eerder vastligt dan de ' +
      'data die haar moet weerleggen.')
  ]));
}

/* ===== referenties ===== */
/* =====================================================================
   Nawerk. Voor een preprint is dit geen bijzaak: uitgevers en preprintservers
   eisen dat het gebruik van generatieve AI expliciet gemeld wordt, en dat een
   AI-hulpmiddel NIET als auteur wordt opgevoerd — het kan geen verantwoording
   dragen, geen belangenverstrengeling melden en geen auteursrecht overdragen
   (COPE, ICMJE, arXiv). Vandaar deze drie secties.
   ===================================================================== */
C.push(h1('', 'Verklaring over het gebruik van AI-hulpmiddelen'));
C.push(body([
  t('Bij dit onderzoek is Claude (Opus 5, Anthropic) gebruikt, en niet marginaal. Het hulpmiddel staat '),
  bd('niet als auteur vermeld'),
  t('. Dat is geen bescheidenheid maar de regel: een AI-hulpmiddel kan geen verantwoording dragen voor het ' +
    'werk, geen belangenverstrengeling melden en geen rechten overdragen, en kan daarom volgens COPE, de ICMJE ' +
    'en het beleid van arXiv geen auteur zijn. De auteur is volledig verantwoordelijk voor de inhoud van dit ' +
    'document, ook voor de delen die met behulp van het hulpmiddel tot stand zijn gekomen.')
]));
C.push(h3('Waar het aan heeft bijgedragen'));
C.push(bullet([bd('Ontwerp en implementatie. '), t('Het model, de leerregel en de structurele plasticiteit zijn ' +
  'in samenspraak ontworpen: de auteur stelde het onderzoeksdoel, de eis van een laagloze graaf, de vier ' +
  'neuronsoorten en hun bedradingsregels vast; het hulpmiddel heeft die eisen uitgewerkt tot de formuleringen ' +
  'in de secties 2 tot en met 6 en tot de volledige implementatie in JavaScript.')]));
C.push(bullet([bd('Meten en analyseren. '), t('De meetscripts, de experimentloper, de statistiek en de figuren ' +
  'zijn met het hulpmiddel geschreven en door het hulpmiddel uitgevoerd. Alle ruwe meetgegevens zijn ' +
  'weggeschreven en meegeleverd (zie hieronder), zodat elke uitspraak in dit document tot de onderliggende ' +
  'getallen te herleiden is.')]));
C.push(bullet([bd('Schrijven. '), t('De tekst van dit document is door het hulpmiddel opgesteld en door de ' +
  'auteur inhoudelijk beoordeeld en geaccordeerd.')]));
C.push(h3('Wat dat betekent voor de lezer'));
C.push(body(
  'Twee dingen. Ten eerste: de tabellen in de secties 3.5, 3.11 en 10 worden door de generator rechtstreeks uit ' +
  'de meetbestanden opgebouwd en niet met de hand overgetypt, juist omdat een getal dat een taalmodel uit zijn ' +
  'hoofd opschrijft geen meting is. Ontbreekt een meetbestand, dan zegt de betreffende sectie dat de meting nog ' +
  'moet gebeuren in plaats van een getal te noemen. Ten tweede: de referenties zijn inmiddels stuk voor stuk ' +
  'tegen de vindplaats gecontroleerd — jaargang, deel, nummer en paginabereik — omdat een bibliografie precies ' +
  'de plek is waar een taalmodel plausibele maar onjuiste details produceert. Waar een paginabereik niet tegen ' +
  'een primaire bron te controleren was, staat er geen paginabereik maar een DOI. Dat is een bewuste keuze: ' +
  'liever een onvolledige verwijzing die klopt dan een volledige die misschien niet klopt.'
));

C.push(h1('', 'Belangenverklaring'));
C.push(body(
  'De auteur verklaart geen concurrerende financiële of persoonlijke belangen te hebben die de in dit document ' +
  'gerapporteerde bevindingen hebben kunnen beïnvloeden. Er is geen externe financiering ontvangen. Anthropic, ' +
  'de leverancier van het gebruikte AI-hulpmiddel, heeft geen rol gehad bij de opzet van het onderzoek, de ' +
  'uitvoering, de analyse of het besluit tot publicatie.'
));

C.push(h1('', 'Beschikbaarheid van code en gegevens'));
C.push(body([
  t('Alles wat nodig is om de cijfers in dit document na te rekenen is openbaar: '),
  new ExternalHyperlink({
    children: [new TextRun({ text: 'github.com/spikalo/AI-testing-tool', font: SERIF, size: 21, color: ACC,
      underline: {} })],
    link: 'https://github.com/spikalo/AI-testing-tool'
  }),
  t('.')
]));
C.push(tbl(
  ['wat', 'waar'],
  [['het model en de leeromgeving', 'brein-test.html — één bestand, geen bibliotheken, draait in de browser'],
   ['de generator van dit document', 'paper/paper.js, met paper/mkeq.py en de figuurscripts'],
   ['de meetreeksen', 'experimenten/runs.csv — één regel per run, met beide zaden en alle instellingen'],
   ['de gradiëntcontrole', 'experimenten/gradcheck.csv en gradcheck*.json'],
   ['de controles die de eigenschappen bewijzen', 'tests/ — Playwright-scripts, elk met een eigen uitkomst'],
   ['de reproduceerbaarheidscontrole', 'experimenten/reproduceerbaarheid.json']],
  [3400, 6272]
));
C.push(body(
  'Een run ligt volledig vast door twee getallen: het breinzaad en het wereldzaad, die beide in elk ' +
  'resultaatbestand staan (bijlage B). Twee runs met dezelfde zaden geven bit voor bit dezelfde leercurve, ' +
  'dezelfde toetsen, dezelfde structuurmaten en hetzelfde eindnetwerk — gecontroleerd, niet aangenomen. De ' +
  'volledige resultaatbestanden per run zijn niet meegeleverd omdat zij groot zijn en uit die twee zaden exact ' +
  'te reproduceren.'
));

C.push(h1('', 'Referenties'));
const REFS = [
  'Bogdan, P. A., Rowley, A. G. D., Rhodes, O., & Furber, S. B. (2018). Structural plasticity on the SpiNNaker many-core neuromorphic system. Frontiers in Neuroscience, 12, 434.',
  'Chklovskii, D. B., Mel, B. W., & Svoboda, K. (2004). Cortical rewiring and information storage. Nature, 431(7010), 782–788.',
  'Fiete, I. R., & Seung, H. S. (2006). Gradient learning in spiking neural networks by dynamic perturbation of conductances. Physical Review Letters, 97(4), 048104.',
  'Frémaux, N., & Gerstner, W. (2016). Neuromodulated spike-timing-dependent plasticity, and theory of three-factor learning rules. Frontiers in Neural Circuits, 9, 85. doi:10.3389/fncir.2015.00085',
  'Holtmaat, A., & Svoboda, K. (2009). Experience-dependent structural synaptic plasticity in the mammalian brain. Nature Reviews Neuroscience, 10(9), 647–658.',
  'Izhikevich, E. M. (2007). Solving the distal reward problem through linkage of STDP and dopamine signaling. Cerebral Cortex, 17(10), 2443–2452.',
  'Jaeger, H. (2001). The "echo state" approach to analysing and training recurrent neural networks (GMD Report 148). Bonn: German National Research Center for Information Technology.',
  'Maass, W., Natschläger, T., & Markram, H. (2002). Real-time computing without stable states: a new framework for neural computation based on perturbations. Neural Computation, 14(11), 2531–2560.',
  'Ng, A. Y., Harada, D., & Russell, S. (1999). Policy invariance under reward transformations: theory and application to reward shaping. Proceedings of the Sixteenth International Conference on Machine Learning (ICML), 278–287. Morgan Kaufmann.',
  'Seung, H. S. (2003). Learning in spiking neural networks by reinforcement of stochastic synaptic transmission. Neuron, 40(6), 1063–1073.',
  'Stanley, K. O., & Miikkulainen, R. (2002). Evolving neural networks through augmenting topologies. Evolutionary Computation, 10(2), 99–127.',
  'Sutton, R. S., & Barto, A. G. (2018). Reinforcement Learning: An Introduction (2e druk). MIT Press.',
  'Williams, R. J. (1992). Simple statistical gradient-following algorithms for connectionist reinforcement learning. Machine Learning, 8, 229–256.',
  'Xie, S., Kirillov, A., Girshick, R., & He, K. (2019). Exploring randomly wired neural networks for image recognition. Proceedings of the IEEE/CVF International Conference on Computer Vision (ICCV). doi:10.1109/ICCV.2019.00137',
  'You, J., Leskovec, J., He, K., & Xie, S. (2020). Graph structure of neural networks. Proceedings of the 37th International Conference on Machine Learning (ICML), PMLR 119, 10881–10891.'
];
REFS.forEach((r, i) => C.push(new Paragraph({
  children: [new TextRun({ text: `[${i + 1}]  ${r}`, font: SERIF, size: 18, color: INK })],
  alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 90, line: 250, lineRule: LineRuleType.AUTO },
  indent: { left: 420, hanging: 420 }
})));

/* ===== bijlage ===== */
C.push(h1('', 'Bijlage A — Notatie'));
C.push(tbl(
  ['Symbool', 'Betekenis'],
  [
    ['V, E', 'knopen en gerichte verbindingen van de graaf'],
    ['I, O, H', 'invoerknopen, uitvoerknopen, de wolk ertussen'],
    ['κ(v)', 'de soort van knoop v'],
    ['L(·,·)', 'toelaatbaarheidsrelatie tussen soorten'],
    ['wᵢⱼ, bⱼ', 'gewicht van verbinding i→j; bias van knoop j'],
    ['uⱼ, xⱼ', 'netto-invoer en activatie van knoop j'],
    ['x̃ᵢ', 'presynaptische activatie: de toestand aan het begin van de laatste propagatiestap'],
    ['x̄ⱼ, δⱼ', 'schone activatie en perturbatie (= x − x̄)'],
    ['pₖ, aₖ', 'kans op en uitkomst van knopdruk k'],
    ['eᵢⱼ', 'eligibility trace van verbinding i→j'],
    ['rₜ, r̄ₜ, Âₜ', 'beloning, lopende basislijn, advantage'],
    ['ε, τ, σₕ', 'exploratie, temperatuur van de knoppen, ruis in de wolk'],
    ['η, λ, ρ', 'leersnelheid, sporenvervaging, vervaging per poging'],
    ['φ', 'dempingsfactor tegen het gewichtsplafond'],
    ['θₚ, nᵢⱼ', 'snoeidrempel en het aantal ronden dat i→j al zwak is'],
    ['C(i,t), S(t)', 'kosten van soort t voor neuron i; de specificiteitsbonus'],
    ['T(i), μ', 'de gekozen soort; de marge waarmee zij moet winnen'],
    ['νᵢ', 'invloed van invoerknoop i op de uitvoer']
  ],
  [2400, 6672]
));

/* ===== bijlage B ===== */
C.push(h1('', 'Bijlage B — Het resultaatbestand'));
C.push(body(
  'Elke afgeronde run wordt als één JSON-bestand weggeschreven. De indeling is zo gekozen dat het bestand op ' +
  'zichzelf voldoende is: er is geen aanvullend logboek nodig om de run te herhalen, het netwerk te hertekenen of ' +
  'het brein terug te laden.'
));
C.push(tbl(
  ['veld', 'inhoud'],
  [
    ['versie', 'formaatversie van het bestand'],
    ['tijdstip, spel, brein', 'wanneer, welke taak, welke naam'],
    ['breinZaad', 'zaad van de startwolk — samen met het wereldzaad legt dit de run vast'],
    ['config.startNeuronen, .samenstelling, .samenstellingStart', 'aantal en soortverdeling bij begin en einde'],
    ['config.startdichtheid, .invoerAlleenViaSens', 'bedradingsdichtheid en de strengere invoerregel'],
    ['config.types', 'per soort: aan/uit met minimum en maximum'],
    ['config.wereld', 'obstakels, stappen per poging, verversing, wereldzaad, snelheid, stoppen bij botsing'],
    ['config.leren', 'η, λ, ρ, w_max, Δ_max, geheugenlek, propagatiediepte, exploratie begin en eind'],
    ['config.structureel', 'ritme, snoeidrempel, aangroei, groei, soortverandering en hun grenzen'],
    ['config.beloningen', 'doel, vooruitgang, botsing, per stap, stilstaan'],
    ['config.training', 'pogingen, toetsen aan/uit, toetsmodus, aantal toetswerelden'],
    ['resultaat', 'succes totaal en over de laatste twintig, toetsscore, stappen, beloning, botsingen, rekentijd'],
    ['structuur', 'alle maten uit sectie 6, plus gesnoeid, bijgegroeid, geboren en omgetypt'],
    ['historie', 'per poging: geslaagd, beloning, stappen, stilstaan, verbindingen, neuronen, gemiddeld gewicht'],
    ['toetsen', 'per toetsmoment de score op de onbekende werelden'],
    ['herstructureringen', 'per ronde wat er gesnoeid, aangegroeid, omgetypt en bijgegroeid is'],
    ['netwerk.neuronen', 'per knoop: nummer, soort, label, positie, bias'],
    ['netwerk.verbindingen', 'per verbinding: bron, doel, gewicht'],
    ['netwerk.nextId', 'volgnummer voor labels van later geboren neuronen']
  ],
  [3100, 5972]
));
C.push(gap(80));
C.push(body(
  'Een reeks runs schrijft daarnaast één regel per run naar een gezamenlijke tabel met ' + (RUNS ? Object.keys(RUNS[0]).length : 52) +
  ' kolommen: de conditienaam, beide zaden, de parameters die tussen condities kunnen verschillen, en alle ' +
  'uitkomst- en structuurmaten. Die tabel is de bron waaruit de tabellen in sectie 10 van dit document worden ' +
  'opgebouwd — niet met de hand overgetypt, maar bij elke hergeneratie opnieuw uit de meetgegevens gelezen.'
));

/* ======================= document ======================= */
const doc = new Document({
  creator: 'Frank Jacobs',
  lastModifiedBy: 'Frank Jacobs',
  title: 'Adaptive Neural Graph (ANG)',
  description: 'Een zelfstructurerend neuraal netwerk zonder lagen en zonder backpropagation',
  numbering: {
    config: [{
      reference: 'bul',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 420, hanging: 220 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 760, hanging: 220 } } } }
      ]
    }]
  },
  styles: {
    default: {
      document: { run: { font: SERIF, size: 21, color: INK }, paragraph: { spacing: { line: 264, lineRule: LineRuleType.AUTO } } }
    }
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1417, right: 1417, bottom: 1417, left: 1417 }
      }
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: `Adaptive Neural Graph (ANG) · versie ${VERSIE} · `, font: SERIF, size: 16, color: DIM }),
            new TextRun({ children: [PageNumber.CURRENT], font: SERIF, size: 16, color: DIM })
          ]
        })]
      })
    },
    children: C
  }]
});

/* Controle vóór het wegschrijven. Eén keer is een array alinea's per ongeluk als
   één kind doorgegeven; docx maakt daar zwijgend <0/> van, en Word weigert het
   bestand dan te openen. Zo'n fout mag nooit meer ongemerkt de deur uit. */
function keurDocumentXml(buf) {
  const { execFileSync } = require('child_process');
  const tmp = path.join(require('os').tmpdir(), 'ang-keuring.docx');
  fs.writeFileSync(tmp, buf);
  try {
    execFileSync(pythonCmd(), [path.join(__dirname, 'keur-docx.py'), tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    throw new Error('het document is niet welgevormd:\n' + (e.stderr || '').toString());
  } finally {
    fs.unlinkSync(tmp);
  }
}

Packer.toBuffer(doc).then(b => {
  keurDocumentXml(b);
  fs.writeFileSync(path.join(ROOT, 'ANG-paper.docx'), b);
  console.log('geschreven:', b.length, 'bytes — XML gekeurd, alle onderdelen welgevormd');
});
