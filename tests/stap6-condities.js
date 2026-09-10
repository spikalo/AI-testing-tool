/* De condities van werkplan stap 6, op één plek zodat de leersnelheidsveeg en de
   uiteindelijke reeks gegarandeerd dezelfde netten meten.

   De vraag van dit pakket is: wat geef je op door géén backpropagation te
   gebruiken? Dat is een andere vraag dan die van stap 5 (wat levert de structuur
   op), en beide zijn nodig. Om er één ding tegelijk in te veranderen krijgt elk
   backpropnet exact hetzelfde skelet als ANG — hetzelfde spoor met dezelfde lambda,
   dezelfde lopende basislijn, dezelfde begrensde stap, dezelfde vervaging per
   poging, dezelfde Bernoulli-knoppen, dezelfde beloningen, dezelfde wereldzaden en
   dezelfde benchmark. Alleen de manier waarop het verborgen leersignaal tot stand
   komt verschilt: node-perturbatie schat het, terugpropagatie rekent het uit.

   Elk gelaagd net draait op een propagatiediepte die gelijk is aan zijn eigen
   aantal bogen, zodat het zijn uitvoer binnen één spelstap uitrekent zoals een
   gewoon voorwaarts net dat doet. ANG draait op zijn eigen standaard van 1, want
   dat is ANG. Omdat stap 5 heeft laten zien dat een boog extra vijf procentpunt
   kost, staat er van het kleinste net ook een controle op diepte 1 bij: dan is te
   zien of een verschil aan de schatter ligt of aan de reactielatentie. */
const VAST = { structOn: false, growOn: false, retypeOn: false };

const CONDITIES = [
  /* de referentie: de wolk zoals zij is, met haar eigen structurele plasticiteit */
  { naam: 'ang-vol', hergebruik: 'benchmark-standaard', ov: {} },

  /* het paar waar het om draait: zelfde topologie, zelfde diepte, zelfde alles,
     alleen een andere schatter */
  { naam: 'mlp-16-perturb', ov: { layered: true, layerSizes: [16], prop: 2, gradExact: false, ...VAST } },
  { naam: 'mlp-16-bp', ov: { layered: true, layerSizes: [16], prop: 2, gradExact: true, ...VAST } },

  /* hetzelfde paar, maar met een net dat vier keer zo veel gewichten heeft en een
     boog dieper is: schaalt het verschil mee? */
  { naam: 'mlp-32-32-perturb', ov: { layered: true, layerSizes: [32, 32], prop: 3, gradExact: false, ...VAST } },
  { naam: 'mlp-32-32-bp', ov: { layered: true, layerSizes: [32, 32], prop: 3, gradExact: true, ...VAST } },

  /* en met terugkoppeling erbij, zodat er iets te onthouden vált */
  { naam: 'elman-16-perturb', ov: { layered: true, layerSizes: [16], prop: 2, recurrent: true, gradExact: false, ...VAST } },
  { naam: 'elman-16-bp', ov: { layered: true, layerSizes: [16], prop: 2, recurrent: true, gradExact: true, ...VAST } },

  /* de controle op de reactielatentie: hetzelfde net, diepte 1 in plaats van 2 */
  { naam: 'mlp-16-perturb-p1', ov: { layered: true, layerSizes: [16], prop: 1, gradExact: false, ...VAST } }
];

/* De veeg. Zes leersnelheden rond de ANG-standaard van 0,008, gekozen op de
   goedkope toets van twintig werelden en nooit op de benchmark — die is de meetlat
   en mag geen instellingen kiezen. De veegzaden liggen bewust buiten de reeks
   waarop straks gemeten wordt: anders kiest de veeg de zaden waarop het toevallig
   goed ging en meet je je eigen ruis terug. */
const LR_GRID = [0.002, 0.004, 0.008, 0.016, 0.032, 0.064];
const VEEG_SEED0 = 2000, VEEG_N = 4;
const MEET_SEED0 = 1000, MEET_N = 16;

module.exports = { CONDITIES, LR_GRID, VEEG_SEED0, VEEG_N, MEET_SEED0, MEET_N };
