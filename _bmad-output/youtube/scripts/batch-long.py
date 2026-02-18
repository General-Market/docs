#!/usr/bin/env python3
"""
Batch scrape long-form video transcripts for top channels.
Stops on rate limit (exit code 2) for IP switching.

Usage: python3 batch-long.py [--resume]
"""

import sys
import os
import re
import json
import subprocess
import time

CHANNELS_JSON = '/tmp/remaining-channels.json'
OUTPUT_DIR = '/Users/maxguillabert/Downloads/index/_bmad-output/youtube/channels/long'
SCRIPT = '/Users/maxguillabert/Downloads/index/_bmad-output/youtube/scripts/scrape-long.py'


def safe_filename(name):
    safe = re.sub(r'[^a-z0-9-]', '-', name.lower()).strip('-')
    return re.sub(r'-+', '-', safe)


def is_done(name):
    fname = safe_filename(name) + '.md'
    path = os.path.join(OUTPUT_DIR, fname)
    if not os.path.exists(path):
        return False
    with open(path) as f:
        content = f.read()
    # Check it has transcripts (not just errors/empty)
    # Consider done if it has at least one "### Transcript:" that's not ERROR
    if '### Transcript:' not in content:
        return False
    # Check if it was rate-limited (partial file)
    if content.count('ERROR: Rate limited') > 5:
        return False
    return '## 1.' in content


def main():
    resume = '--resume' in sys.argv

    with open(CHANNELS_JSON) as f:
        channels = json.load(f)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total = len(channels)
    done = 0
    skipped = 0
    errors = []

    print(f"{'='*60}")
    print(f"Batch long-form transcript scraper")
    print(f"Channels: {total}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Resume: {resume}")
    print(f"{'='*60}")

    for i, ch in enumerate(channels, 1):
        handle = ch['handle']
        name = ch['name']
        avg = ch['avg_views']

        if resume and is_done(name):
            skipped += 1
            continue

        out_file = os.path.join(OUTPUT_DIR, safe_filename(name) + '.md')
        print(f"\n[{i}/{total}] @{handle} ({name}) avg={avg}")

        try:
            result = subprocess.run(
                ['python3', SCRIPT, handle, name, out_file, '50'],
                capture_output=False,
                timeout=600,
                env={**os.environ, 'PYTHONUNBUFFERED': '1'}
            )

            if result.returncode == 2:
                print(f"\n{'!'*60}")
                print(f"RATE LIMITED at channel {i}/{total}: @{handle} ({name})")
                print(f"Done: {done}, Skipped: {skipped}, Errors: {len(errors)}")
                print(f"Switch IP and run with --resume to continue")
                print(f"{'!'*60}")
                sys.exit(2)
            elif result.returncode != 0:
                errors.append((handle, name))
                print(f"  EXIT CODE: {result.returncode}")
            else:
                done += 1

            # Small delay between channels
            time.sleep(1.0)

        except subprocess.TimeoutExpired:
            print(f"  TIMEOUT after 600s")
            errors.append((handle, name))
        except KeyboardInterrupt:
            print(f"\n\nInterrupted at {i}/{total}")
            print(f"Done: {done}, Skipped: {skipped}, Errors: {len(errors)}")
            sys.exit(1)

    print(f"\n{'='*60}")
    print(f"COMPLETE")
    print(f"  Done: {done}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {len(errors)}")
    if errors:
        print(f"  Failed:")
        for h, n in errors:
            print(f"    @{h} ({n})")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
