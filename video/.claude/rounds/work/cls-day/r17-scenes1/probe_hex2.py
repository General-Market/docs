import numpy as np
from PIL import Image
from scipy import ndimage
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def navy(a): return (a[:,:,2]>55)&(a[:,:,0]<110)&(a[:,:,1]<120)
print(" f   hex components below the band (x0..x1, y0..y1, w, h, cx, cy)")
for f in range(446,486,2):
    a=load(f"refs4/f{f}.png"); m=navy(a)
    m[:340,:]=False                      # kill the timeline band + labels
    mm=ndimage.binary_closing(m, np.ones((5,5)))
    mm=ndimage.binary_fill_holes(mm)
    lab,n=ndimage.label(mm)
    out=[]
    for i in range(1,n+1):
        ys,xs=np.nonzero(lab==i)
        if len(xs)<600: continue
        w=xs.max()-xs.min()+1; h=ys.max()-ys.min()+1
        if h<120: continue
        out.append((int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max()),int(w),int(h),
                    round(float((xs.min()+xs.max())/2),1), round(float((ys.min()+ys.max())/2),1)))
    out.sort()
    print(f"{f:4d}  " + " | ".join(f"x{o[0]}..{o[1]} y{o[2]}..{o[3]} w{o[4]} h{o[5]} c({o[6]},{o[7]})" for o in out))
