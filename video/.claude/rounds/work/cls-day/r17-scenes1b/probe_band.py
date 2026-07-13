import sys, numpy as np
from PIL import Image
# per-frame: grey band top/bottom at columns; white/navy/grey global counts
def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(int)
def stats(a):
    r,g,b = a[...,0],a[...,1],a[...,2]
    lum = (r+g+b)/3
    grey = (abs(r-g)<14)&(abs(g-b)<14)&(lum>185)&(lum<225)
    white = lum>235
    navy = (b>r+20)&(lum<110)
    return grey, white, navy, lum
def band_rows(grey, x):
    col = grey[:, x]
    idx = np.where(col)[0]
    if len(idx)==0: return None
    # longest run
    runs=[]; s=idx[0]; p=idx[0]
    for i in idx[1:]:
        if i==p+1: p=i
        else: runs.append((s,p)); s=i; p=i
    runs.append((s,p))
    runs.sort(key=lambda t:t[1]-t[0])
    return runs[-1]
for f in range(int(sys.argv[1]), int(sys.argv[2])+1):
    try: a = load(f"{sys.argv[3]}/f{f}.png")
    except: continue
    g,w,n,lum = stats(a)
    br = [band_rows(g,x) for x in (100, 480, 960, 1440, 1850)]
    bs = " ".join("--" if r is None else f"{r[0]}-{r[1]}" for r in br)
    print(f"f{f} white={w.sum():7d} navy={n.sum():7d} grey={g.sum():6d} | band@x100/480/960/1440/1850: {bs}")
