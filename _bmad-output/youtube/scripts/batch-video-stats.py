#!/usr/bin/env python3
"""
Batch scrape last 50 videos for all channels in technical-youtube-channels.md.
Detects rate limits and stops, printing a message.

Usage: python3 batch-video-stats.py [--resume]
  --resume: Skip channels that already have output files
"""

import sys
import os
import re
import subprocess
import time

CHANNELS_MD = '/Users/maxguillabert/Downloads/index/technical-youtube-channels.md'
OUTPUT_DIR = '/Users/maxguillabert/Downloads/index/_bmad-output/youtube/channels/video-stats'
SCRIPT = '/Users/maxguillabert/Downloads/index/_bmad-output/youtube/scripts/scrape-channel-videos.py'

def extract_channels():
    """Extract (handle, name) pairs from the markdown file."""
    with open(CHANNELS_MD) as f:
        content = f.read()

    channels = []
    seen = set()

    for match in re.finditer(r'\|\s*\d+\s*\|\s*\*\*([^*]+)\*\*\s*\|\s*(@[A-Za-z0-9_.@-]+|N/A)\s*\|', content):
        name = match.group(1).strip()
        handle = match.group(2).strip()
        if handle == 'N/A' or handle in seen:
            continue
        seen.add(handle)
        channels.append((handle.lstrip('@'), name))

    return channels

def safe_filename(name):
    """Convert channel name to safe filename."""
    safe = re.sub(r'[^a-z0-9-]', '-', name.lower()).strip('-')
    return re.sub(r'-+', '-', safe)

def is_done(name):
    """Check if channel already has output."""
    fname = safe_filename(name) + '.md'
    path = os.path.join(OUTPUT_DIR, fname)
    if not os.path.exists(path):
        return False
    # Check it's not empty/error
    with open(path) as f:
        content = f.read()
    return '| 1 |' in content  # Has at least one video row

def main():
    resume = '--resume' in sys.argv

    channels = extract_channels()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total = len(channels)
    done = 0
    skipped = 0
    errors = []

    print(f"{'='*60}")
    print(f"Batch video stats scraper")
    print(f"Channels: {total}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Resume mode: {resume}")
    print(f"{'='*60}")

    for i, (handle, name) in enumerate(channels, 1):
        if resume and is_done(name):
            skipped += 1
            continue

        print(f"\n[{i}/{total}] @{handle} ({name})")

        try:
            result = subprocess.run(
                ['python3', SCRIPT, handle, name, OUTPUT_DIR, '50'],
                capture_output=True, text=True, timeout=60,
                env={**os.environ, 'PYTHONUNBUFFERED': '1'}
            )

            print(result.stdout.strip())
            if result.stderr:
                print(f"  stderr: {result.stderr.strip()[:200]}")

            if result.returncode == 2:
                # Rate limited
                print(f"\n{'!'*60}")
                print(f"RATE LIMITED at channel {i}/{total}: @{handle}")
                print(f"Done so far: {done}, Skipped: {skipped}, Errors: {len(errors)}")
                print(f"{'!'*60}")
                sys.exit(2)
            elif result.returncode != 0:
                errors.append((handle, name))
            else:
                done += 1

            # Small delay between channels
            time.sleep(0.5)

        except subprocess.TimeoutExpired:
            print(f"  TIMEOUT after 60s")
            errors.append((handle, name))
        except KeyboardInterrupt:
            print(f"\n\nInterrupted at {i}/{total}")
            break

    print(f"\n{'='*60}")
    print(f"COMPLETE")
    print(f"  Done: {done}")
    print(f"  Skipped (already done): {skipped}")
    print(f"  Errors: {len(errors)}")
    if errors:
        print(f"  Failed channels:")
        for h, n in errors:
            print(f"    @{h} ({n})")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
