#!/usr/bin/env python3
"""Scrape last 50 long-form video transcripts for a YouTube channel.

Uses video-stats .md files to get video IDs (fast), then fetches transcripts.
Falls back to yt-dlp listing if no stats file exists.

Usage:
  scrape-long.py <handle> <channel_name> <output_path> [max_count]
  scrape-long.py --retry <file1.md> [file2.md ...]

Exit codes:
  0 = success
  2 = rate limited (IP blocked)
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

STATS_DIR = '/Users/maxguillabert/Downloads/index/_bmad-output/youtube/channels/video-stats'

# Shared session for direct page fetching
_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
})

# Shared transcript API instance
_api = YouTubeTranscriptApi()

# Track consecutive rate limits
_rate_limit_count = 0
_RATE_LIMIT_THRESHOLD = 5  # Exit after 5 consecutive rate limits


def get_videos_from_stats(channel_name, max_count=50):
    """Get video list from existing video-stats markdown file."""
    safe = re.sub(r'[^a-z0-9-]', '-', channel_name.lower()).strip('-')
    safe = re.sub(r'-+', '-', safe)
    stats_path = os.path.join(STATS_DIR, f"{safe}.md")

    if not os.path.exists(stats_path):
        return None

    videos = []
    with open(stats_path) as f:
        for line in f:
            # Parse: | 1 | Title | 836.8K | 2026-02-05 | 10:04 |
            m = re.match(r'\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*([\d.]+[KMB]?)\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|', line)
            if not m:
                continue
            title = m.group(2).strip()
            views = m.group(3)
            date = m.group(4)
            duration = m.group(5)

            # We need the video ID — not in stats file, need to look it up
            # Actually stats files don't have IDs. Fall back to yt-dlp.
            pass

    # Stats files don't contain video IDs, return None to use yt-dlp
    return None


def get_videos_list(handle, max_count=50):
    """Get list of videos from a channel's videos tab via yt-dlp flat-playlist + browse API."""
    url = f"https://www.youtube.com/@{handle}/videos"

    # Use browse API for speed (gets IDs, titles, views, dates, durations in ~2-3s)
    try:
        req = requests.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }, timeout=15)

        if req.status_code == 429:
            return "RATE_LIMITED"

        match = re.search(r'var ytInitialData = ({.*?});</script>', req.text)
        if not match:
            return []

        data = json.loads(match.group(1))
        tabs = data.get('contents', {}).get('twoColumnBrowseResultsRenderer', {}).get('tabs', [])

        videos = []
        continuation_token = None

        for tab in tabs:
            tr = tab.get('tabRenderer', {})
            if tr.get('title') == 'Videos':
                grid = tr.get('content', {}).get('richGridRenderer', {})
                if not grid:
                    break
                contents = grid.get('contents', [])
                vids, continuation_token = _extract_videos(contents)
                videos.extend(vids)
                break

        # Continuation for more videos
        while len(videos) < max_count and continuation_token:
            api_url = "https://www.youtube.com/youtubei/v1/browse"
            payload = json.dumps({
                "continuation": continuation_token,
                "context": {"client": {"clientName": "WEB", "clientVersion": "2.20240101.00.00"}}
            }).encode()

            resp = requests.post(api_url, data=payload,
                                 headers={'Content-Type': 'application/json',
                                          'User-Agent': 'Mozilla/5.0'},
                                 timeout=15)

            if resp.status_code == 429:
                break

            data2 = resp.json()
            continuation_token = None
            for action in data2.get('onResponseReceivedActions', []):
                items = action.get('appendContinuationItemsAction', {}).get('continuationItems', [])
                new_vids, continuation_token = _extract_videos(items)
                videos.extend(new_vids)

        return videos[:max_count]

    except Exception as e:
        if '429' in str(e):
            return "RATE_LIMITED"
        # Fallback to yt-dlp
        return _get_videos_ytdlp(handle, max_count)


def _extract_videos(items):
    """Extract video data from richGridRenderer items."""
    videos = []
    continuation_token = None

    for item in items:
        vid = item.get('richItemRenderer', {}).get('content', {}).get('videoRenderer', {})
        if vid:
            title = vid.get('title', {}).get('runs', [{}])[0].get('text', '')
            vid_id = vid.get('videoId', '')
            views_text = vid.get('viewCountText', {}).get('simpleText', '')
            pub_text = vid.get('publishedTimeText', {}).get('simpleText', '')
            length = vid.get('lengthText', {}).get('simpleText', '')

            # Parse views
            views_num = views_text.replace(',', '').replace(' views', '').replace(' view', '').strip()
            try:
                views_int = int(views_num)
            except:
                views_int = 0

            videos.append({
                'id': vid_id,
                'title': title,
                'views': views_int,
                'date': pub_text,
                'duration': length,
            })

        cont = item.get('continuationItemRenderer', {}).get('continuationEndpoint', {}).get('continuationCommand', {}).get('token')
        if cont:
            continuation_token = cont

    return videos, continuation_token


def _get_videos_ytdlp(handle, max_count):
    """Fallback: get videos via yt-dlp."""
    url = f"https://www.youtube.com/@{handle}/videos"
    cmd = [
        "yt-dlp", "--flat-playlist",
        "--print", "%(id)s\t%(title)s\t%(view_count)s\t%(duration_string)s",
        "--playlist-end", str(max_count),
        url
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        videos = []
        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) >= 4:
                try:
                    views = int(float(parts[2]))
                except:
                    views = 0
                videos.append({
                    'id': parts[0],
                    'title': parts[1],
                    'views': views,
                    'date': 'N/A',
                    'duration': parts[3],
                })
        return videos
    except:
        return []


def _fetch_captions_direct(video_id, max_retries=4):
    """Fetch captions by scraping the watch page for the timedtext URL."""
    global _rate_limit_count

    for attempt in range(max_retries):
        try:
            page_url = f"https://www.youtube.com/watch?v={video_id}"
            resp = _session.get(page_url, timeout=15)

            if resp.status_code == 429:
                _rate_limit_count += 1
                if _rate_limit_count >= _RATE_LIMIT_THRESHOLD:
                    return "RATE_LIMITED"
                wait = (2 ** attempt) * 3 + random.uniform(2, 5)
                print(f"    [429 on page, waiting {wait:.0f}s, retry {attempt+1}/{max_retries}]")
                time.sleep(wait)
                continue

            if resp.status_code != 200:
                if attempt < max_retries - 1:
                    time.sleep((2 ** attempt) * 2 + random.uniform(1, 3))
                    continue
                return None

            # Reset rate limit counter on success
            _rate_limit_count = 0

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

            best_url = best_url.replace("\\u0026", "&")

            time.sleep(random.uniform(0.5, 1.5))
            cap_resp = _session.get(best_url, timeout=15)
            if cap_resp.status_code == 429:
                _rate_limit_count += 1
                if _rate_limit_count >= _RATE_LIMIT_THRESHOLD:
                    return "RATE_LIMITED"
                wait = (2 ** attempt) * 3 + random.uniform(2, 5)
                print(f"    [429 on captions, waiting {wait:.0f}s, retry {attempt+1}/{max_retries}]")
                time.sleep(wait)
                continue
            if cap_resp.status_code != 200:
                return None

            texts = re.findall(r"<text[^>]*>(.*?)</text>", cap_resp.text)
            if not texts:
                return None

            full_text = " ".join(html.unescape(t) for t in texts)
            _rate_limit_count = 0
            return full_text.strip()

        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep((2 ** attempt) + random.uniform(1, 2))
                continue
            return None
    return None


def get_transcript(video_id, max_retries=3):
    """Get transcript for a video. Tries direct page scraping first, then API."""
    global _rate_limit_count

    # Method 1: Direct page scraping
    text = _fetch_captions_direct(video_id)
    if text == "RATE_LIMITED":
        return "RATE_LIMITED"
    if text and len(text) > 10:
        return text

    # Method 2: youtube-transcript-api
    for attempt in range(max_retries):
        try:
            t = _api.fetch(video_id)
            _rate_limit_count = 0
            return " ".join([x.text for x in t])
        except Exception as e:
            err_name = type(e).__name__
            err_str = str(e)
            if "IpBlocked" in err_name or "TooManyRequests" in err_name or "429" in err_str:
                _rate_limit_count += 1
                if _rate_limit_count >= _RATE_LIMIT_THRESHOLD:
                    return "RATE_LIMITED"
                wait = (2 ** attempt) * 3 + random.uniform(1, 3)
                print(f"    [API rate limited, waiting {wait:.0f}s, retry {attempt+1}/{max_retries}]")
                time.sleep(wait)
                continue
            try:
                t = _api.fetch(video_id, languages=["en", "en-US", "en-GB"])
                _rate_limit_count = 0
                return " ".join([x.text for x in t])
            except:
                pass
            return f"ERROR: {str(e)[:200]}"
    return f"ERROR: All methods failed for {video_id}"


def format_views(n):
    """Format view count."""
    if isinstance(n, str):
        return n
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    elif n >= 1_000:
        return f"{n/1_000:.0f}K"
    else:
        return str(n)


def scrape_channel(handle, channel_name, output_path, max_count=50):
    """Scrape long-form video transcripts for a channel."""
    print(f"[{channel_name}] Fetching video list from @{handle}...")
    videos = get_videos_list(handle, max_count)

    if videos == "RATE_LIMITED":
        print(f"[{channel_name}] RATE LIMITED while listing videos!")
        sys.exit(2)

    if not videos:
        print(f"[{channel_name}] No videos found.")
        with open(output_path, 'w') as f:
            f.write(f"# {channel_name} Long-Form Transcripts\n\n0 video transcripts.\n\n---\n")
        return 0

    print(f"[{channel_name}] Found {len(videos)} videos. Fetching transcripts...")

    lines = [f"# {channel_name} Long-Form Transcripts\n"]
    lines.append(f"{len(videos)} video transcripts.\n")
    lines.append("---\n")

    errors = 0
    rate_limited = False

    for i, video in enumerate(videos):
        vid_id = video['id']
        title = video['title']
        views = format_views(video['views'])
        date = video.get('date', 'N/A')
        duration = video.get('duration', '?')
        link = f"https://youtube.com/watch?v={vid_id}"

        print(f"[{channel_name}] ({i+1}/{len(videos)}) {title[:60]}...")
        transcript = get_transcript(vid_id)

        if transcript == "RATE_LIMITED":
            print(f"[{channel_name}] RATE LIMITED at video {i+1}/{len(videos)}!")
            # Write what we have so far as partial
            lines.append(f"## {i+1}. {title}")
            lines.append(f"**Channel:** {channel_name} | **Views:** {views} | **Date:** {date} | **Duration:** {duration} | **ID:** {vid_id}")
            lines.append(f"**Link:** {link}\n")
            lines.append("### Transcript:")
            lines.append(f"ERROR: Rate limited\n")
            lines.append("---\n")

            # Mark remaining as rate limited
            for j in range(i+1, len(videos)):
                v = videos[j]
                lines.append(f"## {j+1}. {v['title']}")
                lines.append(f"**Channel:** {channel_name} | **Views:** {format_views(v['views'])} | **Date:** {v.get('date', 'N/A')} | **Duration:** {v.get('duration', '?')} | **ID:** {v['id']}")
                lines.append(f"**Link:** https://youtube.com/watch?v={v['id']}\n")
                lines.append("### Transcript:")
                lines.append(f"ERROR: Rate limited\n")
                lines.append("---\n")

            with open(output_path, "w") as f:
                f.write("\n".join(lines))

            print(f"[{channel_name}] Wrote partial ({i+1} fetched, rest rate-limited) to {output_path}")
            sys.exit(2)

        if transcript.startswith("ERROR:"):
            errors += 1

        lines.append(f"## {i+1}. {title}")
        lines.append(f"**Channel:** {channel_name} | **Views:** {views} | **Date:** {date} | **Duration:** {duration} | **ID:** {vid_id}")
        lines.append(f"**Link:** {link}\n")
        lines.append("### Transcript:")
        lines.append(f"{transcript}\n")
        lines.append("---\n")

        # Rate limit: pause between requests
        if i < len(videos) - 1:
            time.sleep(random.uniform(1.0, 2.5))

    with open(output_path, "w") as f:
        f.write("\n".join(lines))

    print(f"[{channel_name}] Done! {len(videos)} videos to {output_path} ({errors} errors)")
    return len(videos)


def retry_errors_in_file(file_path):
    """Re-fetch only the ERROR transcripts in an existing file."""
    with open(file_path, "r") as f:
        content = f.read()

    pattern = r'(\*\*ID:\*\* )([a-zA-Z0-9_-]+)(.*?### Transcript:\n)(ERROR:[^\n]*\n)'
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

        if transcript == "RATE_LIMITED":
            print(f"  RATE LIMITED at retry {i+1}/{len(matches)}")
            with open(file_path, "w") as f:
                f.write(content)
            print(f"  Fixed {fixed}/{len(matches)} before rate limit")
            sys.exit(2)

        if not transcript.startswith("ERROR:"):
            old_text = match.group(3) + match.group(4)
            new_text = match.group(3) + transcript + "\n"
            content = content.replace(match.group(0), match.group(1) + match.group(2) + new_text, 1)
            fixed += 1
            print(f"    Fixed! ({len(transcript)} chars)")
        else:
            print(f"    Still failed: {transcript[:80]}")

        if i < len(matches) - 1:
            time.sleep(random.uniform(2.0, 4.0))

    with open(file_path, "w") as f:
        f.write(content)

    print(f"Fixed {fixed}/{len(matches)} errors in {file_path}")
    return fixed


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--retry":
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
        print("  scrape-long.py <handle> <channel_name> <output_path> [max_count]")
        print("  scrape-long.py --retry <file1.md> [file2.md ...]")
        sys.exit(1)
