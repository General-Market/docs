import numpy as np
from PIL import Image
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
SIM = {100:(1.0000,0.00),101:(1.0003,0.05),102:(1.0004,0.33),103:(1.0033,0.77),
 104:(1.0094,1.32),105:(1.0145,2.27),106:(1.0236,3.55),107:(1.0346,5.19),
 108:(1.0483,7.37),109:(1.0668,10.26),110:(1.0918,14.10),111:(1.1233,18.15),
 112:(1.1692,24.73),113:(1.2543,38.27)}
PX,PY=960.0,540.0
# card grid
cx = np.arange(-400,2321,1.0)
cy = np.arange(-300,1381,4.0)
CX,CY = np.meshgrid(cx,cy)
for f in sorted(SIM):
    a=load(f"refs/f{f}.png"); s,th=SIM[f]
    t=np.radians(th); c,sn=np.cos(t),np.sin(t)
    # card -> video : v = P + s*R*(c - P)
    dx,dy = CX-PX, CY-PY
    vx = PX + s*(c*dx - sn*dy)
    vy = PY + s*(sn*dx + c*dy)
    ix = np.rint(vx).astype(int); iy = np.rint(vy).astype(int)
    ok = (ix>=0)&(ix<1920)&(iy>=0)&(iy<1080)
    px = np.zeros(CX.shape+(3,),dtype=int)
    px[ok] = a[iy[ok],ix[ok]]
    nv = (px[:,:,2]>60)&(px[:,:,0]<80)&(px[:,:,1]<90)&ok
    wh = (px[:,:,0]>200)&(px[:,:,1]>200)&(px[:,:,2]>200)&ok
    okc = ok.sum(axis=0).astype(float)
    navyfrac = np.where(okc>0, nv.sum(axis=0)/np.maximum(okc,1), 1.0)
    whfrac  = np.where(okc>0, wh.sum(axis=0)/np.maximum(okc,1), 0.0)
    band = (navyfrac<0.02)&(whfrac>0.85)&(okc>200)
    idx=np.nonzero(band)[0]
    if len(idx)==0: print(f"f{f}: no band"); continue
    # longest contiguous run
    runs=[];st=idx[0];pv=idx[0]
    for i in idx[1:]:
        if i>pv+2: runs.append((st,pv)); st=i
        pv=i
    runs.append((st,pv))
    runs.sort(key=lambda r:-(r[1]-r[0]))
    l,r = runs[0]
    L,R = cx[l], cx[r]
    print(f"f{f}: cardBand x {L:7.1f} .. {R:7.1f}  width {R-L:6.1f}  centre {(L+R)/2:7.1f}   (runs={len(runs)})")
