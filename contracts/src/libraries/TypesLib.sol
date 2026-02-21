// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TypesLib - Shared type definitions for Index L3
/// @notice All shared structs and enums used across Index contracts
/// @dev All numeric values use uint256 for simplicity and safety (EVM native word size)
/// @dev All monetary values use 18 decimals precision

library TypesLib {
    // ============ ENUMS ============

    /// @notice Order side - BUY or SELL
    enum Side {
        BUY,
        SELL
    }

    /// @notice Order status lifecycle
    enum OrderStatus {
        PENDING,   // Order submitted, awaiting processing
        BATCHED,   // Order included in a batch, awaiting execution
        FILLED,    // Order fully executed
        CANCELLED, // Order cancelled by user or system
        EXPIRED    // Order deadline passed without execution
    }

    /// @notice Transaction types for collateral movement tracking
    enum TxType {
        BRIDGE,    // Cross-chain bridge transfer
        SWAP_IN,   // DEX swap - assets coming in
        SWAP_OUT,  // DEX swap - assets going out
        BUY,       // CEX buy order
        SELL       // CEX sell order
    }

    /// @notice ITP status lifecycle
    enum ITPStatus {
        INACTIVE,  // ITP not yet activated
        ACTIVE,    // ITP is operational
        PAUSED,    // ITP temporarily paused
        DELISTING  // ITP being wound down
    }

    /// @notice Asset status for AssetPairRegistry
    enum AssetStatus {
        INACTIVE,  // Asset not whitelisted or removed
        PENDING,   // Asset proposed, awaiting timelock
        ACTIVE,    // Asset is whitelisted
        DELISTING  // Asset being removed (allows existing orders to complete)
    }

    /// @notice Pair status for AssetPairRegistry
    enum PairStatus {
        INACTIVE,  // Pair not registered
        PENDING,   // Pair proposed, awaiting timelock
        ACTIVE,    // Pair is active for trading
        DELISTED   // Pair removed (existing orders can complete, no new orders)
    }

    /// @notice Fee types for tracking different cost categories in FeeRegistry
    enum FeeType {
        TRADING,    // Per-trade fees collected
        MANAGEMENT, // Annualized management fees (0-10%)
        BRIDGE,     // Cross-chain bridge costs
        GAS         // Gas costs shared across batch
    }

    // ============ STRUCTS ============

    /// @notice Limit order submitted by users
    /// @dev All orders are limit orders (no market orders in the system)
    /// @param id Global unique ID across all ITPs
    /// @param user Address of the order submitter
    /// @param pairId Identifies asset + source (see Section 12 of architecture)
    /// @param side BUY or SELL
    /// @param amount USDC amount (quote currency, 18 decimals)
    /// @param limitPrice Worst acceptable price (18 decimals)
    /// @param slippageTier 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    /// @param deadline Unix timestamp - order expires after this
    /// @param itpId Which ITP this order belongs to
    /// @param timestamp Order creation time
    struct LimitOrder {
        uint256 id;
        address user;
        bytes32 pairId;
        Side side;
        uint256 amount;
        uint256 limitPrice;
        uint256 slippageTier;
        uint256 deadline;
        bytes32 itpId;
        uint256 timestamp;
        OrderStatus status;
    }

    /// @notice Core ITP (Index Token Product) data
    /// @dev ERC4626-compliant wrapper stored separately
    /// @param name ITP name (packed bytes32)
    /// @param symbol ITP symbol (packed bytes32)
    /// @param creator Address that created the ITP
    /// @param createdAt Creation timestamp
    /// @param feeRate Basis points (10000 = 100%)
    /// @param status ITP lifecycle status
    /// @param totalSupply Total ITP tokens in circulation
    /// @param totalValue Cached NAV * supply (18 decimals)
    /// @param assetCount Number of assets in this ITP
    struct ITPCore {
        bytes32 name;
        bytes32 symbol;
        address creator;
        uint256 createdAt;
        uint256 feeRate;
        uint256 status;
        uint256 totalSupply;
        uint256 totalValue;
        uint256 assetCount;
    }

    /// @notice Fill data for executed orders
    /// @param orderId Reference to the original order
    /// @param fillPrice Actual execution price (18 decimals)
    /// @param fillAmount Amount filled in USDC (18 decimals)
    /// @param cycleNumber Cycle when filled
    /// @param txHash Optional CEX transaction reference
    struct Fill {
        uint256 orderId;
        uint256 fillPrice;
        uint256 fillAmount;
        uint256 cycleNumber;
        bytes32 txHash;
    }

    /// @notice Price data with source and freshness info
    /// @param asset Asset address
    /// @param price Price in USDC (18 decimals)
    /// @param timestamp When price was fetched
    /// @param source 0=Bitget, 1=1inch, 2=on-chain
    struct Price {
        address asset;
        uint256 price;
        uint256 timestamp;
        uint256 source;
    }

    /// @notice Pending bridge lock awaiting release
    /// @dev Used for two-phase bridge with source lock verification
    /// @param amount Amount locked (18 decimals)
    /// @param destChainId Destination chain ID
    /// @param lockedAt Timestamp when locked
    /// @param lockedBlock Block number when locked
    /// @param lockedBlockHash Block hash for verification
    /// @param released Whether funds have been released on destination
    /// @param reversed Whether lock was reversed (timeout/failure)
    struct PendingLock {
        uint256 amount;
        uint256 destChainId;
        uint256 lockedAt;
        uint256 lockedBlock;
        bytes32 lockedBlockHash;
        bool released;
        bool reversed;
    }

    /// @notice Collateral movement tracking for inventory
    /// @dev Emitted as event parameters for CollateralMoved
    /// @param itpId ITP this movement belongs to
    /// @param fromChain Source chain ID (0 for L3)
    /// @param toChain Destination chain ID (0 for L3)
    /// @param amount Amount moved (18 decimals)
    /// @param txType Type of transaction (BRIDGE, SWAP_IN, etc.)
    struct CollateralMove {
        bytes32 itpId;
        uint256 fromChain;
        uint256 toChain;
        uint256 amount;
        TxType txType;
    }

    /// @notice Proof data for bridge release on destination chain
    /// @dev Used to verify source chain lock before releasing funds
    /// @param sourceChainId Chain where funds were locked
    /// @param sourceBlockNumber Block number of the lock transaction
    /// @param sourceBlockHash Block hash for verification
    /// @param sourceTxHash Transaction hash of the lock
    struct ReleaseProof {
        uint256 sourceChainId;
        uint256 sourceBlockNumber;
        bytes32 sourceBlockHash;
        bytes32 sourceTxHash;
    }

    /// @notice Cross-chain order from Arbitrum to L3
    /// @dev Stores order parameters for issuer nodes to process
    /// @param itpId The ITP to purchase
    /// @param user Address that submitted the order
    /// @param amount USDC amount (18 decimals)
    /// @param limitPrice Maximum price per ITP token (18 decimals)
    /// @param slippageTier 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    /// @param deadline Unix timestamp when order expires
    /// @param createdAt Timestamp when order was created
    struct CrossChainOrder {
        bytes32 itpId;
        address user;
        uint256 amount;
        uint256 limitPrice;
        uint256 slippageTier;
        uint256 deadline;
        uint256 createdAt;
    }

    /// @notice Cross-chain sell order from Arbitrum
    /// @dev Stores order parameters for issuer nodes to sell ITP on L3
    /// @param itpId The ITP to sell
    /// @param user Address that submitted the sell order
    /// @param bridgedItpAddress The BridgedITP token address escrowed
    /// @param amount Amount of BridgedITP escrowed (18 decimals)
    /// @param limitPrice Minimum price per ITP token (18 decimals)
    /// @param slippageTier 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    /// @param deadline Unix timestamp when order expires
    /// @param createdAt Timestamp when order was created
    struct CrossChainSellOrder {
        bytes32 itpId;
        address user;
        address bridgedItpAddress;
        uint256 amount;
        uint256 limitPrice;
        uint256 slippageTier;
        uint256 deadline;
        uint256 createdAt;
    }

    /// @notice Issuer node registration data
    /// @dev Stored in IssuerRegistry
    /// @param addr Issuer's Ethereum address for rewards/governance
    /// @param ip IP address for P2P communication
    /// @param blsPubkey BLS public key for signature aggregation
    /// @param status 0=inactive, 1=active, 2=suspended
    /// @param registeredAt Registration timestamp
    struct Issuer {
        address addr;
        bytes32 ip;
        bytes blsPubkey;
        uint256 status;
        uint256 registeredAt;
    }

    /// @notice Key rotation request for issuer
    /// @dev Tracks pending key rotations with approval state
    /// @param issuerId Issuer requesting rotation
    /// @param newPubkey Proposed new BLS public key
    /// @param requestedAt Timestamp of rotation request
    /// @param approvalCount Number of approvals received
    /// @param executed Whether rotation has been executed
    struct KeyRotation {
        uint256 issuerId;
        bytes newPubkey;
        uint256 requestedAt;
        uint256 approvalCount;
        bool executed;
    }

    /// @notice Asset information for AssetPairRegistry
    /// @dev Tracks whitelisted assets with timelock governance
    /// @param asset The asset address
    /// @param status Current status (INACTIVE, PENDING, ACTIVE, DELISTING)
    /// @param proposedAt Timestamp when asset was proposed (activation time = proposedAt)
    /// @param activatedAt Timestamp when asset was activated
    struct AssetInfo {
        address asset;
        AssetStatus status;
        uint256 proposedAt;
        uint256 activatedAt;
    }

    /// @notice Pair information for AssetPairRegistry
    /// @dev Tracks trading pairs with unique pairId = keccak256(asset, source, quoteToken, chainId)
    /// @param pairId Unique identifier for this pair
    /// @param asset The asset address
    /// @param source Trading source (e.g., keccak256("BITGET"), keccak256("1INCH"))
    /// @param quoteToken Quote token address (e.g., USDC)
    /// @param chainId Chain ID where pair is traded (0 for CEX)
    /// @param status Current status (INACTIVE, PENDING, ACTIVE, DELISTED)
    /// @param proposedAt Timestamp when pair was proposed (activation time = proposedAt)
    /// @param activatedAt Timestamp when pair was activated
    struct PairInfo {
        bytes32 pairId;
        address asset;
        bytes32 source;
        address quoteToken;
        uint256 chainId;
        PairStatus status;
        uint256 proposedAt;
        uint256 activatedAt;
    }

    /// @notice Venue pool tracking for inventory management (Architecture Section 14)
    /// @dev Tracks pool state for each venue; actual bridging/rebalancing is off-chain
    /// @param targetBalance Target balance for the pool
    /// @param currentBalance Current balance in the pool
    /// @param minThreshold Minimum balance before rebalance trigger
    /// @param lastRebalance Timestamp of last rebalance
    struct VenuePool {
        uint256 targetBalance;
        uint256 currentBalance;
        uint256 minThreshold;
        uint256 lastRebalance;
    }

    // ============ ISSUER DECOMPOSITION STRUCTS ============

    /// @notice Netted per-asset trade from issuer decomposition (cycle-level, cross-ITP)
    /// @dev Produced by issuers after decomposing ITP orders into per-asset amounts
    ///      and netting same assets across all ITPs in a cycle.
    /// @param asset ERC20 token address to trade
    /// @param side 0=BUY, 1=SELL (per-asset, can differ after cross-ITP netting)
    /// @param usdcAmount Net USDC amount for this asset (18 decimals)
    /// @param price Asset price used for decomposition (18 decimals)
    /// @param quoteToken Quote token for settlement (USDC or USDT address; address(0) = default USDC)
    struct AssetTrade {
        address asset;
        uint8 side;
        uint256 usdcAmount;
        uint256 price;
        address quoteToken;
    }

    // ============ CONSTANTS ============

    /// @notice Slippage tier limits (basis points)
    uint256 constant SLIPPAGE_TIER_0 = 30;   // 0.3% (strict)
    uint256 constant SLIPPAGE_TIER_1 = 100;  // 1.0% (normal)
    uint256 constant SLIPPAGE_TIER_2 = 300;  // 3.0% (relaxed)

    /// @notice Price staleness limits (seconds)
    uint256 constant STALENESS_CEX = 10;       // Bitget
    uint256 constant STALENESS_DEX = 30;       // 1inch
    uint256 constant STALENESS_LOW_LIQ = 60;   // Low liquidity assets

    /// @notice Standard precision (18 decimals)
    uint256 constant PRECISION = 1e18;

    /// @notice Basis points denominator (10000 = 100%)
    uint256 constant BASIS_POINTS = 10000;

    // ============ VISION (BILATERAL P2P) ENUMS ============

    /// @notice Bet status lifecycle for bilateral P2P trading
    enum BetStatus {
        None,           // Bet does not exist
        Active,         // Bet committed by both parties
        InArbitration,  // Dispute raised, awaiting keeper resolution
        Settled,        // Resolved by mutual agreement or arbitration
        CustomPayout    // Resolved with custom split (partial win)
    }

    /// @notice Keeper status for Vision arbitration
    enum KeeperStatus {
        Inactive,   // Keeper not active
        Active,     // Keeper available for arbitration
        Suspended   // Keeper temporarily suspended by admin
    }

    // ============ VISION (BILATERAL P2P) STRUCTS ============

    /// @notice Bilateral bet between two parties
    /// @param tradesRoot Merkle root of trades in this bet
    /// @param creator Address that created the bet
    /// @param filler Address that accepted the bet
    /// @param creatorAmount WIND collateral from creator (18 decimals)
    /// @param fillerAmount WIND collateral from filler (18 decimals)
    /// @param deadline Resolution deadline timestamp
    /// @param status Current bet status
    struct Bet {
        bytes32 tradesRoot;
        address creator;
        address filler;
        uint256 creatorAmount;
        uint256 fillerAmount;
        uint256 deadline;
        BetStatus status;
    }

    /// @notice Keeper node for Vision arbitration
    /// @param addr Keeper's Ethereum address
    /// @param ip IP:port as bytes32 for P2P discovery
    /// @param blsPubkey BLS public key (128 bytes, G2 point)
    /// @param status Keeper lifecycle status
    /// @param registeredAt Registration timestamp
    /// @param stakedAmount WIND staked (always MIN_KEEPER_STAKE)
    struct Keeper {
        address addr;
        bytes32 ip;
        bytes blsPubkey;
        KeeperStatus status;
        uint256 registeredAt;
        uint256 stakedAmount;
    }

    /// @notice Keeper BLS key rotation request
    /// @param newPubkey Proposed new BLS public key (128 bytes)
    /// @param requestedAt Timestamp of rotation request
    /// @param approvalCount Number of approvals received
    /// @param rotationNonce For replay protection
    /// @param executed Whether rotation has been executed
    struct KeeperKeyRotation {
        bytes newPubkey;
        uint256 requestedAt;
        uint256 approvalCount;
        uint256 rotationNonce;
        bool executed;
    }

    /// @notice Old BLS key info during safe period after rotation
    /// @param oldPubkey Previous BLS key
    /// @param validUntil Timestamp until which old key is still accepted
    struct OldKeyInfo {
        bytes oldPubkey;
        uint256 validUntil;
    }

    /// @notice P2P trading bot registration
    /// @param owner Bot owner address
    /// @param endpoint HTTP endpoint for P2P discovery
    /// @param pubkeyHash keccak256 of signing public key
    /// @param active Whether bot is currently active
    /// @param registeredAt Registration timestamp
    /// @param stake WIND staked for registration
    struct Bot {
        address owner;
        string endpoint;
        bytes32 pubkeyHash;
        bool active;
        uint256 registeredAt;
        uint256 stake;
    }

    /// @notice Trade within a bet (used in Merkle proof verification)
    /// @param tradeId Unique trade identifier: keccak256(snapshotId, index)
    /// @param ticker Asset ticker symbol
    /// @param source Price data source
    /// @param method Resolution method (price, binary, drop30, drop80, pump2x, pump10x)
    /// @param position 0=LONG/YES, 1=SHORT/NO
    /// @param entryPrice Entry price (18 decimals)
    /// @param exitPrice Exit price (18 decimals)
    /// @param won Whether this trade was won
    /// @param cancelled Whether this trade was cancelled
    struct Trade {
        bytes32 tradeId;
        string ticker;
        string source;
        string method;
        uint8 position;
        uint256 entryPrice;
        uint256 exitPrice;
        bool won;
        bool cancelled;
    }
}
