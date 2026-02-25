// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title IMockERC20 - Interface for MockERC20 mint/burn
interface IMockERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

/// @title MockBitgetVault
/// @notice On-chain mock of a CEX vault for E2E testing with mint/burn settlement
/// @dev Story 7.18: Mints buyToken to caller, burns sellToken after receiving it.
/// @dev Vault balance stays at zero — AP's ERC20 balanceOf is the source of truth.
/// @dev Used for FR13 compliance: issuers verify fills via read-only getFill() call
contract MockBitgetVault is Initializable {
    using SafeERC20 for IERC20;

    // ============ STRUCTS ============

    /// @notice Trade execution record for fill verification
    struct Trade {
        uint256 tradeId;
        address sellToken;
        address buyToken;
        uint256 sellAmount;
        uint256 buyAmount;
        address trader;
        uint256 timestamp;
    }

    // ============ STATE ============

    /// @notice Owner address (can fund vault)
    address public owner;

    /// @notice Trade records by ID
    mapping(uint256 => Trade) public trades;

    /// @notice Trade IDs in order for pagination
    uint256[] private _tradeIds;

    /// @notice Track used trade IDs to prevent duplicates
    mapping(uint256 => bool) public tradeIdUsed;

    /// @notice Total trade count
    uint256 public tradeCount;

    /// @notice Asset prices for dynamic pricing (18 decimals, price in USDC)
    /// @dev Set by AP with real Bitget prices for E2E testing
    mapping(address => uint256) public assetPrices;

    /// @notice Price setter address (AP can set prices)
    address public priceSetter;

    /// @notice Net position tracking: cumulative minted minus burned per token (Story 7.18)
    mapping(address => int256) public netPosition;

    /// @notice Registered USDC stablecoin address for swapStable (Story 7.18)
    address public stableUSDC;

    /// @notice Registered USDT stablecoin address for swapStable (Story 7.18)
    address public stableUSDT;

    /// @notice Decimal count for registered stablecoins (for cross-decimal swaps)
    uint8 public stableUSDCDecimals;
    uint8 public stableUSDTDecimals;

    /// @notice Trading fee in basis points (10 = 0.1%)
    uint256 public feeBps;

    /// @notice Bid/ask spread in basis points (20 = 0.2%)
    uint256 public spreadBps;

    /// @notice Accumulated fees collected per token address
    mapping(address => uint256) public accumulatedFees;

    /// @notice Sum of all fee revenue across all tokens
    uint256 public totalFeeRevenue;

    /// @notice Malfunction simulation mode: 0=NORMAL, 1=PAUSED, 2=PARTIAL_FILL, 3=DELAYED, 4=PRICE_SPIKE
    uint8 public malfunctionMode;

    // ============ CONSTANTS ============

    uint8 constant MODE_NORMAL = 0;
    uint8 constant MODE_PAUSED = 1;
    uint8 constant MODE_PARTIAL_FILL = 2;
    uint8 constant MODE_DELAYED = 3;
    uint8 constant MODE_PRICE_SPIKE = 4;
    uint256 constant BPS_DENOMINATOR = 10_000;
    uint256 constant PARTIAL_FILL_PERCENT = 50;
    uint256 constant PRICE_SPIKE_BPS = 500;

    // ============ EVENTS ============

    /// @notice Emitted when a trade is executed
    event TradeExecuted(
        uint256 indexed tradeId,
        address sellToken,
        address buyToken,
        uint256 sellAmount,
        uint256 buyAmount,
        address trader,
        uint256 timestamp
    );

    /// @notice Emitted when vault is funded
    event VaultFunded(address indexed token, uint256 amount, address indexed funder);

    /// @notice Emitted when an asset price is updated
    event PriceUpdated(address indexed asset, uint256 price, address indexed setter);

    /// @notice Emitted when the price setter is changed
    event PriceSetterUpdated(address indexed oldSetter, address indexed newSetter);

    /// @notice Emitted when vault mints buyToken to trader (Story 7.18)
    event VaultMinted(address indexed token, uint256 amount, address indexed trader);

    /// @notice Emitted when vault burns sellToken it received (Story 7.18)
    event VaultBurned(address indexed token, uint256 amount);

    /// @notice Emitted when a stable swap is executed (Story 7.18)
    event StableSwap(address indexed fromToken, address indexed toToken, uint256 amount, address indexed trader);

    /// @notice Emitted when fee configuration is updated
    event FeeConfigUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    /// @notice Emitted when spread configuration is updated
    event SpreadConfigUpdated(uint256 oldSpreadBps, uint256 newSpreadBps);

    /// @notice Emitted when a fee is collected during a trade
    event FeeCollected(uint256 indexed tradeId, address indexed token, uint256 feeAmount);

    /// @notice Emitted when malfunction mode changes
    event MalfunctionModeChanged(uint8 oldMode, uint8 newMode);

    /// @notice Emitted when a trade is delayed (MODE_DELAYED)
    event TradeDelayed(uint256 indexed tradeId, uint256 delayTimestamp);

    // ============ ERRORS ============

    /// @notice Caller is not the owner
    error NotOwner(address caller, address owner);

    /// @notice Insufficient vault balance for trade (kept for backward compat, no longer used in executeTrade)
    error InsufficientVaultBalance(address token, uint256 required, uint256 available);

    /// @notice Trade ID already used
    error DuplicateTradeId(uint256 tradeId);

    /// @notice Zero amount not allowed
    error ZeroAmount();

    /// @notice Zero address not allowed
    error ZeroAddress();

    /// @notice Caller is not authorized to set prices
    error NotPriceSetter(address caller, address priceSetter);

    /// @notice Token is not a registered stablecoin
    error NotStablecoin(address token);

    /// @notice Cannot swap a token to itself
    error SameTokenSwap(address token);

    /// @notice Vault is paused (malfunction mode 1)
    error VaultPaused();

    /// @notice Invalid fee value
    error InvalidFee(uint256 feeBps, uint256 maxBps);

    /// @notice Invalid spread value
    error InvalidSpread(uint256 spreadBps, uint256 maxBps);

    /// @notice Invalid malfunction mode
    error InvalidMode(uint8 mode);

    // ============ MODIFIERS ============

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner(msg.sender, owner);
        }
        _;
    }

    modifier onlyPriceSetter() {
        if (msg.sender != priceSetter && msg.sender != owner) {
            revert NotPriceSetter(msg.sender, priceSetter);
        }
        _;
    }

    // ============ INITIALIZER ============

    /// @notice Initialize the vault with an owner
    /// @param owner_ The owner address (can fund vault and set prices)
    function initialize(address owner_) external initializer {
        if (owner_ == address(0)) {
            revert ZeroAddress();
        }
        owner = owner_;
        priceSetter = owner_; // Default: owner can set prices
    }

    // ============ OWNER FUNCTIONS ============

    /// @notice Fund the vault with tokens (owner only)
    /// @dev Kept for backward compatibility but no longer required with mint/burn model
    /// @param token ERC20 token to deposit
    /// @param amount Amount to deposit
    function fundVault(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit VaultFunded(token, amount, msg.sender);
    }

    /// @notice Set the price setter address (owner only)
    /// @param newPriceSetter The new price setter address (can be address(0) to disable)
    function setPriceSetter(address newPriceSetter) external onlyOwner {
        address oldSetter = priceSetter;
        priceSetter = newPriceSetter;
        emit PriceSetterUpdated(oldSetter, newPriceSetter);
    }

    /// @notice Set the trading fee in basis points (max 1000 = 10%)
    /// @param newFeeBps Fee in basis points
    function setFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) {
            revert InvalidFee(newFeeBps, 1000);
        }
        uint256 oldFeeBps = feeBps;
        feeBps = newFeeBps;
        emit FeeConfigUpdated(oldFeeBps, newFeeBps);
    }

    /// @notice Set the bid/ask spread in basis points (max 1000 = 10%)
    /// @param newSpreadBps Spread in basis points
    function setSpread(uint256 newSpreadBps) external onlyOwner {
        if (newSpreadBps > 1000) {
            revert InvalidSpread(newSpreadBps, 1000);
        }
        uint256 oldSpreadBps = spreadBps;
        spreadBps = newSpreadBps;
        emit SpreadConfigUpdated(oldSpreadBps, newSpreadBps);
    }

    /// @notice Set the malfunction simulation mode (0-4)
    /// @param mode 0=NORMAL, 1=PAUSED, 2=PARTIAL_FILL, 3=DELAYED, 4=PRICE_SPIKE
    function setMalfunctionMode(uint8 mode) external onlyOwner {
        if (mode > MODE_PRICE_SPIKE) {
            revert InvalidMode(mode);
        }
        uint8 oldMode = malfunctionMode;
        malfunctionMode = mode;
        emit MalfunctionModeChanged(oldMode, mode);
    }

    /// @notice Approve a spender to transfer tokens from the vault
    /// @dev Used to allow ArbBridgeCustody to pull USDC for completeSellOrder
    /// @param token ERC20 token to approve
    /// @param spender Address to approve
    /// @param amount Approval amount
    function approveSpender(address token, address spender, uint256 amount) external onlyOwner {
        IERC20(token).approve(spender, amount);
    }

    /// @notice Withdraw deposited tokens from the vault (e.g., after custody release)
    /// @dev Only priceSetter (AP) or owner can withdraw. Simulates CEX withdrawal.
    /// @param token ERC20 token to withdraw
    /// @param amount Amount to withdraw to caller
    function withdraw(address token, uint256 amount) external onlyPriceSetter {
        if (token == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    /// @notice Register USDC and USDT stablecoin addresses with decimals for swapStable
    /// @param usdc The USDC token address
    /// @param usdcDec USDC decimal count (e.g., 6)
    /// @param usdt The USDT token address
    /// @param usdtDec USDT decimal count (e.g., 18)
    function setStableTokens(address usdc, uint8 usdcDec, address usdt, uint8 usdtDec) external onlyOwner {
        if (usdc == address(0) || usdt == address(0)) {
            revert ZeroAddress();
        }
        stableUSDC = usdc;
        stableUSDCDecimals = usdcDec;
        stableUSDT = usdt;
        stableUSDTDecimals = usdtDec;
    }

    /// @notice Set the price for an asset (price setter or owner only)
    /// @dev AP calls this with real Bitget prices for E2E testing
    /// @param asset The asset address
    /// @param price The price in USDC (18 decimals, e.g., 50000e18 for $50,000)
    function setPrice(address asset, uint256 price) external onlyPriceSetter {
        if (asset == address(0)) {
            revert ZeroAddress();
        }
        assetPrices[asset] = price;
        emit PriceUpdated(asset, price, msg.sender);
    }

    /// @notice Set prices for multiple assets in batch (price setter or owner only)
    /// @param assets Array of asset addresses
    /// @param prices Array of prices (18 decimals)
    function setPrices(address[] calldata assets, uint256[] calldata prices) external onlyPriceSetter {
        require(assets.length == prices.length, "MockBitgetVault: array length mismatch");
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i] == address(0)) {
                revert ZeroAddress();
            }
            assetPrices[assets[i]] = prices[i];
            emit PriceUpdated(assets[i], prices[i], msg.sender);
        }
    }

    /// @notice Get the price for an asset
    /// @param asset The asset address
    /// @return price The price (18 decimals, 0 if not set)
    function getPrice(address asset) external view returns (uint256 price) {
        return assetPrices[asset];
    }

    // ============ TRADE FUNCTIONS ============

    /// @notice Execute a trade: caller sends sellToken, vault mints buyToken to caller
    /// @dev Story 7.18: Mint/burn model — no pre-funded vault balance required.
    ///   1. Transfer sellToken FROM caller TO vault via safeTransferFrom
    ///   2. Burn the received sellToken (vault stays at zero balance)
    ///   3. Mint buyToken directly to caller
    /// @param tradeId Unique trade identifier (must not be reused)
    /// @param sellToken Token to sell (transferred from caller to vault, then burned)
    /// @param buyToken Token to buy (minted to caller)
    /// @param sellAmount Amount of sellToken to transfer from caller
    /// @param buyAmount Amount of buyToken to mint to caller
    function executeTrade(
        uint256 tradeId,
        address sellToken,
        address buyToken,
        uint256 sellAmount,
        uint256 buyAmount
    ) external {
        // 1. Validate inputs
        if (tradeIdUsed[tradeId]) {
            revert DuplicateTradeId(tradeId);
        }
        if (sellToken == address(0) || buyToken == address(0)) {
            revert ZeroAddress();
        }
        if (sellAmount == 0 || buyAmount == 0) {
            revert ZeroAmount();
        }

        // 2. If PAUSED, revert immediately
        if (malfunctionMode == MODE_PAUSED) {
            revert VaultPaused();
        }

        // Mark trade ID as used
        tradeIdUsed[tradeId] = true;

        // 3. Apply spread to buy amount
        uint256 actualBuyAmount = buyAmount;
        if (spreadBps > 0) {
            actualBuyAmount = actualBuyAmount - (actualBuyAmount * spreadBps / BPS_DENOMINATOR);
        }

        // 4. If PRICE_SPIKE, apply additional 5% adverse slippage
        if (malfunctionMode == MODE_PRICE_SPIKE) {
            actualBuyAmount = actualBuyAmount - (actualBuyAmount * PRICE_SPIKE_BPS / BPS_DENOMINATOR);
        }

        // 5. If PARTIAL_FILL, reduce both sell and buy amounts to 50%
        uint256 actualSellAmount = sellAmount;
        if (malfunctionMode == MODE_PARTIAL_FILL) {
            actualSellAmount = actualSellAmount * PARTIAL_FILL_PERCENT / 100;
            actualBuyAmount = actualBuyAmount * PARTIAL_FILL_PERCENT / 100;
        }

        // 6. Apply fee to buy amount
        uint256 feeAmount = 0;
        if (feeBps > 0) {
            feeAmount = actualBuyAmount * feeBps / BPS_DENOMINATOR;
            actualBuyAmount = actualBuyAmount - feeAmount;
        }

        // 7. Record the trade with actual (post-adjustment) amounts
        Trade memory trade = Trade({
            tradeId: tradeId,
            sellToken: sellToken,
            buyToken: buyToken,
            sellAmount: actualSellAmount,
            buyAmount: actualBuyAmount,
            trader: msg.sender,
            timestamp: block.timestamp
        });
        trades[tradeId] = trade;
        _tradeIds.push(tradeId);
        tradeCount++;

        // 8. Convert stablecoin amounts to native decimals, then burn/mint
        uint256 burnSellAmount = actualSellAmount;
        if (sellToken == stableUSDC) {
            burnSellAmount = actualSellAmount / (10 ** (18 - stableUSDCDecimals));
        } else if (sellToken == stableUSDT) {
            burnSellAmount = actualSellAmount / (10 ** (18 - stableUSDTDecimals));
        }
        IMockERC20(sellToken).burn(address(this), burnSellAmount);
        emit VaultBurned(sellToken, burnSellAmount);

        uint256 mintBuyAmount = actualBuyAmount;
        if (buyToken == stableUSDC) {
            mintBuyAmount = actualBuyAmount / (10 ** (18 - stableUSDCDecimals));
        } else if (buyToken == stableUSDT) {
            mintBuyAmount = actualBuyAmount / (10 ** (18 - stableUSDTDecimals));
        }
        IMockERC20(buyToken).mint(address(this), mintBuyAmount);
        emit VaultMinted(buyToken, mintBuyAmount, msg.sender);

        netPosition[buyToken] += int256(mintBuyAmount);
        netPosition[sellToken] -= int256(burnSellAmount);

        // 9. Track accumulated fees
        if (feeAmount > 0) {
            accumulatedFees[buyToken] += feeAmount;
            totalFeeRevenue += feeAmount;
            emit FeeCollected(tradeId, buyToken, feeAmount);
        }

        // 10. If DELAYED, emit delay event (trade still succeeds)
        if (malfunctionMode == MODE_DELAYED) {
            emit TradeDelayed(tradeId, block.timestamp);
        }

        emit TradeExecuted(tradeId, sellToken, buyToken, actualSellAmount, actualBuyAmount, msg.sender, block.timestamp);
    }

    /// @notice Swap between registered stablecoins with decimal conversion
    /// @dev Amount is in 18-decimal standard format. Vault converts to each token's native decimals.
    /// @param fromToken Token to swap from (burned from vault's balance)
    /// @param toToken Token to swap to (minted to vault)
    /// @param amount Amount in 18-decimal standard format (e.g., 1000e18 = $1000)
    function swapStable(address fromToken, address toToken, uint256 amount) external {
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (fromToken == address(0) || toToken == address(0)) {
            revert ZeroAddress();
        }
        if (fromToken == toToken) {
            revert SameTokenSwap(fromToken);
        }
        // Both tokens must be registered stablecoins
        if (!_isStablecoin(fromToken)) {
            revert NotStablecoin(fromToken);
        }
        if (!_isStablecoin(toToken)) {
            revert NotStablecoin(toToken);
        }

        // Convert 18-dec standard amount to each token's native decimals
        uint8 fromDec = (fromToken == stableUSDC) ? stableUSDCDecimals : stableUSDTDecimals;
        uint8 toDec = (toToken == stableUSDC) ? stableUSDCDecimals : stableUSDTDecimals;

        uint256 fromAmount = amount / (10 ** (18 - fromDec));
        uint256 toAmount = amount / (10 ** (18 - toDec));

        // Burn fromToken from vault's own balance, mint toToken to vault
        IMockERC20(fromToken).burn(address(this), fromAmount);
        IMockERC20(toToken).mint(address(this), toAmount);

        // Update net position tracking
        netPosition[toToken] += int256(toAmount);
        netPosition[fromToken] -= int256(fromAmount);

        emit StableSwap(fromToken, toToken, amount, msg.sender);
    }

    // ============ VIEW FUNCTIONS ============

    /// @notice Get fill data for a specific trade (FR13: read-only issuer verification)
    /// @param tradeId The trade identifier to query
    /// @return trade The trade record
    function getFill(uint256 tradeId) external view returns (Trade memory trade) {
        return trades[tradeId];
    }

    /// @notice Get net position for a token (cumulative minted minus burned) (Story 7.18)
    /// @param token The token address
    /// @return The net position (positive = net minted, negative = net burned)
    function getNetPosition(address token) external view returns (int256) {
        return netPosition[token];
    }

    /// @notice Get paginated trade history
    /// @param startIndex Index to start from (0-based)
    /// @param count Number of trades to return
    /// @return tradeList Array of trades
    function getTradeHistory(uint256 startIndex, uint256 count) external view returns (Trade[] memory tradeList) {
        uint256 total = _tradeIds.length;

        // Handle empty case
        if (total == 0 || startIndex >= total) {
            return new Trade[](0);
        }

        // Calculate actual count (don't exceed available)
        uint256 actualCount = count;
        if (startIndex + count > total) {
            actualCount = total - startIndex;
        }

        tradeList = new Trade[](actualCount);
        for (uint256 i = 0; i < actualCount; i++) {
            uint256 tradeId = _tradeIds[startIndex + i];
            tradeList[i] = trades[tradeId];
        }
    }

    /// @notice Get vault balance for a specific token
    /// @param token The token address to query
    /// @return balance The vault's balance of that token
    function getBalance(address token) external view returns (uint256 balance) {
        return IERC20(token).balanceOf(address(this));
    }

    // ============ INTERNAL FUNCTIONS ============

    /// @notice Check if a token is a registered stablecoin
    function _isStablecoin(address token) internal view returns (bool) {
        return token == stableUSDC || token == stableUSDT;
    }
}
