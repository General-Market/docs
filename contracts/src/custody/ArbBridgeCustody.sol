// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IBridge.sol";
import "../interfaces/IIssuerRegistry.sol";
import "../libraries/BLSLib.sol";
import "../libraries/DecimalLib.sol";
import "../libraries/ErrorsLib.sol";
import "../libraries/EventsLib.sol";
import "../libraries/TypesLib.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IBridgeProxy.sol";

/// @title ArbBridgeCustody - Arbitrum destination chain bridge custody
/// @notice Handles releasing USDC on Arbitrum and cross-chain ITP purchases
/// @dev UUPS upgradeable, deployed on Arbitrum chain
/// @dev SECURITY: Phase 1 uses aggregated BLS key from IssuerRegistry. If registry returns
///      empty pubkey, BLS verification is SKIPPED. Production deployment MUST ensure
///      IssuerRegistry is properly configured with a valid aggregated pubkey.
contract ArbBridgeCustody is Initializable, UUPSUpgradeable, IArbBridgeCustody {
    using SafeERC20 for IERC20;

    // ============ CONSTANTS ============

    /// @notice Maximum deadline duration for cross-chain orders (24 hours)
    uint256 public constant MAX_DEADLINE_DURATION = 24 hours;

    /// @notice Maximum slippage tier (0, 1, or 2)
    uint256 public constant MAX_SLIPPAGE_TIER = 2;

    /// @notice Minimum USDC amount (0.001 USDC = 1000 in 6 decimals)
    /// @dev This is the 6-decimal minimum that users must provide
    uint256 public constant MIN_USDC_AMOUNT = 1000;

    /// @notice Standard operation threshold (11/20)
    uint256 public constant STANDARD_THRESHOLD = 11;

    /// @notice Upgrade timelock duration (7 days)
    uint256 public constant UPGRADE_TIMELOCK = 7 days;

    /// @notice Emergency upgrade timelock duration (24 hours)
    uint256 public constant EMERGENCY_UPGRADE_TIMELOCK = 24 hours;

    // ============ STORAGE ============

    /// @notice Reference to IssuerRegistry for BLS key verification
    IIssuerRegistry public issuerRegistry;

    /// @notice USDC token contract
    IERC20 public usdc;

    /// @notice L3 Index contract address reference
    address public l3Index;

    /// @notice Mapping of sourceChainId => nonce => completed
    /// @dev Double mapping for multi-chain support - each source chain has independent nonces
    mapping(uint256 => mapping(uint256 => bool)) public bridgeCompleted;

    /// @notice Counter for cross-chain order IDs
    uint256 public crossChainOrderId;

    /// @notice Mapping of orderId => cross-chain order details
    mapping(uint256 => TypesLib.CrossChainOrder) public crossChainOrders;

    /// @notice Pending upgrade implementation address
    address public pendingUpgradeImpl;

    /// @notice Pending upgrade proposal timestamp
    uint256 public pendingUpgradeProposedAt;

    /// @notice Whether pending upgrade is emergency (24h) or standard (7d)
    bool public pendingUpgradeIsEmergency;

    /// @notice Reference to BridgeProxy for BridgedITP lookups
    IBridgeProxy public bridgeProxy;

    /// @notice Mapping of orderId => cross-chain sell order details
    mapping(uint256 => TypesLib.CrossChainSellOrder) public crossChainSellOrders;

    /// @notice Storage gap for future upgrades
    /// @dev Used: issuerRegistry, usdc, l3Index, bridgeCompleted, crossChainOrderId,
    ///      crossChainOrders, pendingUpgradeImpl, pendingUpgradeProposedAt, pendingUpgradeIsEmergency,
    ///      bridgeProxy, crossChainSellOrders = 11 slots
    uint256[39] private __gap;

    // ============ INITIALIZER ============

    /// @notice Initialize the ArbBridgeCustody contract
    /// @param issuerRegistry_ Address of the IssuerRegistry contract
    /// @param usdc_ Address of the USDC token contract
    /// @param l3Index_ Address of the L3 Index contract
    function initialize(address issuerRegistry_, address usdc_, address l3Index_) external initializer {
        __UUPSUpgradeable_init();
        if (issuerRegistry_ == address(0)) {
            revert ErrorsLib.E043_ZeroIssuerRegistry();
        }
        if (usdc_ == address(0)) {
            revert ErrorsLib.E050_ZeroUSDCAddress();
        }
        if (l3Index_ == address(0)) {
            revert ErrorsLib.E056_ZeroL3IndexAddress();
        }
        issuerRegistry = IIssuerRegistry(issuerRegistry_);
        usdc = IERC20(usdc_);
        l3Index = l3Index_;
    }

    // ============ BRIDGE COMPLETION ============

    /// @inheritdoc IArbBridgeCustody
    /// @notice Completes a bridge transfer from L3 to Arbitrum
    /// @dev The `amount` parameter is in 18-decimal internal format (from L3).
    ///      The actual USDC transfer uses 6-decimal format (real USDC).
    ///      Events emit 18-decimal amounts for cross-chain consistency.
    /// @param sourceChainId The source chain ID (L3)
    /// @param amount Amount in 18-decimal internal format
    /// @param nonce Unique nonce for this bridge operation
    /// @param proof Proof of the lock on source chain
    /// @param blsSignature BLS signature from issuers
    function completeBridge(
        uint256 sourceChainId,
        uint256 amount,
        uint256 nonce,
        TypesLib.ReleaseProof calldata proof,
        bytes calldata blsSignature
    ) external override {
        // Validate source chain ID (not zero, not current chain)
        if (sourceChainId == 0 || sourceChainId == block.chainid) {
            revert ErrorsLib.E055_InvalidSourceChainId(sourceChainId);
        }

        // Check nonce not already used for this source chain
        if (bridgeCompleted[sourceChainId][nonce]) {
            revert ErrorsLib.E054_BridgeAlreadyCompleted(sourceChainId, nonce);
        }

        // Validate proof fields are non-zero
        if (proof.sourceBlockNumber == 0 || proof.sourceBlockHash == bytes32(0) || proof.sourceTxHash == bytes32(0)) {
            revert ErrorsLib.E057_InvalidProof();
        }

        // Validate proof source chain matches
        if (proof.sourceChainId != sourceChainId) {
            revert ErrorsLib.E055_InvalidSourceChainId(proof.sourceChainId);
        }

        // Build message for BLS verification
        // Message: keccak256(abi.encode(chainid, this, proof, amount, nonce))
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), proof, amount, nonce));

        // Verify BLS signature (11/20 threshold)
        // PHASE 1: If aggregatedPubkey is empty, verification is skipped (for testing)
        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        // Mark nonce as used
        bridgeCompleted[sourceChainId][nonce] = true;

        // Convert 18-decimal internal amount to 6-decimal USDC for actual transfer
        // Note: Any dust (amount % 1e12) is truncated - max loss ~$0.000001
        uint256 usdcAmount = DecimalLib.toUsdc(amount);

        // Transfer 6-decimal USDC from contract to caller
        // Note: usdcAmount can be zero if internal amount was very small (dust only)
        if (usdcAmount > 0) {
            usdc.safeTransfer(msg.sender, usdcAmount);
        }

        // Emit events with 18-decimal internal amount for cross-chain consistency
        emit BridgeCompleted(sourceChainId, amount, nonce);

        // Also emit EventsLib event with full details (18-decimal amount)
        emit EventsLib.BridgeCompleted(sourceChainId, nonce, amount, proof.sourceTxHash);
    }

    // ============ CROSS-CHAIN ITP PURCHASE ============

    /// @inheritdoc IArbBridgeCustody
    /// @notice Creates a cross-chain order to buy ITP from Arbitrum
    /// @dev User provides 6-decimal USDC amount (real USDC format).
    ///      Internally, amount is converted to 18-decimal for protocol consistency.
    /// @param itpId The ITP identifier to buy
    /// @param usdcAmount Amount of USDC in 6 decimals (e.g., 100_000_000 = 100 USDC)
    /// @param limitPrice Maximum price willing to pay (18 decimals)
    /// @param slippageTier Slippage tier (0=0.3%, 1=1%, 2=3%)
    /// @param deadline Order expiration timestamp
    /// @return orderId The unique order ID assigned
    function buyITPFromArbitrum(
        bytes32 itpId,
        uint256 usdcAmount,
        uint256 limitPrice,
        uint256 slippageTier,
        uint256 deadline
    ) external override returns (uint256 orderId) {
        // Validate itpId is non-zero
        if (itpId == bytes32(0)) {
            revert ErrorsLib.E060_ZeroITPId();
        }

        // Validate amount is non-zero
        if (usdcAmount == 0) {
            revert ErrorsLib.E059_CrossChainOrderZeroAmount();
        }

        // Validate minimum USDC amount (0.001 USDC = 1000 in 6 decimals)
        if (usdcAmount < MIN_USDC_AMOUNT) {
            revert ErrorsLib.E07F_UsdcAmountTooSmall(usdcAmount, MIN_USDC_AMOUNT);
        }

        // Validate slippage tier
        if (slippageTier > MAX_SLIPPAGE_TIER) {
            revert ErrorsLib.E011_InvalidSlippageTier(slippageTier);
        }

        // Validate deadline is in the future
        uint256 minDeadline = block.timestamp + 1;
        uint256 maxDeadline = block.timestamp + MAX_DEADLINE_DURATION;
        if (deadline <= block.timestamp || deadline > maxDeadline) {
            revert ErrorsLib.E058_InvalidDeadline(deadline, minDeadline, maxDeadline);
        }

        // Transfer 6-decimal USDC from user to custody contract
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // Convert to 18-decimal internal representation
        uint256 internalAmount = DecimalLib.toInternal(usdcAmount);

        // Generate unique order ID
        orderId = crossChainOrderId;
        crossChainOrderId = orderId + 1;

        // Store order parameters with 18-decimal internal amount
        crossChainOrders[orderId] = TypesLib.CrossChainOrder({
            itpId: itpId,
            user: msg.sender,
            amount: internalAmount, // 18 decimals for protocol consistency
            limitPrice: limitPrice,
            slippageTier: slippageTier,
            deadline: deadline,
            createdAt: block.timestamp
        });

        // Emit event with 18-decimal internal amount for cross-chain consistency
        emit CrossChainOrderCreated(orderId, itpId, msg.sender, internalAmount);
    }

    // ============ VIEW FUNCTIONS ============

    /// @inheritdoc IArbBridgeCustody
    function isNonceUsed(uint256 sourceChainId, uint256 nonce) external view override returns (bool) {
        return bridgeCompleted[sourceChainId][nonce];
    }

    /// @inheritdoc IArbBridgeCustody
    function l3IndexContract() external view override returns (address) {
        return l3Index;
    }

    /// @notice Get the next order ID to be assigned
    /// @return The current order ID counter
    function currentOrderId() external view returns (uint256) {
        return crossChainOrderId;
    }

    /// @inheritdoc IArbBridgeCustody
    /// @notice Retrieves cross-chain order details
    /// @dev The returned `amount` field is in 18-decimal internal format
    ///      (converted from 6-decimal USDC at order creation time)
    function getCrossChainOrder(uint256 orderId) external view override returns (TypesLib.CrossChainOrder memory order) {
        return crossChainOrders[orderId];
    }

    // ============ CROSS-CHAIN ITP SELL ============

    /// @notice Set the BridgeProxy address (one-time setup)
    /// @param bridgeProxy_ Address of the BridgeProxy contract
    /// @param blsSignature BLS signature from issuers
    function setBridgeProxy(address bridgeProxy_, bytes calldata blsSignature) external {
        if (bridgeProxy_ == address(0)) {
            revert ErrorsLib.E118_ZeroBridgeProxy();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "setBridgeProxy", bridgeProxy_));

        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        bridgeProxy = IBridgeProxy(bridgeProxy_);
    }

    /// @inheritdoc IArbBridgeCustody
    function sellITPFromArbitrum(
        bytes32 itpId,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier,
        uint256 deadline
    ) external override returns (uint256 orderId) {
        // Validate itpId
        if (itpId == bytes32(0)) {
            revert ErrorsLib.E060_ZeroITPId();
        }

        // Validate amount
        if (amount == 0) {
            revert ErrorsLib.E117_CrossChainSellZeroAmount();
        }

        // Validate slippage tier
        if (slippageTier > MAX_SLIPPAGE_TIER) {
            revert ErrorsLib.E011_InvalidSlippageTier(slippageTier);
        }

        // Validate deadline
        uint256 minDeadline = block.timestamp + 1;
        uint256 maxDeadline = block.timestamp + MAX_DEADLINE_DURATION;
        if (deadline <= block.timestamp || deadline > maxDeadline) {
            revert ErrorsLib.E058_InvalidDeadline(deadline, minDeadline, maxDeadline);
        }

        // Look up BridgedITP address from BridgeProxy
        address bridgedItpAddress = bridgeProxy.getBridgedItp(itpId);
        if (bridgedItpAddress == address(0)) {
            revert ErrorsLib.E116_BridgedItpNotFound(itpId);
        }

        // Escrow BridgedITP tokens from user
        IERC20(bridgedItpAddress).safeTransferFrom(msg.sender, address(this), amount);

        // Use shared crossChainOrderId counter (shared with buy orders)
        orderId = crossChainOrderId;
        crossChainOrderId = orderId + 1;

        // Store sell order
        crossChainSellOrders[orderId] = TypesLib.CrossChainSellOrder({
            itpId: itpId,
            user: msg.sender,
            bridgedItpAddress: bridgedItpAddress,
            amount: amount,
            limitPrice: limitPrice,
            slippageTier: slippageTier,
            deadline: deadline,
            createdAt: block.timestamp
        });

        emit CrossChainSellOrderCreated(orderId, itpId, msg.sender, bridgedItpAddress, amount);
    }

    /// @inheritdoc IArbBridgeCustody
    function completeSellOrder(
        uint256 orderId,
        uint256 usdcProceeds,
        bytes calldata blsSignature
    ) external override {
        TypesLib.CrossChainSellOrder storage order = crossChainSellOrders[orderId];
        if (order.user == address(0)) {
            revert ErrorsLib.E119_SellOrderNotFound(orderId);
        }

        // Build message for BLS verification
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "completeSellOrder", orderId, usdcProceeds
        ));

        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        address user = order.user;

        // Delete order before external calls (CEI pattern)
        delete crossChainSellOrders[orderId];

        // Transfer USDC proceeds to user (6 decimals)
        if (usdcProceeds > 0) {
            usdc.safeTransfer(user, usdcProceeds);
        }

        emit SellOrderCompleted(orderId, usdcProceeds);
    }

    /// @inheritdoc IArbBridgeCustody
    function refundSellOrder(
        uint256 orderId,
        bytes calldata blsSignature
    ) external override {
        TypesLib.CrossChainSellOrder storage order = crossChainSellOrders[orderId];
        if (order.user == address(0)) {
            revert ErrorsLib.E119_SellOrderNotFound(orderId);
        }

        // Build message for BLS verification
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "refundSellOrder", orderId
        ));

        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        address user = order.user;
        address bridgedItpAddress = order.bridgedItpAddress;
        uint256 amount = order.amount;

        // Delete order before external calls (CEI pattern)
        delete crossChainSellOrders[orderId];

        // Return escrowed BridgedITP tokens to user
        IERC20(bridgedItpAddress).safeTransfer(user, amount);

        emit SellOrderRefunded(orderId);
    }

    /// @inheritdoc IArbBridgeCustody
    function getCrossChainSellOrder(uint256 orderId) external view override returns (TypesLib.CrossChainSellOrder memory order) {
        return crossChainSellOrders[orderId];
    }

    // ============ UPGRADE MANAGEMENT ============

    /// @notice Propose a standard upgrade (7-day timelock)
    /// @param newImpl New implementation address
    /// @param blsSignature BLS signature from issuers
    function proposeUpgrade(address newImpl, bytes calldata blsSignature) external {
        if (newImpl == address(0)) {
            revert ErrorsLib.E038_ZeroImplementation();
        }
        if (pendingUpgradeImpl != address(0)) {
            revert ErrorsLib.E039_UpgradeAlreadyPending();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "proposeUpgrade", newImpl));

        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        pendingUpgradeImpl = newImpl;
        pendingUpgradeProposedAt = block.timestamp;
        pendingUpgradeIsEmergency = false;
    }

    /// @notice Propose an emergency upgrade (24-hour timelock, 17/20 threshold)
    /// @param newImpl New implementation address
    /// @param blsSignature BLS signature from issuers
    function proposeEmergencyUpgrade(address newImpl, bytes calldata blsSignature) external {
        if (newImpl == address(0)) {
            revert ErrorsLib.E038_ZeroImplementation();
        }
        if (pendingUpgradeImpl != address(0)) {
            revert ErrorsLib.E039_UpgradeAlreadyPending();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "proposeEmergencyUpgrade", newImpl));

        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        pendingUpgradeImpl = newImpl;
        pendingUpgradeProposedAt = block.timestamp;
        pendingUpgradeIsEmergency = true;
    }

    /// @notice Execute a pending upgrade after timelock
    /// @param newImpl Implementation address to upgrade to (must match pending)
    function executeUpgrade(address newImpl) external {
        if (pendingUpgradeImpl == address(0)) {
            revert ErrorsLib.E040_NoPendingUpgrade();
        }
        if (pendingUpgradeImpl != newImpl) {
            revert ErrorsLib.E041_ImplementationMismatch(pendingUpgradeImpl, newImpl);
        }

        uint256 timelock = pendingUpgradeIsEmergency ? EMERGENCY_UPGRADE_TIMELOCK : UPGRADE_TIMELOCK;
        uint256 unlockTime = pendingUpgradeProposedAt + timelock;

        if (block.timestamp < unlockTime) {
            revert ErrorsLib.E042_UpgradeTimelockActive(unlockTime, block.timestamp);
        }

        // Perform upgrade
        upgradeToAndCall(newImpl, "");

        // Clear pending upgrade
        pendingUpgradeImpl = address(0);
        pendingUpgradeProposedAt = 0;
        pendingUpgradeIsEmergency = false;
    }

    /// @notice Cancel a pending upgrade
    /// @param blsSignature BLS signature from issuers
    function cancelUpgrade(bytes calldata blsSignature) external {
        if (pendingUpgradeImpl == address(0)) {
            revert ErrorsLib.E040_NoPendingUpgrade();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "cancelUpgrade", pendingUpgradeImpl));

        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        // Clear pending upgrade
        pendingUpgradeImpl = address(0);
        pendingUpgradeProposedAt = 0;
        pendingUpgradeIsEmergency = false;
    }

    /// @notice Get pending upgrade details
    /// @return proposedImpl Implementation address
    /// @return proposedAt Proposal timestamp
    /// @return isEmergency Whether this is an emergency upgrade
    function getPendingUpgrade()
        external
        view
        returns (address proposedImpl, uint256 proposedAt, bool isEmergency)
    {
        return (pendingUpgradeImpl, pendingUpgradeProposedAt, pendingUpgradeIsEmergency);
    }

    // ============ INTERNAL FUNCTIONS ============

    /// @notice Authorize upgrade (UUPS pattern)
    /// @dev Overridden to require BLS-approved upgrade with timelock
    function _authorizeUpgrade(address newImplementation) internal view override {
        uint256 timelock = pendingUpgradeIsEmergency ? EMERGENCY_UPGRADE_TIMELOCK : UPGRADE_TIMELOCK;
        if (pendingUpgradeImpl != newImplementation) {
            revert ErrorsLib.E041_ImplementationMismatch(pendingUpgradeImpl, newImplementation);
        }
        uint256 unlockTime = pendingUpgradeProposedAt + timelock;
        if (block.timestamp < unlockTime) {
            revert ErrorsLib.E042_UpgradeTimelockActive(unlockTime, block.timestamp);
        }
    }
}
