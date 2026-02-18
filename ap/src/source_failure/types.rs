//! Type definitions for source failure handling
//!
//! Includes state enums, pending order tracking, and event types.

use alloy_primitives::{Address, U256};
use std::time::Duration;
use tokio::time::Instant;

/// AP operational state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum APOperationalState {
    /// Normal operation - processing TradeRequest events
    Active,
    /// Soft pause - orders queued, monitoring for restoration
    Paused,
    /// Full suspension - no processing, admin intervention required
    Suspended,
}

impl APOperationalState {
    /// Returns true if the AP is not in Active state
    pub fn is_suspended_or_paused(&self) -> bool {
        matches!(self, Self::Paused | Self::Suspended)
    }

    /// Returns string representation for metrics/logging
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Paused => "paused",
            Self::Suspended => "suspended",
        }
    }
}

/// Reason for AP suspension
#[derive(Debug, Clone)]
pub enum SuspensionReason {
    /// Auto-pause triggered by extended offline (no fills)
    AutoPause {
        /// Duration the AP was offline
        offline_duration: Duration,
    },
    /// BLS vote from issuers triggered suspension
    BLSVote {
        /// Number of issuers who voted for suspension
        voter_count: u8,
    },
    /// Admin manually suspended the AP
    AdminAction {
        /// Admin address who triggered suspension
        admin: Address,
        /// Reason provided for suspension
        reason: String,
    },
}

impl SuspensionReason {
    /// Returns a human-readable description of the suspension reason
    pub fn description(&self) -> String {
        match self {
            Self::AutoPause { offline_duration } => {
                format!("Auto-pause: no fills for {:?}", offline_duration)
            }
            Self::BLSVote { voter_count } => {
                format!("BLS vote: {}/20 issuers voted for suspension", voter_count)
            }
            Self::AdminAction { admin, reason } => {
                format!("Admin action by {}: {}", admin, reason)
            }
        }
    }
}

/// Source type for pending orders
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceType {
    /// Centralized exchange (Bitget)
    CEX,
    /// Decentralized exchange (1inch, Uniswap)
    DEX,
}

/// A pending order awaiting refund during AP suspension
#[derive(Debug, Clone)]
pub struct PendingRefundOrder {
    /// Order identifier (event_id format: "block:tx_hash:log_index")
    pub order_id: String,
    /// When the order was received
    pub received_at: Instant,
    /// User address who submitted the order
    pub user: Address,
    /// Order amount in collateral (WIND, 18 decimals)
    pub amount: U256,
    /// Source type for the order
    pub source: SourceType,
    /// Block number of the TradeRequest event
    pub trade_request_block: u64,
}

impl PendingRefundOrder {
    /// Create a new pending refund order
    pub fn new(
        order_id: String,
        user: Address,
        amount: U256,
        source: SourceType,
        trade_request_block: u64,
    ) -> Self {
        Self {
            order_id,
            received_at: Instant::now(),
            user,
            amount,
            source,
            trade_request_block,
        }
    }

    /// Check if order has exceeded the pending timeout
    pub fn is_timed_out(&self, timeout: Duration) -> bool {
        self.received_at.elapsed() >= timeout
    }

    /// Get how long the order has been pending
    pub fn pending_duration(&self) -> Duration {
        self.received_at.elapsed()
    }
}

/// Reason for order refund
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RefundReason {
    /// Order pending > 1 hour
    Timeout,
    /// E008 - liquidity source offline
    SourceUnavailable,
    /// AP suspended during order processing
    APSuspended,
}

impl RefundReason {
    /// Get error code for this refund reason
    pub fn error_code(&self) -> &'static str {
        match self {
            Self::Timeout => "E009",
            Self::SourceUnavailable => "E008",
            Self::APSuspended => "E008",
        }
    }

    /// Get description for logging
    pub fn description(&self) -> &'static str {
        match self {
            Self::Timeout => "Order pending timeout exceeded",
            Self::SourceUnavailable => "Liquidity source unavailable",
            Self::APSuspended => "AP suspended during processing",
        }
    }
}

/// Request to refund an order
#[derive(Debug, Clone)]
pub struct RefundRequest {
    /// Order identifier
    pub order_id: String,
    /// User address to refund
    pub user: Address,
    /// Amount to refund (in collateral)
    pub amount: U256,
    /// Reason for refund
    pub reason: RefundReason,
    /// How long the order was pending
    pub pending_duration: Duration,
}

impl RefundRequest {
    /// Create a new refund request
    pub fn from_pending_order(order: &PendingRefundOrder, reason: RefundReason) -> Self {
        Self {
            order_id: order.order_id.clone(),
            user: order.user,
            amount: order.amount,
            reason,
            pending_duration: order.pending_duration(),
        }
    }
}

/// Record of a refunded order (for audit trail)
#[derive(Debug, Clone)]
pub struct RefundedOrder {
    /// Original order ID
    pub order_id: String,
    /// User who was refunded
    pub user: Address,
    /// Amount refunded
    pub amount: U256,
    /// Reason for refund
    pub reason: RefundReason,
    /// When the refund was processed
    pub refunded_at: Instant,
    /// Duration the order was pending
    pub pending_duration: Duration,
}

impl RefundedOrder {
    /// Create from a refund request
    pub fn from_request(request: &RefundRequest) -> Self {
        Self {
            order_id: request.order_id.clone(),
            user: request.user,
            amount: request.amount,
            reason: request.reason.clone(),
            refunded_at: Instant::now(),
            pending_duration: request.pending_duration,
        }
    }
}

/// Report generated after AP restoration
#[derive(Debug, Clone)]
pub struct RestorationReport {
    /// Number of orders moved back to execution queue
    pub orders_processed: u32,
    /// Number of orders that exceeded timeout and were refunded
    pub orders_refunded: u32,
    /// Total duration the AP was suspended
    pub downtime_duration: Duration,
    /// When restoration completed
    pub restored_at: Instant,
    /// Admin address who triggered restoration (if available)
    pub restored_by: Option<Address>,
}

/// Events emitted by the source failure handler
#[derive(Debug, Clone)]
pub enum SourceFailureEvent {
    /// AP has been suspended
    Suspended {
        /// Reason for suspension
        reason: SuspensionReason,
        /// When suspension occurred
        timestamp: Instant,
    },
    /// AP has been restored
    Restored {
        /// Restoration report
        report: RestorationReport,
        /// When restoration occurred
        timestamp: Instant,
    },
    /// Orders have been requested for refund
    RefundRequested {
        /// List of refund requests
        orders: Vec<RefundRequest>,
        /// When requests were generated
        timestamp: Instant,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_operational_state() {
        assert!(!APOperationalState::Active.is_suspended_or_paused());
        assert!(APOperationalState::Paused.is_suspended_or_paused());
        assert!(APOperationalState::Suspended.is_suspended_or_paused());

        assert_eq!(APOperationalState::Active.as_str(), "active");
        assert_eq!(APOperationalState::Paused.as_str(), "paused");
        assert_eq!(APOperationalState::Suspended.as_str(), "suspended");
    }

    #[test]
    fn test_suspension_reason_description() {
        let auto_pause = SuspensionReason::AutoPause {
            offline_duration: Duration::from_secs(300),
        };
        // Rust Debug format shows "300s" not "5m"
        assert!(auto_pause.description().contains("300"));

        let bls_vote = SuspensionReason::BLSVote { voter_count: 11 };
        assert!(bls_vote.description().contains("11/20"));
    }

    #[test]
    fn test_refund_reason_error_codes() {
        assert_eq!(RefundReason::Timeout.error_code(), "E009");
        assert_eq!(RefundReason::SourceUnavailable.error_code(), "E008");
        assert_eq!(RefundReason::APSuspended.error_code(), "E008");
    }

    #[test]
    fn test_pending_order_creation() {
        let order = PendingRefundOrder::new(
            "100:0x123:0".to_string(),
            Address::ZERO,
            U256::from(1000),
            SourceType::CEX,
            100,
        );
        assert_eq!(order.order_id, "100:0x123:0");
        assert_eq!(order.trade_request_block, 100);
    }

    #[test]
    fn test_refund_request_from_pending() {
        let order = PendingRefundOrder::new(
            "100:0x123:0".to_string(),
            Address::ZERO,
            U256::from(1000),
            SourceType::DEX,
            100,
        );
        let request = RefundRequest::from_pending_order(&order, RefundReason::Timeout);
        assert_eq!(request.order_id, "100:0x123:0");
        assert_eq!(request.reason, RefundReason::Timeout);
    }
}
