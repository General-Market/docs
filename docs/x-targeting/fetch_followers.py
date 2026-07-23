#!/usr/bin/env python3
"""Fetch a single page (200) of followers via raw curl-equivalent.
Saves to cache/raw_searches/followers/<handle>_followers.json (note the suffix).

Usage: python3 fetch_followers.py HANDLE
"""
import json
import os
import sys
import urllib.parse
import urllib.request

KEY = open("/tmp/.twapi_key").read().strip()
BASE = "https://api.twitterapi.io"


def fetch_followers(handle: str):
    handle = handle.lstrip("@")
    out_path = f"cache/raw_searches/followers/{handle}_followers.json"
    if os.path.exists(out_path):
        existing = json.load(open(out_path))
        print(f"  cache hit: {out_path} ({len(existing)})", file=sys.stderr)
        return existing
    params = {"userName": handle}
    url = f"{BASE}/twitter/user/followers?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"X-API-Key": KEY})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = json.loads(r.read())
    batch = body.get("followers") or []
    print(f"  fetched {len(batch)} followers of @{handle}", file=sys.stderr)
    with open(out_path, "w") as f:
        json.dump(batch, f)  # save as flat list, not wrapped dict
    return batch


if __name__ == "__main__":
    fetch_followers(sys.argv[1])
