//! Shared EVM provider + contract initialization.
//!
//! One `reqwest::Client` per RPC host, bounded idle pool, HTTP/2 adaptive
//! window. Without this, every `Provider::<Http>::try_from(url)` site builds
//! its own un-pooled client and the L3 RPC ends up hoarding hundreds of
//! ESTABLISHED sockets.
//!
//! Note: ethers 2.x ships against reqwest 0.11. The rest of data-node uses
//! reqwest 0.12. We import the 0.11 line as `reqwest_011` so we can hand
//! ethers a Client of the type it actually wants.

use std::sync::Arc;
use std::time::Duration;

use ethers::prelude::*;
use ethers::providers::Http;
use tracing::error;

/// Build a `reqwest::Client` (0.11 line — the one ethers 2.x expects) tuned
/// for long-lived RPC traffic. `pool_max_idle_per_host` caps idle sockets per
/// host so concurrent tasks reuse the same TCP connection.
pub fn pooled_http_client() -> Result<reqwest_011::Client, reqwest_011::Error> {
    reqwest_011::Client::builder()
        .pool_max_idle_per_host(8)
        .pool_idle_timeout(Duration::from_secs(90))
        .tcp_keepalive(Duration::from_secs(60))
        .timeout(Duration::from_secs(30))
        .http2_adaptive_window(true)
        .build()
}

/// Build an ethers `Provider<Http>` that reuses the given pooled client.
pub fn build_pooled_provider(
    rpc_url: &str,
    client: reqwest_011::Client,
) -> Result<Provider<Http>, url::ParseError> {
    let url: url::Url = rpc_url.parse()?;
    Ok(Provider::new(Http::new_with_client(url, client)))
}

/// Parse a contract address and pair it with an already-built shared provider.
/// Returns `None` and logs on failure.
pub fn provider_and_address(
    provider: &Arc<Provider<Http>>,
    address: &str,
    caller: &str,
) -> Option<(Arc<Provider<Http>>, Address)> {
    let addr: Address = address
        .parse()
        .map_err(|e| error!(%e, "{caller}: failed to parse contract address"))
        .ok()?;
    Some((Arc::clone(provider), addr))
}
