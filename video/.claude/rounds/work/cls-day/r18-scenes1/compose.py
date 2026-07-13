import sys, os, subprocess
import numpy as np
from PIL import Image
W=os.path.dirname(os.path.abspath(__file__))
COL={"fill":"#FDFDFD","grey":"#DCDCDC","navy":"#0B2341","red":"#CC441E","white":"#FDFDFD"}
name,band=sys.argv[1],sys.argv[2]
d=eval(open(f"{W}/trace/{name}.json").read())
bg="#FDFDFD" if band=="above" else "#0A2C55"
order=["fill","grey","navy","red"] if band=="above" else ["white","red"]
body="".join(f'<g transform="translate(0,330) scale(1,-1)" fill="{COL[k]}"><path d="{d[k]}"/></g>' for k in order if k in d)
svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="604" height="330" viewBox="0 0 604 330"><rect width="604" height="330" fill="{bg}"/>{body}</svg>'
open(f"{W}/trace/{name}_all.svg","w").write(svg)
subprocess.run(["magick","-background","none",f"{W}/trace/{name}_all.svg","-resize","604x330!",f"{W}/trace/{name}_all.png"],check=True)
a=np.asarray(Image.open(f"{W}/rect/{name}.png").convert("L"),float)
b=np.asarray(Image.open(f"{W}/trace/{name}_all.png").convert("L"),float)
ai=np.abs(a-np.median(a))>45; bi=np.abs(b-np.median(b))>45
best=(0,0,0)
for dx in range(-4,5):
    for dy in range(-4,5):
        s=(ai&np.roll(np.roll(bi,dy,0),dx,1)).sum()
        if s>best[0]: best=(s,dx,dy)
print(f"{name:>4}  ref ink {ai.sum():>6}  trace ink {bi.sum():>6} ({bi.sum()/ai.sum():.3f}x)   best overlap {best[0]/ai.sum():.3f} @ dx={best[1]} dy={best[2]}")
