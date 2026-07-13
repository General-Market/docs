#!/usr/bin/env python3
"""Diff mass inside a bbox on a fine grid, averaged over frame pairs.
usage: dm2.py <x0> <y0> <x1> <y1> <cell> <ref1> <att1> [...]"""
import sys
import numpy as np
from PIL import Image

x0, y0, x1, y1, cell = map(int, sys.argv[1:6])
files = sys.argv[6:]
acc = None
for i in range(0, len(files), 2):
    a = np.array(Image.open(files[i]).convert("RGB")).astype(int)[y0:y1, x0:x1]
    b = np.array(Image.open(files[i + 1]).convert("RGB")).astype(int)[y0:y1, x0:x1]
    d = np.abs(a - b).sum(2)
    acc = d if acc is None else acc + d
acc = acc / (len(files) // 2)
H, W = acc.shape
cells = []
for r in range(0, H, cell):
    for c in range(0, W, cell):
        cells.append((acc[r:r + cell, c:c + cell].sum(), c + x0, r + y0))
tot = sum(m for m, _, _ in cells)
cells.sort(reverse=True)
print(f"bbox {x0},{y0}..{x1},{y1}  total {tot/1e6:.2f}M")
for m, cx, cy in cells[:18]:
    print(f"  {100*m/tot:5.1f}%  {m/1e3:8.1f}k  crop {cell}x{cell}+{cx}+{cy}")
