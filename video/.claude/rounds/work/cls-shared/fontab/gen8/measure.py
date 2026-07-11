#!/usr/bin/env python3
"""GEN-8 IN-RENDER measure. Crops each candidate row from the FontLab stills
(Chromium-rendered) and compares to the ref glyph crop. Same binary-overlap
truediff as the prefilter, but now on Chromium ink — this is the number the
frame actually pays (Pillow hid ~7% of the width). Lower shp = better.

  shpT = cap-normalized, TRUE width overlap diff (penalizes wide faces)
  shpW = cap-normalized AND width-matched overlap diff (pure letterform)
  w/r  = Chromium natural width / ref width at matched cap
"""
import numpy as np
from PIL import Image

ROOT = "/Users/maxguillabert/Downloads/index/video/.claude/rounds"
FONTAB = f"{ROOT}/work/cls-shared/fontab"
G8 = f"{FONTAB}/gen8"
R8 = f"{ROOT}/work/clsnet/r8"

# MUST match FontLab.tsx CANDS order
CANDS = ["HoeflerText", "Georgia", "Charter", "Baskerville", "Didot", "Bodoni72",
         "BigCaslon", "TimesNR", "STIXsys", "Prata", "PlayfairDisp", "DMSerifDisp",
         "NotoSerifDisp", "Newsreader", "SourceSerif4", "Spectral", "PTSerif", "Lora"]
CUR = {"HoeflerText": " (cls-day cur)", "Georgia": " (clsnet cur)"}

FS = 200
PITCH = int(FS * 1.5)
TOP0 = 40


def mask_rgb(a, mode):
    a = a.astype(int)
    g = a.mean(2)
    if mode == "dark":
        return g < 150
    if mode == "white":
        return (a > 200).all(2)
    if mode == "orange":
        return np.abs(a - np.array([212, 88, 55])).sum(2) < 170


def trim(m):
    r = np.any(m, 1); c = np.any(m, 0)
    if not r.any():
        return None
    r0, r1 = np.where(r)[0][[0, -1]]; c0, c1 = np.where(c)[0][[0, -1]]
    return m[r0:r1 + 1, c0:c1 + 1]


def scale_to(a, cap, w=None):
    s = cap / a.shape[0]
    nw = round(a.shape[1] * s) if w is None else w
    im = Image.fromarray((a * 255).astype(np.uint8)).resize((max(1, nw), max(1, round(a.shape[0] * s))), Image.LANCZOS)
    return np.array(im) > 128


def overlap(ref, c):
    H = max(ref.shape[0], c.shape[0]); W = max(ref.shape[1], c.shape[1])
    R = np.zeros((H, W), bool); A = np.zeros((H, W), bool)
    R[:ref.shape[0], :ref.shape[1]] = ref; A[:c.shape[0], :c.shape[1]] = c
    return float(np.mean(R != A))


def load_ref(png, box, mode):
    im = np.array(Image.open(png).convert("RGB"))
    if box:
        x, y, w, h = box; im = im[y:y + h, x:x + w]
    return trim(mask_rgb(im, mode))


def rows(still_png, mode):
    im = np.array(Image.open(still_png).convert("RGB"))
    out = []
    for i in range(len(CANDS)):
        y0 = TOP0 + i * PITCH - 30; y1 = TOP0 + i * PITCH + 290
        band = im[max(0, y0):min(im.shape[0], y1)]
        out.append(trim(mask_rgb(band, mode)))
    return out


JOBS = [
    ("day-USD", f"{G8}/stills/day-USD.png", f"{FONTAB}/day-ref.png", None, "dark", "dark", "USD"),
    ("net-CLSNet", f"{G8}/stills/net-CLSNet.png", f"{R8}/ref_112.png", (120, 455, 680, 170), "white", "white", "CLSNet"),
    ("net-AED", f"{G8}/stills/net-AED.png", f"{R8}/ref_3500.png", (1340, 80, 300, 120), "orange", "orange", "AED"),
]

for label, still, refpng, box, refmode, candmode, text in JOBS:
    ref = load_ref(refpng, box, refmode)
    cr = rows(still, candmode)
    print(f"\n===== {label} '{text}'  ref ink {ref.shape[1]}x{ref.shape[0]} =====")
    print(f"  {'face':16s} {'shpT':>6s} {'shpW':>6s} {'w/r':>5s}")
    res = []
    for name, cand in zip(CANDS, cr):
        if cand is None:
            print(f"  {name:16s}  (no ink)"); continue
        cT = scale_to(cand, ref.shape[0]); wr = cT.shape[1] / ref.shape[1]
        cW = scale_to(cand, ref.shape[0], ref.shape[1])
        res.append((overlap(ref, cT), name, overlap(ref, cW), wr))
    for st, name, sw, wr in sorted(res):
        flag = CUR.get(name, "")
        print(f"  {name:16s} {st:6.3f} {sw:6.3f} {wr:5.2f}{flag}")
