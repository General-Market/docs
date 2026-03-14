use ethers::types::Address;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct AssetEntry {
    address: Address,
    symbol: String,
}

pub struct TokenRegistry {
    symbol_to_address: HashMap<String, Address>,
    address_to_symbol: HashMap<Address, String>,
}

impl TokenRegistry {
    /// Load from deployed-assets.json: `[{"address": "0x...", "symbol": "BTC"}, ...]`
    pub fn from_deployed_assets(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let data = std::fs::read_to_string(path)?;
        let entries: Vec<AssetEntry> = serde_json::from_str(&data)?;

        let mut symbol_to_address = HashMap::with_capacity(entries.len());
        let mut address_to_symbol = HashMap::with_capacity(entries.len());

        for entry in entries {
            let sym = entry.symbol.to_uppercase();
            symbol_to_address.insert(sym.clone(), entry.address);
            address_to_symbol.insert(entry.address, sym);
        }

        Ok(Self {
            symbol_to_address,
            address_to_symbol,
        })
    }

    pub fn get_address(&self, symbol: &str) -> Option<Address> {
        self.symbol_to_address.get(&symbol.to_uppercase()).copied()
    }

    pub fn get_symbol(&self, address: &Address) -> Option<&str> {
        self.address_to_symbol.get(address).map(|s| s.as_str())
    }
}
