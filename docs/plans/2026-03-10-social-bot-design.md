# GeneralMarket Social Bot — Design Doc

## Overview

Automated social media pipeline that detects anomalies across 98 data sources and posts viral one-liner news to 5 branded X/Twitter accounts under the GeneralMarket brand.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                         VPS                               │
│                                                           │
│  ┌─────────────┐      ┌────────────────────────────────┐ │
│  │  data-node   │      │  social-bot (Python)            │ │
│  │  (Rust)      │      │                                 │ │
│  │  Port 8200   │      │  - MCP server (stdio over SSH)  │ │
│  │  98 sources  │      │  - Direct PostgreSQL access     │ │
│  │  syncing     │      │  - Anomaly detection engine     │ │
│  └──────┬──────┘      │  - Context computation          │ │
│         │              │  - X/Twitter posting (tweepy)    │ │
│         ▼              │  - thresholds.yaml config       │ │
│  ┌─────────────┐      │                                 │ │
│  │ PostgreSQL   │◀────│  Full historical query access   │ │
│  │              │      │  market_prices (unlimited)      │ │
│  │ market_prices│      │  market_assets (search)         │ │
│  │ market_assets│      │                                 │ │
│  │ (full history│      └────────────────────────────────┘ │
│  └─────────────┘                                         │
└──────────────────────────────────────────────────────────┘
         ▲ SSH tunnel (MCP stdio)
         │
┌────────┴─────────────────────────────────────────────────┐
│                    Local Mac                              │
│                                                           │
│  Claude Code /loop every 10 min                           │
│  ├── Calls MCP tools on social-bot                        │
│  ├── get_anomalies() → reviews candidates                 │
│  ├── search() / get_history() → investigates deeper       │
│  ├── get_compare() / get_frequency() → builds context     │
│  ├── approve_tweet() → posts to X                         │
│  └── skip_tweet() → drops non-newsworthy                  │
│                                                           │
│  Claude is the editorial brain:                           │
│  - Decides what's newsworthy                              │
│  - Rewrites headlines for virality                        │
│  - Assigns outcome tags (FEAR/LOOK/MONEY/RAGE/WTF/...)   │
│  - Picks which account to post from                       │
│  - Can query ANY historical data to build context         │
└──────────────────────────────────────────────────────────┘
```

## MCP Server Tools

### Anomaly Discovery

```
get_anomalies(source?: string, limit?: int) → Candidate[]
```
Returns pending anomaly candidates detected by the threshold engine. Each candidate includes raw data, pre-computed context, suggested account, and a suggested headline. Candidates are sorted by estimated virality.

```
Candidate {
    id: string                  # "eq-20260310-143022"
    source: string              # "earthquake"
    asset_id: string            # "earthquake_turkey_m58"
    timestamp: datetime
    raw_data: dict              # { magnitude: 5.8, location: "Turkey", depth_km: 12 }
    context: {
        frequency: string?      # "3rd M5+ in Turkey this week"
        comparison: string?     # "strongest since 2023"
        trend: string?          # "seismic activity rising for 9 days"
        delta: string?          # "340% above weekly average"
        human_scale: string?    # "4.2M people within 50km"
    }
    suggested_account: string   # "GeneralSkyWatch"
    suggested_headline: string  # "M5.8 earthquake in southern Turkey..."
    suggested_outcome: string   # "WATCH"
}
```

### Historical Investigation

```
search(query: string, source?: string, days?: int) → Asset[]
```
Full-text search across all `market_assets` (including dead/archived ones). Returns matching assets with their last known value and when they were last updated. Searches name, symbol, and asset_id fields.

```
get_history(source: string, asset_id: string, days: int) → DataPoint[]
```
Full price/value time series from `market_prices`. Works for both live and archived assets. Returns `[{ value, fetched_at }]`.

```
get_frequency(source: string, event_type: string, region?: string, days?: int) → FrequencyResult
```
Counts how many times an event type occurred in a time window. Examples:
- `get_frequency("earthquake", "M5+", "turkey", 7)` → `{ count: 3, avg_per_week: 0.5, is_unusual: true }`
- `get_frequency("power_outages", ">50K", "texas", 30)` → `{ count: 4, avg_per_month: 1.2, is_unusual: true }`

```
get_compare(source: string, asset_id: string) → CompareResult
```
Current value vs rolling statistics:
```
CompareResult {
    current: float
    avg_7d: float, avg_30d: float, avg_90d: float, avg_1y: float
    min_30d: float, max_30d: float, min_1y: float, max_1y: float
    percentile_1y: float        # where current sits in 1-year range
    last_time_this_high: date?  # "last time value was >= current"
    last_time_this_low: date?
}
```

```
list_assets(source: string, from?: date, to?: date, active_only?: bool) → Asset[]
```
All assets that had data in a time range. With `active_only=false`, includes assets no longer being synced (old HN articles, finished games, expired markets).

### Editorial Actions

```
approve_tweet(id: string, final_tweet: string, account: string, outcome_tag: string, virality_score: int)
```
Approves a candidate and posts it to X. The Python service posts immediately (or queues if another tweet was posted < 30 min ago for the same account).

```
skip_tweet(id: string, reason: string)
```
Marks a candidate as skipped. Stored in history to avoid resurfacing.

### Monitoring

```
get_last_posted(account?: string, limit?: int) → PostedTweet[]
```
Recent tweets posted per account. Claude uses this to avoid repetition and check spacing.

```
get_posted(days?: int) → PostedTweet[]
```
Full posting history. Claude can review what worked (future: engagement data).

```
get_stats() → Stats
```
Dashboard: posted today per account, queue depth, anomalies detected today, skip rate, error count.

## Anomaly Detection Engine

Runs every 2 minutes. Pulls latest data from `market_prices_latest`, compares against thresholds defined in `thresholds.yaml`, and writes candidates to an in-memory queue (served via `get_anomalies`).

### thresholds.yaml Structure

```yaml
earthquake:
  rules:
    - condition: "magnitude >= 7.0"
      outcome: "FEAR"
      context: ["human_scale", "comparison"]
    - condition: "magnitude >= 5.0 AND population_nearby > 500000"
      outcome: "WATCH"
      context: ["frequency", "comparison"]
    - condition: "magnitude >= 3.5 AND is_major_city"
      outcome: "LOOK"
      context: ["comparison"]
    - condition: "swarm_count_24h >= 20"
      outcome: "WATCH"
      context: ["frequency"]
  account: "GeneralSkyWatch"
  dedup: "region+day"
  min_interval_hours: 2

power_outages:
  rules:
    - condition: "customers >= 500000"
      outcome: "FEAR"
      context: ["human_scale", "comparison"]
    - condition: "customers >= 50000 AND extreme_weather"
      outcome: "FEAR"
      context: ["human_scale"]
    - condition: "customers >= 50000 AND nth_this_month >= 3"
      outcome: "RAGE"
      context: ["frequency", "comparison"]
  account: "GeneralGridDown"
  dedup: "state+day"
  min_interval_hours: 4

ioda:
  rules:
    - condition: "connectivity < 10"
      outcome: "RAGE"
      context: ["frequency", "human_scale"]
    - condition: "connectivity < 50 AND drop_1h > 30"
      outcome: "WATCH"
      context: ["delta"]
  account: "GeneralGridDown"
  dedup: "country+day"

spaceweather:
  rules:
    - condition: "kp >= 8"
      outcome: "LOOK"
      context: ["frequency", "comparison"]
    - condition: "kp >= 7 OR flare_class_x"
      outcome: "LOOK"
      context: ["frequency"]
    - condition: "x_flares_this_week >= 3"
      outcome: "WATCH"
      context: ["frequency", "comparison"]
  account: "GeneralSkyWatch"

wildfire:
  rules:
    - condition: "hotspots_6h >= 2000 AND near_city"
      outcome: "FEAR"
      context: ["human_scale", "comparison"]
    - condition: "hotspots_6h >= 500 AND smoke_aqi > 150"
      outcome: "FEAR"
      context: ["human_scale"]
    - condition: "vs_last_year_pct >= 200"
      outcome: "RECORD"
      context: ["comparison", "trend"]
  account: "GeneralSkyWatch"
  dedup: "region+day"

volcano:
  rules:
    - condition: "alert_level_raised AND near_population"
      outcome: "FEAR"
      context: ["human_scale", "comparison"]
    - condition: "eruption_confirmed"
      outcome: "FEAR"
      context: ["frequency", "comparison"]
  account: "GeneralSkyWatch"
  dedup: "volcano+week"

sec:
  rules:
    - condition: "trade_value >= 50000000"
      outcome: "MONEY"
      context: ["comparison", "frequency"]
    - condition: "insider_cluster >= 3"
      outcome: "MONEY"
      context: ["frequency"]
    - condition: "is_politician AND trade_value >= 100000"
      outcome: "RAGE"
      context: ["frequency"]
    - condition: "sale_before_bad_news"
      outcome: "RAGE"
      context: ["delta"]
  account: "GeneralInsiders"
  dedup: "company+person+week"

finra:
  rules:
    - condition: "short_volume_pct >= 60"
      outcome: "MONEY"
      context: ["comparison"]
    - condition: "short_volume_pct >= 50 AND sector_cluster >= 3"
      outcome: "MONEY"
      context: ["frequency"]
  account: "GeneralInsiders"
  dedup: "ticker+day"

congress:
  rules:
    - condition: "vote_margin <= 5"
      outcome: "RAGE"
      context: ["comparison"]
    - condition: "affects_daily_life"
      outcome: "RAGE"
      context: ["human_scale"]
    - condition: "nth_failure >= 3"
      outcome: "RAGE"
      context: ["frequency"]
  account: "GeneralTaxReceipt"
  dedup: "bill+day"

usa_spending:
  rules:
    - condition: "contract_value >= 500000000"
      outcome: "RAGE"
      context: ["human_scale", "comparison"]
    - condition: "audit_failure"
      outcome: "RAGE"
      context: ["frequency"]
    - condition: "absurd_price_ratio >= 10"
      outcome: "WTF"
      context: ["comparison"]
  account: "GeneralTaxReceipt"
  dedup: "contract+week"

courtlistener:
  rules:
    - condition: "involves_faang OR settlement >= 1000000000"
      outcome: "MONEY"
      context: ["comparison"]
    - condition: "constitutional_ruling"
      outcome: "WATCH"
      context: ["comparison"]
  account: "GeneralTaxReceipt"
  dedup: "case+day"

zillow:
  rules:
    - condition: "yoy_change_pct >= 10 OR yoy_change_pct <= -10"
      outcome: "MONEY"
      context: ["trend", "comparison"]
    - condition: "rent_to_income >= 60"
      outcome: "RAGE"
      context: ["comparison", "human_scale"]
  account: "GeneralTaxReceipt"
  dedup: "metro+month"

fred_treasury:
  rules:
    - condition: "yield_curve_inversion_change"
      outcome: "MONEY"
      context: ["comparison"]
    - condition: "rate_decade_extreme"
      outcome: "MONEY"
      context: ["comparison", "human_scale"]
  account: "GeneralTaxReceipt"
  dedup: "indicator+week"

faa_delays:
  rules:
    - condition: "ground_stop_nationwide"
      outcome: "FEAR"
    - condition: "ground_stop_major_hub"
      outcome: "WATCH"
      context: ["comparison"]
    - condition: "cancellations >= 500"
      outcome: "WATCH"
      context: ["comparison"]
  account: "GeneralGridDown"
  dedup: "airport+day"

transit:
  sources: ["mta_subway", "tfl_tube", "paris_metro", "db_trains", "ryanair"]
  rules:
    - condition: "lines_disrupted >= 4"
      outcome: "RAGE"
      context: ["frequency"]
    - condition: "same_line_nth_time >= 5"
      outcome: "RAGE"
      context: ["frequency"]
    - condition: "bizarre_cause"
      outcome: "WTF"
  account: "GeneralGridDown"
  dedup: "city+line+day"

weather_alerts:
  rules:
    - condition: "tornado_warning AND metro"
      outcome: "FEAR"
    - condition: "hurricane_cat >= 3 AND landfall"
      outcome: "FEAR"
      context: ["human_scale"]
    - condition: "temp_all_time_record"
      outcome: "RECORD"
      context: ["comparison"]
  account: "GeneralSkyWatch"
  dedup: "event+region+day"

airnow:
  rules:
    - condition: "aqi >= 300"
      outcome: "FEAR"
      context: ["comparison"]
    - condition: "aqi >= 150 AND unexpected_city"
      outcome: "WTF"
      context: ["comparison"]
    - condition: "aqi_doubled_in_2h"
      outcome: "FEAR"
      context: ["delta"]
  account: "GeneralSkyWatch"
  dedup: "city+day"

epidemic:
  rules:
    - condition: "new_pathogen"
      outcome: "WATCH"
    - condition: "cases_3x_average"
      outcome: "FEAR"
      context: ["comparison", "trend"]
    - condition: "who_emergency"
      outcome: "WATCH"
      context: ["comparison"]
  account: "GeneralSkyWatch"
  dedup: "disease+country+week"

mcbroken:
  rules:
    - condition: "city_pct >= 30"
      outcome: "WTF"
      context: ["comparison"]
    - condition: "national_pct >= 15"
      outcome: "WTF"
      context: ["comparison"]
    - condition: "city_pct == 0"
      outcome: "WTF"
  account: "GeneralGlitch"
  dedup: "city+day"

queue_times:
  rules:
    - condition: "wait_min >= 200"
      outcome: "WTF"
      context: ["comparison", "human_scale"]
    - condition: "park_avg >= 90"
      outcome: "RAGE"
      context: ["comparison"]
  account: "GeneralGlitch"
  dedup: "park+day"

steam:
  rules:
    - condition: "concurrent_record"
      outcome: "RECORD"
      context: ["comparison", "human_scale"]
    - condition: "indie_beats_aaa"
      outcome: "WTF"
      context: ["comparison"]
    - condition: "negative_reviews_pct >= 85"
      outcome: "RAGE"
      context: ["comparison"]
  account: "GeneralGlitch"
  dedup: "game+week"

twitch:
  rules:
    - condition: "viewer_record"
      outcome: "RECORD"
      context: ["comparison"]
    - condition: "category_shift"
      outcome: "WTF"
      context: ["comparison", "trend"]
  account: "GeneralGlitch"
  dedup: "channel+day"

reddit:
  rules:
    - condition: "sub_growth_24h >= 100000"
      outcome: "WTF"
      context: ["comparison"]
    - condition: "mass_private >= 3"
      outcome: "RAGE"
      context: ["human_scale"]
  account: "GeneralGlitch"
  dedup: "subreddit+week"

hackernews:
  rules:
    - condition: "score >= 1000"
      outcome: "WTF"
      context: ["comparison"]
    - condition: "front_page_dominated >= 8"
      outcome: "WATCH"
  account: "GeneralGlitch"
  dedup: "story+day"

github_npm_pypi:
  rules:
    - condition: "stars_growth_week >= 10000"
      outcome: "WTF"
      context: ["comparison"]
    - condition: "supply_chain_incident"
      outcome: "FEAR"
    - condition: "language_overtake"
      outcome: "RECORD"
      context: ["comparison"]
  account: "GeneralGlitch"
  dedup: "repo+week"

shelter:
  rules:
    - condition: "capacity_pct >= 120"
      outcome: "WATCH"
      context: ["comparison", "human_scale"]
    - condition: "mass_intake >= 500"
      outcome: "WATCH"
      context: ["human_scale"]
  account: "GeneralGlitch"
  dedup: "city+week"

sports:
  rules:
    - condition: "historic_upset"
      outcome: "WTF"
      context: ["comparison"]
    - condition: "bizarre_score"
      outcome: "WTF"
      context: ["comparison"]
    - condition: "esports_vs_traditional"
      outcome: "RECORD"
      context: ["comparison"]
  account: "GeneralGlitch"
  dedup: "event+day"

cbp_border:
  rules:
    - condition: "wait_hours >= 3"
      outcome: "RAGE"
      context: ["frequency", "human_scale"]
    - condition: "all_crossings_elevated"
      outcome: "WATCH"
      context: ["comparison"]
  account: "GeneralGridDown"
  dedup: "crossing+day"

nrc_nuclear:
  rules:
    - condition: "unplanned_shutdown"
      outcome: "FEAR"
      context: ["comparison"]
    - condition: "multi_reactor_offline >= 2"
      outcome: "FEAR"
      context: ["human_scale"]
    - condition: "new_reactor_online"
      outcome: "RECORD"
  account: "GeneralGridDown"
  dedup: "reactor+week"
```

### Context Computation

For each anomaly candidate, the detector auto-computes context by querying `market_prices`:

```python
def compute_context(source, asset_id, current_value, event_type):
    context = {}

    # FREQUENCY: "Nth this week/month"
    count = db.query("""
        SELECT COUNT(*) FROM market_prices
        WHERE source = %s AND asset_id LIKE %s
        AND value >= %s AND fetched_at > NOW() - INTERVAL '7 days'
    """, source, f"{event_type}%", threshold)
    if count > 1:
        context["frequency"] = f"{ordinal(count)} {event_type} this week"

    # COMPARISON: "worst/best since"
    last_time = db.query("""
        SELECT MAX(fetched_at) FROM market_prices
        WHERE source = %s AND asset_id = %s AND value >= %s
        AND fetched_at < NOW() - INTERVAL '30 days'
    """, source, asset_id, current_value)
    if last_time:
        context["comparison"] = f"highest since {last_time.strftime('%B %Y')}"

    # TREND: "Nth consecutive day of X"
    # DELTA: "X% above 30d average"
    # HUMAN_SCALE: "N people affected" / "larger than Rhode Island"

    return context
```

## Account Routing

| Account | Sources | Outcome bias |
|---------|---------|-------------|
| @GeneralInsiders | sec, finra, congress, cftc | MONEY, RAGE |
| @GeneralGridDown | power_outages, ioda, faa_delays, flights, mta_subway, tfl_tube, paris_metro, db_trains, ryanair, cbp_border, nrc_nuclear | FEAR, RAGE |
| @GeneralSkyWatch | earthquake, volcano, spaceweather, wildfire, airnow, weather_alerts, epidemic | FEAR, LOOK, RECORD |
| @GeneralTaxReceipt | usa_spending, congress (votes), courtlistener, zillow, fred, treasury | RAGE, MONEY, WTF |
| @GeneralGlitch | mcbroken, queue_times, steam, twitch, reddit, hackernews, github, npm, pypi, shelter, sports, pandascore, tmdb | WTF, RECORD, RAGE |
| @GeneralMarket | Retweets best from all 5 (via /loop) | all |

## Posting Rules

- 30-min minimum spacing per account
- Max 15 tweets/day per account
- FEAR tweets bypass spacing (post immediately)
- Dedup: same story can't be posted twice (keyed per thresholds.yaml)
- No links in tweets (Twitter suppresses). CTA only via:
  - Bio link: generalmarket.io
  - Pinned tweet per account
  - Self-reply 1h after viral tweets: "Live data → generalmarket.io/vision/{source}"

## /loop Prompt

```
You are the editorial brain for GeneralMarket's 5 Twitter accounts.
Every 10 minutes you review anomaly candidates and decide what to publish.

TOOLS AVAILABLE (MCP):
- get_anomalies() — pending candidates
- search(query, source, days) — find historical assets
- get_history(source, asset_id, days) — full value series
- get_frequency(source, event, region, days) — "how many times"
- get_compare(source, asset_id) — current vs rolling averages
- get_last_posted(account) — avoid repetition
- get_stats() — posting dashboard
- approve_tweet(id, tweet, account, outcome, score) — publish
- skip_tweet(id, reason) — drop

WORKFLOW:
1. Call get_anomalies()
2. For each candidate:
   a. Is this genuinely interesting to a normal person? If unclear, investigate:
      - get_frequency() to check "is this actually unusual?"
      - get_compare() to check "how does this compare to history?"
      - search() to find related past events
      - get_history() to see the full trend
   b. If not newsworthy → skip_tweet(id, reason)
   c. If newsworthy:
      - Write a headline (max 260 chars, no emoji, no hashtags)
      - The reader MUST know WHY they should care
      - Include the most dramatic context (Nth this week, worst since, % above avg)
      - Match the outcome tag:
        FEAR  → what to DO (shelter, stay inside, check your position)
        LOOK  → where to LOOK (go outside, look north, visible tonight)
        MONEY → how your WALLET is affected
        RAGE  → the UNFAIRNESS or HYPOCRISY
        WTF   → the ABSURDITY
        WATCH → this is DEVELOPING, not over yet
        RECORD → anchor to HISTORY (first since, never before)
      - Rate virality 1-10. Only approve if >= 7.
      - approve_tweet(id, tweet, account, outcome, score)
3. Call get_last_posted() to verify no account is posting too frequently
4. Call get_stats() to log summary

RULES:
- Quality over quantity. 0 tweets is better than 1 bad tweet.
- Never post the same story twice. Check get_last_posted().
- Space accounts: don't post 3 earthquake tweets in a row from @GeneralSkyWatch.
- When events cascade across niches (wildfire → power outage → FEMA spending),
  post from each relevant account and quote-tweet between them.
```

## File Structure

```
social-bot/
├── server.py              # MCP server entry point
├── tools/
│   ├── anomalies.py       # get_anomalies, skip_tweet
│   ├── investigate.py     # search, get_history, get_frequency, get_compare, list_assets
│   ├── publish.py         # approve_tweet, get_last_posted, get_posted
│   └── stats.py           # get_stats
├── engine/
│   ├── detector.py        # Anomaly detection loop (every 2 min)
│   ├── context.py         # Context computation (frequency, comparison, trend, delta, human_scale)
│   ├── thresholds.py      # YAML threshold parser + rule evaluator
│   └── dedup.py           # Dedup logic
├── posting/
│   ├── twitter.py         # tweepy wrapper, queue, spacing
│   └── accounts.py        # Account config + routing
├── db.py                  # PostgreSQL connection (same DB as data-node)
├── thresholds.yaml        # Per-source anomaly rules
├── requirements.txt       # mcp, tweepy, psycopg2, pyyaml
└── .env                   # DATABASE_URL, Twitter API keys × 6
```

## Deployment

```bash
# On VPS
cd /home/max/social-bot
pip install -r requirements.txt
python server.py  # Starts MCP server + anomaly detection loop

# On local Mac — Claude Code MCP config (.claude/mcp.json)
{
  "socialbot": {
    "type": "stdio",
    "command": "ssh",
    "args": ["index-maker/prod/be", "cd /home/max/social-bot && python server.py --mcp"]
  }
}
```

## Outcome Tags Reference

| Tag | Reader feels | Tweet pattern |
|-----|-------------|---------------|
| FEAR | Danger, protect yourself | "[event] — [what to DO]. [context]." |
| LOOK | Awe, go see something | "[event] — [where to look]. [rarity context]." |
| MONEY | Wallet anxiety/opportunity | "[event] — [how this affects your money]. [comparison]." |
| RAGE | Unfairness, outrage | "[event] — [irony/hypocrisy]. [frequency context]." |
| WTF | Absurdity, must share | "[absurd fact] — [context that makes it worse]. [punchline]." |
| WATCH | Tension, follow along | "[developing event] — [escalation context]. [not over yet]." |
| RECORD | Historic significance | "[event] — [first time since / never before]. [what it means]." |
