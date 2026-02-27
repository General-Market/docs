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

/// Source metadata: (source_id, display_name, sync_interval_secs)
pub type SourceMeta = (&'static str, &'static str, u64);

/// All batch-eligible sources — mirrors SOURCE_META in api.rs.
pub const BATCH_SOURCES: &[SourceMeta] = &[
    // ── Original sources ──────────────────────────────────────────────────
    ("crypto", "CoinGecko Crypto", 600),
    ("defi", "DefiLlama DeFi", 120),
    ("stocks", "Stocks (Finnhub)", 600),
    ("rates", "Federal Reserve (FRED)", 86400),
    ("bls", "Bureau of Labor Statistics", 86400),
    ("worldbank", "World Bank", 604800),
    ("eia", "US Energy (EIA)", 86400),
    ("ecb", "ECB Euro Rates", 86400),
    ("weather", "Weather (Open-Meteo)", 3600),
    ("sec_13f", "SEC EDGAR 13F", 21600),
    ("sec_efts", "SEC EFTS Filing Counts", 14400),
    ("sec_insider", "SEC Insider Trading", 14400),
    ("finra_short_vol", "FINRA Daily Short Volume", 86400),
    ("finra", "FINRA Short Interest", 86400),
    ("congress", "Congressional Trading", 86400),
    ("cftc", "CFTC Commitments", 604800),
    ("futures", "Continuous Futures", 86400),
    ("bchain", "Bitcoin On-Chain", 86400),
    ("opec", "OPEC", 2592000),
    ("imf", "IMF Indicators", 2592000),
    ("bonds", "US Treasury Yields", 86400),
    // ── New sources ─────────────────────────────────────────────────────
    ("anilist", "AniList Anime & Manga", 600),
    ("backpacktf", "backpack.tf TF2 Items", 600),
    ("cloudflare", "Cloudflare Radar", 600),
    ("crates_io", "crates.io Rust Packages", 600),
    ("fourchan", "4chan", 600),
    ("github", "GitHub Repositories", 600),
    ("hackernews", "Hacker News", 300),
    ("npm", "npm Package Downloads", 600),
    ("polymarket", "Polymarket Predictions", 300),
    ("pypi", "PyPI Python Packages", 600),
    ("steam", "Steam Games", 600),
    ("tmdb", "TMDb Movies, TV & Celebrities", 300),
    ("lastfm", "Last.fm Music Artists", 600),
    ("twitch", "Twitch Live Streaming", 60),
    ("twse", "Taiwan Stock Exchange", 600),
    ("zillow", "Zillow Real Estate", 86400),
    // ── Bet on Everything sources ────────────────────────────────────
    ("volcano", "USGS Volcanoes", 600),
    ("earthquake", "USGS Earthquakes", 300),
    ("spaceweather", "NOAA Space Weather", 600),
    ("wildfire", "NASA FIRMS Wildfires", 1800),
    ("flights", "OpenSky Flights", 600),
    ("mil_aircraft", "Military Aircraft", 600),
    ("maritime", "AIS Maritime", 600),
    ("epidemic", "disease.sh Epidemics", 1800),
    ("sports", "ESPN Live Scores", 600),
    ("iss", "ISS Position", 600),
    ("weather_alerts", "NWS Severe Weather", 300),
    ("animals", "Wildlife Observations", 600),
    ("movebank", "Movebank Animal GPS", 1800),
    ("ebird", "eBird Observations", 600),
    ("aisstream", "AIS Ship Tracking", 60),
    ("gtfs_transit", "GTFS Transit", 120),
    ("usa_spending", "US Defense Spending", 3600),
    ("pumpfun", "Pump.fun Tokens", 300),
    ("usgs_water", "USGS Water Monitoring", 600),
    // ── Social / Live sources ─────────────────────────────────────────
    ("reddit", "Reddit Communities", 600),
    ("chaturbate", "Chaturbate Live Cams", 600),
    // ── Esports ─────────────────────────────────────────────────────
    ("esports", "PandaScore Esports", 300),
    // ── Environment & Transport ───────────────────────────────────
    ("noaa_tides", "NOAA Tides & Currents", 900),
    ("nrc_nuclear", "NRC Nuclear Reactors", 3600),
    ("citybikes", "CityBikes Bike Sharing", 600),
    ("ndbc", "NDBC Ocean Buoys", 600),
    ("noaa_met", "NOAA Ocean Meteorology", 600),
    ("nwps", "NWPS River Gauges", 600),
    ("airnow", "AirNow Air Quality", 600),
    // ── Government / Legal ──────────────────────────────────────────
    ("courtlistener", "CourtListener Federal Courts", 600),
    // ── Education / Research ──────────────────────────────────────────
    ("openalex", "OpenAlex Scholarly Works", 600),
    ("crossref", "Crossref DOI Registry", 600),
    ("pubmed", "PubMed Biomedical Research", 600),
    ("stackexchange", "Stack Exchange Developer Q&A", 600),
    // ── Animals ──────────────────────────────────────────────────────
    ("shelter", "Animal Shelters", 600),
    // ── Autos & Vehicles ──────────────────────────────────────────
    ("parking", "ParkAPI Parking Garages", 600),
    ("tomtom_traffic", "TomTom Traffic Flow", 600),
    ("tomtom_evcharge", "TomTom EV Charging", 600),
    // ── Board Games & Shopping ──────────────────────────────────────
    ("bgg", "BoardGameGeek Hotness", 600),
    ("bestbuy", "Best Buy Products", 600),
    // ── Jobs / Labor ──────────────────────────────────────────────
    ("adzuna", "Adzuna Job Market", 1800),
    // ── Tourism ──────────────────────────────────────────────────────
    ("queue_times", "Queue-Times Theme Parks", 600),
    ("cbp_border", "CBP Border Wait Times", 600),
    ("faa_delays", "FAA Airport Delays", 600),
    // ── Drink Sources ─────────────────────────────────────────────
    ("yahoo_drinks", "Yahoo Drink Markets", 600),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchMarket {
    pub asset_id: String,
    /// Always "up_x" for auto-batches. Users choose direction via bitmap.
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
    pub bls_signature: String,  // hex-encoded
    pub signers_bitmask: u64,
    pub reference_nonce: u64,
    pub signed_at: DateTime<Utc>,
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

/// Get all healthy assets for a source.
/// "Healthy" = has a price record within 2× sync_interval and value > 0.
/// Returns max MAX_MARKETS_PER_BATCH assets, sorted by asset_id.
async fn get_healthy_assets(
    pool: &PgPool,
    source_id: &str,
    sync_interval_secs: u64,
) -> Result<Vec<String>, sqlx::Error> {
    let staleness_cutoff =
        Utc::now() - chrono::Duration::seconds((sync_interval_secs * 2) as i64);

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

    // Initial delay — let sources complete first sync (5s on restart, uses DB data)
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

    loop {
        let mut configs = Vec::new();

        for &(source_id, display_name, sync_interval) in sources {
            if let Some(config) =
                generate_batch_config(&pool, source_id, display_name, sync_interval).await
            {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lock_offset_fast() {
        assert_eq!(lock_offset_for_interval(60), 9); // 60 * 0.15 = 9
    }

    #[test]
    fn test_lock_offset_medium() {
        assert_eq!(lock_offset_for_interval(600), 90); // 600 * 0.15 = 90
    }

    #[test]
    fn test_lock_offset_slow() {
        assert_eq!(lock_offset_for_interval(86400), 3456); // 86400 * 0.04 = 3456
    }

    #[test]
    fn test_lock_offset_minimum() {
        assert_eq!(lock_offset_for_interval(10), 5); // 10 * 0.15 = 1.5, clamped to MIN=5
    }

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
}
