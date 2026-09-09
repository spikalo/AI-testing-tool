"""Figuur bij stap 3: hoe goed wijst de ANG-update de kant van de echte gradient op?

Twee panelen, allebei leesbaar in grijswaarden (kleur én vorm dragen de identiteit):
(a) per verbinding de numerieke gradient tegen de ANG-schatter, gesplitst naar de
    herkomst van de verbinding;
(b) de cosinus als functie van het aantal pogingen, met het meetbare plafond erbij.
"""
import os, json, matplotlib
matplotlib.use("Agg")
matplotlib.rcParams["font.family"] = "STIXGeneral"
matplotlib.rcParams["mathtext.fontset"] = "stix"
import matplotlib.pyplot as plt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = json.load(open(os.path.join(ROOT, "experimenten", "gradcheck.json"), encoding="utf-8"))

# gevalideerde categorische paren (alle-paren-controle doorstaan)
BLAUW, ORANJE = "#2a78d6", "#eb6834"
INKT, DOF, RASTER = "#1a1d21", "#55606b", "#dcdfe3"

punt = R["punten"][0]
v = punt["varianten"]["nieuw"]
schaal = v["schaalfactor"]

# ruwe rijen uit de CSV van hetzelfde punt
import csv
rijen = [r for r in csv.DictReader(open(os.path.join(ROOT, "experimenten", "gradcheck.csv"), encoding="utf-8"))
         if r["punt"] == punt["punt"]]
ng = [(float(r["numGradA"]) + float(r["numGradB"])) / 2 for r in rijen]
ang = [schaal * float(r["angNieuw"]) for r in rijen]
naarKnop = [r["doel"] == "out" for r in rijen]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9.4, 3.9))
for ax in (ax1, ax2):
    ax.set_facecolor("white")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(RASTER)
    ax.tick_params(colors=DOF, labelsize=8.5, length=3)

# ---- (a) schatter tegen numerieke gradient ----
lim = max(max(abs(x) for x in ng), max(abs(x) for x in ang)) * 1.12
ax1.plot([-lim, lim], [-lim, lim], color=RASTER, lw=1.2, zorder=1)
ax1.axhline(0, color=RASTER, lw=0.8, zorder=1)
ax1.axvline(0, color=RASTER, lw=0.8, zorder=1)
for keep, kleur, vorm, naam in ((False, BLAUW, "o", "naar de wolk\n(node-perturbatie)"),
                                (True, ORANJE, "^", "naar een knop\n(exacte score-functie)")):
    xs = [g for g, k in zip(ng, naarKnop) if k == keep]
    ys = [a for a, k in zip(ang, naarKnop) if k == keep]
    ax1.scatter(xs, ys, s=26, marker=vorm, facecolor=kleur + "cc",
                edgecolor="white", linewidth=0.8, zorder=3, label=naam)
    if xs:  # directe labels in plaats van alleen een legenda
        i = max(range(len(xs)), key=lambda j: abs(xs[j]) + abs(ys[j]))
        dx, dy = (8, -18) if keep else (8, 6)
        ax1.annotate(naam, (xs[i], ys[i]), textcoords="offset points",
                     xytext=(dx, dy), fontsize=8.2, color=kleur, ha="left",
                     linespacing=1.25)
ax1.set_xlim(-lim, lim); ax1.set_ylim(-lim, lim)
ax1.set_xlabel("numerieke gradiënt  $\\partial J/\\partial w$", fontsize=9, color=INKT)
ax1.set_ylabel("ANG-update, geschaald", fontsize=9, color=INKT)
ax1.set_title(f"(a) per verbinding, één schaalfactor voor alles — cos = {v['cosinus']:.2f}",
              fontsize=9.6, color=INKT, loc="left", pad=8)

# ---- (b) cosinus tegen aantal pogingen ----
kr = v["cosinusKromme"]
xs = [k["pogingen"] for k in kr]
med = [k["cosMediaan"] for k in kr]
lo = [k["cos10"] for k in kr]
hi = [k["cos90"] for k in kr]
plafond = punt["cosinusPlafond"]
ax2.axhline(plafond, color=DOF, lw=1.1, ls=(0, (4, 3)), zorder=2)
ax2.annotate(f"meetbaar plafond {plafond:.2f}", (xs[-1], plafond), textcoords="offset points",
             xytext=(-4, -14), fontsize=8.2, color=DOF, ha="right")
ax2.axhline(0, color=RASTER, lw=0.8, zorder=1)
ax2.fill_between(xs, lo, hi, color=BLAUW + "26", zorder=2, linewidth=0)
ax2.plot(xs, med, color=BLAUW, lw=2, marker="o", markersize=5,
         markerfacecolor=BLAUW, markeredgecolor="white", markeredgewidth=0.8, zorder=4)
ax2.annotate("mediaan\n(band: 10–90 %)", (xs[-1], med[-1]), textcoords="offset points",
             xytext=(-8, -30), fontsize=8.2, color=BLAUW, ha="right")
ax2.set_xscale("log")
ax2.set_xticks(xs); ax2.set_xticklabels([str(x) for x in xs])
ax2.set_ylim(min(-0.05, min(lo) - 0.05), 1.10)
ax2.set_xlabel("pogingen waarover de update gemiddeld is", fontsize=9, color=INKT)
ax2.set_ylabel("cos(Δw$_{\\mathrm{ANG}}$, ∇J)", fontsize=9, color=INKT)
ax2.set_title("(b) hoeveel monsters zijn er nodig?", fontsize=9.6, color=INKT, loc="left", pad=8)
ax2.grid(axis="y", color=RASTER, lw=0.7)
ax2.set_axisbelow(True)

fig.tight_layout(pad=1.1)
uit = os.path.join(ROOT, "paper", "fig2-gradcheck.png")
os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
fig.savefig(uit, dpi=300, bbox_inches="tight", pad_inches=0.10, facecolor="white")
print("geschreven:", uit)

# ook een kopie in docs/, zodat de figuur in de repo te bekijken is zonder de
# generator te draaien (paper/fig*.png staat in .gitignore)
import shutil
shutil.copyfile(uit, os.path.join(ROOT, "docs", "fig2-gradcheck.png"))
print("gekopieerd naar docs/fig2-gradcheck.png")
