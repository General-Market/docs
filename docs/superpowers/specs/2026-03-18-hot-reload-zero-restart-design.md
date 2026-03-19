# Hot-Reload & Zero-Restart Architecture

**Date**: 2026-03-18
**Scope**: Full stack — all 4 Rust services + frontend + contracts + deploy script
**Goal**: Eliminate ~100 restart-causing commits by making addresses, URLs, tuning params, and deployment state runtime-swappable with automatic stale-state detection.

---

## Problem Summary (from 400-commit analysis)

| Root Cause | Commits | Fix |
|-----------|---------|-----|
| Deployment JSON propagation (14 files, manual sync) | ~30 | Single source + runtime endpoint |
| Mixed-content proxy whack-a-mole | ~18 | Universal proxy rule |
| Stale caches after redeploy | ~15 | On-chain deployment nonce |
| Hardcoded tuning params (pool sizes, timeouts) | ~12 | Env-var config |
| URL/env var oscillation | ~10 | Runtime URL hot-swap |
| DB table wipes after redeploy | ~6 | Deployment-aware flush |
| Docker lifecycle (key files, overrides, env) | ~6 | Startup validation |
| Build-time env baking | ~5 | Runtime route handlers |

---

## Architecture Overview

### Layer 1: Common RuntimeConfig Crate (`common/src/runtime/`)

**New module** in `common/` — every service imports this.

#### `runtime_config.rs`

```rust
use arc_swap::ArcSwap;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    // === Addresses (from deployment JSON) ===
    pub deployment: DeploymentConfig,
    pub deployment_nonce: u64,           // From Index.deploymentNonce()
    pub symbol_map: HashMap<Address, String>,

    // === URLs ===
    pub rpc_url: String,
    pub settlement_rpc_url: Option<String>,
    pub data_node_url: Option<String>,

    // === Tuning ===
    pub db_pool_size: u32,
    pub poll_interval_secs: u64,
    pub channel_capacity: usize,
    pub rpc_timeout_secs: u64,
    pub snapshot_timeout_secs: u64,
    pub sse_max_connections: usize,
    pub sse_per_ip_limit: usize,
}

pub type SharedConfig = Arc<ArcSwap<RuntimeConfig>>;

impl RuntimeConfig {
    /// Load from deployment file + env vars + on-chain nonce
    pub async fn load(
        deployment_path: &Path,
        rpc_url: &str,
        index_address: Option<Address>,
    ) -> Result<Self, ConfigError>;

    /// Reload from disk + chain. Returns (new_config, nonce_changed)
    pub async fn reload(
        &self,
        deployment_path: &Path,
        rpc_url: &str,
        index_address: Option<Address>,
    ) -> Result<(Self, bool), ConfigError>;
}
```

#### `deployment_watcher.rs`

Background task that monitors for changes:

```rust
pub struct DeploymentWatcher {
    config: SharedConfig,
    deployment_path: PathBuf,
    rpc_url: String,
    index_address: Option<Address>,
    nonce_poll_interval: Duration,      // Default: 60s
    on_reload: Option<Box<dyn Fn(&RuntimeConfig, &RuntimeConfig) + Send + Sync>>,
    on_nonce_change: Option<Box<dyn Fn(u64, u64) + Send + Sync>>,
}

impl DeploymentWatcher {
    pub fn new(config: SharedConfig, path: PathBuf, rpc_url: String) -> Self;
    pub fn with_nonce_poll(self, interval: Duration) -> Self;
    pub fn on_reload(self, f: impl Fn(&RuntimeConfig, &RuntimeConfig) + Send + Sync + 'static) -> Self;
    pub fn on_nonce_change(self, f: impl Fn(u64, u64) + Send + Sync + 'static) -> Self;
    pub fn spawn(self) -> tokio::task::JoinHandle<()>;
}
```

**Reload triggers**:
1. inotify/kqueue on `active-deployment.json` (immediate)
2. Periodic nonce poll via `cast call Index.deploymentNonce()` (every 60s)
3. Manual `POST /admin/reload` (authenticated)

**On nonce change** (deployment detected):
1. Re-read deployment JSON
2. Swap RuntimeConfig atomically
3. Fire `on_nonce_change` callback → service-specific flush logic

#### `admin_routes.rs`

Axum routes injected into each service's router:

```rust
pub fn admin_router(config: SharedConfig, admin_token: Option<String>) -> Router {
    Router::new()
        .route("/admin/reload", post(handle_reload))
        .route("/admin/config", get(handle_show_config))
        .route("/admin/health", get(handle_deep_health))
        .with_state(AdminState { config, admin_token })
}
```

- `POST /admin/reload` — force reload from disk + chain, returns diff
- `GET /admin/config` — dump current runtime config (addresses, URLs, tuning)
- `GET /admin/health` — deep health: deployment nonce, DB connectivity, RPC reachable, chain sync status

#### `startup_validator.rs`

Pre-flight checks before accepting traffic:

```rust
pub struct StartupValidator;

impl StartupValidator {
    pub async fn validate(config: &RuntimeConfig) -> Result<(), Vec<ValidationError>> {
        let mut errors = vec![];

        // Required env vars present
        if config.rpc_url.is_empty() { errors.push(...) }

        // RPC reachable
        if !Self::check_rpc(&config.rpc_url).await { errors.push(...) }

        // Contract addresses valid (non-zero, have code)
        for (name, addr) in config.deployment.contracts.iter() {
            if !Self::has_code(&config.rpc_url, addr).await { errors.push(...) }
        }

        // DB connectable (if pool config present)
        // Credentials valid (Bitget API key works)

        if errors.is_empty() { Ok(()) } else { Err(errors) }
    }
}
```

#### `auto_migrate.rs`

Run SQL migrations on startup before accepting connections:

```rust
pub async fn run_migrations(pool: &PgPool, migrations_dir: &Path) -> Result<usize, MigrationError> {
    // Read all *.sql files, sorted by name
    // Track applied migrations in `_migrations` table
    // Skip already-applied, run new ones in transaction
    // Return count of newly applied
}
```

---

### Layer 2: On-Chain Deployment Nonce

**Contract change**: Add to `Index.sol` (or a new `DeploymentRegistry.sol`):

```solidity
uint256 public deploymentNonce;

function initialize(...) external initializer {
    // ... existing init logic ...
    deploymentNonce = block.timestamp; // Or explicit counter
}

// Called by deploy script after each deploy
function bumpDeploymentNonce() external onlyOwner {
    deploymentNonce++;
    emit DeploymentNonceUpdated(deploymentNonce);
}
```

**Why `bumpDeploymentNonce()` instead of just using `initialize()`**:
- `initialize()` only runs on fresh proxy deploys
- `bumpDeploymentNonce()` can be called after any state-changing deploy (new Vision batches, token registrations, etc.)
- Separates "contract upgraded" from "deployment state changed"

**Event**: `DeploymentNonceUpdated(uint256 newNonce)` — services can subscribe via chain listener instead of polling.

---

### Layer 3: Service-Specific Adoption

#### Oracle (`oracle/`)

**Changes to `oracle/src/config.rs`**:
- `OracleConfig` gains a `runtime: SharedConfig` field
- All `effective_*` methods that return addresses read from `runtime.load()` instead of stored fields
- Background tasks receive `SharedConfig` instead of static addresses

**Flush on nonce change** (`oracle/src/main.rs`):
```rust
watcher.on_nonce_change(|old, new| {
    // 1. Clear settled_order_ids cache
    // 2. Clear known_order_ids cache
    // 3. Delete consensus WAL files
    // 4. TRUNCATE all 18 contract-dependent tables
    // 5. Reset chain_listener bookmark
    // 6. Re-register BLS keys if OracleRegistry changed
    // 7. Log: "Deployment nonce changed {old} → {new}, flushed all state"
});
```

**Axum admin routes**: Add `admin_router()` to existing oracle HTTP server.

**Tuning params from env** (currently hardcoded):
- `ORACLE_DB_POOL_SIZE` (was hardcoded 3/20)
- `ORACLE_NONCE_POLL_INTERVAL` (new)
- `ORACLE_MIRROR_SYNC_INTERVAL` (was hardcoded 500 cycles)

#### Data-node (`data-node/`)

**Changes to `data-node/src/config.rs`**:
- `ServeArgs` parsed at startup, converted to `RuntimeConfig`
- `AppState.deployment` changes from `serde_json::Value` to `SharedConfig`
- All collectors receive `SharedConfig`

**Flush on nonce change**:
```rust
watcher.on_nonce_change(|old, new| {
    // 1. Clear ITP state cache
    // 2. Clear NAV cache
    // 3. Clear health stats cache
    // 4. Reset chain pollers to block 0
    // 5. Reload symbol map from chain
    // 6. TRUNCATE contract-dependent tables
});
```

**Existing `/sim/reload-cache`**: Keep as-is, it's orthogonal.

**Tuning params from env** (currently hardcoded):
- `DN_DB_POOL_SIZE` (was resized 4 times: 50→5→30→80)
- `DN_CHANNEL_CAPACITY` (was hardcoded 16, then 256)
- `DN_SNAPSHOT_TIMEOUT_SECS` (was changed 3 times)
- `DN_NAV_POLL_INTERVAL_SECS` (was hardcoded 1, then 30)
- `DN_SSE_MAX_CONNECTIONS` (was hardcoded 500)
- `DN_SSE_PER_IP_LIMIT` (was hardcoded 10)

**Auto-migration**: Run `data-node/migrations/*.sql` on startup.

#### AP (`ap/`)

**HTTP server migration**: Replace raw TCP with Axum. The AP currently has 3 endpoints (`/health`, `/metrics`, `/status`) — trivial to migrate.

**Changes to `ap/src/config.rs`**:
- `APConfig` gains `runtime: SharedConfig`
- `effective_*` methods read from runtime config

**Flush on nonce change**:
```rust
watcher.on_nonce_change(|old, new| {
    // 1. Clear order tracking state
    // 2. Re-read Index contract for new asset list
    // 3. Reload symbol map
});
```

#### Curator (`curator/`)

**Changes to `curator/src/config.rs`**:
- Mode-specific configs read addresses from `SharedConfig`
- Quote API server receives `SharedConfig`

**Flush on nonce change**:
```rust
watcher.on_nonce_change(|old, new| {
    // 1. Re-discover Morpho markets
    // 2. Re-read ITP addresses for health monitor
    // 3. Reload oracle addresses
});
```

---

### Layer 4: Frontend Runtime Deployment

#### Kill the 14-file JSON sync

**New API route**: `frontend/app/api/deployment/route.ts`

```typescript
// Server-side route handler — reads at RUNTIME, not build-time
export async function GET() {
    const deployment = JSON.parse(
        fs.readFileSync(process.env.DEPLOYMENT_FILE || 'lib/contracts/deployment.json', 'utf-8')
    );
    return Response.json(deployment, {
        headers: { 'Cache-Control': 'public, max-age=300' } // 5min cache
    });
}
```

**Frontend hook**: `useDeployment()` — fetches from `/api/deployment` with SWR, replaces all static `import deployment from './deployment.json'` usages.

**Build-time fallback**: Keep `deployment.json` for SSG/SSR pages that need addresses at build time, but all client-side reads go through the API.

#### Universal proxy rule

**`frontend/lib/fetch.ts`**:
```typescript
export function backendFetch(path: string, init?: RequestInit): Promise<Response> {
    // Always route through /api proxy — never direct HTTP URLs
    const base = typeof window !== 'undefined' ? '' : process.env.DATA_NODE_URL;
    return fetch(`${base}/api/dn${path}`, init);
}
```

**Lint rule**: ESLint rule that flags direct `fetch('http://...')` calls in frontend code. Forces use of `backendFetch()` or `/api/*` routes.

**Proxy consolidation in `next.config.ts`**:
- Single `/dn/:path*` rewrite to DATA_NODE_URL (server-side, runtime)
- Single `/oracle/:path*` rewrite to ORACLE_URL (server-side, runtime)
- Remove per-endpoint rewrites — one catch-all per backend service

Wait — Next.js rewrites in `next.config.ts` are build-time. For runtime URL switching, these must be **route handlers**, not rewrites.

**Solution**: Replace `next.config.ts` rewrites with a catch-all route handler:

```typescript
// frontend/app/api/dn/[...path]/route.ts
export async function GET(req: Request, { params }: { params: { path: string[] } }) {
    const target = process.env.DATA_NODE_URL; // Runtime!
    const path = params.path.join('/');
    return fetch(`${target}/${path}`, { headers: req.headers });
}
```

This makes DATA_NODE_URL runtime-configurable on Vercel — change the env var, no redeploy needed.

---

### Layer 5: Deploy Script Simplification

**Current**: `testnet.sh` is 2093 lines with manual address sync, table truncation, key file management, health checks.

**After this work**, the script shrinks because:

1. **Address sync** (currently ~100 lines of cp/scp): Deploy writes `active-deployment.json` once. Services detect the file change via watcher. Frontend reads via API. No manual copies.

2. **Table truncation** (currently ~30 lines of TRUNCATE): Services auto-flush when they detect nonce change. Script just calls `cast send Index.bumpDeploymentNonce()`.

3. **Health checks** (currently `sleep 15`): Services expose `/admin/health` with readiness status. Script polls until ready.

4. **Key file lifecycle** (4 commits to fix): Keys written to persistent directory, not `/tmp`. Docker volume mount, not bind mount.

**New deploy flow**:
```bash
# 1. Deploy contracts (existing forge scripts)
forge script Deploy... --broadcast

# 2. Sync deployment JSON to one location
cp broadcast-output.json deployments/active-deployment.json
scp deployments/active-deployment.json vps:~/index/deployments/

# 3. Bump nonce (triggers all services to auto-flush + reload)
cast send $INDEX_ADDRESS "bumpDeploymentNonce()" --private-key $DEPLOYER_KEY

# 4. Wait for services to detect and reload
for service in oracle-1 oracle-2 oracle-3 data-node ap curator; do
    until curl -sf "http://$service/admin/health" | jq -e '.deployment_nonce == $NEW_NONCE'; do
        sleep 2
    done
done

# 5. Run migrations (or services auto-migrated on reload)
# 6. Done. No restarts.
```

**testnet.sh cleanup**: Remove ~400 lines of manual address sync, table truncation, health wait, and key file management.

---

### Layer 6: Symbol Map from Chain

**Current**: `data/symbol-map.json` is a static file mapping token addresses to Bitget pairs. Rebuilt by a Python script during deploy. Stale after any token deployment.

**New**: Data-node builds symbol map dynamically on startup and on nonce change:

```rust
async fn build_symbol_map(rpc: &str, index_addr: Address) -> HashMap<Address, String> {
    // 1. Read all ITP states via Index.getITPState(itp_id) for each active ITP
    // 2. Extract token addresses from inventories
    // 3. Match against Bitget instrument list (cached, refreshed hourly)
    // 4. Return address → pair mapping
}
```

**Stored in** `RuntimeConfig.symbol_map` — auto-rebuilt on nonce change.

**Eliminates**: `data/symbol-map.json`, the Python rebuild script, and 5 commits of sync failures.

---

### Layer 7: Auto-Migration on Startup

Each service runs its own migrations before accepting traffic:

```rust
// In main() before starting HTTP server
let applied = auto_migrate::run_migrations(&pool, "migrations/").await?;
if applied > 0 {
    info!("Applied {applied} new migrations");
}
```

**Migration table**: `_migrations(name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ)`

**Convention**: All migration files use `IF NOT EXISTS` / `IF EXISTS` for idempotency.

**Eliminates**: The ad1afad4 + 813c7879 + 24c1cf3a cluster (migrations not run, non-idempotent DDL).

---

### Layer 8: Deployment-Aware DB Tables

**Not implementing full `deployment_id` FK** — too invasive for the current schema.

**Instead**: The nonce-change flush handler TRUNCATEs all contract-dependent tables automatically. This is what the deploy script already does manually — we're just automating it and making it service-triggered instead of script-triggered.

**Tables to truncate on nonce change** (per service):

Oracle: `vision_batches`, `vision_batch_state`, `vision_bitmaps`, `vision_positions`, `vision_tick_results`, `vision_user_balances`, `vision_deposit_orders`, `vision_withdraw_orders`, `vision_balance_proofs`, `vision_kv_store`, `vision_player_tick_deltas`, `signed_batch_configs`, `batch_configs`, `batch_settlements`, `oracle_health_snapshots`

Data-node: `itp_snapshots`, `trades`, `user_shares`, `market_prices_latest`

**The list lives in code**, not in a bash script — so it can't drift.

---

## Safety Nets

### 1. Admin token authentication
All `/admin/*` endpoints require `ADMIN_TOKEN` header. No unauthenticated reloads.

### 2. Config diff logging
Every reload logs the exact diff: which addresses changed, which URLs changed, which tuning params changed. Audit trail.

### 3. Rollback on reload failure
If the new config fails validation (RPC unreachable, addresses have no code, DB unreachable), the reload is rejected and the old config stays active. Log the error, keep running.

### 4. Graceful flush
On nonce change, the flush is wrapped in a transaction. If any step fails, roll back and log — don't partially flush.

### 5. Dry-run mode
`POST /admin/reload?dry_run=true` — parses new config, validates, returns diff, but doesn't swap.

### 6. Health endpoint for orchestration
`GET /admin/health` returns:
```json
{
    "deployment_nonce": 3,
    "config_loaded_at": "2026-03-18T20:15:00Z",
    "rpc_connected": true,
    "db_connected": true,
    "migrations_current": true,
    "contracts_valid": true
}
```
Deploy scripts poll this to confirm services are healthy after reload.

### 7. File watcher debounce
inotify events are debounced (2s) to avoid reload storms during multi-file syncs.

### 8. Nonce-only flush guard
A full flush (TRUNCATE + cache clear + WAL delete) ONLY happens when `deploymentNonce` changes. Address-only changes (e.g., correcting a typo in deployment.json) trigger a soft reload — config swap without data destruction.

---

## Files Touched (Estimated)

### New files (~12)
- `common/src/runtime/mod.rs`
- `common/src/runtime/runtime_config.rs`
- `common/src/runtime/deployment_watcher.rs`
- `common/src/runtime/admin_routes.rs`
- `common/src/runtime/startup_validator.rs`
- `common/src/runtime/auto_migrate.rs`
- `contracts/src/core/DeploymentRegistry.sol` (or addition to Index.sol)
- `frontend/app/api/deployment/route.ts`
- `frontend/app/api/dn/[...path]/route.ts`
- `frontend/app/api/oracle/[...path]/route.ts`
- `frontend/lib/fetch.ts`
- `frontend/hooks/useDeployment.ts`

### Modified files (~20)
- `common/src/lib.rs` (export runtime module)
- `common/src/adapters/deployment_config.rs` (add symbol_map loading)
- `oracle/src/config.rs` (adopt SharedConfig)
- `oracle/src/main.rs` (spawn watcher, flush handler, admin routes)
- `oracle/src/bootstrap/mod.rs` (read from SharedConfig)
- `data-node/src/config.rs` (convert to RuntimeConfig)
- `data-node/src/main.rs` (spawn watcher, flush handler, admin routes)
- `data-node/src/api.rs` (AppState uses SharedConfig)
- `ap/src/config.rs` (adopt SharedConfig)
- `ap/src/main.rs` (replace raw TCP with axum, spawn watcher)
- `curator/src/config.rs` (adopt SharedConfig)
- `curator/src/main.rs` (spawn watcher, flush handler)
- `curator/src/quote_server.rs` (read from SharedConfig)
- `contracts/src/core/Index.sol` (add deploymentNonce)
- `contracts/script/DeployFullSystemE2E.s.sol` (call bumpDeploymentNonce)
- `frontend/lib/config.ts` (use backendFetch, remove direct URLs)
- `frontend/next.config.ts` (remove per-endpoint rewrites)
- `testnet.sh` (simplify: remove manual sync/truncate/health-wait)
- `deploy.sh` (add bumpDeploymentNonce step)
- `start.sh` (remove manual table truncation)

### Removed/simplified
- `data/symbol-map.json` (replaced by chain-derived map)
- ~400 lines from `testnet.sh`
- Per-endpoint rewrites from `next.config.ts`
- Multiple `deployment.json` copies (keep only `deployments/active-deployment.json`)

---

## Dependencies

- `arc-swap` crate (lock-free atomic pointer swap) — add to `common/Cargo.toml`
- `notify` crate (cross-platform file watcher) — add to `common/Cargo.toml`
- No new frontend dependencies

---

## What This Does NOT Cover

1. **Logic bugs in oracle/data-node** (wrong ABI, arithmetic errors) — these require code changes, not config
2. **ABI changes from contract upgrades** — frontend must rebuild when contract interface changes
3. **New feature endpoints** — adding new API routes still requires deployment
4. **Orbit L3 nonce divergence** — already solved by CREATE2, not revisited here
5. **Frontend UI changes** — obviously require deployment

These are the ~280 commits that are legitimate code changes. This plan targets the ~100 that were configuration, propagation, or stale-state issues.
