#!/usr/bin/env python3
"""
Download MP4s for PH launch videos that have no transcript.
Uses pytubefix. Resumable — skips already-downloaded files.
"""

import json
import os
import re
import time

from pytubefix import YouTube

CHECKPOINT = "ph_transcripts_checkpoint.json"
LAUNCHES_JSON = "ph_daily_top.json"
OUTPUT_DIR = "ph_videos_notranscript"


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

    no_tr_ids = set(k for k, v in checkpoint.items() if v["status"] == "no_transcript")
    print("PH videos with no transcript: %d" % len(no_tr_ids))

    to_download = []
    seen = set()
    for r in launches:
        if not r.get("video_urls"):
            continue
        urls = r["video_urls"].split(" | ")
        for url in urls:
            vid = extract_youtube_id(url)
            if vid and vid in no_tr_ids and vid not in seen:
                seen.add(vid)
                to_download.append({
                    "id": vid,
                    "name": r.get("name", "unknown"),
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
            yt = YouTube("https://www.youtube.com/watch?v=" + v["id"])
            stream = yt.streams.filter(
                file_extension="mp4", progressive=True
            ).order_by("resolution").first()

            if not stream:
                fail += 1
                print("  [%d/%d] NO STREAM: %s" % (i + 1, len(to_download), v["name"]))
                continue

            stream.download(output_path=OUTPUT_DIR, filename=v["id"] + ".mp4")
            ok += 1
            size_mb = os.path.getsize(out_path) / 1024 / 1024
            print("  [%d/%d] OK: %s — %s (%.1fMB)" % (
                i + 1, len(to_download), v["name"], stream.resolution, size_mb))

        except Exception as e:
            fail += 1
            err = str(e).split('\n')[0][:80]
            print("  [%d/%d] FAIL: %s — %s" % (i + 1, len(to_download), v["name"], err))

        time.sleep(2)

    print("\nDone! ok=%d skip=%d fail=%d" % (ok, skip, fail))
    print("Videos in: %s/" % OUTPUT_DIR)


if __name__ == "__main__":
    main()
