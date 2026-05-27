#!/usr/bin/env python3
# Find the single most-engaged tweet about a protocol in the last N minutes, so
# the day's reel can be dropped as a quote-tweet of it. Reuses the twitterapi.io
# wrapper at docs/x-targeting/twapi.py for the endpoint and credit accounting.
#
#   python3 pick_tweet.py --name "Ondo Global Markets" --symbol ONDO --out tweet.json
#
# Writes tweet.json. Never fails the pipeline: if the key is missing or no tweet
# falls inside the window, it records that plainly and the clip ships without a
# quote target. The API only filters by date, so we pull the newest page and
# filter to the minute client-side; view counts are unreliable under ~2h, so we
# rank by likes + replies + retweets.

import sys, json, argparse, os
from datetime import datetime, timezone, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent.parent  # video/scripts/winners-daily -> repo root
sys.path.insert(0, str(REPO / "docs" / "x-targeting"))

# Durable key lookup, in order. /tmp is cleared on reboot, which would break the
# daily cron — prefer an env var or ~/.config/twitterapi/key.
KEY_CANDIDATES = [
    os.environ.get("TWAPI_KEY"),
    str(Path.home() / ".config" / "twitterapi" / "key"),
    "/tmp/.twapi_key",
]

def find_key():
    for cand in KEY_CANDIDATES:
        if not cand:
            continue
        if cand == os.environ.get("TWAPI_KEY"):
            return ("env", cand.strip())
        p = Path(cand)
        if p.is_file() and p.read_text().strip():
            return (str(p), p.read_text().strip())
    return (None, None)

def parse_created(s):
    # Twitter format, e.g. "Mon May 18 11:04:16 +0000 2026"
    try:
        return datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y")
    except Exception:
        return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True, help="protocol display name, e.g. 'Ondo Global Markets'")
    ap.add_argument("--symbol", default=None, help="token symbol for a cashtag, e.g. ONDO")
    ap.add_argument("--out", required=True)
    ap.add_argument("--window-min", type=int, default=60)
    args = ap.parse_args()

    out = Path(args.out)
    src, secret = find_key()
    if not secret:
        out.write_text(json.dumps({
            "tweet": None,
            "reason": "no twitterapi.io key found (set $TWAPI_KEY or ~/.config/twitterapi/key)",
            "name": args.name,
        }, indent=2))
        print("no key — skipping tweet search; clip will ship without a quote target", file=sys.stderr)
        return

    # twapi reads the key from a file path; point it at whatever we found.
    import twapi
    if src == "env":
        tmp = Path("/tmp/.twapi_key"); tmp.write_text(secret); twapi.KEY_FILE = tmp
    else:
        twapi.KEY_FILE = Path(src)

    terms = [f'"{args.name}"']
    sym = (args.symbol or "").strip().lstrip("$")
    if sym and sym.isalnum():
        terms.append(f"${sym}")
    since = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    query = f'({" OR ".join(terms)}) since:{since} -filter:retweets lang:en'

    before = twapi.total_credits()
    status, body = twapi._get("/twitter/tweet/advanced_search", {"query": query, "queryType": "Latest"})
    after = twapi.total_credits()
    cost_credits = max(0, before - after)

    tweets = []
    if isinstance(body, dict):
        data = body.get("data") or {}
        if isinstance(data, dict):
            tweets = data.get("tweets", []) or []

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=args.window_min)
    ranked = []
    for t in tweets:
        dt = parse_created(t.get("createdAt", ""))
        if not dt or dt < cutoff:
            continue
        eng = (t.get("likeCount") or 0) + (t.get("replyCount") or 0) + (t.get("retweetCount") or 0)
        ranked.append((eng, t))
    ranked.sort(key=lambda x: x[0], reverse=True)

    result = {
        "query": query,
        "window_min": args.window_min,
        "searched": len(tweets),
        "fresh_in_window": len(ranked),
        "cost_credits": cost_credits,
        "cost_usd": round(cost_credits / twapi.CREDITS_PER_USD, 4),
        "tweet": None,
    }
    if ranked:
        eng, t = ranked[0]
        result["tweet"] = {
            "url": t.get("url"),
            "text": t.get("text"),
            "author": (t.get("author") or {}).get("userName"),
            "likes": t.get("likeCount", 0),
            "replies": t.get("replyCount", 0),
            "retweets": t.get("retweetCount", 0),
            "views": t.get("viewCount"),
            "created_at": t.get("createdAt"),
            "engagement": eng,
        }
    else:
        result["reason"] = f"no tweet about {args.name} in the last {args.window_min} min"

    out.write_text(json.dumps(result, indent=2))
    print(json.dumps({k: result[k] for k in ("query", "searched", "fresh_in_window", "cost_usd")}))
    if result["tweet"]:
        print(f'top: {result["tweet"]["url"]}  (♥{result["tweet"]["likes"]} ↺{result["tweet"]["retweets"]} 💬{result["tweet"]["replies"]})')
    else:
        print(result.get("reason", "no tweet"))

if __name__ == "__main__":
    main()
