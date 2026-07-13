import sys, numpy as np
from PIL import Image
# vertical navy tick lines above the band: scan a horizontal row a few px above band top
def bandtop(a):
    r,g,b = a[...,0],a[...,1],a[...,2]
    lum=(r+g+b)/3
    grey=(abs(r-g)<14)&(abs(g-b)<14)&(lum>185)&(lum<225)
    rows = grey.sum(axis=1)
    idx=np.where(rows>1500)[0]
    return idx[0] if len(idx) else None
def ticks(a, y):
    row = a[y]
    lum = row.mean(axis=1)
    dark = lum < 90
    xs=[]; run=[]
    for x,d in enumerate(dark):
        if d: run.append(x)
        else:
            if run: xs.append(sum(run)/len(run)); run=[]
    if run: xs.append(sum(run)/len(run))
    return xs
d=sys.argv[3]
for f in range(int(sys.argv[1]), int(sys.argv[2])+1):
    try: a=np.asarray(Image.open(f"{d}/f{f}.png").convert("RGB")).astype(int)
    except: continue
    bt=bandtop(a)
    if bt is None: print(f, "no band"); continue
    y = bt-8
    xs = ticks(a,y)
    # keep only long runs (tick lines) - re-detect with vertical extent check
    keep=[]
    for x in xs:
        xi=int(round(x))
        col = a[max(0,bt-60):bt-2, max(0,xi-1):xi+2].mean(axis=(1,2))
        if (col<90).mean()>0.9: keep.append(round(x,1))
    ps = [round(keep[i+1]-keep[i],1) for i in range(len(keep)-1)]
    print(f"f{f} bt={bt} ticks={keep} pitch={ps}")
