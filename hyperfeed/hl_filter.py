"""The Hyperliquid relevance gate and the outlier score.

The *vocabulary* is authoritative and lives in the radar: this module imports
HYPERLIQUID_TERMS, HYPERLIQUID_TOKEN_PATTERNS, HYPERLIQUID_AUTHOR_REGEX, and the CJK-safe
term_in_text matcher from the bind-mounted find_native_x_articles.py. When the radar vocab is
expanded, hyperfeed follows automatically — one source of truth.

The *outlier score* is re-implemented here on raw tweet dicts (it is three lines). It is a
faithful copy of find_native_x_articles.py:789-797 — keep them in step if that formula changes.

Also holds the tweet-field accessors so "what is a Hyperliquid tweet and how good is it" lives
in one place. Tweet dicts are twitterapi.io advanced_search / last_tweets rows (camelCase).
"""
from __future__ import annotations

import functools
import importlib.util
import os
import re
import sys
from datetime import datetime
from pathlib import Path

_X_TIME = "%a %b %d %H:%M:%S %z %Y"   # X createdAt, e.g. "Wed May 27 14:03:21 +0000 2026"


@functools.lru_cache(maxsize=1)
def _radar():
    """Load the live HL vocabulary module by file path. Cached for the process lifetime."""
    xt = Path(os.environ.get("X_TARGETING_DIR") or (Path(__file__).resolve().parent.parent / "docs" / "x-targeting"))
    # find_native_x_articles.py does `import twapi`, so its parent dir must be importable.
    if str(xt) not in sys.path:
        sys.path.insert(0, str(xt))
    path = xt / "x_articles" / "find_native_x_articles.py"
    if not path.exists():
        raise SystemExit(
            f"hyperfeed: HL vocabulary source not found at {path}. "
            "Set X_TARGETING_DIR or mount the radar at /app/x-targeting."
        )
    spec = importlib.util.spec_from_file_location("hyperfeed_radar_vocab", path)
    mod = importlib.util.module_from_spec(spec)
    # Register before exec: the radar defines @dataclass classes whose field-type
    # resolution looks the module up in sys.modules during class creation.
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def vocab_summary() -> dict:
    r = _radar()
    return {
        "n_terms": len(r.HYPERLIQUID_TERMS),
        "n_token_patterns": len(r.HYPERLIQUID_TOKEN_PATTERNS),
    }


def is_hyperliquid(text: str, author_handle: str = "") -> bool:
    """Radar-faithful relevance gate: a term match, a token-context pattern, or an in-niche handle."""
    r = _radar()
    t = (text or "").lower()
    if any(r.term_in_text(term, t) for term in r.HYPERLIQUID_TERMS):
        return True
    for pattern in r.HYPERLIQUID_TOKEN_PATTERNS:
        if re.search(pattern, t, re.I):
            return True
    if author_handle and re.search(r.HYPERLIQUID_AUTHOR_REGEX, author_handle, re.I):
        return True
    return False


def outlier_score(views: int, followers: int, engagement: int, baseline_views: float) -> dict:
    """Relative (×author) + absolute (per-follower) blend. Copy of find_native_x_articles.py:789-797."""
    views_per_1k_followers = round(views * 1000 / followers, 3) if followers > 0 else 0.0
    views_vs_author_avg = round(views / baseline_views, 3) if baseline_views > 0 else 0.0
    engagement_per_1k_views = round(engagement * 1000 / views, 3) if views > 0 else 0.0
    score = round(views_vs_author_avg * 100 + views_per_1k_followers + engagement_per_1k_views, 3)
    return {
        "views_per_1k_followers": views_per_1k_followers,
        "views_vs_author_avg": views_vs_author_avg,
        "engagement_per_1k_views": engagement_per_1k_views,
        "outlier_score": score,
    }


# -- tweet-field accessors (twitterapi.io camelCase) -------------------------

def _int(v) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def tweet_id(t: dict) -> str:
    return str(t.get("id") or "")


def tweet_text(t: dict) -> str:
    return (t.get("text") or "").strip()


def tweet_views(t: dict) -> int:
    return _int(t.get("viewCount"))


def tweet_likes(t: dict) -> int:
    return _int(t.get("likeCount"))


def tweet_engagement(t: dict) -> int:
    return (
        _int(t.get("likeCount"))
        + _int(t.get("retweetCount"))
        + _int(t.get("replyCount"))
        + _int(t.get("quoteCount"))
    )


def author_handle(t: dict) -> str:
    return (t.get("author") or {}).get("userName") or t.get("authorName") or "?"


def author_followers(t: dict) -> int:
    return _int((t.get("author") or {}).get("followers"))


def tweet_url(t: dict) -> str:
    return t.get("url") or f"https://x.com/{author_handle(t)}/status/{tweet_id(t)}"


def parse_x_date(s: str) -> datetime | None:
    try:
        return datetime.strptime(s, _X_TIME)
    except Exception:
        return None
