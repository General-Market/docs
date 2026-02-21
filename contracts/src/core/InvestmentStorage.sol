// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/TypesLib.sol";
import "../interfaces/IGovernance.sol";
import "../interfaces/IIssuerRegistry.sol";
import "../interfaces/IFeeRegistry.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title InvestmentStorage - Canonical storage layout for Investment contract
/// @notice Base contract defining the storage layout for UUPS upgradeable Investment
/// @dev All storage variables are defined here to ensure consistent layout across upgrades.
///      CRITICAL: Do not reorder, remove, or change types of existing variables.
///      Only append new variables before __gap and reduce __gap size accordingly.
abstract contract InvestmentStorage {
    // ============ ORDER STORAGE ============

    /// @notice Orders mapping by order ID
    mapping(uint256 => TypesLib.LimitOrder) public orders;

    /// @notice Next order ID counter (starts at 1)
    uint256 public nextOrderId;

    /// @notice Reference to Governance contract for pause/admin checks
    IGovernance public governance;

    /// @notice USDC token reference
    IERC20 public usdc;

    /// @notice Asset prices by asset index (18 decimals)
    mapping(uint256 => uint256) public assetPrices;

    // ============ ITP STORAGE ============

    /// @notice ITP storage by ITP ID
    mapping(bytes32 => TypesLib.ITPCore) internal _itps;

    /// @notice ITP assets by ITP ID (array of asset addresses)
    mapping(bytes32 => address[]) internal _itpAssets;

    /// @notice ITP weights by ITP ID (array of weights, 18 decimals)
    mapping(bytes32 => uint256[]) internal _itpWeights;

    /// @notice ITP inventory by ITP ID (array of asset amounts)
    mapping(bytes32 => uint256[]) internal _itpInventory;

    /// @notice Check if ITP exists
    mapping(bytes32 => bool) internal _itpExists;

    /// @notice ITP count for ID generation
    uint256 internal _itpCount;

    /// @notice Array of all ITP IDs for enumeration
    bytes32[] internal _allItpIds;

    // ============ BATCH & FILL STORAGE ============

    /// @notice Tracks which cycles have been processed (replay protection)
    mapping(uint256 => bool) public cycleProcessed;

    /// @notice Reference to IssuerRegistry for BLS signature verification
    IIssuerRegistry public issuerRegistry;

    /// @notice ITP vault addresses by ITP ID (for minting/burning tokens)
    mapping(bytes32 => address) public itpVaults;

    /// @notice Reference to FeeRegistry for fee tracking and distribution
    IFeeRegistry public feeRegistry;

    // ============ REBALANCE STORAGE (Story 6.11) ============

    /// @notice DEPRECATED: was _pendingRebalances, slot preserved for UUPS layout
    /// @dev Do not use. Slot 16 occupied by legacy mapping.
    mapping(bytes32 => uint256) internal _deprecated_pendingRebalances;

    /// @notice Global asset count (tracks max asset index + 1 used in setPrice)
    uint256 internal _registeredAssetCount;

    // ============ SELL ORDER STORAGE (Story 7.14) ============

    /// @notice Per-user ITP share balances (itpId => user => shares)
    /// @dev Used for internal share tracking when no external vault is set
    mapping(bytes32 => mapping(address => uint256)) internal _userShares;

    // ============ CYCLE TRACKING (Story 7.14) ============

    /// @notice Last processed cycle number (for issuer auto-discovery on restart)
    /// @dev Enables issuers to query next available cycle without manual configuration
    uint256 public lastProcessedCycleNumber;

    // ============ PRODUCTION HARDENING (Story 7.16) ============

    /// @notice Price timestamps by asset index (seconds since epoch)
    mapping(uint256 => uint256) public assetPriceTimestamps;

    /// @notice Per-asset minimum buy amount in USDC (18 decimals)
    /// @dev asset address => minimum amount. 0 means no per-asset minimum.
    mapping(address => uint256) public minBuyAmount;

    /// @notice Current number of pending orders in the queue
    uint256 public pendingOrderCount;

    /// @notice Queue depth at which a warning event is emitted (default: 100)
    uint256 public queueWarningThreshold;

    /// @notice Queue depth at which new orders are rejected (default: 500)
    uint256 public queuePauseThreshold;

    /// @notice Mapping from asset address to its price index
    /// @dev Used by NAV calculation to look up assetPrices[idx] for each ITP asset
    mapping(address => uint256) public assetAddressToIndex;

    /// @notice Whether an asset address has been registered with an index
    mapping(address => bool) public assetIndexRegistered;

    // ============ PRICE STALENESS (Story 7.17) ============

    /// @notice Per-asset-type staleness limits in seconds (assetType => maxAge)
    /// @dev assetType: 0=CEX, 1=DEX, 2=low-liquidity. 0 means no limit enforced.
    mapping(uint256 => uint256) public stalenessLimits;

    // ============ VENUE POOL TRACKING (Story 7.17) ============

    /// @notice Venue pool tracking for inventory management
    mapping(uint256 => TypesLib.VenuePool) public venuePools;

    // ============ ITP NAV STORAGE ============

    /// @notice BLS-pushed ITP NAV values (itpId => nav in 18 decimals)
    mapping(bytes32 => uint256) public _itpNavs;

    // ============ BRIDGE NONCE IDEMPOTENCY ============

    /// @notice Bridge nonce to ITP ID mapping for idempotent createITP
    /// @dev If a bridgeNonce was already used, createITP returns the existing itpId
    mapping(uint256 => bytes32) public _bridgeNonceToItpId;

    // ============ BRIDGE AUTHORIZATION ============

    /// @notice Authorized bridge contract for cross-chain rebalance/transfer
    address public authorizedBridge;

    // ============ FILL RESILIENCE (Wave 3.1) ============

    /// @notice Escrowed USDC for failed fill transfers (orderId => amount)
    /// @dev When a fill's USDC transfer fails (e.g., blacklisted address),
    ///      funds are parked here for the user to claim later.
    mapping(uint256 => uint256) public failedFillEscrow;

    // ============ BATCHED TIMEOUT (Wave 3.3) ============

    /// @notice Timestamp when each order was batched (orderId => block.timestamp)
    /// @dev Used for auto-refund of BATCHED orders that never get filled.
    mapping(uint256 => uint256) public batchedTimestamp;

    /// @notice Timeout for BATCHED orders in seconds (default: 300s = 5 min)
    uint256 public constant BATCHED_TIMEOUT = 300;

    // ============ STORAGE GAP ============

    /// @dev Reserved storage slots for future upgrades.
    ///      Slot accounting (each mapping/variable = 1 slot):
    ///        orders(0), nextOrderId(1), governance(2), usdc(3), assetPrices(4),
    ///        _itps(5), _itpAssets(6), _itpWeights(7), _itpInventory(8),
    ///        _itpExists(9), _itpCount(10), _allItpIds(11), cycleProcessed(12),
    ///        issuerRegistry(13), itpVaults(14), feeRegistry(15),
    ///        _pendingRebalances(16), _registeredAssetCount(17),
    ///        _userShares(18), lastProcessedCycleNumber(19),
    ///        assetPriceTimestamps(20), minBuyAmount(21), pendingOrderCount(22),
    ///        queueWarningThreshold(23), queuePauseThreshold(24),
    ///        assetAddressToIndex(25), assetIndexRegistered(26),
    ///        stalenessLimits(27), venuePools(28), _itpNavs(29),
    ///        _bridgeNonceToItpId(30), authorizedBridge(31),
    ///        failedFillEscrow(32), batchedTimestamp(33) = 34 slots used
    ///      Target: 50 total slots for upgradeability buffer
    ///      Gap: 50 - 34 = 16 slots
    uint256[16] private __gap;
}
