// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/BLSCustody.sol";
import "../src/registry/IssuerRegistry.sol";
import "../src/mocks/MockERC20.sol";
import "../src/libraries/ErrorsLib.sol";
import "../src/libraries/EventsLib.sol";
import {BLSVerifier} from "../src/libraries/BLSVerifier.sol";
import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title IssuerCustodyL3.t.sol - Tests for Story 7.7
/// @notice Tests for IssuerCustody L3 (BLS-controlled custody for L3Usdc)
/// @dev Verifies BLS-signed transfers to Index contract and whitelist enforcement
contract IssuerCustodyL3Test is TestHelper {
    BLSCustody public issuerCustodyL3;
    IssuerRegistry public issuerRegistry;
    Governance public governance;
    MockERC20 public l3Usdc;

    address public indexContract;
    address public user1 = address(0x111);

    function setUp() public {
        // Deploy real governance and issuer registry via UUPS proxy
        governance = deployGovernance(address(this));
        issuerRegistry = deployIssuerRegistry(address(governance));

        // Register 3 real BLS test issuers and set aggregated pubkey
        registerTestIssuersWithBLS(issuerRegistry, address(this));

        // Deploy mock L3Usdc token (L3 bridged USDC uses 18 decimals)
        l3Usdc = new MockERC20("L3 USDC", "L3USDC", 18);

        // Deploy mock Index contract (just use a simple address for testing)
        indexContract = address(0x1234567890123456789012345678901234567890);

        // Deploy IssuerCustody L3 as UUPS proxy (using BLSCustody)
        BLSCustody impl = new BLSCustody();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(BLSCustody.initialize, (address(issuerRegistry)))
        );
        issuerCustodyL3 = BLSCustody(address(proxy));

        // Fund custody with L3Usdc for testing (18 decimals)
        l3Usdc.mint(address(issuerCustodyL3), 1_000_000e18);
    }

    // ============ TASK 5.1/5.2: BLS-SIGNED TRANSFER TO INDEX ============

    function test_transferToIndex_afterWhitelist() public {
        // Whitelist Index contract first
        _whitelistTarget(indexContract);

        // Build ERC20 transfer calldata
        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            indexContract,
            100e18
        );

        // Execute BLS-signed transfer
        bytes memory transferSig = _signExecute(address(issuerCustodyL3), address(l3Usdc), transferData, 0);
        (bool success, ) = issuerCustodyL3.execute(
            address(l3Usdc),
            transferData,
            transferSig,
            0
        , 3, 7);

        assertTrue(success, "Transfer should succeed");
        assertEq(l3Usdc.balanceOf(indexContract), 100e18, "Index should receive L3Usdc");
        assertEq(l3Usdc.balanceOf(address(issuerCustodyL3)), 999_900e18, "Custody balance should decrease");
    }

    function test_transferToIndex_emitsExecutedEvent() public {
        _whitelistTarget(indexContract);

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            indexContract,
            50e18
        );

        vm.expectEmit(true, false, false, true);
        emit EventsLib.Executed(address(l3Usdc), transferData, 0);

        issuerCustodyL3.execute(address(l3Usdc), transferData, _signExecute(address(issuerCustodyL3), address(l3Usdc), transferData, 0), 0, 3, 7);
    }

    function test_transferToIndex_multipleTransfersWithDifferentNonces() public {
        _whitelistTarget(indexContract);

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            indexContract,
            10e18
        );

        // Execute multiple transfers with different nonces — each nonce needs its own signature
        issuerCustodyL3.execute(address(l3Usdc), transferData, _signExecute(address(issuerCustodyL3), address(l3Usdc), transferData, 0), 0, 3, 7);
        issuerCustodyL3.execute(address(l3Usdc), transferData, _signExecute(address(issuerCustodyL3), address(l3Usdc), transferData, 1), 1, 3, 7);
        issuerCustodyL3.execute(address(l3Usdc), transferData, _signExecute(address(issuerCustodyL3), address(l3Usdc), transferData, 2), 2, 3, 7);

        assertEq(l3Usdc.balanceOf(indexContract), 30e18, "Index should receive 3 transfers");
        assertTrue(issuerCustodyL3.isNonceUsed(0));
        assertTrue(issuerCustodyL3.isNonceUsed(1));
        assertTrue(issuerCustodyL3.isNonceUsed(2));
    }

    // ============ TASK 5.3: UNAUTHORIZED TRANSFER FAILS ============

    function test_transferToIndex_revertsWithoutWhitelist() public {
        // Do NOT whitelist Index contract

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            indexContract,
            100e18
        );

        // Should revert because l3Usdc is not whitelisted — reverts before BLS check
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, address(l3Usdc)));
        issuerCustodyL3.execute(address(l3Usdc), transferData, new bytes(64), 0, 3, 7);
    }

    function test_transferToIndex_revertsOnNonceReuse() public {
        _whitelistTarget(indexContract);

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            indexContract,
            10e18
        );

        // First execution succeeds
        issuerCustodyL3.execute(address(l3Usdc), transferData, _signExecute(address(issuerCustodyL3), address(l3Usdc), transferData, 0), 0, 3, 7);

        // Second execution with same nonce fails — reverts before BLS check
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E025_NonceAlreadyUsed.selector, 0));
        issuerCustodyL3.execute(address(l3Usdc), transferData, new bytes(64), 0, 3, 7);
    }

    function test_transferToIndex_revertsWithInvalidBLSSignature() public {
        _whitelistTarget(indexContract);

        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            indexContract,
            100e18
        );

        // Sign over the wrong message hash — BLS verification will fail
        bytes memory invalidSig = signWithTestIssuers(keccak256("wrong message"));
        vm.expectRevert(abi.encodeWithSelector(BLSVerifier.BLSVerifier__InvalidSignature.selector));
        issuerCustodyL3.execute(address(l3Usdc), transferData, invalidSig, 0, 3, 7);
    }

    // ============ TASK 5.7: WHITELIST ENFORCEMENT ============

    function test_whitelistEnforcement_nonWhitelistedTargetFails() public {
        // Whitelist only Index, not some other target
        _whitelistTarget(indexContract);

        address randomTarget = address(0xBAD);

        // Try to execute against non-whitelisted target
        bytes memory data = abi.encodeWithSignature("someFunction()");

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, randomTarget));
        issuerCustodyL3.execute(randomTarget, data, new bytes(64), 0, 3, 7); // reverts before BLS check
    }

    function test_whitelistEnforcement_cannotCallNonWhitelistedToken() public {
        // Only whitelist Index contract, NOT l3Usdc
        issuerCustodyL3.proposeWhitelist(indexContract, _signProposeWhitelist(address(issuerCustodyL3), indexContract), 3, 7);
        vm.warp(block.timestamp + 2 days + 1);
        issuerCustodyL3.activateWhitelist(indexContract);

        // l3Usdc is NOT whitelisted
        assertFalse(issuerCustodyL3.isWhitelisted(address(l3Usdc)));

        address anyRecipient = address(0xEEEeEeeeEEeEEeEEeEEEEEEeEEeEEeeeeEee1111);

        // Try to call l3Usdc.transfer() - should fail because l3Usdc is not whitelisted as target
        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            anyRecipient,
            100e18
        );

        // This should fail because l3Usdc is not whitelisted as a call target — reverts before BLS check
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, address(l3Usdc)));
        issuerCustodyL3.execute(address(l3Usdc), transferData, new bytes(64), 0, 3, 7);
    }

    // ============ INITIALIZATION AND SETUP TESTS ============

    function test_initialization() public view {
        assertEq(address(issuerCustodyL3.issuerRegistry()), address(issuerRegistry));
        assertEq(issuerCustodyL3.nonce(), 0);
    }

    function test_usesAggregatedBLSKey() public view {
        // Verify custody uses IssuerRegistry for BLS key
        address registryAddr = address(issuerCustodyL3.issuerRegistry());
        assertEq(registryAddr, address(issuerRegistry), "Should use provided IssuerRegistry");
    }

    function test_whitelistProposal_succeeds() public {
        issuerCustodyL3.proposeWhitelist(indexContract, _signProposeWhitelist(address(issuerCustodyL3), indexContract), 3, 7);

        (uint256 proposedAt, uint256 activatedAt) = issuerCustodyL3.getWhitelistStatus(indexContract);
        assertGt(proposedAt, 0, "Proposal timestamp should be set");
        assertEq(activatedAt, 0, "Should not be activated yet");
        assertFalse(issuerCustodyL3.isWhitelisted(indexContract), "Should not be whitelisted yet");
    }

    function test_whitelistActivation_afterTimelock() public {
        issuerCustodyL3.proposeWhitelist(indexContract, _signProposeWhitelist(address(issuerCustodyL3), indexContract), 3, 7);

        // Fast forward past 2-day timelock
        vm.warp(block.timestamp + 2 days + 1);

        issuerCustodyL3.activateWhitelist(indexContract);

        assertTrue(issuerCustodyL3.isWhitelisted(indexContract), "Should be whitelisted after activation");
    }

    function test_whitelistActivation_failsBeforeTimelock() public {
        issuerCustodyL3.proposeWhitelist(indexContract, _signProposeWhitelist(address(issuerCustodyL3), indexContract), 3, 7);

        // Only fast forward 1 day (need 2 days)
        vm.warp(block.timestamp + 1 days);

        vm.expectRevert();
        issuerCustodyL3.activateWhitelist(indexContract);
    }

    // ============ INTEGRATION TEST: FULL FLOW ============

    function test_fullFlow_bridgeReceiptToSubmitOrder() public {
        // Simulate the flow from vital-test.md:
        // 1. IssuerCustody L3 receives L3Usdc (simulated by minting in setUp)
        assertEq(l3Usdc.balanceOf(address(issuerCustodyL3)), 1_000_000e18);

        // 2. Whitelist Index contract (with timelock)
        issuerCustodyL3.proposeWhitelist(indexContract, _signProposeWhitelist(address(issuerCustodyL3), indexContract), 3, 7);
        vm.warp(2 days + 2);
        issuerCustodyL3.activateWhitelist(indexContract);

        // 3. Also whitelist the l3Usdc token as transfer target
        issuerCustodyL3.proposeWhitelist(address(l3Usdc), _signProposeWhitelist(address(issuerCustodyL3), address(l3Usdc)), 3, 7);
        vm.warp(4 days + 3);
        issuerCustodyL3.activateWhitelist(address(l3Usdc));

        // 4. BLS-signed transfer to Index for submitOrder
        bytes memory transferData = abi.encodeWithSignature(
            "transfer(address,uint256)",
            indexContract,
            500_000e18
        );

        bytes memory execSig = _signExecute(address(issuerCustodyL3), address(l3Usdc), transferData, 0);
        (bool success, ) = issuerCustodyL3.execute(
            address(l3Usdc),
            transferData,
            execSig,
            0
        , 3, 7);

        assertTrue(success, "Transfer to Index should succeed");
        assertEq(l3Usdc.balanceOf(indexContract), 500_000e18, "Index should receive L3Usdc");
        assertEq(l3Usdc.balanceOf(address(issuerCustodyL3)), 500_000e18, "Custody should have remaining balance");
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
        return signWithTestIssuers(message);
    }

    /// @notice Sign a BLSCustody.proposeWhitelist call with real BLS signature
    function _signProposeWhitelist(address custodyAddr, address target) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, custodyAddr, "proposeWhitelist", target));
        return signWithTestIssuers(message);
    }

    function _whitelistTarget(address target) internal {
        // Whitelist both the target contract AND the l3Usdc token
        issuerCustodyL3.proposeWhitelist(address(l3Usdc), _signProposeWhitelist(address(issuerCustodyL3), address(l3Usdc)), 3, 7);
        vm.warp(2 days + 2);
        issuerCustodyL3.activateWhitelist(address(l3Usdc));

        // Also whitelist the target if different from l3Usdc
        if (target != address(l3Usdc)) {
            issuerCustodyL3.proposeWhitelist(target, _signProposeWhitelist(address(issuerCustodyL3), target), 3, 7);
            vm.warp(4 days + 3);
            issuerCustodyL3.activateWhitelist(target);
        }
    }
}
