//! Types for bridge orchestration
//!
//! Story 7.2: Bridge USDC Orchestrator (Arb→L3)
//! Story 7.3: Submit Order for User
//! Story 7.4: Batch and Fill Orchestration

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::Notify;

use common::decimals;
use common::types::{BLSSignature, PeerId};

/// Bridge orchestrator configuration
#[derive(Debug, Clone)]
pub struct BridgeConfig {
    /// IssuerCustody L3 address (destination for bridged L3Usdc)
    pub issuer_custody_l3: Address,
    /// L3Usdc contract address
    pub l3_usdc_address: Address,
    /// ArbBridgeCustody address (for order verification)
    pub arb_custody_address: Address,
    /// Arbitrum chain ID (for message hash)
    pub arbitrum_chain_id: u64,
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
    /// IssuerCustody Arbitrum address (destination for bridged-back ArbUSDC) - Story 7.5
    pub issuer_custody_arb: Address,
    /// ArbUSDC contract address (USDC token on Arbitrum) - Story 7.5
    pub arb_usdc_address: Address,
    /// MockBitgetVault address for AP trading (Story 7.6)
    pub bitget_vault: Address,
    /// Issuer signer address (for bridge mint recipient in local E2E)
    pub signer_address: Address,
    /// CollateralRegistry contract address on L3 (8-step bridge Step 3)
    pub collateral_registry: Address,
    /// BridgeProxy contract address on Arbitrum (8-step bridge Step 8)
    pub bridge_proxy: Address,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            issuer_custody_l3: Address::zero(),
            l3_usdc_address: Address::zero(),
            arb_custody_address: Address::zero(),
            arbitrum_chain_id: 42161, // Arbitrum One mainnet
            l3_chain_id: 111222333,   // Index L3 Orbit chain
            index_address: Address::zero(),
            min_signatures: 2,
            proposal_timeout_ms: 500,
            sign_timeout_ms: 300,
            issuer_custody_arb: Address::zero(), // Story 7.5
            arb_usdc_address: Address::zero(),   // Story 7.5
            bitget_vault: Address::zero(),       // Story 7.6
            signer_address: Address::zero(),
            collateral_registry: Address::zero(), // 8-step bridge
            bridge_proxy: Address::zero(),        // 8-step bridge
        }
    }
}

/// Bridge order status tracking
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BridgeOrderStatus {
    /// Order received, waiting for consensus
    Pending,
    /// Successfully bridged USDC from Arbitrum to L3
    BridgedToL3,
    /// Order submitted on L3 (Story 7.3)
    SubmittedOnL3,
    /// Order included in confirmed batch (Story 7.4)
    Batched,
    /// Order filled and ITP shares minted (Story 7.4)
    Filled,
    /// Successfully bridged back from L3 to Arbitrum (Story 7.5)
    BridgedBackToArb,
    /// USDC released to MockBitgetVault for AP trading (Story 7.6)
    ReleasedToVault,
    /// BridgedITP shares minted on Arbitrum via BridgeProxy (Step 8)
    SharesBridged,
    /// Bridge failed
    Failed,
    /// Sell order received from Arb, waiting for consensus
    SellPending,
    /// Sell order submitted on L3 via Index.submitOrderFor()
    SellSubmittedOnL3,
    /// Sell order filled on L3, USDC returned
    SellFilled,
    /// USDC bridged back to Arb, completeSellOrder called
    SellCompleted,
}

/// Bridge proposal containing all order details for consensus
#[derive(Debug, Clone)]
pub struct BridgeProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// CrossChainOrder ID from ArbBridgeCustody
    pub order_id: U256,
    /// ITP being purchased
    pub itp_id: H256,
    /// User who initiated the order on Arbitrum
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
    /// CrossChainSellOrder ID from ArbBridgeCustody
    pub order_id: U256,
    /// ITP being sold
    pub itp_id: H256,
    /// User who initiated the sell on Arbitrum
    pub user: Address,
    /// Bridged ITP token address on Arbitrum
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
#[derive(Debug, Clone)]
pub struct CompleteSellOrderResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

/// Complete sell order proposal for BLS consensus on Arbitrum
#[derive(Debug, Clone)]
pub struct CompleteSellProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Arb sell order ID
    pub order_id: U256,
    /// USDC proceeds to return to user
    pub usdc_proceeds: U256,
    /// Leader's BLS signature
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful bridge execution
#[derive(Debug, Clone)]
pub struct BridgeResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

// ============================================================================
// Story 7.3: Submit Order for User Types
// ============================================================================

/// Submit order proposal for BLS consensus
/// Story 7.3: Submit Order for User
#[derive(Debug, Clone)]
pub struct SubmitOrderProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Original Arbitrum order ID (from CrossChainOrderCreated)
    pub arb_order_id: U256,
    /// ITP being purchased
    pub itp_id: H256,
    /// Original Arbitrum user (for share distribution later)
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

/// Mapping between Arbitrum and L3 order IDs
/// Story 7.3: Submit Order for User
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderMapping {
    /// Original order ID from ArbBridgeCustody
    pub arb_order_id: U256,
    /// Resulting order ID from Index.submitOrder()
    pub l3_order_id: U256,
    /// Original user from Arbitrum (for share distribution)
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
    #[error("insufficient signatures: got {got}, need {need}")]
    InsufficientSignatures { got: usize, need: usize },

    #[error("proposal timeout: no response within {timeout_ms}ms")]
    ProposalTimeout { timeout_ms: u64 },

    #[error("signing timeout: {received} signatures within {timeout_ms}ms")]
    SigningTimeout { received: usize, timeout_ms: u64 },

    #[error("order expired: deadline {deadline} < now {now}")]
    OrderExpired { deadline: u64, now: u64 },

    #[error("order not found: {order_id}")]
    OrderNotFound { order_id: U256 },

    #[error("proposal mismatch: {field} differs from on-chain")]
    ProposalMismatch { field: String },

    #[error("chain reader error: {reason}")]
    ChainReaderError { reason: String },

    #[error("chain writer error: {reason}")]
    ChainWriterError { reason: String },

    #[error("BLS signing error: {reason}")]
    BlsSigningError { reason: String },

    #[error("already processed: order {order_id} already bridged")]
    AlreadyProcessed { order_id: U256 },

    #[error("not leader: cannot propose bridge")]
    NotLeader,

    #[error("P2P error: {reason}")]
    P2PError { reason: String },

    // Story 7.3: Submit Order for User error variants
    #[error("order not bridged: {arb_order_id} has status {status:?}")]
    OrderNotBridged { arb_order_id: U256, status: Option<BridgeOrderStatus> },

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

    #[error("order already submitted: arb_order_id={arb_order_id} maps to l3_order_id={l3_order_id}")]
    OrderAlreadySubmitted { arb_order_id: U256, l3_order_id: U256 },

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

    // Story 7.5: Bridge L3→Arb error variants
    #[error("order not batched: {order_id} has status {status:?}")]
    OrderNotBatched { order_id: U256, status: BridgeOrderStatus },

    #[error("bridge L3→Arb already processed: cycle {cycle_number}")]
    BridgeL3ToArbAlreadyProcessed { cycle_number: u64 },

    #[error("amount mismatch: expected {expected}, got {actual}")]
    AmountMismatch { expected: U256, actual: U256 },

    #[error("bridge L3→Arb failed: {reason}")]
    BridgeL3ToArbFailed { reason: String },

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
}

/// Build the message hash for bridge Arb→L3 consensus
///
/// Layout (180 bytes packed):
/// - chain_id: 32 bytes (Arbitrum chain ID)
/// - order_id: 32 bytes
/// - itp_id: 32 bytes
/// - user: 20 bytes (packed address)
/// - amount: 32 bytes
/// - deadline: 32 bytes
///
/// This matches the format expected for BLS signature verification.
pub fn build_bridge_arb_to_l3_hash(
    chain_id: u64,
    order_id: U256,
    itp_id: H256,
    user: Address,
    amount: U256,
    deadline: U256,
) -> H256 {
    let mut data = Vec::with_capacity(180);

    // chain_id as uint256 (32 bytes, big endian)
    let mut chain_id_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_id_bytes);
    data.extend_from_slice(&chain_id_bytes);

    // order_id as uint256 (32 bytes, big endian)
    let mut order_id_bytes = [0u8; 32];
    order_id.to_big_endian(&mut order_id_bytes);
    data.extend_from_slice(&order_id_bytes);

    // itp_id as bytes32 (32 bytes)
    data.extend_from_slice(itp_id.as_bytes());

    // user as address (20 bytes, packed - no zero padding)
    data.extend_from_slice(user.as_bytes());

    // amount as uint256 (32 bytes, big endian)
    let mut amount_bytes = [0u8; 32];
    amount.to_big_endian(&mut amount_bytes);
    data.extend_from_slice(&amount_bytes);

    // deadline as uint256 (32 bytes, big endian)
    let mut deadline_bytes = [0u8; 32];
    deadline.to_big_endian(&mut deadline_bytes);
    data.extend_from_slice(&deadline_bytes);

    H256::from_slice(&ethers::utils::keccak256(&data))
}

// ============================================================================
// Cross-Chain Sell Order Hash and Calldata Builders
// ============================================================================

/// Build the message hash for sell bridge consensus
///
/// Layout (212 bytes packed):
/// - chain_id: 32 bytes (Arbitrum chain ID)
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
    let mut data = Vec::with_capacity(168);

    // chain_id as uint256 (32 bytes, big endian)
    let mut chain_id_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_id_bytes);
    data.extend_from_slice(&chain_id_bytes);

    // order_id as uint256 (32 bytes, big endian)
    let mut order_id_bytes = [0u8; 32];
    order_id.to_big_endian(&mut order_id_bytes);
    data.extend_from_slice(&order_id_bytes);

    // itp_id as bytes32 (32 bytes)
    data.extend_from_slice(itp_id.as_bytes());

    // user as address (20 bytes, packed - no zero padding)
    data.extend_from_slice(user.as_bytes());

    // bridged_itp_address as address (20 bytes, packed - no zero padding)
    data.extend_from_slice(bridged_itp_address.as_bytes());

    // amount as uint256 (32 bytes, big endian)
    let mut amount_bytes = [0u8; 32];
    amount.to_big_endian(&mut amount_bytes);
    data.extend_from_slice(&amount_bytes);

    H256::from_slice(&ethers::utils::keccak256(&data))
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
) -> H256 {
    // abi.encode(uint256, address, string, uint256, uint256)
    // Head: 5 slots (chain_id, address, string_offset, order_id, usdc_proceeds)
    // Tail: string length + padded data for "completeSellOrder"
    let mut data = Vec::with_capacity(256);

    // chain_id as uint256 (32 bytes)
    let mut chain_id_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_id_bytes);
    data.extend_from_slice(&chain_id_bytes);

    // custody_address as address (32 bytes, left-padded)
    let mut addr_bytes = [0u8; 32];
    addr_bytes[12..32].copy_from_slice(custody_address.as_bytes());
    data.extend_from_slice(&addr_bytes);

    // string offset (points to dynamic data area: 5 * 32 = 160)
    let mut offset_bytes = [0u8; 32];
    U256::from(160).to_big_endian(&mut offset_bytes);
    data.extend_from_slice(&offset_bytes);

    // order_id as uint256 (32 bytes)
    let mut order_id_bytes = [0u8; 32];
    order_id.to_big_endian(&mut order_id_bytes);
    data.extend_from_slice(&order_id_bytes);

    // usdc_proceeds as uint256 (32 bytes)
    let mut proceeds_bytes = [0u8; 32];
    usdc_proceeds.to_big_endian(&mut proceeds_bytes);
    data.extend_from_slice(&proceeds_bytes);

    // Dynamic string "completeSellOrder" (17 bytes)
    let s = b"completeSellOrder";
    // string length (32 bytes)
    let mut len_bytes = [0u8; 32];
    U256::from(s.len()).to_big_endian(&mut len_bytes);
    data.extend_from_slice(&len_bytes);
    // string data padded to 32 bytes
    let mut padded = [0u8; 32];
    padded[..s.len()].copy_from_slice(s);
    data.extend_from_slice(&padded);

    H256::from_slice(&ethers::utils::keccak256(&data))
}

/// Build calldata for ArbBridgeCustody.completeSellOrder()
///
/// Selector: keccak256("completeSellOrder(uint256,uint256,bytes,uint256,uint256)")[0:4]
///
/// ABI encodes: orderId, usdcProceeds, blsSignature, referenceNonce, signersBitmask
pub fn build_complete_sell_order_calldata(
    order_id: U256,
    usdc_proceeds: U256,
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        "completeSellOrder(uint256,uint256,bytes,uint256,uint256)"
    )[..4];

    let mut calldata = selector.to_vec();

    // orderId (32 bytes)
    let mut order_id_bytes = [0u8; 32];
    order_id.to_big_endian(&mut order_id_bytes);
    calldata.extend_from_slice(&order_id_bytes);

    // usdcProceeds (32 bytes)
    let mut proceeds_bytes = [0u8; 32];
    usdc_proceeds.to_big_endian(&mut proceeds_bytes);
    calldata.extend_from_slice(&proceeds_bytes);

    // Dynamic offset for blsSignature (5 head words * 32 = 160 = 0xa0)
    let mut offset_bytes = [0u8; 32];
    U256::from(160).to_big_endian(&mut offset_bytes);
    calldata.extend_from_slice(&offset_bytes);

    // referenceNonce (32 bytes)
    let mut nonce_bytes = [0u8; 32];
    U256::from(reference_nonce).to_big_endian(&mut nonce_bytes);
    calldata.extend_from_slice(&nonce_bytes);

    // signersBitmask (32 bytes)
    let mut bitmask_bytes = [0u8; 32];
    signers_bitmask.to_big_endian(&mut bitmask_bytes);
    calldata.extend_from_slice(&bitmask_bytes);

    // blsSignature bytes: length + data (padded to 32)
    let mut sig_len_bytes = [0u8; 32];
    U256::from(bls_signature.len()).to_big_endian(&mut sig_len_bytes);
    calldata.extend_from_slice(&sig_len_bytes);
    calldata.extend_from_slice(bls_signature);
    let padding = (32 - (bls_signature.len() % 32)) % 32;
    calldata.extend(vec![0u8; padding]);

    calldata
}

// ============================================================================
// Story 7.3: Submit Order Hash and Calldata Builders
// ============================================================================

/// Build the message hash for submit order consensus
///
/// Layout (244 bytes packed):
/// - chain_id: 32 bytes (L3 chain ID)
/// - arb_order_id: 32 bytes
/// - itp_id: 32 bytes
/// - user: 20 bytes (packed address - original Arbitrum user)
/// - amount: 32 bytes
/// - limit_price: 32 bytes
/// - slippage_tier: 32 bytes
/// - deadline: 32 bytes
///
/// Story 7.3: Submit Order for User
pub fn build_submit_order_hash(
    chain_id: u64,
    arb_order_id: U256,
    itp_id: H256,
    user: Address,
    amount: U256,
    limit_price: U256,
    slippage_tier: U256,
    deadline: U256,
) -> H256 {
    let mut data = Vec::with_capacity(244);

    // chain_id as uint256 (32 bytes, big endian)
    let mut chain_id_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_id_bytes);
    data.extend_from_slice(&chain_id_bytes);

    // arb_order_id as uint256 (32 bytes, big endian)
    let mut arb_order_id_bytes = [0u8; 32];
    arb_order_id.to_big_endian(&mut arb_order_id_bytes);
    data.extend_from_slice(&arb_order_id_bytes);

    // itp_id as bytes32 (32 bytes)
    data.extend_from_slice(itp_id.as_bytes());

    // user as address (20 bytes, packed - no zero padding)
    data.extend_from_slice(user.as_bytes());

    // amount as uint256 (32 bytes, big endian)
    let mut amount_bytes = [0u8; 32];
    amount.to_big_endian(&mut amount_bytes);
    data.extend_from_slice(&amount_bytes);

    // limit_price as uint256 (32 bytes, big endian)
    let mut limit_price_bytes = [0u8; 32];
    limit_price.to_big_endian(&mut limit_price_bytes);
    data.extend_from_slice(&limit_price_bytes);

    // slippage_tier as uint256 (32 bytes, big endian)
    let mut slippage_tier_bytes = [0u8; 32];
    slippage_tier.to_big_endian(&mut slippage_tier_bytes);
    data.extend_from_slice(&slippage_tier_bytes);

    // deadline as uint256 (32 bytes, big endian)
    let mut deadline_bytes = [0u8; 32];
    deadline.to_big_endian(&mut deadline_bytes);
    data.extend_from_slice(&deadline_bytes);

    H256::from_slice(&ethers::utils::keccak256(&data))
}

/// Build calldata for ERC20.approve(spender, amount)
///
/// Selector: 0x095ea7b3 (approve(address,uint256))
///
/// Story 7.3: Submit Order for User
pub fn build_erc20_approve_calldata(spender: Address, amount: U256) -> Vec<u8> {
    let selector = &ethers::utils::keccak256("approve(address,uint256)")[..4];

    let mut calldata = selector.to_vec();

    // spender address (32 bytes, left-padded)
    let mut spender_bytes = [0u8; 32];
    spender_bytes[12..32].copy_from_slice(spender.as_bytes());
    calldata.extend_from_slice(&spender_bytes);

    // amount (32 bytes)
    let mut amount_bytes = [0u8; 32];
    amount.to_big_endian(&mut amount_bytes);
    calldata.extend_from_slice(&amount_bytes);

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

    // itpId (32 bytes)
    calldata.extend_from_slice(itp_id.as_bytes());

    // side (32 bytes, uint8 padded)
    let mut side_bytes = [0u8; 32];
    side_bytes[31] = side;
    calldata.extend_from_slice(&side_bytes);

    // amount (32 bytes)
    let mut amount_bytes = [0u8; 32];
    amount.to_big_endian(&mut amount_bytes);
    calldata.extend_from_slice(&amount_bytes);

    // limitPrice (32 bytes)
    let mut limit_price_bytes = [0u8; 32];
    limit_price.to_big_endian(&mut limit_price_bytes);
    calldata.extend_from_slice(&limit_price_bytes);

    // slippageTier (32 bytes)
    let mut slippage_tier_bytes = [0u8; 32];
    slippage_tier.to_big_endian(&mut slippage_tier_bytes);
    calldata.extend_from_slice(&slippage_tier_bytes);

    // deadline (32 bytes)
    let mut deadline_bytes = [0u8; 32];
    deadline.to_big_endian(&mut deadline_bytes);
    calldata.extend_from_slice(&deadline_bytes);

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

    // beneficiary (32 bytes, address left-padded)
    let mut beneficiary_bytes = [0u8; 32];
    beneficiary_bytes[12..32].copy_from_slice(beneficiary.as_bytes());
    calldata.extend_from_slice(&beneficiary_bytes);

    // itpId (32 bytes)
    calldata.extend_from_slice(itp_id.as_bytes());

    // side (32 bytes, uint8 padded)
    let mut side_bytes = [0u8; 32];
    side_bytes[31] = side;
    calldata.extend_from_slice(&side_bytes);

    // amount (32 bytes)
    let mut amount_bytes = [0u8; 32];
    amount.to_big_endian(&mut amount_bytes);
    calldata.extend_from_slice(&amount_bytes);

    // limitPrice (32 bytes)
    let mut limit_price_bytes = [0u8; 32];
    limit_price.to_big_endian(&mut limit_price_bytes);
    calldata.extend_from_slice(&limit_price_bytes);

    // slippageTier (32 bytes)
    let mut slippage_tier_bytes = [0u8; 32];
    slippage_tier.to_big_endian(&mut slippage_tier_bytes);
    calldata.extend_from_slice(&slippage_tier_bytes);

    // deadline (32 bytes)
    let mut deadline_bytes = [0u8; 32];
    deadline.to_big_endian(&mut deadline_bytes);
    calldata.extend_from_slice(&deadline_bytes);

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
#[derive(Debug, Clone)]
pub struct BatchResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

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
#[derive(Debug, Clone)]
pub struct FillsResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

// ============================================================================
// Story 7.5: Bridge L3→Arb Types
// ============================================================================

/// Bridge L3→Arb proposal for BLS consensus
/// Story 7.5: Bridge USDC L3 to Arbitrum
#[derive(Debug, Clone)]
pub struct BridgeL3ToArbProposal {
    /// Leader's peer ID
    pub leader_id: PeerId,
    /// Cycle number that batched these orders
    pub cycle_number: u64,
    /// Order IDs being bridged back
    pub order_ids: Vec<U256>,
    /// Total USDC amount to bridge (18 decimals)
    pub total_amount: U256,
    /// Destination: IssuerCustody on Arbitrum
    pub destination: Address,
    /// Leader's BLS signature on the bridge hash
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful bridge L3→Arb execution
/// Story 7.5: Bridge USDC L3 to Arbitrum
#[derive(Debug, Clone)]
pub struct BridgeL3ToArbResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

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
    /// Destination: MockBitgetVault on Arbitrum
    pub vault_address: Address,
    /// Leader's BLS signature on the release hash
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful custody release to vault
/// Story 7.6: Custody Release to MockBitgetVault
#[derive(Debug, Clone)]
pub struct ReleaseToVaultResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

// ============================================================================
// 8-step bridge: RecordCollateralMove Types
// ============================================================================

/// Proposal for recording collateral movement in CollateralRegistry
/// This is Step 3 of the 8-step bridge: after batch confirm, before L3→Arb bridge.
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
    /// Destination chain ID (Arb = 42161)
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
#[derive(Debug, Clone)]
pub struct RecordCollateralMoveResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

// ============================================================================
// 8-step bridge: MintBridgedShares Types
// ============================================================================

/// Proposal for minting BridgedITP shares on Arbitrum via BridgeProxy
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
    /// Leader's BLS signature
    pub leader_signature: BLSSignature,
    /// Message hash that was signed
    pub message_hash: H256,
}

/// Result of successful MintBridgedShares consensus
#[derive(Debug, Clone)]
pub struct MintBridgedSharesResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

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
#[derive(Debug, Clone)]
pub struct CompleteBuyOrderResult {
    pub aggregated_signature: BLSSignature,
    pub signer_bitmap: U256,
    pub signature_count: usize,
}

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
    let mut data = Vec::with_capacity(256);

    // chain_id as uint256 (32 bytes)
    let mut chain_id_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_id_bytes);
    data.extend_from_slice(&chain_id_bytes);

    // collateral_registry as address (32 bytes, left-padded)
    let mut addr_bytes = [0u8; 32];
    addr_bytes[12..32].copy_from_slice(collateral_registry.as_bytes());
    data.extend_from_slice(&addr_bytes);

    // itp_id as bytes32 (32 bytes)
    data.extend_from_slice(itp_id.as_bytes());

    // from_chain as uint256 (32 bytes)
    let mut from_chain_bytes = [0u8; 32];
    from_chain.to_big_endian(&mut from_chain_bytes);
    data.extend_from_slice(&from_chain_bytes);

    // to_chain as uint256 (32 bytes)
    let mut to_chain_bytes = [0u8; 32];
    to_chain.to_big_endian(&mut to_chain_bytes);
    data.extend_from_slice(&to_chain_bytes);

    // amount as uint256 (32 bytes)
    let mut amount_bytes = [0u8; 32];
    amount.to_big_endian(&mut amount_bytes);
    data.extend_from_slice(&amount_bytes);

    // tx_type as uint8, padded to 32 bytes
    let mut tx_type_bytes = [0u8; 32];
    tx_type_bytes[31] = tx_type;
    data.extend_from_slice(&tx_type_bytes);

    H256::from_slice(&ethers::utils::keccak256(&data))
}

/// Build message hash for MintBridgedShares consensus
///
/// Matches: keccak256(abi.encode(chainid, bridgeProxy, "mintBridgedShares", itpId, user, amount))
/// Uses ABI encoding with dynamic string.
pub fn build_mint_bridged_shares_hash(
    chain_id: u64,
    bridge_proxy: Address,
    itp_id: H256,
    user: Address,
    amount: U256,
) -> H256 {
    // abi.encode(uint256, address, string, bytes32, address, uint256)
    // Head: 6 slots (chain_id, address, string_offset, itp_id, user, amount)
    // Tail: string length + padded data for "mintBridgedShares"
    let mut data = Vec::with_capacity(320);

    // chain_id as uint256 (32 bytes)
    let mut chain_id_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_id_bytes);
    data.extend_from_slice(&chain_id_bytes);

    // bridge_proxy as address (32 bytes, left-padded)
    let mut proxy_bytes = [0u8; 32];
    proxy_bytes[12..32].copy_from_slice(bridge_proxy.as_bytes());
    data.extend_from_slice(&proxy_bytes);

    // string offset (192 = 6 * 32, points past the 6 head slots)
    let mut offset_bytes = [0u8; 32];
    U256::from(192).to_big_endian(&mut offset_bytes);
    data.extend_from_slice(&offset_bytes);

    // itp_id as bytes32 (32 bytes)
    data.extend_from_slice(itp_id.as_bytes());

    // user as address (32 bytes, left-padded)
    let mut user_bytes = [0u8; 32];
    user_bytes[12..32].copy_from_slice(user.as_bytes());
    data.extend_from_slice(&user_bytes);

    // amount as uint256 (32 bytes)
    let mut amount_bytes = [0u8; 32];
    amount.to_big_endian(&mut amount_bytes);
    data.extend_from_slice(&amount_bytes);

    // Dynamic string "mintBridgedShares" (17 bytes)
    let s = b"mintBridgedShares";
    let mut len_bytes = [0u8; 32];
    U256::from(s.len()).to_big_endian(&mut len_bytes);
    data.extend_from_slice(&len_bytes);

    let mut padded = [0u8; 32];
    padded[..s.len()].copy_from_slice(s);
    data.extend_from_slice(&padded);

    let hash = H256::from_slice(&ethers::utils::keccak256(&data));
    tracing::debug!(
        %chain_id,
        bridge_proxy = ?bridge_proxy,
        itp_id = ?itp_id,
        user = ?user,
        amount = %amount,
        hash = ?hash,
        "build_mint_bridged_shares_hash"
    );
    hash
}

/// Build message hash for completeBuyOrder consensus
///
/// Matches: keccak256(abi.encode(chainid, arbCustody, "completeBuyOrder", orderId, vault))
/// Uses ABI encoding with dynamic string.
pub fn build_complete_buy_order_hash(
    chain_id: u64,
    arb_custody: Address,
    order_id: U256,
    vault: Address,
) -> H256 {
    // abi.encode(uint256, address, string, uint256, address)
    // Head: 5 slots (chain_id, address, string_offset, orderId, vault)
    // Tail: string length + padded data for "completeBuyOrder"
    let mut data = Vec::with_capacity(224);

    // chain_id as uint256 (32 bytes)
    let mut chain_id_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_id_bytes);
    data.extend_from_slice(&chain_id_bytes);

    // arb_custody as address (32 bytes, left-padded)
    let mut custody_bytes = [0u8; 32];
    custody_bytes[12..32].copy_from_slice(arb_custody.as_bytes());
    data.extend_from_slice(&custody_bytes);

    // string offset (160 = 5 * 32, points past the 5 head slots)
    let mut offset_bytes = [0u8; 32];
    U256::from(160).to_big_endian(&mut offset_bytes);
    data.extend_from_slice(&offset_bytes);

    // orderId as uint256 (32 bytes)
    let mut order_id_bytes = [0u8; 32];
    order_id.to_big_endian(&mut order_id_bytes);
    data.extend_from_slice(&order_id_bytes);

    // vault as address (32 bytes, left-padded)
    let mut vault_bytes = [0u8; 32];
    vault_bytes[12..32].copy_from_slice(vault.as_bytes());
    data.extend_from_slice(&vault_bytes);

    // Dynamic string "completeBuyOrder" (16 bytes)
    let s = b"completeBuyOrder";
    let mut len_bytes = [0u8; 32];
    U256::from(s.len()).to_big_endian(&mut len_bytes);
    data.extend_from_slice(&len_bytes);

    let mut padded = [0u8; 32];
    padded[..s.len()].copy_from_slice(s);
    data.extend_from_slice(&padded);

    H256::from_slice(&ethers::utils::keccak256(&data))
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

    // itp_id (32 bytes)
    data.extend_from_slice(itp_id.as_bytes());

    // from_chain (32 bytes)
    let mut from_bytes = [0u8; 32];
    from_chain.to_big_endian(&mut from_bytes);
    data.extend_from_slice(&from_bytes);

    // to_chain (32 bytes)
    let mut to_bytes = [0u8; 32];
    to_chain.to_big_endian(&mut to_bytes);
    data.extend_from_slice(&to_bytes);

    // amount (32 bytes)
    let mut amount_bytes = [0u8; 32];
    amount.to_big_endian(&mut amount_bytes);
    data.extend_from_slice(&amount_bytes);

    // tx_type as uint8, padded to 32 bytes
    let mut tx_type_bytes = [0u8; 32];
    tx_type_bytes[31] = tx_type;
    data.extend_from_slice(&tx_type_bytes);

    // bls_signature offset (256 = 8 * 32)
    let mut offset = [0u8; 32];
    U256::from(256).to_big_endian(&mut offset);
    data.extend_from_slice(&offset);

    // referenceNonce (32 bytes)
    let mut nonce_bytes = [0u8; 32];
    U256::from(reference_nonce).to_big_endian(&mut nonce_bytes);
    data.extend_from_slice(&nonce_bytes);

    // signersBitmask (32 bytes)
    let mut bitmask_bytes = [0u8; 32];
    signers_bitmask.to_big_endian(&mut bitmask_bytes);
    data.extend_from_slice(&bitmask_bytes);

    // bls_signature length
    let mut len_bytes = [0u8; 32];
    U256::from(bls_signature.len()).to_big_endian(&mut len_bytes);
    data.extend_from_slice(&len_bytes);

    // bls_signature data (padded to 32 bytes)
    data.extend_from_slice(bls_signature);
    let pad_len = (32 - (bls_signature.len() % 32)) % 32;
    data.extend(std::iter::repeat(0u8).take(pad_len));

    data
}

/// Build calldata for BridgeProxy.mintBridgedShares(itpId, user, amount, blsSignature, referenceNonce, signersBitmask)
pub fn build_mint_bridged_shares_calldata(
    itp_id: H256,
    user: Address,
    amount: U256,
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    // mintBridgedShares(bytes32,address,uint256,bytes,uint256,uint256)
    let selector = &ethers::utils::keccak256("mintBridgedShares(bytes32,address,uint256,bytes,uint256,uint256)")[..4];
    let mut data = selector.to_vec();

    // itp_id (32 bytes)
    data.extend_from_slice(itp_id.as_bytes());

    // user as address (32 bytes, left-padded)
    let mut user_bytes = [0u8; 32];
    user_bytes[12..32].copy_from_slice(user.as_bytes());
    data.extend_from_slice(&user_bytes);

    // amount (32 bytes)
    let mut amount_bytes = [0u8; 32];
    amount.to_big_endian(&mut amount_bytes);
    data.extend_from_slice(&amount_bytes);

    // blsSignature offset (dynamic: 6 * 32 = 192)
    let mut sig_offset = [0u8; 32];
    U256::from(192).to_big_endian(&mut sig_offset);
    data.extend_from_slice(&sig_offset);

    // referenceNonce (32 bytes)
    let mut nonce_bytes = [0u8; 32];
    U256::from(reference_nonce).to_big_endian(&mut nonce_bytes);
    data.extend_from_slice(&nonce_bytes);

    // signersBitmask (32 bytes)
    let mut bitmask_bytes = [0u8; 32];
    signers_bitmask.to_big_endian(&mut bitmask_bytes);
    data.extend_from_slice(&bitmask_bytes);

    // blsSignature length
    let mut sig_len = [0u8; 32];
    U256::from(bls_signature.len()).to_big_endian(&mut sig_len);
    data.extend_from_slice(&sig_len);

    // blsSignature data (padded to 32 bytes)
    data.extend_from_slice(bls_signature);
    let sig_pad = (32 - (bls_signature.len() % 32)) % 32;
    data.extend(std::iter::repeat(0u8).take(sig_pad));

    data
}

// ============================================================================
// Story 7.6: Custody Release Hash and Calldata Builders
// ============================================================================

/// Build message hash for custody release to vault consensus
///
/// Layout (variable size):
/// - chain_id: 32 bytes (Arbitrum chain ID)
/// - custody_address: 32 bytes (IssuerCustody Arbitrum)
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
    let mut data = Vec::with_capacity(192 + order_ids.len() * 32);

    // chain_id as uint256
    let mut chain_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_bytes);
    data.extend_from_slice(&chain_bytes);

    // custody_address (padded to 32 bytes)
    let mut custody_bytes = [0u8; 32];
    custody_bytes[12..32].copy_from_slice(custody_address.as_bytes());
    data.extend_from_slice(&custody_bytes);

    // cycle_number as uint256
    let mut cycle_bytes = [0u8; 32];
    U256::from(cycle_number).to_big_endian(&mut cycle_bytes);
    data.extend_from_slice(&cycle_bytes);

    // order_count as uint256
    let mut count_bytes = [0u8; 32];
    U256::from(order_ids.len()).to_big_endian(&mut count_bytes);
    data.extend_from_slice(&count_bytes);

    // order_ids
    for order_id in order_ids {
        let mut order_bytes = [0u8; 32];
        order_id.to_big_endian(&mut order_bytes);
        data.extend_from_slice(&order_bytes);
    }

    // total_amount as uint256
    let mut amount_bytes = [0u8; 32];
    total_amount.to_big_endian(&mut amount_bytes);
    data.extend_from_slice(&amount_bytes);

    // vault_address (padded to 32 bytes)
    let mut vault_bytes = [0u8; 32];
    vault_bytes[12..32].copy_from_slice(vault_address.as_bytes());
    data.extend_from_slice(&vault_bytes);

    H256::from_slice(&ethers::utils::keccak256(&data))
}

/// Build calldata for ERC20.transfer(address,uint256)
///
/// Selector: keccak256("transfer(address,uint256)")[0:4] = 0xa9059cbb
///
/// Story 7.6: Custody Release to MockBitgetVault (Task 5)
pub fn build_erc20_transfer_calldata(recipient: Address, amount: U256) -> Vec<u8> {
    let selector = &ethers::utils::keccak256("transfer(address,uint256)")[..4];

    let mut calldata = selector.to_vec();

    // Recipient address (padded to 32 bytes)
    let mut recipient_bytes = [0u8; 32];
    recipient_bytes[12..32].copy_from_slice(recipient.as_bytes());
    calldata.extend_from_slice(&recipient_bytes);

    // Amount as uint256
    let mut amount_bytes = [0u8; 32];
    amount.to_big_endian(&mut amount_bytes);
    calldata.extend_from_slice(&amount_bytes);

    calldata
}

/// Build calldata for USDC.transfer(address,uint256) with decimal conversion
///
/// Takes 18-decimal internal amount, converts to 6-decimal USDC for transfer.
/// Use this for Arbitrum USDC transfers where real USDC has 6 decimals.
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
// Story 7.5: Bridge L3→Arb Hash Builder
// ============================================================================

/// Build message hash for bridge L3→Arb consensus
///
/// Layout (variable size):
/// - l3_chain_id: 32 bytes
/// - cycle_number: 32 bytes
/// - order_count: 32 bytes
/// - order_ids: 32 bytes each
/// - total_amount: 32 bytes
/// - destination: 32 bytes (address padded)
///
/// Story 7.5: Bridge USDC L3 to Arbitrum
pub fn build_bridge_l3_to_arb_hash(
    l3_chain_id: u64,
    cycle_number: u64,
    order_ids: &[U256],
    total_amount: U256,
    destination: Address,
) -> H256 {
    let mut data = Vec::with_capacity(160 + order_ids.len() * 32);

    // l3_chain_id as uint256
    let mut chain_id_bytes = [0u8; 32];
    U256::from(l3_chain_id).to_big_endian(&mut chain_id_bytes);
    data.extend_from_slice(&chain_id_bytes);

    // cycle_number as uint256
    let mut cycle_bytes = [0u8; 32];
    U256::from(cycle_number).to_big_endian(&mut cycle_bytes);
    data.extend_from_slice(&cycle_bytes);

    // order_count as uint256
    let mut count_bytes = [0u8; 32];
    U256::from(order_ids.len()).to_big_endian(&mut count_bytes);
    data.extend_from_slice(&count_bytes);

    // order_ids
    for order_id in order_ids {
        let mut order_bytes = [0u8; 32];
        order_id.to_big_endian(&mut order_bytes);
        data.extend_from_slice(&order_bytes);
    }

    // total_amount as uint256
    let mut amount_bytes = [0u8; 32];
    total_amount.to_big_endian(&mut amount_bytes);
    data.extend_from_slice(&amount_bytes);

    // destination as address (padded to 32 bytes)
    let mut dest_bytes = [0u8; 32];
    dest_bytes[12..32].copy_from_slice(destination.as_bytes());
    data.extend_from_slice(&dest_bytes);

    H256::from_slice(&ethers::utils::keccak256(&data))
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
    let mut encoded = Vec::new();

    // chain_id as uint256 (32 bytes)
    let mut chain_id_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_id_bytes);
    encoded.extend_from_slice(&chain_id_bytes);

    // custody_address as address (32 bytes, left-padded)
    let mut custody_bytes = [0u8; 32];
    custody_bytes[12..32].copy_from_slice(custody_address.as_bytes());
    encoded.extend_from_slice(&custody_bytes);

    // target as address (32 bytes, left-padded)
    let mut target_bytes = [0u8; 32];
    target_bytes[12..32].copy_from_slice(target.as_bytes());
    encoded.extend_from_slice(&target_bytes);

    // data as bytes (ABI encoded: offset, then length + padded data)
    // offset points to position 160 (5 * 32 bytes: chainid, custody, target, data_offset, nonce)
    let mut offset_bytes = [0u8; 32];
    U256::from(160).to_big_endian(&mut offset_bytes);
    encoded.extend_from_slice(&offset_bytes);

    // nonce as uint256 (32 bytes)
    let mut nonce_bytes = [0u8; 32];
    nonce.to_big_endian(&mut nonce_bytes);
    encoded.extend_from_slice(&nonce_bytes);

    // data length (32 bytes)
    let mut data_len_bytes = [0u8; 32];
    U256::from(data.len()).to_big_endian(&mut data_len_bytes);
    encoded.extend_from_slice(&data_len_bytes);

    // data content (padded to 32-byte boundary)
    encoded.extend_from_slice(data);
    let padding = (32 - (data.len() % 32)) % 32;
    encoded.extend(vec![0u8; padding]);

    H256::from_slice(&ethers::utils::keccak256(&encoded))
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
#[derive(Debug, Clone)]
pub struct RebalanceBatchResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

/// Result of update weights consensus
#[derive(Debug, Clone)]
pub struct UpdateWeightsResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

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
    let mut data = Vec::with_capacity(128 + itp_ids.len() * 32);

    // chain_id as uint256
    let mut buf = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut buf);
    data.extend_from_slice(&buf);

    // index_address (padded to 32 bytes)
    let mut addr_bytes = [0u8; 32];
    addr_bytes[12..32].copy_from_slice(index_address.as_bytes());
    data.extend_from_slice(&addr_bytes);

    // "rebalance" as bytes32 (left-padded with keccak256)
    let rebalance_hash = ethers::utils::keccak256(b"rebalance");
    data.extend_from_slice(&rebalance_hash);

    // cycleNumber as uint256
    U256::from(cycle_number).to_big_endian(&mut buf);
    data.extend_from_slice(&buf);

    // itpIds
    for itp_id in itp_ids {
        data.extend_from_slice(itp_id.as_bytes());
    }

    H256::from_slice(&ethers::utils::keccak256(&data))
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

    // cycleNumber as uint256
    let mut buf = [0u8; 32];
    U256::from(cycle_number).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // Offset to itpIds array (5 * 32 = 160 from start of params)
    U256::from(160).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // Offset to blsSignature bytes (160 + 32 + itpIds.len() * 32)
    let sig_offset = 160 + 32 + itp_ids.len() * 32;
    U256::from(sig_offset).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // referenceNonce as uint256
    U256::from(reference_nonce).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // signersBitmask as uint256
    signers_bitmask.to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // itpIds array: length + elements
    U256::from(itp_ids.len()).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);
    for itp_id in itp_ids {
        calldata.extend_from_slice(itp_id.as_bytes());
    }

    // blsSignature bytes: length + data (padded to 32)
    U256::from(bls_signature.len()).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);
    calldata.extend_from_slice(bls_signature);
    let padding = (32 - (bls_signature.len() % 32)) % 32;
    calldata.extend(vec![0u8; padding]);

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
    let mut data = Vec::with_capacity(128 + (new_weights.len() + new_inventory.len()) * 32);

    // chain_id as uint256
    let mut buf = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut buf);
    data.extend_from_slice(&buf);

    // index_address (padded to 32 bytes)
    let mut addr_bytes = [0u8; 32];
    addr_bytes[12..32].copy_from_slice(index_address.as_bytes());
    data.extend_from_slice(&addr_bytes);

    // "updateWeights" as bytes32 (left-padded with keccak256)
    let update_weights_hash = ethers::utils::keccak256(b"updateWeights");
    data.extend_from_slice(&update_weights_hash);

    // itpId
    data.extend_from_slice(itp_id.as_bytes());

    // newWeights
    for w in new_weights {
        w.to_big_endian(&mut buf);
        data.extend_from_slice(&buf);
    }

    // newInventory
    for q in new_inventory {
        q.to_big_endian(&mut buf);
        data.extend_from_slice(&buf);
    }

    // nav
    nav.to_big_endian(&mut buf);
    data.extend_from_slice(&buf);

    H256::from_slice(&ethers::utils::keccak256(&data))
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

    // itpId (bytes32) — static param at offset 0
    calldata.extend_from_slice(itp_id.as_bytes());

    let mut buf = [0u8; 32];

    // Offset to newWeights array (7 * 32 = 224 from start of params)
    // Params: itpId(0), newWeightsOffset(1), newInventoryOffset(2), nav(3), blsSigOffset(4), refNonce(5), bitmask(6)
    U256::from(224).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // Offset to newInventory array (224 + 32 + newWeights.len() * 32)
    let inv_offset = 224 + 32 + new_weights.len() * 32;
    U256::from(inv_offset).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // nav (uint256) — static param
    nav.to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // Offset to blsSignature bytes (inv_offset + 32 + newInventory.len() * 32)
    let sig_offset = inv_offset + 32 + new_inventory.len() * 32;
    U256::from(sig_offset).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // referenceNonce as uint256
    U256::from(reference_nonce).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // signersBitmask as uint256
    signers_bitmask.to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // newWeights array: length + elements
    U256::from(new_weights.len()).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);
    for w in new_weights {
        w.to_big_endian(&mut buf);
        calldata.extend_from_slice(&buf);
    }

    // newInventory array: length + elements
    U256::from(new_inventory.len()).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);
    for q in new_inventory {
        q.to_big_endian(&mut buf);
        calldata.extend_from_slice(&buf);
    }

    // blsSignature bytes: length + data (padded to 32)
    U256::from(bls_signature.len()).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);
    calldata.extend_from_slice(bls_signature);
    let padding = (32 - (bls_signature.len() % 32)) % 32;
    calldata.extend(vec![0u8; padding]);

    calldata
}

/// Result of successful single-phase rebalance execution
#[derive(Debug, Clone)]
pub struct RebalanceResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

/// Result of successful setItpNav BLS consensus
#[derive(Debug, Clone)]
pub struct SetItpNavResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers
    pub signer_bitmap: U256,
    /// Number of signatures collected
    pub signature_count: usize,
}

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

    // itpId (bytes32)
    calldata.extend_from_slice(itp_id.as_bytes());

    let mut buf = [0u8; 32];

    // nav (uint256)
    nav.to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // Offset to blsSignature bytes (5 * 32 = 160 from start of params)
    U256::from(160).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // referenceNonce (uint256)
    U256::from(reference_nonce).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // signersBitmask (uint256)
    signers_bitmask.to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // blsSignature bytes: length + data (padded to 32)
    U256::from(bls_signature.len()).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);
    calldata.extend_from_slice(bls_signature);
    let padding = (32 - (bls_signature.len() % 32)) % 32;
    calldata.extend(vec![0u8; padding]);

    calldata
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
#[derive(Debug, Clone)]
pub struct AssetTradesResult {
    /// Aggregated BLS signature
    pub aggregated_signature: BLSSignature,
    /// Bitmap of signers
    pub signer_bitmap: U256,
    /// Total signatures collected
    pub signature_count: usize,
}

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
    let mut buf = [0u8; 32];

    // Head layout (5 words):
    //   [0] cycleNumber (static uint256)
    //   [1] offset to trades array
    //   [2] offset to blsSignature bytes
    //   [3] referenceNonce (static uint256)
    //   [4] signersBitmask (static uint256)

    // cycleNumber (uint256)
    U256::from(cycle_number).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // offset to trades[] (5 * 32 = 160 from start of params)
    U256::from(160).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // offset to blsSignature — calculated after encoding trades
    // trades start at offset 160, length: 32 (array_len) + trades.len() * 5 * 32
    let trades_encoding_len = 32 + trades.len() * 5 * 32;
    U256::from(160 + trades_encoding_len).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // referenceNonce as uint256
    U256::from(reference_nonce).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // signersBitmask as uint256
    signers_bitmask.to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // Encode trades array
    // Array length
    U256::from(trades.len()).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);

    // Each trade: (address, uint8, uint256, uint256, address)
    for trade in trades {
        // asset (address, left-padded to 32 bytes)
        let mut asset_buf = [0u8; 32];
        asset_buf[12..32].copy_from_slice(trade.asset.as_bytes());
        calldata.extend_from_slice(&asset_buf);

        // side (uint8, padded to 32 bytes)
        let mut side_buf = [0u8; 32];
        side_buf[31] = trade.side;
        calldata.extend_from_slice(&side_buf);

        // usdcAmount (uint256)
        trade.usdc_amount.to_big_endian(&mut buf);
        calldata.extend_from_slice(&buf);

        // price (uint256)
        trade.price.to_big_endian(&mut buf);
        calldata.extend_from_slice(&buf);

        // quoteToken (address, left-padded to 32 bytes)
        let mut qt_buf = [0u8; 32];
        qt_buf[12..32].copy_from_slice(trade.quote_token.as_bytes());
        calldata.extend_from_slice(&qt_buf);
    }

    // Encode blsSignature bytes
    U256::from(bls_signature.len()).to_big_endian(&mut buf);
    calldata.extend_from_slice(&buf);
    calldata.extend_from_slice(bls_signature);
    let padding = (32 - (bls_signature.len() % 32)) % 32;
    calldata.extend(vec![0u8; padding]);

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
        assert_eq!(config.arbitrum_chain_id, 42161);
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
        let hash1 = build_bridge_arb_to_l3_hash(
            42161,
            U256::from(123),
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(1700000000u64),
        );

        let hash2 = build_bridge_arb_to_l3_hash(
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
        let hash1 = build_bridge_arb_to_l3_hash(
            42161,
            U256::from(1),
            H256::from([0xAB; 32]),
            Address::from([0xCD; 20]),
            U256::from(1000000000000000000u64),
            U256::from(1700000000u64),
        );

        let hash2 = build_bridge_arb_to_l3_hash(
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
        let hash = build_bridge_arb_to_l3_hash(
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
        let err = BridgeError::InsufficientSignatures { got: 1, need: 2 };
        assert_eq!(
            err.to_string(),
            "insufficient signatures: got 1, need 2"
        );

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
            U256::from(2), // Different arb_order_id
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
        // 32 (chain_id) + 32 (arb_order_id) + 32 (itp_id) + 20 (user) +
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
            arb_order_id: U256::from(123),
            l3_order_id: U256::from(456),
            original_user: Address::from([0xAB; 20]),
            created_at: 1700000000,
        };

        // Test serde serialization roundtrip
        let serialized = serde_json::to_string(&mapping).expect("Serialization failed");
        let deserialized: OrderMapping = serde_json::from_str(&serialized).expect("Deserialization failed");

        assert_eq!(mapping.arb_order_id, deserialized.arb_order_id);
        assert_eq!(mapping.l3_order_id, deserialized.l3_order_id);
        assert_eq!(mapping.original_user, deserialized.original_user);
        assert_eq!(mapping.created_at, deserialized.created_at);
    }

    #[test]
    fn test_submit_order_proposal_struct() {
        let proposal = SubmitOrderProposal {
            leader_id: [0x11; 32],
            arb_order_id: U256::from(123),
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
        assert_eq!(proposal.arb_order_id, U256::from(123));
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
            arb_order_id: U256::from(42),
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
            arb_order_id: U256::from(1),
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
    // Story 7.5: Bridge L3→Arb Type and Hash Tests
    // ========================================================================

    #[test]
    fn test_build_bridge_l3_to_arb_hash_deterministic() {
        let hash1 = build_bridge_l3_to_arb_hash(
            111222333, // L3 chain ID
            42,
            &[U256::from(1), U256::from(2), U256::from(3)],
            U256::from(3000000000000000000u64), // 3 USDC
            Address::from([0xAB; 20]),
        );

        let hash2 = build_bridge_l3_to_arb_hash(
            111222333,
            42,
            &[U256::from(1), U256::from(2), U256::from(3)],
            U256::from(3000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_build_bridge_l3_to_arb_hash_different_cycles() {
        let hash1 = build_bridge_l3_to_arb_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        let hash2 = build_bridge_l3_to_arb_hash(
            111222333,
            2, // Different cycle
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_bridge_l3_to_arb_hash_different_orders() {
        let hash1 = build_bridge_l3_to_arb_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        let hash2 = build_bridge_l3_to_arb_hash(
            111222333,
            1,
            &[U256::from(2)], // Different order
            U256::from(1000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_bridge_l3_to_arb_hash_empty() {
        let hash = build_bridge_l3_to_arb_hash(
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
    fn test_build_bridge_l3_to_arb_hash_different_amounts() {
        let hash1 = build_bridge_l3_to_arb_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64), // 1 USDC
            Address::from([0xAB; 20]),
        );

        let hash2 = build_bridge_l3_to_arb_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(2000000000000000000u64), // 2 USDC - different
            Address::from([0xAB; 20]),
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_build_bridge_l3_to_arb_hash_different_destinations() {
        let hash1 = build_bridge_l3_to_arb_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            Address::from([0xAB; 20]),
        );

        let hash2 = build_bridge_l3_to_arb_hash(
            111222333,
            1,
            &[U256::from(1)],
            U256::from(1000000000000000000u64),
            Address::from([0xCD; 20]), // Different destination
        );

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_bridge_l3_to_arb_proposal_struct() {
        let proposal = BridgeL3ToArbProposal {
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
    fn test_bridge_l3_to_arb_result_struct() {
        let result = BridgeL3ToArbResult {
            aggregated_signature: BLSSignature(vec![0xFF; 96]),
            signer_bitmap: U256::from(7), // bits 0, 1, 2 set
            signature_count: 3,
        };

        assert_eq!(result.signature_count, 3);
        assert_eq!(result.signer_bitmap, U256::from(7));
    }

    #[test]
    fn test_bridge_order_status_bridged_back_to_arb() {
        assert_eq!(
            format!("{:?}", BridgeOrderStatus::BridgedBackToArb),
            "BridgedBackToArb"
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

        let err = BridgeError::BridgeL3ToArbAlreadyProcessed { cycle_number: 99 };
        assert!(err.to_string().contains("99"));

        let err = BridgeError::AmountMismatch {
            expected: U256::from(1000),
            actual: U256::from(500),
        };
        assert!(err.to_string().contains("1000"));
        assert!(err.to_string().contains("500"));

        let err = BridgeError::BridgeL3ToArbFailed {
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
            42161, // Arbitrum chain ID
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
}
