# Adding a Data Source

Step-by-step guide for adding a new market data source to the platform. Every source follows the same pattern — implement a Rust trait, register it in ~6 backend files and ~7 frontend files.

But the hard part isn't the wiring — it's **deciding what to track and how to split feeds**. Read the design section first.

---

## Part 1: Design — What Makes a Good Data Feed

### The Goal

We want data feeds that **change often** and **are interesting to bet on**. The ideal feed updates every few minutes and has a clear numeric value that moves up/down over time.

### Choosing What to Track

Ask yourself: **"What number changes and is fun to watch?"**

| Source type | Good feeds | Bad feeds |
|-------------|-----------|-----------|
| Live events | Score per team, maps won | "Is the match over?" (boolean) |
| Streaming | Viewer count right now | Total lifetime views (barely moves) |
| Social | Upvotes, comment count | Post text (not numeric) |
| Prediction | Probability (0-1) | Market description |
| Geophysical | Alert level, magnitude | Event location (static) |
| Transport | Aircraft count in airspace | Aircraft tail number |
| Packages | Daily downloads | Total downloads (monotonic, boring) |
| Prices | Spot price in USD | Historical price (need live) |

### How Many Feeds Per Thing?

Split a real-world object into multiple feeds when the sub-values update independently:

| Source | Real-world thing | Feeds per thing | Why |
|--------|-----------------|-----------------|-----|
| **Sports** | 1 game | 3 — home score, away score, total | Each team scores independently |
| **Esports** | 1 match | 2-3 — team1 maps, team2 maps, maps progress | Map wins update per game |
| **HackerNews** | 1 story | 2 — score (upvotes), comments | Different engagement signals |
| **Twitch** | 1 streamer | 1 — viewer count | One meaningful metric |
| **Polymarket** | 1 market | 1 — "Yes" probability | "No" = 1 - yes (redundant) |
| **Weather alerts** | whole US | 20 — total, max severity, per-type, per-region | Different aggregation cuts |
| **Volcano** | 1 volcano | 1 — alert level (0-3) | Single enum value |
| **Flights** | 1 airspace | 1 — aircraft count | Single aggregate |
| **NPM** | 1 package | 1 — daily downloads | Single metric |

**Rule of thumb:** If splitting would create redundant or derivable feeds, don't split. If each sub-feed tells a different story, split.

### Static vs Dynamic Discovery

| Strategy | When to use | Config JSON | Examples |
|----------|------------|-------------|---------|
| **Static** | Fixed, curated list of things | Populated JSON array | Crypto (10K coins), volcanoes (50), flights (25 regions) |
| **Dynamic** | Things appear/disappear at runtime | `[]` | Sports games, HN stories, Twitch streams, esports matches |
| **Hybrid** | Config as default, API for extras | Populated + `discover_upstream_assets()` | CoinGecko (static list, dynamic discovery for new coins) |

Dynamic is better when:
- Supply is organic (new matches start, stories trend, streamers go live)
- The set changes hourly/daily
- Manual curation can't keep up

Static is better when:
- The list is stable (volcanoes don't appear overnight)
- You want editorial control over what's tracked
- The API doesn't have a "list all" endpoint

### Sync Interval Strategy

The sync interval depends on how fast the underlying data changes:

| Data nature | Interval | Examples | Reasoning |
|------------|----------|---------|-----------|
| **Live scores/streams** | 1-5 min | Twitch (60s), esports (300s), HN (300s) | Viewers/scores change constantly |
| **Market prices** | 1 min | CoinGecko (60s), Polymarket (300s) | Price moves matter in real-time |
| **Periodic readings** | 5-10 min | Sports (600s), weather (300s), volcano (600s), flights (300s) | Updates meaningful on ~5min scale |
| **Daily/slow data** | 30-60 min | NPM (1800s), wildfire (1800s), epidemic (1800s) | Underlying data updates daily |
| **Macro/scheduled** | Use `ScheduledSyncEngine` | FRED, ECB, BLS | Data releases at known times |

**Rate limit budget check:** `(requests_per_sync × syncs_per_hour)` must be well under the API hourly limit. Leave 10-20% headroom.

### Lifecycle — When Things Disappear

Every dynamic source needs a disappearance strategy:

| Strategy | How it works | Used by |
|----------|-------------|---------|
| **Scoreboard falloff** | If the API stops returning it, it's gone | Sports, esports |
| **Status filter** | Only fetch active/open/running; resolved ones filtered out | Polymarket, weather alerts |
| **Rank cutoff** | Only track top N; things that fall below drop off | HackerNews (top 500), Twitch (min 100 viewers) |
| **Never disappear** | Static list, always tracked | Crypto, volcanoes, flights |
| **TTL/cache expiry** | Keep tracking for X days after last seen, then prune | Twitch (30d peak cache) |

The sync engine handles this automatically: if `fetch_assets()` stops returning an asset, it gets marked inactive in the DB. No manual cleanup.

---

## Part 2: Implementation Patterns (by example)

### Pattern A: Single API call → fan out to many feeds

**Best for:** Sources where one API call returns all the data you need.

**Examples:** Volcano (1 call → 50 volcanoes), Flights (1 call → 25 regions), Weather alerts (1 call → 20 metrics)

```
fetch_prices:
  1. GET /api/all-data           ← one call
  2. for each asset_id requested:
       look up value in response  ← in-memory, zero API cost
  3. return all prices
```

**Why it's good:** Minimal API calls. If you have 50 assets but one endpoint, you burn 1 request per sync, not 50.

**Flights example:** One call to `adsb.lol/v2/all` returns every aircraft globally. Then count per region by checking lat/lon against bounding boxes. 25 feeds, 1 request.

### Pattern B: Paginated discovery → grouped price fetches

**Best for:** Sources where you first discover what to track, then fetch prices by group.

**Examples:** Sports (12 leagues), Esports (running + upcoming pages), Twitch (streams + games)

```
fetch_assets:
  1. for each group (league/game/category):
       GET /api/group/{id}/items  ← one call per group
       parse items into assets
  2. return all assets

fetch_prices:
  1. group asset_ids by group key (parse from asset_id)
  2. for each group needed:
       GET /api/group/{id}/items  ← one call per group, same as above
       extract values for requested assets
  3. return prices
```

**Why it's good:** Number of API calls = number of groups, not number of assets. Sports has 300 games but only 12 league fetches.

**Key trick:** Parse the group key from the asset_id. Sports uses `sport_{league}_{game}_{metric}` — the league code tells you which scoreboard to fetch.

### Pattern C: Batch IDs in one request

**Best for:** APIs that accept comma-separated IDs.

**Examples:** CoinGecko (100 coin IDs per request), NPM (128 packages per request), Twitch (100 user IDs per request)

```
fetch_prices:
  1. chunk asset_ids into batches of N
  2. for each batch:
       GET /api/prices?ids=a,b,c,...  ← one call per batch
       parse response
  3. return prices
```

**Why it's good:** 10,000 coins ÷ 100 per batch = 100 requests instead of 10,000.

**Watch out for:** URL length limits (CoinGecko caps at 100 despite supporting 500), scoped names that need encoding (NPM `@babel/core`).

### Pattern D: Rolling cursor (one-at-a-time APIs)

**Best for:** APIs that only accept a single ID per request and you have hundreds/thousands of assets. Too many to fetch all in one sync cycle.

**Examples:** Finnhub stocks (780 tickers, 1 request each, 60 req/min limit)

```
struct MySource {
    batch_cursor: Mutex<usize>,  // persists across sync calls
}

fetch_prices(asset_ids):
  1. lock cursor, read position
  2. slice asset_ids[cursor .. cursor+BATCH_SIZE]
  3. advance cursor (wrap to 0 at end)
  4. for each id in batch:
       GET /api/quote?symbol={id}    ← one call per asset
       sleep(1050ms)                  ← stay under rate limit
  5. return batch results (NOT all assets — just this batch)
```

**How it works:** The sync engine calls `fetch_prices()` every few seconds (Finnhub uses 5s). Each call only fetches 55 stocks, taking ~58 seconds. Then the next call picks up where it left off. After 14 calls (~70s × 14 ≈ 16 minutes), all 780 stocks have been updated once.

**Why it's good:** Produces a continuous stream of price updates instead of a big burst followed by silence. Stays within tight rate limits (Finnhub free: 60 req/min). The sync engine's change detection still works — it only inserts when the price actually changed.

**Key details:**
- `sync_interval` is tiny (5s) — just a pause between batches, not the full-cycle time
- `batch_cursor` is a `Mutex<usize>` — thread-safe, persists across calls
- Cursor wraps to 0 when it reaches the end of the list
- Cursor resets to 0 if the asset list shrinks (defensive)
- Each request has a 1050ms sleep so 55 requests ≈ 58s, just under the 60 req/min limit

**Math:** `assets ÷ batch_size × (batch_size × per_request_delay)` = full cycle time. For Finnhub: `780 ÷ 55 × 58s ≈ 14 × 58s ≈ 13.5 minutes` to update all stocks.

### Pattern E: Scheduled sync (event-driven, not interval-driven)

**Best for:** Data that publishes at known times (FRED at 6PM ET, ECB at 2:15PM CET, BLS on release day).

**Examples:** FRED (interest rates), ECB (exchange rates), BLS (employment data)

Uses `ScheduledMarketDataSource` trait instead of the base trait, and `ScheduledSyncEngine` instead of `SyncEngine`:

```rust
impl ScheduledMarketDataSource for FredMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // FRED publishes at ~4-6 PM ET, fetch at 6 PM and 7 PM
        // Returns the exact UTC timestamp for the next fetch
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_us_market_closed(now)  // skip weekends & holidays
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        if is_fomc_day(now) {
            // FOMC announces at 2 PM ET — burst every 5 min from 2-6 PM
            Some(Duration::from_secs(300))
        } else {
            None
        }
    }
}
```

**How it works:** Instead of polling every N seconds, the engine sleeps until `next_fetch_time()`. On special days (FOMC, ECB meetings), `burst_mode()` returns a short interval for rapid polling during the announcement window. On weekends/holidays, `should_skip_today()` returns true and the engine sleeps until tomorrow.

**When to use this over `SyncEngine`:** When the data has a known release schedule and polling between releases is wasteful.

### Pattern F: Full list re-fetch each sync

**Best for:** Sources where the "list" endpoint already includes current values.

**Examples:** Polymarket (market list includes prices), Esports (match list includes scores)

```
fetch_prices:
  1. GET /api/markets?status=active  ← re-fetch the full list
  2. build HashMap<id, value>
  3. for each requested asset_id:
       look up in map
  4. return prices
```

**Why it's good:** Simple. No separate "get prices" endpoint needed. The discovery endpoint IS the price endpoint.

**Tradeoff:** Fetches data for assets you don't need. Fine if the list is small (hundreds). Bad if the list is huge (millions).

---

## Part 3: Wiring — File-by-File Checklist

### Architecture Overview

```
data-node/src/market_data/sources/{source}/client.rs   ← implements MarketDataSource trait
                                            mod.rs     ← re-exports
data-node/src/config/{source}.json                     ← static asset list (or empty [] for dynamic)
data-node/src/market_data/sources/mod.rs               ← module + re-export
data-node/src/main.rs                                  ← spawn sync engine via spawn_resilient()
data-node/src/api.rs                                   ← SOURCE_META table
data-node/src/config.rs                                ← CLI args (only if API-key-gated)
start.sh                                               ← pass env vars (only if API-key-gated)
contracts/script/DeployAllVisionBatches.s.sol           ← register in _getSourceNames() + bump array sizes
```

**Write pipeline:** Sources don't write to the DB directly. A central `BatchWriter` collects all price updates via a shared write channel (`price_writer`) and writes them in batches. A `PriceBroadcastHub` streams live updates to WebSocket clients. Both are initialized once in `run_serve()` and passed to every `SyncEngine`/`ScheduledSyncEngine`.

Frontend picks up the source automatically via the `/admin/sources/health` API, but you need to register prefixes and display metadata for proper categorization.

### Backend

#### 1. Create the source directory

```
data-node/src/market_data/sources/{source}/
├── mod.rs
└── client.rs
```

**mod.rs** — always the same:
```rust
pub mod client;
pub use client::MyMarketSource;
```

**client.rs** — implement `MarketDataSource`:
```rust
#[async_trait::async_trait]
impl MarketDataSource for MySource {
    fn source_id(&self) -> &'static str { "my_source" }        // unique ID, used everywhere
    fn display_name(&self) -> &'static str { "My Source Name" } // shown in /sources UI
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(300) } // how often to poll
    fn rate_limit_config(&self) -> RateLimitConfig { /* API rate limits */ }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>>;   // what to track
    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>>; // current values
}
```

Asset IDs must be prefixed with the source name: `mysource_item_123`. This prefix is used by the frontend for categorization.

#### 2. Create config JSON

**File:** `data-node/src/config/{source}.json`

For dynamic sources: `[]`

For static sources:
```json
[
  {
    "asset_id": "mysource_bitcoin",
    "symbol": "BTC",
    "name": "Bitcoin",
    "category": "crypto",
    "subcategory": "layer1",
    "api_ref": "bitcoin",
    "active": true
  }
]
```

Valid categories: `stocks`, `crypto`, `defi`, `macro`, `commodities`, `weather`, `onchain`, `sentiment`, `regulatory`, `geophysical`, `space`, `environment`, `transport`, `health`, `sports`, `defense`, `government`, `animals`.

#### 3. Register module in sources/mod.rs

**File:** `data-node/src/market_data/sources/mod.rs`

```rust
// Module declaration (grouped with similar sources)
pub mod my_source;

// Re-export (at the bottom, grouped with similar sources)
pub use my_source::MyMarketSource;
```

#### 4. Spawn sync engine in main.rs

**File:** `data-node/src/main.rs` — inside `run_serve()`

All sources are wrapped in `spawn_resilient()` which auto-restarts on panic/exit with exponential backoff. The `SyncEngine` takes 4 parameters: pool, source, broadcast_hub (`bh`), and price_writer (`pw`) — these are already initialized at the top of `run_serve()`.

**Always-on source (no API key needed):**
```rust
{
    let pool_c = pool.clone();
    let bh = broadcast_hub.clone();
    let pw = price_writer.clone();
    spawn_resilient("my_source", pw.clone(), move || {
        let pool_c = pool_c.clone();
        let bh = bh.clone();
        let pw = pw.clone();
        async move {
            match market_data::sources::my_source::MyMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh, pw);
                    engine.run().await;
                }
                Err(e) => {
                    tracing::error!("MySource init failed: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                }
            }
        }
    });
    info!("MySource started");
}
```

**API-key-gated source:**
```rust
if let Some(ref key) = args.my_source_api_key {
    std::env::set_var("MY_SOURCE_API_KEY", key);
    let pool_c = pool.clone();
    let bh = broadcast_hub.clone();
    let pw = price_writer.clone();
    spawn_resilient("my_source", pw.clone(), move || {
        let pool_c = pool_c.clone();
        let bh = bh.clone();
        let pw = pw.clone();
        async move {
            match market_data::sources::my_source::MyMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh, pw);
                    engine.run().await;
                }
                Err(e) => {
                    tracing::error!("MySource init failed: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                }
            }
        }
    });
    info!("MySource started");
}
```

**For schedule-aware sources** (data with known release times), use `ScheduledSyncEngine` instead:
```rust
let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source), bh, pw);
```

#### 5. Add to SOURCE_META in api.rs

**File:** `data-node/src/api.rs` — find the `SOURCE_META` array

```rust
("my_source", "My Source Display Name", 300),  // sync interval in seconds
```

#### 6. (If API-key-gated) CLI arg, error tracking, start script

**File:** `data-node/src/config.rs` — add to `ServeArgs` struct:
```rust
/// My Source API key (enables my data)
#[arg(long, env = "MY_SOURCE_API_KEY")]
pub my_source_api_key: Option<String>,
```

**File:** `data-node/src/main.rs` — add to `record_not_started` block:
```rust
if args.my_source_api_key.is_none() {
    tracker.record_not_started("my_source", "Missing --my-source-api-key");
}
```

**File:** `start.sh` — add conditional flag in the data-node launch section:
```bash
${MY_SOURCE_API_KEY:+--my-source-api-key "$MY_SOURCE_API_KEY"}
```

#### 6b. Register in Vision batch deploy script

**File:** `contracts/script/DeployAllVisionBatches.s.sol`

1. Add the source name to `_getSourceNames()`:
```solidity
names[N] = "my_source";
```

2. **Bump the array size** in `_getSourceNames()` return type AND `_exportBatchMapping()` parameter:
```solidity
// Both must match: old count + 1
function _getSourceNames() internal pure returns (string[N+1] memory names) {
// ...
function _exportBatchMapping(string[N+1] memory sourceNames, ...
```

This registers the source for on-chain Vision batch creation. Without this, the source won't get a batch pool.

### Frontend

#### 7. Market category prefix mapping

**File:** `frontend/lib/vision/market-categories.ts`

Add to `PREFIX_MAP`:
```typescript
['mysource_', 'my_source', 'My Source'],
```

Add to `CATEGORY_ORDER`:
```typescript
const CATEGORY_ORDER = [
  'crypto', 'stocks', /* ... */, 'my_source', 'other',
]
```

#### 8. Source registry entry

**File:** `frontend/lib/vision/sources.ts`

Add to the `VISION_SOURCES` array using the `S()` helper. The interface requires `valueLabel`, `valueUnit`, and optionally `isPrice`:
```typescript
S('my_source', 'My Source', 'Description here.', 'transport', '/source-imgs/new-mysource.svg', '#f5f5f5', ['mysource_'], 'Avg Delay', 'min'),
```

The `S()` helper signature:
```typescript
S(id, name, description, category, logo, brandBg, prefixes, valueLabel, valueUnit, isPrice?)
```

- `valueLabel` — column header in markets table (e.g. `'Price'`, `'Avg Delay'`, `'Viewers'`, `'Magnitude'`)
- `valueUnit` — unit shown in parentheses (e.g. `'USD'`, `'min'`, `'%'`, `'0-9'`)
- `isPrice` — if `true`, values are formatted with `$` prefix (set for USD-denominated sources)

Also add a logo to `frontend/public/source-imgs/`. See the **Logo Requirements** section below.

> **Note:** `formatMarketName()` is centralized in `market-categories.ts` and auto-strips the prefix using `PREFIX_MAP`. No per-source formatting code needed.

#### 8b. Source logo

**File:** `frontend/public/source-imgs/new-{source}.svg` (or `.png`)

**NEVER create logos yourself.** Find the company's real logo and brand assets:

1. **Search for official brand/press kits** — most companies publish logo files:
   - `{company} press kit logo`
   - `{company} brand assets download`
   - `{company} media kit SVG`
   - Wikipedia article → Infobox → logo file (often SVG)
2. **Download the real logo** — use the official mark, wordmark, or icon. SVG preferred (vector, small file). PNG okay if no SVG exists.
3. **Check color contrast against `brandBg`.** The logo must be clearly visible on the `brandBg` color set in `sources.ts`. Common mistakes:
   - White logo on `#f5f5f5` background → invisible. Use the colored version or set `brandBg` to a dark brand color.
   - Dark logo on dark background → invisible. Use the white/light version or lighten `brandBg`.
   - Test: squint at the card — if the logo disappears, fix the contrast.
4. **Format:**
   - SVG preferred (sharp at any size, small file). See `new-dbtrains.svg` for reference: brand icon + wordmark, `viewBox="0 0 300 80"`.
   - PNG: minimum 256px wide, transparent background, under 50KB. See `new-coingecko.png` (2000×438).
   - Avoid JPEGs (no transparency).
5. **Naming:** `new-{source_id}.svg` or `new-{source_id}.png` — must match the `logo` path in the `VISION_SOURCES` entry.

**Examples of good logos:**
| Source | File | How obtained |
|--------|------|-------------|
| DB Trains | `new-dbtrains.svg` | DB red badge + "Deutsche Bahn" wordmark in official DB Red (#ec0016) |
| CoinGecko | `new-coingecko.png` | Official gecko logo from CoinGecko press page |
| Steam | `new-steam.png` | Official Steam logo from Valve brand resources |

**Do NOT:**
- Generate logos with AI or hand-draw SVG text that says "RYANAIR" in a rectangle
- Use screenshots of websites as logos
- Use favicon.ico files (too small, pixelated)

#### 9. Vision markets grid category

**File:** `frontend/components/domain/vision/VisionMarketsGrid.tsx`

Add source to appropriate `CATEGORY_GROUPS` entry:
```typescript
{ id: 'entertainment', label: 'Entertainment', sources: [..., 'my_source'] },
```

If values are not denominated in dollars, also add to `COUNT_SOURCES`:
```typescript
const COUNT_SOURCES = new Set([..., 'my_source'])
```

#### 10. Source detail modal metadata

**File:** `frontend/components/domain/SourceDetailModal.tsx`

Add to `SOURCE_META`:
```typescript
my_source: { valueLabel: 'Viewers', unit: 'live' },
```

Or with per-asset conditional units:
```typescript
my_source: {
  valueLabel: 'Activity', unit: '',
  assetUnit: (name) => {
    if (/score/i.test(name)) return 'pts'
    return 'count'
  },
},
```

#### 11. Source health table API link

**File:** `frontend/components/domain/SourceHealthTable.tsx`

Add to the `API_KEY_LINKS` object (only if the source needs an API key):
```typescript
my_source: { url: 'https://example.com/api', label: 'My Source API' },
```

---

## Part 4: Existing Sources Reference

### Quick reference: what each source does and why

| Source | Sync | Assets | Value | Feeds/thing | Discovery | Pattern |
|--------|------|--------|-------|-------------|-----------|---------|
| **CoinGecko** | 60s | 10K coins | USD price | 1 | Static config | Batch IDs (100/req) |
| **Sports** | 10min | ~50 games | Score (pts) | 3 (home/away/total) | Dynamic scoreboard | Grouped by league |
| **Esports** | 5min | ~50 matches | Maps won | 2-3 (t1/t2/maps) | Dynamic running+upcoming | Full list re-fetch |
| **Twitch** | 60s | 7K streams+games | Viewers | 1 | Dynamic top N | Batch IDs (100/req) |
| **HackerNews** | 5min | 500 stories | Score or comments | 2 (score/comments) | Dynamic top 500 | Sequential item fetch |
| **Polymarket** | 5min | ~500 markets | Probability (0-1) | 1 | Dynamic active list | Full list re-fetch |
| **NPM** | 30min | 3-5K packages | Daily downloads | 1 | Dynamic search | Batch IDs (128/req) |
| **Flights** | 5min | 25 regions | Aircraft count | 1 | Static config | Single call → fan out |
| **Volcano** | 10min | 50 volcanoes | Alert level (0-3) | 1 | Static config | Single call → fan out |
| **Weather alerts** | 5min | 20 metrics | Alert count | 20 (types+regions) | Static config | Single call → aggregate |
| **Chaturbate** | 60s | ~200 models | Viewers | 1 | Dynamic top N | Full list re-fetch |
| **Reddit** | 10min | ~100 subs | Active users | 1 | Dynamic top N | Full list re-fetch |

### Rate limit budgets

| Source | API limit | Our setting | Requests/sync | Syncs/hr | Actual usage/hr |
|--------|-----------|------------|---------------|----------|-----------------|
| CoinGecko | 500/min | 400/min | ~100 | 60 | ~6000 (burst at start) |
| PandaScore | 1000/hr | 800/hr | ~4-6 | 12 | ~48-72 |
| Twitch | 800/min | 720/min | ~70 | 60 | ~4200 (burst) |
| ESPN | undocumented | 30/min | 12 | 6 | ~72 |
| HN | undocumented | 1000/min | ~500 | 12 | ~6000 |
| NPM | undocumented | 2550/10min | ~40 | 2 | ~80 |

### Name & label conventions

The `name` field in `AssetUpdate` is what users see in the UI. Make it scannable:

| Source | Name format | Example |
|--------|------------|---------|
| Sports | `{Away} vs {Home} ({metric}) [{League}]` | `Celtics vs Lakers (home) [NBA]` |
| Esports | `{T1} vs {T2} ({team} {score}) [{Game} / {League}]` | `ELE vs HOLY (ELE 1) [CS2 / VCL]` |
| HackerNews | `{title (80ch)} ({metric})` | `Show HN: I built... (score)` |
| Twitch | `{streamer_name} ({game})` | `xQc (Just Chatting)` |
| Polymarket | `{question (200ch)}` | `Will Bitcoin hit $100K by Dec?` |
| NPM | `{package_name}` | `react` |
| Flights | `{airport/region} airspace` | `JFK airspace` |

---

## Copy-Paste Checklist

```
BACKEND:
[ ] data-node/src/market_data/sources/{source}/client.rs  — implement MarketDataSource
[ ] data-node/src/market_data/sources/{source}/mod.rs     — pub mod client; pub use ...
[ ] data-node/src/config/{source}.json                    — asset list or []
[ ] data-node/src/market_data/sources/mod.rs              — pub mod + pub use
[ ] data-node/src/main.rs                                 — spawn_resilient() with SyncEngine(pool, source, bh, pw)
[ ] data-node/src/api.rs                                  — add to SOURCE_META

IF API-KEY-GATED:
[ ] data-node/src/config.rs                               — add CLI arg to ServeArgs
[ ] data-node/src/main.rs                                 — add record_not_started()
[ ] start.sh                                              — add conditional --flag

CONTRACTS:
[ ] contracts/script/DeployAllVisionBatches.s.sol          — add to _getSourceNames() + bump array sizes

FRONTEND:
[ ] frontend/public/source-imgs/new-{source}.svg          — REAL company logo (NOT hand-drawn, check contrast vs brandBg)
[ ] frontend/lib/vision/market-categories.ts              — PREFIX_MAP + CATEGORY_ORDER
[ ] frontend/lib/vision/sources.ts                        — S() entry with valueLabel, valueUnit, isPrice
[ ] frontend/components/domain/vision/VisionMarketsGrid.tsx — CATEGORY_GROUPS + COUNT_SOURCES
[ ] frontend/components/domain/SourceDetailModal.tsx       — SOURCE_META (valueLabel + unit + optional assetUnit)
[ ] frontend/components/domain/SourceHealthTable.tsx       — API_KEY_LINKS (if API-key-gated)

VERIFY:
[ ] cargo check                                           — backend compiles
[ ] cargo test {source}                                   — unit tests pass
[ ] npx tsc --noEmit (in frontend/)                       — frontend compiles
[ ] test actual API endpoint                              — curl returns valid data
```

---

## Tips

- **Asset ID prefixes matter.** The frontend uses them for automatic categorization. Use `{source}_` as prefix for all asset IDs.
- **Dynamic sources are simpler to set up** — no config JSON to maintain. The sync engine handles asset lifecycle automatically.
- **The database is generic.** No migrations needed. All sources share `market_assets` and `market_prices` tables with a `source` column.
- **Rate limiting is built in.** Use `SourceHttpClient` with `RateLimitConfig` — it handles retry, backoff, and rate limit windows.
- **The frontend is gracefully degradable.** Missing frontend entries just mean assets show up under "Other" with generic labels. Backend-only is fine for testing.
- **Partial data > no data.** If one API call fails, emit what you have. Never fake zeros for missing data — just skip.
- **Group API calls by key.** Parse a group key from the asset_id (league, game, category) and make one call per group, not per asset.
- **Leave 10-20% rate limit headroom.** Set your config at 80-90% of the actual API limit. The HTTP client handles bursts and retries within this budget.
