//! Mock implementations for testing Index L3 components
//!
//! This module provides mock implementations of all external dependencies,
//! allowing developers to test components in isolation without real chain/CEX connections.
//!
//! All mocks are designed for use in `#[cfg(test)]` contexts or with the `mock` feature flag.

mod bitget;
mod chain;
mod error;
mod issuer;
mod p2p;
mod price_fetcher;

pub use bitget::*;
pub use chain::*;
pub use error::*;
pub use issuer::*;
pub use p2p::*;
pub use price_fetcher::*;
