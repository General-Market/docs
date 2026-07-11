#!/usr/bin/env python3
"""Re-trace the 7 mbadge (second-map) hexes at native display scale from the
clean settled frame regular_0254 (f3162 — all hexes drawn, NO badges).

For each hex: crop the hex bbox centred on the measured centre, paint everything
outside the hexagon polygon to background-blue (kills map-line + neighbour
intrusions at the rectangular corners), then hand the masked crop to trace.py.
Result: correct second-map building content at true native size (~215x190),
badge region left intact (the DOM badge composites over it, same as the ref).
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src_3162.png")
STORE = os.path.join(HERE, "..", "art-store.json")
TRACE = os.path.join(HERE, "..", "trace.py")
BLUE = (76, 160, 211)

# measured centres (navy-border + coverage solve, gen9)
HEXES = [
    ("mbHexHeli", 386, 410),
    ("mbHexOffice", 662, 248),
    ("mbHexBank", 577, 788),
    ("mbHexBank2", 1092, 418),
    ("mbHexTowers2", 916, 725),
    ("mbHexSail", 1513, 344),
    ("mbHexCity2", 1432, 768),
]
AW, AH = 216, 196  # crop = hexagon bbox (Hexagon w=216, h=0.906w~=196)


def hexpoints(w, h, grow=0.0):
    # matches ui.tsx hexPoints; grow expands outward from centre to keep border
    cx, cy = w / 2, h / 2
    pts = [
        (0.25 * w, 1.5), (0.75 * w, 1.5), (w - 1.5, h / 2),
        (0.75 * w, h - 1.5), (0.25 * w, h - 1.5), (1.5, h / 2),
    ]
    out = []
    for x, y in pts:
        dx, dy = x - cx, y - cy
        n = max((dx * dx + dy * dy) ** 0.5, 1e-6)
        out.append((x + dx / n * grow, y + dy / n * grow))
    return out


def run(only=None):
    im = Image.open(SRC).convert("RGB")
    for name, cx, cy in HEXES:
        if only and name not in only:
            continue
        x0, y0 = cx - AW // 2, cy - AH // 2
        crop = im.crop((x0, y0, x0 + AW, y0 + AH)).copy()
        # mask outside the (slightly grown) hexagon to blue
        mask = Image.new("L", (AW, AH), 0)
        ImageDraw.Draw(mask).polygon(hexpoints(AW, AH, grow=6.0), fill=255)
        bg = Image.new("RGB", (AW, AH), BLUE)
        crop = Image.composite(crop, bg, mask)
        mp = os.path.join(HERE, f"crop_{name}.png")
        crop.save(mp)
        subprocess.run(
            [sys.executable, TRACE, mp, "0", "0", str(AW), str(AH), name,
             "--out", STORE, "--colors", "#FFFFFF,#002753,#D45837,#A8A8A8"],
            check=True,
        )
    print("traced:", ", ".join(n for n, _, _ in HEXES if not only or n in only))


if __name__ == "__main__":
    only = sys.argv[1:] or None
    run(only)
