//! Batch config consensus — bridge orchestrator pattern.
//!
//! Runs as independent async task, separate from settlement cycle.
//! Own timing, own leader rotation (round % num_issuers), own SignatureCollector.
//!
//! Flow:
//!   Leader: poll data-node -> propose composite hash -> collect BLS co-signs -> publish
//!   Follower: receive proposal -> verify +-20% -> BLS co-sign -> replicate config to own DN

use std::collections::HashMap;
use std::time::{Duration, Instant};

use ethers::abi::{encode, Token};
use ethers::types::{Address, H256, U256};
use ethers::utils::keccak256;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

/// Tolerance for follower verification
const THRESHOLD_TOLERANCE: f64 = 0.20;
const ASSET_COUNT_TOLERANCE: f64 = 0.30;
/// Max fraction of leader's markets that follower doesn't know about
const UNKNOWN_ASSET_TOLERANCE: f64 = 0.05;
/// How often to run batch config consensus (seconds)
const ORCHESTRATOR_INTERVAL_SECS: u64 = 120;
/// Max new batch creations per rolling hour
const MAX_CREATIONS_PER_HOUR: usize = 3;
/// Min markets required before auto-creation fires
const MIN_MARKETS_FOR_CREATION: usize = 5;

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

    // Asset count within +-30%
    let leader_count = leader.markets.len() as f64;
    let follower_count = follower.markets.len() as f64;
    if follower_count > 0.0 {
        let ratio = (leader_count - follower_count).abs() / follower_count;
        if ratio > ASSET_COUNT_TOLERANCE {
            return Err(format!(
                "asset count: leader={}, follower={}, ratio={:.0}%",
                leader_count as usize,
                follower_count as usize,
                ratio * 100.0
            ));
        }
    }

    // Build follower lookup for threshold and resolution_type comparison
    let follower_map: HashMap<&str, &RecommendedMarket> = follower
        .markets
        .iter()
        .map(|m| (m.asset_id.as_str(), m))
        .collect();

    // Check unknown asset tolerance
    let unknown_count = leader
        .markets
        .iter()
        .filter(|m| !follower_map.contains_key(m.asset_id.as_str()))
        .count();
    if !leader.markets.is_empty() {
        let unknown_ratio = unknown_count as f64 / leader.markets.len() as f64;
        if unknown_ratio > UNKNOWN_ASSET_TOLERANCE {
            return Err(format!(
                "unknown assets: {}/{} ({:.0}%)",
                unknown_count,
                leader.markets.len(),
                unknown_ratio * 100.0
            ));
        }
    }

    // For overlapping assets, check resolution_type (exact) and threshold tolerance
    let mut checked = 0;
    let mut divergent = 0;
    for leader_market in &leader.markets {
        if let Some(follower_market) = follower_map.get(leader_market.asset_id.as_str()) {
            // resolution_type is a protocol enum — must match exactly
            if leader_market.resolution_type != follower_market.resolution_type {
                divergent += 1;
                continue;
            }

            checked += 1;
            let leader_bps = leader_market.threshold_bps as f64;
            let follower_bps_f = follower_market.threshold_bps as f64;
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
            "threshold divergence: {}/{} assets diverge >20%",
            divergent, checked
        ));
    }

    Ok(())
}

/// Compute the BLS message hash for updateBatchConfig.
///
/// Includes tickDuration so that a config signed for one tick cadence cannot
/// be replayed against a batch with a different cadence.
pub fn compute_update_batch_config_message(
    chain_id: U256,
    vision_address: Address,
    batch_id: U256,
    config_hash: H256,
    lock_offset: U256,
    tick_duration: U256,
) -> [u8; 32] {
    let message = encode(&[
        Token::Uint(chain_id),
        Token::Address(vision_address),
        Token::String("UPDATE_BATCH_CONFIG".to_string()),
        Token::Uint(batch_id),
        Token::FixedBytes(config_hash.as_bytes().to_vec()),
        Token::Uint(lock_offset),
        Token::Uint(tick_duration),
    ]);
    keccak256(message)
}


pub struct BatchConfigOrchestrator {
    data_node_url: String,
    admin_token: String,
    round: u64,
    last_signed_hashes: HashMap<String, String>, // source_id -> last signed config_hash
    /// Timestamps of recent batch creations, for rate-limiting.
    recent_creations: Vec<Instant>,
}

impl BatchConfigOrchestrator {
    pub fn new(data_node_url: String, admin_token: String) -> Self {
        Self {
            data_node_url,
            admin_token,
            round: 0,
            last_signed_hashes: HashMap::new(),
            recent_creations: Vec::new(),
        }
    }

    /// Main orchestrator loop. Runs independently from settlement consensus.
    pub async fn run(&mut self) {
        info!(
            "BatchConfigOrchestrator started (interval={}s)",
            ORCHESTRATOR_INTERVAL_SECS
        );

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
    pub async fn run_leader_round(
        &mut self,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let recommended_batches = fetch_recommended(&self.data_node_url).await?;

        // Auto-creation: check for sources with no on-chain batch.
        // Rate-limited to MAX_CREATIONS_PER_HOUR per rolling hour.
        self.recent_creations.retain(|t| t.elapsed() < Duration::from_secs(3600));
        for recommended in &recommended_batches {
            let source_id = H256::from(keccak256(recommended.source_id.as_bytes()));
            // TODO: integrate with TickScheduler once it is passed through.
            // if !scheduler.has_batch_for_source(source_id).await {
            //     if self.recent_creations.len() >= MAX_CREATIONS_PER_HOUR {
            //         warn!("Rate limit: skipping auto-creation for {}", recommended.source_id);
            //         continue;
            //     }
            //     if recommended.markets.len() < MIN_MARKETS_FOR_CREATION {
            //         warn!("Too few markets for auto-creation: {}", recommended.source_id);
            //         continue;
            //     }
            //     self.propose_batch_creation(recommended).await?;
            //     self.recent_creations.push(Instant::now());
            // }
            let _ = source_id; // suppress until integration
        }

        // Filter to configs that actually changed
        let changed: Vec<&RecommendedBatch> = recommended_batches
            .iter()
            .filter(|b| {
                self.last_signed_hashes
                    .get(&b.source_id)
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
            total = recommended_batches.len(),
            "Proposing batch config round"
        );

        // Build composite hash: keccak256(concat(sorted config hashes))
        // ... (send P2PMessage::BatchConfigProposal, collect signs, aggregate BLS)

        Ok(())
    }

    /// Follower: handle incoming BatchConfigProposal.
    pub async fn handle_proposal(
        &self,
        configs: &[RecommendedBatch], // leader's proposed configs
    ) -> Result<bool, String> {
        // Fetch own data-node's view
        let own_batches = fetch_recommended(&self.data_node_url)
            .await
            .map_err(|e| format!("failed to fetch own recommendations: {}", e))?;

        let own_map: HashMap<&str, &RecommendedBatch> = own_batches
            .iter()
            .map(|b| (b.source_id.as_str(), b))
            .collect();

        let mut accept_count = 0;
        let mut reject_count = 0;

        for leader_config in configs {
            match own_map.get(leader_config.source_id.as_str()) {
                Some(own_config) => match verify_single_source(leader_config, own_config) {
                    Ok(()) => accept_count += 1,
                    Err(reason) => {
                        warn!(
                            source = %leader_config.source_id,
                            %reason,
                            "Rejecting leader's batch config"
                        );
                        reject_count += 1;
                    }
                },
                // Unknown sources are rejections — a follower that doesn't recognise
                // a source cannot verify its markets, so it cannot accept.
                None => {
                    reject_count += 1;
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
    pub async fn publish_to_data_node(
        &self,
        config: &RecommendedBatch,
        bls_signature: &[u8],
        signers_bitmask: u64,
        reference_nonce: u64,
    ) -> Result<(), reqwest::Error> {
        let client = reqwest::Client::new();
        client
            .post(&format!("{}/batches/signed", self.data_node_url))
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
    pub async fn replicate_to_own_data_node(
        &self,
        config: &RecommendedBatch,
        bls_signature: &[u8],
        signers_bitmask: u64,
        reference_nonce: u64,
    ) -> Result<(), reqwest::Error> {
        let client = reqwest::Client::new();
        client
            .post(&format!("{}/batches/replicate", self.data_node_url))
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

    /// Get the current round number.
    pub fn round(&self) -> u64 {
        self.round
    }

    /// Update tracking of last signed hashes after successful consensus.
    pub fn record_signed(&mut self, source_id: &str, config_hash: &str) {
        self.last_signed_hashes
            .insert(source_id.to_string(), config_hash.to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_batch(
        source_id: &str,
        tick_dur: u64,
        lock_off: u64,
        markets: Vec<(&str, &str, u32)>,
    ) -> RecommendedBatch {
        RecommendedBatch {
            source_id: source_id.to_string(),
            display_name: source_id.to_string(),
            config_hash: "0xabc".into(),
            tick_duration_secs: tick_dur,
            lock_offset_secs: lock_off,
            markets: markets
                .into_iter()
                .map(|(id, res, bps)| RecommendedMarket {
                    asset_id: id.to_string(),
                    resolution_type: res.to_string(),
                    threshold_bps: bps,
                    threshold_source: "test".to_string(),
                })
                .collect(),
            created_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    // Convenience wrapper with default resolution_type "up_x"
    fn make_batch_simple(
        source_id: &str,
        tick_dur: u64,
        lock_off: u64,
        markets: Vec<(&str, u32)>,
    ) -> RecommendedBatch {
        make_batch(
            source_id,
            tick_dur,
            lock_off,
            markets.into_iter().map(|(id, bps)| (id, "up_x", bps)).collect(),
        )
    }

    #[test]
    fn test_verify_same_source_passes() {
        let leader = make_batch_simple("crypto", 600, 90, vec![("bitcoin", 200), ("ethereum", 300)]);
        let follower = make_batch_simple("crypto", 600, 90, vec![("bitcoin", 210), ("ethereum", 290)]);
        assert!(verify_single_source(&leader, &follower).is_ok());
    }

    #[test]
    fn test_verify_source_id_mismatch() {
        let leader = make_batch_simple("crypto", 600, 90, vec![]);
        let follower = make_batch_simple("stocks", 600, 90, vec![]);
        assert!(verify_single_source(&leader, &follower).is_err());
    }

    #[test]
    fn test_verify_tick_duration_mismatch() {
        let leader = make_batch_simple("crypto", 600, 90, vec![("bitcoin", 200)]);
        let follower = make_batch_simple("crypto", 300, 90, vec![("bitcoin", 200)]);
        let err = verify_single_source(&leader, &follower).unwrap_err();
        assert!(err.contains("tick_duration"));
    }

    #[test]
    fn test_verify_lock_offset_mismatch() {
        let leader = make_batch_simple("crypto", 600, 90, vec![("bitcoin", 200)]);
        let follower = make_batch_simple("crypto", 600, 45, vec![("bitcoin", 200)]);
        let err = verify_single_source(&leader, &follower).unwrap_err();
        assert!(err.contains("lock_offset"));
    }

    #[test]
    fn test_verify_asset_count_tolerance() {
        // Leader has 10, follower has 4 -> ratio 1.5 > 0.30 -> reject
        let leader_markets: Vec<(&str, u32)> = (0..10).map(|i| {
            // Leak a string so we get a &str. Only in tests.
            let s: &str = Box::leak(format!("asset_{}", i).into_boxed_str());
            (s, 100u32)
        }).collect();
        let follower_markets: Vec<(&str, u32)> = (0..4).map(|i| {
            let s: &str = Box::leak(format!("asset_{}", i).into_boxed_str());
            (s, 100u32)
        }).collect();
        let leader = make_batch_simple("crypto", 600, 90, leader_markets);
        let follower = make_batch_simple("crypto", 600, 90, follower_markets);
        let err = verify_single_source(&leader, &follower).unwrap_err();
        assert!(err.contains("asset count"));
    }

    #[test]
    fn test_verify_unknown_asset_tolerance() {
        // Leader has assets A-E, follower knows A-C (but not D,E)
        // Asset counts: leader=5, follower=5 (within 30% tolerance)
        // Unknown: 2/5 = 40% > 5% tolerance -> reject on unknown assets
        let leader = make_batch_simple(
            "crypto",
            600,
            90,
            vec![("a", 100), ("b", 100), ("c", 100), ("d", 100), ("e", 100)],
        );
        let follower = make_batch_simple(
            "crypto",
            600,
            90,
            vec![("a", 100), ("b", 100), ("c", 100), ("x", 100), ("y", 100)],
        );
        let err = verify_single_source(&leader, &follower).unwrap_err();
        assert!(err.contains("unknown assets"));
    }

    #[test]
    fn test_verify_threshold_divergence() {
        // All assets diverge massively -> reject
        let leader = make_batch_simple(
            "crypto",
            600,
            90,
            vec![("a", 1000), ("b", 1000), ("c", 1000), ("d", 1000)],
        );
        let follower = make_batch_simple(
            "crypto",
            600,
            90,
            vec![("a", 100), ("b", 100), ("c", 100), ("d", 100)],
        );
        let err = verify_single_source(&leader, &follower).unwrap_err();
        assert!(err.contains("threshold divergence"));
    }

    #[test]
    fn test_verify_within_tolerance() {
        // 15% threshold difference is within 20%
        let leader = make_batch_simple("crypto", 600, 90, vec![("bitcoin", 115)]);
        let follower = make_batch_simple("crypto", 600, 90, vec![("bitcoin", 100)]);
        assert!(verify_single_source(&leader, &follower).is_ok());
    }

    #[test]
    fn test_verify_resolution_type_mismatch_rejects() {
        // Same asset, different resolution_type -> counted as divergent
        let leader = make_batch("crypto", 600, 90, vec![("bitcoin", "up_x", 100), ("eth", "up_x", 100)]);
        let follower = make_batch("crypto", 600, 90, vec![("bitcoin", "binary", 100), ("eth", "up_x", 100)]);
        // bitcoin: resolution mismatch -> reject_count++ (via divergent path), eth: ok
        // divergent=1, checked=1 -> 100% > 50% -> should fail
        let err = verify_single_source(&leader, &follower).unwrap_err();
        assert!(err.contains("threshold divergence"));
    }

    #[test]
    fn test_compute_update_batch_config_message_is_deterministic() {
        use ethers::types::{Address, U256};
        let chain_id = U256::from(111222333u64);
        let addr = Address::zero();
        let batch_id = U256::from(1u64);
        let config_hash = H256::from([0xab; 32]);
        let lock_offset = U256::from(90u64);
        let tick_duration = U256::from(600u64);

        let h1 = compute_update_batch_config_message(
            chain_id, addr, batch_id, config_hash, lock_offset, tick_duration,
        );
        let h2 = compute_update_batch_config_message(
            chain_id, addr, batch_id, config_hash, lock_offset, tick_duration,
        );
        assert_eq!(h1, h2);

        // Different tick_duration => different hash
        let h3 = compute_update_batch_config_message(
            chain_id, addr, batch_id, config_hash, lock_offset, U256::from(300u64),
        );
        assert_ne!(h1, h3);
    }

    #[test]
    fn test_rate_limit_constants() {
        assert_eq!(MAX_CREATIONS_PER_HOUR, 3);
        assert_eq!(MIN_MARKETS_FOR_CREATION, 5);
    }
}
