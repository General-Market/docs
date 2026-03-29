//! BatchLifecycleManager — round-based batch engine.
//!
//! Runs alongside the tick engine. Sources listed in `round_based_sources`
//! are owned by this manager; the tick engine skips them.
//!
//! Each heartbeat per source:
//!   1. Resolve previous batch (snapshot + resolver + settlement)
//!   2. Create new batch (fetch fresh config from data-node)
//!   3. Record lifecycle in Postgres
//!   4. Rotate: previous = current, current = new

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::traits::BLSSigner;
use common::types::P2PMessage;
use common::BLSSignature;
use dashmap::DashMap;
use ethers::abi::{encode, Token};
use ethers::types::{Address, H256, U256};
use ethers::utils::keccak256;
use sqlx::PgPool;
use tokio::sync::{mpsc, Semaphore};
use tokio::task::JoinSet;
use tracing::{info, warn, error, debug};

use crate::chain::EthersChainWriter;
use common::traits::ChainWriter;
use crate::consensus::aggregator::compute_threshold;
use super::batch_config_orchestrator;
use super::bitmap_store::BitmapStore;
use super::config::VisionConfig;
use super::resolver::{MarketPrices, TickResolver};
use super::settlement::compute_settlement;
use super::tick_scheduler::TickScheduler;
use super::types::{MarketConfig, RoundSettlement};

/// Incoming co-sign message from a follower oracle for a pending createBatch proposal.
///
/// Protocol.rs routes these to the correct per-source channel via CosignRouter.
pub struct IncomingCreateBatchSign {
    pub signer_index: u8,
    pub source_id: H256,
    pub message_hash: H256,
    pub signature: BLSSignature,
}

/// Per-source routing map for co-sign messages.
///
/// DashMap for lock-free concurrent dispatch. Each source registers a sender
/// when it starts collecting co-signs and removes it when done. Protocol.rs
/// looks up the source_id to route co-signs to the correct receiver —
/// no cross-source theft, no write-lock contention between sources.
pub type CosignRouter = Arc<DashMap<H256, mpsc::Sender<IncomingCreateBatchSign>>>;

/// How long the leader waits for follower co-signs per attempt (seconds).
/// Short timeout + retry is better than one long timeout — keeps the pipeline moving.
const CREATE_BATCH_COSIGN_TIMEOUT_SECS: u64 = 30;

/// Stagger interval between sources to avoid thundering herd.
const SOURCE_STAGGER_SECS: u64 = 2;

/// Delay between betting close and settlement (seconds).
/// Gives players time to verify outcomes before payouts execute.
const SETTLEMENT_DELAY_SECS: i64 = 600; // 10 minutes

/// Per-source tracking state for round rotation.
struct SourceState {
    /// Human-readable source name (e.g. "crypto", "sports").
    source_name: String,
    /// keccak256(source_name) — matches on-chain source_id.
    source_id: H256,
    /// Tick duration for this source (seconds), fetched from recommended config.
    tick_duration_secs: u64,
    /// Currently active batch ID (players are betting on this one).
    current_batch_id: Option<u64>,
    /// Previous batch ID (being resolved / settled).
    previous_batch_id: Option<u64>,
    /// Last time this source's heartbeat fired.
    last_heartbeat: std::time::Instant,
    /// Stagger offset so sources don't all fire simultaneously.
    stagger_offset: std::time::Duration,
}

/// Manages the lifecycle of round-based prediction market batches.
///
/// Each source gets its own heartbeat on a `tick_duration` interval.
/// The manager creates batches, resolves them, computes settlement,
/// and records everything in Postgres.
pub struct BatchLifecycleManager {
    config: VisionConfig,
    scheduler: Arc<TickScheduler>,
    resolver: Arc<TickResolver>,
    bitmap_store: Arc<BitmapStore>,
    pool: PgPool,
    shutdown: Arc<AtomicBool>,
    /// L3 chain writer for submitting createBatch / settleBatch transactions.
    /// None in mock/read-only mode (follower oracles still detect batches via chain events).
    chain_writer: Option<Arc<EthersChainWriter>>,
    /// BLS keypair for signing settlement proofs. None if BLS is not configured.
    bls_keypair: Option<Arc<BLSKeyPair>>,
    /// P2P broadcast channel — used by the leader to broadcast VisionCreateBatchProposal.
    broadcast_tx: Option<mpsc::Sender<P2PMessage>>,
    /// Per-source co-sign router — protocol.rs routes VisionCreateBatchSign messages
    /// to the correct source's channel. Each source registers/deregisters on demand.
    cosign_router: CosignRouter,
    /// This oracle's P2P peer id (32-byte public key hash). Used as leader_id in proposals.
    peer_id: [u8; 32],
}

impl BatchLifecycleManager {
    pub fn new(
        config: VisionConfig,
        scheduler: Arc<TickScheduler>,
        resolver: Arc<TickResolver>,
        bitmap_store: Arc<BitmapStore>,
        pool: PgPool,
        shutdown: Arc<AtomicBool>,
        chain_writer: Option<Arc<EthersChainWriter>>,
        bls_keypair: Option<Arc<BLSKeyPair>>,
        broadcast_tx: Option<mpsc::Sender<P2PMessage>>,
        cosign_router: CosignRouter,
        peer_id: [u8; 32],
    ) -> Self {
        Self {
            config,
            scheduler,
            resolver,
            bitmap_store,
            pool,
            shutdown,
            chain_writer,
            bls_keypair,
            broadcast_tx,
            cosign_router,
            peer_id,
        }
    }

    /// Main loop. Runs until shutdown signal.
    ///
    /// Sources are processed concurrently (up to 10 at a time) instead of
    /// sequentially. With 58 sources and large-market batches, the sequential
    /// loop took hours. Each source's resolve+create now runs in its own
    /// spawned task, gated by a semaphore.
    pub async fn run(self: Arc<Self>) {
        // Discover sources from data-node recommended batches (all sources are round-based)
        let source_names: Vec<String> = match batch_config_orchestrator::fetch_recommended(&self.config.data_node_url).await {
            Ok(batches) => {
                let mut names: Vec<String> = batches.iter().map(|b| b.source_id.clone()).collect();
                names.sort();
                names.dedup();
                names
            }
            Err(e) => {
                warn!(error = %e, "Failed to fetch sources from data-node — lifecycle manager cannot start");
                return;
            }
        };

        if source_names.is_empty() {
            info!("BatchLifecycleManager: no sources found from data-node, exiting");
            return;
        }

        // Build per-source state, each wrapped in Arc<Mutex> for independent mutation
        let sources: Vec<Arc<tokio::sync::Mutex<SourceState>>> = source_names
            .iter()
            .enumerate()
            .map(|(i, name)| {
                let batch_version = std::env::var("BATCH_VERSION").unwrap_or_else(|_| "v2".to_string());
                let versioned = format!("{}_{}", name, batch_version);
                let source_id = H256::from(keccak256(versioned.as_bytes()));
                Arc::new(tokio::sync::Mutex::new(SourceState {
                    source_name: name.clone(),
                    source_id,
                    tick_duration_secs: 0, // populated on first config fetch
                    current_batch_id: None,
                    previous_batch_id: None,
                    last_heartbeat: std::time::Instant::now(),
                    stagger_offset: std::time::Duration::from_secs(
                        SOURCE_STAGGER_SECS * i as u64,
                    ),
                }))
            })
            .collect();

        info!(
            source_count = source_names.len(),
            "BatchLifecycleManager starting — all sources are round-based (concurrent)"
        );

        // Fetch initial tick durations from data-node recommended configs
        if let Err(e) = self.populate_tick_durations(&sources).await {
            warn!(error = %e, "Failed to fetch initial tick durations — will retry");
        }

        // Semaphore: limit concurrent source processing to avoid thundering herd.
        // Per-source co-sign channels eliminate cross-source message theft,
        // so concurrency > 1 is safe.
        const MAX_CONCURRENT_SOURCES: usize = 10;
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_SOURCES));

        // Poll interval: 1 second (fine-grained enough to respect stagger offsets)
        let poll_interval = tokio::time::Duration::from_secs(1);
        let mut interval = tokio::time::interval(poll_interval);

        while !self.shutdown.load(Ordering::Relaxed) {
            interval.tick().await;

            let now_instant = std::time::Instant::now();
            let mut join_set: JoinSet<()> = JoinSet::new();

            // Only the leader (node_index == 0) drives the lifecycle.
            // Followers stay in this loop solely to keep the P2P heartbeat alive
            // and respond to co-sign requests via the channel listener.
            if self.config.node_index != 0 {
                continue;
            }

            for source_lock in &sources {
                // Quick check under lock: is this source due?
                let due_info = {
                    let mut source = source_lock.lock().await;

                    if source.tick_duration_secs == 0 {
                        None
                    } else {
                        let elapsed = now_instant.duration_since(source.last_heartbeat);
                        let required = std::time::Duration::from_secs(source.tick_duration_secs)
                            + source.stagger_offset;

                        if elapsed < required {
                            None
                        } else {
                            // Mark heartbeat now so the next poll won't re-fire
                            source.last_heartbeat = now_instant;
                            source.stagger_offset = std::time::Duration::ZERO;
                            Some((source.source_name.clone(), source.source_id))
                        }
                    }
                };

                let (source_name, source_id) = match due_info {
                    Some(info) => info,
                    None => continue,
                };

                // Spawn a task for this source's heartbeat
                let mgr = Arc::clone(&self);
                let sem = Arc::clone(&semaphore);
                let src_lock = Arc::clone(source_lock);

                join_set.spawn(async move {
                    // Acquire semaphore permit — blocks if MAX_CONCURRENT_SOURCES active
                    let _permit = match sem.acquire().await {
                        Ok(p) => p,
                        Err(_) => return, // semaphore closed
                    };

                    // Read state snapshot
                    let prev_batch_id = {
                        let source = src_lock.lock().await;
                        info!(
                            source = %source.source_name,
                            tick_duration = source.tick_duration_secs,
                            current_batch = ?source.current_batch_id,
                            previous_batch = ?source.previous_batch_id,
                            "Lifecycle heartbeat"
                        );
                        source.previous_batch_id
                    };

                    // Step 1: Resolve previous batch if its betting period has ended.
                    // With PRE_CREATE overlap the heartbeat fires 30s early, so the
                    // batch rotated into `previous` during the CURRENT heartbeat still
                    // has betting time left. The one already in `previous` from the
                    // PREVIOUS heartbeat is always safe — but we guard anyway for
                    // edge cases (oracle restart, delayed heartbeats).
                    if let Some(prev_id) = prev_batch_id {
                        let ready_to_settle: bool = sqlx::query_scalar::<_, bool>(
                            "SELECT betting_end + make_interval(secs => $2) <= NOW() FROM vision_batch_lifecycle WHERE on_chain_batch_id = $1"
                        )
                        .bind(prev_id as i64)
                        .bind(SETTLEMENT_DELAY_SECS as f64)
                        .fetch_optional(&mgr.pool)
                        .await
                        .ok()
                        .flatten()
                        .unwrap_or(true); // no lifecycle row → treat as ended (chain-discovered batch)

                        if !ready_to_settle {
                            info!(
                                source = %source_name,
                                batch_id = prev_id,
                                "Previous batch in settlement delay window — deferring resolution"
                            );
                            // Don't clear previous_batch_id — will retry next heartbeat
                        } else {
                        match mgr.resolve_and_settle(prev_id, &source_name).await {
                            Ok(settlement) => {
                                info!(
                                    source = %source_name,
                                    batch_id = prev_id,
                                    players = settlement.players.len(),
                                    total_markets = settlement.total_markets,
                                    "Round settled"
                                );
                                if let Err(e) = mgr.record_settlement(&settlement).await {
                                    error!(batch_id = prev_id, error = %e, "Failed to record settlement in DB");
                                }
                                let bls_ok = match mgr.sign_and_aggregate_settlement(&settlement).await {
                                    Ok(()) => true,
                                    Err(e) => {
                                        error!(batch_id = prev_id, error = %e, "Settlement BLS signing/submission failed — retry sweep will recover");
                                        false
                                    }
                                };
                                // Only mark settled + purge bitmaps if on-chain submission succeeded.
                                // Failed submissions are recovered by the retry sweep — the proof row
                                // (submitted=false) persists in vision_settlement_proofs with the full payload.
                                if bls_ok {
                                    if let Err(e) = mgr.scheduler.mark_settled(&mgr.pool, prev_id).await {
                                        error!(batch_id = prev_id, error = %e, "mark_settled failed");
                                    }
                                    if let Err(e) = mgr.bitmap_store.purge_batch_from_db(&mgr.pool, prev_id).await {
                                        error!(batch_id = prev_id, error = %e, "purge_batch_from_db failed");
                                    }
                                }
                            }
                            Err(e) => {
                                warn!(source = %source_name, batch_id = prev_id, error = %e, "Failed to resolve previous round");
                            }
                        }
                        // Always clear previous_batch_id to unblock rotation.
                        // Failed settlements are retried by the periodic sweep, not the heartbeat.
                        src_lock.lock().await.previous_batch_id = None;
                        } // else ready_to_settle
                    }

                    // Step 2: Rotate current → previous (only if previous slot is free)
                    {
                        let mut source = src_lock.lock().await;
                        if source.previous_batch_id.is_none() {
                            source.previous_batch_id = source.current_batch_id.take();
                        } else {
                            // Previous batch still pending resolution (deferred above).
                            // Skip rotation — current stays current for one more cycle.
                            debug!(
                                source = %source.source_name,
                                previous = ?source.previous_batch_id,
                                current = ?source.current_batch_id,
                                "Skipping rotation — previous batch still pending resolution"
                            );
                        }
                    }

                    // Step 3: Create new batch (only if rotation happened — current slot is empty)
                    let should_create = src_lock.lock().await.current_batch_id.is_none();
                    if !should_create {
                        debug!(source = %source_name, "Skipping batch creation — current batch still active");
                    } else {
                    match mgr.create_new_round(&source_name).await {
                        Ok(lifecycle_id) => {
                            let on_chain_id = mgr.poll_for_on_chain_batch(
                                source_id,
                                &source_name,
                            ).await;

                            match on_chain_id {
                                Some(id) => {
                                    info!(
                                        source = %source_name,
                                        lifecycle_id,
                                        on_chain_batch_id = id,
                                        "New round created — on-chain batch resolved"
                                    );
                                    src_lock.lock().await.current_batch_id = Some(id);
                                }
                                None => {
                                    warn!(
                                        source = %source_name,
                                        lifecycle_id,
                                        "New round created but on-chain batch not yet visible in scheduler — will resolve next heartbeat"
                                    );
                                }
                            }
                        }
                        Err(e) => {
                            warn!(source = %source_name, error = %e, "Failed to create new round — will retry next heartbeat");
                        }
                    }
                    } // if should_create
                });
            }

            // Await all spawned source tasks before next poll
            while let Some(result) = join_set.join_next().await {
                if let Err(e) = result {
                    error!(error = %e, "Source lifecycle task panicked");
                }
            }
        }

        info!("BatchLifecycleManager shutting down");
    }

    /// Fetch recommended configs from data-node to populate tick durations.
    async fn populate_tick_durations(
        &self,
        sources: &[Arc<tokio::sync::Mutex<SourceState>>],
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let recommended =
            batch_config_orchestrator::fetch_recommended(&self.config.data_node_url).await?;

        for source_lock in sources {
            let mut source = source_lock.lock().await;
            // Match by source name (data-node uses raw names, not hashes)
            if let Some(batch) = recommended.iter().find(|b| b.source_id == source.source_name) {
                source.tick_duration_secs = batch.tick_duration_secs;
                info!(
                    source = %source.source_name,
                    tick_duration = batch.tick_duration_secs,
                    markets = batch.markets.len(),
                    "Populated tick duration from recommended config"
                );
            } else {
                warn!(
                    source = %source.source_name,
                    "No recommended config found — source will remain dormant"
                );
            }
        }

        Ok(())
    }

    /// Poll the scheduler for the on-chain batch ID matching a source.
    ///
    /// After `create_new_round` submits the `createBatch` TX, the chain listener
    /// processes the `BatchCreated` event and calls `scheduler.on_batch_created`.
    /// This may take a few seconds. We poll up to 10s with 500ms intervals.
    async fn poll_for_on_chain_batch(
        &self,
        source_id: H256,
        source_name: &str,
    ) -> Option<u64> {
        const POLL_INTERVAL_MS: u64 = 500;
        const MAX_POLLS: u64 = 20; // 10 seconds total

        // Snapshot existing batches for this source *before* polling,
        // so we can detect the newly added one.
        let existing_max = self.scheduler.find_latest_batch_for_source(source_id).await;

        for attempt in 0..MAX_POLLS {
            if attempt > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(POLL_INTERVAL_MS)).await;
            }

            if let Some(latest) = self.scheduler.find_latest_batch_for_source(source_id).await {
                // Accept if there was no previous batch, or if a new (higher) one appeared
                if existing_max.is_none() || latest > existing_max.unwrap() {
                    debug!(
                        source = %source_name,
                        on_chain_batch_id = latest,
                        poll_attempt = attempt,
                        "On-chain batch detected in scheduler"
                    );
                    return Some(latest);
                }
            }
        }

        warn!(
            source = %source_name,
            "On-chain batch not found in scheduler after polling"
        );
        None
    }

    /// Resolve a completed round: fetch snapshot, run resolver, compute settlement.
    async fn resolve_and_settle(
        &self,
        batch_id: u64,
        source_name: &str,
    ) -> Result<RoundSettlement, Box<dyn std::error::Error + Send + Sync>> {
        // Get batch state from scheduler
        let (batch, players) = self
            .scheduler
            .get_batch_state(batch_id)
            .await
            .ok_or_else(|| format!("batch {} not found in scheduler", batch_id))?;

        if players.is_empty() {
            return Ok(RoundSettlement {
                batch_id,
                players: vec![],
                payouts: vec![],
                deposits: vec![],
                correct_counts: vec![],
                total_markets: 0,
            });
        }

        // Fetch market config by the batch's PINNED config hash — not the current
        // recommended config. The recommended config drifts as assets become
        // healthy/unhealthy between batch creation and resolution. Players built
        // their bitmaps against the creation-time config; resolving against a
        // different config produces bitmap length mismatches and lost stakes.
        let config_hash_hex = format!("{:?}", batch.config_hash);
        let rec_batch = match batch_config_orchestrator::fetch_config_by_hash(
            &self.config.data_node_url,
            &config_hash_hex,
        )
        .await
        {
            Ok(cfg) => cfg,
            Err(e) => {
                // Fallback: if the pinned config is no longer in data-node (purged),
                // use current recommended. This is the old behavior — imperfect but
                // better than failing the entire settlement.
                warn!(
                    batch_id,
                    config_hash = %config_hash_hex,
                    error = %e,
                    "Pinned config not found — falling back to current recommended (bitmap length mismatch possible)"
                );
                let recommended =
                    batch_config_orchestrator::fetch_recommended(&self.config.data_node_url).await?;
                recommended
                    .into_iter()
                    .find(|b| b.source_id == source_name)
                    .ok_or_else(|| format!("no recommended config for source {}", source_name))?
            }
        };

        let market_configs: Vec<MarketConfig> = rec_batch
            .markets
            .iter()
            .map(|m| MarketConfig {
                asset_id: m.asset_id.clone(),
                market_id: H256::from(keccak256(m.asset_id.as_bytes())),
                resolution_type: parse_resolution_type(&m.resolution_type),
                threshold_bps: m.threshold_bps,
            })
            .collect();

        // Fetch snapshot prices from data-node — targeted endpoint returns only
        // the assets we need, avoiding the 33k+ row firehose for large sources.
        let asset_ids: Vec<String> = market_configs.iter().map(|m| m.asset_id.clone()).collect();
        let targeted_url = format!(
            "{}/vision/snapshot/targeted",
            self.config.data_node_url
        );
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .gzip(true)
            .build()?;
        let json: serde_json::Value = client
            .post(&targeted_url)
            .json(&serde_json::json!({
                "source": source_name,
                "asset_ids": asset_ids,
            }))
            .send()
            .await?
            .json()
            .await?;

        let snapshots = json
            .get("snapshots")
            .and_then(|s| s.as_array())
            .ok_or("missing 'snapshots' array in data-node response")?;

        // Load start prices saved at round creation (keyed by on-chain batch ID)
        let start_prices_json: Option<serde_json::Value> = sqlx::query_scalar(
            "SELECT start_prices FROM vision_batch_lifecycle WHERE on_chain_batch_id = $1"
        )
        .bind(batch_id as i64)
        .fetch_optional(&self.pool)
        .await
        .ok()
        .flatten();

        let start_price_map: std::collections::HashMap<String, i128> =
            start_prices_json
                .as_ref()
                .and_then(|v| v.as_object())
                .map(|obj| {
                    obj.iter()
                        .filter_map(|(k, v)| {
                            let val = v.as_str().and_then(|s| s.parse::<i128>().ok())
                                .or_else(|| v.as_f64().map(|f| (f * 1e8).round() as i128));
                            val.map(|v| (k.clone(), v))
                        })
                        .collect()
                })
                .unwrap_or_default();

        let has_start_prices = !start_price_map.is_empty();
        if !has_start_prices {
            warn!(batch_id, source = %source_name, "No start prices saved — falling back to change_pct derivation");
        }

        // Build MarketPrices from snapshot (end prices) + stored start prices
        let mut prices = MarketPrices::new();
        let now_secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        for snap in snapshots {
            let asset_id = snap
                .get("asset_id")
                .or_else(|| snap.get("assetId"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if asset_id.is_empty() {
                continue;
            }

            let market_id = H256::from(keccak256(asset_id.as_bytes()));

            // Parse end price (current value)
            let end_price: i128 =
                if let Some(scaled) = snap.get("valueScaled").or_else(|| snap.get("value_scaled")).and_then(|v| v.as_str()) {
                    match scaled.parse::<i128>() {
                        Ok(v) => v,
                        Err(_) => continue,
                    }
                } else if let Some(f) = snap.get("value").and_then(|v| v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse::<f64>().ok()))) {
                    (f * 1e8).round() as i128
                } else {
                    continue;
                };

            if end_price == 0 {
                continue;
            }

            // Start price: prefer stored snapshot, fall back to change_pct derivation.
            // If start_prices exist but this specific asset is missing, use change_pct
            // derivation instead of end_price (which would produce a false 0% = draw).
            let stored_start = if has_start_prices {
                start_price_map.get(asset_id)
                    .copied()
                    .and_then(|sp| if sp != 0 { Some(sp) } else { None })
            } else {
                None
            };
            let start_price = if let Some(sp) = stored_start {
                sp
            } else {
                // Derive from change_pct (works for both legacy batches and missing entries)
                let change_pct = snap
                    .get("change_pct")
                    .or_else(|| snap.get("changePct"))
                    .and_then(|v| v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse::<f64>().ok())))
                    .unwrap_or(0.0);
                if change_pct.abs() > 1e-10 {
                    let factor = 1.0 + (change_pct / 100.0);
                    ((end_price as f64) / factor).round() as i128
                } else {
                    end_price
                }
            };

            let fetched_at = snap
                .get("fetched_at")
                .or_else(|| snap.get("fetchedAt"))
                .and_then(|v| {
                    if let Some(ts) = v.as_i64() {
                        Some(ts as u64)
                    } else if let Some(s) = v.as_str() {
                        chrono::DateTime::parse_from_rfc3339(s)
                            .ok()
                            .map(|dt| dt.timestamp() as u64)
                    } else {
                        None
                    }
                })
                .unwrap_or(now_secs);

            prices.insert(market_id, start_price, end_price, fetched_at);
        }

        // Flip bitmaps (pending → active) so resolver picks up latest predictions
        self.bitmap_store.flip(batch_id).await;

        // Run tick resolver (tick_id = 0 for single-round batches)
        let tick_result = self
            .resolver
            .resolve_tick(&batch, 0, &players, &prices, now_secs, &market_configs)
            .await
            .map_err(|e| format!("resolver error: {}", e))?;

        // Compute parimutuel settlement
        let player_deposits: Vec<_> = players
            .iter()
            .map(|p| (p.player, p.initial_deposit))
            .collect();
        let settlement = compute_settlement(&tick_result, &player_deposits);

        Ok(settlement)
    }

    /// Create a new round batch for a source.
    ///
    /// Leader oracle (node_index == 0) broadcasts a `VisionCreateBatchProposal` to all peers,
    /// collects co-signs until BLS threshold is met (ceil(2n/3)), aggregates the signatures,
    /// then submits `createBatch` on-chain.
    ///
    /// Follower oracles receive the proposal, verify the BLS message hash by recomputing it,
    /// sign, and reply with `VisionCreateBatchSign`. They detect the resulting on-chain
    /// `BatchCreated` event and register the batch in their scheduler automatically.
    ///
    /// Returns the lifecycle DB id on success. The on-chain batch_id arrives
    /// asynchronously through the chain listener.
    async fn create_new_round(
        &self,
        source_name: &str,
    ) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
        // Fetch fresh config from data-node
        let recommended =
            batch_config_orchestrator::fetch_recommended(&self.config.data_node_url).await?;
        let rec_batch = recommended
            .iter()
            .find(|b| b.source_id == source_name)
            .ok_or_else(|| format!("no recommended config for source {}", source_name))?;

        let config_hash_str = &rec_batch.config_hash;
        let tick_duration = rec_batch.tick_duration_secs;
        let lock_offset = rec_batch.lock_offset_secs;
        let market_count = rec_batch.markets.len();

        info!(
            source = %source_name,
            config_hash = %config_hash_str,
            tick_duration,
            lock_offset,
            markets = market_count,
            "Fetched fresh config for new round"
        );

        // Record intent in Postgres (all oracles do this for local tracking)
        let lifecycle_id = self.record_round_lifecycle(source_name, config_hash_str, tick_duration, market_count).await?;

        // Save start price snapshot — fetched NOW so we have real start prices
        // for comparison at resolution time (instead of reverse-engineering from change_pct).
        let asset_ids: Vec<String> = rec_batch.markets.iter().map(|m| m.asset_id.clone()).collect();
        if let Err(e) = self.save_start_prices(lifecycle_id, source_name, &asset_ids).await {
            warn!(source = %source_name, error = %e, "Failed to save start price snapshot (non-fatal)");
        }

        // Only leader submits on-chain. Followers detect via BatchCreated events.
        let is_leader = self.config.node_index == 0;

        if is_leader {
            if let Some(ref writer) = self.chain_writer {
                // sourceId on-chain is keccak256(name + "_" + version), e.g. keccak256("defi_v2")
                let batch_version = std::env::var("BATCH_VERSION").unwrap_or_else(|_| "v2".to_string());
                let versioned_name = format!("{}_{}", source_name, batch_version);
                let source_id = H256::from(keccak256(versioned_name.as_bytes()));

                // Parse config hash from hex string
                let config_hash: H256 = config_hash_str
                    .parse()
                    .unwrap_or_else(|_| H256::from(keccak256(config_hash_str.as_bytes())));

                // Compute BLS message: keccak256(abi.encode(chainid, vision_address, "CREATE_BATCH", sourceId, configHash, tickDuration, lockOffset))
                let vision_address: Address = self.config.vision_address
                    .parse()
                    .unwrap_or_default();

                let bls_message = keccak256(encode(&[
                    Token::Uint(U256::from(self.config.chain_id)),
                    Token::Address(vision_address),
                    Token::String("CREATE_BATCH".to_string()),
                    Token::FixedBytes(source_id.as_bytes().to_vec()),
                    Token::FixedBytes(config_hash.as_bytes().to_vec()),
                    Token::Uint(U256::from(tick_duration)),
                    Token::Uint(U256::from(lock_offset)),
                ]));
                let message_hash = H256::from(bls_message);

                // BLS sign the createBatch message with our own key
                let leader_sig = if let Some(ref kp) = self.bls_keypair {
                    let signer = Bn254BLSSigner::new();
                    match signer.sign_message_hash(kp, &bls_message) {
                        Ok(sig) => BLSSignature(sig.0),
                        Err(e) => {
                            warn!(source = %source_name, error = %e, "BLS signing failed for createBatch");
                            return Err(e.into());
                        }
                    }
                } else {
                    warn!(source = %source_name, "No BLS keypair — cannot sign createBatch");
                    return Err("No BLS keypair".into());
                };

                // Read lastSnapshotNonce from OracleRegistry
                let ref_nonce = self.read_last_snapshot_nonce().await.unwrap_or(0);
                info!(source = %source_name, ref_nonce, "Read snapshot nonce for createBatch");

                let node_index = self.config.node_index;
                let num_oracles = self.config.num_oracles;
                let threshold = compute_threshold(num_oracles);

                info!(
                    source = %source_name,
                    ?source_id,
                    ?config_hash,
                    tick_duration,
                    lock_offset,
                    ?message_hash,
                    node_index,
                    num_oracles,
                    threshold,
                    "Leader proposing createBatch — broadcasting for co-signs"
                );

                // Collect all signatures: leader starts, followers co-sign via P2P.
                // Each entry: (signer_index, BLSSignature)
                let mut collected_sigs: Vec<(u8, BLSSignature)> = vec![(node_index, BLSSignature(leader_sig.0.clone()))];
                let mut signer_bits = 1u64 << node_index;

                if num_oracles > 1 {
                    if let Some(ref broadcast_tx) = self.broadcast_tx {
                        // Register a per-source channel BEFORE broadcasting the proposal
                        let (sign_tx, mut sign_rx) = mpsc::channel::<IncomingCreateBatchSign>(8);
                        self.cosign_router.insert(source_id, sign_tx);

                        let proposal = P2PMessage::VisionCreateBatchProposal {
                            leader_id: self.peer_id,
                            source_name: source_name.to_string(),
                            source_id,
                            config_hash,
                            tick_duration,
                            lock_offset,
                            message_hash,
                            leader_signature: common::types::BLSSignature(leader_sig.0.clone()),
                            reference_nonce: ref_nonce,
                        };

                        if let Err(e) = broadcast_tx.send(proposal).await {
                            warn!(source = %source_name, error = %e, "Failed to broadcast VisionCreateBatchProposal");
                        }

                        // Collect co-signs from this source's dedicated channel
                        let deadline = tokio::time::Instant::now()
                            + std::time::Duration::from_secs(CREATE_BATCH_COSIGN_TIMEOUT_SECS);

                        loop {
                            if collected_sigs.len() >= threshold {
                                info!(source = %source_name, sigs = collected_sigs.len(), threshold, "BLS threshold met");
                                break;
                            }

                            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
                            if remaining.is_zero() {
                                warn!(
                                    source = %source_name,
                                    sigs = collected_sigs.len(),
                                    threshold,
                                    "createBatch co-sign timeout"
                                );
                                break;
                            }

                            match tokio::time::timeout(remaining, sign_rx.recv()).await {
                                Ok(Some(cosign)) => {
                                    if cosign.message_hash != message_hash {
                                        debug!(source = %source_name, "Ignoring co-sign for different message hash");
                                        continue;
                                    }
                                    if collected_sigs.iter().any(|(idx, _)| *idx == cosign.signer_index) {
                                        debug!(source = %source_name, signer_index = cosign.signer_index, "Duplicate co-sign ignored");
                                        continue;
                                    }
                                    debug!(source = %source_name, signer_index = cosign.signer_index, "Co-sign received");
                                    signer_bits |= 1u64 << cosign.signer_index;
                                    collected_sigs.push((cosign.signer_index, cosign.signature));
                                }
                                Ok(None) => {
                                    warn!(source = %source_name, "createBatch sign channel closed");
                                    break;
                                }
                                Err(_) => break, // timeout
                            }
                        }

                        // Deregister — channel is done
                        self.cosign_router.remove(&source_id);
                    } else {
                        warn!(source = %source_name, "No P2P broadcast channel — submitting with single-oracle sig (will fail 2-of-3 threshold)");
                    }
                }

                if collected_sigs.len() < threshold {
                    error!(
                        source = %source_name,
                        collected = collected_sigs.len(),
                        threshold,
                        "Insufficient co-signs for createBatch — aborting on-chain submission"
                    );
                    return Ok(lifecycle_id);
                }

                // Aggregate all collected BLS signatures
                let bls_signer = Bn254BLSSigner::new();
                let sigs_only: Vec<BLSSignature> = collected_sigs.iter().map(|(_, s)| s.clone()).collect();
                let aggregated = match bls_signer.aggregate_signatures(sigs_only) {
                    Ok(agg) => agg,
                    Err(e) => {
                        error!(source = %source_name, error = %e, "BLS aggregation failed for createBatch");
                        return Ok(lifecycle_id);
                    }
                };

                let signers_bitmask = U256::from(signer_bits);
                if let Some(on_chain_id) = self.submit_create_batch(
                    source_name, writer, source_id, config_hash,
                    tick_duration, lock_offset, aggregated.0,
                    ref_nonce, signers_bitmask, lifecycle_id,
                ).await {
                    return Ok(on_chain_id);
                }
                // Submission failed — fall through to return lifecycle_id as fallback
            } else {
                warn!(
                    source = %source_name,
                    "Leader has no chain_writer — cannot submit createBatch on-chain"
                );
            }
        } else {
            // Follower: sign the proposal received via P2P and send back the signature.
            // The leader will aggregate and submit on-chain.
            // (Chain event listener registers the batch when BatchCreated fires.)
            info!(
                source = %source_name,
                node_index = self.config.node_index,
                "Follower — waiting for VisionCreateBatchProposal to co-sign"
            );
        }

        Ok(lifecycle_id)
    }

    /// Submit createBatch on-chain (extracted for reuse from two code paths above).
    ///
    /// Returns the on-chain batch ID parsed from the `BatchCreated` event,
    /// or `None` if the submission failed.
    async fn submit_create_batch(
        &self,
        source_name: &str,
        writer: &Arc<EthersChainWriter>,
        source_id: H256,
        config_hash: H256,
        tick_duration: u64,
        lock_offset: u64,
        bls_sig: Vec<u8>,
        ref_nonce: u64,
        signers_bitmask: U256,
        lifecycle_id: u64,
    ) -> Option<u64> {
        info!(
            source = %source_name,
            ?source_id,
            ?config_hash,
            tick_duration,
            lock_offset,
            signers_bitmask = %signers_bitmask,
            ref_nonce,
            lifecycle_id,
            "Submitting createBatch on-chain"
        );
        match writer.create_batch(
            source_id,
            config_hash,
            tick_duration,
            lock_offset,
            bls_sig,
            ref_nonce,
            signers_bitmask,
        ).await {
            Ok((tx_hash, on_chain_batch_id)) => {
                info!(
                    source = %source_name,
                    tx_hash = ?tx_hash,
                    lifecycle_id,
                    on_chain_batch_id,
                    "createBatch submitted — on-chain batchId extracted from receipt"
                );

                // Store the on-chain batch ID in the lifecycle record.
                // The lifecycle row keeps its auto-increment batch_id as PK;
                // on_chain_batch_id is what joins against vision_batches.
                if let Err(e) = sqlx::query(
                    "UPDATE vision_batch_lifecycle SET on_chain_batch_id = $1 WHERE batch_id = $2",
                )
                .bind(on_chain_batch_id as i64)
                .bind(lifecycle_id as i64)
                .execute(&self.pool)
                .await
                {
                    warn!(
                        source = %source_name,
                        lifecycle_id,
                        on_chain_batch_id,
                        error = %e,
                        "Failed to set on_chain_batch_id in lifecycle record"
                    );
                }

                Some(on_chain_batch_id)
            }
            Err(e) => {
                error!(
                    source = %source_name,
                    error = %e,
                    "createBatch on-chain submission failed"
                );
                None
            }
        }
    }

    /// Sign the settlement, aggregate with other oracles via shared DB, submit at quorum.
    ///
    /// Each oracle computes the same deterministic hash from (players, payouts),
    /// signs it with its own BLS key, then UPSERTs into `vision_settlement_proofs`.
    /// The UPSERT uses `SELECT FOR UPDATE` to serialise concurrent writers —
    /// the last oracle to arrive aggregates all signatures and submits on-chain.
    async fn sign_and_aggregate_settlement(
        &self,
        settlement: &RoundSettlement,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let bls_keypair = match &self.bls_keypair {
            Some(kp) => kp.clone(),
            None => {
                debug!(batch_id = settlement.batch_id, "No BLS keypair — skipping settlement signing");
                return Ok(());
            }
        };

        if settlement.players.is_empty() {
            debug!(batch_id = settlement.batch_id, "No players — nothing to settle on-chain");
            return Ok(());
        }

        let batch_id = settlement.batch_id;
        let vision_address: Address = self.config.vision_address.parse().unwrap_or_default();
        let chain_id = self.config.chain_id;
        let node_index = self.config.node_index;
        let num_oracles = self.config.num_oracles;
        let threshold = (num_oracles / 2) + 1; // 2-of-3, 3-of-5, etc.

        // 1. Compute deterministic payouts hash
        let payouts_hash = keccak256(&encode(&[
            Token::Array(settlement.players.iter().map(|a| Token::Address(*a)).collect()),
            Token::Array(settlement.payouts.iter().map(|p| Token::Uint(*p)).collect()),
        ]));

        // 2. Compute SETTLE_BATCH BLS message hash (must match Vision.sol domain)
        let message_hash: [u8; 32] = keccak256(&encode(&[
            Token::Uint(U256::from(chain_id)),
            Token::Address(vision_address),
            Token::String("SETTLE_BATCH".to_string()),
            Token::Uint(U256::from(batch_id)),
            Token::FixedBytes(payouts_hash.to_vec()),
        ]));

        // 3. Sign with local BLS key
        let signer = Bn254BLSSigner::new();
        let signature = signer.sign_message_hash(&bls_keypair, &message_hash)
            .map_err(|e| format!("BLS signing failed for batch {}: {}", batch_id, e))?;
        let sig_bytes = signature.0;
        let node_bitmap: i64 = 1i64 << node_index;

        // 4. Shared-DB aggregation with SELECT FOR UPDATE
        let my_payouts_hash_hex = format!("0x{}", hex::encode(payouts_hash));
        let mut tx = self.pool.begin().await?;

        let existing: Option<(Vec<u8>, i64, bool, String)> = sqlx::query_as(
            "SELECT bls_sig, signer_bitmap, submitted, players_hash FROM vision_settlement_proofs WHERE batch_id = $1 FOR UPDATE"
        )
        .bind(batch_id as i64)
        .fetch_optional(&mut *tx)
        .await?;

        let (final_sig, final_bitmap, already_submitted) = if let Some((existing_sig, existing_bitmap, submitted, stored_hash)) = existing {
            if submitted {
                // Already submitted on-chain by another oracle — nothing to do.
                tx.commit().await?;
                debug!(batch_id, "Settlement already submitted on-chain — skipping");
                return Ok(());
            }

            if existing_bitmap & node_bitmap != 0 {
                // This oracle already signed — idempotent.
                tx.commit().await?;
                debug!(batch_id, node_index, "Already signed this settlement — skipping");
                return Ok(());
            }

            // Guard: verify our payouts hash matches the stored one.
            // If they differ, we computed different resolution outcomes — signing
            // would produce an invalid aggregated BLS signature.
            if stored_hash != my_payouts_hash_hex {
                tx.commit().await?;
                warn!(
                    batch_id,
                    node_index,
                    our_hash = %my_payouts_hash_hex,
                    stored_hash = %stored_hash,
                    "Payouts hash mismatch — skipping BLS sign to avoid invalid aggregation"
                );
                return Ok(());
            }

            // Aggregate BLS signatures (point addition)
            let merged_bitmap = existing_bitmap | node_bitmap;
            let merged_sig = if existing_sig.is_empty() {
                sig_bytes.clone()
            } else {
                match signer.aggregate_signatures(vec![
                    BLSSignature(existing_sig),
                    BLSSignature(sig_bytes.clone()),
                ]) {
                    Ok(agg) => agg.0,
                    Err(e) => {
                        warn!(
                            batch_id, error = %e,
                            "BLS aggregation failed — overwriting with own signature"
                        );
                        // Fall back to own signature only
                        tx.commit().await?;
                        return Err(format!("BLS aggregation failed: {}", e).into());
                    }
                }
            };

            // Update existing row — also backfill payload if missing (pre-migration rows)
            let players_json = serde_json::to_value(
                settlement.players.iter().map(|a| format!("{:?}", a)).collect::<Vec<_>>()
            ).unwrap_or_default();
            let payouts_json = serde_json::to_value(
                settlement.payouts.iter().map(|p| p.to_string()).collect::<Vec<_>>()
            ).unwrap_or_default();

            sqlx::query(
                "UPDATE vision_settlement_proofs
                 SET bls_sig = $1, signer_bitmap = $2,
                     players_json = COALESCE(players_json, $4),
                     payouts_json = COALESCE(payouts_json, $5)
                 WHERE batch_id = $3"
            )
            .bind(&merged_sig[..])
            .bind(merged_bitmap)
            .bind(batch_id as i64)
            .bind(&players_json)
            .bind(&payouts_json)
            .execute(&mut *tx)
            .await?;

            (merged_sig, merged_bitmap, false)
        } else {
            // First signer — insert new row (include payload for recovery)
            let players_json = serde_json::to_value(
                settlement.players.iter().map(|a| format!("{:?}", a)).collect::<Vec<_>>()
            ).unwrap_or_default();
            let payouts_json = serde_json::to_value(
                settlement.payouts.iter().map(|p| p.to_string()).collect::<Vec<_>>()
            ).unwrap_or_default();

            sqlx::query(
                "INSERT INTO vision_settlement_proofs (batch_id, players_hash, bls_sig, signer_bitmap, players_json, payouts_json)
                 VALUES ($1, $2, $3, $4, $5, $6)"
            )
            .bind(batch_id as i64)
            .bind(&my_payouts_hash_hex)
            .bind(&sig_bytes[..])
            .bind(node_bitmap)
            .bind(&players_json)
            .bind(&payouts_json)
            .execute(&mut *tx)
            .await?;

            (sig_bytes, node_bitmap, false)
        };

        tx.commit().await?;

        let popcount = final_bitmap.count_ones();
        info!(
            batch_id,
            node_index,
            signers = popcount,
            threshold,
            bitmap = final_bitmap,
            "Settlement proof stored"
        );

        // 5. Check quorum — submit on-chain if enough signers
        if popcount as usize >= threshold && !already_submitted {
            if let Some(ref writer) = self.chain_writer {
                let ref_nonce = self.read_last_snapshot_nonce().await.unwrap_or(0);
                match writer.settle_batch(
                    batch_id,
                    settlement.players.clone(),
                    settlement.payouts.clone(),
                    final_sig,
                    ref_nonce,
                    U256::from(final_bitmap as u64),
                ).await {
                    Ok(tx_hash) => {
                        info!(
                            batch_id,
                            tx = %tx_hash,
                            signers = popcount,
                            "settleBatch submitted on-chain"
                        );
                        // Mark as submitted
                        sqlx::query("UPDATE vision_settlement_proofs SET submitted = true WHERE batch_id = $1")
                            .bind(batch_id as i64)
                            .execute(&self.pool)
                            .await?;
                    }
                    Err(e) => {
                        let err_str = e.to_string();
                        // Record failure for the retry sweep
                        let _ = sqlx::query(
                            "UPDATE vision_settlement_proofs SET last_error = $1, last_retry_at = NOW(), retry_count = retry_count + 1 WHERE batch_id = $2"
                        )
                        .bind(&err_str)
                        .bind(batch_id as i64)
                        .execute(&self.pool)
                        .await;

                        // If the batch was already settled on-chain (revert), mark submitted
                        // to prevent infinite retries.
                        if err_str.to_lowercase().contains("already settled") || err_str.to_lowercase().contains("batchalreadysettled") {
                            info!(batch_id, "Batch already settled on-chain — marking submitted");
                            let _ = sqlx::query("UPDATE vision_settlement_proofs SET submitted = true WHERE batch_id = $1")
                                .bind(batch_id as i64)
                                .execute(&self.pool)
                                .await;
                            return Ok(());
                        }

                        error!(
                            batch_id,
                            error = %err_str,
                            "settleBatch on-chain call failed — retry sweep will pick this up"
                        );
                        return Err(format!("settleBatch failed for batch {}: {}", batch_id, err_str).into());
                    }
                }
            } else {
                warn!(batch_id, "Quorum reached but no chain_writer — cannot submit settleBatch");
            }
        }

        Ok(())
    }

    /// Record a new round in `vision_batch_lifecycle` and return its ID.
    async fn record_round_lifecycle(
        &self,
        source_name: &str,
        config_hash: &str,
        tick_duration: u64,
        market_count: usize,
    ) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
        let now = chrono::Utc::now();
        let betting_end = now + chrono::Duration::seconds(tick_duration as i64);
        let settlement_deadline = betting_end + chrono::Duration::seconds(SETTLEMENT_DELAY_SECS + tick_duration as i64);

        // Use nextBatchId from vision_batches as a proxy for the batch_id
        // (the real batch_id comes from the on-chain createBatch call)
        let next_id: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(batch_id), 0) + 1 FROM vision_batch_lifecycle")
            .fetch_one(&self.pool)
            .await
            .unwrap_or(1000);

        sqlx::query(
            "INSERT INTO vision_batch_lifecycle (batch_id, source_id, config_hash, timeframe_secs, betting_start, betting_end, settlement_deadline, market_count, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (batch_id) DO NOTHING",
        )
        .bind(next_id)
        .bind(source_name)
        .bind(config_hash)
        .bind(tick_duration as i64)
        .bind(now)
        .bind(betting_end)
        .bind(settlement_deadline)
        .bind(market_count as i32)
        .execute(&self.pool)
        .await?;

        Ok(next_id as u64)
    }

    /// Save a price snapshot at round creation so the resolver has real start prices.
    async fn save_start_prices(
        &self,
        batch_id: u64,
        source_name: &str,
        asset_ids: &[String],
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let targeted_url = format!(
            "{}/vision/snapshot/targeted",
            self.config.data_node_url
        );
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .gzip(true)
            .build()?;
        let json: serde_json::Value = client
            .post(&targeted_url)
            .json(&serde_json::json!({
                "source": source_name,
                "asset_ids": asset_ids,
            }))
            .send()
            .await?
            .json()
            .await?;

        // Extract just asset_id → value_scaled pairs (compact)
        let mut prices_map = serde_json::Map::new();
        if let Some(snaps) = json.get("snapshots").and_then(|s| s.as_array()) {
            for snap in snaps {
                let asset_id = snap.get("asset_id").or_else(|| snap.get("assetId"))
                    .and_then(|v| v.as_str()).unwrap_or("");
                let value = snap.get("valueScaled").or_else(|| snap.get("value_scaled"))
                    .and_then(|v| v.as_str())
                    .or_else(|| snap.get("value").and_then(|v| v.as_str()));
                if !asset_id.is_empty() {
                    if let Some(v) = value {
                        prices_map.insert(asset_id.to_string(), serde_json::Value::String(v.to_string()));
                    }
                }
            }
        }

        let prices_json = serde_json::Value::Object(prices_map);
        sqlx::query("UPDATE vision_batch_lifecycle SET start_prices = $1 WHERE batch_id = $2")
            .bind(&prices_json)
            .bind(batch_id as i64)
            .execute(&self.pool)
            .await?;

        info!(source = %source_name, batch_id, assets = prices_json.as_object().map(|m| m.len()).unwrap_or(0), "Saved start price snapshot");
        Ok(())
    }

    /// Record settlement results for a round.
    async fn record_settlement(
        &self,
        settlement: &RoundSettlement,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Update lifecycle state (keyed by on-chain batch ID)
        sqlx::query(
            "UPDATE vision_batch_lifecycle SET settled_at = NOW()
             WHERE on_chain_batch_id = $1",
        )
        .bind(settlement.batch_id as i64)
        .execute(&self.pool)
        .await?;

        // Record per-player results
        for (i, player) in settlement.players.iter().enumerate() {
            let payout = settlement.payouts[i];
            let deposited = settlement.deposits.get(i).copied().unwrap_or(U256::zero());
            let correct = settlement.correct_counts[i];
            // pnl = payout - deposited (signed arithmetic via i128)
            let pnl_str = {
                let dep = deposited.low_u128() as i128;
                let pay = payout.low_u128() as i128;
                (pay - dep).to_string()
            };
            sqlx::query(
                "INSERT INTO vision_round_players
                     (batch_id, player, deposited, payout, pnl, correct_count, total_markets, settled_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                 ON CONFLICT (batch_id, player) DO UPDATE SET
                     pnl = EXCLUDED.pnl,
                     payout = EXCLUDED.payout,
                     deposited = EXCLUDED.deposited,
                     correct_count = EXCLUDED.correct_count,
                     total_markets = EXCLUDED.total_markets,
                     settled_at = EXCLUDED.settled_at",
            )
            .bind(settlement.batch_id as i64)
            .bind(format!("{:?}", player))
            .bind(deposited.to_string())
            .bind(payout.to_string())
            .bind(pnl_str)
            .bind(correct as i32)
            .bind(settlement.total_markets as i32)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    /// Read lastSnapshotNonce from the OracleRegistry contract.
    ///
    /// Uses the chain_writer's ethers-rs provider (same transport the oracle uses for all
    /// other contract calls) to call `lastSnapshotNonce()` on the OracleRegistry.
    /// Orbit L3's sequencer rejects raw JSON-RPC `eth_call` for proxy contracts, but ethers-rs
    /// sends a properly typed transaction object that the sequencer accepts.
    async fn read_last_snapshot_nonce(&self) -> Option<u64> {
        let writer = match &self.chain_writer {
            Some(w) => w.clone(),
            None => {
                warn!("No chain_writer — cannot read lastSnapshotNonce, defaulting to 0");
                return Some(0);
            }
        };

        // Resolve OracleRegistry address: prefer explicit config, fall back to empty (fail below).
        let registry_addr_str = self.config.oracle_registry_address.clone();
        if registry_addr_str.is_empty() {
            warn!("oracle_registry_address not configured — snapshot nonce defaulting to 0");
            return Some(0);
        }

        let registry_addr: Address = match registry_addr_str.parse() {
            Ok(a) => a,
            Err(_) => {
                warn!(addr = %registry_addr_str, "Invalid oracle_registry_address — snapshot nonce defaulting to 0");
                return Some(0);
            }
        };

        // lastSnapshotNonce() selector = keccak256("lastSnapshotNonce()")[..4] = 0xa776590c
        let selector = ethers::utils::keccak256(b"lastSnapshotNonce()");
        let calldata = selector[..4].to_vec();

        let call_result: Result<Vec<u8>, _> = writer.static_call(registry_addr, calldata).await;
        match call_result {
            Ok(bytes) if bytes.len() >= 32 => {
                let nonce = ethers::types::U256::from_big_endian(&bytes[..32]).as_u64();
                Some(nonce)
            }
            Ok(_) => {
                warn!("lastSnapshotNonce() returned unexpected data length — defaulting to 0");
                Some(0)
            }
            Err(e) => {
                warn!(error = %e, "Failed to read lastSnapshotNonce — defaulting to 0");
                Some(0)
            }
        }
    }

    // =========================================================================
    // Settlement co-sign + recovery loop
    // =========================================================================

    /// Background loop that (a) co-signs pending settlements and (b) retries
    /// failed on-chain `settleBatch` submissions.
    ///
    /// **Co-signing** (all oracles):
    /// Scans `vision_settlement_proofs` for rows where this oracle hasn't signed
    /// yet. For each, independently resolves the batch, verifies the payouts hash
    /// matches, and adds its BLS signature. This is how quorum is reached —
    /// the leader resolves first, followers verify and co-sign.
    ///
    /// **Recovery** (leader only):
    /// After co-signing, scans for proofs with quorum met but not yet submitted
    /// on-chain. Retries the `settleBatch` call with stored payload.
    ///
    /// Runs every 15 seconds for co-signing, every 60 seconds for recovery.
    pub async fn run_settlement_recovery(self: Arc<Self>) {
        const COSIGN_INTERVAL_SECS: u64 = 15;
        const RECOVERY_INTERVAL_SECS: u64 = 60;
        const MAX_RETRIES: i32 = 10;

        let has_bls = self.bls_keypair.is_some();
        let is_leader = self.config.node_index == 0;

        if !has_bls {
            info!("Settlement co-sign/recovery: no BLS keypair — sleeping");
            return;
        }

        info!(
            node_index = self.config.node_index,
            is_leader,
            "Settlement co-sign/recovery loop starting (cosign={}s, recovery={}s)",
            COSIGN_INTERVAL_SECS, RECOVERY_INTERVAL_SECS,
        );

        let mut cosign_interval = tokio::time::interval(
            tokio::time::Duration::from_secs(COSIGN_INTERVAL_SECS),
        );
        let mut last_recovery = std::time::Instant::now();

        while !self.shutdown.load(Ordering::Relaxed) {
            cosign_interval.tick().await;

            // ── Phase 1: Co-sign pending settlements (ALL oracles) ──
            self.co_sign_pending_settlements().await;

            // ── Phase 2: Retry on-chain submission (leader only, every 60s) ──
            if is_leader && last_recovery.elapsed().as_secs() >= RECOVERY_INTERVAL_SECS {
                last_recovery = std::time::Instant::now();
                self.retry_unsubmitted_settlements(MAX_RETRIES).await;
            }
        }

        info!("Settlement co-sign/recovery loop shutting down");
    }

    /// Co-sign pending settlements that this oracle hasn't signed yet.
    ///
    /// For each unsubmitted proof where our bit is NOT set in signer_bitmap:
    /// 1. Look up the batch's source_name from vision_batch_lifecycle
    /// 2. Independently resolve the batch (deterministic — same inputs → same output)
    /// 3. sign_and_aggregate_settlement verifies hash match before adding our signature
    async fn co_sign_pending_settlements(&self) {
        let node_index = self.config.node_index;
        let my_bit: i64 = 1i64 << node_index;

        // Find proofs where we haven't signed yet
        let rows: Vec<(i64,)> = match sqlx::query_as(
            "SELECT sp.batch_id
             FROM vision_settlement_proofs sp
             WHERE sp.submitted = false
               AND (sp.signer_bitmap & $1) = 0
             ORDER BY sp.batch_id ASC
             LIMIT 10"
        )
        .bind(my_bit)
        .fetch_all(&self.pool)
        .await {
            Ok(rows) => rows,
            Err(e) => {
                warn!(error = %e, "Co-sign sweep: failed to query pending proofs");
                return;
            }
        };

        if rows.is_empty() {
            return;
        }

        debug!(node_index, count = rows.len(), "Co-sign sweep: found proofs needing signature");

        for (batch_id,) in &rows {
            let batch_id_u64 = *batch_id as u64;

            // Look up source_name from lifecycle table
            let source_name: Option<String> = sqlx::query_scalar(
                "SELECT source_id FROM vision_batch_lifecycle WHERE on_chain_batch_id = $1"
            )
            .bind(*batch_id)
            .fetch_optional(&self.pool)
            .await
            .ok()
            .flatten();

            let source_name = match source_name {
                Some(s) => s,
                None => {
                    debug!(batch_id = batch_id_u64, "Co-sign sweep: no lifecycle row — skipping");
                    continue;
                }
            };

            // Independently resolve the batch — deterministic given same inputs
            let settlement = match self.resolve_and_settle(batch_id_u64, &source_name).await {
                Ok(s) => s,
                Err(e) => {
                    debug!(
                        batch_id = batch_id_u64,
                        source = %source_name,
                        error = %e,
                        "Co-sign sweep: resolve failed — skipping (data may be unavailable)"
                    );
                    continue;
                }
            };

            if settlement.players.is_empty() {
                debug!(batch_id = batch_id_u64, "Co-sign sweep: empty settlement — skipping");
                continue;
            }

            // sign_and_aggregate_settlement handles:
            // - Hash mismatch detection (refuses to sign if our payouts differ)
            // - Idempotent (already-signed check via bitmap)
            // - Quorum detection + on-chain submission when threshold met
            match self.sign_and_aggregate_settlement(&settlement).await {
                Ok(()) => {
                    info!(
                        batch_id = batch_id_u64,
                        node_index,
                        source = %source_name,
                        "Co-sign sweep: signed settlement"
                    );
                }
                Err(e) => {
                    warn!(
                        batch_id = batch_id_u64,
                        node_index,
                        error = %e,
                        "Co-sign sweep: signing failed"
                    );
                }
            }

            // Small delay between batches
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }
    }

    /// Retry on-chain submission for proofs that have quorum but haven't been submitted.
    async fn retry_unsubmitted_settlements(&self, max_retries: i32) {
        let writer = match &self.chain_writer {
            Some(w) => w.clone(),
            None => {
                debug!("Settlement recovery: no chain_writer — skipping");
                return;
            }
        };

        let threshold = (self.config.num_oracles / 2) + 1;

        // Find unsubmitted proofs with stored payloads and sufficient signatures
        let rows: Vec<(i64, Vec<u8>, i64, serde_json::Value, serde_json::Value, i32)> = match sqlx::query_as(
            "SELECT batch_id, bls_sig, signer_bitmap, players_json, payouts_json, retry_count
             FROM vision_settlement_proofs
             WHERE submitted = false
               AND players_json IS NOT NULL
               AND retry_count < $1
             ORDER BY batch_id ASC
             LIMIT 20"
        )
        .bind(max_retries)
        .fetch_all(&self.pool)
        .await {
            Ok(rows) => rows,
            Err(e) => {
                warn!(error = %e, "Settlement recovery: failed to query unsubmitted proofs");
                return;
            }
        };

        if rows.is_empty() {
            return;
        }

        info!(count = rows.len(), "Settlement recovery: found unsubmitted settlements");

        for (batch_id, bls_sig, signer_bitmap, players_json, payouts_json, retry_count) in &rows {
                let batch_id_u64 = *batch_id as u64;
                let popcount = signer_bitmap.count_ones();

                if (popcount as usize) < threshold {
                    debug!(
                        batch_id = batch_id_u64,
                        signers = popcount,
                        threshold,
                        "Settlement recovery: insufficient signatures — skipping"
                    );
                    continue;
                }

                // Parse players from JSON
                let players: Vec<Address> = match players_json.as_array() {
                    Some(arr) => {
                        let mut addrs = Vec::with_capacity(arr.len());
                        let mut parse_ok = true;
                        for v in arr {
                            match v.as_str().and_then(|s| s.parse::<Address>().ok()) {
                                Some(a) => addrs.push(a),
                                None => { parse_ok = false; break; }
                            }
                        }
                        if !parse_ok {
                            error!(batch_id = batch_id_u64, "Settlement recovery: failed to parse players_json — marking exhausted");
                            let _ = sqlx::query("UPDATE vision_settlement_proofs SET retry_count = $1 WHERE batch_id = $2")
                                .bind(max_retries)
                                .bind(*batch_id)
                                .execute(&self.pool)
                                .await;
                            continue;
                        }
                        addrs
                    }
                    None => continue,
                };

                // Parse payouts from JSON
                let payouts: Vec<U256> = match payouts_json.as_array() {
                    Some(arr) => {
                        let mut vals = Vec::with_capacity(arr.len());
                        let mut parse_ok = true;
                        for v in arr {
                            match v.as_str().and_then(|s| U256::from_dec_str(s).ok()) {
                                Some(p) => vals.push(p),
                                None => { parse_ok = false; break; }
                            }
                        }
                        if !parse_ok {
                            error!(batch_id = batch_id_u64, "Settlement recovery: failed to parse payouts_json — marking exhausted");
                            let _ = sqlx::query("UPDATE vision_settlement_proofs SET retry_count = $1 WHERE batch_id = $2")
                                .bind(max_retries)
                                .bind(*batch_id)
                                .execute(&self.pool)
                                .await;
                            continue;
                        }
                        vals
                    }
                    None => continue,
                };

                if players.len() != payouts.len() || players.is_empty() {
                    error!(
                        batch_id = batch_id_u64,
                        players = players.len(),
                        payouts = payouts.len(),
                        "Settlement recovery: array length mismatch or empty — skipping"
                    );
                    continue;
                }

                // Read fresh reference nonce for the retry
                let ref_nonce = self.read_last_snapshot_nonce().await.unwrap_or(0);

                info!(
                    batch_id = batch_id_u64,
                    players = players.len(),
                    signers = popcount,
                    retry = retry_count + 1,
                    "Settlement recovery: retrying settleBatch"
                );

                match writer.settle_batch(
                    batch_id_u64,
                    players,
                    payouts,
                    bls_sig.clone(),
                    ref_nonce,
                    U256::from(*signer_bitmap as u64),
                ).await {
                    Ok(tx_hash) => {
                        info!(
                            batch_id = batch_id_u64,
                            tx = %tx_hash,
                            "Settlement recovery: settleBatch succeeded"
                        );
                        let _ = sqlx::query(
                            "UPDATE vision_settlement_proofs SET submitted = true, last_retry_at = NOW() WHERE batch_id = $1"
                        )
                        .bind(*batch_id)
                        .execute(&self.pool)
                        .await;
                        // Complete the deferred post-settlement cleanup
                        if let Err(e) = self.scheduler.mark_settled(&self.pool, batch_id_u64).await {
                            error!(batch_id = batch_id_u64, error = %e, "Settlement recovery: mark_settled failed");
                        }
                        if let Err(e) = self.bitmap_store.purge_batch_from_db(&self.pool, batch_id_u64).await {
                            error!(batch_id = batch_id_u64, error = %e, "Settlement recovery: purge_batch_from_db failed");
                        }
                    }
                    Err(e) => {
                        let err_str = format!("{}", e);
                        // If the contract says already settled, mark as submitted — someone else got there first
                        if err_str.contains("BatchAlreadySettled") || err_str.contains("already settled") {
                            info!(
                                batch_id = batch_id_u64,
                                "Settlement recovery: batch already settled on-chain — marking submitted"
                            );
                            let _ = sqlx::query(
                                "UPDATE vision_settlement_proofs SET submitted = true, last_retry_at = NOW() WHERE batch_id = $1"
                            )
                            .bind(*batch_id)
                            .execute(&self.pool)
                            .await;
                            // Clean up scheduler state even though we didn't submit the TX
                            if let Err(e) = self.scheduler.mark_settled(&self.pool, batch_id_u64).await {
                                error!(batch_id = batch_id_u64, error = %e, "Settlement recovery: mark_settled failed (already-settled path)");
                            }
                        } else {
                            warn!(
                                batch_id = batch_id_u64,
                                retry = retry_count + 1,
                                error = %e,
                                "Settlement recovery: settleBatch failed — will retry"
                            );
                            let _ = sqlx::query(
                                "UPDATE vision_settlement_proofs SET retry_count = retry_count + 1, last_retry_at = NOW(), last_error = $2 WHERE batch_id = $1"
                            )
                            .bind(*batch_id)
                            .bind(&err_str)
                            .execute(&self.pool)
                            .await;
                        }
                    }
                }

                // Small delay between retries to avoid nonce contention
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
    }
}

// parse_resolution_type is now in shared.rs
use super::shared::parse_resolution_type;
