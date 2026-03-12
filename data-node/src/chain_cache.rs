use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
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

/// Serialized issuer info
#[derive(Clone, Serialize, Default)]
pub struct CachedIssuer {
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

// ── Per-user data ──

#[derive(Clone, Serialize, Default)]
pub struct UserBalances {
    pub usdc_l3: String,
    pub usdc_settlement: String,
    /// Per-ITP shares: itp_id hex → balance string (wei)
    pub itp_shares: HashMap<String, String>,
    pub bridged_itp: String,
    pub itp_nonce: u64,
}

#[derive(Clone, Serialize, Default)]
pub struct UserAllowances {
    pub usdc_l3_to_index: String,
    pub usdc_settlement_to_custody: String,
    pub itp_to_morpho: String,
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

#[derive(Default)]
pub struct UserCache {
    pub balances: UserBalances,
    pub balances_gen: Generation,
    pub allowances: UserAllowances,
    pub allowances_gen: Generation,
    pub orders: Vec<UserOrder>,
    pub orders_gen: Generation,
    pub positions: MorphoPositionSnapshot,
    pub positions_gen: Generation,
    pub cost_basis: UserCostBasis,
    pub cost_basis_gen: Generation,
    pub last_scanned_block: u64, // for incremental event scanning (cost basis)
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
    pub issuer_registry: RwLock<Vec<CachedIssuer>>,
    pub issuer_registry_gen: Generation,
    pub last_cycle: AtomicU64,
    pub next_order_id: AtomicU64,
    pub pending_rebalances: RwLock<Vec<CachedPendingRebalance>>,
    pub pending_rebalances_gen: Generation,
    pub active_issuer_count: AtomicU64,
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
            issuer_registry: RwLock::new(Vec::new()),
            issuer_registry_gen: Generation::default(),
            last_cycle: AtomicU64::new(0),
            next_order_id: AtomicU64::new(0),
            pending_rebalances: RwLock::new(Vec::new()),
            pending_rebalances_gen: Generation::default(),
            active_issuer_count: AtomicU64::new(0),
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
        }
    }

    pub async fn get_or_create_user(&self, address: &str) -> Arc<RwLock<UserCache>> {
        let addr = address.to_lowercase();
        {
            let users = self.users.read().await;
            if let Some(u) = users.get(&addr) {
                return Arc::clone(u);
            }
        }
        let mut users = self.users.write().await;
        let entry = users.entry(addr).or_insert_with(|| Arc::new(RwLock::new(UserCache::default())));
        Arc::clone(entry)
    }
}
