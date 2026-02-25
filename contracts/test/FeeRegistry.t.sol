// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";
import "../src/registry/FeeRegistry.sol";
import "../src/interfaces/IFeeRegistry.sol";
import "../src/libraries/TypesLib.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title FeeRegistryTest - Comprehensive tests for FeeRegistry
/// @notice Tests all acceptance criteria for Story 2.14
contract FeeRegistryTest is TestHelper {
    FeeRegistry public registry;
    address public feeRegistryProxy;
    Governance governance;
    IssuerRegistry issuerReg;

    address public admin = address(0x1);
    address public user = address(0x2);
    address public deployer = address(0x3);
    address public recipient = address(0x4);
    address public authorizedCaller = address(0x5);

    // Test ITP IDs
    bytes32 constant ITP_1 = keccak256("ITP_1");
    bytes32 constant ITP_2 = keccak256("ITP_2");

    // Standard test amounts (18 decimals)
    uint256 constant AMOUNT = 1000e18;
    uint256 constant SMALL_AMOUNT = 100e18;

    // Fee types for convenience
    TypesLib.FeeType constant TRADING = TypesLib.FeeType.TRADING;
    TypesLib.FeeType constant MANAGEMENT = TypesLib.FeeType.MANAGEMENT;
    TypesLib.FeeType constant BRIDGE = TypesLib.FeeType.BRIDGE;
    TypesLib.FeeType constant GAS = TypesLib.FeeType.GAS;

    // Events
    event FeeRateUpdated(bytes32 indexed itpId, uint256 oldRate, uint256 newRate);
    event FeeCharged(address indexed user, bytes32 indexed itpId, uint256 amount, TypesLib.FeeType feeType);
    event FeeSplitUpdated(uint256 deployerShareBps);
    event FeesClaimed(bytes32 indexed itpId, address indexed recipient, uint256 amount);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event AggregatedPubkeyUpdated(bytes pubkey);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event ITPDeployerRegistered(bytes32 indexed itpId, address indexed deployer);
    event BLSLibraryUpdated(address indexed blsLibrary);

    function setUp() public {
        // Deploy BLS infrastructure
        governance = deployGovernance(admin);
        issuerReg = deployIssuerRegistry(address(governance));
        registerTestIssuersWithBLS(issuerReg, admin);

        // Deploy implementation
        FeeRegistry implementation = new FeeRegistry();

        // Deploy proxy with initialize call
        bytes memory initData = abi.encodeWithSelector(FeeRegistry.initialize.selector, admin);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        // Cast proxy to FeeRegistry
        feeRegistryProxy = address(proxy);
        registry = FeeRegistry(feeRegistryProxy);

        // Set the IssuerRegistry for BLS verification
        vm.prank(admin);
        registry.setIssuerRegistry(address(issuerReg));

        // Authorize test contract to call FeeRegistry functions
        vm.prank(admin);
        registry.setAuthorizedCaller(address(this), true);
    }

    // ============ BLS SIGNING HELPERS ============

    function _signSetFeeRate(bytes32 itpId, uint256 feeRate) internal returns (bytes memory) {
        uint256 nonce = registry.getNonce();
        bytes32 message = keccak256(
            abi.encode(block.chainid, feeRegistryProxy, "setFeeRate", itpId, feeRate, nonce)
        );
        return signWithTestIssuers(message);
    }

    function _signRecordFeeCharge(address _user, bytes32 itpId, uint256 feeAmount, TypesLib.FeeType feeType) internal returns (bytes memory) {
        uint256 nonce = registry.getNonce();
        bytes32 message = keccak256(
            abi.encode(block.chainid, feeRegistryProxy, "recordFeeCharge", _user, itpId, feeAmount, feeType, nonce)
        );
        return signWithTestIssuers(message);
    }

    function _signSetFeeSplit(uint256 splitBps) internal returns (bytes memory) {
        uint256 nonce = registry.getNonce();
        bytes32 message = keccak256(
            abi.encode(block.chainid, feeRegistryProxy, "setFeeSplit", splitBps, nonce)
        );
        return signWithTestIssuers(message);
    }

    // ============ INITIALIZER TESTS ============

    function test_Initialize_SetsAdmin() public view {
        assertEq(registry.admin(), admin);
    }

    function test_Initialize_SetsDefaultDeployerShare() public view {
        assertEq(registry.deployerShareBps(), 7000); // 70%
    }

    function test_Initialize_AuthorizesAdmin() public view {
        assertTrue(registry.authorizedCallers(admin));
    }

    function test_Initialize_RevertsOnZeroAddress() public {
        FeeRegistry implementation = new FeeRegistry();
        bytes memory initData = abi.encodeWithSelector(FeeRegistry.initialize.selector, address(0));
        vm.expectRevert(FeeRegistry.ZeroAddress.selector);
        new ERC1967Proxy(address(implementation), initData);
    }

    function test_Initialize_CannotBeCalledTwice() public {
        vm.expectRevert(); // Initializable: contract is already initialized
        registry.initialize(admin);
    }

    // ============ AC2: SET FEE RATE TESTS ============

    function test_SetFeeRate_WithValidRate() public {
        uint256 feeRate = 500; // 5%

        vm.expectEmit(true, false, false, true);
        emit FeeRateUpdated(ITP_1, 0, feeRate);

        registry.setFeeRate(ITP_1, feeRate, _signSetFeeRate(ITP_1, feeRate), 3, 7);

        assertEq(registry.getFeeRate(ITP_1), feeRate);
    }

    function test_SetFeeRate_RevertsIfRateExceeds10Percent() public {
        uint256 feeRate = 1001; // 10.01% - exceeds max

        bytes memory sig = _signSetFeeRate(ITP_1, feeRate);
        vm.expectRevert(abi.encodeWithSelector(FeeRegistry.FeeRateExceedsMax.selector, feeRate, 1000));
        registry.setFeeRate(ITP_1, feeRate, sig, 3, 7);
    }

    function test_SetFeeRate_AllowsExactlyMaxRate() public {
        uint256 feeRate = 1000; // 10% - exactly max

        registry.setFeeRate(ITP_1, feeRate, _signSetFeeRate(ITP_1, feeRate), 3, 7);

        assertEq(registry.getFeeRate(ITP_1), feeRate);
    }

    function test_SetFeeRate_AllowsZeroRate() public {
        registry.setFeeRate(ITP_1, 0, _signSetFeeRate(ITP_1, 0), 3, 7);
        assertEq(registry.getFeeRate(ITP_1), 0);
    }

    function test_SetFeeRate_UpdatesExistingRate() public {
        registry.setFeeRate(ITP_1, 500, _signSetFeeRate(ITP_1, 500), 3, 7);
        assertEq(registry.getFeeRate(ITP_1), 500);

        vm.expectEmit(true, false, false, true);
        emit FeeRateUpdated(ITP_1, 500, 300);

        registry.setFeeRate(ITP_1, 300, _signSetFeeRate(ITP_1, 300), 3, 7);
        assertEq(registry.getFeeRate(ITP_1), 300);
    }

    function test_SetFeeRate_RevertsForUnauthorized() public {
        bytes memory sig = _signSetFeeRate(ITP_1, 500);
        vm.prank(user);
        vm.expectRevert(FeeRegistry.Unauthorized.selector);
        registry.setFeeRate(ITP_1, 500, sig, 3, 7);
    }

    // ============ AC3 & AC4: RECORD FEE CHARGE TESTS ============

    function test_RecordFeeCharge_TradingFee() public {
        vm.expectEmit(true, true, false, true);
        emit FeeCharged(user, ITP_1, AMOUNT, TRADING);

        registry.recordFeeCharge(user, ITP_1, AMOUNT, TRADING, _signRecordFeeCharge(user, ITP_1, AMOUNT, TRADING), 3, 7);

        (uint256 trading,,,) = registry.getAccumulatedFees(ITP_1);
        assertEq(trading, AMOUNT);
    }

    function test_RecordFeeCharge_ManagementFee() public {
        vm.expectEmit(true, true, false, true);
        emit FeeCharged(user, ITP_1, AMOUNT, MANAGEMENT);

        registry.recordFeeCharge(user, ITP_1, AMOUNT, MANAGEMENT, _signRecordFeeCharge(user, ITP_1, AMOUNT, MANAGEMENT), 3, 7);

        (, uint256 management,,) = registry.getAccumulatedFees(ITP_1);
        assertEq(management, AMOUNT);
    }

    function test_RecordFeeCharge_BridgeFee() public {
        vm.expectEmit(true, true, false, true);
        emit FeeCharged(user, ITP_1, AMOUNT, BRIDGE);

        registry.recordFeeCharge(user, ITP_1, AMOUNT, BRIDGE, _signRecordFeeCharge(user, ITP_1, AMOUNT, BRIDGE), 3, 7);

        (,, uint256 bridge,) = registry.getAccumulatedFees(ITP_1);
        assertEq(bridge, AMOUNT);
    }

    function test_RecordFeeCharge_GasFee() public {
        vm.expectEmit(true, true, false, true);
        emit FeeCharged(user, ITP_1, AMOUNT, GAS);

        registry.recordFeeCharge(user, ITP_1, AMOUNT, GAS, _signRecordFeeCharge(user, ITP_1, AMOUNT, GAS), 3, 7);

        (,,, uint256 gas) = registry.getAccumulatedFees(ITP_1);
        assertEq(gas, AMOUNT);
    }

    function test_RecordFeeCharge_AllTypesTrackedSeparately() public {
        registry.recordFeeCharge(user, ITP_1, 100e18, TRADING, _signRecordFeeCharge(user, ITP_1, 100e18, TRADING), 3, 7);
        registry.recordFeeCharge(user, ITP_1, 200e18, MANAGEMENT, _signRecordFeeCharge(user, ITP_1, 200e18, MANAGEMENT), 3, 7);
        registry.recordFeeCharge(user, ITP_1, 300e18, BRIDGE, _signRecordFeeCharge(user, ITP_1, 300e18, BRIDGE), 3, 7);
        registry.recordFeeCharge(user, ITP_1, 400e18, GAS, _signRecordFeeCharge(user, ITP_1, 400e18, GAS), 3, 7);

        (uint256 trading, uint256 management, uint256 bridge, uint256 gas) = registry.getAccumulatedFees(ITP_1);
        assertEq(trading, 100e18);
        assertEq(management, 200e18);
        assertEq(bridge, 300e18);
        assertEq(gas, 400e18);
    }

    function test_RecordFeeCharge_RevertsOnZeroAddress() public {
        bytes memory sig = _signRecordFeeCharge(address(0), ITP_1, AMOUNT, TRADING);
        vm.expectRevert(FeeRegistry.ZeroAddress.selector);
        registry.recordFeeCharge(address(0), ITP_1, AMOUNT, TRADING, sig, 3, 7);
    }

    function test_RecordFeeCharge_RevertsOnZeroAmount() public {
        bytes memory sig = _signRecordFeeCharge(user, ITP_1, 0, TRADING);
        vm.expectRevert(FeeRegistry.ZeroAmount.selector);
        registry.recordFeeCharge(user, ITP_1, 0, TRADING, sig, 3, 7);
    }

    function test_RecordFeeCharge_RevertsForUnauthorized() public {
        bytes memory sig = _signRecordFeeCharge(user, ITP_1, AMOUNT, TRADING);
        vm.prank(user);
        vm.expectRevert(FeeRegistry.Unauthorized.selector);
        registry.recordFeeCharge(user, ITP_1, AMOUNT, TRADING, sig, 3, 7);
    }

    // ============ AC5: GET ACCUMULATED FEES TESTS ============

    function test_GetAccumulatedFees_ReturnsCorrectTotals() public {
        registry.recordFeeCharge(user, ITP_1, 100e18, TRADING, _signRecordFeeCharge(user, ITP_1, 100e18, TRADING), 3, 7);
        registry.recordFeeCharge(user, ITP_1, 50e18, TRADING, _signRecordFeeCharge(user, ITP_1, 50e18, TRADING), 3, 7);
        registry.recordFeeCharge(user, ITP_1, 200e18, MANAGEMENT, _signRecordFeeCharge(user, ITP_1, 200e18, MANAGEMENT), 3, 7);

        (uint256 trading, uint256 management, uint256 bridge, uint256 gas) = registry.getAccumulatedFees(ITP_1);

        assertEq(trading, 150e18);
        assertEq(management, 200e18);
        assertEq(bridge, 0);
        assertEq(gas, 0);
    }

    function test_GetTotalFees_SumsAllTypes() public {
        registry.recordFeeCharge(user, ITP_1, 100e18, TRADING, _signRecordFeeCharge(user, ITP_1, 100e18, TRADING), 3, 7);
        registry.recordFeeCharge(user, ITP_1, 200e18, MANAGEMENT, _signRecordFeeCharge(user, ITP_1, 200e18, MANAGEMENT), 3, 7);
        registry.recordFeeCharge(user, ITP_1, 300e18, BRIDGE, _signRecordFeeCharge(user, ITP_1, 300e18, BRIDGE), 3, 7);
        registry.recordFeeCharge(user, ITP_1, 400e18, GAS, _signRecordFeeCharge(user, ITP_1, 400e18, GAS), 3, 7);

        uint256 total = registry.getTotalFees(ITP_1);
        assertEq(total, 1000e18);
    }

    function test_GetFeeRate_ReturnsCurrentRate() public {
        registry.setFeeRate(ITP_1, 750, _signSetFeeRate(ITP_1, 750), 3, 7);
        assertEq(registry.getFeeRate(ITP_1), 750);
    }

    function test_GetFeeRate_ReturnsZeroForUnsetITP() public view {
        assertEq(registry.getFeeRate(ITP_2), 0);
    }

    // ============ AC6: SET FEE SPLIT TESTS ============

    function test_SetFeeSplit_UpdatesDistribution() public {
        uint256 newShare = 6000; // 60%

        vm.expectEmit(false, false, false, true);
        emit FeeSplitUpdated(newShare);

        registry.setFeeSplit(newShare, _signSetFeeSplit(newShare), 3, 7);

        assertEq(registry.deployerShareBps(), newShare);
    }

    function test_SetFeeSplit_AllowsZeroShare() public {
        registry.setFeeSplit(0, _signSetFeeSplit(0), 3, 7);
        assertEq(registry.deployerShareBps(), 0);
    }

    function test_SetFeeSplit_AllowsFullShare() public {
        registry.setFeeSplit(10000, _signSetFeeSplit(10000), 3, 7); // 100%
        assertEq(registry.deployerShareBps(), 10000);
    }

    function test_SetFeeSplit_RevertsIfExceeds100Percent() public {
        bytes memory sig = _signSetFeeSplit(10001);
        vm.expectRevert(abi.encodeWithSelector(FeeRegistry.InvalidDeployerShare.selector, 10001));
        registry.setFeeSplit(10001, sig, 3, 7);
    }

    function test_SetFeeSplit_RevertsForUnauthorized() public {
        bytes memory sig = _signSetFeeSplit(6000);
        vm.prank(user);
        vm.expectRevert(FeeRegistry.Unauthorized.selector);
        registry.setFeeSplit(6000, sig, 3, 7);
    }

    // ============ AC7: CLAIM FEES TESTS ============

    function test_ClaimFees_CalculatesCorrectDeployerShare() public {
        // Register deployer for ITP_1
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        // Accumulate 1000 in fees
        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        // Default deployer share is 70%
        uint256 expectedClaimable = (1000e18 * 7000) / 10000; // 700e18

        vm.expectEmit(true, true, false, true);
        emit FeesClaimed(ITP_1, recipient, expectedClaimable);

        vm.prank(deployer);
        registry.claimFees(ITP_1, recipient);
    }

    function test_ClaimFees_OnlyCallableByITPDeployer() public {
        // Register deployer for ITP_1
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        registry.recordFeeCharge(user, ITP_1, AMOUNT, TRADING, _signRecordFeeCharge(user, ITP_1, AMOUNT, TRADING), 3, 7);

        // Try to claim from non-deployer
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(FeeRegistry.NotITPDeployer.selector, ITP_1, user, deployer));
        registry.claimFees(ITP_1, recipient);
    }

    function test_ClaimFees_RevertsIfNoDeployerRegistered() public {
        registry.recordFeeCharge(user, ITP_1, AMOUNT, TRADING, _signRecordFeeCharge(user, ITP_1, AMOUNT, TRADING), 3, 7);

        vm.prank(deployer);
        vm.expectRevert(abi.encodeWithSelector(FeeRegistry.NotITPDeployer.selector, ITP_1, deployer, address(0)));
        registry.claimFees(ITP_1, recipient);
    }

    function test_ClaimFees_RevertsIfNoFeesToClaim() public {
        // Register deployer but don't accumulate fees
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        vm.prank(deployer);
        vm.expectRevert(abi.encodeWithSelector(FeeRegistry.NoFeesToClaim.selector, ITP_1));
        registry.claimFees(ITP_1, recipient);
    }

    function test_ClaimFees_RevertsOnZeroRecipient() public {
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        registry.recordFeeCharge(user, ITP_1, AMOUNT, TRADING, _signRecordFeeCharge(user, ITP_1, AMOUNT, TRADING), 3, 7);

        vm.prank(deployer);
        vm.expectRevert(FeeRegistry.ZeroAddress.selector);
        registry.claimFees(ITP_1, address(0));
    }

    function test_ClaimFees_TracksClaimedAmounts() public {
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        // First batch of fees
        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        // First claim
        vm.prank(deployer);
        registry.claimFees(ITP_1, recipient);

        // After claiming 700e18 (70% of 1000), claimable should be 0
        assertEq(registry.getClaimableFees(ITP_1), 0);

        // Add more fees
        registry.recordFeeCharge(user, ITP_1, 500e18, TRADING, _signRecordFeeCharge(user, ITP_1, 500e18, TRADING), 3, 7);

        // Should be able to claim 70% of the new 500
        uint256 expectedClaimable = (500e18 * 7000) / 10000; // 350e18
        assertEq(registry.getClaimableFees(ITP_1), expectedClaimable);

        // Second claim
        vm.prank(deployer);
        registry.claimFees(ITP_1, recipient);

        assertEq(registry.getClaimableFees(ITP_1), 0);
    }

    function test_GetClaimableFees_ReturnsCorrectAmount() public {
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);
        registry.recordFeeCharge(user, ITP_1, 500e18, BRIDGE, _signRecordFeeCharge(user, ITP_1, 500e18, BRIDGE), 3, 7);

        // Total = 1500e18, deployer share = 70%
        uint256 expected = (1500e18 * 7000) / 10000; // 1050e18
        assertEq(registry.getClaimableFees(ITP_1), expected);
    }

    // ============ AC8: HIGH FEE ORDER DETECTION TESTS ============

    function test_IsHighFeeOrder_ReturnsTrueWhenFeeExceeds2Percent() public view {
        // 3% fee should trigger warning
        uint256 orderAmount = 100e18;
        uint256 fee = 3e18; // 3%

        assertTrue(registry.isHighFeeOrder(orderAmount, fee));
    }

    function test_IsHighFeeOrder_ReturnsFalseWhenFeeBelow2Percent() public view {
        // 1.5% fee should not trigger warning
        uint256 orderAmount = 100e18;
        uint256 fee = 1.5e18; // 1.5%

        assertFalse(registry.isHighFeeOrder(orderAmount, fee));
    }

    function test_IsHighFeeOrder_ReturnsFalseAtExactly2Percent() public view {
        // Exactly 2% should not trigger (threshold is >2%)
        uint256 orderAmount = 100e18;
        uint256 fee = 2e18; // 2%

        assertFalse(registry.isHighFeeOrder(orderAmount, fee));
    }

    function test_IsHighFeeOrder_ReturnsTrueForZeroOrderAmount() public view {
        // Edge case: zero order amount should return true
        assertTrue(registry.isHighFeeOrder(0, 1e18));
    }

    function test_IsHighFeeOrder_ReturnsFalseForZeroFee() public view {
        // Zero fee is never high
        assertFalse(registry.isHighFeeOrder(100e18, 0));
    }

    // ============ AC9: CALCULATE FEE SHARE TESTS ============

    function test_CalculateFeeShare_ProportionalCalculation() public view {
        // User A: $1000 of $5000 batch = 20%
        uint256 orderAmount = 1000e18;
        uint256 totalBatchAmount = 5000e18;
        uint256 totalFee = 50e18;

        uint256 feeShare = registry.calculateFeeShare(orderAmount, totalBatchAmount, totalFee);

        // Expected: 50 * 1000 / 5000 = 10
        assertEq(feeShare, 10e18);
    }

    function test_CalculateFeeShare_MultipleOrdersExample() public view {
        uint256 totalFee = 10e18;
        uint256 totalBatch = 5000e18;

        // User A: $1000 (20%) -> pays $2
        assertEq(registry.calculateFeeShare(1000e18, totalBatch, totalFee), 2e18);

        // User B: $3000 (60%) -> pays $6
        assertEq(registry.calculateFeeShare(3000e18, totalBatch, totalFee), 6e18);

        // User C: $1000 (20%) -> pays $2
        assertEq(registry.calculateFeeShare(1000e18, totalBatch, totalFee), 2e18);
    }

    function test_CalculateFeeShare_RevertsOnZeroBatchAmount() public {
        vm.expectRevert(FeeRegistry.DivisionByZero.selector);
        registry.calculateFeeShare(100e18, 0, 10e18);
    }

    function test_CalculateFeeShare_ZeroOrderAmount() public view {
        // Zero order amount should return zero fee share
        assertEq(registry.calculateFeeShare(0, 1000e18, 10e18), 0);
    }

    function test_CalculateFeeShare_ZeroTotalFee() public view {
        // Zero total fee should return zero
        assertEq(registry.calculateFeeShare(100e18, 1000e18, 0), 0);
    }

    // ============ REPLAY PROTECTION TESTS (AC11) ============

    function test_Nonce_IncrementsOnSetFeeRate() public {
        assertEq(registry.getNonce(), 0);

        registry.setFeeRate(ITP_1, 500, _signSetFeeRate(ITP_1, 500), 3, 7);
        assertEq(registry.getNonce(), 1);

        registry.setFeeRate(ITP_1, 600, _signSetFeeRate(ITP_1, 600), 3, 7);
        assertEq(registry.getNonce(), 2);
    }

    function test_Nonce_IncrementsOnRecordFeeCharge() public {
        assertEq(registry.getNonce(), 0);

        registry.recordFeeCharge(user, ITP_1, AMOUNT, TRADING, _signRecordFeeCharge(user, ITP_1, AMOUNT, TRADING), 3, 7);
        assertEq(registry.getNonce(), 1);

        registry.recordFeeCharge(user, ITP_1, AMOUNT, BRIDGE, _signRecordFeeCharge(user, ITP_1, AMOUNT, BRIDGE), 3, 7);
        assertEq(registry.getNonce(), 2);
    }

    function test_Nonce_IncrementsOnSetFeeSplit() public {
        assertEq(registry.getNonce(), 0);

        registry.setFeeSplit(6000, _signSetFeeSplit(6000), 3, 7);
        assertEq(registry.getNonce(), 1);
    }

    // ============ ADMIN FUNCTION TESTS ============

    function test_SetAdmin_OnlyAdmin() public {
        address newAdmin = address(0x888);

        vm.expectEmit(true, true, false, false);
        emit AdminChanged(admin, newAdmin);

        vm.prank(admin);
        registry.setAdmin(newAdmin);

        assertEq(registry.admin(), newAdmin);
    }

    function test_SetAdmin_RevertsOnZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(FeeRegistry.ZeroAddress.selector);
        registry.setAdmin(address(0));
    }

    function test_SetAdmin_RevertsForNonAdmin() public {
        vm.prank(user);
        vm.expectRevert(FeeRegistry.Unauthorized.selector);
        registry.setAdmin(user);
    }

    function test_SetAuthorizedCaller_OnlyAdmin() public {
        vm.expectEmit(true, false, false, true);
        emit AuthorizedCallerUpdated(authorizedCaller, true);

        vm.prank(admin);
        registry.setAuthorizedCaller(authorizedCaller, true);

        assertTrue(registry.authorizedCallers(authorizedCaller));
    }

    function test_SetAuthorizedCaller_RevertsForNonAdmin() public {
        vm.prank(user);
        vm.expectRevert(FeeRegistry.Unauthorized.selector);
        registry.setAuthorizedCaller(authorizedCaller, true);
    }

    function test_SetAuthorizedCaller_RevertsOnZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(FeeRegistry.ZeroAddress.selector);
        registry.setAuthorizedCaller(address(0), true);
    }

    function test_AuthorizedCaller_CanCallFunctions() public {
        vm.prank(admin);
        registry.setAuthorizedCaller(authorizedCaller, true);

        vm.prank(authorizedCaller);
        registry.setFeeRate(ITP_1, 500, _signSetFeeRate(ITP_1, 500), 3, 7);

        assertEq(registry.getFeeRate(ITP_1), 500);
    }

    function test_RevokedCaller_CannotCallFunctions() public {
        vm.prank(admin);
        registry.setAuthorizedCaller(authorizedCaller, true);
        vm.prank(admin);
        registry.setAuthorizedCaller(authorizedCaller, false);

        bytes memory sig = _signSetFeeRate(ITP_1, 500);
        vm.prank(authorizedCaller);
        vm.expectRevert(FeeRegistry.Unauthorized.selector);
        registry.setFeeRate(ITP_1, 500, sig, 3, 7);
    }

    function test_RegisterITPDeployer_AuthorizedCaller() public {
        vm.expectEmit(true, true, false, false);
        emit ITPDeployerRegistered(ITP_1, deployer);

        // Test contract is authorized in setUp
        registry.registerITPDeployer(ITP_1, deployer);

        assertEq(registry.getITPDeployer(ITP_1), deployer);
    }

    function test_RegisterITPDeployer_AdminCanCall() public {
        vm.expectEmit(true, true, false, false);
        emit ITPDeployerRegistered(ITP_1, deployer);

        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        assertEq(registry.getITPDeployer(ITP_1), deployer);
    }

    function test_RegisterITPDeployer_RevertsOnZeroAddress() public {
        vm.expectRevert(FeeRegistry.ZeroAddress.selector);
        registry.registerITPDeployer(ITP_1, address(0));
    }

    function test_RegisterITPDeployer_RevertsForUnauthorized() public {
        vm.prank(user);
        vm.expectRevert(FeeRegistry.Unauthorized.selector);
        registry.registerITPDeployer(ITP_1, deployer);
    }

    // ============ MULTIPLE ITPs TRACK INDEPENDENTLY ============

    function test_MultipleITPs_TrackIndependently() public {
        registry.recordFeeCharge(user, ITP_1, 100e18, TRADING, _signRecordFeeCharge(user, ITP_1, 100e18, TRADING), 3, 7);
        registry.recordFeeCharge(user, ITP_2, 500e18, TRADING, _signRecordFeeCharge(user, ITP_2, 500e18, TRADING), 3, 7);

        (uint256 trading1,,,) = registry.getAccumulatedFees(ITP_1);
        (uint256 trading2,,,) = registry.getAccumulatedFees(ITP_2);

        assertEq(trading1, 100e18);
        assertEq(trading2, 500e18);

        assertEq(registry.getTotalFees(ITP_1), 100e18);
        assertEq(registry.getTotalFees(ITP_2), 500e18);
    }

    function test_MultipleITPs_IndependentFeeRates() public {
        registry.setFeeRate(ITP_1, 500, _signSetFeeRate(ITP_1, 500), 3, 7);
        registry.setFeeRate(ITP_2, 800, _signSetFeeRate(ITP_2, 800), 3, 7);

        assertEq(registry.getFeeRate(ITP_1), 500);
        assertEq(registry.getFeeRate(ITP_2), 800);
    }

    // ============ EDGE CASES ============

    function test_EmptyAccumulatedFees_ForNewITP() public view {
        (uint256 trading, uint256 management, uint256 bridge, uint256 gas) = registry.getAccumulatedFees(ITP_2);

        assertEq(trading, 0);
        assertEq(management, 0);
        assertEq(bridge, 0);
        assertEq(gas, 0);
    }

    function test_GetClaimableFees_ReturnsZeroForNoFees() public view {
        assertEq(registry.getClaimableFees(ITP_1), 0);
    }

    function test_ClaimFees_WorksWithUpdatedFeeSplit() public {
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        // Accumulate fees
        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        // Change fee split to 50%
        registry.setFeeSplit(5000, _signSetFeeSplit(5000), 3, 7);

        // Claimable should now be 50%
        uint256 expected = (1000e18 * 5000) / 10000; // 500e18
        assertEq(registry.getClaimableFees(ITP_1), expected);

        vm.prank(deployer);
        registry.claimFees(ITP_1, recipient);

        assertEq(registry.getClaimableFees(ITP_1), 0);
    }

    // ============ CONSTANTS TESTS ============

    function test_Constants_AreCorrect() public view {
        assertEq(registry.MAX_FEE_RATE(), 1000);
        assertEq(registry.HIGH_FEE_THRESHOLD(), 200);
        assertEq(registry.DEFAULT_DEPLOYER_SHARE(), 7000);
        assertEq(registry.BASIS_POINTS(), 10000);
    }

    // ============ GET CLAIMED FEES TESTS ============

    function test_GetClaimedFees_ReturnsZeroInitially() public view {
        assertEq(registry.getClaimedFees(ITP_1), 0);
    }

    function test_GetClaimedFees_ReturnsCorrectAfterClaim() public {
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        vm.prank(deployer);
        registry.claimFees(ITP_1, recipient);

        // After claiming, claimedFees should equal total accumulated
        assertEq(registry.getClaimedFees(ITP_1), 1000e18);
    }

    // ============ CLAIM PROTOCOL FEES TESTS ============

    function test_ClaimProtocolFees_OnlyAdmin() public {
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        // Non-admin should fail
        vm.prank(user);
        vm.expectRevert(FeeRegistry.Unauthorized.selector);
        registry.claimProtocolFees(ITP_1, recipient);
    }

    function test_ClaimProtocolFees_CalculatesCorrectProtocolShare() public {
        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        // Default deployer share is 70%, so protocol gets 30%
        uint256 expectedProtocolShare = (1000e18 * 3000) / 10000; // 300e18

        vm.expectEmit(true, true, false, true);
        emit FeesClaimed(ITP_1, recipient, expectedProtocolShare);

        vm.prank(admin);
        registry.claimProtocolFees(ITP_1, recipient);
    }

    function test_ClaimProtocolFees_RevertsOnZeroRecipient() public {
        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        vm.prank(admin);
        vm.expectRevert(FeeRegistry.ZeroAddress.selector);
        registry.claimProtocolFees(ITP_1, address(0));
    }

    function test_ClaimProtocolFees_RevertsIfNoFees() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(FeeRegistry.NoFeesToClaim.selector, ITP_1));
        registry.claimProtocolFees(ITP_1, recipient);
    }

    function test_ClaimProtocolFees_RevertsIfAlreadyClaimed() public {
        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        // First claim should succeed
        vm.prank(admin);
        registry.claimProtocolFees(ITP_1, recipient);

        // Second claim should fail (no more fees)
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(FeeRegistry.NoFeesToClaim.selector, ITP_1));
        registry.claimProtocolFees(ITP_1, recipient);
    }

    function test_ClaimProtocolFees_WorksWithCustomFeeSplit() public {
        // Set deployer share to 50%, protocol gets 50%
        registry.setFeeSplit(5000, _signSetFeeSplit(5000), 3, 7);

        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        uint256 expectedProtocolShare = (1000e18 * 5000) / 10000; // 500e18

        vm.expectEmit(true, true, false, true);
        emit FeesClaimed(ITP_1, recipient, expectedProtocolShare);

        vm.prank(admin);
        registry.claimProtocolFees(ITP_1, recipient);
    }

    function test_DeployerCanClaimAfterProtocolClaim() public {
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        // Admin claims protocol fees first (30% = 300e18)
        vm.prank(admin);
        registry.claimProtocolFees(ITP_1, recipient);

        // Deployer should STILL be able to claim their share (70% = 700e18)
        // This is the FIX for the race condition bug
        uint256 expectedDeployerShare = (1000e18 * 7000) / 10000; // 700e18
        assertEq(registry.getClaimableFees(ITP_1), expectedDeployerShare);

        vm.expectEmit(true, true, false, true);
        emit FeesClaimed(ITP_1, recipient, expectedDeployerShare);

        vm.prank(deployer);
        registry.claimFees(ITP_1, recipient);

        // Both have now claimed their shares
        assertEq(registry.getClaimableFees(ITP_1), 0);
        assertEq(registry.getProtocolClaimableFees(ITP_1), 0);
    }

    function test_ProtocolCanClaimAfterDeployerClaim() public {
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        // Deployer claims first (70% = 700e18)
        vm.prank(deployer);
        registry.claimFees(ITP_1, recipient);

        // Protocol should STILL be able to claim their share (30% = 300e18)
        uint256 expectedProtocolShare = (1000e18 * 3000) / 10000; // 300e18
        assertEq(registry.getProtocolClaimableFees(ITP_1), expectedProtocolShare);

        vm.expectEmit(true, true, false, true);
        emit FeesClaimed(ITP_1, recipient, expectedProtocolShare);

        vm.prank(admin);
        registry.claimProtocolFees(ITP_1, recipient);

        // Both have now claimed their shares
        assertEq(registry.getClaimableFees(ITP_1), 0);
        assertEq(registry.getProtocolClaimableFees(ITP_1), 0);
    }

    function test_BothClaimsWorkIndependently() public {
        vm.prank(admin);
        registry.registerITPDeployer(ITP_1, deployer);

        // First batch of fees
        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        // Verify initial claimable amounts
        uint256 expectedDeployer = (1000e18 * 7000) / 10000; // 700e18
        uint256 expectedProtocol = (1000e18 * 3000) / 10000; // 300e18
        assertEq(registry.getClaimableFees(ITP_1), expectedDeployer);
        assertEq(registry.getProtocolClaimableFees(ITP_1), expectedProtocol);

        // Admin claims protocol share first
        vm.prank(admin);
        registry.claimProtocolFees(ITP_1, recipient);

        // Protocol can't claim again, but deployer still can
        assertEq(registry.getProtocolClaimableFees(ITP_1), 0);
        assertEq(registry.getClaimableFees(ITP_1), expectedDeployer);

        // Deployer claims their share
        vm.prank(deployer);
        registry.claimFees(ITP_1, recipient);

        // Both exhausted
        assertEq(registry.getClaimableFees(ITP_1), 0);
        assertEq(registry.getProtocolClaimableFees(ITP_1), 0);

        // Add more fees
        registry.recordFeeCharge(user, ITP_1, 500e18, TRADING, _signRecordFeeCharge(user, ITP_1, 500e18, TRADING), 3, 7);

        // Both can claim their shares of new fees
        uint256 newExpectedDeployer = (500e18 * 7000) / 10000; // 350e18
        uint256 newExpectedProtocol = (500e18 * 3000) / 10000; // 150e18
        assertEq(registry.getClaimableFees(ITP_1), newExpectedDeployer);
        assertEq(registry.getProtocolClaimableFees(ITP_1), newExpectedProtocol);
    }

    function test_GetProtocolClaimableFees_ReturnsCorrectAmount() public {
        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        // Default deployer share is 70%, protocol gets 30%
        uint256 expected = (1000e18 * 3000) / 10000; // 300e18
        assertEq(registry.getProtocolClaimableFees(ITP_1), expected);
    }

    function test_GetProtocolClaimableFees_ReturnsZeroAfterClaim() public {
        registry.recordFeeCharge(user, ITP_1, 1000e18, TRADING, _signRecordFeeCharge(user, ITP_1, 1000e18, TRADING), 3, 7);

        vm.prank(admin);
        registry.claimProtocolFees(ITP_1, recipient);

        assertEq(registry.getProtocolClaimableFees(ITP_1), 0);
    }
}
