// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title TypesLib - Shared type definitions for Index L3
/// @notice All shared structs and enums used across Index contracts
/// @dev All numeric values use uint256 for simplicity and safety (EVM native word size)
/// @dev All monetary values use 18 decimals precision

/// @custom:security-contact security@indexprotocol.com
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

    /// @notice Cross-chain order from Settlement to L3
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

    /// @notice Pending mint data for crash recovery
    /// @dev Stored when completeBuyOrder succeeds, queried on issuer restart
    /// @param itpId The ITP being purchased
    /// @param user User who should receive BridgedITP shares
    /// @param amount Internal amount (18 decimals) from the original order
    struct PendingMint {
        bytes32 itpId;
        address user;
        uint256 amount;
    }

    /// @notice Cross-chain sell order from Settlement
    /// @dev Stores order parameters for issuer nodes to sell ITP on L3
    /// @param itpId The ITP to sell
    /// @param user Address that submitted the sell order
    /// @param bridgedItpAddress The BridgedITP token address escrowed
    /// @param amount Amount of BridgedITP escrowed (18 decimals)
    /// @param limitPrice Minimum price per ITP token (18 decimals)
    /// @param slippageTier 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    /// @param deadline Unix timestamp when order expires
    /// @param createdAt Timestamp when order was created
    /// @param burned Whether BridgedITP shares have been burned (gate for confirmFills)
    /// @param burnedAt Timestamp when shares were burned (for remint cooldown)
    struct CrossChainSellOrder {
        bytes32 itpId;
        address user;
        address bridgedItpAddress;
        uint256 amount;
        uint256 limitPrice;
        uint256 slippageTier;
        uint256 deadline;
        uint256 createdAt;
        bool burned;
        uint256 burnedAt;
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

    // ============ REGISTRY SNAPSHOT (Phase 2+3) ============

    /// @notice Registry state snapshot for BLS verification with historical state tracking
    /// @dev Stored per-nonce in IssuerRegistry. BLSVerifier loads snapshot by referenceNonce.
    /// @param activeCount Number of active issuers at snapshot time
    /// @param stateHash keccak256 of all active issuer pubkeys concatenated
    /// @param aggregatedPubkey Aggregated BLS G2 pubkey stored as 4x bytes32 (128 bytes total)
    /// @param blockNumber Block number when snapshot was created
    /// @param activeBitmask Bitmask of active issuer IDs (bit i = issuer i is active)
    struct RegistrySnapshot {
        uint256 activeCount;
        bytes32 stateHash;
        bytes32[4] aggregatedPubkey;
        uint256 blockNumber;
        uint256 activeBitmask;
    }

    // ============ VISION DEPOSIT STRUCTS ============

    /// @notice Vision cross-chain deposit from Settlement
    /// @param user Address that deposited on Settlement
    /// @param amount Amount in 18 decimals (converted from 6-dec input)
    /// @param createdAt Timestamp when deposit was created
    struct VisionDeposit {
        address user;
        uint256 amount;
        uint256 createdAt;
    }

}
