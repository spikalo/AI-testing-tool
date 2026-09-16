/* Werkplan stap 16 — herstructurering op een omgevingssignaal, en de omslagproef opnieuw.

   PRE-REGISTRATIE. Dit bestand wordt gecommit vóórdat er één meetrun gedraaid heeft,
   net als bij stap 12 en stap 13. Wat er wél aan vooraf ging is de kalibratie van de
   detector (tests/stap16-kalibratie.js, tests/stap16-diagnose.js), en die is met opzet
   uitsluitend op de KLOKCONDITIE gedaan: daar loopt de detector mee zonder iets te
   sturen, dus er was geen uitkomstmaat om op te kiezen. Gemeten is alleen of de poort
   in een stilstaande fase stil blijft en bij een omslag aanslaat. De hersteltijd, het
   behoud en de benchmark zijn bij die keuze niet bekeken en konden dat ook niet zijn.

   DE VRAAG. Stap 13 vond geen herstelvoordeel van structurele plasticiteit bij een
   omslag, en vond ook de reden: de herstructurering loopt op een klok (`structEvery`)
   en piekt niet na een omslag. Stap 14 verfijnde dat — de hoeveelheid churn per
   klokslag hangt wél samen met een lokaal stagnatiesignaal, maar stagnatie is niet
   dezelfde as als een omslag. Daarmee rust de verklarende kant van de paper op een
   correlatie die deels circulair te lezen is. Hier wordt de oorzaak getoetst in plaats
   van aangewezen: vervang de klok door een aansturing op de omgeving en draai de
   omslagproef van stap 13 verder onveranderd opnieuw.

   WAAROM DE INVOER EN NIET DE BELONING. Zie het blokcommentaar bij driftStap() in
   brein-test.html. Kort: een poort op de lopende beloningsbasislijn is precies wat
   stap 14 al gemeten heeft, en is circulair te lezen. De invoerstatistiek verschuift
   bij een omslag ongeacht hoe goed de agent speelt.

   WAAROM ER EEN BUDGETCONTROLE BIJ MOET. Een signaalgestuurde poort verbouwt niet
   alleen op andere momenten maar ook een ander aantal keren dan een klok. Zonder
   controle is een verschil in herstel niet toe te schrijven aan het moment; het kan
   even goed de hoeveelheid zijn. `ang-budget` is daarom een klok waarvan de periode
   per zaad zó gezet wordt dat het aantal herstructureringsronden dat van het
   signaalleven met hetzelfde zaad benadert. Zelfde hoeveelheid, verkeerd moment.

   ÉÉN LEERSNELHEID PER LEVEN, en verder alles precies als in stap 13: dezelfde fasen,
   dezelfde zaden, dezelfde meetpunten, dezelfde herstelregel. Alleen de aansturing van
   de herstructureringspoort verschilt, want dat is de vraag.                         */

const VAST = { structOn: false, growOn: false, retypeOn: false };
const MIDDEN = 20;

/* De fasen, de zaden en de meetregels komen ongewijzigd uit stap 13. Ze hier opnieuw
   opschrijven zou betekenen dat twee bestanden hetzelfde moeten blijven zeggen, en dat
   is precies hoe een vergelijking stilletjes scheef gaat. */
const { FASEN, MEET_SEED0, MEET_N, MEETPUNT,
  PLATEAU_VENSTER, HERSTEL_DREMPEL, OMSLAG_VENSTER } = require('./stap13-condities');

/* De detectorinstelling, vastgelegd na de kalibratie en vóór de eerste meetrun.
   Onderbouwing per waarde staat in experimenten/s16-kalibratie.json en in
   claude/ang-signaalsturing.md. */
const DETECTOR = { sigFast: 20, sigSlow: 150, sigK: 3, sigWarmup: 150, sigBuffer: 200 };

/* Het stagnatievenster van isStagnating() hing tot nu toe aan structEvery. Voor
   `ang-budget`, die structEvery juist verzet, zou dat betekenen dat er stilzwijgend
   een tweede ding meeverandert. Alle condities pinnen het daarom op de waarde die de
   klokconditie sowieso had. */
const STAGVENSTER = 10;

const CONDITIES = [
  { naam: 'ang-klok', lr: 0.008, ov: { stagVenster: STAGVENSTER },
    rol: 'de klokconditie van stap 13, ongewijzigd — het ijkpunt, en tegelijk de ' +
      'controle dat de nieuwe knop in haar uitstand niets doet' },
  { naam: 'ang-signaal', lr: 0.008, ov: { structSignal: true, stagVenster: STAGVENSTER, ...DETECTOR },
    rol: 'dezelfde wolk, maar de herstructurering wordt aangestuurd door een detector ' +
      'op de invoerstatistiek in plaats van door een klok — dit ís de vraag' },
  { naam: 'ang-budget', lr: 0.008, ov: { stagVenster: STAGVENSTER },
    perZaadUitSignaal: true,
    rol: 'een klok met per zaad dezelfde hoeveelheid herstructurering als het ' +
      'signaalleven, maar op de verkeerde momenten — scheidt het moment van de hoeveelheid' },
  { naam: 'ang-vast', lr: 0.008, ov: { ...VAST, stagVenster: STAGVENSTER },
    rol: 'structuur bevroren — waartegen "levert plasticiteit iets op" gemeten wordt' }
];

/* ---------------------------------------------------------------------------
   VOORSPELLINGEN. Vastgelegd vóór de eerste meetrun. Elke voorspelling heeft een
   uitgeschreven onwaar-tak, want een voorspelling zonder onwaar-tak is geen
   voorspelling maar een hoop.

   TWEE FAMILIES, EN ZE ZIJN NIEUW. V2 tot en met V4 gaan over herstel, V5 over
   behoud. Ze krijgen een eigen Holm-correctie binnen deze stap en worden niet bij de
   families van stap 13 gevoegd: een familie die later wordt toegevoegd, krijgt een
   eigen familie (vaste regel, stap 12b), anders verschuift een nieuwe vraag met
   terugwerkende kracht de eerder gerapporteerde waarden. V1 is geen uitkomst maar een
   controle op de ingreep en staat buiten beide families.
   --------------------------------------------------------------------------- */
const VOORSPELLINGEN = [
  { id: 'V1', wat: 'de poort vuurt in de vijftig pogingen na een omslag vaker dan daarbuiten',
    soort: 'controle op de ingreep, geen uitkomstmaat',
    toets: 'gepaard per zaad, tekentoets op (vuurkans na de omslag − vuurkans daarbuiten), ' +
      'binnen ang-signaal, beide omslagen apart',
    waar: 'De poort doet waarvoor zij gebouwd is en de rest van de stap meet wat zij zegt ' +
      'te meten: herstructurering die op de omgeving reageert in plaats van op een klok.',
    onwaar: 'Dan is de ingreep mislukt en meet geen enkele vergelijking hierna nog wat zij ' +
      'belooft. De stap rapporteert dan een mislukte manipulatie en verder niets — ' +
      'de uitkomstmaten worden in dat geval niet uitgelegd alsof ze over aansturing gaan.' },

  { id: 'V2', wat: 'ang-signaal herstelt na de terugslag naar A sneller dan ang-klok',
    familie: 'herstel',
    toets: 'Mann-Whitney op hersteltijd, Holm binnen de familie herstel',
    waar: 'De negatieve bevinding van stap 13 lag aan de aansturing en niet aan de ' +
      'structurele plasticiteit zelf. De claim van de paper wordt dan smaller én sterker: ' +
      'niet "deze plasticiteit betaalt zich niet terug", maar "zij heeft een ' +
      'omgevingsaanleiding nodig, en mét die aanleiding betaalt zij zich wél terug".',
    onwaar: 'Ook op het juiste moment verbouwen levert geen herstelvoordeel op. Dan is de ' +
      'negatieve bevinding niet langer aan één ontwerpkeuze toe te schrijven en rust de ' +
      'verklarende kant van de paper op een getoetste oorzaak in plaats van op een ' +
      'aangewezen correlatie. Dat maakt het verhaal af in plaats van het te ondermijnen, ' +
      'en het is de waarschijnlijkste uitkomst.' },

  { id: 'V3', wat: 'ang-signaal herstelt sneller dan ang-vast',
    familie: 'herstel',
    toets: 'Mann-Whitney op hersteltijd, Holm binnen de familie herstel',
    waar: 'Structurele plasticiteit levert, mits op een omgevingssignaal aangestuurd, ' +
      'aanpassingssnelheid op die een bevroren structuur niet heeft. Dit is de vraag die ' +
      'V1 van stap 13 stelde, nu met een aansturing die de vraag niet bij voorbaat ' +
      'onbeantwoordbaar maakt.',
    onwaar: 'Dan strekt de conclusie van stap 12 en 13 zich uit tot een omgevingsgestuurde ' +
      'variant: bevroren is niet slechter, ook niet bij een omslag, ook niet als er op het ' +
      'juiste moment verbouwd wordt. Dat is de scherpst mogelijke negatieve uitspraak die ' +
      'dit werk kan doen, en zij is netjes afgebakend tot deze taakfamilie.' },

  { id: 'V4', wat: 'het verschil tussen ang-signaal en ang-budget is groter dan dat tussen ' +
      'ang-budget en ang-klok',
    familie: 'herstel',
    toets: 'Mann-Whitney op hersteltijd voor beide paren, Holm binnen de familie herstel; ' +
      'de vergelijking van de twee verschillen wordt beschrijvend gerapporteerd, met ' +
      'beide intervallen erbij',
    waar: 'Wat telt is het moment van verbouwen en niet de hoeveelheid. Dat is de uitspraak ' +
      'die "op een omgevingssignaal" inhoud geeft.',
    onwaar: 'Wat er aan verschil is, komt van hoevéél er verbouwd wordt en niet van wannéér. ' +
      'Dan is de signaalpoort in feite een knop op de hoeveelheid herstructurering, en zo ' +
      'hoort zij dan ook beschreven te worden — niet als aansturing op de omgeving.' },

  { id: 'V5', wat: 'ang-signaal verliest tijdens de knipperfase niet méér van taak A dan ang-klok',
    familie: 'behoud',
    toets: 'Mann-Whitney op behoud = benchmark op A aan het eind van B min die aan het eind van A1',
    waar: 'Een omgevingsgestuurde poort koopt haar aanpassing niet met extra vergeten. ' +
      'Stap 13 vond geen stabiliteit-plasticiteitsruilpunt; dat blijft dan zo.',
    onwaar: 'Gerichte plasticiteit kost wél extra behoud. Dan wordt het ruilpunt dat stap 13 ' +
      'niet kon aantonen hier alsnog zichtbaar, en is dat de vondst van de stap — ook als ' +
      'V2 en V3 onwaar zijn, want dan is de prijs zichtbaar zonder de opbrengst.' }
];

module.exports = { CONDITIES, DETECTOR, STAGVENSTER, VOORSPELLINGEN,
  FASEN, MEET_SEED0, MEET_N, MEETPUNT, MIDDEN,
  PLATEAU_VENSTER, HERSTEL_DREMPEL, OMSLAG_VENSTER };
