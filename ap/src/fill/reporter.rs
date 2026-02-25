//! FillReporter - reports fills back to the blockchain
//!
//! The AP's fill reporter manages fill data submission to the chain for issuer verification.
//!
//! ## Architecture Note
//!
//! Per architecture Section 3, the AP does NOT communicate directly with issuers.
//! Fill verification works as follows:
//! 1. AP executes trade on Bitget
//! 2. AP records fill via `report_fill()` - this queues the fill for batch submission
//! 3. AP submits fill batches to chain via `submit_batch()` or `submit_pending_fills()`
//! 4. Issuers poll Bitget trade history directly (read-only API)
//! 5. Issuers compare expected fills vs actual Bitget trades
//! 6. If fills match → issuers emit BLS-signed FillConfirmation
//!
//! ## Two-Phase Design
//!
//! The fill reporting follows a two-phase pattern for efficiency:
//! - **Phase 1 (report_fill)**: Queue fill for batch submission, track in pending_fills
//! - **Phase 2 (submit_batch/submit_pending_fills)**: Submit batched fills to chain
//!
//! This allows batching multiple fills into a single transaction to reduce gas costs.
//!
//! ## BLS Signature Note
//!
//! The current implementation calls `ChainWriter.confirm_fills()` with an empty BLS signature.
//! This is a placeholder - in production, the contract interface may need adjustment for
//! AP fill reporting vs. issuer confirmation. The issuers ultimately verify and sign fills.
//!
//! ## Background Timer
//!
//! Use `start_batch_timer()` to automatically flush pending fills based on time window.

use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use ethers::types::U256;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use common::traits::ChainWriter;
use common::types::TxHash;

use super::batch::{batch_fills, FillBatch, FillBatchConfig};
use super::retry::{classify_error, ErrorKind, FillRetryConfig};
use super::types::{APFillReport, FillStatus, PendingFill};

/// Configuration for the FillReporter
#[derive(Debug, Clone)]
pub struct FillReporterConfig {
    /// Retry configuration
    pub retry: FillRetryConfig,
    /// Batching configuration
    pub batch: FillBatchConfig,
    /// How long to keep confirmed fills before cleanup (seconds)
    pub confirmed_retention_secs: u64,
    /// Cleanup interval in seconds (how often to run cleanup)
    pub cleanup_interval_secs: u64,
}

impl Default for FillReporterConfig {
    fn default() -> Self {
        Self {
            retry: FillRetryConfig::default(),
            batch: FillBatchConfig::default(),
            confirmed_retention_secs: 3600, // 1 hour
            cleanup_interval_secs: 300,     // 5 minutes
        }
    }
}

/// Handle for stopping a background batch timer
pub struct BatchTimerHandle {
    stop_tx: mpsc::Sender<()>,
}

/// Callback type for fill confirmation notifications
pub type ConfirmationCallback = Arc<dyn Fn(TxHash, Vec<U256>) + Send + Sync>;

/// FillReporter - manages fill submission to the blockchain
///
/// Thread-safe via DashMap for concurrent fill tracking.
///
/// ## Usage Example
///
/// ```ignore
/// let reporter = FillReporter::new(chain_writer, config);
///
/// // Register confirmation callback
/// reporter.on_confirmation(|tx_hash, order_ids| {
///     info!("Fills confirmed: {:?}", order_ids);
/// });
///
/// // Report fills (queues for batch submission)
/// reporter.report_fill(order_id, price, amount, tx_hash, bitget_id, timestamp, cycle).await;
///
/// // Submit pending fills (can also use start_batch_timer for automatic submission)
/// reporter.submit_pending_fills().await;
/// ```
pub struct FillReporter<W: ChainWriter> {
    /// ChainWriter for submitting fills
    chain_writer: Arc<W>,
    /// Pending fills indexed by order ID
    pending_fills: DashMap<U256, PendingFill>,
    /// Configuration
    config: FillReporterConfig,
    /// Confirmation callback (optional)
    confirmation_callback: Option<ConfirmationCallback>,
}

impl<W: ChainWriter + 'static> FillReporter<W> {
    /// Create a new FillReporter
    pub fn new(chain_writer: Arc<W>, config: FillReporterConfig) -> Self {
        Self {
            chain_writer,
            pending_fills: DashMap::new(),
            config,
            confirmation_callback: None,
        }
    }

    /// Register a callback for fill confirmations
    ///
    /// The callback is invoked when fills are marked as confirmed,
    /// receiving the transaction hash and list of confirmed order IDs.
    pub fn set_confirmation_callback<F>(&mut self, callback: F)
    where
        F: Fn(TxHash, Vec<U256>) + Send + Sync + 'static,
    {
        self.confirmation_callback = Some(Arc::new(callback));
    }

    /// Report a single fill (simple interface matching AC#1)
    ///
    /// This is the simplified interface: `report_fill(orderId, fillPrice, fillAmount, txHash)`
    /// Uses default values for AP-specific fields.
    ///
    /// Note: This queues the fill for batch submission. Call `submit_pending_fills()`
    /// or use `start_batch_timer()` to actually submit to chain.
    pub async fn report_fill_simple(
        &self,
        order_id: U256,
        fill_price: U256,
        fill_amount: U256,
        tx_hash: TxHash,
    ) -> U256 {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        self.report_fill(
            order_id,
            fill_price,
            fill_amount,
            tx_hash,
            String::new(), // No bitget order ID in simple interface
            now,           // Use current time as execution timestamp
            U256::from(0), // Default cycle, should be set properly in practice
        )
        .await
    }

    /// Report a single fill (full interface)
    ///
    /// # Arguments
    /// * `order_id` - The order ID being filled
    /// * `fill_price` - The execution price (18 decimals)
    /// * `fill_amount` - The fill amount (18 decimals)
    /// * `tx_hash` - Bitget transaction reference
    /// * `bitget_order_id` - Bitget order ID for verification
    /// * `execution_timestamp` - Unix timestamp of execution
    /// * `cycle_number` - The cycle this fill belongs to
    ///
    /// # Returns
    /// Order ID of the tracked fill
    pub async fn report_fill(
        &self,
        order_id: U256,
        fill_price: U256,
        fill_amount: U256,
        tx_hash: TxHash,
        bitget_order_id: String,
        execution_timestamp: u64,
        cycle_number: U256,
    ) -> U256 {
        let report = APFillReport::new(
            order_id,
            fill_price,
            fill_amount,
            cycle_number,
            tx_hash,
            bitget_order_id.clone(),
            execution_timestamp,
        );

        let pending = PendingFill::new(report);

        info!(
            order_id = %order_id,
            fill_price = %fill_price,
            fill_amount = %fill_amount,
            bitget_order_id = %bitget_order_id,
            "Fill report created"
        );

        self.pending_fills.insert(order_id, pending);

        order_id
    }

    /// Submit a batch of fills to the chain
    ///
    /// Implements retry logic with exponential backoff.
    pub async fn submit_batch(&self, batch: FillBatch) -> Result<TxHash, FillSubmitError> {
        if batch.is_empty() {
            return Err(FillSubmitError::EmptyBatch);
        }

        let cycle = batch.cycle_number;
        let fills: Vec<_> = batch.fills.iter().map(|f| f.to_fill()).collect();
        let order_ids: Vec<_> = batch.fills.iter().map(|f| f.order_id).collect();

        info!(
            cycle = cycle,
            fill_count = fills.len(),
            order_ids = ?order_ids.iter().map(|id| id.as_u64()).collect::<Vec<_>>(),
            "Submitting fill batch"
        );

        // Mark fills as pending submission
        for order_id in &order_ids {
            if let Some(mut entry) = self.pending_fills.get_mut(order_id) {
                entry.report.status = FillStatus::Pending;
            }
        }

        let mut attempt = 0;
        let mut last_error = None;

        while self.config.retry.should_retry(attempt) {
            // Apply backoff delay (except first attempt)
            if attempt > 0 {
                let delay = self.config.retry.delay_for_attempt(attempt);
                debug!(attempt = attempt, delay_ms = delay.as_millis(), "Retry delay");
                tokio::time::sleep(delay).await;
            }

            attempt += 1;

            // AP fill reports are informational — issuers perform BLS signing for confirmFills.
            // The empty BLS signature here is intentional; the issuer consensus pipeline
            // independently signs and submits the actual on-chain confirmation.
            warn!("FillReporter: submitting fill report with empty BLS signature (issuers will sign confirmation)");
            match self
                .chain_writer
                .confirm_fills(cycle, fills.clone(), vec![], 0, U256::zero())
                .await
            {
                Ok(tx_hash) => {
                    info!(
                        cycle = cycle,
                        tx_hash = %tx_hash,
                        fill_count = fills.len(),
                        attempts = attempt,
                        "Fill batch submitted successfully"
                    );

                    // Mark fills as submitted
                    for order_id in &order_ids {
                        if let Some(mut entry) = self.pending_fills.get_mut(order_id) {
                            entry.mark_submitted(tx_hash);
                        }
                    }

                    return Ok(tx_hash);
                }
                Err(e) => {
                    let kind = classify_error(&e);
                    warn!(
                        code = "E010",
                        cycle = cycle,
                        attempt = attempt,
                        error = %e,
                        kind = ?kind,
                        "Fill batch submission failed"
                    );

                    // Update retry count
                    for order_id in &order_ids {
                        if let Some(mut entry) = self.pending_fills.get_mut(order_id) {
                            entry.report.increment_retry();
                        }
                    }

                    // Don't retry permanent errors
                    if kind == ErrorKind::Permanent {
                        error!(
                            code = "E010",
                            cycle = cycle,
                            error = %e,
                            "Permanent error, not retrying"
                        );
                        self.mark_batch_failed(&order_ids);
                        return Err(FillSubmitError::PermanentFailure(e.to_string()));
                    }

                    last_error = Some(e);
                }
            }
        }

        // Exhausted retries
        error!(
            code = "E010",
            cycle = cycle,
            attempts = attempt,
            "Fill batch submission failed after max retries"
        );
        self.mark_batch_failed(&order_ids);

        Err(FillSubmitError::RetriesExhausted {
            attempts: attempt,
            last_error: last_error.map(|e| e.to_string()),
        })
    }

    /// Mark all fills in a batch as failed
    fn mark_batch_failed(&self, order_ids: &[U256]) {
        for order_id in order_ids {
            if let Some(mut entry) = self.pending_fills.get_mut(order_id) {
                entry.mark_failed();
            }
        }
    }

    /// Get all pending fills
    pub fn get_pending_fills(&self) -> Vec<PendingFill> {
        self.pending_fills
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Get status of a specific fill
    pub fn get_fill_status(&self, order_id: U256) -> Option<FillStatus> {
        self.pending_fills
            .get(&order_id)
            .map(|entry| entry.report.status)
    }

    /// Mark fills as confirmed by transaction hash
    ///
    /// If a confirmation callback is registered, it will be invoked with
    /// the transaction hash and list of confirmed order IDs.
    pub fn mark_confirmed(&self, tx_hash: TxHash) {
        let mut confirmed = Vec::new();

        for mut entry in self.pending_fills.iter_mut() {
            if entry.submission_tx == Some(tx_hash) {
                entry.mark_confirmed();
                confirmed.push(entry.report.order_id);
            }
        }

        if !confirmed.is_empty() {
            info!(
                tx_hash = %tx_hash,
                order_ids = ?confirmed.iter().map(|id| id.as_u64()).collect::<Vec<_>>(),
                "Fills confirmed"
            );

            // Invoke callback if registered
            if let Some(ref callback) = self.confirmation_callback {
                callback(tx_hash, confirmed);
            }
        }
    }

    /// Clean up confirmed fills older than retention period
    pub fn cleanup_confirmed(&self) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let retention = self.config.confirmed_retention_secs;
        let mut removed = 0;

        self.pending_fills.retain(|_order_id, pending| {
            if pending.report.status == FillStatus::Confirmed {
                let age = now.saturating_sub(pending.report.created_at);
                if age > retention {
                    removed += 1;
                    return false;
                }
            }
            true
        });

        if removed > 0 {
            debug!(removed = removed, "Cleaned up confirmed fills");
        }
    }

    /// Get count of fills by status
    pub fn fill_counts(&self) -> FillCounts {
        let mut counts = FillCounts::default();

        for entry in self.pending_fills.iter() {
            match entry.report.status {
                FillStatus::Pending => counts.pending += 1,
                FillStatus::Submitted => counts.submitted += 1,
                FillStatus::Confirmed => counts.confirmed += 1,
                FillStatus::Failed => counts.failed += 1,
            }
        }

        counts
    }

    /// Batch pending fills and submit them
    ///
    /// This method collects all PENDING fills, batches them, and submits.
    pub async fn submit_pending_fills(&self) -> Vec<Result<TxHash, FillSubmitError>> {
        let pending: Vec<_> = self
            .pending_fills
            .iter()
            .filter(|e| e.report.status == FillStatus::Pending)
            .map(|e| e.report.clone())
            .collect();

        if pending.is_empty() {
            return Vec::new();
        }

        let batches = batch_fills(pending, &self.config.batch);
        let mut results = Vec::new();

        for batch in batches {
            results.push(self.submit_batch(batch).await);
        }

        results
    }

    /// Start a background timer that periodically submits pending fills
    ///
    /// This implements AC#3 (batching window) by automatically flushing
    /// pending fills after the configured batch window expires.
    ///
    /// Returns a handle that can be used to stop the timer.
    ///
    /// # Example
    ///
    /// ```ignore
    /// let reporter = Arc::new(FillReporter::new(chain, config));
    /// let handle = reporter.clone().start_batch_timer();
    ///
    /// // ... later, to stop:
    /// drop(handle);
    /// ```
    pub fn start_batch_timer(self: Arc<Self>) -> BatchTimerHandle {
        let (stop_tx, mut stop_rx) = mpsc::channel::<()>(1);
        let reporter = self.clone();
        let batch_window = Duration::from_millis(self.config.batch.batch_window_ms);
        let cleanup_interval = Duration::from_secs(self.config.cleanup_interval_secs);

        tokio::spawn(async move {
            let mut batch_interval = tokio::time::interval(batch_window);
            let mut cleanup_interval = tokio::time::interval(cleanup_interval);

            // Skip first immediate tick
            batch_interval.tick().await;
            cleanup_interval.tick().await;

            loop {
                tokio::select! {
                    _ = stop_rx.recv() => {
                        debug!("Batch timer stopped");
                        break;
                    }
                    _ = batch_interval.tick() => {
                        let counts = reporter.fill_counts();
                        if counts.pending > 0 {
                            debug!(pending = counts.pending, "Batch timer: submitting pending fills");
                            let results = reporter.submit_pending_fills().await;
                            let success = results.iter().filter(|r| r.is_ok()).count();
                            let failed = results.len() - success;
                            if failed > 0 {
                                warn!(code = "E010", success = success, failed = failed, "Batch timer: some submissions failed");
                            }
                        }
                    }
                    _ = cleanup_interval.tick() => {
                        reporter.cleanup_confirmed();
                    }
                }
            }
        });

        BatchTimerHandle { stop_tx }
    }
}

/// Fill submission error types
#[derive(Debug, thiserror::Error)]
pub enum FillSubmitError {
    #[error("Empty batch")]
    EmptyBatch,

    #[error("Permanent failure: {0}")]
    PermanentFailure(String),

    #[error("Retries exhausted after {attempts} attempts: {last_error:?}")]
    RetriesExhausted {
        attempts: u32,
        last_error: Option<String>,
    },
}

/// Fill counts by status
#[derive(Debug, Default, Clone)]
pub struct FillCounts {
    pub pending: usize,
    pub submitted: usize,
    pub confirmed: usize,
    pub failed: usize,
}

impl FillCounts {
    pub fn total(&self) -> usize {
        self.pending + self.submitted + self.confirmed + self.failed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::mocks::MockChainBuilder;
    use ethers::types::H256;

    fn create_test_fill(order_id: u64, cycle: u64) -> APFillReport {
        APFillReport::new(
            U256::from(order_id),
            U256::from(100) * U256::exp10(18),
            U256::from(1000) * U256::exp10(18),
            U256::from(cycle),
            H256::random(),
            format!("bitget-{}", order_id),
            1234567890,
        )
    }

    #[tokio::test]
    async fn test_report_fill() {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let config = FillReporterConfig::default();
        let reporter = FillReporter::new(mock_chain, config);

        let order_id = reporter
            .report_fill(
                U256::from(1),
                U256::from(100) * U256::exp10(18),
                U256::from(1000) * U256::exp10(18),
                H256::random(),
                "bitget-123".to_string(),
                1234567890,
                U256::from(1),
            )
            .await;

        assert_eq!(order_id, U256::from(1));

        let pending = reporter.get_pending_fills();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].report.status, FillStatus::Pending);
    }

    #[tokio::test]
    async fn test_submit_batch_success() {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let config = FillReporterConfig::default();
        let reporter = FillReporter::new(mock_chain.clone(), config);

        // Report fills
        reporter
            .report_fill(
                U256::from(1),
                U256::from(100) * U256::exp10(18),
                U256::from(1000) * U256::exp10(18),
                H256::random(),
                "bitget-1".to_string(),
                1234567890,
                U256::from(1),
            )
            .await;

        reporter
            .report_fill(
                U256::from(2),
                U256::from(100) * U256::exp10(18),
                U256::from(1000) * U256::exp10(18),
                H256::random(),
                "bitget-2".to_string(),
                1234567890,
                U256::from(1),
            )
            .await;

        // Create and submit batch
        let pending: Vec<_> = reporter
            .get_pending_fills()
            .into_iter()
            .map(|p| p.report)
            .collect();
        let batch = FillBatch::from_fills(pending, 1);

        let result = reporter.submit_batch(batch).await;
        assert!(result.is_ok());

        // Check fills are marked as submitted
        for id in [U256::from(1), U256::from(2)] {
            let status = reporter.get_fill_status(id);
            assert_eq!(status, Some(FillStatus::Submitted));
        }
    }

    #[tokio::test]
    async fn test_submit_batch_empty() {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let config = FillReporterConfig::default();
        let reporter = FillReporter::new(mock_chain, config);

        let batch = FillBatch::new(1);
        let result = reporter.submit_batch(batch).await;

        assert!(matches!(result, Err(FillSubmitError::EmptyBatch)));
    }

    #[tokio::test]
    async fn test_fill_counts() {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let config = FillReporterConfig::default();
        let reporter = FillReporter::new(mock_chain, config);

        // Report multiple fills
        for i in 1..=5 {
            reporter
                .report_fill(
                    U256::from(i),
                    U256::from(100) * U256::exp10(18),
                    U256::from(1000) * U256::exp10(18),
                    H256::random(),
                    format!("bitget-{}", i),
                    1234567890,
                    U256::from(1),
                )
                .await;
        }

        let counts = reporter.fill_counts();
        assert_eq!(counts.pending, 5);
        assert_eq!(counts.submitted, 0);
        assert_eq!(counts.confirmed, 0);
        assert_eq!(counts.failed, 0);
        assert_eq!(counts.total(), 5);
    }

    #[tokio::test]
    async fn test_mark_confirmed() {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let config = FillReporterConfig::default();
        let reporter = FillReporter::new(mock_chain, config);

        // Report and submit fills
        reporter
            .report_fill(
                U256::from(1),
                U256::from(100) * U256::exp10(18),
                U256::from(1000) * U256::exp10(18),
                H256::random(),
                "bitget-1".to_string(),
                1234567890,
                U256::from(1),
            )
            .await;

        let pending: Vec<_> = reporter
            .get_pending_fills()
            .into_iter()
            .map(|p| p.report)
            .collect();
        let batch = FillBatch::from_fills(pending, 1);

        let tx_hash = reporter.submit_batch(batch).await.unwrap();

        // Mark confirmed
        reporter.mark_confirmed(tx_hash);

        let status = reporter.get_fill_status(U256::from(1));
        assert_eq!(status, Some(FillStatus::Confirmed));
    }

    #[tokio::test]
    async fn test_submit_pending_fills() {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let config = FillReporterConfig {
            batch: FillBatchConfig {
                max_batch_size: 2,
                ..Default::default()
            },
            ..Default::default()
        };
        let reporter = FillReporter::new(mock_chain, config);

        // Report 5 fills
        for i in 1..=5 {
            reporter
                .report_fill(
                    U256::from(i),
                    U256::from(100) * U256::exp10(18),
                    U256::from(1000) * U256::exp10(18),
                    H256::random(),
                    format!("bitget-{}", i),
                    1234567890,
                    U256::from(1),
                )
                .await;
        }

        // Submit all pending
        let results = reporter.submit_pending_fills().await;

        // With batch size 2, we should have 3 batches (2, 2, 1)
        assert_eq!(results.len(), 3);
        assert!(results.iter().all(|r| r.is_ok()));

        // All should be submitted now
        let counts = reporter.fill_counts();
        assert_eq!(counts.pending, 0);
        assert_eq!(counts.submitted, 5);
    }

    #[tokio::test]
    async fn test_retry_on_failure() {
        use common::mocks::MockError;
        use std::time::Duration;

        let mock_chain = Arc::new(
            MockChainBuilder::new()
                .with_latency(Duration::from_millis(1))
                .build(),
        );

        let config = FillReporterConfig {
            retry: FillRetryConfig {
                max_retries: 2,
                base_delay_ms: 10,
                max_delay_ms: 50,
            },
            ..Default::default()
        };

        let reporter = FillReporter::new(mock_chain.clone(), config);

        // Report a fill
        reporter
            .report_fill(
                U256::from(1),
                U256::from(100) * U256::exp10(18),
                U256::from(1000) * U256::exp10(18),
                H256::random(),
                "bitget-1".to_string(),
                1234567890,
                U256::from(1),
            )
            .await;

        // Inject failure
        mock_chain
            .set_next_error(MockError::SimulatedFailure(1.0))
            .await;

        let pending: Vec<_> = reporter
            .get_pending_fills()
            .into_iter()
            .map(|p| p.report)
            .collect();
        let batch = FillBatch::from_fills(pending, 1);

        // This should succeed on first try since we only inject one error
        let result = reporter.submit_batch(batch).await;
        assert!(result.is_ok());
    }

    // =========================================================================
    // MockChain Integration Tests (AC#6: Works against MockChain from Epic 1)
    // =========================================================================

    use common::types::{LimitOrder, OrderStatus, Side};

    fn create_mock_order(id: u64) -> LimitOrder {
        LimitOrder {
            id: U256::from(id),
            user: ethers::types::Address::random(),
            pair_id: H256::random(),
            side: Side::Buy,
            amount: U256::from(1000u64) * U256::exp10(18),
            limit_price: U256::from(100u64) * U256::exp10(18),
            slippage_tier: U256::from(1),
            deadline: U256::from(u64::MAX),
            itp_id: H256::random(),
            timestamp: U256::from(1234567890u64),
            status: OrderStatus::Pending,
        }
    }

    #[tokio::test]
    async fn test_fills_appear_in_mockchain_state() {
        // AC#6 / Task 6.2: Verify fills appear in MockChain state
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let config = FillReporterConfig::default();
        let reporter = FillReporter::new(mock_chain.clone(), config);

        // Pre-populate MockChain with orders (required for confirm_fills to track them)
        for i in 1..=3 {
            mock_chain.simulate_order_submission(create_mock_order(i)).await;
        }

        // Report and submit fills
        let fill_price = U256::from(100) * U256::exp10(18);
        let fill_amount = U256::from(1000) * U256::exp10(18);

        for i in 1..=3 {
            reporter
                .report_fill(
                    U256::from(i),
                    fill_price,
                    fill_amount,
                    H256::random(),
                    format!("bitget-{}", i),
                    1234567890,
                    U256::from(1),
                )
                .await;
        }

        // Submit to chain
        let results = reporter.submit_pending_fills().await;
        assert!(results.iter().all(|r| r.is_ok()));

        // CRITICAL VERIFICATION: Check MockChain actually received the fills
        let filled_orders = mock_chain.get_filled_orders().await;
        assert_eq!(
            filled_orders.len(),
            3,
            "MockChain should have received 3 fills"
        );

        // Verify fill data integrity
        for fill in &filled_orders {
            assert_eq!(fill.fill_price, fill_price);
            assert_eq!(fill.fill_amount, fill_amount);
            assert_eq!(fill.cycle_number, U256::from(1));
        }

        // Verify order IDs are correct
        let order_ids: Vec<u64> = filled_orders.iter().map(|f| f.order_id.as_u64()).collect();
        assert!(order_ids.contains(&1));
        assert!(order_ids.contains(&2));
        assert!(order_ids.contains(&3));
    }

    #[tokio::test]
    async fn test_batching_with_mockchain() {
        // AC#6 / Task 6.3: Test fill batching with MockChain
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let config = FillReporterConfig {
            batch: FillBatchConfig {
                max_batch_size: 2, // Force multiple batches
                ..Default::default()
            },
            ..Default::default()
        };
        let reporter = FillReporter::new(mock_chain.clone(), config);

        // Pre-populate MockChain with orders
        for i in 1..=5 {
            mock_chain.simulate_order_submission(create_mock_order(i)).await;
        }

        // Report 5 fills across 2 cycles
        for i in 1..=3 {
            reporter
                .report_fill(
                    U256::from(i),
                    U256::from(100) * U256::exp10(18),
                    U256::from(1000) * U256::exp10(18),
                    H256::random(),
                    format!("bitget-{}", i),
                    1234567890,
                    U256::from(1), // Cycle 1
                )
                .await;
        }
        for i in 4..=5 {
            reporter
                .report_fill(
                    U256::from(i),
                    U256::from(100) * U256::exp10(18),
                    U256::from(1000) * U256::exp10(18),
                    H256::random(),
                    format!("bitget-{}", i),
                    1234567890,
                    U256::from(2), // Cycle 2
                )
                .await;
        }

        // Submit - should create 3 batches: (2 from cycle 1), (1 from cycle 1), (2 from cycle 2)
        let results = reporter.submit_pending_fills().await;

        // All batches should succeed
        assert!(results.iter().all(|r| r.is_ok()));

        // Verify MockChain received all 5 fills
        let filled_orders = mock_chain.get_filled_orders().await;
        assert_eq!(filled_orders.len(), 5);
    }

    #[tokio::test]
    async fn test_retry_behavior_with_mockchain_failure_injection() {
        // AC#6 / Task 6.4: Test retry behavior with MockChain failure injection
        use common::mocks::MockError;

        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let config = FillReporterConfig {
            retry: FillRetryConfig {
                max_retries: 3,
                base_delay_ms: 10,
                max_delay_ms: 100,
            },
            ..Default::default()
        };
        let reporter = FillReporter::new(mock_chain.clone(), config);

        // Pre-populate MockChain with the order
        mock_chain.simulate_order_submission(create_mock_order(1)).await;

        // Report a fill
        reporter
            .report_fill(
                U256::from(1),
                U256::from(100) * U256::exp10(18),
                U256::from(1000) * U256::exp10(18),
                H256::random(),
                "bitget-1".to_string(),
                1234567890,
                U256::from(1),
            )
            .await;

        // Inject a single failure - should recover on retry
        mock_chain
            .set_next_error(MockError::SimulatedFailure(1.0))
            .await;

        // Submit - first attempt fails, second succeeds
        let results = reporter.submit_pending_fills().await;
        assert_eq!(results.len(), 1);
        assert!(results[0].is_ok());

        // Fill should appear in MockChain after retry
        let filled_orders = mock_chain.get_filled_orders().await;
        assert_eq!(filled_orders.len(), 1);
        assert_eq!(filled_orders[0].order_id, U256::from(1));
    }

    #[tokio::test]
    async fn test_confirmation_callback_invoked() {
        // MEDIUM-3: Test confirmation callback mechanism
        use std::sync::atomic::{AtomicUsize, Ordering};

        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let config = FillReporterConfig::default();
        let mut reporter = FillReporter::new(mock_chain, config);

        // Track callback invocations
        let callback_count = Arc::new(AtomicUsize::new(0));
        let confirmed_orders = Arc::new(std::sync::Mutex::new(Vec::new()));

        let count_clone = callback_count.clone();
        let orders_clone = confirmed_orders.clone();
        reporter.set_confirmation_callback(move |_tx_hash, order_ids| {
            count_clone.fetch_add(1, Ordering::SeqCst);
            orders_clone.lock().unwrap().extend(order_ids);
        });

        // Report and submit a fill
        reporter
            .report_fill(
                U256::from(42),
                U256::from(100) * U256::exp10(18),
                U256::from(1000) * U256::exp10(18),
                H256::random(),
                "bitget-42".to_string(),
                1234567890,
                U256::from(1),
            )
            .await;

        let results = reporter.submit_pending_fills().await;
        let tx_hash = results[0].as_ref().unwrap();

        // Mark as confirmed - should trigger callback
        reporter.mark_confirmed(*tx_hash);

        // Verify callback was invoked
        assert_eq!(callback_count.load(Ordering::SeqCst), 1);
        let orders = confirmed_orders.lock().unwrap();
        assert_eq!(orders.len(), 1);
        assert_eq!(orders[0], U256::from(42));
    }

    #[tokio::test]
    async fn test_report_fill_simple() {
        // Test simplified interface matching AC#1
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let config = FillReporterConfig::default();
        let reporter = FillReporter::new(mock_chain, config);

        let order_id = reporter
            .report_fill_simple(
                U256::from(1),
                U256::from(100) * U256::exp10(18),
                U256::from(1000) * U256::exp10(18),
                H256::random(),
            )
            .await;

        assert_eq!(order_id, U256::from(1));

        let pending = reporter.get_pending_fills();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].report.order_id, U256::from(1));
        // Simple interface uses empty bitget_order_id
        assert!(pending[0].report.bitget_order_id.is_empty());
    }
}
