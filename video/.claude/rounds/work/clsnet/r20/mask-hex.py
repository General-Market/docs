#!/usr/bin/env python3
"""Erase the map-badge hexagon border (and everything outside it) from a hex
crop, so the trace carries ONLY the city inside.  The hexagon outline is drawn
by the <Hexagon> component at every call site; carrying a second one in the art
is the fiction that r19 measured (the "navy bucket" under the skyline).

usage: mask-hex.py <frame.png> <x> <y> <w> <h> <inset> <out.png>
The hexagon is fitted from the navy border itself (pointy-left/right form).
"""
import sys
import numpy as np
from PIL import Image

frame, x, y, w, h = sys.argv[1], *map(int, sys.argv[2:6])
inset = float(sys.argv[6])
out = sys.argv[7]

im = np.asarray(Image.open(frame).convert("RGB")).astype(int)
c = im[y:y + h, x:x + w].copy()
navy = (np.abs(c - np.array((0, 39, 83))).sum(axis=2) < 90)
H, W = navy.shape

# fit the two left edges and the two right edges by least squares on the
# outermost navy pixel per row (rows away from the vertices and the flats)
def fit(rows, side):
    pts = []
    for r in rows:
        idx = np.where(navy[r])[0]
        if len(idx):
            pts.append((r, idx[0] if side == "l" else idx[-1]))
    a = np.array(pts, float)
    m, b = np.polyfit(a[:, 0], a[:, 1], 1)
    return m, b

ul = fit(range(int(H * 0.08), int(H * 0.36)), "l")
ll = fit(range(int(H * 0.64), int(H * 0.92)), "l")
ur = fit(range(int(H * 0.08), int(H * 0.36)), "r")
lr = fit(range(int(H * 0.64), int(H * 0.92)), "r")
# vertices = line intersections
cyl = (ll[1] - ul[1]) / (ul[0] - ll[0]); xl = ul[0] * cyl + ul[1]
cyr = (lr[1] - ur[1]) / (ur[0] - lr[0]); xr = ur[0] * cyr + ur[1]
cy = (cyl + cyr) / 2
cx = (xl + xr) / 2
a = (xr - xl) / 2
# half-height from the edge slope: the flats sit at |y-cy| = b where the edge
# has run a/2 in x.  slope m = dx/dy  ->  b = (a/2)/|m|
b = (a / 2) / abs(ul[0])
print(f"hex: cx={cx:.1f} cy={cy:.1f} a={a:.1f} b={b:.1f}  (vertices {xl:.1f},{xr:.1f})")

V = [(cx - a, cy), (cx - a / 2, cy - b), (cx + a / 2, cy - b),
     (cx + a, cy), (cx + a / 2, cy + b), (cx - a / 2, cy + b)]

# signed distance to the convex polygon (positive inside)
gy, gx = np.mgrid[0:H, 0:W]
inside = np.full((H, W), 1e9)
for i in range(6):
    x0, y0 = V[i]; x1, y1 = V[(i + 1) % 6]
    ex, ey = x1 - x0, y1 - y0
    L = np.hypot(ex, ey)
    # outward normal for a clockwise-ish polygon: use sign vs centroid
    nx, ny = ey / L, -ex / L
    d = (gx - x0) * nx + (gy - y0) * ny
    if (cx - x0) * nx + (cy - y0) * ny < 0:
        d = -d
    inside = np.minimum(inside, d)

keep = inside > inset
c[~keep] = (253, 253, 253)
Image.fromarray(c.astype("uint8")).save(out)
print(f"masked {int((~keep).sum())} px -> {out}")
