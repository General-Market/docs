use arc_swap::ArcSwap;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use ethers::types::Address;
use serde::Serialize;
use crate::adapters::deployment_config::DeploymentConfig;

/// Lock-free shared config handle. All services hold this.
/// Readers call `.load()` (zero-cost Arc clone).
/// Writers call `.store()` (atomic pointer swap).
pub type SharedConfig = Arc<ArcSwap<RuntimeConfig>>;

#[derive(Debug, Clone, Serialize)]
pub struct RuntimeConfig {
    // === Deployment addresses ===
    pub deployment: DeploymentConfig,
    pub deployment_nonce: u64,
    pub symbol_map: HashMap<String, String>, // address_hex -> bitget_pair

    // === URLs ===
    pub rpc_url: String,
    pub settlement_rpc_url: Option<String>,
    pub data_node_url: Option<String>,

    // === Tuning (all env-overridable) ===
    pub db_pool_size: u32,
    pub poll_interval_secs: u64,
    pub channel_capacity: usize,
    pub rpc_timeout_secs: u64,
    pub snapshot_timeout_secs: u64,
    pub sse_max_connections: usize,
    pub sse_per_ip_limit: usize,

    // === Metadata ===
    pub loaded_at: chrono::DateTime<chrono::Utc>,
    pub deployment_file_path: PathBuf,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Failed to read deployment file: {0}")]
    FileRead(#[from] std::io::Error),
    #[error("Failed to parse deployment JSON: {0}")]
    Parse(#[from] serde_json::Error),
    #[error("RPC call failed: {0}")]
    Rpc(String),
    #[error("Validation failed: {0}")]
    Validation(String),
}

impl RuntimeConfig {
    /// Load config from deployment file + env vars.
    /// `deployment_nonce` is set to 0 if no RPC available (local dev).
    pub async fn load(
        deployment_path: &Path,
        rpc_url: &str,
        index_address: Option<Address>,
    ) -> Result<Self, ConfigError> {
        let deployment = DeploymentConfig::from_file(deployment_path)
            .map_err(|e| ConfigError::Validation(e.to_string()))?;

        // Read deployment nonce from chain (if index address available)
        let deployment_nonce = match index_address {
            Some(addr) => Self::read_nonce(rpc_url, addr).await.unwrap_or(0),
            None => 0,
        };

        // Load symbol map from file if exists, otherwise empty
        let symbol_map_path = deployment_path
            .parent()
            .unwrap_or(Path::new("."))
            .join("../data/symbol-map.json");
        let symbol_map = Self::load_symbol_map(&symbol_map_path).unwrap_or_default();

        Ok(Self {
            deployment,
            deployment_nonce,
            symbol_map,
            rpc_url: rpc_url.to_string(),
            settlement_rpc_url: std::env::var("SETTLEMENT_RPC_URL").ok(),
            data_node_url: std::env::var("DATA_NODE_URL").ok(),
            db_pool_size: env_or("DB_POOL_SIZE", 10),
            poll_interval_secs: env_or("POLL_INTERVAL_SECS", 30),
            channel_capacity: env_or("CHANNEL_CAPACITY", 256),
            rpc_timeout_secs: env_or("RPC_TIMEOUT_SECS", 60),
            snapshot_timeout_secs: env_or("SNAPSHOT_TIMEOUT_SECS", 120),
            sse_max_connections: env_or("SSE_MAX_CONNECTIONS", 500),
            sse_per_ip_limit: env_or("SSE_PER_IP_LIMIT", 10),
            loaded_at: chrono::Utc::now(),
            deployment_file_path: deployment_path.to_path_buf(),
        })
    }

    /// Reload from disk + chain. Returns (new_config, nonce_changed).
    pub async fn reload(&self) -> Result<(Self, bool), ConfigError> {
        let index_addr = self.deployment.index_address().ok();
        let mut new = Self::load(
            &self.deployment_file_path,
            &self.rpc_url,
            index_addr,
        )
        .await?;
        // Transient RPC failure inside `read_nonce` returns 0 from the chain
        // read, which would otherwise read as a deployment-reset and trigger
        // a full state flush on every nginx 502. Treat 0-on-reload as "no
        // signal" and keep the previously known nonce. A real reset arrives
        // through the bootstrap path, not the reload watcher.
        if new.deployment_nonce == 0 && self.deployment_nonce != 0 {
            new.deployment_nonce = self.deployment_nonce;
        }
        let nonce_changed = new.deployment_nonce != self.deployment_nonce;
        Ok((new, nonce_changed))
    }

    async fn read_nonce(rpc_url: &str, index_address: Address) -> Result<u64, ConfigError> {
        // eth_call to Investment.deploymentNonce()
        // selector: keccak256("deploymentNonce()") = first 4 bytes
        let client = ethers::providers::Provider::<ethers::providers::Http>::try_from(rpc_url)
            .map_err(|e| ConfigError::Rpc(e.to_string()))?;
        let call = ethers::types::TransactionRequest::new()
            .to(index_address)
            .data(ethers::utils::id("deploymentNonce()").to_vec());
        let result = ethers::providers::Middleware::call(&client, &call.into(), None)
            .await
            .map_err(|e| ConfigError::Rpc(e.to_string()))?;
        // Decode uint256 -> u64
        if result.len() >= 32 {
            let n = ethers::types::U256::from_big_endian(&result[..32]);
            Ok(n.as_u64())
        } else {
            Ok(0)
        }
    }

    fn load_symbol_map(path: &Path) -> Result<HashMap<String, String>, ConfigError> {
        let contents = std::fs::read_to_string(path)?;
        let map: HashMap<String, String> = serde_json::from_str(&contents)?;
        Ok(map)
    }

    /// Diff two configs for logging
    pub fn diff(&self, other: &Self) -> Vec<String> {
        let mut diffs = vec![];
        if self.deployment_nonce != other.deployment_nonce {
            diffs.push(format!(
                "deployment_nonce: {} -> {}",
                self.deployment_nonce, other.deployment_nonce
            ));
        }
        if self.rpc_url != other.rpc_url {
            diffs.push(format!("rpc_url: {} -> {}", self.rpc_url, other.rpc_url));
        }
        if self.settlement_rpc_url != other.settlement_rpc_url {
            diffs.push(format!(
                "settlement_rpc_url: {:?} -> {:?}",
                self.settlement_rpc_url, other.settlement_rpc_url
            ));
        }
        if self.data_node_url != other.data_node_url {
            diffs.push(format!(
                "data_node_url: {:?} -> {:?}",
                self.data_node_url, other.data_node_url
            ));
        }
        if self.db_pool_size != other.db_pool_size {
            diffs.push(format!(
                "db_pool_size: {} -> {}",
                self.db_pool_size, other.db_pool_size
            ));
        }
        if self.poll_interval_secs != other.poll_interval_secs {
            diffs.push(format!(
                "poll_interval_secs: {} -> {}",
                self.poll_interval_secs, other.poll_interval_secs
            ));
        }
        if self.channel_capacity != other.channel_capacity {
            diffs.push(format!(
                "channel_capacity: {} -> {}",
                self.channel_capacity, other.channel_capacity
            ));
        }
        if self.rpc_timeout_secs != other.rpc_timeout_secs {
            diffs.push(format!(
                "rpc_timeout_secs: {} -> {}",
                self.rpc_timeout_secs, other.rpc_timeout_secs
            ));
        }
        if self.snapshot_timeout_secs != other.snapshot_timeout_secs {
            diffs.push(format!(
                "snapshot_timeout_secs: {} -> {}",
                self.snapshot_timeout_secs, other.snapshot_timeout_secs
            ));
        }
        if self.sse_max_connections != other.sse_max_connections {
            diffs.push(format!(
                "sse_max_connections: {} -> {}",
                self.sse_max_connections, other.sse_max_connections
            ));
        }
        if self.sse_per_ip_limit != other.sse_per_ip_limit {
            diffs.push(format!(
                "sse_per_ip_limit: {} -> {}",
                self.sse_per_ip_limit, other.sse_per_ip_limit
            ));
        }
        // Compare deployment contracts
        let old_contracts = &self.deployment.contracts;
        let new_contracts = &other.deployment.contracts;
        for (key, old_val) in old_contracts {
            match new_contracts.get(key) {
                Some(new_val) if new_val != old_val => {
                    diffs.push(format!("contract.{key}: {old_val} -> {new_val}"));
                }
                None => {
                    diffs.push(format!("contract.{key}: {old_val} -> REMOVED"));
                }
                _ => {}
            }
        }
        for key in new_contracts.keys() {
            if !old_contracts.contains_key(key) {
                diffs.push(format!("contract.{key}: NEW -> {}", new_contracts[key]));
            }
        }
        // Compare symbol map (length only -- individual entries are too noisy)
        if self.symbol_map.len() != other.symbol_map.len() {
            diffs.push(format!(
                "symbol_map.len: {} -> {}",
                self.symbol_map.len(),
                other.symbol_map.len()
            ));
        }
        diffs
    }
}

/// Helper: read env var or return default
fn env_or<T: std::str::FromStr>(key: &str, default: T) -> T {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

/// Create a SharedConfig from an initial RuntimeConfig
pub fn shared(config: RuntimeConfig) -> SharedConfig {
    Arc::new(ArcSwap::from_pointee(config))
}
