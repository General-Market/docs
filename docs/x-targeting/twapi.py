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
import fcntl
import os
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


BASE = "https://api.twitterapi.io"
KEY_FILE = Path("/tmp/.twapi_key")
ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
CACHE = ROOT / "cache"
LEDGER = CACHE / "twapi-ledger.jsonl"
BUDGET_FILE = ROOT / "niches" / "budget.json"
PROFILES = CACHE / "profiles.jsonl"
TWEETS = CACHE / "tweets.jsonl"
HARD_CAP_USD = 1.00  # set by user — never spend more in one session
CREDITS_PER_USD = 100_000
LOCK_FILE = CACHE / ".cache.lock"


@contextmanager
def cache_lock():
    """Exclusive lock for shared JSONL cache read-modify-write operations."""
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOCK_FILE.open("w") as lf:
        fcntl.flock(lf, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def key():
    return KEY_FILE.read_text().strip()


def _get(path: str, params: dict | None = None, timeout: int = 30):
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"X-API-Key": key()})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e) if e.fp else {"error": e.reason}
    except (TimeoutError, OSError) as e:
        return 408, {"error": f"timeout/network: {e}"}


def balance() -> tuple[int, int]:
    """Returns (recharge_credits, bonus_credits)."""
    _, body = _get("/oapi/my/info")
    return body.get("recharge_credits", 0), body.get("total_bonus_credits", 0)


def total_credits() -> int:
    r, b = balance()
    return r + b


def append_ledger(row: dict) -> None:
    with cache_lock():
        LEDGER.parent.mkdir(parents=True, exist_ok=True)
        with LEDGER.open("a") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


SESSION_START_FILE = CACHE / ".session_start_balance"


def session_spent_credits() -> int:
    """Compute spend as (start_balance - current_balance). The per-call delta in the
    ledger is unreliable because TwitterAPI.io's /oapi/my/info endpoint lags — many
    calls show delta=0 when they actually cost credits. Absolute balance delta is the
    truth.
    """
    if not SESSION_START_FILE.exists():
        # First call this session — record the current balance as the baseline.
        try:
            r, b = balance()
            SESSION_START_FILE.write_text(str(r + b))
            return 0
        except Exception:
            return 0
    try:
        start = int(SESSION_START_FILE.read_text().strip())
        r, b = balance()
        return max(0, start - (r + b))
    except Exception:
        return 0


def project_spent_credits() -> int:
    """Project spend = spent_locked + (baseline - current balance)."""
    b = json.loads(BUDGET_FILE.read_text())
    r, bo = balance()
    return b.get("spent_locked_credits", 0) + max(0, b["baseline_credits"] - (r + bo))


def check_budget(estimate_credits: int = 0) -> None:
    if BUDGET_FILE.exists():
        b = json.loads(BUDGET_FILE.read_text())
        cap_credits = int(b["cap_usd"] * CREDITS_PER_USD)
        spent = project_spent_credits()
        if spent + estimate_credits > cap_credits:
            print(f"BUDGET BREACH: project spent={spent}c (${spent/CREDITS_PER_USD:.2f}), "
                  f"would-add={estimate_credits}c, cap=${b['cap_usd']}", file=sys.stderr)
            sys.exit(2)
        return
    spent = session_spent_credits()
    cap_credits = int(HARD_CAP_USD * CREDITS_PER_USD)
    if spent + estimate_credits > cap_credits:
        print(f"BUDGET BREACH: spent={spent}, would-add={estimate_credits}, cap={cap_credits} (${HARD_CAP_USD})",
              file=sys.stderr)
        sys.exit(2)


def cmd_rebase():
    """After a credit top-up: fold spend-so-far into spent_locked and reset baseline."""
    b = json.loads(BUDGET_FILE.read_text())
    r, bo = balance()
    current = r + bo
    b["spent_locked_credits"] = b.get("spent_locked_credits", 0) + max(0, b["baseline_credits"] - current)
    b["baseline_credits"] = current
    BUDGET_FILE.write_text(json.dumps(b, indent=2))
    print(json.dumps({"rebased": True, **b}, indent=2))


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
    return [json.loads(l) for l in p.read_text().split("\n") if l.strip()]


def _write_jsonl(p: Path, rows: list[dict]) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def _upsert_profile_unlocked(twapi_user: dict, followed_by: str | None = None) -> None:
    """Merge a TwitterAPI.io profile into cache/profiles.jsonl.

    If followed_by is set, record that the named account follows this profile.
    Stored as a set in the profile under 'followed_by' so we know the graph edges
    without needing to refetch.
    """
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
            # Merge: only overwrite a field if the new value is non-empty.
            # The followers endpoint returns thin author objects with empty bios,
            # which used to clobber rich data from userinfo.
            for k, v in new.items():
                if v not in (None, "", [], {}):
                    r[k] = v
            r["last_seen"] = now_iso()
            sources = r.setdefault("sources", [])
            if "twapi" not in sources:
                sources.append("twapi")
            if followed_by:
                fb = set(r.get("followed_by", []))
                fb.add(followed_by)
                r["followed_by"] = sorted(fb)
            rows[i] = r
            found = True
            break
    if not found:
        new["first_seen"] = now_iso()
        new["last_seen"] = now_iso()
        new["sources"] = ["twapi"]
        if followed_by:
            new["followed_by"] = [followed_by]
        rows.append(new)
    _write_jsonl(PROFILES, rows)


def upsert_profile(twapi_user: dict, followed_by: str | None = None) -> None:
    with cache_lock():
        _upsert_profile_unlocked(twapi_user, followed_by)


def _upsert_tweets_unlocked(tweets: list[dict], source: str = "twapi", cell: str | None = None) -> int:
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
            _upsert_profile_unlocked(t["author"])
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
            "cell": cell,
            "cached_at": now_iso(),
        }
        if tid not in by_id:
            n_new += 1
        by_id[tid] = row
    _write_jsonl(TWEETS, list(by_id.values()))
    return n_new


def upsert_tweets(tweets: list[dict], source: str = "twapi", cell: str | None = None) -> int:
    with cache_lock():
        return _upsert_tweets_unlocked(tweets, source, cell)


# -- commands ---------------------------------------------------------------

def cmd_balance():
    r, b = balance()
    spent = session_spent_credits()
    out = {
        "recharge_credits": r,
        "bonus_credits": b,
        "total": r + b,
        "usd": round((r + b) / CREDITS_PER_USD, 4),
        "session_spent_credits": spent,
        "session_spent_usd": round(spent / CREDITS_PER_USD, 4),
        "cap_usd": HARD_CAP_USD,
    }
    if BUDGET_FILE.exists():
        spent_p = project_spent_credits()
        cap = json.loads(BUDGET_FILE.read_text())["cap_usd"]
        out["project_spent_usd"] = round(spent_p / CREDITS_PER_USD, 4)
        out["project_cap_usd"] = cap
    print(json.dumps(out, indent=2))


PROFILE_TTL_DAYS = 14
TWEET_TTL_DAYS = 7


def _cached_profile_fresh(handle: str) -> dict | None:
    """If profile is cached fresh (<14d), return it. Else None."""
    handle_l = handle.lstrip("@").lower()
    rows = _load_jsonl(PROFILES)
    for r in rows:
        if (r.get("screen_name") or "").lower() != handle_l:
            continue
        # Need statusesCount populated AND last_seen recent
        if r.get("statuses_count") in (None, 0):
            return None
        try:
            t = datetime.fromisoformat(r.get("last_seen", ""))
            age = (datetime.now(timezone.utc) - t).days
            if age <= PROFILE_TTL_DAYS:
                return r
        except Exception:
            continue
    return None


def _cached_tweets_fresh(handle: str, min_count: int = 5) -> list[dict] | None:
    """If we have >=min_count tweets from twapi-lasttweets source, and latest is <7d, return them.
    Else None."""
    handle_l = handle.lstrip("@").lower()
    mine = [t for t in _load_jsonl(TWEETS)
            if (t.get("screen_name") or "").lower() == handle_l
            and (t.get("source_run") or "").startswith("twapi-lasttweets")]
    if len(mine) < min_count:
        return None
    newest = None
    for t in mine:
        try:
            d = datetime.strptime(t.get("created_at") or "", "%a %b %d %H:%M:%S %z %Y")
            if not newest or d > newest:
                newest = d
        except Exception:
            continue
    if not newest:
        return None
    age = (datetime.now(timezone.utc) - newest).days
    if age <= TWEET_TTL_DAYS:
        return mine
    return None


def cmd_userinfo(handle: str, force: bool = False):
    if not force:
        cached = _cached_profile_fresh(handle)
        if cached:
            age = (datetime.now(timezone.utc) - datetime.fromisoformat(cached["last_seen"])).days
            print(f"  ↳ CACHE HIT userinfo:{handle}  age={age}d (TTL {PROFILE_TTL_DAYS}d)", file=sys.stderr)
            print(json.dumps({
                "handle": cached.get("screen_name"),
                "followers": cached.get("followers_count"),
                "following": cached.get("friends_count"),
                "statuses": cached.get("statuses_count"),
                "verified_blue": cached.get("verified"),
                "bio": (cached.get("description") or "")[:140],
                "cache": "hit",
            }, indent=2))
            return
    body = metered_call(
        f"userinfo:{handle}", "/twitter/user/info",
        {"userName": handle.lstrip("@")},
        estimate=18,
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


def cmd_lasttweets(handle: str, count: int = 10, force: bool = False):
    if not force:
        cached = _cached_tweets_fresh(handle, min_count=5)
        if cached is not None:
            latest = None
            for t in cached:
                try:
                    d = datetime.strptime(t.get("created_at") or "", "%a %b %d %H:%M:%S %z %Y")
                    if not latest or d > latest:
                        latest = d
                except Exception:
                    continue
            age = (datetime.now(timezone.utc) - latest).days if latest else "?"
            print(f"  ↳ CACHE HIT lasttweets:{handle}  {len(cached)} cached, latest {age}d old (TTL {TWEET_TTL_DAYS}d)",
                  file=sys.stderr)
            print(f"got {len(cached)} tweets (cache), 0 new")
            return
    body = metered_call(
        f"lasttweets:{handle}", "/twitter/user/last_tweets",
        {"userName": handle.lstrip("@")},
        estimate=15 * min(count, 20),
    )
    if body.get("status") == "success":
        data = body.get("data", {})
        tweets = data.get("tweets") if isinstance(data, dict) else (data or [])
        if isinstance(tweets, list):
            n_new = upsert_tweets(tweets, source=f"twapi-lasttweets-{handle}")
            print(f"got {len(tweets)} tweets, {n_new} new to cache")
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
    elif cmd == "rebase":
        cmd_rebase()
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
    try:
        main()
    except BrokenPipeError:
        devnull = os.open(os.devnull, os.O_WRONLY)
        os.dup2(devnull, sys.stdout.fileno())
        sys.exit(0)
