//! Deployment configuration loader for Index L3 contracts
//!
//! Parses deployment JSON files (e.g., `deployments/l3-testnet.json`)
//! to load contract addresses for the AP service.

use std::collections::HashMap;
use std::path::Path;

use ethers::types::Address;
use serde::Deserialize;

use crate::error::Error;

/// Deployment configuration matching the `deployments/*.json` format
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentConfig {
    pub chain_id: u64,
    pub deployer: String,
    pub timestamp: u64,
    pub contracts: HashMap<String, String>,
}

impl DeploymentConfig {
    /// Load deployment config from a JSON file
    pub fn from_file(path: &Path) -> Result<Self, Error> {
        let contents = std::fs::read_to_string(path).map_err(|e| {
            Error::ChainRead(format!("Failed to read deployment file {:?}: {}", path, e))
        })?;
        let config: DeploymentConfig = serde_json::from_str(&contents).map_err(|e| {
            Error::Serialization(format!("Failed to parse deployment JSON: {}", e))
        })?;
        Ok(config)
    }

    /// Validate the deployment config
    pub fn validate(&self, expected_chain_id: u64) -> Result<(), Error> {
        if self.chain_id != expected_chain_id {
            return Err(Error::InvalidArgument(format!(
                "Chain ID mismatch: deployment file has {}, expected {}",
                self.chain_id, expected_chain_id
            )));
        }

        let required = ["Index", "OracleRegistry", "L3BridgeCustody"];
        for name in &required {
            let addr = self.get_contract_address(name)?;
            if addr == Address::zero() {
                return Err(Error::InvalidArgument(format!(
                    "Required contract {} has zero address",
                    name
                )));
            }
        }

        Ok(())
    }

    /// Get a contract address by name
    fn get_contract_address(&self, name: &str) -> Result<Address, Error> {
        let addr_str = self.contracts.get(name).ok_or_else(|| {
            Error::NotFound(format!("Contract '{}' not found in deployment config", name))
        })?;
        addr_str.parse::<Address>().map_err(|e| {
            Error::InvalidArgument(format!(
                "Invalid address for contract '{}': {}",
                name, e
            ))
        })
    }

    /// Get the Index contract address
    pub fn index_address(&self) -> Result<Address, Error> {
        self.get_contract_address("Index")
    }

    /// Get the OracleRegistry contract address
    pub fn oracle_registry_address(&self) -> Result<Address, Error> {
        self.get_contract_address("OracleRegistry")
    }

    /// Get the FeeRegistry contract address
    pub fn fee_registry_address(&self) -> Result<Address, Error> {
        self.get_contract_address("FeeRegistry")
    }

    /// Get the AssetPairRegistry contract address
    pub fn asset_pair_registry_address(&self) -> Result<Address, Error> {
        self.get_contract_address("AssetPairRegistry")
    }

    /// Get the CollateralRegistry contract address
    pub fn collateral_registry_address(&self) -> Result<Address, Error> {
        self.get_contract_address("CollateralRegistry")
    }

    /// Get the BLSCustody contract address
    pub fn bls_custody_address(&self) -> Result<Address, Error> {
        self.get_contract_address("BLSCustody")
    }

    /// Get the L3BridgeCustody contract address
    pub fn l3_bridge_custody_address(&self) -> Result<Address, Error> {
        self.get_contract_address("L3BridgeCustody")
    }

    /// Get the Governance contract address
    pub fn governance_address(&self) -> Result<Address, Error> {
        self.get_contract_address("Governance")
    }

    /// Get the USDC contract address
    pub fn usdc_address(&self) -> Result<Address, Error> {
        self.get_contract_address("USDC")
    }

    /// Get the MockBitgetVault contract address (E2E testing)
    pub fn mock_bitget_vault_address(&self) -> Result<Address, Error> {
        self.get_contract_address("MockBitgetVault")
    }

    /// Get a token address by symbol (E2E testing)
    /// Supports: BTC, ETH, L3_WUSDC, SETTLEMENT_USDC
    pub fn token_address(&self, symbol: &str) -> Result<Address, Error> {
        self.get_contract_address(symbol)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn sample_deployment_json() -> &'static str {
        r#"{
  "chainId": 111222333,
  "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "timestamp": 1769655467,
  "contracts": {
    "Governance": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "OracleRegistry": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    "FeeRegistry": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "AssetPairRegistry": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    "CollateralRegistry": "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
    "BLSCustody": "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
    "L3BridgeCustody": "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
    "Index": "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82",
    "USDC": "0x183A81F735430AAF58227aF4c0D7B35bC8e0f8B6"
  }
}"#
    }

    #[test]
    fn test_from_file() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(sample_deployment_json().as_bytes()).unwrap();
        file.flush().unwrap();

        let config = DeploymentConfig::from_file(file.path()).unwrap();
        assert_eq!(config.chain_id, 111222333);
        assert_eq!(config.contracts.len(), 9);
    }

    #[test]
    fn test_validate_correct_chain_id() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(sample_deployment_json().as_bytes()).unwrap();
        file.flush().unwrap();

        let config = DeploymentConfig::from_file(file.path()).unwrap();
        assert!(config.validate(111222333).is_ok());
    }

    #[test]
    fn test_validate_wrong_chain_id() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(sample_deployment_json().as_bytes()).unwrap();
        file.flush().unwrap();

        let config = DeploymentConfig::from_file(file.path()).unwrap();
        assert!(config.validate(999).is_err());
    }

    #[test]
    fn test_contract_address_getters() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(sample_deployment_json().as_bytes()).unwrap();
        file.flush().unwrap();

        let config = DeploymentConfig::from_file(file.path()).unwrap();

        let index = config.index_address().unwrap();
        assert_ne!(index, Address::zero());

        let oracle_reg = config.oracle_registry_address().unwrap();
        assert_ne!(oracle_reg, Address::zero());

        let bridge = config.l3_bridge_custody_address().unwrap();
        assert_ne!(bridge, Address::zero());

        let usdc = config.usdc_address().unwrap();
        assert_ne!(usdc, Address::zero());
    }

    #[test]
    fn test_missing_contract() {
        let json = r#"{
  "chainId": 111222333,
  "deployer": "0x0000000000000000000000000000000000000000",
  "timestamp": 1,
  "contracts": {}
}"#;
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(json.as_bytes()).unwrap();
        file.flush().unwrap();

        let config = DeploymentConfig::from_file(file.path()).unwrap();
        assert!(config.index_address().is_err());
    }

    #[test]
    fn test_validate_zero_address() {
        let json = r#"{
  "chainId": 111222333,
  "deployer": "0x0000000000000000000000000000000000000000",
  "timestamp": 1,
  "contracts": {
    "Index": "0x0000000000000000000000000000000000000000",
    "OracleRegistry": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    "L3BridgeCustody": "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e"
  }
}"#;
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(json.as_bytes()).unwrap();
        file.flush().unwrap();

        let config = DeploymentConfig::from_file(file.path()).unwrap();
        assert!(config.validate(111222333).is_err());
    }

    #[test]
    fn test_from_file_nonexistent() {
        let result = DeploymentConfig::from_file(Path::new("/nonexistent/path.json"));
        assert!(result.is_err());
    }

    #[test]
    fn test_from_file_invalid_json() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(b"not json").unwrap();
        file.flush().unwrap();

        let result = DeploymentConfig::from_file(file.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_impl_addresses_ignored() {
        // Verify that *Impl keys are ignored (only proxy addresses matter)
        let json = r#"{
  "chainId": 111222333,
  "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "timestamp": 1,
  "contracts": {
    "Index": "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82",
    "IndexImpl": "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
    "OracleRegistry": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    "L3BridgeCustody": "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e"
  }
}"#;
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(json.as_bytes()).unwrap();
        file.flush().unwrap();

        let config = DeploymentConfig::from_file(file.path()).unwrap();
        // The proxy address is what we use, not the impl
        let index = config.index_address().unwrap();
        assert_ne!(index, Address::zero());
        assert!(config.validate(111222333).is_ok());
    }
}
