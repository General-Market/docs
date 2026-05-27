"""The scan + calibration engine.

A scan asks twitterapi.io for the topic's recent tweets already above the
engagement threshold, drops the ones we've already pinged, ranks the rest, and
hands back the top slice. Calibration asks the topic *without* a threshold,
looks at how much engagement ~1h-old tweets actually carry, and recommends a
threshold from that distribution — because a tweet caught an hour after posting
hasn't finished climbing.
"""
from __future__ import annotations

import html
import logging
from datetime import datetime, timedelta, timezone

from . import config, twitter

log = logging.getLogger("xwatch.scan")

# X's createdAt format: "Wed May 27 14:03:21 +0000 2026"
_X_TIME = "%a %b %d %H:%M:%S %z %Y"


def _parse_time(s: str):
    try:
        return datetime.strptime(s, _X_TIME)
    except Exception:
        return None


def _likes(t: dict) -> int:
    return int(t.get("likeCount") or 0)


def _engagement(t: dict) -> int:
    return (
        int(t.get("likeCount") or 0)
        + int(t.get("retweetCount") or 0)
        + int(t.get("replyCount") or 0)
        + int(t.get("quoteCount") or 0)
    )


def _author(t: dict) -> str:
    return (t.get("author") or {}).get("userName") or t.get("authorName") or "?"


def _since_str(hours: int) -> str:
    dt = datetime.now(timezone.utc) - timedelta(hours=hours)
    return dt.strftime("%Y-%m-%d_%H:%M:%S_UTC")


def build_query(settings: dict, *, min_faves: int | None = None) -> str:
    """Assemble the X advanced-search query string from settings.

    min_faves overrides the stored threshold (used by calibration, which wants a
    wider net). A non-positive min_faves omits the filter entirely.
    """
    parts = [settings["query"].strip()]
    mf = settings["threshold"] if min_faves is None else min_faves
    if mf and mf > 0:
        parts.append(f"min_faves:{mf}")
    if settings.get("lang"):
        parts.append(f"lang:{settings['lang']}")
    parts.append(f"since:{_since_str(settings.get('lookback_hours', 3))}")
    parts.append("-filter:retweets")
    return " ".join(parts)


def run_scan(settings: dict, seen: dict) -> tuple[list[dict], int]:
    """Return (new_tweets_sorted_desc_by_engagement, http_status).

    Mutates nothing; the caller records `seen` after a successful ping.
    """
    query = build_query(settings)
    tweets, status = twitter.advanced_search(query)
    fresh = []
    for t in tweets:
        tid = str(t.get("id") or "")
        if not tid or tid in seen:
            continue
        if _likes(t) < settings["threshold"]:
            continue  # defensive: server should already enforce min_faves
        fresh.append(t)
    fresh.sort(key=_engagement, reverse=True)
    return fresh, status


def calibrate(settings: dict) -> dict:
    """One wide pass: distribution of engagement + the accounts driving it.

    Returns a dict with a recommended threshold and the top influencers, ready
    to format for Telegram. Recommendation = ~60th percentile of likes among the
    sampled tweets, floored at 5, so we sit just above the noise without
    demanding viral numbers from hour-old posts.
    """
    query = build_query(settings, min_faves=2)
    tweets, status = twitter.advanced_search(query)
    if not tweets:
        return {"status": status, "sample": 0, "recommended": settings["threshold"]}

    likes = sorted(_likes(t) for t in tweets)
    n = len(likes)

    def pct(p: float) -> int:
        if n == 0:
            return 0
        return likes[min(n - 1, int(p * n))]

    recommended = max(5, pct(0.60))

    # Influencers: rank authors by their best tweet's engagement in the sample.
    by_author: dict[str, dict] = {}
    for t in tweets:
        a = _author(t)
        e = _engagement(t)
        cur = by_author.get(a)
        if cur is None or e > cur["engagement"]:
            followers = (t.get("author") or {}).get("followers") or 0
            by_author[a] = {"handle": a, "engagement": e, "followers": followers}
    influencers = sorted(by_author.values(), key=lambda x: x["engagement"], reverse=True)[:8]

    return {
        "status": status,
        "sample": n,
        "p25": pct(0.25),
        "median": pct(0.50),
        "p60": pct(0.60),
        "p90": pct(0.90),
        "max": likes[-1],
        "recommended": recommended,
        "influencers": influencers,
    }


def format_tweet(t: dict) -> str:
    a = _author(t)
    created = _parse_time(t.get("createdAt") or "")
    if created:
        age_min = int((datetime.now(timezone.utc) - created).total_seconds() // 60)
        age = f"{age_min}m" if age_min < 90 else f"{age_min // 60}h{age_min % 60:02d}m"
    else:
        age = "?"
    text = html.escape((t.get("text") or "").strip())
    if len(text) > 280:
        text = text[:277] + "…"
    url = t.get("url") or f"https://x.com/{a}/status/{t.get('id')}"
    followers = (t.get("author") or {}).get("followers")
    foll = f" · {followers:,} followers" if isinstance(followers, int) else ""
    return (
        f"<b>@{html.escape(a)}</b>{foll} · {age} old\n"
        f"♥ {_likes(t):,}  ↻ {int(t.get('retweetCount') or 0):,}  "
        f"💬 {int(t.get('replyCount') or 0):,}  ❝ {int(t.get('quoteCount') or 0):,}\n\n"
        f"{text}\n\n"
        f'<a href="{html.escape(url)}">open on X</a>'
    )


def format_calibration(c: dict, settings: dict) -> str:
    if c.get("sample", 0) == 0:
        return (
            f"<b>Calibration</b> — query <code>{html.escape(settings['query'])}</code>\n"
            f"No tweets in the last {settings.get('lookback_hours', 3)}h "
            f"(status {c.get('status')}). Topic is quiet — keep the current "
            f"threshold of <b>{settings['threshold']}</b>."
        )
    lines = [
        f"<b>Calibration</b> — <code>{html.escape(settings['query'])}</code>, "
        f"last {settings.get('lookback_hours', 3)}h, {c['sample']} tweets sampled",
        "",
        "Likes distribution:",
        f"  25th pct: {c['p25']}   median: {c['median']}   "
        f"60th: {c['p60']}   90th: {c['p90']}   max: {c['max']}",
        "",
        f"Recommended threshold: <b>{c['recommended']}</b>  "
        f"(currently <b>{settings['threshold']}</b>)",
        f"Set it with <code>/threshold {c['recommended']}</code>",
    ]
    infl = c.get("influencers") or []
    if infl:
        lines += ["", "<b>Influencers driving this topic:</b>"]
        for i in infl:
            foll = f"{i['followers']:,}f" if i.get("followers") else "?f"
            lines.append(f"  @{html.escape(i['handle'])} — {i['engagement']:,} eng · {foll}")
    return "\n".join(lines)
