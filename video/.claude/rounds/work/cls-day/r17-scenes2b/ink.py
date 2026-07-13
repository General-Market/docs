#!/usr/bin/env python3
"""Per-element ink counts across a frame sweep. S13 entrance clock.

usage: ink.py <dir> <f0> <f1>
Prints one row per frame: navy/red counts inside each element's bbox.
"""
import sys, os
import numpy as np
from PIL import Image

# element bboxes in comp coords (x0,y0,x1,y1)
BOX = {
    "band":  (0, 2, 880, 55),      # S13 band body at y0..57 (S12's band sits at y88)
    "bandR": (1040, 2, 1920, 55),  # right half (avoid S12's marker triangle at x958 y27..87)
    "pill":  (770, 445, 1130, 640),
    "lcity": (0, 220, 500, 700),
    "rcity": (1420, 390, 1920, 860),
    "railT": (470, 280, 900, 302),
    "railB": (1010, 760, 1420, 782),
    "below": (0, 130, 1920, 1080),  # everything below the band
}


def classes(a):
    r = a[:, :, 0].astype(int); g = a[:, :, 1].astype(int); b = a[:, :, 2].astype(int)
    navy = (b > r + 20) & (r + g + b < 430)
    red = (r - g > 60) & (r - b > 60) & (r > 120)
    return navy, red


def main():
    d, f0, f1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    keys = sys.argv[4].split(",") if len(sys.argv) > 4 else list(BOX)
    print("frame " + " ".join(f"{k}:N/R".rjust(14) for k in keys))
    for f in range(f0, f1 + 1):
        p = os.path.join(d, f"f{f}.png")
        if not os.path.exists(p):
            continue
        a = np.array(Image.open(p).convert("RGB"))
        navy, red = classes(a)
        cells = []
        for k in keys:
            x0, y0, x1, y1 = BOX[k]
            n = int(navy[y0:y1, x0:x1].sum()); rr = int(red[y0:y1, x0:x1].sum())
            cells.append(f"{n:7d}/{rr:6d}")
        print(f"{f:5d} " + " ".join(cells))


if __name__ == "__main__":
    main()
