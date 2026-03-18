//! Symbol mapping for asset addresses to Bitget trading pair symbols
//!
//! Maps on-chain asset addresses to Bitget spot trading pairs (e.g., "BTCUSDT").

use ethers::types::Address;
use std::collections::HashMap;
use std::path::Path;

/// Maps asset addresses to Bitget trading pair symbols
#[derive(Debug, Clone, Default)]
pub struct SymbolMap {
    map: HashMap<Address, String>,
}

impl SymbolMap {
    /// Create a new empty symbol map
    pub fn new() -> Self {
        Self {
            map: HashMap::new(),
        }
    }

    /// Add a mapping from asset address to Bitget symbol
    ///
    /// # Arguments
    /// * `asset` - The on-chain asset address
    /// * `symbol` - The Bitget trading pair symbol (e.g., "BTCUSDT")
    pub fn add(mut self, asset: Address, symbol: &str) -> Self {
        self.map.insert(asset, symbol.to_string());
        self
    }

    /// Add a mapping using a hex address string
    ///
    /// # Arguments
    /// * `asset_hex` - The asset address as a hex string (with or without "0x" prefix)
    /// * `symbol` - The Bitget trading pair symbol
    ///
    /// # Panics
    /// Panics if the address string is invalid (intended for static configuration)
    pub fn add_hex(self, asset_hex: &str, symbol: &str) -> Self {
        let asset: Address = asset_hex
            .parse()
            .expect("Invalid asset address in symbol map configuration");
        self.add(asset, symbol)
    }

    /// Get the Bitget symbol for an asset address
    pub fn get_symbol(&self, asset: &Address) -> Option<&str> {
        self.map.get(asset).map(|s| s.as_str())
    }

    /// Check if a symbol mapping exists for the given asset
    pub fn contains(&self, asset: &Address) -> bool {
        self.map.contains_key(asset)
    }

    /// Get the number of mappings
    pub fn len(&self) -> usize {
        self.map.len()
    }

    /// Check if the map is empty
    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    /// Get all mapped assets in deterministic order (sorted by address).
    ///
    /// CRITICAL: The ordering must be identical across all oracle processes.
    /// HashMap iteration order is non-deterministic, so we sort by address bytes.
    /// This ensures leader and follower agree on asset index → address mapping
    /// during price consensus.
    pub fn assets(&self) -> impl Iterator<Item = &Address> {
        let mut keys: Vec<&Address> = self.map.keys().collect();
        keys.sort();
        keys.into_iter()
    }

    /// Get all distinct trading pair symbols in sorted order.
    ///
    /// Used for startup validation against live exchange ticker lists.
    /// Deduplicates pairs so stablecoins mapped to the same pair (e.g. USDC
    /// native + USDC.e both → USDCUSDT) appear only once.
    pub fn all_pairs(&self) -> impl Iterator<Item = &str> {
        let mut pairs: Vec<&str> = self.map.values().map(|s| s.as_str()).collect();
        pairs.sort_unstable();
        pairs.dedup();
        pairs.into_iter()
    }

    /// Create default symbol map with common Settlement chain tokens
    ///
    /// Includes mappings for:
    /// - WBTC → BTCUSDT
    /// - WETH → ETHUSDT
    /// - USDC → USDCUSDT
    /// - ARB → ARBUSDT
    /// - LINK → LINKUSDT
    pub fn default_settlement() -> Self {
        Self::new()
            // WBTC on Settlement chain
            .add_hex("0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", "BTCUSDT")
            // WETH on Settlement chain
            .add_hex("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", "ETHUSDT")
            // USDC on Settlement chain (native)
            .add_hex("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "USDCUSDT")
            // USDC.e (bridged) on Settlement chain
            .add_hex("0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", "USDCUSDT")
            // ARB token
            .add_hex("0x912CE59144191C1204E64559FE8253a0e49E6548", "ARBUSDT")
            // LINK on Settlement chain
            .add_hex("0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", "LINKUSDT")
    }

    /// Load symbol map from a JSON file
    ///
    /// Supports two formats:
    ///
    /// **New format** (with source metadata):
    /// ```json
    /// {
    ///   "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f": {"pair": "BTCUSDT", "source": "bitget"},
    ///   "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1": {"pair": "ETHUSDT", "source": "bitget"}
    /// }
    /// ```
    ///
    /// Only the `pair` field is extracted; extra fields like `source` are ignored.
    ///
    /// # Arguments
    /// * `path` - Path to the JSON file
    ///
    /// # Returns
    /// `Ok(SymbolMap)` with loaded mappings, or `Err` if file is invalid
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self, SymbolMapError> {
        let content = std::fs::read_to_string(path.as_ref())
            .map_err(|e| SymbolMapError::FileRead(e.to_string()))?;

        let parsed: HashMap<String, serde_json::Value> = serde_json::from_str(&content)
            .map_err(|e| SymbolMapError::JsonParse(e.to_string()))?;

        let mut map = Self::new();
        for (address_str, value) in parsed {
            let symbol = match &value {
                serde_json::Value::Object(obj) => obj
                    .get("pair")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .ok_or_else(|| SymbolMapError::MissingPair(address_str.clone()))?,
                _ => return Err(SymbolMapError::JsonParse(
                    format!("expected object with 'pair' field for address {address_str}"),
                )),
            };

            let address: Address = address_str
                .parse()
                .map_err(|_| SymbolMapError::InvalidAddress(address_str.clone()))?;
            map.map.insert(address, symbol);
        }

        Ok(map)
    }
}

/// Errors that can occur when loading a symbol map
#[derive(Debug, thiserror::Error)]
pub enum SymbolMapError {
    /// Failed to read the symbol map file
    #[error("Failed to read symbol map file: {0}")]
    FileRead(String),

    /// Failed to parse JSON content
    #[error("Failed to parse symbol map JSON: {0}")]
    JsonParse(String),

    /// Invalid address format in the file
    #[error("Invalid address format: {0}")]
    InvalidAddress(String),

    /// Object entry is missing the "pair" field
    #[error("Missing 'pair' field for address: {0}")]
    MissingPair(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_address(n: u8) -> Address {
        let mut bytes = [0u8; 20];
        bytes[19] = n;
        Address::from(bytes)
    }

    #[test]
    fn test_symbol_map_new() {
        let map = SymbolMap::new();
        assert!(map.is_empty());
        assert_eq!(map.len(), 0);
    }

    #[test]
    fn test_symbol_map_add() {
        let asset = test_address(1);
        let map = SymbolMap::new().add(asset, "BTCUSDT");

        assert_eq!(map.len(), 1);
        assert!(!map.is_empty());
        assert!(map.contains(&asset));
        assert_eq!(map.get_symbol(&asset), Some("BTCUSDT"));
    }

    #[test]
    fn test_symbol_map_add_hex() {
        let map = SymbolMap::new()
            .add_hex("0x0000000000000000000000000000000000000001", "BTCUSDT");

        let asset: Address = "0x0000000000000000000000000000000000000001"
            .parse()
            .unwrap();
        assert_eq!(map.get_symbol(&asset), Some("BTCUSDT"));
    }

    #[test]
    fn test_symbol_map_multiple() {
        let btc = test_address(1);
        let eth = test_address(2);
        let usdc = test_address(3);

        let map = SymbolMap::new()
            .add(btc, "BTCUSDT")
            .add(eth, "ETHUSDT")
            .add(usdc, "USDCUSDT");

        assert_eq!(map.len(), 3);
        assert_eq!(map.get_symbol(&btc), Some("BTCUSDT"));
        assert_eq!(map.get_symbol(&eth), Some("ETHUSDT"));
        assert_eq!(map.get_symbol(&usdc), Some("USDCUSDT"));
    }

    #[test]
    fn test_symbol_map_not_found() {
        let known = test_address(1);
        let unknown = test_address(99);

        let map = SymbolMap::new().add(known, "BTCUSDT");

        assert!(map.contains(&known));
        assert!(!map.contains(&unknown));
        assert_eq!(map.get_symbol(&unknown), None);
    }

    #[test]
    fn test_symbol_map_assets_iterator() {
        let btc = test_address(1);
        let eth = test_address(2);

        let map = SymbolMap::new().add(btc, "BTCUSDT").add(eth, "ETHUSDT");

        let assets: Vec<_> = map.assets().collect();
        assert_eq!(assets.len(), 2);
        assert!(assets.contains(&&btc));
        assert!(assets.contains(&&eth));
    }

    #[test]
    #[should_panic(expected = "Invalid asset address")]
    fn test_symbol_map_add_hex_invalid() {
        SymbolMap::new().add_hex("not-an-address", "BTCUSDT");
    }

    #[test]
    fn test_symbol_map_default_settlement() {
        let map = SymbolMap::default_settlement();

        // Should have 6 mappings (WBTC, WETH, USDC native, USDC.e, ARB, LINK)
        assert_eq!(map.len(), 6);

        // Verify WBTC mapping
        let wbtc: Address = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
            .parse()
            .unwrap();
        assert_eq!(map.get_symbol(&wbtc), Some("BTCUSDT"));

        // Verify WETH mapping
        let weth: Address = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
            .parse()
            .unwrap();
        assert_eq!(map.get_symbol(&weth), Some("ETHUSDT"));

        // Verify ARB mapping
        let arb: Address = "0x912CE59144191C1204E64559FE8253a0e49E6548"
            .parse()
            .unwrap();
        assert_eq!(map.get_symbol(&arb), Some("ARBUSDT"));
    }

    #[test]
    fn test_symbol_map_from_file_valid() {
        use std::io::Write;
        use tempfile::NamedTempFile;

        let mut file = NamedTempFile::new().unwrap();
        writeln!(
            file,
            r#"{{
                "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f": {{"pair": "BTCUSDT", "source": "bitget"}},
                "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1": {{"pair": "ETHUSDT", "source": "bitget"}}
            }}"#
        )
        .unwrap();

        let map = SymbolMap::from_file(file.path()).unwrap();
        assert_eq!(map.len(), 2);

        let wbtc: Address = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
            .parse()
            .unwrap();
        assert_eq!(map.get_symbol(&wbtc), Some("BTCUSDT"));

        let weth: Address = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
            .parse()
            .unwrap();
        assert_eq!(map.get_symbol(&weth), Some("ETHUSDT"));
    }

    #[test]
    fn test_symbol_map_from_file_invalid_json() {
        use std::io::Write;
        use tempfile::NamedTempFile;

        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "not valid json").unwrap();

        let result = SymbolMap::from_file(file.path());
        assert!(matches!(result, Err(SymbolMapError::JsonParse(_))));
    }

    #[test]
    fn test_symbol_map_from_file_invalid_address() {
        use std::io::Write;
        use tempfile::NamedTempFile;

        let mut file = NamedTempFile::new().unwrap();
        writeln!(
            file,
            r#"{{
                "not-an-address": "BTCUSDT"
            }}"#
        )
        .unwrap();

        let result = SymbolMap::from_file(file.path());
        assert!(matches!(result, Err(SymbolMapError::InvalidAddress(_))));
    }

    #[test]
    fn test_symbol_map_from_file_not_found() {
        let result = SymbolMap::from_file("/nonexistent/path/to/file.json");
        assert!(matches!(result, Err(SymbolMapError::FileRead(_))));
    }
}
