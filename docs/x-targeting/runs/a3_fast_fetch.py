#!/usr/bin/env python3
"""Fast direct fetcher: curl-style for A3 candidates. Bypasses the wrapper's hanging balance probe.
Writes profiles + tweets into cache/profiles.jsonl + cache/tweets.jsonl using the same upsert helpers.
"""
import json, sys, time
from pathlib import Path
import urllib.request, urllib.parse

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
sys.path.insert(0, str(ROOT))
from twapi import upsert_profile, upsert_tweets

KEY = Path("/tmp/.twapi_key").read_text().strip()
BASE = "https://api.twitterapi.io"

def get(path, params):
    url = f"{BASE}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"X-API-Key": KEY})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)

def fetch(handle):
    h = handle.lstrip("@")
    try:
        ui = get("/twitter/user/info", {"userName": h})
        if ui.get("status") == "success" and ui.get("data"):
            upsert_profile(ui["data"])
            print(f"  userinfo:{h}  fol={ui['data'].get('followers')}  bio={(ui['data'].get('description') or '')[:80]!r}")
    except Exception as e:
        print(f"  userinfo:{h} ERR {e}")
    try:
        lt = get("/twitter/user/last_tweets", {"userName": h})
        if lt.get("status") == "success":
            d = lt.get("data") or {}
            ts = d.get("tweets") if isinstance(d, dict) else (d or [])
            if isinstance(ts, list):
                n = upsert_tweets(ts, source=f"twapi-lasttweets-{h}")
                print(f"  lasttweets:{h}  got={len(ts)}  new={n}")
    except Exception as e:
        print(f"  lasttweets:{h} ERR {e}")

handles = [l.strip().lstrip("@") for l in open(sys.argv[1]) if l.strip()]
for h in handles:
    print(f"== {h} ==")
    fetch(h)
print("DONE")
