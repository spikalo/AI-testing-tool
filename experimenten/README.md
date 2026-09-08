# Meetreeksen van de Basic Brain Test (ANG)

## `runs.csv`

Eén regel per run, 52 kolommen. Dit is de bron waaruit de tabellen in het ANG-paper
worden opgebouwd — niet met de hand overgetypt, maar bij elke hergeneratie opnieuw uit
dit bestand gelezen (`paper/paper.js`).

De kolommen vallen in vier groepen:

| groep | kolommen |
|---|---|
| identiteit | `tijdstip, conditie, brein, breinZaad, wereldZaad, pogingen` |
| instellingen | `neuronenStart, dichtheid, lr, lam, decay, wmax, stepMax, memLeak, prop, noise0, lrAnneal, structOn, structEvery, pruneT, sprout, growOn, retypeOn, inputOnlySens, obstakels, maxSteps, worldEvery, toetsModus` en de soortverdeling `sens, work, refl, mem, neut` |
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
