// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../mocks/MockBitgetVault.sol";
import "../mocks/MockERC20.sol";

/// @title MockBitgetVaultTest - Comprehensive tests for MockBitgetVault
/// @notice Tests all acceptance criteria for Story 7.18 mint/burn model
contract MockBitgetVaultTest is Test {
    MockBitgetVault public vault;
    MockERC20 public mockBTC;
    MockERC20 public mockETH;
    MockERC20 public wusdc;
    MockERC20 public mockUSDT;

    address public owner = address(0x1);
    address public ap = address(0x2);
    address public otherUser = address(0x3);

    // Standard test amounts
    uint256 constant SELL_AMOUNT = 1000e18;
    uint256 constant BUY_AMOUNT = 500e18;

    // Events (must match contract)
    event TradeExecuted(
        uint256 indexed tradeId,
        address sellToken,
        address buyToken,
        uint256 sellAmount,
        uint256 buyAmount,
        address trader,
        uint256 timestamp
    );

    event VaultFunded(address indexed token, uint256 amount, address indexed funder);
    event VaultMinted(address indexed token, uint256 amount, address indexed trader);
    event VaultBurned(address indexed token, uint256 amount);
    event StableSwap(address indexed fromToken, address indexed toToken, uint256 amount, address indexed trader);

    function setUp() public {
        // Deploy mock tokens
        mockBTC = new MockERC20("Mock BTC", "BTC", 18);
        mockETH = new MockERC20("Mock ETH", "ETH", 18);
        wusdc = new MockERC20("Wrapped USDC", "WUSDC", 6);
        mockUSDT = new MockERC20("Mock USDT", "USDT", 6);

        // Deploy and initialize vault
        vault = new MockBitgetVault();
        vault.initialize(owner);

        // NO vault pre-funding required with mint/burn model!

        // Fund AP with sell tokens (AP needs tokens to sell to vault)
        mockBTC.mint(ap, 1_000_000e18);
        mockETH.mint(ap, 1_000_000e18);

        vm.startPrank(ap);
        mockBTC.approve(address(vault), type(uint256).max);
        mockETH.approve(address(vault), type(uint256).max);
        wusdc.approve(address(vault), type(uint256).max);
        mockUSDT.approve(address(vault), type(uint256).max);
        vm.stopPrank();

        // Register stable tokens
        vm.prank(owner);
        vault.setStableTokens(address(wusdc), 18, address(mockUSDT), 18);
    }

    // ============ INITIALIZATION TESTS ============

    function test_Initialize_SetsOwner() public view {
        assertEq(vault.owner(), owner);
    }

    function test_Initialize_RevertsOnZeroAddress() public {
        MockBitgetVault newVault = new MockBitgetVault();
        vm.expectRevert(MockBitgetVault.ZeroAddress.selector);
        newVault.initialize(address(0));
    }

    function test_Initialize_CannotReinitialize() public {
        vm.expectRevert();
        vault.initialize(address(0x999));
    }

    // ============ FUND VAULT TESTS (backward compat) ============

    function test_FundVault_DepositsTokensCorrectly() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW", 18);
        uint256 depositAmount = 5000e18;

        vm.startPrank(owner);
        newToken.mint(owner, depositAmount);
        newToken.approve(address(vault), depositAmount);

        vault.fundVault(address(newToken), depositAmount);

        assertEq(vault.getBalance(address(newToken)), depositAmount);
        vm.stopPrank();
    }

    function test_FundVault_EmitsEvent() public {
        MockERC20 newToken = new MockERC20("New Token", "NEW", 18);
        uint256 depositAmount = 5000e18;

        vm.startPrank(owner);
        newToken.mint(owner, depositAmount);
        newToken.approve(address(vault), depositAmount);

        vm.expectEmit(true, true, false, true);
        emit VaultFunded(address(newToken), depositAmount, owner);

        vault.fundVault(address(newToken), depositAmount);
        vm.stopPrank();
    }

    function test_FundVault_RevertsForNonOwner() public {
        vm.prank(ap);
        vm.expectRevert(abi.encodeWithSelector(MockBitgetVault.NotOwner.selector, ap, owner));
        vault.fundVault(address(mockBTC), 1000e18);
    }

    function test_FundVault_RevertsOnZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(MockBitgetVault.ZeroAmount.selector);
        vault.fundVault(address(mockBTC), 0);
    }

    function test_FundVault_RevertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(MockBitgetVault.ZeroAddress.selector);
        vault.fundVault(address(0), 1000e18);
    }

    // ============ EXECUTE TRADE TESTS (MINT/BURN MODEL) ============

    function test_ExecuteTrade_MintsBuyTokenToCaller() public {
        uint256 tradeId = 1;

        uint256 apEthBefore = mockETH.balanceOf(ap);

        vm.prank(ap);
        vault.executeTrade(tradeId, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);

        // AP should have MORE ETH (minted)
        assertEq(mockETH.balanceOf(ap), apEthBefore + BUY_AMOUNT, "AP ETH not increased by mint");
    }

    function test_ExecuteTrade_BurnsSellTokenFromVault() public {
        uint256 tradeId = 1;

        vm.prank(ap);
        vault.executeTrade(tradeId, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);

        // Vault should have ZERO BTC (burned after receiving)
        assertEq(vault.getBalance(address(mockBTC)), 0, "Vault BTC should be 0 after burn");
        // Vault should have ZERO ETH (never held, minted directly to AP)
        assertEq(vault.getBalance(address(mockETH)), 0, "Vault ETH should be 0");
    }

    function test_ExecuteTrade_VaultBalanceRemainsZero() public {
        // Execute multiple trades — vault balance should always be zero
        vm.startPrank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), 100e18, 50e18);
        vault.executeTrade(2, address(mockBTC), address(mockETH), 200e18, 100e18);
        vm.stopPrank();

        assertEq(vault.getBalance(address(mockBTC)), 0, "Vault BTC should be 0");
        assertEq(vault.getBalance(address(mockETH)), 0, "Vault ETH should be 0");
    }

    function test_ExecuteTrade_EmitsTradeExecutedEvent() public {
        uint256 tradeId = 1;

        vm.expectEmit(true, false, false, true);
        emit TradeExecuted(tradeId, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT, ap, block.timestamp);

        vm.prank(ap);
        vault.executeTrade(tradeId, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);
    }

    function test_ExecuteTrade_EmitsVaultMintedEvent() public {
        vm.expectEmit(true, false, true, true);
        emit VaultMinted(address(mockETH), BUY_AMOUNT, ap);

        vm.prank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);
    }

    function test_ExecuteTrade_EmitsVaultBurnedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit VaultBurned(address(mockBTC), SELL_AMOUNT);

        vm.prank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);
    }

    function test_ExecuteTrade_IncrementsTradeCount() public {
        assertEq(vault.tradeCount(), 0);

        vm.prank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);
        assertEq(vault.tradeCount(), 1);

        vm.prank(ap);
        vault.executeTrade(2, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);
        assertEq(vault.tradeCount(), 2);
    }

    function test_ExecuteTrade_NoLongerRevertsOnInsufficientVaultBalance() public {
        // With mint/burn model, vault doesn't need pre-funded balance
        // This trade should succeed even though vault has zero mockETH
        uint256 largeBuyAmount = 999_999e18;

        vm.prank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), SELL_AMOUNT, largeBuyAmount);

        assertEq(mockETH.balanceOf(ap), 1_000_000e18 + largeBuyAmount, "AP should receive minted tokens");
    }

    function test_ExecuteTrade_RevertsOnDuplicateTradeId() public {
        vm.prank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);

        vm.prank(ap);
        vm.expectRevert(abi.encodeWithSelector(MockBitgetVault.DuplicateTradeId.selector, uint256(1)));
        vault.executeTrade(1, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);
    }

    function test_ExecuteTrade_RevertsOnZeroSellAmount() public {
        vm.prank(ap);
        vm.expectRevert(MockBitgetVault.ZeroAmount.selector);
        vault.executeTrade(1, address(mockBTC), address(mockETH), 0, BUY_AMOUNT);
    }

    function test_ExecuteTrade_RevertsOnZeroBuyAmount() public {
        vm.prank(ap);
        vm.expectRevert(MockBitgetVault.ZeroAmount.selector);
        vault.executeTrade(1, address(mockBTC), address(mockETH), SELL_AMOUNT, 0);
    }

    function test_ExecuteTrade_RevertsOnZeroSellToken() public {
        vm.prank(ap);
        vm.expectRevert(MockBitgetVault.ZeroAddress.selector);
        vault.executeTrade(1, address(0), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);
    }

    function test_ExecuteTrade_RevertsOnZeroBuyToken() public {
        vm.prank(ap);
        vm.expectRevert(MockBitgetVault.ZeroAddress.selector);
        vault.executeTrade(1, address(mockBTC), address(0), SELL_AMOUNT, BUY_AMOUNT);
    }

    // ============ NET POSITION TRACKING TESTS (Story 7.18 AC3) ============

    function test_GetNetPosition_TracksMintedMinusBurned() public {
        vm.prank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), 1000e18, 500e18);

        // buyToken (ETH) was minted: +500e18
        assertEq(vault.getNetPosition(address(mockETH)), int256(500e18), "ETH net position should be +500e18");
        // sellToken (BTC) was burned: -1000e18
        assertEq(vault.getNetPosition(address(mockBTC)), -int256(1000e18), "BTC net position should be -1000e18");
    }

    function test_GetNetPosition_AccumulatesAcrossTrades() public {
        vm.startPrank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), 1000e18, 500e18);
        vault.executeTrade(2, address(mockBTC), address(mockETH), 2000e18, 1000e18);
        vm.stopPrank();

        // ETH minted: 500 + 1000 = 1500
        assertEq(vault.getNetPosition(address(mockETH)), int256(1500e18));
        // BTC burned: 1000 + 2000 = 3000
        assertEq(vault.getNetPosition(address(mockBTC)), -int256(3000e18));
    }

    function test_GetNetPosition_ZeroForUnusedToken() public view {
        assertEq(vault.getNetPosition(address(wusdc)), 0);
    }

    // ============ GET FILL TESTS ============

    function test_GetFill_ReturnsCorrectFillData() public {
        uint256 tradeId = 42;

        vm.prank(ap);
        vault.executeTrade(tradeId, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);

        MockBitgetVault.Trade memory fill = vault.getFill(tradeId);

        assertEq(fill.tradeId, tradeId);
        assertEq(fill.sellToken, address(mockBTC));
        assertEq(fill.buyToken, address(mockETH));
        assertEq(fill.sellAmount, SELL_AMOUNT);
        assertEq(fill.buyAmount, BUY_AMOUNT);
        assertEq(fill.trader, ap);
        assertEq(fill.timestamp, block.timestamp);
    }

    function test_GetFill_ReturnsEmptyForNonExistentTrade() public view {
        MockBitgetVault.Trade memory fill = vault.getFill(999);

        assertEq(fill.tradeId, 0);
        assertEq(fill.sellToken, address(0));
        assertEq(fill.buyToken, address(0));
        assertEq(fill.sellAmount, 0);
        assertEq(fill.buyAmount, 0);
        assertEq(fill.trader, address(0));
        assertEq(fill.timestamp, 0);
    }

    // ============ GET TRADE HISTORY TESTS ============

    function test_GetTradeHistory_ReturnsPaginatedResults() public {
        // Execute 5 trades
        vm.startPrank(ap);
        for (uint256 i = 1; i <= 5; i++) {
            vault.executeTrade(i, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);
        }
        vm.stopPrank();

        // Get first 3 trades
        MockBitgetVault.Trade[] memory history = vault.getTradeHistory(0, 3);
        assertEq(history.length, 3);
        assertEq(history[0].tradeId, 1);
        assertEq(history[1].tradeId, 2);
        assertEq(history[2].tradeId, 3);

        // Get next 2 trades
        history = vault.getTradeHistory(3, 2);
        assertEq(history.length, 2);
        assertEq(history[0].tradeId, 4);
        assertEq(history[1].tradeId, 5);
    }

    function test_GetTradeHistory_ReturnsEmptyForEmptyVault() public view {
        MockBitgetVault.Trade[] memory history = vault.getTradeHistory(0, 10);
        assertEq(history.length, 0);
    }

    function test_GetTradeHistory_ReturnsEmptyForStartBeyondTotal() public {
        vm.prank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);

        MockBitgetVault.Trade[] memory history = vault.getTradeHistory(10, 5);
        assertEq(history.length, 0);
    }

    function test_GetTradeHistory_CapsAtAvailable() public {
        vm.startPrank(ap);
        for (uint256 i = 1; i <= 3; i++) {
            vault.executeTrade(i, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);
        }
        vm.stopPrank();

        // Request 10, but only 3 available
        MockBitgetVault.Trade[] memory history = vault.getTradeHistory(0, 10);
        assertEq(history.length, 3);
    }

    // ============ GET BALANCE TESTS ============

    function test_GetBalance_VaultStaysAtZero() public {
        // With mint/burn model, vault balance should always be zero
        vm.prank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);

        assertEq(vault.getBalance(address(mockBTC)), 0);
        assertEq(vault.getBalance(address(mockETH)), 0);
    }

    // ============ MULTIPLE TRADES INTEGRATION ============

    function test_MultipleTrades_AllRecordedCorrectly() public {
        vm.startPrank(ap);

        // Trade 1: Sell BTC, buy ETH
        vault.executeTrade(100, address(mockBTC), address(mockETH), 1000e18, 800e18);

        // Trade 2: Sell ETH (AP now has minted ETH), buy BTC
        mockETH.approve(address(vault), type(uint256).max);
        vault.executeTrade(101, address(mockETH), address(mockBTC), 500e18, 450e18);

        // Trade 3: Sell BTC, buy ETH
        vault.executeTrade(102, address(mockBTC), address(mockETH), 200e18, 180e18);

        vm.stopPrank();

        // Verify all trades recorded
        assertEq(vault.tradeCount(), 3);

        MockBitgetVault.Trade memory trade1 = vault.getFill(100);
        assertEq(trade1.sellAmount, 1000e18);
        assertEq(trade1.buyAmount, 800e18);

        MockBitgetVault.Trade memory trade2 = vault.getFill(101);
        assertEq(trade2.sellAmount, 500e18);
        assertEq(trade2.buyAmount, 450e18);

        MockBitgetVault.Trade memory trade3 = vault.getFill(102);
        assertEq(trade3.sellAmount, 200e18);
        assertEq(trade3.buyAmount, 180e18);

        // Verify history
        MockBitgetVault.Trade[] memory history = vault.getTradeHistory(0, 10);
        assertEq(history.length, 3);
        assertEq(history[0].tradeId, 100);
        assertEq(history[1].tradeId, 101);
        assertEq(history[2].tradeId, 102);

        // Vault always zero
        assertEq(vault.getBalance(address(mockBTC)), 0);
        assertEq(vault.getBalance(address(mockETH)), 0);
    }

    // ============ SWAP STABLE TESTS (Story 7.18 AC7) ============

    function test_SwapStable_UsdcToUsdt() public {
        // Fund AP with USDC
        wusdc.mint(ap, 1000e6);

        vm.prank(ap);
        vault.swapStable(address(wusdc), address(mockUSDT), 1000e6);

        // AP should have 0 USDC (burned) and 1000 USDT (minted)
        assertEq(wusdc.balanceOf(ap), 0, "USDC should be burned");
        assertEq(mockUSDT.balanceOf(ap), 1000e6, "USDT should be minted");
    }

    function test_SwapStable_UsdtToUsdc() public {
        // Fund AP with USDT
        mockUSDT.mint(ap, 500e6);

        vm.prank(ap);
        vault.swapStable(address(mockUSDT), address(wusdc), 500e6);

        assertEq(mockUSDT.balanceOf(ap), 0, "USDT should be burned");
        assertEq(wusdc.balanceOf(ap), 500e6, "USDC should be minted");
    }

    function test_SwapStable_EmitsEvent() public {
        wusdc.mint(ap, 100e6);

        vm.expectEmit(true, true, false, true);
        emit StableSwap(address(wusdc), address(mockUSDT), 100e6, ap);

        vm.prank(ap);
        vault.swapStable(address(wusdc), address(mockUSDT), 100e6);
    }

    function test_SwapStable_RevertsOnZeroAmount() public {
        vm.prank(ap);
        vm.expectRevert(MockBitgetVault.ZeroAmount.selector);
        vault.swapStable(address(wusdc), address(mockUSDT), 0);
    }

    function test_SwapStable_RevertsOnUnregisteredFromToken() public {
        mockBTC.mint(ap, 100e18);
        vm.prank(ap);
        vm.expectRevert(abi.encodeWithSelector(MockBitgetVault.NotStablecoin.selector, address(mockBTC)));
        vault.swapStable(address(mockBTC), address(mockUSDT), 100e18);
    }

    function test_SwapStable_RevertsOnUnregisteredToToken() public {
        wusdc.mint(ap, 100e6);
        vm.prank(ap);
        vm.expectRevert(abi.encodeWithSelector(MockBitgetVault.NotStablecoin.selector, address(mockBTC)));
        vault.swapStable(address(wusdc), address(mockBTC), 100e6);
    }

    function test_SwapStable_RevertsOnSameToken() public {
        wusdc.mint(ap, 100e6);
        vm.prank(ap);
        vm.expectRevert(abi.encodeWithSelector(MockBitgetVault.SameTokenSwap.selector, address(wusdc)));
        vault.swapStable(address(wusdc), address(wusdc), 100e6);
    }

    function test_SwapStable_UpdatesNetPosition() public {
        wusdc.mint(ap, 1000e6);

        vm.prank(ap);
        vault.swapStable(address(wusdc), address(mockUSDT), 1000e6);

        // USDT was minted: +1000e6
        assertEq(vault.getNetPosition(address(mockUSDT)), int256(1000e6), "USDT net position should be +1000e6");
        // USDC was burned: -1000e6
        assertEq(vault.getNetPosition(address(wusdc)), -int256(1000e6), "USDC net position should be -1000e6");
    }

    // ============ SET STABLE TOKENS TESTS ============

    function test_SetStableTokens_SetsCorrectly() public view {
        assertEq(vault.stableUSDC(), address(wusdc));
        assertEq(vault.stableUSDT(), address(mockUSDT));
    }

    function test_SetStableTokens_RevertsOnZeroUsdc() public {
        vm.prank(owner);
        vm.expectRevert(MockBitgetVault.ZeroAddress.selector);
        vault.setStableTokens(address(0), 18, address(mockUSDT), 18);
    }

    function test_SetStableTokens_RevertsOnZeroUsdt() public {
        vm.prank(owner);
        vm.expectRevert(MockBitgetVault.ZeroAddress.selector);
        vault.setStableTokens(address(wusdc), 18, address(0), 18);
    }

    function test_SetStableTokens_RevertsForNonOwner() public {
        vm.prank(ap);
        vm.expectRevert(abi.encodeWithSelector(MockBitgetVault.NotOwner.selector, ap, owner));
        vault.setStableTokens(address(wusdc), 18, address(mockUSDT), 18);
    }

    // ============ EXECUTE TRADE WITH USDT QUOTE TOKEN (AC5) ============

    function test_ExecuteTrade_WithUsdtQuoteToken() public {
        // Fund AP with USDT for sell
        mockUSDT.mint(ap, 10000e6);

        vm.prank(ap);
        // Sell USDT, buy mockBTC (USDT-quoted pair)
        vault.executeTrade(1, address(mockUSDT), address(mockBTC), 10000e6, 1e18);

        // AP should hold the minted BTC
        assertGt(mockBTC.balanceOf(ap), 0, "AP should hold minted BTC");
        // Vault should have zero USDT
        assertEq(vault.getBalance(address(mockUSDT)), 0, "Vault USDT should be 0");
    }

    // ============ PRICE MANAGEMENT TESTS (Story 7.11) ============

    event PriceUpdated(address indexed asset, uint256 price, address indexed setter);
    event PriceSetterUpdated(address indexed oldSetter, address indexed newSetter);

    function test_SetPrice_OwnerCanSetPrice() public {
        uint256 btcPrice = 50000e18;

        vm.prank(owner);
        vault.setPrice(address(mockBTC), btcPrice);

        assertEq(vault.getPrice(address(mockBTC)), btcPrice);
    }

    function test_SetPrice_EmitsEvent() public {
        uint256 btcPrice = 50000e18;

        vm.expectEmit(true, true, false, true);
        emit PriceUpdated(address(mockBTC), btcPrice, owner);

        vm.prank(owner);
        vault.setPrice(address(mockBTC), btcPrice);
    }

    function test_SetPrice_PriceSetterCanSetPrice() public {
        address newPriceSetter = address(0x4);

        vm.prank(owner);
        vault.setPriceSetter(newPriceSetter);

        uint256 ethPrice = 3000e18;
        vm.prank(newPriceSetter);
        vault.setPrice(address(mockETH), ethPrice);

        assertEq(vault.getPrice(address(mockETH)), ethPrice);
    }

    function test_SetPrice_RevertsForUnauthorized() public {
        vm.prank(otherUser);
        vm.expectRevert(abi.encodeWithSelector(MockBitgetVault.NotPriceSetter.selector, otherUser, owner));
        vault.setPrice(address(mockBTC), 50000e18);
    }

    function test_SetPrice_RevertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(MockBitgetVault.ZeroAddress.selector);
        vault.setPrice(address(0), 50000e18);
    }

    function test_SetPrice_CanSetZeroPrice() public {
        vm.prank(owner);
        vault.setPrice(address(mockBTC), 50000e18);
        assertEq(vault.getPrice(address(mockBTC)), 50000e18);

        vm.prank(owner);
        vault.setPrice(address(mockBTC), 0);
        assertEq(vault.getPrice(address(mockBTC)), 0);
    }

    function test_SetPrices_BatchSetsMultiplePrices() public {
        address[] memory assets = new address[](3);
        assets[0] = address(mockBTC);
        assets[1] = address(mockETH);
        assets[2] = address(wusdc);

        uint256[] memory prices = new uint256[](3);
        prices[0] = 50000e18;
        prices[1] = 3000e18;
        prices[2] = 1e18;

        vm.prank(owner);
        vault.setPrices(assets, prices);

        assertEq(vault.getPrice(address(mockBTC)), 50000e18);
        assertEq(vault.getPrice(address(mockETH)), 3000e18);
        assertEq(vault.getPrice(address(wusdc)), 1e18);
    }

    function test_SetPrices_RevertsOnArrayLengthMismatch() public {
        address[] memory assets = new address[](2);
        assets[0] = address(mockBTC);
        assets[1] = address(mockETH);

        uint256[] memory prices = new uint256[](3);
        prices[0] = 50000e18;
        prices[1] = 3000e18;
        prices[2] = 1e18;

        vm.prank(owner);
        vm.expectRevert("MockBitgetVault: array length mismatch");
        vault.setPrices(assets, prices);
    }

    function test_SetPriceSetter_OwnerCanChangePriceSetter() public {
        address newPriceSetter = address(0x4);

        vm.expectEmit(true, true, false, false);
        emit PriceSetterUpdated(owner, newPriceSetter);

        vm.prank(owner);
        vault.setPriceSetter(newPriceSetter);

        assertEq(vault.priceSetter(), newPriceSetter);
    }

    function test_GetPrice_ReturnsZeroForUnsetAsset() public view {
        address unknownAsset = address(0x999);
        assertEq(vault.getPrice(unknownAsset), 0);
    }

    function test_Initialize_SetsPriceSetterToOwner() public view {
        assertEq(vault.priceSetter(), owner);
    }

    // ============ FR13 COMPLIANCE TEST ============

    function test_FR13_OracleCanVerifyFillReadOnly() public {
        // AP executes trade
        vm.prank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), SELL_AMOUNT, BUY_AMOUNT);

        // Oracle reads fill data (simulated via different address)
        address oracle = address(0x999);
        vm.prank(oracle);

        MockBitgetVault.Trade memory fill = vault.getFill(1);

        // Oracle can verify:
        assertEq(fill.sellToken, address(mockBTC));
        assertEq(fill.buyToken, address(mockETH));
        assertEq(fill.sellAmount, SELL_AMOUNT);
        assertEq(fill.buyAmount, BUY_AMOUNT);
        assertEq(fill.trader, ap);
        assertGt(fill.timestamp, 0);
    }

    // ============ AP BALANCE VERIFICATION (AC9) ============

    function test_APBalance_ReflectsHoldingsAfterBuy() public {
        uint256 apBtcBefore = mockBTC.balanceOf(ap);

        // AP buys ETH with BTC
        vm.prank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), 1000e18, 500e18);

        // After buy: AP lost 1000 BTC, gained 500 ETH
        assertEq(mockBTC.balanceOf(ap), apBtcBefore - 1000e18, "AP BTC decreased");
        // AP started with 1M ETH + 500 minted = 1,000,500
        assertEq(mockETH.balanceOf(ap), 1_000_000e18 + 500e18, "AP ETH increased by minted amount");
    }

    function test_APBalance_ReflectsHoldingsAfterSell() public {
        // First buy some ETH
        vm.prank(ap);
        vault.executeTrade(1, address(mockBTC), address(mockETH), 1000e18, 500e18);

        uint256 apEthBefore = mockETH.balanceOf(ap);

        // Now sell ETH back for BTC
        vm.prank(ap);
        vault.executeTrade(2, address(mockETH), address(mockBTC), 200e18, 150e18);

        // After sell: AP lost 200 ETH, gained 150 BTC
        assertEq(mockETH.balanceOf(ap), apEthBefore - 200e18, "AP ETH decreased");
    }
}
