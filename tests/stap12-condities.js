/* Werkplan stap 12 — de taakas, en de voorspellingen vooraf.

   PRE-REGISTRATIE. Dit bestand is met opzet gecommit vóórdat er ook maar één run
   gedraaid heeft, en de git-geschiedenis kan dat aantonen. De reden is de zwakste
   plek van dit project tot nu toe: de structurele maten zijn door mij ontworpen, dus
   "er ontstaat geheugenstructuur" is een uitspraak die ik met genoeg vrijheid altijd
   waar kan maken. Vooraf opschrijven wat elke uitkomst zou betekenen — inclusief de
   uitkomst waarin het model niets bijzonders doet — is de enige manier waarop deze
   reeks iets kan weerleggen in plaats van iets kan illustreren.

   DE AS. Niet twee taken maar één taak met een knop. De eerste opzet gebruikte
   `goalHide`: het doel gaat na k stappen uit en komt niet meer terug. Die is
   gedraaid en meteen weer weggelegd, want bij k = 80 zakte ANG naar 0,3–6 % — ver
   onder alles wat er nog te vergelijken valt. De diagnose staat in de paper en is de
   moeite van het onthouden waard: **permanent verbergen vraagt geen geheugen maar
   koppelnavigatie**. Na tachtig blinde stappen een punt raken met de precisie van een
   doelstraal is een ander en veel moeilijker probleem dan informatie vasthouden, en
   een vloer van nul procent meet niets.

   De as is daarom `goalBlink`: het doel is tien stappen te zien, dan k stappen niet,
   en zo door. De agent moet een onderbreking overbruggen en krijgt daarna weer een
   ijkpunt. 0 is de taak van stap 1 t/m 8, ongewijzigd. De beloning verandert niet mee
   — het spel weet nog steeds waar het doel staat — dus wat er verandert is uitsluitend
   de waarneembaarheid. Dat maakt van de opgave een deels waarneembaar probleem, en
   dat is precies de eigenschap waarvan de literatuur zegt dat terugkoppeling ervoor
   nodig is.

   VIER ARCHITECTUREN, want er zijn drie dingen tegelijk te scheiden:
     wat de taak vraagt        — kan een geheugenloos net het überhaupt?
     wat terugkoppeling waard is — hoe ver komt een vast recurrent net met BPTT?
     wat plasticiteit waard is  — doet de vrije, zichzelf herstructurerende graaf
                                  méér dan diezelfde graaf bevroren?
   Alleen die derde vergelijking gaat over de eigenlijke onderzoeksvraag. De eerste
   twee staan erbij omdat de derde zonder hen niets betekent.                       */

const VAST = { structOn: false, growOn: false, retypeOn: false };

const ARCHITECTUREN = [
  { naam: 'ang', lr: 0.008, ov: {},
    rol: 'de wolk zoals zij is, met structurele plasticiteit' },
  { naam: 'ang-vast', lr: 0.008, ov: { ...VAST },
    rol: 'dezelfde wolk, structuur bevroren — het verschil met "ang" ís de onderzoeksvraag' },
  { naam: 'mlp-16-bp', lr: 0.016, ov: { layered: true, layerSizes: [16], prop: 2, gradExact: true, ...VAST },
    rol: 'geheugenloos net met backprop — de controle dat de taak werkelijk geheugen vraagt' },
  { naam: 'elman-16-bp', lr: 0.008, ov: { layered: true, layerSizes: [16], prop: 2, recurrent: true, gradExact: true, ...VAST },
    rol: 'vast recurrent net met echte terugpropagatie — de sterke basislijn' },

  /* Stap 12b. De vier neuronsoorten zijn een ontwerpkeuze van mij, en stap 8 en 12
     lieten zien dat zij aantoonbaar niets doen — het geheugen-neuron verliest zijn
     geheugengedrag zelfs juist onder geheugendruk. De vraag of ze eruit kunnen is
     geen smaakkwestie maar een meting: zet de drie gespecialiseerde soorten uit en
     elk verborgen neuron is een worker, oftewel een vrij bedrade recurrente graaf
     waarin alles met alles mag verbinden behalve met zichzelf. Plasticiteit blijft
     áán, want de vraag is wat de soorten doen en niet wat de plasticiteit doet.
     Drie uitkomsten, alle drie bruikbaar: beter (de soorten zijn een rem), gelijk
     (decoratie) of slechter (ze doen voor het eerst iets). */
  { naam: 'ang-typeloos', lr: 0.008,
    ov: { 'types.sens.on': false, 'types.refl.on': false, 'types.mem.on': false },
    rol: 'dezelfde wolk zonder gespecialiseerde soorten — alleen workers' }
];

/* De leersnelheden komen uit de vegen van stap 6 en 7 en zijn dus op taak A gekozen.
   Dat is een bekende beperking van deze reeks en staat als zodanig in de paper: als
   een architectuur op taak B een andere η wil, meet deze tabel dat niet. De reden om
   hem toch zo te draaien is dat een veeg over vier taakstanden × vier architecturen
   × zes leersnelheden een dag rekenen kost en deze reeks eerst moet uitwijzen of er
   überhaupt iets te zien is. Zodra er signaal is, komt de veeg. */

const TAAKAS = [
  { blink: 0,  naam: 'A',    omschrijving: 'doel altijd zichtbaar — de taak van stap 1 t/m 8' },
  { blink: 10, naam: 'B-10', omschrijving: '10 stappen zichtbaar, 10 stappen donker' },
  { blink: 20, naam: 'B-20', omschrijving: '10 zichtbaar, 20 donker' },
  { blink: 40, naam: 'B-40', omschrijving: '10 zichtbaar, 40 donker — een vijfde van de tijd zicht' }
];

const MEET_SEED0 = 1000, MEET_N = 12;

/* ---------------------------------------------------------------------------
   DE VOORSPELLINGEN, opgeschreven vóór de eerste run.
   Elke voorspelling heeft een `waar` en een `onwaar`, en die tweede is er niet voor
   de vorm: bij V4 is de uitkomst "geen verschil" waarschijnlijker dan de uitkomst
   waarop dit project hoopt, en dan is dát het resultaat dat de paper rapporteert.
   --------------------------------------------------------------------------- */
const VOORSPELLINGEN = [
  {
    id: 'V1', over: 'taak A blijft zoals hij was',
    voorspelling: 'Bij geen knippering liggen alle vier de architecturen binnen de ruis van elkaar, ' +
      'en reproduceert ang de referentiemeting van stap 4 bit voor bit.',
    waar: 'de bestaande conclusies van stap 5 en 6 blijven staan en deze reeks is er een geldige voortzetting van',
    onwaar: 'er is iets aan de taak veranderd door het inbouwen van de knop, en dan is de hele as ongeldig ' +
      'tot dat is uitgezocht'
  },
  {
    id: 'V2', over: 'vraagt de taak werkelijk geheugen?',
    voorspelling: 'Naarmate de donkere periode langer wordt, zakt mlp-16-bp — een net zonder enige terugkoppeling — het ' +
      'sterkst van de vier, en zijn geheugenhorizon blijft op of vlak boven nul.',
    waar: 'de taakas meet wat zij belooft te meten: deels waarneembaarheid, niet alleen moeilijkheid',
    onwaar: 'een geheugenloos net lost het ook op, en dan is de taak geen geheugentaak maar een taak die ' +
      'met obstakelvolgen of een vaste zoekstrategie te doen is — dan moet de omgeving strenger'
  },
  {
    id: 'V3', over: 'wat terugkoppeling waard is',
    voorspelling: 'elman-16-bp houdt bij een langere donkere periode een aantoonbaar hogere score én een ' +
      'geheugenhorizon boven nul, en het gat met mlp-16-bp groeit naarmate de donkere periode langer wordt.',
    waar: 'de blinderingsproef meet gedrag dat aan terugkoppeling hangt, en is dus bruikbaar als maat ' +
      'voor élke architectuur — ook voor ANG',
    onwaar: 'de maat vangt niet wat zij hoort te vangen, en moet herzien worden vóór er een uitspraak ' +
      'over ANG op gebaseerd wordt'
  },
  {
    id: 'V4', over: 'DE ONDERZOEKSVRAAG: wat is structurele plasticiteit waard?',
    voorspelling: 'Het verschil tussen ang en ang-vast is bij geen knippering nul (dat is stap 5 en 8 al), ' +
      'en groeit naarmate de donkere periode langer wordt — omdat een taak met twee informatielatenties iets ' +
      'te herstructureren geeft wat een zuiver reactieve taak niet heeft.',
    waar: 'er is voor het eerst een omgeving aan te wijzen waarin zelfherstructurering zich terugbetaalt, ' +
      'en dat is een bevinding waar de rest van het onderzoek op gebouwd kan worden',
    onwaar: 'structurele plasticiteit levert ook onder geheugendruk niets op. Dat is geen mislukking maar ' +
      'de scherpste versie van de negatieve bevinding die dit project al heeft: niet "op deze taak niet", ' +
      'maar "ook niet wanneer de taak precies datgene vraagt waarvoor het mechanisme bedoeld is". ' +
      'De paper rapporteert dat dan als hoofdresultaat, met de taakas als bewijs dat het serieus ' +
      'geprobeerd is.'
  },
  {
    id: 'V5', over: 'gedrag boven structuur',
    voorspelling: 'De geheugenhorizon uit de blinderingsproef hangt sterker samen met de benchmarkscore ' +
      'op taak B dan het aantal geheugen-neuronen of het aantal lussen dat doet.',
    waar: 'een functionele maat zegt meer dan een structurele telling, en dat rechtvaardigt de omslag ' +
      'in het hele meetprogramma',
    onwaar: 'de structurele tellingen zijn wél voorspellend, en dan is de zorg over circulariteit kleiner ' +
      'dan gedacht'
  }
];

module.exports = { ARCHITECTUREN, TAAKAS, VOORSPELLINGEN, MEET_SEED0, MEET_N, VAST };
