#!/usr/bin/env python3
"""Whole-frame + crop SSIM (gaussian, same as skimage default), no deps beyond numpy/PIL."""
import sys
import numpy as np
from PIL import Image

def ssim(a, b):
    from scipy.ndimage import gaussian_filter
    a = a.astype(np.float64); b = b.astype(np.float64)
    C1, C2 = (0.01*255)**2, (0.03*255)**2
    s = 1.5
    ua = gaussian_filter(a, s); ub = gaussian_filter(b, s)
    uaa = gaussian_filter(a*a, s); ubb = gaussian_filter(b*b, s); uab = gaussian_filter(a*b, s)
    va = uaa-ua*ua; vb = ubb-ub*ub; vab = uab-ua*ub
    S = ((2*ua*ub+C1)*(2*vab+C2))/((ua*ua+ub*ub+C1)*(va+vb+C2))
    return float(S.mean())

def load(p, box=None):
    im = Image.open(p).convert("L")
    if box: im = im.crop(box)
    return np.asarray(im)

if __name__ == "__main__":
    ref, att = sys.argv[1], sys.argv[2]
    box = None
    if len(sys.argv) > 3:
        box = tuple(map(int, sys.argv[3].split(",")))  # x0,y0,x1,y1
    print(f"{ssim(load(ref, box), load(att, box)):.6f}")
