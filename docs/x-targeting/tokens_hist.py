#!/usr/bin/env python3
"""Historical community comparison for a set of cashtags over a day window,
with DEEP pagination to beat the sparse-history problem.

For each tag, walk pages backward through [since, until] and measure:
  tweets, unique authors, impressions (sum views), big-account reach,
  author concentration (shill detector), and time coverage achieved.
"""
import sys
from datetime import datetime, timezone
from collections import Counter
import twapi

TAGS = ["WOC", "TURTLE", "COZY"]
SINCE = "2026-06-13"          # yesterday (UTC)
UNTIL = "2026-06-14"
MAX_PAGES = 18

def parse_dt(s):
    for fmt in ("%a %b %d %H:%M:%S %z %Y",):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            return None

def pull(tag):
    q = f"${tag} since:{SINCE} until:{UNTIL}"
    rows, cursor, pages = [], "", 0
    for _ in range(MAX_PAGES):
        params = {"query": q, "queryType": "Latest"}
        if cursor:
            params["cursor"] = cursor
        body = twapi.metered_call(f"hist:{tag}:p{pages}", "/twitter/tweet/advanced_search",
                                  params, estimate=300)
        tw = body.get("tweets") or []
        pages += 1
        if not tw:
            break
        for t in tw:
            dt = parse_dt(t.get("createdAt") or "")
            au = t.get("author") or {}
            rows.append((dt, au.get("userName") or "?", au.get("followers") or 0,
                         t.get("viewCount") or 0))
        cursor = body.get("next_cursor") or ""
        if not cursor or not body.get("has_next_page", bool(cursor)):
            break
    return rows, pages

print(f"window: {SINCE} -> {UNTIL} (UTC, 'yesterday')   max {MAX_PAGES} pages/tag\n")
results = {}
for tag in TAGS:
    rows, pages = pull(tag)
    if not rows:
        print(f"${tag}: NO DATA returned")
        results[tag] = None
        continue
    dts = sorted(d for d, *_ in rows if d)
    span_h = (dts[-1] - dts[0]).total_seconds()/3600 if len(dts) > 1 else 0
    authors = Counter(r[1] for r in rows)
    reach = sum({r[1]: r[2] for r in rows}.values())
    impr = sum(r[3] for r in rows)
    top_author_share = authors.most_common(1)[0][1] / len(rows)
    big = sorted({r[1]: r[2] for r in rows}.items(), key=lambda kv: -kv[1])[:3]
    results[tag] = dict(n=len(rows), pages=pages, authors=len(authors), reach=reach,
                        impr=impr, med=sorted(r[3] for r in rows)[len(rows)//2],
                        span_h=span_h, conc=top_author_share, big=big,
                        cover_lo=dts[0].strftime("%H:%M") if dts else "?",
                        cover_hi=dts[-1].strftime("%H:%M") if dts else "?")

print(f"{'TAG':<8}{'tweets':>7}{'pages':>6}{'authors':>8}{'impr':>9}{'medView':>8}{'reach':>9}{'top1%':>7}{'coverage(UTC)':>16}")
print("-"*78)
for tag in TAGS:
    r = results[tag]
    if not r:
        print(f"${tag:<7} (no data)"); continue
    print(f"${tag:<7}{r['n']:>7}{r['pages']:>6}{r['authors']:>8}{r['impr']:>9}{r['med']:>8}"
          f"{r['reach']:>9}{r['conc']*100:>6.0f}%   {r['cover_lo']}-{r['cover_hi']}")
print("\nbiggest accounts posting each tag (handle, followers):")
for tag in TAGS:
    r = results[tag]
    if r: print(f"  ${tag}: " + ", ".join(f"@{h}({f})" for h,f in r['big']))
print("\nNOTE: tweets=count we could PAGINATE to (historical search caps; coverage shows the time span")
print("      actually retrieved). top1%=share of the single most active author (>40% = shill-driven).")
