// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../interfaces/IBridge.sol";
import "../interfaces/IOracleRegistry.sol";
import "../libraries/BLSLib.sol";
import "../libraries/BLSVerifier.sol";
import "../libraries/DecimalLib.sol";
import "../libraries/ErrorsLib.sol";
import "../libraries/EventsLib.sol";
import "../libraries/TypesLib.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IBridgeProxy.sol";

/// @title SettlementBridgeCustody - Settlement destination chain bridge custody
/// @notice Handles releasing USDC on Settlement and cross-chain ITP purchases
/// @dev UUPS upgradeable, deployed on Settlement chain
/// @custom:security-contact security@indexprotocol.com
contract SettlementBridgeCustody is Initializable, UUPSUpgradeable, BLSVerifier, ISettlementBridgeCustody {
    using SafeERC20 for IERC20;

    /// @notice Legacy Vision deposit struct (was in TypesLib, moved here after purge)
    struct VisionDeposit {
        address user;
        uint256 amount;
        uint256 createdAt;
    }

    // ============ CONSTANTS ============

    /// @notice Maximum deadline duration for cross-chain orders (24 hours)
    uint256 public constant MAX_DEADLINE_DURATION = 24 hours;

    /// @notice Maximum slippage tier (0, 1, or 2)
    uint256 public constant MAX_SLIPPAGE_TIER = 2;

    /// @notice Minimum USDC amount (0.001 USDC = 1000 in 6 decimals)
    /// @dev This is the 6-decimal minimum that users must provide
    uint256 public constant MIN_USDC_AMOUNT = 1000;

    /// @notice Minimum sell amount — matches L3 MIN_ORDER_AMOUNT to prevent dust orders
    /// that burn BridgedITP on Settlement but revert on L3, forcing costly remint recovery.
    uint256 public constant MIN_SELL_AMOUNT = 1e15; // 0.001 shares

    /// @notice Minimum delay after burn before remintAndRefundFailedSell is allowed
    /// @dev Gives L3 ample time to finalize. Prevents TOCTOU with stale L3 view.
    uint256 public constant MIN_REMINT_DELAY = 1 hours;

    /// @notice Standard operation threshold (11/20)
    uint256 public constant STANDARD_THRESHOLD = 11;

    /// @notice Upgrade timelock duration (7 days)
    uint256 public constant UPGRADE_TIMELOCK = 7 days;

    /// @notice Emergency upgrade timelock duration (24 hours)
    uint256 public constant EMERGENCY_UPGRADE_TIMELOCK = 24 hours;

    // ============ STORAGE ============

    /// @notice Reference to OracleRegistry for BLS key verification
    IOracleRegistry public oracleRegistry;

    /// @notice USDC token contract
    IERC20 public usdc;

    /// @notice L3 Investment contract address reference
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

    // ============ VISION DEPOSIT/WITHDRAW STATE ============

    /// @notice Vision deposit tracking: orderId => deposit details
    mapping(uint256 => VisionDeposit) public visionDeposits;

    /// @notice Replay protection for Vision withdrawals
    mapping(uint256 => bool) public withdrawProcessed;

    /// @notice Timeout before a vision deposit can be refunded (2 hours)
    uint256 public constant REFUND_TIMEOUT = 7200;

    /// @notice Tracks completed vision deposits (prevents refund after completion)
    mapping(uint256 => bool) public depositCompleted;

    /// @notice USDC reserve tracker for Vision pool (6 decimals, tracks Settlement-side USDC)
    uint256 public visionReserve;

    /// @notice Pending mints: orderId => mint data needed for crash recovery
    /// @dev Written in completeBuyOrder, queried by oracles on restart to find un-minted orders
    mapping(uint256 => TypesLib.PendingMint) public pendingMints;

    /// @notice Admin address for registry updates and emergency operations
    address public custodyAdmin;

    /// @notice Storage gap for future upgrades
    /// @dev Used: oracleRegistry, usdc, l3Index, bridgeCompleted, crossChainOrderId,
    ///      crossChainOrders, pendingUpgradeImpl, pendingUpgradeProposedAt, pendingUpgradeIsEmergency,
    ///      bridgeProxy, crossChainSellOrders, visionDeposits, withdrawProcessed, visionReserve,
    ///      pendingMints, custodyAdmin = 16 slots
    uint256[34] private __gap;

    // ============ INITIALIZER ============

    /// @notice Initialize the SettlementBridgeCustody contract
    /// @param oracleRegistry_ Address of the OracleRegistry contract
    /// @param usdc_ Address of the USDC token contract
    /// @param l3Index_ Address of the L3 Investment contract
    /// @param bridgeProxy_ Address of the BridgeProxy contract (set at deploy, BLS-gated after)
    function initialize(address oracleRegistry_, address usdc_, address l3Index_, address bridgeProxy_) external initializer {
        __UUPSUpgradeable_init();
        if (oracleRegistry_ == address(0)) {
            revert ErrorsLib.E043_ZeroOracleRegistry();
        }
        if (usdc_ == address(0)) {
            revert ErrorsLib.E050_ZeroUSDCAddress();
        }
        if (l3Index_ == address(0)) {
            revert ErrorsLib.E056_ZeroL3IndexAddress();
        }
        oracleRegistry = IOracleRegistry(oracleRegistry_);
        __BLSVerifier_init(oracleRegistry_);
        usdc = IERC20(usdc_);
        l3Index = l3Index_;
        custodyAdmin = msg.sender;
        if (bridgeProxy_ != address(0)) {
            bridgeProxy = IBridgeProxy(bridgeProxy_);
        }
    }

    /// @notice Update the oracle registry used for BLS verification
    /// @dev Admin-only, allows fixing registry pointer without full upgrade
    function setOracleRegistry(address newRegistry) external {
        if (msg.sender != custodyAdmin) revert ErrorsLib.E043_ZeroOracleRegistry();
        if (newRegistry == address(0)) revert ErrorsLib.E043_ZeroOracleRegistry();
        oracleRegistry = IOracleRegistry(newRegistry);
        __BLSVerifier_init(newRegistry);
    }

    // ============ BRIDGE COMPLETION ============

    /// @inheritdoc ISettlementBridgeCustody
    /// @notice Completes a bridge transfer from L3 to Settlement
    /// @dev The `amount` parameter is in 18-decimal internal format (from L3).
    ///      The actual USDC transfer uses 6-decimal format (real USDC).
    ///      Events emit 18-decimal amounts for cross-chain consistency.
    /// @param sourceChainId The source chain ID (L3)
    /// @param amount Amount in 18-decimal internal format
    /// @param nonce Unique nonce for this bridge operation
    /// @param proof Proof of the lock on source chain
    /// @param blsSignature BLS signature from oracles
    function completeBridge(
        uint256 sourceChainId,
        uint256 amount,
        uint256 nonce,
        TypesLib.ReleaseProof calldata proof,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
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
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

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

    /// @inheritdoc ISettlementBridgeCustody
    /// @notice Creates a cross-chain order to buy ITP from Settlement
    /// @dev User provides 6-decimal USDC amount (real USDC format).
    ///      Internally, amount is converted to 18-decimal for protocol consistency.
    /// @param itpId The ITP identifier to buy
    /// @param usdcAmount Amount of USDC in 6 decimals (e.g., 100_000_000 = 100 USDC)
    /// @param limitPrice Maximum price willing to pay (18 decimals)
    /// @param slippageTier Slippage tier (0=0.3%, 1=1%, 2=3%)
    /// @param deadline Order expiration timestamp
    /// @return orderId The unique order ID assigned
    function buyITPFromSettlement(
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

    // ============ BUY/SELL ORDER CUSTODY ============

    /// @inheritdoc ISettlementBridgeCustody
    function completeBuyOrder(
        uint256 orderId,
        address vault,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override {
        TypesLib.CrossChainOrder storage order = crossChainOrders[orderId];
        if (order.user == address(0)) revert ErrorsLib.E125_BuyOrderNotFound(orderId);

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "completeBuyOrder", orderId, vault
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Store pending mint data BEFORE deleting order — crash recovery anchor.
        // Oracles query this on restart to find CBO'd orders that still need minting.
        pendingMints[orderId] = TypesLib.PendingMint({
            itpId: order.itpId,
            user: order.user,
            amount: order.amount
        });

        uint256 internalAmount = order.amount;
        delete crossChainOrders[orderId];

        uint256 usdcAmount = DecimalLib.toUsdc(internalAmount);
        if (usdcAmount > 0) usdc.safeTransfer(vault, usdcAmount);

        emit BuyOrderCompleted(orderId, vault, usdcAmount);
    }

    /// @notice Clear pending mint after successful mintBridgedShares
    /// @dev Only succeeds if mint has been processed on BridgeProxy.
    ///      Prevents griefing of crash recovery by requiring proof that
    ///      the mint actually happened before allowing deletion.
    /// @param orderId The order whose pending mint to clear
    function clearPendingMint(uint256 orderId) external {
        if (!IBridgeProxy(bridgeProxy).mintProcessed(orderId)) {
            revert ErrorsLib.E142_MintNotYetProcessed(orderId);
        }
        delete pendingMints[orderId];
    }

    /// @inheritdoc ISettlementBridgeCustody
    function refundBuyOrder(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override {
        TypesLib.CrossChainOrder storage order = crossChainOrders[orderId];
        if (order.user == address(0)) revert ErrorsLib.E125_BuyOrderNotFound(orderId);

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "refundBuyOrder", orderId
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        address user = order.user;
        uint256 internalAmount = order.amount;

        // Delete order before external calls (CEI pattern)
        delete crossChainOrders[orderId];

        uint256 usdcAmount = DecimalLib.toUsdc(internalAmount);
        if (usdcAmount > 0) usdc.safeTransfer(user, usdcAmount);

        emit BuyOrderRefunded(orderId, user, usdcAmount);
    }

    // ============ VIEW FUNCTIONS ============

    /// @inheritdoc ISettlementBridgeCustody
    function isNonceUsed(uint256 sourceChainId, uint256 nonce) external view override returns (bool) {
        return bridgeCompleted[sourceChainId][nonce];
    }

    /// @inheritdoc ISettlementBridgeCustody
    function l3IndexContract() external view override returns (address) {
        return l3Index;
    }

    /// @notice Get the next order ID to be assigned
    /// @return The current order ID counter
    function currentOrderId() external view returns (uint256) {
        return crossChainOrderId;
    }

    /// @inheritdoc ISettlementBridgeCustody
    /// @notice Retrieves cross-chain order details
    /// @dev The returned `amount` field is in 18-decimal internal format
    ///      (converted from 6-decimal USDC at order creation time)
    function getCrossChainOrder(uint256 orderId) external view override returns (TypesLib.CrossChainOrder memory order) {
        return crossChainOrders[orderId];
    }

    // ============ CROSS-CHAIN ITP SELL ============

    /// @notice Set the BridgeProxy address (one-time setup)
    /// @param bridgeProxy_ Address of the BridgeProxy contract
    /// @param blsSignature BLS signature from oracles
    function setBridgeProxy(address bridgeProxy_, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        if (bridgeProxy_ == address(0)) {
            revert ErrorsLib.E118_ZeroBridgeProxy();
        }
        // One-shot: cannot overwrite once set (prevents BLS-quorum proxy hijack)
        if (address(bridgeProxy) != address(0)) {
            revert ErrorsLib.E143_BridgeProxyAlreadySet();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "setBridgeProxy", bridgeProxy_));

        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        bridgeProxy = IBridgeProxy(bridgeProxy_);
    }

    /// @inheritdoc ISettlementBridgeCustody
    function sellITPFromSettlement(
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

        // Validate minimum sell amount (prevents dust orders that burn BridgedITP but revert on L3)
        if (amount < MIN_SELL_AMOUNT) {
            revert ErrorsLib.E152_BelowMinSellAmount(amount, MIN_SELL_AMOUNT);
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
            createdAt: block.timestamp,
            burned: false,
            burnedAt: 0
        });

        emit CrossChainSellOrderCreated(orderId, itpId, msg.sender, bridgedItpAddress, amount, limitPrice);
    }

    /// @inheritdoc ISettlementBridgeCustody
    function completeSellOrder(
        uint256 orderId,
        uint256 usdcProceeds,
        address vault,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override {
        TypesLib.CrossChainSellOrder storage order = crossChainSellOrders[orderId];
        if (order.user == address(0)) {
            revert ErrorsLib.E119_SellOrderNotFound(orderId);
        }
        // v5: BridgedITP must already be burned via burnSellOrderShares
        if (!order.burned) revert ErrorsLib.E148_SellSharesNotBurned(orderId);

        // Build message for BLS verification (includes vault for atomic fund+complete)
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "completeSellOrder", orderId, usdcProceeds, vault
        ));

        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        address user = order.user;

        // Delete order before external calls (CEI pattern)
        delete crossChainSellOrders[orderId];

        // Transfer USDC proceeds from vault directly to user (6 decimals)
        // BridgedITP was already burned in burnSellOrderShares — no burn needed here.
        if (usdcProceeds > 0) {
            usdc.safeTransferFrom(vault, user, usdcProceeds);
        }

        emit SellOrderCompleted(orderId, usdcProceeds);
    }

    /// @inheritdoc ISettlementBridgeCustody
    function refundSellOrder(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override {
        TypesLib.CrossChainSellOrder storage order = crossChainSellOrders[orderId];
        if (order.user == address(0)) {
            revert ErrorsLib.E119_SellOrderNotFound(orderId);
        }
        // v5: Cannot refund after burn — BridgedITP is destroyed. Use remintAndRefundFailedSell instead.
        if (order.burned) revert ErrorsLib.E147_SellOrderAlreadyBurned(orderId);

        // Build message for BLS verification
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "refundSellOrder", orderId
        ));

        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        address user = order.user;
        address bridgedItpAddress = order.bridgedItpAddress;
        uint256 amount = order.amount;

        // Delete order before external calls (CEI pattern)
        delete crossChainSellOrders[orderId];

        // Return escrowed BridgedITP tokens to user
        IERC20(bridgedItpAddress).safeTransfer(user, amount);

        emit SellOrderRefunded(orderId);
    }

    /// @inheritdoc ISettlementBridgeCustody
    function burnSellOrderShares(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override {
        TypesLib.CrossChainSellOrder storage order = crossChainSellOrders[orderId];
        if (order.user == address(0)) revert ErrorsLib.E119_SellOrderNotFound(orderId);
        if (order.burned) revert ErrorsLib.E147_SellOrderAlreadyBurned(orderId);

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "burnSellOrderShares", orderId
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        order.burned = true;
        order.burnedAt = block.timestamp;

        // Burn the escrowed BridgedITP via BridgeProxy
        IBridgeProxy(bridgeProxy).burnFromCustody(order.itpId, address(this), order.amount);

        emit SellOrderSharesBurned(orderId, order.itpId, order.amount);
    }

    /// @inheritdoc ISettlementBridgeCustody
    function remintAndRefundFailedSell(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override {
        TypesLib.CrossChainSellOrder storage order = crossChainSellOrders[orderId];
        if (order.user == address(0)) revert ErrorsLib.E119_SellOrderNotFound(orderId);
        if (!order.burned) revert ErrorsLib.E148_SellSharesNotBurned(orderId);

        // Enforce minimum delay after burn before allowing remint
        if (block.timestamp < order.burnedAt + MIN_REMINT_DELAY) {
            revert ErrorsLib.E151_RemintTooEarly(orderId, order.burnedAt + MIN_REMINT_DELAY);
        }

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "remintAndRefundFailedSell", orderId
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Cache before delete
        address user = order.user;
        bytes32 itpId = order.itpId;
        uint256 amount = order.amount;

        // Delete order FIRST — prevents any replay (refund, burn, remint all revert with E119)
        delete crossChainSellOrders[orderId];

        // Mint BridgedITP directly to user (NOT to custody)
        IBridgeProxy(bridgeProxy).mintFromCustody(itpId, user, amount);

        emit SellOrderReminted(orderId, itpId, amount);
    }

    /// @inheritdoc ISettlementBridgeCustody
    function getCrossChainSellOrder(uint256 orderId) external view override returns (TypesLib.CrossChainSellOrder memory order) {
        return crossChainSellOrders[orderId];
    }

    // ============ VISION DEPOSIT/WITHDRAW ============

    // ---- Legacy Vision deposit/withdraw (retained for existing settlement users) ----

    event VisionDepositCreated(uint256 indexed orderId, address indexed user, uint256 amount);
    event VisionDepositCompleted(uint256 indexed orderId);
    event VisionDepositRefunded(uint256 indexed orderId, address indexed user, uint256 usdcAmount);
    event VisionWithdrawCompleted(uint256 indexed withdrawId, address indexed user, uint256 usdcAmount);

    function depositToVision(uint256 usdcAmount) external returns (uint256 orderId) {
        if (usdcAmount < MIN_USDC_AMOUNT) {
            revert ErrorsLib.E07F_UsdcAmountTooSmall(usdcAmount, MIN_USDC_AMOUNT);
        }

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        uint256 internalAmount = DecimalLib.toInternal(usdcAmount);
        visionReserve += usdcAmount;

        orderId = crossChainOrderId;
        crossChainOrderId = orderId + 1;

        visionDeposits[orderId] = VisionDeposit({
            user: msg.sender,
            amount: internalAmount,
            createdAt: block.timestamp
        });

        emit VisionDepositCreated(orderId, msg.sender, internalAmount);
    }

    function completeVisionDeposit(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        VisionDeposit storage dep = visionDeposits[orderId];
        if (dep.user == address(0)) revert ErrorsLib.E131_VisionDepositNotFound(orderId);

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "completeVisionDeposit", orderId
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        depositCompleted[orderId] = true;
        delete visionDeposits[orderId];

        emit VisionDepositCompleted(orderId);
    }

    function refundVisionDeposit(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        // Defense-in-depth: reject refund if deposit was already completed (even though
        // completeVisionDeposit deletes the struct, this guards against edge cases)
        if (depositCompleted[orderId]) revert ErrorsLib.E131_VisionDepositNotFound(orderId);
        VisionDeposit storage dep = visionDeposits[orderId];
        if (dep.user == address(0)) revert ErrorsLib.E131_VisionDepositNotFound(orderId);
        if (block.timestamp - dep.createdAt <= REFUND_TIMEOUT) revert ErrorsLib.E153_RefundTooEarly(orderId);

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "refundVisionDeposit", orderId
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        address user = dep.user;
        uint256 usdcAmount = DecimalLib.toUsdc(dep.amount);

        // Delete before external calls (CEI pattern)
        delete visionDeposits[orderId];

        if (usdcAmount > visionReserve) usdcAmount = visionReserve; // truncation guard
        visionReserve -= usdcAmount;

        if (usdcAmount > 0) {
            usdc.safeTransfer(user, usdcAmount);
        }

        emit VisionDepositRefunded(orderId, user, usdcAmount);
    }

    function completeVisionWithdraw(
        uint256 withdrawId,
        address user,
        uint256 amount,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        if (withdrawProcessed[withdrawId]) revert ErrorsLib.E132_VisionWithdrawAlreadyProcessed(withdrawId);

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "completeVisionWithdraw",
            withdrawId, user, amount
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        withdrawProcessed[withdrawId] = true;

        uint256 usdcAmount = DecimalLib.toUsdc(amount);
        if (usdcAmount > visionReserve) usdcAmount = visionReserve; // truncation guard
        visionReserve -= usdcAmount;

        if (usdcAmount > 0) {
            usdc.safeTransfer(user, usdcAmount); // sends to USER, not msg.sender
        }

        emit VisionWithdrawCompleted(withdrawId, user, usdcAmount);
    }

    function getVisionDeposit(uint256 orderId) external view returns (address user, uint256 amount, uint256 createdAt) {
        VisionDeposit storage dep = visionDeposits[orderId];
        return (dep.user, dep.amount, dep.createdAt);
    }

    // ============ UPGRADE MANAGEMENT ============

    /// @notice Propose a standard upgrade (7-day timelock)
    /// @param newImpl New implementation address
    /// @param blsSignature BLS signature from oracles
    function proposeUpgrade(address newImpl, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        if (newImpl == address(0)) {
            revert ErrorsLib.E038_ZeroImplementation();
        }
        if (pendingUpgradeImpl != address(0)) {
            revert ErrorsLib.E039_UpgradeAlreadyPending();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "proposeUpgrade", newImpl));

        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        pendingUpgradeImpl = newImpl;
        pendingUpgradeProposedAt = block.timestamp;
        pendingUpgradeIsEmergency = false;
    }

    /// @notice Propose an emergency upgrade (24-hour timelock, 17/20 threshold)
    /// @param newImpl New implementation address
    /// @param blsSignature BLS signature from oracles
    function proposeEmergencyUpgrade(address newImpl, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        if (newImpl == address(0)) {
            revert ErrorsLib.E038_ZeroImplementation();
        }
        if (pendingUpgradeImpl != address(0)) {
            revert ErrorsLib.E039_UpgradeAlreadyPending();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "proposeEmergencyUpgrade", newImpl));

        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

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
    /// @param blsSignature BLS signature from oracles
    function cancelUpgrade(bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        if (pendingUpgradeImpl == address(0)) {
            revert ErrorsLib.E040_NoPendingUpgrade();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "cancelUpgrade", pendingUpgradeImpl));

        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

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
