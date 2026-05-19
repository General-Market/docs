# Subagent Rules — Cache-First Discipline

Before any subagent makes a paid API call, it MUST verify the data isn't already in local cache. This document is the binding contract.

## The rule

```
For every handle the subagent considers fetching:
  1. cache.py have HANDLE      → returns cached profile if exists
  2. cache.py fresh HANDLE     → shows profile_age_days + latest_tweet_age_days
  3. cache.py needs --tweets HANDLE  → returns the handle ONLY if a fetch is genuinely needed

If `needs` returns nothing → the handle is cached fresh → DO NOT FETCH.
```

## What counts as "cached fresh"

| Data | TTL | Reason |
|---|---|---|
| Profile | 14 days | bio/followers change slowly |
| Tweets (activity check) | 7 days | activity is the time-sensitive signal |
| Pinned tweet | 14 days | pinned changes rarely |

## Concrete subagent workflow

```bash
# 1. Build candidate list
echo "@foo @bar @baz" > /tmp/candidates.txt

# 2. Filter through cache.py needs — this DROPS handles cached fresh
python3 cache.py needs --tweets $(cat /tmp/candidates.txt) > /tmp/to_fetch.txt

# 3. Audit only the ones that came through. audit.py's ensure_data
#    will reuse cached tweets when present, so this is also fine:
python3 audit.py --list /tmp/to_fetch.txt

# 4. For already-cached handles, re-score is FREE — no API needed.
#    Just run audit.py on them; it pulls from cache.
```

## What the three Protocol agents got wrong

- **Protocol B** re-audited @Armv7lFx and @derivativemonky. Both were already in our `twapi-ledger.jsonl` under `lasttweets:`. Fresh `lasttweets` calls were billed.
- **Protocol A** audited 18 handles — verify in ledger that none had been audited before.
- **Protocol C** re-audited @quantrob (audited earlier in vol-surface batch).

## The check every agent must run first

Add to the front of every subagent prompt:

> Before auditing any handle, run:
> `cache.py needs --tweets HANDLE1 HANDLE2 HANDLE3` (stderr shows `# N/K handles need fetching`)
> Audit ONLY the handles printed in stdout (the ones that genuinely need fetching).
> Handles cached fresh re-score for free — just re-run audit.py on them, it uses cached tweets without an API call.

## Re-scoring at zero cost

If thresholds change (e.g. `niche_recent >= 3` drops to `>= 2`), the entire cache re-scores for free. No API calls needed for any handle whose tweets are cached.

```bash
# After editing audit.py thresholds:
python3 audit.py --list /tmp/all_cached_handles.txt   # zero new API spend
```

## Cumulative session spend tracking

Subagents must respect their personal $X cap by:
1. Read `python3 twapi.py balance | jq '.total'` at start → record baseline.
2. Cap = (baseline - X * 100000) credits.
3. Re-check balance every ~5 API calls. STOP when current balance ≤ cap.

The `session_spent_credits()` in twapi.py reads `.session_start_balance`. Each subagent should set its own baseline file before starting:
```bash
echo "$(python3 twapi.py balance | jq -r '.total')" > cache/.session_start_balance
```

But because multiple agents share one cache, the simplest pattern is: each agent tracks its own delta locally.
