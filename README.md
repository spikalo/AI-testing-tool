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
en bijstellen naar de afwijking van een lopende basislijn:
    Δw = η · (r − r̄) · e
```

Drie remmen houden dat stabiel: de stap per keer is begrensd (*niet abrupt*), de
aanpassing wordt gedempt naarmate een gewicht zijn plafond nadert (*niet oneindig
versterken*), en alles zakt per poging een beetje terug naar nul (*vervagen*).

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
obstakels, 500 pogingen) gemeten over **twaalf onafhankelijke breinzaden**:

| grootheid | gemiddelde ± 95% | spreiding |
|---|---|---|
| succes over alle pogingen | 63,3% ± 2,8 | sd 5,0% |
| succes laatste 20 pogingen | 85,0% ± 5,9 | sd 10,4% |
| toets op onbekende werelden | 68,3% ± 3,0 | sd 5,4% |
| rekentijd per run | 13,5 s ± 0,3 | |

Ter vergelijking: een zuiver reactieve agent die recht op het doel af loopt en langs
obstakels glijdt haalt op diezelfde werelden 57%. Let op de spreiding: **sd 10,4% op de
trainingsscore** betekent dat een enkele run niets bewijst en dat een verschil van tien
procentpunt pas boven de ruis uitkomt bij ruwweg zestien runs per conditie. De ruwe
meting staat in `experimenten/runs.csv`.

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
  per run een JSON en één regel in `experimenten/runs.csv` (52 kolommen: beide zaden,
  alle parameters die tussen condities verschillen, en alle uitkomst- en structuurmaten).
  Onderaan verschijnt per conditie het gemiddelde met een 95%-interval over de zaden.

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
| `tests/` | Playwright-tests die de eigenschappen bewijzen waarop de paper zich beroept |
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
