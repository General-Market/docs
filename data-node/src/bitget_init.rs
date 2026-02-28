//! Shared Bitget client initialization.

use common::integrations::bitget::{BitgetReadOnlyClientImpl, BitgetReadOnlyConfig};
use tracing::error;

/// Create a Bitget read-only client from env config.
/// Returns `None` and logs an error if config or client creation fails.
pub fn create_bitget_client(caller: &str) -> Option<BitgetReadOnlyClientImpl> {
    let config = BitgetReadOnlyConfig::from_env()
        .map_err(|e| error!(?e, "{caller}: failed to load Bitget config"))
        .ok()?;
    BitgetReadOnlyClientImpl::new(config)
        .map_err(|e| error!(?e, "{caller}: failed to create Bitget client"))
        .ok()
}
