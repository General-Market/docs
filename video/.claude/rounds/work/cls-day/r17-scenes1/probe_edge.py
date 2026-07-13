import numpy as np
from PIL import Image
from scipy import ndimage
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def navy(a): return (a[:,:,2]>60)&(a[:,:,0]<80)&(a[:,:,1]<90)
def whitish(a): return (a[:,:,0]>190)&(a[:,:,1]>190)&(a[:,:,2]>190)
PX,PY=960.0,540.0
print(" f   theta   half-widths (signed dist of each edge from centre)   navy-regions")
for f in range(101,122):
    a=load(f"{DIR}/f{f}.png"); nv=navy(a); wh=whitish(a)
    # fill small holes in navy (letters) so the region boundary is the strip edge
    nvf = ndimage.binary_closing(nv, np.ones((9,9)))
    nvf = ndimage.binary_fill_holes(nvf)
    lab,n = ndimage.label(nvf)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1,n+1))
    regs = [i+1 for i in range(n) if sizes[i] > 20000]
    whf = ndimage.binary_dilation(ndimage.binary_fill_holes(ndimage.binary_closing(wh,np.ones((9,9)))), np.ones((3,3)))
    lines=[]
    for r in regs:
        m = (lab==r)
        # boundary pixels of this navy region that touch white
        edge = ndimage.binary_dilation(m, np.ones((3,3))) & (~m) & whf
        ys,xs = np.nonzero(edge)
        if len(xs) < 200: continue
        # robust line fit: total least squares + 2 IRLS passes
        X=xs.astype(float); Y=ys.astype(float); w=np.ones(len(X))
        for _ in range(3):
            mx=(w*X).sum()/w.sum(); my=(w*Y).sum()/w.sum()
            u=X-mx; v=Y-my
            C=np.array([[ (w*u*u).sum(), (w*u*v).sum()],[(w*u*v).sum(), (w*v*v).sum()]])
            ev,evec=np.linalg.eigh(C)
            nvec=evec[:,0]  # normal = smallest eigenvector
            d=np.abs(u*nvec[0]+v*nvec[1])
            sc=max(np.median(d)*1.6,1.0)
            w=1.0/(1.0+(d/sc)**2)
        # signed distance of frame centre from the line
        sd = (PX-mx)*nvec[0] + (PY-my)*nvec[1]
        # angle of the line from VERTICAL (card-space strip edges are vertical)
        ang = np.degrees(np.arctan2(nvec[1], nvec[0]))  # normal direction
        # normal of a vertical line rotated by th is (cos th, ... ) -> line angle from vertical:
        th = -np.degrees(np.arctan2(-nvec[1], nvec[0]))
        inl = (w>0.5).sum()
        lines.append((th, sd, inl, len(xs)))
    if not lines: print(f"{f:3d}  (none)"); continue
    ths=[l[0] for l in lines]
    print(f"{f:3d}  th={['%.2f'%t for t in ths]}  dist={['%.1f'%l[1] for l in lines]}  npx={[l[3] for l in lines]}")
