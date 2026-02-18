// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {Governance} from "../src/Governance.sol";
import {IGovernance} from "../src/interfaces/IGovernance.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title GovernanceTest - Comprehensive tests for Governance.sol
/// @notice Tests initialization, pause/unpause, admin management, and access control
contract GovernanceTest is Test {
    Governance public implementation;
    Governance public governance;
    ERC1967Proxy public proxy;

    address public admin = makeAddr("admin");
    address public user = makeAddr("user");
    address public newAdmin = makeAddr("newAdmin");

    bytes32 public constant ITP_ID_1 = keccak256("ITP_1");
    bytes32 public constant ITP_ID_2 = keccak256("ITP_2");

    // Events for expectEmit
    event SystemPaused(address indexed admin);
    event SystemUnpaused(address indexed admin);
    event ITPPaused(bytes32 indexed itpId, address indexed admin);
    event ITPUnpaused(bytes32 indexed itpId, address indexed admin);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    function setUp() public {
        // Deploy implementation
        implementation = new Governance();

        // Deploy proxy pointing to implementation
        bytes memory initData = abi.encodeWithSelector(Governance.initialize.selector, admin);
        proxy = new ERC1967Proxy(address(implementation), initData);

        // Cast proxy to Governance interface for interaction
        governance = Governance(address(proxy));
    }

    // ============ INITIALIZATION TESTS ============

    function test_initialization_setsAdmin() public view {
        assertEq(governance.admin(), admin);
    }

    function test_initialization_notPaused() public view {
        assertFalse(governance.isPaused());
    }

    function test_initialization_emitsAdminTransferred() public {
        // Deploy fresh to capture event
        Governance newImpl = new Governance();

        vm.expectEmit(true, true, false, false);
        emit AdminTransferred(address(0), admin);

        new ERC1967Proxy(
            address(newImpl),
            abi.encodeWithSelector(Governance.initialize.selector, admin)
        );
    }

    function test_initialization_revertsWithZeroAddress() public {
        Governance newImpl = new Governance();

        vm.expectRevert(Governance.ZeroAddress.selector);
        new ERC1967Proxy(
            address(newImpl),
            abi.encodeWithSelector(Governance.initialize.selector, address(0))
        );
    }

    function test_implementation_cannotBeInitialized() public {
        vm.expectRevert();
        implementation.initialize(admin);
    }

    function test_proxy_cannotBeReinitialized() public {
        // Proxy is already initialized in setUp(), attempting to initialize again should revert
        vm.expectRevert();
        governance.initialize(newAdmin);
    }

    // ============ SYSTEM PAUSE TESTS ============

    function test_pause_setsIsPaused() public {
        vm.prank(admin);
        governance.pause();
        assertTrue(governance.isPaused());
    }

    function test_pause_emitsSystemPaused() public {
        vm.expectEmit(true, false, false, false);
        emit SystemPaused(admin);

        vm.prank(admin);
        governance.pause();
    }

    function test_pause_idempotent() public {
        vm.startPrank(admin);

        // First pause
        governance.pause();
        assertTrue(governance.isPaused());

        // Second pause should succeed silently (no event, no revert)
        governance.pause();
        assertTrue(governance.isPaused());

        vm.stopPrank();
    }

    function test_pause_idempotent_noEventOnSecondCall() public {
        vm.startPrank(admin);

        // First pause emits event
        governance.pause();

        // Record logs for second call
        vm.recordLogs();
        governance.pause();
        Vm.Log[] memory entries = vm.getRecordedLogs();

        // Should have no events (idempotent - no event on second call)
        assertEq(entries.length, 0, "Should not emit event on idempotent pause");

        vm.stopPrank();
    }

    function test_pause_revertsForNonAdmin() public {
        vm.expectRevert(Governance.Unauthorized.selector);
        vm.prank(user);
        governance.pause();
    }

    function test_unpause_setsNotPaused() public {
        vm.startPrank(admin);
        governance.pause();
        governance.unpause();
        vm.stopPrank();

        assertFalse(governance.isPaused());
    }

    function test_unpause_emitsSystemUnpaused() public {
        vm.prank(admin);
        governance.pause();

        vm.expectEmit(true, false, false, false);
        emit SystemUnpaused(admin);

        vm.prank(admin);
        governance.unpause();
    }

    function test_unpause_idempotent() public {
        vm.startPrank(admin);

        // Unpause when not paused should succeed silently
        governance.unpause();
        assertFalse(governance.isPaused());

        // Pause then unpause twice
        governance.pause();
        governance.unpause();
        governance.unpause();
        assertFalse(governance.isPaused());

        vm.stopPrank();
    }

    function test_unpause_idempotent_noEventOnSecondCall() public {
        vm.startPrank(admin);

        // Pause first, then unpause
        governance.pause();
        governance.unpause();

        // Record logs for second unpause call
        vm.recordLogs();
        governance.unpause();
        Vm.Log[] memory entries = vm.getRecordedLogs();

        // Should have no events (idempotent - no event on second call)
        assertEq(entries.length, 0, "Should not emit event on idempotent unpause");

        vm.stopPrank();
    }

    function test_unpause_revertsForNonAdmin() public {
        vm.prank(admin);
        governance.pause();

        vm.expectRevert(Governance.Unauthorized.selector);
        vm.prank(user);
        governance.unpause();
    }

    // ============ ITP PAUSE TESTS ============

    function test_pauseITP_setsITPPaused() public {
        vm.prank(admin);
        governance.pauseITP(ITP_ID_1);

        assertTrue(governance.isITPPaused(ITP_ID_1));
        assertFalse(governance.isITPPaused(ITP_ID_2)); // Other ITPs unaffected
    }

    function test_pauseITP_emitsITPPaused() public {
        vm.expectEmit(true, true, false, false);
        emit ITPPaused(ITP_ID_1, admin);

        vm.prank(admin);
        governance.pauseITP(ITP_ID_1);
    }

    function test_pauseITP_idempotent() public {
        vm.startPrank(admin);

        governance.pauseITP(ITP_ID_1);
        assertTrue(governance.isITPPaused(ITP_ID_1));

        // Second pause should succeed silently
        governance.pauseITP(ITP_ID_1);
        assertTrue(governance.isITPPaused(ITP_ID_1));

        vm.stopPrank();
    }

    function test_pauseITP_idempotent_noEventOnSecondCall() public {
        vm.startPrank(admin);

        // First pause emits event
        governance.pauseITP(ITP_ID_1);

        // Record logs for second call
        vm.recordLogs();
        governance.pauseITP(ITP_ID_1);
        Vm.Log[] memory entries = vm.getRecordedLogs();

        // Should have no events (idempotent - no event on second call)
        assertEq(entries.length, 0, "Should not emit event on idempotent pauseITP");

        vm.stopPrank();
    }

    function test_pauseITP_revertsForNonAdmin() public {
        vm.expectRevert(Governance.Unauthorized.selector);
        vm.prank(user);
        governance.pauseITP(ITP_ID_1);
    }

    function test_unpauseITP_setsITPNotPaused() public {
        vm.startPrank(admin);
        governance.pauseITP(ITP_ID_1);
        governance.unpauseITP(ITP_ID_1);
        vm.stopPrank();

        assertFalse(governance.isITPPaused(ITP_ID_1));
    }

    function test_unpauseITP_emitsITPUnpaused() public {
        vm.prank(admin);
        governance.pauseITP(ITP_ID_1);

        vm.expectEmit(true, true, false, false);
        emit ITPUnpaused(ITP_ID_1, admin);

        vm.prank(admin);
        governance.unpauseITP(ITP_ID_1);
    }

    function test_unpauseITP_idempotent() public {
        vm.startPrank(admin);

        // Unpause when not paused should succeed silently
        governance.unpauseITP(ITP_ID_1);
        assertFalse(governance.isITPPaused(ITP_ID_1));

        // Pause then unpause twice
        governance.pauseITP(ITP_ID_1);
        governance.unpauseITP(ITP_ID_1);
        governance.unpauseITP(ITP_ID_1);
        assertFalse(governance.isITPPaused(ITP_ID_1));

        vm.stopPrank();
    }

    function test_unpauseITP_idempotent_noEventOnSecondCall() public {
        vm.startPrank(admin);

        // Pause first, then unpause
        governance.pauseITP(ITP_ID_1);
        governance.unpauseITP(ITP_ID_1);

        // Record logs for second unpause call
        vm.recordLogs();
        governance.unpauseITP(ITP_ID_1);
        Vm.Log[] memory entries = vm.getRecordedLogs();

        // Should have no events (idempotent - no event on second call)
        assertEq(entries.length, 0, "Should not emit event on idempotent unpauseITP");

        vm.stopPrank();
    }

    function test_unpauseITP_revertsForNonAdmin() public {
        vm.prank(admin);
        governance.pauseITP(ITP_ID_1);

        vm.expectRevert(Governance.Unauthorized.selector);
        vm.prank(user);
        governance.unpauseITP(ITP_ID_1);
    }

    function test_pauseITP_nonExistentITP_succeeds() public {
        // Pausing a non-existent ITP should succeed (no validation in Governance)
        bytes32 fakeItpId = keccak256("FAKE_ITP");

        vm.prank(admin);
        governance.pauseITP(fakeItpId);

        assertTrue(governance.isITPPaused(fakeItpId));
    }

    // ============ ADMIN MANAGEMENT TESTS ============

    function test_setAdmin_transfersAdmin() public {
        vm.prank(admin);
        governance.setAdmin(newAdmin);

        assertEq(governance.admin(), newAdmin);
    }

    function test_setAdmin_emitsAdminTransferred() public {
        vm.expectEmit(true, true, false, false);
        emit AdminTransferred(admin, newAdmin);

        vm.prank(admin);
        governance.setAdmin(newAdmin);
    }

    function test_setAdmin_oldAdminLosesAccess() public {
        vm.prank(admin);
        governance.setAdmin(newAdmin);

        // Old admin should not be able to call admin functions
        vm.expectRevert(Governance.Unauthorized.selector);
        vm.prank(admin);
        governance.pause();
    }

    function test_setAdmin_newAdminHasAccess() public {
        vm.prank(admin);
        governance.setAdmin(newAdmin);

        // New admin should be able to call admin functions
        vm.prank(newAdmin);
        governance.pause();

        assertTrue(governance.isPaused());
    }

    function test_setAdmin_revertsWithZeroAddress() public {
        vm.expectRevert(Governance.ZeroAddress.selector);
        vm.prank(admin);
        governance.setAdmin(address(0));
    }

    function test_setAdmin_revertsForNonAdmin() public {
        vm.expectRevert(Governance.Unauthorized.selector);
        vm.prank(user);
        governance.setAdmin(newAdmin);
    }

    // ============ UPGRADE AUTHORIZATION TESTS ============

    function test_upgradeAuthorization_onlyAdmin() public {
        // Deploy new implementation
        Governance newImpl = new Governance();

        // Non-admin cannot upgrade
        vm.expectRevert(Governance.Unauthorized.selector);
        vm.prank(user);
        governance.upgradeToAndCall(address(newImpl), "");

        // Admin can upgrade
        vm.prank(admin);
        governance.upgradeToAndCall(address(newImpl), "");
    }

    function test_upgrade_revertsForNonContractAddress() public {
        // Attempt to upgrade to an EOA (non-contract) should fail
        address eoa = makeAddr("eoa");

        vm.expectRevert(Governance.ZeroAddress.selector);
        vm.prank(admin);
        governance.upgradeToAndCall(eoa, "");
    }

    function test_upgrade_revertsForZeroAddress() public {
        // Attempt to upgrade to zero address should fail
        vm.expectRevert(Governance.ZeroAddress.selector);
        vm.prank(admin);
        governance.upgradeToAndCall(address(0), "");
    }

    function test_upgrade_preservesState() public {
        // Setup: pause system and an ITP
        vm.startPrank(admin);
        governance.pause();
        governance.pauseITP(ITP_ID_1);
        vm.stopPrank();

        // Deploy new implementation
        Governance newImpl = new Governance();

        // Upgrade
        vm.prank(admin);
        governance.upgradeToAndCall(address(newImpl), "");

        // State should be preserved
        assertEq(governance.admin(), admin);
        assertTrue(governance.isPaused());
        assertTrue(governance.isITPPaused(ITP_ID_1));
        assertFalse(governance.isITPPaused(ITP_ID_2));
    }

    // ============ ACCESS CONTROL COMPREHENSIVE TESTS ============

    function test_allAdminFunctions_revertForNonAdmin() public {
        vm.startPrank(user);

        vm.expectRevert(Governance.Unauthorized.selector);
        governance.pause();

        vm.expectRevert(Governance.Unauthorized.selector);
        governance.unpause();

        vm.expectRevert(Governance.Unauthorized.selector);
        governance.pauseITP(ITP_ID_1);

        vm.expectRevert(Governance.Unauthorized.selector);
        governance.unpauseITP(ITP_ID_1);

        vm.expectRevert(Governance.Unauthorized.selector);
        governance.setAdmin(newAdmin);

        vm.stopPrank();
    }

    function test_viewFunctions_accessibleByAnyone() public view {
        // These should not revert
        governance.admin();
        governance.isPaused();
        governance.isITPPaused(ITP_ID_1);
    }

    // ============ FUZZ TESTS ============

    function testFuzz_pauseITP_anyItpId(bytes32 itpId) public {
        vm.prank(admin);
        governance.pauseITP(itpId);
        assertTrue(governance.isITPPaused(itpId));

        vm.prank(admin);
        governance.unpauseITP(itpId);
        assertFalse(governance.isITPPaused(itpId));
    }

    function testFuzz_setAdmin_anyValidAddress(address newAdminAddr) public {
        vm.assume(newAdminAddr != address(0));

        vm.prank(admin);
        governance.setAdmin(newAdminAddr);

        assertEq(governance.admin(), newAdminAddr);
    }
}
