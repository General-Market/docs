import sys
from PIL import Image
import numpy as np
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def wm(a): return (a[:,:,0]>150)&(a[:,:,1]>150)&(a[:,:,2]>150)
def bbox(m,x0,x1,y0,y1):
    sub=m[y0:y1,x0:x1]; ys,xs=np.nonzero(sub)
    if len(xs)==0: return None
    return (x0+int(xs.min()),x0+int(xs.max()),y0+int(ys.min()),y0+int(ys.max()),int(len(xs)))
for p in sys.argv[1:]:
    a=load(p);m=wm(a)
    b=bbox(m,430,690,140,650)  # mark column only
    print(p, "markcol", b)
