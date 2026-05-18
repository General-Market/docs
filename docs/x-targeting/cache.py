#!/usr/bin/env python3
"""Local cache for X-targeting Apify runs.

Three append-only JSONL stores, keyed for dedup:

  cache/profiles.jsonl    one row per handle (last-write-wins on read)
  cache/tweets.jsonl      one row per tweet_id (dedup on read)
  cache/queries.jsonl     append-only log: {actor, params_hash, params, fetched_at, cost, dataset_path, count}

Why JSONL not SQLite: easier to grep, easier to commit to git, no schema migrations.

Usage:
  cache.py backfill           Rebuild profiles + tweets from runs/*.json
  cache.py status             Show cache stats
  cache.py have HANDLE        Check if we have profile data for HANDLE
  cache.py fetch ACTOR INPUT  Cache-aware fetch (skip if same params fetched <TTL ago)
"""
from __future__ import annotations
import json
import sys
import os
import hashlib
import glob
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
CACHE = ROOT / "cache"
PROFILES = CACHE / "profiles.jsonl"
TWEETS = CACHE / "tweets.jsonl"
QUERIES = CACHE / "queries.jsonl"
RUNS = ROOT / "runs"
DEFAULT_TTL_SEC = 14 * 24 * 3600  # 14 days


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def params_hash(actor: str, params: dict) -> str:
    canon = json.dumps({"actor": actor, "params": params}, sort_keys=True)
    return hashlib.sha256(canon.encode()).hexdigest()[:16]


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def append_jsonl(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def latest_profile(handle: str) -> dict | None:
    """Last-write-wins on handle."""
    if not PROFILES.exists():
        return None
    found = None
    for row in load_jsonl(PROFILES):
        if row.get("screen_name", "").lower() == handle.lower():
            found = row
    return found


def cmd_backfill():
    """Walk runs/*.json, extract profiles + tweets, dedupe, write JSONL."""
    profiles: dict[str, dict] = {}
    tweets: dict[str, dict] = {}
    for path in sorted(glob.glob(str(RUNS / "*.json"))):
        try:
            data = json.load(open(path))
        except Exception:
            continue
        if not isinstance(data, list):
            continue
        source = Path(path).stem
        for item in data:
            ui = item.get("user_info") if isinstance(item, dict) else None
            tid = item.get("tweet_id") if isinstance(item, dict) else None
            if ui and ui.get("screen_name"):
                sn = ui["screen_name"]
                row = {
                    **ui,
                    "first_seen": profiles.get(sn, {}).get("first_seen", now_iso()),
                    "last_seen": now_iso(),
                    "sources": sorted(set(profiles.get(sn, {}).get("sources", []) + [source])),
                }
                profiles[sn] = row
            if tid:
                tweets[tid] = {
                    "tweet_id": tid,
                    "screen_name": item.get("screen_name"),
                    "type": item.get("type"),
                    "text": item.get("text"),
                    "created_at": item.get("created_at"),
                    "favorites": item.get("favorites", 0),
                    "retweets": item.get("retweets", 0),
                    "replies": item.get("replies", 0),
                    "quotes": item.get("quotes", 0),
                    "views": item.get("views"),
                    "lang": item.get("lang"),
                    "url": item.get("url"),
                    "in_reply_to_screen_name": item.get("in_reply_to_screen_name"),
                    "in_reply_to_status_id_str": item.get("in_reply_to_status_id_str"),
                    "source_run": source,
                    "cached_at": now_iso(),
                }
    write_jsonl(PROFILES, list(profiles.values()))
    write_jsonl(TWEETS, list(tweets.values()))
    print(f"profiles: {len(profiles)}  tweets: {len(tweets)}")
    print(f"  → {PROFILES}")
    print(f"  → {TWEETS}")


def cmd_status():
    p = load_jsonl(PROFILES)
    t = load_jsonl(TWEETS)
    q = load_jsonl(QUERIES)
    print(f"profiles: {len(p)}")
    print(f"tweets:   {len(t)}")
    print(f"queries:  {len(q)}")
    if q:
        total_cost = sum(float(r.get("cost_usd", 0)) for r in q)
        print(f"total spent (logged): ${total_cost:.2f}")
    if p:
        # How many appear in 2+ runs?
        multi = sum(1 for r in p if len(r.get("sources", [])) >= 2)
        print(f"profiles cross-confirmed (2+ sources): {multi}")


def cmd_have(handle: str):
    r = latest_profile(handle)
    if not r:
        print(f"@{handle}: NOT CACHED")
        sys.exit(1)
    print(json.dumps({
        "screen_name": r["screen_name"],
        "followers_count": r.get("followers_count"),
        "verified": r.get("verified"),
        "last_seen": r.get("last_seen"),
        "sources": r.get("sources"),
        "bio": (r.get("description") or "")[:120],
    }, indent=2))


def _get_query_record(actor: str, params: dict) -> dict | None:
    h = params_hash(actor, params)
    for row in load_jsonl(QUERIES):
        if row.get("params_hash") == h:
            return row
    return None


def cmd_fetch(actor: str, input_path: str, ttl_sec: int = DEFAULT_TTL_SEC):
    token = os.environ.get("APIFY_TOKEN") or Path("/tmp/.apify_token").read_text().strip()
    params = json.load(open(input_path))
    h = params_hash(actor, params)
    prev = _get_query_record(actor, params)
    if prev:
        age = time.time() - datetime.fromisoformat(prev["fetched_at"]).timestamp()
        if age < ttl_sec:
            print(f"CACHE HIT (params_hash={h}, age={int(age/3600)}h, dataset={prev['dataset_path']})")
            return prev
        print(f"CACHE STALE (age {int(age/3600)}h > TTL {int(ttl_sec/3600)}h) — refetching")

    # Run actor synchronously
    url = f"https://api.apify.com/v2/acts/{actor.replace('/', '~')}/runs?token={token}"
    req = urllib.request.Request(url, data=json.dumps(params).encode(),
                                  headers={"Content-Type": "application/json"})
    run = json.load(urllib.request.urlopen(req))
    run_id = run["data"]["id"]
    print(f"  run {run_id} started")
    while True:
        time.sleep(3)
        info = json.load(urllib.request.urlopen(f"https://api.apify.com/v2/actor-runs/{run_id}?token={token}"))
        status = info["data"]["status"]
        if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            break
        print(f"  …{status}")
    if status != "SUCCEEDED":
        raise RuntimeError(f"run {run_id} ended {status}")
    ds = info["data"]["defaultDatasetId"]
    cost = float(info["data"].get("usageTotalUsd", 0))
    data_url = f"https://api.apify.com/v2/datasets/{ds}/items?token={token}&format=json"
    data = json.load(urllib.request.urlopen(data_url))
    dataset_path = str(RUNS / f"cache_{h}.json")
    Path(dataset_path).write_text(json.dumps(data, ensure_ascii=False, indent=2))

    record = {
        "actor": actor,
        "params": params,
        "params_hash": h,
        "fetched_at": now_iso(),
        "cost_usd": cost,
        "run_id": run_id,
        "dataset_id": ds,
        "dataset_path": dataset_path,
        "count": len(data) if isinstance(data, list) else 0,
    }
    append_jsonl(QUERIES, record)

    # Update profile + tweet cache
    cmd_backfill()
    print(f"CACHE MISS — fetched, cost ${cost:.3f}, results {record['count']}")
    return record


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "backfill":
        cmd_backfill()
    elif cmd == "status":
        cmd_status()
    elif cmd == "have":
        cmd_have(sys.argv[2])
    elif cmd == "fetch":
        cmd_fetch(sys.argv[2], sys.argv[3])
    else:
        print(__doc__); sys.exit(1)


if __name__ == "__main__":
    main()
