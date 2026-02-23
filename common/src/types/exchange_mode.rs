//! Exchange mode for Bitget integration
//!
//! Controls whether components use mock, testnet, or mainnet Bitget clients.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

/// Exchange mode controlling which Bitget client implementation is used.
///
/// Resolved once at startup from CLI/env/config. All components (AP, issuer)
/// read this to construct appropriate client instances.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExchangeMode {
    /// In-memory fakes, no network, instant fills
    Mock,
    /// Real Bitget API with testnet keys
    Testnet,
    /// Real Bitget API with mainnet keys
    Mainnet,
}

impl ExchangeMode {
    /// Returns true if this mode requires real Bitget API credentials.
    pub fn requires_credentials(&self) -> bool {
        matches!(self, ExchangeMode::Testnet | ExchangeMode::Mainnet)
    }

    /// Returns true if this is the mock mode.
    pub fn is_mock(&self) -> bool {
        matches!(self, ExchangeMode::Mock)
    }

    /// Returns true if this is mainnet (real money).
    pub fn is_mainnet(&self) -> bool {
        matches!(self, ExchangeMode::Mainnet)
    }
}

impl Default for ExchangeMode {
    fn default() -> Self {
        ExchangeMode::Mock
    }
}

impl fmt::Display for ExchangeMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ExchangeMode::Mock => write!(f, "mock"),
            ExchangeMode::Testnet => write!(f, "testnet"),
            ExchangeMode::Mainnet => write!(f, "mainnet"),
        }
    }
}

impl FromStr for ExchangeMode {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "mock" => Ok(ExchangeMode::Mock),
            "testnet" => Ok(ExchangeMode::Testnet),
            "mainnet" => Ok(ExchangeMode::Mainnet),
            _ => Err(format!(
                "invalid exchange mode '{}': expected 'mock', 'testnet', or 'mainnet'",
                s
            )),
        }
    }
}

/// Resolve ExchangeMode from legacy flags for backward compatibility.
///
/// Priority: explicit exchange_mode > legacy flags > default (Mock)
pub fn resolve_exchange_mode(
    explicit_mode: Option<ExchangeMode>,
    mock_bitget: bool,
    bitget_testnet: Option<bool>,
    bitget_mainnet: bool,
    has_credentials: bool,
) -> ExchangeMode {
    // Explicit --exchange-mode takes priority
    if let Some(mode) = explicit_mode {
        return mode;
    }

    // Legacy flags
    if mock_bitget {
        return ExchangeMode::Mock;
    }

    if bitget_mainnet {
        return ExchangeMode::Mainnet;
    }

    // bitget_testnet=true OR has credentials without mock flag
    if bitget_testnet == Some(true) || has_credentials {
        return ExchangeMode::Testnet;
    }

    ExchangeMode::Mock
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_str() {
        assert_eq!("mock".parse::<ExchangeMode>().unwrap(), ExchangeMode::Mock);
        assert_eq!("testnet".parse::<ExchangeMode>().unwrap(), ExchangeMode::Testnet);
        assert_eq!("mainnet".parse::<ExchangeMode>().unwrap(), ExchangeMode::Mainnet);
        assert_eq!("MOCK".parse::<ExchangeMode>().unwrap(), ExchangeMode::Mock);
        assert!("invalid".parse::<ExchangeMode>().is_err());
    }

    #[test]
    fn test_display() {
        assert_eq!(ExchangeMode::Mock.to_string(), "mock");
        assert_eq!(ExchangeMode::Testnet.to_string(), "testnet");
        assert_eq!(ExchangeMode::Mainnet.to_string(), "mainnet");
    }

    #[test]
    fn test_requires_credentials() {
        assert!(!ExchangeMode::Mock.requires_credentials());
        assert!(ExchangeMode::Testnet.requires_credentials());
        assert!(ExchangeMode::Mainnet.requires_credentials());
    }

    #[test]
    fn test_default() {
        assert_eq!(ExchangeMode::default(), ExchangeMode::Mock);
    }

    #[test]
    fn test_resolve_explicit_wins() {
        let mode = resolve_exchange_mode(Some(ExchangeMode::Mainnet), true, None, false, false);
        assert_eq!(mode, ExchangeMode::Mainnet);
    }

    #[test]
    fn test_resolve_mock_flag() {
        let mode = resolve_exchange_mode(None, true, None, false, true);
        assert_eq!(mode, ExchangeMode::Mock);
    }

    #[test]
    fn test_resolve_mainnet_flag() {
        let mode = resolve_exchange_mode(None, false, None, true, true);
        assert_eq!(mode, ExchangeMode::Mainnet);
    }

    #[test]
    fn test_resolve_testnet_flag() {
        let mode = resolve_exchange_mode(None, false, Some(true), false, true);
        assert_eq!(mode, ExchangeMode::Testnet);
    }

    #[test]
    fn test_resolve_credentials_implies_testnet() {
        let mode = resolve_exchange_mode(None, false, None, false, true);
        assert_eq!(mode, ExchangeMode::Testnet);
    }

    #[test]
    fn test_resolve_no_flags_no_creds() {
        let mode = resolve_exchange_mode(None, false, None, false, false);
        assert_eq!(mode, ExchangeMode::Mock);
    }
}
