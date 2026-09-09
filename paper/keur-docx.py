"""Keurt een .docx: is elk XML-onderdeel welgevormd?

Word weigert een bestand te openen zodra één onderdeel dat niet is. Dat gebeurt
gemakkelijker dan je denkt: geef je de docx-bibliotheek een array alinea's waar
één alinea verwacht wordt, dan schrijft zij daar zwijgend "<0/>" voor weg.

Gebruik:  python3 keur-docx.py <bestand.docx>
Geeft niets terug bij goedkeuring, en exit-code 1 met de fouten erbij als er iets mis is.
"""
import sys, zipfile, xml.dom.minidom as minidom

pad = sys.argv[1]
z = zipfile.ZipFile(pad)
kapot = z.testzip()
fouten = [] if kapot is None else ["zip-onderdeel beschadigd: " + kapot]
for naam in z.namelist():
    if naam.endswith(".xml") or naam.endswith(".rels"):
        try:
            minidom.parseString(z.read(naam))
        except Exception as e:
            fouten.append(f"{naam}: {e}")
if fouten:
    for f in fouten:
        print(f, file=sys.stderr)
    print('let op: een "<0/>" in document.xml betekent bijna altijd een array waar '
          'één alinea werd verwacht — gebruik .forEach(x => C.push(x))', file=sys.stderr)
    sys.exit(1)
