//! Shared EVM provider + contract initialization.

use std::sync::Arc;

use ethers::prelude::*;
use tracing::error;

/// Create an RPC provider and parse a contract address.
/// Returns `None` and logs errors on failure.
pub fn create_provider_and_address(
    rpc_url: &str,
    address: &str,
    caller: &str,
) -> Option<(Arc<Provider<Http>>, Address)> {
    let provider = Provider::<Http>::try_from(rpc_url)
        .map_err(|e| error!(%e, "{caller}: failed to create RPC provider"))
        .ok()?;
    let addr: Address = address
        .parse()
        .map_err(|e| error!(%e, "{caller}: failed to parse contract address"))
        .ok()?;
    Some((Arc::new(provider), addr))
}
