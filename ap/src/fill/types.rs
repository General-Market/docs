//! Fill types for AP service
//!
//! Contains AP-specific fill tracking types that extend the common Fill struct.

use ethers::types::U256;
use serde::{Deserialize, Serialize};

use common::types::{Fill, TxHash};

/// Fill status enum tracking the lifecycle of a fill report
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FillStatus {
    /// Fill created, not yet submitted to chain
    Pending,
    /// Fill submitted to chain, awaiting confirmation
    Submitted,
    /// Fill confirmed on chain
    Confirmed,
    /// Fill submission failed after all retries
    Failed,
}

impl Default for FillStatus {
    fn default() -> Self {
        Self::Pending
    }
}

/// AP-specific fill report with additional tracking data
///
/// Extends the on-chain Fill struct with AP-specific metadata
/// for tracking fill submission and retry logic.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct APFillReport {
    // Core fill data (maps to on-chain Fill)
    /// Reference to the original order
    pub order_id: U256,
    /// Actual execution price (18 decimals)
    pub fill_price: U256,
    /// Amount filled in USDC (18 decimals)
    pub fill_amount: U256,
    /// Cycle when filled
    pub cycle_number: U256,
    /// CEX transaction reference
    pub tx_hash: TxHash,

    // AP-specific tracking (not sent on-chain)
    /// Bitget order ID for verification
    pub bitget_order_id: String,
    /// Unix timestamp when fill was executed on Bitget
    pub execution_timestamp: u64,
    /// Unix timestamp when fill report was created
    pub created_at: u64,
    /// Number of retry attempts made
    pub retry_count: u32,
    /// Current status of this fill report
    pub status: FillStatus,
}

impl APFillReport {
    /// Create a new APFillReport from core fill data and Bitget info
    pub fn new(
        order_id: U256,
        fill_price: U256,
        fill_amount: U256,
        cycle_number: U256,
        tx_hash: TxHash,
        bitget_order_id: String,
        execution_timestamp: u64,
    ) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            order_id,
            fill_price,
            fill_amount,
            cycle_number,
            tx_hash,
            bitget_order_id,
            execution_timestamp,
            created_at: now,
            retry_count: 0,
            status: FillStatus::Pending,
        }
    }

    /// Convert to on-chain Fill struct
    pub fn to_fill(&self) -> Fill {
        Fill {
            order_id: self.order_id,
            fill_price: self.fill_price,
            fill_amount: self.fill_amount,
            cycle_number: self.cycle_number,
            tx_hash: self.tx_hash,
        }
    }

    /// Increment retry count
    pub fn increment_retry(&mut self) {
        self.retry_count += 1;
    }
}

/// Pending fill entry stored in the reporter's tracking map
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingFill {
    /// The fill report
    pub report: APFillReport,
    /// Transaction hash of the submission (if submitted)
    pub submission_tx: Option<TxHash>,
    /// Timestamp when last submission was attempted
    pub last_attempt: Option<u64>,
}

impl PendingFill {
    /// Create a new pending fill from an APFillReport
    pub fn new(report: APFillReport) -> Self {
        Self {
            report,
            submission_tx: None,
            last_attempt: None,
        }
    }

    /// Mark as submitted with the given tx hash
    pub fn mark_submitted(&mut self, tx_hash: TxHash) {
        self.report.status = FillStatus::Submitted;
        self.submission_tx = Some(tx_hash);
        self.last_attempt = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        );
    }

    /// Mark as confirmed
    pub fn mark_confirmed(&mut self) {
        self.report.status = FillStatus::Confirmed;
    }

    /// Mark as failed
    pub fn mark_failed(&mut self) {
        self.report.status = FillStatus::Failed;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::H256;

    #[test]
    fn test_fill_status_default() {
        assert_eq!(FillStatus::default(), FillStatus::Pending);
    }

    #[test]
    fn test_ap_fill_report_new() {
        let report = APFillReport::new(
            U256::from(1),
            U256::from(100) * U256::exp10(18),
            U256::from(1000) * U256::exp10(18),
            U256::from(5),
            H256::random(),
            "bitget-123".to_string(),
            1234567890,
        );

        assert_eq!(report.order_id, U256::from(1));
        assert_eq!(report.retry_count, 0);
        assert_eq!(report.status, FillStatus::Pending);
        assert!(!report.bitget_order_id.is_empty());
    }

    #[test]
    fn test_ap_fill_report_to_fill() {
        let report = APFillReport::new(
            U256::from(1),
            U256::from(100) * U256::exp10(18),
            U256::from(1000) * U256::exp10(18),
            U256::from(5),
            H256::random(),
            "bitget-123".to_string(),
            1234567890,
        );

        let fill = report.to_fill();
        assert_eq!(fill.order_id, report.order_id);
        assert_eq!(fill.fill_price, report.fill_price);
        assert_eq!(fill.fill_amount, report.fill_amount);
        assert_eq!(fill.cycle_number, report.cycle_number);
        assert_eq!(fill.tx_hash, report.tx_hash);
    }

    #[test]
    fn test_pending_fill_status_transitions() {
        let report = APFillReport::new(
            U256::from(1),
            U256::from(100) * U256::exp10(18),
            U256::from(1000) * U256::exp10(18),
            U256::from(5),
            H256::random(),
            "bitget-123".to_string(),
            1234567890,
        );

        let mut pending = PendingFill::new(report);
        assert_eq!(pending.report.status, FillStatus::Pending);
        assert!(pending.submission_tx.is_none());

        let tx_hash = H256::random();
        pending.mark_submitted(tx_hash);
        assert_eq!(pending.report.status, FillStatus::Submitted);
        assert_eq!(pending.submission_tx, Some(tx_hash));

        pending.mark_confirmed();
        assert_eq!(pending.report.status, FillStatus::Confirmed);
    }
}
