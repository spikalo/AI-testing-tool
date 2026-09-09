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

## Drie valkuilen die al een keer geld hebben gekost

- Een tabelcel moet een **string** krijgen. Geef je er een `TextRun` aan, dan blijft de
  cel leeg zonder foutmelding.
- Elke `spacing.line` heeft `lineRule: LineRuleType.AUTO` nodig. Zonder dat wordt de
  regelhoogte als exacte hoogte opgevat en worden afbeeldingen afgeknipt.
- **Geef nooit een array door waar één alinea verwacht wordt.** `figure()` levert twee
  alinea's op (de afbeelding en het onderschrift), dus het moet
  `figure(...).forEach(x => C.push(x))` zijn en niet `C.push(figure(...))`. Doe je het
  laatste, dan schrijft `docx` zwijgend `<0/>` in `word/document.xml`, is het XML niet
  meer welgevormd, en **weigert Word het bestand te openen** — zonder dat de generator
  klaagt. Dat is precies wat er op 9 september 2026 met versie 1.2 gebeurde.
  `paper.js` keurt het document nu vóór het wegschrijven met `keur-docx.py`; is één
  onderdeel niet welgevormd, dan stopt de generator met een foutmelding in plaats van
  een kapot bestand op te leveren.

## PDF ernaast

```bash
soffice --headless --convert-to pdf --outdir . ANG-paper.docx
```

Handig om snel te controleren dat het document werkelijk rendert, en om het op een
telefoon te kunnen lezen. Ook de PDF blijft buiten git (`ANG-paper*.pdf`).

## Versie

De voettekst draagt het versienummer. Verhoog het als de inhoud wezenlijk verandert:
1.0 = alleen het systeem, 1.1 = met referentiemeting en reproduceerbaarheid,
1.15 = met het eligibility-herstel en de voor/na-meting,
1.2 = met de numerieke gradiëntcontrole (sectie 3.11 en figuur 2).
