from PIL import Image
im = Image.open(f".claude/rounds/work/cls-day/models/hsref/ref_85.png").convert("RGB")
px = im.load()
def iswhite(c): return c[0]>180 and c[1]>180 and c[2]>180
# icon: video x600..780 -> svg 0..174 (scale .9667); video y666..790 -> svg 0..120 (scale .966)
def tosvg(vx,vy): return round((vx-600)*174/180,1), round((vy-666)*120/124.2,1)
# scan several video rows across the finger band; report white runs (centers)
for vy in [710,725,740,755,770,785,800]:
    runs=[]; vx=600
    while vx<790:
        if iswhite(px[vx,vy]):
            x0=vx
            while vx<790 and iswhite(px[vx,vy]): vx+=1
            if vx-x0>=2: runs.append(((x0+vx-1)//2, vx-x0))
        else: vx+=1
    svg=[f"{tosvg(cx,vy)[0]:.0f}(w{w})" for cx,w in runs]
    print(f"vy={vy} svg_y={tosvg(600,vy)[1]:.0f}: white centers(svgx): {svg}")
