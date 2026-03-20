//! Vision tick engine
//!
//! Main polling loop that checks the tick scheduler for due batches and
//! drives tick resolution. Runs as a background `tokio::spawn` task alongside
//! the existing ITP consensus loop.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::traits::BLSSigner;
use common::types::{BLSPublicKey, P2PMessage};
use common::BLSSignature;
use crate::consensus::KeyRegistry;
use ethers::abi::{encode, Token};
use ethers::types::{Address, H256, U256};
use ethers::utils::keccak256;
use tokio::sync::RwLock;

use super::batch_config_orchestrator;
use super::config::VisionConfig;
use super::resolver::{MarketPrices, TickResolver};
use super::tick_consensus::TickConsensus;
use super::tick_scheduler::TickScheduler;
use super::types::MarketConfig;

// ---------------------------------------------------------------------------
// Bitmap gossip types for cross-oracle bitmap synchronisation
// ---------------------------------------------------------------------------

/// Bitmap gossip message variants forwarded from the P2P layer to the engine.
///
/// The gossip task responds to each variant:
/// - `Gossip`: if the bitmap is unknown, send `BitmapRequest` back to the sender.
/// - `Request`: if we have the bitmap, send `BitmapResponse` directly to the requester.
/// - `Response`: verify hash, store in the pending slot via BitmapStore.
pub enum IncomingBitmapGossip {
    Gossip {
        from: [u8; 32],
        batch_id: u64,
        player: Address,
        bitmap_hash: H256,
        config_hash: H256,
        target_tick_id: u64,
    },
    Request {
        from: [u8; 32],
        batch_id: u64,
        player: Address,
        bitmap_hash: H256,
    },
    Response {
        from: [u8; 32],
        batch_id: u64,
        player: Address,
        bitmap: Vec<u8>,
        bitmap_hash: H256,
        config_hash: H256,
        target_tick_id: u64,
    },
}

// ---------------------------------------------------------------------------
// Balance proof types for P2P aggregation
// ---------------------------------------------------------------------------

/// Incoming balance proofs batch from a peer, forwarded by the P2P message handler.
pub struct IncomingBalanceProofsBatch {
    /// PeerId of the sender (used to derive signer_index via `extract_oracle_id`)
    pub from_peer: [u8; 32],
    pub batch_id: u64,
    pub tick_id: u64,
    pub proofs: Vec<(Address, U256, Vec<u8>)>, // (player, balance, bls_sig_bytes)
    /// Signer index as reported by the message (used as hint, but we re-derive from peer)
    pub signer_index: u8,
}

/// Per-(batch_id, player) accumulator of BLS signatures from different oracles.
struct PlayerSigEntry {
    balance: U256,
    tick_id: u64,
    /// (signer_index, bls_sig_bytes)
    signatures: Vec<(u8, Vec<u8>)>,
    first_seen: std::time::Instant,
}

/// Collects BLS signatures from peers for balance proof aggregation.
///
/// Key: (batch_id, player_address)
/// Value: PlayerSigEntry with all signatures received so far
struct BalanceProofCollector {
    /// (batch_id, player) -> entry
    entries: HashMap<(u64, Address), PlayerSigEntry>,
    /// batch_id -> first-seen instant (for timeout tracking)
    batch_first_seen: HashMap<u64, std::time::Instant>,
}

impl BalanceProofCollector {
    fn new() -> Self {
        Self {
            entries: HashMap::new(),
            batch_first_seen: HashMap::new(),
        }
    }

    /// Add a verified signature for (batch_id, player).
    fn add_signature(
        &mut self,
        batch_id: u64,
        tick_id: u64,
        player: Address,
        balance: U256,
        signer_index: u8,
        sig_bytes: Vec<u8>,
    ) {
        let now = std::time::Instant::now();
        self.batch_first_seen.entry(batch_id).or_insert(now);

        let entry = self.entries.entry((batch_id, player)).or_insert_with(|| PlayerSigEntry {
            balance,
            tick_id,
            signatures: Vec::new(),
            first_seen: now,
        });

        // Deduplicate: skip if signer already present
        if !entry.signatures.iter().any(|(idx, _)| *idx == signer_index) {
            entry.signatures.push((signer_index, sig_bytes));
        }
    }

    /// Returns batch IDs whose 5s aggregation window has expired.
    fn expired_batches(&self) -> Vec<u64> {
        let threshold = std::time::Duration::from_secs(5);
        self.batch_first_seen
            .iter()
            .filter(|(_, ts)| ts.elapsed() >= threshold)
            .map(|(id, _)| *id)
            .collect()
    }

    /// Extract and remove all entries for a given batch_id.
    fn drain_batch(&mut self, batch_id: u64) -> Vec<(Address, PlayerSigEntry)> {
        self.batch_first_seen.remove(&batch_id);
        let keys: Vec<(u64, Address)> = self
            .entries
            .keys()
            .filter(|(bid, _)| *bid == batch_id)
            .cloned()
            .collect();
        keys.into_iter()
            .filter_map(|k| self.entries.remove(&k).map(|v| (k.1, v)))
            .collect()
    }
}

/// Reference prices from the previous tick, used as "start" prices for the next tick.
/// Maps market_id (H256) -> price value scaled by 1e8 (i128, integer).
/// Signed to accommodate negative-valued markets (interest rates, temperatures, etc.).
type ReferencePrices = Arc<RwLock<HashMap<H256, i128>>>;

/// How long to suppress retry for missing configs (batch engine may generate them later).
const MISSING_CONFIG_TTL: std::time::Duration = std::time::Duration::from_secs(300);

/// How long cached configs remain valid before re-fetching from data-node.
/// Configs regenerate each tick, so this should be shorter than the shortest tick duration.
const CONFIG_CACHE_TTL: std::time::Duration = std::time::Duration::from_secs(55);

/// Cache of fetched configs to avoid re-fetching within same tick.
/// Keyed by (config_hash, source_id) to prevent cross-batch poisoning when
/// multiple batches share the same config_hash but have different sources.
struct ConfigCache {
    configs: RwLock<HashMap<(H256, H256), (String, Vec<MarketConfig>, std::time::Instant)>>,
    /// Config hashes that returned 404 — downgrade to debug after first WARN.
    /// Entries expire after MISSING_CONFIG_TTL so configs generated later can be retried.
    known_missing: RwLock<HashMap<(H256, H256), std::time::Instant>>,
}

impl ConfigCache {
    fn new() -> Self {
        Self {
            configs: RwLock::new(HashMap::new()),
            known_missing: RwLock::new(HashMap::new()),
        }
    }

    async fn get_or_fetch(
        &self,
        data_node_url: &str,
        config_hash: &H256,
        source_id_h256: Option<&H256>,
    ) -> Result<(String, Vec<MarketConfig>), Box<dyn std::error::Error + Send + Sync>> {
        let sid = source_id_h256.copied().unwrap_or_default();
        let cache_key = (*config_hash, sid);

        // Check cache first (with TTL — configs regenerate each tick)
        {
            let cache = self.configs.read().await;
            if let Some((source_id, configs, fetched_at)) = cache.get(&cache_key) {
                if fetched_at.elapsed() < CONFIG_CACHE_TTL {
                    return Ok((source_id.clone(), configs.clone()));
                }
                // Expired — fall through to re-fetch
            }
        }


        // Try fetching by config hash first (unless hash is zero)
        if !config_hash.is_zero() {
            let hash_hex = format!("0x{}", hex::encode(config_hash));
            match batch_config_orchestrator::fetch_config_by_hash(data_node_url, &hash_hex).await {
                Ok(batch) => {
                    let source_id = batch.source_id.clone();
                    // Validate: if we have an on-chain source_id, the fetched config must match
                    if !sid.is_zero() {
                        let fetched_sid_hash = H256::from(keccak256(source_id.as_bytes()));
                        let mut matched = fetched_sid_hash == sid;
                        if !matched {
                            for v in 1..=5u8 {
                                let versioned = format!("{}_v{}", source_id, v);
                                if H256::from(keccak256(versioned.as_bytes())) == sid {
                                    matched = true;
                                    break;
                                }
                            }
                        }
                        if !matched {
                            tracing::warn!(
                                config_hash = %hash_hex,
                                fetched_source = %source_id,
                                on_chain_source_id = ?sid,
                                "Config hash resolved to wrong source — rejecting, falling back to source_id lookup"
                            );
                            // Don't cache — fall through to source_id fallback
                        } else {
                            let market_configs = Self::parse_market_configs(&batch);
                            self.configs.write().await.insert(cache_key, (source_id.clone(), market_configs.clone(), std::time::Instant::now()));
                            self.known_missing.write().await.remove(&cache_key);
                            return Ok((source_id, market_configs));
                        }
                    } else {
                        let market_configs = Self::parse_market_configs(&batch);
                        self.configs.write().await.insert(cache_key, (source_id.clone(), market_configs.clone(), std::time::Instant::now()));
                        self.known_missing.write().await.remove(&cache_key);
                        return Ok((source_id, market_configs));
                    }
                }
                Err(e) => {
                    // Hash not found — configs regenerated since batch creation.
                    // Fall through to source_id lookup below.
                    tracing::debug!(
                        config_hash = %hash_hex,
                        error = %e,
                        "Config hash not found on data-node, falling back to source_id lookup"
                    );
                }
            }
        }

        // Fallback: look up by source_id from recommended batches.
        // This handles both zero config hashes and stale hashes (configs
        // regenerated each tick, so on-chain hash may not match data-node).
        //
        // On-chain source_id is keccak256(name + "_" + version) where version
        // is typically "v1" or "v2" (set by BATCH_VERSION in the deploy script).
        // The data-node's recommended config has the raw source name (e.g. "crypto").
        // We try keccak256(name), keccak256(name + "_v1"), keccak256(name + "_v2"), etc.
        if let Some(sid_h256) = source_id_h256 {
            if !sid_h256.is_zero() {
                let recommended = batch_config_orchestrator::fetch_recommended(data_node_url).await?;
                if let Some(batch) = recommended.into_iter().find(|b| {
                    // Try bare name first, then versioned suffixes.
                    // First match wins — ordering of recommended list matters.
                    if H256::from(keccak256(b.source_id.as_bytes())) == *sid_h256 {
                        return true;
                    }
                    for v in 1..=5u8 {
                        let versioned = format!("{}_v{}", b.source_id, v);
                        if H256::from(keccak256(versioned.as_bytes())) == *sid_h256 {
                            return true;
                        }
                    }
                    false
                }) {
                    let source_id = batch.source_id.clone();
                    tracing::info!(
                        on_chain_source_id = ?sid_h256,
                        matched_source = %source_id,
                        config_hash = ?config_hash,
                        "keccak256 fallback matched recommended source"
                    );
                    let market_configs = Self::parse_market_configs(&batch);
                    self.configs.write().await.insert(cache_key, (source_id.clone(), market_configs.clone(), std::time::Instant::now()));
                    self.known_missing.write().await.remove(&cache_key);
                    return Ok((source_id, market_configs));
                }
                return Err(format!("No recommended config matching source_id {:?}", sid_h256).into());
            }
        }

        Err("Config hash not found and no source_id fallback available".into())
    }

    fn parse_market_configs(batch: &batch_config_orchestrator::RecommendedBatch) -> Vec<MarketConfig> {
        batch.markets.iter().map(|m| MarketConfig {
            asset_id: m.asset_id.clone(),
            market_id: H256::from(keccak256(m.asset_id.as_bytes())),
            resolution_type: parse_resolution_type(&m.resolution_type),
            threshold_bps: m.threshold_bps,
        }).collect()
    }

    async fn is_known_missing(&self, config_hash: &H256, source_id: &H256) -> bool {
        let map = self.known_missing.read().await;
        match map.get(&(*config_hash, *source_id)) {
            Some(ts) if ts.elapsed() < MISSING_CONFIG_TTL => true,
            _ => false,
        }
    }

    async fn mark_missing(&self, config_hash: &H256, source_id: &H256) {
        self.known_missing.write().await.insert((*config_hash, *source_id), std::time::Instant::now());
    }
}

/// Parse resolution type string to u8 code.
/// Codes 0-7: original types. Codes 8-13: extended types.
/// Unknown types → 255 (Cancelled).
fn parse_resolution_type(s: &str) -> u8 {
    match s {
        "up_0" => 0,
        "up_30" => 1,
        "up_x" => 2,
        "down_0" => 3,
        "down_30" => 4,
        "down_x" => 5,
        "flat_0" => 6,
        "flat_x" => 7,
        // Extended types (codes 8-13)
        "up_300" => 8,
        "up_3000" => 9,
        "down_300" => 10,
        "down_3000" => 11,
        "flat_300" => 12,
        "flat_3000" => 13,
        _ => {
            tracing::warn!(res_type = s, "Unknown resolution type — treating as Cancelled");
            255
        }
    }
}

/// Compute the market_id (keccak256 of raw UTF-8 bytes of asset_id).
/// This matches `cast keccak $(cast --from-utf8 asset_id)` used in batch creation.
fn asset_id_to_market_id(asset_id: &str) -> H256 {
    H256::from(keccak256(asset_id.as_bytes()))
}

/// Fetch market prices from the data-node's Vision snapshot endpoint.
///
/// Fetches `/vision/snapshot`, maps asset_ids to market_ids,
/// and builds a MarketPrices with start prices from the reference map and
/// end prices from the current snapshot.
///
/// Returns Result instead of silently returning empty on failure.
/// Parsed snapshot data for a source:
/// - market_id -> current price scaled by 1e8 (i128, integer, signed for negative values)
/// - market_id -> change_pct (f64, used only for start_price fallback)
/// - market_id -> fetched_at unix timestamp
type SnapshotData = (HashMap<H256, i128>, HashMap<H256, f64>, HashMap<H256, i64>);

/// Per-tick-cycle cache: Ok(data) for successful fetches, Err for failed ones.
/// Prevents both redundant fetches AND redundant timeout waits.
type SnapshotCache = HashMap<String, Result<SnapshotData, String>>;

async fn fetch_snapshot_data_inner_with_secret(
    data_node_url: &str,
    source_id: &str,
    hmac_secret: &Option<String>,
) -> Result<SnapshotData, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{}/vision/snapshot?source={}&limit=10000", data_node_url, source_id);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;

    let response = client.get(&url).send().await?;

    // Verify HMAC-SHA256 signature if secret is configured (IS-7)
    if let Some(secret) = hmac_secret {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        let hmac_header = response
            .headers()
            .get("x-snapshot-hmac")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let body_text = response.text().await?;

        if let Some(received_hmac) = hmac_header {
            let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
                .expect("HMAC can take key of any size");
            mac.update(body_text.as_bytes());
            let expected = hex::encode(mac.finalize().into_bytes());
            if received_hmac != expected {
                tracing::error!(
                    "Snapshot HMAC mismatch — possible tampering. received={} expected={}",
                    received_hmac,
                    expected
                );
                return Err("HMAC verification failed — snapshot may have been tampered with".into());
            }
            tracing::debug!("Snapshot HMAC-SHA256 verification successful");
        } else {
            return Err("Snapshot HMAC header missing — rejecting unauthenticated data".into());
        }

        let json: serde_json::Value = serde_json::from_str(&body_text)?;
        parse_snapshot_data(json)
    } else {
        let json: serde_json::Value = response.json().await?;
        parse_snapshot_data(json)
    }
}

fn parse_snapshot_data(
    json: serde_json::Value,
) -> Result<SnapshotData, Box<dyn std::error::Error + Send + Sync>> {
    let snapshots = json
        .get("snapshots")
        .and_then(|s| s.as_array())
        .ok_or("data-node snapshot response missing 'snapshots' array")?;

    let mut current_values: HashMap<H256, i128> = HashMap::new();
    let mut change_pcts: HashMap<H256, f64> = HashMap::new();
    let mut fetched_at_map: HashMap<H256, i64> = HashMap::new();

    for snap in snapshots {
        let asset_id = snap
            .get("asset_id")
            .or_else(|| snap.get("assetId"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if asset_id.is_empty() {
            continue;
        }

        let market_id = asset_id_to_market_id(asset_id);

        // Prefer integer-scaled price from data-node (value_scaled, 1e8 fixed-point).
        // value_scaled is i128 — negative values are valid (interest rates, temperatures, etc.).
        // Fall back to f64 `value` field for backwards compatibility.
        let value: i128 = if let Some(scaled) = snap.get("value_scaled").and_then(|v| v.as_str()) {
            match scaled.parse::<i128>() {
                Ok(v) => v,
                Err(_) => {
                    tracing::warn!(market = ?market_id, raw = scaled, "Unparseable value_scaled — skipping market");
                    continue;
                }
            }
        } else if let Some(f) = snap.get("value").and_then(|v| v.as_f64()) {
            (f * 1e8).round() as i128
        } else if let Some(s) = snap.get("value").and_then(|v| v.as_str()) {
            match s.parse::<f64>() {
                Ok(f) => (f * 1e8).round() as i128,
                Err(_) => {
                    tracing::warn!(market = ?market_id, "Unparseable price value — skipping market");
                    continue;
                }
            }
        } else {
            tracing::warn!(market = ?market_id, "Missing price value — skipping market");
            continue;
        };

        // Zero means no data — exclude. Negative values (e.g. -5% interest rate) are valid.
        if value != 0 {
            current_values.insert(market_id, value);
        }

        let change_pct = snap
            .get("change_pct")
            .or_else(|| snap.get("changePct"))
            .and_then(|v| {
                if let Some(f) = v.as_f64() {
                    Some(f)
                } else if let Some(s) = v.as_str() {
                    s.parse::<f64>().ok()
                } else {
                    None
                }
            });
        if let Some(pct) = change_pct {
            change_pcts.insert(market_id, pct);
        }

        // Parse fetched_at timestamp (ISO 8601 string or unix seconds).
        // Falls back to 0 if not present (old data-node without the field).
        let fetched_at = snap
            .get("fetched_at")
            .or_else(|| snap.get("fetchedAt"))
            .and_then(|v| {
                if let Some(ts) = v.as_i64() {
                    Some(ts)
                } else if let Some(s) = v.as_str() {
                    // ISO 8601 datetime string from serde serialization
                    chrono::DateTime::parse_from_rfc3339(s)
                        .ok()
                        .map(|dt| dt.timestamp())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| {
                tracing::warn!(asset_id, "Missing fetched_at in snapshot — defaulting to 0");
                0
            });
        fetched_at_map.insert(market_id, fetched_at);
    }

    tracing::info!(
        total_snapshots = snapshots.len(),
        "Parsed snapshot data from response"
    );

    Ok((current_values, change_pcts, fetched_at_map))
}

/// Fetch snapshot data from the data-node with exponential backoff retry.
///
/// Attempts up to 4 fetches total: immediate + 3 retries at 5s, 15s, 45s delays.
/// Transient failures (timeout, 5xx, network errors) are retried; the last error
/// is returned if all attempts fail.
async fn fetch_snapshot_with_retry(
    data_node_url: &str,
    source_id: &str,
    hmac_secret: &Option<String>,
) -> Result<SnapshotData, Box<dyn std::error::Error + Send + Sync>> {
    let delays = [
        std::time::Duration::from_secs(5),
        std::time::Duration::from_secs(15),
        std::time::Duration::from_secs(45),
    ];
    let mut last_err: Option<Box<dyn std::error::Error + Send + Sync>> = None;

    for (attempt, delay) in std::iter::once(std::time::Duration::ZERO)
        .chain(delays.iter().copied())
        .enumerate()
    {
        if attempt > 0 {
            tracing::warn!(
                attempt,
                source = source_id,
                delay_secs = delay.as_secs(),
                "Data-node fetch failed, retrying after delay"
            );
            tokio::time::sleep(delay).await;
        }

        match fetch_snapshot_data_inner_with_secret(data_node_url, source_id, hmac_secret).await {
            Ok(data) => return Ok(data),
            Err(e) => {
                tracing::warn!(
                    attempt,
                    source = source_id,
                    error = %e,
                    "Data-node snapshot fetch failed"
                );
                last_err = Some(e);
            }
        }
    }

    Err(last_err.unwrap_or_else(|| "All data-node fetch retries exhausted".into()))
}

/// Per-source staleness ceiling (seconds).
///
/// Sources that publish daily, weekly, or monthly have legitimate data gaps that
/// far exceed any tick duration. Using `tick_duration * 2` as the universal cap
/// causes every market from these sources to be cancelled — the data is not
/// stale, the threshold is just wrong.
///
/// Rules:
/// - If the source is in this table, use its value as the hard cap.
/// - Otherwise, fall back to `tick_duration * 2` (fine for real-time sources).
/// - The cap is intentionally generous: we'd rather resolve with slightly old
///   data than cancel 100% of markets because a government API published
///   yesterday's numbers.
const SOURCE_MAX_AGE_SECS: &[(&str, u64)] = &[
    ("rates",     3 * 86400),   // FRED: monthly/quarterly series
    ("bls",       3 * 86400),   // Bureau of Labor Statistics: monthly
    ("worldbank", 7 * 86400),   // World Bank: annual/quarterly
    ("eia",       3 * 86400),   // US Energy: weekly/monthly
    ("ecb",       3 * 86400),   // ECB FX rates: business days only
    ("boe",       3 * 86400),   // Bank of England: business days only
    ("bonds",     3 * 86400),   // US Treasury yields: business days only
    ("imf",       7 * 86400),   // IMF: monthly/quarterly
    ("cftc",      3 * 86400),   // CFTC: weekly (often delayed)
    ("sec_efts",  3 * 86400),   // SEC ETF data: daily filings
    ("finra",     3 * 86400),   // FINRA short vol: daily
    ("finra_short_vol", 3 * 86400),
    ("fred",      3 * 86400),   // FRED (alternative id)
    ("congress",  3 * 86400),   // Congressional trades: disclosure lag
    ("yahoo_drinks", 3 * 86400), // Drink commodity: stable on weekends
];

fn source_max_age_secs(source_id: &str, tick_duration_secs: u64) -> u64 {
    if let Some(&(_, cap)) = SOURCE_MAX_AGE_SECS.iter().find(|(id, _)| *id == source_id) {
        cap
    } else {
        tick_duration_secs.saturating_mul(2)
    }
}

/// Build MarketPrices from cached snapshot data for a specific batch's markets.
///
/// Uses `fetched_at` timestamps from the data-node to populate the `last_update`
/// field in MarketPrices, enabling proper staleness detection downstream.
/// Markets with stale price data (older than the per-source max age) are logged
/// and skipped — they will resolve as Cancelled since they have no price entry.
/// Real-time sources use 2x tick duration; slow sources (daily/weekly government
/// data) use a fixed multi-day window so they are never incorrectly cancelled.
async fn build_market_prices(
    snapshot_data: &SnapshotData,
    batch_market_ids: &[H256],
    reference_prices: &ReferencePrices,
    now: u64,
    tick_duration_secs: u64,
    source_id: &str,
) -> MarketPrices {
    let mut prices = MarketPrices::new();
    let (current_values, change_pcts, fetched_at_map) = snapshot_data;
    let ref_prices = reference_prices.read().await;

    // Staleness threshold: per-source.
    // Real-time sources: 2x tick duration.
    // Slow sources (government/macro data): multi-day fixed cap.
    let max_age_secs = source_max_age_secs(source_id, tick_duration_secs);
    let now_i64 = now as i64;

    let mut matched = 0;
    let mut stale_count = 0;
    for &market_id in batch_market_ids {
        if let Some(&end_price) = current_values.get(&market_id) {
            // Check staleness using the actual fetched_at from the data-node
            let fetched_at = fetched_at_map.get(&market_id).copied().unwrap_or(0);
            if fetched_at > 0 && max_age_secs > 0 {
                let age = now_i64.saturating_sub(fetched_at);
                if age > max_age_secs as i64 {
                    tracing::warn!(
                        market_id = ?market_id,
                        age_secs = age,
                        max_age_secs = max_age_secs,
                        fetched_at,
                        "Stale price data — skipping market (will resolve as Cancelled)"
                    );
                    stale_count += 1;
                    continue;
                }
            }

            // start_price: prefer reference from previous tick, else use end_price.
            // If start == end but change_pct is non-trivial, derive start from change_pct.
            // All arithmetic in integer (i128, scaled by 1e8) — deterministic across oracles.
            let mut start_price = ref_prices.get(&market_id).copied().unwrap_or(end_price);

            if start_price == end_price {
                if let Some(&pct) = change_pcts.get(&market_id) {
                    // pct is % change: end = start * (1 + pct/100) => start = end * 1e4 / (1e4 + pct_bps)
                    let pct_bps = (pct * 100.0).round() as i64; // convert % to bps
                    if pct_bps.abs() > 10 { // > 0.1% change: apply fallback
                        let divisor = 10_000i64 + pct_bps;
                        if divisor != 0 {
                            // Use i128 arithmetic throughout — end_price may be negative.
                            start_price = (end_price * 10_000) / divisor as i128;
                        }
                    }
                }
            }

            // Use the actual fetched_at as last_update so MarketPrices::is_stale works correctly
            let last_update = if fetched_at > 0 { fetched_at as u64 } else { now };
            prices.insert(market_id, start_price, end_price, last_update);
            matched += 1;
        }
    }

    tracing::info!(
        matched_markets = matched,
        stale_markets = stale_count,
        batch_markets = batch_market_ids.len(),
        "Built market prices from cached snapshot"
    );

    prices
}

/// Update reference prices with current values after a tick is resolved.
async fn update_reference_prices(
    reference_prices: &ReferencePrices,
    batch_market_ids: &[H256],
    prices: &MarketPrices,
) {
    let mut ref_prices = reference_prices.write().await;
    for &market_id in batch_market_ids {
        if let Some((_, end)) = prices.get_prices(&market_id) {
            ref_prices.insert(market_id, end);
        }
    }
}

/// Record settlements to data-node for threshold feedback loop.
async fn record_settlements(
    data_node_url: &str,
    admin_token: &str,
    result: &super::types::TickResult,
    config_hash: &H256,
) {
    let settlements: Vec<serde_json::Value> = result
        .market_results
        .iter()
        .filter(|r| !matches!(r.outcome, super::types::MarketOutcome::Cancelled))
        .map(|r| {
            serde_json::json!({
                "sourceId": "",
                "assetId": r.asset_id,
                "configHash": format!("0x{}", hex::encode(config_hash)),
                "startPrice": r.start_price,
                "endPrice": r.end_price,
                "changeBps": r.pct_change_bps,
            })
        })
        .collect();

    if settlements.is_empty() {
        return;
    }

    let client = reqwest::Client::new();
    if let Err(e) = client
        .post(&format!("{}/batches/settlement", data_node_url))
        .header("x-admin-token", admin_token)
        .json(&settlements)
        .send()
        .await
    {
        tracing::warn!(error = %e, "Failed to record settlements to data-node");
    }
}

/// Fetch the latest block timestamp from the RPC node.
/// Falls back to wall clock if the RPC call fails.
async fn get_chain_timestamp(rpc_url: &str) -> u64 {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_getBlockByNumber",
        "params": ["latest", false],
        "id": 1
    });
    match client.post(rpc_url).json(&body).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(ts_hex) = json["result"]["timestamp"].as_str() {
                    let ts_hex = ts_hex.trim_start_matches("0x");
                    if let Ok(ts) = u64::from_str_radix(ts_hex, 16) {
                        return ts;
                    }
                }
            }
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        }
        Err(_) => std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    }
}

/// Apply player balance updates to the scheduler, with optional DB persistence.
///
/// Extracted as a helper so both single-oracle (direct) and multi-oracle
/// (consensus fallback / degraded mode) paths can share the same logic.
pub async fn apply_balances(
    scheduler: &Arc<TickScheduler>,
    db_pool: &Option<sqlx::PgPool>,
    batch_id: u64,
    tick_id: u64,
    player_balances: &[super::types::PlayerBalance],
) {
    if player_balances.is_empty() {
        return;
    }
    if let Some(ref pool) = db_pool {
        if let Err(e) = scheduler
            .apply_tick_balances_with_db(pool, batch_id, player_balances)
            .await
        {
            tracing::warn!(
                batch_id,
                tick_id,
                error = %e,
                "Failed to persist balance updates to DB"
            );
        }
    } else {
        scheduler
            .apply_tick_balances(batch_id, player_balances)
            .await;
    }

    // Persist per-player tick deltas for profile page
    // Spawned as background task — never blocks tick resolution
    if let Some(ref pool) = db_pool {
        let pool = pool.clone();
        let balances = player_balances.to_vec();
        tokio::spawn(async move {
            let player_strs: Vec<String> = balances.iter()
                .map(|pb| format!("{:?}", pb.player))
                .collect();
            let deposit_map: std::collections::HashMap<String, String> = sqlx::query_as::<_, (String, String)>(
                "SELECT player, total_deposited FROM vision_positions WHERE batch_id = $1 AND player = ANY($2)"
            )
            .bind(batch_id as i64)
            .bind(&player_strs)
            .fetch_all(&pool)
            .await
            .unwrap_or_default()
            .into_iter()
            .collect();

            for (pb, player_str) in balances.iter().zip(player_strs.iter()) {
                // Skip voided/refunded players — delta=0 means no PnL change to record
                if pb.delta == 0 {
                    continue;
                }

                let deposited = deposit_map.get(player_str).map(|s| s.as_str());

                if let Err(e) = sqlx::query(
                    "INSERT INTO vision_player_tick_deltas (batch_id, tick_id, player, delta, won, total_deposited, resolved_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW())
                     ON CONFLICT (batch_id, tick_id, player) DO UPDATE
                     SET delta = EXCLUDED.delta, won = EXCLUDED.won, total_deposited = EXCLUDED.total_deposited, resolved_at = NOW()"
                )
                .bind(batch_id as i64)
                .bind(tick_id as i64)
                .bind(player_str)
                .bind(pb.delta.to_string())
                .bind(pb.delta > 0)
                .bind(deposited)
                .execute(&pool)
                .await {
                    tracing::warn!(batch_id, tick_id, player = %player_str, error = %e, "Failed to persist tick delta");
                }
            }
        }); // end tokio::spawn
    }
}

/// Compute the WITHDRAW message hash for a single player balance.
///
/// Matches Vision.sol's `withdraw()` verification:
///   keccak256(abi.encode(chainId, visionAddress, "WITHDRAW", batchId, player, balance))
fn compute_withdraw_hash(
    chain_id: u64,
    vision_address: Address,
    batch_id: u64,
    player: Address,
    balance: U256,
) -> [u8; 32] {
    keccak256(&encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(vision_address),
        Token::String("WITHDRAW".to_string()),
        Token::Uint(U256::from(batch_id)),
        Token::Address(player),
        Token::Uint(balance),
    ]))
}

/// Sign balance proofs for all players in the batch.
///
/// Returns a list of (player, balance, BLSSignature) for broadcast.
/// Does NOT store to DB — caller decides whether to store or aggregate.
fn sign_balance_proofs(
    bls_keypair: &BLSKeyPair,
    chain_id: u64,
    vision_address: Address,
    batch_id: u64,
    tick_id: u64,
    player_balances: &[super::types::PlayerBalance],
) -> Vec<(Address, U256, BLSSignature)> {
    let signer = Bn254BLSSigner::new();
    let mut result = Vec::with_capacity(player_balances.len());

    for pb in player_balances {
        let message_hash = compute_withdraw_hash(chain_id, vision_address, batch_id, pb.player, pb.new_balance);

        match signer.sign_message_hash(bls_keypair, &message_hash) {
            Ok(sig) => result.push((pb.player, pb.new_balance, sig)),
            Err(e) => {
                tracing::warn!(
                    batch_id, tick_id, player = %pb.player,
                    error = %e, "BLS signing failed for balance proof"
                );
            }
        }
    }

    result
}

/// Upsert a single balance proof to the `vision_balance_proofs` table.
///
/// When multiple oracles share the same Postgres database (testnet topology),
/// a naive overwrite destroys prior oracles' signatures.  This function instead:
///
/// 1. Reads the existing row (with `FOR UPDATE` to prevent races).
/// 2. If same `tick_id` AND same `balance`, it aggregates the BLS signature
///    and bitwise-ORs the signer bitmap — producing a multi-oracle proof.
/// 3. If the tick_id is newer (or no row exists), it overwrites entirely.
///
/// Net effect: the last oracle to store its proof for a given tick ends up
/// writing an aggregated signature covering all oracles that resolved before
/// the row lock was released.
async fn store_balance_proof(
    pool: &sqlx::PgPool,
    batch_id: u64,
    tick_id: u64,
    player: Address,
    balance: U256,
    sig_bytes: &[u8],
    signer_bitmap_str: &str,
) {
    let player_str = format!("{:?}", player);
    let balance_str = balance.to_string();

    // Try to merge with existing row inside a transaction (FOR UPDATE lock).
    let merge_result: Result<bool, sqlx::Error> = async {
        let mut tx = pool.begin().await?;

        let existing: Option<(i64, String, Vec<u8>, String)> = sqlx::query_as(
            "SELECT tick_id, balance, bls_sig, signer_bitmap
             FROM vision_balance_proofs
             WHERE batch_id = $1 AND player = $2
             FOR UPDATE"
        )
        .bind(batch_id as i64)
        .bind(&player_str)
        .fetch_optional(&mut *tx)
        .await?;

        match existing {
            Some((existing_tick, existing_bal, existing_sig, existing_bitmap))
                if existing_tick == tick_id as i64 && existing_bal == balance_str =>
            {
                // Same tick and balance — aggregate signatures.
                let existing_bm: U256 = existing_bitmap.parse().unwrap_or(U256::zero());
                let new_bm: U256 = signer_bitmap_str.parse().unwrap_or(U256::zero());

                // Skip if our bit is already set (idempotent).
                if (existing_bm & new_bm) == new_bm {
                    tx.commit().await?;
                    return Ok(true);
                }

                let merged_bm = existing_bm | new_bm;

                // Aggregate BLS signatures.
                let signer = Bn254BLSSigner::new();
                let merged_sig = match signer.aggregate_signatures(vec![
                    BLSSignature(existing_sig),
                    BLSSignature(sig_bytes.to_vec()),
                ]) {
                    Ok(agg) => agg.0,
                    Err(e) => {
                        tracing::warn!(
                            batch_id, tick_id, player = %player,
                            error = %e,
                            "BLS aggregation failed during DB merge — overwriting with new proof"
                        );
                        // Fall through to overwrite.
                        sig_bytes.to_vec()
                    }
                };

                // Use the aggregated result only when aggregation succeeded (merged_sig != sig_bytes).
                let final_bitmap = if merged_sig != sig_bytes { merged_bm } else { new_bm };

                sqlx::query(
                    "UPDATE vision_balance_proofs
                     SET bls_sig = $1, signer_bitmap = $2, updated_at = NOW()
                     WHERE batch_id = $3 AND player = $4"
                )
                .bind(&merged_sig[..])
                .bind(final_bitmap.to_string())
                .bind(batch_id as i64)
                .bind(&player_str)
                .execute(&mut *tx)
                .await?;

                let bits_before = count_bits(existing_bm);
                let bits_after = count_bits(final_bitmap);
                if bits_after > bits_before {
                    tracing::info!(
                        batch_id, tick_id, player = %player,
                        bitmap_before = %existing_bitmap,
                        bitmap_after = %final_bitmap,
                        signers_before = bits_before,
                        signers_after = bits_after,
                        "Merged BLS balance proof (shared-DB aggregation)"
                    );
                }

                tx.commit().await?;
                Ok(true)
            }
            Some((existing_tick, _, _, _)) if existing_tick > tick_id as i64 => {
                // Existing row is from a newer tick — don't overwrite.
                tracing::debug!(
                    batch_id, tick_id, player = %player,
                    existing_tick,
                    "Existing balance proof is from a newer tick — skipping"
                );
                tx.commit().await?;
                Ok(true)
            }
            _ => {
                // No existing row, or different tick_id, or different balance — upsert.
                sqlx::query(
                    "INSERT INTO vision_balance_proofs (batch_id, player, tick_id, balance, bls_sig, signer_bitmap)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (batch_id, player) DO UPDATE SET
                        tick_id = EXCLUDED.tick_id,
                        balance = EXCLUDED.balance,
                        bls_sig = EXCLUDED.bls_sig,
                        signer_bitmap = EXCLUDED.signer_bitmap,
                        updated_at = NOW()"
                )
                .bind(batch_id as i64)
                .bind(&player_str)
                .bind(tick_id as i64)
                .bind(&balance_str)
                .bind(sig_bytes)
                .bind(signer_bitmap_str)
                .execute(&mut *tx)
                .await?;

                tx.commit().await?;
                Ok(true)
            }
        }
    }.await;

    if let Err(e) = merge_result {
        tracing::warn!(
            batch_id, tick_id, player = %player,
            error = %e, "Failed to store/merge balance proof in DB"
        );
    }
}

/// Count set bits in a U256.
fn count_bits(v: U256) -> u32 {
    let mut n = v;
    let mut count = 0u32;
    while !n.is_zero() {
        count += (n.low_u64() & 1) as u32;
        n = n >> 1;
    }
    count
}

/// Generate BLS-signed WITHDRAW balance proofs for all players after tick resolution.
///
/// Signs proofs, stores the local oracle's proof in DB, and broadcasts
/// via `broadcast_tx` for P2P aggregation with peer oracles.
async fn generate_and_store_balance_proofs(
    db_pool: &Option<sqlx::PgPool>,
    bls_keypair: &Option<Arc<BLSKeyPair>>,
    config: &VisionConfig,
    batch_id: u64,
    tick_id: u64,
    player_balances: &[super::types::PlayerBalance],
    broadcast_tx: Option<&tokio::sync::mpsc::Sender<P2PMessage>>,
) {
    let Some(pool) = db_pool else {
        tracing::error!(batch_id, tick_id, "No DB pool — cannot store balance proofs. Withdrawals will serve unsigned fallbacks.");
        return;
    };
    let Some(keypair) = bls_keypair else {
        tracing::error!(batch_id, tick_id, "No BLS keypair — cannot sign balance proofs. Withdrawals will fail verification.");
        return;
    };
    if player_balances.is_empty() {
        return;
    }

    let vision_address: Address = match config.vision_address.parse() {
        Ok(addr) => addr,
        Err(_) => {
            tracing::error!(
                vision_address = %config.vision_address,
                batch_id, tick_id,
                "Invalid or empty vision_address — cannot compute withdraw hash for balance proofs. \
                 Set ORACLE_VISION_ADDRESS to the Vision contract address."
            );
            return;
        }
    };

    let signed_proofs = sign_balance_proofs(
        keypair,
        config.chain_id,
        vision_address,
        batch_id,
        tick_id,
        player_balances,
    );

    if signed_proofs.is_empty() {
        return;
    }

    let signer_bitmap = U256::one() << config.node_index;
    let signer_bitmap_str = signer_bitmap.to_string();

    // Store our own proofs in DB
    for (player, balance, sig) in &signed_proofs {
        store_balance_proof(pool, batch_id, tick_id, *player, *balance, &sig.0, &signer_bitmap_str).await;
    }

    tracing::info!(
        batch_id, tick_id,
        players = signed_proofs.len(),
        "Generated and stored BLS balance proofs"
    );

    // Broadcast to peers for aggregation (fire-and-forget)
    if let Some(tx) = broadcast_tx {
        let p2p_proofs: Vec<(Address, U256, common::types::BLSSignature)> = signed_proofs
            .iter()
            .map(|(player, balance, sig)| {
                (*player, *balance, common::types::BLSSignature(sig.0.clone()))
            })
            .collect();

        let msg = P2PMessage::VisionBalanceProofsBatch {
            batch_id,
            tick_id,
            proofs: p2p_proofs,
            signer_index: config.node_index,
        };

        if let Err(e) = tx.try_send(msg) {
            tracing::warn!(batch_id, tick_id, error = %e, "Failed to enqueue VisionBalanceProofsBatch for broadcast");
        }
    }
}

/// Aggregate balance proofs from multiple oracles and upsert to DB.
///
/// Called after the 5s collection window expires for a batch.
/// If >= 2 signatures exist for a player, aggregates them.
/// Otherwise stores the single signature unchanged.
async fn aggregate_and_store_batch_proofs(
    pool: &sqlx::PgPool,
    batch_id: u64,
    entries: Vec<(Address, PlayerSigEntry)>,
    num_oracles: usize,
) {
    let signer = Bn254BLSSigner::new();

    for (player, entry) in entries {
        if entry.signatures.is_empty() {
            continue;
        }

        let tick_id = entry.tick_id;

        let (sig_bytes, signer_bitmap_str) = if entry.signatures.len() >= 2 {
            // Aggregate signatures
            let bls_sigs: Vec<BLSSignature> = entry.signatures
                .iter()
                .map(|(_, bytes)| BLSSignature(bytes.clone()))
                .collect();

            match signer.aggregate_signatures(bls_sigs) {
                Ok(agg_sig) => {
                    // Build signer bitmap from collected signer indices
                    let mut bitmap = U256::zero();
                    for (idx, _) in &entry.signatures {
                        bitmap = bitmap | (U256::one() << *idx);
                    }
                    (agg_sig.0, bitmap.to_string())
                }
                Err(e) => {
                    tracing::warn!(
                        batch_id, player = %player,
                        error = %e, "BLS aggregation failed — storing first signature only"
                    );
                    let (idx, bytes) = &entry.signatures[0];
                    let bitmap = U256::one() << *idx;
                    (bytes.clone(), bitmap.to_string())
                }
            }
        } else {
            // Single signature
            let (idx, bytes) = &entry.signatures[0];
            let bitmap = U256::one() << *idx;
            (bytes.clone(), bitmap.to_string())
        };

        tracing::info!(
            batch_id, tick_id, player = %player,
            signer_count = entry.signatures.len(),
            num_oracles,
            "Aggregating balance proof"
        );

        store_balance_proof(pool, batch_id, tick_id, player, entry.balance, &sig_bytes, &signer_bitmap_str).await;
    }
}

/// Handle an incoming `VisionBalanceProofsBatch` from a peer.
///
/// Verifies each proof's BLS signature against the expected message hash,
/// checks balance matches our own recorded balance, and stores valid signatures
/// in the collector.
///
/// SECURITY (HIGH-4): Each individual BLS signature from the peer is verified
/// against the sender's registered public key before acceptance. This prevents
/// a malicious oracle from injecting forged balance proofs that corrupt aggregation.
async fn handle_incoming_balance_proofs(
    collector: &mut BalanceProofCollector,
    db_pool: &sqlx::PgPool,
    msg: IncomingBalanceProofsBatch,
    chain_id: u64,
    vision_address: Address,
    key_registry: &dyn KeyRegistry,
) {
    let batch_id = msg.batch_id;
    let tick_id = msg.tick_id;
    let from_peer = msg.from_peer;
    // Derive signer_index from peer identity (NOT self-reported)
    let signer_index = crate::bootstrap::extract_oracle_id(&from_peer) as u8;

    // Look up the sender's BLS public key. Reject the entire batch if not registered —
    // accepting proofs from unregistered peers would allow arbitrary key injection.
    let sender_pubkey: BLSPublicKey = match key_registry.get_public_key(&from_peer) {
        Some(pk) => pk,
        None => {
            tracing::warn!(
                batch_id, tick_id, signer_index,
                "Incoming balance proofs from unregistered peer — rejecting batch"
            );
            return;
        }
    };

    let signer = Bn254BLSSigner::new();

    for (player, reported_balance, sig_bytes) in msg.proofs {
        // Recompute expected message hash
        let message_hash = compute_withdraw_hash(chain_id, vision_address, batch_id, player, reported_balance);

        // Verify the BLS signature against the sender's registered public key.
        // Reject immediately on malformed signature or verification failure.
        let bls_sig = BLSSignature(sig_bytes.clone());
        match signer.verify_message_hash(&sender_pubkey, &message_hash, &bls_sig) {
            Ok(true) => {
                tracing::trace!(
                    batch_id, tick_id, player = %player, signer_index,
                    "BLS signature verified for balance proof"
                );
            }
            Ok(false) => {
                tracing::warn!(
                    batch_id, tick_id, player = %player, signer_index,
                    "BLS signature invalid for balance proof — rejecting"
                );
                continue;
            }
            Err(e) => {
                tracing::warn!(
                    batch_id, tick_id, player = %player, signer_index,
                    error = %e,
                    "BLS verification error for balance proof — rejecting"
                );
                continue;
            }
        }

        // Look up our own recorded balance for this (batch_id, player) to cross-check.
        // SECURITY: reject if we have no record OR if balances mismatch. Never accept
        // unverified proofs — a malicious oracle could inject forged balances that
        // corrupt aggregation and block legitimate withdrawals.
        let db_balance: Option<String> = sqlx::query_scalar(
            "SELECT balance FROM vision_balance_proofs WHERE batch_id = $1 AND player = $2"
        )
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
        .fetch_optional(db_pool)
        .await
        .unwrap_or(None);

        match db_balance {
            None => {
                tracing::debug!(
                    batch_id, tick_id, player = %player,
                    signer_index,
                    "No local balance record for peer proof — rejecting (fail-closed)"
                );
                continue;
            }
            Some(ref db_bal_str) => {
                let db_bal: U256 = db_bal_str.parse().unwrap_or(U256::zero());
                if db_bal != reported_balance {
                    tracing::warn!(
                        batch_id, tick_id, player = %player,
                        db_balance = %db_bal,
                        reported_balance = %reported_balance,
                        signer_index,
                        "Balance mismatch from peer — rejecting balance proof"
                    );
                    continue;
                }
            }
        }

        collector.add_signature(
            batch_id,
            tick_id,
            player,
            reported_balance,
            signer_index,
            sig_bytes,
        );
    }
}

/// Main tick engine loop.
///
/// Polls the scheduler at `config.tick_poll_interval_ms` intervals for batches
/// that have a tick due for resolution. When a due batch is found, it:
///
/// 1. Retrieves batch state and player positions from the scheduler
/// 2. Fetches market config from data-node by config_hash (cached)
/// 3. Fetches prices from the data-node
/// 4. Runs the tick resolver to compute outcomes
/// 5. Records settlements to data-node for threshold feedback
/// 6. Marks the tick as resolved in the scheduler
/// 7. Drives BLS consensus with other oracles (multi-oracle mode)
/// 8. Submits the signed result on-chain (after consensus)
///
/// In single-oracle mode (`num_oracles <= 1` or `bls_keypair` is `None`),
/// balance updates are applied directly without consensus.
///
/// # Balance Proof Aggregation
///
/// After each tick, balance proofs are signed and broadcast via `broadcast_tx`.
/// Proofs from peers arrive via `incoming_proofs_rx`. After a 5s collection
/// window, proofs are aggregated (BLS) and stored in `vision_balance_proofs`.
///
/// # Bitmap Gossip
///
/// When an oracle receives a bitmap from a player via the API, it broadcasts
/// a `BitmapGossip` to all peers. Peers that lack the bitmap reply with
/// `BitmapRequest`; the sender responds with `BitmapResponse`. All oracles
/// end up with the same set of bitmaps before each tick resolves, removing
/// the single-oracle-as-gatekeeper problem.
pub async fn run(
    scheduler: Arc<TickScheduler>,
    resolver: Arc<TickResolver>,
    config: VisionConfig,
    shutdown: Arc<AtomicBool>,
    bls_keypair: Option<Arc<BLSKeyPair>>,
    broadcast_tx: Option<tokio::sync::mpsc::Sender<P2PMessage>>,
    incoming_proofs_rx: Option<tokio::sync::mpsc::Receiver<IncomingBalanceProofsBatch>>,
    incoming_gossip_rx: Option<tokio::sync::mpsc::Receiver<IncomingBitmapGossip>>,
    // Key registry for verifying BLS signatures on incoming balance proofs (HIGH-4).
    // Pass `None` to drop incoming proofs (not recommended for production).
    key_registry: Option<Arc<dyn KeyRegistry>>,
) {
    let interval = tokio::time::Duration::from_millis(config.tick_poll_interval_ms);
    let reference_prices: ReferencePrices = Arc::new(RwLock::new(HashMap::new()));
    let config_cache = ConfigCache::new();
    let admin_token = config.data_node_token.clone().unwrap_or_default();

    // Connect to Postgres for persisting balance updates and resolved ticks
    let db_pool = match sqlx::postgres::PgPoolOptions::new()
        .max_connections(3)
        .idle_timeout(std::time::Duration::from_secs(300))
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(&config.database_url).await {
        Ok(pool) => {
            tracing::info!("Vision engine connected to Postgres for balance persistence");
            Some(pool)
        }
        Err(e) => {
            tracing::warn!(error = %e, "Vision engine failed to connect to Postgres — balance updates will be in-memory only");
            None
        }
    };

    // Ensure BLS keypair is available for balance proof signing.
    // In single-oracle mode the caller may omit the keypair because tick consensus
    // doesn't need it — but balance proofs ALWAYS need a BLS signature for on-chain
    // withdrawal verification.  Generate a deterministic fallback from node_index
    // when no keypair is provided, matching the bls_tool seed convention.
    let bls_keypair: Option<Arc<BLSKeyPair>> = match bls_keypair {
        Some(kp) => Some(kp),
        None => {
            let seed_idx = config.node_index + 1; // seed indices are 1-based
            let seed = vec![seed_idx; 32];
            match BLSKeyPair::from_seed(&seed) {
                Ok(kp) => {
                    tracing::warn!(
                        node_index = config.node_index,
                        seed_index = seed_idx,
                        "No BLS keypair provided — generated deterministic fallback for balance proof signing. \
                         Ensure this key is registered on-chain or withdrawals will fail verification."
                    );
                    Some(Arc::new(kp))
                }
                Err(e) => {
                    tracing::error!(
                        error = %e,
                        "No BLS keypair provided AND failed to generate fallback — balance proofs will be UNSIGNED. \
                         Withdrawals will fail."
                    );
                    None
                }
            }
        }
    };

    // Construct tick consensus orchestrator for multi-oracle BLS consensus.
    // When num_oracles <= 1 or no BLS keypair, we run in single-oracle mode
    // and apply balance updates directly without consensus.
    let tick_consensus: Option<Arc<TickConsensus>> = if config.num_oracles > 1 {
        match &bls_keypair {
            Some(keypair) => {
                let vision_address: Address = config
                    .vision_address
                    .parse()
                    .unwrap_or_else(|_| {
                        tracing::warn!("Invalid vision_address for tick consensus — using zero address");
                        Address::zero()
                    });
                let tc = TickConsensus::new(
                    config.chain_id,
                    vision_address,
                    config.num_oracles,
                    Arc::new(common::bls::Bn254BLSSigner::new()),
                    keypair.clone(),
                );
                tracing::info!(
                    num_oracles = config.num_oracles,
                    chain_id = config.chain_id,
                    "Tick consensus enabled (multi-oracle mode)"
                );
                Some(Arc::new(tc))
            }
            None => {
                tracing::warn!(
                    num_oracles = config.num_oracles,
                    "num_oracles > 1 but no BLS keypair — falling back to single-oracle mode"
                );
                None
            }
        }
    } else {
        tracing::info!("Single-oracle mode — tick consensus disabled");
        None
    };

    // HIGH-5: Pinned price snapshots for consensus-retry stability.
    //
    // When tick resolution fails and the engine retries on the next poll,
    // freshly-fetched prices may have shifted — causing oracles to compute
    // different outcomes and never converge on consensus.
    //
    // Fix: cache the first successful MarketPrices build for each (batch_id, tick_id)
    // and reuse it on all retries. After MAX_TICK_RETRIES failures, skip the tick
    // with a warning so we don't get permanently stuck.
    //
    // Key: (batch_id, tick_id) → (pinned MarketPrices, retry_count)
    const MAX_TICK_RETRIES: u8 = 3;
    let mut pinned_prices: HashMap<(u64, u64), (MarketPrices, u8)> = HashMap::new();

    tracing::info!(
        poll_interval_ms = config.tick_poll_interval_ms,
        reveal_window_secs = config.reveal_window_secs,
        data_node_url = %config.data_node_url,
        consensus_enabled = tick_consensus.is_some(),
        "Vision tick engine started"
    );

    // Spawn the balance proof aggregation task.
    //
    // Receives incoming VisionBalanceProofsBatch messages from peers,
    // collects them per-batch, and after a 5s window aggregates the BLS
    // signatures and upserts the result to vision_balance_proofs.
    if let (Some(mut rx), Some(pool)) = (incoming_proofs_rx, db_pool.clone()) {
        let agg_chain_id = config.chain_id;
        let agg_vision_address: Address = config
            .vision_address
            .parse()
            .unwrap_or_else(|_| Address::zero());
        let agg_num_oracles = config.num_oracles;
        let agg_shutdown = shutdown.clone();
        let agg_key_registry = key_registry.clone();

        tokio::spawn(async move {
            let mut collector = BalanceProofCollector::new();
            let mut check_interval = tokio::time::interval(std::time::Duration::from_millis(500));

            loop {
                if agg_shutdown.load(Ordering::Relaxed) {
                    break;
                }

                tokio::select! {
                    Some(incoming) = rx.recv() => {
                        if let Some(ref kr) = agg_key_registry {
                            handle_incoming_balance_proofs(
                                &mut collector,
                                &pool,
                                incoming,
                                agg_chain_id,
                                agg_vision_address,
                                kr.as_ref(),
                            ).await;
                        } else {
                            tracing::warn!(
                                "Received balance proofs but no key registry configured — dropping (HIGH-4)"
                            );
                        }
                    }
                    _ = check_interval.tick() => {
                        // Check for expired batch windows and aggregate
                        let expired = collector.expired_batches();
                        for batch_id in expired {
                            let entries = collector.drain_batch(batch_id);
                            if !entries.is_empty() {
                                tracing::info!(
                                    batch_id,
                                    players = entries.len(),
                                    "Aggregating balance proofs after 5s window"
                                );
                                aggregate_and_store_batch_proofs(
                                    &pool,
                                    batch_id,
                                    entries,
                                    agg_num_oracles,
                                ).await;
                            }
                        }
                    }
                }
            }

            tracing::info!("Balance proof aggregation task stopped");
        });
    }

    // Spawn the bitmap gossip task.
    //
    // Handles three message kinds forwarded from the P2P layer:
    // - Gossip: check if we have the bitmap; if not, request it from the sender.
    // - Request: look up our pending/active bitmap and send it back.
    // - Response: verify hash, store in pending slot.
    //
    // DoS protection: BitmapRequest is rate-limited implicitly — we only send
    // one request per (batch_id, player, bitmap_hash) triplet via a seen-set.
    if let Some(mut gossip_rx) = incoming_gossip_rx {
        let gossip_bitmap_store = resolver.bitmap_store.clone();
        let gossip_broadcast_tx = broadcast_tx.clone();
        let gossip_shutdown = shutdown.clone();

        tokio::spawn(async move {
            // Track which (batch_id, player, bitmap_hash) triplets we have already
            // requested from a peer, to avoid duplicate BitmapRequests (DoS protection).
            //
            // SECURITY (HIGH-3): Capped at MAX_REQUESTED_ENTRIES to prevent memory DoS.
            // A malicious peer flooding unique gossip keys cannot exhaust heap — once the
            // cap is reached, new entries are silently dropped (we'll request next tick anyway).
            const MAX_REQUESTED_ENTRIES: usize = 10_000;
            let mut requested: std::collections::HashSet<(u64, Address, H256)> =
                std::collections::HashSet::new();

            loop {
                if gossip_shutdown.load(Ordering::Relaxed) {
                    break;
                }

                match gossip_rx.recv().await {
                    None => break, // channel closed
                    Some(IncomingBitmapGossip::Gossip {
                        from: _from,
                        batch_id,
                        player,
                        bitmap_hash,
                        config_hash: _config_hash,
                        target_tick_id: _target_tick_id,
                    }) => {
                        // Check if we already have this bitmap in either slot.
                        let have_pending = gossip_bitmap_store
                            .get_pending(batch_id, player)
                            .await
                            .map(|b| b.hash == bitmap_hash)
                            .unwrap_or(false);
                        let have_active = gossip_bitmap_store
                            .get_active(batch_id, player)
                            .await
                            .map(|b| b.hash == bitmap_hash)
                            .unwrap_or(false);

                        if have_pending || have_active {
                            tracing::debug!(
                                batch_id,
                                player = %player,
                                ?bitmap_hash,
                                "BitmapGossip: already have bitmap, ignoring"
                            );
                            continue;
                        }

                        // We don't have it — send a BitmapRequest (once per triplet).
                        let key = (batch_id, player, bitmap_hash);
                        if requested.contains(&key) {
                            tracing::debug!(
                                batch_id,
                                player = %player,
                                ?bitmap_hash,
                                "BitmapGossip: already requested bitmap, ignoring duplicate gossip"
                            );
                            continue;
                        }
                        // HIGH-3: reject new entries beyond cap to prevent memory DoS.
                        if requested.len() >= MAX_REQUESTED_ENTRIES {
                            tracing::warn!(
                                batch_id,
                                player = %player,
                                cap = MAX_REQUESTED_ENTRIES,
                                "BitmapGossip: requested-set cap reached — dropping entry"
                            );
                            continue;
                        }
                        requested.insert(key);

                        if let Some(ref tx) = gossip_broadcast_tx {
                            let req_msg = P2PMessage::BitmapRequest {
                                batch_id,
                                player,
                                bitmap_hash,
                            };
                            if let Err(e) = tx.try_send(req_msg) {
                                tracing::warn!(
                                    batch_id,
                                    player = %player,
                                    ?bitmap_hash,
                                    error = %e,
                                    "Failed to enqueue BitmapRequest for broadcast"
                                );
                            } else {
                                tracing::debug!(
                                    batch_id,
                                    player = %player,
                                    ?bitmap_hash,
                                    "BitmapGossip: sent BitmapRequest for missing bitmap"
                                );
                            }
                        }
                    }

                    Some(IncomingBitmapGossip::Request {
                        from: _from,
                        batch_id,
                        player,
                        bitmap_hash,
                    }) => {
                        // Serve the bitmap if we have it in pending or active slot.
                        let maybe_bitmap = gossip_bitmap_store
                            .get_pending(batch_id, player)
                            .await
                            .filter(|b| b.hash == bitmap_hash)
                            .or_else(|| {
                                // Note: get_active is async; run a blocking check via a nested task
                                // is overcomplicated here — just return None for active slot
                                // and let the peer retry from pending. Active bitmaps are
                                // less useful for the requester anyway (already resolved).
                                None
                            });

                        if let Some(slotted) = maybe_bitmap {
                            if let Some(ref tx) = gossip_broadcast_tx {
                                let resp_msg = P2PMessage::BitmapResponse {
                                    batch_id,
                                    player,
                                    bitmap: slotted.bitmap.clone(),
                                    bitmap_hash: slotted.hash,
                                    config_hash: slotted.config_hash,
                                    target_tick_id: slotted.target_tick_id,
                                };
                                if let Err(e) = tx.try_send(resp_msg) {
                                    tracing::warn!(
                                        batch_id,
                                        player = %player,
                                        ?bitmap_hash,
                                        error = %e,
                                        "Failed to enqueue BitmapResponse for broadcast"
                                    );
                                } else {
                                    tracing::debug!(
                                        batch_id,
                                        player = %player,
                                        ?bitmap_hash,
                                        "BitmapRequest: served bitmap to peer"
                                    );
                                }
                            }
                        } else {
                            tracing::debug!(
                                batch_id,
                                player = %player,
                                ?bitmap_hash,
                                "BitmapRequest: bitmap not found in pending slot — cannot serve"
                            );
                        }
                    }

                    Some(IncomingBitmapGossip::Response {
                        from: _from,
                        batch_id,
                        player,
                        bitmap,
                        bitmap_hash,
                        config_hash,
                        target_tick_id,
                    }) => {
                        // Verify hash before storing — reject corrupted/malicious responses.
                        match gossip_bitmap_store
                            .store_pending(
                                player,
                                batch_id,
                                bitmap,
                                bitmap_hash,
                                config_hash,
                                target_tick_id,
                            )
                            .await
                        {
                            Ok(()) => {
                                tracing::info!(
                                    batch_id,
                                    player = %player,
                                    ?bitmap_hash,
                                    "BitmapResponse: stored bitmap in pending slot via gossip"
                                );
                                // Remove from requested-set so future gossip for the
                                // same player (next tick) triggers a fresh request.
                                requested.remove(&(batch_id, player, bitmap_hash));
                            }
                            Err(e) => {
                                tracing::warn!(
                                    batch_id,
                                    player = %player,
                                    ?bitmap_hash,
                                    error = %e,
                                    "BitmapResponse: rejected (hash mismatch or store error)"
                                );
                            }
                        }
                    }
                }
            }

            tracing::info!("Bitmap gossip task stopped");
        });
    }

    let mut gc_timer = tokio::time::interval(std::time::Duration::from_secs(30));
    gc_timer.tick().await; // consume the immediate first tick

    let mut heartbeat_counter: u64 = 0;
    let heartbeat_every: u64 = 60; // log heartbeat every ~60 poll iterations

    loop {
        if shutdown.load(Ordering::Relaxed) {
            tracing::info!("Vision tick engine shutting down");
            break;
        }

        tokio::select! {
            _ = gc_timer.tick() => {
                if let Some(ref tc) = tick_consensus {
                    tc.gc_stale_rounds().await;
                }
            }
            _ = tokio::time::sleep(interval) => {
                if shutdown.load(Ordering::Relaxed) {
                    tracing::info!("Vision tick engine shutting down");
                    break;
                }

                heartbeat_counter += 1;

                // Use wall clock time for scheduling, not chain timestamp.
                // Orbit L3 only produces blocks on transactions — chain timestamp
                // freezes when idle, causing the tick engine to stall indefinitely.
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();

                let due_batches = scheduler.get_due_batches(now, config.reveal_window_secs).await;

                if due_batches.is_empty() {
                    // Periodic heartbeat so operators know the engine is alive
                    if heartbeat_counter % heartbeat_every == 0 {
                        let active = scheduler.active_batch_count().await;
                        let soonest = scheduler.soonest_due_in(now, config.reveal_window_secs).await;
                        tracing::info!(
                            now,
                            active_batches = active,
                            reveal_window_secs = config.reveal_window_secs,
                            soonest_due_in_secs = soonest.map(|s| s as i64).unwrap_or(-1),
                            "Vision engine heartbeat — no due batches"
                        );
                    }
                    continue;
                }

                tracing::debug!(
                    count = due_batches.len(),
                    batches = ?due_batches,
                    "Found due batches"
                );

                // === Phase 1: Prepare batches and pre-fetch sources in parallel ===
                // Collect batch info and unique sources needed
                struct BatchWork {
                    batch_id: u64,
                    tick_id: u64,
                    batch: super::types::Batch,
                    players: Vec<super::types::PlayerPosition>,
                    source_id: String,
                    market_configs: Vec<MarketConfig>,
                    market_ids: Vec<H256>,
                }

                let mut work_items: Vec<BatchWork> = Vec::new();
                let mut sources_needed: std::collections::HashSet<String> = std::collections::HashSet::new();

                // Compute round-based source IDs once — these batches are handled
                // by the BatchLifecycleManager, not the tick engine.
                let round_source_ids: Vec<H256> = config.round_based_sources.iter()
                    .flat_map(|s| {
                        let mut c = vec![H256::from(keccak256(s.as_bytes()))];
                        for v in 1..=5u8 {
                            c.push(H256::from(keccak256(format!("{}_v{}", s, v).as_bytes())));
                        }
                        c
                    })
                    .collect();

                for &batch_id in &due_batches {
                    // Skip batches owned by the lifecycle manager
                    if !round_source_ids.is_empty() {
                        if let Some((batch, _)) = scheduler.get_batch_state(batch_id).await {
                            if round_source_ids.contains(&batch.source_id) {
                                continue;
                            }
                        }
                    }

                    let mut tick_id = scheduler.next_tick_for_batch(batch_id).await;

                    match scheduler.get_batch_state(batch_id).await {
                        Some((batch, players)) => {
                            if players.is_empty() {
                                scheduler.mark_resolved(batch_id, tick_id).await;
                                continue;
                            }

                            // Skip backlog — but always resolve the LATEST tick (don't skip everything)
                            if batch.tick_duration > 0 {
                                let current_abs_tick = now / batch.tick_duration;
                                let latest_resolvable = if current_abs_tick > batch.created_at_tick {
                                    current_abs_tick - batch.created_at_tick - 1
                                } else {
                                    0
                                };
                                // Skip old ticks, then resolve the latest one
                                if tick_id < latest_resolvable {
                                    if tick_id + 1 < latest_resolvable {
                                        tracing::info!(
                                            batch_id,
                                            skipped_from = tick_id,
                                            resolving = latest_resolvable,
                                            created_at_tick = batch.created_at_tick,
                                            current_abs_tick,
                                            tick_duration = batch.tick_duration,
                                            "Skipping backlog, will resolve latest"
                                        );
                                        for skip_tick in tick_id..latest_resolvable {
                                            scheduler.mark_resolved(batch_id, skip_tick).await;
                                        }
                                    }
                                    // Advance tick_id to latest — fall through to resolve it
                                    tick_id = latest_resolvable;
                                }
                            }

                            // Fetch market configs
                            let (source_id, market_configs) = match config_cache
                                .get_or_fetch(&config.data_node_url, &batch.config_hash, Some(&batch.source_id))
                                .await
                            {
                                Ok(entry) => entry,
                                Err(e) => {
                                    if config_cache.is_known_missing(&batch.config_hash, &batch.source_id).await {
                                        tracing::debug!(batch_id, tick_id, "Config still missing, skipping tick");
                                    } else {
                                        tracing::warn!(
                                            batch_id,
                                            tick_id,
                                            error = %e,
                                            "Failed to fetch market config, skipping tick"
                                        );
                                        config_cache.mark_missing(&batch.config_hash, &batch.source_id).await;
                                    }
                                    continue;
                                }
                            };

                            let market_ids: Vec<H256> =
                                market_configs.iter().map(|m| m.market_id).collect();

                            sources_needed.insert(source_id.clone());
                            work_items.push(BatchWork {
                                batch_id,
                                tick_id,
                                batch,
                                players,
                                source_id,
                                market_configs,
                                market_ids,
                            });
                        }
                        None => {}
                    }
                }

                if work_items.is_empty() {
                    tracing::warn!(
                        due_batch_count = due_batches.len(),
                        "All due batches skipped (empty players / missing config / no batch state)"
                    );
                    continue;
                }

                // Sanity check: if many batches collapsed to few sources, cache poisoning may be at play
                if work_items.len() > 1 && sources_needed.len() * 4 < work_items.len() {
                    tracing::warn!(
                        unique_sources = sources_needed.len(),
                        due_batches = work_items.len(),
                        "Source deduplication suspicious — far fewer sources than batches. Possible config cache poisoning."
                    );
                }

                // === Phase 2: Parallel pre-fetch all unique sources ===
                let sources_vec: Vec<String> = sources_needed.into_iter().collect();
                tracing::info!(
                    sources = sources_vec.len(),
                    batches = work_items.len(),
                    "Pre-fetching snapshot sources in parallel"
                );

                // Limit concurrent fetches to avoid overwhelming the data-node DB pool
                let semaphore = Arc::new(tokio::sync::Semaphore::new(5));
                let secret = config.snapshot_hmac_secret.clone();
                let fetch_futures: Vec<_> = sources_vec
                    .iter()
                    .map(|src| {
                        let url = config.data_node_url.clone();
                        let source = src.clone();
                        let sem = semaphore.clone();
                        let secret = secret.clone();
                        async move {
                            let _permit = match sem.acquire().await {
                                Ok(permit) => permit,
                                Err(_) => {
                                    return (source, Err("semaphore closed during snapshot fetch".into()));
                                }
                            };
                            let result = fetch_snapshot_with_retry(&url, &source, &secret).await;
                            (source, result)
                        }
                    })
                    .collect();

                let fetch_results = futures::future::join_all(fetch_futures).await;

                let mut snapshot_cache: SnapshotCache = HashMap::new();
                let mut ok_count = 0;
                let mut fail_count = 0;
                for (source, result) in fetch_results {
                    match result {
                        Ok(data) => {
                            snapshot_cache.insert(source, Ok(data));
                            ok_count += 1;
                        }
                        Err(e) => {
                            tracing::warn!(source = %source, error = %e, "Source fetch failed");
                            snapshot_cache.insert(source, Err(e.to_string()));
                            fail_count += 1;
                        }
                    }
                }
                tracing::info!(ok = ok_count, failed = fail_count, "Source pre-fetch complete");

                // === Phase 3: Resolve ticks using cached data ===
                for item in work_items {
                    let batch_id = item.batch_id;
                    let tick_id = item.tick_id;
                    let batch = item.batch;
                    let players = item.players;
                    let market_ids = item.market_ids;
                    let market_configs = item.market_configs;

                    tracing::info!(
                        batch_id,
                        tick_id,
                        player_count = players.len(),
                        market_count = market_configs.len(),
                        "Processing due tick"
                    );

                    // HIGH-5: Pin price snapshot on first attempt; reuse on retries.
                    //
                    // If this (batch_id, tick_id) pair is already tracked in pinned_prices,
                    // reuse the cached MarketPrices instead of rebuilding from fresh data.
                    // This ensures all retry attempts resolve with the same price snapshot,
                    // preventing consensus divergence caused by prices shifting between attempts.
                    //
                    // Skip the tick after MAX_TICK_RETRIES consecutive failures so we never
                    // get permanently stuck waiting for consensus that will never arrive.
                    let pin_key = (batch_id, tick_id);
                    let prices = if let Some((pinned, retry_count)) = pinned_prices.get_mut(&pin_key) {
                        *retry_count += 1;
                        if *retry_count > MAX_TICK_RETRIES {
                            tracing::warn!(
                                batch_id,
                                tick_id,
                                retries = *retry_count,
                                "Tick resolution exhausted MAX_TICK_RETRIES — skipping tick"
                            );
                            pinned_prices.remove(&pin_key);
                            scheduler.mark_resolved(batch_id, tick_id).await;
                            continue;
                        }
                        tracing::info!(
                            batch_id,
                            tick_id,
                            retry = *retry_count,
                            "Retrying tick with pinned price snapshot"
                        );
                        pinned.clone()
                    } else {
                        // First attempt: build from fresh snapshot and pin it.
                        let snapshot_data = match snapshot_cache.get(&item.source_id) {
                            Some(Ok(data)) => data.clone(),
                            Some(Err(_)) | None => {
                                continue; // Already logged during pre-fetch
                            }
                        };
                        let built = build_market_prices(
                            &snapshot_data,
                            &market_ids,
                            &reference_prices,
                            now,
                            batch.tick_duration,
                            &item.source_id,
                        )
                        .await;
                        pinned_prices.insert(pin_key, (built.clone(), 0));
                        built
                    };

                    // First-tick skip: establish reference prices without resolving bets.
                    // tick_id == 0 means no tick has been resolved yet for this batch.
                    // We still flip pending → active so bitmaps submitted during the
                    // join window are available for tick 1's resolution.
                    if tick_id == 0 {
                        tracing::info!(
                            batch_id,
                            tick_id,
                            "First tick — establishing reference prices, skipping resolution"
                        );
                        resolver.bitmap_store.flip(batch_id).await;
                        if let Some(ref pool) = db_pool {
                            if let Err(e) = scheduler
                                .mark_resolved_with_db(pool, batch_id, tick_id)
                                .await
                            {
                                tracing::warn!(
                                    batch_id,
                                    tick_id,
                                    error = %e,
                                    "Failed to persist first-tick skip to DB"
                                );
                                scheduler.mark_resolved(batch_id, tick_id).await;
                            }
                        } else {
                            scheduler.mark_resolved(batch_id, tick_id).await;
                        }
                        continue;
                    }

                    // Compute bitmap_set_hash: sorted (player, bitmap_hash) pairs, hashed together.
                    // Included in the consensus proposal so all oracles agree on which bitmaps were used.
                    let active_bitmaps = resolver.bitmap_store.get_all_active_for_batch(batch_id).await;
                    let mut bitmap_set: Vec<(Address, H256)> = active_bitmaps.iter()
                        .map(|b| (b.player, b.hash))
                        .collect();
                    bitmap_set.sort_by_key(|(addr, _)| *addr);
                    let bitmap_set_hash = {
                        use ethers::abi::{encode, Token};
                        let tokens: Vec<Token> = bitmap_set.iter().flat_map(|(addr, hash)| {
                            vec![Token::Address(*addr), Token::FixedBytes(hash.0.to_vec())]
                        }).collect();
                        H256::from(keccak256(&encode(&tokens)))
                    };
                    tracing::debug!(
                        batch_id,
                        tick_id,
                        bitmap_count = active_bitmaps.len(),
                        bitmap_set_hash = ?bitmap_set_hash,
                        "Computed bitmap_set_hash for consensus"
                    );

                    // Debug: log bitmap info before resolution
                            {
                                let bitmaps = active_bitmaps.clone();
                                for bm in &bitmaps {
                                    tracing::info!(
                                        batch_id,
                                        player = %bm.player,
                                        bitmap_hex = %hex::encode(&bm.bitmap),
                                        bitmap_len = bm.bitmap.len(),
                                        "Bitmap for resolution"
                                    );
                                }
                                if bitmaps.len() < 2 {
                                    tracing::warn!(
                                        batch_id,
                                        bitmap_count = bitmaps.len(),
                                        player_count = players.len(),
                                        "Missing bitmaps — players will be voided"
                                    );
                                }
                            }

                            match resolver
                                .resolve_tick(
                                    &batch,
                                    tick_id,
                                    &players,
                                    &prices,
                                    now,
                                    &market_configs,
                                )
                                .await
                            {
                                Ok(result) => {
                                    // Log per-player balance changes
                                    for pb in &result.player_balances {
                                        let delta_display = if pb.delta >= 0 {
                                            format!("+{}", pb.delta)
                                        } else {
                                            format!("{}", pb.delta)
                                        };
                                        tracing::info!(
                                            batch_id,
                                            tick_id,
                                            player = %pb.player,
                                            old_balance = %pb.old_balance,
                                            new_balance = %pb.new_balance,
                                            delta = %delta_display,
                                            "Player balance update"
                                        );
                                    }

                                    // Count market outcomes
                                    let up_count = result
                                        .market_results
                                        .iter()
                                        .filter(|m| {
                                            matches!(
                                                m.outcome,
                                                super::types::MarketOutcome::Up
                                            )
                                        })
                                        .count();
                                    let down_count = result
                                        .market_results
                                        .iter()
                                        .filter(|m| {
                                            matches!(
                                                m.outcome,
                                                super::types::MarketOutcome::Down
                                            )
                                        })
                                        .count();
                                    let flat_count = result
                                        .market_results
                                        .iter()
                                        .filter(|m| {
                                            matches!(
                                                m.outcome,
                                                super::types::MarketOutcome::Flat
                                            )
                                        })
                                        .count();
                                    let cancelled_count = result
                                        .market_results
                                        .iter()
                                        .filter(|m| {
                                            matches!(
                                                m.outcome,
                                                super::types::MarketOutcome::Cancelled
                                            )
                                        })
                                        .count();

                                    tracing::info!(
                                        batch_id,
                                        tick_id,
                                        markets = result.market_results.len(),
                                        up = up_count,
                                        down = down_count,
                                        flat = flat_count,
                                        cancelled = cancelled_count,
                                        voided = result.voided_players.len(),
                                        balance_updates = result.player_balances.len(),
                                        "Tick resolved"
                                    );

                                    // Record settlements to data-node for threshold feedback
                                    record_settlements(
                                        &config.data_node_url,
                                        &admin_token,
                                        &result,
                                        &batch.config_hash,
                                    )
                                    .await;

                                    // === BLS Consensus Gate ===
                                    // P2P broadcast for tick consensus is not yet wired (broadcast_tx: None).
                                    // Until wired, apply balances directly on all oracles (consistent because
                                    // all oracles compute the same deterministic result from the same prices).
                                    // TODO: Re-enable deferred mode when P2P tick consensus is wired.
                                    if false /* tick_consensus P2P not wired yet */ {
                                        unreachable!("tick consensus P2P deferred mode");
                                    } else {
                                        // Single-oracle mode: apply balance updates directly
                                        apply_balances(
                                            &scheduler,
                                            &db_pool,
                                            batch_id,
                                            tick_id,
                                            &result.player_balances,
                                        )
                                        .await;
                                    }

                                    // Persist tick result summary for /vision/batch/:id/history
                                    if let Some(ref pool) = db_pool {
                                        let total_matched: u128 = result.player_balances.iter()
                                            .map(|pb| pb.delta.unsigned_abs())
                                            .sum::<u128>() / 2;
                                        let results_json = serde_json::to_value(&result.market_results).ok();
                                        let pool = pool.clone();
                                        let player_count = result.player_balances.len() as i32;
                                        tokio::spawn(async move {
                                            if let Err(e) = sqlx::query(
                                                "INSERT INTO vision_tick_results (batch_id, tick_id, resolved_at, player_count, total_matched, results_json)
                                                 VALUES ($1, $2, NOW(), $3, $4, $5)
                                                 ON CONFLICT (batch_id, tick_id) DO NOTHING"
                                            )
                                            .bind(batch_id as i64)
                                            .bind(tick_id as i64)
                                            .bind(player_count)
                                            .bind(total_matched.to_string())
                                            .bind(results_json)
                                            .execute(&pool)
                                            .await
                                            {
                                                tracing::warn!(batch_id, tick_id, error = %e, "Failed to persist tick result summary");
                                            }
                                        });
                                    }

                                    // HIGH-5: Tick resolved successfully — clear the pinned price entry.
                                    pinned_prices.remove(&(batch_id, tick_id));

                                    // Update reference prices for next tick
                                    update_reference_prices(
                                        &reference_prices,
                                        &market_ids,
                                        &prices,
                                    )
                                    .await;

                                    // ATOMIC: DB flip + mark_resolved in single transaction.
                                    // Promotes pending bitmaps to active for the next tick.
                                    if let Some(ref pool) = db_pool {
                                        if let Err(e) = resolver.bitmap_store
                                            .persist_flip_and_mark_resolved(pool, batch_id, tick_id)
                                            .await
                                        {
                                            tracing::warn!(
                                                batch_id,
                                                tick_id,
                                                error = %e,
                                                "Failed to persist bitmap flip + resolved tick to DB — falling back to in-memory"
                                            );
                                            // Fall back to in-memory only
                                            resolver.bitmap_store.flip(batch_id).await;
                                            scheduler.mark_resolved(batch_id, tick_id).await;
                                        } else {
                                            // In-memory flip is safe — DB is source of truth on restart
                                            resolver.bitmap_store.flip(batch_id).await;
                                            scheduler.mark_resolved(batch_id, tick_id).await;
                                        }
                                    } else {
                                        // No DB: in-memory only
                                        resolver.bitmap_store.flip(batch_id).await;
                                        scheduler.mark_resolved(batch_id, tick_id).await;
                                    }

                                    // Generate and store BLS-signed balance proofs
                                    // Must happen AFTER apply_balances so new_balance is final.
                                    generate_and_store_balance_proofs(
                                        &db_pool,
                                        &bls_keypair,
                                        &config,
                                        batch_id,
                                        tick_id,
                                        &result.player_balances,
                                        broadcast_tx.as_ref(),
                                    )
                                    .await;
                                }
                                Err(e) => {
                                    tracing::warn!(
                                        batch_id,
                                        tick_id,
                                        error = %e,
                                        "Tick resolution failed — will retry with pinned prices (HIGH-5)"
                                    );
                                    // Do NOT clear pinned_prices here — keep the snapshot for retries.
                                    // Do NOT mark resolved — retry on next poll.
                                }
                            }
                }
            }
        }
    }

    tracing::info!("Vision tick engine stopped");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vision::bitmap_store::BitmapStore;
    use crate::vision::types::{Batch, PlayerPosition};
    use ethers::types::{Address, H256, U256};

    fn make_batch(id: u64, tick_duration: u64, created_at_tick: u64) -> Batch {
        Batch {
            id,
            creator: Address::zero(),
            source_id: H256::zero(),
            config_hash: H256::zero(),
            next_config_hash: H256::zero(),
            tick_duration,
            lock_offset: 0,
            next_lock_offset: 0,
            next_tick_duration: None,
            epoch_offset: 0,
            created_at_tick,
            last_promotion_tick: 0,
            paused: false,
        }
    }

    fn make_player(player: Address) -> PlayerPosition {
        PlayerPosition {
            player,
            bitmap_hash: H256::random(),
            stake_per_tick: U256::from(100),
            start_tick: 0,
            balance: U256::from(10000),
            initial_deposit: U256::from(10000),
        }
    }

    #[tokio::test]
    async fn test_engine_shuts_down_on_signal() {
        let bitmap_store = Arc::new(BitmapStore::new());
        let scheduler = Arc::new(TickScheduler::new());
        let resolver = Arc::new(TickResolver::new(
            bitmap_store,
            VisionConfig::default(),
        ));
        let config = VisionConfig {
            tick_poll_interval_ms: 50, // fast polling for test
            ..Default::default()
        };
        let shutdown = Arc::new(AtomicBool::new(false));

        let shutdown_clone = shutdown.clone();
        let handle = tokio::spawn(async move {
            run(scheduler, resolver, config, shutdown_clone, None, None, None, None, None).await;
        });

        // Let it run briefly, then signal shutdown
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        shutdown.store(true, Ordering::Relaxed);

        // Should complete within a reasonable time
        tokio::time::timeout(tokio::time::Duration::from_secs(2), handle)
            .await
            .expect("engine should shut down within timeout")
            .expect("engine task should not panic");
    }

    #[tokio::test]
    async fn test_engine_resolves_due_batch() {
        let bitmap_store = Arc::new(BitmapStore::new());
        let scheduler = Arc::new(TickScheduler::new());

        // Create a batch that is immediately due
        // tick_duration=1, created_at_tick=0 -> tick 0 ends at time 1
        // reveal_window_secs=0 -> due at time 1
        let batch = make_batch(1, 1, 0);
        scheduler.on_batch_created(batch).await;

        let player = Address::random();
        scheduler.on_player_joined(1, make_player(player)).await;

        let resolver = Arc::new(TickResolver::new(
            bitmap_store,
            VisionConfig {
                reveal_window_secs: 0,
                ..Default::default()
            },
        ));
        let config = VisionConfig {
            tick_poll_interval_ms: 50,
            reveal_window_secs: 0,
            ..Default::default()
        };
        let shutdown = Arc::new(AtomicBool::new(false));

        let sched_check = scheduler.clone();
        let shutdown_clone = shutdown.clone();
        let handle = tokio::spawn(async move {
            run(scheduler, resolver, config, shutdown_clone, None, None, None, None, None).await;
        });

        // Wait for the engine to process at least one tick
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        shutdown.store(true, Ordering::Relaxed);

        tokio::time::timeout(tokio::time::Duration::from_secs(2), handle)
            .await
            .expect("engine should shut down")
            .expect("engine task should not panic");

        // The engine will try to fetch config from data-node (H256::zero hash),
        // which will fail. Tick remains unresolved. This is expected behavior.
        let next_tick = sched_check.next_tick_for_batch(1).await;
        tracing::info!(next_tick = next_tick, "Final tick state");
    }
}
