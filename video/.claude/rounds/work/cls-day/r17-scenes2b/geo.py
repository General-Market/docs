#!/usr/bin/env python3
"""Per-frame geometry of the S13 entrance: band, pill, capsules, rails."""
import sys, os
import numpy as np
from PIL import Image


def masks(a):
    r = a[:, :, 0].astype(int); g = a[:, :, 1].astype(int); b = a[:, :, 2].astype(int)
    navy = (b > r + 20) & (r + g + b < 430)
    red = (r - g > 60) & (r - b > 60) & (r > 120)
    grey = (abs(r - g) < 12) & (abs(g - b) < 12) & (r > 195) & (r < 235)
    return navy, red, grey


def bbox(m):
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max()), len(xs)


def main():
    d, f0, f1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    print(f"{'f':>5} {'bandY':>9} {'pill x0..x1 / y0..y1 (w,h)':>32} {'Lcap x0..x1':>13} {'Rcap x0..x1':>13} "
          f"{'railT x0':>8} {'railB x1':>8}")
    for f in range(f0, f1 + 1):
        p = os.path.join(d, f"f{f}.png")
        if not os.path.exists(p):
            continue
        a = np.array(Image.open(p).convert("RGB"))
        navy, red, grey = masks(a)
        # grey band: rows in 0..150 whose grey coverage > 60% of width
        cov = grey[0:160, :].sum(axis=1) / 1920.0
        rows = np.nonzero(cov > 0.6)[0]
        band = f"{rows.min()}..{rows.max()}" if len(rows) else "-"
        # pill: dense navy columns/rows in the middle
        sub = navy[150:900, 600:1400]
        cs = sub.sum(axis=0); rs = sub.sum(axis=1)
        pc = np.nonzero(cs > 40)[0]; pr = np.nonzero(rs > 40)[0]
        if len(pc) and len(pr):
            px0, px1 = pc.min() + 600, pc.max() + 600
            py0, py1 = pr.min() + 150, pr.max() + 150
            pill = f"{px0:4d}..{px1:4d}/{py0:3d}..{py1:3d}({px1-px0:3d},{py1-py0:3d})"
        else:
            pill = "-"
        ink = navy | red
        L = bbox(ink[140:900, 0:640]); R = bbox(ink[140:900, 1280:1920])
        Ls = f"{L[0]:4d}..{L[1]:4d}" if L else "     -"
        Rs = f"{R[0]+1280:4d}..{R[1]+1280:4d}" if R else "     -"
        rt = np.nonzero(navy[275:305, 380:940].any(axis=0))[0]
        rb = np.nonzero(navy[755:785, 980:1540].any(axis=0))[0]
        rts = f"{rt.min()+380:5d}" if len(rt) else "    -"
        rbs = f"{rb.max()+980:5d}" if len(rb) else "    -"
        print(f"{f:5d} {band:>9} {pill:>32} {Ls:>13} {Rs:>13} {rts:>8} {rbs:>8}")


if __name__ == "__main__":
    main()
