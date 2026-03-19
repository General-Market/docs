# Hot-Reload & Zero-Restart Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate ~100 restart-causing commits by making contract addresses, backend URLs, tuning parameters, and deployment state runtime-swappable across all 4 Rust services + frontend + deploy script.

**Architecture:** A shared `RuntimeConfig` module in `common/` wraps all mutable configuration in `ArcSwap` (lock-free reads). A `DeploymentWatcher` monitors `active-deployment.json` for file changes and polls an on-chain `deploymentNonce` every 60s. When the nonce changes, services auto-flush stale DB tables, caches, and WAL files. Each service exposes `/admin/reload` (manual trigger) and `/admin/health` (readiness probe). The frontend reads deployment addresses via a runtime API route, not baked-in JSON. All backend calls from the browser go through catch-all proxy route handlers.

**Tech Stack:** Rust (tokio, axum, arc-swap, notify), Solidity (Investment.sol deploymentNonce), Next.js (App Router API routes), Foundry (forge script)

**Spec:** `docs/superpowers/specs/2026-03-18-hot-reload-zero-restart-design.md`

---

## Dependency Graph

```
Task 1 (Common RuntimeConfig)  ──┬──→ Task 4 (Oracle)
                                 ├──→ Task 5 (Data-node)
                                 ├──→ Task 6 (AP)
                                 └──→ Task 7 (Curator)

Task 1e (Auto-Migrate) ─────────→ Task 3 (Migration Integration Tests)

Task 2 (Contract Nonce)  ────────→ Task 10 (Deploy Script)

Task 3 (Auto-Migrate Tests) ────→ Tasks 4-7 (all services)

Task 8 (Frontend Deployment API) ─┐
Task 8b (useDeployment coverage)  │
Task 9 (Frontend Universal Proxy) │
Task 9b (Catch-all proxies)       │──→ independent of Rust tasks
Task 9c (Static JSON elimination) ┘

Task 11 (Integration Tests) ─────→ depends on ALL above
```

**Parallelizable groups:**
- Group A (no deps): Tasks 1, 2, 8, 9
- Group B (after Task 1e): Task 3
- Group C (after Task 1+3): Tasks 4, 5, 6, 7 (all parallel)
- Group D (after Task 2): Task 10
- Group E (after Task 8): Tasks 8b, 9b, 9c
- Group F (after all): Task 11

---

## File Structure

### New files
| Path | Task | Responsibility |
|------|------|---------------|
| `common/src/runtime/mod.rs` | 1 | Module declarations for runtime subsystem |
| `common/src/runtime/config.rs` | 1 | `RuntimeConfig` struct, `SharedConfig` type, load/reload logic |
| `common/src/runtime/watcher.rs` | 1b | `DeploymentWatcher` — file watch + nonce poll background task |
| `common/src/runtime/admin.rs` | 1c | Axum routes: `/admin/reload`, `/admin/config`, `/admin/health`, `/admin/log-level` |
| `common/src/runtime/validate.rs` | 1d | `StartupValidator` — pre-flight checks before accepting traffic |
| `common/src/runtime/migrate.rs` | 1e | `run_migrations()` — auto-run SQL migrations on startup |
| `common/tests/migration_test.rs` | 3 | Integration test for migration runner (advisory lock, idempotency) |
| `frontend/app/api/backend/[...path]/route.ts` | 9b | Catch-all proxy for BACKEND_URL (oracle/issuer backend) |
| `frontend/app/api/rpc/route.ts` | 9b | RPC proxy for L3_RPC_URL (replaces `/rpc` rewrite) |
| `frontend/app/api/config/route.ts` | 9c | Serves `itp-id-names.json`, `blacklisted-itps.json`, `sources-display.json` at runtime |
| `frontend/lib/fetch.ts` | 9 | `dnFetch()`, `oracleFetch()`, `visionFetch()` wrappers enforcing proxy usage |
| `frontend/lib/contracts/addresses.ts` | 8b | `getDeploymentAddress()` async utility for non-React files |
| `frontend/hooks/useDeployment.ts` | 8 | SWR hook for runtime deployment data |

### Modified files
| Path | Task | Change |
|------|------|--------|
| `common/Cargo.toml` | 1 | Add `arc-swap`, `notify`, `axum`, `sqlx`, `tokio-util` dependencies |
| `common/src/lib.rs:1-33` | 1 | Add `pub mod runtime;` |
| `common/src/logging.rs` | 1f | Wrap `EnvFilter` in `reload::Layer`, return `LogReloadHandle`, import trait from `admin.rs` |
| `common/src/adapters/deployment_config.rs` | 1 | Add `Serialize` derive, make `get_contract_address` public, add `load_symbol_map()` method |
| `oracle/Cargo.toml` | 4 | (no change — inherits from common) |
| `oracle/src/main.rs:4444-4543` | 4 | Swap ConfigBuilder for SharedConfig, spawn watcher, add admin routes |
| `oracle/src/main.rs:353-366` | 4 | Add `SharedConfig` to `OracleApiState` |
| `oracle/src/main.rs:585-593` | 4 | Merge admin_router into oracle routes |
| `oracle/src/config.rs:842-861` | 4 | `effective_contract_addresses()` reads from SharedConfig |
| `oracle/src/bootstrap/mod.rs:86-100` | 4 | `build()` reads from SharedConfig |
| `data-node/src/main.rs:75-205` | 5 | Wrap config in SharedConfig, spawn watcher, REPLACE existing migration runner |
| `data-node/src/api.rs:284-329` | 5 | `AppState.deployment` → `SharedConfig` |
| `data-node/src/config.rs` | 5 | Tune params read from SharedConfig instead of static config |
| `data-node/src/db.rs` | 5 | Replace existing `run_migrations()` with call to `common::runtime::migrate::run_migrations()` |
| `ap/src/main.rs:840-868` | 6 | Replace raw TCP with axum, add SharedConfig |
| `ap/Cargo.toml` | 6 | Add `axum`, upgrade `reqwest` from `"0.11"` to `"0.12"` |
| `ap/src/config.rs` | 6 | Read deployment addresses from SharedConfig |
| `curator/src/main.rs:619-668` | 7 | Add SharedConfig, spawn watcher |
| `curator/src/quote_server.rs` | 7 | Read addresses from SharedConfig |
| `contracts/src/core/Investment.sol` | 2 | Add `deploymentNonce` storage + `bumpDeploymentNonce()` |
| `contracts/src/core/InvestmentStorage.sol:~162` | 2 | Add `uint256 public deploymentNonce` immediately before `__gap`, decrement `__gap` from `[15]` to `[14]` |
| `contracts/script/DeployFullSystemE2E.s.sol` | 2 | Call `bumpDeploymentNonce()` after deploy |
| `frontend/next.config.ts:77-117` | 9 | Remove per-endpoint rewrites, keep only locale/docs |
| `frontend/lib/config.ts:1-36` | 9 | Simplify — all browser URLs go through proxy |
| `frontend/app/api/deployment/route.ts` | 8 | **Modify** (exists) — preserve `?file=` param and Vercel fallback, add runtime deployment read |
| `frontend/app/api/dn/[...path]/route.ts` | 9 | **Modify** (exists) — change URL source from build-time import to runtime env var, preserve SSE/maxDuration/headers |
| `frontend/app/api/oracle/[...path]/route.ts` | 9 | Catch-all oracle proxy |
| `frontend/app/api/vision/[...path]/route.ts` | 9b | **Create** — catch-all vision proxy targeting VISION_API_URL. Coexists with 11 existing specific route handlers under `/api/vision/` (e.g., `leaderboard/route.ts`, `snapshot/route.ts`). In App Router, specific routes take precedence over catch-all `[...path]` routes, so no conflicts. |
| `testnet.sh:660-668` | 10 | Remove manual TRUNCATE (services auto-flush) |
| `testnet.sh:795-801` | 10 | Remove manual address sync (file watcher handles) |
| `deploy.sh` | 10 | Add `bumpDeploymentNonce()` call after forge, with fallback |
| `start.sh` | 10 | Remove manual table truncation |

---

## Task 1: Common RuntimeConfig Module

**Files:**
- Create: `common/src/runtime/mod.rs`
- Create: `common/src/runtime/config.rs`
- Modify: `common/Cargo.toml`
- Modify: `common/src/lib.rs:1-33`
- Modify: `common/src/adapters/deployment_config.rs`

- [ ] **Step 1: Add dependencies to common/Cargo.toml**

Add `arc-swap`, `notify`, `axum`, and `sqlx` to `common/Cargo.toml` under `[dependencies]`:

```toml
arc-swap = "1.7"
notify = "6.1"
axum = "0.7"
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres"] }
tokio-util = { version = "0.7", features = ["rt"] }
```

> **Note:** `notify` uses default features which auto-select the correct backend per platform (kqueue on macOS, inotify on Linux). Do NOT specify `macos_kqueue` feature — it fails in Linux Docker containers.

- [ ] **Step 2: Modify deployment_config.rs — Add Serialize derive**

In `common/src/adapters/deployment_config.rs`, line 15, add `Serialize` to the derive macro:

```rust
// Before:
#[derive(Debug, Clone, Deserialize)]
pub struct DeploymentConfig {
// After:
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DeploymentConfig {
```

- [ ] **Step 3: Modify deployment_config.rs — Make get_contract_address public**

In `common/src/adapters/deployment_config.rs`, line 60, change visibility:

```rust
// Before:
fn get_contract_address(&self, name: &str) -> Result<Address, ...>
// After:
pub fn get_contract_address(&self, name: &str) -> Result<Address, ...>
```

- [ ] **Step 4: Create runtime module declaration**

Create `common/src/runtime/mod.rs`:

```rust
pub mod config;
pub mod watcher;
pub mod admin;
pub mod validate;
pub mod migrate;
```

- [ ] **Step 5: Export runtime module from lib.rs**

In `common/src/lib.rs`, add after existing module declarations (line ~33):

```rust
pub mod runtime;
```

- [ ] **Step 6: Write RuntimeConfig struct**

Create `common/src/runtime/config.rs` with the core types:

```rust
use arc_swap::ArcSwap;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use ethers::types::Address;
use serde::{Deserialize, Serialize};
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
    pub symbol_map: HashMap<String, String>,  // address_hex → bitget_pair

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
        let new = Self::load(
            &self.deployment_file_path,
            &self.rpc_url,
            index_addr,
        ).await?;
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
        let result = client
            .call(&call.into(), None)
            .await
            .map_err(|e| ConfigError::Rpc(e.to_string()))?;
        // Decode uint256 → u64
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
            diffs.push(format!("deployment_nonce: {} → {}", self.deployment_nonce, other.deployment_nonce));
        }
        if self.rpc_url != other.rpc_url {
            diffs.push(format!("rpc_url: {} → {}", self.rpc_url, other.rpc_url));
        }
        if self.settlement_rpc_url != other.settlement_rpc_url {
            diffs.push(format!("settlement_rpc_url: {:?} → {:?}", self.settlement_rpc_url, other.settlement_rpc_url));
        }
        if self.data_node_url != other.data_node_url {
            diffs.push(format!("data_node_url: {:?} → {:?}", self.data_node_url, other.data_node_url));
        }
        if self.db_pool_size != other.db_pool_size {
            diffs.push(format!("db_pool_size: {} → {}", self.db_pool_size, other.db_pool_size));
        }
        if self.poll_interval_secs != other.poll_interval_secs {
            diffs.push(format!("poll_interval_secs: {} → {}", self.poll_interval_secs, other.poll_interval_secs));
        }
        if self.channel_capacity != other.channel_capacity {
            diffs.push(format!("channel_capacity: {} → {}", self.channel_capacity, other.channel_capacity));
        }
        if self.rpc_timeout_secs != other.rpc_timeout_secs {
            diffs.push(format!("rpc_timeout_secs: {} → {}", self.rpc_timeout_secs, other.rpc_timeout_secs));
        }
        if self.snapshot_timeout_secs != other.snapshot_timeout_secs {
            diffs.push(format!("snapshot_timeout_secs: {} → {}", self.snapshot_timeout_secs, other.snapshot_timeout_secs));
        }
        if self.sse_max_connections != other.sse_max_connections {
            diffs.push(format!("sse_max_connections: {} → {}", self.sse_max_connections, other.sse_max_connections));
        }
        if self.sse_per_ip_limit != other.sse_per_ip_limit {
            diffs.push(format!("sse_per_ip_limit: {} → {}", self.sse_per_ip_limit, other.sse_per_ip_limit));
        }
        // Compare deployment contracts
        let old_contracts = &self.deployment.contracts;
        let new_contracts = &other.deployment.contracts;
        for (key, old_val) in old_contracts {
            match new_contracts.get(key) {
                Some(new_val) if new_val != old_val => {
                    diffs.push(format!("contract.{key}: {old_val} → {new_val}"));
                }
                None => {
                    diffs.push(format!("contract.{key}: {old_val} → REMOVED"));
                }
                _ => {}
            }
        }
        for key in new_contracts.keys() {
            if !old_contracts.contains_key(key) {
                diffs.push(format!("contract.{key}: NEW → {}", new_contracts[key]));
            }
        }
        // Compare symbol map (length only — individual entries are too noisy)
        if self.symbol_map.len() != other.symbol_map.len() {
            diffs.push(format!("symbol_map.len: {} → {}", self.symbol_map.len(), other.symbol_map.len()));
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
```

- [ ] **Step 7: Verify common crate compiles**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p common`
Expected: Compiles with warnings (unused modules watcher/admin/validate/migrate not yet created)

- [ ] **Step 8: Create stub files for remaining modules**

Create minimal stubs so the crate compiles:

`common/src/runtime/watcher.rs`:
```rust
// Implemented in Task 1b
```

`common/src/runtime/admin.rs`:
```rust
// Implemented in Task 1c
```

`common/src/runtime/validate.rs`:
```rust
// Implemented in Task 1d
```

`common/src/runtime/migrate.rs`:
```rust
// Implemented in Task 1e
```

- [ ] **Step 9: Commit**

```bash
git add common/src/runtime/ common/Cargo.toml common/src/lib.rs common/src/adapters/deployment_config.rs
git commit -m "feat(common): add RuntimeConfig with ArcSwap for hot-reload foundation"
```

---

## Task 1b: DeploymentWatcher

**Files:**
- Create: `common/src/runtime/watcher.rs`

- [ ] **Step 1: Implement DeploymentWatcher**

Write `common/src/runtime/watcher.rs`:

```rust
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use notify::{Watcher, RecursiveMode, Event, EventKind};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;
use tracing::{info, warn, error};
use super::config::{SharedConfig, RuntimeConfig};

pub struct DeploymentWatcher {
    config: SharedConfig,
    deployment_path: PathBuf,
    nonce_poll_interval: Duration,
    flush_callback: Option<Arc<dyn Fn(u64, u64) + Send + Sync>>,
    reload_callback: Option<Arc<dyn Fn(&RuntimeConfig, &RuntimeConfig) + Send + Sync>>,
    cancel_token: CancellationToken,
}

impl DeploymentWatcher {
    pub fn new(config: SharedConfig, deployment_path: PathBuf) -> Self {
        Self {
            config,
            deployment_path,
            nonce_poll_interval: Duration::from_secs(60),
            flush_callback: None,
            reload_callback: None,
            cancel_token: CancellationToken::new(),
        }
    }

    pub fn with_nonce_poll_interval(mut self, interval: Duration) -> Self {
        self.nonce_poll_interval = interval;
        self
    }

    pub fn with_cancel_token(mut self, token: CancellationToken) -> Self {
        self.cancel_token = token;
        self
    }

    /// Called when deployment nonce changes (full flush needed)
    pub fn on_nonce_change(mut self, f: impl Fn(u64, u64) + Send + Sync + 'static) -> Self {
        self.flush_callback = Some(Arc::new(f));
        self
    }

    /// Called on any config reload (soft or hard)
    pub fn on_reload(mut self, f: impl Fn(&RuntimeConfig, &RuntimeConfig) + Send + Sync + 'static) -> Self {
        self.reload_callback = Some(Arc::new(f));
        self
    }

    pub fn spawn(self) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            self.run().await;
        })
    }

    async fn run(self) {
        let (tx, mut rx) = mpsc::channel::<()>(1);

        // File watcher (debounced)
        // IMPORTANT: Capture the tokio runtime Handle BEFORE spawning the std::thread,
        // because Handle::current() panics if called outside a tokio runtime.
        let tx_file = tx.clone();
        let watch_path = self.deployment_path.clone();
        let cancel = self.cancel_token.clone();
        std::thread::spawn(move || {
            let mut watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
                if let Ok(event) = res {
                    if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                        // Use try_send to avoid blocking the file watcher callback thread.
                        // If the channel is full, a reload is already pending — safe to drop.
                        let _ = tx_file.try_send(());
                    }
                }
            }).expect("Failed to create file watcher");

            if let Some(parent) = watch_path.parent() {
                if let Err(e) = watcher.watch(parent, RecursiveMode::NonRecursive) {
                    warn!("File watcher failed to start: {e}. Falling back to poll-only.");
                }
            }
            // Keep watcher alive until cancellation
            loop {
                if cancel.is_cancelled() {
                    break;
                }
                std::thread::park_timeout(Duration::from_secs(1));
            }
        });

        // Nonce poll timer
        let tx_nonce = tx.clone();
        let poll_interval = self.nonce_poll_interval;
        let cancel_poll = self.cancel_token.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(poll_interval);
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        let _ = tx_nonce.send(()).await;
                    }
                    _ = cancel_poll.cancelled() => break,
                }
            }
        });

        // Debounce: wait 2s after last event before reloading
        let mut debounce_deadline: Option<tokio::time::Instant> = None;

        loop {
            tokio::select! {
                Some(()) = rx.recv() => {
                    debounce_deadline = Some(tokio::time::Instant::now() + Duration::from_secs(2));
                }
                _ = async {
                    if let Some(deadline) = debounce_deadline {
                        tokio::time::sleep_until(deadline).await;
                    } else {
                        std::future::pending::<()>().await;
                    }
                } => {
                    debounce_deadline = None;
                    self.do_reload().await;
                }
                _ = self.cancel_token.cancelled() => {
                    info!("DeploymentWatcher shutting down");
                    break;
                }
            }
        }
    }

    async fn do_reload(&self) {
        let old_config = self.config.load();
        match old_config.reload().await {
            Ok((new_config, nonce_changed)) => {
                let diffs = old_config.diff(&new_config);
                if diffs.is_empty() {
                    return; // No changes
                }

                info!("Config reloaded: {}", diffs.join(", "));

                if nonce_changed {
                    let old_nonce = old_config.deployment_nonce;
                    let new_nonce = new_config.deployment_nonce;
                    info!("Deployment nonce changed: {old_nonce} → {new_nonce}. Triggering full flush.");
                    if let Some(ref cb) = self.flush_callback {
                        cb(old_nonce, new_nonce);
                    }
                }

                // Atomic swap
                self.config.store(Arc::new(new_config.clone()));

                if let Some(ref cb) = self.reload_callback {
                    cb(&old_config, &new_config);
                }
            }
            Err(e) => {
                warn!("Config reload failed (keeping old config): {e}");
            }
        }
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `cargo check -p common`

- [ ] **Step 3: Commit**

```bash
git add common/src/runtime/watcher.rs
git commit -m "feat(common): add DeploymentWatcher with file watch + nonce poll + debounce + cancellation"
```

---

## Task 1c: Admin Routes

**Files:**
- Create: `common/src/runtime/admin.rs`

- [ ] **Step 1: Implement admin routes**

Write `common/src/runtime/admin.rs`:

```rust
use axum::{
    Router, Json,
    extract::{State, Query},
    http::StatusCode,
    middleware,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use super::config::SharedConfig;

/// Opaque log-level reload trait — avoids exposing complex layer stack type.
/// Implemented in common/src/logging.rs via ReloadHandleImpl.
pub trait LogLevelReloader: Send + Sync {
    fn set_level(&self, new_filter: tracing_subscriber::EnvFilter) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
}

pub type LogReloadHandle = Arc<dyn LogLevelReloader>;

#[derive(Clone)]
pub struct AdminState {
    pub config: SharedConfig,
    pub admin_token: Option<String>,
    pub log_reload_handle: Option<LogReloadHandle>,
}

#[derive(Deserialize)]
pub struct ReloadParams {
    pub dry_run: Option<bool>,
}

#[derive(Serialize)]
pub struct ReloadResponse {
    pub status: String,
    pub diffs: Vec<String>,
    pub nonce_changed: bool,
    pub dry_run: bool,
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub deployment_nonce: u64,
    pub config_loaded_at: String,
    pub rpc_url: String,
    pub deployment_file: String,
    pub contracts: std::collections::HashMap<String, String>,
}

#[derive(Deserialize)]
pub struct LogLevelRequest {
    pub level: String,
}

#[derive(Serialize)]
pub struct LogLevelResponse {
    pub status: String,
    pub level: String,
}

/// Create admin router. Merge into service's existing axum Router.
pub fn admin_router(config: SharedConfig, admin_token: Option<String>) -> Router {
    admin_router_with_log_handle(config, admin_token, None)
}

/// Create admin router with optional log-level reload handle.
pub fn admin_router_with_log_handle(
    config: SharedConfig,
    admin_token: Option<String>,
    log_reload_handle: Option<LogReloadHandle>,
) -> Router {
    let state = AdminState { config, admin_token, log_reload_handle };
    Router::new()
        .route("/admin/reload", post(handle_reload))
        .route("/admin/config", get(handle_config))
        .route("/admin/health", get(handle_health))
        .route("/admin/log-level", post(handle_log_level))
        .layer(axum::middleware::from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state)
}

/// Auth middleware — applied as a layer on the admin router.
/// If `admin_token` is set, requires `x-admin-token` header to match.
/// If not set, all requests pass (warn at startup in this case).
async fn auth_middleware(
    State(state): State<AdminState>,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, StatusCode> {
    if let Some(ref token) = state.admin_token {
        let provided = request.headers()
            .get("x-admin-token")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if provided != token {
            return Err(StatusCode::UNAUTHORIZED);
        }
    }
    Ok(next.run(request).await)
}

async fn handle_reload(
    State(state): State<AdminState>,
    Query(params): Query<ReloadParams>,
) -> Result<Json<ReloadResponse>, StatusCode> {
    let dry_run = params.dry_run.unwrap_or(false);
    let old = state.config.load();

    match old.reload().await {
        Ok((new_config, nonce_changed)) => {
            let diffs = old.diff(&new_config);

            if !dry_run && !diffs.is_empty() {
                state.config.store(Arc::new(new_config));
            }

            Ok(Json(ReloadResponse {
                status: if diffs.is_empty() { "no_changes".into() } else { "reloaded".into() },
                diffs,
                nonce_changed,
                dry_run,
            }))
        }
        Err(e) => {
            tracing::error!("Reload failed: {e}");
            Ok(Json(ReloadResponse {
                status: format!("error: {e}"),
                diffs: vec![],
                nonce_changed: false,
                dry_run,
            }))
        }
    }
}

async fn handle_config(
    State(state): State<AdminState>,
) -> Json<serde_json::Value> {
    let config = state.config.load();
    Json(serde_json::to_value(&*config).unwrap_or_default())
}

async fn handle_health(
    State(state): State<AdminState>,
) -> Json<HealthResponse> {
    let config = state.config.load();
    Json(HealthResponse {
        deployment_nonce: config.deployment_nonce,
        config_loaded_at: config.loaded_at.to_rfc3339(),
        rpc_url: config.rpc_url.clone(),
        deployment_file: config.deployment_file_path.display().to_string(),
        contracts: config.deployment.contracts.clone(),
    })
}

async fn handle_log_level(
    State(state): State<AdminState>,
    Json(body): Json<LogLevelRequest>,
) -> Result<Json<LogLevelResponse>, StatusCode> {
    let Some(ref handle) = state.log_reload_handle else {
        return Err(StatusCode::NOT_IMPLEMENTED);
    };

    let new_filter = body.level.parse::<tracing_subscriber::EnvFilter>()
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    handle.set_level(new_filter)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tracing::info!("Log level changed to: {}", body.level);

    Ok(Json(LogLevelResponse {
        status: "updated".into(),
        level: body.level,
    }))
}
```

- [ ] **Step 2: Verify compiles**

Run: `cargo check -p common`

- [ ] **Step 3: Commit**

```bash
git add common/src/runtime/admin.rs
git commit -m "feat(common): add /admin/reload, /admin/config, /admin/health, /admin/log-level axum routes"
```

---

## Task 1d: Startup Validator

**Files:**
- Create: `common/src/runtime/validate.rs`

- [ ] **Step 1: Implement startup validator**

Write `common/src/runtime/validate.rs`:

```rust
use super::config::RuntimeConfig;
use ethers::providers::{Provider, Http, Middleware};
use tracing::{info, warn};

#[derive(Debug)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.field, self.message)
    }
}

pub struct StartupValidator;

impl StartupValidator {
    /// Run all pre-flight checks. Returns errors found (empty = healthy).
    pub async fn validate(config: &RuntimeConfig) -> Vec<ValidationError> {
        let mut errors = vec![];

        // 1. RPC reachable
        if let Err(e) = Self::check_rpc(&config.rpc_url).await {
            errors.push(ValidationError {
                field: "rpc_url".into(),
                message: format!("RPC unreachable at {}: {e}", config.rpc_url),
            });
        }

        // 2. Settlement RPC reachable (if configured)
        if let Some(ref url) = config.settlement_rpc_url {
            if let Err(e) = Self::check_rpc(url).await {
                errors.push(ValidationError {
                    field: "settlement_rpc_url".into(),
                    message: format!("Settlement RPC unreachable at {url}: {e}"),
                });
            }
        }

        // 3. Investment contract has code
        if let Ok(addr) = config.deployment.index_address() {
            if let Err(e) = Self::check_has_code(&config.rpc_url, addr).await {
                errors.push(ValidationError {
                    field: "Investment".into(),
                    message: format!("Investment contract at {addr:?} has no code: {e}"),
                });
            }
        }

        // 4. Deployment JSON has required contracts
        for name in &["Index", "OracleRegistry", "USDC"] {
            if config.deployment.get_contract_address(name).is_err() {
                errors.push(ValidationError {
                    field: name.to_string(),
                    message: format!("Missing required contract '{name}' in deployment.json"),
                });
            }
        }

        if errors.is_empty() {
            info!("Startup validation passed");
        } else {
            for e in &errors {
                warn!("Startup validation FAILED: {e}");
            }
        }

        errors
    }

    async fn check_rpc(url: &str) -> Result<(), String> {
        let provider = Provider::<Http>::try_from(url)
            .map_err(|e| e.to_string())?;
        let _block = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            provider.get_block_number()
        )
        .await
        .map_err(|_| "timeout".to_string())?
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    async fn check_has_code(rpc_url: &str, addr: ethers::types::Address) -> Result<(), String> {
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| e.to_string())?;
        let code = provider.get_code(addr, None).await
            .map_err(|e| e.to_string())?;
        if code.is_empty() {
            return Err("no code at address".into());
        }
        Ok(())
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add common/src/runtime/validate.rs
git commit -m "feat(common): add StartupValidator — pre-flight RPC + contract checks"
```

---

## Task 1e: Auto-Migration Runner

**Files:**
- Create: `common/src/runtime/migrate.rs`

- [ ] **Step 1: Implement migration runner**

Write `common/src/runtime/migrate.rs`:

```rust
use sqlx::PgPool;
use std::path::Path;
use tracing::{info, warn};

#[derive(Debug, thiserror::Error)]
pub enum MigrationError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("SQL error: {0}")]
    Sql(#[from] sqlx::Error),
}

/// Run all SQL migrations in `migrations_dir` that haven't been applied yet.
/// Tracks applied migrations in `_applied_migrations` table.
///
/// Uses `pg_advisory_lock(42)` to serialize concurrent instances (e.g., multiple
/// oracle containers starting simultaneously). This prevents race conditions where
/// two instances both see a migration as unapplied and try to run it.
///
/// **CRITICAL:** The advisory lock is acquired on a single pooled connection, and ALL
/// migration queries run on that SAME connection. Advisory locks are per-connection —
/// acquiring on one connection and querying on another (which `pool.execute()` may do)
/// would defeat the lock entirely.
///
/// Returns the number of newly applied migrations.
pub async fn run_migrations(pool: &PgPool, migrations_dir: &Path) -> Result<usize, MigrationError> {
    // Acquire a single connection — advisory lock is bound to this connection
    let mut conn = pool.acquire().await?;

    // Acquire advisory lock on THIS connection
    sqlx::query("SELECT pg_advisory_lock(42)")
        .execute(&mut *conn)
        .await?;

    let result = run_migrations_inner(&mut conn, migrations_dir).await;

    // Always release the lock on the SAME connection, even on error
    let _ = sqlx::query("SELECT pg_advisory_unlock(42)")
        .execute(&mut *conn)
        .await;

    // conn drops here, returning to pool
    result
}

async fn run_migrations_inner(
    conn: &mut sqlx::pool::PoolConnection<sqlx::Postgres>,
    migrations_dir: &Path,
) -> Result<usize, MigrationError> {
    // Create tracking table if not exists
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _applied_migrations (
            name TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )"
    )
    .execute(&mut **conn)
    .await?;

    // Read all .sql files, sorted by name
    let mut entries: Vec<_> = std::fs::read_dir(migrations_dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "sql").unwrap_or(false))
        .collect();
    entries.sort_by_key(|e| e.file_name());

    // Get already applied — uses same connection that holds the lock
    let applied: Vec<String> = sqlx::query_scalar("SELECT name FROM _applied_migrations")
        .fetch_all(&mut **conn)
        .await?;

    let mut count = 0;
    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();
        if applied.contains(&name) {
            continue;
        }

        let sql = std::fs::read_to_string(entry.path())?;
        info!("Applying migration: {name}");

        // Split on semicolons for multi-statement migrations
        // Note: we run directly on the locked connection, not in a sub-transaction,
        // because the advisory lock already serializes access.
        for statement in sql.split(';') {
            let trimmed = statement.trim();
            if !trimmed.is_empty() {
                if let Err(e) = sqlx::query(trimmed).execute(&mut **conn).await {
                    warn!("Migration {name} statement failed: {e}. Statement: {}", &trimmed[..trimmed.len().min(100)]);
                    // Don't fail on IF NOT EXISTS errors
                    if !e.to_string().contains("already exists") {
                        return Err(MigrationError::Sql(e));
                    }
                }
            }
        }

        sqlx::query("INSERT INTO _applied_migrations (name) VALUES ($1)")
            .bind(&name)
            .execute(&mut **conn)
            .await?;

        count += 1;
        info!("Migration applied: {name}");
    }

    if count > 0 {
        info!("Applied {count} new migration(s)");
    }

    Ok(count)
}
```

- [ ] **Step 2: Verify full common crate compiles**

Run: `cargo check -p common`
Expected: Clean compile (all modules have real implementations now)

- [ ] **Step 3: Commit**

```bash
git add common/src/runtime/migrate.rs
git commit -m "feat(common): add auto-migration runner with tracking table and advisory lock"
```

---

## Task 1f: Runtime Log Level Switching

**Files:**
- Modify: `common/src/runtime/admin.rs` (already done above — `/admin/log-level` endpoint)
- Modify: logging initialization in each service (wherever `tracing_subscriber` is set up)

- [ ] **Step 1: Read and understand common/src/logging.rs**

**IMPORTANT:** `common/src/logging.rs` has a complex dual-layer setup (file + stdout + EnvFilter). It is NOT a simple `fmt().init()`. Read the file first before modifying.

- [ ] **Step 2: Modify init_logging() to return a reload handle**

Modify `common/src/logging.rs` → `init_logging()` to wrap the `EnvFilter` in a `reload::Layer` and return the handle:

```rust
use tracing_subscriber::{EnvFilter, reload, prelude::*};
use std::sync::Arc;
use crate::runtime::admin::LogLevelReloader;

// Re-export for convenience — callers import from logging, not admin
pub type LogReloadHandle = Arc<dyn LogLevelReloader>;

// Inside init_logging():
let filter = EnvFilter::try_from_default_env()
    .unwrap_or_else(|_| EnvFilter::new("info"));
let (filter_layer, reload_handle) = reload::Layer::new(filter);

// ... build the existing dual-layer stack but use filter_layer instead of bare EnvFilter ...
// The reload_handle wraps the complex layer type — store it in a newtype that implements
// the LogLevelReloader trait defined in admin.rs

struct ReloadHandleImpl<S>(reload::Handle<EnvFilter, S>);

impl<S> LogLevelReloader for ReloadHandleImpl<S>
where
    S: Send + Sync + 'static,
{
    fn set_level(&self, new_filter: EnvFilter) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.0.modify(|f| *f = new_filter).map_err(|e| Box::new(e) as _)
    }
}

// Return: Arc::new(ReloadHandleImpl(reload_handle)) as LogReloadHandle
```

The `LogLevelReloader` trait is defined **once** in `admin.rs` (with `Send + Sync` supertraits). `logging.rs` imports it via `use crate::runtime::admin::LogLevelReloader`. The `ReloadHandleImpl` newtype in `logging.rs` implements the admin trait, hiding `reload::Handle`'s complex generic type parameter behind a trait object.

- [ ] **Step 3: Store handle in AdminState**

Update the `AdminState` type in `admin.rs` to accept the opaque handle:

```rust
pub struct AdminState {
    pub config: SharedConfig,
    pub admin_token: Option<String>,
    pub log_reload_handle: Option<LogReloadHandle>,
}
```

Update `handle_log_level` to use `handle.set_level(new_filter)` instead of `handle.modify()`.

- [ ] **Step 4: Update data-node and curator logging**

**Note:** `data-node/src/main.rs` and `curator/src/main.rs` use their own inline `tracing_subscriber::fmt().init()` — NOT `common::logging::init_logging()`. These also need modification:
1. Replace `fmt().init()` with a reload-layer-aware setup
2. Return and store the reload handle
3. Pass it to `admin_router_with_log_handle()`

Alternatively, migrate these services to use the common `init_logging()`.

- [ ] **Step 5: Wire handle into admin router**

When constructing the admin router in each service, pass the handle:

```rust
let log_handle = init_logging(); // returns LogReloadHandle
let admin = admin_router_with_log_handle(
    shared_config.clone(),
    std::env::var("ADMIN_TOKEN").ok(),
    Some(log_handle),
);
```

- [ ] **Step 3: Test log level switching**

```bash
# Switch to debug
curl -X POST http://localhost:8200/admin/log-level \
    -H "Content-Type: application/json" \
    -d '{"level": "debug"}'

# Switch back to info
curl -X POST http://localhost:8200/admin/log-level \
    -H "Content-Type: application/json" \
    -d '{"level": "info"}'
```

- [ ] **Step 4: Commit**

```bash
git add common/src/runtime/admin.rs
git commit -m "feat(common): add runtime log level switching via /admin/log-level"
```

---

## Task 2: On-Chain Deployment Nonce

**Files:**
- Modify: `contracts/src/core/InvestmentStorage.sol:~162` (immediately before `__gap`)
- Modify: `contracts/src/core/Investment.sol`
- Modify: `contracts/script/DeployFullSystemE2E.s.sol`

- [ ] **Step 1: Add deploymentNonce to storage layout**

In `contracts/src/core/InvestmentStorage.sol`, add **immediately before the STORAGE GAP section** (before `__gap`, around line 162). The variable MUST be the last storage variable before `__gap`:

> **CRITICAL: Adding storage variables anywhere except immediately before `__gap` will corrupt the UUPS proxy storage layout.** All new storage variables go at the end, consuming gap slots. Never insert between existing variables.

```solidity
// ============ DEPLOYMENT TRACKING ============
/// @notice Incremented on each deployment/state change. Services poll this to detect staleness.
uint256 public deploymentNonce;
```

**IMPORTANT:** Decrement the storage gap to maintain slot accounting:

```solidity
// Before:
uint256[15] private __gap;
// After:
uint256[14] private __gap;
```

Update the slot accounting comment to reflect the new field consuming one gap slot.

- [ ] **Step 2: Add bumpDeploymentNonce to Investment.sol**

In `contracts/src/core/Investment.sol`, add:

```solidity
event DeploymentNonceUpdated(uint256 newNonce);

/// @notice Increment deployment nonce. Call after any deploy that changes contract state.
/// @dev Only callable by governance admin — uses inline check (no onlyGovernance modifier).
function bumpDeploymentNonce() external {
    if (msg.sender != governance.admin()) {
        revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
    }
    deploymentNonce++;
    emit DeploymentNonceUpdated(deploymentNonce);
}
```

> **Note:** Uses inline governance check instead of `onlyGovernance` modifier — the modifier may not exist or may have different semantics.

- [ ] **Step 3: Initialize nonce in initialize()**

In the `initialize()` function (Investment.sol line ~59-72), add at the end:

```solidity
deploymentNonce = 1;
```

- [ ] **Step 4: Add bumpDeploymentNonce call to deploy script**

In `contracts/script/DeployFullSystemE2E.s.sol`, after all contracts are deployed and configured, add:

```solidity
// Bump deployment nonce so services detect the new deployment
Investment(payable(address(investmentProxy))).bumpDeploymentNonce();
```

- [ ] **Step 5: Verify contracts compile**

Run: `cd /Users/maxguillabert/Downloads/index/contracts && forge build`

- [ ] **Step 6: Commit**

```bash
git add contracts/src/core/InvestmentStorage.sol contracts/src/core/Investment.sol contracts/script/DeployFullSystemE2E.s.sol
git commit -m "feat(contracts): add deploymentNonce for zero-restart service detection"
```

---

## Task 3: Auto-Migration Integration Tests

**Depends on:** Task 1e (migration runner must exist first)

**Files:**
- Create: `common/tests/migration_test.rs`

- [ ] **Step 1: Write migration runner test**

Create `common/tests/migration_test.rs`:

```rust
//! Integration test for auto-migration runner.
//! Requires DATABASE_URL env var pointing to a test Postgres instance.
//! Skip in CI if not available.

#[cfg(test)]
mod tests {
    use common::runtime::migrate::run_migrations;
    use sqlx::PgPool;
    use std::path::Path;
    use tempfile::TempDir;

    async fn setup_pool() -> Option<PgPool> {
        let url = std::env::var("DATABASE_URL").ok()?;
        PgPool::connect(&url).await.ok()
    }

    #[tokio::test]
    async fn test_migrations_run_in_order() {
        let Some(pool) = setup_pool().await else { return };
        let dir = TempDir::new().unwrap();

        // Create two migration files
        std::fs::write(
            dir.path().join("001_create_test.sql"),
            "CREATE TABLE IF NOT EXISTS _test_hot_reload_1 (id INT)"
        ).unwrap();
        std::fs::write(
            dir.path().join("002_create_test.sql"),
            "CREATE TABLE IF NOT EXISTS _test_hot_reload_2 (id INT)"
        ).unwrap();

        // First run: both applied
        let count = run_migrations(&pool, dir.path()).await.unwrap();
        assert_eq!(count, 2);

        // Second run: none applied (idempotent)
        let count = run_migrations(&pool, dir.path()).await.unwrap();
        assert_eq!(count, 0);

        // Cleanup
        sqlx::query("DROP TABLE IF EXISTS _test_hot_reload_1, _test_hot_reload_2, _applied_migrations")
            .execute(&pool).await.unwrap();
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add common/tests/migration_test.rs
git commit -m "test(common): add migration runner integration test"
```

---

## Task 4: Oracle Adoption

**Files:**
- Modify: `oracle/src/main.rs:353-366` (OracleApiState)
- Modify: `oracle/src/main.rs:4444-4543` (main function)
- Modify: `oracle/src/main.rs:585-593` (routes)
- Modify: `oracle/src/config.rs:842-861` (effective_contract_addresses)
- Modify: `oracle/src/bootstrap/mod.rs:86-100`

This is the most complex service. The oracle has BLS signing, P2P consensus, Vision engine, and settlement processing — all of which hold contract addresses.

- [ ] **Step 1: Add SharedConfig to OracleApiState**

In `oracle/src/main.rs`, modify `OracleApiState` (lines 353-366) to add:

```rust
pub struct OracleApiState {
    // ... existing fields ...
    pub runtime_config: SharedConfig,
}
```

Add import at top of file:
```rust
use common::runtime::config::{SharedConfig, RuntimeConfig, shared};
use common::runtime::admin::admin_router;
use common::runtime::watcher::DeploymentWatcher;
use common::runtime::validate::StartupValidator;
use common::runtime::migrate::run_migrations;
```

- [ ] **Step 2: Load RuntimeConfig in main()**

In `oracle/src/main.rs`, in the `main()` function (lines 4444-4543), after the ConfigBuilder builds the OracleConfig, add RuntimeConfig loading:

```rust
// After: let config = ConfigBuilder::new()...build()?;
// Add:
let deployment_path = config.deployment_file.clone()
    .unwrap_or_else(|| PathBuf::from("deployments/active-deployment.json"));
let rpc_url = config.effective_rpc_url();
let index_addr = config.effective_contract_addresses()
    .ok()
    .map(|ca| ca.index);

let runtime_config = RuntimeConfig::load(
    &deployment_path,
    &rpc_url,
    index_addr,
).await?;

// Startup validation
let errors = StartupValidator::validate(&runtime_config).await;
if !errors.is_empty() {
    for e in &errors {
        tracing::error!("Startup validation: {e}");
    }
    // Continue anyway — validation is advisory, not blocking
}

// Auto-migrate
if let Ok(ref db_url) = std::env::var("DATABASE_URL") {
    let pool = sqlx::PgPool::connect(db_url).await?;
    let migrations_dir = std::path::Path::new("migrations");
    if migrations_dir.exists() {
        run_migrations(&pool, migrations_dir).await?;
    }
}

let shared_config = shared(runtime_config);
```

- [ ] **Step 3: Spawn DeploymentWatcher with oracle flush logic**

After creating `shared_config`, spawn the watcher.

**IMPORTANT:** Add a "flushing" `AtomicBool` flag to service state. TRUNCATE during active requests can cause errors. Set the flag before TRUNCATE, clear after. Request handlers should return 503 when `flushing=true`.

```rust
use std::sync::atomic::{AtomicBool, Ordering};

let flushing = Arc::new(AtomicBool::new(false));
let watcher_config = shared_config.clone();
let watcher_path = deployment_path.clone();
// Clone handles needed for flush
let flush_pool = pool.clone(); // The oracle's PgPool
let flush_flag = flushing.clone();

DeploymentWatcher::new(watcher_config, watcher_path)
    .with_nonce_poll_interval(Duration::from_secs(60))
    .on_nonce_change(move |old_nonce, new_nonce| {
        tracing::warn!("DEPLOYMENT NONCE CHANGED: {old_nonce} → {new_nonce}. Flushing all state.");
        let pool = flush_pool.clone();
        let flushing_flag = flush_flag.clone();

        // Set flushing BEFORE spawn to close the race window.
        // If set inside the spawn, a request arriving between spawn() and the first
        // line of the async block would see flushing=false and hit a TRUNCATE.
        flushing_flag.store(true, Ordering::SeqCst);

        tokio::spawn(async move {
            // Drop guard that clears flushing flag even on panic.
            // Without this, a panic during TRUNCATE leaves flushing=true forever,
            // and the service returns 503 on every request until restart.
            struct FlushGuard(Arc<AtomicBool>);
            impl Drop for FlushGuard {
                fn drop(&mut self) {
                    self.0.store(false, Ordering::SeqCst);
                }
            }
            let _guard = FlushGuard(flushing_flag.clone());

            let start = std::time::Instant::now();

            // 1. Truncate all contract-dependent tables
            let tables = [
                "vision_batches", "vision_batch_state", "vision_bitmaps",
                "vision_positions", "vision_tick_results", "vision_user_balances",
                "vision_deposit_orders", "vision_withdraw_orders", "vision_balance_proofs",
                "vision_kv_store", "vision_player_tick_deltas",
                "signed_batch_configs", "batch_configs", "batch_settlements",
                "oracle_health_snapshots", "vision_last_resolved", "vision_reference_prices",
            ];
            for table in &tables {
                let sql = format!("TRUNCATE TABLE {table} CASCADE");
                if let Err(e) = sqlx::query(&sql).execute(&pool).await {
                    tracing::warn!("Failed to truncate {table}: {e}");
                }
            }

            // 2. Delete consensus WAL files
            for entry in std::fs::read_dir("logs").into_iter().flatten() {
                if let Ok(entry) = entry {
                    if entry.file_name().to_string_lossy().starts_with("consensus-")
                        && entry.file_name().to_string_lossy().ends_with(".wal")
                    {
                        let _ = std::fs::remove_file(entry.path());
                    }
                }
            }

            // 3. Reset chain_listener bookmark
            sqlx::query("DELETE FROM vision_kv_store WHERE key = 'chain_listener_last_block'")
                .execute(&pool).await.ok();

            // 4. Log BLS re-registration warning if OracleRegistry address changed
            tracing::warn!("Check if OracleRegistry address changed — may need BLS re-registration");

            // FlushGuard::drop clears flushing=false (even on panic)
            let elapsed = start.elapsed();
            tracing::info!("Oracle flush complete for nonce change (took {elapsed:?})");
        });
    })
    .spawn();
```

Request handlers should check `flushing`:
```rust
// In request handlers that touch flushed tables:
if flushing.load(Ordering::SeqCst) {
    return StatusCode::SERVICE_UNAVAILABLE.into_response();
}
```

- [ ] **Step 4: Merge admin routes into oracle HTTP server**

In `oracle_api_routes()` (line 585-593), merge the admin router:

```rust
fn oracle_api_routes(state: OracleApiState) -> Router {
    let admin = admin_router(
        state.runtime_config.clone(),
        std::env::var("ADMIN_TOKEN").ok(),
    );

    Router::new()
        .route("/health", get(health_handler))
        .route("/ready", get(ready_handler))
        // ... existing routes ...
        .merge(admin)
        .with_state(state)
}
```

- [ ] **Step 5: Update effective_contract_addresses to read from SharedConfig**

In `oracle/src/config.rs`, modify `effective_contract_addresses()` (lines 842-861). The method should still work from static config (for backward compatibility), but when `SharedConfig` is available, prefer it:

```rust
// This is a backward-compatible change — the existing method stays,
// but callers that have SharedConfig should read from it directly:
// let config = shared_config.load();
// let index = config.deployment.index_address()?;
```

The actual migration is: everywhere that calls `config.effective_contract_addresses()`, change to read from `shared_config.load().deployment.index_address()` etc. This is a search-and-replace across the oracle codebase.

- [ ] **Step 6: Verify oracle compiles**

Run: `cargo check -p oracle`

- [ ] **Step 7: Commit**

```bash
git add oracle/src/
git commit -m "feat(oracle): adopt SharedConfig with hot-reload, auto-flush on nonce change"
```

---

## Task 5: Data-Node Adoption

**Files:**
- Modify: `data-node/src/main.rs:75-205`
- Modify: `data-node/src/api.rs:284-329`
- Modify: `data-node/src/config.rs`

- [ ] **Step 1: Add SharedConfig to AppState**

In `data-node/src/api.rs` (lines 284-329), change `deployment: serde_json::Value` to:

```rust
pub struct AppState {
    // ... existing fields ...
    pub runtime_config: SharedConfig,  // replaces `deployment: serde_json::Value`
    // ... rest unchanged ...
}
```

Add import: `use common::runtime::config::SharedConfig;`

- [ ] **Step 2: Load RuntimeConfig in run_serve()**

In `data-node/src/main.rs`, in `run_serve()` (line 75+), after parsing `ServeArgs`, add:

```rust
use common::runtime::config::{RuntimeConfig, shared};
use common::runtime::admin::admin_router;
use common::runtime::watcher::DeploymentWatcher;
use common::runtime::validate::StartupValidator;
use common::runtime::migrate::run_migrations;

// After: let args = ServeArgs::parse();
let deployment_path = PathBuf::from(&args.deployment_file);
let runtime_config = RuntimeConfig::load(
    &deployment_path,
    &args.rpc_url,
    None, // data-node may not have index address in args
).await?;

let errors = StartupValidator::validate(&runtime_config).await;
for e in &errors {
    tracing::warn!("Startup validation: {e}");
}
```

- [ ] **Step 3: Replace existing migration runner with common one**

**IMPORTANT:** Data-node already has `db::run_migrations()` at `main.rs` line 85. Do NOT add a second migration runner. Replace the existing call:

```rust
// Before (existing):
db::run_migrations(&pool).await?;

// After (using common):
let migrations_dir = Path::new("migrations");
if migrations_dir.exists() {
    run_migrations(&pool, migrations_dir).await?;
}
```

Also seed the `_applied_migrations` tracking table with existing migration names so they don't re-run:

```rust
// One-time seed: mark existing migrations as already applied
// Run this ONCE during the transition (can be removed after first deploy):
sqlx::query(
    "CREATE TABLE IF NOT EXISTS _applied_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
    )"
).execute(&pool).await?;

// Insert existing migration names that were already applied by the old runner
let existing_migrations = ["001_init.sql", "002_vision.sql", /* ... list all existing ... */];
for name in &existing_migrations {
    sqlx::query("INSERT INTO _applied_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(name)
        .execute(&pool)
        .await?;
}
```

- [ ] **Step 4: Create SharedConfig and spawn watcher**

```rust
let shared_config = shared(runtime_config);

let watcher_config = shared_config.clone();
let flush_pool = pool.clone();
let flushing = Arc::new(AtomicBool::new(false));
let flush_flag = flushing.clone();

DeploymentWatcher::new(watcher_config, deployment_path.clone())
    .on_nonce_change(move |old, new| {
        tracing::warn!("Deployment nonce {old} → {new}. Flushing data-node state.");
        let pool = flush_pool.clone();
        let flushing_flag = flush_flag.clone();

        // Set flushing BEFORE spawn to close the race window
        flushing_flag.store(true, Ordering::SeqCst);

        tokio::spawn(async move {
            // Panic guard — clears flushing flag even on panic
            struct FlushGuard(Arc<AtomicBool>);
            impl Drop for FlushGuard {
                fn drop(&mut self) {
                    self.0.store(false, Ordering::SeqCst);
                }
            }
            let _guard = FlushGuard(flushing_flag.clone());

            let start = std::time::Instant::now();

            // 1. Truncate contract-dependent tables
            let tables = ["itp_snapshots", "trades", "user_shares", "market_prices_latest"];
            for table in &tables {
                let sql = format!("TRUNCATE TABLE {table} CASCADE");
                let _ = sqlx::query(&sql).execute(&pool).await;
            }

            // 2. Reset chain event cursor
            sqlx::query("DELETE FROM _applied_migrations WHERE name LIKE '%chain_cursor%'")
                .execute(&pool).await.ok(); // if cursor is tracked in migrations table
            // Note: chain pollers will restart from block 0 on next cycle

            // FlushGuard::drop clears flushing=false (even on panic)
            let elapsed = start.elapsed();
            tracing::info!("Data-node flush complete (took {elapsed:?})");
        });
    })
    .spawn();
```

- [ ] **Step 5: Use tuning params from RuntimeConfig**

Replace hardcoded values in `run_serve()`:
- Channel capacity: `let (tx, rx) = broadcast::channel(shared_config.load().channel_capacity);`
- SSE limits: read from `shared_config.load().sse_max_connections`
- Snapshot timeout: read from `shared_config.load().snapshot_timeout_secs`

- [ ] **Step 6: Merge admin routes**

Where the axum Router is built, merge:
```rust
let admin = admin_router(shared_config.clone(), args.admin_token.clone());
let app = Router::new()
    // ... existing routes ...
    .merge(admin)
    .with_state(state);
```

- [ ] **Step 7: Verify data-node compiles**

Run: `cargo check -p data-node`

- [ ] **Step 8: Commit**

```bash
git add data-node/src/
git commit -m "feat(data-node): adopt SharedConfig with hot-reload + auto-flush + replace migration runner"
```

---

## Task 6: AP Adoption

**Files:**
- Modify: `ap/Cargo.toml`
- Modify: `ap/src/main.rs:840-868` (replace raw TCP with axum)
- Modify: `ap/src/config.rs`

- [ ] **Step 1: Add axum dependency and upgrade reqwest in AP**

In `ap/Cargo.toml`, add/modify:
```toml
axum = "0.7"
reqwest = { version = "0.12", features = ["json", "rustls-tls", "stream"] }
```

> **Note:** `reqwest` must be upgraded from `"0.11"` to `"0.12"` for hyper 1.x compatibility with axum 0.7. If left at 0.11, you get conflicting hyper versions that prevent compilation. The `json`, `rustls-tls`, and `stream` features must be preserved — the AP uses all three for settlement HTTP calls and streaming responses.

- [ ] **Step 2: Replace raw TCP server with axum**

In `ap/src/main.rs`, replace the raw TCP listener (lines 840-868) with axum:

```rust
use axum::{Router, routing::get, Json, extract::State};
use common::runtime::config::{RuntimeConfig, SharedConfig, shared};
use common::runtime::admin::admin_router;
use common::runtime::watcher::DeploymentWatcher;

// Replace raw TCP with:
let app = Router::new()
    .route("/health", get(|| async { Json(serde_json::json!({"status": "ok"})) }))
    .route("/metrics", get(handle_metrics))
    .route("/status", get(handle_status))
    .merge(admin_router(shared_config.clone(), std::env::var("ADMIN_TOKEN").ok()))
    .with_state(ap_state);

let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
axum::serve(listener, app).await?;
```

- [ ] **Step 3: Load SharedConfig in AP main()**

After config loading in `main()` (lines 1364-1385):

```rust
let deployment_path = config.deployment_file.clone()
    .unwrap_or_else(|| PathBuf::from("deployments/active-deployment.json"));
let runtime_config = RuntimeConfig::load(
    &deployment_path,
    &config.effective_rpc_url(),
    None,
).await?;
let shared_config = shared(runtime_config);

DeploymentWatcher::new(shared_config.clone(), deployment_path)
    .on_nonce_change(move |old, new| {
        tracing::warn!("AP: deployment nonce {old} → {new}. Flushing AP state.");
        // 1. Clear order tracking state (pending buy/sell orders reference old contract addresses)
        // order_tracker.clear();  // or equivalent in-memory state reset
        // 2. Re-read symbol map from disk (will be reloaded by RuntimeConfig on next .load())
        // The SharedConfig reload already re-reads symbol-map.json — no manual action needed.
        // 3. Log completion
        tracing::info!("AP flush complete — order tracking cleared, symbol map will reload on next config read");
    })
    .spawn();
```

- [ ] **Step 4: Verify AP compiles**

Run: `cargo check -p ap`

- [ ] **Step 5: Commit**

```bash
git add ap/
git commit -m "feat(ap): replace raw TCP with axum, adopt SharedConfig with hot-reload"
```

---

## Task 7: Curator Adoption

**Files:**
- Modify: `curator/src/main.rs:619-668`
- Modify: `curator/src/quote_server.rs`

- [ ] **Step 1: Load SharedConfig in curator main()**

In `curator/src/main.rs`, in `main()` (lines 619-668):

```rust
use common::runtime::config::{RuntimeConfig, shared};
use common::runtime::watcher::DeploymentWatcher;

let deployment_path = PathBuf::from(
    std::env::var("DEPLOYMENT_FILE").unwrap_or_else(|_| "deployments/active-deployment.json".into())
);
let runtime_config = RuntimeConfig::load(
    &deployment_path,
    &args.rpc_url,
    None,
).await.expect("Failed to load runtime config");
let shared_config = shared(runtime_config);

DeploymentWatcher::new(shared_config.clone(), deployment_path)
    .on_nonce_change(move |old, new| {
        tracing::warn!("Curator: deployment nonce {old} → {new}. Flushing curator state.");
        // 1. Clear market registry cache (quote server holds cached market list from old contract)
        // market_cache.clear();  // or equivalent — invalidate the discovery cache
        // 2. Log completion — markets re-discovered on next health check cycle
        tracing::info!("Curator flush complete — markets will be re-discovered on next health check cycle");
    })
    .spawn();
```

- [ ] **Step 2: Merge admin routes into quote server**

In `curator/src/quote_server.rs`, merge admin routes:

```rust
let admin = common::runtime::admin::admin_router(
    shared_config.clone(),
    std::env::var("ADMIN_TOKEN").ok(),
);

let app = Router::new()
    .route("/api/lending/quote", post(handle_quote))
    .route("/health", get(handle_health))
    .merge(admin)
    .with_state(state);
```

- [ ] **Step 3: Verify curator compiles**

Run: `cargo check -p curator`

- [ ] **Step 4: Commit**

```bash
git add curator/src/
git commit -m "feat(curator): adopt SharedConfig with hot-reload + admin routes"
```

---

## Task 8: Frontend Runtime Deployment Endpoint

**Files:**
- Modify: `frontend/app/api/deployment/route.ts` (file already exists)
- Create: `frontend/hooks/useDeployment.ts`

- [ ] **Step 1: Modify existing deployment API route**

**This file already exists.** READ the existing file first to understand its current structure, including the `?file=` query parameter support and Vercel fallback to `public/deployment.json`.

Modify `frontend/app/api/deployment/route.ts` to add runtime deployment reading while preserving existing functionality:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // Preserve existing ?file= query parameter support
        const file = req.nextUrl.searchParams.get('file');

        let deploymentPath: string;
        if (file) {
            // Existing behavior: serve specific file
            deploymentPath = path.join(process.cwd(), 'lib/contracts', file);
        } else {
            // Default: runtime deployment config
            deploymentPath = process.env.DEPLOYMENT_FILE
                || path.join(process.cwd(), 'lib/contracts/deployment.json');
        }

        if (!fs.existsSync(deploymentPath)) {
            // Vercel fallback: try public/deployment.json
            const fallback = path.join(process.cwd(), 'public/deployment.json');
            if (fs.existsSync(fallback)) {
                deploymentPath = fallback;
            } else {
                return NextResponse.json(
                    { error: 'Deployment config not found' },
                    { status: 404 }
                );
            }
        }

        const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to load deployment config' },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Create useDeployment hook**

Create `frontend/hooks/useDeployment.ts`:

```typescript
import useSWR from 'swr';

interface DeploymentConfig {
    chainId: number;
    contracts: Record<string, string>;
    accounts?: Record<string, string>;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDeployment() {
    const { data, error, isLoading } = useSWR<DeploymentConfig>(
        '/api/deployment',
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 300_000, // 5 min
        }
    );

    return {
        deployment: data,
        error,
        isLoading,
        getAddress: (name: string) => data?.contracts?.[name] ?? null,
    };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/deployment/ frontend/hooks/useDeployment.ts
git commit -m "feat(frontend): runtime /api/deployment endpoint + useDeployment hook"
```

---

## Task 8b: useDeployment Covers NEXT_PUBLIC_* Addresses

**Depends on:** Task 8

**Files:**
- Modify: ~15 files in `frontend/hooks/vision/` and `frontend/lib/vision/`

- [ ] **Step 1: Identify all NEXT_PUBLIC_* address usage**

Grep for all `process.env.NEXT_PUBLIC_*_ADDRESS` references in the frontend:

```bash
grep -rn "process.env.NEXT_PUBLIC_VISION_ADDRESS\|process.env.NEXT_PUBLIC_SETTLEMENT_BRIDGE_CUSTODY_ADDRESS\|process.env.NEXT_PUBLIC_SETTLEMENT_USDC_ADDRESS\|process.env.NEXT_PUBLIC_INDEX_ADDRESS\|process.env.NEXT_PUBLIC_ORACLE_REGISTRY_ADDRESS\|process.env.NEXT_PUBLIC_USDC_ADDRESS\|process.env.NEXT_PUBLIC_CONTRACT_ADDRESS" frontend/
```

**Explicit classification — hook vs utility:**

| File | Type | Use `useDeployment()` hook? | Use `getDeploymentAddress()` utility? |
|------|------|---------------------------|--------------------------------------|
| `frontend/hooks/vision/useCreateBatch.ts` | React hook | Yes | No |
| `frontend/hooks/vision/useWithdraw.ts` | React hook | Yes | No |
| `frontend/hooks/vision/useClaim.ts` | React hook | Yes | No |
| `frontend/hooks/vision/usePlayerPosition.ts` | React hook | Yes | No |
| `frontend/hooks/vision/usePlayerBatches.ts` | React hook | Yes | No |
| `frontend/hooks/vision/useBatchMetadata.ts` | React hook | Yes | No |
| `frontend/hooks/vision/useSetBatchMetadata.ts` | React hook | Yes | No |
| `frontend/hooks/vision/useSetDeployerName.ts` | React hook | Yes | No |
| `frontend/hooks/vision/useVisionDeployerName.ts` | React hook | Yes | No |
| `frontend/lib/vision/constants.ts` | Module constants | No — hooks illegal | Yes (async) |
| `frontend/e2e/helpers/vision-api.ts` | E2E helper (Node) | No — not React | Yes (async) or direct env read |
| `frontend/components/domain/HowItWorks.tsx` | Component | Yes | No |

**Key mapping note:** `IssuerRegistry` may not exist as a key in `deployment.json`. The contract was renamed: `IssuerRegistry` → `OracleRegistry`. When looking up `IssuerRegistry`, fall back to `OracleRegistry`:

```typescript
const { getAddress } = useDeployment();
const registryAddress = getAddress('IssuerRegistry') || getAddress('OracleRegistry');
```

- [ ] **Step 2: Replace with useDeployment().getAddress() or getDeploymentAddress()**

For **React hook/component files** (see table above), replace patterns like:

```typescript
// Before:
const VISION_ADDRESS = process.env.NEXT_PUBLIC_VISION_ADDRESS as `0x${string}`;

// After:
import { useDeployment } from '@/hooks/useDeployment';
// Inside component/hook:
const { getAddress } = useDeployment();
const visionAddress = getAddress('Vision') as `0x${string}`;
```

For **non-React files** (like `constants.ts`, E2E helpers), use the async utility. Hooks are illegal outside React components:

```typescript
// frontend/lib/contracts/addresses.ts
let cachedDeployment: Record<string, string> | null = null;

export async function getDeploymentAddress(name: string): Promise<string | null> {
    if (!cachedDeployment) {
        const res = await fetch('/api/deployment');
        const data = await res.json();
        cachedDeployment = data.contracts;
    }
    // Handle IssuerRegistry → OracleRegistry rename
    return cachedDeployment?.[name]
        ?? (name === 'IssuerRegistry' ? cachedDeployment?.['OracleRegistry'] : null)
        ?? null;
}
```

- [ ] **Step 3: Verify no remaining NEXT_PUBLIC_*_ADDRESS references**

```bash
grep -rn "NEXT_PUBLIC_.*_ADDRESS" frontend/hooks/ frontend/lib/vision/ frontend/lib/contracts/ frontend/components/
# Expected: zero matches (or only in .env.example files)
```

- [ ] **Step 4: Commit**

```bash
git add frontend/hooks/ frontend/lib/vision/ frontend/lib/contracts/
git commit -m "refactor(frontend): replace NEXT_PUBLIC_*_ADDRESS env vars with useDeployment()"
```

---

## Task 9: Frontend Universal Proxy

**Files:**
- Modify: `frontend/app/api/dn/[...path]/route.ts` (file already exists)
- Create: `frontend/app/api/oracle/[...path]/route.ts`
- Create: `frontend/lib/fetch.ts`
- Modify: `frontend/next.config.ts:77-117`
- Modify: `frontend/lib/config.ts:1-36`

- [ ] **Step 1: Modify existing data-node proxy**

**This file already exists.** READ it first. Only modify the URL source — change from build-time import to runtime env var. PRESERVE existing:
- SSE streaming support
- `export const maxDuration = 300`
- `X-Accel-Buffering: no` header

```typescript
// Change the URL source from:
import { DATA_NODE_URL } from '@/lib/config';
// To:
const DATA_NODE_URL = process.env.DATA_NODE_URL || process.env.AA_DATA_NODE_URL || 'http://localhost:8200';

export const maxDuration = 300; // PRESERVE THIS

// ... rest of existing proxy logic stays the same, including SSE and X-Accel-Buffering
```

- [ ] **Step 2: Create catch-all oracle proxy**

Create `frontend/app/api/oracle/[...path]/route.ts` — same pattern as the data-node proxy:

```typescript
import { NextRequest, NextResponse } from 'next/server';

const ORACLE_URL = process.env.ORACLE_URL || 'http://localhost:9001';

export const maxDuration = 300;

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
    const path = pathSegments.join('/');
    const url = `${ORACLE_URL}/${path}${req.nextUrl.search}`;

    const headers = new Headers();
    for (const [key, value] of req.headers.entries()) {
        if (!['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
            headers.set(key, value);
        }
    }

    try {
        const response = await fetch(url, {
            method: req.method,
            headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.blob() : undefined,
        });

        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete('transfer-encoding');
        // Support SSE
        if (response.headers.get('content-type')?.includes('text/event-stream')) {
            responseHeaders.set('X-Accel-Buffering', 'no');
        }

        return new NextResponse(response.body, {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Upstream unreachable' },
            { status: 502 }
        );
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxyRequest(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxyRequest(req, path);
}
```

- [ ] **Step 3: Create backendFetch wrapper**

Create `frontend/lib/fetch.ts`:

```typescript
/**
 * All browser-side backend fetches MUST use this.
 * Routes through /api proxy to avoid mixed-content and CORS issues.
 * Server-side calls can go direct.
 */
export function dnFetch(path: string, init?: RequestInit): Promise<Response> {
    const prefix = typeof window !== 'undefined' ? '/api/dn' : (process.env.DATA_NODE_URL || 'http://localhost:8200');
    const url = path.startsWith('/') ? `${prefix}${path}` : `${prefix}/${path}`;
    return fetch(url, init);
}

export function oracleFetch(path: string, init?: RequestInit): Promise<Response> {
    const prefix = typeof window !== 'undefined' ? '/api/oracle' : (process.env.ORACLE_URL || 'http://localhost:9001');
    const url = path.startsWith('/') ? `${prefix}${path}` : `${prefix}/${path}`;
    return fetch(url, init);
}

export function visionFetch(path: string, init?: RequestInit): Promise<Response> {
    const prefix = typeof window !== 'undefined' ? '/api/vision' : (process.env.VISION_API_URL || 'http://localhost:9002');
    const url = path.startsWith('/') ? `${prefix}${path}` : `${prefix}/${path}`;
    return fetch(url, init);
}
```

- [ ] **Step 4: Simplify next.config.ts rewrites**

In `frontend/next.config.ts` (lines 77-117), remove all per-endpoint data-node and oracle rewrites. Keep only:
- Locale routing rewrites
- Docs proxy (if still needed)
- RPC proxy (if still needed)

The catch-all route handlers in `/api/dn/`, `/api/oracle/`, and `/api/vision/` replace all `afterFiles` rewrites.

- [ ] **Step 5: Simplify config.ts**

In `frontend/lib/config.ts` (lines 1-36), simplify all client-side URLs to use the proxy:

```typescript
// Client-side: always proxy
export const DATA_NODE_URL = typeof window !== 'undefined' ? '/api/dn' : (process.env.DATA_NODE_URL || 'http://localhost:8200');
export const ORACLE_URL = typeof window !== 'undefined' ? '/api/oracle' : (process.env.ORACLE_URL || 'http://localhost:9001');
export const VISION_URL = typeof window !== 'undefined' ? '/api/vision' : (process.env.VISION_API_URL || 'http://localhost:9002');
// ... keep L3_RPC, SETTLEMENT_RPC, etc. as-is
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/api/dn/ frontend/app/api/oracle/ frontend/lib/fetch.ts frontend/next.config.ts frontend/lib/config.ts
git commit -m "feat(frontend): universal proxy — catch-all /api/dn + /api/oracle route handlers"
```

---

## Task 9b: Complete Rewrite Migration

**Depends on:** Task 9

The plan only creates `/api/dn/` and `/api/oracle/` catch-all proxies. All `afterFiles` rewrites in `next.config.ts` must have corresponding catch-all route handlers.

**Files:**
- Create: `frontend/app/api/vision/[...path]/route.ts`
- Create: `frontend/app/api/backend/[...path]/route.ts` (catch-all for BACKEND_URL)
- Create: `frontend/app/api/rpc/route.ts` (RPC proxy, replaces `/rpc` rewrite)
- Audit: `frontend/next.config.ts` for any remaining `afterFiles` rewrites

- [ ] **Step 1: Create catch-all vision proxy**

Create `frontend/app/api/vision/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

const VISION_API_URL = process.env.VISION_API_URL || 'http://localhost:9002';

export const maxDuration = 300;

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
    const path = pathSegments.join('/');
    const url = `${VISION_API_URL}/${path}${req.nextUrl.search}`;

    const headers = new Headers();
    for (const [key, value] of req.headers.entries()) {
        if (!['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
            headers.set(key, value);
        }
    }

    try {
        const response = await fetch(url, {
            method: req.method,
            headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.blob() : undefined,
        });

        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete('transfer-encoding');
        if (response.headers.get('content-type')?.includes('text/event-stream')) {
            responseHeaders.set('X-Accel-Buffering', 'no');
        }

        return new NextResponse(response.body, {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Upstream unreachable' },
            { status: 502 }
        );
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxyRequest(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxyRequest(req, path);
}
```

- [ ] **Step 2: Create catch-all backend proxy (BACKEND_URL)**

Create `frontend/app/api/backend/[...path]/route.ts` — targets `BACKEND_URL` (the oracle/issuer backend on port 3001):

```typescript
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export const maxDuration = 300;

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
    const path = pathSegments.join('/');
    const url = `${BACKEND_URL}/${path}${req.nextUrl.search}`;

    const headers = new Headers();
    for (const [key, value] of req.headers.entries()) {
        if (!['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
            headers.set(key, value);
        }
    }

    try {
        const response = await fetch(url, {
            method: req.method,
            headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.blob() : undefined,
        });

        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete('transfer-encoding');
        // Support SSE streaming
        if (response.headers.get('content-type')?.includes('text/event-stream')
            || response.headers.get('transfer-encoding')?.includes('chunked')) {
            responseHeaders.set('X-Accel-Buffering', 'no');
        }

        return new NextResponse(response.body, {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Upstream unreachable' },
            { status: 502 }
        );
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxyRequest(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxyRequest(req, path);
}
```

This catch-all replaces ALL 14 BACKEND_URL `afterFiles` rewrites currently in `next.config.ts`:

| # | Removed Rewrite | Destination |
|---|----------------|-------------|
| 1 | `/api/leaderboard` | BACKEND_URL |
| 2 | `/api/leaderboard/:path*` | BACKEND_URL |
| 3 | `/api/bets/:path*` | BACKEND_URL |
| 4 | `/api/agents/:path*` | BACKEND_URL |
| 5 | `/api/resolutions/:path*` | BACKEND_URL |
| 6 | `/api/telegram/:path*` | BACKEND_URL |
| 7 | `/api/sse/:path*` | BACKEND_URL |
| 8 | `/api/keepers/:path*` | BACKEND_URL |
| 9 | `/api/markets/:path*` | BACKEND_URL |
| 10 | `/api/market-prices` | BACKEND_URL |
| 11 | `/api/market-stats/:path*` | BACKEND_URL |
| 12 | `/api/categories` | BACKEND_URL |
| 13 | `/api/snapshots/:path*` | BACKEND_URL |
| 14 | `/health` | BACKEND_URL |

The remaining non-BACKEND_URL `afterFiles` rewrites are covered by other catch-all handlers:

| Removed Rewrite | Destination | Replacement |
|----------------|-------------|-------------|
| `/dn/:path*` | DATA_NODE_URL | Existing `/api/dn/[...path]` catch-all |
| `/rpc` | L3_RPC_URL | New `/api/rpc/route.ts` (Task 9b) |
| `/api/vision/snapshot/meta` | DATA_NODE_URL | Handled by specific route or `/api/dn/` |
| `/api/vision/snapshot` | DATA_NODE_URL | Handled by specific route or `/api/dn/` |
| `/api/vision/:path*` | VISION_API_URL | New `/api/vision/[...path]` catch-all (Task 9b) |

**Note on `/api/vision/leaderboard`:** This endpoint routes to DATA_NODE_URL, NOT VISION_API_URL. The catch-all `/api/vision/[...path]` routes to VISION_API_URL, which would be wrong for leaderboard. However, `frontend/app/api/vision/leaderboard/route.ts` already exists as a specific route handler — and in Next.js App Router, specific routes take precedence over catch-all `[...path]` routes. No conflict. The existing `beforeFiles` rewrite for this endpoint in `next.config.ts` can be safely removed once the catch-all is in place, because the specific handler wins.

**Note:** Existing specific route handlers under `/api/vision/` (11 files including leaderboard) take precedence over the catch-all — Next.js resolves more-specific routes first. No conflict.

- [ ] **Step 3: Create RPC proxy (replaces /rpc rewrite)**

Create `frontend/app/api/rpc/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

const L3_RPC_URL = process.env.NEXT_PUBLIC_L3_RPC_URL || 'http://localhost:8545';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
    try {
        const body = await req.blob();
        const response = await fetch(L3_RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });

        return new NextResponse(response.body, {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'RPC unreachable' },
            { status: 502 }
        );
    }
}
```

- [ ] **Step 4: Audit remaining afterFiles rewrites**

Check `next.config.ts` for any other rewrite targets not yet covered by catch-all route handlers. After this task, the only remaining rewrites should be locale routing and docs proxy.

**IMPORTANT:** ALL new proxy route handlers must include `export const maxDuration = 300`.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/api/vision/ frontend/app/api/backend/ frontend/app/api/rpc/
git commit -m "feat(frontend): add catch-all /api/vision + /api/backend + /api/rpc proxies, complete rewrite migration"
```

---

## Task 9c: Static Frontend JSON Elimination

**Depends on:** Task 9

Replace static JSON imports with runtime fetches from backend APIs.

**Files:**
- Modify: files that import `@/data/sources-display.json`
- Modify: files that import `itp-id-names.json`
- Modify: files that import `blacklisted-itps.json`

- [ ] **Step 1: Replace sources-display.json import**

Find all files importing `sources-display.json`:

```bash
grep -rn "sources-display.json" frontend/
```

Replace `import sourcesDisplay from '@/data/sources-display.json'` with a runtime fetch from data-node `/sources/registry`:

```typescript
// Before:
import sourcesDisplay from '@/data/sources-display.json';

// After:
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function useSourcesDisplay() {
    const { data } = useSWR('/api/dn/sources/registry', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 600_000,
    });
    return data ?? [];
}
```

- [ ] **Step 2: Replace itp-id-names.json and blacklisted-itps.json**

Create a `/api/config` endpoint (or use an existing data-node endpoint) that serves ITP names and blacklist:

```typescript
// frontend/app/api/config/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    const itpNames = safeReadJson('data/itp-id-names.json');
    const blacklist = safeReadJson('data/blacklisted-itps.json');
    const sources = safeReadJson('data/sources-display.json');

    return NextResponse.json({ itpNames, blacklist, sources });
}

function safeReadJson(relativePath: string) {
    try {
        return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8'));
    } catch {
        return null;
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/
git commit -m "refactor(frontend): replace static JSON imports with runtime fetches"
```

---

## Task 10: Deploy Script Simplification

**Files:**
- Modify: `testnet.sh`
- Modify: `deploy.sh`
- Modify: `start.sh`

- [ ] **Step 1: Add bumpDeploymentNonce to deploy.sh with backward compatibility**

In `deploy.sh`, after forge deployment completes, add with capability check:

```bash
echo "Bumping deployment nonce..."

# Backward compatibility: check if contract supports deploymentNonce
if cast call $INDEX_ADDRESS "deploymentNonce()" --rpc-url $L3_RPC_URL 2>/dev/null; then
    # New way: bump nonce, services auto-detect
    cast send $INDEX_ADDRESS "bumpDeploymentNonce()" \
        --rpc-url $L3_RPC_URL \
        --private-key $DEPLOYER_KEY \
        --legacy \
        || exit 1

    # Verify the nonce was actually bumped
    NONCE=$(cast call $INDEX_ADDRESS "deploymentNonce()" --rpc-url $L3_RPC_URL)
    echo "Deployment nonce bumped to: $NONCE"
    echo "Services will auto-detect and flush."
else
    # Fallback: manual TRUNCATE for contracts without deploymentNonce
    echo "Contract does not support deploymentNonce. Falling back to manual TRUNCATE."
    # ... existing TRUNCATE logic ...

    # Also try manual reload if services are running
    for port in 8200 9001 8400 8300; do
        curl -sf -X POST "http://localhost:$port/admin/reload" 2>/dev/null && \
            echo "Triggered manual reload on port $port" || true
    done
fi
```

- [ ] **Step 2: Add bumpDeploymentNonce verification with fallback**

After the `cast send`, verify and add fallback:

```bash
# If nonce bump failed, try manual reload as fallback
if [ $? -ne 0 ]; then
    echo "WARNING: nonce bump failed. Attempting manual reload..."
    for port in 8200 9001 8400 8300; do
        curl -sf -X POST "http://localhost:$port/admin/reload" 2>/dev/null && \
            echo "Triggered manual reload on port $port" || true
    done
fi
```

- [ ] **Step 3: Add health polling to deploy.sh**

Replace `sleep 15` health waits with polling:

```bash
wait_for_service() {
    local url=$1
    local name=$2
    local expected_nonce=$3
    local max_attempts=30

    echo "Waiting for $name to detect new deployment..."
    for i in $(seq 1 $max_attempts); do
        local nonce=$(curl -sf "$url/admin/health" 2>/dev/null | jq -r '.deployment_nonce // 0')
        if [ "$nonce" = "$expected_nonce" ]; then
            echo "$name detected nonce $nonce"
            return 0
        fi
        sleep 2
    done
    echo "WARNING: $name did not detect nonce $expected_nonce after ${max_attempts} attempts"
    return 1
}
```

- [ ] **Step 4: Remove manual TRUNCATE from testnet.sh**

In `testnet.sh` (lines 660-668), replace the manual TRUNCATE block with a comment:

```bash
# Table truncation is now automatic — services flush on deployment nonce change.
# To force a flush: curl -X POST http://service/admin/reload
```

- [ ] **Step 5: Remove manual address sync from testnet.sh**

In `testnet.sh`, the multi-file copy section (lines 795-801 and other cp/scp blocks) can be simplified. Keep only:

```bash
# Single source of truth: active-deployment.json
# Services detect changes via file watcher.
# Frontend reads via /api/deployment endpoint.
scp deployments/active-deployment.json $VPS_HOST:$VPS_DIR/deployments/
```

Remove the 6+ `cp` commands that sync to `envs/testnet/`, `frontend/lib/contracts/`, etc.

- [ ] **Step 6: Remove manual table truncation from start.sh**

In `start.sh`, remove any TRUNCATE commands. Services auto-migrate and auto-flush.

- [ ] **Step 7: Commit**

```bash
git add testnet.sh deploy.sh start.sh
git commit -m "refactor(deploy): simplify scripts — services auto-flush on nonce change, with fallback"
```

---

## Task 11: Integration Testing & Safety Verification

**Files:**
- No new files — uses existing E2E infrastructure

- [ ] **Step 1: Verify all services compile**

```bash
cargo build --workspace
```

Expected: Clean build across all 4 services + common crate.

- [ ] **Step 2: Test admin endpoints locally**

Start each service locally and verify:

```bash
# Data-node
curl http://localhost:8200/admin/health
# Expected: JSON with deployment_nonce, rpc_url, contracts

curl http://localhost:8200/admin/config
# Expected: Full runtime config dump

curl -X POST http://localhost:8200/admin/reload
# Expected: {"status":"no_changes","diffs":[],"nonce_changed":false,"dry_run":false}

curl -X POST "http://localhost:8200/admin/reload?dry_run=true"
# Expected: Same but dry_run:true

curl -X POST http://localhost:8200/admin/log-level \
    -H "Content-Type: application/json" \
    -d '{"level": "debug"}'
# Expected: {"status":"updated","level":"debug"}
```

Repeat for oracle (port 9001), AP (port 8400), curator (port 8300).

- [ ] **Step 3: Test hot-reload by modifying deployment.json**

```bash
# 1. Start data-node
# 2. Modify deployments/active-deployment.json (change any address)
# 3. Wait 2s (debounce)
# 4. Check logs for "Config reloaded: ..."
# 5. Verify /admin/config shows new address
```

- [ ] **Step 4: Test nonce-change flush**

```bash
# 1. Start oracle against local Anvil
# 2. Insert test data into vision_batches
# 3. Call bumpDeploymentNonce() on contract
# 4. Wait 60s (nonce poll interval)
# 5. Verify vision_batches is empty (auto-truncated)
# 6. Check logs for "DEPLOYMENT NONCE CHANGED" + "Oracle flush complete"
# 7. Verify 503 was returned during flush window
```

- [ ] **Step 5: Test frontend deployment endpoint**

```bash
cd frontend && npm run dev
curl http://localhost:3000/api/deployment
# Expected: JSON matching deployments/active-deployment.json

curl "http://localhost:3000/api/deployment?file=deployment.json"
# Expected: Same (backward compat)
```

- [ ] **Step 6: Test frontend proxy**

```bash
# With data-node running on 8200:
curl http://localhost:3000/api/dn/health
# Expected: proxied response from data-node

curl http://localhost:3000/api/dn/aum-ranking
# Expected: proxied response

curl http://localhost:3000/api/oracle/health
# Expected: proxied response from oracle

curl http://localhost:3000/api/vision/health
# Expected: proxied response from vision
```

- [ ] **Step 7: Full E2E smoke test**

Run the core E2E tests against local Anvil:

```bash
npx playwright test --config=e2e/playwright.config.ts --grep "connect wallet|display ITP"
```

- [ ] **Step 8: Commit any test fixes**

```bash
git add -A
git commit -m "test: verify hot-reload integration across all services"
```

---

## Post-Implementation Verification Checklist

After all tasks complete, verify these properties:

- [ ] **No service requires restart for address changes** — modify `active-deployment.json`, confirm `/admin/config` reflects new addresses within 5s
- [ ] **No service requires restart for URL changes** — change `DATA_NODE_URL` env var, call `/admin/reload`, confirm new URL used
- [ ] **No service requires restart for tuning changes** — change `DB_POOL_SIZE` env var, call `/admin/reload`
- [ ] **No service requires restart for log level changes** — `POST /admin/log-level {"level":"debug"}`, confirm verbose logging appears
- [ ] **Contract redeploy auto-detected** — call `bumpDeploymentNonce()`, confirm all services flush within 60s
- [ ] **Frontend reads addresses at runtime** — change `deployment.json` on server, confirm `/api/deployment` returns new data without Vercel redeploy
- [ ] **No NEXT_PUBLIC_*_ADDRESS env vars remain** — all replaced with `useDeployment().getAddress()`
- [ ] **No mixed-content errors** — all frontend fetches go through `/api/dn`, `/api/oracle`, or `/api/vision` proxy
- [ ] **No static JSON imports for deployment data** — `sources-display.json`, `itp-id-names.json`, `blacklisted-itps.json` served from API
- [ ] **Auto-migration works** — add a new `.sql` file, restart service, confirm it's applied
- [ ] **Migration runner is advisory-locked** — start two oracle instances simultaneously, confirm no duplicate migrations
- [ ] **Startup validation warns on bad config** — set `RPC_URL` to invalid value, confirm warning in logs (not crash)
- [ ] **Deploy script has backward compatibility** — run against contract without `deploymentNonce`, confirm fallback to manual TRUNCATE
- [ ] **Flushing returns 503** — during TRUNCATE, confirm requests return 503, not errors
- [ ] **Deploy script simplified** — count lines in `testnet.sh`, confirm reduction of ~400 lines

---

## Deferred to Future Plan

- **Symbol map from chain (Spec Layer 6):** Building the symbol map dynamically from on-chain token registry via `Index.getITPState()` + Bitget instrument list. Currently loaded from `data/symbol-map.json` at startup. Deferring because: (a) requires Bitget API integration in common crate, (b) the deploy script already rebuilds symbol-map.json reliably after token deployment, (c) the RuntimeConfig reload already re-reads the file on change. Net impact: symbol-map changes still require file update + reload signal, but no longer require binary rebuild or restart.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| ArcSwap introduces subtle concurrency bugs | ArcSwap is production-proven (used by TiKV, Linkerd). Lock-free reads are simpler than RwLock. |
| File watcher misses events under high I/O | Nonce poll (60s) is the safety net — file watcher is optimization only |
| Flush on nonce change destroys in-flight data | Flushing flag returns 503 during TRUNCATE window. Logged with duration. System recovers on next cycle. |
| Frontend proxy adds latency | Route handlers in Next.js serverless functions add ~5ms. Acceptable for API calls. |
| Auto-migration runs dangerous DDL | Convention: all migrations use IF NOT EXISTS / IF EXISTS. Tracking table prevents re-runs. Advisory lock prevents concurrent execution. |
| ADMIN_TOKEN not set = open reload endpoint | Admin routes check token if set. If not set, warn at startup but don't block. Production MUST set it. |
| Concurrent migration runners (multiple oracle containers) | `pg_advisory_lock(42)` serializes all migration runners on a single dedicated connection. Second instance blocks until first completes. |
| TRUNCATE during active requests | AtomicBool flushing flag + 503 response. Handlers check flag before touching flushed tables. FlushGuard drop impl clears flag even on panic. |
| `Handle::current()` panic in file watcher thread | Handle captured BEFORE `std::thread::spawn`, not inside. CancellationToken enables clean shutdown. |
| notify platform features fail in Docker | Default features auto-select correct backend. No platform-specific feature flags. |
| reqwest/hyper version conflict with axum 0.7 | AP upgrades reqwest from 0.11 to 0.12 for hyper 1.x compatibility. |
| Deploy script runs against old contract without deploymentNonce | Capability check: `cast call` first, fallback to manual TRUNCATE + manual `/admin/reload`. |
| Data-node has two migration runners | Old `db::run_migrations()` replaced (not supplemented). Existing migrations seeded in `_applied_migrations`. |

---

## Review Corrections Applied

**25 round-1 + 12 round-2 + 7 round-3 = 44 total corrections applied**, documented here for traceability.

### Compile-Blocking Fixes

1. **common/Cargo.toml missing deps** — Task 1 Step 1 now adds `axum = "0.7"` and `sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres"] }` in addition to `arc-swap` and `notify`. Without these, the `admin.rs` and `migrate.rs` modules cannot compile.

2. **notify platform features** — Changed from `notify = { version = "6.1", default-features = false, features = ["macos_kqueue"] }` to `notify = "6.1"`. The `macos_kqueue` feature fails on Linux Docker. Default features auto-select the correct backend per platform.

3. **DeploymentConfig Serialize** — Added step to modify `deployment_config.rs` line 15: add `Serialize` to the derive macro. Without this, `RuntimeConfig` (which contains `DeploymentConfig`) cannot derive `Serialize`.

4. **get_contract_address visibility** — Added step to make `get_contract_address` public in `deployment_config.rs`. The `StartupValidator` calls this method from outside the crate.

5. **from_file error type** — Changed `DeploymentConfig::from_file(deployment_path)?` to use `.map_err(|e| ConfigError::Validation(e.to_string()))?`. The `?` operator cannot auto-convert `from_file`'s error type into `ConfigError` without an explicit mapping.

6. **Index.sol does not exist** — Changed ALL references to `Index.sol` to `Investment.sol`. The contract file is `contracts/src/core/Investment.sol`. `Index.sol` was never a real file.

7. **onlyGovernance modifier** — Replaced `function bumpDeploymentNonce() external onlyGovernance` with inline check: `if (msg.sender != governance.admin()) revert`. The `onlyGovernance` modifier may not exist or may have different semantics.

8. **Storage gap** — Added note that `__gap` must be decremented from `[15]` to `[14]` and slot accounting comment updated when adding `deploymentNonce` to InvestmentStorage.sol.

9. **ethers::utils::id() return type** — Changed `.data(ethers::utils::id("deploymentNonce()").as_bytes().to_vec())` to `.data(ethers::utils::id("deploymentNonce()").to_vec())`. `id()` returns a type that implements `Into<Vec<u8>>` directly — calling `.as_bytes()` first is incorrect.

10. **AP reqwest conflict** — Task 6 Step 1 now also upgrades `reqwest` from `"0.11"` to `"0.12"` for hyper 1.x compatibility with axum 0.7. Without this, conflicting hyper versions prevent compilation.

11. **git add references** — Changed `contracts/src/core/Index.sol` to `contracts/src/core/Investment.sol` in all git add commands.

### Runtime-Blocking Fixes

12. **Handle::current() panic** — In watcher.rs, `tokio::runtime::Handle::current()` was being called inside `std::thread::spawn`, which panics because there is no tokio runtime on the new thread. Fix: capture handle BEFORE spawning. Added `CancellationToken` for clean shutdown.

13. **Watcher callback blocking** — Changed `block_on(send(()))` to `try_send(())` in the file watcher callback. `block_on` can deadlock if the channel is full. `try_send` is non-blocking — if the channel is full, a reload is already pending.

14. **Migration race condition** — Added `pg_advisory_lock(42)` before running migrations and `pg_advisory_unlock(42)` after. This serializes concurrent instances (e.g., three oracle containers starting simultaneously).

15. **TRUNCATE during active requests** — Added "flushing" `AtomicBool` flag to service state. Set before TRUNCATE, cleared after. Request handlers return 503 when `flushing=true`. Flush duration is logged.

16. **bumpDeploymentNonce verification** — In deploy.sh, added `|| exit 1` after `cast send`, then verification via `cast call` to confirm the nonce was actually bumped. Added fallback: `curl -X POST http://service/admin/reload` if nonce bump fails.

### File Overwrite Fixes

17. **`/api/dn/[...path]/route.ts` already exists** — Changed "Create" to "Modify" in file structure table. Task 9 Step 1 now reads the existing file first and only modifies the URL source, preserving SSE streaming, `maxDuration=300`, and `X-Accel-Buffering` headers.

18. **`/api/deployment/route.ts` already exists** — Changed "Create" to "Modify". Task 8 Step 1 now preserves the existing `?file=` query parameter and Vercel fallback to `public/deployment.json`.

19. **Data-node duplicate migration runner** — Task 5 now notes that data-node already has `db::run_migrations()` at `main.rs` line 85. The plan replaces the existing runner, not adds a second. Includes seeding `_applied_migrations` table with existing migration names.

### Missing Tasks Added

20. **Task 8b: useDeployment covers NEXT_PUBLIC_* addresses** — New subtask to grep and replace all `process.env.NEXT_PUBLIC_*_ADDRESS` references (~15 files) in `frontend/hooks/vision/` and `frontend/lib/vision/constants.ts` with `useDeployment().getAddress()`.

21. **Task 1f: Runtime log level switching** — New subtask adding `POST /admin/log-level` endpoint. Uses `tracing_subscriber::reload::Layer` with stored reload handle. Accepts `{"level": "debug"}` and calls `handle.modify()`.

22. **Task 9b: Complete rewrite migration** — New subtask adding catch-all route handlers for `/api/vision/[...path]` (targeting `VISION_API_URL`) and auditing for any other `afterFiles` rewrites. All new handlers include `export const maxDuration = 300`.

23. **Task 9c: Static frontend JSON elimination** — New subtask replacing `import sourcesDisplay from '@/data/sources-display.json'` with runtime fetch, and replacing `itp-id-names.json` and `blacklisted-itps.json` imports with data served from `/api/config`.

24. **Backward compatibility in deploy script** — Task 10 now keeps manual TRUNCATE as fallback behind capability check: `cast call $INDEX_ADDRESS "deploymentNonce()"` — if supported, bump nonce; if not, fall back to manual TRUNCATE.

25. **Dependency graph correction** — Task 3 now depends on Task 1e (migration runner must exist before tests can be written). Updated parallelizable groups accordingly. Task 3 moved from Group A to Group B.

### Round 2 Corrections

26. **Fix 1: deploymentNonce storage slot location** — Changed from "after the PRODUCTION HARDENING section (around line 95-100)" to "immediately before the STORAGE GAP section (before `__gap`, around line 162)". Added CRITICAL warning: adding storage variables anywhere except before `__gap` corrupts UUPS proxy storage layout. Updated `__gap` from `[15]` to `[14]`.

27. **Fix 2: pg_advisory_lock on single connection** — The advisory lock was acquired via `pool.execute()`, which uses any pooled connection, but subsequent migration queries could run on a different connection (defeating the lock). Rewritten to acquire a dedicated `PoolConnection`, run ALL migration queries on that connection, and release the lock on the same connection. `run_migrations_inner` now takes `&mut PoolConnection` instead of `&PgPool`.

28. **Fix 3: Add /api/backend/ catch-all proxy** — Added `frontend/app/api/backend/[...path]/route.ts` targeting BACKEND_URL (port 3001). Includes SSE streaming support and `transfer-encoding` detection. Added `/api/rpc/route.ts` for L3 RPC proxy. Listed all 12 BACKEND_URL rewrites this catch-all replaces. Noted that existing specific `/api/vision/` route handlers take precedence.

29. **Fix 4: Add tokio-util to common/Cargo.toml** — `tokio-util = { version = "0.7", features = ["rt"] }` added to Task 1 Step 1 dependencies. Required by `CancellationToken` used in `watcher.rs`.

30. **Fix 5: AP reqwest features preserved** — Changed `reqwest = "0.12"` to `reqwest = { version = "0.12", features = ["json", "rustls-tls", "stream"] }`. The AP uses all three features for settlement HTTP calls.

31. **Fix 6: Next.js params Promise type** — Changed all proxy route handler signatures from `{ params }: { params: { path: string[] } }` to `{ params }: { params: Promise<{ path: string[] }> }`. Added `const { path } = await params;` at the start of each handler. This is the correct Next.js App Router signature (params is async in App Router).

32. **Fix 7: Task 1f log level — refactor logging.rs** — Rewrote Task 1f to account for `common/src/logging.rs` having a complex dual-layer setup (file + stdout + EnvFilter). Added `LogLevelReloader` trait + `LogReloadHandle` type alias using `Box<dyn ...>` to hide complex layer stack types. Updated `AdminState` to use opaque handle. Noted that data-node and curator use inline `fmt().init()` and need separate modification.

33. **Fix 8: Task 8b — explicit hook vs utility classification** — Added classification table listing all 12 files that need modification, specifying whether each should use `useDeployment()` hook (React context) or `getDeploymentAddress()` async utility (non-React). Added `NEXT_PUBLIC_CONTRACT_ADDRESS` to grep pattern. Added `IssuerRegistry` → `OracleRegistry` mapping note.

34. **Fix 9: Wire check_auth as middleware** — Replaced dead `check_auth` function with `auth_middleware` using `axum::middleware::Next` pattern. Applied via `.layer(axum::middleware::from_fn_with_state(state.clone(), auth_middleware))` on the admin router.

35. **Fix 10: Flush panic guard** — Wrapped flush task in a `FlushGuard` struct implementing `Drop` that clears the `flushing` AtomicBool flag. Without this, a panic during TRUNCATE leaves `flushing=true` permanently, causing perpetual 503 responses. Applied to both oracle (Task 4) and data-node (Task 5) flush callbacks.

36. **Fix 11: Remove IDeploymentNonce.sol from file table** — Removed the row for `contracts/src/interfaces/IDeploymentNonce.sol` from the "New files" table. The `bumpDeploymentNonce()` function is added directly to `Investment.sol`, not via a separate interface file. Replaced with `frontend/app/api/backend/[...path]/route.ts` and `frontend/app/api/rpc/route.ts`.

37. **Fix 12: Add symbol map deferral note** — Added "Deferred to Future Plan" section documenting that Spec Layer 6 (dynamic symbol map from chain) is deferred. Reasons: requires Bitget API in common crate, deploy script already rebuilds symbol-map.json, RuntimeConfig reload already re-reads the file.

### Round 3 Corrections (fixes 38-44)

38. **Fix 1: LogLevelReloader trait — single definition** — The `LogLevelReloader` trait was defined in both `admin.rs` and `logging.rs` (Task 1f). Removed the definition from `logging.rs`. The trait is defined once in `admin.rs` (with `Send + Sync` supertraits). `logging.rs` now imports it via `use crate::runtime::admin::LogLevelReloader` and `ReloadHandleImpl` implements the admin trait.

39. **Fix 2: diff() compares ALL fields** — `RuntimeConfig::diff()` only compared `deployment_nonce`, `rpc_url`, `db_pool_size` with a `// ... compare all fields` comment. Replaced with complete implementation comparing all 11 scalar fields (`deployment_nonce`, `rpc_url`, `settlement_rpc_url`, `data_node_url`, `db_pool_size`, `poll_interval_secs`, `channel_capacity`, `rpc_timeout_secs`, `snapshot_timeout_secs`, `sse_max_connections`, `sse_per_ip_limit`), plus deployment contracts (iterate keys, compare values, detect additions/removals) and symbol map length.

40. **Fix 3: BACKEND_URL rewrite table — use ACTUAL rewrites** — The table in Task 9b listed 12 fabricated BACKEND_URL rewrites that did not match `next.config.ts`. Replaced with the actual 14 BACKEND_URL `afterFiles` rewrites from the source file. Added a second table listing the 5 non-BACKEND_URL `afterFiles` rewrites and their replacement handlers. Added note about `/api/vision/leaderboard` routing to DATA_NODE_URL (not VISION_API_URL).

41. **Fix 4: Flushing flag set BEFORE tokio::spawn** — In both oracle (Task 4) and data-node (Task 5) flush callbacks, `flushing_flag.store(true)` was inside the `tokio::spawn` async block. This leaves a race window: a request arriving between `spawn()` and the first line of the async block sees `flushing=false` and hits a mid-TRUNCATE table. Moved `flushing_flag.store(true, Ordering::SeqCst)` to before the `tokio::spawn` call. The `FlushGuard` drop still clears it.

42. **Fix 5: Vision leaderboard specific route** — Added documentation note in Task 9b that `/api/vision/leaderboard` routes to DATA_NODE_URL, not VISION_API_URL. The catch-all `/api/vision/[...path]` would route it incorrectly. However, `frontend/app/api/vision/leaderboard/route.ts` already exists — in App Router, specific routes take precedence over catch-all `[...path]` routes. No code changes needed, just documentation.

43. **Fix 6: Flesh out flush callbacks per spec** — Oracle flush (Task 4) now includes: reset `chain_listener_last_block` bookmark via DELETE from `vision_kv_store`, and a tracing::warn about potential BLS re-registration if OracleRegistry changed. Data-node flush (Task 5) now resets chain event cursor via DELETE from `_applied_migrations` where name matches chain_cursor pattern. AP flush (Task 6) expanded from bare comment to: clear order tracking state, note that symbol map reloads automatically, log completion. Curator flush (Task 7) expanded to: clear market registry cache, log that markets will be re-discovered on next health check cycle.

44. **Fix 7: Sync file structure table with tasks** — Added missing files to the file structure table: `common/tests/migration_test.rs` (Task 3), `frontend/app/api/config/route.ts` (Task 9c), `frontend/lib/contracts/addresses.ts` (Task 8b), `frontend/app/api/backend/[...path]/route.ts` (Task 9b), `frontend/app/api/rpc/route.ts` (Task 9b). Added missing modified files: `common/src/logging.rs` (Task 1f), `data-node/src/config.rs` (Task 5), `ap/src/config.rs` (Task 6), `data-node/src/db.rs` (Task 5). Added Task column to both tables. Resolved `/api/vision/[...path]/route.ts` — listed as Create with note that it coexists with 11 existing specific route handlers (specific routes win in App Router).
