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
const VERSIE = '1.2';
const DATUM = '9 september 2026';
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

function figure(path, capNum, capText, widthPt = 470) {
  const { execSync } = require('child_process');
  const dims = execSync(`python3 -c "from PIL import Image;im=Image.open('${path}');print(im.width,im.height)"`)
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
    text: 'Een zelfstructurerend neuraal netwerk zonder lagen en zonder backpropagation',
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
      'structurele plasticiteit en de meetinstrumenten volledig, met een referentiemeting over twaalf ' +
      'onafhankelijke breinzaden en een numerieke controle van de leerregel zelf. Die controle laat zien dat de ' +
      'exacte score-functie voor de uitvoerknopen de gradiënt nauwkeurig volgt, dat de node-perturbatieschatter ' +
      'de goede richting aanwijst maar veel ruwer, en dat de twee delen van de update niet op dezelfde schaal ' +
      'staan. De ablaties en de basislijnen volgen in een latere versie.'
  })]
}));
C.push(new Paragraph({
  spacing: { after: 260 },
  indent: { left: 340, right: 340 },
  children: [
    new TextRun({ text: 'Trefwoorden: ', font: SERIF, size: 18, bold: true, color: DIM }),
    new TextRun({
      text: 'zelfstructurerende netwerken · reward-gemoduleerde plasticiteit · node-perturbatie · ' +
        'beleidsgradiënt · structurele plasticiteit · interpreteerbaarheid',
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
  t('Daarbij hoort een waarschuwing die wij pas bij het meten hebben ontdekt. Standaard mag een worker-neuron '),
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

/* --- 3.5.1: het implementatiedetail, met de meting erbij ---------------------
   Dit kader wordt uit experimenten/trace-voor-na.json opgebouwd. Ontbreekt dat
   bestand, dan zegt de tekst dat de meting nog moet gebeuren in plaats van een
   getal te verzinnen. */
C.push(h3('Een implementatiedetail dat er wél toe doet'));
C.push(body(
  'Tot 9 september 2026 stond in de implementatie de activatie ná de propagatie op de plaats van x̃ᵢ. De ' +
  'leerregel die daadwerkelijk draaide was daarmee, voor elke verbinding die uit de wolk vertrok, één ' +
  'propagatiestap uit de pas met de regel die hierboven beschreven staat. Wij melden dit niet uit ' +
  'volledigheidsdrang: het is precies de term waarop de aanspraak van sectie 3.4 rust, en een lezer die de ' +
  'code naast de formules legt hoort geen verschil te vinden.'
));
if (TRACE) {
  const M = TRACE.maten, N = TRACE.zaden;
  const v = (o) => (100 * o.m).toFixed(1) + '% ± ' + (100 * o.ci).toFixed(1);
  const vd = (o) => (o.m >= 0 ? '+' : '') + (100 * o.m).toFixed(1) + ' ± ' + (100 * o.ci).toFixed(1) + ' pp';
  const rij = (naam, k) => [naam, v(M[k].oud), v(M[k].nieuw), vd(M[k].verschilGepaard),
    'p = ' + M[k].mannWhitney.p.toFixed(3)];
  C.push(tbl(
    ['maat', 'oude term', 'juiste term', 'verschil (gepaard)', 'Mann-Whitney'],
    [rij('succes over de laatste 20 pogingen', 'succes20'),
     rij('toets op onbekende werelden', 'toets'),
     rij('succes over de hele training', 'succes')],
    [2700, 1600, 1600, 1900, 1272]
  ));
  const b = M.toets, sig = b.mannWhitney.p < 0.05;
  if (GRADD) C.push(body(
    'Waarom het verschil in de praktijk klein blijft, bleek pas bij de controle van sectie 3.11: over een losse ' +
    'tik met een willekeurige wolktoestand schelen de twee sporen tientallen procenten, maar in het ' +
    'beloningsgewogen gemiddelde over een hele poging is het verschil ' +
    (100 * GRADD.punten[0].verschilOudNieuw).toFixed(1) + ' %. De toestand van de wolk verandert langzaam, dus de ' +
    'activatie van vóór en ná één propagatiestap lijken sterk op elkaar.'));
  C.push(body(
    `De correctie is gemeten en niet aangenomen: ${N} breinzaden per conditie, ` +
    `${TRACE.pogingenPerRun} pogingen per run, verder identieke instellingen en dezelfde wereldzaden. ` +
    (sig
      ? 'Het verschil op de toets is groter dan de spreiding tussen zaden. De cijfers elders in dit document ' +
        'zijn met de juiste term gemeten; oudere reeksen zijn in runs.csv herkenbaar aan de kolom traceOud.'
      : 'Het verschil op de toets valt binnen de spreiding tussen zaden: op deze taak leerde het netwerk ook ' +
        'met de foutieve term, en de correctie levert geen aantoonbare winst in prestatie op. Dat maakt haar ' +
        'niet minder nodig — de formule en de code beschrijven nu hetzelfde algoritme, en de numerieke ' +
        'controle van sectie 3.4 is pas zinvol als dat zo is — maar het is geen resultaat dat wij als ' +
        'verbetering mogen presenteren.') +
    ' Beide reeksen staan volledig in experimenten/runs.csv onder de condities trace-oud en trace-nieuw.'
  ));
} else {
  C.push(body(
    'De voor/na-vergelijking van beide varianten is nog niet gedraaid; zodra ' +
    'experimenten/trace-voor-na.json bestaat, verschijnt hier de gemeten tabel.'
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
  t('Bij het toetsen op onbekende werelden ligt een fout op de loer die wij eerst zelf gemaakt hebben. Het beleid '),
  it('is'), t(' stochastisch: elke knop is een kans en de actie wordt geloot. Het is verleidelijk om bij een toets ' +
    'de loting weg te laten en steeds de waarschijnlijkste knop te nemen, want dat lijkt "het geleerde beleid ' +
    'zonder ruis". Dat is het niet — het is een ander, en meetbaar slechter beleid. Een agent die deterministisch ' +
    'twee knoppen tegelijk ingedrukt houdt tegen een muur, blijft daar oneindig staan; dezelfde kansen laten hem ' +
    'binnen een paar stappen loskomen.')
]));
C.push(body(
  'De toets draait daarom met dezelfde loting als tijdens het leren, maar zonder leren, zonder ruis in de wolk en ' +
  'met een eigen toevalsgenerator, zodat de toets reproduceerbaar is en de training niet verstoort. De strengere ' +
  'variant blijft als optie beschikbaar; het verschil tussen beide is zelf een interessante meting, want het zegt ' +
  'hoeveel van de prestatie op de scherpte van de beslissingen berust en hoeveel op het blijven bewegen.'
));

C.push(h1('6', 'Het meten van de gevormde structuur'));
C.push(body(
  'Wat een ANG uiteindelijk gebouwd heeft, is de eigenlijke uitkomst. De volgende maten worden op de actieve ' +
  'deelgraaf berekend, dat wil zeggen op de verbindingen die zwaar genoeg zijn om ertoe te doen:'
));
C.push(eq(33));
C.push(body([
  t('De drempel is bewust '), it('relatief'), t(' aan het zwaarste gewicht dat er werkelijk is, en niet aan het ' +
    'plafond w'), t('max'), t('. Gewichten blijven in de praktijk ruim onder dat plafond; een absolute drempel ' +
    'verklaart daardoor bijna elke verbinding voor inactief en laat een werkend brein structuurloos lijken. Dat is ' +
    'geen theoretisch punt: in een eerdere versie van de meetcode gebeurde precies dat.')
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
    ['—', 'werelden per toets', '20', 'sectie 5.4']
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

/* ===== 10 ===== */
C.push(h1('10', 'Evaluatie'));
C.push(body(
  'De meetopzet is met opzet niet ingericht om te laten zien dat het model werkt, maar om uit elkaar te trekken ' +
  'wáár een eventuele prestatie vandaan komt. Deze versie van het document bevat de referentiemeting en de ' +
  'reproduceerbaarheidscontrole, en sectie 3.11 de numerieke controle van de leerregel zelf; de ablaties en de '+
  'basislijnen volgen in een latere versie.'
));
C.push(h2('10.1', 'Twee meetassen'));
C.push(body(
  'Prestatie wordt gescheiden gemeten op de werelden waarin getraind is en op werelden die het netwerk nooit ' +
  'gezien heeft. Het verschil tussen die twee is de eigenlijke grootheid: het onderscheidt het uit het hoofd leren ' +
  'van een route van het leren navigeren. Daarnaast wordt na elke run de gevormde structuur met de maten uit ' +
  'sectie 6 vastgelegd, zodat de vraag beantwoord kan worden welke structurele eigenschappen met goed presteren ' +
  'samenhangen. Als referentiepunt dient een zuiver reactieve agent die recht op het doel af loopt en langs ' +
  'obstakels glijdt; die geeft aan wat zonder geheugen of planning haalbaar is.'
));
C.push(body([
  bd('Over onzekerheid. '),
  t('De spreiding tussen zaden is bij deze leerregel aanzienlijk, en een gemiddelde zonder interval is daarom ' +
    'misleidend. Alle getallen hieronder staan als gemiddelde met een 95%-interval over de zaden. Overlappen twee ' +
    'intervallen elkaar ruim, dan is een verschil niet aangetoond, hoe suggestief het gemiddelde ook oogt.')
]));

/* --- referentiemeting, opgebouwd uit runs.csv --- */
if (RUNS && RUNS.length) {
  /* De referentiemeting hoort bij de leerregel zoals die nu is: de conditie
     trace-nieuw. De oudere rijen 'standaard' draaiden met de foutieve trace
     (kolom traceOud = 1) en worden hier niet meegenomen. */
  const R0 = RUNS.filter(r => r.conditie === 'trace-nieuw');
  const R1 = R0.length ? R0 : RUNS.filter(r => r.conditie === 'standaard');
  const R = R1.length ? R1 : RUNS;
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
  C.push(h2('10.2', 'Referentiemeting'));
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
      ['toets op onbekende werelden', pct(ev), pctSd(ev), (100 * ev.min).toFixed(0) + '–' + (100 * ev.max).toFixed(0) + '%'],
      ['stappen bij een geslaagde poging', num(st, 0), st.sd.toFixed(0), st.min.toFixed(0) + '–' + st.max.toFixed(0)],
      ['rekentijd per run (s)', num(tm, 1), tm.sd.toFixed(1), tm.min.toFixed(0) + '–' + tm.max.toFixed(0)]
    ],
    [3000, 2100, 1800, 2172]
  ));
  C.push(gap(60));
  C.push(body([
    t('Het verschil tussen de laatste twintig trainingspogingen ('), bd(pct(s20)),
    t(') en de toets op werelden die het netwerk nooit gezien heeft ('), bd(pct(ev)),
    t(') is ' + (100 * (s20.m - ev.m)).toFixed(1) + ' procentpunt. Dat gat is de kern van de vraag waaruit dit werk ' +
      'voortkomt. Het is klein genoeg om te concluderen dat er navigatiegedrag geleerd is en niet louter een route ' +
      'onthouden, en groot genoeg om te laten zien dat het onthouden meespeelt. De sd van ' + pctSd(s20) +
      ' op de trainingsscore is bovendien het getal dat bepaalt hoeveel zaden een latere vergelijking nodig heeft: ' +
      'met deze spreiding is een verschil van tien procentpunt pas boven de ruis bij ruwweg zestien runs per conditie.')
  ]));
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

C.push(h2('10.3', 'Wat hierna gemeten wordt'));
C.push(body(
  'De referentiemeting hierboven zegt op zichzelf nog niets over de vraag of de graafstructuur iets bijdraagt. ' +
  'Daarvoor zijn condities nodig die telkens één onderdeel wegnemen, en basislijnen die telkens één aanname ' +
  'wegnemen. De volgende versie van dit document rapporteert:'
));
C.push(bullet([bd('Ablaties. '), t('Tien condities die elk één mechanisme uitzetten — geheugen-neuronen, ' +
  'reflex-neuronen, invoer-neuronen, snoeien, aangroei, neuronale groei, soortverandering, de soortregels zelf, ' +
  'en als uiterste de volledig bevroren structuur waarin alleen de gewichten nog leren.')]));
C.push(bullet([bd('Basislijn met dezelfde leerregel. '), t('Een gelaagd netwerk met hetzelfde parameterbudget, ' +
  'getraind met exact de leerregel uit sectie 3. Dit isoleert wat de structuur bijdraagt; zonder deze conditie is ' +
  'niet uit te sluiten dat de leerregel alleen het werk doet.')]));
C.push(bullet([bd('Basislijnen met backpropagation. '), t('Twee kleine MLP\'s en een GRU, getraind met een ' +
  'gewone policy-gradient. Dit isoleert wat er wordt opgegeven door geen backpropagation te gebruiken. Dat is een ' +
  'andere vraag dan de vorige, en beide zijn nodig.')]));
C.push(bullet([bd('Rekenkosten, apart geteld. '), t('Sample-efficiëntie (omgevingsstappen tot een drempel), ' +
  'rekenefficiëntie (kanten-bezoeken tot diezelfde drempel), wandkloktijd en inferentiekosten worden los ' +
  'gerapporteerd. Zij vallen zelden samen, en één cijfer voor "efficiëntie" verbergt meer dan het laat zien.')]));
C.push(bullet([bd('De schaal van het wolkdeel van de update. '), t('Sectie 3.11 laat zien dat het ' +
  'node-perturbatiedeel twee ordes te klein is ten opzichte van het score-functiedeel. De ontbrekende factor ' +
  'toevoegen is één regel code, maar vraagt om de leersnelheid en de stapbegrenzing samen opnieuw af te stellen; ' +
  'dat wordt als volwaardige conditie gemeten, niet als aanname doorgevoerd.')]));
C.push(bullet([bd('Een tweede taak. '), t('In de huidige taak is het doel altijd zichtbaar; er valt niets te ' +
  'onthouden, en elke uitspraak over de geheugen-neuronen is daarmee betekenisloos. Een tweede taak waarin het ' +
  'doel na verloop van tijd verdwijnt terwijl er tegelijk obstakels opduiken die binnen één tik ontweken moeten ' +
  'worden, is de eerste opzet waarin de twee soorten paden — kort en reflexmatig, lang en met geheugen — ook ' +
  'werkelijk allebei nodig zijn.')]));
C.push(body(
  'Bij dat laatste hoort een afbakening die dit document eerder te ruim liet. ANG is geen goedkoper alternatief ' +
  'voor backpropagation, en op een taak als deze zal een klein gelaagd netwerk vermoedelijk op rekenkosten winnen. ' +
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
  'moet gebeuren in plaats van een getal te noemen. Ten tweede: de referenties zijn nog niet stuk voor stuk tegen ' +
  'de originelen geverifieerd. Tot dat gebeurd is, moet de lezer de bibliografie met gepaste argwaan lezen — ' +
  'juist bij een document dat op deze manier tot stand is gekomen.'
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
  'Bogdan, P. A., Rowley, A. G. D., Rhodes, O., & Furber, S. B. (2018). Structural plasticity on the SpiNNaker many-core neuromorphic system. Frontiers in Neuroscience, 12.',
  'Chklovskii, D. B., Mel, B. W., & Svoboda, K. (2004). Cortical rewiring and information storage. Nature, 431(7010), 782–788.',
  'Fiete, I. R., & Seung, H. S. (2006). Gradient learning in spiking neural networks by dynamic perturbation of conductances. Physical Review Letters, 97(4), 048104.',
  'Frémaux, N., & Gerstner, W. (2016). Neuromodulated spike-timing-dependent plasticity and theory of three-factor learning rules. Frontiers in Neural Circuits, 9, 85.',
  'Holtmaat, A., & Svoboda, K. (2009). Experience-dependent structural synaptic plasticity in the mammalian brain. Nature Reviews Neuroscience, 10(9), 647–658.',
  'Izhikevich, E. M. (2007). Solving the distal reward problem through linkage of STDP and dopamine signaling. Cerebral Cortex, 17(10), 2443–2452.',
  'Jaeger, H. (2001). The "echo state" approach to analysing and training recurrent neural networks. GMD Report 148.',
  'Maass, W., Natschläger, T., & Markram, H. (2002). Real-time computing without stable states: a new framework for neural computation based on perturbations. Neural Computation, 14(11), 2531–2560.',
  'Ng, A. Y., Harada, D., & Russell, S. (1999). Policy invariance under reward transformations: theory and application to reward shaping. Proceedings of ICML, 278–287.',
  'Seung, H. S. (2003). Learning in spiking neural networks by reinforcement of stochastic synaptic transmission. Neuron, 40(6), 1063–1073.',
  'Stanley, K. O., & Miikkulainen, R. (2002). Evolving neural networks through augmenting topologies. Evolutionary Computation, 10(2), 99–127.',
  'Sutton, R. S., & Barto, A. G. (2018). Reinforcement Learning: An Introduction (2e druk). MIT Press.',
  'Williams, R. J. (1992). Simple statistical gradient-following algorithms for connectionist reinforcement learning. Machine Learning, 8, 229–256.',
  'Xie, S., Kirillov, A., Girshick, R., & He, K. (2019). Exploring randomly wired neural networks for image recognition. Proceedings of ICCV, 1284–1293.',
  'You, J., Leskovec, J., He, K., & Xie, S. (2020). Graph structure of neural networks. Proceedings of ICML, 10881–10891.'
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
    execFileSync('python3', [path.join(__dirname, 'keur-docx.py'), tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
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
