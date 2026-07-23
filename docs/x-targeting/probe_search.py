#!/usr/bin/env python3
"""Run a TwitterAPI.io advanced_search query and print handle + snippet only.

Usage: probe_search.py 'query string'

Why this exists: twapi.py's cmd_advsearch checks body.get('status') == 'success',
but the /twitter/tweet/advanced_search endpoint doesn't return a top-level
'status' field — so the success branch never fires and you get a JSON dump.
This wrapper goes straight to body['tweets'] and prints a clean list.

Costs the same ~300 credits per call ($0.003).
"""
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from twapi import metered_call, upsert_tweets  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    query = sys.argv[1]
    label = sys.argv[2] if len(sys.argv) > 2 else f"probe:{query[:30]}"
    body = metered_call(label, "/twitter/tweet/advanced_search",
                        {"query": query, "queryType": "Latest"}, estimate=300)
    tweets = body.get("tweets") or (body.get("data") or {}).get("tweets") or []
    upsert_tweets(tweets, source=f"probe-{label}")
    print(f"\n=== {label} — {len(tweets)} tweets ===")
    for t in tweets:
        a = (t.get("author") or {}).get("userName") or "?"
        followers = (t.get("author") or {}).get("followers") or 0
        likes = t.get("likeCount", 0)
        txt = (t.get("text") or "").replace("\n", " ")[:200]
        url = t.get("url", "")
        print(f"@{a:<22} f={followers:<6} ♥{likes:<4} {txt}")
        print(f"  → {url}")


if __name__ == "__main__":
    main()
