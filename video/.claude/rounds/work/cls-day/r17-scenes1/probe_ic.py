import sys
from PIL import Image
import numpy as np
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def ink(a): # any non-navy-bg ink (white or red)
    bg = np.array([10,42,84])
    d = np.abs(a-bg).sum(axis=2)
    return d>90
def bbox(m,x0,x1,y0,y1):
    sub=m[y0:y1,x0:x1]; ys,xs=np.nonzero(sub)
    if len(xs)==0: return None
    return (x0+int(xs.min()),x0+int(xs.max()),y0+int(ys.min()),y0+int(ys.max()),int(len(xs)))
ROIS={"iconS":(500,820,600,840),"iconP":(820,1120,600,840),"iconD":(1120,1420,600,840),
      "labS":(500,820,845,915),"labP":(820,1120,845,915),"labD":(1120,1420,845,915)}
for p in sys.argv[1:]:
    a=load(p);m=ink(a);print("==",p)
    for k,(x0,x1,y0,y1) in ROIS.items():
        b=bbox(m,x0,x1,y0,y1)
        print(f"  {k}: {b}")
