#!/usr/bin/env python3
"""Choose a cashtag efficiently.

The law (proven on @0x_kai11): reach = (cashtag present) x (coin spiking NOW).
So tag selection = detect which coin is in a LIVE, RISING attention spike right now.

Two stages:
  1 DISCOVER  — harvest cashtags the trenches niche is posting this minute.
  2 SCORE     — for each candidate, measure velocity + ACCELERATION + reachable
                audience + bot ratio, and label a verdict.

Usage:
  python3 tag_scanner.py                 # discover + score top candidates
  python3 tag_scanner.py TURTLE TRILLION # score a specific list (skip discovery)
"""
import sys
from collections import defaultdict
from datetime import datetime, timezone
import twapi

NOW = datetime.now(timezone.utc)

# Majors are always live — not a memecoin account's edge. Labelled, not ridden.
MAJORS = {"BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "SPX", "USDT", "USDC", "TRX", "LINK"}

DISCOVERY_QUERIES = [
    'trenches filter:videos',
    '("100x" OR "50x" OR "24x" OR "10x" OR "5x") filter:videos',
    '("just sent" OR "overnight" OR "we are so back" OR "ath") filter:videos',
    'pumpfun OR "pump.fun" OR "the trenches"',
]

def parse_dt(s):
    for fmt in ("%a %b %d %H:%M:%S %z %Y", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            d = datetime.strptime(s, fmt)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None

def search(query, qtype="Latest", pages=1):
    out, cursor = [], ""
    for p in range(pages):
        params = {"query": query, "queryType": qtype}
        if cursor:
            params["cursor"] = cursor
        body = twapi.metered_call(f"scan:{query[:28]}:p{p}", "/twitter/tweet/advanced_search",
                                  params, estimate=300)
        tweets = body.get("tweets") or (body.get("data", {}) or {}).get("tweets") or []
        if not isinstance(tweets, list) or not tweets:
            break
        out.extend(tweets)
        cursor = body.get("next_cursor") or ""
        if not cursor or not body.get("has_next_page", bool(cursor)):
            break
    return out

def discover():
    agg = defaultdict(lambda: {"authors": set(), "mentions": 0})
    seen = set()
    for q in DISCOVERY_QUERIES:
        for t in search(q, "Latest", pages=2):
            tid = str(t.get("id"))
            if tid in seen:
                continue
            seen.add(tid)
            au = t.get("author") or {}
            handle = au.get("userName") or "?"
            for s in ((t.get("entities") or {}).get("symbols") or []):
                sym = (s.get("text") or "").upper()
                if sym:
                    agg[sym]["authors"].add(handle)
                    agg[sym]["mentions"] += 1
    ranked = sorted(agg.items(), key=lambda kv: (len(kv[1]["authors"]), kv[1]["mentions"]), reverse=True)
    print(f"  discovered {len(agg)} cashtags from {len(seen)} live tweets", file=sys.stderr)
    return [sym for sym, _ in ranked[:12]]

def score(sym):
    """Pull up to 40 recent tweets for $sym, measure liveness + acceleration."""
    tweets = search(f"${sym}", "Latest", pages=2)
    rows = []
    for t in tweets:
        dt = parse_dt(t.get("createdAt") or "")
        au = t.get("author") or {}
        if dt:
            rows.append((dt, au.get("userName") or "?", au.get("followers") or 0,
                         bool(au.get("isAutomated")), t.get("viewCount") or 0))
    if len(rows) < 4:
        return None
    rows.sort(reverse=True)  # newest first
    dts = [r[0] for r in rows]
    authors = {r[1] for r in rows}
    reach = sum({(r[1]): r[2] for r in rows}.values())  # unique-author followers
    bots = sum(1 for r in rows if r[3]) / len(rows)
    med_view = sorted(r[4] for r in rows)[len(rows)//2]

    def vel(sub):
        if len(sub) < 2:
            return 0.0
        span_h = (sub[0] - sub[-1]).total_seconds() / 3600
        return (len(sub) - 1) / span_h if span_h > 1e-6 else 999.0

    v_all = vel(dts)
    half = len(dts) // 2
    v_recent = vel(dts[:half]) if half >= 2 else v_all
    v_older = vel(dts[half:]) if len(dts) - half >= 2 else v_all
    accel = (v_recent / v_older) if v_older > 1e-6 else (99.0 if v_recent > 0 else 0.0)

    author_ratio = len(authors) / len(rows)  # 1.0 = every tweet a distinct person

    # verdict
    now = datetime.now(timezone.utc)
    age_min = max(0.0, (now - dts[0]).total_seconds() / 60)
    if sym in MAJORS:
        verdict = "MAJOR"            # always live; not your niche edge
    elif v_all < 8:
        verdict = "DEAD"
    elif v_all > 400 and len(authors) < 10:
        verdict = "SUSPECT (thin)"   # firehose from a handful of accounts = manufactured
    elif author_ratio < 0.5 and v_all >= 25:
        verdict = "SHILLED"          # repeat posters dominate — soft community
    elif accel >= 1.3 and v_all >= 25:
        verdict = "RIDE NOW"
    elif accel >= 1.3:
        verdict = "WARMING"
    elif accel < 0.8 and v_all >= 25:
        verdict = "PEAKING/LATE"
    else:
        verdict = "STEADY"
    return {"sym": sym, "vel": v_all, "accel": accel, "authors": len(authors),
            "reach": reach, "bots": bots, "med_view": med_view, "n": len(rows),
            "ratio": author_ratio, "newest_min": age_min, "verdict": verdict}

def main():
    cands = [a.upper().lstrip("$") for a in sys.argv[1:]] or discover()
    print(f"\nScoring {len(cands)} candidates: {', '.join('$'+c for c in cands)}\n", file=sys.stderr)
    results = [r for c in cands if (r := score(c))]
    # rank: RIDE NOW / WARMING first, then by accel*reach
    order = {"RIDE NOW": 0, "WARMING": 1, "STEADY": 2, "PEAKING/LATE": 3,
             "SHILLED": 4, "SUSPECT (thin)": 5, "MAJOR": 6, "DEAD": 7}
    results.sort(key=lambda r: (order.get(r["verdict"], 9), -(r["accel"] * (r["reach"] ** 0.5))))
    print(f"{'CASHTAG':<12}{'verdict':<14}{'vel/hr':>8}{'accel':>7}{'authors':>8}{'reach':>9}{'bot%':>6}{'medView':>8}{'age_m':>7}")
    print("-" * 87)
    for r in results:
        print(f"${r['sym']:<11}{r['verdict']:<14}{r['vel']:>8.0f}{r['accel']:>7.2f}"
              f"{r['authors']:>8}{r['reach']:>9}{r['bots']*100:>5.0f}%{r['med_view']:>8}{r['newest_min']:>7.0f}")
    print("\nlegend: vel=tweets/hr (room size)  accel=recent vel / older vel (>1.3 rising)")
    print("        reach=sum followers of recent posters  age_m=minutes since newest tweet")

if __name__ == "__main__":
    main()
