import numpy as np, sys
from PIL import Image
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def navyink(a): return (a[:,:,2]>70)&(a[:,:,0]<90)&(a[:,:,1]<95)
def redink(a): return (a[:,:,0]>140)&(a[:,:,1]<115)&(a[:,:,2]<95)
def greyink(a):
    g=a.mean(axis=2)
    return (g>190)&(g<235)&(np.abs(a[:,:,0]-a[:,:,2])<14)
def ticks(p):
    a=load(p); m=navyink(a)
    col=m[180:420,:].sum(axis=0)     # well above the band, only tick lines live here
    idx=np.nonzero(col>150)[0]
    runs=[];  
    if len(idx)==0: return []
    st=idx[0];pv=idx[0]
    for i in idx[1:]:
        if i>pv+4: runs.append((st+pv)/2); st=i
        pv=i
    runs.append((st+pv)/2)
    return [round(r,1) for r in runs]
for f in [880,890,900,910,920]:
    r=ticks(f"refs5/f{f}.png"); o=ticks(f"att5/f{f}.png")
    print(f"f{f} REF ticks {r}")
    print(f"     OUR ticks {o}")
    a=load(f"refs5/f{f}.png"); b=load(f"att5/f{f}.png")
    for nm,fn in [("navy",navyink),("red",redink),("grey",greyink)]:
        print(f"     {nm}: ref {int(fn(a).sum()):7d}  ours {int(fn(b).sum()):7d}")
