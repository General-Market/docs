# Binance Sources + Four Vaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three new Vision data sources from Binance — spot prices, perpetual funding rates, options mark prices — each on a 5-minute tick, plus **twelve manager-controlled vaults (four per source)** running custom off-chain strategies, depositable from the frontend, actively placing bets on the new batches.

**Architecture:** Three Rust `MarketDataSource` implementations in `data-node/src/market_data/sources/`. Each uses Pattern A (single API call → fan out) against unauthenticated Binance endpoints. `sync_interval() = 300s` makes the data-node emit batch configs with `tick_duration_secs = 300`, which the existing `DeployAllVisionBatches.s.sol` reads from `vision-recommended-configs.json` to create on-chain Vision batches. The already-deployed `VisionVaultFactory` mints twelve vaults via `scripts/deploy-and-fund-vaults.py`; the frontend's existing `VaultDetailClient.tsx` / `VaultActions.tsx` UI surfaces them automatically once their addresses land in `active-deployment.json#whitelistedVaults`. Twelve Python services modeled on `examples/vision-bot-python/` run as containers on VPS 1, each manager-signing batch joins every 5 minutes.

**Tech Stack:** Rust (data-node sources), Solidity 0.8.24 (existing contracts only, no new code), Python 3.13 (strategy bots, web3.py), Binance public endpoints (`/api/v3/ticker/price`, `/fapi/v1/premiumIndex`, `/eapi/v1/mark`).

**Vault / strategy matrix (12 vaults = 3 sources × 4 strategies):**

| # | Source | Label | Strategy |
|---|--------|-------|----------|
| 1 | `binance_spot` | `spot-mom-5` | Momentum, 5-tick lookback — bet UP if price[-1] > price[-5] |
| 2 | `binance_spot` | `spot-rev-5` | Mean reversion, 5-tick lookback — bet UP if price[-1] < price[-5] |
| 3 | `binance_spot` | `spot-mom-20` | Momentum, 20-tick lookback — slower trend signal |
| 4 | `binance_spot` | `spot-rev-20` | Mean reversion, 20-tick lookback — slower contrarian |
| 5 | `binance_futures_funding` | `fund-rev` | Sign reversion — bet UP if last funding rate < 0 (rates revert to zero) |
| 6 | `binance_futures_funding` | `fund-mom` | Sign continuation — bet UP if last funding rate > 0 (carry persists) |
| 7 | `binance_futures_funding` | `fund-flip` | Sign flip — bet UP if rate[-1] and rate[-2] differ in sign |
| 8 | `binance_futures_funding` | `fund-extreme` | Threshold — bet toward zero only when \|rate\| > 5bp; else default UP |
| 9 | `binance_options` | `opt-mom-all` | Mark-price momentum, all contracts |
| 10 | `binance_options` | `opt-rev-all` | Mark-price mean reversion, all contracts |
| 11 | `binance_options` | `opt-mom-calls` | Momentum on CALL contracts only (filter by `_c` suffix in asset_id) |
| 12 | `binance_options` | `opt-mom-puts` | Momentum on PUT contracts only (filter by `_p` suffix) |

Strategies 11 and 12 don't bet on filtered-out markets — for those rows the bot sets the bet to the source's default (UP). The on-chain bitmap must cover every market in the batch; you cannot skip a row.

---

## File Structure

**Backend (new):**
- `data-node/src/market_data/sources/binance_spot/{mod,client}.rs` — spot price source
- `data-node/src/market_data/sources/binance_futures_funding/{mod,client}.rs` — funding rate source
- `data-node/src/market_data/sources/binance_options/{mod,client}.rs` — options mark source
- `data-node/src/config/binance_spot.json` — `[]` (dynamic discovery)
- `data-node/src/config/binance_futures_funding.json` — `[]`
- `data-node/src/config/binance_options.json` — `[]`

**Backend (modified):**
- `data-node/src/market_data/sources/mod.rs` — add 3 `pub mod` + `pub use` lines
- `data-node/src/main.rs` — three `spawn_resilient` blocks inside `run_serve()`
- `data-node/src/api.rs` — three `SOURCE_META` entries

**Frontend (modified):**
- `frontend/data/sources-display.json` — three source-card entries (logo, prefixes, valueLabel, valueUnit)
- `frontend/lib/vision/market-categories.ts` — prefix regex for the three new sources
- `frontend/components/domain/vision/VisionMarketsGrid.tsx` — `CATEGORY_GROUPS` + (where applicable) `COUNT_SOURCES`
- `frontend/components/domain/SourceDetailModal.tsx` — `SOURCE_META` rows
- `frontend/public/source-imgs/new-binance-spot.svg` — real Binance brand mark (single file reused across all three by reference)
- `frontend/public/source-imgs/new-binance-futures.svg` — Binance Futures mark
- `frontend/public/source-imgs/new-binance-options.svg` — Binance Options mark

**Strategy bots (new):** one shared runner package + twelve strategy modules.

- `vision-bot-binance/` — Python package: `runner.py` (shared loop, signs `joinBatch`), `Dockerfile`, `requirements.txt`. The strategy is selected via `STRATEGY` env var which `runner.py` resolves to an importable module.
- `vision-bot-binance/strategies/spot_mom_5.py`
- `vision-bot-binance/strategies/spot_rev_5.py`
- `vision-bot-binance/strategies/spot_mom_20.py`
- `vision-bot-binance/strategies/spot_rev_20.py`
- `vision-bot-binance/strategies/fund_rev.py`
- `vision-bot-binance/strategies/fund_mom.py`
- `vision-bot-binance/strategies/fund_flip.py`
- `vision-bot-binance/strategies/fund_extreme.py`
- `vision-bot-binance/strategies/opt_mom_all.py`
- `vision-bot-binance/strategies/opt_rev_all.py`
- `vision-bot-binance/strategies/opt_mom_calls.py`
- `vision-bot-binance/strategies/opt_mom_puts.py`
- `docker/testnet/bot/binance-bots.docker-compose.yml` — compose file launching twelve services from one image, differing only by env vars

**Deployment artifacts (regenerated):**
- `deployments/vision-recommended-configs.json` — auto-regenerated by data-node, now contains 3 new sources at 300s
- `deployments/vision-batches.json` — auto-regenerated by `DeployAllVisionBatches.s.sol`
- `deployments/active-deployment.json` — `whitelistedVaults` gains 12 entries, `sourceVaults` gains 3 new keys (4 vaults each)

No contract source code changes. No new ABIs. No frontend route additions — the existing `/vision/[source]/[batch]` route handles everything.

---

## Phase 1 — Binance Spot Source

The simplest of the three. One Binance endpoint, all USDT pairs, USD price per asset.

### Task 1.1: Source skeleton + asset discovery

**Files:**
- Create: `data-node/src/market_data/sources/binance_spot/mod.rs`
- Create: `data-node/src/market_data/sources/binance_spot/client.rs`
- Create: `data-node/src/config/binance_spot.json`

- [ ] **Step 1.1.1: Create config JSON (empty — dynamic discovery)**

Write `data-node/src/config/binance_spot.json`:
```json
[]
```

- [ ] **Step 1.1.2: Create mod.rs**

Write `data-node/src/market_data/sources/binance_spot/mod.rs`:
```rust
pub mod client;
pub use client::BinanceSpotMarketSource;
```

- [ ] **Step 1.1.3: Implement client.rs**

Write `data-node/src/market_data/sources/binance_spot/client.rs`:
```rust
//! Binance Spot price source.
//!
//! Discovers all USDT-quoted spot pairs that are TRADING via /api/v3/exchangeInfo,
//! filters out leveraged tokens (UP/DOWN/BULL/BEAR suffixes), then fetches all
//! prices in one /api/v3/ticker/price call per sync.

use anyhow::{Context, Result};
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

const BINANCE_BASE: &str = "https://api.binance.com";
const REQUEST_TIMEOUT_SECS: u64 = 15;
const SYNC_INTERVAL_SECS: u64 = 300;

#[derive(Debug, Deserialize)]
struct ExchangeInfo {
    symbols: Vec<SymbolInfo>,
}

#[derive(Debug, Deserialize)]
struct SymbolInfo {
    symbol: String,
    status: String,
    #[serde(rename = "baseAsset")]
    base_asset: String,
    #[serde(rename = "quoteAsset")]
    quote_asset: String,
    #[serde(rename = "isSpotTradingAllowed")]
    is_spot_trading_allowed: bool,
}

#[derive(Debug, Deserialize)]
struct TickerPrice {
    symbol: String,
    price: String,
}

pub struct BinanceSpotMarketSource {
    http: SourceHttpClient,
}

impl BinanceSpotMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            // Binance free spot weight: 6000/min. /ticker/price (no symbol) = weight 4.
            // We poll once per 300s = 4 weight/5min. Cap at 30 req/min for headroom.
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .user_agent("index-data-node/1.0")
            .build()
            .context("Failed to create HTTP client")?;
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());
        Ok(Self { http })
    }

    fn is_leveraged_token(base: &str) -> bool {
        let upper = base.to_ascii_uppercase();
        upper.ends_with("UP") || upper.ends_with("DOWN")
            || upper.ends_with("BULL") || upper.ends_with("BEAR")
            || upper.ends_with("3L") || upper.ends_with("3S")
            || upper.ends_with("5L") || upper.ends_with("5S")
    }
}

#[async_trait::async_trait]
impl MarketDataSource for BinanceSpotMarketSource {
    fn source_id(&self) -> &'static str { "binance_spot" }
    fn display_name(&self) -> &'static str { "Binance Spot" }
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(SYNC_INTERVAL_SECS) }
    fn rate_limit_config(&self) -> RateLimitConfig { self.http.rate_limit_config().clone() }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let url = format!("{BINANCE_BASE}/api/v3/exchangeInfo");
        let resp: ExchangeInfo = self.http.inner().get(&url).send().await
            .context("exchangeInfo request failed")?
            .error_for_status()?
            .json().await
            .context("exchangeInfo decode failed")?;

        let mut assets = Vec::new();
        for s in resp.symbols {
            if s.status != "TRADING" || !s.is_spot_trading_allowed { continue; }
            if s.quote_asset != "USDT" { continue; }
            if Self::is_leveraged_token(&s.base_asset) { continue; }
            let asset_id = format!("binancespot_{}", s.symbol.to_lowercase());
            assets.push(AssetUpdate {
                asset_id,
                symbol: s.base_asset.clone(),
                name: format!("{} (Binance Spot)", s.base_asset),
                category: "crypto".to_string(),
                subcategory: Some("spot".to_string()),
                api_ref: Some(s.symbol.clone()),
                active: true,
                metadata: None,
            });
        }
        info!("BinanceSpot: discovered {} USDT pairs", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let url = format!("{BINANCE_BASE}/api/v3/ticker/price");
        let tickers: Vec<TickerPrice> = self.http.inner().get(&url).send().await
            .context("ticker/price request failed")?
            .error_for_status()?
            .json().await
            .context("ticker/price decode failed")?;

        let mut by_symbol = std::collections::HashMap::new();
        for t in tickers {
            by_symbol.insert(t.symbol.to_lowercase(), t.price);
        }

        let now = chrono::Utc::now();
        let mut updates = Vec::with_capacity(asset_ids.len());
        for id in asset_ids {
            let key = id.strip_prefix("binancespot_").unwrap_or(id);
            if let Some(price_str) = by_symbol.get(key) {
                if let Ok(price) = Decimal::from_str(price_str) {
                    updates.push(PriceUpdate {
                        asset_id: id.clone(),
                        price,
                        timestamp: now,
                        metadata: None,
                    });
                }
            }
        }
        if updates.is_empty() {
            warn!("BinanceSpot: no prices matched {} asset_ids", asset_ids.len());
        }
        Ok(updates)
    }
}
```

- [ ] **Step 1.1.4: Verify the source compiles**

Run:
```
cd data-node && cargo check -p data-node 2>&1 | tail -30
```
Expected: no errors. If `AssetUpdate` / `PriceUpdate` fields differ from this draft, fix the field names against `data-node/src/market_data/traits.rs` and re-run.

- [ ] **Step 1.1.5: Smoke-test the endpoint live**

Run:
```
curl -s 'https://api.binance.com/api/v3/exchangeInfo' | jq '.symbols | map(select(.quoteAsset == "USDT" and .status == "TRADING")) | length'
curl -s 'https://api.binance.com/api/v3/ticker/price' | jq 'length'
```
Expected: both numbers in the high hundreds. If they return `null`, the upstream changed; investigate before continuing.

- [ ] **Step 1.1.6: Commit**

```
git add data-node/src/market_data/sources/binance_spot data-node/src/config/binance_spot.json
git commit -m "data-node: binance_spot source skeleton + dynamic USDT discovery"
```

### Task 1.2: Register source

**Files:**
- Modify: `data-node/src/market_data/sources/mod.rs`
- Modify: `data-node/src/main.rs`
- Modify: `data-node/src/api.rs`

- [ ] **Step 1.2.1: Add module declaration + re-export**

In `data-node/src/market_data/sources/mod.rs`, grouped with other crypto-ish sources:
```rust
pub mod binance_spot;
// ... near the bottom with the other re-exports ...
pub use binance_spot::BinanceSpotMarketSource;
```

- [ ] **Step 1.2.2: Spawn the sync engine in main.rs**

Find the section in `run_serve()` where always-on sources are spawned (look for any of the keyless ones, e.g. `flights` or `polymarket`). Add a parallel block:
```rust
{
    let pool_c = pool.clone();
    let bh = broadcast_hub.clone();
    let pw = price_writer.clone();
    spawn_resilient("binance_spot", pw.clone(), move || {
        let pool_c = pool_c.clone();
        let bh = bh.clone();
        let pw = pw.clone();
        async move {
            match market_data::sources::binance_spot::BinanceSpotMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh, pw);
                    engine.run().await;
                }
                Err(e) => {
                    tracing::error!("BinanceSpot init failed: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                }
            }
        }
    });
    info!("BinanceSpot started");
}
```

- [ ] **Step 1.2.3: Add SOURCE_META entry in api.rs**

Find the `SOURCE_META` table. Add:
```rust
("binance_spot", "Binance Spot", 300),
```

- [ ] **Step 1.2.4: Compile**

Run:
```
cd data-node && cargo check -p data-node 2>&1 | tail -20
```
Expected: clean.

- [ ] **Step 1.2.5: Commit**

```
git add data-node/src/market_data/sources/mod.rs data-node/src/main.rs data-node/src/api.rs
git commit -m "data-node: wire binance_spot into sync registry + api meta"
```

---

## Phase 2 — Binance Futures Funding Source

Funding rate per USDT-M perpetual. One endpoint, all rates returned, no auth.

### Task 2.1: Source skeleton

**Files:**
- Create: `data-node/src/market_data/sources/binance_futures_funding/mod.rs`
- Create: `data-node/src/market_data/sources/binance_futures_funding/client.rs`
- Create: `data-node/src/config/binance_futures_funding.json`

- [ ] **Step 2.1.1: Create empty config**

Write `data-node/src/config/binance_futures_funding.json`:
```json
[]
```

- [ ] **Step 2.1.2: Create mod.rs**

Write `data-node/src/market_data/sources/binance_futures_funding/mod.rs`:
```rust
pub mod client;
pub use client::BinanceFuturesFundingSource;
```

- [ ] **Step 2.1.3: Implement client.rs**

Write `data-node/src/market_data/sources/binance_futures_funding/client.rs`:
```rust
//! Binance USDT-M perpetual funding rate source.
//!
//! One /fapi/v1/premiumIndex call returns every perpetual with last funding rate.
//! No auth. Weight: 1 (full table). Sync interval: 300s.

use anyhow::{Context, Result};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

const FAPI_BASE: &str = "https://fapi.binance.com";
const REQUEST_TIMEOUT_SECS: u64 = 15;
const SYNC_INTERVAL_SECS: u64 = 300;

#[derive(Debug, Deserialize)]
struct PremiumIndex {
    symbol: String,
    #[serde(rename = "lastFundingRate")]
    last_funding_rate: String,
    #[serde(rename = "markPrice")]
    mark_price: String,
}

#[derive(Debug, Deserialize)]
struct FuturesExchangeInfo {
    symbols: Vec<FuturesSymbolInfo>,
}

#[derive(Debug, Deserialize)]
struct FuturesSymbolInfo {
    symbol: String,
    status: String,
    #[serde(rename = "contractType")]
    contract_type: String,
    #[serde(rename = "baseAsset")]
    base_asset: String,
    #[serde(rename = "quoteAsset")]
    quote_asset: String,
}

pub struct BinanceFuturesFundingSource {
    http: SourceHttpClient,
}

impl BinanceFuturesFundingSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .user_agent("index-data-node/1.0")
            .build()
            .context("Failed to create HTTP client")?;
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for BinanceFuturesFundingSource {
    fn source_id(&self) -> &'static str { "binance_futures_funding" }
    fn display_name(&self) -> &'static str { "Binance Futures Funding" }
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(SYNC_INTERVAL_SECS) }
    fn rate_limit_config(&self) -> RateLimitConfig { self.http.rate_limit_config().clone() }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let url = format!("{FAPI_BASE}/fapi/v1/exchangeInfo");
        let info: FuturesExchangeInfo = self.http.inner().get(&url).send().await
            .context("futures exchangeInfo failed")?
            .error_for_status()?
            .json().await?;

        let mut assets = Vec::new();
        for s in info.symbols {
            if s.status != "TRADING" { continue; }
            if s.contract_type != "PERPETUAL" { continue; }
            if s.quote_asset != "USDT" { continue; }
            let asset_id = format!("binancefunding_{}", s.symbol.to_lowercase());
            assets.push(AssetUpdate {
                asset_id,
                symbol: s.base_asset.clone(),
                name: format!("{} funding rate", s.base_asset),
                category: "crypto".to_string(),
                subcategory: Some("funding".to_string()),
                api_ref: Some(s.symbol.clone()),
                active: true,
                metadata: None,
            });
        }
        info!("BinanceFutures: discovered {} perpetuals", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let url = format!("{FAPI_BASE}/fapi/v1/premiumIndex");
        let rows: Vec<PremiumIndex> = self.http.inner().get(&url).send().await
            .context("premiumIndex failed")?
            .error_for_status()?
            .json().await?;

        let mut by_symbol = std::collections::HashMap::new();
        for r in rows {
            by_symbol.insert(r.symbol.to_lowercase(), r.last_funding_rate);
        }

        let now = chrono::Utc::now();
        let mut updates = Vec::with_capacity(asset_ids.len());
        for id in asset_ids {
            let key = id.strip_prefix("binancefunding_").unwrap_or(id);
            if let Some(rate_str) = by_symbol.get(key) {
                if let Ok(rate) = Decimal::from_str(rate_str) {
                    // Funding rate is a small signed decimal (e.g. 0.0001 = 0.01%).
                    // Scale to basis points × 10 for visibility (0.0001 → 1.0).
                    let scaled = rate * Decimal::from(10_000);
                    updates.push(PriceUpdate {
                        asset_id: id.clone(),
                        price: scaled,
                        timestamp: now,
                        metadata: None,
                    });
                }
            }
        }
        if updates.is_empty() {
            warn!("BinanceFutures: no funding rates matched {} ids", asset_ids.len());
        }
        Ok(updates)
    }
}
```

The scaling note: betting markets read better when the headline number isn't `0.0001`. Multiplying by `10_000` gives "1.0 = 0.01%", which is the convention used in `data-node/config/sources-display.json` for similar percentage feeds. Sign is preserved, so direction-betting still works.

- [ ] **Step 2.1.4: Compile**

```
cd data-node && cargo check -p data-node 2>&1 | tail -20
```

- [ ] **Step 2.1.5: Smoke-test live**

```
curl -s 'https://fapi.binance.com/fapi/v1/premiumIndex' | jq 'length'
curl -s 'https://fapi.binance.com/fapi/v1/premiumIndex' | jq '.[0]'
```
Expected: ~400 rows; the sample includes `lastFundingRate` and `markPrice`.

- [ ] **Step 2.1.6: Commit**

```
git add data-node/src/market_data/sources/binance_futures_funding data-node/src/config/binance_futures_funding.json
git commit -m "data-node: binance_futures_funding source — perpetual funding rates"
```

### Task 2.2: Register source

- [ ] **Step 2.2.1: Add to sources/mod.rs**

In `data-node/src/market_data/sources/mod.rs`:
```rust
pub mod binance_futures_funding;
pub use binance_futures_funding::BinanceFuturesFundingSource;
```

- [ ] **Step 2.2.2: Spawn in main.rs**

Adjacent to the `binance_spot` spawn block from Task 1.2.2:
```rust
{
    let pool_c = pool.clone();
    let bh = broadcast_hub.clone();
    let pw = price_writer.clone();
    spawn_resilient("binance_futures_funding", pw.clone(), move || {
        let pool_c = pool_c.clone();
        let bh = bh.clone();
        let pw = pw.clone();
        async move {
            match market_data::sources::binance_futures_funding::BinanceFuturesFundingSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh, pw);
                    engine.run().await;
                }
                Err(e) => {
                    tracing::error!("BinanceFuturesFunding init failed: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                }
            }
        }
    });
    info!("BinanceFuturesFunding started");
}
```

- [ ] **Step 2.2.3: Add SOURCE_META in api.rs**

```rust
("binance_futures_funding", "Binance Futures Funding", 300),
```

- [ ] **Step 2.2.4: Compile + commit**

```
cd data-node && cargo check -p data-node 2>&1 | tail -10
git add data-node/src/market_data/sources/mod.rs data-node/src/main.rs data-node/src/api.rs
git commit -m "data-node: wire binance_futures_funding into sync registry"
```

---

## Phase 3 — Binance Options Mark Source

The widest contract universe (thousands of strikes). Pre-filter at discovery: only options expiring within 30 days, only on BTC/ETH/SOL/BNB underlyings. This keeps the batch market count under ~400, comparable to spot.

### Task 3.1: Source skeleton

**Files:**
- Create: `data-node/src/market_data/sources/binance_options/mod.rs`
- Create: `data-node/src/market_data/sources/binance_options/client.rs`
- Create: `data-node/src/config/binance_options.json`

- [ ] **Step 3.1.1: Create empty config**

Write `data-node/src/config/binance_options.json`:
```json
[]
```

- [ ] **Step 3.1.2: Create mod.rs**

Write `data-node/src/market_data/sources/binance_options/mod.rs`:
```rust
pub mod client;
pub use client::BinanceOptionsMarketSource;
```

- [ ] **Step 3.1.3: Implement client.rs**

Write `data-node/src/market_data/sources/binance_options/client.rs`:
```rust
//! Binance European Options mark price source.
//!
//! /eapi/v1/exchangeInfo lists every option contract (strike, expiry, side, underlying).
//! /eapi/v1/mark returns mark price for all contracts. Both unauthenticated.
//! Pre-filter to <30-day expiry on BTC/ETH/SOL/BNB to keep the batch tractable.

use anyhow::{Context, Result};
use chrono::{Duration as ChronoDuration, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashSet;
use std::str::FromStr;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

const EAPI_BASE: &str = "https://eapi.binance.com";
const REQUEST_TIMEOUT_SECS: u64 = 15;
const SYNC_INTERVAL_SECS: u64 = 300;
const MAX_DAYS_TO_EXPIRY: i64 = 30;

#[derive(Debug, Deserialize)]
struct OptionsExchangeInfo {
    #[serde(rename = "optionSymbols")]
    option_symbols: Vec<OptionContract>,
}

#[derive(Debug, Deserialize)]
struct OptionContract {
    symbol: String,
    underlying: String,
    #[serde(rename = "expiryDate")]
    expiry_date: i64,        // ms epoch
    side: String,            // "CALL" | "PUT"
    #[serde(rename = "strikePrice")]
    strike_price: String,
}

#[derive(Debug, Deserialize)]
struct MarkRow {
    symbol: String,
    #[serde(rename = "markPrice")]
    mark_price: String,
}

pub struct BinanceOptionsMarketSource {
    http: SourceHttpClient,
}

impl BinanceOptionsMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 60,
                duration: Duration::from_secs(60),
            }],
        };
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .user_agent("index-data-node/1.0")
            .build()
            .context("Failed to create HTTP client")?;
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());
        Ok(Self { http })
    }

    fn allowed_underlyings() -> HashSet<&'static str> {
        ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"].into_iter().collect()
    }
}

#[async_trait::async_trait]
impl MarketDataSource for BinanceOptionsMarketSource {
    fn source_id(&self) -> &'static str { "binance_options" }
    fn display_name(&self) -> &'static str { "Binance Options" }
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(SYNC_INTERVAL_SECS) }
    fn rate_limit_config(&self) -> RateLimitConfig { self.http.rate_limit_config().clone() }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let url = format!("{EAPI_BASE}/eapi/v1/exchangeInfo");
        let info: OptionsExchangeInfo = self.http.inner().get(&url).send().await
            .context("options exchangeInfo failed")?
            .error_for_status()?
            .json().await?;

        let allowed = Self::allowed_underlyings();
        let cutoff_ms = (Utc::now() + ChronoDuration::days(MAX_DAYS_TO_EXPIRY)).timestamp_millis();
        let now_ms = Utc::now().timestamp_millis();

        let mut assets = Vec::new();
        for opt in info.option_symbols {
            if !allowed.contains(opt.underlying.as_str()) { continue; }
            if opt.expiry_date < now_ms { continue; }
            if opt.expiry_date > cutoff_ms { continue; }
            let asset_id = format!("binanceoptions_{}", opt.symbol.to_lowercase());
            // Symbol format example: BTC-260530-65000-C — already human-readable.
            let name = format!("{} {} ${} {}",
                opt.underlying.trim_end_matches("USDT"),
                chrono::DateTime::<Utc>::from_timestamp_millis(opt.expiry_date)
                    .map(|d| d.format("%Y-%m-%d").to_string())
                    .unwrap_or_else(|| "?".to_string()),
                opt.strike_price,
                opt.side,
            );
            assets.push(AssetUpdate {
                asset_id,
                symbol: opt.symbol.clone(),
                name,
                category: "crypto".to_string(),
                subcategory: Some(format!("options_{}",
                    opt.underlying.trim_end_matches("USDT").to_lowercase())),
                api_ref: Some(opt.symbol.clone()),
                active: true,
                metadata: None,
            });
        }
        info!("BinanceOptions: discovered {} contracts under 30d expiry", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let url = format!("{EAPI_BASE}/eapi/v1/mark");
        let rows: Vec<MarkRow> = self.http.inner().get(&url).send().await
            .context("options mark failed")?
            .error_for_status()?
            .json().await?;

        let mut by_symbol = std::collections::HashMap::new();
        for r in rows {
            by_symbol.insert(r.symbol.to_lowercase(), r.mark_price);
        }

        let now = Utc::now();
        let mut updates = Vec::with_capacity(asset_ids.len());
        for id in asset_ids {
            let key = id.strip_prefix("binanceoptions_").unwrap_or(id);
            if let Some(price_str) = by_symbol.get(key) {
                if let Ok(price) = Decimal::from_str(price_str) {
                    updates.push(PriceUpdate {
                        asset_id: id.clone(),
                        price,
                        timestamp: now,
                        metadata: None,
                    });
                }
            }
        }
        if updates.is_empty() {
            warn!("BinanceOptions: no marks matched {} ids", asset_ids.len());
        }
        Ok(updates)
    }
}
```

- [ ] **Step 3.1.4: Compile**

```
cd data-node && cargo check -p data-node 2>&1 | tail -20
```

- [ ] **Step 3.1.5: Smoke-test live**

```
curl -s 'https://eapi.binance.com/eapi/v1/exchangeInfo' | jq '.optionSymbols | length'
curl -s 'https://eapi.binance.com/eapi/v1/mark' | jq 'length'
curl -s 'https://eapi.binance.com/eapi/v1/exchangeInfo' | jq '.optionSymbols[0]'
```
Expected: thousands of contracts, sample includes `expiryDate`, `strikePrice`, `side`, `underlying`. If the field name differs, fix the `serde(rename = ...)` annotations.

- [ ] **Step 3.1.6: Commit**

```
git add data-node/src/market_data/sources/binance_options data-node/src/config/binance_options.json
git commit -m "data-node: binance_options source — mark prices for sub-30d BTC/ETH/SOL/BNB options"
```

### Task 3.2: Register source

- [ ] **Step 3.2.1: Add to sources/mod.rs**

```rust
pub mod binance_options;
pub use binance_options::BinanceOptionsMarketSource;
```

- [ ] **Step 3.2.2: Spawn in main.rs**

Adjacent to the previous two:
```rust
{
    let pool_c = pool.clone();
    let bh = broadcast_hub.clone();
    let pw = price_writer.clone();
    spawn_resilient("binance_options", pw.clone(), move || {
        let pool_c = pool_c.clone();
        let bh = bh.clone();
        let pw = pw.clone();
        async move {
            match market_data::sources::binance_options::BinanceOptionsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh, pw);
                    engine.run().await;
                }
                Err(e) => {
                    tracing::error!("BinanceOptions init failed: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                }
            }
        }
    });
    info!("BinanceOptions started");
}
```

- [ ] **Step 3.2.3: Add SOURCE_META in api.rs**

```rust
("binance_options", "Binance Options", 300),
```

- [ ] **Step 3.2.4: Compile + commit**

```
cd data-node && cargo check -p data-node 2>&1 | tail -10
git add data-node/src/market_data/sources/mod.rs data-node/src/main.rs data-node/src/api.rs
git commit -m "data-node: wire binance_options into sync registry"
```

---

## Phase 4 — Frontend Wiring

### Task 4.1: Source-display metadata

**Files:**
- Modify: `frontend/data/sources-display.json`

- [ ] **Step 4.1.1: Add three entries to sources-display.json**

Open `frontend/data/sources-display.json` and append (preserving existing entries):
```json
{
  "sourceId": "binance_spot",
  "name": "Binance Spot",
  "description": "Spot prices for every USDT-quoted token trading on Binance.",
  "category": "crypto",
  "logo": "/source-imgs/new-binance-spot.svg",
  "brandBg": "#0B0E11",
  "prefixes": ["binancespot_"],
  "valueLabel": "Price",
  "valueUnit": "USDT",
  "isPrice": true
},
{
  "sourceId": "binance_futures_funding",
  "name": "Binance Futures Funding",
  "description": "Last funding rate for every USDT-margined perpetual on Binance Futures. Scaled to basis points × 10 — positive means longs pay shorts.",
  "category": "crypto",
  "logo": "/source-imgs/new-binance-futures.svg",
  "brandBg": "#0B0E11",
  "prefixes": ["binancefunding_"],
  "valueLabel": "Funding",
  "valueUnit": "bp×10",
  "isPrice": false
},
{
  "sourceId": "binance_options",
  "name": "Binance Options",
  "description": "Mark price for every BTC, ETH, SOL, and BNB option expiring in the next 30 days.",
  "category": "crypto",
  "logo": "/source-imgs/new-binance-options.svg",
  "brandBg": "#0B0E11",
  "prefixes": ["binanceoptions_"],
  "valueLabel": "Mark",
  "valueUnit": "USDT",
  "isPrice": true
}
```

- [ ] **Step 4.1.2: Validate JSON**

```
jq . frontend/data/sources-display.json > /dev/null && echo "OK"
```
Expected: `OK`.

### Task 4.2: Logos

**Files:**
- Create: `frontend/public/source-imgs/new-binance-spot.svg`
- Create: `frontend/public/source-imgs/new-binance-futures.svg`
- Create: `frontend/public/source-imgs/new-binance-options.svg`

CLAUDE.md is explicit: never hand-draw logos.

- [ ] **Step 4.2.1: Fetch the official Binance logo**

The real Binance mark is on their press page (https://www.binance.com/en/about). Use the official SVG. If unable to obtain the SVG, fall back to:
```
wget -O /tmp/binance.svg 'https://public.bnbstatic.com/static/images/common/favicon.ico'
```
Then locate an SVG version in the repo: `grep -rn "binance" frontend/public/ 2>/dev/null | head` — if `frontend/public/source-imgs/new-binance.svg` already exists (e.g. from a prior asset), reuse it.

- [ ] **Step 4.2.2: Copy to three filenames**

The three files are visually identical (same Binance brand mark). The display layer distinguishes them by name. After acquiring the official mark:
```
cp /path/to/official-binance.svg frontend/public/source-imgs/new-binance-spot.svg
cp /path/to/official-binance.svg frontend/public/source-imgs/new-binance-futures.svg
cp /path/to/official-binance.svg frontend/public/source-imgs/new-binance-options.svg
```

- [ ] **Step 4.2.3: Visual contrast check**

`brandBg` is `#0B0E11` (near-black). The Binance gold mark (`#F0B90B`) reads cleanly on that background. If you receive a black-on-white logo, swap `brandBg` to `#F0B90B` and recheck contrast.

### Task 4.3: Category routing

**Files:**
- Modify: `frontend/lib/vision/market-categories.ts`
- Modify: `frontend/components/domain/vision/VisionMarketsGrid.tsx`
- Modify: `frontend/components/domain/SourceDetailModal.tsx`

- [ ] **Step 4.3.1: Add prefix regex**

In `frontend/lib/vision/market-categories.ts`, find the `PREFIX_CATEGORIES` array. Extend the crypto regex to include the three new prefixes, or add a row:
```typescript
[/^(binancespot_|binancefunding_|binanceoptions_)/i, 'crypto', 'Crypto'],
```
Place it **before** the catch-all `Other` row.

- [ ] **Step 4.3.2: Add to VisionMarketsGrid CATEGORY_GROUPS**

In `frontend/components/domain/vision/VisionMarketsGrid.tsx`, find `CATEGORY_GROUPS` and add the three source ids to the `crypto` group:
```typescript
{ id: 'crypto', label: 'Crypto', sources: [..., 'binance_spot', 'binance_futures_funding', 'binance_options'] },
```
For `binance_futures_funding`, values are not USD. Add it to `COUNT_SOURCES`:
```typescript
const COUNT_SOURCES = new Set([..., 'binance_futures_funding'])
```

- [ ] **Step 4.3.3: Add SourceDetailModal entries**

In `frontend/components/domain/SourceDetailModal.tsx`, find `SOURCE_META` and add:
```typescript
binance_spot: { valueLabel: 'Price', unit: 'USDT' },
binance_futures_funding: { valueLabel: 'Funding', unit: 'bp×10' },
binance_options: { valueLabel: 'Mark', unit: 'USDT' },
```

- [ ] **Step 4.3.4: Type-check**

```
cd frontend && npx tsc --noEmit 2>&1 | tail -20
```
Expected: no new errors. If the source-id literal type is a closed union, you may also need to update the type in `frontend/lib/vision/source-ids.ts`.

- [ ] **Step 4.3.5: Commit**

```
git add frontend/data/sources-display.json frontend/public/source-imgs/new-binance-*.svg \
  frontend/lib/vision/market-categories.ts \
  frontend/components/domain/vision/VisionMarketsGrid.tsx \
  frontend/components/domain/SourceDetailModal.tsx
git commit -m "frontend: surface binance_spot, binance_futures_funding, binance_options as Crypto sources"
```

---

## Phase 5 — Deploy On-Chain Vision Batches

No contract changes. The data-node generates `vision-recommended-configs.json` automatically; the existing `DeployAllVisionBatches.s.sol` reads it.

### Task 5.1: Push backend changes and wait for VPS 1 data-node to ingest

- [ ] **Step 5.1.1: Push to mono**

```
git push mono main
```
The post-commit hook pings the Dokploy webhook on VPS 3 (frontend) — that's fine. The data-node on VPS 1 is its own deploy; it does not auto-redeploy on push.

- [ ] **Step 5.1.2: Rebuild data-node on VPS 1**

VPS 1 hosts data-node as a native systemd unit (`data-node-shadow.service`). SSH in and rebuild:
```
ssh index-maker/prod/be 'cd /home/max/index && git pull && cd data-node && cargo build --release 2>&1 | tail -10'
ssh index-maker/prod/be 'sudo systemctl restart data-node-shadow'
ssh index-maker/prod/be 'journalctl -u data-node-shadow -n 30 --no-pager'
```
Expected in logs: `BinanceSpot started`, `BinanceFuturesFunding started`, `BinanceOptions started`.

- [ ] **Step 5.1.3: Verify assets discovered**

After 30 seconds:
```
ssh index-maker/prod/be 'curl -s http://localhost:8200/admin/sources/health | jq ".sources[] | select(.source_id | startswith(\"binance_\"))"'
```
Expected: three rows with non-zero `assets_count` (hundreds for spot, ~400 for funding, ~200 for options).

- [ ] **Step 5.1.4: Verify prices flowing**

```
ssh index-maker/prod/be 'curl -s http://localhost:8200/market/prices/binance_spot | jq ".prices | length"'
ssh index-maker/prod/be 'curl -s http://localhost:8200/market/prices/binance_futures_funding | jq ".prices | length"'
ssh index-maker/prod/be 'curl -s http://localhost:8200/market/prices/binance_options | jq ".prices | length"'
```
Expected: all three return non-zero counts within ~5 minutes. If any return 0, check `journalctl -u data-node-shadow -n 200 --no-pager | grep -i binance` for the failure.

### Task 5.2: Generate batch config and create batches on L3

- [ ] **Step 5.2.1: Pull fresh batch configs**

The data-node now exposes `/batches/recommended` for the three new sources. Generate the on-chain config file:
```
ssh index-maker/prod/be 'cd /home/max/index && bash scripts/generate-vision-configs.sh'
```
Then copy the generated file back locally:
```
scp index-maker/prod/be:/home/max/index/deployments/vision-recommended-configs.json deployments/vision-recommended-configs.json
```
Confirm three new entries appear:
```
jq '.configs | keys[] | select(startswith("binance_"))' deployments/vision-recommended-configs.json
```
Expected:
```
"binance_futures_funding"
"binance_options"
"binance_spot"
```
Each entry's `tickDurationSecs` must equal `300`.

- [ ] **Step 5.2.2: Switch to testnet env**

```
./switch-env.sh testnet
```

- [ ] **Step 5.2.3: Create the three Vision batches**

```
cd contracts && forge script script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
  --rpc-url $L3_RPC_URL --broadcast --slow 2>&1 | tee ../logs/deploy-binance-batches.log
```
Expected: log shows three new batches created (the script iterates every key in `vision-recommended-configs.json`; new sources get new batch IDs). Check `deployments/vision-batches.json` afterwards:
```
jq '.batches | with_entries(select(.key | startswith("binance_")))' deployments/vision-batches.json
```
Expected: three entries with batch IDs.

- [ ] **Step 5.2.4: Sync deployment JSON**

```
cd .. && ./switch-env.sh testnet   # syncs deployment JSON to frontend
```

- [ ] **Step 5.2.5: Commit deployment artifacts**

```
git add deployments/vision-recommended-configs.json deployments/vision-batches.json envs/testnet/active-deployment.json frontend/lib/contracts/deployment.json
git commit -m "deploy: three Binance Vision batches on L3 testnet (5-min tick)"
git push mono main
```

---

## Phase 6 — Deploy Twelve Vaults

### Task 6.1: Generate manager keys

Each vault has its own manager EOA. Funds in the manager's wallet are only for L3 gas; the vault holds USDC.

- [ ] **Step 6.1.1: Generate twelve keys**

```
mkdir -p envs/testnet/keys
for label in spot-mom-5 spot-rev-5 spot-mom-20 spot-rev-20 \
             fund-rev fund-mom fund-flip fund-extreme \
             opt-mom-all opt-rev-all opt-mom-calls opt-mom-puts; do
  cast wallet new --json > envs/testnet/keys/binance-$label.json
done
ls envs/testnet/keys/ | wc -l
```
Expected: 12 JSON files (plus any pre-existing keys), each containing `address` and `private_key`.

- [ ] **Step 6.1.2: Add to .gitignore**

```
echo 'envs/testnet/keys/' >> .gitignore
```
The keys live only locally and on VPS 1. Do not commit.

- [ ] **Step 6.1.3: Fund each manager with L3 gas (GM token)**

```
DEPLOYER_KEY=$(jq -r .deployer_private_key envs/testnet/.env)
for label in spot-mom-5 spot-rev-5 spot-mom-20 spot-rev-20 \
             fund-rev fund-mom fund-flip fund-extreme \
             opt-mom-all opt-rev-all opt-mom-calls opt-mom-puts; do
  MGR=$(jq -r .address envs/testnet/keys/binance-$label.json)
  cast send --private-key $DEPLOYER_KEY --rpc-url $L3_RPC_URL --value 1ether $MGR
done
```
1 GM each — far more than 5-min ticks for a month need.

### Task 6.2: Mint twelve vaults

The existing `scripts/deploy-and-fund-vaults.py` creates N vaults per source. Add a sibling script that knows the twelve (source, label, name, manager) tuples.

- [ ] **Step 6.2.1: Write scripts/deploy-binance-vaults.py with twelve tuples**

Read `scripts/deploy-and-fund-vaults.py` first (it iterates `deployments/vision-batches.json` and creates `--per-source` vaults each). Mirror its factory ABI / funding sequence in:

```python
#!/usr/bin/env python3
"""Deploy the twelve Binance Vision vaults (one call per vault).

Reads addresses from envs/testnet/active-deployment.json; managers from
envs/testnet/keys/binance-*.json. Each call mints one vault via VisionVaultFactory
and seeds it with 10,000 USDC. Writes vault addresses back to active-deployment.json
under whitelistedVaults and sourceVaults['<source_id>'].
"""

import json
import os
from pathlib import Path
from web3 import Web3

ROOT = Path(__file__).resolve().parent.parent
DEPLOY = ROOT / "envs" / "testnet" / "active-deployment.json"
KEYS = ROOT / "envs" / "testnet" / "keys"

VAULTS = [
    # Spot — 4 vaults
    {"label": "spot-mom-5",  "source": "binance_spot",
     "name": "Binance Spot Momentum 5",   "symbol": "vBSPOT-M5"},
    {"label": "spot-rev-5",  "source": "binance_spot",
     "name": "Binance Spot Reversion 5",  "symbol": "vBSPOT-R5"},
    {"label": "spot-mom-20", "source": "binance_spot",
     "name": "Binance Spot Momentum 20",  "symbol": "vBSPOT-M20"},
    {"label": "spot-rev-20", "source": "binance_spot",
     "name": "Binance Spot Reversion 20", "symbol": "vBSPOT-R20"},
    # Funding — 4 vaults
    {"label": "fund-rev",     "source": "binance_futures_funding",
     "name": "Binance Funding Reversion",    "symbol": "vBFUND-R"},
    {"label": "fund-mom",     "source": "binance_futures_funding",
     "name": "Binance Funding Continuation", "symbol": "vBFUND-M"},
    {"label": "fund-flip",    "source": "binance_futures_funding",
     "name": "Binance Funding Sign Flip",    "symbol": "vBFUND-F"},
    {"label": "fund-extreme", "source": "binance_futures_funding",
     "name": "Binance Funding Extreme",      "symbol": "vBFUND-X"},
    # Options — 4 vaults
    {"label": "opt-mom-all",   "source": "binance_options",
     "name": "Binance Options Momentum All",   "symbol": "vBOPT-MA"},
    {"label": "opt-rev-all",   "source": "binance_options",
     "name": "Binance Options Reversion All",  "symbol": "vBOPT-RA"},
    {"label": "opt-mom-calls", "source": "binance_options",
     "name": "Binance Options Calls Momentum", "symbol": "vBOPT-MC"},
    {"label": "opt-mom-puts",  "source": "binance_options",
     "name": "Binance Options Puts Momentum",  "symbol": "vBOPT-MP"},
]
FEE_BPS = 1000  # 10% performance fee

SEED_USDC = 10_000  # 18-dec L3 USDC — twelve vaults × 10k = 120k seed budget

def main():
    cfg = json.loads(DEPLOY.read_text())
    rpc = cfg["rpcUrls"]["l3"]
    factory_addr = cfg["contracts"]["VisionVaultFactory"]
    usdc_addr = cfg["contracts"]["USDC"]
    deployer_pk = cfg["deployerPrivateKey"]

    w3 = Web3(Web3.HTTPProvider(rpc))
    deployer = w3.eth.account.from_key(deployer_pk)

    # Load factory ABI from deploy-and-fund-vaults.py (or import it).
    # ... (mirror the call signature of factory.createVault) ...

    created = []
    for v in VAULTS:
        manager_addr = json.loads((KEYS / f"{v['label']}.json").read_text())["address"]
        # Build createVault tx, sign with deployer, broadcast.
        # Read VaultCreated event for the vault address.
        # Approve USDC, transfer SEED_USDC * 1e18 to the vault, deployer calls
        # requestDeposit on behalf of itself, then claimDeposit after settlement.
        # (See scripts/deploy-and-fund-vaults.py for the exact sequence.)
        vault_addr = "..."  # placeholder
        created.append({**v, "vault": vault_addr, "manager": manager_addr})

    # Merge into active-deployment.json
    cfg.setdefault("whitelistedVaults", [])
    cfg.setdefault("sourceVaults", {})
    for entry in created:
        cfg["whitelistedVaults"].append(entry["vault"])
        cfg["sourceVaults"].setdefault(entry["source"], []).append(entry["vault"])
    DEPLOY.write_text(json.dumps(cfg, indent=2))
    print(f"Created {len(created)} vaults; deployment.json updated.")

if __name__ == "__main__":
    main()
```

The placeholder body must be filled in by mirroring `deploy-and-fund-vaults.py` line-for-line (same ABI, same factory call, same USDC seeding sequence). Do not invent a new sequence.

- [ ] **Step 6.2.2: Run the script**

```
python3 scripts/deploy-binance-vaults.py 2>&1 | tee logs/deploy-binance-vaults.log
```
Expected: 12 vault addresses logged; `active-deployment.json` updated. Sanity-check:
```
jq '.whitelistedVaults | length' envs/testnet/active-deployment.json
jq '.sourceVaults | with_entries(select(.key | startswith("binance_"))) | map_values(length)' envs/testnet/active-deployment.json
```
Expected: 12 new entries in `whitelistedVaults`; each of `binance_spot`, `binance_futures_funding`, `binance_options` has 4 vaults.

- [ ] **Step 6.2.3: Sync deployment JSON to frontend**

```
./switch-env.sh testnet
```

- [ ] **Step 6.2.4: Commit deployment artifacts**

```
git add scripts/deploy-binance-vaults.py logs/deploy-binance-vaults.log envs/testnet/active-deployment.json frontend/lib/contracts/deployment.json
git commit -m "deploy: twelve binance vaults — four strategies × three sources"
git push mono main
```

### Task 6.3: Verify vaults visible in frontend

- [ ] **Step 6.3.1: Wait for Dokploy to redeploy**

The push above triggers the Dokploy webhook. Watch:
```
ssh vps3 'docker service ls | grep frontend'
```
Wait until the service shows a fresh `CreatedAt` (within the last minute).

- [ ] **Step 6.3.2: Verify in browser**

Navigate to each of `https://generalmarket.io/vision/binance_spot`, `/vision/binance_futures_funding`, `/vision/binance_options` and confirm each page renders with four vaults in the Featured Vaults section.

If a page 404s, the source-id slug routing is failing — check `frontend/app/vision/[source]/page.tsx` matches the `sourceId` field, not `source_id` (one of the data-node API endpoints returns the snake_case form). Fix and re-push.

---

## Phase 7 — Twelve Strategy Bots (one image, twelve strategies)

The shape of every bot is identical. Build one image. Pick the strategy at runtime via a `STRATEGY` env var. Pick the vault and manager key the same way. Twelve services = twelve env triples.

Each bot's loop:
1. Poll `GET https://api.generalmarket.io/vision/batches/active?source_id=$SOURCE_ID` every 30s.
2. When a new batch opens (id changes), fetch its `market_ids`.
3. Call `strategy.generate_bets(market_ids) -> list[bool]`.
4. Build `bitmapHash = keccak256(packed_bools)`.
5. Choose `depositAmount = min(5% of vault.totalAssets(), MAX_BATCH_BPS * totalAssets / 10000)`.
6. Sign + send `VisionVault.joinBatch(batchId, configHash, depositAmount, bitmapHash)` with the manager key.

Trading entrypoint: **`VisionVault.joinBatch`** (`contracts/src/vision/VisionVault.sol:335`). The vault holds USDC; the manager only pays gas.

### Task 7.1: Shared runner package

**Files:**
- Create: `vision-bot-binance/runner.py`
- Create: `vision-bot-binance/Dockerfile`
- Create: `vision-bot-binance/requirements.txt`
- Create: `vision-bot-binance/strategies/__init__.py`

- [ ] **Step 7.1.1: Bootstrap from the example**

Read `examples/vision-bot-python/` first. Copy and rename:
```
cp -r examples/vision-bot-python vision-bot-binance
mkdir -p vision-bot-binance/strategies
touch vision-bot-binance/strategies/__init__.py
```

- [ ] **Step 7.1.2: Write runner.py**

Replace `vision-bot-binance/main.py` with `vision-bot-binance/runner.py`. The structure mirrors `examples/vision-bot-python/main.py` — same web3 setup, same batch-poll loop. Two differences:

```python
import importlib
import os

STRATEGY = os.environ["STRATEGY"]                       # e.g. "spot_mom_5"
SOURCE_ID = os.environ["SOURCE_ID"]                     # e.g. "binance_spot"
VAULT_ADDRESS = os.environ["VAULT_ADDRESS"]
MANAGER_PRIVATE_KEY = os.environ["MANAGER_PRIVATE_KEY"]
L3_RPC_URL = os.environ["L3_RPC_URL"]
DEPOSIT_BPS = int(os.environ.get("DEPOSIT_BPS", "500")) # 5% per batch default
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"

strategy = importlib.import_module(f"strategies.{STRATEGY}")
# strategy.generate_bets(market_ids: list[str]) -> list[bool]
```

Everything below that (web3 setup, batch poll, bitmap pack, joinBatch tx) is generic — read the example's main.py and inline it verbatim.

- [ ] **Step 7.1.3: Dockerfile**

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "-u", "runner.py"]
```

- [ ] **Step 7.1.4: requirements.txt**

```
web3==7.6.0
requests==2.32.3
eth-account==0.13.4
```

### Task 7.2: Twelve strategy modules

Each module exports a single function `generate_bets(market_ids: list[str]) -> list[bool]`. Each fetches price history from `https://api.generalmarket.io/prices/history`. Each is 5–15 lines. Below: every module, in full.

- [ ] **Step 7.2.1: `strategies/_common.py` — shared price fetch**

```python
import requests

PRICE_API = "https://api.generalmarket.io/prices"

def fetch_history(market_id: str, limit: int) -> list[float]:
    try:
        r = requests.get(
            f"{PRICE_API}/history",
            params={"asset": market_id, "limit": limit},
            timeout=8,
        )
        return [p["price"] for p in r.json().get("prices", [])] if r.ok else []
    except requests.RequestException:
        return []
```

- [ ] **Step 7.2.2: Spot — four modules**

`strategies/spot_mom_5.py`:
```python
from ._common import fetch_history
def generate_bets(market_ids):
    bets = []
    for m in market_ids:
        h = fetch_history(m, 5)
        bets.append(h[-1] > h[0] if len(h) >= 2 else True)
    return bets
```

`strategies/spot_rev_5.py`:
```python
from ._common import fetch_history
def generate_bets(market_ids):
    bets = []
    for m in market_ids:
        h = fetch_history(m, 5)
        bets.append(h[-1] < h[0] if len(h) >= 2 else True)
    return bets
```

`strategies/spot_mom_20.py` and `strategies/spot_rev_20.py` — identical to the `_5` versions, replace the `5` with `20`.

- [ ] **Step 7.2.3: Funding — four modules**

`strategies/fund_rev.py`:
```python
from ._common import fetch_history
def generate_bets(market_ids):
    bets = []
    for m in market_ids:
        h = fetch_history(m, 1)
        bets.append(h[0] < 0 if h else True)  # negative → bet UP
    return bets
```

`strategies/fund_mom.py`:
```python
from ._common import fetch_history
def generate_bets(market_ids):
    bets = []
    for m in market_ids:
        h = fetch_history(m, 1)
        bets.append(h[0] > 0 if h else True)  # positive → bet UP (carry persists)
    return bets
```

`strategies/fund_flip.py`:
```python
from ._common import fetch_history
def generate_bets(market_ids):
    bets = []
    for m in market_ids:
        h = fetch_history(m, 2)
        if len(h) >= 2:
            bets.append((h[-1] > 0) != (h[-2] > 0))  # signs differ → bet UP (flip occurred)
        else:
            bets.append(True)
    return bets
```

`strategies/fund_extreme.py`:
```python
from ._common import fetch_history
THRESHOLD_BPx10 = 5.0  # |rate| > 5 (i.e. 0.05%) → trigger
def generate_bets(market_ids):
    bets = []
    for m in market_ids:
        h = fetch_history(m, 1)
        if h and abs(h[0]) > THRESHOLD_BPx10:
            bets.append(h[0] < 0)  # extreme: bet toward zero
        else:
            bets.append(True)       # neutral: default UP
    return bets
```

- [ ] **Step 7.2.4: Options — four modules**

`strategies/opt_mom_all.py`:
```python
from ._common import fetch_history
def generate_bets(market_ids):
    bets = []
    for m in market_ids:
        h = fetch_history(m, 5)
        bets.append(h[-1] > h[0] if len(h) >= 2 else True)
    return bets
```

`strategies/opt_rev_all.py` — same shape, `h[-1] < h[0]`.

`strategies/opt_mom_calls.py`:
```python
from ._common import fetch_history
def generate_bets(market_ids):
    bets = []
    for m in market_ids:
        if not m.endswith("-c"):
            bets.append(True)   # not a CALL — default UP
            continue
        h = fetch_history(m, 5)
        bets.append(h[-1] > h[0] if len(h) >= 2 else True)
    return bets
```

`strategies/opt_mom_puts.py` — identical, replace `"-c"` with `"-p"`.

Asset-id suffix mapping: Binance option symbols are e.g. `BTC-260530-65000-C` and `BTC-260530-65000-P`. After our lowercasing they become `binanceoptions_btc-260530-65000-c` / `-p`. The suffix check is therefore reliable.

- [ ] **Step 7.2.5: Commit strategies + runner**

```
git add vision-bot-binance
git commit -m "bots: shared runner + twelve binance strategies (spot/funding/options × 4)"
```

### Task 7.3: Local smoke test (dry-run)

- [ ] **Step 7.3.1: Run one strategy locally without sending tx**

```
cd vision-bot-binance
export STRATEGY=spot_mom_5
export SOURCE_ID=binance_spot
export VAULT_ADDRESS=$(jq -r '.sourceVaults.binance_spot[0]' ../envs/testnet/active-deployment.json)
export MANAGER_PRIVATE_KEY=$(jq -r .private_key ../envs/testnet/keys/binance-spot-mom-5.json)
export L3_RPC_URL=$(jq -r .rpcUrls.l3 ../envs/testnet/active-deployment.json)
export DRY_RUN=1
python3 runner.py
```
Expected: one log line per market with the chosen bet, no chain tx. If `DRY_RUN` not yet wired in the runner, add it.

### Task 7.4: Compose twelve services

**Files:**
- Create: `docker/testnet/bot/binance-bots.docker-compose.yml`

- [ ] **Step 7.4.1: Write compose file**

```yaml
version: "3.8"
x-bot: &bot
  build: ../../../vision-bot-binance
  restart: always
  env_file: .env

services:
  bot-spot-mom-5:    { <<: *bot, environment: { STRATEGY: spot_mom_5,    SOURCE_ID: binance_spot,             VAULT_ADDRESS: "${V_SPOT_MOM_5}",    MANAGER_PRIVATE_KEY: "${K_SPOT_MOM_5}" } }
  bot-spot-rev-5:    { <<: *bot, environment: { STRATEGY: spot_rev_5,    SOURCE_ID: binance_spot,             VAULT_ADDRESS: "${V_SPOT_REV_5}",    MANAGER_PRIVATE_KEY: "${K_SPOT_REV_5}" } }
  bot-spot-mom-20:   { <<: *bot, environment: { STRATEGY: spot_mom_20,   SOURCE_ID: binance_spot,             VAULT_ADDRESS: "${V_SPOT_MOM_20}",   MANAGER_PRIVATE_KEY: "${K_SPOT_MOM_20}" } }
  bot-spot-rev-20:   { <<: *bot, environment: { STRATEGY: spot_rev_20,   SOURCE_ID: binance_spot,             VAULT_ADDRESS: "${V_SPOT_REV_20}",   MANAGER_PRIVATE_KEY: "${K_SPOT_REV_20}" } }
  bot-fund-rev:      { <<: *bot, environment: { STRATEGY: fund_rev,      SOURCE_ID: binance_futures_funding,  VAULT_ADDRESS: "${V_FUND_REV}",      MANAGER_PRIVATE_KEY: "${K_FUND_REV}" } }
  bot-fund-mom:      { <<: *bot, environment: { STRATEGY: fund_mom,      SOURCE_ID: binance_futures_funding,  VAULT_ADDRESS: "${V_FUND_MOM}",      MANAGER_PRIVATE_KEY: "${K_FUND_MOM}" } }
  bot-fund-flip:     { <<: *bot, environment: { STRATEGY: fund_flip,     SOURCE_ID: binance_futures_funding,  VAULT_ADDRESS: "${V_FUND_FLIP}",     MANAGER_PRIVATE_KEY: "${K_FUND_FLIP}" } }
  bot-fund-extreme:  { <<: *bot, environment: { STRATEGY: fund_extreme,  SOURCE_ID: binance_futures_funding,  VAULT_ADDRESS: "${V_FUND_EXTREME}",  MANAGER_PRIVATE_KEY: "${K_FUND_EXTREME}" } }
  bot-opt-mom-all:   { <<: *bot, environment: { STRATEGY: opt_mom_all,   SOURCE_ID: binance_options,          VAULT_ADDRESS: "${V_OPT_MOM_ALL}",   MANAGER_PRIVATE_KEY: "${K_OPT_MOM_ALL}" } }
  bot-opt-rev-all:   { <<: *bot, environment: { STRATEGY: opt_rev_all,   SOURCE_ID: binance_options,          VAULT_ADDRESS: "${V_OPT_REV_ALL}",   MANAGER_PRIVATE_KEY: "${K_OPT_REV_ALL}" } }
  bot-opt-mom-calls: { <<: *bot, environment: { STRATEGY: opt_mom_calls, SOURCE_ID: binance_options,          VAULT_ADDRESS: "${V_OPT_MOM_CALLS}", MANAGER_PRIVATE_KEY: "${K_OPT_MOM_CALLS}" } }
  bot-opt-mom-puts:  { <<: *bot, environment: { STRATEGY: opt_mom_puts,  SOURCE_ID: binance_options,          VAULT_ADDRESS: "${V_OPT_MOM_PUTS}",  MANAGER_PRIVATE_KEY: "${K_OPT_MOM_PUTS}" } }
```

The `env_file: .env` provides `L3_RPC_URL` and `VISION_ADDRESS` once, shared across all twelve services.

- [ ] **Step 7.4.2: Commit compose**

```
git add docker/testnet/bot/binance-bots.docker-compose.yml
git commit -m "bots: docker-compose for the twelve binance bots"
git push mono main
```

---

## Phase 8 — Deploy Bots to VPS 1 and Verify Live Trading

### Task 8.1: Provision .env on VPS 1

- [ ] **Step 8.1.1: Copy manager keys to VPS 1**

```
scp envs/testnet/keys/binance-*.json index-maker/prod/be:/home/max/index/envs/testnet/keys/
```

- [ ] **Step 8.1.2: Generate the .env file on VPS 1**

SSH in and run a one-shot script that reads addresses from `active-deployment.json` and keys from the JSON files:

```
ssh index-maker/prod/be 'cd /home/max/index && git pull && bash scripts/gen-binance-bot-env.sh > docker/testnet/bot/.env'
```

`scripts/gen-binance-bot-env.sh` (write this file as part of Task 7.4):
```bash
#!/usr/bin/env bash
set -euo pipefail
DEP=envs/testnet/active-deployment.json
KEYS=envs/testnet/keys
echo "L3_RPC_URL=$(jq -r .rpcUrls.l3 $DEP)"
echo "VISION_ADDRESS=$(jq -r .contracts.Vision $DEP)"
declare -A SRC=(
  [SPOT_MOM_5]=binance_spot:0       [SPOT_REV_5]=binance_spot:1
  [SPOT_MOM_20]=binance_spot:2      [SPOT_REV_20]=binance_spot:3
  [FUND_REV]=binance_futures_funding:0  [FUND_MOM]=binance_futures_funding:1
  [FUND_FLIP]=binance_futures_funding:2 [FUND_EXTREME]=binance_futures_funding:3
  [OPT_MOM_ALL]=binance_options:0   [OPT_REV_ALL]=binance_options:1
  [OPT_MOM_CALLS]=binance_options:2 [OPT_MOM_PUTS]=binance_options:3
)
declare -A LBL=(
  [SPOT_MOM_5]=spot-mom-5     [SPOT_REV_5]=spot-rev-5
  [SPOT_MOM_20]=spot-mom-20   [SPOT_REV_20]=spot-rev-20
  [FUND_REV]=fund-rev         [FUND_MOM]=fund-mom
  [FUND_FLIP]=fund-flip       [FUND_EXTREME]=fund-extreme
  [OPT_MOM_ALL]=opt-mom-all   [OPT_REV_ALL]=opt-rev-all
  [OPT_MOM_CALLS]=opt-mom-calls [OPT_MOM_PUTS]=opt-mom-puts
)
for K in "${!SRC[@]}"; do
  IFS=: read SOURCE IDX <<< "${SRC[$K]}"
  echo "V_${K}=$(jq -r ".sourceVaults.${SOURCE}[${IDX}]" $DEP)"
  echo "K_${K}=$(jq -r .private_key $KEYS/binance-${LBL[$K]}.json)"
done
```
Order in `sourceVaults.<source>[i]` must match the order the four labels were appended in Phase 6.2.1 — keep both alphabetical or both insertion-order, and pick one. Verify by sanity-printing the file.

- [ ] **Step 8.1.3: Build + start the twelve containers**

```
ssh index-maker/prod/be 'cd /home/max/index/docker/testnet/bot && docker compose -f binance-bots.docker-compose.yml --env-file .env up -d --build'
```

- [ ] **Step 8.1.4: Tail logs for the first tick cycle**

```
ssh index-maker/prod/be 'docker compose -f /home/max/index/docker/testnet/bot/binance-bots.docker-compose.yml logs -f --tail 100'
```
Within ~5 minutes (one tick), expect from each of the twelve services:
- `Detected new batch <id> for <source>`
- `Generated <N> bets`
- `joinBatch tx: 0x...`

### Task 8.2: On-chain verification

- [ ] **Step 8.2.1: Confirm vault batch participation**

```
VISION=$(jq -r .contracts.Vision envs/testnet/active-deployment.json)
for src in binance_spot binance_futures_funding binance_options; do
  BATCH=$(jq -r ".batches.$src.batchId" deployments/vision-batches.json)
  echo -n "$src batch $BATCH totalDeposits: "
  cast call --rpc-url $L3_RPC_URL $VISION "batchTotalDeposits(uint256)" $BATCH | cast --to-dec
done
```
Expected: all three values non-zero within 5 minutes of bot startup. Spot will be largest (4 vaults × 5k = 20k seed); funding and options each ~20k seed too.

- [ ] **Step 8.2.2: Confirm per-vault accounting**

```
for SRC in binance_spot binance_futures_funding binance_options; do
  echo "=== $SRC ==="
  for i in 0 1 2 3; do
    VAULT=$(jq -r ".sourceVaults.$SRC[$i]" envs/testnet/active-deployment.json)
    echo -n "  vault[$i] $VAULT totalAssets: "
    cast call --rpc-url $L3_RPC_URL $VAULT "totalAssets()" | cast --to-dec
  done
done
```
Expected: each value ≈ 10000e18 minus what's currently locked in the open batch.

### Task 8.3: Verify frontend depositability

- [ ] **Step 8.3.1: Browser walk-through**

For each of the three sources, open `https://generalmarket.io/vision/<source>`, connect a test wallet, click into one of the four vaults, click Deposit, enter 100 USDC, confirm. Wait for the next tick.

Expected:
- Deposit request appears immediately.
- After the next batch settles, the deposit is fulfilled and shares show in the wallet's vault holdings.
- Vault `totalAssets()` grew by 100e18.

Sample at least one vault per source (3 deposits total).

### Task 8.4: Document and stamp the session

- [ ] **Step 8.4.1: Append to backlog**

Add to `backlog.md` under a session ID (format per CLAUDE.md):
```
[DECISION] binance vault matrix — 3 sources × 4 strategies = 12 vaults — exhaustive coverage of momentum/reversion/sign-flip per source
[DECISION] options pre-filter at 30d expiry, BTC/ETH/SOL/BNB only — full universe was >1k contracts, batch size unmanageable
[DECISION] funding rate scaled ×10000 at the data-node — display reads cleaner than raw 0.0001 decimals; sign preserved for direction bets
[DECISION] one shared bot image, twelve services parameterized by STRATEGY env — avoids twelve copies of the runner
```

- [ ] **Step 8.4.2: Final push**

```
git add backlog.md
git commit -m "session log: binance sources + twelve vault strategies live on testnet"
git push mono main
```

---

## Acceptance Criteria

Before declaring done, every line below must be true:

1. `curl https://api.generalmarket.io/market/prices/binance_spot | jq '.prices | length'` returns > 200.
2. `curl https://api.generalmarket.io/market/prices/binance_futures_funding | jq '.prices | length'` returns > 200.
3. `curl https://api.generalmarket.io/market/prices/binance_options | jq '.prices | length'` returns > 100.
4. `https://generalmarket.io/vision/binance_spot`, `/vision/binance_futures_funding`, and `/vision/binance_options` each load, show the Binance logo, and list **four** vaults each (twelve total).
5. `jq '.whitelistedVaults | length' envs/testnet/active-deployment.json` returns 12 more than its pre-Phase-6 value.
6. `cast call <Vision> batchTotalDeposits(uint256) <each new batch id>` returns > 0 for all three batches.
7. `docker compose logs --tail=500` on VPS 1 shows `joinBatch tx:` lines from **all twelve** bots within any 10-minute window — none silently failing.
8. Depositing 100 USDC into one vault per source (3 deposits) from a browser wallet completes successfully and each vault's `totalAssets()` grows by 100e18 after the next tick.

If any line fails, stop the implementation and investigate before continuing.

---

## Risks and Decision Points

- **Binance rate limits at scale.** If the data-node spawns multiple instances (load testing), the shared `/api/v3/ticker/price` weight could exceed 6000/min. Stay single-instance per VPS, or split by endpoint.
- **Options pre-filter cutoff.** 30 days is arbitrary. Shorter (7d) gives sharper directional plays but cuts the universe to ~50. Longer (60d) adds slow-moving contracts. Revisit after one week of data.
- **Funding rate scaling.** ×10000 produces a number in [-50, +50] (rates ±0.5% per 8h). If a future Binance update changes the rate unit, the scale silently breaks. Keep the comment in `client.rs`.
- **Manager key custody.** Twelve keys, twelve bots, no rotation. Acceptable for testnet. Mainnet requires HSM or per-vault rotation.
- **Twelve managers, twelve gas wallets.** Each key needs L3 gas refilling. A monthly cron that tops up any wallet below 0.1 GM is cheap insurance.
- **Strategy concentration.** Within each source, four strategies cover momentum and reversion symmetrically — so as a group they cancel directionally. Per-vault PnL diverges, the source-level aggregate stays near zero. That's the point: this is a strategy-coverage exercise, not an alpha-capture one.
- **Bitmap ordering.** Every strategy must return bets in the exact `market_ids` order the runner provided. A reordering bug silently flips half the bets. Add an assertion in the runner: `assert len(bets) == len(market_ids)`.
- **Vault factory whitelist.** `VisionVaultFactory` may have an owner-only whitelist. Check `vaultFactory.isWhitelisted(deployer)` before Step 6.2.2 fails silently.
- **Seed capital total.** 12 vaults × 10000 USDC = 120000 L3 USDC. Confirm the deployer holds enough before Phase 6.
- **Phase boundaries.** Phases 1–3 can run in parallel (independent sources). Phases 4–8 are sequential. Phase 7's twelve strategy modules can be written in parallel — they share a runner and differ only in `generate_bets`.
