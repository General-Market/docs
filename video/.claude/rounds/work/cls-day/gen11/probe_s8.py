from PIL import Image
import numpy as np, glob, re
def load(f): return np.asarray(Image.open(f).convert("RGB")).astype(int)
def isnavy(px): r,g,b=px; return r<75 and g<85 and 30<b<135
def isgrey(px): r,g,b=px; return abs(r-215)<18 and abs(g-215)<18 and abs(b-215)<18
def isred(px): r,g,b=px; return r>150 and g<110 and b<75
def isbarfill(px): r,g,b=px; return 120<r<175 and 140<g<185 and 158<b<205  # steel-blue bar fill

D=".claude/rounds/work/cls-day/gen11/ref"
for fr in [1600,1620,1640,1650,1660,1670,1680,1690,1700]:
    im=load(f"{D}/f{fr}.png"); H,W,_=im.shape
    # grey band bottom at col x=1780 (or 1885): grey->white transition
    col=1780
    gy=[y for y in range(0,400) if isgrey(im[y,col])]
    bandbot=(max(gy)+1) if gy else None
    # hour ticks: scan a row inside grey band (y=60)
    row=60 if (bandbot and bandbot>70) else max(5,(bandbot or 40)//2)
    ticks=[];x=0
    while x<W:
        if isnavy(im[row,x]):
            x0=x
            while x<W and isnavy(im[row,x]): x+=1
            if x-x0<14: ticks.append((x0+x-1)//2)
        x+=1
    # red line x (scan row y=200, below band, x<1920)
    rr=200
    reds=[x for x in range(0,W) if isred(im[rr,x])]
    redx=int(np.median(reds)) if reds else None
    # bars: navy-outline bounding via barfill mask clusters by y
    mask=np.zeros((H,W),bool)
    for y in range(300,1010):
        rowpx=im[y]
        m=(rowpx[:,0]>120)&(rowpx[:,0]<175)&(rowpx[:,1]>140)&(rowpx[:,1]<185)&(rowpx[:,2]>158)&(rowpx[:,2]<205)
        mask[y]=m
    rowhas=[y for y in range(300,1010) if mask[y].sum()>8]
    bars=[]
    if rowhas:
        s=rowhas[0]; p=rowhas[0]
        for y in rowhas[1:]:
            if y-p>10: bars.append((s,p)); s=y
            p=y
        bars.append((s,p))
    print(f"\nf{fr}: bandbot={bandbot} ticks={ticks} redx={redx}")
    for (y0,y1) in bars:
        ym=(y0+y1)//2
        xin=np.where(mask[ym])[0]
        if len(xin): print(f"   bar y{y0}-{y1}(h{y1-y0}) mid{ym}: x{xin.min()}-{xin.max()}(w{xin.max()-xin.min()})")
