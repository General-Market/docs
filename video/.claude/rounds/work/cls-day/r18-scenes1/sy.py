import numpy as np
from PIL import Image
LUT_SY={674:.824,675:.855,676:.88,677:.918,678:.941,679:.953,680:.965,681:.978,682:.988,683:.994,684:1.0}
RC={674:412.5,675:448,676:473,677:490,678:503.5,679:513,680:520,681:525.5,682:529.5,683:531.5,684:532.5}
NAVY=np.array([11,35,65]); WHT=np.array([253,253,253])
print(" f | tickTop(180) foot(883) | sy_long  sy_lut | rc")
for f in range(674,691):
    im=np.asarray(Image.open(f"refs/r{f}.png").convert("RGB"),float)
    # band rows from grey
    g=(np.abs(im-215).max(2)<14)
    rows=np.nonzero(g.sum(1)>1200)[0]
    bt,bb=rows.min(),rows.max()
    # ABOVE: navy tick columns -> topmost navy pixel. tick = column with many navy px in [bt-40,bt)
    nav=(np.linalg.norm(im-NAVY,axis=2)<70)
    band_rows=slice(max(0,bt-30),bt-2)
    cols=np.nonzero(nav[band_rows,:].sum(0) > (bt-2-max(0,bt-30))*0.9)[0]
    tops=[]
    for x in cols:
        idx=np.nonzero(nav[:bt-2,x])[0]
        if len(idx): 
            sp=np.split(idx,np.where(np.diff(idx)!=1)[0]+1); r=max(sp,key=len)
            if len(r)>60: tops.append(r[0])
    # BELOW: white tick columns under band
    wh=(np.linalg.norm(im-WHT,axis=2)<70)
    lo=slice(bb+3,min(1079,bb+30))
    cols2=np.nonzero(wh[lo,:].sum(0) > (min(1079,bb+30)-(bb+3))*0.9)[0]
    feet=[]
    for x in cols2:
        idx=np.nonzero(wh[bb+3:,x])[0]
        if len(idx):
            sp=np.split(idx,np.where(np.diff(idx)!=1)[0]+1); r=max(sp,key=len)
            if len(r)>60: feet.append(bb+3+r[-1])
    if not tops or not feet: print(f,"skip",len(tops),len(feet)); continue
    t=np.median(tops); ft=np.median(feet)
    sy=(ft-t)/703.0
    print(f"{f} | {t:8.0f} {ft:8.0f}  | {sy:.4f}  {LUT_SY.get(f,1.0):.4f} | rc_pred {(t+352.5*sy):.1f} nT={len(tops)} nF={len(feet)}")
