#!/usr/bin/env python3
"""One shard of a parallel parent-tweet fetch. Resumable, own output file.

Reads <handle>/replies.jsonl for distinct reply_to_id, reads ALL existing
<handle>/answered.part-*.jsonl to skip what's already saved, then fetches its
slice want[shard::nworkers] in 50-id batches, appending to answered.part-<shard>.jsonl.

Usage: fetch_parents_shard.py HANDLE SHARD NWORKERS
"""
import json, sys, glob
import twapi
from fetch_account import normalize

handle = sys.argv[1].lstrip("@")
shard = int(sys.argv[2])
nworkers = int(sys.argv[3])
out_dir = twapi.CACHE / handle
BATCH = 50

want = list(dict.fromkeys(
    r.get("reply_to_id")
    for line in open(out_dir / "replies.jsonl")
    if (r := json.loads(line)).get("reply_to_id")
))
have = set()
for pf in glob.glob(str(out_dir / "answered.part-*.jsonl")):
    for l in open(pf):
        if l.strip():
            have.add(json.loads(l)["tweet_id"])

mine = [i for idx, i in enumerate(want) if idx % nworkers == shard and i not in have]
print(f"[shard {shard}] todo {len(mine)}", flush=True)

outfile = out_dir / f"answered.part-{shard}.jsonl"
fetched = 0
with outfile.open("a") as out:
    for i in range(0, len(mine), BATCH):
        chunk = mine[i:i + BATCH]
        st, body = twapi._get("/twitter/tweets", {"tweet_ids": ",".join(chunk)}, timeout=90)
        if st != 200:
            print(f"[shard {shard}] batch {i//BATCH}: HTTP {st} — skip", flush=True)
            continue
        for t in (body.get("tweets") or []):
            tid = str(t.get("id"))
            if tid and tid != "None":
                out.write(json.dumps(normalize(t), ensure_ascii=False) + "\n")
                fetched += 1
        out.flush()
print(f"[shard {shard}] DONE {fetched} new", flush=True)
