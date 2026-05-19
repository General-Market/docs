#!/usr/bin/env python3
"""TwitterAPI.io wrapper with per-call balance accounting.

100,000 credits = $1.00. Default hard cap: $1 (100,000 credits).

Each call records: timestamp, endpoint, params, credits_before, credits_after,
delta, http_status, result_count. Ledger written to docs/x-targeting/cache/twapi-ledger.jsonl.

Usage:
  twapi.py balance
  twapi.py userinfo HANDLE
  twapi.py lasttweets HANDLE [--count N]
  twapi.py followings HANDLE [--max N]
  twapi.py advsearch QUERY [--max N]
  twapi.py spent
"""
from __future__ import annotations
import json
import os
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone
from pathlib import Path


BASE = "https://api.twitterapi.io"
KEY_FILE = Path("/tmp/.twapi_key")
ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
CACHE = ROOT / "cache"
LEDGER = CACHE / "twapi-ledger.jsonl"
PROFILES = CACHE / "profiles.jsonl"
TWEETS = CACHE / "tweets.jsonl"
HARD_CAP_USD = 1.00  # set by user — never spend more in one session
CREDITS_PER_USD = 100_000


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def key():
    return KEY_FILE.read_text().strip()


def _get(path: str, params: dict | None = None):
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"X-API-Key": key()})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e) if e.fp else {"error": e.reason}


def balance() -> tuple[int, int]:
    """Returns (recharge_credits, bonus_credits)."""
    _, body = _get("/oapi/my/info")
    return body.get("recharge_credits", 0), body.get("total_bonus_credits", 0)


def total_credits() -> int:
    r, b = balance()
    return r + b


def append_ledger(row: dict) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def session_spent_credits() -> int:
    """Sum delta of every ledger row in this session (or all-time if no session file)."""
    if not LEDGER.exists():
        return 0
    total = 0
    for line in LEDGER.read_text().splitlines():
        if not line.strip():
            continue
        try:
            total += json.loads(line).get("delta_credits", 0)
        except Exception:
            continue
    return total


def check_budget(estimate_credits: int = 0) -> None:
    spent = session_spent_credits()
    cap_credits = int(HARD_CAP_USD * CREDITS_PER_USD)
    if spent + estimate_credits > cap_credits:
        print(f"BUDGET BREACH: spent={spent}, would-add={estimate_credits}, cap={cap_credits} (${HARD_CAP_USD})",
              file=sys.stderr)
        sys.exit(2)


def metered_call(label: str, path: str, params: dict | None,
                 estimate: int = 0, on_data=None) -> dict:
    """Wraps any GET with before/after balance + ledger entry."""
    check_budget(estimate)
    before = total_credits()
    print(f"  ↳ {label}  bal_before={before}  est={estimate}c", file=sys.stderr)
    status, body = _get(path, params)
    after = total_credits()
    delta = before - after
    count = 0
    if isinstance(body, dict):
        data = body.get("data")
        if isinstance(data, list):
            count = len(data)
        elif isinstance(data, dict):
            count = 1
            # Some endpoints nest list under data.tweets / data.followings
            for k in ("tweets", "followings", "followers", "users"):
                if isinstance(data.get(k), list):
                    count = len(data[k])
                    break
    row = {
        "ts": now_iso(),
        "label": label,
        "path": path,
        "params": params or {},
        "status": status,
        "credits_before": before,
        "credits_after": after,
        "delta_credits": delta,
        "delta_usd": round(delta / CREDITS_PER_USD, 4),
        "count": count,
    }
    append_ledger(row)
    print(f"  ↳ {label}  bal_after={after}  spent={delta}c (${row['delta_usd']})  count={count}",
          file=sys.stderr)
    if on_data and isinstance(body, dict):
        on_data(body)
    return body


# -- profile/tweet cache writes ----------------------------------------------

def _load_jsonl(p: Path) -> list[dict]:
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]


def _write_jsonl(p: Path, rows: list[dict]) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def upsert_profile(twapi_user: dict) -> None:
    """Merge a TwitterAPI.io profile into cache/profiles.jsonl."""
    sn = twapi_user.get("userName")
    if not sn:
        return
    # Normalize to the same shape as Apify api-ninja's user_info
    created_iso = twapi_user.get("createdAt", "")
    try:
        # TwAPI returns ISO; Apify returns "Mon Jan 13 20:25:36 +0000 2020". Keep both.
        t = datetime.fromisoformat(created_iso.replace("Z", "+00:00"))
        created_apify = t.strftime("%a %b %d %H:%M:%S +0000 %Y")
    except Exception:
        created_apify = created_iso
    new = {
        "screen_name": sn,
        "name": twapi_user.get("name"),
        "rest_id": twapi_user.get("id"),
        "description": twapi_user.get("description"),
        "url": twapi_user.get("url"),
        "location": twapi_user.get("location"),
        "verified": twapi_user.get("isBlueVerified") or twapi_user.get("isVerified"),
        "verified_type": twapi_user.get("verifiedType"),
        "followers_count": twapi_user.get("followers"),
        "friends_count": twapi_user.get("following"),
        "favourites_count": twapi_user.get("favouritesCount"),
        "statuses_count": twapi_user.get("statusesCount"),  # api-ninja stripped this
        "media_count": twapi_user.get("mediaCount"),
        "pinned_tweet_ids": twapi_user.get("pinnedTweetIds"),
        "created_at": created_apify,
        "created_iso": created_iso,
        "can_dm": twapi_user.get("canDm"),
    }
    rows = _load_jsonl(PROFILES)
    found = False
    for i, r in enumerate(rows):
        if (r.get("screen_name") or "").lower() == sn.lower():
            r.update(new)
            r["last_seen"] = now_iso()
            sources = r.setdefault("sources", [])
            if "twapi" not in sources:
                sources.append("twapi")
            rows[i] = r
            found = True
            break
    if not found:
        new["first_seen"] = now_iso()
        new["last_seen"] = now_iso()
        new["sources"] = ["twapi"]
        rows.append(new)
    _write_jsonl(PROFILES, rows)


def upsert_tweets(tweets: list[dict], source: str = "twapi") -> int:
    """Append/update tweets in cache/tweets.jsonl, dedup by tweet_id."""
    by_id = {r.get("tweet_id"): r for r in _load_jsonl(TWEETS) if r.get("tweet_id")}
    n_new = 0
    for t in tweets:
        tid = str(t.get("id"))
        if not tid:
            continue
        author = (t.get("author") or {}).get("userName") or t.get("authorName")
        # Persist author's profile too if attached
        if t.get("author") and t["author"].get("userName"):
            upsert_profile(t["author"])
        row = {
            "tweet_id": tid,
            "screen_name": author,
            "type": "tweet",
            "text": t.get("text"),
            "created_at": t.get("createdAt"),
            "favorites": t.get("likeCount", 0),
            "retweets": t.get("retweetCount", 0),
            "replies": t.get("replyCount", 0),
            "quotes": t.get("quoteCount", 0),
            "views": t.get("viewCount"),
            "lang": t.get("lang"),
            "url": t.get("url"),
            "in_reply_to_screen_name": t.get("inReplyToUserName"),
            "source_run": source,
            "cached_at": now_iso(),
        }
        if tid not in by_id:
            n_new += 1
        by_id[tid] = row
    _write_jsonl(TWEETS, list(by_id.values()))
    return n_new


# -- commands ---------------------------------------------------------------

def cmd_balance():
    r, b = balance()
    spent = session_spent_credits()
    print(json.dumps({
        "recharge_credits": r,
        "bonus_credits": b,
        "total": r + b,
        "usd": round((r + b) / CREDITS_PER_USD, 4),
        "session_spent_credits": spent,
        "session_spent_usd": round(spent / CREDITS_PER_USD, 4),
        "cap_usd": HARD_CAP_USD,
    }, indent=2))


def cmd_userinfo(handle: str):
    body = metered_call(
        f"userinfo:{handle}", "/twitter/user/info",
        {"userName": handle.lstrip("@")},
        estimate=18,  # ~$0.00018 per profile = 18 credits
    )
    if body.get("status") == "success" and body.get("data"):
        upsert_profile(body["data"])
        u = body["data"]
        print(json.dumps({
            "handle": u.get("userName"),
            "followers": u.get("followers"),
            "following": u.get("following"),
            "statuses": u.get("statusesCount"),
            "media": u.get("mediaCount"),
            "verified_blue": u.get("isBlueVerified"),
            "createdAt": u.get("createdAt"),
            "pinned": u.get("pinnedTweetIds"),
            "bio": (u.get("description") or "")[:140],
        }, indent=2))
    else:
        print(json.dumps(body, indent=2))


def cmd_lasttweets(handle: str, count: int = 10):
    body = metered_call(
        f"lasttweets:{handle}", "/twitter/user/last_tweets",
        {"userName": handle.lstrip("@")},
        estimate=15 * min(count, 20),  # ~$0.00015 per tweet = 15c
    )
    if body.get("status") == "success":
        data = body.get("data", {})
        tweets = data.get("tweets") if isinstance(data, dict) else (data or [])
        if isinstance(tweets, list):
            n_new = upsert_tweets(tweets, source=f"twapi-lasttweets-{handle}")
            print(f"got {len(tweets)} tweets, {n_new} new to cache")
            # Show summary: dates + engagement
            for t in tweets[:10]:
                print(f"  {t.get('createdAt', '?')[:10]}  ♥{t.get('likeCount',0)} ↻{t.get('retweetCount',0)} 💬{t.get('replyCount',0)}  {(t.get('text') or '')[:100]}")
        else:
            print(json.dumps(body, indent=2))
    else:
        print(json.dumps(body, indent=2))


def cmd_followers(handle: str, max_results: int = 200):
    """Get followers of HANDLE — auto-upserts profiles, returns local count."""
    fetched = []
    cursor = ""
    page = 0
    while len(fetched) < max_results:
        params = {"userName": handle.lstrip("@")}
        if cursor:
            params["cursor"] = cursor
        body = metered_call(
            f"followers:{handle}:p{page}", "/twitter/user/followers",
            params, estimate=200 * 15,
        )
        page += 1
        # This endpoint returns {"followers": [...]} directly, not under data
        batch = body.get("followers", []) if isinstance(body, dict) else []
        if not batch:
            print("  (no more)", file=sys.stderr)
            break
        for u in batch:
            # Normalize to twapi shape used by upsert_profile
            normalized = {
                "id": u.get("id"),
                "userName": u.get("userName") or u.get("screen_name"),
                "name": u.get("name"),
                "description": u.get("description"),
                "url": u.get("url"),
                "location": u.get("location"),
                "isVerified": u.get("verified"),
                "isBlueVerified": u.get("is_blue_verified") or u.get("isBlueVerified"),
                "followers": u.get("followers_count"),
                "following": u.get("following_count") or u.get("friends_count"),
                "favouritesCount": u.get("favourites_count"),
                "statusesCount": u.get("statuses_count"),
                "mediaCount": u.get("media_tweets_count"),
                "createdAt": u.get("created_at"),
            }
            upsert_profile(normalized)
        fetched.extend(batch)
        cursor = body.get("next_cursor") or ""
        if not cursor or not body.get("has_next_page"):
            break
    print(f"got {len(fetched)} followers of @{handle}")
    return fetched


def cmd_followings(handle: str, max_results: int = 200):
    """Get the accounts that HANDLE follows. Paginated."""
    fetched = []
    cursor = ""
    page = 0
    while len(fetched) < max_results:
        params = {"userName": handle.lstrip("@"), "pageSize": 200}
        if cursor:
            params["cursor"] = cursor
        body = metered_call(
            f"followings:{handle}:p{page}", "/twitter/user/followings",
            params, estimate=200 * 15,  # rough — followers/following at $0.01-0.15/1k tiered
        )
        page += 1
        if body.get("status") != "success":
            print(json.dumps(body, indent=2))
            break
        data = body.get("data") or {}
        batch = data.get("followings", []) if isinstance(data, dict) else []
        if not batch:
            print("  (no more)")
            break
        for u in batch:
            upsert_profile(u)
        fetched.extend(batch)
        cursor = body.get("next_cursor") or data.get("next_cursor") or ""
        if not cursor or not data.get("has_next_page", True):
            break
        if session_spent_credits() > HARD_CAP_USD * CREDITS_PER_USD * 0.8:
            print(f"  (approaching cap, stop at {len(fetched)})", file=sys.stderr)
            break
    print(f"got {len(fetched)} followings of @{handle}")
    for u in fetched[:25]:
        print(f"  {u.get('followers') or 0}\t@{u.get('userName')}\t{(u.get('description') or '')[:80]}")
    if len(fetched) > 25:
        print(f"  … ({len(fetched) - 25} more in cache)")


def cmd_probe(handle: str, days: int = 14):
    """Cheap activity probe — use advanced_search to ask: did this handle post in last N days?

    Cost: 0 credits if inactive, ~15-30 credits if active (returns up to 20 matching tweets).
    Compare with lasttweets cost: ~150 credits per call regardless of activity.
    """
    from datetime import datetime, timezone, timedelta
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    query = f"from:{handle.lstrip('@')} since:{since}"
    body = metered_call(
        f"probe:{handle}:{days}d", "/twitter/tweet/advanced_search",
        {"query": query, "queryType": "Latest"},
        estimate=30,
    )
    if body.get("status") != "success":
        print(json.dumps(body, indent=2)); return
    data = body.get("data") or {}
    tweets = data.get("tweets", []) if isinstance(data, dict) else []
    active = len(tweets) > 0
    if active:
        # Cache the tweets we got for free as a byproduct
        n_new = upsert_tweets(tweets, source=f"twapi-probe-{handle}")
        latest = tweets[0]
        print(json.dumps({
            "handle": handle,
            "active_last_{}d".format(days): True,
            "tweets_returned": len(tweets),
            "new_to_cache": n_new,
            "latest_created": latest.get("createdAt"),
            "latest_text": (latest.get("text") or "")[:120],
        }, indent=2))
    else:
        print(json.dumps({
            "handle": handle,
            "active_last_{}d".format(days): False,
            "verdict": "INACTIVE — skip further fetches",
        }, indent=2))


def cmd_advsearch(query: str, max_results: int = 20):
    body = metered_call(
        f"advsearch:{query[:30]}", "/twitter/tweet/advanced_search",
        {"query": query, "queryType": "Latest"},
        estimate=15 * 20,
    )
    if body.get("status") == "success":
        data = body.get("data") or {}
        tweets = data.get("tweets", []) if isinstance(data, dict) else []
        n_new = upsert_tweets(tweets, source="twapi-advsearch")
        print(f"got {len(tweets)} tweets, {n_new} new")
        for t in tweets[:10]:
            a = (t.get("author") or {}).get("userName")
            print(f"  @{a}\t♥{t.get('likeCount',0)}  {(t.get('text') or '')[:120]}")
    else:
        print(json.dumps(body, indent=2))


def cmd_spent():
    spent = session_spent_credits()
    rows = _load_jsonl(LEDGER)
    print(f"total calls: {len(rows)}")
    print(f"total credits: {spent}")
    print(f"total USD: ${spent / CREDITS_PER_USD:.4f}")
    print(f"cap USD: ${HARD_CAP_USD}")
    print("\nby label:")
    by_label = {}
    for r in rows:
        by_label.setdefault(r["label"], 0)
        by_label[r["label"]] += r.get("delta_credits", 0)
    for label, c in sorted(by_label.items(), key=lambda x: -x[1]):
        print(f"  {c:>6} c  (${c/CREDITS_PER_USD:.4f})  {label}")


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "balance":
        cmd_balance()
    elif cmd == "userinfo":
        cmd_userinfo(sys.argv[2])
    elif cmd == "lasttweets":
        n = 10
        if "--count" in sys.argv:
            n = int(sys.argv[sys.argv.index("--count") + 1])
        cmd_lasttweets(sys.argv[2], n)
    elif cmd == "followings":
        m = 200
        if "--max" in sys.argv:
            m = int(sys.argv[sys.argv.index("--max") + 1])
        cmd_followings(sys.argv[2], m)
    elif cmd == "followers":
        m = 200
        if "--max" in sys.argv:
            m = int(sys.argv[sys.argv.index("--max") + 1])
        cmd_followers(sys.argv[2], m)
    elif cmd == "advsearch":
        m = 20
        if "--max" in sys.argv:
            m = int(sys.argv[sys.argv.index("--max") + 1])
        cmd_advsearch(sys.argv[2], m)
    elif cmd == "spent":
        cmd_spent()
    else:
        print(__doc__); sys.exit(1)


if __name__ == "__main__":
    main()
