use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;
use serde::Serialize;

/// Generation counter — bumped on every cache write. SSE dispatcher compares
/// its last-sent generation against the cache generation to detect changes.
#[derive(Default)]
pub struct Generation(AtomicU64);

impl Generation {
    pub fn bump(&self) -> u64 { self.0.fetch_add(1, Ordering::Relaxed) + 1 }
    pub fn get(&self) -> u64 { self.0.load(Ordering::Relaxed) }
}

// ── Global data (same for all clients) ──

#[derive(Clone, Serialize, Default)]
pub struct NavSnapshot {
    pub itp_id: String,
    pub name: String,
    pub symbol: String,
    pub nav_per_share: f64,
    pub total_supply: String,
    pub aum_usd: f64,
    pub settlement_address: Option<String>,
}

#[derive(Clone, Serialize, Default)]
pub struct OracleSnapshot {
    pub price: String,
    pub last_updated: u64,
    pub last_cycle: u64,
    pub borrow_rate_ray: String,
}

/// Serialized L3 limit order for the backend cache
#[derive(Clone, Serialize, Default)]
pub struct CachedLimitOrder {
    pub order_id: u64,
    pub user: String,
    pub itp_id: String,
    pub side: u8,
    pub amount: String,
    pub limit_price: String,
    pub slippage_tier: u8,
    pub deadline: String,
    pub timestamp: u64,
    pub status: u8,
}

/// Serialized oracle info
#[derive(Clone, Serialize, Default)]
pub struct CachedOracle {
    pub address: String,
    pub endpoint: String,
    pub bls_pubkey: String,
}

/// Serialized pending rebalance
#[derive(Clone, Serialize, Default)]
pub struct CachedPendingRebalance {
    pub itp_id: String,
    pub requester: String,
    pub remove_indices: Vec<String>,
    pub add_assets: Vec<String>,
    pub new_weights: Vec<String>,
    pub note: String,
    pub block_number: u64,
    pub current_assets: Vec<String>,
}

/// Cached on-chain ITP state (assets, weights, inventory, supply)
#[derive(Clone, Serialize, Default)]
pub struct CachedItpState {
    pub creator: ethers::types::Address,
    pub total_supply: ethers::types::U256,
    pub assets: Vec<ethers::types::Address>,
    pub weights: Vec<ethers::types::U256>,
    pub inventory: Vec<ethers::types::U256>,
    pub nav: ethers::types::U256,
    pub name: String,
    pub symbol: String,
    pub settlement_address: Option<String>,
}

/// Cached MetaMorpho vault state (totalAssets, totalSupply, name, symbol, decimals)
#[derive(Clone, Serialize, Default)]
pub struct MorphoVaultState {
    pub total_assets: String,
    pub total_supply: String,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
}

/// Cached Morpho market state (polled every 30s)
#[derive(Clone, Serialize, Default)]
pub struct CachedMorphoMarket {
    pub market_id: String,
    pub collateral_token: String,
    pub loan_token: String,
    pub irm: String,
    pub total_supply_assets: String,
    pub total_supply_shares: String,
    pub total_borrow_assets: String,
    pub total_borrow_shares: String,
    pub borrow_rate_per_second: String,
    pub lltv: String,
    pub oracle: String,
    pub last_update: u64,
}

/// In-memory cache of all ITP states, keyed by itp_id hex string
pub struct ItpStateCache {
    pub states: HashMap<String, CachedItpState>,
}

impl ItpStateCache {
    pub fn new() -> Self {
        Self { states: HashMap::new() }
    }
}

// ── Per-user data ──

#[derive(Clone, Serialize, Default)]
pub struct UserBalances {
    pub usdc_l3: String,
    pub usdc_settlement: String,
    /// Per-ITP shares: itp_id hex → balance string (wei)
    pub itp_shares: HashMap<String, String>,
    pub bridged_itp: String,
    pub itp_nonce: u64,
    pub vision_balance: String,
    pub native_gas_balance: String,
    pub vault_shares: String,
}

#[derive(Clone, Serialize, Default)]
pub struct UserAllowances {
    pub usdc_l3_to_index: String,
    pub usdc_settlement_to_custody: String,
    pub itp_to_morpho: String,
    pub usdc_l3_to_vault: String,    // L3 USDC → MetaMorpho vault
    pub usdc_l3_to_vision: String,   // L3 USDC → Vision contract
}

#[derive(Clone, Serialize, Default)]
pub struct UserOrder {
    pub order_id: u64,
    pub user: String,
    pub side: u8,
    pub amount: String,
    pub limit_price: String,
    pub itp_id: String,
    pub timestamp: u64,
    pub status: u8,
    pub fill_price: Option<String>,
    pub fill_amount: Option<String>,
    pub fill_cycle: Option<u64>,
}

#[derive(Clone, Serialize, Default)]
pub struct MorphoPositionSnapshot {
    pub supply_shares: String,
    pub borrow_shares: String,
    pub collateral: String,
}

#[derive(Clone, Serialize, Default)]
pub struct FillRecord {
    pub order_id: u64,
    pub side: u8,
    pub fill_price: String,
    pub fill_amount: String,
    pub limit_price: String,
}

#[derive(Clone, Serialize, Default)]
pub struct UserCostBasis {
    pub total_cost: String,
    pub total_shares_bought: String,
    pub avg_cost_per_share: String,
    pub total_sell_proceeds: String,
    pub total_shares_sold: String,
    pub realized_pnl: String,
    pub fills: Vec<FillRecord>,
}

pub struct UserCache {
    pub balances: UserBalances,
    pub balances_gen: Generation,
    pub allowances: UserAllowances,
    pub allowances_gen: Generation,
    pub orders: Vec<UserOrder>,
    pub orders_gen: Generation,
    /// market_id (hex string) → position snapshot; only markets with non-zero positions are stored
    pub positions: HashMap<String, MorphoPositionSnapshot>,
    pub positions_gen: Generation,
    pub cost_basis: UserCostBasis,
    pub cost_basis_gen: Generation,
    pub last_scanned_block: u64, // for incremental event scanning (cost basis)
    pub last_activity: Instant,
}

impl Default for UserCache {
    fn default() -> Self {
        Self {
            balances: UserBalances::default(),
            balances_gen: Generation::default(),
            allowances: UserAllowances::default(),
            allowances_gen: Generation::default(),
            orders: Vec::new(),
            orders_gen: Generation::default(),
            positions: HashMap::new(),
            positions_gen: Generation::default(),
            cost_basis: UserCostBasis::default(),
            cost_basis_gen: Generation::default(),
            last_scanned_block: 0,
            last_activity: Instant::now(),
        }
    }
}

pub struct ChainCache {
    pub nav: RwLock<Vec<NavSnapshot>>,
    pub nav_gen: Generation,
    pub oracle: RwLock<OracleSnapshot>,
    pub oracle_gen: Generation,
    pub users: RwLock<HashMap<String, Arc<RwLock<UserCache>>>>,

    // L3 backend state
    pub pending_orders: RwLock<Vec<CachedLimitOrder>>,
    pub pending_orders_gen: Generation,
    pub batched_orders: RwLock<Vec<CachedLimitOrder>>,
    pub batched_orders_gen: Generation,
    pub oracle_registry: RwLock<Vec<CachedOracle>>,
    pub oracle_registry_gen: Generation,
    pub last_cycle: AtomicU64,
    pub next_order_id: AtomicU64,
    pub pending_rebalances: RwLock<Vec<CachedPendingRebalance>>,
    pub pending_rebalances_gen: Generation,
    pub active_oracle_count: AtomicU64,
    pub aggregated_pubkey: RwLock<Vec<u8>>,
    pub aggregated_pubkey_gen: Generation,
    pub consensus_paused: AtomicBool,

    // Settlement state
    pub settlement_confirmed_block: AtomicU64,
    pub pending_creations: RwLock<Vec<serde_json::Value>>,
    pub pending_creations_gen: Generation,
    pub settlement_next_nonce: AtomicU64,
    // Cross-chain orders (recent events from SettlementBridgeCustody)
    pub cross_chain_buy_orders: RwLock<Vec<serde_json::Value>>,
    pub cross_chain_buy_orders_gen: Generation,
    pub cross_chain_sell_orders: RwLock<Vec<serde_json::Value>>,
    pub cross_chain_sell_orders_gen: Generation,

    // Cached system snapshot (pre-serialized JSON for SSE)
    pub system_snapshot_json: RwLock<String>,
    pub system_snapshot_gen: Generation,

    // ITP state cache (hydrated from chain on startup)
    pub itp_states: RwLock<ItpStateCache>,
    pub hydration_complete: AtomicBool,

    // Precomputed AUM ranking (refreshed every 60s)
    pub aum_ranking_json: RwLock<String>,
    pub aum_ranking_gen: Generation,

    // ITP requester map: itp_id hex → original requester address (Settlement admin field)
    // For bridge-created ITPs only; non-bridge ITPs are absent (use on-chain creator).
    pub itp_requesters: RwLock<HashMap<String, String>>,

    // Morpho market state (polled every 30s)
    pub morpho_markets: RwLock<Vec<CachedMorphoMarket>>,
    pub morpho_markets_gen: Generation,

    // MetaMorpho vault state (polled every 30s)
    pub morpho_vault: RwLock<MorphoVaultState>,
    pub morpho_vault_gen: Generation,
}

impl ChainCache {
    pub fn new() -> Self {
        Self {
            nav: RwLock::new(Vec::new()),
            nav_gen: Generation::default(),
            oracle: RwLock::new(OracleSnapshot::default()),
            oracle_gen: Generation::default(),
            users: RwLock::new(HashMap::new()),

            // L3 backend state
            pending_orders: RwLock::new(Vec::new()),
            pending_orders_gen: Generation::default(),
            batched_orders: RwLock::new(Vec::new()),
            batched_orders_gen: Generation::default(),
            oracle_registry: RwLock::new(Vec::new()),
            oracle_registry_gen: Generation::default(),
            last_cycle: AtomicU64::new(0),
            next_order_id: AtomicU64::new(0),
            pending_rebalances: RwLock::new(Vec::new()),
            pending_rebalances_gen: Generation::default(),
            active_oracle_count: AtomicU64::new(0),
            aggregated_pubkey: RwLock::new(Vec::new()),
            aggregated_pubkey_gen: Generation::default(),
            consensus_paused: AtomicBool::new(false),

            // Settlement state
            settlement_confirmed_block: AtomicU64::new(0),
            pending_creations: RwLock::new(Vec::new()),
            pending_creations_gen: Generation::default(),
            settlement_next_nonce: AtomicU64::new(0),
            cross_chain_buy_orders: RwLock::new(Vec::new()),
            cross_chain_buy_orders_gen: Generation::default(),
            cross_chain_sell_orders: RwLock::new(Vec::new()),
            cross_chain_sell_orders_gen: Generation::default(),

            system_snapshot_json: RwLock::new(String::new()),
            system_snapshot_gen: Generation::default(),

            itp_states: RwLock::new(ItpStateCache::new()),
            hydration_complete: AtomicBool::new(false),

            aum_ranking_json: RwLock::new(String::new()),
            aum_ranking_gen: Generation::default(),

            itp_requesters: RwLock::new(HashMap::new()),

            morpho_markets: RwLock::new(Vec::new()),
            morpho_markets_gen: Generation::default(),

            morpho_vault: RwLock::new(MorphoVaultState::default()),
            morpho_vault_gen: Generation::default(),
        }
    }

    /// Returns (cache, is_new) — caller can trigger eager poll for new users
    pub async fn get_or_create_user(&self, address: &str) -> (Arc<RwLock<UserCache>>, bool) {
        let addr = address.to_lowercase();
        {
            let users = self.users.read().await;
            if let Some(u) = users.get(&addr) {
                // Touch last_activity on access
                if let Ok(mut uc) = u.try_write() {
                    uc.last_activity = Instant::now();
                }
                return (Arc::clone(u), false);
            }
        }
        let mut users = self.users.write().await;
        let is_new = !users.contains_key(&addr);
        let entry = users.entry(addr).or_insert_with(|| Arc::new(RwLock::new(UserCache::default())));
        (Arc::clone(entry), is_new)
    }

    pub async fn evict_stale_users(&self, max_age: std::time::Duration) {
        let mut users = self.users.write().await;
        let before = users.len();
        users.retain(|_, cache| {
            match cache.try_read() {
                Ok(uc) => uc.last_activity.elapsed() < max_age,
                Err(_) => true, // locked = active
            }
        });
        let evicted = before - users.len();
        if evicted > 0 {
            tracing::info!(evicted, remaining = users.len(), "Evicted stale user caches");
        }
    }
}
