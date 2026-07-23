#!/usr/bin/env python3
"""Backtest tag selection on @0x_kai11's OWN posts.

For each tweet kai posted, reconstruct the cashtag's community activity in the
window around that post time (tweets, impressions, velocity, authors), then put
it next to how well kai's own tweet did. Answers: which 'at the time' metric
predicts our success — so we pick tags by that metric going forward.

Window per post: [post_time - 60min, post_time + 30min]  (the lead-up that
determines whether the cashtag feed sweeps you up).
"""
import json
from datetime import datetime, timezone, timedelta
import twapi

WIN_BEFORE = timedelta(minutes=60)
WIN_AFTER = timedelta(minutes=30)
MAX_PAGES = 8

def parse_dt(s):
    for fmt in ("%a %b %d %H:%M:%S %z %Y", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            d = datetime.strptime(s, fmt)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None

def community_window(tag, lo, hi):
    """All tweets mentioning $tag in [lo, hi]. Paginate newest-first until past lo."""
    q = f"${tag} since_time:{int(lo.timestamp())} until_time:{int(hi.timestamp())}"
    got, cursor = [], ""
    for _ in range(MAX_PAGES):
        params = {"query": q, "queryType": "Latest"}
        if cursor:
            params["cursor"] = cursor
        body = twapi.metered_call(f"bt:{tag}", "/twitter/tweet/advanced_search", params, estimate=300)
        tw = body.get("tweets") or []
        if not tw:
            break
        got.extend(tw)
        cursor = body.get("next_cursor") or ""
        if not cursor or not body.get("has_next_page", bool(cursor)):
            break
    rows = []
    for t in got:
        dt = parse_dt(t.get("createdAt") or "")
        if dt and lo <= dt <= hi:
            au = t.get("author") or {}
            rows.append((dt, au.get("userName") or "?", au.get("followers") or 0, t.get("viewCount") or 0))
    return rows

d = json.load(open("kai_raw.json"))
out = []
for t in d["tweets"]:
    dt = parse_dt(t.get("createdAt") or "")
    syms = [(s.get("text") or "").upper() for s in ((t.get("entities") or {}).get("symbols") or [])]
    tag = syms[0] if syms else None
    rec = {"date": (t.get("createdAt") or "")[:16], "tag": tag,
           "kai_views": t.get("viewCount") or 0, "kai_likes": t.get("likeCount") or 0,
           "kai_rt": t.get("retweetCount") or 0}
    if tag and dt:
        rows = community_window(tag, dt - WIN_BEFORE, dt + WIN_AFTER)
        if rows:
            times = sorted(r[0] for r in rows)
            span_h = max((times[-1] - times[0]).total_seconds() / 3600, 1e-6)
            rec["c_tweets"] = len(rows)
            rec["c_velhr"] = (len(rows) - 1) / span_h if len(rows) > 1 else len(rows)
            rec["c_authors"] = len({r[1] for r in rows})
            rec["c_impr"] = sum(r[3] for r in rows)
            rec["c_reach"] = sum({r[1]: r[2] for r in rows}.values())
        else:
            rec.update({"c_tweets": 0, "c_velhr": 0, "c_authors": 0, "c_impr": 0, "c_reach": 0})
    else:
        rec.update({"c_tweets": None, "c_velhr": None, "c_authors": None, "c_impr": None, "c_reach": None})
    out.append(rec)

print(f"\n{'date':<17}{'tag':<10}{'kai_views':>10}{'kai_likes':>10}{'c_tweets':>9}{'c_vel/hr':>9}{'c_auth':>7}{'c_impr':>10}{'c_reach':>10}")
print("-" * 92)
for r in out:
    def f(x, w, dec=0):
        if x is None: return " " * (w - 3) + "n/a"
        return f"{x:>{w}.{dec}f}" if dec else f"{int(x):>{w}}"
    print(f"{r['date']:<17}{('$'+r['tag'] if r['tag'] else '(none)'):<10}"
          f"{r['kai_views']:>10}{r['kai_likes']:>10}"
          f"{f(r['c_tweets'],9)}{f(r['c_velhr'],9,0)}{f(r['c_authors'],7)}{f(r['c_impr'],10)}{f(r['c_reach'],10)}")

# crude correlation on the tagged posts
import math
tagged = [r for r in out if r["c_tweets"] is not None and r["c_tweets"] > 0]
def corr(xs, ys):
    n = len(xs)
    if n < 2: return float('nan')
    mx, my = sum(xs)/n, sum(ys)/n
    cov = sum((x-mx)*(y-my) for x,y in zip(xs,ys))
    sx = math.sqrt(sum((x-mx)**2 for x in xs)); sy = math.sqrt(sum((y-my)**2 for y in ys))
    return cov/(sx*sy) if sx and sy else float('nan')
if len(tagged) >= 2:
    kv = [r["kai_views"] for r in tagged]
    print(f"\nAcross {len(tagged)} tagged posts — correlation of kai_views with:")
    for metric in ("c_tweets", "c_velhr", "c_authors", "c_impr", "c_reach"):
        print(f"   {metric:<10} r = {corr([r[metric] for r in tagged], kv):+.3f}")
