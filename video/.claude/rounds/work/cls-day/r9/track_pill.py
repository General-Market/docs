import numpy as np
from PIL import Image
import os
D=os.path.dirname(os.path.abspath(__file__));PR=f"{D}/panref"
def rgb(f): return np.asarray(Image.open(f"{PR}/f{f}.png").convert("RGB"),dtype=np.float64)
def pill_center(f):
    """filled navy CLS pill = large SOLID dark-navy blob. centroid of navy fill."""
    im=rgb(f);R,G,B=im[:,:,0],im[:,:,1],im[:,:,2]
    navy=(R<55)&(G<70)&(B>70)&(B<135)
    # densest columns/rows = the solid pill (ignore thin outlines)
    ys,xs=np.where(navy)
    if len(xs)<200: return None,None,len(xs)
    # pill is the solid fill: take median of navy pixels weighted toward the blob
    # use the mode region: histogram peak
    cx=int(np.median(xs)); cy=int(np.median(ys))
    return cx,cy,len(xs)
print("body pill center (f3300):", pill_center(3300))
print("f: pillcx pillcy npx  -> worldDX(=cx-967) worldDY(=cy-530)")
for f in range(3380,3393):
    cx,cy,n=pill_center(f)
    if cx is None: print(f,"gone",n); continue
    print(f, cx, cy, n, " dx=",cx-967," dy=",cy-530)
