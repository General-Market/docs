import sys, math
from collections import deque
from PIL import Image
import numpy as np

# usage: corners.py <png> <left> <top> <w> <h> [label]
# Isolates the pill's OWN navy component (flood-fill from the top-centre strip,
# which is navy in every pill and above the wordmark), so adjacent navy ink
# (connectors, hexes, chips) cannot contaminate the corner scan.
p, L, T, Wd, H = sys.argv[1], *map(int, sys.argv[2:6])
label = sys.argv[6] if len(sys.argv) > 6 else p
im = np.asarray(Image.open(p).convert("RGB")).astype(int)
navy = np.array([0, 39, 83])
M = np.sqrt(((im - navy) ** 2).sum(axis=2)) < 70

pad = 6
X0, X1 = max(0, L - pad), min(im.shape[1] - 1, L + Wd - 1 + pad)
Y0, Y1 = max(0, T - pad), min(im.shape[0] - 1, T + H - 1 + pad)

seed = (T + 3, L + Wd // 2)
if not M[seed]:
    sys.exit(f"{label}: seed {seed[::-1]} is not navy — pill absent or moved")

comp = np.zeros_like(M)
q = deque([seed])
comp[seed] = True
while q:
    y, x = q.popleft()
    for ny, nx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
        if Y0 <= ny <= Y1 and X0 <= nx <= X1 and M[ny, nx] and not comp[ny, nx]:
            comp[ny, nx] = True
            q.append((ny, nx))

ys, xs = np.nonzero(comp)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
w, h = x1 - x0 + 1, y1 - y0 + 1
print(f"== {label}")
print(f"   pill fill: {w}x{h} @ ({x0},{y0})")

def row_span(y):
    r = np.nonzero(comp[y])[0]
    return (r.min(), r.max()) if len(r) else None

rt, rb = row_span(y0), row_span(y1)
print(f"   top row    y={y0}: x {rt[0]}..{rt[1]}   TLcut={rt[0]-x0}  TRcut={x1-rt[1]}")
print(f"   bottom row y={y1}: x {rb[0]}..{rb[1]}   BLcut={rb[0]-x0}  BRcut={x1-rb[1]}")

def fit_R(corner):
    est = []
    for dy in range(2, 80):
        y = y0 + dy if corner[0] == 'T' else y1 - dy
        s = row_span(y)
        if s is None: continue
        dx = (s[0] - x0) if corner[1] == 'L' else (x1 - s[1])
        if dx <= 0: continue
        S = dx + dy
        R = S + math.sqrt(2 * dx * dy)   # larger root: R must exceed max(dx,dy)
        if max(dx, dy) <= R <= 120: est.append(R)
    if len(est) < 3: return None, len(est)
    return float(np.median(est)), len(est)

for c in ("TL", "TR", "BL", "BR"):
    R, n = fit_R(c)
    print(f"   {c}: SQUARE  ({n} inset rows)" if R is None
          else f"   {c}: R≈{R:.1f}  n={n}   R/h={R/h:.4f}")
