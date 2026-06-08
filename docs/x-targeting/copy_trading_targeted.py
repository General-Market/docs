#!/usr/bin/env python3
"""
Targeted deeper searches for copy-trading SERVICE accounts with real websites.
Focus: accounts explicitly running a copy-trading product/platform.
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
    bal = current_balance()
    print(f"  [budget] spent=${s:.3f} balance={bal} credits", file=sys.stderr)
    return s >= STOP_AT_USD


def advsearch_raw(query: str, query_type: str = "Top") -> list[dict]:
    """Direct API call, returns tweet list."""
    key_file = Path("/tmp/.twapi_key")
    if not key_file.exists():
        return []
    api_key = key_file.read_text().strip()
    params = urllib.parse.urlencode({"query": query, "queryType": query_type})
    url = f"https://api.twitterapi.io/twitter/tweet/advanced_search?{params}"
    req = urllib.request.Request(url, headers={"X-API-Key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = json.load(r)
        data = body.get("data") or {}
        tweets = data.get("tweets", []) if isinstance(data, dict) else []
        if not tweets:
            tweets = body.get("tweets", [])
        return tweets or []
    except Exception as e:
        print(f"  search error: {e}", file=sys.stderr)
        return []


def userinfo_raw(handle: str) -> dict:
    key_file = Path("/tmp/.twapi_key")
    if not key_file.exists():
        return {}
    api_key = key_file.read_text().strip()
    url = f"https://api.twitterapi.io/twitter/user/info?userName={handle}"
    req = urllib.request.Request(url, headers={"X-API-Key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = json.load(r)
        if body.get("status") == "success":
            return body.get("data") or {}
    except Exception as e:
        print(f"  userinfo error for {handle}: {e}", file=sys.stderr)
    return {}


def expand_tco(url: str) -> str:
    if "t.co" not in url:
        return url
    try:
        import http.client
        parsed = urllib.parse.urlparse(url)
        conn = http.client.HTTPSConnection(parsed.netloc, timeout=5)
        path = parsed.path
        if parsed.query:
            path += "?" + parsed.query
        conn.request("HEAD", path, headers={"User-Agent": "Mozilla/5.0"})
        resp = conn.getresponse()
        loc = resp.getheader("Location", "")
        if loc and loc != url:
            return loc
    except Exception:
        pass
    return url


URL_RE = re.compile(r'https?://[^\s<>"]+')


def collect_authors_from_tweets(tweets: list[dict]) -> dict[str, dict]:
    authors = {}
    for t in tweets:
        author = t.get("author") or {}
        sn = author.get("userName") or t.get("authorName") or ""
        if not sn:
            sn = (t.get("screen_name") or "")
        if not sn:
            continue
        snl = sn.lower()
        if snl not in authors:
            authors[snl] = {
                "screen_name": sn,
                "followers": author.get("followers") or 0,
                "bio": author.get("description") or "",
                "url": author.get("url") or "",
                "tweet_count": 0,
                "total_likes": 0,
                "tweets": [],
            }
        authors[snl]["tweet_count"] += 1
        authors[snl]["total_likes"] += t.get("likeCount") or 0
        authors[snl]["tweets"].append((t.get("text") or "")[:200])
    return authors


# More targeted queries
TARGETED_QUERIES = [
    # EN: explicit service/product copy trading
    ("copytrading service platform website min_faves:20", "Top"),
    ("\"copy trading\" hyperliquid platform min_faves:30", "Top"),
    ("perp signals service subscribe min_faves:20", "Top"),
    ("\"trade with me\" crypto signals min_faves:30", "Top"),
    ("crypto signals vip telegram website", "Top"),
    ("bybit copy trade signals", "Top"),
    ("binance copy trading leaderboard signals", "Top"),
    ("\"my trading signals\" crypto subscribe", "Top"),
    ("copy trader ROI proof min_faves:20", "Top"),
    # Hyperliquid specific
    ("hyperliquid vault copy performance", "Top"),
    ("\"hyperliquid\" \"copy\" OR \"mirror\" trades", "Top"),
    # ZH deeper
    ("带单 跟单 收费 跟单神器", "Top"),
    ("币圈带单 月收益 跟单", "Top"),
    # KR deeper
    ("코인 카피트레이딩 수익인증 구독", "Top"),
    # JA deeper
    ("コピートレード 実績 自動売買 サービス", "Top"),
    # GMGN / onchain copy
    ("GMGN mirror trade wallet copy", "Top"),
    ("wallet copy trading onchain bot", "Top"),
    ("copy wallet trades onchain crypto", "Top"),
]


def main():
    print("=== Targeted Copy-Trading Service Search ===", file=sys.stderr)
    print(f"  Starting balance: {current_balance()} credits", file=sys.stderr)

    all_authors: dict[str, dict] = {}

    for query, qtype in TARGETED_QUERIES:
        if check_stop():
            print("Budget stop", file=sys.stderr)
            break

        print(f"\n  SEARCH [{qtype}] {query!r}", file=sys.stderr)
        tweets = advsearch_raw(query, qtype)
        print(f"    got {len(tweets)} tweets", file=sys.stderr)

        batch = collect_authors_from_tweets(tweets)
        for snl, data in batch.items():
            if snl not in all_authors:
                all_authors[snl] = data
            else:
                all_authors[snl]["tweet_count"] += data["tweet_count"]
                all_authors[snl]["total_likes"] += data["total_likes"]
                all_authors[snl]["tweets"].extend(data["tweets"])

    print(f"\n  Total new authors found: {len(all_authors)}", file=sys.stderr)
    print(f"  Spent: ${spent_usd():.3f}", file=sys.stderr)

    # Now deep-qualify the most promising ones: those with followers > 1k
    # AND whose tweets/bio mention real signals/copy service
    print("\n=== Deep qualifying new authors ===", file=sys.stderr)

    service_authors = []
    for snl, data in all_authors.items():
        followers = data.get("followers") or 0
        bio = data.get("bio") or ""
        tweets_text = " ".join(data.get("tweets") or [])
        all_text = (bio + " " + tweets_text).lower()

        # Signal words for actual service/product
        service_signals = [
            "subscribe", "vip", "paid", "premium", "monthly", "service",
            "website", "platform", "signals service", "copy trade service",
            "copy trading service", "join", "telegram", "discord",
            "带单收费", "跟单服务", "付费", "收费",
            "구독", "서비스", "유료",
            "サービス", "有料",
        ]
        service_count = sum(1 for s in service_signals if s in all_text)

        url = data.get("url") or ""
        has_url = bool(url) and "x.com" not in url and "twitter.com" not in url

        if followers >= 1000 or service_count >= 2:
            service_authors.append({
                **data,
                "service_score": service_count,
                "has_url": has_url,
                "followers": followers,
            })

    service_authors.sort(key=lambda a: (a.get("has_url", False), a.get("service_score", 0),
                                         a.get("followers", 0)), reverse=True)

    print(f"\nPromising service accounts: {len(service_authors)}", file=sys.stderr)

    # Force-fetch full profiles for top 20 service accounts
    enriched = []
    for i, author in enumerate(service_authors[:25]):
        if check_stop():
            break
        handle = author.get("screen_name")
        if not handle:
            continue
        print(f"\n  [{i+1}] @{handle} (followers={author.get('followers')}, service_score={author.get('service_score')})", file=sys.stderr)

        # Get full profile
        profile = userinfo_raw(handle)
        if profile:
            author["followers"] = profile.get("followers") or author.get("followers") or 0
            author["bio"] = profile.get("description") or author.get("bio") or ""
            url_raw = profile.get("url") or ""
            if url_raw and "t.co" in url_raw:
                expanded = expand_tco(url_raw)
                author["url"] = expanded
                author["has_url"] = bool(expanded) and "x.com" not in expanded
            else:
                author["url"] = url_raw
                author["has_url"] = bool(url_raw) and "x.com" not in url_raw

        # Also look for URLs in bio
        bio = author.get("bio") or ""
        for u in URL_RE.findall(bio):
            if "t.co" in u:
                exp = expand_tco(u)
                if exp and "x.com" not in exp and "twitter.com" not in exp:
                    if not author.get("url") or "t.co" in (author.get("url") or ""):
                        author["url"] = exp
                        author["has_url"] = True
                        break

        print(f"    followers={author.get('followers')}, url={author.get('url')[:60] if author.get('url') else 'none'}", file=sys.stderr)
        print(f"    bio={bio[:100]}", file=sys.stderr)
        enriched.append(author)

    print(f"\n\n=== NEW SERVICE ACCOUNTS FOUND ===")
    for a in sorted(enriched, key=lambda x: (x.get("has_url", False), x.get("followers", 0)), reverse=True):
        url = a.get("url") or ""
        has = "WEBSITE" if (a.get("has_url") and "t.me" not in url and "discord" not in url) else \
              "TELEGRAM" if "t.me" in url else \
              "DISCORD" if "discord" in url else "NONE"
        print(f"  {has:8s} @{a.get('screen_name'):30s} {a.get('followers') or 0:>8} fol  svc={a.get('service_score',0)}")
        if url:
            print(f"           url: {url[:70]}")
        if a.get("bio"):
            print(f"           bio: {a.get('bio')[:100]}")

    print(f"\nBalance: {current_balance()} credits, spent ${spent_usd():.3f}")


if __name__ == "__main__":
    main()
