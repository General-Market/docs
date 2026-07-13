import sys
from PIL import Image
import numpy as np
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def wm(a): return (a[:,:,0]>150)&(a[:,:,1]>150)&(a[:,:,2]>150)
def colprof(m,x0,x1,y0,y1):
    sub=m[y0:y1,x0:x1]
    cols=sub.sum(axis=0)
    return cols
def bbox(m,x0,x1,y0,y1):
    sub=m[y0:y1,x0:x1]; ys,xs=np.nonzero(sub)
    if len(xs)==0: return None
    return (x0+int(xs.min()),x0+int(xs.max()),y0+int(ys.min()),y0+int(ys.max()),int(len(xs)))
for p in sys.argv[1:]:
    a=load(p); m=wm(a); print("==",p)
    # full lockup band y150..410
    cols = colprof(m,300,1700,150,410)
    nz = np.nonzero(cols)[0]
    # find the gap between mark and letters: longest run of zeros inside
    runs=[];s=None
    for i in range(len(cols)):
        if cols[i]==0:
            if s is None: s=i
        else:
            if s is not None: runs.append((s,i-1)); s=None
    inner=[r for r in runs if r[0]>nz.min() and r[1]<nz.max()]
    inner.sort(key=lambda r:-(r[1]-r[0]))
    gap = inner[0] if inner else None
    print("  lockup x", 300+int(nz.min()), "..", 300+int(nz.max()))
    if gap: print("  biggest gap x", 300+gap[0], "..", 300+gap[1], f"(w{gap[1]-gap[0]+1})")
    if gap:
        cut = 300+gap[0]
        print("  mark   ", bbox(m,300,cut,150,410))
        print("  letters", bbox(m,cut,1700,150,410))
    print("  tagline", bbox(m,300,1700,412,510))
    # tagline row profile
    sub=m[412:510,300:1700]; rows=sub.sum(axis=1)
    nzr=np.nonzero(rows)[0]
    print("   tagline rows", 412+int(nzr.min()), "..", 412+int(nzr.max()))
