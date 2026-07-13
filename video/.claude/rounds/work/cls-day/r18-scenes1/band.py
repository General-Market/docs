import numpy as np, subprocess, os
from PIL import Image
REF="/Users/maxguillabert/Downloads/index/video/public/cls-day-original.mp4"
LUT_RC={674:412,675:447.5,676:474.5,677:490,678:503,679:512.5,680:520,681:525,682:529,683:530.5,684:532.5}
LUT_SY={674:.824,675:.855,676:.88,677:.918,678:.941,679:.953,680:.965,681:.978,682:.988,683:.994,684:1.0}
print(" f  |  band top  bottom   h   | riseC meas/lut | sy meas/lut")
for f in range(674,691):
    p=f"refs/r{f}.png"
    if not os.path.exists(p):
        subprocess.run(["ffmpeg","-loglevel","error","-i",REF,"-vf",f"select=eq(n\\,{f})","-vframes","1","-y",p],check=True)
    im=np.asarray(Image.open(p).convert("RGB"),float)
    tops=[];bots=[]
    for x in range(40,1900,7):
        col=im[:,x,:]
        g=(np.abs(col-np.array([215,215,215])).max(1)<14)
        idx=np.nonzero(g)[0]
        if len(idx)<20: continue
        # longest run
        splits=np.split(idx,np.where(np.diff(idx)!=1)[0]+1)
        r=max(splits,key=len)
        if len(r)<20: continue
        tops.append(r[0]); bots.append(r[-1]+1)
    if not tops: print(f,"none"); continue
    t=np.median(tops); b=np.median(bots); h=b-t
    sy=h/85.0; rc=(t+b)/2.0
    lr=LUT_RC.get(f,532.5); ls=LUT_SY.get(f,1.0)
    print(f"{f} | {t:7.1f} {b:7.1f} {h:6.1f} | {rc:7.1f} / {lr:6.1f} | {sy:.4f} / {ls:.4f}   n={len(tops)}")
