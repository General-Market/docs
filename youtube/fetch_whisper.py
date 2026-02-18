#!/usr/bin/env python3
"""
Fetch YouTube Shorts transcripts using yt-dlp + Whisper.
Downloads audio, transcribes locally. Translates non-English to English.
"""

import csv
import re
import json
import os
import sys
import subprocess
import tempfile
import time
from urllib.parse import unquote

CSV_PATH = "/Users/maxguillabert/Downloads/etf-youtube-data-1.csv"
OUTPUT_PATH = "/Users/maxguillabert/Downloads/index/youtube/etf-shorts-transcripts.md"
JSON_PATH = "/Users/maxguillabert/Downloads/index/youtube/etf-shorts-transcripts.json"
YTDLP = "/opt/homebrew/bin/yt-dlp"
AUDIO_DIR = tempfile.mkdtemp(prefix="yt_audio_")
WHISPER_MODEL = "tiny"  # tiny for speed, small for quality

def extract_video_id(url):
    m = re.search(r'shorts/([a-zA-Z0-9_-]+)', url)
    return m.group(1) if m else None

def extract_channel_name(channel_url):
    m = re.search(r'@(.+)$', channel_url)
    return unquote(m.group(1)) if m else channel_url

def download_audio(video_id):
    """Download audio using yt-dlp."""
    output = os.path.join(AUDIO_DIR, f"{video_id}.%(ext)s")
    mp3_path = os.path.join(AUDIO_DIR, f"{video_id}.mp3")

    if os.path.exists(mp3_path):
        return mp3_path

    try:
        result = subprocess.run([
            YTDLP,
            '-x', '--audio-format', 'mp3',
            '--audio-quality', '5',
            '--no-warnings',
            '--no-playlist',
            '-o', output,
            f"https://www.youtube.com/shorts/{video_id}"
        ], capture_output=True, text=True, timeout=60)

        if os.path.exists(mp3_path):
            return mp3_path

        # Check for other extensions
        for ext in ['mp3', 'webm', 'opus', 'm4a']:
            path = os.path.join(AUDIO_DIR, f"{video_id}.{ext}")
            if os.path.exists(path):
                return path

        return None
    except Exception as e:
        return None

def transcribe_audio(audio_path, task="transcribe"):
    """Transcribe audio using Whisper CLI. task='translate' for English translation."""
    try:
        output_dir = os.path.join(AUDIO_DIR, "whisper_out")
        os.makedirs(output_dir, exist_ok=True)

        cmd = [
            'whisper', audio_path,
            '--model', WHISPER_MODEL,
            '--task', task,
            '--output_format', 'txt',
            '--output_dir', output_dir
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        # Read the output text file
        base = os.path.splitext(os.path.basename(audio_path))[0]
        txt_path = os.path.join(output_dir, f"{base}.txt")

        if os.path.exists(txt_path):
            with open(txt_path, 'r', encoding='utf-8') as f:
                text = f.read().strip()
            os.remove(txt_path)
            return text

        return None
    except Exception as e:
        return None

def detect_language(audio_path):
    """Detect language of audio using Whisper."""
    try:
        result = subprocess.run([
            'whisper', audio_path,
            '--model', WHISPER_MODEL,
            '--task', 'transcribe',
            '--output_format', 'txt',
            '--output_dir', os.path.join(AUDIO_DIR, "detect_out"),
            '--language', 'auto'
        ], capture_output=True, text=True, timeout=60)

        # Parse stderr for detected language
        for line in result.stderr.split('\n'):
            if 'Detected language' in line:
                m = re.search(r'Detected language:\s*(\w+)', line)
                if m:
                    return m.group(1).lower()
        return None
    except:
        return None

def main():
    # Load cached results
    cached = {}
    if os.path.exists(JSON_PATH):
        try:
            with open(JSON_PATH, 'r', encoding='utf-8') as f:
                for r in json.load(f):
                    vid = r.get('video_id')
                    if vid and r.get('transcript'):
                        cached[vid] = r
        except Exception:
            pass

    videos = []
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            videos.append(row)

    to_fetch = sum(1 for v in videos if extract_video_id(v['Video URL']) and extract_video_id(v['Video URL']) not in cached)
    print(f"Videos: {len(videos)} | Cached: {len(cached)} | To fetch: {to_fetch}", flush=True)
    print(f"Audio dir: {AUDIO_DIR}", flush=True)
    print(f"Whisper model: {WHISPER_MODEL}", flush=True)

    results = []

    for i, v in enumerate(videos):
        title = v['Title']
        url = v['Video URL']
        views = v['Views Number']
        date = v['Date the video uploaded']
        channel_name = extract_channel_name(v['Channel URL of the video'])
        vid = extract_video_id(url)

        if not vid:
            results.append(dict(title=title, url=url, views=views, date=date,
                                channel_name=channel_name, video_id=None,
                                transcript=None, lang=None, error='No ID'))
            continue

        if vid in cached:
            r = cached[vid].copy()
            r.update(dict(title=title, url=url, views=views, date=date, channel_name=channel_name))
            results.append(r)
            print(f"[{i+1}/{len(videos)}] CACHED: {vid}", flush=True)
            continue

        print(f"[{i+1}/{len(videos)}] {vid}: downloading...", end=' ', flush=True)

        # Download audio
        audio_path = download_audio(vid)
        if not audio_path:
            print("DOWNLOAD FAILED", flush=True)
            results.append(dict(title=title, url=url, views=views, date=date,
                                channel_name=channel_name, video_id=vid,
                                transcript=None, lang=None, error='download_failed'))
            continue

        print("transcribing...", end=' ', flush=True)

        # Always use translate task - Whisper will transcribe English as-is
        # and translate other languages to English
        text = transcribe_audio(audio_path, task="translate")

        if text and len(text.strip()) > 10:
            print(f"OK ({len(text)} chars)", flush=True)
            results.append(dict(title=title, url=url, views=views, date=date,
                                channel_name=channel_name, video_id=vid,
                                transcript=text.strip(), lang='en(whisper)', error=None))
        else:
            # Try regular transcribe as fallback
            text = transcribe_audio(audio_path, task="transcribe")
            if text and len(text.strip()) > 10:
                print(f"OK-orig ({len(text)} chars)", flush=True)
                results.append(dict(title=title, url=url, views=views, date=date,
                                    channel_name=channel_name, video_id=vid,
                                    transcript=text.strip(), lang='orig(whisper)', error=None))
            else:
                print("TRANSCRIBE FAILED", flush=True)
                results.append(dict(title=title, url=url, views=views, date=date,
                                    channel_name=channel_name, video_id=vid,
                                    transcript=None, lang=None, error='transcribe_failed'))

        # Clean up audio file
        try:
            os.remove(audio_path)
        except:
            pass

        # Save progress every 5 videos
        if (i + 1) % 5 == 0:
            write_outputs(results)
            print(f"  (progress saved: {sum(1 for r in results if r.get('transcript'))}/{len(results)})", flush=True)

        time.sleep(1)

    write_outputs(results)

def write_outputs(results):
    ok = sum(1 for r in results if r.get('transcript'))
    fail = len(results) - ok

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write("# ETF YouTube Shorts Transcripts\n\n")
        f.write(f"{ok} shorts transcripts ({fail} unavailable).\n\n")
        f.write("---\n\n")

        for i, r in enumerate(results, 1):
            vid = r.get('video_id', 'unknown')
            f.write(f"## {i}. {r['title']}\n")
            f.write(f"**Channel:** {r.get('channel_name', 'N/A')} | **Views:** {r['views']} | **Date:** {r['date']} | **ID:** {vid}\n")
            f.write(f"**Link:** https://youtube.com/shorts/{vid}\n\n")
            f.write("### Script:\n")
            if r.get('transcript'):
                f.write(f"{r['transcript']}\n\n")
            else:
                f.write(f"*Transcript unavailable*\n\n")
            f.write("---\n\n")

    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n-> {ok}/{len(results)} transcripts written to {OUTPUT_PATH}", flush=True)

if __name__ == '__main__':
    main()
