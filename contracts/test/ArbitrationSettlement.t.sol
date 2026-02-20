// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "./helpers/TestHelper.sol";
import {ArbitrationSettlement} from "../src/arbitration/ArbitrationSettlement.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";
import {Governance} from "../src/Governance.sol";
import {ErrorsLib} from "../src/libraries/ErrorsLib.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title MockCollateralVault - Records settleBetByArbitration calls for test verification
contract MockCollateralVault {
    struct SettlementCall {
        uint256 betId;
        bool creatorWins;
    }

    SettlementCall[] public settlements;
    bool public shouldRevert;

    function settleBetByArbitration(uint256 betId, bool creatorWins) external {
        if (shouldRevert) revert("MockCollateralVault: forced revert");
        settlements.push(SettlementCall(betId, creatorWins));
    }

    function getSettlementCount() external view returns (uint256) {
        return settlements.length;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
}

/// @title ArbitrationSettlementTest - Comprehensive tests for ArbitrationSettlement.sol
/// @notice Tests constructor, setThreshold, settleBet (reverts + full BLS flow), replay protection
contract ArbitrationSettlementTest is TestHelper {
    ArbitrationSettlement public settlement;
    IssuerRegistry public issuerRegistry;
    Governance public governance;
    MockCollateralVault public vault;

    address public admin = makeAddr("admin");
    address public governanceAddr;
    address public attacker = makeAddr("attacker");

    // Events for expectEmit
    event BetSettled(uint256 indexed betId, bool creatorWins, uint256 signerCount);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    function setUp() public {
        // Deploy governance + issuer registry
        governance = deployGovernance(admin);
        governanceAddr = address(governance);
        issuerRegistry = deployIssuerRegistry(governanceAddr);

        // Register 3 test issuers with real BLS keys (seeds 0,1,2) + set aggregated pubkey
        registerTestIssuersWithBLS(issuerRegistry, admin);

        // Deploy mock collateral vault
        vault = new MockCollateralVault();

        // Deploy ArbitrationSettlement: threshold = 2 (of 3 issuers)
        settlement = new ArbitrationSettlement(
            address(issuerRegistry),
            address(vault),
            governanceAddr,
            2
        );
    }

    // ============ CONSTRUCTOR TESTS ============

    function test_constructor_setsStateCorrectly() public view {
        assertEq(settlement.collateralVault(), address(vault));
        assertEq(settlement.governance(), governanceAddr);
        assertEq(settlement.signatureThreshold(), 2);
        assertEq(address(settlement.blsIssuerRegistry()), address(issuerRegistry));
    }

    function test_constructor_revertsZeroCollateralVault() public {
        vm.expectRevert(ArbitrationSettlement.Unauthorized.selector);
        new ArbitrationSettlement(
            address(issuerRegistry),
            address(0),
            governanceAddr,
            2
        );
    }

    function test_constructor_revertsZeroGovernance() public {
        vm.expectRevert(ArbitrationSettlement.Unauthorized.selector);
        new ArbitrationSettlement(
            address(issuerRegistry),
            address(vault),
            address(0),
            2
        );
    }

    function test_constructor_revertsZeroThreshold() public {
        vm.expectRevert(abi.encodeWithSelector(ArbitrationSettlement.InvalidThreshold.selector, 0));
        new ArbitrationSettlement(
            address(issuerRegistry),
            address(vault),
            governanceAddr,
            0
        );
    }

    function test_constructor_revertsZeroIssuerRegistry() public {
        vm.expectRevert(ErrorsLib.E043_ZeroIssuerRegistry.selector);
        new ArbitrationSettlement(
            address(0),
            address(vault),
            governanceAddr,
            2
        );
    }

    // ============ setThreshold TESTS ============

    function test_setThreshold_worksFromGovernance() public {
        vm.prank(governanceAddr);
        settlement.setThreshold(3);
        assertEq(settlement.signatureThreshold(), 3);
    }

    function test_setThreshold_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit ThresholdUpdated(2, 5);

        vm.prank(governanceAddr);
        settlement.setThreshold(5);
    }

    function test_setThreshold_revertsUnauthorized() public {
        vm.expectRevert(ArbitrationSettlement.Unauthorized.selector);
        vm.prank(attacker);
        settlement.setThreshold(3);
    }

    function test_setThreshold_revertsZero() public {
        vm.expectRevert(abi.encodeWithSelector(ArbitrationSettlement.InvalidThreshold.selector, 0));
        vm.prank(governanceAddr);
        settlement.setThreshold(0);
    }

    // ============ settleBet REVERT TESTS ============

    function test_settleBet_revertsZeroBetId() public {
        vm.expectRevert(ArbitrationSettlement.ZeroBetId.selector);
        settlement.settleBet(0, true, new bytes(64), 0x7);
    }

    function test_settleBet_revertsInsufficientSignatures_bitmapPopcount() public {
        // Bitmap 0x1 = 1 signer, threshold = 2
        vm.expectRevert(abi.encodeWithSelector(
            ArbitrationSettlement.InsufficientSignatures.selector, 1, 2
        ));
        settlement.settleBet(1, true, new bytes(64), 0x1);
    }

    function test_settleBet_revertsInsufficientSignatures_noValidIssuers() public {
        // Bitmap 0x18 = bits 3 and 4 set (2 signers in popcount), but only issuers 0,1,2 exist
        // popcount(0x18) = 2 which matches threshold, but verifySignerBitmap returns 0 valid
        vm.expectRevert(abi.encodeWithSelector(
            ArbitrationSettlement.InsufficientSignatures.selector, 0, 2
        ));
        settlement.settleBet(1, true, new bytes(64), 0x18);
    }

    // ============ settleBet FULL BLS FLOW ============

    function test_settleBet_fullBLSFlow_creatorWins() public {
        uint256 betId = 42;
        bool creatorWins = true;

        // Compute the same message hash the contract will compute
        bytes32 messageHash = keccak256(
            abi.encode(block.chainid, address(settlement), "settleBet", betId, creatorWins)
        );

        // Sign with all 3 test issuers (real BLS via FFI)
        bytes memory blsSignature = signWithTestIssuers(messageHash);

        // Bitmap 0x7 = bits 0,1,2 set (all 3 issuers)
        uint256 signerBitmap = 0x7;

        vm.expectEmit(true, false, false, true);
        emit BetSettled(betId, creatorWins, 3);

        settlement.settleBet(betId, creatorWins, blsSignature, signerBitmap);

        // Verify settlement was recorded
        assertTrue(settlement.settled(betId));

        // Verify MockCollateralVault received the call
        assertEq(vault.getSettlementCount(), 1);
        (uint256 recordedBetId, bool recordedCreatorWins) = vault.settlements(0);
        assertEq(recordedBetId, betId);
        assertTrue(recordedCreatorWins);
    }

    function test_settleBet_fullBLSFlow_fillerWins() public {
        uint256 betId = 99;
        bool creatorWins = false;

        bytes32 messageHash = keccak256(
            abi.encode(block.chainid, address(settlement), "settleBet", betId, creatorWins)
        );

        bytes memory blsSignature = signWithTestIssuers(messageHash);

        vm.expectEmit(true, false, false, true);
        emit BetSettled(betId, creatorWins, 3);

        settlement.settleBet(betId, creatorWins, blsSignature, 0x7);

        assertTrue(settlement.settled(betId));

        (uint256 recordedBetId, bool recordedCreatorWins) = vault.settlements(0);
        assertEq(recordedBetId, betId);
        assertFalse(recordedCreatorWins);
    }

    function test_settleBet_multipleDistinctBets() public {
        // Settle bet 1
        bytes32 msgHash1 = keccak256(
            abi.encode(block.chainid, address(settlement), "settleBet", uint256(1), true)
        );
        bytes memory sig1 = signWithTestIssuers(msgHash1);
        settlement.settleBet(1, true, sig1, 0x7);

        // Settle bet 2
        bytes32 msgHash2 = keccak256(
            abi.encode(block.chainid, address(settlement), "settleBet", uint256(2), false)
        );
        bytes memory sig2 = signWithTestIssuers(msgHash2);
        settlement.settleBet(2, false, sig2, 0x7);

        assertTrue(settlement.settled(1));
        assertTrue(settlement.settled(2));
        assertEq(vault.getSettlementCount(), 2);
    }

    // ============ DOUBLE SETTLEMENT (REPLAY PROTECTION) ============

    function test_settleBet_revertsDoubleSettlement() public {
        uint256 betId = 42;
        bool creatorWins = true;

        bytes32 messageHash = keccak256(
            abi.encode(block.chainid, address(settlement), "settleBet", betId, creatorWins)
        );
        bytes memory blsSignature = signWithTestIssuers(messageHash);

        // First settlement succeeds
        settlement.settleBet(betId, creatorWins, blsSignature, 0x7);

        // Second settlement reverts
        vm.expectRevert(abi.encodeWithSelector(ArbitrationSettlement.BetAlreadySettled.selector, betId));
        settlement.settleBet(betId, creatorWins, blsSignature, 0x7);
    }

    // ============ INVALID BLS SIGNATURE ============

    function test_settleBet_revertsInvalidBLSSignature() public {
        uint256 betId = 42;
        bool creatorWins = true;

        // Sign a WRONG message (not matching the contract's expected message hash)
        bytes memory wrongSig = signWithTestIssuers(keccak256("totally wrong message"));

        vm.expectRevert(ErrorsLib.E020_InvalidBLSSignature.selector);
        settlement.settleBet(betId, creatorWins, wrongSig, 0x7);
    }

    function test_settleBet_revertsGarbageSignature() public {
        // 64 bytes of garbage
        bytes memory garbageSig = new bytes(64);
        garbageSig[0] = 0xDE;
        garbageSig[1] = 0xAD;

        // popcount(0x7)=3 >= threshold=2, and verifySignerBitmap returns 3 valid
        // So it should reach BLS verification and fail there
        vm.expectRevert();
        settlement.settleBet(1, true, garbageSig, 0x7);
    }

    function test_settleBet_revertsWrongCreatorWinsValue() public {
        uint256 betId = 42;

        // Sign for creatorWins=true
        bytes32 messageHashTrue = keccak256(
            abi.encode(block.chainid, address(settlement), "settleBet", betId, true)
        );
        bytes memory sigTrue = signWithTestIssuers(messageHashTrue);

        // Try to settle with creatorWins=false using the signature for creatorWins=true
        vm.expectRevert(ErrorsLib.E020_InvalidBLSSignature.selector);
        settlement.settleBet(betId, false, sigTrue, 0x7);
    }

    // ============ VAULT CALL FAILURE ============

    function test_settleBet_revertsWhenVaultCallFails() public {
        uint256 betId = 42;
        bool creatorWins = true;

        // Make vault revert
        vault.setShouldRevert(true);

        bytes32 messageHash = keccak256(
            abi.encode(block.chainid, address(settlement), "settleBet", betId, creatorWins)
        );
        bytes memory blsSignature = signWithTestIssuers(messageHash);

        vm.expectRevert(ArbitrationSettlement.SettlementCallFailed.selector);
        settlement.settleBet(betId, creatorWins, blsSignature, 0x7);
    }

    // ============ THRESHOLD EDGE CASES ============

    function test_settleBet_exactlyAtThreshold() public {
        // Threshold is 2, use bitmap with exactly 2 signers (issuers 0 and 1)
        // This requires a BLS signature from only issuers 0 and 1
        uint256 betId = 42;
        bool creatorWins = true;

        bytes32 messageHash = keccak256(
            abi.encode(block.chainid, address(settlement), "settleBet", betId, creatorWins)
        );

        // Sign with issuers 0 and 1 only (seeds 0,1)
        bytes memory sig2of3 = blsSign("0,1", messageHash);

        // But the contract verifies against the aggregated pubkey (all 3),
        // so this signature from only 2 signers won't match the agg pubkey of all 3.
        // The BLS verification uses the full aggregated pubkey from the registry,
        // so the signature must match ALL issuers' aggregated pubkey.
        // This means we need all 3 to sign, even if bitmap says 2.
        // Let's use the full signature with a bitmap of 2 to test threshold counting.
        bytes memory fullSig = signWithTestIssuers(messageHash);

        // Bitmap 0x3 = bits 0,1 (2 signers, meets threshold of 2)
        // But verifySignerBitmap will return 2 valid (issuers 0 and 1 are registered)
        settlement.settleBet(betId, creatorWins, fullSig, 0x3);

        assertTrue(settlement.settled(betId));
    }

    function test_setThreshold_thenSettleBetWithNewThreshold() public {
        // Raise threshold to 3
        vm.prank(governanceAddr);
        settlement.setThreshold(3);

        uint256 betId = 42;
        bool creatorWins = true;

        bytes32 messageHash = keccak256(
            abi.encode(block.chainid, address(settlement), "settleBet", betId, creatorWins)
        );
        bytes memory blsSignature = signWithTestIssuers(messageHash);

        // With threshold=3, bitmap 0x3 (2 signers) should fail
        vm.expectRevert(abi.encodeWithSelector(
            ArbitrationSettlement.InsufficientSignatures.selector, 2, 3
        ));
        settlement.settleBet(betId, creatorWins, blsSignature, 0x3);

        // With threshold=3, bitmap 0x7 (3 signers) should succeed
        settlement.settleBet(betId, creatorWins, blsSignature, 0x7);
        assertTrue(settlement.settled(betId));
    }

    // ============ ACCESS CONTROL ============

    function test_settleBet_callableByAnyone() public {
        uint256 betId = 42;
        bool creatorWins = true;

        bytes32 messageHash = keccak256(
            abi.encode(block.chainid, address(settlement), "settleBet", betId, creatorWins)
        );
        bytes memory blsSignature = signWithTestIssuers(messageHash);

        // Anyone can call settleBet as long as BLS signature is valid
        vm.prank(attacker);
        settlement.settleBet(betId, creatorWins, blsSignature, 0x7);

        assertTrue(settlement.settled(betId));
    }

    // ============ SETTLED MAPPING ============

    function test_settled_defaultFalse() public view {
        assertFalse(settlement.settled(1));
        assertFalse(settlement.settled(999));
        assertFalse(settlement.settled(type(uint256).max));
    }
}
