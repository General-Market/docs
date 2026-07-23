#!/usr/bin/env python3
"""Render an animated god-ray light layer on black, for screen-blending.

The dynamic sibling of the SHAFT_0.55 still: diagonal beams from the top-left
that drift, a diagonal flare to the bottom-right with a travelling hotspot,
the whole field breathing. Rendered on black so Remotion can screen-blend it
(black drops out, light adds) over the room, behind the subject cutout.

Rendered at half-res (soft light scales fine) for speed.

  python3 render_light_shafts.py <output.mp4> [--duration 12] [--fps 30]
"""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

RW, RH = 960, 540          # half-res; light is soft, upscales cleanly
SCALE = RW / 1920.0

def render(out, duration, fps):
    N = int(duration * fps)
    yy, xx = np.mgrid[0:RH, 0:RW].astype(np.float32)
    u0, u1 = 0.80, 0.60          # beam travel direction (down-right)
    n0, n1 = -0.60, 0.80
    s = (xx * u0 + yy * u1)
    p = (xx * n0 + yy * n1)
    base_offs = [o * SCALE for o in (-250, -70, 120, 330)]
    a, b = 1020.0, -1240.0
    cc = -(a * 560 * SCALE + b * (-120) * SCALE)
    perp2 = np.abs(a * xx + b * yy + cc) / np.hypot(a, b)
    tline = ((xx - 560 * SCALE) * 1240 + (yy + 120 * SCALE) * 1020) / np.hypot(1240, 1020) / (2000 * SCALE)
    falo = np.clip(1 - np.abs(tline - 0.5) / 0.72, 0, 1)

    tmp = Path(tempfile.mkdtemp())
    for f in range(N):
        shift = 60 * SCALE * np.sin(f / 55.0)
        breathe = 0.8 + 0.2 * np.sin(f / 50.0)
        core = np.zeros((RH, RW), np.float32)
        halo = np.zeros((RH, RW), np.float32)
        for k, o in enumerate(base_offs):
            oo = o + shift + 18 * SCALE * np.sin(f / 40.0 + k)
            core += np.exp(-((p - oo) ** 2) / (2 * (16 * SCALE) ** 2))
            halo += np.exp(-((p - oo) ** 2) / (2 * (55 * SCALE) ** 2))
        along = np.clip(1 - s / (1250 * SCALE), 0, 1) ** 1.5
        core *= along
        halo *= along
        core += np.exp(-(perp2 ** 2) / (2 * (9 * SCALE) ** 2)) * falo
        halo += np.exp(-(perp2 ** 2) / (2 * (40 * SCALE) ** 2)) * falo
        ht = 0.5 + 0.4 * np.sin(f / 64.0)
        pd = np.hypot(xx - (300 + ht * 1300) * SCALE, yy - (200 + ht * 760) * SCALE)
        core += np.exp(-(pd ** 2) / (2 * (60 * SCALE) ** 2))
        core = np.clip(core * breathe, 0, 1)
        halo = np.clip(halo * breathe, 0, 1)
        white = core
        blue = np.clip(halo - core, 0, 1)
        img = np.zeros((RH, RW, 3), np.uint8)
        img[..., 0] = np.clip(255 * white + 60 * blue, 0, 255)
        img[..., 1] = np.clip(255 * white + 150 * blue, 0, 255)
        img[..., 2] = np.clip(255 * white + 255 * blue, 0, 255)
        Image.fromarray(img).save(tmp / f"f_{f:05d}.png")
        if f % 30 == 0:
            print(f"  light {f}/{N}", flush=True)

    subprocess.run([
        "ffmpeg", "-y", "-framerate", str(fps), "-i", str(tmp / "f_%05d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart",
        str(out),
    ], check=True)
    print(f"done -> {out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("output")
    ap.add_argument("--duration", type=float, default=12)
    ap.add_argument("--fps", type=int, default=30)
    a = ap.parse_args()
    render(a.output, a.duration, a.fps)
