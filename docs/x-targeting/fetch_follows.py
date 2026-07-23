#!/usr/bin/env python3
"""Fetch followings via raw curl-equivalent (twapi.py has a response-shape bug
where it expects 'followings' under data{} but it's at top level).

Usage: python3 fetch_follows.py HANDLE [PAGES]
"""
import json
import os
import sys
import urllib.parse
import urllib.request

KEY = open("/tmp/.twapi_key").read().strip()
BASE = "https://api.twitterapi.io"

def fetch_followings(handle: str, pages: int = 2):
    handle = handle.lstrip("@")
    cursor = ""
    all_users = []
    for p in range(pages):
        params = {"userName": handle, "pageSize": "200"}
        if cursor:
            params["cursor"] = cursor
        url = f"{BASE}/twitter/user/followings?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"X-API-Key": KEY})
        with urllib.request.urlopen(req, timeout=30) as r:
            body = json.loads(r.read())
        batch = body.get("followings") or []
        cursor = body.get("next_cursor") or ""
        has_next = bool(body.get("has_next_page"))
        print(f"  page={p} count={len(batch)} cursor={cursor[:20]} has_next={has_next}", file=sys.stderr)
        all_users.extend(batch)
        if not has_next or not cursor:
            break
    out_path = f"cache/raw_searches/followers/{handle}_following.json"
    with open(out_path, "w") as f:
        json.dump(all_users, f)
    print(f"wrote {len(all_users)} to {out_path}", file=sys.stderr)
    return all_users

if __name__ == "__main__":
    handle = sys.argv[1]
    pages = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    fetch_followings(handle, pages)
