#!/usr/bin/env python3
"""One-off: pull @0x_kai11 profile + recent tweets with FULL engagement fields.
Dumps raw JSON to kai_raw.json and prints an engagement table for analysis."""
import json, sys
import twapi

HANDLE = "0x_kai11"

# 1. profile (for follower count + baseline context)
info = twapi.metered_call(
    f"userinfo:{HANDLE}", "/twitter/user/info",
    {"userName": HANDLE}, estimate=20,
)
prof = info.get("data") or info

# 2. last tweets — pull 2 pages (~40 tweets) to establish a real baseline
all_tweets, cursor = [], ""
for page in range(2):
    params = {"userName": HANDLE}
    if cursor:
        params["cursor"] = cursor
    body = twapi.metered_call(
        f"lasttweets:{HANDLE}:p{page}", "/twitter/user/last_tweets",
        params, estimate=15 * 20,
    )
    data = body.get("data", {})
    tweets = data.get("tweets") if isinstance(data, dict) else (data or [])
    if not tweets and body.get("tweets"):
        tweets = body.get("tweets") or []
    if not isinstance(tweets, list) or not tweets:
        break
    all_tweets.extend(tweets)
    cursor = body.get("next_cursor") or (data.get("next_cursor") if isinstance(data, dict) else "") or ""
    if not cursor or not body.get("has_next_page", bool(cursor)):
        break

with open("kai_raw.json", "w") as f:
    json.dump({"profile": prof, "tweets": all_tweets}, f, indent=2, ensure_ascii=False)

print(f"\n=== PROFILE @{HANDLE} ===")
for k in ("userName", "name", "followers", "following", "statusesCount", "isBlueVerified", "createdAt"):
    print(f"  {k}: {prof.get(k)}")
print(f"  description: {(prof.get('description') or '')[:200]}")

print(f"\n=== {len(all_tweets)} TWEETS ===")
print(f"{'date':<11} {'♥like':>7} {'↻rt':>6} {'reply':>6} {'quote':>6} {'view':>9} {'bkmk':>6}  type  text")
for t in all_tweets:
    created = (t.get("createdAt") or "")[:16]
    print(f"{created:<11} {t.get('likeCount',0):>7} {t.get('retweetCount',0):>6} "
          f"{t.get('replyCount',0):>6} {t.get('quoteCount',0):>6} {t.get('viewCount',0):>9} "
          f"{t.get('bookmarkCount',0):>6}  {'RT' if t.get('retweeted_tweet') else ('RE' if t.get('isReply') else '  ')}  "
          f"{(t.get('text') or '').replace(chr(10),' ')[:90]}")
