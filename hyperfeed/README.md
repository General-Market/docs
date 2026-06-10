# hyperfeed

Always-on Telegram bot. Subscribe with `/hyperliquid`. Every 10 minutes it watches ~30 curated
Hyperliquid accounts (harvested from @vibe_trading's followings) and broadcasts any tweet that
beats its author's own baseline hard enough to count as an outlier.

Design + decisions: [`docs/superpowers/specs/2026-06-10-hyperfeed-telegram-design.md`](../docs/superpowers/specs/2026-06-10-hyperfeed-telegram-design.md).

## What it does

1. **Harvest** — pull who `@vibe_trading` follows, keep the Hyperliquid ones → `state/accounts.json`.
2. **Calibrate** — backfill 30 days of those accounts' tweets, set each one's baseline and the fire
   threshold from the real `outlier_score` distribution → `state/calibration.json`.
3. **Scan** — every 10 min, search the accounts' recent posts, gate for Hyperliquid relevance, score
   each against its baseline, and fire when `score ≥ threshold AND views ≥ floor AND eng ≥ floor`.

The Hyperliquid vocabulary is **imported live** from the radar
(`docs/x-targeting/x_articles/find_native_x_articles.py`) — not copied — so it never drifts.

## Commands

| Command | Effect |
|---|---|
| `/hyperliquid` | subscribe this chat |
| `/stop` | unsubscribe |
| `/status` | accounts, threshold, floors, spend |
| `/recent [n]` | last n fired outliers |
| `/accounts` | the watched accounts |
| `/calibrate` | recompute the threshold; show distribution + top historical outliers |
| `/help` | command list |

## Run locally (~2 min)

```bash
cp .env.example .env            # add TELEGRAM_BOT_TOKEN
export X_TARGETING_DIR=$(cd ../docs/x-targeting && pwd)
export TWITTERAPI_KEY_FILE=/tmp/.twapi_key
python -m hyperfeed.main        # from the repo root, with hyperfeed/ on the path
```

## Deploy to VPS3 (Docker, ~3 min)

```bash
rsync -av --exclude state --exclude __pycache__ -e "ssh -p 3189" \
  hyperfeed/ root@159.195.77.160:/root/hyperfeed/
ssh vps3 'cd /root/hyperfeed && docker build -t hyperfeed:prod .'
ssh vps3 'docker rm -f hyperfeed 2>/dev/null; docker run -d --name hyperfeed \
  --restart unless-stopped --network dokploy-network \
  -v /root/hyperfeed/state:/app/hyperfeed/state \
  -v /root/index/docs/x-targeting:/app/x-targeting:ro \
  -v /root/.secrets/twitterapi_io_key:/root/.secrets/twitterapi_io_key:ro \
  --env-file /root/hyperfeed/.env hyperfeed:prod'
ssh vps3 'docker logs hyperfeed --tail 30 -f'
```

`.env` is gitignored and carries the bot token; it is rsynced but never committed.
The twitterapi.io key file (`/root/.secrets/twitterapi_io_key`) and the radar
(`/root/index/docs/x-targeting`) already exist on VPS3.

Bot: **@maxopenclawbot**. The feed needs a funded twitterapi.io key — the key was at
`recharge_credits: -2826` at deploy; the daemon self-heals (harvests + calibrates) on the
first cycle after the key is topped up, no restart needed.

## Cost

Scans are batched `from:` searches billed per tweet returned — cheap when the accounts are quiet.
Calibration (~30 `last_tweets` pulls) runs once daily. `DAILY_CAP_USD` pauses automatic scans if
the day's estimate is exceeded; `/status` shows the running total.
