"""Nabewerking van experimenten/gradcheck.csv (werkplan stap 3).

De update valt uiteen in twee delen met een verschillende afleiding:
verbindingen naar een uitvoerknoop dragen de exacte score-functie (a − p),
verbindingen naar de wolk dragen node-perturbatie. Dit script berekent per deel
de cosinus met de numerieke gradiënt, de kleinste-kwadraten-schaalfactor c uit
c·Δw ≈ ∇J, en het aandeel dat elk deel in de lengte van beide vectoren heeft.
Verschillen die schaalfactoren sterk, dan wijst elk deel apart wel de goede kant
op maar staan de twee delen niet op dezelfde schaal — en dat is precies wat er
aan de hand blijkt te zijn.

Draaien vanuit de projectmap:  python3 tests/gradcheck-analyse.py
"""
import os, csv, json, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXP = os.path.join(ROOT, "experimenten")

dot = lambda a, b: sum(x * y for x, y in zip(a, b))
nrm = lambda a: math.sqrt(dot(a, a))


def cos(a, b):
    d = nrm(a) * nrm(b)
    return dot(a, b) / d if d else 0.0


rows = list(csv.DictReader(open(os.path.join(EXP, "gradcheck.csv"), encoding="utf-8")))
uit = {
    "beschrijving": __doc__.strip().split("\n\nDraaien")[0],
    "punten": [],
}
for punt in dict.fromkeys(r["punt"] for r in rows):
    R = [r for r in rows if r["punt"] == punt]
    A = [float(r["numGradA"]) for r in R]
    B = [float(r["numGradB"]) for r in R]
    G = [(a + b) / 2 for a, b in zip(A, B)]
    E = [float(r["angNieuw"]) for r in R]
    O = [float(r["angOud"]) for r in R]
    grp = ["knop" if r["doel"] == "out" else "wolk" for r in R]

    d = {"punt": punt, "cosTotaal": cos(E, G), "splitHalfNumGrad": cos(A, B),
         "verschilOudNieuw": nrm([x - y for x, y in zip(E, O)]) / nrm(E), "delen": {}}
    print(f"\n{punt}: cos totaal {d['cosTotaal']:.3f}, split-half ∇J {d['splitHalfNumGrad']:.3f}, "
          f"oud vs nieuw {100*d['verschilOudNieuw']:.1f} %")
    for g in ("knop", "wolk"):
        idx = [i for i, x in enumerate(grp) if x == g]
        a, b = [A[i] for i in idx], [B[i] for i in idx]
        gg, ee = [G[i] for i in idx], [E[i] for i in idx]
        sc = dot(ee, gg) / dot(ee, ee) if dot(ee, ee) else float("nan")
        d["delen"][g] = dict(n=len(idx), splitHalf=cos(a, b), cos=cos(ee, gg), schaal=sc,
                             aandeelNormGrad=nrm(gg) / nrm(G), aandeelNormSchatter=nrm(ee) / nrm(E))
        print(f"  naar {g:5s} n={len(idx):3d}  split-half {cos(a,b):6.3f}  cos {cos(ee,gg):6.3f}  "
              f"schaal {sc:9.2f}  |∇J|-aandeel {nrm(gg)/nrm(G):.2f}  |Δw|-aandeel {nrm(ee)/nrm(E):.2f}")
    E2 = [E[i] * d["delen"][grp[i]]["schaal"] for i in range(len(E))]
    d["cosNaDeelherschaling"] = cos(E2, G)
    d["schaalverhoudingWolkOverKnop"] = d["delen"]["wolk"]["schaal"] / d["delen"]["knop"]["schaal"]
    print(f"  → cos na herschaling per deel: {d['cosNaDeelherschaling']:.3f}   "
          f"verhouding wolk/knop = {d['schaalverhoudingWolkOverKnop']:.0f}×")
    uit["punten"].append(d)

pad = os.path.join(EXP, "gradcheck-delen.json")
json.dump(uit, open(pad, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print("\ngeschreven:", pad)
