//! Settlement Chain Reader for BridgeProxy events (Story 6.21) and CrossChainOrder events (Story 7.1)
//!
//! Provides functionality to poll Settlement for ITP creation events from the BridgeProxy contract
//! and cross-chain order events from the SettlementBridgeCustody contract.
//! Uses ethers-rs to interact with Settlement RPC endpoints.
//!
//! ## Decimal Handling (Story 7-6b)
//!
//! All amounts returned from this reader are in **18-decimal internal format**.
//! The SettlementBridgeCustody contract converts user-provided 6-decimal USDC to 18-decimal
//! at order creation time. Events and view functions return normalized 18-decimal values.
//!
//! Events:
//! - `CreateItpRequested` - User requests ITP creation on Settlement
//! - `ItpCreated` - ITP creation completed with bridged token deployed
//! - `CrossChainOrderCreated` - User initiates ITP purchase from Settlement (Story 7.1)

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use async_trait::async_trait;
use ethers::prelude::*;
use tokio::sync::RwLock;
use tracing::{debug, warn, info};

// CrossChainOrderReader impl moved to settlement_trait.rs (blanket on dyn SettlementReader)
use common::types::CrossChainSellOrderData;
use crate::chain::events::{
    CrossChainOrder, CrossChainOrderData, CrossChainOrderEvent, CrossChainOrderParseError,
    CrossChainSellOrderEvent, cross_chain_sell_order_topic,
    cross_chain_event_into_full_order, cross_chain_order_is_expired_at,
    cross_chain_order_log_if_suspicious_amount,
    parse_create_itp_requested, parse_itp_created,
    parse_cross_chain_order_event, parse_cross_chain_sell_order_event,
    validate_itp_creation_request,
    ItpCreatedEvent, ItpCreationRequest, ParseError, CREATE_ITP_REQUESTED_SIGNATURE,
    CROSS_CHAIN_ORDER_CREATED_SIGNATURE,
    ITP_CREATED_SIGNATURE,
};

/// Configuration for SettlementChainReader
#[derive(Debug, Clone)]
pub struct SettlementChainReaderConfig {
    /// Settlement RPC endpoint URL
    pub rpc_url: String,
    /// BridgeProxy contract address on Settlement
    pub bridge_proxy_address: Address,
    /// SettlementBridgeCustody contract address on Settlement (for cross-chain orders)
    pub settlement_custody_address: Address,
    /// Chain ID (42161 for Settlement chain, 421614 for Sepolia)
    pub chain_id: u64,
    /// Number of confirmations required before considering an event finalized (default: 3 for cross-chain safety)
    pub confirmations: u64,
    /// Maximum blocks to query in a single getLogs request
    pub max_block_range: u64,
}

impl Default for SettlementChainReaderConfig {
    fn default() -> Self {
        Self {
            rpc_url: "https://arb1.arbitrum.io/rpc".to_string(),
            bridge_proxy_address: Address::zero(),
            settlement_custody_address: Address::zero(),
            chain_id: 42161,
            confirmations: 3, // 3 confirmations for cross-chain safety (Story 7.1 AC#8)
            max_block_range: 10_000,
        }
    }
}

/// Max retries before permanently skipping a cross-chain order.
/// After this many failed processing attempts, the order is marked as "seen"
/// and won't be retried. Prevents infinite retry loops for permanently invalid orders.
const MAX_ORDER_RETRIES: u8 = 5;

/// Settlement Chain Reader for BridgeProxy and SettlementBridgeCustody events
///
/// Polls Settlement for ITP creation events and cross-chain order events,
/// parsing and validating them for consensus processing.
pub struct SettlementChainReader<M: Middleware> {
    provider: Arc<M>,
    config: SettlementChainReaderConfig,
    create_itp_topic: H256,
    itp_created_topic: H256,
    cross_chain_order_topic: H256,
    cross_chain_sell_order_topic: H256,
    /// Completed cross-chain orders for deduplication: (chain_id, order_id)
    /// Orders are only marked here AFTER successful processing (bridge+submit).
    /// Uses RwLock for interior mutability so methods can take &self
    seen_orders: RwLock<HashSet<(u64, U256)>>,
    /// Completed cross-chain sell orders for deduplication: (chain_id, order_id)
    seen_sell_orders: RwLock<HashSet<(u64, U256)>>,
    /// Retry counter per order: (chain_id, order_id) → attempt count
    /// Orders that fail repeatedly are skipped after MAX_RETRIES attempts.
    retry_counts: RwLock<HashMap<(u64, U256), u8>>,
    /// Retry counter per sell order: (chain_id, order_id) → attempt count
    retry_sell_counts: RwLock<HashMap<(u64, U256), u8>>,
}

impl SettlementChainReader<Provider<Http>> {
    /// Create a new SettlementChainReader with HTTP provider
    ///
    /// # Arguments
    /// * `config` - Configuration including RPC URL and contract address
    ///
    /// # Errors
    /// Returns error if unable to connect to RPC endpoint
    pub fn new(config: SettlementChainReaderConfig) -> Result<Self, SettlementReaderError> {
        let provider = Provider::<Http>::try_from(&config.rpc_url)
            .map_err(|e| SettlementReaderError::ProviderError(e.to_string()))?;

        Ok(Self::with_provider(Arc::new(provider), config))
    }
}

impl<M: Middleware> SettlementChainReader<M> {
    /// Create a new SettlementChainReader with a custom provider
    pub fn with_provider(provider: Arc<M>, config: SettlementChainReaderConfig) -> Self {
        // Compute event topic hashes
        let create_itp_topic = H256::from_slice(&ethers::utils::keccak256(
            CREATE_ITP_REQUESTED_SIGNATURE,
        ));
        let itp_created_topic =
            H256::from_slice(&ethers::utils::keccak256(ITP_CREATED_SIGNATURE));
        let cross_chain_order_topic =
            H256::from_slice(&ethers::utils::keccak256(CROSS_CHAIN_ORDER_CREATED_SIGNATURE));
        let cross_chain_sell_order_topic = cross_chain_sell_order_topic();

        Self {
            provider,
            config,
            create_itp_topic,
            itp_created_topic,
            cross_chain_order_topic,
            cross_chain_sell_order_topic,
            seen_orders: RwLock::new(HashSet::new()),
            seen_sell_orders: RwLock::new(HashSet::new()),
            retry_counts: RwLock::new(HashMap::new()),
            retry_sell_counts: RwLock::new(HashMap::new()),
        }
    }

    /// Get the provider reference
    pub fn provider(&self) -> &Arc<M> {
        &self.provider
    }

    /// Get the configuration
    pub fn config(&self) -> &SettlementChainReaderConfig {
        &self.config
    }

    /// Get the current confirmed block number
    ///
    /// Returns the latest block number minus confirmations
    pub async fn get_confirmed_block(&self) -> Result<u64, SettlementReaderError> {
        let latest = self.provider.get_block_number().await.map_err(|e| {
            SettlementReaderError::ProviderError(format!("Failed to get block number: {}", e))
        })?;

        let confirmed = latest
            .as_u64()
            .saturating_sub(self.config.confirmations);
        Ok(confirmed)
    }

    /// Get CreateItpRequested events in a block range
    ///
    /// # Arguments
    /// * `from_block` - Starting block number (inclusive)
    /// * `to_block` - Ending block number (inclusive)
    ///
    /// # Returns
    /// Vector of parsed and validated ITP creation requests
    pub async fn get_create_itp_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<ItpCreationRequest>, SettlementReaderError> {
        if from_block > to_block {
            return Ok(Vec::new());
        }

        debug!(
            from_block,
            to_block,
            bridge_proxy = ?self.config.bridge_proxy_address,
            "Fetching CreateItpRequested events"
        );

        let filter = Filter::new()
            .address(self.config.bridge_proxy_address)
            .topic0(self.create_itp_topic)
            .from_block(from_block)
            .to_block(to_block);

        let logs = self.provider.get_logs(&filter).await.map_err(|e| {
            SettlementReaderError::ProviderError(format!("Failed to get logs: {}", e))
        })?;

        debug!(
            count = logs.len(),
            from_block,
            to_block,
            "Retrieved CreateItpRequested logs"
        );

        let mut requests = Vec::with_capacity(logs.len());
        for log in logs {
            match parse_create_itp_requested(&log) {
                Ok(request) => {
                    // Validate the request
                    if let Err(e) = validate_itp_creation_request(&request) {
                        warn!(
                            nonce = %request.nonce,
                            error = %e,
                            "CreateItpRequested failed validation, skipping"
                        );
                        continue;
                    }
                    debug!(
                        nonce = %request.nonce,
                        admin = ?request.admin,
                        name = %request.name,
                        "Parsed CreateItpRequested event"
                    );
                    requests.push(request);
                }
                Err(e) => {
                    warn!(
                        code = "INFRA-001",
                        error = %e,
                        tx_hash = ?log.transaction_hash,
                        "Failed to parse CreateItpRequested event"
                    );
                }
            }
        }

        Ok(requests)
    }

    /// Get ItpCreated events in a block range (for completion detection)
    ///
    /// # Arguments
    /// * `from_block` - Starting block number (inclusive)
    /// * `to_block` - Ending block number (inclusive)
    ///
    /// # Returns
    /// Vector of parsed ITP created events
    pub async fn get_itp_created_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<ItpCreatedEvent>, SettlementReaderError> {
        if from_block > to_block {
            return Ok(Vec::new());
        }

        debug!(
            from_block,
            to_block,
            bridge_proxy = ?self.config.bridge_proxy_address,
            "Fetching ItpCreated events"
        );

        let filter = Filter::new()
            .address(self.config.bridge_proxy_address)
            .topic0(self.itp_created_topic)
            .from_block(from_block)
            .to_block(to_block);

        let logs = self.provider.get_logs(&filter).await.map_err(|e| {
            SettlementReaderError::ProviderError(format!("Failed to get logs: {}", e))
        })?;

        debug!(
            count = logs.len(),
            from_block,
            to_block,
            "Retrieved ItpCreated logs"
        );

        let mut events = Vec::with_capacity(logs.len());
        for log in logs {
            match parse_itp_created(&log) {
                Ok(event) => {
                    debug!(
                        nonce = %event.nonce,
                        orbit_itp_id = ?event.orbit_itp_id,
                        bridged_itp = ?event.bridged_itp_address,
                        "Parsed ItpCreated event"
                    );
                    events.push(event);
                }
                Err(e) => {
                    warn!(
                        code = "INFRA-001",
                        error = %e,
                        tx_hash = ?log.transaction_hash,
                        "Failed to parse ItpCreated event"
                    );
                }
            }
        }

        Ok(events)
    }

    /// Check if a specific nonce is pending (exists and not completed)
    ///
    /// # Arguments
    /// * `nonce` - Request nonce to check
    ///
    /// # Returns
    /// `true` if the request is pending, `false` otherwise
    pub async fn is_pending(&self, nonce: U256) -> Result<bool, SettlementReaderError> {
        // Call isPending(uint256) on BridgeProxy
        let selector = &ethers::utils::keccak256("isPending(uint256)")[..4];
        let mut call_data = selector.to_vec();
        let mut nonce_bytes = [0u8; 32];
        nonce.to_big_endian(&mut nonce_bytes);
        call_data.extend_from_slice(&nonce_bytes);

        let tx = TransactionRequest::new()
            .to(self.config.bridge_proxy_address)
            .data(call_data);

        let result = self.provider.call(&tx.into(), None).await.map_err(|e| {
            SettlementReaderError::ProviderError(format!("Failed to call isPending: {}", e))
        })?;

        // Decode bool result (last byte of 32-byte word)
        if result.len() >= 32 {
            Ok(result[31] != 0)
        } else {
            Err(SettlementReaderError::DecodeError(
                "isPending returned invalid data".to_string(),
            ))
        }
    }

    /// Get the next creation nonce from BridgeProxy
    ///
    /// # Returns
    /// The next nonce that will be assigned to a new request
    pub async fn get_next_nonce(&self) -> Result<U256, SettlementReaderError> {
        let selector = &ethers::utils::keccak256("nextCreationNonce()")[..4];
        let call_data = selector.to_vec();

        let tx = TransactionRequest::new()
            .to(self.config.bridge_proxy_address)
            .data(call_data);

        let result = self.provider.call(&tx.into(), None).await.map_err(|e| {
            SettlementReaderError::ProviderError(format!(
                "Failed to call nextCreationNonce: {}",
                e
            ))
        })?;

        if result.len() >= 32 {
            Ok(U256::from_big_endian(&result[..32]))
        } else {
            Err(SettlementReaderError::DecodeError(
                "nextCreationNonce returned invalid data".to_string(),
            ))
        }
    }

    /// Get pending creation details for a specific nonce
    ///
    /// # Arguments
    /// * `nonce` - Request nonce
    ///
    /// # Returns
    /// Tuple of (admin, name, symbol, weights, assets, createdAt, completed)
    /// Returns None if the request doesn't exist
    pub async fn get_pending_creation(
        &self,
        nonce: U256,
    ) -> Result<Option<ItpCreationRequest>, SettlementReaderError> {
        // First check if pending
        if !self.is_pending(nonce).await? {
            return Ok(None);
        }

        // Call getPendingCreation(uint256)
        let selector = &ethers::utils::keccak256(
            "getPendingCreation(uint256)",
        )[..4];
        let mut call_data = selector.to_vec();
        let mut nonce_bytes = [0u8; 32];
        nonce.to_big_endian(&mut nonce_bytes);
        call_data.extend_from_slice(&nonce_bytes);

        let tx = TransactionRequest::new()
            .to(self.config.bridge_proxy_address)
            .data(call_data);

        let result = self.provider.call(&tx.into(), None).await.map_err(|e| {
            SettlementReaderError::ProviderError(format!(
                "Failed to call getPendingCreation: {}",
                e
            ))
        })?;

        // Decode the tuple response
        // (address admin, string name, string symbol, uint256[] weights, address[] assets, uint64 createdAt, bool completed)
        parse_pending_creation_response(&result, nonce)
    }

    /// Get all pending requests by checking nonces from 0 to nextNonce
    ///
    /// This is a STATELESS operation that queries the chain fresh each time.
    ///
    /// # Returns
    /// Vector of all pending ITP creation requests
    pub async fn get_all_pending_requests(
        &self,
    ) -> Result<Vec<ItpCreationRequest>, SettlementReaderError> {
        let next_nonce = self.get_next_nonce().await?;
        let max_nonce = next_nonce.as_u64();

        debug!(
            next_nonce = max_nonce,
            "Scanning for pending requests"
        );

        let mut pending = Vec::new();

        for i in 0..max_nonce {
            let nonce = U256::from(i);
            if let Some(request) = self.get_pending_creation(nonce).await? {
                pending.push(request);
            }
        }

        debug!(
            pending_count = pending.len(),
            total_nonces = max_nonce,
            "Found pending ITP creation requests"
        );

        Ok(pending)
    }

    // ============ Story 7.1: CrossChainOrder Event Handling ============

    /// Get CrossChainOrderCreated events in a block range from SettlementBridgeCustody
    ///
    /// # Arguments
    /// * `from_block` - Starting block number (inclusive)
    /// * `to_block` - Ending block number (inclusive)
    ///
    /// # Returns
    /// Vector of parsed CrossChainOrderEvent (partial data from events only)
    pub async fn get_cross_chain_order_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CrossChainOrderEvent>, SettlementReaderError> {
        if from_block > to_block {
            return Ok(Vec::new());
        }

        // Ensure we have a valid custody address
        if self.config.settlement_custody_address.is_zero() {
            return Err(SettlementReaderError::ConfigError(
                "settlement_custody_address not configured".to_string(),
            ));
        }

        debug!(
            from_block,
            to_block,
            settlement_custody = ?self.config.settlement_custody_address,
            "Fetching CrossChainOrderCreated events"
        );

        let filter = Filter::new()
            .address(self.config.settlement_custody_address)
            .topic0(self.cross_chain_order_topic)
            .from_block(from_block)
            .to_block(to_block);

        let logs = self.provider.get_logs(&filter).await.map_err(|e| {
            SettlementReaderError::ProviderError(format!("Failed to get logs: {}", e))
        })?;

        debug!(
            count = logs.len(),
            from_block,
            to_block,
            "Retrieved CrossChainOrderCreated logs"
        );

        let mut events = Vec::with_capacity(logs.len());
        for log in logs {
            match parse_cross_chain_order_event(&log) {
                Ok(event) => {
                    debug!(
                        order_id = %event.order_id,
                        itp_id = ?event.itp_id,
                        user = ?event.user,
                        amount = %event.amount,
                        "Parsed CrossChainOrderCreated event"
                    );
                    events.push(event);
                }
                Err(e) => {
                    warn!(
                        code = "ORDER-002",
                        error = %e,
                        tx_hash = ?log.transaction_hash,
                        "Failed to parse CrossChainOrderCreated event"
                    );
                }
            }
        }

        Ok(events)
    }

    /// Get full CrossChainOrder details by order ID from SettlementBridgeCustody
    ///
    /// Calls `getCrossChainOrder(uint256 orderId)` on the SettlementBridgeCustody contract
    /// to fetch full order parameters including limitPrice, deadline, and createdAt.
    ///
    /// # Arguments
    /// * `order_id` - The order ID to query
    ///
    /// # Returns
    /// Full order data, or None if order doesn't exist (user address is zero)
    pub async fn get_cross_chain_order(
        &self,
        order_id: U256,
    ) -> Result<Option<CrossChainOrderData>, SettlementReaderError> {
        // Ensure we have a valid custody address
        if self.config.settlement_custody_address.is_zero() {
            return Err(SettlementReaderError::ConfigError(
                "settlement_custody_address not configured".to_string(),
            ));
        }

        // Build function selector: keccak256("getCrossChainOrder(uint256)")[0:4]
        let selector = &ethers::utils::keccak256("getCrossChainOrder(uint256)")[..4];
        let mut call_data = selector.to_vec();

        // Encode order_id parameter
        let mut order_id_bytes = [0u8; 32];
        order_id.to_big_endian(&mut order_id_bytes);
        call_data.extend_from_slice(&order_id_bytes);

        let tx = TransactionRequest::new()
            .to(self.config.settlement_custody_address)
            .data(call_data);

        let result = self.provider.call(&tx.into(), None).await.map_err(|e| {
            SettlementReaderError::ProviderError(format!("Failed to call getCrossChainOrder: {}", e))
        })?;

        // Parse the response
        parse_cross_chain_order_response(&result, order_id)
    }

    /// Query a single cross-chain sell order by ID from SettlementBridgeCustody.
    /// Returns None if the order has been deleted (user = address(0)).
    pub async fn get_cross_chain_sell_order(
        &self,
        order_id: U256,
    ) -> Result<Option<CrossChainSellOrderData>, SettlementReaderError> {
        if self.config.settlement_custody_address.is_zero() {
            return Err(SettlementReaderError::ConfigError(
                "settlement_custody_address not configured".to_string(),
            ));
        }

        // getCrossChainSellOrder(uint256) selector
        let selector = &ethers::utils::keccak256("getCrossChainSellOrder(uint256)")[..4];
        let mut call_data = selector.to_vec();
        let mut order_id_bytes = [0u8; 32];
        order_id.to_big_endian(&mut order_id_bytes);
        call_data.extend_from_slice(&order_id_bytes);

        let tx = TransactionRequest::new()
            .to(self.config.settlement_custody_address)
            .data(call_data);

        let result = self.provider.call(&tx.into(), None).await.map_err(|e| {
            SettlementReaderError::ProviderError(format!("Failed to call getCrossChainSellOrder: {}", e))
        })?;

        // ABI: itpId(32) + user(32) + bridgedItpAddress(32) + amount(32) + limitPrice(32)
        //      + slippageTier(32) + deadline(32) + createdAt(32) + burned(32) + burnedAt(32) = 320 bytes
        if result.len() < 320 {
            return Ok(None);
        }
        let user = Address::from_slice(&result[44..64]);
        if user.is_zero() {
            return Ok(None); // Deleted order
        }

        Ok(Some(CrossChainSellOrderData {
            itp_id: H256::from_slice(&result[0..32]),
            user,
            bridged_itp_address: Address::from_slice(&result[76..96]),
            amount: U256::from_big_endian(&result[96..128]),
            limit_price: U256::from_big_endian(&result[128..160]),
            slippage_tier: result[191] as u8,
            deadline: U256::from_big_endian(&result[192..224]),
            created_at: U256::from_big_endian(&result[224..256]),
            burned: !U256::from_big_endian(&result[256..288]).is_zero(),
            burned_at: U256::from_big_endian(&result[288..320]),
        }))
    }

    /// Scan ALL cross-chain orders by ID (not events). Returns unfilled buy and sell orders.
    /// Used on startup to eliminate the 5000-block event scan window.
    /// Vision deposits share the same ID counter but return zeroed structs from
    /// getCrossChainOrder/getCrossChainSellOrder — safely skipped.
    pub async fn get_all_unfilled_orders(&self) -> Result<(Vec<CrossChainOrder>, Vec<CrossChainSellOrderEvent>), SettlementReaderError> {
        if self.config.settlement_custody_address.is_zero() {
            return Err(SettlementReaderError::ConfigError(
                "settlement_custody_address not configured".to_string(),
            ));
        }

        // 1. Call currentOrderId() on SettlementBridgeCustody
        let selector = &ethers::utils::keccak256("currentOrderId()")[..4];
        let tx = TransactionRequest::new()
            .to(self.config.settlement_custody_address)
            .data(selector.to_vec());

        let next_id_data = self.provider.call(&tx.into(), None).await.map_err(|e| {
            SettlementReaderError::ProviderError(format!("currentOrderId: {}", e))
        })?;
        let next_id = U256::from_big_endian(&next_id_data);

        // Safety: cap at 100k to avoid unbounded RPC calls on corrupted state
        let max_id = std::cmp::min(next_id.low_u64(), 100_000);
        if next_id.low_u64() > 100_000 {
            warn!("currentOrderId() returned {} — capping ID scan at 100,000", next_id);
        }

        let mut buy_orders = Vec::new();
        let mut sell_orders = Vec::new();

        // 2. Iterate 0..next_id (first order is ID 0), query each
        //    Rate-limit: 50ms between calls to avoid hitting public RPC rate limits
        //    (74 orders × ~100ms per pair = ~7.4s total — acceptable for one-time startup scan)
        for id in 0..max_id {
            let order_id = U256::from(id);

            // Rate-limit between order queries to avoid public RPC rate limits.
            // 200ms per pair × 74 orders = ~15s total. 3 oracles concurrent = ~5 req/s each.
            if id > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            }

            // Check buy order: getCrossChainOrder(id)
            match self.get_cross_chain_order(order_id).await {
                Ok(Some(data)) => {
                    buy_orders.push(CrossChainOrder {
                        order_id,
                        itp_id: data.itp_id,
                        user: data.user,
                        amount: data.amount,
                        limit_price: data.limit_price,
                        slippage_tier: data.slippage_tier,
                        deadline: data.deadline,
                        created_at: data.created_at,
                        chain_id: self.config.chain_id,
                        block_number: 0, // Not from event — unknown
                        tx_hash: H256::zero(),
                    });
                    continue; // Same ID can't be both buy and sell
                }
                Ok(None) => {} // Deleted, Vision deposit, or doesn't exist as buy
                Err(e) => {
                    warn!(order_id = id, error = %e, "Failed to query buy order in ID scan");
                }
            }

            // Check sell order: getCrossChainSellOrder(id)
            match self.get_cross_chain_sell_order(order_id).await {
                Ok(Some(data)) => {
                    sell_orders.push(CrossChainSellOrderEvent {
                        order_id,
                        itp_id: data.itp_id,
                        user: data.user,
                        bridged_itp_address: data.bridged_itp_address,
                        amount: data.amount,
                        limit_price: data.limit_price,
                        block_number: 0,
                        tx_hash: H256::zero(),
                    });
                }
                Ok(None) => {} // Deleted, Vision deposit, or doesn't exist as sell
                Err(e) => {
                    warn!(order_id = id, error = %e, "Failed to query sell order in ID scan");
                }
            }
        }

        info!(buys = buy_orders.len(), sells = sell_orders.len(), total_scanned = max_id,
            "Settlement ID scan: found unfilled orders");
        Ok((buy_orders, sell_orders))
    }

    /// Scan pendingMints mapping for CBO'd orders that still need minting.
    /// Returns (orderId, itpId, user, amount) for each pending mint.
    /// Called on startup to recover from crash between completeBuyOrder and mintBridgedShares.
    pub async fn get_pending_mints(
        &self,
        bridge_proxy: Address,
    ) -> Result<Vec<(U256, H256, Address, U256)>, SettlementReaderError> {
        if self.config.settlement_custody_address.is_zero() {
            return Ok(Vec::new());
        }

        // Get max order ID
        let selector = &ethers::utils::keccak256("currentOrderId()")[..4];
        let tx = TransactionRequest::new()
            .to(self.config.settlement_custody_address)
            .data(selector.to_vec());
        let next_id_data = self.provider.call(&tx.into(), None).await.map_err(|e| {
            SettlementReaderError::ProviderError(format!("currentOrderId: {}", e))
        })?;
        let next_id = U256::from_big_endian(&next_id_data);
        let max_id = std::cmp::min(next_id.low_u64(), 100_000);

        let mut pending = Vec::new();

        // pendingMints(uint256) selector
        let pm_selector = &ethers::utils::keccak256("pendingMints(uint256)")[..4];
        // mintProcessed(uint256) selector on BridgeProxy
        let mp_selector = &ethers::utils::keccak256("mintProcessed(uint256)")[..4];

        for id in 0..max_id {
            let order_id = U256::from(id);

            // Rate limit to avoid RPC spam
            if id > 0 && id % 10 == 0 {
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }

            // Query pendingMints(orderId) → returns (bytes32 itpId, address user, uint256 amount)
            let mut calldata = pm_selector.to_vec();
            let mut id_bytes = [0u8; 32];
            order_id.to_big_endian(&mut id_bytes);
            calldata.extend_from_slice(&id_bytes);

            let pm_tx = TransactionRequest::new()
                .to(self.config.settlement_custody_address)
                .data(calldata);
            let pm_data = match self.provider.call(&pm_tx.into(), None).await {
                Ok(d) => d,
                Err(_) => continue,
            };

            if pm_data.len() < 96 { continue; }
            let itp_id = H256::from_slice(&pm_data[0..32]);
            let user = Address::from_slice(&pm_data[44..64]);
            let amount = U256::from_big_endian(&pm_data[64..96]);

            // Skip empty entries (user == address(0))
            if user.is_zero() { continue; }

            // Check if already minted on BridgeProxy
            let mut mp_calldata = mp_selector.to_vec();
            mp_calldata.extend_from_slice(&id_bytes);
            let mp_tx = TransactionRequest::new()
                .to(bridge_proxy)
                .data(mp_calldata);
            let mp_data = match self.provider.call(&mp_tx.into(), None).await {
                Ok(d) => d,
                Err(_) => continue,
            };
            let already_minted = if mp_data.len() >= 32 {
                U256::from_big_endian(&mp_data[0..32]) != U256::zero()
            } else {
                false
            };

            if !already_minted {
                info!(order_id = id, ?itp_id, ?user, %amount, "Found pending mint needing recovery");
                pending.push((order_id, itp_id, user, amount));
            }
        }

        if !pending.is_empty() {
            warn!(count = pending.len(), "Pending mints found — these orders need mint recovery");
        }
        Ok(pending)
    }

    /// Get confirmed CrossChainOrderCreated events and enrich with full order data
    ///
    /// This is the main entry point for fetching cross-chain orders. It:
    /// 1. Gets confirmed block (current block - confirmations)
    /// 2. Fetches events in the specified range (respecting confirmation requirement)
    /// 3. Enriches each event with full order params via getCrossChainOrder()
    /// 4. Deduplicates by (chain_id, order_id)
    /// 5. Filters out expired orders
    ///
    /// # Arguments
    /// * `from_block` - Starting block number (inclusive)
    /// * `to_block` - Ending block number (inclusive, will be capped at confirmed block)
    ///
    /// # Returns
    /// Vector of full, validated CrossChainOrder structs ready for processing
    pub async fn get_confirmed_cross_chain_orders(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CrossChainOrder>, SettlementReaderError> {
        // Get the confirmed block (current - confirmations)
        let confirmed_block = self.get_confirmed_block().await?;

        // Cap to_block at confirmed block
        let safe_to_block = to_block.min(confirmed_block);

        if from_block > safe_to_block {
            return Ok(Vec::new());
        }

        debug!(
            from_block,
            to_block = safe_to_block,
            confirmed_block,
            confirmations = self.config.confirmations,
            "Fetching confirmed cross-chain orders"
        );

        // Get block timestamp for expiry checks (avoids system clock vs chain time drift)
        let block_timestamp = match self.provider.get_block(safe_to_block).await {
            Ok(Some(block)) => block.timestamp.as_u64(),
            _ => {
                // Fallback to system clock if block fetch fails
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0)
            }
        };

        // Get events
        let events = self.get_cross_chain_order_events(from_block, safe_to_block).await?;

        let mut orders = Vec::with_capacity(events.len());
        let chain_id = self.config.chain_id;

        for event in events {
            let dedup_key = (chain_id, event.order_id);

            // Skip orders already successfully processed
            if self.seen_orders.read().await.contains(&dedup_key) {
                debug!(
                    order_id = %event.order_id,
                    chain_id,
                    "Skipping completed cross-chain order"
                );
                continue;
            }

            // Skip orders that exceeded max retries
            {
                let retries = self.retry_counts.read().await;
                if let Some(&count) = retries.get(&dedup_key) {
                    if count >= MAX_ORDER_RETRIES {
                        debug!(
                            order_id = %event.order_id,
                            retries = count,
                            "Skipping cross-chain order: exceeded max retries"
                        );
                        continue;
                    }
                }
            }

            // Fetch full order data
            match self.get_cross_chain_order(event.order_id).await? {
                Some(order_data) => {
                    // Validate user isn't zero (sanity check, event parsing should catch this)
                    if order_data.user.is_zero() {
                        warn!(
                            order_id = %event.order_id,
                            code = "ORDER-003",
                            "Cross-chain order has zero user address, skipping"
                        );
                        // Mark permanently so we don't keep re-fetching
                        self.seen_orders.write().await.insert(dedup_key);
                        continue;
                    }

                    // Build full order
                    let full_order = cross_chain_event_into_full_order(
                        event,
                        order_data.limit_price,
                        order_data.slippage_tier,
                        order_data.deadline,
                        order_data.created_at,
                        chain_id,
                    );

                    // Story 7-6b: Check for suspicious amounts that might indicate decimal confusion
                    cross_chain_order_log_if_suspicious_amount(&full_order);

                    // Check expiration using block timestamp (not system clock)
                    if cross_chain_order_is_expired_at(&full_order, block_timestamp) {
                        warn!(
                            order_id = %full_order.order_id,
                            deadline = %full_order.deadline,
                            block_timestamp,
                            code = "ORDER-001",
                            "Cross-chain order has expired, skipping"
                        );
                        // Mark expired orders as seen so we don't re-check them
                        self.seen_orders.write().await.insert(dedup_key);
                        continue;
                    }

                    // NOTE: Do NOT mark as "seen" here. The caller must call
                    // mark_order_processed() after successful bridge+submit.
                    // This allows failed orders to be retried on the next cycle.

                    orders.push(full_order);
                }
                None => {
                    // Order was deleted (already completed via completeBuyOrder) or never existed.
                    // Mark as seen to prevent infinite retries on stale events.
                    debug!(
                        order_id = %event.order_id,
                        code = "ORDER-004",
                        "Cross-chain order not found on-chain (already completed or invalid), marking as seen"
                    );
                    self.seen_orders.write().await.insert(dedup_key);
                }
            }
        }

        debug!(
            found = orders.len(),
            from_block,
            to_block = safe_to_block,
            "Fetched confirmed cross-chain orders"
        );

        Ok(orders)
    }

    /// Clear old entries from the seen_orders deduplication set
    ///
    /// Call periodically to prevent unbounded memory growth.
    ///
    /// **IMPORTANT**: This clears the entire set when it exceeds max_size.
    /// After clearing, recently-seen orders may be reprocessed if they appear
    /// in subsequent event queries. This is safe because:
    /// - Expired orders are filtered by deadline check
    /// - Already-executed orders will fail at consensus level
    /// - The operation is idempotent at the bridge level
    ///
    /// For production use, consider calling with a high max_size (e.g., 100_000)
    /// to minimize reprocessing, or implement time-based LRU eviction.
    ///
    /// # Arguments
    /// * `max_size` - Maximum number of entries to keep before clearing
    pub async fn clear_old_seen_orders(&self, max_size: usize) {
        let mut seen = self.seen_orders.write().await;
        if seen.len() > max_size {
            warn!(
                size = seen.len(),
                max_size,
                "Clearing seen_orders deduplication set - recent orders may be reprocessed"
            );
            seen.clear();
            // Also clear retry counts to give orders fresh attempts
            self.retry_counts.write().await.clear();
        }
    }

    /// Remove a specific order from the seen_orders dedup set.
    /// Used by the stale order watchdog to allow re-processing of stuck orders.
    pub async fn remove_seen_order(&self, chain_id: u64, order_id: U256) {
        let key = (chain_id, order_id);
        if self.seen_orders.write().await.remove(&key) {
            info!(chain_id, order_id = %order_id, "Removed order from seen_orders for retry");
        }
        // Also reset retry count so the order gets a fresh set of attempts
        self.retry_counts.write().await.remove(&key);
    }

    /// Mark an order as successfully processed. Called by the orchestrator
    /// after bridge+submit completes. The order won't be returned again.
    pub async fn mark_order_processed(&self, chain_id: u64, order_id: U256) {
        let key = (chain_id, order_id);
        self.seen_orders.write().await.insert(key);
        // Clean up retry counter
        self.retry_counts.write().await.remove(&key);
        debug!(chain_id, order_id = %order_id, "Marked cross-chain order as processed");
    }

    /// Increment retry count for a failed order. Returns the new count.
    /// After MAX_ORDER_RETRIES, the order will be skipped in future scans.
    pub async fn increment_retry_count(&self, chain_id: u64, order_id: U256) -> u8 {
        let key = (chain_id, order_id);
        let mut retries = self.retry_counts.write().await;
        let count = retries.entry(key).or_insert(0);
        *count = count.saturating_add(1);
        let result = *count;
        if result >= MAX_ORDER_RETRIES {
            warn!(
                chain_id,
                order_id = %order_id,
                retries = result,
                max = MAX_ORDER_RETRIES,
                "Cross-chain order exceeded max retries, will be skipped"
            );
        }
        result
    }
    // ============ Cross-Chain Sell Order Event Handling ============

    /// Get CrossChainSellOrderCreated events in a block range from SettlementBridgeCustody
    ///
    /// # Arguments
    /// * `from_block` - Starting block number (inclusive)
    /// * `to_block` - Ending block number (inclusive)
    ///
    /// # Returns
    /// Vector of parsed CrossChainSellOrderEvent
    pub async fn get_cross_chain_sell_order_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CrossChainSellOrderEvent>, SettlementReaderError> {
        if from_block > to_block {
            return Ok(Vec::new());
        }

        // Ensure we have a valid custody address
        if self.config.settlement_custody_address.is_zero() {
            return Err(SettlementReaderError::ConfigError(
                "settlement_custody_address not configured".to_string(),
            ));
        }

        debug!(
            from_block,
            to_block,
            settlement_custody = ?self.config.settlement_custody_address,
            "Fetching CrossChainSellOrderCreated events"
        );

        let filter = Filter::new()
            .address(self.config.settlement_custody_address)
            .topic0(self.cross_chain_sell_order_topic)
            .from_block(from_block)
            .to_block(to_block);

        let logs = self.provider.get_logs(&filter).await.map_err(|e| {
            SettlementReaderError::ProviderError(format!("Failed to get sell order logs: {}", e))
        })?;

        debug!(
            count = logs.len(),
            from_block,
            to_block,
            "Retrieved CrossChainSellOrderCreated logs"
        );

        let mut events = Vec::with_capacity(logs.len());
        for log in logs {
            match parse_cross_chain_sell_order_event(&log) {
                Ok(event) => {
                    debug!(
                        order_id = %event.order_id,
                        itp_id = ?event.itp_id,
                        user = ?event.user,
                        bridged_itp_address = ?event.bridged_itp_address,
                        amount = %event.amount,
                        "Parsed CrossChainSellOrderCreated event"
                    );
                    events.push(event);
                }
                Err(e) => {
                    warn!(
                        code = "SELL-ORDER-001",
                        error = %e,
                        tx_hash = ?log.transaction_hash,
                        "Failed to parse CrossChainSellOrderCreated event"
                    );
                }
            }
        }

        Ok(events)
    }

    /// Get confirmed CrossChainSellOrderCreated events with deduplication
    ///
    /// 1. Calls `get_cross_chain_sell_order_events`
    /// 2. Deduplicates using `seen_sell_orders`
    /// 3. No deadline check for sell orders (escrow is permanent until complete/refund)
    /// 4. Returns only unseen orders
    ///
    /// # Arguments
    /// * `from_block` - Starting block number (inclusive)
    /// * `to_block` - Ending block number (inclusive, will be capped at confirmed block)
    ///
    /// # Returns
    /// Vector of unseen CrossChainSellOrderEvent
    pub async fn get_confirmed_cross_chain_sell_orders(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CrossChainSellOrderEvent>, SettlementReaderError> {
        // Get the confirmed block (current - confirmations)
        let confirmed_block = self.get_confirmed_block().await?;

        // Cap to_block at confirmed block
        let safe_to_block = to_block.min(confirmed_block);

        if from_block > safe_to_block {
            return Ok(Vec::new());
        }

        debug!(
            from_block,
            to_block = safe_to_block,
            confirmed_block,
            confirmations = self.config.confirmations,
            "Fetching confirmed cross-chain sell orders"
        );

        // Get events
        let events = self.get_cross_chain_sell_order_events(from_block, safe_to_block).await?;

        let mut orders = Vec::with_capacity(events.len());
        let chain_id = self.config.chain_id;

        for event in events {
            let dedup_key = (chain_id, event.order_id);

            // Skip orders already successfully processed
            if self.seen_sell_orders.read().await.contains(&dedup_key) {
                debug!(
                    order_id = %event.order_id,
                    chain_id,
                    "Skipping completed cross-chain sell order"
                );
                continue;
            }

            // Skip orders that exceeded max retries
            {
                let retries = self.retry_sell_counts.read().await;
                if let Some(&count) = retries.get(&dedup_key) {
                    if count >= MAX_ORDER_RETRIES {
                        debug!(
                            order_id = %event.order_id,
                            retries = count,
                            "Skipping cross-chain sell order: exceeded max retries"
                        );
                        continue;
                    }
                }
            }

            // Basic validation
            if event.user.is_zero() {
                warn!(
                    order_id = %event.order_id,
                    code = "SELL-ORDER-002",
                    "Cross-chain sell order has zero user address, skipping"
                );
                self.seen_sell_orders.write().await.insert(dedup_key);
                continue;
            }

            orders.push(event);
        }

        debug!(
            found = orders.len(),
            from_block,
            to_block = safe_to_block,
            "Fetched confirmed cross-chain sell orders"
        );

        Ok(orders)
    }

    /// Remove a specific sell order from the seen_sell_orders dedup set.
    /// Used by the stale order watchdog to allow re-processing of stuck sell orders.
    pub async fn remove_seen_sell_order(&self, chain_id: u64, order_id: U256) {
        let key = (chain_id, order_id);
        if self.seen_sell_orders.write().await.remove(&key) {
            info!(chain_id, order_id = %order_id, "Removed sell order from seen_sell_orders for retry");
        }
        // Also reset retry count so the order gets a fresh set of attempts
        self.retry_sell_counts.write().await.remove(&key);
    }

    /// Clear old entries from the seen_sell_orders deduplication set
    ///
    /// Call periodically to prevent unbounded memory growth.
    ///
    /// # Arguments
    /// * `max_size` - Maximum number of entries to keep before clearing
    pub async fn clear_old_seen_sell_orders(&self, max_size: usize) {
        let mut seen = self.seen_sell_orders.write().await;
        if seen.len() > max_size {
            warn!(
                size = seen.len(),
                max_size,
                "Clearing seen_sell_orders deduplication set - recent sell orders may be reprocessed"
            );
            seen.clear();
            self.retry_sell_counts.write().await.clear();
        }
    }

    /// Mark a sell order as successfully processed. Called by the orchestrator
    /// after sell order processing completes. The order won't be returned again.
    pub async fn mark_sell_order_processed(&self, chain_id: u64, order_id: U256) {
        let key = (chain_id, order_id);
        self.seen_sell_orders.write().await.insert(key);
        // Clean up retry counter
        self.retry_sell_counts.write().await.remove(&key);
        debug!(chain_id, order_id = %order_id, "Marked cross-chain sell order as processed");
    }

    /// Increment retry count for a failed sell order. Returns the new count.
    /// After MAX_ORDER_RETRIES, the order will be skipped in future scans.
    pub async fn increment_sell_retry_count(&self, chain_id: u64, order_id: U256) -> u8 {
        let key = (chain_id, order_id);
        let mut retries = self.retry_sell_counts.write().await;
        let count = retries.entry(key).or_insert(0);
        *count = count.saturating_add(1);
        let result = *count;
        if result >= MAX_ORDER_RETRIES {
            warn!(
                chain_id,
                order_id = %order_id,
                retries = result,
                max = MAX_ORDER_RETRIES,
                "Cross-chain sell order exceeded max retries, will be skipped"
            );
        }
        result
    }
}

/// Parse getCrossChainOrder response into CrossChainOrderData
///
/// ## Decimal Format (Story 7-6b)
///
/// The `amount` field is returned in **18-decimal internal format**.
/// The SettlementBridgeCustody contract converts 6-decimal USDC to 18-decimal at order creation.
///
/// Response layout (ABI encoded struct):
/// - [0-32]: itpId (bytes32)
/// - [32-64]: user (address, padded)
/// - [64-96]: amount (uint256) - 18 decimals
/// - [96-128]: limitPrice (uint256) - 18 decimals
/// - [128-160]: slippageTier (uint256)
/// - [160-192]: deadline (uint256)
/// - [192-224]: createdAt (uint256)
fn parse_cross_chain_order_response(
    data: &[u8],
    order_id: U256,
) -> Result<Option<CrossChainOrderData>, SettlementReaderError> {
    // Minimum expected size: 7 * 32 bytes = 224 bytes
    if data.len() < 224 {
        return Err(SettlementReaderError::DecodeError(
            format!("getCrossChainOrder response too short: {} < 224", data.len()),
        ));
    }

    // Parse fields
    let itp_id = H256::from_slice(&data[0..32]);
    let user = Address::from_slice(&data[32 + 12..64]); // Last 20 bytes of padded address
    let amount = U256::from_big_endian(&data[64..96]);
    let limit_price = U256::from_big_endian(&data[96..128]);
    let slippage_tier_raw = U256::from_big_endian(&data[128..160]);
    let deadline = U256::from_big_endian(&data[160..192]);
    let created_at = U256::from_big_endian(&data[192..224]);

    // Check if order exists (user != address(0))
    if user.is_zero() {
        return Ok(None);
    }

    // Convert slippage_tier to u8 (valid range is 0, 1, 2)
    let slippage_tier = slippage_tier_raw.as_u64() as u8;

    // Story 7-6b: Debug log the amount for decimal verification
    debug!(
        order_id = %order_id,
        amount_18dec = %amount,
        limit_price_18dec = %limit_price,
        "Parsed cross-chain order response (amounts in 18 decimals)"
    );

    Ok(Some(CrossChainOrderData {
        itp_id,
        user,
        amount,
        limit_price,
        slippage_tier,
        deadline,
        created_at,
    }))
}

/// Parse getPendingCreation response into ItpCreationRequest
fn parse_pending_creation_response(
    data: &[u8],
    nonce: U256,
) -> Result<Option<ItpCreationRequest>, SettlementReaderError> {
    if data.len() < 256 {
        return Err(SettlementReaderError::DecodeError(
            "getPendingCreation response too short".to_string(),
        ));
    }

    // Layout (all offsets are in 32-byte words):
    // [0]: admin (address, padded to 32 bytes)
    // [1]: offset to name string
    // [2]: offset to symbol string
    // [3]: offset to weights array
    // [4]: offset to assets array
    // [5]: offset to prices array
    // [6]: createdAt (uint64, padded to 32 bytes)
    // [7]: completed (bool, padded to 32 bytes)
    // Then dynamic data follows

    let admin = Address::from_slice(&data[12..32]);

    // Check if request exists (admin != address(0))
    if admin.is_zero() {
        return Ok(None);
    }

    let name_offset = U256::from_big_endian(&data[32..64]).as_usize();
    let symbol_offset = U256::from_big_endian(&data[64..96]).as_usize();
    let weights_offset = U256::from_big_endian(&data[96..128]).as_usize();
    let assets_offset = U256::from_big_endian(&data[128..160]).as_usize();
    let prices_offset = U256::from_big_endian(&data[160..192]).as_usize();
    let _created_at = U256::from_big_endian(&data[192..224]).as_u64();
    let completed = data[255] != 0;

    // Skip if already completed
    if completed {
        return Ok(None);
    }

    // Parse dynamic data
    let name = decode_string_from_offset(data, name_offset)?;
    let symbol = decode_string_from_offset(data, symbol_offset)?;
    let weights = decode_uint256_array_from_offset(data, weights_offset)?;
    let assets = decode_address_array_from_offset(data, assets_offset)?;
    let prices = decode_uint256_array_from_offset(data, prices_offset)?;

    Ok(Some(ItpCreationRequest {
        admin,
        nonce,
        name,
        symbol,
        weights,
        assets,
        prices,
        block_number: 0, // Not available from view call
        tx_hash: H256::zero(), // Not available from view call
    }))
}

/// Decode string from ABI response at given offset
fn decode_string_from_offset(data: &[u8], offset: usize) -> Result<String, SettlementReaderError> {
    if offset + 32 > data.len() {
        return Err(SettlementReaderError::DecodeError(
            "string offset out of bounds".to_string(),
        ));
    }

    let length = U256::from_big_endian(&data[offset..offset + 32]).as_usize();
    if offset + 32 + length > data.len() {
        return Err(SettlementReaderError::DecodeError(
            "string data out of bounds".to_string(),
        ));
    }

    String::from_utf8(data[offset + 32..offset + 32 + length].to_vec())
        .map_err(|e| SettlementReaderError::DecodeError(format!("invalid UTF-8: {}", e)))
}

/// Decode uint256[] array from ABI response at given offset
fn decode_uint256_array_from_offset(
    data: &[u8],
    offset: usize,
) -> Result<Vec<U256>, SettlementReaderError> {
    if offset + 32 > data.len() {
        return Err(SettlementReaderError::DecodeError(
            "array offset out of bounds".to_string(),
        ));
    }

    let length = U256::from_big_endian(&data[offset..offset + 32]).as_usize();
    let expected_end = offset + 32 + length * 32;
    if expected_end > data.len() {
        return Err(SettlementReaderError::DecodeError(
            "array data out of bounds".to_string(),
        ));
    }

    let mut result = Vec::with_capacity(length);
    for i in 0..length {
        let start = offset + 32 + i * 32;
        let value = U256::from_big_endian(&data[start..start + 32]);
        result.push(value);
    }

    Ok(result)
}

/// Decode address[] array from ABI response at given offset
fn decode_address_array_from_offset(
    data: &[u8],
    offset: usize,
) -> Result<Vec<Address>, SettlementReaderError> {
    if offset + 32 > data.len() {
        return Err(SettlementReaderError::DecodeError(
            "array offset out of bounds".to_string(),
        ));
    }

    let length = U256::from_big_endian(&data[offset..offset + 32]).as_usize();
    let expected_end = offset + 32 + length * 32;
    if expected_end > data.len() {
        return Err(SettlementReaderError::DecodeError(
            "array data out of bounds".to_string(),
        ));
    }

    let mut result = Vec::with_capacity(length);
    for i in 0..length {
        let start = offset + 32 + i * 32;
        let address = Address::from_slice(&data[start + 12..start + 32]);
        result.push(address);
    }

    Ok(result)
}

/// Errors for SettlementChainReader operations
#[derive(Debug, thiserror::Error)]
pub enum SettlementReaderError {
    #[error("provider error: {0}")]
    ProviderError(String),

    #[error("decode error: {0}")]
    DecodeError(String),

    #[error("parse error: {0}")]
    ParseError(#[from] ParseError),

    #[error("cross-chain order parse error: {0}")]
    CrossChainOrderParseError(#[from] CrossChainOrderParseError),

    #[error("configuration error: {0}")]
    ConfigError(String),
}

// ============================================================================
// SettlementReader trait implementation — delegates to inherent methods
// ============================================================================

use crate::chain::settlement_trait::SettlementReader;

#[async_trait]
impl<M: Middleware + Send + Sync + 'static> SettlementReader for SettlementChainReader<M> {
    fn chain_id(&self) -> u64 {
        self.config.chain_id
    }

    async fn get_confirmed_block(&self) -> Result<u64, SettlementReaderError> {
        self.get_confirmed_block().await
    }

    async fn get_create_itp_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<ItpCreationRequest>, SettlementReaderError> {
        self.get_create_itp_events(from_block, to_block).await
    }

    async fn get_itp_created_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<ItpCreatedEvent>, SettlementReaderError> {
        self.get_itp_created_events(from_block, to_block).await
    }

    async fn is_pending(&self, nonce: U256) -> Result<bool, SettlementReaderError> {
        self.is_pending(nonce).await
    }

    async fn get_next_nonce(&self) -> Result<U256, SettlementReaderError> {
        self.get_next_nonce().await
    }

    async fn get_pending_creation(
        &self,
        nonce: U256,
    ) -> Result<Option<ItpCreationRequest>, SettlementReaderError> {
        self.get_pending_creation(nonce).await
    }

    async fn get_all_pending_requests(
        &self,
    ) -> Result<Vec<ItpCreationRequest>, SettlementReaderError> {
        self.get_all_pending_requests().await
    }

    async fn get_cross_chain_order_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CrossChainOrderEvent>, SettlementReaderError> {
        self.get_cross_chain_order_events(from_block, to_block).await
    }

    async fn get_cross_chain_order(
        &self,
        order_id: U256,
    ) -> Result<Option<CrossChainOrderData>, SettlementReaderError> {
        self.get_cross_chain_order(order_id).await
    }

    async fn get_cross_chain_sell_order(
        &self,
        order_id: U256,
    ) -> Result<Option<CrossChainSellOrderData>, SettlementReaderError> {
        self.get_cross_chain_sell_order(order_id).await
    }

    async fn get_all_unfilled_orders(
        &self,
    ) -> Result<(Vec<CrossChainOrder>, Vec<CrossChainSellOrderEvent>), SettlementReaderError> {
        self.get_all_unfilled_orders().await
    }

    async fn get_confirmed_cross_chain_orders(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CrossChainOrder>, SettlementReaderError> {
        self.get_confirmed_cross_chain_orders(from_block, to_block).await
    }

    async fn mark_order_processed(&self, chain_id: u64, order_id: U256) {
        self.mark_order_processed(chain_id, order_id).await
    }

    async fn increment_retry_count(&self, chain_id: u64, order_id: U256) -> u8 {
        self.increment_retry_count(chain_id, order_id).await
    }

    async fn remove_seen_order(&self, chain_id: u64, order_id: U256) {
        self.remove_seen_order(chain_id, order_id).await
    }

    async fn clear_old_seen_orders(&self, max_size: usize) {
        self.clear_old_seen_orders(max_size).await
    }

    async fn get_confirmed_cross_chain_sell_orders(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CrossChainSellOrderEvent>, SettlementReaderError> {
        self.get_confirmed_cross_chain_sell_orders(from_block, to_block).await
    }

    async fn mark_sell_order_processed(&self, chain_id: u64, order_id: U256) {
        self.mark_sell_order_processed(chain_id, order_id).await
    }

    async fn increment_sell_retry_count(&self, chain_id: u64, order_id: U256) -> u8 {
        self.increment_sell_retry_count(chain_id, order_id).await
    }

    async fn remove_seen_sell_order(&self, chain_id: u64, order_id: U256) {
        self.remove_seen_sell_order(chain_id, order_id).await
    }

    async fn clear_old_seen_sell_orders(&self, max_size: usize) {
        self.clear_old_seen_sell_orders(max_size).await
    }

    async fn get_pending_mints(
        &self,
        bridge_proxy: Address,
    ) -> Result<Vec<(U256, H256, Address, U256)>, SettlementReaderError> {
        self.get_pending_mints(bridge_proxy).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = SettlementChainReaderConfig::default();
        assert_eq!(config.rpc_url, "https://arb1.arbitrum.io/rpc");
        assert_eq!(config.chain_id, 42161);
        assert_eq!(config.confirmations, 3); // 3 confirmations for cross-chain safety (Story 7.1)
        assert_eq!(config.max_block_range, 10_000);
        assert_eq!(config.bridge_proxy_address, Address::zero());
        assert_eq!(config.settlement_custody_address, Address::zero());
    }

    #[test]
    fn test_event_topic_hashes() {
        // Verify event signature hashes are computed correctly
        let create_itp_topic = H256::from_slice(&ethers::utils::keccak256(
            CREATE_ITP_REQUESTED_SIGNATURE,
        ));
        let itp_created_topic =
            H256::from_slice(&ethers::utils::keccak256(ITP_CREATED_SIGNATURE));

        // These should be non-zero
        assert_ne!(create_itp_topic, H256::zero());
        assert_ne!(itp_created_topic, H256::zero());

        // They should be different
        assert_ne!(create_itp_topic, itp_created_topic);
    }

    #[test]
    fn test_decode_string_from_offset() {
        // Build test data with string "Test" at offset 0
        let mut data = vec![0u8; 128];
        data[31] = 4; // Length = 4
        data[32] = b'T';
        data[33] = b'e';
        data[34] = b's';
        data[35] = b't';

        let result = decode_string_from_offset(&data, 0).unwrap();
        assert_eq!(result, "Test");
    }

    #[test]
    fn test_decode_uint256_array_from_offset() {
        // Build test data with array [100, 200] at offset 0
        let mut data = vec![0u8; 96];
        data[31] = 2; // Length = 2
        data[63] = 100; // First element
        data[95] = 200; // Second element

        let result = decode_uint256_array_from_offset(&data, 0).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], U256::from(100));
        assert_eq!(result[1], U256::from(200));
    }

    #[test]
    fn test_decode_address_array_from_offset() {
        // Build test data with 2 addresses at offset 0
        let mut data = vec![0u8; 96];
        data[31] = 2; // Length = 2
        // First address (last 20 bytes of 32-byte slot)
        for i in 12..32 {
            data[32 + i] = 0x11;
        }
        // Second address
        for i in 12..32 {
            data[64 + i] = 0x22;
        }

        let result = decode_address_array_from_offset(&data, 0).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], Address::from([0x11u8; 20]));
        assert_eq!(result[1], Address::from([0x22u8; 20]));
    }

    #[test]
    fn test_decode_out_of_bounds() {
        let data = vec![0u8; 10]; // Too short

        let result = decode_string_from_offset(&data, 0);
        assert!(result.is_err());

        let result = decode_uint256_array_from_offset(&data, 0);
        assert!(result.is_err());

        let result = decode_address_array_from_offset(&data, 0);
        assert!(result.is_err());
    }

    // ============ Story 7.1: CrossChainOrder Tests ============

    #[test]
    fn test_cross_chain_order_topic_hash() {
        // Verify the CrossChainOrderCreated event signature hash is computed correctly
        let topic = H256::from_slice(&ethers::utils::keccak256(
            CROSS_CHAIN_ORDER_CREATED_SIGNATURE,
        ));

        // Should be non-zero
        assert_ne!(topic, H256::zero());

        // Should be different from other event signatures
        let create_itp_topic = H256::from_slice(&ethers::utils::keccak256(
            CREATE_ITP_REQUESTED_SIGNATURE,
        ));
        assert_ne!(topic, create_itp_topic);
    }

    #[test]
    fn test_parse_cross_chain_order_response_success() {
        // Build valid getCrossChainOrder response
        // Layout: itpId (32) + user (32) + amount (32) + limitPrice (32) + slippageTier (32) + deadline (32) + createdAt (32)
        let mut data = vec![0u8; 224];

        // itpId: 0xAA...AA
        for i in 0..32 {
            data[i] = 0xAA;
        }

        // user: 0xBB...BB (last 20 bytes of 32-byte slot)
        for i in 12..32 {
            data[32 + i] = 0xBB;
        }

        // amount: 1e18 (1_000_000_000_000_000_000)
        U256::from(1_000_000_000_000_000_000u64).to_big_endian(&mut data[64..96]);

        // limitPrice: 5e17 (500_000_000_000_000_000)
        U256::from(500_000_000_000_000_000u64).to_big_endian(&mut data[96..128]);

        // slippageTier: 1 (normal)
        U256::from(1u64).to_big_endian(&mut data[128..160]);

        // deadline: 1700000000
        U256::from(1700000000u64).to_big_endian(&mut data[160..192]);

        // createdAt: 1699000000
        U256::from(1699000000u64).to_big_endian(&mut data[192..224]);

        let result = parse_cross_chain_order_response(&data, U256::from(42)).unwrap();
        assert!(result.is_some());

        let order = result.unwrap();
        assert_eq!(order.itp_id, H256::from([0xAA; 32]));
        assert_eq!(order.user, Address::from([0xBB; 20]));
        assert_eq!(order.amount, U256::from(1_000_000_000_000_000_000u64));
        assert_eq!(order.limit_price, U256::from(500_000_000_000_000_000u64));
        assert_eq!(order.slippage_tier, 1);
        assert_eq!(order.deadline, U256::from(1700000000u64));
        assert_eq!(order.created_at, U256::from(1699000000u64));
    }

    #[test]
    fn test_parse_cross_chain_order_response_zero_user() {
        // Build response with zero user (order doesn't exist)
        let mut data = vec![0u8; 224];

        // itpId: 0xAA...AA
        for i in 0..32 {
            data[i] = 0xAA;
        }

        // user: all zeros (order doesn't exist)
        // amount, limitPrice, slippageTier, deadline, createdAt: some values
        U256::from(1000u64).to_big_endian(&mut data[64..96]);
        U256::from(500u64).to_big_endian(&mut data[96..128]);
        U256::from(1u64).to_big_endian(&mut data[128..160]); // slippageTier
        U256::from(1700000000u64).to_big_endian(&mut data[160..192]);
        U256::from(1699000000u64).to_big_endian(&mut data[192..224]);

        let result = parse_cross_chain_order_response(&data, U256::from(42)).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_cross_chain_order_response_too_short() {
        let data = vec![0u8; 100]; // Less than 224 bytes

        let result = parse_cross_chain_order_response(&data, U256::from(42));
        assert!(result.is_err());
        match result {
            Err(SettlementReaderError::DecodeError(msg)) => {
                assert!(msg.contains("too short"));
            }
            _ => panic!("Expected DecodeError"),
        }
    }

    #[tokio::test]
    async fn test_clear_old_seen_orders() {
        let config = SettlementChainReaderConfig {
            settlement_custody_address: Address::from([0x11u8; 20]),
            ..Default::default()
        };

        // Create a mock provider using Provider<Http>
        let provider = Provider::<Http>::try_from("http://localhost:8545").unwrap();
        let reader = SettlementChainReader::with_provider(Arc::new(provider), config);

        // Add some seen orders
        {
            let mut seen = reader.seen_orders.write().await;
            seen.insert((42161, U256::from(1)));
            seen.insert((42161, U256::from(2)));
            seen.insert((42161, U256::from(3)));
        }

        assert_eq!(reader.seen_orders.read().await.len(), 3);

        // Clear with max_size > current size (should not clear)
        reader.clear_old_seen_orders(10).await;
        assert_eq!(reader.seen_orders.read().await.len(), 3);

        // Clear with max_size < current size (should clear)
        reader.clear_old_seen_orders(2).await;
        assert_eq!(reader.seen_orders.read().await.len(), 0);
    }
}
