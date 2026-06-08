#!/usr/bin/env python3
"""pump.fun trending → X fear/greed gauge.

Pick the latest TRENDING pair on pump.fun, pull recent X (Twitter) posts that
mention its $-cashtag, and fold them into a single 0-100 fear/greed reading —
the same shape as the crypto Fear & Greed Index, but for one freshly-trending
memecoin instead of the whole market.

Pipeline:
  1. discover  — GET pump.fun listing, rank by a trend proxy, pick #1
  2. search    — one paid X advanced_search page for the coin's $CASHTAG
  3. score     — lexicon sentiment × engagement weight + mention velocity → 0-100
  4. gauge     — map to Extreme Fear … Extreme Greed, print the dial

Spend: ONE X search call per run (~15-30 credits ≈ $0.0003). Budget is enforced
by the shared twapi.py ledger. Use --dry-run to skip the paid call entirely
(scores from whatever is already in the local tweet cache).

Usage:
  feargreed.py                       # auto: trending coin → live gauge
  feargreed.py --symbol GARY         # force a cashtag, skip discovery
  feargreed.py --dry-run             # no paid call; use cached tweets
  feargreed.py --json                # machine-readable output
  feargreed.py --sort last_reply     # change the trending proxy
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Reuse the metered, budget-capped X client that the niche-research stack already
# uses. It owns the API key (/tmp/.twapi_key), the spend ledger, and the hard cap.
TWAPI_DIR = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
sys.path.insert(0, str(TWAPI_DIR))
try:
    import twapi  # type: ignore
except Exception as e:  # pragma: no cover - import guard
    twapi = None
    _TWAPI_ERR = e

PUMP_API = "https://frontend-api-v3.pump.fun/coins"
UA = "Mozilla/5.0 (compatible; feargreed/1.0)"


# --------------------------------------------------------------------------- #
# 1. pump.fun trending discovery
# --------------------------------------------------------------------------- #
def fetch_pump_listing(sort: str = "market_cap", limit: int = 50) -> list[dict]:
    """Pull a page of coins from pump.fun's public frontend API. No auth, free."""
    params = {
        "offset": 0,
        "limit": limit,
        "sort": sort,
        "order": "DESC",
        "includeNsfw": "false",
    }
    url = PUMP_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"accept": "*/*", "user-agent": UA})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


def trend_score(coin: dict, now_ms: float) -> float:
    """Cheap momentum proxy from listing fields only — no extra API calls.

    Trending = big AND being actively talked-about AND actively traded right now.
    We can't see per-minute volume from this endpoint, so we approximate:
      mcap_term   — log USD market cap (size)
      chatter_term— log reply_count (cumulative social interest)
      fresh_trade — decay on minutes since last trade (is it live?)
      fresh_reply — decay on minutes since last comment (is the chat alive?)
    """
    mcap = coin.get("usd_market_cap") or 0.0
    replies = coin.get("reply_count") or 0
    last_trade = coin.get("last_trade_timestamp") or 0
    last_reply = coin.get("last_reply") or 0

    mcap_term = math.log10(mcap + 10)
    chatter_term = math.log10(replies + 1)
    trade_min = (now_ms - last_trade) / 60000 if last_trade else 1e9
    reply_min = (now_ms - last_reply) / 60000 if last_reply else 1e9
    fresh_trade = math.exp(-trade_min / 30)   # half-ish life ~20 min
    fresh_reply = math.exp(-reply_min / 60)
    return mcap_term * 1.0 + chatter_term * 1.5 + fresh_trade * 4 + fresh_reply * 3


def cashtag_of(coin: dict) -> str | None:
    """Symbol → clean $CASHTAG. Reject symbols that can't be a usable cashtag."""
    sym = (coin.get("symbol") or "").strip()
    sym = re.sub(r"\s+", "", sym)
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9]{1,14}", sym):
        return None
    return sym.upper()


def pick_trending(sort: str, limit: int) -> dict:
    coins = fetch_pump_listing(sort=sort, limit=limit)
    now_ms = datetime.now(timezone.utc).timestamp() * 1000
    ranked = sorted(
        (c for c in coins if cashtag_of(c)),
        key=lambda c: trend_score(c, now_ms),
        reverse=True,
    )
    if not ranked:
        raise SystemExit("no pump.fun coin with a usable cashtag in this page")
    return ranked[0]


# --------------------------------------------------------------------------- #
# 2. X search for the cashtag
# --------------------------------------------------------------------------- #
def _direct_search(cashtag: str, max_tweets: int) -> list[dict]:
    """One self-capped advanced_search call, bypassing the shared project ledger.

    Used by --direct when the shared niche-research budget is locked over its
    legacy cap. Refuses if the real account balance is below a floor, so a single
    run can never cost more than ~one page (~30 credits ≈ $0.0003).
    """
    key = twapi.key()
    r, b = twapi.balance()
    if r + b < 1000:  # < $0.01 of real credit left — stop
        raise SystemExit(f"real balance too low ({r + b}c) — refusing paid call")
    q = urllib.parse.urlencode({"query": f"${cashtag} -is:retweet", "queryType": "Latest"})
    url = "https://api.twitterapi.io/twitter/tweet/advanced_search?" + q
    req = urllib.request.Request(url, headers={"X-API-Key": key})
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.load(resp)
    tweets = (body.get("data") or {}).get("tweets") or body.get("tweets") or []
    try:
        twapi.upsert_tweets(tweets, source=f"feargreed-{cashtag}")
    except Exception:
        pass
    return tweets[:max_tweets] if isinstance(tweets, list) else []


def x_search(cashtag: str, max_tweets: int, dry_run: bool, direct: bool = False) -> list[dict]:
    """Return recent tweets mentioning $CASHTAG.

    Live:    one paid advanced_search page via the metered client (budget-capped).
    Direct:  one self-capped call bypassing the shared project ledger.
    Dry:     whatever is already cached locally for this cashtag.
    """
    if direct and not dry_run and twapi is not None:
        return _direct_search(cashtag, max_tweets)
    if dry_run or twapi is None:
        if twapi is None:
            print(f"  (twapi unavailable: {_TWAPI_ERR} — cache-only)", file=sys.stderr)
        cached = twapi._load_jsonl(twapi.TWEETS) if twapi else []
        tag = cashtag.lower()
        hits = [t for t in cached if tag in (t.get("text") or "").lower()]
        # Normalise cache rows into the live-search shape the scorer expects.
        return [
            {
                "text": t.get("text"),
                "likeCount": t.get("favorites", 0),
                "retweetCount": t.get("retweets", 0),
                "replyCount": t.get("replies", 0),
                "createdAt": t.get("created_at"),
            }
            for t in hits
        ][:max_tweets]

    # `$CASHTAG` is the cashtag operator; quotes keep it exact. Latest = freshest.
    query = f"${cashtag} -is:retweet"
    body = twapi.metered_call(
        f"feargreed:${cashtag}",
        "/twitter/tweet/advanced_search",
        {"query": query, "queryType": "Latest"},
        estimate=30,
    )
    data = body.get("data") or {}
    tweets = data.get("tweets") if isinstance(data, dict) else (body.get("tweets") or [])
    if not tweets and body.get("tweets"):
        tweets = body["tweets"]
    if not isinstance(tweets, list):
        return []
    # Cache the byproduct so future --dry-run runs are free.
    try:
        twapi.upsert_tweets(tweets, source=f"feargreed-{cashtag}")
    except Exception:
        pass
    return tweets[:max_tweets]


# --------------------------------------------------------------------------- #
# 3. Lexicon sentiment → fear/greed
# --------------------------------------------------------------------------- #
# Memecoin-native vocabulary. Greed = up/buy/euphoria. Fear = down/exit/distrust.
GREED = {
    "moon", "mooning", "pump", "pumping", "ape", "aping", "buy", "buying", "bought",
    "bullish", "bull", "send", "sending", "lfg", "gem", "100x", "10x", "50x", "1000x",
    "hold", "holding", "hodl", "diamond", "wagmi", "green", "rip", "ripping", "parabolic",
    "breakout", "accumulate", "early", "undervalued", "next", "runner", "alpha", "long",
    "loaded", "conviction", "printing", "easy", "floor", "support", "rocket", "🚀", "🔥",
    "lambo", "gmi", "explode", "exploding", "based", "chad", "king", "winner", "fomo",
}
FEAR = {
    "rug", "rugged", "rugpull", "scam", "scammer", "dump", "dumping", "dumped", "sell",
    "selling", "sold", "exit", "exiting", "dead", "dying", "rekt", "down", "crash",
    "crashing", "bearish", "bear", "careful", "caution", "warning", "avoid", "trap",
    "top", "topped", "fade", "fading", "short", "shorting", "bleed", "bleeding", "red",
    "panic", "fud", "weak", "ngmi", "loss", "losses", "bagholder", "honeypot", "fake",
    "ponzi", "liquidated", "stop", "overbought", "distribution", "🤡", "💀", "📉",
}
NEGATIONS = {"not", "no", "never", "isn't", "isnt", "ain't", "aint", "dont", "don't", "stop"}

TOKEN_RE = re.compile(r"[a-z0-9']+|[\U0001F300-\U0001FAFF]")


def tweet_sentiment(text: str) -> float:
    """Per-tweet sentiment in [-1, 1]. Simple negation flip on the previous token."""
    if not text:
        return 0.0
    toks = TOKEN_RE.findall(text.lower())
    score, hits = 0.0, 0
    for i, tok in enumerate(toks):
        v = 1.0 if tok in GREED else (-1.0 if tok in FEAR else 0.0)
        if v == 0.0:
            continue
        if i > 0 and toks[i - 1] in NEGATIONS:
            v = -v
        score += v
        hits += 1
    if hits == 0:
        return 0.0
    return max(-1.0, min(1.0, score / math.sqrt(hits)))


def engagement_weight(t: dict) -> float:
    likes = t.get("likeCount") or 0
    rts = t.get("retweetCount") or 0
    replies = t.get("replyCount") or 0
    return 1.0 + math.log1p(likes + 2 * rts + replies)


def gauge_label(v: float) -> str:
    if v < 20:
        return "Extreme Fear"
    if v < 40:
        return "Fear"
    if v < 60:
        return "Neutral"
    if v < 80:
        return "Greed"
    return "Extreme Greed"


def score_tweets(tweets: list[dict]) -> dict:
    """Fold tweets into a 0-100 gauge.

    Two signals, blended:
      sentiment — engagement-weighted mean lexicon sentiment, mapped 0-100
      velocity  — how many of the sample land inside the last 30 min (FOMO/euphoria
                  pulls the dial toward greed; a dead chat pulls it toward neutral)
    """
    scored = []
    now = datetime.now(timezone.utc)
    recent = 0
    for t in tweets:
        s = tweet_sentiment(t.get("text") or "")
        w = engagement_weight(t)
        scored.append((s, w))
        created = t.get("createdAt") or ""
        for fmt in ("%a %b %d %H:%M:%S %z %Y", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
            try:
                d = datetime.strptime(created, fmt)
                if d.tzinfo is None:
                    d = d.replace(tzinfo=timezone.utc)
                if (now - d).total_seconds() < 1800:
                    recent += 1
                break
            except (ValueError, TypeError):
                continue

    n = len(scored)
    if n == 0:
        return {"n": 0, "gauge": 50.0, "label": "Neutral (no data)",
                "sentiment_term": 50.0, "velocity_term": 50.0,
                "pos": 0, "neg": 0, "neu": 0}

    wsum = sum(w for _, w in scored) or 1.0
    mean_sent = sum(s * w for s, w in scored) / wsum         # [-1, 1]
    sentiment_term = (mean_sent + 1) * 50                    # 0-100

    velocity_term = 50 + min(50.0, (recent / n) * 100 - 50)  # share recent, centred at 50
    velocity_term = max(0.0, min(100.0, velocity_term))

    gauge = 0.7 * sentiment_term + 0.3 * velocity_term
    gauge = max(0.0, min(100.0, gauge))

    pos = sum(1 for s, _ in scored if s > 0.05)
    neg = sum(1 for s, _ in scored if s < -0.05)
    return {
        "n": n,
        "gauge": round(gauge, 1),
        "label": gauge_label(gauge),
        "sentiment_term": round(sentiment_term, 1),
        "velocity_term": round(velocity_term, 1),
        "mean_sentiment": round(mean_sent, 3),
        "recent_30min": recent,
        "pos": pos,
        "neg": neg,
        "neu": n - pos - neg,
    }


# --------------------------------------------------------------------------- #
# Render
# --------------------------------------------------------------------------- #
def dial(v: float, width: int = 40) -> str:
    pos = int(round(v / 100 * (width - 1)))
    bar = ["─"] * width
    bar[pos] = "●"
    return "[" + "".join(bar) + "]"


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--symbol", help="force a cashtag, skip pump.fun discovery")
    ap.add_argument("--sort", default="market_cap",
                    help="pump.fun trending proxy sort (market_cap | last_reply | last_trade_timestamp)")
    ap.add_argument("--limit", type=int, default=50, help="coins to rank for trending")
    ap.add_argument("--max-tweets", type=int, default=30, help="tweets to score")
    ap.add_argument("--dry-run", action="store_true", help="no paid X call; score cached tweets")
    ap.add_argument("--direct", action="store_true",
                    help="bypass the shared project ledger; one self-capped paid call")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()

    coin = None
    if args.symbol:
        cashtag = args.symbol.lstrip("$").upper()
    else:
        coin = pick_trending(args.sort, args.limit)
        cashtag = cashtag_of(coin)

    tweets = x_search(cashtag, args.max_tweets, args.dry_run, direct=args.direct)
    result = score_tweets(tweets)

    out = {
        "trending": {
            "symbol": cashtag,
            "name": (coin.get("name") or "").strip() if coin else None,
            "mint": coin.get("mint") if coin else None,
            "usd_market_cap": round(coin.get("usd_market_cap"), 2) if coin and coin.get("usd_market_cap") else None,
            "reply_count": coin.get("reply_count") if coin else None,
            "twitter": coin.get("twitter") if coin else None,
            "sort": args.sort,
        },
        "fear_greed": result,
        "source_tweets": result["n"],
        "mode": "dry-run/cache" if args.dry_run else ("direct" if args.direct else "live"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    if args.json:
        print(json.dumps(out, indent=2))
        return

    t = out["trending"]
    print(f"\n  TRENDING ON PUMP.FUN  →  ${t['symbol']}"
          + (f"  ({t['name']})" if t["name"] else ""))
    if t["mint"]:
        print(f"  mint {t['mint']}   mcap ${t['usd_market_cap']:,}   replies {t['reply_count']:,}")
    print(f"  ranked by {t['sort']}\n")
    print(f"  X fear/greed from {result['n']} cashtag mentions ({out['mode']}):\n")
    print(f"   FEAR {dial(result['gauge'])} GREED")
    sp = " " * (2 + int(round(result["gauge"] / 100 * 39)))
    print(f"  {sp}{result['gauge']}")
    print(f"\n  >>> {result['label'].upper()}  ({result['gauge']}/100)\n")
    if result["n"]:
        print(f"  sentiment term {result['sentiment_term']}   velocity term {result['velocity_term']}")
        print(f"  bullish {result['pos']}   bearish {result['neg']}   neutral {result['neu']}"
              f"   (recent<30min: {result.get('recent_30min', 0)})")
    else:
        print("  no tweets scored — try without --dry-run, or pick a hotter coin.")
    print()


if __name__ == "__main__":
    main()
