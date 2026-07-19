#!/usr/bin/env python3
"""Whole-frame (or cropped) SSIM: ref refall/f<N>.png vs attempt still.
Usage: ab.py ATTDIR FRAME [FRAME...] [--prefix att-] [--crop X Y W H]"""
import sys
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim

REF = "/Users/maxguillabert/Downloads/index/video/.claude/rounds/work/lseg/refall"

args = sys.argv[1:]
crop = None
if "--crop" in args:
    i = args.index("--crop")
    crop = tuple(int(v) for v in args[i + 1:i + 5])
    args = args[:i] + args[i + 5:]
attdir = args[0]
for f in args[1:]:
    ref = Image.open(f"{REF}/f{f}.png").convert("L")
    att = Image.open(f"{attdir}/att-{f}.png").convert("L")
    if att.size != ref.size:
        att = att.resize(ref.size, Image.LANCZOS)
    if crop:
        x, y, w, h = crop
        ref = ref.crop((x, y, x + w, y + h))
        att = att.crop((x, y, x + w, y + h))
    r, a = np.asarray(ref), np.asarray(att)
    print(f"f{f} ssim={ssim(r, a):.4f}")
