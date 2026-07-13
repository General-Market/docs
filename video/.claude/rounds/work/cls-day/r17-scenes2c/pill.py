#!/usr/bin/env python3
"""The pill's SOLID NAVY FILL, isolated from everything that touches it.

The pill is the cleanest signal in S13: a ~83,000-px solid navy block. But it is
NOT an isolated navy component — the rails leave its edges and run to the capsules,
so a naive flood-fill walks straight out of it (measured: bbox x752..1919 at f2400).

So: threshold the exact fill colour (0,39,83), ERODE by k=5 (every other navy thing
in the frame is a stroke <= 8px: rails 5, capsule outlines 4, band ticks 3 — all
annihilated), label, keep the largest component in the central window, then add k
back on each side. The straight edges give the bbox exactly; the handshake icon is
a hole inside the component and does not touch it.
"""
import sys
import os
import numpy as np
from PIL import Image
from scipy import ndimage

NAVY = np.array([0, 39, 83])
K = 5


def pill_mask(path, tol=60):
    a = np.array(Image.open(path).convert("RGB")).astype(int)
    m = np.abs(a - NAVY).sum(axis=2) < tol
    e = ndimage.binary_erosion(m, np.ones((2 * K + 1, 2 * K + 1)))
    lab, n = ndimage.label(e)
    best, ba = None, 0
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) < 3000:
            continue
        cx, cy = xs.mean(), ys.mean()
        if not (600 < cx < 1300 and 300 < cy < 800):
            continue
        if len(xs) > ba:
            ba, best = len(xs), i
    if best is None:
        return None, None, None
    return (lab == best), m, ba


def report(path, label):
    e, full, area = pill_mask(path)
    if e is None:
        print(f"{label:>12}  NO PILL")
        return None
    ys, xs = np.nonzero(e)
    x0, x1, y0, y1 = xs.min() - K, xs.max() + K, ys.min() - K, ys.max() + K
    # straight-edge check: read the un-eroded mask along the mid row / mid column,
    # restricted to the pill's own bbox so rails cannot contaminate.
    ym, xm = (y0 + y1) // 2, (x0 + x1) // 2
    band = full[ym - 5:ym + 6, x0 - 25:x1 + 26]
    rx = np.nonzero(band.all(axis=0))[0]
    col = full[y0 - 25:y1 + 26, xm - 5:xm + 6]
    ry = np.nonzero(col.all(axis=1))[0]
    print(
        f"{label:>12}  x{x0}..{x1} w{x1-x0+1}   y{y0}..{y1} h{y1-y0+1}   fill {area}px"
        f"   midrow x{rx.min()+x0-25}..{rx.max()+x0-25}   midcol y{ry.min()+y0-25}..{ry.max()+y0-25}"
    )
    return dict(x0=int(x0), x1=int(x1), y0=int(y0), y1=int(y1))


def rows(path, label):
    """Row-by-row left/right edge of the fill — reads the corner radii directly."""
    e, full, _ = pill_mask(path)
    ys, xs = np.nonzero(e)
    x0, x1, y0, y1 = xs.min() - K, xs.max() + K, ys.min() - K, ys.max() + K
    print(f"--- {label}  x{x0}..{x1} y{y0}..{y1} ---")
    for y in list(range(y0, y0 + 16, 2)) + ["-"] + list(range(y1 - 15, y1 + 1, 2)):
        if y == "-":
            print("   ...")
            continue
        r = np.nonzero(full[y, x0 - 5:x1 + 6])[0]
        if len(r):
            print(f"  y{y:4d}  L{r.min()+x0-5:5d}  R{r.max()+x0-5:5d}  n{len(r)}")


if __name__ == "__main__":
    if sys.argv[1] == "rows":
        for p in sys.argv[2:]:
            rows(p, os.path.basename(p))
    else:
        for p in sys.argv[1:]:
            report(p, os.path.basename(p))
