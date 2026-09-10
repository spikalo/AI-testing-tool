/* De condities van werkplan stap 8 — de ablatiereeks, de kerntabel van de paper.

   Stap 5 vroeg wat de grááf waard is, stap 6 wat de schátter waard is, stap 7 wat
   er aan de leerregel te verbeteren valt. Deze reeks vraagt iets anders: van elk
   onderdeel dat het model heeft, wat gebeurt er als het er niet is? Dat is de vraag
   die een lezer als eerste stelt bij een model met vijf soorten neuronen en vier
   vormen van structurele plasticiteit, en het is de enige vraag die per onderdeel
   antwoord geeft in plaats van over het geheel.

   Eén ding staat hier bewust vast wat in stap 7 juist meebewoog: de leersnelheid.
   In stap 7 kreeg elke conditie een eigen veeg, omdat alle vier de ingrepen precies
   de grootheid raakten waar eta op afgesteld is — de schaal van het leersignaal of
   het aantal gewichten dat per tik een duw krijgt. Een ablatie doet dat niet: een
   soort neuronen weglaten of het snoeien uitzetten verandert de graaf, niet de
   schaal van de update. Meesturen van eta zou hier meten hoe goed een conditie
   opnieuw af te stellen is in plaats van wat het weggelaten onderdeel bijdroeg.
   Dus: eta = 0,008 voor alle tien, en die keuze staat als beperking in de paper.  */
const LR = 0.008;

const CONDITIES = [
  /* De referentie draait niet opnieuw. Deze zestien runs staan al in runs.csv en
     zijn met exact deze instellingen gemaakt (stap 4); ze overdoen kost een half
     uur en levert per definitie dezelfde getallen. */
  { naam: 'ang-vol', ov: {}, hergebruik: 'benchmark-standaard',
    vraag: 'referentie' },

  { naam: 's8-geen-mem', ov: { 'types.mem.on': false },
    vraag: 'doet terugkoppeling ertoe?' },
  { naam: 's8-geen-refl', ov: { 'types.refl.on': false },
    vraag: 'doet de korte boog ertoe?' },
  { naam: 's8-geen-sens', ov: { 'types.sens.on': false },
    vraag: 'doet de sensorische laag ertoe?' },
  { naam: 's8-geen-snoeien', ov: { pruneT: 0 },
    vraag: 'is opruimen nodig?' },
  { naam: 's8-geen-sprout', ov: { sprout: 0 },
    vraag: 'is bijgroei van verbindingen nodig?' },
  { naam: 's8-geen-groei', ov: { growOn: false },
    vraag: 'helpt extra capaciteit?' },
  { naam: 's8-geen-hertypering', ov: { retypeOn: false },
    vraag: 'doet de soorttoewijzing ertoe?' },
  { naam: 's8-strenge-invoer', ov: { inputOnlySens: true },
    vraag: 'wat kost de grammatica?' },

  /* Ook deze reeks staat al in runs.csv: het is letterlijk de conditie ang-vast uit
     stap 5, met dezelfde zestien zaden en dezelfde leersnelheid. Hem hier onder een
     nieuwe naam overdoen zou de ablatietabel loskoppelen van de basislijntabel. */
  { naam: 'ang-vast', ov: { structOn: false, growOn: false, retypeOn: false },
    hergebruik: 'ang-vast', vraag: 'doet de plasticiteit als geheel ertoe?' }
];

/* Zestien zaden, niet twaalf. Dit is de kerntabel, en negen vergelijkingen naast
   elkaar betekent dat de p-waarden ook nog een Holm-correctie over de familie
   krijgen — dan is de helft van de wachttijd besparen op zaden een slechte ruil. */
const MEET_SEED0 = 1000, MEET_N = 16;

module.exports = { CONDITIES, LR, MEET_SEED0, MEET_N };
