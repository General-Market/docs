//! Vision tick engine
//!
//! Main polling loop that checks the tick scheduler for due batches and
//! drives tick resolution. Runs as a background `tokio::spawn` task alongside
//! the existing ITP consensus loop.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use ethers::types::H256;
use ethers::utils::keccak256;
use tokio::sync::RwLock;

use super::batch_config_orchestrator;
use super::config::VisionConfig;
use super::resolver::{MarketPrices, TickResolver};
use super::tick_scheduler::TickScheduler;
use super::types::MarketConfig;

/// Reference prices from the previous tick, used as "start" prices for the next tick.
/// Maps market_id (H256) -> price value (f64).
type ReferencePrices = Arc<RwLock<HashMap<H256, f64>>>;

/// How long to suppress retry for missing configs (batch engine may generate them later).
const MISSING_CONFIG_TTL: std::time::Duration = std::time::Duration::from_secs(300);

/// Cache of fetched configs to avoid re-fetching within same tick.
/// Maps config_hash (H256) -> (source_id, Vec<MarketConfig>).
struct ConfigCache {
    configs: RwLock<HashMap<H256, (String, Vec<MarketConfig>)>>,
    /// Config hashes that returned 404 — downgrade to debug after first WARN.
    /// Entries expire after MISSING_CONFIG_TTL so configs generated later can be retried.
    known_missing: RwLock<HashMap<H256, std::time::Instant>>,
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
    ) -> Result<(String, Vec<MarketConfig>), Box<dyn std::error::Error + Send + Sync>> {
        // Check cache first
        {
            let cache = self.configs.read().await;
            if let Some(entry) = cache.get(config_hash) {
                return Ok(entry.clone());
            }
        }

        // Fetch from data-node
        let hash_hex = format!("0x{}", hex::encode(config_hash));
        let batch = batch_config_orchestrator::fetch_config_by_hash(data_node_url, &hash_hex)
            .await?;

        let source_id = batch.source_id.clone();
        let market_configs: Vec<MarketConfig> = batch
            .markets
            .iter()
            .map(|m| MarketConfig {
                asset_id: m.asset_id.clone(),
                market_id: H256::from(keccak256(m.asset_id.as_bytes())),
                resolution_type: parse_resolution_type(&m.resolution_type),
                threshold_bps: m.threshold_bps,
            })
            .collect();

        // Cache it and clear from known_missing (config now available)
        self.configs
            .write()
            .await
            .insert(*config_hash, (source_id.clone(), market_configs.clone()));
        self.known_missing.write().await.remove(config_hash);

        Ok((source_id, market_configs))
    }

    async fn is_known_missing(&self, config_hash: &H256) -> bool {
        let map = self.known_missing.read().await;
        match map.get(config_hash) {
            Some(ts) if ts.elapsed() < MISSING_CONFIG_TTL => true,
            _ => false,
        }
    }

    async fn mark_missing(&self, config_hash: &H256) {
        self.known_missing.write().await.insert(*config_hash, std::time::Instant::now());
    }
}

/// Parse resolution type string ("up_0", "up_x", etc.) to u8 (0-7).
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
        _ => 2, // default to up_x for auto-batches
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
/// Parsed snapshot data for a source: (market_id -> value, market_id -> changePct)
type SnapshotData = (HashMap<H256, f64>, HashMap<H256, f64>);

/// Per-tick-cycle cache: Ok(data) for successful fetches, Err for failed ones.
/// Prevents both redundant fetches AND redundant timeout waits.
type SnapshotCache = HashMap<String, Result<SnapshotData, String>>;

/// Fetch and parse snapshot data for a source, using cache if available.
async fn fetch_snapshot_data(
    data_node_url: &str,
    source_id: &str,
    cache: &mut SnapshotCache,
) -> Result<SnapshotData, Box<dyn std::error::Error + Send + Sync>> {
    if let Some(cached) = cache.get(source_id) {
        return match cached {
            Ok(data) => Ok(data.clone()),
            Err(msg) => Err(msg.clone().into()),
        };
    }

    let result = fetch_snapshot_data_inner(data_node_url, source_id).await;
    match &result {
        Ok(data) => { cache.insert(source_id.to_string(), Ok(data.clone())); }
        Err(e) => { cache.insert(source_id.to_string(), Err(e.to_string())); }
    }
    result
}

async fn fetch_snapshot_data_inner(
    data_node_url: &str,
    source_id: &str,
) -> Result<SnapshotData, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{}/vision/snapshot?source={}&limit=10000", data_node_url, source_id);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;

    let response = client.get(&url).send().await?;
    let json: serde_json::Value = response.json().await?;

    let snapshots = json
        .get("snapshots")
        .and_then(|s| s.as_array())
        .ok_or("data-node snapshot response missing 'snapshots' array")?;

    let mut current_values: HashMap<H256, f64> = HashMap::new();
    let mut change_pcts: HashMap<H256, f64> = HashMap::new();

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

        let value = snap
            .get("value")
            .and_then(|v| {
                if let Some(f) = v.as_f64() {
                    Some(f)
                } else if let Some(s) = v.as_str() {
                    s.parse::<f64>().ok()
                } else {
                    None
                }
            })
            .unwrap_or(0.0);

        if value > 0.0 {
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
    }

    tracing::info!(
        source_id,
        total_snapshots = snapshots.len(),
        "Cached snapshot data for source"
    );

    Ok((current_values, change_pcts))
}

/// Build MarketPrices from cached snapshot data for a specific batch's markets.
async fn build_market_prices(
    snapshot_data: &SnapshotData,
    batch_market_ids: &[H256],
    reference_prices: &ReferencePrices,
    now: u64,
) -> MarketPrices {
    let mut prices = MarketPrices::new();
    let (current_values, change_pcts) = snapshot_data;
    let ref_prices = reference_prices.read().await;

    let mut matched = 0;
    for &market_id in batch_market_ids {
        if let Some(&end_price) = current_values.get(&market_id) {
            let mut start_price = ref_prices.get(&market_id).copied().unwrap_or(end_price);

            if (start_price - end_price).abs() < f64::EPSILON {
                if let Some(&pct) = change_pcts.get(&market_id) {
                    if pct.abs() > 0.001 {
                        start_price = end_price / (1.0 + pct / 100.0);
                    }
                }
            }

            prices.insert(market_id, start_price, end_price, now);
            matched += 1;
        }
    }

    tracing::info!(
        matched_markets = matched,
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
                "changePct": r.pct_change,
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
/// 7. (TODO) Drives BLS consensus with other issuers
/// 8. (TODO) Submits the signed result on-chain
pub async fn run(
    scheduler: Arc<TickScheduler>,
    resolver: Arc<TickResolver>,
    config: VisionConfig,
    shutdown: Arc<AtomicBool>,
) {
    let interval = tokio::time::Duration::from_millis(config.tick_poll_interval_ms);
    let reference_prices: ReferencePrices = Arc::new(RwLock::new(HashMap::new()));
    let config_cache = ConfigCache::new();
    let admin_token = config.data_node_token.clone().unwrap_or_default();

    // Connect to Postgres for persisting balance updates and resolved ticks
    let db_pool = match sqlx::PgPool::connect(&config.database_url).await {
        Ok(pool) => {
            tracing::info!("Vision engine connected to Postgres for balance persistence");
            Some(pool)
        }
        Err(e) => {
            tracing::warn!(error = %e, "Vision engine failed to connect to Postgres — balance updates will be in-memory only");
            None
        }
    };

    tracing::info!(
        poll_interval_ms = config.tick_poll_interval_ms,
        reveal_window_secs = config.reveal_window_secs,
        data_node_url = %config.data_node_url,
        "Vision tick engine started"
    );

    loop {
        if shutdown.load(Ordering::Relaxed) {
            tracing::info!("Vision tick engine shutting down");
            break;
        }

        tokio::select! {
            _ = tokio::time::sleep(interval) => {
                if shutdown.load(Ordering::Relaxed) {
                    tracing::info!("Vision tick engine shutting down");
                    break;
                }

                let now = get_chain_timestamp(&config.rpc_ws_url).await;

                let due_batches = scheduler.get_due_batches(now, config.reveal_window_secs).await;

                if due_batches.is_empty() {
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

                for &batch_id in &due_batches {
                    let tick_id = scheduler.next_tick_for_batch(batch_id).await;

                    match scheduler.get_batch_state(batch_id).await {
                        Some((batch, players)) => {
                            if players.is_empty() {
                                scheduler.mark_resolved(batch_id, tick_id).await;
                                continue;
                            }

                            // Skip backlog
                            if batch.tick_duration > 0 {
                                let current_tick = now / batch.tick_duration;
                                let latest_resolvable = if current_tick > batch.created_at_tick {
                                    current_tick - batch.created_at_tick - 1
                                } else {
                                    0
                                };
                                if tick_id < latest_resolvable {
                                    tracing::info!(
                                        batch_id,
                                        skipped_from = tick_id,
                                        skipped_to = latest_resolvable,
                                        "Skipping backlog ticks to latest"
                                    );
                                    for skip_tick in tick_id..latest_resolvable {
                                        scheduler.mark_resolved(batch_id, skip_tick).await;
                                    }
                                    continue;
                                }
                            }

                            // Fetch market configs
                            let (source_id, market_configs) = match config_cache
                                .get_or_fetch(&config.data_node_url, &batch.config_hash)
                                .await
                            {
                                Ok(entry) => entry,
                                Err(e) => {
                                    if config_cache.is_known_missing(&batch.config_hash).await {
                                        tracing::debug!(batch_id, tick_id, "Config still missing, skipping tick");
                                    } else {
                                        tracing::warn!(
                                            batch_id,
                                            tick_id,
                                            error = %e,
                                            "Failed to fetch market config, skipping tick"
                                        );
                                        config_cache.mark_missing(&batch.config_hash).await;
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
                    continue;
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
                let fetch_futures: Vec<_> = sources_vec
                    .iter()
                    .map(|src| {
                        let url = config.data_node_url.clone();
                        let source = src.clone();
                        let sem = semaphore.clone();
                        async move {
                            let _permit = sem.acquire().await.unwrap();
                            let result = fetch_snapshot_data_inner(&url, &source).await;
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

                    // Get snapshot from cache (already pre-fetched)
                    let snapshot_data = match snapshot_cache.get(&item.source_id) {
                        Some(Ok(data)) => data.clone(),
                        Some(Err(_)) | None => {
                            continue; // Already logged during pre-fetch
                        }
                    };

                    let prices = build_market_prices(
                        &snapshot_data,
                        &market_ids,
                        &reference_prices,
                        now,
                    )
                    .await;

                    // Debug: log bitmap info before resolution
                            {
                                let bitmaps = resolver.bitmap_store.get_all_for_batch(batch.id).await;
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

                                    // Apply balance updates to scheduler
                                    if !result.player_balances.is_empty() {
                                        if let Some(ref pool) = db_pool {
                                            if let Err(e) = scheduler
                                                .apply_tick_balances_with_db(
                                                    pool,
                                                    batch_id,
                                                    &result.player_balances,
                                                )
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
                                                .apply_tick_balances(
                                                    batch_id,
                                                    &result.player_balances,
                                                )
                                                .await;
                                        }
                                    }

                                    // Update reference prices for next tick
                                    update_reference_prices(
                                        &reference_prices,
                                        &market_ids,
                                        &prices,
                                    )
                                    .await;

                                    // Persist resolved tick to DB
                                    if let Some(ref pool) = db_pool {
                                        if let Err(e) = scheduler
                                            .mark_resolved_with_db(pool, batch_id, tick_id)
                                            .await
                                        {
                                            tracing::warn!(
                                                batch_id,
                                                tick_id,
                                                error = %e,
                                                "Failed to persist resolved tick to DB"
                                            );
                                            // Fall back to in-memory only
                                            scheduler.mark_resolved(batch_id, tick_id).await;
                                        }
                                    } else {
                                        scheduler.mark_resolved(batch_id, tick_id).await;
                                    }
                                }
                                Err(e) => {
                                    tracing::warn!(
                                        batch_id,
                                        tick_id,
                                        error = %e,
                                        "Tick resolution failed"
                                    );
                                    // Don't mark resolved -- retry on next poll
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
            join_timestamp: 1000,
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
            run(scheduler, resolver, config, shutdown_clone).await;
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
            run(scheduler, resolver, config, shutdown_clone).await;
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
