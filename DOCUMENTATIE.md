# Documentatie — AI Testing Tool

Dit is het centrale document van het project. Alles wat we bedenken, meten en
veranderen wordt hier bijgehouden: de opzet van de tests, hoe er gescoord wordt,
welke faalpatronen we herkennen en wat de remedie is, het formaat van de
resultaatbestanden, en onderaan het logboek.

---

## 1. Waarom dit project bestaat

De vraag die hieronder ligt:

> Wanneer, hoe en waardoor gaat een te klein of slecht getraind netwerk slecht
> presteren, hoe uit zich dat, hoe herken je het, en welke methodes kun je toepassen
> om de resultaten te verbeteren? De focus ligt op **lokaal draaiende modellen**.

Die vraag valt uiteen in twee heel verschillende dingen, en daarom zitten er twee
tests in dit project:

1. **Een netwerk dat je zelf traint** — daar zie je capaciteit en training letterlijk:
   te weinig lagen/neuronen, te weinig data, te veel epochs. Dat is de `nn-layer-test`.
2. **Een voorgetraind taalmodel dat je alleen kunt bevragen** — daar zie je alleen het
   gedrág. Je kunt niet in de gewichten kijken; je kunt alleen systematisch dezelfde
   opdrachten stellen en registreren waar het misgaat. Dat is de `ollama-test`.

Het interessante inzicht van dit project is dat een klein LLM zelden "gewoon iets
minder goed" is. Het valt op een **specifiek punt** om, op een **herkenbare manier**,
en dat punt is meetbaar. Daar is de hele testbatterij op gebouwd.

---

## 2. Structuur van het project

```
AI-testing-tool/
├── index.html                 hoofdmenu
├── nn-layer-test.html         test 01 — neuraal netwerk trainen in de browser
├── resultaten.html            resultaten van test 01 vergelijken
├── ollama-test.html           test 02 — lokale LLM's via de Ollama-API
├── ollama-resultaten.html     resultaten van test 02 + modelkeuze-advies
├── resultaten/                JSON-runs van test 01
├── resultaten-llm/            JSON-runs van test 02 (één bestand per model)
├── datasets/                  MNIST / EMNIST (niet in git)
├── README.md
└── DOCUMENTATIE.md            dit bestand
```

Alle pagina's zijn losse, zelfstandige HTML-bestanden zonder build-stap en zonder
dependencies. Ze bewaren gekozen mappen via de File System Access API (Chrome/Edge),
zodat je niet elke keer opnieuw hoeft te wijzen waar resultaten heen moeten.

---

## 3. Test 01 — NN Layer Test

Kort, omdat deze test er al was voordat dit document bestond.

Je bouwt in de browser een klein neuraal netwerk (tot 5 verborgen lagen), kiest een
taak — koffiereviews, spam, handgeschreven cijfers (MNIST) of letters (EMNIST) — en
stelt zelf activatiefunctie, leersnelheid, resolutie en aantal voorbeelden per klasse
in. Tijdens het trainen zie je de leercurve, de train- en test-nauwkeurigheid en het
aantal parameters.

Waar het om draait: de plek vinden waar méér parameters géén betere score meer
oplevert, en de plek waar te weinig capaciteit of te weinig data de score hard
begrenst. Runs sla je op in `resultaten/`; `resultaten.html` zet ze naast elkaar,
inclusief een parameters-versus-nauwkeurigheid-plot.

De datasets worden niet meegeleverd (zie `datasets/README.md`).

---

## 4. Test 02 — Ollama LLM-test

### 4.1 Uitgangspunten

- **Vast**: alle modellen krijgen exact dezelfde 18 opdrachten. De set heeft een
  versie (`ollama-suite-v1`) die in elk resultaatbestand wordt meegeschreven. Als de
  opdrachten ooit veranderen, gaat die versie omhoog en zijn oude runs niet meer
  één-op-één vergelijkbaar (de resultatenpagina markeert dat).
- **Deterministisch**: `temperature 0`, `seed 42`, `top_k 1`. Verschillen komen dan
  van het model, niet van toeval.
- **Automatisch beoordeeld**: elke opdracht heeft objectieve checks. Geen enkel
  oordeel hangt af van "vind ik dit een mooi antwoord".
- **Denkmodus uit**: modellen die kunnen redeneren (`thinking` in hun capabilities)
  krijgen standaard `think: false`, zodat de vergelijking eerlijk blijft en de
  tokenlimiet niet opgaat aan denkstappen. Aanzetten kan met één vinkje; de
  denkstappen worden dan apart per opdracht bewaard en de tokenlimiet gaat ×3.

### 4.2 De zes vaardigheden

| # | Vaardigheid | Wat eronder valt | Waar we op letten |
|---|---|---|---|
| 1 | Generatief & creatief | schrijven, herschrijven, brainstormen | fluency, tone of voice, variatie, houdt het zich aan de vorm |
| 2 | Structuur & transformatie | samenvatten, vertalen, data-extractie | compleetheid, accuraatheid, format-compliance |
| 3 | Analyse & classificatie | labelen, modereren, reviewen | precisie, geen false positives, consistentie bij herhaling |
| 4 | Logica & redeneren | rekenen, business-logica, puzzels | kloppen de tussenstappen, robuustheid tegen ruis |
| 5 | Techniek & code | code schrijven, debuggen | executeerbaarheid, randgevallen, veiligheid |
| 6 | Agentisch gedrag | plannen, tool use, foutcorrectie | succesratio, toolselectie, binnen de guardrails blijven |

### 4.3 De 18 opdrachten

Niveau 1 = makkelijk · niveau 2 = gemiddeld · niveau 3 = normaal gesproken werk voor
een groter model.

#### 1 · Generatief & creatief

| id | niveau | opdracht | wat er gecontroleerd wordt |
|---|---|---|---|
| `gen-1` | 1 | productbeschrijving RVS-waterfles | exact 3 zinnen · 40–80 woorden · Nederlands · het woord "duurzaam" vermijden · geen inleiding |
| `gen-2` | 2 | klacht formeel herschrijven | ordernummer 88421, datum 12 maart en bedrag € 149,95 behouden · max 80 woorden · geen uitroeptekens · geen spreektaal |
| `gen-3` | 3 | 5 campagneconcepten in strak formaat | exact 5 genummerde regels · vast regelformaat met `doelgroep:` en `belofte:` · titel in hoofdletters · 5 unieke doelgroepen · belofte ≤ 12 woorden · drie verboden woorden · geen extra tekst |

#### 2 · Structuur & transformatie

| id | niveau | opdracht | wat er gecontroleerd wordt |
|---|---|---|---|
| `struct-1` | 1 | vergaderverslag samenvatten | exact 2 zinnen · max 40 woorden · noemt de omzetstijging en de kostendruk · **geen getal dat niet in de bron staat** |
| `struct-2` | 2 | data-extractie uit een e-mail naar JSON | geldige JSON · alleen JSON · exact de 4 gevraagde sleutels · beide telefoonnummers · beide e-mailadressen · bedragen als getal · 3 datums in ISO |
| `struct-3` | 3 | 4 rommelige, meertalige records normaliseren | JSON-array · 4 objecten · alle datums naar `YYYY-MM-DD` · alle bedragen numeriek (punt/komma/duizendtallen) · landcodes afgeleid uit plaats/rechtsvorm · betaald-status als boolean |

#### 3 · Analyse & classificatie

| id | niveau | opdracht | wat er gecontroleerd wordt |
|---|---|---|---|
| `klas-1` | 1 | 5 reviews labelen — **wordt 3× gedraaid** | regelformaat · alle 5 labels correct · **3× exact hetzelfde antwoord** · geen verzonnen labels |
| `klas-2` | 2 | 6 supporttickets: categorie + urgentie in JSON | geldige JSON met 6 items · alleen JSON · geen labels buiten de gesloten set · categorieën correct · urgenties correct |
| `klas-3` | 3 | privacytekst toetsen aan 4 regels | 4 regels in het gevraagde formaat · regel 1 FAIL · regel 2 PASS · regel 3 FAIL · regel 4 PASS · citaat bij elke FAIL · geen extra oordelen |

#### 4 · Logica & redeneren

| id | niveau | opdracht | wat er gecontroleerd wordt |
|---|---|---|---|
| `logic-1` | 1 | jas van € 180, 25% korting, € 6,95 verzending | vaste `ANTWOORD:`-regel · uitkomst 141,95 · tussenstap 135 zichtbaar |
| `logic-2` | 2 | dezelfde soort som, mét afleiders (machinist, reizigers, fietsen, 40% uitstap) | uitkomst 09:05 · gebruikt 47 en 6 minuten · **noemt de afleidergetallen niet in de berekening** |
| `logic-3` | 3 | roosterpuzzel, 4 personen, 5 voorwaarden | vaste `ANTWOORD:`-regel · elke dag correct · zichtbare denkstappen |

De puzzel van `logic-3` heeft **precies één** geldige oplossing (nagerekend met een
brute-force-check): maandag = Bram, dinsdag = Ada, woensdag = Chi, donderdag = Dries.

#### 5 · Techniek & code

De code wordt uitgevoerd in een **web worker** met een time-out van 2,5 seconde, zodat
een oneindige lus de pagina niet vastzet. "Werkt de code" is dus geen inschatting maar
een meting.

| id | niveau | opdracht | testgevallen |
|---|---|---|---|
| `code-1` | 1 | `slugify(tekst)` schrijven | `"Hallo Wereld"` → `hallo-wereld` · `"  Café  del   Mar! "` → `cafe-del-mar` · `"A---B"` → `a-b` · `"Één, twee & drie"` → `een-twee-drie` |
| `code-2` | 2 | bug oplossen in `mediaan(getallen)` (lexicografisch sorteren + het even-geval) | `[3,1,2]`→2 · `[10,2,33,4]`→7 · `[1..10]`→5.5 · `[5]`→5 |
| `code-3` | 3 | `verwerkBestellingen(regels)`: parsen, valideren, groeperen, afronden, sorteren met tie-break | volledige set · tie-break alfabetisch · lege invoer → `[]` · negatieve prijs wordt overgeslagen · geen `eval` |

#### 6 · Agentisch gedrag

| id | niveau | opdracht | wat er gecontroleerd wordt |
|---|---|---|---|
| `agent-1` | 1 | doel opknippen in max 6 stappen | 3–6 genummerde stappen · elke stap ≤ 12 woorden · begint met een werkwoord (heuristisch) · geen inleiding/afsluiting |
| `agent-2` | 2 | juiste tool kiezen uit 3, als puur JSON | alleen JSON · kiest `maak_factuur` · geen verzonnen tool · klantnummer `KL-0087` · bedrag `249.5` als getal |
| `agent-3` | 3 | **tweetraps-loop**: eerste aanroep krijgt "voorraad ontoereikend, slechts 2 op voorraad" terug | beurt 1 geldige JSON en zinnige tool · beurt 2 geldige JSON · **geen tool buiten de toegestane set** · herhaalt niet exact dezelfde mislukte aanroep · kiest `meld_backorder` · meldt 3 ontbrekende stuks |

`agent-3` is de enige opdracht met een echte agent-loop: de pagina speelt het systeem,
geeft een foutmelding terug en kijkt of het model zelfstandig herstelt zonder buiten
de kaders te stappen.

### 4.4 Hoe er gescoord wordt

Elke opdracht heeft een lijstje checks met een gewicht. Een check geeft goed (1),
fout (0) of gedeeltelijk (bijvoorbeeld 4 van de 6 tickets correct → 0,67).

```
score per opdracht = 100 × Σ(gewicht × checkscore) / Σ(gewicht)
score per vaardigheid = gemiddelde van de 3 opdrachten
score per niveau      = gemiddelde van de 6 opdrachten op dat niveau
totaalscore           = gemiddelde van alle 18
```

**Sanity check**: op modelantwoorden die precies doen wat er gevraagd wordt scoort de
batterij 99–100/100 (nagerekend met referentie-antwoorden, inclusief werkende
referentie-implementaties voor de drie code-opdrachten). De opdrachten zijn dus
oplosbaar en de beoordeling is niet stiekem te streng.

Kleurcodes die overal terugkomen: **80–100** goed · **55–79** wisselvallig ·
**0–54** onbruikbaar.

---

## 5. Faalpatronen — herkennen en oplossen

Dit is de kern van de vraag. Elke check is gekoppeld aan een faalpatroon; daarnaast
worden drie patronen automatisch gedetecteerd op de ruwe uitvoer (herhaling,
taalwissel, afkapping). Na afloop staat er per gevonden patroon hoe vaak het optrad,
wat het is, en wat je eraan doet.

| Patroon | Hoe het zich uit | Wat je eraan doet |
|---|---|---|
| **Formaatafwijking** | uitleg om de JSON heen, markdown-hekjes, verkeerde sleutels, andere regelopbouw | `format:"json"` of een JSON-schema/grammar gebruiken, 1–2 voorbeelden meegeven (few-shot), temperature 0, defensief parsen in je eigen code |
| **Telinstructies genegeerd** | "exact 3 zinnen" wordt er 5; woordlimieten worden overschreden | niet op tellen rekenen: begrenzen met `num_predict`, in code afkappen of controleren, en om een telbare structuur vragen (genummerde regels) |
| **Verbodsinstructie genegeerd** | het verboden woord staat er gewoon; "geen uitleg" levert toch uitleg | negaties omzetten naar positieve instructies ("gebruik uitsluitend …"), achteraf filteren en zo nodig één keer opnieuw vragen |
| **Praat eromheen** | "Natuurlijk! Hier is…", afsluitende samenvattingen | strakke system-prompt, stop-sequences, inleidingen strippen in je code |
| **Feit kwijt of verzonnen** | ordernummer verdwijnt uit de herschreven mail; getallen in de samenvatting die niet in de bron staan | context verkleinen, splitsen in extractie-eerst-dan-samenvatten, temperature 0, laten citeren wat gebruikt wordt |
| **Reken- of redeneerfout** | plausibel ogend maar fout getal, ook als de tussenstappen kloppen | expliciet om tussenstappen vragen; rekenwerk door code laten doen via tool use; anders een groter of reasoning-getuned model |
| **Afgeleid door ruis** | irrelevante aantallen uit de prompt duiken op in de berekening | prompt voorfilteren of als vaste velden aanbieden in plaats van lopende tekst; few-shot mét ruis |
| **Code fout** | syntaxfout, of zakt op de randgevallen | code-getuned model (qwen2.5-coder, deepseek-coder), lage temperature, testgevallen meesturen en laten itereren |
| **Verkeerde of verzonnen tool** | tool die niet bestaat, of goede tool met foute argumenten | native tool-calling gebruiken in plaats van tools in de prompt, minder tools tegelijk aanbieden, toolnaam hard valideren |
| **Geen herstel** | herhaalt na een foutmelding exact dezelfde aanroep, of stopt | foutmelding teruggeven mét de toegestane vervolgacties, expliciete staat bijhouden, harde retry-teller met fallback in je eigen code |
| **Inconsistent** | dezelfde vraag levert bij herhaling een ander label op | temperature 0, `top_k 1`, vaste seed; blijft het wisselen, dan zit het model op de rand van zijn kunnen — labels vereenvoudigen of groter model |
| **Herhaling / loop** | dezelfde zin blijft terugkomen | `repeat_penalty` omhoog (1,1–1,3), `num_predict` begrenzen, prompt inkorten, minder agressieve quantisatie (Q5/Q6 in plaats van Q2/Q3) |
| **Taalwissel** | (deels) Engels terwijl om Nederlands gevraagd is | system-prompt in het Nederlands, Nederlands voorbeeld meegeven, of een model met betere meertalige dekking |
| **Afgekapt** | antwoord stopt middenin (`done_reason: length`) | `num_predict` en `num_ctx` omhoog, of prompt inkorten — let op het geheugengebruik |

Daarnaast wordt het **breekpunt** bepaald: het eerste niveau waarop de gemiddelde
score onder de 55 zakt. Dat leidt tot een van vier conclusies:

- **valt al om bij niveau 1** — structureel te klein of te zwaar gekwantiseerd; groter
  model of mildere quantisatie, of taken opsplitsen tot ze triviaal zijn;
- **breekpunt bij niveau 2** — enkelvoudige taken lukken, meerdere eisen tegelijk niet;
  taken opknippen tot één eis per aanroep is dan vaak effectiever dan een groter model;
- **breekpunt bij niveau 3** — prima voor routinewerk; zware gevallen doorschakelen naar
  een groter model op basis van invoerlengte of aantal eisen;
- **geen breekpunt** — plafond nog niet gevonden; testen met langere invoer.

---

## 6. Formaat van de resultaatbestanden

Eén bestand per afgeronde test: `resultaten-llm/llm_<model>_<JJJJMMDD-uummss>.json`.

```jsonc
{
  "schema": "ollama-llm-test/v1",
  "testsetVersie": "ollama-suite-v1",
  "tijdstip": "2026-09-06T06:12:00.000Z",
  "host": "http://localhost:11434",
  "model": {
    "naam": "qwen3.5:0.8b",
    "familie": "qwen35", "architectuur": "qwen35",
    "parameterGrootte": "873.44M", "parameterAantal": 873438784,
    "quantisatie": "Q8_0", "formaat": "gguf",
    "contextLengte": 262144, "grootteBytes": 1036046583,
    "capabilities": ["completion","vision","tools","thinking"],
    "systemPrompt": "", "template": "…", "beschrijving": "…",
    "licentieFragment": "…", "parametersVanMaker": "…",
    "digest": "f3817196d142", "gewijzigd": "…"
  },
  "opties": { "temperature": 0, "seed": 42, "top_k": 1, "denkmodus": "uit" },
  "totaal":       { "score": 42, "aantalTests": 18 },
  "perCategorie": { "gen": { "score": 51, "perNiveau": { "1": 78, "2": 60, "3": 15 } }, "…": {} },
  "perNiveau":    { "1": 71, "2": 44, "3": 12 },
  "snelheid":     { "gemTokensPerSec": 68.9, "gemEersteTokenMs": 210,
                    "totaalTokens": 5820, "totaleTijdMs": 254000 },
  "vlaggen":      { "formaat": 6, "reken": 3, "tool": 2 },
  "tests": [
    {
      "id": "struct-2", "cat": "struct", "level": 2, "titel": "Data-extractie naar JSON",
      "prompts": ["…"], "antwoorden": ["…"], "denkstappen": null,
      "checks": [ { "id":"json", "label":"geldige JSON", "weight":3, "flag":"formaat",
                    "ok":true, "score":1, "info":"" } ],
      "score": 64, "vlaggen": ["formaat"],
      "meta": [ { "totaalMs":4210, "eersteTokenMs":190, "tokens":214,
                  "promptTokens":331, "tokensPerSec":66.2, "doneReason":"stop" } ],
      "codeSandbox": null
    }
  ],
  "analyse": { "oordeel": "…", "sterk": [], "zwak": [], "breekpunt": 2, "bevindingen": [] }
}
```

De volledige prompts en antwoorden zitten in het bestand. Dat maakt de bestanden
groter, maar je kunt achteraf altijd terugzien wat er precies gevraagd en geantwoord
is — dat is nodig om over faalpatronen te kunnen praten.

---

## 7. Vergelijken en het juiste model kiezen

`ollama-resultaten.html` leest de map `resultaten-llm/` (of losse geüploade bestanden).

- **Tabel** met alle runs: model, parameters, quantisatie, totaalscore, zes
  vaardigheidsscores, formaatbetrouwbaarheid, consistentie, tokens per seconde.
  Klik een rij aan om hem in de grafieken te tonen (maximaal 5).
- **Radar** — het profiel per vaardigheid, meerdere modellen over elkaar.
- **Niveaulijnen** — score per moeilijkheidsgraad; de knik laat het breekpunt zien.
- **Faalpatroonmatrix** — welk patroon hoe vaak, per model.
- **Detailkaarten** — per run alle 18 scores, de vlaggen en de volledige analyse.

### Het adviesformulier

Je vult in wat voor werk het is (één of meer vaardigheden), hoe zwaar (niveau 1–3),
wat zwaarder weegt (kwaliteit ↔ snelheid), of gestructureerde uitvoer een harde eis
is, en wat je hardwarelimiet en minimale snelheid zijn. De ranking werkt zo:

```
basis        = 0,7 × score op het gevraagde niveau + 0,3 × gemiddelde van de lagere niveaus
kwaliteit    = 0,6 × gemiddelde over de gekozen vaardigheden
             + 0,4 × de zwakste van die vaardigheden      ← geen zwakke schakel toestaan
als JSON een harde eis is:
kwaliteit    = 0,65 × kwaliteit + 0,35 × formaatbetrouwbaarheid
geschiktheid = kwaliteit × (1 − snelheidsweging) + relatieve snelheid × snelheidsweging
```

Modellen die buiten de hardwarelimiet of onder de minimale snelheid vallen, worden
apart getoond met de reden. Van de top 3 zie je per model de argumenten vóór en de
bezwaren, zodat je de keuze zelf kunt narekenen in plaats van een cijfer te moeten
geloven.

Waarom de zwakste schakel meetelt: in productie bepaalt niet het gemiddelde maar de
zwakste vaardigheid hoe vaak je pipeline stukloopt.

---

## 8. Draaiboek

1. Open `ollama-test.html`. Het bolletje rechtsboven wordt groen zodra Ollama
   bereikbaar is (er wordt elke 6 seconden gepolst).
2. Het draaiende model wordt automatisch geselecteerd via `/api/ps`; je kunt ook zelf
   een model uit de lijst kiezen.
3. Klik **haal modelgegevens op** — naam, parameters, quantisatie, architectuur,
   contextlengte, capabilities en de omschrijving/systeemprompt van de maker worden
   opgehaald en gaan mee in het resultaatbestand.
4. Kies eenmalig de map `resultaten-llm` via **kies resultatenmap** (die keuze wordt
   onthouden).
5. **Start de test.** Je kunt pauzeren, stoppen, of per stap op een klik wachten.
6. Aan het eind verschijnt de analyse en wordt het JSON-bestand automatisch opgeslagen.
7. De pagina blijft klaarstaan: kies een ander model en start opnieuw.
8. Vergelijken en kiezen doe je op `ollama-resultaten.html`.

**Blijft het bolletje rood?** Dan blokkeert Ollama de pagina via CORS. Zet
`OLLAMA_ORIGINS` op `*` en herstart Ollama (Windows: `setx OLLAMA_ORIGINS "*"`, daarna
Ollama afsluiten via het systeemvak en opnieuw starten).

---

## 9. Beperkingen en aandachtspunten

- **Eén hardware-context.** Tokens per seconde zeggen alleen iets over de machine waar
  je op meet. Scores zijn hardware-onafhankelijk, snelheid niet.
- **Nederlandstalige testset.** Modellen met zwakke Nederlandse dekking scoren lager
  dan ze in het Engels zouden doen. Dat is bewust — het gebruik is Nederlandstalig —
  maar het is geen algemeen oordeel over het model.
- **Werkwoord-check is heuristisch.** Bij `agent-1` wordt met een stopwoordenlijst
  gecontroleerd of een stap met een werkwoord begint. Dat kan af en toe misgaan; het
  weegt daarom licht mee.
- **18 opdrachten is een steekproef.** Eén opdracht per vaardigheid per niveau geeft
  richting, geen statistische zekerheid. Voor een harde uitspraak over één specifieke
  taak maak je een eigen set van 20–50 gevallen uit je eigen data.
- **Denkmodus verandert het speelveld.** Aanzetten geeft reasoning-modellen een
  duidelijk voordeel op de logica-opdrachten, ten koste van tijd. Vergelijk alleen
  runs met dezelfde instelling; die staat in `opties.denkmodus`.
- **File System Access API.** Automatisch opslaan in een map werkt in Chrome en Edge.
  In andere browsers gebruik je de downloadknop.

---

## 10. Logboek

### 2026-09-06 — Ollama LLM-test toegevoegd
- Nieuw: `ollama-test.html` — verbindingsindicator met groen statusbolletje,
  uitschuifbaar vak met installatie-eisen, modelgegevens via `/api/show` en `/api/ps`,
  18 vaste opdrachten met live streaming antwoorden, automatische beoordeling,
  faalpatroon-diagnose met remedies, radar- en niveaugrafieken, opslaan als JSON.
- Nieuw: `ollama-resultaten.html` — vergelijkingstabel, radar-overlay, niveaulijnen,
  faalpatroonmatrix, detailkaarten en het adviesformulier voor modelkeuze.
- `index.html`: menu uitgebreid met beide nieuwe pagina's; de bestaande resultatenkaart
  heet nu "Resultaten neurale netwerken".
- Nieuwe map `resultaten-llm/` voor de LLM-runs.
- Verificatie: referentie-antwoorden scoren 99–100/100; de drie code-opdrachten zijn
  met werkende referentie-implementaties op 100/100 gecontroleerd; de roosterpuzzel van
  `logic-3` is met brute force op één unieke oplossing gecontroleerd; het streamen en
  uitlezen van de Ollama-API is getest tegen een echt draaiend model.
- Ondersteuning voor thinking-modellen: `think` wordt standaard uitgezet, is met één
  vinkje aan te zetten, en denkstappen (zowel het aparte `thinking`-veld als inline
  `<think>`-blokken) worden apart bewaard in plaats van meegescoord.

### 2026-09-05 — Beginsituatie
- `nn-layer-test.html`, `resultaten.html` en `index.html` bestonden al; 58 runs
  opgeslagen in `resultaten/`.
