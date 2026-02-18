//! Market configuration registry — maps ITP addresses to Morpho market parameters
//!
//! JSON-loadable registry of ITP → market mapping used by the Quote API
//! to look up market params for a given ITP address.

use crate::tier_config::RiskTier;
use ethers::types::Address;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// Configuration for a single ITP lending market
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketConfig {
    /// Morpho market ID (hex, 32 bytes)
    pub market_id: String,
    /// ITP token address
    pub itp_address: String,
    /// ITPNAVOracle address for this ITP
    pub oracle_address: String,
    /// LLTV in WAD (e.g., "770000000000000000" for 77%)
    pub lltv: String,
    /// Risk tier classification
    pub risk_tier: RiskTier,
    /// Underlying asset composition: { asset_address → weight_bps }
    #[serde(default)]
    pub composition: HashMap<String, u16>,
    /// Morpho Bundler contract address (for multicall execution)
    #[serde(default)]
    pub bundler_address: String,
}

/// Parsed market configuration ready for use
#[derive(Debug, Clone)]
pub struct ParsedMarketConfig {
    /// Morpho market ID (32 bytes)
    pub market_id: [u8; 32],
    /// ITP token address
    pub itp_address: Address,
    /// ITPNAVOracle address
    pub oracle_address: Address,
    /// LLTV in WAD
    pub lltv: ethers::types::U256,
    /// Risk tier
    pub risk_tier: RiskTier,
    /// Underlying asset composition: (asset_bytes, weight_bps)
    pub composition: Vec<([u8; 20], u16)>,
    /// Morpho Bundler contract address
    pub bundler_address: Address,
}

/// Market registry loaded from config file
#[derive(Debug, Clone)]
pub struct MarketRegistry {
    /// ITP address → parsed market config
    markets: HashMap<Address, ParsedMarketConfig>,
}

impl MarketRegistry {
    /// Create an empty registry
    pub fn new() -> Self {
        Self {
            markets: HashMap::new(),
        }
    }

    /// Load registry from a JSON file
    pub fn from_file(path: &str) -> Result<Self, MarketConfigError> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| MarketConfigError::FileRead(format!("{}: {}", path, e)))?;
        Self::from_json(&content)
    }

    /// Load registry from JSON string
    pub fn from_json(json: &str) -> Result<Self, MarketConfigError> {
        let configs: Vec<MarketConfig> = serde_json::from_str(json)
            .map_err(|e| MarketConfigError::Parse(format!("{}", e)))?;

        let mut markets = HashMap::new();
        for config in configs {
            let parsed = parse_market_config(&config)?;
            markets.insert(parsed.itp_address, parsed);
        }

        Ok(Self { markets })
    }

    /// Look up market config by ITP address
    pub fn get_by_itp(&self, itp_address: &Address) -> Option<&ParsedMarketConfig> {
        self.markets.get(itp_address)
    }

    /// Look up market config by market ID
    pub fn get_by_market_id(&self, market_id: &[u8; 32]) -> Option<&ParsedMarketConfig> {
        self.markets.values().find(|m| &m.market_id == market_id)
    }

    /// Get all market configs
    pub fn all_markets(&self) -> impl Iterator<Item = &ParsedMarketConfig> {
        self.markets.values()
    }

    /// Number of registered markets
    pub fn len(&self) -> usize {
        self.markets.len()
    }

    /// Check if registry is empty
    pub fn is_empty(&self) -> bool {
        self.markets.is_empty()
    }

    /// Add a market config programmatically
    pub fn add_market(&mut self, config: ParsedMarketConfig) {
        self.markets.insert(config.itp_address, config);
    }
}

impl Default for MarketRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Parse a raw MarketConfig into a ParsedMarketConfig
fn parse_market_config(config: &MarketConfig) -> Result<ParsedMarketConfig, MarketConfigError> {
    let market_id = parse_bytes32(&config.market_id)?;

    let itp_address: Address = config
        .itp_address
        .parse()
        .map_err(|e| MarketConfigError::Parse(format!("Invalid ITP address: {}", e)))?;

    let oracle_address: Address = config
        .oracle_address
        .parse()
        .map_err(|e| MarketConfigError::Parse(format!("Invalid oracle address: {}", e)))?;

    let lltv = ethers::types::U256::from_dec_str(&config.lltv)
        .map_err(|e| MarketConfigError::Parse(format!("Invalid LLTV: {}", e)))?;

    let mut composition = Vec::new();
    for (asset_hex, weight) in &config.composition {
        let asset_addr: Address = asset_hex
            .parse()
            .map_err(|e| MarketConfigError::Parse(format!("Invalid asset address: {}", e)))?;
        composition.push((asset_addr.0, *weight));
    }

    let bundler_address: Address = if config.bundler_address.is_empty() {
        Address::zero()
    } else {
        config
            .bundler_address
            .parse()
            .map_err(|e| MarketConfigError::Parse(format!("Invalid bundler address: {}", e)))?
    };

    Ok(ParsedMarketConfig {
        market_id,
        itp_address,
        oracle_address,
        lltv,
        risk_tier: config.risk_tier,
        composition,
        bundler_address,
    })
}

/// Parse hex string to [u8; 32]
fn parse_bytes32(hex: &str) -> Result<[u8; 32], MarketConfigError> {
    let hex = hex.strip_prefix("0x").unwrap_or(hex);
    let bytes = ethers::utils::hex::decode(hex)
        .map_err(|e| MarketConfigError::Parse(format!("Invalid hex: {}", e)))?;
    if bytes.len() != 32 {
        return Err(MarketConfigError::Parse(format!(
            "Expected 32 bytes, got {}",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

/// Errors from market configuration
#[derive(Debug, Error)]
pub enum MarketConfigError {
    #[error("Failed to read config file: {0}")]
    FileRead(String),

    #[error("Failed to parse config: {0}")]
    Parse(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_market_config() {
        let json = r#"[{
            "market_id": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            "itp_address": "0x1111111111111111111111111111111111111111",
            "oracle_address": "0x2222222222222222222222222222222222222222",
            "lltv": "770000000000000000",
            "risk_tier": "A",
            "composition": {
                "0x3333333333333333333333333333333333333333": 5000,
                "0x4444444444444444444444444444444444444444": 5000
            }
        }]"#;

        let registry = MarketRegistry::from_json(json).unwrap();
        assert_eq!(registry.len(), 1);

        let itp_addr: Address = "0x1111111111111111111111111111111111111111".parse().unwrap();
        let config = registry.get_by_itp(&itp_addr).unwrap();
        assert_eq!(config.risk_tier, RiskTier::A);
        assert_eq!(config.composition.len(), 2);
    }

    #[test]
    fn test_empty_registry() {
        let registry = MarketRegistry::new();
        assert!(registry.is_empty());
        assert_eq!(registry.len(), 0);
    }

    #[test]
    fn test_get_by_market_id() {
        let json = r#"[{
            "market_id": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            "itp_address": "0x1111111111111111111111111111111111111111",
            "oracle_address": "0x2222222222222222222222222222222222222222",
            "lltv": "770000000000000000",
            "risk_tier": "B",
            "composition": {}
        }]"#;

        let registry = MarketRegistry::from_json(json).unwrap();
        let mut expected_id = [0u8; 32];
        let bytes = ethers::utils::hex::decode("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890").unwrap();
        expected_id.copy_from_slice(&bytes);

        let config = registry.get_by_market_id(&expected_id).unwrap();
        assert_eq!(config.risk_tier, RiskTier::B);
    }

    #[test]
    fn test_add_market() {
        let mut registry = MarketRegistry::new();
        let itp_addr: Address = "0x1111111111111111111111111111111111111111".parse().unwrap();

        registry.add_market(ParsedMarketConfig {
            market_id: [1u8; 32],
            itp_address: itp_addr,
            oracle_address: Address::zero(),
            lltv: ethers::types::U256::from(770_000_000_000_000_000u64),
            risk_tier: RiskTier::A,
            composition: vec![],
            bundler_address: Address::zero(),
        });

        assert_eq!(registry.len(), 1);
        assert!(registry.get_by_itp(&itp_addr).is_some());
    }

    #[test]
    fn test_parse_invalid_market_id() {
        let json = r#"[{
            "market_id": "invalid",
            "itp_address": "0x1111111111111111111111111111111111111111",
            "oracle_address": "0x2222222222222222222222222222222222222222",
            "lltv": "770000000000000000",
            "risk_tier": "A",
            "composition": {}
        }]"#;

        let result = MarketRegistry::from_json(json);
        assert!(result.is_err());
    }
}
