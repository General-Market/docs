# ITP Rebalance Bot — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bot that deploys all 107 ITPs on-chain and automatically rebalances them using the same logic as the backtester.

**Architecture:** A Rust service (`itp-bot/`) that runs alongside the existing oracles. On startup it reads ITP configs from a JSON manifest. For each ITP: if not yet deployed on-chain, it calls `createITP`. On a schedule (per-ITP `rebalance_days`), it queries the data-node sim API for current optimal holdings, diffs against on-chain state, and submits `requestRebalance` via the bridge. Oracles handle BLS consensus and execution. The bot is stateless — all state is on-chain or in the data-node.

**Tech Stack:** Rust (tokio, ethers, reqwest), data-node sim API, L3 RPC, existing oracle BLS consensus

---

## System Overview

```
                    ┌──────────────┐
                    │  itp-bot     │
                    │  (Rust)      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌────────────┐ ┌──────────┐ ┌──────────┐
     │ data-node  │ │   L3     │ │ manifest │
     │ /sim/run   │ │   RPC    │ │ .json    │
     │ /sim/hold  │ │          │ │          │
     └────────────┘ └──────────┘ └──────────┘
              │            │
              │            ▼
              │     ┌──────────────┐
              │     │  Investment  │
              │     │  .sol        │
              │     │  createITP() │
              │     │  rebalance() │
              │     └──────┬───────┘
              │            │
              │            ▼
              │     ┌──────────────┐
              │     │  Oracles     │
              │     │  (BLS)       │
              │     │  consensus   │
              │     └──────────────┘
              │            │
              └────────────┘
```

**Flow per ITP:**

1. **Boot:** Read manifest → for each ITP config, check if `itpId` exists on-chain
2. **Deploy (if new):** Deploy mock tokens (if needed) → `createITP(name, symbol, weights, assets, prices)`
3. **Monitor:** Every `rebalance_days`, query data-node for what the sim says the holdings should be
4. **Diff:** Compare sim holdings vs on-chain `_itpAssets` + `_itpWeights`
5. **Rebalance:** If drift exceeds threshold, call `requestRebalance` → oracles pick up, BLS-sign, execute

---

## File Structure

```
itp-bot/
├── Cargo.toml
├── src/
│   ├── main.rs              # Entry point, config loading, scheduler
│   ├── config.rs            # CLI args, env vars, manifest parsing
│   ├── manifest.rs          # ITP manifest types (from itp-ideas.md configs)
│   ├── deployer.rs          # Creates new ITPs on-chain
│   ├── rebalancer.rs        # Computes rebalance diffs, submits requestRebalance
│   ├── data_node.rs         # HTTP client for data-node sim API
│   ├── chain.rs             # L3 RPC reads (getITPState, getITPInventory)
│   └── token_registry.rs    # Symbol → address mapping (from assets.json)
├── manifest.json            # 107 ITP configs (generated from itp-ideas.md)
└── Dockerfile
```

**Existing files to modify:**
- `Cargo.toml` (workspace) — add `itp-bot` member
- `docker/testnet/` — add `itp-bot/docker-compose.yml`
- `testnet.sh` — add itp-bot start/stop
- `data-node/src/api.rs` — add `/sim/rebalance-target` endpoint (returns current optimal holdings for a config without running full sim)

---

## Chunk 1: Manifest & Config

### Task 1: Generate ITP Manifest JSON

The manifest bridges the `.md` ITP ideas to machine-readable configs.

**Files:**
- Create: `scripts/generate-itp-manifest.py`
- Create: `itp-bot/manifest.json`

- [ ] **Step 1: Write manifest generator**

Parses `docs/itp-ideas.md` (reusing the parser from `scripts/backtest-all-itps.py`) and outputs a JSON manifest with all 107 ITPs:

```python
# scripts/generate-itp-manifest.py
# Reuse parse_itp_ideas() from backtest-all-itps.py
# Output format per ITP:
{
  "id": 1,
  "ticker": "BRDG",
  "name": "Cross-Chain & Interoperability Index",
  "config": {
    "category_id": "cross-chain-communication",
    "top_n": 10,
    "weighting": "mcap",
    "rebalance_days": 30
  },
  "overlays": {},
  "on_chain": {
    "itp_id": null,          // Filled after deployment
    "vault_address": null,   // Filled after deployment
    "deployed_at": null
  }
}
```

- [ ] **Step 2: Run generator, verify output**

```bash
python3 scripts/generate-itp-manifest.py
cat itp-bot/manifest.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d)} ITPs')"
# Expected: 107 ITPs
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-itp-manifest.py itp-bot/manifest.json
git commit -m "feat(itp-bot): generate manifest from ITP ideas"
```

---

### Task 2: ITP Bot Scaffold

**Files:**
- Create: `itp-bot/Cargo.toml`
- Create: `itp-bot/src/main.rs`
- Create: `itp-bot/src/config.rs`
- Create: `itp-bot/src/manifest.rs`
- Modify: `Cargo.toml` (workspace members)

- [ ] **Step 1: Add to workspace**

Add `"itp-bot"` to `[workspace] members` in root `Cargo.toml`.

- [ ] **Step 2: Create Cargo.toml**

```toml
[package]
name = "itp-bot"
version.workspace = true
edition.workspace = true

[dependencies]
tokio = { version = "1", features = ["full", "signal"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json"] }
ethers = "2"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
chrono = { version = "0.4", features = ["serde"] }
clap = { version = "4", features = ["derive"] }
```

- [ ] **Step 3: Write config.rs**

```rust
// CLI args + env loading
use clap::Parser;

#[derive(Parser, Debug)]
pub struct Args {
    /// Path to ITP manifest JSON
    #[arg(long, default_value = "itp-bot/manifest.json")]
    pub manifest: String,

    /// Data node URL for sim API
    #[arg(long, env = "DATA_NODE_URL", default_value = "http://localhost:8200")]
    pub data_node_url: String,

    /// L3 RPC URL
    #[arg(long, env = "L3_RPC_URL", default_value = "http://localhost:8545")]
    pub rpc_url: String,

    /// Index contract address
    #[arg(long, env = "INDEX_ADDRESS")]
    pub index_address: String,

    /// Path to file containing bot wallet private key
    #[arg(long, env = "BOT_KEY_FILE", default_value = "/tmp/bot-key.txt")]
    pub key_file: String,

    /// Drift threshold (%) before triggering rebalance
    #[arg(long, default_value = "5.0")]
    pub drift_threshold_pct: f64,

    /// Poll interval in seconds
    #[arg(long, default_value = "3600")]
    pub poll_interval_secs: u64,

    /// Dry run — log actions but don't submit transactions
    #[arg(long, default_value = "false")]
    pub dry_run: bool,
}
```

- [ ] **Step 4: Write manifest.rs**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItpManifest {
    pub itps: Vec<ItpConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItpConfig {
    pub id: u32,
    pub ticker: String,
    pub name: String,
    pub config: SimConfig,
    pub overlays: serde_json::Value,
    pub on_chain: OnChainState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimConfig {
    pub category_id: String,
    pub top_n: u32,
    pub weighting: String,
    pub rebalance_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnChainState {
    pub itp_id: Option<String>,
    pub vault_address: Option<String>,
    pub deployed_at: Option<String>,
}

impl ItpManifest {
    pub fn load(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let data = std::fs::read_to_string(path)?;
        let itps: Vec<ItpConfig> = serde_json::from_str(&data)?;
        Ok(Self { itps })
    }
}
```

- [ ] **Step 5: Write main.rs (scaffold)**

```rust
mod config;
mod manifest;

use clap::Parser;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env()
            .add_directive("itp_bot=info".parse()?))
        .init();

    let args = config::Args::parse();
    info!("ITP Bot starting");
    info!("Manifest: {}", args.manifest);
    info!("Data node: {}", args.data_node_url);
    info!("RPC: {}", args.rpc_url);
    info!("Dry run: {}", args.dry_run);

    let manifest = manifest::ItpManifest::load(&args.manifest)?;
    info!("Loaded {} ITP configs", manifest.itps.len());

    // TODO: data_node client, chain client, scheduler
    Ok(())
}
```

- [ ] **Step 6: Build and verify**

```bash
cargo build -p itp-bot
# Expected: compiles successfully
```

- [ ] **Step 7: Commit**

```bash
git add itp-bot/ Cargo.toml
git commit -m "feat(itp-bot): scaffold with config, manifest, main"
```

---

## Chunk 2: Data Node Client

### Task 3: Data Node Sim Client

Queries the data-node to get current optimal holdings for each ITP config.

**Files:**
- Create: `itp-bot/src/data_node.rs`

- [ ] **Step 1: Write data_node.rs**

```rust
use reqwest::Client;
use serde::Deserialize;
use crate::manifest::SimConfig;

#[derive(Debug, Deserialize)]
pub struct SimRunResponse {
    pub run_id: i64,
    pub stats: SimStats,
    pub nav_series: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct SimStats {
    pub total_return_pct: f64,
    pub sharpe_ratio: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SimHolding {
    pub coin_id: String,
    pub symbol: String,
    pub weight: f64,
    pub price_usd: f64,
}

pub struct DataNodeClient {
    client: Client,
    base_url: String,
    auth_token: Option<String>,
}

impl DataNodeClient {
    pub fn new(base_url: &str, auth_token: Option<String>) -> Self {
        Self { client: Client::new(), base_url: base_url.trim_end_matches('/').to_string(), auth_token }
    }
    // ... in each request method, add:
    // .header("Authorization", format!("Bearer {}", token))

    /// Run a simulation and get the run_id
    pub async fn sim_run(&self, config: &SimConfig) -> Result<i64, reqwest::Error> {
        let resp: SimRunResponse = self.client
            .get(format!("{}/sim/run", self.base_url))
            .query(&[
                ("category_id", config.category_id.as_str()),
                ("top_n", &config.top_n.to_string()),
                ("weighting", config.weighting.as_str()),
                ("rebalance_days", &config.rebalance_days.to_string()),
                ("base_fee_pct", "0.001"),
                ("spread_multiplier", "1.0"),
            ])
            .send()
            .await?
            .json()
            .await?;
        Ok(resp.run_id)
    }

    /// Get latest holdings for a sim run
    pub async fn sim_holdings(&self, run_id: i64) -> Result<Vec<SimHolding>, reqwest::Error> {
        #[derive(Deserialize)]
        struct Resp { holdings: Vec<SimHolding> }
        let resp: Resp = self.client
            .get(format!("{}/sim/holdings", self.base_url))
            .query(&[("run_id", run_id.to_string())])
            .send()
            .await?
            .json()
            .await?;
        Ok(resp.holdings)
    }

    /// Convenience: get current target holdings for an ITP config
    pub async fn get_target_holdings(&self, config: &SimConfig) -> Result<Vec<SimHolding>, Box<dyn std::error::Error>> {
        let run_id = self.sim_run(config).await?;
        let holdings = self.sim_holdings(run_id).await?;
        Ok(holdings)
    }
}
```

- [ ] **Step 2: Build and verify**

```bash
cargo build -p itp-bot
```

- [ ] **Step 3: Commit**

```bash
git add itp-bot/src/data_node.rs
git commit -m "feat(itp-bot): data-node sim API client"
```

---

## Chunk 3: Chain Reader & Token Registry

### Task 4: Token Registry

Maps symbols to on-chain addresses using `assets.json`.

**Files:**
- Create: `itp-bot/src/token_registry.rs`

- [ ] **Step 1: Write token_registry.rs**

```rust
use std::collections::HashMap;
use serde::Deserialize;
use ethers::types::Address;

#[derive(Deserialize)]
struct AssetEntry {
    address: String,
    bitget: Option<String>,
    symbol: Option<String>,
}

pub struct TokenRegistry {
    /// SYMBOL (uppercase) → on-chain address
    pub symbol_to_address: HashMap<String, Address>,
    /// on-chain address → SYMBOL
    pub address_to_symbol: HashMap<Address, String>,
}

impl TokenRegistry {
    /// Load from deployed-assets.json (symbol format)
    pub fn from_deployed_assets(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        #[derive(Deserialize)]
        struct Entry { address: String, symbol: String }
        let data = std::fs::read_to_string(path)?;
        let entries: Vec<Entry> = serde_json::from_str(&data)?;
        let mut s2a = HashMap::new();
        let mut a2s = HashMap::new();
        for e in entries {
            let addr: Address = e.address.parse()?;
            s2a.insert(e.symbol.to_uppercase(), addr);
            a2s.insert(addr, e.symbol.to_uppercase());
        }
        Ok(Self { symbol_to_address: s2a, address_to_symbol: a2s })
    }

    pub fn get_address(&self, symbol: &str) -> Option<Address> {
        self.symbol_to_address.get(&symbol.to_uppercase()).copied()
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add itp-bot/src/token_registry.rs
git commit -m "feat(itp-bot): token registry from deployed-assets.json"
```

---

### Task 5: Chain State Reader

Reads current ITP state from L3.

**Files:**
- Create: `itp-bot/src/chain.rs`

- [ ] **Step 1: Write chain.rs**

```rust
use ethers::prelude::*;
use ethers::types::{Address, U256};
use std::sync::Arc;

abigen!(
    IInvestment,
    r#"[
        function getITPState(bytes32 itpId) view returns (address[] assets, uint256[] weights, uint256[] inventory, uint256 nav, uint256 totalSupply)
        function getITPInfo(bytes32 itpId) view returns (string name, string symbol, address creator, uint256 createdAt, uint8 status, uint256 assetCount)
        function itpCount() view returns (uint256)
        function requestRebalance(bytes32 itpId, uint256[] removeIndices, address[] addAssets, uint256[] newWeights, string note)
        function createITP(string name, string symbol, uint256[] weights, address[] assets, uint256[] prices, uint256 bridgeNonce) returns (bytes32 itpId)
    ]"#
);

pub struct ChainClient {
    pub contract: IInvestment<SignerMiddleware<Provider<Http>, LocalWallet>>,
}

impl ChainClient {
    pub fn new(rpc_url: &str, contract_addr: Address, wallet: LocalWallet) -> Result<Self, Box<dyn std::error::Error>> {
        let provider = Provider::<Http>::try_from(rpc_url)?;
        let client = SignerMiddleware::new(provider, wallet);
        let contract = IInvestment::new(contract_addr, Arc::new(client));
        Ok(Self { contract })
    }

    pub async fn itp_count(&self) -> Result<U256, ContractError<SignerMiddleware<Provider<Http>, LocalWallet>>> {
        self.contract.itp_count().call().await
    }

    pub async fn get_itp_state(&self, itp_id: [u8; 32]) -> Result<(Vec<Address>, Vec<U256>, Vec<U256>, U256, U256), ContractError<SignerMiddleware<Provider<Http>, LocalWallet>>> {
        self.contract.get_itp_state(itp_id).call().await
    }

    pub async fn request_rebalance(
        &self,
        itp_id: [u8; 32],
        remove_indices: Vec<U256>,
        add_assets: Vec<Address>,
        new_weights: Vec<U256>,
        note: String,
    ) -> Result<TransactionReceipt, Box<dyn std::error::Error>> {
        let tx = self.contract.request_rebalance(itp_id, remove_indices, add_assets, new_weights, note);
        let pending = tx.send().await?;
        let receipt = pending.await?.ok_or("no receipt")?;
        Ok(receipt)
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add itp-bot/src/chain.rs
git commit -m "feat(itp-bot): chain client for ITP state reads and rebalance requests"
```

---

## Chunk 4: Rebalancer Logic

### Task 6: Rebalance Diff Engine

The core logic: compare sim-target holdings with on-chain holdings, compute diff, submit rebalance.

**Files:**
- Create: `itp-bot/src/rebalancer.rs`

- [ ] **Step 1: Write rebalancer.rs**

```rust
use ethers::types::{Address, U256};
use tracing::{info, warn};
use crate::data_node::{DataNodeClient, SimHolding};
use crate::chain::ChainClient;
use crate::token_registry::TokenRegistry;
use crate::manifest::SimConfig;

/// Compute weight drift between on-chain and target
pub struct RebalanceDiff {
    pub remove_indices: Vec<usize>,      // Assets to remove (sorted descending)
    pub add_assets: Vec<Address>,        // New assets to add
    pub new_weights: Vec<U256>,          // Final weight array (1e18 scale)
    pub max_drift_pct: f64,              // Largest single-asset drift
    pub note: String,
}

/// Compare on-chain state vs sim target, return rebalance diff if drift exceeds threshold
pub fn compute_rebalance_diff(
    on_chain_assets: &[Address],
    on_chain_weights: &[U256],
    target_holdings: &[SimHolding],
    registry: &TokenRegistry,
    drift_threshold_pct: f64,
) -> Option<RebalanceDiff> {
    // Build on-chain map: address → (index, weight_fraction)
    let total_weight: f64 = 1.0; // weights sum to 1e18 = 100%
    let mut on_chain_map: std::collections::HashMap<Address, (usize, f64)> = std::collections::HashMap::new();
    for (i, addr) in on_chain_assets.iter().enumerate() {
        let w = on_chain_weights[i].as_u128() as f64 / 1e18;
        on_chain_map.insert(*addr, (i, w));
    }

    // Build target map: address → weight
    let mut target_map: std::collections::HashMap<Address, f64> = std::collections::HashMap::new();
    for h in target_holdings {
        if let Some(addr) = registry.get_address(&h.symbol) {
            target_map.insert(addr, h.weight);
        } else {
            warn!("Symbol {} not in token registry, skipping", h.symbol);
        }
    }

    // Compute max drift
    let mut max_drift: f64 = 0.0;
    // Check all on-chain assets
    for (addr, (_idx, current_w)) in &on_chain_map {
        let target_w = target_map.get(addr).copied().unwrap_or(0.0);
        let drift = (current_w - target_w).abs() * 100.0;
        if drift > max_drift { max_drift = drift; }
    }
    // Check new target assets not on-chain
    for (addr, target_w) in &target_map {
        if !on_chain_map.contains_key(addr) {
            let drift = target_w * 100.0;
            if drift > max_drift { max_drift = drift; }
        }
    }

    if max_drift < drift_threshold_pct {
        info!("Max drift {:.2}% < threshold {:.1}%, skipping rebalance", max_drift, drift_threshold_pct);
        return None;
    }

    info!("Max drift {:.2}% >= threshold {:.1}%, computing rebalance", max_drift, drift_threshold_pct);

    // Compute removes: on-chain assets not in target
    let mut remove_indices: Vec<usize> = Vec::new();
    for (addr, (idx, _)) in &on_chain_map {
        if !target_map.contains_key(addr) {
            remove_indices.push(*idx);
        }
    }
    remove_indices.sort_unstable();
    remove_indices.reverse(); // Must be sorted descending for swap-and-pop

    // Compute adds: target assets not on-chain
    let mut add_assets: Vec<Address> = Vec::new();
    for addr in target_map.keys() {
        if !on_chain_map.contains_key(addr) {
            add_assets.push(*addr);
        }
    }

    // Build final asset list (after removes + adds) and compute new weights
    let mut final_assets: Vec<Address> = on_chain_assets.to_vec();
    // Apply removes (descending order)
    for &idx in &remove_indices {
        final_assets.swap_remove(idx);
    }
    // Apply adds
    final_assets.extend_from_slice(&add_assets);

    // Compute weights for final asset list
    let mut new_weights: Vec<U256> = Vec::new();
    let mut weight_sum: u128 = 0;
    for (i, addr) in final_assets.iter().enumerate() {
        let w = target_map.get(addr).copied().unwrap_or(0.0);
        let w_u128 = (w * 1e18) as u128;
        new_weights.push(U256::from(w_u128));
        weight_sum += w_u128;
    }

    // Normalize to exactly 1e18 (fix rounding)
    let target_sum: u128 = 1_000_000_000_000_000_000;
    if weight_sum != target_sum && !new_weights.is_empty() {
        let diff = target_sum as i128 - weight_sum as i128;
        let last_idx = new_weights.len() - 1;
        let last = new_weights[last_idx].as_u128() as i128 + diff;
        new_weights[last_idx] = U256::from(last.max(0) as u128);
    }

    Some(RebalanceDiff {
        remove_indices,
        add_assets,
        new_weights,
        max_drift_pct: max_drift,
        note: format!("Auto-rebalance: {:.1}% drift detected", max_drift),
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add itp-bot/src/rebalancer.rs
git commit -m "feat(itp-bot): rebalance diff engine"
```

---

## Chunk 5: Main Loop & Scheduler

### Task 7: Main Loop

Ties everything together: load manifest, poll on schedule, diff, rebalance.

**Files:**
- Modify: `itp-bot/src/main.rs`

- [ ] **Step 1: Write full main.rs**

```rust
mod config;
mod manifest;
mod data_node;
mod chain;
mod token_registry;
mod rebalancer;

use clap::Parser;
use ethers::types::{Address, U256};
use std::str::FromStr;
use tracing::{info, warn, error};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env()
            .add_directive("itp_bot=info".parse()?))
        .init();

    let args = config::Args::parse();
    info!("ITP Bot starting (dry_run={})", args.dry_run);

    // Load manifest
    let manifest = manifest::ItpManifest::load(&args.manifest)?;
    info!("Loaded {} ITP configs", manifest.itps.len());

    // Init clients
    let dn = data_node::DataNodeClient::new(&args.data_node_url);
    let registry = token_registry::TokenRegistry::from_deployed_assets("frontend/public/deployed-assets.json")?;
    info!("Token registry: {} symbols", registry.symbol_to_address.len());

    let wallet = args.private_key.parse::<ethers::signers::LocalWallet>()?;
    let index_addr = Address::from_str(&args.index_address)?;
    let chain = chain::ChainClient::new(&args.rpc_url, index_addr, wallet)?;

    let itp_count = chain.itp_count().await?;
    info!("On-chain ITP count: {}", itp_count);

    // Main loop
    loop {
        for itp in &manifest.itps {
            let itp_id_hex = match &itp.on_chain.itp_id {
                Some(id) => id.clone(),
                None => {
                    warn!("[{}] No on-chain ITP ID, skipping (deploy first)", itp.ticker);
                    continue;
                }
            };

            // Parse itp_id to bytes32
            let itp_id_bytes = ethers::utils::hex::decode(
                itp_id_hex.trim_start_matches("0x")
            )?;
            let mut itp_id = [0u8; 32];
            itp_id.copy_from_slice(&itp_id_bytes);

            info!("[{}] Checking rebalance...", itp.ticker);

            // 1. Get target holdings from sim
            let target = match dn.get_target_holdings(&itp.config).await {
                Ok(h) => h,
                Err(e) => {
                    error!("[{}] Failed to get target holdings: {}", itp.ticker, e);
                    continue;
                }
            };

            // 2. Get on-chain state
            let (assets, weights, _inventory, _nav, _supply) = match chain.get_itp_state(itp_id).await {
                Ok(s) => s,
                Err(e) => {
                    error!("[{}] Failed to read on-chain state: {}", itp.ticker, e);
                    continue;
                }
            };

            // 3. Compute diff
            let diff = rebalancer::compute_rebalance_diff(
                &assets, &weights, &target, &registry, args.drift_threshold_pct
            );

            let Some(diff) = diff else {
                info!("[{}] No rebalance needed", itp.ticker);
                continue;
            };

            info!("[{}] Rebalance needed: drift={:.1}%, removes={}, adds={}",
                itp.ticker, diff.max_drift_pct, diff.remove_indices.len(), diff.add_assets.len());

            if args.dry_run {
                info!("[{}] DRY RUN — would submit requestRebalance", itp.ticker);
                continue;
            }

            // 4. Submit rebalance request
            let remove_u256: Vec<U256> = diff.remove_indices.iter().map(|&i| U256::from(i)).collect();
            match chain.request_rebalance(itp_id, remove_u256, diff.add_assets, diff.new_weights, diff.note).await {
                Ok(receipt) => {
                    info!("[{}] Rebalance requested, tx: {:?}", itp.ticker, receipt.transaction_hash);
                }
                Err(e) => {
                    error!("[{}] Rebalance request failed: {}", itp.ticker, e);
                }
            }
        }

        info!("Cycle complete, sleeping {}s", args.poll_interval_secs);
        tokio::time::sleep(std::time::Duration::from_secs(args.poll_interval_secs)).await;
    }
}
```

- [ ] **Step 2: Build and verify**

```bash
cargo build -p itp-bot
```

- [ ] **Step 3: Commit**

```bash
git add itp-bot/src/
git commit -m "feat(itp-bot): main loop with scheduled rebalance checks"
```

---

## Chunk 6: Deployment Flow

### Task 8: ITP Deployer

For ITPs not yet on-chain, deploy them via `createITP`.

**Files:**
- Create: `itp-bot/src/deployer.rs`

- [ ] **Step 1: Write deployer.rs**

The deployer:
1. Queries data-node for current optimal holdings (top_n coins from category with weights)
2. Maps symbols to on-chain token addresses
3. Fetches current prices from data-node
4. Calls `createITP(name, symbol, weights, assets, prices)`
5. Updates manifest with the new `itp_id`

```rust
use ethers::types::{Address, U256};
use tracing::{info, error};
use crate::data_node::DataNodeClient;
use crate::chain::ChainClient;
use crate::token_registry::TokenRegistry;
use crate::manifest::ItpConfig;

pub async fn deploy_itp(
    itp: &ItpConfig,
    dn: &DataNodeClient,
    chain: &ChainClient,
    registry: &TokenRegistry,
    dry_run: bool,
) -> Result<Option<[u8; 32]>, Box<dyn std::error::Error>> {
    info!("[{}] Deploying ITP: {}", itp.ticker, itp.name);

    // 1. Get target holdings
    let holdings = dn.get_target_holdings(&itp.config).await?;
    if holdings.is_empty() {
        error!("[{}] No holdings returned from sim", itp.ticker);
        return Ok(None);
    }

    // 2. Map to on-chain addresses and compute weights
    let mut assets: Vec<Address> = Vec::new();
    let mut weights: Vec<U256> = Vec::new();
    let mut prices: Vec<U256> = Vec::new();

    for h in &holdings {
        let addr = match registry.get_address(&h.symbol) {
            Some(a) => a,
            None => {
                info!("[{}] Skipping {} — not in token registry", itp.ticker, h.symbol);
                continue;
            }
        };
        assets.push(addr);
        // Weight: h.weight is 0.0-1.0, convert to 1e18 scale
        let w = (h.weight * 1e18) as u128;
        weights.push(U256::from(w));
        // Price: h.price_usd, convert to 1e18 scale
        let p = (h.price_usd * 1e18) as u128;
        prices.push(U256::from(p));
    }

    // Normalize weights to sum to exactly 1e18
    let weight_sum: u128 = weights.iter().map(|w| w.as_u128()).sum();
    let target_sum: u128 = 1_000_000_000_000_000_000;
    if weight_sum != target_sum && !weights.is_empty() {
        let diff = target_sum as i128 - weight_sum as i128;
        let last = weights.last_mut().unwrap();
        *last = U256::from((last.as_u128() as i128 + diff).max(0) as u128);
    }

    // Enforce minimum weight (0.25% = 25e14)
    let min_weight = U256::from(25_000_000_000_000_00u128); // 0.25e16... actually 25e14
    for w in &weights {
        if *w < min_weight {
            error!("[{}] Weight {} below minimum 0.25%", itp.ticker, w);
            return Ok(None);
        }
    }

    info!("[{}] Deploying with {} assets", itp.ticker, assets.len());

    if dry_run {
        info!("[{}] DRY RUN — would call createITP", itp.ticker);
        return Ok(None);
    }

    // 3. Call createITP
    // U256::MAX signals a non-bridge createITP call (bypasses bridge idempotency check).
    // Contract: Investment.sol line 650-657 — if bridgeNonce == type(uint256).max, skip nonce dedup.
    let nonce = U256::MAX;
    let tx = chain.contract.create_itp(
        itp.name.clone(),
        itp.ticker.clone(),
        weights,
        assets,
        prices,
        nonce,
    );
    let pending = tx.send().await?;
    let receipt = pending.await?.ok_or("no receipt")?;

    // Extract itpId from event logs
    // ITPCreated(bytes32 itpId, ...)
    info!("[{}] Deployed! tx: {:?}", itp.ticker, receipt.transaction_hash);

    Ok(None) // TODO: parse itpId from receipt logs
}
```

- [ ] **Step 2: Commit**

```bash
git add itp-bot/src/deployer.rs
git commit -m "feat(itp-bot): ITP deployer via createITP"
```

---

## Chunk 7: Docker & Deployment

### Task 9: Docker Setup

**Files:**
- Create: `docker/testnet/itp-bot/Dockerfile`
- Create: `docker/testnet/itp-bot/docker-compose.yml`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app && chown -R app:app /app
COPY target/release/itp-bot /usr/local/bin/
COPY itp-bot/manifest.json /app/manifest.json
COPY frontend/public/deployed-assets.json /app/deployed-assets.json
USER app
WORKDIR /app
ENTRYPOINT ["itp-bot"]
```

- [ ] **Step 2: Write docker-compose.yml**

```yaml
services:
  itp-bot:
    build:
      context: ../../..
      dockerfile: docker/testnet/itp-bot/Dockerfile
    container_name: testnet-itp-bot
    network_mode: host
    restart: unless-stopped
    security_opt: ["no-new-privileges:true"]
    read_only: true
    tmpfs: ["/tmp"]
    mem_limit: 512m
    cpus: "0.5"
    volumes:
      - /tmp/bot-key.txt:/tmp/bot-key.txt:ro
      - ../../../itp-bot/manifest.json:/app/manifest.json:ro
      - ../../../frontend/public/deployed-assets.json:/app/deployed-assets.json:ro
    environment:
      - DATA_NODE_URL=http://localhost:8200
      - DATA_NODE_AUTH_TOKEN=${DATA_NODE_AUTH_TOKEN}
      - L3_RPC_URL=http://142.132.164.24/
      - INDEX_ADDRESS=${INDEX_ADDRESS}
      - BOT_KEY_FILE=/tmp/bot-key.txt
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8210/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: "8m"
        max-file: "3"
```

- [ ] **Step 3: Commit**

```bash
git add docker/testnet/itp-bot/
git commit -m "feat(itp-bot): docker setup for testnet deployment"
```

---

## Chunk 8: New Data Node Endpoint

### Task 10: `/sim/target-holdings` Endpoint

A lightweight endpoint that returns current optimal holdings for a config without full sim replay. Uses cached sim results.

**Files:**
- Modify: `data-node/src/api.rs`

- [ ] **Step 1: Add endpoint**

```rust
// GET /sim/target-holdings?category_id=X&top_n=N&weighting=W&rebalance_days=D
// Returns: { "holdings": [{ "symbol": "BTC", "weight": 0.05, "price_usd": 65000 }] }
//
// Logic:
// 1. Check if a cached sim run exists for this config
// 2. If yes, return latest holdings from sim_holdings table
// 3. If no, run sim first (or return 404)
```

This is an optimization — the bot can use `/sim/run` + `/sim/holdings` directly (as implemented). This endpoint just combines them. Add it later if the two-call pattern is too slow.

- [ ] **Step 2: Commit**

```bash
git add data-node/src/api.rs
git commit -m "feat(data-node): /sim/target-holdings convenience endpoint"
```

---

## Chunk 9: Sim API Authentication

### Task 11: Data Node Sim API Authentication

Protect the sim API endpoints from unauthorized external access.

**Files:**
- Modify: `data-node/src/api.rs`
- Modify: nginx config on VPS

- [ ] **Step 1: Add auth middleware to sim endpoints**

Modify `data-node/src/api.rs`: Add `require_sim_auth` middleware to `/sim/run`, `/sim/holdings`, `/sim/run-stream`, `/sim/sweep-stream`, `/sim/results`, `/sim/compare`, `/sim/holdings`, `/sim/benchmarks`. Reuse the existing `admin_token` pattern or add a separate `SIM_AUTH_TOKEN` env var.

- [ ] **Step 2: Configure nginx to block external sim access**

Configure nginx on VPS to block external access to `/sim/*` paths (only localhost). This is defense-in-depth — even if the auth token leaks, external requests are rejected at the reverse proxy layer.

- [ ] **Step 3: Configure bot auth token**

Bot reads token from `DATA_NODE_AUTH_TOKEN` env var (already wired in docker-compose.yml).

- [ ] **Step 4: Commit**

```bash
git add data-node/src/api.rs
git commit -m "feat(data-node): auth middleware for sim API endpoints"
```

---

## Execution Order

| Phase | What | Blocked By |
|-------|------|------------|
| 1 | Generate manifest JSON (Task 1) | Nothing |
| 2 | Scaffold bot (Task 2) | Task 1 |
| 3 | Data node client (Task 3) | Task 2 |
| 4 | Token registry (Task 4) | Task 2 |
| 5 | Chain client (Task 5) | Task 2 |
| 6 | Rebalance diff engine (Task 6) | Tasks 3-5 |
| 7 | Main loop (Task 7) | Task 6 |
| 8 | Deployer (Task 8) | Task 7 |
| 9 | Docker (Task 9) | Task 8 |
| 10 | Data node endpoint (Task 10) | Optional, optimization |
| 11 | Sim API authentication (Task 11) | Task 10 |

**Parallel lanes:**
- Tasks 3, 4, 5 can be built in parallel (no dependencies between them)
- Task 6 requires all three
- Tasks 9, 10, and 11 are independent of main bot code

---

---

## Security Audit Results & Required Mitigations

Three independent security reviews identified 7 CRITICALs and 9 HIGHs. All must be addressed before deployment.

### CRITICAL Mitigations (must implement)

#### C1: Oracle must validate rebalance requester (not just BLS-sign blindly)

**Problem:** `requestRebalance` is permissionless — anyone can emit the event. Oracles currently process the latest event per ITP without checking who submitted it.

**Fix:** Add an `allowedRebalancer` mapping on-chain. Only events from allowed addresses are processed by oracles.
- **Contract change:** Add `mapping(bytes32 => address) public itpRebalancer` + `setItpRebalancer(itpId, addr)` (owner-only).
- **Oracle change:** In `get_pending_rebalances`, filter events to only those where `msg.sender == itpRebalancer[itpId]`.
- **Bot:** Register bot wallet as rebalancer for each ITP after creation.

#### C2: Commit-reveal rebalance execution (MANDATORY)

**Problem:** Rebalances are 100% predictable — public manifest, public sim API, known schedule. Delayed execution with visible params makes front-running *worse* (attacker has 1-6h to position).

**Fix — Commit-Reveal scheme:**
1. **Commit phase:** Bot submits `requestRebalanceCommit(itpId, bytes32 paramsHash)` — only a hash of the rebalance params is on-chain. No target weights, no add/remove lists are visible.
2. **Delay:** Oracles wait 1-6h random delay (front-runners see a hash, not the target composition).
3. **Reveal phase:** Bot submits `revealRebalance(itpId, removeIndices, addAssets, newWeights)` — oracles verify hash matches, then BLS-sign and execute.
4. **Staleness check:** At reveal time, oracles re-fetch live prices. If any price moved >3% from the prices used to compute the committed weights, the reveal is rejected and the bot must recompute.
- **Contract change:** `commitRebalance(bytes32 itpId, bytes32 paramsHash, uint256 nonce)` stores `(paramsHash, nonce, block.timestamp + 8 hours)` as the commit record. Every commit must include a monotonically increasing nonce and a `commitExpiry = block.timestamp + maxRevealWindow` (e.g., 8 hours). `revealRebalance(...)` verifies the hash, nonce, and checks `block.timestamp <= commitExpiry`. Expired commits are void — the bot must recompute and recommit.
- **Additional mitigations (defense-in-depth):**
  - **Jitter:** ±20% random jitter on `rebalance_days`.
  - **Private sim queries:** Bearer token auth on `/sim/run` and `/sim/holdings` + restrict to localhost/internal network via nginx.
  - **Batch shuffling:** Process ITPs in random order each cycle.

#### C3: Token allowlist per ITP (prevent category/mcap manipulation)

**Problem:** CoinGecko categories and Bitget listings are externally controlled. Anyone can get a shitcoin categorized and pump its mcap for inclusion.

**Fix:**
- **On-chain allowlist:** Each ITP gets a `mapping(bytes32 => mapping(address => bool)) itpTokenAllowlist`. Only allowlisted tokens can be included in rebalances.
- **Bot maintains allowlist:** On first deploy, allowlist all tokens in the initial composition.
- **Auto-approve criteria:** New tokens meeting ALL of: (a) top 50 by mcap in category, (b) listed on 3+ exchanges, (c) >$5M 30d average daily volume, (d) listed on Bitget for 90+ days are auto-approved. All others require human review.
- **Time-locked additions:** New allowlist additions are announced 48h before activation. This prevents the allowlist maintainer from front-running their own additions.
- **On-chain time-lock:** `proposeAllowlistAddition(itpId, address token)` stores the proposal with `activationTime = block.timestamp + 48 hours`. `activateAllowlistAddition(itpId, address token)` checks `block.timestamp >= activationTime`. Token cannot be used in rebalances until activated.
- **Data-node filter:** Add `allowed_coins` parameter to `/sim/run` — sim only considers these coins, ignoring category membership for unknown tokens.

#### C4: Momentum manipulation resistance

**Problem:** Known lookback windows + known rebalance dates = manufactured momentum.

**Fix:**
- **TWAP prices:** Use 7-day TWAP instead of spot for momentum calculation (already have daily prices in sim cache).
- **Volume filter:** Require minimum $1M 30d average volume on Bitget for momentum eligibility.
- **Weight caps:** Cap any single asset at 10% regardless of momentum signal (`mcap_cap10` weighting as default).
- **Lookback randomization:** Vary lookback window ±5 days per rebalance cycle.

#### C5: Cascade circuit breaker

**Problem:** 107 ITPs rebalancing simultaneously through thin orderbooks.

**Fix:**
- **Max concurrent rebalances:** Process at most 5 ITPs per cycle. Spread the 107 ITPs across the `rebalance_days` period evenly (stagger start dates).
- **Slippage budget:** Add `max_slippage_pct` per ITP. If estimated market impact exceeds budget, defer rebalance.
- **Correlation check:** Before submitting a batch of rebalances, check if >3 ITPs are selling the same token. If yes, stagger those specific rebalances.
- **Market stress detector:** If BTC drops >10% in 24h, pause ALL rebalances for 24h. The offensive/defensive distinction is eliminated — during stress, no rebalances execute. This is simpler and removes the ambiguity of defining "defensive" (which could be gamed). The circuit breaker cannot be a DoS vector because pausing rebalances is safe — ITPs simply hold their current composition until stress subsides.

#### C6: Multi-source price oracle

**Problem:** Bitget is the single price source for both the sim and NAV.

**Fix:**
- **Cross-validate:** Before submitting rebalance, bot fetches prices from both Bitget and CoinGecko API. If any asset price differs by >2%, abort that rebalance and alert.
- **TWAP requirement:** Require rebalance prices to be within 2% of 1-hour TWAP (data-node already has klines data). Note: TWAP must use CoinGecko or an independent source, not Bitget (self-referencing defeats the purpose).
- **Third source:** For assets >5% weight in any ITP, also check CoinMarketCap. Majority vote (2/3 sources agree) determines the reference price.
- **Fallback rule:** If fewer than 2 price sources are available for any asset being rebalanced, ABORT the entire rebalance and defer to next cycle. "2/3 sources must agree" means "if we can't reach 2 sources, we don't rebalance." No single-source fallback ever.
- **Paid API tiers:** Use paid API tiers for CoinGecko Pro and CMC Pro in production. Free tiers are acceptable only for testnet.

#### C7: Key management

**Problem:** Private key in env var, API keys committed to repo.

**Fix:**
- **Key file pattern:** Follow existing oracle pattern — `printf "%s" "0xKEY" > /tmp/bot-key.txt`, mount as volume, read at runtime.
- **Separate bot wallet:** Bot wallet should ONLY have permission to call `requestRebalance`. It should NOT be the ITP creator (use a separate deployer wallet, then transfer creator role if needed).
- **API keys:** Move to Docker secrets or a vault. Immediate: `.env` should be in `.gitignore` (not committed).

#### C8: Restrict `createITP` to allowed deployers

**Problem:** `createITP` is permissionless. Attacker can front-run ITP deployment or flood with garbage ITPs.

**Fix:**
- **Contract change:** Add `mapping(address => bool) public allowedDeployers` + `setAllowedDeployer(addr, bool)` (owner-only).
- **Deployer wallet:** Use a separate, cold wallet for ITP creation (not the bot's hot wallet). After deployment, register the bot wallet as rebalancer via C1.
- **Oracle whitelist:** Oracles maintain a whitelist of ITP IDs they service. Only ITPs created by allowed deployers are added to this whitelist.

#### C9: Oracle-side rebalance sanity checks

**Problem:** Oracles BLS-sign any well-formed rebalance request without validating economic soundness. A compromised bot key = arbitrary rebalances.

**Fix — Oracles validate before signing:**
- **Max weight delta:** No single asset's weight can change by more than 20 percentage points in one rebalance (e.g., 10% → 30% is ok, 10% → 50% is rejected).
- **Max adds/removes:** At most 20% of assets can be added or removed per rebalance (for a 50-asset ITP, max 10 adds/removes).
- **Weight sum:** Verify `sum(newWeights) == 1e18` (already done on-chain, but oracles should reject before wasting BLS rounds).
- **Price freshness:** Oracles re-fetch prices at execution time. If any price moved >3% from the committed prices, reject the rebalance.
- These checks are defense-in-depth — they limit blast radius even if the bot wallet is compromised.
- **On-chain enforcement (in RebalanceLib.sol):** After computing new weights, verify:
  - `abs(newWeights[i] - oldWeights[i]) <= MAX_WEIGHT_DELTA` for each asset (e.g., 20 percentage points = 2e17)
  - `removeIndices.length + addAssets.length <= currentAssetCount * MAX_CHANGE_RATIO` (e.g., 20%)
- These on-chain checks are in ADDITION to the off-chain oracle checks (defense in depth).

### HIGH Mitigations (must implement)

#### H1: Atomic NAV + Rebalance (on-chain computation)
`rebalance()` in `RebalanceLib.sol` must accept `prices[]` as it already does, but instead of reading `nav = _itpNavs[itpId]`, it must COMPUTE `nav = sum(old_inventory[i] * prices[i]) / 1e18` on-chain from the supplied prices and existing inventory. The separate `setItpNav` call before rebalance is ELIMINATED for the rebalance flow — NAV is always derived from prices at execution time. This is a contract change to `RebalanceLib.sol` line 98. The prices themselves are trusted because they're BLS-signed by oracles. If NAV has drifted >2% between request and execution, reject and force the bot to recompute.

#### H2: Integer-only weight/price math
Replace all `f64 * 1e18` conversions with string-based decimal parsing. Use the `rust_decimal` crate (already in workspace via sqlx). Parse price strings as `Decimal`, multiply by `10^18`, convert to `U256`.

#### H3: Rate limiting + gas budget
- Max 5 rebalances per cycle.
- Check bot wallet gas balance before each tx. If below 0.1 ETH, alert and stop.
- Exponential backoff on repeated failures for the same ITP (1h → 2h → 4h → 24h).
- Dedup: track pending `RebalanceRequested` events, don't re-submit if one is already pending.

#### H4: CoinGecko category snapshot + human review
- Snapshot category membership at bot startup. Don't re-query CG during runtime.
- Any new token appearing in a category since last snapshot requires human approval before inclusion.
- Store approved token lists in manifest alongside configs.

#### H5: Liquidity check before rebalance
Before submitting rebalance, query Bitget orderbook depth for each token being added. If 2% depth < $50K, reduce that token's weight proportionally and redistribute.

#### H6: Bot health monitoring
- `restart: unless-stopped` in docker-compose.
- Healthcheck endpoint on the bot (simple HTTP server on port 8210).
- Data-node monitors bot health alongside oracle health (reuse `oracle-health-poll-interval` pattern).
- Alert if no rebalance submitted for 2x the longest `rebalance_days` in manifest.

#### H7: Manifest signing
SHA256 hash of manifest computed at generation time, embedded in bot binary or passed as CLI arg. Bot verifies hash on load. Any tampering = startup failure.

#### H8: Docker hardening
```yaml
security_opt: ["no-new-privileges:true"]
read_only: true
tmpfs: ["/tmp"]
mem_limit: 512m
cpus: "0.5"
```
Use a bridge network with explicit port access instead of `network_mode: host`.

#### H9: Withdrawal timing mitigation
Addressed by C2's commit-reveal scheme — target composition is hidden (only hash visible) until the reveal phase. Combined with the 1-6h random delay, observers cannot position before execution. The commit-reveal is MANDATORY, not optional — without it, the delay actively worsens front-running exposure.

---

## Open Questions

1. **Token deployment**: The 107 ITPs use tokens from 65 categories. Many tokens may not have mock ERC20s deployed on L3 yet (only the 100 from the current ITP exist). A token deployment script is needed to deploy additional mock tokens for the full Bitget universe (~629 tokens).

2. **Rebalance authority**: **RESOLVED by C1:** `requestRebalance` is restricted to `allowedRebalancer` per ITP. The bot wallet is registered as rebalancer after ITP creation. Oracles filter events by allowed requester address. This is mandatory — not optional.

3. **Gas costs**: 107 ITPs × rebalance every 7-90 days = significant L3 gas. The L3 is an Orbit chain with controlled gas, but still needs a gas budget.

4. **Ordering**: Should all 107 ITPs be created in one batch? Or rolled out gradually (e.g., 10 per week)?

5. **NAV initialization**: New ITPs start at $1 NAV. The oracles need to be aware of new ITPs to include them in NAV calculations. Oracle discovery might need updating.

6. **AP liquidity**: The AP needs sufficient Bitget vault balance to execute trades for 107 ITPs worth of rebalancing. This is a capital question, not a code question.
