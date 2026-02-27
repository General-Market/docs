# Auto-Batch System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically create and manage Vision prediction market batches — one per data source — with dynamic thresholds adapted to recent volatility and lock windows scaled to data refresh speed.

**Architecture:** Data-node computes recommended batch configs (markets, thresholds, lock windows) via a background `BatchEngine`. Exposes `/batches/recommended` API. Issuers run an independent `BatchConfigOrchestrator` (bridge orchestrator pattern — separate from the settlement consensus cycle) that polls data-node, proposes configs via P2P, collects BLS co-signatures, and publishes signed configs back to data-node. Frontend reads signed configs, users submit `createBatchAndJoin()` on-chain (first bet creates the batch atomically). Contract stores only `configHash` — full config lives off-chain. Config updates use lazy promotion (`nextConfigHash` → `configHash` at tick boundary). Settlement resolves against the config matching the on-chain hash. Bad/missing data at settlement → asset cancelled (skipped, no weight redistribution).

**Tech Stack:** Rust (data-node + issuer), Solidity (Vision.sol), PostgreSQL, BLS signatures, axum HTTP, ethers (ABI encoding)

---

## Protocol Summary

```
data-node (per issuer)     issuer (orchestrator)    frontend/user         chain (Vision.sol)
┌──────────────┐          ┌──────────────────┐     ┌──────────┐          ┌─────────────────┐
│ BatchEngine  │ GET      │ BatchConfig      │     │          │          │                 │
│              │ /batches │ Orchestrator:    │     │ Read     │ createBa │ Verify BLS sig  │
│ - health     │─────────►│                  │ GET │ signed   │ tchAndJo │ Store hash      │
│ - thresholds │ /recomm  │ LEADER:          │ /ba │ config   │ in()     │  (lazy promote) │
│ - lock window│          │  1. poll own DN  │ tch │ + show   │ ────────►│                 │
│ - DB storage │          │  2. propose P2P  │ es/ │ markets  │          │ sourceIdToBatch │
│              │ POST     │                  │ sig │ to user  │ joinBatc │  Id mapping     │
│              │◄─────────│ FOLLOWERS:       │ ned │          │ h()      │                 │
│ /batches/    │ /signed  │  1. verify ±50%  │────►│──────────│─────────►│ Lock window on  │
│  replicate   │ /replic  │  2. BLS co-sign  │     └──────────┘          │  join+bitmap+   │
└──────────────┘          │  3. replicate    │                           │  updateConfig   │
                          └──────────────────┘                           └─────────────────┘
```

**Batch config consensus (bridge orchestrator pattern):**
- Runs as independent async task with own timing (NOT inside `run_cycle()` — 800ms budget is full)
- Leader proposes composite hash of all source configs in single round
- Followers verify each source against own data-node's view with **loose tolerance (±50%)**:
  - Asset count: within 50% of own count
  - Thresholds: each threshold_bps within 50% of own value
  - Unknown assets: ≤20% of leader's markets can be unknown to follower
  - Lock offset: must match source speed class (deterministic)
- If acceptable → follower BLS co-signs the composite config hash
- 2/3+ signatures → aggregated BLS signature published to all data-nodes
- Followers replicate leader's full config to own data-node via `POST /batches/replicate`

**User-submitted batch flow:**
1. Data-node serves signed configs: `GET /batches/signed` → `[{config, blsSignature, signersBitmask, referenceNonce}]`
2. Frontend reads this, shows sorted market list to user
3. User picks direction per market (Up/Down/Skip), frontend builds bitmap (MSB-first, matching resolver)
4. First bet: `createBatchAndJoin(sourceId, configHash, tickDuration, lockOffset, blsSig, referenceNonce, signersBitmask, bitmapHash, depositAmount, stakePerTick)` — atomic create + first bet
5. Subsequent bets: `joinBatch(batchId, configHash, bitmapHash, depositAmount, stakePerTick)` — `configHash` param for validation
6. Contract verifies BLS sig, stores hash (idempotent), records bet

**Lazy config promotion (F3):**
- `updateBatchConfig()` writes to `nextConfigHash` + `nextLockOffset`
- `_promoteConfigIfNeeded()` called at top of `joinBatch`, `updateBitmap`, `updateBatchConfig`
- Checks `currentTick > lastPromotionTick` → if yes, promotes `next → current`
- Prevents mid-tick config changes that corrupt active bets

**Key invariants:**
- One rolling batch per source, all healthy assets included (max 256 per bitmap)
- Config hash uses ABI-encoded keccak256 (ethers in Rust, abi.encode in Solidity) — NOT JSON
- Markets sorted by `asset_id` lexicographically before hashing and in bitmap
- Thresholds always `up_x` (direction-agnostic) — users choose side via bitmap
- Threshold clamped to 10000 bps (100%). NaN/Infinity → fallback to `up_0`
- Bitmap convention: MSB-first per byte (`7 - (index % 8)`), matching resolver and existing `bitmap.ts`
- `last_resolved` and `reference_prices` persisted to Postgres (crash recovery)
- Signed configs persisted to DB + in-memory cache
- All POST endpoints require admin token auth

---

## Task 1: Database Migration — Batch Config Tables + Crash Recovery Tables

**Files:**
- Create: `data-node/migrations/024_create_batch_tables.sql`
- Modify: `data-node/src/db.rs` (add migration call)

**Step 1: Write the migration SQL**

```sql
-- Recommended batch configs computed by BatchEngine
CREATE TABLE IF NOT EXISTS batch_configs (
    id              BIGSERIAL PRIMARY KEY,
    source_id       TEXT NOT NULL,
    config_hash     BYTEA NOT NULL,          -- keccak256 of ABI-encoded config
    tick_duration_secs INTEGER NOT NULL,
    lock_offset_secs INTEGER NOT NULL,
    markets         JSONB NOT NULL,          -- [{asset_id, resolution_type, threshold_bps}]
    asset_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_configs_source ON batch_configs (source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_configs_hash ON batch_configs (config_hash);

-- Settlement history per asset for threshold computation
CREATE TABLE IF NOT EXISTS batch_settlements (
    id              BIGSERIAL PRIMARY KEY,
    source_id       TEXT NOT NULL,
    asset_id        TEXT NOT NULL,
    config_hash     BYTEA NOT NULL,          -- which batch config this settled under
    start_price     NUMERIC NOT NULL,
    end_price       NUMERIC NOT NULL,
    change_pct      NUMERIC NOT NULL,        -- (end - start) / start * 100
    settled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_settlements_asset
    ON batch_settlements (source_id, asset_id, settled_at DESC);

-- BLS-signed batch configs (persisted for crash recovery)
CREATE TABLE IF NOT EXISTS signed_batch_configs (
    id              BIGSERIAL PRIMARY KEY,
    source_id       TEXT NOT NULL,
    config_hash     BYTEA NOT NULL,
    config_json     JSONB NOT NULL,          -- full config for serving
    bls_signature   BYTEA NOT NULL,
    signers_bitmask BIGINT NOT NULL,
    reference_nonce BIGINT NOT NULL,
    tick_duration_secs INTEGER NOT NULL,
    lock_offset_secs INTEGER NOT NULL,
    signed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_id, config_hash)
);

CREATE INDEX IF NOT EXISTS idx_signed_batch_source ON signed_batch_configs (source_id, signed_at DESC);

-- Vision tick scheduler crash recovery: last resolved tick per batch
CREATE TABLE IF NOT EXISTS vision_last_resolved (
    batch_id        BIGINT PRIMARY KEY,
    last_tick_id    BIGINT NOT NULL,
    resolved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vision reference prices crash recovery
CREATE TABLE IF NOT EXISTS vision_reference_prices (
    batch_id        BIGINT NOT NULL,
    market_id       BYTEA NOT NULL,           -- H256
    price           NUMERIC NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (batch_id, market_id)
);
```

**Step 2: Register migration in `db.rs`**

In `data-node/src/db.rs`, in `run_migrations()`, add after the last migration (023):

```rust
let m024 = include_str!("../migrations/024_create_batch_tables.sql");
sqlx::raw_sql(m024).execute(pool).await?;
```

**Step 3: Run migration locally to verify**

```bash
cargo run -p data-node -- --database-url "$DATABASE_URL" 2>&1 | head -20
```

Expected: no SQL errors on startup.

**Step 4: Commit**

```bash
git add data-node/migrations/024_create_batch_tables.sql data-node/src/db.rs
git commit -m "feat(data-node): add batch_configs, settlements, signed configs, and crash recovery tables"
```

---

## Task 2: Batch Engine — Core Computation (data-node)

**Files:**
- Create: `data-node/src/batch_engine.rs`
- Modify: `data-node/src/main.rs` (wire up)

This is the brain. Runs as a background task. Each loop iterates all sources:
1. Queries source health to get healthy assets (max 256 per source)
2. Computes per-asset thresholds from settlement history (batched queries, not N+1)
3. Builds the batch config, ABI-encodes and hashes it, stores in DB

**Step 1: Create `batch_engine.rs` with types and hash computation**

```rust
//! Auto-batch engine.
//!
//! Computes recommended Vision batch configs per data source.
//! One rolling batch per source. Markets = all healthy assets (max 256).
//! Thresholds adapt to recent volatility. Always up_x (direction-agnostic).
//! Hash uses ABI encoding (ethers) to match Solidity's abi.encode.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use ethers::abi::{encode, Token};
use ethers::core::utils::keccak256;
use ethers::types::U256;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

/// Lock window as % of tick duration, by source speed class.
const LOCK_PCT_FAST: f64 = 0.15;    // 30-120s sync → lock last 15%
const LOCK_PCT_MEDIUM: f64 = 0.15;  // 300-3600s sync → lock last 15%
const LOCK_PCT_SLOW: f64 = 0.04;    // 86400s+ sync → lock last 4%

/// Minimum lock offset in seconds (never less than 5s)
const MIN_LOCK_OFFSET_SECS: u64 = 5;

/// Maximum markets per batch (bitmap is uint256 = 256 bits)
const MAX_MARKETS_PER_BATCH: usize = 256;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchMarket {
    pub asset_id: String,
    /// Always "up_x" for auto-batches. Users choose direction via bitmap.
    pub resolution_type: String,
    /// Threshold in basis points (e.g. 150 = 1.5%). Clamped to 10000 (100%).
    pub threshold_bps: u32,
    /// Where the threshold came from (metadata only, excluded from hash)
    pub threshold_source: String,  // "last_batch", "24h_history", "no_data"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchConfig {
    pub source_id: String,
    pub display_name: String,
    pub config_hash: String,        // "0x..." hex
    pub tick_duration_secs: u64,
    pub lock_offset_secs: u64,
    pub markets: Vec<BatchMarket>,
    pub created_at: DateTime<Utc>,
}

/// Signed batch config — persisted to DB and served via API.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBatchConfig {
    pub source_id: String,
    pub display_name: String,
    pub config_hash: String,
    pub tick_duration_secs: u64,
    pub lock_offset_secs: u64,
    pub markets: Vec<BatchMarket>,
    pub bls_signature: String,       // hex-encoded
    pub signers_bitmask: u64,
    pub reference_nonce: u64,
    pub signed_at: DateTime<Utc>,
}

/// Compute keccak256 of ABI-encoded batch config.
///
/// Hash structure (matches Solidity):
/// ```
/// outer = keccak256(abi.encode(source_id, tick_duration, lock_offset, marketsRoot))
/// marketsRoot = keccak256(concat(sorted_market_hashes))
/// market_hash = keccak256(abi.encode(asset_id, resolution_type, threshold_bps))
/// ```
///
/// `threshold_source` is excluded from hash (metadata only).
pub fn compute_config_hash(
    source_id: &str,
    tick_duration_secs: u64,
    lock_offset_secs: u64,
    markets: &[BatchMarket],
) -> [u8; 32] {
    let mut sorted = markets.to_vec();
    sorted.sort_by(|a, b| a.asset_id.cmp(&b.asset_id));

    // Per-market hash: keccak256(abi.encode(asset_id, resolution_type, threshold_bps))
    let market_hashes: Vec<[u8; 32]> = sorted
        .iter()
        .map(|m| {
            let market_encoded = encode(&[
                Token::String(m.asset_id.clone()),
                Token::String(m.resolution_type.clone()),
                Token::Uint(U256::from(m.threshold_bps)),
            ]);
            keccak256(&market_encoded)
        })
        .collect();

    // marketsRoot = keccak256(concat(all_market_hashes))
    let mut concat = Vec::with_capacity(market_hashes.len() * 32);
    for h in &market_hashes {
        concat.extend_from_slice(h);
    }
    let markets_root = keccak256(&concat);

    // outer = keccak256(abi.encode(source_id, tick_duration, lock_offset, marketsRoot))
    let outer_encoded = encode(&[
        Token::String(source_id.to_string()),
        Token::Uint(U256::from(tick_duration_secs)),
        Token::Uint(U256::from(lock_offset_secs)),
        Token::FixedBytes(markets_root.to_vec()),
    ]);
    keccak256(&outer_encoded)
}

fn lock_offset_for_interval(sync_interval_secs: u64) -> u64 {
    let pct = if sync_interval_secs <= 120 {
        LOCK_PCT_FAST
    } else if sync_interval_secs <= 3600 {
        LOCK_PCT_MEDIUM
    } else {
        LOCK_PCT_SLOW
    };
    let offset = (sync_interval_secs as f64 * pct) as u64;
    offset.max(MIN_LOCK_OFFSET_SECS)
}

/// Sanitize a threshold_bps value. Guards against NaN, Infinity, negative.
/// Clamps to 10000 bps (100%). Returns 0 (up_0) for invalid inputs.
fn sanitize_threshold_bps(abs_change_pct: f64) -> u32 {
    if abs_change_pct.is_nan() || abs_change_pct.is_infinite() || abs_change_pct < 0.0 {
        return 0;
    }
    // Convert percentage to bps: 1.5% → 150 bps
    let bps = (abs_change_pct * 100.0).min(10000.0) as u32;
    bps
}
```

**Step 2: Add batched threshold queries (2 queries per source, not N+1)**

```rust
/// Get last settlement change % for ALL assets of a source in one query.
/// Returns HashMap<asset_id, change_pct>.
async fn get_all_last_settlement_changes(
    pool: &PgPool,
    source_id: &str,
) -> Result<HashMap<String, f64>, sqlx::Error> {
    let rows: Vec<(String, Decimal)> = sqlx::query_as(
        r#"
        SELECT s.asset_id, s.change_pct
        FROM batch_settlements s
        INNER JOIN (
            SELECT asset_id, MAX(settled_at) as max_settled
            FROM batch_settlements
            WHERE source_id = $1
            GROUP BY asset_id
        ) latest ON s.asset_id = latest.asset_id AND s.settled_at = latest.max_settled
        WHERE s.source_id = $1
        "#,
    )
    .bind(source_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(id, pct)| (id, pct.to_string().parse::<f64>().unwrap_or(0.0)))
        .collect())
}

/// Get 24h price change % for ALL assets of a source in one query.
/// Returns HashMap<asset_id, change_pct>.
async fn get_all_24h_changes(
    pool: &PgPool,
    source_id: &str,
) -> Result<HashMap<String, f64>, sqlx::Error> {
    let rows: Vec<(String, Decimal, Decimal)> = sqlx::query_as(
        r#"
        WITH ranked AS (
            SELECT
                asset_id,
                value,
                fetched_at,
                ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY fetched_at DESC) as rn_desc,
                ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY fetched_at ASC) as rn_asc
            FROM market_prices
            WHERE source = $1
              AND fetched_at >= NOW() - INTERVAL '24 hours'
              AND value > 0
        )
        SELECT
            latest.asset_id,
            latest.value as latest_value,
            earliest.value as earliest_value
        FROM (SELECT asset_id, value FROM ranked WHERE rn_desc = 1) latest
        JOIN (SELECT asset_id, value FROM ranked WHERE rn_asc = 1) earliest
          ON latest.asset_id = earliest.asset_id
        "#,
    )
    .bind(source_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(id, latest, earliest)| {
            let pct = if earliest.is_zero() {
                0.0
            } else {
                ((latest - earliest) / earliest * Decimal::from(100))
                    .to_string()
                    .parse::<f64>()
                    .unwrap_or(0.0)
            };
            (id, pct)
        })
        .collect())
}
```

**Step 3: Add healthy asset query and threshold computation**

```rust
/// Get all healthy assets for a source.
/// "Healthy" = has a price record within 2× sync_interval and value > 0.
/// Returns max MAX_MARKETS_PER_BATCH assets, sorted by volume desc if truncated.
async fn get_healthy_assets(
    pool: &PgPool,
    source_id: &str,
    sync_interval_secs: u64,
) -> Result<Vec<String>, sqlx::Error> {
    let staleness_cutoff = Utc::now() - chrono::Duration::seconds((sync_interval_secs * 2) as i64);

    let rows: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT DISTINCT a.asset_id
        FROM market_assets a
        JOIN market_prices p ON a.source = p.source AND a.asset_id = p.asset_id
        WHERE a.source = $1
          AND a.is_active = true
          AND p.fetched_at >= $2
          AND p.value > 0
        ORDER BY a.asset_id
        LIMIT $3
        "#,
    )
    .bind(source_id)
    .bind(staleness_cutoff)
    .bind(MAX_MARKETS_PER_BATCH as i64)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(id,)| id).collect())
}

/// Compute thresholds for all assets of a source in batch.
/// Uses 2 queries total (not N+1).
/// Priority: last batch settlement > 24h history > up_0.
/// Always returns "up_x" — direction-agnostic.
async fn compute_asset_thresholds(
    pool: &PgPool,
    source_id: &str,
    asset_ids: &[String],
) -> Vec<BatchMarket> {
    let settlement_changes = get_all_last_settlement_changes(pool, source_id)
        .await
        .unwrap_or_default();
    let history_changes = get_all_24h_changes(pool, source_id)
        .await
        .unwrap_or_default();

    asset_ids
        .iter()
        .map(|asset_id| {
            // Try last settlement first
            if let Some(&change_pct) = settlement_changes.get(asset_id) {
                let bps = sanitize_threshold_bps(change_pct.abs());
                if bps > 0 {
                    return BatchMarket {
                        asset_id: asset_id.clone(),
                        resolution_type: "up_x".to_string(),
                        threshold_bps: bps,
                        threshold_source: "last_batch".to_string(),
                    };
                }
            }

            // Try 24h history
            if let Some(&change_pct) = history_changes.get(asset_id) {
                let bps = sanitize_threshold_bps(change_pct.abs());
                if bps > 0 {
                    return BatchMarket {
                        asset_id: asset_id.clone(),
                        resolution_type: "up_x".to_string(),
                        threshold_bps: bps,
                        threshold_source: "24h_history".to_string(),
                    };
                }
            }

            // Fallback: up_0
            BatchMarket {
                asset_id: asset_id.clone(),
                resolution_type: "up_0".to_string(),
                threshold_bps: 0,
                threshold_source: "no_data".to_string(),
            }
        })
        .collect()
}
```

**Step 4: Add batch config generation, DB storage, and engine loop**

```rust
/// Generate a full batch config for a source.
async fn generate_batch_config(
    pool: &PgPool,
    source_id: &str,
    display_name: &str,
    sync_interval_secs: u64,
) -> Option<BatchConfig> {
    let healthy = match get_healthy_assets(pool, source_id, sync_interval_secs).await {
        Ok(ids) => ids,
        Err(e) => {
            warn!(source = source_id, %e, "Failed to get healthy assets");
            return None;
        }
    };

    if healthy.is_empty() {
        return None;
    }

    let tick_duration_secs = sync_interval_secs;
    let lock_offset_secs = lock_offset_for_interval(sync_interval_secs);

    let markets = compute_asset_thresholds(pool, source_id, &healthy).await;

    let hash = compute_config_hash(source_id, tick_duration_secs, lock_offset_secs, &markets);
    let hash_hex = format!("0x{}", hex::encode(hash));

    Some(BatchConfig {
        source_id: source_id.to_string(),
        display_name: display_name.to_string(),
        config_hash: hash_hex,
        tick_duration_secs,
        lock_offset_secs,
        markets,
        created_at: Utc::now(),
    })
}

/// Store batch config in DB.
async fn store_batch_config(pool: &PgPool, config: &BatchConfig) -> Result<(), sqlx::Error> {
    let hash_bytes = hex::decode(config.config_hash.trim_start_matches("0x"))
        .unwrap_or_default();
    let markets_json = serde_json::to_value(&config.markets).unwrap_or_default();

    sqlx::query(
        r#"
        INSERT INTO batch_configs (source_id, config_hash, tick_duration_secs, lock_offset_secs, markets, asset_count, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(&config.source_id)
    .bind(&hash_bytes)
    .bind(config.tick_duration_secs as i32)
    .bind(config.lock_offset_secs as i32)
    .bind(&markets_json)
    .bind(config.markets.len() as i32)
    .bind(config.created_at)
    .execute(pool)
    .await?;

    Ok(())
}

/// Source metadata: (source_id, display_name, sync_interval_secs)
pub type SourceMeta = (&'static str, &'static str, u64);

pub struct BatchEngineState {
    /// Latest recommended batch config per source
    pub configs: RwLock<Vec<BatchConfig>>,
    /// Latest BLS-signed configs (loaded from DB on startup, updated on POST)
    pub signed_configs: RwLock<Vec<SignedBatchConfig>>,
}

impl BatchEngineState {
    pub fn new() -> Self {
        Self {
            configs: RwLock::new(Vec::new()),
            signed_configs: RwLock::new(Vec::new()),
        }
    }

    /// Load signed configs from DB on startup (crash recovery).
    pub async fn load_signed_from_db(&self, pool: &PgPool) {
        let rows: Vec<(String, Vec<u8>, serde_json::Value, Vec<u8>, i64, i64, i32, i32, DateTime<Utc>)> =
            match sqlx::query_as(
                r#"
                SELECT DISTINCT ON (source_id)
                    source_id, config_hash, config_json, bls_signature,
                    signers_bitmask, reference_nonce, tick_duration_secs,
                    lock_offset_secs, signed_at
                FROM signed_batch_configs
                ORDER BY source_id, signed_at DESC
                "#,
            )
            .fetch_all(pool)
            .await
            {
                Ok(r) => r,
                Err(e) => {
                    warn!(%e, "Failed to load signed configs from DB");
                    return;
                }
            };

        let mut configs = Vec::with_capacity(rows.len());
        for (source_id, hash, config_json, sig, bitmask, nonce, tick_dur, lock_off, signed_at) in rows {
            let markets: Vec<BatchMarket> = serde_json::from_value(
                config_json.get("markets").cloned().unwrap_or_default()
            ).unwrap_or_default();
            let display_name = config_json.get("display_name")
                .and_then(|v| v.as_str())
                .unwrap_or(&source_id)
                .to_string();

            configs.push(SignedBatchConfig {
                source_id,
                display_name,
                config_hash: format!("0x{}", hex::encode(&hash)),
                tick_duration_secs: tick_dur as u64,
                lock_offset_secs: lock_off as u64,
                markets,
                bls_signature: hex::encode(&sig),
                signers_bitmask: bitmask as u64,
                reference_nonce: nonce as u64,
                signed_at,
            });
        }

        info!(count = configs.len(), "Loaded signed batch configs from DB");
        *self.signed_configs.write().await = configs;
    }
}

/// Run the batch engine. Recomputes all source configs every 60s.
pub async fn run(pool: PgPool, state: Arc<BatchEngineState>, sources: &[SourceMeta]) {
    info!("BatchEngine started with {} sources", sources.len());

    // Load signed configs from DB (crash recovery)
    state.load_signed_from_db(&pool).await;

    // Initial delay — let sources complete first sync
    tokio::time::sleep(std::time::Duration::from_secs(120)).await;

    loop {
        let mut configs = Vec::new();

        for &(source_id, display_name, sync_interval) in sources {
            if let Some(config) = generate_batch_config(
                &pool, source_id, display_name, sync_interval,
            ).await {
                if let Err(e) = store_batch_config(&pool, &config).await {
                    warn!(source = source_id, %e, "Failed to store batch config");
                }
                configs.push(config);
            }
        }

        info!(
            "BatchEngine computed {} batch configs ({} total markets)",
            configs.len(),
            configs.iter().map(|c| c.markets.len()).sum::<usize>()
        );

        *state.configs.write().await = configs;

        // Recompute every 60 seconds
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    }
}
```

**Step 5: Wire into `main.rs`**

In `data-node/src/main.rs`:
- Add `mod batch_engine;`
- In `main()`, after all market sources are spawned:

```rust
// Start batch engine
let batch_state = Arc::new(batch_engine::BatchEngineState::new());
let batch_pool = pool.clone();
let batch_state_clone = batch_state.clone();
tokio::spawn(async move {
    batch_engine::run(batch_pool, batch_state_clone, batch_engine::BATCH_SOURCES).await;
});
```

Also add `batch_engine` to `AppState`:

```rust
pub batch_engine: Arc<batch_engine::BatchEngineState>,
```

**Step 6: Define BATCH_SOURCES constant in `batch_engine.rs`**

Copy the relevant entries from `SOURCE_META` in `api.rs`. All 82+ sources should be included. Same shape: `&[(&str, &str, u64)]`.

**Step 7: Commit**

```bash
git add data-node/src/batch_engine.rs data-node/src/main.rs
git commit -m "feat(data-node): add BatchEngine with ABI-encoded hashing and batched threshold queries"
```

---

## Task 3: API Endpoints — Batch Config + Signed Config (data-node)

**Files:**
- Modify: `data-node/src/api.rs` (add routes + handlers)

**Step 1: Add routes**

In the `router()` function in `api.rs`, add:

```rust
.route("/batches/recommended", get(batches_recommended))
.route("/batches/config/:hash", get(batch_config_by_hash))
.route("/batches/signed", get(batches_signed))
.route("/batches/signed", axum::routing::post(store_signed_batch))
.route("/batches/replicate", axum::routing::post(replicate_signed_batch))
.route("/batches/settlement", axum::routing::post(record_batch_settlement))
```

**Step 2: Add recommended + config handlers**

```rust
async fn batches_recommended(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let configs = state.batch_engine.configs.read().await;
    Json(serde_json::json!({
        "generatedAt": Utc::now(),
        "batchCount": configs.len(),
        "totalMarkets": configs.iter().map(|c| c.markets.len()).sum::<usize>(),
        "batches": *configs,
    }))
}

/// Fetch full batch config by its keccak256 hash.
/// Used by issuers/resolver to get the full market list for a committed hash.
async fn batch_config_by_hash(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(hash): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Check in-memory first
    let configs = state.batch_engine.configs.read().await;
    if let Some(c) = configs.iter().find(|c| c.config_hash == hash) {
        return Ok(Json(serde_json::json!(c)));
    }
    drop(configs);

    // Also check signed configs
    let signed = state.batch_engine.signed_configs.read().await;
    if let Some(s) = signed.iter().find(|s| s.config_hash == hash) {
        return Ok(Json(serde_json::json!({
            "source_id": s.source_id,
            "config_hash": s.config_hash,
            "tick_duration_secs": s.tick_duration_secs,
            "lock_offset_secs": s.lock_offset_secs,
            "markets": s.markets,
        })));
    }
    drop(signed);

    // Fall back to DB
    let hash_clean = hash.trim_start_matches("0x");
    let hash_bytes = hex::decode(hash_clean).unwrap_or_default();
    let row: Option<(serde_json::Value, i32, i32, String, DateTime<Utc>)> = sqlx::query_as(
        "SELECT markets, tick_duration_secs, lock_offset_secs, source_id, created_at \
         FROM batch_configs WHERE config_hash = $1 ORDER BY created_at DESC LIMIT 1"
    )
    .bind(&hash_bytes)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    match row {
        Some((markets, tick_dur, lock_off, source_id, created_at)) => {
            Ok(Json(serde_json::json!({
                "source_id": source_id,
                "config_hash": hash,
                "tick_duration_secs": tick_dur,
                "lock_offset_secs": lock_off,
                "markets": markets,
                "created_at": created_at,
            })))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}
```

**Step 3: Add signed config endpoints (auth required for POST)**

```rust
/// GET /batches/signed — frontend reads this to build user transactions.
/// Returns array of all sources with their latest signed config.
async fn batches_signed(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let signed = state.batch_engine.signed_configs.read().await;
    Json(serde_json::json!({
        "generatedAt": Utc::now(),
        "batches": *signed,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignedBatchPayload {
    source_id: String,
    config: serde_json::Value,
    config_hash: String,
    bls_signature: String,       // hex-encoded
    signers_bitmask: u64,
    reference_nonce: u64,
    tick_duration_secs: u64,
    lock_offset_secs: u64,
}

/// POST /batches/signed — issuer pushes signed config after BLS consensus.
/// Requires admin token auth.
async fn store_signed_batch(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<SignedBatchPayload>,
) -> StatusCode {
    // Auth check
    let token = headers.get("x-admin-token").and_then(|v| v.to_str().ok());
    if token != Some(&state.admin_token) {
        return StatusCode::UNAUTHORIZED;
    }

    // Persist to DB first (crash recovery)
    let hash_bytes = hex::decode(payload.config_hash.trim_start_matches("0x"))
        .unwrap_or_default();
    let sig_bytes = hex::decode(payload.bls_signature.trim_start_matches("0x"))
        .unwrap_or_default();

    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO signed_batch_configs
            (source_id, config_hash, config_json, bls_signature, signers_bitmask,
             reference_nonce, tick_duration_secs, lock_offset_secs, signed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (source_id, config_hash) DO UPDATE SET
            bls_signature = EXCLUDED.bls_signature,
            signers_bitmask = EXCLUDED.signers_bitmask,
            reference_nonce = EXCLUDED.reference_nonce,
            signed_at = NOW()
        "#,
    )
    .bind(&payload.source_id)
    .bind(&hash_bytes)
    .bind(&payload.config)
    .bind(&sig_bytes)
    .bind(payload.signers_bitmask as i64)
    .bind(payload.reference_nonce as i64)
    .bind(payload.tick_duration_secs as i32)
    .bind(payload.lock_offset_secs as i32)
    .execute(&state.pool)
    .await
    {
        error!(%e, source = %payload.source_id, "Failed to persist signed config to DB");
    }

    // Update in-memory cache
    let markets: Vec<batch_engine::BatchMarket> = serde_json::from_value(
        payload.config.get("markets").cloned().unwrap_or_default()
    ).unwrap_or_default();
    let display_name = payload.config.get("display_name")
        .and_then(|v| v.as_str())
        .unwrap_or(&payload.source_id)
        .to_string();

    let signed = batch_engine::SignedBatchConfig {
        source_id: payload.source_id.clone(),
        display_name,
        config_hash: payload.config_hash,
        tick_duration_secs: payload.tick_duration_secs,
        lock_offset_secs: payload.lock_offset_secs,
        markets,
        bls_signature: payload.bls_signature,
        signers_bitmask: payload.signers_bitmask,
        reference_nonce: payload.reference_nonce,
        signed_at: Utc::now(),
    };

    let mut configs = state.batch_engine.signed_configs.write().await;
    // Replace existing entry for this source, or push new
    if let Some(existing) = configs.iter_mut().find(|c| c.source_id == signed.source_id) {
        *existing = signed;
    } else {
        configs.push(signed);
    }

    StatusCode::OK
}

/// POST /batches/replicate — followers store leader's full config.
/// Same as store_signed_batch but named differently for clarity.
/// Requires admin token auth.
async fn replicate_signed_batch(
    state: State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    payload: Json<SignedBatchPayload>,
) -> StatusCode {
    store_signed_batch(state, headers, payload).await
}
```

**Step 4: Add settlement recording endpoint (auth required)**

```rust
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettlementRecord {
    source_id: String,
    asset_id: String,
    config_hash: String,
    start_price: f64,
    end_price: f64,
    change_pct: f64,
}

/// POST /batches/settlement — issuers record settlement results for threshold feedback.
/// Requires admin token auth.
async fn record_batch_settlement(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(records): Json<Vec<SettlementRecord>>,
) -> StatusCode {
    let token = headers.get("x-admin-token").and_then(|v| v.to_str().ok());
    if token != Some(&state.admin_token) {
        return StatusCode::UNAUTHORIZED;
    }

    for rec in &records {
        let hash_bytes = hex::decode(rec.config_hash.trim_start_matches("0x"))
            .unwrap_or_default();

        let _ = sqlx::query(
            r#"
            INSERT INTO batch_settlements (source_id, asset_id, config_hash, start_price, end_price, change_pct)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(&rec.source_id)
        .bind(&rec.asset_id)
        .bind(&hash_bytes)
        .bind(Decimal::try_from(rec.start_price).unwrap_or_default())
        .bind(Decimal::try_from(rec.end_price).unwrap_or_default())
        .bind(Decimal::try_from(rec.change_pct).unwrap_or_default())
        .execute(&state.pool)
        .await;
    }

    StatusCode::OK
}
```

**Step 5: Verify build**

```bash
cargo build -p data-node 2>&1 | tail -5
```

**Step 6: Commit**

```bash
git add data-node/src/api.rs
git commit -m "feat(data-node): batch API endpoints with auth, DB persistence, and replication"
```

---

## Task 4: Contract Changes — Hash-Based Batches with Lazy Promotion (Vision.sol)

**Files:**
- Modify: `contracts/src/vision/Vision.sol`
- Modify: `contracts/src/interfaces/IVision.sol`

**Step 1: Update IVision.sol — new Batch struct + events + errors + mappings**

Replace the existing `Batch` struct:

```solidity
struct Batch {
    address creator;
    bytes32 sourceId;             // keccak256 of source_id string
    bytes32 configHash;           // keccak256 of ABI-encoded config (active)
    bytes32 nextConfigHash;       // pending config (promoted at next tick boundary)
    uint256 tickDuration;
    uint256 lockOffset;           // active lock window
    uint256 nextLockOffset;       // pending lock window
    uint256 createdAtTick;
    uint256 lastPromotionTick;    // last tick where next→current promotion happened
    bool paused;
}
```

Add custom errors:

```solidity
error BatchAlreadyExists(bytes32 sourceId, uint256 existingBatchId);
error BatchNotFound();
error BatchPaused();
error TickDurationZero();
error TickDurationTooLong();
error LockOffsetTooLong();
error BettingLocked();
error SourceAlreadyHasBatch(bytes32 sourceId);
```

Add events:

```solidity
event BatchCreated(uint256 indexed batchId, bytes32 indexed sourceId, address creator, uint256 tickDuration);
event BatchConfigUpdated(uint256 indexed batchId, bytes32 nextConfigHash);
event BatchConfigPromoted(uint256 indexed batchId, bytes32 configHash);
```

Add state variables to Vision storage:

```solidity
/// sourceId → batchId (one batch per source)
mapping(bytes32 => uint256) public sourceIdToBatchId;
/// sourceId → has batch been created (distinguishes batchId=0 from "no batch")
mapping(bytes32 => bool) public sourceIdHasBatch;
```

**Step 2: Add `createBatchAndJoin()` — atomic create + first bet**

This is the primary entry point for new sources. First user creates the batch AND places their bet in one tx.

```solidity
/// @notice Create a new batch for a source and immediately place the first bet.
/// @dev Anyone can call — BLS signature proves issuers approved the config.
///      Idempotent on sourceId: if batch exists, joins existing batch.
function createBatchAndJoin(
    bytes32 sourceId,
    bytes32 configHash,
    uint256 tickDuration,
    uint256 lockOffset,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask,
    bytes32 bitmapHash,
    uint256 depositAmount,
    uint256 stakePerTick
) external returns (uint256 batchId) {
    // If batch already exists for this source, skip creation
    if (sourceIdHasBatch[sourceId]) {
        batchId = sourceIdToBatchId[sourceId];
    } else {
        // BLS verification — domain-separated message
        bytes32 messageHash = keccak256(abi.encode(
            block.chainid,
            address(this),
            "CREATE_BATCH",
            sourceId,
            configHash,
            tickDuration,
            lockOffset
        ));
        _verifyBLS(messageHash, blsSignature, referenceNonce, signersBitmask);

        if (tickDuration == 0) revert TickDurationZero();
        if (tickDuration > MAX_TICK_DURATION) revert TickDurationTooLong();
        if (lockOffset >= tickDuration) revert LockOffsetTooLong();

        batchId = nextBatchId++;

        Batch storage b = _batches[batchId];
        b.creator = msg.sender;
        b.sourceId = sourceId;
        b.configHash = configHash;
        b.tickDuration = tickDuration;
        b.lockOffset = lockOffset;
        b.createdAtTick = block.timestamp / tickDuration;
        b.lastPromotionTick = block.timestamp / tickDuration;
        b.paused = false;

        sourceIdToBatchId[sourceId] = batchId;
        sourceIdHasBatch[sourceId] = true;

        emit BatchCreated(batchId, sourceId, msg.sender, tickDuration);
    }

    // Now join the batch with the first bet
    _joinBatchInternal(batchId, configHash, bitmapHash, depositAmount, stakePerTick);
}
```

**Step 3: Add lazy config promotion**

```solidity
/// @dev Promote nextConfigHash → configHash if we're in a new tick.
///      Called at the top of joinBatch, updateBitmap, updateBatchConfig.
function _promoteConfigIfNeeded(uint256 batchId) internal {
    Batch storage b = _batches[batchId];
    uint256 currentTick = _currentTickId(batchId);
    if (b.nextConfigHash != bytes32(0) && currentTick > b.lastPromotionTick) {
        b.configHash = b.nextConfigHash;
        b.lockOffset = b.nextLockOffset;
        b.nextConfigHash = bytes32(0);
        b.nextLockOffset = 0;
        b.lastPromotionTick = currentTick;
        emit BatchConfigPromoted(batchId, b.configHash);
    }
}
```

**Step 4: Add `updateBatchConfig()` — writes to next, not current**

```solidity
/// @notice Update batch config for next tick. Anyone can call with valid BLS sig.
/// @dev Writes to nextConfigHash/nextLockOffset. Promoted at next tick boundary.
function updateBatchConfig(
    uint256 batchId,
    bytes32 configHash,
    uint256 lockOffset,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external {
    Batch storage b = _batches[batchId];
    if (b.tickDuration == 0) revert BatchNotFound();
    if (b.paused) revert BatchPaused();

    // Promote pending config first
    _promoteConfigIfNeeded(batchId);

    // Lock window check
    _requireNotLocked(batchId);

    // If next hash is already this value, no-op
    if (b.nextConfigHash == configHash) return;

    // BLS verification — domain-separated
    bytes32 messageHash = keccak256(abi.encode(
        block.chainid,
        address(this),
        "UPDATE_BATCH_CONFIG",
        batchId,
        configHash,
        lockOffset
    ));
    _verifyBLS(messageHash, blsSignature, referenceNonce, signersBitmask);

    if (lockOffset >= b.tickDuration) revert LockOffsetTooLong();

    b.nextConfigHash = configHash;
    b.nextLockOffset = lockOffset;

    emit BatchConfigUpdated(batchId, configHash);
}
```

**Step 5: Update `joinBatch()` with lock window + config hash validation**

```solidity
/// @notice Join an existing batch. Validates configHash matches active config.
function joinBatch(
    uint256 batchId,
    bytes32 configHash,
    bytes32 bitmapHash,
    uint256 depositAmount,
    uint256 stakePerTick
) external {
    _promoteConfigIfNeeded(batchId);
    _joinBatchInternal(batchId, configHash, bitmapHash, depositAmount, stakePerTick);
}

function _joinBatchInternal(
    uint256 batchId,
    bytes32 configHash,
    bytes32 bitmapHash,
    uint256 depositAmount,
    uint256 stakePerTick
) internal {
    Batch storage b = _batches[batchId];
    if (b.tickDuration == 0) revert BatchNotFound();
    if (b.paused) revert BatchPaused();

    // Validate user is betting against the active config
    require(b.configHash == configHash, "config mismatch");

    // Lock window
    _requireNotLocked(batchId);

    // ... existing joinBatch logic (deposit, stake, bitmap, etc.)
}
```

**Step 6: Add lock window to `updateBitmap()` + helper functions**

```solidity
function updateBitmap(uint256 batchId, bytes32 newBitmapHash) external {
    _promoteConfigIfNeeded(batchId);
    _requireNotLocked(batchId);
    // ... existing updateBitmap logic
}

function _currentTickId(uint256 batchId) internal view returns (uint256) {
    Batch storage b = _batches[batchId];
    uint256 currentTick = block.timestamp / b.tickDuration;
    if (currentTick < b.createdAtTick) return 0;
    return currentTick - b.createdAtTick;
}

function _requireNotLocked(uint256 batchId) internal view {
    Batch storage b = _batches[batchId];
    uint256 tickEnd = (b.createdAtTick + _currentTickId(batchId) + 1) * b.tickDuration;
    if (block.timestamp >= tickEnd - b.lockOffset) revert BettingLocked();
}
```

**Step 7: Remove old functions**

Delete `updateBatchMarkets()`, `createBatch()` (replaced by `createBatchAndJoin`). Remove `marketIds`, `resolutionTypes`, `customThresholds` from old Batch struct.

**Step 8: Compile contracts**

```bash
forge build
```

**Step 9: Commit**

```bash
git add contracts/src/vision/Vision.sol contracts/src/interfaces/IVision.sol
git commit -m "feat(contracts): hash-based batches with lazy promotion, atomic createBatchAndJoin, lock windows"
```

---

## Task 5: Issuer — BatchConfigOrchestrator (Bridge Orchestrator Pattern)

**Files:**
- Create: `issuer/src/vision/batch_config_orchestrator.rs`
- Modify: `issuer/src/vision/mod.rs` (add module)
- Modify: `common/src/types/p2p.rs` (add new P2PMessage variants)
- Modify: `issuer/src/consensus/protocol.rs` (spawn orchestrator, NOT inside run_cycle)

This runs as an **independent async task** — separate from the settlement consensus cycle (which has a full 800ms budget already: 200+150+200+250). The orchestrator has its own timing, own leader rotation, and own SignatureCollector.

**Step 1: Add P2PMessage variants**

In `common/src/types/p2p.rs`, add two new variants to the `P2PMessage` enum:

```rust
/// Leader proposes batch configs for all sources (composite hash).
/// Carries round number for leader rotation, NOT cycle_number.
BatchConfigProposal {
    round: u64,
    /// Per-source configs proposed by leader
    configs: Vec<ProposedBatchConfig>,
    /// Composite hash: keccak256(concat(sorted config hashes))
    composite_hash: H256,
},

/// Follower co-signs the composite batch config hash (or rejects).
BatchConfigSign {
    round: u64,
    composite_hash: H256,
    /// BLS signature over the composite hash (empty if rejecting)
    bls_signature: Vec<u8>,
    accepted: bool,
    reject_reason: Option<String>,
},
```

Add the `ProposedBatchConfig` struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposedBatchConfig {
    pub source_id: String,
    pub config_hash: H256,
    pub tick_duration_secs: u64,
    pub lock_offset_secs: u64,
    pub markets: Vec<ProposedMarket>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposedMarket {
    pub asset_id: String,
    pub resolution_type: String,
    pub threshold_bps: u32,
}
```

**Step 2: Create `batch_config_orchestrator.rs`**

```rust
//! Batch config consensus — bridge orchestrator pattern.
//!
//! Runs as independent async task, separate from settlement cycle.
//! Own timing, own leader rotation (round % num_issuers), own SignatureCollector.
//!
//! Flow:
//!   Leader: poll data-node → propose composite hash → collect BLS co-signs → publish
//!   Follower: receive proposal → verify ±50% → BLS co-sign → replicate config to own DN

use std::sync::Arc;
use std::collections::HashMap;
use chrono::Utc;
use ethers::types::H256;
use serde::{Deserialize, Serialize};
use tracing::{info, warn, error};

/// Tolerance for follower verification
const THRESHOLD_TOLERANCE: f64 = 0.50;
const ASSET_COUNT_TOLERANCE: f64 = 0.50;
/// Max fraction of leader's markets that follower doesn't know about
const UNKNOWN_ASSET_TOLERANCE: f64 = 0.20;
/// How often to run batch config consensus (seconds)
const ORCHESTRATOR_INTERVAL_SECS: u64 = 120;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendedBatchesResponse {
    pub generated_at: String,
    pub batch_count: usize,
    pub total_markets: usize,
    pub batches: Vec<RecommendedBatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendedBatch {
    pub source_id: String,
    pub display_name: String,
    pub config_hash: String,
    pub tick_duration_secs: u64,
    pub lock_offset_secs: u64,
    pub markets: Vec<RecommendedMarket>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendedMarket {
    pub asset_id: String,
    pub resolution_type: String,
    pub threshold_bps: u32,
    pub threshold_source: String,
}

/// Fetch recommended batches from data-node.
pub async fn fetch_recommended(data_node_url: &str) -> Result<Vec<RecommendedBatch>, reqwest::Error> {
    let url = format!("{}/batches/recommended", data_node_url);
    let resp: RecommendedBatchesResponse = reqwest::get(&url).await?.json().await?;
    Ok(resp.batches)
}

/// Fetch full config by hash from data-node.
pub async fn fetch_config_by_hash(
    data_node_url: &str,
    hash: &str,
) -> Result<RecommendedBatch, reqwest::Error> {
    let url = format!("{}/batches/config/{}", data_node_url, hash);
    reqwest::get(&url).await?.json().await
}

/// Verify a leader's proposed source config against follower's own view.
/// Returns Ok(()) if acceptable, Err(reason) if not.
pub fn verify_single_source(
    leader: &RecommendedBatch,
    follower: &RecommendedBatch,
) -> Result<(), String> {
    if leader.source_id != follower.source_id {
        return Err("source_id mismatch".into());
    }

    // Tick duration and lock offset must match exactly (deterministic)
    if leader.tick_duration_secs != follower.tick_duration_secs {
        return Err("tick_duration mismatch".into());
    }
    if leader.lock_offset_secs != follower.lock_offset_secs {
        return Err("lock_offset mismatch".into());
    }

    // Asset count within ±50%
    let leader_count = leader.markets.len() as f64;
    let follower_count = follower.markets.len() as f64;
    if follower_count > 0.0 {
        let ratio = (leader_count - follower_count).abs() / follower_count;
        if ratio > ASSET_COUNT_TOLERANCE {
            return Err(format!(
                "asset count: leader={}, follower={}, ratio={:.0}%",
                leader_count as usize, follower_count as usize, ratio * 100.0
            ));
        }
    }

    // Build follower lookup for threshold comparison
    let follower_map: HashMap<&str, u32> = follower.markets.iter()
        .map(|m| (m.asset_id.as_str(), m.threshold_bps))
        .collect();

    // Check unknown asset tolerance
    let unknown_count = leader.markets.iter()
        .filter(|m| !follower_map.contains_key(m.asset_id.as_str()))
        .count();
    if leader.markets.len() > 0 {
        let unknown_ratio = unknown_count as f64 / leader.markets.len() as f64;
        if unknown_ratio > UNKNOWN_ASSET_TOLERANCE {
            return Err(format!(
                "unknown assets: {}/{} ({:.0}%)",
                unknown_count, leader.markets.len(), unknown_ratio * 100.0
            ));
        }
    }

    // For overlapping assets, check threshold tolerance
    let mut checked = 0;
    let mut divergent = 0;
    for leader_market in &leader.markets {
        if let Some(&follower_bps) = follower_map.get(leader_market.asset_id.as_str()) {
            checked += 1;
            let leader_bps = leader_market.threshold_bps as f64;
            let follower_bps_f = follower_bps as f64;
            if leader_bps == 0.0 && follower_bps_f == 0.0 {
                continue;
            }
            let denom = follower_bps_f.max(1.0);
            let ratio = (leader_bps - follower_bps_f).abs() / denom;
            if ratio > THRESHOLD_TOLERANCE {
                divergent += 1;
            }
        }
    }

    if checked > 0 && (divergent as f64 / checked as f64) > 0.5 {
        return Err(format!(
            "threshold divergence: {}/{} assets diverge >50%",
            divergent, checked
        ));
    }

    Ok(())
}
```

**Step 3: Add orchestrator run loop**

```rust
pub struct BatchConfigOrchestrator {
    data_node_url: String,
    admin_token: String,
    round: u64,
    last_signed_hashes: HashMap<String, String>, // source_id → last signed config_hash
}

impl BatchConfigOrchestrator {
    pub fn new(data_node_url: String, admin_token: String) -> Self {
        Self {
            data_node_url,
            admin_token,
            round: 0,
            last_signed_hashes: HashMap::new(),
        }
    }

    /// Main orchestrator loop. Runs independently from settlement consensus.
    pub async fn run(
        &mut self,
        // References to P2P transport, BLS signer, issuer config
        // (exact types depend on existing codebase — adapt to match)
    ) {
        info!("BatchConfigOrchestrator started (interval={}s)", ORCHESTRATOR_INTERVAL_SECS);

        loop {
            self.round += 1;

            // Determine leader for this round
            // let is_leader = (self.round % num_issuers) == my_issuer_index;
            //
            // if is_leader {
            //     self.run_leader_round().await;
            // }
            // // Follower: handled via P2P message handler for BatchConfigProposal
            //
            // On successful consensus:
            //   1. Leader publishes signed config to own DN via POST /batches/signed
            //   2. Leader broadcasts to followers
            //   3. Followers replicate to own DN via POST /batches/replicate

            tokio::time::sleep(std::time::Duration::from_secs(ORCHESTRATOR_INTERVAL_SECS)).await;
        }
    }

    /// Leader: propose all source configs in a single composite round.
    async fn run_leader_round(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let batches = fetch_recommended(&self.data_node_url).await?;

        // Filter to configs that actually changed
        let changed: Vec<&RecommendedBatch> = batches.iter()
            .filter(|b| {
                self.last_signed_hashes.get(&b.source_id)
                    .map(|h| h != &b.config_hash)
                    .unwrap_or(true)
            })
            .collect();

        if changed.is_empty() {
            return Ok(());
        }

        info!(
            round = self.round,
            changed = changed.len(),
            total = batches.len(),
            "Proposing batch config round"
        );

        // Build composite hash: keccak256(concat(sorted config hashes))
        // ... (send P2PMessage::BatchConfigProposal, collect signs, aggregate BLS)

        Ok(())
    }

    /// Follower: handle incoming BatchConfigProposal.
    pub async fn handle_proposal(
        &self,
        configs: &[RecommendedBatch],  // leader's proposed configs
    ) -> Result<bool, String> {
        // Fetch own data-node's view
        let own_batches = fetch_recommended(&self.data_node_url).await
            .map_err(|e| format!("failed to fetch own recommendations: {}", e))?;

        let own_map: HashMap<&str, &RecommendedBatch> = own_batches.iter()
            .map(|b| (b.source_id.as_str(), b))
            .collect();

        let mut accept_count = 0;
        let mut reject_count = 0;

        for leader_config in configs {
            match own_map.get(leader_config.source_id.as_str()) {
                Some(own_config) => {
                    match verify_single_source(leader_config, own_config) {
                        Ok(()) => accept_count += 1,
                        Err(reason) => {
                            warn!(
                                source = %leader_config.source_id,
                                %reason,
                                "Rejecting leader's batch config"
                            );
                            reject_count += 1;
                        }
                    }
                }
                None => {
                    // Source unknown to follower — acceptable if within tolerance
                    accept_count += 1;
                }
            }
        }

        // Accept if majority of sources pass verification
        let total = accept_count + reject_count;
        if total > 0 && (accept_count as f64 / total as f64) >= 0.5 {
            Ok(true)
        } else {
            Err(format!("too many rejections: {}/{}", reject_count, total))
        }
    }

    /// After successful consensus, publish signed config to own data-node.
    async fn publish_to_data_node(
        &self,
        config: &RecommendedBatch,
        bls_signature: &[u8],
        signers_bitmask: u64,
        reference_nonce: u64,
    ) -> Result<(), reqwest::Error> {
        let client = reqwest::Client::new();
        client.post(&format!("{}/batches/signed", self.data_node_url))
            .header("x-admin-token", &self.admin_token)
            .json(&serde_json::json!({
                "sourceId": config.source_id,
                "config": config,
                "configHash": config.config_hash,
                "blsSignature": hex::encode(bls_signature),
                "signersBitmask": signers_bitmask,
                "referenceNonce": reference_nonce,
                "tickDurationSecs": config.tick_duration_secs,
                "lockOffsetSecs": config.lock_offset_secs,
            }))
            .send()
            .await?;
        Ok(())
    }

    /// Follower: replicate leader's config to own data-node.
    async fn replicate_to_own_data_node(
        &self,
        config: &RecommendedBatch,
        bls_signature: &[u8],
        signers_bitmask: u64,
        reference_nonce: u64,
    ) -> Result<(), reqwest::Error> {
        let client = reqwest::Client::new();
        client.post(&format!("{}/batches/replicate", self.data_node_url))
            .header("x-admin-token", &self.admin_token)
            .json(&serde_json::json!({
                "sourceId": config.source_id,
                "config": config,
                "configHash": config.config_hash,
                "blsSignature": hex::encode(bls_signature),
                "signersBitmask": signers_bitmask,
                "referenceNonce": reference_nonce,
                "tickDurationSecs": config.tick_duration_secs,
                "lockOffsetSecs": config.lock_offset_secs,
            }))
            .send()
            .await?;
        Ok(())
    }
}
```

**Step 4: Spawn orchestrator in consensus/protocol.rs**

In `issuer/src/consensus/protocol.rs`, add the orchestrator as a separate spawned task (NOT inside `run_cycle()`):

```rust
// In ConsensusState or wherever issuer initialization happens:
let orchestrator = Arc::new(RwLock::new(
    BatchConfigOrchestrator::new(data_node_url.clone(), admin_token.clone())
));

// Spawn as independent task
let orch = orchestrator.clone();
tokio::spawn(async move {
    orch.write().await.run(/* ... */).await;
});
```

**Step 5: Add to `mod.rs`**

```rust
pub mod batch_config_orchestrator;
```

**Step 6: Commit**

```bash
git add issuer/src/vision/batch_config_orchestrator.rs issuer/src/vision/mod.rs \
    common/src/types/p2p.rs issuer/src/consensus/protocol.rs
git commit -m "feat(issuer): BatchConfigOrchestrator with bridge orchestrator pattern and P2P consensus"
```

---

## Task 6: Issuer — Update Resolver for Dynamic Configs

**Files:**
- Modify: `issuer/src/vision/resolver.rs`
- Modify: `issuer/src/vision/types.rs`
- Modify: `issuer/src/vision/engine.rs`

**Step 1: Add MarketConfig type to `types.rs`**

```rust
/// Per-market config from off-chain batch config.
/// Replaces on-chain market_ids/resolution_types/custom_thresholds.
pub struct MarketConfig {
    pub asset_id: String,
    pub market_id: H256,         // keccak256(asset_id)
    pub resolution_type: u8,     // 0-7 (parsed from "up_x" string)
    pub threshold_bps: u32,
}
```

**Step 2: Update Rust Batch struct in `types.rs`**

```rust
pub struct Batch {
    pub id: u64,
    pub creator: Address,
    pub source_id: H256,              // keccak256 of source_id string
    pub config_hash: H256,            // active config hash
    pub next_config_hash: H256,       // pending (promoted at tick boundary)
    pub tick_duration: u64,
    pub lock_offset: u64,             // active lock window
    pub next_lock_offset: u64,        // pending lock window
    pub created_at_tick: u64,
    pub last_promotion_tick: u64,
    pub paused: bool,
}
```

**Step 3: Add config fetch + cache to `engine.rs`**

Replace references to `batch.market_ids` (lines 252, 259, 314) with config-fetched market list:

```rust
use std::collections::HashMap;
use tokio::sync::RwLock;

/// Cache of fetched configs to avoid re-fetching within same tick
struct ConfigCache {
    configs: RwLock<HashMap<H256, Vec<MarketConfig>>>,
}

impl ConfigCache {
    fn new() -> Self {
        Self { configs: RwLock::new(HashMap::new()) }
    }

    async fn get_or_fetch(
        &self,
        data_node_url: &str,
        config_hash: &H256,
    ) -> Result<Vec<MarketConfig>, Box<dyn std::error::Error + Send + Sync>> {
        // Check cache first
        {
            let cache = self.configs.read().await;
            if let Some(configs) = cache.get(config_hash) {
                return Ok(configs.clone());
            }
        }

        // Fetch from data-node
        let hash_hex = format!("0x{}", hex::encode(config_hash));
        let batch = batch_config_orchestrator::fetch_config_by_hash(
            data_node_url, &hash_hex,
        ).await?;

        let market_configs: Vec<MarketConfig> = batch.markets.iter()
            .map(|m| MarketConfig {
                asset_id: m.asset_id.clone(),
                market_id: keccak256(m.asset_id.as_bytes()).into(),
                resolution_type: parse_resolution_type(&m.resolution_type),
                threshold_bps: m.threshold_bps,
            })
            .collect();

        // Cache it
        self.configs.write().await.insert(*config_hash, market_configs.clone());

        Ok(market_configs)
    }
}
```

In the engine loop, replace `batch.market_ids` references:

```rust
// OLD: let prices = fetch_market_prices(&url, &batch.market_ids, ...).await;
// NEW:
let market_configs = config_cache.get_or_fetch(&config.data_node_url, &batch.config_hash).await?;
let market_ids: Vec<H256> = market_configs.iter().map(|m| m.market_id).collect();
let prices = fetch_market_prices(&config.data_node_url, &market_ids, &reference_prices, now).await?;
```

**Step 4: Make `fetch_market_prices` return Result**

Currently silently returns empty on failure. Change to:

```rust
async fn fetch_market_prices(
    data_node_url: &str,
    market_ids: &[H256],
    reference_prices: &HashMap<H256, f64>,
    now: u64,
) -> Result<MarketPrices, Box<dyn std::error::Error + Send + Sync>> {
    // ... existing logic but propagate errors with ?
}
```

**Step 5: Persist reference_prices to DB**

After resolution, write reference prices to `vision_reference_prices` table:

```rust
async fn persist_reference_prices(
    pool: &PgPool,
    batch_id: u64,
    prices: &HashMap<H256, f64>,
) -> Result<(), sqlx::Error> {
    for (market_id, price) in prices {
        sqlx::query(
            r#"
            INSERT INTO vision_reference_prices (batch_id, market_id, price, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (batch_id, market_id) DO UPDATE SET price = $3, updated_at = NOW()
            "#,
        )
        .bind(batch_id as i64)
        .bind(market_id.as_bytes())
        .bind(Decimal::try_from(*price).unwrap_or_default())
        .execute(pool)
        .await?;
    }
    Ok(())
}

/// Load reference prices from DB on startup (crash recovery).
async fn load_reference_prices(
    pool: &PgPool,
    batch_id: u64,
) -> Result<HashMap<H256, f64>, sqlx::Error> {
    let rows: Vec<(Vec<u8>, Decimal)> = sqlx::query_as(
        "SELECT market_id, price FROM vision_reference_prices WHERE batch_id = $1"
    )
    .bind(batch_id as i64)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter()
        .filter_map(|(id, price)| {
            let h: H256 = H256::from_slice(&id);
            let p: f64 = price.to_string().parse().ok()?;
            Some((h, p))
        })
        .collect())
}
```

**Step 6: Update `resolve_tick()` signature**

Add `market_configs` parameter:

```rust
pub async fn resolve_tick(
    &self,
    batch: &Batch,
    tick_id: u64,
    players: &[PlayerPosition],
    prices: &MarketPrices,
    now: u64,
    market_configs: &[MarketConfig],  // per-market resolution_type + threshold
) -> Result<TickResult, ResolverError>
```

Inside the resolver, replace `batch.market_ids[i]`, `batch.resolution_types[i]`, etc. with `market_configs[i].market_id`, `market_configs[i].resolution_type`, etc.

Cancelled assets (stale/missing data): outcome = `MarketOutcome::Cancelled`. That market is **skipped** — no weight redistribution to remaining markets. This is already the correct behavior in the existing resolver.

**Step 7: Record settlements for threshold feedback**

After successful tick resolution:

```rust
// POST settlement results to data-node for threshold feedback loop
let settlements: Vec<serde_json::Value> = tick_result.market_results.iter()
    .filter(|r| r.outcome != MarketOutcome::Cancelled)
    .map(|r| serde_json::json!({
        "sourceId": source_id,
        "assetId": r.asset_id,
        "configHash": format!("0x{}", hex::encode(batch.config_hash)),
        "startPrice": r.start_price,
        "endPrice": r.end_price,
        "changePct": r.pct_change,
    }))
    .collect();

if !settlements.is_empty() {
    let client = reqwest::Client::new();
    let _ = client.post(&format!("{}/batches/settlement", config.data_node_url))
        .header("x-admin-token", &config.admin_token)
        .json(&settlements)
        .send()
        .await;
}
```

**Step 8: Commit**

```bash
git add issuer/src/vision/resolver.rs issuer/src/vision/types.rs issuer/src/vision/engine.rs
git commit -m "feat(issuer): dynamic per-market thresholds from off-chain config with crash recovery"
```

---

## Task 7: Issuer — Update Chain Listener + Tick Scheduler Persistence

**Files:**
- Modify: `issuer/src/vision/chain_listener.rs`
- Modify: `issuer/src/vision/tick_scheduler.rs`

**Step 1: Update chain_listener.rs ABI decoding**

In `fetch_batch_from_contract()` and `handle_batch_created()`, update decoding for new Batch struct:

```rust
// Decode new struct fields from contract call return
let creator: Address = /* decoded */;
let source_id: H256 = /* decoded */;
let config_hash: H256 = /* decoded */;
let next_config_hash: H256 = /* decoded */;
let tick_duration: U256 = /* decoded */;
let lock_offset: U256 = /* decoded */;
let next_lock_offset: U256 = /* decoded */;
let created_at_tick: U256 = /* decoded */;
let last_promotion_tick: U256 = /* decoded */;
let paused: bool = /* decoded */;

Batch {
    id: batch_id,
    creator,
    source_id,
    config_hash,
    next_config_hash,
    tick_duration: tick_duration.as_u64(),
    lock_offset: lock_offset.as_u64(),
    next_lock_offset: next_lock_offset.as_u64(),
    created_at_tick: created_at_tick.as_u64(),
    last_promotion_tick: last_promotion_tick.as_u64(),
    paused,
}
```

Add handler for `BatchConfigUpdated` event and `BatchConfigPromoted` event.

Add handler for `BatchCreated` event (new signature with `sourceId`).

**Step 2: Persist `last_resolved` in tick_scheduler.rs**

Currently `last_resolved` is in-memory only. Add DB persistence:

```rust
/// Mark a tick as resolved — write to DB for crash recovery.
pub async fn mark_resolved(
    &mut self,
    pool: &PgPool,
    batch_id: u64,
    tick_id: u64,
) -> Result<(), sqlx::Error> {
    self.last_resolved.insert(batch_id, tick_id);

    sqlx::query(
        r#"
        INSERT INTO vision_last_resolved (batch_id, last_tick_id, resolved_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (batch_id) DO UPDATE SET last_tick_id = $2, resolved_at = NOW()
        "#,
    )
    .bind(batch_id as i64)
    .bind(tick_id as i64)
    .execute(pool)
    .await?;

    Ok(())
}

/// Load last_resolved from DB on startup (crash recovery).
pub async fn load_from_db(&mut self, pool: &PgPool) -> Result<(), sqlx::Error> {
    let rows: Vec<(i64, i64)> = sqlx::query_as(
        "SELECT batch_id, last_tick_id FROM vision_last_resolved"
    )
    .fetch_all(pool)
    .await?;

    for (batch_id, tick_id) in rows {
        self.last_resolved.insert(batch_id as u64, tick_id as u64);
    }

    info!(count = self.last_resolved.len(), "Loaded last_resolved from DB");
    Ok(())
}
```

**Step 3: Commit**

```bash
git add issuer/src/vision/chain_listener.rs issuer/src/vision/tick_scheduler.rs
git commit -m "feat(issuer): update chain listener for new Batch struct + persist last_resolved"
```

---

## Task 8: Integration Testing

**Files:**
- Add tests to: `data-node/src/batch_engine.rs` (inline `#[cfg(test)]` module)

**Step 1: Test ABI-encoded hash computation**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lock_offset_fast() {
        assert_eq!(lock_offset_for_interval(60), 9);   // 60 * 0.15 = 9
    }

    #[test]
    fn test_lock_offset_medium() {
        assert_eq!(lock_offset_for_interval(600), 90);  // 600 * 0.15 = 90
    }

    #[test]
    fn test_lock_offset_slow() {
        assert_eq!(lock_offset_for_interval(86400), 3456); // 86400 * 0.04 = 3456
    }

    #[test]
    fn test_lock_offset_minimum() {
        assert_eq!(lock_offset_for_interval(10), 5);  // 10 * 0.15 = 1.5, clamped to MIN=5
    }

    #[test]
    fn test_sanitize_threshold_bps_normal() {
        assert_eq!(sanitize_threshold_bps(1.5), 150);   // 1.5% → 150 bps
        assert_eq!(sanitize_threshold_bps(0.01), 1);    // 0.01% → 1 bps
        assert_eq!(sanitize_threshold_bps(50.0), 5000);  // 50% → 5000 bps
    }

    #[test]
    fn test_sanitize_threshold_bps_clamp() {
        assert_eq!(sanitize_threshold_bps(200.0), 10000); // 200% clamped to 10000
        assert_eq!(sanitize_threshold_bps(999.0), 10000); // 999% clamped to 10000
    }

    #[test]
    fn test_sanitize_threshold_bps_invalid() {
        assert_eq!(sanitize_threshold_bps(f64::NAN), 0);
        assert_eq!(sanitize_threshold_bps(f64::INFINITY), 0);
        assert_eq!(sanitize_threshold_bps(f64::NEG_INFINITY), 0);
        assert_eq!(sanitize_threshold_bps(-5.0), 0);
    }

    #[test]
    fn test_config_hash_deterministic() {
        let markets = vec![
            BatchMarket {
                asset_id: "bitcoin".into(),
                resolution_type: "up_x".into(),
                threshold_bps: 200,
                threshold_source: "last_batch".into(),
            },
        ];
        let h1 = compute_config_hash("crypto", 600, 90, &markets);
        let h2 = compute_config_hash("crypto", 600, 90, &markets);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_config_hash_order_independent() {
        // Order shouldn't matter — hash sorts by asset_id
        let markets_a = vec![
            BatchMarket { asset_id: "bitcoin".into(), resolution_type: "up_x".into(), threshold_bps: 200, threshold_source: "last_batch".into() },
            BatchMarket { asset_id: "ethereum".into(), resolution_type: "up_x".into(), threshold_bps: 300, threshold_source: "24h_history".into() },
        ];
        let markets_b = vec![
            BatchMarket { asset_id: "ethereum".into(), resolution_type: "up_x".into(), threshold_bps: 300, threshold_source: "24h_history".into() },
            BatchMarket { asset_id: "bitcoin".into(), resolution_type: "up_x".into(), threshold_bps: 200, threshold_source: "last_batch".into() },
        ];
        assert_eq!(
            compute_config_hash("crypto", 600, 90, &markets_a),
            compute_config_hash("crypto", 600, 90, &markets_b),
        );
    }

    #[test]
    fn test_config_hash_threshold_source_excluded() {
        // threshold_source is metadata-only — excluded from hash
        let m1 = vec![BatchMarket {
            asset_id: "bitcoin".into(),
            resolution_type: "up_x".into(),
            threshold_bps: 200,
            threshold_source: "last_batch".into(),
        }];
        let m2 = vec![BatchMarket {
            asset_id: "bitcoin".into(),
            resolution_type: "up_x".into(),
            threshold_bps: 200,
            threshold_source: "24h_history".into(), // different source
        }];
        assert_eq!(
            compute_config_hash("crypto", 600, 90, &m1),
            compute_config_hash("crypto", 600, 90, &m2),
        );
    }

    #[test]
    fn test_config_hash_different_params() {
        let markets = vec![BatchMarket {
            asset_id: "bitcoin".into(),
            resolution_type: "up_x".into(),
            threshold_bps: 200,
            threshold_source: "last_batch".into(),
        }];
        let h1 = compute_config_hash("crypto", 600, 90, &markets);
        let h2 = compute_config_hash("crypto", 300, 90, &markets);  // different tick
        let h3 = compute_config_hash("stocks", 600, 90, &markets);  // different source
        assert_ne!(h1, h2);
        assert_ne!(h1, h3);
    }
}
```

**Step 2: Run tests**

```bash
cargo test -p data-node batch_engine
```

**Step 3: Commit**

```bash
git add data-node/src/batch_engine.rs
git commit -m "test(data-node): batch engine unit tests for ABI hashing, thresholds, and sanitization"
```

---

## Task 9: Frontend — Read Signed Configs and Build Batch Transactions

**Files:**
- Create: `frontend/hooks/useSignedBatches.ts`
- Modify: Frontend Vision betting components (wherever `joinBatch` is called)

**Step 1: Create `useSignedBatches` hook with adaptive polling**

```typescript
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

export interface SignedBatchMarket {
  assetId: string
  resolutionType: string
  thresholdBps: number
  thresholdSource: string
}

export interface SignedBatch {
  sourceId: string
  displayName: string
  configHash: string
  tickDurationSecs: number
  lockOffsetSecs: number
  markets: SignedBatchMarket[]
  blsSignature: string
  signersBitmask: number
  referenceNonce: number
  signedAt: string
}

interface SignedBatchesResponse {
  generatedAt: string
  batches: SignedBatch[]
}

const NORMAL_POLL_MS = 15_000
const FAST_POLL_MS = 5_000  // near tick boundary

export function useSignedBatches() {
  const [batches, setBatches] = useState<Record<string, SignedBatch>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const resp = await fetch(`${DATA_NODE_URL}/batches/signed`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data: SignedBatchesResponse = await resp.json()

      // Key by sourceId for O(1) lookup
      const map: Record<string, SignedBatch> = {}
      for (const b of data.batches ?? []) {
        map[b.sourceId] = b
      }
      setBatches(map)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch signed batches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, NORMAL_POLL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  /** Check if config changed (call before submitting tx) */
  const hasConfigChanged = useCallback(
    (sourceId: string, knownHash: string): boolean => {
      const current = batches[sourceId]
      return current ? current.configHash !== knownHash : false
    },
    [batches],
  )

  return { batches, loading, error, refresh, hasConfigChanged }
}
```

**Step 2: Use existing `encodeBitmap()` — do NOT rewrite**

The existing `frontend/lib/vision/bitmap.ts` already uses the correct MSB-first convention (`7 - (i % 8)`), matching the resolver's `get_bitmap_bit()`. Use it directly:

```typescript
import { encodeBitmap, hashBitmap, BetDirection } from '@/lib/vision/bitmap'

// Build bitmap from user selections
// Markets must be sorted by assetId (same as hash computation)
function buildBitmapFromSelections(
  markets: SignedBatchMarket[],
  selections: Map<string, 'UP' | 'DOWN' | null>,
): { bitmap: Uint8Array; bitmapHash: `0x${string}` } {
  const sorted = [...markets].sort((a, b) => a.assetId.localeCompare(b.assetId))

  const bets: BetDirection[] = sorted.map((m) => {
    const sel = selections.get(m.assetId)
    return sel ?? 'DOWN' // null = skip = DOWN (no opinion)
  })

  const bitmap = encodeBitmap(bets, sorted.length)
  const bitmapHash = hashBitmap(bitmap)
  return { bitmap, bitmapHash }
}
```

**Step 3: Transaction flow — `createBatchAndJoin` or `joinBatch`**

```typescript
import { useContract } from '@/hooks/useContract' // existing hook

async function placeBet(
  sourceId: string,
  batch: SignedBatch,
  bitmapHash: `0x${string}`,
  depositAmount: bigint,
  stakePerTick: bigint,
  visionContract: ethers.Contract,
) {
  const sourceIdHash = ethers.keccak256(ethers.toUtf8Bytes(sourceId))

  // Check if batch already exists on-chain
  const hasBatch = await visionContract.sourceIdHasBatch(sourceIdHash)

  if (hasBatch) {
    // Join existing batch
    const batchId = await visionContract.sourceIdToBatchId(sourceIdHash)
    const tx = await visionContract.joinBatch(
      batchId,
      batch.configHash,
      bitmapHash,
      depositAmount,
      stakePerTick,
    )
    return tx
  } else {
    // Atomic create + join
    const tx = await visionContract.createBatchAndJoin(
      sourceIdHash,
      batch.configHash,
      batch.tickDurationSecs,
      batch.lockOffsetSecs,
      `0x${batch.blsSignature}`,
      batch.referenceNonce,
      batch.signersBitmask,
      bitmapHash,
      depositAmount,
      stakePerTick,
    )
    return tx
  }
}
```

**Step 4: Config change detection (preflight check)**

Before submitting a transaction, check if the config has changed since the user loaded the page:

```typescript
// Before submitting tx:
if (hasConfigChanged(sourceId, batch.configHash)) {
  // Refresh and show updated markets to user
  await refresh()
  showWarning('Market config has been updated. Please review and confirm your selections.')
  return
}
```

**Step 5: Commit**

```bash
git add frontend/hooks/useSignedBatches.ts
git commit -m "feat(frontend): useSignedBatches hook with adaptive polling, config change detection, createBatchAndJoin flow"
```

---

## Task 10: Solidity Tests — Hash Verification Cross-Check

**Files:**
- Create: `contracts/test/VisionBatch.t.sol`

**Step 1: Write cross-chain hash verification test**

Verify that the Solidity `keccak256(abi.encode(...))` produces the same hash as Rust's `ethers::abi::encode()` + `keccak256()`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/vision/Vision.sol";

contract VisionBatchTest is Test {
    Vision vision;

    function setUp() public {
        // Deploy Vision with test BLS keys
        // ... (adapt to existing test infrastructure)
    }

    function test_configHashMatches() public {
        // This hash should match what Rust's compute_config_hash produces
        // for the same inputs. Compute in Rust, paste expected here.
        bytes32 marketHash = keccak256(abi.encode(
            "bitcoin",     // asset_id (String)
            "up_x",        // resolution_type (String)
            uint256(200)   // threshold_bps
        ));

        bytes32 marketsRoot = keccak256(abi.encodePacked(marketHash));

        bytes32 configHash = keccak256(abi.encode(
            "crypto",      // source_id (String)
            uint256(600),  // tick_duration
            uint256(90),   // lock_offset
            marketsRoot    // FixedBytes(32)
        ));

        // This value should be asserted against the Rust test output
        assertTrue(configHash != bytes32(0), "hash should be non-zero");
    }

    function test_createBatchAndJoin_idempotent() public {
        // Create batch for sourceId
        bytes32 sourceId = keccak256("test_source");
        // ... call createBatchAndJoin with valid BLS sig
        // ... call again — should join existing, not create new
    }

    function test_lazyPromotion() public {
        // Create batch, update config, advance time, verify promotion
    }

    function test_lockWindow() public {
        // Advance to lock window, verify joinBatch reverts
    }
}
```

**Step 2: Run tests**

```bash
forge test --match-contract VisionBatchTest -vv
```

**Step 3: Commit**

```bash
git add contracts/test/VisionBatchTest.t.sol
git commit -m "test(contracts): Vision batch hash verification and lazy promotion tests"
```

---

## Execution Order & Parallelism

```
Task 1 (DB migration 024) ──┐
                             ├──► Task 2 (BatchEngine) ──► Task 3 (API endpoints) ──► Task 8 (Tests)
                             │
Task 4 (Vision.sol)──────────┤
                             │
                             ├──► Task 5 (BatchConfigOrchestrator) ──► Task 6 (Resolver) ──► Task 7 (ChainListener)
                             │
                             └──► Task 9 (Frontend) ← depends on Task 3 API being defined
                             │
                             └──► Task 10 (Solidity tests) ← depends on Task 4
```

**Parallel groups (max 3 agents per CLAUDE.md):**
- **Agent 1:** Tasks 1 → 2 → 3 → 8 (data-node: DB, engine, API, tests)
- **Agent 2:** Tasks 4 → 9 → 10 (contracts + frontend + Solidity tests)
- **Agent 3:** Tasks 5 → 6 → 7 (issuer: orchestrator, resolver, chain listener)

**Key architectural decisions:**
- Batch config consensus runs as **independent async task** (bridge orchestrator pattern), NOT inside `run_cycle()` which has 800ms budget already full
- Config hash uses **ABI encoding** (ethers in Rust, abi.encode in Solidity) — NOT JSON serialization
- BLS messages use **domain separation**: `keccak256(abi.encode(chainid, address, TAG, ...))`
- Thresholds are **always `up_x`** (direction-agnostic) — never `down_x` in auto-batches
- Bitmap convention: **MSB-first** per byte (`7 - (index % 8)`) — matches existing `bitmap.ts` and resolver
- Existing BLSVerifier nonce window handles replay protection — **no second nonce mechanism**
- Cancelled assets are **skipped** — no weight redistribution to remaining markets
- `last_resolved` and `reference_prices` **persisted to Postgres** for crash recovery
- Signed configs **persisted to DB** with in-memory cache for fast reads
- All POST endpoints require **admin token auth**
- Sources with >256 healthy assets: **top 256 by volume**, no subsetting in v1
