# Werkplan — ANG verbeteren en het onderzoek voor de paper doen

Versie 3, 8 september 2026. Herzien na `kritiek chatGPT.docx` en na jouw drie
werkafspraken: **elke stap past in één sessie**, **elke stap eindigt met documentatie
bijwerken en pushen**, en **elke stap levert data en een stuk paper op**.

De kritiek is scherp en op één punt aantoonbaar terecht: er zit een echte fout in de
eligibility-traces. Dat bepaalt de volgorde — die fout moet weg *voordat* we een
ablatiereeks draaien, anders meten we straks honderden runs met een leerregel die niet is
wat de paper beschrijft.

---

## De vaste afsluiting van elke stap

Elke stap hieronder is pas klaar als deze vijf dingen gedaan zijn. Dit staat één keer
opgeschreven en wordt bij elk werkpakket niet herhaald.

1. **De code doet wat er staat** — de test die bij het pakket hoort is groen.
2. **De data staat vast.** Alles wat gemeten is gaat als JSON per run plus één regel in
   `experimenten/runs.csv`, met zaad, alle instellingen en de uitkomst. Nooit een getal
   in een gesprek dat niet ook in een bestand staat.
3. **De paper is bijgewerkt.** Niet aan het eind allemaal tegelijk — elke stap schrijft
   zijn eigen alinea, tabel of figuur meteen weg. Bij elk pakket staat hieronder welk
   stuk dat is.
4. **De documentatie is bijgewerkt:** `README.md` als het gedrag of de bediening
   verandert, `DOCUMENTATIE.md` bij nieuwe meetgrootheden, en de projectdocumenten
   (`claude/brein-testpagina.md`, `claude/ang-paper.md`,
   `claude/brein-bugs-en-standaardwaarden.md`) met wat er gevonden en besloten is.
5. **Gecommit en gepusht** naar `spikalo/AI-testing-tool`, met een berichttekst die zegt
   wat er gemeten is, niet alleen wat er veranderd is.

**Over tokens.** Het rekenwerk is goedkoop — honderd trainingen is één commando met drie
regels uitvoer. Duur is het lezen en schrijven van code. Begin elke sessie met "lees
`brein-test.html` niet in zijn geheel maar alleen wat je nodig hebt".

---

## Stap 0 — Pushen mogelijk maken (5 minuten, en dit moet jij doen)

Ik draai op je machine in een Linux-omgeving die de Windows Credential Manager niet ziet.
`git push` faalt daar met *could not read Username*. Zolang dat zo is kan ik stap 5 van de
afsluiting niet zelf doen en blijft het bij committen.

Eén van deze twee, één keer:

**A. Persoonlijk toegangstoken (snelst).** Maak op GitHub een fine-grained token met
alleen `Contents: read and write` op deze ene repository, en draai in de projectmap:

```
git config credential.helper store
git push
```

Bij de eerste push vraagt hij om gebruikersnaam (`spikalo`) en wachtwoord — plak daar het
token. Daarna onthoudt hij het. Let op: het token staat dan in leesbare tekst in
`~/.git-credentials` van die omgeving. Acceptabel voor één repository met beperkte rechten.

**B. SSH-sleutel (netter).** Sleutel maken, de publieke helft bij GitHub → Settings → SSH
keys plakken, en de remote omzetten naar `git@github.com:spikalo/AI-testing-tool.git`.
Ik kan de sleutel maken en de exacte regels geven; het plakken op GitHub doe jij.

Zeg welke je wilt, dan doe ik de rest. Kies je geen van beide, dan commit ik netjes en
push jij zelf aan het eind van de dag — ook prima, maar dan moet ik het je elke keer
melden.

---

## Stap 1 — Reproduceerbaarheid, breinen inladen, en een experimentloper

*Waarom eerst:* zonder dit is geen enkel resultaat te herhalen, en dan is het geen
onderzoek. Nu wordt het brein aangemaakt met `Math.random()` als zaad, dus dezelfde
instellingen geven elke keer een ander brein.

**Bouwen**
- Brein-zaad zichtbaar en instelbaar in de UI, opgeslagen in het resultaatbestand, met
  een knop **"herhaal deze run"** die zaad én instellingen terugzet.
- **Brein inladen uit een eerder resultaat.** *(jouw wens)* Een knop "laad brein uit
  resultaat" die een JSON uit `resultaten-brein/` inleest, met twee mogelijkheden:
  1. **alleen de instellingen** — alle schuiven, typenaantallen, dichtheid,
     beloningsgewichten en het zaad terugzetten, zodat je verder kunt experimenteren
     vanaf precies die configuratie;
  2. **het hele brein** — knopen, soorten, verbindingen en gewichten uit de opgeslagen
     eindstructuur terugzetten, zodat je een getraind brein kunt *doortrainen*, op nieuwe
     werelden kunt toetsen, of als startpunt voor een variant kunt gebruiken.

  Het resultaatbestand bevat de volledige eindstructuur al — daarom kan de viewer het
  netwerk hertekenen — dus (2) is vooral een `loadBrain(json)` naast `createBrain()`, met
  de bestaande invariantcontrole er overheen. Bij (1) een waarschuwing als het bestand uit
  een oudere versie komt en een veld mist.
- `runHeadless` uitbouwen tot een echte experimentloper: een lijst condities × zaden,
  achter elkaar afgedraaid, per run één JSON plus één regel in `experimenten/runs.csv`.
  Voortgang en een afbreekknop, want zo'n reeks duurt minuten tot een uur.

**Test die het bewijst**
Twee keer dezelfde conditie met hetzelfde zaad → identieke leercurve tot op het laatste
cijfer. En: een ingeladen brein dat direct getoetst wordt haalt dezelfde score als in het
bestand staat. Faalt dat, dan lekt er ergens toeval binnen.

**Paper:** methodesectie — een alinea over reproduceerbaarheid en het bestandsformaat, en
een appendix met de velden van een resultaatbestand. Dat is precies wat een lezer nodig
heeft om je te geloven.

**Data:** `experimenten/runs.csv` bestaat en heeft zijn eerste tien regels (de
herhaalbaarheidscontrole zelf).

---

## Stap 2 — De eligibility-fout herstellen

*Nieuw, en het belangrijkste punt uit de kritiek.*

In `updateTraces()` staat:

```js
B.cE[c] = lam*B.cE[c] + k1*act[B.cFrom[c]]*dev[B.cTo[c]];
```

`act` is de toestand **na** de propagatie. Maar `propagate()` is synchroon: eerst worden
alle verbindingssommen berekend uit de *oude* toestand, daarna pas geschreven. De
activatie die de uitvoer van knoop *j* daadwerkelijk veroorzaakte is dus `B.prev[i]`,
niet `B.act[i]`. Voor verbindingen die uit een invoer-node komen klopt het toevallig wel
— die worden aan het begin van de propagatie op de sensorwaarde gezet en veranderen niet
meer — maar voor alles wat uit de wolk zelf komt is de trace gevuld met een grootheid van
één tik te laat.

Dat is precies de term waar de paper hard over doet: de score-functie `δ = a − p` is
exact voor de Bernoulli-uitvoer, maar de volledige gradiënt bevat óók de presynaptische
activatie die die uitvoer produceerde. Die staat er nu verkeerd in.

**Herstel:** in `propagate()` aan het begin van de laatste propagatiestap een snapshot
`B.pre` wegschrijven, en `updateTraces()` daaruit laten lezen. Dat werkt meteen goed voor
`prop > 1`, waar het probleem groter is. De invoer-nodes hoeven niet apart behandeld te
worden zolang de snapshot ná het inzetten van de sensorwaarden genomen wordt.

**Meten, niet aannemen:** 12 zaden vóór en 12 zaden ná, zelfde instellingen. Het leert nu
al, dus dit is geen "het werkt niet"-bug. Het verschil is zelf een resultaat — en als het
verschil nul is, is dát een resultaat waar je in de paper eerlijk over bent.

**Paper:** sectie 5 — de formule met de juiste presynaptische term, plus een kort kader
"implementatiedetail dat er wél toe doet" met de gemeten voor/na-vergelijking. Dat soort
eerlijkheid maakt een paper sterker, niet zwakker.

**Data:** 24 runs in `runs.csv` onder conditie `trace-oud` en `trace-nieuw`.

---

## Stap 3 — De leerregel numeriek controleren

De sterkste claim in de paper is dat node-perturbatie een schatter van de echte gradiënt
oplevert, zuiver tot op een tweede-orde term. Dat is opgeschreven en niet gemeten. De
kritiek heeft gelijk dat het daarmee te sterk geformuleerd is.

**Bouwen:** een los scriptje met een piepklein ANG — vier verborgen knopen, bevroren
topologie — en vaste wereldzaden zodat `J` glad is. Bereken per gewicht numeriek

```
(J(w+ε) − J(w−ε)) / 2ε
```

over veel afspelen, en vergelijk met de gemiddelde ANG-update. Rapporteer:

- `cos(Δw_ANG, ∇J)` — wijst de update de goede kant op?
- bias en variantie van de schatter, en hoeveel monsters je nodig hebt voor een gegeven
  betrouwbaarheid;
- hetzelfde vóór en ná de correctie uit stap 2, zodat je ziet wat die correctie waard is.

**Uitkomst bepaalt de tekst.** Nette positieve cosinus → de claim mag blijven staan, mét
cijfers. Rommelig → de formulering wordt *"een lokale, beloningsgemoduleerde
plasticiteitsregel die in de praktijk de goede richting op wijst"*: zwakker, maar
verdedigbaar en met een figuur onderbouwd. Beide zijn publiceerbaar; een claim zonder
meting is dat niet.

**Info vooraf nodig:** de standaardnormalisatie van perturbation-gradient estimators ten
opzichte van de perturbatievariantie opzoeken, zodat de vergelijking eerlijk is.

**Paper:** nieuwe subsectie in sectie 5 met de figuur (cosinus en variantie), en sectie 9
(beperkingen) bijstellen op wat er uitkomt.

**Data:** `experimenten/gradcheck.csv`, plus de figuur in `docs/`.

---

## Stap 4 — Statistiek en een echte benchmarkset

*Waarom:* de spreiding tussen zaden is ongeveer 0,10 — voor een betrouwbaar verschil van
0,10 heb je ruwweg 16 runs per conditie nodig. En twintig toetswerelden is te weinig om
iets over generalisatie te *beweren*: bij 75 % op 20 werelden loopt het 95 %-interval van
ongeveer 51 tot 91 %.

**Bouwen**
- **Vaste benchmarkset:** 500 werelden uit een vast zaad, weggeschreven als bestand, nooit
  gebruikt bij het kiezen van instellingen. De huidige 20 blijven als goedkoop signaal
  tijdens de training; de benchmark is wat in de paper komt. Omdat het beleid stochastisch
  is: elke wereld drie keer spelen.
- **Beide beleidsvormen naast elkaar** in elk resultaat: geloot (`beleid`) en argmax
  (`streng`). De code kan het al, het wordt alleen niet samen weggeschreven. Een groot gat
  tussen die twee is zelf een bevinding — dan is het toeval onderdeel van de strategie.
- Gemiddelde ± 95 %-interval over zaden in de vergelijktabel en in de viewer.
- Mann-Whitney U tussen twee condities, met de uitkomst in gewone taal: *"verschil valt
  binnen de ruis"* of *"verschil is er echt"*.

**Test die het bewijst:** de reactieve agent haalt op de benchmarkset rond 57 % — dat
ijkpunt kennen we al, dus het is een controle op de meetopstelling zelf.

**Paper:** de evaluatiesectie herschrijven — wat er getoetst wordt, op hoeveel werelden,
met welke onzekerheid. Alle getallen die er al in staan krijgen een interval.

**Data:** `experimenten/benchmark-werelden.json` en de eerste benchmarkkolommen in
`runs.csv`.

---

## Stap 5 — Basislijnen binnen dezelfde leerregel

Drie condities die allemaal met de ANG-leerregel getraind worden, zodat het verschil
alleen de *structuur* is:

1. willekeurig beleid — ondergrens;
2. de reactieve agent die recht op het doel af loopt en langs obstakels glijdt — die zit
   nu alleen in testscripts en wordt een echte conditie;
3. **een gelaagd netwerk met hetzelfde parameterbudget, exact dezelfde leerregel.**

Nummer 3 is de scherpste controle die nu volledig ontbreekt: zonder die conditie kun je
niet zeggen of de graafstructuur iets toevoegt of dat het simpelweg de leerregel is die
werkt. Dat is de eerste vraag die een kritische lezer stelt.

**Paper:** de eerste helft van de basislijntabel, met intervallen.

**Data:** 3 condities × 16 zaden in `runs.csv`.

---

## Stap 6 — Backprop-basislijnen en de rekenkostentabel

Twee dingen die de kritiek terecht mist, en die samen in één sessie passen omdat ze
dezelfde meetopstelling delen.

**(a) Basislijnen mét backpropagation:** MLP 16-16-4, MLP 16-32-32-4 en een kleine GRU-16,
getraind met gewone REINFORCE op dezelfde werelden. Dit isoleert wat je *opgeeft* door
geen backprop te gebruiken — een andere vraag dan stap 5, die isoleert wat de structuur
oplevert. Beide zijn nodig.

**(b) De rekenkostenteller.** De paper praat over efficiëntie zonder die te tellen. Tel
per conditie:

| grootheid | hoe |
|---|---|
| kanten-bezoeken per spelstap | tijdens leren ≈ 4·E (schone pas, ruispas, traces, gewichten); bij inferentie ≈ E |
| omgevingsstappen tot 80 % succes | *sample-efficiëntie* |
| totaal kanten-bezoeken tot 80 % | *rekenefficiëntie* |
| wandkloktijd | *praktijk* |
| actieve verbindingen bij inferentie | *inferentiekosten* |

Vier verschillende dingen die allemaal "efficiëntie" heten en zelden hetzelfde zijn. Een
brein dat drie keer zo veel werk nodig heeft om te leren maar daarna vier keer goedkoper
draait is een interessant resultaat — maar alleen als je die kolommen apart rapporteert.
De teller zelf is een handvol regels in de experimentloper.

**Verwachting:** op deze taak wint een klein MLP waarschijnlijk op rekenkosten. Dat is
geen mislukking; dat is wat er dan in de paper komt te staan, met de reden erbij. Maar het
blijft een hypothese tot we het gemeten hebben.

**Paper:** de rekenkostentabel, en de positionering bijstellen (zie stap 10).

---

## Stap 7 — De leerregel verbeteren

Drie ingrepen, alledrie als aanvinkbare optie zodat ze ook als ablatie meetbaar zijn.
Past in één sessie omdat ze alledrie klein zijn; loopt het uit, dan schuift (c) door.

**(a) Een toestandsafhankelijke criticus.** De basislijn is nu een lopend gemiddelde over
stappen; in toestanden die systematisch beter of slechter zijn dan gemiddeld is het
signaal daardoor vertekend. Oplossing: een kleine lineaire criticus op de zestien
sensoren, `V(s) = w·s + b`, getraind met TD(0); de advantage wordt `r + γV(s′) − V(s)`.
Geen backpropagation door de graaf — een losse schatter ernaast, dus het verhaal van de
paper blijft staan. *De kritiek noemt dit onafhankelijk als de meest voor de hand liggende
verbetering; dat twee bronnen hier op uitkomen is een aanwijzing dat het klopt.*

**(b) Schaarse perturbatie.** De variantie van node-perturbatie groeit met het aantal
knopen dat tegelijk verstoord wordt. Per tik maar een deel van de wolk verstoren. Kost
niets en is de standaardtruc.

**(c) Categorisch beleid als variant.** *(nieuw uit de kritiek)* De vier knoppen zijn nu
onafhankelijke Bernoulli's, wat combinaties toestaat die elkaar opheffen: op+neer,
links+rechts, alle vier, geen. Bouw daarnaast een softmax over negen elkaar uitsluitende
acties (acht richtingen + stilstaan). Dan weet je of de onafhankelijke knoppen iets
toevoegen of alleen ruis zijn. Let op: dit raakt de vorm van de score-functie, dus het
hoort langs de controle uit stap 3.

**Test:** 12 zaden, vier condities: huidig / criticus / criticus + schaars / categorisch.
Verwacht: minder spreiding tussen zaden en een gelijke of hogere benchmarkscore. **Werkt
het niet, dan leggen we dat net zo hard vast** — een leerregel die niet beter wordt van
een criticus is zelf een resultaat, en een eerlijker paper.

**Paper:** sectie 5 uitbreiden met de varianten, en de resultaattabel ervan.

---

## Stap 8 — De ablatiereeks draaien

De kerntabel van de paper. Tien condities, elk 12–16 zaden, 500 pogingen — **na** het
herstel uit stap 2, anders is de reeks waardeloos.

| conditie | wat het meet |
|---|---|
| vol model | referentie |
| geen geheugen-neuronen | doet terugkoppeling ertoe? |
| geen reflex-neuronen | doet de korte boog ertoe? |
| geen invoer-neuronen | doet de sensorische laag ertoe? |
| geen snoeien | is opruimen nodig? |
| geen aangroei van verbindingen | is bijgroei nodig? |
| geen neuronale groei | helpt extra capaciteit? |
| geen hertypering | doet de soorttoewijzing ertoe? |
| strenge invoer (alles via invoer-neuronen) | wat kost de grammatica? |
| vaste structuur (alleen gewichten) | doet de plasticiteit ertoe? |

**Kost vooral wachttijd, nauwelijks tokens.** Starten, laten lopen, uitkomst inlezen, tabel
in de paper zetten.

---

## Stap 9 — Parametergevoeligheid en de generalisatiekromme

Dichtheid × aantal neuronen, met trainings- én benchmarkscore, over een raster van
ongeveer vijf bij vier. Daarmee teken je de kromme waar dit hele project om draait:
**wanneer is een netwerk te klein om het patroon te leren, en wanneer zo groot dat het de
trainingswereld uit zijn hoofd leert?** Dat is letterlijk de vraag van je stagebegeleider,
nu meetbaar op een systeem waarvan we elke schroef kennen.

De eerste aanwijzing hebben we al: bij dichtheid 35 is de toets het hoogst, bij 45 en 60
stijgt de trainingsscore nog wel maar de toets niet meer. Dat is het overfittingpunt, en
met genoeg zaden is het een echte figuur.

**Levert op:** één figuur die zowel in de paper als in je stageverslag past.

---

## Stap 10 — Structuur versus prestatie, en paper versie 2

**Analyse over alle runs uit 8 en 9:** voorspellen reflexbogen, lussen, kortste pad,
padlengteverdeling en het aantal meedoende neuronen de benchmarkscore? Met honderden runs
is dat een echte correlatie in plaats van de losse indruk die de viewer nu geeft.

**De positionering bijstellen.** *(uit de kritiek, en ik ben het ermee eens)* De paper moet
niet suggereren dat ANG een goedkoper alternatief voor backpropagation is; op deze taak
wint een klein MLP waarschijnlijk op rekenkosten, en dat hebben we in stap 6 gemeten. De
verdedigbare onderzoeksvraag is smaller en interessanter:

> Kan een lokaal lerende, zichzelf herstructurerende recurrente graaf door structurele
> spaarzaamheid en verschillende informatielatenties een gunstiger compromis tussen
> rekenwerk en gedrag vinden dan een vaste architectuur?

Daar hoort een eerlijke afbakening bij van waar dit kansrijk is: weinig sensoren, weinig
acties, temporele afhankelijkheid, online leren, en een omgeving waarin sommige reacties
snel moeten en andere geheugen vereisen. Niet MNIST, niet pixels.

**Referenties nakijken.** De vijftien referenties zijn uit mijn geheugen opgeschreven.
Jaargangen, paginanummers en bij één titel de vindplaats moeten geverifieerd worden vóór
publicatie. Half uur werk, en precies het soort fout waar een lezer die het vakgebied kent
meteen over valt.

**Schrijven:** sectie 10 vervangen door de echte resultatensectie, met alle tabellen en
figuren uit 2 tot en met 9, en de beperkingen bijstellen op wat we dan weten.

---

## Stap 11 — Een tweede spel: reflex én geheugen tegelijk (volgende week)

*Waarom:* de geheugen-neuronen zijn nu decoratie. In spel A is het doel altijd zichtbaar,
dus er valt niets te onthouden. Elke conclusie over geheugen is daardoor betekenisloos.

**Opzet, in de scherpere vorm uit de kritiek:** combineer twee tijdschalen in één taak.
Het doel verdwijnt na 40 stappen (geheugen over tientallen tikken nodig), én er verschijnen
af en toe obstakels vlak voor de agent die binnen één tik ontweken moeten worden (reflex
nodig). Meet dan niet alleen taaksucces maar ook **reactielatentie** — hoeveel tikken
zitten er tussen prikkel en actie — naast het aantal actieve synapsen.

Dat is een scherpe hypothese: als ANG vanzelf korte sensor→reflex→motor-paden *en* lange
sensor→worker→geheugen→worker→motor-paden vormt, en die padlengtes corresponderen met de
twee tijdschalen in de taak, dan heb je iets laten zien wat een vaste architectuur niet
vanzelf doet. Bij `prop = 1` kost elke boog letterlijk één tijdstap, dus padlengte *is*
latentie in dit model. Dat is het sterkste argument dat ANG heeft.

**Test:** op spel A maakt geheugen uitzetten nauwelijks verschil; op spel B hoort het een
duidelijk gat te geven, en reflex uitzetten hoort de latentie te verhogen. Zien we dat
niet, dan doen die soorten ook daar niets, en dat moet dan gewoon in de paper.

Dit is het grootste pakket. De paper kan af zonder; het is inhoudelijk het interessantste.

---

## Wat ik uit de kritiek *niet* overneem

- **"Twintig toetswerelden zeggen niets."** Klopt voor een claim in de paper, en daarom
  komt er een benchmarkset van 500. Maar als goedkoop signaal tijdens het afstellen blijven
  die twintig prima — je moet alleen niet doen alsof het bewijs is.
- **"Meet 20–30 trainingszaden."** Ideaal, maar 12–16 is genoeg om een verschil van 0,10 te
  zien en scheelt de helft van de wachttijd. Waar het spannend wordt zetten we er meer op.
- **De verwachting dat een MLP wint op rekenkosten** neem ik niet over als aanname maar als
  hypothese die we meten. Ik verwacht hetzelfde, maar "verwachten" is geen resultaat.

---

## Over de paper en het generatorscript

Opgelost: je hebt niets bewust aangepast en het is veilig om terug te gaan naar de
gegenereerde versie. Word herschrijft bij opslaan de hele verpakking, wat de groei van
757 kB naar 822 kB verklaart zonder dat er één letter veranderd is.

**Dus:** `paper.js` blijft de bron van waarheid en overschrijft `ANG-paper.docx` gewoon.
Ik bouw daar in stap 1 één ding bij: de resultatensectie wordt datagestuurd — hij leest
`experimenten/runs.csv` en zet de tabellen zelf op. Dan kost "de paper bijwerken" aan het
eind van elke sessie nog maar één commando, en kan hij nooit uit de pas lopen met de data.

Het document blijft in `.gitignore`; alleen de generator en de figuren gaan mee in git.

---

## Ritme

Elf stappen zijn meer dan zeven dagen, en dat is de eerlijke conclusie van "elke stap moet
in één sessie passen". De week ziet er zo uit:

| dag | stap |
|---|---|
| 1 | 0 + 1 — pushen mogelijk maken, reproduceerbaarheid, brein inladen |
| 2 | 2 — eligibility-herstel, met de voor/na-meting |
| 3 | 3 — numerieke gradiëntcontrole |
| 4 | 4 — statistiek en benchmarkset |
| 5 | 5 + 6 — basislijnen (6 is vooral wachttijd) |
| 6 | 7 — leerregel, en 8 laten lopen terwijl je iets anders doet |
| 7 | 9 — raster en generalisatiekromme |

Stap 10 (paper v2) en 11 (tweede spel) vallen in de week erna. Moet je snijden: 1, 2, 4, 5,
8 en 10 zijn het minimum voor een paper met een resultatensectie die staat.

Wil je dat ik het als terugkerende taak inplan, dan kan dat — maar elke automatische sessie
moet opnieuw context opbouwen en kost dus tokens, ook als er die dag niets te doen valt.
Mijn advies blijft: start elke stap zelf met één zin ("doe stap 3").

---

## Wat ik nog van jou nodig heb

1. **Stap 0:** token of SSH-sleutel, zodat ik zelf kan pushen. Anders commit ik en push jij.
2. **Stap 11:** vind je de gecombineerde reflex-plus-geheugentaak een goed tweede spel, of
   heb je zelf iets in gedachten?
