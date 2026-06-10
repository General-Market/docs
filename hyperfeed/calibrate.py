"""Calibration — learn each account's normal, then set the fire threshold from real history.

For every curated account we pull ~30 days of tweets, take a per-author baseline (the mean of
its recent *mature* views), and score every historical tweet with the same outlier formula the
scan uses. The fire threshold is a high percentile of that score distribution: by construction,
roughly the top (100 - THRESHOLD_PERCENTILE)% of historical posts would have fired. Absolute
floors (min views, min engagement) come from a low percentile, so a tiny post can never fire on
ratio alone and a giant account can't fire on a routine post.

This is the answer to "what is an outlier" — and `top_outliers` gives concrete examples.
"""
from __future__ import annotations

import logging
import statistics
from datetime import datetime, timedelta, timezone

from . import hl_filter, store
from .config import Config
from .twitter import Twitter

log = logging.getLogger("hyperfeed.calibrate")

CALIBRATION_PAGES = 3   # last_tweets pages per account (~20/page); 3 ≈ 60 recent tweets


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = min(len(s) - 1, max(0, int(round((p / 100.0) * (len(s) - 1)))))
    return float(s[idx])


def _baseline_views(tweets: list[dict], min_age_hours: int, now: datetime, window_start: datetime) -> tuple[float, list[dict]]:
    """Median of up to the last 15 mature, in-window views. Returns (baseline, mature_tweets).

    Median, not mean: the very outliers we hunt would inflate a mean baseline and then hide the
    next outlier behind it. The median is a robust estimate of the author's *normal* post.
    """
    mature: list[dict] = []
    for t in tweets:
        created = hl_filter.parse_x_date(t.get("createdAt") or "")
        if not created:
            continue
        if created < window_start:
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

    per_account: dict = {}
    all_scores: list[float] = []
    all_views: list[int] = []
    all_eng: list[int] = []
    historical: list[dict] = []

    for handle, meta in accounts.items():
        tweets, status = tw.user_last_tweets(handle, pages=CALIBRATION_PAGES)
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
            all_scores.append(sc["outlier_score"])
            all_views.append(views)
            all_eng.append(eng)
            historical.append({
                "handle": handle,
                "text": hl_filter.tweet_text(t)[:160],
                "views": views,
                "likes": hl_filter.tweet_likes(t),
                "engagement": eng,
                "url": hl_filter.tweet_url(t),
                "created": t.get("createdAt") or "",
                "outlier_score": sc["outlier_score"],
                "views_vs_author_avg": sc["views_vs_author_avg"],
            })

    baselines = [v["baseline_views"] for v in per_account.values() if v["baseline_views"] > 0]
    median_baseline = _percentile(baselines, 50) if baselines else 0.0

    threshold = max(120.0, round(_percentile(all_scores, cfg.threshold_percentile), 1)) if all_scores else 200.0
    min_views = int(max(1000, _percentile([float(v) for v in all_views], 40)))
    min_engagement = int(max(15, _percentile([float(e) for e in all_eng], 40)))

    top_outliers = sorted(historical, key=lambda r: r["outlier_score"], reverse=True)[:6]

    cal = {
        "computed_at": now.isoformat(),
        "window_days": cfg.calibration_window_days,
        "threshold": threshold,
        "threshold_percentile": cfg.threshold_percentile,
        "min_views": min_views,
        "min_engagement": min_engagement,
        "median_baseline_views": median_baseline,
        "sample_size": len(all_scores),
        "accounts": per_account,
        "score_distribution": {
            "p50": round(_percentile(all_scores, 50), 1),
            "p75": round(_percentile(all_scores, 75), 1),
            "p90": round(_percentile(all_scores, 90), 1),
            "p95": round(_percentile(all_scores, 95), 1),
            "max": round(max(all_scores), 1) if all_scores else 0.0,
        },
        "top_outliers": top_outliers,
    }
    store.save_calibration(cal)
    log.info(
        "calibrated: %d accounts, %d historical tweets, threshold=%.1f (p%d), min_views=%d",
        len(per_account), len(all_scores), threshold, cfg.threshold_percentile, min_views,
    )
    return cal
