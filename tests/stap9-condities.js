/* Werkplan stap 9 — het raster dichtheid x neuronen, en de voorspellingen vooraf.

   PRE-REGISTRATIE. Gecommit vóórdat er één meetrun gedraaid heeft.

   DE VRAAG, EN WAAROM HIJ ZO LANG HEEFT MOETEN WACHTEN. Dit is de oorspronkelijke
   vraag waar dit hele project uit voortkomt: wanneer is een netwerk te klein of te
   groot, hoe uit zich dat, en waaraan herken je het. Hij stond achteraan omdat een
   capaciteitsvraag alleen zinvol is op een taak waar capaciteit werkelijk knelt, en
   die bestond niet zolang het doel altijd zichtbaar was. Sinds stap 12 bestaat zij
   wel: op de knipperende standen van de taakas moet het netwerk informatie
   vasthouden, en vasthouden kost plaats.

   WAT ER GEVARIEERD WORDT, EN WAT NIET. Twee assen: het aantal beschikbare neuronen
   en de startdichtheid van de verbindingen. Alles daarbuiten blijft staan.

   De SOORTENVERDELING schaalt mee met de grootte en wordt dus NIET gevarieerd. Dat is
   een bewuste keuze en het alternatief was erger. De standaardgrenzen (invoer 4–14,
   reflex 2–10, geheugen 2–10, worker minimaal 12) zijn absolute aantallen, afgesteld
   op zestig neuronen. Laat je ze staan terwijl je naar acht neuronen zakt, dan wringt
   de samenstelling zichzelf plat tegen de ondergrenzen aan en meet je twee dingen
   tegelijk: minder neuronen én een andere verhouding tussen de soorten. De grenzen
   schalen daarom evenredig mee, zó gekozen dat zij bij zestig neuronen exact de
   bestaande waarden teruggeven. De vraag van deze stap is hoevéél neuronen, niet
   welke.

   WAT ER GEMETEN WORDT, EN DIT IS HET EIGENLIJKE PUNT. Niet alleen de benchmarkscore.
   Een score zegt dát het misgaat en niet waaraan je het had kunnen zien. Een netwerk
   dat te klein is en een netwerk dat te groot is falen allebei, maar niet op dezelfde
   manier, en juist dat verschil is het bruikbare antwoord: het is een diagnose die je
   kunt stellen zonder een tweede netwerk ter vergelijking te trainen. Daarom staan er
   naast de score vier structurele maten in de tabel die alle vier al bestaan en nog
   nooit een taak hebben gehad waarop zij iets konden betekenen.                     */

/* De vijf maten, ruim een factor vijftien uit elkaar, met de standaard (60) erin. */
const NEURONEN = [8, 16, 30, 60, 120];

/* Drie dichtheden rond de standaard (35): de helft, de standaard, het dubbele. De
   paginahint noemt dichtheid "veruit de belangrijkste knop" en meldt 40 % bij 15, 70 %
   bij 25 en ruim 80 % bij 35; deze stap is de eerste die dat nameet in plaats van
   navertelt.

   De eerste versie hiervan stond op [1.5, 3.5, 7.0] — een factor tien te laag, omdat de
   schuif in de pagina zijn waarde door tien deelt en de standaard dus 35 is en niet 3,5.
   Alle drie de cellen zouden ver onder het bruikbare bereik hebben gelegen en het raster
   zou hebben "aangetoond" dat dichtheid er nauwelijks toe doet. De controletest ving het
   omdat zij het aantal verbindingen afdrukt: 277 waar het er 2639 hadden moeten zijn. */
const DICHTHEDEN = [15, 35, 70];

/* Twee taakstanden uit stap 12: zonder en met geheugendruk. B-40 blijft eruit, want
   daar zakt élke architectuur naar een paar procent en meet een raster ruis. */
const STANDEN = [
  { naam: 'A', blink: 0, omschrijving: 'doel altijd zichtbaar — geen geheugendruk' },
  { naam: 'B20', blink: 20, omschrijving: '10 stappen zichtbaar, 20 donker — wel geheugendruk' }
];

/* De soortgrenzen als aandeel van het totaal, zó gekozen dat zij bij N = 60 de
   bestaande waarden opleveren: invoer 4–14, reflex 2–10, geheugen 2–10, worker min 12.
   Afronding naar boven met een ondergrens van één, want een soort die op nul uitkomt
   is geen kleinere soort maar een uitgezette soort — en dat is stap 12b, niet stap 9. */
function soortgrenzen(N) {
  const f = (deel, minimaal) => Math.max(minimaal, Math.round(deel * N));
  return {
    'types.sens.min': f(4 / 60, 1), 'types.sens.max': f(14 / 60, 2),
    'types.refl.min': f(2 / 60, 1), 'types.refl.max': f(10 / 60, 1),
    'types.mem.min': f(2 / 60, 1), 'types.mem.max': f(10 / 60, 1),
    'types.work.min': f(12 / 60, 2)
  };
}

/* De leersnelheidsveeg. Zij loopt per (grootte x stand) en niet per cel: de
   leersnelheid hangt samen met het aantal parameters en met de moeilijkheid van de
   taak, en de startdichtheid is binnen enkele herstructureringsronden uitgewist —
   snoeien en aangroeien brengen elke cel naar zijn eigen evenwicht. Dat is een
   vereenvoudiging en zij staat hier zodat zij in de paper staat. Zij is wél strenger
   dan stap 12, die de leersnelheid van taak A op alle standen gebruikte.

   De veeg draait op eigen zaden. Een veeg die de meetzaden gebruikt, kiest de
   instelling die toevallig op díé zaden goed uitpakt en meet daarna zichzelf. */
const VEEG_LR = [0.004, 0.008, 0.016];
const VEEG_SEED0 = 2000, VEEG_N = 3;
const MEET_SEED0 = 1000, MEET_N = 8;
const POGINGEN = 500;

/* ---------------------------------------------------------------------------
   VOORSPELLINGEN. Vastgelegd vóór de eerste meetrun, elk met een uitgeschreven
   onwaar-tak. Eén familie voor de scorevergelijkingen (Holm), en de voorspellingen
   over de diagnostische maten worden beschrijvend gerapporteerd met interval — zij
   gaan over een patroon en niet over één verschil.
   --------------------------------------------------------------------------- */
const VOORSPELLINGEN = [
  { id: 'V1', wat: 'er is een optimum in netwerkgrootte, en het ligt niet op de rand van het raster',
    toets: 'benchmarkscore tegen aantal neuronen, per stand, met interval per cel',
    waar: 'Dan zijn "te klein" en "te groot" allebei op deze as meetbaar en heeft de vraag ' +
      'waar dit project uit voortkomt een antwoord in de vorm van een curve in plaats van een ' +
      'vuistregel.',
    onwaar: 'Het optimum ligt bij 8 of bij 120 neuronen. Dan meet dit raster alleen "meer is beter" ' +
      'of "minder is beter" tot buiten wat er gemeten is, en wordt het raster uitgebreid vóór er ' +
      'ook maar iets over een optimum wordt opgeschreven. Een optimum op de rand is geen optimum.' },

  { id: 'V2', wat: 'het optimum schuift met de taakstand mee: op B-20 ligt het bij meer neuronen dan op A',
    toets: 'het argmaximum van de benchmarkscore over de vijf maten, per stand',
    waar: 'Hoeveel netwerk je nodig hebt is een eigenschap van de opgave en niet van de ' +
      'architectuur. Voor iemand die een model lokaal draait is dat de bruikbaarste uitkomst ' +
      'van deze stap: de vraag "hoe groot moet het" heeft geen taakonafhankelijk antwoord.',
    onwaar: 'Het optimum ligt op beide standen bij dezelfde maat. Dan is netwerkgrootte hier wél ' +
      'een eigenschap van de architectuur, en is één keer uitmeten genoeg — een prettiger ' +
      'boodschap, en dan moet die er staan.' },

  { id: 'V3', wat: 'te groot kost meer dan te klein',
    toets: 'de daling vanaf het optimum naar de grootste maat tegen die naar de kleinste maat, ' +
      'per stand, met interval',
    waar: 'Overcapaciteit interfereert, zoals stap 12 al liet vermoeden toen een ruimer net onder ' +
      'geheugendruk slechter presteerde. Het praktische advies wordt dan "liever iets te klein ' +
      'dan iets te groot", en dat is het tegenovergestelde van de gangbare vuistregel.',
    onwaar: 'De daling is symmetrisch, of te klein kost juist méér. Dan is "neem hem ruim" hier ' +
      'gewoon het juiste advies en is de gangbare vuistregel op deze taak niet te verbeteren.' },

  { id: 'V4', wat: 'te klein en te groot zijn aan andere maten te herkennen dan aan de score alleen',
    preciezer: 'een te klein netwerk laat een hogere gemiddelde gewichtsgrootte ten opzichte van het ' +
      'gewichtsplafond zien (het duwt zijn parameters tegen de rand) en een lagere geheugenhorizon; ' +
      'een te groot netwerk laat meer losgeraakte neuronen zien en een grotere spreiding tussen zaden',
    toets: 'rangcorrelatie van elke maat met het aantal neuronen, per stand, beschrijvend gerapporteerd',
    waar: 'Dan is er een diagnose te stellen aan één getraind netwerk, zonder een tweede ter ' +
      'vergelijking. Dat is precies wat de vraag achter dit project wil weten en het is het enige ' +
      'onderdeel van deze stap dat buiten dit model bruikbaar is.',
    onwaar: 'Geen van de vier maten loopt mee met de grootte, of zij lopen alle vier dezelfde kant ' +
      'op zodat te klein en te groot er hetzelfde uitzien. Dan is de eerlijke boodschap dat je een ' +
      'verkeerd gedimensioneerd netwerk alleen aan zijn prestatie herkent en dus altijd moet ' +
      'vergelijken — een negatief antwoord op een praktijkvraag, en nog steeds een antwoord.' },

  { id: 'V5', wat: 'de startdichtheid doet er minder toe dan het aantal neuronen',
    toets: 'de spreiding van de benchmarkscore over de drie dichtheden binnen een maat, tegen die ' +
      'over de vijf maten binnen een dichtheid',
    waar: 'Het snoeien en aangroeien wissen de startdichtheid binnen een leven uit. Dan is dichtheid ' +
      'een knop die je niet nauwkeurig hoeft te zetten, en — belangrijker — is de paginahint die ' +
      'haar "veruit de belangrijkste knop" noemt achterhaald door de structurele plasticiteit die ' +
      'er later bij gekomen is. Die hint wordt dan aangepast.',
    onwaar: 'Dichtheid doet er wel degelijk toe. Dan is er een tweede as waarop een netwerk ' +
      'verkeerd gedimensioneerd kan zijn, en moet elk advies over grootte de dichtheid erbij noemen.' }
];

module.exports = { NEURONEN, DICHTHEDEN, STANDEN, soortgrenzen, VOORSPELLINGEN,
  VEEG_LR, VEEG_SEED0, VEEG_N, MEET_SEED0, MEET_N, POGINGEN };
