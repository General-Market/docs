"""Calibration — set the fire threshold by measurement, targeting a daily volume.

The strategy (per Max): page through ALL of each account's tweets over a 2-week window (no
arbitrary tweet cap — the page correction), score every one, then sweep the threshold down and
count how many tweets/day clear it. Set the fire line where ~TARGET_TWEETS_PER_DAY clear it, so
the feed delivers a known, useful volume instead of an arbitrary percentile.

The ladder (N/day → threshold) is stored and shown, so the trade-off is explicit and tunable.
A parallel raw-views ladder is kept too, in case the goal shifts to reply-traction targets.
"""
from __future__ import annotations

import logging
import statistics
from datetime import datetime, timedelta, timezone

from . import hl_filter, store
from .config import Config
from .twitter import Twitter

log = logging.getLogger("hyperfeed.calibrate")

LADDER_RUNGS = (3, 5, 10, 15, 20, 30, 50)


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = min(len(s) - 1, max(0, int(round((p / 100.0) * (len(s) - 1)))))
    return float(s[idx])


def _baseline_views(tweets: list[dict], min_age_hours: int, now: datetime, window_start: datetime) -> tuple[float, list[dict]]:
    """Median of up to the last 15 mature, in-window views, plus the mature in-window tweets.

    Median, not mean: the outliers we hunt would inflate a mean baseline and hide the next one.
    """
    mature: list[dict] = []
    for t in tweets:
        created = hl_filter.parse_x_date(t.get("createdAt") or "")
        if not created or created < window_start:
            continue
        if created > now - timedelta(hours=min_age_hours):
            continue  # too young — still climbing, not a stable baseline sample
        if hl_filter.tweet_views(t) <= 0:
            continue
        mature.append(t)
    mature.sort(key=lambda t: hl_filter.parse_x_date(t.get("createdAt") or "") or now, reverse=True)
    sample = [hl_filter.tweet_views(t) for t in mature[:15]]
    baseline = round(statistics.median(sample), 3) if sample else 0.0
    return baseline, mature


def calibrate(cfg: Config, tw: Twitter, accounts: dict) -> dict:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=cfg.calibration_window_days)
    days = max(1, cfg.calibration_window_days)

    per_account: dict = {}
    sample: list[dict] = []   # one row per mature in-window tweet, with its score

    for handle, meta in accounts.items():
        tweets, _ = tw.user_last_tweets(handle, max_pages=cfg.lasttweets_max_pages, until_date=window_start)
        baseline, mature = _baseline_views(tweets, cfg.author_min_age_hours, now, window_start)
        followers = meta.get("followers", 0)
        if not followers and tweets:
            followers = hl_filter.author_followers(tweets[0])
        per_account[handle] = {"baseline_views": baseline, "n": len(mature), "followers": followers}

        for t in mature:
            views = hl_filter.tweet_views(t)
            eng = hl_filter.tweet_engagement(t)
            f = hl_filter.author_followers(t) or followers
            sc = hl_filter.outlier_score(views, f, eng, baseline)
            sample.append({
                "handle": handle,
                "score": sc["outlier_score"],
                "views_vs_author_avg": sc["views_vs_author_avg"],
                "views": views,
                "likes": hl_filter.tweet_likes(t),
                "engagement": eng,
                "url": hl_filter.tweet_url(t),
                "text": hl_filter.tweet_text(t)[:160],
                "created": t.get("createdAt") or "",
            })

    # Modest junk floors so a tiny-but-high-ratio post can't fire; the threshold does the real work.
    all_views = [s["views"] for s in sample]
    all_eng = [s["engagement"] for s in sample]
    min_views = int(max(500, _percentile([float(v) for v in all_views], 20)))
    min_engagement = int(max(10, _percentile([float(e) for e in all_eng], 20)))
    floored = [s for s in sample if s["views"] >= min_views and s["engagement"] >= min_engagement]

    scores = sorted((s["score"] for s in floored), reverse=True)

    def threshold_for(per_day: int) -> float:
        """Score that lets ~per_day tweets/day through. 0 ⇒ the sample can't be that selective."""
        n = per_day * days
        if not scores or len(scores) <= n:
            return 0.0
        return round(scores[n - 1], 1)

    def count_per_day(thr: float) -> float:
        return round(sum(1 for s in floored if s["score"] >= thr) / days, 2)

    ladder = [
        {"per_day": pd, "score_threshold": threshold_for(pd), "actual_per_day": count_per_day(threshold_for(pd))}
        for pd in LADDER_RUNGS
    ]

    # Raw-views ladder — the alternative metric if the goal is reply-traction, not author outliers.
    sv = sorted(all_views, reverse=True)
    def views_threshold_for(per_day: int) -> int:
        n = per_day * days
        return int(sv[n - 1]) if sv and len(sv) > n else 0
    views_ladder = [{"per_day": pd, "views_threshold": views_threshold_for(pd)} for pd in (5, 10, 15, 20, 30)]

    target = cfg.target_tweets_per_day
    threshold = threshold_for(target)
    note = ""
    if threshold <= 0:
        # The accounts don't produce `target`/day above the floors — fire everything that clears them
        # and fall back to a percentile so the line isn't literally zero.
        threshold = round(max(min(scores) if scores else 0.0, _percentile(scores, 100 - cfg.threshold_percentile)), 1)
        note = f"sample yields only {round(len(floored)/days,1)}/day above floors — below the {target}/day target"

    cal = {
        "computed_at": now.isoformat(),
        "window_days": days,
        "target_tweets_per_day": target,
        "threshold": threshold,
        "tweets_per_day_at_threshold": count_per_day(threshold),
        "total_relevant_per_day": round(len(sample) / days, 1),
        "min_views": min_views,
        "min_engagement": min_engagement,
        "median_baseline_views": _percentile([v["baseline_views"] for v in per_account.values() if v["baseline_views"] > 0], 50),
        "sample_size": len(sample),
        "floored_size": len(floored),
        "ladder": ladder,
        "views_ladder": views_ladder,
        "note": note,
        "accounts": per_account,
        "score_distribution": {
            "p50": round(_percentile([s["score"] for s in sample], 50), 1),
            "p75": round(_percentile([s["score"] for s in sample], 75), 1),
            "p90": round(_percentile([s["score"] for s in sample], 90), 1),
            "p95": round(_percentile([s["score"] for s in sample], 95), 1),
            "max": round(max((s["score"] for s in sample), default=0.0), 1),
        },
        "top_outliers": sorted(sample, key=lambda r: r["score"], reverse=True)[:6],
    }
    store.save_calibration(cal)
    log.info(
        "calibrated: %d accounts, %d tweets/%dd (%.1f/day total), threshold=%.1f for ~%d/day (actual %.2f/day)%s",
        len(per_account), len(sample), days, cal["total_relevant_per_day"],
        threshold, target, cal["tweets_per_day_at_threshold"], f" — {note}" if note else "",
    )
    return cal
