#!/usr/bin/env python3
"""
Deep qualification: force-fetch profiles + tweets for the most promising
copy-trading creators. Extract real product URLs from tweet text and bios.
"""
from __future__ import annotations
import json
import subprocess
import sys
import re
import urllib.request
import urllib.parse
from pathlib import Path

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
CACHE = ROOT / "cache"
PROFILES = CACHE / "profiles.jsonl"
TWEETS = CACHE / "tweets.jsonl"
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
    print(f"  [budget] spent ${s:.3f} / ${STOP_AT_USD}", file=sys.stderr)
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


def run_force_userinfo(handle: str) -> dict:
    """Force-fetch fresh profile (bypasses cache)."""
    key_file = Path("/tmp/.twapi_key")
    if not key_file.exists():
        return {}
    api_key = key_file.read_text().strip()
    url = f"https://api.twitterapi.io/twitter/user/info?userName={handle}"
    req = urllib.request.Request(url, headers={"X-API-Key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = json.load(r)
        if body.get("status") == "success" and body.get("data"):
            return body["data"]
    except Exception as e:
        print(f"  error: {e}", file=sys.stderr)
    return {}


def run_search_for_account(handle: str, pages: int = 1) -> list[dict]:
    """Search recent tweets from handle."""
    key_file = Path("/tmp/.twapi_key")
    if not key_file.exists():
        return []
    api_key = key_file.read_text().strip()
    query = f"from:{handle}"
    params = urllib.parse.urlencode({"query": query, "queryType": "Latest"})
    url = f"https://api.twitterapi.io/twitter/tweet/advanced_search?{params}"
    req = urllib.request.Request(url, headers={"X-API-Key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = json.load(r)
        data = body.get("data") or {}
        tweets = data.get("tweets", []) if isinstance(data, dict) else []
        if not tweets:
            tweets = body.get("tweets", [])
        return tweets
    except Exception as e:
        print(f"  error: {e}", file=sys.stderr)
        return []


def expand_tco(url: str) -> str:
    """Follow t.co redirect to get final URL."""
    if "t.co" not in url:
        return url
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}, method="HEAD")
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.geturl()
    except Exception:
        pass
    # Try GET
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        # Don't follow redirect — just get the Location header
        import http.client
        parsed = urllib.parse.urlparse(url)
        conn = http.client.HTTPSConnection(parsed.netloc, timeout=5)
        conn.request("HEAD", parsed.path + ("?" + parsed.query if parsed.query else ""))
        resp = conn.getresponse()
        loc = resp.getheader("Location", "")
        if loc:
            return loc
    except Exception:
        pass
    return url


URL_RE = re.compile(r'https?://[^\s<>"]+')

# Top copy-trading accounts to deeply qualify
# Selected based on sweep results — non-exchange, appeared in copy/signals searches
TARGETS = [
    # High follower, appeared in copy/signals searches
    "Habbyforex_",       # 199k forex
    "abetrade",          # 198k, high ER
    "asklivermore",      # 130k, signals trading
    "HYPERDailyTK",      # 89k, Hyperliquid copy
    "Bitradexen",        # 86k
    "vainxyz",           # 93k
    "Ellaweb_3",         # 110k
    "sisibinance",       # 144k, crypto/signals
    "BroLeon",           # 115k, ZH crypto
    "Murphychen888",     # 79k
    "heoilikj",          # 74k
    "0x_Discover",       # 80k
    "RNR_0",             # 157k
    "Mrsolexpert_1",     # 64k
    "0xKingsKuan",       # 53k
    "Gyokeres_eth",      # 25k
    "liquidtrading",     # 34k
    "ExitLiqCapital",    # 35k
    "AsaabaCharlotte",   # 48k
    "louisregis",        # 15k
    "thankUcrypto",      # 152k
    "vooi_io",           # 182k, perp aggregator
    "coinfessions",      # 221k
    "ThinkingUSD",       # 283k
    "MerlijnTrader",     # 430k
    # ZH/KR/JA specific copy-trading accounts from search
    "XXY177",            # 93k ZH
    "Murphychen888",     # 79k ZH
    "zoetoshi",          # 101k
    # Sports tipsters
    "LoyalTipsters02",   # 140k betting
    "LevyKingTips",      # 131k sports betting
    "racingblogger",     # 233k horse racing
    "betr",              # 99k social sportsbook
    # Additional from tweets
    "DaCryptoLady_",     # 451k meme
    "pump_okLaly",       # 391k meme
    "NoLimitGains",      # 1.5M
    "fiddybps1",         # 27k paradex
    "otomate_trade",     # 3.5k but product site
    "trynormie",         # 253 but normie.trade
    "cedeflow",          # cede.flow real product
    "axonx_trade",       # axonx.xyz product
]


def main():
    print("=== Deep Qualification ===", file=sys.stderr)

    results = []
    seen = set()

    for handle in TARGETS:
        if handle.lower() in seen:
            continue
        seen.add(handle.lower())

        if check_stop():
            print("Budget limit — stopping", file=sys.stderr)
            break

        print(f"\n--- @{handle} ---", file=sys.stderr)

        # Force-fetch live profile
        data = run_force_userinfo(handle)
        if not data:
            print("  no data", file=sys.stderr)
            # Fall back to cache
            cached = {}
            for p in load_jsonl(PROFILES):
                if (p.get("screen_name") or "").lower() == handle.lower():
                    cached = p
                    break
            data = {
                "userName": cached.get("screen_name", handle),
                "followers": cached.get("followers_count", 0),
                "description": cached.get("description", ""),
                "url": cached.get("url", ""),
                "pinnedTweetIds": cached.get("pinned_tweet_ids"),
            }

        followers = data.get("followers") or data.get("followers_count") or 0
        bio = data.get("description") or ""
        url_raw = data.get("url") or ""
        pinned = data.get("pinnedTweetIds") or []

        print(f"  followers={followers}", file=sys.stderr)
        print(f"  bio={bio[:120]}", file=sys.stderr)
        print(f"  url_raw={url_raw}", file=sys.stderr)

        # Expand t.co in URL and bio
        expanded_url = url_raw
        if "t.co" in url_raw:
            expanded_url = expand_tco(url_raw)
            print(f"  expanded={expanded_url}", file=sys.stderr)

        # Find URLs in bio
        bio_urls = URL_RE.findall(bio)
        bio_urls_expanded = []
        for u in bio_urls:
            if "t.co" in u:
                exp = expand_tco(u)
                bio_urls_expanded.append(exp)
                print(f"  bio url expanded: {u} -> {exp}", file=sys.stderr)
            else:
                bio_urls_expanded.append(u)

        # Get recent tweets
        tweets = run_search_for_account(handle, 1)
        tweet_texts = [t.get("text", "") for t in tweets[:5]]

        # Find product URLs in tweets
        tweet_urls = []
        for t in tweets[:10]:
            txt = t.get("text", "")
            for u in URL_RE.findall(txt):
                if "t.co" in u:
                    exp = expand_tco(u)
                    if exp != u and "twitter.com" not in exp and "x.com" not in exp:
                        tweet_urls.append(exp)
                elif "twitter.com" not in u and "x.com" not in u:
                    tweet_urls.append(u)

        # Aggregate all real URLs
        all_urls = []
        for u in ([expanded_url] + bio_urls_expanded + tweet_urls):
            if u and "t.co" not in u and "x.com" not in u and "twitter.com" not in u:
                all_urls.append(u)

        # Deduplicate
        all_urls = list(dict.fromkeys(all_urls))
        print(f"  all product URLs: {all_urls[:5]}", file=sys.stderr)

        # Score the best URL
        best_url = ""
        best_score = 0
        for u in all_urls:
            ul = u.lower()
            score = 0
            if any(x in ul for x in [".io", ".com", ".app", ".co", ".net", ".xyz",
                                       ".finance", ".trade", ".pro", ".ai"]):
                score = 3
            if "t.me" in ul or "telegram" in ul:
                score = 2
            if "linktr.ee" in ul or "beacons" in ul:
                score = 1
            if score > best_score:
                best_score = score
                best_url = u

        # Assess relevance
        all_text = bio.lower() + " " + " ".join(tweet_texts).lower()
        copy_signals = [
            "copy", "signal", "带单", "跟单", "카피", "리딩", "コピー",
            "trade alert", "copytrading", "follow my trade", "tipster",
            "picks", "subscription", "vip", "pnl", "roi",
        ]
        relevance_score = sum(1 for s in copy_signals if s in all_text)

        result = {
            "handle": handle,
            "followers": followers,
            "bio": bio[:200],
            "best_url": best_url,
            "url_score": best_score,
            "all_urls": all_urls[:5],
            "relevance_score": relevance_score,
            "sample_tweets": tweet_texts[:3],
        }
        results.append(result)

        print(f"  best_url={best_url} score={best_score}", file=sys.stderr)
        print(f"  relevance={relevance_score}", file=sys.stderr)

    print(f"\n\nBalance: {current_balance()} credits, spent ${spent_usd():.3f}")

    # Rank results
    def rank_score(r):
        url_s = r.get("url_score", 0) * 3
        followers_s = min(r.get("followers", 0) / 500_000, 1) * 2
        rel_s = min(r.get("relevance_score", 0), 5) / 5 * 3
        return url_s + followers_s + rel_s

    results.sort(key=rank_score, reverse=True)

    print("\n=== FINAL RANKED RESULTS ===")
    print(f"{'rank':>4} {'handle':30s} {'followers':>10} {'url_s':>5} {'rel':>4}  best_url")
    print("-" * 120)
    for i, r in enumerate(results[:25]):
        print(f"{i+1:>4} @{r['handle']:30s} {r['followers']:>10,} "
              f"{r['url_score']:>5} {r['relevance_score']:>4}  {r['best_url'][:60]}")
        if r["bio"]:
            print(f"       bio: {r['bio'][:100]}")
        print()

    # Save
    out = CACHE / "copy_trading_deep_qualified.jsonl"
    with out.open("w") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"Saved to {out}")


if __name__ == "__main__":
    main()
