//! Risk tier configuration for allocation bot
//!
//! Defines risk tiers and their concentration limits for ITP markets.
//! Risk tier caps control the maximum percentage of vault assets that
//! can be allocated to a single market based on its risk classification.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Risk tier classification for ITP markets
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RiskTier {
    /// Tier A: Blue-chip, diversified ITPs (max 30% concentration)
    A,
    /// Tier B: Medium risk ITPs (max 20% concentration)
    B,
    /// Tier C: Higher risk ITPs (max 10% concentration)
    C,
    /// Tier D: Watch list, new ITPs (max 5% concentration)
    D,
}

impl RiskTier {
    /// Default concentration cap percentage for this tier
    pub fn default_cap_pct(&self) -> u8 {
        match self {
            RiskTier::A => 30,
            RiskTier::B => 20,
            RiskTier::C => 10,
            RiskTier::D => 5,
        }
    }
}

impl Default for RiskTier {
    fn default() -> Self {
        RiskTier::D // Most restrictive by default
    }
}

/// Configuration for a market's risk tier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskTierConfig {
    /// The risk tier classification
    pub tier: RiskTier,
    /// Maximum concentration percentage (0-100)
    pub max_concentration_pct: u8,
}

impl RiskTierConfig {
    pub fn new(tier: RiskTier) -> Self {
        Self {
            max_concentration_pct: tier.default_cap_pct(),
            tier,
        }
    }

    pub fn with_custom_cap(tier: RiskTier, cap_pct: u8) -> Self {
        Self {
            tier,
            max_concentration_pct: cap_pct.min(100),
        }
    }
}

/// Tier configuration file format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TierConfigFile {
    /// Default tier caps (override built-in defaults)
    #[serde(default)]
    pub tier_caps: HashMap<String, u8>,
    /// Market-specific tier assignments
    #[serde(default)]
    pub market_tiers: HashMap<String, String>,
}

/// Load tier configurations from JSON file
pub fn load_tier_config_from_file(
    path: &str,
) -> Result<HashMap<[u8; 32], RiskTierConfig>, TierConfigError> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| TierConfigError::FileReadError(format!("{}: {}", path, e)))?;

    let config: TierConfigFile = serde_json::from_str(&content)
        .map_err(|e| TierConfigError::ParseError(format!("{}: {}", path, e)))?;

    let mut result = HashMap::new();

    for (market_id_hex, tier_str) in config.market_tiers {
        let market_id = parse_market_id(&market_id_hex)?;
        let tier = parse_tier(&tier_str)?;

        let cap = config
            .tier_caps
            .get(&tier_str)
            .copied()
            .unwrap_or_else(|| tier.default_cap_pct());

        result.insert(market_id, RiskTierConfig::with_custom_cap(tier, cap));
    }

    Ok(result)
}

/// Parse a hex market ID (with or without 0x prefix) into [u8; 32]
fn parse_market_id(hex: &str) -> Result<[u8; 32], TierConfigError> {
    let hex = hex.strip_prefix("0x").unwrap_or(hex);
    let bytes = ethers::utils::hex::decode(hex)
        .map_err(|e| TierConfigError::InvalidMarketId(format!("Invalid hex: {}", e)))?;

    if bytes.len() != 32 {
        return Err(TierConfigError::InvalidMarketId(format!(
            "Market ID must be 32 bytes, got {}",
            bytes.len()
        )));
    }

    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

/// Parse a tier string ("A", "B", "C", "D") into RiskTier
fn parse_tier(s: &str) -> Result<RiskTier, TierConfigError> {
    match s.to_uppercase().as_str() {
        "A" => Ok(RiskTier::A),
        "B" => Ok(RiskTier::B),
        "C" => Ok(RiskTier::C),
        "D" => Ok(RiskTier::D),
        _ => Err(TierConfigError::InvalidTier(format!(
            "Unknown tier '{}', expected A, B, C, or D",
            s
        ))),
    }
}

/// Get default tier configurations
pub fn default_tier_caps() -> HashMap<RiskTier, u8> {
    let mut caps = HashMap::new();
    caps.insert(RiskTier::A, 30);
    caps.insert(RiskTier::B, 20);
    caps.insert(RiskTier::C, 10);
    caps.insert(RiskTier::D, 5);
    caps
}

/// Errors from tier configuration
#[derive(Debug, thiserror::Error)]
pub enum TierConfigError {
    #[error("Failed to read config file: {0}")]
    FileReadError(String),

    #[error("Failed to parse config: {0}")]
    ParseError(String),

    #[error("Invalid market ID: {0}")]
    InvalidMarketId(String),

    #[error("Invalid tier: {0}")]
    InvalidTier(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_risk_tier_default_caps() {
        assert_eq!(RiskTier::A.default_cap_pct(), 30);
        assert_eq!(RiskTier::B.default_cap_pct(), 20);
        assert_eq!(RiskTier::C.default_cap_pct(), 10);
        assert_eq!(RiskTier::D.default_cap_pct(), 5);
    }

    #[test]
    fn test_risk_tier_default_is_most_restrictive() {
        assert_eq!(RiskTier::default(), RiskTier::D);
    }

    #[test]
    fn test_risk_tier_config_new() {
        let config = RiskTierConfig::new(RiskTier::A);
        assert_eq!(config.tier, RiskTier::A);
        assert_eq!(config.max_concentration_pct, 30);
    }

    #[test]
    fn test_risk_tier_config_custom_cap() {
        let config = RiskTierConfig::with_custom_cap(RiskTier::B, 15);
        assert_eq!(config.tier, RiskTier::B);
        assert_eq!(config.max_concentration_pct, 15);
    }

    #[test]
    fn test_risk_tier_config_cap_clamped() {
        let config = RiskTierConfig::with_custom_cap(RiskTier::A, 150);
        assert_eq!(config.max_concentration_pct, 100);
    }

    #[test]
    fn test_parse_market_id_with_prefix() {
        let hex = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        let result = parse_market_id(hex).unwrap();
        assert_eq!(result[0], 0x12);
        assert_eq!(result[31], 0xef);
    }

    #[test]
    fn test_parse_market_id_without_prefix() {
        let hex = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        let result = parse_market_id(hex).unwrap();
        assert_eq!(result[0], 0x12);
    }

    #[test]
    fn test_parse_market_id_invalid_length() {
        let hex = "0x1234";
        let result = parse_market_id(hex);
        assert!(matches!(result, Err(TierConfigError::InvalidMarketId(_))));
    }

    #[test]
    fn test_parse_tier() {
        assert_eq!(parse_tier("A").unwrap(), RiskTier::A);
        assert_eq!(parse_tier("b").unwrap(), RiskTier::B);
        assert_eq!(parse_tier("C").unwrap(), RiskTier::C);
        assert_eq!(parse_tier("d").unwrap(), RiskTier::D);
    }

    #[test]
    fn test_parse_tier_invalid() {
        let result = parse_tier("E");
        assert!(matches!(result, Err(TierConfigError::InvalidTier(_))));
    }

    #[test]
    fn test_default_tier_caps() {
        let caps = default_tier_caps();
        assert_eq!(caps.get(&RiskTier::A), Some(&30));
        assert_eq!(caps.get(&RiskTier::B), Some(&20));
        assert_eq!(caps.get(&RiskTier::C), Some(&10));
        assert_eq!(caps.get(&RiskTier::D), Some(&5));
    }
}
