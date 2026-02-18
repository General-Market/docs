// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ITP} from "../src/core/ITP.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC - Mock USDC with 18 decimals for testing
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockIndex - Mock Index contract for testing ITP
contract MockIndex {
    mapping(bytes32 => uint256) public navs;

    function setNAV(bytes32 itpId, uint256 nav) external {
        navs[itpId] = nav;
    }

    function getNAV(bytes32 itpId) external view returns (uint256) {
        return navs[itpId];
    }
}

/// @title ITPTest - Comprehensive tests for ITP.sol ERC4626 vault
contract ITPTest is Test {
    ITP public itp;
    MockUSDC public usdc;
    MockIndex public index;

    bytes32 public constant TEST_ITP_ID = keccak256("TEST_ITP");
    address public constant USER1 = address(0x1111);
    address public constant USER2 = address(0x2222);
    uint256 public constant INITIAL_NAV = 1e18; // $1 per share

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function setUp() public {
        // Deploy mock contracts
        usdc = new MockUSDC();
        index = new MockIndex();

        // Deploy ITP
        itp = new ITP(TEST_ITP_ID, address(index), "Test ITP Token", "TITP", IERC20(address(usdc)));

        // Set initial NAV to $1
        index.setNAV(TEST_ITP_ID, INITIAL_NAV);

        // Give users some USDC
        usdc.mint(USER1, 1000e18);
        usdc.mint(USER2, 1000e18);
    }

    // ============ CONSTRUCTOR TESTS ============

    function test_Constructor_SetsCorrectValues() public view {
        assertEq(itp.itpId(), TEST_ITP_ID);
        assertEq(itp.indexContract(), address(index));
        assertEq(itp.name(), "Test ITP Token");
        assertEq(itp.symbol(), "TITP");
        assertEq(itp.asset(), address(usdc));
        assertEq(itp.decimals(), 18);
    }

    function test_Constructor_RevertsOnZeroIndex() public {
        vm.expectRevert(ITP.ZeroAddress.selector);
        new ITP(TEST_ITP_ID, address(0), "Test", "TEST", IERC20(address(usdc)));
    }

    function test_Constructor_RevertsOnZeroAsset() public {
        vm.expectRevert(ITP.ZeroAddress.selector);
        new ITP(TEST_ITP_ID, address(index), "Test", "TEST", IERC20(address(0)));
    }

    function test_Constructor_WithEmptyName() public {
        // Empty name is allowed by ERC20 but creates a token with no name
        ITP emptyNameItp = new ITP(TEST_ITP_ID, address(index), "", "TEST", IERC20(address(usdc)));
        assertEq(emptyNameItp.name(), "");
    }

    function test_Constructor_WithEmptySymbol() public {
        // Empty symbol is allowed by ERC20 but creates a token with no symbol
        ITP emptySymbolItp = new ITP(TEST_ITP_ID, address(index), "Test", "", IERC20(address(usdc)));
        assertEq(emptySymbolItp.symbol(), "");
    }

    // ============ TOTAL ASSETS TESTS (AC: #2) ============

    function test_TotalAssets_ReturnsZeroWhenNoSupply() public view {
        assertEq(itp.totalSupply(), 0);
        assertEq(itp.totalAssets(), 0);
    }

    function test_TotalAssets_ReturnsCorrectComputedValue() public {
        // Mint 100 shares via Index
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        // NAV is $1 (1e18), so totalAssets should be 100 * 1e18 / 1e18 = 100e18
        assertEq(itp.totalAssets(), 100e18);
    }

    function test_TotalAssets_UpdatesWithNAVChange() public {
        // Mint 100 shares
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        // Change NAV to $2
        index.setNAV(TEST_ITP_ID, 2e18);

        // totalAssets should now be 100 * 2e18 / 1e18 = 200e18
        assertEq(itp.totalAssets(), 200e18);
    }

    function test_TotalAssets_WithFractionalNAV() public {
        // Mint 100 shares
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        // Set NAV to $1.50
        index.setNAV(TEST_ITP_ID, 1.5e18);

        // totalAssets should be 100 * 1.5e18 / 1e18 = 150e18
        assertEq(itp.totalAssets(), 150e18);
    }

    // ============ CONVERT TO SHARES TESTS (AC: #3) ============

    function test_ConvertToShares_StandardCalculation() public view {
        // NAV is $1, so 100 USDC = 100 shares
        assertEq(itp.convertToShares(100e18), 100e18);
    }

    function test_ConvertToShares_WithHigherNAV() public {
        // Set NAV to $2
        index.setNAV(TEST_ITP_ID, 2e18);

        // 100 USDC should get 50 shares at $2 NAV
        assertEq(itp.convertToShares(100e18), 50e18);
    }

    function test_ConvertToShares_WithLowerNAV() public {
        // Set NAV to $0.50
        index.setNAV(TEST_ITP_ID, 0.5e18);

        // 100 USDC should get 200 shares at $0.50 NAV
        assertEq(itp.convertToShares(100e18), 200e18);
    }

    function test_ConvertToShares_ZeroNAV_ReturnsOneToOne() public {
        // Set NAV to 0 (edge case)
        index.setNAV(TEST_ITP_ID, 0);

        // Should return 1:1
        assertEq(itp.convertToShares(100e18), 100e18);
    }

    function test_ConvertToShares_SmallAmount() public view {
        // 0.001 USDC with $1 NAV
        assertEq(itp.convertToShares(1e15), 1e15);
    }

    function test_ConvertToShares_LargeAmount() public view {
        // 1 million USDC
        assertEq(itp.convertToShares(1_000_000e18), 1_000_000e18);
    }

    // ============ CONVERT TO ASSETS TESTS (AC: #4) ============

    function test_ConvertToAssets_StandardCalculation() public view {
        // NAV is $1, so 100 shares = 100 USDC
        assertEq(itp.convertToAssets(100e18), 100e18);
    }

    function test_ConvertToAssets_WithHigherNAV() public {
        // Set NAV to $2
        index.setNAV(TEST_ITP_ID, 2e18);

        // 100 shares at $2 NAV = 200 USDC
        assertEq(itp.convertToAssets(100e18), 200e18);
    }

    function test_ConvertToAssets_WithLowerNAV() public {
        // Set NAV to $0.50
        index.setNAV(TEST_ITP_ID, 0.5e18);

        // 100 shares at $0.50 NAV = 50 USDC
        assertEq(itp.convertToAssets(100e18), 50e18);
    }

    function test_ConvertToAssets_ZeroNAV_ReturnsZero() public {
        // Set NAV to 0
        index.setNAV(TEST_ITP_ID, 0);

        // 100 shares * 0 NAV = 0 USDC
        assertEq(itp.convertToAssets(100e18), 0);
    }

    function test_ConvertToAssets_SmallAmount() public view {
        // 0.001 shares with $1 NAV
        assertEq(itp.convertToAssets(1e15), 1e15);
    }

    function test_ConvertToAssets_LargeAmount() public view {
        // 1 million shares
        assertEq(itp.convertToAssets(1_000_000e18), 1_000_000e18);
    }

    // ============ MINT SUCCESS TESTS (AC: #5) ============

    function test_Mint_SucceedsWhenCalledByIndex() public {
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        assertEq(itp.balanceOf(USER1), 100e18);
        assertEq(itp.totalSupply(), 100e18);
    }

    function test_Mint_EmitsTransferEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Transfer(address(0), USER1, 100e18);

        vm.prank(address(index));
        itp.mint(USER1, 100e18);
    }

    function test_Mint_MultipleMints() public {
        vm.startPrank(address(index));
        itp.mint(USER1, 100e18);
        itp.mint(USER1, 50e18);
        itp.mint(USER2, 25e18);
        vm.stopPrank();

        assertEq(itp.balanceOf(USER1), 150e18);
        assertEq(itp.balanceOf(USER2), 25e18);
        assertEq(itp.totalSupply(), 175e18);
    }

    function test_Mint_ZeroAmount() public {
        vm.prank(address(index));
        itp.mint(USER1, 0);

        assertEq(itp.balanceOf(USER1), 0);
        assertEq(itp.totalSupply(), 0);
    }

    // ============ MINT REVERT TESTS (AC: #5) ============

    function test_Mint_RevertsWhenCalledByNonIndex() public {
        vm.expectRevert(ITP.OnlyIndexAllowed.selector);
        vm.prank(USER1);
        itp.mint(USER1, 100e18);
    }

    function test_Mint_RevertsWhenCalledByRandomAddress() public {
        vm.expectRevert(ITP.OnlyIndexAllowed.selector);
        vm.prank(address(0x9999));
        itp.mint(USER1, 100e18);
    }

    // ============ BURN SUCCESS TESTS (AC: #6) ============

    function test_Burn_SucceedsWhenCalledByIndex() public {
        // First mint some tokens
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        // Then burn
        vm.prank(address(index));
        itp.burn(USER1, 50e18);

        assertEq(itp.balanceOf(USER1), 50e18);
        assertEq(itp.totalSupply(), 50e18);
    }

    function test_Burn_EmitsTransferEvent() public {
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        vm.expectEmit(true, true, false, true);
        emit Transfer(USER1, address(0), 50e18);

        vm.prank(address(index));
        itp.burn(USER1, 50e18);
    }

    function test_Burn_AllTokens() public {
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        vm.prank(address(index));
        itp.burn(USER1, 100e18);

        assertEq(itp.balanceOf(USER1), 0);
        assertEq(itp.totalSupply(), 0);
    }

    // ============ BURN REVERT TESTS (AC: #6) ============

    function test_Burn_RevertsWhenCalledByNonIndex() public {
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        vm.expectRevert(ITP.OnlyIndexAllowed.selector);
        vm.prank(USER1);
        itp.burn(USER1, 50e18);
    }

    function test_Burn_RevertsWhenCalledByRandomAddress() public {
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        vm.expectRevert(ITP.OnlyIndexAllowed.selector);
        vm.prank(address(0x9999));
        itp.burn(USER1, 50e18);
    }

    // ============ DEPOSIT REVERT TESTS (AC: #7) ============

    function test_Deposit_AlwaysReverts() public {
        vm.expectRevert(ITP.DirectDepositNotAllowed.selector);
        itp.deposit(100e18, USER1);
    }

    function test_Deposit_RevertsEvenFromIndex() public {
        vm.expectRevert(ITP.DirectDepositNotAllowed.selector);
        vm.prank(address(index));
        itp.deposit(100e18, USER1);
    }

    // ============ WITHDRAW REVERT TESTS (AC: #7) ============

    function test_Withdraw_AlwaysReverts() public {
        vm.expectRevert(ITP.DirectWithdrawNotAllowed.selector);
        itp.withdraw(100e18, USER1, USER1);
    }

    function test_Withdraw_RevertsEvenFromIndex() public {
        vm.expectRevert(ITP.DirectWithdrawNotAllowed.selector);
        vm.prank(address(index));
        itp.withdraw(100e18, USER1, USER1);
    }

    // ============ REDEEM REVERT TESTS (AC: #7) ============

    function test_Redeem_AlwaysReverts() public {
        vm.expectRevert(ITP.DirectWithdrawNotAllowed.selector);
        itp.redeem(100e18, USER1, USER1);
    }

    function test_Redeem_RevertsEvenFromIndex() public {
        vm.expectRevert(ITP.DirectWithdrawNotAllowed.selector);
        vm.prank(address(index));
        itp.redeem(100e18, USER1, USER1);
    }

    // ============ ERC4626 MINT (uint256, address) REVERT TESTS ============

    function test_ERC4626Mint_AlwaysReverts() public {
        vm.expectRevert(ITP.DirectDepositNotAllowed.selector);
        itp.mint(100e18, USER1);
    }

    // ============ MAX DEPOSIT/MINT TESTS ============

    function test_MaxDeposit_ReturnsZero() public view {
        assertEq(itp.maxDeposit(USER1), 0);
        assertEq(itp.maxDeposit(address(0)), 0);
    }

    function test_MaxMint_ReturnsZero() public view {
        assertEq(itp.maxMint(USER1), 0);
        assertEq(itp.maxMint(address(0)), 0);
    }

    // ============ MAX WITHDRAW/REDEEM TESTS ============

    function test_MaxWithdraw_ReturnsZero() public view {
        assertEq(itp.maxWithdraw(USER1), 0);
        assertEq(itp.maxWithdraw(address(0)), 0);
    }

    function test_MaxRedeem_ReturnsZero() public view {
        assertEq(itp.maxRedeem(USER1), 0);
        assertEq(itp.maxRedeem(address(0)), 0);
    }

    function test_MaxWithdraw_StillZeroWithBalance() public {
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        // Even with balance, maxWithdraw should be 0
        assertEq(itp.maxWithdraw(USER1), 0);
    }

    function test_MaxRedeem_StillZeroWithBalance() public {
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        // Even with balance, maxRedeem should be 0
        assertEq(itp.maxRedeem(USER1), 0);
    }

    // ============ PREVIEW FUNCTIONS TESTS ============

    function test_PreviewDeposit_ReturnsZero() public view {
        assertEq(itp.previewDeposit(100e18), 0);
    }

    function test_PreviewMint_ReturnsMaxUint() public view {
        assertEq(itp.previewMint(100e18), type(uint256).max);
    }

    function test_PreviewWithdraw_ReturnsMaxUint() public view {
        assertEq(itp.previewWithdraw(100e18), type(uint256).max);
    }

    function test_PreviewRedeem_ReturnsZero() public view {
        assertEq(itp.previewRedeem(100e18), 0);
    }

    // ============ ERC20 TRANSFER TESTS ============

    function test_Transfer_WorksBetweenUsers() public {
        // Mint to USER1
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        // Transfer to USER2
        vm.prank(USER1);
        itp.transfer(USER2, 30e18);

        assertEq(itp.balanceOf(USER1), 70e18);
        assertEq(itp.balanceOf(USER2), 30e18);
    }

    function test_Transfer_EmitsEvent() public {
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        vm.expectEmit(true, true, false, true);
        emit Transfer(USER1, USER2, 30e18);

        vm.prank(USER1);
        itp.transfer(USER2, 30e18);
    }

    function test_Transfer_RevertsOnInsufficientBalance() public {
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        vm.expectRevert();
        vm.prank(USER1);
        itp.transfer(USER2, 150e18);
    }

    // ============ ERC20 APPROVAL/TRANSFERFROM TESTS ============

    function test_Approve_Works() public {
        vm.prank(USER1);
        itp.approve(USER2, 100e18);

        assertEq(itp.allowance(USER1, USER2), 100e18);
    }

    function test_Approve_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Approval(USER1, USER2, 100e18);

        vm.prank(USER1);
        itp.approve(USER2, 100e18);
    }

    function test_TransferFrom_Works() public {
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        // Approve USER2 to spend
        vm.prank(USER1);
        itp.approve(USER2, 50e18);

        // USER2 transfers from USER1
        vm.prank(USER2);
        itp.transferFrom(USER1, USER2, 30e18);

        assertEq(itp.balanceOf(USER1), 70e18);
        assertEq(itp.balanceOf(USER2), 30e18);
        assertEq(itp.allowance(USER1, USER2), 20e18);
    }

    function test_TransferFrom_RevertsOnInsufficientAllowance() public {
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        vm.prank(USER1);
        itp.approve(USER2, 10e18);

        vm.expectRevert();
        vm.prank(USER2);
        itp.transferFrom(USER1, USER2, 50e18);
    }

    // ============ ASSET AND DECIMALS TESTS ============

    function test_Asset_ReturnsUSDC() public view {
        assertEq(itp.asset(), address(usdc));
    }

    function test_Decimals_Returns18() public view {
        assertEq(itp.decimals(), 18);
    }

    // ============ FUZZ TESTS ============

    function testFuzz_ConvertToShares_InverseOfConvertToAssets(uint256 shares) public view {
        // Bound to reasonable values to avoid overflow
        shares = bound(shares, 1, 1e30);

        uint256 assets = itp.convertToAssets(shares);
        uint256 backToShares = itp.convertToShares(assets);

        // Should be equal (with standard NAV of 1e18)
        assertEq(backToShares, shares);
    }

    function testFuzz_ConvertToAssets_InverseOfConvertToShares(uint256 assets) public view {
        // Bound to reasonable values
        assets = bound(assets, 1, 1e30);

        uint256 shares = itp.convertToShares(assets);
        uint256 backToAssets = itp.convertToAssets(shares);

        // Should be equal (with standard NAV of 1e18)
        assertEq(backToAssets, assets);
    }

    function testFuzz_Mint_OnlyIndex(address caller, uint256 amount) public {
        vm.assume(caller != address(index));
        amount = bound(amount, 1, 1e30);

        vm.expectRevert(ITP.OnlyIndexAllowed.selector);
        vm.prank(caller);
        itp.mint(USER1, amount);
    }

    function testFuzz_Burn_OnlyIndex(address caller, uint256 amount) public {
        vm.assume(caller != address(index));
        amount = bound(amount, 1, 1e30);

        // First mint tokens
        vm.prank(address(index));
        itp.mint(USER1, amount);

        // Try to burn from non-Index
        vm.expectRevert(ITP.OnlyIndexAllowed.selector);
        vm.prank(caller);
        itp.burn(USER1, amount);
    }

    function testFuzz_TotalAssets_ScalesWithSupplyAndNAV(uint256 supply, uint256 nav) public {
        // Bound to prevent overflow
        supply = bound(supply, 1, 1e24);
        nav = bound(nav, 1, 1e24);

        // Mint supply
        vm.prank(address(index));
        itp.mint(USER1, supply);

        // Set NAV
        index.setNAV(TEST_ITP_ID, nav);

        // totalAssets = nav * supply / 1e18
        uint256 expected = (nav * supply) / 1e18;
        assertEq(itp.totalAssets(), expected);
    }

    // ============ EDGE CASE TESTS ============

    function test_VeryLargeNAV() public {
        // Set NAV to $1 trillion per share
        index.setNAV(TEST_ITP_ID, 1e30);

        // Mint 1 share
        vm.prank(address(index));
        itp.mint(USER1, 1e18);

        // totalAssets should be 1e30 (1 trillion USDC)
        assertEq(itp.totalAssets(), 1e30);
    }

    function test_VerySmallNAV() public {
        // Set NAV to $0.000001 per share
        index.setNAV(TEST_ITP_ID, 1e12);

        // Mint 1 million shares
        vm.prank(address(index));
        itp.mint(USER1, 1_000_000e18);

        // totalAssets should be 1e12 * 1e24 / 1e18 = 1e18 ($1)
        assertEq(itp.totalAssets(), 1e18);
    }

    // ============ ROUNDING TESTS ============

    function test_ConvertToShares_RoundingDown() public {
        // Set NAV to $3 - causes rounding when dividing by 3
        index.setNAV(TEST_ITP_ID, 3e18);

        // 1 USDC / $3 NAV = 0.333... shares
        // Should round DOWN (ERC4626 convention for deposits)
        uint256 shares = itp.convertToShares(1e18);
        assertEq(shares, 333333333333333333); // 0.333... * 1e18, rounded down

        // Verify rounding direction: shares * NAV / 1e18 <= assets
        uint256 backToAssets = itp.convertToAssets(shares);
        assertLe(backToAssets, 1e18);
    }

    function test_ConvertToAssets_RoundingDown() public {
        // Set NAV to $3
        index.setNAV(TEST_ITP_ID, 3e18);

        // 1 share * $3 NAV = 3 USDC (exact, no rounding)
        assertEq(itp.convertToAssets(1e18), 3e18);

        // With non-round number: 0.5 shares * $3 = 1.5 USDC
        assertEq(itp.convertToAssets(0.5e18), 1.5e18);
    }

    function test_ConversionRoundTrip_NotAlwaysExact() public {
        // Set NAV to value that causes rounding
        index.setNAV(TEST_ITP_ID, 3e18);

        uint256 originalAssets = 1e18;
        uint256 shares = itp.convertToShares(originalAssets);
        uint256 backToAssets = itp.convertToAssets(shares);

        // Due to rounding, we may not get exact same amount back
        // This is expected ERC4626 behavior - shares round down on deposit
        assertLe(backToAssets, originalAssets);
    }

    function test_ConversionRoundTrip_ExactWithCleanNAV() public {
        // NAV of $1 (1e18) gives clean division
        // Already set in setUp()

        uint256 originalAssets = 1e18;
        uint256 shares = itp.convertToShares(originalAssets);
        uint256 backToAssets = itp.convertToAssets(shares);

        // With $1 NAV, round trip should be exact
        assertEq(backToAssets, originalAssets);
    }

    // ============ BURN EDGE CASES ============

    function test_Burn_RevertsOnInsufficientBalance() public {
        // Mint 100 shares
        vm.prank(address(index));
        itp.mint(USER1, 100e18);

        // Try to burn more than balance - should revert with ERC20 error
        vm.expectRevert();
        vm.prank(address(index));
        itp.burn(USER1, 200e18);
    }

    function test_Burn_RevertsOnZeroBalance() public {
        // USER1 has no shares, try to burn
        assertEq(itp.balanceOf(USER1), 0);

        vm.expectRevert();
        vm.prank(address(index));
        itp.burn(USER1, 1e18);
    }
}
