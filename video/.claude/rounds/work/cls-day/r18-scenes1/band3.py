import numpy as np, subprocess, os
from PIL import Image
REF="/Users/maxguillabert/Downloads/index/video/public/cls-day-original.mp4"
SX={916:1,918:.988,920:.988,922:.975,924:.902,926:.81,928:.803}
SY={916:1,918:.988,920:.976,922:.929,924:.929,926:.835,928:.776}
RC={916:532.5,918:532.5,920:521.5,922:506.5,924:481.5,926:430.5,928:327}
def sub(prof,y0,y1,t,rising):
    for y in range(max(0,y0),min(len(prof)-1,y1)):
        a,b=prof[y],prof[y+1]
        if (rising and a<t<=b) or (not rising and a>t>=b): return y+(t-a)/(b-a)
print(" f |   top     bot      h   | sy_corr sy_lut | sx_lut | rc_m  rc_lut  n")
for f in [910,914,916,918,920,922,924,926]:
    p=f"refs/r{f}.png"
    if not os.path.exists(p): subprocess.run(["ffmpeg","-loglevel","error","-i",REF,"-vf",f"select=eq(n\\,{f})","-vframes","1","-y",p],check=True)
    rgb=np.asarray(Image.open(p).convert("RGB"),float); im=np.asarray(Image.open(p).convert("L"),float)
    g=(np.abs(rgb-215).max(2)<14); rows=np.nonzero(g.sum(1)>700)[0]
    if not len(rows): print(f,"no band"); continue
    bt,bb=rows.min(),rows.max()
    tops=[];bots=[]
    for x in range(20,1910):
        col=im[:,x]
        if bt-8<0 or bb+9>1079: continue
        if col[bt-8:bt-3].min()<245: continue
        if col[bb+4:bb+9].max()>60: continue
        t=sub(col,bt-6,bt+3,234.0,False); b=sub(col,bb-3,bb+6,121.0,False)
        if t is not None and b is not None: tops.append(t);bots.append(b)
    if len(tops)<50: print(f,"n too small",len(tops)); continue
    t=np.median(tops);b=np.median(bots);h=b-t
    print(f"{f} | {t:7.2f} {b:7.2f} {h:7.2f} | {(h-1.01)/85:.4f}  {SY.get(f,1):.4f} | {SX.get(f,1):.4f} | {(t+b)/2-0.17:6.1f} {RC.get(f,532.5):6.1f}  n={len(tops)}")
