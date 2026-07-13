import sys
from PIL import Image
import numpy as np

def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(int)

def whitemask(a):
    # white ink on navy
    return (a[:,:,0]>150)&(a[:,:,1]>150)&(a[:,:,2]>150)

def redmask(a):
    return (a[:,:,0]>120)&(a[:,:,1]<110)&(a[:,:,2]<90)

def bbox(m, x0,x1,y0,y1):
    sub = m[y0:y1, x0:x1]
    ys,xs = np.nonzero(sub)
    if len(xs)==0: return None
    return (x0+xs.min(), x0+xs.max(), y0+ys.min(), y0+ys.max(), len(xs))

ROIS = {
  "mark":    (400, 700, 120, 420),
  "letters": (690, 1600, 120, 420),
  "tagline": (300, 1650, 405, 505),
  "iconS":   (520, 800, 620, 830),
  "iconP":   (800, 1080, 620, 830),
  "iconD":   (1100, 1400, 620, 830),
  "labels":  (400, 1500, 840, 910),
}
for p in sys.argv[1:]:
    a = load(p)
    w = whitemask(a)
    print("==", p)
    for k,(x0,x1,y0,y1) in ROIS.items():
        b = bbox(w, x0,x1,y0,y1)
        if b: print(f"  {k:8s} x{b[0]}..{b[1]} (w{b[1]-b[0]+1})  y{b[2]}..{b[3]} (h{b[3]-b[2]+1})  ink{b[4]}")
        else: print(f"  {k:8s} none")
    r = redmask(a)
    for k,(x0,x1,y0,y1) in [("redS",(520,800,620,830)),("redP",(800,1080,620,830)),("redD",(1100,1400,620,830))]:
        b = bbox(r, x0,x1,y0,y1)
        if b: print(f"  {k:8s} x{b[0]}..{b[1]} y{b[2]}..{b[3]} ink{b[4]}")
