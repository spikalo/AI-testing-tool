/* Werkplan stap 18, slot — de afsluitende meting op het seinhuis, en de voorspellingen.

   PRE-REGISTRATIE. Gecommit vóórdat er één meetrun gedraaid heeft.

   WAAROM DEZE METING NOG. Frank heeft besloten spel 2 af te sluiten en op te schrijven.
   Maar wat er tot nu toe is, zijn verkenningen: één zaad per variant, op veegzaden. De
   uitspraak die de paper wil doen — "geen enkele architectuur leert hier een regel die
   geheugen vraagt, ook niet met echte terugpropagatie door de tijd" — is een negatieve
   uitspraak, en een negatieve uitspraak op één zaad is een anekdote. Dus één echte reeks:
   twaalf meetzaden, een leersnelheidsveeg per conditie op eigen zaden, en een toets die
   kan zeggen dat iets wél boven nul ligt als het dat doet.

   DE OPZET is de gunstigste die de verkenning heeft opgeleverd, zodat een negatieve
   uitkomst niet aan een slechte keuze te wijten is:
   - een groeiende dienstregeling (1000 diensten per regel), want alle zes tegelijk liet
     in de verkenning élk net instorten;
   - één keuze per tik: niets, of precies één handel;
   - beloning [1.5, -1.5, 0.5, 1.5, 0]: drukken op een afleider kost evenveel als een eis
     missen, en de achtergrond wordt niet afgestraft (anders sterft R1, zie 18b).

   DE SCORE is Youdens J per regel: trefkans(kant 0) + trefkans(kant 1) − 1. Nul betekent
   "de reactie hangt niet af van wat de regel zegt dat ertoe doet"; dat geldt voor altijd
   reageren, nooit reageren én een munt. Perfect is 1.                                */

const VAST = { structOn: false, growOn: false, retypeOn: false };
const GEMEEN = { taak: 'seinhuis', worldEvery: 1, catPolicy: true,
  seinBeloning: [1.5, -1.5, 0.5, 1.5, 0] };
const PER_REGEL = 1000, REGELS = 6;
const FASEN = Array.from({ length: REGELS }, (_, i) =>
  ({ naam: 'R1-R' + (i + 1), pogingen: PER_REGEL, ov: { seinRegels: i + 1 } }));

const CONDITIES = [
  { naam: 's18-ang', ov: {}, veeg: [0.002, 0.008, 0.032],
    rol: 'de wolk met structurele plasticiteit' },
  { naam: 's18-ang-vast', ov: { ...VAST }, veeg: [0.002, 0.008, 0.032],
    rol: 'dezelfde wolk, structuur bevroren' },
  { naam: 's18-mlp-32-bp', ov: { layered: true, layerSizes: [32], prop: 2, gradExact: true, ...VAST },
    veeg: [0.004, 0.016, 0.064], rol: 'geen geheugen — de vloer voor R3-R6' },
  { naam: 's18-elman-32-bp1', ov: { layered: true, layerSizes: [32], prop: 2, gradExact: true, recurrent: true, ...VAST },
    veeg: [0.002, 0.008, 0.032], rol: 'de "Elman met BPTT" van stap 6: in werkelijkheid afgekapt op één tik' },
  { naam: 's18-elman-32-bptt', ov: { layered: true, layerSizes: [32], prop: 2, gradExact: true, recurrent: true, bptt: true, ...VAST },
    veeg: [0.001, 0.004, 0.016], rol: 'Elman met echte terugpropagatie door de hele dienst' },
  { naam: 's18-elman-64-bptt', ov: { layered: true, layerSizes: [64], prop: 2, gradExact: true, recurrent: true, bptt: true, ...VAST },
    veeg: [0.001, 0.004, 0.016], rol: 'hetzelfde, twee keer zo breed — de sterkste tegenstander die er is' }
];

const VEEG_SEED0 = 2000, VEEG_N = 2;
const MEET_SEED0 = 1000, MEET_N = 12;
/* Op elke fasegrens een benchmark op de regels van dat moment, zodat te zien is welke
   regel wanneer valt. Aan het eind de volle benchmark (200 diensten, alle zes regels). */
const MEETPUNT = { benchN: 100, benchReps: 1 };
const GEHEUGENREGELS = ['R3', 'R4', 'R5', 'R6'], TIKREGELS = ['R1', 'R2'];

const VOORSPELLINGEN = [
  { id: 'V1', wat: 'geen enkele conditie leert een regel die geheugen vraagt',
    toets: 'per conditie en per regel R3-R6: tekentoets met exacte permutatie (J > 0) over de 12 zaden, ' +
      'Holm over de 6 x 4 = 24 toetsen samen',
    waar: 'Dan is spel 2 onder deze leerregels voor niemand te leren, en is de afsluiting de juiste ' +
      'beslissing. De paper schrijft dat op als afbakening: een taak met geheugen over vijf tot zeventig ' +
      'tikken ligt buiten wat REINFORCE met deze netten in dit budget haalt — ook met exacte BPTT.',
    onwaar: 'Ten minste één conditie haalt op een geheugenregel een J die na Holm boven nul ligt. Dan is ' +
      'de afsluiting te vroeg: er is een tegenstander die geheugen leert, en stap 19 kan in principe door. ' +
      'Dat wordt dan aan Frank voorgelegd in plaats van opgeschreven als "niemand kan het".' },
  { id: 'V2', wat: 'R1 en R2 worden door alle drie de backpropnetten geleerd',
    toets: 'gemiddelde J op R1 en R2 per conditie, met 95 %-interval over de zaden; "geleerd" = ondergrens > 0,5',
    waar: 'Dan ligt het falen op R3-R6 aan geheugen en niet aan de beloning of het beleid: dezelfde opzet ' +
      'leert de regels die geen geheugen vragen wel.',
    onwaar: 'Dan faalt de opzet al op de eenvoudigste regels en is elke uitspraak over geheugen voorbarig. ' +
      'De paper zegt dan alleen dat het spel niet te leren was, niet waaróm.' },
  { id: 'V3', wat: 'ANG leert R1 en R2 minder goed dan de backpropnetten',
    toets: 'Mann-Whitney op het gemiddelde van J(R1) en J(R2), s18-ang tegen s18-mlp-32-bp; Holm over V3 en V4',
    waar: 'Hetzelfde patroon als op spel 1 (sectie 10.5): lokaal leren kost ten opzichte van de exacte ' +
      'gradiënt. Niets nieuws, maar het hoort er te staan.',
    onwaar: 'ANG doet het op de tikregels even goed of beter. Dat zou op dit spel de eerste as zijn waarop ' +
      'het model niet onderdoet.' },
  { id: 'V4', wat: 'bevroren structuur doet het op R1 en R2 niet slechter dan vrije structuur',
    toets: 'Mann-Whitney op hetzelfde gemiddelde, s18-ang tegen s18-ang-vast',
    waar: 'Het vaste patroon van spel 1 (stap 12, 13, 16): de plasticiteit levert niets op.',
    onwaar: 'De vrije graaf wint hier wél — dan heeft spel 2, ook zonder geheugen, iets opgeleverd wat ' +
      'spel 1 niet liet zien.' },
  { id: 'V5', wat: 'de faalvorm per regel is beschrijvend, niet getoetst',
    toets: 'per conditie en regel de trefkans aan beide kanten: stil (kant 0 < 0,2 en kant 1 > 0,8), ' +
      'reflex (omgekeerd), munt (beide tussen 0,3 en 0,7), of geleerd (J > 0,5)',
    waar: 'Een tabel die laat zien hóe een net faalt, niet alleen dát. Dat is het deel dat buiten dit ' +
      'project bruikbaar is.',
    onwaar: '— (beschrijvend)' }
];

module.exports = { CONDITIES, GEMEEN, FASEN, PER_REGEL, REGELS, VEEG_SEED0, VEEG_N,
  MEET_SEED0, MEET_N, MEETPUNT, GEHEUGENREGELS, TIKREGELS, VOORSPELLINGEN };
