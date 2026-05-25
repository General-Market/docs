#!/usr/bin/env python3
"""Build a labelled contact-sheet montage of a time window — the artifact an
agent reads to find where a b-roll insert starts and ends.

Labels (frame index + absolute source timestamp) are burned with Pillow, NOT
ffmpeg drawtext: the homebrew ffmpeg on this machine is built without freetype,
so drawtext is unavailable. Pillow is the reliable labeller here.

    python3 montage.py "<video>" --start 18 --dur 6.5 --out /tmp/m.png

Also exposes edge_verify() — the first2/last2 frames of an already-cut clip,
used to prove both edges are clean.
"""

from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from _util import ARIAL, fmt_ts, probe, run


def _font(size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(ARIAL, size)
    except OSError:
        return ImageFont.load_default()


def _label(img: Image.Image, text: str, size: int = 20) -> Image.Image:
    """Burn a black-boxed yellow label into the top-left of an image."""
    draw = ImageDraw.Draw(img)
    font = _font(size)
    pad = 4
    box = draw.textbbox((0, 0), text, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.rectangle([0, 0, w + 2 * pad, h + 2 * pad], fill=(0, 0, 0))
    draw.text((pad, pad - box[1]), text, fill=(255, 220, 0), font=font)
    return img


def _grid(cells: list[Image.Image], cols: int, gap: int = 4) -> Image.Image:
    """Lay labelled cells into a grid on a white background."""
    cw = max(c.width for c in cells)
    ch = max(c.height for c in cells)
    rows = (len(cells) + cols - 1) // cols
    W = cols * cw + (cols + 1) * gap
    H = rows * ch + (rows + 1) * gap
    sheet = Image.new("RGB", (W, H), (255, 255, 255))
    for i, c in enumerate(cells):
        r, col = divmod(i, cols)
        sheet.paste(c, (gap + col * (cw + gap), gap + r * (ch + gap)))
    return sheet


def _grab_window(video: str, start: float, dur: float, fps: float, width: int) -> list[Image.Image]:
    """Sample the window at `fps`, return scaled PIL frames (index order)."""
    with tempfile.TemporaryDirectory() as td:
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-ss", f"{start}", "-i", video, "-t", f"{dur}",
            "-vf", f"fps={fps},scale={width}:-1", f"{td}/%04d.png",
        ])
        files = sorted(Path(td).glob("*.png"))
        return [Image.open(f).convert("RGB").copy() for f in files]


def _grab_indices(clip: str, indices: list[int], width: int) -> list[Image.Image]:
    """Grab specific frame indices from a clip (exact, decoded from start)."""
    imgs = []
    with tempfile.TemporaryDirectory() as td:
        for n in indices:
            run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", clip,
                "-vf", rf"select='eq(n\,{n})',scale={width}:-1",
                "-vsync", "0", "-frames:v", "1", f"{td}/{n:06d}.png",
            ])
            imgs.append(Image.open(f"{td}/{n:06d}.png").convert("RGB").copy())
    return imgs


def window_montage(video: str, start: float, dur: float, out: str,
                   fps: float = 4.0, cols: int = 6, width: int = 360) -> str:
    """Build a labelled montage of [start, start+dur]. Each cell shows its
    frame index within the window and its absolute source timestamp."""
    frames = _grab_window(video, start, dur, fps, width)
    cells = []
    for i, im in enumerate(frames):
        t = start + i / fps
        cells.append(_label(im, f"{i}  {fmt_ts(t)}"))
    sheet = _grid(cells, cols)
    sheet.save(out)
    return out


def edge_verify(clip: str, out: str, width: int = 320) -> str:
    """First two and last two frames of a cut clip, labelled — proof the head
    and tail belong to the intended shot and no neighbour frame leaked in."""
    pr = probe(clip)
    n = pr.nframes
    idx = [0, 1, max(0, n - 2), n - 1]
    names = ["first", "2nd", "2nd-last", "last"]
    imgs = _grab_indices(clip, idx, width)
    cells = [_label(im, f"{names[i]}  f{idx[i]}") for i, im in enumerate(imgs)]
    _grid(cells, cols=4).save(out)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Labelled window montage for finding b-roll cuts.")
    ap.add_argument("video")
    ap.add_argument("--start", type=float, required=True, help="window start (seconds)")
    ap.add_argument("--dur", type=float, required=True, help="window duration (seconds)")
    ap.add_argument("--fps", type=float, default=4.0, help="frames sampled per second (default 4)")
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--width", type=int, default=360)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    path = window_montage(args.video, args.start, args.dur, args.out,
                          fps=args.fps, cols=args.cols, width=args.width)
    n = int(args.dur * args.fps)
    print(f"montage → {path}")
    print(f"  {n} tiles, {args.fps} fps · tile i is at source time {args.start} + i/{args.fps}s")
    print(f"  read it, find the IN tile (first frame of the insert) and OUT tile (last).")


if __name__ == "__main__":
    main()
