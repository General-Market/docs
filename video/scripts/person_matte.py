#!/usr/bin/env python3
"""Cut the person out of a video, frame by frame, into a transparent layer.

The method behind "titles behind the subject": separate the person from the
room so titles and light can live in the space behind them while the person
stays in front, untouched. Output is a ProRes 4444 .mov with alpha that
Remotion stacks above the room video via <OffthreadVideo>. (libvpx in this
ffmpeg build drops alpha, so webm is not an option here.)

  python3 person_matte.py <input.mp4> <output.mov>
  python3 person_matte.py <input.mp4> <output.mov> --start 90 --duration 12
  python3 person_matte.py <input.mp4> <output.mov> --model birefnet   # better hair

Models:
  human_seg  (default) rembg u2net_human_seg — fast, clean silhouette
  birefnet             BiRefNet-portrait — slower, better on hair edges
"""
import argparse
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image


def frame_rate(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    num, den = out.split("/")
    return float(num) / float(den)


def extract_frames(src, frames_dir, start, duration):
    cmd = ["ffmpeg", "-y"]
    if start is not None:
        cmd += ["-ss", str(start)]
    cmd += ["-i", str(src)]
    if duration is not None:
        cmd += ["-t", str(duration)]
    cmd += ["-q:v", "2", str(frames_dir / "f_%06d.png")]
    subprocess.run(cmd, check=True, capture_output=True)
    return sorted(frames_dir.glob("f_*.png"))


def cut_human_seg(frames, out_dir):
    from rembg import remove, new_session
    sess = new_session("u2net_human_seg")
    for i, f in enumerate(frames):
        img = Image.open(f).convert("RGB")
        Image.fromarray(_apply(img, remove(img, session=sess, only_mask=True))).save(
            out_dir / f.name
        )
        _tick(i, len(frames))


def cut_birefnet(frames, out_dir):
    import torch
    from torchvision import transforms
    from transformers import AutoModelForImageSegmentation

    dev = (torch.device("mps") if torch.backends.mps.is_available()
           else torch.device("cpu"))
    model = AutoModelForImageSegmentation.from_pretrained(
        "ZhengPeng7/BiRefNet-portrait", trust_remote_code=True).to(dev).eval()
    tf = transforms.Compose([
        transforms.Resize((1024, 1024)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    for i, f in enumerate(frames):
        img = Image.open(f).convert("RGB")
        x = tf(img).unsqueeze(0).to(dev)
        with torch.no_grad():
            pred = model(x)[-1].sigmoid().cpu()[0, 0]
        mask = transforms.ToPILImage()(pred).resize(img.size)
        Image.fromarray(_apply(img, mask)).save(out_dir / f.name)
        _tick(i, len(frames))


def _apply(img_rgb, mask_l):
    """Attach the matte as alpha onto the RGB frame -> RGBA numpy array."""
    import numpy as np
    rgba = np.dstack([np.array(img_rgb), np.array(mask_l.convert("L"))])
    return rgba


def _tick(i, n):
    if i % 30 == 0 or i == n - 1:
        print(f"  matte {i + 1}/{n}", flush=True)


def encode_alpha(cut_dir, output, fps):
    """PNG sequence with alpha -> ProRes 4444 .mov Remotion can read."""
    subprocess.run([
        "ffmpeg", "-y", "-framerate", str(fps),
        "-i", str(cut_dir / "f_%06d.png"),
        "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le",
        "-vendor", "apl0",
        str(output),
    ], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--start", type=float, default=None)
    ap.add_argument("--duration", type=float, default=None)
    ap.add_argument("--model", choices=["human_seg", "birefnet"], default="human_seg")
    args = ap.parse_args()

    src = Path(args.input)
    if not src.exists():
        sys.exit(f"no such file: {src}")
    fps = frame_rate(src)
    t0 = time.time()

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        raw, cut = tmp / "raw", tmp / "cut"
        raw.mkdir(); cut.mkdir()
        print("extracting frames...", flush=True)
        frames = extract_frames(src, raw, args.start, args.duration)
        print(f"cutting {len(frames)} frames with {args.model}...", flush=True)
        (cut_birefnet if args.model == "birefnet" else cut_human_seg)(frames, cut)
        print("encoding alpha mov...", flush=True)
        encode_alpha(cut, args.output, fps)

    print(f"done in {time.time() - t0:.0f}s -> {args.output}")


if __name__ == "__main__":
    main()
