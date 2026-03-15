//! Cycle management module for Index L3 Oracle Node
//!
//! Implements the 1-second cycle structure with 5 phases:
//! PROCESS_FILLS -> NETTING -> INVENTORY_CHECK -> GENERATE_BATCH -> SIGN_SUBMIT
//!
//! Each cycle runs for approximately 1 second (configurable for testing),
//! with each phase receiving approximately 200ms.

mod manager;
pub mod ntp;
mod phase;
mod state;

pub use manager::{CycleConfig, CycleManager, MIN_CYCLE_DURATION_MS};
pub use ntp::NtpSync;
pub use phase::CyclePhase;
pub use state::{CycleState, CycleTrigger};

#[cfg(test)]
mod tests;
