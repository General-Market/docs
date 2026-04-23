#!/usr/bin/env python3
"""Benchmark all rembg models on a single frame. Compare speed + quality."""

import time
from pathlib import Path
from PIL import Image
import numpy as np
from rembg import remove, new_session

TEST_DIR = Path(__file__).parent.parent / "public" / "tutorial-frames-test"
FRAME = TEST_DIR / "frame_003536.png"

# Load the original RGB frame (before BiRefNet overwrote it — re-extract)
import subprocess
VIDEO = Path(__file__).parent.parent / "public" / "tutorial-raw.mp4"
ORIG = TEST_DIR / "original_003536.png"
subprocess.run([
    "ffmpeg", "-y", "-ss", "141.4", "-i", str(VIDEO),
    "-frames:v", "1", "-q:v", "2", str(ORIG)
], capture_output=True)

original = Image.open(ORIG).convert("RGB")

models = [
    "u2netp",              # Lightest U2Net (4.7MB)
    "u2net_human_seg",     # U2Net tuned for people (176MB)
    "u2net",               # Full U2Net (176MB)
    "silueta",             # Silueta (43MB)
    "isnet-general-use",   # ISNet (176MB)
    "birefnet-general-lite",  # BiRefNet lite ONNX (44M params)
    "birefnet-portrait",   # BiRefNet portrait ONNX
    "bria-rmbg",           # BRIA RMBG
]

print(f"Frame: {original.size}, benchmarking {len(models)} models...\n")
print(f"{'Model':<25} {'Time':>8} {'Alpha%':>8} {'7072f ETA':>12}")
print("-" * 58)

for name in models:
    try:
        sess = new_session(name)

        # Warm up
        _ = remove(original.copy(), session=sess)

        # Timed run (3 iterations, take best)
        times = []
        result = None
        for _ in range(3):
            t0 = time.time()
            result = remove(original.copy(), session=sess)
            times.append(time.time() - t0)

        best = min(times)

        # Analyze alpha quality
        arr = np.array(result)
        if arr.shape[2] == 4:
            alpha = arr[:,:,3]
            transparent_pct = (alpha < 128).sum() / alpha.size * 100
        else:
            transparent_pct = 0

        eta_hours = (best * 7072) / 3600

        # Save preview
        bg = Image.new("RGBA", result.size, (30, 40, 80, 255))
        preview = Image.alpha_composite(bg, result)
        preview.save(TEST_DIR / f"bench_{name}.png")

        print(f"{name:<25} {best:>6.2f}s {transparent_pct:>6.1f}% {eta_hours:>9.1f}h")

    except Exception as e:
        print(f"{name:<25} FAILED: {e}")

print(f"\nPreviews saved to {TEST_DIR}/bench_*.png")
