# AI Testing Tool — lokaal model lab

Een verzameling losse HTML-pagina's waarmee je **op je eigen hardware** kunt meten
wanneer een klein of slecht getraind model onderuit gaat, hoe zich dat uit, en wat
je eraan kunt doen. Geen server, geen build, geen dependencies: open een bestand in
Chrome of Edge en het draait.

De centrale vraag achter dit project:

> Wanneer, hoe en waardoor gaat een te klein of slecht getraind (LLM-)netwerk slecht
> presteren, hoe herken je dat, en welke methodes kun je toepassen om de resultaten
> te verbeteren?

## Snelstart

1. Clone of download deze map.
2. Open `index.html` in Chrome of Edge (dubbelklikken volstaat).
3. Kies een test:
   - **NN Layer Test** — bouw zelf een klein neuraal netwerk en zie waar het omslaat.
   - **Ollama LLM-test** — test een lokaal draaiend taalmodel op 18 vaste opdrachten.

Voor de LLM-test heb je [Ollama](https://ollama.com/download) nodig met minstens één
model. De pagina zelf bevat een uitschuifbaar vak met alle installatiestappen en een
groen/rood statusbolletje voor de verbinding.

```bash
ollama pull llama3.2:3b
ollama run llama3.2:3b
```

## Inhoud

| Bestand | Wat het is |
|---|---|
| `index.html` | Hoofdmenu |
| `nn-layer-test.html` | Neuraal netwerk trainen in de browser (koffiereviews, spam, MNIST-cijfers, EMNIST-letters) |
| `resultaten.html` | Runs van de NN-test vergelijken |
| `ollama-test.html` | Testbatterij voor lokale LLM's via de Ollama-API |
| `ollama-resultaten.html` | LLM's naast elkaar leggen + adviesformulier "welk model voor mijn taak" |
| `resultaten/` | Opgeslagen runs van de NN-test (JSON) |
| `resultaten-llm/` | Opgeslagen runs van de LLM-test (JSON, één bestand per model) |
| `datasets/` | MNIST/EMNIST — **niet in git**, zie `datasets/README.md` |
| `DOCUMENTATIE.md` | De volledige documentatie: alle opdrachten, scoring, faalpatronen, remedies en het logboek |

## De LLM-testbatterij in het kort

18 vaste opdrachten = **6 vaardigheden × 3 moeilijkheidsgraden**, altijd exact
dezelfde vragen, met `temperature 0` en `seed 42`, zodat verschillen door het model
komen en niet door toeval.

| # | Vaardigheid | Waar je het aan ziet als het misgaat |
|---|---|---|
| 1 | Generatief & creatief | tel- en verbodsinstructies worden genegeerd |
| 2 | Structuur & transformatie | JSON met uitleg eromheen, verkeerde sleutels, verzonnen getallen |
| 3 | Analyse & classificatie | verzonnen labels, wisselende uitkomsten bij herhaling |
| 4 | Logica & redeneren | plausibel maar fout getal, afgeleid door irrelevante info |
| 5 | Techniek & code | code draait niet, of zakt op de randgevallen |
| 6 | Agentisch gedrag | verkeerde of verzonnen tool, geen herstel na een fout |

De code-opdrachten worden **echt uitgevoerd** in een sandbox met time-out, en de
zwaarste agent-opdracht is een echte tweetraps-loop waarin de eerste tool-aanroep
faalt en het model zelf een alternatief moet kiezen.

Aan het eind krijg je per model een totaalscore, een radarprofiel per vaardigheid,
een "waar valt het om"-grafiek per moeilijkheidsgraad, en per gevonden faalpatroon
een uitleg plus een concrete remedie. Alles wordt weggeschreven als één JSON-bestand
per model in `resultaten-llm/`.

Volledige details staan in [DOCUMENTATIE.md](DOCUMENTATIE.md).

## Privacy

Alles draait lokaal. Er gaat geen prompt, geen antwoord en geen resultaat naar een
externe dienst; het enige netwerkverkeer is naar `localhost:11434` (Ollama) en naar
Google Fonts voor de lettertypen.
