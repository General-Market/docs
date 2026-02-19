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

/// @title IssuerCustodyArb.t.sol - Tests for Story 7.7
/// @notice Tests for IssuerCustody Arbitrum (BLS-controlled custody for ArbUSDC)
/// @dev Verifies BLS-signed transfers to MockBitgetVault and whitelist enforcement
contract IssuerCustodyArbTest is TestHelper {
    BLSCustody public issuerCustodyArb;
    IssuerRegistry public issuerRegistry;
    Governance public governance;
    MockERC20 public arbUsdc;

    address public mockBitgetVault;
    address public user1 = address(0x111);

    // Dummy BLS signature (G1 generator point, 64 bytes) — precompile 0x08 is mocked
    bytes public dummyBlsSignature = abi.encode(uint256(1), uint256(2));

    function setUp() public {
        // Mock BN254 pairing precompile to always return true (we test custody logic, not BLS math)
        vm.mockCall(address(0x08), bytes(""), abi.encode(uint256(1)));

        // Deploy real governance and issuer registry via UUPS proxy
        governance = deployGovernance(address(this));
        issuerRegistry = deployIssuerRegistry(address(governance));

        // Set non-empty 128-byte aggregated pubkey (hardened contracts revert on empty pubkey)
        issuerRegistry.setAggregatedPubkey(new bytes(128));

        // Deploy mock ArbUSDC token
        arbUsdc = new MockERC20("Arbitrum USDC", "ArbUSDC", 6);

        // Deploy mock BitgetVault (just use a simple address for testing)
        mockBitgetVault = address(0xb17637B17637b17637B17637B17637B17637b176);

        // Deploy IssuerCustody Arbitrum as UUPS proxy (using BLSCustody)
        BLSCustody impl = new BLSCustody();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(BLSCustody.initialize, (address(issuerRegistry)))
        );
        issuerCustodyArb = BLSCustody(address(proxy));

        // Fund custody with ArbUSDC for testing
        arbUsdc.mint(address(issuerCustodyArb), 1_000_000e6);
    }

    // ============ TASK 5.4/5.5: BLS-SIGNED TRANSFER TO MOCKBITGETVAULT ============

    function test_transferToMockBitgetVault_afterWhitelist() public {
        // Whitelist MockBitgetVault first
        _whitelistTarget(mockBitgetVault);

        // Build ERC20 transfer calldata
        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            100_000e6
        );

        // Execute BLS-signed transfer
        (bool success, ) = issuerCustodyArb.execute(
            address(arbUsdc),
            transferData,
            dummyBlsSignature,
            0
        );

        assertTrue(success, "Transfer should succeed");
        assertEq(arbUsdc.balanceOf(mockBitgetVault), 100_000e6, "MockBitgetVault should receive ArbUSDC");
        assertEq(arbUsdc.balanceOf(address(issuerCustodyArb)), 900_000e6, "Custody balance should decrease");
    }

    function test_transferToMockBitgetVault_emitsExecutedEvent() public {
        _whitelistTarget(mockBitgetVault);

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            50_000e6
        );

        vm.expectEmit(true, false, false, true);
        emit EventsLib.Executed(address(arbUsdc), transferData, 0);

        issuerCustodyArb.execute(address(arbUsdc), transferData, dummyBlsSignature, 0);
    }

    function test_transferToMockBitgetVault_multipleTransfersWithDifferentNonces() public {
        _whitelistTarget(mockBitgetVault);

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            10_000e6
        );

        // Execute multiple transfers with different nonces
        issuerCustodyArb.execute(address(arbUsdc), transferData, dummyBlsSignature, 0);
        issuerCustodyArb.execute(address(arbUsdc), transferData, dummyBlsSignature, 1);
        issuerCustodyArb.execute(address(arbUsdc), transferData, dummyBlsSignature, 2);

        assertEq(arbUsdc.balanceOf(mockBitgetVault), 30_000e6, "MockBitgetVault should receive 3 transfers");
        assertTrue(issuerCustodyArb.isNonceUsed(0));
        assertTrue(issuerCustodyArb.isNonceUsed(1));
        assertTrue(issuerCustodyArb.isNonceUsed(2));
    }

    // ============ TASK 5.6: UNAUTHORIZED TRANSFER FAILS ============

    function test_transferToMockBitgetVault_revertsWithoutWhitelist() public {
        // Do NOT whitelist MockBitgetVault

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            100_000e6
        );

        // Should revert because arbUsdc is not whitelisted
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, address(arbUsdc)));
        issuerCustodyArb.execute(address(arbUsdc), transferData, dummyBlsSignature, 0);
    }

    function test_transferToMockBitgetVault_revertsOnNonceReuse() public {
        _whitelistTarget(mockBitgetVault);

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            10_000e6
        );

        // First execution succeeds
        issuerCustodyArb.execute(address(arbUsdc), transferData, dummyBlsSignature, 0);

        // Second execution with same nonce fails
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E025_NonceAlreadyUsed.selector, 0));
        issuerCustodyArb.execute(address(arbUsdc), transferData, dummyBlsSignature, 0);
    }

    function test_transferToMockBitgetVault_revertsWithInvalidBLSSignature() public {
        _whitelistTarget(mockBitgetVault);

        // Set non-empty aggregated pubkey to enable BLS verification
        vm.mockCall(address(issuerRegistry), abi.encodeWithSelector(IIssuerRegistry.getAggregatedPubkey.selector), abi.encode(hex"aabbccdd"));

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            100_000e6
        );

        // Any signature will be invalid against this fake pubkey
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E020_InvalidBLSSignature.selector));
        issuerCustodyArb.execute(address(arbUsdc), transferData, hex"1234", 0);
    }

    // ============ TASK 5.7: WHITELIST ENFORCEMENT ============

    function test_whitelistEnforcement_nonWhitelistedTargetFails() public {
        // Whitelist only MockBitgetVault, not some other target
        _whitelistTarget(mockBitgetVault);

        address randomTarget = address(0xBAD);

        // Try to execute against non-whitelisted target
        bytes memory data = abi.encodeWithSignature("someFunction()");

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, randomTarget));
        issuerCustodyArb.execute(randomTarget, data, dummyBlsSignature, 0);
    }

    function test_whitelistEnforcement_cannotCallNonWhitelistedToken() public {
        // Only whitelist MockBitgetVault, NOT arbUsdc
        issuerCustodyArb.proposeWhitelist(mockBitgetVault, dummyBlsSignature);
        vm.warp(block.timestamp + 2 days + 1);
        issuerCustodyArb.activateWhitelist(mockBitgetVault);

        // arbUsdc is NOT whitelisted
        assertFalse(issuerCustodyArb.isWhitelisted(address(arbUsdc)));

        address anyRecipient = address(0xEEEeEeeeEEeEEeEEeEEEEEEeEEeEEeeeeEee1111);

        // Try to call arbUsdc.transfer() - should fail because arbUsdc is not whitelisted as target
        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            anyRecipient,
            100_000e6
        );

        // This should fail because arbUsdc is not whitelisted as a call target
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, address(arbUsdc)));
        issuerCustodyArb.execute(address(arbUsdc), transferData, dummyBlsSignature, 0);
    }

    // ============ INITIALIZATION AND SETUP TESTS ============

    function test_initialization() public view {
        assertEq(address(issuerCustodyArb.issuerRegistry()), address(issuerRegistry));
        assertEq(issuerCustodyArb.nonce(), 0);
    }

    function test_usesAggregatedBLSKey() public view {
        // Verify custody uses IssuerRegistry for BLS key
        address registryAddr = address(issuerCustodyArb.issuerRegistry());
        assertEq(registryAddr, address(issuerRegistry), "Should use provided IssuerRegistry");
    }

    function test_whitelistProposal_succeeds() public {
        issuerCustodyArb.proposeWhitelist(mockBitgetVault, dummyBlsSignature);

        (uint256 proposedAt, uint256 activatedAt) = issuerCustodyArb.getWhitelistStatus(mockBitgetVault);
        assertGt(proposedAt, 0, "Proposal timestamp should be set");
        assertEq(activatedAt, 0, "Should not be activated yet");
        assertFalse(issuerCustodyArb.isWhitelisted(mockBitgetVault), "Should not be whitelisted yet");
    }

    function test_whitelistActivation_afterTimelock() public {
        issuerCustodyArb.proposeWhitelist(mockBitgetVault, dummyBlsSignature);

        // Fast forward past 2-day timelock
        vm.warp(block.timestamp + 2 days + 1);

        issuerCustodyArb.activateWhitelist(mockBitgetVault);

        assertTrue(issuerCustodyArb.isWhitelisted(mockBitgetVault), "Should be whitelisted after activation");
    }

    function test_whitelistActivation_failsBeforeTimelock() public {
        issuerCustodyArb.proposeWhitelist(mockBitgetVault, dummyBlsSignature);

        // Only fast forward 1 day (need 2 days)
        vm.warp(block.timestamp + 1 days);

        vm.expectRevert();
        issuerCustodyArb.activateWhitelist(mockBitgetVault);
    }

    // ============ INTEGRATION TEST: FULL FLOW ============

    function test_fullFlow_bridgeReceiptToVaultRelease() public {
        // Simulate the flow from vital-test.md:
        // 1. IssuerCustody Arb receives ArbUSDC (simulated by minting in setUp)
        assertEq(arbUsdc.balanceOf(address(issuerCustodyArb)), 1_000_000e6);

        // 2. Whitelist MockBitgetVault (with timelock)
        issuerCustodyArb.proposeWhitelist(mockBitgetVault, dummyBlsSignature);
        vm.warp(2 days + 2);
        issuerCustodyArb.activateWhitelist(mockBitgetVault);

        // 3. Also whitelist the arbUsdc token as transfer target
        issuerCustodyArb.proposeWhitelist(address(arbUsdc), dummyBlsSignature);
        vm.warp(4 days + 3);
        issuerCustodyArb.activateWhitelist(address(arbUsdc));

        // 4. BLS-signed transfer to MockBitgetVault for AP trading
        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            500_000e6
        );

        (bool success, ) = issuerCustodyArb.execute(
            address(arbUsdc),
            transferData,
            dummyBlsSignature,
            0
        );

        assertTrue(success, "Transfer to MockBitgetVault should succeed");
        assertEq(arbUsdc.balanceOf(mockBitgetVault), 500_000e6, "MockBitgetVault should receive ArbUSDC");
        assertEq(arbUsdc.balanceOf(address(issuerCustodyArb)), 500_000e6, "Custody should have remaining balance");
    }

    // ============ BOTH CUSTODY CONTRACTS USE SAME ISSUER REGISTRY (AC#7) ============

    function test_sameIssuerRegistryAsL3() public {
        // Deploy a second custody (simulating L3 custody)
        BLSCustody impl2 = new BLSCustody();
        ERC1967Proxy proxy2 = new ERC1967Proxy(
            address(impl2),
            abi.encodeCall(BLSCustody.initialize, (address(issuerRegistry)))
        );
        BLSCustody issuerCustodyL3 = BLSCustody(address(proxy2));

        // Both should use the same IssuerRegistry
        assertEq(
            address(issuerCustodyArb.issuerRegistry()),
            address(issuerCustodyL3.issuerRegistry()),
            "Both custody contracts should use the same IssuerRegistry"
        );
    }

    // ============ HELPER FUNCTIONS ============

    function _whitelistTarget(address target) internal {
        // Whitelist both the target contract AND the arbUsdc token
        issuerCustodyArb.proposeWhitelist(address(arbUsdc), dummyBlsSignature);
        vm.warp(2 days + 2);
        issuerCustodyArb.activateWhitelist(address(arbUsdc));

        // Also whitelist the target if different from arbUsdc
        if (target != address(arbUsdc)) {
            issuerCustodyArb.proposeWhitelist(target, dummyBlsSignature);
            vm.warp(4 days + 3);
            issuerCustodyArb.activateWhitelist(target);
        }
    }
}
