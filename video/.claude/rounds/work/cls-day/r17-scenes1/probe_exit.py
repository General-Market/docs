import numpy as np
from PIL import Image
from scipy import ndimage

def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def red(a): return (a[:,:,0]>110)&(a[:,:,1]<115)&(a[:,:,2]<95)

def clusters(m, minpx=120):
    lab,n = ndimage.label(m)
    out=[]
    for i in range(1,n+1):
        ys,xs = np.nonzero(lab==i)
        if len(xs)<minpx: continue
        out.append((float(xs.mean()), float(ys.mean()), len(xs)))
    return out

# settled red centroids (ref f96, pre-motion)
base = clusters(red(load("refs/f96.png")))
base.sort()
print("BASE (f96):", [(round(x,1),round(y,1),n) for x,y,n in base])

def fit_sim(src, dst):
    # similarity: [x'] = s*R*[x] + t ; solve least squares in complex form
    S = np.array([complex(x,y) for x,y in src])
    D = np.array([complex(x,y) for x,y in dst])
    Sm, Dm = S.mean(), D.mean()
    a = ((D-Dm)*np.conj(S-Sm)).sum() / (np.abs(S-Sm)**2).sum()
    t = Dm - a*Sm
    s = abs(a); th = np.degrees(np.angle(a))
    return s, th, t.real, t.imag

import sys
prev = {i:(x,y) for i,(x,y,n) in enumerate(base)}
print("\nfr    s     deg     tx      ty    matched  clusters")
for f in range(96,119):
    a = load(f"refs/f{f}.png")
    cl = clusters(red(a))
    # match each base cluster to nearest current cluster within a radius that grows
    src=[];dst=[]
    for i,(bx,by,bn) in enumerate(base):
        px,py = prev[i]
        if not cl: continue
        d = [((cx-px)**2+(cy-py)**2, cx, cy, cn) for cx,cy,cn in cl]
        d.sort()
        dd,cx,cy,cn = d[0]
        if dd**0.5 > 170: continue
        # size sanity
        if cn < 0.3*bn: continue
        src.append((bx,by)); dst.append((cx,cy)); prev[i]=(cx,cy)
    if len(src)>=2:
        s,th,tx,ty = fit_sim(src,dst)
        print(f"{f:3d}  {s:5.3f} {th:7.2f} {tx:8.1f} {ty:7.1f}   {len(src)}      {len(cl)}")
    else:
        print(f"{f:3d}  ---- only {len(src)} matched, {len(cl)} clusters")

print("\n--- pivot (fixed point) per frame, and per-point residual")
prev = {i:(x,y) for i,(x,y,n) in enumerate(base)}
for f in range(100,114):
    a = load(f"refs/f{f}.png"); cl = clusters(red(a))
    src=[];dst=[]
    for i,(bx,by,bn) in enumerate(base):
        px,py = prev[i]
        if not cl: continue
        d = sorted([((cx-px)**2+(cy-py)**2, cx, cy, cn) for cx,cy,cn in cl])
        dd,cx,cy,cn = d[0]
        if dd**0.5>170 or cn<0.3*bn: continue
        src.append((bx,by)); dst.append((cx,cy)); prev[i]=(cx,cy)
    if len(src)<2: break
    s,th,tx,ty = fit_sim(src,dst)
    aa = s*np.exp(1j*np.radians(th))
    piv = complex(tx,ty)/(1-aa) if abs(1-aa)>1e-6 else complex(float('nan'),float('nan'))
    # residual
    res=[]
    for (sx,sy),(dx,dy) in zip(src,dst):
        p = aa*complex(sx,sy)+complex(tx,ty)
        res.append(abs(p-complex(dx,dy)))
    print(f"{f:3d} s={s:.4f} th={th:6.2f} pivot=({piv.real:7.1f},{piv.imag:7.1f}) rms={np.sqrt(np.mean(np.square(res))):.2f} n={len(src)}")
