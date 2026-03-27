#!/usr/bin/env python3
"""Analyze PH launch videos (no transcript). Same pipeline as YC."""

import json
import os
import sys
import glob
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(__file__))
from analyze_yc_videos import analyze_video

VIDEO_DIR = "ph_videos_notranscript"
OUTPUT_DIR = "ph_video_analyses"


def process_one(video_path):
    vid = os.path.splitext(os.path.basename(video_path))[0]
    out_path = os.path.join(OUTPUT_DIR, f"{vid}.json")
    if os.path.exists(out_path):
        try:
            existing = json.load(open(out_path))
            if existing.get("status") == "ok":
                return vid, None
        except Exception:
            pass
    try:
        result = analyze_video(video_path)
        with open(out_path, "w") as f:
            json.dump(result, f, indent=2)
        return vid, result.get("status")
    except Exception as e:
        return vid, f"error: {str(e)[:60]}"


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    videos = sorted(glob.glob(os.path.join(VIDEO_DIR, "*.mp4")))
    videos = [v for v in videos if os.path.getsize(v) > 1000]
    print(f"PH videos to analyze: {len(videos)}")

    ok = fail = 0
    t0 = time.time()
    with ProcessPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(process_one, v): v for v in videos}
        for future in as_completed(futures):
            vid, status = future.result()
            if status == "ok":
                ok += 1
                print(f"  [{ok+fail}/{len(videos)}] OK: {vid}")
            elif status is not None:
                fail += 1
                print(f"  [{ok+fail}/{len(videos)}] FAIL: {vid} — {status}")

    print(f"\nDone! ok={ok} fail={fail} in {time.time()-t0:.0f}s")
