#!/usr/bin/env python3
"""Entry (f3200-3232) red-tick anchor + exit whole-world transform.
Exit: pill (large navy filled rounded rect) bbox per frame -> center (translate)
and width (scale). Diagram is static in body so pill bbox is the world datum."""
import numpy as np
from PIL import Image
import os
D = os.path.dirname(os.path.abspath(__file__)); PR = f"{D}/panref"

def rgb(f): return np.asarray(Image.open(f"{PR}/f{f}.png").convert("RGB"), dtype=np.float64)

def red_cols(f, y0, y1, frac=0.4):
    im = rgb(f)[y0:y1, :]; R,G,B = im[:,:,0],im[:,:,1],im[:,:,2]
    red = (R>140)&(G<130)&(B<100); cc = red.sum(axis=0)
    xs=[]; x=0; n=len(cc)
    while x<n:
        if cc[x]>=(y1-y0)*frac:
            j=x
            while j<n and cc[j]>=(y1-y0)*0.2: j+=1
            xs.append((x+j-1)//2); x=j
        else: x+=1
    return xs

def navy_pill_bbox(f):
    """large navy filled region = CLS pill. navy ~ (0..40,30..70,80..120)."""
    im = rgb(f); R,G,B = im[:,:,0],im[:,:,1],im[:,:,2]
    navy = (R<70)&(G<90)&(B>60)&(B<150)&(B>R+30)
    # restrict to pill band y 450..680 (body) — but in exit pill moves up; widen
    navy[:380,:]=False; navy[720:,:]=False
    ys,xs = np.where(navy)
    if len(xs)<50: return None
    # pill is the widest solid navy run; take the biggest connected-ish blob by column density
    colden = navy[380:720,:].sum(axis=0)
    cols = np.where(colden> (720-380)*0.15)[0]
    if len(cols)<10: return None
    x0,x1 = cols.min(), cols.max()
    sub = navy[380:720, x0:x1+1]; rys = np.where(sub.any(axis=1))[0]
    y0,y1 = rys.min()+380, rys.max()+380
    return x0,x1,y0,y1,(x0+x1)/2,(y0+y1)/2,(x1-x0)

print("== ENTRY red ticks (07:00 is 2nd col) y100..250 ==")
for f in range(3200,3234,2):
    print(f, red_cols(f,100,250))
print("\n== EXIT pill bbox: f, x0,x1,y0,y1, cx,cy, width ==")
for f in range(3374,3394):
    b = navy_pill_bbox(f)
    print(f, b if b else "-")
