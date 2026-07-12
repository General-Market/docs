import sys
from PIL import Image

path = sys.argv[1]
im = Image.open(path).convert("RGB")
W, H = im.size
px = im.load()

NAVY = (0x00, 0x27, 0x53)  # circle fill / navy chip

def isnavy(c, tol=40):
    return abs(c[0]-NAVY[0])<tol and abs(c[1]-NAVY[1])<tol and abs(c[2]-NAVY[2])<tol

def iswhite(c, tol=18):
    return c[0]>255-tol and c[1]>255-tol and c[2]>255-tol

# --- find the circle band: scan a horizontal line for navy runs at several y ---
# circles sit low (~y820-880). Find the y with the most navy pixels in the lower half.
best_y, best_n = 0, 0
for y in range(760, 900):
    n = sum(1 for x in range(0, W) if isnavy(px[x, y]))
    if n > best_n:
        best_n, best_y = n, y
print(f"circle mid-row y={best_y} navypx={best_n}")

# find navy runs on that row = circle horizontal extents
y = best_y
runs = []
x = 0
while x < W:
    if isnavy(px[x, y]):
        x0 = x
        while x < W and isnavy(px[x, y]):
            x += 1
        if x - x0 > 20:  # circle width
            runs.append((x0, x-1))
    else:
        x += 1
print("circle x-runs (center,width):")
for (a, b) in runs:
    print(f"  cx={(a+b)/2:.0f}  w={b-a+1}")

# circle vertical extent for the first run: scan column at its center
if runs:
    cx = (runs[0][0]+runs[0][1])//2
    ys = [yy for yy in range(700, 950) if isnavy(px[cx, yy])]
    if ys:
        print(f"circle A vert: top={min(ys)} bot={max(ys)} h={max(ys)-min(ys)+1} cy={(min(ys)+max(ys))/2:.0f}")

# --- chips: for each circle column, scan upward for colored (non-white) chip pixels ---
# any pixel that's not white and not part of the pan band (grey) between y 560..800
def iscolor(c):
    if iswhite(c): return False
    # grey band ~ (215,215,215); ignore
    if abs(c[0]-c[1])<12 and abs(c[1]-c[2])<12 and c[0]>150: return False
    return True

for (a, b) in runs:
    cx = (a+b)//2
    ys = [yy for yy in range(500, 810) if iscolor(px[cx, yy])]
    if not ys:
        print(f"  col cx={cx}: no chips")
        continue
    top, bot = min(ys), max(ys)
    # detect chip bands = contiguous colored runs
    bands = []
    yy = 500
    while yy < 810:
        if iscolor(px[cx, yy]):
            y0 = yy
            while yy < 810 and iscolor(px[cx, yy]):
                yy += 1
            bands.append((y0, yy-1))
        else:
            yy += 1
    band_str = " ".join(f"[{y0}-{y1} h{y1-y0+1}]" for (y0,y1) in bands)
    print(f"  col cx={cx}: chip-top={top} chip-bot={bot} nbands~{len(bands)} {band_str}")

# chip width: scan a horizontal line through the bottom chip of column A
if runs:
    cx = (runs[0][0]+runs[0][1])//2
    ys = [yy for yy in range(500, 810) if iscolor(px[cx, yy])]
    if ys:
        ymid = max(ys) - 15
        xs = [xx for xx in range(cx-120, cx+120) if iscolor(px[xx, ymid])]
        if xs:
            print(f"chip A bottom width: x {min(xs)}..{max(xs)} = {max(xs)-min(xs)+1} at y={ymid}")
