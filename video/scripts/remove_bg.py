#!/usr/bin/env python3
"""
Remove background from tutorial-raw.mp4 using BiRefNet-portrait.
Outputs PNG sequence with alpha channel (transparent background).

Usage:
  python3 scripts/remove_bg.py --test          # Process 5 sample frames
  python3 scripts/remove_bg.py                 # Process all frames
  python3 scripts/remove_bg.py --start 100 --end 200  # Process frame range
"""

import argparse
import os
import sys
import time
from pathlib import Path

import torch
from torchvision import transforms
from PIL import Image

# Paths
VIDEO_DIR = Path(__file__).parent.parent
VIDEO_PATH = VIDEO_DIR / "public" / "tutorial-raw.mp4"
OUTPUT_DIR = VIDEO_DIR / "public" / "tutorial-nobg"
TEST_DIR = VIDEO_DIR / "public" / "tutorial-frames-test"


def get_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def load_model(device):
    from transformers import AutoModelForImageSegmentation

    print(f"Loading BiRefNet-portrait on {device}...")
    model = AutoModelForImageSegmentation.from_pretrained(
        "ZhengPeng7/BiRefNet-portrait",
        trust_remote_code=True,
    )
    model.to(device).eval()
    if device.type == "cuda":
        model.half()
    return model


def build_transform(size=(1024, 1024)):
    return transforms.Compose([
        transforms.Resize(size),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])


def process_frame(model, transform, frame_pil, device):
    """Remove background from a single PIL image. Returns RGBA PIL image."""
    input_tensor = transform(frame_pil).unsqueeze(0).to(device)
    if device.type == "cuda":
        input_tensor = input_tensor.half()

    with torch.no_grad():
        preds = model(input_tensor)[-1].sigmoid().cpu()

    pred = preds[0].squeeze()
    mask = transforms.ToPILImage()(pred).resize(frame_pil.size, Image.BILINEAR)

    result = frame_pil.copy().convert("RGBA")
    result.putalpha(mask)
    return result


def extract_frames_ffmpeg(video_path, output_dir, start=None, end=None, test_frames=None):
    """Extract frames using ffmpeg. Returns list of frame paths."""
    import subprocess

    output_dir.mkdir(parents=True, exist_ok=True)

    if test_frames:
        # Extract specific sample frames spread across the video
        import json
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", str(video_path)],
            capture_output=True, text=True
        )
        info = json.loads(probe.stdout)
        v = [s for s in info["streams"] if s["codec_type"] == "video"][0]
        duration = float(v["duration"])
        fps = eval(v["r_frame_rate"])
        total = int(duration * fps)

        # Pick evenly spaced frames
        indices = [int(i * total / (test_frames + 1)) for i in range(1, test_frames + 1)]
        paths = []
        for idx in indices:
            t = idx / fps
            out = output_dir / f"frame_{idx:06d}.png"
            subprocess.run([
                "ffmpeg", "-y", "-ss", str(t), "-i", str(video_path),
                "-frames:v", "1", "-q:v", "2", str(out)
            ], capture_output=True)
            paths.append((idx, out))
            print(f"  Extracted frame {idx} (t={t:.1f}s)")
        return paths

    # Extract range or all frames
    cmd = ["ffmpeg", "-y", "-i", str(video_path)]
    if start is not None:
        cmd.extend(["-ss", str(start / 25.0)])  # 25fps
    if end is not None:
        duration = (end - (start or 0)) / 25.0
        cmd.extend(["-t", str(duration)])

    pattern = str(output_dir / "frame_%06d.png")
    cmd.extend(["-q:v", "2", pattern])

    print(f"Extracting frames to {output_dir}...")
    subprocess.run(cmd, capture_output=True)

    frames = sorted(output_dir.glob("frame_*.png"))
    return [(i, p) for i, p in enumerate(frames)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", help="Process 5 sample frames only")
    parser.add_argument("--start", type=int, help="Start frame number")
    parser.add_argument("--end", type=int, help="End frame number")
    parser.add_argument("--batch", type=int, default=1, help="Batch size")
    args = parser.parse_args()

    device = get_device()
    model = load_model(device)
    transform = build_transform()

    if args.test:
        out_dir = TEST_DIR
        frames = extract_frames_ffmpeg(VIDEO_PATH, out_dir, test_frames=5)
    else:
        out_dir = OUTPUT_DIR
        out_dir.mkdir(parents=True, exist_ok=True)
        frames = extract_frames_ffmpeg(VIDEO_PATH, out_dir, args.start, args.end)

    print(f"\nProcessing {len(frames)} frames on {device}...")
    t0 = time.time()

    for i, (idx, frame_path) in enumerate(frames):
        img = Image.open(frame_path).convert("RGB")
        result = process_frame(model, transform, img, device)

        out_path = out_dir / f"frame_{idx:06d}.png"
        result.save(out_path)

        elapsed = time.time() - t0
        fps_rate = (i + 1) / elapsed if elapsed > 0 else 0
        remaining = (len(frames) - i - 1) / fps_rate if fps_rate > 0 else 0

        if (i + 1) % 10 == 0 or i == 0 or (i + 1) == len(frames):
            print(f"  [{i+1}/{len(frames)}] {fps_rate:.1f} fps, ETA {remaining/60:.1f}min")

    total = time.time() - t0
    print(f"\nDone. {len(frames)} frames in {total:.0f}s ({len(frames)/total:.1f} fps)")
    print(f"Output: {out_dir}")


if __name__ == "__main__":
    main()
