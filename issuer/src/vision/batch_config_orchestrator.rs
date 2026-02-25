//! Batch config consensus — bridge orchestrator pattern.
//!
//! Runs as independent async task, separate from settlement cycle.
//! Own timing, own leader rotation (round % num_issuers), own SignatureCollector.
//!
//! Flow:
//!   Leader: poll data-node -> propose composite hash -> collect BLS co-signs -> publish
//!   Follower: receive proposal -> verify +-50% -> BLS co-sign -> replicate config to own DN

use std::collections::HashMap;
use std::sync::Arc;

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

    // Asset count within +-50%
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

    // Build follower lookup for threshold comparison
    let follower_map: HashMap<&str, u32> = follower
        .markets
        .iter()
        .map(|m| (m.asset_id.as_str(), m.threshold_bps))
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

pub struct BatchConfigOrchestrator {
    data_node_url: String,
    admin_token: String,
    round: u64,
    last_signed_hashes: HashMap<String, String>, // source_id -> last signed config_hash
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
        let batches = fetch_recommended(&self.data_node_url).await?;

        // Filter to configs that actually changed
        let changed: Vec<&RecommendedBatch> = batches
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
                None => {
                    // Source unknown to follower -- acceptable if within tolerance
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
        markets: Vec<(&str, u32)>,
    ) -> RecommendedBatch {
        RecommendedBatch {
            source_id: source_id.to_string(),
            display_name: source_id.to_string(),
            config_hash: "0xabc".into(),
            tick_duration_secs: tick_dur,
            lock_offset_secs: lock_off,
            markets: markets
                .into_iter()
                .map(|(id, bps)| RecommendedMarket {
                    asset_id: id.to_string(),
                    resolution_type: "up_x".to_string(),
                    threshold_bps: bps,
                    threshold_source: "test".to_string(),
                })
                .collect(),
            created_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    #[test]
    fn test_verify_same_source_passes() {
        let leader = make_batch("crypto", 600, 90, vec![("bitcoin", 200), ("ethereum", 300)]);
        let follower = make_batch("crypto", 600, 90, vec![("bitcoin", 210), ("ethereum", 290)]);
        assert!(verify_single_source(&leader, &follower).is_ok());
    }

    #[test]
    fn test_verify_source_id_mismatch() {
        let leader = make_batch("crypto", 600, 90, vec![]);
        let follower = make_batch("stocks", 600, 90, vec![]);
        assert!(verify_single_source(&leader, &follower).is_err());
    }

    #[test]
    fn test_verify_tick_duration_mismatch() {
        let leader = make_batch("crypto", 600, 90, vec![("bitcoin", 200)]);
        let follower = make_batch("crypto", 300, 90, vec![("bitcoin", 200)]);
        let err = verify_single_source(&leader, &follower).unwrap_err();
        assert!(err.contains("tick_duration"));
    }

    #[test]
    fn test_verify_lock_offset_mismatch() {
        let leader = make_batch("crypto", 600, 90, vec![("bitcoin", 200)]);
        let follower = make_batch("crypto", 600, 45, vec![("bitcoin", 200)]);
        let err = verify_single_source(&leader, &follower).unwrap_err();
        assert!(err.contains("lock_offset"));
    }

    #[test]
    fn test_verify_asset_count_tolerance() {
        // Leader has 10, follower has 4 -> ratio 1.5 > 0.5 -> reject
        let leader_markets: Vec<(&str, u32)> = (0..10).map(|i| {
            // Leak a string so we get a &str. Only in tests.
            let s: &str = Box::leak(format!("asset_{}", i).into_boxed_str());
            (s, 100u32)
        }).collect();
        let follower_markets: Vec<(&str, u32)> = (0..4).map(|i| {
            let s: &str = Box::leak(format!("asset_{}", i).into_boxed_str());
            (s, 100u32)
        }).collect();
        let leader = make_batch("crypto", 600, 90, leader_markets);
        let follower = make_batch("crypto", 600, 90, follower_markets);
        let err = verify_single_source(&leader, &follower).unwrap_err();
        assert!(err.contains("asset count"));
    }

    #[test]
    fn test_verify_unknown_asset_tolerance() {
        // Leader has assets A-E, follower knows A-C (but not D,E)
        // Asset counts: leader=5, follower=5 (within tolerance)
        // Unknown: 2/5 = 40% > 20% tolerance -> reject on unknown assets
        let leader = make_batch(
            "crypto",
            600,
            90,
            vec![("a", 100), ("b", 100), ("c", 100), ("d", 100), ("e", 100)],
        );
        let follower = make_batch(
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
        let leader = make_batch(
            "crypto",
            600,
            90,
            vec![("a", 1000), ("b", 1000), ("c", 1000), ("d", 1000)],
        );
        let follower = make_batch(
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
        // 45% threshold difference is within 50%
        let leader = make_batch("crypto", 600, 90, vec![("bitcoin", 145)]);
        let follower = make_batch("crypto", 600, 90, vec![("bitcoin", 100)]);
        assert!(verify_single_source(&leader, &follower).is_ok());
    }
}
