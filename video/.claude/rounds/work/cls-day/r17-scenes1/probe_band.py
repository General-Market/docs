import numpy as np
from PIL import Image
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def navy(a):  # navy background (not white, not ink)
    return (a[:,:,2]>60)&(a[:,:,0]<80)&(a[:,:,1]<90)
SIM = {100:(1.0000,0.00),101:(1.0003,0.05),102:(1.0004,0.33),103:(1.0033,0.77),
 104:(1.0094,1.32),105:(1.0145,2.27),106:(1.0236,3.55),107:(1.0346,5.19),
 108:(1.0483,7.37),109:(1.0668,10.26),110:(1.0918,14.10),111:(1.1233,18.15),
 112:(1.1692,24.73),113:(1.2543,38.27)}
PX,PY=960.0,540.0
def to_card(x,y,s,th):
    t=np.radians(th); c,sn=np.cos(t),np.sin(t)
    dx,dy=(x-PX)/s,(y-PY)/s
    return PX + c*dx + sn*dy, PY - sn*dx + c*dy
for f in sorted(SIM):
    a=load(f"refs/f{f}.png"); nv=navy(a)
    s,th=SIM[f]
    pts=[]
    for y in range(40,1080,80):
        row=nv[y]
        idx=np.nonzero(row)[0]
        if len(idx)==0: pts.append((y,None,None)); continue
        # find the LARGEST internal gap in navy = the band
        gaps=[]; 
        d=np.diff(idx)
        for i in np.nonzero(d>3)[0]:
            gaps.append((d[i], idx[i]+1, idx[i+1]-1))
        if not gaps: pts.append((y,None,None)); continue
        gaps.sort(reverse=True)
        g,l,r=gaps[0]
        pts.append((y,l,r))
    # convert edges to card space, fit lines
    L=[];R=[]
    for y,l,r in pts:
        if l is None: continue
        cx,cy=to_card(l,y,s,th); L.append((cy,cx))
        cx,cy=to_card(r,y,s,th); R.append((cy,cx))
    def fit(P):
        if len(P)<3: return None
        Y=np.array([p[0] for p in P]); X=np.array([p[1] for p in P])
        m,b=np.polyfit(Y,X,1)
        res=np.abs(np.polyval([m,b],Y)-X)
        return m,b,res.max()
    fl,fr=fit(L),fit(R)
    if fl and fr:
        # card-space x at card y=540
        xl=fl[0]*540+fl[1]; xr=fr[0]*540+fr[1]
        print(f"f{f}: cardL={xl:7.1f} cardR={xr:7.1f} width={xr-xl:6.1f} centre={(xl+xr)/2:7.1f}  slopeL={fl[0]:+.4f} slopeR={fr[0]:+.4f} maxres={max(fl[2],fr[2]):.1f}")
    else:
        print(f"f{f}: (insufficient) L={len(L)} R={len(R)}")
