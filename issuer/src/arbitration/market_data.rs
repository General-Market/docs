//! Data-node price fetcher for arbitration
//!
//! Queries the data-node REST API (`/market/prices/{source}`) to fetch exit prices
//! for arbitration resolution. Replaces AA's direct Postgres access.
//!
//! ## Source IDs
//! - `"stocks"` — Finnhub equities (most bilateral bets target stocks)
//! - `"coingecko"` — Crypto assets (fallback source)

use reqwest::Client;
use serde::Deserialize;
use thiserror::Error;
use tracing::debug;

use super::types::ArbitrationTradePrice;

// ============================================================================
// Error Type
// ============================================================================

#[derive(Error, Debug)]
pub enum PriceFetchError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("No price found for symbol: {0}")]
    NotFound(String),
    #[error("Price data invalid for {symbol}: {reason}")]
    InvalidData { symbol: String, reason: String },
}

// ============================================================================
// Data-node API response types
// ============================================================================

/// Response from data-node `GET /market/prices/{source}?symbols=...`
///
/// Full response includes `source`, `total`, `page`, `limit` fields;
/// we only need `prices`.
#[derive(Debug, Deserialize)]
struct MarketPricesResponse {
    prices: Vec<MarketPriceSummary>,
}

/// Single price entry from the data-node.
///
/// Mirrors `data-node/src/market_data/models.rs::MarketPriceSummary`.
/// Only the fields we actually need are deserialized; the rest are
/// silently ignored thanks to serde's default deny-unknown = false.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MarketPriceSummary {
    symbol: String,
    /// Current value as a JSON number (Decimal on the server side).
    /// `f64` is fine here because we immediately convert to integer cents
    /// for all downstream deterministic comparison.
    value: f64,
}

// ============================================================================
// DataNodePriceFetcher
// ============================================================================

/// Fetches exit prices from the data-node REST API.
///
/// Uses two sources in order:
/// 1. `stocks` (Finnhub) — most AA bets are stock-based
/// 2. `coingecko` — fallback for crypto symbols
#[derive(Debug, Clone)]
pub struct DataNodePriceFetcher {
    client: Client,
    base_url: String,
}

impl DataNodePriceFetcher {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    /// Fetch current price for a single symbol from data-node.
    ///
    /// Returns price in **integer cents** for deterministic comparison
    /// (matches `ArbitrationTradePrice.exit_price_cents`).
    ///
    /// Tries `stocks` source first, then falls back to `coingecko`.
    pub async fn fetch_price_cents(&self, symbol: &str) -> Result<i64, PriceFetchError> {
        // Try stocks first (most AA bets are stock-based)
        if let Some(cents) = self.try_source("stocks", symbol).await? {
            return Ok(cents);
        }

        // Fallback: try crypto source
        if let Some(cents) = self.try_source("coingecko", symbol).await? {
            return Ok(cents);
        }

        Err(PriceFetchError::NotFound(symbol.to_string()))
    }

    /// Attempt to fetch a price from a specific source.
    ///
    /// Returns `Ok(None)` if the source responds successfully but does
    /// not contain the requested symbol. Returns `Err` on network / parse
    /// failures.
    async fn try_source(
        &self,
        source: &str,
        symbol: &str,
    ) -> Result<Option<i64>, PriceFetchError> {
        let url = format!(
            "{}/market/prices/{}?symbols={}",
            self.base_url, source, symbol
        );
        debug!(url = %url, source = %source, symbol = %symbol, "Fetching price from data-node");

        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            // Non-200 is not fatal — the source just doesn't have this symbol.
            debug!(
                status = %resp.status(),
                source = %source,
                symbol = %symbol,
                "Data-node returned non-success status, trying next source"
            );
            return Ok(None);
        }

        let body: MarketPricesResponse = resp.json().await?;

        // Find the matching symbol (case-insensitive, data-node may normalise)
        let found = body
            .prices
            .iter()
            .find(|p| p.symbol.eq_ignore_ascii_case(symbol));

        match found {
            Some(price) => {
                if price.value.is_nan() || price.value.is_infinite() {
                    return Err(PriceFetchError::InvalidData {
                        symbol: symbol.to_string(),
                        reason: format!("non-finite value: {}", price.value),
                    });
                }
                let cents = (price.value * 100.0).round() as i64;
                debug!(
                    symbol = %symbol,
                    source = %source,
                    cents = cents,
                    raw_value = %price.value,
                    "Got price from data-node"
                );
                Ok(Some(cents))
            }
            None => Ok(None),
        }
    }

    /// Fetch exit prices for a list of trade symbols.
    ///
    /// Each entry is `(trade_index, symbol)`. Returns an
    /// `ArbitrationTradePrice` per trade, or errors on the first
    /// symbol that cannot be resolved.
    pub async fn fetch_trade_prices(
        &self,
        trades: &[(u32, String)],
    ) -> Result<Vec<ArbitrationTradePrice>, PriceFetchError> {
        let mut prices = Vec::with_capacity(trades.len());
        for (trade_index, symbol) in trades {
            let exit_price_cents = self.fetch_price_cents(symbol).await?;
            prices.push(ArbitrationTradePrice {
                trade_index: *trade_index,
                symbol: symbol.clone(),
                exit_price_cents,
            });
        }
        Ok(prices)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_price_fetcher_creation() {
        let fetcher = DataNodePriceFetcher::new("http://localhost:8200/");
        assert_eq!(fetcher.base_url, "http://localhost:8200");
    }

    #[test]
    fn test_price_fetcher_trailing_slash_stripped() {
        let fetcher = DataNodePriceFetcher::new("http://localhost:8200///");
        assert_eq!(fetcher.base_url, "http://localhost:8200");
    }

    #[test]
    fn test_deserialize_market_prices_response() {
        // Verify our deserialization handles the camelCase fields
        // from the real data-node API
        let json = r#"{
            "source": "stocks",
            "prices": [
                {
                    "assetId": "AAPL",
                    "source": "stocks",
                    "symbol": "AAPL",
                    "name": "Apple Inc",
                    "category": "technology",
                    "value": 185.42,
                    "prevClose": 184.50,
                    "changePct": 0.50,
                    "volume24h": null,
                    "marketCap": 2800000000000,
                    "fetchedAt": "2026-02-20T10:00:00Z"
                }
            ],
            "total": 1,
            "page": 1,
            "limit": 100
        }"#;

        let resp: MarketPricesResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.prices.len(), 1);
        assert_eq!(resp.prices[0].symbol, "AAPL");
        assert!((resp.prices[0].value - 185.42).abs() < 0.001);
    }

    #[test]
    fn test_cents_conversion_rounding() {
        // Verify rounding: 185.425 -> 18543 cents (round to nearest)
        let value = 185.425_f64;
        let cents = (value * 100.0).round() as i64;
        assert_eq!(cents, 18543); // .5 rounds up

        // Exact value
        let value = 100.00_f64;
        let cents = (value * 100.0).round() as i64;
        assert_eq!(cents, 10000);
    }
}
