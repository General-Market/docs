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
use common::BLSSignature;
use ethers::abi::{encode, Token};
use ethers::types::{Address, H256, U256};
use ethers::utils::keccak256;
use sqlx::PgPool;
use tracing::{info, warn, error, debug};

use crate::chain::EthersChainWriter;
use super::batch_config_orchestrator;
use super::bitmap_store::BitmapStore;
use super::config::VisionConfig;
use super::resolver::{MarketPrices, TickResolver};
use super::settlement::compute_settlement;
use super::tick_scheduler::TickScheduler;
use super::types::{MarketConfig, RoundSettlement};

/// Stagger interval between sources to avoid thundering herd.
const SOURCE_STAGGER_SECS: u64 = 7;

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
        }
    }

    /// Main loop. Runs until shutdown signal.
    pub async fn run(&self) {
        if self.config.round_based_sources.is_empty() {
            info!("BatchLifecycleManager: no round_based_sources configured, exiting");
            return;
        }

        // Build per-source state
        let mut sources: Vec<SourceState> = self
            .config
            .round_based_sources
            .iter()
            .enumerate()
            .map(|(i, name)| {
                let source_id = H256::from(keccak256(name.as_bytes()));
                SourceState {
                    source_name: name.clone(),
                    source_id,
                    tick_duration_secs: 0, // populated on first config fetch
                    current_batch_id: None,
                    previous_batch_id: None,
                    last_heartbeat: std::time::Instant::now(),
                    stagger_offset: std::time::Duration::from_secs(
                        SOURCE_STAGGER_SECS * i as u64,
                    ),
                }
            })
            .collect();

        info!(
            sources = ?self.config.round_based_sources,
            "BatchLifecycleManager starting"
        );

        // Fetch initial tick durations from data-node recommended configs
        if let Err(e) = self.populate_tick_durations(&mut sources).await {
            warn!(error = %e, "Failed to fetch initial tick durations — will retry");
        }

        // Poll interval: 1 second (fine-grained enough to respect stagger offsets)
        let poll_interval = tokio::time::Duration::from_secs(1);
        let mut interval = tokio::time::interval(poll_interval);

        while !self.shutdown.load(Ordering::Relaxed) {
            interval.tick().await;

            let now_instant = std::time::Instant::now();

            for source in &mut sources {
                // Skip sources without a known tick duration (config not yet fetched)
                if source.tick_duration_secs == 0 {
                    continue;
                }

                let elapsed = now_instant.duration_since(source.last_heartbeat);
                let required = std::time::Duration::from_secs(source.tick_duration_secs)
                    + source.stagger_offset;

                // On first iteration, stagger_offset delays the first heartbeat.
                // After the first heartbeat, stagger_offset is zeroed out —
                // subsequent heartbeats fire at tick_duration intervals.
                if elapsed < required {
                    continue;
                }

                // Fire heartbeat
                source.last_heartbeat = now_instant;
                // After first heartbeat, remove stagger so subsequent ticks are regular
                source.stagger_offset = std::time::Duration::ZERO;

                info!(
                    source = %source.source_name,
                    tick_duration = source.tick_duration_secs,
                    current_batch = ?source.current_batch_id,
                    previous_batch = ?source.previous_batch_id,
                    "Lifecycle heartbeat"
                );

                // Step 1: Resolve previous batch if it exists
                if let Some(prev_id) = source.previous_batch_id {
                    match self.resolve_and_settle(prev_id, &source.source_name).await {
                        Ok(settlement) => {
                            info!(
                                source = %source.source_name,
                                batch_id = prev_id,
                                players = settlement.players.len(),
                                total_markets = settlement.total_markets,
                                "Round settled"
                            );
                            // Record settlement in DB
                            if let Err(e) = self.record_settlement(&settlement).await {
                                error!(
                                    batch_id = prev_id,
                                    error = %e,
                                    "Failed to record settlement in DB"
                                );
                            }

                            // BLS sign + aggregate in shared DB, submit on-chain at quorum
                            if let Err(e) = self.sign_and_aggregate_settlement(&settlement).await {
                                error!(
                                    batch_id = prev_id,
                                    error = %e,
                                    "Settlement BLS signing/aggregation failed"
                                );
                            }

                            // Cleanup: mark settled in scheduler, purge bitmaps
                            if let Err(e) = self.scheduler.mark_settled(&self.pool, prev_id).await {
                                error!(batch_id = prev_id, error = %e, "mark_settled failed");
                            }
                            if let Err(e) = self.bitmap_store.purge_batch_from_db(&self.pool, prev_id).await {
                                error!(batch_id = prev_id, error = %e, "purge_batch_from_db failed");
                            }
                        }
                        Err(e) => {
                            warn!(
                                source = %source.source_name,
                                batch_id = prev_id,
                                error = %e,
                                "Failed to resolve previous round"
                            );
                        }
                    }
                    source.previous_batch_id = None;
                }

                // Step 2: Rotate current → previous
                source.previous_batch_id = source.current_batch_id.take();

                // Step 3: Create new batch (fetch fresh config from data-node)
                match self.create_new_round(&source.source_name).await {
                    Ok(batch_id) => {
                        info!(
                            source = %source.source_name,
                            new_batch_id = batch_id,
                            "New round created"
                        );
                        source.current_batch_id = Some(batch_id);
                    }
                    Err(e) => {
                        warn!(
                            source = %source.source_name,
                            error = %e,
                            "Failed to create new round — will retry next heartbeat"
                        );
                    }
                }
            }
        }

        info!("BatchLifecycleManager shutting down");
    }

    /// Fetch recommended configs from data-node to populate tick durations.
    async fn populate_tick_durations(
        &self,
        sources: &mut [SourceState],
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let recommended =
            batch_config_orchestrator::fetch_recommended(&self.config.data_node_url).await?;

        for source in sources.iter_mut() {
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
                correct_counts: vec![],
                total_markets: 0,
            });
        }

        // Fetch market config from data-node
        let recommended =
            batch_config_orchestrator::fetch_recommended(&self.config.data_node_url).await?;
        let rec_batch = recommended
            .iter()
            .find(|b| b.source_id == source_name)
            .ok_or_else(|| format!("no recommended config for source {}", source_name))?;

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

        // Fetch snapshot prices from data-node
        let snapshot_url = format!(
            "{}/vision/snapshot?source={}&limit=10000",
            self.config.data_node_url, source_name
        );
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()?;
        let json: serde_json::Value = client.get(&snapshot_url).send().await?.json().await?;

        let snapshots = json
            .get("snapshots")
            .and_then(|s| s.as_array())
            .ok_or("missing 'snapshots' array in data-node response")?;

        // Build MarketPrices from snapshot
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

            // Parse price (prefer value_scaled, fall back to f64 value)
            let value: i128 =
                if let Some(scaled) = snap.get("value_scaled").and_then(|v| v.as_str()) {
                    match scaled.parse::<i128>() {
                        Ok(v) => v,
                        Err(_) => continue,
                    }
                } else if let Some(f) = snap.get("value").and_then(|v| v.as_f64()) {
                    (f * 1e8).round() as i128
                } else {
                    continue;
                };

            if value == 0 {
                continue;
            }

            // For round-based batches, start_price = end_price (single snapshot).
            // The resolver computes pct_change from start vs end.
            // In a round with a single tick, both reference the same snapshot —
            // the change_pct from the data-node is the actual movement.
            let change_pct = snap
                .get("change_pct")
                .or_else(|| snap.get("changePct"))
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);

            // Derive start price from end price and change_pct
            let start = if change_pct.abs() > 1e-10 {
                let factor = 1.0 + (change_pct / 100.0);
                ((value as f64) / factor).round() as i128
            } else {
                value
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

            prices.insert(market_id, start, value, fetched_at);
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
    /// Leader oracle (node_index == 0) submits `createBatch` on-chain.
    /// Follower oracles detect the new batch via `BatchCreated` chain events
    /// and register it in their scheduler automatically.
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
        let lifecycle_id = self.record_round_lifecycle(source_name, config_hash_str, tick_duration).await?;

        // Only leader submits on-chain. Followers detect via BatchCreated events.
        let is_leader = self.config.node_index == 0;

        if is_leader {
            if let Some(ref writer) = self.chain_writer {
                let source_id = H256::from(keccak256(source_name.as_bytes()));

                // Parse config hash from hex string
                let config_hash: H256 = config_hash_str
                    .parse()
                    .unwrap_or_else(|_| H256::from(keccak256(config_hash_str.as_bytes())));

                // Compute BLS message: keccak256(abi.encode(chainid, vision_address, "CREATE_BATCH", sourceId, configHash, tickDuration, lockOffset))
                let vision_address: ethers::types::Address = self.config.vision_address
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

                // BLS sign the createBatch message
                let bls_sig = if let Some(ref kp) = self.bls_keypair {
                    let signer = Bn254BLSSigner::new();
                    match signer.sign_message_hash(kp, &bls_message) {
                        Ok(sig) => sig.0,
                        Err(e) => {
                            warn!(source = %source_name, error = %e, "BLS signing failed for createBatch");
                            return Err(e.into());
                        }
                    }
                } else {
                    warn!(source = %source_name, "No BLS keypair — cannot sign createBatch");
                    return Err("No BLS keypair".into());
                };
                // Read lastSnapshotNonce from OracleRegistry (same as balance proof flow)
                let ref_nonce = self.read_last_snapshot_nonce().await.unwrap_or(0);
                let node_index = self.config.node_index;
                let signers_bitmask = U256::from(1u64 << node_index);

                info!(
                    source = %source_name,
                    source_id = ?source_id,
                    config_hash = ?config_hash,
                    tick_duration,
                    lock_offset,
                    bls_message = ?H256::from(bls_message),
                    "Leader submitting createBatch on-chain"
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
                    Ok(tx_hash) => {
                        info!(
                            source = %source_name,
                            tx_hash = ?tx_hash,
                            lifecycle_id,
                            "createBatch submitted on-chain"
                        );
                    }
                    Err(e) => {
                        error!(
                            source = %source_name,
                            error = %e,
                            "createBatch on-chain submission failed — batch exists in DB only"
                        );
                    }
                }
            } else {
                warn!(
                    source = %source_name,
                    "Leader has no chain_writer — cannot submit createBatch on-chain"
                );
            }
        } else {
            info!(
                source = %source_name,
                node_index = self.config.node_index,
                "Follower — skipping on-chain createBatch (will detect via chain events)"
            );
        }

        Ok(lifecycle_id)
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
        let mut tx = self.pool.begin().await?;

        let existing: Option<(Vec<u8>, i64, bool)> = sqlx::query_as(
            "SELECT bls_sig, signer_bitmap, submitted FROM vision_settlement_proofs WHERE batch_id = $1 FOR UPDATE"
        )
        .bind(batch_id as i64)
        .fetch_optional(&mut *tx)
        .await?;

        let (final_sig, final_bitmap, already_submitted) = if let Some((existing_sig, existing_bitmap, submitted)) = existing {
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

            // Update existing row
            sqlx::query(
                "UPDATE vision_settlement_proofs SET bls_sig = $1, signer_bitmap = $2 WHERE batch_id = $3"
            )
            .bind(&merged_sig[..])
            .bind(merged_bitmap)
            .bind(batch_id as i64)
            .execute(&mut *tx)
            .await?;

            (merged_sig, merged_bitmap, false)
        } else {
            // First signer — insert new row
            let players_hash_hex = format!("0x{}", hex::encode(payouts_hash));
            sqlx::query(
                "INSERT INTO vision_settlement_proofs (batch_id, players_hash, bls_sig, signer_bitmap)
                 VALUES ($1, $2, $3, $4)"
            )
            .bind(batch_id as i64)
            .bind(&players_hash_hex)
            .bind(&sig_bytes[..])
            .bind(node_bitmap)
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
                let ref_nonce = 0u64; // TODO: read lastSnapshotNonce from OracleRegistry
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
                        error!(
                            batch_id,
                            error = %e,
                            "settleBatch on-chain call failed — will retry next cycle"
                        );
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
    ) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
        let now = chrono::Utc::now();
        let betting_end = now + chrono::Duration::seconds(tick_duration as i64);
        let settlement_deadline = betting_end + chrono::Duration::seconds(tick_duration as i64 * 2);

        // Use nextBatchId from vision_batches as a proxy for the batch_id
        // (the real batch_id comes from the on-chain createBatch call)
        let next_id: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(batch_id), 0) + 1 FROM vision_batch_lifecycle")
            .fetch_one(&self.pool)
            .await
            .unwrap_or(1000);

        sqlx::query(
            "INSERT INTO vision_batch_lifecycle (batch_id, source_id, config_hash, timeframe_secs, betting_start, betting_end, settlement_deadline, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (batch_id) DO NOTHING",
        )
        .bind(next_id)
        .bind(source_name)
        .bind(config_hash)
        .bind(tick_duration as i64)
        .bind(now)
        .bind(betting_end)
        .bind(settlement_deadline)
        .execute(&self.pool)
        .await?;

        Ok(next_id as u64)
    }

    /// Record settlement results for a round.
    async fn record_settlement(
        &self,
        settlement: &RoundSettlement,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Update lifecycle state
        sqlx::query(
            "UPDATE vision_batch_lifecycle SET state = 'settled', settled_at = NOW()
             WHERE id = $1",
        )
        .bind(settlement.batch_id as i64)
        .execute(&self.pool)
        .await?;

        // Record per-player results
        for (i, player) in settlement.players.iter().enumerate() {
            let payout = settlement.payouts[i];
            let correct = settlement.correct_counts[i];
            sqlx::query(
                "INSERT INTO vision_round_players (lifecycle_id, player, payout, correct_count, total_markets)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT DO NOTHING",
            )
            .bind(settlement.batch_id as i64)
            .bind(format!("{:?}", player))
            .bind(payout.as_u128() as i64) // safe for typical stake sizes
            .bind(correct as i32)
            .bind(settlement.total_markets as i32)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    /// Read lastSnapshotNonce from the OracleRegistry contract.
    /// Falls back to 0 if the call fails (single-oracle testnet).
    async fn read_last_snapshot_nonce(&self) -> Option<u64> {
        if let Some(ref writer) = self.chain_writer {
            // Try to read from chain via a simple eth_call
            // For now, use 0 — the contract accepts nonce 0 if within the 256-nonce window
            // TODO: implement eth_call to OracleRegistry.lastSnapshotNonce()
            Some(0)
        } else {
            Some(0)
        }
    }
}

/// Parse resolution type string to u8 code.
/// Mirror of engine.rs parse_resolution_type — kept local to avoid circular dependency.
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
        "up_300" => 8,
        "up_3000" => 9,
        "down_300" => 10,
        "down_3000" => 11,
        "flat_300" => 12,
        "flat_3000" => 13,
        _ => 255,
    }
}
