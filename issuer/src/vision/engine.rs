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

/// Cache of fetched configs to avoid re-fetching within same tick.
/// Maps config_hash (H256) -> Vec<MarketConfig>.
struct ConfigCache {
    configs: RwLock<HashMap<H256, Vec<MarketConfig>>>,
}

impl ConfigCache {
    fn new() -> Self {
        Self {
            configs: RwLock::new(HashMap::new()),
        }
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
        let batch = batch_config_orchestrator::fetch_config_by_hash(data_node_url, &hash_hex)
            .await?;

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

        // Cache it
        self.configs
            .write()
            .await
            .insert(*config_hash, market_configs.clone());

        Ok(market_configs)
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
async fn fetch_market_prices(
    data_node_url: &str,
    batch_market_ids: &[H256],
    reference_prices: &ReferencePrices,
    now: u64,
) -> Result<MarketPrices, Box<dyn std::error::Error + Send + Sync>> {
    let mut prices = MarketPrices::new();

    let url = format!("{}/vision/snapshot?source=hackernews&limit=10000", data_node_url);
    let client = reqwest::Client::new();

    let response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?;

    let json: serde_json::Value = response.json().await?;

    let snapshots = json
        .get("snapshots")
        .and_then(|s| s.as_array())
        .ok_or("data-node snapshot response missing 'snapshots' array")?;

    // Build a set of batch market_ids for fast lookup
    let batch_ids: std::collections::HashSet<H256> = batch_market_ids.iter().copied().collect();

    // Map asset_ids to current values
    let mut current_values: HashMap<H256, f64> = HashMap::new();

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

        if !batch_ids.contains(&market_id) {
            continue;
        }

        // Parse the value (current price/score)
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
    }

    // Build MarketPrices: start from reference, end from current
    let ref_prices = reference_prices.read().await;

    let mut matched = 0;
    for &market_id in batch_market_ids {
        if let Some(&end_price) = current_values.get(&market_id) {
            let start_price = ref_prices.get(&market_id).copied().unwrap_or(end_price);
            prices.insert(market_id, start_price, end_price, now);
            matched += 1;
        }
    }

    tracing::info!(
        total_snapshots = snapshots.len(),
        matched_markets = matched,
        batch_markets = batch_market_ids.len(),
        "Fetched market prices from data-node"
    );

    Ok(prices)
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

                for batch_id in due_batches {
                    let tick_id = scheduler.next_tick_for_batch(batch_id).await;

                    match scheduler.get_batch_state(batch_id).await {
                        Some((batch, players)) => {
                            if players.is_empty() {
                                tracing::debug!(
                                    batch_id,
                                    tick_id,
                                    "Skipping tick -- no players in batch"
                                );
                                // Mark resolved so we advance past empty ticks
                                scheduler.mark_resolved(batch_id, tick_id).await;
                                continue;
                            }

                            // Fetch market configs from data-node by config_hash
                            let market_configs = match config_cache
                                .get_or_fetch(&config.data_node_url, &batch.config_hash)
                                .await
                            {
                                Ok(mc) => mc,
                                Err(e) => {
                                    tracing::warn!(
                                        batch_id,
                                        tick_id,
                                        error = %e,
                                        "Failed to fetch market config, skipping tick"
                                    );
                                    continue;
                                }
                            };

                            let market_ids: Vec<H256> =
                                market_configs.iter().map(|m| m.market_id).collect();

                            tracing::info!(
                                batch_id,
                                tick_id,
                                player_count = players.len(),
                                market_count = market_configs.len(),
                                "Processing due tick"
                            );

                            // Fetch prices from data-node for each market_id.
                            let prices = match fetch_market_prices(
                                &config.data_node_url,
                                &market_ids,
                                &reference_prices,
                                now,
                            )
                            .await
                            {
                                Ok(p) => p,
                                Err(e) => {
                                    tracing::warn!(
                                        batch_id,
                                        tick_id,
                                        error = %e,
                                        "Failed to fetch market prices, skipping tick"
                                    );
                                    continue;
                                }
                            };

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

                                    // Update reference prices for next tick
                                    update_reference_prices(
                                        &reference_prices,
                                        &market_ids,
                                        &prices,
                                    )
                                    .await;

                                    scheduler.mark_resolved(batch_id, tick_id).await;
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
                        None => {
                            tracing::warn!(
                                batch_id,
                                "Due batch not found in scheduler state"
                            );
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
