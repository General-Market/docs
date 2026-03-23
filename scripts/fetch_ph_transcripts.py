#!/usr/bin/env python3
"""
Fetch YouTube transcripts for Product Hunt daily top products.
Uses pytubefix. Resumable via checkpoint.
"""

import csv
import json
import os
import re
import time

from pytubefix import YouTube

INPUT_JSON = "ph_daily_top.json"
OUTPUT_CSV = "ph_daily_top_with_transcripts.csv"
OUTPUT_JSON = "ph_daily_top_with_transcripts.json"
CHECKPOINT = "ph_transcripts_checkpoint.json"


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


def srt_to_text(srt):
    lines = []
    for line in srt.split('\n'):
        line = line.strip()
        if not line or line.isdigit() or '-->' in line:
            continue
        lines.append(line)
    return ' '.join(lines)


def fetch_transcript(video_id):
    try:
        yt = YouTube('https://www.youtube.com/watch?v=' + video_id)
        caps = yt.captions
        if not caps:
            return "", "no_transcript"

        chosen = None
        cap_list = list(caps)
        for c in cap_list:
            if c.code == 'en':
                chosen = c
                break
        if not chosen:
            for c in cap_list:
                if c.code.startswith('en') or c.code == 'a.en':
                    chosen = c
                    break
        if not chosen:
            chosen = cap_list[0]

        srt = chosen.generate_srt_captions()
        text = srt_to_text(srt)
        if not text or len(text) < 5:
            return "", "no_transcript"
        return text, "ok"
    except Exception as e:
        err = str(e).split('\n')[0][:150]
        if "no captions" in err.lower():
            return "", "no_transcript"
        return "", "error: " + err


def load_checkpoint():
    if os.path.exists(CHECKPOINT):
        return json.load(open(CHECKPOINT))
    return {}


def save_checkpoint(data):
    with open(CHECKPOINT + ".tmp", "w") as f:
        json.dump(data, f)
    os.replace(CHECKPOINT + ".tmp", CHECKPOINT)


def main():
    data = json.load(open(INPUT_JSON))
    print("Loaded %d PH products" % len(data))

    checkpoint = load_checkpoint()
    print("Checkpoint: %d videos already processed" % len(checkpoint))

    # Filter to those with YouTube URLs
    yt_products = []
    for r in data:
        if not r.get("video_urls"):
            continue
        urls = r["video_urls"].split(" | ")
        for url in urls:
            vid = extract_youtube_id(url)
            if vid:
                r["_yt_id"] = vid
                yt_products.append(r)
                break

    print("Products with YouTube videos: %d" % len(yt_products))

    ok_count = 0
    no_transcript_count = 0
    error_count = 0
    skipped = 0
    consecutive_errors = 0

    for i, r in enumerate(yt_products):
        vid = r["_yt_id"]

        if vid in checkpoint:
            r["transcript"] = checkpoint[vid]["text"]
            r["transcript_status"] = checkpoint[vid]["status"]
            if checkpoint[vid]["status"] == "ok":
                ok_count += 1
            elif checkpoint[vid]["status"] == "no_transcript":
                no_transcript_count += 1
            else:
                error_count += 1
            skipped += 1
            continue

        text, status = fetch_transcript(vid)
        r["transcript"] = text
        r["transcript_status"] = status
        checkpoint[vid] = {"text": text, "status": status}

        if (i + 1 - skipped) % 10 == 0:
            save_checkpoint(checkpoint)

        if status == "ok":
            ok_count += 1
            consecutive_errors = 0
        elif status == "no_transcript":
            no_transcript_count += 1
            consecutive_errors = 0
        else:
            error_count += 1
            consecutive_errors += 1
            if consecutive_errors >= 20:
                print("  ** 20 consecutive errors, sleeping 60s...")
                save_checkpoint(checkpoint)
                time.sleep(60)
                consecutive_errors = 0

        if (i + 1) % 50 == 0 or i == len(yt_products) - 1:
            print("  [%d/%d] ok=%d no_transcript=%d error=%d (skipped=%d)" % (
                i + 1, len(yt_products), ok_count, no_transcript_count, error_count, skipped))

        time.sleep(2)

    save_checkpoint(checkpoint)

    # Include non-YouTube products
    no_video = [r for r in data if not r.get("_yt_id")]
    for r in no_video:
        r["transcript"] = ""
        r["transcript_status"] = "no_video"

    all_rows = yt_products + no_video
    all_rows.sort(key=lambda r: (r.get("date", ""), r.get("rank", 99)), reverse=True)

    fieldnames = [
        "date", "rank", "id", "name", "tagline", "description", "website", "url",
        "created_at", "votes", "comments", "topics", "makers",
        "video_urls", "transcript_status", "transcript",
    ]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)

    for r in all_rows:
        r.pop("_yt_id", None)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(all_rows, f, indent=2, ensure_ascii=False)

    print("\nDone!")
    print("  Transcripts: %d" % ok_count)
    print("  No transcript: %d" % no_transcript_count)
    print("  Errors: %d" % error_count)
    print("  No video: %d" % len(no_video))
    print("  CSV: %s" % OUTPUT_CSV)


if __name__ == "__main__":
    main()
