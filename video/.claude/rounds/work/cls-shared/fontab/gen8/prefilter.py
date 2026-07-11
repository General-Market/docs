#!/usr/bin/env python3
"""GEN-8 serif prefilter — Pillow shape+width screen across the FULL field
(11 macOS system faces + 10 Google display/text serifs), both lanes.

This is a FILTER ONLY. The campaign law: Pillow understates Chromium width
~7% and hides aspect — never adopt on these numbers. Use them to pick the
top ~4 shape+width contenders per lane, then screen IN-RENDER.

Per candidate/crop it reports:
  shpT  = shape diff at matched cap, TRUE width (penalizes wide faces —
          this is closest to 'what the frame pays' before any scaleX)
  shpW  = shape diff at matched cap AND width-matched (pure letterform;
          how good it gets after a per-face scaleX squeeze)
  w/r   = natural width / ref width at matched cap (distortion a scaleX
          would need; Pillow reads ~7% narrow vs Chromium, so bias narrow)
"""
import numpy as np
from PIL import Image, ImageFont, ImageDraw

ROOT = "/Users/maxguillabert/Downloads/index/video/.claude/rounds"
REF = f"{ROOT}/work/cls-day/ref"
FONTAB = f"{ROOT}/work/cls-shared/fontab"
R8 = f"{ROOT}/work/clsnet/r8"
SUP = "/System/Library/Fonts/Supplemental"
G = f"{FONTAB}/gen8/ttf"

SYS = [
    ("Georgia*", f"{SUP}/Georgia.ttf", 0),          # clsnet current
    ("Hoefler Text*", f"{SUP}/Hoefler Text.ttc", 0),# cls-day current
    ("Times NR", f"{SUP}/Times New Roman.ttf", 0),
    ("Didot", f"{SUP}/Didot.ttc", 0),
    ("Bodoni 72", f"{SUP}/Bodoni 72.ttc", 0),
    ("Baskerville", f"{SUP}/Baskerville.ttc", 0),
    ("Big Caslon", f"{SUP}/BigCaslon.ttf", 0),
    ("Charter", f"{SUP}/Charter.ttc", 0),
    ("STIX Two (sys)", f"{SUP}/STIXTwoText.ttf", 0),
]
GG = [
    ("Prata", f"{G}/Prata.ttf", 0),
    ("Playfair Disp", f"{G}/PlayfairDisplay.ttf", 0),
    ("DM Serif Disp", f"{G}/DMSerifDisplay.ttf", 0),
    ("Noto Serif Disp", f"{G}/NotoSerifDisplay.ttf", 0),
    ("Newsreader", f"{G}/Newsreader.ttf", 0),
    ("Source Serif 4", f"{G}/SourceSerif4.ttf", 0),
    ("Spectral", f"{G}/Spectral.ttf", 0),
    ("PT Serif", f"{G}/PTSerif.ttf", 0),
    ("Lora", f"{G}/Lora.ttf", 0),
    ("STIX Two (goog)", f"{G}/STIXTwoText.ttf", 0),
]
CANDS = SYS + GG


def render_text(path, idx, text, px=400):
    font = ImageFont.truetype(path, px, index=idx)
    img = Image.new("L", (px * (len(text) + 3), px * 3), 0)
    ImageDraw.Draw(img).text((px // 2, px // 2), text, font=font, fill=255)
    return np.array(img) > 128


def trim(a):
    rows = np.any(a, 1); cols = np.any(a, 0)
    if not rows.any():
        return None
    r0, r1 = np.where(rows)[0][[0, -1]]; c0, c1 = np.where(cols)[0][[0, -1]]
    return a[r0:r1 + 1, c0:c1 + 1]


def load_region(png, box, mode):
    im = np.array(Image.open(png).convert("RGB")).astype(int)
    if box:
        x, y, w, h = box; im = im[y:y + h, x:x + w]
    g = im.mean(2)
    if mode == "dark":
        return g < 150
    if mode.startswith("bright"):
        return g > int(mode[6:])
    if mode == "white":
        return (im > 200).all(2)
    if mode == "orange":
        return np.abs(im - np.array([212, 88, 55])).sum(2) < 150


def scale_to(a, cap, w=None):
    s = cap / a.shape[0]
    nw = round(a.shape[1] * s) if w is None else w
    nh = max(1, round(a.shape[0] * s)); nw = max(1, nw)
    im = Image.fromarray((a * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
    return np.array(im) > 128


def diff(ref, c):
    H = max(ref.shape[0], c.shape[0]); W = max(ref.shape[1], c.shape[1])
    R = np.zeros((H, W), bool); A = np.zeros((H, W), bool)
    R[:ref.shape[0], :ref.shape[1]] = ref; A[:c.shape[0], :c.shape[1]] = c
    return float(np.mean(R != A))


# (label, png, box, mode, text, lane)
CROPS = [
    ("USD",        f"{FONTAB}/day-ref.png", None,                 "dark",      "USD",        "day"),
    ("8.0",        f"{REF}/f2980.png",      (115, 548, 330, 200), "dark",      "8.0",        "day"),
    ("96%",        f"{REF}/f1300.png",      (1180, 435, 380, 160),"bright200", "96%",        "day"),
    ("Settlement", f"{REF}/f3650.png",      (560, 840, 230, 65),  "bright140", "Settlement", "day"),
    ("CLSNet",     f"{R8}/ref_112.png",     (120, 455, 680, 170), "white",     "CLSNet",     "net"),
    ("AED",        f"{R8}/ref_3500.png",    (1340, 80, 300, 120), "orange",    "AED",        "net"),
]

lane_shpT = {c[0]: {"day": [], "net": []} for c in CANDS}
lane_shpW = {c[0]: {"day": [], "net": []} for c in CANDS}
for label, png, box, mode, text, lane in CROPS:
    ref = trim(load_region(png, box, mode))
    print(f"\n=== {lane} '{label}' | ref ink {ref.shape[1]}x{ref.shape[0]} ===")
    print(f"    {'face':17s} {'shpT':>6s} {'shpW':>6s} {'w/r':>5s}")
    rows = []
    for name, path, idx in CANDS:
        try:
            cand = trim(render_text(path, idx, text))
        except Exception as e:
            print(f"    {name:17s} FAIL {e}"); continue
        cT = scale_to(cand, ref.shape[0])
        wr = cT.shape[1] / ref.shape[1]
        cW = scale_to(cand, ref.shape[0], ref.shape[1])
        st = diff(ref, cT); sw = diff(ref, cW)
        lane_shpT[name][lane].append(st); lane_shpW[name][lane].append(sw)
        rows.append((st, name, sw, wr))
    for st, name, sw, wr in sorted(rows):
        print(f"    {name:17s} {st:6.3f} {sw:6.3f} {wr:5.2f}")

for lane in ("day", "net"):
    print(f"\n########## LANE {lane}: mean over crops (ranked by shpT) ##########")
    print(f"    {'face':17s} {'shpT':>6s} {'shpW':>6s}")
    means = []
    for name, _, _ in CANDS:
        v = lane_shpT[name][lane]
        if v:
            means.append((np.mean(v), name, np.mean(lane_shpW[name][lane])))
    for m, name, mw in sorted(means):
        print(f"    {name:17s} {m:6.3f} {mw:6.3f}")
