#!/usr/bin/env python3
"""Fetch a full account's tweets + replies (and the tweets it answered) to local JSONL.

Built on twapi.py's metered _get / budget accounting. Walks advanced_search
`from:HANDLE` through every cursor, splits originals from replies, then batch-looks-up
the parent tweets each reply answered.

Output (under docs/x-targeting/cache/<handle>/):
  raw.jsonl       every tweet object returned, verbatim, deduped by id
  tweets.jsonl    originals (not replies), normalized
  replies.jsonl   the account's own replies, normalized (carries reply_to_id)
  answered.jsonl  the parent tweets being replied to, normalized
  summary.json    counts + run metadata

Usage:
  fetch_account.py HANDLE [--cap USD] [--no-parents] [--max-pages N]
"""
from __future__ import annotations
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import twapi


def normalize(t: dict) -> dict:
    a = t.get("author") or {}
    return {
        "tweet_id": str(t.get("id")),
        "screen_name": a.get("userName") or t.get("authorName"),
        "author_name": a.get("name"),
        "text": t.get("text"),
        "created_at": t.get("createdAt"),
        "is_reply": bool(t.get("isReply")),
        "reply_to_id": t.get("inReplyToId"),
        "reply_to_user": t.get("inReplyToUserName"),
        "conversation_id": t.get("conversationId"),
        "quoted_id": (t.get("quoted_tweet") or {}).get("id") if t.get("quoted_tweet") else None,
        "favorites": t.get("likeCount", 0),
        "retweets": t.get("retweetCount", 0),
        "replies": t.get("replyCount", 0),
        "quotes": t.get("quoteCount", 0),
        "views": t.get("viewCount"),
        "lang": t.get("lang"),
        "url": t.get("url"),
    }


def write_jsonl(p: Path, rows: list[dict]) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def fetch_all(handle: str, max_pages: int = 2000) -> dict[str, dict]:
    """Walk advanced_search from:HANDLE through all cursors. Returns {id: raw_tweet}."""
    handle = handle.lstrip("@")
    by_id: dict[str, dict] = {}
    cursor = ""
    page = 0
    empty_streak = 0
    no_new_streak = 0
    while page < max_pages:
        params = {"query": f"from:{handle}", "queryType": "Latest"}
        if cursor:
            params["cursor"] = cursor
        body = twapi.metered_call(
            f"acct:{handle}:p{page}", "/twitter/tweet/advanced_search",
            params, estimate=15 * 20,
        )
        tw = body.get("tweets") or []
        before = len(by_id)
        for t in tw:
            tid = str(t.get("id"))
            if tid and tid != "None":
                by_id[tid] = t
        added = len(by_id) - before
        page += 1
        has_next = body.get("has_next_page")
        cursor = body.get("next_cursor") or ""
        print(f"  page {page}: +{added} (total {len(by_id)}) has_next={has_next}", file=sys.stderr)

        # termination guards
        if not tw:
            empty_streak += 1
            if empty_streak >= 3:
                print("  3 empty pages — stopping", file=sys.stderr)
                break
        else:
            empty_streak = 0
        if added == 0 and tw:
            no_new_streak += 1
            if no_new_streak >= 3:
                print("  3 pages with no new ids — stopping", file=sys.stderr)
                break
        else:
            no_new_streak = 0
        if not has_next or not cursor:
            print("  no more pages", file=sys.stderr)
            break
        # budget guard — stop cleanly before the cap aborts us
        if twapi.session_spent_credits() > twapi.HARD_CAP_USD * twapi.CREDITS_PER_USD * 0.9:
            print(f"  approaching cap — stopping at {len(by_id)} tweets", file=sys.stderr)
            break
    return by_id


def fetch_parents(handle: str, parent_ids: list[str]) -> dict[str, dict]:
    """Batch-lookup parent tweets (up to 100 ids/call). Returns {id: raw_tweet}."""
    out: dict[str, dict] = {}
    BATCH = 50  # /twitter/tweets hard limit: max 50 tweet_ids per request
    for i in range(0, len(parent_ids), BATCH):
        if twapi.session_spent_credits() > twapi.HARD_CAP_USD * twapi.CREDITS_PER_USD * 0.95:
            print(f"  cap reached — fetched {len(out)}/{len(parent_ids)} parents", file=sys.stderr)
            break
        chunk = parent_ids[i:i + BATCH]
        body = twapi.metered_call(
            f"parents:{handle}:b{i//BATCH}", "/twitter/tweets",
            {"tweet_ids": ",".join(chunk)}, estimate=15 * len(chunk),
        )
        for t in (body.get("tweets") or []):
            tid = str(t.get("id"))
            if tid and tid != "None":
                out[tid] = t
        print(f"  parents batch {i//BATCH}: {len(out)} total", file=sys.stderr)
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    handle = sys.argv[1].lstrip("@")
    cap = 5.0
    do_parents = "--no-parents" not in sys.argv
    max_pages = 2000
    if "--cap" in sys.argv:
        cap = float(sys.argv[sys.argv.index("--cap") + 1])
    if "--max-pages" in sys.argv:
        max_pages = int(sys.argv[sys.argv.index("--max-pages") + 1])
    twapi.HARD_CAP_USD = cap

    out_dir = twapi.CACHE / handle
    print(f"== fetching @{handle}  (cap ${cap})  -> {out_dir}", file=sys.stderr)

    raw = fetch_all(handle, max_pages=max_pages)
    rows = list(raw.values())
    originals = [normalize(t) for t in rows if not t.get("isReply") and not t.get("inReplyToId")]
    replies = [normalize(t) for t in rows if t.get("isReply") or t.get("inReplyToId")]

    answered_rows: list[dict] = []
    if do_parents and replies:
        parent_ids = sorted({r["reply_to_id"] for r in replies if r.get("reply_to_id")})
        print(f"== {len(parent_ids)} distinct parent tweets to fetch", file=sys.stderr)
        parents = fetch_parents(handle, parent_ids)
        answered_rows = [normalize(t) for t in parents.values()]

    out_dir.mkdir(parents=True, exist_ok=True)
    write_jsonl(out_dir / "raw.jsonl", rows)
    write_jsonl(out_dir / "tweets.jsonl", originals)
    write_jsonl(out_dir / "replies.jsonl", replies)
    if do_parents:
        write_jsonl(out_dir / "answered.jsonl", answered_rows)

    summary = {
        "handle": handle,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "raw_total": len(rows),
        "originals": len(originals),
        "replies": len(replies),
        "answered_fetched": len(answered_rows),
        "session_spent_usd": round(twapi.session_spent_credits() / twapi.CREDITS_PER_USD, 4),
        "cap_usd": cap,
    }
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
