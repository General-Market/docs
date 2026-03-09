//! ITP Registry Reader implementation for NAV signing endpoint
//!
//! Provides an adapter that reads ITP inventory data from Index.sol
//! to support the NAV signing endpoint (Story 8.3).

use async_trait::async_trait;
use ethers::prelude::*;
use ethers::types::{Address, U256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::debug;

use super::nav_sign::{ItpInfo, ItpRegistryReader};

// ABI for Index.sol ITP functions
abigen!(
    IndexItpReader,
    r#"[
        function getAllItps() external view returns (address[] vaults)
        function getITPState(bytes32 itpId) external view returns (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
    ]"#
);

/// Configuration for EthersItpRegistryReader
#[derive(Debug, Clone)]
pub struct ItpRegistryConfig {
    /// Index contract address
    pub index_address: Address,
    /// Cache TTL in seconds (0 = no caching)
    pub cache_ttl_secs: u64,
}

impl Default for ItpRegistryConfig {
    fn default() -> Self {
        Self {
            index_address: Address::zero(),
            cache_ttl_secs: 60, // Cache for 1 minute
        }
    }
}

/// Cached ITP data
#[derive(Debug, Clone)]
struct CachedItpInfo {
    info: ItpInfo,
    cached_at: std::time::Instant,
}

/// ITP Registry Reader using ethers-rs
///
/// Reads ITP inventory data from Index.sol contract.
/// Maintains an internal cache of vault address → bytes32 itpId mapping.
pub struct EthersItpRegistryReader<M: Middleware> {
    provider: Arc<M>,
    config: ItpRegistryConfig,
    /// Cache: vault address → itpId (bytes32)
    vault_to_itp_id: Arc<RwLock<HashMap<Address, [u8; 32]>>>,
    /// Cache: vault address → ITP info
    info_cache: Arc<RwLock<HashMap<Address, CachedItpInfo>>>,
    /// List of all known ITP IDs (in order)
    all_itp_ids: Arc<RwLock<Vec<[u8; 32]>>>,
}

impl<M: Middleware + 'static> EthersItpRegistryReader<M> {
    /// Creates a new EthersItpRegistryReader
    pub fn new(provider: Arc<M>, config: ItpRegistryConfig) -> Self {
        Self {
            provider,
            config,
            vault_to_itp_id: Arc::new(RwLock::new(HashMap::new())),
            info_cache: Arc::new(RwLock::new(HashMap::new())),
            all_itp_ids: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Refreshes the vault → itpId mapping from chain
    async fn refresh_vault_mapping(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let contract = IndexItpReader::new(self.config.index_address, self.provider.clone());

        // Get all vault addresses
        let vaults: Vec<Address> = contract.get_all_itps().call().await?;

        // Build mapping: vault address → itpId (by index)
        // The Index contract stores ITPs in order, so we can derive itpId from index
        let mut mapping = self.vault_to_itp_id.write().await;
        let mut ids = self.all_itp_ids.write().await;

        mapping.clear();
        ids.clear();

        for (i, vault) in vaults.iter().enumerate() {
            // ITP IDs are typically sequential starting from 1, encoded as bytes32
            // This matches how the contract stores them
            let mut itp_id = [0u8; 32];
            U256::from(i + 1).to_big_endian(&mut itp_id);

            mapping.insert(*vault, itp_id);
            ids.push(itp_id);
        }

        debug!(
            vault_count = vaults.len(),
            "Refreshed ITP vault mapping from Index contract"
        );

        Ok(())
    }

    /// Gets itpId for a vault address, refreshing cache if needed
    async fn get_itp_id(
        &self,
        vault: Address,
    ) -> Result<Option<[u8; 32]>, Box<dyn std::error::Error + Send + Sync>> {
        // Check existing cache
        {
            let cache = self.vault_to_itp_id.read().await;
            if let Some(id) = cache.get(&vault) {
                return Ok(Some(*id));
            }
        }

        // Cache miss - refresh from chain
        self.refresh_vault_mapping().await?;

        // Check again
        let cache = self.vault_to_itp_id.read().await;
        Ok(cache.get(&vault).copied())
    }

    /// Fetches ITP state from chain
    async fn fetch_itp_state(
        &self,
        itp_id: [u8; 32],
    ) -> Result<ItpInfo, Box<dyn std::error::Error + Send + Sync>> {
        let contract = IndexItpReader::new(self.config.index_address, self.provider.clone());

        let (_creator, total_supply, _nav, assets, _weights, inventory_raw) =
            contract.get_itp_state(itp_id.into()).call().await?;

        // Build inventory from assets and per-share quantities
        let inventory: Vec<(Address, U256)> = assets
            .into_iter()
            .zip(inventory_raw.into_iter())
            .collect();

        // Derive ITP ID as U256
        let id = U256::from_big_endian(&itp_id);

        Ok(ItpInfo {
            id,
            inventory,
            shares_outstanding: total_supply,
        })
    }
}

#[async_trait]
impl<M> ItpRegistryReader for EthersItpRegistryReader<M>
where
    M: Middleware + 'static,
{
    async fn get_itp_info(
        &self,
        itp_address: Address,
    ) -> Result<Option<ItpInfo>, Box<dyn std::error::Error + Send + Sync>> {
        // Check info cache first
        if self.config.cache_ttl_secs > 0 {
            let cache = self.info_cache.read().await;
            if let Some(cached) = cache.get(&itp_address) {
                if cached.cached_at.elapsed().as_secs() < self.config.cache_ttl_secs {
                    debug!(itp = ?itp_address, "ITP info cache hit");
                    return Ok(Some(cached.info.clone()));
                }
            }
        }

        // Get itpId for this vault address
        let itp_id = match self.get_itp_id(itp_address).await? {
            Some(id) => id,
            None => {
                debug!(itp = ?itp_address, "ITP not found in vault mapping");
                return Ok(None);
            }
        };

        // Fetch state from chain
        let info = self.fetch_itp_state(itp_id).await?;

        // Cache the result
        if self.config.cache_ttl_secs > 0 {
            let mut cache = self.info_cache.write().await;
            cache.insert(
                itp_address,
                CachedItpInfo {
                    info: info.clone(),
                    cached_at: std::time::Instant::now(),
                },
            );
        }

        Ok(Some(info))
    }
}

/// Stub ITP Registry Reader for testing or when chain reader is unavailable
///
/// Returns a fixed inventory for any ITP address (useful for local testing).
pub struct StubItpRegistryReader {
    /// Fixed inventory to return for all ITPs
    default_inventory: Vec<(Address, U256)>,
}

impl StubItpRegistryReader {
    /// Creates a stub reader with a default inventory
    pub fn new() -> Self {
        // Default: single asset (USDC-like) with 1e18 qty (= $1 if price is $1)
        let usdc: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
            .parse()
            .unwrap_or(Address::zero());

        Self {
            default_inventory: vec![(usdc, U256::exp10(18))],
        }
    }

    /// Creates a stub reader with custom inventory
    pub fn with_inventory(inventory: Vec<(Address, U256)>) -> Self {
        Self {
            default_inventory: inventory,
        }
    }
}

impl Default for StubItpRegistryReader {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ItpRegistryReader for StubItpRegistryReader {
    async fn get_itp_info(
        &self,
        itp_address: Address,
    ) -> Result<Option<ItpInfo>, Box<dyn std::error::Error + Send + Sync>> {
        // For stub, return info for any non-zero address
        if itp_address == Address::zero() {
            return Ok(None);
        }

        Ok(Some(ItpInfo {
            id: U256::from(1),
            inventory: self.default_inventory.clone(),
            shares_outstanding: U256::exp10(18) * 1000, // 1000 shares
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_stub_reader_returns_info_for_valid_address() {
        let reader = StubItpRegistryReader::new();
        let addr: Address = "0x1234567890123456789012345678901234567890"
            .parse()
            .unwrap();

        let result = reader.get_itp_info(addr).await.unwrap();
        assert!(result.is_some());

        let info = result.unwrap();
        assert!(!info.inventory.is_empty());
    }

    #[tokio::test]
    async fn test_stub_reader_returns_none_for_zero_address() {
        let reader = StubItpRegistryReader::new();
        let result = reader.get_itp_info(Address::zero()).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_stub_reader_custom_inventory() {
        let asset: Address = "0xaaaa111111111111111111111111111111111111"
            .parse()
            .unwrap();
        let reader = StubItpRegistryReader::with_inventory(vec![(asset, U256::from(100))]);

        let addr: Address = "0x1234567890123456789012345678901234567890"
            .parse()
            .unwrap();
        let info = reader.get_itp_info(addr).await.unwrap().unwrap();

        assert_eq!(info.inventory.len(), 1);
        assert_eq!(info.inventory[0].0, asset);
    }
}
