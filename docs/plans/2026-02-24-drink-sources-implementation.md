# Drink Data Sources Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two new data sources — Yahoo Finance drink commodities/stocks and Untappd beer social data — following the existing codebase patterns.

**Architecture:** Yahoo Finance uses direct HTTP to Yahoo v8 chart API (no auth, static 12 tickers, Pattern A fan-out). Untappd uses dynamic discovery via trending/search endpoints + `/beer/info` enrichment (API-key-gated, client_id + client_secret).

**Tech Stack:** Rust (async-trait, reqwest via SourceHttpClient, serde, rust_decimal), TypeScript/React frontend wiring.

---

### Task 1: Create Yahoo Finance drink commodities backend source

**Files:**
- Create: `data-node/src/market_data/sources/yahoo_drinks/mod.rs`
- Create: `data-node/src/market_data/sources/yahoo_drinks/client.rs`
- Create: `data-node/src/config/yahoo_drinks.json`

**Step 1: Create the config JSON**

Create `data-node/src/config/yahoo_drinks.json`:

```json
[
  {"asset_id": "yahoodrinks_kc_f", "symbol": "DRINK/COFFEE", "name": "Coffee Arabica Futures (KC=F)", "category": "commodities", "subcategory": "drink_futures", "api_ref": "KC=F", "active": true},
  {"asset_id": "yahoodrinks_sb_f", "symbol": "DRINK/SUGAR", "name": "Sugar #11 Futures (SB=F)", "category": "commodities", "subcategory": "drink_futures", "api_ref": "SB=F", "active": true},
  {"asset_id": "yahoodrinks_cc_f", "symbol": "DRINK/COCOA", "name": "Cocoa Futures (CC=F)", "category": "commodities", "subcategory": "drink_futures", "api_ref": "CC=F", "active": true},
  {"asset_id": "yahoodrinks_oj_f", "symbol": "DRINK/OJ", "name": "Orange Juice Futures (OJ=F)", "category": "commodities", "subcategory": "drink_futures", "api_ref": "OJ=F", "active": true},
  {"asset_id": "yahoodrinks_ko", "symbol": "DRINK/KO", "name": "Coca-Cola (KO)", "category": "stocks", "subcategory": "drink_stocks", "api_ref": "KO", "active": true},
  {"asset_id": "yahoodrinks_pep", "symbol": "DRINK/PEP", "name": "PepsiCo (PEP)", "category": "stocks", "subcategory": "drink_stocks", "api_ref": "PEP", "active": true},
  {"asset_id": "yahoodrinks_stz", "symbol": "DRINK/STZ", "name": "Constellation Brands (STZ)", "category": "stocks", "subcategory": "drink_stocks", "api_ref": "STZ", "active": true},
  {"asset_id": "yahoodrinks_sam", "symbol": "DRINK/SAM", "name": "Boston Beer Company (SAM)", "category": "stocks", "subcategory": "drink_stocks", "api_ref": "SAM", "active": true},
  {"asset_id": "yahoodrinks_bf_b", "symbol": "DRINK/BFB", "name": "Brown-Forman Spirits (BF-B)", "category": "stocks", "subcategory": "drink_stocks", "api_ref": "BF-B", "active": true},
  {"asset_id": "yahoodrinks_deo", "symbol": "DRINK/DEO", "name": "Diageo Spirits (DEO)", "category": "stocks", "subcategory": "drink_stocks", "api_ref": "DEO", "active": true},
  {"asset_id": "yahoodrinks_tap", "symbol": "DRINK/TAP", "name": "Molson Coors (TAP)", "category": "stocks", "subcategory": "drink_stocks", "api_ref": "TAP", "active": true},
  {"asset_id": "yahoodrinks_sbux", "symbol": "DRINK/SBUX", "name": "Starbucks (SBUX)", "category": "stocks", "subcategory": "drink_stocks", "api_ref": "SBUX", "active": true}
]
```

**Step 2: Create mod.rs**

Create `data-node/src/market_data/sources/yahoo_drinks/mod.rs`:

```rust
pub mod client;
pub use client::YahooDrinksMarketSource;
```

**Step 3: Create client.rs**

Create `data-node/src/market_data/sources/yahoo_drinks/client.rs`:

```rust
//! Yahoo Finance drink commodities & beverage stocks.
//!
//! Tracks coffee/sugar/cocoa/OJ futures and major beverage company stocks.
//! Uses Yahoo Finance unofficial v8 chart API (no auth needed).
//! Pattern A: sequential ticker fetch, fan-out from API responses.

use std::collections::HashMap;
use std::time::Duration;

use anyhow::Result;
use rust_decimal::Decimal;
use chrono::Utc;
use serde::Deserialize;
use tracing::{info, warn};

use crate::market_data::sources::http_client::{RateLimitConfig, RateWindow, RetryConfig, SourceHttpClient};
use crate::market_data::traits::{load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate};

const ASSET_JSON: &str = include_str!("../../../config/yahoo_drinks.json");

const YAHOO_CHART_URL: &str = "https://query2.finance.yahoo.com/v8/finance/chart";

/// Delay between sequential ticker fetches (ms) to avoid Yahoo rate limiting.
const INTER_REQUEST_DELAY_MS: u64 = 500;

// ── Yahoo v8 chart response types ──

#[derive(Debug, Deserialize)]
struct YahooChartResponse {
    chart: Option<YahooChart>,
}

#[derive(Debug, Deserialize)]
struct YahooChart {
    result: Option<Vec<YahooChartResult>>,
}

#[derive(Debug, Deserialize)]
struct YahooChartResult {
    meta: Option<YahooChartMeta>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct YahooChartMeta {
    regular_market_price: Option<f64>,
    previous_close: Option<f64>,
    regular_market_volume: Option<f64>,
    chart_previous_close: Option<f64>,
}

// ── Source implementation ──

pub struct YahooDrinksMarketSource {
    http: SourceHttpClient,
}

impl YahooDrinksMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 300,
                duration: Duration::from_secs(3600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Yahoo Finance drink commodities source initialized");
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for YahooDrinksMarketSource {
    fn source_id(&self) -> &'static str { "yahoo_drinks" }
    fn display_name(&self) -> &'static str { "Yahoo Drink Markets" }
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(600) }
    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 300,
                duration: Duration::from_secs(3600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("Yahoo drinks fetch_assets: {} assets loaded", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() { return Ok(Vec::new()); }
        let now = Utc::now();

        // Build asset_id → api_ref lookup from config
        let entries: Vec<crate::market_data::traits::AssetEntry> =
            serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, String> = entries
            .into_iter()
            .filter(|e| e.active)
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let ticker = match ref_map.get(asset_id) {
                Some(t) => t,
                None => {
                    warn!("Yahoo drinks: unknown asset_id {}", asset_id);
                    continue;
                }
            };

            // URL-encode ticker (KC=F → KC%3DF)
            let encoded = ticker.replace('=', "%3D");
            let url = format!(
                "{}/{}?interval=1d&range=1d",
                YAHOO_CHART_URL, encoded
            );

            match self.http.get_json::<YahooChartResponse>(&url).await {
                Ok(resp) => {
                    if let Some(meta) = resp.chart
                        .and_then(|c| c.result)
                        .and_then(|r| r.into_iter().next())
                        .and_then(|r| r.meta)
                    {
                        if let Some(price) = meta.regular_market_price {
                            let value = Decimal::try_from(price).unwrap_or(Decimal::ZERO);
                            let prev = meta.previous_close
                                .or(meta.chart_previous_close)
                                .and_then(|p| Decimal::try_from(p).ok());
                            let change_pct = prev.and_then(|p| {
                                if p.is_zero() { None }
                                else { Some(((value - p) / p) * Decimal::from(100)) }
                            });
                            let volume = meta.regular_market_volume
                                .and_then(|v| Decimal::try_from(v).ok());

                            results.push(PriceUpdate {
                                asset_id: asset_id.clone(),
                                symbol: format!("DRINK/{}", ticker.replace('=', "").replace('-', "")),
                                value,
                                prev_close: prev,
                                change_pct,
                                volume_24h: volume,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Err(e) => {
                    warn!("Yahoo drinks: failed to fetch {}: {:?}", ticker, e);
                }
            }

            // Rate limit: sleep between requests
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        info!("Yahoo drinks: fetched {}/{} prices", results.len(), asset_ids.len());
        Ok(results)
    }
}
```

**Step 4: Commit**

```bash
git add data-node/src/market_data/sources/yahoo_drinks/ data-node/src/config/yahoo_drinks.json
git commit -m "feat(data-node): add Yahoo Finance drink commodities source"
```

---

### Task 2: Create Untappd beer backend source

**Files:**
- Create: `data-node/src/market_data/sources/untappd/mod.rs`
- Create: `data-node/src/market_data/sources/untappd/client.rs`
- Create: `data-node/src/config/untappd.json`

**Step 1: Create empty config JSON (dynamic discovery)**

Create `data-node/src/config/untappd.json`:

```json
[]
```

**Step 2: Create mod.rs**

Create `data-node/src/market_data/sources/untappd/mod.rs`:

```rust
pub mod client;
pub use client::UntappdMarketSource;
```

**Step 3: Create client.rs**

Create `data-node/src/market_data/sources/untappd/client.rs`:

```rust
//! Untappd beer social data — check-ins, ratings, trending beers.
//!
//! API: https://api.untappd.com/v4
//! Auth: client_id + client_secret as query params.
//! Rate limit: 100 calls/hour.
//!
//! Discovery: Dynamic — /beer/trending + /search/beer?sort=checkin.
//! Feeds per beer: 4 (checkins, rating, rating_count, monthly).
//! Pattern F (full list re-fetch) + A (fan-out from /beer/info responses).

use std::collections::HashMap;
use std::time::Duration;

use anyhow::Result;
use rust_decimal::Decimal;
use chrono::Utc;
use serde::Deserialize;
use tracing::{info, warn};

use crate::market_data::sources::http_client::{RateLimitConfig, RateWindow, RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

const UNTAPPD_API: &str = "https://api.untappd.com/v4";

/// Max beers to track (keeps API calls within budget).
const MAX_BEERS: usize = 50;

/// Max beer/info calls per sync (stay under 16 calls/sync budget).
const MAX_INFO_CALLS: usize = 12;

/// Delay between API calls to spread load.
const INTER_REQUEST_DELAY_MS: u64 = 200;

// ── Untappd API response types ──

#[derive(Debug, Deserialize)]
struct UntappdResponse<T> {
    response: Option<T>,
}

// Trending response
#[derive(Debug, Deserialize)]
struct TrendingResponse {
    micro: Option<TrendingMicro>,
    macro_list: Option<TrendingMacro>,
}

#[derive(Debug, Deserialize)]
struct TrendingMicro {
    items: Option<Vec<TrendingItem>>,
}

#[derive(Debug, Deserialize)]
struct TrendingMacro {
    items: Option<Vec<TrendingItem>>,
}

#[derive(Debug, Deserialize)]
struct TrendingItem {
    beer: Option<BeerBasic>,
    brewery: Option<BreweryBasic>,
}

// Search response
#[derive(Debug, Deserialize)]
struct SearchResponse {
    beers: Option<SearchBeers>,
}

#[derive(Debug, Deserialize)]
struct SearchBeers {
    items: Option<Vec<SearchBeerItem>>,
}

#[derive(Debug, Deserialize)]
struct SearchBeerItem {
    beer: Option<BeerBasic>,
    brewery: Option<BreweryBasic>,
}

#[derive(Debug, Deserialize)]
struct BeerBasic {
    bid: Option<u64>,
    beer_name: Option<String>,
    beer_style: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BreweryBasic {
    brewery_name: Option<String>,
}

// Beer info response
#[derive(Debug, Deserialize)]
struct BeerInfoResponse {
    beer: Option<BeerDetail>,
}

#[derive(Debug, Deserialize)]
struct BeerDetail {
    bid: Option<u64>,
    beer_name: Option<String>,
    beer_style: Option<String>,
    brewery: Option<BreweryBasic>,
    stats: Option<BeerStats>,
    rating_score: Option<f64>,
    rating_count: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct BeerStats {
    total_count: Option<u64>,
    monthly_count: Option<u64>,
    total_user_count: Option<u64>,
    user_count: Option<u64>,
}

// ── Discovered beer ──

#[derive(Debug, Clone)]
struct DiscoveredBeer {
    bid: u64,
    name: String,
    brewery: String,
    style: String,
}

// ── Source implementation ──

pub struct UntappdMarketSource {
    http: SourceHttpClient,
    client_id: String,
    client_secret: String,
}

impl UntappdMarketSource {
    pub fn from_env() -> Result<Self> {
        let client_id = std::env::var("UNTAPPD_CLIENT_ID")
            .map_err(|_| anyhow::anyhow!("UNTAPPD_CLIENT_ID not set"))?;
        let client_secret = std::env::var("UNTAPPD_CLIENT_SECRET")
            .map_err(|_| anyhow::anyhow!("UNTAPPD_CLIENT_SECRET not set"))?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 80, // 20% headroom under 100/hr
                duration: Duration::from_secs(3600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Untappd beer source initialized");
        Ok(Self { http, client_id, client_secret })
    }

    fn auth_params(&self) -> String {
        format!("client_id={}&client_secret={}", self.client_id, self.client_secret)
    }

    /// Discover beers from trending + search endpoints.
    async fn discover_beers(&self) -> Vec<DiscoveredBeer> {
        let mut seen = HashMap::new();

        // 1. Trending (1 call)
        let trending_url = format!("{}/beer/trending?{}", UNTAPPD_API, self.auth_params());
        if let Ok(resp) = self.http.get_json::<UntappdResponse<TrendingResponse>>(&trending_url).await {
            if let Some(r) = resp.response {
                let items = r.micro.and_then(|m| m.items).unwrap_or_default()
                    .into_iter()
                    .chain(r.macro_list.and_then(|m| m.items).unwrap_or_default());
                for item in items {
                    if let Some(beer) = item.beer {
                        if let Some(bid) = beer.bid {
                            seen.entry(bid).or_insert(DiscoveredBeer {
                                bid,
                                name: beer.beer_name.unwrap_or_default(),
                                brewery: item.brewery.and_then(|b| b.brewery_name).unwrap_or_default(),
                                style: beer.beer_style.unwrap_or_default(),
                            });
                        }
                    }
                }
            }
        }

        tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

        // 2. Search by popularity — 2 pages (2 calls)
        for offset in [0, 25] {
            let search_url = format!(
                "{}/search/beer?q=&sort=checkin&limit=25&offset={}&{}",
                UNTAPPD_API, offset, self.auth_params()
            );
            if let Ok(resp) = self.http.get_json::<UntappdResponse<SearchResponse>>(&search_url).await {
                if let Some(r) = resp.response {
                    for item in r.beers.and_then(|b| b.items).unwrap_or_default() {
                        if let Some(beer) = item.beer {
                            if let Some(bid) = beer.bid {
                                seen.entry(bid).or_insert(DiscoveredBeer {
                                    bid,
                                    name: beer.beer_name.unwrap_or_default(),
                                    brewery: item.brewery.and_then(|b| b.brewery_name).unwrap_or_default(),
                                    style: beer.beer_style.unwrap_or_default(),
                                });
                            }
                        }
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        let mut beers: Vec<DiscoveredBeer> = seen.into_values().collect();
        beers.truncate(MAX_BEERS);
        beers
    }
}

#[async_trait::async_trait]
impl MarketDataSource for UntappdMarketSource {
    fn source_id(&self) -> &'static str { "untappd" }
    fn display_name(&self) -> &'static str { "Untappd Beer" }
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(600) }
    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 80,
                duration: Duration::from_secs(3600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let beers = self.discover_beers().await;
        info!("Untappd: discovered {} unique beers", beers.len());

        let mut assets = Vec::with_capacity(beers.len() * 4);
        for beer in &beers {
            let base_name = if beer.brewery.is_empty() {
                beer.name.clone()
            } else {
                format!("{} ({})", beer.name, beer.brewery)
            };

            let feeds = [
                ("checkins", "Check-ins", "sentiment"),
                ("rating", "Rating", "sentiment"),
                ("rating_count", "Ratings Count", "sentiment"),
                ("monthly", "Monthly Check-ins", "sentiment"),
            ];

            for (suffix, label, cat) in &feeds {
                assets.push(AssetUpdate {
                    asset_id: format!("untappd_{}_{}", beer.bid, suffix),
                    symbol: format!("BEER/{}/{}", beer.bid, suffix.to_uppercase()),
                    name: format!("{} [{}]", base_name, label),
                    category: Some(cat.to_string()),
                    metadata: serde_json::json!({
                        "api_ref": beer.bid.to_string(),
                        "subcategory": "beer",
                        "active": true,
                        "beer_name": beer.name,
                        "brewery": beer.brewery,
                        "style": beer.style,
                        "feed_type": suffix,
                    }),
                });
            }
        }

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() { return Ok(Vec::new()); }
        let now = Utc::now();

        // Collect unique BIDs from requested asset_ids
        let mut bid_to_assets: HashMap<u64, Vec<(String, String)>> = HashMap::new(); // bid -> [(asset_id, suffix)]
        for asset_id in asset_ids {
            // Parse: untappd_{bid}_{suffix}
            if let Some(rest) = asset_id.strip_prefix("untappd_") {
                if let Some(underscore_pos) = rest.rfind('_') {
                    if let Ok(bid) = rest[..underscore_pos].parse::<u64>() {
                        let suffix = &rest[underscore_pos + 1..];
                        bid_to_assets.entry(bid)
                            .or_default()
                            .push((asset_id.clone(), suffix.to_string()));
                    }
                }
            }
        }

        let mut results = Vec::new();
        let mut calls = 0;

        for (bid, assets) in &bid_to_assets {
            if calls >= MAX_INFO_CALLS { break; }

            let url = format!(
                "{}/beer/info/{}?compact=true&{}",
                UNTAPPD_API, bid, self.auth_params()
            );

            match self.http.get_json::<UntappdResponse<BeerInfoResponse>>(&url).await {
                Ok(resp) => {
                    if let Some(beer) = resp.response.and_then(|r| r.beer) {
                        let checkins = beer.stats.as_ref()
                            .and_then(|s| s.total_count).unwrap_or(0);
                        let rating = beer.rating_score.unwrap_or(0.0);
                        let rating_count = beer.rating_count.unwrap_or(0);
                        let monthly = beer.stats.as_ref()
                            .and_then(|s| s.monthly_count).unwrap_or(0);

                        let name = beer.beer_name.unwrap_or_default();
                        let brewery = beer.brewery.and_then(|b| b.brewery_name).unwrap_or_default();

                        for (asset_id, suffix) in assets {
                            let (value, symbol_suffix) = match suffix.as_str() {
                                "checkins" => (Decimal::from(checkins), "CHECKINS"),
                                "rating" => (Decimal::try_from(rating).unwrap_or(Decimal::ZERO), "RATING"),
                                "rating_count" => (Decimal::from(rating_count), "RATINGS"),
                                "monthly" => (Decimal::from(monthly), "MONTHLY"),
                                _ => continue,
                            };

                            results.push(PriceUpdate {
                                asset_id: asset_id.clone(),
                                symbol: format!("BEER/{}/{}", bid, symbol_suffix),
                                value,
                                prev_close: None,
                                change_pct: None,
                                volume_24h: None,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Err(e) => {
                    warn!("Untappd: failed to fetch beer {}: {:?}", bid, e);
                }
            }

            calls += 1;
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        info!("Untappd: fetched {} prices from {} beer/info calls", results.len(), calls);
        Ok(results)
    }
}
```

**Step 4: Commit**

```bash
git add data-node/src/market_data/sources/untappd/ data-node/src/config/untappd.json
git commit -m "feat(data-node): add Untappd beer social data source"
```

---

### Task 3: Register both sources in backend wiring files

**Files:**
- Modify: `data-node/src/market_data/sources/mod.rs`
- Modify: `data-node/src/api.rs`
- Modify: `data-node/src/config.rs`
- Modify: `data-node/src/main.rs`
- Modify: `start.sh`

**Step 1: Register modules in sources/mod.rs**

Add after line 85 (`pub mod adzuna;`):
```rust
pub mod yahoo_drinks;
pub mod untappd;
```

Add after line 171 (`pub use adzuna::AdzunaMarketSource;`):
```rust
pub use yahoo_drinks::YahooDrinksMarketSource;
pub use untappd::UntappdMarketSource;
```

**Step 2: Add to SOURCE_META in api.rs**

Add before the closing `];` of SOURCE_META (after the adzuna line at ~4379):
```rust
    // ── Drinks / Beverages ──────────────────────────────────────────────────
    ("yahoo_drinks", "Yahoo Drink Markets", 600),
    ("untappd", "Untappd Beer", 600),
```

**Step 3: Add CLI args in config.rs**

Add before the CORS origin field (`pub cors_origin: Vec<String>`) in ServeArgs:
```rust
    /// Untappd client ID (enables beer check-in tracking)
    #[arg(long, env = "UNTAPPD_CLIENT_ID")]
    pub untappd_client_id: Option<String>,

    /// Untappd client secret
    #[arg(long, env = "UNTAPPD_CLIENT_SECRET")]
    pub untappd_client_secret: Option<String>,
```

**Step 4: Spawn sync engines in main.rs**

Add before the `// Record not_started` block (before line 1501):

```rust
    // Yahoo Finance Drink Markets — no key needed (unofficial Yahoo API)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::yahoo_drinks::YahooDrinksMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("Yahoo Drinks init failed: {e}"),
            }
        });
        info!("Yahoo Finance drink markets started");
    }

    // Untappd Beer — gated on client ID + secret
    if let Some(ref client_id) = args.untappd_client_id {
        if let Some(ref client_secret) = args.untappd_client_secret {
            std::env::set_var("UNTAPPD_CLIENT_ID", client_id);
            std::env::set_var("UNTAPPD_CLIENT_SECRET", client_secret);
            let pool_c = pool.clone();
            tokio::spawn(async move {
                match market_data::sources::untappd::UntappdMarketSource::from_env() {
                    Ok(source) => {
                        let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                        engine.run().await;
                    }
                    Err(e) => tracing::error!("Untappd init failed: {e}"),
                }
            });
            info!("Untappd beer tracker started");
        } else {
            info!("Untappd skipped (UNTAPPD_CLIENT_SECRET not configured)");
        }
    }
```

**Step 5: Add record_not_started for Untappd in main.rs**

Add in the `record_not_started` block (after the adzuna check at ~line 1627):
```rust
        // Untappd
        if args.untappd_client_id.is_none() || args.untappd_client_secret.is_none() {
            tracker.record_not_started("untappd", "Missing --untappd-client-id / --untappd-client-secret");
        }
```

**Step 6: Add to start.sh**

Add after the `${ADZUNA_APP_KEY:+--adzuna-app-key "$ADZUNA_APP_KEY"} \` line (line 926):
```bash
        ${UNTAPPD_CLIENT_ID:+--untappd-client-id "$UNTAPPD_CLIENT_ID"} \
        ${UNTAPPD_CLIENT_SECRET:+--untappd-client-secret "$UNTAPPD_CLIENT_SECRET"} \
```

**Step 7: Compile check**

Run: `cd data-node && cargo check 2>&1 | tail -20`
Expected: compiles with no errors (warnings OK)

**Step 8: Commit**

```bash
git add data-node/src/market_data/sources/mod.rs data-node/src/api.rs data-node/src/config.rs data-node/src/main.rs start.sh
git commit -m "feat(data-node): wire yahoo_drinks + untappd sources into backend"
```

---

### Task 4: Wire both sources into frontend

**Files:**
- Modify: `frontend/lib/p2pool/market-categories.ts`
- Modify: `frontend/lib/vision/market-categories.ts` (same file, different path)
- Modify: `frontend/components/domain/vision/VisionMarketsGrid.tsx`
- Modify: `frontend/components/domain/SourceDetailModal.tsx`
- Modify: `frontend/components/domain/SourceHealthTable.tsx`

**Step 1: Add prefix mappings to both market-categories.ts files**

In `frontend/lib/p2pool/market-categories.ts`, add to PREFIX_MAP (after the `bestbuy` line):
```typescript
  ['yahoodrinks_', 'yahoo_drinks', 'Drink Markets'],
  ['untappd_', 'untappd', 'Untappd Beer'],
```

Add to CATEGORY_ORDER (before `'other'`):
```typescript
  'yahoo_drinks', 'untappd',
```

Do the same in `frontend/lib/vision/market-categories.ts` (if it's a separate file with the same structure — verify first; if it re-exports from p2pool, skip).

**Step 2: Add to VisionMarketsGrid CATEGORY_GROUPS**

In `frontend/components/domain/vision/VisionMarketsGrid.tsx`:

Add `'yahoo_drinks'` to the commodities group sources array:
```typescript
{ id: 'commodities', label: 'Commodities', sources: ['futures', 'cftc', 'opec', 'eia', 'yahoo_drinks'] },
```

Add `'untappd'` to the entertainment group sources array:
```typescript
{ id: 'entertainment', label: 'Entertainment', sources: ['tmdb', 'lastfm', 'anilist', 'twitch', 'chaturbate', 'steam', 'backpacktf', 'fourchan', 'esports', 'bgg', 'untappd'] },
```

Add `'untappd'` to COUNT_SOURCES:
```typescript
const COUNT_SOURCES = new Set([
  'sec_13f', 'sec_efts', 'sec_insider', 'finra_short_vol', 'congress',
  'npm', 'pypi', 'crates_io', 'github', 'hackernews',
  'twitch', 'steam', 'anilist', 'fourchan', 'backpacktf', 'esports',
  // ... existing entries ..., 'untappd',
])
```

**Step 3: Add SOURCE_META to SourceDetailModal.tsx**

Add after the `bestbuy` entry (before the `sec_efts` line):
```typescript
  // ── Drinks / Beverages ──
  yahoo_drinks: {
    valueLabel: 'Price', unit: 'USD',
    assetUnit: (name) => {
      if (/futures/i.test(name)) return 'USD/unit'
      return 'USD'
    },
  },
  untappd: {
    valueLabel: 'Activity', unit: '',
    assetUnit: (name) => {
      if (/rating\b/i.test(name) && !/count/i.test(name)) return '/5'
      if (/check.?in|monthly/i.test(name)) return 'check-ins'
      if (/count/i.test(name)) return 'ratings'
      return ''
    },
  },
```

**Step 4: Add API_KEY_LINKS to SourceHealthTable.tsx**

Add to `API_KEY_LINKS` object:
```typescript
  untappd: { url: 'https://untappd.com/api/register', label: 'Untappd API' },
```

(Yahoo drinks needs no API key link since it's always-on.)

**Step 5: TypeScript compile check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | tail -20`
Expected: no type errors

**Step 6: Commit**

```bash
git add frontend/lib/p2pool/market-categories.ts frontend/lib/vision/market-categories.ts frontend/components/domain/vision/VisionMarketsGrid.tsx frontend/components/domain/SourceDetailModal.tsx frontend/components/domain/SourceHealthTable.tsx
git commit -m "feat(frontend): wire yahoo_drinks + untappd into frontend display"
```

---

### Task 5: Final verification

**Step 1: Full cargo check**

Run: `cd data-node && cargo check`
Expected: clean compile

**Step 2: Frontend TSC**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean compile

**Step 3: Verify file counts match the ADDING_A_DATA_SOURCE.md checklist**

Backend per source:
- [x] `sources/{source}/client.rs` — implements MarketDataSource
- [x] `sources/{source}/mod.rs` — pub mod + pub use
- [x] `config/{source}.json` — asset list (static for yahoo, empty for untappd)
- [x] `sources/mod.rs` — module registration + re-export
- [x] `main.rs` — spawn SyncEngine
- [x] `api.rs` — SOURCE_META entry

Untappd only (API-key-gated):
- [x] `config.rs` — CLI args
- [x] `main.rs` — record_not_started
- [x] `start.sh` — conditional flags

Frontend per source:
- [x] `lib/p2pool/market-categories.ts` — PREFIX_MAP + CATEGORY_ORDER
- [x] `lib/vision/market-categories.ts` — PREFIX_MAP + CATEGORY_ORDER (if separate)
- [x] `VisionMarketsGrid.tsx` — CATEGORY_GROUPS + COUNT_SOURCES (untappd)
- [x] `SourceDetailModal.tsx` — SOURCE_META
- [x] `SourceHealthTable.tsx` — API_KEY_LINKS (untappd)

**Step 4: Log to backlog**

Add to `backlog.md`:
```
## 20260224-XXXX-drk1

[DECISION] Yahoo drinks source uses direct HTTP to Yahoo v8 chart API instead of yahoo_finance_api crate - avoids extra dependency, we already have SourceHttpClient with rate limiting
[DECISION] Untappd uses dynamic discovery (trending+search) instead of static config - beers trend in/out, manual curation can't keep up
[DECISION] 4 feeds per beer (checkins, rating, rating_count, monthly) - each tells a different story about the beer's popularity
[DECISION] Rate limit budget: 80 req/hr (20% headroom under 100/hr Untappd limit) = ~13 calls/sync at 6 syncs/hr
```
