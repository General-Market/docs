#!/usr/bin/env python3
"""Fetch French transcripts for The Valere's last 50 videos.
Uses youtube_transcript_api first, falls back to Whisper for blocked/missing."""

import json
import os
import sys
import subprocess
import tempfile
import time
import re

OUTPUT_MD = "/Users/maxguillabert/Downloads/index/youtube/etf-long-transcripts.md"
OUTPUT_JSON = "/Users/maxguillabert/Downloads/index/youtube/etf-long-transcripts.json"
YTDLP = "/opt/homebrew/bin/yt-dlp"
AUDIO_DIR = tempfile.mkdtemp(prefix="valere_audio_")
WHISPER_MODEL = "tiny"


def get_video_list():
    """Get last 50 videos from The Valere channel."""
    result = subprocess.run([
        YTDLP, '--flat-playlist',
        '--print', '%(id)s|%(title)s|%(view_count)s|%(duration)s',
        '-I', ':50',
        'https://www.youtube.com/@the-valere/videos'
    ], capture_output=True, text=True, timeout=120)

    videos = []
    for line in result.stdout.strip().split('\n'):
        if not line.strip():
            continue
        parts = line.split('|', 3)
        if len(parts) == 4:
            vid_id, title, views, duration = parts
            try:
                secs = int(float(duration))
                mins = secs // 60
                remaining = secs % 60
                dur_str = f"{mins}m{remaining:02d}s"
            except:
                dur_str = duration
                secs = None
            videos.append({
                'video_id': vid_id,
                'title': title,
                'views': views,
                'duration': dur_str,
                'duration_seconds': secs
            })
    return videos


def get_video_metadata(vid_id):
    """Get publish date for a video."""
    try:
        result = subprocess.run([
            YTDLP, '--print', '%(upload_date)s',
            f'https://www.youtube.com/watch?v={vid_id}'
        ], capture_output=True, text=True, timeout=30)
        date = result.stdout.strip()
        if date and date != 'NA' and len(date) == 8:
            return f"{date[:4]}-{date[4:6]}-{date[6:8]}"
        return 'N/A'
    except:
        return 'N/A'


def fetch_transcript_api(vid_id):
    """Try youtube_transcript_api first."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        ytt = YouTubeTranscriptApi()

        for langs in [['fr'], ['fr-FR']]:
            try:
                transcript = ytt.fetch(vid_id, languages=langs)
                text = ' '.join(snippet.text for snippet in transcript.snippets)
                if text and len(text.strip()) > 20:
                    return text.strip(), 'api', None
            except Exception:
                continue

        # Try listing and picking French
        try:
            transcript_list = ytt.list(vid_id)
            for t in transcript_list:
                if 'fr' in t.language_code.lower():
                    transcript = ytt.fetch(vid_id, languages=[t.language_code])
                    text = ' '.join(snippet.text for snippet in transcript.snippets)
                    if text and len(text.strip()) > 20:
                        return text.strip(), 'api', None
        except:
            pass

        return None, None, "no_fr_transcript"
    except Exception as e:
        return None, None, str(e)[:100]


def download_audio(vid_id):
    """Download audio using yt-dlp."""
    output = os.path.join(AUDIO_DIR, f"{vid_id}.%(ext)s")
    mp3_path = os.path.join(AUDIO_DIR, f"{vid_id}.mp3")

    if os.path.exists(mp3_path):
        return mp3_path

    try:
        subprocess.run([
            YTDLP, '-x', '--audio-format', 'mp3',
            '--audio-quality', '5', '--no-warnings', '--no-playlist',
            '-o', output,
            f'https://www.youtube.com/watch?v={vid_id}'
        ], capture_output=True, text=True, timeout=120)

        if os.path.exists(mp3_path):
            return mp3_path

        for ext in ['mp3', 'webm', 'opus', 'm4a']:
            path = os.path.join(AUDIO_DIR, f"{vid_id}.{ext}")
            if os.path.exists(path):
                return path
        return None
    except:
        return None


def transcribe_whisper(audio_path):
    """Transcribe audio using Whisper in French (transcribe, not translate)."""
    try:
        output_dir = os.path.join(AUDIO_DIR, "whisper_out")
        os.makedirs(output_dir, exist_ok=True)

        cmd = [
            'whisper', audio_path,
            '--model', WHISPER_MODEL,
            '--task', 'transcribe',
            '--language', 'fr',
            '--output_format', 'txt',
            '--output_dir', output_dir
        ]

        subprocess.run(cmd, capture_output=True, text=True, timeout=300)

        base = os.path.splitext(os.path.basename(audio_path))[0]
        txt_path = os.path.join(output_dir, f"{base}.txt")

        if os.path.exists(txt_path):
            with open(txt_path, 'r', encoding='utf-8') as f:
                text = f.read().strip()
            os.remove(txt_path)
            if len(text) > 20:
                return text, None
        return None, "whisper_empty"
    except Exception as e:
        return None, str(e)[:100]


def write_outputs(results):
    ok = sum(1 for r in results if r.get('transcript'))
    fail = len(results) - ok

    with open(OUTPUT_MD, 'w', encoding='utf-8') as f:
        f.write("# The Valere - Long-Form Transcripts (French)\n\n")
        f.write(f"{ok} video transcripts ({fail} unavailable).\n\n")
        f.write("---\n\n")

        for i, r in enumerate(results, 1):
            vid = r.get('video_id', 'unknown')
            f.write(f"## {i}. {r['title']}\n")
            f.write(f"**Channel:** The Valere | **Views:** {r.get('views', 'N/A')} | **Date:** {r.get('date', 'N/A')} | **Duration:** {r.get('duration', 'N/A')} | **ID:** {vid}\n")
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
    # Load cache - keep transcripts we already have
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

    print("Fetching video list...", flush=True)
    videos = get_video_list()
    print(f"Found {len(videos)} videos | Cached: {len(cached)}", flush=True)
    print(f"Audio dir: {AUDIO_DIR}", flush=True)

    api_blocked = False
    results = []

    for i, v in enumerate(videos):
        vid = v['video_id']

        if vid in cached:
            r = cached[vid].copy()
            r.update({'title': v['title'], 'views': v['views'], 'duration': v['duration']})
            results.append(r)
            print(f"[{i+1}/{len(videos)}] CACHED: {vid}", flush=True)
            continue

        print(f"[{i+1}/{len(videos)}] {vid}:", end=' ', flush=True)

        # Get metadata
        date = get_video_metadata(vid)

        # Try API first if not blocked
        text = None
        source = None
        error = None

        if not api_blocked:
            print("api...", end=' ', flush=True)
            text, source, error = fetch_transcript_api(vid)
            if error and 'blocking' in str(error).lower():
                api_blocked = True
                print("BLOCKED!", end=' ', flush=True)
                text = None

        # Fallback to Whisper
        if not text:
            print("download...", end=' ', flush=True)
            audio_path = download_audio(vid)
            if audio_path:
                print("whisper...", end=' ', flush=True)
                text, error = transcribe_whisper(audio_path)
                if text:
                    source = 'whisper'
                # Clean up
                try:
                    os.remove(audio_path)
                except:
                    pass
            else:
                print("DOWNLOAD FAILED", end=' ', flush=True)
                error = "download_failed"

        if text:
            print(f"OK-{source} ({len(text)} chars)", flush=True)
            results.append({
                'video_id': vid, 'title': v['title'], 'views': v['views'],
                'duration': v['duration'], 'date': date,
                'transcript': text, 'source': source, 'error': None
            })
        else:
            print(f"FAILED ({error})", flush=True)
            results.append({
                'video_id': vid, 'title': v['title'], 'views': v['views'],
                'duration': v['duration'], 'date': date,
                'transcript': None, 'source': None, 'error': error
            })

        # Save progress every 5 videos
        if (i + 1) % 5 == 0:
            write_outputs(results)
            ok = sum(1 for r in results if r.get('transcript'))
            print(f"  (progress saved: {ok}/{len(results)})", flush=True)

        time.sleep(0.5)

    write_outputs(results)
    print("Done!", flush=True)


if __name__ == '__main__':
    main()
