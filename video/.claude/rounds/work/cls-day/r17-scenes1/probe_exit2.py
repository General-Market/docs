import numpy as np
from PIL import Image
from scipy import ndimage
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def red(a): return (a[:,:,0]>110)&(a[:,:,1]<115)&(a[:,:,2]<95)
def clusters(m, minpx=100):
    lab,n = ndimage.label(m)
    out=[]
    for i in range(1,n+1):
        ys,xs=np.nonzero(lab==i)
        if len(xs)<minpx: continue
        out.append((float(xs.mean()),float(ys.mean()),len(xs)))
    return out
base = sorted(clusters(red(load("refs/f96.png"))))
print("BASE:", [(round(x),round(y),n) for x,y,n in base])
prev={i:(x,y) for i,(x,y,n) in enumerate(base)}
print("\nfr  AFFINE residual        sim-residual   points")
for f in range(100,114):
    cl = clusters(red(load(f"refs/f{f}.png")))
    src=[];dst=[];ids=[]
    for i,(bx,by,bn) in enumerate(base):
        px,py=prev[i]
        if not cl: continue
        d=sorted([((cx-px)**2+(cy-py)**2,cx,cy,cn) for cx,cy,cn in cl])
        dd,cx,cy,cn=d[0]
        if dd**0.5>170 or cn<0.35*bn: continue
        src.append((bx,by)); dst.append((cx,cy)); ids.append(i); prev[i]=(cx,cy)
    if len(src)<3: print(f); break
    S=np.array(src); D=np.array(dst)
    A=np.hstack([S, np.ones((len(S),1))])
    M,_,_,_ = np.linalg.lstsq(A, D, rcond=None)   # 3x2
    P = A@M
    ra = np.sqrt(np.mean(np.sum((P-D)**2,axis=1)))
    # similarity
    Sc=np.array([complex(*p) for p in src]); Dc=np.array([complex(*p) for p in dst])
    a=((Dc-Dc.mean())*np.conj(Sc-Sc.mean())).sum()/(np.abs(Sc-Sc.mean())**2).sum()
    t=Dc.mean()-a*Sc.mean()
    rs=np.sqrt(np.mean(np.abs(a*Sc+t-Dc)**2))
    per = np.linalg.norm(P-D,axis=1)
    print(f"{f:3d}  aff={ra:6.2f}  sim={rs:6.2f}  n={len(src)}  per-pt={[round(v,1) for v in per]}  ids={ids}")
