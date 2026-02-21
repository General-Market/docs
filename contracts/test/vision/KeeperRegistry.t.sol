// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { KeeperRegistry } from "../../src/vision/KeeperRegistry.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockWINDKeeper
/// @notice Simple ERC20 mock for testing (18 decimals like WIND)
contract MockWINDKeeper is ERC20 {
    constructor() ERC20("WIND Token", "WIND") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title KeeperRegistryTest
/// @notice Unit tests for KeeperRegistry contract
contract KeeperRegistryTest is Test {
    KeeperRegistry public registry;
    MockWINDKeeper public wind;

    address public admin = address(0xAD);
    address public keeper1 = address(0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4);
    address public keeper2 = address(0xC0D3C8DFd3445fd2e4dfED9D11b5B7032B3BD1ac);
    address public keeper3 = address(0xC0D3C397033aa62245aF6A734D582C956ABd7Fa9);
    address public keeper4 = address(0xC0D4);

    uint256 constant INITIAL_BALANCE = 1000e18;
    uint256 constant MIN_STAKE = 100e18;

    // Test BLS pubkeys (128 bytes each - BN254 G2 points: 4 x 32 bytes)
    bytes public PUBKEY_1;
    bytes public PUBKEY_2;
    bytes public PUBKEY_3;
    bytes public PUBKEY_4;
    bytes public NEW_PUBKEY;

    // Test IPs
    bytes32 public constant IP_1 = bytes32(bytes("192.168.1.1:8080"));
    bytes32 public constant IP_2 = bytes32(bytes("192.168.1.2:8080"));
    bytes32 public constant IP_3 = bytes32(bytes("192.168.1.3:8080"));

    // Events
    event KeeperRegistered(address indexed keeper, bytes32 indexed ip, bytes blsPubkey, uint256 stake);
    event KeeperUpdated(address indexed keeper, bytes32 newIP);
    event KeeperSuspended(address indexed keeper, address indexed suspendedBy);
    event KeeperReinstated(address indexed keeper);
    event KeyRotationRequested(address indexed keeper, bytes newPubkey);
    event KeyRotationApproved(address indexed keeper, address indexed approver, uint256 currentApprovals);
    event KeyRotationExecuted(address indexed keeper, bytes oldPubkey, bytes newPubkey);
    event KeyRotationForced(address indexed keeper, bytes newPubkey);
    event KeyRotationCancelled(address indexed keeper);

    function setUp() public {
        wind = new MockWINDKeeper();
        registry = new KeeperRegistry(address(wind), admin);

        // Initialize BLS pubkeys (128 bytes each - 4 x 32 bytes for BN254 G2 points)
        PUBKEY_1 = abi.encodePacked(bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4)));
        PUBKEY_2 = abi.encodePacked(bytes32(uint256(5)), bytes32(uint256(6)), bytes32(uint256(7)), bytes32(uint256(8)));
        PUBKEY_3 = abi.encodePacked(bytes32(uint256(9)), bytes32(uint256(10)), bytes32(uint256(11)), bytes32(uint256(12)));
        PUBKEY_4 = abi.encodePacked(bytes32(uint256(13)), bytes32(uint256(14)), bytes32(uint256(15)), bytes32(uint256(16)));
        NEW_PUBKEY = abi.encodePacked(bytes32(uint256(100)), bytes32(uint256(200)), bytes32(uint256(300)), bytes32(uint256(400)));

        // Fund accounts
        wind.mint(keeper1, INITIAL_BALANCE);
        wind.mint(keeper2, INITIAL_BALANCE);
        wind.mint(keeper3, INITIAL_BALANCE);
        wind.mint(keeper4, INITIAL_BALANCE);

        // Approve registry for all keepers
        vm.prank(keeper1);
        wind.approve(address(registry), type(uint256).max);
        vm.prank(keeper2);
        wind.approve(address(registry), type(uint256).max);
        vm.prank(keeper3);
        wind.approve(address(registry), type(uint256).max);
        vm.prank(keeper4);
        wind.approve(address(registry), type(uint256).max);
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsWindToken() public view {
        assertEq(address(registry.WIND()), address(wind));
    }

    function test_Constructor_SetsAdmin() public view {
        assertEq(registry.ADMIN(), admin);
    }

    function test_Constructor_RevertsOnZeroWindAddress() public {
        vm.expectRevert(KeeperRegistry.ZeroAddress.selector);
        new KeeperRegistry(address(0), admin);
    }

    function test_Constructor_RevertsOnZeroAdminAddress() public {
        vm.expectRevert(KeeperRegistry.ZeroAddress.selector);
        new KeeperRegistry(address(wind), address(0));
    }

    function test_Constants_AreCorrect() public view {
        assertEq(registry.MIN_STAKE(), 100e18);
        assertEq(registry.SAFE_PERIOD(), 24 hours);
        assertEq(registry.FORCE_TIMEOUT(), 48 hours);
        assertEq(registry.BLS_PUBKEY_LENGTH(), 128);
    }

    // ============ Task 6.2: Test happy path registration with stake ============

    function test_RegisterKeeper_Success() public {
        uint256 balanceBefore = wind.balanceOf(keeper1);

        vm.expectEmit(true, true, false, true);
        emit KeeperRegistered(keeper1, IP_1, PUBKEY_1, MIN_STAKE);

        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        // Verify state
        KeeperRegistry.Keeper memory k = registry.getKeeperInfo(keeper1);
        assertEq(k.addr, keeper1);
        assertEq(k.ip, IP_1);
        assertEq(k.blsPubkey, PUBKEY_1);
        assertEq(uint256(k.status), uint256(KeeperRegistry.KeeperStatus.Active));
        assertGt(k.registeredAt, 0);
        assertEq(k.stakedAmount, MIN_STAKE);

        // Verify stake transferred
        assertEq(wind.balanceOf(keeper1), balanceBefore - MIN_STAKE);
        assertEq(wind.balanceOf(address(registry)), MIN_STAKE);

        // Verify isActiveKeeper
        assertTrue(registry.isActiveKeeper(keeper1));
    }

    function test_RegisterKeeper_MultipleKeepers() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.prank(keeper2);
        registry.registerKeeper(IP_2, PUBKEY_2);

        assertTrue(registry.isActiveKeeper(keeper1));
        assertTrue(registry.isActiveKeeper(keeper2));
        assertEq(registry.getKeeperCount(), 2);
        assertEq(wind.balanceOf(address(registry)), 2 * MIN_STAKE);
    }

    // ============ Task 6.3: Test registration with insufficient stake reverts ============

    function test_RegisterKeeper_RevertsWithInsufficientStake() public {
        address poorKeeper = address(0x9001);
        wind.mint(poorKeeper, 50e18); // Less than MIN_STAKE

        vm.prank(poorKeeper);
        wind.approve(address(registry), type(uint256).max);

        // Should revert on transfer (ERC20 revert)
        vm.prank(poorKeeper);
        vm.expectRevert();
        registry.registerKeeper(IP_1, PUBKEY_1);
    }

    function test_RegisterKeeper_RevertsWithNoApproval() public {
        address noApprovalKeeper = address(0xBA40);
        wind.mint(noApprovalKeeper, INITIAL_BALANCE);

        vm.prank(noApprovalKeeper);
        vm.expectRevert();
        registry.registerKeeper(IP_1, PUBKEY_1);
    }

    // ============ Task 6.4: Test duplicate registration reverts ============

    function test_RegisterKeeper_RevertsDuplicate() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.expectRevert(KeeperRegistry.AlreadyRegistered.selector);
        vm.prank(keeper1);
        registry.registerKeeper(IP_2, PUBKEY_2);
    }

    function test_RegisterKeeper_RevertsInvalidIP() public {
        vm.expectRevert(KeeperRegistry.InvalidIP.selector);
        vm.prank(keeper1);
        registry.registerKeeper(bytes32(0), PUBKEY_1);
    }

    function test_RegisterKeeper_RevertsInvalidPubkey() public {
        bytes memory shortPubkey = new bytes(64); // Only 64 bytes, need 128

        vm.expectRevert(KeeperRegistry.InvalidPubkey.selector);
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, shortPubkey);
    }

    // ============ Task 6.5: Test getActiveKeepers returns correct list ============

    function test_GetActiveKeepers_Empty() public view {
        (address[] memory addresses, bytes32[] memory ips, bytes[] memory pubkeys) = registry.getActiveKeepers();
        assertEq(addresses.length, 0);
        assertEq(ips.length, 0);
        assertEq(pubkeys.length, 0);
    }

    function test_GetActiveKeepers_SingleKeeper() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        (address[] memory addresses, bytes32[] memory ips, bytes[] memory pubkeys) = registry.getActiveKeepers();

        assertEq(addresses.length, 1);
        assertEq(addresses[0], keeper1);
        assertEq(ips[0], IP_1);
        assertEq(pubkeys[0], PUBKEY_1);
    }

    function test_GetActiveKeepers_MultipleKeepers() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.prank(keeper2);
        registry.registerKeeper(IP_2, PUBKEY_2);

        vm.prank(keeper3);
        registry.registerKeeper(IP_3, PUBKEY_3);

        (address[] memory addresses, bytes32[] memory ips, bytes[] memory pubkeys) = registry.getActiveKeepers();

        assertEq(addresses.length, 3);
        assertEq(ips.length, 3);
        assertEq(pubkeys.length, 3);

        // Verify all keepers are in the list
        bool foundKeeper1 = false;
        bool foundKeeper2 = false;
        bool foundKeeper3 = false;

        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] == keeper1) {
                foundKeeper1 = true;
                assertEq(ips[i], IP_1);
                assertEq(pubkeys[i], PUBKEY_1);
            } else if (addresses[i] == keeper2) {
                foundKeeper2 = true;
                assertEq(ips[i], IP_2);
                assertEq(pubkeys[i], PUBKEY_2);
            } else if (addresses[i] == keeper3) {
                foundKeeper3 = true;
                assertEq(ips[i], IP_3);
                assertEq(pubkeys[i], PUBKEY_3);
            }
        }

        assertTrue(foundKeeper1);
        assertTrue(foundKeeper2);
        assertTrue(foundKeeper3);
    }

    // ============ Task 6.6: Test suspendKeeper changes status ============

    function test_SuspendKeeper_Success() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        assertTrue(registry.isActiveKeeper(keeper1));

        vm.expectEmit(true, true, false, false);
        emit KeeperSuspended(keeper1, admin);

        vm.prank(admin);
        registry.suspendKeeper(keeper1);

        assertFalse(registry.isActiveKeeper(keeper1));

        KeeperRegistry.Keeper memory k = registry.getKeeperInfo(keeper1);
        assertEq(uint256(k.status), uint256(KeeperRegistry.KeeperStatus.Suspended));
    }

    function test_SuspendKeeper_ExcludesFromActiveList() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.prank(keeper2);
        registry.registerKeeper(IP_2, PUBKEY_2);

        // Suspend keeper1
        vm.prank(admin);
        registry.suspendKeeper(keeper1);

        (address[] memory addresses,,) = registry.getActiveKeepers();

        assertEq(addresses.length, 1);
        assertEq(addresses[0], keeper2);
    }

    function test_SuspendKeeper_RevertsNonAdmin() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.expectRevert(KeeperRegistry.OnlyAdmin.selector);
        vm.prank(keeper2);
        registry.suspendKeeper(keeper1);
    }

    function test_SuspendKeeper_RevertsNotActive() public {
        vm.expectRevert(abi.encodeWithSelector(KeeperRegistry.KeeperNotActive.selector, keeper1));
        vm.prank(admin);
        registry.suspendKeeper(keeper1);
    }

    // ============ Task 6.7: Test reinstateKeeper restores active status ============

    function test_ReinstateKeeper_Success() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.prank(admin);
        registry.suspendKeeper(keeper1);

        assertFalse(registry.isActiveKeeper(keeper1));

        vm.expectEmit(true, false, false, false);
        emit KeeperReinstated(keeper1);

        vm.prank(admin);
        registry.reinstateKeeper(keeper1);

        assertTrue(registry.isActiveKeeper(keeper1));
    }

    function test_ReinstateKeeper_RevertsNonAdmin() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.prank(admin);
        registry.suspendKeeper(keeper1);

        vm.expectRevert(KeeperRegistry.OnlyAdmin.selector);
        vm.prank(keeper2);
        registry.reinstateKeeper(keeper1);
    }

    function test_ReinstateKeeper_RevertsNotSuspended() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        // Keeper is Active, not Suspended
        vm.expectRevert(KeeperRegistry.NotRegistered.selector);
        vm.prank(admin);
        registry.reinstateKeeper(keeper1);
    }

    // ============ Task 6.8: Test updateIP success and event emission ============

    function test_UpdateIP_Success() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        bytes32 newIP = bytes32(bytes("10.0.0.1:9000"));

        vm.expectEmit(true, false, false, true);
        emit KeeperUpdated(keeper1, newIP);

        vm.prank(keeper1);
        registry.updateIP(newIP);

        KeeperRegistry.Keeper memory k = registry.getKeeperInfo(keeper1);
        assertEq(k.ip, newIP);
    }

    function test_UpdateIP_RevertsNotActive() public {
        vm.expectRevert(KeeperRegistry.OnlyActiveKeeper.selector);
        vm.prank(keeper1);
        registry.updateIP(IP_2);
    }

    function test_UpdateIP_RevertsInvalidIP() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.expectRevert(KeeperRegistry.InvalidIP.selector);
        vm.prank(keeper1);
        registry.updateIP(bytes32(0));
    }

    function test_UpdateIP_RevertsSuspendedKeeper() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.prank(admin);
        registry.suspendKeeper(keeper1);

        vm.expectRevert(KeeperRegistry.OnlyActiveKeeper.selector);
        vm.prank(keeper1);
        registry.updateIP(IP_2);
    }

    // ============ Task 6.9: Test requestKeyRotation creates pending rotation ============

    function test_RequestKeyRotation_Success() public {
        _registerThreeKeepers();

        vm.expectEmit(true, false, false, true);
        emit KeyRotationRequested(keeper1, NEW_PUBKEY);

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        (bytes memory newPubkey, uint256 requestedAt, uint256 approvalCount, uint256 threshold) =
            registry.getPendingRotation(keeper1);

        assertEq(newPubkey, NEW_PUBKEY);
        assertGt(requestedAt, 0);
        assertEq(approvalCount, 0);
        // With 3 keepers, 2 can vote (excluding self), threshold = ceil(2 * 2 / 3) = 2
        assertEq(threshold, 2);
    }

    function test_RequestKeyRotation_RevertsInvalidPubkey() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        bytes memory shortPubkey = new bytes(64); // Only 64 bytes, need 128

        vm.expectRevert(KeeperRegistry.InvalidPubkey.selector);
        vm.prank(keeper1);
        registry.requestKeyRotation(shortPubkey);
    }

    function test_RequestKeyRotation_RevertsNotActive() public {
        vm.expectRevert(KeeperRegistry.OnlyActiveKeeper.selector);
        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);
    }

    // ============ Task 6.10: Test approveKeyRotation tracks approvals correctly ============

    function test_ApproveKeyRotation_Success() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.expectEmit(true, true, false, true);
        emit KeyRotationApproved(keeper1, keeper2, 1);

        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        (, uint256 requestedAt, uint256 approvalCount,) = registry.getPendingRotation(keeper1);
        assertGt(requestedAt, 0);
        assertEq(approvalCount, 1);
        assertTrue(registry.hasApprovedRotation(keeper1, keeper2));
    }

    function test_ApproveKeyRotation_MultipleApprovals() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper3);
        registry.approveKeyRotation(keeper1);

        (,, uint256 approvalCount,) = registry.getPendingRotation(keeper1);
        assertEq(approvalCount, 2);
    }

    function test_ApproveKeyRotation_RevertsCannotApproveSelf() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.expectRevert(KeeperRegistry.CannotApproveSelf.selector);
        vm.prank(keeper1);
        registry.approveKeyRotation(keeper1);
    }

    function test_ApproveKeyRotation_RevertsAlreadyApproved() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        vm.expectRevert(KeeperRegistry.AlreadyApproved.selector);
        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);
    }

    function test_ApproveKeyRotation_RevertsNoPendingRotation() public {
        _registerThreeKeepers();

        // No rotation requested
        vm.expectRevert(KeeperRegistry.NotPendingRotation.selector);
        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);
    }

    // ============ Task 6.11: Test executeKeyRotation works after threshold met ============

    function test_ExecuteKeyRotation_Success() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        // Need 2 approvals for 3 keepers (2-of-2 remaining)
        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper3);
        registry.approveKeyRotation(keeper1);

        vm.expectEmit(true, false, false, true);
        emit KeyRotationExecuted(keeper1, PUBKEY_1, NEW_PUBKEY);

        vm.prank(keeper1);
        registry.executeKeyRotation();

        // Verify new key is set
        KeeperRegistry.Keeper memory k = registry.getKeeperInfo(keeper1);
        assertEq(k.blsPubkey, NEW_PUBKEY);
    }

    // ============ Task 6.12: Test executeKeyRotation reverts if threshold not met ============

    function test_ExecuteKeyRotation_RevertsThresholdNotMet() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        // Only 1 approval, need 2
        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        vm.expectRevert(KeeperRegistry.RotationNotApproved.selector);
        vm.prank(keeper1);
        registry.executeKeyRotation();
    }

    function test_ExecuteKeyRotation_RevertsNoPendingRotation() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.expectRevert(KeeperRegistry.NotPendingRotation.selector);
        vm.prank(keeper1);
        registry.executeKeyRotation();
    }

    // ============ Task 6.13: Test forceKeyRotation works after 48h timeout ============

    function test_ForceKeyRotation_Success() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        // Warp past 48 hours
        vm.warp(block.timestamp + 49 hours);

        vm.expectEmit(true, false, false, true);
        emit KeyRotationForced(keeper1, NEW_PUBKEY);

        vm.prank(admin);
        registry.forceKeyRotation(keeper1);

        // Verify new key is set
        KeeperRegistry.Keeper memory k = registry.getKeeperInfo(keeper1);
        assertEq(k.blsPubkey, NEW_PUBKEY);
    }

    // ============ Task 6.14: Test forceKeyRotation reverts before timeout ============

    function test_ForceKeyRotation_RevertsBeforeTimeout() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        // Only 24 hours elapsed
        vm.warp(block.timestamp + 24 hours);

        vm.expectRevert(abi.encodeWithSelector(KeeperRegistry.TimeoutNotReached.selector, 24 hours));
        vm.prank(admin);
        registry.forceKeyRotation(keeper1);
    }

    function test_ForceKeyRotation_RevertsNonAdmin() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.warp(block.timestamp + 49 hours);

        vm.expectRevert(KeeperRegistry.OnlyAdmin.selector);
        vm.prank(keeper2);
        registry.forceKeyRotation(keeper1);
    }

    function test_ForceKeyRotation_RevertsNoPendingRotation() public {
        _registerThreeKeepers();

        vm.expectRevert(KeeperRegistry.NotPendingRotation.selector);
        vm.prank(admin);
        registry.forceKeyRotation(keeper1);
    }

    // ============ Task 6.15: Test safe period - old key queries work during transition ============

    function test_SafePeriod_OldKeyValidDuringTransition() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper3);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper1);
        registry.executeKeyRotation();

        // Old key should be valid immediately after
        bytes memory oldKey = registry.getOldPubkey(keeper1);
        assertEq(oldKey, PUBKEY_1);

        // Still valid at 23 hours
        vm.warp(block.timestamp + 23 hours);
        oldKey = registry.getOldPubkey(keeper1);
        assertEq(oldKey, PUBKEY_1);
    }

    function test_SafePeriod_OldKeyInvalidAfterExpiry() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper3);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper1);
        registry.executeKeyRotation();

        // Warp past safe period
        vm.warp(block.timestamp + 25 hours);

        bytes memory oldKey = registry.getOldPubkey(keeper1);
        assertEq(oldKey.length, 0);
    }

    // ============ Task 6.16: Fuzz test stake amounts and timing ============

    function testFuzz_RegisterKeeper_AlwaysUsesMinStake(bytes32 randomPubkeyPart) public {
        bytes memory randomPubkey = abi.encodePacked(randomPubkeyPart, bytes32(uint256(123)), bytes32(uint256(456)), bytes32(uint256(789)));
        bytes32 randomIP = bytes32(uint256(123456));

        if (randomIP == bytes32(0)) {
            randomIP = bytes32(uint256(1));
        }

        vm.prank(keeper1);
        registry.registerKeeper(randomIP, randomPubkey);

        KeeperRegistry.Keeper memory k = registry.getKeeperInfo(keeper1);
        assertEq(k.stakedAmount, MIN_STAKE);
    }

    function testFuzz_ForceKeyRotation_TimingBoundary(uint256 timeElapsed) public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        // Bound time to reasonable range
        timeElapsed = bound(timeElapsed, 0, 100 hours);

        vm.warp(block.timestamp + timeElapsed);

        if (timeElapsed < 48 hours) {
            vm.expectRevert();
            vm.prank(admin);
            registry.forceKeyRotation(keeper1);
        } else {
            vm.prank(admin);
            registry.forceKeyRotation(keeper1);

            KeeperRegistry.Keeper memory k = registry.getKeeperInfo(keeper1);
            assertEq(k.blsPubkey, NEW_PUBKEY);
        }
    }

    function testFuzz_SafePeriod_TimingBoundary(uint256 timeElapsed) public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper3);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper1);
        registry.executeKeyRotation();

        // Bound time to reasonable range
        timeElapsed = bound(timeElapsed, 0, 50 hours);

        vm.warp(block.timestamp + timeElapsed);

        bytes memory oldKey = registry.getOldPubkey(keeper1);

        if (timeElapsed <= 24 hours) {
            assertEq(oldKey, PUBKEY_1, "Old key should be valid during safe period");
        } else {
            assertEq(oldKey.length, 0, "Old key should be empty after safe period");
        }
    }

    // ============ Additional Edge Cases ============

    function test_Threshold_Calculation_FourKeepers() public {
        // Register 4 keepers
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);
        vm.prank(keeper2);
        registry.registerKeeper(IP_2, PUBKEY_2);
        vm.prank(keeper3);
        registry.registerKeeper(IP_3, PUBKEY_3);
        vm.prank(keeper4);
        registry.registerKeeper(bytes32(bytes("192.168.1.4:8080")), PUBKEY_4);

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        (,,, uint256 threshold) = registry.getPendingRotation(keeper1);
        // 4 keepers, 3 can vote, threshold = ceil(3 * 2 / 3) = 2
        assertEq(threshold, 2);

        // 2 approvals should be enough
        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper3);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper1);
        registry.executeKeyRotation();

        KeeperRegistry.Keeper memory k = registry.getKeeperInfo(keeper1);
        assertEq(k.blsPubkey, NEW_PUBKEY);
    }

    function test_GetActiveKeeperCount() public {
        assertEq(registry.getActiveKeeperCount(), 0);

        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);
        assertEq(registry.getActiveKeeperCount(), 1);

        vm.prank(keeper2);
        registry.registerKeeper(IP_2, PUBKEY_2);
        assertEq(registry.getActiveKeeperCount(), 2);

        vm.prank(admin);
        registry.suspendKeeper(keeper1);
        assertEq(registry.getActiveKeeperCount(), 1);
    }

    function test_CannotReregisterWhileActive() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.expectRevert(KeeperRegistry.AlreadyRegistered.selector);
        vm.prank(keeper1);
        registry.registerKeeper(IP_2, PUBKEY_2);
    }

    function test_CannotReregisterWhileSuspended() public {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.prank(admin);
        registry.suspendKeeper(keeper1);

        vm.expectRevert(KeeperRegistry.AlreadyRegistered.selector);
        vm.prank(keeper1);
        registry.registerKeeper(IP_2, PUBKEY_2);
    }

    function test_ExecuteRotation_RevertsAfterAlreadyExecuted() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper3);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper1);
        registry.executeKeyRotation();

        // Try to execute again
        vm.expectRevert(KeeperRegistry.NotPendingRotation.selector);
        vm.prank(keeper1);
        registry.executeKeyRotation();
    }

    function test_ForceRotation_RevertsAfterAlreadyExecuted() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper3);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper1);
        registry.executeKeyRotation();

        vm.warp(block.timestamp + 49 hours);

        vm.expectRevert(KeeperRegistry.NotPendingRotation.selector);
        vm.prank(admin);
        registry.forceKeyRotation(keeper1);
    }

    // ============ Approval Carryover Tests (Security Fix) ============

    function test_NewRotationRequest_InvalidatesPreviousApprovals() public {
        _registerThreeKeepers();

        // First rotation request
        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        // Keeper2 approves first rotation
        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        // Verify approval
        assertTrue(registry.hasApprovedRotation(keeper1, keeper2));

        // Keeper1 requests a NEW rotation (different key)
        bytes memory differentPubkey = abi.encodePacked(bytes32(uint256(999)), bytes32(uint256(888)), bytes32(uint256(777)), bytes32(uint256(666)));
        vm.prank(keeper1);
        registry.requestKeyRotation(differentPubkey);

        // Previous approval should be INVALIDATED
        assertFalse(registry.hasApprovedRotation(keeper1, keeper2));

        // Keeper2 should be able to approve the new rotation
        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        assertTrue(registry.hasApprovedRotation(keeper1, keeper2));
    }

    function test_NewRotationRequest_ResetsApprovalCount() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        (,, uint256 approvalCount,) = registry.getPendingRotation(keeper1);
        assertEq(approvalCount, 1);

        // New rotation request
        bytes memory differentPubkey = abi.encodePacked(bytes32(uint256(999)), bytes32(uint256(888)), bytes32(uint256(777)), bytes32(uint256(666)));
        vm.prank(keeper1);
        registry.requestKeyRotation(differentPubkey);

        // Count should be reset
        (,, approvalCount,) = registry.getPendingRotation(keeper1);
        assertEq(approvalCount, 0);
    }

    // ============ Cancel Key Rotation Tests ============

    function test_CancelKeyRotation_Success() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.expectEmit(true, false, false, false);
        emit KeyRotationCancelled(keeper1);

        vm.prank(keeper1);
        registry.cancelKeyRotation();

        // Verify rotation is cancelled - requestedAt should be 0
        (bytes memory newPubkey, uint256 requestedAt,,) = registry.getPendingRotation(keeper1);
        assertEq(requestedAt, 0);
    }

    function test_CancelKeyRotation_PreventsExecution() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);

        vm.prank(keeper3);
        registry.approveKeyRotation(keeper1);

        // Cancel before execution
        vm.prank(keeper1);
        registry.cancelKeyRotation();

        // Execution should fail
        vm.expectRevert(KeeperRegistry.NotPendingRotation.selector);
        vm.prank(keeper1);
        registry.executeKeyRotation();
    }

    function test_CancelKeyRotation_PreventsNewApprovals() public {
        _registerThreeKeepers();

        vm.prank(keeper1);
        registry.requestKeyRotation(NEW_PUBKEY);

        vm.prank(keeper1);
        registry.cancelKeyRotation();

        // New approvals should fail
        vm.expectRevert(KeeperRegistry.NotPendingRotation.selector);
        vm.prank(keeper2);
        registry.approveKeyRotation(keeper1);
    }

    function test_CancelKeyRotation_RevertsNoPendingRotation() public {
        _registerThreeKeepers();

        vm.expectRevert(KeeperRegistry.NotPendingRotation.selector);
        vm.prank(keeper1);
        registry.cancelKeyRotation();
    }

    function test_CancelKeyRotation_RevertsNotActive() public {
        vm.expectRevert(KeeperRegistry.OnlyActiveKeeper.selector);
        vm.prank(keeper1);
        registry.cancelKeyRotation();
    }

    // ============ Helper Functions ============

    function _registerThreeKeepers() internal {
        vm.prank(keeper1);
        registry.registerKeeper(IP_1, PUBKEY_1);

        vm.prank(keeper2);
        registry.registerKeeper(IP_2, PUBKEY_2);

        vm.prank(keeper3);
        registry.registerKeeper(IP_3, PUBKEY_3);
    }
}
