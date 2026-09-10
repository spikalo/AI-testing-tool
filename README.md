# AI Testing Tool — lokaal model lab

![Lokaal model lab](front_img.png)

Een verzameling losse HTML-pagina's waarmee je **op je eigen hardware** kunt meten
wanneer een klein of slecht getraind model onderuit gaat, hoe zich dat uit, en wat je
eraan kunt doen. Geen server nodig, geen build, geen dependencies, geen `npm install`:
open een bestand in Chrome of Edge en het draait.

De centrale vraag achter dit project:

> Wanneer, hoe en waardoor gaat een te klein of slecht getraind netwerk slecht
> presteren, hoe herken je dat, en welke methodes kun je toepassen om de resultaten te
> verbeteren?

Er zitten inmiddels vier tests in, van "een gewoon statistisch script zonder AI" tot
een zelfstructurerend neuraal netwerk zonder lagen en zonder backpropagation.

## Snelstart

1. Clone of download deze map.
2. Start **`start-server.cmd`** (Windows). Dat serveert de map op
   `http://localhost:8080` en opent het hoofdmenu. Handmatig kan ook, vanuit deze map:
   `python -m http.server 8080`.
3. Kies een test in `index.html`.

Alleen de **Ollama LLM-test** heeft die webserver echt nodig. De andere drie werken ook
als je het bestand rechtstreeks vanaf schijf opent.

> **Waarom niet gewoon dubbelklikken?** Een pagina die je vanaf schijf opent (`file://`)
> stuurt `Origin: null` mee, en dat weigert Ollama standaard — de LLM-test krijgt dan
> geen verbinding. Via `localhost` speelt dat niet. Wil je toch vanaf schijf werken, zet
> dan `OLLAMA_ORIGINS` op `*` en herstart Ollama.

Voor de LLM-test heb je [Ollama](https://ollama.com/download) nodig met minstens één
model:

```bash
ollama pull llama3.2:3b
ollama run llama3.2:3b
```

De pagina bevat een uitschuifbaar vak met alle installatiestappen en een statusbolletje:
groen = verbonden, oranje = Ollama draait wel maar blokkeert de pagina (CORS), rood =
niet bereikbaar.

## De vier tests

| # | Test | Wat je meet | Nodig |
|---|---|---|---|
| 01 | **NN Layer Test** | Bouw zelf een klein neuraal netwerk (tot 5 verborgen lagen) op koffiereviews, spam, MNIST-cijfers of EMNIST-letters, en zoek de omslag tussen "te klein" en "goed genoeg". | dataset voor taak C/D |
| 02 | **Ollama LLM-test** | 18 vaste opdrachten voor een lokaal draaiend taalmodel: 6 vaardigheden × 3 moeilijkheidsgraden, met faalpatronen en remedies. | Ollama + webserver |
| 03 | **Statistische modellen** | Acht klassieke modellen zonder AI — van rechte lijn tot random forest, kernel-SVM en k-means — live op echte datasets. Laat zien hoe ver je komt met een gewoon script. | niets |
| 04 | **Basic Brain Test** | Een neuraal netwerk zónder lagen dat al spelend leert een doel te bereiken. Zie hieronder. | niets |

Bij elke test hoort een resultatenpagina waarmee je runs naast elkaar legt.

### Test 02 — de LLM-testbatterij in het kort

18 vaste opdrachten = **6 vaardigheden × 3 moeilijkheidsgraden**, altijd exact dezelfde
vragen, met `temperature 0` en `seed 42`, zodat verschillen door het model komen en niet
door toeval.

| # | Vaardigheid | Waar je het aan ziet als het misgaat |
|---|---|---|
| 1 | Generatief & creatief | tel- en verbodsinstructies worden genegeerd |
| 2 | Structuur & transformatie | JSON met uitleg eromheen, verkeerde sleutels, verzonnen getallen |
| 3 | Analyse & classificatie | verzonnen labels, wisselende uitkomsten bij herhaling |
| 4 | Logica & redeneren | plausibel maar fout getal, afgeleid door irrelevante info |
| 5 | Techniek & code | code draait niet, of zakt op de randgevallen |
| 6 | Agentisch gedrag | verkeerde of verzonnen tool, geen herstel na een fout |

De code-opdrachten worden **echt uitgevoerd** in een sandbox met time-out, en de
zwaarste agent-opdracht is een tweetraps-loop waarin de eerste tool-aanroep faalt en het
model zelf een alternatief moet kiezen. Per model krijg je een totaalscore, een
radarprofiel per vaardigheid, een "waar valt het om"-grafiek per moeilijkheidsgraad, en
per gevonden faalpatroon een uitleg plus een concrete remedie.

Volledige details in [DOCUMENTATIE.md](DOCUMENTATIE.md).

### Test 03 — statistische modellen

Acht modellen, met de hand geïmplementeerd, zonder enige bibliotheek: kleinste kwadraten
met ridge, polynomiale regressie met LOOCV, CART, random forest met OOB-score,
logistische regressie, k-NN, kernel-SVM via vereenvoudigde SMO, en k-means met
k-means++ en silhouetscore. Vier echte datasets zitten in het bestand ingebakken.

Je kunt er de klassieke lessen mee laten zien, en ze kloppen ook echt: schaling
uitzetten bij logistische regressie laat de score van 89% naar 36% zakken — onder de
basislijn; een beslisboom met diepte 8 haalt R² = 1,000 op de trainingsset terwijl de
testset instort; en polynomiaal graad 8 gaat van LOOCV 0,36 naar 0,96 door ridge.

## Test 04 — Adaptive Neural Graph (ANG)

De nieuwste en eigenzinnigste test. Een brein dat **geen lagen** heeft maar een gerichte
graaf is die zichzelf tijdens het leren herbouwt, en dat een klein 2D-spel speelt: een
karakter moet een doel bereiken zonder tegen obstakels te botsen.

![Het netwerk en de wereld](docs/ang-brein.png)

**Invoer en uitvoer liggen vast.** Zestien invoer-nodes: acht raycast-sensoren voor de
nabijheid van obstakels in acht windrichtingen, en acht die het doel als
richting-met-nabijheid coderen. Vier uitvoer-nodes: omhoog, omlaag, links, rechts — elk
een *kans* waaruit de actie geloot wordt.

**De wolk ertussen bepaal je zelf.** Je kiest hoeveel neuronen er zijn en van welke
soort, en elke soort heeft eigen regels over wat hij mag verbinden:

| soort | ingang | uitgang |
|---|---|---|
| invoer-neuron | uitsluitend invoer-nodes | vrij |
| worker | vrij | vrij — moet altijd de meerderheid zijn |
| reflex / instinct | uitsluitend invoer-neuronen | uitsluitend uitvoer-nodes |
| geheugen | vrij | altijd eerst zichzelf (lekkende integrator), daarna vrij |
| neutraal | vrij | vrij — tijdelijk, tot het systeem een soort toewijst |

De enige harde eis aan de bedrading is dat elke invoer-node ergens naartoe gaat en elke
uitvoer-node ergens vandaan komt. Er is geen minimum of maximum aantal verbindingen per
neuron.

**Leren zonder backpropagation.** De graaf zit vol lussen en verandert bovendien van
vorm, dus een vaste rekengrafiek bestaat niet. In plaats daarvan:

```
elke tik twee keer doorrekenen: één keer schoon, één keer met ruis
    δ = x_ruis − x_schoon                       de duw die exploratie gaf
    voor de vier knoppen exacter:  δ = geloten actie − kans
spoor bijhouden per verbinding:
    e ← λ·e + (1−λ)·x_pre·δ_post
    x_pre = de toestand vóór de laatste propagatiestap, niet erna:
            die activatie bracht δ_post voort (zie het logboek van 9 september)
en bijstellen naar de afwijking van een lopende basislijn:
    Δw = η · (r − r̄) · e
```

Drie remmen houden dat stabiel: de stap per keer is begrensd (*niet abrupt*), de
aanpassing wordt gedempt naarmate een gewicht zijn plafond nadert (*niet oneindig
versterken*), en alles zakt per poging een beetje terug naar nul (*vervagen*).

**Doet die regel wat hij belooft?** Deels — en dat is nagemeten in plaats van aangenomen.
Op een miniatuurbrein met bevroren topologie is per gewicht de echte gradiënt numeriek
bepaald en met de update vergeleken (`tests/gradcheck-stap3.js`, figuur in
`docs/fig2-gradcheck.png`). Voor de vier knoppen, waar de formule exact is, wijst de
update precies de goede kant op (cosinus 0,99–1,00, tegen het meetbare plafond aan). Voor
de wolk, waar node-perturbatie wordt gebruikt, wijst hij de goede kant op maar veel
grover (0,27–0,83) — en, belangrijker: hij is er **twee ordes te klein**, doordat de
normalisatie 1/Var(ξ) ontbreekt die bij node-perturbatie hoort. Met één leersnelheid
krijgt de wolk daardoor nauwelijks een update, terwijl daar het grootste deel van de
echte gradiënt ligt. Die factor er zomaar bij zetten maakt het overigens *slechter*: de
leersnelheid en de stapbegrenzing zijn stilzwijgend op de bestaande verhouding
afgesteld. Dat rechtzetten is een eigen experiment, geen knop die je even omzet.

**De structuur verandert mee.** Verbindingen die te lang te zwak zijn worden gesnoeid en
er groeien nieuwe bij. Loopt het leren vast, dan komen er neuronen bij — die zijn
*neutraal* en krijgen bij de volgende opruimronde de soort die het beste past bij de
bedrading die ze inmiddels hebben. Een neuron dat al zijn verbindingen kwijtraakt wordt
weer neutraal en kan opnieuw worden ingezet.

**Wat je eraan afleest.** Naast de score: het kortste pad van zintuig naar knop, het
aantal werkende reflexbogen, het aantal terugkoppellussen, hoeveel neuronen er
werkelijk meedoen, en welke van de zestien sensoren het brein feitelijk negeert. Elke
run wordt met alle instellingen én de volledige eindstructuur weggeschreven, zodat
`brein-resultaten.html` het netwerk opnieuw kan tekenen zonder de training over te doen.

**Wat het haalt.** Met de standaardinstellingen (60 neuronen, startdichtheid 35, 7
obstakels, 500 pogingen) gemeten over **zestien onafhankelijke breinzaden**:

| grootheid | gemiddelde ± 95% | spreiding |
|---|---|---|
| succes laatste 20 pogingen | 87,2% ± 4,6 | sd 8,7% |
| toets op 20 onbekende werelden | 68,1% ± 3,6 | sd 6,8% |
| **benchmark, 500 werelden, geleerd beleid** | **65,4% ± 2,0** | sd 3,8% |
| benchmark, altijd de waarschijnlijkste knop | 52,3% ± 3,0 | sd 5,7% |
| rekentijd per run | 11,4 s | |

Twee ijkpunten op diezelfde 500 werelden: een **willekeurig beleid** haalt 0,0%, een
**zuiver reactieve agent** — dezelfde zintuigen, geen geheugen, geen leren, naar het doel
toe en van wat vlakbij staat af — haalt 38,6% ± 4,3. Het netwerk zit daar 27 procentpunt
boven, ruim buiten beide intervallen.

Twee dingen om vast te houden. **De spreiding tussen zaden** (sd 8,7% op de
trainingsscore) betekent dat een enkele run niets bewijst en dat een verschil van tien
procentpunt pas boven de ruis uitkomt bij ruwweg zestien runs per conditie. En **het
toeval hoort bij het beleid**: steeds de waarschijnlijkste knop nemen kost 13,1 ± 2,3
procentpunt (p < 0,001) — dat is dus geen "hetzelfde beleid zonder ruis" maar een ander
en slechter beleid. De ruwe meting staat in `experimenten/runs.csv`, conditie
`benchmark-standaard`, met de samenvatting in `experimenten/benchmark.json`.

**Waarop getoetst wordt.** Twintig toetswerelden zijn een goedkoop signaal tijdens het
afstellen, geen bewijs: bij een score rond 70% is het 95%-interval van twintig
trekkingen ongeveer ± 20 procentpunt. Daarom is er een **vaste benchmarkset** van 500
werelden uit een eigen zaadreeks, gescheiden van de trainingswerelden én van die
twintig, en nooit gebruikt om instellingen te kiezen. Elke wereld wordt drie keer
gespeeld omdat het beleid geloot wordt; het interval gaat over de wérelden, niet over de
speelbeurten. Daarmee zakt de onzekerheid van één meting naar ± 3,6 procentpunt. De
verzameling ligt vast in `experimenten/benchmark-werelden.json`.

**Draagt de graafstructuur eigenlijk iets bij?** Dat is de eerste vraag die een kritische
lezer stelt, en het antwoord is op deze taak: nee. Vijf condities met **exact dezelfde
leerregel**, dezelfde wereldzaden en dezelfde benchmark, 16 zaden elk:

| conditie | benchmark | argmax | verb. | pad | rekentijd |
|---|---|---|---|---|---|
| ANG, wolk met plasticiteit | 65,4% ± 2,0 | 52,3% ± 3,0 | 2996 | 2,00 | 7,0 s |
| ANG, wolk bevroren | 67,5% ± 1,3 | 50,3% ± 2,7 | 2650 | 2,00 | 5,8 s |
| gelaagd, 1 × 150 | 66,9% ± 0,5 | 40,9% ± 1,5 | 3000 | 2,00 | 5,3 s |
| gelaagd, 2 × 46 | 62,4% ± 2,6 | 49,7% ± 2,6 | 3036 | 3,00 | 7,2 s |
| gelaagd, 1 × 60 | 67,0% ± 1,0 | 42,8% ± 1,8 | 1200 | 2,00 | 2,7 s |

Een vaste stapel lagen met hetzelfde parameterbudget doet het net zo goed als de wolk
(p = 0,76), en de structurele plasticiteit uitzetten kost niets (p = 0,11) maar scheelt
wel rekentijd. Het enige structurele effect dat boven de ruis uitkomt is **padlengte**:
twee lagen in plaats van één kost 5,1 procentpunt (p = 0,003) — bij propagatiediepte 1 is
elke boog een tijdstap, dus dat is reactietijd, geen capaciteit. Alles boven de reactieve
ondergrens van 38,6% is dus toe te schrijven aan de leerregel, niet aan de graaf. Ruwe
meting: `experimenten/basislijnen.json`.

**En wat geef je op door géén backpropagation te gebruiken?** Dezelfde vraag omgekeerd:
topologie vast, alleen de schatter wisselt. Node-perturbatie *schat* wat een verborgen
knoop bijdroeg; terugpropagatie *rekent* het uit. Verder is alles identiek — hetzelfde
spoor, dezelfde basislijn, dezelfde begrensde stap, dezelfde vervaging, hetzelfde
startbrein — en elke conditie draait op de leersnelheid die een aparte veeg op de goedkope
toets voor haar koos.

| conditie | η | benchmark | gewichten | kanten tot 80% | tijd |
|---|---|---|---|---|---|
| ANG, de wolk | 0,004 | 63,2% ± 3,0 | 3068 | 483 M | 7,1 s |
| MLP 16-16-4, perturbatie | 0,008 | 39,3% ± 5,3 | 320 | 180 M | 3,0 s |
| MLP 16-16-4, **backprop** | 0,016 | **66,7% ± 0,6** | 320 | **11 M** | 1,4 s |
| MLP 16-32-32-4, perturbatie | 0,004 | 41,7% ± 4,9 | 1664 | 1,3 G | 10,4 s |
| MLP 16-32-32-4, backprop | 0,008 | 64,9% ± 1,1 | 1664 | 74 M | 3,5 s |
| Elman-16, perturbatie | 0,004 | 42,3% ± 5,0 | 576 | 297 M | 2,6 s |
| Elman-16, backprop | 0,008 | 66,3% ± 1,2 | 576 | 22 M | 1,2 s |

De exacte gradiënt is op alle drie de netten meer dan **twintig procentpunt** beter
(p < 0,001). Node-perturbatie betaalt dat in capaciteit: met 16 verborgen knopen haalt zij
39%, met 150 knopen 67% — terwijl backprop met diezelfde 16 knopen al op 67% zit. En op
rekenkosten is het geen wedstrijd: een MLP van 320 gewichten haalt de score van de wolk
voor **een 43e deel van het rekenwerk**. De hypothese uit het werkplan dat een klein MLP
hier op rekenkosten wint, is dus gemeten in plaats van vermoed, en zij komt uit.

Rekenkosten worden in **vier gescheiden grootheden** gerapporteerd, want zij vallen zelden
samen: kanten-bezoeken per lerende spelstap, per inferentiestap, omgevingsstappen tot 80%
succes (sample-efficiëntie) en kanten-bezoeken tot diezelfde drempel (rekenefficiëntie),
met wandkloktijd en actieve verbindingen ernaast. Eén kanten-bezoek is één keer een gewicht
aanraken. Ruwe meting: `experimenten/rekenkosten.json` en `experimenten/lr-veeg-stap6.json`.

### Herhaalbaar, laadbaar, en in reeksen te draaien

Een run ligt volledig vast door twee zaden: het **breinzaad** (de startwolk) en het
**wereldzaad** (de werelden en alle ruis tijdens het leren). Beide staan in de pagina en
in elk resultaatbestand. Twee keer dezelfde zaden geeft bit voor bit dezelfde leercurve,
dezelfde toetsen, dezelfde structuurmaten en hetzelfde eindnetwerk — gecontroleerd, niet
aangenomen (`experimenten/reproduceerbaarheid.json`).

Daaruit volgen drie dingen die de pagina nu kan:

- **↻ herhaal deze run** — zet zaden en instellingen terug en draait dezelfde training opnieuw.
- **brein of instellingen uit een resultaat laden** — een opgeslagen JSON bevat de
  volledige eindstructuur, dus je kunt een getraind brein terugladen om door te trainen
  of opnieuw te toetsen, of alleen de instellingen terugzetten en met een vers brein
  vanaf hetzelfde punt verder experimenteren.
- **Experimentloper** — een lijst condities × zaden achter elkaar, zonder tekenen, met
  per run een JSON en één regel in `experimenten/runs.csv` (68 kolommen: beide zaden,
  alle parameters die tussen condities verschillen, alle uitkomst- en structuurmaten, en
  sinds stap 6 de rekenkosten).
  Aan het eind van elke run wordt desgewenst de vaste benchmarkset gedraaid, in beide
  beleidsvormen. Onderaan verschijnt per conditie het gemiddelde met een 95%-interval
  over de zaden, plus een **Mann-Whitney U** van elke conditie tegen de eerste, met de
  uitkomst in gewone taal: *"verschil is er echt"* of *"verschil valt binnen de ruis"*.
  Dezelfde samenvatting staat onder de vergelijktabel en in `brein-resultaten.html`.

## Inhoud

| Bestand | Wat het is |
|---|---|
| `index.html` | Hoofdmenu |
| `nn-layer-test.html` | Test 01 — neuraal netwerk trainen in de browser |
| `resultaten.html` | Runs van test 01 vergelijken |
| `ollama-test.html` | Test 02 — testbatterij voor lokale LLM's via de Ollama-API |
| `ollama-resultaten.html` | LLM's naast elkaar leggen + adviesformulier "welk model voor mijn taak" |
| `stat-modellen-test.html` | Test 03 — acht klassieke modellen, alles met de hand geïmplementeerd |
| `brein-test.html` | Test 04 — Adaptive Neural Graph |
| `brein-resultaten.html` | Getrainde breinen vergelijken en hun netwerk opnieuw tekenen |
| `start-server.cmd` | Start een lokale webserver op poort 8080 en opent het hoofdmenu |
| `resultaten/` | Opgeslagen runs van test 01 (JSON) |
| `resultaten-llm/` | Opgeslagen runs van test 02 (JSON, één bestand per model) |
| `resultaten-brein/` | Opgeslagen runs van test 04 (JSON, één bestand per brein) |
| `experimenten/` | Meetreeksen van test 04: `runs.csv` met één regel per run, en de volledige runs in `runs/` (niet in git — ze zijn uit de zaden te reproduceren) |
| `paper/` | Generator van het ANG-paper (`paper.js`) plus de scripts voor de formules en figuren |
| `tests/` | Playwright-tests die de eigenschappen bewijzen waarop de paper zich beroept, plus de numerieke gradiëntcontrole (`gradcheck-*`) |
| `datasets/` | MNIST/EMNIST — **niet in git**, zie `datasets/README.md` |
| `DOCUMENTATIE.md` | Volledige documentatie van test 01 en 02: opdrachten, scoring, faalpatronen, remedies en het logboek |

## Resultaten opslaan

De tests schrijven hun resultaten weg als JSON in de bijbehorende map. Dat gaat via de
File System Access API: je kiest die map één keer met de knop "kies resultatenmap" en
Chrome of Edge onthoudt hem daarna. Werkt dat niet, of gebruik je een andere browser,
dan is er altijd de downloadknop en zet je het bestand er zelf neer.

## Privacy

Alles draait lokaal. Er gaat geen prompt, geen antwoord en geen resultaat naar een
externe dienst; het enige netwerkverkeer is naar `localhost:11434` (Ollama) en naar
Google Fonts voor de lettertypen.
