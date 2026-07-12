from PIL import Image
im = Image.open(".claude/rounds/work/cls-day/models/s16ref/ref_3100.png").convert("RGB")
px = im.load()
cols = {"A":386,"B":544,"C":697,"D":851,"E":1004,"F":1158,"G":1311,"H":1465}
# chip band tops (from probe), bottom chip top=702, pitch=56
# sample color at center of each present chip
def band_tops(cx):
    def iscolor(c):
        if c[0]>237 and c[1]>237 and c[2]>237: return False
        if abs(c[0]-c[1])<12 and abs(c[1]-c[2])<12 and c[0]>150: return False
        return True
    bands=[]; yy=500
    while yy<785:
        if iscolor(px[cx,yy]):
            y0=yy
            while yy<785 and iscolor(px[cx,yy]): yy+=1
            bands.append((y0,yy-1))
        else: yy+=1
    return bands
for name,cx in cols.items():
    bands=band_tops(cx)
    s=[]
    for (y0,y1) in bands:
        ym=(y0+y1)//2
        c=px[cx,ym]
        s.append(f"y{ym}={c}")
    print(f"{name} cx{cx} nchips={len(bands)}: "+" | ".join(s))
# chip width at bottom chip (y=723)
for name,cx in [("A",386),("H",1465)]:
    def iscolor(c):
        if c[0]>237 and c[1]>237 and c[2]>237: return False
        if abs(c[0]-c[1])<12 and abs(c[1]-c[2])<12 and c[0]>150: return False
        return True
    xs=[x for x in range(cx-120,cx+120) if iscolor(px[x,723])]
    if xs: print(f"{name} bottom-chip width @y723: {min(xs)}..{max(xs)} = {max(xs)-min(xs)+1}, cx_actual={(min(xs)+max(xs))//2}")
