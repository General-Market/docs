// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EventsLib - Shared event definitions for Index L3
/// @notice All events emitted by Index contracts
/// @dev Events are indexed strategically for efficient log filtering

library EventsLib {
    // ============ ORDER EVENTS ============

    /// @notice Emitted when a new order is submitted
    /// @param orderId Global unique order ID
    /// @param user Address that submitted the order
    /// @param itpId ITP this order belongs to
    /// @param pairId Asset pair identifier
    /// @param side 0=BUY, 1=SELL
    /// @param amount Order amount in USDC (18 decimals)
    /// @param limitPrice Limit price (18 decimals)
    /// @param slippageTier Slippage tolerance tier (0, 1, or 2)
    /// @param deadline Order expiration timestamp
    event OrderSubmitted(
        uint256 indexed orderId,
        address indexed user,
        bytes32 indexed itpId,
        bytes32 pairId,
        uint8 side,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier,
        uint256 deadline
    );

    /// @notice Emitted when a batch of orders is confirmed by issuer consensus
    /// @param cycleNumber The cycle in which this batch was confirmed
    /// @param orderIds Array of order IDs included in the batch
    /// @param blsSignature Aggregated BLS signature from issuers
    event BatchConfirmed(
        uint256 indexed cycleNumber,
        uint256[] orderIds,
        bytes blsSignature
    );

    /// @notice Emitted when an order fill is confirmed
    /// @param orderId The order that was filled
    /// @param cycleNumber Cycle when fill occurred
    /// @param fillPrice Actual execution price (18 decimals)
    /// @param fillAmount Amount filled in USDC (18 decimals)
    event FillConfirmed(
        uint256 indexed orderId,
        uint256 indexed cycleNumber,
        uint256 fillPrice,
        uint256 fillAmount
    );

    /// @notice Emitted to signal AP that a trade should be executed
    /// @dev AP monitors this event to execute trades on CEX
    /// @param cycleNumber Cycle requesting the trade
    /// @param pairId Asset pair to trade
    /// @param side 0=BUY, 1=SELL
    /// @param amount Amount to trade in USDC (18 decimals)
    /// @param limitPrice Limit price for the trade (18 decimals)
    event TradeRequest(
        uint256 indexed cycleNumber,
        bytes32 indexed pairId,
        uint8 side,
        uint256 amount,
        uint256 limitPrice
    );

    // ============ ITP EVENTS ============

    /// @notice Emitted when a new ITP is created
    /// @param itpId Unique ITP identifier
    /// @param creator Address that created the ITP
    /// @param name ITP name (bytes32 packed)
    /// @param symbol ITP symbol (bytes32 packed)
    /// @param assets Array of asset addresses in the ITP
    /// @param weights Array of asset weights (18 decimals, sum = 1e18)
    event ITPCreated(
        bytes32 indexed itpId,
        address indexed creator,
        bytes32 name,
        bytes32 symbol,
        address[] assets,
        uint256[] weights
    );

    // ============ BRIDGE EVENTS ============

    /// @notice Emitted when funds are locked for a bridge transfer
    /// @param nonce Unique nonce for this lock
    /// @param amount Amount locked (18 decimals)
    /// @param destChainId Destination chain ID
    /// @param blockNumber Block number when locked
    /// @param blockHash Block hash for verification
    event BridgeLockConfirmed(
        uint256 indexed nonce,
        uint256 amount,
        uint256 destChainId,
        uint256 blockNumber,
        bytes32 blockHash
    );

    /// @notice Emitted when a bridge transfer completes on destination
    /// @param sourceChainId Chain where funds originated
    /// @param nonce Nonce matching the source lock
    /// @param amount Amount released (18 decimals)
    /// @param sourceTxHash Transaction hash from source chain
    event BridgeCompleted(
        uint256 indexed sourceChainId,
        uint256 indexed nonce,
        uint256 amount,
        bytes32 sourceTxHash
    );

    // ============ COLLATERAL EVENTS ============

    /// @notice Emitted when collateral is moved between chains or swapped
    /// @param itpId ITP this movement belongs to
    /// @param fromChain Source chain ID (0 for L3)
    /// @param toChain Destination chain ID (0 for L3)
    /// @param amount Amount moved (18 decimals)
    /// @param txType Transaction type (0=BRIDGE, 1=SWAP_IN, 2=SWAP_OUT, 3=BUY, 4=SELL)
    event CollateralMoved(
        bytes32 indexed itpId,
        uint256 indexed fromChain,
        uint256 indexed toChain,
        uint256 amount,
        uint8 txType
    );

    // ============ BLS CUSTODY EVENTS (Story 2.7) ============

    /// @notice Emitted when a BLS-signed execution is performed
    /// @param target Target contract address
    /// @param data Calldata executed
    /// @param nonce Nonce used for replay protection
    event Executed(
        address indexed target,
        bytes data,
        uint256 indexed nonce
    );

    // ============ WHITELIST EVENTS (Story 2.8) ============

    /// @notice Emitted when a whitelist addition is proposed
    /// @param target Target address proposed for whitelisting
    /// @param proposedAt Timestamp when proposed
    /// @param activateAt Timestamp when whitelist can be activated (after timelock)
    event WhitelistProposed(
        address indexed target,
        uint256 proposedAt,
        uint256 activateAt
    );

    /// @notice Emitted when a whitelist addition is activated after timelock
    /// @param target Target address that was whitelisted
    /// @param activatedAt Timestamp when activated
    event WhitelistActivated(
        address indexed target,
        uint256 activatedAt
    );

    /// @notice Emitted when a target is emergency removed from whitelist
    /// @param target Target address that was removed
    /// @param removedAt Timestamp when removed
    event WhitelistRemoved(
        address indexed target,
        uint256 removedAt
    );

    /// @notice Emitted when an expired order is refunded
    /// @param orderId The order that was refunded
    /// @param user The user who received the refund
    /// @param amount The amount refunded in USDC (18 decimals)
    event OrderRefunded(
        uint256 indexed orderId,
        address indexed user,
        uint256 amount
    );

    // ============ FILL RESILIENCE EVENTS (Wave 3) ============

    /// @notice Emitted when a fill's USDC transfer fails and funds are escrowed
    /// @param orderId The order ID
    /// @param user The intended recipient
    /// @param amount The escrowed amount
    event FillFailed(
        uint256 indexed orderId,
        address indexed user,
        uint256 amount
    );

    /// @notice Emitted when a user claims escrowed funds from a failed fill
    /// @param orderId The order ID
    /// @param user The user who claimed
    /// @param amount The claimed amount
    event EscrowClaimed(
        uint256 indexed orderId,
        address indexed user,
        uint256 amount
    );

    /// @notice Emitted when stale pending orders are cancelled
    /// @param orderIds The cancelled order IDs
    /// @param cancelledCount Number of orders actually cancelled
    event StalePendingOrdersCancelled(
        uint256[] orderIds,
        uint256 cancelledCount
    );

    // ============ REGISTRY ADMIN EVENTS ============

    /// @notice Emitted when admin is changed in a registry contract
    /// @param previousAdmin The previous admin address
    /// @param newAdmin The new admin address
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    /// @notice Emitted when aggregated BLS pubkey is updated
    /// @param pubkey The new aggregated public key
    event AggregatedPubkeyUpdated(bytes pubkey);

    /// @notice Emitted when an authorized caller is added or removed
    /// @param caller The caller address
    /// @param authorized Whether the caller is now authorized
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    /// @notice Emitted when BLS library address is updated
    /// @param blsLibrary The new BLS library address
    event BLSLibraryUpdated(address indexed blsLibrary);

    // ============ FEE REGISTRY EVENTS ============

    /// @notice Emitted when ITP deployer is registered for fee claiming
    /// @param itpId The ITP identifier
    /// @param deployer The deployer address
    event ITPDeployerRegistered(bytes32 indexed itpId, address indexed deployer);

    /// @notice Emitted when ITP fee rate is updated
    /// @param itpId The ITP identifier
    /// @param oldRate Previous fee rate in basis points
    /// @param newRate New fee rate in basis points
    event FeeRateUpdated(bytes32 indexed itpId, uint256 oldRate, uint256 newRate);

    /// @notice Emitted when a fee is charged (per-order or batch)
    /// @param user Address of the user charged
    /// @param itpId The ITP identifier
    /// @param amount Fee amount (18 decimals)
    /// @param feeType Type of fee charged (0=TRADING, 1=MANAGEMENT, 2=BRIDGE, 3=GAS)
    event FeeCharged(
        address indexed user,
        bytes32 indexed itpId,
        uint256 amount,
        uint8 feeType
    );

    /// @notice Emitted when fee split ratios are updated
    /// @param deployerShareBps New deployer share in basis points
    event FeeSplitUpdated(uint256 deployerShareBps);

    /// @notice Emitted when fees are claimed by deployer or protocol
    /// @param itpId The ITP identifier
    /// @param recipient Address receiving the fees
    /// @param amount Amount claimed (18 decimals)
    event FeesClaimed(
        bytes32 indexed itpId,
        address indexed recipient,
        uint256 amount
    );

    // ============ REBALANCE EVENTS (Story 6.11) ============

    /// @notice Emitted when an asset manager proposes a rebalance for an ITP
    /// @param itpId The ITP being rebalanced
    /// @param oldWeights The current weights before rebalance
    /// @param newWeights The proposed target weights
    event RebalanceProposed(
        bytes32 indexed itpId,
        uint256[] oldWeights,
        uint256[] newWeights
    );

    /// @notice Emitted when issuers confirm a rebalance batch via BLS consensus
    /// @param cycleNumber The cycle in which the rebalance was confirmed
    /// @param itpIds Array of ITP IDs included in the rebalance batch
    /// @param blsSignature Aggregated BLS signature from issuers
    event RebalanceBatchConfirmed(
        uint256 indexed cycleNumber,
        bytes32[] itpIds,
        bytes blsSignature
    );

    /// @notice Emitted when ITP weights are updated after rebalance fills complete
    /// @param itpId The ITP whose weights were updated
    /// @param oldWeights The weights before update
    /// @param newWeights The new weights after update
    event WeightsUpdated(
        bytes32 indexed itpId,
        uint256[] oldWeights,
        uint256[] newWeights
    );

    // ============ PRODUCTION HARDENING EVENTS (Story 7.16) ============

    /// @notice Emitted when an asset price is updated via BLS consensus
    /// @param assetIdx The asset index
    /// @param price The new price (18 decimals)
    /// @param timestamp The price timestamp
    event PriceUpdated(
        uint256 indexed assetIdx,
        uint256 price,
        uint256 timestamp
    );

    /// @notice Emitted when per-asset minimum buy amount is configured
    /// @param asset The asset address
    /// @param amount The new minimum buy amount (18 decimals)
    event MinBuyAmountUpdated(
        address indexed asset,
        uint256 amount
    );

    /// @notice Emitted when order queue depth exceeds warning threshold
    /// @param depth Current queue depth
    event QueueDepthWarning(uint256 depth);

    /// @notice Emitted when queue depth thresholds are updated by admin
    /// @param warningThreshold New warning threshold
    /// @param pauseThreshold New pause threshold
    event QueueThresholdsUpdated(uint256 warningThreshold, uint256 pauseThreshold);

    /// @notice Emitted when an asset address is registered to a price index
    /// @param asset The asset address
    /// @param idx The price index
    event AssetIndexRegistered(address indexed asset, uint256 idx);

    // ============ ARCHITECTURE GAP FIX EVENTS (Story 7.17) ============

    /// @notice Emitted when an issuer updates their IP address
    /// @param issuerId The issuer whose IP was updated
    /// @param newIp The new IP address
    event IssuerIpUpdated(uint256 indexed issuerId, bytes32 newIp);

    /// @notice Emitted when a staleness limit is updated for an asset type
    /// @param assetType The asset type (0=CEX, 1=DEX, 2=low-liquidity)
    /// @param maxSeconds Maximum allowed staleness in seconds
    event StalenessLimitUpdated(uint256 indexed assetType, uint256 maxSeconds);

    /// @notice Emitted when a venue pool is configured
    /// @param venueId The venue identifier
    /// @param targetBalance Target balance for the pool
    /// @param minThreshold Minimum balance before rebalance trigger
    event VenuePoolConfigured(uint256 indexed venueId, uint256 targetBalance, uint256 minThreshold);

    /// @notice Emitted when a venue pool needs rebalancing (balance below threshold)
    /// @param venueId The venue identifier
    /// @param amount The deficit amount (targetBalance - currentBalance)
    event PoolRebalanceNeeded(uint256 indexed venueId, uint256 amount);

    /// @notice Emitted when a venue pool rebalance completes
    /// @param venueId The venue identifier
    /// @param amount The amount rebalanced
    event PoolRebalanceComplete(uint256 indexed venueId, uint256 amount);

    // ============ REGISTRY SYNC EVENTS (Story 8.1) ============

    /// @notice Emitted when IssuerRegistry state changes (add/remove issuer, key rotation)
    /// @dev Used by MirrorIssuerRegistry on other chains to sync via BLS proofs
    /// @param nonce Monotonically increasing nonce for replay protection
    /// @param activeCount Number of currently active issuers
    /// @param stateHash keccak256 of all active issuer pubkeys concatenated in order
    event RegistryStateChanged(
        uint256 indexed nonce,
        uint256 activeCount,
        bytes32 stateHash
    );

    /// @notice Emitted when MirrorIssuerRegistry is synced from L3
    /// @dev Emitted after successful BLS signature verification and state update
    /// @param nonce The new registry nonce
    /// @param activeCount Number of active issuers
    /// @param threshold BLS threshold for signatures
    /// @param pubkeyHash keccak256 hash of new aggregated pubkey for indexing
    /// @param signersBitmask Bitmask indicating which issuers signed the sync proof
    event RegistrySynced(
        uint256 indexed nonce,
        uint256 activeCount,
        uint256 threshold,
        bytes32 pubkeyHash,
        uint256 signersBitmask
    );

    // ============ ITP NAV EVENTS ============

    /// @notice Emitted when ITP NAV is updated via BLS-verified push
    /// @param itpId The ITP identifier
    /// @param nav The new NAV value (18 decimals)
    event ItpNavUpdated(bytes32 indexed itpId, uint256 nav);

    // ============ NAV ORACLE EVENTS (Story 8.6) ============

    /// @notice Emitted when ITP NAV price is updated via BLS-verified consensus
    /// @dev Distinct from PriceUpdated which is per-asset-index
    /// @param itpAddress The ITP token address this oracle prices
    /// @param price The new NAV price (36 decimals)
    /// @param timestamp Block timestamp when price was updated
    /// @param cycleNumber The issuer cycle number that produced this price
    event NAVPriceUpdated(
        address indexed itpAddress,
        uint256 price,
        uint256 timestamp,
        uint256 cycleNumber,
        uint256 signersBitmask
    );

    // ============ ISSUER DECOMPOSITION EVENTS ============

    /// @notice Per-asset trade instruction after cross-ITP netting by issuers
    /// @dev No itpId — trades are cycle-level, netted across all ITPs.
    ///      AP monitors this event to execute one vault trade per asset.
    /// @param cycleNumber Cycle requesting the trade
    /// @param asset ERC20 token address to trade
    /// @param side 0=BUY, 1=SELL (per-asset after netting)
    /// @param usdcAmount Net USDC amount for this asset (18 decimals)
    /// @param price Asset price used for decomposition (18 decimals)
    /// @param quoteToken Quote token for settlement (USDC or USDT; address(0) = default USDC)
    event AssetTradeRequest(
        uint256 indexed cycleNumber,
        address indexed asset,
        uint8 side,
        uint256 usdcAmount,
        uint256 price,
        address quoteToken
    );

    // ============ CROSS-CHAIN REBALANCE EVENTS ============

    /// @notice Emitted when ITP creator is transferred via authorized bridge
    /// @param itpId The ITP identifier
    /// @param oldCreator The previous creator address
    /// @param newCreator The new creator address
    event CreatorTransferred(bytes32 indexed itpId, address indexed oldCreator, address indexed newCreator);

    // ============ REBALANCE V2 EVENTS (Asset Changes) ============

    /// @notice Emitted when anyone requests a rebalance (permissionless event-only)
    /// @dev Issuers detect this event and verify before executing via BLS consensus
    /// @param requester Address that requested the rebalance
    /// @param itpId The ITP to rebalance
    /// @param removeIndices Indices of assets to remove (sorted descending)
    /// @param addAssets Addresses of assets to add
    /// @param newWeights Target weights for the final asset list
    /// @param note Human-readable reason (e.g., "delisting bitget")
    event RebalanceRequested(
        address indexed requester,
        bytes32 indexed itpId,
        uint256[] removeIndices,
        address[] addAssets,
        uint256[] newWeights,
        string note
    );

    /// @notice Emitted when a rebalance is executed via BLS consensus
    /// @param itpId The ITP that was rebalanced
    /// @param newAssets Final asset list after rebalance
    /// @param newWeights Final weights after rebalance
    /// @param newInventory Final per-share inventory quantities
    /// @param nav NAV at time of rebalance
    event Rebalanced(
        bytes32 indexed itpId,
        address[] newAssets,
        uint256[] newWeights,
        uint256[] newInventory,
        uint256 nav
    );

    // ============ VISION (BILATERAL P2P) EVENTS ============

    /// @notice Emitted when a bilateral bet is committed by both parties
    /// @param betId Unique bet identifier
    /// @param creator Address that created the bet
    /// @param filler Address that accepted the bet
    /// @param creatorAmount Creator's WIND collateral
    /// @param fillerAmount Filler's WIND collateral
    /// @param deadline Resolution deadline
    event BetCommitted(
        bytes32 indexed betId,
        address indexed creator,
        address indexed filler,
        uint256 creatorAmount,
        uint256 fillerAmount,
        uint256 deadline
    );

    /// @notice Emitted when a bet is settled (by agreement or arbitration)
    /// @param betId The settled bet ID
    /// @param creatorPayout Amount paid to creator
    /// @param fillerPayout Amount paid to filler
    /// @param byArbitration Whether settlement was via keeper arbitration
    event BetSettled(
        bytes32 indexed betId,
        uint256 creatorPayout,
        uint256 fillerPayout,
        bool byArbitration
    );

    /// @notice Emitted when arbitration is requested for a bet
    /// @param betId The bet entering arbitration
    /// @param requester Address that requested arbitration
    event ArbitrationRequested(
        bytes32 indexed betId,
        address indexed requester
    );

    /// @notice Emitted when collateral is deposited to the vault
    /// @param user Address that deposited
    /// @param amount WIND amount deposited
    event CollateralDeposited(
        address indexed user,
        uint256 amount
    );

    /// @notice Emitted when collateral is withdrawn from the vault
    /// @param user Address that withdrew
    /// @param amount WIND amount withdrawn
    event CollateralWithdrawn(
        address indexed user,
        uint256 amount
    );

    /// @notice Emitted when a P2P trading bot is registered
    /// @param bot Bot owner address
    /// @param endpoint P2P HTTP endpoint
    /// @param pubkeyHash keccak256 of signing key
    /// @param stake WIND staked
    event BotRegistered(
        address indexed bot,
        string endpoint,
        bytes32 pubkeyHash,
        uint256 stake
    );

    /// @notice Emitted when a bot is deregistered and stake returned
    /// @param bot Bot owner address
    /// @param stakeReturned WIND returned
    event BotDeregistered(
        address indexed bot,
        uint256 stakeReturned
    );

    /// @notice Emitted when a keeper is registered for Vision arbitration
    /// @param keeper Keeper address
    /// @param ip IP:port as bytes32
    /// @param blsPubkey BLS public key (128 bytes)
    /// @param stake WIND staked
    event KeeperRegistered(
        address indexed keeper,
        bytes32 indexed ip,
        bytes blsPubkey,
        uint256 stake
    );

    /// @notice Emitted when a keeper is suspended by admin
    /// @param keeper Keeper address
    event KeeperSuspended(address indexed keeper);

    /// @notice Emitted when a keeper is reinstated by admin
    /// @param keeper Keeper address
    event KeeperReinstated(address indexed keeper);

    /// @notice Emitted when a keeper BLS key rotation is requested
    /// @param keeper Keeper requesting rotation
    /// @param newPubkey Proposed new BLS public key
    event KeyRotationRequested(
        address indexed keeper,
        bytes newPubkey
    );

    /// @notice Emitted when a keeper BLS key rotation is executed
    /// @param keeper Keeper whose key was rotated
    /// @param oldPubkey Previous BLS public key
    /// @param newPubkey New BLS public key
    event KeyRotationExecuted(
        address indexed keeper,
        bytes oldPubkey,
        bytes newPubkey
    );

    /// @notice Emitted when referral Merkle root is set for an epoch
    /// @param epoch The epoch number
    /// @param merkleRoot The Merkle root for claims
    event ReferralEpochSet(
        uint256 indexed epoch,
        bytes32 merkleRoot
    );

    /// @notice Emitted when referral reward is claimed
    /// @param epoch The epoch
    /// @param claimer Address that claimed
    /// @param amount WIND amount claimed
    event ReferralClaimed(
        uint256 indexed epoch,
        address indexed claimer,
        uint256 amount
    );

    /// @notice Emitted when the authorized bridge address is updated
    /// @param previousBridge The previous bridge address
    /// @param newBridge The new bridge address
    event AuthorizedBridgeUpdated(address indexed previousBridge, address indexed newBridge);
}
