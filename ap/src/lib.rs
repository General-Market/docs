//! AP (Authorized Participant) / Keeper service for Index L3
//!
//! This crate implements the AP/Keeper service for monitoring blockchain events
//! and executing trades on Bitget CEX.
//!
//! ## Architecture
//!
//! The AP's ONLY source of work is blockchain events - it does NOT communicate
//! directly with Oracles. All coordination happens through on-chain events:
//!
//! - `TradeRequest` events trigger CEX trade execution
//! - `WithdrawalRequest` events trigger CEX withdrawals
//!
//! ## Components
//!
//! - Event monitoring (4.2): Subscribes to blockchain events
//! - Timeout handling (4.7): Order timeout detection and retry management
//! - External integrations (Epic 5): Bitget and other external APIs

pub mod block_tracker;
pub mod config;
pub mod error;
pub mod event_monitor;
pub mod event_queue;
pub mod event_types;
pub mod external;
pub mod limit_enforcer;
pub mod metrics;
pub mod sse_client;
pub mod timeout;

pub use block_tracker::BlockTracker;
pub use common;
pub use config::{APConfig, ConfigBuilder, ConfigError};
pub use error::APError;
pub use event_monitor::{EventMonitor, EventMonitorBuilder, EventMonitorConfig};
pub use event_queue::{APEvent, EventQueue, EventReceiver};
pub use event_types::{TradeRequestEvent, WithdrawalRequestEvent};
pub use limit_enforcer::{
    LimitEnforcerMetrics, LimitOrderEnforcer, LimitViolation, ValidationResult,
    ALERT_THRESHOLD, BPS_DENOMINATOR, LIMIT_TOLERANCE_BPS, VIOLATION_WINDOW_HOURS,
};
pub use timeout::{
    FailedOrder, TimeoutConfig, TimeoutEvent, TimeoutHandler, TimeoutMetrics,
    TimeoutMetricsSnapshot, TimeoutStatus, TrackedOrder,
};
pub use metrics::{
    APMetrics, HealthDetails, HealthStatus, HealthThresholds, MetricsSnapshot,
    PrometheusFormatter, Thresholds,
};

// External integrations (Story 5.1+, 6.4, 6.17)
pub use external::bitget::{
    BitgetClient, BitgetConfig, BitgetCredentials, BitgetError, OrderSide,
    RateLimitedBitgetClient,
};
pub use external::bitget_vault::{BitgetVaultClient, BitgetVaultError};
pub use common::adapters::BitgetVaultFill;
