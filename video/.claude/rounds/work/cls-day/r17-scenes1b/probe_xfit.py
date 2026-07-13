import sys, numpy as np
from PIL import Image
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def bandtop(a):
    r,g,b=a[...,0],a[...,1],a[...,2]; lum=(r+g+b)/3
    grey=(abs(r-g)<14)&(abs(g-b)<14)&(lum>185)&(lum<225)
    idx=np.where(grey.sum(axis=1)>1500)[0]
    return (idx[0], idx[-1]) if len(idx) else (None,None)
def prof(a, y0, y1, mode):
    sub=a[y0:y1]
    r,g,b=sub[...,0],sub[...,1],sub[...,2]; lum=(r+g+b)/3
    if mode=="above": ink = lum<170          # any dark ink on white
    else: ink = lum>150                       # white ink on navy
    return ink.sum(axis=0).astype(float)
def fit(pr, po, scales, shifts):
    best=None
    x=np.arange(1920)
    for s in scales:
        # warp ours: sample ours at 960+(x-960)/s ... instead warp ref? we compare directly with shift
        for d in shifts:
            xi = np.clip(np.round(960+(x-960)/s + d).astype(int),0,1919)
            v = np.dot(pr, po[xi])
            n = np.linalg.norm(pr)*np.linalg.norm(po[xi])+1e-9
            c=v/n
            if best is None or c>best[0]: best=(c,s,d)
    return best
W=sys.argv[1]
for f in range(673, 693):
    try:
        a=load(f"{W}/refs/f{f}.png"); b=load(f"{W}/head/f{f}.png")
    except: continue
    t0,t1=bandtop(a)
    ao=prof(a, max(0,t0-160), t0-4, "above"); bo=prof(b, max(0,t0-160), t0-4, "above")
    ab=prof(a, t1+6, min(1079,t1+200), "below"); bb=prof(b, t1+6, min(1079,t1+200), "below")
    ca=fit(ao,bo,[1.0],range(-260,261,1))
    cb=fit(ab,bb,[1.0],range(-260,261,1))
    print(f"f{f} above: corr={ca[0]:.3f} dx={ca[2]:+4d} | below: corr={cb[0]:.3f} dx={cb[2]:+4d}")
