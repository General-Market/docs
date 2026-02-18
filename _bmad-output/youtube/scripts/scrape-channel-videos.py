#!/usr/bin/env python3
"""
Scrape last 50 videos from a YouTube channel with views, duration, upload date.
Uses YouTube browse API (fast, ~2-3s per channel).

Usage: python3 scrape-channel-videos.py <handle> <channel_name> <output_dir> [max_count]
Example: python3 scrape-channel-videos.py fireship Fireship ./output 50
"""

import sys
import os
import json
import re
import urllib.request
import urllib.error
import time
from datetime import datetime, timedelta

def parse_relative_date(text):
    """Convert '2 weeks ago' / '10 days ago' / '3 months ago' etc to YYYY-MM-DD."""
    if not text:
        return "unknown"

    now = datetime.now()
    text = text.lower().strip()

    # Handle "Streamed X ago" prefix
    text = re.sub(r'^(streamed|premiered)\s+', '', text)

    m = re.match(r'(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago', text)
    if not m:
        return text  # Return as-is if can't parse

    num = int(m.group(1))
    unit = m.group(2)

    if unit == 'second':
        delta = timedelta(seconds=num)
    elif unit == 'minute':
        delta = timedelta(minutes=num)
    elif unit == 'hour':
        delta = timedelta(hours=num)
    elif unit == 'day':
        delta = timedelta(days=num)
    elif unit == 'week':
        delta = timedelta(weeks=num)
    elif unit == 'month':
        delta = timedelta(days=num * 30)
    elif unit == 'year':
        delta = timedelta(days=num * 365)
    else:
        return text

    result = now - delta
    return result.strftime('%Y-%m-%d')

def parse_view_count(text):
    """Convert '1,234,567 views' to integer."""
    if not text:
        return 0
    text = text.replace(',', '').replace(' views', '').replace(' view', '').strip()
    # Handle "No views"
    if text.lower() in ('no', ''):
        return 0
    try:
        return int(text)
    except ValueError:
        return 0

def format_views(n):
    """Format view count: 1234567 -> 1.23M, 45678 -> 45.7K."""
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    elif n >= 1_000:
        return f"{n/1_000:.1f}K"
    else:
        return str(n)

def format_duration(text):
    """Normalize duration text."""
    if not text:
        return "?"
    return text.strip()

def fetch_page(url, headers=None, data=None, timeout=15):
    """Fetch a URL with error handling."""
    default_headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    if headers:
        default_headers.update(headers)

    req = urllib.request.Request(url, data=data, headers=default_headers)
    resp = urllib.request.urlopen(req, timeout=timeout)
    return resp.read().decode('utf-8', errors='replace')

def scrape_channel_videos(handle, max_count=50):
    """Scrape videos from channel using browse API. Returns list of video dicts."""

    # Step 1: Fetch channel videos page
    url = f"https://www.youtube.com/@{handle}/videos"
    html = fetch_page(url)

    # Extract ytInitialData
    match = re.search(r'var ytInitialData = ({.*?});</script>', html)
    if not match:
        raise Exception("Could not find ytInitialData")

    data = json.loads(match.group(1))

    # Check for channel not found
    if 'alerts' in data:
        for alert in data.get('alerts', []):
            text = alert.get('alertWithButtonRenderer', {}).get('text', {}).get('simpleText', '')
            if 'not available' in text.lower() or 'not found' in text.lower():
                raise Exception(f"Channel @{handle} not found")

    # Navigate to Videos tab
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
            videos, continuation_token = extract_videos_from_items(contents)
            break

    # Step 2: Fetch more via continuation if needed
    while len(videos) < max_count and continuation_token:
        api_url = "https://www.youtube.com/youtubei/v1/browse"
        payload = json.dumps({
            "continuation": continuation_token,
            "context": {
                "client": {
                    "clientName": "WEB",
                    "clientVersion": "2.20240101.00.00"
                }
            }
        }).encode()

        resp_text = fetch_page(api_url,
                               headers={'Content-Type': 'application/json'},
                               data=payload)
        data2 = json.loads(resp_text)

        continuation_token = None
        actions = data2.get('onResponseReceivedActions', [])
        for action in actions:
            items = action.get('appendContinuationItemsAction', {}).get('continuationItems', [])
            new_vids, continuation_token = extract_videos_from_items(items)
            videos.extend(new_vids)

    return videos[:max_count]

def extract_videos_from_items(items):
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

            # Skip live streams currently broadcasting (no length)
            videos.append({
                'title': title,
                'id': vid_id,
                'views': parse_view_count(views_text),
                'views_text': views_text,
                'date': parse_relative_date(pub_text),
                'date_raw': pub_text,
                'duration': format_duration(length),
            })

        # Check for continuation
        cont = item.get('continuationItemRenderer', {}).get('continuationEndpoint', {}).get('continuationCommand', {}).get('token')
        if cont:
            continuation_token = cont

    return videos, continuation_token

def write_markdown(channel_name, handle, videos, output_path):
    """Write videos to markdown file."""

    # Calculate stats
    total_views = sum(v['views'] for v in videos)
    avg_views = total_views // len(videos) if videos else 0

    lines = []
    lines.append(f"# {channel_name} — Last {len(videos)} Videos")
    lines.append(f"")
    lines.append(f"**Channel:** @{handle} | **Videos scraped:** {len(videos)} | **Avg views:** {format_views(avg_views)} | **Total views:** {format_views(total_views)}")
    lines.append(f"")
    lines.append(f"| # | Title | Views | Date | Duration |")
    lines.append(f"|---|-------|-------|------|----------|")

    for i, v in enumerate(videos, 1):
        title = v['title'].replace('|', '\\|')
        if len(title) > 80:
            title = title[:77] + "..."
        lines.append(f"| {i} | {title} | {format_views(v['views'])} | {v['date']} | {v['duration']} |")

    lines.append(f"")
    lines.append(f"---")
    lines.append(f"*Scraped {datetime.now().strftime('%Y-%m-%d')}*")

    with open(output_path, 'w') as f:
        f.write('\n'.join(lines) + '\n')

def main():
    if len(sys.argv) < 4:
        print(f"Usage: {sys.argv[0]} <handle> <channel_name> <output_dir> [max_count]")
        sys.exit(1)

    handle = sys.argv[1].lstrip('@')
    channel_name = sys.argv[2]
    output_dir = sys.argv[3]
    max_count = int(sys.argv[4]) if len(sys.argv) > 4 else 50

    os.makedirs(output_dir, exist_ok=True)

    safe_name = re.sub(r'[^a-z0-9-]', '-', channel_name.lower()).strip('-')
    safe_name = re.sub(r'-+', '-', safe_name)
    output_path = os.path.join(output_dir, f"{safe_name}.md")

    print(f"Scraping @{handle} ({channel_name})...")

    try:
        start = time.time()
        videos = scrape_channel_videos(handle, max_count)
        elapsed = time.time() - start

        if not videos:
            print(f"  WARNING: No videos found for @{handle}")
            # Write empty file
            with open(output_path, 'w') as f:
                f.write(f"# {channel_name}\n\n0 videos found.\n")
            return

        write_markdown(channel_name, handle, videos, output_path)

        avg_views = sum(v['views'] for v in videos) // len(videos)
        print(f"  OK: {len(videos)} videos, avg {format_views(avg_views)}, took {elapsed:.1f}s -> {output_path}")

    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"  RATE_LIMITED: HTTP 429 for @{handle}")
            sys.exit(2)
        else:
            print(f"  ERROR: HTTP {e.code} for @{handle}: {e}")
            sys.exit(1)
    except Exception as e:
        err_str = str(e).lower()
        if 'rate' in err_str or '429' in err_str or 'too many' in err_str:
            print(f"  RATE_LIMITED: {e}")
            sys.exit(2)
        print(f"  ERROR: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
