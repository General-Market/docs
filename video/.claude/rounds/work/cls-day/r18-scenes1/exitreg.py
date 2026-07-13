import numpy as np, sys
from PIL import Image
TOP={668:136,670:176,671:210,672:261,673:325}
PITCH={668:158.4,670:174.4,671:188.5,672:208.8,673:235}
FRONT={668:1770,670:1434,671:1084,672:451,673:0}
for f in [668,670,671,672,673]:
    btop=TOP[f]; syp=PITCH[f]/301.5; bh=40*PITCH[f]/142.3
    r=np.asarray(Image.open(f"refs/r{f}.png").convert("RGB"),float)
    a=np.asarray(Image.open(f"new3/f{f}.png").convert("RGB"),float)
    y0,y1=max(0,int(btop-320*syp)),int(btop-2)
    x0=int(FRONT[f])+4
    def prof(im):
        sub=im[y0:y1,x0:1920]
        ink=(np.abs(sub-np.array([253,253,253])).max(2)>40)
        return ink.sum(0).astype(float), ink.sum()
    pr,nr=prof(r); pa,na=prof(a)
    best=(-1,0)
    for d in range(-120,121):
        c=np.corrcoef(pr, np.roll(pa,d))[0,1]
        if c>best[0]: best=(c,d)
    # vertical
    def vprof(im):
        sub=im[max(0,btop-330):btop-2, x0:1920]
        return ((np.abs(sub-np.array([253,253,253])).max(2)>40)).sum(1).astype(float)
    vr,va=vprof(r),vprof(a)
    bv=(-1,0)
    for d in range(-40,41):
        c=np.corrcoef(vr,np.roll(va,d))[0,1]
        if c>bv[0]: bv=(c,d)
    print(f"f{f}: above ink ref {nr:6d}  ours {na:6d} ({na/max(nr,1):.2f}x) | best x-shift {best[1]:+4d} (r={best[0]:.3f}) | best y-shift {bv[1]:+3d} (r={bv[0]:.3f})")
