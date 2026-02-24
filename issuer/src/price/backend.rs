//! Backend price fetcher implementation
//!
//! Fetches prices from the data-node backend service instead of Bitget directly.
//! This is the primary price source for all issuer operations.

use async_trait::async_trait;
use common::types::{Price, PriceSource};
use ethers::types::{Address, U256};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{info, warn};

use super::fetcher::{PriceFetchError, PriceFetcher};
use super::symbol_map::SymbolMap;

/// Fetches prices from the data-node backend service
#[derive(Clone)]
pub struct BackendPriceFetcher {
    http: Arc<reqwest::Client>,
    base_url: String,
    symbol_map: SymbolMap,
}

impl BackendPriceFetcher {
    /// Create a new BackendPriceFetcher
    ///
    /// # Arguments
    /// * `base_url` - Base URL of the data-node backend (e.g., "http://localhost:8080")
    /// * `symbol_map` - Mapping from asset addresses to trading pair symbols
    pub fn new(base_url: String, symbol_map: SymbolMap) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .expect("Failed to build reqwest client");
        info!(base_url = %base_url, symbols = symbol_map.len(), "BackendPriceFetcher initialized");
        Self {
            http: Arc::new(http),
            base_url,
            symbol_map,
        }
    }

    /// Get the symbol map
    pub fn symbol_map(&self) -> &SymbolMap {
        &self.symbol_map
    }
}

/// Parse a decimal string like "100000.123456789012345" to U256 with 18 decimal places.
/// Uses pure string manipulation -- no f64 intermediate.
fn parse_decimal_to_u256_18dec(s: &str) -> Option<U256> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }

    let (integer_part, decimal_part) = match s.split_once('.') {
        Some((i, d)) => (i, d),
        None => (s, ""),
    };

    // Pad or truncate decimal to exactly 18 digits
    let decimal_18 = if decimal_part.len() >= 18 {
        &decimal_part[..18]
    } else {
        // Need to create an owned string for padding
        return {
            let padded = format!("{:0<18}", decimal_part);
            let combined = format!("{}{}", integer_part, padded);
            U256::from_dec_str(&combined).ok()
        };
    };

    let combined = format!("{}{}", integer_part, decimal_18);
    U256::from_dec_str(&combined).ok()
}

fn current_timestamp() -> U256 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs()
        .into()
}

#[derive(serde::Deserialize)]
struct FastPriceEntry {
    last_price: String,
    #[allow(dead_code)]
    bid: String,
    #[allow(dead_code)]
    ask: String,
}

#[derive(serde::Deserialize)]
struct FastPricesResp {
    prices: HashMap<String, FastPriceEntry>,
}

#[async_trait]
impl PriceFetcher for BackendPriceFetcher {
    async fn fetch_prices(&self, assets: &[Address]) -> Result<Vec<Price>, PriceFetchError> {
        if assets.is_empty() {
            return Ok(vec![]);
        }

        // Map addresses to symbols
        let mut addr_to_symbol: Vec<(Address, String)> = Vec::new();
        for addr in assets {
            if let Some(sym) = self.symbol_map.get_symbol(addr) {
                addr_to_symbol.push((*addr, sym.to_string()));
            }
        }

        if addr_to_symbol.is_empty() {
            return Err(PriceFetchError::FetchFailed {
                asset: assets[0],
                reason: "No symbols mapped for any requested assets".to_string(),
            });
        }

        // Deduplicate symbols
        let mut unique_symbols: Vec<String> = addr_to_symbol.iter().map(|(_, s)| s.clone()).collect();
        unique_symbols.sort();
        unique_symbols.dedup();

        let symbols_param = unique_symbols.join(",");
        let url = format!("{}/fast-prices?symbols={}", self.base_url, symbols_param);

        let resp = self.http.get(&url).send().await.map_err(|e| {
            PriceFetchError::FetchFailed {
                asset: Address::zero(),
                reason: format!("data-node request failed: {}", e),
            }
        })?;

        if !resp.status().is_success() {
            return Err(PriceFetchError::FetchFailed {
                asset: Address::zero(),
                reason: format!("data-node returned status {}", resp.status()),
            });
        }

        let body: FastPricesResp = resp.json().await.map_err(|e| {
            PriceFetchError::FetchFailed {
                asset: Address::zero(),
                reason: format!("data-node response parse failed: {}", e),
            }
        })?;

        // Build symbol → U256 price map (using last_price from fast-prices response)
        let mut symbol_to_price: HashMap<String, U256> = HashMap::new();
        for (symbol, entry) in &body.prices {
            let price_u256 = match parse_decimal_to_u256_18dec(&entry.last_price) {
                Some(p) => p,
                None => continue,
            };
            symbol_to_price.insert(symbol.clone(), price_u256);
        }

        let timestamp = current_timestamp();

        // Build prices for each requested address
        let mut prices = Vec::with_capacity(addr_to_symbol.len());
        for (addr, symbol) in &addr_to_symbol {
            if let Some(&price) = symbol_to_price.get(symbol) {
                prices.push(Price {
                    asset: *addr,
                    price,
                    timestamp,
                    source: U256::from(PriceSource::Bitget as u8), // same source enum for now
                });
            } else {
                warn!(asset = ?addr, symbol = %symbol, "No price from backend for symbol");
            }
        }

        if prices.is_empty() {
            return Err(PriceFetchError::FetchFailed {
                asset: assets[0],
                reason: "Backend returned no prices for any requested assets".to_string(),
            });
        }

        Ok(prices)
    }

    async fn fetch_price(&self, asset: Address) -> Result<Price, PriceFetchError> {
        let prices = self.fetch_prices(&[asset]).await?;
        prices.into_iter().next().ok_or(PriceFetchError::PriceNotAvailable { asset })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backend_price_fetcher_creation() {
        let symbol_map = SymbolMap::new()
            .add_hex("0x0000000000000000000000000000000000000001", "BTCUSDT");
        let fetcher = BackendPriceFetcher::new("http://localhost:8080".to_string(), symbol_map);
        assert_eq!(fetcher.symbol_map().len(), 1);
    }

    #[test]
    fn test_parse_decimal_to_u256_18dec_integer() {
        // "100000" => 100000 * 1e18
        let result = parse_decimal_to_u256_18dec("100000").unwrap();
        assert_eq!(result, U256::from_dec_str("100000000000000000000000").unwrap());
    }

    #[test]
    fn test_parse_decimal_to_u256_18dec_with_decimals() {
        // "1.5" => 1.5 * 1e18 = 1500000000000000000
        let result = parse_decimal_to_u256_18dec("1.5").unwrap();
        assert_eq!(result, U256::from_dec_str("1500000000000000000").unwrap());
    }

    #[test]
    fn test_parse_decimal_to_u256_18dec_btc_price() {
        // "100000.123456789012345678" (18 decimal digits) => exact
        let result = parse_decimal_to_u256_18dec("100000.123456789012345678").unwrap();
        assert_eq!(result, U256::from_dec_str("100000123456789012345678").unwrap());
    }

    #[test]
    fn test_parse_decimal_to_u256_18dec_small_number() {
        // "0.000001" => 1000000000000 (1e12)
        let result = parse_decimal_to_u256_18dec("0.000001").unwrap();
        assert_eq!(result, U256::from_dec_str("1000000000000").unwrap());
    }

    #[test]
    fn test_parse_decimal_to_u256_18dec_truncates_beyond_18() {
        // "1.1234567890123456789999" => truncated to 18 decimals
        let result = parse_decimal_to_u256_18dec("1.1234567890123456789999").unwrap();
        assert_eq!(result, U256::from_dec_str("1123456789012345678").unwrap());
    }

    #[test]
    fn test_parse_decimal_to_u256_18dec_empty() {
        assert!(parse_decimal_to_u256_18dec("").is_none());
        assert!(parse_decimal_to_u256_18dec("  ").is_none());
    }

    #[test]
    fn test_parse_decimal_to_u256_18dec_invalid() {
        assert!(parse_decimal_to_u256_18dec("abc").is_none());
    }

    #[test]
    fn test_parse_decimal_to_u256_18dec_precision_vs_f64() {
        // This is the key test: f64 loses precision for BTC at $100,000
        // f64: (100000.123456789012345 * 1e18) as u128 = imprecise
        // Our function: exact string manipulation
        let result = parse_decimal_to_u256_18dec("100000.123456789012345").unwrap();
        let expected = U256::from_dec_str("100000123456789012345000").unwrap();
        assert_eq!(result, expected);
    }
}
