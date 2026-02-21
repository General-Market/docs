# Merge AA Market Data Providers into Index Data-Node

**Date:** 2026-02-20
**Status:** Approved

## Goal

Absorb the AA project's `market-data-lib` (15 data providers) into the Index `data-node` crate. Add a granular admin truncate endpoint for dev resets.

## Context

- **Index data-node:** 22 Rust modules, 20 PostgreSQL tables, 40+ API endpoints. Handles Bitget prices, ITP snapshots, trades, klines, liquidity, CoinGecko, DefiLlama, FNG, simulations.
- **AA market-data-lib:** Trait-based architecture with 18 data providers and unified `market_assets`/`market_prices` schema.
- **Decision:** Index absorbs AA. Index CoinGecko/DefiLlama remain source of truth. AA's CoinGecko and DefiLlama providers are dropped.

## What Gets Merged

### 15 AA Providers (dropping CoinGecko + DefiLlama + Zillow stub)

| # | Provider | Source ID | Data | Sync Type |
|---|----------|-----------|------|-----------|
| 1 | Finnhub | stocks | 500+ equities | Poll (600s) |
| 2 | OpenMeteo | weather | City weather metrics | Poll (3600s) |
| 3 | FRED | fred | 17 economic series (rates, yields, inflation) | Scheduled (ET) |
| 4 | Treasury | treasury | Yield curves, bill rates | Scheduled (3:30 PM ET) |
| 5 | ECB | ecb | EU interest rates | Scheduled (CET, 8x/year) |
| 6 | BLS | bls | 9 employment/inflation series (NFP, CPI, PPI) | Scheduled (release days) |
| 7 | EIA | eia | Petroleum, natural gas, rig count | Scheduled (Wed/Thu/Fri) |
| 8 | CFTC | cftc | Commitment of Traders | Poll (Nasdaq) |
| 9 | CHRIS | chris | Continuous futures | Poll (Nasdaq) |
| 10 | BCHAIN | bchain | Bitcoin on-chain metrics | Poll (Nasdaq) |
| 11 | OPEC | opec | Crude oil reference basket | Poll (Nasdaq) |
| 12 | IMF | imf | World economic outlook | Poll (Nasdaq) |
| 13 | SEC EDGAR | sec_edgar | 13F fund holdings (45 assets) | Poll (quarterly) |
| 14 | FINRA | finra | Short interest (25 securities) | Poll (bi-weekly) |
| 15 | Congress | congress | Legislative activity (10 metrics) | Poll (daily) |
| 16 | World Bank | worldbank | 150+ global indicators | Poll (annual) |

### Infrastructure Code

- `MarketDataSource` trait + `ScheduledMarketDataSource` trait
- `SyncEngine` (polling loop) + `ScheduledSyncEngine` (release-aware)
- `SlidingWindowRateLimiter`
- Unified DB models + queries

## Database Changes

### New Migration 021: market_sources_tables

```sql
CREATE TABLE market_assets (
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

CREATE TABLE market_prices (
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

CREATE INDEX idx_market_assets_source ON market_assets(source);
CREATE INDEX idx_market_assets_source_active ON market_assets(source, is_active);
CREATE INDEX idx_market_assets_category ON market_assets(source, category);
CREATE INDEX idx_market_prices_source ON market_prices(source);
CREATE INDEX idx_market_prices_asset ON market_prices(source, asset_id);
CREATE INDEX idx_market_prices_time ON market_prices(fetched_at DESC);
CREATE INDEX idx_market_prices_asset_time ON market_prices(source, asset_id, fetched_at DESC);
```

### Existing tables: unchanged

All 20 existing Index tables remain as-is.

## Code Structure

### New directory: `data-node/src/market_data/`

```
data-node/src/market_data/
├── mod.rs
├── traits.rs                    ← MarketDataSource + ScheduledMarketDataSource
├── models.rs                    ← AssetUpdate, PriceUpdate
├── queries.rs                   ← market_assets/market_prices DB ops
├── sync_engine.rs               ← SyncEngine (generic poller)
├── scheduled_sync_engine.rs     ← ScheduledSyncEngine (release-aware)
├── rate_limiter.rs              ← SlidingWindowRateLimiter
└── sources/
    ├── mod.rs
    ├── finnhub/
    │   ├── mod.rs
    │   ├── client.rs
    │   └── tickers.json
    ├── openmeteo/
    │   ├── mod.rs
    │   ├── client.rs
    │   ├── api_client.rs
    │   ├── models.rs
    │   └── cities.json
    ├── fred/
    │   ├── mod.rs
    │   └── client.rs
    ├── treasury/
    │   ├── mod.rs
    │   └── client.rs
    ├── ecb/
    │   ├── mod.rs
    │   └── client.rs
    ├── bls/
    │   ├── mod.rs
    │   └── client.rs
    ├── eia/
    │   ├── mod.rs
    │   └── client.rs
    ├── nasdaq/
    │   ├── mod.rs
    │   ├── client.rs
    │   ├── bchain.rs
    │   ├── cftc.rs
    │   ├── chris.rs
    │   ├── imf.rs
    │   └── opec.rs
    ├── sec_edgar/
    │   ├── mod.rs
    │   └── client.rs
    ├── finra/
    │   ├── mod.rs
    │   └── client.rs
    ├── congress/
    │   ├── mod.rs
    │   └── client.rs
    └── worldbank/
        ├── mod.rs
        └── client.rs
```

### Changes to existing files

**`Cargo.toml`** — Add dependencies:
- `rust_decimal` (precise decimals for market data)
- `chrono-tz` (timezone-aware scheduling)
- `dashmap` (concurrent rate limiter storage)
- `async-trait` (AA uses it for trait async)
- `anyhow`, `thiserror` (AA error handling)

**`main.rs`** — Add market data sync engine spawning after existing collectors:
```rust
// After existing collectors...
// Market data providers (from AA)
if let Ok(source) = FinnhubClient::from_env() {
    let engine = SyncEngine::new(pool.clone(), Box::new(source));
    tokio::spawn(engine.run());
}
// ... same pattern for each provider
```

**`api.rs`** — Add market data API routes:
```
GET /market/prices/:source           — all prices for source
GET /market/prices/:source/:asset_id — single asset price
GET /market/prices/:source/:asset_id/history?from=&to= — history
GET /market/assets/:source           — asset list
GET /market/stats/:source            — sync statistics
```

**`config.rs`** — Add new env var fields for AA providers.

## Admin Truncate Endpoint

### Endpoints

**`POST /admin/truncate/:table`** — Truncate a specific table.

Allowlisted tables:
- `itp_snapshots`, `trades` — session on-chain data
- `sim_runs`, `sim_nav_series`, `sim_holdings`, `sim_trades` — simulation
- `market_assets`, `market_prices` — AA market data
- `prices` — real-time price history

Response: `{ "table": "itp_snapshots", "truncated": true }`
Rejected: `{ "error": "table 'klines' is not in the truncate allowlist" }`

**`POST /admin/reset-session`** — Convenience: truncates `itp_snapshots` + `trades` (matches start.sh).

Response: `{ "truncated": ["itp_snapshots", "trades"] }`

### Protected tables (not truncatable)

`klines`, `coingecko_*`, `defillama_*`, `bitget_listings`, `fng_index`, `github_metrics`, `liquidity_snapshots` — expensive to re-collect.

## Dependency Adaptation

AA uses `sqlx 0.7` while Index uses `sqlx 0.8`. Port queries to 0.8 syntax (minor: `query!` macro changes, `PgPool` API).

AA uses `reqwest 0.11` while Index uses `reqwest 0.12`. Port to 0.12 (minimal changes).

AA uses `async-trait` for source traits. Evaluate whether to keep or use native async traits (Rust 1.75+). If Index targets recent enough Rust, prefer native.

## Environment Variables (new)

```
FINNHUB_API_KEY                  — enables stock price polling
FRED_API_KEY                     — enables Federal Reserve data
BLS_API_KEY                      — enables employment/inflation data
NASDAQ_API_KEY                   — enables CFTC, CHRIS, BCHAIN, OPEC, IMF
TREASURY_API_KEY                 — enables yield curve data
ECB_ENABLED=true                 — enables ECB rate data (no key needed)
OPENMETEO_SYNC_INTERVAL_SECS    — enables weather data (no key needed)
EIA_API_KEY                      — enables energy data
FINNHUB_SYNC_INTERVAL_SECS=600  — stock poll interval
```

All optional. If env var not set, provider doesn't start (same pattern as existing Index collectors).
