//! AP (Authorized Participant) / Keeper service for Index L3
//!
//! This crate implements the AP/Keeper service for monitoring blockchain events
//! and executing trades on Bitget CEX.
//!
//! ## Architecture
//!
//! The AP's ONLY source of work is blockchain events - it does NOT communicate
//! directly with Issuers. All coordination happens through on-chain events:
//!
//! - `TradeRequest` events trigger CEX trade execution
//! - `WithdrawalRequest` events trigger CEX withdrawals
//!
//! ## Components
//!
//! - Event monitoring (4.2): Subscribes to blockchain events
//! - Order queue management (4.3): Manages order execution priority
//! - Fill reporting (4.4): Reports trade fills back to chain
//! - Buffer management (4.5): Instant fills for small orders from buffer
//! - Timeout handling (4.7): Order timeout detection and retry management
//! - Source failure handling (4.10): AP suspension, auto-pause, and restoration
//! - External integrations (Epic 5): Bitget, 1inch, and other external APIs

pub mod block_tracker;
pub mod buffer;
pub mod config;
pub mod error;
pub mod event_monitor;
pub mod event_queue;
pub mod event_types;
pub mod external;
pub mod fill;
pub mod limit_enforcer;
pub mod metrics;
pub mod queue;
pub mod source_failure;
pub mod timeout;

pub use block_tracker::BlockTracker;
pub use buffer::{
    AssetBalance, AssetBufferConfig, BufferConfig, BufferFillResult, BufferHealthCheck,
    BufferHealthStatus, BufferManager, BufferMetrics, BufferMetricsSnapshot, ReplenishmentOrder,
};
pub use common;
pub use config::{APConfig, ConfigBuilder, ConfigError};
pub use error::APError;
pub use event_monitor::{EventMonitor, EventMonitorBuilder, EventMonitorConfig};
pub use event_queue::{APEvent, EventQueue, EventReceiver};
pub use event_types::{TradeRequestEvent, WithdrawalRequestEvent};
pub use fill::{
    APFillReport, BatchTimerHandle, ConfirmationCallback, FillBatch, FillBatchConfig, FillCounts,
    FillReporter, FillReporterConfig, FillRetryConfig, FillStatus, FillSubmitError, PendingFill,
};
pub use limit_enforcer::{
    LimitEnforcerMetrics, LimitOrderEnforcer, LimitViolation, ValidationResult,
    ALERT_THRESHOLD, BPS_DENOMINATOR, LIMIT_TOLERANCE_BPS, VIOLATION_WINDOW_HOURS,
};
pub use queue::{
    Bucket, ExpiredOrder, OrderQueueManager, QueueDepth, QueuedOrder, RetryOrder,
    ThreadSafeQueueManager,
};
pub use timeout::{
    FailedOrder, TimeoutConfig, TimeoutEvent, TimeoutHandler, TimeoutMetrics,
    TimeoutMetricsSnapshot, TimeoutStatus, TrackedOrder,
};
pub use metrics::{
    APMetrics, HealthDetails, HealthStatus, HealthThresholds, MetricsSnapshot,
    PrometheusFormatter, Thresholds,
};
pub use source_failure::{
    APOperationalState, PendingRefundOrder, RefundReason, RefundRequest, RestorationReport,
    SourceFailureConfig, SourceFailureEvent, SourceFailureHandler, SourceFailureMetrics,
    SourceFailureMetricsSnapshot, SuspensionReason,
};

// External integrations (Story 5.1+, 6.4, 6.17)
pub use external::bitget::{
    BitgetClient, BitgetConfig, BitgetCredentials, BitgetError, OrderSide,
    RateLimitedBitgetClient,
};
pub use external::bitget_vault::{BitgetVaultClient, BitgetVaultError};
pub use common::adapters::BitgetVaultFill;
