# ANG-paper — generator

Het paper (`ANG-paper.docx`, niet in git) wordt niet met de hand bijgehouden maar
gegenereerd. Dat is met opzet: de resultatensectie leest `experimenten/runs.csv` en bouwt
zijn tabellen daaruit op, zodat een getal in het document nooit kan afwijken van wat er
gemeten is.

## Regenereren

```bash
npm install docx            # eenmalig
python3 mkeq.py             # formules -> eq/*.png + eq/manifest.json
python3 mkfig.py            # figuur met de typeregels
node paper.js               # schrijft ANG-paper.docx
```

`mkeq.py` heeft matplotlib nodig en zet de formules met de STIX-fonts op 320 dpi. De
gerenderde PNG's staan niet in git — ze zijn met één commando terug te maken.

## Waarom geen OMML

Word-vergelijkingen (OMML) renderen niet in LibreOffice, en het document moet ook daar
leesbaar zijn. Vandaar afbeeldingen.

## Twee valkuilen die al een keer geld hebben gekost

- Een tabelcel moet een **string** krijgen. Geef je er een `TextRun` aan, dan blijft de
  cel leeg zonder foutmelding.
- Elke `spacing.line` heeft `lineRule: LineRuleType.AUTO` nodig. Zonder dat wordt de
  regelhoogte als exacte hoogte opgevat en worden afbeeldingen afgeknipt.

## Versie

De voettekst draagt het versienummer. Verhoog het als de inhoud wezenlijk verandert:
1.0 = alleen het systeem, 1.1 = met referentiemeting en reproduceerbaarheid.
