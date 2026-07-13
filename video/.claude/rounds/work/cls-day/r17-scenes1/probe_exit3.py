import numpy as np
from PIL import Image
from scipy import ndimage
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def red(a): return (a[:,:,0]>110)&(a[:,:,1]<115)&(a[:,:,2]<95)
def clusters(m, minpx=90):
    lab,n=ndimage.label(m); out=[]
    for i in range(1,n+1):
        ys,xs=np.nonzero(lab==i)
        if len(xs)<minpx: continue
        out.append((float(xs.mean()),float(ys.mean()),len(xs)))
    return out
base=sorted(clusters(red(load("refs/f96.png"))))
prev={i:(x,y) for i,(x,y,n) in enumerate(base)}
print("fr    s      deg    pivotX  pivotY   rms  n")
rows=[]
for f in range(100,114):
    cl=clusters(red(load(f"refs/f{f}.png")))
    src=[];dst=[]
    for i,(bx,by,bn) in enumerate(base):
        px,py=prev[i]
        if not cl: continue
        d=sorted([((cx-px)**2+(cy-py)**2,cx,cy,cn) for cx,cy,cn in cl])
        dd,cx,cy,cn=d[0]
        if dd**0.5>170: continue
        prev[i]=(cx,cy)
        # occlusion filter: the blade eats ink -> reject shrunken clusters
        if cn < 0.80*bn or cn > 1.45*bn: continue
        src.append((bx,by)); dst.append((cx,cy))
    if len(src)<2: print(f"{f:3d}  -- only {len(src)}"); continue
    S=np.array([complex(*p) for p in src]); D=np.array([complex(*p) for p in dst])
    a=((D-D.mean())*np.conj(S-S.mean())).sum()/(np.abs(S-S.mean())**2).sum()
    t=D.mean()-a*S.mean()
    rms=np.sqrt(np.mean(np.abs(a*S+t-D)**2))
    s=abs(a); th=np.degrees(np.angle(a))
    piv=t/(1-a) if abs(1-a)>1e-5 else complex(np.nan,np.nan)
    print(f"{f:3d} {s:6.4f} {th:7.3f} {piv.real:8.1f} {piv.imag:7.1f}  {rms:5.2f} {len(src)}")
    rows.append((f,s,th,t.real,t.imag))
print("\nLUT (frame, s, deg, tx, ty):")
for f,s,th,tx,ty in rows: print(f"  [{f}, {s:.4f}, {th:.2f}, {tx:.1f}, {ty:.1f}],")
