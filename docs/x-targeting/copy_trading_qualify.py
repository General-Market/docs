#!/usr/bin/env python3
"""
Phase 2: Qualify copy-trading creator candidates.
Pull full profiles and recent tweets for top candidates.
Score by: (has real product website) AND (performing/engaging).
"""
from __future__ import annotations
import json
import subprocess
import sys
import re
from pathlib import Path

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
CACHE = ROOT / "cache"
PROFILES = CACHE / "profiles.jsonl"
TWEETS = CACHE / "tweets.jsonl"
CANDIDATES = CACHE / "copy_trading_candidates.jsonl"
CREDITS_PER_USD = 100_000
BALANCE_AT_START = 395240
STOP_AT_USD = 3.40


def current_balance():
    result = subprocess.run(
        ["python3", str(ROOT / "twapi.py"), "balance"],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    try:
        return json.loads(result.stdout).get("total", 0)
    except Exception:
        return 0


def spent_usd():
    return max(0, BALANCE_AT_START - current_balance()) / CREDITS_PER_USD


def check_stop():
    s = spent_usd()
    print(f"  [budget] spent ${s:.3f} / ${STOP_AT_USD} limit", file=sys.stderr)
    return s >= STOP_AT_USD


def load_jsonl(p: Path) -> list[dict]:
    if not p.exists():
        return []
    rows = []
    for line in p.read_text().split("\n"):
        line = line.strip()
        if line:
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
    return rows


def run_userinfo(handle: str):
    args = ["python3", str(ROOT / "twapi.py"), "userinfo", handle]
    result = subprocess.run(args, capture_output=True, text=True, cwd=str(ROOT))
    print(result.stderr[-300:], file=sys.stderr)
    try:
        return json.loads(result.stdout)
    except Exception:
        return {}


def run_lasttweets(handle: str, count: int = 10):
    args = ["python3", str(ROOT / "twapi.py"), "lasttweets", handle, "--count", str(count)]
    result = subprocess.run(args, capture_output=True, text=True, cwd=str(ROOT))
    print(result.stderr[-300:], file=sys.stderr)
    return result.stdout.strip()


def get_profile(handle: str) -> dict:
    rows = load_jsonl(PROFILES)
    for r in rows:
        if (r.get("screen_name") or "").lower() == handle.lower():
            return r
    return {}


def get_tweets(handle: str) -> list[dict]:
    all_tweets = load_jsonl(TWEETS)
    return [t for t in all_tweets if (t.get("screen_name") or "").lower() == handle.lower()]


def score_url(url: str | None) -> tuple[int, str]:
    """Return (score, reason). 0=none, 1=linktr/beacons, 2=telegram-only, 3=real product website."""
    if not url:
        return 0, "no url"
    url_lower = url.lower()
    if any(x in url_lower for x in ["linktree", "linktr.ee", "beacons.ai", "bio.link", "carrd.co"]):
        return 1, f"link-aggregator: {url}"
    if "t.me" in url_lower or "telegram" in url_lower:
        return 2, f"telegram: {url}"
    if any(x in url_lower for x in ["twitter.com", "x.com", "t.co"]):
        return 0, "self-link"
    # Real website heuristics
    if any(x in url_lower for x in [".io", ".com", ".app", ".co", ".net", ".xyz", ".finance", ".trade", ".pro"]):
        return 3, f"website: {url}"
    return 1, f"weak-url: {url}"


def engagement_rate(tweets: list[dict], followers: int) -> float:
    if not tweets or not followers:
        return 0.0
    recent = sorted(tweets, key=lambda t: t.get("created_at") or "", reverse=True)[:10]
    avg_eng = sum((t.get("favorites") or 0) + (t.get("retweets") or 0) for t in recent) / len(recent)
    return (avg_eng / followers) * 100


def is_copy_trading_relevant(bio: str, sample_texts: list[str]) -> bool:
    """Check if the account is actually about copy trading / signals."""
    combined = (bio or "").lower() + " " + " ".join(sample_texts).lower()
    signals = [
        "copy", "signal", "带单", "跟单", "카피", "리딩", "コピー", "trade alert",
        "trading alert", "copytrading", "follow my trade", "copy trade",
        "tipster", "picks", "bet", "signal service", "telegram", "discord",
        "subscription", "vip", "leaderboard", "pnl", "profit", "roi",
        "hyperliquid", "bybit", "binance", "gmgn", "pump.fun",
    ]
    return sum(1 for s in signals if s in combined) >= 2


# Focus: accounts that appeared in copy-trading-related searches
# Pull top 60 by follower count that seem relevant, then qualify
SKIP_HANDLES = {
    # Clearly not copy-trading creators — exchanges, news, AI tools
    "arkham", "hyperliquidx", "blockworks", "openaidevs", "aster_dex",
    "bingxofficial", "bitrueofficial", "gate_zh", "sosovaluecrypto",
    "gmgnai",  # tool, not creator
}


def main():
    print("=== Qualification Phase ===", file=sys.stderr)

    candidates = load_jsonl(CANDIDATES)
    print(f"Total candidates: {len(candidates)}", file=sys.stderr)

    # Filter to relevance: need follower data, not exchange/infra
    relevant = []
    for c in candidates:
        sn = (c.get("screen_name") or "").lower()
        if sn in SKIP_HANDLES:
            continue
        followers = c.get("followers") or 0
        if followers < 1000:
            continue
        bio = (c.get("bio") or "").lower()
        texts = c.get("sample_texts") or []
        if is_copy_trading_relevant(bio, texts) or followers > 50000:
            relevant.append(c)

    # Sort by followers
    relevant.sort(key=lambda a: a.get("followers") or 0, reverse=True)
    print(f"Relevant candidates after filter: {len(relevant)}", file=sys.stderr)

    # Fetch full profiles for top 60
    to_qualify = relevant[:60]

    results = []
    for i, cand in enumerate(to_qualify):
        if check_stop():
            print("Budget limit reached, stopping qualification", file=sys.stderr)
            break

        handle = cand.get("screen_name")
        print(f"\n[{i+1}/{len(to_qualify)}] @{handle} ({cand.get('followers')} followers)", file=sys.stderr)

        # Get/refresh profile
        profile = run_userinfo(handle)

        # Load from cache after fetch
        cached = get_profile(handle)
        bio = cached.get("description") or cand.get("bio") or ""
        url = cached.get("url") or cand.get("url") or ""
        followers = cached.get("followers_count") or cand.get("followers") or 0

        # Get recent tweets (may be cached)
        tweets = get_tweets(handle)
        if len(tweets) < 5:
            run_lasttweets(handle, 10)
            tweets = get_tweets(handle)

        url_score, url_reason = score_url(url)
        er = engagement_rate(tweets, followers or 1)
        relevant_flag = is_copy_trading_relevant(bio, [t.get("text") or "" for t in tweets[:5]])

        result = {
            "handle": handle,
            "followers": followers,
            "bio": bio[:200],
            "url": url,
            "url_score": url_score,
            "url_reason": url_reason,
            "engagement_rate": round(er, 4),
            "tweet_count_cached": len(tweets),
            "copy_trading_relevant": relevant_flag,
            "sample_texts": [t.get("text", "")[:100] for t in tweets[:3]],
        }
        results.append(result)
        print(f"  followers={followers}, url_score={url_score}, er={er:.3f}%, relevant={relevant_flag}", file=sys.stderr)
        print(f"  bio: {bio[:100]}", file=sys.stderr)
        print(f"  url: {url}", file=sys.stderr)

    # Score and rank
    def total_score(r):
        url_s = r.get("url_score", 0)
        er_s = min(r.get("engagement_rate", 0), 5) / 5  # normalize 0-1
        followers_log = min(r.get("followers", 0) / 1_000_000, 1)
        relevance = 1 if r.get("copy_trading_relevant") else 0
        return url_s * 3 + er_s * 2 + followers_log * 1 + relevance * 2

    results.sort(key=total_score, reverse=True)

    print("\n\n=== QUALIFIED RESULTS (top 30, ranked by score) ===")
    print(f"{'rank':>4} {'handle':30s} {'followers':>10} {'url_s':>5} {'er%':>6} {'rel':>4}  url")
    print("-" * 100)
    for i, r in enumerate(results[:30]):
        print(f"{i+1:>4} @{r['handle']:30s} {r['followers']:>10,} "
              f"{r['url_score']:>5} {r['engagement_rate']:>5.2f}% "
              f"{'Y' if r['copy_trading_relevant'] else 'N':>4}  {r['url'][:50]}")

    print(f"\nSpent so far: ${spent_usd():.4f}")
    print(f"Balance: {current_balance()} credits")

    # Save results
    out = CACHE / "copy_trading_qualified.jsonl"
    with out.open("w") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"\nSaved {len(results)} qualified results to {out}")


if __name__ == "__main__":
    main()
