#!/usr/bin/env python3
"""Rectify a cls-day S5 ref frame into WORLD space and cut one 604x330 city slot.

World -> screen (S5Skyline):
  screen_x = 960 + (x9 + L - 960) * sx     (L = world x inside the x9 row)
  screen_y = riseC + (wy - 532.5) * sy     [r18: sy == sx through the entry]
Above slots: world y 170..500.  Below slots: world y 570..900.

Crops that run off the frame are PADDED (white above / navy below), never clamped —
a clamped crop silently rescales x and reads as an 8px registration error.

usage: rect.py <frame> <slotLeft> <above|below> <out.png>
"""
import subprocess, sys, os
import numpy as np
from PIL import Image

REF = "/Users/maxguillabert/Downloads/index/video/public/cls-day-original.mp4"
W = os.path.dirname(os.path.abspath(__file__))

SX = {674: .8475, 675: .8936, 676: .9254, 677: .9473, 678: .9642, 679: .9761,
      680: .9847, 681: .9911, 682: .996, 683: .994, 684: 1.0, 690: 1.0,
      750: 1.0, 800: 1.0, 850: 1.0, 900: 1.0, 910: 1.0, 916: 1.0}
SY = dict(SX)   # r18: the entry zoom is UNIFORM (band2.py, n~1400 cols/frame)
RC = {674: 412.3, 675: 448.0, 676: 472.7, 677: 490.1, 678: 503.1, 679: 512.6,
      680: 519.8, 681: 524.8, 682: 528.6, 683: 530.8, 684: 532.5, 690: 532.5,
      750: 532.5, 800: 532.5, 850: 532.5, 900: 532.5, 910: 532.5, 916: 532.5}
X9 = {674: 2485.8, 675: 1863.8, 676: 1438.7, 677: 1134.4, 678: 911.3, 679: 744.9,
      680: 621.3, 681: 530.7, 682: 467, 683: 425.6, 684: 400.5, 690: 384,
      750: 288.5, 800: 206, 850: 124.5, 900: 49.5, 910: 34.5, 916: 25.5}
PAD = {"above": (253, 253, 253), "below": (10, 44, 85)}


def rect(frame, slot_left, band, out):
    sx, sy, rc, x9 = SX[frame], SY[frame], RC[frame], X9[frame]
    wy0 = 170.0 if band == "above" else 570.0
    x0 = 960 + (x9 + slot_left - 960) * sx
    x1 = 960 + (x9 + slot_left + 604 - 960) * sx
    y0 = rc + (wy0 - 532.5) * sy
    y1 = rc + (wy0 + 330 - 532.5) * sy
    src = f"{W}/refs/r{frame}.png"
    if not os.path.exists(src):
        subprocess.run(["ffmpeg", "-loglevel", "error", "-i", REF, "-vf",
                        f"select=eq(n\\,{frame})", "-vframes", "1", "-y", src], check=True)
    im = np.asarray(Image.open(src).convert("RGB"))
    H, Wd = im.shape[:2]
    px = int(np.ceil(max(0, -x0))) + 8
    py = int(np.ceil(max(0, -y0))) + 8
    ex = int(np.ceil(max(0, x1 - Wd))) + 8
    ey = int(np.ceil(max(0, y1 - H))) + 8
    big = np.full((H + py + ey, Wd + px + ex, 3), PAD[band], dtype=np.uint8)
    big[py:py + H, px:px + Wd] = im
    cx, cy = int(round(x0)) + px, int(round(y0)) + py
    cw, ch = int(round(x1)) - int(round(x0)), int(round(y1)) - int(round(y0))
    crop = big[cy:cy + ch, cx:cx + cw]
    print(f"f{frame} slot{slot_left:>8} {band}: x {x0:7.1f}..{x1:7.1f}  y {y0:6.1f}..{y1:6.1f}  s={sx}")
    Image.fromarray(crop).resize((604, 330), Image.LANCZOS).save(out)


if __name__ == "__main__":
    rect(int(sys.argv[1]), float(sys.argv[2]), sys.argv[3], sys.argv[4])
