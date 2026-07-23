#!/usr/bin/env python3
"""STAGE 1 — discovery. Harvest which cashtags the memecoin/trenches niche is
posting RIGHT NOW. Run a few Latest searches, pull cashtags from results,
rank by (unique authors, total mentions, reachable followers)."""
import json, re
from collections import defaultdict
from datetime import datetime, timezone
import twapi

QUERIES = [
    'filter:videos (trenches OR "we are so back" OR "just sent")',
    'filter:videos ("100x" OR "50x" OR "24x" OR "10x")',
    '("just did" OR "overnight" OR "in 15 seconds") filter:videos',
    'pumpfun OR pump.fun OR "the trenches"',
]

def parse_dt(s):
    for fmt in ("%a %b %d %H:%M:%S %z %Y", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            d = datetime.strptime(s, fmt)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None

now = datetime.now(timezone.utc)
agg = defaultdict(lambda: {"mentions": 0, "authors": set(), "reach": 0, "newest": None, "views": []})
seen_ids = set()

for q in QUERIES:
    for page in range(2):
        params = {"query": q, "queryType": "Latest"}
        body = twapi.metered_call(f"disc:{q[:25]}:p{page}", "/twitter/tweet/advanced_search",
                                  params, estimate=300)
        data = body.get("data") or {}
        tweets = data.get("tweets") if isinstance(data, dict) else (body.get("tweets") or [])
        if not isinstance(tweets, list) or not tweets:
            break
        for t in tweets:
            tid = str(t.get("id"))
            if tid in seen_ids:
                continue
            seen_ids.add(tid)
            au = t.get("author") or {}
            handle = au.get("userName") or au.get("screen_name") or "?"
            foll = au.get("followers") or au.get("followers_count") or 0
            dt = parse_dt(t.get("createdAt") or "")
            syms = {s.get("text", "").upper() for s in ((t.get("entities") or {}).get("symbols") or [])}
            for sym in syms:
                if not sym:
                    continue
                a = agg[sym]
                a["mentions"] += 1
                a["authors"].add(handle)
                a["reach"] += foll
                a["views"].append(t.get("viewCount") or 0)
                if dt and (a["newest"] is None or dt > a["newest"]):
                    a["newest"] = dt
        cur = body.get("next_cursor") or data.get("next_cursor") or ""
        if not cur or not body.get("has_next_page", bool(cur)):
            break

rows = []
for sym, a in agg.items():
    age_min = (now - a["newest"]).total_seconds() / 60 if a["newest"] else 9999
    rows.append((sym, len(a["authors"]), a["mentions"], a["reach"], age_min,
                 sorted(a["views"])[len(a["views"])//2] if a["views"] else 0))

rows.sort(key=lambda r: (r[1], r[2]), reverse=True)
print(f"\n{'CASHTAG':<14}{'authors':>8}{'mentions':>9}{'reach(foll)':>12}{'newest(min ago)':>16}{'med_view':>9}")
for sym, na, nm, reach, age, mv in rows[:30]:
    print(f"${sym:<13}{na:>8}{nm:>9}{reach:>12}{age:>16.0f}{mv:>9}")
print(f"\n{len(seen_ids)} unique tweets scanned, {len(agg)} distinct cashtags")
