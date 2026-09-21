# Werkplan spel 3 — de proeftuin (stap 19 t/m 23)

Versie 2, 21 september 2026 (stap 20 afgerond). Versie 1 van 20 september, opgesteld uit `Kritiek chatGPT.docx` en `taak 3.docx`, en uit
het besluit van Frank: *"Ik vind het gebruik van alle originele eigenschappen van ANG niet
meer belangrijk. Je hoeft de neurontypes of elke andere regel niet meer te gebruiken als
dit niet nodig is. Wel zou ik graag nog zien waar dit type graaf goed gaat presteren."*

---

## De vraag die nog openstaat

De kritiek zegt het scherper dan het werkplan tot nu toe deed:

> Je hebt aangetoond dat ANG **kan** veranderen. Je hebt nog niet aangetoond dat ANG weet
> **wanneer** veranderen nuttig is.

En daar hoort een tweede zin bij die het project zelf al tien meetreeksen lang laat zien:
op spel 1 en spel 2 is er geen enkele situatie geweest waarin zelfstructurering
*noodzakelijk* was. Een vaste architectuur met dezelfde leerregel kwam overal even ver.
Dat is geen weerlegging van het idee, het is een uitspraak over de taken.

Spel 3 is de taak die dat gat moet dichten, en hij is zo gebouwd dat de hypothese **kan
winnen én kan verliezen**.

## Wat spel 3 anders doet dan spel 1 en 2

| | spel 1 (doel) | spel 2 (seinhuis) | **spel 3 (proeftuin)** |
|---|---|---|---|
| wat er verandert | de wereld, niet de regel | niets, de regel staat vast | **alleen de betekenis van de invoer** |
| geheugen nodig | nee (taak A) / ja (taak B) | ja, 5–70 tikken | **nee, nooit** |
| wat de plasticiteit te doen heeft | niets | niets | **capaciteit verplaatsen** |

Het beslissende ontwerpverschil: **de zintuigen blijven identiek, de contingentie
verandert.** Elke fase vraagt een ándere groep invoerkanalen. Een net dat in fase A zijn
capaciteit op kleur heeft gezet, moet die in fase C naar beweging verplaatsen en in
fase D naar geur. Dat is precies de situatie waarin herbedraden iets kan betekenen wat
herwegen niet kan — en de reden dat spel 1 en 2 dat nooit lieten zien, is dat daar de
optimale interne organisatie nooit veranderde.

Er is **geen geheugen** nodig, in geen enkele fase. Dat is met opzet: spel 2 liep vast op
geheugen, en de as die daar doodliep hoort hier niet nog eens in de weg te staan.

## Het spel in het kort

Elke tik komt er één voorwerp langs met vier eigenschappen op vaste kanalen — kleur (4
kanalen), beweging (2), grootte (2), geur (2) — plus **zes afleiders** die nooit ergens
over gaan. Het voorwerp moet in één van vier bakken; de handels van spel 1 en 2 zijn de
bakken. Welke eigenschap de bak bepaalt, staat per fase vast:

| fase | regel | welke kanalen ertoe doen |
|---|---|---|
| **A** | bak = kleur | kleur |
| **B** | bak = kleur, paarsgewijs omgewisseld | kleur — zelfde draden, ander gewicht |
| **C** | bak = kleurgroep × beweging | kleur (grof) + **beweging, voor het eerst** |
| **D** | bak = geur × grootte | **geur en grootte, voor het eerst** — kleur doet niets meer |
| **A′** | bak = kleur | kleur opnieuw — behoud en herleren |

~~Fase B is de controlefase: daar hoeft alleen het antwoord om, en een vast net kan dat
door te herwegen.~~ **Weerlegd door de kalibratie (stap 20):** fase B is een val. Na fase A
is het oude antwoord bij elke kleur fout, er komt nooit een positief signaal binnen, en
elke leerder — ook een gelaagd net met de exacte gradiënt — blijft op precies 33,3 %
steken. Zie `claude/ang-kalibratie.md`.

## De score

Informedness over vier bakken: **(gemiddelde trefkans per bak − ¼) / ¾**. Nul voor elke
strategie waarin het antwoord niet van het voorwerp afhangt — altijd dezelfde bak, een
munt van vier kanten, of niets doen — en één voor perfect. Dat is de maat van stap 18
(Youdens J), doorgetrokken naar vier klassen, zodat spel 2 en spel 3 in dezelfde taal
gerapporteerd worden.

Doordat de vaste toetsverzameling in één doorloop gespeeld wordt en de fase-regel alleen
bepaalt *wat goed heet*, levert één meting meteen de score op **alle vijf de regels**.
Daarmee is op elke fasegrens af te lezen: hoe goed op de regel van nu, hoeveel er van de
vorige regels nog over is, en of de agent al iets van een latere regel kan.

## De eerlijkheidsgaranties, vooraf opgeschreven

Vaste regel uit stap 18: *wie het spel schrijft, wint het spel — tenzij hij de
eerlijkheidsgaranties vóóraf opschrijft.* Deze dus:

1. **De schaal wordt nagemeten vóór de eerste conditie draait**: toevalsbodem,
   bovengrens, en de slimste domme spelers (altijd dezelfde bak; de agent die fase A leert
   en daarna nooit meer verandert) moeten allemaal op nul staan.
2. **Een hard verbindingsbudget, gelijk voor elke conditie.** Erbij bouwen kan alleen door
   elders af te breken. Zonder dat budget meet de proef "is méér plasticiteit beter?" in
   plaats van "is zelforganisatie nuttig?" — precies het onderscheid dat de kritiek maakt.
3. **Dezelfde leerregel in elke conditie.** Alleen de structuuras verschilt.
4. **Een leersnelheidsveeg per conditie, op eigen zaden.**
5. **De fasenregels liggen vast vóórdat er één conditie gedraaid heeft.**
6. **Elke voorspelling krijgt een uitgeschreven onwaar-tak.**
7. **Het sensorgebruik per fase moet bewijzen dat de taak werkelijk verschuift** — anders
   meet de proef niet wat zij belooft.

### Over de metabole kost

De kritiek vraagt: *"geef herstructurering een kleine computationele/metabole kost."* Dat
is hier een **hard budget op het aantal verbindingen**, en niet een strafterm in de
beloning. Reden: de beloning gaat door een lopende basislijn, en een vaste aftrek per
poging wordt door die basislijn opgeslokt — die zou in de rapportage staan zonder dat de
leerregel er iets mee doet. Een budget bindt wel. De rekenkosten van het verbouwen worden
daarnaast geteld en gerapporteerd, als getal, niet als leersignaal.

---

## De stappen

### Stap 19 — het spel bouwen en ijken
De taak, de vijf fasen, de score, het verbindingsbudget, de visualisatie in
`brein-test.html`, en de tests. Klaar als: de schaal is nagemeten, de domme spelers staan
op nul, het budget bindt aantoonbaar, spel 1 en spel 2 reproduceren bit voor bit, en de
pagina valt niet om als je spel 3 kiest (de fout van stap 17).

### Stap 20 — kalibratie  **(klaar, 21 september)**
Verslag: `claude/ang-kalibratie.md`; opzet: `experimenten/s20-opzet.json`. Budget 2400,
λ 0, perturbatiefractie 0,1, diepte 3, vaste exploratie, 400 pogingen per fase. Twee
aannames weerlegd: fase B is een val, en de wolk verliest na fase A haar leervermogen —
ook bevroren, terwijl dezelfde leerregel in een gelaagd net herleert.

### Stap 21 — prereregistratie
`tests/stap22-condities.js` met de condities en de voorspellingen, elk met onwaar-tak,
gecommit vóór de eerste meetrun. **Eerst drie besluiten**, uit de kalibratie:
fase B verplaatsen naar het eind (voorkeur) of eruit; de **herstartconditie** bouwen (bij
elke fasegrens een vers brein — de maat voor verlies van plasticiteit); en **Elman
vervangen** door een gelaagd net met de leerregel van de wolk, want met een schone toestand
per voorwerp valt Elman samen met het gelaagde net. Voorgestelde condities: **ang**,
**ang-vast**, **mlp120-bp**, **mlp120-pert**, **herstart**. De voorspelling over vrij tegen
bevroren vermeldt dat de kalibratie op twee veegzaden al een richting liet zien.

### Stap 22 — de afsluitende meting
Vijf condities × zestien zaden, één doorlopend leven over de vijf fasen. Per fasegrens:
de score op alle vijf de regels, hersteltijd, en de structurele maten die de kritiek
noemt — gesnoeid, bijgegroeid, nieuwe neuronen, typeveranderingen, lussen, sensorgebruik
per groep, en de organisatie-afstand tussen zaden. Holm per familie.

### Stap 23 — analyse, paper 4.0, afronding
De analyse; paper naar 4.0 met de nieuwe sectie en de afzwakkingen die de kritiek vraagt
(*"biologisch geïnspireerd"* in plaats van *"biologisch plausibel"*, geen *"ANG ontwikkelt
hersenachtige structuren"*); `DOCUMENTATIE.md`, `README.md` en de projectdocumenten bij;
en de slotparagraaf over waar dit type graaf wél en niet presteert.

---

## Wat een positief resultaat zou zijn

De kritiek is er expliciet over, en het is niet "ANG scoort hoger":

> Na een omgevingsomslag verliezen alle systemen ongeveer evenveel prestatie, maar ANG
> herstructureert zichzelf en bereikt zijn oude prestatieniveau sneller, terwijl de
> frozen topology dat niet doet.

Toegepast op deze opzet: op fase **B** hoort iedereen even snel te herstellen (alleen
herwegen), en op fase **C** en **D** hoort ANG sneller te zijn dan ANG-bevroren, mét
bewijs dat de verbindingen daadwerkelijk naar de nieuwe kanalen verhuizen. Blijft dat uit,
dan is de uitkomst dat de bevinding van stap 12 t/m 16 ook geldt wanneer de optimale
interne organisatie zélf verandert — en dat is een sterkere negatieve uitspraak dan er nu
staat, want dit is de taak die ervoor gebouwd is.

Beide takken staan hier vóór de eerste meting opgeschreven.
