//! Source Failure Handler for AP/Keeper service
//!
//! Handles AP source failures with suspension, auto-pause, 1-hour pending order
//! timeout, and restoration mechanisms.
//!
//! ## Architecture
//!
//! The source failure handler implements a state machine:
//! - Active: Normal operation, processing TradeRequest events
//! - Paused: Soft pause (5 min no fills), orders queued
//! - Suspended: Full suspension, admin intervention required
//!
//! ## Key Thresholds (per architecture Section 16)
//!
//! - Auto-pause threshold: 5 minutes no fills
//! - Pending order timeout: 1 hour
//! - BLS vote for suspension: 11/20 issuers
//! - Restoration: Admin only

mod config;
mod handler;
mod metrics;
mod types;

pub use config::SourceFailureConfig;
pub use handler::SourceFailureHandler;
pub use metrics::{SourceFailureMetrics, SourceFailureMetricsSnapshot};
pub use types::{
    APOperationalState, PendingRefundOrder, RefundReason, RefundRequest, RestorationReport,
    SourceFailureEvent, SuspensionReason,
};

#[cfg(test)]
mod tests;
