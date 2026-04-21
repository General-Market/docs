//! Library surface for the oracle daemon. The binary target in `main.rs`
//! uses these same modules; exposing them through `lib.rs` lets integration
//! tests reach in without duplicating code.

pub mod config;
pub mod feed;
pub mod identity;
pub mod metrics;
pub mod payload;
pub mod scanner;
pub mod scheduler;
pub mod submitter;
