//! HTTP API module for Issuer node
//!
//! Provides public HTTP endpoints for external callers to obtain BLS-signed data.
//!
//! ## Endpoints
//!
//! - `GET /api/nav-sign?itp={address}` - Returns BLS-signed NAV price for an ITP (Story 8.3)
//!
//! ## Security Model
//!
//! All endpoints are public (no authentication). Security comes from BLS signature verification:
//! - Anyone can request individual BLS signatures from issuers
//! - Signatures are only useful when aggregated from 2/3+ of issuers
//! - Aggregated signatures are verified on-chain against IssuerRegistry aggregated pubkey

pub mod backend_nav;
mod itp_registry;
mod nav;
mod nav_sign;

pub use backend_nav::BackendNavCalculator;
pub use itp_registry::{EthersItpRegistryReader, ItpRegistryConfig, StubItpRegistryReader};
pub use nav::{DefaultNavCalculator, MockNavCalculator, NavCalculator, NavCalculatorError};
pub use nav_sign::{
    build_nav_message_hash, handle_nav_sign_request, ItpInfo, ItpRegistryReader, NavCacheEntry,
    NavSignError, NavSignHandler, NavSignRequest, NavSignResponse,
};
