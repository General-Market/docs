# hyperfeed — Hyperliquid outlier feed on Telegram

**Date:** 2026-06-10
**Status:** approved, building
**Lives at:** `hyperfeed/` (repo) → `/root/hyperfeed/` (VPS3, Docker)

## TL;DR

An always-on Telegram bot on VPS3. Subscribe with `/hyperliquid`. Every 10 minutes it
watches ~30 curated Hyperliquid accounts (harvested from @vibe_trading's followings),
and when one of them posts a tweet that beats *its own* baseline hard enough — and clears
an absolute floor — it broadcasts the tweet to every subscriber. It learns "what an
outlier is" by backfilling 30 days of those accounts' history and setting the fire
threshold from the real distribution.

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Candidate source | The curated ~30 accounts only | Clean per-author baselines; no all-of-X keyword sweep |
| Calibration window | 30 days | Matches the `*-30d` niche convention |
| Outlier rule | `outlier_score` (relative ×author + per-follower) **+ absolute floors** | "A bit of both" — a big account can't fire on a routine post, a tiny one can't fire on noise |
| Post type | All tweets on the theme | The existing radar already covers native articles |
| Runtime | Long-running Docker daemon | A subscribe bot must hold live state and answer commands |

## Reuse, not reinvention

- **Filter vocabulary is authoritative and live.** `hl_filter.py` imports `HYPERLIQUID_TERMS`,
  `HYPERLIQUID_TOKEN_PATTERNS`, `HYPERLIQUID_AUTHOR_REGEX`, and `term_in_text` from the
  bind-mounted `find_native_x_articles.py`. When the radar vocab is expanded, hyperfeed
  follows automatically. One source of truth.
- **Twitter client is hyperfeed's own** (`twitter.py`), modeled on `xwatch/twitter.py` —
  stdlib `urllib`, single-page calls, own cost ledger. It does **not** call `twapi.py`'s
  HTTP layer, which forks a process per call (`multiprocessing.fork` + `fcntl`) and is
  unsafe inside an async loop. Blocking calls run via `asyncio.to_thread`.
- **Outlier formula** is re-implemented on raw tweet dicts (it is three lines) with a
  source pointer to `find_native_x_articles.py:789-797`.

## Components

| Module | Job | Depends on |
|---|---|---|
| `config.py` | Env + paths + tunables, dotenv loader (jarvis pattern) | — |
| `twitter.py` | stdlib client: `advanced_search`, `user_last_tweets`, `user_followings`; cost ledger; spend caps | key file/env |
| `hl_filter.py` | `is_hyperliquid(text, author)` + `outlier_score(...)`; imports live vocab | bind-mounted radar |
| `harvest.py` | `user_followings("vibe_trading")` → keep HL handles → `state/accounts.json` (~30) | twitter, hl_filter |
| `calibrate.py` | per account: 30d history → baseline views + score distribution → `state/calibration.json`; returns top historical outliers | twitter, hl_filter |
| `scan.py` | every cycle: batched `from:` searches since last → relevance gate → score → fire if `≥ threshold AND ≥ floors` | twitter, hl_filter, calibration |
| `telegram_client.py` | async multi-chat send + `get_updates` (jarvis pattern, generalized off single chat) | aiohttp |
| `commands.py` | `/hyperliquid` `/stop` `/status` `/recent` `/accounts` `/calibrate` `/help` | all |
| `main.py` | async daemon: command poller + scan timer + daily calibrate timer; signal handling | all |

## Data flow

```
startup ──> harvest (if accounts.json missing/stale) ──> calibrate (if calibration.json missing/stale)
   loop:
     command poller (long-poll getUpdates 25s)  ── /hyperliquid → subscribers.json
     scan timer every SCAN_INTERVAL_MIN:
        chunk accounts in groups of 10
        advanced_search "(from:a OR ...) since:<last> -filter:retweets"  (Latest)
        for each fresh tweet (id not in seen):
           if is_hyperliquid(text, author):
              score = outlier_score(views, followers, engagement, baseline_views[author])
              if score.outlier_score ≥ threshold and views ≥ min_views and engagement ≥ min_engagement:
                 broadcast formatted alert to all subscribers
                 append to fired.jsonl ; mark seen
     calibrate timer daily ──> refresh baselines + threshold ; post summary + top historical outliers
```

## Outlier rule (the fire condition)

For a fresh tweet from account `A`:

1. **Relevance gate** — `is_hyperliquid(text, A)`: any `HYPERLIQUID_TERMS` term via `term_in_text`,
   or a token-context pattern, or `A` matches `HYPERLIQUID_AUTHOR_REGEX`. (Exact radar semantics.)
2. **Score** — `outlier_score = views_vs_author_avg*100 + views_per_1k_followers + engagement_per_1k_views`,
   where `views_vs_author_avg = views / baseline_views[A]` (baseline = mean of A's last-10 mature views).
3. **Fire** when `outlier_score ≥ threshold` **AND** `views ≥ min_views` **AND** `engagement ≥ min_engagement`.

`threshold`, `min_views`, `min_engagement` are set by `calibrate.py` from the 30-day history,
not hardcoded. `/status` shows them; `/calibrate` recomputes and shows the distribution + the
top historical outliers, so "what is an outlier" is answered with concrete examples.

## State (bind-mounted `state/`, survives restarts)

| File | Contents |
|---|---|
| `accounts.json` | `{handle: {followers, bio, source}}` — the curated ~30 |
| `calibration.json` | `{computed_at, window_days, threshold, min_views, min_engagement, accounts:{handle:{baseline_views,n,followers}}, score_distribution}` |
| `subscribers.json` | `[chat_id, ...]` |
| `seen.json` | `{tweet_id: iso}` — fired/processed dedup, pruned to 48h |
| `fired.jsonl` | append-only log of every alert (for `/recent` and tuning) |
| `ledger.jsonl` | per-call cost estimate (xwatch shape) |
| `offset.txt` | Telegram getUpdates offset |

## Cost & safety

- Scan = `ceil(30/10) = 3` batched `Latest` searches per cycle. Near-free when quiet (search
  billed per tweet returned). At 10-min cadence that is ~432 cheap searches/day.
- Calibration = ~30 `user_last_tweets` calls, once daily (+ on demand). The expensive part,
  but bounded and cached.
- `DAILY_CAP_USD` (default 0.50) gates automatic spend; `/status` surfaces today's estimate.
- twitter key read from `TWITTERAPI_API_KEY` env, else `TWITTERAPI_KEY_FILE`
  (`/root/.secrets/twitterapi_io_key` on VPS3), else `/tmp/.twapi_key` — same fallback as xwatch.

## Commands

| Command | Effect |
|---|---|
| `/hyperliquid` (alias `/subscribe`, `/start`) | subscribe this chat to the feed; reply with status |
| `/stop` (alias `/unsubscribe`) | unsubscribe |
| `/status` | # accounts, threshold + floors, last scan, fired today, spend today, next calibration |
| `/recent [n]` | last n fired outliers |
| `/accounts` | the curated handles |
| `/calibrate` | recompute baselines + threshold; post distribution + top historical outliers |
| `/help` | command list |

## Alert shape

```
⚡ @author (12.4k followers) · 7m old
84,210 views · 1,203 likes · 312 RT · 198 replies
9.7× their average · score 18,402
<tweet text, ≤280 chars>
open on X → <url>
```

## Deploy (VPS3)

```bash
rsync -av --exclude state --exclude __pycache__ -e "ssh -p 3189" \
  hyperfeed/ root@159.195.77.160:/root/hyperfeed/
# .env copied separately (token + key path); not in git
ssh vps3 'cd /root/hyperfeed && docker build -t hyperfeed:prod .'
ssh vps3 'docker rm -f hyperfeed 2>/dev/null; docker run -d --name hyperfeed \
  --restart unless-stopped --network dokploy-network \
  -v /root/hyperfeed/state:/app/hyperfeed/state \
  -v /root/index/docs/x-targeting:/app/x-targeting:ro \
  -v /root/.secrets/twitterapi_io_key:/root/.secrets/twitterapi_io_key:ro \
  --env-file /root/hyperfeed/.env hyperfeed:prod'
ssh vps3 'docker logs hyperfeed --tail 30'
```

`.env`: `TELEGRAM_BOT_TOKEN`, `X_TARGETING_DIR=/app/x-targeting`,
`TWITTERAPI_KEY_FILE=/root/.secrets/twitterapi_io_key` (mounted), `VIBE_SEED_HANDLE=vibe_trading`,
plus tunables (`SCAN_INTERVAL_MIN=10`, `CALIBRATION_WINDOW_DAYS=30`, `THRESHOLD_PERCENTILE=90`,
`DAILY_CAP_USD=0.50`).

## Out of scope (YAGNI)

- Multiple niches / feeds beyond Hyperliquid (the architecture allows it; not built).
- Per-subscriber custom thresholds.
- All-of-X keyword sweep.
- A web UI (the radar already has one).
