#!/usr/bin/env python3
"""Best rigid shift (and optional uniform scale) of ATT ink onto REF ink in a bbox.
usage: reg.py <ref> <att> <x0> <y0> <x1> <y1> [maxshift] [--scale]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

ref, att = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(int, sys.argv[3:7])
R = int(sys.argv[7]) if len(sys.argv) > 7 else 20
doscale = "--scale" in sys.argv

pad = R + 6


def ink(p):
    a = np.array(Image.open(p).convert("L")).astype(float)
    return 1.0 - a / 255.0  # 0 white, 1 black


A = ink(ref)
B = ink(att)
r = A[y0:y1, x0:x1]
best = None
for dy in range(-R, R + 1):
    for dx in range(-R, R + 1):
        b = B[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
        s = float(((r - b) ** 2).sum())
        if best is None or s < best[0]:
            best = (s, dx, dy)
s0 = float(((r - B[y0:y1, x0:x1]) ** 2).sum())
print(f"bbox {x0},{y0}..{x1},{y1}  ssd@0 = {s0/1000:.1f}k")
print(f"best shift dx={best[1]:+d} dy={best[2]:+d}  ssd = {best[0]/1000:.1f}k  ({100*(1-best[0]/s0):.1f}% better)")
if doscale:
    bs = None
    for sc in np.arange(0.90, 1.111, 0.01):
        Bz = ndimage.zoom(B, sc, order=1)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        for dy in range(-R, R + 1, 2):
            for dx in range(-R, R + 1, 2):
                ox = int(round(cx * sc - cx)) + dx
                oy = int(round(cy * sc - cy)) + dy
                if y0 + oy < 0 or x0 + ox < 0 or y1 + oy > Bz.shape[0] or x1 + ox > Bz.shape[1]:
                    continue
                b = Bz[y0 + oy:y1 + oy, x0 + ox:x1 + ox]
                s = float(((r - b) ** 2).sum())
                if bs is None or s < bs[0]:
                    bs = (s, sc, dx, dy)
    print(f"best scale {bs[1]:.2f} dx={bs[2]:+d} dy={bs[3]:+d} ssd={bs[0]/1000:.1f}k ({100*(1-bs[0]/s0):.1f}% better)")
