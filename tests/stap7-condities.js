/* De condities van werkplan stap 7, op één plek zodat de leersnelheidsveeg en de
   meetreeks gegarandeerd dezelfde varianten meten.

   De vraag van dit pakket is een andere dan die van stap 5 en 6. Daar ging het om
   wat de graafstructuur (5) en wat de schatter (6) waard zijn; hier gaat het om de
   leerregel zelf, met de topologie en de schatter juist onveranderd. Vier ingrepen,
   alle vier klein, alle vier los aan en uit te zetten:

     a  een toestandsafhankelijke criticus in plaats van één lopend gemiddelde;
     b  schaarse perturbatie — per tik maar een deel van de wolk verstoren;
     c  een categorisch beleid over negen elkaar uitsluitende acties;
     d  perturbGain — de ontbrekende 1/Var(ξ)-normalisatie uit stap 3.

   (b) staat er ook los in, en niet alleen samen met de criticus. Zonder die vierde
       conditie zou een verschil bij 'criticus + schaars' niet toe te wijzen zijn aan
       een van de twee, en dan heb je een pakket gemeten in plaats van een ingreep.       */
const VAST = {};

const CONDITIES = [
  /* de referentie: de leerregel zoals zij na stap 2 en 6 is */
  { naam: 's7-huidig', ov: {} },

  /* (a) */
  { naam: 's7-criticus', ov: { criticOn: true } },

  /* (b) los, zodat (a)+(b) toewijsbaar is */
  { naam: 's7-schaars', ov: { perturbFrac: 0.25 } },

  /* (a) + (b) samen — de combinatie uit het werkplan */
  { naam: 's7-criticus-schaars', ov: { criticOn: true, perturbFrac: 0.25 } },

  /* (c) */
  { naam: 's7-categorisch', ov: { catPolicy: true } },

  /* (d) — stap 3 mat dat het wolkdeel van de update 44-349x te klein is t.o.v. het
     knopdeel. Daar is toen g = 10, 30, 100 en 272 op geprobeerd, en alles ging
     stuk; wat er niet bij zat was een eerlijke leersnelheidsveeg per waarde van g.
     Die krijgt hij hier alsnog, want η en g hangen samen en één van de twee
     verzetten terwijl de ander blijft staan is geen meting maar een gok. */
  { naam: 's7-perturbgain', ov: { perturbGain: 10 } }
];

/* De veeg. Zes leersnelheden rond de ANG-standaard van 0,008. Voor perturbgain
   schuift het raster mee met 1/g: bij een tien keer zo groot wolkdeel hoort een tien
   keer kleinere stap, en het raster daaromheen leggen is het enige eerlijke. */
const LR_GRID = [0.002, 0.004, 0.008, 0.016, 0.032, 0.064];
const LR_GRID_PER_CONDITIE = {
  's7-perturbgain': [0.0002, 0.0004, 0.0008, 0.0016, 0.0032, 0.008]
};
const rasterVoor = naam => LR_GRID_PER_CONDITIE[naam] || LR_GRID;

/* Veegzaden buiten de meetzaden, om dezelfde reden als in stap 6: kies je op de
   zaden waarop je meet, dan kies je de zaden waarop het toevallig goed ging. */
const VEEG_SEED0 = 3000, VEEG_N = 4;
const MEET_SEED0 = 1000, MEET_N = 12;

module.exports = { CONDITIES, VAST, LR_GRID, LR_GRID_PER_CONDITIE, rasterVoor,
  VEEG_SEED0, VEEG_N, MEET_SEED0, MEET_N };
