# Meetreeksen van de Basic Brain Test (ANG)

## `runs.csv`

Eén regel per run, 53 kolommen. Dit is de bron waaruit de tabellen in het ANG-paper
worden opgebouwd — niet met de hand overgetypt, maar bij elke hergeneratie opnieuw uit
dit bestand gelezen (`paper/paper.js`).

De kolommen vallen in vier groepen:

| groep | kolommen |
|---|---|
| identiteit | `tijdstip, conditie, brein, breinZaad, wereldZaad, pogingen` |
| instellingen | `neuronenStart, dichtheid, lr, lam, decay, wmax, stepMax, memLeak, prop, noise0, lrAnneal, traceOud, structOn, structEvery, pruneT, sprout, growOn, retypeOn, inputOnlySens, obstakels, maxSteps, worldEvery, toetsModus` en de soortverdeling `sens, work, refl, mem, neut` |
| prestatie | `succesPct, succes20, toetsPct, gemStappenBijSucces, botsingenPerPoging, rekentijdMs` |
| structuur | `neuronenEind, verbindingen, actieveVerbindingen, gemAbsW, kortstePad, reflexbogen, lussen, meedoendeNeuronen, losgeraakt, gesnoeid, bijgegroeid, nieuweNeuronen, typeVeranderingen` |

Nieuwe reeksen worden aangevuld, niet overschreven. Wijzigen de kolommen ooit, dan
schrijft de pagina naar een nieuw bestand `runs-<datum>.csv` in plaats van de bestaande
tabel te bederven.

## `reproduceerbaarheid.json`

De controle die de rest pas betekenis geeft: dezelfde twee zaden twee keer achter elkaar
gedraaid, waarna de volledige leercurve, alle tussentijdse toetsen, alle structuurmaten
én het volledige eindnetwerk bit voor bit vergeleken worden. Zolang `identiek` overal
`true` is, is elke meting in `runs.csv` na te rekenen.

## `trace-voor-na.json`

De voor/na-meting van werkplan-stap 2: twaalf breinzaden per conditie met de foutieve
postsynaptische eligibility-trace (`trace-oud`) en met de juiste presynaptische term
(`trace-nieuw`), verder identieke instellingen en dezelfde wereldzaden. Per maat het
gemiddelde met 95 %-interval, het gepaarde verschil per zaad, en een Mann-Whitney
U-toets met de uitkomst in gewone taal. Het paper leest dit bestand rechtstreeks;
ontbreekt het, dan zegt sectie 3.5 dat de meting nog moet gebeuren in plaats van een
getal te noemen.

De kolom `traceOud` in `runs.csv` zegt van elke run met welke van de twee leerregels
hij gedraaid heeft. Alle runs van vóór 9 september 2026 staan op `1`.

Draaien met `node tests/exp-stap2.js`; de controle die het herstel bewijst is
`node tests/test-stap2.js`.

## `gradcheck.csv`, `gradcheck.json` en `gradcheck-delen.json`

De numerieke controle van de leerregel (werkplan stap 3). Op een miniatuur-ANG met vier
verborgen knopen en een bevroren topologie wordt per gewicht een centrale differentie
`(J(w+ε) − J(w−ε)) / 2ε` bepaald en vergeleken met de gemiddelde ANG-update.

- **`gradcheck.csv`** — één regel per verbinding per meetpunt: het gewicht, de twee
  onafhankelijk berekende helften van de numerieke gradiënt, en de gemiddelde ANG-update
  met de nieuwe én de oude traceregel. De kolommen `bron` en `doel` geven de soort van
  de knopen aan de uiteinden; op dat onderscheid draait de hele analyse.
- **`gradcheck.json`** — de opzet, de cosinuskrommen, de schaalfactoren, de
  helft-tegen-helft-betrouwbaarheid en de ε-reeks.
- **`gradcheck-delen.json`** — de nabewerking die het paper leest: per meetpunt de
  cosinus en de schaalfactor voor het score-functiedeel (verbindingen naar een knop) en
  voor het node-perturbatiedeel (verbindingen naar de wolk), apart.

Draaien: `node tests/gradcheck-stap3.js` (ongeveer twintig minuten), daarna
`python3 tests/gradcheck-analyse.py`. De figuur komt uit `python3 paper/mkfig-grad.py`.

## `perturbatie-schaal.json` en `perturbatie-schaal-lr.json`

Wat de gevonden schaalfout waard is op het volledige brein: het node-perturbatiedeel van
het spoor met een factor `g` versterkt, 8 zaden per waarde. Eén keer met de leersnelheid
ongewijzigd, één keer met de leersnelheid meegeschaald als 1/g. Beide reeksen worden
slechter dan `g = 1`; de leerregel is als geheel op de bestaande verhouding afgesteld.
Dit is een vooruitblik op stap 7 en bewust níét in `runs.csv` opgenomen — de volledige
ablatie, met η per conditie opnieuw afgesteld, komt daar wel in.
Draaien: `node tests/exp-perturbgain.js`, en `LRDEEL=1 node tests/exp-perturbgain.js`.

## `runs/` — niet in git

De volledige resultaatbestanden per run (elk ongeveer 325 kB: alle instellingen, de
geschiedenis per poging, alle toetsen, het logboek van herstructureringen en het
volledige eindnetwerk). Die worden bewust niet meegecommit: ze zijn groot, en ze zijn uit
`breinZaad` + `wereldZaad` exact te reproduceren. Nodig heb je ze alleen om een netwerk te
hertekenen of een brein terug te laden zonder opnieuw te trainen.

## Zelf een reeks draaien

Open `brein-test.html`, ga naar het paneel **Experimentloper**, kies de map
`experimenten` en druk op *draai reeks*. Of headless, vanuit deze map:

```bash
node tests/exp-stap1.js
```
