import sys, numpy as np
from PIL import Image
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def band(a):
    r,g,b=a[...,0],a[...,1],a[...,2]; lum=(r+g+b)/3
    grey=(abs(r-g)<14)&(abs(g-b)<14)&(lum>185)&(lum<225)
    idx=np.where(grey.sum(axis=1)>1500)[0]
    return idx[0], idx[-1]
def whiterow(a, t1):
    # white ink on navy, per row, below band
    sub=a[t1+4:1080]
    lum=sub.mean(axis=2)
    navyish = (sub[...,2] > sub[...,0]+15)
    w = (lum>150).sum(axis=1)
    return w
def redrow(a, y0, y1):
    sub=a[y0:y1]
    r,g,b=sub[...,0],sub[...,1],sub[...,2]
    red=(r>150)&(r>g+50)&(r>b+40)
    return red.sum(axis=1)
for f in [675,677,680,684,690,700]:
    for tag in ("refs","head"):
        try: a=load(f"{W}/{tag}/f{f}.png")
        except: continue
        t0,t1=band(a)
        w=whiterow(a,t1)
        # label band: find the contiguous rows with a local bump far below the tick feet
        # tick feet: last row where white count high; label row = bump after a gap
        nz=np.where(w>40)[0]
        # find last cluster (labels sit below the tick feet)
        print(f"f{f} {tag:4s} band={t0}-{t1} whitecols>40 rows(rel to band bot): first={nz[0] if len(nz) else '-'} last={nz[-1] if len(nz) else '-'}  peakrow={int(np.argmax(w))} peak={int(w.max())}")
        # print profile coarse
        prof=[int(w[i]) for i in range(0, min(400,len(w)), 20)]
        print("      prof/20:", prof)
