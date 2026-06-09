#!/usr/bin/env python3
"""Measure per-niche search-recall gap for the daily radar.

Question: are we missing native Articles because the niche keyword search never
returns them? Method: pull ONE broad platform-wide native-Article corpus, then
for each niche compare (a) what the niche's own keyword search returns against
(b) the niche-relevant articles sitting in the broad corpus. Articles relevant
in (b) but absent from (a) are the blind spot.

Run:
  python3 docs/x-targeting/x_articles/audit_recall.py --niches trading-ai ai crypto --lookback-hours 48
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import twapi  # noqa: E402
import find_native_x_articles as F  # noqa: E402

OUT = Path(__file__).resolve().parent / "audits"


def pull(query: str, qtype: str, pages: int, label: str) -> list[dict]:
    tweets, cursor = [], ""
    for page in range(pages):
        params = {"query": query, "queryType": qtype}
        if cursor:
            params["cursor"] = cursor
        body = twapi.metered_call(f"audit:{label}:p{page}", "/twitter/tweet/advanced_search", params, estimate=15 * 20)
        batch = F.parse_tweets(body)
        if not batch:
            break
        tweets.extend(batch)
        data = body.get("data") or {}
        cursor = body.get("next_cursor") or (data.get("next_cursor") if isinstance(data, dict) else "") or ""
        if not cursor:
            break
    return tweets


def collect(tweets: list[dict], cutoff, mature, seen: dict) -> None:
    for t in tweets:
        tid = str(t.get("id") or "")
        if not tid or tid in seen:
            continue
        if not t.get("article"):
            continue
        created = F.parse_x_date(t.get("createdAt") or "")
        if not created or created < cutoff or created > mature:
            continue
        seen[tid] = t


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--niches", nargs="+", required=True)
    ap.add_argument("--lookback-hours", type=int, default=48)
    ap.add_argument("--pages", type=int, default=4)
    ap.add_argument("--budget-usd", type=float, default=6.0)
    args = ap.parse_args()

    now = F.utc_now()
    cutoff = now - timedelta(hours=args.lookback_hours)
    mature = now - timedelta(hours=4)
    since = cutoff.strftime("%Y-%m-%d")
    OUT.mkdir(parents=True, exist_ok=True)
    twapi.BUDGET_FILE = OUT / "budget.active.json"
    twapi.BUDGET_FILE.write_text(json.dumps({"cap_usd": args.budget_usd, "baseline_credits": twapi.total_credits(), "spent_locked_credits": 0}))

    # Broad platform-wide native-Article corpus across the like ladder + latest.
    broad: dict[str, dict] = {}
    for thr in (1000, 200, 50, 10, 2):
        collect(pull(f"min_faves:{thr} url:x.com/i/article since:{since} -is:retweet", "Top", args.pages, f"broad-{thr}"), cutoff, mature, broad)
    collect(pull(f"url:x.com/i/article since:{since} -is:retweet", "Latest", args.pages, "broad-latest"), cutoff, mature, broad)
    print(f"\nBROAD corpus: {len(broad)} native Articles in last {args.lookback_hours}h\n", file=sys.stderr)

    report = {"lookback_hours": args.lookback_hours, "broad_corpus": len(broad), "niches": {}}
    for niche in args.niches:
        cfg = F.NICHE_CONFIG.get(niche)
        if not cfg:
            print(f"skip unknown niche {niche}", file=sys.stderr)
            continue
        # (b) relevant inside broad corpus, by this niche's filter
        rel_broad = {tid: t for tid, t in broad.items() if F.matches_niche(F.to_article(t, "x"), niche)}
        # (a) what the niche's own keyword search returns
        kq = cfg["keyword_query"]
        niche_seen: dict[str, dict] = {}
        for q, qt, lbl in ((f"{kq} url:x.com/i/article since:{since} -is:retweet", "Top", "kw-top"),
                           (f"{kq} url:x.com/i/article since:{since} -is:retweet", "Latest", "kw-latest")):
            collect(pull(q, qt, args.pages, f"{niche}-{lbl}"), cutoff, mature, niche_seen)
        rel_search = {tid: t for tid, t in niche_seen.items() if F.matches_niche(F.to_article(t, "x"), niche)}
        missed = {tid: t for tid, t in rel_broad.items() if tid not in rel_search}
        miss_rows = sorted((F.to_article(t, "x") for t in missed.values()), key=lambda a: a.likes, reverse=True)
        report["niches"][niche] = {
            "found_by_niche_search": len(rel_search),
            "relevant_in_broad": len(rel_broad),
            "missed_by_search": len(missed),
            "miss_examples": [{"likes": a.likes, "author": a.author, "title": a.title} for a in miss_rows[:12]],
        }
        print(f"{niche:20} search={len(rel_search):>3}  broad_relevant={len(rel_broad):>3}  MISSED={len(missed):>3}", file=sys.stderr)

    (OUT / "recall-audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
