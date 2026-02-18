#!/usr/bin/env python3
"""Scrape last 50 shorts transcripts for a YouTube channel.

Usage:
  scrape-shorts.py <handle> <channel_name> <output_path> [max_count]
  scrape-shorts.py --retry <file1.md> [file2.md ...]
"""

import subprocess
import json
import sys
import os
import re
import html
import time
import random
import warnings
warnings.filterwarnings("ignore")

import requests
from youtube_transcript_api import YouTubeTranscriptApi

# Shared session for direct page fetching
_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
})

# Shared transcript API instance
_api = YouTubeTranscriptApi()

def get_shorts_list(handle, max_count=50):
    """Get list of shorts from a channel's shorts tab."""
    url = f"https://www.youtube.com/@{handle}/shorts"
    cmd = [
        "yt-dlp", "--flat-playlist",
        "--print", "%(id)s\t%(title)s\t%(view_count)s\t%(upload_date)s",
        "--playlist-end", str(max_count),
        url
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    shorts = []
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) >= 4:
            shorts.append({
                "id": parts[0],
                "title": parts[1],
                "views": parts[2],
                "date": parts[3]
            })
        elif len(parts) >= 2:
            shorts.append({
                "id": parts[0],
                "title": parts[1],
                "views": "NA",
                "date": "NA"
            })
    return shorts

def _fetch_captions_direct(video_id, max_retries=4):
    """Fetch captions by scraping the watch page for the timedtext URL."""
    for attempt in range(max_retries):
        try:
            page_url = f"https://www.youtube.com/watch?v={video_id}"
            resp = _session.get(page_url, timeout=15)
            if resp.status_code != 200:
                if attempt < max_retries - 1:
                    time.sleep((2 ** attempt) * 2 + random.uniform(1, 3))
                    continue
                return None

            # Extract captionTracks JSON from page
            match = re.search(r'"captionTracks":(\[.*?\])', resp.text)
            if not match:
                return None

            tracks = json.loads(match.group(1))
            if not tracks:
                return None

            # Pick best track: prefer English manual, then English auto, then any
            best_url = None
            for track in tracks:
                lang = track.get("languageCode", "")
                kind = track.get("kind", "")
                url = track.get("baseUrl", "")
                if lang == "en" and kind != "asr":
                    best_url = url
                    break
            if not best_url:
                for track in tracks:
                    lang = track.get("languageCode", "")
                    url = track.get("baseUrl", "")
                    if lang.startswith("en"):
                        best_url = url
                        break
            if not best_url and tracks:
                best_url = tracks[0].get("baseUrl", "")

            if not best_url:
                return None

            # Unescape the URL
            best_url = best_url.replace("\\u0026", "&")

            # Fetch the captions XML
            time.sleep(random.uniform(0.5, 1.5))
            cap_resp = _session.get(best_url, timeout=15)
            if cap_resp.status_code == 429:
                wait = (2 ** attempt) * 3 + random.uniform(2, 5)
                print(f"    [429 on captions, waiting {wait:.0f}s, retry {attempt+1}/{max_retries}]")
                time.sleep(wait)
                continue
            if cap_resp.status_code != 200:
                return None

            # Parse XML text segments
            texts = re.findall(r"<text[^>]*>(.*?)</text>", cap_resp.text)
            if not texts:
                return None

            full_text = " ".join(html.unescape(t) for t in texts)
            return full_text.strip()

        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep((2 ** attempt) + random.uniform(1, 2))
                continue
            return None
    return None

def get_transcript(video_id, max_retries=3):
    """Get transcript for a video. Tries direct page scraping first, then API."""
    # Method 1: Direct page scraping (bypasses API IP blocks)
    text = _fetch_captions_direct(video_id)
    if text and len(text) > 10:
        return text

    # Method 2: youtube-transcript-api (may be IP blocked)
    for attempt in range(max_retries):
        try:
            t = _api.fetch(video_id)
            return " ".join([x.text for x in t])
        except Exception as e:
            err_name = type(e).__name__
            if "IpBlocked" in err_name or "TooManyRequests" in err_name:
                wait = (2 ** attempt) * 3 + random.uniform(1, 3)
                print(f"    [API rate limited, waiting {wait:.0f}s, retry {attempt+1}/{max_retries}]")
                time.sleep(wait)
                continue
            try:
                t = _api.fetch(video_id, languages=["en", "en-US", "en-GB"])
                return " ".join([x.text for x in t])
            except:
                pass
            return f"ERROR: {str(e)[:200]}"
    return f"ERROR: All methods failed for {video_id}"

def format_views(v):
    """Format view count."""
    if v == "NA" or v == "None" or not v:
        return "N/A"
    try:
        n = int(float(v))
        if n >= 1_000_000:
            return f"{n/1_000_000:.1f}M"
        elif n >= 1_000:
            return f"{n/1_000:.0f}K"
        else:
            return str(n)
    except:
        return v

def format_date(d):
    """Format date from YYYYMMDD to YYYY-MM-DD."""
    if d == "NA" or d == "None" or not d or len(d) < 8:
        return "N/A"
    return f"{d[:4]}-{d[4:6]}-{d[6:8]}"

def scrape_channel(handle, channel_name, output_path, max_count=50):
    """Scrape shorts for a single channel."""
    print(f"[{channel_name}] Fetching shorts list from @{handle}...")
    shorts = get_shorts_list(handle, max_count)
    print(f"[{channel_name}] Found {len(shorts)} shorts. Fetching transcripts...")

    lines = [f"# {channel_name} Shorts Scripts\n"]
    lines.append(f"{len(shorts)} shorts transcripts.\n")
    lines.append("---\n")

    errors = 0
    for i, short in enumerate(shorts):
        vid_id = short["id"]
        title = short["title"]
        views = format_views(short["views"])
        date = format_date(short["date"])
        link = f"https://youtube.com/shorts/{vid_id}"

        print(f"[{channel_name}] ({i+1}/{len(shorts)}) {title[:50]}...")
        transcript = get_transcript(vid_id)
        if transcript.startswith("ERROR:"):
            errors += 1

        lines.append(f"## {i+1}. {title}")
        lines.append(f"**Channel:** {channel_name} | **Views:** {views} | **Date:** {date} | **ID:** {vid_id}")
        lines.append(f"**Link:** {link}\n")
        lines.append("### Script:")
        lines.append(f"{transcript}\n")
        lines.append("---\n")

        # Rate limit: pause between requests to avoid IP blocking
        if i < len(shorts) - 1:
            time.sleep(random.uniform(1.0, 2.5))

    with open(output_path, "w") as f:
        f.write("\n".join(lines))

    print(f"[{channel_name}] Done! Wrote {len(shorts)} shorts to {output_path} ({errors} errors)")
    return len(shorts)

def retry_errors_in_file(file_path):
    """Re-fetch only the ERROR transcripts in an existing file."""
    with open(file_path, "r") as f:
        content = f.read()

    # Find all video IDs that have ERROR transcripts
    # Pattern: **ID:** <video_id>\n**Link:**...\n\n### Script:\nERROR:
    pattern = r'(\*\*ID:\*\* )([a-zA-Z0-9_-]+)(.*?### Script:\n)(ERROR:[^\n]*\n)'
    matches = list(re.finditer(pattern, content, re.DOTALL))

    if not matches:
        print(f"No errors found in {file_path}")
        return 0

    print(f"Found {len(matches)} errors in {file_path}. Retrying...")
    fixed = 0

    for i, match in enumerate(matches):
        vid_id = match.group(2)
        print(f"  Retrying ({i+1}/{len(matches)}) {vid_id}...")
        transcript = get_transcript(vid_id)

        if not transcript.startswith("ERROR:"):
            # Replace the ERROR line with the actual transcript
            old_text = match.group(3) + match.group(4)
            new_text = match.group(3) + transcript + "\n"
            content = content.replace(match.group(0), match.group(1) + match.group(2) + new_text, 1)
            fixed += 1
            print(f"    Fixed! ({len(transcript)} chars)")
        else:
            print(f"    Still failed: {transcript[:80]}")

        # Rate limit between retries
        if i < len(matches) - 1:
            time.sleep(random.uniform(2.0, 4.0))

    with open(file_path, "w") as f:
        f.write(content)

    print(f"Fixed {fixed}/{len(matches)} errors in {file_path}")
    return fixed

if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--retry":
        # Retry mode: fix errors in existing file(s)
        for fpath in sys.argv[2:]:
            retry_errors_in_file(fpath)
    elif len(sys.argv) >= 4:
        handle = sys.argv[1]
        channel_name = sys.argv[2]
        output_path = sys.argv[3]
        max_count = int(sys.argv[4]) if len(sys.argv) > 4 else 50
        scrape_channel(handle, channel_name, output_path, max_count)
    else:
        print("Usage:")
        print("  scrape-shorts.py <handle> <channel_name> <output_path> [max_count]")
        print("  scrape-shorts.py --retry <file1.md> [file2.md ...]")
        sys.exit(1)
