#!/usr/bin/env python3
"""
Insider Trading Clip Pipeline v2
Uses YouTube auto-sub VTT word-level timestamps (no Whisper needed).
VTT format gives per-word timing: <00:00:37.280><c> insider</c><00:00:38.079><c> trading</c>
"""
from __future__ import annotations

import subprocess
import json
import os
import sys
import re
from pathlib import Path
from typing import Optional, List

os.environ["PYTHONUNBUFFERED"] = "1"

CLIPS_DIR = Path(__file__).parent.parent / "public" / "insider-trading" / "clips"
WORK_DIR = Path(__file__).parent.parent / "public" / "insider-trading" / "work"
MANIFEST_PATH = Path(__file__).parent.parent / "public" / "insider-trading" / "clips-manifest.json"
YT_DLP = "/opt/homebrew/bin/yt-dlp"

PAD_BEFORE = 0.6
PAD_AFTER = 0.4
TARGET_CLIPS = 20


def ensure_dirs():
    CLIPS_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    (WORK_DIR / "subs").mkdir(exist_ok=True)


def get_title(url: str) -> str:
    cmd = [YT_DLP, "--skip-download", "--print", "%(title)s", "--no-playlist", url]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return r.stdout.strip().split("\n")[-1] if r.stdout.strip() else "Unknown"


def download_vtt(url: str, idx: int) -> Optional[Path]:
    """Download YouTube auto-generated VTT subtitles."""
    prefix = str(WORK_DIR / "subs" / f"sub_{idx:03d}")
    cmd = [
        YT_DLP,
        "--write-auto-sub", "--sub-lang", "en", "--sub-format", "vtt",
        "--skip-download", "--no-playlist",
        "-o", prefix,
        url
    ]
    subprocess.run(cmd, capture_output=True, text=True, timeout=30)

    # Find the VTT file
    for f in (WORK_DIR / "subs").glob(f"sub_{idx:03d}*.vtt"):
        return f
    return None


def parse_vtt_word_timestamps(vtt_path: Path) -> List[dict]:
    """Parse VTT with inline word timestamps.

    Format: word<00:00:01.520><c> next_word</c><00:00:02.159><c> another</c>
    Returns list of {word, start_ms, end_ms}
    """
    content = vtt_path.read_text(errors="ignore")
    words = []

    # Match timestamp blocks: "00:00:01.040 --> 00:00:03.909"
    # followed by lines with inline word timestamps
    blocks = re.split(r'\n\n+', content)

    for block in blocks:
        lines = block.strip().split('\n')

        # Find timing line
        timing_match = None
        text_lines = []
        for line in lines:
            m = re.match(r'(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})', line)
            if m:
                timing_match = m
            elif timing_match and line.strip() and not line.strip().isdigit():
                text_lines.append(line)

        if not timing_match or not text_lines:
            continue

        block_start_ms = vtt_time_to_ms(timing_match.group(1))

        for text_line in text_lines:
            # Parse inline timestamps: word<00:00:01.520><c> next</c>
            # First word starts at block_start_ms
            # Pattern: <timestamp><c> word</c>

            # Extract first word (before any <> tag)
            first_word_match = re.match(r'^([^<\n]+)', text_line.strip())
            if first_word_match:
                first_word = first_word_match.group(1).strip()
                if first_word and not first_word.startswith('align:'):
                    words.append({
                        "word": first_word,
                        "start_ms": block_start_ms,
                    })

            # Extract subsequent words with timestamps
            pattern = r'<(\d{2}:\d{2}:\d{2}\.\d{3})><c>(.*?)</c>'
            for m in re.finditer(pattern, text_line):
                ts = vtt_time_to_ms(m.group(1))
                word = m.group(2).strip()
                if word:
                    words.append({
                        "word": word,
                        "start_ms": ts,
                    })

    # Deduplicate (VTT repeats lines)
    seen = set()
    unique_words = []
    for w in words:
        key = (w["word"].lower(), w["start_ms"])
        if key not in seen:
            seen.add(key)
            unique_words.append(w)

    return unique_words


def vtt_time_to_ms(ts: str) -> int:
    """Convert '00:01:23.456' to milliseconds."""
    parts = ts.split(':')
    h, m = int(parts[0]), int(parts[1])
    s_parts = parts[2].split('.')
    s = int(s_parts[0])
    ms = int(s_parts[1]) if len(s_parts) > 1 else 0
    return (h * 3600 + m * 60 + s) * 1000 + ms


def find_phrase_in_words(words: List[dict]) -> List[dict]:
    """Find all occurrences of 'insider trading' in word list."""
    occurrences = []

    for i in range(len(words) - 1):
        w1 = words[i]["word"].lower().strip().rstrip(".,!?;:'\"")
        w2 = words[i + 1]["word"].lower().strip().rstrip(".,!?;:'\"")

        if w1 == "insider" and w2 == "trading":
            insider_start = words[i]["start_ms"] / 1000.0
            trading_start = words[i + 1]["start_ms"] / 1000.0
            # Estimate end: trading word is ~0.5s long
            trading_end = trading_start + 0.5

            occurrences.append({
                "insider_start": insider_start,
                "trading_start": trading_start,
                "trading_end": trading_end,
            })

    return occurrences


def download_video(url: str, idx: int) -> Path:
    out_path = WORK_DIR / f"raw_{idx:03d}.mp4"
    cmd = [
        YT_DLP,
        "-f", "best[height<=720]/best",
        "--recode-video", "mp4",
        "-o", str(out_path),
        "--no-playlist",
        url
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    if not out_path.exists():
        for f in WORK_DIR.glob(f"raw_{idx:03d}.*"):
            if f.stat().st_size > 10000:
                return f

    if not out_path.exists() or out_path.stat().st_size < 10000:
        raise FileNotFoundError(f"Download failed: {r.stderr[-300:]}")
    return out_path


def cut_clip(video_path: Path, occ: dict, clip_idx: int) -> Path:
    start = max(0, occ["insider_start"] - PAD_BEFORE)
    end = occ["trading_end"] + PAD_AFTER

    clip_path = CLIPS_DIR / f"clip_{clip_idx:03d}.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{start:.3f}",
        "-i", str(video_path),
        "-to", f"{end - start:.3f}",
        "-c:v", "libx264", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        "-movflags", "+faststart",
        str(clip_path)
    ]
    subprocess.run(cmd, capture_output=True, timeout=60)
    return clip_path


def process_url(url: str, idx: int, clip_idx: int) -> Optional[dict]:
    """Process one URL: VTT check -> download -> cut."""
    try:
        title = get_title(url)
        print(f"    Title: {title}")

        # Step 1: Download VTT and find phrase
        print(f"    Checking VTT subs...")
        vtt_path = download_vtt(url, idx)

        if not vtt_path:
            print(f"    No English subs available")
            return None

        words = parse_vtt_word_timestamps(vtt_path)
        occurrences = find_phrase_in_words(words)
        vtt_path.unlink(missing_ok=True)

        if not occurrences:
            print(f"    'insider trading' not found in subs ({len(words)} words parsed)")
            return None

        occ = occurrences[0]  # First occurrence, one per video
        print(f"    Found 'insider trading' at {occ['insider_start']:.2f}s ({len(occurrences)} total)")

        # Step 2: Download video
        print(f"    Downloading video...")
        video_path = download_video(url, idx)
        print(f"    Downloaded ({video_path.stat().st_size // 1024}KB)")

        # Step 3: Cut clip
        print(f"    Cutting clip {clip_idx}...")
        clip_path = cut_clip(video_path, occ, clip_idx)

        # Cleanup
        video_path.unlink(missing_ok=True)

        clip_start = max(0, occ["insider_start"] - PAD_BEFORE)
        return {
            "clip_id": clip_idx,
            "source_url": url,
            "source_title": title,
            "clip_file": clip_path.name,
            "phrase_start": occ["insider_start"],
            "phrase_end": occ["trading_end"],
            "insider_start_in_clip": occ["insider_start"] - clip_start,
            "trading_end_in_clip": occ["trading_end"] - clip_start,
            "context": "insider trading",
            "duration": float(f"{occ['trading_end'] - occ['insider_start'] + PAD_BEFORE + PAD_AFTER:.3f}"),
        }

    except Exception as e:
        print(f"    ERROR: {e}")
        return None


def main():
    ensure_dirs()

    urls_file = Path(__file__).parent.parent / "public" / "insider-trading" / "clip-urls.txt"

    if len(sys.argv) > 1:
        urls = sys.argv[1:]
    elif urls_file.exists():
        urls = []
        for line in urls_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                url = line.split("#")[0].strip() if "#" in line else line
                if url:
                    urls.append(url)
    else:
        print(f"No URLs found")
        sys.exit(1)

    print(f"=== Insider Trading Clip Pipeline v2 (VTT-based) ===")
    print(f"URLs: {len(urls)} | Target: {TARGET_CLIPS} clips\n")

    clips = []
    clip_idx = 0

    for i, url in enumerate(urls):
        print(f"\n[{i+1}/{len(urls)}] {url}")
        result = process_url(url, i, clip_idx)

        if result:
            clips.append(result)
            clip_idx += 1
            print(f"    === Clip {clip_idx}/{TARGET_CLIPS} done ===")

            # Write partial manifest after each clip
            manifest = {"clips": clips, "total": len(clips), "fps": 30}
            MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))

        if clip_idx >= TARGET_CLIPS:
            print(f"\n=== Reached {TARGET_CLIPS} clips! ===")
            break

    print(f"\n=== Done! {len(clips)} clips saved ===")
    print(f"Clips: {CLIPS_DIR}")
    print(f"Manifest: {MANIFEST_PATH}")
    for c in clips:
        print(f"  {c['clip_file']}: {c['source_title'][:60]}")


if __name__ == "__main__":
    main()
