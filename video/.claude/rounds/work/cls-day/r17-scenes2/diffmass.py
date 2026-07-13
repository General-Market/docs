#!/usr/bin/env python3
"""Ink-difference mass per grid cell, averaged over frames.
usage: diffmass.py <gridW> <gridH> <ref1> <att1> [<ref2> <att2> ...]"""
import sys
import numpy as np
from PIL import Image

gw, gh = int(sys.argv[1]), int(sys.argv[2])
files = sys.argv[3:]
acc = None
for i in range(0, len(files), 2):
    a = np.array(Image.open(files[i]).convert("RGB")).astype(int)
    b = np.array(Image.open(files[i + 1]).convert("RGB")).astype(int)
    d = np.abs(a - b).sum(2)
    acc = d if acc is None else acc + d
acc = acc / (len(files) // 2)
H, W = acc.shape
ch, cw = H // gh, W // gw
cells = []
for r in range(gh):
    for c in range(gw):
        m = acc[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw].sum()
        cells.append((m, r, c))
tot = sum(m for m, _, _ in cells)
cells.sort(reverse=True)
print(f"total diff mass {tot/1e6:.1f}M over {len(files)//2} frames")
for m, r, c in cells[:14]:
    print(f"  {100*m/tot:5.1f}%  r{r}c{c}  crop {cw}x{ch}+{c*cw}+{r*ch}")
