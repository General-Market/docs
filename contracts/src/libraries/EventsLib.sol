// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title EventsLib - Shared event definitions for Index L3
/// @notice All events emitted by Index contracts
/// @dev Events are indexed strategically for efficient log filtering

/// @custom:security-contact security@indexprotocol.com
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

    /// @notice Emitted when a batch of orders is confirmed by oracle consensus
    /// @param cycleNumber The cycle in which this batch was confirmed
    /// @param orderIds Array of order IDs included in the batch
    /// @param blsSignature Aggregated BLS signature from oracles
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

    /// @notice Emitted when a user cancels their own pending order
    /// @param orderId The cancelled order ID
    /// @param user The user who cancelled
    /// @param amount The refunded amount
    /// @param side 0=BUY, 1=SELL
    event OrderCancelled(
        uint256 indexed orderId,
        address indexed user,
        uint256 amount,
        uint8 side
    );

    // ============ REGISTRY ADMIN EVENTS ============

    /// @notice Emitted when admin is changed in a registry contract
    /// @param previousAdmin The previous admin address
    /// @param newAdmin The new admin address
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    /// @notice Emitted when an authorized caller is added or removed
    /// @param caller The caller address
    /// @param authorized Whether the caller is now authorized
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

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

    // ============ PRODUCTION HARDENING EVENTS (Story 7.16) ============

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

    // ============ ARCHITECTURE GAP FIX EVENTS (Story 7.17) ============

    /// @notice Emitted when an oracle updates their IP address
    /// @param oracleId The oracle whose IP was updated
    /// @param newIp The new IP address
    event OracleIpUpdated(uint256 indexed oracleId, bytes32 newIp);

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

    // ============ REGISTRY SYNC EVENTS (Story 8.1) ============

    /// @notice Emitted when OracleRegistry state changes (add/remove oracle, key rotation)
    /// @dev Used by MirrorOracleRegistry on other chains to sync via BLS proofs
    /// @param nonce Monotonically increasing nonce for replay protection
    /// @param activeCount Number of currently active oracles
    /// @param stateHash keccak256 of all active oracle pubkeys concatenated in order
    event RegistryStateChanged(
        uint256 indexed nonce,
        uint256 activeCount,
        bytes32 stateHash
    );

    /// @notice Emitted when MirrorOracleRegistry is synced from L3
    /// @dev Emitted after successful BLS signature verification and state update
    /// @param nonce The new registry nonce
    /// @param activeCount Number of active oracles
    /// @param threshold BLS threshold for signatures
    /// @param pubkeyHash keccak256 hash of new aggregated pubkey for indexing
    /// @param signersBitmask Bitmask indicating which oracles signed the sync proof
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
    /// @param cycleNumber The oracle cycle number that produced this price
    event NAVPriceUpdated(
        address indexed itpAddress,
        uint256 price,
        uint256 timestamp,
        uint256 cycleNumber,
        uint256 signersBitmask
    );

    // ============ ORACLE DECOMPOSITION EVENTS ============

    /// @notice Per-asset trade instruction after cross-ITP netting by oracles
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
    /// @dev Oracles detect this event and verify before executing via BLS consensus
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

    // ============ CONSENSUS SAFETY EVENTS ============

    /// @notice Emitted when consensus is paused or unpaused by admin
    /// @param paused Whether consensus is now paused
    event ConsensusPausedChanged(bool paused);

    /// @notice Emitted when a registry snapshot is created (after setAggregatedPubkey)
    /// @param nonce The snapshot nonce
    /// @param blockNumber Block number when snapshot was created
    /// @param activeBitmask Bitmask of active oracle IDs
    event SnapshotCreated(uint256 indexed nonce, uint256 blockNumber, uint256 activeBitmask);

    /// @notice Emitted when a snapshot is pending (after add/remove oracle)
    /// @dev Oracle nodes should log WARNING if gap persists > 10 blocks
    /// @param nonce The nonce that needs a snapshot
    event SnapshotPending(uint256 indexed nonce);

    /// @notice Emitted when non-signer missed counts are incremented
    /// @param nonSignersBitmask Bitmask of oracles that did not sign
    event NonSignersRecorded(uint256 nonSignersBitmask);

    // ============ BRIDGE RECOVERY EVENTS ============

    /// @notice Emitted when reversed bridge lock funds are withdrawn via BLS consensus
    /// @param nonce The lock nonce
    /// @param recipient The recipient of the withdrawn funds
    /// @param amount The amount withdrawn
    event ReversedFundsWithdrawn(uint256 indexed nonce, address indexed recipient, uint256 amount);

    // ============ INVESTMENT CONTRACT EVENTS ============

    /// @notice Emitted when the authorized bridge address is updated
    /// @param previousBridge The previous bridge address
    /// @param newBridge The new bridge address
    event AuthorizedBridgeUpdated(address indexed previousBridge, address indexed newBridge);

    // ============ PERMISSIONLESS EXPIRY CLAIM (Finding F6) ============

    /// @notice Emitted when anyone claims an expired order after the grace period
    /// @param orderId The order that was claimed
    /// @param user The user who received the refund
    /// @param claimer The address that triggered the claim
    /// @param amount The refunded amount
    event ExpiredOrderClaimed(
        uint256 indexed orderId,
        address indexed user,
        address indexed claimer,
        uint256 amount
    );
}
