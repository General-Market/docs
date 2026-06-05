#!/usr/bin/env python3
"""Rank authors harvested in a cell's sweep. Zero API cost.

Score = total engagement of harvested tweets x sqrt(number of harvested tweets).
Excludes mega accounts (>500k followers) and accounts with <2 harvested tweets.

Usage:
  rank_authors.py CELL [--top 20]
"""
from __future__ import annotations

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TWEETS = ROOT / "cache" / "tweets.jsonl"
PROFILES = ROOT / "cache" / "profiles.jsonl"
SEARCHES = ROOT / "cache" / "searches.jsonl"


def load_jsonl(p):
    out = []
    if not p.exists():
        return out
    for line in p.read_text().split("\n"):
        if line.strip():
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


def main():
    cell = sys.argv[1]
    top_n = int(sys.argv[sys.argv.index("--top") + 1]) if "--top" in sys.argv else 20
    followers = {(p.get("screen_name") or "").lower(): p.get("followers_count") or 0
                 for p in load_jsonl(PROFILES)}
    eng = defaultdict(int)
    n_tweets = defaultdict(int)
    for t in load_jsonl(TWEETS):
        if t.get("cell") != cell:
            continue
        a = (t.get("screen_name") or "").lower()
        if not a:
            continue
        eng[a] += (t.get("favorites") or 0) + 3 * (t.get("retweets") or 0) \
            + 2 * (t.get("replies") or 0) + 4 * (t.get("quotes") or 0)
        n_tweets[a] += 1
    scored = []
    for a, e in eng.items():
        if n_tweets[a] < 2:
            continue
        fo = followers.get(a, 0)
        if fo > 500_000:
            continue
        scored.append((e * math.sqrt(n_tweets[a]), a, e, n_tweets[a], fo))
    scored.sort(reverse=True)
    out = ROOT / "niches" / cell / "authors.tsv"
    lines = ["# score\thandle\ttotal_eng\tn_tweets\tfollowers"]
    for s, a, e, n, fo in scored[:top_n]:
        lines.append(f"{s:.0f}\t@{a}\t{e}\t{n}\t{fo}")
    out.write_text("\n".join(lines) + "\n")
    print(f"wrote {out} ({min(top_n, len(scored))} authors)")
    for line in lines[1:11]:
        print("  " + line)


if __name__ == "__main__":
    main()
