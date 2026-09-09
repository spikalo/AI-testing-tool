import os, matplotlib
matplotlib.use("Agg")
matplotlib.rcParams["font.family"]="STIXGeneral"
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

fig,ax=plt.subplots(figsize=(9.6,4.4))
ax.set_xlim(-2,100); ax.set_ylim(-12,50); ax.axis("off")
COL={"in":"#2a9d8f","sens":"#3f8fd0","work":"#7a63d0","refl":"#d9534f","mem":"#d9699a","neut":"#7c8794","out":"#dd9930"}
def box(x,y,w,h,label,sub,key,fs=10.5):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle="round,pad=0.5,rounding_size=1.2",
        linewidth=1.5,edgecolor=COL[key],facecolor=COL[key]+"1e"))
    ax.text(x+w/2,y+h*0.62,label,ha="center",va="center",fontsize=fs,color="#14161a")
    if sub: ax.text(x+w/2,y+h*0.26,sub,ha="center",va="center",fontsize=7.6,color="#55606b")
    return (x,y,w,h)
def arrow(p1,p2,rad=0.0,color="#4b5560",ls="-",lw=1.25):
    ax.add_patch(FancyArrowPatch(p1,p2,connectionstyle=f"arc3,rad={rad}",
        arrowstyle="-|>,head_width=2.4,head_length=4.6",mutation_scale=1,
        linewidth=lw,color=color,linestyle=ls,shrinkA=1,shrinkB=1))

IN  = box( 0,17,15,15,"invoer-nodes","16 sensoren","in")
SENS= box(24,34,19,12,"invoer-neuronen","in: alleen invoer-nodes","sens")
WORK= box(24,18,19,12,"worker-neuronen","meerderheid; alles mag","work")
MEM = box(24, 2,19,12,"geheugen-neuronen","altijd lus naar zichzelf","mem")
REFL= box(52,34,19,12,"reflex-neuronen","in: alleen invoer-neuronen","refl")
NEUT= box(52, 2,19,12,"neutrale neuronen","nog geen soort","neut")
OUT = box(83,17,15,15,"uitvoer-nodes","4 knoppen","out")
R=lambda b:(b[0]+b[2],b[1]+b[3]/2); L=lambda b:(b[0],b[1]+b[3]/2)

arrow(R(IN),L(SENS),0.12); arrow(R(IN),L(WORK)); arrow(R(IN),L(MEM),-0.12)
arrow(R(SENS),L(REFL))
arrow((SENS[0]+7,SENS[1]),(WORK[0]+7,WORK[1]+WORK[3]))
arrow(R(REFL),(OUT[0],OUT[1]+OUT[3]*0.88),-0.10)
arrow(R(WORK),(OUT[0],OUT[1]+OUT[3]*0.55))
arrow((MEM[0]+MEM[2]-3,MEM[1]),(OUT[0]+2,OUT[1]),-0.30)
arrow((WORK[0]+13,WORK[1]),(MEM[0]+13,MEM[1]+MEM[3]),0.0)
arrow((MEM[0]+16,MEM[1]+MEM[3]),(WORK[0]+16,WORK[1]),0.0)
arrow((NEUT[0]+4,NEUT[1]+NEUT[3]),(WORK[0]+WORK[2]-2,WORK[1]),0.22,ls=(0,(3,2)))
arrow((WORK[0]+WORK[2],WORK[1]+3),(NEUT[0]+9,NEUT[1]+NEUT[3]),-0.22,ls=(0,(3,2)))
arrow(R(NEUT),(OUT[0],OUT[1]+OUT[3]*0.10),0.10,ls=(0,(3,2)))
# zelflus geheugen
ax.add_patch(FancyArrowPatch((MEM[0]+2.5,MEM[1]),(MEM[0]+7.5,MEM[1]),
    connectionstyle="arc3,rad=1.5",arrowstyle="-|>,head_width=2.2,head_length=4",
    linewidth=1.4,color=COL["mem"]))
ax.text(MEM[0]+5,MEM[1]-8.2,"zelflus",ha="center",fontsize=7.6,color=COL["mem"])
ax.text(63,-5.0,"tijdelijk: krijgt bij de eerstvolgende ronde een soort toegewezen",
        ha="center",fontsize=7.4,color="#7c8794",style="italic")
fig.savefig(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),"paper","fig1-typen.png"),dpi=300,bbox_inches="tight",pad_inches=0.10,facecolor="white")
print("ok")
