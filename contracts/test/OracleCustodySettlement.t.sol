// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/BLSCustody.sol";
import "../src/registry/OracleRegistry.sol";
import "../src/mocks/MockERC20.sol";
import "../src/libraries/ErrorsLib.sol";
import "../src/libraries/EventsLib.sol";
import {BLSVerifier} from "../src/libraries/BLSVerifier.sol";
import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title OracleCustodySettlement.t.sol - Tests for Story 7.7
/// @notice Tests for OracleCustody Settlement (BLS-controlled custody for SettlementUSDC)
/// @dev Verifies BLS-signed transfers to MockBitgetVault and whitelist enforcement
contract OracleCustodySettlementTest is TestHelper {
    BLSCustody public oracleCustodySettlement;
    OracleRegistry public oracleRegistry;
    Governance public governance;
    MockERC20 public settlementUsdc;

    address public mockBitgetVault;
    address public user1 = address(0x111);

    function setUp() public {
        // Deploy real governance and oracle registry via UUPS proxy
        governance = deployGovernance(address(this));
        oracleRegistry = deployOracleRegistry(address(governance));

        // Register 3 real BLS test oracles and set aggregated pubkey
        registerTestOraclesWithBLS(oracleRegistry, address(this));

        // Deploy mock SettlementUSDC token
        settlementUsdc = new MockERC20("Settlement USDC", "SettlementUSDC", 6);

        // Deploy mock BitgetVault (just use a simple address for testing)
        mockBitgetVault = address(0xb17637B17637b17637B17637B17637B17637b176);

        // Deploy OracleCustody Settlement as UUPS proxy (using BLSCustody)
        BLSCustody impl = new BLSCustody();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(BLSCustody.initialize, (address(oracleRegistry)))
        );
        oracleCustodySettlement = BLSCustody(address(proxy));

        // Fund custody with SettlementUSDC for testing
        settlementUsdc.mint(address(oracleCustodySettlement), 1_000_000e6);
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
        bytes memory transferSig = _signExecute(address(oracleCustodySettlement), address(settlementUsdc), transferData, 0);
        (bool success, ) = oracleCustodySettlement.execute(
            address(settlementUsdc),
            transferData,
            transferSig,
            0
        , 3, 7);

        assertTrue(success, "Transfer should succeed");
        assertEq(settlementUsdc.balanceOf(mockBitgetVault), 100_000e6, "MockBitgetVault should receive SettlementUSDC");
        assertEq(settlementUsdc.balanceOf(address(oracleCustodySettlement)), 900_000e6, "Custody balance should decrease");
    }

    function test_transferToMockBitgetVault_emitsExecutedEvent() public {
        _whitelistTarget(mockBitgetVault);

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            50_000e6
        );

        vm.expectEmit(true, false, false, true);
        emit EventsLib.Executed(address(settlementUsdc), transferData, 0);

        oracleCustodySettlement.execute(address(settlementUsdc), transferData, _signExecute(address(oracleCustodySettlement), address(settlementUsdc), transferData, 0), 0, 3, 7);
    }

    function test_transferToMockBitgetVault_multipleTransfersWithDifferentNonces() public {
        _whitelistTarget(mockBitgetVault);

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            10_000e6
        );

        // Execute multiple transfers with different nonces — each nonce needs its own signature
        oracleCustodySettlement.execute(address(settlementUsdc), transferData, _signExecute(address(oracleCustodySettlement), address(settlementUsdc), transferData, 0), 0, 3, 7);
        oracleCustodySettlement.execute(address(settlementUsdc), transferData, _signExecute(address(oracleCustodySettlement), address(settlementUsdc), transferData, 1), 1, 3, 7);
        oracleCustodySettlement.execute(address(settlementUsdc), transferData, _signExecute(address(oracleCustodySettlement), address(settlementUsdc), transferData, 2), 2, 3, 7);

        assertEq(settlementUsdc.balanceOf(mockBitgetVault), 30_000e6, "MockBitgetVault should receive 3 transfers");
        assertTrue(oracleCustodySettlement.isNonceUsed(0));
        assertTrue(oracleCustodySettlement.isNonceUsed(1));
        assertTrue(oracleCustodySettlement.isNonceUsed(2));
    }

    // ============ TASK 5.6: UNAUTHORIZED TRANSFER FAILS ============

    function test_transferToMockBitgetVault_revertsWithoutWhitelist() public {
        // Do NOT whitelist MockBitgetVault

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            100_000e6
        );

        // Should revert because settlementUsdc is not whitelisted — reverts before BLS check
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, address(settlementUsdc)));
        oracleCustodySettlement.execute(address(settlementUsdc), transferData, new bytes(64), 0, 3, 7);
    }

    function test_transferToMockBitgetVault_revertsOnNonceReuse() public {
        _whitelistTarget(mockBitgetVault);

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            10_000e6
        );

        // First execution succeeds
        oracleCustodySettlement.execute(address(settlementUsdc), transferData, _signExecute(address(oracleCustodySettlement), address(settlementUsdc), transferData, 0), 0, 3, 7);

        // Second execution with same nonce fails — reverts before BLS check
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E025_NonceAlreadyUsed.selector, 0));
        oracleCustodySettlement.execute(address(settlementUsdc), transferData, new bytes(64), 0, 3, 7);
    }

    function test_transferToMockBitgetVault_revertsWithInvalidBLSSignature() public {
        _whitelistTarget(mockBitgetVault);

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            100_000e6
        );

        // Sign over the wrong message hash — BLS verification will fail
        bytes memory invalidSig = signWithTestOracles(keccak256("wrong message"));
        vm.expectRevert(abi.encodeWithSelector(BLSVerifier.BLSVerifier__InvalidSignature.selector));
        oracleCustodySettlement.execute(address(settlementUsdc), transferData, invalidSig, 0, 3, 7);
    }

    // ============ TASK 5.7: WHITELIST ENFORCEMENT ============

    function test_whitelistEnforcement_nonWhitelistedTargetFails() public {
        // Whitelist only MockBitgetVault, not some other target
        _whitelistTarget(mockBitgetVault);

        address randomTarget = address(0xBAD);

        // Try to execute against non-whitelisted target
        bytes memory data = abi.encodeWithSignature("someFunction()");

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, randomTarget));
        oracleCustodySettlement.execute(randomTarget, data, new bytes(64), 0, 3, 7); // reverts before BLS check
    }

    function test_whitelistEnforcement_cannotCallNonWhitelistedToken() public {
        // Only whitelist MockBitgetVault, NOT settlementUsdc
        oracleCustodySettlement.proposeWhitelist(mockBitgetVault, _signProposeWhitelist(address(oracleCustodySettlement), mockBitgetVault), 3, 7);
        vm.warp(block.timestamp + 2 days + 1);
        oracleCustodySettlement.activateWhitelist(mockBitgetVault);

        // settlementUsdc is NOT whitelisted
        assertFalse(oracleCustodySettlement.isWhitelisted(address(settlementUsdc)));

        address anyRecipient = address(0xEEEeEeeeEEeEEeEEeEEEEEEeEEeEEeeeeEee1111);

        // Try to call settlementUsdc.transfer() - should fail because settlementUsdc is not whitelisted as target
        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            anyRecipient,
            100_000e6
        );

        // This should fail because settlementUsdc is not whitelisted as a call target — reverts before BLS check
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, address(settlementUsdc)));
        oracleCustodySettlement.execute(address(settlementUsdc), transferData, new bytes(64), 0, 3, 7);
    }

    // ============ INITIALIZATION AND SETUP TESTS ============

    function test_initialization() public view {
        assertEq(address(oracleCustodySettlement.oracleRegistry()), address(oracleRegistry));
        assertEq(oracleCustodySettlement.nonce(), 0);
    }

    function test_usesAggregatedBLSKey() public view {
        // Verify custody uses OracleRegistry for BLS key
        address registryAddr = address(oracleCustodySettlement.oracleRegistry());
        assertEq(registryAddr, address(oracleRegistry), "Should use provided OracleRegistry");
    }

    function test_whitelistProposal_succeeds() public {
        oracleCustodySettlement.proposeWhitelist(mockBitgetVault, _signProposeWhitelist(address(oracleCustodySettlement), mockBitgetVault), 3, 7);

        (uint256 proposedAt, uint256 activatedAt) = oracleCustodySettlement.getWhitelistStatus(mockBitgetVault);
        assertGt(proposedAt, 0, "Proposal timestamp should be set");
        assertEq(activatedAt, 0, "Should not be activated yet");
        assertFalse(oracleCustodySettlement.isWhitelisted(mockBitgetVault), "Should not be whitelisted yet");
    }

    function test_whitelistActivation_afterTimelock() public {
        oracleCustodySettlement.proposeWhitelist(mockBitgetVault, _signProposeWhitelist(address(oracleCustodySettlement), mockBitgetVault), 3, 7);

        // Fast forward past 2-day timelock
        vm.warp(block.timestamp + 2 days + 1);

        oracleCustodySettlement.activateWhitelist(mockBitgetVault);

        assertTrue(oracleCustodySettlement.isWhitelisted(mockBitgetVault), "Should be whitelisted after activation");
    }

    function test_whitelistActivation_failsBeforeTimelock() public {
        oracleCustodySettlement.proposeWhitelist(mockBitgetVault, _signProposeWhitelist(address(oracleCustodySettlement), mockBitgetVault), 3, 7);

        // Only fast forward 1 day (need 2 days)
        vm.warp(block.timestamp + 1 days);

        vm.expectRevert();
        oracleCustodySettlement.activateWhitelist(mockBitgetVault);
    }

    // ============ INTEGRATION TEST: FULL FLOW ============

    function test_fullFlow_bridgeReceiptToVaultRelease() public {
        // Simulate the flow from vital-test.md:
        // 1. OracleCustody Settlement receives SettlementUSDC (simulated by minting in setUp)
        assertEq(settlementUsdc.balanceOf(address(oracleCustodySettlement)), 1_000_000e6);

        // 2. Whitelist MockBitgetVault (with timelock)
        oracleCustodySettlement.proposeWhitelist(mockBitgetVault, _signProposeWhitelist(address(oracleCustodySettlement), mockBitgetVault), 3, 7);
        vm.warp(2 days + 2);
        oracleCustodySettlement.activateWhitelist(mockBitgetVault);

        // 3. Also whitelist the settlementUsdc token as transfer target
        oracleCustodySettlement.proposeWhitelist(address(settlementUsdc), _signProposeWhitelist(address(oracleCustodySettlement), address(settlementUsdc)), 3, 7);
        vm.warp(4 days + 3);
        oracleCustodySettlement.activateWhitelist(address(settlementUsdc));

        // 4. BLS-signed transfer to MockBitgetVault for AP trading
        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            mockBitgetVault,
            500_000e6
        );

        bytes memory execSig = _signExecute(address(oracleCustodySettlement), address(settlementUsdc), transferData, 0);
        (bool success, ) = oracleCustodySettlement.execute(
            address(settlementUsdc),
            transferData,
            execSig,
            0
        , 3, 7);

        assertTrue(success, "Transfer to MockBitgetVault should succeed");
        assertEq(settlementUsdc.balanceOf(mockBitgetVault), 500_000e6, "MockBitgetVault should receive SettlementUSDC");
        assertEq(settlementUsdc.balanceOf(address(oracleCustodySettlement)), 500_000e6, "Custody should have remaining balance");
    }

    // ============ BOTH CUSTODY CONTRACTS USE SAME ORACLE REGISTRY (AC#7) ============

    function test_sameOracleRegistryAsL3() public {
        // Deploy a second custody (simulating L3 custody)
        BLSCustody impl2 = new BLSCustody();
        ERC1967Proxy proxy2 = new ERC1967Proxy(
            address(impl2),
            abi.encodeCall(BLSCustody.initialize, (address(oracleRegistry)))
        );
        BLSCustody oracleCustodyL3 = BLSCustody(address(proxy2));

        // Both should use the same OracleRegistry
        assertEq(
            address(oracleCustodySettlement.oracleRegistry()),
            address(oracleCustodyL3.oracleRegistry()),
            "Both custody contracts should use the same OracleRegistry"
        );
    }

    // ============ HELPER FUNCTIONS ============

    /// @notice Sign a BLSCustody.execute call with real BLS signature
    function _signExecute(
        address custodyAddr,
        address target,
        bytes memory data,
        uint256 nonceValue
    ) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, custodyAddr, target, data, nonceValue));
        return signWithTestOracles(message);
    }

    /// @notice Sign a BLSCustody.proposeWhitelist call with real BLS signature
    function _signProposeWhitelist(address custodyAddr, address target) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, custodyAddr, "proposeWhitelist", target));
        return signWithTestOracles(message);
    }

    function _whitelistTarget(address target) internal {
        // Whitelist both the target contract AND the settlementUsdc token
        oracleCustodySettlement.proposeWhitelist(address(settlementUsdc), _signProposeWhitelist(address(oracleCustodySettlement), address(settlementUsdc)), 3, 7);
        vm.warp(2 days + 2);
        oracleCustodySettlement.activateWhitelist(address(settlementUsdc));

        // Also whitelist the target if different from settlementUsdc
        if (target != address(settlementUsdc)) {
            oracleCustodySettlement.proposeWhitelist(target, _signProposeWhitelist(address(oracleCustodySettlement), target), 3, 7);
            vm.warp(4 days + 3);
            oracleCustodySettlement.activateWhitelist(target);
        }
    }
}
