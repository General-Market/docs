#!/usr/bin/env python3
"""Scene-cut detection over a whole video → cuts.json.

In an interview edit, b-roll inserts begin and end on hard cuts. Find every cut
once, up front, and the vague timestamps snap to real boundaries instead of
guesses. Runs downscaled for speed; the cut *times* stay frame-accurate to the
source because ffmpeg reports source pts.

    python3 detect_cuts.py "<video>" --out /tmp/work/cuts.json
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

from _util import probe

_PTS = re.compile(r"pts_time:([0-9.]+)")
_SCORE = re.compile(r"lavfi\.scene_score=([0-9.]+)")


def detect(video: str, threshold: float = 0.18, scale: int = 480) -> list[dict]:
    """Return [{t, score}] for every detected scene change, sorted by time."""
    with tempfile.TemporaryDirectory() as td:
        meta = f"{td}/scenes.txt"
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", video,
                "-vf", f"scale={scale}:-2,select='gt(scene,{threshold})',"
                       f"metadata=print:file={meta}",
                "-an", "-f", "null", "-",
            ],
            capture_output=True, text=True, check=True,
        )
        cuts: list[dict] = []
        t = None
        for line in Path(meta).read_text().splitlines():
            m = _PTS.search(line)
            if m:
                t = float(m.group(1))
                continue
            s = _SCORE.search(line)
            if s and t is not None:
                cuts.append({"t": round(t, 3), "score": round(float(s.group(1)), 3)})
                t = None
    cuts.sort(key=lambda c: c["t"])
    return cuts


def main() -> None:
    ap = argparse.ArgumentParser(description="Full-video scene-cut detection → cuts.json")
    ap.add_argument("video")
    ap.add_argument("--threshold", type=float, default=0.18,
                    help="scene score cutoff (lower = more cuts; default 0.18)")
    ap.add_argument("--scale", type=int, default=480, help="detection downscale width")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    pr = probe(args.video)
    cuts = detect(args.video, args.threshold, args.scale)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(
        {"video": args.video, "fps": pr.fps, "duration": pr.duration, "cuts": cuts},
        indent=2,
    ))
    print(f"{len(cuts)} cuts → {args.out}  (video {pr.width}x{pr.height} @ {pr.fps:.3f}fps, {pr.duration:.1f}s)")


if __name__ == "__main__":
    main()
