//! Ethers-rs compatible bindings for Index L3 contracts
//!
//! This module provides type mappings between Solidity contracts and Rust.
//! Since TypesLib.sol is a pure library (structs/enums only), we manually
//! define compatible types that match the Solidity ABI encoding.
//!
//! For contracts that have actual functions, use ethers::contract::abigen!
//! to generate bindings from their ABIs.

use ethers::types::{Address, Bytes, H256, U256};
use serde::{Deserialize, Serialize};

// Re-export all types from the types module
// These are already ethers-compatible (using U256, Address, H256, etc.)
pub use crate::types::{
    // Enums
    ITPStatus,
    IssuerStatus,
    OrderStatus,
    PriceSource,
    Side,
    TxType,
    // Structs
    CollateralMove,
    Fill,
    ITPCore,
    Issuer,
    KeyRotation,
    LimitOrder,
    PendingLock,
    PendingRebalance,
    Price,
    ReleaseProof,
    // Helpers
    string_to_bytes32,
};

/// ABI-encoded event signature for OrderSubmitted
/// keccak256("OrderSubmitted(uint256,address,bytes32,bytes32,uint8,uint256,uint256,uint256,uint256)")
pub const ORDER_SUBMITTED_SIGNATURE: &str =
    "OrderSubmitted(uint256,address,bytes32,bytes32,uint8,uint256,uint256,uint256,uint256)";

/// ABI-encoded event signature for BatchConfirmed
/// keccak256("BatchConfirmed(uint256,uint256[],bytes)")
pub const BATCH_CONFIRMED_SIGNATURE: &str = "BatchConfirmed(uint256,uint256[],bytes)";

/// ABI-encoded event signature for FillConfirmed
/// keccak256("FillConfirmed(uint256,uint256,uint256,uint256)")
pub const FILL_CONFIRMED_SIGNATURE: &str = "FillConfirmed(uint256,uint256,uint256,uint256)";

/// ABI-encoded event signature for TradeRequest
/// keccak256("TradeRequest(uint256,bytes32,uint8,uint256,uint256)")
pub const TRADE_REQUEST_SIGNATURE: &str = "TradeRequest(uint256,bytes32,uint8,uint256,uint256)";

/// ABI-encoded event signature for ITPCreated
/// keccak256("ITPCreated(bytes32,address,bytes32,bytes32,address[],uint256[])")
pub const ITP_CREATED_SIGNATURE: &str =
    "ITPCreated(bytes32,address,bytes32,bytes32,address[],uint256[])";

/// ABI-encoded event signature for BridgeLockConfirmed
/// keccak256("BridgeLockConfirmed(uint256,uint256,uint256,uint256,bytes32)")
pub const BRIDGE_LOCK_CONFIRMED_SIGNATURE: &str =
    "BridgeLockConfirmed(uint256,uint256,uint256,uint256,bytes32)";

/// ABI-encoded event signature for BridgeCompleted
/// keccak256("BridgeCompleted(uint256,uint256,uint256,bytes32)")
pub const BRIDGE_COMPLETED_SIGNATURE: &str = "BridgeCompleted(uint256,uint256,uint256,bytes32)";

/// ABI-encoded event signature for CollateralMoved
/// keccak256("CollateralMoved(bytes32,uint256,uint256,uint256,uint8)")
pub const COLLATERAL_MOVED_SIGNATURE: &str = "CollateralMoved(bytes32,uint256,uint256,uint256,uint8)";

/// Event data for OrderSubmitted
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OrderSubmittedEvent {
    pub order_id: U256,
    pub user: Address,
    pub itp_id: H256,
    pub pair_id: H256,
    pub side: u8,
    pub amount: U256,
    pub limit_price: U256,
    pub slippage_tier: U256,
    pub deadline: U256,
}

/// Event data for BatchConfirmed
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BatchConfirmedEvent {
    pub cycle_number: U256,
    pub order_ids: Vec<U256>,
    pub bls_signature: Bytes,
}

/// Event data for FillConfirmed
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FillConfirmedEvent {
    pub order_id: U256,
    pub cycle_number: U256,
    pub fill_price: U256,
    pub fill_amount: U256,
}

/// Event data for TradeRequest
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TradeRequestEvent {
    pub cycle_number: U256,
    pub pair_id: H256,
    pub side: u8,
    pub amount: U256,
    pub limit_price: U256,
}

/// Event data for ITPCreated
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ITPCreatedEvent {
    pub itp_id: H256,
    pub creator: Address,
    pub name: H256,
    pub symbol: H256,
    pub assets: Vec<Address>,
    pub weights: Vec<U256>,
}

/// Event data for BridgeLockConfirmed
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BridgeLockConfirmedEvent {
    pub nonce: U256,
    pub amount: U256,
    pub dest_chain_id: U256,
    pub block_number: U256,
    pub block_hash: H256,
}

/// Event data for BridgeCompleted
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BridgeCompletedEvent {
    pub source_chain_id: U256,
    pub nonce: U256,
    pub amount: U256,
    pub source_tx_hash: H256,
}

/// Event data for CollateralMoved
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CollateralMovedEvent {
    pub itp_id: H256,
    pub from_chain: U256,
    pub to_chain: U256,
    pub amount: U256,
    pub tx_type: u8,
}
