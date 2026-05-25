#!/usr/bin/env python3
"""Extract one b-roll clip, cut to cut, frame-accurate — then prove the edges.

    python3 extract.py "<video>" --in 19.55 --out 22.66 \
        --name orderbook-zoom --dir <project>/public/broll/<source>/

--in / --out are SOURCE seconds: --out is the time of the LAST frame you want to
keep. The encoder includes that frame and stops before the next one (DUR =
out-in + half a frame-step), so the file ends exactly on the hard cut.

Gotcha this guards against: input-seek (`-ss` before `-i`) can leak a single
frame from the neighbouring shot at the head. After extracting, this writes an
edge-verify montage next to the clip (.verify/<name>.png) — read it. If the
first frame shows the previous shot, bump --in by one frame-step and re-run.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from _util import fmt_ts, probe
from montage import edge_verify
from _util import run


def extract(video: str, t_in: float, t_out: float, name: str, out_dir: str,
            accurate: bool = False, audio: bool = True, verify: bool = True) -> str:
    pr = probe(video)
    dur = (t_out - t_in) + pr.frame_step * 0.5
    out_dir_p = Path(out_dir)
    out_dir_p.mkdir(parents=True, exist_ok=True)
    clip = str(out_dir_p / f"{name}.mp4")

    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    if accurate:  # output seek — decode from 0, exact, slow for late clips
        cmd += ["-i", video, "-ss", f"{t_in}", "-t", f"{dur}"]
    else:         # input seek — fast, near-exact; edges checked by verify
        cmd += ["-ss", f"{t_in}", "-i", video, "-t", f"{dur}"]
    cmd += ["-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p"]
    cmd += ["-c:a", "aac", "-b:a", "128k"] if audio else ["-an"]
    cmd += ["-movflags", "+faststart", clip]
    run(cmd)

    out = probe(clip)
    print(f"✓ {name}.mp4  {fmt_ts(t_in)} → {fmt_ts(t_out)}  "
          f"({out.duration:.3f}s, {out.nframes}f, {out.width}x{out.height})")
    if verify:
        vdir = out_dir_p / ".verify"
        vdir.mkdir(exist_ok=True)
        vpath = edge_verify(clip, str(vdir / f"{name}.png"))
        print(f"  edge-verify → {vpath}  (read it: first/2nd | 2nd-last/last must all be this shot)")
    return clip


def main() -> None:
    ap = argparse.ArgumentParser(description="Frame-accurate cut-to-cut b-roll extract + edge verify.")
    ap.add_argument("video")
    ap.add_argument("--in", dest="t_in", type=float, required=True, help="source seconds, first frame to keep")
    ap.add_argument("--out", dest="t_out", type=float, required=True, help="source seconds, last frame to keep")
    ap.add_argument("--name", required=True, help="output filename stem (kebab-case)")
    ap.add_argument("--dir", required=True, help="output folder")
    ap.add_argument("--accurate", action="store_true", help="output-seek (exact, slower) instead of input-seek")
    ap.add_argument("--no-audio", dest="audio", action="store_false")
    ap.add_argument("--no-verify", dest="verify", action="store_false")
    args = ap.parse_args()
    extract(args.video, args.t_in, args.t_out, args.name, args.dir,
            accurate=args.accurate, audio=args.audio, verify=args.verify)


if __name__ == "__main__":
    main()
