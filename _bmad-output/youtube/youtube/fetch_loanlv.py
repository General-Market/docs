#!/usr/bin/env python3
"""Fetch French transcripts for LoannLV's last 50 videos.
API-only: uses youtube_transcript_api. No audio download."""

import json
import os
import sys
import subprocess
import time

CHANNEL = "LoannLV"
CHANNEL_URL = f"https://www.youtube.com/@{CHANNEL}/videos"
OUTPUT_MD = "/Users/maxguillabert/Downloads/index/youtube/loanlv-long-transcripts.md"
OUTPUT_JSON = "/Users/maxguillabert/Downloads/index/youtube/loanlv-long-transcripts.json"
YTDLP = "/opt/homebrew/bin/yt-dlp"


def get_video_list():
    """Get last 50 videos with metadata in one call."""
    result = subprocess.run([
        YTDLP, '--flat-playlist',
        '--print', '%(id)s|%(title)s|%(view_count)s|%(duration)s|%(upload_date)s',
        '-I', ':50',
        CHANNEL_URL
    ], capture_output=True, text=True, timeout=120)

    videos = []
    for line in result.stdout.strip().split('\n'):
        if not line.strip():
            continue
        parts = line.split('|', 4)
        if len(parts) >= 4:
            vid_id, title, views, duration = parts[0], parts[1], parts[2], parts[3]
            upload_date = parts[4] if len(parts) == 5 else 'NA'
            try:
                secs = int(float(duration))
                dur_str = f"{secs // 60}m{secs % 60:02d}s"
            except:
                dur_str = duration
                secs = None
            if upload_date and upload_date != 'NA' and len(upload_date) == 8:
                date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
            else:
                date = 'N/A'
            videos.append({
                'video_id': vid_id, 'title': title, 'views': views,
                'duration': dur_str, 'duration_seconds': secs, 'date': date
            })
    return videos


def fetch_transcript(vid_id):
    """Get transcript via API. Try fr, then any language."""
    from youtube_transcript_api import YouTubeTranscriptApi
    ytt = YouTubeTranscriptApi()

    # Try French first
    for langs in [['fr'], ['fr-FR']]:
        try:
            transcript = ytt.fetch(vid_id, languages=langs)
            text = ' '.join(s.text for s in transcript.snippets)
            if text and len(text.strip()) > 20:
                return text.strip(), 'api-fr', None
        except:
            continue

    # List available and pick French variant
    try:
        tlist = ytt.list(vid_id)
        for t in tlist:
            if 'fr' in t.language_code.lower():
                transcript = ytt.fetch(vid_id, languages=[t.language_code])
                text = ' '.join(s.text for s in transcript.snippets)
                if text and len(text.strip()) > 20:
                    return text.strip(), f'api-{t.language_code}', None
    except:
        pass

    # Try any available language
    try:
        tlist = ytt.list(vid_id)
        for t in tlist:
            try:
                transcript = ytt.fetch(vid_id, languages=[t.language_code])
                text = ' '.join(s.text for s in transcript.snippets)
                if text and len(text.strip()) > 20:
                    return text.strip(), f'api-{t.language_code}', None
            except:
                continue
    except:
        pass

    return None, None, "no_transcript"


def write_outputs(results):
    ok = sum(1 for r in results if r.get('transcript'))
    fail = len(results) - ok

    with open(OUTPUT_MD, 'w', encoding='utf-8') as f:
        f.write(f"# {CHANNEL} - Long-Form Transcripts (French)\n\n")
        f.write(f"{ok} video transcripts ({fail} unavailable).\n\n")
        f.write("---\n\n")
        for i, r in enumerate(results, 1):
            vid = r.get('video_id', 'unknown')
            f.write(f"## {i}. {r['title']}\n")
            f.write(f"**Channel:** {CHANNEL} | **Views:** {r.get('views', 'N/A')} | **Date:** {r.get('date', 'N/A')} | **Duration:** {r.get('duration', 'N/A')} | **ID:** {vid}\n")
            f.write(f"**Link:** https://youtube.com/watch?v={vid}\n\n")
            f.write("### Transcript:\n")
            if r.get('transcript'):
                f.write(f"{r['transcript']}\n\n")
            else:
                f.write(f"*Transcript unavailable ({r.get('error', 'unknown')})*\n\n")
            f.write("---\n\n")

    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n-> {ok}/{len(results)} transcripts written to {OUTPUT_MD}", flush=True)


def main():
    cached = {}
    if os.path.exists(OUTPUT_JSON):
        try:
            with open(OUTPUT_JSON, 'r', encoding='utf-8') as f:
                for r in json.load(f):
                    vid = r.get('video_id')
                    if vid and r.get('transcript'):
                        cached[vid] = r
        except:
            pass

    print(f"Fetching video list from @{CHANNEL}...", flush=True)
    videos = get_video_list()
    print(f"Found {len(videos)} videos | Cached: {len(cached)}", flush=True)

    if not videos:
        print("ERROR: No videos found.", flush=True)
        sys.exit(1)

    results = []
    for i, v in enumerate(videos):
        vid = v['video_id']

        if vid in cached:
            r = cached[vid].copy()
            r.update({'title': v['title'], 'views': v['views'], 'duration': v['duration'], 'date': v['date']})
            results.append(r)
            print(f"[{i+1}/{len(videos)}] CACHED: {vid}", flush=True)
            continue

        print(f"[{i+1}/{len(videos)}] {vid}:", end=' ', flush=True)

        text, source, error = fetch_transcript(vid)

        if text:
            print(f"OK-{source} ({len(text)} chars)", flush=True)
            results.append({
                'video_id': vid, 'title': v['title'], 'views': v['views'],
                'duration': v['duration'], 'date': v['date'],
                'transcript': text, 'source': source, 'error': None
            })
        else:
            print(f"FAILED ({error})", flush=True)
            results.append({
                'video_id': vid, 'title': v['title'], 'views': v['views'],
                'duration': v['duration'], 'date': v['date'],
                'transcript': None, 'source': None, 'error': error
            })

        if (i + 1) % 5 == 0:
            write_outputs(results)
            ok = sum(1 for r in results if r.get('transcript'))
            print(f"  (progress saved: {ok}/{len(results)})", flush=True)

        time.sleep(1)

    write_outputs(results)
    print("Done!", flush=True)


if __name__ == '__main__':
    main()
