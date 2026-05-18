//! Env-driven configuration. Same philosophy as the oracle daemon —
//! the process holds no state beyond what the environment grants it.

use anyhow::{Context, Result};
use solana_pubkey::Pubkey;
use std::str::FromStr;

/// Program ID matches the `declare_id!` in `prediction-market`. Operators
/// may override it, but the default should almost always be correct.
const DEFAULT_PROGRAM_ID: &str = "DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA";

#[derive(Clone, Debug)]
pub struct Config {
    /// Solana JSON-RPC HTTP endpoint. Used for one-shot queries.
    pub rpc_http_url: String,
    /// Solana websocket endpoint. Used for `logsSubscribe`.
    pub rpc_ws_url: String,
    /// Deployed program ID to filter logs against.
    pub program_id: Pubkey,
    /// Postgres connection string (libpq format).
    pub postgres_url: String,
    /// Schema to place indexer tables under.
    pub postgres_schema: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let rpc_http_url = std::env::var("RPC_HTTP_URL")
            .or_else(|_| std::env::var("RPC_URL"))
            .context("RPC_HTTP_URL (or RPC_URL) is required")?;

        let rpc_ws_url = std::env::var("RPC_WS_URL")
            .unwrap_or_else(|_| derive_ws_from_http(&rpc_http_url));

        let program_id = match std::env::var("PROGRAM_ID") {
            Ok(s) => Pubkey::from_str(s.trim())
                .context("PROGRAM_ID is not a valid base58 pubkey")?,
            Err(_) => Pubkey::from_str(DEFAULT_PROGRAM_ID).unwrap(),
        };

        let postgres_url = std::env::var("POSTGRES_URL")
            .or_else(|_| std::env::var("DATABASE_URL"))
            .context("POSTGRES_URL (or DATABASE_URL) is required")?;

        let postgres_schema = std::env::var("POSTGRES_SCHEMA")
            .unwrap_or_else(|_| "prediction_market".to_string());

        Ok(Self {
            rpc_http_url,
            rpc_ws_url,
            program_id,
            postgres_url,
            postgres_schema,
        })
    }
}

/// Swap `http(s)://` for `ws(s)://`. Solana public endpoints answer both
/// on the same host; the caller is free to pass `RPC_WS_URL` explicitly
/// when the deployment disagrees with that convention.
fn derive_ws_from_http(http: &str) -> String {
    if let Some(rest) = http.strip_prefix("https://") {
        format!("wss://{}", rest)
    } else if let Some(rest) = http.strip_prefix("http://") {
        format!("ws://{}", rest)
    } else {
        http.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn http_to_ws_mapping() {
        assert_eq!(derive_ws_from_http("https://api.mainnet-beta.solana.com"),
                   "wss://api.mainnet-beta.solana.com");
        assert_eq!(derive_ws_from_http("http://localhost:8899"),
                   "ws://localhost:8899");
        assert_eq!(derive_ws_from_http("ws://already"), "ws://already");
    }
}
