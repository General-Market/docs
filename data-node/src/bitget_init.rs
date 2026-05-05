//! Shared Bitget client initialization.

use common::integrations::bitget::{BitgetReadOnlyClientImpl, BitgetReadOnlyConfig};
use tracing::error;

/// Create a Bitget read-only client from env config.
/// Returns `None` and logs an error at code = "INFRA-013" (loud) if config
/// or client creation fails. Callers MUST treat None as a hard refusal —
/// silently returning from a collector loop is what gave us
/// `bitget_mode=mock` in production for two days.
pub fn create_bitget_client(caller: &str) -> Option<BitgetReadOnlyClientImpl> {
    let config = BitgetReadOnlyConfig::from_env()
        .map_err(|e| error!(code = "INFRA-013", caller = %caller, ?e,
            "Bitget config missing or invalid — collector will refuse to run. \
             Set BITGET_READONLY_API_KEY/SECRET/PASSPHRASE in env."))
        .ok()?;
    BitgetReadOnlyClientImpl::new(config)
        .map_err(|e| error!(code = "INFRA-013", caller = %caller, ?e,
            "Bitget client construction failed — collector will refuse to run."))
        .ok()
}
