#!/usr/bin/env python3
"""Eye montage: ref vs each top candidate at matched cap height, ink as dark
on white. One stacked PNG per clsnet crop so the eye can adjudicate CONTRAST
and letterform (the binary metric is contrast-blind — lesson 8)."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = "/Users/maxguillabert/Downloads/index/video/.claude/rounds"
FONTAB = f"{ROOT}/work/cls-shared/fontab"; G8 = f"{FONTAB}/gen8"; R8 = f"{ROOT}/work/clsnet/r8"
CANDS = ["HoeflerText", "Georgia", "Charter", "Baskerville", "Didot", "Bodoni72",
         "BigCaslon", "TimesNR", "STIXsys", "Prata", "PlayfairDisp", "DMSerifDisp",
         "NotoSerifDisp", "Newsreader", "SourceSerif4", "Spectral", "PTSerif", "Lora"]
FS = 200; PITCH = int(FS * 1.5); TOP0 = 40
CAP = 150  # display cap height in montage
lab = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 26)


def ink_gray(im_rgb, mode):
    """return float ink coverage 0..1 (1=full ink) as dark-on-white gray."""
    a = im_rgb.astype(float)
    if mode == "dark":
        cov = np.clip((255 - a.mean(2)) / 200, 0, 1)
    elif mode == "white":
        cov = np.clip((a.mean(2) - 40) / 180, 0, 1)
    elif mode == "orange":
        d = np.abs(a - np.array([212, 88, 55])).sum(2)
        cov = np.clip(1 - d / 260, 0, 1)
    return cov


def trim_cov(cov, thr=0.35):
    m = cov > thr
    r = np.any(m, 1); c = np.any(m, 0)
    if not r.any():
        return None
    r0, r1 = np.where(r)[0][[0, -1]]; c0, c1 = np.where(c)[0][[0, -1]]
    return cov[r0:r1 + 1, c0:c1 + 1]


def capnorm(cov, cap):
    s = cap / cov.shape[0]
    im = Image.fromarray((cov * 255).astype(np.uint8)).resize(
        (max(1, round(cov.shape[1] * s)), cap), Image.LANCZOS)
    return np.array(im).astype(float) / 255


def rows(still, mode):
    im = np.array(Image.open(still).convert("RGB")); out = {}
    for i, n in enumerate(CANDS):
        y0 = TOP0 + i * PITCH - 30; y1 = TOP0 + i * PITCH + 290
        out[n] = trim_cov(ink_gray(im[max(0, y0):y1], mode))
    return out


def build(label, still, refpng, box, mode, order):
    ri = np.array(Image.open(refpng).convert("RGB"))
    if box:
        x, y, w, h = box; ri = ri[y:y + h, x:x + w]
    ref = capnorm(trim_cov(ink_gray(ri, mode)), CAP)
    cr = rows(still, mode)
    gap = 40; labw = 210; colw = labw + 720
    rowh = CAP + 40
    canvas = Image.new("RGB", (colw, rowh * (len(order) + 1)), "white")
    dr = ImageDraw.Draw(canvas)

    def paste(gray, x, y):
        g = (255 - gray * 255).astype(np.uint8)
        canvas.paste(Image.fromarray(g, "L").convert("RGB"), (x, y))
    dr.text((10, 10), "REF", font=lab, fill="red")
    paste(ref, labw, 20)
    for k, name in enumerate(order):
        yy = rowh * (k + 1)
        dr.text((10, yy + 10), name, font=lab, fill="black")
        c = cr.get(name)
        if c is not None:
            paste(capnorm(c, CAP), labw, yy + 20)
    out = f"{G8}/montage-{label}.png"; canvas.save(out); print("saved", out, canvas.size)


build("CLSNet", f"{G8}/stills/net-CLSNet.png", f"{R8}/ref_112.png", (120, 455, 680, 170), "white",
      ["PlayfairDisp", "Charter", "Prata", "DMSerifDisp", "NotoSerifDisp", "Newsreader", "Georgia"])
build("AED", f"{G8}/stills/net-AED.png", f"{R8}/ref_3500.png", (1340, 80, 300, 120), "orange",
      ["Charter", "Prata", "PTSerif", "DMSerifDisp", "PlayfairDisp", "NotoSerifDisp", "Georgia"])
