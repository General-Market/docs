//! Settlement chain event types shared between data-node, issuer, and AP.
//!
//! These types represent cross-chain events from the BridgeProxy and
//! SettlementBridgeCustody contracts on the Settlement chain.

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};

/// Parsed CreateItpRequested event from BridgeProxy on Settlement chain
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ItpCreationRequest {
    /// Original requester address on Settlement chain
    pub admin: Address,
    /// Request nonce from BridgeProxy
    pub nonce: U256,
    /// ITP name (max 32 chars)
    pub name: String,
    /// ITP symbol (max 10 chars)
    pub symbol: String,
    /// Asset weights (sum to 1e18)
    pub weights: Vec<U256>,
    /// Asset addresses
    pub assets: Vec<Address>,
    /// Asset prices (18 decimals) — from BridgeProxy pending request
    pub prices: Vec<U256>,
    /// Block number where event was emitted
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
}

/// Partial order data from CrossChainOrderCreated event
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CrossChainOrderEvent {
    /// Unique order ID from SettlementBridgeCustody
    pub order_id: U256,
    /// ITP identifier (bytes32)
    pub itp_id: H256,
    /// User who placed the order
    pub user: Address,
    /// USDC amount (18 decimals)
    pub amount: U256,
    /// Block number where event was emitted
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
}

/// Full cross-chain order data (event + view call data)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CrossChainOrder {
    /// Unique order ID from SettlementBridgeCustody
    pub order_id: U256,
    /// ITP identifier (bytes32)
    pub itp_id: H256,
    /// User who placed the order
    pub user: Address,
    /// USDC amount (18 decimals)
    pub amount: U256,
    /// Maximum price per ITP token (18 decimals)
    pub limit_price: U256,
    /// Slippage tier: 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    pub slippage_tier: u8,
    /// Unix timestamp when order expires
    pub deadline: U256,
    /// Timestamp when order was created on-chain
    pub created_at: U256,
    /// Source chain ID (for deduplication)
    pub chain_id: u64,
    /// Block number where event was emitted
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
}

/// Cross-chain sell order event data from SettlementBridgeCustody
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CrossChainSellOrderEvent {
    /// Unique order ID from SettlementBridgeCustody
    pub order_id: U256,
    /// ITP identifier (bytes32)
    pub itp_id: H256,
    /// User who placed the sell order
    pub user: Address,
    /// Bridged ITP token address on Settlement chain
    pub bridged_itp_address: Address,
    /// ITP amount to sell (18 decimals)
    pub amount: U256,
    /// Block number where event was emitted
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
}

/// Data returned from getCrossChainOrder() view call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossChainOrderData {
    /// ITP identifier (bytes32)
    pub itp_id: H256,
    /// User who placed the order
    pub user: Address,
    /// USDC amount (18 decimals)
    pub amount: U256,
    /// Maximum price per ITP token (18 decimals)
    pub limit_price: U256,
    /// Slippage tier: 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    pub slippage_tier: u8,
    /// Unix timestamp when order expires
    pub deadline: U256,
    /// Timestamp when order was created on-chain
    pub created_at: U256,
}

/// Data returned from getCrossChainSellOrder() view call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossChainSellOrderData {
    /// ITP identifier (bytes32)
    pub itp_id: H256,
    /// User who placed the order
    pub user: Address,
    /// Bridged ITP token address
    pub bridged_itp_address: Address,
    /// ITP amount (18 decimals)
    pub amount: U256,
    /// Minimum sell price (18 decimals)
    pub limit_price: U256,
    /// Slippage tier
    pub slippage_tier: u8,
    /// Unix timestamp when order expires
    pub deadline: U256,
    /// Timestamp when order was created on-chain
    pub created_at: U256,
}

/// Parsed ItpCreated event from BridgeProxy on Settlement chain
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ItpCreatedEvent {
    /// L3 ITP ID
    pub orbit_itp_id: H256,
    /// Deployed BridgedITP address on Settlement chain
    pub bridged_itp_address: Address,
    /// Original request nonce
    pub nonce: U256,
    /// Original requester
    pub admin: Address,
    /// Block number
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
}

/// Parsed RebalanceRequested event from Index.sol on L3
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RebalanceRequestedEvent {
    /// Address that requested the rebalance
    pub requester: Address,
    /// ITP identifier (bytes32)
    pub itp_id: H256,
    /// Indices of assets to remove
    pub remove_indices: Vec<U256>,
    /// Addresses of new assets to add
    pub add_assets: Vec<Address>,
    /// New target weights (18 decimals each)
    pub new_weights: Vec<U256>,
    /// Human-readable note
    pub note: String,
    /// Block number
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
}
