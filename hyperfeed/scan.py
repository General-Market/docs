"""The scan: every cycle, ask X for the curated accounts' recent posts and surface the outliers.

Accounts are queried in `from:` batches (cheap — one page each). Each candidate is gated for
Hyperliquid relevance, then scored against its author's calibrated baseline. A tweet fires when
its outlier_score clears the calibrated threshold AND it clears the absolute floors.

The search window (scan_lookback_min) is wider than the scan interval on purpose: a fresh tweet
rarely looks like an outlier against a multi-hour baseline, so we keep re-scoring it each cycle
until it either fires or ages out of the window. A tweet is recorded in `seen` only once it
fires, so it alerts exactly once and a slow climber is never missed.

run_scan is pure — it returns the firing hits and never writes state; the caller marks seen,
appends to the fired log, and broadcasts.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from . import hl_filter
from .config import Config
from .twitter import Twitter

log = logging.getLogger("hyperfeed.scan")

FROM_CHUNK = 10   # `from:` handles per advanced_search query (keeps the query well under the length cap)


def _chunks(items: list, n: int):
    for i in range(0, len(items), n):
        yield items[i : i + n]


def _since_str(lookback_min: int, now: datetime) -> str:
    dt = now - timedelta(minutes=lookback_min)
    return dt.strftime("%Y-%m-%d_%H:%M:%S_UTC")


def _build_query(handles_chunk: list[str], since: str) -> str:
    who = " OR ".join(f"from:{h}" for h in handles_chunk)
    return f"({who}) since:{since} -filter:retweets"


def run_scan(cfg: Config, tw: Twitter, accounts: dict, calibration: dict, seen: dict) -> tuple[list[dict], int]:
    """Return (hits_sorted_desc_by_score, last_http_status). Mutates nothing."""
    now = datetime.now(timezone.utc)
    handles = list(accounts.keys())
    if not handles:
        return [], 0

    since = _since_str(cfg.scan_lookback_min, now)
    threshold = calibration.get("threshold", 1e9)            # no calibration yet ⇒ nothing fires
    min_views = calibration.get("min_views", 1_000)
    min_eng = calibration.get("min_engagement", 15)
    acct_cal = calibration.get("accounts", {})
    median_baseline = calibration.get("median_baseline_views", 0.0)

    hits: list[dict] = []
    last_status = 0
    for chunk in _chunks(handles, FROM_CHUNK):
        tweets, status = tw.advanced_search(_build_query(chunk, since), "Latest")
        last_status = status or last_status
        for t in tweets:
            tid = hl_filter.tweet_id(t)
            if not tid or tid in seen:
                continue
            handle = hl_filter.author_handle(t)
            text = hl_filter.tweet_text(t)
            if not hl_filter.is_hyperliquid(text, handle):
                continue
            views = hl_filter.tweet_views(t)
            eng = hl_filter.tweet_engagement(t)
            followers = hl_filter.author_followers(t)
            baseline = (acct_cal.get(handle, {}) or {}).get("baseline_views") or median_baseline
            sc = hl_filter.outlier_score(views, followers, eng, baseline)
            if sc["outlier_score"] >= threshold and views >= min_views and eng >= min_eng:
                hits.append({
                    "tweet_id": tid,
                    "handle": handle,
                    "followers": followers,
                    "text": text,
                    "views": views,
                    "likes": hl_filter.tweet_likes(t),
                    "retweets": int((t.get("retweetCount") or 0)),
                    "replies": int((t.get("replyCount") or 0)),
                    "engagement": eng,
                    "url": hl_filter.tweet_url(t),
                    "created_at": t.get("createdAt") or "",
                    "baseline_views": baseline,
                    **sc,
                })

    hits.sort(key=lambda h: h["outlier_score"], reverse=True)
    return hits, last_status
