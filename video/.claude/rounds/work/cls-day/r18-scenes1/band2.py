import numpy as np
from PIL import Image
LUT_SY={674:.824,675:.855,676:.88,677:.918,678:.941,679:.953,680:.965,681:.978,682:.988,683:.994,684:1.0}
LUT_RC={674:412,675:447.5,676:474.5,677:490,678:503,679:512.5,680:520,681:525,682:529,683:530.5,684:532.5}
def sub(prof, y0, y1, target, rising):
    for y in range(y0,y1):
        a,b=prof[y],prof[y+1]
        if (rising and a<target<=b) or (not rising and a>target>=b):
            return y + (target-a)/(b-a)
    return None
print(" f |   top     bot     h    |  sy_meas  sy_lut  d%  |  rc_meas rc_lut")
for f in list(range(674,692))+[700,750,800,900]:
    im=np.asarray(Image.open(f"refs/r{f}.png").convert("L"),float)
    g=(np.abs(np.asarray(Image.open(f"refs/r{f}.png").convert("RGB"),float)-215).max(2)<14)
    rows=np.nonzero(g.sum(1)>1200)[0]; bt,bb=rows.min(),rows.max()
    tops=[];bots=[]
    for x in range(20,1910):
        col=im[:,x]
        # require clean white above and clean navy below
        if col[max(0,bt-8):bt-3].min()<245: continue
        if col[bb+4:bb+9].max()>60: continue
        t=sub(col,bt-6,bt+3,234.0,False)      # white(253) -> grey(215)
        b=sub(col,bb-3,bb+6,121.0,False)      # grey(215) -> navy(~28)
        if t is not None and b is not None: tops.append(t); bots.append(b)
    t=np.median(tops); b=np.median(bots); h=b-t
    sy=h/85.0; rc=(t+b)/2
    ls=LUT_SY.get(f,1.0); lr=LUT_RC.get(f,532.5)
    print(f"{f} | {t:7.2f} {b:7.2f} {h:7.2f} |  {sy:.4f}  {ls:.4f} {100*(sy/ls-1):+5.1f}% |  {rc:7.2f} {lr:6.1f}   n={len(tops)}")
