#!/usr/bin/env python3
"""Classify a frame region into palette classes and list connected components.
usage: probe_city.py <png> <x0> <y0> <x1> <y1> [class]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

CL = {
    "navy": (11, 35, 65),
    "red": (204, 68, 30),
    "cream": (242, 199, 169),
    "blue": (0, 113, 227),
}


def classify(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    v = (r + g + b) / 3
    sat = a.max(2).astype(int) - a.min(2).astype(int)
    out = np.full(a.shape[:2], "white", dtype=object)
    out[(sat < 22) & (v < 246) & (v > 175)] = "grey"
    out[(sat < 40) & (v <= 175)] = "navy"
    for name, c in CL.items():
        d = np.sqrt(((a[..., :3].astype(int) - np.array(c)) ** 2).sum(2))
        out[d < (42 if name == "cream" else 70)] = name
    return out


def main():
    p = sys.argv[1]
    x0, y0, x1, y1 = map(int, sys.argv[2:6])
    want = sys.argv[6] if len(sys.argv) > 6 else None
    a = np.array(Image.open(p).convert("RGB"))[y0:y1, x0:x1]
    cls = classify(a)
    for name in (["grey", "navy", "red", "cream", "blue"] if not want else [want]):
        m = cls == name
        print(f"== {name}: {m.sum()} px")
        lab, n = ndimage.label(m, structure=np.ones((3, 3)))
        comps = []
        for i, sl in enumerate(ndimage.find_objects(lab), 1):
            area = (lab[sl] == i).sum()
            if area < 120:
                continue
            comps.append((area, sl))
        comps.sort(reverse=True, key=lambda t: t[0])
        for area, sl in comps[:14]:
            ys, xs = sl
            print(f"   area {area:6d}  x {xs.start+x0}..{xs.stop+x0}  y {ys.start+y0}..{ys.stop+y0}"
                  f"  ({xs.stop-xs.start}x{ys.stop-ys.start})")


if __name__ == "__main__":
    main()
