//! Nonce management for concurrent transaction submission
//!
//! Per architecture NFR19 (stateless nodes), nonce management handles:
//! 1. Startup: Query on-chain nonce via `eth_getTransactionCount(address, "pending")`
//! 2. Concurrent submissions: Atomic counter for local nonce assignment
//! 3. Failure recovery: Reset to on-chain nonce on tx rejection
//! 4. Reorg handling: Monitor for tx not included, resubmit if needed

use std::collections::BTreeSet;
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

/// Tracks in-flight nonces and reclaimed nonces under a single lock.
///
/// Consolidating these two sets eliminates the race window between
/// checking the reclaim queue and inserting into in_flight -- a gap
/// that let `resync()` clear in_flight while a nonce was allocated
/// but not yet tracked.
#[derive(Debug, Default)]
struct NonceState {
    /// Nonces currently in-flight (assigned but not yet confirmed or failed)
    in_flight: BTreeSet<u64>,
    /// Nonces reclaimed from failed transactions, available for reuse
    reclaim_queue: BTreeSet<u64>,
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
    /// In-flight and reclaim state, unified under a single lock to prevent
    /// race conditions between nonce allocation and in_flight tracking.
    state: Arc<tokio::sync::Mutex<NonceState>>,
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
            state: Arc::new(tokio::sync::Mutex::new(NonceState::default())),
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
    /// Checks the reclaim queue first for reusable nonces from failed transactions,
    /// then falls back to atomically incrementing the local nonce counter.
    /// Initializes from chain if not already done.
    ///
    /// The entire allocation + in_flight insertion is performed under a single
    /// lock, so `resync()` cannot clear in_flight between nonce assignment and
    /// tracking -- the race condition that caused duplicate nonces when two
    /// consensus rounds overlapped.
    pub async fn get_next_nonce(&self) -> Result<U256, Error> {
        // Initialize if needed
        if !self.initialized.load(std::sync::atomic::Ordering::SeqCst) {
            self.initialize().await?;
        }

        // Single lock: check reclaim queue, allocate, and insert into in_flight atomically
        let mut state = self.state.lock().await;

        // First check if we have reclaimed nonces to reuse
        if let Some(&nonce) = state.reclaim_queue.iter().next() {
            state.reclaim_queue.remove(&nonce);
            state.in_flight.insert(nonce);

            debug!(
                address = ?self.address,
                nonce = nonce,
                "Reusing reclaimed nonce for transaction"
            );

            return Ok(U256::from(nonce));
        }

        // Otherwise allocate the next sequential nonce
        let nonce = self.local_nonce.fetch_add(1, Ordering::SeqCst);
        state.in_flight.insert(nonce);

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

    /// Handle a transaction failure by reclaiming the nonce for reuse
    ///
    /// If the error indicates the nonce was already used on-chain, resyncs instead.
    /// For all other failures (revert, timeout, etc.), the nonce is added to the
    /// reclaim queue so it can be reused by the next `get_next_nonce()` call.
    ///
    /// # Arguments
    /// * `nonce` - The nonce that failed
    /// * `error_msg` - The error message
    pub async fn handle_failure(&self, nonce: U256, error_msg: &str) -> Result<(), Error> {
        let nonce_u64 = nonce.as_u64();
        self.pending_txs.remove(&nonce);

        let error_lower = error_msg.to_lowercase();

        if error_lower.contains("nonce too low")
            || error_lower.contains("nonce has already been used")
            || error_lower.contains("nonce too high")
        {
            // Either the chain is ahead (nonce too low / already used) or our
            // local counter has drifted forward of the chain (nonce too high,
            // typically after an L3 reorg dropped pending txs). Both want the
            // same fix: forget local state, re-read from chain.
            self.state.lock().await.in_flight.remove(&nonce_u64);

            warn!(
                code = "INFRA-002",
                nonce = ?nonce,
                error = error_msg,
                "Nonce issue detected, re-syncing with chain"
            );

            // Re-sync with chain (with retry for transient failures)
            self.resync_with_retry(3).await?;
        } else {
            // Other failures (revert, timeout, etc.) -- move from in_flight to reclaim
            let mut state = self.state.lock().await;
            state.in_flight.remove(&nonce_u64);
            state.reclaim_queue.insert(nonce_u64);
            debug!(
                nonce = nonce_u64,
                "Nonce reclaimed for reuse after failure"
            );
        }

        Ok(())
    }

    /// Handle a successful transaction by removing it from in-flight tracking
    ///
    /// # Arguments
    /// * `nonce` - The nonce that succeeded
    pub async fn handle_success(&self, nonce: U256) {
        let nonce_u64 = nonce.as_u64();
        self.state.lock().await.in_flight.remove(&nonce_u64);
        self.pending_txs.remove(&nonce);
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

        // Clear reclaim queue and in-flight tracking -- stale after resync
        let mut state = self.state.lock().await;
        state.reclaim_queue.clear();
        state.in_flight.clear();

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

    #[tokio::test]
    async fn test_handle_failure_reclaims_nonce() {
        let provider = create_test_provider();
        let address = Address::random();
        let manager = NonceManager::new(address, provider);

        // Simulate initialized state with nonce 10
        manager.local_nonce.store(10, Ordering::SeqCst);
        manager.initialized.store(true, std::sync::atomic::Ordering::SeqCst);

        // Simulate an in-flight nonce
        manager.state.lock().await.in_flight.insert(7);

        // Fail nonce 7 with a non-nonce error (e.g., revert)
        manager.handle_failure(U256::from(7), "execution reverted").await.unwrap();

        // Nonce 7 should be in the reclaim queue and NOT in-flight
        let state = manager.state.lock().await;
        assert!(state.reclaim_queue.contains(&7), "Failed nonce should be in reclaim queue");
        assert!(!state.in_flight.contains(&7), "Failed nonce should be removed from in-flight");
    }

    #[tokio::test]
    async fn test_get_next_nonce_reuses_reclaimed() {
        let provider = create_test_provider();
        let address = Address::random();
        let manager = NonceManager::new(address, provider);

        // Simulate initialized state with nonce 10
        manager.local_nonce.store(10, Ordering::SeqCst);
        manager.initialized.store(true, std::sync::atomic::Ordering::SeqCst);

        // Put nonce 7 in reclaim queue
        manager.state.lock().await.reclaim_queue.insert(7);

        // get_next_nonce should return 7 (reclaimed) instead of 10 (next sequential)
        let nonce = manager.get_next_nonce().await.unwrap();
        assert_eq!(nonce, U256::from(7), "Should reuse reclaimed nonce 7");

        // Reclaim queue should be empty now, nonce 7 should be in-flight
        let state = manager.state.lock().await;
        assert!(state.reclaim_queue.is_empty(), "Reclaim queue should be empty after reuse");
        assert!(state.in_flight.contains(&7), "Reclaimed nonce should be in-flight");
        drop(state);

        // Next call should allocate from the sequential counter (10)
        let nonce2 = manager.get_next_nonce().await.unwrap();
        assert_eq!(nonce2, U256::from(10), "Should allocate sequential nonce after reclaim queue empty");
    }

    #[tokio::test]
    async fn test_handle_success_removes_from_in_flight() {
        let provider = create_test_provider();
        let address = Address::random();
        let manager = NonceManager::new(address, provider);

        // Add nonce 5 to in-flight and pending
        manager.state.lock().await.in_flight.insert(5);
        manager.track_pending(U256::from(5), H256::random());

        manager.handle_success(U256::from(5)).await;

        assert!(!manager.state.lock().await.in_flight.contains(&5), "Should remove from in-flight on success");
        assert_eq!(manager.pending_count(), 0, "Should remove from pending on success");
    }

    #[tokio::test]
    async fn test_concurrent_failure_reclaim_order() {
        let provider = create_test_provider();
        let address = Address::random();
        let manager = NonceManager::new(address, provider);

        manager.local_nonce.store(15, Ordering::SeqCst);
        manager.initialized.store(true, std::sync::atomic::Ordering::SeqCst);

        // Simulate in-flight nonces 10, 11, 12
        {
            let mut state = manager.state.lock().await;
            state.in_flight.insert(10);
            state.in_flight.insert(11);
            state.in_flight.insert(12);
        }

        // Fail nonces 10 and 12 (out of order)
        manager.handle_failure(U256::from(12), "timeout").await.unwrap();
        manager.handle_failure(U256::from(10), "execution reverted").await.unwrap();

        // Reclaim queue should contain both, and BTreeSet ensures lowest first
        let nonce1 = manager.get_next_nonce().await.unwrap();
        assert_eq!(nonce1, U256::from(10), "Should reuse lowest reclaimed nonce first");

        let nonce2 = manager.get_next_nonce().await.unwrap();
        assert_eq!(nonce2, U256::from(12), "Should reuse next reclaimed nonce");

        // After reclaim queue is drained, should allocate sequentially
        let nonce3 = manager.get_next_nonce().await.unwrap();
        assert_eq!(nonce3, U256::from(15), "Should allocate sequential nonce after reclaim queue empty");
    }
}
