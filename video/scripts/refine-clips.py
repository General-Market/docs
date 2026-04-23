#!/usr/bin/env python3
"""
Refine insider trading clips using Parakeet TDT v3.
Re-download wider segments, Parakeet for exact word timing, re-cut tight.
"""
from __future__ import annotations

import subprocess
import json
import os
import sys
from pathlib import Path
from typing import Optional

os.environ["PYTHONUNBUFFERED"] = "1"

CLIPS_DIR = Path(__file__).parent.parent / "public" / "insider-trading" / "clips"
WORK_DIR = Path(__file__).parent.parent / "public" / "insider-trading" / "work"
MANIFEST_PATH = Path(__file__).parent.parent / "public" / "insider-trading" / "clips-manifest.json"
YT_DLP = "/opt/homebrew/bin/yt-dlp"

WIDE_PAD_BEFORE = 4.0
WIDE_PAD_AFTER = 3.0
TIGHT_PAD_BEFORE = 0.15
TIGHT_PAD_AFTER = 0.10

# Import parakeet transcriber
sys.path.insert(0, str(Path(__file__).parent))
from parakeet_transcribe import transcribe, find_insider_trading


def download_and_cut_wide(url: str, vtt_time: float, idx: int) -> Optional[Path]:
    """Download video and cut wide segment around VTT timestamp."""
    raw_path = WORK_DIR / f"refine_raw_{idx:03d}.mp4"
    wide_path = WORK_DIR / f"wide_{idx:03d}.mp4"

    # Download full video
    cmd = [
        YT_DLP, "-f", "best[height<=720]/best",
        "--recode-video", "mp4",
        "-o", str(raw_path),
        "--no-playlist", url
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    if not raw_path.exists() or raw_path.stat().st_size < 10000:
        # Check alt extensions
        for f in WORK_DIR.glob(f"refine_raw_{idx:03d}.*"):
            if f.stat().st_size > 10000:
                raw_path = f
                break
        else:
            return None

    # Cut wide segment
    ss = max(0, vtt_time - WIDE_PAD_BEFORE)
    dur = WIDE_PAD_BEFORE + WIDE_PAD_AFTER

    cmd2 = [
        "ffmpeg", "-y",
        "-ss", f"{ss:.3f}",
        "-i", str(raw_path),
        "-to", f"{dur:.3f}",
        "-c:v", "libx264", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        "-movflags", "+faststart",
        str(wide_path)
    ]
    subprocess.run(cmd2, capture_output=True, timeout=60)
    raw_path.unlink(missing_ok=True)

    return wide_path if wide_path.exists() else None


def refine_cut(wide_path: Path, timing: dict, final_path: Path):
    """Re-cut the wide clip to tight timing."""
    start = max(0, timing["insider_start"] - TIGHT_PAD_BEFORE)
    end = timing["trading_end"] + TIGHT_PAD_AFTER

    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{start:.3f}",
        "-i", str(wide_path),
        "-to", f"{end - start:.3f}",
        "-c:v", "libx264", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        str(final_path)
    ]
    subprocess.run(cmd, capture_output=True, timeout=30)


def main():
    manifest = json.loads(MANIFEST_PATH.read_text())
    clips = manifest["clips"]
    refined = []

    print(f"=== Refining {len(clips)} clips with Parakeet TDT v3 ===\n")

    for i, clip_info in enumerate(clips):
        url = clip_info["source_url"]
        vtt_time = clip_info["phrase_start"]
        title = clip_info["source_title"]
        clip_file = clip_info["clip_file"]

        print(f"[{i+1}/{len(clips)}] {title[:65]}")
        print(f"    VTT timestamp: {vtt_time:.2f}s")

        # Download wide segment
        print(f"    Downloading 7s segment...")
        wide_path = download_and_cut_wide(url, vtt_time, i)
        if not wide_path:
            print(f"    SKIP: download failed")
            continue

        # Parakeet transcribe
        print(f"    Running Parakeet v3...")
        words = transcribe(str(wide_path))
        timing = find_insider_trading(words)

        if not timing:
            # Print what Parakeet heard for debugging
            text = " ".join(w["word"] for w in words)
            print(f"    SKIP: Parakeet didn't find 'insider trading'")
            print(f"    Heard: {text[:100]}")
            wide_path.unlink(missing_ok=True)
            continue

        print(f"    Found: insider={timing['insider_start']:.3f}s trading={timing['trading_start']:.3f}s-{timing['trading_end']:.3f}s")

        # Re-cut tight
        final_path = CLIPS_DIR / clip_file
        refine_cut(wide_path, timing, final_path)
        wide_path.unlink(missing_ok=True)

        # Update manifest entry
        clip_start = max(0, timing["insider_start"] - TIGHT_PAD_BEFORE)
        clip_info["insider_start_in_clip"] = timing["insider_start"] - clip_start
        clip_info["trading_end_in_clip"] = timing["trading_end"] - clip_start
        clip_info["duration"] = timing["trading_end"] - timing["insider_start"] + TIGHT_PAD_BEFORE + TIGHT_PAD_AFTER
        refined.append(clip_info)

        print(f"    OK — {clip_info['duration']:.2f}s clip")

    # Write updated manifest
    manifest["clips"] = refined
    manifest["total"] = len(refined)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))

    print(f"\n=== Done! {len(refined)}/{len(clips)} clips refined ===")


if __name__ == "__main__":
    main()
