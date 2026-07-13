#!/usr/bin/env python3
"""Colour-separate a rectified 604x330 city slot and potrace each ink layer.

Law 19: a potrace of the ref's own vector art is compression-soft exactly as the ref
is soft and sits AT the SSIM ceiling. Edge POSITION is the only thing that matters —
never hand-redraw a design you can trace.

usage: trace.py <name> <above|below> [dx dy]
"""
import subprocess, sys, os, re
import numpy as np
from PIL import Image

W = os.path.dirname(os.path.abspath(__file__))
RED = np.array([204, 68, 30]); NAVY = np.array([11, 35, 65]); WHT = np.array([250, 250, 250])


def potrace(mask, name, layer, t="4"):
    pbm = f"{W}/trace/{name}_{layer}.pbm"
    svg = f"{W}/trace/{name}_{layer}.svg"
    Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).save(pbm)
    subprocess.run(["potrace", pbm, "-b", "svg", "-o", svg, "-u", "1",
                    "-a", "0.4", "-t", t, "-O", "0.35"], check=True)
    d = " ".join(re.findall(r'<path d="([^"]+)"', open(svg).read()))
    return re.sub(r"(\d)\.\d+", r"\1", d).replace("\n", " ")


name, band = sys.argv[1], sys.argv[2]
dx, dy = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (0, 0)
os.makedirs(f"{W}/trace", exist_ok=True)
im = np.asarray(Image.open(f"{W}/rect/{name}.png").convert("RGB"), dtype=float)
if dx or dy:
    im = np.roll(np.roll(im, dy, 0), dx, 1)
near = lambda c, t: np.linalg.norm(im - c, axis=2) < t
mx, mn = im.max(2), im.min(2)
grey = (mx - mn < 20) & (im.mean(2) > 182) & (im.mean(2) < 240)

# The hour chain lives in the crop but NOT in the art: S5Skyline draws its own ticks
# and labels from the lattice. Trace them in and every tick renders twice, 3px thick
# on top of 3px thick. Cut the two tick columns and the two label boxes out of the
# ink layers. Nothing is lost: ABOVE, the chain paints OVER the skyline (gen18), so
# whatever building ink sits under a tick is invisible anyway; BELOW, the tick is the
# same white as the outline art it would have filled.
def cut(m, tx, y0, y1, lx0, lx1, ly0, ly1):
    for t in tx:
        m[y0:y1, max(0, t - 4):t + 5] = False
        m[ly0:ly1, t + lx0:t + lx1] = False
    return m

if band == "above":
    grey[319:, :] = False                       # the band strip itself, not a slab
    tx = [80, 381]                              # world (ic-+0.5 h) -> slot-local
    g = cut(grey, tx, 6, 322, -6, 86, 0, 44)
    n = cut(near(NAVY, 62), tx, 6, 322, -6, 86, 0, 40)
    r = near(RED, 92)
    # The white tower BODIES are white on a white ground: no colour separates them. But
    # they are the only white that is ENCLOSED. Flood the background in from the top and
    # the sides with the band as a floor; whatever the flood cannot reach is a tower
    # interior. Those bodies are load-bearing — the rising instruction docs are drawn
    # BEHIND the clusters and it is the white fills that hide them until they clear the
    # tower base. Potrace the ink and lose the fills and every doc shows through its tower.
    ink = g | n | r
    ink[320:, :] = True                         # the band is a floor, not a doorway
    from collections import deque
    seen = np.zeros_like(ink)
    q = deque()
    for x in range(604):
        if not ink[0, x]: q.append((0, x)); seen[0, x] = True
    for y in range(330):
        for x in (0, 603):
            if not ink[y, x] and not seen[y, x]: q.append((y, x)); seen[y, x] = True
    while q:
        y, x = q.popleft()
        for dy2, dx2 in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy2, x + dx2
            if 0 <= yy < 330 and 0 <= xx < 604 and not ink[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True; q.append((yy, xx))
    fill = (~ink) & (~seen)
    fill[320:, :] = False
    layers = [("fill", fill), ("grey", g), ("navy", n), ("red", r)]
else:
    tx = [88, 390]
    m = near(WHT, 66); m[:9, :] = False         # band strip bleed at the slot's top
    r = near(RED, 100); r[:7, :] = False
    layers = [("white", cut(m, tx, 0, 318, -6, 88, 288, 330)), ("red", r)]

out = {}
for ln, m in layers:
    print(f"  {name} {ln}: {int(m.sum()):>6} px", end="")
    if m.sum() < 60:
        print("  (skip)"); continue
    d = potrace(m, name, ln, "40" if ln == "grey" else "4")
    print(f"   path {len(d)} chars")
    out[ln] = d
open(f"{W}/trace/{name}.json", "w").write(repr(out))
