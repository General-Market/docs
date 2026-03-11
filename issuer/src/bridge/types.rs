//! Types for bridge orchestration
//!
//! Story 7.2: Bridge USDC Orchestrator (Settlement→L3)
//! Story 7.3: Submit Order for User
//! Story 7.4: Batch and Fill Orchestration

use std::sync::Arc;
use std::time::Instant;

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::Notify;

use crate::abi::AbiEncoder;
use crate::consensus::ConsensusError;
use common::decimals;
use common::types::{BLSSignature, PeerId};

/// Canonical result type for any BLS consensus round that produces
/// an aggregated signature, a signer bitmap, and a count.
#[derive(Debug, Clone)]
pub struct SignedConsensusResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

/// Bridge orchestrator configuration
#[derive(Debug, Clone)]
pub struct BridgeConfig {
    /// IssuerCustody L3 address (destination for bridged L3Usdc)
    pub issuer_custody_l3: Address,
    /// L3Usdc contract address
    pub l3_usdc_address: Address,
    /// SettlementBridgeCustody address (for order verification)
    pub settlement_custody_address: Address,
    /// Settlement chain ID (for message hash)
    pub settlement_chain_id: u64,
    /// L3 chain ID (for submit order message hash) - Story 7.3
    pub l3_chain_id: u64,
    /// Index contract address on L3 (for submitOrder calls) - Story 7.3
    pub index_address: Address,
    /// Minimum signatures required (typically 2/3 of issuers, e.g., 2 of 3)
    pub min_signatures: usize,
    /// Proposal timeout in milliseconds
    pub proposal_timeout_ms: u64,
    /// Signing timeout in milliseconds
    pub sign_timeout_ms: u64,
    /// IssuerCustody Settlement address (destination for bridged-back SettlementUSDC) - Story 7.5
    pub issuer_custody_settlement: Address,
    /// SettlementUSDC contract address (USDC token on Settlement) - Story 7.5
    pub settlement_usdc_address: Address,
    /// MockBitgetVault address for AP trading (Story 7.6)
    pub bitget_vault: Address,
    /// Issuer signer address (for bridge mint recipient in local E2E)
    pub signer_address: Address,
    /// CollateralRegistry contract address on L3 (8-step bridge Step 3)
    pub collateral_registry: Address,
    /// BridgeProxy contract address on Settlement (8-step bridge Step 8)
    pub bridge_proxy: Address,
    /// MirrorIssuerRegistry address on Settlement (for follower validation)
    pub mirror_registry_address: Option<Address>,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            issuer_custody_l3: Address::zero(),
            l3_usdc_address: Address::zero(),
            settlement_custody_address: Address::zero(),
            settlement_chain_id: 42161, // Settlement chain mainnet
            l3_chain_id: 111222333,   // Index L3 Orbit chain
            index_address: Address::zero(),
            min_signatures: 2,
            proposal_timeout_ms: 500,
            sign_timeout_ms: 300,
            issuer_custody_settlement: Address::zero(), // Story 7.5
            settlement_usdc_address: Address::zero(),   // Story 7.5
            bitget_vault: Address::zero(),       // Story 7.6
            signer_address: Address::zero(),
            collateral_registry: Address::zero(), // 8-step bridge
            bridge_proxy: Address::zero(),        // 8-step bridge
            mirror_registry_address: None,
        }
    }
}

/// Bridge order status tracking
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BridgeOrderStatus {
    /// Order received, waiting for consensus
    Pending,
    /// Successfully bridged USDC from Settlement to L3
    BridgedToL3,
    /// Order submitted on L3 (Story 7.3)
    SubmittedOnL3,
    /// Order included in confirmed batch (Story 7.4)
    Batched,
    /// Order filled and ITP shares minted (Story 7.4)
    Filled,
    /// Successfully bridged back from L3 to Settlement (Story 7.5)
    BridgedBackToSettlement,
    /// USDC released to MockBitgetVault for AP trading (Story 7.6)
    ReleasedToVault,
    /// BridgedITP shares minted on Settlement via BridgeProxy (Step 8)
    SharesBridged,
    /// Bridge failed
    Failed,
    /// Sell order received from Settlement, waiting for consensus
    SellPending,
    /// Burn tx submitted on Settlement, awaiting receipt (non-blocking)
    SellBurnPending,
    /// BridgedITP burned on Settlement, ready for L3 sell
    SellBurned,
    /// Sell order submitted on L3 via Index.submitOrderFor()
    SellSubmittedOnL3,
    /// Sell order filled on L3, USDC returned
    SellFilled,
    /// USDC bridged back to Settlement, completeSellOrder called
    SellCompleted,
}

/// Bridge proposal containing all order details for consensus
#[derive(Debug, Clone)]
pub struct BridgeProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// CrossChainOrder ID from SettlementBridgeCustody
    pub order_id: U256,
    /// ITP being purchased
    pub itp_id: H256,
    /// User who initiated the order on Settlement
    pub user: Address,
    /// USDC amount to bridge (18 decimals per TypesLib)
    pub amount: U256,
    /// Order deadline (must not be passed)
    pub deadline: U256,
    /// Leader's BLS signature on the bridge message
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Sell bridge proposal for cross-chain sell order consensus
#[derive(Debug, Clone)]
pub struct SellBridgeProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// CrossChainSellOrder ID from SettlementBridgeCustody
    pub order_id: U256,
    /// ITP being sold
    pub itp_id: H256,
    /// User who initiated the sell on Settlement
    pub user: Address,
    /// Bridged ITP token address on Settlement
    pub bridged_itp_address: Address,
    /// ITP amount to sell (18 decimals)
    pub amount: U256,
    /// Leader's BLS signature on the sell bridge message
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful sell order submission on L3
#[derive(Debug, Clone)]
pub struct SellSubmitOrderResult {
    /// L3 order ID assigned to the sell order
    pub l3_order_id: Option<U256>,
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

/// Result of successful completeSellOrder consensus
pub type CompleteSellOrderResult = SignedConsensusResult;

/// Complete sell order proposal for BLS consensus on Settlement
#[derive(Debug, Clone)]
pub struct CompleteSellProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Settlement sell order ID
    pub order_id: U256,
    /// USDC proceeds to return to user
    pub usdc_proceeds: U256,
    /// Leader's BLS signature
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Burn sell order proposal for BLS consensus on Settlement
#[derive(Debug, Clone)]
pub struct BurnSellOrderProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Settlement sell order ID
    pub order_id: U256,
    /// Leader's BLS signature
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful burnSellOrderShares consensus
pub type BurnSellOrderResult = SignedConsensusResult;

/// Result of successful bridge execution
pub type BridgeResult = SignedConsensusResult;

// ============================================================================
// Story 7.3: Submit Order for User Types
// ============================================================================

/// Submit order proposal for BLS consensus
/// Story 7.3: Submit Order for User
#[derive(Debug, Clone)]
pub struct SubmitOrderProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Original Settlement order ID (from CrossChainOrderCreated)
    pub settlement_order_id: U256,
    /// ITP being purchased
    pub itp_id: H256,
    /// Original Settlement user (for share distribution later)
    pub user: Address,
    /// USDC amount (18 decimals per TypesLib)
    pub amount: U256,
    /// Limit price (18 decimals)
    pub limit_price: U256,
    /// Slippage tier (0, 1, or 2)
    pub slippage_tier: U256,
    /// Order deadline
    pub deadline: U256,
    /// Leader's BLS signature on the message
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful order submission on L3
/// Story 7.3: Submit Order for User
#[derive(Debug, Clone)]
pub struct SubmitOrderResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
    /// Resulting order ID on L3 Index (from OrderSubmitted event)
    pub l3_order_id: Option<U256>,
}

/// Mapping between Settlement and L3 order IDs
/// Story 7.3: Submit Order for User
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderMapping {
    /// Original order ID from SettlementBridgeCustody
    pub settlement_order_id: U256,
    /// Resulting order ID from Index.submitOrder()
    pub l3_order_id: U256,
    /// Original user from Settlement (for share distribution)
    pub original_user: Address,
    /// Timestamp when mapping was created
    pub created_at: u64,
}

/// Collects BLS signatures from followers for bridge proposals.
/// Uses a `Notify` to wake the polling loop instantly when a signature arrives.
#[derive(Debug)]
pub struct SignatureCollector {
    /// Order ID being signed
    pub order_id: U256,
    /// Collected signatures: (signer_index, signature)
    signatures: Vec<(u8, BLSSignature)>,
    /// Bitmap of signers (bit i = issuer i signed)
    signer_bitmap: U256,
    /// Timestamp when collection started
    started_at: Instant,
    /// Wakes the polling loop when a new signature arrives
    notify: Arc<Notify>,
}

impl SignatureCollector {
    /// Create a new signature collector for an order
    pub fn new(order_id: U256) -> Self {
        Self {
            order_id,
            signatures: Vec::new(),
            signer_bitmap: U256::zero(),
            started_at: Instant::now(),
            notify: Arc::new(Notify::new()),
        }
    }

    /// Get a handle to the notifier (for the polling loop)
    pub fn notifier(&self) -> Arc<Notify> {
        Arc::clone(&self.notify)
    }

    /// Add a signature from a follower
    ///
    /// Returns true if the signature was added, false if already signed by this index
    pub fn add_signature(&mut self, signer_index: u8, signature: BLSSignature) -> bool {
        // Check if already signed by this index
        if self.signer_bitmap.bit(signer_index as usize) {
            return false;
        }

        // Add signature and update bitmap
        self.signatures.push((signer_index, signature));
        self.signer_bitmap = self.signer_bitmap | (U256::one() << signer_index);
        // Wake polling loop immediately
        self.notify.notify_waiters();
        true
    }

    /// Check if the threshold has been reached
    pub fn has_threshold(&self, min_signatures: usize) -> bool {
        self.signatures.len() >= min_signatures
    }

    /// Get the number of collected signatures
    pub fn signature_count(&self) -> usize {
        self.signatures.len()
    }

    /// Get the signer bitmap
    pub fn signer_bitmap(&self) -> U256 {
        self.signer_bitmap
    }

    /// Get all collected signatures
    pub fn signatures(&self) -> &[(u8, BLSSignature)] {
        &self.signatures
    }

    /// Get the time elapsed since collection started
    pub fn elapsed_ms(&self) -> u64 {
        self.started_at.elapsed().as_millis() as u64
    }

    /// Check if the collection has timed out
    pub fn is_timed_out(&self, timeout_ms: u64) -> bool {
        self.elapsed_ms() > timeout_ms
    }
}

/// Errors that can occur during bridge orchestration
#[derive(Debug, Clone, Error)]
pub enum BridgeError {
    #[error(transparent)]
    Consensus(#[from] ConsensusError),

    #[error("order expired: deadline {deadline} < now {now}")]
    OrderExpired { deadline: u64, now: u64 },

    #[error("order not found: {order_id}")]
    OrderNotFound { order_id: U256 },

    #[error("proposal mismatch: {field} differs from on-chain")]
    ProposalMismatch { field: String },

    #[error("already processed: order {order_id} already bridged")]
    AlreadyProcessed { order_id: U256 },

    #[error("not leader: cannot propose bridge")]
    NotLeader,

    #[error("no valid fills after filtering zero-amount orders")]
    NoPendingOrders,

    #[error("P2P error: {reason}")]
    P2PError { reason: String },

    // Story 7.3: Submit Order for User error variants
    #[error("order not bridged: {settlement_order_id} has status {status:?}")]
    OrderNotBridged { settlement_order_id: U256, status: Option<BridgeOrderStatus> },

    #[error("insufficient custody balance: need {required}, have {available}")]
    InsufficientCustodyBalance { required: U256, available: U256 },

    #[error("ITP not found on L3: {itp_id:?}")]
    ItpNotFound { itp_id: H256 },

    #[error("invalid slippage tier: {tier} (must be 0, 1, or 2)")]
    InvalidSlippageTier { tier: U256 },

    #[error("custody execute failed: {reason}")]
    CustodyExecuteFailed { reason: String },

    #[error("submit order failed: {reason}")]
    SubmitOrderFailed { reason: String },

    #[error("event parse error: {reason}")]
    EventParseError { reason: String },

    #[error("order already submitted: settlement_order_id={settlement_order_id} maps to l3_order_id={l3_order_id}")]
    OrderAlreadySubmitted { settlement_order_id: U256, l3_order_id: U256 },

    // Story 7.4: Batch and Fill error variants
    #[error("batch already confirmed: cycle {cycle_number}")]
    BatchAlreadyConfirmed { cycle_number: u64 },

    #[error("fills already confirmed: cycle {cycle_number}")]
    FillsAlreadyConfirmed { cycle_number: u64 },

    #[error("cycle not found: {cycle_number}")]
    CycleNotFound { cycle_number: u64 },

    #[error("order not in batch: {order_id}")]
    OrderNotInBatch { order_id: U256 },

    #[error("price out of tolerance: expected {expected}, got {actual}")]
    PriceOutOfTolerance { expected: U256, actual: U256 },

    #[error("fill amount exceeds order: order_id={order_id}, order_amount={order_amount}, fill_amount={fill_amount}")]
    FillAmountExceedsOrder { order_id: U256, order_amount: U256, fill_amount: U256 },

    #[error("invalid fill price: price cannot be zero for order_id={order_id}")]
    InvalidFillPrice { order_id: U256 },

    #[error("confirm batch failed: {reason}")]
    ConfirmBatchFailed { reason: String },

    #[error("confirm fills failed: {reason}")]
    ConfirmFillsFailed { reason: String },

    // Story 7.5: Bridge L3→Settlement error variants
    #[error("order not batched: {order_id} has status {status:?}")]
    OrderNotBatched { order_id: U256, status: BridgeOrderStatus },

    #[error("bridge L3→Settlement already processed: cycle {cycle_number}")]
    BridgeL3ToSettlementAlreadyProcessed { cycle_number: u64 },

    #[error("amount mismatch: expected {expected}, got {actual}")]
    AmountMismatch { expected: U256, actual: U256 },

    #[error("bridge L3→Settlement failed: {reason}")]
    BridgeL3ToSettlementFailed { reason: String },

    #[error("invalid destination: expected {expected:?}, got {actual:?}")]
    InvalidDestination { expected: Address, actual: Address },

    // Story 7.6: Custody Release to Vault error variants
    #[error("order not bridged back: {order_id} has status {status:?}")]
    OrderNotBridgedBack { order_id: U256, status: BridgeOrderStatus },

    #[error("custody release already processed: cycle {cycle_number}")]
    ReleaseAlreadyProcessed { cycle_number: u64 },

    #[error("vault address mismatch: expected {expected:?}, got {actual:?}")]
    VaultAddressMismatch { expected: Address, actual: Address },

    #[error("custody release failed: {reason}")]
    CustodyReleaseFailed { reason: String },

    // 8-step bridge: RecordCollateralMove error variants
    #[error("collateral move already recorded: cycle {cycle_number}")]
    CollateralMoveAlreadyRecorded { cycle_number: u64 },

    #[error("record collateral move failed: {reason}")]
    RecordCollateralMoveFailed { reason: String },

    // 8-step bridge: MintBridgedShares error variants
    #[error("mint bridged shares already processed: cycle {cycle_number}")]
    MintBridgedSharesAlreadyProcessed { cycle_number: u64 },

    #[error("mint bridged shares failed: {reason}")]
    MintBridgedSharesFailed { reason: String },

    #[error("consensus timeout: {phase}")]
    ConsensusTimeout { phase: String },

    #[error("signature collection not found: {label} key={key}")]
    CollectionNotFound { label: String, key: String },
}

/// Build the message hash for bridge Settlement→L3 consensus
///
/// Layout (180 bytes packed):
/// - chain_id: 32 bytes (Settlement chain ID)
/// - order_id: 32 bytes
/// - itp_id: 32 bytes
/// - user: 20 bytes (packed address)
/// - amount: 32 bytes
/// - deadline: 32 bytes
///
/// This matches the format expected for BLS signature verification.
pub fn build_bridge_settlement_to_l3_hash(
    chain_id: u64,
    order_id: U256,
    itp_id: H256,
    user: Address,
    amount: U256,
    deadline: U256,
) -> H256 {
    AbiEncoder::with_capacity(180)
        .u256(U256::from(chain_id))
        .u256(order_id)
        .h256(itp_id)
        .address_packed(user)
        .u256(amount)
        .u256(deadline)
        .keccak256()
}

// ============================================================================
// Cross-Chain Sell Order Hash and Calldata Builders
// ============================================================================

/// Build the consensus hash for burnSellOrderShares
///
/// Must match the contract's verification:
/// `keccak256(abi.encode(block.chainid, address(this), "burnSellOrderShares", orderId))`
pub fn build_burn_sell_order_hash(
    chain_id: u64,
    custody_address: Address,
    order_id: U256,
) -> H256 {
    // abi.encode(uint256, address, string, uint256)
    // Head: 4 slots (chain_id, address, string_offset, order_id)
    // Tail: string length + padded data for "burnSellOrderShares"
    AbiEncoder::with_capacity(224)
        .u256(U256::from(chain_id))
        .address_padded(custody_address)
        .u256(U256::from(128)) // string offset (4 * 32)
        .u256(order_id)
        .string_with_length(b"burnSellOrderShares")
        .keccak256()
}

/// Build calldata for SettlementBridgeCustody.burnSellOrderShares()
///
/// Selector: keccak256("burnSellOrderShares(uint256,bytes,uint256,uint256)")[0:4]
///
/// ABI encodes: orderId, blsSignature, referenceNonce, signersBitmask
pub fn build_burn_sell_order_calldata(
    order_id: U256,
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        "burnSellOrderShares(uint256,bytes,uint256,uint256)"
    )[..4];

    let mut calldata = selector.to_vec();
    let tail = AbiEncoder::new()
        .u256(order_id)
        .u256(U256::from(128)) // blsSignature offset (4 * 32)
        .u256(U256::from(reference_nonce))
        .u256(signers_bitmask)
        .bytes_with_length(bls_signature)
        .finish();
    calldata.extend_from_slice(&tail);
    calldata
}

/// Build the message hash for sell bridge consensus
///
/// Layout (212 bytes packed):
/// - chain_id: 32 bytes (Settlement chain ID)
/// - order_id: 32 bytes
/// - itp_id: 32 bytes
/// - user: 20 bytes (packed address)
/// - bridged_itp_address: 20 bytes (packed address)
/// - amount: 32 bytes
///
/// This matches the format expected for BLS signature verification.
pub fn build_sell_bridge_hash(
    chain_id: u64,
    order_id: U256,
    itp_id: H256,
    user: Address,
    bridged_itp_address: Address,
    amount: U256,
) -> H256 {
    AbiEncoder::with_capacity(168)
        .u256(U256::from(chain_id))
        .u256(order_id)
        .h256(itp_id)
        .address_packed(user)
        .address_packed(bridged_itp_address)
        .u256(amount)
        .keccak256()
}

/// Build the consensus hash for completeSellOrder
///
/// Must match the contract's verification:
/// `keccak256(abi.encode(block.chainid, address(this), "completeSellOrder", orderId, usdcProceeds))`
///
/// Uses ABI encoding (dynamic string with offset, length, padded data).
pub fn build_complete_sell_order_consensus_hash(
    chain_id: u64,
    custody_address: Address,
    order_id: U256,
    usdc_proceeds: U256,
    vault: Address,
) -> H256 {
    // abi.encode(uint256, address, string, uint256, uint256, address)
    // Head: 6 slots (chain_id, address, string_offset, order_id, usdc_proceeds, vault)
    // Tail: string length + padded data for "completeSellOrder"
    AbiEncoder::with_capacity(288)
        .u256(U256::from(chain_id))
        .address_padded(custody_address)
        .u256(U256::from(192)) // string offset (6 * 32)
        .u256(order_id)
        .u256(usdc_proceeds)
        .address_padded(vault)
        .string_with_length(b"completeSellOrder")
        .keccak256()
}

/// Build calldata for SettlementBridgeCustody.completeSellOrder()
///
/// Selector: keccak256("completeSellOrder(uint256,uint256,address,bytes,uint256,uint256)")[0:4]
///
/// ABI encodes: orderId, usdcProceeds, vault, blsSignature, referenceNonce, signersBitmask
pub fn build_complete_sell_order_calldata(
    order_id: U256,
    usdc_proceeds: U256,
    vault: Address,
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        "completeSellOrder(uint256,uint256,address,bytes,uint256,uint256)"
    )[..4];

    let mut calldata = selector.to_vec();
    let tail = AbiEncoder::new()
        .u256(order_id)
        .u256(usdc_proceeds)
        .address_padded(vault)
        .u256(U256::from(192)) // blsSignature offset (6 * 32)
        .u256(U256::from(reference_nonce))
        .u256(signers_bitmask)
        .bytes_with_length(bls_signature)
        .finish();
    calldata.extend_from_slice(&tail);
    calldata
}

// ============================================================================
// Story 7.3: Submit Order Hash and Calldata Builders
// ============================================================================

/// Build the message hash for submit order consensus
///
/// Layout (244 bytes packed):
/// - chain_id: 32 bytes (L3 chain ID)
/// - settlement_order_id: 32 bytes
/// - itp_id: 32 bytes
/// - user: 20 bytes (packed address - original Settlement user)
/// - amount: 32 bytes
/// - limit_price: 32 bytes
/// - slippage_tier: 32 bytes
/// - deadline: 32 bytes
///
/// Story 7.3: Submit Order for User
pub fn build_submit_order_hash(
    chain_id: u64,
    settlement_order_id: U256,
    itp_id: H256,
    user: Address,
    amount: U256,
    limit_price: U256,
    slippage_tier: U256,
    deadline: U256,
) -> H256 {
    AbiEncoder::with_capacity(244)
        .u256(U256::from(chain_id))
        .u256(settlement_order_id)
        .h256(itp_id)
        .address_packed(user)
        .u256(amount)
        .u256(limit_price)
        .u256(slippage_tier)
        .u256(deadline)
        .keccak256()
}

/// Build calldata for ERC20.approve(spender, amount)
///
/// Selector: 0x095ea7b3 (approve(address,uint256))
///
/// Story 7.3: Submit Order for User
pub fn build_erc20_approve_calldata(spender: Address, amount: U256) -> Vec<u8> {
    let selector = &ethers::utils::keccak256("approve(address,uint256)")[..4];

    let mut calldata = selector.to_vec();
    let tail = AbiEncoder::new()
        .address_padded(spender)
        .u256(amount)
        .finish();
    calldata.extend_from_slice(&tail);
    calldata
}

/// Build calldata for Index.submitOrder()
///
/// Selector: keccak256("submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256)")
///
/// Story 7.3: Submit Order for User
pub fn build_submit_order_calldata(
    itp_id: H256,
    side: u8,  // 0 = BUY, 1 = SELL
    amount: U256,
    limit_price: U256,
    slippage_tier: U256,
    deadline: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        "submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256)"
    )[..4];

    let mut calldata = selector.to_vec();
    let tail = AbiEncoder::new()
        .h256(itp_id)
        .u8_padded(side)
        .u256(amount)
        .u256(limit_price)
        .u256(slippage_tier)
        .u256(deadline)
        .finish();
    calldata.extend_from_slice(&tail);
    calldata
}

/// Build calldata for Index.submitOrderFor()
///
/// Selector: keccak256("submitOrderFor(address,bytes32,uint8,uint256,uint256,uint256,uint256)")
///
/// Story submitOrderFor: Submit order on behalf of original cross-chain user
pub fn build_submit_order_for_calldata(
    beneficiary: Address,
    itp_id: H256,
    side: u8,  // 0 = BUY, 1 = SELL
    amount: U256,
    limit_price: U256,
    slippage_tier: U256,
    deadline: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        "submitOrderFor(address,bytes32,uint8,uint256,uint256,uint256,uint256)"
    )[..4];

    let mut calldata = selector.to_vec();
    let tail = AbiEncoder::new()
        .address_padded(beneficiary)
        .h256(itp_id)
        .u8_padded(side)
        .u256(amount)
        .u256(limit_price)
        .u256(slippage_tier)
        .u256(deadline)
        .finish();
    calldata.extend_from_slice(&tail);
    calldata
}

// ============================================================================
// Story 7.4: Batch and Fill Orchestration Types
// ============================================================================

/// Batch confirmation proposal for BLS consensus
/// Story 7.4: Batch and Fill Orchestration
#[derive(Debug, Clone)]
pub struct BatchProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Cycle number for this batch
    pub cycle_number: u64,
    /// Order IDs included in batch
    pub order_ids: Vec<U256>,
    /// Current prices for each order's ITP (18 decimals)
    pub prices: Vec<U256>,
    /// Leader's BLS signature on the batch hash
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful batch confirmation
/// Story 7.4: Batch and Fill Orchestration
pub type BatchResult = SignedConsensusResult;

/// Single order fill for consensus
/// Story 7.4: Batch and Fill Orchestration
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fill {
    /// Order ID being filled
    pub order_id: U256,
    /// Price at which order was filled (18 decimals)
    pub fill_price: U256,
    /// Amount filled (in quote asset, typically USDC, 18 decimals)
    pub fill_amount: U256,
}

/// Fills confirmation proposal for BLS consensus
/// Story 7.4: Batch and Fill Orchestration
#[derive(Debug, Clone)]
pub struct FillsProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Cycle number for these fills
    pub cycle_number: u64,
    /// Fill details for each order
    pub fills: Vec<Fill>,
    /// Leader's BLS signature on the fills hash
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful fills confirmation
/// Story 7.4: Batch and Fill Orchestration
pub type FillsResult = SignedConsensusResult;

// ============================================================================
// Story 7.5: Bridge L3→Settlement Types
// ============================================================================

/// Bridge L3→Settlement proposal for BLS consensus
/// Story 7.5: Bridge USDC L3 to Settlement
#[derive(Debug, Clone)]
pub struct BridgeL3ToSettlementProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Cycle number that batched these orders
    pub cycle_number: u64,
    /// Order IDs being bridged back
    pub order_ids: Vec<U256>,
    /// Total USDC amount to bridge (18 decimals)
    pub total_amount: U256,
    /// Destination: IssuerCustody on Settlement
    pub destination: Address,
    /// Leader's BLS signature on the bridge hash
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful bridge L3→Settlement execution
/// Story 7.5: Bridge USDC L3 to Settlement
pub type BridgeL3ToSettlementResult = SignedConsensusResult;

// ============================================================================
// Story 7.6: Custody Release to Vault Types
// ============================================================================

/// Release to vault proposal for BLS consensus
/// Story 7.6: Custody Release to MockBitgetVault
#[derive(Debug, Clone)]
pub struct ReleaseToVaultProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Cycle number that processed these orders
    pub cycle_number: u64,
    /// Order IDs being released
    pub order_ids: Vec<U256>,
    /// Total USDC amount to release (18 decimals)
    pub total_amount: U256,
    /// Destination: MockBitgetVault on Settlement
    pub vault_address: Address,
    /// Leader's BLS signature on the release hash
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful custody release to vault
/// Story 7.6: Custody Release to MockBitgetVault
pub type ReleaseToVaultResult = SignedConsensusResult;

// ============================================================================
// 8-step bridge: RecordCollateralMove Types
// ============================================================================

/// Proposal for recording collateral movement in CollateralRegistry
/// This is Step 3 of the 8-step bridge: after batch confirm, before L3→Settlement bridge.
#[derive(Debug, Clone)]
pub struct RecordCollateralMoveProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Cycle number for this batch
    pub cycle_number: u64,
    /// ITP being processed
    pub itp_id: H256,
    /// Source chain ID (L3 = 111222333)
    pub from_chain: U256,
    /// Destination chain ID (Settlement = 42161)
    pub to_chain: U256,
    /// Amount being moved (18 decimals)
    pub amount: U256,
    /// Transaction type (0 = BUY)
    pub tx_type: u8,
    /// Leader's BLS signature
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful RecordCollateralMove consensus
pub type RecordCollateralMoveResult = SignedConsensusResult;

// ============================================================================
// 8-step bridge: MintBridgedShares Types
// ============================================================================

/// Proposal for minting BridgedITP shares on Settlement via BridgeProxy
/// This is Step 8 of the 8-step bridge: after fills confirmed.
#[derive(Debug, Clone)]
pub struct MintBridgedSharesProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Cycle number for this batch
    pub cycle_number: u64,
    /// ITP ID
    pub itp_id: H256,
    /// User receiving shares
    pub user: Address,
    /// Number of shares to mint (18 decimals)
    pub amount: U256,
    /// Settlement order ID for replay protection
    pub order_id: U256,
    /// Leader's BLS signature
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful MintBridgedShares consensus
pub type MintBridgedSharesResult = SignedConsensusResult;

/// Proposal for completeBuyOrder BLS consensus
#[derive(Debug, Clone)]
pub struct CompleteBuyOrderProposal {
    pub leader_id: PeerId,
    pub cycle_number: u64,
    pub order_id: U256,
    pub vault: Address,
    pub leader_signature: BLSSignature,
    pub message_hash: H256,
}

/// Result of completeBuyOrder BLS consensus
pub type CompleteBuyOrderResult = SignedConsensusResult;

// ============================================================================
// 8-step bridge: Hash Builders
// ============================================================================

/// Build message hash for RecordCollateralMove consensus
///
/// Matches: keccak256(abi.encode(chainid, collateralRegistry, itpId, fromChain, toChain, amount, txType))
/// Uses ABI encoding (32-byte padded addresses).
pub fn build_record_collateral_move_hash(
    chain_id: u64,
    collateral_registry: Address,
    itp_id: H256,
    from_chain: U256,
    to_chain: U256,
    amount: U256,
    tx_type: u8,
) -> H256 {
    AbiEncoder::with_capacity(256)
        .u256(U256::from(chain_id))
        .address_padded(collateral_registry)
        .h256(itp_id)
        .u256(from_chain)
        .u256(to_chain)
        .u256(amount)
        .u8_padded(tx_type)
        .keccak256()
}

/// Build message hash for MintBridgedShares consensus
///
/// Matches: keccak256(abi.encode(chainid, bridgeProxy, "mintBridgedShares", itpId, user, amount, orderId))
/// Uses ABI encoding with dynamic string.
pub fn build_mint_bridged_shares_hash(
    chain_id: u64,
    bridge_proxy: Address,
    itp_id: H256,
    user: Address,
    amount: U256,
    order_id: U256,
) -> H256 {
    // abi.encode(uint256, address, string, bytes32, address, uint256, uint256)
    // Head: 7 slots (chain_id, address, string_offset, itp_id, user, amount, order_id)
    // Tail: string length + padded data for "mintBridgedShares"
    let hash = AbiEncoder::with_capacity(352)
        .u256(U256::from(chain_id))
        .address_padded(bridge_proxy)
        .u256(U256::from(224)) // string offset (7 * 32)
        .h256(itp_id)
        .address_padded(user)
        .u256(amount)
        .u256(order_id)
        .string_with_length(b"mintBridgedShares")
        .keccak256();
    tracing::debug!(
        %chain_id,
        bridge_proxy = ?bridge_proxy,
        itp_id = ?itp_id,
        user = ?user,
        amount = %amount,
        order_id = %order_id,
        hash = ?hash,
        "build_mint_bridged_shares_hash"
    );
    hash
}

/// Build message hash for completeBuyOrder consensus
///
/// Matches: keccak256(abi.encode(chainid, settlementCustody, "completeBuyOrder", orderId, vault))
/// Uses ABI encoding with dynamic string.
pub fn build_complete_buy_order_hash(
    chain_id: u64,
    settlement_custody: Address,
    order_id: U256,
    vault: Address,
) -> H256 {
    // abi.encode(uint256, address, string, uint256, address)
    // Head: 5 slots (chain_id, address, string_offset, orderId, vault)
    // Tail: string length + padded data for "completeBuyOrder"
    AbiEncoder::with_capacity(224)
        .u256(U256::from(chain_id))
        .address_padded(settlement_custody)
        .u256(U256::from(160)) // string offset (5 * 32)
        .u256(order_id)
        .address_padded(vault)
        .string_with_length(b"completeBuyOrder")
        .keccak256()
}

/// Build calldata for CollateralRegistry.recordCollateralMove(itpId, fromChain, toChain, amount, txType, blsSig, referenceNonce, signersBitmask)
pub fn build_record_collateral_move_calldata(
    itp_id: H256,
    from_chain: U256,
    to_chain: U256,
    amount: U256,
    tx_type: u8,
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    // recordCollateralMove(bytes32,uint256,uint256,uint256,uint8,bytes,uint256,uint256)
    let selector = &ethers::utils::keccak256("recordCollateralMove(bytes32,uint256,uint256,uint256,uint8,bytes,uint256,uint256)")[..4];
    let mut data = selector.to_vec();
    let tail = AbiEncoder::new()
        .h256(itp_id)
        .u256(from_chain)
        .u256(to_chain)
        .u256(amount)
        .u8_padded(tx_type)
        .u256(U256::from(256)) // bls_signature offset (8 * 32)
        .u256(U256::from(reference_nonce))
        .u256(signers_bitmask)
        .bytes_with_length(bls_signature)
        .finish();
    data.extend_from_slice(&tail);
    data
}

/// Build calldata for BridgeProxy.mintBridgedShares(itpId, user, amount, orderId, blsSignature, referenceNonce, signersBitmask)
pub fn build_mint_bridged_shares_calldata(
    itp_id: H256,
    user: Address,
    amount: U256,
    order_id: U256,
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    // mintBridgedShares(bytes32,address,uint256,uint256,bytes,uint256,uint256)
    let selector = &ethers::utils::keccak256("mintBridgedShares(bytes32,address,uint256,uint256,bytes,uint256,uint256)")[..4];
    let mut data = selector.to_vec();
    let tail = AbiEncoder::new()
        .h256(itp_id)
        .address_padded(user)
        .u256(amount)
        .u256(order_id)
        .u256(U256::from(224)) // blsSignature offset (7 * 32)
        .u256(U256::from(reference_nonce))
        .u256(signers_bitmask)
        .bytes_with_length(bls_signature)
        .finish();
    data.extend_from_slice(&tail);
    data
}

// ============================================================================
// Story 7.6: Custody Release Hash and Calldata Builders
// ============================================================================

/// Build message hash for custody release to vault consensus
///
/// Layout (variable size):
/// - chain_id: 32 bytes (Settlement chain ID)
/// - custody_address: 32 bytes (IssuerCustody Settlement)
/// - cycle_number: 32 bytes
/// - order_count: 32 bytes
/// - order_ids: 32 bytes each
/// - total_amount: 32 bytes
/// - vault_address: 32 bytes
///
/// Story 7.6: Custody Release to MockBitgetVault
pub fn build_release_to_vault_hash(
    chain_id: u64,
    custody_address: Address,
    cycle_number: u64,
    order_ids: &[U256],
    total_amount: U256,
    vault_address: Address,
) -> H256 {
    let mut enc = AbiEncoder::with_capacity(192 + order_ids.len() * 32)
        .u256(U256::from(chain_id))
        .address_padded(custody_address)
        .u256(U256::from(cycle_number))
        .u256(U256::from(order_ids.len()));
    for order_id in order_ids {
        enc = enc.u256(*order_id);
    }
    enc.u256(total_amount)
        .address_padded(vault_address)
        .keccak256()
}

/// Build calldata for ERC20.transfer(address,uint256)
///
/// Selector: keccak256("transfer(address,uint256)")[0:4] = 0xa9059cbb
///
/// Story 7.6: Custody Release to MockBitgetVault (Task 5)
pub fn build_erc20_transfer_calldata(recipient: Address, amount: U256) -> Vec<u8> {
    let selector = &ethers::utils::keccak256("transfer(address,uint256)")[..4];

    let mut calldata = selector.to_vec();
    let tail = AbiEncoder::new()
        .address_padded(recipient)
        .u256(amount)
        .finish();
    calldata.extend_from_slice(&tail);
    calldata
}

/// Build calldata for USDC.transfer(address,uint256) with decimal conversion
///
/// Takes 18-decimal internal amount, converts to 6-decimal USDC for transfer.
/// Use this for Settlementitrum USDC transfers where real USDC has 6 decimals.
///
/// Story 7-6b: USDC Decimal Conversion (Task 10)
pub fn build_usdc_transfer_calldata(recipient: Address, internal_amount: U256) -> Vec<u8> {
    // Convert 18-decimal internal amount to 6-decimal USDC
    let usdc_amount = decimals::to_usdc(internal_amount);
    build_erc20_transfer_calldata(recipient, usdc_amount)
}

/// Build calldata for USDC.transfer with explicit amounts for verification
///
/// Returns both the calldata and the converted 6-decimal amount.
/// Useful when caller needs to verify the conversion.
///
/// Story 7-6b: USDC Decimal Conversion (Task 10)
pub fn build_usdc_transfer_calldata_with_amount(
    recipient: Address,
    internal_amount: U256,
) -> (Vec<u8>, U256) {
    let usdc_amount = decimals::to_usdc(internal_amount);
    let calldata = build_erc20_transfer_calldata(recipient, usdc_amount);
    (calldata, usdc_amount)
}

// ============================================================================
// Story 7.5: Bridge L3→Settlement Hash Builder
// ============================================================================

/// Build message hash for bridge L3→Settlement consensus
///
/// Layout (variable size):
/// - l3_chain_id: 32 bytes
/// - cycle_number: 32 bytes
/// - order_count: 32 bytes
/// - order_ids: 32 bytes each
/// - total_amount: 32 bytes
/// - destination: 32 bytes (address padded)
///
/// Story 7.5: Bridge USDC L3 to Settlement
pub fn build_bridge_l3_to_settlement_hash(
    l3_chain_id: u64,
    cycle_number: u64,
    order_ids: &[U256],
    total_amount: U256,
    destination: Address,
) -> H256 {
    let mut enc = AbiEncoder::with_capacity(160 + order_ids.len() * 32)
        .u256(U256::from(l3_chain_id))
        .u256(U256::from(cycle_number))
        .u256(U256::from(order_ids.len()));
    for order_id in order_ids {
        enc = enc.u256(*order_id);
    }
    enc.u256(total_amount)
        .address_padded(destination)
        .keccak256()
}

/// Build the message hash for batch confirmation consensus
///
/// Layout (variable size):
/// - chain_id: 32 bytes
/// - cycle_number: 32 bytes
/// - order_count: 32 bytes
/// - order_ids: 32 bytes each
/// - prices: 32 bytes each
///
/// Story 7.4: Batch and Fill Orchestration
pub fn build_confirm_batch_hash(
    chain_id: u64,
    contract_address: Address,
    cycle_number: u64,
    order_ids: &[U256],
) -> H256 {
    // Must match Solidity: keccak256(abi.encode(block.chainid, address(this), cycleNumber, orderIds))
    use ethers::abi::Token;
    let tokens = vec![
        Token::Uint(U256::from(chain_id)),
        Token::Address(contract_address),
        Token::Uint(U256::from(cycle_number)),
        Token::Array(order_ids.iter().map(|&id| Token::Uint(id)).collect()),
    ];
    H256::from_slice(&ethers::utils::keccak256(&ethers::abi::encode(&tokens)))
}

/// Build the message hash for fills confirmation consensus
///
/// Must match Solidity: keccak256(abi.encode(block.chainid, address(this), cycleNumber, fills))
/// where Fill is (uint256 orderId, uint256 fillPrice, uint256 fillAmount, uint256 cycleNumber, bytes32 txHash)
///
/// Story 7.4: Batch and Fill Orchestration
pub fn build_confirm_fills_hash(
    chain_id: u64,
    contract_address: Address,
    cycle_number: u64,
    fills: &[Fill],
) -> H256 {
    use ethers::abi::Token;
    let fill_tokens: Vec<Token> = fills.iter().map(|f| {
        Token::Tuple(vec![
            Token::Uint(f.order_id),
            Token::Uint(f.fill_price),
            Token::Uint(f.fill_amount),
            Token::Uint(U256::from(cycle_number)), // cycleNumber matches function param
            Token::FixedBytes(vec![0u8; 32]),       // txHash = zero (not validated on-chain)
        ])
    }).collect();
    let tokens = vec![
        Token::Uint(U256::from(chain_id)),
        Token::Address(contract_address),
        Token::Uint(U256::from(cycle_number)),
        Token::Array(fill_tokens),
    ];
    H256::from_slice(&ethers::utils::keccak256(&ethers::abi::encode(&tokens)))
}

/// Build calldata for Index.confirmBatch()
///
/// Selector: keccak256("confirmBatch(uint256,uint256[],bytes)")
///
/// Story 7.4: Batch and Fill Orchestration
pub fn build_confirm_batch_calldata(
    cycle_number: u64,
    order_ids: &[U256],
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    use ethers::abi::{Function, Param, ParamType, StateMutability, Token};

    let function = Function {
        name: "confirmBatch".to_string(),
        inputs: vec![
            Param { name: "cycleNumber".into(), kind: ParamType::Uint(256), internal_type: None },
            Param { name: "orderIds".into(), kind: ParamType::Array(Box::new(ParamType::Uint(256))), internal_type: None },
            Param { name: "blsSignature".into(), kind: ParamType::Bytes, internal_type: None },
            Param { name: "referenceNonce".into(), kind: ParamType::Uint(256), internal_type: None },
            Param { name: "signersBitmask".into(), kind: ParamType::Uint(256), internal_type: None },
        ],
        outputs: vec![],
        #[allow(deprecated)]
        constant: None,
        state_mutability: StateMutability::NonPayable,
    };

    let tokens = vec![
        Token::Uint(U256::from(cycle_number)),
        Token::Array(order_ids.iter().map(|&id| Token::Uint(id)).collect()),
        Token::Bytes(bls_signature.to_vec()),
        Token::Uint(U256::from(reference_nonce)),
        Token::Uint(signers_bitmask),
    ];

    function.encode_input(&tokens).expect("ABI encoding should not fail")
}

// ============================================================================
// Story 7.4: BLSCustody.execute() Hash and Calldata Builders (Task 7)
// ============================================================================

/// Build the message hash for BLSCustody.execute() BLS signing
///
/// Matches Solidity: `keccak256(abi.encode(block.chainid, address(this), target, data, nonceValue))`
///
/// Layout (ABI encoded, variable size):
/// - chain_id: 32 bytes
/// - custody_address: 32 bytes (address padded to 32 bytes)
/// - target: 32 bytes (address padded to 32 bytes)
/// - data_offset: 32 bytes (offset to data bytes = 160 for fixed params)
/// - nonce: 32 bytes
/// - data_length: 32 bytes
/// - data: variable (padded to 32-byte boundary)
///
/// Story 7.4: Task 7.2
pub fn build_custody_execute_hash(
    chain_id: u64,
    custody_address: Address,
    target: Address,
    data: &[u8],
    nonce: U256,
) -> H256 {
    // Use ABI encoding (abi.encode) as per Solidity contract
    AbiEncoder::new()
        .u256(U256::from(chain_id))
        .address_padded(custody_address)
        .address_padded(target)
        .u256(U256::from(160)) // data offset (5 * 32)
        .u256(nonce)
        .bytes_with_length(data)
        .keccak256()
}

/// Build calldata for BLSCustody.execute()
///
/// Selector: keccak256("execute(address,bytes,bytes,uint256,uint256,uint256)")[0:4]
///
/// Story 7.4: Task 7.1
pub fn build_custody_execute_calldata(
    target: Address,
    data: &[u8],
    bls_signature: &[u8],
    nonce: U256,
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    use ethers::abi::{Function, Param, ParamType, StateMutability, Token};

    let function = Function {
        name: "execute".to_string(),
        inputs: vec![
            Param { name: "target".into(), kind: ParamType::Address, internal_type: None },
            Param { name: "data".into(), kind: ParamType::Bytes, internal_type: None },
            Param { name: "blsSignature".into(), kind: ParamType::Bytes, internal_type: None },
            Param { name: "nonce".into(), kind: ParamType::Uint(256), internal_type: None },
            Param { name: "referenceNonce".into(), kind: ParamType::Uint(256), internal_type: None },
            Param { name: "signersBitmask".into(), kind: ParamType::Uint(256), internal_type: None },
        ],
        outputs: vec![],
        #[allow(deprecated)]
        constant: None,
        state_mutability: StateMutability::NonPayable,
    };

    let tokens = vec![
        Token::Address(target),
        Token::Bytes(data.to_vec()),
        Token::Bytes(bls_signature.to_vec()),
        Token::Uint(nonce),
        Token::Uint(U256::from(reference_nonce)),
        Token::Uint(signers_bitmask),
    ];

    function.encode_input(&tokens).expect("ABI encoding should not fail")
}

/// Build calldata for Index.confirmFills()
///
/// Selector: keccak256("confirmFills(uint256,(uint256,uint256,uint256,uint256,bytes32)[],bytes,uint256,uint256)")
///
/// Story 7.4: Batch and Fill Orchestration
pub fn build_confirm_fills_calldata(
    cycle_number: u64,
    fills: &[Fill],
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    use ethers::abi::{Function, Param, ParamType, StateMutability, Token};

    // On-chain Fill struct: (uint256 orderId, uint256 fillPrice, uint256 fillAmount, uint256 cycleNumber, bytes32 txHash)
    let fill_tuple_type = ParamType::Tuple(vec![
        ParamType::Uint(256), // orderId
        ParamType::Uint(256), // fillPrice
        ParamType::Uint(256), // fillAmount
        ParamType::Uint(256), // cycleNumber
        ParamType::FixedBytes(32), // txHash
    ]);

    let function = Function {
        name: "confirmFills".to_string(),
        inputs: vec![
            Param { name: "cycleNumber".into(), kind: ParamType::Uint(256), internal_type: None },
            Param { name: "fills".into(), kind: ParamType::Array(Box::new(fill_tuple_type)), internal_type: None },
            Param { name: "blsSignature".into(), kind: ParamType::Bytes, internal_type: None },
            Param { name: "referenceNonce".into(), kind: ParamType::Uint(256), internal_type: None },
            Param { name: "signersBitmask".into(), kind: ParamType::Uint(256), internal_type: None },
        ],
        outputs: vec![],
        #[allow(deprecated)]
        constant: None,
        state_mutability: StateMutability::NonPayable,
    };

    let fill_tokens: Vec<Token> = fills
        .iter()
        .map(|fill| {
            Token::Tuple(vec![
                Token::Uint(fill.order_id),
                Token::Uint(fill.fill_price),
                Token::Uint(fill.fill_amount),
                Token::Uint(U256::from(cycle_number)),
                Token::FixedBytes(vec![0u8; 32]), // txHash — zero for now, not validated on-chain
            ])
        })
        .collect();

    let tokens = vec![
        Token::Uint(U256::from(cycle_number)),
        Token::Array(fill_tokens),
        Token::Bytes(bls_signature.to_vec()),
        Token::Uint(U256::from(reference_nonce)),
        Token::Uint(signers_bitmask),
    ];

    function.encode_input(&tokens).expect("ABI encoding should not fail")
}

// ============================================================================
// Story 7-14: Rebalance Consensus Types
// ============================================================================

/// Result of rebalance batch consensus
pub type RebalanceBatchResult = SignedConsensusResult;

/// Result of update weights consensus
pub type UpdateWeightsResult = SignedConsensusResult;

/// Build message hash for confirmRebalanceBatch consensus
///
/// Matches Solidity: keccak256(abi.encode(block.chainid, address(this), "rebalance", cycleNumber, itpIds))
///
/// Story 7-14: Rebalance consensus (Task 4.2)
pub fn build_rebalance_batch_hash(
    chain_id: u64,
    index_address: Address,
    cycle_number: u64,
    itp_ids: &[H256],
) -> H256 {
    let rebalance_hash = ethers::utils::keccak256(b"rebalance");
    let mut enc = AbiEncoder::with_capacity(128 + itp_ids.len() * 32)
        .u256(U256::from(chain_id))
        .address_padded(index_address)
        .bytes(&rebalance_hash)
        .u256(U256::from(cycle_number));
    for itp_id in itp_ids {
        enc = enc.h256(*itp_id);
    }
    enc.keccak256()
}

/// Build calldata for confirmRebalanceBatch(uint256,bytes32[],bytes,uint256,uint256)
///
/// Story 7-14: Rebalance consensus (Task 4.2)
pub fn build_confirm_rebalance_batch_calldata(
    cycle_number: u64,
    itp_ids: &[H256],
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        "confirmRebalanceBatch(uint256,bytes32[],bytes,uint256,uint256)"
    )[..4];

    let mut calldata = selector.to_vec();

    // Head layout (5 words):
    //   [0] cycleNumber (static uint256)
    //   [1] offset to itpIds array
    //   [2] offset to blsSignature bytes
    //   [3] referenceNonce (static uint256)
    //   [4] signersBitmask (static uint256)
    let sig_offset = 160 + 32 + itp_ids.len() * 32;
    let mut enc = AbiEncoder::new()
        .u256(U256::from(cycle_number))
        .u256(U256::from(160)) // offset to itpIds array (5 * 32)
        .u256(U256::from(sig_offset))
        .u256(U256::from(reference_nonce))
        .u256(signers_bitmask)
        // itpIds array: length + elements
        .u256(U256::from(itp_ids.len()));
    for itp_id in itp_ids {
        enc = enc.h256(*itp_id);
    }
    let tail = enc
        .bytes_with_length(bls_signature)
        .finish();
    calldata.extend_from_slice(&tail);
    calldata
}

/// Build message hash for updateWeights consensus
///
/// Matches Solidity: keccak256(abi.encode(block.chainid, address(this), "updateWeights", itpId, newWeights, newInventory, nav))
///
/// Story 7-14: Rebalance consensus (Task 4.3)
pub fn build_update_weights_hash(
    chain_id: u64,
    index_address: Address,
    itp_id: H256,
    new_weights: &[U256],
    new_inventory: &[U256],
    nav: U256,
) -> H256 {
    let update_weights_hash = ethers::utils::keccak256(b"updateWeights");
    let mut enc = AbiEncoder::with_capacity(128 + (new_weights.len() + new_inventory.len()) * 32)
        .u256(U256::from(chain_id))
        .address_padded(index_address)
        .bytes(&update_weights_hash)
        .h256(itp_id);
    for w in new_weights {
        enc = enc.u256(*w);
    }
    for q in new_inventory {
        enc = enc.u256(*q);
    }
    enc.u256(nav).keccak256()
}

/// Build calldata for updateWeights(bytes32,uint256[],uint256[],uint256,bytes,uint256,uint256)
///
/// Story 7-14: Rebalance consensus (Task 4.3)
pub fn build_update_weights_calldata(
    itp_id: H256,
    new_weights: &[U256],
    new_inventory: &[U256],
    nav: U256,
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        "updateWeights(bytes32,uint256[],uint256[],uint256,bytes,uint256,uint256)"
    )[..4];

    let mut calldata = selector.to_vec();

    // Head layout (7 words):
    //   [0] itpId (bytes32, static)
    //   [1] offset to newWeights array
    //   [2] offset to newInventory array
    //   [3] nav (uint256, static)
    //   [4] offset to blsSignature bytes
    //   [5] referenceNonce (uint256, static)
    //   [6] signersBitmask (uint256, static)
    let inv_offset = 224 + 32 + new_weights.len() * 32;
    let sig_offset = inv_offset + 32 + new_inventory.len() * 32;

    let mut enc = AbiEncoder::new()
        .h256(itp_id)
        .u256(U256::from(224)) // offset to newWeights (7 * 32)
        .u256(U256::from(inv_offset))
        .u256(nav)
        .u256(U256::from(sig_offset))
        .u256(U256::from(reference_nonce))
        .u256(signers_bitmask)
        // newWeights array: length + elements
        .u256(U256::from(new_weights.len()));
    for w in new_weights {
        enc = enc.u256(*w);
    }
    // newInventory array: length + elements
    enc = enc.u256(U256::from(new_inventory.len()));
    for q in new_inventory {
        enc = enc.u256(*q);
    }
    let tail = enc
        .bytes_with_length(bls_signature)
        .finish();
    calldata.extend_from_slice(&tail);
    calldata
}

/// Result of successful single-phase rebalance execution
pub type RebalanceResult = SignedConsensusResult;

/// Result of successful setItpNav BLS consensus
pub type SetItpNavResult = SignedConsensusResult;

/// Build message hash for single-phase rebalance() consensus
///
/// Matches Solidity: keccak256(abi.encode(block.chainid, address(this), "rebalance", itpId, removeIndices, addAssets, newWeights, prices))
pub fn build_rebalance_hash(
    chain_id: u64,
    index_address: Address,
    itp_id: H256,
    remove_indices: &[U256],
    add_assets: &[Address],
    new_weights: &[U256],
    prices: &[U256],
    quote_tokens: &[Address],
) -> H256 {
    // Must match: keccak256(abi.encode(chainid, address(this), "rebalance",
    //   itpId, removeIndices, addAssets, newWeights, prices, quoteTokens))
    let tokens = vec![
        ethers::abi::Token::Uint(U256::from(chain_id)),
        ethers::abi::Token::Address(index_address),
        ethers::abi::Token::String("rebalance".to_string()),
        ethers::abi::Token::FixedBytes(itp_id.as_bytes().to_vec()),
        ethers::abi::Token::Array(
            remove_indices.iter().map(|v| ethers::abi::Token::Uint(*v)).collect(),
        ),
        ethers::abi::Token::Array(
            add_assets.iter().map(|a| ethers::abi::Token::Address(*a)).collect(),
        ),
        ethers::abi::Token::Array(
            new_weights.iter().map(|v| ethers::abi::Token::Uint(*v)).collect(),
        ),
        ethers::abi::Token::Array(
            prices.iter().map(|v| ethers::abi::Token::Uint(*v)).collect(),
        ),
        ethers::abi::Token::Array(
            quote_tokens.iter().map(|a| ethers::abi::Token::Address(*a)).collect(),
        ),
    ];

    let encoded = ethers::abi::encode(&tokens);
    H256::from_slice(&ethers::utils::keccak256(&encoded))
}

/// Build calldata for rebalance(bytes32,uint256[],address[],uint256[],uint256[],address[],bytes,uint256,uint256)
pub fn build_rebalance_calldata(
    itp_id: H256,
    remove_indices: &[U256],
    add_assets: &[Address],
    new_weights: &[U256],
    prices: &[U256],
    quote_tokens: &[Address],
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        "rebalance(bytes32,uint256[],address[],uint256[],uint256[],address[],bytes,uint256,uint256)"
    )[..4];

    let params = vec![
        ethers::abi::Token::FixedBytes(itp_id.as_bytes().to_vec()),
        ethers::abi::Token::Array(
            remove_indices.iter().map(|v| ethers::abi::Token::Uint(*v)).collect(),
        ),
        ethers::abi::Token::Array(
            add_assets.iter().map(|a| ethers::abi::Token::Address(*a)).collect(),
        ),
        ethers::abi::Token::Array(
            new_weights.iter().map(|v| ethers::abi::Token::Uint(*v)).collect(),
        ),
        ethers::abi::Token::Array(
            prices.iter().map(|v| ethers::abi::Token::Uint(*v)).collect(),
        ),
        ethers::abi::Token::Array(
            quote_tokens.iter().map(|a| ethers::abi::Token::Address(*a)).collect(),
        ),
        ethers::abi::Token::Bytes(bls_signature.to_vec()),
        ethers::abi::Token::Uint(U256::from(reference_nonce)),
        ethers::abi::Token::Uint(signers_bitmask),
    ];

    let mut calldata = selector.to_vec();
    calldata.extend_from_slice(&ethers::abi::encode(&params));
    calldata
}

/// Build message hash for setItpNav BLS consensus
///
/// Matches Solidity: keccak256(abi.encode(block.chainid, address(this), "setItpNav", itpId, nav))
pub fn build_set_itp_nav_hash(
    chain_id: u64,
    index_address: Address,
    itp_id: H256,
    nav: U256,
) -> H256 {
    // Must match: keccak256(abi.encode(block.chainid, address(this), "setItpNav", itpId, nav))
    let tokens = vec![
        ethers::abi::Token::Uint(U256::from(chain_id)),
        ethers::abi::Token::Address(index_address),
        ethers::abi::Token::String("setItpNav".to_string()),
        ethers::abi::Token::FixedBytes(itp_id.as_bytes().to_vec()),
        ethers::abi::Token::Uint(nav),
    ];
    let encoded = ethers::abi::encode(&tokens);
    H256::from_slice(&ethers::utils::keccak256(&encoded))
}

/// Build calldata for setItpNav(bytes32,uint256,bytes,uint256,uint256)
pub fn build_set_itp_nav_calldata(
    itp_id: H256,
    nav: U256,
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        "setItpNav(bytes32,uint256,bytes,uint256,uint256)"
    )[..4];

    let mut calldata = selector.to_vec();
    let tail = AbiEncoder::new()
        .h256(itp_id)
        .u256(nav)
        .u256(U256::from(160)) // offset to blsSignature (5 * 32)
        .u256(U256::from(reference_nonce))
        .u256(signers_bitmask)
        .bytes_with_length(bls_signature)
        .finish();
    calldata.extend_from_slice(&tail);
    calldata
}

// ============================================================================
// NAV Oracle (Phase 2B) — ITPNAVOracle.updatePrice() on Settlement
// ============================================================================

/// Build the message hash for ITPNAVOracle.updatePrice() on Settlement.
/// Must match: keccak256(abi.encode(block.chainid, address(this), itpAddress, newPrice, timestamp, cycleNumber))
pub fn build_nav_oracle_hash(
    chain_id: u64,
    oracle_address: Address,
    itp_address: Address,
    price: U256,
    timestamp: u64,
    cycle_number: u64,
) -> H256 {
    let tokens = vec![
        ethers::abi::Token::Uint(U256::from(chain_id)),
        ethers::abi::Token::Address(oracle_address),
        ethers::abi::Token::Address(itp_address),
        ethers::abi::Token::Uint(price),
        ethers::abi::Token::Uint(U256::from(timestamp)),
        ethers::abi::Token::Uint(U256::from(cycle_number)),
    ];
    let encoded = ethers::abi::encode(&tokens);
    H256::from_slice(&ethers::utils::keccak256(&encoded))
}

/// Build calldata for ITPNAVOracle.updatePrice(uint256,uint256,uint256,bytes,uint256,uint256)
pub fn build_update_price_calldata(
    new_price: U256,
    timestamp: u64,
    cycle_number: u64,
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        b"updatePrice(uint256,uint256,uint256,bytes,uint256,uint256)"
    )[..4];
    let encoded = ethers::abi::encode(&[
        ethers::abi::Token::Uint(new_price),
        ethers::abi::Token::Uint(U256::from(timestamp)),
        ethers::abi::Token::Uint(U256::from(cycle_number)),
        ethers::abi::Token::Bytes(bls_signature.to_vec()),
        ethers::abi::Token::Uint(U256::from(reference_nonce)),
        ethers::abi::Token::Uint(signers_bitmask),
    ]);
    [selector, &encoded].concat()
}

// ============================================================================
// MirrorIssuerRegistry Sync (Step 12)
// ============================================================================

/// Build the message hash for MirrorIssuerRegistry.sync() BLS consensus.
///
/// Must match Solidity:
/// ```solidity
/// keccak256(abi.encode(
///     "REGISTRY_SYNC",
///     block.chainid,
///     address(this),
///     nonce,
///     keccak256(abi.encode(issuerPubkeys, issuerIds)),
///     newActiveBitmask,
///     newActiveCount,
///     newThreshold
/// ))
/// ```
pub fn build_mirror_registry_sync_hash(
    chain_id: u64,
    mirror_registry_address: Address,
    nonce: u64,
    issuer_pubkeys: &[Vec<u8>],
    issuer_ids: &[u64],
    active_bitmask: U256,
    active_count: u64,
    threshold: u64,
) -> H256 {
    use ethers::abi::Token;

    // Inner hash: keccak256(abi.encode(issuerPubkeys, issuerIds))
    let pubkeys_token = Token::Array(
        issuer_pubkeys.iter().map(|pk| Token::Bytes(pk.clone())).collect()
    );
    let ids_token = Token::Array(
        issuer_ids.iter().map(|id| Token::Uint(U256::from(*id))).collect()
    );
    let inner_encoded = ethers::abi::encode(&[pubkeys_token, ids_token]);
    let inner_hash = ethers::utils::keccak256(&inner_encoded);

    // Outer hash
    let tokens = vec![
        Token::String("REGISTRY_SYNC".to_string()),
        Token::Uint(U256::from(chain_id)),
        Token::Address(mirror_registry_address),
        Token::Uint(U256::from(nonce)),
        Token::FixedBytes(inner_hash.to_vec()),
        Token::Uint(active_bitmask),
        Token::Uint(U256::from(active_count)),
        Token::Uint(U256::from(threshold)),
    ];
    let encoded = ethers::abi::encode(&tokens);
    H256::from_slice(&ethers::utils::keccak256(&encoded))
}

/// Build calldata for MirrorIssuerRegistry.sync().
///
/// Function signature:
/// `sync(bytes[],uint256[],uint256,uint256,uint256,uint256,bytes,uint256,uint256)`
pub fn build_mirror_registry_sync_calldata(
    issuer_pubkeys: &[Vec<u8>],
    issuer_ids: &[u64],
    active_bitmask: U256,
    active_count: u64,
    threshold: u64,
    nonce: u64,
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    use ethers::abi::Token;

    let selector = &ethers::utils::keccak256(
        b"sync(bytes[],uint256[],uint256,uint256,uint256,uint256,bytes,uint256,uint256)"
    )[..4];
    let pubkeys_token = Token::Array(
        issuer_pubkeys.iter().map(|pk| Token::Bytes(pk.clone())).collect()
    );
    let ids_token = Token::Array(
        issuer_ids.iter().map(|id| Token::Uint(U256::from(*id))).collect()
    );
    let encoded = ethers::abi::encode(&[
        pubkeys_token,
        ids_token,
        Token::Uint(active_bitmask),
        Token::Uint(U256::from(active_count)),
        Token::Uint(U256::from(threshold)),
        Token::Uint(U256::from(nonce)),
        Token::Bytes(bls_signature.to_vec()),
        Token::Uint(U256::from(reference_nonce)),
        Token::Uint(signers_bitmask),
    ]);
    [selector, &encoded].concat()
}

// ============================================================================
// Asset Trades (Issuer Decomposition + Cross-ITP Netting)
// ============================================================================

/// Per-asset trade after issuer decomposition and cross-ITP netting
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetTrade {
    /// ERC20 token address to trade
    pub asset: Address,
    /// 0=BUY, 1=SELL (per-asset, can differ after cross-ITP netting)
    pub side: u8,
    /// Net USDC amount for this asset (18 decimals)
    pub usdc_amount: U256,
    /// Asset price used for decomposition (18 decimals)
    pub price: U256,
    /// Quote token for settlement (USDC or USDT address; Address::zero() = default USDC)
    pub quote_token: Address,
}

/// Proposal for emitting asset trades via BLS consensus
#[derive(Debug, Clone)]
pub struct AssetTradesProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Cycle number
    pub cycle_number: u64,
    /// Netted per-asset trades
    pub trades: Vec<AssetTrade>,
    /// Leader's BLS signature
    pub leader_signature: BLSSignature,
    /// Message hash for verification
    pub message_hash: H256,
}

/// Result of asset trades signature collection
pub type AssetTradesResult = SignedConsensusResult;

/// Build message hash for emitAssetTrades (must match Solidity)
///
/// Matches: keccak256(abi.encode(block.chainid, address(this), "assetTrades", cycleNumber, trades))
pub fn build_emit_asset_trades_hash(
    chain_id: u64,
    index_address: Address,
    cycle_number: u64,
    trades: &[AssetTrade],
) -> H256 {
    // Must match: keccak256(abi.encode(block.chainid, address(this), "assetTrades", cycleNumber, trades))
    // where trades is TypesLib.AssetTrade[] = (address, uint8, uint256, uint256, address)[]
    let trade_tokens: Vec<ethers::abi::Token> = trades
        .iter()
        .map(|t| {
            ethers::abi::Token::Tuple(vec![
                ethers::abi::Token::Address(t.asset),
                ethers::abi::Token::Uint(U256::from(t.side)),
                ethers::abi::Token::Uint(t.usdc_amount),
                ethers::abi::Token::Uint(t.price),
                ethers::abi::Token::Address(t.quote_token),
            ])
        })
        .collect();

    let tokens = vec![
        ethers::abi::Token::Uint(U256::from(chain_id)),
        ethers::abi::Token::Address(index_address),
        ethers::abi::Token::String("assetTrades".to_string()),
        ethers::abi::Token::Uint(U256::from(cycle_number)),
        ethers::abi::Token::Array(trade_tokens),
    ];
    let encoded = ethers::abi::encode(&tokens);
    H256::from(ethers::utils::keccak256(&encoded))
}

/// Build calldata for Index.emitAssetTrades(cycleNumber, trades[], blsSignature, referenceNonce, signersBitmask)
pub fn build_emit_asset_trades_calldata(
    cycle_number: u64,
    trades: &[AssetTrade],
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        "emitAssetTrades(uint256,(address,uint8,uint256,uint256,address)[],bytes,uint256,uint256)"
    )[..4];

    let mut calldata = selector.to_vec();

    // Head layout (5 words):
    //   [0] cycleNumber (static uint256)
    //   [1] offset to trades array
    //   [2] offset to blsSignature bytes
    //   [3] referenceNonce (static uint256)
    //   [4] signersBitmask (static uint256)
    let trades_encoding_len = 32 + trades.len() * 5 * 32;
    let mut enc = AbiEncoder::new()
        .u256(U256::from(cycle_number))
        .u256(U256::from(160)) // offset to trades[] (5 * 32)
        .u256(U256::from(160 + trades_encoding_len)) // offset to blsSignature
        .u256(U256::from(reference_nonce))
        .u256(signers_bitmask)
        // Encode trades array: length + elements
        .u256(U256::from(trades.len()));
    for trade in trades {
        enc = enc
            .address_padded(trade.asset)
            .u8_padded(trade.side)
            .u256(trade.usdc_amount)
            .u256(trade.price)
            .address_padded(trade.quote_token);
    }
    let tail = enc
        .bytes_with_length(bls_signature)
        .finish();
    calldata.extend_from_slice(&tail);
    calldata
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bridge_config_default() {
        let config = BridgeConfig::default();
        assert_eq!(config.min_signatures, 2);
        assert_eq!(config.proposal_timeout_ms, 500);
        assert_eq!(config.sign_timeout_ms, 300);
        assert_eq!(config.settlement_chain_id, 42161);
        assert_eq!(config.l3_chain_id, 111222333);
        assert_eq!(config.index_address, Address::zero());
    }

    #[test]
    fn test_signature_collector_new() {
        let collector = SignatureCollector::new(U256::from(123));
        assert_eq!(collector.order_id, U256::from(123));
        assert_eq!(collector.signature_count(), 0);
        assert_eq!(collector.signer_bitmap(), U256::zero());
    }

    #[test]
    fn test_signature_collector_add_signature() {
        let mut collector = SignatureCollector::new(U256::from(1));

        // Add first signature
        let sig1 = BLSSignature(vec![0x01; 64]);
        assert!(collector.add_signature(0, sig1));
        assert_eq!(collector.signature_count(), 1);
        assert_eq!(collector.signer_bitmap(), U256::one());

        // Add second signature from different signer
        let sig2 = BLSSignature(vec![0x02; 64]);
        assert!(collector.add_signature(1, sig2));
        assert_eq!(collector.signature_count(), 2);
        assert_eq!(collector.signer_bitmap(), U256::from(3)); // bits 0 and 1 set
    }

    #[test]
    fn test_signature_collector_duplicate_rejected() {
        let mut collector = SignatureCollector::new(U256::from(1));

        let sig1 = BLSSignature(vec![0x01; 64]);
        assert!(collector.add_signature(0, sig1.clone()));

        // Duplicate should be rejected
        assert!(!collector.add_signature(0, sig1));
        assert_eq!(collector.signature_count(), 1);
    }

    #[test]
    fn test_signature_collector_threshold() {
        let mut collector = SignatureCollector::new(U256::from(1));

        assert!(!collector.has_threshold(2));

        collector.add_signature(0, BLSSignature(vec![0x01; 64]));
        assert!(!collector.has_threshold(2));

        collector.add_signature(1, BLSSignature(vec![0x02; 64]));
        assert!(collector.has_threshold(2));
    }

    #[test]
    fn test_build_bridge_hash_deterministic() {
        let hash1 = build_bridge_settlement_to_l3_hash(
            42161,
            U256::from(123),
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(1700000000u64),
        );

        let hash2 = build_bridge_settlement_to_l3_hash(
            42161,
            U256::from(123),
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(1700000000u64),
        );

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_build_bridge_hash_different_inputs() {
        let hash1 = build_bridge_settlement_to_l3_hash(
            42161,
            U256::from(1),
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(1700000000u64),
        );

        let hash2 = build_bridge_settlement_to_l3_hash(
            42161,
            U256::from(2), // Different order_id
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(1700000000u64),
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_bridge_hash_correct_length() {
        // The hash input should be 180 bytes:
        // 32 (chain_id) + 32 (order_id) + 32 (itp_id) + 20 (user) + 32 (amount) + 32 (deadline)
        let hash = build_bridge_settlement_to_l3_hash(
            42161,
            U256::from(1),
            H256::zero(),
            Address::zero(),
            U256::zero(),
            U256::zero(),
        );

        // Result should be a 32-byte keccak256 hash
        assert_eq!(hash.as_bytes().len(), 32);
    }

    #[test]
    fn test_bridge_order_status_variants() {
        assert_eq!(
            format!("{:?}", BridgeOrderStatus::Pending),
            "Pending"
        );
        assert_eq!(
            format!("{:?}", BridgeOrderStatus::BridgedToL3),
            "BridgedToL3"
        );
        assert_eq!(
            format!("{:?}", BridgeOrderStatus::SubmittedOnL3),
            "SubmittedOnL3"
        );
        assert_eq!(
            format!("{:?}", BridgeOrderStatus::Filled),
            "Filled"
        );
        assert_eq!(
            format!("{:?}", BridgeOrderStatus::Failed),
            "Failed"
        );
    }

    #[test]
    fn test_bridge_error_display() {
        // NOTE: InsufficientSignatures variant was removed from BridgeError.
        // Skipping that assertion.

        let err = BridgeError::OrderExpired {
            deadline: 100,
            now: 200,
        };
        assert_eq!(
            err.to_string(),
            "order expired: deadline 100 < now 200"
        );

        let err = BridgeError::OrderNotFound {
            order_id: U256::from(42),
        };
        assert!(err.to_string().contains("42"));
    }

    // ========================================================================
    // Story 7.3: Submit Order for User Tests
    // ========================================================================

    #[test]
    fn test_build_submit_order_hash_deterministic() {
        let hash1 = build_submit_order_hash(
            111222333, // L3 chain ID
            U256::from(123),
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64), // 1 USDC
            U256::from(2000000000000000000u64), // 2.0 price
            U256::from(1), // slippage tier 1
            U256::from(1700000000u64),
        );

        let hash2 = build_submit_order_hash(
            111222333,
            U256::from(123),
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(2000000000000000000u64),
            U256::from(1),
            U256::from(1700000000u64),
        );

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_build_submit_order_hash_different_inputs() {
        let hash1 = build_submit_order_hash(
            111222333,
            U256::from(1),
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(2000000000000000000u64),
            U256::from(0),
            U256::from(1700000000u64),
        );

        let hash2 = build_submit_order_hash(
            111222333,
            U256::from(2), // Different settlement_order_id
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(2000000000000000000u64),
            U256::from(0),
            U256::from(1700000000u64),
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_submit_order_hash_correct_length() {
        // The hash input should be 244 bytes:
        // 32 (chain_id) + 32 (settlement_order_id) + 32 (itp_id) + 20 (user) +
        // 32 (amount) + 32 (limit_price) + 32 (slippage_tier) + 32 (deadline) = 244
        let hash = build_submit_order_hash(
            111222333,
            U256::from(1),
            H256::zero(),
            Address::zero(),
            U256::zero(),
            U256::zero(),
            U256::zero(),
            U256::zero(),
        );

        // Result should be a 32-byte keccak256 hash
        assert_eq!(hash.as_bytes().len(), 32);
    }

    #[test]
    fn test_build_submit_order_hash_slippage_tier_affects_hash() {
        let hash_tier0 = build_submit_order_hash(
            111222333,
            U256::from(1),
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(2000000000000000000u64),
            U256::from(0), // tier 0
            U256::from(1700000000u64),
        );

        let hash_tier1 = build_submit_order_hash(
            111222333,
            U256::from(1),
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(2000000000000000000u64),
            U256::from(1), // tier 1
            U256::from(1700000000u64),
        );

        let hash_tier2 = build_submit_order_hash(
            111222333,
            U256::from(1),
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(2000000000000000000u64),
            U256::from(2), // tier 2
            U256::from(1700000000u64),
        );

        assert_ne!(hash_tier0, hash_tier1);
        assert_ne!(hash_tier1, hash_tier2);
        assert_ne!(hash_tier0, hash_tier2);
    }

    #[test]
    fn test_build_erc20_approve_calldata() {
        let spender = Address::from([0x11; 20]);
        let amount = U256::from(1000000000000000000u64);

        let calldata = build_erc20_approve_calldata(spender, amount);

        // Should be 4 (selector) + 32 (spender) + 32 (amount) = 68 bytes
        assert_eq!(calldata.len(), 68);

        // Verify selector: keccak256("approve(address,uint256)")[0:4] = 0x095ea7b3
        assert_eq!(&calldata[0..4], &[0x09, 0x5e, 0xa7, 0xb3]);
    }

    #[test]
    fn test_build_submit_order_calldata() {
        let itp_id = H256::from([0xAB; 32]);
        let side = 0u8; // BUY
        let amount = U256::from(1000000000000000000u64);
        let limit_price = U256::from(2000000000000000000u64);
        let slippage_tier = U256::from(1);
        let deadline = U256::from(1700000000u64);

        let calldata = build_submit_order_calldata(
            itp_id,
            side,
            amount,
            limit_price,
            slippage_tier,
            deadline,
        );

        // Should be 4 (selector) + 32*6 (params) = 196 bytes
        assert_eq!(calldata.len(), 196);

        // Verify itp_id is at the expected position (bytes 4-36)
        assert_eq!(&calldata[4..36], itp_id.as_bytes());

        // Verify side byte is at position 67 (last byte of 32-byte slot)
        assert_eq!(calldata[35 + 32], side);
    }

    #[test]
    fn test_build_submit_order_calldata_buy_vs_sell() {
        let itp_id = H256::from([0xAB; 32]);
        let amount = U256::from(1000000000000000000u64);
        let limit_price = U256::from(2000000000000000000u64);
        let slippage_tier = U256::from(1);
        let deadline = U256::from(1700000000u64);

        let calldata_buy = build_submit_order_calldata(
            itp_id,
            0, // BUY
            amount,
            limit_price,
            slippage_tier,
            deadline,
        );

        let calldata_sell = build_submit_order_calldata(
            itp_id,
            1, // SELL
            amount,
            limit_price,
            slippage_tier,
            deadline,
        );

        // Should differ only in the side byte
        assert_ne!(calldata_buy, calldata_sell);

        // Same selector
        assert_eq!(&calldata_buy[0..4], &calldata_sell[0..4]);

        // Same itp_id
        assert_eq!(&calldata_buy[4..36], &calldata_sell[4..36]);
    }

    #[test]
    fn test_order_mapping_serialization() {
        let mapping = OrderMapping {
            settlement_order_id: U256::from(123),
            l3_order_id: U256::from(456),
            original_user: Address::from([0xAB; 20]),
            created_at: 1700000000,
        };

        // Test serde serialization roundtrip
        let serialized = serde_json::to_string(&mapping).expect("Serialization failed");
        let deserialized: OrderMapping = serde_json::from_str(&serialized).expect("Deserialization failed");

        assert_eq!(mapping.settlement_order_id, deserialized.settlement_order_id);
        assert_eq!(mapping.l3_order_id, deserialized.l3_order_id);
        assert_eq!(mapping.original_user, deserialized.original_user);
        assert_eq!(mapping.created_at, deserialized.created_at);
    }

    #[test]
    fn test_submit_order_proposal_struct() {
        let proposal = SubmitOrderProposal {
            leader_id: [0x11; 32],
            settlement_order_id: U256::from(123),
            itp_id: H256::from([0xAB; 32]),
            user: Address::from([0xCD; 20]),
            amount: U256::from(1000000000000000000u64),
            limit_price: U256::from(2000000000000000000u64),
            slippage_tier: U256::from(1),
            deadline: U256::from(1700000000u64),
            leader_signature: BLSSignature(vec![0xFF; 96]),
            message_hash: H256::from([0xEE; 32]),
        };

        // Verify fields are accessible
        assert_eq!(proposal.settlement_order_id, U256::from(123));
        assert_eq!(proposal.slippage_tier, U256::from(1));
        assert_eq!(proposal.leader_signature.0.len(), 96);
    }

    #[test]
    fn test_submit_order_result_struct() {
        let result = SubmitOrderResult {
            aggregated_signature: BLSSignature(vec![0xFF; 96]),
            signer_bitmap: U256::from(7), // bits 0, 1, 2 set
            signature_count: 3,
            l3_order_id: Some(U256::from(999)),
        };

        assert_eq!(result.signature_count, 3);
        assert_eq!(result.l3_order_id, Some(U256::from(999)));
    }

    #[test]
    fn test_bridge_error_story_7_3_variants() {
        let err = BridgeError::OrderNotBridged {
            settlement_order_id: U256::from(42),
            status: Some(BridgeOrderStatus::Pending),
        };
        assert!(err.to_string().contains("42"));
        assert!(err.to_string().contains("Pending"));

        let err = BridgeError::InsufficientCustodyBalance {
            required: U256::from(1000),
            available: U256::from(500),
        };
        assert!(err.to_string().contains("1000"));
        assert!(err.to_string().contains("500"));

        let err = BridgeError::ItpNotFound {
            itp_id: H256::from([0xAB; 32]),
        };
        assert!(err.to_string().contains("ITP"));

        let err = BridgeError::InvalidSlippageTier {
            tier: U256::from(5),
        };
        assert!(err.to_string().contains("5"));

        let err = BridgeError::CustodyExecuteFailed {
            reason: "test failure".to_string(),
        };
        assert!(err.to_string().contains("test failure"));

        let err = BridgeError::SubmitOrderFailed {
            reason: "order failed".to_string(),
        };
        assert!(err.to_string().contains("order failed"));

        let err = BridgeError::EventParseError {
            reason: "invalid event".to_string(),
        };
        assert!(err.to_string().contains("invalid event"));

        let err = BridgeError::OrderAlreadySubmitted {
            settlement_order_id: U256::from(1),
            l3_order_id: U256::from(2),
        };
        assert!(err.to_string().contains("1"));
        assert!(err.to_string().contains("2"));
    }

    // ========================================================================
    // Story 7.4: Batch and Fill Orchestration Tests
    // ========================================================================

    #[test]
    fn test_build_confirm_batch_hash_deterministic() {
        let addr = Address::zero();
        let hash1 = build_confirm_batch_hash(
            111222333,
            addr,
            42,
            &[U256::from(1), U256::from(2), U256::from(3)],
        );

        let hash2 = build_confirm_batch_hash(
            111222333,
            addr,
            42,
            &[U256::from(1), U256::from(2), U256::from(3)],
        );

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_build_confirm_batch_hash_different_cycles() {
        let addr = Address::zero();
        let hash1 = build_confirm_batch_hash(111222333, addr, 1, &[U256::from(1)]);
        let hash2 = build_confirm_batch_hash(111222333, addr, 2, &[U256::from(1)]);

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_confirm_batch_hash_different_orders() {
        let addr = Address::zero();
        let hash1 = build_confirm_batch_hash(111222333, addr, 1, &[U256::from(1)]);
        let hash2 = build_confirm_batch_hash(111222333, addr, 1, &[U256::from(2)]);

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_confirm_batch_hash_empty() {
        let hash = build_confirm_batch_hash(111222333, Address::zero(), 0, &[]);

        // Should be a valid 32-byte hash even with empty arrays
        assert_eq!(hash.as_bytes().len(), 32);
    }

    #[test]
    fn test_build_confirm_fills_hash_deterministic() {
        let fills = vec![
            Fill {
                order_id: U256::from(1),
                fill_price: U256::from(1500000000000000000u64),
                fill_amount: U256::from(1000000000000000000u64),
            },
            Fill {
                order_id: U256::from(2),
                fill_price: U256::from(2500000000000000000u64),
                fill_amount: U256::from(2000000000000000000u64),
            },
        ];

        let addr = Address::zero();
        let hash1 = build_confirm_fills_hash(111222333, addr, 42, &fills);
        let hash2 = build_confirm_fills_hash(111222333, addr, 42, &fills);

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_build_confirm_fills_hash_different_cycles() {
        let fills = vec![
            Fill {
                order_id: U256::from(1),
                fill_price: U256::from(1500000000000000000u64),
                fill_amount: U256::from(1000000000000000000u64),
            },
        ];

        let addr = Address::zero();
        let hash1 = build_confirm_fills_hash(111222333, addr, 1, &fills);
        let hash2 = build_confirm_fills_hash(111222333, addr, 2, &fills); // Different cycle

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_confirm_fills_hash_different_fills() {
        let fills1 = vec![
            Fill {
                order_id: U256::from(1),
                fill_price: U256::from(1500000000000000000u64),
                fill_amount: U256::from(1000000000000000000u64),
            },
        ];

        let fills2 = vec![
            Fill {
                order_id: U256::from(1),
                fill_price: U256::from(1600000000000000000u64), // Different price
                fill_amount: U256::from(1000000000000000000u64),
            },
        ];

        let addr = Address::zero();
        let hash1 = build_confirm_fills_hash(111222333, addr, 1, &fills1);
        let hash2 = build_confirm_fills_hash(111222333, addr, 1, &fills2);

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_confirm_fills_hash_empty() {
        let hash = build_confirm_fills_hash(111222333, Address::zero(), 0, &[]);

        // Should be a valid 32-byte hash even with empty fills
        assert_eq!(hash.as_bytes().len(), 32);
    }

    #[test]
    fn test_fill_struct_serialization() {
        let fill = Fill {
            order_id: U256::from(12345),
            fill_price: U256::from(1500000000000000000u64),
            fill_amount: U256::from(750000000000000000u64),
        };

        let serialized = serde_json::to_string(&fill).expect("Serialization failed");
        let deserialized: Fill = serde_json::from_str(&serialized).expect("Deserialization failed");

        assert_eq!(fill, deserialized);
    }

    #[test]
    fn test_batch_proposal_struct() {
        let proposal = BatchProposal {
            leader_id: [0x11; 32],
            cycle_number: 42,
            order_ids: vec![U256::from(1), U256::from(2)],
            prices: vec![U256::from(1000000000000000000u64), U256::from(2000000000000000000u64)],
            leader_signature: BLSSignature(vec![0xFF; 96]),
            message_hash: H256::from([0xEE; 32]),
        };

        assert_eq!(proposal.cycle_number, 42);
        assert_eq!(proposal.order_ids.len(), 2);
        assert_eq!(proposal.prices.len(), 2);
    }

    #[test]
    fn test_fills_proposal_struct() {
        let proposal = FillsProposal {
            leader_id: [0x11; 32],
            cycle_number: 42,
            fills: vec![
                Fill {
                    order_id: U256::from(1),
                    fill_price: U256::from(1500000000000000000u64),
                    fill_amount: U256::from(1000000000000000000u64),
                },
            ],
            leader_signature: BLSSignature(vec![0xFF; 96]),
            message_hash: H256::from([0xEE; 32]),
        };

        assert_eq!(proposal.cycle_number, 42);
        assert_eq!(proposal.fills.len(), 1);
    }

    #[test]
    fn test_batch_result_struct() {
        let result = BatchResult {
            aggregated_signature: BLSSignature(vec![0xFF; 96]),
            signer_bitmap: U256::from(7), // bits 0, 1, 2 set
            signature_count: 3,
        };

        assert_eq!(result.signature_count, 3);
        assert_eq!(result.signer_bitmap, U256::from(7));
    }

    #[test]
    fn test_fills_result_struct() {
        let result = FillsResult {
            aggregated_signature: BLSSignature(vec![0xFF; 96]),
            signer_bitmap: U256::from(7), // bits 0, 1, 2 set
            signature_count: 3,
        };

        assert_eq!(result.signature_count, 3);
        assert_eq!(result.signer_bitmap, U256::from(7));
    }

    #[test]
    fn test_build_confirm_batch_calldata() {
        let order_ids = vec![U256::from(1), U256::from(2)];
        let bls_sig = vec![0xAA; 96];

        let calldata = build_confirm_batch_calldata(42, &order_ids, &bls_sig, 0, U256::from(7));

        // Should have: 4 (selector) + ABI encoded params
        assert!(calldata.len() >= 4 + 32 * 5 + 64 + 96);

        // Verify selector (first 4 bytes)
        let expected_selector = &ethers::utils::keccak256("confirmBatch(uint256,uint256[],bytes,uint256,uint256)")[..4];
        assert_eq!(&calldata[0..4], expected_selector);
    }

    #[test]
    fn test_build_confirm_fills_calldata() {
        let fills = vec![
            Fill {
                order_id: U256::from(1),
                fill_price: U256::from(1500000000000000000u64),
                fill_amount: U256::from(1000000000000000000u64),
            },
        ];
        let bls_sig = vec![0xBB; 96];

        let calldata = build_confirm_fills_calldata(42, &fills, &bls_sig, 0, U256::from(7));

        // Should have: 4 (selector) + ABI encoded params
        assert!(calldata.len() >= 4 + 32 * 4 + 96 + 32 + 96);

        // Verify selector (first 4 bytes)
        let expected_selector = &ethers::utils::keccak256("confirmFills(uint256,(uint256,uint256,uint256,uint256,bytes32)[],bytes,uint256,uint256)")[..4];
        assert_eq!(&calldata[0..4], expected_selector);
    }

    #[test]
    fn test_bridge_order_status_batched() {
        // Verify Batched status exists and formats correctly
        assert_eq!(
            format!("{:?}", BridgeOrderStatus::Batched),
            "Batched"
        );
    }

    // ========================================================================
    // Story 7.4: Batch/Fill Error Variant Tests
    // ========================================================================

    #[test]
    fn test_bridge_error_batch_fill_variants() {
        let err = BridgeError::BatchAlreadyConfirmed { cycle_number: 42 };
        assert!(err.to_string().contains("42"));

        let err = BridgeError::FillsAlreadyConfirmed { cycle_number: 99 };
        assert!(err.to_string().contains("99"));

        let err = BridgeError::CycleNotFound { cycle_number: 123 };
        assert!(err.to_string().contains("123"));

        let err = BridgeError::OrderNotInBatch { order_id: U256::from(456) };
        assert!(err.to_string().contains("456"));

        let err = BridgeError::PriceOutOfTolerance {
            expected: U256::from(1000),
            actual: U256::from(1500),
        };
        assert!(err.to_string().contains("1000"));
        assert!(err.to_string().contains("1500"));

        let err = BridgeError::FillAmountExceedsOrder {
            order_id: U256::from(1),
            order_amount: U256::from(100),
            fill_amount: U256::from(200),
        };
        assert!(err.to_string().contains("100"));
        assert!(err.to_string().contains("200"));

        let err = BridgeError::InvalidFillPrice { order_id: U256::from(7) };
        assert!(err.to_string().contains("7"));

        let err = BridgeError::ConfirmBatchFailed { reason: "test batch fail".to_string() };
        assert!(err.to_string().contains("test batch fail"));

        let err = BridgeError::ConfirmFillsFailed { reason: "test fills fail".to_string() };
        assert!(err.to_string().contains("test fills fail"));
    }

    // ========================================================================
    // Story 7.4: BLSCustody.execute() Tests (Task 7)
    // ========================================================================

    #[test]
    fn test_build_custody_execute_hash_deterministic() {
        let custody = Address::from([0x11; 20]);
        let target = Address::from([0x22; 20]);
        let data = vec![0x09, 0x5e, 0xa7, 0xb3, 0xAA, 0xBB]; // sample calldata

        let hash1 = build_custody_execute_hash(
            111222333,
            custody,
            target,
            &data,
            U256::from(42),
        );

        let hash2 = build_custody_execute_hash(
            111222333,
            custody,
            target,
            &data,
            U256::from(42),
        );

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_build_custody_execute_hash_different_nonces() {
        let custody = Address::from([0x11; 20]);
        let target = Address::from([0x22; 20]);
        let data = vec![0x09, 0x5e, 0xa7, 0xb3];

        let hash1 = build_custody_execute_hash(
            111222333,
            custody,
            target,
            &data,
            U256::from(0),
        );

        let hash2 = build_custody_execute_hash(
            111222333,
            custody,
            target,
            &data,
            U256::from(1), // Different nonce
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_custody_execute_hash_different_targets() {
        let custody = Address::from([0x11; 20]);
        let target1 = Address::from([0x22; 20]);
        let target2 = Address::from([0x33; 20]);
        let data = vec![0x09, 0x5e, 0xa7, 0xb3];

        let hash1 = build_custody_execute_hash(
            111222333,
            custody,
            target1,
            &data,
            U256::from(0),
        );

        let hash2 = build_custody_execute_hash(
            111222333,
            custody,
            target2, // Different target
            &data,
            U256::from(0),
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_custody_execute_hash_different_chain_ids() {
        let custody = Address::from([0x11; 20]);
        let target = Address::from([0x22; 20]);
        let data = vec![0x09, 0x5e, 0xa7, 0xb3];

        let hash1 = build_custody_execute_hash(
            111222333,
            custody,
            target,
            &data,
            U256::from(0),
        );

        let hash2 = build_custody_execute_hash(
            42161, // Different chain ID
            custody,
            target,
            &data,
            U256::from(0),
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_custody_execute_hash_different_data() {
        let custody = Address::from([0x11; 20]);
        let target = Address::from([0x22; 20]);
        let data1 = vec![0x09, 0x5e, 0xa7, 0xb3];
        let data2 = vec![0x09, 0x5e, 0xa7, 0xb4]; // Different data

        let hash1 = build_custody_execute_hash(
            111222333,
            custody,
            target,
            &data1,
            U256::from(0),
        );

        let hash2 = build_custody_execute_hash(
            111222333,
            custody,
            target,
            &data2,
            U256::from(0),
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_custody_execute_calldata_structure() {
        let target = Address::from([0x22; 20]);
        let data = vec![0x09, 0x5e, 0xa7, 0xb3]; // 4 bytes
        let bls_sig = vec![0xFF; 96];

        let calldata = build_custody_execute_calldata(
            target,
            &data,
            &bls_sig,
            U256::from(42),
            0,
            U256::from(7),
        );

        // Verify selector (first 4 bytes)
        let expected_selector = &ethers::utils::keccak256("execute(address,bytes,bytes,uint256,uint256,uint256)")[..4];
        assert_eq!(&calldata[0..4], expected_selector);

        // Verify target address is at bytes 4-36 (32 bytes, left-padded)
        let mut expected_target = [0u8; 32];
        expected_target[12..32].copy_from_slice(target.as_bytes());
        assert_eq!(&calldata[4..36], &expected_target);

        // Verify calldata is non-empty and has reasonable size
        // 4 (selector) + 32 (target) + 32 (data_offset) + 32 (sig_offset) + 32 (nonce) + 32 (refNonce) + 32 (bitmask)
        // + 32 (data_len) + 32 (data padded) + 32 (sig_len) + 96 (sig)
        assert!(calldata.len() >= 4 + 32 * 7 + 32 + 96);
    }

    #[test]
    fn test_build_custody_execute_calldata_with_empty_data() {
        let target = Address::from([0x22; 20]);
        let data: Vec<u8> = vec![];
        let bls_sig = vec![0xFF; 96];

        let calldata = build_custody_execute_calldata(
            target,
            &data,
            &bls_sig,
            U256::from(0),
            0,
            U256::zero(),
        );

        // Should still produce valid calldata
        let expected_selector = &ethers::utils::keccak256("execute(address,bytes,bytes,uint256,uint256,uint256)")[..4];
        assert_eq!(&calldata[0..4], expected_selector);
    }

    #[test]
    fn test_build_custody_execute_calldata_different_nonces() {
        let target = Address::from([0x22; 20]);
        let data = vec![0x09, 0x5e, 0xa7, 0xb3];
        let bls_sig = vec![0xFF; 96];

        let calldata1 = build_custody_execute_calldata(
            target,
            &data,
            &bls_sig,
            U256::from(0),
            0,
            U256::zero(),
        );

        let calldata2 = build_custody_execute_calldata(
            target,
            &data,
            &bls_sig,
            U256::from(1), // Different nonce
            0,
            U256::zero(),
        );

        // Should produce different calldata
        assert_ne!(calldata1, calldata2);
    }

    #[test]
    fn test_build_custody_execute_hash_with_approve_calldata() {
        // Test with actual ERC20.approve calldata
        let custody = Address::from([0x11; 20]);
        let token = Address::from([0x22; 20]);
        let spender = Address::from([0x33; 20]);
        let amount = U256::from(1000000000000000000u64); // 1e18

        let approve_calldata = build_erc20_approve_calldata(spender, amount);

        let hash = build_custody_execute_hash(
            111222333,
            custody,
            token,
            &approve_calldata,
            U256::from(0),
        );

        // Verify it produces a valid 32-byte hash
        assert_eq!(hash.as_bytes().len(), 32);
    }

    // ========================================================================
    // Story 7.5: Bridge L3→Settlement Type and Hash Tests
    // ========================================================================

    #[test]
    fn test_build_bridge_l3_to_settlement_hash_deterministic() {
        let hash1 = build_bridge_l3_to_settlement_hash(
            111222333, // L3 chain ID
            42,
            &[U256::from(1), U256::from(2), U256::from(3)],
            U256::from(3000000000000000000u64), // 3 USDC
            Address::from([0xAB; 20]),
        );

        let hash2 = build_bridge_l3_to_settlement_hash(
            111222333,
            42,
            &[U256::from(1), U256::from(2), U256::from(3)],
            U256::from(3000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_build_bridge_l3_to_settlement_hash_different_cycles() {
        let hash1 = build_bridge_l3_to_settlement_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        let hash2 = build_bridge_l3_to_settlement_hash(
            111222333,
            2, // Different cycle
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_bridge_l3_to_settlement_hash_different_orders() {
        let hash1 = build_bridge_l3_to_settlement_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        let hash2 = build_bridge_l3_to_settlement_hash(
            111222333,
            1,
            &[U256::from(2)], // Different order
            U256::from(1000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_bridge_l3_to_settlement_hash_empty() {
        let hash = build_bridge_l3_to_settlement_hash(
            111222333,
            0,
            &[],
            U256::zero(),
            Address::zero(),
        );

        // Should be a valid 32-byte hash even with empty arrays
        assert_eq!(hash.as_bytes().len(), 32);
    }

    #[test]
    fn test_build_bridge_l3_to_settlement_hash_different_amounts() {
        let hash1 = build_bridge_l3_to_settlement_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64), // 1 USDC
            Address::from([0xAB; 20]),
        );

        let hash2 = build_bridge_l3_to_settlement_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(2000000000000000000u64), // 2 USDC - different
            Address::from([0xAB; 20]),
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_bridge_l3_to_settlement_hash_different_destinations() {
        let hash1 = build_bridge_l3_to_settlement_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        let hash2 = build_bridge_l3_to_settlement_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            Address::from([0xCD; 20]), // Different destination
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_bridge_l3_to_settlement_proposal_struct() {
        let proposal = BridgeL3ToSettlementProposal {
            leader_id: [0x11; 32],
            cycle_number: 42,
            order_ids: vec![U256::from(1), U256::from(2)],
            total_amount: U256::from(2000000000000000000u64),
            destination: Address::from([0xAB; 20]),
            leader_signature: BLSSignature(vec![0xFF; 96]),
            message_hash: H256::from([0xEE; 32]),
        };

        assert_eq!(proposal.cycle_number, 42);
        assert_eq!(proposal.order_ids.len(), 2);
        assert_eq!(proposal.total_amount, U256::from(2000000000000000000u64));
    }

    #[test]
    fn test_bridge_l3_to_settlement_result_struct() {
        let result = BridgeL3ToSettlementResult {
            aggregated_signature: BLSSignature(vec![0xFF; 96]),
            signer_bitmap: U256::from(7), // bits 0, 1, 2 set
            signature_count: 3,
        };

        assert_eq!(result.signature_count, 3);
        assert_eq!(result.signer_bitmap, U256::from(7));
    }

    #[test]
    fn test_bridge_order_status_bridged_back_to_settlement() {
        assert_eq!(
            format!("{:?}", BridgeOrderStatus::BridgedBackToSettlement),
            "BridgedBackToSettlement"
        );
    }

    #[test]
    fn test_bridge_error_story_7_5_variants() {
        let err = BridgeError::OrderNotBatched {
            order_id: U256::from(42),
            status: BridgeOrderStatus::SubmittedOnL3,
        };
        assert!(err.to_string().contains("42"));
        assert!(err.to_string().contains("SubmittedOnL3"));

        let err = BridgeError::BridgeL3ToSettlementAlreadyProcessed { cycle_number: 99 };
        assert!(err.to_string().contains("99"));

        let err = BridgeError::AmountMismatch {
            expected: U256::from(1000),
            actual: U256::from(500),
        };
        assert!(err.to_string().contains("1000"));
        assert!(err.to_string().contains("500"));

        let err = BridgeError::BridgeL3ToSettlementFailed {
            reason: "test failure".to_string(),
        };
        assert!(err.to_string().contains("test failure"));
    }

    // ========================================================================
    // Story 7.6: Custody Release to Vault Type and Hash Tests
    // ========================================================================

    #[test]
    fn test_build_release_to_vault_hash_deterministic() {
        let custody = Address::from([0x11; 20]);
        let vault = Address::from([0x22; 20]);

        let hash1 = build_release_to_vault_hash(
            42161, // Settlement chain ID
            custody,
            42,
            &[U256::from(1), U256::from(2), U256::from(3)],
            U256::from(3000000000000000000u64), // 3 USDC
            vault,
        );

        let hash2 = build_release_to_vault_hash(
            42161,
            custody,
            42,
            &[U256::from(1), U256::from(2), U256::from(3)],
            U256::from(3000000000000000000u64),
            vault,
        );

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_build_release_to_vault_hash_different_cycles() {
        let custody = Address::from([0x11; 20]);
        let vault = Address::from([0x22; 20]);

        let hash1 = build_release_to_vault_hash(
            42161,
            custody,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            vault,
        );

        let hash2 = build_release_to_vault_hash(
            42161,
            custody,
            2, // Different cycle
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            vault,
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_release_to_vault_hash_different_orders() {
        let custody = Address::from([0x11; 20]);
        let vault = Address::from([0x22; 20]);

        let hash1 = build_release_to_vault_hash(
            42161,
            custody,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            vault,
        );

        let hash2 = build_release_to_vault_hash(
            42161,
            custody,
            1,
            &[U256::from(2)], // Different order
            U256::from(1000000000000000000u64),
            vault,
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_release_to_vault_hash_empty() {
        let custody = Address::from([0x11; 20]);
        let vault = Address::from([0x22; 20]);

        let hash = build_release_to_vault_hash(
            42161,
            custody,
            0,
            &[],
            U256::zero(),
            vault,
        );

        // Should be a valid 32-byte hash even with empty arrays
        assert_eq!(hash.as_bytes().len(), 32);
    }

    #[test]
    fn test_build_release_to_vault_hash_different_amounts() {
        let custody = Address::from([0x11; 20]);
        let vault = Address::from([0x22; 20]);

        let hash1 = build_release_to_vault_hash(
            42161,
            custody,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64), // 1 USDC
            vault,
        );

        let hash2 = build_release_to_vault_hash(
            42161,
            custody,
            1,
            &[U256::from(1)],
            U256::from(2000000000000000000u64), // 2 USDC - different
            vault,
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_release_to_vault_hash_different_vaults() {
        let custody = Address::from([0x11; 20]);
        let vault1 = Address::from([0x22; 20]);
        let vault2 = Address::from([0x33; 20]);

        let hash1 = build_release_to_vault_hash(
            42161,
            custody,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            vault1,
        );

        let hash2 = build_release_to_vault_hash(
            42161,
            custody,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            vault2, // Different vault
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_release_to_vault_hash_different_custody() {
        let custody1 = Address::from([0x11; 20]);
        let custody2 = Address::from([0x22; 20]);
        let vault = Address::from([0x33; 20]);

        let hash1 = build_release_to_vault_hash(
            42161,
            custody1,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            vault,
        );

        let hash2 = build_release_to_vault_hash(
            42161,
            custody2, // Different custody
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            vault,
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_release_to_vault_proposal_struct() {
        let proposal = ReleaseToVaultProposal {
            leader_id: [0x11; 32],
            cycle_number: 42,
            order_ids: vec![U256::from(1), U256::from(2)],
            total_amount: U256::from(2000000000000000000u64),
            vault_address: Address::from([0xAB; 20]),
            leader_signature: BLSSignature(vec![0xFF; 96]),
            message_hash: H256::from([0xEE; 32]),
        };

        assert_eq!(proposal.cycle_number, 42);
        assert_eq!(proposal.order_ids.len(), 2);
        assert_eq!(proposal.total_amount, U256::from(2000000000000000000u64));
    }

    #[test]
    fn test_release_to_vault_result_struct() {
        let result = ReleaseToVaultResult {
            aggregated_signature: BLSSignature(vec![0xFF; 96]),
            signer_bitmap: U256::from(7), // bits 0, 1, 2 set
            signature_count: 3,
        };

        assert_eq!(result.signature_count, 3);
        assert_eq!(result.signer_bitmap, U256::from(7));
    }

    #[test]
    fn test_bridge_order_status_released_to_vault() {
        assert_eq!(
            format!("{:?}", BridgeOrderStatus::ReleasedToVault),
            "ReleasedToVault"
        );
    }

    #[test]
    fn test_build_erc20_transfer_calldata() {
        let recipient = Address::from([0xAB; 20]);
        let amount = U256::from(1000000000000000000u64); // 1 USDC

        let calldata = build_erc20_transfer_calldata(recipient, amount);

        // Should be 4 (selector) + 32 (recipient) + 32 (amount) = 68 bytes
        assert_eq!(calldata.len(), 68);

        // Verify selector: keccak256("transfer(address,uint256)")[0:4] = 0xa9059cbb
        assert_eq!(&calldata[0..4], &[0xa9, 0x05, 0x9c, 0xbb]);

        // Verify recipient address is at correct position (bytes 4-36)
        // Address is right-aligned in 32 bytes
        let mut expected_recipient = [0u8; 32];
        expected_recipient[12..32].copy_from_slice(recipient.as_bytes());
        assert_eq!(&calldata[4..36], &expected_recipient);
    }

    #[test]
    fn test_build_erc20_transfer_calldata_zero_amount() {
        let recipient = Address::from([0xAB; 20]);
        let amount = U256::zero();

        let calldata = build_erc20_transfer_calldata(recipient, amount);

        // Should still be 68 bytes
        assert_eq!(calldata.len(), 68);

        // Amount should be all zeros (last 32 bytes)
        assert_eq!(&calldata[36..68], &[0u8; 32]);
    }

    #[test]
    fn test_build_erc20_transfer_calldata_max_amount() {
        let recipient = Address::from([0xAB; 20]);
        let amount = U256::MAX;

        let calldata = build_erc20_transfer_calldata(recipient, amount);

        // Should still be 68 bytes
        assert_eq!(calldata.len(), 68);

        // Amount should be all 0xFF (last 32 bytes)
        assert_eq!(&calldata[36..68], &[0xFF; 32]);
    }

    // Story 7-6b: USDC Decimal Conversion tests
    #[test]
    fn test_build_usdc_transfer_calldata_converts_18_to_6_decimals() {
        let recipient = Address::from([0xAB; 20]);
        // 100 USDC in 18-decimal internal format
        let internal_amount = U256::from(100u64) * U256::exp10(18);

        let calldata = build_usdc_transfer_calldata(recipient, internal_amount);

        // Should be 68 bytes (same as ERC20 transfer)
        assert_eq!(calldata.len(), 68);

        // Verify selector
        assert_eq!(&calldata[0..4], &[0xa9, 0x05, 0x9c, 0xbb]);

        // Extract the amount from calldata (last 32 bytes)
        let mut amount_bytes = [0u8; 32];
        amount_bytes.copy_from_slice(&calldata[36..68]);
        let transferred_amount = U256::from_big_endian(&amount_bytes);

        // Should be 100 * 10^6 = 100_000_000 (6 decimals)
        assert_eq!(transferred_amount, U256::from(100_000_000u64));
    }

    #[test]
    fn test_build_usdc_transfer_calldata_with_amount() {
        let recipient = Address::from([0xCD; 20]);
        // 50 USDC in 18-decimal internal format
        let internal_amount = U256::from(50u64) * U256::exp10(18);

        let (calldata, usdc_amount) =
            build_usdc_transfer_calldata_with_amount(recipient, internal_amount);

        // Verify returned amount is 50 * 10^6
        assert_eq!(usdc_amount, U256::from(50_000_000u64));

        // Verify calldata matches the returned amount
        let mut amount_bytes = [0u8; 32];
        amount_bytes.copy_from_slice(&calldata[36..68]);
        let calldata_amount = U256::from_big_endian(&amount_bytes);
        assert_eq!(calldata_amount, usdc_amount);
    }

    #[test]
    fn test_build_usdc_transfer_calldata_dust_truncation() {
        let recipient = Address::from([0xEF; 20]);
        // 1.000000000001 USDC in 18 decimals (has dust)
        // 1 * 10^18 + 10^6 = dust that will be lost
        let internal_amount = U256::exp10(18) + U256::exp10(6);

        let (calldata, usdc_amount) =
            build_usdc_transfer_calldata_with_amount(recipient, internal_amount);

        // Dust is truncated: should be exactly 1_000_000 (1 USDC in 6 decimals)
        assert_eq!(usdc_amount, U256::from(1_000_000u64));

        // Verify calldata
        let mut amount_bytes = [0u8; 32];
        amount_bytes.copy_from_slice(&calldata[36..68]);
        let calldata_amount = U256::from_big_endian(&amount_bytes);
        assert_eq!(calldata_amount, U256::from(1_000_000u64));
    }

    #[test]
    fn test_build_usdc_transfer_calldata_zero() {
        let recipient = Address::from([0x12; 20]);
        let internal_amount = U256::zero();

        let calldata = build_usdc_transfer_calldata(recipient, internal_amount);

        // Amount should be zero
        assert_eq!(&calldata[36..68], &[0u8; 32]);
    }

    #[test]
    fn test_build_usdc_transfer_calldata_small_amount() {
        let recipient = Address::from([0x34; 20]);
        // 0.001 USDC in 18 decimals = 10^15
        let internal_amount = U256::exp10(15);

        let (_, usdc_amount) =
            build_usdc_transfer_calldata_with_amount(recipient, internal_amount);

        // Should be 1000 (0.001 USDC in 6 decimals)
        assert_eq!(usdc_amount, U256::from(1000u64));
    }

    #[test]
    fn test_bridge_error_story_7_6_variants() {
        let err = BridgeError::OrderNotBridgedBack {
            order_id: U256::from(42),
            status: BridgeOrderStatus::Batched,
        };
        assert!(err.to_string().contains("42"));
        assert!(err.to_string().contains("Batched"));

        let err = BridgeError::ReleaseAlreadyProcessed { cycle_number: 99 };
        assert!(err.to_string().contains("99"));

        let err = BridgeError::VaultAddressMismatch {
            expected: Address::from([0x11; 20]),
            actual: Address::from([0x22; 20]),
        };
        assert!(err.to_string().contains("0x1111"));
        assert!(err.to_string().contains("0x2222"));

        let err = BridgeError::CustodyReleaseFailed {
            reason: "test failure".to_string(),
        };
        assert!(err.to_string().contains("test failure"));
    }

    #[test]
    fn test_mirror_sync_hash_matches_solidity() {
        // Production parameters from the actual sync tx
        let chain_id: u64 = 14601;
        let mirror_address: Address = "0x015e39eefbab8f5d317dc7900465ea2673bf8424".parse().unwrap();
        let nonce: u64 = 4;
        let active_bitmask = U256::from(7);
        let active_count: u64 = 3;
        let threshold: u64 = 2;

        let pk0 = hex::decode("0eb702456546a23dedf661a1de566f5577e41085f67bb03d52f325d7a8c5d1bd21cc6c2f152efd0c207653da5190ea396f3c66412f2fd771bae5b9ec0834e9f7120b5cb07493b8823cd51b04e51dec1a806b8fbede7ea459c149f59f526fdd7e2c41648dcaf9c2c536e7092a762ebdbd93df6f80851979a0ce67f6baf982161d").unwrap();
        let pk1 = hex::decode("0fd1e1a44bceee1adbf120f6ab7412d7d0d6b06ccdd670b28093f00ad20ab7ff16aca4de00dc1804e8d2997234f4788833faf522d15ae136f0040c4b9337e1da00818b4b2c1aa3106ed6e9983d060dc94174e996e59604fc806c3bb1ec6a3679089f6ade3c34e86ffa9f8c36a4842a0c0416b6db5a1c184835c026c1d7f23155").unwrap();
        let pk2 = hex::decode("0a2b99ccc213b30a719a7548c5f8935ca08c22566a9ca0d1e588a538f0db4a6512af24753e246c5dcb22413e2657ac2f5165b10af07c2243f7cf5c1f44befc5c155d01b12b2d27f9410e329d2d43b727bfd2db4f3c23ef71e7bf39f5a5ed65f10c53552fef266c83c2d00508af0ec75d85d8f39dfb4e568f3beec8af6db1cc2d").unwrap();

        let pubkeys = vec![pk0, pk1, pk2];
        let ids = vec![0u64, 1, 2];

        let hash = build_mirror_registry_sync_hash(
            chain_id, mirror_address, nonce, &pubkeys, &ids, active_bitmask, active_count, threshold,
        );

        // Expected from Solidity: cast abi-encode + cast keccak
        let expected = H256::from_slice(&hex::decode("a54ee6f36b76fc34878fcd6a054ce7e6d278824948f4e8c1ae1791e3eda39f51").unwrap());
        assert_eq!(hash, expected, "Rust hash {hash:?} != Solidity expected {expected:?}");
    }
}
