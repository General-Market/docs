//! Nonce management for concurrent transaction submission
//!
//! Per architecture NFR19 (stateless nodes), nonce management handles:
//! 1. Startup: Query on-chain nonce via `eth_getTransactionCount(address, "pending")`
//! 2. Concurrent submissions: Atomic counter for local nonce assignment
//! 3. Failure recovery: Reset to on-chain nonce on tx rejection
//! 4. Reorg handling: Monitor for tx not included, resubmit if needed

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use dashmap::DashMap;
use ethers::prelude::*;
use tracing::{debug, warn};

use common::error::Error;

/// Status of a pending transaction
#[derive(Debug, Clone)]
pub struct PendingTx {
    /// The transaction hash
    pub tx_hash: H256,
    /// Nonce used for this transaction
    pub nonce: U256,
    /// When the transaction was submitted
    pub submitted_at: Instant,
    /// Number of confirmation attempts
    pub check_count: u32,
}

/// Nonce manager for handling concurrent transaction submissions
///
/// Provides optimistic nonce assignment with atomic increments and
/// recovery mechanisms for failed transactions.
pub struct NonceManager {
    /// The address being managed
    address: Address,
    /// Provider for querying on-chain nonce
    provider: Arc<Provider<Http>>,
    /// Local nonce counter (atomic for thread safety)
    local_nonce: AtomicU64,
    /// Map of pending transactions by nonce
    pending_txs: DashMap<U256, PendingTx>,
    /// Whether the nonce has been initialized from chain
    initialized: std::sync::atomic::AtomicBool,
}

impl NonceManager {
    /// Create a new NonceManager
    ///
    /// # Arguments
    /// * `address` - The address to manage nonces for
    /// * `provider` - Provider for querying on-chain state
    pub fn new(address: Address, provider: Arc<Provider<Http>>) -> Self {
        Self {
            address,
            provider,
            local_nonce: AtomicU64::new(0),
            pending_txs: DashMap::new(),
            initialized: std::sync::atomic::AtomicBool::new(false),
        }
    }

    /// Initialize nonce from on-chain state
    ///
    /// Must be called before using get_next_nonce.
    /// Queries `eth_getTransactionCount(address, "pending")`.
    pub async fn initialize(&self) -> Result<u64, Error> {
        let nonce = self
            .provider
            .get_transaction_count(self.address, Some(BlockNumber::Pending.into()))
            .await
            .map_err(|e| Error::ChainRead(format!("Failed to get nonce: {}", e)))?;

        let nonce_u64 = nonce.as_u64();
        self.local_nonce.store(nonce_u64, Ordering::SeqCst);
        self.initialized
            .store(true, std::sync::atomic::Ordering::SeqCst);

        debug!(
            address = ?self.address,
            nonce = nonce_u64,
            "Nonce manager initialized"
        );

        Ok(nonce_u64)
    }

    /// Get the next nonce for transaction submission
    ///
    /// Atomically increments the local nonce counter.
    /// Initializes from chain if not already done.
    pub async fn get_next_nonce(&self) -> Result<U256, Error> {
        // Initialize if needed
        if !self.initialized.load(std::sync::atomic::Ordering::SeqCst) {
            self.initialize().await?;
        }

        // Atomically fetch and increment
        let nonce = self.local_nonce.fetch_add(1, Ordering::SeqCst);

        debug!(
            address = ?self.address,
            nonce = nonce,
            "Assigned nonce for transaction"
        );

        Ok(U256::from(nonce))
    }

    /// Track a submitted transaction
    ///
    /// # Arguments
    /// * `nonce` - The nonce used
    /// * `tx_hash` - The transaction hash
    pub fn track_pending(&self, nonce: U256, tx_hash: H256) {
        let pending = PendingTx {
            tx_hash,
            nonce,
            submitted_at: Instant::now(),
            check_count: 0,
        };
        self.pending_txs.insert(nonce, pending);

        debug!(
            nonce = ?nonce,
            tx_hash = ?tx_hash,
            "Tracking pending transaction"
        );
    }

    /// Mark a transaction as confirmed and remove from tracking
    ///
    /// # Arguments
    /// * `nonce` - The nonce to confirm
    pub fn confirm(&self, nonce: U256) {
        if let Some((_, pending)) = self.pending_txs.remove(&nonce) {
            debug!(
                nonce = ?nonce,
                tx_hash = ?pending.tx_hash,
                elapsed_ms = pending.submitted_at.elapsed().as_millis(),
                "Transaction confirmed"
            );
        }
    }

    /// Handle a transaction failure by resetting nonce if needed
    ///
    /// If the error indicates a nonce issue, resets to the failed nonce
    /// so it can be reused.
    ///
    /// # Arguments
    /// * `nonce` - The nonce that failed
    /// * `error_msg` - The error message
    pub async fn handle_failure(&self, nonce: U256, error_msg: &str) -> Result<(), Error> {
        // Remove from pending
        self.pending_txs.remove(&nonce);

        let error_lower = error_msg.to_lowercase();

        // Check if we need to reset nonce
        if error_lower.contains("nonce too low") || error_lower.contains("nonce has already been used") {
            warn!(
                code = "INFRA-002",
                nonce = ?nonce,
                error = error_msg,
                "Nonce issue detected, re-syncing with chain"
            );

            // Re-sync with chain (with retry for transient failures)
            self.resync_with_retry(3).await?;
        } else {
            // For other errors, we might need to allow nonce reuse
            // Only reset if this was the highest pending nonce
            let nonce_u64 = nonce.as_u64();
            let current = self.local_nonce.load(Ordering::SeqCst);

            if nonce_u64 == current.saturating_sub(1) {
                // This was the last nonce we gave out, we can reuse it
                self.local_nonce
                    .compare_exchange(current, nonce_u64, Ordering::SeqCst, Ordering::SeqCst)
                    .ok();
                debug!(
                    nonce = nonce_u64,
                    "Allowing nonce reuse after failure"
                );
            }
        }

        Ok(())
    }

    /// Re-synchronize nonce with on-chain state, with retry on transient failures
    ///
    /// # Arguments
    /// * `max_retries` - Maximum number of retry attempts
    async fn resync_with_retry(&self, max_retries: u32) -> Result<(), Error> {
        let mut last_error = None;
        let base_delay = Duration::from_millis(200);

        for attempt in 0..=max_retries {
            match self.resync().await {
                Ok(()) => return Ok(()),
                Err(e) => {
                    let error_msg = e.to_string().to_lowercase();
                    // Only retry on connection/network errors
                    let is_retryable = error_msg.contains("timeout")
                        || error_msg.contains("connection")
                        || error_msg.contains("503")
                        || error_msg.contains("502");

                    if !is_retryable || attempt == max_retries {
                        return Err(e);
                    }

                    let delay = base_delay * 2u32.pow(attempt);
                    warn!(
                        code = "INFRA-002",
                        attempt = attempt + 1,
                        max_retries = max_retries,
                        delay_ms = delay.as_millis(),
                        error = %e,
                        "Nonce resync failed, retrying"
                    );
                    tokio::time::sleep(delay).await;
                    last_error = Some(e);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| Error::ChainRead("Nonce resync failed after retries".to_string())))
    }

    /// Re-synchronize nonce with on-chain state
    ///
    /// Queries the pending nonce from chain and updates local state.
    pub async fn resync(&self) -> Result<(), Error> {
        let on_chain_nonce = self
            .provider
            .get_transaction_count(self.address, Some(BlockNumber::Pending.into()))
            .await
            .map_err(|e| Error::ChainRead(format!("Failed to resync nonce: {}", e)))?;

        let on_chain_u64 = on_chain_nonce.as_u64();
        let old_nonce = self.local_nonce.swap(on_chain_u64, Ordering::SeqCst);

        debug!(
            address = ?self.address,
            old_nonce = old_nonce,
            new_nonce = on_chain_u64,
            "Nonce resynced with chain"
        );

        // Clear pending transactions that are now stale
        self.pending_txs.retain(|nonce, _| nonce.as_u64() >= on_chain_u64);

        Ok(())
    }

    /// Clean up old pending transactions
    ///
    /// Removes transactions that have been pending for too long.
    ///
    /// # Arguments
    /// * `max_age` - Maximum age for pending transactions
    pub fn cleanup_old_pending(&self, max_age: Duration) {
        let now = Instant::now();
        let removed: Vec<_> = self
            .pending_txs
            .iter()
            .filter(|entry| now.duration_since(entry.value().submitted_at) > max_age)
            .map(|entry| *entry.key())
            .collect();

        for nonce in removed {
            if let Some((_, pending)) = self.pending_txs.remove(&nonce) {
                warn!(
                    code = "INFRA-002",
                    nonce = ?nonce,
                    tx_hash = ?pending.tx_hash,
                    age_secs = pending.submitted_at.elapsed().as_secs(),
                    "Removed stale pending transaction"
                );
            }
        }
    }

    /// Get count of pending transactions
    pub fn pending_count(&self) -> usize {
        self.pending_txs.len()
    }

    /// Get the current local nonce value (for testing/debugging)
    pub fn current_nonce(&self) -> u64 {
        self.local_nonce.load(Ordering::SeqCst)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_provider() -> Arc<Provider<Http>> {
        // This will fail to connect but is fine for unit tests that don't call async methods
        Arc::new(Provider::<Http>::try_from("http://localhost:8545").unwrap())
    }

    #[test]
    fn test_nonce_manager_creation() {
        let provider = create_test_provider();
        let address = Address::random();
        let manager = NonceManager::new(address, provider);

        assert_eq!(manager.current_nonce(), 0);
        assert_eq!(manager.pending_count(), 0);
    }

    #[test]
    fn test_track_pending() {
        let provider = create_test_provider();
        let address = Address::random();
        let manager = NonceManager::new(address, provider);

        let tx_hash = H256::random();
        let nonce = U256::from(5);

        manager.track_pending(nonce, tx_hash);
        assert_eq!(manager.pending_count(), 1);

        // Track another
        manager.track_pending(U256::from(6), H256::random());
        assert_eq!(manager.pending_count(), 2);
    }

    #[test]
    fn test_confirm() {
        let provider = create_test_provider();
        let address = Address::random();
        let manager = NonceManager::new(address, provider);

        let nonce = U256::from(5);
        manager.track_pending(nonce, H256::random());
        assert_eq!(manager.pending_count(), 1);

        manager.confirm(nonce);
        assert_eq!(manager.pending_count(), 0);
    }

    #[test]
    fn test_cleanup_old_pending() {
        let provider = create_test_provider();
        let address = Address::random();
        let manager = NonceManager::new(address, provider);

        // Track a transaction
        manager.track_pending(U256::from(1), H256::random());
        assert_eq!(manager.pending_count(), 1);

        // Cleanup with very short max age should remove it
        // Note: This test is timing-dependent, using Duration::ZERO to ensure removal
        std::thread::sleep(Duration::from_millis(10));
        manager.cleanup_old_pending(Duration::ZERO);
        assert_eq!(manager.pending_count(), 0);
    }

    #[test]
    fn test_pending_tx_struct() {
        let tx = PendingTx {
            tx_hash: H256::random(),
            nonce: U256::from(42),
            submitted_at: Instant::now(),
            check_count: 0,
        };

        assert_eq!(tx.nonce, U256::from(42));
        assert_eq!(tx.check_count, 0);
    }
}
