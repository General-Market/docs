#!/usr/bin/env python3
"""Probe harness for X Article search-operator discovery.

Usage: probe.py <label> <queryType> <pages> <query...>
Saves raw to probes/raw/<label>.json (list of page bodies), prints metrics JSON,
appends a row to probes/log.md.
"""
import sys, json, re
from pathlib import Path

sys.path.insert(0, '/Users/maxguillabert/Downloads/index/docs/x-targeting')
import twapi

PROBES = Path('/Users/maxguillabert/Downloads/index/docs/x-targeting/x_articles/probes')
bp = PROBES / 'budget.active.json'
if not bp.exists():
    bp.write_text(json.dumps({"cap_usd": 5.0, "baseline_credits": twapi.total_credits(),
                              "spent_locked_credits": 0}))
twapi.BUDGET_FILE = bp

LOG = PROBES / 'log.md'
if not LOG.exists():
    LOG.write_text("| label | query | type | pages | n | n_articles | max_views | n_over_1M | note |\n"
                   "|---|---|---|---|---|---|---|---|---|\n")


def parse_tweets(body):
    data = body.get('data') or {}
    return body.get('tweets') or (data.get('tweets', []) if isinstance(data, dict) else []) or []


def run(label, query_type, pages, query, note=""):
    all_tweets, bodies, cursor = [], [], ""
    for page in range(pages):
        params = {"query": query, "queryType": query_type}
        if cursor:
            params["cursor"] = cursor
        body = twapi.metered_call(f"probe:{label}:p{page}", "/twitter/tweet/advanced_search",
                                  params, estimate=300)
        bodies.append(body)
        tweets = parse_tweets(body)
        if not tweets:
            break
        all_tweets.extend(tweets)
        cursor = body.get('next_cursor') or ""
        if not cursor or not body.get('has_next_page', bool(cursor)):
            break
    (PROBES / 'raw' / f'{label}.json').write_text(json.dumps(bodies, ensure_ascii=False))
    arts = [t for t in all_tweets if t.get('article')]
    views = [int(t.get('viewCount') or 0) for t in all_tweets]
    art_views = [int(t.get('viewCount') or 0) for t in arts]
    over1m = [t for t in arts if int(t.get('viewCount') or 0) >= 1_000_000]
    metrics = {
        "label": label, "query": query, "type": query_type, "pages_fetched": len(bodies),
        "n": len(all_tweets), "n_articles": len(arts),
        "max_views_any": max(views) if views else 0,
        "max_views_article": max(art_views) if art_views else 0,
        "n_articles_over_1M": len(over1m),
        "over_1M": [{"views": int(t.get('viewCount') or 0),
                     "likes": int(t.get('likeCount') or 0),
                     "rts": int(t.get('retweetCount') or 0),
                     "author": (t.get('author') or {}).get('userName'),
                     "title": (t.get('article') or {}).get('title', '')[:80],
                     "created": t.get('createdAt', '')[:16],
                     "id": t.get('id')} for t in sorted(over1m, key=lambda x: -int(x.get('viewCount') or 0))],
        "error": (bodies[0].get('msg') or bodies[0].get('message') or bodies[0].get('error')) if bodies and not all_tweets else None,
        "http": bodies[0].get('_http_status') if bodies else None,
    }
    with LOG.open('a') as f:
        f.write(f"| {label} | `{query}` | {query_type} | {len(bodies)} | {len(all_tweets)} | "
                f"{len(arts)} | {metrics['max_views_article']} | {len(over1m)} | {note} |\n")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))
    return metrics


if __name__ == '__main__':
    label, qtype, pages = sys.argv[1], sys.argv[2], int(sys.argv[3])
    query = " ".join(sys.argv[4:])
    run(label, qtype, pages, query)
