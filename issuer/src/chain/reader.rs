//! EthersChainReader implementation using ethers-rs
//!
//! Implements the `ChainReader` trait from common crate to read blockchain state
//! from the Index L3 chain using ethers-rs.

use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use ethers::prelude::*;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn, trace};

use common::bindings;
use common::error::Error;
use common::traits::{ChainEvent, ChainReader, EventFilter, EventStream, PendingRebalance};
use common::types::{Issuer, ITPCore, LimitOrder, OrderStatus, Price, Side};

// Generate contract bindings for Index.sol
abigen!(
    IndexContract,
    r#"[
        function getOrder(uint256 orderId) external view returns (uint256 id, address user, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline, bytes32 itpId, uint256 timestamp, uint8 status)
        function getITP(bytes32 itpId) external view returns (bytes32 name, bytes32 symbol, address creator, uint256 createdAt, uint256 feeRate, uint256 status, uint256 totalSupply, uint256 totalValue, uint256 assetCount)
        function getPrice(uint256 assetIdx) external view returns (uint256 price)
        function batchGetPrices(uint256[] indices) external view returns (uint256[] prices)
        function lastProcessedCycleNumber() external view returns (uint256)
        function nextOrderId() external view returns (uint256)
        event OrderSubmitted(uint256 indexed orderId, address indexed user, bytes32 indexed itpId, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline)
        event FillConfirmed(uint256 indexed orderId, uint256 cycleNumber, uint256 fillPrice, uint256 fillAmount)
        event ITPCreated(bytes32 indexed itpId, address indexed creator, bytes32 name, bytes32 symbol, address[] assets, uint256[] weights)
        event BatchConfirmed(uint256 indexed cycleNumber, uint256[] orderIds, bytes blsSignature)
        event RebalanceRequested(address indexed requester, bytes32 indexed itpId, uint256[] removeIndices, address[] addAssets, uint256[] newWeights, string note)
        function getITPState(bytes32 itpId) external view returns (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
    ]"#
);

// Generate contract bindings for IssuerRegistry.sol
// Note: getIssuer/getIssuers return structs which require special ABI handling;
// those are decoded manually via raw eth_call (see get_issuer_registry).
abigen!(
    IssuerRegistryContract,
    r#"[
        function getAggregatedPubkey() external view returns (bytes)
        function activeIssuerCount() external view returns (uint256)
        function registryNonce() external view returns (uint256)
        function consensusPaused() external view returns (bool)
    ]"#
);

/// Contract addresses for Index L3
#[derive(Debug, Clone)]
pub struct ContractAddresses {
    /// Index.sol contract address
    pub index: Address,
    /// Governance.sol contract address
    pub governance: Address,
    /// IssuerRegistry.sol contract address
    pub issuer_registry: Address,
}

impl Default for ContractAddresses {
    fn default() -> Self {
        Self {
            // Default to zero addresses - must be configured for production
            index: Address::zero(),
            governance: Address::zero(),
            issuer_registry: Address::zero(),
        }
    }
}

/// Configuration for EthersChainReader
#[derive(Debug, Clone)]
pub struct ChainReaderConfig {
    /// RPC endpoint URL
    pub rpc_url: String,
    /// Contract addresses
    pub contracts: ContractAddresses,
    /// Chain ID (111222333 for Index L3)
    pub chain_id: u64,
    /// Maximum number of orders to fetch in a single batch (for pagination)
    pub max_orders_per_batch: u64,
    /// Number of assets in the registry (for price fetching)
    pub asset_count: u64,
    /// Starting block for event scanning (from --from-block CLI arg).
    /// When set, cursors start here instead of block 0.
    pub from_block: Option<u64>,
}

impl Default for ChainReaderConfig {
    fn default() -> Self {
        Self {
            rpc_url: "http://localhost:8545".to_string(),
            contracts: ContractAddresses::default(),
            chain_id: 111222333, // Index L3 Orbit
            max_orders_per_batch: 50,
            asset_count: 0,
            from_block: None,
        }
    }
}

/// Number of blocks to re-scan each cycle to handle chain reorganizations.
/// On L3 with ~1s blocks, this is ~10s of overlap.
const REORG_BUFFER: u64 = 10;

/// ChainReader implementation using ethers-rs
///
/// Connects to the Index L3 chain via RPC and provides methods to read
/// on-chain state including orders, ITPs, prices, and issuers.
///
/// Uses incremental scanning with block cursors and settled-order caches
/// to avoid O(N) full-history scans every cycle.
pub struct EthersChainReader<M: Middleware> {
    provider: Arc<M>,
    config: ChainReaderConfig,
    // Incremental scanning state
    order_cursor: AtomicU64,
    rebalance_cursor: AtomicU64,
    // Caches
    known_order_ids: RwLock<Vec<U256>>,
    settled_order_ids: RwLock<HashSet<U256>>,
    // (new_weights, remove_indices, add_assets, proposed_at_block, return_count)
    known_rebalances: RwLock<std::collections::HashMap<[u8; 32], (Vec<U256>, Vec<U256>, Vec<Address>, u64, u32)>>,
}

impl EthersChainReader<Provider<Http>> {
    /// Create a new EthersChainReader with HTTP provider
    ///
    /// # Arguments
    /// * `config` - Configuration including RPC URL and contract addresses
    ///
    /// # Errors
    /// Returns error if unable to connect to RPC endpoint
    pub fn new(config: ChainReaderConfig) -> Result<Self, Error> {
        let provider = Provider::<Http>::try_from(&config.rpc_url)
            .map_err(|e| Error::ChainRead(format!("Failed to create provider: {}", e)))?;

        let initial_cursor = config.from_block.unwrap_or(0);
        Ok(Self {
            provider: Arc::new(provider),
            config,
            order_cursor: AtomicU64::new(initial_cursor),
            rebalance_cursor: AtomicU64::new(initial_cursor),
            known_order_ids: RwLock::new(Vec::new()),
            settled_order_ids: RwLock::new(HashSet::new()),
            known_rebalances: RwLock::new(std::collections::HashMap::new()),
        })
    }
}

impl<M: Middleware> EthersChainReader<M> {
    /// Create a new EthersChainReader with a custom middleware/provider
    ///
    /// Useful for testing or when using custom middleware (e.g., signing middleware)
    pub fn with_provider(provider: Arc<M>, config: ChainReaderConfig) -> Self {
        let initial_cursor = config.from_block.unwrap_or(0);
        Self {
            provider,
            config,
            order_cursor: AtomicU64::new(initial_cursor),
            rebalance_cursor: AtomicU64::new(initial_cursor),
            known_order_ids: RwLock::new(Vec::new()),
            settled_order_ids: RwLock::new(HashSet::new()),
            known_rebalances: RwLock::new(std::collections::HashMap::new()),
        }
    }

    /// Get the underlying provider
    pub fn provider(&self) -> &Arc<M> {
        &self.provider
    }

    /// Get the configuration
    pub fn config(&self) -> &ChainReaderConfig {
        &self.config
    }

    /// Get the Index contract instance
    fn index_contract(&self) -> IndexContract<M> {
        IndexContract::new(self.config.contracts.index, self.provider.clone())
    }

    /// Get the IssuerRegistry contract instance
    fn issuer_registry_contract(&self) -> IssuerRegistryContract<M> {
        IssuerRegistryContract::new(self.config.contracts.issuer_registry, self.provider.clone())
    }

    /// Convert contract order status to our OrderStatus enum
    fn convert_order_status(status: u8) -> OrderStatus {
        match status {
            0 => OrderStatus::Pending,
            1 => OrderStatus::Batched,
            2 => OrderStatus::Filled,
            3 => OrderStatus::Cancelled,
            4 => OrderStatus::Expired,
            _ => OrderStatus::Pending, // Default to pending for unknown status
        }
    }

    /// Convert contract side to our Side enum
    fn convert_side(side: u8) -> Side {
        match side {
            0 => Side::Buy,
            1 => Side::Sell,
            _ => Side::Buy, // Default to buy for unknown side
        }
    }
}

#[async_trait]
impl<M> ChainReader for EthersChainReader<M>
where
    M: Middleware + 'static,
{
    async fn get_pending_orders(&self) -> Result<Vec<LimitOrder>, Error> {
        let contract = self.index_contract();

        // Get latest block number
        let latest_block = self.provider.get_block_number().await.map_err(|e| {
            Error::ChainRead(format!("Failed to get latest block number: {}", e))
        })?.as_u64();

        // Incremental scan: only query new blocks since last cursor
        let cursor = self.order_cursor.load(Ordering::Relaxed);
        let from_block = cursor.saturating_sub(REORG_BUFFER);

        let filter = contract
            .order_submitted_filter()
            .from_block(from_block)
            .to_block(latest_block);

        let events = filter.query().await.map_err(|e| {
            Error::ChainRead(format!("Failed to query OrderSubmitted events: {}", e))
        })?;

        let new_event_count = events.len();

        // Add newly discovered order IDs to known set
        {
            let mut known = self.known_order_ids.write().await;
            let settled = self.settled_order_ids.read().await;
            for event in &events {
                if !known.contains(&event.order_id) && !settled.contains(&event.order_id) {
                    known.push(event.order_id);
                }
            }
        }

        // Update cursor
        self.order_cursor.store(latest_block, Ordering::Relaxed);

        // Check each unsettled order's current status
        let mut orders = Vec::new();
        let known_ids = self.known_order_ids.read().await.clone();
        let settled = self.settled_order_ids.read().await.clone();
        let mut newly_settled = Vec::new();

        for order_id in &known_ids {
            if settled.contains(order_id) {
                continue;
            }

            match contract.get_order(*order_id).call().await {
                Ok((id, user, pair_id, side, amount, limit_price, slippage_tier, deadline, itp_id, timestamp, status)) => {
                    trace!(order_id = %order_id, status = status, "Order status from getOrder");

                    match status {
                        // Terminal states: cache as settled
                        2 | 3 | 4 => {
                            newly_settled.push(*order_id);
                        }
                        // Pending
                        0 => {
                            let order = LimitOrder {
                                id,
                                user,
                                pair_id: pair_id.into(),
                                side: Self::convert_side(side),
                                amount,
                                limit_price,
                                slippage_tier,
                                deadline,
                                itp_id: itp_id.into(),
                                timestamp,
                                status: Self::convert_order_status(status),
                            };
                            orders.push(order);

                            if orders.len() >= self.config.max_orders_per_batch as usize {
                                debug!(
                                    count = orders.len(),
                                    max = self.config.max_orders_per_batch,
                                    "Reached max orders per batch"
                                );
                                break;
                            }
                        }
                        _ => {}
                    }
                }
                Err(e) => {
                    warn!(code = "INFRA-001", order_id = ?order_id, error = %e, "Failed to fetch order, skipping");
                }
            }
        }

        // Move newly settled orders to the settled cache
        if !newly_settled.is_empty() {
            let mut settled_w = self.settled_order_ids.write().await;
            for id in &newly_settled {
                settled_w.insert(*id);
            }
        }

        let total_known = self.known_order_ids.read().await.len();
        let total_settled = self.settled_order_ids.read().await.len();
        debug!(
            new_events = new_event_count,
            total_known,
            settled = total_settled,
            pending = orders.len(),
            "Order scan complete"
        );
        Ok(orders)
    }

    async fn get_batched_orders(&self) -> Result<Vec<LimitOrder>, Error> {
        // Reuse known_order_ids and settled_order_ids populated by get_pending_orders().
        // Only need to check unsettled orders for status == 1 (Batched).
        let contract = self.index_contract();
        let mut orders = Vec::new();

        let known_ids = self.known_order_ids.read().await.clone();
        let settled = self.settled_order_ids.read().await.clone();
        let mut newly_settled = Vec::new();

        for order_id in &known_ids {
            if settled.contains(order_id) {
                continue;
            }

            match contract.get_order(*order_id).call().await {
                Ok((id, user, pair_id, side, amount, limit_price, slippage_tier, deadline, itp_id, timestamp, status)) => {
                    match status {
                        // Terminal states: cache as settled
                        2 | 3 | 4 => {
                            newly_settled.push(*order_id);
                        }
                        // Batched
                        1 => {
                            let order = LimitOrder {
                                id,
                                user,
                                pair_id: pair_id.into(),
                                side: Self::convert_side(side),
                                amount,
                                limit_price,
                                slippage_tier,
                                deadline,
                                itp_id: itp_id.into(),
                                timestamp,
                                status: Self::convert_order_status(status),
                            };
                            orders.push(order);
                        }
                        _ => {}
                    }
                }
                Err(e) => {
                    warn!(code = "INFRA-001", order_id = ?order_id, error = %e, "Failed to fetch order for batched scan");
                }
            }
        }

        // Move newly settled orders to the settled cache
        if !newly_settled.is_empty() {
            let mut settled_w = self.settled_order_ids.write().await;
            for id in &newly_settled {
                settled_w.insert(*id);
            }
        }

        if !orders.is_empty() {
            debug!(batched_count = orders.len(), "Found BATCHED orders needing fills");
        }
        Ok(orders)
    }

    async fn get_itp(&self, itp_id: [u8; 32]) -> Result<ITPCore, Error> {
        let itp_id_h256 = H256::from(itp_id);
        debug!(
            itp_id = ?itp_id_h256,
            contract = ?self.config.contracts.index,
            "Fetching ITP from Index contract"
        );

        let contract = self.index_contract();

        // Returns tuple: (name, symbol, creator, createdAt, feeRate, status, totalSupply, totalValue, assetCount)
        let (name, symbol, creator, created_at, fee_rate, status, total_supply, total_value, asset_count) = contract
            .get_itp(itp_id.into())
            .call()
            .await
            .map_err(|e| {
                // Check if it's a revert (likely not found)
                let error_msg = e.to_string();
                if error_msg.contains("revert") || error_msg.contains("execution reverted") {
                    Error::NotFound(format!("ITP not found: {:?}", itp_id_h256))
                } else {
                    Error::ChainRead(format!("Failed to fetch ITP: {}", e))
                }
            })?;

        // Check if ITP exists (zero creator address means not found)
        if creator == Address::zero() {
            return Err(Error::NotFound(format!("ITP not found: {:?}", itp_id_h256)));
        }

        let itp = ITPCore {
            name: name.into(),
            symbol: symbol.into(),
            creator,
            created_at,
            fee_rate,
            status,
            total_supply,
            total_value,
            asset_count,
        };

        debug!(itp_id = ?itp_id_h256, "Fetched ITP successfully");
        Ok(itp)
    }

    async fn get_prices(&self) -> Result<Vec<Price>, Error> {
        debug!(
            contract = ?self.config.contracts.index,
            asset_count = self.config.asset_count,
            "Fetching prices from Index contract"
        );

        if self.config.asset_count == 0 {
            warn!(code = "INFRA-001", "Asset count is 0, returning empty price list");
            return Ok(Vec::new());
        }

        let contract = self.index_contract();

        // Create indices array [0, 1, 2, ..., asset_count-1]
        let indices: Vec<U256> = (0..self.config.asset_count)
            .map(U256::from)
            .collect();

        let prices_raw = contract
            .batch_get_prices(indices)
            .call()
            .await
            .map_err(|e| {
                Error::ChainRead(format!("Failed to fetch prices: {}", e))
            })?;

        // Get current timestamp for staleness checking
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let prices: Vec<Price> = prices_raw
            .into_iter()
            .map(|price| Price {
                asset: Address::zero(), // We don't have asset address from this call
                price,
                timestamp: U256::from(timestamp),
                source: U256::from(2u64), // OnChain = 2
            })
            .collect();

        debug!(count = prices.len(), "Fetched prices successfully");
        Ok(prices)
    }

    async fn get_issuer_registry(&self) -> Result<Vec<Issuer>, Error> {
        debug!(
            contract = ?self.config.contracts.issuer_registry,
            "Fetching issuer registry via getActiveIssuerEndpoints()"
        );

        // Call getActiveIssuerEndpoints() which returns (uint256[] ids, bytes32[] ips, bytes[] pubkeys)
        // This only returns active issuers and preserves on-chain IDs.
        let selector = &ethers::utils::keccak256("getActiveIssuerEndpoints()")[..4];
        let call_data = ethers::types::Bytes::from(selector.to_vec());
        let tx = ethers::types::TransactionRequest::new()
            .to(self.config.contracts.issuer_registry)
            .data(call_data);

        let result = self.provider.call(&tx.into(), None).await
            .map_err(|e| Error::ChainRead(format!("Failed to call getActiveIssuerEndpoints: {}", e)))?;

        // Decode ABI: returns (uint256[], bytes32[], bytes[])
        let return_type = vec![
            ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Uint(256))),
            ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::FixedBytes(32))),
            ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Bytes)),
        ];

        let tokens = ethers::abi::decode(&return_type, &result)
            .map_err(|e| Error::ChainRead(format!("Failed to decode getActiveIssuerEndpoints response: {}", e)))?;

        let ids = match tokens.get(0) {
            Some(ethers::abi::Token::Array(arr)) => arr.clone(),
            _ => return Ok(Vec::new()),
        };
        let ips = match tokens.get(1) {
            Some(ethers::abi::Token::Array(arr)) => arr.clone(),
            _ => return Ok(Vec::new()),
        };
        let pubkeys = match tokens.get(2) {
            Some(ethers::abi::Token::Array(arr)) => arr.clone(),
            _ => return Ok(Vec::new()),
        };

        if ids.len() != ips.len() || ids.len() != pubkeys.len() {
            return Err(Error::ChainRead(format!(
                "getActiveIssuerEndpoints array length mismatch: ids={}, ips={}, pubkeys={}",
                ids.len(), ips.len(), pubkeys.len()
            )));
        }

        let mut issuers = Vec::with_capacity(ids.len());
        for i in 0..ids.len() {
            let id = ids[i].clone().into_uint().unwrap_or_default().as_u64();
            let ip_bytes = ips[i].clone().into_fixed_bytes().unwrap_or_default();
            let bls_pubkey = pubkeys[i].clone().into_bytes().unwrap_or_default();

            let mut ip_h256 = [0u8; 32];
            ip_h256.copy_from_slice(&ip_bytes);

            issuers.push(Issuer {
                id,
                addr: Address::zero(),
                ip: ip_h256.into(),
                bls_pubkey: bls_pubkey.into(),
                status: U256::one(),
                registered_at: U256::zero(),
            });
        }

        debug!(count = issuers.len(), "Fetched issuer registry successfully");
        Ok(issuers)
    }

    async fn get_last_processed_cycle(&self) -> Result<u64, Error> {
        debug!(
            contract = ?self.config.contracts.index,
            "Fetching lastProcessedCycleNumber from Index contract"
        );

        let contract = self.index_contract();
        let result = contract
            .last_processed_cycle_number()
            .call()
            .await
            .map_err(|e| {
                Error::ChainRead(format!("Failed to fetch lastProcessedCycleNumber: {}", e))
            })?;

        let cycle = result.as_u64();
        debug!(last_processed_cycle = cycle, "Fetched lastProcessedCycleNumber");
        Ok(cycle)
    }

    async fn get_next_order_id(&self) -> Result<u64, Error> {
        let contract = self.index_contract();
        let result = contract
            .next_order_id()
            .call()
            .await
            .map_err(|e| {
                Error::ChainRead(format!("Failed to fetch nextOrderId: {}", e))
            })?;

        Ok(result.as_u64())
    }

    async fn get_pending_rebalances(&self) -> Result<Vec<PendingRebalance>, Error> {
        let contract = self.index_contract();

        // Get latest block number
        let latest_block = self.provider.get_block_number().await.map_err(|e| {
            Error::ChainRead(format!("Failed to get latest block number: {}", e))
        })?.as_u64();

        // Incremental scan: only query new blocks since last cursor
        let cursor = self.rebalance_cursor.load(Ordering::Relaxed);
        let from_block = cursor.saturating_sub(REORG_BUFFER);

        let filter = contract
            .rebalance_requested_filter()
            .from_block(from_block)
            .to_block(latest_block);

        let events = filter.query_with_meta().await.map_err(|e| {
            Error::ChainRead(format!("Failed to query RebalanceRequested events: {}", e))
        })?;

        let new_event_count = events.len();

        // Update known_rebalances cache with new events (keep latest per ITP)
        {
            let mut known = self.known_rebalances.write().await;
            for (event, meta) in &events {
                let itp_id: [u8; 32] = event.itp_id.into();
                let block = meta.block_number.as_u64();
                let entry = known.entry(itp_id).or_insert_with(|| {
                    (event.new_weights.clone(), event.remove_indices.clone(), event.add_assets.clone(), block, 0)
                });
                if block > entry.3 {
                    // New event for this ITP — reset return count since it's a fresh request
                    *entry = (event.new_weights.clone(), event.remove_indices.clone(), event.add_assets.clone(), block, 0);
                }
            }
        }

        // Update cursor
        self.rebalance_cursor.store(latest_block, Ordering::Relaxed);

        let known = self.known_rebalances.read().await.clone();
        if known.is_empty() {
            return Ok(Vec::new());
        }

        // Check each known rebalance — remove completed ones, collect pending
        let mut pending = Vec::new();
        let mut completed_itps = Vec::new();

        for (itp_id, (new_weights, remove_indices, add_assets, proposed_at_block, return_count)) in &known {
            warn!(
                itp_id = ?H256::from(*itp_id),
                return_count,
                proposed_at_block,
                latest_block,
                "Checking rebalance"
            );
            // Skip stale rebalances older than ~2 hours (~7200 blocks at 1s/block)
            if latest_block > *proposed_at_block && latest_block - *proposed_at_block > 7200 {
                info!(
                    itp_id = ?H256::from(*itp_id),
                    age_blocks = latest_block - *proposed_at_block,
                    "Rebalance too old (>7200 blocks), removing stale entry from cache"
                );
                completed_itps.push(*itp_id);
                continue;
            }

            // Skip rebalances that have been returned too many times without resolution.
            // This prevents infinite retry loops when assets have no price mappings.
            if *return_count > 10 {
                warn!(
                    itp_id = ?H256::from(*itp_id),
                    return_count,
                    "Rebalance stalled (returned >10 times without resolution), removing from cache"
                );
                completed_itps.push(*itp_id);
                continue;
            }

            match contract.get_itp_state(*itp_id).call().await {
                Ok((_creator, _total_supply, _nav, assets, current_weights, _inventory)) => {
                    if current_weights == *new_weights && remove_indices.is_empty() && add_assets.is_empty() {
                        debug!(
                            itp_id = ?H256::from(*itp_id),
                            "Rebalance already executed (weights match target), removing from cache"
                        );
                        completed_itps.push(*itp_id);
                        continue;
                    }

                    pending.push(PendingRebalance {
                        itp_id: *itp_id,
                        new_weights: new_weights.clone(),
                        proposed_at_block: *proposed_at_block,
                        new_inventory: vec![],
                        nav: U256::zero(),
                        remove_indices: remove_indices.clone(),
                        add_assets: add_assets.clone(),
                        current_assets: assets,
                    });
                }
                Err(e) => {
                    warn!(itp_id = ?H256::from(*itp_id), error = %e, "Failed to get ITP state, using event data");
                    pending.push(PendingRebalance {
                        itp_id: *itp_id,
                        new_weights: new_weights.clone(),
                        proposed_at_block: *proposed_at_block,
                        new_inventory: vec![],
                        nav: U256::zero(),
                        remove_indices: remove_indices.clone(),
                        add_assets: add_assets.clone(),
                        current_assets: vec![],
                    });
                }
            }
        }

        // Remove completed rebalances from cache and increment return count for pending ones
        {
            let mut known_w = self.known_rebalances.write().await;
            for itp_id in &completed_itps {
                known_w.remove(itp_id);
            }
            // Increment return count for each ITP that was returned as pending
            for rebalance in &pending {
                if let Some(entry) = known_w.get_mut(&rebalance.itp_id) {
                    entry.4 += 1;
                }
            }
        }

        let cached_count = self.known_rebalances.read().await.len();
        debug!(
            new_events = new_event_count,
            cached = cached_count,
            pending = pending.len(),
            "Rebalance scan complete"
        );
        Ok(pending)
    }

    async fn subscribe_events(&self, filter: EventFilter) -> Result<EventStream, Error> {
        debug!(
            ?filter,
            "Subscribing to events"
        );

        let provider = self.provider.clone();
        let index_address = self.config.contracts.index;

        // Build ethers log filter
        let mut log_filter = Filter::new();

        // Set address filter
        if let Some(address) = filter.address {
            log_filter = log_filter.address(Address::from(address));
        } else {
            // Default to Index contract address
            log_filter = log_filter.address(index_address);
        }

        // Set block range
        if let Some(from) = filter.from_block {
            log_filter = log_filter.from_block(from);
        }
        if let Some(to) = filter.to_block {
            log_filter = log_filter.to_block(to);
        }

        // Set topics filter
        if !filter.topics.is_empty() {
            // First topic is the event signature
            log_filter = log_filter.topic0(H256::from(filter.topics[0]));
        }

        // Build a base filter without block range for the polling loop
        let mut base_filter = Filter::new();
        if let Some(address) = filter.address {
            base_filter = base_filter.address(Address::from(address));
        } else {
            base_filter = base_filter.address(index_address);
        }
        if !filter.topics.is_empty() {
            base_filter = base_filter.topic0(H256::from(filter.topics[0]));
        }

        // Create the event stream with polling for new events
        let stream = async_stream::stream! {
            // Fetch historical logs first
            let mut last_block: u64 = match provider.get_logs(&log_filter).await {
                Ok(logs) => {
                    let mut max_block = filter.from_block.unwrap_or(0);
                    for log in &logs {
                        if let Some(bn) = log.block_number {
                            let bn_u64 = bn.as_u64();
                            if bn_u64 > max_block {
                                max_block = bn_u64;
                            }
                        }
                    }
                    for log in logs {
                        if let Some(event) = parse_log_to_event(&log) {
                            yield Ok(event);
                        }
                    }
                    max_block
                }
                Err(e) => {
                    error!(code = "INFRA-001", error = %e, "Failed to fetch historical logs");
                    yield Err(Error::ChainRead(format!("Failed to fetch logs: {}", e)));
                    return;
                }
            };

            debug!(last_block, "Historical log fetch complete, starting polling loop");

            // Poll for new events every 2 seconds
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;

                let poll_filter = base_filter.clone()
                    .from_block(last_block + 1)
                    .to_block(ethers::types::BlockNumber::Latest);

                match provider.get_logs(&poll_filter).await {
                    Ok(logs) => {
                        for log in &logs {
                            if let Some(bn) = log.block_number {
                                let bn_u64 = bn.as_u64();
                                if bn_u64 > last_block {
                                    last_block = bn_u64;
                                }
                            }
                        }
                        for log in logs {
                            if let Some(event) = parse_log_to_event(&log) {
                                yield Ok(event);
                            }
                        }
                    }
                    Err(e) => {
                        warn!(code = "INFRA-001", error = %e, last_block, "Failed to poll for new logs, retrying");
                    }
                }
            }
        };

        Ok(Box::pin(stream))
    }

    async fn get_itp_inventory_state(&self, itp_id: [u8; 32]) -> Result<common::traits::ItpInventoryState, Error> {
        let contract = self.index_contract();

        let (_creator, _total_supply, nav, assets, _weights, inventory) =
            contract.get_itp_state(itp_id).call().await.map_err(|e| {
                Error::ChainRead(format!("getITPState call failed: {}", e))
            })?;

        Ok(common::traits::ItpInventoryState {
            assets,
            quantities: inventory,
            nav,
        })
    }

    async fn get_active_issuer_count(&self) -> Result<u64, Error> {
        let contract = self.issuer_registry_contract();
        let result = contract
            .active_issuer_count()
            .call()
            .await
            .map_err(|e| {
                Error::ChainRead(format!("Failed to fetch activeIssuerCount: {}", e))
            })?;

        let count = result.as_u64();
        debug!(active_issuer_count = count, "Fetched activeIssuerCount from IssuerRegistry");
        Ok(count)
    }

    async fn get_registry_nonce(&self) -> Result<u64, Error> {
        let contract = self.issuer_registry_contract();
        let result = contract
            .registry_nonce()
            .call()
            .await
            .map_err(|e| {
                Error::ChainRead(format!("Failed to fetch registryNonce: {}", e))
            })?;

        let nonce = result.as_u64();
        debug!(registry_nonce = nonce, "Fetched registryNonce from IssuerRegistry");
        Ok(nonce)
    }

    async fn get_aggregated_pubkey(&self) -> Result<Vec<u8>, Error> {
        let contract = self.issuer_registry_contract();
        let result = contract
            .get_aggregated_pubkey()
            .call()
            .await
            .map_err(|e| {
                Error::ChainRead(format!("Failed to fetch getAggregatedPubkey: {}", e))
            })?;

        debug!(aggregated_pubkey_len = result.len(), "Fetched aggregated pubkey from IssuerRegistry");
        Ok(result.to_vec())
    }

    async fn is_consensus_paused(&self) -> Result<bool, Error> {
        let contract = self.issuer_registry_contract();
        contract.consensus_paused().call().await
            .map_err(|e| Error::ChainRead(format!("Failed to fetch consensusPaused: {}", e)))
    }
}

/// Parse a raw log into a ChainEvent
fn parse_log_to_event(log: &Log) -> Option<ChainEvent> {
    // Get event signature from first topic
    let signature = log.topics.first()?;

    // Compute event signatures for matching
    let order_submitted_sig = ethers::utils::keccak256(bindings::ORDER_SUBMITTED_SIGNATURE);
    let fill_confirmed_sig = ethers::utils::keccak256(bindings::FILL_CONFIRMED_SIGNATURE);
    let itp_created_sig = ethers::utils::keccak256(bindings::ITP_CREATED_SIGNATURE);
    let batch_confirmed_sig = ethers::utils::keccak256(bindings::BATCH_CONFIRMED_SIGNATURE);

    if signature.as_bytes() == order_submitted_sig {
        // Parse OrderSubmitted event
        // Indexed: orderId, user
        // Data: itpId, pairId, side, amount, limitPrice, slippageTier, deadline
        let order_id = log.topics.get(1)?.to_low_u64_be();
        let user: [u8; 20] = log.topics.get(2)?[12..32].try_into().ok()?;
        let itp_id: [u8; 32] = log.data.get(0..32)?.try_into().ok()?;

        Some(ChainEvent::OrderSubmitted {
            order_id,
            user,
            itp_id,
        })
    } else if signature.as_bytes() == fill_confirmed_sig {
        // Parse FillConfirmed event
        // Indexed: orderId
        // Data: cycleNumber, fillPrice, fillAmount
        let order_id = log.topics.get(1)?.to_low_u64_be();
        let fill_price = U256::from_big_endian(log.data.get(32..64)?);
        let fill_amount = U256::from_big_endian(log.data.get(64..96)?);

        Some(ChainEvent::FillConfirmed {
            order_id,
            fill_price,
            fill_amount,
        })
    } else if signature.as_bytes() == itp_created_sig {
        // Parse ITPCreated event
        // Indexed: itpId, creator
        // Data: name, symbol, assets, weights
        let itp_id: [u8; 32] = log.topics.get(1)?.as_bytes().try_into().ok()?;
        let name_bytes: [u8; 32] = log.data.get(0..32)?.try_into().ok()?;
        let symbol_bytes: [u8; 32] = log.data.get(32..64)?.try_into().ok()?;

        // Convert bytes32 to string (trim trailing zeros)
        let name = String::from_utf8_lossy(&name_bytes)
            .trim_end_matches('\0')
            .to_string();
        let symbol = String::from_utf8_lossy(&symbol_bytes)
            .trim_end_matches('\0')
            .to_string();

        Some(ChainEvent::ITPCreated {
            itp_id,
            name,
            symbol,
        })
    } else if signature.as_bytes() == batch_confirmed_sig {
        // Parse BatchConfirmed event
        // Indexed: cycleNumber
        // Data: orderIds, blsSignature
        let cycle_number = log.topics.get(1)?.to_low_u64_be();

        // For simplicity, we don't parse the full orderIds array
        // Just return the count based on data length estimate
        let order_count = if log.data.len() >= 64 {
            // First 32 bytes is offset to array, next 32 is length
            U256::from_big_endian(log.data.get(32..64).unwrap_or(&[0; 32])).as_u64()
        } else {
            0
        };

        Some(ChainEvent::BatchConfirmed {
            cycle_number,
            order_count,
        })
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::mocks::MockChainBuilder;
    use common::traits::ChainReader as ChainReaderTrait;

    #[test]
    fn test_default_config() {
        let config = ChainReaderConfig::default();
        assert_eq!(config.rpc_url, "http://localhost:8545");
        assert_eq!(config.chain_id, 111222333);
        assert_eq!(config.contracts.index, Address::zero());
        assert_eq!(config.max_orders_per_batch, 50);
    }

    #[test]
    fn test_contract_addresses_default() {
        let addresses = ContractAddresses::default();
        assert_eq!(addresses.index, Address::zero());
        assert_eq!(addresses.governance, Address::zero());
        assert_eq!(addresses.issuer_registry, Address::zero());
    }

    #[test]
    fn test_convert_order_status() {
        assert_eq!(EthersChainReader::<Provider<Http>>::convert_order_status(0), OrderStatus::Pending);
        assert_eq!(EthersChainReader::<Provider<Http>>::convert_order_status(1), OrderStatus::Batched);
        assert_eq!(EthersChainReader::<Provider<Http>>::convert_order_status(2), OrderStatus::Filled);
        assert_eq!(EthersChainReader::<Provider<Http>>::convert_order_status(3), OrderStatus::Cancelled);
        assert_eq!(EthersChainReader::<Provider<Http>>::convert_order_status(4), OrderStatus::Expired);
        assert_eq!(EthersChainReader::<Provider<Http>>::convert_order_status(255), OrderStatus::Pending);
    }

    #[test]
    fn test_convert_side() {
        assert_eq!(EthersChainReader::<Provider<Http>>::convert_side(0), Side::Buy);
        assert_eq!(EthersChainReader::<Provider<Http>>::convert_side(1), Side::Sell);
        assert_eq!(EthersChainReader::<Provider<Http>>::convert_side(255), Side::Buy);
    }

    // Integration tests using MockChain
    #[tokio::test]
    async fn test_mock_chain_get_pending_orders() {
        let mock = MockChainBuilder::new().build();
        let orders = mock.get_pending_orders().await.unwrap();
        assert!(orders.is_empty());
    }

    #[tokio::test]
    async fn test_mock_chain_get_itp_not_found() {
        let mock = MockChainBuilder::new().build();
        let result = mock.get_itp([0u8; 32]).await;
        assert!(result.is_err());
        match result {
            Err(Error::NotFound(_)) => {}
            _ => panic!("Expected NotFound error"),
        }
    }

    #[tokio::test]
    async fn test_mock_chain_get_prices() {
        let mock = MockChainBuilder::new().build();
        let prices = mock.get_prices().await.unwrap();
        assert!(prices.is_empty());
    }

    #[tokio::test]
    async fn test_mock_chain_get_issuer_registry() {
        let mock = MockChainBuilder::new().build();
        let issuers = mock.get_issuer_registry().await.unwrap();
        assert!(issuers.is_empty());
    }

    #[tokio::test]
    async fn test_mock_chain_failure_injection() {
        use common::mocks::MockError;

        let mock = MockChainBuilder::new().build();
        mock.set_next_error(MockError::SimulatedFailure(1.0)).await;

        let result = mock.get_pending_orders().await;
        assert!(result.is_err());
    }
}
