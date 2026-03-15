//! Registry Sync Module (Story 8.4)
//!
//! This module provides the RegistrySyncState cache and handler for serving
//! BLS-signed registry state proofs via GET /api/registry-sync endpoint.
//!
//! ## Architecture
//!
//! 1. **RegistrySyncState**: Cached state containing nonce, aggregated pubkey,
//!    active count, threshold, state hash, BLS signature, and issuer ID.
//!
//! 2. **RegistrySyncHandler**: Watches for RegistryStateChanged events and
//!    updates the cached state with fresh BLS signatures.
//!
//! 3. **HTTP Endpoint**: GET /api/registry-sync returns the cached state as JSON
//!    (or 404 if no state is available yet).
//!
//! ## Message Format (AC3)
//!
//! BLS signature is computed over:
//! `keccak256(abi.encode("REGISTRY_SYNC", block.chainid, address(this), nonce, newAggPubkey, activeCount, threshold))`
//!
//! This matches the Solidity verification in MirrorIssuerRegistry.sol.
//! The chain_id and mirror_address parameters bind the message to a specific
//! chain and contract, preventing cross-chain replay attacks.

use common::bls::{aggregate_pubkeys, BLSKeyPair, Bn254BLSSigner};
use common::types::{BLSPublicKey, Issuer};
use common::Error as CommonError;
use ethers::types::H256;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;

use crate::consensus::ConfigUpdate;

/// Cached registry sync state for serving via HTTP endpoint
///
/// This struct contains all the data needed for a registry sync proof.
/// It is updated whenever a new RegistryStateChanged event is observed.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RegistrySyncState {
    /// Monotonically increasing nonce from L3 IssuerRegistry
    pub nonce: u64,

    /// New aggregated G2 public key (128 bytes)
    /// Computed off-chain by summing all active issuer G2 keys
    #[serde(with = "hex_bytes")]
    pub aggregated_pubkey: Vec<u8>,

    /// Number of currently active issuers
    pub active_count: u64,

    /// BLS signature threshold (e.g., 2 for 2/3 consensus)
    pub threshold: u64,

    /// keccak256 of all active issuer pubkeys concatenated in order
    /// This matches L3 IssuerRegistry.getRegistryStateHash()
    #[serde(with = "hex_h256")]
    pub state_hash: H256,

    /// BLS signature over the sync message (64 bytes G1 point)
    #[serde(with = "hex_bytes")]
    pub bls_signature: Vec<u8>,

    /// Issuer ID that produced this signature (0-19)
    pub issuer_id: u8,
}

/// Thread-safe cache for RegistrySyncState
pub type RegistrySyncCache = Arc<RwLock<Option<RegistrySyncState>>>;

/// Create a new empty RegistrySyncCache
pub fn new_registry_sync_cache() -> RegistrySyncCache {
    Arc::new(RwLock::new(None))
}

/// Error type for registry sync operations
#[derive(Debug, Clone, Error)]
pub enum RegistrySyncError {
    #[error("no active issuers found")]
    NoActiveIssuers,

    #[error("failed to aggregate pubkeys: {0}")]
    AggregationFailed(String),

    #[error("BLS signing failed: {0}")]
    SigningFailed(String),

    #[error("invalid pubkey length: expected 128 bytes, got {0}")]
    InvalidPubkeyLength(usize),

    #[error("chain provider error: {0}")]
    ProviderError(String),

    #[error("failed to fetch events: {0}")]
    EventFetchError(String),

    #[error("failed to fetch issuer data: {0}")]
    IssuerFetchError(String),
}

impl From<CommonError> for RegistrySyncError {
    fn from(err: CommonError) -> Self {
        RegistrySyncError::AggregationFailed(err.to_string())
    }
}

/// Compute aggregated G2 public key from active issuers (Task 3, AC #6)
///
/// This function sums all active issuer G2 public keys using point addition,
/// matching the on-chain algorithm in IssuerRegistry.getAggregatedPubkey().
///
/// # Arguments
/// * `issuers` - List of all issuers (will filter for active ones)
///
/// # Returns
/// The aggregated G2 public key as 128 bytes
///
/// # Errors
/// Returns error if no active issuers or aggregation fails
pub fn compute_aggregated_pubkey(issuers: &[Issuer]) -> Result<Vec<u8>, RegistrySyncError> {
    // Filter only active issuers (status == 1)
    let active_pubkeys: Vec<BLSPublicKey> = issuers
        .iter()
        .filter(|i| i.is_active())
        .map(|i| BLSPublicKey(i.bls_pubkey.to_vec()))
        .collect();

    if active_pubkeys.is_empty() {
        return Err(RegistrySyncError::NoActiveIssuers);
    }

    // Use the common aggregate_pubkeys function
    let aggregated = aggregate_pubkeys(&active_pubkeys)?;

    Ok(aggregated.0)
}

/// Sign the registry sync message with BLS keypair (Task 4, AC #3)
///
/// Signs the pre-computed message hash using the issuer's BLS private key.
/// The signature can be aggregated with other issuers' signatures for
/// threshold verification on MirrorIssuerRegistry.
///
/// # Arguments
/// * `keypair` - The issuer's BLS keypair
/// * `message_hash` - The 32-byte message hash from `build_registry_sync_message_hash`
///
/// # Returns
/// The BLS signature as 64 bytes (G1 point)
pub fn sign_registry_sync_message(
    keypair: &BLSKeyPair,
    message_hash: &[u8; 32],
) -> Result<Vec<u8>, RegistrySyncError> {
    let signer = Bn254BLSSigner::new();
    let signature = signer
        .sign_message_hash(keypair, message_hash)
        .map_err(|e| RegistrySyncError::SigningFailed(e.to_string()))?;
    Ok(signature.0)
}

/// Compute the BLS threshold for consensus (strict BFT: floor(2n/3) + 1)
///
/// For n active issuers, threshold = floor(2n/3) + 1.
/// This is the standard BFT threshold tolerating floor(n/3) Byzantine faults.
///
/// Examples:
/// - 3 issuers: threshold = 3 (all must sign — can't tolerate any fault with only 3 nodes)
/// - 4 issuers: threshold = 3
/// - 5 issuers: threshold = 4
/// - 6 issuers: threshold = 5
/// - 20 issuers: threshold = 14
///
/// **IMPORTANT**: This threshold value is embedded in the BLS-signed message.
/// MirrorIssuerRegistry.sol (Story 8.2) must use the same formula to verify
/// that enough signatures were collected before accepting a sync update.
pub fn compute_threshold(active_count: u64) -> u64 {
    if active_count == 0 {
        return 0;
    }
    // BFT: ceil(2n/3)
    (active_count * 2 + 2) / 3
}

// ============================================================================
// RegistrySyncHandler: Event watcher that updates cached sync state (Task 5)
// ============================================================================

use crate::bootstrap::generate_peer_id;
use crate::chain::events::RegistryStateChangedEvent;
use common::traits::ChainReader;
use ethers::prelude::*;
use tracing::{debug, error, info, warn};

/// Configuration for RegistrySyncHandler
#[derive(Debug, Clone)]
pub struct RegistrySyncConfig {
    /// L3 IssuerRegistry contract address
    pub issuer_registry_address: Address,
    /// Polling interval in milliseconds
    pub poll_interval_ms: u64,
    /// Maximum blocks to query in a single getLogs request
    pub max_block_range: u64,
    /// How many blocks back to scan on first startup (before any checkpoint).
    /// Must be large enough to catch the initial RegistryStateChanged event.
    /// Default: 86_400 blocks (~24h at 1s blocks) for downtime tolerance.
    pub initial_scan_blocks: u64,
}

impl Default for RegistrySyncConfig {
    fn default() -> Self {
        Self {
            issuer_registry_address: Address::zero(),
            poll_interval_ms: 5_000, // 5 seconds
            max_block_range: 1_000,
            initial_scan_blocks: 86_400, // 24h downtime tolerance at 1s blocks
        }
    }
}

/// Handler for watching RegistryStateChanged events and updating sync cache
///
/// This handler polls L3 IssuerRegistry for RegistryStateChanged events,
/// then updates the RegistrySyncCache with fresh BLS-signed proofs.
///
/// ## Workflow (AC #5)
/// 1. Poll for RegistryStateChanged events in block range
/// 2. For each event with higher nonce than cached:
///    a. Fetch all active issuers from IssuerRegistry
///    b. Compute aggregated G2 pubkey off-chain
///    c. Build message hash and BLS-sign it
///    d. Update cached RegistrySyncState
pub struct RegistrySyncHandler<M: Middleware> {
    /// Provider for L3 chain
    provider: Arc<M>,
    /// Configuration
    config: RegistrySyncConfig,
    /// Chain reader for fetching issuer data
    chain_reader: Arc<dyn ChainReader>,
    /// BLS keypair for signing
    bls_keypair: BLSKeyPair,
    /// Issuer ID (0-19) — used for RegistrySyncState.issuer_id in BLS signing
    issuer_id: u8,
    /// On-chain issuer ID from IssuerRegistry (1-based). Used to compute
    /// node_index (dense rank among active issuers) and issuer_registry_index
    /// (for signer bitmaps) when pushing ConfigUpdate.
    on_chain_issuer_id: u64,
    /// Cache to update
    cache: RegistrySyncCache,
    /// Event topic hash
    event_topic: H256,
    /// Last processed block number
    last_block: u64,
    /// Optional key registry for runtime updates on issuer join/leave
    key_registry: Option<Arc<crate::consensus::InMemoryKeyRegistry>>,
    /// Optional shared cell for pushing consensus config updates
    pending_config_update: Option<Arc<RwLock<Option<ConfigUpdate>>>>,
    /// Chain ID for chain-bound message hashing (prevents cross-chain replay)
    chain_id: u64,
    /// Mirror contract address for chain-bound message hashing
    mirror_address: Address,
}

impl<M: Middleware + 'static> RegistrySyncHandler<M> {
    /// Create a new RegistrySyncHandler
    ///
    /// # Arguments
    /// * `provider` - L3 chain provider
    /// * `config` - RegistrySyncConfig
    /// * `chain_reader` - For fetching issuer data
    /// * `bls_keypair` - BLS keypair for signing
    /// * `issuer_id` - Legacy 0-based index (used for RegistrySyncState)
    /// * `on_chain_issuer_id` - On-chain issuer ID from IssuerRegistry (for computing indices)
    /// * `cache` - RegistrySyncCache to update
    /// * `chain_id` - Chain ID for chain-bound message hashing (prevents cross-chain replay)
    /// * `mirror_address` - Mirror contract address for chain-bound message hashing
    pub fn new(
        provider: Arc<M>,
        config: RegistrySyncConfig,
        chain_reader: Arc<dyn ChainReader>,
        bls_keypair: BLSKeyPair,
        issuer_id: u8,
        on_chain_issuer_id: u64,
        cache: RegistrySyncCache,
        chain_id: u64,
        mirror_address: Address,
    ) -> Self {
        use crate::chain::events::REGISTRY_STATE_CHANGED_SIGNATURE;
        let event_topic = H256::from_slice(&ethers::utils::keccak256(
            REGISTRY_STATE_CHANGED_SIGNATURE,
        ));

        Self {
            provider,
            config,
            chain_reader,
            bls_keypair,
            issuer_id,
            on_chain_issuer_id,
            cache,
            event_topic,
            last_block: 0,
            key_registry: None,
            pending_config_update: None,
            chain_id,
            mirror_address,
        }
    }

    /// Set key registry for runtime updates on issuer join/leave
    pub fn with_key_registry(
        mut self,
        registry: Arc<crate::consensus::InMemoryKeyRegistry>,
    ) -> Self {
        self.key_registry = Some(registry);
        self
    }

    /// Set shared config update cell for pushing consensus parameter changes
    pub fn with_pending_config_update(
        mut self,
        cell: Arc<RwLock<Option<ConfigUpdate>>>,
    ) -> Self {
        self.pending_config_update = Some(cell);
        self
    }

    /// Get the current block number
    async fn get_block_number(&self) -> Result<u64, RegistrySyncError> {
        self.provider
            .get_block_number()
            .await
            .map(|n| n.as_u64())
            .map_err(|e| RegistrySyncError::ProviderError(format!("Failed to get block number: {}", e)))
    }

    /// Poll for RegistryStateChanged events in a block range
    pub async fn poll_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<RegistryStateChangedEvent>, RegistrySyncError> {
        if from_block > to_block {
            return Ok(Vec::new());
        }

        debug!(
            from_block,
            to_block,
            issuer_registry = ?self.config.issuer_registry_address,
            "Polling for RegistryStateChanged events"
        );

        let filter = Filter::new()
            .address(self.config.issuer_registry_address)
            .topic0(self.event_topic)
            .from_block(from_block)
            .to_block(to_block);

        let logs = self.provider
            .get_logs(&filter)
            .await
            .map_err(|e| RegistrySyncError::EventFetchError(format!("Failed to get logs: {}", e)))?;

        debug!(count = logs.len(), "Retrieved RegistryStateChanged logs");

        let mut events = Vec::with_capacity(logs.len());
        for log in logs {
            match RegistryStateChangedEvent::from_log(&log) {
                Ok(event) => {
                    debug!(
                        nonce = event.nonce,
                        active_count = event.active_count,
                        block = event.block_number,
                        "Parsed RegistryStateChanged event"
                    );
                    events.push(event);
                }
                Err(e) => {
                    warn!(
                        error = %e,
                        tx_hash = ?log.transaction_hash,
                        "Failed to parse RegistryStateChanged event"
                    );
                }
            }
        }

        // Sort by nonce ascending
        events.sort_by_key(|e| e.nonce);

        Ok(events)
    }

    /// Process a RegistryStateChanged event and update the cache
    ///
    /// 1. Fetch all active issuers
    /// 2. Compute aggregated pubkey
    /// 3. Build and sign message
    /// 4. Update cache if nonce is higher
    pub async fn process_event(
        &self,
        event: &RegistryStateChangedEvent,
    ) -> Result<(), RegistrySyncError> {
        // Check if we need to process this event
        {
            let guard = self.cache.read().await;
            if let Some(ref current) = *guard {
                if event.nonce <= current.nonce {
                    debug!(
                        event_nonce = event.nonce,
                        cached_nonce = current.nonce,
                        "Skipping event with lower/equal nonce"
                    );
                    return Ok(());
                }
            }
        }

        info!(
            nonce = event.nonce,
            active_count = event.active_count,
            "Processing RegistryStateChanged event"
        );

        // Fetch all active issuers from chain
        let issuers = self.chain_reader
            .get_issuer_registry()
            .await
            .map_err(|e| RegistrySyncError::IssuerFetchError(format!("Failed to fetch issuers: {}", e)))?;

        // Verify active count matches event
        let active_issuers: Vec<_> = issuers.iter().filter(|i| i.is_active()).collect();
        if active_issuers.len() as u64 != event.active_count {
            warn!(
                chain_active = active_issuers.len(),
                event_active = event.active_count,
                "Active issuer count mismatch, using chain data"
            );
        }

        // Update key registry if available (runtime auto-update on issuer join/leave)
        if let Some(ref key_registry) = self.key_registry {
            use common::types::BLSPublicKey;

            for issuer in issuers.iter() {
                // Use generate_peer_id with the on-chain issuer ID for consistency
                // with bootstrap (which also uses generate_peer_id).
                // The enumerate() index is a dense index that diverges from on-chain
                // IDs after any issuer removal.
                let peer_id = generate_peer_id(issuer.id as u32);

                if issuer.is_active() {
                    let pubkey = BLSPublicKey(issuer.bls_pubkey.to_vec());
                    if let Err(e) = key_registry.register(peer_id, pubkey) {
                        warn!(issuer_id = issuer.id, error = %e, "Failed to update key registry");
                    }
                } else {
                    let _ = key_registry.unregister(&peer_id);
                }
            }
            // Update the registry nonce to match the on-chain event
            key_registry.set_registry_nonce(event.nonce);

            debug!(
                active = active_issuers.len(),
                registry_nonce = event.nonce,
                "Updated InMemoryKeyRegistry from chain"
            );
        }

        // Push consensus config update if cell is available
        let active_count = active_issuers.len() as u64;
        let threshold = compute_threshold(active_count);
        if let Some(ref config_cell) = self.pending_config_update {
            // Check if this node is still in the active set
            let my_id = self.on_chain_issuer_id;
            let is_active = active_issuers.iter().any(|i| i.id == my_id);

            if !is_active {
                error!(
                    on_chain_issuer_id = my_id,
                    active_count,
                    "This node is no longer in the active issuer set! \
                     It was removed or deactivated. Skipping config update — \
                     node should be shut down gracefully."
                );
                // Do NOT push a config update — the node cannot participate.
                // A future phase will trigger graceful shutdown here.
            } else {
                // Compute dense node_index: count of active issuers with ID < ours
                let node_index = active_issuers
                    .iter()
                    .filter(|i| i.id < my_id)
                    .count() as u8;

                // issuer_registry_index = our on-chain ID (for signer bitmaps)
                let issuer_registry_index = my_id as u8;

                let update = ConfigUpdate {
                    active_count: active_count as u8,
                    threshold: threshold as usize,
                    node_index,
                    issuer_registry_index,
                };

                info!(
                    active_count,
                    threshold,
                    node_index,
                    issuer_registry_index,
                    "Pushed consensus config update"
                );

                let mut guard = config_cell.write().await;
                *guard = Some(update);
            }
        }

        // Compute aggregated pubkey
        let aggregated_pubkey = compute_aggregated_pubkey(&issuers)?;

        // Build message hash and sign (chain-bound via chain_id + mirror_address)
        let message_hash = build_registry_sync_message_hash(
            self.chain_id,
            self.mirror_address,
            event.nonce,
            &aggregated_pubkey,
            active_count,
            threshold,
        );

        let bls_signature = sign_registry_sync_message(&self.bls_keypair, &message_hash)?;

        // Create new state
        let new_state = RegistrySyncState::new(
            event.nonce,
            aggregated_pubkey,
            active_count,
            threshold,
            event.state_hash,
            bls_signature,
            self.issuer_id,
        );

        // Validate before caching
        if let Err(e) = new_state.validate() {
            error!(error = e, "Generated invalid RegistrySyncState");
            return Err(RegistrySyncError::AggregationFailed(e.to_string()));
        }

        // Update cache
        {
            let mut guard = self.cache.write().await;
            *guard = Some(new_state);
        }

        info!(
            nonce = event.nonce,
            active_count,
            threshold,
            issuer_id = self.issuer_id,
            "Updated RegistrySyncState cache"
        );

        Ok(())
    }

    /// Run a single poll cycle
    ///
    /// Returns the new last_block value
    pub async fn poll_once(&mut self) -> Result<u64, RegistrySyncError> {
        let current_block = self.get_block_number().await?;

        // Calculate block range
        let from_block = if self.last_block == 0 {
            // On first run, scan back initial_scan_blocks to catch the initial event
            current_block.saturating_sub(self.config.initial_scan_blocks)
        } else {
            self.last_block + 1
        };

        let to_block = std::cmp::min(
            current_block,
            from_block + self.config.max_block_range,
        );

        if from_block > to_block {
            return Ok(self.last_block);
        }

        // Poll for events
        let events = self.poll_events(from_block, to_block).await?;

        // Process each event
        for event in &events {
            if let Err(e) = self.process_event(event).await {
                warn!(
                    nonce = event.nonce,
                    error = %e,
                    "Failed to process RegistryStateChanged event"
                );
            }
        }

        self.last_block = to_block;
        Ok(to_block)
    }

    /// Run the handler in a loop until shutdown signal
    ///
    /// Polls for events and updates the cache continuously.
    pub async fn run(&mut self, shutdown: Arc<std::sync::atomic::AtomicBool>) {
        info!(
            issuer_registry = ?self.config.issuer_registry_address,
            poll_interval_ms = self.config.poll_interval_ms,
            issuer_id = self.issuer_id,
            "Starting RegistrySyncHandler"
        );

        loop {
            if shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                info!("RegistrySyncHandler shutting down");
                break;
            }

            match self.poll_once().await {
                Ok(block) => {
                    debug!(last_block = block, "Poll cycle complete");
                }
                Err(e) => {
                    warn!(error = %e, "Poll cycle failed");
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(
                self.config.poll_interval_ms,
            ))
            .await;
        }
    }
}

impl RegistrySyncState {
    /// Create a new RegistrySyncState
    pub fn new(
        nonce: u64,
        aggregated_pubkey: Vec<u8>,
        active_count: u64,
        threshold: u64,
        state_hash: H256,
        bls_signature: Vec<u8>,
        issuer_id: u8,
    ) -> Self {
        Self {
            nonce,
            aggregated_pubkey,
            active_count,
            threshold,
            state_hash,
            bls_signature,
            issuer_id,
        }
    }

    /// Check if this state is newer than another based on nonce
    pub fn is_newer_than(&self, other: &RegistrySyncState) -> bool {
        self.nonce > other.nonce
    }

    /// Validate that the state has reasonable values
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.nonce == 0 {
            return Err("nonce cannot be zero");
        }
        if self.aggregated_pubkey.len() != 128 {
            return Err("aggregated_pubkey must be 128 bytes (G2 point)");
        }
        if self.active_count == 0 {
            return Err("active_count cannot be zero");
        }
        if self.threshold == 0 {
            return Err("threshold cannot be zero");
        }
        if self.threshold > self.active_count {
            return Err("threshold cannot exceed active_count");
        }
        if self.bls_signature.len() != 64 {
            return Err("bls_signature must be 64 bytes (G1 point)");
        }
        if self.issuer_id > 19 {
            return Err("issuer_id must be 0-19");
        }
        Ok(())
    }

    /// Convert to JSON response format (with 0x prefixes)
    pub fn to_json_response(&self) -> serde_json::Value {
        serde_json::json!({
            "nonce": self.nonce,
            "aggregatedPubkey": format!("0x{}", hex::encode(&self.aggregated_pubkey)),
            "activeCount": self.active_count,
            "threshold": self.threshold,
            "stateHash": format!("0x{}", hex::encode(self.state_hash.as_bytes())),
            "blsSignature": format!("0x{}", hex::encode(&self.bls_signature)),
            "issuerId": self.issuer_id,
        })
    }
}

/// Build the message hash for BLS signing (AC3)
///
/// The message hash is computed as:
/// `keccak256(abi.encode("REGISTRY_SYNC", block.chainid, address(this), nonce, newAggPubkey, activeCount, threshold))`
///
/// **CRITICAL — Solidity coordination (Story 8.2):**
/// This uses `abi.encode` (standard ABI encoding with proper padding), NOT `abi.encodePacked`.
/// The Solidity side in MirrorIssuerRegistry.sol uses:
/// `keccak256(abi.encode("REGISTRY_SYNC", block.chainid, address(this), nonce, newAggPubkey, newActiveCount, newThreshold))`
///
/// The `chain_id` and `mirror_address` parameters bind the message to a specific
/// chain and contract, preventing cross-chain replay attacks.
///
/// # Panics
///
/// Panics if `agg_pubkey` is not exactly 128 bytes (G2 point).
pub fn build_registry_sync_message_hash(
    chain_id: u64,
    mirror_address: Address,
    nonce: u64,
    agg_pubkey: &[u8],
    active_count: u64,
    threshold: u64,
) -> [u8; 32] {
    use ethers::abi::Token;
    use ethers::types::U256;

    assert_eq!(
        agg_pubkey.len(),
        128,
        "agg_pubkey must be exactly 128 bytes (G2 point), got {}",
        agg_pubkey.len()
    );

    let tokens = vec![
        Token::String("REGISTRY_SYNC".to_string()),
        Token::Uint(U256::from(chain_id)),
        Token::Address(mirror_address),
        Token::Uint(U256::from(nonce)),
        Token::Bytes(agg_pubkey.to_vec()),
        Token::Uint(U256::from(active_count)),
        Token::Uint(U256::from(threshold)),
    ];

    ethers::utils::keccak256(&ethers::abi::encode(&tokens))
}

/// Serde helper for hex-encoding bytes
mod hex_bytes {
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&format!("0x{}", hex::encode(bytes)))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s: String = String::deserialize(deserializer)?;
        let s = s.strip_prefix("0x").unwrap_or(&s);
        hex::decode(s).map_err(serde::de::Error::custom)
    }
}

/// Serde helper for hex-encoding H256
mod hex_h256 {
    use ethers::types::H256;
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(hash: &H256, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&format!("0x{}", hex::encode(hash.as_bytes())))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<H256, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s: String = String::deserialize(deserializer)?;
        let s = s.strip_prefix("0x").unwrap_or(&s);
        let bytes = hex::decode(s).map_err(serde::de::Error::custom)?;
        if bytes.len() != 32 {
            return Err(serde::de::Error::custom("H256 must be 32 bytes"));
        }
        Ok(H256::from_slice(&bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_state() -> RegistrySyncState {
        RegistrySyncState {
            nonce: 5,
            aggregated_pubkey: vec![0xAA; 128],
            active_count: 3,
            threshold: 2,
            state_hash: H256::from([0xBB; 32]),
            bls_signature: vec![0xCC; 64],
            issuer_id: 1,
        }
    }

    #[test]
    fn test_registry_sync_state_creation() {
        let state = create_test_state();
        assert_eq!(state.nonce, 5);
        assert_eq!(state.active_count, 3);
        assert_eq!(state.threshold, 2);
        assert_eq!(state.issuer_id, 1);
    }

    #[test]
    fn test_is_newer_than() {
        let state1 = create_test_state();
        let mut state2 = create_test_state();
        state2.nonce = 10;

        assert!(state2.is_newer_than(&state1));
        assert!(!state1.is_newer_than(&state2));
        assert!(!state1.is_newer_than(&state1));
    }

    #[test]
    fn test_validate_success() {
        let state = create_test_state();
        assert!(state.validate().is_ok());
    }

    #[test]
    fn test_validate_zero_nonce() {
        let mut state = create_test_state();
        state.nonce = 0;
        assert_eq!(state.validate(), Err("nonce cannot be zero"));
    }

    #[test]
    fn test_validate_invalid_pubkey_length() {
        let mut state = create_test_state();
        state.aggregated_pubkey = vec![0xAA; 64]; // Wrong length
        assert_eq!(
            state.validate(),
            Err("aggregated_pubkey must be 128 bytes (G2 point)")
        );
    }

    #[test]
    fn test_validate_zero_active_count() {
        let mut state = create_test_state();
        state.active_count = 0;
        assert_eq!(state.validate(), Err("active_count cannot be zero"));
    }

    #[test]
    fn test_validate_zero_threshold() {
        let mut state = create_test_state();
        state.threshold = 0;
        assert_eq!(state.validate(), Err("threshold cannot be zero"));
    }

    #[test]
    fn test_validate_threshold_exceeds_active() {
        let mut state = create_test_state();
        state.threshold = 5;
        state.active_count = 3;
        assert_eq!(state.validate(), Err("threshold cannot exceed active_count"));
    }

    #[test]
    fn test_validate_invalid_signature_length() {
        let mut state = create_test_state();
        state.bls_signature = vec![0xCC; 32]; // Wrong length
        assert_eq!(
            state.validate(),
            Err("bls_signature must be 64 bytes (G1 point)")
        );
    }

    #[test]
    fn test_validate_invalid_issuer_id() {
        let mut state = create_test_state();
        state.issuer_id = 20; // Invalid (max is 19)
        assert_eq!(state.validate(), Err("issuer_id must be 0-19"));
    }

    #[test]
    fn test_to_json_response() {
        let state = create_test_state();
        let json = state.to_json_response();

        assert_eq!(json["nonce"], 5);
        assert_eq!(json["activeCount"], 3);
        assert_eq!(json["threshold"], 2);
        assert_eq!(json["issuerId"], 1);

        // Check hex formatting
        let pubkey = json["aggregatedPubkey"].as_str().unwrap();
        assert!(pubkey.starts_with("0x"));
        assert_eq!(pubkey.len(), 2 + 256); // 0x + 128 bytes * 2

        let sig = json["blsSignature"].as_str().unwrap();
        assert!(sig.starts_with("0x"));
        assert_eq!(sig.len(), 2 + 128); // 0x + 64 bytes * 2
    }

    // Test constants for chain-bound message hashing
    const TEST_CHAIN_ID: u64 = 111222333;
    fn test_mirror_address() -> ethers::types::Address {
        ethers::types::Address::from([0xAB; 20])
    }

    #[test]
    fn test_build_registry_sync_message_hash() {
        let agg_pubkey = vec![0x11u8; 128];
        let hash = build_registry_sync_message_hash(TEST_CHAIN_ID, test_mirror_address(), 5, &agg_pubkey, 3, 2);

        // Verify it's a valid 32-byte hash
        assert_eq!(hash.len(), 32);

        // Verify determinism
        let hash2 = build_registry_sync_message_hash(TEST_CHAIN_ID, test_mirror_address(), 5, &agg_pubkey, 3, 2);
        assert_eq!(hash, hash2);

        // Verify different inputs produce different hashes
        let hash3 = build_registry_sync_message_hash(TEST_CHAIN_ID, test_mirror_address(), 6, &agg_pubkey, 3, 2);
        assert_ne!(hash, hash3);
    }

    #[test]
    fn test_message_hash_components() {
        // Test that message hash changes with each component
        let pubkey = vec![0x22u8; 128];
        let cid = TEST_CHAIN_ID;
        let ma = test_mirror_address();

        let hash1 = build_registry_sync_message_hash(cid, ma, 1, &pubkey, 3, 2);
        let hash2 = build_registry_sync_message_hash(cid, ma, 2, &pubkey, 3, 2); // Different nonce
        let hash3 = build_registry_sync_message_hash(cid, ma, 1, &pubkey, 4, 2); // Different active_count
        let hash4 = build_registry_sync_message_hash(cid, ma, 1, &pubkey, 3, 3); // Different threshold
        let hash5 = build_registry_sync_message_hash(999, ma, 1, &pubkey, 3, 2); // Different chain_id
        let hash6 = build_registry_sync_message_hash(cid, ethers::types::Address::from([0xCD; 20]), 1, &pubkey, 3, 2); // Different mirror_address

        // All should be different
        assert_ne!(hash1, hash2);
        assert_ne!(hash1, hash3);
        assert_ne!(hash1, hash4);
        assert_ne!(hash1, hash5);
        assert_ne!(hash1, hash6);
        assert_ne!(hash2, hash3);
        assert_ne!(hash2, hash4);
        assert_ne!(hash3, hash4);
    }

    #[test]
    fn test_serde_roundtrip() {
        let state = create_test_state();

        // Serialize to JSON
        let json_str = serde_json::to_string(&state).unwrap();

        // Deserialize back
        let deserialized: RegistrySyncState = serde_json::from_str(&json_str).unwrap();

        assert_eq!(state, deserialized);
    }

    #[tokio::test]
    async fn test_cache_operations() {
        let cache = new_registry_sync_cache();

        // Initially empty
        {
            let guard = cache.read().await;
            assert!(guard.is_none());
        }

        // Write state
        {
            let mut guard = cache.write().await;
            *guard = Some(create_test_state());
        }

        // Read back
        {
            let guard = cache.read().await;
            assert!(guard.is_some());
            let state = guard.as_ref().unwrap();
            assert_eq!(state.nonce, 5);
        }
    }

    #[tokio::test]
    async fn test_cache_update() {
        let cache = new_registry_sync_cache();

        // Set initial state
        {
            let mut guard = cache.write().await;
            *guard = Some(create_test_state());
        }

        // Update with newer state
        {
            let mut guard = cache.write().await;
            if let Some(ref current) = *guard {
                let mut new_state = create_test_state();
                new_state.nonce = 10;
                if new_state.is_newer_than(current) {
                    *guard = Some(new_state);
                }
            }
        }

        // Verify update
        {
            let guard = cache.read().await;
            assert_eq!(guard.as_ref().unwrap().nonce, 10);
        }
    }

    // === Task 3 Tests: compute_aggregated_pubkey ===

    fn create_test_issuer(id: u8, active: bool) -> Issuer {
        use ethers::types::{Address, Bytes, U256};

        // Generate a deterministic keypair for testing (must match bls-tool: vec![idx; 32])
        let seed = vec![id; 32];
        let keypair = BLSKeyPair::from_seed(&seed).expect("valid seed");

        Issuer {
            id: id as u64,
            addr: Address::from([id; 20]),
            ip: H256::from([id; 32]),
            bls_pubkey: Bytes::from(keypair.public_key_bytes()),
            status: if active { U256::from(1) } else { U256::from(0) },
            registered_at: U256::from(1000),
        }
    }

    #[test]
    fn test_compute_aggregated_pubkey_single_issuer() {
        let issuers = vec![create_test_issuer(1, true)];
        let result = compute_aggregated_pubkey(&issuers);
        assert!(result.is_ok());
        let pubkey = result.unwrap();
        assert_eq!(pubkey.len(), 128);
        // Single issuer's aggregated pubkey equals their own pubkey
        assert_eq!(pubkey, issuers[0].bls_pubkey.to_vec());
    }

    #[test]
    fn test_compute_aggregated_pubkey_multiple_issuers() {
        let issuers = vec![
            create_test_issuer(1, true),
            create_test_issuer(2, true),
            create_test_issuer(3, true),
        ];
        let result = compute_aggregated_pubkey(&issuers);
        assert!(result.is_ok());
        let pubkey = result.unwrap();
        assert_eq!(pubkey.len(), 128);
        // Aggregated pubkey should be different from any individual pubkey
        assert_ne!(pubkey, issuers[0].bls_pubkey.to_vec());
        assert_ne!(pubkey, issuers[1].bls_pubkey.to_vec());
        assert_ne!(pubkey, issuers[2].bls_pubkey.to_vec());
    }

    #[test]
    fn test_compute_aggregated_pubkey_filters_inactive() {
        let issuers = vec![
            create_test_issuer(1, true),
            create_test_issuer(2, false), // Inactive
            create_test_issuer(3, true),
        ];
        let result = compute_aggregated_pubkey(&issuers);
        assert!(result.is_ok());

        // Compare with aggregation of only active issuers
        let active_only = vec![create_test_issuer(1, true), create_test_issuer(3, true)];
        let active_result = compute_aggregated_pubkey(&active_only).unwrap();
        assert_eq!(result.unwrap(), active_result);
    }

    #[test]
    fn test_compute_aggregated_pubkey_no_active_fails() {
        let issuers = vec![
            create_test_issuer(1, false),
            create_test_issuer(2, false),
        ];
        let result = compute_aggregated_pubkey(&issuers);
        assert!(matches!(result, Err(RegistrySyncError::NoActiveIssuers)));
    }

    #[test]
    fn test_compute_aggregated_pubkey_empty_fails() {
        let issuers: Vec<Issuer> = vec![];
        let result = compute_aggregated_pubkey(&issuers);
        assert!(matches!(result, Err(RegistrySyncError::NoActiveIssuers)));
    }

    // === Task 4 Tests: sign_registry_sync_message ===

    #[test]
    fn test_sign_registry_sync_message() {
        let keypair = BLSKeyPair::from_seed(&[42u8; 32]).unwrap();
        let message_hash = build_registry_sync_message_hash(TEST_CHAIN_ID, test_mirror_address(), 5, &[0x11u8; 128], 3, 2);

        let result = sign_registry_sync_message(&keypair, &message_hash);
        assert!(result.is_ok());
        let signature = result.unwrap();
        assert_eq!(signature.len(), 64);
    }

    #[test]
    fn test_sign_registry_sync_message_deterministic() {
        let keypair = BLSKeyPair::from_seed(&[42u8; 32]).unwrap();
        let message_hash = build_registry_sync_message_hash(TEST_CHAIN_ID, test_mirror_address(), 5, &[0x11u8; 128], 3, 2);

        let sig1 = sign_registry_sync_message(&keypair, &message_hash).unwrap();
        let sig2 = sign_registry_sync_message(&keypair, &message_hash).unwrap();
        assert_eq!(sig1, sig2);
    }

    #[test]
    fn test_sign_registry_sync_message_different_keypairs() {
        let kp1 = BLSKeyPair::from_seed(&[1u8; 32]).unwrap();
        let kp2 = BLSKeyPair::from_seed(&[2u8; 32]).unwrap();
        let message_hash = build_registry_sync_message_hash(TEST_CHAIN_ID, test_mirror_address(), 5, &[0x11u8; 128], 3, 2);

        let sig1 = sign_registry_sync_message(&kp1, &message_hash).unwrap();
        let sig2 = sign_registry_sync_message(&kp2, &message_hash).unwrap();
        assert_ne!(sig1, sig2);
    }

    #[test]
    fn test_sign_and_verify_registry_sync_message() {
        use common::bls::Bn254BLSSigner;
        use common::types::BLSSignature;

        let keypair = BLSKeyPair::from_seed(&[42u8; 32]).unwrap();
        let pubkey = keypair.public_key();
        let agg_pubkey = [0x11u8; 128];
        let message_hash = build_registry_sync_message_hash(TEST_CHAIN_ID, test_mirror_address(), 5, &agg_pubkey, 3, 2);

        let signature = sign_registry_sync_message(&keypair, &message_hash).unwrap();

        // Verify the signature
        let signer = Bn254BLSSigner::new();
        let valid = signer
            .verify_message_hash(&pubkey, &message_hash, &BLSSignature(signature))
            .unwrap();
        assert!(valid);
    }

    // === Threshold computation tests ===

    #[test]
    fn test_compute_threshold() {
        assert_eq!(compute_threshold(0), 0);
        assert_eq!(compute_threshold(1), 1); // 1 issuer needs 1 sig
        assert_eq!(compute_threshold(2), 2); // 2 issuers need 2 sigs
        assert_eq!(compute_threshold(3), 2); // 3 issuers need 2 sigs (ceil(2*3/3) = 2)
        assert_eq!(compute_threshold(4), 3); // 4 issuers need 3 sigs
        assert_eq!(compute_threshold(5), 4); // 5 issuers need 4 sigs
        assert_eq!(compute_threshold(6), 4); // 6 issuers need 4 sigs (ceil(2*6/3) = 4)
        assert_eq!(compute_threshold(20), 14); // 20 issuers need 14 sigs
    }

    // === Integration: Full workflow test ===

    #[test]
    fn test_full_registry_sync_workflow() {
        use common::bls::Bn254BLSSigner;
        use common::traits::BLSSigner;
        use common::types::BLSSignature;

        // Create 3 issuers with deterministic keys
        let issuers: Vec<Issuer> = (0..3).map(|i| create_test_issuer(i, true)).collect();
        let keypairs: Vec<BLSKeyPair> = (0..3u8)
            .map(|i| {
                let seed = vec![i; 32];
                BLSKeyPair::from_seed(&seed).unwrap()
            })
            .collect();

        // Step 1: Compute aggregated pubkey
        let agg_pubkey = compute_aggregated_pubkey(&issuers).unwrap();
        assert_eq!(agg_pubkey.len(), 128);

        // Step 2: Build message hash
        let nonce = 1u64;
        let active_count = 3u64;
        let threshold = compute_threshold(active_count);
        let message_hash = build_registry_sync_message_hash(TEST_CHAIN_ID, test_mirror_address(), nonce, &agg_pubkey, active_count, threshold);

        // Step 3: Each issuer signs the message
        let signatures: Vec<Vec<u8>> = keypairs
            .iter()
            .map(|kp| sign_registry_sync_message(kp, &message_hash).unwrap())
            .collect();

        // Step 4: Aggregate 2/3 signatures (need 3 for threshold=3)
        let signer = Bn254BLSSigner::new();
        let bls_sigs: Vec<BLSSignature> = signatures.iter().map(|s| BLSSignature(s.clone())).collect();
        let aggregated_sig = signer.aggregate_signatures(bls_sigs).unwrap();

        // Step 5: Verify aggregated signature against aggregated pubkey
        let agg_pk = common::types::BLSPublicKey(agg_pubkey);
        let valid = signer
            .verify_message_hash(&agg_pk, &message_hash, &aggregated_sig)
            .unwrap();
        assert!(valid, "Aggregated signature should verify against aggregated pubkey");
    }

    // === Task 5 Tests: RegistrySyncHandler ===

    #[test]
    fn test_registry_sync_config_default() {
        let config = RegistrySyncConfig::default();
        assert_eq!(config.issuer_registry_address, ethers::types::Address::zero());
        assert_eq!(config.poll_interval_ms, 5_000);
        assert_eq!(config.max_block_range, 1_000);
        assert_eq!(config.initial_scan_blocks, 86_400);
    }

    #[test]
    fn test_registry_sync_config_custom() {
        let config = RegistrySyncConfig {
            issuer_registry_address: ethers::types::Address::from([0x11u8; 20]),
            poll_interval_ms: 10_000,
            max_block_range: 500,
            initial_scan_blocks: 50_000,
        };
        assert_eq!(config.poll_interval_ms, 10_000);
        assert_eq!(config.max_block_range, 500);
        assert_eq!(config.initial_scan_blocks, 50_000);
    }

    #[test]
    fn print_aggregated_pubkey_for_e2e() {
        // E2E deploy uses seeds [0,0x42], [1,0x42], [2,0x42]
        let issuers = vec![
            create_test_issuer(0, true),
            create_test_issuer(1, true),
            create_test_issuer(2, true),
        ];
        let agg = compute_aggregated_pubkey(&issuers).unwrap();
        println!("AGGREGATED_PUBKEY={}", hex::encode(&agg));
    }
}
