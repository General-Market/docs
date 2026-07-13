from PIL import Image
import sys, numpy as np
def prof(p, x0, x1, y0, y1, tag):
    a = np.asarray(Image.open(p).convert("L"), dtype=np.int16)[y0:y1, x0:x1]
    dark = (a < 140)
    print(f"--- {tag} ---")
    for i, r in enumerate(dark):
        n = int(r.sum())
        if n: print(f"  y{y0+i:4d} {n:3d} {'#'*min(n,60)}")
D=".claude/rounds/work/cls-day/r18-lib/"
# 09:00 milestone: bold time row only (x just right of the red tick, before label words widen)
prof(D+"refs/f3340.png", 962, 1060, 118, 200, "REF  milestone 09:00 block")
prof(D+"tmp/f3340.png",  962, 1060, 118, 200, "OURS milestone 09:00 block (no double-print)")
prof(D+"refs/f3340.png", 817, 915, 118, 200, "REF  plain hour 08:00")
prof(D+"tmp/f3340.png",  817, 915, 118, 200, "OURS plain hour 08:00")
