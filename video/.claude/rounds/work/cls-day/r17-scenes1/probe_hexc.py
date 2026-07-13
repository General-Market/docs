import numpy as np
from PIL import Image
from scipy import ndimage
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def red(a): return (a[:,:,0]>140)&(a[:,:,1]<125)&(a[:,:,2]<105)
def navy(a): return (a[:,:,2]>55)&(a[:,:,0]<110)&(a[:,:,1]<120)
# hex outline bboxes measured in probe_hex2 (per frame). Split red ink by which
# hex bbox it falls in; red exists ONLY in the interior, never in the outline.
BOX={}  # f -> [(x0,x1,y0,y1) for A, B]
for f in range(442,476):
    a=load(f"refs4/f{f}.png"); m=navy(a); m[:300,:]=False
    mm=ndimage.binary_fill_holes(ndimage.binary_closing(m,np.ones((5,5))))
    lab,n=ndimage.label(mm)
    out=[]
    for i in range(1,n+1):
        ys,xs=np.nonzero(lab==i)
        if len(xs)<150 or (ys.max()-ys.min())<100: continue
        out.append((int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max())))
    out.sort()
    BOX[f]=out
print(" f  kA     redA   contA | kB     redB   contB")
# settled red per hex from f472
sf=472
a=load(f"refs4/f{sf}.png"); r=red(a)
setA=setB=0
for j,(x0,x1,y0,y1) in enumerate(BOX[sf][:2]):
    v=int(r[y0:y1+1,x0:x1+1].sum())
    if j==0: setA=v
    else: setB=v
for f in range(442,476):
    a=load(f"refs4/f{f}.png"); r=red(a)
    vals=[]
    for j,(x0,x1,y0,y1) in enumerate(BOX[f][:2]):
        vals.append(int(r[y0:y1+1,x0:x1+1].sum()))
    wA=(BOX[f][0][1]-BOX[f][0][0]+1) if len(BOX[f])>0 else 0
    wB=(BOX[f][1][1]-BOX[f][1][0]+1) if len(BOX[f])>1 else 0
    rA=vals[0] if len(vals)>0 else 0
    rB=vals[1] if len(vals)>1 else 0
    print(f"{f:3d} {wA/560:5.3f} {rA:6d} {rA/setA:6.3f} | {wB/560:5.3f} {rB:6d} {rB/setB:6.3f}")
print(f"settled red: A={setA} B={setB}")
