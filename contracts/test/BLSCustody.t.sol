// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/BLSCustody.sol";
import "../src/registry/IssuerRegistry.sol";
import {IIssuerRegistry} from "../src/interfaces/IIssuerRegistry.sol";
import "../src/mocks/MockERC20.sol";
import "../src/libraries/ErrorsLib.sol";
import "../src/libraries/EventsLib.sol";
import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title BLSCustody.t.sol - Tests for Stories 2.7 and 2.8
/// @notice Tests for BLSCustody core execution and whitelist management
contract BLSCustodyTest is TestHelper {
    BLSCustody public custody;
    IssuerRegistry public issuerRegistry;
    Governance public governance;
    MockERC20 public token;

    address public admin = address(this);
    address public targetContract;

    // Dummy BLS signature (G1 generator point, 64 bytes) — precompile 0x08 is mocked
    bytes public dummyBlsSignature = abi.encode(uint256(1), uint256(2));

    function setUp() public {
        // Mock BN254 pairing precompile to always return true (we test custody logic, not BLS math)
        vm.mockCall(address(0x08), bytes(""), abi.encode(uint256(1)));

        // Deploy real governance and issuer registry via UUPS proxy
        governance = deployGovernance(admin);
        issuerRegistry = deployIssuerRegistry(address(governance));

        // Set non-empty 128-byte aggregated pubkey (hardened contracts revert on empty pubkey)
        issuerRegistry.setAggregatedPubkey(new bytes(128));

        // Deploy mock token as a target
        token = new MockERC20("Test Token", "TEST", 18);
        targetContract = address(token);

        // Deploy BLSCustody as UUPS proxy
        BLSCustody impl = new BLSCustody();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(BLSCustody.initialize, (address(issuerRegistry)))
        );
        custody = BLSCustody(address(proxy));

        // Mint tokens to custody for testing
        token.mint(address(custody), 1000e18);
    }

    // ============ STORY 2.7: CORE EXECUTION TESTS ============

    function test_execute_happyPath() public {
        // First whitelist the target
        _whitelistTarget(targetContract);

        // Build calldata to transfer tokens
        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            100e18
        );

        // Execute
        (bool success, ) = custody.execute(targetContract, data, dummyBlsSignature, 0);

        assertTrue(success);
        assertEq(token.balanceOf(address(0x123)), 100e18);
        assertEq(token.balanceOf(address(custody)), 900e18);
    }

    function test_execute_emitsEvent() public {
        _whitelistTarget(targetContract);

        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            100e18
        );

        vm.expectEmit(true, false, false, true);
        emit EventsLib.Executed(targetContract, data, 0);

        custody.execute(targetContract, data, dummyBlsSignature, 0);
    }

    function test_execute_revertsOnNonceAlreadyUsed() public {
        _whitelistTarget(targetContract);

        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            50e18
        );

        // First execution succeeds
        custody.execute(targetContract, data, dummyBlsSignature, 0);

        // Second execution with same nonce fails
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E025_NonceAlreadyUsed.selector, 0));
        custody.execute(targetContract, data, dummyBlsSignature, 0);
    }

    function test_execute_revertsOnTargetNotWhitelisted() public {
        // Don't whitelist the target
        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            100e18
        );

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, targetContract));
        custody.execute(targetContract, data, dummyBlsSignature, 0);
    }

    function test_execute_revertsOnExecutionFailed() public {
        _whitelistTarget(targetContract);

        // Try to transfer more than balance
        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            2000e18 // More than custody has
        );

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E027_ExecutionFailed.selector, targetContract, data));
        custody.execute(targetContract, data, dummyBlsSignature, 0);
    }

    function test_execute_nonSequentialNonces() public {
        _whitelistTarget(targetContract);

        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            10e18
        );

        // Use nonces out of order (bitmap pattern allows this)
        custody.execute(targetContract, data, dummyBlsSignature, 100);
        custody.execute(targetContract, data, dummyBlsSignature, 5);
        custody.execute(targetContract, data, dummyBlsSignature, 1000);
        custody.execute(targetContract, data, dummyBlsSignature, 0);

        // All nonces should be marked as used
        assertTrue(custody.isNonceUsed(0));
        assertTrue(custody.isNonceUsed(5));
        assertTrue(custody.isNonceUsed(100));
        assertTrue(custody.isNonceUsed(1000));

        // Unused nonce should not be marked
        assertFalse(custody.isNonceUsed(1));
        assertFalse(custody.isNonceUsed(50));
    }

    function test_execute_nonceBitmapGapPrevention() public {
        _whitelistTarget(targetContract);

        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            1e18
        );

        // Use nonce 5 first (skip 0-4)
        custody.execute(targetContract, data, dummyBlsSignature, 5);

        // Nonces 0-4 should still be usable
        custody.execute(targetContract, data, dummyBlsSignature, 0);
        custody.execute(targetContract, data, dummyBlsSignature, 1);
        custody.execute(targetContract, data, dummyBlsSignature, 2);

        // All used nonces should be marked
        assertTrue(custody.isNonceUsed(0));
        assertTrue(custody.isNonceUsed(1));
        assertTrue(custody.isNonceUsed(2));
        assertTrue(custody.isNonceUsed(5));

        // Unused nonces should not be marked
        assertFalse(custody.isNonceUsed(3));
        assertFalse(custody.isNonceUsed(4));
    }

    function test_execute_multipleTargets() public {
        // Deploy and whitelist a second token
        MockERC20 token2 = new MockERC20("Token 2", "TK2", 18);
        token2.mint(address(custody), 500e18);

        _whitelistTarget(address(token));
        _whitelistTarget(address(token2));

        // Execute on first target
        bytes memory data1 = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x111),
            100e18
        );
        custody.execute(address(token), data1, dummyBlsSignature, 0);

        // Execute on second target
        bytes memory data2 = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x222),
            50e18
        );
        custody.execute(address(token2), data2, dummyBlsSignature, 1);

        assertEq(token.balanceOf(address(0x111)), 100e18);
        assertEq(token2.balanceOf(address(0x222)), 50e18);
    }

    // ============ STORY 2.8: WHITELIST MANAGEMENT TESTS ============

    function test_proposeWhitelist_happyPath() public {
        address newTarget = address(0xABC);

        custody.proposeWhitelist(newTarget, dummyBlsSignature);

        (uint256 proposedAt, uint256 activatedAt) = custody.getWhitelistStatus(newTarget);
        assertEq(proposedAt, block.timestamp);
        assertEq(activatedAt, 0); // Not yet activated
        assertFalse(custody.isWhitelisted(newTarget));
    }

    function test_proposeWhitelist_emitsEvent() public {
        address newTarget = address(0xABC);

        vm.expectEmit(true, false, false, true);
        emit EventsLib.WhitelistProposed(newTarget, block.timestamp, block.timestamp + 2 days);

        custody.proposeWhitelist(newTarget, dummyBlsSignature);
    }

    function test_proposeWhitelist_revertsOnAlreadyProposed() public {
        address newTarget = address(0xABC);

        custody.proposeWhitelist(newTarget, dummyBlsSignature);

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E028_WhitelistAlreadyProposed.selector, newTarget));
        custody.proposeWhitelist(newTarget, dummyBlsSignature);
    }

    function test_proposeWhitelist_revertsOnAlreadyWhitelisted() public {
        _whitelistTarget(targetContract);

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E031_TargetAlreadyWhitelisted.selector, targetContract));
        custody.proposeWhitelist(targetContract, dummyBlsSignature);
    }

    function test_activateWhitelist_happyPath() public {
        address newTarget = address(0xABC);

        // Propose
        custody.proposeWhitelist(newTarget, dummyBlsSignature);

        // Fast forward past timelock
        vm.warp(block.timestamp + 2 days + 1);

        // Activate
        custody.activateWhitelist(newTarget);

        assertTrue(custody.isWhitelisted(newTarget));
        (uint256 proposedAt, uint256 activatedAt) = custody.getWhitelistStatus(newTarget);
        assertEq(proposedAt, 0); // Cleared after activation
        assertGt(activatedAt, 0);
    }

    function test_activateWhitelist_emitsEvent() public {
        address newTarget = address(0xABC);
        custody.proposeWhitelist(newTarget, dummyBlsSignature);
        vm.warp(block.timestamp + 2 days + 1);

        vm.expectEmit(true, false, false, true);
        emit EventsLib.WhitelistActivated(newTarget, block.timestamp);

        custody.activateWhitelist(newTarget);
    }

    function test_activateWhitelist_revertsOnNotProposed() public {
        address newTarget = address(0xABC);

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E029_WhitelistNotProposed.selector, newTarget));
        custody.activateWhitelist(newTarget);
    }

    function test_activateWhitelist_revertsOnTimelockNotExpired() public {
        address newTarget = address(0xABC);

        // Propose at timestamp 1 (forge default), unlockTime = 1 + 2 days = 172801
        custody.proposeWhitelist(newTarget, dummyBlsSignature);

        // Only fast forward 1 day (need 2 days), timestamp becomes 86401
        vm.warp(1 + 1 days);

        // Use hardcoded values to avoid via_ir optimizer inlining block.timestamp
        // proposedAt = 1, unlockTime = 1 + 2 days = 172801, currentTime = 86401
        vm.expectRevert(
            abi.encodeWithSelector(
                ErrorsLib.E030_TimelockNotExpired.selector,
                newTarget,
                uint256(1 + 2 days),
                uint256(1 + 1 days)
            )
        );
        custody.activateWhitelist(newTarget);
    }

    function test_activateWhitelist_exactTimelockExpiry() public {
        address newTarget = address(0xABC);
        uint256 startTime = block.timestamp;

        custody.proposeWhitelist(newTarget, dummyBlsSignature);

        // Fast forward to exactly 2 days
        vm.warp(startTime + 2 days);

        // Should succeed at exactly the timelock
        custody.activateWhitelist(newTarget);
        assertTrue(custody.isWhitelisted(newTarget));
    }

    function test_emergencyRemoveWhitelist_happyPath() public {
        _whitelistTarget(targetContract);
        assertTrue(custody.isWhitelisted(targetContract));

        custody.emergencyRemoveWhitelist(targetContract, dummyBlsSignature);

        assertFalse(custody.isWhitelisted(targetContract));
    }

    function test_emergencyRemoveWhitelist_emitsEvent() public {
        _whitelistTarget(targetContract);

        vm.expectEmit(true, false, false, true);
        emit EventsLib.WhitelistRemoved(targetContract, block.timestamp);

        custody.emergencyRemoveWhitelist(targetContract, dummyBlsSignature);
    }

    function test_emergencyRemoveWhitelist_revertsOnNotWhitelisted() public {
        address notWhitelisted = address(0xDEAD);

        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E032_TargetNotCurrentlyWhitelisted.selector, notWhitelisted)
        );
        custody.emergencyRemoveWhitelist(notWhitelisted, dummyBlsSignature);
    }

    function test_emergencyRemove_thenRepropose() public {
        // Whitelist, remove, then re-propose
        _whitelistTarget(targetContract);
        custody.emergencyRemoveWhitelist(targetContract, dummyBlsSignature);

        assertFalse(custody.isWhitelisted(targetContract));

        // Should be able to propose again
        custody.proposeWhitelist(targetContract, dummyBlsSignature);
        (uint256 proposedAt, ) = custody.getWhitelistStatus(targetContract);
        assertGt(proposedAt, 0);
    }

    function test_fullWhitelistLifecycle() public {
        address newTarget = address(0xBEEF);

        // Step 1: Target is not whitelisted initially
        assertFalse(custody.isWhitelisted(newTarget));

        // Step 2: Propose whitelist
        custody.proposeWhitelist(newTarget, dummyBlsSignature);
        (uint256 proposedAt, uint256 activatedAt) = custody.getWhitelistStatus(newTarget);
        assertGt(proposedAt, 0);
        assertEq(activatedAt, 0);
        assertFalse(custody.isWhitelisted(newTarget)); // Not yet active

        // Step 3: Cannot activate before timelock
        vm.expectRevert();
        custody.activateWhitelist(newTarget);

        // Step 4: Wait for timelock
        vm.warp(block.timestamp + 2 days + 1);

        // Step 5: Activate whitelist
        custody.activateWhitelist(newTarget);
        assertTrue(custody.isWhitelisted(newTarget));
        (proposedAt, activatedAt) = custody.getWhitelistStatus(newTarget);
        assertEq(proposedAt, 0); // Cleared
        assertGt(activatedAt, 0);

        // Step 6: Emergency remove
        custody.emergencyRemoveWhitelist(newTarget, dummyBlsSignature);
        assertFalse(custody.isWhitelisted(newTarget));
        (proposedAt, activatedAt) = custody.getWhitelistStatus(newTarget);
        assertEq(proposedAt, 0);
        assertEq(activatedAt, 0); // Both cleared

        // Step 7: Can re-propose after removal
        custody.proposeWhitelist(newTarget, dummyBlsSignature);
        (proposedAt, ) = custody.getWhitelistStatus(newTarget);
        assertGt(proposedAt, 0);
    }

    function test_execute_afterWhitelistActivation() public {
        // Verify the execute function works correctly after whitelist flow
        address newTarget = address(new MockERC20("New", "NEW", 18));
        MockERC20(newTarget).mint(address(custody), 100e18);

        // Cannot execute before whitelisting
        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            10e18
        );

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, newTarget));
        custody.execute(newTarget, data, dummyBlsSignature, 0);

        // Whitelist the target
        _whitelistTarget(newTarget);

        // Now execute should work
        (bool success, ) = custody.execute(newTarget, data, dummyBlsSignature, 0);
        assertTrue(success);
        assertEq(MockERC20(newTarget).balanceOf(address(0x123)), 10e18);
    }

    function test_emergencyRemove_clearsActivatedAt() public {
        // Verify that emergency remove clears whitelistActivatedAt
        _whitelistTarget(targetContract);

        // Verify activated timestamp is set
        (, uint256 activatedAt) = custody.getWhitelistStatus(targetContract);
        assertGt(activatedAt, 0);

        // Emergency remove
        custody.emergencyRemoveWhitelist(targetContract, dummyBlsSignature);

        // Verify both timestamps cleared
        (uint256 proposedAt, uint256 newActivatedAt) = custody.getWhitelistStatus(targetContract);
        assertEq(proposedAt, 0);
        assertEq(newActivatedAt, 0);
    }

    // ============ VIEW FUNCTION TESTS ============

    function test_isWhitelisted() public {
        assertFalse(custody.isWhitelisted(targetContract));
        _whitelistTarget(targetContract);
        assertTrue(custody.isWhitelisted(targetContract));
    }

    function test_getWhitelistStatus() public {
        address newTarget = address(0xABC);

        // Initially empty
        (uint256 proposedAt, uint256 activatedAt) = custody.getWhitelistStatus(newTarget);
        assertEq(proposedAt, 0);
        assertEq(activatedAt, 0);

        // After proposal
        custody.proposeWhitelist(newTarget, dummyBlsSignature);
        (proposedAt, activatedAt) = custody.getWhitelistStatus(newTarget);
        assertGt(proposedAt, 0);
        assertEq(activatedAt, 0);

        // After activation
        vm.warp(block.timestamp + 2 days + 1);
        custody.activateWhitelist(newTarget);
        (proposedAt, activatedAt) = custody.getWhitelistStatus(newTarget);
        assertEq(proposedAt, 0); // Cleared
        assertGt(activatedAt, 0);
    }

    function test_nonce_returnsValue() public {
        // Initial nonce
        assertEq(custody.nonce(), 0);

        // After execution, nonce counter should update
        _whitelistTarget(targetContract);
        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            1e18
        );
        custody.execute(targetContract, data, dummyBlsSignature, 0);

        assertEq(custody.nonce(), 1);
    }

    function test_constants() public view {
        assertEq(custody.STANDARD_THRESHOLD(), 11);
        assertEq(custody.EMERGENCY_THRESHOLD(), 15);
        assertEq(custody.EMERGENCY_UPGRADE_THRESHOLD(), 17);
        assertEq(custody.WHITELIST_TIMELOCK(), 2 days);
        assertEq(custody.UPGRADE_TIMELOCK(), 7 days);
        assertEq(custody.EMERGENCY_UPGRADE_TIMELOCK(), 24 hours);
    }

    // ============ BLS SIGNATURE VERIFICATION TESTS ============

    function test_proposeWhitelist_invalidSignature_reverts() public {
        // Set a non-empty aggregated pubkey to enable BLS verification
        vm.mockCall(address(issuerRegistry), abi.encodeWithSelector(IIssuerRegistry.getAggregatedPubkey.selector), abi.encode(hex"aabbccdd"));

        address newTarget = address(0xABC);

        // Any signature will be invalid against this fake pubkey
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E020_InvalidBLSSignature.selector));
        custody.proposeWhitelist(newTarget, hex"1234");
    }

    function test_emergencyRemove_invalidSignature_reverts() public {
        // First whitelist a target (with empty pubkey - verification skipped)
        _whitelistTarget(targetContract);

        // Now set a non-empty pubkey to enable verification
        vm.mockCall(address(issuerRegistry), abi.encodeWithSelector(IIssuerRegistry.getAggregatedPubkey.selector), abi.encode(hex"aabbccdd"));

        // Try emergency remove with invalid signature
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E020_InvalidBLSSignature.selector));
        custody.emergencyRemoveWhitelist(targetContract, hex"1234");
    }

    function test_execute_invalidSignature_reverts() public {
        // First whitelist a target (with empty pubkey - verification skipped)
        _whitelistTarget(targetContract);

        // Now set a non-empty pubkey to enable verification
        vm.mockCall(address(issuerRegistry), abi.encodeWithSelector(IIssuerRegistry.getAggregatedPubkey.selector), abi.encode(hex"aabbccdd"));

        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            100e18
        );

        // Try execute with invalid signature
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E020_InvalidBLSSignature.selector));
        custody.execute(targetContract, data, hex"1234", 0);
    }

    function test_emptyPubkey_reverts() public {
        // Hardened contracts: empty aggregated pubkey causes revert (no bypass)
        // Override the pubkey to empty to verify revert behavior
        vm.mockCall(
            address(issuerRegistry),
            abi.encodeWithSelector(IIssuerRegistry.getAggregatedPubkey.selector),
            abi.encode(bytes(""))
        );

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E020_InvalidBLSSignature.selector));
        custody.proposeWhitelist(address(0xDEAD), dummyBlsSignature);
    }

    // ============ UPGRADE TESTS (Story 2.7 Code Review) ============

    function test_proposeUpgrade_happyPath() public {
        address newImpl = address(0xBEEF);

        custody.proposeUpgrade(newImpl, dummyBlsSignature);

        (address proposedImpl, uint256 proposedAt, bool isEmergency) = custody.getPendingUpgrade();
        assertEq(proposedImpl, newImpl);
        assertEq(proposedAt, block.timestamp);
        assertFalse(isEmergency);
    }

    function test_proposeUpgrade_emitsEvent() public {
        address newImpl = address(0xBEEF);

        vm.expectEmit(true, false, false, true);
        emit IBLSCustody.UpgradeProposed(newImpl, block.timestamp + 7 days);

        custody.proposeUpgrade(newImpl, dummyBlsSignature);
    }

    function test_proposeUpgrade_revertsOnZeroAddress() public {
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E038_ZeroImplementation.selector));
        custody.proposeUpgrade(address(0), dummyBlsSignature);
    }

    function test_proposeUpgrade_revertsOnAlreadyPending() public {
        address newImpl = address(0xBEEF);
        custody.proposeUpgrade(newImpl, dummyBlsSignature);

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E039_UpgradeAlreadyPending.selector));
        custody.proposeUpgrade(address(0xDEAD), dummyBlsSignature);
    }

    function test_executeUpgrade_happyPath() public {
        // Deploy a new implementation
        BLSCustody newImpl = new BLSCustody();

        // Propose upgrade
        custody.proposeUpgrade(address(newImpl), dummyBlsSignature);

        // Fast forward past 7-day timelock
        vm.warp(block.timestamp + 7 days + 1);

        // Execute upgrade
        custody.executeUpgrade(address(newImpl));

        // Verify pending upgrade is cleared
        (address proposedImpl, uint256 proposedAt, bool isEmergency) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
        assertEq(proposedAt, 0);
        assertFalse(isEmergency);
    }

    function test_executeUpgrade_emitsEvent() public {
        BLSCustody newImpl = new BLSCustody();
        custody.proposeUpgrade(address(newImpl), dummyBlsSignature);
        vm.warp(block.timestamp + 7 days + 1);

        vm.expectEmit(true, false, false, false);
        emit IBLSCustody.UpgradeExecuted(address(newImpl));

        custody.executeUpgrade(address(newImpl));
    }

    function test_executeUpgrade_revertsOnNoPendingUpgrade() public {
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E040_NoPendingUpgrade.selector));
        custody.executeUpgrade(address(0xBEEF));
    }

    function test_executeUpgrade_revertsOnImplMismatch() public {
        address newImpl = address(0xBEEF);
        custody.proposeUpgrade(newImpl, dummyBlsSignature);
        vm.warp(block.timestamp + 7 days + 1);

        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E041_ImplementationMismatch.selector, newImpl, address(0xDEAD))
        );
        custody.executeUpgrade(address(0xDEAD));
    }

    function test_executeUpgrade_revertsOnTimelockActive() public {
        address newImpl = address(0xBEEF);
        // Propose at timestamp 1 (forge default)
        custody.proposeUpgrade(newImpl, dummyBlsSignature);

        // Fast forward only 3 days (need 7 days), timestamp becomes 1 + 3 days = 259201
        vm.warp(1 + 3 days);

        // Use hardcoded values to avoid via_ir optimizer inlining block.timestamp
        // proposedAt = 1, unlockTime = 1 + 7 days = 604801, currentTime = 1 + 3 days = 259201
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E042_UpgradeTimelockActive.selector, uint256(1 + 7 days), uint256(1 + 3 days))
        );
        custody.executeUpgrade(newImpl);
    }

    function test_executeUpgrade_exactTimelockExpiry() public {
        BLSCustody newImpl = new BLSCustody();
        uint256 startTime = block.timestamp;
        custody.proposeUpgrade(address(newImpl), dummyBlsSignature);

        // Fast forward to exactly 7 days
        vm.warp(startTime + 7 days);

        // Should succeed at exactly the timelock
        custody.executeUpgrade(address(newImpl));

        (address proposedImpl,,) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
    }

    // ============ EMERGENCY UPGRADE TESTS ============

    function test_proposeEmergencyUpgrade_happyPath() public {
        address newImpl = address(0xBEEF);

        custody.proposeEmergencyUpgrade(newImpl, dummyBlsSignature);

        (address proposedImpl, uint256 proposedAt, bool isEmergency) = custody.getPendingUpgrade();
        assertEq(proposedImpl, newImpl);
        assertEq(proposedAt, block.timestamp);
        assertTrue(isEmergency);
    }

    function test_proposeEmergencyUpgrade_emitsEvent() public {
        address newImpl = address(0xBEEF);

        vm.expectEmit(true, false, false, true);
        emit IBLSCustody.EmergencyUpgradeProposed(newImpl, block.timestamp + 24 hours);

        custody.proposeEmergencyUpgrade(newImpl, dummyBlsSignature);
    }

    function test_proposeEmergencyUpgrade_revertsOnZeroAddress() public {
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E038_ZeroImplementation.selector));
        custody.proposeEmergencyUpgrade(address(0), dummyBlsSignature);
    }

    function test_proposeEmergencyUpgrade_revertsOnAlreadyPending() public {
        address newImpl = address(0xBEEF);
        custody.proposeEmergencyUpgrade(newImpl, dummyBlsSignature);

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E039_UpgradeAlreadyPending.selector));
        custody.proposeEmergencyUpgrade(address(0xDEAD), dummyBlsSignature);
    }

    function test_executeEmergencyUpgrade_happyPath() public {
        BLSCustody newImpl = new BLSCustody();

        // Propose emergency upgrade
        custody.proposeEmergencyUpgrade(address(newImpl), dummyBlsSignature);

        // Fast forward past 24-hour timelock
        vm.warp(block.timestamp + 24 hours + 1);

        // Execute upgrade
        custody.executeUpgrade(address(newImpl));

        // Verify pending upgrade is cleared
        (address proposedImpl, uint256 proposedAt, bool isEmergency) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
        assertEq(proposedAt, 0);
        assertFalse(isEmergency);
    }

    function test_executeEmergencyUpgrade_emitsEmergencyEvent() public {
        BLSCustody newImpl = new BLSCustody();
        custody.proposeEmergencyUpgrade(address(newImpl), dummyBlsSignature);
        vm.warp(block.timestamp + 24 hours + 1);

        vm.expectEmit(true, false, false, false);
        emit IBLSCustody.EmergencyUpgradeExecuted(address(newImpl));

        custody.executeUpgrade(address(newImpl));
    }

    function test_executeEmergencyUpgrade_revertsOnTimelockActive() public {
        address newImpl = address(0xBEEF);
        // Propose at timestamp 1 (forge default)
        custody.proposeEmergencyUpgrade(newImpl, dummyBlsSignature);

        // Fast forward only 12 hours (need 24 hours), timestamp becomes 1 + 12 hours = 43201
        vm.warp(1 + 12 hours);

        // Use hardcoded values to avoid via_ir optimizer inlining block.timestamp
        // proposedAt = 1, unlockTime = 1 + 24 hours = 86401, currentTime = 1 + 12 hours = 43201
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E042_UpgradeTimelockActive.selector, uint256(1 + 24 hours), uint256(1 + 12 hours))
        );
        custody.executeUpgrade(newImpl);
    }

    function test_executeEmergencyUpgrade_exactTimelockExpiry() public {
        BLSCustody newImpl = new BLSCustody();
        uint256 startTime = block.timestamp;
        custody.proposeEmergencyUpgrade(address(newImpl), dummyBlsSignature);

        // Fast forward to exactly 24 hours
        vm.warp(startTime + 24 hours);

        // Should succeed at exactly the timelock
        custody.executeUpgrade(address(newImpl));

        (address proposedImpl,,) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
    }

    function test_fullStandardUpgradeLifecycle() public {
        BLSCustody newImpl = new BLSCustody();

        // Step 1: No pending upgrade initially
        (address proposedImpl, uint256 proposedAt, bool isEmergency) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));

        // Step 2: Propose standard upgrade
        custody.proposeUpgrade(address(newImpl), dummyBlsSignature);
        (proposedImpl, proposedAt, isEmergency) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(newImpl));
        assertFalse(isEmergency);

        // Step 3: Cannot execute before timelock
        vm.expectRevert();
        custody.executeUpgrade(address(newImpl));

        // Step 4: Wait for timelock
        vm.warp(block.timestamp + 7 days + 1);

        // Step 5: Execute upgrade
        custody.executeUpgrade(address(newImpl));

        // Step 6: Pending upgrade cleared
        (proposedImpl,,) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
    }

    function test_fullEmergencyUpgradeLifecycle() public {
        BLSCustody newImpl = new BLSCustody();

        // Step 1: No pending upgrade initially
        (address proposedImpl, uint256 proposedAt, bool isEmergency) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));

        // Step 2: Propose emergency upgrade
        custody.proposeEmergencyUpgrade(address(newImpl), dummyBlsSignature);
        (proposedImpl, proposedAt, isEmergency) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(newImpl));
        assertTrue(isEmergency);

        // Step 3: Cannot execute before timelock (only 24h for emergency)
        vm.warp(block.timestamp + 12 hours);
        vm.expectRevert();
        custody.executeUpgrade(address(newImpl));

        // Step 4: Wait for full emergency timelock
        vm.warp(block.timestamp + 13 hours); // Total 25 hours

        // Step 5: Execute emergency upgrade
        custody.executeUpgrade(address(newImpl));

        // Step 6: Pending upgrade cleared
        (proposedImpl,,) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
    }

    function test_proposeUpgrade_invalidSignature_reverts() public {
        vm.mockCall(address(issuerRegistry), abi.encodeWithSelector(IIssuerRegistry.getAggregatedPubkey.selector), abi.encode(hex"aabbccdd"));

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E020_InvalidBLSSignature.selector));
        custody.proposeUpgrade(address(0xBEEF), hex"1234");
    }

    function test_proposeEmergencyUpgrade_invalidSignature_reverts() public {
        vm.mockCall(address(issuerRegistry), abi.encodeWithSelector(IIssuerRegistry.getAggregatedPubkey.selector), abi.encode(hex"aabbccdd"));

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E020_InvalidBLSSignature.selector));
        custody.proposeEmergencyUpgrade(address(0xBEEF), hex"1234");
    }

    // ============ FUZZ TESTS ============

    function testFuzz_execute_validNonces(uint256 nonceValue) public {
        // Bound nonce to reasonable range
        nonceValue = bound(nonceValue, 0, 1000000);

        _whitelistTarget(targetContract);

        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            1e18
        );

        custody.execute(targetContract, data, dummyBlsSignature, nonceValue);
        assertTrue(custody.isNonceUsed(nonceValue));
    }

    function testFuzz_nonceBitmap(uint256 nonce1, uint256 nonce2, uint256 nonce3) public {
        // Bound nonces and ensure uniqueness
        nonce1 = bound(nonce1, 0, 10000);
        nonce2 = bound(nonce2, 0, 10000);
        nonce3 = bound(nonce3, 0, 10000);
        vm.assume(nonce1 != nonce2 && nonce1 != nonce3 && nonce2 != nonce3);

        _whitelistTarget(targetContract);

        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(0x123),
            1e18
        );

        // Execute with all three nonces
        custody.execute(targetContract, data, dummyBlsSignature, nonce1);
        custody.execute(targetContract, data, dummyBlsSignature, nonce2);
        custody.execute(targetContract, data, dummyBlsSignature, nonce3);

        // All should be marked used
        assertTrue(custody.isNonceUsed(nonce1));
        assertTrue(custody.isNonceUsed(nonce2));
        assertTrue(custody.isNonceUsed(nonce3));
    }

    // ============ HELPER FUNCTIONS ============

    function _whitelistTarget(address target) internal {
        custody.proposeWhitelist(target, dummyBlsSignature);
        vm.warp(block.timestamp + 2 days + 1);
        custody.activateWhitelist(target);
    }
}
