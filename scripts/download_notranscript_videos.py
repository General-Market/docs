#!/usr/bin/env python3
"""
Download MP4s for YC launch videos that have no transcript.
Reads from checkpoint to find no_transcript videos.
Resumable — skips already-downloaded files.
"""

import json
import os
import re
import subprocess
import sys
import time

CHECKPOINT = "yc_transcripts_checkpoint.json"
LAUNCHES_JSON = "yc_launches.json"
OUTPUT_DIR = "yc_videos_notranscript"


def extract_youtube_id(url):
    patterns = [
        r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
        r'youtu\.be/([a-zA-Z0-9_-]{11})',
        r'youtube\.com/embed/([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    checkpoint = json.load(open(CHECKPOINT))
    launches = json.load(open(LAUNCHES_JSON))

    # Find no-transcript video IDs
    no_tr_ids = set(k for k, v in checkpoint.items() if v["status"] == "no_transcript")
    print("Videos with no transcript: %d" % len(no_tr_ids))

    # Map video IDs to launch info
    to_download = []
    for r in launches:
        if not r.get("video_urls"):
            continue
        urls = r["video_urls"].split(" | ")
        for url in urls:
            vid = extract_youtube_id(url)
            if vid and vid in no_tr_ids:
                to_download.append({
                    "id": vid,
                    "title": r.get("title", "unknown"),
                    "company": r.get("company_name", "unknown"),
                    "url": "https://www.youtube.com/watch?v=" + vid,
                })
                break

    print("To download: %d" % len(to_download))

    ok = 0
    skip = 0
    fail = 0

    for i, v in enumerate(to_download):
        out_path = os.path.join(OUTPUT_DIR, v["id"] + ".mp4")

        if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
            skip += 1
            continue

        try:
            result = subprocess.run(
                [
                    "yt-dlp",
                    "--no-warnings",
                    "-f", "worst[ext=mp4]",  # Smallest MP4 — we only need text from frames
                    "-o", out_path,
                    "--no-playlist",
                    "--socket-timeout", "15",
                    v["url"],
                ],
                capture_output=True, text=True, timeout=60,
            )
            if result.returncode == 0 and os.path.exists(out_path):
                ok += 1
                print("  [%d/%d] OK: %s (%s)" % (i + 1, len(to_download), v["company"], v["id"]))
            else:
                fail += 1
                err = result.stderr.split('\n')[-2] if result.stderr else "unknown"
                print("  [%d/%d] FAIL: %s — %s" % (i + 1, len(to_download), v["company"], err[:80]))
        except subprocess.TimeoutExpired:
            fail += 1
            print("  [%d/%d] TIMEOUT: %s" % (i + 1, len(to_download), v["company"]))
        except Exception as e:
            fail += 1
            print("  [%d/%d] ERROR: %s — %s" % (i + 1, len(to_download), v["company"], str(e)[:80]))

        time.sleep(2)

    print("\nDone! ok=%d skip=%d fail=%d" % (ok, skip, fail))
    print("Videos in: %s/" % OUTPUT_DIR)


if __name__ == "__main__":
    main()
