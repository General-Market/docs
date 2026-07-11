from PIL import Image
import numpy as np
def load(f): return np.asarray(Image.open(f).convert("RGB")).astype(int)
def isnavyink(px): r,g,b=px; return r<60 and g<70 and 60<b<120   # #12365E headline navy
def isred(px): r,g,b=px; return r>150 and g<110 and b<75
def isgrey(px): r,g,b=px; return abs(r-215)<18 and abs(g-215)<18 and abs(b-215)<18
D=".claude/rounds/work/cls-day/gen11/ref"
for fr in [1540,1560,1580,1595]:
    im=load(f"{D}/f{fr}.png"); H,W,_=im.shape
    # grey band bottom at col 1780
    gy=[y for y in range(0,400) if isgrey(im[y,1780])]
    bandbot=(max(gy)+1) if gy else None
    # red line x at y=300
    reds=[x for x in range(0,W) if isred(im[300,x])]
    redx=int(np.median(reds)) if reds else None
    # 06:30 text bbox: navy ink in y>500 region, x<900
    mask=np.zeros((H,W),bool)
    for y in range(450,1000):
        rowpx=im[y]
        m=(rowpx[:,0]<60)&(rowpx[:,1]<70)&(rowpx[:,2]>55)&(rowpx[:,2]<125)
        mask[y]=m
    ys,xs=np.where(mask)
    if len(xs):
        # big digits = rows with many px (cap band); small label rows fewer
        rowcnt=mask.sum(1)
        bigrows=[y for y in range(450,1000) if rowcnt[y]>60]
        # restrict to big text (the 06:30) — first contiguous big block
        if bigrows:
            t0=bigrows[0]
            t1=t0
            for y in bigrows:
                if y-t1>15: break
                t1=y
            bxs=np.where(mask[t0:t1+1].any(0))[0]
            print(f"f{fr}: bandbot={bandbot} redx={redx} | 06:30 big: y{t0}-{t1}(cap{t1-t0}) x{bxs.min()}-{bxs.max()}(w{bxs.max()-bxs.min()})")
        else:
            print(f"f{fr}: bandbot={bandbot} redx={redx} | no big text; ink bbox y{ys.min()}-{ys.max()} x{xs.min()}-{xs.max()}")
    else:
        print(f"f{fr}: bandbot={bandbot} redx={redx} | no navy ink")
