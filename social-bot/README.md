# Social Bot

Anomaly detection engine + editorial pipeline for 5 branded X/Twitter accounts under GeneralMarket.

Detects newsworthy events from 98 real-time data sources, enriches them with historical context ("3rd this week", "worst since 2019", "180% above average"), and queues tweets for posting.

## Architecture

```
VPS (MCP server)                     Local Mac
┌────────────────────┐               ┌─────────────────────────────┐
│ PostgreSQL         │               │ Claude Code /loop 10min     │
│ ↕                  │  SSH stdio    │ ├─ calls MCP tools (VPS)    │
│ Anomaly detector   │◄────────────►│ ├─ reads directives/*.md    │
│ Investigation tools│               │ ├─ writes scheduled.csv     │
│ (no Twitter creds) │               │ └─ NO posting               │
└────────────────────┘               │                             │
                                     │ poster.py (background)      │
                                     │ ├─ watches scheduled.csv    │
                                     │ ├─ reads .twitter-creds.json│
                                     │ ├─ posts to X via tweepy    │
                                     │ └─ marks rows as posted     │
                                     └─────────────────────────────┘
```

## Accounts

| Account | Handle | Focus |
|---------|--------|-------|
| Insiders | @GeneralInsiders | SEC insider trades, short interest, congress trades |
| GridDown | @GeneralGridDown | Power outages, internet shutdowns, flight chaos, transit |
| SkyWatch | @GeneralSkyWatch | Earthquakes, volcanoes, solar storms, wildfires, air quality |
| TaxReceipt | @GeneralTaxReceipt | Government spending, court rulings, housing costs |
| Glitch | @GeneralGlitch | Ice cream machines, theme parks, gaming, Reddit, weird data |
| Main | @GeneralMarket | Curator — retweets the best ones |

## Setup

### 1. Deploy to VPS

```bash
# First time: create dir on VPS
ssh index-maker/prod/be "mkdir -p /home/max/social-bot"

# Deploy (excludes local-only files)
cd social-bot
tar czf - --exclude='.env' --exclude='__pycache__' --exclude='*.pyc' \
    --exclude='.twitter-creds.json' --exclude='scheduled.csv' \
    --exclude='poster.py' --exclude='directives' . \
    | ssh index-maker/prod/be "cd /home/max/social-bot && tar xzf -"

# Install deps
ssh index-maker/prod/be "/home/max/.local/bin/pip install --user --break-system-packages -r /home/max/social-bot/requirements.txt"

# Create .env
ssh index-maker/prod/be 'printf "%s" "DATABASE_URL=postgres:///index_prices" > /home/max/social-bot/.env'

# Run migrations
ssh index-maker/prod/be "cd /home/max/social-bot && python3 migrate.py"
```

### 2. MCP config (already in `.mcp.json`)

Restart Claude Code to pick up the `socialbot` MCP server. Tools become available:

- `get_anomalies` — pending newsworthy events
- `skip_tweet` — reject an anomaly
- `approve_tweet` — mark approved (writes to DB, does NOT post)
- `search` — search all historical assets
- `get_history` — price/value time series
- `get_frequency` — event count in time window
- `get_compare` — current vs rolling averages
- `list_assets` — browse assets per source
- `get_last_posted` — recent tweets per account
- `get_posted` — all tweets in N days
- `get_stats` — dashboard

### 3. Start the editorial loop (no Twitter needed)

```
/loop 10m Review anomalies and post newsworthy ones. Follow social-bot/loop-prompt.md
```

This reviews anomalies via MCP tools, writes approved tweets to `scheduled.csv`. Tweets queue up but don't post until poster.py is running.

### 4. Add Twitter (when ready)

```bash
cp .twitter-creds.example.json .twitter-creds.json
# Fill in API keys for each account

pip install tweepy
python poster.py
```

poster.py polls `scheduled.csv` every 30s. Posts pending tweets, enforces 30-min spacing per account (FEAR bypasses), caps at 15/day per account.

## File Structure

```
social-bot/
├── server.py              # MCP server entry point (VPS)
├── db.py                  # PostgreSQL connection (VPS)
├── migrate.py             # Table creation (VPS)
├── thresholds.yaml        # 30 source anomaly rules (VPS)
├── engine/
│   ├── detector.py        # Scans market_prices_latest (VPS)
│   ├── context.py         # Frequency/comparison/trend/delta (VPS)
│   ├── dedup.py           # Duplicate prevention (VPS)
│   └── thresholds.py      # YAML rule parser (VPS)
├── tools/
│   ├── anomalies.py       # get_anomalies, skip_tweet (VPS)
│   ├── investigate.py     # search, history, frequency, compare (VPS)
│   ├── publish.py         # approve_tweet, get_posted (VPS)
│   └── stats.py           # Dashboard stats (VPS)
├── poster.py              # Watches CSV, posts to X (Mac only)
├── scheduled.csv          # Tweet queue (Mac only)
├── directives/            # Per-account tone/rules (Mac only)
│   ├── GeneralInsiders.md
│   ├── GeneralGridDown.md
│   ├── GeneralSkyWatch.md
│   ├── GeneralTaxReceipt.md
│   └── GeneralGlitch.md
├── loop-prompt.md         # /loop editorial prompt
├── .twitter-creds.json    # Twitter API keys (gitignored, Mac only)
├── .env                   # DATABASE_URL (gitignored, VPS only)
└── deploy.sh              # Sync to VPS
```

## Outcome Tags

Each tweet gets an outcome tag that determines framing:

| Tag | Reader should... | Example |
|-----|-----------------|---------|
| FEAR | DO something (stay inside, check position) | "200K without power in 108°F" |
| LOOK | SEE something (go outside, look north) | "Aurora visible as far south as 40°N" |
| MONEY | Know their WALLET is affected | "Pfizer CEO sold $5.6M in stock" |
| RAGE | See the UNFAIRNESS | "$47M contract to a 3-person company" |
| WTF | See the ABSURDITY | "92% of Philly ice cream machines broken" |
| WATCH | Know this is DEVELOPING | "3rd M5+ earthquake in Turkey this week" |
| RECORD | Anchor to HISTORY | "Yield curve inverted 14 months straight" |
