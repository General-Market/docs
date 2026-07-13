import sys, numpy as np
from PIL import Image
D='.claude/rounds/work/cls-day/r17-scenes1b'
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(int)
def band(a):
    r,g,b=a[...,0],a[...,1],a[...,2]; lum=(r+g+b)/3
    grey=(abs(r-g)<14)&(abs(g-b)<14)&(lum>185)&(lum<225)
    idx=np.where(grey.sum(axis=1)>1500)[0]
    return idx[0], idx[-1]
def ticks_above(a):
    t0,_=band(a)
    lum=a[...,:3].mean(axis=2)
    dark = lum<95
    # for each column, contiguous dark run ending at t0-2
    res=[]
    for x in range(1920):
        y=t0-3; n=0
        while y>0 and dark[y,x]: n+=1; y-=1
        if n>=170: res.append(x)
    # group
    grp=[];cur=[res[0]] if res else []
    for x in res[1:]:
        if x-cur[-1]<=2: cur.append(x)
        else: grp.append(sum(cur)/len(cur)); cur=[x]
    if cur: grp.append(sum(cur)/len(cur))
    return t0, [round(g,1) for g in grp]
def ticks_below(a):
    _,t1=band(a)
    lum=a[...,:3].mean(axis=2)
    br = lum>140
    res=[]
    for x in range(1920):
        y=t1+3; n=0
        while y<1079 and br[y,x]: n+=1; y+=1
        if n>=170: res.append(x)
    grp=[];cur=[res[0]] if res else []
    for x in res[1:]:
        if x-cur[-1]<=2: cur.append(x)
        else: grp.append(sum(cur)/len(cur)); cur=[x]
    if cur: grp.append(sum(cur)/len(cur))
    return t1, [round(g,1) for g in grp]
for f in range(673,692):
    out=[]
    for tag in ("refs","head"):
        try: a=load(f"{D}/{tag}/f{f}.png")
        except: out.append(None); continue
        t0,ta=ticks_above(a); t1,tb=ticks_below(a)
        out.append((ta,tb))
    if out[0] is None or out[1] is None or len(out)<2: continue
    ra,rb=out[0]; oa,ob=out[1]
    def pitch(v): return round(np.median(np.diff(v)),1) if len(v)>1 else None
    print(f"f{f}")
    print(f"   ref above {ra} p={pitch(ra)}")
    print(f"   our above {oa} p={pitch(oa)}")
