//! Auto-batch engine.
//!
//! Computes recommended Vision batch configs per data source.
//! One rolling batch per source. Markets = all healthy assets (max 256).
//! Thresholds and resolution types adapt to recent volatility.
//! Hash uses ABI encoding (ethers) to match Solidity's abi.encode.

use std::collections::HashMap;
use std::sync::{Arc, OnceLock, RwLock as StdRwLock};
use std::time::Instant;

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use ethers::abi::{encode, Token};
use ethers::core::utils::keccak256;
use ethers::types::U256;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::market_data::traits::BatchStrategy;

// ── Disabled sources ─────────────────────────────────────────────────────
// Sources with no live data, no DB history, and no static fallback.
// Excluded from batch config generation and sync engine registration.
pub const DISABLED_SOURCES: &[&str] = &[
    "paris_metro",
    "aisstream",
    "maritime",
    "ebird",
    "movebank",
    "shelter",
    // External APIs unreachable from EU VPS (geo-blocked, Cloudflare, or no credentials)
    "stackexchange",
    "cbp_border",
    "ioda",
    "reddit",
    "nrc_nuclear",
    // Upstream APIs that stopped publishing fresh data — every batch refunds
    // until they recover. Disabled to keep Vision refund rate sane.
    // Re-enable individually after confirming the upstream is live.
    "nyc311",   // Socrata erm2-nwe9 dataset still in 2020 (abandoned).
    "flights",  // Provider HTTP 503 on every coordinate.
    "weather",  // Open-Meteo daily quota exhausted (free tier); resets at 00:00 UTC.
];

pub fn is_source_disabled(source_id: &str) -> bool {
    DISABLED_SOURCES.contains(&source_id)
}

// ── Global strategy registry ──────────────────────────────────────────────
// Sources register their BatchStrategy at sync engine startup.
// The batch engine reads strategies from here.

static STRATEGY_REGISTRY: OnceLock<StdRwLock<HashMap<String, BatchStrategy>>> = OnceLock::new();

fn strategy_registry() -> &'static StdRwLock<HashMap<String, BatchStrategy>> {
    STRATEGY_REGISTRY.get_or_init(|| StdRwLock::new(HashMap::new()))
}

/// Register a source's batch strategy. Called by SyncEngine on startup.
pub fn register_strategy(source_id: &str, strategy: BatchStrategy) {
    let mut map = strategy_registry().write().unwrap();
    map.insert(source_id.to_string(), strategy);
}

/// Get a source's batch strategy. Returns DEFAULT if not registered.
pub fn get_strategy(source_id: &str) -> BatchStrategy {
    let map = strategy_registry().read().unwrap();
    map.get(source_id).copied().unwrap_or(BatchStrategy::DEFAULT)
}


/// Maximum markets per batch.
/// The on-chain bitmap uses raw bytes (not uint256), so we can go beyond 256.
/// Each byte = 8 markets. 8192 markets = 1024 bytes bitmap.
const MAX_MARKETS_PER_BATCH: usize = 8192;

/// Source metadata tuple: (source_id, display_name, sync_interval_secs).
/// Built at startup from the source registry (sources-display.json).
pub type SourceMeta = (String, String, u64);

// ── Source health tracking ──────────────────────────────────────────────
// Tracks per-source failures so chronically broken sources get temporarily
// excluded from batch generation instead of poisoning every cycle.

/// Default: exclude after 10 consecutive failures.
const DEFAULT_MAX_CONSECUTIVE_FAILURES: u32 = 10;

/// Auto-recover excluded sources after 30 minutes of exile.
const RECOVERY_WINDOW_SECS: u64 = 30 * 60;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceHealth {
    pub consecutive_failures: u32,
    pub total_failures: u64,
    pub total_successes: u64,
    #[serde(skip)]
    pub last_success: Option<Instant>,
    #[serde(skip)]
    pub excluded_since: Option<Instant>,
    pub excluded: bool,
}

impl Default for SourceHealth {
    fn default() -> Self {
        Self {
            consecutive_failures: 0,
            total_failures: 0,
            total_successes: 0,
            last_success: None,
            excluded_since: None,
            excluded: false,
        }
    }
}

pub struct SourceHealthTracker {
    health: DashMap<String, SourceHealth>,
    max_consecutive_failures: u32,
}

impl SourceHealthTracker {
    pub fn new(max_consecutive_failures: u32) -> Self {
        Self {
            health: DashMap::new(),
            max_consecutive_failures,
        }
    }

    /// Record a successful config generation for this source.
    pub fn record_success(&self, source_id: &str) {
        let mut entry = self.health.entry(source_id.to_string()).or_default();
        entry.consecutive_failures = 0;
        entry.total_successes += 1;
        entry.last_success = Some(Instant::now());
        entry.excluded = false;
        entry.excluded_since = None;
    }

    /// Record a failed config generation (None result or zero healthy assets).
    pub fn record_failure(&self, source_id: &str) {
        let mut entry = self.health.entry(source_id.to_string()).or_default();
        entry.consecutive_failures += 1;
        entry.total_failures += 1;
        if entry.consecutive_failures >= self.max_consecutive_failures && !entry.excluded {
            entry.excluded = true;
            entry.excluded_since = Some(Instant::now());
            warn!(
                source = source_id,
                failures = entry.consecutive_failures,
                "Source excluded from batch generation"
            );
        }
    }

    /// Returns true if this source should be skipped this cycle.
    /// Auto-recovers sources excluded for longer than RECOVERY_WINDOW_SECS.
    pub fn should_skip(&self, source_id: &str) -> bool {
        let mut entry = match self.health.get_mut(source_id) {
            Some(e) => e,
            None => return false,
        };
        if !entry.excluded {
            return false;
        }
        // Auto-recover: try again after the exile window
        if let Some(since) = entry.excluded_since {
            if since.elapsed().as_secs() >= RECOVERY_WINDOW_SECS {
                info!(
                    source = source_id,
                    exile_secs = since.elapsed().as_secs(),
                    "Source re-admitted for retry after recovery window"
                );
                entry.excluded = false;
                entry.excluded_since = None;
                entry.consecutive_failures = 0;
                return false;
            }
        }
        true
    }

    /// Snapshot of all tracked sources for the API.
    pub fn snapshot(&self) -> HashMap<String, SourceHealth> {
        self.health.iter().map(|e| (e.key().clone(), e.value().clone())).collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchMarket {
    pub asset_id: String,
    /// Resolution type: flat_x, up_x, up_300, or up_3000 (based on volatility).
    pub resolution_type: String,
    /// Threshold in basis points (e.g. 150 = 1.5%). Clamped to 10000 (100%).
    pub threshold_bps: u32,
    /// Where the threshold came from (metadata only, excluded from hash)
    pub threshold_source: String, // "last_batch", "24h_history", "no_data"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchConfig {
    pub source_id: String,
    pub display_name: String,
    pub config_hash: String, // "0x..." hex
    pub tick_duration_secs: u64,
    pub lock_offset_secs: u64,
    /// Per-source settlement grace window in seconds. Currently derived from
    /// `tick_duration_secs` via the default rule (`min(2 * tick, 86400)`,
    /// floored to 60s — Vision's MIN_SETTLEMENT_GRACE). Not persisted to the
    /// DB schema yet; recomputed on each rebuild.
    #[serde(default)]
    pub settlement_grace_secs: u64,
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
    /// Per-source settlement grace window in seconds (see `BatchConfig`).
    #[serde(default)]
    pub settlement_grace_secs: u64,
    pub markets: Vec<BatchMarket>,
    pub bls_signature: String,  // hex-encoded
    pub signers_bitmask: u64,
    pub reference_nonce: u64,
    pub signed_at: DateTime<Utc>,
}

/// Default rule for `settlement_grace_secs` when no per-source override exists.
/// `min(2 * tick, 86_400)` floored to `MIN_SETTLEMENT_GRACE` (60s) so that a
/// short-tick source like polymarket (60s tick → 120s grace) still satisfies
/// the contract's `[60, 86400]` bound.
pub fn default_settlement_grace_secs(tick_duration_secs: u64) -> u64 {
    tick_duration_secs
        .saturating_mul(2)
        .min(86_400)
        .max(60)
}

/// Compute keccak256 of ABI-encoded batch config.
///
/// Hash structure (matches Solidity):
/// ```text
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

/// Per-source TTL cache for 24h change history.
///
/// The underlying query is a `WITH ranked AS (...)` over `market_prices` (130 GB,
/// 264 M rows). A cold pass burns IO/CPU for ~100 s. The data it returns —
/// "approx pct change over the last 24 h" — does not move appreciably second by
/// second. A 60 s TTL drops query load to once per minute per source while
/// preserving fallback-tier calibration quality. Cache lives behind an
/// `OnceLock<Mutex<...>>` so multiple concurrent callers share the same store.
static TWENTY_FOUR_H_CACHE: OnceLock<std::sync::Mutex<HashMap<String, (Instant, HashMap<String, f64>)>>> = OnceLock::new();

fn twenty_four_h_cache() -> &'static std::sync::Mutex<HashMap<String, (Instant, HashMap<String, f64>)>> {
    TWENTY_FOUR_H_CACHE.get_or_init(|| std::sync::Mutex::new(HashMap::new()))
}

const TWENTY_FOUR_H_CACHE_TTL_SECS: u64 = 60;

/// Get 24h price change % for ALL assets of a source in one query.
/// Returns HashMap<asset_id, change_pct>.
///
/// Result is cached per-source with a 60s TTL — see TWENTY_FOUR_H_CACHE above.
async fn get_all_24h_changes(
    pool: &PgPool,
    source_id: &str,
) -> Result<HashMap<String, f64>, sqlx::Error> {
    // Cache lookup first.
    {
        let guard = twenty_four_h_cache().lock().unwrap();
        if let Some((stored_at, value)) = guard.get(source_id) {
            if stored_at.elapsed().as_secs() < TWENTY_FOUR_H_CACHE_TTL_SECS {
                return Ok(value.clone());
            }
        }
    }

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
              AND value IS NOT NULL
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

    let result: HashMap<String, f64> = rows
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
        .collect();

    {
        let mut guard = twenty_four_h_cache().lock().unwrap();
        guard.insert(source_id.to_string(), (Instant::now(), result.clone()));
    }

    Ok(result)
}

// median_lookback_ticks removed — strategies now live in each source's
// `batch_strategy()` method and are read via get_strategy().

/// Get the median signed change % over the last N settlements per asset.
/// Returns HashMap<asset_id, median_change_pct>.
///
/// The median of signed changes is the natural 50/50 threshold:
/// by definition, ~50% of future values will exceed it.
async fn get_median_settlement_changes(
    pool: &PgPool,
    source_id: &str,
    lookback_ticks: usize,
) -> Result<HashMap<String, f64>, sqlx::Error> {
    // Postgres PERCENTILE_CONT gives exact median
    let rows: Vec<(String, Option<f64>)> = sqlx::query_as(
        r#"
        WITH recent AS (
            SELECT asset_id, change_pct::float8 as change_pct,
                   ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY settled_at DESC) as rn
            FROM batch_settlements
            WHERE source_id = $1
        )
        SELECT asset_id,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY change_pct) as median_change
        FROM recent
        WHERE rn <= $2
        GROUP BY asset_id
        HAVING COUNT(*) >= 3
        "#,
    )
    .bind(source_id)
    .bind(lookback_ticks as i64)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .filter_map(|(id, median)| median.map(|m| (id, m)))
        .collect())
}

/// Get all healthy assets for a source.
/// "Healthy" = has a price in `market_prices_latest` within 2× sync_interval and value > 0.
///
/// Uses `market_prices_latest` (the live snapshot table) as the single source of truth.
/// Some sources write different asset_id formats to `market_assets` vs `market_prices`
/// (e.g. defi writes protocol_* to assets but dex_24h_* to prices), so we query the
/// price table directly rather than joining through the asset registry.
/// Returns max MAX_MARKETS_PER_BATCH assets, sorted by asset_id.
async fn get_healthy_assets(
    pool: &PgPool,
    source_id: &str,
    sync_interval_secs: u64,
) -> Result<Vec<String>, sqlx::Error> {
    // Align with the oracle's staleness ceiling (`max(1800, 2 * tick)`),
    // not 10× tick. The previous "generous window" let the data-node
    // recommend assets the oracle would later cancel as stale, producing
    // rounds where every market resolved Cancelled — github, crypto,
    // tomtom_traffic, tomtom_evcharge all exhibited the pattern.
    //
    // We add the tick once so an asset fetched right at config-build time
    // is still within the threshold at settlement (one tick later).
    let oracle_threshold_secs = (2 * sync_interval_secs).max(1800);
    let cutoff_secs = oracle_threshold_secs.saturating_sub(sync_interval_secs).max(60);
    let staleness_cutoff =
        Utc::now() - chrono::Duration::seconds(cutoff_secs as i64);

    let rows: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT asset_id
        FROM market_prices_latest
        WHERE source = $1
          AND fetched_at >= $2
          AND value IS NOT NULL
        ORDER BY asset_id
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

/// Pick resolution type and threshold based on observed volatility (abs change %).
/// Used as FALLBACK when median calibration has no data.
/// - <0.3% avg change  → "flat_x" with 30 bps (low volatility)
/// - 0.3-3%            → "up_x"   with 30 bps (moderate volatility)
/// - 3-30%             → "up_300" with 300 bps (high volatility)
/// - 30%+              → "up_3000" with 3000 bps (extreme volatility)
fn resolution_for_volatility(change_pct: f64) -> (&'static str, u32) {
    // Use the same exact-threshold logic as resolution_from_median —
    // compute bps from the actual change instead of bucketing into presets.
    let threshold_bps = sanitize_threshold_bps(change_pct.abs());
    let up = change_pct >= 0.0;

    if threshold_bps < 10 {
        return ("flat_x", 30);
    }
    if threshold_bps < 20 {
        return if up { ("up_0", 0) } else { ("down_0", 0) };
    }
    if up { ("up_x", threshold_bps) } else { ("down_x", threshold_bps) }
}

/// Convert a median signed change to a resolution type + threshold.
///
/// Three types only:
/// - `flat_x` — nearly stationary (|median| < 0.1%), ternary: flat/up/down
/// - `up_0` / `down_0` — trivial volatility (0.1-0.2%), any movement wins
/// - `up_x` / `down_x` — everything else, exact median threshold for 50/50
fn resolution_from_median(median_change_pct: f64) -> (&'static str, u32) {
    let threshold_bps = sanitize_threshold_bps(median_change_pct.abs());
    let up = median_change_pct >= 0.0;

    // Nearly stationary — flat within ±threshold
    if threshold_bps < 10 {
        return ("flat_x", 30);
    }

    // Trivial volatility — any directional movement wins
    if threshold_bps < 20 {
        return if up { ("up_0", 0) } else { ("down_0", 0) };
    }

    // Everything else — exact median threshold, 50/50 by construction
    if up { ("up_x", threshold_bps) } else { ("down_x", threshold_bps) }
}

/// Clamp threshold_bps to the source's strategy bounds.
fn clamp_threshold(bps: u32, strategy: &BatchStrategy) -> u32 {
    bps.max(strategy.min_threshold_bps).min(strategy.max_threshold_bps)
}

/// Compute thresholds for all assets of a source in batch.
///
/// Strategy: **median-first calibration** for 50/50 outcomes.
/// Each source defines its own `BatchStrategy` via the `MarketDataSource` trait.
///
/// Priority:
/// 1. Median of last N settlement changes (50/50 by construction)
/// 2. Last batch settlement (fallback to volatility bands)
/// 3. 24h price history (fallback to volatility bands)
/// 4. No data → source's `zero_trend_type`
async fn compute_asset_thresholds(
    pool: &PgPool,
    source_id: &str,
    asset_ids: &[String],
) -> Vec<BatchMarket> {
    let strategy = get_strategy(source_id);

    // Primary: median calibration from settlement history
    let median_changes = get_median_settlement_changes(pool, source_id, strategy.lookback_ticks)
        .await
        .unwrap_or_default();

    // Fallback sources (only queried if median is incomplete)
    let settlement_changes = if median_changes.len() < asset_ids.len() {
        get_all_last_settlement_changes(pool, source_id)
            .await
            .unwrap_or_default()
    } else {
        HashMap::new()
    };
    let history_changes = if median_changes.len() + settlement_changes.len() < asset_ids.len() {
        get_all_24h_changes(pool, source_id)
            .await
            .unwrap_or_default()
    } else {
        HashMap::new()
    };

    asset_ids
        .iter()
        .map(|asset_id| {
            // 1. Median calibration — 50/50 by construction
            if let Some(&median_pct) = median_changes.get(asset_id) {
                if !median_pct.is_nan() && !median_pct.is_infinite() {
                    let (res_type, raw_bps) = resolution_from_median(median_pct);
                    let threshold_bps = clamp_threshold(raw_bps, &strategy);
                    return BatchMarket {
                        asset_id: asset_id.clone(),
                        resolution_type: res_type.to_string(),
                        threshold_bps,
                        threshold_source: "median".to_string(),
                    };
                }
            }

            // 2. Last settlement (fallback — volatility bands)
            if let Some(&change_pct) = settlement_changes.get(asset_id) {
                if change_pct.abs() > 0.0 && !change_pct.is_nan() && !change_pct.is_infinite() {
                    let (res_type, raw_bps) = resolution_for_volatility(change_pct);
                    let threshold_bps = clamp_threshold(raw_bps, &strategy);
                    return BatchMarket {
                        asset_id: asset_id.clone(),
                        resolution_type: res_type.to_string(),
                        threshold_bps,
                        threshold_source: "last_batch".to_string(),
                    };
                }
            }

            // 3. 24h history (fallback — volatility bands)
            if let Some(&change_pct) = history_changes.get(asset_id) {
                if change_pct.abs() > 0.0 && !change_pct.is_nan() && !change_pct.is_infinite() {
                    let (res_type, raw_bps) = resolution_for_volatility(change_pct);
                    let threshold_bps = clamp_threshold(raw_bps, &strategy);
                    return BatchMarket {
                        asset_id: asset_id.clone(),
                        resolution_type: res_type.to_string(),
                        threshold_bps,
                        threshold_source: "24h_history".to_string(),
                    };
                }
            }

            // 4. No data — use source's zero_trend_type
            BatchMarket {
                asset_id: asset_id.clone(),
                resolution_type: strategy.zero_trend_type.to_string(),
                threshold_bps: strategy.min_threshold_bps,
                threshold_source: "no_data".to_string(),
            }
        })
        .collect()
}

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
    let lock_offset_secs = 0u64; // No lock window — settlement delay = tick_duration (symmetric)

    let markets = compute_asset_thresholds(pool, source_id, &healthy).await;

    let hash = compute_config_hash(source_id, tick_duration_secs, lock_offset_secs, &markets);
    let hash_hex = format!("0x{}", hex::encode(hash));

    Some(BatchConfig {
        source_id: source_id.to_string(),
        display_name: display_name.to_string(),
        config_hash: hash_hex,
        tick_duration_secs,
        lock_offset_secs,
        settlement_grace_secs: default_settlement_grace_secs(tick_duration_secs),
        markets,
        created_at: Utc::now(),
    })
}

/// Store batch config in DB.
async fn store_batch_config(pool: &PgPool, config: &BatchConfig) -> Result<(), sqlx::Error> {
    let hash_bytes = hex::decode(config.config_hash.trim_start_matches("0x")).unwrap_or_default();
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

pub struct BatchEngineState {
    /// Latest recommended batch config per source
    pub configs: RwLock<Vec<BatchConfig>>,
    /// Latest BLS-signed configs (loaded from DB on startup, updated on POST)
    pub signed_configs: RwLock<Vec<SignedBatchConfig>>,
    /// Per-source health tracking for auto-exclusion
    pub health_tracker: SourceHealthTracker,
}

impl BatchEngineState {
    pub fn new() -> Self {
        Self {
            configs: RwLock::new(Vec::new()),
            signed_configs: RwLock::new(Vec::new()),
            health_tracker: SourceHealthTracker::new(DEFAULT_MAX_CONSECUTIVE_FAILURES),
        }
    }

    /// Load signed configs from DB on startup (crash recovery).
    pub async fn load_signed_from_db(&self, pool: &PgPool) {
        let rows: Vec<(
            String,
            Vec<u8>,
            serde_json::Value,
            Vec<u8>,
            i64,
            i64,
            i32,
            i32,
            DateTime<Utc>,
        )> = match sqlx::query_as(
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
        for (source_id, hash, config_json, sig, bitmask, nonce, tick_dur, lock_off, signed_at) in
            rows
        {
            let markets: Vec<BatchMarket> =
                serde_json::from_value(config_json.get("markets").cloned().unwrap_or_default())
                    .unwrap_or_default();
            let display_name = config_json
                .get("display_name")
                .and_then(|v| v.as_str())
                .unwrap_or(&source_id)
                .to_string();

            let tick_secs = tick_dur as u64;
            configs.push(SignedBatchConfig {
                source_id,
                display_name,
                config_hash: format!("0x{}", hex::encode(&hash)),
                tick_duration_secs: tick_secs,
                lock_offset_secs: lock_off as u64,
                settlement_grace_secs: default_settlement_grace_secs(tick_secs),
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

/// Load static fallback configs from vision-recommended-configs.json.
/// Returns source_id → (config_hash, tick_duration, lock_offset, market_count).
fn load_static_fallback_configs() -> HashMap<String, (String, u64, u64, usize)> {
    let paths = [
        "deployments/vision-recommended-configs.json",
        "/app/deployments/vision-recommended-configs.json",
    ];
    for path in &paths {
        if let Ok(contents) = std::fs::read_to_string(path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&contents) {
                if let Some(configs) = val.get("configs").and_then(|c| c.as_object()) {
                    let mut map = HashMap::new();
                    for (name, info) in configs {
                        let hash = info.get("configHash").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let tick = info.get("tickDurationSecs").and_then(|v| v.as_u64()).unwrap_or(600);
                        let lock = info.get("lockOffsetSecs").and_then(|v| v.as_u64()).unwrap_or(0);
                        let count = info.get("marketCount").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                        if !hash.is_empty() {
                            map.insert(name.clone(), (hash, tick, lock, count));
                        }
                    }
                    info!(count = map.len(), path, "Loaded static fallback configs");
                    return map;
                }
            }
        }
    }
    warn!("No static fallback configs found (vision-recommended-configs.json)");
    HashMap::new()
}

/// Try to recover the last known config for a source from the DB (any age).
async fn recover_last_config_from_db(
    pool: &PgPool,
    source_id: &str,
    display_name: &str,
) -> Option<BatchConfig> {
    let row: Option<(Vec<u8>, serde_json::Value, i32, i32, i32, DateTime<Utc>)> = sqlx::query_as(
        r#"
        SELECT config_hash, markets, tick_duration_secs, lock_offset_secs, asset_count, created_at
        FROM batch_configs
        WHERE source_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(source_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    row.map(|(hash_bytes, markets_json, tick_dur, lock_off, _count, created_at)| {
        let markets: Vec<BatchMarket> = serde_json::from_value(markets_json).unwrap_or_default();
        let tick_secs = tick_dur as u64;
        BatchConfig {
            source_id: source_id.to_string(),
            display_name: display_name.to_string(),
            config_hash: format!("0x{}", hex::encode(&hash_bytes)),
            tick_duration_secs: tick_secs,
            lock_offset_secs: lock_off as u64,
            settlement_grace_secs: default_settlement_grace_secs(tick_secs),
            markets,
            created_at,
        }
    })
}

/// Run the batch engine. Recomputes all source configs every 60s.
pub async fn run(pool: PgPool, state: Arc<BatchEngineState>, sources: Vec<SourceMeta>) {
    info!("BatchEngine started with {} sources", sources.len());

    // Load signed configs from DB (crash recovery)
    state.load_signed_from_db(&pool).await;

    // Load static fallback configs for sources with no live data
    let static_fallbacks = load_static_fallback_configs();

    // Initial delay — let sources complete first sync (5s on restart, uses DB data)
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

    loop {
        let mut configs = Vec::new();

        for (source_id, display_name, sync_interval) in &sources {
            if is_source_disabled(source_id) {
                continue;
            }
            if state.health_tracker.should_skip(source_id) {
                let h = state.health_tracker.health.get(source_id);
                let failures = h.as_ref().map(|e| e.consecutive_failures).unwrap_or(0);
                info!(
                    source = %source_id,
                    consecutive_failures = failures,
                    "Source temporarily excluded — {} consecutive failures", failures
                );
                continue;
            }
            match generate_batch_config(&pool, source_id, display_name, *sync_interval).await {
                Some(config) => {
                    if let Err(e) = store_batch_config(&pool, &config).await {
                        warn!(source = %source_id, %e, "Failed to store batch config");
                    }
                    state.health_tracker.record_success(source_id);
                    configs.push(config);
                }
                None => {
                    state.health_tracker.record_failure(source_id);
                }
            }
        }

        // Fallback: for sources with no live config, try DB history then static file.
        // This ensures all on-chain sources always appear in /batches/recommended.
        let live_source_ids: std::collections::HashSet<String> =
            configs.iter().map(|c| c.source_id.clone()).collect();

        for (source_id, display_name, sync_interval) in &sources {
            if is_source_disabled(source_id) || live_source_ids.contains(source_id.as_str()) {
                continue;
            }

            // Try last known config from DB (any age)
            if let Some(recovered) =
                recover_last_config_from_db(&pool, source_id, display_name).await
            {
                info!(
                    source = %source_id,
                    age_secs = (Utc::now() - recovered.created_at).num_seconds(),
                    markets = recovered.markets.len(),
                    "Recovered stale config from DB for missing source"
                );
                configs.push(recovered);
                continue;
            }

            // Last resort: static fallback from vision-recommended-configs.json
            if let Some((config_hash, tick_dur, lock_off, _count)) =
                static_fallbacks.get(source_id.as_str())
            {
                info!(
                    source = %source_id,
                    "Using static fallback config (no live or DB data)"
                );
                configs.push(BatchConfig {
                    source_id: source_id.to_string(),
                    display_name: display_name.to_string(),
                    config_hash: config_hash.clone(),
                    tick_duration_secs: *tick_dur,
                    lock_offset_secs: *lock_off,
                    settlement_grace_secs: default_settlement_grace_secs(*tick_dur),
                    markets: Vec::new(), // no market data available
                    created_at: Utc::now(),
                });
                continue;
            }

            warn!(
                source = %source_id,
                tick_secs = sync_interval,
                "Source has no live data, no DB history, and no static fallback"
            );
        }

        info!(
            "BatchEngine computed {} batch configs ({} total markets)",
            configs.len(),
            configs.iter().map(|c| c.markets.len()).sum::<usize>()
        );

        // DN-5: Merge new configs without losing active ones
        {
            let signed = state.signed_configs.read().await;
            let signed_hashes: std::collections::HashSet<String> =
                signed.iter().map(|s| s.config_hash.clone()).collect();

            let mut merged = state.configs.write().await;
            // Keep configs whose hash is referenced by a signed config
            merged.retain(|c| signed_hashes.contains(&c.config_hash));
            // Add new configs (deduplicated by source_id)
            for config in configs {
                if let Some(pos) = merged
                    .iter()
                    .position(|c| c.source_id == config.source_id && !signed_hashes.contains(&c.config_hash))
                {
                    merged[pos] = config;
                } else if !merged.iter().any(|c| c.config_hash == config.config_hash) {
                    merged.push(config);
                }
            }
        }

        // GC: delete batch configs older than 30 days that were never signed.
        // Must be generous — on-chain batches reference config hashes immutably,
        // and bots need to look them up for the full tick lifetime + buffer.
        // 2 hours was too aggressive; data-node restarts left in-flight batches
        // with unresolvable hashes.
        if let Err(e) = sqlx::query(
            "DELETE FROM batch_configs WHERE created_at < NOW() - INTERVAL '30 days' \
             AND config_hash NOT IN (SELECT config_hash FROM signed_batch_configs)",
        )
        .execute(&pool)
        .await
        {
            warn!(%e, "Failed to GC old batch configs");
        }

        // Recompute every 60 seconds
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_threshold_bps_normal() {
        assert_eq!(sanitize_threshold_bps(1.5), 150); // 1.5% → 150 bps
        assert_eq!(sanitize_threshold_bps(0.01), 1); // 0.01% → 1 bps
        assert_eq!(sanitize_threshold_bps(50.0), 5000); // 50% → 5000 bps
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
        let markets = vec![BatchMarket {
            asset_id: "bitcoin".into(),
            resolution_type: "up_x".into(),
            threshold_bps: 200,
            threshold_source: "last_batch".into(),
        }];
        let h1 = compute_config_hash("crypto", 600, 90, &markets);
        let h2 = compute_config_hash("crypto", 600, 90, &markets);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_config_hash_order_independent() {
        // Order shouldn't matter — hash sorts by asset_id
        let markets_a = vec![
            BatchMarket {
                asset_id: "bitcoin".into(),
                resolution_type: "up_x".into(),
                threshold_bps: 200,
                threshold_source: "last_batch".into(),
            },
            BatchMarket {
                asset_id: "ethereum".into(),
                resolution_type: "up_x".into(),
                threshold_bps: 300,
                threshold_source: "24h_history".into(),
            },
        ];
        let markets_b = vec![
            BatchMarket {
                asset_id: "ethereum".into(),
                resolution_type: "up_x".into(),
                threshold_bps: 300,
                threshold_source: "24h_history".into(),
            },
            BatchMarket {
                asset_id: "bitcoin".into(),
                resolution_type: "up_x".into(),
                threshold_bps: 200,
                threshold_source: "last_batch".into(),
            },
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
        let h2 = compute_config_hash("crypto", 300, 90, &markets); // different tick
        let h3 = compute_config_hash("stocks", 600, 90, &markets); // different source
        assert_ne!(h1, h2);
        assert_ne!(h1, h3);
    }

    #[test]
    fn test_resolution_for_volatility() {
        // Low volatility → flat_x 30 bps
        assert_eq!(resolution_for_volatility(0.0), ("flat_x", 30));
        assert_eq!(resolution_for_volatility(0.1), ("flat_x", 30));
        assert_eq!(resolution_for_volatility(-0.1), ("flat_x", 30));

        // Moderate positive → up_x
        assert_eq!(resolution_for_volatility(0.3), ("up_x", 30));
        assert_eq!(resolution_for_volatility(2.99), ("up_x", 30));
        // Moderate negative → down_0
        assert_eq!(resolution_for_volatility(-0.3), ("down_0", 30));
        assert_eq!(resolution_for_volatility(-2.99), ("down_0", 30));

        // High positive → up_300
        assert_eq!(resolution_for_volatility(3.0), ("up_300", 300));
        assert_eq!(resolution_for_volatility(15.0), ("up_300", 300));
        // High negative → down_300
        assert_eq!(resolution_for_volatility(-3.0), ("down_300", 300));
        assert_eq!(resolution_for_volatility(-15.0), ("down_300", 300));

        // Extreme positive → up_3000
        assert_eq!(resolution_for_volatility(30.0), ("up_3000", 3000));
        // Extreme negative → down_3000
        assert_eq!(resolution_for_volatility(-30.0), ("down_3000", 3000));
    }

    #[test]
    fn test_resolution_from_median() {
        // Nearly stationary → flat_x
        assert_eq!(resolution_from_median(0.0), ("flat_x", 30));
        assert_eq!(resolution_from_median(0.05), ("flat_x", 30));
        assert_eq!(resolution_from_median(-0.05), ("flat_x", 30));

        // Trivial volatility → up_0 / down_0
        assert_eq!(resolution_from_median(0.15), ("up_0", 0));
        assert_eq!(resolution_from_median(-0.15), ("down_0", 0));

        // Everything else → up_x / down_x with exact median threshold
        assert_eq!(resolution_from_median(0.3), ("up_x", 30));
        assert_eq!(resolution_from_median(0.5), ("up_x", 50));
        assert_eq!(resolution_from_median(-0.3), ("down_x", 30));
        assert_eq!(resolution_from_median(1.0), ("up_x", 100));
        assert_eq!(resolution_from_median(-1.5), ("down_x", 150));
        assert_eq!(resolution_from_median(3.0), ("up_x", 300));
        assert_eq!(resolution_from_median(10.0), ("up_x", 1000));
        assert_eq!(resolution_from_median(-15.0), ("down_x", 1500));
        assert_eq!(resolution_from_median(50.0), ("up_x", 5000));
    }

    #[test]
    fn test_strategy_registry() {
        // Unregistered source returns DEFAULT
        let s = get_strategy("unknown_source_xyz");
        assert_eq!(s.lookback_ticks, BatchStrategy::DEFAULT.lookback_ticks);

        // Register a custom strategy
        register_strategy("test_src", BatchStrategy::FAST_VOLATILE);
        let s = get_strategy("test_src");
        assert_eq!(s.lookback_ticks, BatchStrategy::FAST_VOLATILE.lookback_ticks);
        assert_eq!(s.min_threshold_bps, BatchStrategy::FAST_VOLATILE.min_threshold_bps);
    }
}
