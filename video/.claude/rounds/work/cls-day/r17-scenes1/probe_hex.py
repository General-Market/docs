import numpy as np
from PIL import Image
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def ink(a):
    # any non-white ink
    return (a.mean(axis=2) < 225)
# hex A sits left, hex B right (per S4_AX/S4_BX: at f446 A=(723,527) B=(1191,738), s=1.53)
# measure the ink bbox + mass + darkness inside each hex's neighbourhood per frame
def stats(p, x0,x1,y0,y1):
    a=load(p); m=ink(a)
    sub=m[y0:y1,x0:x1]
    ys,xs=np.nonzero(sub)
    if len(xs)==0: return None
    g=a[y0:y1,x0:x1].mean(axis=2)
    dark = g[sub].mean()
    return (x0+int(xs.min()), x0+int(xs.max()), y0+int(ys.min()), y0+int(ys.max()), int(len(xs)), round(float(dark),1))
print("hex A region (x420..1030, y270..790)")
for f in range(444,476,2):
    s=stats(f"refs4/f{f}.png",420,1030,270,790)
    print(f" f{f}: {s}")
print("hex B region (x900..1500, y480..1000)")
for f in range(440,476,2):
    s=stats(f"refs4/f{f}.png",1000,1500,520,1000)
    print(f" f{f}: {s}")
