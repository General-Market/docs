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

// TODO: Wire into AP pipeline — FillBatcher, FillReporter, and batch submission
// are fully implemented but not yet connected to the event processing loop in main.rs.
// The AP currently places orders and polls fills inline; these modules should replace
// that with proper batched fill reporting to the chain.
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
