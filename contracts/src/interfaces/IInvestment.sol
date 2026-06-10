// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/TypesLib.sol";

/// @title IInvestment - Main Investment contract interface
/// @notice Central contract for order submission, batch confirmation, and ITP management
/// @dev All monetary values use 18 decimals precision
interface IInvestment {
    // ============ ORDER FUNCTIONS ============

    /// @notice Submit a limit order for an ITP
    /// @dev Order is queued for next cycle processing by oracles
    /// @param itpId The ITP identifier
    /// @param side BUY (0) or SELL (1)
    /// @param amount Order amount in USDC (18 decimals)
    /// @param limitPrice Worst acceptable price (18 decimals)
    /// @param slippageTier Tolerance: 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    /// @param deadline Unix timestamp - order expires after this (max 24h)
    /// @return orderId The unique order identifier
    function submitOrder(
        bytes32 itpId,
        TypesLib.Side side,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier,
        uint256 deadline
    ) external returns (uint256 orderId);

    /// @notice Submit a limit order on behalf of a user (oracle-only)
    /// @dev Used by oracles in the cross-chain bridge flow to attribute shares to the original user
    /// @param beneficiary The address that will receive ITP shares (original user)
    /// @param itpId The ITP identifier
    /// @param side BUY (0) or SELL (1)
    /// @param amount Order amount in USDC (18 decimals)
    /// @param limitPrice Worst acceptable price (18 decimals)
    /// @param slippageTier Tolerance: 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    /// @param deadline Unix timestamp - order expires after this (max 24h)
    /// @return orderId The unique order identifier
    function submitOrderFor(
        address beneficiary,
        bytes32 itpId,
        TypesLib.Side side,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier,
        uint256 deadline
    ) external returns (uint256 orderId);

    /// @notice Confirm a batch of orders included in a cycle
    /// @dev Called by oracle consensus with BLS signature
    /// @dev Message format: keccak256(abi.encode(chainid, this, cycleNumber, orderIds))
    /// @param cycleNumber The cycle number for this batch
    /// @param orderIds Array of order IDs included in the batch
    /// @param blsSignature Aggregated BLS signature from 11/20 oracles
    function confirmBatch(
        uint256 cycleNumber,
        uint256[] calldata orderIds,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Confirm order fills with execution prices
    /// @dev Called by oracle consensus after trades are executed
    /// @dev Message format: keccak256(abi.encode(chainid, this, cycleNumber, fills))
    /// @param cycleNumber The cycle number for these fills
    /// @param fills Array of fill data with prices and amounts
    /// @param blsSignature Aggregated BLS signature from 11/20 oracles
    function confirmFills(
        uint256 cycleNumber,
        TypesLib.Fill[] calldata fills,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Refund an expired order
    /// @dev Called when order deadline has passed without execution
    /// @dev Message format: keccak256(abi.encode(chainid, this, "refund", orderId))
    /// @param orderId The order to refund
    /// @param blsSignature Aggregated BLS signature from 11/20 oracles
    function refundExpiredOrder(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Cancel a pending order (user-initiated, no BLS required)
    /// @param orderId The order to cancel
    function cancelOrder(uint256 orderId) external;

    /// @notice Permissionless claim for expired orders after grace period (no BLS required)
    /// @dev Safety net when both AP and oracles are unavailable. Anyone can call.
    ///      Only works after deadline + EXPIRY_GRACE_PERIOD (24h) has elapsed.
    /// @param orderId The expired order to claim
    function claimExpiredOrder(uint256 orderId) external;

    // ============ ITP FUNCTIONS ============

    /// @notice Create a new Index Token Product
    /// @dev Deploys new ITP vault with specified assets and weights.
    ///      If bridgeNonce != type(uint256).max and was already used, returns existing itpId (idempotent).
    /// @param name ITP name (will be packed to bytes32)
    /// @param symbol ITP symbol (will be packed to bytes32)
    /// @param weights Array of asset weights (18 decimals, must sum to 1e18)
    /// @param assets Array of asset addresses
    /// @param prices Array of asset prices (18 decimals) for inventory computation
    /// @param bridgeNonce Bridge nonce for idempotency (type(uint256).max for non-bridge calls)
    /// @return itpId The unique ITP identifier
    function createITP(
        string calldata name,
        string calldata symbol,
        uint256[] calldata weights,
        address[] calldata assets,
        uint256[] calldata prices,
        uint256 bridgeNonce
    ) external returns (bytes32 itpId);

    // ============ REBALANCE FUNCTIONS (V2 - Asset Changes) ============

    /// @notice Permissionless rebalance request — emits event only, no state change
    /// @param itpId The ITP to rebalance
    /// @param removeIndices Indices of assets to remove (sorted descending)
    /// @param addAssets Addresses of assets to add
    /// @param newWeights Target weights for the final asset list
    /// @param note Human-readable reason (e.g., "delisting bitget")
    function requestRebalance(
        bytes32 itpId,
        uint256[] calldata removeIndices,
        address[] calldata addAssets,
        uint256[] calldata newWeights,
        string calldata note
    ) external;

    /// @notice Execute a rebalance via BLS consensus (single call)
    /// @param itpId The ITP to rebalance
    /// @param removeIndices Indices to remove (sorted descending), can be empty
    /// @param addAssets New asset addresses to add, can be empty
    /// @param newWeights Weights for the final asset list
    /// @param prices Prices for the final asset list (for inventory computation)
    /// @param quoteTokens Per-asset quote token for settlement (address(0) = USDC)
    /// @param blsSignature Aggregated BLS signature from oracles
    function rebalance(
        bytes32 itpId,
        uint256[] calldata removeIndices,
        address[] calldata addAssets,
        uint256[] calldata newWeights,
        uint256[] calldata prices,
        address[] calldata quoteTokens,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Transfer ITP creator via authorized bridge
    /// @dev Only callable by the authorized bridge contract
    /// @param itpId The ITP identifier
    /// @param newCreator The new creator address
    function transferCreator(bytes32 itpId, address newCreator) external;

    /// @notice Set the authorized bridge contract address
    /// @param bridge The bridge contract address
    function setAuthorizedBridge(address bridge) external;

    // ============ VIEW FUNCTIONS ============

    /// @notice Get order details by ID
    /// @param orderId The order identifier
    /// @return order The order struct
    function getOrder(uint256 orderId) external view returns (TypesLib.LimitOrder memory order);

    /// @notice Get ITP core data by ID
    /// @param itpId The ITP identifier
    /// @return itp The ITP core struct
    function getITP(bytes32 itpId) external view returns (TypesLib.ITPCore memory itp);

    /// @notice Get current NAV for an ITP
    /// @dev NAV = total value of assets / total supply
    /// @param itpId The ITP identifier
    /// @return nav The NAV in USDC (18 decimals)
    function getNAV(bytes32 itpId) external view returns (uint256 nav);

    /// @notice Get user's ITP share balance
    function getUserShares(bytes32 itpId, address user) external view returns (uint256);

    /// @notice Get full ITP state including assets and inventory
    /// @param itpId The ITP identifier
    /// @return creator ITP creator address
    /// @return totalSupply Total ITP tokens in circulation
    /// @return nav Current NAV (18 decimals)
    /// @return assets Array of asset addresses
    /// @return weights Array of asset weights (18 decimals)
    /// @return inventory Array of asset amounts held (18 decimals each)
    function getITPState(bytes32 itpId)
        external
        view
        returns (
            address creator,
            uint256 totalSupply,
            uint256 nav,
            address[] memory assets,
            uint256[] memory weights,
            uint256[] memory inventory
        );

    // ============ ITP NAV FUNCTIONS ============

    /// @notice Set ITP NAV via BLS-verified push from oracles
    /// @param itpId The ITP identifier
    /// @param nav The NAV value (18 decimals)
    /// @param blsSignature Aggregated BLS signature from oracles
    function setItpNav(bytes32 itpId, uint256 nav, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external;

    // ============ STALENESS & VENUE FUNCTIONS (Story 7.17) ============

    /// @notice Configure per-asset-type staleness limits
    /// @param assetType The asset type identifier (0=CEX, 1=DEX, 2=low-liquidity)
    /// @param maxSeconds Maximum allowed staleness in seconds
    function setStalenessLimit(uint256 assetType, uint256 maxSeconds) external;

    // setStalenessLimitsBatch removed — use setStalenessLimit in loop

    /// @notice Configure a venue pool for inventory tracking
    /// @param venueId The venue identifier
    /// @param targetBalance Target balance for the pool
    /// @param minThreshold Minimum balance before rebalance trigger
    function configureVenuePool(uint256 venueId, uint256 targetBalance, uint256 minThreshold) external;

    /// @notice Update venue pool balance after bridge operations (BLS-signed)
    /// @param venueId The venue identifier
    /// @param newBalance The new balance
    /// @param blsSignature Aggregated BLS signature from oracles
    function updateVenueBalance(uint256 venueId, uint256 newBalance, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external;

    // ============ ORACLE DECOMPOSITION FUNCTIONS ============

    /// @notice Emit per-asset trade instructions after oracle decomposition and cross-ITP netting
    /// @dev No state changes — BLS-authenticated event emission only
    /// @param cycleNumber The cycle for which trades were decomposed
    /// @param trades Array of netted per-asset trades
    /// @param blsSignature Aggregated BLS signature from oracles
    function emitAssetTrades(
        uint256 cycleNumber,
        TypesLib.AssetTrade[] calldata trades,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    // Note: lastProcessedCycleNumber() and cycleProcessed(uint256) are exposed via
    // public storage variables in InvestmentStorage.sol. Do not declare them here to avoid
    // override conflicts with the auto-generated getters.
}
