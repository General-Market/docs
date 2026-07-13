#!/usr/bin/env python3
"""Registration between two rectified slot crops: the shift that maps B onto A.
usage: cal.py <A.png> <B.png> [maskRightFrom]"""
import sys
import numpy as np
from PIL import Image

a = np.asarray(Image.open(sys.argv[1]).convert("L"), float)
b = np.asarray(Image.open(sys.argv[2]).convert("L"), float)
lo, hi = a.mean(), b.mean()
# ink = whatever departs from the local background (works on white AND navy grounds)
ai = np.abs(a - np.median(a)) > 45
bi = np.abs(b - np.median(b)) > 45
if len(sys.argv) > 3:
    k = int(sys.argv[3])
    ai[:, k:] = False
    bi[:, k:] = False
print("inkA", ai.sum(), "inkB", bi.sum(), "ratio %.3f" % (bi.sum() / max(1, ai.sum())))
best = (0, 0, 0)
for dx in range(-26, 27):
    for dy in range(-26, 27):
        s = (ai & np.roll(np.roll(bi, dy, 0), dx, 1)).sum()
        if s > best[0]:
            best = (s, dx, dy)
print("best roll of B: dx=%d dy=%d  overlap %d/%d = %.3f" %
      (best[1], best[2], best[0], ai.sum(), best[0] / max(1, ai.sum())))
