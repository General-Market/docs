#!/usr/bin/env python3
"""
Remove background from tutorial-raw.mp4 using u2netp (via rembg).
Outputs PNG sequence with alpha channel.

~0.09s/frame = ~11 min for full video.
"""

import subprocess
import time
import sys
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

VIDEO_DIR = Path(__file__).parent.parent
VIDEO_PATH = VIDEO_DIR / "public" / "tutorial-raw.mp4"
FRAMES_DIR = VIDEO_DIR / "public" / "tutorial-raw-frames"
OUTPUT_DIR = VIDEO_DIR / "public" / "tutorial-nobg"


def extract_all_frames():
    """Extract all frames from video as PNG sequence."""
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    existing = sorted(FRAMES_DIR.glob("frame_*.png"))
    if existing:
        print(f"Found {len(existing)} existing extracted frames, skipping extraction.")
        return existing

    print(f"Extracting frames from {VIDEO_PATH}...")
    t0 = time.time()
    subprocess.run([
        "ffmpeg", "-y", "-i", str(VIDEO_PATH),
        "-q:v", "2", str(FRAMES_DIR / "frame_%06d.png")
    ], capture_output=True, check=True)

    frames = sorted(FRAMES_DIR.glob("frame_*.png"))
    print(f"Extracted {len(frames)} frames in {time.time()-t0:.0f}s")
    return frames


def process_all(frames):
    """Remove background from all frames using u2netp."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Check for already-processed frames (resume support)
    done = set(f.name for f in OUTPUT_DIR.glob("frame_*.png"))
    remaining = [(i, f) for i, f in enumerate(frames) if f.name not in done]

    if not remaining:
        print("All frames already processed.")
        return

    if len(done) > 0:
        print(f"Resuming: {len(done)} done, {len(remaining)} remaining.")

    sess = new_session("u2netp")
    print(f"Processing {len(remaining)} frames with u2netp...")

    t0 = time.time()
    for count, (i, frame_path) in enumerate(remaining):
        img = Image.open(frame_path).convert("RGB")
        result = remove(img, session=sess)
        result.save(OUTPUT_DIR / frame_path.name)

        if (count + 1) % 100 == 0 or count == 0:
            elapsed = time.time() - t0
            fps = (count + 1) / elapsed
            eta = (len(remaining) - count - 1) / fps
            print(f"  [{count+1}/{len(remaining)}] {fps:.1f} fps, ETA {eta/60:.1f}min")

    total = time.time() - t0
    print(f"\nDone. {len(remaining)} frames in {total:.0f}s ({len(remaining)/total:.1f} fps)")
    print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    frames = extract_all_frames()
    process_all(frames)
