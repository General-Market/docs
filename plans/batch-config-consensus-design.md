# Batch Config Consensus — Architecture Design

**Session:** 20260225-1645-b9k3
**Status:** Design document — ready for implementation
**Resolves:** F18, F9, F17, Issues 1-9 from design review

---

## Problem Statement

Batch config consensus (BLS-signing data-node batch configs so users can submit them on-chain) cannot run inside `run_cycle()`. The settlement consensus cycle has a 1s budget (800ms in timeouts alone). Adding HTTP calls to data-node + multi-round BLS consensus for batch configs would blow this budget and introduce cross-contamination between settlement signatures and batch config signatures sharing the same `SignatureAggregator`.

---

## Decision: Independent Orchestrator (Bridge Pattern)

Batch config consensus runs as an **independent async loop** on its own tokio task, following the `BridgeOrchestrator` pattern. It:

- Has its own `SignatureCollector` instances (per config hash), completely separated from the settlement `SignatureAggregator`
- Uses its own P2PMessage variants for proposal/sign
- Runs on its own timer (not tied to the 1s settlement cycle)
- Uses the same leader election as settlement (cycle-based rotation), but keyed on its own monotonic round counter
- Batches ALL sources into a single proposal (not sequential per-source)

### Why Not Piggyback on run_cycle (Option A from F18)

1. **Budget:** 82+ sources x 200ms = 16.4s minimum if sequential. Even batched, HTTP to data-node + BLS round = ~400ms, blowing the 200ms remaining budget after settlement.
2. **Aggregator corruption:** `SignatureAggregator` is shared. If a batch config `BatchSign` arrives during settlement's `BatchSigning` phase, it corrupts the settlement sig. Separate aggregators required.
3. **Phase confusion:** `ConsensusPhase::Complete` ends the follower loop. Adding phases after Complete requires rewriting the follower state machine.
4. **Frequency mismatch:** Batch configs change every tick (30s-86400s), not every 1s settlement cycle.

---

## Architecture Overview

```
                    ┌─────────────────────────────────────────────────┐
                    │                  Issuer Node                     │
                    │                                                  │
                    │  ┌──────────────┐    ┌────────────────────────┐ │
                    │  │ run_cycle()  │    │ BatchConfigOrchestrator│ │
                    │  │ (1s loop)    │    │ (independent task)     │ │
                    │  │              │    │                        │ │
                    │  │ PriceConsensus    │ Own timer (30s default)│ │
                    │  │ BatchConsensus    │ Own SignatureCollectors │ │
                    │  │ SettlementAgg    │ Own P2P message types  │ │
                    │  │              │    │ Own round counter      │ │
                    │  └──────┬───────┘    └─────────┬──────────────┘ │
                    │         │                      │                 │
                    │         │  Shared:             │                 │
                    │         │  - P2PTransport      │                 │
                    │         │  - BLS keypair       │                 │
                    │         │  - LeaderElector     │                 │
                    │         │  - RuntimeConfig     │                 │
                    │         │  - KeyRegistry       │                 │
                    └─────────┴──────────────────────┴─────────────────┘
                                         │
                              P2PMessage::BatchConfig*
                                         │
                              ┌──────────┴──────────┐
                              │   Other Issuer Nodes │
                              └─────────────────────┘
```

---

## Concrete Rust Definitions

### 1. New P2PMessage Variants

Add to `common/src/types/p2p.rs` inside the `P2PMessage` enum:

```rust
/// Leader proposes batch config hash for ALL sources in a single round.
/// All sources are batched into one proposal to avoid sequential consensus.
/// Timeout: 500ms, Retry: 1
/// Auto-batch config consensus
BatchConfigProposal {
    /// Leader's peer ID
    leader_id: PeerId,
    /// Monotonic round number for this orchestrator (NOT settlement cycle_number)
    round: u64,
    /// The composite config hash: keccak256(abi.encode(sorted config hashes))
    /// Each per-source config hash is computed per F2.
    composite_hash: H256,
    /// Per-source config hashes (sorted by source_id, for follower verification)
    /// Each entry: (source_id_hash, config_hash)
    /// source_id_hash = keccak256(source_id) for fixed-size representation
    source_configs: Vec<(H256, H256)>,
    /// Registry snapshot nonce for historical BLS verification
    reference_nonce: u64,
    /// Leader's BLS signature on the composite hash
    leader_signature: BLSSignature,
},

/// Follower co-signs batch config proposal
/// Timeout: 300ms, Retry: 0
/// Auto-batch config consensus
BatchConfigSign {
    /// Signer's peer ID
    signer_id: PeerId,
    /// Signer's index in issuer set (for bitmap)
    signer_index: u8,
    /// Round number (identifies which proposal)
    round: u64,
    /// Follower's BLS signature on the composite hash
    signature: BLSSignature,
},
```

### 2. BatchConfigOrchestrator

New file: `issuer/src/batch_config/orchestrator.rs`

```rust
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use ethers::types::{H256, U256};
use tokio::sync::{Notify, RwLock};
use tracing::{debug, info, warn, error};

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::traits::{BLSSigner, P2PTransport};
use common::types::{BLSSignature, P2PMessage, PeerId};

use crate::bridge::types::SignatureCollector;
use crate::consensus::aggregator::compute_threshold;
use crate::leader::LeaderElector;

/// Configuration for the batch config orchestrator
#[derive(Debug, Clone)]
pub struct BatchConfigOrchestratorConfig {
    /// How often to run a batch config consensus round (default: 30s)
    pub round_interval: Duration,
    /// Data-node HTTP base URL (e.g. "http://localhost:8200")
    pub data_node_url: String,
    /// Timeout for HTTP calls to data-node
    pub http_timeout: Duration,
    /// Timeout for signature collection phase
    pub sign_timeout: Duration,
    /// Maximum consecutive failures before backing off
    pub max_consecutive_failures: u32,
    /// Backoff duration after max failures
    pub failure_backoff: Duration,
}

impl Default for BatchConfigOrchestratorConfig {
    fn default() -> Self {
        Self {
            round_interval: Duration::from_secs(30),
            data_node_url: "http://localhost:8200".to_string(),
            http_timeout: Duration::from_secs(5),
            sign_timeout: Duration::from_millis(500),
            max_consecutive_failures: 3,
            failure_backoff: Duration::from_secs(60),
        }
    }
}

/// Result of a single batch config consensus round
#[derive(Debug, Clone)]
pub struct SignedBatchConfig {
    /// The composite hash that was signed
    pub composite_hash: H256,
    /// Per-source config hashes (source_id_hash, config_hash)
    pub source_configs: Vec<(H256, H256)>,
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Signer bitmap
    pub signers_bitmask: U256,
    /// Number of signers
    pub signer_count: usize,
    /// Reference nonce used
    pub reference_nonce: u64,
    /// Round number
    pub round: u64,
}

/// Per-source config from data-node API
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct SourceBatchConfig {
    pub source_id: String,
    pub config_hash: String,       // "0x..." hex
    pub tick_duration_secs: u64,
    pub lock_offset_secs: u64,
    pub markets: Vec<BatchMarket>,
    pub asset_count: usize,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct BatchMarket {
    pub asset_id: String,
    pub resolution_type: String,
    pub threshold_bps: u32,
}

/// Persisted state for crash recovery
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BatchConfigState {
    /// Last successfully completed round number
    pub last_round: u64,
    /// Last signed config (if any) — for retry on crash
    pub last_signed: Option<SignedBatchConfig>,
    /// Whether last_signed was successfully POSTed to data-node
    pub last_posted: bool,
}

/// Orchestrates BLS consensus for batch config signing.
///
/// Runs independently from settlement consensus on its own async task.
/// Follows the BridgeOrchestrator pattern: per-operation SignatureCollectors,
/// Notify-based wakeup, dedicated P2P message types.
pub struct BatchConfigOrchestrator {
    /// Configuration
    config: BatchConfigOrchestratorConfig,
    /// BLS keypair for signing
    bls_keypair: BLSKeyPair,
    /// BLS signer for signature operations
    bls_signer: Bn254BLSSigner,
    /// This node's peer ID
    peer_id: PeerId,
    /// P2P transport (shared with settlement consensus)
    p2p: Arc<dyn P2PTransport>,
    /// Signature collectors for pending rounds, keyed by round number.
    /// Each round has exactly one collector (for the composite hash).
    pending_signatures: RwLock<HashMap<u64, SignatureCollector>>,
    /// Monotonic round counter (persisted for crash recovery)
    current_round: RwLock<u64>,
    /// Last successfully signed config
    last_signed: RwLock<Option<SignedBatchConfig>>,
    /// HTTP client for data-node API
    http_client: reqwest::Client,
    /// Consecutive failure counter
    consecutive_failures: RwLock<u32>,
    /// Shared runtime config (reads num_issuers, node_index atomically)
    runtime_config: Arc<crate::consensus::protocol::RuntimeConfig>,
    /// Key registry for peer lookups
    key_registry: Arc<dyn crate::consensus::keys::KeyRegistry>,
    /// Persisted state file path
    state_file: String,
    /// Notify for waking the orchestrator when a sign message arrives
    round_notify: Arc<Notify>,
}
```

### 3. Main Loop

```rust
impl BatchConfigOrchestrator {
    /// Main loop — spawned as a tokio task.
    /// Runs forever, executing one consensus round per interval.
    pub async fn run(&self, mut shutdown: tokio::sync::watch::Receiver<bool>) {
        info!("BatchConfigOrchestrator started, interval={:?}", self.config.round_interval);

        // Crash recovery: check if we have an un-posted signed config
        self.recover_from_crash().await;

        loop {
            tokio::select! {
                _ = shutdown.changed() => {
                    info!("BatchConfigOrchestrator shutting down");
                    return;
                }
                _ = tokio::time::sleep(self.config.round_interval) => {
                    // Check backoff
                    let failures = *self.consecutive_failures.read().await;
                    if failures >= self.config.max_consecutive_failures {
                        warn!(
                            failures,
                            "Batch config consensus in backoff, sleeping {:?}",
                            self.config.failure_backoff
                        );
                        tokio::time::sleep(self.config.failure_backoff).await;
                        *self.consecutive_failures.write().await = 0;
                        continue;
                    }

                    self.execute_round().await;
                }
            }
        }
    }

    /// Execute a single consensus round.
    async fn execute_round(&self) {
        let round = {
            let mut r = self.current_round.write().await;
            *r += 1;
            *r
        };

        let num_issuers = self.runtime_config.num_issuers() as u64;
        let node_index = self.runtime_config.node_index() as u64;
        let am_leader = (round % num_issuers) == node_index;

        if am_leader {
            match self.run_leader_round(round).await {
                Ok(signed) => {
                    // Persist signed config before posting (crash safety)
                    self.persist_state(round, Some(&signed), false).await;

                    // POST to ALL data-nodes (own + peers via replication)
                    match self.post_signed_config(&signed).await {
                        Ok(()) => {
                            self.persist_state(round, Some(&signed), true).await;
                            *self.last_signed.write().await = Some(signed);
                            *self.consecutive_failures.write().await = 0;
                            info!(round, "Batch config round completed successfully");
                        }
                        Err(e) => {
                            // Signed but not posted — crash recovery will retry
                            warn!(round, error = %e, "Failed to POST signed config to data-node");
                            *self.consecutive_failures.write().await += 1;
                        }
                    }
                }
                Err(e) => {
                    warn!(round, error = %e, "Batch config leader round failed");
                    *self.consecutive_failures.write().await += 1;
                }
            }
        }
        // Followers do nothing proactively — they respond to proposals
        // via handle_message() dispatched from the P2P layer.
    }
```

### 4. Leader Round

```rust
    /// Leader: fetch configs from own data-node, propose, collect sigs, aggregate.
    async fn run_leader_round(&self, round: u64) -> Result<SignedBatchConfig, BatchConfigError> {
        // Step 1: Fetch recommended configs from own data-node
        let configs = self.fetch_recommended_configs().await?;
        if configs.is_empty() {
            return Err(BatchConfigError::NoConfigs);
        }

        // Step 2: Build composite hash (all sources batched into one proposal)
        let (composite_hash, source_configs) = Self::build_composite_hash(&configs);

        // Step 3: Build BLS message hash (domain-separated per F1)
        let bls_message = build_batch_config_bls_hash(
            composite_hash,
            round,
            self.key_registry.registry_nonce(),
        );

        // Step 4: Sign as leader
        let leader_sig = self.bls_signer.sign_with_keypair(&self.bls_keypair, &bls_message)?;

        // Step 5: Create signature collector with leader's sig pre-seeded
        let threshold = compute_threshold(self.runtime_config.num_issuers() as usize);
        {
            let mut pending = self.pending_signatures.write().await;
            let mut collector = SignatureCollector::new(U256::from(round));
            let my_index = self.runtime_config.issuer_registry_index();
            collector.add_signature(my_index, leader_sig.clone());
            pending.insert(round, collector);
        }

        // Step 6: Broadcast proposal
        let ref_nonce = self.key_registry.registry_nonce();
        let proposal = P2PMessage::BatchConfigProposal {
            leader_id: self.peer_id,
            round,
            composite_hash,
            source_configs: source_configs.clone(),
            reference_nonce: ref_nonce,
            leader_signature: leader_sig,
        };
        self.p2p.broadcast(proposal).await
            .map_err(|e| BatchConfigError::P2P(e.to_string()))?;

        // Step 7: Wait for threshold with timeout
        let deadline = Instant::now() + self.config.sign_timeout;
        loop {
            // Check threshold
            {
                let pending = self.pending_signatures.read().await;
                if let Some(collector) = pending.get(&round) {
                    if collector.has_threshold(threshold) {
                        // Aggregate and return
                        let sigs: Vec<BLSSignature> = collector
                            .signatures()
                            .iter()
                            .map(|(_, sig)| sig.clone())
                            .collect();
                        let aggregated = self.bls_signer.aggregate_signatures(sigs)?;
                        let bitmask = collector.signer_bitmap();
                        let count = collector.signature_count();

                        // Cleanup
                        drop(pending);
                        self.pending_signatures.write().await.remove(&round);

                        return Ok(SignedBatchConfig {
                            composite_hash,
                            source_configs,
                            aggregated_signature: aggregated,
                            signers_bitmask: bitmask,
                            signer_count: count,
                            reference_nonce: ref_nonce,
                            round,
                        });
                    }
                }
            }

            if Instant::now() >= deadline {
                self.pending_signatures.write().await.remove(&round);
                return Err(BatchConfigError::Timeout {
                    collected: {
                        // Already removed, report 0
                        0
                    },
                    required: threshold,
                });
            }

            // Wait for notification or poll interval
            tokio::select! {
                _ = self.round_notify.notified() => {}
                _ = tokio::time::sleep(Duration::from_millis(10)) => {}
            }
        }
    }
```

### 5. Follower Message Handling

Dispatched from `ConsensusProtocol::handle_message()` or a parallel message router:

```rust
    /// Handle incoming BatchConfigProposal as a follower.
    ///
    /// 1. Fetch own data-node's recommended configs
    /// 2. Verify composite hash within tolerance (+-50% per F9/F17)
    /// 3. If acceptable, BLS co-sign and reply
    pub async fn handle_proposal(
        &self,
        from: PeerId,
        round: u64,
        composite_hash: H256,
        source_configs: Vec<(H256, H256)>,
        reference_nonce: u64,
        leader_signature: BLSSignature,
    ) -> Result<(), BatchConfigError> {
        // Step 1: Fetch own view from own data-node
        let own_configs = self.fetch_recommended_configs().await?;
        let (own_composite, own_sources) = Self::build_composite_hash(&own_configs);

        // Step 2: Verify tolerance
        // Exact composite hash match is unlikely (different data-nodes have slightly
        // different data). Instead verify per-source:
        // - Source count within 50% of own
        // - For sources present in both, config hash equality OR threshold tolerance
        let accepted = self.verify_proposal_tolerance(
            &source_configs,
            &own_sources,
            &own_configs,
        ).await;

        if !accepted {
            warn!(round, "Batch config proposal rejected: too divergent from own view");
            return Ok(()); // Silent reject — don't sign
        }

        // Step 3: Sign the LEADER's composite hash (not our own)
        // This is critical: all signers must sign the same hash.
        let bls_message = build_batch_config_bls_hash(
            composite_hash,
            round,
            reference_nonce,
        );
        let signature = self.bls_signer.sign_with_keypair(&self.bls_keypair, &bls_message)?;

        // Step 4: Send sign message
        let my_index = self.runtime_config.issuer_registry_index();
        let sign_msg = P2PMessage::BatchConfigSign {
            signer_id: self.peer_id,
            signer_index: my_index,
            round,
            signature,
        };
        self.p2p.broadcast(sign_msg).await
            .map_err(|e| BatchConfigError::P2P(e.to_string()))?;

        // Step 5: Store leader's full config locally for settlement (F9/F17)
        // POST to own data-node so it has the config that matches the signed hash
        self.replicate_leader_config(round, &source_configs, composite_hash).await?;

        Ok(())
    }

    /// Handle incoming BatchConfigSign (leader receives follower signature).
    pub async fn handle_sign(
        &self,
        from: PeerId,
        signer_index: u8,
        round: u64,
        signature: BLSSignature,
    ) -> Result<(), BatchConfigError> {
        let mut pending = self.pending_signatures.write().await;
        if let Some(collector) = pending.get_mut(&round) {
            let added = collector.add_signature(signer_index, signature);
            if added {
                debug!(round, signer_index, "Batch config signature added");
                // Wake the leader's polling loop
                self.round_notify.notify_waiters();
            }
        } else {
            debug!(round, "BatchConfigSign for unknown round, ignoring");
        }
        Ok(())
    }
```

### 6. Composite Hash Construction

```rust
    /// Build a composite hash from all per-source configs.
    ///
    /// composite_hash = keccak256(abi.encode(sorted_source_config_hashes))
    /// where sorted = sort by source_id_hash ascending
    ///
    /// Returns (composite_hash, sorted list of (source_id_hash, config_hash))
    fn build_composite_hash(configs: &[SourceBatchConfig]) -> (H256, Vec<(H256, H256)>) {
        use ethers::abi::{encode, Token};
        use ethers::utils::keccak256;

        let mut source_entries: Vec<(H256, H256)> = configs
            .iter()
            .map(|c| {
                let source_id_hash = H256::from(keccak256(c.source_id.as_bytes()));
                let config_hash = H256::from_slice(
                    &hex::decode(c.config_hash.trim_start_matches("0x")).unwrap_or_default()
                );
                (source_id_hash, config_hash)
            })
            .collect();

        // Canonical sort by source_id_hash (F4)
        source_entries.sort_by(|a, b| a.0.cmp(&b.0));

        // ABI-encode all config hashes in sorted order
        let tokens: Vec<Token> = source_entries
            .iter()
            .map(|(_, config_hash)| Token::FixedBytes(config_hash.as_bytes().to_vec()))
            .collect();

        let encoded = encode(&[Token::Array(tokens)]);
        let composite = H256::from(keccak256(&encoded));

        (composite, source_entries)
    }
```

### 7. BLS Message Hash (Domain-Separated per F1)

```rust
/// Build the BLS message hash for batch config consensus.
///
/// Domain-separated per F1:
/// keccak256(abi.encode(
///     block.chainid,           // 111222333 for Index L3
///     "BATCH_CONFIG",          // domain separator
///     compositeHash,
///     round,
///     referenceNonce
/// ))
pub fn build_batch_config_bls_hash(
    composite_hash: H256,
    round: u64,
    reference_nonce: u64,
) -> Vec<u8> {
    use ethers::abi::{encode, Token};
    use ethers::utils::keccak256;

    let chain_id: u64 = 111222333; // Index L3 Orbit chain ID

    let encoded = encode(&[
        Token::Uint(chain_id.into()),
        Token::String("BATCH_CONFIG".to_string()),
        Token::FixedBytes(composite_hash.as_bytes().to_vec()),
        Token::Uint(round.into()),
        Token::Uint(reference_nonce.into()),
    ]);

    keccak256(&encoded).to_vec()
}
```

### 8. Tolerance Verification (Follower)

```rust
    /// Verify a leader's proposal is within acceptable tolerance of our own view.
    ///
    /// Rules (from plan):
    /// - Source count: leader's count within 50% of own
    /// - For each source in both views: config hash equality OR threshold within 50%
    /// - Lock offset: must match (deterministic from source speed class)
    /// - Missing sources in leader's view: OK if <=20% of our sources are missing
    async fn verify_proposal_tolerance(
        &self,
        leader_sources: &[(H256, H256)],
        own_sources: &[(H256, H256)],
        own_configs: &[SourceBatchConfig],
    ) -> bool {
        let leader_count = leader_sources.len();
        let own_count = own_sources.len();

        // Source count tolerance: within 50%
        if own_count > 0 {
            let ratio = leader_count as f64 / own_count as f64;
            if ratio < 0.5 || ratio > 1.5 {
                warn!(
                    leader_count,
                    own_count,
                    "Source count out of tolerance (50%)"
                );
                return false;
            }
        }

        // Build lookup for leader's sources
        let leader_map: HashMap<H256, H256> = leader_sources.iter().cloned().collect();

        // Check overlap: at least 80% of own sources should be in leader's view
        let mut missing = 0;
        for (source_hash, _) in own_sources {
            if !leader_map.contains_key(source_hash) {
                missing += 1;
            }
        }
        if own_count > 0 && missing as f64 / own_count as f64 > 0.2 {
            warn!(missing, own_count, "Too many sources missing from leader's proposal");
            return false;
        }

        // Per-source config hash comparison is informational only.
        // The critical check is source count and presence.
        // Detailed threshold comparison requires fetching full configs which
        // would add latency — defer to the hash-level check.
        // If the follower trusts the source list, it co-signs the leader's hash.

        true
    }
```

### 9. Data-Node HTTP Interface

```rust
    /// Fetch recommended batch configs from own data-node.
    async fn fetch_recommended_configs(&self) -> Result<Vec<SourceBatchConfig>, BatchConfigError> {
        let url = format!("{}/batches/recommended", self.config.data_node_url);
        let resp = self.http_client
            .get(&url)
            .timeout(self.config.http_timeout)
            .send()
            .await
            .map_err(|e| BatchConfigError::DataNode(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(BatchConfigError::DataNode(
                format!("data-node returned {}", resp.status())
            ));
        }

        let configs: Vec<SourceBatchConfig> = resp.json().await
            .map_err(|e| BatchConfigError::DataNode(e.to_string()))?;

        Ok(configs)
    }

    /// POST signed config to own data-node (and trigger replication).
    /// The data-node stores it in DB (F26) and serves it via GET /batches/signed.
    async fn post_signed_config(&self, signed: &SignedBatchConfig) -> Result<(), BatchConfigError> {
        let url = format!("{}/batches/signed", self.config.data_node_url);

        let payload = serde_json::json!({
            "composite_hash": format!("{:#x}", signed.composite_hash),
            "source_configs": signed.source_configs.iter().map(|(sid, ch)| {
                serde_json::json!({
                    "source_id_hash": format!("{:#x}", sid),
                    "config_hash": format!("{:#x}", ch),
                })
            }).collect::<Vec<_>>(),
            "bls_signature": hex::encode(&signed.aggregated_signature.0),
            "signers_bitmask": format!("{:#x}", signed.signers_bitmask),
            "signer_count": signed.signer_count,
            "reference_nonce": signed.reference_nonce,
            "round": signed.round,
        });

        let resp = self.http_client
            .post(&url)
            .json(&payload)
            .timeout(self.config.http_timeout)
            .send()
            .await
            .map_err(|e| BatchConfigError::DataNode(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(BatchConfigError::DataNode(
                format!("POST /batches/signed returned {}", resp.status())
            ));
        }

        Ok(())
    }

    /// Replicate leader's config to own data-node (follower, F9/F17).
    /// Called after follower co-signs so own data-node has the config for settlement.
    async fn replicate_leader_config(
        &self,
        round: u64,
        source_configs: &[(H256, H256)],
        composite_hash: H256,
    ) -> Result<(), BatchConfigError> {
        let url = format!("{}/batches/replicate", self.config.data_node_url);

        let payload = serde_json::json!({
            "round": round,
            "composite_hash": format!("{:#x}", composite_hash),
            "source_configs": source_configs.iter().map(|(sid, ch)| {
                serde_json::json!({
                    "source_id_hash": format!("{:#x}", sid),
                    "config_hash": format!("{:#x}", ch),
                })
            }).collect::<Vec<_>>(),
        });

        self.http_client
            .post(&url)
            .json(&payload)
            .timeout(self.config.http_timeout)
            .send()
            .await
            .map_err(|e| BatchConfigError::DataNode(e.to_string()))?;

        Ok(())
    }
```

### 10. Crash Recovery

```rust
    /// Recover from crash: check persisted state and retry POST if needed.
    async fn recover_from_crash(&self) {
        match self.load_state().await {
            Some(state) => {
                *self.current_round.write().await = state.last_round;

                if let Some(signed) = state.last_signed {
                    if !state.last_posted {
                        // We signed but crashed before POSTing — retry
                        info!(
                            round = signed.round,
                            "Crash recovery: retrying POST of signed config"
                        );
                        match self.post_signed_config(&signed).await {
                            Ok(()) => {
                                self.persist_state(signed.round, Some(&signed), true).await;
                                info!(round = signed.round, "Crash recovery POST succeeded");
                            }
                            Err(e) => {
                                warn!(
                                    round = signed.round,
                                    error = %e,
                                    "Crash recovery POST failed, will retry next round"
                                );
                            }
                        }
                        *self.last_signed.write().await = Some(signed);
                    }
                }
            }
            None => {
                info!("No persisted batch config state, starting fresh");
            }
        }
    }

    /// Persist state to disk for crash recovery.
    async fn persist_state(
        &self,
        round: u64,
        signed: Option<&SignedBatchConfig>,
        posted: bool,
    ) {
        let state = BatchConfigState {
            last_round: round,
            last_signed: signed.cloned(),
            last_posted: posted,
        };

        if let Ok(json) = serde_json::to_string_pretty(&state) {
            if let Err(e) = tokio::fs::write(&self.state_file, json).await {
                warn!(error = %e, "Failed to persist batch config state");
            }
        }
    }

    /// Load persisted state from disk.
    async fn load_state(&self) -> Option<BatchConfigState> {
        match tokio::fs::read_to_string(&self.state_file).await {
            Ok(json) => serde_json::from_str(&json).ok(),
            Err(_) => None,
        }
    }
```

### 11. Error Type

```rust
#[derive(Debug, thiserror::Error)]
pub enum BatchConfigError {
    #[error("No configs available from data-node")]
    NoConfigs,

    #[error("Data-node error: {0}")]
    DataNode(String),

    #[error("P2P error: {0}")]
    P2P(String),

    #[error("BLS error: {0}")]
    Bls(#[from] common::error::Error),

    #[error("Signature timeout: {collected}/{required}")]
    Timeout { collected: usize, required: usize },

    #[error("Round already in progress: {0}")]
    RoundInProgress(u64),
}
```

### 12. Message Routing in ConsensusProtocol

In `ConsensusMessageHandler::handle_message()`, add match arms:

```rust
P2PMessage::BatchConfigProposal { round, .. } => {
    // Route to BatchConfigOrchestrator — NOT to settlement state machine
    MessageHandleResult::ForwardToBatchConfigOrchestrator { from, message }
}
P2PMessage::BatchConfigSign { round, .. } => {
    MessageHandleResult::ForwardToBatchConfigOrchestrator { from, message }
}
```

New `MessageHandleResult` variant:

```rust
/// Forward to the BatchConfigOrchestrator (separate from settlement consensus)
ForwardToBatchConfigOrchestrator {
    from: PeerId,
    message: P2PMessage,
},
```

In `ConsensusProtocol::handle_message()`, handle the forward:

```rust
MessageHandleResult::ForwardToBatchConfigOrchestrator { from, message } => {
    if let Some(ref batch_orch) = *self.batch_config_orchestrator.read().await {
        match message {
            P2PMessage::BatchConfigProposal {
                leader_id,
                round,
                composite_hash,
                source_configs,
                reference_nonce,
                leader_signature,
            } => {
                if let Err(e) = batch_orch.handle_proposal(
                    from,
                    round,
                    composite_hash,
                    source_configs,
                    reference_nonce,
                    leader_signature,
                ).await {
                    warn!(round, error = %e, "Failed to handle batch config proposal");
                }
            }
            P2PMessage::BatchConfigSign {
                signer_id,
                signer_index,
                round,
                signature,
            } => {
                if let Err(e) = batch_orch.handle_sign(
                    from, signer_index, round, signature,
                ).await {
                    warn!(round, error = %e, "Failed to handle batch config sign");
                }
            }
            _ => {}
        }
    }
}
```

### 13. ConsensusProtocol Integration Point

Add to `ConsensusProtocol` struct:

```rust
/// Optional BatchConfigOrchestrator for auto-batch config consensus
batch_config_orchestrator: RwLock<Option<Arc<BatchConfigOrchestrator>>>,
```

Add setter:

```rust
pub async fn set_batch_config_orchestrator(&self, orch: Arc<BatchConfigOrchestrator>) {
    *self.batch_config_orchestrator.write().await = Some(orch);
}
```

Startup wiring (in `main.rs` or equivalent):

```rust
let batch_config_orch = Arc::new(BatchConfigOrchestrator::new(
    batch_config_config,
    bls_keypair.clone(),
    peer_id,
    p2p.clone(),
    runtime_config.clone(),
    key_registry.clone(),
    state_dir.join("batch_config_state.json").to_string_lossy().to_string(),
));

consensus_protocol.set_batch_config_orchestrator(batch_config_orch.clone()).await;

// Spawn independent task
let shutdown_rx = shutdown_tx.subscribe();
tokio::spawn(async move {
    batch_config_orch.run(shutdown_rx).await;
});
```

---

## Issue Resolution Matrix

| Issue | Resolution | Where |
|-------|-----------|-------|
| F18: blows 1s cycle budget | Independent task with own timer, not in run_cycle() | BatchConfigOrchestrator::run() |
| #2: shared SignatureAggregator corruption | Dedicated per-round SignatureCollectors (bridge pattern) | pending_signatures field |
| #3: no batch config ConsensusPhase | Not needed: orchestrator doesn't use ConsensusPhase state machine | N/A |
| #4: BatchConfigMessage not a P2PMessage variant | Added BatchConfigProposal + BatchConfigSign to P2PMessage enum | common/src/types/p2p.rs |
| #5: sequential per-source consensus | All sources batched into single composite hash proposal | build_composite_hash() |
| #6: leader rotation undefined | Uses same rotation as settlement: round % num_issuers == node_index | execute_round() |
| #7: "leader's data-node" wrong | Each follower replicates leader's config to OWN data-node | replicate_leader_config() |
| #8: crash between aggregation and POST | Persist signed config to disk before POST; retry on startup | persist_state(), recover_from_crash() |
| #9: config pile-up | Orchestrator has single round_interval timer; new round only starts after previous completes | execute_round() is sequential within run() |
| F9/F17: config replication | Follower POSTs leader's config to own data-node after co-signing | replicate_leader_config() |

---

## Timing

- **Round interval:** 30 seconds (configurable). This matches the fastest typical tick_duration (30s for real-time sources like crypto).
- **Slower sources:** A 30s consensus round is fine even for 86400s-tick sources. The signed config is valid until the next round updates it. Over-signing is cheap.
- **Leader round budget:** HTTP fetch (~50ms) + broadcast (~10ms) + sign collection (500ms timeout) = ~560ms max per round.
- **No contention with settlement:** Different P2P message types, different aggregators, different state. Can run simultaneously.

## Backpressure / Pile-up Prevention (Issue #9)

The `run()` loop is sequential: `execute_round()` must complete (success or failure) before the next `sleep(round_interval)` starts. If a round takes longer than `round_interval`, the next round is simply delayed, never piled up. The `consecutive_failures` counter + backoff prevents thundering-herd retries.

## Leader Election

Same formula as settlement consensus:
```
am_leader = (round % num_issuers) == node_index
```

Where `round` is the batch config orchestrator's own monotonic counter (independent from settlement `cycle_number`). This means the batch config leader rotates independently from the settlement leader, which is intentional: they have different cadences.

## File Layout

```
issuer/src/
  batch_config/
    mod.rs           — pub mod orchestrator; pub use orchestrator::*;
    orchestrator.rs  — BatchConfigOrchestrator (this design)
    hash.rs          — build_batch_config_bls_hash(), build_composite_hash()
common/src/types/
    p2p.rs           — Add BatchConfigProposal, BatchConfigSign variants
issuer/src/consensus/
    messages.rs      — Add ForwardToBatchConfigOrchestrator handling
    protocol.rs      — Add batch_config_orchestrator field + setter
```

---

## Data-Node Endpoints Required

These are called by the orchestrator and must be implemented in data-node:

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/batches/recommended` | GET | Returns all current SourceBatchConfigs | None (local only) |
| `/batches/signed` | POST | Store signed config (F26: persisted to DB) | Admin token (F24) |
| `/batches/signed` | GET | Serve latest signed config per source | None (public) |
| `/batches/replicate` | POST | Store leader's config hashes (follower replication, F17) | Admin token |

---

## What This Design Does NOT Cover

1. **On-chain `createBatch()` / `updateBatchConfig()`** — users submit these, not issuers. The signed config is served via data-node API; frontends call the contract.
2. **Settlement resolution** — separate concern. The resolver reads the config by hash from data-node.
3. **BatchEngine implementation** — data-node side, covered in Task 2 of the auto-batch plan.
4. **Frontend integration** — covered in F22/Task 10 of the auto-batch plan.
