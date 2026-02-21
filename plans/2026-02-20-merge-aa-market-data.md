# Merge AA Market Data Providers into Index Data-Node

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import 15 market data providers from AA's `market-data-lib` into the Index `data-node`, plus add a granular admin truncate endpoint.

**Architecture:** Copy the AA trait-based source system (`market_data/` module) into `data-node/src/`, add unified `market_assets`/`market_prices` DB tables via new migrations, wire providers into `main.rs` startup, and expose market data + admin API endpoints. Drop AA's CoinGecko and DefiLlama (Index's own are source of truth).

**Tech Stack:** Rust, Axum, sqlx 0.8, PostgreSQL, tokio, async-trait, rust_decimal, chrono-tz

---

## Source Files Reference

All AA source files to copy live under:
```
/Users/maxguillabert/Downloads/AA/crates/market-data-lib/src/
```

Index data-node lives at:
```
/Users/maxguillabert/Downloads/index/data-node/
```

---

### Task 1: Add Dependencies to Cargo.toml

**Files:**
- Modify: `data-node/Cargo.toml`

**Step 1: Add the new dependencies**

Add these after the existing `hex = "0.4"` line in `[dependencies]`:

```toml
# Market data providers (from AA)
async-trait = "0.1"
anyhow = "1"
thiserror = "1"
rust_decimal = { version = "1", features = ["serde-with-str"] }
chrono-tz = "0.10"
dashmap = "5.5"
```

**Step 2: Verify it compiles**

Run: `cargo check -p data-node`
Expected: PASS (no code uses the new deps yet)

**Step 3: Commit**

```bash
git add data-node/Cargo.toml
git commit -m "chore: add market-data dependencies for AA merge"
```

---

### Task 2: Create Database Migration

**Files:**
- Create: `data-node/migrations/021_create_market_sources.sql`

**Step 1: Write the migration**

```sql
-- Unified market data tables (ported from AA market-data-lib)
-- Stores data from 15+ providers: stocks, weather, FRED, ECB, BLS, etc.

CREATE TABLE IF NOT EXISTS market_assets (
    asset_id VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (source, asset_id)
);

CREATE TABLE IF NOT EXISTS market_prices (
    id BIGSERIAL PRIMARY KEY,
    asset_id VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    value DECIMAL(30,10) NOT NULL,
    prev_close DECIMAL(30,10),
    change_pct DECIMAL(10,4),
    volume_24h DECIMAL(30,2),
    market_cap DECIMAL(30,2),
    fetched_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (source, asset_id) REFERENCES market_assets(source, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_market_assets_source ON market_assets(source);
CREATE INDEX IF NOT EXISTS idx_market_assets_source_active ON market_assets(source, is_active);
CREATE INDEX IF NOT EXISTS idx_market_assets_category ON market_assets(source, category);
CREATE INDEX IF NOT EXISTS idx_market_prices_source ON market_prices(source);
CREATE INDEX IF NOT EXISTS idx_market_prices_asset ON market_prices(source, asset_id);
CREATE INDEX IF NOT EXISTS idx_market_prices_time ON market_prices(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_prices_asset_time ON market_prices(source, asset_id, fetched_at DESC);
```

**Step 2: Verify migration applies**

Run: `cargo run -p data-node -- serve --database-url postgres://localhost/index_prices` (ctrl+c after "migrated")
Expected: Migration 021 runs successfully

**Step 3: Commit**

```bash
git add data-node/migrations/021_create_market_sources.sql
git commit -m "feat: add market_assets + market_prices tables for AA providers"
```

---

### Task 3: Copy Core Infrastructure (traits, models, queries, sync engines, rate limiter)

**Files:**
- Create: `data-node/src/market_data/mod.rs`
- Create: `data-node/src/market_data/traits.rs`
- Create: `data-node/src/market_data/models.rs`
- Create: `data-node/src/market_data/queries.rs`
- Create: `data-node/src/market_data/sync_engine.rs`
- Create: `data-node/src/market_data/scheduled_sync_engine.rs`
- Create: `data-node/src/market_data/rate_limiter.rs`

**Step 1: Copy files from AA**

Copy from `/Users/maxguillabert/Downloads/AA/crates/market-data-lib/src/`:
- `sources/traits.rs` → `market_data/traits.rs`
- `db/models.rs` → `market_data/models.rs`
- `db/queries.rs` → `market_data/queries.rs`
- `sync/sync_engine.rs` → `market_data/sync_engine.rs`
- `sync/scheduled_sync_engine.rs` → `market_data/scheduled_sync_engine.rs`
- `sync/rate_limiter.rs` → `market_data/rate_limiter.rs`

**Step 2: Create `market_data/mod.rs`**

```rust
//! Market data provider framework (ported from AA market-data-lib)

pub mod models;
pub mod queries;
pub mod rate_limiter;
pub mod scheduled_sync_engine;
pub mod sources;
pub mod sync_engine;
pub mod traits;

pub use models::{MarketAsset, MarketPriceRecord, MarketPriceSummary, MarketSyncStats};
pub use rate_limiter::{RateLimitConfig, RateWindow, SlidingWindowRateLimiter};
pub use scheduled_sync_engine::ScheduledSyncEngine;
pub use sync_engine::SyncEngine;
pub use traits::{AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource};
```

**Step 3: Fix import paths**

In each copied file, replace:
- `crate::sync::rate_limiter::` → `super::rate_limiter::`
- `crate::sources::traits::` → `super::traits::`
- `super::models::` stays as-is in queries.rs
- `use anyhow::Result;` stays (we added `anyhow` dep)
- `sqlx` version differences: AA uses 0.7, Index uses 0.8. Key change: `query_as` tuple syntax may need adjusting. Check compile errors.

**Step 4: Add `mod market_data;` to main.rs**

Add after `mod trade_collector;`:
```rust
mod market_data;
```

**Step 5: Verify it compiles**

Run: `cargo check -p data-node`
Expected: PASS (sources module empty but that's ok)

**Step 6: Commit**

```bash
git add data-node/src/market_data/
git commit -m "feat: add market data core infrastructure (traits, sync engines, rate limiter)"
```

---

### Task 4: Copy Provider Sources (15 providers)

**Files:**
- Create: `data-node/src/market_data/sources/mod.rs`
- Create: `data-node/src/market_data/sources/finnhub/` (mod.rs, client.rs, tickers.json)
- Create: `data-node/src/market_data/sources/openmeteo/` (mod.rs, client.rs, api_client.rs, models.rs, cities.json)
- Create: `data-node/src/market_data/sources/fred/` (mod.rs, client.rs)
- Create: `data-node/src/market_data/sources/treasury/` (mod.rs, client.rs)
- Create: `data-node/src/market_data/sources/ecb/` (mod.rs, client.rs)
- Create: `data-node/src/market_data/sources/bls/` (mod.rs, client.rs)
- Create: `data-node/src/market_data/sources/eia/` (mod.rs, client.rs)
- Create: `data-node/src/market_data/sources/nasdaq/` (mod.rs, client.rs, bchain.rs, cftc.rs, chris.rs, imf.rs, opec.rs)
- Create: `data-node/src/market_data/sources/sec_edgar/` (mod.rs, client.rs)
- Create: `data-node/src/market_data/sources/finra/` (mod.rs, client.rs)
- Create: `data-node/src/market_data/sources/congress/` (mod.rs, client.rs)
- Create: `data-node/src/market_data/sources/worldbank/` (mod.rs, client.rs)

**Step 1: Copy all source directories from AA**

Copy from `/Users/maxguillabert/Downloads/AA/crates/market-data-lib/src/sources/`:
- `finnhub/`, `openmeteo/`, `fred/`, `treasury/`, `ecb/`, `bls/`, `eia/`, `nasdaq/`, `sec_edgar/`, `finra/`, `congress/`, `worldbank/`
- `traits.rs` is already copied (Task 3)

**DO NOT copy:** `coingecko/`, `defillama/`, `zillow/` (dropped per design)

**Step 2: Create `sources/mod.rs`**

```rust
//! Market data provider implementations
//!
//! 15 providers (CoinGecko + DefiLlama handled by existing Index collectors)

pub mod bls;
pub mod congress;
pub mod ecb;
pub mod eia;
pub mod finnhub;
pub mod finra;
pub mod fred;
pub mod nasdaq;
pub mod openmeteo;
pub mod sec_edgar;
pub mod treasury;
pub mod worldbank;

pub use bls::BlsMarketSource;
pub use congress::CongressMarketSource;
pub use ecb::EcbMarketSource;
pub use eia::EiaMarketSource;
pub use finnhub::FinnhubClient as FinnhubMarketSource;
pub use finra::FinraMarketSource;
pub use fred::FredMarketSource;
pub use nasdaq::{BchainMarketSource, CftcMarketSource, ChrisMarketSource, ImfMarketSource, OpecMarketSource};
pub use openmeteo::OpenMeteoMarketSource;
pub use sec_edgar::SecEdgarMarketSource;
pub use treasury::TreasuryMarketSource;
pub use worldbank::WorldBankMarketSource;
```

**Step 3: Fix import paths in all source files**

In each source's `client.rs` / `mod.rs`, replace:
- `use crate::sources::traits::` → `use crate::market_data::traits::`
- `use crate::sync::rate_limiter::` → `use crate::market_data::rate_limiter::`
- Any `use market_data_lib::` → replace with local imports

**Step 4: Update `market_data/mod.rs`** to re-export sources

Add source re-exports so `main.rs` can use them.

**Step 5: Verify it compiles**

Run: `cargo check -p data-node`
Expected: PASS. Fix any sqlx 0.7→0.8 issues (minimal — mostly `PgPool` import paths).

**Step 6: Commit**

```bash
git add data-node/src/market_data/sources/
git commit -m "feat: add 15 market data providers (stocks, FRED, ECB, BLS, weather, etc.)"
```

---

### Task 5: Add Config Fields for Market Data Providers

**Files:**
- Modify: `data-node/src/config.rs`

**Step 1: Add market data fields to ServeArgs**

Add after the existing `listing_sync_interval` field:

```rust
    // === Market data providers (from AA) ===

    /// DefiLlama collector interval in seconds (default: 24h). Set to 0 to disable.
    #[arg(long, default_value = "86400", env = "DL_POLL_INTERVAL_SECS")]
    pub dl_poll_interval: u64,

    /// FNG collector interval in seconds (default: 24h). Set to 0 to disable.
    #[arg(long, default_value = "86400", env = "FNG_POLL_INTERVAL_SECS")]
    pub fng_poll_interval: u64,

    /// Finnhub API key (enables stock price polling)
    #[arg(long, env = "FINNHUB_API_KEY")]
    pub finnhub_api_key: Option<String>,

    /// Finnhub poll interval in seconds (default: 10 min)
    #[arg(long, default_value = "600", env = "FINNHUB_SYNC_INTERVAL_SECS")]
    pub finnhub_sync_interval: u64,

    /// FRED API key (enables Federal Reserve economic data)
    #[arg(long, env = "FRED_API_KEY")]
    pub fred_api_key: Option<String>,

    /// BLS API key (enables employment/inflation data)
    #[arg(long, env = "BLS_API_KEY")]
    pub bls_api_key: Option<String>,

    /// Nasdaq Data Link API key (enables CFTC, CHRIS, BCHAIN, OPEC, IMF)
    #[arg(long, env = "NASDAQ_API_KEY")]
    pub nasdaq_api_key: Option<String>,

    /// Treasury API key (Nasdaq Data Link, enables yield curves)
    #[arg(long, env = "TREASURY_API_KEY")]
    pub treasury_api_key: Option<String>,

    /// EIA API key (enables energy data)
    #[arg(long, env = "EIA_API_KEY")]
    pub eia_api_key: Option<String>,

    /// Enable ECB rate data (no key needed)
    #[arg(long, default_value = "false", env = "ECB_ENABLED")]
    pub ecb_enabled: bool,

    /// OpenMeteo sync interval in seconds (0 = disabled, no key needed)
    #[arg(long, default_value = "0", env = "OPENMETEO_SYNC_INTERVAL_SECS")]
    pub openmeteo_sync_interval: u64,
```

**Step 2: Verify it compiles**

Run: `cargo check -p data-node`
Expected: PASS (existing main.rs doesn't use these yet — warning about unused fields is fine)

**Step 3: Commit**

```bash
git add data-node/src/config.rs
git commit -m "feat: add config fields for 15 market data providers"
```

---

### Task 6: Wire Providers into main.rs Startup

**Files:**
- Modify: `data-node/src/main.rs`

**Step 1: Add market data provider spawning**

After the FNG collector block (line ~240) and before the live cache block, add:

```rust
    // === Market data providers (from AA) ===
    use market_data::{SyncEngine, ScheduledSyncEngine};

    // Finnhub (stocks)
    if let Some(ref key) = args.finnhub_api_key {
        let pool_clone = pool.clone();
        let key = key.clone();
        tokio::spawn(async move {
            match market_data::sources::FinnhubMarketSource::new(&key) {
                Ok(source) => {
                    let engine = SyncEngine::new(pool_clone, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!(%e, "Failed to create Finnhub source"),
            }
        });
        info!("Finnhub stock collector started");
    }

    // FRED (Federal Reserve economic data)
    if let Some(ref key) = args.fred_api_key {
        let pool_clone = pool.clone();
        let key = key.clone();
        tokio::spawn(async move {
            match market_data::sources::FredMarketSource::new(&key) {
                Ok(source) => {
                    let engine = ScheduledSyncEngine::new(pool_clone, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!(%e, "Failed to create FRED source"),
            }
        });
        info!("FRED economic data collector started");
    }

    // BLS (employment/inflation)
    if let Some(ref key) = args.bls_api_key {
        let pool_clone = pool.clone();
        let key = key.clone();
        tokio::spawn(async move {
            match market_data::sources::BlsMarketSource::new(&key) {
                Ok(source) => {
                    let engine = ScheduledSyncEngine::new(pool_clone, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!(%e, "Failed to create BLS source"),
            }
        });
        info!("BLS employment/inflation collector started");
    }

    // Treasury (yield curves)
    if let Some(ref key) = args.treasury_api_key {
        let pool_clone = pool.clone();
        let key = key.clone();
        tokio::spawn(async move {
            match market_data::sources::TreasuryMarketSource::new(&key) {
                Ok(source) => {
                    let engine = ScheduledSyncEngine::new(pool_clone, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!(%e, "Failed to create Treasury source"),
            }
        });
        info!("Treasury yield curve collector started");
    }

    // ECB (European Central Bank)
    if args.ecb_enabled {
        let pool_clone = pool.clone();
        tokio::spawn(async move {
            let source = market_data::sources::EcbMarketSource::new();
            let engine = ScheduledSyncEngine::new(pool_clone, Box::new(source));
            engine.run().await;
        });
        info!("ECB rate collector started");
    }

    // EIA (energy data)
    if let Some(ref key) = args.eia_api_key {
        let pool_clone = pool.clone();
        let key = key.clone();
        tokio::spawn(async move {
            match market_data::sources::EiaMarketSource::new(&key) {
                Ok(source) => {
                    let engine = ScheduledSyncEngine::new(pool_clone, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!(%e, "Failed to create EIA source"),
            }
        });
        info!("EIA energy data collector started");
    }

    // Nasdaq sources (CFTC, CHRIS, BCHAIN, OPEC, IMF)
    if let Some(ref key) = args.nasdaq_api_key {
        let sources: Vec<(&str, Box<dyn market_data::MarketDataSource>)> = vec![
            ("CFTC", Box::new(market_data::sources::CftcMarketSource::new(key))),
            ("CHRIS", Box::new(market_data::sources::ChrisMarketSource::new(key))),
            ("BCHAIN", Box::new(market_data::sources::BchainMarketSource::new(key))),
            ("OPEC", Box::new(market_data::sources::OpecMarketSource::new(key))),
            ("IMF", Box::new(market_data::sources::ImfMarketSource::new(key))),
        ];
        for (name, source) in sources {
            let pool_clone = pool.clone();
            tokio::spawn(async move {
                let engine = SyncEngine::new(pool_clone, source);
                engine.run().await;
            });
            info!("{} collector started", name);
        }
    }

    // OpenMeteo (weather)
    if args.openmeteo_sync_interval > 0 {
        let pool_clone = pool.clone();
        tokio::spawn(async move {
            let source = market_data::sources::OpenMeteoMarketSource::new();
            let engine = SyncEngine::new(pool_clone, Box::new(source));
            engine.run().await;
        });
        info!("OpenMeteo weather collector started");
    }

    // SEC EDGAR, FINRA, Congress, World Bank — always enabled (free, no API key)
    {
        let sources: Vec<Box<dyn market_data::MarketDataSource>> = vec![
            Box::new(market_data::sources::SecEdgarMarketSource::new()),
            Box::new(market_data::sources::FinraMarketSource::new()),
            Box::new(market_data::sources::CongressMarketSource::new()),
            Box::new(market_data::sources::WorldBankMarketSource::new()),
        ];
        for source in sources {
            let pool_clone = pool.clone();
            let name = source.display_name().to_string();
            tokio::spawn(async move {
                let engine = SyncEngine::new(pool_clone, source);
                engine.run().await;
            });
            info!("{} collector started", name);
        }
    }
```

**NOTE:** The exact constructor signatures (`new`, `from_env`, etc.) depend on how each AA source is written. Adjust during implementation — some take `&str`, some take owned `String`, some use `from_env()`. Read each source's `mod.rs` or `client.rs` to confirm.

**Step 2: Verify it compiles**

Run: `cargo check -p data-node`
Expected: PASS (may need constructor adjustments)

**Step 3: Commit**

```bash
git add data-node/src/main.rs
git commit -m "feat: wire 15 market data providers into data-node startup"
```

---

### Task 7: Add Market Data API Endpoints

**Files:**
- Modify: `data-node/src/api.rs`

**Step 1: Add market data routes to router**

In the `router()` function, add before `.layer(cors)`:

```rust
        // Market data (from AA providers)
        .route("/market/prices/:source", get(market_prices))
        .route("/market/prices/:source/:asset_id", get(market_asset_price))
        .route("/market/prices/:source/:asset_id/history", get(market_price_history))
        .route("/market/assets/:source", get(market_assets))
        .route("/market/stats/:source", get(market_stats))
```

**Step 2: Add handler functions**

Add at the end of `api.rs`:

```rust
// === Market data endpoints (from AA providers) ===

#[derive(Deserialize)]
struct MarketPricesQuery {
    category: Option<String>,
    symbols: Option<String>,
    page: Option<u32>,
    limit: Option<u32>,
}

async fn market_prices(
    State(state): State<Arc<AppState>>,
    AxumPath(source): AxumPath<String>,
    Query(q): Query<MarketPricesQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let symbols_str = q.symbols.unwrap_or_default();
    let symbols_vec: Vec<&str> = if symbols_str.is_empty() {
        vec![]
    } else {
        symbols_str.split(',').collect()
    };
    let symbols_filter = if symbols_vec.is_empty() { None } else { Some(symbols_vec.as_slice()) };

    let (prices, total) = crate::market_data::queries::get_market_prices(
        &state.pool,
        &source,
        symbols_filter,
        q.category.as_deref(),
        q.page.unwrap_or(1),
        q.limit.unwrap_or(100),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "source": source,
        "total": total,
        "prices": prices,
    })))
}

async fn market_asset_price(
    State(state): State<Arc<AppState>>,
    AxumPath((source, asset_id)): AxumPath<(String, String)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let price = crate::market_data::queries::get_market_asset_price(
        &state.pool, &source, &asset_id,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match price {
        Some(p) => Ok(Json(serde_json::json!(p))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

#[derive(Deserialize)]
struct MarketHistoryQuery {
    from: String,
    to: String,
}

async fn market_price_history(
    State(state): State<Arc<AppState>>,
    AxumPath((source, asset_id)): AxumPath<(String, String)>,
    Query(q): Query<MarketHistoryQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let from: DateTime<Utc> = q.from.parse().map_err(|_| StatusCode::BAD_REQUEST)?;
    let to: DateTime<Utc> = q.to.parse().map_err(|_| StatusCode::BAD_REQUEST)?;

    let history = crate::market_data::queries::get_market_price_history(
        &state.pool, &source, &asset_id, from, to,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "source": source,
        "asset_id": asset_id,
        "count": history.len(),
        "prices": history,
    })))
}

async fn market_assets(
    State(state): State<Arc<AppState>>,
    AxumPath(source): AxumPath<String>,
    Query(q): Query<MarketPricesQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let assets = crate::market_data::queries::get_market_active_assets(
        &state.pool, &source, q.category.as_deref(),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "source": source,
        "count": assets.len(),
        "assets": assets,
    })))
}

async fn market_stats(
    State(state): State<Arc<AppState>>,
    AxumPath(source): AxumPath<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let stats = crate::market_data::queries::get_market_sync_stats(&state.pool, &source)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!(stats)))
}
```

**Step 3: Verify it compiles**

Run: `cargo check -p data-node`
Expected: PASS

**Step 4: Commit**

```bash
git add data-node/src/api.rs
git commit -m "feat: add /market/* API endpoints for AA market data"
```

---

### Task 8: Add Admin Truncate Endpoint

**Files:**
- Modify: `data-node/src/api.rs`

**Step 1: Add admin routes to router**

In the `router()` function, add before `.layer(cors)`:

```rust
        // Admin endpoints
        .route("/admin/truncate/:table", axum::routing::post(admin_truncate))
        .route("/admin/reset-session", axum::routing::post(admin_reset_session))
```

**Step 2: Add handler functions**

```rust
// === Admin endpoints ===

/// Tables that can be truncated via admin API.
/// Protected tables (klines, coingecko_*, defillama_*, etc.) are excluded
/// because they're expensive to re-collect.
const TRUNCATABLE_TABLES: &[&str] = &[
    "itp_snapshots",
    "trades",
    "sim_runs",
    "sim_nav_series",
    "sim_holdings",
    "sim_trades",
    "market_assets",
    "market_prices",
    "prices",
];

async fn admin_truncate(
    State(state): State<Arc<AppState>>,
    AxumPath(table): AxumPath<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !TRUNCATABLE_TABLES.contains(&table.as_str()) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": format!("table '{}' is not in the truncate allowlist", table),
                "allowed": TRUNCATABLE_TABLES,
            })),
        ));
    }

    // Use raw SQL — table name is validated against allowlist so no injection risk
    let query = format!("TRUNCATE {} CASCADE", table);
    sqlx::query(&query)
        .execute(&state.pool)
        .await
        .map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e.to_string()})),
        ))?;

    tracing::warn!(table = %table, "Admin truncated table");

    Ok(Json(serde_json::json!({
        "table": table,
        "truncated": true,
    })))
}

async fn admin_reset_session(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Matches start.sh: TRUNCATE itp_snapshots, trades
    sqlx::query("TRUNCATE itp_snapshots, trades CASCADE")
        .execute(&state.pool)
        .await
        .map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e.to_string()})),
        ))?;

    tracing::warn!("Admin reset session data (itp_snapshots + trades)");

    Ok(Json(serde_json::json!({
        "truncated": ["itp_snapshots", "trades"],
    })))
}
```

**Step 3: Verify it compiles**

Run: `cargo check -p data-node`
Expected: PASS

**Step 4: Test manually**

```bash
# Start data-node, then:
curl -X POST http://localhost:8200/admin/reset-session
# Expected: {"truncated":["itp_snapshots","trades"]}

curl -X POST http://localhost:8200/admin/truncate/klines
# Expected: 403 {"error":"table 'klines' is not in the truncate allowlist",...}

curl -X POST http://localhost:8200/admin/truncate/prices
# Expected: {"table":"prices","truncated":true}
```

**Step 5: Commit**

```bash
git add data-node/src/api.rs
git commit -m "feat: add /admin/truncate/:table and /admin/reset-session endpoints"
```

---

### Task 9: Fix Compilation Issues & sqlx 0.7→0.8 Porting

**Files:**
- Modify: Various files in `data-node/src/market_data/`

This task is a catch-all for compilation fixes discovered during Tasks 3-8. Common issues:

**Step 1: sqlx differences (0.7 → 0.8)**

- `sqlx::query_as::<_, (T,)>` tuple extraction may behave differently
- `PgPool` import path: unchanged between versions
- `FromRow` derive: unchanged
- `Decimal` type mapping: may need `rust_decimal::Decimal` with sqlx `rust_decimal` feature. Check if Index's sqlx has this feature enabled — if not, add `"rust_decimal"` to sqlx features in Cargo.toml.

**Step 2: reqwest differences (0.11 → 0.12)**

- `reqwest::Client::builder()` API is identical
- `header()` API unchanged
- Main difference: 0.12 uses `http` 1.0 crate. Check if AA sources use `reqwest::header::HeaderValue` — should work the same.

**Step 3: async-trait**

AA uses `#[async_trait::async_trait]` on traits. This works fine with any Rust edition. If Index uses Rust 1.75+, you could optionally replace with native async traits, but `async-trait` works and is simpler for the merge.

**Step 4: Run full build**

Run: `cargo build -p data-node`
Expected: BUILD SUCCESS

**Step 5: Commit any fixes**

```bash
git add -A data-node/
git commit -m "fix: port sqlx 0.7→0.8 and reqwest 0.11→0.12 differences"
```

---

### Task 10: Integration Test — Smoke Test

**Files:**
- No new files (manual testing)

**Step 1: Start data-node with Finnhub (free tier)**

```bash
# Get a free Finnhub key at https://finnhub.io/register
FINNHUB_API_KEY=your_key \
  cargo run -p data-node -- serve \
    --database-url postgres://localhost/index_prices
```

**Step 2: Verify health endpoint shows market data collectors**

```bash
curl http://localhost:8200/health
```

**Step 3: Wait ~60s, then check stock prices**

```bash
curl "http://localhost:8200/market/prices/stocks?limit=5"
# Expected: JSON with AAPL, MSFT, etc. prices

curl "http://localhost:8200/market/assets/stocks?category=usTechLargeCap"
# Expected: JSON with tech stocks

curl "http://localhost:8200/market/stats/stocks"
# Expected: {"source":"stocks","asset_count":500+,...}
```

**Step 4: Test admin endpoints**

```bash
curl -X POST http://localhost:8200/admin/reset-session
# Expected: {"truncated":["itp_snapshots","trades"]}
```

**Step 5: Update start.sh to use admin endpoint instead of psql**

In `start.sh`, replace line 773:
```bash
# Old:
$PSQL -d index_prices -c "TRUNCATE itp_snapshots, trades;" 2>/dev/null || true
# New:
curl -sf -X POST http://localhost:8200/admin/reset-session || \
    $PSQL -d index_prices -c "TRUNCATE itp_snapshots, trades;" 2>/dev/null || true
```

(Keep psql as fallback since data-node may not be running yet at that point in start.sh.)

**Step 6: Final commit**

```bash
git add start.sh
git commit -m "feat: data-node merge complete — 15 AA market data providers + admin truncate"
```

---

## Summary of All Changes

| File | Change |
|------|--------|
| `data-node/Cargo.toml` | +6 dependencies |
| `data-node/migrations/021_create_market_sources.sql` | New migration (2 tables, 7 indexes) |
| `data-node/src/main.rs` | +`mod market_data`, +provider spawning (~80 lines) |
| `data-node/src/config.rs` | +12 config fields for market data providers |
| `data-node/src/api.rs` | +5 market routes, +2 admin routes, +7 handler functions |
| `data-node/src/market_data/` | New module (~40 files, ported from AA) |
| `start.sh` | Optional: use admin endpoint for reset |

## Environment Variables (New)

All optional — if not set, the provider doesn't start:

```
FINNHUB_API_KEY          — stocks (500+ equities)
FRED_API_KEY             — Federal Reserve economic data
BLS_API_KEY              — employment/inflation (NFP, CPI, PPI)
NASDAQ_API_KEY           — CFTC, CHRIS, BCHAIN, OPEC, IMF
TREASURY_API_KEY         — yield curves
EIA_API_KEY              — energy data
ECB_ENABLED=true         — EU interest rates (free, no key)
OPENMETEO_SYNC_INTERVAL_SECS=3600 — weather (free, no key)
```

SEC EDGAR, FINRA, Congress, World Bank start automatically (free, no keys).
