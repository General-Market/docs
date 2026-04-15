// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../interfaces/IInvestment.sol";
import "../interfaces/IGovernance.sol";
import "../interfaces/IOracleRegistry.sol";
import "../libraries/TypesLib.sol";
import "../libraries/ErrorsLib.sol";
import "../libraries/EventsLib.sol";
import "../libraries/BLSVerifier.sol";
import "../libraries/DecimalLib.sol";
import "../libraries/RebalanceLib.sol";
import "../libraries/AdminLib.sol";
import "./InvestmentStorage.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Investment - Main contract for order submission and ITP management
/// @notice Central contract for submitting limit orders and managing Index Token Products
/// @dev UUPS upgradeable proxy pattern, all monetary values use 18 decimals
/// @custom:security-contact security@indexprotocol.com
contract Investment is InvestmentStorage, Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable, BLSVerifier, IInvestment {
    using SafeERC20 for IERC20;

    // ============ CONSTANTS ============

    /// @notice Minimum order amount (0.001 USDC with 18 decimals)
    uint256 public constant MIN_ORDER_AMOUNT = 1e15;

    /// @notice Maximum deadline duration (24 hours)
    uint256 public constant MAX_DEADLINE_DURATION = 24 hours;

    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Weight must sum to 1e18 (100%)
    uint256 public constant WEIGHT_SUM = 1e18;

    /// @notice Minimum weight per asset: 0.25% = 25e14
    uint256 public constant MIN_WEIGHT = 25e14;

    /// @notice Minimum shares that must result from a fill (prevents dust attacks)
    uint256 public constant MIN_SHARES = 1e12;

    /// @notice Maximum assets per ITP (prevents gas griefing via O(n²) duplicate check)
    uint256 public constant MAX_ASSETS = 1000;

    /// @notice Grace period after order deadline before permissionless claim is allowed
    /// @dev 24 hours gives AP and oracles ample time to process normally.
    ///      After deadline + EXPIRY_GRACE_PERIOD, anyone can trigger the refund.
    uint256 public constant EXPIRY_GRACE_PERIOD = 24 hours;

    // Storage is inherited from InvestmentStorage.sol

    // ============ INITIALIZER ============

    /// @notice Initialize the Investment contract
    /// @param governance_ Address of the Governance contract
    /// @param usdc_ Address of the USDC token (must be 18 decimals on L3)
    function initialize(address governance_, address usdc_) external initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        // Validate L3 USDC has 18 decimals (internal protocol standard)
        uint8 usdcDecimals = IERC20Metadata(usdc_).decimals();
        if (usdcDecimals != DecimalLib.INTERNAL_DECIMALS) {
            revert ErrorsLib.E080_InvalidUsdcDecimals(usdcDecimals, DecimalLib.INTERNAL_DECIMALS);
        }

        governance = IGovernance(governance_);
        usdc = IERC20(usdc_);
        nextOrderId = 1; // Start from 1, 0 reserved for "no order"
        deploymentNonce = 1;
    }

    /// @notice Reset order state after a full redeploy to the same proxy address.
    /// Clears stale orders, cycles, and timestamps from the previous deployment.
    function resetOrderState() external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        // Clear orders and cycle state — cover range up to 50 (handles multiple resets)
        uint256 maxId = nextOrderId > 50 ? nextOrderId : 50;
        for (uint256 i = 1; i <= maxId; i++) {
            delete orders[i];
            delete cycleProcessed[i + 500_000_000];
            delete batchedTimestamp[i];
        }
        nextOrderId = 1;
        lastProcessedCycleNumber = 0;
    }

    // ============ DEPLOYMENT TRACKING ============

    event DeploymentNonceUpdated(uint256 newNonce);

    /// @notice Increment deployment nonce. Call after any deploy that changes contract state.
    /// @dev Only callable by governance admin — uses inline check (no onlyGovernance modifier).
    function bumpDeploymentNonce() external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        deploymentNonce++;
        emit DeploymentNonceUpdated(deploymentNonce);
    }

    /// @notice Set the OracleRegistry address (admin only, one-time setup)
    /// @param oracleRegistry_ Address of the OracleRegistry contract
    function setOracleRegistry(address oracleRegistry_) external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        if (address(oracleRegistry) != address(0)) {
            revert ErrorsLib.E062_AlreadyInitialized();
        }
        oracleRegistry = IOracleRegistry(oracleRegistry_);
        __BLSVerifier_init(oracleRegistry_);
    }

    /// @notice Set the ITP vault address for an ITP (admin only)
    /// @param itpId The ITP identifier
    /// @param vault The vault address
    function setITPVault(bytes32 itpId, address vault) external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        if (!_itpExists[itpId]) {
            revert ErrorsLib.E006_ITPNotFound(itpId);
        }
        // Clear old reverse mapping on vault change
        address oldVault = itpVaults[itpId];
        if (oldVault != address(0)) {
            delete _vault2Id[oldVault];
        }
        itpVaults[itpId] = vault;
        _vault2Id[vault] = itpId;
    }

    function syncVaultBalance(bytes32 itpId, address u) external {
        address v = itpVaults[itpId]; uint256 d = _userShares[itpId][u] - IERC20(v).balanceOf(u);
        if (d > 0) { (bool ok,) = v.call(abi.encodeWithSignature("mint(address,uint256)", u, d)); require(ok, "SV"); }
    }

    /// @notice Set the FeeRegistry address (admin only)
    /// @param feeRegistry_ Address of the FeeRegistry contract
    function setFeeRegistry(address feeRegistry_) external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        feeRegistry = IFeeRegistry(feeRegistry_);
    }

    /// @notice Set the authorized bridge contract (admin only)
    /// @param bridge The bridge contract address
    function setAuthorizedBridge(address bridge) external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        emit EventsLib.AuthorizedBridgeUpdated(authorizedBridge, bridge);
        authorizedBridge = bridge;
    }

    // ============ ORDER FUNCTIONS ============

    /// @inheritdoc IInvestment
    function submitOrder(
        bytes32 itpId,
        TypesLib.Side side,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier,
        uint256 deadline
    ) external nonReentrant returns (uint256 orderId) {
        return _createOrder(msg.sender, msg.sender, itpId, side, amount, limitPrice, slippageTier, deadline);
    }

    /// @inheritdoc IInvestment
    function submitOrderFor(
        address beneficiary,
        bytes32 itpId,
        TypesLib.Side side,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier,
        uint256 deadline
    ) external nonReentrant returns (uint256 orderId) {
        // Only registered active oracles can submit on behalf of users
        if (address(oracleRegistry) == address(0) || !oracleRegistry.isActiveOracle(msg.sender)) {
            revert ErrorsLib.E097_NotActiveOracle(msg.sender);
        }
        if (beneficiary == address(0)) {
            revert ErrorsLib.E098_ZeroBeneficiary();
        }
        // payer = msg.sender (oracle holds bridged funds), user = beneficiary (shares go to user)
        return _createOrder(beneficiary, msg.sender, itpId, side, amount, limitPrice, slippageTier, deadline);
    }

    /// @notice Internal shared logic for order creation
    /// @param user The address credited as the order owner (receives shares on BUY, debited on SELL)
    /// @param payer The address that provides USDC for BUY orders (may differ from user in bridge flow)
    function _createOrder(
        address user,
        address payer,
        bytes32 itpId,
        TypesLib.Side side,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier,
        uint256 deadline
    ) internal returns (uint256 orderId) {
        // Check system pause
        if (governance.isPaused()) {
            revert ErrorsLib.E004_SystemPaused();
        }

        // Check ITP exists
        if (!_itpExists[itpId]) {
            revert ErrorsLib.E006_ITPNotFound(itpId);
        }

        // Check ITP pause
        if (governance.isITPPaused(itpId)) {
            revert ErrorsLib.E003_ITPPaused(itpId);
        }

        // Validate minimum amount (global)
        if (amount < MIN_ORDER_AMOUNT) {
            revert ErrorsLib.E001_OrderBelowMin(amount, MIN_ORDER_AMOUNT);
        }

        // Per-asset minimum buy amount check (for BUY orders)
        if (side == TypesLib.Side.BUY && _itpAssets[itpId].length > 0) {
            address primaryAsset = _itpAssets[itpId][0];
            uint256 minAmount = minBuyAmount[primaryAsset];
            if (minAmount > 0 && amount < minAmount) {
                revert ErrorsLib.E082_BelowMinBuyAmount(amount, minAmount);
            }
        }

        // Queue depth check - reject if queue is full
        if (queuePauseThreshold > 0 && pendingOrderCount >= queuePauseThreshold) {
            revert ErrorsLib.E083_QueueFull(pendingOrderCount, queuePauseThreshold);
        }

        // Validate slippage tier (must be 0, 1, or 2)
        if (slippageTier > 2) {
            revert ErrorsLib.E011_InvalidSlippageTier(slippageTier);
        }

        // Validate deadline
        if (deadline <= block.timestamp || deadline > block.timestamp + MAX_DEADLINE_DURATION) {
            revert ErrorsLib.E012_InvalidDeadline(deadline, block.timestamp, MAX_DEADLINE_DURATION);
        }

        if (side == TypesLib.Side.BUY) {
            // BUY: Check payer USDC balance before transfer
            uint256 payerBalance = usdc.balanceOf(payer);
            if (payerBalance < amount) {
                revert ErrorsLib.E002_InsufficientBalance(payer, amount, payerBalance);
            }
        } else {
            // SELL: Check user has enough ITP shares to sell
            uint256 userShares = _userShares[itpId][user];
            if (userShares < amount) {
                revert ErrorsLib.E081_InsufficientShares(user, amount, userShares);
            }
        }

        // Generate order ID
        orderId = nextOrderId;
        unchecked {
            ++nextOrderId;
        }

        // Compute pairId (itpId + first asset index for simplicity)
        bytes32 pairId = keccak256(abi.encode(itpId, uint256(0)));

        // Create and store order — user is the beneficiary, not necessarily msg.sender
        orders[orderId] = TypesLib.LimitOrder({
            id: orderId,
            user: user,
            pairId: pairId,
            side: side,
            amount: amount,
            limitPrice: limitPrice,
            slippageTier: slippageTier,
            deadline: deadline,
            itpId: itpId,
            timestamp: block.timestamp,
            status: TypesLib.OrderStatus.PENDING
        });

        if (side == TypesLib.Side.BUY) {
            // BUY: Transfer USDC from payer to contract
            usdc.safeTransferFrom(payer, address(this), amount);
        } else {
            // SELL: Escrow ITP shares (deduct from user balance AND total supply)
            _userShares[itpId][user] -= amount;
            _itps[itpId].totalSupply -= amount;
        }

        // Increment pending order count (checked arithmetic for safety)
        ++pendingOrderCount;

        // Emit warning if queue depth exceeds warning threshold
        if (queueWarningThreshold > 0 && pendingOrderCount > queueWarningThreshold) {
            emit EventsLib.QueueDepthWarning(pendingOrderCount);
        }

        // Emit event
        emit EventsLib.OrderSubmitted(
            orderId, user, itpId, pairId, uint8(side), amount, limitPrice, slippageTier, deadline
        );
    }

    /// @inheritdoc IInvestment
    function confirmBatch(uint256 cycleNumber, uint256[] calldata orderIds, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        // Check cycle not already processed (replay protection)
        if (cycleProcessed[cycleNumber]) {
            revert ErrorsLib.E019_CycleAlreadyProcessed(cycleNumber);
        }

        // Build message for BLS verification: keccak256(abi.encode(chainid, this, cycleNumber, orderIds))
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), cycleNumber, orderIds));

        // Verify BLS signature against aggregated public key
        // SECURITY: oracleRegistry MUST be set in production. Empty pubkey only allowed for testing.
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Process each order: validate and mark as BATCHED
        for (uint256 i = 0; i < orderIds.length;) {
            uint256 orderId = orderIds[i];
            TypesLib.LimitOrder storage order = orders[orderId];

            // Verify order exists
            if (order.id == 0) {
                revert ErrorsLib.E022_OrderNotFound(orderId);
            }

            // Verify order is in PENDING status
            if (order.status != TypesLib.OrderStatus.PENDING) {
                revert ErrorsLib.E021_OrderAlreadyBatched(orderId);
            }

            // Mark order as batched and record timestamp
            order.status = TypesLib.OrderStatus.BATCHED;
            batchedTimestamp[orderId] = block.timestamp;

            // Emit TradeRequest event for AP to read
            emit EventsLib.TradeRequest(
                cycleNumber,
                order.pairId,
                uint8(order.side),
                order.amount,
                order.limitPrice
            );

            unchecked {
                ++i;
            }
        }

        // Mark cycle as processed
        cycleProcessed[cycleNumber] = true;

        // Track last processed cycle for oracle auto-discovery
        if (cycleNumber > lastProcessedCycleNumber) {
            lastProcessedCycleNumber = cycleNumber;
        }

        // Emit BatchConfirmed event
        emit EventsLib.BatchConfirmed(cycleNumber, orderIds, blsSignature);
    }

    /// @notice Emit per-asset trade instructions after oracle decomposition and cross-ITP netting
    /// @dev No state changes — BLS-authenticated event emission only.
    ///      Oracles decompose ITP orders into per-asset amounts, net same assets across all ITPs,
    ///      then call this to emit AssetTradeRequest events for the AP.
    /// @param cycleNumber The cycle for which trades were decomposed
    /// @param trades Array of netted per-asset trades
    /// @param blsSignature Aggregated BLS signature from oracles
    function emitAssetTrades(
        uint256 cycleNumber,
        TypesLib.AssetTrade[] calldata trades,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        if (!cycleProcessed[cycleNumber]) revert ErrorsLib.E128_CycleNotConfirmed(cycleNumber);
        if (assetTradesEmitted[cycleNumber]) revert ErrorsLib.E019_CycleAlreadyProcessed(cycleNumber);

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "assetTrades", cycleNumber, trades
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        for (uint256 i = 0; i < trades.length;) {
            emit EventsLib.AssetTradeRequest(
                cycleNumber,
                trades[i].asset,
                trades[i].side,
                trades[i].usdcAmount,
                trades[i].price,
                trades[i].quoteToken
            );
            unchecked { ++i; }
        }

        assetTradesEmitted[cycleNumber] = true;
    }

    /// @inheritdoc IInvestment
    function confirmFills(uint256 cycleNumber, TypesLib.Fill[] calldata fills, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external nonReentrant {
        // Build message for BLS verification: keccak256(abi.encode(chainid, this, cycleNumber, fills))
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), cycleNumber, fills));

        // Verify BLS signature against aggregated public key
        // SECURITY: oracleRegistry MUST be set in production. Empty pubkey only allowed for testing.
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Process each fill
        for (uint256 i = 0; i < fills.length;) {
            TypesLib.Fill calldata fill = fills[i];

            // Validate fill cycleNumber matches function parameter (M-2 fix)
            if (fill.cycleNumber != cycleNumber) {
                revert ErrorsLib.E036_FillCycleMismatch(fill.cycleNumber, cycleNumber);
            }

            TypesLib.LimitOrder storage order = orders[fill.orderId];

            // Verify order exists
            if (order.id == 0) {
                revert ErrorsLib.E022_OrderNotFound(fill.orderId);
            }

            // Wave 3.4: Accept both BATCHED and PENDING orders (late fill tolerance)
            // If PENDING, atomically transition to FILLED (confirmBatch may have been skipped/late)
            if (order.status != TypesLib.OrderStatus.BATCHED && order.status != TypesLib.OrderStatus.PENDING) {
                revert ErrorsLib.E024_InvalidOrderStatus(
                    fill.orderId,
                    uint256(order.status),
                    uint256(TypesLib.OrderStatus.BATCHED)
                );
            }

            // Verify fill amount doesn't exceed order amount
            if (fill.fillAmount > order.amount) {
                revert ErrorsLib.E023_FillExceedsOrder(fill.orderId, fill.fillAmount, order.amount);
            }

            // Validate fill price respects order limit price
            if (order.limitPrice > 0) {
                if (order.side == TypesLib.Side.BUY && fill.fillPrice > order.limitPrice) {
                    revert ErrorsLib.E126_FillPriceViolatesLimit(fill.orderId, fill.fillPrice, order.limitPrice, uint8(order.side));
                }
                if (order.side == TypesLib.Side.SELL && fill.fillPrice < order.limitPrice) {
                    revert ErrorsLib.E126_FillPriceViolatesLimit(fill.orderId, fill.fillPrice, order.limitPrice, uint8(order.side));
                }
            }

            // Mark order as filled
            order.status = TypesLib.OrderStatus.FILLED;

            // Decrement pending order count (for both PENDING and BATCHED fills)
            if (pendingOrderCount > 0) {
                unchecked {
                    --pendingOrderCount;
                }
            }

            // Wave 3.1: Per-order resilient fill processing with escrow fallback
            _processFill(fill, order);

            // Emit FillConfirmed event
            emit EventsLib.FillConfirmed(fill.orderId, cycleNumber, fill.fillPrice, fill.fillAmount);

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Process a single fill with escrow fallback on transfer failure
    /// @dev If USDC transfer to user fails, funds are escrowed for later claim
    function _processFill(TypesLib.Fill calldata fill, TypesLib.LimitOrder storage order) internal {
        if (order.side == TypesLib.Side.BUY) {
            // BUY: Calculate shares based on fill price and amount
            if (fill.fillPrice == 0) {
                revert ErrorsLib.E037_ZeroSharesCalculated(fill.fillAmount, fill.fillPrice);
            }
            uint256 shares = (fill.fillAmount * 1e18) / fill.fillPrice;

            // H-3 fix: Ensure minimum shares to prevent dust/rounding attacks
            if (shares < MIN_SHARES) {
                revert ErrorsLib.E037_ZeroSharesCalculated(fill.fillAmount, fill.fillPrice);
            }

            // Update ITP total supply and value
            TypesLib.ITPCore storage itp = _itps[order.itpId];
            itp.totalSupply += shares;
            itp.totalValue += fill.fillAmount;

            // Credit shares to user's internal balance
            _userShares[order.itpId][order.user] += shares;

            // Mint ITP tokens if vault is set
            address vault = itpVaults[order.itpId];
            if (vault != address(0)) {
                (bool success,) = vault.call(abi.encodeWithSignature("mint(address,uint256)", order.user, shares));
                if (!success) {
                    revert ErrorsLib.E063_MintFailed(vault, order.itpId);
                }
            }

            // H-2 fix: Refund remainder on partial fills (with escrow fallback)
            if (fill.fillAmount < order.amount) {
                uint256 remainder = order.amount - fill.fillAmount;
                _safeTransferOrEscrow(fill.orderId, order.user, remainder);
            }
        } else {
            // SELL order: burn escrowed shares and return USDC to user
            uint256 usdcToReturn = (fill.fillAmount * fill.fillPrice) / 1e18;

            TypesLib.ITPCore storage itp = _itps[order.itpId];
            // totalSupply already decremented at escrow (_createOrder SELL path).
            // Only totalValue needs updating here.
            if (itp.totalValue >= usdcToReturn) {
                itp.totalValue -= usdcToReturn;
            }

            // H1 fix: burn ERC4626 shares (mirrors mint in BUY branch)
            address vault = itpVaults[order.itpId];
            if (vault != address(0)) {
                (bool success,) = vault.call(
                    abi.encodeWithSignature("burn(address,uint256)", order.user, fill.fillAmount)
                );
                if (!success) revert ErrorsLib.E063_MintFailed(vault, order.itpId);
            }

            // Transfer USDC back to user (with escrow fallback)
            _safeTransferOrEscrow(fill.orderId, order.user, usdcToReturn);

            // Refund unmatched shares on partial fills
            if (fill.fillAmount < order.amount) {
                uint256 unfilledShares = order.amount - fill.fillAmount;
                _userShares[order.itpId][order.user] += unfilledShares;
                itp.totalSupply += unfilledShares;
            }
        }
    }

    /// @notice Transfer USDC to user, escrow on failure (Wave 3.1)
    /// @dev Uses low-level call to prevent one bad address from reverting entire batch.
    ///      Decodes return data to catch tokens that return false instead of reverting.
    function _safeTransferOrEscrow(uint256 orderId, address user, uint256 amount) internal {
        // Use low-level call so one failed transfer doesn't revert the whole batch
        (bool success, bytes memory returndata) = address(usdc).call(
            abi.encodeWithSelector(IERC20.transfer.selector, user, amount)
        );
        bool transferred = success && (returndata.length == 0 || abi.decode(returndata, (bool)));
        if (!transferred) {
            // Park funds in escrow for user to claim later
            failedFillEscrow[orderId] += amount;
            emit EventsLib.FillFailed(orderId, user, amount);
        }
    }

    /// @notice Claim escrowed funds from a failed fill (Wave 3.1)
    /// @param orderId The order ID with escrowed funds
    function claimFailedFill(uint256 orderId) external nonReentrant {
        uint256 amount = failedFillEscrow[orderId];
        if (amount == 0) {
            revert ErrorsLib.E022_OrderNotFound(orderId);
        }
        TypesLib.LimitOrder storage order = orders[orderId];
        if (order.id == 0) {
            revert ErrorsLib.E022_OrderNotFound(orderId);
        }
        // P2.1: Reject claims on orders that haven't been filled yet
        if (order.status == TypesLib.OrderStatus.PENDING || order.status == TypesLib.OrderStatus.BATCHED) {
            revert ErrorsLib.E024_InvalidOrderStatus(orderId, uint256(order.status), uint256(TypesLib.OrderStatus.FILLED));
        }
        // Only the order's user can claim
        if (msg.sender != order.user) revert ErrorsLib.E129_NotOrderOwner(msg.sender, order.user);

        failedFillEscrow[orderId] = 0;
        usdc.safeTransfer(order.user, amount);

        emit EventsLib.EscrowClaimed(orderId, order.user, amount);
    }

    // ============ USER CANCEL ORDER ============

    /// @notice Cancel a pending order and refund locked collateral
    /// @dev Only the order owner can cancel. Only PENDING orders can be cancelled.
    ///      No BLS consensus required — this is a user-initiated action.
    /// @param orderId The order to cancel
    function cancelOrder(uint256 orderId) external nonReentrant {
        TypesLib.LimitOrder storage order = orders[orderId];

        if (order.id == 0) {
            revert ErrorsLib.E022_OrderNotFound(orderId);
        }

        if (order.user != msg.sender) {
            revert ErrorsLib.E129_NotOrderOwner(msg.sender, order.user);
        }

        if (order.status != TypesLib.OrderStatus.PENDING) {
            revert ErrorsLib.E138_OrderNotCancellable(orderId, uint256(order.status));
        }

        // Set status to CANCELLED
        order.status = TypesLib.OrderStatus.CANCELLED;

        // Decrement pending order count
        if (pendingOrderCount > 0) {
            unchecked {
                --pendingOrderCount;
            }
        }

        // Refund based on order side
        if (order.side == TypesLib.Side.BUY) {
            usdc.safeTransfer(order.user, order.amount);
        } else {
            _userShares[order.itpId][order.user] += order.amount;
            _itps[order.itpId].totalSupply += order.amount;
        }

        emit EventsLib.OrderCancelled(orderId, order.user, order.amount, uint8(order.side));
    }

    /// @inheritdoc IInvestment
    function refundExpiredOrder(uint256 orderId, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        TypesLib.LimitOrder storage order = orders[orderId];

        // Verify order exists
        if (order.id == 0) {
            revert ErrorsLib.E022_OrderNotFound(orderId);
        }

        // M-3 fix: Use correct error for non-expired orders
        if (block.timestamp <= order.deadline) {
            revert ErrorsLib.E034_OrderNotYetExpired(orderId, order.deadline, block.timestamp);
        }

        // Verify order is in PENDING or BATCHED status (whitelist — blocks CANCELLED, FILLED, EXPIRED)
        if (order.status != TypesLib.OrderStatus.PENDING && order.status != TypesLib.OrderStatus.BATCHED) {
            revert ErrorsLib.E024_InvalidOrderStatus(
                orderId,
                uint256(order.status),
                uint256(TypesLib.OrderStatus.PENDING)
            );
        }

        // Build message for BLS verification
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "refund", orderId));

        // Verify BLS signature
        // SECURITY: oracleRegistry MUST be set in production. Empty pubkey only allowed for testing.
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Mark order as expired
        order.status = TypesLib.OrderStatus.EXPIRED;

        // Decrement pending order count
        if (pendingOrderCount > 0) {
            unchecked {
                --pendingOrderCount;
            }
        }

        // Refund based on order side
        if (order.side == TypesLib.Side.BUY) {
            usdc.safeTransfer(order.user, order.amount);
        } else {
            // SELL: restore escrowed shares
            _userShares[order.itpId][order.user] += order.amount;
            _itps[order.itpId].totalSupply += order.amount;
        }

        // M-4 fix: Emit OrderRefunded event
        emit EventsLib.OrderRefunded(orderId, order.user, order.amount);
    }

    // ============ ITP FUNCTIONS ============

    /// @inheritdoc IInvestment
    function createITP(string calldata name, string calldata symbol, uint256[] calldata weights, address[] calldata _assets, uint256[] calldata prices, uint256 bridgeNonce)
        external
        returns (bytes32 itpId)
    {
        // 0. Check system pause
        if (governance.isPaused()) {
            revert ErrorsLib.E004_SystemPaused();
        }
        // Security: admin or registered oracle can create ITPs
        bool isAdmin = msg.sender == governance.admin();
        bool isOracle = address(oracleRegistry) != address(0) && oracleRegistry.isActiveOracle(msg.sender);
        if (!isAdmin && !isOracle) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }

        // Idempotency check: if bridgeNonce was already used, return existing itpId
        // type(uint256).max is the sentinel for non-bridge calls
        if (bridgeNonce != type(uint256).max) {
            bytes32 existingItpId = _bridgeNonceToItpId[bridgeNonce];
            if (existingItpId != bytes32(0)) {
                return existingItpId;
            }
        }

        // 1. Validate array lengths match
        if (weights.length != _assets.length) {
            revert ErrorsLib.E015_LengthMismatch(_assets.length, weights.length);
        }
        if (prices.length != _assets.length) {
            revert ErrorsLib.E015_LengthMismatch(_assets.length, prices.length);
        }
        if (weights.length == 0) {
            revert ErrorsLib.E016_NoAssets();
        }
        if (weights.length > MAX_ASSETS) {
            revert ErrorsLib.E051_TooManyAssets(weights.length, MAX_ASSETS);
        }

        // 2. Validate weights sum to 1e18 and each weight >= MIN_WEIGHT (0.25%)
        uint256 totalWeight;
        for (uint256 i = 0; i < weights.length;) {
            if (weights[i] < MIN_WEIGHT) {
                revert ErrorsLib.E013_WeightBelowMinimum(weights[i], MIN_WEIGHT);
            }
            totalWeight += weights[i];
            unchecked {
                ++i;
            }
        }
        if (totalWeight != WEIGHT_SUM) {
            revert ErrorsLib.E014_InvalidWeightSum(totalWeight, WEIGHT_SUM);
        }

        // 3. Validate assets (no zero addresses, no duplicates)
        for (uint256 i = 0; i < _assets.length;) {
            if (_assets[i] == address(0)) {
                revert ErrorsLib.E018_ZeroAssetAddress();
            }
            // Check for duplicates in the input array
            for (uint256 j = i + 1; j < _assets.length;) {
                if (_assets[i] == _assets[j]) {
                    revert ErrorsLib.E017_DuplicateAsset(_assets[i]);
                }
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }

        // 4. Generate sequential ITP ID (1, 2, 3, ...)
        unchecked {
            ++_itpCount;
        }
        itpId = bytes32(_itpCount);
        _allItpIds.push(itpId);

        // Store bridge nonce mapping for idempotency
        if (bridgeNonce != type(uint256).max) {
            _bridgeNonceToItpId[bridgeNonce] = itpId;
        }

        // Pack name and symbol to bytes32
        bytes32 packedName = _stringToBytes32(name);
        bytes32 packedSymbol = _stringToBytes32(symbol);

        // Store ITP core data
        _itps[itpId] = TypesLib.ITPCore({
            name: packedName,
            symbol: packedSymbol,
            creator: msg.sender,
            createdAt: block.timestamp,
            feeRate: 0, // Default fee rate
            status: uint256(TypesLib.ITPStatus.ACTIVE),
            totalSupply: 0,
            totalValue: 0,
            assetCount: _assets.length
        });

        // Store assets, weights, and compute per-share inventory quantities
        // ITP starts at $1 (1e18). qty[i] = (weight[i] * 1e18) / price[i]
        uint256 INITIAL_PRICE = 1e18;
        for (uint256 i = 0; i < _assets.length;) {
            _itpAssets[itpId].push(_assets[i]);
            _itpWeights[itpId].push(weights[i]);

            uint256 qty = (weights[i] * INITIAL_PRICE) / prices[i];
            _itpInventory[itpId].push(qty);

            unchecked {
                ++i;
            }
        }

        _itpExists[itpId] = true;

        // Set initial ITP NAV to $1
        _itpNavs[itpId] = 1e18;

        // Register ITP deployer in FeeRegistry for fee claiming
        if (address(feeRegistry) != address(0)) {
            feeRegistry.registerITPDeployer(itpId, msg.sender);
        }

        // Emit event
        emit EventsLib.ITPCreated(itpId, msg.sender, packedName, packedSymbol, _assets, weights);
    }

    // ============ REBALANCE FUNCTIONS (V2 - Asset Changes) ============

    /// @notice Permissionless rebalance request — emits event only, no state change
    /// @dev Anyone can call. Oracles detect the event, verify, and execute via BLS consensus.
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
    ) external {
        emit EventsLib.RebalanceRequested(msg.sender, itpId, removeIndices, addAssets, newWeights, note);
    }

    /// @notice Execute a rebalance via BLS consensus (single call, replaces propose+confirm+update)
    /// @dev Handles asset removals, additions, weight updates, and on-chain inventory computation.
    /// @param itpId The ITP to rebalance
    /// @param removeIndices Indices to remove (sorted descending), can be empty
    /// @param addAssets New asset addresses to add, can be empty
    /// @param newWeights Weights for the final asset list
    /// @param prices Prices for the final asset list (for inventory computation)
    /// @param quoteTokens Quote tokens per asset (address(0) = default USDC)
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
    ) external {
        if (!_itpExists[itpId]) {
            revert ErrorsLib.E006_ITPNotFound(itpId);
        }

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "rebalance",
            itpId, removeIndices, addAssets, newWeights, prices, quoteTokens
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        RebalanceLib.rebalance(
            itpId, removeIndices, addAssets, newWeights, prices, quoteTokens,
            _itps, _itpAssets, _itpWeights, _itpInventory, _itpNavs, governance
        );
    }

    /// @notice Transfer ITP creator via authorized bridge
    /// @dev Only callable by the authorized bridge contract. Updates creator and FeeRegistry.
    function transferCreator(bytes32 itpId, address newCreator) external {
        if (msg.sender != authorizedBridge) {
            revert ErrorsLib.E107_NotAuthorizedBridge(msg.sender, authorizedBridge);
        }
        if (!_itpExists[itpId]) {
            revert ErrorsLib.E006_ITPNotFound(itpId);
        }

        address oldCreator = _itps[itpId].creator;
        _itps[itpId].creator = newCreator;

        // Update FeeRegistry deployer if registry is set
        if (address(feeRegistry) != address(0)) {
            feeRegistry.registerITPDeployer(itpId, newCreator);
        }

        emit EventsLib.CreatorTransferred(itpId, oldCreator, newCreator);
    }

    // ============ ITP NAV FUNCTIONS ============

    /// @notice Set ITP NAV via BLS-verified push from oracles
    /// @param itpId The ITP identifier
    /// @param nav The NAV value (18 decimals)
    /// @param blsSignature Aggregated BLS signature from oracles
    function setItpNav(bytes32 itpId, uint256 nav, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "setItpNav", itpId, nav));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);
        _itpNavs[itpId] = nav;
        emit EventsLib.ItpNavUpdated(itpId, nav);
    }

    // ============ VIEW FUNCTIONS ============

    /// @notice Get all ITP vault addresses (for frontend compatibility)
    /// @return vaults Array of ITP vault addresses
    // getAllItps removed for code size — frontend uses getItpCount + getITP loop.

    /// @notice Get ITP count
    /// @return count Number of ITPs created
    function getItpCount() external view returns (uint256 count) {
        return _itpCount;
    }

    // getItpNameSymbol removed for code size — data-node reads from ITPCreated events

    /// @inheritdoc IInvestment
    function getOrder(uint256 orderId) external view returns (TypesLib.LimitOrder memory) { return orders[orderId]; }

    /// @inheritdoc IInvestment
    function getITP(bytes32 itpId) external view returns (TypesLib.ITPCore memory itp) {
        if (!_itpExists[itpId]) {
            revert ErrorsLib.E006_ITPNotFound(itpId);
        }
        return _itps[itpId];
    }

    /// @inheritdoc IInvestment
    function getNAV(bytes32 itpId) external view returns (uint256 nav) {
        return _getCurrentPrice(itpId);
    }

    /// @notice Get user's ITP share balance
    function getUserShares(bytes32 itpId, address user) external view returns (uint256) {
        return _userShares[itpId][user];
    }

    /// @inheritdoc IInvestment
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
        )
    {
        if (!_itpExists[itpId]) {
            revert ErrorsLib.E006_ITPNotFound(itpId);
        }
        TypesLib.ITPCore storage itp = _itps[itpId];
        creator = itp.creator;
        totalSupply = itp.totalSupply;
        nav = _getCurrentPrice(itpId);
        assets = _itpAssets[itpId];
        weights = _itpWeights[itpId];
        inventory = _itpInventory[itpId];
    }

    /// @inheritdoc IInvestment
    function getPrice(uint256 assetIdx) external view returns (uint256 price) {
        return assetPrices[assetIdx];
    }

    // batchGetPrices removed to fit code size limit — use multicall + getPrice()


    // ============ ADMIN FUNCTIONS ============

    /// @notice Configure per-asset minimum buy amount
    /// @param asset Asset address
    /// @param minAmount Minimum buy amount in USDC (18 decimals). 0 to disable.
    function setMinBuyAmount(address asset, uint256 minAmount) external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        minBuyAmount[asset] = minAmount;
        emit EventsLib.MinBuyAmountUpdated(asset, minAmount);
    }

    /// @notice Configure per-asset minimum buy amounts in batch
    /// @dev Delegated to AdminLib.
    function setBatchMinBuyAmounts(address[] calldata assets, uint256[] calldata amounts) external {
        AdminLib.setBatchMinBuyAmounts(assets, amounts, minBuyAmount, governance);
    }

    /// @notice Configure per-asset-type staleness limits
    /// @param assetType The asset type identifier
    /// @param maxSeconds Maximum allowed staleness in seconds (0 to disable)
    function setStalenessLimit(uint256 assetType, uint256 maxSeconds) external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        stalenessLimits[assetType] = maxSeconds;
        emit EventsLib.StalenessLimitUpdated(assetType, maxSeconds);
    }

    // setStalenessLimitsBatch removed for code size — use setStalenessLimit in loop

    /// @notice Configure a venue pool for inventory tracking
    /// @dev Delegated to AdminLib.
    function configureVenuePool(uint256 venueId, uint256 targetBalance, uint256 minThreshold) external {
        AdminLib.configureVenuePool(venueId, targetBalance, minThreshold, venuePools, governance);
    }

    /// @notice Update venue pool balance after bridge operations (BLS-signed)
    /// @dev BLS verification done here, pool update delegated to AdminLib.
    function updateVenueBalance(uint256 venueId, uint256 newBalance, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "UPDATE_VENUE", venueId, newBalance));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);
        AdminLib.updateVenueBalance(venueId, newBalance, venuePools);
    }

    /// @notice Configure queue depth thresholds
    /// @param warning Queue depth at which a warning event is emitted
    /// @param pause_ Queue depth at which new orders are rejected
    function setQueueThresholds(uint256 warning, uint256 pause_) external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        if (pause_ > 0 && warning > pause_) {
            revert ErrorsLib.E089_InvalidQueueThresholds(warning, pause_);
        }
        queueWarningThreshold = warning;
        queuePauseThreshold = pause_;
        emit EventsLib.QueueThresholdsUpdated(warning, pause_);
    }

    // ============ ZOMBIE ORDER CLEANUP (Wave 3.2) ============

    /// @notice Cancel stale pending orders via BLS consensus
    /// @dev Verifies BLS signature, sets orders to EXPIRED, decrements pendingOrderCount, refunds USDC
    /// @param orderIds Array of order IDs to cancel
    /// @param blsSignature Aggregated BLS signature from oracles
    function cancelStalePendingOrders(uint256[] calldata orderIds, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "cancelStale", orderIds));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        uint256 cancelledCount = 0;
        for (uint256 i = 0; i < orderIds.length;) {
            TypesLib.LimitOrder storage order = orders[orderIds[i]];

            // Only cancel PENDING orders
            if (order.id != 0 && order.status == TypesLib.OrderStatus.PENDING) {
                order.status = TypesLib.OrderStatus.EXPIRED;

                if (pendingOrderCount > 0) {
                    unchecked {
                        --pendingOrderCount;
                    }
                }

                // Refund based on order side
                if (order.side == TypesLib.Side.BUY) {
                    usdc.safeTransfer(order.user, order.amount);
                } else {
                    // SELL: restore escrowed shares
                    _userShares[order.itpId][order.user] += order.amount;
                    _itps[order.itpId].totalSupply += order.amount;
                }

                emit EventsLib.OrderRefunded(orderIds[i], order.user, order.amount);

                unchecked {
                    ++cancelledCount;
                }
            }

            unchecked {
                ++i;
            }
        }

        emit EventsLib.StalePendingOrdersCancelled(orderIds, cancelledCount);
    }

    // ============ BATCHED TIMEOUT REFUND (Wave 3.3) ============

    /// @notice Refund a BATCHED order that has timed out (no confirmFills arrived)
    /// @dev Anyone can call, but only for BATCHED orders past BATCHED_TIMEOUT.
    ///      Requires BLS signature for authorization.
    /// @param orderId The order to refund
    /// @param blsSignature Aggregated BLS signature from oracles
    function refundTimedOutBatchedOrder(uint256 orderId, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        TypesLib.LimitOrder storage order = orders[orderId];

        // Verify order exists
        if (order.id == 0) {
            revert ErrorsLib.E022_OrderNotFound(orderId);
        }

        // Must be BATCHED status
        if (order.status != TypesLib.OrderStatus.BATCHED) {
            revert ErrorsLib.E024_InvalidOrderStatus(
                orderId,
                uint256(order.status),
                uint256(TypesLib.OrderStatus.BATCHED)
            );
        }

        // Must be past timeout
        uint256 batchedAt = batchedTimestamp[orderId];
        if (batchedAt == 0 || block.timestamp <= batchedAt + BATCHED_TIMEOUT) revert ErrorsLib.E130_BatchedTimeoutNotReached(orderId, batchedAt, block.timestamp);

        // BLS verification
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "refundBatched", orderId));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Mark as expired and refund
        order.status = TypesLib.OrderStatus.EXPIRED;

        if (pendingOrderCount > 0) {
            unchecked {
                --pendingOrderCount;
            }
        }

        if (order.side == TypesLib.Side.BUY) {
            usdc.safeTransfer(order.user, order.amount);
        } else {
            // SELL: restore escrowed shares
            _userShares[order.itpId][order.user] += order.amount;
            _itps[order.itpId].totalSupply += order.amount;
        }

        emit EventsLib.OrderRefunded(orderId, order.user, order.amount);
    }

    // ============ PERMISSIONLESS EXPIRY CLAIM (Finding F6) ============

    /// @notice Claim refund for an expired order after the grace period — no BLS required
    /// @dev Safety net for when both AP and oracles are unavailable. Anyone can call.
    ///      Only processes orders whose deadline + EXPIRY_GRACE_PERIOD has elapsed.
    ///      BUY orders: refunds escrowed USDC to the order's user.
    ///      SELL orders: restores escrowed ITP shares to the order's user.
    /// @param orderId The order to claim
    function claimExpiredOrder(uint256 orderId) external nonReentrant {
        TypesLib.LimitOrder storage order = orders[orderId];

        // Check order exists
        if (order.user == address(0)) {
            revert ErrorsLib.E022_OrderNotFound(orderId);
        }

        // Must be PENDING or BATCHED (not already filled, cancelled, or expired)
        if (order.status != TypesLib.OrderStatus.PENDING && order.status != TypesLib.OrderStatus.BATCHED) {
            revert ErrorsLib.E024_InvalidOrderStatus(
                orderId,
                uint256(order.status),
                uint256(TypesLib.OrderStatus.PENDING)
            );
        }

        // Deadline must have passed
        if (block.timestamp <= order.deadline) {
            revert ErrorsLib.E034_OrderNotYetExpired(orderId, order.deadline, block.timestamp);
        }

        // Grace period must have elapsed
        uint256 claimableAt = order.deadline + EXPIRY_GRACE_PERIOD;
        if (block.timestamp <= claimableAt) {
            revert ErrorsLib.E154_GracePeriodNotElapsed(orderId, claimableAt, block.timestamp);
        }

        // CEI: update state before external calls
        order.status = TypesLib.OrderStatus.EXPIRED;

        if (pendingOrderCount > 0) {
            unchecked {
                --pendingOrderCount;
            }
        }

        // Refund based on order side
        if (order.side == TypesLib.Side.BUY) {
            // BUY: return escrowed USDC to user
            usdc.safeTransfer(order.user, order.amount);
        } else {
            // SELL: restore escrowed ITP shares
            _userShares[order.itpId][order.user] += order.amount;
            _itps[order.itpId].totalSupply += order.amount;
        }

        emit EventsLib.ExpiredOrderClaimed(orderId, order.user, msg.sender, order.amount);
    }

    // ============ ADMIN FUNCTIONS (TESTNET) ============

    /// @notice Admin-only: mint ITP shares for testnet seeding (bypasses order pipeline)
    /// @param itpId The ITP identifier
    /// @param to Recipient address
    /// @param shares Amount of shares to mint (18 decimals)
    function seedMint(bytes32 itpId, address to, uint256 shares) external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        if (!_itpExists[itpId]) {
            revert ErrorsLib.E006_ITPNotFound(itpId);
        }

        TypesLib.ITPCore storage itp = _itps[itpId];
        itp.totalSupply += shares;
        _userShares[itpId][to] += shares;

        address vault = itpVaults[itpId];
        if (vault != address(0)) {
            (bool success,) = vault.call(abi.encodeWithSignature("mint(address,uint256)", to, shares));
            if (!success) {
                revert ErrorsLib.E063_MintFailed(vault, itpId);
            }
        }
    }

    // ============ INTERNAL FUNCTIONS ============

    // BLS verification via inherited BLSVerifier._verifyBLS()

    /// @notice Get current NAV for an ITP from BLS-pushed stored value
    /// @param itpId The ITP identifier
    /// @return NAV in USDC (18 decimals), or 0 if not set
    function _getCurrentPrice(bytes32 itpId) internal view returns (uint256) {
        return _itpNavs[itpId];
    }

    /// @notice Convert string to bytes32
    function _stringToBytes32(string memory source) internal pure returns (bytes32 result) {
        bytes memory sourceBytes = bytes(source);
        if (sourceBytes.length == 0) {
            return 0x0;
        }
        if (sourceBytes.length > 32) {
            revert ErrorsLib.E064_StringTooLong(sourceBytes.length, 32);
        }
        assembly {
            result := mload(add(source, 32))
        }
    }

    /// @notice Authorize upgrade (UUPS pattern)
    /// @dev Only admin can upgrade
    function _authorizeUpgrade(address newImplementation) internal view override {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        (newImplementation); // Suppress unused parameter warning
    }
}
