//! Fill batching logic for efficient chain submission
//!
//! Batches multiple fills into single transactions to reduce gas costs.

use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tracing::{debug, info};

use super::types::APFillReport;

/// Default maximum fills per batch transaction
pub const DEFAULT_MAX_BATCH_SIZE: usize = 50;

/// Default window to accumulate fills before submitting (milliseconds)
pub const DEFAULT_BATCH_WINDOW_MS: u64 = 500;

/// Configuration for fill batching behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FillBatchConfig {
    /// Maximum number of fills per batch transaction
    pub max_batch_size: usize,
    /// Time window in milliseconds to accumulate fills
    pub batch_window_ms: u64,
}

impl Default for FillBatchConfig {
    fn default() -> Self {
        Self {
            max_batch_size: DEFAULT_MAX_BATCH_SIZE,
            batch_window_ms: DEFAULT_BATCH_WINDOW_MS,
        }
    }
}

impl FillBatchConfig {
    /// Get batch window as Duration
    pub fn batch_window(&self) -> Duration {
        Duration::from_millis(self.batch_window_ms)
    }
}

/// A batch of fills ready for submission
#[derive(Debug, Clone)]
pub struct FillBatch {
    /// The fills in this batch
    pub fills: Vec<APFillReport>,
    /// Cycle number for this batch
    pub cycle_number: u64,
    /// Timestamp when batch was created
    pub created_at: Instant,
}

impl FillBatch {
    /// Create a new empty batch for the given cycle
    pub fn new(cycle_number: u64) -> Self {
        Self {
            fills: Vec::new(),
            cycle_number,
            created_at: Instant::now(),
        }
    }

    /// Create a batch from a vector of fills
    pub fn from_fills(fills: Vec<APFillReport>, cycle_number: u64) -> Self {
        Self {
            fills,
            cycle_number,
            created_at: Instant::now(),
        }
    }

    /// Add a fill to the batch
    pub fn add(&mut self, fill: APFillReport) {
        self.fills.push(fill);
    }

    /// Check if batch is empty
    pub fn is_empty(&self) -> bool {
        self.fills.is_empty()
    }

    /// Get number of fills in batch
    pub fn len(&self) -> usize {
        self.fills.len()
    }

    /// Check if batch is at capacity
    pub fn is_full(&self, max_size: usize) -> bool {
        self.fills.len() >= max_size
    }

    /// Get order IDs for all fills in batch
    pub fn order_ids(&self) -> Vec<u64> {
        self.fills
            .iter()
            .filter_map(|f| f.order_id.try_into().ok())
            .collect()
    }
}

/// Batches incoming fills and emits complete batches
pub struct FillBatcher {
    config: FillBatchConfig,
    current_batch: Option<FillBatch>,
    batch_tx: mpsc::Sender<FillBatch>,
}

impl FillBatcher {
    /// Create a new batcher with the given config and output channel
    pub fn new(config: FillBatchConfig, batch_tx: mpsc::Sender<FillBatch>) -> Self {
        Self {
            config,
            current_batch: None,
            batch_tx,
        }
    }

    /// Add a fill to be batched
    ///
    /// May emit a batch if:
    /// - Batch reaches max_batch_size
    /// - Cycle number changes
    pub async fn add_fill(&mut self, fill: APFillReport) -> Result<(), BatchError> {
        let fill_cycle = fill.cycle_number.as_u64();

        // Check if we need to flush current batch due to cycle change
        if let Some(ref batch) = self.current_batch {
            if batch.cycle_number != fill_cycle {
                debug!(
                    cycle = batch.cycle_number,
                    new_cycle = fill_cycle,
                    "Cycle changed, flushing batch"
                );
                self.flush().await?;
            }
        }

        // Get or create batch for this cycle
        let batch = self
            .current_batch
            .get_or_insert_with(|| FillBatch::new(fill_cycle));

        batch.add(fill);

        // Flush if at capacity
        if batch.is_full(self.config.max_batch_size) {
            info!(
                cycle = batch.cycle_number,
                count = batch.len(),
                "Batch full, flushing"
            );
            self.flush().await?;
        }

        Ok(())
    }

    /// Flush current batch if not empty
    pub async fn flush(&mut self) -> Result<(), BatchError> {
        if let Some(batch) = self.current_batch.take() {
            if !batch.is_empty() {
                debug!(
                    cycle = batch.cycle_number,
                    count = batch.len(),
                    "Flushing batch"
                );
                self.batch_tx
                    .send(batch)
                    .await
                    .map_err(|_| BatchError::ChannelClosed)?;
            }
        }
        Ok(())
    }

    /// Check if batch should be flushed due to time window
    pub fn should_flush_by_time(&self) -> bool {
        if let Some(ref batch) = self.current_batch {
            if !batch.is_empty() && batch.created_at.elapsed() >= self.config.batch_window() {
                return true;
            }
        }
        false
    }

    /// Get current batch size (for metrics)
    pub fn current_batch_size(&self) -> usize {
        self.current_batch.as_ref().map(|b| b.len()).unwrap_or(0)
    }
}

/// Errors that can occur during batching
#[derive(Debug, thiserror::Error)]
pub enum BatchError {
    #[error("Batch output channel closed")]
    ChannelClosed,
}

/// Batch multiple fills into optimally sized batches
///
/// Splits fills into batches respecting max_batch_size.
/// Fills for the same cycle are grouped together.
/// Uses BTreeMap for deterministic ordering by cycle number.
pub fn batch_fills(fills: Vec<APFillReport>, config: &FillBatchConfig) -> Vec<FillBatch> {
    if fills.is_empty() {
        return Vec::new();
    }

    // Group by cycle using BTreeMap for deterministic ordering
    let mut by_cycle: std::collections::BTreeMap<u64, Vec<APFillReport>> =
        std::collections::BTreeMap::new();

    for fill in fills {
        let cycle = fill.cycle_number.as_u64();
        by_cycle.entry(cycle).or_default().push(fill);
    }

    // Create batches respecting max size (cycles are now in sorted order)
    let mut batches = Vec::new();

    for (cycle, cycle_fills) in by_cycle {
        for chunk in cycle_fills.chunks(config.max_batch_size) {
            batches.push(FillBatch::from_fills(chunk.to_vec(), cycle));
        }
    }

    batches
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::{H256, U256};

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

    #[test]
    fn test_fill_batch_operations() {
        let mut batch = FillBatch::new(1);
        assert!(batch.is_empty());
        assert_eq!(batch.len(), 0);

        batch.add(create_test_fill(1, 1));
        assert!(!batch.is_empty());
        assert_eq!(batch.len(), 1);

        batch.add(create_test_fill(2, 1));
        assert_eq!(batch.len(), 2);

        assert!(!batch.is_full(3));
        batch.add(create_test_fill(3, 1));
        assert!(batch.is_full(3));
    }

    #[test]
    fn test_batch_fills_empty() {
        let config = FillBatchConfig::default();
        let batches = batch_fills(Vec::new(), &config);
        assert!(batches.is_empty());
    }

    #[test]
    fn test_batch_fills_single() {
        let config = FillBatchConfig::default();
        let fills = vec![create_test_fill(1, 1)];
        let batches = batch_fills(fills, &config);

        assert_eq!(batches.len(), 1);
        assert_eq!(batches[0].len(), 1);
        assert_eq!(batches[0].cycle_number, 1);
    }

    #[test]
    fn test_batch_fills_multiple_same_cycle() {
        let config = FillBatchConfig {
            max_batch_size: 2,
            ..Default::default()
        };

        let fills: Vec<_> = (1..=5).map(|i| create_test_fill(i, 1)).collect();
        let batches = batch_fills(fills, &config);

        // 5 fills with batch size 2 = 3 batches (2, 2, 1)
        assert_eq!(batches.len(), 3);

        let total_fills: usize = batches.iter().map(|b| b.len()).sum();
        assert_eq!(total_fills, 5);
    }

    #[test]
    fn test_batch_fills_multiple_cycles() {
        let config = FillBatchConfig::default();

        let fills = vec![
            create_test_fill(1, 1),
            create_test_fill(2, 1),
            create_test_fill(3, 2),
            create_test_fill(4, 2),
        ];

        let batches = batch_fills(fills, &config);

        // 2 cycles = 2 batches (each with 2 fills)
        assert_eq!(batches.len(), 2);

        // Verify all fills are accounted for
        let total_fills: usize = batches.iter().map(|b| b.len()).sum();
        assert_eq!(total_fills, 4);
    }

    #[tokio::test]
    async fn test_fill_batcher_add_and_flush() {
        let config = FillBatchConfig {
            max_batch_size: 3,
            batch_window_ms: 1000,
        };

        let (tx, mut rx) = mpsc::channel(10);
        let mut batcher = FillBatcher::new(config, tx);

        // Add fills but don't hit capacity
        batcher.add_fill(create_test_fill(1, 1)).await.unwrap();
        batcher.add_fill(create_test_fill(2, 1)).await.unwrap();
        assert_eq!(batcher.current_batch_size(), 2);

        // No batch should be emitted yet
        assert!(rx.try_recv().is_err());

        // Manually flush
        batcher.flush().await.unwrap();
        assert_eq!(batcher.current_batch_size(), 0);

        // Batch should be available
        let batch = rx.try_recv().unwrap();
        assert_eq!(batch.len(), 2);
        assert_eq!(batch.cycle_number, 1);
    }

    #[tokio::test]
    async fn test_fill_batcher_auto_flush_on_capacity() {
        let config = FillBatchConfig {
            max_batch_size: 2,
            batch_window_ms: 1000,
        };

        let (tx, mut rx) = mpsc::channel(10);
        let mut batcher = FillBatcher::new(config, tx);

        // Add fills to hit capacity
        batcher.add_fill(create_test_fill(1, 1)).await.unwrap();
        batcher.add_fill(create_test_fill(2, 1)).await.unwrap();

        // Batch should be auto-flushed
        let batch = rx.try_recv().unwrap();
        assert_eq!(batch.len(), 2);
        assert_eq!(batcher.current_batch_size(), 0);
    }

    #[tokio::test]
    async fn test_fill_batcher_cycle_change_flushes() {
        let config = FillBatchConfig {
            max_batch_size: 10,
            batch_window_ms: 1000,
        };

        let (tx, mut rx) = mpsc::channel(10);
        let mut batcher = FillBatcher::new(config, tx);

        // Add fills for cycle 1
        batcher.add_fill(create_test_fill(1, 1)).await.unwrap();
        batcher.add_fill(create_test_fill(2, 1)).await.unwrap();

        // Add fill for cycle 2 - should flush cycle 1 batch
        batcher.add_fill(create_test_fill(3, 2)).await.unwrap();

        // Cycle 1 batch should be available
        let batch = rx.try_recv().unwrap();
        assert_eq!(batch.len(), 2);
        assert_eq!(batch.cycle_number, 1);

        // Cycle 2 fill should be in current batch
        assert_eq!(batcher.current_batch_size(), 1);
    }
}
