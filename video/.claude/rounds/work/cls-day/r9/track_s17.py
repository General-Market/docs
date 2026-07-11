#!/usr/bin/env python3
"""Track the S17 pan per frame (r9). Two strips:
  BAND    y 95..165  (grey timeline band + hour ticks + red milestone ticks)
  DIAGRAM y 600..900 (pill/shield/rows — should be ~static in the body)
Method = r4 track_pan: vertical-edge energy profile, chained cross-corr,
sub-pixel parabola, integrated cumulative dx. Content moving left => dx<0.
Also: red-column detector to anchor absolute x(07:00) of the band.
"""
import numpy as np
from PIL import Image
import os

D = os.path.dirname(os.path.abspath(__file__))
PR = f"{D}/panref"
FRAMES = list(range(3230, 3394))   # per-frame

def gray(f):
    return np.asarray(Image.open(f"{PR}/f{f}.png").convert("L"), dtype=np.float64)

def rgb(f):
    return np.asarray(Image.open(f"{PR}/f{f}.png").convert("RGB"), dtype=np.float64)

def profile(f, y0, y1):
    strip = gray(f)[y0:y1, :]
    e = np.abs(np.diff(strip, axis=1)).mean(axis=0)
    return e - e.mean()

def shift_between(p0, p1, search=18):
    n = len(p0); best, bestv = 0, -1e18; sc = {}
    for s in range(-search, search+1):
        if s >= 0: a, b = p0[s:], p1[:n-s]
        else:      a, b = p0[:n+s], p1[-s:]
        v = np.dot(a, b)/len(a); sc[s] = v
        if v > bestv: bestv, best = v, s
    if -search < best < search:
        y0, y1, y2 = sc[best-1], sc[best], sc[best+1]
        den = y0 - 2*y1 + y2
        if abs(den) > 1e-12:
            frac = 0.5*(y0-y2)/den
            if abs(frac) <= 1: return best + frac
    return float(best)

def cum(y0, y1):
    profs = {f: profile(f, y0, y1) for f in FRAMES}
    dx = {FRAMES[0]: 0.0}
    for i in range(1, len(FRAMES)):
        dx[FRAMES[i]] = dx[FRAMES[i-1]] + shift_between(profs[FRAMES[i-1]], profs[FRAMES[i]])
    return dx

def red_cols(f, y0, y1):
    """x positions of strong red vertical runs in [y0,y1]."""
    im = rgb(f)[y0:y1, :]
    R, G, B = im[:,:,0], im[:,:,1], im[:,:,2]
    red = (R > 150) & (G < 120) & (B < 90)
    colcount = red.sum(axis=0)
    xs = []
    x = 0; n = len(colcount)
    while x < n:
        if colcount[x] >= (y1-y0)*0.4:
            j = x
            while j < n and colcount[j] >= (y1-y0)*0.2: j += 1
            xs.append((x+j-1)//2); x = j
        else: x += 1
    return xs

band = cum(95, 165)
diag = cum(600, 900)

print("== red milestone tick columns (band+preview y100..250) at sample frames ==")
for f in (3240, 3260, 3300, 3340, 3372):
    print(f, red_cols(f, 100, 250))

print("\n== per-frame cumulative dx (band vs diagram) ; band relative to f3230 ==")
print("f, band_dx, diag_dx")
for f in FRAMES:
    if f % 5 == 0 or f >= 3372:
        print(f, round(band[f],1), round(diag[f],1))
