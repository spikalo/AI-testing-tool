/* Werkplan stap 13 — één leven, twee omslagen, en de voorspellingen vooraf.

   PRE-REGISTRATIE. Dit bestand wordt gecommit vóórdat er één run gedraaid heeft, net
   als bij stap 12. Dat is hier extra nodig, want dit is de laatste meting waarin het
   model nog iets kan laten zien wat een vaste architectuur niet heeft — en juist dan
   is de verleiding het grootst om achteraf een gunstige lezing te kiezen.

   DE VRAAG. Twee taken apart trainen en de uitkomsten vergelijken bewijst niets over
   aanpassingsvermogen: een vast net dat je apart op A en op B traint krijgt óók twee
   verschillende gewichtssets. Wat een vaste architectuur principieel niet heeft, is
   de mogelijkheid haar rekenstructuur te verbouwen tijdens één leven. Dus: één
   doorlopend leven van 900 pogingen waarin de omgeving twee keer omslaat, zonder
   waarschuwing, zonder reset, en zonder dat het brein te horen krijgt dat er iets
   veranderd is.

     pogingen 0–299     doel altijd zichtbaar
     pogingen 300–599   doel knippert: tien stappen aan, twintig uit
     pogingen 600–899   doel weer altijd zichtbaar

   Waarom twintig uit en niet tien. Bij tien uit verandert er voor de vaste netten
   nauwelijks iets (65 → 65 % en 67 → 78 %), en dan is er geen omslag om van te
   herstellen. Bij twintig uit zakt het geheugenloze net van 67 naar 26 % en verandert
   er voor élke architectuur werkelijk iets. Dat ANG die middenfase niet gaat beheersen
   is bekend uit stap 12 en is geen bezwaar: de middenfase is hier een verstoring, en
   de vraag is hoe het systeem ermee omgaat en ervan herstelt — niet of het hem leert.

   ÉÉN LEERSNELHEID PER LEVEN. Het brein weet niet dat de omgeving omslaat, dus mag de
   leersnelheid ook niet meeschakelen. Elke conditie draait het hele leven op de waarde
   die op taak A voor haar gekozen is. De exploratie loopt over het héle leven terug en
   begint niet per fase opnieuw: zou zij dat wel doen, dan kreeg elke omslag er gratis
   een portie exploratiedrift bij en meet de hersteltijd die portie in plaats van het
   aanpassingsvermogen.                                                               */

const VAST = { structOn: false, growOn: false, retypeOn: false };
const MIDDEN = 20;

const FASEN = [
  { naam: 'A1', pogingen: 300, ov: { goalBlink: 0 } },
  { naam: 'B',  pogingen: 300, ov: { goalBlink: MIDDEN } },
  { naam: 'A2', pogingen: 300, ov: { goalBlink: 0 } }
];

const CONDITIES = [
  { naam: 'ang', lr: 0.008, ov: {},
    rol: 'de wolk met structurele plasticiteit' },
  { naam: 'ang-vast', lr: 0.008, ov: { ...VAST },
    rol: 'dezelfde wolk, structuur bevroren — het verschil met "ang" ís de vraag' },
  { naam: 'ang-geensnoei', lr: 0.008, ov: { pruneT: 0 },
    rol: 'plasticiteit aan maar zonder snoeien — de verdachte uit stap 12' },
  { naam: 'elman-16-bp', lr: 0.008, ov: { layered: true, layerSizes: [16], prop: 2, recurrent: true, gradExact: true, ...VAST },
    rol: 'vast recurrent net met BPTT — de sterke basislijn' },
  { naam: 'mlp-16-bp', lr: 0.016, ov: { layered: true, layerSizes: [16], prop: 2, gradExact: true, ...VAST },
    rol: 'geheugenloos net met BPTT — de vloer' }
];

const MEET_SEED0 = 1000, MEET_N = 12;
/* Op elke fasegrens een benchmark op de taak van dat moment én op taak A, plus de
   blinderingsproef. Kleiner dan de gewone benchmark omdat er zes per leven zijn; de
   vergelijking is binnen dit bestand en heeft dus geen last van een andere n. */
const MEETPUNT = { benchN: 200, benchReps: 1, memN: 50, memBlind: 20, memH: 40 };

/* HERSTELTIJD. Het plateau van fase A1 is het gemiddelde van succes20 over de laatste
   vijftig pogingen van die fase. Hersteld heet het leven op de eerste poging ná de
   terugslag waar succes20 weer boven 95 % van dat plateau ligt. Haalt het dat binnen
   de derde fase niet, dan is de hersteltijd niet 300 maar ontbrekend — een gecensureerde
   waarneming. Mann-Whitney gaat over rangen en kan daarmee om zolang we censurering als
   "langer dan alles wat wél hersteld is" behandelen; dat gebeurt in de loper expliciet
   en het aantal gecensureerde levens wordt apart gerapporteerd. */
const PLATEAU_VENSTER = 50, HERSTEL_DREMPEL = 0.95, OMSLAG_VENSTER = 50;

/* ---------------------------------------------------------------------------
   VOORSPELLINGEN. Vastgelegd vóór de eerste run. Elke voorspelling heeft een
   uitgeschreven onwaar-tak, want een voorspelling zonder onwaar-tak is geen
   voorspelling maar een hoop.
   --------------------------------------------------------------------------- */
const VOORSPELLINGEN = [
  { id: 'V1', wat: 'ang herstelt na de terugslag naar A sneller dan ang-vast',
    toets: 'Mann-Whitney op hersteltijd, ang tegen ang-vast, Holm binnen de familie herstel',
    waar: 'Structurele plasticiteit levert aanpassingssnelheid op die een bevroren structuur ' +
      'niet heeft. Dat is het eerste voordeel van dit model dat niet over eindprestatie gaat, ' +
      'en het is precies het soort voordeel dat je van plasticiteit zou verwachten.',
    onwaar: 'Dan is de plasticiteit ook bij een omslag geen voordeel, en strekt de conclusie van ' +
      'stap 12 — bevroren is niet slechter, op de moeilijke standen zelfs beter — zich uit tot ' +
      'niet-stationaire omgevingen. Dat is een scherpere negatieve uitspraak dan we nu hebben, ' +
      'en zo hoort hij in de paper: niet als tegenvaller maar als afbakening.' },

  { id: 'V2', wat: 'de herstructureringsactiviteit van ang piekt in de vijftig pogingen na een omslag',
    toets: 'gepaard per zaad: gebeurtenissen per poging in de vijftig pogingen na de omslag ' +
      'tegen de vijftig ervoor',
    waar: 'Het mechanisme reageert op de omgeving en niet alleen op de klok. Dat is ook ' +
      'interessant als V1 onwaar is: het systeem verbouwt wél op het juiste moment, maar dat ' +
      'helpt niet. Dan gaat de negatieve uitspraak over de aansturing van plasticiteit, niet ' +
      'over plasticiteit als zodanig — een veel bruikbaarder resultaat.',
    onwaar: 'De herstructurering loopt op een klok (structEvery) en is blind voor wat er in de ' +
      'omgeving gebeurt. Dan is dat de ontwerpfout die de paper moet benoemen, en meteen de ' +
      'duidelijkste aanwijzing voor wat een volgende versie anders moet doen.' },

  { id: 'V3', wat: 'ang verliest tijdens de knipperfase meer van taak A dan ang-vast',
    toets: 'Mann-Whitney op behoud = benchmark op A aan het eind van B min die aan het eind van A1',
    waar: 'Plasticiteit koopt aanpassing met vergeten: het stabiliteit-plasticiteitsruilpunt, ' +
      'hier gemeten binnen één leven in plaats van tussen twee trainingen.',
    onwaar: 'Dan verbouwt ANG zonder meer te vergeten dan een bevroren net. Op deze schaal is er ' +
      'geen ruilpunt zichtbaar, en dan mag de paper het ook niet suggereren.' },

  { id: 'V4', wat: 'ang-geensnoei (pruneT = 0) herstelt sneller dan ang',
    toets: 'Mann-Whitney op hersteltijd, Holm binnen de familie herstel',
    waar: 'Het snoeien is de boosdoener: tijdens de moeilijke fase gooit het model capaciteit weg ' +
      'die het daarna terug moet groeien. Dat is een concrete en herstelbare ontwerpfout, en de ' +
      'duidelijkste aanwijzing die stap 12 heeft opgeleverd.',
    onwaar: 'De verdachte uit stap 12 is vrijgesproken; het verlies zit niet in het snoeien, en ' +
      'de zoektocht naar de oorzaak begint opnieuw bij de overige mechanismen.' },

  { id: 'V5', wat: 'elman-16-bp herstelt niet sneller dan ang',
    toets: 'Mann-Whitney op hersteltijd, Holm binnen de familie herstel',
    waar: 'Dan is er ten minste één as waarop ANG niet onderdoet voor de sterke basislijn, ' +
      'ondanks de lagere eindprestatie uit stap 12. Dat is de as waar de paper over gaat.',
    onwaar: 'Dan wint een vaste structuur met gradiëntleren ook op aanpassingssnelheid, en is de ' +
      'eerlijke samenvatting dat structurele plasticiteit in deze vorm nergens een meetbaar ' +
      'voordeel geeft: niet in eindprestatie, niet in geheugen, niet in aanpassing. Dat blijft ' +
      'publiceerbaar, maar dan draagt het instrument de bijdrage — de blinderingsproef en de ' +
      'omslagproef — en niet het model.' }
];

module.exports = { FASEN, CONDITIES, MEET_SEED0, MEET_N, MEETPUNT, MIDDEN,
  PLATEAU_VENSTER, HERSTEL_DREMPEL, OMSLAG_VENSTER, VOORSPELLINGEN };
