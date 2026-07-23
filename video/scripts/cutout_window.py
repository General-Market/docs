#!/usr/bin/env python3
"""Matte ONE window of a video into light cutout frames for a behind-subject beat.

Behind-subject beats (a title/light behind the speaker, like IntroHero) need a
person cutout — but only for the few seconds of the beat, never the whole talk.
A full-length cutout is ~40GB of lossless PNG and will not fit. This tool mattes
only the requested window and writes WebP+alpha frames (~10x smaller than PNG).

  python3 cutout_window.py <video> <out_dir> --start 312.0 --duration 6
  python3 cutout_window.py <video> <out_dir> --start 312.0 --duration 6 --room
  python3 cutout_window.py <video> <out_dir> --start 312 --duration 6 --model birefnet

Output (out_dir is under video/public/, e.g. anticheat-edit/beats/rigged):
  f_0001.webp … f_NNNN.webp   the cutout (person, transparent bg)
  room/f_0001.webp …          the room plate (only with --room), for the
                              frame-locked anti-lag plate IntroHero uses

In Remotion, map the beat's local frame to f_{idx} (1-based):
  const idx = String(Math.min(N, local + 1)).padStart(4, "0");
  <Img src={staticFile(`anticheat-edit/beats/rigged/f_${idx}.webp`)} />

Models: human_seg (fast, default) | birefnet (slower, better hair).
WebP quality defaults to 88 — plenty for a composited silhouette.
"""
import argparse
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
from PIL import Image


def fps_of(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    n, d = out.split("/")
    return float(n) / float(d)


def extract(video, start, duration, raw_dir):
    subprocess.run(
        ["ffmpeg", "-y", "-ss", str(start), "-i", str(video), "-t", str(duration),
         "-q:v", "2", str(raw_dir / "f_%04d.png")],
        check=True, capture_output=True,
    )
    return sorted(raw_dir.glob("f_*.png"))


def matte_human(frames):
    from rembg import remove, new_session
    sess = new_session("u2net_human_seg")
    for f in frames:
        img = Image.open(f).convert("RGB")
        yield f, Image.open(f).convert("RGB"), remove(img, session=sess, only_mask=True)


def matte_birefnet(frames):
    import torch
    from torchvision import transforms
    from transformers import AutoModelForImageSegmentation
    dev = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cpu")
    model = AutoModelForImageSegmentation.from_pretrained(
        "ZhengPeng7/BiRefNet-portrait", trust_remote_code=True).to(dev).eval()
    tf = transforms.Compose([
        transforms.Resize((1024, 1024)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    for f in frames:
        img = Image.open(f).convert("RGB")
        x = tf(img).unsqueeze(0).to(dev)
        with torch.no_grad():
            pred = model(x)[-1].sigmoid().cpu()[0, 0]
        yield f, img, transforms.ToPILImage()(pred).resize(img.size)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("out_dir", help="under video/public/, e.g. anticheat-edit/beats/rigged")
    ap.add_argument("--start", type=float, required=True, help="seconds into the video")
    ap.add_argument("--duration", type=float, required=True, help="seconds")
    ap.add_argument("--model", choices=["human_seg", "birefnet"], default="human_seg")
    ap.add_argument("--quality", type=int, default=88)
    ap.add_argument("--room", action="store_true", help="also emit the room plate frames")
    args = ap.parse_args()

    video = Path(args.video)
    if not video.exists():
        sys.exit(f"no such file: {video}")
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    room_dir = out / "room"
    if args.room:
        room_dir.mkdir(exist_ok=True)

    t0 = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp)
        print(f"extracting {args.duration}s from {args.start}s...", flush=True)
        frames = extract(video, args.start, args.duration, raw)
        gen = matte_birefnet(frames) if args.model == "birefnet" else matte_human(frames)
        print(f"matting {len(frames)} frames with {args.model}...", flush=True)
        n = 0
        for i, (f, rgb, mask) in enumerate(gen):
            rgba = np.dstack([np.array(rgb), np.array(mask.convert("L"))])
            Image.fromarray(rgba, "RGBA").save(out / f"f_{i + 1:04d}.webp", quality=args.quality)
            if args.room:
                rgb.save(room_dir / f"f_{i + 1:04d}.webp", quality=args.quality)
            n = i + 1
            if i % 30 == 0:
                print(f"  {i + 1}/{len(frames)}", flush=True)

    size = sum(p.stat().st_size for p in out.rglob("f_*.webp"))
    rel = out
    print(f"\ndone in {time.time() - t0:.0f}s — {n} frames, {size / 1e6:.1f} MB")
    print(f"cutout:  staticFile(`{rel}/f_${{idx}}.webp`)  (idx = 1..{n}, padStart 4)")
    if args.room:
        print(f"room:    staticFile(`{rel}/room/f_${{idx}}.webp`)")


if __name__ == "__main__":
    main()
