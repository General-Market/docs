//! P2P types for Index L3

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};

/// Peer identifier (could be public key hash or similar)
pub type PeerId = [u8; 32];

/// Information about a peer for connection
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeerInfo {
    /// Unique peer identifier
    pub peer_id: PeerId,
    /// IP address
    pub ip: String,
    /// Port number
    pub port: u16,
}

/// BLS signature type (for BN254 curve)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BLSSignature(pub Vec<u8>);

/// BLS public key type (for BN254 curve)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BLSPublicKey(pub Vec<u8>);

/// P2P message types per architecture Section 4
/// All messages are serialized with MessagePack
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum P2PMessage {
    /// Leader signals start of a new cycle
    /// Timeout: N/A, Retry: N/A
    CycleStart {
        cycle_number: u64,
        leader_id: PeerId,
    },

    /// Leader proposes price set for the cycle
    /// Timeout: 200ms, Retry: 1
    PriceProposal {
        cycle_number: u64,
        prices: Vec<(u32, U256)>, // (asset_index, price)
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        proposer_signature: BLSSignature,
    },

    /// Node votes on price proposal
    /// Timeout: 300ms, Retry: 0
    PriceVote {
        cycle_number: u64,
        voter_id: PeerId,
        approved: bool,
        signature: BLSSignature,
    },

    /// Leader proposes batch of orders to fill
    /// Timeout: 200ms, Retry: 1
    BatchProposal {
        cycle_number: u64,
        order_ids: Vec<u64>,
        fills: Vec<crate::Fill>,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        proposer_signature: BLSSignature,
    },

    /// Node signs batch proposal
    /// Timeout: 300ms, Retry: 0
    BatchSign {
        cycle_number: u64,
        signer_id: PeerId,
        signature: BLSSignature,
    },

    /// Periodic liveness signal
    /// Timeout: 1000ms, Retry: N/A
    Heartbeat {
        sender_id: PeerId,
        timestamp: u64,
    },

    /// Vote to kick a misbehaving node
    /// Timeout: 500ms, Retry: 0
    KickVote {
        target_id: PeerId,
        voter_id: PeerId,
        reason: String,
        signature: BLSSignature,
    },

    /// Leader proposes ITP creation (atomic: BridgeProxy creates ITP on L3)
    /// Timeout: 500ms, Retry: 1
    /// Story 6.21: Cross-chain ITP creation via BLS consensus
    ItpCreationProposal {
        /// Leader's peer ID (for P2P routing and connection identification)
        leader_id: PeerId,
        /// Original requester on Arbitrum
        admin: Address,
        /// Request nonce from BridgeProxy
        nonce: U256,
        /// ITP name
        name: String,
        /// ITP symbol
        symbol: String,
        /// Asset weights (sum to 1e18)
        weights: Vec<U256>,
        /// Asset addresses
        assets: Vec<Address>,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's signature (included in aggregation)
        leader_signature: BLSSignature,
    },

    /// Follower signs ITP creation proposal
    /// Timeout: 300ms, Retry: 0
    /// Story 6.21: Cross-chain ITP creation via BLS consensus
    ItpCreationSign {
        /// Signer's peer ID (for connection identification and bitmap calculation)
        signer_id: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        /// Request nonce (identifies which proposal)
        nonce: U256,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes rebalance request (from BridgeProxy on Arbitrum)
    /// Timeout: 500ms, Retry: 1
    /// Cross-chain rebalance via BLS consensus
    RebalanceRequestProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Deployer who requested rebalance on Arbitrum
        deployer: Address,
        /// L3 ITP identifier
        itp_id: H256,
        /// Request nonce from BridgeProxy
        nonce: U256,
        /// New target weights (sum to 1e18)
        new_weights: Vec<U256>,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature (included in aggregation)
        leader_signature: BLSSignature,
    },

    /// Follower signs rebalance request proposal
    /// Timeout: 300ms, Retry: 0
    /// Cross-chain rebalance via BLS consensus
    RebalanceRequestSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        /// Request nonce (identifies which proposal)
        nonce: U256,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes bridging USDC from Arbitrum to L3
    /// Timeout: 500ms, Retry: 1
    /// Story 7.2: Bridge Arb→L3 orchestration
    BridgeSettlementToL3Proposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// CrossChainOrder ID from SettlementBridgeCustody
        order_id: U256,
        /// ITP being purchased
        itp_id: H256,
        /// User who initiated the order on Arbitrum
        user: Address,
        /// USDC amount to bridge (18 decimals per TypesLib)
        amount: U256,
        /// Order deadline (must not be passed)
        deadline: U256,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the bridge message
        leader_signature: BLSSignature,
    },

    /// Follower signs bridge proposal
    /// Timeout: 300ms, Retry: 0
    /// Story 7.2: Bridge Arb→L3 orchestration
    BridgeSettlementToL3Sign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in oracle set (for bitmap)
        signer_index: u8,
        /// Order ID being signed (identifies proposal)
        order_id: U256,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes submitting order on L3 Index on behalf of Settlement chain user
    /// Timeout: 500ms, Retry: 1
    /// Story 7.3: Submit Order for User
    SubmitOrderForUserProposal {
        /// Leader's peer ID (for P2P routing and connection identification)
        leader_id: PeerId,
        /// Original Settlement order ID (from CrossChainOrderCreated)
        settlement_order_id: U256,
        /// ITP being purchased
        itp_id: H256,
        /// Original Settlement chain user (for share distribution later)
        user: Address,
        /// USDC amount (18 decimals per TypesLib)
        amount: U256,
        /// Limit price (18 decimals)
        limit_price: U256,
        /// Slippage tier (0, 1, or 2)
        slippage_tier: U256,
        /// Order deadline
        deadline: U256,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the message
        leader_signature: BLSSignature,
    },

    /// Follower signs submit order proposal
    /// Timeout: 300ms, Retry: 0
    /// Story 7.3: Submit Order for User
    SubmitOrderForUserSign {
        /// Signer's peer ID (for connection identification and bitmap calculation)
        signer_id: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        /// Settlement order ID (identifies which proposal this signature is for)
        settlement_order_id: U256,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes batch confirmation for a cycle
    /// Timeout: 500ms, Retry: 1
    /// Story 7.4: Batch and Fill Orchestration
    ConfirmBatchProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Cycle number for this batch
        cycle_number: u64,
        /// Order IDs included in batch
        order_ids: Vec<U256>,
        /// Current prices for each order's ITP (18 decimals)
        prices: Vec<U256>,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the batch hash
        leader_signature: BLSSignature,
    },

    /// Follower signs batch confirmation proposal
    /// Timeout: 300ms, Retry: 0
    /// Story 7.4: Batch and Fill Orchestration
    ConfirmBatchSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in oracle set (for bitmap)
        signer_index: u8,
        /// Cycle number (identifies which proposal)
        cycle_number: u64,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes fills confirmation for a cycle
    /// Timeout: 500ms, Retry: 1
    /// Story 7.4: Batch and Fill Orchestration
    ConfirmFillsProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Cycle number for these fills
        cycle_number: u64,
        /// Fill details for each order
        fills: Vec<OrderFill>,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the fills hash
        leader_signature: BLSSignature,
    },

    /// Follower signs fills confirmation proposal
    /// Timeout: 300ms, Retry: 0
    /// Story 7.4: Batch and Fill Orchestration
    ConfirmFillsSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in oracle set (for bitmap)
        signer_index: u8,
        /// Cycle number (identifies which proposal)
        cycle_number: u64,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes bridging USDC from L3 back to Settlement
    /// Timeout: 500ms, Retry: 1
    /// Story 7.5: Bridge USDC L3 to Settlement
    BridgeL3ToSettlementProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Cycle number that batched these orders
        cycle_number: u64,
        /// Order IDs being bridged back
        order_ids: Vec<U256>,
        /// Total USDC amount to bridge (18 decimals)
        total_amount: U256,
        /// Destination: OracleCustody on Settlement
        destination: Address,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the bridge hash
        leader_signature: BLSSignature,
    },

    /// Follower signs bridge L3→Settlement proposal
    /// Timeout: 300ms, Retry: 0
    /// Story 7.5: Bridge USDC L3 to Settlement
    BridgeL3ToSettlementSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in oracle set (for bitmap)
        signer_index: u8,
        /// Cycle number (identifies proposal)
        cycle_number: u64,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes custody release to MockBitgetVault
    /// Timeout: 500ms, Retry: 1
    /// Story 7.6: Custody Release to MockBitgetVault
    ReleaseToVaultProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Cycle number that processed these orders
        cycle_number: u64,
        /// Order IDs being released
        order_ids: Vec<U256>,
        /// Total USDC amount to release (18 decimals)
        total_amount: U256,
        /// Destination: MockBitgetVault on Arbitrum
        vault_address: Address,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the release hash
        leader_signature: BLSSignature,
    },

    /// Follower signs custody release proposal
    /// Timeout: 300ms, Retry: 0
    /// Story 7.6: Custody Release to MockBitgetVault
    ReleaseToVaultSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in oracle set (for bitmap)
        signer_index: u8,
        /// Cycle number (identifies proposal)
        cycle_number: u64,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes confirming a rebalance batch
    /// Timeout: 500ms, Retry: 1
    /// Story 7-14: Rebalance consensus
    RebalanceBatchProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Cycle number for this rebalance batch
        cycle_number: u64,
        /// ITP IDs included in this rebalance batch
        itp_ids: Vec<H256>,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the rebalance batch hash
        leader_signature: BLSSignature,
    },

    /// Follower signs rebalance batch proposal
    /// Timeout: 300ms, Retry: 0
    /// Story 7-14: Rebalance consensus
    RebalanceBatchSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in oracle set (for bitmap)
        signer_index: u8,
        /// Cycle number (identifies proposal)
        cycle_number: u64,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes updating weights for an ITP after rebalance
    /// Timeout: 500ms, Retry: 1
    /// Story 7-14: Rebalance consensus
    UpdateWeightsProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// ITP to update
        itp_id: H256,
        /// New weights to apply
        new_weights: Vec<U256>,
        /// New inventory quantities (per-share) after rebalance
        new_inventory: Vec<U256>,
        /// NAV at time of rebalance (18 decimals)
        nav: U256,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the update weights hash
        leader_signature: BLSSignature,
    },

    /// Follower signs update weights proposal
    /// Timeout: 300ms, Retry: 0
    /// Story 7-14: Rebalance consensus
    UpdateWeightsSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in oracle set (for bitmap)
        signer_index: u8,
        /// ITP identifier (identifies proposal)
        itp_id: H256,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes single-phase rebalance via Index.rebalance()
    /// Timeout: 500ms, Retry: 1
    /// Single-phase rebalance consensus
    RebalanceProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// ITP to rebalance
        itp_id: H256,
        /// Indices of assets to remove (sorted descending)
        remove_indices: Vec<U256>,
        /// New asset addresses to add
        add_assets: Vec<Address>,
        /// New weights for the final asset list
        new_weights: Vec<U256>,
        /// Prices for the final asset list
        prices: Vec<U256>,
        /// Per-asset quote token for settlement (address(0) = USDC)
        quote_tokens: Vec<Address>,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the rebalance hash
        leader_signature: BLSSignature,
    },

    /// Follower signs single-phase rebalance proposal
    /// Timeout: 300ms, Retry: 0
    /// Single-phase rebalance consensus
    RebalanceSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in oracle set (for bitmap)
        signer_index: u8,
        /// ITP identifier (identifies proposal)
        itp_id: H256,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes submitting sell order on L3
    /// Timeout: 500ms, Retry: 1
    /// Cross-chain sell flow
    SubmitSellOrderProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Arb sell order ID
        order_id: U256,
        /// ITP being sold
        itp_id: H256,
        /// User who initiated the sell
        user: Address,
        /// Bridged ITP token address on Arbitrum
        bridged_itp_address: Address,
        /// ITP amount to sell (18 decimals)
        amount: U256,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature
        leader_signature: BLSSignature,
    },

    /// Follower signs submit sell order proposal
    /// Timeout: 300ms, Retry: 0
    /// Cross-chain sell flow
    SubmitSellOrderSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in the oracle set (for bitmap)
        signer_index: u8,
        /// Arb sell order ID (identifies proposal)
        order_id: U256,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes completing sell on Arbitrum
    /// Timeout: 500ms, Retry: 1
    /// Cross-chain sell flow
    CompleteSellOrderProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Arb sell order ID
        order_id: U256,
        /// USDC proceeds to return to user
        usdc_proceeds: U256,
        /// Vault address to pull USDC from (for atomic fund+complete)
        vault: Address,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature
        leader_signature: BLSSignature,
    },

    /// Follower signs complete sell order proposal
    /// Timeout: 300ms, Retry: 0
    /// Cross-chain sell flow
    CompleteSellOrderSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in the oracle set (for bitmap)
        signer_index: u8,
        /// Arb sell order ID (identifies proposal)
        order_id: U256,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Burn sell order proposal (burn BridgedITP before L3 sell)
    /// Timeout: 500ms, Retry: 1
    /// Cross-chain sell flow
    BurnSellOrderProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Arb sell order ID
        order_id: U256,
        /// Leader's BLS signature
        leader_signature: BLSSignature,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
    },

    /// Burn sell order follower signature
    /// Timeout: 300ms, Retry: 0
    /// Cross-chain sell flow
    BurnSellOrderSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in the oracle set (for bitmap)
        signer_index: u8,
        /// Arb sell order ID (identifies proposal)
        order_id: U256,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    /// Leader proposes emitting per-asset trades after cross-ITP netting
    /// Timeout: 500ms, Retry: 1
    /// Oracle-driven per-asset settlement
    AssetTradesProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Cycle number for these trades
        cycle_number: u64,
        /// Per-asset trade data: (asset_address, side, usdc_amount, price, quoteToken)
        /// Serialized as Vec of (Address, u8, U256, U256, Address) tuples
        trades_data: Vec<(Address, u8, U256, U256, Address)>,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the asset trades hash
        leader_signature: BLSSignature,
    },

    /// Follower signs asset trades proposal
    /// Timeout: 300ms, Retry: 0
    /// Oracle-driven per-asset settlement
    AssetTradesSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in oracle set (for bitmap)
        signer_index: u8,
        /// Cycle number (identifies proposal)
        cycle_number: u64,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    // 8-step bridge: RecordCollateralMove consensus
    RecordCollateralMoveProposal {
        leader_id: PeerId,
        cycle_number: u64,
        itp_id: H256,
        from_chain: U256,
        to_chain: U256,
        amount: U256,
        tx_type: u8,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        leader_signature: BLSSignature,
    },
    RecordCollateralMoveSign {
        signer_id: PeerId,
        signer_index: u8,
        cycle_number: u64,
        signature: BLSSignature,
    },
    // 8-step bridge: MintBridgedShares consensus
    MintBridgedSharesProposal {
        leader_id: PeerId,
        cycle_number: u64,
        itp_id: H256,
        user: Address,
        amount: U256,
        /// Settlement order ID for replay protection
        order_id: U256,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        leader_signature: BLSSignature,
    },
    MintBridgedSharesSign {
        signer_id: PeerId,
        signer_index: u8,
        cycle_number: u64,
        signature: BLSSignature,
    },
    // completeBuyOrder BLS consensus
    CompleteBuyOrderProposal {
        leader_id: PeerId,
        cycle_number: u64,
        order_id: U256,
        vault: Address,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        leader_signature: BLSSignature,
    },
    CompleteBuyOrderSign {
        signer_id: PeerId,
        signer_index: u8,
        cycle_number: u64,
        signature: BLSSignature,
    },

    /// Leader proposes one bundle of completeBuyOrders signed by one
    /// aggregated BLS signature. Followers verify the cycle's order list
    /// matches their local state and sign the bundle hash.
    CompleteBuyOrdersBundleProposal {
        leader_id: PeerId,
        cycle_number: u64,
        order_ids: Vec<U256>,
        vault: Address,
        reference_nonce: u64,
        leader_signature: BLSSignature,
    },

    /// Follower signature for a CompleteBuyOrdersBundleProposal.
    CompleteBuyOrdersBundleSign {
        signer_id: PeerId,
        signer_index: u8,
        cycle_number: u64,
        signature: BLSSignature,
    },

    /// Leader proposes one bundle of `mintBridgedShares` covered by a single
    /// aggregated BLS signature. Followers verify the per-fill data matches
    /// their local cycle state and sign the bundle hash.
    MintBridgedSharesBundleProposal {
        leader_id: PeerId,
        cycle_number: u64,
        itp_ids: Vec<H256>,
        users: Vec<Address>,
        amounts: Vec<U256>,
        order_ids: Vec<U256>,
        reference_nonce: u64,
        leader_signature: BLSSignature,
    },

    /// Follower signature for a MintBridgedSharesBundleProposal.
    MintBridgedSharesBundleSign {
        signer_id: PeerId,
        signer_index: u8,
        cycle_number: u64,
        signature: BLSSignature,
    },

    /// Leader proposes setItpNav before rebalance
    /// Timeout: 500ms, Retry: 1
    /// Rebalance NAV consensus
    SetItpNavProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// ITP to set NAV for
        itp_id: H256,
        /// Computed NAV value (18 decimals)
        nav: U256,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the setItpNav hash
        leader_signature: BLSSignature,
    },

    /// Follower signs setItpNav proposal
    /// Timeout: 300ms, Retry: 0
    /// Rebalance NAV consensus
    SetItpNavSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in oracle set (for bitmap)
        signer_index: u8,
        /// ITP identifier (identifies proposal)
        itp_id: H256,
        /// Follower's BLS signature
        signature: BLSSignature,
    },

    // ==================== Arbitration Consensus ====================

    /// Leader proposes exit prices for arbitration resolution
    /// Timeout: 500ms, Retry: 1
    ArbitrationPriceProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Bet ID from CollateralVault
        bet_id: U256,
        /// Exit prices per trade: (trade_index, symbol, exit_price_cents)
        prices: Vec<(u32, String, i64)>,
        /// Timestamp of price fetch
        timestamp: u64,
        /// Registry snapshot nonce for historical BLS verification
        reference_nonce: u64,
        /// Leader's BLS signature on the proposal hash
        leader_signature: BLSSignature,
    },

    /// Follower votes on arbitration price proposal
    /// Timeout: 300ms, Retry: 0
    ArbitrationPriceVote {
        /// Voter's peer ID
        voter_id: PeerId,
        /// Voter's index in oracle set (for bitmap)
        voter_index: u8,
        /// Bet ID (identifies proposal)
        bet_id: U256,
        /// Accept or reject
        accept: bool,
        /// Voter's BLS signature
        signature: BLSSignature,
    },

    /// Follower signs arbitration resolution outcome
    /// Timeout: 300ms, Retry: 0
    ArbitrationResolutionSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in oracle set (for bitmap)
        signer_index: u8,
        /// Bet ID (identifies proposal)
        bet_id: U256,
        /// keccak256(abi.encode(betId, creatorWins))
        outcome_hash: H256,
        /// Signer's BLS signature on outcome_hash
        signature: BLSSignature,
    },

    /// Leader proposes NAV oracle price update (Arb ITPNAVOracle)
    NavOracleProposal {
        leader_id: PeerId,
        itp_address: Address,
        oracle_address: Address,
        nav_price: U256,           // Morpho-scaled price (36 decimals)
        timestamp: u64,
        cycle_number: u64,
        chain_id: u64,             // Arb chain ID
        reference_nonce: u64,      // Registry snapshot nonce
        leader_signature: BLSSignature,
    },

    /// Follower signs NAV oracle price update
    NavOracleSign {
        signer_id: PeerId,
        signer_index: u8,
        itp_address: Address,
        signature: BLSSignature,
    },

    /// Leader proposes batch configs for all sources (composite hash).
    /// Carries round number for leader rotation, NOT cycle_number.
    /// Part of the batch config bridge orchestrator (independent from settlement cycle).
    BatchConfigProposal {
        round: u64,
        /// Per-source configs proposed by leader
        configs: Vec<ProposedBatchConfig>,
        /// Composite hash: keccak256(concat(sorted config hashes))
        composite_hash: H256,
    },

    /// Follower co-signs the composite batch config hash (or rejects).
    /// Part of the batch config bridge orchestrator (independent from settlement cycle).
    BatchConfigSign {
        round: u64,
        composite_hash: H256,
        /// BLS signature over the composite hash (empty if rejecting)
        bls_signature: Vec<u8>,
        accepted: bool,
        reject_reason: Option<String>,
    },

    // ==================== MirrorOracleRegistry Sync (Step 12) ====================

    /// Leader proposes MirrorOracleRegistry sync
    MirrorSyncProposal {
        leader_id: PeerId,
        nonce: u64,
        oracle_pubkeys: Vec<Vec<u8>>,
        oracle_ids: Vec<u64>,
        active_bitmask: U256,
        active_count: u64,
        threshold: u64,
        chain_id: u64,
        mirror_address: Address,
        reference_nonce: u64,
        leader_signature: BLSSignature,
    },

    /// Follower signs MirrorOracleRegistry sync
    MirrorSyncSign {
        signer_id: PeerId,
        signer_index: u8,
        nonce: u64,
        signature: BLSSignature,
    },

    // Vision consensus: createBatch on L3
    // Leader proposes a new round batch; followers co-sign so the on-chain call
    // meets the 2-of-3 BLS threshold required by BLSVerifier.
    VisionCreateBatchProposal {
        leader_id: PeerId,
        /// Human-readable source name (e.g. "crypto"), for log correlation.
        source_name: String,
        /// keccak256(source_name) — the on-chain sourceId.
        source_id: H256,
        /// keccak256 of the batch configuration JSON.
        config_hash: H256,
        /// Tick duration in seconds.
        tick_duration: u64,
        /// Lock offset in seconds.
        lock_offset: u64,
        /// Settlement grace window in seconds (added 2026-05-08).
        /// Past `(createdAtTick + 1) * tick + grace`, settleBatch reverts and
        /// players can claim refunds.
        settlement_grace: u64,
        /// Pre-computed BLS message hash (followers verify by recomputing).
        message_hash: H256,
        /// Leader's BLS signature over message_hash.
        leader_signature: BLSSignature,
        /// OracleRegistry lastSnapshotNonce used for the BLS call.
        reference_nonce: u64,
    },
    VisionCreateBatchSign {
        signer_id: PeerId,
        signer_index: u8,
        /// Identifies which proposal this co-sign belongs to.
        source_id: H256,
        /// Followers MUST verify message_hash before signing.
        message_hash: H256,
        signature: BLSSignature,
    },

}

/// A proposed batch config for a single source, carried in BatchConfigProposal.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProposedBatchConfig {
    pub source_id: String,
    pub config_hash: H256,
    pub tick_duration_secs: u64,
    pub lock_offset_secs: u64,
    pub markets: Vec<ProposedMarket>,
}

/// A single market within a ProposedBatchConfig.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProposedMarket {
    pub asset_id: String,
    pub resolution_type: String,
    pub threshold_bps: u32,
}

/// Represents a single order fill for consensus
/// Story 7.4: Batch and Fill Orchestration
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OrderFill {
    /// Order ID being filled
    pub order_id: U256,
    /// Price at which order was filled (18 decimals)
    pub fill_price: U256,
    /// Amount filled (in quote asset, typically USDC, 18 decimals)
    pub fill_amount: U256,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test serialization roundtrip for ItpCreationProposal
    #[test]
    fn test_itp_creation_proposal_serialization_roundtrip() {
        let msg = P2PMessage::ItpCreationProposal {
            leader_id: [0x99u8; 32],
            admin: Address::from([0xABu8; 20]),
            nonce: U256::from(42),
            name: "Test ITP".to_string(),
            symbol: "TITP".to_string(),
            weights: vec![U256::from(5000_u64) * U256::from(10u64).pow(U256::from(14)), U256::from(5000_u64) * U256::from(10u64).pow(U256::from(14))],
            assets: vec![
                Address::from([0x11u8; 20]),
                Address::from([0x22u8; 20]),
            ],
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01, 0x02, 0x03]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test serialization roundtrip for ItpCreationSign
    #[test]
    fn test_itp_creation_sign_serialization_roundtrip() {
        let msg = P2PMessage::ItpCreationSign {
            signer_id: [0x88u8; 32],
            signer_index: 2,
            nonce: U256::from(123),
            signature: BLSSignature(vec![0xAA, 0xBB, 0xCC, 0xDD]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test serialization roundtrip for Heartbeat (existing type)
    #[test]
    fn test_heartbeat_serialization_roundtrip() {
        let msg = P2PMessage::Heartbeat {
            sender_id: [0x11u8; 32],
            timestamp: 1234567890,
        };

        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test that different nonces produce different serialization
    #[test]
    fn test_different_nonces_different_serialization() {
        let msg1 = P2PMessage::ItpCreationSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            nonce: U256::from(1),
            signature: BLSSignature(vec![0x01]),
        };

        let msg2 = P2PMessage::ItpCreationSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            nonce: U256::from(2),
            signature: BLSSignature(vec![0x01]),
        };

        let serialized1 = rmp_serde::to_vec(&msg1).expect("Serialization failed");
        let serialized2 = rmp_serde::to_vec(&msg2).expect("Serialization failed");

        assert_ne!(serialized1, serialized2);
    }

    /// Test BLSSignature construction
    #[test]
    fn test_bls_signature_construction() {
        let sig = BLSSignature(vec![0x01, 0x02, 0x03, 0x04]);
        assert_eq!(sig.0.len(), 4);
        assert_eq!(sig.0[0], 0x01);
    }

    /// Test PeerInfo serialization
    #[test]
    fn test_peer_info_serialization() {
        let peer = PeerInfo {
            peer_id: [0xFFu8; 32],
            ip: "192.168.1.1".to_string(),
            port: 8080,
        };

        let serialized = rmp_serde::to_vec(&peer).expect("Serialization failed");
        let deserialized: PeerInfo = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(peer, deserialized);
    }

    /// Test serialization roundtrip for BridgeSettlementToL3Proposal
    /// Story 7.2: Bridge Arb→L3 orchestration
    #[test]
    fn test_bridge_arb_to_l3_proposal_serialization_roundtrip() {
        let msg = P2PMessage::BridgeSettlementToL3Proposal {
            leader_id: [0x99u8; 32],
            order_id: U256::from(123),
            itp_id: H256::from([0xABu8; 32]),
            user: Address::from([0xCDu8; 20]),
            amount: U256::from(1000000000000000000u64), // 1 USDC with 18 decimals
            deadline: U256::from(1700000000u64),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01, 0x02, 0x03, 0x04]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test serialization roundtrip for BridgeSettlementToL3Sign
    /// Story 7.2: Bridge Arb→L3 orchestration
    #[test]
    fn test_bridge_arb_to_l3_sign_serialization_roundtrip() {
        let msg = P2PMessage::BridgeSettlementToL3Sign {
            signer_id: [0x88u8; 32],
            signer_index: 2,
            order_id: U256::from(456),
            signature: BLSSignature(vec![0xAA, 0xBB, 0xCC, 0xDD]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test that different order_ids produce different serialization
    /// Story 7.2: Bridge Arb→L3 orchestration
    #[test]
    fn test_bridge_different_order_ids_different_serialization() {
        let msg1 = P2PMessage::BridgeSettlementToL3Sign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            order_id: U256::from(1),
            signature: BLSSignature(vec![0x01]),
        };

        let msg2 = P2PMessage::BridgeSettlementToL3Sign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            order_id: U256::from(2),
            signature: BLSSignature(vec![0x01]),
        };

        let serialized1 = rmp_serde::to_vec(&msg1).expect("Serialization failed");
        let serialized2 = rmp_serde::to_vec(&msg2).expect("Serialization failed");

        assert_ne!(serialized1, serialized2);
    }

    /// Test BridgeSettlementToL3Proposal with all fields populated
    /// Story 7.2: Bridge Arb→L3 orchestration
    #[test]
    fn test_bridge_proposal_all_fields() {
        let msg = P2PMessage::BridgeSettlementToL3Proposal {
            leader_id: [0x11u8; 32],
            order_id: U256::from(999),
            itp_id: H256::from([0x22u8; 32]),
            user: Address::from([0x33u8; 20]),
            amount: U256::from(5000000000000000000u64), // 5 USDC
            deadline: U256::from(1800000000u64),
            reference_nonce: 42,
            leader_signature: BLSSignature(vec![0xFF; 96]), // 96-byte BLS signature
        };

        // Verify all fields are accessible
        if let P2PMessage::BridgeSettlementToL3Proposal {
            leader_id,
            order_id,
            itp_id,
            user,
            amount,
            deadline,
            reference_nonce,
            leader_signature,
        } = msg.clone()
        {
            assert_eq!(leader_id, [0x11u8; 32]);
            assert_eq!(order_id, U256::from(999));
            assert_eq!(itp_id, H256::from([0x22u8; 32]));
            assert_eq!(user, Address::from([0x33u8; 20]));
            assert_eq!(amount, U256::from(5000000000000000000u64));
            assert_eq!(deadline, U256::from(1800000000u64));
            assert_eq!(reference_nonce, 42);
            assert_eq!(leader_signature.0.len(), 96);
        } else {
            panic!("Expected BridgeSettlementToL3Proposal variant");
        }
    }

    /// Test serialization roundtrip for SubmitOrderForUserProposal
    /// Story 7.3: Submit Order for User
    #[test]
    fn test_submit_order_for_user_proposal_serialization_roundtrip() {
        let msg = P2PMessage::SubmitOrderForUserProposal {
            leader_id: [0x99u8; 32],
            settlement_order_id: U256::from(123),
            itp_id: H256::from([0xABu8; 32]),
            user: Address::from([0xCDu8; 20]),
            amount: U256::from(1000000000000000000u64), // 1 USDC with 18 decimals
            limit_price: U256::from(2000000000000000000u64), // 2.0 price
            slippage_tier: U256::from(1),
            deadline: U256::from(1700000000u64),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01, 0x02, 0x03, 0x04]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test serialization roundtrip for SubmitOrderForUserSign
    /// Story 7.3: Submit Order for User
    #[test]
    fn test_submit_order_for_user_sign_serialization_roundtrip() {
        let msg = P2PMessage::SubmitOrderForUserSign {
            signer_id: [0x88u8; 32],
            signer_index: 2,
            settlement_order_id: U256::from(456),
            signature: BLSSignature(vec![0xAA, 0xBB, 0xCC, 0xDD]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test that different settlement_order_ids produce different serialization
    /// Story 7.3: Submit Order for User
    #[test]
    fn test_submit_order_different_settlement_order_ids_different_serialization() {
        let msg1 = P2PMessage::SubmitOrderForUserSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            settlement_order_id: U256::from(1),
            signature: BLSSignature(vec![0x01]),
        };

        let msg2 = P2PMessage::SubmitOrderForUserSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            settlement_order_id: U256::from(2),
            signature: BLSSignature(vec![0x01]),
        };

        let serialized1 = rmp_serde::to_vec(&msg1).expect("Serialization failed");
        let serialized2 = rmp_serde::to_vec(&msg2).expect("Serialization failed");

        assert_ne!(serialized1, serialized2);
    }

    /// Test SubmitOrderForUserProposal with all fields populated
    /// Story 7.3: Submit Order for User
    #[test]
    fn test_submit_order_proposal_all_fields() {
        let msg = P2PMessage::SubmitOrderForUserProposal {
            leader_id: [0x11u8; 32],
            settlement_order_id: U256::from(999),
            itp_id: H256::from([0x22u8; 32]),
            user: Address::from([0x33u8; 20]),
            amount: U256::from(5000000000000000000u64), // 5 USDC
            limit_price: U256::from(10000000000000000000u64), // 10.0 price
            slippage_tier: U256::from(2),
            deadline: U256::from(1800000000u64),
            reference_nonce: 42,
            leader_signature: BLSSignature(vec![0xFF; 96]), // 96-byte BLS signature
        };

        // Verify all fields are accessible
        if let P2PMessage::SubmitOrderForUserProposal {
            leader_id,
            settlement_order_id,
            itp_id,
            user,
            amount,
            limit_price,
            slippage_tier,
            deadline,
            reference_nonce,
            leader_signature,
        } = msg.clone()
        {
            assert_eq!(leader_id, [0x11u8; 32]);
            assert_eq!(settlement_order_id, U256::from(999));
            assert_eq!(itp_id, H256::from([0x22u8; 32]));
            assert_eq!(user, Address::from([0x33u8; 20]));
            assert_eq!(amount, U256::from(5000000000000000000u64));
            assert_eq!(limit_price, U256::from(10000000000000000000u64));
            assert_eq!(slippage_tier, U256::from(2));
            assert_eq!(deadline, U256::from(1800000000u64));
            assert_eq!(reference_nonce, 42);
            assert_eq!(leader_signature.0.len(), 96);
        } else {
            panic!("Expected SubmitOrderForUserProposal variant");
        }
    }

    /// Test slippage tier validation values
    /// Story 7.3: Submit Order for User
    #[test]
    fn test_submit_order_slippage_tier_values() {
        // Valid slippage tiers: 0, 1, 2
        for tier in 0u8..=2 {
            let msg = P2PMessage::SubmitOrderForUserProposal {
                leader_id: [0x01u8; 32],
                settlement_order_id: U256::from(1),
                itp_id: H256::from([0x00u8; 32]),
                user: Address::from([0x01u8; 20]),
                amount: U256::from(1000000000000000000u64),
                limit_price: U256::from(1000000000000000000u64),
                slippage_tier: U256::from(tier),
                deadline: U256::from(1700000000u64),
                reference_nonce: 1,
                leader_signature: BLSSignature(vec![0x01]),
            };

            let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
            let _deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");
        }
    }

    // ==================== Story 7.4: Batch and Fill Orchestration Tests ====================

    /// Test serialization roundtrip for ConfirmBatchProposal
    /// Story 7.4: Batch and Fill Orchestration
    #[test]
    fn test_confirm_batch_proposal_serialization_roundtrip() {
        let msg = P2PMessage::ConfirmBatchProposal {
            leader_id: [0x99u8; 32],
            cycle_number: 42,
            order_ids: vec![U256::from(1), U256::from(2), U256::from(3)],
            prices: vec![
                U256::from(1000000000000000000u64), // 1.0
                U256::from(2000000000000000000u64), // 2.0
                U256::from(3000000000000000000u64), // 3.0
            ],
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01, 0x02, 0x03, 0x04]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test serialization roundtrip for ConfirmBatchSign
    /// Story 7.4: Batch and Fill Orchestration
    #[test]
    fn test_confirm_batch_sign_serialization_roundtrip() {
        let msg = P2PMessage::ConfirmBatchSign {
            signer_id: [0x88u8; 32],
            signer_index: 2,
            cycle_number: 123,
            signature: BLSSignature(vec![0xAA, 0xBB, 0xCC, 0xDD]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test that different cycle numbers produce different serialization
    /// Story 7.4: Batch and Fill Orchestration
    #[test]
    fn test_confirm_batch_different_cycles_different_serialization() {
        let msg1 = P2PMessage::ConfirmBatchSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            cycle_number: 1,
            signature: BLSSignature(vec![0x01]),
        };

        let msg2 = P2PMessage::ConfirmBatchSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            cycle_number: 2,
            signature: BLSSignature(vec![0x01]),
        };

        let serialized1 = rmp_serde::to_vec(&msg1).expect("Serialization failed");
        let serialized2 = rmp_serde::to_vec(&msg2).expect("Serialization failed");

        assert_ne!(serialized1, serialized2);
    }

    /// Test ConfirmBatchProposal with empty order list
    /// Story 7.4: Batch and Fill Orchestration
    #[test]
    fn test_confirm_batch_proposal_empty_orders() {
        let msg = P2PMessage::ConfirmBatchProposal {
            leader_id: [0x11u8; 32],
            cycle_number: 0,
            order_ids: vec![],
            prices: vec![],
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0xFF; 96]),
        };

        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        if let P2PMessage::ConfirmBatchProposal { order_ids, prices, .. } = deserialized {
            assert!(order_ids.is_empty());
            assert!(prices.is_empty());
        } else {
            panic!("Expected ConfirmBatchProposal variant");
        }
    }

    /// Test ConfirmBatchProposal with many orders
    /// Story 7.4: Batch and Fill Orchestration
    #[test]
    fn test_confirm_batch_proposal_many_orders() {
        let order_ids: Vec<U256> = (0..100).map(|i| U256::from(i)).collect();
        let prices: Vec<U256> = (0..100).map(|i| U256::from(i + 1) * U256::from(1000000000000000000u64)).collect();

        let msg = P2PMessage::ConfirmBatchProposal {
            leader_id: [0x11u8; 32],
            cycle_number: 999,
            order_ids: order_ids.clone(),
            prices: prices.clone(),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0xFF; 96]),
        };

        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        if let P2PMessage::ConfirmBatchProposal { order_ids: deser_orders, prices: deser_prices, .. } = deserialized {
            assert_eq!(deser_orders.len(), 100);
            assert_eq!(deser_prices.len(), 100);
            assert_eq!(deser_orders, order_ids);
            assert_eq!(deser_prices, prices);
        } else {
            panic!("Expected ConfirmBatchProposal variant");
        }
    }

    /// Test serialization roundtrip for ConfirmFillsProposal
    /// Story 7.4: Batch and Fill Orchestration
    #[test]
    fn test_confirm_fills_proposal_serialization_roundtrip() {
        let msg = P2PMessage::ConfirmFillsProposal {
            leader_id: [0x99u8; 32],
            cycle_number: 42,
            fills: vec![
                OrderFill {
                    order_id: U256::from(1),
                    fill_price: U256::from(1000000000000000000u64),
                    fill_amount: U256::from(500000000000000000u64),
                },
                OrderFill {
                    order_id: U256::from(2),
                    fill_price: U256::from(2000000000000000000u64),
                    fill_amount: U256::from(1000000000000000000u64),
                },
            ],
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01, 0x02, 0x03, 0x04]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test serialization roundtrip for ConfirmFillsSign
    /// Story 7.4: Batch and Fill Orchestration
    #[test]
    fn test_confirm_fills_sign_serialization_roundtrip() {
        let msg = P2PMessage::ConfirmFillsSign {
            signer_id: [0x88u8; 32],
            signer_index: 2,
            cycle_number: 123,
            signature: BLSSignature(vec![0xAA, 0xBB, 0xCC, 0xDD]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test that different cycle numbers produce different fills serialization
    /// Story 7.4: Batch and Fill Orchestration
    #[test]
    fn test_confirm_fills_different_cycles_different_serialization() {
        let msg1 = P2PMessage::ConfirmFillsSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            cycle_number: 1,
            signature: BLSSignature(vec![0x01]),
        };

        let msg2 = P2PMessage::ConfirmFillsSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            cycle_number: 2,
            signature: BLSSignature(vec![0x01]),
        };

        let serialized1 = rmp_serde::to_vec(&msg1).expect("Serialization failed");
        let serialized2 = rmp_serde::to_vec(&msg2).expect("Serialization failed");

        assert_ne!(serialized1, serialized2);
    }

    /// Test OrderFill struct serialization
    /// Story 7.4: Batch and Fill Orchestration
    #[test]
    fn test_order_fill_serialization_roundtrip() {
        let fill = OrderFill {
            order_id: U256::from(12345),
            fill_price: U256::from(1500000000000000000u64), // 1.5
            fill_amount: U256::from(750000000000000000u64), // 0.75
        };

        let serialized = rmp_serde::to_vec(&fill).expect("Serialization failed");
        let deserialized: OrderFill = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(fill, deserialized);
    }

    /// Test ConfirmFillsProposal with empty fills
    /// Story 7.4: Batch and Fill Orchestration
    #[test]
    fn test_confirm_fills_proposal_empty_fills() {
        let msg = P2PMessage::ConfirmFillsProposal {
            leader_id: [0x11u8; 32],
            cycle_number: 0,
            fills: vec![],
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0xFF; 96]),
        };

        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        if let P2PMessage::ConfirmFillsProposal { fills, .. } = deserialized {
            assert!(fills.is_empty());
        } else {
            panic!("Expected ConfirmFillsProposal variant");
        }
    }

    /// Test ConfirmFillsProposal with many fills
    /// Story 7.4: Batch and Fill Orchestration
    #[test]
    fn test_confirm_fills_proposal_many_fills() {
        let fills: Vec<OrderFill> = (0..50).map(|i| OrderFill {
            order_id: U256::from(i),
            fill_price: U256::from(i + 1) * U256::from(1000000000000000000u64),
            fill_amount: U256::from(i + 1) * U256::from(100000000000000000u64),
        }).collect();

        let msg = P2PMessage::ConfirmFillsProposal {
            leader_id: [0x11u8; 32],
            cycle_number: 999,
            fills: fills.clone(),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0xFF; 96]),
        };

        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        if let P2PMessage::ConfirmFillsProposal { fills: deser_fills, .. } = deserialized {
            assert_eq!(deser_fills.len(), 50);
            assert_eq!(deser_fills, fills);
        } else {
            panic!("Expected ConfirmFillsProposal variant");
        }
    }

    // ==================== Story 7.5: Bridge L3→Arb Tests ====================

    /// Test serialization roundtrip for BridgeL3ToSettlementProposal
    /// Story 7.5: Bridge USDC L3 to Settlement
    #[test]
    fn test_bridge_l3_to_arb_proposal_serialization_roundtrip() {
        let msg = P2PMessage::BridgeL3ToSettlementProposal {
            leader_id: [0x99u8; 32],
            cycle_number: 42,
            order_ids: vec![U256::from(1), U256::from(2), U256::from(3)],
            total_amount: U256::from(3000000000000000000u64), // 3 USDC
            destination: Address::from([0xABu8; 20]),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01, 0x02, 0x03, 0x04]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test serialization roundtrip for BridgeL3ToSettlementSign
    /// Story 7.5: Bridge USDC L3 to Settlement
    #[test]
    fn test_bridge_l3_to_arb_sign_serialization_roundtrip() {
        let msg = P2PMessage::BridgeL3ToSettlementSign {
            signer_id: [0x88u8; 32],
            signer_index: 2,
            cycle_number: 123,
            signature: BLSSignature(vec![0xAA, 0xBB, 0xCC, 0xDD]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test that different cycle numbers produce different serialization for bridge L3→Settlement
    /// Story 7.5: Bridge USDC L3 to Settlement
    #[test]
    fn test_bridge_l3_to_arb_different_cycles_different_serialization() {
        let msg1 = P2PMessage::BridgeL3ToSettlementSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            cycle_number: 1,
            signature: BLSSignature(vec![0x01]),
        };

        let msg2 = P2PMessage::BridgeL3ToSettlementSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            cycle_number: 2,
            signature: BLSSignature(vec![0x01]),
        };

        let serialized1 = rmp_serde::to_vec(&msg1).expect("Serialization failed");
        let serialized2 = rmp_serde::to_vec(&msg2).expect("Serialization failed");

        assert_ne!(serialized1, serialized2);
    }

    /// Test BridgeL3ToSettlementProposal with empty order list
    /// Story 7.5: Bridge USDC L3 to Settlement
    #[test]
    fn test_bridge_l3_to_arb_proposal_empty_orders() {
        let msg = P2PMessage::BridgeL3ToSettlementProposal {
            leader_id: [0x11u8; 32],
            cycle_number: 0,
            order_ids: vec![],
            total_amount: U256::zero(),
            destination: Address::from([0xCDu8; 20]),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0xFF; 96]),
        };

        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        if let P2PMessage::BridgeL3ToSettlementProposal { order_ids, total_amount, .. } = deserialized {
            assert!(order_ids.is_empty());
            assert!(total_amount.is_zero());
        } else {
            panic!("Expected BridgeL3ToSettlementProposal variant");
        }
    }

    /// Test BridgeL3ToSettlementProposal with many orders
    /// Story 7.5: Bridge USDC L3 to Settlement
    #[test]
    fn test_bridge_l3_to_arb_proposal_many_orders() {
        let order_ids: Vec<U256> = (0..100).map(|i| U256::from(i)).collect();
        let total_amount = U256::from(100) * U256::from(1000000000000000000u64); // 100 USDC total

        let msg = P2PMessage::BridgeL3ToSettlementProposal {
            leader_id: [0x11u8; 32],
            cycle_number: 999,
            order_ids: order_ids.clone(),
            total_amount,
            destination: Address::from([0xEEu8; 20]),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0xFF; 96]),
        };

        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        if let P2PMessage::BridgeL3ToSettlementProposal { order_ids: deser_orders, total_amount: deser_amount, .. } = deserialized {
            assert_eq!(deser_orders.len(), 100);
            assert_eq!(deser_orders, order_ids);
            assert_eq!(deser_amount, total_amount);
        } else {
            panic!("Expected BridgeL3ToSettlementProposal variant");
        }
    }

    /// Test BridgeL3ToSettlementProposal with all fields populated
    /// Story 7.5: Bridge USDC L3 to Settlement
    #[test]
    fn test_bridge_l3_to_arb_proposal_all_fields() {
        let msg = P2PMessage::BridgeL3ToSettlementProposal {
            leader_id: [0x11u8; 32],
            cycle_number: 999,
            order_ids: vec![U256::from(1), U256::from(2)],
            total_amount: U256::from(5000000000000000000u64), // 5 USDC
            destination: Address::from([0x33u8; 20]),
            reference_nonce: 42,
            leader_signature: BLSSignature(vec![0xFF; 96]), // 96-byte BLS signature
        };

        // Verify all fields are accessible
        if let P2PMessage::BridgeL3ToSettlementProposal {
            leader_id,
            cycle_number,
            order_ids,
            total_amount,
            destination,
            reference_nonce,
            leader_signature,
        } = msg.clone()
        {
            assert_eq!(leader_id, [0x11u8; 32]);
            assert_eq!(cycle_number, 999);
            assert_eq!(order_ids.len(), 2);
            assert_eq!(total_amount, U256::from(5000000000000000000u64));
            assert_eq!(destination, Address::from([0x33u8; 20]));
            assert_eq!(reference_nonce, 42);
            assert_eq!(leader_signature.0.len(), 96);
        } else {
            panic!("Expected BridgeL3ToSettlementProposal variant");
        }
    }

    /// Test that different order_ids produce different serialization for bridge L3→Settlement
    /// Story 7.5: Bridge USDC L3 to Settlement
    #[test]
    fn test_bridge_l3_to_arb_different_orders_different_serialization() {
        let msg1 = P2PMessage::BridgeL3ToSettlementProposal {
            leader_id: [0x01u8; 32],
            cycle_number: 1,
            order_ids: vec![U256::from(1)],
            total_amount: U256::from(1000000000000000000u64),
            destination: Address::from([0xABu8; 20]),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01]),
        };

        let msg2 = P2PMessage::BridgeL3ToSettlementProposal {
            leader_id: [0x01u8; 32],
            cycle_number: 1,
            order_ids: vec![U256::from(2)], // Different order
            total_amount: U256::from(1000000000000000000u64),
            destination: Address::from([0xABu8; 20]),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01]),
        };

        let serialized1 = rmp_serde::to_vec(&msg1).expect("Serialization failed");
        let serialized2 = rmp_serde::to_vec(&msg2).expect("Serialization failed");

        assert_ne!(serialized1, serialized2);
    }

    // ==================== Story 7.6: Custody Release to Vault Tests ====================

    /// Test serialization roundtrip for ReleaseToVaultProposal
    /// Story 7.6: Custody Release to MockBitgetVault
    #[test]
    fn test_release_to_vault_proposal_serialization_roundtrip() {
        let msg = P2PMessage::ReleaseToVaultProposal {
            leader_id: [0x99u8; 32],
            cycle_number: 42,
            order_ids: vec![U256::from(1), U256::from(2), U256::from(3)],
            total_amount: U256::from(3000000000000000000u64), // 3 USDC
            vault_address: Address::from([0xABu8; 20]),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01, 0x02, 0x03, 0x04]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test serialization roundtrip for ReleaseToVaultSign
    /// Story 7.6: Custody Release to MockBitgetVault
    #[test]
    fn test_release_to_vault_sign_serialization_roundtrip() {
        let msg = P2PMessage::ReleaseToVaultSign {
            signer_id: [0x88u8; 32],
            signer_index: 2,
            cycle_number: 123,
            signature: BLSSignature(vec![0xAA, 0xBB, 0xCC, 0xDD]),
        };

        // Serialize to MessagePack
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");

        // Deserialize back
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        assert_eq!(msg, deserialized);
    }

    /// Test that different cycle numbers produce different serialization for ReleaseToVault
    /// Story 7.6: Custody Release to MockBitgetVault
    #[test]
    fn test_release_to_vault_different_cycles_different_serialization() {
        let msg1 = P2PMessage::ReleaseToVaultSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            cycle_number: 1,
            signature: BLSSignature(vec![0x01]),
        };

        let msg2 = P2PMessage::ReleaseToVaultSign {
            signer_id: [0x01u8; 32],
            signer_index: 0,
            cycle_number: 2, // Different cycle
            signature: BLSSignature(vec![0x01]),
        };

        let serialized1 = rmp_serde::to_vec(&msg1).expect("Serialization failed");
        let serialized2 = rmp_serde::to_vec(&msg2).expect("Serialization failed");

        assert_ne!(serialized1, serialized2);
    }

    /// Test ReleaseToVaultProposal with empty order list
    /// Story 7.6: Custody Release to MockBitgetVault
    #[test]
    fn test_release_to_vault_proposal_empty_orders() {
        let msg = P2PMessage::ReleaseToVaultProposal {
            leader_id: [0x11u8; 32],
            cycle_number: 0,
            order_ids: vec![],
            total_amount: U256::zero(),
            vault_address: Address::from([0xCDu8; 20]),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0xFF; 96]),
        };

        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        if let P2PMessage::ReleaseToVaultProposal { order_ids, total_amount, .. } = deserialized {
            assert!(order_ids.is_empty());
            assert!(total_amount.is_zero());
        } else {
            panic!("Expected ReleaseToVaultProposal variant");
        }
    }

    /// Test ReleaseToVaultProposal with many orders
    /// Story 7.6: Custody Release to MockBitgetVault
    #[test]
    fn test_release_to_vault_proposal_many_orders() {
        let order_ids: Vec<U256> = (0..100).map(|i| U256::from(i)).collect();
        let total_amount = U256::from(100) * U256::from(1000000000000000000u64); // 100 USDC total

        let msg = P2PMessage::ReleaseToVaultProposal {
            leader_id: [0x11u8; 32],
            cycle_number: 999,
            order_ids: order_ids.clone(),
            total_amount,
            vault_address: Address::from([0xEEu8; 20]),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0xFF; 96]),
        };

        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");

        if let P2PMessage::ReleaseToVaultProposal { order_ids: deser_orders, total_amount: deser_amount, .. } = deserialized {
            assert_eq!(deser_orders.len(), 100);
            assert_eq!(deser_orders, order_ids);
            assert_eq!(deser_amount, total_amount);
        } else {
            panic!("Expected ReleaseToVaultProposal variant");
        }
    }

    /// Test ReleaseToVaultProposal with all fields populated
    /// Story 7.6: Custody Release to MockBitgetVault
    #[test]
    fn test_release_to_vault_proposal_all_fields() {
        let msg = P2PMessage::ReleaseToVaultProposal {
            leader_id: [0x11u8; 32],
            cycle_number: 999,
            order_ids: vec![U256::from(1), U256::from(2)],
            total_amount: U256::from(5000000000000000000u64), // 5 USDC
            vault_address: Address::from([0x33u8; 20]),
            reference_nonce: 42,
            leader_signature: BLSSignature(vec![0xFF; 96]), // 96-byte BLS signature
        };

        // Verify all fields are accessible
        if let P2PMessage::ReleaseToVaultProposal {
            leader_id,
            cycle_number,
            order_ids,
            total_amount,
            vault_address,
            reference_nonce,
            leader_signature,
        } = msg.clone()
        {
            assert_eq!(leader_id, [0x11u8; 32]);
            assert_eq!(cycle_number, 999);
            assert_eq!(order_ids.len(), 2);
            assert_eq!(total_amount, U256::from(5000000000000000000u64));
            assert_eq!(vault_address, Address::from([0x33u8; 20]));
            assert_eq!(reference_nonce, 42);
            assert_eq!(leader_signature.0.len(), 96);
        } else {
            panic!("Expected ReleaseToVaultProposal variant");
        }
    }

    /// Test that different order_ids produce different serialization for ReleaseToVault
    /// Story 7.6: Custody Release to MockBitgetVault
    #[test]
    fn test_release_to_vault_different_orders_different_serialization() {
        let msg1 = P2PMessage::ReleaseToVaultProposal {
            leader_id: [0x01u8; 32],
            cycle_number: 1,
            order_ids: vec![U256::from(1)],
            total_amount: U256::from(1000000000000000000u64),
            vault_address: Address::from([0xABu8; 20]),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01]),
        };

        let msg2 = P2PMessage::ReleaseToVaultProposal {
            leader_id: [0x01u8; 32],
            cycle_number: 1,
            order_ids: vec![U256::from(2)], // Different order
            total_amount: U256::from(1000000000000000000u64),
            vault_address: Address::from([0xABu8; 20]),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01]),
        };

        let serialized1 = rmp_serde::to_vec(&msg1).expect("Serialization failed");
        let serialized2 = rmp_serde::to_vec(&msg2).expect("Serialization failed");

        assert_ne!(serialized1, serialized2);
    }

    /// Test that different vault_addresses produce different serialization for ReleaseToVault
    /// Story 7.6: Custody Release to MockBitgetVault
    #[test]
    fn test_release_to_vault_different_vaults_different_serialization() {
        let msg1 = P2PMessage::ReleaseToVaultProposal {
            leader_id: [0x01u8; 32],
            cycle_number: 1,
            order_ids: vec![U256::from(1)],
            total_amount: U256::from(1000000000000000000u64),
            vault_address: Address::from([0xABu8; 20]),
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01]),
        };

        let msg2 = P2PMessage::ReleaseToVaultProposal {
            leader_id: [0x01u8; 32],
            cycle_number: 1,
            order_ids: vec![U256::from(1)],
            total_amount: U256::from(1000000000000000000u64),
            vault_address: Address::from([0xCDu8; 20]), // Different vault
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01]),
        };

        let serialized1 = rmp_serde::to_vec(&msg1).expect("Serialization failed");
        let serialized2 = rmp_serde::to_vec(&msg2).expect("Serialization failed");

        assert_ne!(serialized1, serialized2);
    }

    // ==================== Arbitration Consensus Tests ====================

    #[test]
    fn test_arbitration_price_proposal_serialization_roundtrip() {
        let msg = P2PMessage::ArbitrationPriceProposal {
            leader_id: [0x99u8; 32],
            bet_id: U256::from(42),
            prices: vec![(0, "AAPL".to_string(), 15023), (1, "MSFT".to_string(), 41520)],
            timestamp: 1700000000,
            reference_nonce: 1,
            leader_signature: BLSSignature(vec![0x01, 0x02, 0x03]),
        };
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");
        assert_eq!(msg, deserialized);
    }

    #[test]
    fn test_arbitration_price_vote_serialization_roundtrip() {
        let msg = P2PMessage::ArbitrationPriceVote {
            voter_id: [0x88u8; 32],
            voter_index: 3,
            bet_id: U256::from(42),
            accept: true,
            signature: BLSSignature(vec![0xAA, 0xBB]),
        };
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");
        assert_eq!(msg, deserialized);
    }

    #[test]
    fn test_arbitration_resolution_sign_serialization_roundtrip() {
        let msg = P2PMessage::ArbitrationResolutionSign {
            signer_id: [0x77u8; 32],
            signer_index: 1,
            bet_id: U256::from(42),
            outcome_hash: H256::from([0xABu8; 32]),
            signature: BLSSignature(vec![0xCC, 0xDD]),
        };
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");
        assert_eq!(msg, deserialized);
    }
}
