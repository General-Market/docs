#!/usr/bin/env python3
"""Spatial SSIM triage — WHERE inside the frame the score is lost.

Splits ref/attempt frames into an N×M grid and scores each cell
(single-window SSIM per cell — coarse by design; it ranks regions,
it does not certify them). Worst cells first, with pixel rects you
can feed straight to `magick ... -crop WxH+X+Y` or a diff composite.

Usage:
  ssim-grid.py <ref.png> <att.png> [--grid 8x6] [--top 10] [--all]

Multi-frame sweep (rank cells summed over several frames — finds the
PERSISTENT offenders, not one frame's noise):
  ssim-grid.py --pairs pairs.txt [--grid 8x6] [--top 10]
  # pairs.txt: one "ref.png att.png" per line
"""
import argparse
import sys

import numpy as np
from PIL import Image

C1 = (0.01 * 255) ** 2
C2 = (0.03 * 255) ** 2


def load(path):
    return np.asarray(Image.open(path).convert("L"), dtype=np.float64)


def cell_ssim(a, b):
    ma, mb = a.mean(), b.mean()
    va, vb = a.var(), b.var()
    cov = ((a - ma) * (b - mb)).mean()
    return ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma**2 + mb**2 + C1) * (va + vb + C2))


def grid_scores(ref, att, cols, rows):
    if ref.shape != att.shape:
        att_img = Image.fromarray(att.astype(np.uint8)).resize(
            (ref.shape[1], ref.shape[0]), Image.LANCZOS)
        att = np.asarray(att_img, dtype=np.float64)
    H, W = ref.shape
    out = []
    for r in range(rows):
        for c in range(cols):
            y0, y1 = H * r // rows, H * (r + 1) // rows
            x0, x1 = W * c // cols, W * (c + 1) // cols
            s = cell_ssim(ref[y0:y1, x0:x1], att[y0:y1, x0:x1])
            out.append((s, r, c, x0, y0, x1 - x0, y1 - y0))
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("frames", nargs="*", help="ref.png att.png")
    p.add_argument("--pairs", help="file of 'ref att' lines for a multi-frame sweep")
    p.add_argument("--grid", default="8x6", help="COLSxROWS (default 8x6)")
    p.add_argument("--top", type=int, default=10)
    p.add_argument("--all", action="store_true", help="print every cell as a heatmap table")
    a = p.parse_args()
    cols, rows = (int(v) for v in a.grid.lower().split("x"))

    if a.pairs:
        pairs = [ln.split() for ln in open(a.pairs) if ln.strip()]
    elif len(a.frames) == 2:
        pairs = [a.frames]
    else:
        p.error("give <ref> <att> or --pairs")

    acc = {}
    for ref_p, att_p in pairs:
        for s, r, c, x, y, w, h in grid_scores(load(ref_p), load(att_p), cols, rows):
            k = (r, c)
            e = acc.setdefault(k, [0.0, 0, (x, y, w, h)])
            e[0] += s
            e[1] += 1

    cells = sorted(
        ((v[0] / v[1], k[0], k[1], *v[2]) for k, v in acc.items()))
    n = len(pairs)
    mean_all = sum(c[0] for c in cells) / len(cells)
    print(f"pairs={n} grid={cols}x{rows} cell_ssim_mean={mean_all:.4f}")

    if a.all:
        for r in range(rows):
            row = [f"{next(c[0] for c in cells if c[1]==r and c[2]==cc):.3f}"
                   for cc in range(cols)]
            print("  " + " ".join(row))

    print(f"{'rank':>4} {'ssim':>7} {'cell':>6} {'crop (WxH+X+Y)':>20}")
    for i, (s, r, c, x, y, w, h) in enumerate(cells[: a.top], 1):
        print(f"{i:>4} {s:>7.4f} r{r}c{c:<3} {w:>6}x{h}+{x}+{y}")


if __name__ == "__main__":
    main()
