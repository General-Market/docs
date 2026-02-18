//! Fill reporting module for AP service
//!
//! This module handles reporting trade fills back to the blockchain.
//!
//! ## Components
//!
//! - `types`: Fill types and status tracking
//! - `batch`: Batching logic for efficient submission
//! - `retry`: Retry configuration and error classification
//! - `reporter`: Main FillReporter implementation

pub mod batch;
pub mod reporter;
pub mod retry;
pub mod types;

// Re-export main types
pub use batch::{batch_fills, FillBatch, FillBatchConfig, FillBatcher};
pub use reporter::{
    BatchTimerHandle, ConfirmationCallback, FillCounts, FillReporter, FillReporterConfig,
    FillSubmitError,
};
pub use retry::{classify_error, ErrorKind, FillRetryConfig};
pub use types::{APFillReport, FillStatus, PendingFill};
