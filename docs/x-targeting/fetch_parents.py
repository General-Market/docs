#!/usr/bin/env python3
"""Lean, resumable parent-tweet fetcher for an already-fetched account.

Reads <handle>/replies.jsonl, collects distinct reply_to_id, fetches the parent
tweets in 50-id batches via /twitter/tweets, and APPENDS normalized rows to
<handle>/answered.jsonl after every batch (crash-safe + resumable — already-saved
ids are skipped on restart). No per-call balance polling, so it's fast.

Usage: fetch_parents.py HANDLE
"""
import json, sys
import twapi
from fetch_account import normalize

handle = (sys.argv[1] if len(sys.argv) > 1 else "vibe_trading").lstrip("@")
out_dir = twapi.CACHE / handle
answered = out_dir / "answered.jsonl"
BATCH = 50

want = list(dict.fromkeys(
    r.get("reply_to_id")
    for line in open(out_dir / "replies.jsonl")
    if (r := json.loads(line)).get("reply_to_id")
))
have = set()
if answered.exists():
    have = {json.loads(l)["tweet_id"] for l in open(answered) if l.strip()}
todo = [i for i in want if i not in have]
print(f"distinct parents: {len(want)} | already saved: {len(have)} | to fetch: {len(todo)}", flush=True)

fetched = 0
with answered.open("a") as out:
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        st, body = twapi._get("/twitter/tweets", {"tweet_ids": ",".join(chunk)})
        if st != 200:
            print(f"  batch {i//BATCH}: HTTP {st} {str(body)[:100]} — skipping", flush=True)
            continue
        for t in (body.get("tweets") or []):
            tid = str(t.get("id"))
            if tid and tid != "None":
                out.write(json.dumps(normalize(t), ensure_ascii=False) + "\n")
                fetched += 1
        out.flush()
        if (i // BATCH) % 10 == 0:
            print(f"  batch {i//BATCH}/{len(todo)//BATCH}: {fetched} new this run", flush=True)

# refresh summary
total = len({json.loads(l)["tweet_id"] for l in open(answered) if l.strip()})
s = json.load(open(out_dir / "summary.json"))
s["answered_fetched"] = total
json.dump(s, open(out_dir / "summary.json", "w"), indent=2)
print(f"DONE: {fetched} new this run, {total} parents total in answered.jsonl", flush=True)
