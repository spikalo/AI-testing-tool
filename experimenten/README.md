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
