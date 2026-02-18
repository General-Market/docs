//! Timeout Handler for AP/Keeper service
//!
//! Monitors order execution timeouts and manages retry logic.
//! Per architecture NFR8: orders must be filled within 60 seconds.
//!
//! ## Flow
//! 1. Orders are tracked when submitted for execution
//! 2. Background task checks for timeouts every 1 second
//! 3. Timed out orders move to retry queue (max 3 retries)
//! 4. Permanently failed orders are logged for investigation

mod config;
mod handler;
mod metrics;
mod types;

pub use config::TimeoutConfig;
pub use handler::TimeoutHandler;
pub use metrics::{TimeoutMetrics, TimeoutMetricsSnapshot};
pub use types::{FailedOrder, TimeoutEvent, TimeoutStatus, TrackedOrder};

#[cfg(test)]
mod tests;
