#!/usr/bin/env python3
"""
Fetch YouTube transcripts for all YC launches.
Uses youtube-transcript-api. Resumable via checkpoint file.
"""

import csv
import json
import os
import re
import sys
import time

from youtube_transcript_api import YouTubeTranscriptApi

INPUT_JSON = "yc_launches.json"
OUTPUT_CSV = "yc_launches_with_transcripts.csv"
OUTPUT_JSON = "yc_launches_with_transcripts.json"
FAILED_LOG = "yc_transcript_failures.json"
CHECKPOINT = "yc_transcripts_checkpoint.json"

api = YouTubeTranscriptApi()


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


def fetch_transcript(video_id):
    try:
        result = api.fetch(video_id, languages=['en'])
        snippets = list(result)
        if not snippets:
            return "", "no_transcript"
        text = " ".join(s.text for s in snippets)
        return text.strip(), "ok"
    except Exception as e:
        err = str(e)
        if "No transcripts" in err or "TranscriptsDisabled" in err or "NoTranscript" in err or "disabled" in err.lower():
            return "", "no_transcript"
        return "", "error: " + err.split('\n')[0][:150]


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
    print("Loaded %d launches" % len(data))

    checkpoint = load_checkpoint()
    print("Checkpoint: %d videos already processed" % len(checkpoint))

    yt_launches = []
    for r in data:
        if not r["video_urls"]:
            continue
        urls = r["video_urls"].split(" | ")
        for url in urls:
            vid = extract_youtube_id(url)
            if vid:
                r["_yt_id"] = vid
                yt_launches.append(r)
                break

    print("Launches with YouTube videos: %d" % len(yt_launches))

    ok_count = 0
    no_transcript_count = 0
    error_count = 0
    skipped = 0
    consecutive_errors = 0

    for i, r in enumerate(yt_launches):
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
            # If 20 consecutive errors, likely rate limited — pause
            if consecutive_errors >= 20:
                print("  ** 20 consecutive errors, saving and sleeping 60s...")
                save_checkpoint(checkpoint)
                time.sleep(60)
                consecutive_errors = 0

        if (i + 1) % 50 == 0 or i == len(yt_launches) - 1:
            print("  [%d/%d] ok=%d no_transcript=%d error=%d (skipped=%d)" % (
                i + 1, len(yt_launches), ok_count, no_transcript_count, error_count, skipped))

        time.sleep(3)  # 3s between requests — avoid IP burn

    save_checkpoint(checkpoint)

    # Include non-YouTube launches
    no_video_launches = [r for r in data if not r.get("_yt_id")]
    for r in no_video_launches:
        r["transcript"] = ""
        r["transcript_status"] = "no_video"

    all_rows = yt_launches + no_video_launches
    all_rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)

    fieldnames = [
        "id", "title", "tagline", "company_name", "company_url",
        "batch", "industry", "created_at", "votes", "launch_url",
        "video_urls", "transcript_status", "transcript", "body_text",
    ]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)

    for r in all_rows:
        r.pop("_yt_id", None)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(all_rows, f, indent=2, ensure_ascii=False)

    failures = []
    for r in yt_launches:
        st = r.get("transcript_status", "")
        if st != "ok":
            vid = extract_youtube_id(r.get("video_urls", "").split(" | ")[0]) or ""
            failures.append({"id": r["id"], "title": r["title"], "yt_id": vid, "status": st})
    with open(FAILED_LOG, "w") as f:
        json.dump(failures, f, indent=2, ensure_ascii=False)

    print("\nDone!")
    print("  Transcripts fetched: %d" % ok_count)
    print("  No transcript: %d" % no_transcript_count)
    print("  Errors: %d" % error_count)
    print("  No video (text only): %d" % len(no_video_launches))
    print("  Total rows: %d" % len(all_rows))
    print("  CSV: %s" % OUTPUT_CSV)
    print("  Checkpoint: %s (delete to start fresh)" % CHECKPOINT)


if __name__ == "__main__":
    main()
