#!/usr/bin/env python3
"""Ink profile: for a colour class in a bbox, print row and column runs of high count.
usage: prof.py <img> <x0> <y0> <x1> <y1> <class> [minfrac]"""
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from probe_city import classify  # noqa

p = sys.argv[1]
x0, y0, x1, y1 = map(int, sys.argv[2:6])
name = sys.argv[6]
minf = float(sys.argv[7]) if len(sys.argv) > 7 else 0.35
a = np.array(Image.open(p).convert("RGB"))[y0:y1, x0:x1]
m = (classify(a) == name)
W = x1 - x0
H = y1 - y0
print(f"{p} {name} in {x0},{y0}..{x1},{y1}  total {m.sum()}px")
for axis, lbl, n, off in ((1, "ROW y", H, y0), (0, "COL x", W, x0)):
    cnt = m.sum(axis=axis)
    span = m.shape[1 - axis]
    th = max(6, minf * span)
    runs = []
    i = 0
    while i < n:
        if cnt[i] >= th:
            j = i
            while j < n and cnt[j] >= th:
                j += 1
            # extent of ink along the other axis within this run
            sub = m[i:j, :] if axis == 1 else m[:, i:j]
            idx = np.where(sub.any(axis=0 if axis == 1 else 1))[0]
            lo = idx.min() + (x0 if axis == 1 else y0)
            hi = idx.max() + (x0 if axis == 1 else y0)
            runs.append(f"{lbl} {i+off}..{j+off} (n={j-i}) peak={cnt[i:j].max()} ext {lo}..{hi}")
            i = j
        else:
            i += 1
    print(f"  -- {lbl} runs (thr {th:.0f}/{span})")
    for r in runs:
        print("     " + r)
